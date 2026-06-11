import type { Component } from 'vue'
import manifest from './plugin.json'

const toolModules = import.meta.glob<{ default: Component }>('./tools/*/index.vue')

const toolsMeta = (manifest as any).tools || {}

const tools = Object.entries(toolModules).map(([path, loader]) => {
  const dirName = path.split('/')[2]
  const meta = toolsMeta[dirName] || {}
  return {
    id: `${manifest.id}/${dirName}`,
    pluginId: manifest.id,
    name: meta.name || dirName,
    description: meta.description || '',
    icon: meta.icon || '🔧',
    component: loader as () => Promise<Component>,
  }
})

export default { manifest, tools }