// 日志级别枚举
import { getCountdownCategoryLabel } from '../utils/navPathLabels'

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}

// 日志条目接口
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  meta?: Record<string, any>;
  stack?: string;
}

// 北京时间格式化工具
const formatBeijingTimestamp = (date: Date) => {
  return date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  }).replace(',', '.')
}

const LOG_CHANNEL_NAMES: Record<string, string> = {
  'Auth': 'Account',
  'CountdownList': 'Countdown',
  'ListPage': 'List',
  'ListStore': 'List',
  'PageNav': 'Navigation',
  'ProdServer': 'Server',
  'TaskList': 'Footprint',
  '账号': 'Account',
  '关于': 'About',
  '导入': 'Import',
  '倒数日': 'Countdown',
  '笔记': 'Notes',
  '足迹': 'Footprint',
  '足迹卡片': 'Footprint',
  '专注': 'Focus',
  '提醒': 'Reminder',
  '更新': 'Update',
  '工具箱': 'Toolbox',
  '市场': 'Market',
  '市场面板': 'Market',
  '课程表': 'Schedule',
  '清理': 'Cleanup',
  '设置': 'Settings',
  '我的': 'Profile',
  '引导': 'Guide',
  '预加载': 'Preload',
  '数据': 'Data',
  '统计': 'Statistics'
}

const LOG_META_LABELS: Record<string, string> = {
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
  countDown: '倒数日数量', milestones: '倒数日数量', categories: '分类数量', range: '范围',
  date: '日期', week: '周数', category: '分类', value: '值', label: '标签', type: '类型',
  enabled: '是否启用', action: '操作', width: '宽度', height: '高度', oldVersion: '旧版本',
  newVersion: '新版本', current: '当前版本', latestVersion: '最新版本', threshold: '清理阈值',
  step: '步骤', fromStep: '起始步骤', duration: '时长', persistDuration: '弹窗显示时长',
  triggerTime: '触发时间', nextHourMark: '下一个整点', method: '请求方法', url: '地址',
  endpoint: '接口地址', repoUrl: '仓库地址', durationMs: '耗时', pid: '进程号', hostname: '主机名',
  previous: '原值', updated: '更新时间', affected: '受影响数量', orders: '排序结果',
  index: '序号', oldName: '原名称', newName: '新名称', currentModule: '当前模块',
  fromModule: '原模块', toModule: '目标模块', key: '键', module: '模块', errorCode: '错误代码',
  reminder: '提醒设置', repeat: '重复设置', pinned: '是否置顶', folderId: '文件夹编号',
  folderName: '文件夹名称', listName: '清单名称', taskName: '任务名称', completed: '是否完成',
  source: '来源', target: '目标', message: '消息', loaded: '已加载数量',
  countdownReminderCount: '倒数日提醒数量', courseCount: '课程数量', newVal: '新值',
  oldValue: '原值', newValue: '新值', isTaskRoot: '是否处于清单根目录',
  showBreadcrumb: '是否显示路径导航', oldPath: '原路径', newPath: '新路径',
  closeAction: '关闭按钮行为', currentNavModule: '当前导航模块'
}

const LOG_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/onErrorCaptured/g, '错误捕获回调'],
  [/initializeData/g, '初始化数据'],
  [/router\.replace/g, '路由切换'],
  [/currentPage/g, '当前页面'],
  [/savedPage/g, '已保存页面'],
  [/dataInitialized/g, '数据初始化状态'],
  [/isAuthenticated/g, '登录状态'],
  [/route watch/g, '路由变化监听'],
  [/breadcrumb watch/g, '路径导航监听'],
  [/isTaskRoot/g, '是否处于清单根目录'],
  [/showBreadcrumb/g, '是否显示路径导航'],
  [/initTaskState/g, '初始化任务状态'],
  [/initFilterState/g, '初始化筛选状态'],
  [/restoreModuleNavPath/g, '恢复模块导航路径'],
  [/setNavPath/g, '设置导航路径'],
  [/onMounted/g, '页面挂载'],
  [/navPath/g, '导航路径'],
  [/loadData/g, '加载数据'],
  [/guard/g, '保护条件'],
  [/README/gi, '说明文档'],
  [/manifest/gi, '插件清单'],
  [/\bplugin\b/gi, '插件'],
  [/\broute\b/gi, '路由'],
  [/\bmodule\b/gi, '模块'],
  [/\bwatch\b/gi, '监听'],
  [/\bcomputed\b/gi, '计算属性'],
  [/\bresult\b/gi, '结果'],
  [/Network Error/gi, '网络错误'],
  [/Failed to fetch/gi, '获取失败'],
  [/Request failed with status code/gi, '请求失败，状态码'],
  [/Cannot find channel/gi, '找不到更新通道'],
  [/update info/gi, '更新信息'],
  [/HttpError/gi, '网络请求错误'],
  [/\bNot Found\b/gi, '未找到'],
  [/\bBad Request\b/gi, '请求错误'],
  [/\bUnauthorized\b/gi, '未授权'],
  [/\bForbidden\b/gi, '禁止访问'],
  [/\bInternal Server Error\b/gi, '服务器内部错误'],
  [/\bGateway Timeout\b/gi, '网关超时'],
  [/\bHeaders\b/gi, '请求头'],
  [/\bcontent-length\b/gi, '内容长度'],
  [/\bcontent-type\b/gi, '内容类型'],
  [/\bconnection\b/gi, '连接'],
  [/\bmethod:\s*GET\b/gi, '请求方法：读取'],
  [/\bmethod:\s*POST\b/gi, '请求方法：提交'],
  [/\bmethod:\s*PUT\b/gi, '请求方法：更新'],
  [/\bmethod:\s*DELETE\b/gi, '请求方法：删除'],
  [/\bHTTP\b/gi, 'http'],
  [/Cannot read properties of null/gi, '无法读取空值的属性'],
  [/Cannot read properties of undefined/gi, '无法读取未定义值的属性'],
  [/Checking for update/gi, '正在检查更新'],
  [/Update not available/gi, '当前没有可用更新'],
  [/Downloading update/gi, '正在下载更新'],
  [/Update downloaded/gi, '更新已下载'],
  [/download progress/gi, '下载进度'],
  [/Error in auto-updater/gi, '自动更新程序发生错误'],
  [/^TypeError:\s*/g, '类型错误：'],
  [/^ReferenceError:\s*/g, '引用错误：'],
  [/^RangeError:\s*/g, '范围错误：'],
  [/^Error:\s*/g, '错误：'],
  [/\btrue\b/gi, '是'],
  [/\bfalse\b/gi, '否']
]

const localizeLogText = (text: string): string =>
  LOG_TEXT_REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text)

const LOG_ERROR_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
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
  [/\bHTTP\b/gi, '网络请求'], [/^TypeError:\s*/g, '类型错误：'],
  [/^ReferenceError:\s*/g, '引用错误：'], [/^RangeError:\s*/g, '范围错误：'],
  [/^Error:\s*/g, '错误：']
]
const localizeLogError = (text: string): string =>
  LOG_ERROR_TEXT_REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text)

const MODULE_LOG_LABELS: Record<string, string> = {
  footprint: '足迹', list: '清单', countdown: '倒数日', focus: '专注', notes: '笔记',
  toolbox: '工具箱', course: '课程表', statistics: '统计', profile: '我的',
  custom: '自定义', smart: '智能', trash: '回收站'
}
const ACTION_LOG_LABELS: Record<string, string> = { exit: '退出', minimize: '最小化', hide: '隐藏', close: '关闭' }
const ENUM_LOG_LABELS: Record<string, Record<string, string>> = {
  action: ACTION_LOG_LABELS,
  closeAction: ACTION_LOG_LABELS,
  type: { pomodoro: '番茄钟', stopwatch: '正计时' },
  status: {
    checking: '正在检查', available: '有可用更新', 'no-update': '已是最新版本',
    downloading: '正在下载', downloaded: '已下载完成', error: '失败'
  },
  range: { day: '日', week: '周', month: '月', year: '年' },
  repeat: { none: '不重复', hourly: '每小时', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' },
  reminder: { none: '不提醒', on_time: '准时提醒', advance: '提前提醒' }
}

const LOG_ROUTE_KEYS = new Set([
  'route', 'currentPage', 'savedPage', 'default', 'module', 'currentModule', 'fromModule', 'toModule',
  'navPath', 'currentNavPath', 'restoredPath', 'currentPath', 'path'
])
const LOG_NAV_PATH_KEYS = new Set(['navPath', 'currentNavPath', 'restoredPath', 'currentPath'])
const LOG_PATH_SEGMENT_LABELS: Record<string, string> = {
  smart: '智能清单', custom: '自定义清单', all: '全部', __all__: '全部',
  today: '今天', expired: '已过期', future: '未来七天', recent: '最近',
  favorites: '收藏', trash: '回收站', archived: '归档',
  birthday: '生日', anniversary: '纪念日', holiday: '节日', travel: '旅行',
  entertainment: '娱乐', work: '工作', study: '学习', life: '生活'
}

const formatLogDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

const formatLogNavigationPath = (value: unknown[]): string => {
  try {
    return value.map((item, index) => {
      const segment = String(item)
      const dynamicCountdownLabel = String(value[0]) === 'countdown' && index === 1
        ? getCountdownCategoryLabel(segment)
        : undefined
      return MODULE_LOG_LABELS[segment] || dynamicCountdownLabel || LOG_PATH_SEGMENT_LABELS[segment] || segment
    }).join(' / ') || '未设置'
  } catch {
    return '导航路径暂不可读取'
  }
}

const localizeLogObject = (value: any, key = ''): any => {
  if (Array.isArray(value) && LOG_NAV_PATH_KEYS.has(key)) return formatLogNavigationPath(value)
  if (Array.isArray(value)) return value.map(item => localizeLogObject(item, key))
  if (typeof value === 'string' && key === 'triggerTime') return formatLogDateTime(value)
  if (typeof value === 'string' && (key === 'error' || key === 'err' || key === 'message')) return localizeLogError(value)
  if (typeof value === 'string' && LOG_ENUM_LABELS[key]?.[value]) return LOG_ENUM_LABELS[key][value]
  if (typeof value === 'string' && LOG_ROUTE_KEYS.has(key)) return MODULE_LOG_LABELS[value] || value
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (!value || typeof value !== 'object' || value instanceof Error) return value
  return Object.fromEntries(Object.entries(value).map(([nestedKey, item]) => [LOG_META_LABELS[nestedKey] || nestedKey, localizeLogObject(item, nestedKey)]))
}

const formatLogValue = (value: unknown, key = ''): string => {
  if (value instanceof Error) return localizeLogError(value.message.replace(/[\r\n\t]+/g, ' '))
  if (Array.isArray(value) && LOG_NAV_PATH_KEYS.has(key)) return formatLogNavigationPath(value)
  if (typeof value === 'string') {
    const normalized = value.replace(/[\r\n\t]+/g, ' ')
    if (key === 'triggerTime') return formatLogDateTime(normalized)
    if (ENUM_LOG_LABELS[key]?.[normalized]) return ENUM_LOG_LABELS[key][normalized]
    if (LOG_ROUTE_KEYS.has(key)) return MODULE_LOG_LABELS[normalized] || normalized
    if (key === 'action' || key === 'closeAction') return ACTION_LOG_LABELS[normalized] || normalized
    return key === 'error' || key === 'err' || key === 'message' ? localizeLogError(normalized) : normalized
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === undefined) return '未定义'
  if (value === null) return '空值'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(localizeLogObject(value, key))?.replace(/[\r\n\t]+/g, ' ') ?? String(value)
    } catch {
      return '[无法序列化]'
    }
  }
  return String(value)
}

const formatLogChannel = (message: string): { channel: string; body: string } => {
  const singleLine = message.replace(/[\r\n\t]+/g, ' ').trim()
  const match = singleLine.match(/^\[([^\]]+)\]\s*(.*)$/)
  const rawChannel = match?.[1].trim() || 'App'
  return {
    channel: LOG_CHANNEL_NAMES[rawChannel] || rawChannel,
    body: localizeLogText(match ? match[2] : singleLine)
  }
}

const formatInlineMessage = (message: string, meta?: Record<string, any>): string => {
  const { channel, body } = formatLogChannel(message)
  const metaParts = meta
    ? Object.entries(meta).map(([key, value]) => `${LOG_META_LABELS[key] || key}: ${formatLogValue(value, key)}`)
    : []
  const metaText = metaParts.length ? `，${metaParts.join('，')}` : ''
  return `[${channel}] ${body}${metaText}`
}

const padChannel = (channel: string): string => {
  const padding = Math.max(0, 12 - channel.length)
  const left = Math.floor(padding / 2)
  return `[${' '.repeat(left)}${channel}${' '.repeat(padding - left)}]`
}

const formatStack = (stack?: string): string => {
  if (!stack) return ''
  const frames = stack.split('\n').slice(1, 4).map(frame => frame.trim()).filter(Boolean)
  return frames.length ? `，调用位置：${frames.join(' ← ')}` : ''
}

// 日志服务类
class Logger {
  private logBuffer: string[] = []
  private readonly maxBufferSize = 5000
  // 交由 Electron 主进程写入桌面端本地滚动日志。
  private uploadBuffer: LogEntry[] = []
  private uploadTimer: ReturnType<typeof setTimeout> | null = null
  private readonly uploadDebounceMs = 1000

  private addToBuffer(entry: LogEntry) {
    const levelName = LogLevel[entry.level].toUpperCase()
    const timestamp = formatBeijingTimestamp(entry.timestamp).split(' ')[1] || formatBeijingTimestamp(entry.timestamp)
    const { channel, body } = formatLogChannel(entry.message)
    const line = `[${timestamp}] [${levelName.padEnd(5, ' ')}] ${padChannel(channel)} ${body}`
    this.logBuffer.push(line)
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.splice(0, this.logBuffer.length - this.maxBufferSize)
    }
  }

  getLogs(): string[] {
    return [...this.logBuffer]
  }

  // 批量转交主进程（防抖合并）
  private scheduleUpload(entry: LogEntry) {
    this.uploadBuffer.push(entry)
    if (this.uploadTimer) clearTimeout(this.uploadTimer)
    this.uploadTimer = setTimeout(() => {
      this.uploadTimer = null
      this.flushUpload()
    }, this.uploadDebounceMs)
  }

  private async flushUpload(): Promise<void> {
    if (this.uploadBuffer.length === 0) return
    const batch = this.uploadBuffer.splice(0)
    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.writeRendererLogs) return
      await electronAPI.writeRendererLogs(batch.map(e => ({
        level: LogLevel[e.level].toUpperCase(),
        message: e.message,
        meta: e.meta,
        timestamp: e.timestamp.toISOString()
      })))
    } catch {
      // 静默失败，不影响用户体验
    }
  }

  // 输出到控制台
  private outputToConsole(entry: LogEntry) {
    const levelName = LogLevel[entry.level].toUpperCase()
    const timestamp = formatBeijingTimestamp(entry.timestamp).split(' ')[1] || formatBeijingTimestamp(entry.timestamp)
    const { channel, body } = formatLogChannel(entry.message)
    const formattedMessage = `[${timestamp}] [${levelName.padEnd(5, ' ')}] ${padChannel(channel)} ${body}${entry.level === LogLevel.ERROR ? formatStack(entry.stack) : ''}`
    
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.log(formattedMessage)
        break;
      case LogLevel.INFO:
        console.info(formattedMessage)
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage)
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage)
        break;
    }
  }

  // 记录日志
  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message: formatInlineMessage(message, meta)
    };

    if (level >= LogLevel.ERROR) {
      logEntry.stack = new Error().stack;
    }

    this.outputToConsole(logEntry);
    this.scheduleUpload(logEntry);
    this.addToBuffer(logEntry);
  }

  trace(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.TRACE, message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, meta);
  }
}

// 创建全局日志实例
const logger = new Logger();

// 导出日志实例和相关类型
export { logger };
export default logger;
