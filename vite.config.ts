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
        const outputLines: string[] = []
        const levelColors: Record<string, string> = {
          TRACE: '\x1b[35m', DEBUG: '\x1b[36m', INFO: '\x1b[32m', WARN: '\x1b[33m', ERROR: '\x1b[31m',
        }
        const levelLabels: Record<string, string> = {
          TRACE: 'TRC', DEBUG: 'DBG', INFO: 'INF', WARN: 'WRN', ERROR: 'ERR',
        }
        const resetColor = '\x1b[0m'
        const ansiEnabled = Boolean(process.stdout.isTTY && process.env.NO_COLOR === undefined)
        for (const entry of entries.slice(0, 200)) {
          const level = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'].includes(String(entry?.level).toUpperCase())
            ? String(entry.level).toUpperCase()
            : 'INFO'
          const date = new Date(entry?.timestamp || Date.now())
          const time = Number.isNaN(date.getTime())
            ? new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false })
            : date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0')
          let meta = ''
          if (entry?.meta && typeof entry.meta === 'object') {
            try { meta = ' ' + JSON.stringify(entry.meta) } catch { meta = ' [日志详情无法序列化]' }
          }
          const rawMessage = String(entry?.message || '').replace(/[\r\n]+/g, ' ')
          const content = `${rawMessage.replace(/^\[[^\]]+\]\s*/, '')}${meta}`
          const levelToken = `[ ${levelLabels[level] || level} ]`
          const line = `[${time}] ${levelToken} ${content}`
          outputLines.push(line)
          const output = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
          if (ansiEnabled) {
            output(`\x1b[90m[${time}]${resetColor} ${levelColors[level] || ''}${levelToken}${resetColor} \x1b[37m${content}${resetColor}`)
          } else {
            output(line)
          }
        }
        if (outputLines.length) {
          fs.mkdirSync(browserLogDirectory, { recursive: true })
          fs.appendFileSync(path.join(browserLogDirectory, 'browser.log'), outputLines.join('\n') + '\n', 'utf8')
        }
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
