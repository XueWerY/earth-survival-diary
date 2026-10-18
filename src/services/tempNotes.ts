// 临时笔记：直接编辑外部 .md 文件，笔记正文不落在 data 目录。
//
// 设计要点：
//  - 持久化只存「文件路径清单」，落盘位置 data/<用户ID>/notes/tempNotes.yaml
//    （与笔记同目录，按账号天然隔离；笔记列表只读 *.md，所以不会混进笔记里）；
//  - 笔记正文始终以磁盘上的 .md 为准，data 目录里不保存正文副本；
//  - 编辑/自动保存 = 原地写回该 .md 文件；
//  - 插入的图片/音频/视频写到 .md 同级目录的 media/ 下，正文里保存相对引用
//    `media/<name>.<ext>`，这样文件与媒体可以整体搬移、可被其它 Markdown 工具识别；
//  - 渲染时把相对引用按 .md 所在目录解析为 data URL（浏览器无法直接加载 file://）。

import { getData, setData } from './storageService'

/** 清单在数据层的键：类型 notes + 键 tempNotes → data/<用户ID>/notes/tempNotes.yaml */
const PATHS_DATA_TYPE = 'notes'
const PATHS_DATA_KEY = 'tempNotes'
/** 阅读位置：data/<用户ID>/notes/tempReading.yaml */
const READING_DATA_KEY = 'tempReading'
/** 旧版本把清单存在 localStorage，首次加载时迁移过来 */
const LEGACY_STORAGE_BASE_KEY = 'esd.temp-notes.paths.v1'
const MEDIA_DIR_NAME = 'media'

/** 阅读位置：滚动偏移 + 光标所在逻辑行（源码模式） */
export interface TempNoteReading {
  scrollTop: number
  caretLine: number
}

export interface TempNote {
  /** 稳定 id：由文件路径派生（同一路径始终同一 id） */
  id: string
  /** .md 绝对路径 */
  filePath: string
  /** .md 所在目录 */
  dir: string
  /** 媒体目录绝对路径（同级 media/） */
  mediaDir: string
  /** 标题：文件名去掉 .md */
  title: string
  /** 当前正文（来自磁盘） */
  content: string
  /** 文件修改时间（ISO） */
  updatedAt: string
  /**
   * 文件 mtime（毫秒）。自动重读用它判断「外部是否改过」。
   * 必须来自 stat 而非本地时钟：我们自己保存后 mtime 也会变，
   * 若用保存时刻的时间戳比较会误判为外部改动并覆盖用户正在输入的内容。
   */
  mtimeMs: number
}

function normalizePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((p): p is string => typeof p === 'string' && !!p))]
}

/** 读取旧版本存于 localStorage 的清单（仅用于一次性迁移） */
function readLegacyPaths(): string[] {
  try {
    const keys = [LEGACY_STORAGE_BASE_KEY]
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(LEGACY_STORAGE_BASE_KEY + ':')) keys.push(key)
    }
    const merged: string[] = []
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        merged.push(...normalizePaths(JSON.parse(raw)))
      } catch {
        /* 忽略单条损坏记录 */
      }
      localStorage.removeItem(key)
    }
    return [...new Set(merged)]
  } catch {
    return []
  }
}

/** 仅用于跨会话记住「哪些外部文件被加入临时笔记」（存 data/<用户ID>/notes） */
export async function listTempNotePaths(): Promise<string[]> {
  try {
    const stored = await getData<string[]>(PATHS_DATA_TYPE, PATHS_DATA_KEY)
    const fromData = normalizePaths(stored)
    if (fromData.length) return fromData
    // 数据目录里还没有清单：尝试迁移旧版本 localStorage 清单
    const legacy = readLegacyPaths()
    if (legacy.length) {
      await saveTempNotePaths(legacy)
      return legacy
    }
    return []
  } catch {
    return []
  }
}

async function saveTempNotePaths(paths: string[]): Promise<void> {
  await setData(PATHS_DATA_TYPE, PATHS_DATA_KEY, normalizePaths(paths))
}

/** 路径分隔符统一：Windows 反斜杠 */
function lastSeparatorIndex(filePath: string): number {
  return Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))
}

export function dirNameOf(filePath: string): string {
  const index = lastSeparatorIndex(filePath)
  return index <= 0 ? filePath : filePath.slice(0, index)
}

export function baseNameOf(filePath: string, stripExtension = false): string {
  const index = lastSeparatorIndex(filePath)
  const name = index < 0 ? filePath : filePath.slice(index + 1)
  return stripExtension ? name.replace(/\.md$/i, '') : name
}

export function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.endsWith(sep) ? dir + name : dir + sep + name
}

/** 由内容生成稳定短哈希（内容寻址的媒体文件名，避免重名覆盖） */
async function shortHash(text: string): Promise<string> {
  try {
    const encoded = new TextEncoder().encode(text)
    const digest = await crypto.subtle.digest('SHA-256', encoded)
    return [...new Uint8Array(digest)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    let hash = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return hash.toString(16).padStart(8, '0')
  }
}

function api() {
  return (typeof window !== 'undefined' ? window.electronAPI : undefined)
}

/** 把绝对路径转成可读的 id（去掉分隔符，避免 URL 里出现奇怪的字符） */
function idForPath(filePath: string): string {
  return 'tmp:' + filePath
}

function makeNote(filePath: string, content: string, updatedAt: string, mtimeMs: number): TempNote {
  const dir = dirNameOf(filePath)
  return {
    id: idForPath(filePath),
    filePath,
    dir,
    mediaDir: joinPath(dir, MEDIA_DIR_NAME),
    title: baseNameOf(filePath, true) || '未命名',
    content,
    updatedAt,
    mtimeMs,
  }
}

/** 读取单个外部 .md，构造临时笔记；文件不存在返回 null */
export async function readTempNote(filePath: string): Promise<TempNote | null> {
  const bridge = api()
  if (!bridge?.readFile) return null
  const content = await bridge.readFile(filePath)
  if (content === null || content === undefined) return null
  let updatedAt = new Date().toISOString()
  let mtimeMs = 0
  try {
    const stat = await bridge.statFile?.(filePath)
    if (stat?.exists && stat.mtimeMs > 0) {
      mtimeMs = stat.mtimeMs
      updatedAt = new Date(stat.mtimeMs).toISOString()
    }
  } catch {
    /* 忽略 stat 失败 */
  }
  return makeNote(filePath, content, updatedAt, mtimeMs)
}

/**
 * 只查文件 mtime（用于自动重读的轮询，避免每次都读全文）。
 * 文件不可访问返回 null。
 */
export async function statTempNoteMtime(filePath: string): Promise<number | null> {
  const bridge = api()
  if (!bridge?.statFile) return null
  try {
    const stat = await bridge.statFile(filePath)
    return stat?.exists && stat.mtimeMs > 0 ? stat.mtimeMs : null
  } catch {
    return null
  }
}

/** 载入全部临时笔记：按清单逐个读盘，跳过已删除的文件并清理清单 */
export async function loadTempNotes(): Promise<TempNote[]> {
  const paths = await listTempNotePaths()
  if (!paths.length) return []
  const loaded = await Promise.all(paths.map(p => readTempNote(p)))
  const notes = loaded.filter((n): n is TempNote => !!n)
  // 清理已不存在/不可读的路径
  if (notes.length !== paths.length) await saveTempNotePaths(notes.map(n => n.filePath))
  return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** 把某个外部 .md 加入临时笔记（去重），返回最新笔记对象 */
export async function addTempNote(filePath: string): Promise<TempNote | null> {
  const note = await readTempNote(filePath)
  if (!note) return null
  const paths = await listTempNotePaths()
  if (!paths.includes(filePath)) await saveTempNotePaths([...paths, filePath])
  return note
}

/** 从临时笔记列表移除（不删除磁盘文件） */
export async function removeTempNotePath(filePath: string): Promise<string[]> {
  const next = (await listTempNotePaths()).filter(p => p !== filePath)
  await saveTempNotePaths(next)
  // 同步清掉该文件的阅读位置，避免清单里留下无主记录
  await dropTempNoteReading(filePath)
  return next
}

// ====== 阅读位置（存 data/<用户ID>/notes/tempReading.yaml） ======
// 用「数组 + 显式 filePath 字段」而不是以路径为键的对象：
// Windows 路径含冒号与反斜杠，作为 YAML 键需要引号转义，数组形态更稳。

type ReadingMap = Record<string, TempNoteReading>

function readingsToMap(list: unknown): ReadingMap {
  const map: ReadingMap = {}
  if (!Array.isArray(list)) return map
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const record = item as { filePath?: unknown; scrollTop?: unknown; caretLine?: unknown }
    if (typeof record.filePath !== 'string' || !record.filePath) continue
    map[record.filePath] = {
      scrollTop: Number.isFinite(Number(record.scrollTop)) ? Number(record.scrollTop) : 0,
      caretLine: Number.isFinite(Number(record.caretLine)) ? Number(record.caretLine) : 0,
    }
  }
  return map
}

async function readAllReadings(): Promise<ReadingMap> {
  try {
    return readingsToMap(await getData<unknown[]>(PATHS_DATA_TYPE, READING_DATA_KEY))
  } catch {
    return {}
  }
}

/** 序列化：数组形态写盘（见上方说明） */
async function writeAllReadings(map: ReadingMap): Promise<void> {
  await setData(
    PATHS_DATA_TYPE,
    READING_DATA_KEY,
    Object.entries(map).map(([path, value]) => ({ filePath: path, ...value })),
  )
}

/** 取某文件的阅读位置（无记录返回 null） */
export async function loadTempNoteReading(filePath: string): Promise<TempNoteReading | null> {
  const map = await readAllReadings()
  return map[filePath] ?? null
}

/** 记录某文件的阅读位置（原地更新，保留其它文件） */
export async function saveTempNoteReading(filePath: string, reading: TempNoteReading): Promise<void> {
  const map = await readAllReadings()
  map[filePath] = {
    scrollTop: Math.max(0, Math.round(reading.scrollTop) || 0),
    caretLine: Math.max(0, Math.round(reading.caretLine) || 0),
  }
  await writeAllReadings(map)
}

/** 删除某文件的阅读位置 */
export async function dropTempNoteReading(filePath: string): Promise<void> {
  const map = await readAllReadings()
  if (!(filePath in map)) return
  delete map[filePath]
  await writeAllReadings(map)
}

/**
 * 原地保存正文到 .md 文件。
 * 成功后立刻回读 mtime 写回 note，作为「我们自己刚写过」的基准——
 * 否则自动重读的轮询会把这次保存误判成外部改动。
 */
export async function saveTempNoteContent(note: TempNote, content: string): Promise<boolean> {
  const bridge = api()
  if (!bridge?.writeFile) return false
  const ok = await bridge.writeFile(note.filePath, content)
  if (ok === true) {
    const mtime = await statTempNoteMtime(note.filePath)
    if (mtime !== null) note.mtimeMs = mtime
  }
  return ok === true
}

/**
 * 把 data URL 形式的媒体写入 .md 同级 media/ 目录。
 * 文件名用内容哈希 + 正确扩展名（内容相同只落一份），返回正文里使用的相对引用。
 */
export async function saveTempNoteMedia(note: TempNote, dataUrl: string): Promise<string | null> {
  const bridge = api()
  if (!bridge?.writeBinaryFile || !bridge.ensureDirectory) return null
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || '')
  if (!match) return null
  const mimeType = (match[1] || '').toLowerCase()
  const isBase64 = !!match[2]
  const payload = match[3] || ''

  const extension = mediaExtensionFor(mimeType)
  if (!extension) return null

  const created = await bridge.ensureDirectory(note.mediaDir)
  if (!created) return null

  const hash = await shortHash(payload)
  const fileName = `${hash}.${extension}`
  const absolutePath = joinPath(note.mediaDir, fileName)
  const base64 = isBase64 ? payload : btoa(unescape(encodeURIComponent(payload)))
  const ok = await bridge.writeBinaryFile(absolutePath, base64)
  if (!ok) return null
  return `${MEDIA_DIR_NAME}/${fileName}`
}

/** 把正文里的相对媒体引用解析成 data URL 供编辑器渲染 */
export async function readTempNoteMedia(note: TempNote, reference: string): Promise<string | null> {
  const bridge = api()
  if (!bridge?.readBinaryFile) return null
  const clean = String(reference || '').trim()
  if (!clean || /^[a-z]+:\/\//i.test(clean) || clean.startsWith('data:')) return null
  // 只接受 media/ 下的相对路径，避免把任意路径塞进正文变成任意文件读取
  const relative = clean.replace(/^\.\//, '')
  if (!relative.startsWith(`${MEDIA_DIR_NAME}/`)) return null
  const absolutePath = joinPath(note.dir, relative.replace(/\//g, '\\'))
  const base64 = await bridge.readBinaryFile(absolutePath)
  if (!base64) return null
  const mimeType = mimeForExtension(relative.split('.').pop() || '')
  if (!mimeType) return null
  return `data:${mimeType};base64,${base64}`
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
}

const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSION_BY_MIME).map(([mime, ext]) => [ext, mime])
)

function mediaExtensionFor(mimeType: string): string | null {
  return EXTENSION_BY_MIME[mimeType] || null
}

function mimeForExtension(extension: string): string | null {
  return MIME_BY_EXTENSION[extension.toLowerCase()] || null
}
