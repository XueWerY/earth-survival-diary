// 业务数据、图片和视频媒体均保存在本机应用数据目录。
import { deleteData as deleteRemoteData, deleteRemoteNote, fetchNotes, getData as getRemoteData, setData as setRemoteData, createRemoteNote, updateRemoteNote } from '../lib/api'
import { logger } from '../lib/logger'
import { hydrateMediaPayload } from './localDataStore'

const cache = new Map<string, any>()
const pendingRequests = new Map<string, Promise<any>>()
let cacheGeneration = 0

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

function cacheKey(type: string, key: string): string {
  return `${getAuthToken() || 'anonymous'}::${type}/${key}`
}

export async function getData<T>(type: string, key: string): Promise<T | null> {
  const ck = cacheKey(type, key)
  if (cache.has(ck)) {
    return cache.get(ck) as T
  }

  if (pendingRequests.has(ck)) {
    return pendingRequests.get(ck) as Promise<T | null>
  }

  const token = getAuthToken()
  const requestGeneration = cacheGeneration

  let promise: Promise<T | null>
  promise = (async () => {
    try {
      const result = await getRemoteData<T>(`${encodeURIComponent(type)}/${encodeURIComponent(key)}`)
      if (pendingRequests.get(ck) === promise) pendingRequests.delete(ck)
      if (requestGeneration !== cacheGeneration || token !== getAuthToken()) return null
      if (result.success) {
        cache.set(ck, result.data)
        return result.data as T | null
      }
      return null
    } catch (err) {
      if (pendingRequests.get(ck) === promise) pendingRequests.delete(ck)
      logger.error(`[Storage] 本地读取失败：${type}/${key}`, { error: err instanceof Error ? err.message : String(err) })
      return null
    }
  })()

  pendingRequests.set(ck, promise)
  return promise
}

export async function setData<T>(type: string, key: string, data: T): Promise<boolean> {
  const ck = cacheKey(type, key)
  const requestGeneration = cacheGeneration
  const token = getAuthToken()
  try {
    const result = await setRemoteData(`${encodeURIComponent(type)}/${encodeURIComponent(key)}`, data)
    if (!result.success) throw new Error('本地保存未成功')
    if (requestGeneration === cacheGeneration && token === getAuthToken()) {
      cache.set(ck, data)
    }
    return true
  } catch (err) {
    cache.delete(ck)
    logger.error(`[Storage] 本地保存失败：${type}/${key}`, { error: err instanceof Error ? err.message : String(err) })
    return false
  }
}

export async function deleteData(type: string, key: string): Promise<boolean> {
  const ck = cacheKey(type, key)
  cache.delete(ck)
  try {
    const result = await deleteRemoteData(`${encodeURIComponent(type)}/${encodeURIComponent(key)}`)
    return !!result.success
  } catch (err) {
    logger.error(`[Storage] 删除本地数据失败：${type}/${key}`, { error: err instanceof Error ? err.message : String(err) })
    return false
  }
}

export function clearCache() {
  cacheGeneration++
  cache.clear()
  pendingRequests.clear()
}

// ============ 笔记：本地记录读写 ============

export interface NoteRecord {
  id: string
  title: string
  content: string
  tagIds: string[]
  pinned: boolean
  trashedAt: string | null
  createdAt: string
  updatedAt: string
}

export function normalizeNoteRecord(raw: any): NoteRecord {
  const now = new Date().toISOString()
  const r = raw || {}
  return {
    id: r.id ? String(r.id) : Date.now().toString() + Math.random().toString(36).slice(2, 8),
    title: r.title !== undefined ? String(r.title) : '新笔记',
    content: r.content !== undefined ? String(r.content) : '',
    tagIds: Array.isArray(r.tagIds) ? r.tagIds.map(String) : [],
    pinned: !!r.pinned,
    trashedAt: r.trashedAt || null,
    createdAt: r.createdAt || now,
    updatedAt: r.updatedAt || now
  }
}

async function loadLocalNotes(): Promise<{ notes: NoteRecord[]; ready: boolean }> {
  try {
    const result = await fetchNotes()
    if (!result.success || !Array.isArray(result.notes)) return { notes: [], ready: false }
    const notes = await Promise.all(result.notes.map(async note => normalizeNoteRecord(await hydrateMediaPayload(note))))
    return { notes, ready: true }
  } catch (err) {
    logger.error('[Storage] 本地读取笔记失败', { error: err instanceof Error ? err.message : String(err) })
    return { notes: [], ready: false }
  }
}

export async function listNotes(): Promise<NoteRecord[]> {
  return (await loadLocalNotes()).notes
}

export async function createNote(payload: Partial<NoteRecord>): Promise<NoteRecord | null> {
  const loaded = await loadLocalNotes()
  if (!loaded.ready) return null
  const note = normalizeNoteRecord({ ...payload, id: payload.id || Date.now().toString() + Math.random().toString(36).slice(2, 8) })
  try {
    const result = await createRemoteNote(note)
    return result.success && result.note ? normalizeNoteRecord(result.note) : null
  } catch (error) {
    logger.error('[Storage] 本地新增笔记失败', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

export async function patchNote(id: string, patch: Partial<NoteRecord>): Promise<NoteRecord | null> {
  const loaded = await loadLocalNotes()
  if (!loaded.ready) return null
  try {
    const result = await updateRemoteNote(id, { ...patch, updatedAt: new Date().toISOString() })
    return result.success && result.note ? normalizeNoteRecord(result.note) : null
  } catch (error) {
    logger.error('[Storage] 本地更新笔记失败', { id, error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

export async function deleteNoteById(id: string): Promise<boolean> {
  const loaded = await loadLocalNotes()
  if (!loaded.ready) return false
  try {
    return !!(await deleteRemoteNote(id)).success
  } catch (error) {
    logger.error('[Storage] 本地删除笔记失败', { id, error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

export function preloadData(type: string, key: string, data: any) {
  cache.set(cacheKey(type, key), data)
}

// ============ 统一的 SystemState 管理 ============

export interface SystemState {
  date?: Record<string, any>
  countdown?: Record<string, any>
  list?: Record<string, any>
  notes?: Record<string, any>
  focusTimer?: Record<string, any> | null
  currentPage?: string
  statsActiveTab?: string
  guideCompleted?: boolean
  guideLastIndex?: number
  version?: string
  defaultsInitialized?: boolean
  navCollapsed?: boolean
}

async function loadSystemState(): Promise<SystemState> {
  const state = await getData<SystemState>('system', 'state')
  return state || {}
}

async function saveSystemState(state: SystemState): Promise<boolean> {
  cache.set(cacheKey('system', 'state'), state)
  return setData('system', 'state', state)
}

export async function getSystemStateField<K extends keyof SystemState>(field: K): Promise<SystemState[K]> {
  const state = await loadSystemState()
  return state[field]
}

export async function setSystemStateField<K extends keyof SystemState>(field: K, value: SystemState[K]): Promise<boolean> {
  const state = await loadSystemState()
  state[field] = value
  return saveSystemState(state)
}

export async function deleteSystemStateField<K extends keyof SystemState>(field: K): Promise<boolean> {
  const state = await loadSystemState()
  delete state[field]
  return saveSystemState(state)
}
