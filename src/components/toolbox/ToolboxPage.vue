<template>
  <div class="toolbox-page">
    <div v-if="activeTool" class="tool-page-overlay">
      <div class="tool-page-container">
        <div class="tool-page-header">
          <button class="back-btn" @click="closeTool">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回</span>
          </button>
          <span class="tool-page-title">{{ activeTool.name }}</span>
        </div>
        <div class="tool-page-body">
          <component :is="activeTool.component" />
        </div>
      </div>
    </div>
    <div v-else class="toolbox-content">
      <el-scrollbar>
        <div class="section" v-if="tools.length > 0">
          <div class="section-title-row">
            <button class="collapse-btn" @click="toggleToolsCollapse">
              <el-icon><component :is="toolsCollapsed ? ArrowDown : ArrowUp" /></el-icon>
            </button>
            <h3 class="section-title">小工具</h3>
          </div>
          <div v-show="!toolsCollapsed" class="tool-card-grid">
            <div
              v-for="tool in tools"
              :key="tool.id"
              class="tool-card"
              @click="openTool(tool)"
            >
              <div class="tool-card-icon">{{ tool.icon }}</div>
              <div class="tool-card-name">{{ tool.name }}</div>
              <div class="tool-card-desc">{{ tool.description }}</div>
              <div class="tool-card-plugin">{{ getPluginName(tool.pluginId) }}</div>
            </div>
          </div>
        </div>
        <div v-else class="section">
          <div class="empty-state">
            <div class="empty-icon">🧰</div>
            <p class="empty-text">暂无小工具</p>
            <p class="empty-hint">安装社区插件后，小工具将显示在这里</p>
          </div>
        </div>

        <div class="section" v-if="plugins.length > 0">
          <div class="section-title-row">
            <button class="collapse-btn" @click="togglePluginsCollapse">
              <el-icon><component :is="pluginsCollapsed ? ArrowDown : ArrowUp" /></el-icon>
            </button>
            <h3 class="section-title">已安装插件</h3>
          </div>
          <div v-show="!pluginsCollapsed" class="plugin-list">
            <div v-for="plugin in plugins" :key="plugin.manifest.id" class="plugin-card">
              <div class="plugin-info">
                <span class="plugin-name">{{ plugin.manifest.name }}</span>
              </div>
              <div class="plugin-meta">
                <span class="plugin-author">{{ plugin.manifest.author }}</span>
                <span class="plugin-version">v{{ plugin.manifest.version }}</span>
                <span v-if="plugin.tools && plugin.tools.length > 0" class="plugin-tools-count">小工具 {{ plugin.tools.length }}个</span>
              </div>
              <div class="plugin-desc">{{ plugin.manifest.description }}</div>
              <button
                class="plugin-delete-btn"
                :disabled="!isElectron || deletingPlugin === plugin.manifest.id"
                @click="handleDeletePlugin(plugin.manifest.id)"
              >
                {{ deletingPlugin === plugin.manifest.id ? '删除中...' : '删除插件' }}
              </button>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title-row">
            <button class="collapse-btn" @click="toggleMarketCollapse">
              <el-icon><component :is="marketCollapsed ? ArrowDown : ArrowUp" /></el-icon>
            </button>
            <h3 class="section-title">插件市场</h3>
            <button class="market-refresh-btn" @click="refreshMarketplace" :disabled="marketLoading">
              <el-icon :class="{ spinning: marketLoading }"><Refresh /></el-icon>
            </button>
          </div>
          <div v-show="!marketCollapsed">
            <MarketplacePanel ref="marketplaceRef" />
          </div>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, inject, defineAsyncComponent } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { logger } from '../../lib/logger'
import { getAllTools, getPlugins, type ToolInfo } from '../../lib/pluginLoader'
import { useSettingsStore } from '../../stores/settingsStore'
import MarketplacePanel from './MarketplacePanel.vue'
import { Refresh } from '@element-plus/icons-vue'

const settingsStore = useSettingsStore()
const isElectron = inject<boolean>('isElectron', false)
const tools = ref<ToolInfo[]>([])
const plugins = ref<ReturnType<typeof getPlugins>>([])
const activeTool = shallowRef<{ name: string; component: any } | null>(null)
const toolsCollapsed = ref(false)
const pluginsCollapsed = ref(false)
const marketCollapsed = ref(false)
const deletingPlugin = ref<string | null>(null)
const marketplaceRef = ref<InstanceType<typeof MarketplacePanel> | null>(null)
const marketLoading = ref(false)

async function refreshMarketplace() {
  if (marketplaceRef.value) {
    marketLoading.value = true
    try {
      await marketplaceRef.value.refresh()
    } finally {
      marketLoading.value = false
    }
  }
}

onMounted(async () => {
  logger.info('[工具箱] 页面挂载')
  tools.value = getAllTools()
  plugins.value = getPlugins()
  logger.info('[工具箱] 已加载工具', { toolCount: tools.value.length, pluginCount: plugins.value.length })

  if (settingsStore.settings.toolbox) {
    toolsCollapsed.value = !!settingsStore.settings.toolbox.toolsCollapsed
    pluginsCollapsed.value = !!settingsStore.settings.toolbox.pluginsCollapsed
    marketCollapsed.value = !!settingsStore.settings.toolbox.marketCollapsed
  }
})

function getPluginName(pluginId: string): string {
  const plugin = plugins.value.find(p => p.manifest.id === pluginId)
  return plugin ? plugin.manifest.name : pluginId
}

async function toggleToolsCollapse() {
  toolsCollapsed.value = !toolsCollapsed.value
  settingsStore.updateSettings({
    toolbox: { toolsCollapsed: toolsCollapsed.value, pluginsCollapsed: pluginsCollapsed.value, marketCollapsed: marketCollapsed.value }
  })
}

async function togglePluginsCollapse() {
  pluginsCollapsed.value = !pluginsCollapsed.value
  settingsStore.updateSettings({
    toolbox: { toolsCollapsed: toolsCollapsed.value, pluginsCollapsed: pluginsCollapsed.value, marketCollapsed: marketCollapsed.value }
  })
}

async function toggleMarketCollapse() {
  marketCollapsed.value = !marketCollapsed.value
  settingsStore.updateSettings({
    toolbox: { toolsCollapsed: toolsCollapsed.value, pluginsCollapsed: pluginsCollapsed.value, marketCollapsed: marketCollapsed.value }
  })
}

async function handleDeletePlugin(pluginId: string) {
  if (!window.electronAPI) {
    ElMessage.info('插件删除需要在桌面端进行操作')
    return
  }
  deletingPlugin.value = pluginId
  try {
    const pluginsDir = await window.electronAPI.getPluginsDirPath()
    await window.electronAPI.removeDirectory(`${pluginsDir}/${pluginId}`)
    ElMessage.success('插件已删除，重启后生效')
    // 刷新本地插件列表
    plugins.value = getPlugins()
    tools.value = getAllTools()
  } catch (e) {
    logger.error(`[工具箱] 删除插件失败 ${pluginId}`, { error: e instanceof Error ? e.message : String(e) })
    ElMessage.error('删除失败')
  } finally {
    deletingPlugin.value = null
  }
}

async function openTool(tool: ToolInfo) {
  logger.info('[工具箱] 打开工具', { toolId: tool.id, toolName: tool.name })
  const comp = defineAsyncComponent(tool.component)
  activeTool.value = { name: tool.name, component: comp }
}

function closeTool() {
  activeTool.value = null
}
</script>

<style scoped>
.toolbox-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbox-content {
  flex: 1;
  min-height: 0;
}

.toolbox-content :deep(.el-scrollbar) {
  height: 100%;
}

.toolbox-content :deep(.el-scrollbar__view) {
  padding: 24px 0;
}

.section {
  width: 100%;
  padding: 0 16px;
  margin: 0 auto 32px;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
}

.section-title {
  color: var(--chalk-white);
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  transition: color 0.15s;
  flex-shrink: 0;
  padding: 0;
}

.collapse-btn:hover {
  color: var(--chalk-white);
}

.market-refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--chalk-white-70);
  cursor: pointer;
  transition: color 0.15s;
  padding: 0;
}

.market-refresh-btn:hover { color: var(--chalk-white); }
.market-refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.tool-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.tool-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px 16px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  display: flex;
  flex-direction: column;
}

.tool-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.tool-card-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.tool-card-name {
  color: var(--chalk-white);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.tool-card-desc {
  color: var(--chalk-white-60);
  font-size: 12px;
  margin-bottom: 8px;
  line-height: 1.4;
  flex: 1;
}

.tool-card-plugin {
  color: var(--chalk-subtle);
  font-size: 11px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  color: var(--chalk-white-60);
  font-size: 15px;
  margin: 0 0 8px;
}

.empty-hint {
  color: var(--chalk-subtle);
  font-size: 13px;
  margin: 0;
}

.plugin-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.plugin-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 14px 16px;
  min-width: 0;
  overflow: hidden;
}

.plugin-info {
  margin-bottom: 4px;
}

.plugin-name {
  color: var(--chalk-white);
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}

.plugin-version {
  color: var(--chalk-primary);
  font-size: 12px;
}

.plugin-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.plugin-author {
  color: var(--chalk-amber);
  font-size: 12px;
}

.plugin-tools-count {
  color: var(--chalk-cyan);
  font-size: 12px;
}

.plugin-desc {
  color: var(--chalk-white-60);
  font-size: 12px;
  word-break: break-all;
}

.plugin-delete-btn {
  margin-top: 10px;
  padding: 4px 14px;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
}

.plugin-delete-btn:hover { background: rgba(239, 68, 68, 0.2); }
.plugin-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.tool-page-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.tool-page-container {
  width: 100%;
  padding: 0 16px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tool-page-header {
  display: flex;
  align-items: center;
  padding: 16px 0;
  gap: 12px;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.35);
}

.tool-page-title {
  color: var(--chalk-white);
  font-size: 16px;
  font-weight: 600;
}

.tool-page-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 24px;
}

.tool-page-body::-webkit-scrollbar {
  width: 6px;
}

.tool-page-body::-webkit-scrollbar-track {
  background: transparent;
}

.tool-page-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>