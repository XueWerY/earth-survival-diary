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

function formatTime(isoOrEpoch) {
  let d
  if (typeof isoOrEpoch === 'string') {
    d = new Date(isoOrEpoch)
  } else {
    d = new Date(isoOrEpoch)
  }
  const pad2 = (n) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${ms}`
}

function prettyErr(err) {
  if (!err) return ''
  const e = err instanceof Error ? err : (err.message ? err : null)
  if (!e) return ''
  const msg = e.message || String(e)
  const stack = e.stack ? `\n    ${e.stack.split('\n').slice(1, 4).join('\n    ')}` : ''
  return `\n    err: ${msg}${stack}`
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
        let msg = log.msg || ''

        // 从 msg 里提取 [名称] 前缀：如 "[Main] xxx" → name="[Main]", body="xxx"
        // 没有 [名称] 前缀的，name 为空，body 就是原 msg
        let namePart = ''
        let bodyPart = msg
        const m = msg.match(/^\[([^\]]+)\]\s*/)
        if (m) {
          // m[1] 是方括号内部的裸名称（不含 []），pad 后再包回去，空格就在括号内了
          const pad = 12 - m[1].length; const lpad = Math.floor(pad/2); const rpad = pad - lpad; namePart = '[' + ' '.repeat(lpad) + m[1] + ' '.repeat(rpad) + ']'   // 14 - 2 方括号 = 12 内部宽度
          bodyPart = msg.substring(m[0].length)
        }

        // 把附加上下文（除了常用字段）追加在末尾
        const skip = new Set(['level', 'time', 'msg', 'name', 'err', 'pid', 'hostname'])
        const extras = []
        for (const k of Object.keys(log)) {
          if (!skip.has(k)) {
            const v = typeof log[k] === 'object' ? JSON.stringify(log[k]) : String(log[k])
            extras.push(`    ${k}: ${v}`)
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
          if (extras.length) out += '\n' + extras.join('\n')
          out += '\n'
          cb(null, out)
        } else {
          let out = `[${time}] [${label}]`
          if (namePart) out += ` ${namePart}`
          out += ` ${bodyPart}`
          if (log.err) out += prettyErr(log.err)
          if (extras.length) out += '\n' + extras.join('\n')
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
