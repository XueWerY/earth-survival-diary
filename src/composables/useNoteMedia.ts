// 笔记媒体插入：统一处理图片/视频/音频的落库、引用与尺寸。
//
// 关键约定：
//  - 正文里保存的是 `esd-local-media://<hash>` 引用（内容寻址），data URL 只在落库瞬间出现；
//    同一文件重复插入/自动保存重复序列化都复用同一资产，不会产生重复副本。
//  - 媒体以「独占一段」的块级形式插入：图片用 `![alt](src)`，音视频用 HTML 标签，
//    两者都会触发 Markdown 的块级解析，天然自成一行。
//  - 尺寸通过 HTML 属性表达（width/height），不依赖旧版 `{w:N}` 后缀语法；
//    渲染时由编辑器内的媒体样式面板读取并应用。

import { saveMediaAsset, parseDataUrl, isSupportedMediaMimeType, mediaExtensionOf } from '../services/mediaAssets'

export type MediaKind = 'image' | 'video' | 'audio'

export const mediaKindLabels: Record<MediaKind, string> = { image: '图片', video: '视频', audio: '音频' }

export interface MediaSize {
  width?: number
  height?: number
}

/** 生成安全 alt 文本（禁止破坏 Markdown 语法的字符） */
export function sanitizeAltText(name: string): string {
  return String(name || '')
    .replace(/[\[\]]/g, '')
    .replace(/\r?\n/g, ' ')
    .trim()
    .slice(0, 120)
}

/** 由 MIME 推断媒体类别 */
export function mediaKindOf(mimeType: string): MediaKind | null {
  const mime = String(mimeType || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return null
}

/** 把 File 读成 data URL */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('媒体文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 生成插入到笔记正文的媒体片段。
 *
 * 图片：统一用 Markdown 语法 `![alt](src)`，尺寸写成 URL 后缀 `{w=W,h=H}`。
 *       Milkdown/Crepe 的图片块只认这个语法（裸 <img> 会被解析成内联 html
 *       节点而渲染不出图片），尺寸后缀由应用层在进出编辑器时剥离/还原，
 *       并同步到 <img> 的 width/height 属性上。
 * 音视频：用 HTML 标签，天然支持 controls 与尺寸属性。
 * 三者都会被解析为块级节点，从而保证媒体独占一行。
 */
export function buildMediaSnippet(params: {
  kind: MediaKind
  reference: string
  alt?: string
  size?: MediaSize
}): string {
  const { kind, reference, alt = '', size } = params
  const width = size?.width && size.width > 0 ? Math.round(size.width) : null
  const height = size?.height && size.height > 0 ? Math.round(size.height) : null

  if (kind === 'image') {
    const suffix = width || height ? `{w=${width ?? ''},h=${height ?? ''}}` : ''
    return `![${sanitizeAltText(alt)}](${reference}${suffix})`
  }

  const attributes: string[] = ['controls']
  if (kind === 'video') attributes.push('preload="metadata"')
  if (width) attributes.push(`width="${width}"`)
  if (height) attributes.push(`height="${height}"`)
  return `<${kind} ${attributes.join(' ')} src="${reference}"></${kind}>`
}

/**
 * 把媒体 data URL 落库为内容寻址资产，返回正文引用。
 * 重复内容不会新增存储。
 */
export async function storeMediaAsset(dataUrl: string): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !isSupportedMediaMimeType(parsed.mimeType)) return null
  return await saveMediaAsset(dataUrl)
}

/** 供界面提示用的媒体描述（类型 + 规范扩展名） */
export function describeMedia(dataUrl: string): { kind: MediaKind; extension: string } | null {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return null
  const kind = mediaKindOf(parsed.mimeType)
  const extension = mediaExtensionOf(parsed.mimeType)
  if (!kind || !extension) return null
  return { kind, extension }
}

/** 判断字符串是否包含内联媒体（用于粘贴/拖放拦截） */
export function containsInlineMedia(text: string): boolean {
  return /data:(?:image|video|audio)\/[a-z0-9.+-]+;base64,/i.test(text)
    || /<(?:img|video|audio)\b/i.test(text)
}
