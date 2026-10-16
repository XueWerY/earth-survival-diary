const { app, BrowserWindow, Menu, ipcMain, shell, dialog, Tray, screen, clipboard, net, session } = require('electron')
const path = require('path')
const fs = require('fs')
// 打包后的主进程依赖由 extraResources 放在 resources/node_modules。
const YAML = require(app.isPackaged
  ? path.join(process.resourcesPath, 'node_modules', 'yaml')
  : 'yaml')

// Electron 配置保存在应用目录根目录；仅用户数据写入 data 子目录。
const appDataDirectory = path.join(app.getPath('appData'), 'earth-survival-diary')
const localDataDirectory = path.join(appDataDirectory, 'data')
app.setPath('userData', appDataDirectory)
fs.mkdirSync(localDataDirectory, { recursive: true })
let localDataWriteQueue = Promise.resolve()

const https = require('https')
// esbuild 二进制打包后位于 app.asar 内（asar 不可执行），主进程 spawn 会 ENOENT。
// extraResources 已把真实二进制复制到 resources/node_modules/@esbuild/win32-x64/esbuild.exe，
// 这里在 require('esbuild') 之前用 ESBUILD_BINARY_PATH 指向它（esbuild 模块加载时读取该变量）。
const esbuildBinaryPath = path.join(process.resourcesPath, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe')
if (fs.existsSync(esbuildBinaryPath)) {
  process.env.ESBUILD_BINARY_PATH = esbuildBinaryPath
}
const { spawn, execSync } = require('child_process')
const crypto = require('crypto')

const APP_SCROLLBAR_CSS = `
  [data-app-scrollbar-host] { scrollbar-width: none !important; -ms-overflow-style: none !important; }
  [data-app-scrollbar-host]::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  .app-scrollbar-track { position: fixed; z-index: 10; width: 6px; border-radius: 999px; background: rgba(255,255,255,.055); cursor: pointer; touch-action: none; user-select: none; transition: background-color 140ms ease; }
  .app-scrollbar-track:hover { background: rgba(255,255,255,.1); }
  .app-scrollbar-thumb { position: absolute; top: 0; left: 0; display: block; width: 100%; box-sizing: border-box; border: 1px solid rgba(220,220,255,.12); border-radius: 999px; background: linear-gradient(180deg,rgba(203,213,255,.5),rgba(167,139,250,.56)); box-shadow: 0 1px 5px rgba(10,8,28,.28); cursor: grab; touch-action: none; transition: background 140ms ease,box-shadow 140ms ease; }
  .app-scrollbar-thumb:hover,.app-scrollbar-thumb.is-dragging { border-color: rgba(219,234,254,.28); background: linear-gradient(180deg,rgba(147,197,253,.92),rgba(167,139,250,.96)); box-shadow: 0 0 9px rgba(147,197,253,.32); }
  .app-scrollbar-thumb.is-dragging { cursor: grabbing; }
  .app-scrollbar-thumb:focus-visible { outline: 2px solid rgba(147,197,253,.9); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .app-scrollbar-track,.app-scrollbar-thumb { transition: none; } }
`

const APP_SCROLLBAR_INSTALLER = `
function installAppScrollbar(host) {
  if (!host || host.hasAttribute('data-app-scrollbar-host')) return
  host.setAttribute('data-app-scrollbar-host', '')
  if (!host.id) host.id = 'app-scrollbar-host'
  var track = document.createElement('div')
  track.className = 'app-scrollbar-track'
  track.setAttribute('aria-hidden', 'true')
  var thumb = document.createElement('div')
  thumb.className = 'app-scrollbar-thumb'
  thumb.setAttribute('role', 'scrollbar')
  thumb.setAttribute('aria-orientation', 'vertical')
  thumb.setAttribute('aria-label', '垂直滚动条')
  thumb.setAttribute('aria-valuemin', '0')
  thumb.setAttribute('aria-controls', host.id)
  thumb.tabIndex = -1
  track.appendChild(thumb)
  document.body.appendChild(track)

  var geometry = { top: 0, length: 0, thumbLength: 0, thumbTravel: 0, maxScroll: 0 }
  var drag = null
  function update() {
    var rect = host.getBoundingClientRect()
    var visible = host.clientHeight > 0 && host.scrollHeight > host.clientHeight + 1
    var top = Math.max(0, rect.top + 2)
    var bottom = Math.min(window.innerHeight, rect.bottom - 2)
    var length = Math.max(0, bottom - top)
    visible = visible && length > 0
    track.style.display = visible ? 'block' : 'none'
    track.style.left = String(rect.right - 8) + 'px'
    track.style.top = String(top) + 'px'
    track.style.width = '6px'
    track.style.height = String(length) + 'px'
    track.setAttribute('aria-hidden', visible ? 'false' : 'true')
    thumb.tabIndex = visible ? 0 : -1
    if (!visible) return
    var maxScroll = Math.max(0, host.scrollHeight - host.clientHeight)
    var thumbLength = Math.min(length, Math.max(28, length * host.clientHeight / host.scrollHeight))
    var thumbTravel = Math.max(0, length - thumbLength)
    var scrollTop = Math.min(maxScroll, Math.max(0, host.scrollTop))
    var offset = maxScroll ? thumbTravel * scrollTop / maxScroll : 0
    thumb.style.height = String(thumbLength) + 'px'
    thumb.style.transform = 'translate3d(0,' + String(offset) + 'px,0)'
    thumb.setAttribute('aria-valuemax', String(Math.round(maxScroll)))
    thumb.setAttribute('aria-valuenow', String(Math.round(scrollTop)))
    thumb.setAttribute('aria-valuetext', String(Math.round(scrollTop / maxScroll * 100)) + '%')
    geometry = { top: top, length: length, thumbLength: thumbLength, thumbTravel: thumbTravel, maxScroll: maxScroll }
  }
  function move(event) {
    if (!drag) return
    host.scrollTop = drag.scrollTop + (event.clientY - drag.startY) * geometry.maxScroll / Math.max(1, geometry.thumbTravel)
    update()
  }
  function endDrag() {
    if (!drag) return
    drag = null
    thumb.classList.remove('is-dragging')
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', endDrag)
    document.removeEventListener('pointercancel', endDrag)
  }
  thumb.addEventListener('pointerdown', function(event) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    drag = { startY: event.clientY, scrollTop: host.scrollTop }
    thumb.classList.add('is-dragging')
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', endDrag)
    document.addEventListener('pointercancel', endDrag)
  })
  track.addEventListener('pointerdown', function(event) {
    if (event.button !== 0 || event.target === thumb) return
    event.preventDefault()
    event.stopPropagation()
    var ratio = (event.clientY - geometry.top - geometry.thumbLength / 2) / Math.max(1, geometry.thumbTravel)
    host.scrollTop = Math.min(1, Math.max(0, ratio)) * geometry.maxScroll
    update()
  })
  thumb.addEventListener('keydown', function(event) {
    var next = null
    if (event.key === 'ArrowDown') next = host.scrollTop + 40
    else if (event.key === 'ArrowUp') next = host.scrollTop - 40
    else if (event.key === 'PageDown') next = host.scrollTop + host.clientHeight * .9
    else if (event.key === 'PageUp') next = host.scrollTop - host.clientHeight * .9
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = geometry.maxScroll
    if (next === null) return
    event.preventDefault()
    host.scrollTop = Math.min(geometry.maxScroll, Math.max(0, next))
    update()
  })
  host.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update, { passive: true })
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(update).observe(host)
  new MutationObserver(update).observe(host, { childList: true, subtree: true, characterData: true })
  update()
}
`

// 桌面端独立 Pino 日志
// 委托给 logger.cjs 的兼容函数：动态检查 state.logger（未初始化时降级 console），
// 避免 "_logger 捕获一次后永久为 null" 导致主进程日志静默丢失。
const loggerMod = require('./lib/logger.cjs')
const { findLatestLogFile } = loggerMod
function initLogger() {
  loggerMod.initLogger(path.join(app.getPath('userData'), 'logs'))
}
function debugLog(msg, meta) { loggerMod.debugLog(msg, meta) }
function errorLog(msg, meta) { loggerMod.errorLog(msg, meta) }

function validateLocalDataKey(key) {
  if (typeof key !== 'string' || !key.length || key.length > 512 || /[\u0000-\u001f]/.test(key)) {
    throw new Error('本地数据键无效')
  }
  return key
}

function encodeLocalDataSegment(segment) {
  if (typeof segment !== 'string') throw new Error('本地数据路径无效')
  if (/^[A-Za-z0-9_-]+$/.test(segment)) return segment
  return '~' + Buffer.from(segment, 'utf8').toString('base64url')
}

function decodeLocalDataSegment(segment) {
  if (!segment.startsWith('~')) return segment
  try {
    return Buffer.from(segment.slice(1), 'base64url').toString('utf8')
  } catch (error) {
    throw new Error('本地数据文件名无效：' + error.message)
  }
}

const LOCAL_DATA_MODULES = new Set([
  'countdown', 'course', 'focus', 'footprint', 'list', 'notes', 'profile', 'settings', 'system'
])

const LOCAL_DATA_KEY_ALIASES = new Map([
  ['tasks', ['footprint', 'footprint']],
  ['diaries', ['footprint', 'diary']],
  ['lists', ['list', 'lists']],
  ['listTasks', ['list', 'tasks']],
  ['profile', ['profile', 'profile']],
  ['settings', ['settings', 'settings']],
  ['app-settings', ['settings', 'settings']],
  ['profile:avatar', ['profile', 'profile']]
])

function getUserLocalDataPathSegments(dataKey) {
  const normalizedKey = dataKey.startsWith('api-data:')
    ? dataKey.slice('api-data:'.length)
    : dataKey
  if (normalizedKey.replace(/\\/g, '/').replace(/\//g, ':') === 'notes:categories') {
    throw new Error('笔记分类数据已停用')
  }
  const alias = LOCAL_DATA_KEY_ALIASES.get(normalizedKey)
  if (alias) return alias

  if (normalizedKey.startsWith('media:asset:')) {
    const rest = normalizedKey.slice('media:asset:'.length)
    const metaSuffix = ':meta'
    const isMeta = rest.endsWith(metaSuffix)
    const assetId = isMeta ? rest.slice(0, -metaSuffix.length) : rest
    if (!assetId || /[:/]/.test(assetId)) throw new Error('本地媒体数据键无效')
    return ['notes', 'media', isMeta ? assetId + metaSuffix : assetId]
  }

  const segments = normalizedKey.split(/[:/]/)
  if (segments.some(segment => !segment.length)) throw new Error('本地数据键无效')
  if (LOCAL_DATA_MODULES.has(segments[0])) return segments
  return ['system', ...segments]
}

function getUserDataKey(key) {
  const separator = key.indexOf(':')
  if (separator <= 0) return ''
  const dataKey = key.slice(separator + 1)
  const normalizedKey = dataKey.startsWith('api-data:')
    ? dataKey.slice('api-data:'.length)
    : dataKey
  return normalizedKey.replace(/[\\/]/g, ':')
}

function getUserScopeFromKey(key) {
  const separator = key.indexOf(':')
  return separator > 0 ? key.slice(0, separator) : ''
}

function isNotesCollectionKey(key) {
  const dataKey = getUserDataKey(key)
  return dataKey === 'notes' || dataKey === 'notes:notes'
}

// 媒体资产键：<scope>:media:asset:<id> 或 <scope>:media:asset:<id>:meta
// id 为内容哈希（小写十六进制）或旧版随机 ID；:meta 旁路记录保存 MIME 类型。
function getMediaAssetInfo(key) {
  if (getUserScopeFromKey(key) === 'global') return null
  const dataKey = getUserDataKey(key)
  const prefix = 'media:asset:'
  if (!dataKey.startsWith(prefix)) return null
  const rest = dataKey.slice(prefix.length)
  if (!rest.length) return null
  const metaSuffix = ':meta'
  const isMeta = rest.endsWith(metaSuffix)
  const assetId = isMeta ? rest.slice(0, -metaSuffix.length) : rest
  if (!assetId || /[:/]/.test(assetId)) throw new Error('本地媒体数据键无效')
  return { assetId, isMeta }
}

function getUserMediaDirectory(scope) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope)) throw new Error('本地用户 ID 无效')
  return path.join(localDataDirectory, encodeLocalDataSegment(scope), 'notes', 'media')
}

function getMediaAssetFilePath(scope, assetId, extension) {
  const directory = getUserMediaDirectory(scope)
  return path.join(directory, encodeLocalDataSegment(assetId) + '.' + extension)
}

/** 依据文件内容探测 MIME（仅支持资产白名单内的类型） */
function detectMediaMimeType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6) === 'GIF87a') return 'image/gif'
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return buffer.toString('ascii', 12, 16) === 'VP8X' ? 'image/webp' : buffer.toString('ascii', 12, 16) === 'VP8L' ? 'image/webp' : 'image/webp'
  }
  // ISO-BMFF 系列：mp4 / m4a 由 brand 区分
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12)
    if (brand === 'qt  ') return 'video/quicktime'
    if (brand.startsWith('M4A') || brand.startsWith('M4B')) return 'audio/mp4'
    return 'video/mp4'
  }
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'video/x-matroska'
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') return 'audio/ogg'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav'
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') return 'audio/mpeg'
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'moov') return 'video/quicktime'
  return ''
}

const MEDIA_MIME_EXTENSIONS = {
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

const MEDIA_MAX_BYTES = 512 * 1024 * 1024

function decodeMediaBase64(value) {
  if (typeof value !== 'string' || !value.length) throw new Error('本地媒体数据无效')
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value.trim())
  const base64 = match ? match[2] : value
  const cleaned = base64.replace(/\s+/g, '')
  if (!cleaned.length) throw new Error('本地媒体数据无效')
  const buffer = Buffer.from(cleaned, 'base64')
  if (!buffer.length || buffer.length > MEDIA_MAX_BYTES) throw new Error('本地媒体文件大小无效')
  const mimeType = match ? match[1].toLowerCase() : ''
  if (mimeType && !MEDIA_MIME_EXTENSIONS[mimeType]) throw new Error('不支持的本地媒体类型：' + mimeType)
  return { buffer, declaredMimeType: mimeType }
}

function writeMediaAssetFile(scope, assetId, buffer, declaredMimeType) {
  const mimeType = declaredMimeType || detectMediaMimeType(buffer)
  if (!mimeType || !MEDIA_MIME_EXTENSIONS[mimeType]) throw new Error('无法识别的本地媒体格式')
  const extension = MEDIA_MIME_EXTENSIONS[mimeType]
  const directory = getUserMediaDirectory(scope)
  fs.mkdirSync(directory, { recursive: true })
  const filePath = getMediaAssetFilePath(scope, assetId, extension)
  const temporaryFile = filePath + '.tmp-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2)
  try {
    fs.writeFileSync(temporaryFile, buffer)
    fs.renameSync(temporaryFile, filePath)
  } catch (error) {
    try { fs.unlinkSync(temporaryFile) } catch {}
    throw error
  }
  // 同一资产更换格式（如旧数据迁移）时清理其它扩展名的残留
  for (const staleExtension of Object.values(MEDIA_MIME_EXTENSIONS)) {
    if (staleExtension === extension) continue
    try { fs.unlinkSync(getMediaAssetFilePath(scope, assetId, staleExtension)) } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
  }
  return { mimeType, extension, filePath }
}

function readMediaAssetFile(scope, assetId) {
  const directory = getUserMediaDirectory(scope)
  let entries = []
  try {
    entries = fs.readdirSync(directory)
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
  const prefix = encodeLocalDataSegment(assetId) + '.'
  const candidates = entries
    .filter(name => name.startsWith(prefix) && !name.includes('.tmp-'))
    .map(name => ({ name, extension: path.extname(name).slice(1).toLowerCase() }))
    .filter(item => Object.values(MEDIA_MIME_EXTENSIONS).includes(item.extension))
  if (!candidates.length) return null
  const target = candidates[0]
  const filePath = path.join(directory, target.name)
  try {
    const buffer = fs.readFileSync(filePath)
    const mimeType = Object.keys(MEDIA_MIME_EXTENSIONS).find(mime => MEDIA_MIME_EXTENSIONS[mime] === target.extension) || detectMediaMimeType(buffer)
    if (!mimeType) return null
    return { mimeType, base64: buffer.toString('base64') }
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw new Error('无法读取本地媒体文件：' + error.message)
  }
}

function removeMediaAssetFiles(scope, assetId) {
  const directory = getUserMediaDirectory(scope)
  let entries = []
  try {
    entries = fs.readdirSync(directory)
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error
    return
  }
  const prefix = encodeLocalDataSegment(assetId) + '.'
  for (const name of entries) {
    if (!name.startsWith(prefix)) continue
    try { fs.unlinkSync(path.join(directory, name)) } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
  }
}

function getNoteRecordId(key) {
  if (getUserScopeFromKey(key) === 'global') return null
  const dataKey = getUserDataKey(key)
  const prefix = 'notes:note:'
  return dataKey.startsWith(prefix) && dataKey.length > prefix.length
    ? dataKey.slice(prefix.length)
    : null
}

function getUserNotesDirectory(scope) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope)) throw new Error('本地用户 ID 无效')
  return path.join(localDataDirectory, encodeLocalDataSegment(scope), 'notes')
}

function getNoteFilePath(scope, noteId) {
  if (typeof noteId !== 'string' || !noteId.length || noteId.length > 512) {
    throw new Error('本地笔记编号无效')
  }
  return path.join(getUserNotesDirectory(scope), encodeLocalDataSegment(noteId) + '.md')
}

function readMarkdownNote(filePath) {
  const markdown = fs.readFileSync(filePath, 'utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)
  if (!match) {
    const timestamp = fs.statSync(filePath).mtime.toISOString()
    const id = decodeLocalDataSegment(path.basename(filePath, '.md'))
    return { id, title: path.basename(filePath, '.md'), content: markdown, tagIds: [], pinned: false, trashedAt: null, createdAt: timestamp, updatedAt: timestamp }
  }
  const metadata = YAML.parse(match[1])
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('笔记 Markdown 元数据无效')
  }
  const id = decodeLocalDataSegment(path.basename(filePath, '.md'))
  return { ...metadata, id: String(metadata.id || id), content: markdown.slice(match[0].length) }
}

function writeMarkdownNote(filePath, note, storageOrder) {
  if (!note || typeof note !== 'object' || Array.isArray(note)) throw new Error('本地笔记内容无效')
  const metadata = { ...note }
  const content = typeof metadata.content === 'string' ? metadata.content : ''
  delete metadata.content
  if (metadata._storageOrder == null && Number.isFinite(storageOrder)) metadata._storageOrder = storageOrder
  const markdown = '---\n' + YAML.stringify(metadata, { lineWidth: 0 }) + '---\n' + content
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryFile = filePath + '.tmp-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2)
  try {
    fs.writeFileSync(temporaryFile, markdown, 'utf8')
    fs.renameSync(temporaryFile, filePath)
  } catch (error) {
    try { fs.unlinkSync(temporaryFile) } catch {}
    throw error
  }
}

function readMarkdownNotes(scope) {
  const directory = getUserNotesDirectory(scope)
  if (!fs.existsSync(directory)) return []
  const noteFiles = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => path.join(directory, entry.name))
  const notes = noteFiles.map(filePath => readMarkdownNote(filePath))
  notes.sort((left, right) => {
    const leftOrder = Number(left._storageOrder)
    const rightOrder = Number(right._storageOrder)
    if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder)) return leftOrder - rightOrder
    if (Number.isFinite(leftOrder)) return -1
    if (Number.isFinite(rightOrder)) return 1
    return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))
  })
  return notes
}

function writeMarkdownNotes(scope, notes) {
  if (!Array.isArray(notes)) throw new Error('本地笔记列表无效')
  const directory = getUserNotesDirectory(scope)
  fs.mkdirSync(directory, { recursive: true })
  const retainedFiles = new Set()
  notes.forEach((note, index) => {
    if (!note || typeof note.id !== 'string' || !note.id.length) throw new Error('本地笔记编号无效')
    const filePath = getNoteFilePath(scope, note.id)
    retainedFiles.add(path.basename(filePath))
    writeMarkdownNote(filePath, note, index)
  })
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && !retainedFiles.has(entry.name)) {
      fs.unlinkSync(path.join(directory, entry.name))
    }
  }
}

function getLocalDataFilePath(key) {
  const normalizedKey = validateLocalDataKey(key)
  const separator = normalizedKey.indexOf(':')
  if (separator <= 0) throw new Error('本地数据键缺少用户范围')

  const scope = normalizedKey.slice(0, separator)
  const dataKey = normalizedKey.slice(separator + 1)
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope) && scope !== 'global') {
    throw new Error('本地用户 ID 无效')
  }

  let directorySegments
  let fileSegments
  if (scope === 'global') {
    directorySegments = ['users']
    fileSegments = dataKey.split(':')
  } else {
    const userDataSegments = getUserLocalDataPathSegments(dataKey)
    directorySegments = [scope, ...userDataSegments.slice(0, -1)]
    fileSegments = [userDataSegments[userDataSegments.length - 1]]
  }

  if (!fileSegments.length || fileSegments.some(segment => !segment.length)) {
    throw new Error('本地数据键无效')
  }
  if (scope === 'global' && fileSegments.length !== 1) throw new Error('账号数据键必须是用户 ID')
  const encodedDirectorySegments = directorySegments.map(encodeLocalDataSegment)
  const encodedFileSegments = fileSegments.map(encodeLocalDataSegment)
  const fileName = encodedFileSegments.pop() + '.yaml'
  return path.join(localDataDirectory, ...encodedDirectorySegments, ...encodedFileSegments, fileName)
}

function isProfileAvatarKey(key) {
  const separator = key.indexOf(':')
  return separator > 0 && key.slice(separator + 1) === 'profile:avatar'
}

function getProfileDataKey(key) {
  const separator = key.indexOf(':')
  return key.slice(0, separator) + ':profile:profile'
}

function getProfileAvatarDirectoryPath(key) {
  const scope = getUserScopeFromKey(key)
  if (!scope || scope === 'global' || !/^[A-Za-z0-9_-]{1,128}$/.test(scope)) {
    throw new Error('本地头像用户 ID 无效')
  }
  return path.join(localDataDirectory, encodeLocalDataSegment(scope), 'profile', 'avatar')
}

function getProfileAvatarFilePath(key, fileName) {
  if (typeof fileName !== 'string' || !/^avatar\.(?:png|jpe?g|webp)$/i.test(fileName)) {
    throw new Error('本地头像文件名无效')
  }
  return path.join(getProfileAvatarDirectoryPath(key), fileName)
}

function getLegacyProfileAvatarFilePath(key, fileName) {
  const scope = getUserScopeFromKey(key)
  if (!scope || scope === 'global' || typeof fileName !== 'string') return ''
  const profileDirectory = path.join(localDataDirectory, encodeLocalDataSegment(scope), 'profile')
  if (/^avatar\/avatar\.(?:png|jpe?g|webp)$/i.test(fileName)) {
    return path.join(profileDirectory, 'avatar', path.basename(fileName))
  }
  if (/^[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(fileName)) {
    return path.join(profileDirectory, fileName)
  }
  return ''
}

function detectProfileAvatarMimeType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return ''
}

function decodeProfileAvatarDataUrl(value) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) throw new Error('头像格式无效')
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) throw new Error('头像文件大小无效')
  if (detectProfileAvatarMimeType(buffer) !== match[1]) throw new Error('头像文件内容与格式不匹配')
  return { mimeType: match[1], buffer }
}

function normalizeLocalDataValue(value) {
  if (value === undefined) throw new Error('本地 YAML 数据无法序列化')
  const serialized = YAML.stringify(value, { lineWidth: 0 })
  if (serialized === undefined) throw new Error('本地 YAML 数据无法序列化')
  return YAML.parse(serialized)
}

function readLocalDataRecord(key) {
  const scope = getUserScopeFromKey(key)
  const mediaAsset = getMediaAssetInfo(key)
  if (mediaAsset) {
    // :meta 旁路记录保存 MIME；资产本身以 base64 字符串返回，扩展名由文件后缀决定
    if (mediaAsset.isMeta) {
      const asset = readMediaAssetFile(scope, mediaAsset.assetId)
      if (!asset) return { found: false }
      return { found: true, value: { mimeType: asset.mimeType } }
    }
    const asset = readMediaAssetFile(scope, mediaAsset.assetId)
    if (!asset) return { found: false }
    return { found: true, value: asset.base64 }
  }
  if (scope !== 'global' && isNotesCollectionKey(key)) return { found: true, value: readMarkdownNotes(scope) }
  const noteId = getNoteRecordId(key)
  if (noteId !== null) {
    try {
      return { found: true, value: readMarkdownNote(getNoteFilePath(scope, noteId)) }
    } catch (error) {
      if (error && error.code === 'ENOENT') return { found: false }
      throw new Error('无法读取本地 Markdown 笔记：' + error.message)
    }
  }
  if (isProfileAvatarKey(key)) {
    const profile = readLocalDataRecord(getProfileDataKey(key))
    const profileValue = profile.found && profile.value && typeof profile.value === 'object' && !Array.isArray(profile.value)
      ? profile.value
      : {}
    const avatarDirectory = getProfileAvatarDirectoryPath(key)
    const candidates = []
    const savedAvatarPath = getLegacyProfileAvatarFilePath(key, profileValue.avatarFile)
    if (savedAvatarPath) candidates.push(savedAvatarPath)
    for (const fileName of ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp']) {
      candidates.push(getProfileAvatarFilePath(key, fileName))
    }
    candidates.push(path.join(path.dirname(avatarDirectory), 'avatar'))
    const legacyAvatarPath = getLegacyProfileAvatarFilePath(key, profileValue.avatarFile)
    if (legacyAvatarPath) candidates.push(legacyAvatarPath)

    for (const avatarPath of [...new Set(candidates)]) {
      try {
        const buffer = fs.readFileSync(avatarPath)
        const mimeType = detectProfileAvatarMimeType(buffer)
        if (mimeType) return { found: true, value: `data:${mimeType};base64,${buffer.toString('base64')}` }
      } catch (error) {
        if (error && !['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) {
          throw new Error('无法读取本地头像：' + error.message)
        }
      }
    }
    const legacyAvatar = profileValue.avatarDataUrl
    return { found: typeof legacyAvatar === 'string' && legacyAvatar.length > 0, value: legacyAvatar }
  }
  const filePath = getLocalDataFilePath(key)
  try {
    const value = YAML.parse(fs.readFileSync(filePath, 'utf8'))
    return { found: true, value }
  } catch (error) {
    if (error && error.code === 'ENOENT') return { found: false }
    throw new Error('无法读取本地 YAML 数据：' + error.message)
  }
}

function writeLocalDataRecord(key, value) {
  const scope = getUserScopeFromKey(key)
  const mediaAsset = getMediaAssetInfo(key)
  if (mediaAsset) {
    if (mediaAsset.isMeta) {
      // MIME 旁路记录：以小体积 YAML 保存，便于读取时还原 data URL
      const mimeType = value && typeof value === 'object' && typeof value.mimeType === 'string' ? value.mimeType.toLowerCase() : ''
      if (!MEDIA_MIME_EXTENSIONS[mimeType]) throw new Error('不支持的本地媒体类型：' + mimeType)
      const filePath = getLocalDataFilePath(key)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      const temporaryFile = filePath + '.tmp-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2)
      try {
        fs.writeFileSync(temporaryFile, YAML.stringify({ mimeType }, { lineWidth: 0 }), 'utf8')
        fs.renameSync(temporaryFile, filePath)
      } catch (error) {
        try { fs.unlinkSync(temporaryFile) } catch {}
        throw error
      }
      return true
    }
    const decoded = decodeMediaBase64(value)
    writeMediaAssetFile(scope, mediaAsset.assetId, decoded.buffer, decoded.declaredMimeType)
    return true
  }
  if (scope !== 'global' && isNotesCollectionKey(key)) {
    writeMarkdownNotes(scope, value)
    return true
  }
  const noteId = getNoteRecordId(key)
  if (noteId !== null) {
    writeMarkdownNote(getNoteFilePath(scope, noteId), value)
    return true
  }
  if (isProfileAvatarKey(key)) {
    const avatar = decodeProfileAvatarDataUrl(value)
    const extension = avatar.mimeType === 'image/jpeg' ? 'jpg' : avatar.mimeType.slice('image/'.length)
    const fileName = `avatar.${extension}`
    const avatarDirectory = getProfileAvatarDirectoryPath(key)
    const previousAvatarFile = path.join(path.dirname(avatarDirectory), 'avatar')
    try {
      if (fs.statSync(previousAvatarFile).isFile()) fs.unlinkSync(previousAvatarFile)
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
    fs.mkdirSync(avatarDirectory, { recursive: true })
    const filePath = getProfileAvatarFilePath(key, fileName)
    const temporaryFile = filePath + '.tmp-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2)
    try {
      fs.writeFileSync(temporaryFile, avatar.buffer)
      fs.renameSync(temporaryFile, filePath)
    } catch (error) {
      try { fs.unlinkSync(temporaryFile) } catch {}
      throw error
    }
    const profileKey = getProfileDataKey(key)
    const current = readLocalDataRecord(profileKey)
    const profile = current.found && current.value && typeof current.value === 'object' && !Array.isArray(current.value)
      ? current.value
      : {}
    for (const oldName of ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp']) {
      if (oldName === fileName) continue
      try { fs.unlinkSync(getProfileAvatarFilePath(key, oldName)) } catch (error) {
        if (!error || error.code !== 'ENOENT') throw error
      }
    }
    const legacyPath = path.join(path.dirname(avatarDirectory), 'avatar')
    try {
      if (fs.statSync(legacyPath).isFile()) fs.unlinkSync(legacyPath)
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
    const nextProfile = { ...profile, avatarFile: `avatar/${fileName}`, avatarUpdatedAt: new Date().toISOString() }
    delete nextProfile.avatarDataUrl
    return writeLocalDataRecord(profileKey, nextProfile)
  }
  const filePath = getLocalDataFilePath(key)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryFile = filePath + '.tmp-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2)
  try {
    fs.writeFileSync(temporaryFile, YAML.stringify(value, { lineWidth: 0 }), 'utf8')
    fs.renameSync(temporaryFile, filePath)
  } catch (error) {
    try { fs.unlinkSync(temporaryFile) } catch {}
    throw error
  }
  return true
}

function removeLocalDataRecord(key) {
  const scope = getUserScopeFromKey(key)
  const mediaAsset = getMediaAssetInfo(key)
  if (mediaAsset) {
    if (!mediaAsset.isMeta) removeMediaAssetFiles(scope, mediaAsset.assetId)
    const filePath = getLocalDataFilePath(key)
    try { fs.unlinkSync(filePath) } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
    return
  }
  if (scope !== 'global' && isNotesCollectionKey(key)) {
    const directory = getUserNotesDirectory(scope)
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) fs.unlinkSync(path.join(directory, entry.name))
    }
    return
  }
  const noteId = getNoteRecordId(key)
  if (noteId !== null) {
    try { fs.unlinkSync(getNoteFilePath(scope, noteId)) } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
    return
  }
  if (isProfileAvatarKey(key)) {
    const profileKey = getProfileDataKey(key)
    const current = readLocalDataRecord(profileKey)
    const profile = current.found && current.value && typeof current.value === 'object' && !Array.isArray(current.value)
      ? current.value
      : {}
    const avatarDirectory = getProfileAvatarDirectoryPath(key)
    for (const fileName of ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp']) {
      try { fs.unlinkSync(getProfileAvatarFilePath(key, fileName)) } catch (error) {
        if (!error || !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
      }
    }
    const oldAvatarPath = path.join(path.dirname(avatarDirectory), 'avatar')
    try {
      const oldAvatarStat = fs.statSync(oldAvatarPath)
      if (oldAvatarStat.isFile()) fs.unlinkSync(oldAvatarPath)
      else if (oldAvatarStat.isDirectory() && fs.readdirSync(oldAvatarPath).length === 0) fs.rmdirSync(oldAvatarPath)
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
    const legacyPath = getLegacyProfileAvatarFilePath(key, profile.avatarFile)
    if (legacyPath && legacyPath !== oldAvatarPath) {
      try { fs.unlinkSync(legacyPath) } catch (error) {
        if (!error || error.code !== 'ENOENT') throw error
      }
    }
    if (current.found && current.value && typeof current.value === 'object' && !Array.isArray(current.value)) {
      const nextProfile = { ...current.value }
      delete nextProfile.avatarDataUrl
      delete nextProfile.avatarFile
      delete nextProfile.avatarUpdatedAt
      if (Object.keys(nextProfile).length) writeLocalDataRecord(profileKey, nextProfile)
      else removeLocalDataRecord(profileKey)
    }
    return
  }
  const filePath = getLocalDataFilePath(key)
  try {
    fs.unlinkSync(filePath)
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error
  }

  if (getUserDataKey(key) === 'profile:profile') {
    fs.rmSync(getProfileAvatarDirectoryPath(key), { recursive: true, force: true })
    const legacyAvatarPath = path.join(path.dirname(getProfileAvatarDirectoryPath(key)), 'avatar')
    try {
      if (fs.statSync(legacyAvatarPath).isFile()) fs.unlinkSync(legacyAvatarPath)
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
  }

  let directory = path.dirname(filePath)
  while (directory !== localDataDirectory && directory.startsWith(localDataDirectory + path.sep)) {
    try {
      fs.rmdirSync(directory)
    } catch {
      break
    }
    directory = path.dirname(directory)
  }
}

function enqueueLocalDataWrite(operation) {
  const queuedOperation = localDataWriteQueue.catch(() => {}).then(operation)
  localDataWriteQueue = queuedOperation.then(() => undefined, () => undefined)
  return queuedOperation
}

function keyFromLocalDataFile(scope, filePath) {
  const relativePath = path.relative(path.join(localDataDirectory, scope === 'global' ? 'users' : encodeLocalDataSegment(scope)), filePath)
  const fileSegments = relativePath.split(path.sep)
  const lastSegment = fileSegments.pop()
  if (!lastSegment) return null
  const extension = path.extname(lastSegment).toLowerCase()
  if (scope !== 'global' && extension === '.md' && fileSegments.length === 1 && decodeLocalDataSegment(fileSegments[0]) === 'notes') {
    const noteId = decodeLocalDataSegment(lastSegment.slice(0, -extension.length))
    return scope + ':notes:note:' + noteId
  }
  if (extension !== '.yaml') return null
  fileSegments.push(lastSegment.slice(0, -extension.length))
  const decodedSegments = fileSegments.map(decodeLocalDataSegment)
  if (scope === 'global') return 'global:' + decodedSegments.join(':')
  if (!LOCAL_DATA_MODULES.has(decodedSegments[0])) return null
  if (decodedSegments[0] === 'notes' && decodedSegments[1] === 'categories') return null
  if (decodedSegments[0] === 'notes' && decodedSegments[1] === 'media' && decodedSegments.length >= 3) {
    const rest = decodedSegments.slice(2).join(':')
    const metaSuffix = ':meta'
    const isMeta = rest.endsWith(metaSuffix)
    const assetId = isMeta ? rest.slice(0, -metaSuffix.length) : rest
    if (!assetId) return null
    return scope + ':media:asset:' + assetId + (isMeta ? metaSuffix : '')
  }
  return scope + ':' + decodedSegments.join(':')
}

function listLocalDataFiles(directory, files = []) {
  if (!fs.existsSync(directory)) return files
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) listLocalDataFiles(entryPath, files)
    else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.md'))) files.push(entryPath)
  }
  return files
}

/** 媒体目录下的资产文件（二进制，按扩展名归组） */
const MEDIA_EXTENSIONS = new Set(Object.values(MEDIA_MIME_EXTENSIONS))

function listMediaAssetFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && MEDIA_EXTENSIONS.has(path.extname(entry.name).slice(1).toLowerCase()) && !entry.name.includes('.tmp-'))
    .map(entry => path.join(directory, entry.name))
}

// ============ 旧媒体数据迁移 ============
// 旧版把整个 data URL 序列化进 notes/media/<随机ID>.yaml，同一文件每插入一次就多一份。
// 迁移：读取旧 YAML → 按内容哈希重命名为二进制文件 → 删除旧 YAML → 重写笔记中的引用。
const MEDIA_MIGRATION_FLAG = 'media-asset-migration-v1'

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32)
}

function rewriteMediaReferences(content, idMap) {
  if (typeof content !== 'string' || !content.includes('esd-local-media://')) return content
  return content.replace(/esd-local-media:\/\/([A-Za-z0-9_-]+)/g, (match, oldId) => {
    const nextId = idMap[oldId]
    return nextId ? 'esd-local-media://' + nextId : match
  })
}

function migrateLegacyMediaAssets(scope) {
  const mediaDirectory = getUserMediaDirectory(scope)
  if (!fs.existsSync(mediaDirectory)) return
  const legacyFiles = fs.readdirSync(mediaDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.yaml'))
    .map(entry => path.join(mediaDirectory, entry.name))
  if (!legacyFiles.length) return

  const idMap = {}
  let migrated = 0
  for (const filePath of legacyFiles) {
    const fileName = path.basename(filePath, '.yaml')
    let legacyId = fileName
    try { legacyId = decodeLocalDataSegment(fileName) } catch { /* 保留原始文件名作为 ID */ }
    let value
    try {
      value = YAML.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (error) {
      debugLog('[媒体迁移] 跳过无法解析的旧媒体文件：' + fileName)
      continue
    }
    if (typeof value !== 'string' || !value.length) continue
    let buffer = null
    let mimeType = ''
    const dataUrlMatch = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value.trim())
    if (dataUrlMatch) {
      buffer = Buffer.from(dataUrlMatch[2].replace(/\s+/g, ''), 'base64')
      mimeType = dataUrlMatch[1].toLowerCase()
    } else if (/^[A-Za-z0-9+/=\s]+$/.test(value.trim())) {
      buffer = Buffer.from(value.trim().replace(/\s+/g, ''), 'base64')
      mimeType = detectMediaMimeType(buffer)
    }
    if (!buffer || !buffer.length) continue
    if (!MEDIA_MIME_EXTENSIONS[mimeType]) mimeType = detectMediaMimeType(buffer)
    if (!MEDIA_MIME_EXTENSIONS[mimeType]) {
      debugLog('[媒体迁移] 跳过无法识别格式的旧媒体文件：' + fileName)
      continue
    }
    const newId = sha256Hex(buffer)
    try {
      writeMediaAssetFile(scope, newId, buffer, mimeType)
      fs.unlinkSync(filePath)
      idMap[legacyId] = newId
      migrated++
    } catch (error) {
      errorLog('[媒体迁移] 转换旧媒体失败：' + fileName + ' - ' + error.message)
    }
  }

  // 重写笔记引用，并清理不再被引用的孤儿资产
  if (Object.keys(idMap).length) {
    try {
      const notes = readMarkdownNotes(scope)
      notes.forEach((note, index) => {
        const nextContent = rewriteMediaReferences(note.content, idMap)
        if (nextContent !== note.content) {
          notes[index] = { ...note, content: nextContent }
          debugLog('[媒体迁移] 已重写笔记引用：' + note.id)
        }
      })
      writeMarkdownNotes(scope, notes)
    } catch (error) {
      errorLog('[媒体迁移] 重写笔记引用失败：' + error.message)
    }
  }

  // 内容寻址后可能留下未被引用的重复文件，按引用集合清理
  try {
    pruneUnreferencedMediaAssets(scope)
  } catch (error) {
    errorLog('[媒体迁移] 清理未引用媒体失败：' + error.message)
  }

  debugLog('[媒体迁移] 完成', { scope, migrated })
}

/** 删除没有任何笔记引用的媒体资产文件 */
function pruneUnreferencedMediaAssets(scope) {  const mediaDirectory = getUserMediaDirectory(scope)
  if (!fs.existsSync(mediaDirectory)) return { removed: 0 }
  const referenced = new Set()
  const noteFiles = fs.readdirSync(getUserNotesDirectory(scope), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => path.join(getUserNotesDirectory(scope), entry.name))
  for (const filePath of noteFiles) {
    const note = readMarkdownNote(filePath)
    const content = typeof note.content === 'string' ? note.content : ''
    for (const match of content.matchAll(/esd-local-media:\/\/([A-Za-z0-9_-]+)/g)) referenced.add(match[1])
  }
  let removed = 0
  for (const filePath of listMediaAssetFiles(mediaDirectory)) {
    const fileName = path.basename(filePath)
    const dotIndex = fileName.lastIndexOf('.')
    const assetId = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
    if (referenced.has(assetId)) continue
    try { fs.unlinkSync(filePath); removed++ } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
  }
  return { removed }
}

ipcMain.handle('local-data-read', async (_event, key) => {
  await localDataWriteQueue
  const normalizedKey = validateLocalDataKey(key)
  return readLocalDataRecord(normalizedKey)
})

ipcMain.handle('local-data-write', async (_event, key, value) => {
  const normalizedKey = validateLocalDataKey(key)
  const normalizedValue = normalizeLocalDataValue(value)
  await enqueueLocalDataWrite(() => writeLocalDataRecord(normalizedKey, normalizedValue))
  return true
})

ipcMain.handle('local-data-remove', async (_event, key) => {
  const normalizedKey = validateLocalDataKey(key)
  await enqueueLocalDataWrite(() => removeLocalDataRecord(normalizedKey))
  return true
})

ipcMain.handle('local-data-list', async (_event, prefix) => {
  if (typeof prefix !== 'string' || prefix.length > 512 || !prefix.endsWith(':')) throw new Error('本地数据前缀无效')
  const scope = prefix.slice(0, -1)
  if (scope !== 'global' && !/^[A-Za-z0-9_-]{1,128}$/.test(scope)) throw new Error('本地数据前缀无效')
  await localDataWriteQueue
  const directory = path.join(localDataDirectory, scope === 'global' ? 'users' : encodeLocalDataSegment(scope))
  const records = []
  const mediaPrefix = 'media:asset:'
  for (const filePath of listLocalDataFiles(directory)) {
    const key = keyFromLocalDataFile(scope, filePath)
    if (!key || !key.startsWith(prefix)) continue
    try {
      const value = path.extname(filePath).toLowerCase() === '.md'
        ? readMarkdownNote(filePath)
        : YAML.parse(fs.readFileSync(filePath, 'utf8'))
      records.push({ key, value })
    } catch (error) {
      throw new Error('无法读取本地 YAML 数据：' + error.message)
    }
  }
  // 媒体资产是二进制文件，单独枚举并按 base64 字符串返回（与 readLocalDataRecord 一致）
  if (scope !== 'global' && prefix.startsWith(mediaPrefix)) {
    const mediaDirectory = getUserMediaDirectory(scope)
    for (const filePath of listMediaAssetFiles(mediaDirectory)) {
      const fileName = path.basename(filePath)
      const dotIndex = fileName.lastIndexOf('.')
      const encodedAssetId = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
      let assetId = encodedAssetId
      try { assetId = decodeLocalDataSegment(encodedAssetId) } catch { /* 保留原始文件名 */ }
      const key = scope + ':' + mediaPrefix + assetId
      try {
        const buffer = fs.readFileSync(filePath)
        records.push({ key, value: buffer.toString('base64') })
      } catch (error) {
        throw new Error('无法读取本地媒体文件：' + error.message)
      }
    }
  }
  return records
})

ipcMain.handle('write-renderer-logs', async (_event, entries) => {
  if (!Array.isArray(entries)) return false
  const levelMethods = { TRACE: 'trace', DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' }
  for (const entry of entries.slice(0, 500)) {
    if (!entry || typeof entry.message !== 'string') continue
    const method = levelMethods[String(entry.level || '').toUpperCase()]
    if (!method) continue
    const meta = entry.meta && typeof entry.meta === 'object' && !Array.isArray(entry.meta) ? entry.meta : {}
    const logger = loggerMod.state.logger
    delete meta.rendererTimestamp
    if (logger) {
      const message = entry.message.slice(0, 10000)
      if (Object.keys(meta).length) logger[method](meta, message)
      else logger[method](message)
    }
    else console[method === 'trace' || method === 'debug' ? 'log' : method]('[Renderer] ' + entry.message.slice(0, 10000))
  }
  return true
})

Menu.setApplicationMenu(null)

let appTray = null
let closeAction = 'minimize'
let isQuitting = false

// Windows 会话结束 / 安装器 Restart Manager 关闭请求的监听。
// Electron 的 app.on('session-end') 对应原生 WM_QUERYENDSESSION（0x0011），
// 系统关机、注销以及安装器 Restart Manager 都会发它。
// 收到后取消"最小化到托盘"行为，让随后的 WM_CLOSE 走真正的退出流程。
// 幂等：重复触发无副作用；不主动调用 win.close()，避免与 close 处理器相互递归。
function installSessionEndHook(win) {
  app.on('session-end', () => {
    debugLog('[Electron] 收到 Windows 会话结束/关闭请求，改为真正退出')
    isQuitting = true
    closeAction = 'exit'
  })
}

function getCloseAction() {
  return readAppLocalSettings().closeAction || 'minimize'
}

function saveCloseAction(action) {
  writeAppLocalSettings({ closeAction: action })
}

// ====== 应用本地设置（close-settings.json：关闭行为） ======
// 统一读改写合并，避免多个设置字段互相覆写
function readAppLocalSettings() {
  const settingsPath = path.join(app.getPath('userData'), 'close-settings.json')
  let settings = {}
  try {
    if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) || {}
  } catch {}
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) settings = {}
  if ('quickCaptureShortcut' in settings || 'quickCaptureBounds' in settings) {
    delete settings.quickCaptureShortcut
    delete settings.quickCaptureBounds
    try { fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8') } catch {}
  }
  return settings
}

function writeAppLocalSettings(patch) {
  const settingsPath = path.join(app.getPath('userData'), 'close-settings.json')
  const merged = { ...readAppLocalSettings(), ...patch }
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8')
}

const gotTheLock = app.requestSingleInstanceLock()
// 安装/卸载器的"自动关闭应用"请求（见 build/installer.iss 的 CloseRunningApp）：
// 卸载器启动一个带 --esd-graceful-exit 参数的新实例，它拿不到单实例锁即退出，
// 参数经 second-instance 转发给运行中的实例，应用收到后走正常退出流程（保存数据、清理托盘与子进程）。
const gracefulExitRequested = process.argv.includes('--esd-graceful-exit')
if (!gotTheLock) {
  debugLog('[Main] 检测到程序已在运行，当前实例即将退出')
  app.quit()
} else if (gracefulExitRequested) {
  // 安装器请求到达时，原实例可能恰好正在启动并尚未取得锁；
  // 若当前辅助实例拿到了锁，也只负责退出，不要误启动出一个新应用实例。
  debugLog('[Main] 安装/卸载流程的优雅退出辅助实例拿到单实例锁，直接退出')
  app.quit()
} else {
  // 注意签名：Electron 的 second-instance 回调是 (event, argv, workingDirectory)，
  // 第一个参数是 event 对象，argv 在第二个位置。
  // 之前误写成 (argv) => ...，Array.isArray(event) 永远为 false，
  // 导致 --esd-graceful-exit 优雅退出分支从未触发，安装器只能靠
  // 12s+8s+8s 的三级 taskkill 兜底关闭应用（总耗时 30 秒以上）。
  app.on('second-instance', (_event, argv) => {
    // 安装/卸载流程请求优雅退出：直接退出，不弹窗、不聚焦主窗口打扰用户
    if (Array.isArray(argv) && argv.includes('--esd-graceful-exit')) {
      debugLog('[Main] 收到安装/卸载流程的优雅退出请求，正在退出')
      closeAction = 'exit'
      isQuitting = true
      app.quit()
      return
    }
    debugLog('[Main] 收到重复启动请求，正在显示主窗口')
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.setSkipTaskbar(false)
      mainWindow.focus()
    }
  })
}

let mainWindow
let retryCount = 0
const WINDOWS_APP_ID = 'com.earth-survival-diary.app'
const WINDOWS_APP_NAME = '地球 Online 生存日记'
if (process.platform === 'win32') {
  // 用与安装包一致的 AppUserModelId 注册 Windows 应用身份，避免以 Electron 默认身份显示。
  app.setAppUserModelId(WINDOWS_APP_ID)
}

// ====== 开发模式支持 ======
// `npm run dev`（scripts/dev.cjs）注入 Vite dev server 地址；生产版直接加载 dist 页面。
const DEV_SERVER_URL = process.env.ESD_DEV_URL || null

// Window dimensions are device preferences, stored apart from account data.
const WINDOW_SETTINGS_PATH = path.join(app.getPath('userData'), 'window-settings.json')

function readUserSettings(userId) {
  if (!userId) return {}
  if (!fs.existsSync(WINDOW_SETTINGS_PATH)) return {}
  try { return JSON.parse(fs.readFileSync(WINDOW_SETTINGS_PATH, 'utf-8'))[userId] || {} } catch { return {} }
}

function writeUserSettings(userId, settings) {
  if (!userId) return
  let allSettings = {}
  try { allSettings = JSON.parse(fs.readFileSync(WINDOW_SETTINGS_PATH, 'utf-8')) } catch {}
  allSettings[userId] = settings
  fs.writeFileSync(WINDOW_SETTINGS_PATH, JSON.stringify(allSettings, null, 2), 'utf-8')
}

ipcMain.handle('get-screen-info', async () => {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size
  const scaleFactor = primaryDisplay.scaleFactor
  // width/height 与 BrowserWindow setSize/constructor 单位一致
  // 同时返回物理值（乘缩放因子）供前端展示用
  return {
    width,
    height,
    scaleFactor,
    physicalWidth: Math.round(width * scaleFactor - 0.001),
    physicalHeight: Math.round(height * scaleFactor - 0.001)
  }
})

ipcMain.handle('set-window-size', async (_event, userId, w, h) => {
  if (mainWindow) {
    const display = screen.getPrimaryDisplay()
    const { width: maxW, height: maxH } = display.size
    const scaleFactor = display.scaleFactor
    // w=0,h=0 表示全屏有边框模式
    const isBordered = w === 0 && h === 0
    // w/h 的单位与 display.size 一致，直接比较
    const isMax = !isBordered && w >= maxW - 1 && h >= maxH - 1

    // 保存物理分辨率（前端展示用）
    const settings = readUserSettings(userId)
    if (isBordered) {
      settings.windowSize = { width: Math.round(maxW * scaleFactor), height: Math.round(maxH * scaleFactor), mode: 'bordered' }
    } else {
      settings.windowSize = { width: Math.round(w * scaleFactor), height: Math.round(h * scaleFactor) }
    }
    writeUserSettings(userId, settings)

    if (isBordered) {
      // 全屏有边框：最大化窗口，保留边框和标题栏
      if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false)
      mainWindow.setResizable(true)
      mainWindow.maximize()
      mainWindow.setResizable(false)
    } else if (isMax) {
      // 临时启用可调整，防止 resizable:false 时 setFullScreen 无效
      mainWindow.setResizable(true)
      if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true)
      mainWindow.setResizable(false)
    } else {
      if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false)
      // 临时启用可调整，确保 setSize 生效，防止 resizable:false 时 setSize 无效
      mainWindow.setResizable(true)
      mainWindow.setSize(w, h)
      mainWindow.setResizable(false)
      mainWindow.setPosition(
        Math.round((maxW - w) / 2),
        Math.round((maxH - h) / 2)
      )
    }
  }
  return true
})

ipcMain.handle('get-window-size', async (_event, userId) => {
  if (!userId) return null
  const settings = readUserSettings(userId)
  return settings.windowSize || null
})

ipcMain.handle('apply-window-size', async (_event, userId) => {
  if (!mainWindow || !userId) return false
  const settings = readUserSettings(userId)
  if (!settings.windowSize) return false

  const isBordered = settings.windowSize.mode === 'bordered'
  const { width: savedPhysW, height: savedPhysH } = settings.windowSize
  const display = screen.getPrimaryDisplay()
  const { width: maxW, height: maxH } = display.size
  const scaleFactor = display.scaleFactor

  if (isBordered) {
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false)
    mainWindow.setResizable(true)
    mainWindow.maximize()
    mainWindow.setResizable(false)
    return true
  }

  // 物理值转回逻辑值，与 set-window-size 存储时的转换相反
  const logicalW = Math.round(savedPhysW / scaleFactor)
  const logicalH = Math.round(savedPhysH / scaleFactor)

  const isMax = logicalW >= maxW - 1 && logicalH >= maxH - 1
  if (isMax) {
    // 窗口已在 createWindow 中以全屏尺寸创建，只需进入全屏模式（无边框）
    // 临时启用可调整，防止 resizable:false 时 setFullScreen 无效
    mainWindow.setResizable(true)
    if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true)
    mainWindow.setResizable(false)
  } else {
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false)
    mainWindow.setResizable(true)
    mainWindow.setSize(logicalW, logicalH)
    mainWindow.setResizable(false)
    mainWindow.setPosition(
      Math.round((maxW - logicalW) / 2),
      Math.round((maxH - logicalH) / 2)
    )
  }
  return true
})
// ====== 窗口分辨率设置结束 ======

ipcMain.on('restart-app', () => { 
  debugLog('[Main] 收到重启请求')
  closeAction = 'exit'
  app.relaunch({ execPath: process.execPath })
  app.quit()
})

ipcMain.handle('set-auto-launch', async (_event, enable) => {
  try {
    if (process.platform === 'win32') {
      const launchPath = process.execPath
      const launchArgs = app.isPackaged ? [] : [app.getAppPath()]
      // 移除旧版 Electron 和无参数品牌项，再以产品名称注册当前启动项。
      for (const name of ['Electron', WINDOWS_APP_ID, WINDOWS_APP_NAME]) {
        app.setLoginItemSettings({ openAtLogin: false, name, path: launchPath, args: [] })
      }
      app.setLoginItemSettings({
        openAtLogin: Boolean(enable),
        name: WINDOWS_APP_NAME,
        path: launchPath,
        args: launchArgs,
      })
    } else {
      app.setLoginItemSettings({ openAtLogin: enable })
    }
    debugLog('[Main] 设置开机自启动', { enabled: enable })
    return true
  } catch (e) {
    errorLog('[Main] 设置开机自启动失败：' + e.message)
    return false
  }
})

ipcMain.handle('get-auto-launch', async () => {
  try {
    const settings = process.platform === 'win32'
      ? app.getLoginItemSettings({
          path: process.execPath,
          args: app.isPackaged ? [] : [app.getAppPath()],
        })
      : app.getLoginItemSettings()
    return settings.openAtLogin || false
  } catch {
    return false
  }
})

ipcMain.handle('set-close-action', async (_event, action) => {
  closeAction = action
  saveCloseAction(action)
  debugLog('[Main] 设置关闭按钮行为', { action })
  return true
})

ipcMain.handle('get-close-action', async () => {
  return closeAction
})

ipcMain.handle('set-window-title', async (_event, title) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(title)
  }
  return true
})

// ========== 手动检查 GitHub Releases 更新 ==========
ipcMain.handle('check-for-update', async () => {
  const url = 'https://github.com/XueWerY/earth-survival-diary/releases/latest'
  await shell.openExternal(url)
  return { ok: true, url }
})

ipcMain.handle('download-update', async () => {
  const url = 'https://github.com/XueWerY/earth-survival-diary/releases/latest'
  await shell.openExternal(url)
  return { ok: true, url }
})

ipcMain.handle('quit-and-install', async () => {
  return { ok: false, error: '应用内更新已停用，请前往 GitHub Releases 下载最新版。' }
})

ipcMain.handle('open-external', async (_event, url) => {
  debugLog('[Main] 打开外部链接：' + url)
  await shell.openExternal(url)
})

ipcMain.handle('save-file-dialog', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
    defaultPath: options.defaultPath,
    filters: options.filters || [{ name: 'JSON', extensions: ['json'] }]
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('open-file-dialog', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
    properties: ['openFile'],
    filters: options.filters || [{ name: 'JSON', extensions: ['json'] }]
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('open-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    errorLog('[FileSystem] 读取文件失败：' + e.message)
    return null
  }
})

ipcMain.handle('write-file', async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (e) {
    errorLog('[FileSystem] 写入文件失败：' + e.message)
    return false
  }
})

// ====== 文件管理器 IPC ======
const PLUGINS_DIR = app.isPackaged
  ? path.join(app.getPath('userData'), 'plugins')
  : path.join(__dirname, '..', 'src', 'plugins')
const COMPILED_TAG = 'esbuild-v3'

// 本地插件目录（始终为项目仓库自带的 src/plugins），用于「本地优先于远程」的合并逻辑
const LOCAL_PLUGINS_DIR = path.join(__dirname, '..', 'src', 'plugins')

const ALLOWED_DIRS = [
  path.join(app.getPath('userData'), 'logs'),
  PLUGINS_DIR
]

function isPathAllowed(targetPath) {
  const resolved = path.resolve(targetPath)
  return ALLOWED_DIRS.some(dir => resolved.startsWith(dir + path.sep) || resolved === dir)
}

ipcMain.handle('get-log-dir-path', async () => {
  return path.join(app.getPath('userData'), 'logs')
})

ipcMain.handle('read-directory', async (_event, dirPath) => {
  try {
    if (!isPathAllowed(dirPath)) throw new Error('Access denied: directory not allowed')
    if (!fs.existsSync(dirPath)) return []
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      size: entry.isFile() ? fs.statSync(path.join(dirPath, entry.name)).size : 0
    }))
  } catch (e) {
    errorLog('[FileManager] 读取目录失败：' + e.message)
    throw e
  }
})

ipcMain.handle('delete-file-path', async (_event, filePath) => {
  try {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: directory not allowed')
    if (!fs.existsSync(filePath)) throw new Error('File does not exist')
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true })
    } else {
      fs.unlinkSync(filePath)
    }
    return true
  } catch (e) {
    errorLog('[FileManager] 删除文件失败：' + e.message)
    throw e
  }
})

ipcMain.handle('rename-file-path', async (_event, oldPath, newPath) => {
  try {
    if (!isPathAllowed(oldPath)) throw new Error('访问被拒绝：不允许的目录')
    if (!isPathAllowed(newPath)) throw new Error('Target path is not allowed')
    if (!fs.existsSync(oldPath)) throw new Error('文件不存在')
    fs.renameSync(oldPath, newPath)
    return true
  } catch (e) {
    errorLog('[FileManager] 重命名文件失败：' + e.message)
    throw e
  }
})

ipcMain.handle('read-text-file-path', async (_event, filePath) => {
  try {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: directory not allowed')
    if (!fs.existsSync(filePath)) throw new Error('File does not exist')
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    errorLog('[FileManager] 读取文本文件失败：' + e.message)
    throw e
  }
})

ipcMain.handle('get-plugins-dir-path', async () => {
  return PLUGINS_DIR
})

// ====== 运行时插件编译 IPC ======
// 编译标记内容：打包器变更或产物异常时递增，强制已安装插件重新编译
async function ensurePluginsCompiled() {
  const buildScript = path.join(__dirname, 'build-plugin.cjs')
  if (!fs.existsSync(buildScript)) {
    debugLog('[Plugins] 未找到插件构建脚本，跳过编译')
    return
  }

  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true })
  }

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const pluginDir = path.join(PLUGINS_DIR, entry.name)
    const pluginJson = path.join(pluginDir, 'plugin.json')
    const distDir = path.join(pluginDir, 'dist')
    const distMarker = path.join(distDir, '.compiled')

    if (!fs.existsSync(pluginJson)) continue

    // 检查是否需要重新编译（标记版本不匹配、dist 不存在或 plugin.json 比编译产物新）
    let needCompile = !fs.existsSync(distMarker) ||
      fs.readFileSync(distMarker, 'utf-8') !== COMPILED_TAG ||
      fs.statSync(pluginJson).mtimeMs > fs.statSync(distMarker).mtimeMs

    // 额外检查：编译过的插件，工具 JS 文件是否都存在且非占位（占位 <1KB）
    if (!needCompile) {
      try {
        const manifest = JSON.parse(fs.readFileSync(pluginJson, 'utf-8'))
        const tools = manifest.tools || {}
        for (const toolId of Object.keys(tools)) {
          const toolJs = path.join(distDir, `${toolId}.js`)
          if (!fs.existsSync(toolJs)) {
            needCompile = true
            debugLog(`[Plugins] ${entry.name}：缺少 ${toolId}.js，正在重新编译`)
            break
          }
          if (fs.statSync(toolJs).size < 1000) {
            needCompile = true
            debugLog(`[Plugins] ${entry.name}: ${toolId}.js 看起来是占位文件，重新编译`)
            break
          }
        }
      } catch (_) { needCompile = true }
    }

    if (!needCompile) continue

    debugLog(`[Plugins] 正在编译：${entry.name}`)
    try {
      const { compilePlugin } = require(buildScript)
      await compilePlugin(pluginDir, distDir)
      // 写入编译标记
      fs.writeFileSync(distMarker, COMPILED_TAG, 'utf-8')
    } catch (e) {
      errorLog(`[Plugins] 编译 ${entry.name} 失败：${e.message}`)
    }
  }
}

// 强制重新编译全部已装插件：清掉编译标记后复用 ensurePluginsCompiled
ipcMain.handle('recompile-plugins', async () => {
  try {
    if (fs.existsSync(PLUGINS_DIR)) {
      for (const entry of fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const marker = path.join(PLUGINS_DIR, entry.name, 'dist', '.compiled')
        if (fs.existsSync(marker)) fs.rmSync(marker, { force: true })
      }
    }
    await ensurePluginsCompiled()
    return true
  } catch (e) {
    errorLog('[Plugins] 重新编译插件失败：' + e.message)
    return false
  }
})

ipcMain.handle('get-runtime-plugin-manifests', async () => {
  const manifests = []
  const seenIds = new Set()
  const scanDir = (dir, source) => {
    if (!fs.existsSync(dir)) return
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (e) {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const pluginJson = path.join(dir, entry.name, 'plugin.json')
      if (!fs.existsSync(pluginJson)) continue
      try {
        const manifest = JSON.parse(fs.readFileSync(pluginJson, 'utf-8'))
        const id = manifest?.id
        if (id && seenIds.has(id)) continue
        if (id) seenIds.add(id)
        manifests.push({ ...manifest, _source: source })
      } catch (e) {
        errorLog(`[Plugins] 读取 ${entry.name} 的插件清单失败：${e.message}`)
      }
    }
  }
  // 本地插件（src/plugins）只允许在调试态加载；打包态仅加载远程插件（userData/plugins）
  if (!app.isPackaged) {
    scanDir(LOCAL_PLUGINS_DIR, 'local')
  } else {
    debugLog('[Plugins] 打包态：跳过本地插件，仅加载远程插件')
  }
  scanDir(PLUGINS_DIR, 'remote')
  debugLog(`[Plugins] 插件清单总数：${manifests.length}，编号：${[...seenIds].join(',')}`)
  return manifests
})

ipcMain.handle('get-runtime-plugin-source', async (event, pluginId, toolId) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('无权读取插件文件')
  const safeSegment = (value) => typeof value === 'string' && value !== '.' && value !== '..' && /^[a-zA-Z0-9_.-]+$/.test(value)
  if (!safeSegment(pluginId) || !safeSegment(toolId)) throw new Error('无效的插件标识')

  const searchDirs = app.isPackaged ? [PLUGINS_DIR] : [LOCAL_PLUGINS_DIR, PLUGINS_DIR]
  for (const dir of searchDirs) {
    const pluginDir = path.resolve(dir, pluginId)
    const root = path.resolve(dir) + path.sep
    if (!pluginDir.startsWith(root)) continue
    const manifestPath = path.join(pluginDir, 'plugin.json')
    if (!fs.existsSync(manifestPath)) continue

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      if (manifest.id !== pluginId || !Object.prototype.hasOwnProperty.call(manifest.tools || {}, toolId)) continue
      const sourcePath = path.resolve(pluginDir, 'dist', `${toolId}.js`)
      if (!sourcePath.startsWith(path.join(pluginDir, 'dist') + path.sep) || !fs.existsSync(sourcePath)) continue
      return fs.readFileSync(sourcePath, 'utf-8')
    } catch (e) {
      errorLog(`[Plugins] 读取 ${pluginId}/${toolId} 失败：${e.message}`)
    }
  }
  throw new Error('插件组件不存在')
})

ipcMain.handle('create-directory', async (_event, dirPath) => {
  try {
    if (!isPathAllowed(dirPath)) throw new Error('Access denied: directory not allowed')
    fs.mkdirSync(dirPath, { recursive: true })
    return true
  } catch (e) {
    errorLog('[FileManager] 创建目录失败：' + e.message)
    throw e
  }
})

ipcMain.handle('remove-directory', async (_event, dirPath) => {
  try {
    if (!isPathAllowed(dirPath)) throw new Error('Access denied: directory not allowed')
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
    return true
  } catch (e) {
    errorLog('[FileManager] 删除目录失败：' + e.message)
    throw e
  }
})

// 获取系统已安装字体列表（Windows 端通过 PowerShell 枚举）
ipcMain.handle('get-system-fonts', async () => {
  try {
    const psScript = 'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }'
    const output = execSync(psScript, { shell: 'powershell.exe', encoding: 'utf-8', timeout: 10000 })
    return output.split(/\r?\n/).map(f => f.trim()).filter(Boolean)
  } catch (e) {
    errorLog('[Fonts] 获取系统字体失败：' + e.message)
    return []
  }
})
// ====== 文件管理器 IPC 结束 ======

// ====== 剪贴板 IPC（用于 Electron 端粘贴系统剪贴板内容） ======
ipcMain.handle('read-clipboard-text', async () => {
  try {
    return clipboard.readText()
  } catch (e) {
    errorLog('[Clipboard] 读取剪贴板文本失败：' + e.message)
    return ''
  }
})

ipcMain.handle('read-clipboard-html', async () => {
  try {
    return clipboard.readHTML()
  } catch (e) {
    errorLog('[Clipboard] 读取剪贴板网页内容失败：' + e.message)
    return ''
  }
})

// ====== 终端命令执行 / 主进程 HTTPS 请求 IPC 开始 ======
// 执行 PowerShell 命令，stdout/stderr 通过 powershell-output 事件流式回推渲染进程
// 当前正在执行的 PowerShell 子进程引用，供 kill-powershell 终止使用
let currentPowerShell = null

ipcMain.handle('exec-powershell', async (event, command) => {
  try {
    // 统一 UTF-8 输出，避免脚本中文提示乱码
    const wrapped = `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ${command}`
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', wrapped], { windowsHide: true })
    currentPowerShell = child
    const clearRef = () => { if (currentPowerShell === child) currentPowerShell = null }
    const send = (stream, text) => {
      const clean = String(text).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      if (!event.sender.isDestroyed()) event.sender.send('powershell-output', { stream, text: clean })
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (text) => send('stdout', text))
    child.stderr.on('data', (text) => send('stderr', text))
    return await new Promise((resolve) => {
      child.on('close', (code) => {
        clearRef()
        send('exit', String(code))
        resolve({ success: code === 0, code })
      })
      child.on('error', (err) => {
        clearRef()
        send('stderr', err.message)
        send('exit', '-1')
        resolve({ success: false, code: -1, error: err.message })
      })
    })
  } catch (e) {
    errorLog('[PS] 执行 PowerShell 命令失败：' + e.message)
    return { success: false, code: -1, error: e.message }
  }
})

// 终止当前正在执行的 PowerShell 子进程（抽卡分析「停止」按钮）
// 仅 kill powershell.exe 无法终止其派生的子进程，故用 taskkill /T 递归终止整棵进程树
ipcMain.handle('kill-powershell', async () => {
  try {
    if (!currentPowerShell) return { success: false, error: 'no running process' }
    const child = currentPowerShell
    currentPowerShell = null
    if (child.pid) {
      try {
        execSync(`taskkill /F /T /PID ${child.pid}`, { windowsHide: true })
      } catch (e) {
        errorLog('[PS] 结束进程失败：' + e.message)
      }
    }
    try { child.kill('SIGKILL') } catch {}
    return { success: true }
  } catch (e) {
    errorLog('[PS] 结束 PowerShell 进程失败：' + e.message)
    return { success: false, error: e.message }
  }
})

// 主进程发起 HTTPS GET 并返回原始文本（含 HTTP 状态码）。
// 供插件市场等场景下载 GitHub 源文件用，渲染进程直连第三方接口会被同源策略拦截或网络波动影响。
// net.request 自动遵循系统代理（有代理时走代理）。
ipcMain.handle('http-get-text', async (_event, url) => {
  return new Promise((resolve) => {
    const request = net.request({ url, headers: { 'User-Agent': 'earth-survival-diary' } })
    request.on('response', (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({ status: res.statusCode, text: data })
      })
    })
    request.on('error', (err) => {
      resolve({ status: 0, text: '', error: err.message })
    })
    request.end()
  })
})
// ====== 终端命令执行 / 主进程 HTTPS 请求 IPC 结束 ======

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = primaryDisplay.size
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'images', 'icon.ico')
    : path.join(__dirname, '..', 'build', 'images', 'icon.ico')

  const scaleFactor = primaryDisplay.scaleFactor || 1
  const minWindowWidth = Math.ceil(1920 / scaleFactor)
  const minWindowHeight = Math.ceil(1080 / scaleFactor)
  const winW = minWindowWidth
  const winH = minWindowHeight

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    icon: iconPath,
    minWidth: minWindowWidth,
    minHeight: minWindowHeight,
    maximizable: true,
    resizable: true,
    title: '地球 Online 生存日记',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !!DEV_SERVER_URL,
      nativeWindowOpen: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  if (DEV_SERVER_URL) mainWindow.loadURL(DEV_SERVER_URL)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  // Center window on screen
  mainWindow.setPosition(
    Math.max(0, Math.round((screenW - winW) / 2)),
    Math.max(0, Math.round((screenH - winH) / 2))
  )

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    const parsed = new URL(targetUrl)
    const childForm = parsed.searchParams.get('childForm')
    let options = {}
    if (childForm === 'list') {
      options = { parent: mainWindow, modal: true, width: 580, height: 750, minWidth: 480, minHeight: 600, resizable: false }
    } else if (childForm === 'move') {
      options = { parent: mainWindow, modal: true, width: 420, height: 340, minWidth: 360, minHeight: 300, resizable: false }
    } else if (childForm === 'list' || childForm === 'group') {
      options = { parent: mainWindow, modal: true, width: 420, height: 420, minWidth: 360, minHeight: 340, resizable: false }
    }
    return { action: 'allow', overrideBrowserWindowOptions: options }
  })

  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    errorLog('[Electron] 页面加载失败：' + code + ' ' + desc)
    // 开发模式：dev server 短暂中断（如 vite 重启）导致瞬时加载失败时自动重试
    if (DEV_SERVER_URL && mainWindow && !mainWindow.isDestroyed()) {
      if (retryCount < 3) {
        retryCount++
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(DEV_SERVER_URL).catch(() => {})
          }
        }, 600)
      }
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    retryCount = 0
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (logViewerWindow) {
      logViewerWindow.close()
      logViewerWindow = null
    }
  })

  mainWindow.on('close', (e) => {
    if (closeAction === 'minimize' && !isQuitting) {
      e.preventDefault()
      mainWindow.hide()
      mainWindow.setSkipTaskbar(true)
    }
  })

  // Windows 关机 / 注销 / 安装器 Restart Manager 的关闭请求（WM_QUERYENDSESSION）。
  //
  // 背景：安装器（Inno Setup）在覆盖文件前会向运行中的进程发 WM_QUERYENDSESSION + WM_CLOSE。
  // 若只靠上面的 close 处理器，closeAction='minimize'（默认「最小化到托盘」）会把
  // WM_CLOSE 当成用户点关闭按钮，执行 preventDefault + hide() 后进程继续存活并占用
  // 安装目录文件，安装器于是反复弹"未能自动关闭"，且"重试"只是重发注定失败的 WM_CLOSE。
  //
  // app.on('session-end') 对应原生 WM_QUERYENDSESSION：收到即置 isQuitting=true
  // 并关闭最小化拦截，让随后的 WM_CLOSE 走真正的退出流程（before-quit 保存数据）。
  // 安装器场景另有 build/installer.iss 的 --esd-graceful-exit 显式请求退出兜底。
  if (process.platform === 'win32') {
    installSessionEndHook(mainWindow)
  }

  mainWindow.show()
}

function setupTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'images', 'icon.png')
    : path.join(__dirname, '..', 'build', 'images', 'icon.png')
  appTray = new Tray(iconPath)
  appTray.setToolTip('地球 Online 生存日记')
  appTray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.setSkipTaskbar(false)
      mainWindow.focus()
    }
  })
  appTray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.setSkipTaskbar(false)
      mainWindow.focus()
    }
  })
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.setSkipTaskbar(false); mainWindow.focus() } } },
    { type: 'separator' },
    { label: '退出', click: () => { closeAction = 'exit'; cancelAllReminderTimers(); app.quit() } }
  ])
  appTray.setContextMenu(contextMenu)
  debugLog('[Main] 系统托盘已创建')
}

ipcMain.on('resize-window', (event, width, height) => {
  if (mainWindow) {
    mainWindow.setSize(width, height)
  }
})

const LOG_DIR = path.join(app.getPath('userData'), 'logs')

function getDirSize(dirPath) {
  let size = 0
  if (!fs.existsSync(dirPath)) return 0
  const items = fs.readdirSync(dirPath)
  for (const item of items) {
    const fullPath = path.join(dirPath, item)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      size += getDirSize(fullPath)
    } else {
      size += stat.size
    }
  }
  return size
}

ipcMain.handle('get-log-file-size', async () => {
  const logFilePath = findLatestLogFile(LOG_DIR)
  if (!logFilePath || !fs.existsSync(logFilePath)) return { size: 0, exists: false }
  return { size: fs.statSync(logFilePath).size, exists: true, path: logFilePath }
})

ipcMain.handle('get-log-dir-size', async () => {
  return { size: getDirSize(LOG_DIR) }
})

ipcMain.handle('get-log-content', async () => {
  const logFilePath = findLatestLogFile(LOG_DIR)
  if (!logFilePath || !fs.existsSync(logFilePath)) return ''
  return fs.readFileSync(logFilePath, 'utf-8')
})

ipcMain.handle('clear-logs', async () => {
  if (fs.existsSync(LOG_DIR)) {
    fs.rmSync(LOG_DIR, { recursive: true, force: true })
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
  return true
})

let changelogWindow = null

ipcMain.handle('open-changelog-window', async (_event, content) => {
  if (changelogWindow) {
    changelogWindow.focus()
    return
  }

  let htmlContent = content
    .replace(/^### (.+)$/gm, '<div class="ver-heading">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="sec-heading">$1</div>')
    .replace(/^- (.+)$/gm, '<div class="log-item">• $1</div>')

  htmlContent = htmlContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;div class="ver-heading"&gt;/g, '<div class="ver-heading">')
    .replace(/&lt;\/div&gt;/g, '</div>')
    .replace(/&lt;div class="sec-heading"&gt;/g, '<div class="sec-heading">')
    .replace(/&lt;div class="log-item"&gt;/g, '<div class="log-item">')

  changelogWindow = new BrowserWindow({
    width: 560,
    height: 520,
    title: '更新日志',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  changelogWindow.setMenuBarVisibility(false)

  changelogWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>更新日志</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #16162a; color: #ccc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
        .header { padding: 16px 22px 12px; font-size: 17px; font-weight: 700; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; letter-spacing: 0.5px; }
        .body { flex: 1; overflow-y: auto; padding: 16px 22px 24px; line-height: 1.8; }
        ${APP_SCROLLBAR_CSS}
        .sec-heading { font-size: 15px; font-weight: 700; color: #8ab4f8; margin: 24px 0 14px; letter-spacing: 0.3px; }
        .ver-heading { font-size: 13px; font-weight: 600; color: #e8c766; margin: 16px 0 6px; padding: 0 0 0 8px; border-left: 2px solid rgba(232,199,102,0.3); }
        .log-item { font-size: 13px; color: #bbb; padding: 1px 0 1px 8px; }
        .footer { display: flex; justify-content: flex-end; padding: 10px 22px; border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
        .footer button { padding: 7px 26px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.65); transition: background 0.2s; }
        .footer button:hover { background: rgba(255,255,255,0.11); }
      </style>
    </head>
    <body>
      <div class="header">更新日志</div>
      <div id="changelogBody" class="body">${htmlContent}</div>
      <div class="footer"><button onclick="window.close()">关闭</button></div>
      <script>
        ${APP_SCROLLBAR_INSTALLER}
        installAppScrollbar(document.getElementById('changelogBody'))
      </script>
    </body>
    </html>
  `)}`)

  changelogWindow.on('closed', () => {
    changelogWindow = null
  })
})

// ====== 提醒系统 v2 ======
let currentUserId = null

const SCAN_INTERVAL_MS = 60_000
const SCAN_AHEAD_MS = 5 * 60_000
const MAX_SAFE_DELAY = 2_000_000_000

let reminderTimers = []
let reminderQueue = []
let reminderPersistDuration = 30
let reminderStore = []
let isShowingReminder = false
let showReminderTimer = null
let scanIntervalId = null
let storeDirty = false
let persistDebounceTimer = null

function getReminderFilePath(userId) {
  return path.join(localDataDirectory, encodeLocalDataSegment(String(userId)), 'system', 'reminders.yaml')
}

function writeReminderFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryFile = filePath + '.tmp-' + process.pid + '-' + Date.now()
  try {
    const document = normalizeLocalDataValue({ version: 1, reminders: reminderStore })
    fs.writeFileSync(temporaryFile, YAML.stringify(document, { lineWidth: 0 }), 'utf8')
    fs.renameSync(temporaryFile, filePath)
  } catch (error) {
    try { fs.unlinkSync(temporaryFile) } catch {}
    throw error
  }
}

async function loadReminders() {
  try {
    if (!currentUserId) { reminderStore = []; return }
    const reminderFile = getReminderFilePath(currentUserId)
    if (fs.existsSync(reminderFile)) {
      const data = YAML.parse(fs.readFileSync(reminderFile, 'utf8'))
      reminderStore = data && typeof data === 'object' && Array.isArray(data.reminders) ? data.reminders : []
      return
    }

    reminderStore = []
  } catch (e) { errorLog('[Reminder] 加载提醒失败：' + e.message); reminderStore = [] }
}

async function persistReminders() {
  if (!storeDirty || !currentUserId) return
  try {
    writeReminderFile(getReminderFilePath(currentUserId))
    storeDirty = false
  } catch (e) { errorLog('[Reminder] 本地保存提醒失败：' + e.message) }
}

function schedulePersist() {
  storeDirty = true
  if (persistDebounceTimer) clearTimeout(persistDebounceTimer)
  persistDebounceTimer = setTimeout(() => { persistDebounceTimer = null; persistReminders() }, 3000)
}

function upsertReminders(reminders) {
  const existing = new Map(reminderStore.map(r => [r.id, r]))
  reminderStore = reminders.map(r => { const o = existing.get(r.id); return o ? { ...o, ...r } : { ...r, status: 'pending', lastTriggeredAt: null } })
  storeDirty = true
}

function findReminder(id) { return reminderStore.find(r => r.id === id) }

function scheduleReminderRuntime(reminder) {
  const delay = new Date(reminder.triggerTime).getTime() - Date.now()
  if (delay <= 0) { enqueueReminder(reminder); return }
  if (delay > MAX_SAFE_DELAY) {
    return
  }
  reminderTimers.push({ id: reminder.id, timeout: setTimeout(() => enqueueReminder(reminder), delay) })
}

function scanDueReminders() {
  const now = Date.now(), dueSoon = [], overdue = []
  for (const r of reminderStore) {
    if (r.status === 'cancelled' || r.status === 'done') continue
    if (r.status === 'triggered' && r.lastShownAt) continue
    const t = new Date(r.triggerTime).getTime()
    if (t - now <= SCAN_AHEAD_MS + 60000) {
      if (t - now <= SCAN_AHEAD_MS) dueSoon.push(r)
      else if (t <= now) overdue.push(r)
    }
  }
  for (const r of dueSoon) if (!reminderTimers.some(t => t.id === r.id)) scheduleReminderRuntime(r)
  for (const r of overdue) if (!reminderTimers.some(t => t.id === r.id)) { debugLog('[Reminder] 补触发过期提醒：' + (r.name || r.id)); enqueueReminder(r) }
}

function startTicker() { if (scanIntervalId) return; scanDueReminders(); scanIntervalId = setInterval(scanDueReminders, SCAN_INTERVAL_MS) }
function stopTicker() { if (scanIntervalId) { clearInterval(scanIntervalId); scanIntervalId = null } }

function cancelAllReminderTimers() {
  reminderTimers.forEach(t => clearTimeout(t.timeout)); reminderTimers = []; reminderQueue = []
  isShowingReminder = false
  if (showReminderTimer) { clearTimeout(showReminderTimer); showReminderTimer = null }
}

function enqueueReminder(reminder) { reminderQueue.push(reminder); showNextReminder() }

function showNextReminder() {
  if (isShowingReminder) return
  if (reminderQueue.length === 0) return
  isShowingReminder = true
  const reminder = reminderQueue.shift()
  const storeR = findReminder(reminder.id)
  if (storeR) { storeR.status = 'triggered'; storeR.lastTriggeredAt = new Date().toISOString(); schedulePersist() }
  if (reminder.repeatStrategy && reminder.repeatStrategy !== 'none') scheduleNextRepeat(reminder)
  const canUseInApp = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized()
  if (canUseInApp) {
    mainWindow.webContents.send('show-reminder', reminder)
    debugLog('[Reminder] 应用内弹窗：' + reminder.name + ' (剩余 ' + reminderQueue.length + ')')
  } else {
    sendSystemNotification(reminder)
    debugLog('[Reminder] 系统通知：' + reminder.name + ' (剩余 ' + reminderQueue.length + ')')
  }
  showReminderTimer = setTimeout(() => { showReminderTimer = null; isShowingReminder = false; showNextReminder() }, (reminderPersistDuration || 30) * 1000)
}

function sendSystemNotification(reminder) {
  try {
    const Notification = require('electron').Notification
    if (!Notification.isSupported()) return
    new Notification({ title: reminder.name || '提醒', body: reminder.body || '', silent: false }).show()
  } catch (e) { errorLog('[Reminder] 系统通知发送失败：' + e.message) }
}

function scheduleNextRepeat(reminder) {
  const storeR = findReminder(reminder.id); if (!storeR) return
  if (storeR.repeatEndStrategy === 'count' && storeR.repeatCount && storeR.repeatCompletedCount >= storeR.repeatCount) {
    storeR.status = 'done'; schedulePersist(); return
  }
  const next = new Date(storeR.triggerTime)
  switch (storeR.repeatStrategy) {
    case 'daily': next.setDate(next.getDate() + 1); break
    case 'weekdays': next.setDate(next.getDate() + 1); { const d = next.getDay(); if (d === 0) next.setDate(next.getDate() + 1); else if (d === 6) next.setDate(next.getDate() + 2) } break
    case 'weekly': next.setDate(next.getDate() + 7); break
    case 'monthly': next.setMonth(next.getMonth() + 1); break
    case 'yearly': next.setFullYear(next.getFullYear() + 1); break
    case 'hourly': next.setHours(next.getHours() + 1); break
    case 'custom_days': next.setDate(next.getDate() + (storeR.repeatCustomDays || 1)); break
    default: return
  }
  if (storeR.repeatEndStrategy === 'date' && storeR.repeatEndDate && next > new Date(storeR.repeatEndDate + 'T23:59:59')) {
    storeR.status = 'done'; schedulePersist(); return
  }
  if (storeR.reminderStrategy === 'advance') {
    const o = ((storeR.reminderDays || 0) * 1440 + (storeR.reminderHours || 0) * 60 + (storeR.reminderMinutes || 0)) * 60000
    if (o > 0) next.setTime(next.getTime() - o)
  }
  const delay = next.getTime() - Date.now()
  if (delay > MAX_SAFE_DELAY) debugLog('[Reminder] 下一轮太远，跳过定时器：' + reminder.name + ' (' + formatDelay(delay) + ')')
  storeR.triggerTime = next.toISOString()
  storeR.repeatCompletedCount = (storeR.repeatCompletedCount || 0) + 1
  storeR.status = 'pending'
  if (storeR.repeatStrategy === 'hourly' && storeR.focusStartTimestamp) {
    storeR.body = '您已专注 ' + Math.round((next.getTime() - storeR.focusStartTimestamp) / 3600000) + ' 小时，请注意休息！'
  }
  schedulePersist()
}

function formatDelay(ms) {
  const totalSec = Math.round(ms / 1000)
  const days = Math.floor(totalSec / 86400), hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60), seconds = totalSec % 60
  if (days > 0) return days + ' 天 ' + hours + ' 时 ' + minutes + ' 分 ' + seconds + ' 秒'
  if (hours > 0) return hours + ' 时 ' + minutes + ' 分 ' + seconds + ' 秒'
  if (minutes > 0) return minutes + ' 分 ' + seconds + ' 秒'
  return seconds + ' 秒'
}

ipcMain.handle('schedule-reminders', async (_event, userId, reminders, persistDuration, triggerReason) => {
  if (typeof userId !== 'string' || !userId.trim()) {
    debugLog('[Reminder] 拒绝调度请求：缺少用户编号')
    return { ok: false, count: 0, error: '缺少用户 ID' }
  }
  if (!Array.isArray(reminders)) {
    debugLog('[Reminder] 拒绝调度请求：提醒列表格式无效', { userId })
    return { ok: false, count: 0, error: '提醒列表格式无效' }
  }
  currentUserId = userId
  await loadReminders()
  const reason = typeof triggerReason === 'string' && triggerReason.trim() ? triggerReason.trim() : '未注明的调用来源'
  cancelAllReminderTimers()
  if (persistDuration != null) reminderPersistDuration = persistDuration
  if (!reminders || reminders.length === 0) {
    reminderStore = []
    schedulePersist()
    debugLog('[Reminder] 提醒计划已更新，触发原因 = ' + reason + '，共 0 条')
    return { ok: true, count: 0 }
  }
  upsertReminders(reminders)
  reminders.forEach(r => scheduleReminderRuntime(r))
  debugLog('[Reminder] 提醒计划已更新，触发原因 = ' + reason + '，共 ' + reminders.length + ' 条')
  return { ok: true, count: reminders.length }
})

ipcMain.handle('cancel-all-reminders', async () => {
  debugLog('[Reminder] 取消所有提醒')
  cancelAllReminderTimers(); reminderStore.forEach(r => { r.status = 'cancelled' }); schedulePersist()
  return { ok: true }
})

ipcMain.handle('get-reminder-persist-duration', async () => ({ persistDuration: reminderPersistDuration }))

ipcMain.handle('get-all-reminders', async () => reminderStore.map(r => { const t = reminderTimers.find(x => x.id === r.id); return t ? { ...r, runtimeScheduled: true } : r }))

function initReminderSystem() { startTicker(); debugLog('[Reminder] 调度器已启动，等待登录后加载用户提醒') }

// ====== 提醒系统结束 ======

// ====== 全屏游戏前台时视频播放器卡顿修复（须在 app ready 前设置） ======
// Windows 上 Chromium 的原生窗口遮挡检测（CalculateNativeWinOcclusion）会把置顶的播放器窗口
// 误判为被全屏游戏"遮挡"，进而停止/降频该窗口的合成渲染导致播放卡顿（游戏切后台即恢复正常）。
// 禁用遮挡检测与被遮挡窗口的后台化/渲染器降频，保证播放器在全屏游戏前台时持续正常渲染。
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

/** 启动时执行一次旧媒体资产迁移（幂等：无旧 YAML 时立即返回） */
function runLegacyMediaAssetMigration() {
  try {
    if (!fs.existsSync(localDataDirectory)) return
    const userDirectories = fs.readdirSync(localDataDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
    for (const scope of userDirectories) {
      const mediaDirectory = path.join(localDataDirectory, scope, 'notes', 'media')
      const hasLegacyFiles = fs.existsSync(mediaDirectory)
        && fs.readdirSync(mediaDirectory).some(name => name.endsWith('.yaml'))
      if (!hasLegacyFiles) continue
      let decodedScope = scope
      try { decodedScope = decodeLocalDataSegment(scope) } catch { /* 目录名即 scope */ }
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(decodedScope)) continue
      debugLog('[媒体迁移] 检测到旧版媒体数据，开始迁移', { scope: decodedScope })
      migrateLegacyMediaAssets(decodedScope)
    }
  } catch (error) {
    errorLog('[媒体迁移] 迁移过程失败：' + error.message)
  }
}

app.whenReady().then(async () => {
  if (gracefulExitRequested) {
    debugLog('[Main] 优雅退出辅助实例跳过应用启动')
    return
  }
  if (!gotTheLock) {
    debugLog('[Main] 未取得单实例锁，跳过启动')
    return
  }
  closeAction = getCloseAction()
  initLogger()
  debugLog('[Main] 关闭按钮行为：' + (closeAction === 'exit' ? '直接退出' : '最小化到系统托盘'))

  try {
    // 旧版媒体资产（随机 ID + YAML 包裹 data URL）迁移为内容寻址的二进制文件，并清理重复副本
    runLegacyMediaAssetMigration()
    const target = DEV_SERVER_URL || path.join(__dirname, '..', 'dist', 'index.html')
    debugLog('[Electron] 正在加载客户端页面', { url: target })
    createWindow()
    setupTray()
    initReminderSystem()
    // 插件编译在后台进行，避免阻塞窗口首次显示
    ensurePluginsCompiled().catch((err) => errorLog('[Electron] 插件编译失败：' + err.message))

  } catch (err) {
    errorLog('[Electron] 致命错误：' + err.message)
    errorLog('[Electron] 调用堆栈：' + err.stack)
    dialog.showErrorBox(
      '启动失败',
      '应用启动失败：' + err.message
    )
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  debugLog('[Electron] 应用即将退出（系统关机/用户退出）')
  isQuitting = true
  cancelAllReminderTimers()
  stopTicker()
  if (storeDirty && currentUserId) persistReminders().catch(() => {})
})

let logViewerWindow = null

ipcMain.handle('open-log-viewer', async (_event, logContent) => {
  if (logViewerWindow) {
    logViewerWindow.focus()
    return
  }

  logViewerWindow = new BrowserWindow({
    width: 900,
    height: 600,
    title: '日志查看器',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  logViewerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>日志查看器</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #1a1a2e; color: #eee; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
        .toolbar { display: flex; gap: 8px; padding: 10px 16px; background: #16213e; border-bottom: 1px solid #333; align-items: center; }
        .toolbar button { background: #2a2a4a; border: 1px solid #444; color: #ddd; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .toolbar button:hover { background: #3a3a5a; }
        .toolbar input { background: #2a2a4a; border: 1px solid #444; color: #ddd; padding: 6px 10px; border-radius: 4px; font-size: 12px; width: 120px; }
        .toolbar select { background: #2a2a4a; border: 1px solid #444; color: #ddd; padding: 6px 8px; border-radius: 4px; font-size: 12px; }
        .log-container { flex: 1; overflow-y: auto; padding: 12px; line-height: 1.8; }
        .log-line { white-space: pre-wrap; word-break: break-all; }
        .log-time { color: #88c0d0; }
        .log-level-debug { color: #5e81ac; }
        .log-level-info { color: #a3be8c; }
        .log-level-warn { color: #ebcb8b; }
        .log-level-error { color: #bf616a; }
        .log-level-fatal { color: #e06c75; }
        .log-content { color: #d8dee9; }
        .jk { color: #9cdcfe; font-weight: bold; }
        .js { color: #ce9178; }
        .jn { color: #b5cea8; }
        .jb { color: #569cd6; font-weight: bold; }
        .jnl { color: #569cd6; font-weight: bold; }
        .jp { color: #808080; }
        .empty-hint { text-align: center; color: #555; padding: 40px 0; font-size: 14px; }
        ${APP_SCROLLBAR_CSS}
      </style>
    </head>
    <body>
      <div class="toolbar">
        <input type="text" id="filterText" placeholder="搜索日志...">
        <select id="levelFilter">
          <option value="">全部级别</option>
          <option value="DEBUG">DEBUG</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <button id="clearFilter">清除过滤</button>
      </div>
      <div class="log-container" id="logContainer"></div>
      <script>
        ${APP_SCROLLBAR_INSTALLER}
        var logContent = JSON.parse(decodeURIComponent(\`${encodeURIComponent(JSON.stringify(logContent))}\`));
        var isAtBottom = true;
        var container = document.getElementById('logContainer');
        installAppScrollbar(container);

        container.addEventListener('scroll', function() {
          isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        });

        function parseLogLine(line) {
          var match = line.match(/^\\[([^\\]]+)\\]\\s*\\[([^\\]]+)\\]\\s*(.*)/);
          if (!match) return { time: '', level: '', content: line };
          return { time: match[1], level: match[2], content: match[3] };
        }

        function escapeHtml(str) {
          if (!str) return '';
          return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function colorizeJson(pretty) {
          return pretty
            .replace(/("[^"]*")\\s*:/g, '<span class="jk">$1</span>:')
            .replace(/: "(.*?)"/g, ': <span class="js">"$1"</span>')
            .replace(/: (\\d+\\.?\\d*)/g, ': <span class="jn">$1</span>')
            .replace(/: (true|false)/g, ': <span class="jb">$1</span>')
            .replace(/: (null)/g, ': <span class="jnl">$1</span>')
            .replace(/([{}\\[\\],])/g, '<span class="jp">$1</span>');
        }

        function formatContent(content) {
          var start = content.indexOf('{');
          if (start === -1) return escapeHtml(content);

          var depth = 0, inStr = false;
          for (var i = start; i < content.length; i++) {
            var ch = content[i];
            if (ch === '\\\\' && inStr) { i++; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === '{') depth++;
            else if (ch === '}') {
              depth--;
              if (depth === 0) {
                var before = formatContent(content.substring(0, start));
                var json = content.substring(start, i + 1);
                var after = formatContent(content.substring(i + 1));
                try {
                  var obj = JSON.parse(json);
                  return before + colorizeJson(JSON.stringify(obj, null, 2)) + after;
                } catch(e) {
                  return before + escapeHtml(json) + after;
                }
              }
            }
          }
          return escapeHtml(content);
        }

        function renderLogs() {
          var filterText = document.getElementById('filterText');
          var levelSel = document.getElementById('levelFilter');
          if (!filterText || !levelSel) return;

          var filter = filterText.value.toLowerCase();
          var levelFilter = levelSel.value;
          var lines = logContent.split('\\n');
          if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) {
            container.innerHTML = '<div class="empty-hint">暂无日志内容</div>';
            return;
          }

          var html = '';
          for (var k = 0; k < lines.length; k++) {
            var line = lines[k];
            if (!line.trim()) continue;
            var parsed = parseLogLine(line);
            if (filter && line.toLowerCase().indexOf(filter) === -1) continue;
            if (levelFilter && parsed.level !== levelFilter) continue;

            if (parsed.time) {
              var levelClass = parsed.level ? 'log-level-' + parsed.level.toLowerCase() : '';
              html += '<div class="log-line">[<span class="log-time">' + escapeHtml(parsed.time) + '</span>] [<span class="' + levelClass + '">' + escapeHtml(parsed.level) + '</span>] <span class="log-content">' + formatContent(parsed.content) + '</span></div>';
            } else {
              html += '<div class="log-line"><span class="log-content">' + formatContent(parsed.content) + '</span></div>';
            }
          }

          container.innerHTML = html || '<div class="empty-hint">没有匹配的记录</div>';
          if (isAtBottom) container.scrollTop = container.scrollHeight;
        }

        document.getElementById('filterText').addEventListener('input', renderLogs);
        document.getElementById('levelFilter').addEventListener('change', renderLogs);
        document.getElementById('clearFilter').addEventListener('click', function() {
          document.getElementById('filterText').value = '';
          document.getElementById('levelFilter').value = '';
          renderLogs();
        });

        renderLogs();

        setInterval(async function() {
          try {
            var newContent = await window.electronAPI.getLogContent();
            if (newContent !== logContent) {
              logContent = newContent;
              renderLogs();
            }
          } catch(e) {}
        }, 2000);
      </script>
    </body>
    </html>
  `)}`)

  logViewerWindow.on('closed', () => {
    logViewerWindow = null
  })
})
