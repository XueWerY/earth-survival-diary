// YAML 文件存储实现：为 Express API 提供统一的账号、模块和笔记记录接口。
// 数据根目录由 ESD_DATA_DIR 指定；模块数据按用户与模块拆分保存，便于备份与迁移。

const fs = require('node:fs/promises')
const path = require('node:path')

const MODULE_TABLES = {
  'profile:profile': { table: 'profiles', shape: 'object' },
  'settings:settings': { table: 'settings', shape: 'object' },
  'system:state': { table: 'system_state', shape: 'object' },
  'system:reminders': { table: 'system_reminders', shape: 'object' },
  'footprint:footprint': { table: 'footprints', shape: 'array' },
  'footprint:diary': { table: 'diaries', shape: 'array' },
  'list:lists': { table: 'lists', shape: 'array' },
  'list:tasks': { table: 'list_tasks', shape: 'array' },
  'list:folders': { table: 'list_folders', shape: 'array' },
  'list:favorites': { table: 'list_favorites', shape: 'array' },
  'list:completed': { table: 'list_completed', shape: 'array' },
  'countdown:countdowns': { table: 'countdowns', shape: 'array' },
  'countdown:categories': { table: 'countdown_categories', shape: 'array' },
  'course:courses': { table: 'courses', shape: 'array' },
  'notes:notes': { table: 'notes', shape: 'array' },
  'notes:tags': { table: 'note_tags', shape: 'array' },
  'notes:categories': { table: 'note_categories', shape: 'array' },
  'notes:favorites': { table: 'notes_favorites', shape: 'array' },
  'focus:records': { table: 'focus_records', shape: 'array' },
  'focus:favorites': { table: 'focus_favorites', shape: 'array' }
}

const TABLE_MODULES = Object.fromEntries(
  Object.entries(MODULE_TABLES).map(([moduleKey, value]) => [value.table, moduleKey.split(':')])
)

function safeSegment(value) {
  const text = String(value)
  if (/^[A-Za-z0-9_-]+$/.test(text)) return text
  return `x${Buffer.from(text, 'utf8').toString('base64url')}`
}

function emailFileSegment(email) {
  return Buffer.from(String(email), 'utf8').toString('base64url') || '_'
}

async function createYamlStore({ dataDir, nodeModulesPath }) {
  if (!dataDir) throw new Error('YAML 存储必须配置 ESD_DATA_DIR')
  const YAML = require(path.join(nodeModulesPath, 'yaml'))
  const root = path.resolve(dataDir)
  const usersDir = path.join(root, 'users')
  const settingsDir = path.join(root, 'settings')
  const pendingWrites = new Map()
  await fs.mkdir(root, { recursive: true })

  function modulePath(userId, type, key, extension = '.yaml') {
    return path.join(root, safeSegment(userId), safeSegment(type), `${safeSegment(key)}${extension}`)
  }

  function accountPath(email, extension = '.yaml') {
    return path.join(usersDir, `${emailFileSegment(email)}${extension}`)
  }

  function settingsPath(extension = '.yaml') {
    return path.join(settingsDir, `settings${extension}`)
  }

  async function readDocument(filePath, fallback = null, legacyPaths = []) {
    for (const candidate of [filePath, ...legacyPaths]) {
      try {
        const source = await fs.readFile(candidate, 'utf8')
        const value = YAML.parse(source)
        return value === undefined ? fallback : value
      } catch (error) {
        if (error && error.code === 'ENOENT') continue
        throw new Error(`读取 YAML 数据失败 (${candidate}): ${error.message}`)
      }
    }
    return fallback
  }

  async function writeDocument(filePath, value) {
    const directory = path.dirname(filePath)
    await fs.mkdir(directory, { recursive: true })
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
    try {
      await fs.writeFile(tempPath, YAML.stringify(value, { lineWidth: 0 }), { encoding: 'utf8', mode: 0o600 })
      await fs.rename(tempPath, filePath)
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => {})
      throw new Error(`写入 YAML 数据失败 (${filePath}): ${error.message}`)
    }
  }

  async function withFileLock(filePath, action) {
    const previous = pendingWrites.get(filePath) || Promise.resolve()
    const current = previous.catch(() => {}).then(action)
    pendingWrites.set(filePath, current)
    try {
      return await current
    } finally {
      if (pendingWrites.get(filePath) === current) pendingWrites.delete(filePath)
    }
  }

  function resolveModule(type, key) {
    return MODULE_TABLES[`${type}:${key}`] || null
  }

  async function readModule(userId, type, key, module) {
    const file = modulePath(userId, type, key)
    const legacy = [modulePath(userId, type, key, '.yml'), modulePath(userId, type, key, '.json')]
    const value = await readDocument(file, module.shape === 'array' ? [] : null, legacy)
    if (module.shape === 'array') return Array.isArray(value) ? value : []
    return value
  }

  async function writeModule(userId, type, key, module, data) {
    const file = modulePath(userId, type, key)
    await withFileLock(file, async () => {
      const value = module.shape === 'array'
        ? (Array.isArray(data) ? data : [])
        : (data === undefined ? null : data)
      if (value === null) {
        await fs.rm(file, { force: true })
        await fs.rm(modulePath(userId, type, key, '.yml'), { force: true })
        await fs.rm(modulePath(userId, type, key, '.json'), { force: true })
      } else {
        await writeDocument(file, value)
        await fs.rm(modulePath(userId, type, key, '.yml'), { force: true })
        await fs.rm(modulePath(userId, type, key, '.json'), { force: true })
      }
    })
  }

  async function findAccountFiles(email) {
    let names
    try {
      names = await fs.readdir(usersDir)
    } catch (error) {
      if (error && error.code === 'ENOENT') return []
      throw error
    }

    const matches = []
    for (const name of names) {
      if (!/\.(?:yaml|yml|json)$/i.test(name)) continue
      const candidate = path.join(usersDir, name)
      const entry = await readDocument(candidate, null)
      if (entry && entry.email === email) matches.push(candidate)
    }
    return matches
  }

  async function getUserIndexByEmail(email) {
    const direct = await readDocument(accountPath(email), null, [accountPath(email, '.yml'), accountPath(email, '.json')])
    if (direct) return direct
    const matches = await findAccountFiles(email)
    return matches.length ? readDocument(matches[0]) : null
  }

  async function setUserIndex(email, entry) {
    const normalized = { ...entry, email: entry.email || email }
    await withFileLock(accountPath(email), () => writeDocument(accountPath(email), normalized))
    for (const legacy of await findAccountFiles(email)) {
      if (legacy !== accountPath(email)) await fs.rm(legacy, { force: true })
    }
  }

  async function deleteUserIndex(email) {
    const paths = new Set([accountPath(email), accountPath(email, '.yml'), accountPath(email, '.json'), ...await findAccountFiles(email)])
    let deleted = false
    for (const file of paths) {
      try {
        await fs.rm(file)
        deleted = true
      } catch (error) {
        if (!error || error.code !== 'ENOENT') throw error
      }
    }
    return deleted
  }

  async function getAllUserEmails() {
    let names
    try {
      names = await fs.readdir(usersDir)
    } catch (error) {
      if (error && error.code === 'ENOENT') return []
      throw error
    }

    const emails = new Set()
    for (const name of names) {
      if (!/\.(?:yaml|yml|json)$/i.test(name)) continue
      const entry = await readDocument(path.join(usersDir, name), null)
      if (entry && typeof entry.email === 'string' && entry.email) emails.add(entry.email)
    }
    return [...emails]
  }

  async function getUserKV(userId, type, key) {
    const module = resolveModule(type, key)
    return module ? readModule(userId, type, key, module) : null
  }

  async function setUserKV(userId, type, key, data) {
    const module = resolveModule(type, key)
    if (!module) {
      console.warn(`[YAML] 未登记的存储键已忽略：${type}/${key}`)
      return
    }
    await writeModule(userId, type, key, module, data)
  }

  async function deleteUserKV(userId, type, key) {
    const module = resolveModule(type, key)
    if (module) await writeModule(userId, type, key, module, null)
  }

  async function listRecords(table, userId) {
    const moduleKey = TABLE_MODULES[table]
    if (!moduleKey) throw new Error(`[YAML] 未登记的记录模块：${table}`)
    return readModule(userId, moduleKey[0], moduleKey[1], MODULE_TABLES[`${moduleKey[0]}:${moduleKey[1]}`])
  }

  async function getRecord(table, userId, id) {
    const records = await listRecords(table, userId)
    return records.find(record => record && String(record.id || record._id) === String(id)) || null
  }

  async function appendRecord(table, userId, doc) {
    const moduleKey = TABLE_MODULES[table]
    if (!moduleKey) throw new Error(`[YAML] 未登记的记录模块：${table}`)
    const [type, key] = moduleKey
    const file = modulePath(userId, type, key)
    const rowId = doc && (doc.id || doc._id) != null ? String(doc.id || doc._id) : String(Date.now())
    const saved = { ...doc, id: rowId }
    return withFileLock(file, async () => {
      const records = await readModule(userId, type, key, MODULE_TABLES[`${type}:${key}`])
      const index = records.findIndex(record => record && String(record.id || record._id) === rowId)
      if (index >= 0) records[index] = saved
      else records.push(saved)
      await writeDocument(file, records)
      await fs.rm(modulePath(userId, type, key, '.yml'), { force: true })
      await fs.rm(modulePath(userId, type, key, '.json'), { force: true })
      return saved
    })
  }

  async function upsertRecord(table, userId, id, doc) {
    const moduleKey = TABLE_MODULES[table]
    if (!moduleKey) throw new Error(`[YAML] 未登记的记录模块：${table}`)
    const [type, key] = moduleKey
    const file = modulePath(userId, type, key)
    return withFileLock(file, async () => {
      const records = await readModule(userId, type, key, MODULE_TABLES[`${type}:${key}`])
      const index = records.findIndex(record => record && String(record.id || record._id) === String(id))
      if (index < 0) return null
      const saved = { ...doc, id: String(id) }
      records[index] = saved
      await writeDocument(file, records)
      await fs.rm(modulePath(userId, type, key, '.yml'), { force: true })
      await fs.rm(modulePath(userId, type, key, '.json'), { force: true })
      return saved
    })
  }

  async function deleteRecord(table, userId, id) {
    const moduleKey = TABLE_MODULES[table]
    if (!moduleKey) throw new Error(`[YAML] 未登记的记录模块：${table}`)
    const [type, key] = moduleKey
    const file = modulePath(userId, type, key)
    return withFileLock(file, async () => {
      const records = await readModule(userId, type, key, MODULE_TABLES[`${type}:${key}`])
      const remaining = records.filter(record => !record || String(record.id || record._id) !== String(id))
      if (remaining.length === records.length) return false
      await writeDocument(file, remaining)
      await fs.rm(modulePath(userId, type, key, '.yml'), { force: true })
      await fs.rm(modulePath(userId, type, key, '.json'), { force: true })
      return true
    })
  }

  async function clearAllUserData() {
    let userDirectories
    try {
      userDirectories = await fs.readdir(root, { withFileTypes: true })
    } catch (error) {
      if (error && error.code === 'ENOENT') return
      throw error
    }

    for (const entry of userDirectories) {
      if (!entry.isDirectory() || entry.name === 'users' || entry.name === 'settings') continue
      for (const [moduleKey, module] of Object.entries(MODULE_TABLES)) {
        const [type, key] = moduleKey.split(':')
        for (const extension of ['.yaml', '.yml', '.json']) {
          await fs.rm(modulePath(entry.name, type, key, extension), { force: true })
        }
      }
    }
  }

  async function deleteUserData(userId) {
    await fs.rm(path.join(root, safeSegment(userId)), { recursive: true, force: true })
  }

  async function getAppSettings() {
    const value = await readDocument(settingsPath(), {}, [settingsPath('.yml'), settingsPath('.json')])
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  }

  async function setAppSetting(key, value) {
    const file = settingsPath()
    await withFileLock(file, async () => {
      const current = await getAppSettings()
      current[key] = value
      await writeDocument(file, current)
      await fs.rm(settingsPath('.yml'), { force: true })
      await fs.rm(settingsPath('.json'), { force: true })
    })
  }

  return {
    backend: 'yaml',
    dataDir: root,
    moduleTables: [...new Set(Object.values(MODULE_TABLES).map(module => module.table))],
    getUserIndexByEmail,
    setUserIndex,
    deleteUserIndex,
    getAllUserEmails,
    emailExists: async email => (await getUserIndexByEmail(email)) !== null,
    getUserKV,
    setUserKV,
    deleteUserKV,
    listRecords,
    getRecord,
    appendRecord,
    upsertRecord,
    deleteRecord,
    deleteUserData,
    clearAllUserData,
    getAppSettings,
    setAppSetting,
    close: async () => {}
  }
}

module.exports = { createYamlStore, MODULE_TABLES, TABLE_MODULES, safeSegment }
