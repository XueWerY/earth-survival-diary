const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  getScreenInfo: () => ipcRenderer.invoke('get-screen-info'),
  setWindowSize: (userId, width, height) => ipcRenderer.invoke('set-window-size', userId, width, height),
  getWindowSize: (userId) => ipcRenderer.invoke('get-window-size', userId),
  applyWindowSize: (userId) => ipcRenderer.invoke('apply-window-size', userId),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, data) => callback(data)),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  downloadUpdate: (url) => ipcRenderer.invoke('download-update', url),
  saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  restartApp: () => ipcRenderer.send('restart-app'),
  getLogFileSize: () => ipcRenderer.invoke('get-log-file-size'),
  getLogDirSize: () => ipcRenderer.invoke('get-log-dir-size'),
  getDataDirSize: () => ipcRenderer.invoke('get-data-dir-size'),
  getLogContent: () => ipcRenderer.invoke('get-log-content'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  openLogViewer: (content) => ipcRenderer.invoke('open-log-viewer', content),
  getModuleSizes: () => ipcRenderer.invoke('get-module-sizes'),
  openCleanDataWindow: (data) => ipcRenderer.invoke('open-clean-data-window', data),
  confirmCleanData: (result) => ipcRenderer.send('clean-data-confirm', result),
  cancelCleanData: () => ipcRenderer.send('clean-data-cancel'),
  checkVersionUpdate: (userId) => ipcRenderer.invoke('check-version-update', userId),
  openChangelogWindow: (content) => ipcRenderer.invoke('open-changelog-window', content),
  scheduleReminders: (reminders, persistDuration) => ipcRenderer.invoke('schedule-reminders', reminders, persistDuration),
  cancelAllReminders: () => ipcRenderer.invoke('cancel-all-reminders'),
  getReminderPersistDuration: () => ipcRenderer.invoke('get-reminder-persist-duration'),
      getAllReminders: () => ipcRenderer.invoke('get-all-reminders'),
  onShowReminder: (callback) => ipcRenderer.on('show-reminder', (_event, data) => callback(data)),
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setCloseAction: (action) => ipcRenderer.invoke('set-close-action', action),
  getCloseAction: () => ipcRenderer.invoke('get-close-action'),
  setWindowTitle: (title) => ipcRenderer.invoke('set-window-title', title),

  // 文件管理器
  getDataDirPath: () => ipcRenderer.invoke('get-data-dir-path'),
  getLogDirPath: () => ipcRenderer.invoke('get-log-dir-path'),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  deleteFilePath: (filePath) => ipcRenderer.invoke('delete-file-path', filePath),
  renameFilePath: (oldPath, newPath) => ipcRenderer.invoke('rename-file-path', oldPath, newPath),
  readTextFilePath: (filePath) => ipcRenderer.invoke('read-text-file-path', filePath),

  // 系统字体
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),

  // 剪贴板（用于 Electron 端粘贴系统剪贴板内容）
  readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
  readClipboardHTML: () => ipcRenderer.invoke('read-clipboard-html'),

  // 局域网传输
  startLanServer: (data) => ipcRenderer.invoke('start-lan-server', data),
  stopLanServer: () => ipcRenderer.invoke('stop-lan-server'),
  fetchLanData: (url) => ipcRenderer.invoke('fetch-lan-data', url),

  // 终端命令执行（PowerShell，输出经 powershell-output 事件流式回推）
  execPowerShell: (command) => ipcRenderer.invoke('exec-powershell', command),
  onPowerShellOutput: (callback) => ipcRenderer.on('powershell-output', (_event, data) => callback(data)),
  offPowerShellOutput: () => ipcRenderer.removeAllListeners('powershell-output'),
  killPowerShell: () => ipcRenderer.invoke('kill-powershell'),

  // 主进程 HTTPS JSON 请求（绕开渲染进程同源限制）
  httpGetJson: (url) => ipcRenderer.invoke('http-get-json', url),
  // 主进程 HTTPS 文本请求（下载插件源码等，返回 { status, text }）
  httpGetText: (url) => ipcRenderer.invoke('http-get-text', url),

  // 插件管理
  getPluginsDirPath: () => ipcRenderer.invoke('get-plugins-dir-path'),
  getSnowbabyDirPath: () => ipcRenderer.invoke('get-snowbaby-dir-path'),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  removeDirectory: (dirPath) => ipcRenderer.invoke('remove-directory', dirPath),
  getRuntimePluginManifests: () => ipcRenderer.invoke('get-runtime-plugin-manifests'),
  recompilePlugins: () => ipcRenderer.invoke('recompile-plugins'),

  // 攻略视频全局快捷键（CommandOrControl+Shift+Space 播放/暂停，Ctrl+Left/Right 后退/快进）
  onVideoGuideShortcut: (callback) => {
    ipcRenderer.on('video-guide:prev-episode', () => callback('prev-episode'))
    ipcRenderer.on('video-guide:seek-back', (_e, seconds) => callback('seek-back', seconds))
    ipcRenderer.on('video-guide:play-pause', () => callback('play-pause'))
    ipcRenderer.on('video-guide:seek-forward', (_e, seconds) => callback('seek-forward', seconds))
    ipcRenderer.on('video-guide:next-episode', () => callback('next-episode'))
  },
  offVideoGuideShortcut: () => {
    ipcRenderer.removeAllListeners('video-guide:prev-episode')
    ipcRenderer.removeAllListeners('video-guide:seek-back')
    ipcRenderer.removeAllListeners('video-guide:play-pause')
    ipcRenderer.removeAllListeners('video-guide:seek-forward')
    ipcRenderer.removeAllListeners('video-guide:next-episode')
  },
  getVideoShortcuts: () => ipcRenderer.invoke('video-guide:get-shortcuts'),
  updateVideoShortcuts: (shortcuts) => ipcRenderer.invoke('video-guide:update-shortcuts', shortcuts),

  // 视频悬浮播放器窗口控制
  openVideoOverlay: (payload) => ipcRenderer.invoke('video-guide:open-overlay', payload),
  closeVideoOverlay: () => ipcRenderer.invoke('video-guide:close-overlay'),
  toggleOverlayCollapse: () => ipcRenderer.invoke('video-guide:overlay-collapse'),
  updateOverlayBounds: (payload) => ipcRenderer.invoke('video-guide:update-overlay-bounds', payload),
  controlBiliPlayer: (data) => ipcRenderer.send('video-guide:bili-control', data),
  reportPlaybackState: (data) => ipcRenderer.send('video-guide:playback-state', data),
  getBiliPages: (bvid) => ipcRenderer.invoke('video-guide:bili-pages', bvid),
  getVideoHistory: (userId) => ipcRenderer.invoke('video-guide:history-get', userId),
  recordVideoHistory: (userId, entry) => ipcRenderer.invoke('video-guide:history-record', { userId, ...entry }),
  removeVideoHistory: (userId, url) => ipcRenderer.invoke('video-guide:history-remove', { userId, url }),
  getVideoSettings: (userId) => ipcRenderer.invoke('video-guide:settings-get', userId),
  updateVideoSettings: (userId, settings) => ipcRenderer.invoke('video-guide:settings-set', { userId, settings }),
  onOverlayInit: (callback) => ipcRenderer.on('overlay:init', (_e, data) => callback(data)),
  onOverlayCollapsed: (callback) => ipcRenderer.on('overlay:collapsed', (_e, collapsed) => callback(collapsed)),
  onOverlayProgress: (callback) => ipcRenderer.on('overlay:progress', (_e, progress) => callback(progress))
})