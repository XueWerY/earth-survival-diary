/**
 * Electron 端共享 Pino 日志实例
 *
 * 为避免 pino-roll / pino-pretty 等 transport target 在 pnpm 环境下无法被 Pino 的
 * 相对路径解析器定位（"unable to determine transport target"），所有 target 均使用
 * require.resolve() 得到的绝对路径。
 *
 * 使用方式（CommonJS）：
 *   const { initLogger, logger } = require('./lib/logger')
 *   initLogger(logDir)         // main.cjs: logDir = app.getPath('userData') + '/logs'
 *                              // prod-server.cjs: logDir = path.dirname(DATA_DIR) + '/logs'
 *   state.logger.info({ pid }, 'app ready')
 *   // 或兼容旧调用点的快捷方法：
 *   debugLog('some msg')
 *   errorLog('some error', { detail: e.message })
 */
const path = require('path')
const fs = require('fs')

let pino = null
let pinoRollTarget = null      // require.resolve('pino-roll')
let logDir = null               // 日志目录（userData/logs）

// 用对象引用包裹 logger，使解构 `const { state } = require(...)` 后仍能动态访问
// （CommonJS 解构 getter 会立即求值绑定到常量，丢失 getter 动态特性）
const state = { logger: null }

function resolveTargets() {
  if (pinoRollTarget) return
  try { pino = require('pino') } catch (e) { throw new Error('[logger] 缺少 pino 依赖：' + e.message) }
  try { pinoRollTarget = require.resolve('pino-roll') } catch (e) { throw new Error('[logger] 缺少 pino-roll 依赖：' + e.message) }

}

/**
 * 初始化 Pino 单例。主进程与 Express 服务在各自入口调用一次即可。
 * 二次调用为 no-op（logger 单例只创建一次）。
 *
 * @param {string} dir 日志文件目录（绝对路径），如 path.join(app.getPath('userData'), 'logs')
 * @param {object} [opts]
 * @param {string} [opts.level]  全局日志级别（默认 info；dev 环境自动降为 debug，可被此参数覆盖）
 * @param {boolean}[opts.gzip]   滚动时是否 gzip 压缩旧文件（默认 true）
 */
function initLogger(dir, opts = {}) {
  if (state.logger) return state.logger         // 单例保护

  resolveTargets()
  logDir = dir
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }) } catch (e) {
      console.error('[logger] 无法创建日志目录 ' + dir + '：' + e.message)
    }
  }

  const DEV = !!process.env.ESD_DEV_URL
  const level = opts.level || (DEV ? 'debug' : 'info')
  const gzip = opts.gzip !== false

  const rollOptions = {
    file: path.join(dir, 'app'),           // 输出 app.YYYY-MM-DD.N.log（N 是当天滚动计数）
    frequency: 'daily',                    // 每天滚动一次
    dateFormat: 'yyyy-MM-dd',              // pino-roll 内置 date-fns 格式
    mkdir: false,                          // 上面已手动 mkdir（避免 transport 启动时 race）
    gzip,
    level                                  // roll target 与根 logger 同级别
  }

  const targets = [{ target: pinoRollTarget, options: rollOptions, level }]

  // 开发模式额外 stdout target（自定义格式化：[HH:mm:ss.l] [LEVEL] msg）
  if (DEV) {
    targets.push({
      target: path.join(__dirname, '_pretty-stream.cjs'),
      level,
      options: { colorize: true }
    })
  }

  state.logger = pino({
    name: 'earth-survival-diary',
    level,
    base: null,            // 不自动注入 pid/hostname（主进程日志已有 PID 可用；Node 启动信息另存）
    timestamp: pino.stdTimeFunctions.isoTime,   // ISO 8601，比 epoch ms 可读性好
    transport: { targets }
  })

  return state.logger
}

// ---- 兼容旧 debugLog(msg) / errorLog(msg) 调用方式的快捷方法 ----
function debugLog(msg, meta) {
  if (!state.logger) { console.log('[DEBUG] ' + msg); return }
  if (meta !== undefined && meta !== null) state.logger.debug(meta, msg)
  else state.logger.debug(msg)
}
function infoLog(msg, meta) {
  if (!state.logger) { console.info('[INFO] ' + msg); return }
  if (meta !== undefined && meta !== null) state.logger.info(meta, msg)
  else state.logger.info(msg)
}
function warnLog(msg, meta) {
  if (!state.logger) { console.warn('[WARN] ' + msg); return }
  if (meta !== undefined && meta !== null) state.logger.warn(meta, msg)
  else state.logger.warn(msg)
}
function errorLog(msg, metaOrErr) {
  if (!state.logger) { console.error('[ERROR] ' + msg); return }
  if (metaOrErr instanceof Error) state.logger.error({ err: metaOrErr }, msg)
  else if (metaOrErr !== undefined && metaOrErr !== null) state.logger.error(metaOrErr, msg)
  else state.logger.error(msg)
}

// ---- 查找当天 / 最新日志文件的辅助（给 main.cjs / prod-server.cjs 的读取逻辑用） ----
/**
 * 从日志目录中按日期取最新文件。pino-roll 输出 app.YYYY-MM-DD.N.log，
 * 同一天可滚动成 app.YYYY-MM-DD.2.log / .3.log，取 mtime 最大的。
 * @param {string} dir 日志目录
 * @returns {string|null} 文件绝对路径；无日志时返回 null
 */
function findLatestLogFile(dir) {
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir)
    .filter(f => /^app\.\d{4}-\d{2}-\d{2}\.\d+\.log$/.test(f))
    .map(f => ({ name: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return files[0] ? files[0].path : null
}

module.exports = {
  // 初始化 + 访问
  initLogger,
  state,                              // 包含 state.logger（Pino 根实例）、state.logDir 等字段
  get logDir() { return logDir },

  // 快捷方法（兼容旧 debugLog / errorLog 签名）
  debugLog, infoLog, warnLog, errorLog,

  // 文件查找辅助
  findLatestLogFile
}