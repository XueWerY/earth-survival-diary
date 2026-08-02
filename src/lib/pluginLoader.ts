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

// 开发模式：从独立文件加载 Vite glob（生产构建会 tree-shake 整个 import）
let _devLoaded: Promise<void> | null = null
if (import.meta.env.DEV) {
  _devLoaded = import('./pluginLoader.dev').then(m => {
    plugins.push(...m.devPlugins)
  })
}

// 生产模式：从运行时编译产物加载
let runtimeLoaded = false

export async function loadRuntimePlugins(): Promise<void> {
  if (runtimeLoaded) return

  if (import.meta.env.DEV) {
    await _devLoaded
    runtimeLoaded = true
    return
  }

  const electronAPI = (window as any).electronAPI
  if (!electronAPI?.getRuntimePluginManifests) return

  try {
    const manifests: PluginManifest[] = await electronAPI.getRuntimePluginManifests()
    for (const m of manifests) {
      const plugin: PluginExport = { manifest: m, tools: [] }
      const toolsMeta = (m as any).tools || {}

      for (const [toolId, meta] of Object.entries(toolsMeta) as [string, any][]) {
        const modulePath = `/api/plugins/${m.id}/dist/${toolId}.js`
        plugin.tools!.push({
          id: `${m.id}/${toolId}`,
          pluginId: m.id,
          name: meta.name || toolId,
          description: meta.description || '',
          icon: meta.icon || '🔧',
          component: () => import(/* @vite-ignore */ modulePath),
        })
      }

      plugins.push(plugin)
      logger.info(`[插件] 运行时加载: ${m.name} v${m.version} (工具${plugin.tools!.length})`)
    }
    runtimeLoaded = true
  } catch (e) {
    logger.warn('[插件] 运行时加载失败', { error: e instanceof Error ? e.message : String(e) })
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
