const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const http = require('http')

// 云端 API 独立 Pino 日志
const { initLogger, state } = require(path.join(__dirname, 'lib', 'logger.cjs'))

async function createProdServer(options = {}) {
  const { port = 5000, dataDir, resourcesPath = path.resolve(__dirname, '..'), updatesDir = path.join(resourcesPath, 'updates') } = options

  const configuredJwtSecret = options.jwtSecret || process.env.ESD_JWT_SECRET || ''
  if (options.requireSecureAuth && configuredJwtSecret.length < 32) {
    throw new Error('云端服务必须配置至少 32 个字符的 ESD_JWT_SECRET')
  }
  const tokenSecret = configuredJwtSecret || 'earth-survival-diary-local-development-secret'
  const allowLegacyTokens = options.allowLegacyTokens !== undefined
    ? options.allowLegacyTokens
    : !options.requireSecureAuth

  // Resolve paths
  const DATA_DIR = dataDir || path.join(resourcesPath, 'data')
  const UPDATES_DIR = updatesDir || path.join(resourcesPath, 'updates')
  const LOG_DIR = path.join(path.dirname(DATA_DIR), 'logs')

  // 初始化云端 API 自己的 Pino 日志实例。
  initLogger(LOG_DIR)
  state.logger.info('[ProdServer] Express 启动中...')

  // Ensure directories exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  fs.mkdirSync(UPDATES_DIR, { recursive: true })

  // 业务数据按用户与模块写入 ESD_DATA_DIR 下的 YAML 文件。

  function readJson(filePath, defaultVal = null) {
    if (!fs.existsSync(filePath)) return defaultVal
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      return defaultVal
    }
  }

  // ============ Storage ============
  // 数据存储：仅本地 YAML 文件（server/lib/yaml-store.cjs）。文件读写失败时启动或请求失败。

  let storage = null

  async function initStorage() {
    try {
      const { createYamlStore } = require(path.join(__dirname, 'lib', 'yaml-store.cjs'))
      const yamlStore = await createYamlStore({ nodeModulesPath, dataDir: DATA_DIR })
      storage = yamlStore
      state.logger.info(`[Storage] YAML 文件存储已就绪（${yamlStore.dataDir}）`)

      // 笔记数据迁移（分类 → 标签、置顶字段化）：幂等，已迁移则跳过。
      // 失败不阻断启动，仅告警——迁移可在下次启动重试。
      try {
        const { migrateNotesToTags } = require(path.join(__dirname, 'lib', 'notes-migration.cjs'))
        const stats = await migrateNotesToTags(yamlStore, state.logger, DATA_DIR)
        if (stats.migrated > 0) {
          state.logger.info(
            { users: stats.users, migrated: stats.migrated, notes: stats.notes, tags: stats.tags, orphans: stats.orphans },
            '[笔记迁移] 迁移完成'
          )
        }
      } catch (e) {
        state.logger.warn({ err: e && e.message }, '[笔记迁移] 迁移失败，下次启动将重试')
      }
    } catch (e) {
      state.logger.error({ err: e && e.message }, '[Storage] YAML 文件存储初始化失败，应用无法启动')
      throw new Error('[YAML] 本地文件存储初始化失败，请检查 ESD_DATA_DIR 的路径和读写权限：' + (e && e.message ? e.message : e))
    }
  }

  // ===== 统一存储接口（各 API 端点调用） =====
  function getUserIndexByEmail(email) { return storage.getUserIndexByEmail(email) }
  function setUserIndex(email, entry) { return storage.setUserIndex(email, entry) }
  function deleteUserIndex(email) { return storage.deleteUserIndex(email) }
  function getAllUserEmails() { return storage.getAllUserEmails() }
  function emailExists(email) { return storage.emailExists(email) }

  function getUserProfile(userId) { return storage.getUserKV(userId, 'profile', 'profile') }
  function setUserProfile(userId, profile) { return storage.setUserKV(userId, 'profile', 'profile', profile) }

  function getUserFootprintTasks(userId) { return storage.getUserKV(userId, 'footprint', 'footprint') }
  function setUserFootprintTasks(userId, tasks) { return storage.setUserKV(userId, 'footprint', 'footprint', tasks) }

  function getUserDiaries(userId) { return storage.getUserKV(userId, 'footprint', 'diary') }
  function setUserDiaries(userId, diaries) { return storage.setUserKV(userId, 'footprint', 'diary', diaries) }

  function getUserListChecklists(userId) { return storage.getUserKV(userId, 'list', 'lists') }
  function setUserListChecklists(userId, taskLists) { return storage.setUserKV(userId, 'list', 'lists', taskLists) }

  function getUserListTasks(userId) { return storage.getUserKV(userId, 'list', 'tasks') }
  function setUserListTasks(userId, taskLists) { return storage.setUserKV(userId, 'list', 'tasks', taskLists) }

  function getUserSettings(userId) { return storage.getUserKV(userId, 'settings', 'settings') }
  function setUserSettings(userId, settings) { return storage.setUserKV(userId, 'settings', 'settings', settings) }

  function getUserKV(userId, type, key) { return storage.getUserKV(userId, type, key) }
  function setUserKV(userId, type, key, data) { return storage.setUserKV(userId, type, key, data) }
  function deleteUserKV(userId, type, key) { return storage.deleteUserKV(userId, type, key) }

  // Session

  // ============ Helpers ============

  function hashPassword(password) {
    const salt = crypto.randomBytes(16)
    const cost = 16384
    const hash = crypto.scryptSync(String(password), salt, 64, { N: cost, r: 8, p: 1 }).toString('hex')
    return `scrypt$${cost}$${salt.toString('hex')}$${hash}`
  }

  function verifyPassword(password, storedHash) {
    try {
      const parts = String(storedHash || '').split('$')
      if (parts[0] === 'scrypt' && parts.length === 4) {
        const cost = Number(parts[1])
        const salt = Buffer.from(parts[2], 'hex')
        const expected = Buffer.from(parts[3], 'hex')
        if (!Number.isInteger(cost) || cost < 1024 || cost > 32768 || salt.length < 16 || expected.length !== 64) return false
        const actual = crypto.scryptSync(String(password), salt, expected.length, { N: cost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
        return crypto.timingSafeEqual(actual, expected)
      }

      // 旧版使用无盐 SHA-256；首次成功登录后会自动升级为 scrypt。
      const expected = Buffer.from(String(storedHash || ''), 'hex')
      const actual = crypto.createHash('sha256').update(String(password)).digest()
      return expected.length === actual.length && crypto.timingSafeEqual(actual, expected)
    } catch {
      return false
    }
  }

  function generateUserId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  }

  function generateToken(userId) {
    const payload = Buffer.from(JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    })).toString('base64url')
    const signature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url')
    return `${payload}.${signature}`
  }

  function verifyToken(token) {
    try {
      const [payload, signature, extra] = String(token || '').split('.')
      if (payload && signature && !extra) {
        const expected = crypto.createHmac('sha256', tokenSecret).update(payload).digest()
        const provided = Buffer.from(signature, 'base64url')
        if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
        if (!claims.sub || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) return null
        return String(claims.sub)
      }

      if (!allowLegacyTokens || !token) return null
      const legacyPayload = Buffer.from(String(token), 'base64').toString('utf-8')
      const [legacyUserId] = legacyPayload.split(':')
      return legacyUserId || null
    } catch {
      return null
    }
  }

  // ============ Create HTTP server ============

  const nodeModulesPath = options.nodeModulesPath || path.join(resourcesPath, 'node_modules')
  const express = require(path.join(nodeModulesPath, 'express'))
  const corsPkg = require(path.join(nodeModulesPath, 'cors'))

  const app = express()
  if (options.trustProxy) app.set('trust proxy', 1)
  const server = http.createServer(app)

  app.use(corsPkg({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }))
  app.use(express.json({ limit: '10mb' }))
  app.use('/updates', express.static(UPDATES_DIR, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (path.basename(filePath).toLowerCase() === 'latest.yml') {
        res.setHeader('Cache-Control', 'no-store')
      }
    }
  }))

  const authAttempts = new Map()
  const authWindowMs = 15 * 60 * 1000
  const authAttemptLimit = 20
  function limitAuthAttempts(req, res, next) {
    const now = Date.now()
    const client = req.ip || req.socket.remoteAddress || 'unknown'
    const attempts = (authAttempts.get(client) || []).filter(time => now - time < authWindowMs)
    if (attempts.length >= authAttemptLimit) {
      const retryAfter = Math.ceil((authWindowMs - (now - attempts[0])) / 1000)
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({ error: '尝试次数过多，请稍后再试' })
    }
    attempts.push(now)
    authAttempts.set(client, attempts)
    if (authAttempts.size > 5000) {
      for (const [ip, times] of authAttempts) {
        if (!times.some(time => now - time < authWindowMs)) authAttempts.delete(ip)
      }
    }
    next()
  }

  // 请求访问日志：简洁中文格式 "接口 GET /api/xxx 返回 200 (2ms)"
  // 高频低价值端点跳过，零附加字段（msg 即全部）
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      if (req.url === '/api/health') return
      const duration = Date.now() - start
      state.logger.info(`[HTTP] 接口 ${req.method} ${req.url} 返回 ${res.statusCode} (${duration}ms)`)
    })
    next()
  })

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
      const userEmails = await getAllUserEmails()
      let userEntry = null
      for (const email of userEmails) {
        const user = await getUserIndexByEmail(email)
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
      state.logger.error({ err: e }, "鉴权中间件错误")
      res.status(500).json({ error: '认证服务异常' })
    }
  }

  // ============ Auth API ============

  /** POST /api/auth/signup
   *  body: {email, password, nickname?}
   *  => 200 {user, session:{access_token}} | 400/500 {error} */
  app.post('/api/auth/signup', limitAuthAttempts, async (req, res) => {
    try {
      const { email, password, nickname } = req.body
      if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return res.status(400).json({ error: '邮箱和密码必填' })
      if (email.length > 255 || password.length > 256) return res.status(400).json({ error: '邮箱或密码长度超出限制' })
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
      res.json({ user: { id: userId, email, nickname: userEntry.nickname, createdAt: userEntry.createdAt }, session: { access_token: token } })
    } catch (e) { state.logger.error({ err: e }, "注册错误"); res.status(500).json({ error: '注册失败，请稍后重试' }) }
  })

  /** POST /api/auth/signin
   *  body: {email, password}
   *  => 200 {user, session:{access_token}} | 400 {error} */
  app.post('/api/auth/signin', limitAuthAttempts, async (req, res) => {
    try {
      const { email, password } = req.body
      if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return res.status(400).json({ error: '邮箱和密码必填' })
      if (email.length > 255 || password.length > 256) return res.status(400).json({ error: '邮箱或密码长度超出限制' })
      const userEntry = await getUserIndexByEmail(email)
      if (!userEntry || !verifyPassword(password, userEntry.passwordHash)) return res.status(400).json({ error: '邮箱或密码错误' })
      if (!String(userEntry.passwordHash || '').startsWith('scrypt$')) {
        userEntry.passwordHash = hashPassword(password)
        await setUserIndex(email, userEntry)
      }
      const token = generateToken(userEntry.id)
      res.json({ user: { id: userEntry.id, email: userEntry.email, nickname: userEntry.nickname, createdAt: userEntry.createdAt }, session: { access_token: token } })
    } catch (e) { state.logger.error({ err: e }, "登录错误"); res.status(500).json({ error: '登录失败，请稍后重试' }) }
  })

  /** POST /api/auth/signout => 200 {success:true} */
  app.post('/api/auth/signout', async (_req, res) => {
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
      await storage.deleteUserData(userId)

      state.logger.info({ userEmail, userId }, '[账号] 用户已删除')
      res.json({ success: true })
    } catch (e) {
      state.logger.error({ err: e }, "删除账号错误")
      res.status(500).json({ error: '注销账号失败' })
    }
  })

  // 全量清空会影响所有账号，仅允许本地维护模式使用；云端不暴露此能力。
  if (!options.cloudMode) {
    app.delete('/api/data/all', authMiddleware, async (_req, res) => {
      try {
        await storage.clearAllUserData()
        state.logger.info("[Data] 所有用户数据已清空")
        res.json({ success: true })
      } catch (e) {
        state.logger.error({ err: e }, "清空数据错误")
        res.status(500).json({ error: '清空数据失败' })
      }
    })
  }

  /** POST /api/auth/change-email (auth) body:{newEmail,password} => 200 {success,email} */
  app.post('/api/auth/change-email', authMiddleware, async (req, res) => {
    try {
      const { newEmail, password } = req.body
      if (typeof newEmail !== 'string' || typeof password !== 'string' || !newEmail || !password || newEmail.length > 255 || password.length > 256) return res.status(400).json({ error: '新邮箱和密码格式不正确' })
      if (await emailExists(newEmail)) return res.status(400).json({ error: '该邮箱已被其他账号使用' })
      const currentUser = await getUserIndexByEmail(req.userEmail)
      if (!currentUser || !verifyPassword(password, currentUser.passwordHash)) return res.status(400).json({ error: '密码错误' })
      await setUserIndex(newEmail, { ...currentUser, email: newEmail })
      await deleteUserIndex(req.userEmail)
      req.userEmail = newEmail
      res.json({ success: true, email: newEmail })
    } catch (e) { state.logger.error({ err: e }, "修改邮箱错误"); res.status(500).json({ error: '修改邮箱失败' }) }
  })

  /** POST /api/auth/change-password (auth) body:{oldPassword,newPassword} => 200 {success} */
  app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body
      if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || !oldPassword || !newPassword) return res.status(400).json({ error: '当前密码和新密码必填' })
      if (newPassword.length < 6 || newPassword.length > 256 || oldPassword.length > 256) return res.status(400).json({ error: '新密码长度需为 6 到 256 位' })
      const currentUser = await getUserIndexByEmail(req.userEmail)
      if (!currentUser || !verifyPassword(oldPassword, currentUser.passwordHash)) return res.status(400).json({ error: '当前密码错误' })
      currentUser.passwordHash = hashPassword(newPassword)
      await setUserIndex(req.userEmail, currentUser)
      res.json({ success: true })
    } catch (e) { state.logger.error({ err: e }, "修改密码错误"); res.status(500).json({ error: '修改密码失败' }) }
  })

  /** GET /api/auth/users (auth) => 200 {users:[当前账号]} */
  app.get('/api/auth/users', authMiddleware, async (req, res) => {
    try {
      const user = await getUserIndexByEmail(req.userEmail)
      res.json({ users: user ? [{ email: user.email, nickname: user.nickname || user.email.split('@')[0], createdAt: user.createdAt }] : [] })
    } catch (e) {
      state.logger.error({ err: e }, "获取用户列表错误")
      res.status(500).json({ error: '获取用户列表失败' })
    }
  })

  // 旧版全局设置可能包含账号自动填充信息；云端多账号模式不开放共享的全局配置。
  if (!options.cloudMode) {
    app.get('/api/auth/settings', authMiddleware, async (_req, res) => {
      try {
        const settings = await storage.getAppSettings()
        res.json({ settings: settings || {} })
      } catch (e) {
        res.json({ settings: {} })
      }
    })

    app.post('/api/auth/settings', authMiddleware, async (req, res) => {
      try {
        await storage.setAppSetting(req.body.key, req.body.value)
        res.json({ success: true })
      } catch (e) {
        state.logger.error({ err: e }, "更新设置错误")
        res.status(500).json({ error: '更新设置失败' })
      }
    })
  }

  /** GET /api/auth/user (auth) => 200 {user:{id,email,nickname,createdAt}} */
  app.get('/api/auth/user', authMiddleware, async (req, res) => {
    try {
      const profile = await getUserProfile(req.userId)
      res.json({ user: { id: req.userId, email: req.userEmail, nickname: profile?.nickname || req.userEmail.split('@')[0], createdAt: profile?.createdAt } })
    } catch (e) { state.logger.error({ err: e }, "获取用户错误"); res.status(500).json({ error: '获取用户信息失败' }) }
  })

  /** POST /api/auth/check-session => 200 {valid:bool, kicked:bool} */
  app.post('/api/auth/check-session', async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.json({ valid: false, kicked: false })
    const userId = verifyToken(authHeader.substring(7))
    if (!userId) return res.json({ valid: false, kicked: false })
    const userEmails = await getAllUserEmails()
    let userExists = false
    for (const email of userEmails) {
      const user = await getUserIndexByEmail(email)
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
    } catch (e) { state.logger.error({ err: e }, "获取配置错误"); res.status(500).json({ error: '获取配置失败' }) }
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
        const currentUser = await getUserIndexByEmail(req.userEmail)
        if (currentUser) { currentUser.nickname = nickname; await setUserIndex(req.userEmail, currentUser) }
      }
      res.json({ profile: { id: req.userId, nickname: profile.nickname || req.userEmail.split('@')[0], birthday: profile.birthday || '', phone: profile.phone || '', createdAt: profile.createdAt } })
    } catch (e) { state.logger.error({ err: e }, "更新配置错误"); res.status(500).json({ error: '更新配置失败' }) }
  })

  // ============ Tasks API ============

  /** GET /api/tasks (auth) => 200 {tasks:Task[]} */
  app.get('/api/tasks', authMiddleware, async (req, res) => {
    try { const tasks = await getUserFootprintTasks(req.userId); res.json({ tasks }) }
    catch (e) { state.logger.error({ err: e }, "获取任务错误"); res.status(500).json({ error: '获取任务失败' }) }
  })

  /** POST /api/tasks (auth) body:{name,date,startTime?,endTime?,notes?,content?,category?} => 200 {task} */
  app.post('/api/tasks', authMiddleware, async (req, res) => {
    try {
      const { name, date, startTime, endTime, notes, content, category, icon } = req.body
      const tasks = await getUserFootprintTasks(req.userId)
      const newTask = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6), name, date, startTime: startTime || null, endTime: endTime || null, duration: 0, completed: false, notes: notes || null, content: content || null, category: category || null, icon: icon || null, created_at: new Date().toISOString() }
      tasks.unshift(newTask)
      await setUserFootprintTasks(req.userId, tasks)
      res.json({ task: newTask })
    } catch (e) { state.logger.error({ err: e }, "添加任务错误"); res.status(500).json({ error: '添加任务失败' }) }
  })

  /** PUT /api/tasks/:id (auth) body:{...task fields} => 200 {task} | 404 */
  app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params; const updates = req.body
      const tasks = await getUserFootprintTasks(req.userId)
      const taskIndex = tasks.findIndex(t => t.id === id)
      if (taskIndex === -1) return res.status(404).json({ error: '任务不存在' })
      const task = tasks[taskIndex]
      if (updates.name !== undefined) task.name = updates.name
      if (updates.date !== undefined) task.date = updates.date
      if (updates.startTime !== undefined) task.startTime = updates.startTime || null
      if (updates.endTime !== undefined) task.endTime = updates.endTime || null
      if (updates.notes !== undefined) task.notes = updates.notes || null
      if (updates.content !== undefined) task.content = updates.content || null
      if (updates.category !== undefined) task.category = updates.category || null
      if (updates.icon !== undefined) task.icon = updates.icon || null
      if (updates.completed !== undefined) task.completed = updates.completed
      if (updates.pinned !== undefined) task.pinned = updates.pinned
      await setUserFootprintTasks(req.userId, tasks)
      res.json({ task })
    } catch (e) { state.logger.error({ err: e }, "更新任务错误"); res.status(500).json({ error: '更新任务失败' }) }
  })

  /** DELETE /api/tasks/:id (auth) => 200 {success:true} */
  app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params
      const tasks = await getUserFootprintTasks(req.userId)
      const taskIndex = tasks.findIndex(t => t.id === id)
      if (taskIndex !== -1) tasks.splice(taskIndex, 1)
      await setUserFootprintTasks(req.userId, tasks)
      res.json({ success: true })
    } catch (e) { state.logger.error({ err: e }, "删除任务错误"); res.status(500).json({ error: '删除任务失败' }) }
  })

  // ============ Diaries API ============

  /** GET /api/diaries (auth) => 200 {tasks:Task[]} */
  app.get('/api/diaries', authMiddleware, async (req, res) => {
    try { const diaries = await getUserDiaries(req.userId); res.json({ tasks: diaries }) }
    catch (e) { state.logger.error({ err: e }, "获取日记错误"); res.status(500).json({ error: '获取日记失败' }) }
  })

  /** POST /api/diaries (auth) body:{...task fields} => 200 {task} */
  app.post('/api/diaries', authMiddleware, async (req, res) => {
    try {
      const { name, date, startTime, endTime, notes, content, category, icon } = req.body
      const diaries = await getUserDiaries(req.userId)
      const newDiary = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6), name, date, startTime: startTime || null, endTime: endTime || null, duration: 0, completed: false, notes: notes || null, content: content || null, category: category || null, icon: icon || null, created_at: new Date().toISOString() }
      diaries.unshift(newDiary)
      await setUserDiaries(req.userId, diaries)
      res.json({ task: newDiary })
    } catch (e) { state.logger.error({ err: e }, "添加日记错误"); res.status(500).json({ error: '添加日记失败' }) }
  })

  /** PUT /api/diaries/:id (auth) body:{...task fields} => 200 {task} | 404 */
  app.put('/api/diaries/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params; const updates = req.body
      const diaries = await getUserDiaries(req.userId)
      const diaryIndex = diaries.findIndex(d => d.id === id)
      if (diaryIndex === -1) return res.status(404).json({ error: '日记不存在' })
      const diary = diaries[diaryIndex]
      if (updates.name !== undefined) diary.name = updates.name
      if (updates.date !== undefined) diary.date = updates.date
      if (updates.startTime !== undefined) diary.startTime = updates.startTime || null
      if (updates.endTime !== undefined) diary.endTime = updates.endTime || null
      if (updates.notes !== undefined) diary.notes = updates.notes || null
      if (updates.content !== undefined) diary.content = updates.content || null
      if (updates.category !== undefined) diary.category = updates.category || null
      if (updates.icon !== undefined) diary.icon = updates.icon || null
      if (updates.completed !== undefined) diary.completed = updates.completed
      if (updates.pinned !== undefined) diary.pinned = updates.pinned
      await setUserDiaries(req.userId, diaries)
      res.json({ task: diary })
    } catch (e) { state.logger.error({ err: e }, "更新日记错误"); res.status(500).json({ error: '更新日记失败' }) }
  })

  /** DELETE /api/diaries/:id (auth) => 200 {success:true} */
  app.delete('/api/diaries/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params
      const diaries = await getUserDiaries(req.userId)
      const diaryIndex = diaries.findIndex(d => d.id === id)
      if (diaryIndex !== -1) diaries.splice(diaryIndex, 1)
      await setUserDiaries(req.userId, diaries)
      res.json({ success: true })
    } catch (e) { state.logger.error({ err: e }, "删除日记错误"); res.status(500).json({ error: '删除日记失败' }) }
  })

  // ============ Lists API ============

  /** GET /api/list-lists (auth) => 200 {lists:List[]} */
  app.get('/api/list-lists', authMiddleware, async (req, res) => {
    try {
      let lists = await getUserListChecklists(req.userId)
      lists = lists.map(list => { if (!list.groups || list.groups.length === 0) list.groups = [{ id: `${list.id}-default`, name: '默认分组', color: '#667eea', order: 0 }]; return list }).sort((a, b) => (a.order || 0) - (b.order || 0))
      res.json({ lists })
    } catch (e) { state.logger.error({ err: e }, "获取清单列表错误"); res.status(500).json({ error: '获取清单列表失败' }) }
  })

  /** POST /api/list-lists (auth) body:{name,icon?} => 200 {list} */
  app.post('/api/list-lists', authMiddleware, async (req, res) => {
    try {
      const { name, icon } = req.body
      const lists = await getUserListChecklists(req.userId)
      const listId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
      const groupId = Date.now().toString()
      const newList = { id: listId, name, icon: icon || '📋', groups: [{ id: groupId, name: '默认分组', color: '#667eea', order: 0 }], created_at: new Date().toISOString() }
      lists.push(newList)
      await setUserListChecklists(req.userId, lists)
      res.json({ list: newList })
    } catch (e) { state.logger.error({ err: e }, "添加清单列表错误"); res.status(500).json({ error: '添加清单列表失败' }) }
  })

  /** PUT /api/list-lists/reorder (auth) body:{orders:[{id,order}]} => 200 {lists} */
  app.put('/api/list-lists/reorder', authMiddleware, async (req, res) => {
    try {
      const { orders } = req.body
      const lists = await getUserListChecklists(req.userId)
      orders.forEach(({ id, order }) => { const i = lists.findIndex(l => l.id === id); if (i !== -1) lists[i].order = order })
      lists.sort((a, b) => a.order - b.order)
      await setUserListChecklists(req.userId, lists)
      res.json({ lists })
    } catch (e) { state.logger.error({ err: e }, "重排序清单列表错误"); res.status(500).json({ error: '更新清单列表顺序失败' }) }
  })

  /** PUT /api/list-lists/:id (auth) body:{name?,icon?,order?} => 200 {list} */
  app.put('/api/list-lists/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params; const { name, icon, order } = req.body
      const lists = await getUserListChecklists(req.userId)
      const listIndex = lists.findIndex(l => l.id === id)
      if (listIndex === -1) return res.status(404).json({ error: '清单列表不存在' })
      if (name !== undefined) lists[listIndex].name = name
      if (icon !== undefined) lists[listIndex].icon = icon
      if (order !== undefined) lists[listIndex].order = order
      await setUserListChecklists(req.userId, lists)
      res.json({ list: lists[listIndex] })
    } catch (e) { state.logger.error({ err: e }, "更新清单列表错误"); res.status(500).json({ error: '更新清单列表失败' }) }
  })

  /** DELETE /api/list-lists/:id (auth) body:{deleteTasks?:boolean,transferToListId?:string} => 200 {success:true} */
  app.delete('/api/list-lists/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params
      const { deleteTasks, transferToListId } = req.body || {}
      const lists = await getUserListChecklists(req.userId)
      const listTasks = await getUserListTasks(req.userId)
      let newTasks = listTasks
      if (deleteTasks === false) {
        if (transferToListId) {
          const target = lists.find(l => l.id === transferToListId)
          const targetGroupId = target && target.groups && target.groups.length > 0 ? target.groups[0].id : 'default'
          newTasks = listTasks.map(m => m.list_id === id ? { ...m, list_id: transferToListId, group_id: targetGroupId } : m)
        } else {
          newTasks = listTasks.filter(m => m.list_id !== id)
        }
      } else {
        newTasks = listTasks.filter(m => m.list_id !== id)
      }
      const newLists = lists.filter(l => l.id !== id)
      await setUserListChecklists(req.userId, newLists)
      await setUserListTasks(req.userId, newTasks)
      res.json({ success: true })
    } catch (e) { state.logger.error({ err: e }, "删除清单列表错误"); res.status(500).json({ error: '删除清单列表失败' }) }
  })

  /** PUT /api/list-lists/:listId/groups/reorder (auth) body:{orders:[{id,order}]} => 200 {groups} */
  app.put('/api/list-lists/:listId/groups/reorder', authMiddleware, async (req, res) => {
    try {
      const { listId } = req.params; const { orders } = req.body
      const lists = await getUserListChecklists(req.userId)
      const listIndex = lists.findIndex(l => l.id === listId)
      if (listIndex === -1) return res.status(404).json({ error: '清单列表不存在' })
      const list = lists[listIndex]
      list.groups = list.groups || []
      orders.forEach(({ id, order }) => { const i = list.groups.findIndex(g => g.id === id); if (i !== -1) list.groups[i].order = order })
      list.groups.sort((a, b) => a.order - b.order)
      await setUserListChecklists(req.userId, lists)
      res.json({ groups: list.groups })
    } catch (e) { state.logger.error({ err: e }, "重排序分组错误"); res.status(500).json({ error: '更新分组顺序失败' }) }
  })

  /** POST /api/list-lists/:listId/groups (auth) body:{name?,color?,order?} => 200 {group} */
  app.post('/api/list-lists/:listId/groups', authMiddleware, async (req, res) => {
    try {
      const { listId } = req.params; const { name, color, order } = req.body
      const lists = await getUserListChecklists(req.userId)
      const listIndex = lists.findIndex(l => l.id === listId)
      if (listIndex === -1) return res.status(404).json({ error: '清单列表不存在' })
      const list = lists[listIndex]; list.groups = list.groups || []
      const newGroup = { id: Date.now().toString(), name: name || '新分组', color: color || '#667eea', order: order !== undefined ? order : list.groups.length }
      list.groups.push(newGroup)
      await setUserListChecklists(req.userId, lists)
      res.json({ group: newGroup })
    } catch (e) { state.logger.error({ err: e }, "添加分组错误"); res.status(500).json({ error: '添加分组失败' }) }
  })

  /** PUT /api/list-lists/:listId/groups/:groupId (auth) body:{name?,color?,order?} => 200 {group} */
  app.put('/api/list-lists/:listId/groups/:groupId', authMiddleware, async (req, res) => {
    try {
      const { listId, groupId } = req.params; const { name, color, order } = req.body
      const lists = await getUserListChecklists(req.userId)
      const listIndex = lists.findIndex(l => l.id === listId)
      if (listIndex === -1) return res.status(404).json({ error: '清单列表不存在' })
      const list = lists[listIndex]; list.groups = list.groups || []
      let groupIndex = list.groups.findIndex(g => g.id === groupId)
      if (groupIndex === -1) {
        const newGroup = { id: groupId, name: name || '默认分组', color: color || '#667eea', order: order !== undefined ? order : list.groups.length }
        list.groups.push(newGroup)
        await setUserListChecklists(req.userId, lists)
        return res.json({ group: newGroup })
      }
      if (name !== undefined) list.groups[groupIndex].name = name
      if (color !== undefined) list.groups[groupIndex].color = color
      if (order !== undefined) list.groups[groupIndex].order = order
      await setUserListChecklists(req.userId, lists)
      res.json({ group: list.groups[groupIndex] })
    } catch (e) { state.logger.error({ err: e }, "更新分组错误"); res.status(500).json({ error: '更新分组失败' }) }
  })

  /** DELETE /api/list-lists/:listId/groups/:groupId (auth) body:{deleteTasks?:boolean} => 200 {success} (min 1 group enforced) */
  app.delete('/api/list-lists/:listId/groups/:groupId', authMiddleware, async (req, res) => {
    try {
      const { listId, groupId } = req.params
      const { deleteTasks } = req.body || {}
      const lists = await getUserListChecklists(req.userId)
      const listIndex = lists.findIndex(l => l.id === listId)
      if (listIndex === -1) return res.status(404).json({ error: '清单列表不存在' })
      const list = lists[listIndex]; list.groups = list.groups || []
      if (list.groups.length <= 1) return res.status(400).json({ error: '至少需要保留一个分组' })
      const groupIndex = list.groups.findIndex(g => g.id === groupId)
      if (groupIndex === -1) return res.status(404).json({ error: '分组不存在' })
      if (deleteTasks) {
        let listTasks = await getUserListTasks(req.userId)
        listTasks = listTasks.filter(m => !(m.list_id === listId && m.group_id === groupId))
        await setUserListTasks(req.userId, listTasks)
      } else {
        const defaultGroup = list.groups.find(g => g.id !== groupId)
        if (defaultGroup) {
          const listTasks = await getUserListTasks(req.userId)
          listTasks.forEach(m => { if (m.list_id === listId && m.group_id === groupId) m.group_id = defaultGroup.id })
          await setUserListTasks(req.userId, listTasks)
        }
      }
      list.groups.splice(groupIndex, 1)
      await setUserListChecklists(req.userId, lists)
      res.json({ success: true })
    } catch (e) { state.logger.error({ err: e }, "删除分组错误"); res.status(500).json({ error: '删除分组失败' }) }
  })

  // ============ List Tasks API ============

  /** GET /api/list-tasks (auth) ?listId=xxx => 200 {listTasks:ListTask[]} */
  app.get('/api/list-tasks', authMiddleware, async (req, res) => {
    try {
      const { listId } = req.query
      let listTasks = await getUserListTasks(req.userId)
      if (listId) listTasks = listTasks.filter(m => m.list_id === listId)
      res.json({ listTasks })
    } catch (e) { state.logger.error({ err: e }, "获取任务错误"); res.status(500).json({ error: '获取任务失败' }) }
  })

  /** POST /api/list-tasks (auth) body:{listId,name,targetCount?,...} => 200 {listTask} */
  app.post('/api/list-tasks', authMiddleware, async (req, res) => {
    try {
      const data = req.body
      const listTasks = await getUserListTasks(req.userId)
      const newTask = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6), list_id: data.listId, name: data.name, description: data.description || null, target_count: data.targetCount || 1, current_count: 0, completed: false, group_id: data.groupId || '', date: data.date || '', end_time: data.endTime || '', repeat_strategy: data.repeatStrategy || 'none', repeat_custom_days: data.repeatCustomDays || 1, repeat_weekdays: data.repeatWeekdays || [], repeat_month_day: data.repeatMonthDay || 1, repeat_lunar_month: data.repeatLunarMonth || 1, repeat_lunar_day: data.repeatLunarDay || 1, repeat_end_strategy: data.repeatEndStrategy || 'never', repeat_end_date: data.repeatEndDate || '', repeat_count: data.repeatCount || 1, repeat_completed_count: 0, priority: data.priority || 'none', checklist: data.checklist || [], linked_note_ids: data.linkedNoteIds || [], completed_start_time: '', completed_end_time: '', notes: data.notes || '', reminder_strategy: data.reminderStrategy || 'none', reminder_days: data.reminderDays || 0, reminder_hours: data.reminderHours || 0, reminder_minutes: data.reminderMinutes || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      listTasks.push(newTask)
      await setUserListTasks(req.userId, listTasks)
      res.json({ listTask: newTask })
    } catch (e) { state.logger.error({ err: e }, "添加任务错误"); res.status(500).json({ error: '添加任务失败' }) }
  })

  /** PUT /api/list-tasks/:id (auth) body:{...listTask fields} => 200 {listTask} */
  app.put('/api/list-tasks/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params; const updates = req.body
      const listTasks = await getUserListTasks(req.userId)
      const taskIndex = listTasks.findIndex(m => m.id === id)
      if (taskIndex === -1) return res.status(404).json({ error: '任务不存在' })
      const listTask = listTasks[taskIndex]
      if (updates.name !== undefined) listTask.name = updates.name
      if (updates.description !== undefined) listTask.description = updates.description
      if (updates.targetCount !== undefined) listTask.target_count = updates.targetCount
      if (updates.currentCount !== undefined) listTask.current_count = updates.currentCount
      if (updates.completed !== undefined) listTask.completed = updates.completed
      if (updates.groupId !== undefined) listTask.group_id = updates.groupId
      if (updates.date !== undefined) listTask.date = updates.date
      if (updates.endTime !== undefined) listTask.end_time = updates.endTime
      if (updates.repeatStrategy !== undefined) listTask.repeat_strategy = updates.repeatStrategy
      if (updates.repeatCustomDays !== undefined) listTask.repeat_custom_days = updates.repeatCustomDays
      if (updates.repeatWeekdays !== undefined) listTask.repeat_weekdays = updates.repeatWeekdays
      if (updates.repeatMonthDay !== undefined) listTask.repeat_month_day = updates.repeatMonthDay
      if (updates.repeatLunarMonth !== undefined) listTask.repeat_lunar_month = updates.repeatLunarMonth
      if (updates.repeatLunarDay !== undefined) listTask.repeat_lunar_day = updates.repeatLunarDay
      if (updates.repeatEndStrategy !== undefined) listTask.repeat_end_strategy = updates.repeatEndStrategy
      if (updates.repeatEndDate !== undefined) listTask.repeat_end_date = updates.repeatEndDate
      if (updates.repeatCount !== undefined) listTask.repeat_count = updates.repeatCount
      if (updates.repeatCompletedCount !== undefined) listTask.repeat_completed_count = updates.repeatCompletedCount
      if (updates.priority !== undefined) listTask.priority = updates.priority
      if (updates.checklist !== undefined) listTask.checklist = updates.checklist
      if (updates.linkedNoteIds !== undefined) listTask.linked_note_ids = updates.linkedNoteIds
      if (updates.completedStartTime !== undefined) listTask.completed_start_time = updates.completedStartTime
      if (updates.completedEndTime !== undefined) listTask.completed_end_time = updates.completedEndTime
      if (updates.notes !== undefined) listTask.notes = updates.notes
      if (updates.reminderStrategy !== undefined) listTask.reminder_strategy = updates.reminderStrategy
      if (updates.reminderDays !== undefined) listTask.reminder_days = updates.reminderDays
      if (updates.reminderHours !== undefined) listTask.reminder_hours = updates.reminderHours
      if (updates.reminderMinutes !== undefined) listTask.reminder_minutes = updates.reminderMinutes
      listTask.updated_at = new Date().toISOString()
      await setUserListTasks(req.userId, listTasks)
      res.json({ listTask })
    } catch (e) { state.logger.error({ err: e }, "更新任务错误"); res.status(500).json({ error: '更新任务失败' }) }
  })

  /** DELETE /api/list-tasks/:id (auth) => 200 {success:true} */
  app.delete('/api/list-tasks/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params
      const listTasks = await getUserListTasks(req.userId)
      await setUserListTasks(req.userId, listTasks.filter(m => m.id !== id))
      res.json({ success: true })
    } catch (e) { state.logger.error({ err: e }, "删除任务错误"); res.status(500).json({ error: '删除任务失败' }) }
  })

  // ============ Stats API ============

  /** GET /api/stats (auth) => 200 {stats:{checklistCount,listTaskCount,footprintTaskCount}} */
  app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
      const checklists = await getUserListChecklists(req.userId)
      const listTasks = await getUserListTasks(req.userId)
      const footprintTasks = await getUserFootprintTasks(req.userId)
      res.json({ stats: { checklistCount: checklists.length, listTaskCount: listTasks.length, footprintTaskCount: footprintTasks.length } })
    } catch (e) { state.logger.error({ err: e }, "获取统计错误"); res.status(500).json({ error: '获取统计失败' }) }
  })

  // ============ Data API (type/key based) ============

  /** GET /api/data/:type/:key (auth) => 200 {success:true, data:any} */
  app.get('/api/data/:type/:key', authMiddleware, async (req, res) => {
    try {
      let data = await getUserKV(req.userId, req.params.type, req.params.key)
      if (req.params.type === 'system' && req.params.key === 'state') {
        // 迁移旧的 defaultsInitialized.json 到 state.json
        const legacyDefaultsPath = path.join(DATA_DIR, req.userId, 'system', 'defaultsInitialized.json')
        const legacyDefaults = readJson(legacyDefaultsPath)
        if (legacyDefaults === true) {
          if (!data) data = {}
          data.defaultsInitialized = true
          await setUserKV(req.userId, 'system', 'state', data)
          try { fs.unlinkSync(legacyDefaultsPath) } catch {}
          state.logger.info({ userId: req.userId }, '[数据] defaultsInitialized 从 defaultsInitialized.json 迁移到 state.json')
        }
        if (!data || data.guideCompleted === undefined) {
          const legacyPath = path.join(DATA_DIR, req.userId, 'system', 'guideState.json')
          const legacy = readJson(legacyPath)
          if (legacy && legacy.guideCompleted !== undefined) {
            if (!data) data = {}
            data.guideCompleted = legacy.guideCompleted
            await setUserKV(req.userId, 'system', 'state', data)
            try { fs.unlinkSync(legacyPath) } catch {}
            state.logger.info({ userId: req.userId }, '[数据] 引导状态从 guideState.json 迁移到 state.json')
          }
        }
      }
      res.json({ success: true, data: data || null })
    }
    catch (e) { state.logger.error({ err: e }, "Get data error:"); res.status(500).json({ success: false, error: '获取数据失败' }) }
  })

  /** POST /api/data/:type/:key (auth) body:{data} => 200 {success:true} */
  app.post('/api/data/:type/:key', authMiddleware, async (req, res) => {
    try { await setUserKV(req.userId, req.params.type, req.params.key, req.body.data); res.json({ success: true }) }
    catch (e) { state.logger.error({ err: e }, "Set data error:"); res.status(500).json({ success: false, error: '设置数据失败' }) }
  })

  /** DELETE /api/data/:type/:key (auth) => 200 {success:true} */
  app.delete('/api/data/:type/:key', authMiddleware, async (req, res) => {
    try { await deleteUserKV(req.userId, req.params.type, req.params.key); res.json({ success: true }) }
    catch (e) { state.logger.error({ err: e }, "Delete data error:"); res.status(500).json({ success: false, error: '删除数据失败' }) }
  })

  // ============ Notes API ============
  // 笔记改用单条记录级读写，避免「整份数组读-改-写」造成的并发覆盖
  // （捕获窗口与主窗口同时写时，后写者会把先写者的新增/修改整份抹掉）

  const NOTES_TABLE = 'notes'

  function normalizeNote(raw) {
    const now = new Date().toISOString()
    const r = raw || {}
    return {
      id: r.id ? String(r.id) : Date.now().toString() + Math.random().toString(36).slice(2, 8),
      title: r.title !== undefined ? String(r.title) : '新笔记',
      content: r.content !== undefined ? String(r.content) : '',
      tagIds: Array.isArray(r.tagIds) ? r.tagIds.map(String) : [],
      pinned: !!r.pinned,
      trashedAt: r.trashedAt || null,
      createdAt: r.createdAt || now,
      updatedAt: r.updatedAt || now
    }
  }

  /** GET /api/notes (auth) => 200 {success, notes:[...]} */
  app.get('/api/notes', authMiddleware, async (req, res) => {
    try {
      const notes = await storage.listRecords(NOTES_TABLE, req.userId)
      res.json({ success: true, notes })
    } catch (e) {
      state.logger.error({ err: e }, '获取笔记失败')
      res.status(500).json({ success: false, error: '获取笔记失败' })
    }
  })

  /** POST /api/notes (auth) body:{title,content,tagIds,pinned} => 200 {success, note} */
  app.post('/api/notes', authMiddleware, async (req, res) => {
    try {
      const note = normalizeNote(req.body)
      const saved = await storage.appendRecord(NOTES_TABLE, req.userId, note)
      state.logger.info({ userId: req.userId, id: saved.id }, '[笔记] 新增笔记')
      res.json({ success: true, note: saved })
    } catch (e) {
      state.logger.error({ err: e }, '新增笔记失败')
      res.status(500).json({ success: false, error: '新增笔记失败' })
    }
  })

  /** PATCH /api/notes/:id (auth) body:{部分字段} => 200 {success, note} */
  app.patch('/api/notes/:id', authMiddleware, async (req, res) => {
    try {
      const existing = await storage.getRecord(NOTES_TABLE, req.userId, req.params.id)
      if (!existing) return res.status(404).json({ success: false, error: '笔记不存在' })
      const merged = {
        ...existing,
        ...req.body,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      }
      if (Array.isArray(merged.tagIds)) merged.tagIds = merged.tagIds.map(String)
      const saved = await storage.upsertRecord(NOTES_TABLE, req.userId, existing.id, merged)
      res.json({ success: true, note: saved })
    } catch (e) {
      state.logger.error({ err: e }, '更新笔记失败')
      res.status(500).json({ success: false, error: '更新笔记失败' })
    }
  })

  /** DELETE /api/notes/:id (auth) => 200 {success} */
  app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
    try {
      const ok = await storage.deleteRecord(NOTES_TABLE, req.userId, req.params.id)
      res.json({ success: ok })
    } catch (e) {
      state.logger.error({ err: e }, '删除笔记失败')
      res.status(500).json({ success: false, error: '删除笔记失败' })
    }
  })

  // ============ Settings API ============

  /** GET /api/settings (auth) => 200 {settings:{...}} */
  app.get('/api/settings', authMiddleware, async (req, res) => {
    try { const settings = await getUserSettings(req.userId); res.json({ settings }) }
    catch (e) { state.logger.error({ err: e }, "Get settings error:"); res.status(500).json({ error: '获取设置失败' }) }
  })


  /** PUT /api/settings (auth) body:{...} => 200 {settings} */
  app.put('/api/settings', authMiddleware, async (req, res) => {
    try {
      const existingSettings = await getUserSettings(req.userId)
      const mergedSettings = { ...existingSettings, ...req.body }
      await setUserSettings(req.userId, mergedSettings)
      res.json({ settings: mergedSettings })
    } catch (e) { state.logger.error({ err: e }, "更新设置错误"); res.status(500).json({ error: '更新设置失败' }) }
  })

  // ============ Export/Import API ============

  /** GET /api/export (auth) => 200 {所有模块数据} - 导出当前用户所有模块数据 */
  app.get('/api/export', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId
      const userEmail = req.userEmail
      const userIndex = await getUserIndexByEmail(userEmail)
      const data = {
        // 仅导出账号标识，不把密码哈希带出服务端。
        user_index: userIndex ? { id: userIndex.id, email: userIndex.email, nickname: userIndex.nickname, createdAt: userIndex.createdAt } : null,
        // 足迹
        tasks: await getUserFootprintTasks(userId),
        // 专注
        focus_favorites: await getUserKV(userId, 'focus', 'favorites'),
        focus_records: await getUserKV(userId, 'focus', 'records'),
        // 清单
        lists: await getUserListChecklists(userId),
        listTasks: await getUserListTasks(userId),
        // 倒数日
        countdown_categories: await getUserKV(userId, 'countdown', 'categories'),
        countdowns: await getUserKV(userId, 'countdown', 'countdowns'),
        // 课程表
        courses: await getUserKV(userId, 'course', 'courses'),
        // 我的
        profile: await getUserProfile(userId),
        settings: await getUserSettings(userId),
        system_state: await getUserKV(userId, 'system', 'state'),
        system_reminders: await getUserKV(userId, 'system', 'reminders'),
        // 笔记（记录级表 + 标签）：应用级备份必须包含，否则用户笔记无法整体迁移
        notes: await storage.listRecords(NOTES_TABLE, userId),
        note_tags: await getUserKV(userId, 'notes', 'tags'),
        exportTime: new Date().toISOString()
      }
      res.json({ success: true, data })
    } catch (e) {
      state.logger.error({ err: e }, "导出错误")
      res.status(500).json({ error: '导出数据失败' })
    }
  })

  /** POST /api/import (auth) body:{各模块数据} => 200 {success} - 导入到当前账号 */
  app.post('/api/import', authMiddleware, async (req, res) => {
    try {
      const { tasks, focus_favorites, focus_records, lists, listTasks, countdown_categories, countdowns, courses, course_recorded_courses, profile, settings, system_state, system_reminders, notes, note_tags } = req.body
      const userId = req.userId

      if (tasks) await setUserFootprintTasks(userId, tasks)
      if (focus_favorites !== undefined) await setUserKV(userId, 'focus', 'favorites', focus_favorites)
      if (focus_records !== undefined) await setUserKV(userId, 'focus', 'records', focus_records)
      if (lists) await setUserListChecklists(userId, lists)
      if (listTasks) await setUserListTasks(userId, listTasks)
      if (countdown_categories !== undefined) await setUserKV(userId, 'countdown', 'categories', countdown_categories)
      if (countdowns !== undefined) await setUserKV(userId, 'countdown', 'countdowns', countdowns)
      if (courses !== undefined) await setUserKV(userId, 'course', 'courses', courses)
      if (profile) await setUserProfile(userId, profile)
      if (settings) await setUserSettings(userId, settings)
      if (system_state !== undefined) await setUserKV(userId, 'system', 'state', system_state)
      if (system_reminders !== undefined) await setUserKV(userId, 'system', 'reminders', system_reminders)
      // 笔记恢复：与其他模块一致的覆盖语义（先清空记录表再逐条追加，走记录级写入）
      if (note_tags !== undefined) await setUserKV(userId, 'notes', 'tags', note_tags)
      if (Array.isArray(notes)) {
        await deleteUserKV(userId, 'notes', 'notes')
        for (const note of notes) {
          await storage.appendRecord(NOTES_TABLE, userId, note)
        }
        state.logger.info({ userId, count: notes.length }, '[导入] 笔记已恢复')
      }

      state.logger.info({ userId }, '[导入] 数据已导入')
      res.json({ success: true })
    } catch (e) {
      state.logger.error({ err: e }, "导入错误")
      res.status(500).json({ error: '导入数据失败' })
    }
  })

  /** POST /api/clean body:{各模块null值} => 200 {success} - 清理指定模块数据（不删除账号信息） */
  app.post('/api/clean', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId
      if (!userId) return res.status(401).json({ error: '请先登录' })

      const cleanMap = req.body
      const PROTECTED_KEYS = ['user_index', 'email', 'profile']

      for (const key of Object.keys(cleanMap)) {
        if (PROTECTED_KEYS.includes(key)) continue
        if (key === 'lists') await setUserListChecklists(userId, [])
        else if (key === 'listTasks') await setUserListTasks(userId, [])
        else if (key === 'tasks') await setUserFootprintTasks(userId, [])
        else if (key === 'focus_favorites') await setUserKV(userId, 'focus', 'favorites', [])
        else if (key === 'focus_records') await setUserKV(userId, 'focus', 'records', [])
        else if (key === 'countdown_categories') await setUserKV(userId, 'countdown', 'categories', [])
        else if (key === 'countdowns') await setUserKV(userId, 'countdown', 'countdowns', [])
        else if (key === 'courses') await setUserKV(userId, 'course', 'courses', [])
        else if (key === 'settings') await setUserKV(userId, 'settings', 'settings', null)
        else if (key === 'system_state') await setUserKV(userId, 'system', 'state', null)
        else if (key === 'profile') continue
      }

      state.logger.info({ userId, modules: Object.keys(cleanMap) }, '[清理] 数据已清理')
      res.json({ success: true })
    } catch (e) {
      state.logger.error({ err: e }, "清理数据错误")
      res.status(500).json({ error: '清理数据失败' })
    }
  })

  // ============ Health Check ============

  /** GET /api/health => 200 {status:"ok",storage} */
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', storage: 'yaml' })
  })

  // ============ Version ============

  /** GET /api/version => 200 {version,date} */
  app.get('/api/version', (req, res) => {
    try {
      const pkgPath = path.join(resourcesPath, 'package.json')
      if (!fs.existsSync(pkgPath)) {
        res.status(404).json({ error: 'package.json not found' })
        return
      }
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      res.json({ version: pkg.version || '0.0.0' })
    } catch (e) { res.status(500).json({ error: 'Failed to read package.json' }) }
  })

  // 服务端独立运行，使用本地 YAML 文件存储。
  await initStorage()

  return { app, server, storage }
}

module.exports = { createProdServer }
