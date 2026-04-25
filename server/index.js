import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import crypto from 'crypto'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import Redis from 'ioredis'

const app = express()
const PORT = process.env.DEPLOY_RUN_PORT || process.env.PORT || 3001

// 创建 HTTP 服务器
const server = createServer(app)

// WebSocket 端点管理
const wsEndpoints = new Map()

// 用户 WebSocket 连接管理 (userId -> WebSocket)
const userWsConnections = new Map()

// 创建 WebSocket 端点
function createWsEndpoint(path) {
  const wss = new WebSocketServer({ noServer: true })
  wsEndpoints.set(path, wss)
  return wss
}

// 设置会话通知 WebSocket 端点
const sessionWss = createWsEndpoint('/ws/session')
sessionWss.on('connection', (ws, req) => {
  console.log('WebSocket 客户端已连接到 /ws/session')

  let userId = null

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', payload: null }))
        return
      }

      // 注册用户连接
      if (msg.type === 'auth' && msg.payload?.token) {
        const token = msg.payload.token
        userId = verifyToken(token)
        if (userId) {
          userWsConnections.set(userId, ws)
          ws.userId = userId
          console.log(`WebSocket 用户 ${userId} 已注册`)
        }
      }
    } catch (e) {
      console.error('WebSocket message parse error:', e)
    }
  })

  ws.on('close', () => {
    if (userId) {
      userWsConnections.delete(userId)
      console.log(`WebSocket 用户 ${userId} 已断开`)
    }
  })

  // 心跳检测
  let alive = true
  const interval = setInterval(() => {
    if (!alive) {
      ws.terminate()
      return
    }
    alive = false
    ws.ping()
  }, 30000)

  ws.on('pong', () => { alive = true })
  ws.on('close', () => clearInterval(interval))
})

// 处理 WebSocket upgrade 请求
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`)
  const wss = wsEndpoints.get(pathname)

  if (wss) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  } else {
    socket.destroy()
  }
})

// 向用户发送踢出通知
function notifyKickedOut(userId) {
  console.log(`[踢出通知] 尝试踢出用户 ${userId}`)
  console.log(`[踢出通知] 当前已注册的 WebSocket 连接数: ${userWsConnections.size}`)
  console.log(`[踢出通知] 已注册的用户: ${Array.from(userWsConnections.keys()).join(', ')}`)

  const ws = userWsConnections.get(userId)
  console.log(`[踢出通知] WebSocket 连接: ${ws ? '存在' : '不存在'}`)
  if (ws) {
    console.log(`[踢出通知] WebSocket 状态: ${ws.readyState} (OPEN=${WebSocket.OPEN})`)
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'kicked_out', payload: { message: '账号已在其他设备登录' } }))
    console.log(`[踢出通知] 已向用户 ${userId} 发送踢出消息`)
    // 立即从映射中移除，防止重复发送
    userWsConnections.delete(userId)
  } else {
    console.log(`[踢出通知] 用户 ${userId} 的 WebSocket 连接不可用，无法发送踢出消息`)
  }
}

// 数据目录
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const LEGACY_DATA_FILE = path.join(DATA_DIR, 'app-data.yaml')

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// ============ Redis 配置 ============

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || null,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy(times) {
    if (times > 3) return null
    return Math.min(times * 100, 3000)
  }
})

redis.on('error', (err) => {
  console.error('Redis error:', err.message)
  writeServerLog('error', 'Redis error', { message: err.message })
})

redis.on('ready', () => {
  console.log('Redis connected successfully')
})

// ============ Redis 键名工具函数 ============

const keys = {
  userIndex: (email) => `user:index:${email}`,
  userProfile: (userId) => `user:${userId}:profile`,
  userTasks: (userId) => `user:${userId}:footprint:records`,
  userMissionLists: (userId) => `user:${userId}:list:lists`,
  userMissions: (userId) => `user:${userId}:list:tasks`,
  userSettings: (userId) => `user:${userId}:settings`,
  userKV: (userId, key) => `user:${userId}:${key}`,
  userSystemState: (userId) => `user:${userId}:system:state`
}

async function getUserSystemState(userId) {
  const data = await redis.get(keys.userSystemState(userId))
  return data ? JSON.parse(data) : {}
}

async function setUserSystemState(userId, state) {
  await redis.set(keys.userSystemState(userId), JSON.stringify(state))
}

async function getUserSession(userId) {
  const state = await getUserSystemState(userId)
  return state.session || null
}

async function setUserSession(userId, token) {
  const state = await getUserSystemState(userId)
  state.session = { token }
  await setUserSystemState(userId, state)
}

async function deleteUserSession(userId) {
  const state = await getUserSystemState(userId)
  delete state.session
  await setUserSystemState(userId, state)
}

// 确保 Redis 键存在
async function ensureUserKeys(userId) {
  const profile = await redis.get(keys.userProfile(userId))
  if (!profile) {
    await redis.set(keys.userProfile(userId), JSON.stringify({}))
  }
}

// ============ 用户管理 ============

// 获取用户索引
async function getUserIndex(email) {
  const data = await redis.hgetall(keys.userIndex(email))
  if (!data || !data.id) return null
  return {
    id: data.id,
    email: data.email,
    passwordHash: data.passwordHash,
    nickname: data.nickname,
    createdAt: data.createdAt
  }
}

// 保存用户索引
async function setUserIndex(email, user) {
  await redis.hmset(keys.userIndex(email), {
    id: user.id,
    email: user.email || email,
    passwordHash: user.passwordHash || '',
    nickname: user.nickname || email.split('@')[0],
    createdAt: user.createdAt || new Date().toISOString()
  })
}

// 删除用户索引
async function deleteUserIndex(email) {
  await redis.del(keys.userIndex(email))
}

// 获取所有用户邮箱
async function getAllUserEmails() {
  const keys = await redis.keys('user:index:*')
  return keys.map(k => k.replace('user:index:', ''))
}

// 检查邮箱是否存在
async function emailExists(email) {
  const user = await getUserIndex(email)
  return !!user
}

// 密码哈希
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// 生成用户 ID
function generateUserId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

// 生成 token
function generateToken(userId) {
  const payload = `${userId}:${Date.now()}:${Math.random().toString(36).substr(2)}`
  return Buffer.from(payload).toString('base64')
}

// 验证 token
function verifyToken(token) {
  try {
    const payload = Buffer.from(token, 'base64').toString('utf-8')
    const [userId] = payload.split(':')
    return userId || null
  } catch {
    return null
  }
}

// 获取用户 Profile
async function getUserProfile(userId) {
  const data = await redis.get(keys.userProfile(userId))
  return data ? JSON.parse(data) : {}
}

// 保存用户 Profile
async function setUserProfile(userId, profile) {
  await redis.set(keys.userProfile(userId), JSON.stringify(profile))
}

// 获取任务列表
async function getUserTasks(userId) {
  const data = await redis.get(keys.userTasks(userId))
  return data ? JSON.parse(data) : []
}

// 保存任务列表
async function setUserTasks(userId, tasks) {
  await redis.set(keys.userTasks(userId), JSON.stringify(tasks))
}

// 获取使命列表
async function getUserMissionLists(userId) {
  const data = await redis.get(keys.userMissionLists(userId))
  return data ? JSON.parse(data) : []
}

// 保存使命列表
async function setUserMissionLists(userId, lists) {
  await redis.set(keys.userMissionLists(userId), JSON.stringify(lists))
}

// 获取使命数据
async function getUserMissions(userId) {
  const data = await redis.get(keys.userMissions(userId))
  return data ? JSON.parse(data) : []
}

// 保存使命数据
async function setUserMissions(userId, missions) {
  await redis.set(keys.userMissions(userId), JSON.stringify(missions))
}

// 获取用户设置
async function getUserSettings(userId) {
  const data = await redis.get(keys.userSettings(userId))
  return data ? JSON.parse(data) : {}
}

// 保存用户设置
async function setUserSettings(userId, settings) {
  await redis.set(keys.userSettings(userId), JSON.stringify(settings))
}

// 获取 KV 数据
async function getUserKV(userId, key) {
  const data = await redis.get(keys.userKV(userId, key))
  return data ? JSON.parse(data) : null
}

// 设置 KV 数据
async function setUserKV(userId, key, value) {
  await redis.set(keys.userKV(userId, key), JSON.stringify(value))
}

// 删除 KV 数据
async function deleteUserKV(userId, key) {
  await redis.del(keys.userKV(userId, key))
}

// ============ 中间件 ============

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '10mb' }))

// 认证中间件
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' })
  }

  const token = authHeader.substring(7)
  const userId = verifyToken(token)

  if (!userId) {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }

  // 检查单点登录：是否是当前活跃会话
  const session = await getUserSession(userId)
  if (!session) {
    // 服务器重启后自动恢复会话
    await setUserSession(userId, token)
  } else {
    if (session.token !== token) {
      return res.status(401).json({ error: '账号已在其他设备登录，请重新登录', kicked: true })
    }
  }

  // 检查用户是否存在
  const userEmails = await getAllUserEmails()
  let userEntry = null
  for (const email of userEmails) {
    const user = await getUserIndex(email)
    if (user && user.id === userId) {
      userEntry = user
      break
    }
  }

  if (!userEntry) {
    return res.status(401).json({ error: '用户不存在' })
  }

  req.userId = userId
  req.userEmail = userEntry.email
  next()
}

// ============ 认证 API ============

// 注册
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, nickname } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码必填' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' })
    }

    // 检查邮箱是否已存在
    if (await emailExists(email)) {
      return res.status(400).json({ error: '该邮箱已被注册' })
    }

    // 创建用户
    const userId = generateUserId()
    const userEntry = {
      id: userId,
      email: email,
      passwordHash: hashPassword(password),
      nickname: nickname || email.split('@')[0],
      createdAt: new Date().toISOString()
    }

    await setUserIndex(email, userEntry)

    // 初始化用户数据
    await setUserProfile(userId, {
      id: userId,
      nickname: userEntry.nickname,
      createdAt: userEntry.createdAt
    })

    // 生成 token
    const token = generateToken(userId)

    // 注册会话（单点登录）
    await setUserSession(userId, token)

    console.log(`用户注册成功: ${email}`)

    res.json({
      user: {
        id: userId,
        email: email,
        nickname: userEntry.nickname,
        createdAt: userEntry.createdAt
      },
      session: {
        access_token: token
      }
    })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ error: '注册失败，请稍后重试' })
  }
})

// 登录
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码必填' })
    }

    const userEntry = await getUserIndex(email)

    if (!userEntry) {
      return res.status(400).json({ error: '该邮箱未注册' })
    }

    if (userEntry.passwordHash !== hashPassword(password)) {
      return res.status(400).json({ error: '密码错误' })
    }

    // 生成 token
    const token = generateToken(userEntry.id)

    // 注册会话（单点登录，踢掉之前的会话）
    const prevSession = await getUserSession(userEntry.id)
    if (prevSession) {
      notifyKickedOut(userEntry.id)
      console.log(`用户 ${email} 的前一会话已被踢出`)
    }
    await setUserSession(userEntry.id, token)

    console.log(`用户登录成功: ${email}`)

    res.json({
      user: {
        id: userEntry.id,
        email: userEntry.email,
        nickname: userEntry.nickname,
        createdAt: userEntry.createdAt
      },
      session: {
        access_token: token
      }
    })
  } catch (error) {
    console.error('Signin error:', error)
    res.status(500).json({ error: '登录失败，请稍后重试' })
  }
})

// 登出
app.post('/api/auth/signout', async (req, res) => {
  // 清除会话
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const userId = verifyToken(token)
    if (userId) {
      await deleteUserSession(userId)
    }
  }
  res.json({ success: true })
})

// 修改邮箱
app.post('/api/auth/change-email', authMiddleware, async (req, res) => {
  try {
    const { newEmail, password } = req.body

    if (!newEmail || !password) {
      return res.status(400).json({ error: '新邮箱和密码必填' })
    }

    // 检查新邮箱是否已被使用
    if (await emailExists(newEmail)) {
      return res.status(400).json({ error: '该邮箱已被其他账号使用' })
    }

    // 验证当前密码
    const currentUser = await getUserIndex(req.userEmail)
    if (!currentUser || currentUser.passwordHash !== hashPassword(password)) {
      return res.status(400).json({ error: '密码错误' })
    }

    // 更新邮箱
    const oldEmail = req.userEmail
    await setUserIndex(newEmail, {
      ...currentUser,
      email: newEmail
    })
    await deleteUserIndex(oldEmail)

    // 更新 req.userEmail
    req.userEmail = newEmail

    console.log(`用户修改邮箱: ${oldEmail} -> ${newEmail}`)

    res.json({ success: true, email: newEmail })
  } catch (error) {
    console.error('Change email error:', error)
    res.status(500).json({ error: '修改邮箱失败' })
  }
})

// 修改密码
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '当前密码和新密码必填' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' })
    }

    const currentUser = await getUserIndex(req.userEmail)

    if (!currentUser || currentUser.passwordHash !== hashPassword(oldPassword)) {
      return res.status(400).json({ error: '当前密码错误' })
    }

    // 更新密码
    currentUser.passwordHash = hashPassword(newPassword)
    await setUserIndex(req.userEmail, currentUser)

    console.log(`用户修改密码: ${req.userEmail}`)

    res.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ error: '修改密码失败' })
  }
})

// 获取当前用户
app.get('/api/auth/user', authMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.userId)
    const currentUser = await getUserIndex(req.userEmail)
    res.json({
      user: {
        id: req.userId,
        email: req.userEmail,
        nickname: profile?.nickname || req.userEmail.split('@')[0],
        createdAt: profile?.createdAt
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

// ============ 检查会话状态（用于客户端轮询检测是否被踢出） ============
app.post('/api/auth/check-session', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ valid: false, kicked: false })
  }

  const token = authHeader.substring(7)
  const userId = verifyToken(token)

  if (!userId) {
    return res.json({ valid: false, kicked: false })
  }

  // 检查是否是当前活跃会话
  const session = await getUserSession(userId)
  if (!session) {
    // 服务器重启后自动恢复会话
    await setUserSession(userId, token)
    return res.json({ valid: true, kicked: false })
  }

  if (session.token !== token) {
    return res.json({ valid: false, kicked: true })
  }

  res.json({ valid: true, kicked: false })
})

// ============ 用户配置 API ============

// 获取用户配置
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.userId)
    res.json({
      profile: {
        id: req.userId,
        nickname: profile?.nickname || req.userEmail.split('@')[0],
        birthday: profile?.birthday || '',
        phone: profile?.phone || '',
        createdAt: profile?.createdAt
      }
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: '获取配置失败' })
  }
})

// 更新用户配置
app.put('/api/profile', authMiddleware, async (req, res) => {
  try {
    const { nickname, birthday, phone } = req.body

    const profile = await getUserProfile(req.userId)
    if (nickname !== undefined) profile.nickname = nickname
    if (birthday !== undefined) profile.birthday = birthday
    if (phone !== undefined) profile.phone = phone
    await setUserProfile(req.userId, profile)

    // 同时更新用户索引中的昵称
    if (nickname !== undefined) {
      const currentUser = await getUserIndex(req.userEmail)
      if (currentUser) {
        currentUser.nickname = nickname
        await setUserIndex(req.userEmail, currentUser)
      }
    }

    res.json({
      profile: {
        id: req.userId,
        nickname: profile.nickname || req.userEmail.split('@')[0],
        birthday: profile.birthday || '',
        phone: profile.phone || '',
        createdAt: profile.createdAt
      }
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ error: '更新配置失败' })
  }
})

// ============ 任务 API ============

// 获取任务列表
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const tasks = await getUserTasks(req.userId)
    res.json({ tasks })
  } catch (error) {
    console.error('Get tasks error:', error)
    res.status(500).json({ error: '获取任务失败' })
  }
})

// 添加任务
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { name, date, startTime, endTime, notes, category } = req.body

    const tasks = await getUserTasks(req.userId)

    const newTask = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name,
      date,
      startTime: startTime || null,
      endTime: endTime || null,
      duration: 0,
      completed: false,
      notes: notes || null,
      category: category || null,
      created_at: new Date().toISOString()
    }

    tasks.unshift(newTask)
    await setUserTasks(req.userId, tasks)

    res.json({ task: newTask })
  } catch (error) {
    console.error('Add task error:', error)
    res.status(500).json({ error: '添加任务失败' })
  }
})

// 更新任务
app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const tasks = await getUserTasks(req.userId)

    const taskIndex = tasks.findIndex(t => t.id === id)
    if (taskIndex === -1) {
      return res.status(404).json({ error: '任务不存在' })
    }

    const task = tasks[taskIndex]

    if (updates.name !== undefined) task.name = updates.name
    if (updates.date !== undefined) task.date = updates.date
    if (updates.startTime !== undefined) task.startTime = updates.startTime || null
    if (updates.endTime !== undefined) task.endTime = updates.endTime || null
    if (updates.notes !== undefined) task.notes = updates.notes || null
    if (updates.category !== undefined) task.category = updates.category || null
    if (updates.completed !== undefined) task.completed = updates.completed

    await setUserTasks(req.userId, tasks)
    res.json({ task })
  } catch (error) {
    console.error('Update task error:', error)
    res.status(500).json({ error: '更新任务失败' })
  }
})

// 删除任务
app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params

    const tasks = await getUserTasks(req.userId)

    const taskIndex = tasks.findIndex(t => t.id === id)
    if (taskIndex !== -1) {
      tasks.splice(taskIndex, 1)
      await setUserTasks(req.userId, tasks)
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Delete task error:', error)
    res.status(500).json({ error: '删除任务失败' })
  }
})

// ============ 使命列表 API ============

// 获取使命列表
app.get('/api/mission-lists', authMiddleware, async (req, res) => {
  try {
    let lists = await getUserMissionLists(req.userId)
    lists = lists.map(list => {
      if (!list.groups || list.groups.length === 0) {
        list.groups = [{
          id: `${list.id}-default`,
          name: '默认分组',
          color: '#667eea',
          order: 0
        }]
      }
      return list
    }).sort((a, b) => (a.order || 0) - (b.order || 0))
    res.json({ lists })
  } catch (error) {
    console.error('Get mission lists error:', error)
    res.status(500).json({ error: '获取使命列表失败' })
  }
})

// 添加使命列表
app.post('/api/mission-lists', authMiddleware, async (req, res) => {
  try {
    const { name, icon } = req.body

    const lists = await getUserMissionLists(req.userId)

    const listId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
    const groupId = Date.now().toString()
    const newList = {
      id: listId,
      name,
      icon: icon || '📋',
      groups: [{
        id: groupId,
        name: '默认分组',
        color: '#667eea',
        order: 0
      }],
      created_at: new Date().toISOString()
    }

    lists.push(newList)
    await setUserMissionLists(req.userId, lists)

    res.json({ list: newList })
  } catch (error) {
    console.error('Add mission list error:', error)
    res.status(500).json({ error: '添加使命列表失败' })
  }
})

// 批量更新使命列表顺序
app.put('/api/mission-lists/reorder', authMiddleware, async (req, res) => {
  try {
    const { orders } = req.body

    const lists = await getUserMissionLists(req.userId)

    orders.forEach(({ id, order }) => {
      const listIndex = lists.findIndex(l => l.id === id)
      if (listIndex !== -1) {
        lists[listIndex].order = order
      }
    })

    lists.sort((a, b) => a.order - b.order)
    await setUserMissionLists(req.userId, lists)
    res.json({ lists })
  } catch (error) {
    console.error('Reorder mission lists error:', error)
    res.status(500).json({ error: '更新使命列表顺序失败' })
  }
})

// 更新使命列表
app.put('/api/mission-lists/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { name, icon, order } = req.body

    const lists = await getUserMissionLists(req.userId)

    const listIndex = lists.findIndex(l => l.id === id)
    if (listIndex === -1) {
      return res.status(404).json({ error: '使命列表不存在' })
    }

    if (name !== undefined) lists[listIndex].name = name
    if (icon !== undefined) lists[listIndex].icon = icon
    if (order !== undefined) lists[listIndex].order = order

    await setUserMissionLists(req.userId, lists)
    res.json({ list: lists[listIndex] })
  } catch (error) {
    console.error('Update mission list error:', error)
    res.status(500).json({ error: '更新使命列表失败' })
  }
})

// 删除使命列表
app.delete('/api/mission-lists/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params

    const lists = await getUserMissionLists(req.userId)
    const missions = await getUserMissions(req.userId)

    const newLists = lists.filter(l => l.id !== id)
    const newMissions = missions.filter(m => m.list_id !== id)

    await setUserMissionLists(req.userId, newLists)
    await setUserMissions(req.userId, newMissions)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete mission list error:', error)
    res.status(500).json({ error: '删除使命列表失败' })
  }
})

// 批量更新分组顺序
app.put('/api/mission-lists/:listId/groups/reorder', authMiddleware, async (req, res) => {
  try {
    const { listId } = req.params
    const { orders } = req.body

    const lists = await getUserMissionLists(req.userId)

    const listIndex = lists.findIndex(l => l.id === listId)
    if (listIndex === -1) {
      return res.status(404).json({ error: '使命列表不存在' })
    }

    const list = lists[listIndex]
    list.groups = list.groups || []

    orders.forEach(({ id, order }) => {
      const groupIndex = list.groups.findIndex(g => g.id === id)
      if (groupIndex !== -1) {
        list.groups[groupIndex].order = order
      }
    })

    list.groups.sort((a, b) => a.order - b.order)
    await setUserMissionLists(req.userId, lists)
    res.json({ groups: list.groups })
  } catch (error) {
    console.error('Reorder groups error:', error)
    res.status(500).json({ error: '更新分组顺序失败' })
  }
})

// 添加分组到使命列表
app.post('/api/mission-lists/:listId/groups', authMiddleware, async (req, res) => {
  try {
    const { listId } = req.params
    const { name, color, order } = req.body

    const lists = await getUserMissionLists(req.userId)

    const listIndex = lists.findIndex(l => l.id === listId)
    if (listIndex === -1) {
      return res.status(404).json({ error: '使命列表不存在' })
    }

    const list = lists[listIndex]
    list.groups = list.groups || []

    const newGroup = {
      id: Date.now().toString(),
      name: name || '新分组',
      color: color || '#667eea',
      order: order !== undefined ? order : list.groups.length
    }

    list.groups.push(newGroup)
    await setUserMissionLists(req.userId, lists)
    res.json({ group: newGroup })
  } catch (error) {
    console.error('Add mission group error:', error)
    res.status(500).json({ error: '添加分组失败' })
  }
})

// 更新使命列表中的分组
app.put('/api/mission-lists/:listId/groups/:groupId', authMiddleware, async (req, res) => {
  try {
    const { listId, groupId } = req.params
    const { name, color, order } = req.body

    const lists = await getUserMissionLists(req.userId)

    const listIndex = lists.findIndex(l => l.id === listId)
    if (listIndex === -1) {
      return res.status(404).json({ error: '使命列表不存在' })
    }

    const list = lists[listIndex]
    list.groups = list.groups || []

    let groupIndex = list.groups.findIndex(g => g.id === groupId)
    if (groupIndex === -1) {
      const newGroup = {
        id: groupId,
        name: name || '默认分组',
        color: color || '#667eea',
        order: order !== undefined ? order : list.groups.length
      }
      list.groups.push(newGroup)
      await setUserMissionLists(req.userId, lists)
      return res.json({ group: newGroup })
    }

    if (name !== undefined) list.groups[groupIndex].name = name
    if (color !== undefined) list.groups[groupIndex].color = color
    if (order !== undefined) list.groups[groupIndex].order = order

    await setUserMissionLists(req.userId, lists)
    res.json({ group: list.groups[groupIndex] })
  } catch (error) {
    console.error('Update mission group error:', error)
    res.status(500).json({ error: '更新分组失败' })
  }
})

// 删除使命列表中的分组
app.delete('/api/mission-lists/:listId/groups/:groupId', authMiddleware, async (req, res) => {
  try {
    const { listId, groupId } = req.params

    const lists = await getUserMissionLists(req.userId)

    const listIndex = lists.findIndex(l => l.id === listId)
    if (listIndex === -1) {
      return res.status(404).json({ error: '使命列表不存在' })
    }

    const list = lists[listIndex]
    list.groups = list.groups || []

    if (list.groups.length <= 1) {
      return res.status(400).json({ error: '至少需要保留一个分组' })
    }

    const groupIndex = list.groups.findIndex(g => g.id === groupId)
    if (groupIndex === -1) {
      return res.status(404).json({ error: '分组不存在' })
    }

    const defaultGroup = list.groups.find(g => g.id !== groupId)
    if (defaultGroup) {
      const missions = await getUserMissions(req.userId)
      missions.forEach(m => {
        if (m.list_id === listId && m.group_id === groupId) {
          m.group_id = defaultGroup.id
        }
      })
      await setUserMissions(req.userId, missions)
    }

    list.groups.splice(groupIndex, 1)
    await setUserMissionLists(req.userId, lists)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete mission group error:', error)
    res.status(500).json({ error: '删除分组失败' })
  }
})

// ============ 使命 API ============

// 获取使命
app.get('/api/missions', authMiddleware, async (req, res) => {
  try {
    const { listId } = req.query
    let missions = await getUserMissions(req.userId)

    if (listId) {
      missions = missions.filter(m => m.list_id === listId)
    }

    res.json({ missions })
  } catch (error) {
    console.error('Get missions error:', error)
    res.status(500).json({ error: '获取使命失败' })
  }
})

// 添加使命
app.post('/api/missions', authMiddleware, async (req, res) => {
  try {
    const data = req.body

    const missions = await getUserMissions(req.userId)

    const newMission = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    missions.push(newMission)
    await setUserMissions(req.userId, missions)

    res.json({ mission: newMission })
  } catch (error) {
    console.error('Add mission error:', error)
    res.status(500).json({ error: '添加使命失败' })
  }
})

// 更新使命
app.put('/api/missions/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const missions = await getUserMissions(req.userId)

    const missionIndex = missions.findIndex(m => m.id === id)
    if (missionIndex === -1) {
      return res.status(404).json({ error: '使命不存在' })
    }

    const mission = missions[missionIndex]

    if (updates.name !== undefined) mission.name = updates.name
    if (updates.description !== undefined) mission.description = updates.description
    if (updates.targetCount !== undefined) mission.target_count = updates.targetCount
    if (updates.currentCount !== undefined) mission.current_count = updates.currentCount
    if (updates.completed !== undefined) mission.completed = updates.completed
    if (updates.groupId !== undefined) mission.group_id = updates.groupId
    if (updates.date !== undefined) mission.date = updates.date
    if (updates.startTime !== undefined) mission.start_time = updates.startTime
    if (updates.endTime !== undefined) mission.end_time = updates.endTime
    if (updates.repeatStrategy !== undefined) mission.repeat_strategy = updates.repeatStrategy
    if (updates.repeatCustomDays !== undefined) mission.repeat_custom_days = updates.repeatCustomDays
    if (updates.repeatEndStrategy !== undefined) mission.repeat_end_strategy = updates.repeatEndStrategy
    if (updates.repeatEndDate !== undefined) mission.repeat_end_date = updates.repeatEndDate
    if (updates.repeatCount !== undefined) mission.repeat_count = updates.repeatCount
    if (updates.repeatCompletedCount !== undefined) mission.repeat_completed_count = updates.repeatCompletedCount
    if (updates.priority !== undefined) mission.priority = updates.priority
    if (updates.checklist !== undefined) mission.checklist = updates.checklist
    if (updates.completedStartTime !== undefined) mission.completed_start_time = updates.completedStartTime
    if (updates.completedEndTime !== undefined) mission.completed_end_time = updates.completedEndTime
    if (updates.notes !== undefined) mission.notes = updates.notes

    mission.updated_at = new Date().toISOString()

    await setUserMissions(req.userId, missions)
    res.json({ mission })
  } catch (error) {
    console.error('Update mission error:', error)
    res.status(500).json({ error: '更新使命失败' })
  }
})

// 删除使命
app.delete('/api/missions/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params

    const missions = await getUserMissions(req.userId)

    const newMissions = missions.filter(m => m.id !== id)
    await setUserMissions(req.userId, newMissions)

    res.json({ success: true })
  } catch (error) {
    console.error('Delete mission error:', error)
    res.status(500).json({ error: '删除使命失败' })
  }
})

// ============ 统计 API ============

// 获取用户统计
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const lists = await getUserMissionLists(req.userId)
    const missions = await getUserMissions(req.userId)
    const tasks = await getUserTasks(req.userId)

    res.json({
      stats: {
        listCount: lists.length,
        missionCount: missions.length,
        taskCount: tasks.length
      }
    })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ error: '获取统计失败' })
  }
})

// ============ 通用数据存储 API ============

// 获取数据
app.get('/api/data/:key', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params
    const data = await getUserKV(req.userId, key)
    res.json({ success: true, data: data || null })
  } catch (error) {
    console.error('Get data error:', error)
    res.status(500).json({ success: false, error: '获取数据失败' })
  }
})

// 设置数据
app.post('/api/data/:key', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params
    const { data } = req.body

    await setUserKV(req.userId, key, data)
    res.json({ success: true })
  } catch (error) {
    console.error('Set data error:', error)
    res.status(500).json({ success: false, error: '设置数据失败' })
  }
})

// 删除数据
app.delete('/api/data/:key', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params

    await deleteUserKV(req.userId, key)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete data error:', error)
    res.status(500).json({ success: false, error: '删除数据失败' })
  }
})

// 批量获取数据
app.post('/api/data/batch/get', authMiddleware, async (req, res) => {
  try {
    const { keys } = req.body

    const results = {}
    for (const key of keys) {
      results[key] = await getUserKV(req.userId, key)
    }

    res.json({ success: true, data: results })
  } catch (error) {
    console.error('Batch get error:', error)
    res.status(500).json({ success: false, error: '批量获取失败' })
  }
})

// 批量设置数据
app.post('/api/data/batch/set', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body

    for (const { key, data } of items) {
      await setUserKV(req.userId, key, data)
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Batch set error:', error)
    res.status(500).json({ success: false, error: '批量设置失败' })
  }
})

// ============ 设置 API ============

// ============ 设置 API ============

// 获取用户设置
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const settings = await getUserSettings(req.userId)
    res.json({ settings })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ error: '获取设置失败' })
  }
})

// 更新用户设置
app.put('/api/settings', authMiddleware, async (req, res) => {
  try {
    const existingSettings = await getUserSettings(req.userId)

    // 合并设置
    const mergedSettings = {
      ...existingSettings,
      ...req.body
    }

    await setUserSettings(req.userId, mergedSettings)
    res.json({ settings: mergedSettings })
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ error: '更新设置失败' })
  }
})

// ============ 日志 API ============

// 日志级别枚举 (与前端保持一致)
const LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4
}

// 日志目录
const LOGS_DIR = path.join(process.cwd(), 'logs')

// 确保日志目录存在
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true })
}

// 北京时间格式化工具
function formatBeijingDate(date) {
  return date.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', dateStyle: 'short' })
}

function formatBeijingTimestamp(date) {
  return date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  }).replace(',', ':')
}

// 后端服务日志写入
function writeServerLog(level, message, meta) {
  const now = new Date()
  const dateStr = formatBeijingDate(now)
  const logFileName = `app-${dateStr}.log`
  const logFilePath = path.join(LOGS_DIR, logFileName)
  const timestamp = formatBeijingTimestamp(now)
  let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`
  if (meta) formatted += ' ' + (typeof meta === 'object' ? JSON.stringify(meta) : meta)
  fs.appendFileSync(logFilePath, formatted + '\n')
}

// 拦截 console.log，同时写入日志文件
const _originalConsoleLog = console.log
console.log = function(...args) {
  _originalConsoleLog.apply(console, args)
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
  if (msg && msg.trim()) {
    writeServerLog('info', msg)
  }
}

// 记录日志到 .log 文件
app.post('/api/logs', authMiddleware, async (req, res) => {
  try {
    const { logs } = req.body
    
    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ success: false, error: '日志数据格式不正确' })
    }
    
    // 按日期分组写入日志文件
    const groupedLogs = {}
    
    logs.forEach(log => {
      const logDate = new Date(log.timestamp)
      const dateStr = formatBeijingDate(logDate)
      if (!groupedLogs[dateStr]) {
        groupedLogs[dateStr] = []
      }
      const levelNames = Object.keys(LogLevel).reduce((acc, key) => {
        acc[LogLevel[key]] = key
        return acc
      }, {})
      const levelName = levelNames[log.level] || 'UNKNOWN'
      const bjTimestamp = formatBeijingTimestamp(logDate)
      const formattedLog = `[${bjTimestamp}] [${levelName}] ${log.message}${log.meta ? ' ' + JSON.stringify(log.meta) : ''}${log.stack ? '\n' + log.stack : ''}`
      groupedLogs[dateStr].push(formattedLog)
    })
    
    // 写入各日期对应的日志文件
    for (const [dateStr, entries] of Object.entries(groupedLogs)) {
      const logFileName = `app-${dateStr}.log`
      const logFilePath = path.join(LOGS_DIR, logFileName)
      fs.appendFileSync(logFilePath, entries.join('\n') + '\n')
    }
    
    res.json({ success: true, message: `已记录 ${logs.length} 条日志` })
  } catch (error) {
    console.error('Log write error:', error)
    res.status(500).json({ success: false, error: '写入日志失败' })
  }
})

// 获取最近的日志
app.get('/api/logs', authMiddleware, async (req, res) => {
  try {
    const { limit = 100, level } = req.query
    
    // 获取最新的日志文件
    const logFiles = fs.readdirSync(LOGS_DIR)
      .filter(file => file.endsWith('.log'))
      .sort()
      .reverse()
    
    if (logFiles.length === 0) {
      return res.json({ logs: [] })
    }
    
    let logLines = []
    for (const logFile of logFiles) {
      const logFilePath = path.join(LOGS_DIR, logFile)
      const content = fs.readFileSync(logFilePath, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line.trim() !== '')
      logLines = [...logLines, ...lines]
      
      if (logLines.length >= limit) {
        break
      }
    }
    
    // 解析日志行
    const parsedLogs = logLines
      .map(line => {
        try {
          // 解析日志格式: [timestamp] [LEVEL] message
          const match = line.match(/^\[(.+?)\] \[(.+?)\] (.+)$/)
          if (match) {
            const [, timestamp, levelStr, messageWithMeta] = match
            let message = messageWithMeta
            let meta = null
            
            // 检查是否有元数据
            const metaMatch = messageWithMeta.match(/^(.*?)\s+(\{.*\})$/)
            if (metaMatch) {
              message = metaMatch[1]
              meta = JSON.parse(metaMatch[2])
            }
            
            const levelNames = Object.keys(LogLevel).reduce((acc, key) => {
              acc[key] = LogLevel[key]
              return acc
            }, {})
            const levelValue = levelNames[levelStr]
            
            return {
              timestamp: new Date(timestamp).toISOString(),
              level: levelValue !== undefined ? levelValue : -1,
              levelName: levelStr,
              message: message,
              meta: meta
            }
          }
        } catch (e) {
          // 如果解析失败，返回原始行
          return {
            timestamp: new Date().toISOString(),
            level: -1,
            levelName: 'PARSE_ERROR',
            message: line,
            meta: null
          }
        }
      })
      .filter(log => log && log.level !== -1) // 过滤无效日志
      .filter(log => {
        if (!level) return true
        const levelNames = Object.keys(LogLevel).reduce((acc, key) => {
          acc[key] = LogLevel[key]
          return acc
        }, {})
        return log.level >= (levelNames[level.toUpperCase()] || -1)
      }) // 按级别过滤
      
    // 返回最后 limit 条日志
    const result = parsedLogs.slice(-limit)
    
    res.json({ 
      logs: result,
      total: result.length
    })
  } catch (error) {
    console.error('Get logs error:', error)
    res.status(500).json({ error: '获取日志失败' })
  }
})

// ============ 健康检查 ============

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    storage: 'redis',
    dataDir: DATA_DIR
  })
})

// ============ 获取 README.md 内容 ============
app.get('/api/readme', (req, res) => {
  const readmePath = path.join(process.cwd(), 'README.md')
  try {
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8')
      res.set('Content-Type', 'text/markdown; charset=utf-8')
      res.send(content)
    } else {
      res.status(404).json({ error: 'README.md not found' })
    }
  } catch (err) {
    console.error('Failed to read README.md:', err)
    res.status(500).json({ error: 'Failed to read README.md' })
  }
})

// ============ 获取应用版本号 ============
app.get('/api/version', (req, res) => {
  const packagePath = path.join(process.cwd(), 'package.json')
  try {
    if (fs.existsSync(packagePath)) {
      const content = fs.readFileSync(packagePath, 'utf-8')
      const pkg = JSON.parse(content)
      res.json({ version: pkg.version || '0.0.0' })
    } else {
      res.status(404).json({ error: 'package.json not found' })
    }
  } catch (err) {
    console.error('Failed to read package.json:', err)
    res.status(500).json({ error: 'Failed to read package.json' })
  }
})

// ============ 提供头像静态文件 ============

// ============ 提供前端静态文件（生产模式） ============

const distPath = path.join(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))

  // 所有非 API 路由返回 index.html（支持 SPA）
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'))
    }
  })

  console.log('Serving static files from dist/')
}

// 启动服务器（支持 WebSocket）
server.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('地球 Online 生存日记 已启动')
  console.log(`本地访问: http://localhost:${PORT}`)
  console.log(`数据存储: Redis`)
  console.log('')
})
