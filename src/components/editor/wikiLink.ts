// 自建 wiki-link（[[笔记标题]]）支持——Milkdown 无官方插件，用 kit 原语组装：
// - remark 扩展：markdown 解析时把文本中的 [[目标|别名]] 切成 wikiLink mdast 节点
//   （仅作用于 text 节点，行内代码/代码块/链接等有独立节点类型的语法不受影响）
// - $nodeSchema：原子内联节点，toDOM 渲染为可点击 chip；markdown 双向往返（导出仍是 [[ ]] 语法）
// - $inputRule：手动完整键入 [[标题]] 后的兜底转换
// - 联想弹层不用 PM 插件：MilkdownEditor 包装 view.dispatch，在每次事务后
//   直接从 selection 前缀计算 [[query]] 状态（见 computeWikiSuggestion）
import { $nodeSchema, $inputRule, $remark } from '@milkdown/kit/utils'
import { nodeRule } from '@milkdown/kit/prose'
import type { EditorView } from '@milkdown/kit/prose/view'

export const WIKI_LINK_NODE = 'wikiLink'

/** 单个链接语法：[[目标]] 或 [[目标|别名]]（目标不含 [ ] 换行） */
const WIKI_LINK_PATTERN = /\[\[([^\[\]\n]+?)\]\]/g

export interface WikiLinkRef {
  target: string
  label: string
}

/** 把 [[a|b]] 拆成目标与显示别名 */
export function splitWikiLinkLabel(raw: string): WikiLinkRef {
  const idx = raw.indexOf('|')
  if (idx === -1) {
    const target = raw.trim()
    return { target, label: target }
  }
  const target = raw.slice(0, idx).trim()
  const label = raw.slice(idx + 1).trim() || target
  return { target, label }
}

/** 提取一段 markdown 中的全部 wiki-link（供反链索引用，正则独立实例避免 lastIndex 污染） */
export function extractWikiLinks(content: string): WikiLinkRef[] {
  const re = new RegExp(WIKI_LINK_PATTERN.source, 'g')
  const out: WikiLinkRef[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(content || ''))) {
    const ref = splitWikiLinkLabel(m[1])
    if (ref.target) out.push(ref)
  }
  return out
}

// ===== remark 扩展 =====

function transformWikiLink(tree: any) {
  const walk = (node: any) => {
    if (!node || !Array.isArray(node.children)) return
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      if (child.type === 'text') {
        const value = String(child.value ?? '')
        const re = new RegExp(WIKI_LINK_PATTERN.source, 'g')
        if (!re.test(value)) continue
        re.lastIndex = 0
        const parts: any[] = []
        let last = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(value))) {
          if (m.index > last) parts.push({ type: 'text', value: value.slice(last, m.index) })
          const { target, label } = splitWikiLinkLabel(m[1])
          parts.push({ type: WIKI_LINK_NODE, target, label })
          last = m.index + m[0].length
        }
        if (last < value.length) parts.push({ type: 'text', value: value.slice(last) })
        node.children.splice(i, 1, ...parts)
        i += parts.length - 1
      } else {
        walk(child)
      }
    }
  }
  walk(tree)
}

export const remarkWikiLink = $remark('remarkWikiLink', () => () => transformWikiLink)

// ===== 节点 schema =====

export const wikiLinkSchema = $nodeSchema(WIKI_LINK_NODE, () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: {
    target: { default: '' },
    label: { default: '' },
  },
  parseDOM: [
    {
      tag: `span[data-type="${WIKI_LINK_NODE}"]`,
      getAttrs: (dom) => {
        const el = dom as HTMLElement
        return {
          target: el.dataset.target ?? '',
          label: el.dataset.label ?? '',
        }
      },
    },
  ],
  toDOM: (node) => {
    const target = String(node.attrs.target ?? '')
    const label = String(node.attrs.label ?? '') || target
    const dom = document.createElement('span')
    dom.dataset.type = WIKI_LINK_NODE
    dom.dataset.target = target
    dom.dataset.label = label
    dom.classList.add('wiki-link')
    dom.textContent = label
    return dom
  },
  parseMarkdown: {
    match: (node) => node.type === WIKI_LINK_NODE,
    runner: (state, node, type) => {
      state.addNode(type, {
        target: String((node as any).target ?? ''),
        label: String((node as any).label ?? (node as any).target ?? ''),
      })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === WIKI_LINK_NODE,
    runner: (state, node) => {
      const target = String(node.attrs.target ?? '')
      const label = String(node.attrs.label ?? '')
      const text = label && label !== target ? `[[${target}|${label}]]` : `[[${target}]]`
      // 必须用 html 节点写回：text 节点会被 remark-stringify 转义成 \[[目标]]，
      // 破坏存储语法（反链索引与 Obsidian/Logseq 兼容都依赖原文 [[ ]]）
      state.addNode('html', undefined, text)
    },
  },
}))

// ===== 输入规则：完整键入 [[标题]] 的兜底转换 =====

export const wikiLinkInputRule = $inputRule(
  (ctx) =>
    nodeRule(/\[\[([^\[\]\n]+)\]\]$/, wikiLinkSchema.type(ctx), {
      getAttr: (match) => splitWikiLinkLabel(match[1] ?? ''),
    })
)

// ===== 联想状态计算 =====

export interface WikiSuggestion {
  /** 『[[』的起始位置 */
  from: number
  /** 已键入的过滤词（不含 [[） */
  query: string
}

/** 光标前若处于未闭合的 [[query 状态则返回联想上下文 */
export function computeWikiSuggestion(state: { selection: any; doc: any }): WikiSuggestion | null {
  const { $from } = state.selection
  if (!$from.parent.isTextblock) return null
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\ufffc', '\ufffc')
  const m = /\[\[([^\[\]\n]*)$/.exec(textBefore)
  if (!m) return null
  return { from: $from.pos - m[0].length, query: m[1] }
}

/** 用 wikiLink 节点替换 [from, to) 区间（联想选中 / 输入规则路径共用） */
export function insertWikiLink(view: EditorView, from: number, to: number, target: string, label?: string) {
  const nodeType = view.state.schema.nodes[WIKI_LINK_NODE]
  if (!nodeType) return
  const node = nodeType.create({ target, label: label ?? target })
  view.dispatch(view.state.tr.replaceRangeWith(from, to, node).scrollIntoView())
}
