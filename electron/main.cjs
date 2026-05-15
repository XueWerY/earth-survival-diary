const { app, BrowserWindow, Menu, ipcMain, shell, dialog, Tray } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

Menu.setApplicationMenu(null)

let appTray = null
let closeAction = 'minimize'

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
  debugLog('[Main] 另一个实例已在运行，退出当前实例')
  app.quit()
}

let mainWindow
let serverInstance = null

ipcMain.on('restart-app', () => { 
  debugLog('[Main] 收到重启请求')
  app.relaunch()
  app.quit()
})

ipcMain.handle('set-auto-launch', async (_event, enable) => {
  try {
    app.setLoginItemSettings({ openAtLogin: enable })
    debugLog('[Main] 设置开机自启动', { enabled: enable })
    return true
  } catch (e) {
    errorLog('[Main] 设置开机自启动失败: ' + e.message)
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
  debugLog('[Main] 设置关闭按钮行为', { action })
  return true
})

ipcMain.handle('get-close-action', async () => {
  return closeAction
})

autoUpdater.autoDownload = false
autoUpdater.channel = 'latest'

function sendUpdateStatusToMain(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', data)
  } else {
    debugLog('[Main] mainWindow 不可用，无法发送更新状态')
  }
}

autoUpdater.on('update-available', (info) => {
  debugLog('[Main] autoUpdater: 检测到新版本 ' + info.version)
  sendUpdateStatusToMain({ status: 'available', version: info.version })
})

autoUpdater.on('error', (err) => {
  debugLog('[Main] autoUpdater 错误: ' + err.message)
  sendUpdateStatusToMain({ status: 'error', message: err.message })
})

ipcMain.handle('check-for-update', async () => {
  debugLog('[Main] 收到手动检查更新请求')
  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result || result.updateInfo.version === app.getVersion()) {
      debugLog('[Main] 已是最新版本: ' + app.getVersion())
      sendUpdateStatusToMain({ status: 'no-update' })
      return { updateAvailable: false }
    }
    debugLog('[Main] 发现新版本: ' + result.updateInfo.version)
    sendUpdateStatusToMain({ status: 'available', version: result.updateInfo.version })
    return { updateAvailable: true, version: result.updateInfo.version }
  } catch (e) {
    debugLog('[Main] 检查更新失败: ' + e.message)
    sendUpdateStatusToMain({ status: 'error', message: e.message })
    return { error: e.message }
  }
})

ipcMain.handle('open-external', async (_event, url) => {
  debugLog('[Main] 打开外部链接: ' + url)
  await shell.openExternal(url)
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
      nativeWindowOpen: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  mainWindow.loadURL(url)

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    const parsed = new URL(targetUrl)
    const childForm = parsed.searchParams.get('childForm')
    let options = {}
    if (childForm === 'mission') {
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
    if (closeAction === 'minimize') {
      e.preventDefault()
      mainWindow.hide()
      mainWindow.setSkipTaskbar(true)
    }
  })

  mainWindow.show()
}

function setupTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
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
    { label: '退出', click: () => { closeAction = 'exit'; app.quit() } }
  ])
  appTray.setContextMenu(contextMenu)
  debugLog('[Main] 系统托盘已创建')
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
  focus_favorites: ['focus/favorites.json'],
  focus_records: ['focus/records.json'],
  lists: ['list/lists.json', 'list/tasks.json'],
  countdown: ['countdown/categories.json', 'countdown/countdowns.json'],
  courses: ['course/courses.json', 'course/recorded-courses.json'],
  notebooks: ['note/notebooks.json', 'note/notes.json']
}

const MODULE_GROUP_DEF = [
  { key: 'footprint', label: '足迹', children: [{ key: 'tasks', label: '足迹记录', serverKeys: ['tasks'] }] },
  { key: 'focus', label: '专注', children: [{ key: 'focus_favorites', label: '常用专注', serverKeys: ['focus_favorites'] }, { key: 'focus_records', label: '专注记录', serverKeys: ['focus_records'] }] },
  { key: 'lists', label: '清单', children: [{ key: 'lists', label: '清单列表及其任务', serverKeys: ['lists', 'missions'] }] },
  { key: 'countdown', label: '倒数日', children: [{ key: 'countdown', label: '倒数日分类及其倒数日', serverKeys: ['countdown_categories', 'countdowns'] }] },
  { key: 'courses', label: '课程表', children: [{ key: 'courses', label: '课程', serverKeys: ['courses', 'course_recorded_courses'] }] },
  { key: 'notes', label: '笔记', children: [{ key: 'notebooks', label: '笔记本及其笔记', serverKeys: ['notebooks', 'notes'] }] }
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
      for (const sub of ['profile', 'session', 'system']) {
        const subDir = path.join(userDir, sub)
        if (fs.existsSync(subDir)) {
          const sz = getDirSize(subDir)
          user.totalSize += sz
        }
      }
    }

    return { users, totalDataSize, moduleGroups: MODULE_GROUP_DEF }
  } catch (e) {
    errorLog('[Main] get-module-sizes 失败: ' + e.message)
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
      debugLog('[Main] check-version-update 已通知过，跳过')
      return { isUpdated: false, oldVersion: null, newVersion: null }
    }

    const currentVersion = app.getVersion()
    const versionDir = path.join(DATA_DIR, userId, 'system')
    const versionPath = path.join(versionDir, 'version.json')
    const oldStatePath = path.join(versionDir, 'state.json')

    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

    // 迁移：如果旧 state.json 中有 version 字段但 version.json 没有，则迁移
    let storedVersion = null
    if (!fs.existsSync(versionPath) && fs.existsSync(oldStatePath)) {
      try {
        const oldState = JSON.parse(fs.readFileSync(oldStatePath, 'utf-8'))
        if (oldState.version) {
          storedVersion = oldState.version
          fs.writeFileSync(versionPath, JSON.stringify({ version: storedVersion }, null, 2), 'utf-8')
          delete oldState.version
          fs.writeFileSync(oldStatePath, JSON.stringify(oldState, null, 2), 'utf-8')
          debugLog('[Main] 已迁移版本号到 version.json')
        }
      } catch { /* ignore */ }
    }

    // 从独立文件读取版本号
    if (fs.existsSync(versionPath)) {
      try {
        const ver = JSON.parse(fs.readFileSync(versionPath, 'utf-8'))
        storedVersion = ver.version || null
      } catch { /* ignore */ }
    }

    const isUpdated = storedVersion !== currentVersion

    // 写入版本号到独立文件
    fs.writeFileSync(versionPath, JSON.stringify({ version: currentVersion }, null, 2), 'utf-8')

    if (isUpdated) {
      _versionUpdateNotified = true
    }

    debugLog('[Main] check-version-update', { userId, storedVersion, currentVersion, isUpdated })
    return { isUpdated, oldVersion: storedVersion, newVersion: currentVersion }
  } catch (e) {
    errorLog('[Main] check-version-update 失败: ' + e.message)
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
let reminderWindowStack = []
let reminderWindowOffset = 0
let reminderWindowDataMap = new Map()
let isShowingReminder = false
let showReminderTimer = null

function cancelAllReminderTimers() {
  reminderTimers.forEach(t => clearTimeout(t.timeout))
  reminderTimers = []
  reminderQueue = []
  reminderWindowStack.forEach(w => {
    if (w && !w.isDestroyed()) w.close()
  })
  reminderWindowStack = []
  reminderWindowOffset = 0
  reminderWindowDataMap.clear()
  isShowingReminder = false
  if (showReminderTimer) {
    clearTimeout(showReminderTimer)
    showReminderTimer = null
  }
}

function playReminderSound(win) {
  win.webContents.executeJavaScript(`
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const notes = [800, 1000, 1200]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + i * 0.15)
        osc.stop(ctx.currentTime + i * 0.15 + 0.2)
      })
    } catch(e) {}
  `)
}

function showNextReminder() {
  if (isShowingReminder) return
  if (reminderQueue.length === 0) return

  isShowingReminder = true
  const reminder = reminderQueue.shift()
  const { width: screenW, height: screenH } = require('electron').screen.getPrimaryDisplay().workAreaSize
  const winW = 340
  const winH = 130

  const offsetIndex = reminderWindowOffset
  reminderWindowOffset++
  const offsetY = offsetIndex * 80
  const x = screenW - winW - 20
  const y = screenH - winH - 20 - offsetY
  if (y < 0) reminderWindowOffset = 0

  const win = new BrowserWindow({
    width: winW,
    height: winH,
    x,
    y,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  win.setMenuBarVisibility(false)

  const title = escapeHtml(reminder.name || '任务提醒')
  const body = reminder.body || ''
  const listName = escapeHtml(reminder.listName || '')
  const groupName = escapeHtml(reminder.groupName || '')
  const subtitle = [listName, groupName].filter(Boolean).join(' / ')

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>提醒</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; height: 100vh; display: flex; flex-direction: column; border: 1px solid rgba(102,126,234,0.3); border-radius: 10px; overflow: hidden; }
        .header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px 6px; }
        .header .bell { font-size: 18px; }
        .header .close-btn { width: 24px; height: 24px; border: none; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); border-radius: 4px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; line-height: 1; -webkit-app-region: no-drag; }
        .header .close-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
        .body { flex: 1; padding: 0 14px 10px; display: flex; flex-direction: column; justify-content: center; }
        .title { font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 4px; }
        .subtitle { font-size: 11px; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
        .info { font-size: 12px; color: rgba(255,255,255,0.55); }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="bell">🔔</span>
        <button class="close-btn" onclick="window.close()">✕</button>
      </div>
      <div class="body">
        <div class="title">${title}</div>
        ${subtitle ? '<div class="subtitle">' + subtitle + '</div>' : ''}
        <div class="info">${body}</div>
      </div>
    </body>
    </html>
  `)}`)

  win.on('closed', () => {
    reminderWindowStack = reminderWindowStack.filter(w => w !== win)
    reminderWindowOffset = Math.max(0, reminderWindowOffset - 1)
    reminderWindowDataMap.delete(win)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('reminder-closed', { id: reminder.id })
    }
  })

  win.once('ready-to-show', () => {
    playReminderSound(win)
    isShowingReminder = false
    if (reminderQueue.length > 0) {
      showReminderTimer = setTimeout(() => {
        showReminderTimer = null
        showNextReminder()
      }, 5000)
    }
  })

  reminderWindowStack.push(win)
  reminderWindowDataMap.set(win, reminder)
  if (reminder.repeatStrategy && reminder.repeatStrategy !== 'none') {
    scheduleNextRepeat(reminder)
  }
}

function scheduleNextRepeat(reminder) {
  if (reminder.repeatEndStrategy === 'count' && reminder.repeatCount && reminder.repeatCompletedCount >= reminder.repeatCount) {
    debugLog('[提醒] 重复已结束（次数达到）: ' + reminder.name)
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
      debugLog('[提醒] 重复已结束（超过结束日期）: ' + reminder.name)
      return
    }
  }

  if (reminder.reminderStrategy === 'advance') {
    const offsetMs = ((reminder.reminderDays || 0) * 1440 + (reminder.reminderHours || 0) * 60 + (reminder.reminderMinutes || 0)) * 60000
    if (offsetMs > 0) nextTrigger.setTime(nextTrigger.getTime() - offsetMs)
  }

  const delay = nextTrigger.getTime() - Date.now()
  if (delay <= 0) {
    debugLog('[提醒] 下一轮提醒已过期: ' + reminder.name)
    return
  }

  if (delay > MAX_SCHEDULE_DELAY) {
    debugLog('[提醒] 下一轮提醒过于远期（' + formatDelay(delay) + '）: ' + reminder.name + '，下次启动时重新调度')
    return
  }

  debugLog('[提醒] 下一轮提醒: ' + reminder.name + ' 在 ' + formatDelay(delay) + '后')
  const nextReminder = { ...reminder, triggerTime: nextTrigger.toISOString() }
  const timer = setTimeout(() => enqueueReminder(nextReminder), delay)
  reminderTimers.push({ id: reminder.id, timeout: timer })
}

function enqueueReminder(reminder) {
  debugLog('[提醒] 加入队列: ' + (reminder.name || reminder.id))
  reminderQueue.push(reminder)
  showNextReminder()
}

ipcMain.handle('schedule-reminders', async (_event, reminders, persistDuration) => {
  debugLog('[提醒] 收到调度请求，共 ' + (reminders ? reminders.length : 0) + ' 条提醒')
  cancelAllReminderTimers()
  if (persistDuration != null) reminderPersistDuration = persistDuration

  if (!reminders || reminders.length === 0) return { ok: true, count: 0 }

  reminders.forEach(r => {
    const delay = new Date(r.triggerTime).getTime() - Date.now()
    if (delay <= 0) {
      debugLog('[提醒] 立即触发: ' + (r.name || r.id))
      enqueueReminder(r)
    } else if (delay > MAX_SCHEDULE_DELAY) {
      debugLog('[提醒] 跳过远期提醒: ' + (r.name || r.id) + ' (' + formatDelay(delay) + ')，下次启动时重新调度')
    } else {
      debugLog('[提醒] 计划提醒: ' + (r.name || r.id) + ' 在 ' + formatDelay(delay) + '后')
      const timer = setTimeout(() => enqueueReminder(r), delay)
      reminderTimers.push({ id: r.id, timeout: timer })
    }
  })
  return { ok: true, count: reminders.length }
})

ipcMain.handle('cancel-all-reminders', async () => {
  debugLog('[提醒] 取消所有提醒')
  cancelAllReminderTimers()
  return { ok: true }
})

ipcMain.handle('get-reminder-persist-duration', async () => {
  return { persistDuration: reminderPersistDuration }
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
  if (days > 0) return days + '天' + hours + '小时' + minutes + '分' + seconds + '秒'
  if (hours > 0) return hours + '小时' + minutes + '分' + seconds + '秒'
  if (minutes > 0) return minutes + '分' + seconds + '秒'
  return seconds + '秒'
}

const MAX_SCHEDULE_DELAY = 20 * 24 * 3600 * 1000
// ====== 提醒系统结束 ======

app.whenReady().then(async () => {
  if (!gotTheLock) {
    debugLog('[Main] 没有获取单实例锁，跳过启动')
    return
  }
  closeAction = getCloseAction()
  debugLog('[Main] 关闭按钮行为', { action: closeAction })
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
    setupTray()

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
  cancelAllReminderTimers()
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
