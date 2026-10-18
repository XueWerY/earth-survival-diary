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
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  readBinaryFile: (filePath) => ipcRenderer.invoke('read-binary-file', filePath),
  writeBinaryFile: (filePath, base64) => ipcRenderer.invoke('write-binary-file', filePath, base64),
  ensureDirectory: (dirPath) => ipcRenderer.invoke('ensure-directory', dirPath),
  statFile: (filePath) => ipcRenderer.invoke('stat-file', filePath),
  pathExists: (targetPath) => ipcRenderer.invoke('path-exists', targetPath),
  readLocalData: (key) => ipcRenderer.invoke('local-data-read', key),
  writeLocalData: (key, value) => ipcRenderer.invoke('local-data-write', key, value),
  removeLocalData: (key) => ipcRenderer.invoke('local-data-remove', key),
  listLocalDataRecords: (prefix) => ipcRenderer.invoke('local-data-list', prefix),
  restartApp: () => ipcRenderer.send('restart-app'),
  getLogFileSize: () => ipcRenderer.invoke('get-log-file-size'),
  getLogDirSize: () => ipcRenderer.invoke('get-log-dir-size'),
  getLogContent: () => ipcRenderer.invoke('get-log-content'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  openLogViewer: (content) => ipcRenderer.invoke('open-log-viewer', content),
  openChangelogWindow: (content) => ipcRenderer.invoke('open-changelog-window', content),
  writeRendererLogs: (entries) => ipcRenderer.invoke('write-renderer-logs', entries),
  scheduleReminders: (userId, reminders, persistDuration, reason) => ipcRenderer.invoke('schedule-reminders', userId, reminders, persistDuration, reason),
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
  getLogDirPath: () => ipcRenderer.invoke('get-log-dir-path'),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  // 「选择本地 .md」应用内弹窗用的只读目录浏览（不走 read-directory 的路径白名单）
  listDirectoryForPicker: (dirPath, rootPath) => ipcRenderer.invoke('list-directory-for-picker', dirPath, rootPath),
  getPickerRoots: () => ipcRenderer.invoke('get-picker-roots'),
  deleteFilePath: (filePath) => ipcRenderer.invoke('delete-file-path', filePath),
  renameFilePath: (oldPath, newPath) => ipcRenderer.invoke('rename-file-path', oldPath, newPath),
  readTextFilePath: (filePath) => ipcRenderer.invoke('read-text-file-path', filePath),

  // 系统字体
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),

  // 剪贴板（用于 Electron 端粘贴系统剪贴板内容）
  readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
  readClipboardHTML: () => ipcRenderer.invoke('read-clipboard-html'),

  // 终端命令执行（PowerShell，输出经 powershell-output 事件流式回推）
  execPowerShell: (command) => ipcRenderer.invoke('exec-powershell', command),
  onPowerShellOutput: (callback) => ipcRenderer.on('powershell-output', (_event, data) => callback(data)),
  offPowerShellOutput: () => ipcRenderer.removeAllListeners('powershell-output'),
  killPowerShell: () => ipcRenderer.invoke('kill-powershell'),

  // 主进程 HTTPS 文本请求（下载插件源码等，返回 { status, text }）
  httpGetText: (url) => ipcRenderer.invoke('http-get-text', url),

  // 插件管理
  getPluginsDirPath: () => ipcRenderer.invoke('get-plugins-dir-path'),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  removeDirectory: (dirPath) => ipcRenderer.invoke('remove-directory', dirPath),
  getRuntimePluginManifests: () => ipcRenderer.invoke('get-runtime-plugin-manifests'),
  getRuntimePluginSource: (pluginId, toolId) => ipcRenderer.invoke('get-runtime-plugin-source', pluginId, toolId),
  recompilePlugins: () => ipcRenderer.invoke('recompile-plugins'),
})
