<template>
  <div class="marketplace-panel">
    <div v-if="loading && plugins.length === 0" class="marketplace-loading">
      <el-icon class="spinning"><Refresh /></el-icon>
      <span>正在查询插件市场...</span>
    </div>

    <div v-else-if="plugins.length === 0" class="marketplace-empty">
      <span>暂无可用插件</span>
    </div>

    <div v-else class="marketplace-grid">
      <div
        v-for="p in plugins"
        :key="p.id"
        class="marketplace-card"
        :class="{ installed: p.installed }"
      >
        <div class="mp-card-header">
          <span class="mp-card-name">{{ p.name }}</span>
          <span v-if="p.installed" class="mp-card-badge">已安装</span>
        </div>
        <p class="mp-card-desc">{{ p.description }}</p>
        <div v-if="p.tags && p.tags.length" class="mp-card-tags">
          <span v-for="tag in p.tags" :key="tag" class="mp-card-tag">{{ tag }}</span>
        </div>
        <div class="mp-card-actions">
          <a class="mp-card-link" @click.prevent="openRepo(p.repoUrl)">查看仓库</a>
          <button
            v-if="!p.installed"
            class="mp-install-btn"
            :disabled="p.installing || !isElectron"
            @click="handleInstall(p)"
          >
            {{ p.installing ? '安装中...' : '安装' }}
          </button>
          <button
            v-else
            class="mp-uninstall-btn"
            :disabled="p.installing || !isElectron"
            @click="handleUninstall(p)"
          >
            {{ p.installing ? '卸载中...' : '卸载' }}
          </button>
        </div>
        <p v-if="!isElectron" class="mp-card-hint">安装/卸载需在桌面端进行</p>
      </div>
    </div>

    <p v-if="restartNeeded" class="restart-hint">
      插件已变更，请重启应用使更改生效。
      <button v-if="isElectron" class="restart-btn" @click="doRestart">立即重启</button>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { fetchMarketplacePlugins, installPlugin, deletePlugin, type MarketplacePlugin } from '../../lib/marketplace'
import { logger } from '../../lib/logger'

const isElectron = inject<boolean>('isElectron', false)
const plugins = ref<MarketplacePlugin[]>([])
const loading = ref(false)
const restartNeeded = ref(false)

defineExpose({ refresh })

async function refresh() {
  loading.value = true
  try {
    plugins.value = await fetchMarketplacePlugins()
  } catch (e) {
    logger.warn('[市场面板] 加载失败', { error: e instanceof Error ? e.message : String(e) })
  } finally {
    loading.value = false
  }
}

async function handleInstall(p: MarketplacePlugin) {
  if (!window.electronAPI) {
    ElMessage.info('插件安装需要在桌面端进行操作')
    return
  }
  p.installing = true
  try {
    const pluginsDir = await window.electronAPI.getPluginsDirPath()
    const ok = await installPlugin(
      p,
      pluginsDir,
      (dirPath) => window.electronAPI!.createDirectory(dirPath),
      (filePath, content) => window.electronAPI!.writeFile(filePath, content),
    )
    if (ok) {
      p.installed = true
      restartNeeded.value = true
      ElMessage.success(`${p.name} 安装成功，重启后生效`)
    } else {
      ElMessage.error('安装失败')
    }
  } catch (e) {
    logger.error(`[市场面板] 安装失败 ${p.id}`, { error: e instanceof Error ? e.message : String(e) })
    ElMessage.error('安装失败')
  } finally {
    p.installing = false
  }
}

async function handleUninstall(p: MarketplacePlugin) {
  if (!window.electronAPI) {
    ElMessage.info('插件卸载需要在桌面端进行操作')
    return
  }
  p.installing = true
  try {
    const pluginsDir = await window.electronAPI.getPluginsDirPath()
    const ok = await deletePlugin(
      p.id,
      pluginsDir,
      (dirPath) => window.electronAPI!.removeDirectory(dirPath),
    )
    if (ok) {
      p.installed = false
      restartNeeded.value = true
      ElMessage.success(`${p.name} 已卸载，重启后生效`)
    } else {
      ElMessage.error('卸载失败')
    }
  } catch (e) {
    logger.error(`[市场面板] 卸载失败 ${p.id}`, { error: e instanceof Error ? e.message : String(e) })
    ElMessage.error('卸载失败')
  } finally {
    p.installing = false
  }
}

function openRepo(url: string) {
  window.electronAPI?.openExternal(url) || window.open(url, '_blank')
}

function doRestart() {
  window.electronAPI?.restartApp()
}

onMounted(() => {
  refresh()
})
</script>

<style scoped>
.marketplace-panel {
  padding: 0;
}

.marketplace-loading,
.marketplace-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--chalk-white-70);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.marketplace-grid {
  display: grid;
  grid-template-columns: repeat(var(--card-cols, 1), minmax(0, 1fr));
  gap: 25px;
  padding: 0 25px;
  margin: 0 -16px;
  align-items: stretch;
}

.marketplace-grid > .marketplace-card { min-width: 0; }

.marketplace-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.marketplace-card.installed {
  border-color: rgba(52, 211, 153, 0.25);
}

.mp-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.mp-card-name {
  color: var(--chalk-white-95);
  font-size: 14px;
  font-weight: 600;
}

.mp-card-badge {
  font-size: 11px;
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.mp-card-desc {
  color: var(--chalk-white-85);
  font-size: 12px;
  margin: 0 0 8px;
  line-height: 1.5;
  flex: 1;
}

.mp-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.mp-card-tag {
  color: var(--chalk-violet);
  font-size: 11px;
  background: rgba(167, 139, 250, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.mp-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mp-card-link {
  font-size: 12px;
  color: var(--chalk-blue);
  cursor: pointer;
  text-decoration: none;
}

.mp-card-link:hover { text-decoration: underline; }

.mp-install-btn {
  padding: 4px 16px;
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 6px;
  background: rgba(102, 126, 234, 0.15);
  color: var(--chalk-blue);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.mp-install-btn:hover { background: rgba(102, 126, 234, 0.3); }
.mp-install-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.mp-uninstall-btn {
  padding: 4px 16px;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.1);
  color: var(--chalk-danger);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.mp-uninstall-btn:hover { background: rgba(239, 68, 68, 0.2); }
.mp-uninstall-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.mp-card-hint {
  font-size: 11px;
  color: var(--chalk-white-60);
  margin: 8px 0 0;
}

.restart-hint {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  color: var(--chalk-blue);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.restart-btn {
  padding: 4px 12px;
  border: 1px solid #667eea;
  border-radius: 6px;
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-blue);
  font-size: 12px;
  cursor: pointer;
}

.restart-btn:hover { background: rgba(102, 126, 234, 0.35); }

.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>