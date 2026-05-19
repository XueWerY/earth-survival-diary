// 统一数据存储服务 - 支持用户隔离的 YAML 后端存储

import { logger } from '../lib/logger'

const API_BASE = '/api'

const cache = new Map<string, any>()
const pendingRequests = new Map<string, Promise<any>>()

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

function cacheKey(type: string, key: string): string {
  return `${type}/${key}`
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const promise = fetch(`${API_BASE}/data/${type}/${key}`, { headers })
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
    const res = await fetch(`${API_BASE}/data/${type}/${key}`, {
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
    const res = await fetch(`${API_BASE}/data/${type}/${key}`, {
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

export function preloadData(type: string, key: string, data: any) {
  cache.set(cacheKey(type, key), data)
}

// ============ 统一的 SystemState 管理 ============

export interface SystemState {
  date?: Record<string, any>
  countdown?: Record<string, any>
  list?: Record<string, any>
  focusTimer?: Record<string, any> | null
  currentPage?: string
  statsActiveTab?: string
  session?: { token: string }
  guideCompleted?: boolean
  version?: string
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
