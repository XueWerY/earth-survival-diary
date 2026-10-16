// 开发模式：Vite glob 加载 src/plugins/
// 此文件仅在 dev 模式下被导入，生产构建会被 tree-shake
import type { PluginExport } from './pluginLoader'
import { logger } from './logger'

const pluginModules = import.meta.glob<{ default: PluginExport }>('../plugins/*/index.ts', { eager: true })

export const devPlugins: PluginExport[] = []

for (const [path, module] of Object.entries(pluginModules)) {
  const plugin = module.default
  if (!plugin.manifest) {
    logger.warn(`[Plugin] ${path} 缺少插件清单，跳过`)
    continue
  }
  devPlugins.push(plugin)
}

if (devPlugins.length > 0) logger.info(`[Plugin] 已加载 ${devPlugins.length} 个开发插件`)
