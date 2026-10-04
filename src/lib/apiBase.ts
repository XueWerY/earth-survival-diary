export const API_ORIGIN = 'https://www.earth-survival-diary.icu'

let lastSyncedApiConfig = ''
let apiConfigHydration: Promise<void> | null = null
let apiConfigHydrated = false

export function getApiServerUrl(): string {
  return API_ORIGIN
}

export function hydrateApiConfig(): Promise<void> {
  const electronAPI = typeof window === 'undefined' ? null : (window as any).electronAPI
  if (!electronAPI?.getRemoteApiConfig || apiConfigHydrated) return Promise.resolve()
  if (!apiConfigHydration) {
    apiConfigHydration = Promise.resolve(electronAPI.getRemoteApiConfig()).then((saved: { baseUrl?: string; token?: string }) => {
      if (!localStorage.getItem('auth_token') && saved.token) {
        localStorage.setItem('auth_token', saved.token)
      }
      apiConfigHydrated = true
      syncElectronApiConfig()
    }).catch(() => {
      apiConfigHydration = null
    })
  }
  return apiConfigHydration || Promise.resolve()
}

export function getApiBaseUrl(): string {
  syncElectronApiConfig()
  return `${API_ORIGIN}/api`
}

export function syncElectronApiConfig(): void {
  if (typeof window === 'undefined' || !(window as any).electronAPI?.setRemoteApiConfig) return
  const token = typeof localStorage === 'undefined' ? '' : localStorage.getItem('auth_token') || ''
  const signature = `${API_ORIGIN}\n${token}`
  if (signature === lastSyncedApiConfig) return
  lastSyncedApiConfig = signature
  void (window as any).electronAPI.setRemoteApiConfig(token)
}
