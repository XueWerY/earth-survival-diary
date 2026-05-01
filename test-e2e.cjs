const http = require('http')
const fs = require('fs')
const path = require('path')

const TEST_DIR = path.join(__dirname, 'test-data')
if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true })

const { createProdServer } = require('./electron/prod-server.cjs')
const { server } = createProdServer({
  port: 55123,
  dataDir: TEST_DIR,
  resourcesPath: __dirname
})

server.listen(55123)
const BASE = 'http://localhost:55123/api'

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url.startsWith('http') ? url : BASE + url)
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      headers: { 'Content-Type': 'application/json' }
    }
    if (token) opts.headers['Authorization'] = `Bearer ${token}`
    const req = http.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { data = JSON.parse(data) } catch {}
        resolve({ status: res.statusCode, data })
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function run() {
  let passed = 0, failed = 0
  function assert(cond, msg) {
    if (cond) { passed++; console.log(`  PASS: ${msg}`) }
    else { failed++; console.error(`  FAIL: ${msg}`) }
  }

  try {
    // 1. Signup
    const s = await request('POST', '/auth/signup', { email: 'test@test.com', password: '123456', nickname: 'Tester' })
    assert(s.status === 200 && s.data.user && s.data.session.access_token, 'Signup returns 200 with token')
    const token = s.data.session.access_token
    const userId = s.data.user.id

    // 2. User index
    assert(fs.existsSync(path.join(TEST_DIR, 'users', 'test@test.com.json')), 'users/test@test.com.json exists')

    // 3. Profile
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'profile', 'profile.json')), 'profile/profile.json exists')

    // 4. Session
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'session', 'session.json')), 'session/session.json exists')

    // 5. Profile update
    const p = await request('PUT', '/profile', { nickname: 'Updated' }, token)
    assert(p.status === 200, 'Profile update returns 200')
    assert(JSON.parse(fs.readFileSync(path.join(TEST_DIR, userId, 'profile', 'profile.json'), 'utf-8')).nickname === 'Updated', 'Profile nickname saved')

    // 6. Tasks → footprint/footprint.json
    const t = await request('POST', '/tasks', { name: 'Test task', date: '2025-01-01' }, token)
    assert(t.status === 200, 'Tasks POST returns 200')
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'footprint', 'footprint.json')), 'footprint/footprint.json exists')

    // 7. Mission lists → list/lists.json
    const ml = await request('POST', '/mission-lists', { name: 'Test List' }, token)
    assert(ml.status === 200, 'Mission lists POST returns 200')
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'list', 'lists.json')), 'list/lists.json exists')

    // 8. Settings
    await request('PUT', '/settings', { soundEnabled: false }, token)
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'settings', 'settings.json')), 'settings/settings.json exists')

    // 9. KV: course/courses
    await request('POST', '/data/course/courses', { data: [{ name: 'Math' }] }, token)
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'course', 'courses.json')), 'course/courses.json exists')

    // 10. KV: course/recorded-courses
    await request('POST', '/data/course/recorded-courses', { data: [{ course: 'Math', week: 1 }] }, token)
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'course', 'recorded-courses.json')), 'course/recorded-courses.json exists')

    // 11. KV: focus/favorites
    await request('POST', '/data/focus/favorites', { data: [{ name: 'Coding' }] }, token)
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'focus', 'favorites.json')), 'focus/favorites.json exists')

    // 12. KV: focus/records
    await request('POST', '/data/focus/records', { data: [{ duration: 1800 }] }, token)
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'focus', 'records.json')), 'focus/records.json exists')

    // 13. KV: countdown/countdowns
    await request('POST', '/data/countdown/countdowns', { data: [{ name: 'Birthday' }] }, token)
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'countdown', 'countdowns.json')), 'countdown/countdowns.json exists')

    // 14. KV: countdown/categories
    await request('POST', '/data/countdown/categories', { data: [{ label: 'Holiday' }] }, token)
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'countdown', 'categories.json')), 'countdown/categories.json exists')

    // 15. KV: system/state
    await request('POST', '/data/system/state', { data: { currentPage: 'footprint' } }, token)
    assert(fs.existsSync(path.join(TEST_DIR, userId, 'system', 'state.json')), 'system/state.json exists')

    // 16. KV read-back
    const r = await request('GET', '/data/system/state', null, token)
    assert(r.status === 200 && r.data.data.currentPage === 'footprint', 'KV read system/state returns currentPage=footprint')

    // 17. No kv/ directory, no old dirs
    const userDir = path.join(TEST_DIR, userId)
    const entries = fs.readdirSync(userDir)
    const expected = ['profile', 'session', 'footprint', 'list', 'settings', 'course', 'focus', 'countdown', 'system']
    const forbidden = ['kv', 'tasks', 'mission_lists', 'missions']
    const extra = entries.filter(e => !expected.includes(e))
    const hasForbidden = entries.filter(e => forbidden.includes(e))
    assert(extra.length === 0, `No unexpected dirs. Found: ${JSON.stringify(entries)}`)
    assert(hasForbidden.length === 0, `No old dirs (kv/tasks/mission_lists/missions). Found: ${JSON.stringify(hasForbidden)}`)

    // ===== Garbage token tests =====

    const garbageToken = Buffer.from('fakeuser:0:x').toString('base64')
    const garbageDir = path.join(TEST_DIR, 'fakeuser')

    const r1 = await request('GET', '/profile', null, garbageToken)
    assert(r1.status === 401, 'Garbage token on /profile returns 401')
    assert(!fs.existsSync(garbageDir), 'No fakeuser/ directory created by authMiddleware')

    const r2 = await request('POST', '/auth/check-session', null, garbageToken)
    assert(r2.data.valid === false, 'check-session returns valid=false for garbage token')

    const r3 = await request('POST', '/auth/signout', null, garbageToken)
    assert(r3.data.success === true, 'signout returns success for garbage token')
    assert(!fs.existsSync(garbageDir), 'No fakeuser/ directory created by signout')

  } catch (e) {
    console.error('Test error:', e)
    failed++
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  server.close()
  fs.rmSync(TEST_DIR, { recursive: true, force: true })
  process.exit(failed ? 1 : 0)
}

setTimeout(run, 500)
