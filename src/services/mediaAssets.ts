// 笔记媒体资产：以内容哈希作为存储键，实现相同内容只保存一份。
//
// 设计要点：
//  - 存储键形如 `media:asset:<hash>`，与旧版 `media:asset:<随机ID>` 的区别在于 ID 由内容决定，
//    因此同一文件重复插入 / 自动保存重复序列化都只会得到同一个键，不会产生新文件。
//  - 文件名后缀取自 MIME 的真实扩展名（png/jpg/mp4/mp3 等），不再把 base64 塞进 YAML 字符串后
//    依赖 data: 前缀还原类型；读取时按统一元数据清单中的 MIME 重新拼回 data URL。
//  - 浏览器预览环境没有 Electron IPC，回退到 IndexedDB / localStorage 存 { mimeType, base64 }。

import { readLocalData, writeLocalData, removeLocalData, listLocalDataKeys } from './localDataStore'
import { createMediaSaveJobId, shouldUploadMediaInChunks, subscribeToMediaSaveProgress, uploadPickedMediaFileInChunks } from './mediaFileUpload'

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
const MEDIA_METADATA_KEY = 'media:metadata'

interface MediaAssetMetadata {
  mimeType: string
  fileName?: string
}

interface MediaMetadataIndex {
  version: 1
  assets: Record<string, MediaAssetMetadata>
}

let metadataIndex: MediaMetadataIndex | null = null
let metadataLoadPromise: Promise<MediaMetadataIndex> | null = null
let metadataWriteQueue: Promise<void> = Promise.resolve()

export function resetMediaAssetMetadataCache(): void {
  metadataIndex = null
  metadataLoadPromise = null
}

function normalizeMetadataIndex(value: unknown): MediaMetadataIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { version: 1, assets: {} }
  const raw = value as { assets?: unknown }
  const assets: Record<string, MediaAssetMetadata> = {}
  if (raw.assets && typeof raw.assets === 'object' && !Array.isArray(raw.assets)) {
    for (const [id, entry] of Object.entries(raw.assets as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      const candidate = entry as { mimeType?: unknown; fileName?: unknown }
      const mimeType = String(candidate.mimeType || '').toLowerCase()
      if (!isSupportedMediaMimeType(mimeType)) continue
      const fileName = typeof candidate.fileName === 'string' ? candidate.fileName.slice(0, 240) : ''
      assets[id] = { mimeType, ...(fileName ? { fileName } : {}) }
    }
  }
  return { version: 1, assets }
}

async function loadMetadataIndex(): Promise<MediaMetadataIndex> {
  if (metadataIndex) return metadataIndex
  if (metadataLoadPromise) return metadataLoadPromise
  metadataLoadPromise = (async () => {
    const stored = await readLocalData<unknown>(MEDIA_METADATA_KEY)
    const index = normalizeMetadataIndex(stored.found ? stored.value : undefined)
    const legacyMetaKeys = (await listLocalDataKeys()).filter(key => key.startsWith(KEY_PREFIX) && key.endsWith(':meta'))
    let migrated = false
    for (const legacyKey of legacyMetaKeys) {
      const id = legacyKey.slice(KEY_PREFIX.length, -':meta'.length)
      const legacy = await readLocalData<unknown>(legacyKey)
      const value = legacy.value && typeof legacy.value === 'object' ? legacy.value as { mimeType?: unknown; fileName?: unknown } : {}
      const mimeType = String(value.mimeType || '').toLowerCase()
      if (id && isSupportedMediaMimeType(mimeType) && !index.assets[id]) {
        const fileName = typeof value.fileName === 'string' ? value.fileName.slice(0, 240) : ''
        index.assets[id] = { mimeType, ...(fileName ? { fileName } : {}) }
        migrated = true
      }
    }
    if (!stored.found || migrated) await writeLocalData(MEDIA_METADATA_KEY, index)
    for (const legacyKey of legacyMetaKeys) await removeLocalData(legacyKey)
    metadataIndex = index
    return index
  })().finally(() => { metadataLoadPromise = null })
  return metadataLoadPromise
}

async function updateAssetMetadata(id: string, patch: Partial<MediaAssetMetadata> | null): Promise<void> {
  const operation = metadataWriteQueue.catch(() => {}).then(async () => {
    const electronStore = typeof window !== 'undefined' ? window.electronAPI : undefined
    if (electronStore?.updateLocalMediaAssetMetadata) {
      const updated = await electronStore.updateLocalMediaAssetMetadata(currentMediaScope(), id, patch)
      metadataIndex = normalizeMetadataIndex(updated)
      return
    }
    const index = await loadMetadataIndex()
    const next = { ...index, assets: { ...index.assets } }
    const current = next.assets[id]
    if (patch) {
      const fileName = patch.fileName || current?.fileName || ''
      const mimeType = String(patch.mimeType || current?.mimeType || '').toLowerCase()
      if (!isSupportedMediaMimeType(mimeType)) throw new Error('不支持的本地媒体类型：' + mimeType)
      next.assets[id] = { mimeType, ...(fileName ? { fileName: fileName.slice(0, 240) } : {}) }
    }
    else delete next.assets[id]
    await writeLocalData(MEDIA_METADATA_KEY, next)
    metadataIndex = next
  })
  metadataWriteQueue = operation.then(() => undefined, () => undefined)
  await operation
}

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

function currentMediaScope(): string {
  const token = typeof localStorage === 'undefined' ? null : localStorage.getItem('auth_token')
  if (!token) return 'anonymous'
  try {
    const encoded = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(encoded))
    return typeof payload.sub === 'string' ? payload.sub : 'anonymous'
  } catch {
    return 'anonymous'
  }
}

/** Electron 直接从用户选中的文件写入二进制资产，避免 renderer 生成、散列和传输 Base64。 */
export async function saveMediaFile(
  file: File,
  mimeType: string,
  fileName = file.name,
  onProgress?: (loaded: number, total: number) => void,
): Promise<string | null> {
  const normalizedMime = String(mimeType || '').toLowerCase()
  if (!file || !isSupportedMediaMimeType(normalizedMime) || !file.size) return null
  if (file.size > 512 * 1024 * 1024) throw new Error('媒体文件不能超过 512 MB')
  const electronStore = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (electronStore?.savePickedMediaFile) {
    const scope = currentMediaScope()
    if (shouldUploadMediaInChunks(normalizedMime)) {
      const reference = await uploadPickedMediaFileInChunks(file, {
        mode: 'asset',
        scope,
        mimeType: normalizedMime,
        fileName: fileName.slice(0, 240),
      }, onProgress)
      if (!reference) throw new Error('无法安全读取所选媒体文件，请重新选择文件')
      metadataIndex = null
      return reference
    }

    const jobId = createMediaSaveJobId()
    const unsubscribe = subscribeToMediaSaveProgress(jobId, onProgress)
    let reference: string | null
    try {
      reference = await electronStore.savePickedMediaFile(file, normalizedMime, fileName.slice(0, 240), scope, jobId)
    } finally {
      unsubscribe()
    }
    if (reference) {
      metadataIndex = null
      return reference
    }
    const streamedReference = await uploadPickedMediaFileInChunks(file, {
      mode: 'asset',
      scope,
      mimeType: normalizedMime,
      fileName: fileName.slice(0, 240),
    }, onProgress)
    if (!streamedReference) throw new Error('无法安全读取所选媒体文件，请重新选择文件')
    metadataIndex = null
    return streamedReference
  }

  // 浏览器预览没有 Electron 主进程，沿用 IndexedDB 的 data URL 存储路径。
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('媒体文件读取失败'))
    reader.readAsDataURL(file.slice(0, file.size, normalizedMime))
  })
  return await saveMediaAsset(dataUrl, fileName)
}

/** Electron 下返回可流式读取的本地媒体 URL；浏览器预览回退到 data URL。 */
export async function getMediaAssetUrl(reference: string): Promise<string | null> {
  const key = mediaKeyFromReference(reference)
  if (!key) return null
  const electronStore = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (!electronStore?.getLocalMediaAssetUrl) return null
  return await electronStore.getLocalMediaAssetUrl(currentMediaScope(), key.slice(KEY_PREFIX.length))
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
      // 新格式：纯 base64 串，MIME 由媒体元数据清单提供
      const mimeType = await readMediaAssetMimeType(key)
      if (mimeType) return buildDataUrl(mimeType, stored.value)
    }
  }

  // 过渡格式：{ mimeType, base64 } 对象
  const legacy = normalizeStoredAsset(stored.value)
  if (legacy) return buildDataUrl(legacy.mimeType, legacy.base64)
  return null
}

/** 资产以扩展名后缀存盘；这里反查该资产的 MIME（键本身不含 MIME，需要元数据清单） */
async function readMediaAssetMimeType(key: string): Promise<string | null> {
  const id = key.slice(KEY_PREFIX.length)
  const index = await loadMetadataIndex()
  let mimeType = index.assets[id]?.mimeType || ''
  if (!mimeType) {
    const legacyMeta = await readLocalData<{ mimeType?: string }>(key + ':meta')
    mimeType = legacyMeta.found && typeof legacyMeta.value?.mimeType === 'string'
      ? legacyMeta.value.mimeType.toLowerCase()
      : ''
    if (isSupportedMediaMimeType(mimeType)) {
      const fileName = typeof legacyMeta.value?.fileName === 'string' ? legacyMeta.value.fileName : ''
      await updateAssetMetadata(id, { mimeType, ...(fileName ? { fileName } : {}) })
    }
  }
  return isSupportedMediaMimeType(mimeType) ? mimeType : null
}

/** 读取导入时的原始文件名，供媒体失败卡片与播放器标题使用。 */
export async function readMediaAssetFileName(reference: string): Promise<string> {
  const key = mediaKeyFromReference(reference)
  if (!key) return ''
  const index = await loadMetadataIndex()
  const id = key.slice(KEY_PREFIX.length)
  const metadata = index.assets[id]
  if (metadata?.fileName) return metadata.fileName
  const mimeType = metadata?.mimeType || await readMediaAssetMimeType(key)
  const extension = mimeType ? mediaExtensionOf(mimeType) : null
  return extension ? `${id}.${extension}` : ''
}

/**
 * 保存媒体资产（内容寻址）。
 * 相同内容重复调用不会新增存储：资产已存在时直接复用同一键，跳过写盘。
 * 返回笔记正文中使用的引用。
 */
export async function saveMediaAsset(dataUrl: string, fileName = ''): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !isSupportedMediaMimeType(parsed.mimeType)) return null
  const key = await mediaKeyForDataUrl(dataUrl)
  if (!key) return null
  const existing = await readLocalData<unknown>(key)
  if (!existing.found) {
    await writeLocalData(key, parsed.base64)
  }
  const id = key.slice(KEY_PREFIX.length)
  await updateAssetMetadata(id, {
    mimeType: parsed.mimeType,
    ...(fileName ? { fileName: fileName.slice(0, 240) } : {}),
  })
  return mediaReferenceFor(key)
}

/** 删除媒体资产；返回值表示是否真的删除了文件 */
export async function removeMediaAsset(key: string): Promise<boolean> {
  if (!key.startsWith(KEY_PREFIX)) return false
  await removeLocalData(key)
  await updateAssetMetadata(key.slice(KEY_PREFIX.length), null)
  // 删除升级前留下的逐文件 MIME YAML；通常已在首次读取清单时迁移完成。
  await removeLocalData(key + ':meta')
  return true
}

/** 列出当前用户下的全部媒体资产键（键形如 media:asset:xxx，不含旧版 :meta 记录） */
export async function listMediaAssetKeys(): Promise<string[]> {
  return (await listLocalDataKeys())
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
