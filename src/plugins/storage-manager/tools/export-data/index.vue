<template>
  <div class="tool-container">
    <p class="tool-desc">选择要导出的数据模块，保存为 JSON 文件</p>

    <div class="module-tree">
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
            <el-checkbox v-model="selected" :label="child.key">{{ child.label }}</el-checkbox>
          </div>
        </div>
      </div>
    </div>

    <div class="tool-footer">
      <el-button type="primary" @click="handleExport" :loading="loading" :disabled="selected.length === 0">导出</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../../../../stores/authStore'
import { logger } from '../../../../lib/logger'
import * as api from '../../../../lib/api'

const authStore = useAuthStore()
const loading = ref(false)
const selected = ref<string[]>(['user_index', 'tasks', 'focus_favorites', 'focus_records', 'lists', 'countdown', 'courses', 'profile', 'login_info', 'settings', 'system_state'])
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

const allKeys = computed(() => {
  const keys: string[] = []
  groups.forEach(g => g.children.forEach(c => keys.push(c.key)))
  return keys
})

const exportKeyMapping: Record<string, string[]> = {
  lists: ['lists', 'missions'],
  countdown: ['countdown_categories', 'countdowns'],
  courses: ['courses', 'course_recorded_courses']
}

function toggleGroup(key: string) {
  const idx = expanded.value.indexOf(key)
  if (idx >= 0) expanded.value.splice(idx, 1)
  else expanded.value.push(key)
}

function onSelectAll(checked: boolean) {
  selected.value = checked ? allKeys.value : []
}

async function handleExport() {
  if (selected.value.length === 0) { ElMessage.warning('请至少选择一个模块'); return }
  loading.value = true
  try {
    const { data } = await api.exportData()
    const exportObj: any = { exportTime: new Date().toISOString() }
    selected.value.forEach(key => {
      const keys = exportKeyMapping[key] || [key]
      keys.forEach(k => { if (data[k] !== undefined) exportObj[k] = data[k] })
    })
    const includeEmail = selected.value.includes('user_index')
    const emailSuffix = includeEmail && authStore.user?.email ? `-${authStore.user.email}` : ''
    const filePath = await window.electronAPI.saveFileDialog({
      defaultPath: `earth-survival-diary-export${emailSuffix}-${new Date().toISOString().slice(0, 10)}.json`
    })
    if (!filePath) { ElMessage.info('已取消保存'); return }
    const success = await window.electronAPI.writeFile(filePath, JSON.stringify(exportObj, null, 2))
    if (!success) { ElMessage.error('写入文件失败'); return }
    logger.info('[导出数据] 导出成功', { modules: selected.value, filePath })
    ElMessage.success('导出成功')
  } catch (err: any) {
    logger.error('[导出数据] 导出失败', { error: err instanceof Error ? err.message : String(err) })
    ElMessage.error(err?.response?.data?.error || '导出数据失败')
  } finally { loading.value = false }
}
</script>

<style scoped>
.tool-container { padding: 8px 0; }
.tool-desc { color: var(--chalk-white-60); font-size: 13px; margin: 0 0 12px 0; }
.module-tree { max-height: 320px; overflow-y: auto; }
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
.child-item :deep(.el-checkbox.is-checked .el-checkbox__label) { color: #8ab4f8; }
.tool-footer { display: flex; justify-content: center; padding-top: 12px; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
</style>