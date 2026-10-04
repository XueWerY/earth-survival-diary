// 中英混排的内存倒排检索（仅笔记模块使用）。
// - CJK：按单字 + 相邻双字切分建倒排索引，查询为集合求交（个人规模毫秒级）
// - 纯 ASCII 查询：走原文子串匹配（保证前缀/词中片段语义）
// - 含 CJK 查询：token AND 求候选集后，再用原文包含做最终校验，
//   消除「两个 bigram 分别命中但并不连续」的假阳性

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/
const hasCJK = (s: string) => CJK_RE.test(s)

export interface BigramIndex {
  reset: () => void
  setDoc: (id: string, text: string) => void
  removeDoc: (id: string) => void
  search: (query: string) => string[]
}

export function createBigramIndex(): BigramIndex {
  const texts = new Map<string, string>()   // id → 小写原文
  const postings = new Map<string, Set<string>>() // token → 文档 id 集合

  function removeFromPostings(id: string) {
    for (const set of postings.values()) set.delete(id)
  }

  function cjkTokens(text: string): Set<string> {
    const out = new Set<string>()
    const chars = [...text]
    for (let i = 0; i < chars.length; i++) {
      if (!CJK_RE.test(chars[i])) continue
      out.add(chars[i])
      if (i + 1 < chars.length && CJK_RE.test(chars[i + 1])) {
        out.add(chars[i] + chars[i + 1])
      }
    }
    return out
  }

  return {
    reset() {
      texts.clear()
      postings.clear()
    },

    setDoc(id: string, text: string) {
      removeFromPostings(id)
      texts.set(id, text.toLowerCase())
      for (const token of cjkTokens(text)) {
        let set = postings.get(token)
        if (!set) {
          set = new Set()
          postings.set(token, set)
        }
        set.add(id)
      }
    },

    removeDoc(id: string) {
      removeFromPostings(id)
      texts.delete(id)
    },

    search(query: string): string[] {
      const q = query.trim().toLowerCase()
      if (!q) return [...texts.keys()]

      if (!hasCJK(q)) {
        const out: string[] = []
        for (const [id, text] of texts) {
          if (text.includes(q)) out.push(id)
        }
        return out
      }

      let candidates: Set<string> | null = null
      for (const token of cjkTokens(q)) {
        const posting = postings.get(token)
        if (!posting) return []
        if (candidates === null) {
          candidates = new Set(posting)
        } else {
          for (const id of [...candidates]) {
            if (!posting.has(id)) candidates.delete(id)
          }
        }
        if (candidates.size === 0) return []
      }

      // 原文校验：混合查询只按 CJK 部分校验（避免中英间空格/顺序差异造成漏配）
      const cjkQ = [...q].filter(ch => CJK_RE.test(ch)).join('')
      const out: string[] = []
      for (const id of candidates!) {
        if (texts.get(id)!.includes(cjkQ)) out.push(id)
      }
      return out
    },
  }
}
