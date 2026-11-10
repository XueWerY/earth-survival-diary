type BridgeResult<T> = { value: T }
type BrowserReminder = { id: string; name: string; body?: string; triggerTime?: string; repeatStrategy?: string }

async function invoke<T>(method: string, ...args: unknown[]): Promise<T> {
  const response = await fetch('/__esd/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  })
  const payload = await response.json() as BridgeResult<T> & { error?: string }
  if (!response.ok) throw new Error(payload.error || `本机服务请求失败（${response.status}）`)
  return payload.value
}

async function uploadFile(file: File, mimeType: string, fileName: string, scope: string): Promise<string | null> {
  const query = new URLSearchParams({ mimeType, fileName, scope })
  const response = await fetch(`/__esd/media/save?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': mimeType || 'application/octet-stream' },
    body: file,
  })
  const payload = await response.json() as { reference?: string; error?: string }
  if (!response.ok) throw new Error(payload.error || `媒体保存失败（${response.status}）`)
  return payload.reference || null
}

let showReminder: ((reminder: BrowserReminder) => void) | null = null
const reminderTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearReminderTimers() {
  for (const timer of reminderTimers.values()) clearTimeout(timer)
  reminderTimers.clear()
}

async function scheduleBrowserReminders(reminders: BrowserReminder[]) {
  clearReminderTimers()
  for (const reminder of reminders) {
    const timestamp = Date.parse(String(reminder.triggerTime || ''))
    if (!Number.isFinite(timestamp)) continue
    const delay = Math.max(0, Math.min(timestamp - Date.now(), 2_147_000_000))
    const timer = setTimeout(() => {
      reminderTimers.delete(reminder.id)
      showReminder?.(reminder)
    }, delay)
    reminderTimers.set(reminder.id, timer)
  }
  return { ok: true, count: reminderTimers.size }
}

/** Install the browser-to-local-Node bridge while keeping the existing renderer APIs intact. */
export function installBrowserBridge(): void {
  if (typeof window === 'undefined' || window.electronAPI) return
  const api = {
    readLocalData: (key: string) => invoke<{ found: boolean; value?: unknown }>('local-data-read', key),
    writeLocalData: (key: string, value: unknown) => invoke<boolean>('local-data-write', key, value),
    removeLocalData: (key: string) => invoke<boolean>('local-data-remove', key),
    listLocalDataRecords: (prefix: string) => invoke<Array<{ key: string; value: unknown }>>('local-data-list', prefix),
    listLocalDataKeys: (prefix: string) => invoke<string[]>('local-data-list-keys', prefix),
    getNotesLibraryInfo: (scope: string) => invoke('notes-library-info', scope),
    readPinnedNoteTabIds: (scope: string, libraryId: string) => invoke<string[]>('read-pinned-note-tab-ids', scope, libraryId),
    writePinnedNoteTabIds: (scope: string, libraryId: string, ids: string[]) => invoke<boolean>('write-pinned-note-tab-ids', scope, libraryId, ids),
    readFavoriteNoteFolderPaths: (scope: string, libraryId: string) => invoke<string[]>('read-favorite-note-folder-paths', scope, libraryId),
    writeFavoriteNoteFolderPaths: (scope: string, libraryId: string, paths: string[]) => invoke<boolean>('write-favorite-note-folder-paths', scope, libraryId, paths),
    selectNotesLibraryFolder: (scope: string) => invoke('select-notes-library-folder', scope),
    switchNotesLibrary: (scope: string, libraryId: string) => invoke('switch-notes-library', scope, libraryId),
    removeUnavailableNotesLibrary: (scope: string, libraryId: string) => invoke('remove-unavailable-notes-library', scope, libraryId),
    createNotesFolder: (scope: string, folderPath: string) => invoke('create-notes-folder', scope, folderPath),
    renameNotesFolder: (scope: string, oldPath: string, newPath: string) => invoke('rename-notes-folder', scope, oldPath, newPath),
    duplicateNotesFolder: (scope: string, sourcePath: string, targetPath: string) => invoke('duplicate-notes-folder', scope, sourcePath, targetPath),
    deleteNotesFolder: (scope: string, folderPath: string) => invoke('delete-notes-folder', scope, folderPath),
    openNoteLibraryPath: (scope: string, relativePath: string) => invoke<boolean>('open-note-library-path', scope, relativePath),
    revealNoteLibraryPath: (scope: string, relativePath: string) => invoke<boolean>('reveal-note-library-path', scope, relativePath),
    getNoteLibraryNotePath: (scope: string, noteId: string) => invoke<string>('get-note-library-note-path', scope, noteId),
    exportNotePdf: (title: string, html: string, settings: Record<string, unknown>) => invoke<string>('export-note-pdf', title, html, settings),
    savePickedMediaFile: uploadFile,
    beginPickedMediaUpload: async (options: unknown) => {
      const response = await fetch('/__esd/upload/begin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ options }) })
      const payload = await response.json() as { uploadId?: string; error?: string }
      if (!response.ok || !payload.uploadId) throw new Error(payload.error || '无法开始媒体上传')
      return payload.uploadId
    },
    appendPickedMediaUploadChunk: async (uploadId: string, chunk: ArrayBuffer | Uint8Array) => {
      const response = await fetch(`/__esd/upload/chunk/${encodeURIComponent(uploadId)}`, { method: 'POST', body: chunk as BodyInit })
      const payload = await response.json() as { loaded?: number; error?: string }
      if (!response.ok) throw new Error(payload.error || '媒体分块保存失败')
      return Number(payload.loaded || 0)
    },
    finishPickedMediaUpload: (uploadId: string, callback: (result: { uploadId: string; reference?: string; error?: string }) => void) => {
      const controller = new AbortController()
      fetch(`/__esd/upload/finish/${encodeURIComponent(uploadId)}`, { method: 'POST', signal: controller.signal })
        .then(async response => ({ response, payload: await response.json() as { uploadId?: string; reference?: string; error?: string } }))
        .then(({ response, payload }) => callback(response.ok
          ? { uploadId, ...(payload.reference ? { reference: payload.reference } : {}) }
          : { uploadId, error: payload.error || `媒体保存失败（${response.status}）` }))
        .catch(error => {
          if (!controller.signal.aborted) callback({ uploadId, error: error instanceof Error ? error.message : String(error) })
        })
      return () => controller.abort()
    },
    cancelPickedMediaUpload: (uploadId: string) => fetch(`/__esd/upload/cancel/${encodeURIComponent(uploadId)}`, { method: 'POST' }).then(response => response.ok),
    onMediaSaveProgress: () => () => {},
    reportMediaUploadCheckpoint: (stage: string, details?: Record<string, unknown>) => console.info(`[媒体上传] ${stage}`, details || ''),
    getLocalMediaAssetUrl: (scope: string, assetId: string) => invoke<string | null>('get-local-media-asset-url', scope, assetId),
    updateLocalMediaAssetMetadata: (scope: string, assetId: string, metadata: unknown) => invoke('update-local-media-asset-metadata', scope, assetId, metadata),
    openExternal: async (url: string) => { window.open(url, '_blank', 'noopener,noreferrer') },
    getScreenInfo: async () => ({ width: window.screen.width, height: window.screen.height, scaleFactor: window.devicePixelRatio || 1, physicalWidth: window.screen.width, physicalHeight: window.screen.height }),
    getWindowSize: async () => null,
    setWindowSize: async () => false,
    applyWindowSize: async () => false,
    resizeWindow: () => {},
    onUpdateStatus: () => {},
    checkForUpdate: () => invoke('check-for-update'),
    downloadUpdate: () => invoke('download-update'),
    installUpdate: async () => {},
    saveFileDialog: () => invoke('save-file-dialog'),
    openFileDialog: () => invoke('open-file-dialog'),
    openDirectory: () => invoke('open-directory'),
    readFile: (filePath: string) => invoke<string | null>('read-file', filePath),
    writeFile: (filePath: string, content: string) => invoke<boolean>('write-file', filePath, content),
    readBinaryFile: (filePath: string) => invoke<string | null>('read-binary-file', filePath),
    writeBinaryFile: (filePath: string, content: string | Uint8Array) => invoke<boolean>('write-binary-file', filePath, content),
    ensureDirectory: (dirPath: string) => invoke<boolean>('ensure-directory', dirPath),
    statFile: (filePath: string) => invoke('stat-file', filePath),
    pathExists: (filePath: string) => invoke<boolean>('path-exists', filePath),
    restartApp: () => window.location.reload(),
    getLogFileSize: () => invoke('get-log-file-size'),
    getLogDirSize: () => invoke('get-log-dir-size'),
    getLogContent: () => invoke<string>('get-log-content'),
    clearLogs: () => invoke<boolean>('clear-logs'),
    openLogViewer: (content: string) => invoke<boolean>('open-log-viewer', content),
    openChangelogWindow: (content: string) => invoke<boolean>('open-changelog-window', content),
    writeRendererLogs: (entries: unknown[]) => fetch('/__esd/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entries) }).then(response => response.ok),
    scheduleReminders: (userId: string, reminders: BrowserReminder[]) => scheduleBrowserReminders(reminders),
    cancelAllReminders: async () => { clearReminderTimers(); return { ok: true } },
    getReminderPersistDuration: () => invoke('get-reminder-persist-duration'),
    getAllReminders: async () => [],
    onShowReminder: (callback: (reminder: BrowserReminder) => void) => { showReminder = callback },
    setAutoLaunch: async () => false,
    getAutoLaunch: async () => false,
    setCloseAction: async () => false,
    getCloseAction: async () => 'exit',
    setWindowTitle: async () => true,
    getLogDirPath: () => invoke<string>('get-log-dir-path'),
    readDirectory: (dirPath: string) => invoke('read-directory', dirPath),
    listDirectoryForPicker: (dirPath: string) => invoke('list-directory-for-picker', dirPath),
    getPickerRoots: async () => [],
    deleteFilePath: (filePath: string) => invoke<boolean>('delete-file-path', filePath),
    renameFilePath: (oldPath: string, newPath: string) => invoke<boolean>('rename-file-path', oldPath, newPath),
    readTextFilePath: (filePath: string) => invoke<string>('read-text-file-path', filePath),
    getSystemFonts: async () => [],
    readClipboardText: async () => await navigator.clipboard?.readText().catch(() => '') || '',
    readClipboardHTML: async () => '',
    execPowerShell: (command: string) => invoke('exec-powershell', command),
    onPowerShellOutput: () => {},
    offPowerShellOutput: () => {},
    killPowerShell: () => invoke('kill-powershell'),
    httpGetText: (url: string) => invoke('http-get-text', url),
    getPluginsDirPath: () => invoke<string>('get-plugins-dir-path'),
    createDirectory: (dirPath: string) => invoke<boolean>('create-directory', dirPath),
    removeDirectory: (dirPath: string) => invoke<boolean>('remove-directory', dirPath),
    getRuntimePluginManifests: () => invoke<unknown[]>('get-runtime-plugin-manifests'),
    getRuntimePluginSource: (pluginId: string, toolId: string) => invoke<string>('get-runtime-plugin-source', pluginId, toolId),
    recompilePlugins: () => invoke<boolean>('recompile-plugins'),
  }
  window.electronAPI = api as unknown as Window['electronAPI']
  window.__ESD_DESKTOP__ = false
}
