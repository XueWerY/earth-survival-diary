import { exportLocalDataRecords, listGlobalLocalDataRecords, readLocalData, removeGlobalLocalData, removeLocalData, writeGlobalLocalData, writeLocalData } from './localDataStore'

type LocalRouteResult = { handled: false } | { handled: true; data: any }

const DATA_PREFIX = 'api-data:'
const localPrefixes = ['/auth', '/profile', '/tasks', '/diaries', '/list-lists', '/list-tasks', '/settings', '/stats', '/data', '/notes', '/clean']

function isLocalPath(path: string): boolean {
  return localPrefixes.some(prefix => prefix.endsWith('/')
    ? path.startsWith(prefix)
    : path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?'))
}

function parseBody(body: BodyInit | null | undefined): any {
  if (typeof body !== 'string' || !body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return {}
  }
}

type LocalAccount = {
  id: string
  email: string
  nickname: string
  createdAt: string
  passwordSalt?: string
  passwordHash?: string
}

async function readAccounts(): Promise<LocalAccount[]> {
  const records = await listGlobalLocalDataRecords()
  return records
    .map(record => record.value)
    .filter((value): value is LocalAccount => !!value && typeof value === 'object' && typeof (value as LocalAccount).id === 'string')
}

async function writeAccounts(accounts: LocalAccount[]): Promise<void> {
  const existingAccounts = await readAccounts()
  const accountIds = new Set(accounts.map(account => account.id))
  await Promise.all(accounts.map(account => writeGlobalLocalData(account.id, account)))
  await Promise.all(existingAccounts
    .filter(account => !accountIds.has(account.id))
    .map(account => removeGlobalLocalData(account.id)))
}

function decodeToken(token: string | null): Record<string, any> | null {
  if (!token) return null
  for (const segment of token.split('.').slice(0, 2)) {
    try {
      const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(normalized))
      if (payload && typeof payload === 'object' && payload.sub) return payload
    } catch {
      // Try the next segment for tokens created by older versions.
    }
  }
  return null
}

function encodeBase64Url(value: string): string {
  return encodeBytes(new TextEncoder().encode(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function createLocalSession(account: LocalAccount) {
  const payload = encodeBase64Url(JSON.stringify({ sub: account.id }))
  return {
    access_token: `${payload}.local.${Date.now().toString(36)}`,
    refresh_token: '',
    expires_at: 0
  }
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256)
  return encodeBytes(new Uint8Array(bits))
}

async function createPasswordCredentials(password: string): Promise<{ passwordSalt: string; passwordHash: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { passwordSalt: encodeBytes(salt), passwordHash: await hashPassword(password, salt) }
}

async function verifyPassword(password: string, account: LocalAccount): Promise<boolean> {
  if (!account.passwordSalt || !account.passwordHash) return false
  try {
    const salt = Uint8Array.from(atob(account.passwordSalt), char => char.charCodeAt(0))
    const actual = await hashPassword(password, salt)
    if (actual.length !== account.passwordHash.length) return false
    let difference = 0
    for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ account.passwordHash.charCodeAt(index)
    return difference === 0
  } catch {
    return false
  }
}

function getUserIdFromToken(token: string | null): string {
  if (!token) return ''
  try {
    const payload = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.sub === 'string' ? payload.sub : ''
  } catch {
    return ''
  }
}

async function loadLocalProfile(token: string | null): Promise<Record<string, any>> {
  const stored = await readLocalData<Record<string, any>>('profile')
  const savedAvatar = await readLocalData<string>('profile:avatar')
  const profile = stored.found && stored.value && typeof stored.value === 'object'
    ? stored.value
    : null
  const userId = getUserIdFromToken(token)
  const account = (await readAccounts()).find(item => item.id === userId)
  const createdAt = profile?.createdAt || profile?.created_at || account?.createdAt || new Date().toISOString()
  const avatarDataUrl = savedAvatar.found && typeof savedAvatar.value === 'string'
    ? savedAvatar.value
    : typeof profile?.avatarDataUrl === 'string' ? profile.avatarDataUrl : ''
  if (profile) {
    return {
      ...profile,
      id: profile.id || userId,
      nickname: profile.nickname || account?.nickname || '',
      email: profile.email || account?.email || '',
      createdAt,
      created_at: createdAt,
      avatarDataUrl
    }
  }
  return {
    id: userId,
    nickname: account?.nickname || '',
    email: account?.email || '',
    createdAt,
    created_at: createdAt,
    avatarDataUrl
  }
}

async function loadCollection<T>(key: string): Promise<T[]> {
  const stored = await readLocalData<T[]>(key)
  return stored.found && Array.isArray(stored.value) ? stored.value : []
}

function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

function durationMinutes(startTime?: string | null, endTime?: string | null): number {
  if (!startTime || !endTime) return 0
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0
  let duration = endHour * 60 + endMinute - (startHour * 60 + startMinute)
  if (duration < 0) duration += 24 * 60
  return duration
}

function makeTask(body: any, diary: boolean) {
  const startTime = body.startTime || null
  const endTime = body.endTime || null
  return {
    id: createId(),
    name: String(body.name || ''),
    date: String(body.date || new Date().toISOString().slice(0, 10)),
    startTime,
    endTime,
    duration: durationMinutes(startTime, endTime),
    completed: !!body.completed,
    notes: body.notes ?? null,
    content: body.content ?? null,
    category: diary ? 'diary' : body.category ?? null,
    created_at: new Date().toISOString(),
    pinned: !!body.pinned,
    icon: body.icon ?? null
  }
}

function makeListTask(body: any) {
  const now = new Date().toISOString()
  return {
    id: createId(),
    list_id: String(body.listId || body.list_id || ''),
    group_id: body.groupId ?? body.group_id ?? null,
    name: String(body.name || ''),
    description: body.description ?? null,
    target_count: body.targetCount ?? body.target_count ?? 1,
    current_count: body.currentCount ?? body.current_count ?? 0,
    completed: !!body.completed,
    created_at: now,
    updated_at: now,
    date: body.date ?? '',
    end_time: body.endTime ?? body.end_time ?? '',
    repeat_strategy: body.repeatStrategy ?? body.repeat_strategy ?? 'none',
    repeat_custom_days: body.repeatCustomDays ?? body.repeat_custom_days ?? 1,
    repeat_weekdays: body.repeatWeekdays ?? body.repeat_weekdays ?? [],
    repeat_month_day: body.repeatMonthDay ?? body.repeat_month_day ?? 1,
    repeat_lunar_month: body.repeatLunarMonth ?? body.repeat_lunar_month ?? 1,
    repeat_lunar_day: body.repeatLunarDay ?? body.repeat_lunar_day ?? 1,
    repeat_end_strategy: body.repeatEndStrategy ?? body.repeat_end_strategy ?? 'never',
    repeat_end_date: body.repeatEndDate ?? body.repeat_end_date ?? '',
    repeat_count: body.repeatCount ?? body.repeat_count ?? 0,
    repeat_completed_count: body.repeatCompletedCount ?? body.repeat_completed_count ?? 0,
    priority: body.priority ?? 'medium',
    checklist: Array.isArray(body.checklist) ? body.checklist : [],
    linked_note_ids: Array.isArray(body.linkedNoteIds) ? body.linkedNoteIds : [],
    completed_start_time: body.completedStartTime ?? body.completed_start_time ?? '',
    completed_end_time: body.completedEndTime ?? body.completed_end_time ?? '',
    notes: body.notes ?? '',
    reminder_strategy: body.reminderStrategy ?? body.reminder_strategy ?? 'none',
    reminder_days: body.reminderDays ?? body.reminder_days ?? 0,
    reminder_hours: body.reminderHours ?? body.reminder_hours ?? 0,
    reminder_minutes: body.reminderMinutes ?? body.reminder_minutes ?? 0
  }
}

function mergeListTask(current: any, patch: any) {
  const aliases: Record<string, string> = {
    listId: 'list_id', groupId: 'group_id', targetCount: 'target_count', currentCount: 'current_count',
    endTime: 'end_time', repeatStrategy: 'repeat_strategy', repeatCustomDays: 'repeat_custom_days',
    repeatWeekdays: 'repeat_weekdays', repeatMonthDay: 'repeat_month_day', repeatLunarMonth: 'repeat_lunar_month',
    repeatLunarDay: 'repeat_lunar_day', repeatEndStrategy: 'repeat_end_strategy', repeatEndDate: 'repeat_end_date',
    repeatCount: 'repeat_count', repeatCompletedCount: 'repeat_completed_count', linkedNoteIds: 'linked_note_ids',
    completedStartTime: 'completed_start_time', completedEndTime: 'completed_end_time',
    reminderStrategy: 'reminder_strategy', reminderDays: 'reminder_days', reminderHours: 'reminder_hours',
    reminderMinutes: 'reminder_minutes'
  }
  const next = { ...current, ...patch, updated_at: new Date().toISOString() }
  for (const [camel, snake] of Object.entries(aliases)) {
    if (Object.prototype.hasOwnProperty.call(patch, camel)) next[snake] = patch[camel]
  }
  return next
}

async function localTasks(path: string, method: string, body: any, diary: boolean) {
  const name = diary ? 'diaries' : 'tasks'
  const loaded = await loadCollection<any>(name)
  const parts = path.split('/').filter(Boolean)
  const id = parts.length > 1 ? decodeURIComponent(parts[1]) : ''
  if (method === 'GET' && !id) return { tasks: loaded }
  if (method === 'POST' && !id) {
    const task = makeTask(body, diary)
    const items = [task, ...loaded]
    await writeLocalData(name, items)
    return { task }
  }
  const index = loaded.findIndex((item: any) => String(item.id) === id)
  if (method === 'PUT' && index >= 0) {
    const items = [...loaded]
    items[index] = { ...items[index], ...body, updated_at: new Date().toISOString() }
    await writeLocalData(name, items)
    return { task: items[index] }
  }
  if (method === 'DELETE') {
    await writeLocalData(name, loaded.filter((item: any) => String(item.id) !== id))
    return { success: true }
  }
  throw new Error('找不到对应的本地记录')
}

async function localLists(path: string, method: string, body: any) {
  const loaded = await loadCollection<any>('lists')
  const parts = path.split('/').filter(Boolean)
  const listId = parts[1] && parts[1] !== 'reorder' ? decodeURIComponent(parts[1]) : ''
  if (method === 'GET' && parts.length === 1) return { lists: loaded }

  if (parts.length === 1 && method === 'POST') {
    const list = { id: createId(), name: String(body.name || '新清单'), icon: body.icon || '📝', created_at: new Date().toISOString(), groups: [], order: loaded.length }
    const items = [...loaded, list]
    await writeLocalData('lists', items)
    return { list }
  }
  if (parts[1] === 'reorder' && method === 'PUT') {
    const order = new Map((body.orders || []).map((item: any) => [String(item.id), Number(item.order)]))
    const items = loaded.map((list: any) => ({ ...list, order: order.get(String(list.id)) ?? list.order }))
    await writeLocalData('lists', items)
    return { lists: items }
  }
  const listIndex = loaded.findIndex((list: any) => String(list.id) === listId)
  if (listIndex < 0) throw new Error('找不到对应的本地清单')
  const items = [...loaded]
  const list = { ...items[listIndex] }
  const groupIndex = parts[2] === 'groups' && parts[3] && parts[3] !== 'reorder'
    ? (list.groups || []).findIndex((group: any) => String(group.id) === decodeURIComponent(parts[3]))
    : -1

  if (parts[2] === 'groups' && parts[3] === 'reorder' && method === 'PUT') {
    const order = new Map((body.orders || []).map((item: any) => [String(item.id), Number(item.order)]))
    list.groups = (list.groups || []).map((group: any) => ({ ...group, order: order.get(String(group.id)) ?? group.order }))
    items[listIndex] = list
    await writeLocalData('lists', items)
    return { groups: list.groups }
  }
  if (parts[2] === 'groups' && parts.length === 3 && method === 'POST') {
    const groups = [...(list.groups || [])]
    const group = { id: createId(), name: String(body.name || '新分组'), color: body.color || '#667eea', order: groups.length }
    groups.push(group)
    list.groups = groups
    items[listIndex] = list
    await writeLocalData('lists', items)
    return { group }
  }
  if (parts[2] === 'groups' && groupIndex >= 0) {
    const groups = [...(list.groups || [])]
    if (method === 'PUT') {
      groups[groupIndex] = { ...groups[groupIndex], ...body }
      list.groups = groups
      items[listIndex] = list
      await writeLocalData('lists', items)
      return { group: groups[groupIndex] }
    }
    if (method === 'DELETE') {
      const deletedGroupId = String(groups[groupIndex].id)
      list.groups = groups.filter((_: any, index: number) => index !== groupIndex)
      items[listIndex] = list
      await writeLocalData('lists', items)
      const tasks = await loadCollection<any>('listTasks')
      await writeLocalData('listTasks', tasks.filter((task: any) => String(task.group_id) !== deletedGroupId))
      return { success: true }
    }
  }
  if (parts.length === 2 && method === 'PUT') {
    items[listIndex] = { ...list, ...body }
    await writeLocalData('lists', items)
    return { list: items[listIndex] }
  }
  if (parts.length === 2 && method === 'DELETE') {
    const options = body || {}
    const tasks = await loadCollection<any>('listTasks')
    if (options.deleteTasks) {
      await writeLocalData('listTasks', tasks.filter((task: any) => String(task.list_id) !== listId))
    } else if (options.transferToListId) {
      await writeLocalData('listTasks', tasks.map((task: any) => String(task.list_id) === listId
        ? { ...task, list_id: options.transferToListId }
        : task))
    }
    await writeLocalData('lists', items.filter((_: any, index: number) => index !== listIndex))
    return { success: true }
  }
  throw new Error('不支持的本地清单操作')
}

async function localListTasks(path: string, method: string, body: any, search: string) {
  const loaded = await loadCollection<any>('listTasks')
  const parts = path.split('/').filter(Boolean)
  const id = parts[1] ? decodeURIComponent(parts[1]) : ''
  if (method === 'GET' && !id) {
    const listId = new URLSearchParams(search).get('listId')
    return { listTasks: listId ? loaded.filter((task: any) => String(task.list_id) === listId) : loaded }
  }
  if (method === 'POST' && !id) {
    const task = makeListTask(body)
    const items = [task, ...loaded]
    await writeLocalData('listTasks', items)
    return { listTask: task }
  }
  const index = loaded.findIndex((task: any) => String(task.id) === id)
  if (method === 'PUT' && index >= 0) {
    const items = [...loaded]
    items[index] = mergeListTask(items[index], body)
    await writeLocalData('listTasks', items)
    return { listTask: items[index] }
  }
  if (method === 'DELETE') {
    await writeLocalData('listTasks', loaded.filter((task: any) => String(task.id) !== id))
    return { success: true }
  }
  throw new Error('找不到对应的本地清单任务')
}

async function localGenericData(path: string, method: string, body: any) {
  const pathSegments = path.split('/').filter(Boolean)
  if (pathSegments[0] !== 'data' || pathSegments.length < 2) throw new Error('本地数据路径无效')
  const key = DATA_PREFIX + pathSegments.slice(1).map(decodeURIComponent).join('/')
  const stored = await readLocalData<any>(key)
  if (method === 'GET') {
    if (stored.found) return { success: true, data: stored.value }
    return { success: true, data: null }
  }
  if (method === 'POST' || method === 'PUT') {
    await writeLocalData(key, body.data)
    return { success: true }
  }
  if (method === 'DELETE') {
    await removeLocalData(key)
    return { success: true }
  }
  throw new Error('不支持的本地数据操作')
}

function publicUser(account: LocalAccount) {
  return { id: account.id, email: account.email, nickname: account.nickname, createdAt: account.createdAt }
}

async function localAuth(path: string, method: string, body: any, token: string | null) {
  const accounts = await readAccounts()
  const current = getUserIdFromToken(token)
    ? accounts.find(account => account.id === getUserIdFromToken(token)) || null
    : null

  if (path === '/auth/signup' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!email || !password) throw new Error('邮箱和密码必填')
    if (email.length > 255 || password.length > 256) throw new Error('邮箱或密码长度超出限制')
    if (password.length < 6) throw new Error('密码长度至少6位')
    if (accounts.some(account => account.email.toLowerCase() === email)) throw new Error('该邮箱已被注册')
    const account: LocalAccount = {
      id: createId(),
      email,
      nickname: String(body.nickname || '地球 Online 玩家').trim(),
      createdAt: new Date().toISOString(),
      ...await createPasswordCredentials(password)
    }
    await writeAccounts([...accounts, account])
    return { user: publicUser(account), session: createLocalSession(account) }
  }

  if (path === '/auth/signin' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const account = accounts.find(item => item.email.toLowerCase() === email)
    if (!account || !(await verifyPassword(password, account))) throw new Error('邮箱或密码错误')
    return { user: publicUser(account), session: createLocalSession(account) }
  }

  if (path === '/auth/signout' && method === 'POST') return { success: true }
  if (path === '/auth/user' && method === 'GET') return { user: current ? publicUser(current) : null }
  if (path === '/auth/users' && method === 'GET') {
    return { users: accounts.map(account => ({ email: account.email, nickname: account.nickname, createdAt: account.createdAt })) }
  }
  if (path === '/auth/check-session' && method === 'POST') return { valid: !!current, kicked: false }

  if (path === '/auth/settings') {
    const stored = await readLocalData<Record<string, any>>('app-settings')
    const settings = stored.found && stored.value && typeof stored.value === 'object' ? stored.value : {}
    if (method === 'GET') return { settings }
    if (method === 'POST') {
      if (typeof body.key !== 'string') throw new Error('设置名称无效')
      settings[body.key] = body.value
      await writeLocalData('app-settings', settings)
      return { success: true }
    }
  }

  if (!current) throw new Error('请先登录')
  if (path === '/auth/change-email' && method === 'POST') {
    const email = String(body.newEmail || '').trim().toLowerCase()
    if (!email || email.length > 255 || !String(body.password || '')) throw new Error('新邮箱和密码格式不正确')
    if (accounts.some(account => account.id !== current.id && account.email.toLowerCase() === email)) throw new Error('该邮箱已被其他账号使用')
    if (!(await verifyPassword(String(body.password), current))) throw new Error('密码错误')
    const updated = { ...current, email }
    await writeAccounts(accounts.map(account => account.id === current.id ? updated : account))
    return { success: true, email }
  }
  if (path === '/auth/change-password' && method === 'POST') {
    if (!(await verifyPassword(String(body.oldPassword || ''), current))) throw new Error('当前密码错误')
    if (String(body.newPassword || '').length < 6) throw new Error('新密码长度至少6位')
    const updated = { ...current, ...await createPasswordCredentials(String(body.newPassword)) }
    await writeAccounts(accounts.map(account => account.id === current.id ? updated : account))
    return { success: true }
  }
  if (path === '/auth/account' && method === 'DELETE') {
    const records = await exportLocalDataRecords()
    for (const record of records) await removeLocalData(record.key)
    await writeAccounts(accounts.filter(account => account.id !== current.id))
    return { success: true }
  }
  throw new Error('不支持的本地账号操作')
}

async function localProfile(path: string, method: string, body: any, token: string | null) {
  const userId = getUserIdFromToken(token)
  if (!userId) throw new Error('请先登录')
  if (path === '/profile/avatar' && method === 'POST') {
    const avatarDataUrl = typeof body.avatarDataUrl === 'string' ? body.avatarDataUrl : ''
    if (!avatarDataUrl) throw new Error('请选择有效头像')
    await writeLocalData('profile:avatar', avatarDataUrl)
    return { avatarDataUrl }
  }
  if (method === 'GET') return { profile: await loadLocalProfile(token) }
  if (method === 'PUT' || method === 'PATCH') {
    const current = await loadLocalProfile(token)
    const { avatarDataUrl: _avatarDataUrl, ...currentWithoutAvatar } = current
    const patch = body && typeof body === 'object' ? { ...body } : {}
    delete patch.avatarDataUrl
    const createdAt = current.createdAt || current.created_at
    const profile = { ...currentWithoutAvatar, ...patch, id: userId, createdAt, created_at: createdAt, updated_at: new Date().toISOString() }
    await writeLocalData('profile', profile)
    const accounts = await readAccounts()
    if (typeof body.nickname === 'string') {
      await writeAccounts(accounts.map(account => account.id === userId ? { ...account, nickname: body.nickname } : account))
    }
    return { profile }
  }
  throw new Error('不支持的本地资料操作')
}

async function localNotes(path: string, method: string, body: any) {
  const stored = await readLocalData<any[]>('notes')
  const notes = stored.found && Array.isArray(stored.value) ? stored.value : []
  const parts = path.split('/').filter(Boolean)
  const id = parts.length > 1 ? decodeURIComponent(parts[1]) : ''
  if (method === 'GET' && !id) return { success: true, notes }
  if (method === 'POST' && !id) {
    const note = body && typeof body === 'object' ? body : {}
    const next = [...notes.filter(item => String(item.id) !== String(note.id)), note]
    await writeLocalData('notes', next)
    return { success: true, note }
  }
  const index = notes.findIndex(note => String(note.id) === id)
  if (method === 'PUT' && index >= 0) {
    const note = { ...notes[index], ...body, updatedAt: new Date().toISOString() }
    const next = [...notes]
    next[index] = note
    await writeLocalData('notes', next)
    return { success: true, note }
  }
  if (method === 'DELETE') {
    await writeLocalData('notes', notes.filter(note => String(note.id) !== id))
    return { success: true }
  }
  throw new Error('找不到对应的本地笔记')
}

export async function routeLocalApiRequest(endpoint: string, options: RequestInit, token: string | null): Promise<LocalRouteResult> {
  const url = new URL(endpoint, 'http://local')
  const path = url.pathname
  if (!isLocalPath(path)) return { handled: false }
  const method = (options.method || 'GET').toUpperCase()
  const body = parseBody(options.body)

  if (path.startsWith('/auth/')) return { handled: true, data: await localAuth(path, method, body, token) }
  if (path === '/profile' || path.startsWith('/profile/')) return { handled: true, data: await localProfile(path, method, body, token) }
  if (path === '/notes' || path.startsWith('/notes/')) return { handled: true, data: await localNotes(path, method, body) }

  if (path === '/tasks' || path.startsWith('/tasks/')) return { handled: true, data: await localTasks(path, method, body, false) }
  if (path === '/diaries' || path.startsWith('/diaries/')) return { handled: true, data: await localTasks(path, method, body, true) }
  if (path === '/list-lists' || path.startsWith('/list-lists/')) return { handled: true, data: await localLists(path, method, body) }
  if (path === '/list-tasks' || path.startsWith('/list-tasks/')) return { handled: true, data: await localListTasks(path, method, body, url.search) }

  if (path === '/settings') {
    const stored = await readLocalData<Record<string, any>>('settings')
    if (method === 'GET') {
      if (stored.found) return { handled: true, data: { settings: stored.value || {} } }
      return { handled: true, data: { settings: {} } }
    }
    if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
      const settings = { ...(stored.value || {}), ...body }
      await writeLocalData('settings', settings)
      return { handled: true, data: { settings } }
    }
  }

  if (path === '/stats' && method === 'GET') {
    const [tasks, diaries, listTasks] = await Promise.all([
      loadCollection<any>('tasks'),
      loadCollection<any>('diaries'),
      loadCollection<any>('listTasks')
    ])
    return {
      handled: true,
      data: {
        stats: {
          checklistCount: listTasks.reduce((sum, task) => sum + (Array.isArray(task.checklist) ? task.checklist.length : 0), 0),
          listTaskCount: listTasks.length,
          footprintTaskCount: tasks.length + diaries.length
        }
      }
    }
  }

  if (path.startsWith('/data/')) return { handled: true, data: await localGenericData(path, method, body) }

  if (path === '/clean' && method === 'POST') {
    for (const key of Object.keys(body)) await removeLocalData(key)
    return { handled: true, data: { success: true } }
  }

  return { handled: false }
}
