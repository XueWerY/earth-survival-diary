const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')

Menu.setApplicationMenu(null)

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  console.error('[Electron] Failed to get single instance lock')
  app.quit()
}

let mainWindow
let serverProcess = null
let currentWindowWidth = 1200
let currentWindowHeight = 800

function startServer() {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process')

    let resourcesPath = process.resourcesPath || path.join(__dirname, '..')

    const nodeModulesPath = path.join(resourcesPath, 'node_modules')
    const serverEntryPath = path.join(resourcesPath, 'server', 'index.js')

    serverProcess = spawn('node', [serverEntryPath], {
      cwd: resourcesPath,
      env: {
        ...process.env,
        ELECTRON_RUN: '1',
        NODE_PATH: nodeModulesPath
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let serverUrl = null

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString()
      console.log('[Server]', output.trim())
      if (!serverUrl) {
        const match = output.match(/http:\/\/([\d.]+):(\d+)/)
        if (match) {
          serverUrl = `http://${match[1]}:${match[2]}`
          resolve(serverUrl)
        }
      }
    })

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString().trim())
    })

    serverProcess.on('error', (err) => {
      reject(err)
    })

    serverProcess.on('exit', (code) => {
      console.log(`[Server] Exited with code ${code}`)
    })

    setTimeout(() => {
      if (!serverUrl) {
        reject(new Error('Server startup timeout'))
      }
    }, 15000)
  })
}

function createWindow(url) {
  console.log('[Electron] Creating window:', url)
  mainWindow = new BrowserWindow({
    width: currentWindowWidth,
    height: currentWindowHeight,
    title: '地球 Online 生存日记',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  mainWindow.loadURL(url)

  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    console.error('[Electron] Page load failed:', code, desc)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
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
        return `http://localhost:${result}`
      }
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return null
}

ipcMain.on('resize-window', (event, width, height) => {
  if (mainWindow) {
    currentWindowWidth = width
    currentWindowHeight = height
    mainWindow.setSize(width, height)
  }
})

app.whenReady().then(async () => {
  console.log('[Electron] App ready, isDev:', isDev)
  let url
  if (isDev) {
    url = await findViteServer()
    if (!url) {
      console.error('[Electron] Vite dev server not found')
      app.quit()
      return
    }
    console.log('[Electron] Found Vite at:', url)
  } else {
    url = await startServer()
  }
  createWindow(url)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(url)
    }
  })
})

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill()
  }
})

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})