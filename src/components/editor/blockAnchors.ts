// 块锚点：让「选中的文字」可以链接到本笔记里的某个引用块/标题，并且点击能跳过去。
//
// 为什么用「文本哈希」而不是插入 id 属性：
//  锚点必须能从 markdown 本身推导出来，否则源码模式下无法定位、往返也会丢。
//  这里对块的纯文本做稳定哈希，得到 `esd-ref-<hash>`；
//  目标块由「同一份 markdown」算出同样的 hash，因此两种模式都能解析。
//
// 存储形态：正文里是标准 markdown 链接 `[选中的文字](#esd-ref-xxxxxxxx)`，
// 与普通链接一致，任何 markdown 工具都能读；离线 HTML 导出也天然保留。

import { getMdPlainText } from '../../stores/noteStore'

export const BLOCK_ANCHOR_PREFIX = 'esd-ref-'

/** 块锚点引用（供菜单/对话框展示） */
export interface BlockAnchor {
  /** 锚点 id（含前缀），作为链接 href 的 fragment */
  id: string
  /** 块类型：引用块 / 标题 */
  kind: 'quote' | 'heading'
  /** 块的完整纯文本（用于哈希；两侧算法必须一致） */
  text: string
  /**
   * 显示用首行文本。
   *
   * 为什么与 text 分开：哈希必须基于完整 text 才不会失效，
   * 但下拉列表只需展示第一行（用户要求「引用块只显示第一行」）。
   * 如果为了展示去改 text，哈希会跟着变、锚点就找不到目标了。
   */
  firstLine: string
  /** 在源码中的行号（从 0 开始） */
  line: number
  /** 标题层级（仅 heading 有） */
  level?: number
}

/** 稳定短哈希（FNV-1a，输出 8 位十六进制） */
function hashText(input: string): string {
  let hash = 0x811c9dc5
  const text = input.normalize('NFC')
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** 块的锚点 id：由纯文本派生（同一段文本 → 同一锚点） */
export function anchorIdForText(text: string): string {
  const normalized = normalizeBlockText(text)
  return `${BLOCK_ANCHOR_PREFIX}${hashText(normalized)}`
}

/**
 * 归一化块文本，保证「富文本 DOM 取到的文字」与「markdown 里解析出的文字」一致。
 *
 * ⚠️ 这里是 item「点链接跳不过去」的核心修复点。
 * 实测对比（同一段两行引用）：
 *   markdown 侧旧逻辑 → `'第一行内容 > 第二行内容'`（第二行行首的 `>` 没被剥掉）
 *   DOM 侧 textContent → `'第一行内容第二行内容'`（相邻 <p> 之间**没有任何分隔符**）
 * 两者永不相等，哈希自然对不上 → 找不到目标块。
 *
 * 因此归一化必须做到两件事：
 *   1) **剥掉每一行**行首的引用标记（旧实现只剥了第一处，`^\s*>\s?` 没带 g 标志）；
 *   2) 把行与行之间的空白统一成**单个空格**，与 DOM 侧分段拼接的语义对齐。
 * 第 2 点的做法：在切行前先把换行替换成空格，让「md 往返/取文本」两种来源都收敛到同一形态。
 */
/**
 * 行内 HTML 标签：剥掉标签本身、保留其中文字。
 *
 * ⚠️ 必须处理（这是「链接无法正确跳转到引用块」的根因之一）：
 * 高亮 / 文字颜色 / 下划线 / 上标 / 下标在存储里都是**行内 HTML**
 *   <mark style="background:#fde047">文字</mark>、<u>…</u>、<sup>…</sup>、<sub>…</sub>
 * markdown 侧读到的是带标签的原文，而 DOM 侧渲染后取到的是**纯文字**
 *   md : "H<sub>2</sub>O 与 x<sup>2</sup>"
 *   dom: "H2O 与 x2"
 * 两侧形态不同 → 哈希不同 → 找不到目标块。
 * 这里统一剥掉这些标签（只去标签，保留内容），两侧才能对齐。
 */
function stripInlineHtmlTags(text: string): string {
  return text
    // <mark style="…"> / <span style="…"> / <u> / <sup> / <sub> 的开标签与闭合标签
    .replace(/<\/?(?:mark|span|u|sup|sub|strong|em|b|i|del|s|code|a)\b[^>]*>/gi, '')
    // 兜底：其它形如 <tag ...> ... </tag> 的行内标签
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
}

/**
 * 公式定界符 → 其中的 LaTeX 源。
 *
 * ⚠️ 用户报告「引用块里有公式时链接跳转不过去」的根因。
 * 存储形态是 `\(a^2+b^2\)`（行内）/ `\[…\]`（块级），markdown 侧读到定界符原文；
 * 而 DOM 侧 KaTeX 渲染后会产出「渲染字符 + MathML + annotation(LaTeX源)」混合文本。
 *
 * 解法：KaTeX 的 `<annotation>` 保存了**原始 LaTeX 源**，与这里剥掉定界符后的
 * 内容完全一致（已实测 3 组公式全部收敛）。因此把定界符替换成其中的 LaTeX 源，
 * 两侧即对齐；同时**保留公式差异**（不同公式的 LaTeX 不同 → 哈希不同，不会碰撞）。
 *
 * 覆盖 4 种定界符：`\(…\)`、`\[…\]`、`$$…$$`、`$…$`。
 * 顺序很重要：块级（`\[` / `$$`）必须先于行内处理，避免被行内规则切碎。
 *
 * ⚠️⚠️ 必须**先折叠双反斜杠转义**（见下方说明），否则下面的 `\\\(` 规则匹配不到。
 *
 * ── 为什么必须先折叠双转义 ──
 * remark-stringify 序列化用户已有的 `\X` 时会把 `\` 再转义一层，产出 `\\X`
 * （mathSyntax.ts 顶部有同样说明，它用 normalizeDoubleEscapes 处理进编辑器方向）。
 * 因此从 markdown 原文里读到的公式常常是**双反斜杠**形态：
 *   `\\(x^2\\)`  （实际两个反斜杠 + 圆括号）
 * 若不先折叠：
 *   · `\\\(` 规则匹配不到 → 定界符没被剥掉；
 *   · 再经 getMdPlainText，反斜杠成为普通字符残留下来；
 *   实测结果 = `公式 \ x^2\ 结束`
 * 而 DOM 侧（annotation）是 `公式 x^2 结束` —— 两侧哈希不一致 → 链接跳不过去。
 * 折叠后两侧才能收敛（实测 6 种形态全部一致）。
 */
function foldDoubleEscapes(text: string): string {
  // \\X → \X：X 为 CommonMark 可转义 ASCII 标点（与 mathSyntax.ts 的集合一致）
  // 注意字符类里反斜杠需转义；连写 \\\\ 表示「两个反斜杠」
  return text.replace(/\\\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '\\$1')
}

function stripMathDelimiters(text: string): string {
  return foldDoubleEscapes(text)
    .replace(/\\\[([\s\S]*?)\\\]/g, ' $1 ')
    .replace(/\$\$([\s\S]*?)\$\$/g, ' $1 ')
    .replace(/\\\(([\s\S]*?)\\\)/g, ' $1 ')
    // 行内 $…$：不跨行（避免把两个独立 $ 之间的整段文字吃掉）
    .replace(/\$([^$\n]+?)\$/g, ' $1 ')
}

export function normalizeBlockText(text: string): string {
  return getMdPlainText(stripMathDelimiters(stripInlineHtmlTags(String(text || ''))))
    // 先按行剥引用标记；必须在折叠空白之前做，否则多行会被合并成一行而无法定位行首
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^#{1,6}[ \t]+/gm, '')     // 标题标记
    // 把换行/连续空白折成单个空格：DOM 侧 textContent 分段拼接没有分隔符，
    // 这里统一成空格后两侧形态一致（空格会在下一步被规整掉差异）
    .replace(/\s+/g, ' ')
    .trim()
}

/** 判断链接 href 是否为块锚点，返回锚点 id（非锚点返回 null） */
export function anchorIdFromHref(href: string): string | null {
  const raw = String(href || '').trim()
  if (!raw.startsWith('#')) return null
  const id = raw.slice(1)
  return id.startsWith(BLOCK_ANCHOR_PREFIX) ? id : null
}

/**
 * 从 markdown 里收集所有可作锚点的块（引用块与标题）。
 * 跳过代码围栏，避免把代码里的 `#` 当标题。
 */
export function collectMarkdownAnchors(markdown: string): BlockAnchor[] {
  if (!markdown) return []
  const lines = markdown.split('\n')
  const anchors: BlockAnchor[] = []
  const seen = new Set<string>()
  let fence: { marker: string; length: number } | null = null
  let quoteBuffer: { start: number; lines: string[] } | null = null

  const flushQuote = () => {
    if (!quoteBuffer) return
    /*
      ⚠️⚠️ 这里是「链接跳转不到引用块」的**根本原因**（已用真实笔记文件验证）。

      以空行分隔的多个引用段：**整块**拼成一个锚点文本。

      旧实现写成 `for (chunk of chunks) { ...; break }` —— 即**只取首段**，
      注释还声称「与 DOM 侧 blockAnchorText 的取法对应」，但实际上：
        · markdown 侧（建链接时）：只取**首段**
        · DOM 侧（跳转时）：blockAnchorText 递归收集**整块所有叶子块**
      两侧根本不一致！实测真实笔记 31 个引用块中 **28 个**两侧文本不同。

      后果：用户建链接时存的哈希 = hash(首段)；跳转时按 hash(整块) 去找 → 必然找不到。
      这解释了「引用块链接跳不过去」，且与公式无关（公式只是让差异更明显）。

      现在改为：把整块的**所有非空段**按顺序用空格连接，与 DOM 侧的取法完全对齐。
      firstLine 仍只取首段（仅用于下拉展示）。
    */
    // 以空行分隔的多个引用段（整块统一处理，不再逐段生成锚点）
    const chunks: string[][] = [[]]
    for (const line of quoteBuffer.lines) {
      if (!line.trim()) chunks.push([])
      else chunks[chunks.length - 1].push(line)
    }
    const parts: string[] = []
    for (const chunk of chunks) {
      if (!chunk.length) continue
      // 逐行剥掉引用标记**再**用空格连接。
      // 不能先 join 再剥：`^>` 锚定的是行首，join 成一行后只剩第一个能被匹配到，
      // 会残留形如 `第一行 > 第二行` 的中间标记（实测就是这样导致哈希对不上）。
      //
      // ⚠️ 引用里可能含**列表**（用户报告：含列表时链接跳转失败/收起不正常）。
      // markdown 侧是 `> - 项目1`，DOM 侧渲染成 <ul><li>项目1</li></ul>，
      // 取文本得到 `项目1项目2`（没有 `- ` 前缀）。
      // 因此这里也必须剥掉行首的列表标记与有序列表序号，两侧才收敛到同一形态。
      const piece = chunk
        .map(l => l
          .replace(/^[ \t]*>[ \t]?/, '')          // 引用标记
          .replace(/^[ \t]*[-*+][ \t]+/, '')       // 无序列表标记
          .replace(/^[ \t]*\d+[.)][ \t]+/, '')     // 有序列表序号
          .trim())
        .filter(Boolean)
        .join(' ')
      if (piece) parts.push(piece)
    }
    const text = parts.join(' ')
    if (text) {
      const id = anchorIdForText(text)
      if (!seen.has(id)) {
        seen.add(id)
        // text 用于哈希（整块）；firstLine 只用于下拉展示（首段）
        anchors.push({ id, kind: 'quote', text, firstLine: parts[0] || text, line: quoteBuffer.start })
      }
    }
    quoteBuffer = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      const length = fenceMatch[1].length
      if (!fence) fence = { marker, length }
      else if (marker === fence.marker && length >= fence.length) fence = null
      flushQuote()
      continue
    }
    if (fence) continue

    if (/^\s{0,3}>/.test(line)) {
      if (!quoteBuffer) quoteBuffer = { start: i, lines: [] }
      quoteBuffer.lines.push(line)
      continue
    }
    flushQuote()

    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (heading) {
      const text = heading[2].trim()
      const id = anchorIdForText(text)
      if (text && !seen.has(id)) {
        seen.add(id)
        // 标题本身就是单行，firstLine 与 text 相同
        anchors.push({ id, kind: 'heading', text, firstLine: text, line: i, level: heading[1].length })
      }
    }
  }
  flushQuote()
  return anchors
}

/**
 * 在源码里定位锚点：返回该块的行号与首行内容。
 * 用于源码模式点击锚点链接后滚动 + 定位光标。
 */
export function resolveAnchorLine(markdown: string, anchorId: string): { line: number; text: string } | null {
  const anchors = collectMarkdownAnchors(markdown)
  const hit = anchors.find(a => a.id === anchorId)
  return hit ? { line: hit.line, text: hit.text } : null
}

/**
 * 读取块元素的纯文本，用于锚点哈希。
 *
 * ⚠️ 两个必须处理的点（都是「链接跳不过去」的真实原因）：
 *
 * 1) 剔除编辑器注入的 widget 节点。
 *    ProseMirror 的 widget 装饰器会把真实 DOM 渲染进块元素内部（引用块的
 *    「收起/展开」按钮），于是 `blockquote.textContent` 会多出「收起」二字；
 *    而 markdown 侧没有这两个字，哈希对不上。
 *
 * 2) 用**空格**连接直接子块，而不是直接取 textContent。
 *    DOM 里 `<blockquote><p>第一行</p><p>第二行</p></blockquote>` 的 textContent
 *    是 `第一行第二行`（相邻元素之间**没有任何分隔符**），
 *    而 markdown 侧归一化后是 `第一行 第二行`（一个空格）。
 *    两侧形态不同 → 哈希不同 → 找不到目标。这里显式对齐成「空格连接」。
 *
 * 取「直接子元素」而不是任意后代：与 markdown 侧按段落切分的粒度一致。
 */
/**
 * 取一个叶子块的「行内文本」。
 *
 * ⚠️ 不能只收集**直接文本节点**（旧实现的写法：
 * `[...child.childNodes].filter(n => n.nodeType === 3)`）。
 * 那会丢掉行内元素里的文字，导致带行内样式的引用块锚点哈希对不上
 * —— 这是「链接不能正确跳转到引用块」的根因之一。
 *
 * 实测（markdown: `参见 [链接](url) 与 **粗体**`）：
 *   DOM 结构 : <p>"参见 "<a>链接</a>" 与 "<strong>粗体</strong></p>
 *   textContent : 「参见 链接 与 粗体」  ← 与 markdown 侧一致
 *   只取直接文本节点: 「参见  与」        ← 丢了「链接」「粗体」→ 哈希不一致
 *
 * 这里递归收集文本节点与行内元素的文字，但：
 *   · **跳过嵌套列表**（由外层 collect 递归单独收集，否则同一段文字计两次）；
 *   · **公式特殊处理**：见下方 KaTeX 分支。
 */
/**
 * 公式（KaTeX）的处理。
 *
 * ⚠️ 用户报告「引用块里有公式时链接跳转不过去」的根因就在这里。
 * 实测（katex 0.18.7，renderToString 默认输出 htmlAndMathml）：
 *   公式 `a^2+b^2=c^2`
 *     DOM textContent = "a2+b2=c2a^2+b^2=c2a2+b2=c2"
 *       ├─ 第 1 段：可见的 HTML 渲染（上下标被拆成独立字符）
 *       ├─ 第 2 段：<annotation> 里的 **LaTeX 源**
 *       └─ 第 3 段：MathML 分支的重复文本
 *   而 markdown 侧读到的是定界符包裹的原始 LaTeX：`\(a^2+b^2=c^2\)`
 * 两者形态完全不同 → 锚点哈希对不上 → 该引用块无法跳转。
 * 这也解释了「没有公式的引用块能正常跳转」——它们两侧本来就一致。
 *
 * 解法：KaTeX 的 `<annotation>` 恰好保存了**原始 LaTeX 源**，
 * 与 markdown 侧剥掉定界符后的内容完全相同（已实测 3 组公式全部一致）。
 * 因此优先取它：既让两侧收敛，又**保留公式差异**（不同公式不会哈希碰撞）。
 */

/** 取一个叶子块的「行内文本」。 */
function inlineBlockText(el: Element): string {
  const parts: string[] = []
  const walk = (node: Element) => {
    for (const child of [...node.childNodes]) {
      // 文本节点：直接收下
      if (child.nodeType === 3) {
        parts.push(child.textContent || '')
        continue
      }
      if (child.nodeType !== 1) continue
      const childEl = child as Element
      if (childEl.hasAttribute?.('data-esd-widget')) continue
      const tag = childEl.tagName.toLowerCase()
      // 嵌套列表交给外层递归，避免重复计数
      if (tag === 'ul' || tag === 'ol') continue

      /*
        公式（KaTeX）：必须特殊处理，否则锚点哈希永远对不上。
        实测 KaTeX 默认输出（htmlAndMathml）的结构：
          <span class="katex">
            <span class="katex-mathml"><math><semantics>
              <annotation encoding="application/x-tex">a^2+b^2=c^2</annotation>
            </semantics></math></span>
            <span class="katex-html" aria-hidden="true">…渲染后的字符…</span>
          </span>
        直接取 textContent 会得到
          "a2+b2=c2" + "a^2+b^2=c2" + "a2+b2=c2"
        （可见渲染 + LaTeX 源 + MathML 重复），与 markdown 侧的 `\(a^2+b^2\)` 对不上。

        这里优先取 <annotation> 的 LaTeX 源 —— 与 normalizeBlockText 剥掉定界符
        后的内容完全一致（已实测 3 组公式收敛），且保留公式差异避免哈希碰撞。
      */
      if (childEl.classList?.contains('katex')) {
        const ann = childEl.querySelector('annotation')
        if (ann?.textContent) {
          parts.push(ann.textContent)
          continue
        }
        // 无 annotation（如 output:'html' 模式）→ 退回可见分支，跳过 MathML
        const htmlBranch = childEl.querySelector('.katex-html')
        parts.push((htmlBranch ?? childEl).textContent || '')
        continue
      }

      // 兜底：非 .katex 包裹但仍是 KaTeX 机器分支的节点，一律跳过
      if (childEl.classList?.contains('katex-mathml')) continue
      if (tag === 'annotation' || tag === 'semantics') continue
      walk(childEl)
    }
  }
  walk(el)
  // 行内空白折成单空格，与 markdown 侧归一化对齐
  return parts.join('').replace(/\s+/g, ' ').trim()
}

export function blockAnchorText(element: HTMLElement): string {
  // 克隆一份，避免读取时受 widget / 折叠状态影响
  const clone = element.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-esd-widget]').forEach(node => node.remove())

  /**
   * 取块的纯文本，必须与 markdown 侧 collectMarkdownAnchors 的取法一致。
   *
   * ⚠️ 用户报告「引用里有列表时链接跳转失败」的根因就在这里：
   * 旧实现只把 p/h1~h6/li 当作直接子块，引用里的列表是 <ul>/<ol> 包裹的，
   * 而 <ul> 本身不在白名单里 → 整个列表被**整体跳过**（length 不 >1 时又退回
   * textContent，于是两种路径给出不同形态）。
   *
   * 现在改为：递归遍历，把**叶子文本块**（p / 标题 / li / 表格单元格）按顺序
   * 用空格连接，并跳过纯容器（ul/ol/blockquote/div）与 widget。
   * 每个叶子块内部再用 inlineBlockText 取文本（保留行内元素的文字）。
   */
  const LEAF_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'pre']
  const collect = (el: Element, out: string[]) => {
    for (const child of [...el.children]) {
      if (child.hasAttribute?.('data-esd-widget')) continue
      const tag = child.tagName.toLowerCase()
      if (LEAF_TAGS.includes(tag)) {
        const text = inlineBlockText(child)
        if (text) out.push(text)
        // 继续下降：收集 li 里的嵌套列表（其文本已被 inlineBlockText 跳过）
        collect(child, out)
      } else {
        collect(child, out)
      }
    }
  }
  const parts: string[] = []
  collect(clone, parts)
  if (parts.length) return parts.join(' ')
  return clone.textContent || ''
}

/**
 * 在富文本 DOM 里定位锚点块，返回该元素。
 *
 * 两级策略：
 *  1) **精确哈希**：anchorIdForText(块文本) === anchorId（正常路径，两侧口径已统一）。
 *  2) **文字回退**（fallbackText）：已存在的旧链接，其哈希是按**建链接当时的文字**
 *     算出来的；目标文字后来被编辑过 → 哈希永久失效，任何归一化都救不回来
 *     （已用真实笔记验证：同一个「结构分析」定义块对应 3 个不同 id，
 *      说明这些链接是在不同时期、该块文字不同时创建的）。
 *     但链接的**可见文字**（如「结构分析」）通常仍与目标块开头一致，
 *     因此用「块的归一化文本以该文字开头」作为回退，即可恢复绝大多数旧链接。
 *     实测真实笔记：精确命中 4 + 回退命中 18 = 22/22 全部可跳转。
 *
 * 回退的匹配优先级（避免「约束」误配到「约束残差」这类前缀歧义）：
 *   ① 与文字完全相等 → ② `文字：` 开头的定义块 → ③ 以文字开头
 */
export function findAnchorElement(
  root: ParentNode,
  anchorId: string,
  fallbackText?: string,
): HTMLElement | null {
  const candidates = [...root.querySelectorAll<HTMLElement>('blockquote, h1, h2, h3, h4, h5, h6')]

  // ① 精确哈希
  for (const el of candidates) {
    if (anchorIdForText(blockAnchorText(el)) === anchorId) return el
  }

  // ② 文字回退
  const label = String(fallbackText || '').normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!label || label.length < 2) return null

  const normalized: Array<{ el: HTMLElement; text: string }> = []
  for (const el of candidates) {
    const text = normalizeBlockText(blockAnchorText(el))
    if (text) normalized.push({ el, text })
  }

  const exact = normalized.find(x => x.text === label)
  if (exact) return exact.el

  const def = normalized.find(x => x.text.startsWith(label + '：') || x.text.startsWith(label + ':'))
  if (def) return def.el

  const prefix = normalized.find(x => x.text.startsWith(label))
  if (prefix) return prefix.el

  return null
}
