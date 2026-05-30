<template>
  <div class="tool-container">
    <p class="tool-desc">按账号选择数据模块清理，释放存储空间</p>

    <div class="info-card">
      <div class="info-label">当前数据占用</div>
      <div class="info-value">{{ dataSizeDesc }}</div>
    </div>

    <div class="tool-footer">
      <el-button type="danger" @click="handleCleanData" :loading="cleaning" :disabled="!hasElectron">
        {{ hasElectron ? '开始清理' : '仅 Electron 可用' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { logger } from '../../../../lib/logger'
import * as api from '../../../../lib/api'

const dataSizeDesc = ref('加载...')
const cleaning = ref(false)
const hasElectron = ref(false)

const cleanKeyMapping: Record<string, string[]> = {
  lists: ['lists', 'missions'],
  countdown: ['countdown_categories', 'countdowns'],
  courses: ['courses', 'course_recorded_courses']
}

onMounted(async () => {
  hasElectron.value = !!window.electronAPI
  try {
    if (window.electronAPI) {
      const dataSize = await window.electronAPI.getDataDirSize()
      dataSizeDesc.value = formatSize(dataSize.size)
    } else {
      dataSizeDesc.value = '仅 Electron 可用'
    }
  } catch { dataSizeDesc.value = '获取失败' }
})

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function handleCleanData() {
  if (!window.electronAPI) { ElMessage.warning('仅 Electron 环境可用'); return }
  cleaning.value = true
  try {
    logger.info('[清理数据] 打开清理窗口')
    const moduleSizes = await window.electronAPI.getModuleSizes()
    if (!moduleSizes.users || moduleSizes.users.length === 0) {
      ElMessage.info('暂无用户数据')
      cleaning.value = false
      return
    }
    const result = await window.electronAPI.openCleanDataWindow({
      users: moduleSizes.users,
      totalDataSize: moduleSizes.totalDataSize,
      moduleGroups: moduleSizes.moduleGroups
    })
    if (!result) { logger.info('[清理数据] 已取消'); return }
    if (result.deleteAll) {
      logger.info('[清理数据] 清空全部应用数据')
      await api.clearAllData()
      ElMessage.success('全部数据已清空')
    } else if (result.modules.length > 0) {
      logger.info('[清理数据] 清理指定模块', { modules: result.modules })
      const cleanObj: any = {}
      result.modules.forEach((key: string) => {
        const keys = cleanKeyMapping[key] || [key]
        keys.forEach((k: string) => { cleanObj[k] = null })
      })
      await api.cleanData(cleanObj)
      ElMessage.success('清理成功')
    } else {
      ElMessage.warning('请至少选择一个模块')
      return
    }
    setTimeout(async () => { await window.electronAPI.restartApp() }, 500)
  } catch (err: any) {
    logger.error('[清理数据] 失败', { error: err instanceof Error ? err.message : String(err) })
    ElMessage.error(err?.response?.data?.error || '清理数据失败')
  } finally { cleaning.value = false }
}
</script>

<style scoped>
.tool-container { padding: 8px 0; }
.tool-desc { color: var(--chalk-white-60); font-size: 13px; margin: 0 0 12px 0; }
.info-card { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
.info-label { color: rgba(255,255,255,0.6); font-size: 13px; }
.info-value { color: var(--chalk-primary); font-size: 15px; font-weight: 600; }
.tool-footer { display: flex; justify-content: center; padding-top: 12px; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
</style>