// 在独立 Electron 配置目录中验证真实 Vue/Milkdown 组件，不读取用户笔记。
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const { spawn } = require('node:child_process')

async function main() {
  const { createServer } = await import('vite')
  const root = path.resolve(__dirname, '..')
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'esd-editor-check-'))
  const server = await createServer({
    root,
    clearScreen: false,
    server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
    plugins: [{
      name: 'editor-check-page',
      configureServer(vite) {
        vite.middlewares.use('/__editor_check', (_req, res) => {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Editor checks</title><body><script type="module" src="/scripts/editor-check/renderer.ts"></script></body></html>')
        })
      },
    }],
  })
  try {
    await server.listen()
    const port = server.httpServer.address().port
    const env = { ...process.env, ESD_EDITOR_CHECK_URL: 'http://127.0.0.1:' + port + '/__editor_check', ESD_EDITOR_CHECK_PROFILE: profile }
    if (process.argv.includes('--screenshots')) env.ESD_EDITOR_CHECK_SCREENSHOTS_DIR = path.join(root, 'node_modules', '.tmp', 'editor-check')
    delete env.ELECTRON_RUN_AS_NODE
    const code = await new Promise((resolve, reject) => {
      const child = spawn(require('electron'), [path.join(__dirname, 'editor-check', 'main.cjs')], { cwd: root, env, stdio: 'inherit', windowsHide: true })
      child.on('error', reject)
      child.on('exit', resolve)
    })
    process.exitCode = code === 0 ? 0 : 1
  } finally {
    await server.close()
    if (path.dirname(path.resolve(profile)) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('esd-editor-check-')) throw new Error('拒绝清理非测试临时目录：' + profile)
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
