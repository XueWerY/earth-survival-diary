export {}

declare global {
  interface Window {
    electronAPI: {
      resizeWindow: (width: number, height: number) => void
      onUpdateStatus: (callback: (data: UpdateStatus) => void) => void
      setWindowSize: (userId: string, width: number, height: number) => Promise<boolean>
      getWindowSize: (userId: string) => Promise<{ width: number; height: number } | null>
      applyWindowSize: (userId: string) => Promise<boolean>
      getScreenInfo: () => Promise<{ width: number; height: number; scaleFactor: number; physicalWidth: number; physicalHeight: number }>
      installUpdate: () => Promise<void>
      checkForUpdate: () => Promise<{ updateAvailable?: boolean; error?: string }>
      openExternal: (url: string) => Promise<void>
      saveFileDialog: (options?: any) => Promise<string | null>
      openFileDialog: (options?: any) => Promise<string | null>
      readFile: (filePath: string) => Promise<string | null>
      writeFile: (filePath: string, content: string) => Promise<boolean>
      restartApp: () => void
      getLogFileSize: () => Promise<{ size: number; exists: boolean }>
      getLogDirSize: () => Promise<{ size: number }>
      getDataDirSize: () => Promise<{ size: number }>
      getLogContent: () => Promise<string>
      clearLogs: () => Promise<boolean>
      openLogViewer: (content: string) => Promise<void>
      getModuleSizes: () => Promise<ModuleSizesResult>
      openCleanDataWindow: (data: CleanDataWindowData) => Promise<CleanDataResult | null>
      confirmCleanData: (result: CleanDataResult) => void
      cancelCleanData: () => void
      checkVersionUpdate: (userId: string) => Promise<{ isUpdated: boolean; oldVersion: string | null; newVersion: string | null }>
      openChangelogWindow: (content: string) => Promise<void>
      scheduleReminders: (reminders: ReminderItem[], persistDuration: number | null) => Promise<{ ok: boolean; count: number }>
      cancelAllReminders: () => Promise<{ ok: boolean }>
      getReminderPersistDuration: () => Promise<{ persistDuration: number }>
  getAllReminders: () => Promise<any[]>
      onShowReminder: (callback: (data: ReminderItem) => void) => void

      // 文件管理器
      getDataDirPath: () => Promise<string>
      getLogDirPath: () => Promise<string>
      readDirectory: (dirPath: string) => Promise<FileEntry[]>
      deleteFilePath: (filePath: string) => Promise<boolean>
      renameFilePath: (oldPath: string, newPath: string) => Promise<boolean>
      readTextFilePath: (filePath: string) => Promise<string>

      // 局域网传输
      startLanServer: (data: any) => Promise<{ ip: string; port: number }>
      stopLanServer: () => Promise<boolean>
      fetchLanData: (url: string) => Promise<any>
    }
  }
}

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

interface ReminderItem {
  id: string
  name: string
  body: string
  triggerTime: string
  listName?: string
  groupName?: string
  repeatStrategy?: string
  repeatCustomDays?: number
  repeatEndStrategy?: string
  repeatEndDate?: string
  repeatCount?: number
  repeatCompletedCount?: number
  reminderStrategy?: string
  reminderDays?: number
  reminderHours?: number
  reminderMinutes?: number
  endTime?: string
}

interface UpdateStatus {
  status: 'available' | 'downloading' | 'downloaded' | 'error' | 'no-update'
  version?: string
  percent?: number
  message?: string
}

interface ModuleSizeChild {
  key: string
  label: string
  serverKeys: string[]
  size: number
}

interface ModuleSizeGroup {
  groupKey: string
  groupLabel: string
  groupSize: number
  children: ModuleSizeChild[]
}

interface UserModuleSizes {
  email: string
  nickname: string
  userId: string
  totalSize: number
  modules: ModuleSizeGroup[]
}

interface ModuleSizesResult {
  users: UserModuleSizes[]
  totalDataSize: number
  moduleGroups: { key: string; label: string; children: { key: string; label: string; serverKeys: string[] }[] }[]
}

interface CleanDataWindowData {
  users: UserModuleSizes[]
  totalDataSize: number
  moduleGroups: { key: string; label: string; children: { key: string; label: string; serverKeys: string[] }[] }[]
}

interface CleanDataResult {
  deleteAll: boolean
  modules: string[]
}
