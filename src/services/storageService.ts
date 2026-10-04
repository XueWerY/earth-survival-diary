// 统一数据存储服务 - 通过云端 API 读写用户数据
import { getApiBaseUrl, getApiServerUrl, hydrateApiConfig } from '../lib/apiBase'

const cache = new Map<string, any>()
const pendingRequests = new Map<string, Promise<any>>()

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAuthToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function cacheKey(type: string, key: string): string {
  return `${getApiServerUrl() || 'local'}::${getAuthToken() || 'anonymous'}::${type}/${key}`
}

export async function getData<T>(type: string, key: string): Promise<T | null> {
  await hydrateApiConfig()
  const ck = cacheKey(type, key)
  if (cache.has(ck)) {
    return cache.get(ck) as T
  }

  if (pendingRequests.has(ck)) {
    return pendingRequests.get(ck) as Promise<T | null>
  }

  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const promise = fetch(`${getApiBaseUrl()}/data/${type}/${key}`, { headers })
      .then(res => res.json())
      .then(result => {
        pendingRequests.delete(ck)
        if (result.success) {
          cache.set(ck, result.data)
          return result.data as T | null
        }
        return null
      })
      .catch(err => {
        pendingRequests.delete(ck)
        console.error(`Failed to get data for ${type}/${key}:`, err)
        return null
      })

  pendingRequests.set(ck, promise)
  return promise
}

export async function setData<T>(type: string, key: string, data: T): Promise<boolean> {
  await hydrateApiConfig()
  const ck = cacheKey(type, key)
  cache.set(ck, data)

  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/data/${type}/${key}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data })
    })
    const result = await res.json()
    return result.success
  } catch (err) {
    console.error(`Failed to set data for ${type}/${key}:`, err)
    return false
  }
}

export async function deleteData(type: string, key: string): Promise<boolean> {
  await hydrateApiConfig()
  const ck = cacheKey(type, key)
  cache.delete(ck)

  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/data/${type}/${key}`, {
      method: 'DELETE',
      headers
    })
    const result = await res.json()
    return result.success
  } catch (err) {
    console.error(`Failed to delete data for ${type}/${key}:`, err)
    return false
  }
}

export function clearCache() {
  cache.clear()
}

// ============ 笔记：单条记录级读写 ============
// 笔记不再走「整份数组读-改-写」：桌面端有两处写入方（主窗口与全局捕获窗口），
// 整份写回会让后写者抹掉先写者的新增/修改，因此改为服务端记录级端点 /api/notes。

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

export async function listNotes(): Promise<NoteRecord[]> {
  await hydrateApiConfig()
  try {
    const res = await fetch(`${getApiBaseUrl()}/notes`, { headers: authHeaders() })
    const result = await res.json()
    if (!result.success || !Array.isArray(result.notes)) return []
    return result.notes.map(normalizeNoteRecord)
  } catch (err) {
    console.error('Failed to list notes:', err)
    return []
  }
}

export async function createNote(payload: Partial<NoteRecord>): Promise<NoteRecord | null> {
  await hydrateApiConfig()
  try {
    const res = await fetch(`${getApiBaseUrl()}/notes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    })
    const result = await res.json()
    return result.success ? normalizeNoteRecord(result.note) : null
  } catch (err) {
    console.error('Failed to create note:', err)
    return null
  }
}

export async function patchNote(id: string, patch: Partial<NoteRecord>): Promise<NoteRecord | null> {
  await hydrateApiConfig()
  try {
    const res = await fetch(`${getApiBaseUrl()}/notes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch)
    })
    const result = await res.json()
    return result.success ? normalizeNoteRecord(result.note) : null
  } catch (err) {
    console.error('Failed to patch note:', err)
    return null
  }
}

export async function deleteNoteById(id: string): Promise<boolean> {
  await hydrateApiConfig()
  try {
    const res = await fetch(`${getApiBaseUrl()}/notes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    const result = await res.json()
    return !!result.success
  } catch (err) {
    console.error('Failed to delete note:', err)
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
