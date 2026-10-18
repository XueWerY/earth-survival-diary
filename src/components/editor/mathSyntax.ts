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
//  因此进编辑器方向的转换必须同时识别 \(…\) 与 \\(…\\) 两种形态，
//  统一折算成单反斜杠后再转 $…$；否则手敲的公式永远无法渲染。
//
// 安全性：正则严格要求成对定界符，单个 `\(` 或 `$` 不会被改写；
// 表达式内部的反斜杠（\leq 等）原样保留。

import { $remark } from '@milkdown/kit/utils'

/**
 * 归一化：把序列化产生的双重转义折算回单反斜杠形态。
 *
 * CommonMark 可转义 ASCII 标点集（!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~）中的字符，
 * 经 remark-stringify 序列化用户已有的 `\X` 转义序列时会把 `\` 再转义一层，
 * 产出 `\\X`——渲染时显示字面反斜杠（如 `\*\*` 出现在正文中）。
 * 这里统一折叠全部标点的双转义；公式定界符 \( \) \[ \] 自然被覆盖。
 */
const ESCAPABLE_PUNCTUATION = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
// 正则源：匹配两个连续反斜杠 + 一个可转义标点（单遍扫描，无重叠问题）
const DOUBLE_ESCAPE_PATTERN = new RegExp('\\\\\\\\([' + ESCAPABLE_PUNCTUATION.replace(/[\\\]^-]/g, '\\$&') + '])', 'g')
const BACKSLASH_CHAR = '\\'
const SINGLE_ESCAPE_PATTERN = new RegExp('\\\\([' + ESCAPABLE_PUNCTUATION.replace(/[\\\]^-]/g, '\\$&') + '])', 'g')

function normalizeDoubleEscapes(markdown: string): string {
  // \\X → \X：一遍扫描同时处理连续序列（如 \\*\\* 两段相邻）
  return (markdown || '').replace(DOUBLE_ESCAPE_PATTERN, (_match, ch: string) => BACKSLASH_CHAR + ch)
}

/** \X → X：去掉 markdown 单层转义（用于把正文里的字面量还原成公式源码） */
function unescapeMarkdownPunctuation(text: string): string {
  return (text || '').replace(SINGLE_ESCAPE_PATTERN, (_match, ch: string) => ch)
}

/** 行内：\( … \) → $ … $（进编辑器方向） */
export function convertInlineDelimitersToDollars(markdown: string): string {
  return normalizeDoubleEscapes(markdown || '').replace(/\\\(([^\\]|\\[^)])*?\\\)/g, match => {
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
    const body = unescapeMarkdownPunctuation(inner).trim()
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
  return normalizeDoubleEscapes(markdown || '').replace(
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

/** 进编辑器前的完整转换（历史损坏修复 + 行内 + 块级） */
export function mathDelimitersToEditor(markdown: string): string {
  return convertBlockDelimitersToDollars(convertInlineDelimitersToDollars(repairLegacyBrokenBlocks(markdown || '')))
}

/** 出编辑器后的完整还原（行内 + 块级） */
export function mathEditorToDelimiters(markdown: string): string {
  const restored = convertBlockDollarsToDelimiters(convertInlineDollarsToDelimiters(markdown))
  // Cream 序列化会把 \( 里的 \ 再转义成 \\（见上「双重转义」说明），
  // 输出/落库前归一化回单反斜杠，保证存储格式始终是 \( \)。
  return normalizeDoubleEscapes(restored)
}

// Milkdown 包装（保持与 wikiLink/editorSearch 一致的注册形态）：
// 插件本体不做 mdast 变换（转换在文本层完成），占位注册以保证依赖顺序语义。
export const remarkMathSyntax = $remark('remarkMathSyntax', () => (tree: any) => {
  void tree
})
