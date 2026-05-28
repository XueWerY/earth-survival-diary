import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { logger } from './logger'

const DATA_DIR = 'data/'

// ============ Virtual File System ============

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const result = await Filesystem.readFile({
      path: DATA_DIR + filePath,
      directory: Directory.Data,
      encoding: Encoding.UTF8
    })
    return JSON.parse(result.data as string)
  } catch {
    return fallback
  }
}

async function writeJson(filePath: string, data: any) {
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/'))
  if (dirPath) {
    try {
      await Filesystem.mkdir({
        path: DATA_DIR + dirPath,
        directory: Directory.Data,
        recursive: true
      })
    } catch {}
  }
  await Filesystem.writeFile({
    path: DATA_DIR + filePath,
    data: JSON.stringify(data),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true
  })
}

async function deleteFile(filePath: string) {
  try {
    await Filesystem.deleteFile({
      path: DATA_DIR + filePath,
      directory: Directory.Data
    })
  } catch {}
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await Filesystem.stat({
      path: DATA_DIR + filePath,
      directory: Directory.Data
    })
    return true
  } catch {
    return false
  }
}

async function getAllFileKeys(prefix: string = ''): Promise<string[]> {
  const result: string[] = []
  try {
    const dirResult = await Filesystem.readdir({
      path: DATA_DIR + prefix,
      directory: Directory.Data
    })
    for (const entry of dirResult.files) {
      const full = prefix ? prefix + '/' + entry.name : entry.name
      if (entry.type === 'file') {
        result.push(full)
      } else {
        const subFiles = await getAllFileKeys(full)
        result.push(...subFiles)
      }
    }
  } catch {}
  return result
}

async function deleteDir(dirPath: string) {
  try {
    const entries = await Filesystem.readdir({
      path: DATA_DIR + dirPath,
      directory: Directory.Data
    })
    for (const entry of entries.files) {
      const full = dirPath + '/' + entry.name
      if (entry.type === 'file') {
        await Filesystem.deleteFile({
          path: DATA_DIR + full,
          directory: Directory.Data
        })
      } else {
        await deleteDir(full)
      }
    }
    await Filesystem.rmdir({
      path: DATA_DIR + dirPath,
      directory: Directory.Data
    })
  } catch {}
}

// ============ Helpers ============

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

// ============ Path Helpers ============

function userIndexPath(email: string): string {
  return `users/${email}.json`
}

function userDataPath(userId: string, ...segments: string[]): string {
  return [userId, ...segments].join('/') + '.json'
}

// ============ User Index ============

interface UserEntry {
  id: string
  email: string
  passwordHash: string
  nickname: string
  createdAt: string
}

async function getUserByEmail(email: string): Promise<UserEntry | null> {
  return readJson<UserEntry | null>(userIndexPath(email), null)
}

async function getAllUserEmails(): Promise<string[]> {
  const keys = await getAllFileKeys('users')
  return keys
    .filter(k => k.startsWith('users/') && k.endsWith('.json'))
    .map(k => k.replace('users/', '').replace('.json', ''))
}

// ============ Auth ============

export async function fsSignUp(email: string, password: string, nickname?: string) {
  if (await getUserByEmail(email)) {
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
  await writeJson(userIndexPath(email), userEntry)

  await writeJson(userDataPath(userId, 'profile', 'profile'), {
    id: userId,
    nickname: userEntry.nickname,
    createdAt: userEntry.createdAt
  })

  const token = generateToken(userId)
  await writeJson(userDataPath(userId, 'session', 'session'), { token, createdAt: new Date().toISOString() })

  logger.info('[FileStore] 用户注册成功', { email })

  return {
    user: { id: userId, email, nickname: userEntry.nickname, createdAt: userEntry.createdAt },
    session: { access_token: token }
  }
}

export async function fsSignIn(email: string, password: string) {
  const userEntry = await getUserByEmail(email)
  if (!userEntry) {
    throw new Error('该邮箱未注册')
  }
  if (userEntry.passwordHash !== hashPassword(password)) {
    throw new Error('密码错误')
  }
  const token = generateToken(userEntry.id)
  await writeJson(userDataPath(userEntry.id, 'session', 'session'), { token, createdAt: new Date().toISOString() })

  logger.info('[FileStore] 用户登录成功', { email })

  return {
    user: { id: userEntry.id, email: userEntry.email, nickname: userEntry.nickname, createdAt: userEntry.createdAt },
    session: { access_token: token }
  }
}

export async function fsSignOut(token: string | null) {
  if (token) {
    const userId = verifyToken(token)
    if (userId) {
      await deleteFile(userDataPath(userId, 'session', 'session'))
    }
  }
}

export async function fsDeleteAccount(token: string | null) {
  if (!token) throw new Error('未登录')
  const userId = verifyToken(token)
  if (!userId) throw new Error('登录已过期，请重新登录')
  const emails = await getAllUserEmails()
  let userEmail = ''
  for (const email of emails) {
    const user = await getUserByEmail(email)
    if (user && user.id === userId) {
      userEmail = email
      break
    }
  }
  if (!userEmail) throw new Error('用户不存在')
  await deleteFile(userIndexPath(userEmail))
  await deleteDir(userId)
  logger.info('[FileStore] 账号已注销', { userId })
  return { success: true }
}

export async function fsGetUser(token: string) {
  const userId = verifyToken(token)
  if (!userId) {
    throw new Error('登录已过期，请重新登录')
  }
  const emails = await getAllUserEmails()
  for (const email of emails) {
    const user = await getUserByEmail(email)
    if (user && user.id === userId) {
      const profile = await readJson<{ nickname?: string; createdAt?: string }>(
        userDataPath(userId, 'profile', 'profile'), {}
      )
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

export async function fsGetUsers() {
  const emails = await getAllUserEmails()
  const users = await Promise.all(emails.map(async email => {
    const user = await getUserByEmail(email)
    return user ? { email: user.email, nickname: user.nickname, createdAt: user.createdAt } : null
  }))
  return { users: users.filter(Boolean) }
}

export async function fsGetAppSettings() {
  const settings = await readJson<Record<string, any>>('settings/settings.json', {})
  return { settings }
}

export async function fsUpdateAppSetting(key: string, value: any) {
  const settings = await readJson<Record<string, any>>('settings/settings.json', {})
  settings[key] = value
  await writeJson('settings/settings.json', settings)
  return { success: true }
}

// ============ Profile ============

export async function fsGetProfile(userId: string) {
  const profile = await readJson<{ id: string; nickname: string; birthday?: string; phone?: string; createdAt?: string }>(
    userDataPath(userId, 'profile', 'profile'), { id: userId, nickname: '' }
  )
  return { profile }
}

export async function fsUpdateProfile(userId: string, data: { nickname?: string; birthday?: string; phone?: string }) {
  const profile = await readJson<any>(userDataPath(userId, 'profile', 'profile'), { id: userId, nickname: '' })
  if (data.nickname !== undefined) profile.nickname = data.nickname
  if (data.birthday !== undefined) profile.birthday = data.birthday
  if (data.phone !== undefined) profile.phone = data.phone
  await writeJson(userDataPath(userId, 'profile', 'profile'), profile)
  return { profile }
}

// ============ Tasks ============

export async function fsGetTasks(userId: string) {
  const tasks = await readJson<any[]>(userDataPath(userId, 'footprint', 'footprint'), [])
  return { tasks }
}

export async function fsAddTask(userId: string, data: any) {
  const tasks = await readJson<any[]>(userDataPath(userId, 'footprint', 'footprint'), [])
  const newTask = { ...data, id: generateId(), created_at: new Date().toISOString(), duration: 0, completed: false }
  tasks.unshift(newTask)
  await writeJson(userDataPath(userId, 'footprint', 'footprint'), tasks)
  return { task: newTask }
}

export async function fsUpdateTask(userId: string, taskId: string, updates: any) {
  const tasks = await readJson<any[]>(userDataPath(userId, 'footprint', 'footprint'), [])
  const idx = tasks.findIndex((t: any) => t.id === taskId)
  if (idx === -1) throw new Error('任务不存在')
  Object.assign(tasks[idx], updates)
  await writeJson(userDataPath(userId, 'footprint', 'footprint'), tasks)
  return { task: tasks[idx] }
}

export async function fsDeleteTask(userId: string, taskId: string) {
  let tasks = await readJson<any[]>(userDataPath(userId, 'footprint', 'footprint'), [])
  tasks = tasks.filter((t: any) => t.id !== taskId)
  await writeJson(userDataPath(userId, 'footprint', 'footprint'), tasks)
  return { success: true }
}

// ============ Mission Lists ============

export async function fsGetMissionLists(userId: string) {
  let lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  lists = lists.map((list: any) => {
    if (!list.groups || list.groups.length === 0) {
      list.groups = [{ id: `${list.id}-default`, name: '默认分组', color: '#667eea', order: 0 }]
    }
    return list
  }).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
  return { lists }
}

export async function fsAddMissionList(userId: string, data: any) {
  const lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  const listId = generateId()
  const newList = {
    id: listId,
    name: data.name,
    icon: data.icon || '📋',
    groups: [{ id: `${listId}-default`, name: '默认分组', color: '#667eea', order: 0 }],
    created_at: new Date().toISOString()
  }
  lists.push(newList)
  await writeJson(userDataPath(userId, 'list', 'lists'), lists)
  return { list: newList }
}

export async function fsUpdateMissionList(userId: string, listId: string, data: any) {
  const lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('使命列表不存在')
  if (data.name !== undefined) lists[idx].name = data.name
  if (data.icon !== undefined) lists[idx].icon = data.icon
  await writeJson(userDataPath(userId, 'list', 'lists'), lists)
  return { list: lists[idx] }
}

export async function fsDeleteMissionList(userId: string, listId: string) {
  let lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  let missions = await readJson<any[]>(userDataPath(userId, 'list', 'tasks'), [])
  lists = lists.filter((l: any) => l.id !== listId)
  missions = missions.filter((m: any) => m.list_id !== listId)
  await writeJson(userDataPath(userId, 'list', 'lists'), lists)
  await writeJson(userDataPath(userId, 'list', 'tasks'), missions)
  return { success: true }
}

// ============ Mission Groups ============

export async function fsUpdateMissionGroup(userId: string, listId: string, groupId: string, data: any) {
  const lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('使命列表不存在')
  const list = lists[idx]
  list.groups = list.groups || []
  let gIdx = list.groups.findIndex((g: any) => g.id === groupId)
  if (gIdx === -1) {
    const newGroup = { id: groupId, name: data.name || '默认分组', color: data.color || '#667eea', order: data.order !== undefined ? data.order : list.groups.length }
    list.groups.push(newGroup)
    await writeJson(userDataPath(userId, 'list', 'lists'), lists)
    return { group: newGroup }
  }
  if (data.name !== undefined) list.groups[gIdx].name = data.name
  if (data.color !== undefined) list.groups[gIdx].color = data.color
  if (data.order !== undefined) list.groups[gIdx].order = data.order
  await writeJson(userDataPath(userId, 'list', 'lists'), lists)
  return { group: list.groups[gIdx] }
}

export async function fsAddMissionGroup(userId: string, listId: string, data: any) {
  const lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('使命列表不存在')
  const list = lists[idx]
  list.groups = list.groups || []
  const newGroup = { id: Date.now().toString(), name: data.name || '新分组', color: data.color || '#667eea', order: data.order !== undefined ? data.order : list.groups.length }
  list.groups.push(newGroup)
  await writeJson(userDataPath(userId, 'list', 'lists'), lists)
  return { group: newGroup }
}

export async function fsDeleteMissionGroup(userId: string, listId: string, groupId: string) {
  const lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('使命列表不存在')
  const list = lists[idx]
  list.groups = list.groups || []
  if (list.groups.length <= 1) throw new Error('至少需要保留一个分组')
  list.groups = list.groups.filter((g: any) => g.id !== groupId)
  await writeJson(userDataPath(userId, 'list', 'lists'), lists)
  return { success: true }
}

export async function fsReorderMissionLists(userId: string, orders: { id: string; order: number }[]) {
  const lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  orders.forEach(({ id, order }) => {
    const i = lists.findIndex((l: any) => l.id === id)
    if (i !== -1) lists[i].order = order
  })
  lists.sort((a: any, b: any) => a.order - b.order)
  await writeJson(userDataPath(userId, 'list', 'lists'), lists)
  return { lists }
}

export async function fsReorderGroups(userId: string, listId: string, orders: { id: string; order: number }[]) {
  const lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  const idx = lists.findIndex((l: any) => l.id === listId)
  if (idx === -1) throw new Error('使命列表不存在')
  const list = lists[idx]
  list.groups = list.groups || []
  orders.forEach(({ id, order }) => {
    const i = list.groups.findIndex((g: any) => g.id === id)
    if (i !== -1) list.groups[i].order = order
  })
  list.groups.sort((a: any, b: any) => a.order - b.order)
  await writeJson(userDataPath(userId, 'list', 'lists'), lists)
  return { groups: list.groups }
}

// ============ Missions ============

export async function fsGetMissions(userId: string, listId?: string) {
  let missions = await readJson<any[]>(userDataPath(userId, 'list', 'tasks'), [])
  if (listId) missions = missions.filter((m: any) => m.list_id === listId)
  return { missions }
}

export async function fsAddMission(userId: string, data: any) {
  const missions = await readJson<any[]>(userDataPath(userId, 'list', 'tasks'), [])
  const newMission = {
    id: generateId(),
    list_id: data.listId,
    name: data.name,
    description: data.description || null,
    target_count: data.targetCount || 1,
    current_count: 0,
    completed: false,
    group_id: data.groupId || '',
    date: data.date || '',
    start_time: data.startTime || '',
    end_time: data.endTime || '',
    repeat_strategy: data.repeatStrategy || 'none',
    repeat_custom_days: data.repeatCustomDays || 1,
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
  missions.push(newMission)
  await writeJson(userDataPath(userId, 'list', 'tasks'), missions)
  return { mission: newMission }
}

export async function fsUpdateMission(userId: string, missionId: string, updates: any) {
  const missions = await readJson<any[]>(userDataPath(userId, 'list', 'tasks'), [])
  const idx = missions.findIndex((m: any) => m.id === missionId)
  if (idx === -1) throw new Error('使命不存在')
  const mission = missions[idx]
  const fieldMap: Record<string, string> = {
    name: 'name', description: 'description', targetCount: 'target_count',
    currentCount: 'current_count', completed: 'completed', groupId: 'group_id',
    date: 'date', startTime: 'start_time', endTime: 'end_time',
    repeatStrategy: 'repeat_strategy', repeatCustomDays: 'repeat_custom_days',
    repeatEndStrategy: 'repeat_end_strategy', repeatEndDate: 'repeat_end_date',
    repeatCount: 'repeat_count', repeatCompletedCount: 'repeat_completed_count',
    priority: 'priority', checklist: 'checklist',
    completedStartTime: 'completed_start_time', completedEndTime: 'completed_end_time',
    notes: 'notes', reminderStrategy: 'reminder_strategy',
    reminderDays: 'reminder_days', reminderHours: 'reminder_hours',
    reminderMinutes: 'reminder_minutes'
  }
  for (const [key, field] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) mission[field] = updates[key]
  }
  mission.updated_at = new Date().toISOString()
  await writeJson(userDataPath(userId, 'list', 'tasks'), missions)
  return { mission }
}

export async function fsDeleteMission(userId: string, missionId: string) {
  let missions = await readJson<any[]>(userDataPath(userId, 'list', 'tasks'), [])
  missions = missions.filter((m: any) => m.id !== missionId)
  await writeJson(userDataPath(userId, 'list', 'tasks'), missions)
  return { success: true }
}

// ============ Stats ============

export async function fsGetStats(userId: string) {
  const lists = await readJson<any[]>(userDataPath(userId, 'list', 'lists'), [])
  const missions = await readJson<any[]>(userDataPath(userId, 'list', 'tasks'), [])
  const tasks = await readJson<any[]>(userDataPath(userId, 'footprint', 'footprint'), [])
  return { stats: { listCount: lists.length, missionCount: missions.length, taskCount: tasks.length } }
}

// ============ Data API ============

export async function fsGetData<T>(userId: string, type: string, key: string): Promise<T | null> {
  return readJson<T | null>(userDataPath(userId, type, key), null)
}

export async function fsSetData(userId: string, type: string, key: string, data: any) {
  await writeJson(userDataPath(userId, type, key), data)
  return { success: true }
}

export async function fsDeleteData(userId: string, type: string, key: string) {
  await deleteFile(userDataPath(userId, type, key))
  return { success: true }
}

// ============ Settings ============

export async function fsGetSettings(userId: string) {
  const settings = await readJson<Record<string, any>>(userDataPath(userId, 'settings', 'settings'), {})
  return { settings }
}

export async function fsUpdateSettings(userId: string, data: Record<string, any>) {
  const existing = await readJson<Record<string, any>>(userDataPath(userId, 'settings', 'settings'), {})
  const merged = { ...existing, ...data }
  await writeJson(userDataPath(userId, 'settings', 'settings'), merged)
  return { settings: merged }
}

// ============ Utils ============

export function fsGetUserIdFromToken(token: string): string | null {
  return verifyToken(token)
}