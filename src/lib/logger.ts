// 日志级别枚举
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

// 静态导入文件系统桥接层（避免 Android WebView 上动态 import() 可能挂起的问题）
import { Filesystem, Directory, Encoding } from './fileSystemBridge'

// 北京时间格式化工具
const formatBeijingTimestamp = (date: Date) => {
  return date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  }).replace(',', ':')
}

// 日志服务类
class Logger {
  private logBuffer: string[] = []
  private readonly maxBufferSize = 5000
  // 防抖定时器和进行中的写入 Promise
  private writeTimer: ReturnType<typeof setTimeout> | null = null
  private flushPromise: Promise<void> | null = null
  // 磁盘上已有的历史日志内容（首次写入时加载，避免重启后覆盖历史）
  private loadedHistory: string | null = null

  private addToBuffer(entry: LogEntry) {
    const levelName = LogLevel[entry.level].toUpperCase()
    const timestamp = formatBeijingTimestamp(entry.timestamp)
    let line = `[${timestamp}] [${levelName}] ${entry.message}`
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      line += ' ' + JSON.stringify(entry.meta)
    }
    this.logBuffer.push(line)
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.splice(0, this.logBuffer.length - this.maxBufferSize)
    }
  }

  getLogs(): string[] {
    return [...this.logBuffer]
  }

  // 写入日志到本地磁盘文件（安卓端和鸿蒙端使用）
  // 使用 1 秒防抖合并短时间内的多次写入请求，减少原生调用频率
  // 每次写入完整的内存缓冲区，先尝试写文件，失败（目录不存在）时自动创建目录后重试
  // 首次写入时自动读取磁盘上已有的历史日志，合并后写入，确保重启后历史日志不丢失
  private writeToDisk() {
    const isCapacitorNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()
    const isHarmony = typeof window !== 'undefined' && !!(window as any).harmonyAPI
    if (!isCapacitorNative && !isHarmony) return
    this.scheduleFlush()
  }

  private scheduleFlush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
    }
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      this.flushPromise = this.flushToFile()
    }, 1000)
  }

  private async flushToFile(): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const filePath = `logs/app-${today}.log`
      const newData = this.getLogs().join('\n') + '\n'
      // 首次写入时，读取磁盘上已有的历史日志，合并写入，避免重启后覆盖历史
      if (this.loadedHistory === null) {
        try {
          const result = await Filesystem.readFile({ path: filePath, directory: Directory.Data, encoding: Encoding.UTF8 })
          const content = result.data as string
          this.loadedHistory = content.endsWith('\n') ? content : content + '\n'
        } catch {
          // 文件不存在，无历史日志
          this.loadedHistory = ''
        }
      }
      const data = this.loadedHistory + newData
      // 先尝试写文件，若失败（目录不存在）则创建目录后重试
      try {
        await Filesystem.writeFile({ path: filePath, data, directory: Directory.Data, encoding: Encoding.UTF8 })
      } catch {
        await Filesystem.mkdir({ path: 'logs', directory: Directory.Data, recursive: true })
        await Filesystem.writeFile({ path: filePath, data, directory: Directory.Data, encoding: Encoding.UTF8 })
      }
    } catch {
      // 写入磁盘失败不影响正常功能
    } finally {
      this.flushPromise = null
    }
  }

  // 等待所有待写入操作完成（文件管理器读取日志前调用，确保读取到最新内容）
  async flushWriteQueue(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    while (this.flushPromise) {
      await this.flushPromise
    }
    // 最后强制执行一次写入，确保最新日志已落盘
    this.flushPromise = this.flushToFile()
    await this.flushPromise
  }

  // 上传到远程服务器
  private async uploadToRemote(entry: LogEntry): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('/api/logs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          logs: [{
            ...entry,
            timestamp: entry.timestamp.toISOString()
          }]
        })
      });
    } catch (error) {
      // 静默失败，不影响用户体验
    }
  }

  // 输出到控制台
  private outputToConsole(entry: LogEntry) {
    const levelName = LogLevel[entry.level].toUpperCase();
    const timestamp = formatBeijingTimestamp(entry.timestamp);
    const formattedMessage = `[${timestamp}] ${levelName}: ${entry.message}`;
    
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.log(formattedMessage, entry.meta || '');
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, entry.meta || '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, entry.meta || '');
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, entry.meta || '', entry.stack ? '\n' + entry.stack : '');
        break;
    }
  }

  // 记录日志
  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      meta
    };

    if (level >= LogLevel.ERROR) {
      logEntry.stack = new Error().stack;
    }

    this.outputToConsole(logEntry);
    this.uploadToRemote(logEntry);
    this.addToBuffer(logEntry);
    this.writeToDisk(logEntry);
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