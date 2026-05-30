<template>
  <div class="toolbox-page">
    <div class="toolbox-content">
      <el-scrollbar>
        <div class="section" v-if="tools.length > 0">
          <div class="tool-card-grid">
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
          <h3 class="section-title">已安装插件</h3>
          <div class="plugin-list">
            <div v-for="plugin in plugins" :key="plugin.manifest.id" class="plugin-card">
              <div class="plugin-info">
                <span class="plugin-name">{{ plugin.manifest.name }}</span>
                <span class="plugin-version">v{{ plugin.manifest.version }}</span>
              </div>
              <div class="plugin-meta">
                <span class="plugin-author">{{ plugin.manifest.author }}</span>
                <span class="plugin-desc">{{ plugin.manifest.description }}</span>
              </div>
              <div class="plugin-capabilities">
                <span v-if="Object.keys(plugin.pages || {}).length > 0" class="cap-tag">页面改造 {{ Object.keys(plugin.pages || {}).length }}个</span>
                <span v-if="Object.keys(plugin.stores || {}).length > 0" class="cap-tag">存储规则 {{ Object.keys(plugin.stores || {}).length }}个</span>
                <span v-if="plugin.tools.length > 0" class="cap-tag">小工具 {{ plugin.tools.length }}个</span>
              </div>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <Teleport to="body">
      <div v-if="activeTool" class="tool-dialog-overlay" @click.self="closeTool">
        <div class="tool-dialog">
          <div class="tool-dialog-header">
            <span class="tool-dialog-title">{{ activeTool.name }}</span>
          </div>
          <div class="tool-dialog-body">
            <component :is="activeTool.component" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, defineAsyncComponent } from 'vue'
import { logger } from '../../lib/logger'
import { getAllTools, getPlugins, type ToolInfo } from '../../lib/pluginLoader'

const tools = ref<ToolInfo[]>([])
const plugins = ref<ReturnType<typeof getPlugins>>([])
const activeTool = shallowRef<{ name: string; component: any } | null>(null)

onMounted(() => {
  logger.info('[工具箱] 页面挂载')
  tools.value = getAllTools()
  plugins.value = getPlugins()
  logger.info('[工具箱] 已加载工具', { toolCount: tools.value.length, pluginCount: plugins.value.length })
})

function getPluginName(pluginId: string): string {
  const plugin = plugins.value.find(p => p.manifest.id === pluginId)
  return plugin ? plugin.manifest.name : pluginId
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
  width: 80%;
  margin: 0 auto 32px;
}

.section-title {
  color: var(--chalk-white);
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.tool-card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 768px) {
  .tool-card-grid {
    grid-template-columns: 1fr;
  }
}

.tool-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px 16px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
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
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plugin-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 14px 16px;
}

.plugin-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.plugin-name {
  color: var(--chalk-white);
  font-size: 14px;
  font-weight: 600;
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

.plugin-desc {
  color: var(--chalk-white-60);
  font-size: 12px;
}

.plugin-capabilities {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.cap-tag {
  background: rgba(102, 126, 234, 0.15);
  color: var(--chalk-primary);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.tool-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-dialog {
  background: #1a1744;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
}

.tool-dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tool-dialog-title {
  color: var(--chalk-white);
  font-size: 16px;
  font-weight: 600;
}

.tool-dialog-body {
  padding: 0;
}
</style>