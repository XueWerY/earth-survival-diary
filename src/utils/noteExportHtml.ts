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
 * 导出文件没有 .md-editor 这一层祖先，规则会全部失效（实测首行缩进、引用底色、
 * 行内代码底色都丢）。处理分三步：
 *   1) 剥掉 .md-editor[data-v-…] 前缀与残留的 data-v 属性；
 *   2) 导出容器本身就是 .markdown-body，因此把开头的这一节收敛掉；
 *   3) 统一挂到 .note-export-wrap 之下，避免样式泄漏到页面其它元素。
 */
const HOST_SCOPE_PATTERN = /^\s*\.md-editor(?:\[data-v-[0-9a-f]+\])?\s*/
const DATA_V_PATTERN = /\[data-v-[0-9a-f]+\]/g

function rewriteSelectorForExport(selector: string): string {
  return selector
    .split(',')
    .map(part => {
      let trimmed = part.trim()
      trimmed = trimmed.replace(HOST_SCOPE_PATTERN, '')
      trimmed = trimmed.replace(DATA_V_PATTERN, '')
      // 收敛掉开头的 .markdown-body（article 自带该类）
      trimmed = trimmed.replace(/^\.markdown-body(?=[\s>+~])/, '').replace(/^\.markdown-body$/, '')
      if (!trimmed) return '.note-export-wrap'
      if (trimmed.startsWith('.note-export-wrap')) return trimmed
      return `.note-export-wrap ${trimmed}`
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
  // 排除明显与预览无关的宿主界面样式
  if (/\.(np-|editor-|outline|menubar|el-|app-scrollbar|guide-)/.test(selector)) {
    return /\.katex|\.hljs|code-preview/.test(selector)
  }
  return STYLE_SCOPE_MARKERS.some(marker => selector.includes(marker))
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
        if (!isRelevantRule(selector)) continue
        // 保留声明体，只改写选择器前缀
        const body = text.slice(text.indexOf('{'))
        cssChunks.push(`${rewriteSelectorForExport(selector)}${body}`)
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
            if (!isRelevantRule(selector)) continue
            const body = childText.slice(childText.indexOf('{'))
            inner.push(`${rewriteSelectorForExport(selector)}${body}`)
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
  max-width: 860px;
  margin: 0 auto;
  padding: 56px 28px 96px;
}
.note-export-wrap img,
.note-export-wrap video {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}
.note-export-wrap a { color: #93c5fd; text-decoration: none; }
.note-export-wrap a:hover { text-decoration: underline; }
/* 只读预览：隐藏源码编辑区与所有交互控件 */
.note-export-wrap .tools,
.note-export-wrap .tools-button-group,
.note-export-wrap .language-picker,
.note-export-wrap .codemirror-host,
.note-export-wrap .milkdown-latex-inline-edit,
.note-export-wrap .milkdown-image-block > .image-edit,
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
 * 需要从导出内容里**整块删除**的交互节点选择器（含其全部子节点与内嵌 SVG）。
 *
 * 为什么集中成一张表：这些选择器属于同一类东西——「编辑器交互外壳」。
 * 它们的共同点是「在浏览器里由 JS 驱动、靠绝对定位或图标显示」，导出成静态 HTML 后
 * 既无法交互、又会实打实地画出一堆图标/按钮（真实产物里 <button> 约 55KB、<svg> 约 64KB）。
 * 集中声明后：① 新增控件只要加一行；② 审计时一眼能看出删了什么；③ 不会因为流程里
 * 漏写一条 if 而残留。删除顺序永远是「先删块，再处理剩下的结构」。
 */
const STRIP_SELECTORS = [
  // —— 代码块 / 公式 / 图片的编辑外壳（原有条目） ——
  '.tools',
  '.language-picker',
  '.codemirror-host',
  '.milkdown-latex-inline-edit',
  '.prosemirror-virtual-cursor',
  '.ProseMirror-virtual-cursor',
  '.image-edit',
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

/**
 * 清洗编辑器 DOM：去掉交互控件与编辑属性，保留内容与样式类名。
 * 用 cloneNode 深拷贝，避免影响正在编辑的真实 DOM。
 *
 * 清洗顺序刻意固定为下面的六步，因为步骤之间存在依赖：
 *   ① 删除交互控件 —— 必须先做。手柄/按钮里嵌着 <svg>，它们各自带一份
 *      <clipPath id="clip0_…">；只要一个 SVG 还在，重复 id 就还在。
 *      把控件整块删掉，SVG 与重复 id 一次性消失，比逐个去重可靠得多。
 *      正文里没有用户图片（img = 0），KaTeX 也不用 SVG，所以删除是安全的。
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
function sanitizeContentForExport(source: HTMLElement): string {
  const clone = source.cloneNode(true) as HTMLElement

  // ① 删除交互控件（含内嵌 svg；顺带解决 clip* 重复 id）
  for (const selector of STRIP_SELECTORS) {
    clone.querySelectorAll(selector).forEach(node => node.remove())
  }
  // 兜底：正文没有用户图片，KaTeX 也不用 svg，因此任何残留 SVG 都是控件图标。
  // 单独再扫一遍，防止未来新增控件类名没进 STRIP_SELECTORS 而漏删。
  clone.querySelectorAll('svg').forEach(node => node.remove())
  // 兜底：clipPath 的 id 一律清掉（即便节点残留也不会造成重复 id）
  clone.querySelectorAll('[id^="clip"]').forEach(node => node.removeAttribute('id'))

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
    }
    // 链接保留 href 即可（导出的是只读预览）
    if (node instanceof HTMLAnchorElement) node.removeAttribute('target')
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

  // ⑥ 给每个代码块补 `.milkdown` 祖先（原选择器依赖它）
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

  return clone.innerHTML
}

export interface ExportHtmlPayload {
  note: Note
  tags: Tag[]
  /** 编辑器渲染根（.ProseMirror） */
  contentEl: HTMLElement
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
export async function exportNoteHtml({ note, tags, contentEl }: ExportHtmlPayload): Promise<string> {
  const { css, katexFontFaces } = captureEditorStyles()
  const cssVariables = captureCssVariables()
  const katexFonts = await inlineKatexFonts(katexFontFaces)
  const body = sanitizeContentForExport(contentEl)
  const title = (note.title || '无标题').trim()
  const tagNames = tags.map(t => t.name).filter(Boolean)

  const tagHtml = tagNames.length
    ? `<div class="note-export-tags">${tagNames.map(name => `<span>${escapeHtml(name)}</span>`).join('')}</div>`
    : ''
  const metaHtml = `<div class="note-export-meta">导出于 ${escapeHtml(new Date().toLocaleString())}</div>`

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
.note-export-title { font-size: 26px; font-weight: 700; color: #bfdbfe; margin: 0 0 10px; line-height: 1.4; }
.note-export-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.note-export-tags span {
  padding: 2px 8px; border-radius: 999px; font-size: 12px;
  background: rgba(102, 126, 234, 0.16); border: 1px solid rgba(102, 126, 234, 0.35); color: #93c5fd;
}
.note-export-meta { font-size: 12px; color: rgba(148, 163, 184, 0.65); margin-bottom: 24px; }
/* ===== 运行时抓取的编辑器排版与代码着色样式 ===== */
${css}
/* ===== KaTeX 字体（base64 内联，离线一致） ===== */
${katexFonts}
</style>
</head>
<body>
<article class="note-export-wrap markdown-body">
<h1 class="note-export-title">${escapeHtml(title)}</h1>
${tagHtml}
${metaHtml}
${body}
</article>
</body>
</html>
`
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${sanitizeFileName(title)}.html`)
  return html
}
