// 公式语法适配：让笔记正文使用 \( … \)（行内）与 \[ … \]（块级）定界符。
//
// 实现策略：文本层双向转换（而非 micromark 扩展）。
//
// 为什么不在 micromark/remark 层做：CommonMark 里 `\(` 是「反斜杠转义括号」，
// micromark tokenize 阶段就吃掉反斜杠；而给 `\` 注册自定义 text construct 会与
// 内置 backslash construct 冲突（实测 micromark 编译期直接抛
// "expected character to be consumed"）。Crepe Latex 的渲染管线只认
// $…$ / $$…$$（remark-math），因此最稳妥的做法是在编辑器出入口做字符串级
// 互转：存储/书写始终 \( \)，编辑器内部始终 $…$。
//
//   prepareMarkdown（进编辑器）：\(x\) → $x$      （Crepe 原生管线渲染/编辑）
//   restore（出编辑器/落库前）：  $x$  → \(x\)    （存储格式保持 \( \)）
//
// 「双重转义」兼容（重要）：
//  富文本里手敲 \(x\) 时，PM 文本是单反斜杠形态；但 Cream 序列化
// （remark-stringify）会把 `\` 保守地再转义一层，产出 \\(x\\)。
//  进编辑器方向只折叠被多转义的定界符，再转为 $…$；公式正文保持原样。
//
// 安全性：正则严格要求成对定界符，单个 `\(` 或 `$` 不会被改写；
// 表达式内部的反斜杠（\leq 等）原样保留。

import { $remark } from '@milkdown/kit/utils'
import { parse, postprocess, preprocess } from 'micromark'

/**
 * 归一化：把序列化产生的双重转义折算回单反斜杠形态。
 *
 * CommonMark 可转义 ASCII 标点集（!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~）中的字符，
 * 经 remark-stringify 序列化用户已有的 `\X` 转义序列时会把 `\` 再转义一层，
 * 产出 `\\X`——渲染时显示字面反斜杠（如 `\*\*` 出现在正文中）。
 * 这里处理公式外普通文本；公式定界符与公式正文由单独逻辑处理。
 */
const ESCAPABLE_PUNCTUATION = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
// 正则源：匹配两个连续反斜杠 + 一个可转义标点（单遍扫描，无重叠问题）
const DOUBLE_ESCAPE_PATTERN = new RegExp('\\\\\\\\([' + ESCAPABLE_PUNCTUATION.replace(/[\\\]^-]/g, '\\$&') + '])', 'g')
const BACKSLASH_CHAR = '\\'

function normalizeDoubleEscapes(markdown: string): string {
  // 仅供公式外的 Markdown 文本使用；公式正文里的反斜杠不能按标点转义规则折叠。
  return (markdown || '').replace(DOUBLE_ESCAPE_PATTERN, (_match, ch: string) => BACKSLASH_CHAR + ch)
}

/** 只归一化被序列化多转义的公式定界符，不触碰定界符之间的 LaTeX 正文。 */
function normalizeDoubleMathDelimiters(markdown: string): string {
  return (markdown || '')
    .replace(/(?<!\\)\\\\\(/g, '\\(')
    .replace(/(?<!\\)\\\\\)/g, '\\)')
    .replace(/(?<!\\)\\\\\[/g, '\\[')
    .replace(/(?<!\\)\\\\\]/g, '\\]')
}

// 保留公式源码，只在公式区间之外处理 remark-stringify 对普通 Markdown 转义的加倍。
const MATH_SOURCE_PATTERN = /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|(?<!\\)\$(?!\$)[^\n]*?(?<!\\)\$(?!\$)/g

function normalizeDoubleEscapesOutsideMath(markdown: string): string {
  const source = markdown || ''
  let cursor = 0
  let output = ''
  for (const match of source.matchAll(MATH_SOURCE_PATTERN)) {
    const start = match.index ?? cursor
    output += normalizeDoubleEscapes(source.slice(cursor, start))
    output += match[0]
    cursor = start + match[0].length
  }
  return output + normalizeDoubleEscapes(source.slice(cursor))
}

/** 行内：\( … \) → $ … $（进编辑器方向） */
export function convertInlineDelimitersToDollars(markdown: string): string {
  return normalizeDoubleMathDelimiters(markdown || '').replace(/\\\(([^\\]|\\[^)])*?\\\)/g, match => {
    const inner = match.slice(2, -2)
    // 表达式里含 $ 时不转（避免与 remark-math 定界冲突），保持原文由用户修正
    if (inner.includes('$')) return match
    return `$${inner}$`
  })
}

/** 行内：$ … $ → \( … \)（出编辑器方向） */
export function convertInlineDollarsToDelimiters(markdown: string): string {
  return (markdown || '').replace(/(?<!\\)\$([^$\n]+?)\$(?!\$)/g, (_match, inner: string) => {
    if (!inner.trim()) return _match
    return `\\(${inner}\\)`
  })
}

/**
 * 历史损坏修复：早期版本把「独占行的 \[ … \]」转成**单行** $$…$$，
 * 而 remark-math 只把独占行的多行 $$ 块当块级公式，单行形式会被解析成
 * 行内公式、再保存一次就退化成字面量：
 *     正文 = `[ C(x)=..., $$`
 *     落盘 = `\[ C(x)=p\_cV\_c(x)+..., \$\$`
 * 这类笔记表现为「公式变成一串带 \[ 和 $$ 的纯文本、代码块容器消失」。
 * 这里识别该签名并把内容还原成块级公式，用户无需手改。
 */
const LEGACY_BROKEN_BLOCK_PATTERN = /^([ \t]*)\\\[[ \t]*([^\n]*?)[ \t]*(?:\\\$\\\$|\$\$)[ \t]*$/gm

/** 正文里是否存在「历史损坏的块级公式」签名（用于载入后自动修复落盘） */
export function needsLegacyBlockRepair(markdown: string): boolean {
  if (!markdown || !markdown.includes('\\[')) return false
  LEGACY_BROKEN_BLOCK_PATTERN.lastIndex = 0
  return LEGACY_BROKEN_BLOCK_PATTERN.test(markdown)
}

function repairLegacyBrokenBlocks(markdown: string): string {
  if (!markdown || (!markdown.includes('\\[') && !markdown.includes('$$'))) return markdown
  return markdown.replace(LEGACY_BROKEN_BLOCK_PATTERN, (match, indent: string, inner: string) => {
    // 历史块即使带有公式外层 Markdown 转义，正文也必须按 LaTeX 原样保留。
    const body = inner.trim()
    if (!body) return match
    return [indent + '$$', indent + body, indent + '$$'].join('\n')
  })
}

/**
 * 块级：\[ … \] → 独占行的多行 $$ 块（进编辑器方向）。
 *
 * 关键：必须输出「$$ 独占一行」的形式。remark-math 对单行 `$$x$$` 的处理
 * 与多行块不同（Crepe 会把单行形式交给行内公式渲染，导致块级公式丢失
 * 代码块容器）；实测只有独占行的多行形式才会生成 milkdown 的 LaTeX 块。
 *
 * 独占行判断：`\[` 到 `\]` 前后除空白外没有其它文字；此时保留行首缩进
 * （列表项内嵌公式依赖缩进层级）。非独占行（正文中间夹着的 \[…\]）退化为
 * 行内公式 $…$，保证至少能渲染成公式而不是字面括号。
 */
export function convertBlockDelimitersToDollars(markdown: string): string {
  return normalizeDoubleMathDelimiters(markdown || '').replace(
    /\\\[([\s\S]*?)\\\]/g,
    (match, inner: string, offset: number, whole: string) => {
      if (inner.includes('$')) return match
      const before = whole.slice(0, offset)
      const lineStart = before.lastIndexOf('\n') + 1
      const linePrefix = before.slice(lineStart)
      const afterMatch = whole.slice(offset + match.length)
      const lineEndIndex = afterMatch.indexOf('\n')
      const lineSuffix = lineEndIndex < 0 ? afterMatch : afterMatch.slice(0, lineEndIndex)
      const body = inner.trim()
      if (!body) return match

      const isStandalone = /^[ \t]*$/.test(linePrefix) && /^[ \t]*$/.test(lineSuffix)
      if (!isStandalone) return `$${body}$`

      const indent = linePrefix
      const lines = body.split(/\r?\n/).map(line => indent + line.trim())
      return [indent + '$$', ...lines, indent + '$$'].join('\n')
    },
  )
}

/**
 * 块级：$$ … $$ → \[ … \]（出编辑器方向）。
 *
 * 反向同样要输出独占行的多行形式，否则「块级 → 单行 → 下次载入降级为行内」
 * 会来回抖动（实测：单行 \[…\] 再进编辑器会变成行内公式并丢掉容器）。
 */
export function convertBlockDollarsToDelimiters(markdown: string): string {
  let out = markdown || ''
  // 1) 独占行的多行 $$ 块（编辑器里块级公式的标准形态）
  out = out.replace(/^([ \t]*)\$\$[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\$\$[ \t]*$/gm, (match, indent: string, inner: string) => {
    const body = inner.replace(/^[ \t]+/gm, '').trim()
    if (!body) return match
    const lines = body.split(/\r?\n/).map(line => indent + line.trim())
    return [indent + '\\[', ...lines, indent + '\\]'].join('\n')
  })
  // 2) 独占行的单行 $$…$$：同样按块级处理（避免下次载入降级）
  out = out.replace(/^([ \t]*)\$\$([^\n]+?)\$\$[ \t]*$/gm, (match, indent: string, inner: string) => {
    const body = inner.trim()
    if (!body) return match
    return [indent + '\\[', indent + body, indent + '\\]'].join('\n')
  })
  // 3) 正文中间夹着的 $$…$$：按行内公式处理
  out = out.replace(/\$\$([^\n]+?)\$\$/g, (match, inner: string) => {
    const body = inner.trim()
    if (!body) return match
    return `\\(${body}\\)`
  })
  return out
}

/** 用 Markdown 词法范围隔离代码和原始 HTML，避免公式转换改写代码示例或媒体属性。 */
function outsideLiteralMarkdown(markdown: string, transform: (text: string) => string): string {
  if (!markdown) return ''
  const events = postprocess(parse().document().write(preprocess()(markdown, undefined, true)))
  const ranges: Array<{ start: number; end: number }> = []
  const literals = new Set(['codeFenced', 'codeIndented', 'codeText', 'htmlFlow', 'htmlText'])
  for (const [event, token] of events) {
    if (event !== 'enter' || !literals.has(token.type)) continue
    const start = token.start.offset
    const end = token.end.offset
    if (typeof start === 'number' && typeof end === 'number') ranges.push({ start, end })
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end)
  let cursor = 0
  let output = ''
  for (const range of ranges) {
    if (range.end <= cursor) continue
    output += transform(markdown.slice(cursor, Math.max(cursor, range.start)))
    output += markdown.slice(Math.max(cursor, range.start), range.end)
    cursor = range.end
  }
  return output + transform(markdown.slice(cursor))
}

/** 进编辑器前的完整转换（历史损坏修复 + 行内 + 块级） */
export function mathDelimitersToEditor(markdown: string): string {
  return outsideLiteralMarkdown(markdown || '', text => {
    const withCanonicalDelimiters = normalizeDoubleMathDelimiters(text)
    const repaired = repairLegacyBrokenBlocks(withCanonicalDelimiters)
    const normalizedText = normalizeDoubleEscapesOutsideMath(repaired)
    return convertBlockDelimitersToDollars(convertInlineDelimitersToDollars(normalizedText))
  })
}

/** 出编辑器后的完整还原（行内 + 块级） */
export function mathEditorToDelimiters(markdown: string): string {
  return outsideLiteralMarkdown(markdown || '', text => {
    const converted = convertBlockDollarsToDelimiters(convertInlineDollarsToDelimiters(text))
    return normalizeDoubleEscapesOutsideMath(normalizeDoubleMathDelimiters(converted))
  })
}

// Milkdown 包装（保持与 wikiLink/editorSearch 一致的注册形态）：
// 插件本体不做 mdast 变换（转换在文本层完成），占位注册以保证依赖顺序语义。
export const remarkMathSyntax = $remark('remarkMathSyntax', () => (tree: any) => {
  void tree
})
