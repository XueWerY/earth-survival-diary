// 高亮 / 文字颜色：自定义 PM mark + remark 双向桥接。
//
// 为什么不能直接用行内 HTML：Milkdown 把 markdown 里的 `<mark>` / `<span>` 当作
// inline `html` 原子节点渲染（contenteditable=false 的字面标签），不产生样式。
// 因此存储仍用行内 HTML（Typora/Obsidian 通行的可移植格式），但：
//   解析：remark 插件把成对 HTML 标签折成自定义 mdast 节点 → 对应 mark 渲染
//   序列化：向 remarkStringifyOptionsCtx.handlers 注册 handler，把 mark 还原成 HTML
//
//   markdown: <mark style="background:#fde047">文字</mark>
//        ↓ remark 折标签                      ↑ 自定义 stringify handler
//   mdast:    { type: 'esdHighlight', color: '#fde047', children: [text('文字')] }
//        ↓ mark parseMarkdown                  ↑ mark toMarkdown
//   PM:       text('文字') 带 esdHighlight mark

import { $markSchema, $remark } from '@milkdown/kit/utils'
import { remarkStringifyOptionsCtx } from '@milkdown/kit/core'

export const HIGHLIGHT_NODE = 'esdHighlight'
export const TEXTCOLOR_NODE = 'esdTextColor'
/**
 * 下划线。Markdown 无下划线语法，沿用同一套「行内 HTML ↔ PM mark」桥接：
 * 存储写 `<u>文字</u>`（Typora/Obsidian 通行的可移植写法），
 * PM 侧是自定义 mark。
 *
 * 为什么必须自建 mark：Milkdown/Crepe 的默认 schema **不含 underline**
 * （已在打包产物里核对，出现的 underline 全是 KaTeX 与 CodeMirror 的无关标识）。
 * 只靠 document.execCommand('underline') 插入的 <u> 不在 schema 内，
 * ProseMirror 会把它当未知行内节点丢掉或原样吐回，样式不生效。
 */
export const UNDERLINE_NODE = 'esdUnderline'

/**
 * 上标 / 下标。
 *
 * 与下划线同一套思路：Markdown 没有上下标语法，因此存储用行内 HTML
 * `<sup>文字</sup>` / `<sub>文字</sub>`（Typora / Obsidian / GitHub 通行的可移植写法），
 * PM 侧是自定义 mark，靠 remark 折标签 + stringify handler 完成双向桥接。
 *
 * 为什么不直接依赖浏览器：`document.execCommand('superscript')` 生成的是
 * `<sup>`，但 PM 的 schema 里没有这个 mark，会被丢弃或原样回吐（与下划线同样的坑）。
 * 另外 execCommand 的上下标在不同内核下会产出 `<sup>` 或带 style 的 `<span>`，不稳定，
 * 因此自建 mark 才能保证「生效 + 可往返保存」。
 */
export const SUPERSCRIPT_NODE = 'esdSuperscript'
export const SUBSCRIPT_NODE = 'esdSubscript'

/** 打开标签匹配规则：<mark style="background:X"> 与 <span style="color:X"> */
const OPEN_TAG_RE = /^<(mark|span)\s+style="([^"]*)"\s*>$/i
/** 下划线：无属性的 <u> */
const UNDERLINE_OPEN_RE = /^<u\s*>$/i
/** 上标 / 下标：无属性的 <sup> / <sub> */
const SUP_OPEN_RE = /^<sup\s*>$/i
const SUB_OPEN_RE = /^<sub\s*>$/i
/** 闭合标签：</mark> </span> </u> </sup> </sub> */
const CLOSE_TAG_RE = /^<\/(mark|span|u|sup|sub)>$/i

interface OpenTagInfo {
  tag: string
  styleProp: 'background' | 'color' | ''
  color: string
  nodeType: string
}

function parseOpenTag(value: string): OpenTagInfo | null {
  const raw = (value || '').trim()
  // 下划线单独识别（无 style 属性）
  if (UNDERLINE_OPEN_RE.test(raw)) {
    return { tag: 'u', styleProp: '', color: '', nodeType: UNDERLINE_NODE }
  }
  // 上标 / 下标（同样无 style 属性）
  if (SUP_OPEN_RE.test(raw)) {
    return { tag: 'sup', styleProp: '', color: '', nodeType: SUPERSCRIPT_NODE }
  }
  if (SUB_OPEN_RE.test(raw)) {
    return { tag: 'sub', styleProp: '', color: '', nodeType: SUBSCRIPT_NODE }
  }
  const m = OPEN_TAG_RE.exec(raw)
  if (!m) return null
  const [, tag, style] = m
  const lower = style.toLowerCase()
  const isBackground = lower.includes('background')
  const tagLower = tag.toLowerCase()
  // 高亮只认 mark，文字色只认 span；避免误伤其他行内样式
  if (tagLower === 'mark' && !isBackground) return null
  if (tagLower === 'span' && isBackground) return null
  const colorMatch = /(?:background|color)\s*:\s*([^;]+)/i.exec(style)
  const color = colorMatch ? colorMatch[1].trim() : (isBackground ? '#fde047' : '#fca5a5')
  return {
    tag: tagLower,
    styleProp: isBackground ? 'background' : 'color',
    color,
    nodeType: isBackground ? HIGHLIGHT_NODE : TEXTCOLOR_NODE,
  }
}

/** remark 解析插件：把成对行内 HTML 标签折成自定义 mdast 节点 */
export const remarkTextStyle = $remark('remarkTextStyle', () => () => (tree: any) => {
  const fold = (parent: any) => {
    if (!parent || !Array.isArray(parent.children)) return
    const out: any[] = []
    let i = 0
    while (i < parent.children.length) {
      const child = parent.children[i]
      if (child.type === 'html') {
        const open = parseOpenTag(child.value || '')
        if (open) {
          let depth = 1
          let j = i + 1
          const inner: any[] = []
          let closed = false
          for (; j < parent.children.length; j++) {
            const cur = parent.children[j]
            if (cur.type === 'html') {
              const innerOpen = parseOpenTag(cur.value || '')
              if (innerOpen && innerOpen.tag === open.tag) { depth++; inner.push(cur); continue }
              const closeMatch = CLOSE_TAG_RE.exec((cur.value || '').trim())
              if (closeMatch && closeMatch[1].toLowerCase() === open.tag) {
                depth--
                if (depth === 0) { closed = true; break }
              }
            }
            inner.push(cur)
          }
          if (closed) {
            /*
              ⚠️ 这里必须递归处理 inner，而不是 `inner.forEach(fold)`。
              fold 的入参是「父节点」（要有 .children），而 forEach 传进来的是
              **数组元素**（text/html 节点，没有 .children）→ 内部第一行就 return，
              嵌套的样式永远折不出来。
              表现：`<sup>a<sup>b</sup></sup>` 只有外层被识别，内层残留裸 <sup> 标签
              （编辑器里显示为字面标签而不是上标）。

              注意：fold 内部会把父对象的 .children 重赋值为新数组（不是原地改），
              因此必须用一个临时父节点承接结果，再读回它 —— 直接传 inner 数组
              的包装对象、却仍然使用原 inner 引用，等于白折。
            */
            const wrapper: any = { type: 'root', children: inner }
            fold(wrapper)
            out.push({ type: open.nodeType, color: open.color, children: wrapper.children })
            i = j + 1
            continue
          }
        }
      }
      fold(child)
      out.push(child)
      i++
    }
    parent.children = out
  }
  fold(tree)
})

/** mdast-util-to-markdown handler：自定义节点 → 行内 HTML */
function makeHtmlHandler(tag: string, styleProp: string) {
  return (node: any, _parent: any, state: any, info: any) => {
    const exit = state.enter(node.type)
    const tracker = state.createTracker(info)
    let value = tracker.move(`<${tag} style="${styleProp}:${node.color}">`)
    value += tracker.move(state.containerPhrasing(node, {
      before: value,
      after: `</${tag}>`,
      ...tracker.current(),
    }))
    value += tracker.move(`</${tag}>`)
    exit()
    return value
  }
}

/** 无属性标签的 handler（下划线）：只吐 <u>…</u> */
function makePlainTagHandler(tag: string) {
  return (node: any, _parent: any, state: any, info: any) => {
    const exit = state.enter(node.type)
    const tracker = state.createTracker(info)
    let value = tracker.move(`<${tag}>`)
    value += tracker.move(state.containerPhrasing(node, {
      before: value,
      after: `</${tag}>`,
      ...tracker.current(),
    }))
    value += tracker.move(`</${tag}>`)
    exit()
    return value
  }
}

/**
 * 序列化插件：向 remarkStringifyOptionsCtx.handlers 注册自定义节点 handler。
 * 必须在 Remark 处理器构建（SchemaReady 计时器）之前执行——作为普通 Milkdown
 * 插件在使用顺序中注册即可满足。
 */
export const textStyleStringify = (ctx: any) => () => {
  ctx.update(remarkStringifyOptionsCtx, (prev: any) => ({
    ...prev,
    handlers: {
      ...(prev?.handlers || {}),
      [HIGHLIGHT_NODE]: makeHtmlHandler('mark', 'background'),
      [TEXTCOLOR_NODE]: makeHtmlHandler('span', 'color'),
      [UNDERLINE_NODE]: makePlainTagHandler('u'),
      [SUPERSCRIPT_NODE]: makePlainTagHandler('sup'),
      [SUBSCRIPT_NODE]: makePlainTagHandler('sub'),
    },
  }))
}

/** 高亮 mark */
export const highlightMark = $markSchema(HIGHLIGHT_NODE, () => ({
  attrs: { color: { default: '#fde047' } },
  parseDOM: [
    {
      tag: 'mark',
      getAttrs: (dom: HTMLElement) => ({ color: dom.style.background || dom.style.backgroundColor || '#fde047' }),
    },
  ],
  toDOM: (mark: any) => ['mark', { style: `background:${mark.attrs.color}` }, 0],
  parseMarkdown: {
    match: (node: any) => node.type === HIGHLIGHT_NODE,
    runner: (state: any, node: any, markType: any) => {
      state.openMark(markType, { color: node.color })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: any) => mark.type.name === HIGHLIGHT_NODE,
    runner: (state: any, mark: any) => {
      state.withMark(mark, HIGHLIGHT_NODE, undefined, { color: mark.attrs.color })
    },
  },
}))

/** 文字颜色 mark */
export const textColorMark = $markSchema(TEXTCOLOR_NODE, () => ({
  attrs: { color: { default: '#fca5a5' } },
  parseDOM: [
    {
      tag: 'span[style]',
      getAttrs: (dom: HTMLElement) => (dom.style.color ? { color: dom.style.color } : false),
    },
  ],
  toDOM: (mark: any) => ['span', { style: `color:${mark.attrs.color}` }, 0],
  parseMarkdown: {
    match: (node: any) => node.type === TEXTCOLOR_NODE,
    runner: (state: any, node: any, markType: any) => {
      state.openMark(markType, { color: node.color })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: any) => mark.type.name === TEXTCOLOR_NODE,
    runner: (state: any, mark: any) => {
      state.withMark(mark, TEXTCOLOR_NODE, undefined, { color: mark.attrs.color })
    },
  },
}))

/**
 * 下划线 mark（无属性）。
 * 与其它两个 mark 的区别：它由「无属性的 <u>」解析而来，
 * 因此 parseDOM 只认 u 标签，toDOM 只吐 <u>。
 */
export const underlineMark = $markSchema(UNDERLINE_NODE, () => ({
  parseDOM: [{ tag: 'u' }],
  toDOM: () => ['u', 0],
  parseMarkdown: {
    match: (node: any) => node.type === UNDERLINE_NODE,
    runner: (state: any, _node: any, markType: any) => {
      state.openMark(markType)
      state.next(_node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: any) => mark.type.name === UNDERLINE_NODE,
    runner: (state: any, mark: any) => {
      state.withMark(mark, UNDERLINE_NODE)
    },
  },
}))

/**
 * 上标 mark（无属性）：`<sup>文字</sup>` ↔ esdSuperscript。
 * 与下划线同构（无属性、无 style）。
 */
export const superscriptMark = $markSchema(SUPERSCRIPT_NODE, () => ({
  parseDOM: [{ tag: 'sup' }],
  toDOM: () => ['sup', 0],
  parseMarkdown: {
    match: (node: any) => node.type === SUPERSCRIPT_NODE,
    runner: (state: any, _node: any, markType: any) => {
      state.openMark(markType)
      state.next(_node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: any) => mark.type.name === SUPERSCRIPT_NODE,
    runner: (state: any, mark: any) => {
      state.withMark(mark, SUPERSCRIPT_NODE)
    },
  },
}))

/** 下标 mark（无属性）：`<sub>文字</sub>` ↔ esdSubscript */
export const subscriptMark = $markSchema(SUBSCRIPT_NODE, () => ({
  parseDOM: [{ tag: 'sub' }],
  toDOM: () => ['sub', 0],
  parseMarkdown: {
    match: (node: any) => node.type === SUBSCRIPT_NODE,
    runner: (state: any, _node: any, markType: any) => {
      state.openMark(markType)
      state.next(_node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: any) => mark.type.name === SUBSCRIPT_NODE,
    runner: (state: any, mark: any) => {
      state.withMark(mark, SUBSCRIPT_NODE)
    },
  },
}))
