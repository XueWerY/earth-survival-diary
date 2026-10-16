const REPOSITORY = 'XueWerY/earth-survival-diary'

/** 用户查看和下载桌面版更新的 GitHub Releases 页面。 */
export const UPDATE_BASE_URL = `https://github.com/${REPOSITORY}/releases/latest`
export const UPDATE_MANIFEST_URL = `https://api.github.com/repos/${REPOSITORY}/releases/latest`

export interface VersionCheckResult {
  hasUpdate: boolean
  latestVersion: string | null
  downloadUrl: string | null
  currentVersion: string
  error?: string
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

/** 从 GitHub Releases 获取最新版本信息；安装包由用户在浏览器中下载。 */
export async function fetchLatestReleaseVersion(currentVersion: string): Promise<VersionCheckResult> {
  const noUpdate: VersionCheckResult = {
    hasUpdate: false,
    latestVersion: null,
    downloadUrl: null,
    currentVersion
  }

  try {
    const response = await fetch(UPDATE_MANIFEST_URL, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    if (!response.ok) {
      return { ...noUpdate, error: `GitHub Releases 请求失败（HTTP ${response.status}）` }
    }

    const release = await response.json() as {
      tag_name?: unknown
      html_url?: unknown
      draft?: unknown
      prerelease?: unknown
    }
    const latestVersion = typeof release.tag_name === 'string'
      ? release.tag_name.trim().replace(/^v(?=\d)/i, '')
      : ''
    if (!latestVersion || release.draft || release.prerelease || compareVersions(latestVersion, currentVersion) <= 0) {
      return noUpdate
    }

    return {
      hasUpdate: true,
      latestVersion,
      downloadUrl: typeof release.html_url === 'string' ? release.html_url : UPDATE_BASE_URL,
      currentVersion
    }
  } catch (error) {
    return {
      ...noUpdate,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
