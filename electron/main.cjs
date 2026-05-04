const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

Menu.setApplicationMenu(null)

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow
let updateWindow = null
let serverInstance = null

autoUpdater.autoDownload = false

function sendUpdateStatus(data) {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.webContents.send('update-status', data)
  }
}

function createUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.focus()
    return
  }
  updateWindow = new BrowserWindow({
    width: 380,
    height: 320,
    resizable: false,
    title: '更新',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })
  updateWindow.setMenuBarVisibility(false)
  updateWindow.loadFile(path.join(__dirname, 'update.html'))

  updateWindow.on('closed', () => {
    updateWindow = null
    if (mainWindow) {
      mainWindow.show()
    }
  })
}

autoUpdater.on('update-available', (info) => {
  debugLog('[Updater] Update available: ' + info.version)
  createUpdateWindow()
  if (mainWindow) mainWindow.hide()
  sendUpdateStatus({ status: 'available', version: info.version })
})

autoUpdater.on('error', (err) => {
  debugLog('[Updater] Error: ' + err.message)
  sendUpdateStatus({ status: 'error', message: err.message })
})

ipcMain.handle('check-for-update', async () => {
  createUpdateWindow()
  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result || result.updateInfo.version === app.getVersion()) {
      sendUpdateStatus({ status: 'no-update' })
      return { updateAvailable: false }
    }
    sendUpdateStatus({ status: 'available', version: result.updateInfo.version })
    return { updateAvailable: true, version: result.updateInfo.version }
  } catch (e) {
    sendUpdateStatus({ status: 'error', message: e.message })
    return { error: e.message }
  }
})

ipcMain.handle('open-external', async (_event, url) => {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.close()
  }
  await shell.openExternal(url)
})

const logFile = path.join(app.getPath('userData'), 'logs', 'app-' + new Date().toISOString().slice(0, 10) + '.log')
const p = (n, l = 2) => String(n).padStart(l, '0')
const formatTs = () => { const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}:${p(d.getMilliseconds(), 3)}` }

function debugLog(msg) {
  console.log(msg)
  try {
    const dir = path.dirname(logFile)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(logFile, `[${formatTs()}] [DEBUG] ${msg}\n`)
  } catch (e) {}
}

function errorLog(msg) {
  console.error(msg)
  try {
    const dir = path.dirname(logFile)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(logFile, `[${formatTs()}] [ERROR] ${msg}\n`)
  } catch (e) {}
}

async function startServer() {
  debugLog('[Electron] Starting server...')

  const serverModulePath = path.join(__dirname, 'prod-server.cjs')
  if (!fs.existsSync(serverModulePath)) {
    throw new Error('Server module not found at: ' + serverModulePath)
  }

  const asarDistPath = path.join(process.resourcesPath, 'app.asar', 'dist')

  const { createProdServer } = require(serverModulePath)
  const { server } = createProdServer({
    port: 5000,
    dataDir: path.join(app.getPath('userData'), 'data'),
    distPath: asarDistPath,
    resourcesPath: process.resourcesPath
  })

  return new Promise((resolve, reject) => {
    server.listen(5000, '127.0.0.1', () => {
      debugLog('[Electron] Server started on port 5000')
      serverInstance = server
      resolve(5000)
    })
    server.on('error', (err) => {
      errorLog('[Electron] Server listen error: ' + err.message)
      reject(err)
    })
  })
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: '地球 Online 生存日记',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  mainWindow.loadURL(url)

  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    errorLog('[Electron] Page load failed: ' + code + ' ' + desc)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.show()
}

ipcMain.on('resize-window', (event, width, height) => {
  if (mainWindow) {
    mainWindow.setSize(width, height)
  }
})

app.whenReady().then(async () => {
  const sep = '─'.repeat(60)
  const dir = path.dirname(logFile)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(logFile, `\n${sep}\n[${formatTs()}] [INFO] ===== 应用启动 =====\n${sep}\n`)
  debugLog('[Electron] App ready')

  try {
    const oldDataDir = path.join(process.resourcesPath, 'data')
    const newDataDir = path.join(app.getPath('userData'), 'data')
    if (fs.existsSync(oldDataDir) && !fs.existsSync(newDataDir)) {
      try {
        fs.mkdirSync(app.getPath('userData'), { recursive: true })
        fs.renameSync(oldDataDir, newDataDir)
        debugLog('[Electron] Data migrated to userData: ' + newDataDir)
      } catch (e) {
        errorLog('[Electron] Data migration failed: ' + e.message)
      }
    }
    const port = await startServer()
    const url = 'http://127.0.0.1:' + port
    debugLog('[Electron] Loading URL: ' + url)
    createWindow(url)

    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(e => debugLog('[Updater] Check failed: ' + e.message))
    }, 5000)
  } catch (err) {
    errorLog('[Electron] Fatal error: ' + err.message)
    errorLog('[Electron] Stack: ' + err.stack)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow('http://127.0.0.1:5000')
    }
  })
})

app.on('before-quit', async () => {
  debugLog('[Electron] 应用已关闭')
  if (serverInstance) {
    try { serverInstance.close() } catch (e) {}
  }
})

app.on('window-all-closed', () => {
  if (serverInstance) {
    try { serverInstance.close() } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
