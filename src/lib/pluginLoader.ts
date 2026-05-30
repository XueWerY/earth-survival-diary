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

const pluginModules = import.meta.glob<{ default: PluginExport }>('../plugins/*/index.ts', { eager: true })

const plugins: PluginExport[] = []

for (const [path, module] of Object.entries(pluginModules)) {
  const plugin = module.default
  if (!plugin.manifest) {
    logger.warn(`[插件] ${path} 缺少 manifest，跳过`)
    continue
  }
  plugins.push(plugin)
  const pageCount = plugin.pages ? Object.keys(plugin.pages).length : 0
  const storeCount = plugin.stores ? Object.keys(plugin.stores).length : 0
  const toolCount = plugin.tools ? plugin.tools.length : 0
  logger.info(`[插件] 已加载: ${plugin.manifest.name} v${plugin.manifest.version} (页面${pageCount} 存储${storeCount} 工具${toolCount})`)
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