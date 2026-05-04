const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, data) => callback(data)),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
})