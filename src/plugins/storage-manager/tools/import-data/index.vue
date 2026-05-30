<template>
  <div class="tool-container">
    <div class="import-warning">
      <span class="warn-icon">⚠</span>
      <div>
        <p class="warn-title">导入说明</p>
        <p class="warn-text">请选择不包含邮箱标识的通用数据文件（earth-survival-diary-export-YYYY-MM-DD.json），导入将覆盖当前用户的对应数据。</p>
      </div>
    </div>

    <div class="file-area">
      <div v-if="fileInfo" class="file-info">
        <p>已选择文件: <strong>{{ fileInfo.name }}</strong></p>
        <p>导出时间: {{ fileInfo.exportTime }}</p>
      </div>
      <div v-else class="file-placeholder">请选择文件</div>
    </div>

    <div v-if="fileInfo" class="module-tree">
      <div class="select-all-row">
        <el-checkbox v-model="selectAll" @change="onSelectAll">全选</el-checkbox>
      </div>
      <div v-for="group in groups" :key="group.key" class="module-group">
        <div class="group-header" @click="toggleGroup(group.key)">
          <span class="expand-icon">{{ expanded.includes(group.key) ? '−' : '+' }}</span>
          <span class="group-label">{{ group.label }}</span>
        </div>
        <div v-show="expanded.includes(group.key)" class="group-children">
          <div v-for="child in group.children" :key="child.key" class="child-item">
            <el-checkbox v-model="importSelected" :label="child.key" :disabled="!available[child.key]">
              {{ child.label }} {{ !available[child.key] ? '(无数据)' : '' }}
            </el-checkbox>
          </div>
        </div>
      </div>
    </div>

    <div class="tool-footer">
      <el-button @click="selectFile">选择文件</el-button>
      <el-button type="primary" @click="handleImport" :loading="loading" :disabled="!dataRaw">导入</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { logger } from '../../../../lib/logger'
import * as api from '../../../../lib/api'

const loading = ref(false)
const dataRaw = ref<any>(null)
const fileInfo = ref<{ name: string; exportTime: string } | null>(null)
const importSelected = ref<string[]>(['user_index', 'tasks', 'focus_favorites', 'focus_records', 'lists', 'countdown', 'courses', 'profile', 'login_info', 'settings', 'system_state'])
const expanded = ref<string[]>(['tasks', 'focus', 'lists', 'countdown', 'courses', 'profile'])
const selectAll = ref(true)

const groups = [
  { key: 'tasks', label: '足迹', children: [{ key: 'tasks', label: '足迹记录' }] },
  { key: 'focus', label: '专注', children: [{ key: 'focus_favorites', label: '常用专注' }, { key: 'focus_records', label: '专注记录' }] },
  { key: 'lists', label: '清单', children: [{ key: 'lists', label: '清单列表及其任务' }] },
  { key: 'countdown', label: '倒数日', children: [{ key: 'countdown', label: '倒数日分类及其倒数日' }] },
  { key: 'courses', label: '课程表', children: [{ key: 'courses', label: '课程' }] },
  { key: 'profile', label: '我的', children: [
    { key: 'user_index', label: '账户信息' }, { key: 'profile', label: '我的' },
    { key: 'login_info', label: '登录信息' }, { key: 'settings', label: '设置' }, { key: 'system_state', label: '系统状态' }
  ]}
]

const importKeyMapping: Record<string, string[]> = {
  lists: ['lists', 'missions'],
  countdown: ['countdown_categories', 'countdowns'],
  courses: ['courses', 'course_recorded_courses']
}

const allKeys = computed(() => {
  const keys: string[] = []
  groups.forEach(g => g.children.forEach(c => keys.push(c.key)))
  return keys
})

const available = computed(() => {
  const avail: Record<string, boolean> = {}
  Object.keys(importKeyMapping).forEach(key => {
    const keys = importKeyMapping[key]
    avail[key] = keys.some(k => dataRaw.value?.[k] !== undefined && dataRaw.value?.[k] !== null)
  })
  groups.forEach(g => {
    g.children.forEach(c => {
      if (!importKeyMapping[c.key]) {
        avail[c.key] = dataRaw.value?.[c.key] !== undefined && dataRaw.value?.[c.key] !== null
      }
    })
  })
  return avail
})

function toggleGroup(key: string) {
  const idx = expanded.value.indexOf(key)
  if (idx >= 0) expanded.value.splice(idx, 1)
  else expanded.value.push(key)
}

function onSelectAll(checked: boolean) {
  importSelected.value = checked ? allKeys.value.filter(k => available.value[k]) : []
}

async function selectFile() {
  const filePath = await window.electronAPI.openFileDialog({ filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (!filePath) return
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || ''
  if (fileName.includes('@')) { ElMessage.error('只能导入不包含邮箱标识的通用数据文件'); return }
  try {
    const content = await window.electronAPI.readFile(filePath)
    if (!content) { ElMessage.error('读取文件失败'); return }
    const data = JSON.parse(content)
    dataRaw.value = data
    fileInfo.value = { name: fileName, exportTime: data.exportTime ? formatTime(data.exportTime) : '未知' }
    importSelected.value = allKeys.value.filter(k => available.value[k])
    selectAll.value = importSelected.value.length > 0
  } catch { ElMessage.error('文件格式错误') }
}

async function handleImport() {
  if (!dataRaw.value) { ElMessage.warning('请先选择导入文件'); return }
  if (importSelected.value.length === 0) { ElMessage.warning('请至少选择一个模块'); return }
  try {
    await ElMessageBox.confirm('导入将覆盖当前用户的对应数据，此操作不可恢复！\n确定要导入吗？', '导入确认', {
      type: 'warning', confirmButtonText: '确定导入', cancelButtonText: '取消'
    })
    loading.value = true
    const importObj: any = {}
    importSelected.value.forEach(key => {
      const keys = importKeyMapping[key] || [key]
      keys.forEach(k => { if (dataRaw.value[k] !== undefined) importObj[k] = dataRaw.value[k] })
    })
    await api.importData(importObj)
    logger.info('[导入数据] 导入成功', { modules: importSelected.value })
    ElMessage.success('导入成功')
    setTimeout(async () => { await window.electronAPI.restartApp() }, 500)
  } catch (err: any) {
    if (err !== 'cancel') {
      logger.error('[导入数据] 导入失败', { error: err instanceof Error ? err.message : String(err) })
      ElMessage.error(err?.response?.data?.error || '导入数据失败')
    }
  } finally { loading.value = false }
}

function formatTime(time: string) {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<style scoped>
.tool-container { padding: 8px 0; }
.import-warning { display: flex; gap: 8px; padding: 10px 12px; background: rgba(230,162,60,0.08); border: 1px solid rgba(230,162,60,0.2); border-radius: 6px; margin-bottom: 12px; }
.warn-icon { color: #e6a23c; font-size: 16px; flex-shrink: 0; }
.warn-title { color: #e6a23c; font-size: 13px; font-weight: 500; margin: 0; }
.warn-text { color: rgba(255,255,255,0.7); font-size: 12px; margin: 4px 0 0; line-height: 1.4; }
.file-area { margin-bottom: 12px; }
.file-info p { margin: 2px 0; font-size: 13px; color: rgba(255,255,255,0.7); }
.file-placeholder { text-align: center; color: rgba(255,255,255,0.35); font-size: 13px; padding: 12px 0; }
.module-tree { max-height: 240px; overflow-y: auto; }
.select-all-row { padding: 4px 0 8px 4px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 8px; }
.select-all-row :deep(.el-checkbox__label) { color: rgba(255,255,255,0.9); font-weight: 500; }
.module-group { margin-bottom: 6px; }
.group-header { display: flex; align-items: center; padding: 6px 10px; background: rgba(255,255,255,0.05); border-radius: 6px; cursor: pointer; user-select: none; }
.group-header:hover { background: rgba(255,255,255,0.08); }
.expand-icon { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; color: rgba(255,255,255,0.85); margin-right: 6px; }
.group-label { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.9); }
.group-children { padding: 6px 0 6px 24px; }
.child-item { padding: 3px 0; }
.child-item :deep(.el-checkbox__label) { color: rgba(255,255,255,0.85); font-size: 13px; }
.tool-footer { display: flex; justify-content: center; gap: 8px; padding-top: 12px; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
</style>