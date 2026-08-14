import { logger } from './logger'
import { getPlugins } from './pluginLoader'

const MARKETPLACE_URL = 'https://raw.githubusercontent.com/XueWerY/plugin-marketplace/main/README.md'

export interface MarketplacePlugin {
  id: string
  name: string
  description: string
  tags: string[]
  repoUrl: string
  author: string
  version: string
  currentVersion?: string
  toolsCount: number
  installed: boolean
  installing: boolean
  hasUpdate: boolean
}

function getInstalledPluginIds(): Set<string> {
  const plugins = getPlugins()
  return new Set(plugins.map(p => p.manifest.id))
}

// 优先走主进程 HTTPS 通道（不受同源策略/渲染进程网络波动影响），
// 无 electronAPI 环境（浏览器 / Android）回退到渲染进程 fetch（带超时，避免挂起）。
async function httpGet(url: string, ms = 20000): Promise<{ status: number; text: string }> {
  const api = (window as any).electronAPI
  if (api?.httpGetText) {
    return await api.httpGetText(url)
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const resp = await fetch(url, { signal: ctrl.signal })
    return { status: resp.status, text: await resp.text() }
  } finally {
    clearTimeout(timer)
  }
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

// force=true 时忽略缓存、强制重新拉取（供刷新按钮使用）
async function loadMarketplaceData(force = false) {
  if (!force && cached !== null) return cached
  try {
    const { status, text } = await httpGet(MARKETPLACE_URL)
    if (status < 200 || status >= 300) {
      logger.warn('[市场] 拉取插件列表失败', { status })
      return cached ?? []
    }
    cached = parseMarketplaceSection(text)
    logger.info(`[市场] 从 remote README 解析到 ${cached.length} 个插件`)
  } catch (e) {
    logger.warn('[市场] 拉取插件列表异常', { error: e instanceof Error ? e.message : String(e) })
    return cached ?? []
  }
  return cached || []
}

export async function fetchMarketplacePlugins(force = false): Promise<MarketplacePlugin[]> {
  const installedPlugins = getPlugins()
  // 同时以「完整 id」与「仓库名」建立索引，兼容插件 manifest.id 写成 owner/repo 或仅 repo 两种情况
  const installedMap = new Map<string, typeof installedPlugins[number]>()
  for (const p of installedPlugins) {
    installedMap.set(p.manifest.id, p)
    const name = p.manifest.id.split('/').pop()
    if (name && name !== p.manifest.id) installedMap.set(name, p)
  }
  const findLocal = (id: string) =>
    installedMap.get(id) || installedMap.get(id.split('/').pop() || '')

  const data = await loadMarketplaceData(force)
  return Promise.all(data.map(async (p) => {
    const manifest = await fetchRemotePluginManifest(p.repoUrl)
    const local = findLocal(p.id)
    const installed = !!local
    const currentVersion = local?.manifest.version
    let hasUpdate = false
    if (installed && manifest?.version && currentVersion && isNewerVersion(manifest.version, currentVersion)) {
      hasUpdate = true
    }
    return {
      ...p,
      author: manifest?.author ?? '',
      version: manifest?.version ?? '',
      currentVersion: currentVersion ?? '',
      toolsCount: manifest?.toolsCount ?? 0,
      installed,
      installing: false,
      hasUpdate,
    }
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
  const { status, text } = await httpGet(url)
  if (status < 200 || status >= 300) return []
  try {
    const data = JSON.parse(text)
    if (!Array.isArray(data)) return []
    return data
  } catch {
    return []
  }
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
            const { status, text } = await httpGet(item.download_url)
            if (status >= 200 && status < 300) {
              files.push({ path: item.path, content: text })
            }
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

interface RemotePluginManifest {
  author: string
  version: string
  toolsCount: number
}

/** 读取远端仓库默认分支上的 plugin.json，提取作者 / 版本 / 小工具个数 */
async function fetchRemotePluginManifest(repoUrl: string): Promise<RemotePluginManifest | null> {
  const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!urlMatch) return null
  const [, owner, repo] = urlMatch
  try {
    const { status, text } = await httpGet(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/plugin.json`)
    if (status < 200 || status >= 300) return null
    const json = JSON.parse(text)
    const tools = json.tools
    return {
      author: typeof json.author === 'string' ? json.author : '',
      version: typeof json.version === 'string' ? json.version : '',
      toolsCount: tools && typeof tools === 'object' ? Object.keys(tools).length : 0,
    }
  } catch (e) {
    logger.warn(`[市场] 读取远端 manifest 失败 ${repoUrl}`, { error: e instanceof Error ? e.message : String(e) })
    return null
  }
}

/** 逐段比较版本号，a 比 b 新时返回 true */
function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x !== y) return x > y
  }
  return false
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