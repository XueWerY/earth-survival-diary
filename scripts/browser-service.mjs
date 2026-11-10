import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import YAML from 'yaml'

const require = createRequire(import.meta.url)
const { compilePlugin } = require('./build-plugin.cjs')

const appData = process.env.APPDATA || path.join(os.homedir(), '.config')
const appRoot = path.join(appData, 'earth-survival-diary')
const dataRoot = process.env.ESD_DATA_DIR || path.join(appRoot, 'data')
const logsRoot = path.join(appRoot, 'logs')
const pluginsRoot = path.join(appRoot, 'plugins')
const writeQueue = { current: Promise.resolve() }
const uploads = new Map()

const MIME_EXTENSIONS = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'weba',
}
const MIME_BY_EXT = Object.fromEntries(Object.entries(MIME_EXTENSIONS).map(([mime, ext]) => [ext, mime]))
const MODULES = new Set(['countdown', 'course', 'focus', 'footprint', 'list', 'notes', 'profile', 'settings', 'system', 'star-rail-character-growth', 'genshin-character-growth'])
const ALIASES = new Map([
  ['tasks', ['footprint', 'footprint']], ['diaries', ['footprint', 'diary']], ['lists', ['list', 'lists']],
  ['listTasks', ['list', 'tasks']], ['profile', ['profile', 'profile']], ['settings', ['settings', 'settings']],
  ['app-settings', ['settings', 'settings']], ['profile:avatar', ['profile', 'profile']],
])

function fail(message, status = 400) {
  const error = new Error(message)
  error.status = status
  throw error
}

function sendJson(res, status, value) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(value))
}

function readJson(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('请求数据过大'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch { reject(Object.assign(new Error('请求 JSON 格式无效'), { status: 400 })) }
    })
    req.on('error', reject)
  })
}

function encodeSegment(segment) {
  const value = String(segment)
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : '~' + Buffer.from(value, 'utf8').toString('base64url')
}

function decodeSegment(segment) {
  if (!segment.startsWith('~')) return segment
  return Buffer.from(segment.slice(1), 'base64url').toString('utf8')
}

function splitKey(key) {
  if (typeof key !== 'string' || !key.length || key.length > 512 || /[\u0000-\u001f]/.test(key)) fail('本地数据键无效')
  const separator = key.indexOf(':')
  if (separator <= 0) fail('本地数据键缺少用户范围')
  const scope = key.slice(0, separator)
  const dataKey = key.slice(separator + 1).replace(/^api-data:/, '')
  if (scope !== 'global' && !/^[A-Za-z0-9_-]{1,128}$/.test(scope)) fail('本地用户 ID 无效')
  return { scope, dataKey }
}

function mediaInfo(key) {
  const { scope, dataKey } = splitKey(key)
  if (scope === 'global' || !dataKey.startsWith('media:asset:')) return null
  const rest = dataKey.slice('media:asset:'.length)
  const isMeta = rest.endsWith(':meta')
  const assetId = isMeta ? rest.slice(0, -':meta'.length) : rest
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(assetId)) fail('本地媒体数据键无效')
  return { scope, assetId, isMeta }
}

function legacyMediaDirectory(scope) {
  return path.join(dataRoot, encodeSegment(scope), 'notes', 'media')
}

function notesLibraryMetadataDirectory(root, create = false) {
  const resolvedRoot = assertNotesLibraryRoot(path.resolve(root))
  if (!isUsableNotesLibraryRoot(resolvedRoot)) fail('笔记库文件夹已不可用，请重新选择笔记库位置')

  // Windows 和常见 macOS 文件系统不区分大小写，但部分 Linux / WSL
  // 笔记库会保留目录名大小写。按库根目录中的实际名称定位，避免所有
  // 库级元数据都误读成“目录不存在”并在另一个拼写下新建空目录。
  const matchingEntries = fs.readdirSync(resolvedRoot, { withFileTypes: true })
    .filter(entry => entry.name.toLowerCase() === '.earth-survival-diary')
  if (matchingEntries.length > 1) fail('笔记库中存在多个大小写不同的索引目录，请保留一个 .earth-survival-diary 目录')
  const directoryName = matchingEntries[0]?.name || '.earth-survival-diary'
  const directory = path.join(resolvedRoot, directoryName)
  try {
    const stat = fs.lstatSync(directory)
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('笔记库索引目录必须是普通文件夹')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    if (create) fs.mkdirSync(directory)
  }
  return directory
}

function mediaDirectory(scope) {
  const root = libraryRoot(scope)
  if (!isUsableNotesLibraryRoot(root)) return legacyMediaDirectory(scope)
  const directory = path.join(notesLibraryMetadataDirectory(root), 'media')
  try {
    const stat = fs.lstatSync(directory)
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('笔记库媒体目录必须是普通文件夹')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const legacyDirectory = legacyMediaDirectory(scope)
  if (!samePath(directory, legacyDirectory)) {
    try {
      const entries = fs.readdirSync(legacyDirectory, { withFileTypes: true })
      if (entries.some(entry => entry.isFile() && !entry.name.includes('.tmp-'))) {
        migrateMediaDirectory(legacyDirectory, directory)
        removeManagedMediaDirectory(legacyDirectory)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  return directory
}

function metadataPath(scope) {
  return path.join(mediaDirectory(scope), 'metadata.yaml')
}

function legacyTagsPath(scope) {
  return path.join(dataRoot, encodeSegment(scope), 'notes', 'tags.yaml')
}

function tagsPathInLibrary(root) {
  return path.join(notesLibraryMetadataDirectory(root), 'tags.yaml')
}

function notesLibraryConfigPath(scope) {
  return path.join(dataRoot, encodeSegment(scope), 'notes', 'library.yaml')
}

function libraryIdForPath(rootPath) {
  const normalized = process.platform === 'win32' ? path.resolve(rootPath).toLowerCase() : path.resolve(rootPath)
  return 'library_' + crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

function createNotesLibraryEntry(rootPath, name) {
  const resolved = assertNotesLibraryRoot(path.resolve(rootPath))
  return {
    id: libraryIdForPath(resolved),
    name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : path.basename(resolved) || resolved,
    rootPath: resolved,
  }
}

function readNotesLibraryConfig(scope) {
  try {
    const value = YAML.parse(fs.readFileSync(notesLibraryConfigPath(scope), 'utf8'))
    if (value && typeof value.rootPath === 'string' && path.isAbsolute(value.rootPath)) {
      const library = createNotesLibraryEntry(value.rootPath)
      return { version: 2, libraries: [library], activeId: library.id }
    }
    if (value && Array.isArray(value.libraries)) {
      const libraries = []
      for (const item of value.libraries) {
        if (!item || typeof item.rootPath !== 'string' || !path.isAbsolute(item.rootPath)) fail('笔记库清单无效，请重新选择笔记库')
        const library = createNotesLibraryEntry(item.rootPath, item.name)
        if (!libraries.some(existing => samePath(existing.rootPath, library.rootPath))) libraries.push(library)
      }
      const activeId = libraries.some(library => library.id === value.activeId) ? value.activeId : libraries[0]?.id || null
      return { version: 2, libraries, activeId }
    }
    fail('笔记库配置无效，请重新选择文件夹')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function writeNotesLibraryConfig(scope, config) {
  atomicWrite(notesLibraryConfigPath(scope), YAML.stringify({
    version: 2,
    libraries: config.libraries,
    activeId: config.activeId,
  }, { lineWidth: 0 }), 'utf8')
}

function isPathWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target))
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))
}

function pathsOverlap(left, right) {
  return isPathWithin(left, right) || isPathWithin(right, left)
}

function assertNotesLibraryRoot(rootPath) {
  if (typeof rootPath !== 'string' || !path.isAbsolute(rootPath)) fail('笔记库文件夹路径无效')
  const resolved = path.resolve(rootPath)
  if (pathsOverlap(dataRoot, resolved)) fail('笔记库不能放在应用数据目录中，也不能包含应用数据目录')
  return resolved
}

function libraryRoot(scope) {
  const config = readNotesLibraryConfig(scope)
  const active = config?.libraries.find(library => library.id === config.activeId)
  return active ? assertNotesLibraryRoot(active.rootPath) : null
}

function isUsableNotesLibraryRoot(root) {
  if (!root) return false
  try {
    const stat = fs.lstatSync(root)
    return stat.isDirectory() && !stat.isSymbolicLink()
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function pinnedNoteTabsPath(scope, libraryId, create = false) {
  validateNoteScope(scope)
  if (typeof libraryId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(libraryId)) fail('笔记库编号无效')
  const library = readNotesLibraryConfig(scope)?.libraries.find(item => item.id === libraryId)
  if (!library) fail('找不到要读取的笔记库')
  const root = assertNotesLibraryRoot(library.rootPath)
  if (!isUsableNotesLibraryRoot(root)) return null
  const directory = notesLibraryMetadataDirectory(root, create)
  const filePath = path.join(directory, 'tabs.yaml')
  try {
    const stat = fs.lstatSync(filePath)
    if (stat.isSymbolicLink() || !stat.isFile()) fail('笔记标签状态文件必须是普通文件')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    if (!create) return null
  }
  return filePath
}

function favoriteFoldersPath(scope, libraryId, create = false) {
  validateNoteScope(scope)
  if (typeof libraryId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(libraryId)) fail('笔记库编号无效')
  const library = readNotesLibraryConfig(scope)?.libraries.find(item => item.id === libraryId)
  if (!library) fail('找不到要读取的笔记库')
  const root = assertNotesLibraryRoot(library.rootPath)
  if (!isUsableNotesLibraryRoot(root)) return null
  const directory = notesLibraryMetadataDirectory(root, create)
  const filePath = path.join(directory, 'folders.yaml')
  try {
    const stat = fs.lstatSync(filePath)
    if (stat.isSymbolicLink() || !stat.isFile()) fail('文件夹收藏状态文件必须是普通文件')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    if (!create) return null
  }
  return filePath
}

function normalizeFavoriteFolderPaths(value) {
  const paths = Array.isArray(value) ? value : value?.folderPaths
  if (!Array.isArray(paths)) return []
  return [...new Set(paths.filter(item => typeof item === 'string').map(normalizeFolderPath).filter(Boolean))]
}

function readFavoriteFolderPaths(scope, libraryId) {
  const filePath = favoriteFoldersPath(scope, libraryId)
  if (!filePath) return []
  try { return normalizeFavoriteFolderPaths(YAML.parse(fs.readFileSync(filePath, 'utf8'))) }
  catch (error) { if (error.code === 'ENOENT') return []; throw error }
}

function writeFavoriteFolderPaths(scope, libraryId, folderPaths) {
  const normalized = normalizeFavoriteFolderPaths(folderPaths)
  const filePath = favoriteFoldersPath(scope, libraryId, true)
  if (!filePath) fail('笔记库文件夹不可用')
  atomicWrite(filePath, YAML.stringify({ version: 1, folderPaths: normalized }, { lineWidth: 0 }), 'utf8')
  return true
}

function normalizePinnedNoteIds(value) {
  if (!Array.isArray(value)) fail('固定笔记标签状态无效')
  const ids = []
  const seen = new Set()
  for (const id of value) {
    if (typeof id !== 'string' || !id.trim() || id.length > 512 || /[\u0000-\u001f]/.test(id)) continue
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function readPinnedNoteTabIds(scope, libraryId) {
  const filePath = pinnedNoteTabsPath(scope, libraryId)
  if (!filePath) return []
  try {
    const value = YAML.parse(fs.readFileSync(filePath, 'utf8'))
    return normalizePinnedNoteIds(Array.isArray(value) ? value : value?.pinnedNoteIds || [])
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

function writePinnedNoteTabIds(scope, libraryId, pinnedNoteIds) {
  const normalized = normalizePinnedNoteIds(pinnedNoteIds)
  const filePath = pinnedNoteTabsPath(scope, libraryId, true)
  if (!filePath) fail('笔记库文件夹不可用')
  atomicWrite(filePath, YAML.stringify({ version: 1, pinnedNoteIds: normalized }, { lineWidth: 0 }), 'utf8')
  return true
}

function normalizeFolderPath(folderPath) {
  if (folderPath == null || folderPath === '') return ''
  if (typeof folderPath !== 'string' || folderPath.length > 1024) fail('笔记文件夹路径无效')
  const normalized = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized) return ''
  const segments = normalized.split('/')
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || /[<>:"|?*\u0000-\u001f]/.test(segment) || /[. ]$/.test(segment)) fail('笔记文件夹名称无效')
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment)) fail('笔记文件夹名称不能使用 Windows 保留名称')
    if (segment.toLowerCase() === '.earth-survival-diary') fail('此名称保留给笔记库索引目录')
  }
  return segments.join('/')
}

function resolveLibraryDirectory(root, folderPath, create = false) {
  const normalized = normalizeFolderPath(folderPath)
  const segments = normalized ? normalized.split('/') : []
  let current = path.resolve(root)
  if (!isPathWithin(root, current)) fail('笔记文件夹路径超出笔记库')
  for (const segment of segments) {
    current = path.join(current, segment)
    if (!isPathWithin(root, current)) fail('笔记文件夹路径超出笔记库')
    try {
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail('笔记库不能通过符号链接访问文件夹')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      if (create) fs.mkdirSync(current)
    }
  }
  return current
}

function readMetadata(scope) {
  return readMetadataFromDirectory(mediaDirectory(scope))
}

function readMetadataFromDirectory(directory) {
  try {
    const filePath = path.join(directory, 'metadata.yaml')
    const stat = fs.lstatSync(filePath)
    if (stat.isSymbolicLink() || !stat.isFile()) fail('笔记媒体索引必须是普通文件')
    const value = YAML.parse(fs.readFileSync(filePath, 'utf8'))
    if (value && typeof value === 'object' && value.assets && typeof value.assets === 'object' && !Array.isArray(value.assets)) return { version: 1, assets: value.assets }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return { version: 1, assets: {} }
}

function atomicWrite(filePath, content, encoding) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`
  try {
    fs.writeFileSync(temporary, content, encoding)
    fs.renameSync(temporary, filePath)
  } catch (error) {
    try { fs.unlinkSync(temporary) } catch {}
    throw error
  }
}

function notesTrashManifestPath(root) {
  return path.join(notesLibraryMetadataDirectory(root), 'trash.yaml')
}

function readNotesTrashState(root) {
  const filePath = notesTrashManifestPath(root)
  try {
    const stat = fs.lstatSync(filePath)
    if (stat.isSymbolicLink() || !stat.isFile()) fail('笔记回收站索引必须是普通文件')
    const value = YAML.parse(fs.readFileSync(filePath, 'utf8'))
    const notes = Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray(value.notes) ? value.notes : []
    const systemItems = new Map()
    for (const item of Array.isArray(value?.systemItems) ? value.systemItems : []) {
      if (!item || typeof item.noteId !== 'string' || !item.noteId || typeof item.originalPath !== 'string' || !path.isAbsolute(item.originalPath)) continue
      const originalPath = path.resolve(item.originalPath)
      if (!isPathWithin(root, originalPath)) continue
      systemItems.set(item.noteId, originalPath)
    }
    return {
      notes: notes.filter(note => note && typeof note === 'object' && typeof note.id === 'string' && note.id),
      systemItems,
    }
  } catch (error) {
    if (error.code === 'ENOENT') return { notes: [], systemItems: new Map() }
    throw error
  }
}

function readNotesTrash(root) {
  return readNotesTrashState(root).notes
}

function writeNotesTrash(root, notes, systemItems = new Map()) {
  const directory = notesLibraryMetadataDirectory(root, true)
  const entries = systemItems instanceof Map ? [...systemItems].map(([noteId, originalPath]) => ({ noteId, originalPath })) : systemItems
  atomicWrite(path.join(directory, 'trash.yaml'), YAML.stringify({ version: 2, notes, systemItems: entries }, { lineWidth: 0 }), 'utf8')
}

let cachedWindowsUserSid
function getCurrentWindowsUserSid() {
  if (cachedWindowsUserSid !== undefined) return cachedWindowsUserSid
  const identity = spawnSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
  const match = identity.status === 0 ? String(identity.stdout || '').match(/S-1-\d+(?:-\d+)+/i) : null
  cachedWindowsUserSid = match ? match[0] : null
  return cachedWindowsUserSid
}

function scanSystemRecycleBin(volumeRoot) {
  if (process.platform !== 'win32') return { status: 'missing', items: new Map() }
  const userSid = getCurrentWindowsUserSid()
  if (!userSid) return { status: 'unavailable', items: new Map() }
  const recycleRoot = path.join(volumeRoot, '$Recycle.Bin')
  const directory = path.join(recycleRoot, userSid)
  let items
  try {
    // Inspect only the current Windows user's bin. Other SID directories may be
    // inaccessible and must not make an incomplete scan look authoritative.
    items = fs.readdirSync(directory, { withFileTypes: true }).filter(item => item.isFile() && item.name.startsWith('$I'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        fs.accessSync(volumeRoot, fs.constants.R_OK)
        return { status: 'available', items: new Map() }
      } catch { return { status: 'unavailable', items: new Map() } }
    }
    return { status: 'unavailable', items: new Map() }
  }
  const itemsByOriginalPath = new Map()
  let incomplete = false
  for (const item of items) {
    const infoPath = path.join(directory, item.name)
    try {
      const bytes = fs.readFileSync(infoPath)
      if (bytes.length < 28) { incomplete = true; continue }
      const pathLength = bytes.readUInt32LE(24)
      if (!pathLength || pathLength > 32767 || 28 + pathLength * 2 > bytes.length) { incomplete = true; continue }
      const pathStart = 28
      const pathEnd = pathStart + pathLength * 2
      const sourcePath = bytes.subarray(pathStart, pathEnd).toString('utf16le').replace(/\u0000+$/g, '')
      if (!path.isAbsolute(sourcePath)) { incomplete = true; continue }
      const payloadPath = path.join(directory, '$R' + item.name.slice(2))
      const key = noteFilePathKey(sourcePath)
      const match = { status: 'found', originalPath: path.resolve(sourcePath), infoPath, payloadPath, payloadExists: fs.existsSync(payloadPath) }
      const previous = itemsByOriginalPath.get(key)
      if (!previous || (!previous.payloadExists && match.payloadExists)) itemsByOriginalPath.set(key, match)
    } catch { incomplete = true }
  }
  return { status: incomplete ? 'unavailable' : 'available', items: itemsByOriginalPath }
}

function findSystemRecycleBinItem(originalPath, index = null) {
  if (process.platform !== 'win32') return { status: 'missing' }
  const expectedPath = path.resolve(originalPath)
  const scan = index || scanSystemRecycleBin(path.parse(expectedPath).root)
  return scan.items.get(noteFilePathKey(expectedPath)) || { status: scan.status === 'available' ? 'missing' : 'unavailable' }
}

function findSystemRecycleBinItemForNote(root, note, index = null) {
  if (process.platform !== 'win32') return { status: 'missing' }
  const folderPath = normalizeFolderPath(note.folderPath)
  const directory = path.resolve(root, ...folderPath.split('/').filter(Boolean))
  const titleBase = noteFilenameBase(note.title)
  const candidates = [
    ...Array.from({ length: 8 }, (_, index) => `${titleBase}${index ? ` (${index + 1})` : ''}.md`),
    `${encodeSegment(note.id)}.md`,
  ]
  for (const filename of candidates) {
    const originalPath = path.join(directory, filename)
    const item = findSystemRecycleBinItem(originalPath, index)
    if (item.status === 'found') return { ...item, originalPath }
  }
  return { status: index?.status === 'available' ? 'missing' : 'unavailable' }
}

function removeSystemRecycleBinItem(originalPath) {
  const item = findSystemRecycleBinItem(originalPath)
  if (item.status === 'unavailable') fail('无法读取系统回收站，笔记暂未彻底删除')
  if (item.status !== 'found') return false
  try {
    if (item.payloadExists) fs.rmSync(item.payloadPath, { recursive: true, force: true })
    fs.rmSync(item.infoPath, { force: true })
  } catch (error) {
    fail(`无法从系统回收站彻底删除笔记：${error.message || error}`)
  }
  return true
}

function reconcileNotesTrashWithSystem(root, activeEntries, state) {
  if (process.platform !== 'win32') return state.notes
  const activeIds = new Set(activeEntries.map(entry => entry.note.id))
  const remaining = []
  const systemItems = new Map(state.systemItems)
  const recycleBinIndex = scanSystemRecycleBin(path.parse(root).root)
  let changed = false
  for (const note of state.notes) {
    let originalPath = systemItems.get(note.id)
    let item = originalPath ? findSystemRecycleBinItem(originalPath, recycleBinIndex) : findSystemRecycleBinItemForNote(root, note, recycleBinIndex)
    if (!originalPath && item.status === 'found') {
      originalPath = item.originalPath
      systemItems.set(note.id, originalPath)
      changed = true
    }
    if (!originalPath) {
      if (item.status === 'unavailable') remaining.push(note)
      else changed = true
      continue
    }
    if (activeIds.has(note.id)) {
      if (item.status === 'found') {
        try { removeSystemRecycleBinItem(originalPath) }
        catch (error) {
          console.warn(`[笔记回收站] 恢复笔记后未能清理系统回收站副本：${originalPath}`, error.message || error)
          remaining.push(note)
          continue
        }
      } else if (item.status === 'unavailable') {
        remaining.push(note)
        continue
      }
      systemItems.delete(note.id)
      changed = true
      continue
    }
    if (item.status === 'unavailable' || (item.status === 'found' && item.payloadExists)) {
      remaining.push(note)
      continue
    }
    if (item.status === 'found') {
      try { fs.rmSync(item.infoPath, { force: true }) } catch {}
    }
    systemItems.delete(note.id)
    changed = true
  }
  if (changed) writeNotesTrash(root, remaining, systemItems)
  return remaining
}

function moveFileToSystemRecycleBin(filePath) {
  if (!fs.existsSync(filePath)) return
  let command
  let args
  if (process.platform === 'win32') {
    const encodedPath = Buffer.from(filePath, 'utf8').toString('base64')
    command = 'powershell.exe'
    const recycleScript = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$filePath = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'))
$source = @'
using System;
using System.Runtime.InteropServices;
public static class EsdRecycleFile {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct SHFILEOPSTRUCT {
        public IntPtr hwnd;
        public uint wFunc;
        [MarshalAs(UnmanagedType.LPWStr)] public string pFrom;
        [MarshalAs(UnmanagedType.LPWStr)] public string pTo;
        public ushort fFlags;
        [MarshalAs(UnmanagedType.Bool)] public bool fAnyOperationsAborted;
        public IntPtr hNameMappings;
        [MarshalAs(UnmanagedType.LPWStr)] public string lpszProgressTitle;
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int SHFileOperation(ref SHFILEOPSTRUCT operation);
}
'@
Add-Type -TypeDefinition $source -ErrorAction Stop
$operation = New-Object 'EsdRecycleFile+SHFILEOPSTRUCT'
$operation.wFunc = 3
$operation.pFrom = $filePath + [char]0 + [char]0
$operation.fFlags = 0x454
$result = [EsdRecycleFile]::SHFileOperation([ref]$operation)
if ($result -ne 0) { throw "系统回收站操作失败，错误码：$result" }
if ($operation.fAnyOperationsAborted) { throw '系统回收站操作已取消' }
if (Test-Path -LiteralPath $filePath) { throw '文件仍在原位置，未能移入系统回收站' }
`
    args = ['-NoProfile', '-NonInteractive', '-Command', `try { ${recycleScript}; exit 0 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`]
  } else if (process.platform === 'darwin') {
    const escaped = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    command = 'osascript'
    args = ['-e', `tell application "Finder" to delete POSIX file "${escaped}"`]
  } else {
    command = 'gio'
    args = ['trash', filePath]
  }
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 30000 })
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || String(result.stderr || '').trim()
    fail(`无法将笔记文件移入系统回收站${detail ? `：${detail}` : ''}`)
  }
}

function writeMetadata(scope, metadata) {
  writeMetadataToDirectory(mediaDirectory(scope), metadata)
}

function writeMetadataToDirectory(directory, metadata) {
  if (path.basename(path.dirname(directory)) === '.earth-survival-diary') {
    notesLibraryMetadataDirectory(path.dirname(path.dirname(directory)), true)
  }
  atomicWrite(path.join(directory, 'metadata.yaml'), YAML.stringify(metadata, { lineWidth: 0 }), 'utf8')
}

function assetFiles(scope, assetId) {
  return assetFilesInDirectory(mediaDirectory(scope), assetId)
}

function assetFilesInDirectory(directory, assetId) {
  try {
    return fs.readdirSync(directory).filter(name => name.startsWith(encodeSegment(assetId) + '.') && !name.includes('.tmp-'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

function readTagsAt(filePath) {
  try {
    const stat = fs.lstatSync(filePath)
    if (stat.isSymbolicLink() || !stat.isFile()) fail('笔记标签索引必须是普通文件')
    const value = YAML.parse(fs.readFileSync(filePath, 'utf8'))
    if (Array.isArray(value)) return { found: true, value }
    if (value && typeof value === 'object' && Array.isArray(value.tags)) return { found: true, value: value.tags }
    fail('笔记标签索引格式无效')
  } catch (error) {
    if (error.code === 'ENOENT') return { found: false, value: [] }
    throw error
  }
}

function readTags(scope) {
  const root = libraryRoot(scope)
  if (isUsableNotesLibraryRoot(root)) {
    const libraryPath = tagsPathInLibrary(root)
    let libraryTags = readTagsAt(libraryPath)
    const legacyTags = readTagsAt(legacyTagsPath(scope))
    const sourceTags = libraryTags.found ? libraryTags : legacyTags
    if (!sourceTags.found) return sourceTags

    const normalizedSourceTags = normalizeStoredTags(sourceTags.value)
    const normalizedLibraryTags = libraryTags.found ? normalizeStoredTags(libraryTags.value) : []
    const entries = collectNoteFilesFromRoot(root).entries
    const tagsById = new Map(normalizedSourceTags.map(tag => [String(tag.id), tag]))
    const needsFolderMigration = !libraryTags.found
      || sourceTags.value.some(tag => !tag || typeof tag !== 'object' || !Object.hasOwn(tag, 'folderPath') || normalizeFolderPath(tag.folderPath) !== tag.folderPath)
      || JSON.stringify(normalizedSourceTags) !== JSON.stringify(sourceTags.value)
      || entries.some(({ note }) => {
        const folderPath = normalizeFolderPath(note.folderPath)
        return (Array.isArray(note.tagIds) ? note.tagIds : []).some(id => {
          const tag = tagsById.get(String(id))
          return tag && normalizeFolderPath(tag.folderPath) !== folderPath
        })
      })

    if (needsFolderMigration) {
      migrateScopedTags(root, entries, normalizedSourceTags, normalizedLibraryTags)
      libraryTags = readTagsAt(libraryPath)
    } else {
      libraryTags = { found: true, value: normalizedLibraryTags }
    }

    // Once the library index is authoritative, remove its obsolete app-data copy.
    if (libraryTags.found && legacyTags.found) {
      try { fs.unlinkSync(legacyTagsPath(scope)) }
      catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    return libraryTags
  }
  return readTagsAt(legacyTagsPath(scope))
}

function normalizeStoredTags(tags) {
  if (!Array.isArray(tags)) fail('笔记标签列表无效')
  const normalized = tags.filter(tag => tag && typeof tag === 'object' && !Array.isArray(tag) && typeof tag.id === 'string' && typeof tag.name === 'string')
    .map(tag => ({ ...tag, folderPath: normalizeFolderPath(tag.folderPath) }))
  const ids = new Set()
  const names = new Set()
  for (const tag of normalized) {
    if (!tag.id || !tag.name.trim() || ids.has(tag.id)) fail('笔记标签编号无效或重复')
    const nameKey = `${tag.folderPath}\u0000${tag.name}`
    if (names.has(nameKey)) fail(`文件夹「${tag.folderPath || '笔记库根目录'}」中存在同名标签「${tag.name}」`)
    ids.add(tag.id)
    names.add(nameKey)
  }
  return normalized
}

function writeTagsAt(filePath, tags) {
  const normalized = normalizeStoredTags(tags)
  const parent = path.dirname(filePath)
  if (path.basename(parent) === '.earth-survival-diary') {
    const root = path.dirname(parent)
    notesLibraryMetadataDirectory(root, true)
  }
  atomicWrite(filePath, YAML.stringify(normalized, { lineWidth: 0 }), 'utf8')
}

function writeTags(scope, tags) {
  const root = libraryRoot(scope)
  const target = isUsableNotesLibraryRoot(root) ? tagsPathInLibrary(root) : legacyTagsPath(scope)
  writeTagsAt(target, tags)
}

function dataPath(key) {
  const { scope, dataKey } = splitKey(key)
  if (scope === 'global') {
    const parts = dataKey.split(':')
    if (parts.length !== 1) fail('全局账号键无效')
    return path.join(dataRoot, 'users', encodeSegment(parts[0]) + '.yaml')
  }
  const normalized = dataKey.replace(/\\/g, '/').replace(/\//g, ':')
  if (normalized === 'notes:categories') fail('笔记分类数据已停用')
  if (normalized === 'notes' || normalized === 'notes:notes') return path.join(dataRoot, encodeSegment(scope), 'notes')
  if (normalized.startsWith('notes:note:')) {
    const id = normalized.slice('notes:note:'.length)
    if (!id || id.length > 512) fail('本地笔记编号无效')
    return path.join(dataRoot, encodeSegment(scope), 'notes', encodeSegment(id) + '.md')
  }
  if (normalized === 'media:metadata') return metadataPath(scope)
  if (normalized.startsWith('media:asset:')) {
    const info = mediaInfo(key)
    if (info.isMeta) return path.join(mediaDirectory(scope), encodeSegment(info.assetId) + ':meta.yaml')
    return path.join(mediaDirectory(scope), encodeSegment(info.assetId) + '.bin')
  }
  const alias = ALIASES.get(normalized)
  const segments = alias || normalized.split(/[:/]/)
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) fail('本地数据键无效')
  const logical = MODULES.has(segments[0]) ? segments : ['system', ...segments]
  return path.join(dataRoot, encodeSegment(scope), ...logical.slice(0, -1).map(encodeSegment), encodeSegment(logical.at(-1)) + '.yaml')
}

function parseMarkdownNote(filePath, fallbackId) {
  const markdown = fs.readFileSync(filePath, 'utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)
  const id = fallbackId || decodeSegment(path.basename(filePath, '.md'))
  if (!match) {
    const timestamp = fs.statSync(filePath).mtime.toISOString()
    return { id, title: path.basename(filePath, '.md'), content: markdown, tagIds: [], pinned: false, trashedAt: null, createdAt: timestamp, updatedAt: timestamp }
  }
  const metadata = YAML.parse(match[1])
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('笔记 Markdown 元数据无效')
  return { ...metadata, id: String(metadata.id || id), content: markdown.slice(match[0].length) }
}

function serializeMarkdownNote(filePath, note, order) {
  if (!note || typeof note !== 'object' || Array.isArray(note)) fail('本地笔记内容无效')
  const metadata = { ...note }
  const content = typeof metadata.content === 'string' ? metadata.content : ''
  delete metadata.content
  if (metadata._storageOrder == null && Number.isFinite(order)) metadata._storageOrder = order
  atomicWrite(filePath, `---\n${YAML.stringify(metadata, { lineWidth: 0 })}---\n${content}`, 'utf8')
}

function noteFilenameBase(title) {
  let value = String(title || '新笔记').normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 140)
  if (!value) value = '新笔记'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) value = `_${value}`
  return value
}

function noteFilePathKey(filePath) {
  const resolved = path.resolve(filePath)
  return process.platform === 'win32' ? resolved.toLocaleLowerCase('en-US') : resolved
}

function titleBasedNoteFilePath(directory, note, previousPathById, previousPathOwners, allocatedPaths) {
  const oldPath = previousPathById.get(note.id)
  const base = noteFilenameBase(note.title)
  for (let suffix = 1; suffix < 10000; suffix++) {
    const filename = `${base}${suffix === 1 ? '' : ` (${suffix})`}.md`
    const candidate = path.join(directory, filename)
    const key = noteFilePathKey(candidate)
    const owner = previousPathOwners.get(key)
    const sameOldPath = !!oldPath && samePath(candidate, oldPath)
    if (allocatedPaths.has(key) || (owner && owner !== note.id)) continue
    if (fs.existsSync(candidate) && !sameOldPath) continue
    allocatedPaths.add(key)
    return candidate
  }
  fail(`无法为笔记「${note.title || note.id}」生成不重复的文件名`)
}

function collectNoteFilesFromRoot(root) {
  const entries = []
  const folders = new Set()
  const ids = new Set()
  if (!fs.existsSync(root)) return { entries, folders: [] }
  const rootStat = fs.lstatSync(root)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) fail('笔记库路径不是普通文件夹')
  const walk = (directory, folderPath = '') => {
    const items = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    for (const item of items) {
      if (item.isSymbolicLink()) continue
      if (item.isDirectory() && ['.git', 'node_modules', '.svn', '.hg', '.earth-survival-diary'].includes(item.name.toLowerCase())) continue
      const fullPath = path.join(directory, item.name)
      if (item.isDirectory()) {
        const childPath = folderPath ? `${folderPath}/${item.name}` : item.name
        normalizeFolderPath(childPath)
        folders.add(childPath)
        walk(fullPath, childPath)
        continue
      }
      if (!item.isFile() || !item.name.toLowerCase().endsWith('.md')) continue
      const relativeId = path.relative(root, fullPath).replace(/\\/g, '/').replace(/\.md$/i, '')
      const parsed = parseMarkdownNote(fullPath, relativeId)
      const id = String(parsed.id || '')
      if (!id || id.length > 512) fail(`笔记文件编号无效：${item.name}`)
      if (ids.has(id)) fail(`笔记库中存在重复编号「${id}」，请先处理重名文件`)
      ids.add(id)
      entries.push({ note: { ...parsed, folderPath }, filePath: fullPath })
    }
  }
  try {
    walk(root)
  } catch (error) {
    if (error.code === 'ENOENT') return { entries: [], folders: [] }
    throw error
  }
  return { entries, folders: [...folders].sort((a, b) => a.localeCompare(b, 'zh')) }
}

function collectLegacyNoteFiles(scope) {
  const directory = path.join(dataRoot, encodeSegment(scope), 'notes')
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter(item => item.isFile() && item.name.toLowerCase().endsWith('.md'))
      .map(item => {
        const filePath = path.join(directory, item.name)
        return { note: { ...parseMarkdownNote(filePath), folderPath: '' }, filePath }
      })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

function currentNoteFiles(scope) {
  const root = libraryRoot(scope)
  if (isUsableNotesLibraryRoot(root)) return collectNoteFilesFromRoot(root).entries
  return collectLegacyNoteFiles(scope)
}

function readNotes(scope) {
  const activeEntries = currentNoteFiles(scope)
  const activeNotes = activeEntries.map(entry => entry.note)
  const root = libraryRoot(scope)
  const trashState = isUsableNotesLibraryRoot(root) ? readNotesTrashState(root) : { notes: [], systemItems: new Map() }
  const trashedNotes = isUsableNotesLibraryRoot(root) ? reconcileNotesTrashWithSystem(root, activeEntries, trashState) : []
  const trashIds = new Set(trashedNotes.map(note => note.id))
  const notes = [...activeNotes.filter(note => !trashIds.has(note.id)), ...trashedNotes]
  return notes.sort((a, b) => Number(a._storageOrder ?? Infinity) - Number(b._storageOrder ?? Infinity) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

function collectMediaReferences(scope) {
  const references = new Set()
  for (const note of readNotes(scope)) {
    for (const match of String(note.content || '').matchAll(/esd-local-media:\/\/([a-z0-9_-]+)/gi)) references.add(match[1].toLowerCase())
  }
  return references
}

function pruneUnreferencedMedia(scope) {
  const references = collectMediaReferences(scope)
  const metadata = readMetadata(scope)
  let changed = false
  for (const assetId of Object.keys(metadata.assets)) {
    if (references.has(assetId.toLowerCase())) continue
    for (const filename of assetFiles(scope, assetId)) {
      try { fs.unlinkSync(path.join(mediaDirectory(scope), filename)) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    delete metadata.assets[assetId]
    changed = true
  }
  if (changed) writeMetadata(scope, metadata)
}

function writeNotes(scope, notes) {
  if (!Array.isArray(notes)) fail('本地笔记列表无效')
  const root = libraryRoot(scope)
  if (!root) fail('请先选择笔记库文件夹，再编辑或新建笔记')
  if (!isUsableNotesLibraryRoot(root)) fail('笔记库文件夹已不可用，请重新选择笔记库位置')
  const tagIndex = readTags(scope)
  const tags = normalizeStoredTags(tagIndex.value || [])
  const tagsById = new Map(tags.map(tag => [tag.id, tag]))
  const tagsByScopeName = new Map(tags.map(tag => [`${tag.folderPath}\u0000${tag.name}`, tag]))
  const previous = collectNoteFilesFromRoot(root).entries
  const previousPathById = new Map(previous.map(item => [item.note.id, item.filePath]))
  const previousPathOwners = new Map(previous.map(item => [noteFilePathKey(item.filePath), item.note.id]))
  const previousTrashState = readNotesTrashState(root)
  const previousTrashNotes = previousTrashState.notes
  const previousSystemItems = previousTrashState.systemItems
  const retained = new Set()
  const ids = new Set()
  const serializedNotes = []
  const trashNotes = []
  let tagsChanged = false
  notes.forEach((note, index) => {
    if (!note || typeof note.id !== 'string' || !note.id) fail('本地笔记编号无效')
    if (ids.has(note.id)) fail(`笔记列表中存在重复编号「${note.id}」`)
    ids.add(note.id)
    const folderPath = normalizeFolderPath(note.folderPath)
    if (note.tagIds != null && !Array.isArray(note.tagIds)) fail('笔记标签编号列表无效')
    const noteTagIds = []
    for (const rawTagId of Array.isArray(note.tagIds) ? note.tagIds : []) {
      const tagId = String(rawTagId)
      const sourceTag = tagsById.get(tagId)
      if (!sourceTag) fail(`笔记「${note.title || note.id}」引用了不存在的标签`)
      if (sourceTag.folderPath === folderPath) {
        if (!noteTagIds.includes(sourceTag.id)) noteTagIds.push(sourceTag.id)
        continue
      }
      const nameKey = `${folderPath}\u0000${sourceTag.name}`
      let destinationTag = tagsByScopeName.get(nameKey)
      if (!destinationTag) {
        let destinationId = `tag_${Date.now()}${crypto.randomBytes(4).toString('hex')}`
        while (tagsById.has(destinationId)) destinationId = `tag_${Date.now()}${crypto.randomBytes(4).toString('hex')}`
        destinationTag = { ...sourceTag, id: destinationId, folderPath, order: tags.filter(tag => tag.folderPath === folderPath).length }
        tags.push(destinationTag)
        tagsById.set(destinationId, destinationTag)
        tagsByScopeName.set(nameKey, destinationTag)
        tagsChanged = true
      }
      if (!noteTagIds.includes(destinationTag.id)) noteTagIds.push(destinationTag.id)
    }
    const normalizedNote = { ...note, folderPath, tagIds: noteTagIds }
    if (normalizedNote.trashedAt) trashNotes.push(normalizedNote)
    else serializedNotes.push({ note: normalizedNote, index })
  })
  if (tagsChanged) writeTags(scope, tags)
  const allocatedPaths = new Set()
  for (const { note, index } of serializedNotes) {
    const directory = resolveLibraryDirectory(root, note.folderPath, true)
    const filePath = titleBasedNoteFilePath(directory, note, previousPathById, previousPathOwners, allocatedPaths)
    retained.add(path.resolve(filePath))
    serializeMarkdownNote(filePath, note, index)
  }
  const trashedIds = new Set(trashNotes.map(note => note.id))
  const previousTrashIds = new Set(previousTrashNotes.map(note => note.id))
  const nextSystemItems = new Map([...previousSystemItems].filter(([noteId]) => trashedIds.has(noteId)))
  for (const item of previous) {
    if (trashedIds.has(item.note.id) && !nextSystemItems.has(item.note.id)) nextSystemItems.set(item.note.id, item.filePath)
  }
  for (const [noteId, originalPath] of previousSystemItems) {
    if (trashedIds.has(noteId)) continue
    removeSystemRecycleBinItem(originalPath)
    nextSystemItems.delete(noteId)
  }
  writeNotesTrash(root, trashNotes, nextSystemItems)
  const movedToSystemTrash = new Set()
  for (const item of previous) {
    if (retained.has(path.resolve(item.filePath))) continue
    if (trashedIds.has(item.note.id)) {
      // A previously archived note may still have a physical Markdown file
      // after an earlier recycle-bin failure. Keep its manifest snapshot and
      // make a best-effort cleanup so an unrelated create/duplicate operation
      // cannot fail because of this stale file.
      if (previousTrashIds.has(item.note.id)) {
        try {
          moveFileToSystemRecycleBin(item.filePath)
          movedToSystemTrash.add(item.note.id)
          nextSystemItems.set(item.note.id, item.filePath)
        } catch (error) {
          console.warn(`[笔记回收站] 归档文件仍在磁盘上，稍后可再次清理：${item.filePath}`, error.message || error)
        }
        continue
      }
      try {
        moveFileToSystemRecycleBin(item.filePath)
        movedToSystemTrash.add(item.note.id)
        nextSystemItems.set(item.note.id, item.filePath)
      } catch (error) {
        // If the OS recycle operation fails, keep successful prior moves in the
        // app trash manifest while restoring failed entries to their on-disk
        // active files. This avoids reporting a failed soft-delete while the
        // manifest silently hides a still-present Markdown file.
        const recoverableTrash = [
          ...previousTrashNotes,
          ...trashNotes.filter(note => movedToSystemTrash.has(note.id) && !previousTrashIds.has(note.id)),
        ]
        const recoverableIds = new Set(recoverableTrash.map(note => note.id))
        const recoverableSystemItems = new Map([...nextSystemItems].filter(([noteId]) => recoverableIds.has(noteId)))
        try { writeNotesTrash(root, recoverableTrash, recoverableSystemItems) } catch {}
        throw error
      }
    } else fs.unlinkSync(item.filePath)
  }
  writeNotesTrash(root, trashNotes, nextSystemItems)
  pruneUnreferencedMedia(scope)
}

function findPdfBrowserExecutable() {
  const configured = [process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_PATH, process.env.ESD_CHROME_PATH]
    .filter(Boolean)
    .map(value => String(value).replace(/^"|"$/g, ''))
  const candidates = process.platform === 'win32'
    ? [
      ...configured,
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]
    : [
      ...configured,
      '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]
  return candidates.find(candidate => fs.existsSync(candidate)) || null
}

async function exportNotesPdf(title, html, settings = {}) {
  const executablePath = findPdfBrowserExecutable()
  if (!executablePath) fail('找不到可用于生成 PDF 的 Chrome 或 Edge，请安装浏览器或设置 CHROME_PATH')
  const puppeteer = require('puppeteer-core')
  const downloads = path.join(process.env.USERPROFILE || os.homedir(), 'Downloads')
  fs.mkdirSync(downloads, { recursive: true })
  const safeName = String(title || '笔记').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 160) || '笔记'
  let outputPath = path.join(downloads, `${safeName}.pdf`)
  let index = 2
  while (fs.existsSync(outputPath)) outputPath = path.join(downloads, `${safeName} (${index++}).pdf`)
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(15000)
    await page.setContent(String(html || ''), { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.evaluate(async () => {
      await Promise.race([document.fonts?.ready || Promise.resolve(), new Promise(resolve => setTimeout(resolve, 5000))])
      await Promise.all(Array.from(document.images).map(image => image.complete
        ? Promise.resolve()
        : new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
          setTimeout(resolve, 5000)
        })))
    })
    const margin = Math.max(0, Math.min(40, Number(settings.margin) || 0))
    const scale = Math.max(0.6, Math.min(1.2, (Number(settings.scale) || 100) / 100))
    const format = ['A4', 'Letter', 'Legal'].includes(String(settings.pageSize)) ? String(settings.pageSize) : 'Letter'
    await page.pdf({
      path: outputPath,
      format,
      landscape: !!settings.landscape,
      printBackground: true,
      scale,
      margin: { top: `${margin}mm`, right: `${margin}mm`, bottom: `${margin}mm`, left: `${margin}mm` },
    })
    return outputPath
  } finally {
    await browser.close()
  }
}

function validateNoteScope(scope) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope || '')) fail('本地用户 ID 无效')
}

function chooseNotesLibraryFolder() {
  if (process.platform !== 'win32') return Promise.reject(new Error('当前系统暂不支持后端文件夹选择器'))
  const script = [
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$dialog.Description = "选择笔记库文件夹"',
    '$dialog.ShowNewFolderButton = $true',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($dialog.SelectedPath)) }',
  ].join('; ')
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => {
      if (code !== 0) return reject(new Error(stderr.trim() || '无法打开系统文件夹选择器'))
      const encoded = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) || ''
      if (!encoded) return resolve(null)
      try { resolve(Buffer.from(encoded, 'base64').toString('utf8')) }
      catch { reject(new Error('系统文件夹选择器返回了无效路径')) }
    })
  })
}

function notesLibraryInfo(scope) {
  validateNoteScope(scope)
  const config = readNotesLibraryConfig(scope)
  const activeLibrary = config?.libraries.find(library => library.id === config.activeId) || null
  const rootPath = activeLibrary ? assertNotesLibraryRoot(activeLibrary.rootPath) : null
  const rootExists = isUsableNotesLibraryRoot(rootPath)
  let collection = rootExists ? collectNoteFilesFromRoot(rootPath) : { entries: [], folders: [] }
  if (rootExists) {
    const storedNotes = readNotes(scope)
    const activeNotes = storedNotes.filter(note => !note.trashedAt)
    const previousPathById = new Map(collection.entries.map(item => [item.note.id, item.filePath]))
    const previousPathOwners = new Map(collection.entries.map(item => [noteFilePathKey(item.filePath), item.note.id]))
    const allocatedPaths = new Set()
    const currentPathById = new Map(collection.entries.map(item => [item.note.id, item.filePath]))
    const needsFilenameMigration = activeNotes.some(note => {
      const directory = resolveLibraryDirectory(rootPath, normalizeFolderPath(note.folderPath), true)
      const expectedPath = titleBasedNoteFilePath(directory, note, previousPathById, previousPathOwners, allocatedPaths)
      const currentPath = currentPathById.get(note.id)
      return !currentPath || !samePath(expectedPath, currentPath)
    })
    if (needsFilenameMigration) {
      writeNotes(scope, storedNotes)
      collection = collectNoteFilesFromRoot(rootPath)
    }
  }
  return {
    configured: !!activeLibrary,
    activeLibraryId: activeLibrary?.id || null,
    rootPath,
    rootExists,
    noteCount: collection.entries.length,
    folders: collection.folders,
    libraries: (config?.libraries || []).map(library => ({
      id: library.id,
      name: library.name,
      rootPath: library.rootPath,
      rootExists: isUsableNotesLibraryRoot(library.rootPath),
    })),
    legacyNoteCount: collectLegacyNoteFiles(scope).length,
  }
}

function samePath(left, right) {
  const a = path.resolve(left)
  const b = path.resolve(right)
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

function migrateLegacyDataIntoActiveLibrary(scope) {
  const root = libraryRoot(scope)
  if (!isUsableNotesLibraryRoot(root)) return
  // 旧版本把标签和媒体留在 app-data；归入当前库后再允许切换到其他库。
  readTags(scope)
  mediaDirectory(scope)
}

function comparableNote(note) {
  const { _storageOrder, folderPath, ...fields } = note
  return JSON.stringify(fields)
}

function generatedTagId(usedIds) {
  let id = ''
  do { id = 'tag_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16) } while (usedIds.has(id))
  usedIds.add(id)
  return id
}

function migrateScopedTags(root, entries, sourceTagsValue, destinationTagsValue) {
  const sourceTags = normalizeStoredTags(sourceTagsValue)
  const tags = normalizeStoredTags(destinationTagsValue)
  const sourceById = new Map(sourceTags.map(tag => [tag.id, tag]))
  const usedIds = new Set(tags.map(tag => tag.id))
  const usedSourceIds = new Set()

  const findDestinationTag = (folderPath, name) => tags.find(tag => tag.folderPath === folderPath && tag.name === name)
  const ensureDestinationTag = (sourceTag, folderPath) => {
    const existing = findDestinationTag(folderPath, sourceTag.name)
    if (existing) return existing
    const id = usedIds.has(sourceTag.id) ? generatedTagId(usedIds) : (usedIds.add(sourceTag.id), sourceTag.id)
    const tag = { ...sourceTag, id, folderPath, order: tags.filter(item => item.folderPath === folderPath).length }
    tags.push(tag)
    return tag
  }

  for (const entry of entries) {
    const folderPath = normalizeFolderPath(entry.note.folderPath)
    const nextTagIds = []
    for (const oldId of Array.isArray(entry.note.tagIds) ? entry.note.tagIds.map(String) : []) {
      const existing = tags.find(tag => tag.id === oldId && tag.folderPath === folderPath)
      if (existing) {
        nextTagIds.push(existing.id)
        continue
      }
      const sourceTag = sourceById.get(oldId)
      if (!sourceTag) {
        console.warn(`[笔记库] 笔记「${entry.note.title || entry.note.id}」引用了不存在的标签 ${oldId}，已从标签索引中忽略`)
        continue
      }
      usedSourceIds.add(oldId)
      nextTagIds.push(ensureDestinationTag(sourceTag, folderPath).id)
    }
    if (JSON.stringify(nextTagIds) !== JSON.stringify(entry.note.tagIds || [])) {
      entry.note = { ...entry.note, folderPath, tagIds: nextTagIds }
      serializeMarkdownNote(entry.filePath, entry.note)
    }
  }

  // 保留尚未贴到笔记上的旧标签，默认归入笔记库根目录。
  for (const sourceTag of sourceTags) {
    if (usedSourceIds.has(sourceTag.id)) continue
    const folderPath = sourceTag.folderPath || ''
    ensureDestinationTag(sourceTag, folderPath)
  }
  writeTagsAt(tagsPathInLibrary(root), tags)
}

function migrateMediaDirectory(sourceDirectory, destinationDirectory) {
  if (samePath(sourceDirectory, destinationDirectory)) return
  let files = []
  try { files = fs.readdirSync(sourceDirectory, { withFileTypes: true }) }
  catch (error) { if (error.code === 'ENOENT') return; throw error }
  if (path.basename(path.dirname(destinationDirectory)) === '.earth-survival-diary') {
    notesLibraryMetadataDirectory(path.dirname(path.dirname(destinationDirectory)), true)
  }
  try {
    const stat = fs.lstatSync(destinationDirectory)
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('笔记库媒体目录必须是普通文件夹')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    fs.mkdirSync(destinationDirectory)
  }
  for (const entry of files) {
    if (!entry.isFile() || entry.name === 'metadata.yaml' || entry.name.includes('.tmp-')) continue
    const source = path.join(sourceDirectory, entry.name)
    const destination = path.join(destinationDirectory, entry.name)
    if (fs.existsSync(destination)) {
      if (!fs.readFileSync(source).equals(fs.readFileSync(destination))) fail(`目标笔记库存在冲突的媒体文件「${entry.name}」`)
      continue
    }
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL)
  }

  const sourceMetadata = readMetadataFromDirectory(sourceDirectory)
  const destinationMetadata = readMetadataFromDirectory(destinationDirectory)
  const assets = { ...sourceMetadata.assets, ...destinationMetadata.assets }
  writeMetadataToDirectory(destinationDirectory, { version: 1, assets })
}

function removeManagedMediaDirectory(directory) {
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.includes('.tmp')) continue
      fs.rmSync(path.join(directory, entry.name), { recursive: true, force: true })
    }
    if (fs.readdirSync(directory).length === 0) fs.rmdirSync(directory)
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`[笔记库] 旧媒体目录未能清理：${directory}（${error.message}）`)
  }
}

async function selectNotesLibraryFolder(scope) {
  validateNoteScope(scope)
  const selected = await chooseNotesLibraryFolder()
  if (!selected) return null
  let root = path.resolve(selected)
  try { root = fs.realpathSync(root) } catch (error) { if (error.code !== 'ENOENT') throw error }
  root = assertNotesLibraryRoot(root)
  if (!fs.existsSync(root)) fail('所选笔记库文件夹不存在')
  const rootStat = fs.lstatSync(root)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) fail('请选择普通文件夹作为笔记库')

  const config = readNotesLibraryConfig(scope)
  if (config) {
    migrateLegacyDataIntoActiveLibrary(scope)
    const existingLibrary = config.libraries.find(library => samePath(library.rootPath, root))
    if (existingLibrary) {
      config.activeId = existingLibrary.id
      writeNotesLibraryConfig(scope, config)
      console.info(`[笔记库] 已切换到笔记库：${root}`)
      return notesLibraryInfo(scope)
    }
    if (config.libraries.some(library => pathsOverlap(library.rootPath, root))) {
      fail('笔记库不能相互嵌套；请选择与现有笔记库分开的文件夹')
    }
    const library = createNotesLibraryEntry(root)
    config.libraries.push(library)
    config.activeId = library.id
    writeNotesLibraryConfig(scope, config)
    console.info(`[笔记库] 已添加并切换到笔记库：${root}`)
    return notesLibraryInfo(scope)
  }

  const sourceById = new Map()
  for (const entry of [...currentNoteFiles(scope), ...collectLegacyNoteFiles(scope)]) {
    const existing = sourceById.get(entry.note.id)
    if (existing && comparableNote(existing.note) !== comparableNote(entry.note)) fail(`旧笔记位置存在编号冲突「${entry.note.title || entry.note.id}」，请先处理重复文件`)
    if (!existing) sourceById.set(entry.note.id, entry)
  }
  const source = [...sourceById.values()]
  const sourceTags = readTags(scope)
  const destination = collectNoteFilesFromRoot(root)
  const destinationById = new Map(destination.entries.map(entry => [entry.note.id, entry.note]))
  const createdTargets = []
  const library = createNotesLibraryEntry(root)
  const targetMediaDirectory = path.join(notesLibraryMetadataDirectory(root), 'media')
  const sourceMediaDirectories = [...new Set([mediaDirectory(scope), legacyMediaDirectory(scope)])]
  try {
    for (const entry of source) {
      const note = { ...entry.note, folderPath: normalizeFolderPath(entry.note.folderPath) }
      const existing = destinationById.get(note.id)
      if (existing) {
        if (comparableNote(existing) !== comparableNote(note)) fail(`目标笔记库已存在同编号但内容不同的笔记「${note.title || note.id}」；原笔记未迁移，请选择空文件夹或先处理冲突`)
        continue
      }
      const folder = resolveLibraryDirectory(root, note.folderPath, true)
      const target = path.join(folder, encodeSegment(note.id) + '.md')
      serializeMarkdownNote(target, note)
      createdTargets.push(target)
      destinationById.set(note.id, note)
    }
    for (const sourceDirectory of sourceMediaDirectories) migrateMediaDirectory(sourceDirectory, targetMediaDirectory)
    const destinationEntries = collectNoteFilesFromRoot(root).entries
    const destinationTags = readTagsAt(tagsPathInLibrary(root))
    migrateScopedTags(root, destinationEntries, sourceTags.found ? sourceTags.value : [], destinationTags.found ? destinationTags.value : [])
    writeNotesLibraryConfig(scope, { libraries: [library], activeId: library.id })
  } catch (error) {
    for (const target of createdTargets) {
      try { fs.unlinkSync(target) } catch {}
    }
    throw error
  }

  for (const entry of source) {
    if (samePath(path.dirname(entry.filePath), root) || isPathWithin(root, entry.filePath)) continue
    try { fs.unlinkSync(entry.filePath) }
    catch (error) { if (error.code !== 'ENOENT') console.warn(`[笔记库] 旧笔记副本未能清理：${entry.filePath}（${error.message}）`) }
  }
  for (const oldTagsPath of [legacyTagsPath(scope)]) {
    if (samePath(oldTagsPath, tagsPathInLibrary(root))) continue
    try { fs.unlinkSync(oldTagsPath) } catch (error) { if (error.code !== 'ENOENT') console.warn(`[笔记库] 旧标签索引未能清理：${oldTagsPath}（${error.message}）`) }
  }
  for (const oldMediaDirectory of sourceMediaDirectories) {
    if (samePath(oldMediaDirectory, targetMediaDirectory)) continue
    removeManagedMediaDirectory(oldMediaDirectory)
  }
  pruneUnreferencedMedia(scope)
  console.info(`[笔记库] 已创建首个笔记库：${root}，迁入旧笔记 ${source.length} 篇`)
  return notesLibraryInfo(scope)
}

function switchNotesLibrary(scope, libraryId) {
  validateNoteScope(scope)
  if (typeof libraryId !== 'string' || !libraryId) fail('笔记库编号无效')
  const config = readNotesLibraryConfig(scope)
  const target = config?.libraries.find(library => library.id === libraryId)
  if (!config || !target) fail('找不到要切换的笔记库')
  if (!isUsableNotesLibraryRoot(target.rootPath)) fail(`笔记库文件夹不可用：${target.rootPath}`)
  migrateLegacyDataIntoActiveLibrary(scope)
  config.activeId = target.id
  writeNotesLibraryConfig(scope, config)
  console.info(`[笔记库] 已切换到笔记库：${target.rootPath}`)
  return notesLibraryInfo(scope)
}

function removeUnavailableNotesLibrary(scope, libraryId) {
  validateNoteScope(scope)
  if (typeof libraryId !== 'string' || !libraryId) fail('笔记库编号无效')
  const config = readNotesLibraryConfig(scope)
  const target = config?.libraries.find(library => library.id === libraryId)
  if (!config || !target) fail('找不到要移除的笔记库')
  if (isUsableNotesLibraryRoot(target.rootPath)) fail('该笔记库仍可用，请先切换到其他笔记库')

  config.libraries = config.libraries.filter(library => library.id !== libraryId)
  if (config.activeId === libraryId
    || !config.libraries.some(library => library.id === config.activeId && isUsableNotesLibraryRoot(library.rootPath))) {
    config.activeId = config.libraries.find(library => isUsableNotesLibraryRoot(library.rootPath))?.id || null
  }
  writeNotesLibraryConfig(scope, config)
  console.info('[笔记库] 已从列表移除不可用笔记库：' + target.rootPath)
  return notesLibraryInfo(scope)
}

function createNotesFolder(scope, folderPath) {
  validateNoteScope(scope)
  const root = libraryRoot(scope)
  if (!root) fail('请先选择笔记库文件夹')
  if (!isUsableNotesLibraryRoot(root)) fail('笔记库文件夹已不可用，请重新选择笔记库位置')
  const normalized = normalizeFolderPath(folderPath)
  if (!normalized) fail('文件夹名称不能为空')
  if (fs.existsSync(resolveLibraryDirectory(root, normalized))) fail('文件夹已存在')
  resolveLibraryDirectory(root, normalized, true)
  return notesLibraryInfo(scope)
}

function renameNotesFolder(scope, oldPath, newPath) {
  validateNoteScope(scope)
  const root = libraryRoot(scope)
  if (!root) fail('请先选择笔记库文件夹')
  if (!isUsableNotesLibraryRoot(root)) fail('笔记库文件夹已不可用，请重新选择笔记库位置')
  const from = normalizeFolderPath(oldPath)
  const to = normalizeFolderPath(newPath)
  if (!from || !to || from === to) fail('文件夹路径无效')
  const source = resolveLibraryDirectory(root, from)
  const target = resolveLibraryDirectory(root, to)
  if (isPathWithin(source, target) && !samePath(source, target)) fail('不能把文件夹移入自身子文件夹')
  if (!fs.existsSync(source)) fail('文件夹不存在')
  const sameLocation = samePath(source, target)
  if (!sameLocation && fs.existsSync(target)) fail('目标文件夹已存在')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (sameLocation) {
    const temporary = path.join(path.dirname(source), `.notes-folder-rename-${crypto.randomUUID()}`)
    fs.renameSync(source, temporary)
    try { fs.renameSync(temporary, target) }
    catch (error) { try { fs.renameSync(temporary, source) } catch {}; throw error }
  } else fs.renameSync(source, target)
  const tagIndex = readTags(scope)
  if (tagIndex.found) {
    const tags = tagIndex.value.map(tag => {
      const folderPath = normalizeFolderPath(tag.folderPath)
      if (folderPath !== from && !folderPath.startsWith(from + '/')) return tag
      const suffix = folderPath.slice(from.length).replace(/^\//, '')
      return { ...tag, folderPath: suffix ? `${to}/${suffix}` : to }
    })
    writeTags(scope, tags)
  }
  const config = readNotesLibraryConfig(scope)
  const libraryId = config?.libraries.find(item => samePath(item.rootPath, root))?.id
  if (libraryId) {
    const favorites = readFavoriteFolderPaths(scope, libraryId)
    const remapped = favorites.map(folderPath => folderPath === from || folderPath.startsWith(from + '/')
      ? to + folderPath.slice(from.length)
      : folderPath)
    if (JSON.stringify(remapped) !== JSON.stringify(favorites)) writeFavoriteFolderPaths(scope, libraryId, remapped)
  }
  const trashState = readNotesTrashState(root)
  const trashedNotes = trashState.notes
  const remappedTrash = trashedNotes.map(note => {
    const folderPath = normalizeFolderPath(note.folderPath)
    return folderPath === from || folderPath.startsWith(from + '/')
      ? { ...note, folderPath: to + folderPath.slice(from.length) }
      : note
  })
  if (JSON.stringify(remappedTrash) !== JSON.stringify(trashedNotes)) writeNotesTrash(root, remappedTrash, trashState.systemItems)
  writeNotes(scope, readNotes(scope))
  return notesLibraryInfo(scope)
}

function duplicateNotesFolder(scope, sourcePath, targetPath) {
  validateNoteScope(scope)
  const root = libraryRoot(scope)
  if (!root) fail('请先选择笔记库文件夹')
  if (!isUsableNotesLibraryRoot(root)) fail('笔记库文件夹已不可用，请重新选择笔记库位置')
  const from = normalizeFolderPath(sourcePath)
  const to = normalizeFolderPath(targetPath)
  if (!from || !to || from === to) fail('文件夹路径无效')
  const sourceDirectory = resolveLibraryDirectory(root, from)
  const targetDirectory = resolveLibraryDirectory(root, to)
  if (!fs.existsSync(sourceDirectory)) fail('文件夹不存在')
  if (isPathWithin(sourceDirectory, targetDirectory)) fail('不能把文件夹副本创建到源文件夹内部')
  if (fs.existsSync(targetDirectory)) fail('目标文件夹已存在')

  const tagIndex = normalizeStoredTags(readTags(scope).value || [])
  const collection = collectNoteFilesFromRoot(root)
  const sourceEntries = collection.entries.filter(({ note }) => note.folderPath === from || note.folderPath.startsWith(from + '/'))
  const sourceFolders = collection.folders.filter(folder => folder === from || folder.startsWith(from + '/'))
  const sourceTags = tagIndex.filter(tag => tag.folderPath === from || tag.folderPath.startsWith(from + '/'))
  const usedTagIds = new Set(tagIndex.map(tag => tag.id))
  const tagIdMap = new Map()
  const mapFolder = folderPath => to + folderPath.slice(from.length)
  const clonedTags = sourceTags.map(tag => {
    let id = ''
    do { id = 'tag_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16) } while (usedTagIds.has(id))
    usedTagIds.add(id)
    tagIdMap.set(tag.id, id)
    return { ...tag, id, folderPath: mapFolder(tag.folderPath), order: tag.order }
  })
  const clonedNotes = sourceEntries.map(({ note }) => ({
    ...note,
    id: crypto.randomUUID(),
    folderPath: mapFolder(note.folderPath),
    tagIds: (note.tagIds || []).map(id => tagIdMap.get(id)).filter(id => !!id),
    pinned: false,
    _storageOrder: undefined,
  }))
  const existingNotes = readNotes(scope)
  const originalTags = tagIndex
  try {
    fs.mkdirSync(targetDirectory, { recursive: true })
    for (const folder of sourceFolders) resolveLibraryDirectory(root, mapFolder(folder), true)
    writeTags(scope, [...tagIndex, ...clonedTags])
    writeNotes(scope, [...existingNotes, ...clonedNotes])
  } catch (error) {
    try { writeTags(scope, originalTags) } catch {}
    try { fs.rmSync(targetDirectory, { recursive: true, force: true }) } catch {}
    throw error
  }
  return notesLibraryInfo(scope)
}

function resolveActiveLibraryPath(scope, relativePath) {
  validateNoteScope(scope)
  const root = libraryRoot(scope)
  if (!root || !isUsableNotesLibraryRoot(root)) fail('笔记库文件夹不可用')
  if (typeof relativePath !== 'string' || relativePath.length > 2048 || path.isAbsolute(relativePath)) fail('笔记库相对路径无效')
  const normalized = relativePath.replace(/\\/g, '/')
  const target = path.resolve(root, ...normalized.split('/').filter(Boolean))
  if (!isPathWithin(root, target)) fail('文件路径超出笔记库')
  let current = root
  for (const segment of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    const stat = fs.lstatSync(current)
    if (stat.isSymbolicLink()) fail('笔记库不能通过符号链接访问文件')
  }
  return target
}

function getNoteLibraryNotePath(scope, noteId) {
  validateNoteScope(scope)
  const root = libraryRoot(scope)
  if (!root || !isUsableNotesLibraryRoot(root)) fail('笔记库文件夹不可用')
  const id = String(noteId || '')
  const entry = collectNoteFilesFromRoot(root).entries.find(item => item.note.id === id)
  if (!entry) fail('笔记文件不存在或已移入回收站', 404)
  return path.relative(root, entry.filePath).replace(/\\/g, '/')
}

function launchPath(pathValue, reveal = false) {
  const target = path.resolve(pathValue)
  const stat = fs.statSync(target)
  if (process.platform === 'win32') {
    const command = path.join(process.env.WINDIR || 'C:\\Windows', 'explorer.exe')
    const args = reveal
      ? stat.isDirectory() ? [target] : ['/select,', target]
      : [target]
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    return new Promise((resolve, reject) => {
      child.once('error', error => reject(new Error(`无法${reveal ? '在系统资源管理器中显示' : '使用默认应用打开'}：${error.message}`)))
      child.once('spawn', () => { child.unref(); resolve(true) })
    })
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = reveal && !stat.isDirectory() && process.platform === 'darwin'
    ? ['-R', target]
    : [reveal && !stat.isDirectory() ? path.dirname(target) : target]
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('spawn', () => { child.unref(); resolve(true) })
  })
}

function deleteNotesFolder(scope, folderPath) {
  validateNoteScope(scope)
  const root = libraryRoot(scope)
  if (!root) fail('请先选择笔记库文件夹')
  if (!isUsableNotesLibraryRoot(root)) fail('笔记库文件夹已不可用，请重新选择笔记库位置')
  const normalized = normalizeFolderPath(folderPath)
  if (!normalized) fail('不能删除笔记库根文件夹')
  if (readNotes(scope).some(note => note.folderPath === normalized || note.folderPath.startsWith(normalized + '/'))) fail('文件夹中还有笔记，请先移动或删除其中的笔记')
  const directory = resolveLibraryDirectory(root, normalized)
  try { fs.rmdirSync(directory) }
  catch (error) {
    if (error.code === 'ENOENT') fail('文件夹不存在')
    if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') fail('文件夹中还有子文件或子文件夹，请先清理')
    throw error
  }
  const config = readNotesLibraryConfig(scope)
  const libraryId = config?.libraries.find(item => samePath(item.rootPath, root))?.id
  if (libraryId) {
    const favorites = readFavoriteFolderPaths(scope, libraryId)
    const next = favorites.filter(item => item !== normalized && !item.startsWith(normalized + '/'))
    if (next.length !== favorites.length) writeFavoriteFolderPaths(scope, libraryId, next)
  }
  const tagIndex = readTags(scope)
  if (tagIndex.found) {
    writeTags(scope, tagIndex.value.filter(tag => {
      const tagFolder = normalizeFolderPath(tag.folderPath)
      return tagFolder !== normalized && !tagFolder.startsWith(normalized + '/')
    }))
  }
  return notesLibraryInfo(scope)
}

function detectMime(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg'
  if (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12)
    if (brand.startsWith('M4A') || brand.startsWith('M4B')) return 'audio/mp4'
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    return 'video/mp4'
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return 'video/x-matroska'
  if (buffer.toString('ascii', 0, 4) === 'OggS') return 'audio/ogg'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav'
  if (buffer.toString('ascii', 0, 3) === 'ID3' || (buffer[0] === 255 && (buffer[1] & 224) === 224)) return 'audio/mpeg'
  return ''
}

function getAssetPath(scope, assetId) {
  const meta = readMetadata(scope).assets[assetId]
  const extension = MIME_EXTENSIONS[String(meta?.mimeType || '').toLowerCase()]
  const names = assetFiles(scope, assetId)
  const selected = extension ? names.find(name => name.endsWith('.' + extension)) : names[0]
  if (!selected) return null
  return path.join(mediaDirectory(scope), selected)
}

function writeAsset(scope, assetId, value) {
  if (typeof value !== 'string' || !value.trim()) fail('本地媒体数据无效')
  const base64 = value.replace(/^data:[^,]+,/, '').replace(/\s+/g, '')
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length || buffer.length > 512 * 1024 * 1024) fail('本地媒体文件大小无效')
  const metadata = readMetadata(scope)
  const mimeType = metadata.assets[assetId]?.mimeType || detectMime(buffer)
  const extension = MIME_EXTENSIONS[mimeType]
  if (!extension) fail('无法识别本地媒体格式')
  const directory = mediaDirectory(scope)
  fs.mkdirSync(directory, { recursive: true })
  for (const filename of assetFiles(scope, assetId)) {
    if (filename !== `${encodeSegment(assetId)}.${extension}`) fs.unlinkSync(path.join(directory, filename))
  }
  atomicWrite(path.join(directory, `${encodeSegment(assetId)}.${extension}`), buffer)
  metadata.assets[assetId] = { ...metadata.assets[assetId], mimeType }
  writeMetadata(scope, metadata)
}

function readData(key) {
  const info = mediaInfo(key)
  if (info) {
    const metadata = readMetadata(info.scope)
    if (info.isMeta) return metadata.assets[info.assetId] ? { found: true, value: metadata.assets[info.assetId] } : { found: false }
    const filePath = getAssetPath(info.scope, info.assetId)
    return filePath ? { found: true, value: fs.readFileSync(filePath).toString('base64') } : { found: false }
  }
  const { scope, dataKey } = splitKey(key)
  if (scope !== 'global' && (dataKey === 'notes' || dataKey === 'notes:notes')) return { found: true, value: readNotes(scope) }
  if (scope !== 'global' && dataKey === 'notes:tags') return readTags(scope)
  if (scope !== 'global' && dataKey.startsWith('notes:note:')) {
    const id = dataKey.slice('notes:note:'.length)
    const note = readNotes(scope).find(entry => entry.id === id)
    return note ? { found: true, value: note } : { found: false }
  }
  const filePath = dataPath(key)
  try { return { found: true, value: YAML.parse(fs.readFileSync(filePath, 'utf8')) } }
  catch (error) { if (error.code === 'ENOENT') return { found: false }; throw error }
}

function writeData(key, value) {
  const info = mediaInfo(key)
  if (info) {
    if (info.isMeta) return true
    writeAsset(info.scope, info.assetId, value)
    return true
  }
  const { scope, dataKey } = splitKey(key)
  if (scope !== 'global' && (dataKey === 'notes' || dataKey === 'notes:notes')) {
    writeNotes(scope, value)
    return true
  }
  if (scope !== 'global' && dataKey === 'notes:tags') {
    writeTags(scope, value)
    return true
  }
  if (scope !== 'global' && dataKey.startsWith('notes:note:')) {
    const id = dataKey.slice('notes:note:'.length)
    const notes = readNotes(scope)
    const next = notes.filter(note => note.id !== id)
    next.push({ ...value, id })
    writeNotes(scope, next)
    return true
  }
  const serialized = YAML.stringify(value, { lineWidth: 0 })
  if (serialized === undefined) fail('本地 YAML 数据无法序列化')
  atomicWrite(dataPath(key), serialized, 'utf8')
  return true
}

function removeData(key) {
  const info = mediaInfo(key)
  if (info) {
    if (!info.isMeta) for (const filename of assetFiles(info.scope, info.assetId)) fs.unlinkSync(path.join(mediaDirectory(info.scope), filename))
    const metadata = readMetadata(info.scope)
    delete metadata.assets[info.assetId]
    writeMetadata(info.scope, metadata)
    return true
  }
  const { scope, dataKey } = splitKey(key)
  if (scope !== 'global' && (dataKey === 'notes' || dataKey === 'notes:notes')) {
    const root = libraryRoot(scope)
    const files = root && fs.existsSync(root) ? collectNoteFilesFromRoot(root).entries : collectLegacyNoteFiles(scope)
    for (const entry of files) fs.unlinkSync(entry.filePath)
    if (isUsableNotesLibraryRoot(root)) {
      try { fs.unlinkSync(notesTrashManifestPath(root)) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    pruneUnreferencedMedia(scope)
    return true
  }
  if (scope !== 'global' && dataKey === 'notes:tags') {
    const root = libraryRoot(scope)
    const target = isUsableNotesLibraryRoot(root) ? tagsPathInLibrary(root) : legacyTagsPath(scope)
    try { fs.unlinkSync(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
    return true
  }
  if (scope !== 'global' && dataKey.startsWith('notes:note:')) {
    const id = dataKey.slice('notes:note:'.length)
    writeNotes(scope, readNotes(scope).filter(note => note.id !== id))
    return true
  }
  const filePath = dataPath(key)
  try { fs.unlinkSync(filePath) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (scope !== 'global' && dataKey.startsWith('notes:note:')) pruneUnreferencedMedia(scope)
  return true
}

function collectRecords(scope) {
  const base = path.join(dataRoot, scope === 'global' ? 'users' : encodeSegment(scope))
  const output = []
  const walk = directory => {
    let entries = []
    try { entries = fs.readdirSync(directory, { withFileTypes: true }) } catch (error) { if (error.code === 'ENOENT') return; throw error }
    for (const entry of entries) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase()
      if (ext !== '.yaml' && ext !== '.md') continue
      const relative = path.relative(base, full).split(path.sep).map(segment => segment.replace(/\.ya?ml$|\.md$/i, '')).map(decodeSegment)
      if (ext === '.md') output.push({ key: `${scope}:notes:note:${relative.at(-1)}`, value: parseMarkdownNote(full) })
      else {
        const value = YAML.parse(fs.readFileSync(full, 'utf8'))
        const dataKey = scope === 'global' ? relative.join(':') : relative.join(':')
        if (scope !== 'global' && dataKey === 'notes:tags') continue
        output.push({ key: `${scope}:${dataKey}`, value })
      }
    }
  }
  walk(base)
  if (scope !== 'global') {
    const root = libraryRoot(scope)
    if (root && fs.existsSync(root)) {
      for (const note of readNotes(scope)) output.push({ key: `${scope}:notes:note:${note.id}`, value: note })
    }
    const tags = readTags(scope)
    if (tags.found) output.push({ key: `${scope}:notes:tags`, value: tags.value })
    const metadata = readMetadata(scope)
    for (const [assetId, entry] of Object.entries(metadata.assets)) {
      const filePath = getAssetPath(scope, assetId)
      if (filePath) output.push({ key: `${scope}:media:asset:${assetId}`, value: fs.readFileSync(filePath).toString('base64') })
    }
  }
  return output
}

function userDataFromScope(scope) {
  if (scope === 'global') return path.join(dataRoot, 'users')
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope)) fail('本地用户 ID 无效')
  return path.join(dataRoot, encodeSegment(scope))
}

function assertAllowedPath(target) {
  if (typeof target !== 'string' || !path.isAbsolute(target)) fail('文件路径无效')
  const resolved = path.resolve(target)
  const roots = [dataRoot, logsRoot, pluginsRoot].map(root => path.resolve(root))
  if (!roots.some(root => resolved === root || resolved.startsWith(root + path.sep))) fail('文件访问超出应用数据目录', 403)
  return resolved
}

function mimeForFile(filePath) {
  return MIME_BY_EXT[path.extname(filePath).slice(1).toLowerCase()] || 'application/octet-stream'
}

async function appendRequestToFile(req, filePath, maxBytes = 512 * 1024 * 1024) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  let size = 0
  const stream = fs.createWriteStream(filePath, { flags: 'w' })
  await new Promise((resolve, reject) => {
    req.on('data', chunk => {
      size += chunk.length
      if (size > maxBytes) { stream.destroy(new Error('媒体文件不能超过 512 MB')); req.destroy(); return }
    })
    req.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)
    req.on('error', reject)
  })
  if (!size) fail('本地媒体文件为空')
  return size
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex').slice(0, 32)))
  })
}

async function saveUploadFile(temporaryPath, scope, mimeType, fileName) {
  const extension = MIME_EXTENSIONS[mimeType]
  if (!extension) fail(`不支持的本地媒体类型：${mimeType}`)
  const assetId = await hashFile(temporaryPath)
  const directory = mediaDirectory(scope)
  fs.mkdirSync(directory, { recursive: true })
  const target = path.join(directory, `${encodeSegment(assetId)}.${extension}`)
  if (fs.existsSync(target)) fs.unlinkSync(temporaryPath)
  else {
    try { fs.renameSync(temporaryPath, target) }
    catch (error) {
      if (error.code !== 'EXDEV') throw error
      fs.copyFileSync(temporaryPath, target, fs.constants.COPYFILE_EXCL)
      fs.unlinkSync(temporaryPath)
    }
  }
  for (const old of assetFiles(scope, assetId)) if (old !== path.basename(target)) fs.unlinkSync(path.join(directory, old))
  const metadata = readMetadata(scope)
  metadata.assets[assetId] = { mimeType, ...(metadata.assets[assetId]?.fileName ? {} : fileName ? { fileName: String(fileName).slice(0, 240) } : {}) }
  writeMetadata(scope, metadata)
  return `esd-local-media://${assetId}`
}

async function mediaRoute(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/__esd/media/save') {
    const scope = url.searchParams.get('scope') || ''
    const mimeType = (url.searchParams.get('mimeType') || '').toLowerCase()
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope) || !MIME_EXTENSIONS[mimeType]) fail('媒体保存参数无效')
    const temporary = path.join(mediaDirectory(scope), `.upload-${crypto.randomUUID()}.tmp`)
    await appendRequestToFile(req, temporary)
    try { return sendJson(res, 200, { reference: await saveUploadFile(temporary, scope, mimeType, url.searchParams.get('fileName') || '') }) }
    catch (error) { try { fs.unlinkSync(temporary) } catch {}; throw error }
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    const scope = url.searchParams.get('scope') || ''
    const assetId = url.searchParams.get('assetId') || ''
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope) || !/^[A-Za-z0-9_-]{1,128}$/.test(assetId)) fail('媒体资源不存在', 404)
    const filePath = getAssetPath(scope, assetId)
    if (!filePath) fail('媒体资源不存在', 404)
    const stat = fs.statSync(filePath)
    const mimeType = readMetadata(scope).assets[assetId]?.mimeType || mimeForFile(filePath)
    let start = 0
    let end = stat.size - 1
    let status = 200
    const rangeHeader = req.headers.range
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
      if (!match || (!match[1] && !match[2])) fail('媒体区间无效', 416)
      if (!match[1]) start = Math.max(0, stat.size - Number(match[2]))
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])) }
      if (start > end || start >= stat.size) fail('媒体区间无效', 416)
      status = 206
    }
    res.statusCode = status
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('Content-Length', String(end - start + 1))
    if (status === 206) res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(filePath, { start, end }).pipe(res)
    return
  }
  fail('Method Not Allowed', 405)
}

async function uploadRoute(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/__esd/upload/begin') {
    const { options = {} } = await readJson(req, 1024 * 1024)
    if (options.mode !== 'asset' || !/^[A-Za-z0-9_-]{1,128}$/.test(options.scope || '') || !MIME_EXTENSIONS[String(options.mimeType || '').toLowerCase()]) fail('媒体上传参数无效')
    const uploadId = crypto.randomUUID()
    const directory = mediaDirectory(options.scope)
    fs.mkdirSync(directory, { recursive: true })
    const temporaryPath = path.join(directory, `.upload-${uploadId}.tmp`)
    fs.closeSync(fs.openSync(temporaryPath, 'w'))
    uploads.set(uploadId, { scope: options.scope, mimeType: String(options.mimeType).toLowerCase(), fileName: String(options.fileName || ''), temporaryPath, size: 0 })
    return sendJson(res, 200, { uploadId })
  }
  const match = /^\/__esd\/upload\/(chunk|finish|cancel)\/([A-Za-z0-9-]+)$/.exec(url.pathname)
  if (!match) return false
  const [, action, uploadId] = match
  const upload = uploads.get(uploadId)
  if (!upload) fail('媒体上传已过期，请重新选择文件', 404)
  if (req.method !== 'POST') fail('Method Not Allowed', 405)
  if (action === 'chunk') {
    let size = 0
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(upload.temporaryPath, { flags: 'a' })
      req.on('data', chunk => { size += chunk.length; if (upload.size + size > 512 * 1024 * 1024) output.destroy(new Error('媒体文件不能超过 512 MB')) })
      req.pipe(output)
      output.on('finish', resolve)
      output.on('error', reject)
      req.on('error', reject)
    })
    upload.size += size
    return sendJson(res, 200, { loaded: upload.size })
  }
  uploads.delete(uploadId)
  if (action === 'cancel') {
    try { fs.unlinkSync(upload.temporaryPath) } catch {}
    return sendJson(res, 200, { ok: true })
  }
  try {
    const reference = await saveUploadFile(upload.temporaryPath, upload.scope, upload.mimeType, upload.fileName)
    return sendJson(res, 200, { uploadId, reference })
  } catch (error) {
    try { fs.unlinkSync(upload.temporaryPath) } catch {}
    throw error
  }
}

async function invoke(method, args) {
  switch (method) {
    case 'local-data-read': return readData(args[0])
    case 'local-data-write': return await enqueueWrite(() => writeData(args[0], args[1]))
    case 'local-data-remove': return await enqueueWrite(() => removeData(args[0]))
    case 'local-data-list': {
      const prefix = String(args[0] || '')
      if (!prefix.endsWith(':')) fail('本地数据前缀无效')
      const scope = prefix.slice(0, -1)
      return collectRecords(scope).filter(record => record.key.startsWith(prefix))
    }
    case 'local-data-list-keys': {
      const prefix = String(args[0] || '')
      if (!prefix.endsWith(':')) fail('本地数据前缀无效')
      const scope = prefix.slice(0, -1)
      return collectRecords(scope).map(record => record.key).filter(key => key.startsWith(prefix))
    }
    case 'notes-library-info': return notesLibraryInfo(String(args[0] || ''))
    case 'read-pinned-note-tab-ids': return readPinnedNoteTabIds(String(args[0] || ''), args[1])
    case 'write-pinned-note-tab-ids': return await enqueueWrite(() => writePinnedNoteTabIds(String(args[0] || ''), args[1], args[2]))
    case 'read-favorite-note-folder-paths': return readFavoriteFolderPaths(String(args[0] || ''), args[1])
    case 'write-favorite-note-folder-paths': return await enqueueWrite(() => writeFavoriteFolderPaths(String(args[0] || ''), args[1], args[2]))
    case 'select-notes-library-folder': return await enqueueWrite(() => selectNotesLibraryFolder(String(args[0] || '')))
    case 'switch-notes-library': return await enqueueWrite(() => switchNotesLibrary(String(args[0] || ''), args[1]))
    case 'remove-unavailable-notes-library': return await enqueueWrite(() => removeUnavailableNotesLibrary(String(args[0] || ''), args[1]))
    case 'create-notes-folder': return await enqueueWrite(() => createNotesFolder(String(args[0] || ''), args[1]))
    case 'rename-notes-folder': return await enqueueWrite(() => renameNotesFolder(String(args[0] || ''), args[1], args[2]))
    case 'duplicate-notes-folder': return await enqueueWrite(() => duplicateNotesFolder(String(args[0] || ''), args[1], args[2]))
    case 'delete-notes-folder': return await enqueueWrite(() => deleteNotesFolder(String(args[0] || ''), args[1]))
    case 'open-note-library-path': return launchPath(resolveActiveLibraryPath(String(args[0] || ''), args[1]))
    case 'reveal-note-library-path': return launchPath(resolveActiveLibraryPath(String(args[0] || ''), args[1]), true)
    case 'get-note-library-note-path': return getNoteLibraryNotePath(String(args[0] || ''), args[1])
    case 'export-note-pdf': return await exportNotesPdf(args[0], args[1], args[2])
    case 'update-local-media-asset-metadata': {
      const [scope, assetId, patch] = args
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(assetId || '')) fail('本地媒体数据键无效')
      return await enqueueWrite(() => {
        const metadata = readMetadata(scope)
        if (patch === null) delete metadata.assets[assetId]
        else {
          const mimeType = String(patch?.mimeType || metadata.assets[assetId]?.mimeType || '').toLowerCase()
          if (!MIME_EXTENSIONS[mimeType]) fail(`不支持的本地媒体类型：${mimeType}`)
          const fileName = String(patch?.fileName || metadata.assets[assetId]?.fileName || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 240)
          metadata.assets[assetId] = { mimeType, ...(fileName ? { fileName } : {}) }
          const extension = MIME_EXTENSIONS[mimeType]
          const directory = mediaDirectory(scope)
          const oldFile = assetFiles(scope, assetId).map(name => path.join(directory, name)).find(candidate => path.extname(candidate).slice(1).toLowerCase() !== extension)
          if (oldFile) {
            const target = path.join(directory, `${encodeSegment(assetId)}.${extension}`)
            if (fs.existsSync(target)) fs.unlinkSync(oldFile)
            else fs.renameSync(oldFile, target)
          }
        }
        writeMetadata(scope, metadata)
        return metadata
      })
    }
    case 'get-local-media-asset-url': return `/__esd/media?scope=${encodeURIComponent(args[0])}&assetId=${encodeURIComponent(args[1])}`
    case 'save-picked-media-file': fail('媒体文件应通过本机媒体上传接口保存')
    case 'get-screen-info': return { width: 1920, height: 1080, scaleFactor: 1, physicalWidth: 1920, physicalHeight: 1080 }
    case 'get-window-size': return null
    case 'set-window-size': case 'apply-window-size': case 'set-auto-launch': case 'set-close-action': case 'set-window-title': return false
    case 'get-auto-launch': return false
    case 'get-close-action': return 'exit'
    case 'get-log-dir-path': fs.mkdirSync(logsRoot, { recursive: true }); return logsRoot
    case 'get-plugins-dir-path': fs.mkdirSync(pluginsRoot, { recursive: true }); return pluginsRoot
    case 'read-file': case 'read-text-file-path': return fs.readFileSync(assertAllowedPath(args[0]), 'utf8')
    case 'write-file': atomicWrite(assertAllowedPath(args[0]), String(args[1] ?? ''), 'utf8'); return true
    case 'read-binary-file': return fs.readFileSync(assertAllowedPath(args[0])).toString('base64')
    case 'write-binary-file': {
      const value = args[1]
      const bytes = typeof value === 'string' ? Buffer.from(value, 'base64') : Buffer.from(value || [])
      atomicWrite(assertAllowedPath(args[0]), bytes)
      return true
    }
    case 'ensure-directory': fs.mkdirSync(assertAllowedPath(args[0]), { recursive: true }); return true
    case 'stat-file': {
      try { const stat = fs.statSync(assertAllowedPath(args[0])); return { exists: true, size: stat.size, mtimeMs: stat.mtimeMs, isDirectory: stat.isDirectory() } }
      catch (error) { if (error.code === 'ENOENT') return { exists: false, size: 0, mtimeMs: 0, isDirectory: false }; throw error }
    }
    case 'path-exists': return fs.existsSync(assertAllowedPath(args[0]))
    case 'read-directory': case 'list-directory-for-picker': {
      const directory = assertAllowedPath(args[0] || logsRoot)
      const entries = fs.readdirSync(directory, { withFileTypes: true }).map(item => {
        const full = path.join(directory, item.name)
        let size = 0; try { size = fs.statSync(full).size } catch {}
        return { name: item.name, path: full, isDirectory: item.isDirectory(), size }
      })
      return method === 'list-directory-for-picker' ? { ok: true, parent: path.dirname(directory), entries } : entries
    }
    case 'get-picker-roots': return []
    case 'delete-file-path': { const target = assertAllowedPath(args[0]); fs.unlinkSync(target); return true }
    case 'rename-file-path': fs.renameSync(assertAllowedPath(args[0]), assertAllowedPath(args[1])); return true
    case 'create-directory': fs.mkdirSync(assertAllowedPath(args[0]), { recursive: true }); return true
    case 'remove-directory': fs.rmSync(assertAllowedPath(args[0]), { recursive: true, force: true }); return true
    case 'get-log-file-size': {
      fs.mkdirSync(logsRoot, { recursive: true })
      const files = fs.readdirSync(logsRoot, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.log')).map(entry => path.join(logsRoot, entry.name))
      const latest = files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
      return latest ? { exists: true, size: fs.statSync(latest).size } : { exists: false, size: 0 }
    }
    case 'get-log-dir-size': {
      let size = 0
      try { for (const entry of fs.readdirSync(logsRoot, { withFileTypes: true })) if (entry.isFile()) size += fs.statSync(path.join(logsRoot, entry.name)).size } catch {}
      return { size }
    }
    case 'get-log-content': {
      try { return fs.readdirSync(logsRoot, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.log')).map(entry => path.join(logsRoot, entry.name)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).map(filePath => fs.readFileSync(filePath, 'utf8')).join('\n') }
      catch (error) { if (error.code === 'ENOENT') return ''; throw error }
    }
    case 'clear-logs': {
      try { for (const entry of fs.readdirSync(logsRoot, { withFileTypes: true })) if (entry.isFile() && entry.name.endsWith('.log')) fs.unlinkSync(path.join(logsRoot, entry.name)) } catch (error) { if (error.code !== 'ENOENT') throw error }
      return true
    }
    case 'open-log-viewer': case 'open-changelog-window': case 'restart-app': case 'resize-window': return true
    case 'write-renderer-logs': return true
    case 'get-system-fonts': return []
    case 'http-get-text': {
      const response = await fetch(String(args[0] || ''), { signal: AbortSignal.timeout(15000) })
      return { status: response.status, text: await response.text() }
    }
    case 'get-runtime-plugin-manifests': {
      fs.mkdirSync(pluginsRoot, { recursive: true })
      const manifests = []
      for (const entry of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const pluginDirectory = path.join(pluginsRoot, entry.name)
        const manifestPath = path.join(pluginDirectory, 'plugin.json')
        if (!fs.existsSync(manifestPath)) continue
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
          if (typeof manifest.id !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(manifest.id)) continue
          const distDirectory = path.join(pluginDirectory, 'dist')
          const markerPath = path.join(distDirectory, '.compiled')
          let needsCompile = !fs.existsSync(markerPath)
          if (!needsCompile && fs.statSync(manifestPath).mtimeMs > fs.statSync(markerPath).mtimeMs) needsCompile = true
          if (!needsCompile) {
            for (const toolId of Object.keys(manifest.tools || {})) {
              const outputPath = path.join(distDirectory, `${toolId}.js`)
              if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) { needsCompile = true; break }
            }
          }
          if (needsCompile) {
            await compilePlugin(pluginDirectory, distDirectory)
            fs.writeFileSync(markerPath, 'browser-local-plugin-v1', 'utf8')
          }
          manifests.push({ ...manifest, _source: 'remote' })
        } catch (error) {
          console.error(`[插件] 读取 ${entry.name} 清单失败：${error.message}`)
        }
      }
      return manifests
    }
    case 'get-runtime-plugin-source': {
      const [pluginId, toolId] = args.map(value => String(value || ''))
      if (!/^[A-Za-z0-9_.-]+$/.test(pluginId) || !/^[A-Za-z0-9_.-]+$/.test(toolId)) fail('无效的插件标识')
      const pluginDirectory = path.resolve(pluginsRoot, pluginId)
      if (!pluginDirectory.startsWith(path.resolve(pluginsRoot) + path.sep)) fail('插件路径无效', 403)
      const manifestPath = path.join(pluginDirectory, 'plugin.json')
      if (!fs.existsSync(manifestPath)) fail('插件组件不存在', 404)
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (manifest.id !== pluginId || !Object.prototype.hasOwnProperty.call(manifest.tools || {}, toolId)) fail('插件组件不存在', 404)
      const sourcePath = path.join(pluginDirectory, 'dist', `${toolId}.js`)
      if (!sourcePath.startsWith(path.join(pluginDirectory, 'dist') + path.sep) || !fs.existsSync(sourcePath)) fail('插件组件尚未编译', 404)
      return fs.readFileSync(sourcePath, 'utf8')
    }
    case 'recompile-plugins': {
      try {
        fs.mkdirSync(pluginsRoot, { recursive: true })
        for (const entry of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          const pluginDirectory = path.join(pluginsRoot, entry.name)
          if (!fs.existsSync(path.join(pluginDirectory, 'plugin.json'))) continue
          await compilePlugin(pluginDirectory, path.join(pluginDirectory, 'dist'))
        }
        return true
      } catch (error) {
        console.error(`[插件] 重新编译失败：${error.message}`)
        return false
      }
    }
    case 'get-reminder-persist-duration': return { persistDuration: null }
    case 'get-all-reminders': return []
    case 'cancel-all-reminders': return { ok: true }
    case 'open-external': return true
    case 'download-update': case 'check-for-update': return { ok: false, error: '浏览器运行时由当前网页版本提供更新' }
    case 'save-file-dialog': case 'open-file-dialog': case 'open-directory': return null
    case 'exec-powershell': case 'kill-powershell': return { success: false, code: -1, error: '浏览器运行版不提供终端命令执行' }
    default: fail(`本机服务不支持操作：${method}`, 404)
  }
}

function enqueueWrite(operation) {
  const next = writeQueue.current.catch(() => {}).then(operation)
  writeQueue.current = next.then(() => undefined, () => undefined)
  return next
}

export function createBrowserServiceMiddleware() {
  return (req, res, next) => {
    if (!req.url?.startsWith('/__esd/')) return next()
    if (req.method === 'POST' && !isTrustedLocalRequest(req)) return sendJson(res, 403, { error: '仅允许本机应用页面访问数据服务' })
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname === '/__esd/media') {
      mediaRoute(req, res, url).catch(error => {
        if (!res.headersSent) sendJson(res, error.status || 500, { error: error.message || String(error) })
        else res.destroy(error)
      })
      return
    }
    if (url.pathname.startsWith('/__esd/upload/')) {
      uploadRoute(req, res, url).then(result => { if (result === false && !res.writableEnded) next() }).catch(error => {
        if (!res.headersSent) sendJson(res, error.status || 500, { error: error.message || String(error) })
        else res.destroy(error)
      })
      return
    }
    if (url.pathname === '/__esd/media/save') {
      mediaRoute(req, res, url).catch(error => {
        if (!res.headersSent) sendJson(res, error.status || 500, { error: error.message || String(error) })
        else res.destroy(error)
      })
      return
    }
    if (url.pathname !== '/__esd/api' || req.method !== 'POST') return next()
    readJson(req).then(async payload => {
      try {
        const value = await invoke(String(payload.method || ''), Array.isArray(payload.args) ? payload.args : [])
        sendJson(res, 200, { value })
      } catch (error) {
        sendJson(res, error.status || 500, { error: error.message || String(error) })
      }
    }).catch(error => sendJson(res, error.status || 400, { error: error.message || String(error) }))
  }
}

export function isTrustedLocalRequest(req) {
  const origin = req.headers?.origin
  const host = req.headers?.host
  if (typeof origin !== 'string' || typeof host !== 'string') return false
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:'
      && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
      && parsed.host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}
