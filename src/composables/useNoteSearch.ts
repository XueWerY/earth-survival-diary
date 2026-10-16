// 笔记编辑器内搜索的匹配逻辑（纯函数，与 UI 框架无关，便于单独验证）。
//
// 设计要点：
//  - 富文本与源码两种模式共用同一套匹配结果，保证「第 N 处」的语义一致；
//  - 非法正则返回空结果并置 regexError，绝不抛出；
//  - 跳过零宽匹配，避免「下一个」死循环；
//  - 结果数量有上限，超出时置 truncated，由界面提示用户。

export interface SearchMatch {
  /** 起始偏移（含） */
  start: number
  /** 结束偏移（不含） */
  end: number
}

export interface SearchOptions {
  /** 大小写敏感；默认 false（不敏感） */
  caseSensitive?: boolean
  /** 按正则表达式匹配；默认 false */
  regex?: boolean
}

export interface SearchResult {
  matches: SearchMatch[]
  /** 结果是否因超过上限被截断 */
  truncated: boolean
  /** 正则非法等原因导致无法匹配时的错误信息 */
  regexError: string
}

/** 匹配数量上限：超出后截断，避免超长笔记上一次算出几十万处拖垮渲染 */
export const MAX_MATCHES = 2000

/** 正则失效的兜底判断：仅提示，不阻断输入 */
function buildRegExp(query: string, caseSensitive: boolean): RegExp | null {
  try {
    // g 才能用 matchAll 拿全部结果；零宽匹配由下方过滤
    return new RegExp(query, caseSensitive ? 'g' : 'gi')
  } catch (error) {
    return null
  }
}

/**
 * 在 text 中查找 query 的全部匹配位置。
 *
 * @param text    被搜索的文本（富文本为 markdown 全文，源码为 textarea 内容）
 * @param query   查询词；为空时返回空结果
 * @param options 大小写敏感 / 正则
 */
export function findMatches(text: string, query: string, options: SearchOptions = {}): SearchResult {
  const { caseSensitive = false, regex = false } = options
  const empty: SearchResult = { matches: [], truncated: false, regexError: '' }

  const needle = String(query || '')
  if (!needle || !text) return empty

  if (regex) {
    const pattern = buildRegExp(needle, caseSensitive)
    if (!pattern) {
      return { matches: [], truncated: false, regexError: '正则表达式无效' }
    }
    const matches: SearchMatch[] = []
    let truncated = false
    for (const match of text.matchAll(pattern)) {
      // 零宽匹配会让「下一个」永远停在同一位置，直接跳过
      if (!match[0].length) continue
      if (matches.length >= MAX_MATCHES) {
        truncated = true
        break
      }
      matches.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length })
    }
    return { matches, truncated, regexError: '' }
  }

  // 普通文本：大小写不敏感时统一转小写比较，偏移仍在原字符串上成立
  const haystack = caseSensitive ? text : text.toLowerCase()
  const target = caseSensitive ? needle : needle.toLowerCase()
  const matches: SearchMatch[] = []
  let truncated = false
  let cursor = 0
  for (;;) {
    const index = haystack.indexOf(target, cursor)
    if (index < 0) break
    if (matches.length >= MAX_MATCHES) {
      truncated = true
      break
    }
    matches.push({ start: index, end: index + target.length })
    // 从匹配末尾继续，避免重叠匹配导致计数虚高
    cursor = index + target.length
  }
  return { matches, truncated, regexError: '' }
}

/** 循环取下一个匹配下标（-1 表示无匹配） */
export function nextMatchIndex(current: number, total: number, direction: 1 | -1 = 1): number {
  if (total <= 0) return -1
  if (current < 0) return direction === 1 ? 0 : total - 1
  return (current + direction + total) % total
}
