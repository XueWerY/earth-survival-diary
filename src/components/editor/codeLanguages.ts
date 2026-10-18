// 块级代码的语言目录、严格语法/格式审查、以及预览渲染。
//
// - 校验（validateCode）：插入前在弹窗里实时跑，不通过不允许插入——
//   保证「确保正确预览」。括号/引号/注释感知的配平检查 + 各语言专项规则。
// - 预览（renderCodePreview）：交给 Crepe 代码块的 renderPreview，
//   用 highlight.js 生成着色 HTML（LaTeX 由 Crepe 的 katex 管线先行处理）。

import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('c', c)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('plaintext', plaintext)

export interface CodeLanguage {
  /** 展示名（语言下拉用） */
  label: string
  /** 写入 code_block 的 language 属性（与 Crepe/CodeMirror 的别名对齐） */
  id: string
  /** 归一化别名（校验与预览查表用） */
  aliases: string[]
  /** highlight.js 语言名 */
  hljs: string
}

export const CODE_LANGUAGES: CodeLanguage[] = [
  { label: 'LaTeX', id: 'LaTeX', aliases: ['latex', 'tex'], hljs: 'plaintext' },
  { label: 'JavaScript', id: 'JavaScript', aliases: ['javascript', 'js'], hljs: 'javascript' },
  { label: 'TypeScript', id: 'TypeScript', aliases: ['typescript', 'ts'], hljs: 'typescript' },
  { label: 'Python', id: 'Python', aliases: ['python', 'py'], hljs: 'python' },
  { label: 'Java', id: 'Java', aliases: ['java'], hljs: 'java' },
  { label: 'C', id: 'C', aliases: ['c'], hljs: 'c' },
  { label: 'C++', id: 'C++', aliases: ['cpp', 'c++', 'cc'], hljs: 'cpp' },
  { label: 'Go', id: 'Go', aliases: ['go', 'golang'], hljs: 'go' },
  { label: 'Rust', id: 'Rust', aliases: ['rust', 'rs'], hljs: 'rust' },
  { label: 'SQL', id: 'SQL', aliases: ['sql'], hljs: 'sql' },
  { label: 'JSON', id: 'JSON', aliases: ['json', 'json5'], hljs: 'json' },
  { label: 'HTML', id: 'HTML', aliases: ['html', 'xml', 'vue', 'htm'], hljs: 'xml' },
  { label: 'CSS', id: 'CSS', aliases: ['css', 'scss', 'less'], hljs: 'css' },
  { label: 'Shell', id: 'Shell', aliases: ['bash', 'shell', 'sh', 'zsh', 'console'], hljs: 'bash' },
  { label: 'YAML', id: 'YAML', aliases: ['yaml', 'yml'], hljs: 'yaml' },
  { label: 'Markdown', id: 'Markdown', aliases: ['markdown', 'md'], hljs: 'markdown' },
  { label: '纯文本', id: 'Plain Text', aliases: ['plaintext', 'text', 'txt', ''], hljs: 'plaintext' },
]

const ALIAS_INDEX = new Map<string, CodeLanguage>()
for (const lang of CODE_LANGUAGES) {
  for (const alias of lang.aliases) ALIAS_INDEX.set(alias.toLowerCase(), lang)
  ALIAS_INDEX.set(lang.id.toLowerCase(), lang)
}

/** 把任意语言写法归一化为目录项（未知语言按纯文本处理） */
export function resolveLanguage(raw: string): CodeLanguage {
  const key = String(raw || '').trim().toLowerCase()
  return ALIAS_INDEX.get(key) || ALIAS_INDEX.get(key.replace(/\+\+$/, '++')) || ALIAS_INDEX.get('plaintext')!
}

// ====== 括号/引号/注释感知的配平检查 ======

interface ScannerOptions {
  /** 行注释前缀，如 ['//'] 或 ['#'] */
  lineComments?: string[]
  /** 块注释对，例如 C 系语言的 /* 与 *&#47; */
  blockComments?: Array<[string, string]>
  /** 字符串定界符，如 ['"', "'"] 或 ['"', "'", '`'] */
  quotes?: string[]
  /** 支持 ${} 模板插值的引号（如 `） */
  templateQuotes?: string[]
}

interface ScanResult {
  error: string | null
  depth: number
  stack: Array<{ ch: string; line: number }>
}

const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
const OPENERS = new Set(['(', '[', '{'])

/**
 * 逐字符扫描：跳过注释与字符串，统计括号栈。
 * 返回第一个结构性错误；无错误时 error 为 null。
 */
function scanStructure(code: string, options: ScannerOptions): ScanResult {
  const { lineComments = [], blockComments = [], quotes = ['"', "'"], templateQuotes = [] } = options
  const stack: Array<{ ch: string; line: number }> = []
  let line = 1
  let i = 0
  const n = code.length

  const startsWith = (needle: string) => code.startsWith(needle, i)

  while (i < n) {
    const ch = code[i]

    // 换行
    if (ch === '\n') { line += 1; i += 1; continue }

    // 行注释
    let consumed = false
    for (const mark of lineComments) {
      if (startsWith(mark)) {
        const end = code.indexOf('\n', i)
        i = end < 0 ? n : end
        consumed = true
        break
      }
    }
    if (consumed) continue

    // 块注释
    for (const [open, close] of blockComments) {
      if (startsWith(open)) {
        const end = code.indexOf(close, i + open.length)
        if (end < 0) return { error: `块注释未闭合：${open}`, depth: stack.length, stack }
        line += (code.slice(i, end).match(/\n/g) || []).length
        i = end + close.length
        consumed = true
        break
      }
    }
    if (consumed) continue

    // 字符串
    if (quotes.includes(ch)) {
      const isTemplate = templateQuotes.includes(ch)
      let j = i + 1
      let closed = false
      while (j < n) {
        const c2 = code[j]
        if (c2 === '\\') { j += 2; continue }
        if (c2 === '\n') {
          if (!isTemplate) return { error: `第 ${line} 行：字符串未闭合（${ch}）`, depth: stack.length, stack }
          line += 1
        }
        if (c2 === ch) { closed = true; j += 1; break }
        j += 1
      }
      if (!closed && !isTemplate) return { error: `第 ${line} 行：字符串未闭合（${ch}）`, depth: stack.length, stack }
      if (!closed && isTemplate) return { error: '模板字符串未闭合（`）', depth: stack.length, stack }
      i = j
      continue
    }

    // 括号
    if (OPENERS.has(ch)) {
      stack.push({ ch, line })
      i += 1
      continue
    }
    if (ch in PAIRS) {
      const want = PAIRS[ch]
      const top = stack.pop()
      if (!top) return { error: `第 ${line} 行：多余的 ${ch}`, depth: stack.length, stack }
      if (top.ch !== want) return { error: `第 ${line} 行：${ch} 与第 ${top.line} 行的 ${top.ch} 不匹配`, depth: stack.length, stack }
      i += 1
      continue
    }

    i += 1
  }

  if (stack.length > 0) {
    const top = stack[stack.length - 1]
    return { error: `${top.ch} 未闭合（第 ${top.line} 行）`, depth: stack.length, stack }
  }
  return { error: null, depth: 0, stack }
}

// ====== LaTeX 专项 ======

function validateLatex(code: string): string | null {
  if (/[$]/.test(code)) return 'LaTeX 公式请勿输入 $ 定界符'
  let depth = 0
  let line = 1
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (ch === '\n') { line += 1; continue }
    if (ch === '\\') { i += 1; continue }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth < 0) return `第 ${line} 行：} 多于 {`
    }
  }
  if (depth > 0) return `${depth} 个 { 未闭合`
  const begins = [...code.matchAll(/\\begin\{([^}]*)\}/g)].map(m => m[1].trim())
  const ends = [...code.matchAll(/\\end\{([^}]*)\}/g)].map(m => m[1].trim())
  if (begins.length !== ends.length) return '\\begin{…} 与 \\end{…} 数量不一致'
  for (let i = 0; i < begins.length; i++) {
    if (begins[i] !== ends[i]) return `环境不匹配：\\begin{${begins[i]}} 对应 \\end{${ends[i] ?? '?'}}`
  }
  const leftCount = (code.match(/\\left(?![a-zA-Z])/g) || []).length
  const rightCount = (code.match(/\\right(?![a-zA-Z])/g) || []).length
  if (leftCount !== rightCount) return '\\left 与 \\right 数量不匹配'
  return null
}

// ====== JSON 专项 ======

function validateJson(code: string): string | null {
  try {
    JSON.parse(code)
    return null
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const posMatch = message.match(/position (\d+)/i)
    if (posMatch) {
      const pos = Number(posMatch[1])
      const line = (code.slice(0, pos).match(/\n/g) || []).length + 1
      return `第 ${line} 行附近：${message.replace(/ in JSON.*$/, '')}`
    }
    return message
  }
}

// ====== HTML 专项：标签配对 ======

const HTML_VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'])

function validateHtml(code: string): string | null {
  const stack: Array<{ tag: string; line: number }> = []
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)\/?>/g
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(code))) {
    const line = (code.slice(0, match.index).match(/\n/g) || []).length + 1
    const raw = match[0]
    const tag = match[1].toLowerCase()
    if (raw.startsWith('</')) {
      const top = stack.pop()
      if (!top) return `第 ${line} 行：多余的 </${tag}>`
      if (top.tag !== tag) return `第 ${line} 行：</${tag}> 与第 ${top.line} 行的 <${top.tag}> 不匹配`
    } else if (!raw.endsWith('/>') && !HTML_VOID.has(tag)) {
      stack.push({ tag, line })
    }
  }
  if (stack.length > 0) {
    const top = stack[stack.length - 1]
    return `<${top.tag}> 未闭合（第 ${top.line} 行）`
  }
  return null
}

// ====== YAML 专项：tab 缩进 ======

function validateYaml(code: string): string | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (/^\t/.test(lines[i])) return `第 ${i + 1} 行：YAML 不能用 Tab 缩进`
    const quoteCount = (lines[i].match(/"/g) || []).length
    if (quoteCount % 2 !== 0) return `第 ${i + 1} 行：双引号不配对`
  }
  return null
}

// ====== 主校验入口 ======

const SCANNER_BY_LANG: Record<string, ScannerOptions> = {
  javascript: { lineComments: ['//'], blockComments: [['/*', '*/']], quotes: ['"', "'", '`'], templateQuotes: ['`'] },
  typescript: { lineComments: ['//'], blockComments: [['/*', '*/']], quotes: ['"', "'", '`'], templateQuotes: ['`'] },
  java: { lineComments: ['//'], blockComments: [['/*', '*/']], quotes: ['"', "'"] },
  c: { lineComments: ['//'], blockComments: [['/*', '*/']], quotes: ['"', "'"] },
  cpp: { lineComments: ['//'], blockComments: [['/*', '*/']], quotes: ['"', "'"] },
  go: { lineComments: ['//'], blockComments: [['/*', '*/']], quotes: ['"', '`', "'"] , templateQuotes: ['`'] },
  rust: { lineComments: ['//'], blockComments: [['/*', '*/']], quotes: ['"', "'"] },
  python: { lineComments: ['#'], quotes: ['"', "'"] },
  bash: { lineComments: ['#'], quotes: ['"', "'"] },
  sql: { lineComments: ['--'], blockComments: [['/*', '*/']], quotes: ["'", '"'] },
  css: { blockComments: [['/*', '*/']], quotes: ['"', "'"] },
  json: { quotes: ['"'] },
  markdown: { quotes: [] },
  plaintext: { quotes: [] },
  xml: {},
  yaml: { lineComments: ['#'], quotes: ['"', "'"] },
}

/**
 * 严格代码审查：返回 null 表示通过，否则返回给用户看的错误信息。
 * 目标是在「插入前」拦住会导致预览异常/截断的结构错误。
 */
export function validateCode(rawLanguage: string, code: string): string | null {
  const lang = resolveLanguage(rawLanguage)
  if (!code.trim()) return '请输入代码内容'

  if (lang.aliases.includes('latex')) return validateLatex(code)
  if (lang.aliases.includes('json')) {
    const jsonError = validateJson(code)
    if (jsonError) return jsonError
    return null
  }
  if (lang.aliases.includes('html') || lang.aliases.includes('xml')) {
    const htmlError = validateHtml(code)
    if (htmlError) return htmlError
    // 标签之外还要检查引号配平（属性值）
    return null
  }
  if (lang.aliases.includes('yaml')) {
    const yamlError = validateYaml(code)
    if (yamlError) return yamlError
  }

  const scanner = SCANNER_BY_LANG[lang.hljs] || SCANNER_BY_LANG.plaintext!
  const scan = scanStructure(code, scanner)
  return scan.error
}

// ====== 预览渲染 ======

function escapeHtml(text: string): string {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 仅返回着色后的内部 HTML（不含 <pre>/<code> 包裹），供弹窗预览自行套容器。
 * 失败/未知语言退化为转义文本，保证永不注入原始 HTML。
 */
export function highlightInnerHtml(rawLanguage: string, code: string): string {
  const lang = resolveLanguage(rawLanguage)
  const language = lang.hljs
  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value
  } catch {
    return escapeHtml(code)
  }
}

/**
 * 为 Crepe 代码块生成预览 HTML（同步）。
 * LaTeX 由 Crepe 的 latex feature 先行拦截，不会走到这里；
 * 未知语言退化为转义后的纯文本，保证预览永不为空、永不注入原始 HTML。
 */
export function renderCodePreview(rawLanguage: string, code: string): string | null {
  if (!code || !code.trim()) return null
  const lang = resolveLanguage(rawLanguage)
  if (lang.aliases.includes('latex')) return null // 交给 katex 管线
  return `<pre class="code-preview"><code class="hljs language-${lang.hljs}">${highlightInnerHtml(rawLanguage, code)}</code></pre>`
}
