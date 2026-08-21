const { app, BrowserWindow, Menu, ipcMain, shell, dialog, Tray, screen, clipboard, globalShortcut, net, session } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
// esbuild 二进制打包后位于 app.asar 内（asar 不可执行），主进程 spawn 会 ENOENT。
// extraResources 已把真实二进制复制到 resources/node_modules/@esbuild/win32-x64/esbuild.exe，
// 这里在 require('esbuild') 之前用 ESBUILD_BINARY_PATH 指向它（esbuild 模块加载时读取该变量）。
const esbuildBinaryPath = path.join(process.resourcesPath, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe')
if (fs.existsSync(esbuildBinaryPath)) {
  process.env.ESBUILD_BINARY_PATH = esbuildBinaryPath
}
const { spawn, execSync } = require('child_process')
let autoUpdater = null

Menu.setApplicationMenu(null)

let appTray = null
let closeAction = 'minimize'
let isQuitting = false

function getCloseAction() {
  const settingsPath = path.join(app.getPath('userData'), 'close-settings.json')
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      return settings.closeAction || 'minimize'
    } catch {}
  }
  return 'minimize'
}

function saveCloseAction(action) {
  const settingsPath = path.join(app.getPath('userData'), 'close-settings.json')
  fs.writeFileSync(settingsPath, JSON.stringify({ closeAction: action }, null, 2), 'utf-8')
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  debugLog('[Main] Another instance is already running, exiting current instance')
  app.quit()
} else {
  app.on('second-instance', () => {
    debugLog('[Main] Received second instance request, showing main window')
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.setSkipTaskbar(false)
      mainWindow.focus()
    }
  })
}

let mainWindow
let serverInstance = null
let serverPort = 5000

// ====== 窗口分辨率设置 ======
function getUserSettingsPath(userId) {
  return path.join(DATA_DIR, userId, 'settings', 'settings.json')
}

function readUserSettings(userId) {
  const p = getUserSettingsPath(userId)
  if (!fs.existsSync(p)) return {}
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return {} }
}

function writeUserSettings(userId, settings) {
  const p = getUserSettingsPath(userId)
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf-8')
}

ipcMain.handle('get-screen-info', async () => {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size
  const scaleFactor = primaryDisplay.scaleFactor
  // width/height 与 BrowserWindow setSize/constructor 单位一致
  // 同时返回物理值（乘缩放因子）供前端展示用
  return {
    width,
    height,
    scaleFactor,
    physicalWidth: Math.round(width * scaleFactor - 0.001),
    physicalHeight: Math.round(height * scaleFactor - 0.001)
  }
})

ipcMain.handle('set-window-size', async (_event, userId, w, h) => {
  if (mainWindow) {
    const display = screen.getPrimaryDisplay()
    const { width: maxW, height: maxH } = display.size
    const scaleFactor = display.scaleFactor
    // w=0,h=0 表示全屏有边框模式
    const isBordered = w === 0 && h === 0
    // w/h 的单位与 display.size 一致，直接比较
    const isMax = !isBordered && w >= maxW - 1 && h >= maxH - 1

    // 保存物理分辨率（前端展示用）
    const settings = readUserSettings(userId)
    if (isBordered) {
      settings.windowSize = { width: Math.round(maxW * scaleFactor), height: Math.round(maxH * scaleFactor), mode: 'bordered' }
    } else {
      settings.windowSize = { width: Math.round(w * scaleFactor), height: Math.round(h * scaleFactor) }
    }
    writeUserSettings(userId, settings)

    if (isBordered) {
      // 全屏有边框：最大化窗口，保留边框和标题栏
      if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false)
      mainWindow.setResizable(true)
      mainWindow.maximize()
      mainWindow.setResizable(false)
    } else if (isMax) {
      // 临时启用可调整，防止 resizable:false 时 setFullScreen 无效
      mainWindow.setResizable(true)
      if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true)
      mainWindow.setResizable(false)
    } else {
      if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false)
      // 临时启用可调整，确保 setSize 生效，防止 resizable:false 时 setSize 无效
      mainWindow.setResizable(true)
      mainWindow.setSize(w, h)
      mainWindow.setResizable(false)
      mainWindow.setPosition(
        Math.round((maxW - w) / 2),
        Math.round((maxH - h) / 2)
      )
    }
  }
  return true
})

ipcMain.handle('get-window-size', async (_event, userId) => {
  if (!userId) return null
  const settings = readUserSettings(userId)
  return settings.windowSize || null
})

ipcMain.handle('apply-window-size', async (_event, userId) => {
  if (!mainWindow || !userId) return false
  const settings = readUserSettings(userId)
  if (!settings.windowSize) return false

  const isBordered = settings.windowSize.mode === 'bordered'
  const { width: savedPhysW, height: savedPhysH } = settings.windowSize
  const display = screen.getPrimaryDisplay()
  const { width: maxW, height: maxH } = display.size
  const scaleFactor = display.scaleFactor

  if (isBordered) {
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false)
    mainWindow.setResizable(true)
    mainWindow.maximize()
    mainWindow.setResizable(false)
    return true
  }

  // 物理值转回逻辑值，与 set-window-size 存储时的转换相反
  const logicalW = Math.round(savedPhysW / scaleFactor)
  const logicalH = Math.round(savedPhysH / scaleFactor)

  const isMax = logicalW >= maxW - 1 && logicalH >= maxH - 1
  if (isMax) {
    // 窗口已在 createWindow 中以全屏尺寸创建，只需进入全屏模式（无边框）
    // 临时启用可调整，防止 resizable:false 时 setFullScreen 无效
    mainWindow.setResizable(true)
    if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true)
    mainWindow.setResizable(false)
  } else {
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false)
    mainWindow.setResizable(true)
    mainWindow.setSize(logicalW, logicalH)
    mainWindow.setResizable(false)
    mainWindow.setPosition(
      Math.round((maxW - logicalW) / 2),
      Math.round((maxH - logicalH) / 2)
    )
  }
  return true
})
// ====== 窗口分辨率设置结束 ======

ipcMain.on('restart-app', () => { 
  debugLog('[Main] Received restart request')
  closeAction = 'exit'
  app.relaunch()
  app.quit()
})

ipcMain.handle('set-auto-launch', async (_event, enable) => {
  try {
    app.setLoginItemSettings({ openAtLogin: enable })
    debugLog('[Main] Set auto-launch', { enabled: enable })
    return true
  } catch (e) {
    errorLog('[Main] Failed to set auto-launch: ' + e.message)
    return false
  }
})

ipcMain.handle('get-auto-launch', async () => {
  try {
    const settings = app.getLoginItemSettings()
    return settings.openAtLogin || false
  } catch {
    return false
  }
})

ipcMain.handle('set-close-action', async (_event, action) => {
  closeAction = action
  saveCloseAction(action)
  debugLog('[Main] Set close button behavior', { action })
  return true
})

ipcMain.handle('get-close-action', async () => {
  return closeAction
})

ipcMain.handle('set-window-title', async (_event, title) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(title)
  }
  return true
})

function ensureAutoUpdater() {
  if (autoUpdater) return autoUpdater
  autoUpdater = require('electron-updater').autoUpdater
  autoUpdater.autoDownload = false
  autoUpdater.channel = 'latest'

  autoUpdater.on('update-available', (info) => {
    debugLog('[Main] autoUpdater: New version detected ' + info.version)
    sendUpdateStatusToMain({ status: 'available', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    debugLog('[Main] autoUpdater error: ' + err.message)
    sendUpdateStatusToMain({ status: 'error', message: err.message })
  })

  return autoUpdater
}

function sendUpdateStatusToMain(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', data)
  } else {
    debugLog('[Main] mainWindow is not available, cannot send update status')
  }
}



// ========== 跨平台版本检测（从发布文件名提取版本号） ==========
const RELEASES_API = 'https://api.github.com/repos/XueWerY/earth-survival-diary/releases'
/** 从构建产物文件名中提取版本号，如 Earth-Survival-Diary-Setup-2026.7.18-20.exe */
function extractVersionFromFilename(filename) {
  const match = filename.match(/Earth-Survival-Diary(?:-Setup)?-(\d{4}\.\d{1,2}\.\d{1,2}-\d+)/)
  return match ? match[1] : null
}
/** 解析 YYYY.M.DD-X 版本号为可比较对象 */
function parseVersion(version) {
  const match = version.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})-(\d+)$/)
  if (!match) return null
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
    patch: parseInt(match[4], 10)
  }
}
/** 比较两个版本号：负数=v1<v2, 0=相等, 正数=v1>v2 */
function compareVersions(v1, v2) {
  const a = parseVersion(v1), b = parseVersion(v2)
  if (!a || !b) return v1.localeCompare(v2)
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  if (a.day !== b.day) return a.day - b.day
  return a.patch - b.patch
}
/** 通过 GitHub Releases API 检查更新（从资产文件名提取版本号） */
async function fetchLatestFromReleases() {
  return new Promise((resolve, reject) => {
    const url = new URL(RELEASES_API)
    const opts = { hostname: url.hostname, path: url.pathname, headers: { 'User-Agent': 'earth-survival-diary' } }
    https.get(opts, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          const releases = JSON.parse(body)
          if (!Array.isArray(releases)) return resolve(null)
          let bestVersion = null; let bestUrl = null
          for (const release of releases) {
            if (release.prerelease) continue
            for (const asset of (release.assets || [])) {
              if (!asset.name.endsWith('.exe')) continue
              const v = extractVersionFromFilename(asset.name)
              if (!v) continue
              if (!bestVersion || compareVersions(v, bestVersion) > 0) {
                bestVersion = v; bestUrl = asset.browser_download_url
              }
            }
          }
          resolve(bestVersion ? { version: bestVersion, downloadUrl: bestUrl } : null)
        } catch { resolve(null) }
      })
    }).on('error', (e) => reject(e))
  })
}

ipcMain.handle('check-for-update', async () => {
  debugLog('[Main] Received manual update check request')
  try {
    const latest = await fetchLatestFromReleases()
    const currentVersion = app.getVersion()
    if (!latest) {
      debugLog('[Main] No release assets found')
      sendUpdateStatusToMain({ status: 'no-update' })
      return { updateAvailable: false }
    }
    if (compareVersions(latest.version, currentVersion) <= 0) {
      debugLog('[Main] Already up to date: ' + currentVersion)
      sendUpdateStatusToMain({ status: 'no-update' })
      return { updateAvailable: false }
    }
    debugLog('[Main] New version found: ' + latest.version)
    sendUpdateStatusToMain({ status: 'available', version: latest.version, downloadUrl: latest.downloadUrl })
    return { updateAvailable: true, version: latest.version }
  } catch (e) {
    debugLog('[Main] Update check failed: ' + e.message)
    sendUpdateStatusToMain({ status: 'error', message: e.message })
    return { error: e.message }
  }
})

ipcMain.handle('open-external', async (_event, url) => {
  debugLog('[Main] Opening external link: ' + url)
  await shell.openExternal(url)
})

// 启动时清理更新安装包：安装包下载到系统临时目录（app.getPath('temp')），
// 更新安装完成并启动新版本后遗留的安装包在此删除
function cleanupUpdateInstallers() {
  try {
    const tempDir = app.getPath('temp')
    for (const f of fs.readdirSync(tempDir)) {
      if (/^Earth-Survival-Diary-Setup.*\.exe$/i.test(f)) {
        try {
          fs.unlinkSync(path.join(tempDir, f))
          debugLog('[Main] 已删除更新安装包: ' + f)
        } catch (e) {
          debugLog('[Main] 删除安装包失败: ' + f + ' - ' + e.message)
        }
      }
    }
  } catch (e) {
    debugLog('[Main] 清理安装包目录失败: ' + e.message)
  }
}

// 下载更新安装包（回传进度并自动打开安装程序；net.request 使用 Chromium 网络栈，自动遵循系统代理，有代理时下载走代理）
ipcMain.handle('download-update', async (_event, downloadUrl) => {
  debugLog('[Main] Downloading update from: ' + downloadUrl)
  // 检测系统代理（仅记录，net.request 自动使用系统代理）
  try {
    const proxy = await session.defaultSession.resolveProxy(downloadUrl)
    debugLog('[Main] System proxy for update download: ' + proxy)
  } catch (e) {
    debugLog('[Main] Proxy detection failed: ' + e.message)
  }
  return new Promise((resolve) => {
    const fileName = path.basename(new URL(downloadUrl).pathname) || 'Earth-Survival-Diary-Setup.exe'
    const filePath = path.join(app.getPath('temp'), fileName)
    const request = net.request({ url: downloadUrl, useSessionCookies: false, redirect: 'follow', headers: { 'User-Agent': 'earth-survival-diary' } })
    request.on('response', (res) => {
      if (res.statusCode !== 200) {
        const msg = '下载失败，HTTP 状态码 ' + res.statusCode
        debugLog('[Main] ' + msg)
        sendUpdateStatusToMain({ status: 'error', message: msg })
        return resolve({ ok: false, error: msg })
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      const fileStream = fs.createWriteStream(filePath)
      let received = 0
      let lastPercent = -1
      res.on('data', (chunk) => {
        received += chunk.length
        if (total > 0) {
          const percent = Math.floor((received / total) * 100)
          if (percent !== lastPercent) {
            lastPercent = percent
            sendUpdateStatusToMain({ status: 'downloading', percent })
          }
        }
      })
      res.pipe(fileStream)
      fileStream.on('finish', () => {
        fileStream.close()
        debugLog('[Main] Update downloaded to: ' + filePath)
        sendUpdateStatusToMain({ status: 'downloaded' })
        // 打开安装程序后退出应用
        shell.openPath(filePath).then((err) => {
          if (err) {
            debugLog('[Main] Failed to open installer: ' + err)
            sendUpdateStatusToMain({ status: 'error', message: '无法打开安装程序：' + err })
            return
          }
          isQuitting = true
          app.quit()
        })
        resolve({ ok: true })
      })
      fileStream.on('error', (e) => {
        debugLog('[Main] Write installer failed: ' + e.message)
        sendUpdateStatusToMain({ status: 'error', message: e.message })
        resolve({ ok: false, error: e.message })
      })
    })
    request.on('error', (e) => {
      debugLog('[Main] Download request error: ' + e.message)
      sendUpdateStatusToMain({ status: 'error', message: e.message })
      resolve({ ok: false, error: e.message })
    })
    request.end()
  })
})

ipcMain.handle('save-file-dialog', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
    defaultPath: options.defaultPath,
    filters: options.filters || [{ name: 'JSON', extensions: ['json'] }]
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('open-file-dialog', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
    properties: ['openFile'],
    filters: options.filters || [{ name: 'JSON', extensions: ['json'] }]
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('open-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    console.error('Read file error:', e)
    return null
  }
})

ipcMain.handle('write-file', async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (e) {
    console.error('Write file error:', e)
    return false
  }
})

// ====== 文件管理器 IPC ======
const PLUGINS_DIR = app.isPackaged
  ? path.join(app.getPath('userData'), 'plugins')
  : path.join(__dirname, '..', 'src', 'plugins')

/** snowbaby 框架目录：不再内置，改为安装到 userData（即 %APPDATA%/earth-survival-diary/snowbaby），不硬编码用户名 */
const SNOWBABY_DIR = path.join(app.getPath('userData'), 'snowbaby')

const ALLOWED_DIRS = [
  path.join(app.getPath('userData'), 'data'),
  path.join(app.getPath('userData'), 'logs'),
  PLUGINS_DIR
]

function isPathAllowed(targetPath) {
  const resolved = path.resolve(targetPath)
  return ALLOWED_DIRS.some(dir => resolved.startsWith(dir + path.sep) || resolved === dir)
}

ipcMain.handle('get-data-dir-path', async () => {
  return path.join(app.getPath('userData'), 'data')
})

ipcMain.handle('get-log-dir-path', async () => {
  return path.join(app.getPath('userData'), 'logs')
})

ipcMain.handle('read-directory', async (_event, dirPath) => {
  try {
    if (!isPathAllowed(dirPath)) throw new Error('Access denied: directory not allowed')
    if (!fs.existsSync(dirPath)) return []
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      size: entry.isFile() ? fs.statSync(path.join(dirPath, entry.name)).size : 0
    }))
  } catch (e) {
    errorLog('[FileManager] read-directory failed: ' + e.message)
    throw e
  }
})

ipcMain.handle('delete-file-path', async (_event, filePath) => {
  try {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: directory not allowed')
    if (!fs.existsSync(filePath)) throw new Error('File does not exist')
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true })
    } else {
      fs.unlinkSync(filePath)
    }
    return true
  } catch (e) {
    errorLog('[FileManager] delete-file-path failed: ' + e.message)
    throw e
  }
})

ipcMain.handle('rename-file-path', async (_event, oldPath, newPath) => {
  try {
    if (!isPathAllowed(oldPath)) throw new Error('访问被拒绝：不允许的目录')
    if (!isPathAllowed(newPath)) throw new Error('Target path is not allowed')
    if (!fs.existsSync(oldPath)) throw new Error('文件不存在')
    fs.renameSync(oldPath, newPath)
    return true
  } catch (e) {
    errorLog('[FileManager] rename-file-path failed: ' + e.message)
    throw e
  }
})

ipcMain.handle('read-text-file-path', async (_event, filePath) => {
  try {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: directory not allowed')
    if (!fs.existsSync(filePath)) throw new Error('File does not exist')
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    errorLog('[FileManager] read-text-file-path failed: ' + e.message)
    throw e
  }
})

ipcMain.handle('get-plugins-dir-path', async () => {
  return PLUGINS_DIR
})

ipcMain.handle('get-snowbaby-dir-path', async () => {
  return SNOWBABY_DIR
})

// ====== snowbaby 安装管理（远程从 https://github.com/XueWerY/snowbaby 拉取代码到 userData/snowbaby） ======
const SNOWBABY_REPO = 'https://github.com/XueWerY/snowbaby'

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d.toString() })
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(err.trim() || ('git ' + args.join(' ') + ' 失败，退出码 ' + code)))
    })
  })
}

function hasGit() {
  return new Promise((resolve) => {
    const child = spawn('git', ['--version'])
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

async function getSnowbabyStatus() {
  try {
    const pkgPath = path.join(SNOWBABY_DIR, 'package.json')
    if (!fs.existsSync(pkgPath)) return { installed: false, version: null }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return { installed: true, version: pkg.version || null }
  } catch (e) {
    return { installed: false, version: null }
  }
}

ipcMain.handle('snowbaby-get-status', async () => getSnowbabyStatus())

ipcMain.handle('snowbaby-install', async () => {
  try {
    if (fs.existsSync(SNOWBABY_DIR)) return { success: false, error: 'snowbaby 目录已存在，无需重复安装' }
    if (!(await hasGit())) return { success: false, error: '未检测到 git，无法安装 snowbaby' }
    await runGit(['clone', SNOWBABY_REPO, SNOWBABY_DIR])
    return { success: true }
  } catch (e) {
    errorLog('[snowbaby] 安装失败: ' + e.message)
    return { success: false, error: e.message }
  }
})

ipcMain.handle('snowbaby-update', async () => {
  try {
    if (!fs.existsSync(path.join(SNOWBABY_DIR, '.git'))) {
      return { success: false, error: '非 git 方式安装，无法更新' }
    }
    const out = await runGit(['pull'], SNOWBABY_DIR)
    const upToDate = /Already up to date\./i.test(out)
    return { success: true, upToDate }
  } catch (e) {
    errorLog('[snowbaby] 更新失败: ' + e.message)
    return { success: false, error: e.message }
  }
})

ipcMain.handle('snowbaby-uninstall', async () => {
  try {
    if (snowbabyProcess && !snowbabyProcess.killed) {
      const child = snowbabyProcess
      snowbabyProcess = null
      try { child.kill('SIGTERM') } catch (_) {}
    }
    if (fs.existsSync(SNOWBABY_DIR)) {
      fs.rmSync(SNOWBABY_DIR, { recursive: true, force: true })
    }
    return { success: true }
  } catch (e) {
    errorLog('[snowbaby] 卸载失败: ' + e.message)
    return { success: false, error: e.message }
  }
})

// ====== snowbaby 进程管理（主进程 spawn node，捕获其 stdout/stderr 实时回推渲染进程） ======
let snowbabyProcess = null

ipcMain.handle('snowbaby-start', async (_event, payload) => {
  const { pluginDir } = payload || {}
  try {
    if (!fs.existsSync(SNOWBABY_DIR)) {
      return { success: false, error: 'snowbaby 尚未安装，请先安装' }
    }
    if (snowbabyProcess && !snowbabyProcess.killed) {
      return { success: false, error: 'snowbaby 已在运行' }
    }
    const child = spawn('node', ['app.js'], {
      cwd: pluginDir || SNOWBABY_DIR,
      env: { ...process.env },
      windowsHide: true
    })
    snowbabyProcess = child
    const send = (stream, text) => {
      // 剥离 ANSI 颜色转义码（如 [32m、[39m 等）
      let clean = String(text).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      // 过滤掉仅含 "0" 的无意义行（log4js/Node.js 启动副作用）
      clean = clean.replace(/^0\r?\n?/gm, '')
      // 清理 [] 内多余空格（如 [ MARK ] → [MARK]，[  snowbaby  ] → [snowbaby]）
      clean = clean.replace(/\[\s+/g, '[').replace(/\s+\]/g, ']')
      if (!_event.sender.isDestroyed()) _event.sender.send('powershell-output', { stream, text: clean, source: 'snowbaby' })
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (text) => send('stdout', text))
    child.stderr.on('data', (text) => send('stderr', text))
    child.on('exit', () => { snowbabyProcess = null })
    child.on('error', (err) => {
      send('stderr', err.message)
      snowbabyProcess = null
    })
    return { success: true, pid: child.pid }
  } catch (e) {
    errorLog('[snowbaby] 启动失败: ' + e.message)
    return { success: false, error: e.message }
  }
})

ipcMain.handle('snowbaby-stop', async () => {
  try {
    if (!snowbabyProcess) return { success: true }
    const child = snowbabyProcess
    snowbabyProcess = null
    // 递归终止整棵进程树（node 可能派生子进程）
    if (child.pid) {
      try { execSync(`taskkill /F /T /PID ${child.pid}`, { windowsHide: true }) } catch {}
    }
    try { child.kill('SIGKILL') } catch {}
    return { success: true }
  } catch (e) {
    errorLog('[snowbaby] 停止失败: ' + e.message)
    return { success: false, error: e.message }
  }
})

// ====== 运行时插件编译 IPC ======
// 编译标记内容：打包器变更或产物异常时递增，强制已安装插件重新编译
const COMPILED_TAG = 'esbuild-v3'

async function ensurePluginsCompiled() {
  const buildScript = path.join(__dirname, 'build-plugin.cjs')
  if (!fs.existsSync(buildScript)) {
    debugLog('[Plugins] build-plugin.cjs not found, skipping compilation')
    return
  }

  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true })
  }

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const pluginDir = path.join(PLUGINS_DIR, entry.name)
    const pluginJson = path.join(pluginDir, 'plugin.json')
    const distDir = path.join(pluginDir, 'dist')
    const distMarker = path.join(distDir, '.compiled')

    if (!fs.existsSync(pluginJson)) continue

    // 检查是否需要重新编译（标记版本不匹配、dist 不存在或 plugin.json 比编译产物新）
    let needCompile = !fs.existsSync(distMarker) ||
      fs.readFileSync(distMarker, 'utf-8') !== COMPILED_TAG ||
      fs.statSync(pluginJson).mtimeMs > fs.statSync(distMarker).mtimeMs

    // 额外检查：编译过的插件，工具 JS 文件是否都存在且非占位（占位 <1KB）
    if (!needCompile) {
      try {
        const manifest = JSON.parse(fs.readFileSync(pluginJson, 'utf-8'))
        const tools = manifest.tools || {}
        for (const toolId of Object.keys(tools)) {
          const toolJs = path.join(distDir, `${toolId}.js`)
          if (!fs.existsSync(toolJs)) {
            needCompile = true
            debugLog(`[Plugins] ${entry.name}: missing ${toolId}.js, recompiling`)
            break
          }
          if (fs.statSync(toolJs).size < 1000) {
            needCompile = true
            debugLog(`[Plugins] ${entry.name}: ${toolId}.js 看起来是占位文件，重新编译`)
            break
          }
        }
      } catch (_) { needCompile = true }
    }

    if (!needCompile) continue

    debugLog(`[Plugins] Compiling: ${entry.name}`)
    try {
      const { compilePlugin } = require(buildScript)
      await compilePlugin(pluginDir, distDir)
      // 写入编译标记
      fs.writeFileSync(distMarker, COMPILED_TAG, 'utf-8')
    } catch (e) {
      errorLog(`[Plugins] Compile failed for ${entry.name}: ${e.message}`)
    }
  }
}

// 强制重新编译全部已装插件：清掉编译标记后复用 ensurePluginsCompiled
ipcMain.handle('recompile-plugins', async () => {
  try {
    if (fs.existsSync(PLUGINS_DIR)) {
      for (const entry of fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const marker = path.join(PLUGINS_DIR, entry.name, 'dist', '.compiled')
        if (fs.existsSync(marker)) fs.rmSync(marker, { force: true })
      }
    }
    await ensurePluginsCompiled()
    return true
  } catch (e) {
    errorLog('[Plugins] recompile-plugins failed: ' + e.message)
    return false
  }
})

ipcMain.handle('get-runtime-plugin-manifests', async () => {
  const manifests = []
  if (!fs.existsSync(PLUGINS_DIR)) return manifests

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const pluginJson = path.join(PLUGINS_DIR, entry.name, 'plugin.json')
    if (!fs.existsSync(pluginJson)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(pluginJson, 'utf-8'))
      manifests.push(manifest)
    } catch (e) {
      errorLog(`[Plugins] Failed to read plugin.json for ${entry.name}: ${e.message}`)
    }
  }
  return manifests
})

ipcMain.handle('create-directory', async (_event, dirPath) => {
  try {
    if (!isPathAllowed(dirPath)) throw new Error('Access denied: directory not allowed')
    fs.mkdirSync(dirPath, { recursive: true })
    return true
  } catch (e) {
    errorLog('[FileManager] create-directory failed: ' + e.message)
    throw e
  }
})

ipcMain.handle('remove-directory', async (_event, dirPath) => {
  try {
    if (!isPathAllowed(dirPath)) throw new Error('Access denied: directory not allowed')
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
    return true
  } catch (e) {
    errorLog('[FileManager] remove-directory failed: ' + e.message)
    throw e
  }
})

// 获取系统已安装字体列表（Windows 端通过 PowerShell 枚举）
ipcMain.handle('get-system-fonts', async () => {
  try {
    const psScript = 'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }'
    const output = execSync(psScript, { shell: 'powershell.exe', encoding: 'utf-8', timeout: 10000 })
    return output.split(/\r?\n/).map(f => f.trim()).filter(Boolean)
  } catch (e) {
    errorLog('[Fonts] get-system-fonts failed: ' + e.message)
    return []
  }
})
// ====== 文件管理器 IPC 结束 ======

// ====== 剪贴板 IPC（用于 Electron 端粘贴系统剪贴板内容） ======
ipcMain.handle('read-clipboard-text', async () => {
  try {
    return clipboard.readText()
  } catch (e) {
    errorLog('[Clipboard] read-clipboard-text failed: ' + e.message)
    return ''
  }
})

ipcMain.handle('read-clipboard-html', async () => {
  try {
    return clipboard.readHTML()
  } catch (e) {
    errorLog('[Clipboard] read-clipboard-html failed: ' + e.message)
    return ''
  }
})

// ====== 局域网传输 IPC ======
const http = require('http')
const os = require('os')

let lanTransferServer = null
let lanTransferData = null

ipcMain.handle('start-lan-server', async (_event, data) => {
  try {
    // 关闭已有的服务器
    if (lanTransferServer) {
      lanTransferServer.close()
      lanTransferServer = null
    }
    lanTransferData = data

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (req.url === '/api/lan-export') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          })
          res.end(JSON.stringify(lanTransferData))
        } else {
          res.writeHead(404)
          res.end('Not Found')
        }
      })

      server.listen(5789, '0.0.0.0', () => {
        lanTransferServer = server
        // 获取本地局域网 IP
        const interfaces = os.networkInterfaces()
        let localIP = '127.0.0.1'
        for (const name of Object.keys(interfaces)) {
          for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
              localIP = iface.address
              break
            }
          }
          if (localIP !== '127.0.0.1') break
        }
        debugLog('[LAN] LAN transfer server started: ' + localIP + ':5789')
        resolve({ ip: localIP, port: 5789 })
      })

      server.on('error', (err) => {
        errorLog('[LAN] Failed to start LAN server: ' + err.message)
        reject(err)
      })
    })
  } catch (e) {
    errorLog('[LAN] start-lan-server failed: ' + e.message)
    throw e
  }
})

ipcMain.handle('stop-lan-server', async () => {
  try {
    if (lanTransferServer) {
      lanTransferServer.close()
      lanTransferServer = null
      lanTransferData = null
      debugLog('[LAN] LAN transfer server stopped')
    }
    return true
  } catch (e) {
    errorLog('[LAN] stop-lan-server failed: ' + e.message)
    return false
  }
})

ipcMain.handle('fetch-lan-data', async (_event, url) => {
  try {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error('Invalid data format received from LAN'))
          }
        })
      }).on('error', (err) => {
        reject(new Error('Failed to connect to LAN server: ' + err.message))
      })
    })
  } catch (e) {
    errorLog('[LAN] fetch-lan-data failed: ' + e.message)
    throw e
  }
})
// ====== 局域网传输 IPC 结束 ======

// ====== 终端命令执行 / 主进程 HTTPS 请求 IPC 开始 ======
// 执行 PowerShell 命令，stdout/stderr 通过 powershell-output 事件流式回推渲染进程
// 当前正在执行的 PowerShell 子进程引用，供 kill-powershell 终止使用
let currentPowerShell = null

ipcMain.handle('exec-powershell', async (event, command) => {
  try {
    // 统一 UTF-8 输出，避免脚本中文提示乱码
    const wrapped = `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ${command}`
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', wrapped], { windowsHide: true })
    currentPowerShell = child
    const clearRef = () => { if (currentPowerShell === child) currentPowerShell = null }
    const send = (stream, text) => {
      const clean = String(text).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      if (!event.sender.isDestroyed()) event.sender.send('powershell-output', { stream, text: clean })
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (text) => send('stdout', text))
    child.stderr.on('data', (text) => send('stderr', text))
    return await new Promise((resolve) => {
      child.on('close', (code) => {
        clearRef()
        send('exit', String(code))
        resolve({ success: code === 0, code })
      })
      child.on('error', (err) => {
        clearRef()
        send('stderr', err.message)
        send('exit', '-1')
        resolve({ success: false, code: -1, error: err.message })
      })
    })
  } catch (e) {
    errorLog('[PS] exec-powershell failed: ' + e.message)
    return { success: false, code: -1, error: e.message }
  }
})

// 终止当前正在执行的 PowerShell 子进程（抽卡分析「停止」按钮）
// 仅 kill powershell.exe 无法终止其派生的子进程，故用 taskkill /T 递归终止整棵进程树
ipcMain.handle('kill-powershell', async () => {
  try {
    if (!currentPowerShell) return { success: false, error: 'no running process' }
    const child = currentPowerShell
    currentPowerShell = null
    if (child.pid) {
      try {
        execSync(`taskkill /F /T /PID ${child.pid}`, { windowsHide: true })
      } catch (e) {
        errorLog('[PS] taskkill failed: ' + e.message)
      }
    }
    try { child.kill('SIGKILL') } catch {}
    return { success: true }
  } catch (e) {
    errorLog('[PS] kill-powershell failed: ' + e.message)
    return { success: false, error: e.message }
  }
})

// 主进程发起 HTTPS GET 并解析 JSON（渲染进程直连第三方接口会被同源策略拦截）
// net.request 使用 Chromium 网络栈，自动遵循系统代理（有代理时走代理）
ipcMain.handle('http-get-json', async (_event, url) => {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, headers: { 'User-Agent': 'earth-survival-diary' } })
    request.on('response', (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error('返回内容不是合法 JSON'))
        }
      })
    })
    request.on('error', (err) => {
      reject(new Error('请求失败: ' + err.message))
    })
    request.end()
  })
})

// 主进程发起 HTTPS PATCH JSON 请求（snowbaby /config 等配置接口）。
ipcMain.handle('http-patch-json', async (_event, url, body) => {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(body)
    const request = net.request({
      url,
      method: 'PATCH',
      headers: {
        'User-Agent': 'earth-survival-diary',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json)
      }
    })
    request.on('response', (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch {
          reject(new Error('返回内容不是合法 JSON'))
        }
      })
    })
    request.on('error', (err) => {
      reject(new Error('请求失败: ' + err.message))
    })
    request.write(json)
    request.end()
  })
})

// 主进程发起 HTTPS GET 并返回原始文本（含 HTTP 状态码）。
// 供插件市场等场景下载 GitHub 源文件用，渲染进程直连第三方接口会被同源策略拦截或网络波动影响。
// net.request 自动遵循系统代理（有代理时走代理）。
ipcMain.handle('http-get-text', async (_event, url) => {
  return new Promise((resolve) => {
    const request = net.request({ url, headers: { 'User-Agent': 'earth-survival-diary' } })
    request.on('response', (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({ status: res.statusCode, text: data })
      })
    })
    request.on('error', (err) => {
      resolve({ status: 0, text: '', error: err.message })
    })
    request.end()
  })
})
// ====== 终端命令执行 / 主进程 HTTPS 请求 IPC 结束 ======

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

  const isPackaged = app.isPackaged
  const resourcesPath = isPackaged ? process.resourcesPath : __dirname
  const distPath = isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'dist')
    : path.join(__dirname, '..', 'dist')

  const nodeModulesPath = isPackaged
    ? path.join(process.resourcesPath, 'node_modules')
    : path.join(__dirname, '..', 'node_modules')

  const { createProdServer } = require(serverModulePath)
  const portsToTry = [5000, 5001, 5002, 5003]

  for (const port of portsToTry) {
    try {
      const { server } = createProdServer({
        port: port,
        dataDir: path.join(app.getPath('userData'), 'data'),
        distPath: distPath,
        resourcesPath: resourcesPath,
        nodeModulesPath: nodeModulesPath,
        pluginsDir: PLUGINS_DIR
      })

      await new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => {
          debugLog('[Electron] Server started on port ' + port)
          serverInstance = server
          serverPort = port
          resolve(port)
        })
        server.on('error', (err) => {
          reject(err)
        })
      })

      return port
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        debugLog('[Electron] Port ' + port + ' is in use, trying next...')
        continue
      }
      errorLog('[Electron] Server listen error: ' + err.message)
      throw err
    }
  }

  throw new Error('Failed to start server: all ports (5000-5003) are in use')
}

function createWindow(url) {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = primaryDisplay.size
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico')

  const defaultW = 1920
  const defaultH = 1080
  const winW = Math.min(defaultW, screenW)
  const winH = Math.min(defaultH, screenH)

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    icon: iconPath,
    maximizable: false,
    resizable: false,
    title: '地球 Online 生存日记',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
      nativeWindowOpen: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  mainWindow.loadURL(url)

  // Center window on screen
  mainWindow.setPosition(
    Math.round((screenW - winW) / 2),
    Math.round((screenH - winH) / 2)
  )

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    const parsed = new URL(targetUrl)
    const childForm = parsed.searchParams.get('childForm')
    let options = {}
    if (childForm === 'list') {
      options = { parent: mainWindow, modal: true, width: 580, height: 750, minWidth: 480, minHeight: 600, resizable: false }
    } else if (childForm === 'move') {
      options = { parent: mainWindow, modal: true, width: 420, height: 340, minWidth: 360, minHeight: 300, resizable: false }
    } else if (childForm === 'list' || childForm === 'group') {
      options = { parent: mainWindow, modal: true, width: 420, height: 420, minWidth: 360, minHeight: 340, resizable: false }
    }
    return { action: 'allow', overrideBrowserWindowOptions: options }
  })

  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    errorLog('[Electron] Page load failed: ' + code + ' ' + desc)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (logViewerWindow) {
      logViewerWindow.close()
      logViewerWindow = null
    }
  })

  mainWindow.on('close', (e) => {
    if (closeAction === 'minimize' && !isQuitting) {
      e.preventDefault()
      mainWindow.hide()
      mainWindow.setSkipTaskbar(true)
    }
  })

  mainWindow.show()
}

function setupTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon.png')
  appTray = new Tray(iconPath)
  appTray.setToolTip('地球 Online 生存日记')
  appTray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.setSkipTaskbar(false)
      mainWindow.focus()
    }
  })
  appTray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.setSkipTaskbar(false)
      mainWindow.focus()
    }
  })
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.setSkipTaskbar(false); mainWindow.focus() } } },
    { type: 'separator' },
    { label: '退出', click: () => { closeAction = 'exit'; cancelAllReminderTimers(); if (serverInstance) { try { serverInstance.close() } catch (e) {} }; app.quit() } }
  ])
  appTray.setContextMenu(contextMenu)
  debugLog('[Main] System tray created')
}

ipcMain.on('resize-window', (event, width, height) => {
  if (mainWindow) {
    mainWindow.setSize(width, height)
  }
})

const LOG_DIR = path.join(app.getPath('userData'), 'logs')
const DATA_DIR = path.join(app.getPath('userData'), 'data')

function getAllUserEmails() {
  const dir = path.join(DATA_DIR, 'users')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
}

function getUserIndexByEmail(email) {
  const p = path.join(DATA_DIR, 'users', email + '.json')
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
}

function getDirSize(dirPath) {
  let size = 0
  if (!fs.existsSync(dirPath)) return 0
  const items = fs.readdirSync(dirPath)
  for (const item of items) {
    const fullPath = path.join(dirPath, item)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      size += getDirSize(fullPath)
    } else {
      size += stat.size
    }
  }
  return size
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

ipcMain.handle('get-log-file-size', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const logFilePath = path.join(LOG_DIR, `app-${today}.log`)
  if (!fs.existsSync(logFilePath)) return { size: 0, exists: false }
  return { size: fs.statSync(logFilePath).size, exists: true }
})

ipcMain.handle('get-log-dir-size', async () => {
  return { size: getDirSize(LOG_DIR) }
})

ipcMain.handle('get-data-dir-size', async () => {
  return { size: getDirSize(DATA_DIR) }
})

ipcMain.handle('get-log-content', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const logFilePath = path.join(LOG_DIR, `app-${today}.log`)
  if (!fs.existsSync(logFilePath)) return ''
  return fs.readFileSync(logFilePath, 'utf-8')
})

ipcMain.handle('clear-logs', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const logFilePath = path.join(LOG_DIR, `app-${today}.log`)
  if (fs.existsSync(logFilePath)) {
    fs.rmSync(logFilePath)
  }
  return true
})

const MODULE_FILE_MAP = {
  tasks: ['footprint/footprint.json'],
  diaries: ['footprint/diary.json'],
  focus_favorites: ['focus/favorites.json'],
  focus_records: ['focus/records.json'],
  lists: ['list/lists.json', 'list/tasks.json'],
  countdown: ['countdown/categories.json', 'countdown/countdowns.json'],
  courses: ['course/courses.json']
}

const MODULE_GROUP_DEF = [
  { key: 'footprint', label: '足迹', children: [{ key: 'tasks', label: '足迹记录', serverKeys: ['tasks'] }, { key: 'diaries', label: '日记', serverKeys: ['diaries'] }] },
  { key: 'focus', label: '专注', children: [{ key: 'focus_favorites', label: '常用专注', serverKeys: ['focus_favorites'] }, { key: 'focus_records', label: '专注记录', serverKeys: ['focus_records'] }] },
  { key: 'lists', label: '清单', children: [{ key: 'lists', label: '清单列表及其任务', serverKeys: ['lists', 'lists'] }] },
  { key: 'countdown', label: '倒数日', children: [{ key: 'countdown', label: '倒数日分类及其倒数日', serverKeys: ['countdown_categories', 'countdowns'] }] },
  { key: 'courses', label: '课程表', children: [{ key: 'courses', label: '课程', serverKeys: ['courses', 'course_recorded_courses'] }] }
]

ipcMain.handle('get-module-sizes', async () => {
  try {
    const emails = getAllUserEmails()
    const users = []

    for (const email of emails) {
      const userIndex = getUserIndexByEmail(email)
      if (!userIndex || !userIndex.id) continue
      const userId = userIndex.id
      const userDir = path.join(DATA_DIR, userId)
      if (!fs.existsSync(userDir)) continue

      const modules = []
      let userTotal = 0

      for (const group of MODULE_GROUP_DEF) {
        let groupSize = 0
        const children = group.children.map(child => {
          let childSize = 0
          const files = MODULE_FILE_MAP[child.key] || []
          for (const f of files) {
            const fp = path.join(userDir, f)
            if (fs.existsSync(fp)) childSize += fs.statSync(fp).size
          }
          groupSize += childSize
          return { key: child.key, label: child.label, serverKeys: child.serverKeys, size: childSize }
        })
        userTotal += groupSize
        modules.push({ groupKey: group.key, groupLabel: group.label, groupSize, children })
      }

      users.push({
        email,
        nickname: userIndex.nickname || email.split('@')[0],
        userId,
        totalSize: userTotal,
        modules
      })
    }

    const totalDataSize = getDirSize(DATA_DIR)

    // Also add sizes for account info files (not deletable but part of total)
    for (const user of users) {
      const userDir = path.join(DATA_DIR, user.userId)
      for (const sub of ['profile', 'system']) {
        const subDir = path.join(userDir, sub)
        if (fs.existsSync(subDir)) {
          const sz = getDirSize(subDir)
          user.totalSize += sz
        }
      }
    }

    return { users, totalDataSize, moduleGroups: MODULE_GROUP_DEF }
  } catch (e) {
    errorLog('[Main] get-module-sizes failed: ' + e.message)
    return { users: [], totalDataSize: 0, moduleGroups: MODULE_GROUP_DEF }
  }
})

let cleanDataWindow = null

ipcMain.handle('open-clean-data-window', async (_event, windowData) => {
  if (cleanDataWindow) {
    cleanDataWindow.focus()
    return null
  }

  return new Promise((resolve) => {
    const dataJson = JSON.stringify(windowData)

    cleanDataWindow = new BrowserWindow({
      width: 480,
      height: 620,
      title: '清理数据',
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        devTools: false,
        preload: path.join(__dirname, 'preload.cjs')
      }
    })

    cleanDataWindow.setMenuBarVisibility(false)

    cleanDataWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>清理数据</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #1a1a2e; color: #eee; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
          .header { padding: 16px 20px 8px; font-size: 16px; font-weight: 600; color: #fff; }
          .desc { padding: 0 20px 12px; font-size: 12px; color: #e6a23c; border-bottom: 1px solid rgba(255,255,255,0.08); }
          .tree-wrap { flex: 1; overflow-y: auto; padding: 12px 20px; }
          .tree-wrap::-webkit-scrollbar { width: 6px; }
          .tree-wrap::-webkit-scrollbar-track { background: transparent; }
          .tree-wrap::-webkit-scrollbar-thumb { background: #3a3a5a; border-radius: 3px; }
          .all-row { display: flex; align-items: center; gap: 8px; padding: 6px 0 10px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px; }
          .all-row label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; font-weight: 500; color: #fff; }
          .all-row .size-badge { font-size: 11px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; margin-left: auto; }
          .account-row { display: flex; align-items: center; gap: 8px; padding: 6px 0 4px; }
          .account-row label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #8ab4f8; }
          .account-row .size-badge { font-size: 11px; color: rgba(255,255,255,0.4); margin-left: auto; }
          .module-group { margin-left: 20px; }
          .group-header { display: flex; align-items: center; gap: 4px; padding: 5px 8px; cursor: pointer; border-radius: 4px; user-select: none; }
          .group-header:hover { background: rgba(255,255,255,0.05); }
          .expand-icon { width: 16px; text-align: center; font-size: 14px; color: rgba(255,255,255,0.6); flex-shrink: 0; }
          .group-label { font-size: 13px; color: rgba(255,255,255,0.85); }
          .group-size { font-size: 11px; color: rgba(255,255,255,0.35); margin-left: auto; }
          .group-children { padding: 2px 0 4px 20px; }
          .child-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; }
          .child-item label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: rgba(255,255,255,0.75); }
          .child-item .child-size { font-size: 11px; color: rgba(255,255,255,0.3); margin-left: auto; }
          input[type="checkbox"] { accent-color: #667eea; width: 15px; height: 15px; cursor: pointer; }
          .footer { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.08); }
          .footer button { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; }
          .btn-cancel { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }
          .btn-cancel:hover { background: rgba(255,255,255,0.12); }
          .btn-confirm { background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.4) !important; }
          .btn-confirm:hover { background: rgba(239,68,68,0.3); }
          .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
          .empty-hint { text-align: center; color: #555; padding: 40px 0; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">清理数据</div>
        <div class="desc">按账号选择要清理的数据模块，清理后将立即重启应用。</div>
        <div class="tree-wrap" id="treeWrap"></div>
        <div class="footer">
          <button class="btn-cancel" onclick="cancelClean()">取消</button>
          <button class="btn-confirm" id="confirmBtn" onclick="confirmClean()" disabled>清理</button>
        </div>
        <script>
          var data = JSON.parse(decodeURIComponent(\`${encodeURIComponent(dataJson)}\`));
          var users = data.users || [];
          var totalDataSize = data.totalDataSize || 0;
          var moduleGroups = data.moduleGroups || [];
          var expandedGroups = {};
          var selectedLeafKeys = {};
          var allChecked = false;
          var accountChecked = {};

          function formatSize(b) {
            if (!b || b <= 0) return '0 B';
            if (b < 1024) return b + ' B';
            if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
            return (b / 1048576).toFixed(1) + ' MB';
          }

          function getAllLeafServerKeys(userIdx) {
            var keys = [];
            var user = users[userIdx];
            if (!user) return keys;
            user.modules.forEach(function(g) {
              g.children.forEach(function(c) {
                c.serverKeys.forEach(function(sk) { keys.push(sk); });
              });
            });
            return keys;
          }

          function getAccountLeafKeys(userIdx) {
            var keys = [];
            var user = users[userIdx];
            if (!user) return keys;
            user.modules.forEach(function(g) {
              g.children.forEach(function(c) {
                keys.push(userIdx + ':' + g.groupKey + ':' + c.key);
              });
            });
            return keys;
          }

          function updateAllChecked() {
            var total = 0;
            var checked = 0;
            for (var u = 0; u < users.length; u++) {
              var user = users[u];
              user.modules.forEach(function(g) {
                g.children.forEach(function(c) {
                  total++;
                  var k = u + ':' + g.groupKey + ':' + c.key;
                  if (selectedLeafKeys[k]) checked++;
                });
              });
            }
            allChecked = total > 0 && checked === total;
            document.getElementById('confirmBtn').disabled = checked === 0;
          }

          function toggleAll(e) {
            var checked = e.target.checked;
            allChecked = checked;
            for (var u = 0; u < users.length; u++) {
              var user = users[u];
              user.modules.forEach(function(g) {
                g.children.forEach(function(c) {
                  var k = u + ':' + g.groupKey + ':' + c.key;
                  selectedLeafKeys[k] = checked;
                });
              });
            }
            renderTree();
          }

          function toggleAccount(userIdx, checked) {
            var user = users[userIdx];
            user.modules.forEach(function(g) {
              g.children.forEach(function(c) {
                var k = userIdx + ':' + g.groupKey + ':' + c.key;
                selectedLeafKeys[k] = checked;
              });
            });
            renderTree();
          }

          function toggleGroup(userIdx, groupKey) {
            var key = userIdx + ':' + groupKey;
            expandedGroups[key] = !expandedGroups[key];
            renderTree();
          }

          function toggleLeaf(userIdx, groupKey, childKey, checked) {
            var k = userIdx + ':' + groupKey + ':' + childKey;
            selectedLeafKeys[k] = checked;
            renderTree();
          }

          function renderTree() {
            var html = '';
            // All data row
            var allSz = formatSize(totalDataSize);
            html += '<div class="all-row"><label><input type="checkbox" ' + (allChecked ? 'checked' : '') + ' onchange="toggleAll(event)">全部应用数据</label><span class="size-badge">' + allSz + '</span></div>';

            if (users.length === 0) {
              html += '<div class="empty-hint">暂无用户数据</div>';
              document.getElementById('treeWrap').innerHTML = html;
              return;
            }

            for (var u = 0; u < users.length; u++) {
              var user = users[u];
              var displayName = user.nickname || user.email;
              // Check if all items for this account are checked
              var accountKeys = getAccountLeafKeys(u);
              var allAccountChecked = accountKeys.every(function(k) { return selectedLeafKeys[k]; });
              var anyAccountChecked = accountKeys.some(function(k) { return selectedLeafKeys[k]; });
              html += '<div class="account-row"><label><input type="checkbox" ' + (allAccountChecked ? 'checked' : '') + ' onchange="toggleAccount(' + u + ', this.checked)">' + escapeHtml(displayName) + '</label><span class="size-badge">' + formatSize(user.totalSize) + '</span></div>';

              user.modules.forEach(function(g) {
                var groupKey = u + ':' + g.groupKey;
                var isExpanded = expandedGroups[groupKey] !== false;
                html += '<div class="module-group">';
                html += '<div class="group-header" onclick="toggleGroup(' + u + ',\\'' + g.groupKey + '\\')">';
                html += '<span class="expand-icon">' + (isExpanded ? '−' : '+') + '</span>';
                html += '<span class="group-label">' + escapeHtml(g.groupLabel) + '</span>';
                html += '<span class="group-size">' + formatSize(g.groupSize) + '</span>';
                html += '</div>';
                if (isExpanded) {
                  html += '<div class="group-children">';
                  g.children.forEach(function(c) {
                    var k = u + ':' + g.groupKey + ':' + c.key;
                    var isChecked = selectedLeafKeys[k] || false;
                    html += '<div class="child-item"><label><input type="checkbox" ' + (isChecked ? 'checked' : '') + ' onchange="toggleLeaf(' + u + ',\\'' + g.groupKey + '\\',\\'' + c.key + '\\', this.checked)">' + escapeHtml(c.label) + '</label><span class="child-size">' + formatSize(c.size) + '</span></div>';
                  });
                  html += '</div>';
                }
                html += '</div>';
              });
            }

            document.getElementById('treeWrap').innerHTML = html;
            updateAllChecked();
          }

          function escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          }

          function getSelectedServerKeys() {
            var keys = [];
            for (var u = 0; u < users.length; u++) {
              var user = users[u];
              user.modules.forEach(function(g) {
                g.children.forEach(function(c) {
                  var k = u + ':' + g.groupKey + ':' + c.key;
                  if (selectedLeafKeys[k]) {
                    c.serverKeys.forEach(function(sk) { if (keys.indexOf(sk) < 0) keys.push(sk); });
                  }
                });
              });
            }
            return keys;
          }

          function confirmClean() {
            var selectedKeys = getSelectedServerKeys();
            if (selectedKeys.length === 0) return;
            window.electronAPI.confirmCleanData({ deleteAll: allChecked, modules: allChecked ? [] : selectedKeys });
          }

          function cancelClean() {
            window.electronAPI.cancelCleanData();
          }

          renderTree();
        </script>
      </body>
      </html>
    `)}`)

    const onConfirm = (_e, result) => {
      resolve(result)
      if (cleanDataWindow && !cleanDataWindow.isDestroyed()) {
        cleanDataWindow.close()
      }
    }

    const onCancel = () => {
      resolve(null)
      if (cleanDataWindow && !cleanDataWindow.isDestroyed()) {
        cleanDataWindow.close()
      }
    }

    ipcMain.once('clean-data-confirm', onConfirm)
    ipcMain.once('clean-data-cancel', onCancel)

    cleanDataWindow.on('closed', () => {
      cleanDataWindow = null
      resolve(null)
    })
  })
})

let _versionUpdateNotified = false

ipcMain.handle('check-version-update', async (_event, userId) => {
  try {
    if (_versionUpdateNotified) {
      debugLog('[Main] check-version-update already notified, skipping')
      return { isUpdated: false, oldVersion: null, newVersion: null }
    }

    const currentVersion = app.getVersion()
    const versionDir = path.join(DATA_DIR, userId, 'system')
    const statePath = path.join(versionDir, 'state.json')
    const legacyVersionPath = path.join(versionDir, 'version.json')

    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

    let storedVersion = null
    try {
      const stateData = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
      storedVersion = stateData.version || null
    } catch {}

    if (!storedVersion && fs.existsSync(legacyVersionPath)) {
      try {
        const ver = JSON.parse(fs.readFileSync(legacyVersionPath, 'utf-8'))
        storedVersion = ver.version || null
        try { fs.unlinkSync(legacyVersionPath) } catch {}
      } catch {}
    }

    const isUpdated = storedVersion !== currentVersion

    let stateData = {}
    try { stateData = JSON.parse(fs.readFileSync(statePath, 'utf-8')) } catch {}
    stateData.version = currentVersion
    fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2), 'utf-8')

    if (isUpdated) {
      _versionUpdateNotified = true
    }

    debugLog('[Main] check-version-update', { userId, storedVersion, currentVersion, isUpdated })
    return { isUpdated, oldVersion: storedVersion, newVersion: currentVersion }
  } catch (e) {
    errorLog('[Main] check-version-update failed: ' + e.message)
    return { isUpdated: false, oldVersion: null, newVersion: null }
  }
})

let changelogWindow = null

ipcMain.handle('open-changelog-window', async (_event, content) => {
  if (changelogWindow) {
    changelogWindow.focus()
    return
  }

  let htmlContent = content
    .replace(/^### (.+)$/gm, '<div class="ver-heading">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="sec-heading">$1</div>')
    .replace(/^- (.+)$/gm, '<div class="log-item">• $1</div>')

  htmlContent = htmlContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;div class="ver-heading"&gt;/g, '<div class="ver-heading">')
    .replace(/&lt;\/div&gt;/g, '</div>')
    .replace(/&lt;div class="sec-heading"&gt;/g, '<div class="sec-heading">')
    .replace(/&lt;div class="log-item"&gt;/g, '<div class="log-item">')

  changelogWindow = new BrowserWindow({
    width: 560,
    height: 520,
    title: '更新日志',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  changelogWindow.setMenuBarVisibility(false)

  changelogWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>更新日志</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #16162a; color: #ccc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
        .header { padding: 16px 22px 12px; font-size: 17px; font-weight: 700; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; letter-spacing: 0.5px; }
        .body { flex: 1; overflow-y: auto; padding: 16px 22px 24px; line-height: 1.8; }
        .body::-webkit-scrollbar { width: 5px; }
        .body::-webkit-scrollbar-track { background: transparent; }
        .body::-webkit-scrollbar-thumb { background: #2d2d50; border-radius: 3px; }
        .sec-heading { font-size: 15px; font-weight: 700; color: #8ab4f8; margin: 24px 0 14px; letter-spacing: 0.3px; }
        .ver-heading { font-size: 13px; font-weight: 600; color: #e8c766; margin: 16px 0 6px; padding: 0 0 0 8px; border-left: 2px solid rgba(232,199,102,0.3); }
        .log-item { font-size: 13px; color: #bbb; padding: 1px 0 1px 8px; }
        .footer { display: flex; justify-content: flex-end; padding: 10px 22px; border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
        .footer button { padding: 7px 26px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.65); transition: background 0.2s; }
        .footer button:hover { background: rgba(255,255,255,0.11); }
      </style>
    </head>
    <body>
      <div class="header">更新日志</div>
      <div class="body">${htmlContent}</div>
      <div class="footer"><button onclick="window.close()">关闭</button></div>
    </body>
    </html>
  `)}`)

  changelogWindow.on('closed', () => {
    changelogWindow = null
  })
})

// ====== 提醒系统 ======
let reminderTimers = []
let reminderQueue = []
let reminderPersistDuration = 30
let allScheduledReminders = []
let isShowingReminder = false
let showReminderTimer = null

function cancelAllReminderTimers() {
  reminderTimers.forEach(t => clearTimeout(t.timeout))
  reminderTimers = []
  reminderQueue = []
  isShowingReminder = false
  if (showReminderTimer) {
    clearTimeout(showReminderTimer)
    showReminderTimer = null
  }
}

function showNextReminder() {
  if (isShowingReminder) return
  if (reminderQueue.length === 0) {
    debugLog('[Reminder] Queue is empty, reminder flow ended')
    return
  }

  isShowingReminder = true
  const reminder = reminderQueue.shift()
  debugLog('[Reminder] Sending reminder to main window: ' + reminder.name + ' (id=' + reminder.id + ', remaining=' + reminderQueue.length + ')')

  if (reminder.repeatStrategy && reminder.repeatStrategy !== 'none') {
    scheduleNextRepeat(reminder)
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('show-reminder', reminder)
  }

  showReminderTimer = setTimeout(() => {
    showReminderTimer = null
    isShowingReminder = false
    showNextReminder()
  }, 5000)
}

function scheduleNextRepeat(reminder) {
  if (reminder.repeatEndStrategy === 'count' && reminder.repeatCount && reminder.repeatCompletedCount >= reminder.repeatCount) {
    debugLog('[Reminder] Repeat ended (count reached): ' + reminder.name)
    return
  }

  const prevTrigger = new Date(reminder.triggerTime)
  const nextTrigger = new Date(prevTrigger)

  switch (reminder.repeatStrategy) {
    case 'daily': nextTrigger.setDate(nextTrigger.getDate() + 1); break
    case 'weekdays': {
      nextTrigger.setDate(nextTrigger.getDate() + 1)
      const dow = nextTrigger.getDay()
      if (dow === 0) nextTrigger.setDate(nextTrigger.getDate() + 1)
      else if (dow === 6) nextTrigger.setDate(nextTrigger.getDate() + 2)
      break
    }
    case 'weekly': nextTrigger.setDate(nextTrigger.getDate() + 7); break
    case 'monthly': nextTrigger.setMonth(nextTrigger.getMonth() + 1); break
    case 'yearly': nextTrigger.setFullYear(nextTrigger.getFullYear() + 1); break
    case 'hourly': nextTrigger.setHours(nextTrigger.getHours() + 1); break
    case 'custom_days': nextTrigger.setDate(nextTrigger.getDate() + (reminder.repeatCustomDays || 1)); break
    default: return
  }

  if (reminder.repeatEndStrategy === 'date' && reminder.repeatEndDate) {
    if (nextTrigger > new Date(reminder.repeatEndDate + 'T23:59:59')) {
      debugLog('[Reminder] Repeat ended (past end date): ' + reminder.name)
      return
    }
  }

  if (reminder.reminderStrategy === 'advance') {
    const offsetMs = ((reminder.reminderDays || 0) * 1440 + (reminder.reminderHours || 0) * 60 + (reminder.reminderMinutes || 0)) * 60000
    if (offsetMs > 0) nextTrigger.setTime(nextTrigger.getTime() - offsetMs)
  }

  const delay = nextTrigger.getTime() - Date.now()
  if (delay <= 0) {
    debugLog('[Reminder] Next round reminder has expired: ' + reminder.name)
    return
  }

  if (delay > MAX_SCHEDULE_DELAY) {
    debugLog('[Reminder] Next round reminder too far in future (' + formatDelay(delay) + '): ' + reminder.name + ', will reschedule on next launch')
    return
  }

  debugLog('[Reminder] Next round: ' + reminder.name + ' in ' + formatDelay(delay))
  const nextReminder = { ...reminder, triggerTime: nextTrigger.toISOString() }
  if (reminder.repeatStrategy === 'hourly' && reminder.focusStartTimestamp) {
    const elapsedHours = Math.round((nextTrigger.getTime() - reminder.focusStartTimestamp) / 3600000)
    nextReminder.body = `您已专注 ${elapsedHours} 小时，请注意休息！`
  }
  const timer = setTimeout(() => enqueueReminder(nextReminder), delay)
  reminderTimers.push({ id: reminder.id, timeout: timer })
}

function enqueueReminder(reminder) {
  debugLog('[Reminder] Enqueued: ' + (reminder.name || reminder.id))
  reminderQueue.push(reminder)
  showNextReminder()
}

ipcMain.handle('schedule-reminders', async (_event, reminders, persistDuration) => {
  debugLog('[Reminder] Received schedule request, total ' + (reminders ? reminders.length : 0) + ' reminders')
  cancelAllReminderTimers()
  if (persistDuration != null) reminderPersistDuration = persistDuration
  allScheduledReminders = reminders || []

  if (!reminders || reminders.length === 0) return { ok: true, count: 0 }

  reminders.forEach(r => {
    const delay = new Date(r.triggerTime).getTime() - Date.now()
    if (delay <= 0) {
      debugLog('[Reminder] Triggering immediately: ' + (r.name || r.id))
      enqueueReminder(r)
    } else if (delay > MAX_SCHEDULE_DELAY) {
      debugLog('[Reminder] Skipping far-future reminder: ' + (r.name || r.id) + ' (' + formatDelay(delay) + '), will reschedule on next launch')
    } else {
      debugLog('[Reminder] Scheduled: ' + (r.name || r.id) + ' in ' + formatDelay(delay))
      const timer = setTimeout(() => enqueueReminder(r), delay)
      reminderTimers.push({ id: r.id, timeout: timer })
    }
  })
  return { ok: true, count: reminders.length }
})

ipcMain.handle('cancel-all-reminders', async () => {
  debugLog('[Reminder] Cancelling all reminders')
  cancelAllReminderTimers()
  return { ok: true }
})

ipcMain.handle('get-reminder-persist-duration', async () => {
  return { persistDuration: reminderPersistDuration }
})

ipcMain.handle('get-all-reminders', async () => {
  return allScheduledReminders
})

function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatDelay(ms) {
  const totalSec = Math.round(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (days > 0) return days + 'd' + hours + 'h' + minutes + 'm' + seconds + 's'
  if (hours > 0) return hours + 'h' + minutes + 'm' + seconds + 's'
  if (minutes > 0) return minutes + 'm' + seconds + 's'
  return seconds + 's'
}

const MAX_SCHEDULE_DELAY = 20 * 24 * 3600 * 1000
// ====== 提醒系统结束 ======

// ====== 全屏游戏前台时视频播放器卡顿修复（须在 app ready 前设置） ======
// Windows 上 Chromium 的原生窗口遮挡检测（CalculateNativeWinOcclusion）会把置顶的播放器窗口
// 误判为被全屏游戏"遮挡"，进而停止/降频该窗口的合成渲染导致播放卡顿（游戏切后台即恢复正常）。
// 禁用遮挡检测与被遮挡窗口的后台化/渲染器降频，保证播放器在全屏游戏前台时持续正常渲染。
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

app.whenReady().then(async () => {
  if (!gotTheLock) {
    debugLog('[Main] Did not obtain single instance lock, skipping launch')
    return
  }
  // 更新安装完成启动新版本后，删除临时目录中遗留的更新安装包
  cleanupUpdateInstallers()
  closeAction = getCloseAction()
  debugLog('[Main] Close button behavior', { action: closeAction })
  const sep = '─'.repeat(60)
  const dir = path.dirname(logFile)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(logFile, `\n${sep}\n[${formatTs()}] [INFO] ===== App Launch =====\n${sep}\n`)
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
    await ensurePluginsCompiled()
    const url = 'http://127.0.0.1:' + port
    debugLog('[Electron] Loading URL: ' + url)
    createWindow(url)
    setupTray()

    setTimeout(() => {
      fetchLatestFromReleases().then((latest) => {
        if (latest && compareVersions(latest.version, app.getVersion()) > 0) {
          debugLog('[Updater] New version found at startup: ' + latest.version)
          sendUpdateStatusToMain({ status: 'available', version: latest.version, downloadUrl: latest.downloadUrl })
        }
      }).catch(e => debugLog('[Updater] Check failed: ' + e.message))
    }, 5000)
  } catch (err) {
    errorLog('[Electron] Fatal error: ' + err.message)
    errorLog('[Electron] Stack: ' + err.stack)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow('http://127.0.0.1:' + serverPort)
    }
  })
})

app.on('before-quit', () => {
  debugLog('[Electron] App is about to quit (system shutdown/user exit)')
  isQuitting = true
  cancelAllReminderTimers()
  globalShortcut.unregisterAll()
  // 终止 snowbaby 子进程：防止其残留运行占用安装目录文件，导致安装新版本时提示"无法停止运行应用"
  if (snowbabyProcess) {
    const child = snowbabyProcess
    snowbabyProcess = null
    if (child.pid) {
      try { execSync(`taskkill /F /T /PID ${child.pid}`, { windowsHide: true }) } catch {}
    }
    try { child.kill('SIGKILL') } catch {}
  }
  if (serverInstance) {
    try { serverInstance.close() } catch (e) {}
  }
})

let logViewerWindow = null

ipcMain.handle('open-log-viewer', async (_event, logContent) => {
  if (logViewerWindow) {
    logViewerWindow.focus()
    return
  }

  logViewerWindow = new BrowserWindow({
    width: 900,
    height: 600,
    title: '日志查看器',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  logViewerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>日志查看器</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #1a1a2e; color: #eee; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
        .toolbar { display: flex; gap: 8px; padding: 10px 16px; background: #16213e; border-bottom: 1px solid #333; align-items: center; }
        .toolbar button { background: #2a2a4a; border: 1px solid #444; color: #ddd; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .toolbar button:hover { background: #3a3a5a; }
        .toolbar input { background: #2a2a4a; border: 1px solid #444; color: #ddd; padding: 6px 10px; border-radius: 4px; font-size: 12px; width: 120px; }
        .toolbar select { background: #2a2a4a; border: 1px solid #444; color: #ddd; padding: 6px 8px; border-radius: 4px; font-size: 12px; }
        .log-container { flex: 1; overflow-y: auto; padding: 12px; line-height: 1.8; }
        .log-line { white-space: pre-wrap; word-break: break-all; }
        .log-time { color: #88c0d0; }
        .log-level-debug { color: #5e81ac; }
        .log-level-info { color: #a3be8c; }
        .log-level-warn { color: #ebcb8b; }
        .log-level-error { color: #bf616a; }
        .log-level-fatal { color: #e06c75; }
        .log-content { color: #d8dee9; }
        .jk { color: #9cdcfe; font-weight: bold; }
        .js { color: #ce9178; }
        .jn { color: #b5cea8; }
        .jb { color: #569cd6; font-weight: bold; }
        .jnl { color: #569cd6; font-weight: bold; }
        .jp { color: #808080; }
        .empty-hint { text-align: center; color: #555; padding: 40px 0; font-size: 14px; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #1a1a2e; }
        ::-webkit-scrollbar-thumb { background: #3a3a5a; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <input type="text" id="filterText" placeholder="搜索日志...">
        <select id="levelFilter">
          <option value="">全部级别</option>
          <option value="DEBUG">DEBUG</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <button id="clearFilter">清除过滤</button>
      </div>
      <div class="log-container" id="logContainer"></div>
      <script>
        var logContent = JSON.parse(decodeURIComponent(\`${encodeURIComponent(JSON.stringify(logContent))}\`));
        var isAtBottom = true;
        var container = document.getElementById('logContainer');

        container.addEventListener('scroll', function() {
          isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        });

        function parseLogLine(line) {
          var match = line.match(/^\\[([^\\]]+)\\]\\s*\\[([^\\]]+)\\]\\s*(.*)/);
          if (!match) return { time: '', level: '', content: line };
          return { time: match[1], level: match[2], content: match[3] };
        }

        function escapeHtml(str) {
          if (!str) return '';
          return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function colorizeJson(pretty) {
          return pretty
            .replace(/("[^"]*")\\s*:/g, '<span class="jk">$1</span>:')
            .replace(/: "(.*?)"/g, ': <span class="js">"$1"</span>')
            .replace(/: (\\d+\\.?\\d*)/g, ': <span class="jn">$1</span>')
            .replace(/: (true|false)/g, ': <span class="jb">$1</span>')
            .replace(/: (null)/g, ': <span class="jnl">$1</span>')
            .replace(/([{}\\[\\],])/g, '<span class="jp">$1</span>');
        }

        function formatContent(content) {
          var start = content.indexOf('{');
          if (start === -1) return escapeHtml(content);

          var depth = 0, inStr = false;
          for (var i = start; i < content.length; i++) {
            var ch = content[i];
            if (ch === '\\\\' && inStr) { i++; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === '{') depth++;
            else if (ch === '}') {
              depth--;
              if (depth === 0) {
                var before = formatContent(content.substring(0, start));
                var json = content.substring(start, i + 1);
                var after = formatContent(content.substring(i + 1));
                try {
                  var obj = JSON.parse(json);
                  return before + colorizeJson(JSON.stringify(obj, null, 2)) + after;
                } catch(e) {
                  return before + escapeHtml(json) + after;
                }
              }
            }
          }
          return escapeHtml(content);
        }

        function renderLogs() {
          var filterText = document.getElementById('filterText');
          var levelSel = document.getElementById('levelFilter');
          if (!filterText || !levelSel) return;

          var filter = filterText.value.toLowerCase();
          var levelFilter = levelSel.value;
          var lines = logContent.split('\\n');
          if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) {
            container.innerHTML = '<div class="empty-hint">暂无日志内容</div>';
            return;
          }

          var html = '';
          for (var k = 0; k < lines.length; k++) {
            var line = lines[k];
            if (!line.trim()) continue;
            var parsed = parseLogLine(line);
            if (filter && line.toLowerCase().indexOf(filter) === -1) continue;
            if (levelFilter && parsed.level !== levelFilter) continue;

            if (parsed.time) {
              var levelClass = parsed.level ? 'log-level-' + parsed.level.toLowerCase() : '';
              html += '<div class="log-line">[<span class="log-time">' + escapeHtml(parsed.time) + '</span>] [<span class="' + levelClass + '">' + escapeHtml(parsed.level) + '</span>] <span class="log-content">' + formatContent(parsed.content) + '</span></div>';
            } else {
              html += '<div class="log-line"><span class="log-content">' + formatContent(parsed.content) + '</span></div>';
            }
          }

          container.innerHTML = html || '<div class="empty-hint">没有匹配的记录</div>';
          if (isAtBottom) container.scrollTop = container.scrollHeight;
        }

        document.getElementById('filterText').addEventListener('input', renderLogs);
        document.getElementById('levelFilter').addEventListener('change', renderLogs);
        document.getElementById('clearFilter').addEventListener('click', function() {
          document.getElementById('filterText').value = '';
          document.getElementById('levelFilter').value = '';
          renderLogs();
        });

        renderLogs();

        setInterval(async function() {
          try {
            var newContent = await window.electronAPI.getLogContent();
            if (newContent !== logContent) {
              logContent = newContent;
              renderLogs();
            }
          } catch(e) {}
        }, 2000);
      </script>
    </body>
    </html>
  `)}`)

  logViewerWindow.on('closed', () => {
    logViewerWindow = null
  })
})
