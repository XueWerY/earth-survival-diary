import { readMediaAsset, saveMediaAsset } from './mediaAssets'

const DATABASE_NAME = 'earth-survival-diary-local'
const OBJECT_STORE = 'records'
const FALLBACK_PREFIX = 'esd:local-data:'

/** 由笔记正文中的媒体引用（esd-local-media://<id>）还原出 data URL */
async function readMediaAssetByReference(reference: string): Promise<string | null> {
  const key = 'media:asset:' + reference.replace(/^esd-local-media:\/\//, '')
  return await readMediaAsset(key)
}

type StoredRecord<T> = { key: string; value: T }

let databasePromise: Promise<IDBDatabase> | null = null

function getUserScope(): string {
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

function scopedKey(key: string): string {
  return `${getUserScope()}:${key}`
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise
  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OBJECT_STORE)) {
        db.createObjectStore(OBJECT_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Unable to open local data store'))
    request.onblocked = () => reject(new Error('Local data store upgrade is blocked'))
  }).catch(error => {
    databasePromise = null
    throw error
  })
  return databasePromise
}

function readFallback<T>(key: string): { found: boolean; value?: T } {
  try {
    const raw = localStorage.getItem(FALLBACK_PREFIX + key)
    if (raw === null) return { found: false }
    return { found: true, value: JSON.parse(raw) as T }
  } catch {
    return { found: false }
  }
}

async function readLocalDataByKey<T>(fullKey: string): Promise<{ found: boolean; value?: T }> {
  const electronStore = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (electronStore?.readLocalData) {
    return await electronStore.readLocalData(fullKey) as { found: boolean; value?: T }
  }
  try {
    const db = await openDatabase()
    const record = await new Promise<StoredRecord<T> | undefined>((resolve, reject) => {
      const request = db.transaction(OBJECT_STORE, 'readonly').objectStore(OBJECT_STORE).get(fullKey)
      request.onsuccess = () => resolve(request.result as StoredRecord<T> | undefined)
      request.onerror = () => reject(request.error || new Error('Unable to read local data'))
    })
    if (record) return { found: true, value: record.value }
  } catch {
    // Restricted browser contexts use the localStorage fallback.
  }
  return readFallback<T>(fullKey)
}

export async function readLocalData<T>(key: string): Promise<{ found: boolean; value?: T }> {
  return readLocalDataByKey<T>(scopedKey(key))
}

export async function readGlobalLocalData<T>(key: string): Promise<{ found: boolean; value?: T }> {
  return readLocalDataByKey<T>('global:' + key)
}

async function writeLocalDataByKey<T>(fullKey: string, value: T): Promise<void> {
  const electronStore = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (electronStore?.writeLocalData) {
    await electronStore.writeLocalData(fullKey, value)
    return
  }
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(OBJECT_STORE, 'readwrite')
      transaction.objectStore(OBJECT_STORE).put({ key: fullKey, value } satisfies StoredRecord<T>)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save local data'))
      transaction.onabort = () => reject(transaction.error || new Error('Local data save was aborted'))
    })
    return
  } catch {
    localStorage.setItem(FALLBACK_PREFIX + fullKey, JSON.stringify(value))
  }
}

export async function writeLocalData<T>(key: string, value: T): Promise<void> {
  return writeLocalDataByKey(scopedKey(key), value)
}

export async function writeGlobalLocalData<T>(key: string, value: T): Promise<void> {
  return writeLocalDataByKey('global:' + key, value)
}

async function removeLocalDataByKey(fullKey: string): Promise<void> {
  const electronStore = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (electronStore?.removeLocalData) {
    await electronStore.removeLocalData(fullKey)
    return
  }
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(OBJECT_STORE, 'readwrite')
      transaction.objectStore(OBJECT_STORE).delete(fullKey)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('Unable to delete local data'))
    })
  } catch {
    // The fallback is cleared below even when IndexedDB is unavailable.
  }
  try {
    localStorage.removeItem(FALLBACK_PREFIX + fullKey)
  } catch {
    // No fallback storage is available in this browser context.
  }
}

export async function removeLocalData(key: string): Promise<void> {
  await removeLocalDataByKey(scopedKey(key))
}

export async function removeGlobalLocalData(key: string): Promise<void> {
  await removeLocalDataByKey('global:' + key)
}

export async function updateLocalData<T>(key: string, update: (current: T | undefined) => T): Promise<T> {
  const fullKey = scopedKey(key)
  if (typeof window !== 'undefined' && window.electronAPI?.readLocalData && window.electronAPI?.writeLocalData) {
    const current = await readLocalData<T>(key)
    const updatedValue = update(current.found ? current.value : undefined)
    await writeLocalData(key, updatedValue)
    return updatedValue
  }
  try {
    const db = await openDatabase()
    let updatedValue!: T
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(OBJECT_STORE, 'readwrite')
      const store = transaction.objectStore(OBJECT_STORE)
      const request = store.get(fullKey)
      request.onsuccess = () => {
        try {
          updatedValue = update((request.result as StoredRecord<T> | undefined)?.value)
          store.put({ key: fullKey, value: updatedValue } satisfies StoredRecord<T>)
        } catch (error) {
          transaction.abort()
          reject(error)
        }
      }
      request.onerror = () => reject(request.error || new Error('Unable to update local data'))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('Unable to update local data'))
      transaction.onabort = () => reject(transaction.error || new Error('Local data update was aborted'))
    })
    return updatedValue
  } catch {
    const current = await readLocalData<T>(key)
    const updatedValue = update(current.found ? current.value : undefined)
    await writeLocalData(key, updatedValue)
    return updatedValue
  }
}

export interface LocalDataSnapshotRecord {
  key: string
  value: unknown
}

export async function exportLocalDataRecords(): Promise<LocalDataSnapshotRecord[]> {
  const prefix = `${getUserScope()}:`
  const electronStore = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (electronStore?.listLocalDataRecords) {
    const storedRecords = await electronStore.listLocalDataRecords(prefix)
    return storedRecords.map(record => ({
      key: record.key.startsWith(prefix) ? record.key.slice(prefix.length) : record.key,
      value: record.value
    }))
  }
  const records = new Map<string, unknown>()

  try {
    for (let index = 0; index < localStorage.length; index++) {
      const storageKey = localStorage.key(index)
      const fallbackKeyPrefix = FALLBACK_PREFIX + prefix
      if (!storageKey?.startsWith(fallbackKeyPrefix)) continue
      const key = storageKey.slice(FALLBACK_PREFIX.length + prefix.length)
      try {
        records.set(key, JSON.parse(localStorage.getItem(storageKey) || 'null'))
      } catch {
        // Ignore a damaged fallback record; valid IndexedDB entries are exported below.
      }
    }
  } catch {
    // IndexedDB remains the primary store when localStorage is unavailable.
  }

  try {
    const db = await openDatabase()
    const storedRecords = await new Promise<StoredRecord<unknown>[]>((resolve, reject) => {
      const request = db.transaction(OBJECT_STORE, 'readonly').objectStore(OBJECT_STORE).getAll()
      request.onsuccess = () => resolve(request.result as StoredRecord<unknown>[])
      request.onerror = () => reject(request.error || new Error('Unable to export local data'))
    })
    for (const record of storedRecords) {
      if (record.key.startsWith(prefix)) records.set(record.key.slice(prefix.length), record.value)
    }
  } catch {
    // Use fallback records when IndexedDB is unavailable.
  }

  return Array.from(records, ([key, value]) => ({ key, value }))
}

export async function listGlobalLocalDataRecords(): Promise<LocalDataSnapshotRecord[]> {
  const prefix = 'global:'
  const electronStore = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (electronStore?.listLocalDataRecords) return await electronStore.listLocalDataRecords(prefix)

  const records = new Map<string, unknown>()
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const storageKey = localStorage.key(index)
      if (!storageKey?.startsWith(FALLBACK_PREFIX + prefix)) continue
      const key = storageKey.slice(FALLBACK_PREFIX.length + prefix.length)
      try {
        records.set(key, JSON.parse(localStorage.getItem(storageKey) || 'null'))
      } catch {
        // Ignore malformed browser fallback entries.
      }
    }
  } catch {
    // IndexedDB is checked below when localStorage is unavailable.
  }

  try {
    const db = await openDatabase()
    const storedRecords = await new Promise<StoredRecord<unknown>[]>((resolve, reject) => {
      const request = db.transaction(OBJECT_STORE, 'readonly').objectStore(OBJECT_STORE).getAll()
      request.onsuccess = () => resolve(request.result as StoredRecord<unknown>[])
      request.onerror = () => reject(request.error || new Error('Unable to list global local data'))
    })
    for (const record of storedRecords) {
      if (record.key.startsWith(prefix)) records.set(record.key.slice(prefix.length), record.value)
    }
  } catch {
    // Browser fallback entries remain available when IndexedDB is unavailable.
  }

  return Array.from(records, ([key, value]) => ({ key, value }))
}

// 媒体引用统一走 services/mediaAssets.ts（内容寻址 + 规范扩展名 + 去重）。
// 这里保留 image/video/audio 三类 data URL 的识别，供保存时定位待落盘的资产。
const INLINE_MEDIA_PATTERN = /data:(?:image|video|audio)\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]*/gi
export const LOCAL_MEDIA_REFERENCE_PATTERN = /esd-local-media:\/\/([a-z0-9_-]+)/gi

/**
 * 把内容里的内联媒体 data URL 替换为 esd-local-media:// 引用。
 * 相同内容只会写入同一个内容寻址键，不会产生重复文件。
 */
export async function localizeMediaPayload<T>(value: T): Promise<T> {
  if (typeof value === 'string') {
    const matches = [...value.matchAll(INLINE_MEDIA_PATTERN)]
    if (!matches.length) return value
    let localized = value
    for (const match of matches) {
      const dataUrl = match[0]
      const reference = await saveMediaAsset(dataUrl)
      if (reference) localized = localized.replace(dataUrl, reference)
    }
    return localized as T
  }
  if (Array.isArray(value)) {
    return await Promise.all(value.map(item => localizeMediaPayload(item))) as T
  }
  if (!value || typeof value !== 'object') return value
  const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([key, item]) => [key, await localizeMediaPayload(item)] as const))
  return Object.fromEntries(entries) as T
}

/** 把 esd-local-media:// 引用还原为 data URL（供编辑器渲染与导出使用） */
export async function hydrateMediaPayload<T>(value: T): Promise<T> {
  if (typeof value === 'string') {
    const matches = [...value.matchAll(LOCAL_MEDIA_REFERENCE_PATTERN)]
    if (!matches.length) return value
    let hydrated = value
    for (const match of matches) {
      const reference = match[0]
      const dataUrl = await readMediaAssetByReference(reference)
      if (dataUrl) hydrated = hydrated.replace(reference, dataUrl)
    }
    return hydrated as T
  }
  if (Array.isArray(value)) {
    return await Promise.all(value.map(item => hydrateMediaPayload(item))) as T
  }
  if (!value || typeof value !== 'object') return value
  const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([key, item]) => [key, await hydrateMediaPayload(item)] as const))
  return Object.fromEntries(entries) as T
}
