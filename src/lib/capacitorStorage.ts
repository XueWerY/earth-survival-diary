import { logger } from './logger'

const PREFIX = 'esd_'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, data: any) {
  localStorage.setItem(PREFIX + key, JSON.stringify(data))
}

function remove(key: string) {
  localStorage.removeItem(PREFIX + key)
}

function getAllLocalKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) keys.push(key)
  }
  return keys
}

function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const chr = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return 'hash_' + Math.abs(hash).toString(16)
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

function generateToken(userId: string): string {
  return btoa(`${userId}:${Date.now()}:${Math.random().toString(36).substring(2)}`)
}

function verifyToken(token: string): string | null {
  try {
    const payload = atob(token)
    const [userId] = payload.split(':')
    return userId || null
  } catch {
    return null
  }
}

// ============ User Index ============

interface UserEntry {
  id: string
  email: string
  passwordHash: string
  nickname: string
  createdAt: string
}

function getUsersMap(): Record<string, UserEntry> {
  return read<Record<string, UserEntry>>('users', {})
}

function saveUsersMap(map: Record<string, UserEntry>) {
  write('users', map)
}

function getUserByEmail(email: string): UserEntry | null {
  return getUsersMap()[email] || null
}

function setUserEntry(email: string, entry: UserEntry) {
  const map = getUsersMap()
  map[email] = entry
  saveUsersMap(map)
}

function deleteUserEntry(email: string) {
  const map = getUsersMap()
  delete map[email]
  saveUsersMap(map)
}

// ============ Data Storage ============

function getDataPath(userId: string, type: string, key: string): string {
  return `data_${userId}_${type}_${key.replace(/:/g, '__')}`
}

function getUserData<T>(userId: string, type: string, key: string, fallback: T): T {
  return read<T>(getDataPath(userId, type, key), fallback)
}

function setUserData(userId: string, type: string, key: string, data: any) {
  write(getDataPath(userId, type, key), data)
}

function deleteUserData(userId: string, type: string, key: string) {
  remove(getDataPath(userId, type, key))
}

// ============ Auth ============

export function capSignUp(email: string, password: string, nickname?: string) {
  if (getUserByEmail(email)) {
    throw new Error('该邮箱已被注册')
  }
  const userId = generateId()
  const userEntry: UserEntry = {
    id: userId,
    email,
    passwordHash: hashPassword(password),
    nickname: nickname || email.split('@')[0],
    createdAt: new Date().toISOString()
  }
  setUserEntry(email, userEntry)

  setUserData(userId, 'profile', 'profile', {
    id: userId,
    nickname: userEntry.nickname,
    createdAt: userEntry.createdAt
  })

  const token = generateToken(userId)
  setUserData(userId, 'session', 'session', { token, createdAt: new Date().toISOString() })

  logger.info('[CapStorage] 用户注册成功', { email })

  return {
    user: { id: userId, email, nickname: userEntry.nickname, createdAt: userEntry.createdAt },
    session: { access_token: token }
  }
}

export function capSignIn(email: string, password: string) {
  const userEntry = getUserByEmail(email)
  if (!userEntry) {
    throw new Error('该邮箱未注册')
  }
  if (userEntry.passwordHash !== hashPassword(password)) {
    throw new Error('密码错误')
  }
  const token = generateToken(userEntry.id)
  setUserData(userEntry.id, 'session', 'session', { token, createdAt: new Date().toISOString() })

  logger.info('[CapStorage] 用户登录成功', { email })

  return {
    user: { id: userEntry.id, email: userEntry.email, nickname: userEntry.nickname, createdAt: userEntry.createdAt },
    session: { access_token: token }
  }
}

export function capSignOut(token: string | null) {
  if (token) {
    const userId = verifyToken(token)
    if (userId) {
      deleteUserData(userId, 'session', 'session')
    }
  }
}

export function capDeleteAccount(token: string | null) {
  if (!token) throw new Error('未登录')
  const userId = verifyToken(token)
  if (!userId) throw new Error('登录已过期，请重新登录')
  const usersMap = getUsersMap()
  let userEmail = ''
  for (const email of Object.keys(usersMap)) {
    if (usersMap[email].id === userId) {
      userEmail = email
      break
    }
  }
  if (!userEmail) throw new Error('用户不存在')
  deleteUserEntry(userEmail)
  const allKeys = getAllLocalKeys()
  const prefix = PREFIX + `data_${userId}_`
  for (const key of allKeys) {
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key)
    }
  }
  logger.info('[CapStorage] 账号已注销', { userId })
  return { success: true }
}

export function capGetUser(token: string) {
  const userId = verifyToken(token)
  if (!userId) {
    throw new Error('登录已过期，请重新登录')
  }
  const usersMap = getUsersMap()
  for (const email of Object.keys(usersMap)) {
    if (usersMap[email].id === userId) {
      const profile = getUserData<{ nickname?: string; createdAt?: string }>(userId, 'profile', 'profile', {})
      return {
        user: {
          id: userId,
          email,
          nickname: profile.nickname || email.split('@')[0],
          createdAt: profile.createdAt
        }
      }
    }
  }
  throw new Error('用户不存在')
}

export function capGetUsers() {
  const map = getUsersMap()
  return {
    users: Object.values(map).map(u => ({
      email: u.email,
      nickname: u.nickname,
      createdAt: u.createdAt
    }))
  }
}

export function capGetAppSettings() {
  return { settings: read<Record<string, any>>('app_settings', {}) }
}

export function capUpdateAppSetting(key: string, value: any) {
  const settings = read<Record<string, any>>('app_settings', {})
  settings[key] = value
  write('app_settings', settings)
  return { success: true }
}

// ============ Profile ============

export function capGetProfile(userId: string) {
  const profile = getUserData<{ id: string; nickname: string; birthday?: string; phone?: string; createdAt?: string }>(
    userId, 'profile', 'profile', { id: userId, nickname: '' }
  )
  return { profile }
}

export function capUpdateProfile(userId: string, data: { nickname?: string; birthday?: string; phone?: string }) {
  const profile = getUserData<any>(userId, 'profile', 'profile', { id: userId, nickname: '' })
  if (data.nickname !== undefined) profile.nickname = data.nickname
  if (data.birthday !== undefined) profile.birthday = data.birthday
  if (data.phone !== undefined) profile.phone = data.phone
  setUserData(userId, 'profile', 'profile', profile)
  return { profile }
}

// ============ Tasks ============

export function capGetTasks(userId: string) {
  return { tasks: getUserData<any[]>(userId, 'footprint', 'footprint', []) }
}

export function capAddTask(userId: string, data: any) {
  const tasks = getUserData<any[]>(userId, 'footprint', 'footprint', [])
  const newTask = { ...data, id: generateId(), created_at: new Date().toISOString(), duration: 0, completed: false }
  tasks.unshift(newTask)
  setUserData(userId, 'footprint', 'footprint', tasks)
  return { task: newTask }
}

export function capUpdateTask(userId: string, taskId: string, updates: any) {
  const tasks = getUserData<any[]>(userId, 'footprint', 'footprint', [])
  const idx = tasks.findIndex((t: any) => t.id === taskId)
  if (idx === -1) throw new Error('任务不存在')
  Object.assign(tasks[idx], updates)
  setUserData(userId, 'footprint', 'footprint', tasks)
  return { task: tasks[idx] }
}

export function capDeleteTask(userId: string, taskId: string) {
  let tasks = getUserData<any[]>(userId, 'footprint', 'footprint', [])
  tasks = tasks.filter((t: any) => t.id !== taskId)
  setUserData(userId, 'footprint', 'footprint', tasks)
  return { success: true }
}

// ============ Task Lists ============

export function capGetLists(userId: string) {
  let lists = getUserData<any[]>(userId, 'list', 'lists', [])
  lists = lists.map((list: any) => {
    if (!list.groups || list.groups.length === 0) {
      list.groups = [{ id: `${list.id}-default`, name: '默认分组', color: '#667eea', order: 0 }]
    }
    return list
  }).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
  return { lists }
}

export function capAddList(userId: string, data: any) {
  const lists = getUserData<any[]>(userId, 'list', 'lists', [])
  const listId = generateId()
  const newList = {
    id: listId,
    name: data.name,
    icon: data.icon || '📋',
    groups: [{ id: `${listId}-default`, name: '默认分组', color: '#667eea', order: 0 }],
    created_at: new Date().toISOString()
  }
  lists.push(newList)
  setUserData(userId, 'list', 'lists', lists)
  return { list: newList }
}

export function capUpdateList(userId: string, listId: string, data: any) {
  const lists = getUserData<any[]>(userId, 'list', 'lists', [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('任务列表不存在')
  if (data.name !== undefined) lists[idx].name = data.name
  if (data.icon !== undefined) lists[idx].icon = data.icon
  setUserData(userId, 'list', 'lists', lists)
  return { list: lists[idx] }
}

export function capDeleteList(userId: string, listId: string) {
  let lists = getUserData<any[]>(userId, 'list', 'lists', [])
  let tasks = getUserData<any[]>(userId, 'list', 'tasks', [])
  lists = lists.filter((l: any) => l.id !== listId)
  tasks = tasks.filter((m: any) => m.list_id !== listId)
  setUserData(userId, 'list', 'lists', lists)
  setUserData(userId, 'list', 'tasks', tasks)
  return { success: true }
}

// ============ Task Groups ============

export function capUpdateGroup(userId: string, listId: string, groupId: string, data: any) {
  const lists = getUserData<any[]>(userId, 'list', 'lists', [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('使命列表不存在')
  const list = lists[idx]
  list.groups = list.groups || []
  let gIdx = list.groups.findIndex((g: any) => g.id === groupId)
  if (gIdx === -1) {
    const newGroup = { id: groupId, name: data.name || '默认分组', color: data.color || '#667eea', order: data.order !== undefined ? data.order : list.groups.length }
    list.groups.push(newGroup)
    setUserData(userId, 'list', 'lists', lists)
    return { group: newGroup }
  }
  if (data.name !== undefined) list.groups[gIdx].name = data.name
  if (data.color !== undefined) list.groups[gIdx].color = data.color
  if (data.order !== undefined) list.groups[gIdx].order = data.order
  setUserData(userId, 'list', 'lists', lists)
  return { group: list.groups[gIdx] }
}

export function capAddGroup(userId: string, listId: string, data: any) {
  const lists = getUserData<any[]>(userId, 'list', 'lists', [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('使命列表不存在')
  const list = lists[idx]
  list.groups = list.groups || []
  const newGroup = { id: Date.now().toString(), name: data.name || '新分组', color: data.color || '#667eea', order: data.order !== undefined ? data.order : list.groups.length }
  list.groups.push(newGroup)
  setUserData(userId, 'list', 'lists', lists)
  return { group: newGroup }
}

export function capDeleteGroup(userId: string, listId: string, groupId: string) {
  const lists = getUserData<any[]>(userId, 'list', 'lists', [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('使命列表不存在')
  const list = lists[idx]
  list.groups = list.groups || []
  if (list.groups.length <= 1) throw new Error('至少需要保留一个分组')
  list.groups = list.groups.filter((g: any) => g.id !== groupId)
  setUserData(userId, 'list', 'lists', lists)
  return { success: true }
}

export function capReorderLists(userId: string, orders: { id: string; order: number }[]) {
  const lists = getUserData<any[]>(userId, 'list', 'lists', [])
  orders.forEach(({ id, order }) => {
    const i = lists.findIndex((l: any) => l.id === id)
    if (i !== -1) lists[i].order = order
  })
  lists.sort((a: any, b: any) => a.order - b.order)
  setUserData(userId, 'list', 'lists', lists)
  return { lists }
}

export function capReorderGroups(userId: string, listId: string, orders: { id: string; order: number }[]) {
  const lists = getUserData<any[]>(userId, 'list', 'lists', [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('使命列表不存在')
  const list = lists[idx]
  list.groups = list.groups || []
  orders.forEach(({ id, order }) => {
    const i = list.groups.findIndex((g: any) => g.id === id)
    if (i !== -1) list.groups[i].order = order
  })
  list.groups.sort((a: any, b: any) => a.order - b.order)
  setUserData(userId, 'list', 'lists', lists)
  return { groups: list.groups }
}

// ============ Tasks ============

export function capGetTasks(userId: string, listId?: string) {
  let tasks = getUserData<any[]>(userId, 'list', 'tasks', [])
  if (listId) tasks = tasks.filter((m: any) => m.list_id === listId)
  return { tasks }
}

export function capAddTask(userId: string, data: any) {
  const tasks = getUserData<any[]>(userId, 'list', 'tasks', [])
  const newTask = {
    id: generateId(),
    list_id: data.listId,
    name: data.name,
    description: data.description || null,
    target_count: data.targetCount || 1,
    current_count: 0,
    completed: false,
    group_id: data.groupId || '',
    date: data.date || '',
    end_time: data.endTime || '',
    repeat_strategy: data.repeatStrategy || 'none',
    repeat_custom_days: data.repeatCustomDays || 1,
    repeat_weekdays: data.repeatWeekdays || [],
    repeat_end_strategy: data.repeatEndStrategy || 'never',
    repeat_end_date: data.repeatEndDate || '',
    repeat_count: data.repeatCount || 1,
    repeat_completed_count: 0,
    priority: data.priority || 'none',
    checklist: data.checklist || [],
    completed_start_time: '',
    completed_end_time: '',
    notes: data.notes || '',
    reminder_strategy: data.reminderStrategy || 'none',
    reminder_days: data.reminderDays || 0,
    reminder_hours: data.reminderHours || 0,
    reminder_minutes: data.reminderMinutes || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  tasks.push(newTask)
  setUserData(userId, 'list', 'tasks', tasks)
  return { task: newTask }
}

export function capUpdateTask(userId: string, taskId: string, updates: any) {
  const tasks = getUserData<any[]>(userId, 'list', 'tasks', [])
  const idx = tasks.findIndex((m: any) => m.id === taskId)
  if (idx === -1) throw new Error('任务不存在')
  const task = tasks[idx]
  const fieldMap: Record<string, string> = {
    name: 'name', description: 'description', targetCount: 'target_count',
    currentCount: 'current_count', completed: 'completed', groupId: 'group_id',
    date: 'date', endTime: 'end_time',
    repeatStrategy: 'repeat_strategy', repeatCustomDays: 'repeat_custom_days',
    repeatWeekdays: 'repeat_weekdays',
    repeatEndStrategy: 'repeat_end_strategy', repeatEndDate: 'repeat_end_date',
    repeatCount: 'repeat_count', repeatCompletedCount: 'repeat_completed_count',
    priority: 'priority', checklist: 'checklist',
    completedStartTime: 'completed_start_time', completedEndTime: 'completed_end_time',
    notes: 'notes', reminderStrategy: 'reminder_strategy',
    reminderDays: 'reminder_days', reminderHours: 'reminder_hours',
    reminderMinutes: 'reminder_minutes'
  }
  for (const [key, field] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) task[field] = updates[key]
  }
  task.updated_at = new Date().toISOString()
  setUserData(userId, 'list', 'tasks', tasks)
  return { task }
}

export function capDeleteTask(userId: string, taskId: string) {
  let tasks = getUserData<any[]>(userId, 'list', 'tasks', [])
  tasks = tasks.filter((m: any) => m.id !== taskId)
  setUserData(userId, 'list', 'tasks', tasks)
  return { success: true }
}

// ============ Stats ============

export function capGetStats(userId: string) {
  const lists = getUserData<any[]>(userId, 'list', 'lists', [])
  const listTasks = getUserData<any[]>(userId, 'list', 'tasks', [])
  const footprintTasks = getUserData<any[]>(userId, 'footprint', 'footprint', [])
  return { stats: { listCount: lists.length, listTaskCount: listTasks.length, taskCount: footprintTasks.length } }
}

// ============ Data API ============

export function capGetData<T>(userId: string, type: string, key: string): T | null {
  return getUserData<T | null>(userId, type, key, null)
}

export function capSetData(userId: string, type: string, key: string, data: any) {
  setUserData(userId, type, key, data)
  return { success: true }
}

export function capDeleteData(userId: string, type: string, key: string) {
  deleteUserData(userId, type, key)
  return { success: true }
}

// ============ Settings ============

export function capGetSettings(userId: string) {
  return { settings: getUserData<Record<string, any>>(userId, 'settings', 'settings', {}) }
}

export function capUpdateSettings(userId: string, data: Record<string, any>) {
  const existing = getUserData<Record<string, any>>(userId, 'settings', 'settings', {})
  const merged = { ...existing, ...data }
  setUserData(userId, 'settings', 'settings', merged)
  return { settings: merged }
}

// ============ Utils ============

export function capGetUserIdFromToken(token: string): string | null {
  return verifyToken(token)
}

export function capGetTokenFromStorage(): string | null {
  return localStorage.getItem('auth_token')
}

export { hashPassword, generateId }