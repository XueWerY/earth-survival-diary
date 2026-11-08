// 导出 HTML：把编辑器当前渲染结果导出为**完全自包含**的单文件预览。
//
// 设计要点：
//  - 只读预览：不含工具栏、CodeMirror、语言下拉、可编辑属性等交互残留；
//  - 样式全部保留：排版（六级标题配色/首行缩进/引用/表格/行内代码/代码块卡片/
//    wikiLink/图片圆角）与代码着色（hljs token）都随文件内联；
//  - 公式完全自包含：KaTeX 的 CSS 与字体（20 个 woff2，约 254KB）从运行时
//    真实的 @font-face 规则里取出并转成 base64 data URI，
//    因此离线打开与编辑器内一致，且不依赖 CDN。
//
// 为什么从「运行时样式表」取而不是 import CSS 文件：
//  我们的排版规则写在 .vue 的 <style> 里（编译后含 data-v-* 作用域 + :deep 展开），
//  直接 import 源码 CSS 无法复用这些编译结果；而运行时 document.styleSheets 里
//  已经是最终形态，按选择器前缀筛选即可拿到权威样式。

import type { Note, Tag } from '../stores/noteStore'
import { sanitizeFileName, downloadBlob } from './noteExport'
import { anchorIdForText, blockAnchorText, collectMarkdownAnchors } from '../components/editor/blockAnchors'
import { mediaKeyFromReference, readMediaAsset } from '../services/mediaAssets'

/** 导出样式里需要保留的选择器特征（对应编辑器与内容排版） */
const STYLE_SCOPE_MARKERS = [
  '.md-editor',
  '.markdown-body',
  '.milkdown-body',
  '.milkdown',
  '.katex',
  '.hljs',
  '.code-preview',
]

interface CapturedStyle {
  /** 过滤后的 CSS 文本 */
  css: string
  /** KaTeX @font-face 规则（含原始 url） */
  katexFontFaces: string[]
}

/**
 * 重写选择器：让「宿主作用域」下的规则在导出文件里也能命中。
 *
 * 我们的排版规则写在 .vue 的 scoped 样式里，编译后形如
 *   .md-editor :deep(.markdown-body p)  →  .md-editor[data-v-xxx] .markdown-body p
 * 导出文件没有 .md-editor 这一层祖先，规则会全部失效。不能直接把它删掉：Vue
 * scoped 规则中的 .md-editor[data-v-…] 有两个 class/attribute 优先级单位，丢掉后
 * Milkdown 默认标题、列表等规则就可能覆盖笔记样式。导出容器用同等优先级的
 * .note-export-wrap[data-export-scope] 替代它；正文再保留一个真实的 .markdown-body
 * 后代。其它不带宿主前缀的规则用 :where() 限定范围，不额外增加选择器优先级。
 */
const HOST_SCOPE_PATTERN = /^\s*\.md-editor(\[data-v-[0-9a-f]+\])?\s*/
const DATA_V_PATTERN = /\[data-v-[0-9a-f]+\]/g

function splitSelectorList(selector: string): string[] {
  const parts: string[] = []
  let start = 0
  let parentheses = 0
  let brackets = 0
  let quote = ''
  let escaped = false

  for (let index = 0; index < selector.length; index++) {
    const character = selector[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") quote = character
    else if (character === '(') parentheses++
    else if (character === ')') parentheses = Math.max(0, parentheses - 1)
    else if (character === '[') brackets++
    else if (character === ']') brackets = Math.max(0, brackets - 1)
    else if (character === ',' && parentheses === 0 && brackets === 0) {
      parts.push(selector.slice(start, index))
      start = index + 1
    }
  }

  parts.push(selector.slice(start))
  return parts
}

function rewriteSelectorForExport(selector: string): string {
  return splitSelectorList(selector)
    .map(part => {
      let trimmed = part.trim()
      const hasHostScope = HOST_SCOPE_PATTERN.test(trimmed)
      if (hasHostScope) {
        trimmed = trimmed.replace(
          HOST_SCOPE_PATTERN,
          (_match, scopeAttribute: string | undefined) =>
            scopeAttribute ? '.note-export-wrap[data-export-scope] ' : '.note-export-wrap ',
        )
      } else if (!trimmed.startsWith('.note-export-wrap')) {
        // 限定导出范围但不抬高原选择器的优先级，保留 Milkdown 与笔记样式的原始层叠关系。
        trimmed = `:where(.note-export-wrap) ${trimmed}`
      }
      trimmed = trimmed.replace(DATA_V_PATTERN, '')
      return trimmed.trim()
    })
    .filter(Boolean)
    .join(', ')
}

/**
 * 采集编辑器实际生效的 CSS 变量值。
 *
 * 排版规则大量使用 var(--crepe-*)（代码块底色、引用文字、行内代码区、阴影…），
 * 而这些变量由 Crepe 主题定义在 `.milkdown` 上，导出文件里没有这段定义，
 * 缺变量会让 var() 整条声明失效（实测引用底色/行内代码底色丢失）。
 * 这里把用到的变量按「当前实际解析值」抄出来，写进导出文件的 :root，
 * 保证离线渲染与编辑器一致。
 */
function captureCssVariables(): string {
  const scope = document.querySelector('.md-editor') || document.documentElement
  const computed = getComputedStyle(scope)
  // 同时从 .milkdown 取（Crepe 变量定义在它上面，.md-editor 可继承，但按需兜底）
  const milkdown = document.querySelector('.milkdown')
  const csMilkdown = milkdown ? getComputedStyle(milkdown) : null

  const used = new Set<string>()
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    const walk = (list: CSSRuleList) => {
      for (const rule of Array.from(list)) {
        const text = rule.cssText || ''
        for (const match of text.matchAll(/var\((--[a-z0-9-]+)/gi)) used.add(match[1].toLowerCase())
        const grouping = rule as CSSMediaRule
        if (grouping.cssRules) walk(grouping.cssRules)
      }
    }
    walk(rules)
  }

  const declarations: string[] = []
  for (const name of [...used].sort()) {
    // 宿主界面变量（element-plus / chalk-*）与导出无关，跳过以缩小体积
    if (/^--el-|^--chalk-|^--app-/.test(name)) continue
    let value = computed.getPropertyValue(name).trim()
    if (!value && csMilkdown) value = csMilkdown.getPropertyValue(name).trim()
    if (!value) continue
    declarations.push(`  ${name}: ${value};`)
  }
  return declarations.length ? `:root {\n${declarations.join('\n')}\n}` : ''
}
function isRelevantRule(selector: string): boolean {
  if (!selector) return false
  // 编辑器根节点是带边框、背景和固定高度的交互外壳，不能映射到导出的文章根节点。
  // 正文使用 .markdown-body / .milkdown 等后代规则，这些由后续分支正常采集。
  if (/^\.md-editor(?:\[data-v-[0-9a-f]+\])?$/.test(selector.trim())) return false
  // 排除明显与预览无关的宿主界面样式
  if (/\.(np-|editor-|outline|menubar|el-|app-scrollbar|guide-)/.test(selector)) {
    return /\.katex|\.hljs|code-preview/.test(selector)
  }
  return STYLE_SCOPE_MARKERS.some(marker => selector.includes(marker))
}

function relevantSelectorList(selector: string): string[] {
  return splitSelectorList(selector).filter(part => isRelevantRule(part.trim()))
}

/**
 * 抓取当前页面里与笔记排版相关的 CSS，以及 KaTeX 的字体规则。
 * 跨源样式表（字体域等）读不到 cssRules 时跳过，不影响结果。
 */function captureEditorStyles(): CapturedStyle {
  const cssChunks: string[] = []
  const katexFontFaces: string[] = []
  let accessible = 0

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null
    try {
      rules = sheet.cssRules
    } catch {
      continue // 跨源样式表：忽略
    }
    accessible++
    for (const rule of Array.from(rules)) {
      const text = rule.cssText || ''
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        // 只保留 KaTeX 字体（数学排版必须一致）；
        // 正文字体的 Noto/JetBrains 有 300+ @font-face，全量内联会让文件暴涨，
        // 中文改用系统字体栈回退（见 EXPORT_BASE_CSS）。
        if (/KaTeX/i.test(text)) katexFontFaces.push(text)
        continue
      }
      if (rule.type === CSSRule.STYLE_RULE) {
        const selector = (rule as CSSStyleRule).selectorText || ''
        const relevantSelectors = relevantSelectorList(selector)
        if (!relevantSelectors.length) continue
        // 保留声明体，只改写选择器前缀
        const body = text.slice(text.indexOf('{'))
        cssChunks.push(`${rewriteSelectorForExport(relevantSelectors.join(', '))}${body}`)
        continue
      }
      // 媒体查询 / 支持查询：递归一层，保留内部的相关规则
      const grouping = rule as CSSMediaRule
      if (grouping.cssRules) {
        const inner: string[] = []
        for (const child of Array.from(grouping.cssRules)) {
          const childText = child.cssText || ''
          if (child.type === CSSRule.STYLE_RULE) {
            const selector = (child as CSSStyleRule).selectorText || ''
            const relevantSelectors = relevantSelectorList(selector)
            if (!relevantSelectors.length) continue
            const body = childText.slice(childText.indexOf('{'))
            inner.push(`${rewriteSelectorForExport(relevantSelectors.join(', '))}${body}`)
          } else if (child.type === CSSRule.FONT_FACE_RULE && /KaTeX/i.test(childText)) {
            katexFontFaces.push(childText)
          }
        }
        if (inner.length) cssChunks.push(`@media ${grouping.media.mediaText}{${inner.join('')}}`)
      }
    }
  }

  if (import.meta.env.DEV) {
    console.debug('[导出 HTML] 可读样式表', accessible, '| 相关规则', cssChunks.length, '| KaTeX 字体', katexFontFaces.length)
  }
  return { css: cssChunks.join('\n'), katexFontFaces }
}

/** 把 KaTeX 字体 URL 转成 base64 data URI（失败则原样保留，至少还能联网加载） */
async function inlineKatexFonts(fontFaces: string[]): Promise<string> {
  const urls = new Set<string>()
  for (const face of fontFaces) {
    for (const match of face.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
      const raw = match[2]
      if (!/\.(woff2|woff|ttf)(\?|$)/i.test(raw)) continue
      // 只内联 woff2（体积/覆盖率最优）；woff/ttf 是同一字体的回退格式，
      // 现代 Chromium 只取 woff2，保留它们会让文件翻三倍。
      if (!/\.woff2/i.test(raw)) continue
      urls.add(raw)
    }
  }

  const dataUriByUrl = new Map<string, string>()
  await Promise.all([...urls].map(async url => {
    try {
      const response = await fetch(url)
      if (!response.ok) return
      const buffer = await response.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      const CHUNK = 0x8000
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
      }
      dataUriByUrl.set(url, `data:font/woff2;base64,${btoa(binary)}`)
    } catch {
      /* 单个字体失败不影响整体导出 */
    }
  }))

  const inlined: string[] = []
  const emitted = new Set<string>()
  for (const face of fontFaces) {
    // 仅保留 woff2 那条 src（丢掉 woff/ttf 回退），并替换为 data URI
    const woff2Url = [...face.matchAll(/url\((['"]?)([^'")]+)\1\)/g)]
      .map(m => m[2])
      .find(u => /\.woff2/i.test(u))
    if (!woff2Url || emitted.has(woff2Url)) continue
    emitted.add(woff2Url)
    const dataUri = dataUriByUrl.get(woff2Url)
    if (!dataUri) continue
    const family = /font-family\s*:\s*([^;}]+)/i.exec(face)?.[1]?.trim() || 'KaTeX'
    const weight = /font-weight\s*:\s*([^;}]+)/i.exec(face)?.[1]?.trim() || 'normal'
    const style = /font-style\s*:\s*([^;}]+)/i.exec(face)?.[1]?.trim() || 'normal'
    inlined.push(
      `@font-face{font-family:${family};font-style:${style};font-weight:${weight};src:url(${dataUri}) format('woff2');font-display:block}`,
    )
  }
  return inlined.join('\n')
}

/**
 * 基线样式：导出文件必须自带的部分。
 * 不依赖宿主应用的 CSS 变量（--chalk-* 等），全部写死颜色，
 * 保证在任意环境（含直接双击打开）都渲染成「蓝紫星空」观感。
 */
const EXPORT_BASE_CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #14122b;
  color: #e2e8f0;
}
body {
  /* 中文用系统字体栈回退（Noto 全量内联体积过大）；等宽用系统等宽 */
  font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  line-height: 1.85;
}
.note-export-wrap {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 32px 36px 64px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.note-export-wrap > .markdown-body {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.note-export-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  margin-bottom: 24px;
}
.note-export-wrap .note-export-body { padding-inline: 0 !important; }
.note-export-wrap .note-export-body h1,
.note-export-wrap .note-export-body h2,
.note-export-wrap .note-export-body h3,
.note-export-wrap .note-export-body h4,
.note-export-wrap .note-export-body h5,
.note-export-wrap .note-export-body h6 { text-align: left !important; }
.note-export-wrap img,
.note-export-wrap video {
  display: inline-block;
  max-width: 100%;
  height: auto;
  margin: 16px 10px;
  vertical-align: top;
  border-radius: 8px;
}
.note-export-wrap audio {
  display: inline-block;
  width: min(520px, 100%);
  max-width: 100%;
  margin: 16px 10px;
  vertical-align: top;
  color-scheme: dark;
  accent-color: #a78bfa;
}
.note-export-wrap [data-esd-layout="standalone"] {
  display: block;
  margin: 16px auto;
}
.note-export-wrap .milkdown span[data-type="math_inline"] {
  display: inline-block;
  padding: 0 4px;
  vertical-align: bottom;
  color: var(--crepe-color-primary, #a78bfa);
}
.note-export-wrap blockquote.esd-quote-collapsed {
  max-height: 3.4em;
  overflow: hidden;
}
.note-export-wrap blockquote.esd-quote-collapsed > :not(.esd-quote-first):not([data-esd-widget]) {
  display: none;
}
.note-export-wrap blockquote.esd-quote-collapsed > .esd-quote-first,
.note-export-wrap blockquote.esd-quote-collapsed > .esd-quote-first > li:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-export-wrap .esd-quote-toggle {
  position: absolute;
  left: 8px;
  top: 7px;
  z-index: 2;
  width: 17px;
  height: 17px;
  padding: 0;
  border: 1px solid rgba(129, 140, 248, .55);
  border-radius: 5px;
  color: #c7d2fe;
  background: rgba(102, 126, 234, .28);
  cursor: pointer;
}
.note-export-wrap .esd-quote-toggle::before {
  content: "";
  display: block;
  width: 0;
  height: 0;
  margin: auto;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid currentColor;
}
.note-export-wrap blockquote:not(.esd-quote-collapsed) .esd-quote-toggle::before {
  border-top: 5px solid currentColor;
  border-right: 4px solid transparent;
  border-bottom: 0;
  border-left: 4px solid transparent;
}
.note-export-wrap blockquote[id],
.note-export-wrap h1[id], .note-export-wrap h2[id], .note-export-wrap h3[id],
.note-export-wrap h4[id], .note-export-wrap h5[id], .note-export-wrap h6[id] {
  scroll-margin-top: 24px;
}
.note-export-wrap a { color: #93c5fd; text-decoration: none; }
.note-export-wrap a:hover { text-decoration: underline; }
/* 只读预览：隐藏源码编辑区和编辑专用手柄，保留可操作的主题化媒体控件 */
.note-export-wrap .tools,
.note-export-wrap .tools-button-group,
.note-export-wrap .language-picker,
.note-export-wrap .codemirror-host,
.note-export-wrap .milkdown-latex-inline-edit,
.note-export-wrap .milkdown-image-block > .image-edit,
.note-export-wrap .image-resize-handle,
.note-export-wrap .esd-media-resize-handle,
.note-export-wrap .milkdown-image-block .operation,
.note-export-wrap .milkdown-image-block .caption-input,
.note-export-wrap .prosemirror-virtual-cursor,
.note-export-wrap .block-handle { display: none !important; }

/* ===== 列表（G）：先洗掉编辑器样式，再显式画出导出标记 =====
   为什么必须显式补：编辑器里列表标记是 JS 生成的 <span class="milkdown-icon label">，
   图标层已在清洗阶段整体删除（否则导出后要么显示残图标、要么空落一个 16px 占位）。
   而 <ul>/<ol> 在导出产物里原本没有任何 ul/ol/li 规则（统计为 0 条），
   所以这里既要清掉 Milkdown 的 flex 布局残留，也要用 list-style 重新画出标记。 */
.note-export-wrap ul,
.note-export-wrap ol {
  margin: 10px 0;
  padding-left: 1.9em;          /* 缩进交给 padding，标记才不会跑出容器 */
  list-style-position: outside;
}
.note-export-wrap ul { list-style-type: disc; }
.note-export-wrap ol { list-style-type: decimal; }  /* 有序列表必须保留编号 */
/* 嵌套层级换符号，否则两级都是实心圆点，层级看不出来 */
.note-export-wrap ul ul { list-style-type: circle; }
.note-export-wrap ul ul ul { list-style-type: square; }
/* 剥壳后 li 是 ul/ol 的直接子元素；这里清掉 Milkdown 的 flex/gap 残留
   （.milkdown .milkdown-list-item-block > .list-item 曾把 li 设成 flex，
   若不清掉，li 里的 <p> 会被当成 flex 子项排成一行）。 */
.note-export-wrap li {
  display: list-item;
  margin: 4px 0;
  padding-left: 0.2em;
}
/* 标记颜色跟随强调色，与编辑器里的 label 配色保持同一观感 */
.note-export-wrap li::marker { color: #e9d5ff; }

/* ===== 表格（G）：边框 / 单元格内边距 / 表头底色 / 对齐 / 横向滚动 =====
   .milkdown .milkdown-table-block 依赖的祖先在导出内容里不存在，
   原来的 th/td 边框规则抓不进导出文件，表格会完全裸奔（无框线、无内边距）。
   这里用不依赖祖先的 .note-export-wrap table 显式补齐，并保留原设计语言。 */
.note-export-wrap table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: 0.95em;
  line-height: 1.6;             /* 表格里行高收一点，比正文 1.85 更紧凑好看 */
}
.note-export-wrap th,
.note-export-wrap td {
  border: 1px solid rgba(102, 126, 234, 0.28);
  padding: 8px 12px;
  /* 单元格内边距已经提供了呼吸感，不需要再靠首行缩进撑版式 */
  text-indent: 0;
}
.note-export-wrap th {
  background: rgba(102, 126, 234, 0.16);   /* 表头底色 */
  color: #bfdbfe;
  font-weight: 600;
}
/* 单元格内段落一律不缩进（H）：编辑器样式给所有 <p> 加了 text-indent: 2em，
   表格里每格文字都缩进 2 个字符，列宽被白白吃掉、上下行也对不齐。 */
.note-export-wrap td p,
.note-export-wrap th p,
.note-export-wrap li p,
.note-export-wrap td *,
.note-export-wrap th * { text-indent: 0; }

/* 宽表不撑破页面：横向滚动交给外层容器，表格本身保持自然宽度。
   为什么用 table 的父层而不是 table 自己：display:block + overflow-x 加在 table 上
   浏览器会允许表格超出内容区而滚动条未必出现，包一层 div 最稳。 */
.note-export-wrap .note-export-table-scroll {
  display: block;
  width: 100%;
  overflow-x: auto;
  margin: 12px 0;
}
.note-export-wrap .note-export-table-scroll table { margin: 0; }

/* ===== 引用块（I）：用户明确要求「引用内加粗文字 = 未加粗文字的深色系」 =====
   这是用户直接提出的需求，不要按「更好看」自行调整。
   编辑器当前抓到的规则把 blockquote strong 设成 #c4b5fd——比正文更亮的紫，
   加粗后反而「跳」出来、不像强调而像另一层级的标题，所以必须覆盖。
   未加粗的引用文字是 #7d8db5，加粗改用它的深色系 #5f6f9e：
   同色相（蓝紫）、明度更低，RGB 三个通道都明显小于 #7d8db5。
   注意选择器要保持 .note-export-wrap blockquote strong 这一形状，
   才能在层叠里压过运行时抓来的同名规则（同权重、靠后生效）。 */
.note-export-wrap blockquote { color: #7d8db5; }
.note-export-wrap blockquote strong { color: #5f6f9e; }

/* 引用竖条：编辑器用 .ProseMirror blockquote::before 画左侧色条，
   该祖先不在导出内容里，规则失效。这里用只依赖 .note-export-wrap 的选择器补回来。 */
.note-export-wrap blockquote {
  position: relative;
  padding-left: 40px;
  padding-right: 14px;
  margin: 10px 0;
  box-sizing: content-box;
  background: rgba(102, 126, 234, 0.06);
  border-radius: 0 6px 6px 0;
}
.note-export-wrap blockquote::before {
  content: "";
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 4px;
  border-radius: 100px;
  background: #a78bfa;
}

/* ===== 正文容器兜底 =====
   部分规则被写成 .note-export-wrap .milkdown .ProseMirror xxx，而导出内容没有
   .milkdown/.ProseMirror 祖先（只有代码块会被补上 .milkdown），这些规则其实命不中。
   这里给 ProseMirror 内容套一个 .note-export-body 容器，并补齐它需要的基础排版，
   避免依赖某个 case 是否恰好被包裹而出现样式时有时无。 */
.note-export-wrap .note-export-body { position: relative; }
.note-export-wrap .note-export-body p {
  margin: 0;
  padding: 4px 0;
  text-indent: 2em;             /* 中文正文首行缩进 2 字符 */
}
/* 行内元素/公式不参与缩进计算（编辑器原样式 .note-export-wrap p * 的等价物） */
.note-export-wrap .note-export-body p * { text-indent: 0; }
.note-export-wrap .note-export-body > p:first-child { text-indent: 0; }
`.trim()

/**
 * 需要从导出内容里**整块删除**的编辑器交互节点选择器。
 *
 * 媒体播放器的按钮不在此表中：导出 HTML 会用自带脚本重新绑定它们，外观与笔记一致。
 */
const STRIP_SELECTORS = [
  // —— 代码块 / 公式 / 图片的编辑外壳 ——
  '.tools',
  '.language-picker',
  '.codemirror-host',
  '.milkdown-latex-inline-edit',
  '.prosemirror-virtual-cursor',
  '.ProseMirror-virtual-cursor',
  '.image-edit',
  '.image-resize-handle',
  '.esd-media-resize-handle',
  '.milkdown-image-block .operation',
  '.milkdown-image-block .caption-input',
  '.block-handle',
  '.milkdown-block-handle',
  '.note-media-resize',
  '.media-resize',
  // —— 表格拖拽手柄 / 加行加列按钮 / 拖拽预览 ——
  // Crepe 表格的交互层：.handle 元素在运行时被 JS 按鼠标实测坐标绝对定位，
  // 导出后没有 JS，它们就按内联 left/top/width/height 原样钉在页面上。
  // .cell-handle / .line-handle 是更精确的类名，一并列出作为冗余保险。
  '.handle',
  '.cell-handle',
  '.line-handle',
  '.drag-preview',
  '.button-group',
  '.add-button',
  // —— 列表标记图标 ——
  // 列表符号当前是 <span class="milkdown-icon label bullet"> 里的内联 SVG，
  // 有序列表的编号倒是纯文本（"1."），但和图标一起包在 .label-wrapper 里。
  // 图标层整体删掉，改用 CSS 的 list-style 画标记（见 EXPORT_BASE_CSS）。
  '.label-wrapper',
  '.milkdown-icon',
  // —— 引用块「收起/展开」按钮 ——
  // 该按钮由 ProseMirror 的 widget 装饰器渲染（编辑器里实现折叠交互），
  // 导出后没有 JS、无法交互，留在文件里只会是一个废按钮，
  // 而且它带 data-esd-widget 标记，会干扰锚点文本哈希的读取。
  // 注意：它**不是** blockquote 的子内容（装饰器节点），所以删掉不影响正文。
  '.esd-quote-toggle',
  '[data-esd-widget]',
]

/**
 * 需要**剥壳（unwrap）**的结构层：删掉容器本身，把子内容提升到父级。
 *
 * 为什么不能直接 remove：这些 div 里面装的是真正要导出的正文内容，
 * 直接删会连内容一起丢；留在原地又会造成非法或反常的 HTML 结构。
 */
const UNWRAP_SELECTORS = [
  // <ul>/<ol> 的直接子元素是 <div class="milkdown-list-item-block">。
  // div 不是 ul/ol 的合法子元素，浏览器解析这种序列化结果时会把 div 移出列表，
  // 真正的 <li> 随之失去「列表项」身份，编号/项目符号全部失效。
  // 剥掉这层 div，li 直接挂在 ul/ol 上，结构才合法。
  '.milkdown-list-item-block',
  // <li> 内部的 <div class="children"> → <div class="content-dom"> 是 Milkdown 的
  // 编辑内容壳，导出样式里没有任何规则命中它们（CSS 中 .content-dom 规则数 = 0），
  // 留着只会让 li 的直接子元素是个 div。两层层层剥掉，让 <p> 直接落在 li 里。
  'li > .children',
  'li .content-dom',
  // 表格单元格同理；但 <table class="children"> 与 <tbody class="content-dom">
  // 是表格自身的合法结构（tbody 必须有），所以用 td/th 限定作用域、不剥表格本体。
  'td .content-dom',
  'th .content-dom',
]

/**
 * 需要清理的属性（编辑残留）。
 * data-* 这几项都由运行时 JS 写入：data-show 控制手柄显隐、data-role 标识手柄种类、
 * data-display-type 区分「工具/指示条」、data-content-dom 只是编辑器内部的内容壳标记。
 * 它们在静态导出里没有任何语义，且会让 HTML 看起来仍在「编辑状态」。
 * 注意 data-type 不在列表里：CSS 用 span[data-type="math_inline"] 给行内公式定位，必须保留。
 */
const STRIP_ATTRS = [
  'contenteditable',
  'spellcheck',
  'draggable',
  'data-show',
  'data-role',
  'data-display-type',
  'data-content-dom',
]

/**
 * 需要清理的运行时类名（只去类名，不删节点——这些类名标记的是「状态」而不是「控件」）。
 * 特别注意 ProseMirror-selectednode / selectedCell：它们被加在**正文节点本身**上，
 * 代表「当前被选中」，如果按控件处理把节点删掉就会丢失用户内容，所以只能剥类名。
 */
const STRIP_CLASSES = [
  'content-dom',
  'children',
  'list-item',
  'ProseMirror-selectednode',
  'selectedCell',
  'ProseMirror-focused',
  // 引用块的折叠状态：导出的是静态预览，不应继承「已收起」的临时状态
  // （否则用户在编辑器里收起过的引用，导出后永远只显示第一行）。
  'esd-quote-collapsed',
  // 「默认收起」功能引入的「第一个内容块」标记（.esd-quote-first）：
  // 它是配合 esd-quote-collapsed 使用的布局标记，必须一并剥离，
  // 否则导出 HTML 里残留该 class，可能命中同名的导出样式而截断内容。
  'esd-quote-first',
]

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('媒体读取失败'))
    reader.readAsDataURL(blob)
  })
}

/** 本地媒体引用在导出文件中改为 data URL，避免依赖应用的自定义协议。 */
function createExportMediaSourceResolver(): (reference: string, fallback: string) => Promise<string> {
  const cache = new Map<string, Promise<string>>()
  return (reference, fallback) => {
    const source = String(reference || '').trim()
    const fallbackSource = String(fallback || '').trim()
    const cacheKey = `${source}\u0000${fallbackSource}`
    const cached = cache.get(cacheKey)
    if (cached) return cached

    const pending = (async () => {
      const key = mediaKeyFromReference(source)
      if (key) {
        try {
          const dataUrl = await readMediaAsset(key)
          if (dataUrl) return dataUrl
        } catch {
          // 资产读取失败时尝试当前 DOM 的 URL；绝不把应用私有协议写入导出文件。
        }
      }

      for (const candidate of [fallbackSource, source]) {
        if (!candidate) continue
        if (/^esd-local-media:/i.test(candidate)) continue
        if (/^blob:/i.test(candidate)) {
          try {
            const response = await fetch(candidate)
            if (response.ok) return await dataUrlFromBlob(await response.blob())
          } catch {
            // 已失效的 Blob URL 会退回到原引用，避免导出流程整体失败。
          }
          continue
        }
        return candidate
      }
      return ''
    })()
    cache.set(cacheKey, pending)
    return pending
  }
}

async function materializeMediaSources(root: HTMLElement): Promise<void> {
  const resolveSource = createExportMediaSourceResolver()

  // 保留图片/播放器在笔记中的原始 NodeView DOM、样式类、尺寸、布局、标题和播放设置；
  // 这里只替换 src，避免导出后退化成原生控件或丢失单独成行/比例锁定等属性。
  for (const media of [...root.querySelectorAll<HTMLImageElement | HTMLMediaElement>('img, video, audio')]) {
    const reference = media.getAttribute('data-media-ref') || media.getAttribute('src') || ''
    const source = await resolveSource(reference, media.getAttribute('src') || '')
    const host = media.closest<HTMLElement>('.milkdown-image-block, .esd-media-block')
    if (source) {
      media.setAttribute('src', source)
      media.hidden = false
      media.removeAttribute('data-media-missing')
      host?.removeAttribute('data-media-missing')
      host?.querySelectorAll<HTMLElement>('.esd-player-shell').forEach(shell => { shell.hidden = false })
      host?.querySelector('.esd-media-failure')?.remove()
    } else if (/^(?:esd-local-media|blob):/i.test(reference)) {
      // 不把私有协议或临时 Blob 地址写进独立 HTML；保留现有失败占位（若存在）。
      media.removeAttribute('src')
      media.setAttribute('data-media-missing', 'true')
      host?.setAttribute('data-media-missing', 'true')
    }
    media.removeAttribute('data-media-ref')
    media.removeAttribute('data-media-resolved')
  }

  // 画中画与播放状态属于打开笔记后的临时状态；导出从正常的文档布局开始。
  root.querySelectorAll<HTMLElement>('.esd-player-shell').forEach(shell => {
    shell.removeAttribute('data-pip')
    shell.removeAttribute('data-paused')
    shell.querySelectorAll<HTMLElement>('.esd-player-menu, .esd-player-speed-options').forEach(menu => { menu.hidden = true })
  })
  root.querySelectorAll<HTMLElement>('.esd-media-block').forEach(block => block.removeAttribute('data-pip'))
  root.querySelectorAll<HTMLMediaElement>('video, audio').forEach(media => {
    // 当前播放进度不是笔记设置；导出页从头开始。
    try { media.currentTime = 0 } catch { /* 未加载元数据时 currentTime 不可设置 */ }
  })

}

function restoreQuoteControls(root: HTMLElement): void {
  root.querySelectorAll('.esd-quote-first').forEach(node => node.classList.remove('esd-quote-first'))
  root.querySelectorAll<HTMLElement>('blockquote').forEach(quote => {
    quote.classList.add('esd-quote-collapsed')
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'esd-quote-toggle'
    toggle.setAttribute('data-esd-widget', 'quote-toggle')
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-label', '展开引用')
    toggle.title = '展开引用（显示全部内容）'
    const firstContent = [...quote.children].find(child => !child.hasAttribute('data-esd-widget'))
    firstContent?.classList.add('esd-quote-first')
    quote.insertBefore(toggle, quote.firstChild)
  })
}

function restoreAnchorTargets(root: HTMLElement, markdown: string, pageId: string): void {
  const validIds = new Set(collectMarkdownAnchors(markdown).map(anchor => anchor.id))
  const assignedIds = new Set<string>()
  const targets = root.querySelectorAll<HTMLElement>('blockquote, h1, h2, h3, h4, h5, h6')
  for (const target of targets) {
    if (!target.matches('blockquote') && target.closest('blockquote')) continue
    const id = anchorIdForText(blockAnchorText(target))
    if (!validIds.has(id) || assignedIds.has(id)) continue
    target.id = `${pageId}--${id}`
    assignedIds.add(id)
  }

  root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(anchor => {
    const id = anchor.getAttribute('href')?.slice(1) || ''
    if (validIds.has(id)) anchor.setAttribute('href', `#${pageId}--${id}`)
  })
}

function normalizeWikiTarget(target: string): string {
  return String(target || '').trim().toLowerCase()
}

function restoreWikiLinks(root: HTMLElement, pageId: string, pagesByTitle: Map<string, string>): void {
  root.querySelectorAll<HTMLElement>('span[data-type="wikiLink"][data-target]').forEach(wikiLink => {
    const target = normalizeWikiTarget(wikiLink.dataset.target || '')
    const targetPage = pagesByTitle.get(target)
    if (!targetPage) return
    const link = document.createElement('a')
    link.className = 'wiki-link'
    link.href = `#${targetPage}`
    link.dataset.noteTarget = targetPage
    link.textContent = wikiLink.dataset.label || wikiLink.textContent || wikiLink.dataset.target || ''
    if (targetPage === pageId) link.setAttribute('aria-current', 'page')
    wikiLink.replaceWith(link)
  })
}

/**
 * 清洗编辑器 DOM：去掉交互控件与编辑属性，保留内容与样式类名。
 * 用 cloneNode 深拷贝，避免影响正在编辑的真实 DOM。
 *
 * 清洗顺序刻意固定，因为步骤之间存在依赖：
 *   ① 删除编辑器专用交互控件；媒体播放器控件保留并由导出脚本接管；
 *   ② 剥壳非法结构 —— 必须在 ① 之后，否则手柄包裹层会跟着一起被误判。
 *   ③ 删除空表格 —— 必须在 ② 之后：空占位 <table><tbody></tbody></table>
 *      是包在表格区块 div 里的，只有等结构稳定后才能判定。
 *   ④ 清属性/类名 —— 必须在结构稳定后做，避免在会被删掉的节点上白做工。
 *   ⑤ 删除空段落 —— 必须在 ④ 之后：刚被清掉内容（只剩 <br>）的 <p> 才能被识别。
 *   ⑥ 补 .milkdown 祖先 —— 必须最后做，否则 ②④ 会把它当成普通 div 处理。
 *
 * 注意：导出的是 ProseMirror 的**内容**（innerHTML），其祖先 `.milkdown` /
 * `.markdown-body` 不在其中，而不少规则写成 `.milkdown .milkdown-code-block …`。
 * 因此最后给代码块补一层 `.milkdown` 包裹容器，让这些规则也能命中。
 */
async function sanitizeContentForExport(
  source: HTMLElement,
  markdown: string,
  pageId: string,
  pagesByTitle: Map<string, string>,
): Promise<string> {
  const clone = source.cloneNode(true) as HTMLElement
  await materializeMediaSources(clone)

  // 公式和排版规则依赖 `.milkdown` / `.note-export-body` 祖先；给正文统一包一层，
  // 这样行内 math_inline、段落首行缩进和代码块样式在独立 HTML 里仍能命中。
  const markdownBodyWrapper = document.createElement('div')
  markdownBodyWrapper.className = 'markdown-body'
  const milkdownWrapper = document.createElement('div')
  milkdownWrapper.className = 'milkdown'
  const bodyWrapper = document.createElement('div')
  bodyWrapper.className = 'ProseMirror note-export-body'
  while (clone.firstChild) bodyWrapper.appendChild(clone.firstChild)
  milkdownWrapper.appendChild(bodyWrapper)
  markdownBodyWrapper.appendChild(milkdownWrapper)
  clone.appendChild(markdownBodyWrapper)

  // ① 删除编辑器专用控件；主题化媒体控件留在 DOM 中并在导出页重新绑定事件。
  for (const selector of STRIP_SELECTORS) {
    clone.querySelectorAll(selector).forEach(node => node.remove())
  }
  // 导出 HTML 会启用自己的引用块切换脚本，因此清掉笔记原始 HTML 中的脚本与事件属性。
  clone.querySelectorAll('script').forEach(node => node.remove())

  // ② 剥壳：把非法/多余的容器去掉，内容提升到父级（删容器不删内容）
  for (const selector of UNWRAP_SELECTORS) {
    clone.querySelectorAll(selector).forEach(node => {
      const parent = node.parentNode
      if (!parent) return
      // 剥壳的前提是「容器里确实是正文」。若容器已经空了，
      // 说明它本身就是个纯占位层，直接删除即可，免得留下空 div。
      if (!node.firstChild) {
        node.remove()
        return
      }
      while (node.firstChild) parent.insertBefore(node.firstChild, node)
      node.remove()
    })
  }

  // ③ 删除空表格与空 tbody：table-wrapper 里的空占位结构，导出后是看不见的空框
  clone.querySelectorAll('table').forEach(table => {
    if (table.querySelector('td, th')) return // 有单元格 = 真实表格，保留
    table.remove()
  })
  clone.querySelectorAll('tbody').forEach(tbody => {
    if (tbody.querySelector('td, th, tr')) return
    tbody.remove()
  })

  // ④ 清理运行时属性与状态类名
  clone.querySelectorAll('*').forEach(node => {
    for (const attr of STRIP_ATTRS) node.removeAttribute(attr)
    // Vue/Milkdown 的运行时标记，离线后没有任何意义
    for (const attr of [...node.getAttributeNames()]) {
      if (attr.startsWith('data-v-') || attr === 'data-v-app') node.removeAttribute(attr)
      else if (/^on/i.test(attr)) node.removeAttribute(attr)
    }
    // 链接保留 href 即可（导出的是只读预览）
    if (node instanceof HTMLAnchorElement) {
      node.removeAttribute('target')
      if (/^\s*javascript:/i.test(node.getAttribute('href') || '')) node.removeAttribute('href')
    }
    // 状态类名只剥类、不删节点——节点里装着用户内容
    for (const cls of STRIP_CLASSES) node.classList.remove(cls)
    // 清到没有类名时把空壳属性也去掉，输出更干净
    if (node.classList.length === 0) node.removeAttribute('class')
    // ★ 不能顺手清 style：KaTeX 的 vlist/pstrut 靠内联 height/top 做公式排版，
    //   删了公式就散架；td/th 的 text-align 也必须保留。
    //   需要清掉的「运行时测量坐标」只存在于 .handle 上，而它们已在 ① 中被整体删除。
  })

  // ⑤ 删除 ProseMirror 尾部占位换行：空单元格里渲染成
  //    <p><br class="ProseMirror-trailingBreak"></p>，在编辑器里是「光标可落点」的
  //    视觉占位，导出后只是一个多余的换行/空行。
  clone.querySelectorAll('br.ProseMirror-trailingBreak').forEach(br => {
    const parent = br.parentNode
    br.remove()
    // <br> 删掉后段落往往已空（只剩不可见空白），再删这个空 <p>，避免多出空行
    if (parent instanceof HTMLElement && parent.tagName === 'P') {
      const hasContent = parent.textContent?.trim() || parent.querySelector('img, math, .katex')
      if (!hasContent) parent.remove()
    }
  })

  // ⑥ 正文统一包了 `.milkdown`，代码块样式依赖的祖先现已存在。
  clone.querySelectorAll('.milkdown-code-block').forEach(block => {
    if (block.closest('.milkdown')) return
    const wrapper = document.createElement('div')
    wrapper.className = 'milkdown'
    block.replaceWith(wrapper)
    wrapper.appendChild(block)
  })

  // ⑦ 宽表用滚动容器包起来。
  //    注意：EXPORT_BASE_CSS 里早有 .note-export-table-scroll 的规则，
  //    但之前只写了样式、**没有任何代码创建这个元素**，所以那条 CSS 是死代码，
  //    宽表在窄窗口/手机上仍会撑破页面。这里补上真正的包裹动作。
  //    只包「有内容的表」（空表已在 ③ 删除）；表格自身合法结构不动。
  clone.querySelectorAll('table').forEach(table => {
    const parent = table.parentNode
    if (!parent) return
    // 已经在滚动容器里就不重复包
    if (parent instanceof HTMLElement && parent.classList.contains('note-export-table-scroll')) return
    const scroller = document.createElement('div')
    scroller.className = 'note-export-table-scroll'
    parent.insertBefore(scroller, table)
    scroller.appendChild(table)
  })

  // 导出引用块统一默认收起，并重建独立 HTML 内可用的切换按钮；
  // 锚点 ID 从 Markdown 与 DOM 的同一套文本哈希中恢复。
  restoreQuoteControls(clone)
  restoreAnchorTargets(clone, markdown, pageId)
  restoreWikiLinks(clone, pageId, pagesByTitle)

  return clone.innerHTML
}

export interface ExportHtmlPayload {
  note: Note
  tags: Tag[]
  /** 编辑器渲染根（.ProseMirror） */
  contentEl: HTMLElement
  /** 主笔记当前编辑器内容；避免防抖保存前遗漏新链接或锚点 */
  markdown?: string
  /** 通过 wiki 链接递归收集到的其它笔记，内容由当前 Milkdown parser 渲染 */
  linkedNotes?: Array<{ note: Note; tags: Tag[]; contentEl: HTMLElement; markdown?: string }>
  /** wiki 标题解析到的笔记 id，用于同名笔记时保持与笔记内跳转一致 */
  wikiTargets?: Record<string, string>
}

/** 转义 HTML 文本（标题等） */
function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 导出为自包含 HTML 文件并触发下载。
 * @returns 生成的 HTML 文本（便于测试断言）
 */
export async function exportNoteHtml({ note, tags, contentEl, markdown, linkedNotes = [], wikiTargets = {} }: ExportHtmlPayload): Promise<string> {
  const { css, katexFontFaces } = captureEditorStyles()
  const cssVariables = captureCssVariables()
  const katexFonts = await inlineKatexFonts(katexFontFaces)
  const title = (note.title || '无标题').trim()
  const pages = [{ note, tags, contentEl, markdown }, ...linkedNotes]
  const pageIds = pages.map((_page, index) => `note-export-page-${index}`)
  const pagesByTitle = new Map<string, string>()
  const pageIdByNoteId = new Map<string, string>()
  pages.forEach((page, index) => {
    pageIdByNoteId.set(page.note.id, pageIds[index])
    const key = normalizeWikiTarget(page.note.title)
    if (key && !pagesByTitle.has(key)) pagesByTitle.set(key, pageIds[index])
  })
  for (const [target, noteId] of Object.entries(wikiTargets)) {
    const pageId = pageIdByNoteId.get(noteId)
    if (pageId) pagesByTitle.set(normalizeWikiTarget(target), pageId)
  }
  const exportedAt = new Date().toLocaleString()
  const renderTagHtml = (pageTags: Tag[]) => {
    const names = pageTags.map(tag => tag.name).filter(Boolean)
    return names.length
      ? `<div class="note-export-tags">${names.map(name => `<span>${escapeHtml(name)}</span>`).join('')}</div>`
      : ''
  }
  const articleHtml: string[] = []
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]
    const pageId = pageIds[index]
    const body = await sanitizeContentForExport(page.contentEl, page.markdown ?? page.note.content, pageId, pagesByTitle)
    const pageTitle = (page.note.title || '无标题').trim()
    const metaHtml = `<div class="note-export-meta">导出于 ${escapeHtml(exportedAt)}</div>`
    articleHtml.push(`<article class="note-export-wrap" data-export-scope="" data-note-page="${pageId}" id="${pageId}"${index === 0 ? '' : ' hidden'}>
<header class="note-export-header">
<h1 class="note-export-title">${escapeHtml(pageTitle)}</h1>
${renderTagHtml(page.tags)}
${metaHtml}
</header>
${body}
</article>`)
  }

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${EXPORT_BASE_CSS}
/* ===== 编辑器当前实际生效的 CSS 变量（代码块/引用/行内代码依赖） ===== */
${cssVariables}
.note-export-title {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 65%;
  overflow: hidden;
  color: #bfdbfe;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.4;
  margin: 0;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-export-tags { display: flex; flex: 0 0 auto; flex-wrap: wrap; gap: 6px; margin: 0; }
.note-export-tags span {
  padding: 2px 8px; border-radius: 999px; font-size: 12px;
  background: rgba(102, 126, 234, 0.16); border: 1px solid rgba(102, 126, 234, 0.35); color: #93c5fd;
}
.note-export-meta { flex: 0 0 auto; margin: 0; font-size: 12px; color: rgba(148, 163, 184, 0.65); white-space: nowrap; }
.note-export-wrap[hidden] { display: none !important; }
.note-export-navigation { margin: 0 36px; }
.note-export-back {
  margin: 16px 0;
  padding: 7px 12px; border: 1px solid rgba(102,126,234,.42); border-radius: 9px;
  color: #bfdbfe; background: rgba(102,126,234,.14); font: inherit; cursor: pointer;
}
.note-export-back:hover { background: rgba(102,126,234,.25); }
.note-export-wrap a[data-note-target] { cursor: pointer; }
@media (max-width: 640px) {
  .note-export-header { flex-wrap: wrap; }
  .note-export-title { max-width: 100%; }
  .note-export-meta { margin-left: 0; }
  .note-export-navigation { margin-inline: 20px; }
}
/* ===== 运行时抓取的编辑器排版与代码着色样式 ===== */
${css}
.note-export-wrap a.wiki-link {
  display: inline-block;
  padding: 0 5px;
  border-radius: 5px;
  background: rgba(102, 126, 234, 0.14);
  color: #93c5fd;
  text-decoration: none;
}
.note-export-wrap a.wiki-link:hover { background: rgba(102, 126, 234, 0.28); color: #c7d2fe; }
/* ===== KaTeX 字体（base64 内联，离线一致） ===== */
${katexFonts}
</style>
</head>
<body>
<nav class="note-export-navigation" aria-label="笔记页面导航">
<button type="button" class="note-export-back" hidden>← 返回</button>
</nav>
${articleHtml.join('\n')}
<script>
(() => {
  const pages = Array.from(document.querySelectorAll('[data-note-page]'));
  const backButton = document.querySelector('.note-export-back');
  const pageHistory = [];
  let activePage = pages.find(page => !page.hidden) || pages[0] || null;
  const showPage = (page, remember = true) => {
    if (!page || page === activePage) return;
    if (remember && activePage) pageHistory.push(activePage);
    pages.forEach(item => { item.hidden = item !== page; });
    activePage = page;
    if (backButton) backButton.hidden = pageHistory.length === 0;
    mediaElements.forEach(item => {
      item.media.pause();
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  if (backButton) backButton.addEventListener('click', () => {
    const previous = pageHistory.pop();
    if (previous) showPage(previous, false);
    if (backButton) backButton.hidden = pageHistory.length === 0;
  });
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a[data-note-target]');
    if (!link) return;
    const pageId = link.getAttribute('data-note-target');
    const page = pages.find(item => item.getAttribute('data-note-page') === pageId);
    if (!page || page === activePage) return;
    event.preventDefault();
    showPage(page);
  });

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.esd-quote-toggle');
    if (!button) return;
    const quote = button.closest('blockquote');
    if (!quote) return;
    const collapsed = quote.classList.toggle('esd-quote-collapsed');
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? '展开引用' : '收起引用');
    button.title = collapsed ? '展开引用（显示全部内容）' : '收起引用（只显示第一行）';
  });

  const mediaNodes = Array.from(document.querySelectorAll('.esd-media-block'));
  const mediaElements = mediaNodes.map(block => ({
    block: block,
    shell: block.querySelector('.esd-player-shell'),
    media: block.querySelector('video, audio')
  })).filter(item => item.shell && item.media);
  const formatTime = value => {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const seconds = Math.floor(value);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = String(seconds % 60).padStart(2, '0');
    return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + remainder : minutes + ':' + remainder;
  };

  mediaElements.forEach(item => {
    const block = item.block;
    const shell = item.shell;
    const media = item.media;
    const play = shell.querySelector('.esd-player-play');
    const time = shell.querySelector('.esd-player-time');
    const progress = shell.querySelector('.esd-player-progress');
    const volumeButton = shell.querySelector('.esd-player-volume-button');
    const volume = shell.querySelector('.esd-player-volume');
    const fullscreen = shell.querySelector('.esd-player-fullscreen, button[aria-label="全屏播放"], button[aria-label="最大化音频播放器"]');
    const menuButton = shell.querySelector('.esd-player-menu-toggle');
    const menu = shell.querySelector('.esd-player-menu');
    const speedToggle = shell.querySelector('.esd-player-menu-item');
    const speedOptions = shell.querySelector('.esd-player-speed-options');
    const pip = shell.querySelector('.esd-player-menu-item[aria-label="在应用右下角显示画中画"]');
    const closePip = shell.querySelector('.esd-player-pip-close');
    if (!play || !progress || !volumeButton || !volume || !fullscreen || !menuButton || !menu || !speedToggle || !speedOptions) return;

    const sync = () => {
      const paths = play.querySelectorAll('svg path');
      if (paths[0]) paths[0].setAttribute('d', media.paused ? 'M8 5v14l11-7z' : 'M7 5h4v14H7zM13 5h4v14h-4z');
      play.setAttribute('aria-label', (media.paused ? '播放' : '暂停') + (media.tagName.toLowerCase() === 'video' ? '视频' : '音频'));
      shell.dataset.paused = String(media.paused);

      const duration = Number.isFinite(media.duration) ? media.duration : 0;
      progress.max = String(duration);
      progress.value = String(Math.min(media.currentTime || 0, duration));
      if (time) time.textContent = formatTime(media.currentTime) + ' / ' + formatTime(duration);

      const muted = media.muted || media.volume === 0;
      const volumePaths = volumeButton.querySelectorAll('svg path');
      if (volumePaths[1]) {
        volumePaths[1].setAttribute('d', muted ? 'm17 9 4 6m0-6-4 6' : 'M16 9a4 4 0 0 1 0 6m2-9a7 7 0 0 1 0 12');
        volumePaths[1].setAttribute('fill', 'none');
        volumePaths[1].setAttribute('stroke', 'currentColor');
      }
      volumeButton.setAttribute('aria-label', muted ? '取消静音' : '静音');
      volume.value = String(media.muted ? 0 : media.volume);

      const speed = String(media.playbackRate) + '×';
      const speedText = speedToggle.firstChild;
      if (speedText && speedText.nodeType === Node.TEXT_NODE) speedText.nodeValue = '播放速度　' + speed + '　›';
      speedOptions.querySelectorAll('.esd-player-speed-option').forEach(option => {
        option.classList.toggle('active', Number(option.dataset.speed) === media.playbackRate);
      });
      fullscreen.setAttribute('aria-label', document.fullscreenElement === shell
        ? (media.tagName.toLowerCase() === 'video' ? '退出全屏' : '退出最大化')
        : (media.tagName.toLowerCase() === 'video' ? '全屏播放' : '最大化音频播放器'));
    };

    const closeMenus = () => {
      menu.hidden = true;
      speedOptions.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
    };
    const positionMenuAboveButton = () => {
      const shellRect = shell.getBoundingClientRect();
      const triggerRect = menuButton.getBoundingClientRect();
      const triggerRight = triggerRect.right - shellRect.left - shell.clientLeft;
      const triggerTop = triggerRect.top - shellRect.top - shell.clientTop;
      menu.style.right = Math.max(0, shell.clientWidth - triggerRight) + 'px';
      menu.style.bottom = Math.max(0, shell.clientHeight - triggerTop + 6) + 'px';
    };
    const playMedia = () => {
      if (media.paused) void media.play().catch(() => {});
      else media.pause();
    };

    play.addEventListener('click', event => { event.preventDefault(); playMedia(); });
    progress.addEventListener('input', () => {
      if (Number.isFinite(media.duration)) media.currentTime = Number(progress.value);
    });
    volumeButton.addEventListener('click', () => {
      if (media.muted || media.volume === 0) {
        if (media.volume === 0) media.volume = 0.5;
        media.muted = false;
      } else media.muted = true;
    });
    volume.addEventListener('input', () => {
      media.volume = Number(volume.value);
      media.muted = media.volume === 0;
    });
    fullscreen.addEventListener('click', () => {
      if (document.fullscreenElement === shell) void document.exitFullscreen().catch(() => {});
      else if (shell.requestFullscreen) void shell.requestFullscreen().catch(() => {});
    });
    menuButton.addEventListener('click', () => {
      if (menu.hidden) positionMenuAboveButton();
      menu.hidden = !menu.hidden;
      speedOptions.hidden = true;
      menuButton.setAttribute('aria-expanded', String(!menu.hidden));
    });
    speedToggle.addEventListener('click', () => { speedOptions.hidden = !speedOptions.hidden; });
    speedOptions.querySelectorAll('.esd-player-speed-option').forEach(option => {
      option.addEventListener('click', () => {
        media.playbackRate = Number(option.dataset.speed);
        speedOptions.hidden = true;
        sync();
      });
    });
    if (pip && closePip) {
      const togglePip = () => {
        const enabled = shell.dataset.pip !== 'true';
        shell.dataset.pip = String(enabled);
        block.dataset.pip = String(enabled);
        closeMenus();
      };
      pip.addEventListener('click', togglePip);
      closePip.addEventListener('click', togglePip);
    }
    if (media.tagName.toLowerCase() === 'video') {
      media.addEventListener('click', playMedia);
      media.addEventListener('contextmenu', event => event.preventDefault());
    }
    media.addEventListener('play', () => {
      mediaElements.forEach(other => { if (other.media !== media) other.media.pause(); });
      sync();
    });
    ['timeupdate', 'durationchange', 'loadedmetadata', 'play', 'pause', 'volumechange', 'ratechange', 'ended'].forEach(name => {
      media.addEventListener(name, sync);
    });
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('click', event => {
      if (!shell.contains(event.target)) closeMenus();
    });
    window.addEventListener('resize', () => { if (!menu.hidden) positionMenuAboveButton(); });
    sync();
  });

})();
</script>
</body>
</html>
`
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${sanitizeFileName(title)}.html`)
  return html
}
