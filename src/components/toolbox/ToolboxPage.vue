<template>
  <div class="toolbox-page" ref="contentRef" :style="{ '--card-cols': cardCols }">
    <div v-if="activeTool" class="tool-page-overlay">
      <div class="tool-page-container">
        <div class="tool-page-header">
          <button class="back-btn" @click="handleToolBack">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回</span>
          </button>
          <span class="tool-page-title">{{ activeTool.title || activeTool.name }}</span>
        </div>
        <div class="tool-page-body">
          <component :is="activeTool.component" />
        </div>
      </div>
    </div>
    <div v-else class="toolbox-content">
      <el-scrollbar>
        <div class="section" v-if="tagGroups.length > 0">
          <div class="section-title-row">
            <button class="collapse-btn" @click="toggleToolsCollapse">
              <el-icon><component :is="toolsCollapsed ? ArrowDown : ArrowUp" /></el-icon>
            </button>
            <h3 class="section-title">小工具</h3>
          </div>
          <div v-show="!toolsCollapsed">
            <div class="tool-group" v-for="group in tagGroups" :key="group.pluginId">
              <div class="tool-group-header">{{ group.pluginName }}</div>
              <div class="tool-card-grid">
                <div
                  v-for="tool in group.tools"
                  :key="tool.id"
                  class="tool-card"
                  @click="openTool(tool)"
                >
                  <div class="tool-card-icon">{{ tool.icon }}</div>
                  <div class="tool-card-name">{{ tool.name }}</div>
                  <div class="tool-card-desc">{{ tool.description }}</div>
                </div>
              </div>
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
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title-row">
            <button class="collapse-btn" @click="toggleMarketCollapse">
              <el-icon><component :is="marketCollapsed ? ArrowDown : ArrowUp" /></el-icon>
            </button>
            <h3 class="section-title">插件市场</h3>
            <button class="market-refresh-btn" @click="handleRefreshClick" :disabled="marketLoading">
              <el-icon v-if="marketLoading" :class="{ spinning: marketLoading }"><Refresh /></el-icon>
              <span>{{ marketLoading ? '刷新中' : '刷新' }}</span>
            </button>
          </div>
          <div v-show="!marketCollapsed">
            <MarketplacePanel ref="marketplaceRef" :loading="marketLoading" />
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 刷新进度弹窗 -->
    <BaseDialog
      :visible="refreshDialogVisible"
      title="刷新插件市场"
      :width="420"
      noOverlayClose
      :inline="splitScreen.isSplitActive.value"
      @update:visible="refreshDialogVisible = $event"
    >
      <div class="refresh-dialog-body">
        <template v-if="refreshState === 'progress'">
          <el-icon class="spinning refresh-progress-icon"><Refresh /></el-icon>
          <p class="mp-popup-tip">正在刷新插件市场...</p>
        </template>
        <template v-else-if="refreshState === 'no-update'">
          <p class="mp-popup-tip">刷新成功，无插件需要更新</p>
        </template>
        <template v-else>
          <p class="mp-popup-tip">刷新失败，请重试</p>
        </template>
      </div>
      <template #footer>
        <template v-if="refreshState === 'failed'">
          <el-button @click="handleRefreshClick">重试</el-button>
          <el-button type="primary" @click="refreshDialogVisible = false">关闭</el-button>
        </template>
      </template>
    </BaseDialog>

    <!-- 插件更新可用提醒弹窗 -->
    <BaseDialog
      :visible="updateDialogVisible"
      title="插件更新可用"
      :width="420"
      @update:visible="updateDialogVisible = $event"
    >
      <p class="mp-popup-tip">以下插件有可用更新：</p>
      <div v-if="!updateDone" class="update-plugin-list">
        <div v-for="u in updatablePlugins" :key="u.id" class="update-plugin-item">
          <div class="up-info">
            <div class="up-name">{{ u.name }}</div>
            <div class="up-ver">v{{ u.currentVersion }} → v{{ u.version }}</div>
          </div>
          <button class="up-btn" @click="updateOne(u)" :disabled="updating">更新</button>
        </div>
      </div>
      <p v-if="updating" class="mp-popup-tip update-progress">{{ updateProgressText }}</p>
      <p v-if="updateDone" class="mp-popup-tip update-done-tip">更新完成</p>
      <template #footer>
        <template v-if="updateDone">
          <el-button type="primary" @click="updateDialogVisible = false">关闭</el-button>
        </template>
        <template v-else>
          <el-button @click="updateDialogVisible = false" :disabled="updating">稍后</el-button>
          <el-button type="primary" @click="updateAllInDialog" :disabled="updating">全部更新</el-button>
        </template>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, computed, defineAsyncComponent, provide } from 'vue'
import { ArrowLeft, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { logger } from '../../lib/logger'
import { getAllTools, getPlugins, loadRuntimePlugins, type ToolInfo } from '../../lib/pluginLoader'
import { useSettingsStore } from '../../stores/settingsStore'
import { useSplitScreen } from '../../composables/useSplitScreen'
import MarketplacePanel from './MarketplacePanel.vue'
import BaseDialog from '../ui/BaseDialog.vue'
import { Refresh } from '@element-plus/icons-vue'
import { type MarketplacePlugin } from '../../lib/marketplace'

const settingsStore = useSettingsStore()
const splitScreen = useSplitScreen()
const tools = ref<ToolInfo[]>([])
const plugins = ref<ReturnType<typeof getPlugins>>([])
const activeTool = shallowRef<{ name: string; component: any; title?: string; onBack?: () => void } | null>(null)
// 子工具可通过 setToolHeader 动态更新顶部标题与返回回调（如抽卡分析的子页面返回其首页）
provide('toolHeader', (title?: string, onBack?: () => void) => {
  if (!activeTool.value) return
  activeTool.value = { ...activeTool.value, title, onBack }
})
const toolsCollapsed = ref(false)
const pluginsCollapsed = ref(false)
const marketCollapsed = ref(false)
const marketplaceRef = ref<InstanceType<typeof MarketplacePanel> | null>(null)
const marketLoading = ref(false)
const updatablePlugins = ref<MarketplacePlugin[]>([])
const updateDialogVisible = ref(false)
const refreshDialogVisible = ref(false)
const refreshState = ref<'progress' | 'no-update' | 'failed'>('progress')
const updating = ref(false)
const updateDone = ref(false)
const updateProgressText = ref('')

// 卡片网格响应式列数：实测内容区宽度 → 1/2/3 列（卡片间距 d = 25px）
const contentRef = ref<HTMLElement | null>(null)
const contentWidth = ref(0)
const CARD_GAP = 25
const computeCardCols = (w: number): number => {
  if (w < 1000 + CARD_GAP) return 1
  if (w < 1500 + 2 * CARD_GAP) return 2
  if (w < 2000 + 3 * CARD_GAP) return 3
  return 3
}
const cardCols = computed(() => computeCardCols(contentWidth.value))
let contentResizeObserver: ResizeObserver | null = null

const tagGroups = computed(() => {
  const buckets = new Map<string, ToolInfo[]>()
  for (const t of tools.value) {
    const arr = buckets.get(t.pluginId)
    if (arr) arr.push(t)
    else buckets.set(t.pluginId, [t])
  }
  return Array.from(buckets.entries()).map(([pluginId, groupTools]) => ({
    pluginId,
    pluginName: getPluginName(pluginId),
    tools: groupTools,
  }))
})

async function handleRefreshClick() {
  if (!marketplaceRef.value || marketLoading.value) return
  refreshState.value = 'progress'
  refreshDialogVisible.value = true
  marketLoading.value = true
  try {
    const list = await marketplaceRef.value.refresh()
    const ups = list.filter(p => p.hasUpdate)
    if (ups.length) {
      updatablePlugins.value = ups
      updating.value = false
      updateDone.value = false
      updateProgressText.value = ''
      refreshDialogVisible.value = false
      updateDialogVisible.value = true
    } else {
      refreshState.value = 'no-update'
      setTimeout(() => { refreshDialogVisible.value = false }, 1500)
    }
  } catch (e) {
    refreshState.value = 'failed'
    logger.warn('[工具箱] 插件市场刷新失败', { error: e instanceof Error ? e.message : String(e) })
  } finally {
    marketLoading.value = false
  }
}

async function updateOne(p: MarketplacePlugin) {
  if (!marketplaceRef.value || updating.value) return
  updating.value = true
  updateProgressText.value = `正在更新：${p.name}`
  try {
    await marketplaceRef.value.updatePlugin(p)
  } catch (e) {
    logger.warn('[工具箱] 插件更新失败', { id: p.id, error: e instanceof Error ? e.message : String(e) })
  } finally {
    updating.value = false
    updateDone.value = true
  }
}

async function updateAllInDialog() {
  if (!marketplaceRef.value || updating.value) return
  updating.value = true
  try {
    for (const p of updatablePlugins.value) {
      if (!p.hasUpdate) continue
      updateProgressText.value = `正在更新：${p.name}`
      await marketplaceRef.value.updatePlugin(p)
    }
  } catch (e) {
    logger.warn('[工具箱] 插件批量更新失败', { error: e instanceof Error ? e.message : String(e) })
  } finally {
    updating.value = false
    updateDone.value = true
  }
}

onMounted(async () => {
  logger.info('[工具箱] 页面挂载')
  await loadRuntimePlugins()
  tools.value = getAllTools()
  plugins.value = getPlugins()
  logger.info('[工具箱] 已加载工具', { toolCount: tools.value.length, pluginCount: plugins.value.length })

  if (settingsStore.settings.toolbox) {
    toolsCollapsed.value = !!settingsStore.settings.toolbox.toolsCollapsed
    pluginsCollapsed.value = !!settingsStore.settings.toolbox.pluginsCollapsed
    marketCollapsed.value = !!settingsStore.settings.toolbox.marketCollapsed
  }

  handleRefreshClick()

  if (contentRef.value) {
    contentResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) contentWidth.value = entry.contentRect.width
    })
    contentResizeObserver.observe(contentRef.value)
    contentWidth.value = contentRef.value.clientWidth
  }
})

onUnmounted(() => { contentResizeObserver?.disconnect() })

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

async function openTool(tool: ToolInfo) {
  logger.info('[工具箱] 打开工具', { toolId: tool.id, toolName: tool.name })
  const comp = defineAsyncComponent(tool.component)
  activeTool.value = { name: tool.name, component: comp, title: tool.name, onBack: undefined }
}

function closeTool() {
  activeTool.value = null
}

function handleToolBack() {
  if (activeTool.value?.onBack) activeTool.value.onBack()
  else closeTool()
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(102, 126, 234, 0.4);
  background: rgba(102, 126, 234, 0.15);
  color: var(--chalk-blue);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.market-refresh-btn:hover { background: rgba(102, 126, 234, 0.3); }
.market-refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.mp-popup-tip {
  font-size: 13px;
  color: var(--chalk-white-70);
  margin: 0 0 12px;
  line-height: 1.6;
}

.refresh-dialog-body {
  text-align: center;
  padding: 8px 0;
}

.refresh-progress-icon {
  font-size: 28px;
  color: var(--chalk-blue);
  margin-bottom: 8px;
}

.update-progress {
  color: var(--chalk-blue);
  margin-bottom: 0;
}

.update-done-tip {
  color: #34d399;
  font-weight: 600;
  margin-bottom: 0;
}

.update-plugin-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.update-plugin-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.up-info {
  min-width: 0;
}

.up-name {
  color: var(--chalk-white);
  font-size: 14px;
  font-weight: 600;
}

.up-ver {
  color: var(--chalk-muted);
  font-size: 12px;
  margin-top: 2px;
}

.up-btn {
  padding: 4px 16px;
  border: 1px solid rgba(52, 211, 153, 0.4);
  border-radius: 6px;
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}

.up-btn:hover { background: rgba(52, 211, 153, 0.3); }
.up-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.tool-card-grid {
  display: grid;
  grid-template-columns: repeat(var(--card-cols, 1), minmax(0, 1fr));
  gap: 25px;
  padding: 0 25px;
  margin: 0 -16px;
  align-items: stretch;
}

.tool-card-grid > .tool-card { min-width: 0; }

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

.tool-group {
  margin-bottom: 28px;
}

.tool-group:last-child {
  margin-bottom: 0;
}

.tool-group-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px 9px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  color: var(--chalk-white-70);
  font-size: 13px;
  font-weight: 600;
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
  grid-template-columns: repeat(var(--card-cols, 1), minmax(0, 1fr));
  gap: 25px;
  padding: 0 25px;
  margin: 0 -16px;
  align-items: stretch;
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
  position: relative;
  justify-content: center;
}

.back-btn {
  position: absolute;
  left: 0;
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
  flex: 1;
  text-align: center;
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