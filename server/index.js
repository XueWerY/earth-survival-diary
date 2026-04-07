import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import crypto from 'crypto'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'

const app = express()
const PORT = process.env.DEPLOY_RUN_PORT || process.env.PORT || 5000

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
const USERS_FILE = path.join(DATA_DIR, 'users.yaml')
const LEGACY_DATA_FILE = path.join(DATA_DIR, 'app-data.yaml')

// 头像目录（本地存储）
const AVATARS_DIR = path.join(process.cwd(), 'public', 'avatars')

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true })
}

// ============ 用户管理 ============

// 加载用户索引
function loadUsersIndex() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8')
      return yaml.parse(content) || {}
    }
    return {}
  } catch (err) {
    console.error('Failed to load users index:', err.message)
    return {}
  }
}

// 保存用户索引
function saveUsersIndex(users) {
  try {
    const content = yaml.stringify(users)
    fs.writeFileSync(USERS_FILE, content, 'utf-8')
  } catch (err) {
    console.error('Failed to save users index:', err.message)
  }
}

// 活跃会话管理（单点登录）
const activeSessions = new Map() // userId -> { token, loginTime }

// 密码哈希
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// 生成用户 ID
function generateUserId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

// 生成 token (简单实现)
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

// 获取用户数据文件路径
function getUserDataFile(userId) {
  return path.join(DATA_DIR, `user_${userId}.yaml`)
}

// 加载用户数据
function loadUserData(userId) {
  const filePath = getUserDataFile(userId)
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return yaml.parse(content) || {}
    }
    return {}
  } catch (err) {
    console.error(`Failed to load user data for ${userId}:`, err.message)
    return {}
  }
}

// 保存用户数据
function saveUserData(userId, data) {
  const filePath = getUserDataFile(userId)
  try {
    const content = yaml.stringify(data)
    fs.writeFileSync(filePath, content, 'utf-8')
  } catch (err) {
    console.error(`Failed to save user data for ${userId}:`, err.message)
  }
}

// 初始化用户数据结构
function initUserData(userId, nickname) {
  return {
    profile: {
      id: userId,
      nickname: nickname,
      createdAt: new Date().toISOString()
    },
    tasks: [],
    missionLists: [],
    missions: []
  }
}

// ============ 中间件 ============

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '10mb' }))

// 认证中间件
function authMiddleware(req, res, next) {
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
  const activeSession = activeSessions.get(userId)
  if (!activeSession) {
    // 服务器重启后 activeSessions 会清空，此时如果 token 有效，自动恢复会话
    activeSessions.set(userId, { token, loginTime: Date.now() })
  } else if (activeSession.token !== token) {
    return res.status(401).json({ error: '账号已在其他设备登录，请重新登录', kicked: true })
  }

  // 检查用户是否存在
  const users = loadUsersIndex()
  const userEntry = Object.values(users).find(u => u.id === userId)
  if (!userEntry) {
    return res.status(401).json({ error: '用户不存在' })
  }

  req.userId = userId
  req.userEmail = userEntry.email
  next()
}

// ============ 认证 API ============

// 注册
app.post('/api/auth/signup', (req, res) => {
  try {
    const { email, password, nickname } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码必填' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' })
    }

    const users = loadUsersIndex()

    // 检查邮箱是否已存在
    if (users[email]) {
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

    users[email] = userEntry
    saveUsersIndex(users)

    // 初始化用户数据
    const userData = initUserData(userId, userEntry.nickname)
    saveUserData(userId, userData)

    // 生成 token
    const token = generateToken(userId)

    // 注册会话（单点登录）
    activeSessions.set(userId, { token, loginTime: Date.now() })

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
app.post('/api/auth/signin', (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码必填' })
    }

    const users = loadUsersIndex()
    const userEntry = users[email]

    if (!userEntry) {
      return res.status(400).json({ error: '该邮箱未注册' })
    }

    if (userEntry.passwordHash !== hashPassword(password)) {
      return res.status(400).json({ error: '密码错误' })
    }

    // 生成 token
    const token = generateToken(userEntry.id)

    // 注册会话（单点登录，踢掉之前的会话）
    const prevSession = activeSessions.get(userEntry.id)
    if (prevSession) {
      // 先通知被踢出的用户
      notifyKickedOut(userEntry.id)
      console.log(`用户 ${email} 的前一会话已被踢出`)
    }
    activeSessions.set(userEntry.id, { token, loginTime: Date.now() })

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
app.post('/api/auth/signout', (req, res) => {
  // 清除会话
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const userId = verifyToken(token)
    if (userId) {
      activeSessions.delete(userId)
    }
  }
  res.json({ success: true })
})

// 修改邮箱
app.post('/api/auth/change-email', authMiddleware, (req, res) => {
  try {
    const { newEmail, password } = req.body

    if (!newEmail || !password) {
      return res.status(400).json({ error: '新邮箱和密码必填' })
    }

    const users = loadUsersIndex()

    // 检查新邮箱是否已被使用
    if (users[newEmail]) {
      return res.status(400).json({ error: '该邮箱已被其他账号使用' })
    }

    // 验证当前密码
    const currentUser = Object.values(users).find(u => u.id === req.userId)
    if (!currentUser || currentUser.passwordHash !== hashPassword(password)) {
      return res.status(400).json({ error: '密码错误' })
    }

    // 更新邮箱
    const oldEmail = req.userEmail
    users[newEmail] = {
      ...currentUser,
      email: newEmail
    }
    delete users[oldEmail]
    saveUsersIndex(users)

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
app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '当前密码和新密码必填' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' })
    }

    const users = loadUsersIndex()
    const currentUser = Object.values(users).find(u => u.id === req.userId)

    if (!currentUser || currentUser.passwordHash !== hashPassword(oldPassword)) {
      return res.status(400).json({ error: '当前密码错误' })
    }

    // 更新密码
    currentUser.passwordHash = hashPassword(newPassword)
    saveUsersIndex(users)

    console.log(`用户修改密码: ${req.userEmail}`)

    res.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ error: '修改密码失败' })
  }
})

// 获取当前用户
app.get('/api/auth/user', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)
    res.json({
      user: {
        id: req.userId,
        email: req.userEmail,
        nickname: userData.profile?.nickname || req.userEmail.split('@')[0],
        createdAt: userData.profile?.createdAt
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

// 检查会话状态（用于客户端轮询检测是否被踢出）
app.post('/api/auth/check-session', (req, res) => {
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
  const activeSession = activeSessions.get(userId)
  if (!activeSession) {
    // 服务器重启后自动恢复会话
    activeSessions.set(userId, { token, loginTime: Date.now() })
    return res.json({ valid: true, kicked: false })
  }

  if (activeSession.token !== token) {
    return res.json({ valid: false, kicked: true })
  }

  res.json({ valid: true, kicked: false })
})

// ============ 用户配置 API ============

// 获取用户配置
app.get('/api/profile', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)
    res.json({
      profile: {
        id: req.userId,
        nickname: userData.profile?.nickname || req.userEmail.split('@')[0],
        createdAt: userData.profile?.createdAt
      }
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: '获取配置失败' })
  }
})

// 更新用户配置
app.put('/api/profile', authMiddleware, (req, res) => {
  try {
    const { nickname } = req.body

    const userData = loadUserData(req.userId)
    userData.profile = userData.profile || {}
    userData.profile.nickname = nickname
    saveUserData(req.userId, userData)

    // 同时更新用户索引中的昵称
    const users = loadUsersIndex()
    if (users[req.userEmail]) {
      users[req.userEmail].nickname = nickname
      saveUsersIndex(users)
    }

    res.json({
      profile: {
        id: req.userId,
        nickname: nickname,
        createdAt: userData.profile.createdAt
      }
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ error: '更新配置失败' })
  }
})

// ============ 任务 API ============

// 获取任务列表
app.get('/api/tasks', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)
    const tasks = userData.tasks || []
    res.json({ tasks })
  } catch (error) {
    console.error('Get tasks error:', error)
    res.status(500).json({ error: '获取任务失败' })
  }
})

// 添加任务
app.post('/api/tasks', authMiddleware, (req, res) => {
  try {
    const { name, date, startTime, endTime, notes, category } = req.body

    const userData = loadUserData(req.userId)
    userData.tasks = userData.tasks || []

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

    userData.tasks.unshift(newTask)
    saveUserData(req.userId, userData)

    res.json({ task: newTask })
  } catch (error) {
    console.error('Add task error:', error)
    res.status(500).json({ error: '添加任务失败' })
  }
})

// 更新任务
app.put('/api/tasks/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const userData = loadUserData(req.userId)
    userData.tasks = userData.tasks || []

    const taskIndex = userData.tasks.findIndex(t => t.id === id)
    if (taskIndex === -1) {
      return res.status(404).json({ error: '任务不存在' })
    }

    const task = userData.tasks[taskIndex]

    if (updates.name !== undefined) task.name = updates.name
    if (updates.date !== undefined) task.date = updates.date
    if (updates.startTime !== undefined) task.startTime = updates.startTime || null
    if (updates.endTime !== undefined) task.endTime = updates.endTime || null
    if (updates.notes !== undefined) task.notes = updates.notes || null
    if (updates.category !== undefined) task.category = updates.category || null
    if (updates.completed !== undefined) task.completed = updates.completed

    saveUserData(req.userId, userData)
    res.json({ task })
  } catch (error) {
    console.error('Update task error:', error)
    res.status(500).json({ error: '更新任务失败' })
  }
})

// 删除任务
app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params

    const userData = loadUserData(req.userId)
    userData.tasks = userData.tasks || []

    const taskIndex = userData.tasks.findIndex(t => t.id === id)
    if (taskIndex !== -1) {
      userData.tasks.splice(taskIndex, 1)
      saveUserData(req.userId, userData)
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Delete task error:', error)
    res.status(500).json({ error: '删除任务失败' })
  }
})

// ============ 使命列表 API ============

// 获取使命列表
app.get('/api/mission-lists', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)
    const lists = userData.missionLists || []
    res.json({ lists })
  } catch (error) {
    console.error('Get mission lists error:', error)
    res.status(500).json({ error: '获取使命列表失败' })
  }
})

// 添加使命列表
app.post('/api/mission-lists', authMiddleware, (req, res) => {
  try {
    const { name, icon } = req.body

    const userData = loadUserData(req.userId)
    userData.missionLists = userData.missionLists || []

    const newList = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name,
      icon: icon || '📋',
      created_at: new Date().toISOString()
    }

    userData.missionLists.push(newList)
    saveUserData(req.userId, userData)

    res.json({ list: newList })
  } catch (error) {
    console.error('Add mission list error:', error)
    res.status(500).json({ error: '添加使命列表失败' })
  }
})

// 更新使命列表
app.put('/api/mission-lists/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const { name, icon } = req.body

    const userData = loadUserData(req.userId)
    userData.missionLists = userData.missionLists || []

    const listIndex = userData.missionLists.findIndex(l => l.id === id)
    if (listIndex === -1) {
      return res.status(404).json({ error: '使命列表不存在' })
    }

    if (name !== undefined) userData.missionLists[listIndex].name = name
    if (icon !== undefined) userData.missionLists[listIndex].icon = icon

    saveUserData(req.userId, userData)
    res.json({ list: userData.missionLists[listIndex] })
  } catch (error) {
    console.error('Update mission list error:', error)
    res.status(500).json({ error: '更新使命列表失败' })
  }
})

// 删除使命列表
app.delete('/api/mission-lists/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params

    const userData = loadUserData(req.userId)
    userData.missionLists = userData.missionLists || []
    userData.missions = userData.missions || []

    // 删除列表及其下的使命
    userData.missionLists = userData.missionLists.filter(l => l.id !== id)
    userData.missions = userData.missions.filter(m => m.list_id !== id)

    saveUserData(req.userId, userData)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete mission list error:', error)
    res.status(500).json({ error: '删除使命列表失败' })
  }
})

// ============ 使命 API ============

// 获取使命
app.get('/api/missions', authMiddleware, (req, res) => {
  try {
    const { listId } = req.query
    const userData = loadUserData(req.userId)
    let missions = userData.missions || []

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
app.post('/api/missions', authMiddleware, (req, res) => {
  try {
    const data = req.body

    const userData = loadUserData(req.userId)
    userData.missions = userData.missions || []

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

    userData.missions.push(newMission)
    saveUserData(req.userId, userData)

    res.json({ mission: newMission })
  } catch (error) {
    console.error('Add mission error:', error)
    res.status(500).json({ error: '添加使命失败' })
  }
})

// 更新使命
app.put('/api/missions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const userData = loadUserData(req.userId)
    userData.missions = userData.missions || []

    const missionIndex = userData.missions.findIndex(m => m.id === id)
    if (missionIndex === -1) {
      return res.status(404).json({ error: '使命不存在' })
    }

    const mission = userData.missions[missionIndex]

    // 支持所有字段更新
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

    saveUserData(req.userId, userData)
    res.json({ mission })
  } catch (error) {
    console.error('Update mission error:', error)
    res.status(500).json({ error: '更新使命失败' })
  }
})

// 删除使命
app.delete('/api/missions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params

    const userData = loadUserData(req.userId)
    userData.missions = userData.missions || []

    userData.missions = userData.missions.filter(m => m.id !== id)
    saveUserData(req.userId, userData)

    res.json({ success: true })
  } catch (error) {
    console.error('Delete mission error:', error)
    res.status(500).json({ error: '删除使命失败' })
  }
})

// ============ 统计 API ============

// 获取用户统计
app.get('/api/stats', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)

    res.json({
      stats: {
        listCount: (userData.missionLists || []).length,
        missionCount: (userData.missions || []).length,
        taskCount: (userData.tasks || []).length
      }
    })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ error: '获取统计失败' })
  }
})

// ============ 通用数据存储 API ============

// 获取数据
app.get('/api/data/:key', authMiddleware, (req, res) => {
  try {
    const { key } = req.params
    const userData = loadUserData(req.userId)
    userData.kvStore = userData.kvStore || {}

    res.json({ success: true, data: userData.kvStore[key] || null })
  } catch (error) {
    console.error('Get data error:', error)
    res.status(500).json({ success: false, error: '获取数据失败' })
  }
})

// 设置数据
app.post('/api/data/:key', authMiddleware, (req, res) => {
  try {
    const { key } = req.params
    const { data } = req.body

    const userData = loadUserData(req.userId)
    userData.kvStore = userData.kvStore || {}
    userData.kvStore[key] = data
    saveUserData(req.userId, userData)

    res.json({ success: true })
  } catch (error) {
    console.error('Set data error:', error)
    res.status(500).json({ success: false, error: '设置数据失败' })
  }
})

// 删除数据
app.delete('/api/data/:key', authMiddleware, (req, res) => {
  try {
    const { key } = req.params

    const userData = loadUserData(req.userId)
    userData.kvStore = userData.kvStore || {}
    delete userData.kvStore[key]
    saveUserData(req.userId, userData)

    res.json({ success: true })
  } catch (error) {
    console.error('Delete data error:', error)
    res.status(500).json({ success: false, error: '删除数据失败' })
  }
})

// 批量获取数据
app.post('/api/data/batch/get', authMiddleware, (req, res) => {
  try {
    const { keys } = req.body
    const userData = loadUserData(req.userId)
    userData.kvStore = userData.kvStore || {}

    const results = {}
    for (const key of keys) {
      results[key] = userData.kvStore[key] || null
    }

    res.json({ success: true, data: results })
  } catch (error) {
    console.error('Batch get error:', error)
    res.status(500).json({ success: false, error: '批量获取失败' })
  }
})

// 批量设置数据
app.post('/api/data/batch/set', authMiddleware, (req, res) => {
  try {
    const { items } = req.body

    const userData = loadUserData(req.userId)
    userData.kvStore = userData.kvStore || {}

    for (const { key, data } of items) {
      userData.kvStore[key] = data
    }
    saveUserData(req.userId, userData)

    res.json({ success: true })
  } catch (error) {
    console.error('Batch set error:', error)
    res.status(500).json({ success: false, error: '批量设置失败' })
  }
})

// ============ 笔记分类 API ============

// 获取笔记分类
app.get('/api/note-categories', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)
    const categories = userData.noteCategories || []
    res.json({ categories })
  } catch (error) {
    console.error('Get note categories error:', error)
    res.status(500).json({ error: '获取笔记分类失败' })
  }
})

// 添加笔记分类
app.post('/api/note-categories', authMiddleware, (req, res) => {
  try {
    const { name, icon, color } = req.body

    const userData = loadUserData(req.userId)
    userData.noteCategories = userData.noteCategories || []

    const newCategory = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name,
      icon: icon || '📝',
      color: color || '#667eea',
      created_at: new Date().toISOString()
    }

    userData.noteCategories.push(newCategory)
    saveUserData(req.userId, userData)

    res.json({ category: newCategory })
  } catch (error) {
    console.error('Add note category error:', error)
    res.status(500).json({ error: '添加笔记分类失败' })
  }
})

// 更新笔记分类
app.put('/api/note-categories/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const { name, icon, color } = req.body

    const userData = loadUserData(req.userId)
    userData.noteCategories = userData.noteCategories || []

    const categoryIndex = userData.noteCategories.findIndex(c => c.id === id)
    if (categoryIndex === -1) {
      return res.status(404).json({ error: '笔记分类不存在' })
    }

    if (name !== undefined) userData.noteCategories[categoryIndex].name = name
    if (icon !== undefined) userData.noteCategories[categoryIndex].icon = icon
    if (color !== undefined) userData.noteCategories[categoryIndex].color = color

    saveUserData(req.userId, userData)
    res.json({ category: userData.noteCategories[categoryIndex] })
  } catch (error) {
    console.error('Update note category error:', error)
    res.status(500).json({ error: '更新笔记分类失败' })
  }
})

// 删除笔记分类
app.delete('/api/note-categories/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params

    const userData = loadUserData(req.userId)
    userData.noteCategories = userData.noteCategories || []
    userData.notes = userData.notes || []

    // 删除分类及该分类下的所有笔记
    userData.noteCategories = userData.noteCategories.filter(c => c.id !== id)
    userData.notes = userData.notes.filter(n => n.category_id !== id)

    saveUserData(req.userId, userData)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete note category error:', error)
    res.status(500).json({ error: '删除笔记分类失败' })
  }
})

// ============ 笔记 API ============

// 获取笔记列表
app.get('/api/notes', authMiddleware, (req, res) => {
  try {
    const { categoryId, search } = req.query
    const userData = loadUserData(req.userId)
    let notes = userData.notes || []

    if (categoryId) {
      notes = notes.filter(n => n.category_id === categoryId)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      notes = notes.filter(n =>
          n.title.toLowerCase().includes(searchLower) ||
          (n.content && n.content.toLowerCase().includes(searchLower))
      )
    }

    // 按更新时间倒序
    notes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

    res.json({ notes })
  } catch (error) {
    console.error('Get notes error:', error)
    res.status(500).json({ error: '获取笔记失败' })
  }
})

// 获取单个笔记
app.get('/api/notes/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const userData = loadUserData(req.userId)
    const notes = userData.notes || []

    const note = notes.find(n => n.id === id)
    if (!note) {
      return res.status(404).json({ error: '笔记不存在' })
    }

    res.json({ note })
  } catch (error) {
    console.error('Get note error:', error)
    res.status(500).json({ error: '获取笔记失败' })
  }
})

// 添加笔记
app.post('/api/notes', authMiddleware, (req, res) => {
  try {
    const { categoryId, title, content, tags } = req.body

    const userData = loadUserData(req.userId)
    userData.notes = userData.notes || []

    const now = new Date().toISOString()
    const newNote = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      category_id: categoryId || null,
      title: title || '无标题',
      content: content || '',
      tags: tags || [],
      created_at: now,
      updated_at: now
    }

    userData.notes.unshift(newNote)
    saveUserData(req.userId, userData)

    res.json({ note: newNote })
  } catch (error) {
    console.error('Add note error:', error)
    res.status(500).json({ error: '添加笔记失败' })
  }
})

// 更新笔记
app.put('/api/notes/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const { categoryId, title, content, tags } = req.body

    const userData = loadUserData(req.userId)
    userData.notes = userData.notes || []

    const noteIndex = userData.notes.findIndex(n => n.id === id)
    if (noteIndex === -1) {
      return res.status(404).json({ error: '笔记不存在' })
    }

    const note = userData.notes[noteIndex]

    if (categoryId !== undefined) note.category_id = categoryId
    if (title !== undefined) note.title = title
    if (content !== undefined) note.content = content
    if (tags !== undefined) note.tags = tags

    note.updated_at = new Date().toISOString()

    saveUserData(req.userId, userData)
    res.json({ note })
  } catch (error) {
    console.error('Update note error:', error)
    res.status(500).json({ error: '更新笔记失败' })
  }
})

// 删除笔记
app.delete('/api/notes/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params

    const userData = loadUserData(req.userId)
    userData.notes = userData.notes || []

    userData.notes = userData.notes.filter(n => n.id !== id)
    saveUserData(req.userId, userData)

    res.json({ success: true })
  } catch (error) {
    console.error('Delete note error:', error)
    res.status(500).json({ error: '删除笔记失败' })
  }
})

// ============ 设置 API ============

// 默认设置
const defaultSettings = {
  shortcuts: {
    inlineMath: 'Ctrl+M',
    blockMath: 'Ctrl+Shift+M',
    save: 'Ctrl+S'
  }
}

// ============ 倒数日 API ============

// 获取倒数日列表
app.get('/api/countdowns', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)
    const countdowns = userData.countdowns || []
    res.json({ countdowns })
  } catch (error) {
    console.error('Get countdowns error:', error)
    res.status(500).json({ error: '获取倒数日失败' })
  }
})

// 添加倒数日
app.post('/api/countdowns', authMiddleware, (req, res) => {
  try {
    const { name, targetDate, icon, is_birthday, is_system } = req.body

    const userData = loadUserData(req.userId)
    userData.countdowns = userData.countdowns || []

    const newCountdown = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name,
      target_date: targetDate,
      icon: icon || '📅',
      is_birthday: is_birthday || false,
      is_system: is_system || false,
      created_at: new Date().toISOString()
    }

    userData.countdowns.push(newCountdown)
    saveUserData(req.userId, userData)

    res.json({ countdown: newCountdown })
  } catch (error) {
    console.error('Add countdown error:', error)
    res.status(500).json({ error: '添加倒数日失败' })
  }
})

// 更新倒数日
app.put('/api/countdowns/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const { name, targetDate, icon, is_birthday, is_system } = req.body

    const userData = loadUserData(req.userId)
    userData.countdowns = userData.countdowns || []

    const countdownIndex = userData.countdowns.findIndex(c => c.id === id)
    if (countdownIndex === -1) {
      return res.status(404).json({ error: '倒数日不存在' })
    }

    if (name !== undefined) userData.countdowns[countdownIndex].name = name
    if (targetDate !== undefined) userData.countdowns[countdownIndex].target_date = targetDate
    if (icon !== undefined) userData.countdowns[countdownIndex].icon = icon
    if (is_birthday !== undefined) userData.countdowns[countdownIndex].is_birthday = is_birthday
    if (is_system !== undefined) userData.countdowns[countdownIndex].is_system = is_system

    saveUserData(req.userId, userData)
    res.json({ countdown: userData.countdowns[countdownIndex] })
  } catch (error) {
    console.error('Update countdown error:', error)
    res.status(500).json({ error: '更新倒数日失败' })
  }
})

// 删除倒数日（系统倒数日不可删除）
app.delete('/api/countdowns/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params

    const userData = loadUserData(req.userId)
    userData.countdowns = userData.countdowns || []

    const countdown = userData.countdowns.find(c => c.id === id)
    if (countdown?.is_system) {
      return res.status(400).json({ error: '系统倒数日不可删除' })
    }

    userData.countdowns = userData.countdowns.filter(c => c.id !== id)
    saveUserData(req.userId, userData)

    res.json({ success: true })
  } catch (error) {
    console.error('Delete countdown error:', error)
    res.status(500).json({ error: '删除倒数日失败' })
  }
})

// ============ 头像上传 API ============

// 上传头像
app.post('/api/avatar/upload', authMiddleware, async (req, res) => {
  try {
    const { fileData, fileName } = req.body

    if (!fileData) {
      return res.status(400).json({ error: '缺少文件数据' })
    }

    // 将 base64 转为 Buffer
    const buffer = Buffer.from(fileData, 'base64')

    // 生成文件名
    const ext = fileName.split('.').pop() || 'png'
    const localFileName = `${req.userId}_${Date.now()}.${ext}`
    const filePath = path.join(AVATARS_DIR, localFileName)

    // 保存文件到本地
    fs.writeFileSync(filePath, buffer)

    // 生成访问 URL
    const avatarUrl = `/avatars/${localFileName}`

    // 保存 avatarKey 到用户数据
    const userData = loadUserData(req.userId)
    userData.profile = userData.profile || {}
    userData.profile.avatarKey = localFileName
    saveUserData(req.userId, userData)

    res.json({
      success: true,
      avatarKey: localFileName,
      avatarUrl
    })
  } catch (error) {
    console.error('Upload avatar error:', error)
    res.status(500).json({ error: '上传头像失败' })
  }
})

// 获取头像 URL
app.get('/api/avatar/url', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)
    const avatarKey = userData.profile?.avatarKey

    if (!avatarKey) {
      return res.json({ avatarUrl: null })
    }

    // 兼容旧的 local: 前缀格式
    const fileName = avatarKey.startsWith('local:') ? avatarKey.replace('local:', '') : avatarKey
    const avatarUrl = `/avatars/${fileName}`

    res.json({ avatarUrl })
  } catch (error) {
    console.error('Get avatar URL error:', error)
    res.status(500).json({ error: '获取头像失败' })
  }
})

// ============ 设置 API ============

// 获取用户设置
app.get('/api/settings', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)
    const settings = userData.settings || defaultSettings
    res.json({ settings })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ error: '获取设置失败' })
  }
})

// 更新用户设置
app.put('/api/settings', authMiddleware, (req, res) => {
  try {
    const userData = loadUserData(req.userId)

    // 合并设置
    userData.settings = {
      ...defaultSettings,
      ...(userData.settings || {}),
      ...req.body,
      // 深度合并 shortcuts
      shortcuts: {
        ...defaultSettings.shortcuts,
        ...((userData.settings || {}).shortcuts || {}),
        ...(req.body.shortcuts || {})
      }
    }

    saveUserData(req.userId, userData)
    res.json({ settings: userData.settings })
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ error: '更新设置失败' })
  }
})

// ============ 健康检查 ============

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    storage: 'yaml',
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

// 头像静态文件服务
app.use('/avatars', express.static(AVATARS_DIR))

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
  console.log(`数据目录: ${DATA_DIR}`)
  console.log('')
})
