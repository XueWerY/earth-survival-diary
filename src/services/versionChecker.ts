import { parse as parseYaml } from 'yaml'
import { API_ORIGIN } from '../lib/apiBase'

/** 云服务器上 electron-builder 发布的自动更新清单。 */
export const UPDATE_BASE_URL = `${API_ORIGIN}/updates/`
export const UPDATE_MANIFEST_URL = new URL('latest.yml', UPDATE_BASE_URL).toString()

export interface VersionCheckResult {
  hasUpdate: boolean
  latestVersion: string | null
  downloadUrl: string | null
  currentVersion: string
}

export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => {
    const match = value.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})-(\d+)$/)
    return match ? match.slice(1).map(Number) : null
  }
  const left = parse(a)
  const right = parse(b)
  if (!left || !right) return a.localeCompare(b)
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

/** 从云服务器 latest.yml 读取版本和安装包地址。 */
export async function fetchLatestReleaseVersion(currentVersion: string): Promise<VersionCheckResult> {
  const noUpdate: VersionCheckResult = {
    hasUpdate: false,
    latestVersion: null,
    downloadUrl: null,
    currentVersion
  }

  try {
    const response = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' })
    if (!response.ok) return noUpdate

    const manifest = parseYaml(await response.text()) as {
      version?: unknown
      path?: unknown
      files?: Array<{ url?: unknown }>
    } | null
    if (!manifest || typeof manifest !== 'object') return noUpdate

    const latestVersion = typeof manifest.version === 'string' ? manifest.version : ''
    const packagePath = typeof manifest.path === 'string'
      ? manifest.path
      : manifest.files?.find(file => typeof file.url === 'string' && file.url.toLowerCase().endsWith('.exe'))?.url

    if (!latestVersion || typeof packagePath !== 'string' || !packagePath || compareVersions(latestVersion, currentVersion) <= 0) {
      return noUpdate
    }

    const downloadUrl = new URL(packagePath, UPDATE_BASE_URL)
    const updateOrigin = new URL(UPDATE_BASE_URL)
    if (downloadUrl.origin !== updateOrigin.origin || !downloadUrl.pathname.startsWith(updateOrigin.pathname)) return noUpdate

    return {
      hasUpdate: true,
      latestVersion,
      downloadUrl: downloadUrl.toString(),
      currentVersion
    }
  } catch {
    // 云端暂不可达时保持静默，不影响登录和使用。
    return noUpdate
  }
}
