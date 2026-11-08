/** 浏览器开发启动器：运行 Vite 并打开本机浏览器。 */
const { spawn } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const server = spawn(process.execPath, [
  viteBin,
  '--host', '127.0.0.1',
  '--port', '5173',
  '--strictPort',
  '--open',
], { cwd: root, stdio: 'inherit' })

server.on('exit', code => { process.exitCode = code ?? 0 })
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!server.killed) server.kill(signal)
  })
}
