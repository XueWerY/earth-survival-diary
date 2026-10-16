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

const FALLBACK_META_LABELS = {
  id: '编号', userId: '用户编号', userEmail: '用户邮箱', email: '邮箱', error: '错误', err: '错误',
  info: '说明', count: '数量', trashed: '回收站笔记数量', status: '状态', statusCode: '状态码', path: '路径', file: '文件', triggerTime: '触发时间',
  toolId: '工具编号', toolName: '工具名称', pluginId: '插件编号', duration: '时长', durationMs: '耗时', pid: '进程号',
  userCount: '用户数量', recordCount: '记录数量', success: '是否成功', enabled: '是否启用', action: '操作',
  name: '名称', title: '标题', type: '类型', module: '模块', modules: '模块', route: '路由', navPath: '导航路径',
  currentPage: '当前页面', savedPage: '已保存页面', countDown: '倒数日数量', toolCount: '工具数量',
  pluginCount: '插件数量', current: '当前版本', latestVersion: '最新版本', oldVersion: '旧版本', newVersion: '新版本',
  isTaskRoot: '是否处于清单根目录', showBreadcrumb: '是否显示路径导航', oldPath: '原路径', newPath: '新路径',
  foldersCount: '文件夹数量', listsCount: '清单数量', tasksCount: '任务数量', category: '分类',
  range: '范围', date: '日期', week: '周数', source: '来源', target: '目标', persist: '是否持久保存'
}

function localizeFallbackText(value) {
  return String(value)
    .replace(/Network Error/gi, '网络错误')
    .replace(/Failed to fetch/gi, '获取失败')
    .replace(/Request failed with status code/gi, '请求失败，状态码')
    .replace(/Cannot find channel/gi, '找不到更新通道')
    .replace(/update info/gi, '更新信息')
    .replace(/HttpError/gi, '网络请求错误')
    .replace(/\bNot Found\b/gi, '未找到')
    .replace(/\bBad Request\b/gi, '请求错误')
    .replace(/\bUnauthorized\b/gi, '未授权')
    .replace(/\bForbidden\b/gi, '禁止访问')
    .replace(/\bInternal Server Error\b/gi, '服务器内部错误')
    .replace(/\bGateway Timeout\b/gi, '网关超时')
    .replace(/\bHeaders\b/gi, '请求头')
    .replace(/\bcontent-length\b/gi, '内容长度')
    .replace(/\bcontent-type\b/gi, '内容类型')
    .replace(/\bconnection\b/gi, '连接')
    .replace(/\bmethod:\s*GET\b/gi, '请求方法：读取')
    .replace(/\bmethod:\s*POST\b/gi, '请求方法：提交')
    .replace(/\bmethod:\s*PUT\b/gi, '请求方法：更新')
    .replace(/\bmethod:\s*DELETE\b/gi, '请求方法：删除')
    .replace(/\bHTTP\b/gi, 'http')
    .replace(/Cannot read properties of null/gi, '无法读取空值的属性')
    .replace(/Cannot read properties of undefined/gi, '无法读取未定义值的属性')
    .replace(/Checking for update/gi, '正在检查更新')
    .replace(/Update not available/gi, '当前没有可用更新')
    .replace(/Downloading update/gi, '正在下载更新')
    .replace(/Update downloaded/gi, '更新已下载')
    .replace(/download progress/gi, '下载进度')
    .replace(/Error in auto-updater/gi, '自动更新程序发生错误')
    .replace(/^TypeError:\s*/g, '类型错误：')
    .replace(/^ReferenceError:\s*/g, '引用错误：')
    .replace(/^RangeError:\s*/g, '范围错误：')
    .replace(/^Error:\s*/g, '错误：')
}

function formatFallbackValue(key, value) {
  if (value instanceof Error) return localizeFallbackText(value.message)
  if (Array.isArray(value) && ['navPath', 'currentNavPath', 'restoredPath', 'currentPath'].includes(key)) {
    const modules = { footprint: '足迹', notes: '笔记', focus: '专注', list: '清单', countdown: '倒数日', course: '课程表', statistics: '统计', toolbox: '工具箱', profile: '我的' }
    const segments = { smart: '智能清单', custom: '自定义清单', all: '全部', __all__: '全部', today: '今天', expired: '已过期', future: '未来七天', recent: '最近', favorites: '收藏', trash: '回收站', archived: '归档' }
    try { return value.map(item => modules[String(item)] || segments[String(item)] || String(item)).join(' / ') || '未设置' } catch { return '导航路径暂不可读取' }
  }
  if (key === 'triggerTime' && typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === undefined) return '未定义'
  if (value === null) return '空值'
  if (typeof value === 'object') {
    try {
      const localizeObject = (item) => {
        if (Array.isArray(item)) return item.map(localizeObject)
        if (typeof item === 'boolean') return item ? '是' : '否'
        if (!item || typeof item !== 'object') return item
        return Object.fromEntries(Object.entries(item).map(([nestedKey, nestedValue]) => {
          const value = typeof nestedValue === 'string' && (nestedKey === 'error' || nestedKey === 'err' || nestedKey === 'message')
            ? localizeFallbackText(nestedValue)
            : localizeObject(nestedValue)
          return [FALLBACK_META_LABELS[nestedKey] || nestedKey, value]
        }))
      }
      return JSON.stringify(localizeObject(value))
    } catch { return '[无法序列化]' }
  }
  const text = String(value)
  const enumLabels = {
    action: { exit: '退出', minimize: '最小化', hide: '隐藏', close: '关闭' },
    closeAction: { exit: '退出', minimize: '最小化', hide: '隐藏', close: '关闭' },
    type: { pomodoro: '番茄钟', stopwatch: '正计时' },
    status: { checking: '正在检查', available: '有可用更新', 'no-update': '已是最新版本', downloading: '正在下载', downloaded: '已下载完成', error: '失败' },
    range: { day: '日', week: '周', month: '月', year: '年' },
    repeat: { none: '不重复', hourly: '每小时', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' },
    reminder: { none: '不提醒', on_time: '准时提醒', advance: '提前提醒' }
  }
  if (enumLabels[key] && enumLabels[key][text]) return enumLabels[key][text]
  return key === 'error' || key === 'err' || key === 'message' ? localizeFallbackText(text) : text
}

const FALLBACK_CHANNEL_NAMES = {
  Auth: 'Account', CountdownList: 'Countdown', ListPage: 'List', ListStore: 'List',
  PageNav: 'Navigation', ProdServer: 'Server', TaskList: 'Footprint',
  '账号': 'Account', '关于': 'About', '导入': 'Import', '倒数日': 'Countdown',
  '笔记': 'Notes', '足迹': 'Footprint', '足迹卡片': 'Footprint',
  '专注': 'Focus', '提醒': 'Reminder', '更新': 'Update', '工具箱': 'Toolbox',
  '市场': 'Market', '市场面板': 'Market', '课程表': 'Schedule', '清理': 'Cleanup',
  '设置': 'Settings', '我的': 'Profile', '引导': 'Guide', '预加载': 'Preload',
  '数据': 'Data', '统计': 'Statistics'
}

function fallbackLog(level, msg, meta) {
  const message = String(msg || '').replace(/[\r\n\t]+/g, ' ').trim()
  const match = message.match(/^\[([^\]]+)\]\s*(.*)$/)
  const rawChannel = match ? match[1].trim() : 'Main'
  const channel = FALLBACK_CHANNEL_NAMES[rawChannel] || rawChannel
  const body = localizeFallbackText(match ? match[2] : message)
  const padding = Math.max(0, 12 - channel.length)
  const left = Math.floor(padding / 2)
  const channelTag = '[' + ' '.repeat(left) + channel + ' '.repeat(padding - left) + ']'
  const details = meta instanceof Error
    ? `错误：${localizeFallbackText(meta.message)}`
    : meta && typeof meta === 'object'
    ? Object.entries(meta).map(([key, value]) => `${FALLBACK_META_LABELS[key] || key}: ${formatFallbackValue(key, value)}`).join('，')
    : ''
  const now = new Date()
  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0')
  const label = String(level).toUpperCase().padEnd(5, ' ')
  const method = level === 'TRACE' || level === 'DEBUG' ? 'log' : level.toLowerCase()
  console[method](`[${time}] [${label}] ${channelTag} ${body}${details ? '，' + details : ''}`)
}

/**
 * 解析 pino / pino-roll。
 * 开发模式：electron/node_modules 在模块目录树内，require() 正常命中；
 * 打包后：electron/node_modules 经 extraResources 复制到 <app>/resources/node_modules，
 * 而 app.asar 内不含这些依赖，因此 require() 失败时回退到资源目录绝对路径加载。
 */
function resolvePkg(name) {
  try { return require(name) } catch (e) {
    const resPath = path.join(process.resourcesPath, 'node_modules', name)
    try { return require(resPath) } catch (e2) { throw e }
  }
}

function resolvePkgTarget(name) {
  try { return require.resolve(name) } catch (e) {
    const resPath = path.join(process.resourcesPath, 'node_modules', name)
    try { return require.resolve(resPath) } catch (e2) { throw e }
  }
}

function resolveTargets() {
  if (pinoRollTarget) return
  try { pino = resolvePkg('pino') } catch (e) { throw new Error('[logger] 缺少 pino 依赖：' + e.message) }
  try { pinoRollTarget = resolvePkgTarget('pino-roll') } catch (e) { throw new Error('[logger] 缺少 pino-roll 依赖：' + e.message) }
}

/**
 * 初始化 Electron 主进程的 Pino 单例。
 * 二次调用为 no-op（logger 单例只创建一次）。
 *
 * @param {string} dir 日志文件目录（绝对路径），如 path.join(app.getPath('userData'), 'logs')
 * @param {object} [opts]
 * @param {string} [opts.level]  全局日志级别（默认 info；开发模式自动使用 debug，可由此参数覆盖）
 * @param {boolean}[opts.gzip]   滚动时是否 gzip 压缩旧文件（默认 true）
 */
function initLogger(dir, opts = {}) {
  if (state.logger) return state.logger         // 单例保护

  resolveTargets()
  logDir = dir
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }) } catch (e) {
      fallbackLog('ERROR', '[Logger] 无法创建日志目录：' + dir + '；' + e.message)
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
  if (!state.logger) { fallbackLog('DEBUG', msg, meta); return }
  if (meta !== undefined && meta !== null) state.logger.debug(meta, msg)
  else state.logger.debug(msg)
}
function infoLog(msg, meta) {
  if (!state.logger) { fallbackLog('INFO', msg, meta); return }
  if (meta !== undefined && meta !== null) state.logger.info(meta, msg)
  else state.logger.info(msg)
}
function warnLog(msg, meta) {
  if (!state.logger) { fallbackLog('WARN', msg, meta); return }
  if (meta !== undefined && meta !== null) state.logger.warn(meta, msg)
  else state.logger.warn(msg)
}
function errorLog(msg, metaOrErr) {
  if (!state.logger) { fallbackLog('ERROR', msg, metaOrErr); return }
  if (metaOrErr instanceof Error) state.logger.error({ err: metaOrErr }, msg)
  else if (metaOrErr !== undefined && metaOrErr !== null) state.logger.error(metaOrErr, msg)
  else state.logger.error(msg)
}

// ---- 查找当天 / 最新日志文件的辅助（给 main.cjs 的读取逻辑用） ----
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
