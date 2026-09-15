/**
 * 开发模式运行器（npm run dev）
 *
 * 职责：
 *  - 启动 Vite dev server（127.0.0.1:5173，HMR），/api 请求经 vite.config.ts 的 proxy 转发给 Electron 内置服务
 *  - Vite 就绪后启动 Electron，注入环境变量：
 *      ESD_DEV_URL     → http://127.0.0.1:5173（主窗口改加载 Vite dev server）
 *      ESD_SERVER_PORT → 5000（内置 Express 固定端口，保证 proxy 目标确定）
 *  - 监听 electron/**\/*.cjs（主进程/preload/内置服务）变化，自动重启 Electron：
 *      先 taskkill /T /F 杀整棵进程树 → 等单实例锁与端口释放 → 重新启动（带锁冲突重试）
 *  - 退出时清理 Vite 与 Electron 子进程
 *
 * 仅用于开发调试，不参与生产构建（main.cjs 仅在存在 ESD_DEV_URL 时进入 dev 分支）。
 */
const { spawn, execSync } = require('child_process')
const net = require('net')
const fs = require('fs')
const path = require('path')

// ====== 日志格式化（与主进程 _pretty-stream.cjs 保持一致） ======
const C = {
  TIME:  '\x1b[90m',   // 时间：灰
  INFO:  '\x1b[32m',   // INFO：绿
  WARN:  '\x1b[33m',   // WARN：黄
  ERROR: '\x1b[31m',   // ERROR：红
  NAME:  '\x1b[34m',   // 名称：蓝
  RESET: '\x1b[0m'
}

function devLog(level, msg) {
  const pad2 = (n) => String(n).padStart(2, '0')
  const d = new Date()
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
  const label = level.toUpperCase().padEnd(5, ' ')
  // 名称段与主进程 _pretty-stream.cjs 保持一致：内部 12 字符居中，总包 [] 后 14 字符
  const nameText = 'Dev'
  const pad = 12 - nameText.length, lpad = Math.floor(pad / 2), rpad = pad - lpad
  const name = '[' + ' '.repeat(lpad) + nameText + ' '.repeat(rpad) + ']'
  const color = C[level.toUpperCase()] || C.INFO
  const out = `${C.TIME}[${time}]${C.RESET} ${color}[${label}]${C.RESET} ${C.NAME}${name}${C.RESET} ${msg}\n`
  process.stdout.write(out)
}
const devInfo  = (msg) => devLog('info', msg)
const devError = (msg) => devLog('error', msg)

// 纯 Node 上下文里 require('electron') 返回 Electron 可执行文件路径（node_modules/electron/dist/electron.exe）
const electronBin = require('electron')

const ROOT = path.resolve(__dirname, '..')
const VITE_PORT = 5173
const SERVER_PORT = 5000
const RENDERER_URL = 'http://127.0.0.1:' + VITE_PORT
// 与 electron/main.cjs 的 DEV_RESTART_EXIT_CODE 保持一致：应用请求重启（如注销/清理数据）时的约定退出码
const DEV_RESTART_EXIT_CODE = 58

let viteChild = null
let electronChild = null
let restarting = false
let shuttingDown = false
let lockRejected = false
let watchTimer = null
let changedFile = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 探测 127.0.0.1:port 是否可连接（true=可连接/占用） */
function probePort(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port })
    const done = (ok) => {
      sock.destroy()
      resolve(ok)
    }
    sock.on('connect', () => done(true))
    sock.on('error', () => done(false))
    sock.setTimeout(800)
    sock.on('timeout', () => done(false))
  })
}

/** 等待 Vite 开发服务器就绪 */
async function waitDevServerReady(timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await probePort(VITE_PORT)) return true
    await sleep(300)
  }
  return false
}

/** 等待端口释放（返回时端口已无人监听） */
async function waitPortFree(port, timeout = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (!(await probePort(port))) return true
    await sleep(300)
  }
  return false
}

// ====== Electron 管理 ======

function spawnElectron() {
  const env = {
    ...process.env,
    ESD_DEV_URL: RENDERER_URL,
    ESD_SERVER_PORT: String(SERVER_PORT)
  }
  electronChild = spawn(electronBin, ['.'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
  electronChild.stdout.on('data', (data) => {
    const text = data.toString()
    // 主进程 debugLog 输出的单实例拒绝日志（main.cjs gotTheLock === false 分支）
    if (text.includes('Another instance is already running')) lockRejected = true
    process.stdout.write(text)
  })
  electronChild.stderr.on('data', (data) => process.stderr.write(data))
  electronChild.on('close', (code) => {
    electronChild = null
    // 退出码为约定值时（应用主动请求重启，如注销/清理数据），重新拉起 Electron
    if (!shuttingDown && !restarting && code === DEV_RESTART_EXIT_CODE) {
      devInfo('应用请求重启（退出码 ' + code + '），重新拉起 Electron...')
      restartElectron('应用请求重启')
    }
  })
}

/** 杀 Electron 整棵进程树（含内置 Express 服务），等待其完全退出 */
function killElectronTree() {
  const child = electronChild
  if (!child) return Promise.resolve()
  electronChild = null
  return new Promise((resolve) => {
    child.on('close', resolve)
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { windowsHide: true })
    } catch (e) {
      resolve()
    }
  })
}

/** 启动 Electron；若 400ms 内检测到单实例锁冲突（旧实例尚未完全释放），杀掉重试 */
async function startElectronWithRetry() {
  for (let attempt = 0; attempt < 3; attempt++) {
    lockRejected = false
    spawnElectron()
    await sleep(400)
    if (lockRejected) {
      devInfo('检测到单实例锁冲突，等待旧实例退出后重试...')
      await killElectronTree()
      await sleep(300)
      continue
    }
    return
  }
  devError('多次启动失败（单实例锁持续冲突），请确认无其他实例占用 userData 目录')
}

/** 重启 Electron：杀树 → 释放锁/端口 → 重新启动 */
async function restartElectron(reason) {
  restarting = true
  devInfo(reason + '，重启主进程...')
  await killElectronTree()
  // 等待单实例命名互斥锁与内置服务端口释放，避免新实例被误判为重复启动
  await sleep(250)
  await waitPortFree(SERVER_PORT)
  await startElectronWithRetry()
  restarting = false
}

/** 监听 electron 目录，主进程/preload/内置服务改动即触发重启（200ms debounce） */
function setupWatch() {
  const dir = path.join(ROOT, 'electron')
  fs.watch(dir, { recursive: true }, (_event, filename) => {
    if (!filename) return
    if (restarting || shuttingDown || !electronChild) return
    if (filename.includes('node_modules')) return
    if (!filename.endsWith('.cjs')) return
    changedFile = filename
    clearTimeout(watchTimer)
    watchTimer = setTimeout(() => { restartElectron(filename + ' 发生变化') }, 200)
  })
}

// ====== Vite 管理 ======

function startVite() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  viteChild = spawn(process.execPath, [viteBin], { cwd: ROOT, stdio: 'inherit' })
  viteChild.on('exit', (code) => {
    viteChild = null
    if (!shuttingDown) {
      devInfo('Vite 开发服务器已退出（exit=' + code + '），本开发环境结束')
      cleanup()
    }
  })
}

function killVite() {
  if (viteChild) {
    try {
      viteChild.kill('SIGTERM')
    } catch (e) {}
    viteChild = null
  }
}

// ====== 生命周期 ======

function cleanup() {
  if (shuttingDown) return
  shuttingDown = true
  killVite()
  killElectronTree().then(() => process.exit(0))
  // 兜底强制退出
  setTimeout(() => process.exit(0), 1500).unref()
}

async function main() {
  if (await probePort(VITE_PORT)) {
    devError('端口 ' + VITE_PORT + ' 已被占用，请先关闭占用进程（strictPort 要求固定端口）')
    process.exit(1)
  }

  startVite()
  const ready = await waitDevServerReady()
  if (!ready) {
    devError('Vite 开发服务器未在 ' + VITE_PORT + ' 端口就绪，请查看上方 Vite 日志')
    cleanup()
    return
  }
  devInfo('Vite 开发服务器就绪：' + RENDERER_URL)

  // 给可能残留的旧服务/旧实例让出锁与端口
  await sleep(200)
  await waitPortFree(SERVER_PORT, 3000)
  await startElectronWithRetry()

  setupWatch()

  process.on('SIGINT', () => {
    process.stdout.write('\n')
    devInfo('正在退出...')
    cleanup()
  })
  process.on('SIGTERM', () => {
    devInfo('正在退出...')
    cleanup()
  })
}

main()