// 笔记媒体资产：以内容哈希作为存储键，实现相同内容只保存一份。
//
// 设计要点：
//  - 存储键形如 `media:asset:<hash>`，与旧版 `media:asset:<随机ID>` 的区别在于 ID 由内容决定，
//    因此同一文件重复插入 / 自动保存重复序列化都只会得到同一个键，不会产生新文件。
//  - 文件名后缀取自 MIME 的真实扩展名（png/jpg/mp4/mp3 等），不再把 base64 塞进 YAML 字符串后
//    依赖 data: 前缀还原类型；读取时按 MIME 重新拼回 data URL。
//  - 浏览器预览环境没有 Electron IPC，回退到 IndexedDB / localStorage 存 { mimeType, base64 }。

import { readLocalData, writeLocalData, removeLocalData, exportLocalDataRecords } from './localDataStore'

/** 媒体资产的 MIME 白名单：决定可插入的类型与落盘扩展名 */
export const MEDIA_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
}

export const MEDIA_EXTENSION_MIME_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(MEDIA_MIME_EXTENSIONS).map(([mime, extension]) => [extension, mime])
)

/** 统一的媒体引用协议前缀（笔记正文里以此指向资产） */
export const MEDIA_REFERENCE_SCHEME = 'esd-local-media'

const HASH_LENGTH = 32
const KEY_PREFIX = 'media:asset:'

/** data URL 解析结果 */
export interface ParsedDataUrl {
  mimeType: string
  /** 不含 MIME 头的纯 base64 串 */
  base64: string
}

const DATA_URL_PATTERN = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]*)$/i

export function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  if (typeof dataUrl !== 'string') return null
  const match = DATA_URL_PATTERN.exec(dataUrl.trim())
  if (!match) return null
  const base64 = match[2].replace(/\s+/g, '')
  if (!base64) return null
  return { mimeType: match[1].toLowerCase(), base64 }
}

export function buildDataUrl(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`
}

/** 判断 MIME 是否属于受支持的媒体类型 */
export function isSupportedMediaMimeType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(MEDIA_MIME_EXTENSIONS, String(mimeType || '').toLowerCase())
}

/** 取该 MIME 的标准扩展名（不含点） */
export function mediaExtensionOf(mimeType: string): string | null {
  return MEDIA_MIME_EXTENSIONS[String(mimeType || '').toLowerCase()] || null
}

/** 由扩展名反查 MIME；用于兼容旧数据里只写了扩展名的情况 */
export function mediaMimeTypeOfExtension(extension: string): string | null {
  const normalized = String(extension || '').toLowerCase().replace(/^\./, '')
  return MEDIA_EXTENSION_MIME_TYPES[normalized] || null
}

// ============ 内容寻址 ============

/** 计算 base64 内容的小写十六进制哈希（截断到 HASH_LENGTH，避免主键过长） */
async function hashBase64(base64: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const bytes = base64ToBytes(base64)
    const digest = await subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, HASH_LENGTH)
  }
  // 极少数环境（无 Web Crypto）退化为 FNV-1a，仍然满足"同内容同键"的去重要求
  return fnv1aHex(base64)
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0').repeat(HASH_LENGTH / 8)
}

/** 由 data URL 得到内容寻址的资产键 */
async function mediaKeyForDataUrl(dataUrl: string): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !isSupportedMediaMimeType(parsed.mimeType)) return null
  return KEY_PREFIX + await hashBase64(parsed.base64)
}

function mediaReferenceFor(key: string): string {
  return `${MEDIA_REFERENCE_SCHEME}://${key.slice(KEY_PREFIX.length)}`
}

/** 由笔记正文中的引用取出资产键 */
export function mediaKeyFromReference(reference: string): string | null {
  const match = new RegExp(`^${MEDIA_REFERENCE_SCHEME}://([a-z0-9_-]+)$`, 'i').exec(String(reference || '').trim())
  return match ? KEY_PREFIX + match[1] : null
}

// ============ 读写 ============

/** 旧版（随机 ID 键）资产：可能把整个 data URL 当作值存下来 */
interface LegacyAssetValue {
  mimeType?: string
  base64?: string
}

function normalizeStoredAsset(value: unknown): ParsedDataUrl | null {
  if (typeof value !== 'string') {
    if (value && typeof value === 'object') {
      const record = value as LegacyAssetValue
      if (typeof record.base64 === 'string' && typeof record.mimeType === 'string' && isSupportedMediaMimeType(record.mimeType)) {
        return { mimeType: record.mimeType.toLowerCase(), base64: record.base64.replace(/\s+/g, '') }
      }
    }
    return null
  }
  // 新格式：值就是纯 base64，MIME 由文件名后缀决定
  return null
}

/**
 * 读取资产并还原为 data URL；找不到返回 null。
 * 兼容三种历史格式：纯 base64（新）、{ mimeType, base64 } 对象、整个 data URL 字符串（最旧）。
 */
export async function readMediaAsset(key: string): Promise<string | null> {
  if (!key.startsWith(KEY_PREFIX)) return null
  const stored = await readLocalData<unknown>(key)
  if (!stored.found) return null

  // 最旧格式：值就是完整 data URL
  if (typeof stored.value === 'string') {
    const inline = parseDataUrl(stored.value)
    if (inline && isSupportedMediaMimeType(inline.mimeType)) return buildDataUrl(inline.mimeType, inline.base64)
    if (stored.value) {
      // 新格式：纯 base64 串，MIME 由 :meta 旁路记录提供
      const mimeType = await readMediaAssetMimeType(key)
      if (mimeType) return buildDataUrl(mimeType, stored.value)
    }
  }

  // 过渡格式：{ mimeType, base64 } 对象
  const legacy = normalizeStoredAsset(stored.value)
  if (legacy) return buildDataUrl(legacy.mimeType, legacy.base64)
  return null
}

/** 资产以扩展名后缀存盘；这里反查该资产的 MIME（键本身不含 MIME，需要旁路记录） */
async function readMediaAssetMimeType(key: string): Promise<string | null> {
  const meta = await readLocalData<{ mimeType?: string }>(key + ':meta')
  const mimeType = meta.found && meta.value && typeof meta.value.mimeType === 'string' ? meta.value.mimeType.toLowerCase() : ''
  return isSupportedMediaMimeType(mimeType) ? mimeType : null
}

/**
 * 保存媒体资产（内容寻址）。
 * 相同内容重复调用不会新增存储：资产已存在时直接复用同一键，跳过写盘。
 * 返回笔记正文中使用的引用。
 */
export async function saveMediaAsset(dataUrl: string): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !isSupportedMediaMimeType(parsed.mimeType)) return null
  const key = await mediaKeyForDataUrl(dataUrl)
  if (!key) return null
  const existing = await readLocalData<unknown>(key)
  if (!existing.found) {
    await writeLocalData(key, parsed.base64)
    await writeLocalData(key + ':meta', { mimeType: parsed.mimeType })
  }
  return mediaReferenceFor(key)
}

/** 删除媒体资产；返回值表示是否真的删除了文件 */
export async function removeMediaAsset(key: string): Promise<boolean> {
  if (!key.startsWith(KEY_PREFIX)) return false
  await removeLocalData(key)
  await removeLocalData(key + ':meta')
  return true
}

/** 列出当前用户下的全部媒体资产键（键形如 media:asset:xxx，不含 :meta 旁路记录） */
export async function listMediaAssetKeys(): Promise<string[]> {
  const records = await exportLocalDataRecords()
  return records
    .map(record => record.key)
    .filter(key => key.startsWith(KEY_PREFIX) && !key.endsWith(':meta'))
}

/**
 * 清理没有任何笔记引用的媒体资产（旧数据迁移后残留的重复副本）。
 * @param referencedKeys 仍被笔记引用的资产键集合
 * @returns 删除的资产数量
 */
export async function pruneUnreferencedMediaAssets(referencedKeys: Iterable<string>): Promise<number> {
  const referenced = new Set(referencedKeys)
  const keys = await listMediaAssetKeys()
  let removed = 0
  for (const key of keys) {
    if (referenced.has(key)) continue
    await removeMediaAsset(key)
    removed++
  }
  return removed
}
