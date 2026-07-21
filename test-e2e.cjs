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

  console.log('\n-- Signup --')
  let r = await post('/auth/signup', { email: 'test@test.com', password: '123456' })
  assert('Signup success', r.status === 200 && r.data.user && r.data.session)
  token = r.data.session.access_token
  userId = r.data.user.id

  r = await post('/auth/signup', { email: 'test@test.com', password: '123456' })
  assert('Duplicate signup fails', r.status === 400)

  console.log('\n-- Login --')
  r = await post('/auth/signin', { email: 'test@test.com', password: '123456' })
  assert('Login success', r.status === 200 && r.data.session)
  token = r.data.session.access_token

  r = await post('/auth/signin', { email: 'test@test.com', password: 'wrong' })
  assert('Wrong password', r.status === 400)

  console.log('\n-- Profile --')
  r = await get('/profile')
  assert('Get profile', r.status === 200 && r.data.profile && r.data.profile.id === userId)

  console.log('\n-- Footprint --')
  r = await post('/tasks', { name: 'Test Footprint', date: '2026-05-01', startTime: '09:00', endTime: '10:00', notes: 'Note' })
  assert('Add footprint', r.status === 200 && r.data.task)
  const fpId = r.data.task.id

  r = await get('/tasks')
  assert('Get footprint list', r.status === 200 && r.data.tasks && r.data.tasks.length >= 1)

  console.log('\n-- Lists --')
  r = await post('/list-lists', { name: 'Test List' })
  assert('Add list', r.status === 200 && r.data.list)
  const listId = r.data.list.id

  r = await post('/list-tasks', { listId, name: 'Test Task' })
  assert('Add task', r.status === 200 && r.data.listTask)

  console.log('\n-- General Data --')
  r = await post('/data/course/courses', { data: { semesterStart: '2026-02-15' } })
  assert('Save course', r.status === 200)

  r = await get('/data/course/courses')
  assert('Get course', r.status === 200)

  r = await post('/data/countdown/countdowns', { data: { event: 'Birthday' } })
  assert('Save countdown', r.status === 200)

  r = await post('/data/focus/favorites', { data: { name: 'Reading' } })
  assert('Save focus', r.status === 200)

  r = await post('/data/system/state', { data: { lastActive: '2026-05-01' } })
  assert('Save system state', r.status === 200)

  console.log('\n-- Bogus Token --')
  const bogusRes = await fetch(API_BASE + '/profile', {
    headers: { 'authorization': 'Bearer invalid-token-value' },
    signal: AbortSignal.timeout(5000)
  })
  assert('Bogus token rejected', bogusRes.status === 401)

  console.log('\n-- File Verification --')
  const dir = tmpDataDir

  assert('users.json exists', fs.existsSync(path.join(dir, 'users', 'test@test.com.json')))
  assert('footprint.json exists', fs.existsSync(path.join(dir, userId, 'footprint', 'footprint.json')))
  assert('lists.json exists', fs.existsSync(path.join(dir, userId, 'list', 'lists.json')))
  assert('tasks.json exists', fs.existsSync(path.join(dir, userId, 'list', 'tasks.json')))
  assert('course.json exists', fs.existsSync(path.join(dir, userId, 'course', 'courses.json')))
  assert('countdown.json exists', fs.existsSync(path.join(dir, userId, 'countdown', 'countdowns.json')))
  assert('focus.json exists', fs.existsSync(path.join(dir, userId, 'focus', 'favorites.json')))
  assert('system.json exists', fs.existsSync(path.join(dir, userId, 'system', 'state.json')))

  console.log('\n' + '='.repeat(40))
  console.log('Total: ' + total + ' | Passed: ' + passed + ' | ' + (passed === total ? '✅ All passed' : '❌ Some failed'))
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
