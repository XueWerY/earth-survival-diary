// 音视频 Markdown 编解码，不依赖编辑器运行时；弹窗、存储与节点共用。

export type EsdMediaKind = 'video' | 'audio'

export interface EsdMediaAttrs {
  kind: EsdMediaKind
  /** 笔记库的内容寻址媒体引用（不含 data URL） */
  src: string
  width: number | null
  height: number | null
  name: string
  aspectLocked: boolean
  layout: 'flow' | 'standalone'
}

/**
 * 标签解析正则（design 2.2.2 E 冻结，保持不变）：
 * `^…$` 锚定整段（已 `trim()` 的）文本；`[^>]*` 覆盖属性区但**不排除换行**——
 * 也就是说属性区与两标签之间的空白理论上可跨行，因此「单行」并非由本正则强制，
 * 而是由生成端 `buildMediaTagText` / `buildMediaSnippet` 保证。
 * 解析仍强制：开闭标签名一致、属性用双引号、`src` 存在且非 `data:`。
 */
const MEDIA_TAG_PATTERN = /^<(video|audio)\b([^>]*)>\s*<\/(video|audio)>\s*$/i

/** 冻结正则：双引号属性提取（布尔属性如裸 `controls` 不在此列，忽略即可） */
const ATTR_PATTERN = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g

function sanitizeMediaName(value: unknown): string {
  return String(value ?? '').replace(/[&"<>\r\n]/g, '_').trim().slice(0, 240)
}

/** 把任意输入归一化为「正整数或 null」（0/负数/非数字都视为「无尺寸」） */
export function toPositiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null
  }
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * 允许原样写入标签的 src 形态（白名单）：
 *  - 内容寻址引用 `esd-local-media://<hash>`。
 */
const SAFE_MEDIA_SRC_PATTERN = /^esd-local-media:\/\/[A-Za-z0-9_-]+$/

/**
 * 把 src 归一化为可安全嵌入「双引号属性」的值：
 *  - 命中白名单 → **原样返回**，保证既有合法引用逐字不变（协议与输出不变）；
 *  - 否则剔除会破坏标签结构的字符（`"` `<` `>` 及换行），只做最小清洗、不拒绝，
 *    避免外部/损坏数据把 `<video …></video>` 的结构撑破。
 */
function sanitizeMediaSrc(src: string): string {
  const value = String(src ?? '')
  if (SAFE_MEDIA_SRC_PATTERN.test(value)) return value
  return value.replace(/["<>\r\n]/g, '')
}

/**
 * 由 attrs 生成冻结顺序的标签文本（与 `useNoteMedia.buildMediaSnippet` 音视频分支逐字等价）。
 * 三处实现（本函数 / `buildMediaSnippet` / `applyMediaResize`）必须共用本函数，避免顺序漂移。
 */
export function buildMediaTagText(attrs: EsdMediaAttrs): string {
  const kind: EsdMediaKind = attrs.kind === 'audio' ? 'audio' : 'video'
  const parts: string[] = ['controls']
  if (kind === 'video') parts.push('preload="metadata"')
  const width = toPositiveInt(attrs.width)
  const height = toPositiveInt(attrs.height)
  if (width) parts.push(`width="${width}"`)
  if (height) parts.push(`height="${height}"`)
  const name = sanitizeMediaName(attrs.name)
  if (name) parts.push(`data-esd-name="${name}"`)
  if (attrs.aspectLocked) parts.push('data-esd-aspect-locked="true"')
  if (attrs.layout === 'standalone') parts.push('data-esd-layout="standalone"')
  return `<${kind} ${parts.join(' ')} src="${sanitizeMediaSrc(attrs.src)}"></${kind}>`
}

/**
 * 解析完整标签为 attrs；任一条件不满足返回 null（调用方据此保留原 html 节点，
 * 保证「解析失败不丢内容」）：
 *  - 不是完整的 `<video|audio …></video|audio>` 结构（整段文本必须被该标签占满）；
 *  - 开闭标签名不一致（自相矛盾）；
 *  - 属性不是双引号形式，或缺少 `src` 属性；
 *  - `src` 为 `data:` 引用（防止 data URL 落盘 / 进入文档）。
 *
 * 关于「单行」：正则属性区（`[^>]*`）不排除换行，故多行属性区理论上也能被识别；
 * 但生成端 `buildMediaTagText` / `buildMediaSnippet` 始终产出单行，实际以单行为准。
 * 已知边界（design R6）：单引号属性等非标准写法不被识别，富文本内不渲染，
 * 但源码模式仍原样可见，不破坏落盘。
 */
export function parseMediaTagText(html: string): EsdMediaAttrs | null {
  const text = String(html ?? '').trim()
  const tagMatch = MEDIA_TAG_PATTERN.exec(text)
  if (!tagMatch) return null

  const openTag = tagMatch[1].toLowerCase()
  const closeTag = tagMatch[3].toLowerCase()
  if (openTag !== closeTag) return null

  const attrText = tagMatch[2] ?? ''
  let src = ''
  let width: number | null = null
  let height: number | null = null
  let fileName = ''
  let aspectLocked = false
  let layout: 'flow' | 'standalone' = 'flow'

  // ATTR_PATTERN 带 g 标志，跨调用共享 lastIndex，必须显式复位
  ATTR_PATTERN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_PATTERN.exec(attrText))) {
    const attrName = m[1].toLowerCase()
    const value = m[2]
    if (attrName === 'src') src = value.trim()
    else if (attrName === 'width') width = toPositiveInt(value)
    else if (attrName === 'height') height = toPositiveInt(value)
    else if (attrName === 'data-esd-name') fileName = value
    else if (attrName === 'data-esd-aspect-locked') aspectLocked = value.toLowerCase() === 'true'
    else if (attrName === 'data-esd-layout') layout = value.toLowerCase() === 'standalone' ? 'standalone' : 'flow'
  }

  if (!src) return null
  // 落盘层永远只接受引用；data: URL 只允许存在于运行期 DOM
  if (/^data:/i.test(src)) return null

  return { kind: openTag === 'audio' ? 'audio' : 'video', src, width, height, name: sanitizeMediaName(fileName), aspectLocked, layout }
}
