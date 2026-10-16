// 编辑器内搜索高亮：用 ProseMirror 装饰器把匹配区间标出来。
//
// 为什么用装饰器而不是改文档：
//  - 装饰器只影响渲染，不写入 doc，因此不会触发 markdownUpdated → 自动保存，
//    正文里绝不会残留任何搜索痕迹；
//  - 也不需要改 $nodeSchema / remark（那会与 preset-commonmark 打架）。
//
// 查询词存在插件 state 里，通过 transaction meta 更新；
// MilkdownEditor 把「markdown 区间」换算成「PM 区间」后交给 decorations 渲染。
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

export const editorSearchPluginKey = new PluginKey<EditorSearchState>('editorSearch')

/** 高亮 class：由 MilkdownEditor 注入全局样式表（scoped 样式无法进入 PM 渲染层） */
export const SEARCH_HIT_CLASS = 'editor-search-hit'
export const SEARCH_HIT_CURRENT_CLASS = 'editor-search-hit-current'

export interface EditorSearchState {
  query: string
  /** 当前匹配在 matches 中的下标；-1 表示无匹配 */
  activeIndex: number
}

const initialState: EditorSearchState = { query: '', activeIndex: -1 }

/**
 * 用 markdown 匹配区间构造装饰器集合。
 * ranges 已由调用方换算成 PM 位置；空 ranges 返回 null（不挂装饰）。
 */
export function buildSearchDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  ranges: Array<{ from: number; to: number; active: boolean }>,
): DecorationSet | null {
  if (!ranges.length) return null
  const decorations = ranges.map(({ from, to, active }) =>
    Decoration.inline(from, to, {
      class: active ? `${SEARCH_HIT_CLASS} ${SEARCH_HIT_CURRENT_CLASS}` : SEARCH_HIT_CLASS,
    }),
  )
  return DecorationSet.create(doc, decorations)
}

export const editorSearchPlugin = $prose(() =>
  new Plugin({
    key: editorSearchPluginKey,
    state: {
      init: () => initialState,
      apply: (tr, prev) => {
        const next = tr.getMeta(editorSearchPluginKey) as EditorSearchState | undefined
        return next ? { query: next.query, activeIndex: next.activeIndex } : prev
      },
    },
    props: {
      // 装饰器通过 view.props 动态下发：MilkdownEditor 包装 view.dispatch 后
      // 在下一次事务前把最新 ranges 写进 view.props.decorations，
      // 因此这里只提供静态入口，实际集合见 MilkdownEditor 的 decorations 覆盖。
      decorations: () => null,
    },
  }),
)
