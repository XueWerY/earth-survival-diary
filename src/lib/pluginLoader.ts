import type { Component } from 'vue'
import { logger } from './logger'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
}

export interface ToolInfo {
  id: string
  pluginId: string
  name: string
  description: string
  icon: string
  component: () => Promise<Component>
}

export interface PluginExport {
  manifest: PluginManifest
  pages?: Record<string, () => Promise<Component>>
  stores?: Record<string, () => Promise<any>>
  tools?: ToolInfo[]
}

const plugins: PluginExport[] = []

// 项目内插件随 Vite 构建；用户安装的插件由本机 Node 服务编译后交给浏览器运行。
const pluginModules = import.meta.glob<{ default: PluginExport }>('../plugins/*/index.ts', { eager: true })
for (const [path, module] of Object.entries(pluginModules)) {
  const plugin = module.default
  if (!plugin?.manifest) {
    logger.warn(`[Plugin] ${path} 缺少插件清单，跳过`)
    continue
  }
  plugins.push(plugin)
}
if (plugins.length) logger.info(`[Plugin] 已加载 ${plugins.length} 个内置插件`)

let runtimeLoaded = false

export async function loadRuntimePlugins(): Promise<void> {
  if (runtimeLoaded) return
  const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (!bridge?.getRuntimePluginManifests || !bridge.getRuntimePluginSource) {
    runtimeLoaded = true
    return
  }

  try {
    const manifests = await bridge.getRuntimePluginManifests() as Array<PluginManifest & { tools?: Record<string, { name?: string; description?: string; icon?: string }> }>
    const existingIds = new Set(plugins.map(plugin => plugin.manifest.id))
    for (const manifest of manifests) {
      if (!manifest?.id || existingIds.has(manifest.id)) continue
      existingIds.add(manifest.id)
      const tools: ToolInfo[] = Object.entries(manifest.tools || {}).map(([toolId, meta]) => ({
        id: `${manifest.id}/${toolId}`,
        pluginId: manifest.id,
        name: meta.name || toolId,
        description: meta.description || '',
        icon: meta.icon || '🔧',
        component: async () => {
          const source = await bridge.getRuntimePluginSource(manifest.id, toolId)
          const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
          try {
            return await import(/* @vite-ignore */ moduleUrl)
          } finally {
            URL.revokeObjectURL(moduleUrl)
          }
        },
      }))
      plugins.push({ manifest, tools })
      logger.info(`[Plugin] 已加载本机插件 ${manifest.name} v${manifest.version}（${tools.length} 个工具）`)
    }
  } catch (error) {
    logger.warn('[Plugin] 加载本机插件失败', { error: error instanceof Error ? error.message : String(error) })
  } finally {
    runtimeLoaded = true
  }
}

export function getPluginPageOverride(componentName: string): (() => Promise<Component>) | null {
  for (const plugin of plugins) {
    if (plugin.pages?.[componentName]) {
      return plugin.pages[componentName]
    }
  }
  return null
}

export function getAllPluginStores(): Record<string, () => Promise<any>> {
  const allStores: Record<string, () => Promise<any>> = {}
  for (const plugin of plugins) {
    if (plugin.stores) {
      Object.assign(allStores, plugin.stores)
    }
  }
  return allStores
}

export function getAllTools(): ToolInfo[] {
  const allTools: ToolInfo[] = []
  for (const plugin of plugins) {
    if (plugin.tools) {
      allTools.push(...plugin.tools)
    }
  }
  return allTools
}

export function getPlugins(): PluginExport[] {
  return plugins
}
