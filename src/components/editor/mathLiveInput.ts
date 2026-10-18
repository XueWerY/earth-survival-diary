// 行内公式「输入即渲染」：用户在富文本里敲完 \(…\) 后自动转为公式节点。
//
// 实现层：ProseMirror appendTransaction 插件（与 editorSearch 同为 $prose 模式）。
// 节点类型不通过 Milkdown slice 引用（crepe 不导出 mathInlineSchema），
// 而是从 view 的 schema 动态取 state.schema.nodes['math_inline']——
// 该节点由 Crepe Latex feature 注册，本插件仅在它存在时生效。
//
// 触发时机：检查「光标前文本」，光标刚越过新敲的收尾定界符时命中。
// 已验证的真人输入路径：连续快速输入、分步停顿、中文紧邻、修改重敲。
//
// 全角括号兼容：中文输入法下敲 ( 会得到全角（。定界符两侧括号全角/半角均可。
//
// 表达式中间的反斜杠（\leq 等）在 PM 文本里是字面反斜杠字符，直接字符串匹配。

import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'

export const mathLiveInputKey = new PluginKey('mathLiveInput')

/**
 * 匹配光标前待转换的 \(…\) 文本。
 * 收尾定界符支持半角 \) 与全角 \）；开头支持 \( 与 \（。
 * 返回 { start, end, inner }（end 含收尾定界符），未命中返回 null。
 */
function findPendingMath(text: string): { start: number; end: number; inner: string } | null {
  // 光标前必须刚结束于收尾定界符
  const closeHalf = text.endsWith('\\)')
  const closeFull = text.endsWith('\\）')
  if (!closeHalf && !closeFull) return null
  const closeLen = closeHalf ? 2 : 2 // \) 与 \） 都是 2 个字符（\ + 全角括号占 1 码位）
  const end = text.length

  const openHalf = '\\('
  const openFull = '\\（'
  // 从收尾往前找最近的未闭合开头（遇换行放弃：行内公式不跨行）
  for (let i = end - closeLen - 1; i >= 0; i--) {
    if (text[i] === '\n') return null
    const openHit = text.startsWith(openHalf, i) || text.startsWith(openFull, i)
    if (!openHit) continue
    const inner = text.slice(i + 2, end - closeLen)
    // 空表达式或含 $ 的表达式不转换（与文本层互转策略一致）
    if (!inner.trim() || inner.includes('$')) return null
    return { start: i, end, inner }
  }
  return null
}

export const mathLiveInputPlugin = $prose(() =>
  new Plugin({
    key: mathLiveInputKey,
    appendTransaction: (transactions, _oldState, newState) => {
      if (!transactions.some(tr => tr.docChanged)) return null

      const { selection } = newState
      const $from = selection.$from
      if (!$from.parent.isTextblock) return null
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
      const pending = findPendingMath(textBefore)
      if (!pending) return null

      const nodeType = newState.schema.nodes['math_inline']
      if (!nodeType) return null

      const blockStart = $from.start()
      const from = blockStart + pending.start
      const to = blockStart + pending.end

      const tr = newState.tr
      const node = nodeType.create({ value: pending.inner })
      tr.replaceWith(from, to, node)
      // 光标落在公式节点之后
      tr.setSelection((newState.selection.constructor as any).near(tr.doc.resolve(Math.min(from + 1, tr.doc.content.size))))
      tr.scrollIntoView()
      tr.setMeta('mathLiveInput', true)
      return tr
    },
  }),
)
