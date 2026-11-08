// 笔记媒体插入：统一处理图片/视频/音频的落库、引用与尺寸。
//
// 关键约定：
//  - 正文里保存的是 `esd-local-media://<hash>` 引用（内容寻址），data URL 只在落库瞬间出现；
//    同一文件重复插入/自动保存重复序列化都复用同一资产，不会产生重复副本。
//  - 图片用 `![alt](src)`，音视频用 HTML 标签，解析为块节点后由编辑器排成可换行的媒体行。
//  - 音视频尺寸通过 HTML 属性表达；图片尺寸和比例锁状态以 URL 后缀保存，编辑器横条负责调整。

import { saveMediaAsset, saveMediaFile as saveMediaFileDirect, parseDataUrl, isSupportedMediaMimeType, mediaExtensionOf, mediaMimeTypeOfExtension } from '../services/mediaAssets'
// 音视频片段与自定义节点共用同一属性生成函数，避免渲染和保存时的属性失配。
import { buildMediaTagText } from '../components/editor/mediaMarkdown'

export type MediaKind = 'image' | 'video' | 'audio'
export type MediaLayout = 'flow' | 'standalone'

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

function encodeImageFileName(name: string): string {
  return encodeURIComponent(name.slice(0, 240)).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase())
}

/** 由 MIME 推断媒体类别 */
export function mediaKindOf(mimeType: string): MediaKind | null {
  const mime = String(mimeType || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return null
}

/** Windows 文件选择器可能不提供 MIME；仅在缺失或通用二进制类型时按扩展名补齐。 */
export function mediaMimeTypeOfFile(file: Pick<File, 'name' | 'type'>): string | null {
  const mime = String(file.type || '').split(';')[0].trim().toLowerCase()
  if (isSupportedMediaMimeType(mime)) return mime
  const aliases: Record<string, string> = {
    'image/jpg': 'image/jpeg', 'audio/x-wav': 'audio/wav',
    'audio/x-m4a': 'audio/mp4', 'video/x-m4v': 'video/mp4',
  }
  if (aliases[mime]) return aliases[mime]
  if (mime && mime !== 'application/octet-stream' && mime !== 'binary/octet-stream') return null
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (extension === 'jpeg') return 'image/jpeg'
  if (extension === 'm4v') return 'video/mp4'
  return mediaMimeTypeOfExtension(extension)
}

/** 预览使用 object URL；仅在确认插入时读取并编码文件。 */
export function readFileAsDataUrl(file: File, mimeType = mediaMimeTypeOfFile(file)): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!mimeType) {
      reject(new Error('不支持的媒体格式'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('媒体文件读取失败'))
    reader.onabort = () => reject(new Error('媒体读取已取消'))
    reader.readAsDataURL(file.slice(0, file.size, mimeType))
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
 * 三者都会被解析为块级节点，编辑器可在空间允许时把多个媒体并排显示。
 */
export function buildMediaSnippet(params: {
  kind: MediaKind
  reference: string
  alt?: string
  fileName?: string
  size?: MediaSize
  aspectLocked?: boolean
  layout?: MediaLayout
}): string {
  const { kind, reference, alt = '', fileName = '', size, aspectLocked = false, layout = 'flow' } = params
  const width = size?.width && size.width > 0 ? Math.round(size.width) : null
  const height = size?.height && size.height > 0 ? Math.round(size.height) : null

  if (kind === 'image') {
    const suffixParts = [`w=${width ?? ''}`, `h=${height ?? ''}`]
    if (aspectLocked) suffixParts.push('lock=1')
    if (fileName) suffixParts.push('name=' + encodeImageFileName(fileName))
    if (layout === 'standalone') suffixParts.push('row=single')
    const suffix = width || height || aspectLocked || fileName || layout === 'standalone' ? `{${suffixParts.join(',')}}` : ''
    const caption = sanitizeAltText(alt)
    const altText = caption.replace(/\\/g, '\\\\')
    const title = caption ? ' "' + caption.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : ''
    return '![' + altText + '](' + reference + suffix + title + ')'
  }

  return buildMediaTagText({ kind, src: reference, width, height, name: fileName, aspectLocked, layout })
}

/**
 * 把媒体 data URL 落库为内容寻址资产，返回正文引用。
 * 重复内容不会新增存储。
 */
export async function storeMediaAsset(dataUrl: string, fileName = ''): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !isSupportedMediaMimeType(parsed.mimeType)) return null
  return await saveMediaAsset(dataUrl, fileName)
}

/** 优先让 Electron 主进程直接保存所选文件，避免大型音视频在 renderer 中转成 Base64。 */
export async function storeMediaFile(
  file: File,
  mimeType = mediaMimeTypeOfFile(file),
  onProgress?: (loaded: number, total: number) => void,
): Promise<string | null> {
  if (!mimeType || !isSupportedMediaMimeType(mimeType)) return null
  return await saveMediaFileDirect(file, mimeType, file.name, onProgress)
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
