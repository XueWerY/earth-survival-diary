/**
 * 跨平台版本检测工具
 *
 * 统一 Windows、Linux、Android 三端的版本号提取与比对逻辑：
 * 1. 从远程仓库 Releases 资源文件名中提取版本号
 * 2. 与本地版本号进行比对，判断是否需要更新
 */

/** 版本号格式：YYYY.M.DD-X，如 2026.7.18-20 */
const VERSION_REGEX = /(\d{4})\.(\d{1,2})\.(\d{1,2})-(\d+)/

/** 各平台构建产物文件名中提取版本号的正则（后缀区分平台） */
const ASSET_FILENAME_REGEX = /Earth-Survival-Diary(?:-Setup)?-(\d{4}\.\d{1,2}\.\d{1,2}-\d+)/

/** GitHub Releases API 和发布页地址 */
const RELEASES_API_URL = 'https://api.github.com/repos/XueWerY/earth-survival-diary/releases'
const RELEASES_PAGE_URL = 'https://github.com/XueWerY/earth-survival-diary/releases'

export interface ParsedVersion {
  year: number
  month: number
  day: number
  patch: number
  /** 原始版本号字符串 */
  raw: string
}

/** GitHub Release 资源文件信息 */
export interface ReleaseAsset {
  name: string
  url: string
  browser_download_url: string
  size: number
}

/** 一个 GitHub Release 条目 */
export interface GithubRelease {
  tag_name: string
  name: string
  html_url: string
  assets: ReleaseAsset[]
  prerelease: boolean
}

/** 版本检测结果 */
export interface VersionCheckResult {
  /** 是否有可用更新 */
  hasUpdate: boolean
  /** 远程最新版本号 */
  latestVersion: string | null
  /** 远程最新版本对应的下载 URL */
  downloadUrl: string | null
  /** 当前本地版本号 */
  currentVersion: string
}

/** 当前平台对应的资产文件扩展名 */
function getPlatformAssetExt(): string {
  // 在浏览器/Capacitor 环境中判断
  if (typeof window !== 'undefined') {
    if ((window as any).electronAPI) {
      // Electron 端：根据操作系统选扩展名
      // navigator.platform 在 Electron 中反映宿主系统
      const plat = (typeof navigator !== 'undefined' ? navigator.platform : '') || ''
      if (plat.includes('Linux') || plat.includes('linux')) return '.deb'
    } else {
      // Capacitor/移动端
      return '.apk'
    }
  }
  // 默认 Windows（.exe）
  return '.exe'
}

/**
 * 解析版本号字符串为结构化对象
 * @param version 格式如 "2026.7.18-20"
 * @returns 解析后的版本对象，解析失败返回 null
 */
export function parseVersion(version: string): ParsedVersion | null {
  const match = version.match(VERSION_REGEX)
  if (!match) return null
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
    patch: parseInt(match[4], 10),
    raw: version
  }
}

/**
 * 从构建产物文件名中提取版本号
 * @param filename 如 "Earth-Survival-Diary-Setup-2026.7.18-20.exe" 或 "Earth-Survival-Diary-2026.7.18-20.apk"
 * @returns 版本号字符串，解析失败返回 null
 */
export function extractVersionFromFilename(filename: string): string | null {
  const match = filename.match(ASSET_FILENAME_REGEX)
  return match ? match[1] : null
}

/**
 * 比较两个版本号
 * @returns 负数表示 a < b，0 表示相等，正数表示 a > b
 */
export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a)
  const parsedB = parseVersion(b)

  // 如果任一版本号格式无效，回退到简单字符串比较
  if (!parsedA || !parsedB) {
    return a.localeCompare(b)
  }

  if (parsedA.year !== parsedB.year) return parsedA.year - parsedB.year
  if (parsedA.month !== parsedB.month) return parsedA.month - parsedB.month
  if (parsedA.day !== parsedB.day) return parsedA.day - parsedB.day
  return parsedA.patch - parsedB.patch
}

/**
 * 判断 latest 版本是否比 current 版本更新
 */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0
}

/**
 * 从 GitHub Releases 资产列表中提取最高版本号
 *
 * 遍历所有资产文件，从符合平台命名规则的文件名中提取版本号，
 * 返回其中的最高版本号。
 *
 * @param assets Release 中的 assets 数组
 * @param currentVersion 当前本地版本号，只返回比它更新的版本
 * @param platformExt 目标平台的文件扩展名（如 .exe、.deb、.apk）
 * @returns 最高版本号，无可用更新时返回 null
 */
export function findLatestVersionFromAssets(
  assets: ReleaseAsset[],
  currentVersion: string,
  platformExt: string
): { version: string; downloadUrl: string } | null {
  let bestVersion: string | null = null
  let bestDownloadUrl: string | null = null

  for (const asset of assets) {
    if (!asset.name.endsWith(platformExt)) continue
    const version = extractVersionFromFilename(asset.name)
    if (!version) continue
    if (!isNewerVersion(version, currentVersion)) continue
    if (!bestVersion || isNewerVersion(version, bestVersion)) {
      bestVersion = version
      bestDownloadUrl = asset.browser_download_url
    }
  }

  if (!bestVersion || !bestDownloadUrl) return null
  return { version: bestVersion, downloadUrl: bestDownloadUrl }
}

/**
 * 从 GitHub Releases API 获取最新版本信息
 *
 * 对 Windows/Linux Electron 端在 Node.js 环境中调用时，
 * HTTP 请求由 Electron 主进程处理（参见 electron/main.cjs）。
 *
 * @param currentVersion 当前本地版本号
 * @param platformExt 目标平台的文件扩展名
 * @returns 版本检测结果
 */
export async function fetchLatestReleaseVersion(
  currentVersion: string,
  platformExt?: string
): Promise<VersionCheckResult> {
  const ext = platformExt || getPlatformAssetExt()

  const base: VersionCheckResult = {
    hasUpdate: false,
    latestVersion: null,
    downloadUrl: null,
    currentVersion
  }

  try {
    const res = await fetch(RELEASES_API_URL)
    if (!res.ok) return base

    const releases: GithubRelease[] = await res.json()
    if (!Array.isArray(releases)) return base

    // 遍历所有 releases（不只看 latest，因为可能有非最新 published 但包含更高版本号资产的情况）
    let best: { version: string; downloadUrl: string } | null = null

    for (const release of releases) {
      if (release.prerelease) continue
      const result = findLatestVersionFromAssets(
        release.assets,
        currentVersion,
        ext
      )
      if (result && (!best || isNewerVersion(result.version, best.version))) {
        best = result
      }
    }

    if (best) {
      return {
        hasUpdate: true,
        latestVersion: best.version,
        downloadUrl: best.downloadUrl,
        currentVersion
      }
    }

    return base
  } catch {
    // 网络不可达，静默返回
    return base
  }
}

export { RELEASES_PAGE_URL, VERSION_REGEX, ASSET_FILENAME_REGEX }
