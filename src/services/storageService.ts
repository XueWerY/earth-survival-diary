// 统一数据存储服务 - 支持用户隔离的 YAML 后端存储

import { logger } from '../lib/logger'

const API_BASE = '/api'

// 缓存层，减少 API 调用
const cache = new Map<string, any>()
const pendingRequests = new Map<string, Promise<any>>()

// 获取认证 token
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

// 获取数据
export async function getData<T>(key: string): Promise<T | null> {
  // 先检查缓存
  if (cache.has(key)) {
    return cache.get(key) as T
  }

  // 检查是否有相同请求正在进行
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T | null>
  }

  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const promise = fetch(`${API_BASE}/data/${key}`, { headers })
      .then(res => res.json())
      .then(result => {
        pendingRequests.delete(key)
        if (result.success) {
          cache.set(key, result.data)
          return result.data as T | null
        }
        return null
      })
      .catch(err => {
        pendingRequests.delete(key)
        console.error(`Failed to get data for key ${key}:`, err)
        return null
      })

  pendingRequests.set(key, promise)
  return promise
}

// 设置数据
export async function setData<T>(key: string, data: T): Promise<boolean> {
  // 更新缓存
  cache.set(key, data)

  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${API_BASE}/data/${key}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data })
    })
    const result = await res.json()
    return result.success
  } catch (err) {
    console.error(`Failed to set data for key ${key}:`, err)
    return false
  }
}

// 删除数据
export async function deleteData(key: string): Promise<boolean> {
  cache.delete(key)

  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${API_BASE}/data/${key}`, {
      method: 'DELETE',
      headers
    })
    const result = await res.json()
    return result.success
  } catch (err) {
    console.error(`Failed to delete data for key ${key}:`, err)
    return false
  }
}

// 批量获取数据
export async function batchGetData<T>(keys: string[]): Promise<Record<string, T | null>> {
  // 先从缓存获取
  const results: Record<string, T | null> = {}
  const missingKeys: string[] = []

  for (const key of keys) {
    if (cache.has(key)) {
      results[key] = cache.get(key) as T
    } else {
      missingKeys.push(key)
    }
  }

  if (missingKeys.length === 0) {
    return results
  }

  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${API_BASE}/data/batch/get`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ keys: missingKeys })
    })
    const result = await res.json()

    if (result.success) {
      for (const key of missingKeys) {
        results[key] = result.data[key]
        cache.set(key, result.data[key])
      }
    }
  } catch (err) {
    console.error('Failed to batch get data:', err)
    for (const key of missingKeys) {
      results[key] = null
    }
  }

  return results
}

// 批量设置数据
export async function batchSetData(items: Array<{ key: string; data: any }>): Promise<boolean> {
  // 更新缓存
  for (const { key, data } of items) {
    cache.set(key, data)
  }

  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${API_BASE}/data/batch/set`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items })
    })
    const result = await res.json()
    return result.success
  } catch (err) {
    console.error('Failed to batch set data:', err)
    return false
  }
}

// 清除缓存
export function clearCache(key?: string) {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}

// 预加载数据
export function preloadData(key: string, data: any) {
  cache.set(key, data)
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
}

const SYSTEM_STATE_KEY = 'system:state'

// 获取完整系统状态
async function loadSystemState(): Promise<SystemState> {
  const state = await getData<SystemState>(SYSTEM_STATE_KEY)
  return state || {}
}

// 保存完整系统状态
async function saveSystemState(state: SystemState): Promise<boolean> {
  cache.set(SYSTEM_STATE_KEY, state)
  return setData(SYSTEM_STATE_KEY, state)
}

// 获取系统状态的某个字段
export async function getSystemStateField<K extends keyof SystemState>(field: K): Promise<SystemState[K]> {
  const state = await loadSystemState()
  return state[field]
}

// 设置系统状态的某个字段
export async function setSystemStateField<K extends keyof SystemState>(field: K, value: SystemState[K]): Promise<boolean> {
  const state = await loadSystemState()
  state[field] = value
  return saveSystemState(state)
}

// 删除系统状态的某个字段
export async function deleteSystemStateField<K extends keyof SystemState>(field: K): Promise<boolean> {
  const state = await loadSystemState()
  delete state[field]
  return saveSystemState(state)
}
