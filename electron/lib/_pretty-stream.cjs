/**
 * 自定义 Pino transport target：把 JSON line 格式化为
 *   [HH:mm:ss.l] [LEVEL] [名称] 消息内容
 *
 * 三段颜色各自独立：
 *   时间段 → 固定灰
 *   级别段 → 每个级别一个颜色
 *   名称段 → 从 msg 里提取 [xxx] 前缀，固定蓝色
 *
 * 不用 pino-pretty 的原因：
 *   transport 模式下 messageFormat 会触发双层 prettifier，
 *   translateTime 的 token 在 transport 里部分失效（.SSS → ththth），
 *   levelLabel 也拿不到值。自己写 stream 完全可控。
 */
const { Transform } = require('stream')

// level number → label
const LEVEL_MAP = { 10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL' }

// ANSI 颜色
const C = {
  TIME:   '\x1b[90m',   // 时间：灰（固定）
  TRACE:  '\x1b[90m',   // TRACE：亮灰
  DEBUG:  '\x1b[36m',   // DEBUG：青
  INFO:   '\x1b[32m',   // INFO：绿
  WARN:   '\x1b[33m',   // WARN：黄
  ERROR:  '\x1b[31m',   // ERROR：红
  FATAL:  '\x1b[91m',   // FATAL：亮红
  NAME:   '\x1b[34m',   // 名称：蓝（固定）
  RESET:  '\x1b[0m'
}

const CHANNEL_NAMES = {
  Auth: 'Account', CountdownList: 'Countdown', ListPage: 'List', ListStore: 'List',
  PageNav: 'Navigation', ProdServer: 'Server', TaskList: 'Footprint',
  '账号': 'Account', '关于': 'About', '导入': 'Import', '倒数日': 'Countdown',
  '笔记': 'Notes', '足迹': 'Footprint', '足迹卡片': 'Footprint',
  '专注': 'Focus', '提醒': 'Reminder', '更新': 'Update', '工具箱': 'Toolbox',
  '市场': 'Market', '市场面板': 'Market', '课程表': 'Schedule', '清理': 'Cleanup',
  '设置': 'Settings', '我的': 'Profile', '引导': 'Guide', '预加载': 'Preload',
  '数据': 'Data', '统计': 'Statistics'
}

const META_LABELS = {
  id: '编号', userId: '用户编号', userEmail: '用户邮箱', taskId: '记录编号', listId: '清单编号',
  groupId: '分组编号', toolId: '工具编号', toolName: '工具名称', pluginId: '插件编号',
  email: '邮箱', oldEmail: '原邮箱', newEmail: '新邮箱', name: '名称', title: '标题',
  error: '错误', err: '错误', info: '说明', status: '状态', statusCode: '状态码',
  success: '是否成功', count: '数量', notes: '笔记数量', trashed: '回收站笔记数量', tags: '标签数量', users: '用户数量',
  modules: '模块', page: '页面', route: '路由',
  currentPage: '当前页面', savedPage: '已保存页面', default: '默认页面', navPath: '导航路径',
  currentNavPath: '当前导航路径', restoredPath: '恢复后的路径', currentPath: '当前路径',
  prev: '原值', next: '新值', from: '来源', to: '目标', fromIndex: '原位置', toIndex: '新位置',
  persist: '是否持久保存', isLoaded: '是否已加载', isAuthenticated: '是否已登录',
  wasAuthenticated: '原登录状态', dataInitialized: '数据是否已初始化', result: '结果',
  segments: '路径段', foldersCount: '文件夹数量', listsCount: '清单数量', tasksCount: '任务数量',
  toolCount: '工具数量', pluginCount: '插件数量', pageCount: '页面数量', storeCount: '存储数量',
  milestones: '倒数日数量', categories: '分类数量', range: '范围', date: '日期', week: '周数',
  category: '分类', value: '值', label: '标签', type: '类型', enabled: '是否启用', action: '操作',
  width: '宽度', height: '高度', oldVersion: '旧版本', newVersion: '新版本', current: '当前版本',
  latestVersion: '最新版本', threshold: '清理阈值', step: '步骤', fromStep: '起始步骤',
  duration: '时长', persistDuration: '弹窗显示时长', triggerTime: '触发时间', nextHourMark: '下一个整点',
  method: '请求方法', url: '地址', endpoint: '接口地址', repoUrl: '仓库地址', durationMs: '耗时', pid: '进程号',
  hostname: '主机名', previous: '原值', updated: '更新时间', affected: '受影响数量', orders: '排序结果',
  index: '序号', oldName: '原名称', newName: '新名称', currentModule: '当前模块',
  fromModule: '原模块', toModule: '目标模块', key: '键', module: '模块', errorCode: '错误代码',
  usersCount: '用户数量', userCount: '用户数量', recordCount: '记录数量', reminder: '提醒设置',
  repeat: '重复设置', pinned: '是否置顶', folderId: '文件夹编号', folderName: '文件夹名称',
  listName: '清单名称', taskName: '任务名称', completed: '是否完成', source: '来源', target: '目标',
  message: '消息', loaded: '已加载数量', countdownReminderCount: '倒数日提醒数量', courseCount: '课程数量',
  newVal: '新值', oldValue: '原值', newValue: '新值', isTaskRoot: '是否处于清单根目录',
  showBreadcrumb: '是否显示路径导航', oldPath: '原路径', newPath: '新路径',
  closeAction: '关闭按钮行为', currentNavModule: '当前导航模块'
}

const TEXT_REPLACEMENTS = [
  [/onErrorCaptured/g, '错误捕获回调'], [/initializeData/g, '初始化数据'], [/router\.replace/g, '路由切换'],
  [/currentPage/g, '当前页面'], [/savedPage/g, '已保存页面'], [/dataInitialized/g, '数据初始化状态'],
  [/isAuthenticated/g, '登录状态'], [/route watch/g, '路由变化监听'], [/breadcrumb watch/g, '路径导航监听'],
  [/isTaskRoot/g, '是否处于清单根目录'], [/showBreadcrumb/g, '是否显示路径导航'],
  [/initTaskState/g, '初始化任务状态'], [/initFilterState/g, '初始化筛选状态'],
  [/restoreModuleNavPath/g, '恢复模块导航路径'], [/setNavPath/g, '设置导航路径'],
  [/onMounted/g, '页面挂载'], [/navPath/g, '导航路径'], [/loadData/g, '加载数据'], [/guard/g, '保护条件'],
  [/README/gi, '说明文档'], [/manifest/gi, '插件清单'], [/\bplugin\b/gi, '插件'],
  [/\broute\b/gi, '路由'], [/\bmodule\b/gi, '模块'], [/\bwatch\b/gi, '监听'],
  [/\bcomputed\b/gi, '计算属性'], [/\bresult\b/gi, '结果'], [/Network Error/gi, '网络错误'],
  [/Failed to fetch/gi, '获取失败'], [/Request failed with status code/gi, '请求失败，状态码'],
  [/Cannot find channel/gi, '找不到更新通道'], [/update info/gi, '更新信息'],
  [/HttpError/gi, '网络请求错误'], [/\bNot Found\b/gi, '未找到'],
  [/\bBad Request\b/gi, '请求错误'], [/\bUnauthorized\b/gi, '未授权'],
  [/\bForbidden\b/gi, '禁止访问'], [/\bInternal Server Error\b/gi, '服务器内部错误'],
  [/\bGateway Timeout\b/gi, '网关超时'], [/\bHeaders\b/gi, '请求头'],
  [/\bcontent-length\b/gi, '内容长度'], [/\bcontent-type\b/gi, '内容类型'],
  [/\bconnection\b/gi, '连接'], [/\bmethod:\s*GET\b/gi, '请求方法：读取'],
  [/\bmethod:\s*POST\b/gi, '请求方法：提交'], [/\bmethod:\s*PUT\b/gi, '请求方法：更新'],
  [/\bmethod:\s*DELETE\b/gi, '请求方法：删除'], [/\bHTTP\b/gi, '网络请求'],
  [/Cannot read properties of null/gi, '无法读取空值的属性'],
  [/Cannot read properties of undefined/gi, '无法读取未定义值的属性'],
  [/Checking for update/gi, '正在检查更新'], [/Update not available/gi, '当前没有可用更新'],
  [/Downloading update/gi, '正在下载更新'], [/Update downloaded/gi, '更新已下载'],
  [/download progress/gi, '下载进度'], [/Error in auto-updater/gi, '自动更新程序发生错误'],
  [/^TypeError:\s*/g, '类型错误：'], [/^ReferenceError:\s*/g, '引用错误：'],
  [/^RangeError:\s*/g, '范围错误：'], [/^Error:\s*/g, '错误：'],
  [/\btrue\b/gi, '是'], [/\bfalse\b/gi, '否']
]

const MODULE_LABELS = {
  footprint: '足迹', list: '清单', countdown: '倒数日', focus: '专注', notes: '笔记',
  toolbox: '工具箱', course: '课程表', statistics: '统计', profile: '我的',
  custom: '自定义', smart: '智能', trash: '回收站'
}
const ACTION_LABELS = { exit: '退出', minimize: '最小化', hide: '隐藏', close: '关闭' }
const ENUM_LABELS = {
  action: ACTION_LABELS, closeAction: ACTION_LABELS,
  type: { pomodoro: '番茄钟', stopwatch: '正计时' },
  status: { checking: '正在检查', available: '有可用更新', 'no-update': '已是最新版本', downloading: '正在下载', downloaded: '已下载完成', error: '失败' },
  range: { day: '日', week: '周', month: '月', year: '年' },
  repeat: { none: '不重复', hourly: '每小时', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' },
  reminder: { none: '不提醒', on_time: '准时提醒', advance: '提前提醒' }
}
const ROUTE_KEYS = new Set(['route', 'currentPage', 'savedPage', 'default', 'module', 'currentModule', 'fromModule', 'toModule', 'navPath', 'currentNavPath', 'restoredPath', 'currentPath', 'path'])
const NAV_PATH_KEYS = new Set(['navPath', 'currentNavPath', 'restoredPath', 'currentPath'])
const PATH_SEGMENT_LABELS = {
  smart: '智能清单', custom: '自定义清单', all: '全部', __all__: '全部',
  today: '今天', expired: '已过期', future: '未来七天', recent: '最近',
  favorites: '收藏', trash: '回收站', archived: '归档'
}

function formatLogDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

function formatNavigationPath(value) {
  try {
    return Array.from(value, item => {
      const segment = String(item)
      return MODULE_LABELS[segment] || PATH_SEGMENT_LABELS[segment] || segment
    }).join(' / ') || '未设置'
  } catch {
    return '导航路径暂不可读取'
  }
}

function localizeLogText(value) {
  return TEXT_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value))
}

const ERROR_TEXT_REPLACEMENTS = [
  [/Network Error/gi, '网络错误'], [/Failed to fetch/gi, '获取失败'],
  [/Request failed with status code/gi, '请求失败，状态码'],
  [/Cannot find channel/gi, '找不到更新通道'], [/update info/gi, '更新信息'],
  [/HttpError/gi, '网络请求错误'], [/\bNot Found\b/gi, '未找到'],
  [/\bBad Request\b/gi, '请求错误'], [/\bUnauthorized\b/gi, '未授权'],
  [/\bForbidden\b/gi, '禁止访问'], [/\bInternal Server Error\b/gi, '服务器内部错误'],
  [/\bGateway Timeout\b/gi, '网关超时'], [/\bHeaders\b/gi, '请求头'],
  [/\bcontent-length\b/gi, '内容长度'], [/\bcontent-type\b/gi, '内容类型'],
  [/\bmethod:\s*GET\b/gi, '请求方法：读取'], [/\bmethod:\s*POST\b/gi, '请求方法：提交'],
  [/\bmethod:\s*PUT\b/gi, '请求方法：更新'], [/\bmethod:\s*DELETE\b/gi, '请求方法：删除'],
  [/\bHTTP\b/gi, 'http'], [/^TypeError:\s*/g, '类型错误：'],
  [/^ReferenceError:\s*/g, '引用错误：'], [/^RangeError:\s*/g, '范围错误：'],
  [/^Error:\s*/g, '错误：']
]
function localizeErrorText(value) {
  return ERROR_TEXT_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value))
}

function localizedObject(value, key = '') {
  if (Array.isArray(value) && NAV_PATH_KEYS.has(key)) return formatNavigationPath(value)
  if (Array.isArray(value)) return value.map(item => localizedObject(item, key))
  if (typeof value === 'string' && key === 'triggerTime') return formatLogDateTime(value)
  if (typeof value === 'string' && (key === 'error' || key === 'err' || key === 'message')) return localizeErrorText(value)
  if (typeof value === 'string' && ENUM_LABELS[key] && ENUM_LABELS[key][value]) return ENUM_LABELS[key][value]
  if (typeof value === 'string' && ROUTE_KEYS.has(key)) return MODULE_LABELS[value] || value
  if (typeof value === 'string' && (key === 'action' || key === 'closeAction')) return ACTION_LABELS[value] || value
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value && typeof value === 'object' && !(value instanceof Error)) {
    return Object.fromEntries(Object.entries(value).map(([nestedKey, item]) => [META_LABELS[nestedKey] || nestedKey, localizedObject(item, nestedKey)]))
  }
  return value
}

function formatChannel(name, fallback = 'Main') {
  const channel = CHANNEL_NAMES[name.trim()] || name.trim() || fallback
  const padding = Math.max(0, 12 - channel.length)
  const left = Math.floor(padding / 2)
  return '[' + ' '.repeat(left) + channel + ' '.repeat(padding - left) + ']'
}

function singleLine(value) {
  return String(value).replace(/[\r\n\t]+/g, ' ').trim()
}

function formatValue(value, key = '') {
  if (Array.isArray(value) && NAV_PATH_KEYS.has(key)) return formatNavigationPath(value)
  if (typeof value === 'string') {
    const text = singleLine(value)
    if (key === 'triggerTime') return formatLogDateTime(text)
    if (ENUM_LABELS[key] && ENUM_LABELS[key][text]) return ENUM_LABELS[key][text]
    if (ROUTE_KEYS.has(key)) return MODULE_LABELS[text] || text
    if (key === 'action' || key === 'closeAction') return ACTION_LABELS[text] || text
    return key === 'error' || key === 'err' || key === 'message' ? localizeErrorText(text) : text
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === undefined) return '未定义'
  if (value === null) return '空值'
  if (typeof value === 'object') {
    try { return singleLine(JSON.stringify(localizedObject(value, key))) } catch { return '[无法序列化]' }
  }
  return String(value)
}

function formatTime(isoOrEpoch) {
  const d = new Date(isoOrEpoch)
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false })
  return `${time}.${ms}`
}

function prettyErr(err) {
  if (!err) return ''
  const e = err instanceof Error ? err : (err.message ? err : null)
  if (!e) return ''
  const msg = localizeErrorText(e.message || String(e))
  const stack = e.stack ? e.stack.split('\n').slice(1, 4).map(line => line.trim()).filter(Boolean).join(' ← ') : ''
  return `，错误：${singleLine(msg)}${stack ? `（${singleLine(stack)}）` : ''}`
}

function createStream(options) {
  const colorize = options && options.colorize
  const stream = new Transform({
    objectMode: false,
    transform(chunk, _enc, cb) {
      try {
        const line = chunk.toString().trim()
        if (!line) { cb(null); return }
        const log = JSON.parse(line)
        const label = (LEVEL_MAP[log.level] || String(log.level)).padEnd(5, ' ')
        const time = formatTime(log.time)
        let msg = singleLine(log.msg || '')

        // 从 msg 里提取 [名称] 前缀：如 "[Main] xxx" → name="[Main]", body="xxx"
        // 没有 [名称] 前缀的，name 为空，body 就是原 msg
        let namePart = ''
        let bodyPart = msg
        const m = msg.match(/^\[([^\]]+)\]\s*/)
        if (m) {
          namePart = formatChannel(m[1])
          bodyPart = localizeLogText(msg.substring(m[0].length))
        } else {
          namePart = formatChannel('', 'Main')
          bodyPart = localizeLogText(bodyPart)
        }

        // 把附加上下文（除了常用字段）追加在末尾
        const skip = new Set(['level', 'time', 'msg', 'name', 'err', 'pid', 'hostname'])
        const extras = []
        for (const k of Object.keys(log)) {
          if (!skip.has(k)) {
            extras.push(`${META_LABELS[k] || k}: ${formatValue(log[k], k)}`)
          }
        }

        // === 颜色拼接 ===
        if (colorize) {
          const t = C.TIME   // 时间：灰
          const l = C[label] || C.INFO  // 级别：各自颜色
          const n = C.NAME   // 名称：蓝
          const r = C.RESET

          let out = `${t}[${time}]${r} ${l}[${label}]${r}`
          if (namePart) out += ` ${n}${namePart}${r}`
          out += ` ${bodyPart}`
          if (log.err) out += prettyErr(log.err)
          if (extras.length) out += '，' + extras.join('，')
          out += '\n'
          cb(null, out)
        } else {
          let out = `[${time}] [${label}]`
          if (namePart) out += ` ${namePart}`
          out += ` ${bodyPart}`
          if (log.err) out += prettyErr(log.err)
          if (extras.length) out += '，' + extras.join('，')
          out += '\n'
          cb(null, out)
        }
      } catch (e) { cb(null, chunk) }
    }
  })
  return stream
}

// Pino transport target 入口：模块导出一个能返回 stream 的工厂
// pino transport targets 用 worker_threads，stdio inherit，所以 Transform 的 readable 必须显式 pipe 到 process.stdout
module.exports = function (options) {
  const stream = createStream(options)
  stream.pipe(process.stdout)
  return stream
}
