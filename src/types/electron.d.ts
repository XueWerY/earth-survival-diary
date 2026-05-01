export {}

declare global {
  interface Window {
    electronAPI: {
      resizeWindow: (width: number, height: number) => void
      onUpdateStatus: (callback: (data: UpdateStatus) => void) => void
      installUpdate: () => Promise<void>
      checkForUpdate: () => Promise<{ updateAvailable?: boolean; error?: string }>
    }
  }
}

interface UpdateStatus {
  status: 'available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}
