const fs = require('fs')
const path = require('path')

const PORT = 3003
const API_BASE = 'http://127.0.0.1:' + PORT + '/api'
const TMP = path.join(__dirname, 'temp-test-data')

let server
let total = 0
let passed = 0
let token = ''
let userId = ''

function assert(label, ok) {
  total++
  if (ok) { passed++; console.log('  PASS ' + label); return }
  console.error('  FAIL ' + label); process.exitCode = 1
}

async function post(p, body = {}) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h['authorization'] = 'Bearer ' + token
  const res = await fetch(API_BASE + p, { method: 'POST', headers: h, body: JSON.stringify(body) })
  const data = await res.json()
  return { status: res.status, data }
}

async function get(p) {
  const h = {}
  if (token) h['authorization'] = 'Bearer ' + token
  const res = await fetch(API_BASE + p, { headers: h, signal: AbortSignal.timeout(5000) })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch (e) { data = text }
  return { status: res.status, data }
}

async function run() {
  const { createProdServer } = require('./electron/prod-server.cjs')
  const tmpDataDir = path.join(TMP, 'data')
  fs.mkdirSync(tmpDataDir, { recursive: true })
  const { server: srv } = createProdServer({
    port: PORT,
    dataDir: tmpDataDir,
    distPath: path.join(__dirname, 'dist'),
    resourcesPath: path.join(__dirname, 'electron')
  })

  server = srv
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })
  console.log('Server started on port ' + PORT)

  console.log('\n-- 注册 --')
  let r = await post('/auth/signup', { email: 'test@test.com', password: '123456' })
  assert('注册成功', r.status === 200 && r.data.user && r.data.session)
  token = r.data.session.access_token
  userId = r.data.user.id

  r = await post('/auth/signup', { email: 'test@test.com', password: '123456' })
  assert('重复注册失败', r.status === 400)

  console.log('\n-- 登录 --')
  r = await post('/auth/signin', { email: 'test@test.com', password: '123456' })
  assert('登录成功', r.status === 200 && r.data.session)
  token = r.data.session.access_token

  r = await post('/auth/signin', { email: 'test@test.com', password: 'wrong' })
  assert('密码错误', r.status === 400)

  console.log('\n-- 资料 --')
  r = await get('/profile')
  assert('获取资料', r.status === 200 && r.data.profile && r.data.profile.id === userId)

  console.log('\n-- 足迹 --')
  r = await post('/tasks', { name: '测试足迹', date: '2026-05-01', startTime: '09:00', endTime: '10:00', notes: '备注' })
  assert('添加足迹', r.status === 200 && r.data.task)
  const fpId = r.data.task.id

  r = await get('/tasks')
  assert('获取足迹列表', r.status === 200 && r.data.tasks && r.data.tasks.length >= 1)

  console.log('\n-- 清单 --')
  r = await post('/mission-lists', { name: '测试清单' })
  assert('添加清单', r.status === 200 && r.data.list)
  const listId = r.data.list.id

  r = await post('/missions', { listId, name: '测试任务' })
  assert('添加任务', r.status === 200 && r.data.mission)

  console.log('\n-- 通用数据 --')
  r = await post('/data/course/courses', { data: { semesterStart: '2026-02-15' } })
  assert('保存课程', r.status === 200)

  r = await get('/data/course/courses')
  assert('获取课程', r.status === 200)

  r = await post('/data/countdown/countdowns', { data: { event: '生日' } })
  assert('保存倒数日', r.status === 200)

  r = await post('/data/focus/favorites', { data: { name: '阅读' } })
  assert('保存专注', r.status === 200)

  r = await post('/data/system/state', { data: { lastActive: '2026-05-01' } })
  assert('保存系统状态', r.status === 200)

  console.log('\n-- 垃圾 token --')
  const bogusRes = await fetch(API_BASE + '/profile', {
    headers: { 'authorization': 'Bearer invalid-token-value' },
    signal: AbortSignal.timeout(5000)
  })
  assert('垃圾 token 被拒绝', bogusRes.status === 401)

  console.log('\n-- 文件验证 --')
  const dir = tmpDataDir

  assert('users.json 存在', fs.existsSync(path.join(dir, 'users', 'test@test.com.json')))
  assert('footprint.json 存在', fs.existsSync(path.join(dir, userId, 'footprint', 'footprint.json')))
  assert('lists.json 存在', fs.existsSync(path.join(dir, userId, 'list', 'lists.json')))
  assert('tasks.json 存在', fs.existsSync(path.join(dir, userId, 'list', 'tasks.json')))
  assert('course.json 存在', fs.existsSync(path.join(dir, userId, 'course', 'courses.json')))
  assert('countdown.json 存在', fs.existsSync(path.join(dir, userId, 'countdown', 'countdowns.json')))
  assert('focus.json 存在', fs.existsSync(path.join(dir, userId, 'focus', 'favorites.json')))
  assert('system.json 存在', fs.existsSync(path.join(dir, userId, 'system', 'state.json')))

  console.log('\n' + '='.repeat(40))
  console.log('总计: ' + total + ' | 通过: ' + passed + ' | ' + (passed === total ? '✅ 全部通过' : '❌ 存在失败'))
  console.log('='.repeat(40))
}

run().catch(e => {
  console.error('Test failed: ' + e.message)
  process.exitCode = 1
}).finally(() => {
  if (server) server.close()
  setTimeout(() => {
    try { fs.rmSync(TMP, { recursive: true, force: true }) } catch (e) {}
  }, 500)
})
