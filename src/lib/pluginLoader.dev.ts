// 开发模式：Vite glob 加载 src/plugins/
// 此文件仅在 dev 模式下被导入，生产构建会被 tree-shake
import type { PluginExport } from './pluginLoader'
import { logger } from './logger'

const pluginModules = import.meta.glob<{ default: PluginExport }>('../plugins/*/index.ts', { eager: true })

export const devPlugins: PluginExport[] = []

for (const [path, module] of Object.entries(pluginModules)) {
  const plugin = module.default
  if (!plugin.manifest) {
    logger.warn(`[插件] ${path} 缺少 manifest，跳过`)
    continue
  }
  devPlugins.push(plugin)
  const pageCount = plugin.pages ? Object.keys(plugin.pages).length : 0
  const storeCount = plugin.stores ? Object.keys(plugin.stores).length : 0
  const toolCount = plugin.tools ? plugin.tools.length : 0
  logger.info(`[插件] 已加载: ${plugin.manifest.name} v${plugin.manifest.version} (页面${pageCount} 存储${storeCount} 工具${toolCount})`)
}
