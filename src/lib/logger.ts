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
  // 交由 Electron 主进程写入桌面端本地滚动日志，避免依赖同机 API 服务。
  private uploadBuffer: LogEntry[] = []
  private uploadTimer: ReturnType<typeof setTimeout> | null = null
  private readonly uploadDebounceMs = 1000

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
