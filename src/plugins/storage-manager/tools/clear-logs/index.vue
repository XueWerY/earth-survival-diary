<template>
  <div class="tool-container">
    <p class="tool-desc">清理日志文件释放磁盘空间</p>

    <div class="info-card">
      <div class="info-label">当前日志大小</div>
      <div class="info-value">{{ logSizeDesc }}</div>
    </div>

    <div class="setting-row">
      <span class="setting-label">自动清理日志</span>
      <el-switch v-model="autoCleanEnabled" inline-prompt size="small" @change="handleAutoCleanChange" />
    </div>

    <div v-if="autoCleanEnabled" class="auto-clean-setting">
      <span>自动清理过去</span>
      <el-input-number v-model="autoCleanDays" :min="1" :max="365" :step="1" size="small" controls-position="right" @change="handleDaysChange" />
      <span>天的日志</span>
    </div>

    <div class="tool-footer">
      <el-button type="danger" @click="handleClearLogs" :loading="clearing">清空日志</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { logger } from '../../../../lib/logger'
import * as api from '../../../../lib/api'

const settingsStore = useSettingsStore()
const logSizeDesc = ref('加载...')
const clearing = ref(false)
const autoCleanEnabled = ref((settingsStore.settings as any)?.autoClean?.enabled ?? false)
const autoCleanDays = ref((settingsStore.settings as any)?.autoClean?.days ?? 30)

onMounted(async () => {
  try {
    if (window.electronAPI) {
      const logSize = await window.electronAPI.getLogDirSize()
      logSizeDesc.value = logSize.size > 0 ? formatSize(logSize.size) : '暂无日志文件'
    } else {
      logSizeDesc.value = '仅 Electron 可用'
    }
  } catch { logSizeDesc.value = '获取失败' }
})

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function handleClearLogs() {
  try {
    await ElMessageBox.confirm('确定要清空当前日志文件吗？', '清空确认', { type: 'warning' })
    clearing.value = true
    logger.info('[清空日志] 开始清空')
    await window.electronAPI.clearLogs()
    const logSize = await window.electronAPI.getLogDirSize()
    logSizeDesc.value = logSize.size > 0 ? formatSize(logSize.size) : '暂无日志文件'
    ElMessage.success('日志已清空')
  } catch (err: any) {
    if (err !== 'cancel') logger.error('[清空日志] 失败', { error: err instanceof Error ? err.message : String(err) })
  } finally { clearing.value = false }
}

async function handleAutoCleanChange(val: boolean) {
  try {
    await api.updateSettings({ autoClean: { enabled: val, days: autoCleanDays.value } } as any)
    logger.info('[清空日志] 自动清理设置', { enabled: val, days: autoCleanDays.value })
  } catch (e) { console.error('保存自动清理设置失败:', e) }
}

async function handleDaysChange(val: number) {
  try {
    await api.updateSettings({ autoClean: { enabled: autoCleanEnabled.value, days: val } } as any)
    logger.info('[清空日志] 自动清理天数', { days: val })
  } catch (e) { console.error('保存自动清理天数失败:', e) }
}
</script>

<style scoped>
.tool-container { padding: 8px 0; }
.tool-desc { color: var(--chalk-white-60); font-size: 13px; margin: 0 0 12px 0; }
.info-card { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
.info-label { color: rgba(255,255,255,0.6); font-size: 13px; }
.info-value { color: var(--chalk-primary); font-size: 15px; font-weight: 600; }
.setting-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; margin-bottom: 8px; }
.setting-label { color: rgba(255,255,255,0.75); font-size: 13px; }
.auto-clean-setting { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 12px; font-size: 13px; color: rgba(255,255,255,0.6); }
.tool-footer { display: flex; justify-content: center; padding-top: 12px; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
</style>