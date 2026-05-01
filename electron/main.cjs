const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')

Menu.setApplicationMenu(null)

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow
let serverInstance = null
let updateDownloaded = false

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('update-available', (info) => {
  debugLog('[Updater] Update available: ' + info.version)
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'available', version: info.version })
  autoUpdater.downloadUpdate()
})

autoUpdater.on('download-progress', (progress) => {
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'downloading', percent: Math.floor(progress.percent) })
})

autoUpdater.on('update-downloaded', () => {
  updateDownloaded = true
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'downloaded' })
})

autoUpdater.on('error', (err) => {
  debugLog('[Updater] Error: ' + err.message)
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'error', message: err.message })
})

ipcMain.handle('check-for-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdates()
    return { updateAvailable: result?.updateInfo?.version !== app.getVersion() }
  } catch (e) {
    return { error: e.message }
  }
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})

const logFile = path.join(process.resourcesPath, 'electron-debug.log')
fs.writeFileSync(logFile, '[Electron] App started\n')

function debugLog(msg) {
  console.log(msg)
  try { fs.appendFileSync(logFile, msg + '\n') } catch (e) {}
}

function errorLog(msg) {
  console.error(msg)
  try { fs.appendFileSync(logFile, '[ERROR] ' + msg + '\n') } catch (e) {}
}

async function startServer() {
  debugLog('[Electron] Starting server in main process...')
  debugLog('[Electron] process.resourcesPath: ' + process.resourcesPath)

  const serverModulePath = path.join(__dirname, 'prod-server.cjs')
  debugLog('[Electron] serverModulePath: ' + serverModulePath)

  if (!fs.existsSync(serverModulePath)) {
    throw new Error('Server module not found at: ' + serverModulePath)
  }

  const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked')

  const { createProdServer } = require(serverModulePath)
  const { server } = createProdServer({
    port: 5000,
    dataDir: path.join(process.resourcesPath, 'data'),
    distPath: path.join(unpackedPath, 'dist'),
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
  debugLog('[Electron] Creating window: ' + url)
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

async function findViteServer() {
  const net = require('net')
  const PORTS = [5173, 5000, 5001, 5002, 5003, 5004, 5005]

  await new Promise(r => setTimeout(r, 3000))

  for (let attempt = 0; attempt < 30; attempt++) {
    for (const port of PORTS) {
      const result = await new Promise((resolve) => {
        const socket = new net.Socket()
        socket.setTimeout(300)
        socket.on('connect', () => { socket.end(); resolve(port) })
        socket.on('error', () => resolve(null))
        socket.on('timeout', () => { socket.destroy(); resolve(null) })
        socket.connect(port, 'localhost')
      })
      if (result) {
        return 'http://localhost:' + result
      }
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return null
}

ipcMain.on('resize-window', (event, width, height) => {
  if (mainWindow) {
    mainWindow.setSize(width, height)
  }
})

app.whenReady().then(async () => {
  debugLog('[Electron] App ready, isDev: ' + isDev)
  debugLog('[Electron] process.execPath: ' + process.execPath)
  debugLog('[Electron] process.resourcesPath: ' + process.resourcesPath)

  const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked')
  debugLog('[Electron] unpackedPath: ' + unpackedPath)
  debugLog('[Electron] unpackedPath exists: ' + fs.existsSync(unpackedPath))

  if (fs.existsSync(unpackedPath)) {
    const contents = fs.readdirSync(unpackedPath)
    debugLog('[Electron] unpackedPath contents: ' + JSON.stringify(contents))
  }

  try {
    let url
    if (isDev) {
      url = await findViteServer()
      if (!url) {
        errorLog('[Electron] Vite dev server not found')
        app.quit()
        return
      }
    } else {
      const port = await startServer()
      url = 'http://127.0.0.1:' + port
    }
    debugLog('[Electron] Loading URL: ' + url)
    createWindow(url)
    if (!isDev) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(e => debugLog('[Updater] Check failed: ' + e.message))
      }, 5000)
    }
  } catch (err) {
    errorLog('[Electron] Fatal error: ' + err.message)
    errorLog('[Electron] Stack: ' + err.stack)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (isDev) {
        createWindow('http://localhost:5173')
      } else {
        createWindow('http://127.0.0.1:5000')
      }
    }
  })
})

app.on('before-quit', async () => {
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
