import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createBrowserServiceMiddleware, isTrustedLocalRequest } from './scripts/browser-service.mjs'

const browserLogDirectory = path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'earth-survival-diary', 'logs')

function browserLocalService(): Plugin {
  const middleware = createBrowserServiceMiddleware()
  return {
    name: 'browser-local-service',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

function fixVueuseCore(): Plugin {
  return {
    name: 'fix-vueuse-core',
    transform(code, id) {
      if (id.includes('@vueuse/core/dist/index.js')) {
        return code
          .replace(
            '/* #__PURE__ */\nconst events = /* @__PURE__ */ new Map()',
            'const events = /* @__PURE__ */ new Map()'
          )
          .replace(
            'const defaultState = (/* #__PURE__ */ {',
            'const defaultState = ({'
          )
      }
    }
  }
}

function terminalRendererLogs(): Plugin {
  // 笔记编辑会连续保存同一条记录，只对这类 INFO 日志做时间窗汇总。
  type PendingLog = { level: string; time: string; content: string; count: number; lastAt: number }
  const pendingLogs = new Map<string, PendingLog>()
  const aggregationWindowMs = 10_000
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const writeLogGroups = (groups: PendingLog[]) => {
    if (!groups.length) return
    const orderedGroups = [...groups].sort((a, b) => a.lastAt - b.lastAt)
    const levelColors: Record<string, string> = {
      TRACE: '\x1b[35m', DEBUG: '\x1b[36m', INFO: '\x1b[32m', WARN: '\x1b[33m', ERROR: '\x1b[31m',
    }
    const levelLabels: Record<string, string> = {
      TRACE: 'TRC', DEBUG: 'DBG', INFO: 'INF', WARN: 'WRN', ERROR: 'ERR',
    }
    const resetColor = '\x1b[0m'
    const ansiEnabled = Boolean(process.stdout.isTTY && process.env.NO_COLOR === undefined)
    const outputLines = orderedGroups.map(({ level, time, content, count }) => {
      const levelToken = `[ ${levelLabels[level] || level} ]`
      const suffix = count > 1 ? ` x ${count}` : ''
      const line = `[${time}] ${levelToken} ${content}${suffix}`
      const output = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
      if (ansiEnabled) {
        output(`\x1b[90m[${time}]${resetColor} ${levelColors[level] || ''}${levelToken}${resetColor} \x1b[37m${content}${resetColor}${suffix}`)
      } else {
        output(line)
      }
      return line
    })

    try {
      fs.mkdirSync(browserLogDirectory, { recursive: true })
      fs.appendFileSync(path.join(browserLogDirectory, 'browser.log'), outputLines.join('\n') + '\n', 'utf8')
    } catch (error) {
      console.error('[日志] 写入浏览器日志文件失败', error)
    }
  }

  const flushPendingLogs = () => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = null
    if (!pendingLogs.size) return
    const groups = [...pendingLogs.values()]
    pendingLogs.clear()
    writeLogGroups(groups)
  }

  const scheduleFlush = () => {
    if (flushTimer || !pendingLogs.size) return
    flushTimer = setTimeout(flushPendingLogs, aggregationWindowMs)
    ;(flushTimer as any).unref?.()
  }

  const middleware = (req: any, res: any) => {
    if (!isTrustedLocalRequest(req)) {
      res.statusCode = 403
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }

    const chunks: Buffer[] = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk: Buffer) => {
      size += Buffer.byteLength(chunk)
      if (size > 1024 * 1024) {
        tooLarge = true
        chunks.length = 0
        return
      }
      if (!tooLarge) chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => {
      if (tooLarge) {
        res.statusCode = 413
        res.end()
        return
      }
      try {
        const entries = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (!Array.isArray(entries)) throw new Error('Expected an array of log entries')
        for (const entry of entries.slice(0, 200)) {
          const level = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'].includes(String(entry?.level).toUpperCase())
            ? String(entry.level).toUpperCase()
            : 'INFO'
          const date = new Date(entry?.timestamp || Date.now())
          const validDate = Number.isNaN(date.getTime()) ? new Date() : date
          const time = validDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false }) + '.' + String(validDate.getMilliseconds()).padStart(3, '0')
          let meta = ''
          if (entry?.meta && typeof entry.meta === 'object') {
            try { meta = ' ' + JSON.stringify(entry.meta) } catch { meta = ' [日志详情无法序列化]' }
          }
          const rawMessage = String(entry?.message || '').replace(/[\r\n]+/g, ' ')
          const content = `${rawMessage.replace(/^\[[^\]]+\]\s*/, '')}${meta}`
          const pendingLog = { level, time, content, count: 1, lastAt: validDate.getTime() }
          if (!/^更新笔记，笔记名称[:：]/.test(content)) {
            flushPendingLogs()
            writeLogGroups([pendingLog])
            continue
          }
          const key = `${level}\u0000${content}`
          const previous = pendingLogs.get(key)
          if (previous) {
            previous.time = time
            previous.count += 1
            previous.lastAt = validDate.getTime()
          } else {
            pendingLogs.set(key, { level, time, content, count: 1, lastAt: validDate.getTime() })
          }
        }
        scheduleFlush()
        res.statusCode = 204
        res.end()
      } catch {
        res.statusCode = 400
        res.end('Invalid log payload')
      }
    })
  }

  return {
    name: 'terminal-renderer-logs',
    configureServer(server) {
      server.middlewares.use('/__esd/logs', middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/__esd/logs', middleware)
    }
  }
}

export default defineConfig(() => {
  return {
    base: './',
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rolldownOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html')
        }
      }
    },
    plugins: [vue(), fixVueuseCore(), browserLocalService(), terminalRendererLogs(), {
      name: 'version-inline',
      resolveId(id) {
        if (id === 'virtual:version') return id
        return null
      },
      load(id) {
        if (id === 'virtual:version') {
          const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
          return `export default ${JSON.stringify(pkg.version)}`
        }
        return null
      }
    } as Plugin]
  }
})
