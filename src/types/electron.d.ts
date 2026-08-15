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
      downloadUpdate: (url: string) => Promise<{ ok: boolean; error?: string }>
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

      // 系统字体
      getSystemFonts: () => Promise<string[]>

      // 剪贴板（用于 Electron 端粘贴系统剪贴板内容）
      readClipboardText: () => Promise<string>
      readClipboardHTML: () => Promise<string>

      // 局域网传输
      startLanServer: (data: any) => Promise<{ ip: string; port: number }>
      stopLanServer: () => Promise<boolean>
      fetchLanData: (url: string) => Promise<any>
      setWindowTitle: (title: string) => Promise<boolean>

      // 终端命令执行（PowerShell，输出经 powershell-output 事件流式回推）
      execPowerShell: (command: string) => Promise<{ success: boolean; code: number; error?: string }>
      onPowerShellOutput: (callback: (data: { stream: 'stdout' | 'stderr' | 'exit'; text: string }) => void) => void
      offPowerShellOutput: () => void
      killPowerShell: () => Promise<{ success: boolean; error?: string }>

      // 主进程 HTTPS JSON 请求（绕开渲染进程同源限制）
      httpGetJson: (url: string) => Promise<any>
      // 主进程 HTTPS 文本请求（下载插件源码等，返回 { status, text }）
      httpGetText: (url: string) => Promise<{ status: number; text: string; error?: string }>

      // 插件管理
      getPluginsDirPath: () => Promise<string>
      getSnowbabyDirPath: () => Promise<string>
      createDirectory: (dirPath: string) => Promise<boolean>
      removeDirectory: (dirPath: string) => Promise<boolean>
      recompilePlugins: () => Promise<boolean>

      // 视频全局快捷键
      onVideoGuideShortcut: (callback: (action: 'prev-episode' | 'seek-back' | 'play-pause' | 'seek-forward' | 'next-episode', seekSeconds?: number) => void) => void
      offVideoGuideShortcut: () => void
      getVideoShortcuts: () => Promise<VideoShortcutConfig>
      updateVideoShortcuts: (shortcuts: Partial<VideoShortcutConfig>) => Promise<{ success: boolean; shortcuts: VideoShortcutConfig }>
      interface VideoShortcutConfig {
        prevEpisode: string; seekBack: string; playPause: string; seekForward: string; nextEpisode: string; seekSeconds: number
      }
      // 视频悬浮播放器窗口
      interface VideoHistoryItem {
        name: string; url: string; page: number; progress: number; duration: number; time: number
      }
      openVideoOverlay: (payload: { url: string; width?: number; height?: number; position?: string; margin?: number; overlayHtml?: string; playlist?: { url: string; page: number; title: string }[]; startPage?: number; userId?: string; seekTo?: number }) => Promise<{ success: boolean }>
      closeVideoOverlay: () => Promise<{ success: boolean }>
      toggleOverlayCollapse: () => Promise<{ success: boolean; collapsed: boolean }>
      updateOverlayBounds: (payload: { width?: number; height?: number; position?: string; margin?: number }) => Promise<{ success: boolean }>
      controlBiliPlayer: (data: { action: 'play-pause' | 'seek-back' | 'seek-forward' | 'seek-to' | 'hide-ui' | 'hide-end-screen'; seconds?: number }) => void
      reportPlaybackState: (data: { url: string; page?: number; title?: string }) => void
      getBiliPages: (bvid: string) => Promise<{ success: boolean; title?: string; pages?: { page: number; title: string }[] }>
      getVideoHistory: (userId: string) => Promise<VideoHistoryItem[]>
      recordVideoHistory: (userId: string, entry: { name: string; url: string; page?: number }) => Promise<VideoHistoryItem[]>
      removeVideoHistory: (userId: string, url: string) => Promise<VideoHistoryItem[]>
      onOverlayInit: (callback: (data: { url: string; width: number; height: number }) => void) => void
      onOverlayCollapsed: (callback: (collapsed: boolean) => void) => void
      onOverlayProgress: (callback: (progress: { t: number; d: number }) => void) => void
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
  focusDuration?: number
  focusStartTimestamp?: number
  targetDate?: string
  courseStartTime?: string
}

interface UpdateStatus {
  status: 'available' | 'downloading' | 'downloaded' | 'error' | 'no-update'
  version?: string
  downloadUrl?: string
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
