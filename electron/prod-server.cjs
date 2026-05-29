const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const http = require('http')

function createProdServer(options = {}) {
  const { 
    port = 5000, 
    dataDir, 
    distPath,
    resourcesPath 
  } = options

  // Resolve paths
  const DATA_DIR = dataDir || path.join(resourcesPath, 'data')
  const DIST_PATH = distPath || path.join(resourcesPath, 'app.asar', 'dist')

  // Ensure directories exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  // ============ Local Storage ============
  //
  // Data directory structure:
  //   data/
  //     users/                  User index (one .json file per registered email)
  //       <email>.json
  //     <userId>/
  //       <type>/               Data type subdirectory
  //         <key>.json
  //
  // Types: profile, session, settings, footprint, list, course, focus, countdown, system
  //
  // All responses: success -> data, failure -> {error: "message"}

  function getDataPath(type, userId, key) {
    let dir, filename
    if (type === 'index') {
      dir = path.join(DATA_DIR, 'users')
      filename = `${key}.json`
    } else {
      dir = path.join(DATA_DIR, userId, type)
      filename = `${(key || type).replace(/:/g, '__')}.json`
    }
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, filename)
  }

  function readJson(filePath, defaultVal = null) {
    if (!fs.existsSync(filePath)) return defaultVal
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      return defaultVal
    }
  }

  function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  // Index management
  function getUserIndexByEmail(email) {
    return readJson(getDataPath('index', null, email))
  }
  async function setUserIndex(email, entry) {
    writeJson(getDataPath('index', null, email), entry)
  }
  async function deleteUserIndex(email) {
    const p = getDataPath('index', null, email)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
  function getAllUserEmails() {
    const dir = path.join(DATA_DIR, 'users')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  }
  function emailExists(email) {
    return fs.existsSync(getDataPath('index', null, email))
  }

  // Profile
  async function getUserProfile(userId) {
    return readJson(getDataPath('profile', userId))
  }
  async function setUserProfile(userId, profile) {
    writeJson(getDataPath('profile', userId), profile)
  }

  // Tasks
  async function getUserTasks(userId) {
    return readJson(getDataPath('footprint', userId), [])
  }
  async function setUserTasks(userId, tasks) {
    writeJson(getDataPath('footprint', userId), tasks)
  }

  // Mission lists
  async function getUserMissionLists(userId) {
    return readJson(getDataPath('list', userId, 'lists'), [])
  }
  async function setUserMissionLists(userId, lists) {
    writeJson(getDataPath('list', userId, 'lists'), lists)
  }

  // Missions
  async function getUserMissions(userId) {
    return readJson(getDataPath('list', userId, 'tasks'), [])
  }
  async function setUserMissions(userId, missions) {
    writeJson(getDataPath('list', userId, 'tasks'), missions)
  }

  // Settings
  async function getUserSettings(userId) {
    return readJson(getDataPath('settings', userId), {})
  }
  async function setUserSettings(userId, settings) {
    writeJson(getDataPath('settings', userId), settings)
  }

  // Data storage (type/key based)
  async function getUserKV(userId, type, key) {
    return readJson(getDataPath(type, userId, key))
  }
  async function setUserKV(userId, type, key, data) {
    writeJson(getDataPath(type, userId, key), data)
  }
  async function deleteUserKV(userId, type, key) {
    const p = getDataPath(type, userId, key)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  // Session
  async function getUserSession(userId) {
    return readJson(getDataPath('session', userId))
  }
  async function setUserSession(userId, token) {
    writeJson(getDataPath('session', userId), { token, createdAt: new Date().toISOString() })
  }
  async function deleteUserSession(userId) {
    const p = path.join(DATA_DIR, userId, 'session', 'session.json')
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  // ============ Helpers ============

  function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex')
  }

  function generateUserId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  }

  function generateToken(userId) {
    const payload = `${userId}:${Date.now()}:${Math.random().toString(36).substr(2)}`
    return Buffer.from(payload).toString('base64')
  }

  function verifyToken(token) {
    try {
      const payload = Buffer.from(token, 'base64').toString('utf-8')
      const [userId] = payload.split(':')
      return userId || null
    } catch {
      return null
    }
  }

  // ============ Create HTTP server ============

  const nodeModulesRoot = path.join(resourcesPath, 'node_modules')
  const express = require(path.join(nodeModulesRoot, 'express'))
  const corsPkg = require(path.join(nodeModulesRoot, 'cors'))

  const app = express()
  const server = http.createServer(app)

  app.use(corsPkg({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }))
  app.use(express.json({ limit: '10mb' }))

  // Auth middleware
  async function authMiddleware(req, res, next) {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未登录' })
      }
      const token = authHeader.substring(7)
      const userId = verifyToken(token)
      if (!userId) {
        return res.status(401).json({ error: '登录已过期，请重新登录' })
      }
      const userEmails = getAllUserEmails()
      let userEntry = null
      for (const email of userEmails) {
        const user = getUserIndexByEmail(email)
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
    } catch (e) {
      console.error('Auth middleware error:', e)
      res.status(500).json({ error: '认证服务异常' })
    }
  }

  // ============ Auth API ============

  /** POST /api/auth/signup
   *  body: {email, password, nickname?}
   *  => 200 {user, session:{access_token}} | 400/500 {error} */
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, nickname } = req.body
      if (!email || !password) return res.status(400).json({ error: '邮箱和密码必填' })
      if (password.length < 6) return res.status(400).json({ error: '密码长度至少6位' })
      if (await emailExists(email)) return res.status(400).json({ error: '该邮箱已被注册' })

      const userId = generateUserId()
      const userEntry = {
        id: userId, email, passwordHash: hashPassword(password),
        nickname: nickname || email.split('@')[0], createdAt: new Date().toISOString()
      }
      await setUserIndex(email, userEntry)
      await setUserProfile(userId, { id: userId, nickname: userEntry.nickname, createdAt: userEntry.createdAt })
      const token = generateToken(userId)
      await setUserSession(userId, token)
      res.json({ user: { id: userId, email, nickname: userEntry.nickname, createdAt: userEntry.createdAt }, session: { access_token: token } })
    } catch (e) { console.error('Signup error:', e); res.status(500).json({ error: '注册失败，请稍后重试' }) }
  })

  /** POST /api/auth/signin
   *  body: {email, password}
   *  => 200 {user, session:{access_token}} | 400 {error} */
  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body
      if (!email || !password) return res.status(400).json({ error: '邮箱和密码必填' })
      const userEntry = getUserIndexByEmail(email)
      if (!userEntry) return res.status(400).json({ error: '该邮箱未注册' })
      if (userEntry.passwordHash !== hashPassword(password)) return res.status(400).json({ error: '密码错误' })
      const token = generateToken(userEntry.id)
      await setUserSession(userEntry.id, token)
      res.json({ user: { id: userEntry.id, email: userEntry.email, nickname: userEntry.nickname, createdAt: userEntry.createdAt }, session: { access_token: token } })
    } catch (e) { console.error('Signin error:', e); res.status(500).json({ error: '登录失败，请稍后重试' }) }
  })

  /** POST /api/auth/signout (clears server session) => 200 {success:true} */
  app.post('/api/auth/signout', async (req, res) => {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const userId = verifyToken(authHeader.substring(7))
      if (userId) await deleteUserSession(userId)
    }
    res.json({ success: true })
  })

  /** DELETE /api/auth/account (auth) => 200 {success:true} - 注销账号，删除当前用户所有数据 */
  app.delete('/api/auth/account', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId
      const userEmail = req.userEmail

      // 删除用户索引
      await deleteUserIndex(userEmail)

      // 删除用户数据目录
      const userDir = path.join(DATA_DIR, userId)
      if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true, force: true })
      }

      // 删除session
      await deleteUserSession(userId)

      console.log(`[Account] User deleted: ${userEmail} (${userId})`)
      res.json({ success: true })
    } catch (e) {
      console.error('Delete account error:', e)
      res.status(500).json({ error: '注销账号失败' })
    }
  })

  /** DELETE /api/data/all (auth) => 200 {success:true} - 清空所有用户数据（所有账号） */
  app.delete('/api/data/all', async (req, res) => {
    try {
      // 清空整个DATA_DIR
      if (fs.existsSync(DATA_DIR)) {
        fs.rmSync(DATA_DIR, { recursive: true, force: true })
        fs.mkdirSync(DATA_DIR, { recursive: true })
      }
      console.log('[Data] All user data cleared')
      res.json({ success: true })
    } catch (e) {
      console.error('Clear all data error:', e)
      res.status(500).json({ error: '清空数据失败' })
    }
  })

  /** POST /api/auth/change-email (auth) body:{newEmail,password} => 200 {success,email} */
  app.post('/api/auth/change-email', authMiddleware, async (req, res) => {
    try {
      const { newEmail, password } = req.body
      if (!newEmail || !password) return res.status(400).json({ error: '新邮箱和密码必填' })
      if (await emailExists(newEmail)) return res.status(400).json({ error: '该邮箱已被其他账号使用' })
      const currentUser = getUserIndexByEmail(req.userEmail)
      if (!currentUser || currentUser.passwordHash !== hashPassword(password)) return res.status(400).json({ error: '密码错误' })
      await setUserIndex(newEmail, { ...currentUser, email: newEmail })
      await deleteUserIndex(req.userEmail)
      req.userEmail = newEmail
      res.json({ success: true, email: newEmail })
    } catch (e) { console.error('Change email error:', e); res.status(500).json({ error: '修改邮箱失败' }) }
  })

  /** POST /api/auth/change-password (auth) body:{oldPassword,newPassword} => 200 {success} */
  app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body
      if (!oldPassword || !newPassword) return res.status(400).json({ error: '当前密码和新密码必填' })
      if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6位' })
      const currentUser = getUserIndexByEmail(req.userEmail)
      if (!currentUser || currentUser.passwordHash !== hashPassword(oldPassword)) return res.status(400).json({ error: '当前密码错误' })
      currentUser.passwordHash = hashPassword(newPassword)
      await setUserIndex(req.userEmail, currentUser)
      res.json({ success: true })
    } catch (e) { console.error('Change password error:', e); res.status(500).json({ error: '修改密码失败' }) }
  })

  /** GET /api/auth/users => 200 {users:[{email,nickname,createdAt}]} - 获取所有用户列表（登录界面备选项） */
  app.get('/api/auth/users', async (req, res) => {
    try {
      const emails = getAllUserEmails()
      const users = emails.map(email => {
        const user = getUserIndexByEmail(email)
        return user ? { email: user.email, nickname: user.nickname || email.split('@')[0], createdAt: user.createdAt } : null
      }).filter(Boolean)
      res.json({ users })
    } catch (e) {
      console.error('Get users error:', e)
      res.status(500).json({ error: '获取用户列表失败' })
    }
  })

  /** GET /api/auth/settings => 200 {settings} - 获取应用全局设置（如自动填充密码） */
  app.get('/api/auth/settings', async (req, res) => {
    try {
      const settingsPath = path.join(DATA_DIR, 'settings', 'settings.json')
      const settings = readJson(settingsPath)
      res.json({ settings: settings || {} })
    } catch (e) {
      res.json({ settings: {} })
    }
  })

  /** POST /api/auth/settings body:{key,value} => 200 {success} - 更新应用全局设置 */
  app.post('/api/auth/settings', async (req, res) => {
    try {
      const settingsPath = path.join(DATA_DIR, 'settings', 'settings.json')
      let settings = readJson(settingsPath) || {}
      settings[req.body.key] = req.body.value
      writeJson(settingsPath, settings)
      res.json({ success: true })
    } catch (e) {
      console.error('Update settings error:', e)
      res.status(500).json({ error: '更新设置失败' })
    }
  })

  /** GET /api/auth/user (auth) => 200 {user:{id,email,nickname,createdAt}} */
  app.get('/api/auth/user', authMiddleware, async (req, res) => {
    try {
      const profile = await getUserProfile(req.userId)
      res.json({ user: { id: req.userId, email: req.userEmail, nickname: profile?.nickname || req.userEmail.split('@')[0], createdAt: profile?.createdAt } })
    } catch (e) { console.error('Get user error:', e); res.status(500).json({ error: '获取用户信息失败' }) }
  })

  /** POST /api/auth/check-session => 200 {valid:bool, kicked:bool} */
  app.post('/api/auth/check-session', async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.json({ valid: false, kicked: false })
    const userId = verifyToken(authHeader.substring(7))
    if (!userId) return res.json({ valid: false, kicked: false })
    const userEmails = getAllUserEmails()
    let userExists = false
    for (const email of userEmails) {
      const user = getUserIndexByEmail(email)
      if (user && user.id === userId) { userExists = true; break }
    }
    res.json({ valid: userExists, kicked: false })
  })

  // ============ Profile API ============

  /** GET /api/profile (auth) => 200 {profile:{id,nickname,birthday,phone,createdAt}} */
  app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
      const profile = await getUserProfile(req.userId)
      res.json({ profile: { id: req.userId, nickname: profile?.nickname || req.userEmail.split('@')[0], birthday: profile?.birthday || '', phone: profile?.phone || '', createdAt: profile?.createdAt } })
    } catch (e) { console.error('Get profile error:', e); res.status(500).json({ error: '获取配置失败' }) }
  })

  /** PUT /api/profile (auth) body:{nickname?,birthday?,phone?} => 200 {profile} */
  app.put('/api/profile', authMiddleware, async (req, res) => {
    try {
      const { nickname, birthday, phone } = req.body
      const profile = await getUserProfile(req.userId)
      if (nickname !== undefined) profile.nickname = nickname
      if (birthday !== undefined) profile.birthday = birthday
      if (phone !== undefined) profile.phone = phone
      await setUserProfile(req.userId, profile)
      if (nickname !== undefined) {
        const currentUser = getUserIndexByEmail(req.userEmail)
        if (currentUser) { currentUser.nickname = nickname; await setUserIndex(req.userEmail, currentUser) }
      }
      res.json({ profile: { id: req.userId, nickname: profile.nickname || req.userEmail.split('@')[0], birthday: profile.birthday || '', phone: profile.phone || '', createdAt: profile.createdAt } })
    } catch (e) { console.error('Update profile error:', e); res.status(500).json({ error: '更新配置失败' }) }
  })

  // ============ Tasks API ============

  /** GET /api/tasks (auth) => 200 {tasks:Task[]} */
  app.get('/api/tasks', authMiddleware, async (req, res) => {
    try { const tasks = await getUserTasks(req.userId); res.json({ tasks }) }
    catch (e) { console.error('Get tasks error:', e); res.status(500).json({ error: '获取任务失败' }) }
  })

  /** POST /api/tasks (auth) body:{name,date,startTime?,endTime?,notes?,category?} => 200 {task} */
  app.post('/api/tasks', authMiddleware, async (req, res) => {
    try {
      const { name, date, startTime, endTime, notes, category } = req.body
      const tasks = await getUserTasks(req.userId)
      const newTask = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6), name, date, startTime: startTime || null, endTime: endTime || null, duration: 0, completed: false, notes: notes || null, category: category || null, created_at: new Date().toISOString() }
      tasks.unshift(newTask)
      await setUserTasks(req.userId, tasks)
      res.json({ task: newTask })
    } catch (e) { console.error('Add task error:', e); res.status(500).json({ error: '添加任务失败' }) }
  })

  /** PUT /api/tasks/:id (auth) body:{...task fields} => 200 {task} | 404 */
  app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params; const updates = req.body
      const tasks = await getUserTasks(req.userId)
      const taskIndex = tasks.findIndex(t => t.id === id)
      if (taskIndex === -1) return res.status(404).json({ error: '任务不存在' })
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
    } catch (e) { console.error('Update task error:', e); res.status(500).json({ error: '更新任务失败' }) }
  })

  /** DELETE /api/tasks/:id (auth) => 200 {success:true} */
  app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params
      const tasks = await getUserTasks(req.userId)
      const taskIndex = tasks.findIndex(t => t.id === id)
      if (taskIndex !== -1) tasks.splice(taskIndex, 1)
      await setUserTasks(req.userId, tasks)
      res.json({ success: true })
    } catch (e) { console.error('Delete task error:', e); res.status(500).json({ error: '删除任务失败' }) }
  })

  // ============ Mission Lists API ============

  /** GET /api/mission-lists (auth) => 200 {lists:MissionList[]} */
  app.get('/api/mission-lists', authMiddleware, async (req, res) => {
    try {
      let lists = await getUserMissionLists(req.userId)
      lists = lists.map(list => { if (!list.groups || list.groups.length === 0) list.groups = [{ id: `${list.id}-default`, name: '默认分组', color: '#667eea', order: 0 }]; return list }).sort((a, b) => (a.order || 0) - (b.order || 0))
      res.json({ lists })
    } catch (e) { console.error('Get mission lists error:', e); res.status(500).json({ error: '获取使命列表失败' }) }
  })

  /** POST /api/mission-lists (auth) body:{name,icon?} => 200 {list} */
  app.post('/api/mission-lists', authMiddleware, async (req, res) => {
    try {
      const { name, icon } = req.body
      const lists = await getUserMissionLists(req.userId)
      const listId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
      const groupId = Date.now().toString()
      const newList = { id: listId, name, icon: icon || '📋', groups: [{ id: groupId, name: '默认分组', color: '#667eea', order: 0 }], created_at: new Date().toISOString() }
      lists.push(newList)
      await setUserMissionLists(req.userId, lists)
      res.json({ list: newList })
    } catch (e) { console.error('Add mission list error:', e); res.status(500).json({ error: '添加使命列表失败' }) }
  })

  /** PUT /api/mission-lists/reorder (auth) body:{orders:[{id,order}]} => 200 {lists} */
  app.put('/api/mission-lists/reorder', authMiddleware, async (req, res) => {
    try {
      const { orders } = req.body
      const lists = await getUserMissionLists(req.userId)
      orders.forEach(({ id, order }) => { const i = lists.findIndex(l => l.id === id); if (i !== -1) lists[i].order = order })
      lists.sort((a, b) => a.order - b.order)
      await setUserMissionLists(req.userId, lists)
      res.json({ lists })
    } catch (e) { console.error('Reorder mission lists error:', e); res.status(500).json({ error: '更新使命列表顺序失败' }) }
  })

  /** PUT /api/mission-lists/:id (auth) body:{name?,icon?,order?} => 200 {list} */
  app.put('/api/mission-lists/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params; const { name, icon, order } = req.body
      const lists = await getUserMissionLists(req.userId)
      const listIndex = lists.findIndex(l => l.id === id)
      if (listIndex === -1) return res.status(404).json({ error: '使命列表不存在' })
      if (name !== undefined) lists[listIndex].name = name
      if (icon !== undefined) lists[listIndex].icon = icon
      if (order !== undefined) lists[listIndex].order = order
      await setUserMissionLists(req.userId, lists)
      res.json({ list: lists[listIndex] })
    } catch (e) { console.error('Update mission list error:', e); res.status(500).json({ error: '更新使命列表失败' }) }
  })

  /** DELETE /api/mission-lists/:id (auth) => 200 {success:true} (also deletes child missions) */
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
    } catch (e) { console.error('Delete mission list error:', e); res.status(500).json({ error: '删除使命列表失败' }) }
  })

  /** PUT /api/mission-lists/:listId/groups/reorder (auth) body:{orders:[{id,order}]} => 200 {groups} */
  app.put('/api/mission-lists/:listId/groups/reorder', authMiddleware, async (req, res) => {
    try {
      const { listId } = req.params; const { orders } = req.body
      const lists = await getUserMissionLists(req.userId)
      const listIndex = lists.findIndex(l => l.id === listId)
      if (listIndex === -1) return res.status(404).json({ error: '使命列表不存在' })
      const list = lists[listIndex]
      list.groups = list.groups || []
      orders.forEach(({ id, order }) => { const i = list.groups.findIndex(g => g.id === id); if (i !== -1) list.groups[i].order = order })
      list.groups.sort((a, b) => a.order - b.order)
      await setUserMissionLists(req.userId, lists)
      res.json({ groups: list.groups })
    } catch (e) { console.error('Reorder groups error:', e); res.status(500).json({ error: '更新分组顺序失败' }) }
  })

  /** POST /api/mission-lists/:listId/groups (auth) body:{name?,color?,order?} => 200 {group} */
  app.post('/api/mission-lists/:listId/groups', authMiddleware, async (req, res) => {
    try {
      const { listId } = req.params; const { name, color, order } = req.body
      const lists = await getUserMissionLists(req.userId)
      const listIndex = lists.findIndex(l => l.id === listId)
      if (listIndex === -1) return res.status(404).json({ error: '使命列表不存在' })
      const list = lists[listIndex]; list.groups = list.groups || []
      const newGroup = { id: Date.now().toString(), name: name || '新分组', color: color || '#667eea', order: order !== undefined ? order : list.groups.length }
      list.groups.push(newGroup)
      await setUserMissionLists(req.userId, lists)
      res.json({ group: newGroup })
    } catch (e) { console.error('Add mission group error:', e); res.status(500).json({ error: '添加分组失败' }) }
  })

  /** PUT /api/mission-lists/:listId/groups/:groupId (auth) body:{name?,color?,order?} => 200 {group} */
  app.put('/api/mission-lists/:listId/groups/:groupId', authMiddleware, async (req, res) => {
    try {
      const { listId, groupId } = req.params; const { name, color, order } = req.body
      const lists = await getUserMissionLists(req.userId)
      const listIndex = lists.findIndex(l => l.id === listId)
      if (listIndex === -1) return res.status(404).json({ error: '使命列表不存在' })
      const list = lists[listIndex]; list.groups = list.groups || []
      let groupIndex = list.groups.findIndex(g => g.id === groupId)
      if (groupIndex === -1) {
        const newGroup = { id: groupId, name: name || '默认分组', color: color || '#667eea', order: order !== undefined ? order : list.groups.length }
        list.groups.push(newGroup)
        await setUserMissionLists(req.userId, lists)
        return res.json({ group: newGroup })
      }
      if (name !== undefined) list.groups[groupIndex].name = name
      if (color !== undefined) list.groups[groupIndex].color = color
      if (order !== undefined) list.groups[groupIndex].order = order
      await setUserMissionLists(req.userId, lists)
      res.json({ group: list.groups[groupIndex] })
    } catch (e) { console.error('Update mission group error:', e); res.status(500).json({ error: '更新分组失败' }) }
  })

  /** DELETE /api/mission-lists/:listId/groups/:groupId (auth) => 200 {success} (min 1 group enforced) */
  app.delete('/api/mission-lists/:listId/groups/:groupId', authMiddleware, async (req, res) => {
    try {
      const { listId, groupId } = req.params
      const lists = await getUserMissionLists(req.userId)
      const listIndex = lists.findIndex(l => l.id === listId)
      if (listIndex === -1) return res.status(404).json({ error: '使命列表不存在' })
      const list = lists[listIndex]; list.groups = list.groups || []
      if (list.groups.length <= 1) return res.status(400).json({ error: '至少需要保留一个分组' })
      const groupIndex = list.groups.findIndex(g => g.id === groupId)
      if (groupIndex === -1) return res.status(404).json({ error: '分组不存在' })
      const defaultGroup = list.groups.find(g => g.id !== groupId)
      if (defaultGroup) {
        const missions = await getUserMissions(req.userId)
        missions.forEach(m => { if (m.list_id === listId && m.group_id === groupId) m.group_id = defaultGroup.id })
        await setUserMissions(req.userId, missions)
      }
      list.groups.splice(groupIndex, 1)
      await setUserMissionLists(req.userId, lists)
      res.json({ success: true })
    } catch (e) { console.error('Delete mission group error:', e); res.status(500).json({ error: '删除分组失败' }) }
  })

  // ============ Missions API ============

  /** GET /api/missions (auth) ?listId=xxx => 200 {missions:Mission[]} */
  app.get('/api/missions', authMiddleware, async (req, res) => {
    try {
      const { listId } = req.query
      let missions = await getUserMissions(req.userId)
      if (listId) missions = missions.filter(m => m.list_id === listId)
      res.json({ missions })
    } catch (e) { console.error('Get missions error:', e); res.status(500).json({ error: '获取使命失败' }) }
  })

  /** POST /api/missions (auth) body:{listId,name,targetCount?,...} => 200 {mission} */
  app.post('/api/missions', authMiddleware, async (req, res) => {
    try {
      const data = req.body
      const missions = await getUserMissions(req.userId)
      const newMission = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6), list_id: data.listId, name: data.name, description: data.description || null, target_count: data.targetCount || 1, current_count: 0, completed: false, group_id: data.groupId || '', date: data.date || '', start_time: data.startTime || '', end_time: data.endTime || '', repeat_strategy: data.repeatStrategy || 'none', repeat_custom_days: data.repeatCustomDays || 1, repeat_end_strategy: data.repeatEndStrategy || 'never', repeat_end_date: data.repeatEndDate || '', repeat_count: data.repeatCount || 1, repeat_completed_count: 0, priority: data.priority || 'none', checklist: data.checklist || [], completed_start_time: '', completed_end_time: '', notes: data.notes || '', reminder_strategy: data.reminderStrategy || 'none', reminder_days: data.reminderDays || 0, reminder_hours: data.reminderHours || 0, reminder_minutes: data.reminderMinutes || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      missions.push(newMission)
      await setUserMissions(req.userId, missions)
      res.json({ mission: newMission })
    } catch (e) { console.error('Add mission error:', e); res.status(500).json({ error: '添加使命失败' }) }
  })

  /** PUT /api/missions/:id (auth) body:{...mission fields} => 200 {mission} */
  app.put('/api/missions/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params; const updates = req.body
      const missions = await getUserMissions(req.userId)
      const missionIndex = missions.findIndex(m => m.id === id)
      if (missionIndex === -1) return res.status(404).json({ error: '使命不存在' })
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
      if (updates.reminderStrategy !== undefined) mission.reminder_strategy = updates.reminderStrategy
      if (updates.reminderDays !== undefined) mission.reminder_days = updates.reminderDays
      if (updates.reminderHours !== undefined) mission.reminder_hours = updates.reminderHours
      if (updates.reminderMinutes !== undefined) mission.reminder_minutes = updates.reminderMinutes
      mission.updated_at = new Date().toISOString()
      await setUserMissions(req.userId, missions)
      res.json({ mission })
    } catch (e) { console.error('Update mission error:', e); res.status(500).json({ error: '更新使命失败' }) }
  })

  /** DELETE /api/missions/:id (auth) => 200 {success:true} */
  app.delete('/api/missions/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params
      const missions = await getUserMissions(req.userId)
      await setUserMissions(req.userId, missions.filter(m => m.id !== id))
      res.json({ success: true })
    } catch (e) { console.error('Delete mission error:', e); res.status(500).json({ error: '删除使命失败' }) }
  })

  // ============ Stats API ============

  /** GET /api/stats (auth) => 200 {stats:{listCount,missionCount,taskCount}} */
  app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
      const lists = await getUserMissionLists(req.userId)
      const missions = await getUserMissions(req.userId)
      const tasks = await getUserTasks(req.userId)
      res.json({ stats: { listCount: lists.length, missionCount: missions.length, taskCount: tasks.length } })
    } catch (e) { console.error('Get stats error:', e); res.status(500).json({ error: '获取统计失败' }) }
  })

  // ============ Data API (type/key based) ============

  /** GET /api/data/:type/:key (auth) => 200 {success:true, data:any} */
  app.get('/api/data/:type/:key', authMiddleware, async (req, res) => {
    try {
      let data = await getUserKV(req.userId, req.params.type, req.params.key)
      if (req.params.type === 'system' && req.params.key === 'state') {
        if (!data || data.guideCompleted === undefined) {
          const legacyPath = path.join(DATA_DIR, req.userId, 'system', 'guideState.json')
          const legacy = readJson(legacyPath)
          if (legacy && legacy.guideCompleted !== undefined) {
            if (!data) data = {}
            data.guideCompleted = legacy.guideCompleted
            await setUserKV(req.userId, 'system', 'state', data)
            try { fs.unlinkSync(legacyPath) } catch {}
            console.log(`[Data] 引导状态已从 guideState.json 迁移到 state.json: ${req.userId}`)
          }
        }
      }
      res.json({ success: true, data: data || null })
    }
    catch (e) { console.error('Get data error:', e); res.status(500).json({ success: false, error: '获取数据失败' }) }
  })

  /** POST /api/data/:type/:key (auth) body:{data} => 200 {success:true} */
  app.post('/api/data/:type/:key', authMiddleware, async (req, res) => {
    try { await setUserKV(req.userId, req.params.type, req.params.key, req.body.data); res.json({ success: true }) }
    catch (e) { console.error('Set data error:', e); res.status(500).json({ success: false, error: '设置数据失败' }) }
  })

  /** DELETE /api/data/:type/:key (auth) => 200 {success:true} */
  app.delete('/api/data/:type/:key', authMiddleware, async (req, res) => {
    try { await deleteUserKV(req.userId, req.params.type, req.params.key); res.json({ success: true }) }
    catch (e) { console.error('Delete data error:', e); res.status(500).json({ success: false, error: '删除数据失败' }) }
  })

  // ============ Settings API ============

  /** GET /api/settings (auth) => 200 {settings:{...}} */
  app.get('/api/settings', authMiddleware, async (req, res) => {
    try { const settings = await getUserSettings(req.userId); res.json({ settings }) }
    catch (e) { console.error('Get settings error:', e); res.status(500).json({ error: '获取设置失败' }) }
  })


  /** PUT /api/settings (auth) body:{...} => 200 {settings} */
  app.put('/api/settings', authMiddleware, async (req, res) => {
    try {
      const existingSettings = await getUserSettings(req.userId)
      const mergedSettings = { ...existingSettings, ...req.body }
      await setUserSettings(req.userId, mergedSettings)
      res.json({ settings: mergedSettings })
    } catch (e) { console.error('Update settings error:', e); res.status(500).json({ error: '更新设置失败' }) }
  })

  // ============ Export/Import API ============

  /** GET /api/export (auth) => 200 {所有模块数据} - 导出当前用户所有模块数据 */
  app.get('/api/export', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId
      const userEmail = req.userEmail
      const data = {
        // 用户索引
        user_index: getUserIndexByEmail(userEmail),
        // 足迹
        tasks: await getUserTasks(userId),
        // 专注
        focus_favorites: await getUserKV(userId, 'focus', 'favorites'),
        focus_records: await getUserKV(userId, 'focus', 'records'),
        // 清单
        lists: await getUserMissionLists(userId),
        missions: await getUserMissions(userId),
        // 倒数日
        countdown_categories: await getUserKV(userId, 'countdown', 'categories'),
        countdowns: await getUserKV(userId, 'countdown', 'countdowns'),
        // 课程表
        courses: await getUserKV(userId, 'course', 'courses'),
        // 我的
        profile: await getUserProfile(userId),
        login_info: await getUserSession(userId),
        settings: await getUserSettings(userId),
        system_state: await getUserKV(userId, 'system', 'state'),
        exportTime: new Date().toISOString()
      }
      res.json({ success: true, data })
    } catch (e) {
      console.error('Export error:', e)
      res.status(500).json({ error: '导出数据失败' })
    }
  })

  /** POST /api/import body:{各模块数据} => 200 {success} - 导入数据（登录后可导入到当前账号，未登录时从user_index获取账号信息） */
  app.post('/api/import', async (req, res) => {
    try {
      const { user_index, tasks, focus_favorites, focus_records, lists, missions, countdown_categories, countdowns, courses, course_recorded_courses, profile, login_info, settings, system_state } = req.body

      // 尝试从token获取用户信息（可选，不要求必须登录）
      let userId = req.userId
      let userEmail = req.userEmail

      // 如果没有通过中间件获取，尝试从token获取
      if (!userId) {
        const token = req.headers.authorization?.replace('Bearer ', '')
        if (token) {
          userId = verifyToken(token)
          if (userId) {
            userEmail = (await getUserProfile(userId))?.email || ''
          }
        }
      }

      // 如果未登录，从user_index获取
      if (!userId && user_index?.id) {
        userId = user_index.id
        userEmail = user_index.email || ''
      }

      if (!userId) {
        return res.status(400).json({ error: '缺少用户信息，请确保已登录或导出文件中包含账户信息' })
      }

      // 恢复用户索引
      if (user_index && userEmail) await setUserIndex(userEmail, { ...user_index, email: userEmail })

      if (tasks) await setUserTasks(userId, tasks)
      if (focus_favorites !== undefined) await setUserKV(userId, 'focus', 'favorites', focus_favorites)
      if (focus_records !== undefined) await setUserKV(userId, 'focus', 'records', focus_records)
      if (lists) await setUserMissionLists(userId, lists)
      if (missions) await setUserMissions(userId, missions)
      if (countdown_categories !== undefined) await setUserKV(userId, 'countdown', 'categories', countdown_categories)
      if (countdowns !== undefined) await setUserKV(userId, 'countdown', 'countdowns', countdowns)
      if (courses !== undefined) await setUserKV(userId, 'course', 'courses', courses)
      if (profile) await setUserProfile(userId, profile)
      if (login_info) await setUserSession(userId, login_info)
      if (settings) await setUserSettings(userId, settings)
      if (system_state !== undefined) await setUserKV(userId, 'system', 'state', system_state)

      console.log(`[Import] Data imported for user ${userId}`)
      res.json({ success: true })
    } catch (e) {
      console.error('Import error:', e)
      res.status(500).json({ error: '导入数据失败' })
    }
  })

  /** POST /api/clean body:{各模块null值} => 200 {success} - 清理指定模块数据（不删除账号信息） */
  app.post('/api/clean', async (req, res) => {
    try {
      const userId = req.userId
      if (!userId) return res.status(401).json({ error: '请先登录' })

      const cleanMap = req.body
      const PROTECTED_KEYS = ['user_index', 'email', 'profile', 'login_info']

      for (const key of Object.keys(cleanMap)) {
        if (PROTECTED_KEYS.includes(key)) continue
        if (key === 'lists') await setUserMissionLists(userId, [])
        else if (key === 'missions') await setUserMissions(userId, [])
        else if (key === 'tasks') await setUserTasks(userId, [])
        else if (key === 'focus_favorites') await setUserKV(userId, 'focus', 'favorites', [])
        else if (key === 'focus_records') await setUserKV(userId, 'focus', 'records', [])
        else if (key === 'countdown_categories') await setUserKV(userId, 'countdown', 'categories', [])
        else if (key === 'countdowns') await setUserKV(userId, 'countdown', 'countdowns', [])
        else if (key === 'courses') await setUserKV(userId, 'course', 'courses', [])
        else if (key === 'settings') await setUserKV(userId, 'system', 'settings', null)
        else if (key === 'system_state') await setUserKV(userId, 'system', 'state', null)
        else if (key === 'profile') continue
      }

      console.log(`[Clean] Data cleaned for user ${userId}: ${Object.keys(cleanMap).join(', ')}`)
      res.json({ success: true })
    } catch (e) {
      console.error('Clean error:', e)
      res.status(500).json({ error: '清理数据失败' })
    }
  })

  const LOG_DIR = path.join(path.dirname(DATA_DIR), 'logs')

  /** POST /api/logs body:{logs:LogEntry[]} => 200 {success:true} */
  app.post('/api/logs', async (req, res) => {
    try {
      const { logs } = req.body
      if (!Array.isArray(logs)) return res.status(400).json({ error: 'logs 必须是数组' })
      if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
      const today = new Date().toISOString().slice(0, 10)
      const logFile = path.join(LOG_DIR, `app-${today}.log`)
      const p = (n, l = 2) => String(n).padStart(l, '0')
      const lines = logs.map(e => {
        const d = new Date(e.timestamp || Date.now())
        const ts = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}:${p(d.getMilliseconds(), 3)}`
        const level = ['TRACE','DEBUG','INFO','WARN','ERROR'][e.level] || 'INFO'
        const meta = e.meta ? ' ' + JSON.stringify(e.meta) : ''
        const stack = e.stack ? '\n' + e.stack : ''
        return `[${ts}] [${level}] ${e.message}${meta}${stack}`
      }).join('\n') + '\n'
      fs.appendFileSync(logFile, lines, 'utf-8')
      res.json({ success: true })
    } catch (e) { console.error('Write logs error:', e); res.status(500).json({ error: '写入日志失败' }) }
  })

  /** GET /api/logs => 200 {logs:string} */
  app.get('/api/logs', (req, res) => {
    try {
      if (!fs.existsSync(LOG_DIR)) return res.json({ logs: '' })
      const today = new Date().toISOString().slice(0, 10)
      const logFile = path.join(LOG_DIR, `app-${today}.log`)
      if (!fs.existsSync(logFile)) return res.json({ logs: '' })
      const content = fs.readFileSync(logFile, 'utf-8')
      res.json({ logs: content })
    } catch (e) { console.error('Read logs error:', e); res.status(500).json({ error: '读取日志失败' }) }
  })

  // ============ Health Check ============

  /** GET /api/health => 200 {status:"ok",time,wsPort?} */
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', storage: 'local', dataDir: DATA_DIR })
  })

  // ============ Version ============

  /** GET /api/version => 200 {version,date} */
  app.get('/api/version', (req, res) => {
    try {
      const pkgPath = path.join(resourcesPath, 'app.asar.unpacked', 'package.json')
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
        res.json({ version: pkg.version || '0.0.0' })
      } else {
        res.status(404).json({ error: 'package.json not found' })
      }
    } catch (e) { res.status(500).json({ error: 'Failed to read package.json' }) }
  })

  // ============ Static files ============

  if (fs.existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH))
    app.use((req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(DIST_PATH, 'index.html'))
      } else {
        res.status(404).json({ error: '接口不存在' })
      }
    })
  }

  return { app, server }
}

module.exports = { createProdServer }
