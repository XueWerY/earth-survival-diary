import { logger } from './logger'
import { getPlugins } from './pluginLoader'

const MARKETPLACE_URL = 'https://raw.githubusercontent.com/XueWerY/plugin-marketplace/main/README.md'

export interface MarketplacePlugin {
  id: string
  name: string
  description: string
  tags: string[]
  repoUrl: string
  installed: boolean
  installing: boolean
}

function getInstalledPluginIds(): Set<string> {
  const plugins = getPlugins()
  return new Set(plugins.map(p => p.manifest.id))
}

// 从 README.md 的"插件市场"章节解析插件列表
// 格式: - [名称](仓库URL) — 描述 #标签1 #标签2
function parseMarketplaceSection(content: string): Omit<MarketplacePlugin, 'installed' | 'installing'>[] {
  const lines = content.split('\n').map(l => l.replace(/\r$/, ''))
  let inSection = false
  const results: Omit<MarketplacePlugin, 'installed' | 'installing'>[] = []

  // 匹配行：- [名称](URL) — 描述 #标签1 #标签2
  const itemRegex = /^\s*-\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*(?:—|--|——)?\s*(.*?)\s*(#[^\s#]+(?:\s+#[^\s#]+)*)?\s*$/

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      inSection = heading[2].includes('插件市场')
      continue
    }
    if (!inSection) continue

    const m = line.match(itemRegex)
    if (!m) continue

    const [, name, url, description = '', tagsLine = ''] = m
    const tags = tagsLine
      ? tagsLine.split(/\s+/).filter(t => t.startsWith('#')).map(t => t.slice(1))
      : []

    const urlMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    const id = urlMatch ? `${urlMatch[1]}/${urlMatch[2]}` : url

    results.push({
      id,
      name: name.trim(),
      description: description.trim(),
      tags,
      repoUrl: url,
    })
  }

  return results
}

let cached: Omit<MarketplacePlugin, 'installed' | 'installing'>[] | null = null

async function loadMarketplaceData() {
  if (cached !== null) return cached
  try {
    const resp = await fetch(MARKETPLACE_URL)
    if (!resp.ok) {
      logger.warn('[市场] 拉取插件列表失败', { status: resp.status })
      return []
    }
    const content = await resp.text()
    cached = parseMarketplaceSection(content)
    logger.info(`[市场] 从 remote README 解析到 ${cached.length} 个插件`)
  } catch (e) {
    logger.warn('[市场] 拉取插件列表异常', { error: e instanceof Error ? e.message : String(e) })
  }
  return cached || []
}

export async function fetchMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  const installedIds = getInstalledPluginIds()
  const data = await loadMarketplaceData()
  return data.map(p => ({
    ...p,
    installed: installedIds.has(p.id) || installedIds.has(p.id.split('/')[1]),
    installing: false,
  }))
}

interface GitHubContent {
  name: string
  path: string
  type: 'file' | 'dir'
  download_url: string | null
}

async function fetchRepoContents(owner: string, repo: string, dirPath = ''): Promise<GitHubContent[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}`
  const resp = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' }
  })
  if (!resp.ok) return []
  const data = await resp.json()
  if (!Array.isArray(data)) return []
  return data
}

export async function installPlugin(
  plugin: MarketplacePlugin,
  pluginsDir: string,
  createDir: (dirPath: string) => Promise<boolean>,
  writeFile: (filePath: string, content: string) => Promise<boolean>,
): Promise<boolean> {
  try {
    const urlMatch = plugin.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!urlMatch) {
      logger.warn(`[市场] 仓库地址无效: ${plugin.repoUrl}`)
      return false
    }
    const [, owner, repo] = urlMatch
    logger.info(`[市场] 开始安装 ${plugin.id}`)
    const targetDir = `${pluginsDir}/${plugin.id.split('/')[1]}`

    async function collectFiles(dirPath: string): Promise<{ path: string; content: string }[]> {
      const items = await fetchRepoContents(owner, repo, dirPath)
      const files: { path: string; content: string }[] = []
      for (const item of items) {
        if (item.type === 'dir') {
          const sub = await collectFiles(item.path)
          files.push(...sub)
        } else if (item.type === 'file') {
          if (item.download_url) {
            const fileResp = await fetch(item.download_url)
            files.push({ path: item.path, content: await fileResp.text() })
          }
        }
      }
      return files
    }

    const allFiles = await collectFiles('')
    logger.info(`[市场] ${plugin.id} 共 ${allFiles.length} 个文件`)

    await createDir(targetDir)
    for (const f of allFiles) {
      const baseName = f.path.replace(/^.*[\\/]/, '')
      if (['.gitignore', 'README.md', 'LICENSE'].includes(baseName) && !f.path.includes('/')) {
        continue
      }
      const fullPath = `${targetDir}/${f.path}`
      const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'))
      if (parentDir !== targetDir) {
        await createDir(parentDir)
      }
      await writeFile(fullPath, f.content)
    }

    logger.info(`[市场] ${plugin.id} 安装完成`)
    return true
  } catch (e) {
    logger.error(`[市场] 安装 ${plugin.id} 失败`, { error: e instanceof Error ? e.message : String(e) })
    return false
  }
}

export async function deletePlugin(
  pluginId: string,
  pluginsDir: string,
  removeDir: (dirPath: string) => Promise<boolean>,
): Promise<boolean> {
  try {
    const dirName = pluginId.split('/')[1] || pluginId
    logger.info(`[市场] 删除插件 ${dirName}`)
    await removeDir(`${pluginsDir}/${dirName}`)
    return true
  } catch (e) {
    logger.error(`[市场] 删除 ${pluginId} 失败`, { error: e instanceof Error ? e.message : String(e) })
    return false
  }
}