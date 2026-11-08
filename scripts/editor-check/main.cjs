const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
app.setPath('userData', process.env.ESD_EDITOR_CHECK_PROFILE)
const timeout = setTimeout(() => { console.error('[check] 测试超时'); app.exit(1) }, 120000)
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, nodeIntegration: false } })
  window.webContents.on('console-message', event => {
    if (event.message?.startsWith('[check]')) console.log(event.message)
    else if (event.level === 'error') console.error('[renderer] ' + event.message)
  })
  await window.loadURL(process.env.ESD_EDITOR_CHECK_URL)
  const result = await window.webContents.executeJavaScript('window.editorCheckPromise')
  if (!Array.isArray(result)) throw new Error('测试页面未能运行')
  if (process.env.ESD_EDITOR_CHECK_SCREENSHOTS_DIR) {
    const directory = process.env.ESD_EDITOR_CHECK_SCREENSHOTS_DIR
    await fs.mkdir(directory, { recursive: true })
    for (const kind of ['image', 'video', 'math', 'code']) {
      await window.webContents.executeJavaScript('window.showEditorCheckPreview(' + JSON.stringify(kind) + ')')
      await fs.writeFile(path.join(directory, kind + '.png'), (await window.capturePage()).toPNG())
    }
    console.log('[check] 弹窗截图：' + directory)
  }
  const failed = result.filter(item => !item.ok)
  for (const item of failed) console.error('[check] FAIL ' + item.name + ': ' + item.error)
  console.log('[check] ' + (result.length - failed.length) + '/' + result.length + ' passed')
  clearTimeout(timeout)
  app.exit(failed.length ? 1 : 0)
}).catch(error => { console.error(error); app.exit(1) })
