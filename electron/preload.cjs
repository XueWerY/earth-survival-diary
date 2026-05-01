const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, data) => callback(data)),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update')
})