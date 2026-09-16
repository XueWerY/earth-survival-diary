const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')

// ========== install-deps ==========
function installDeps() {
  const ELECTRON_DIR = path.join(ROOT, 'electron')
  const ELECTRON_DEPS_OK = path.join(ELECTRON_DIR, '.deps-ok')
  const REQUIRED = ['express', '@vue/compiler-sfc', 'esbuild']
  const depsReady = fs.existsSync(ELECTRON_DEPS_OK) && REQUIRED.every(d => fs.existsSync(path.join(ELECTRON_DIR, 'node_modules', d)))
  if (depsReady) { console.log('Electron deps already installed.'); return }
  console.log('Installing electron main process dependencies...')
  execSync('npm install --no-package-lock --no-audit --no-fund', { cwd: ELECTRON_DIR, stdio: 'inherit' })
  fs.writeFileSync(ELECTRON_DEPS_OK, '')
  console.log('Electron deps installed.')
}

// ========== make-ico ==========
async function makeIco() {
  const sharp = require('sharp')
  const SOURCE = path.join(ROOT, 'build', 'app-icon.png')
  const OUTPUT = path.join(ROOT, 'build', 'icon.ico')
  const SIZES = [16, 24, 32, 48, 64, 128, 256]
  const pngs = await Promise.all(SIZES.map(size => sharp(SOURCE).resize(size, size).png().toBuffer()))
  const header = Buffer.alloc(6 + 16 * SIZES.length)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(SIZES.length, 4)
  let offset = header.length
  for (let i = 0; i < SIZES.length; i++) {
    const size = SIZES[i], buf = pngs[i], entry = i * 16 + 6, w = size >= 256 ? 0 : size
    header.writeUInt8(w, entry); header.writeUInt8(w, entry + 1); header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3); header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(buf.length, entry + 8); header.writeUInt32LE(offset, entry + 12)
    offset += buf.length
  }
  fs.writeFileSync(OUTPUT, Buffer.concat([header, ...pngs]))
  console.log(`icon.ico created (${SIZES.length} sizes)`)
}

// ========== cleanup-release ==========
function cleanupRelease() {
  if (!fs.existsSync(RELEASE_DIR)) return
  for (const f of fs.readdirSync(RELEASE_DIR)) {
    const p = path.join(RELEASE_DIR, f), s = fs.statSync(p)
    if (s.isFile()) {
      // 保留 .exe / .blockmap / .yml（electron-updater 所需），删其他
      if (!f.endsWith('.exe') && !f.endsWith('.blockmap') && !f.endsWith('.yml') && !f.endsWith('.yaml')) fs.rmSync(p)
    }
    if (s.isDirectory() && (f.startsWith('.') || f === 'win-unpacked')) fs.rmSync(p, { recursive: true })
  }
}

// ========== pre-clean-release ==========
function preCleanRelease() {
  if (!fs.existsSync(RELEASE_DIR)) return
  for (const f of fs.readdirSync(RELEASE_DIR)) {
    const p = path.join(RELEASE_DIR, f), s = fs.statSync(p)
    if (s.isDirectory()) fs.rmSync(p, { recursive: true })
    else fs.rmSync(p)
  }
  console.log('release/ directory cleared')
}

// ========== publish-release ==========
// 用 GH_TOKEN（或 GITHUB_TOKEN）把 release/ 目录产物发布为 GitHub Release：
//   1. 自动合并同版本的重复 draft（electron-builder 并发上传竞态产生的拆家 release）；
//   2. 上传本地缺失的资产（Setup exe、blockmap、latest.yml）；
//   3. 发布 Release（draft:false），成为 Latest。
function publishRelease() {
  const https = require('https')
  return (async () => {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
    if (!token) {
      console.error('缺少 GitHub Token：请设置环境变量 GH_TOKEN（或 GITHUB_TOKEN）后重试')
      process.exit(1)
    }
    const pkg = require(path.join(ROOT, 'package.json'))
    const version = pkg.version
    const repo = pkg.repository
    if (typeof repo !== 'string') { console.error('package.json 缺少 repository 字段（owner/repo）'); process.exit(1) }
    const tag = 'v' + version

    const api = (method, urlPath, { body, headers = {}, isBinary = false } = {}) => new Promise((resolve, reject) => {
      // 支持完整 URL（如 GitHub uploads 域名）或相对路径（api.github.com）
      const url = /^https?:/.test(urlPath) ? new URL(urlPath) : new URL('https://api.github.com' + urlPath)
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': 'token ' + token,
          'User-Agent': 'earth-survival-diary-build',
          'Accept': 'application/vnd.github+json',
          'Content-Type': isBinary ? 'application/octet-stream' : 'application/json',
          ...headers
        }
      }, (res) => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(text ? JSON.parse(text) : null)
          } else {
            reject(new Error(`GitHub API ${method} ${urlPath} -> ${res.statusCode}: ${text.slice(0, 300)}`))
          }
        })
      })
      req.on('error', reject)
      if (body) req.write(isBinary ? body : JSON.stringify(body))
      req.end()
    })

    // 1) 列出全部 releases，找到与 tag/version 匹配的条目
    console.log('查询仓库 Releases：' + repo)
    const allReleases = []
    let page = 1
    for (;;) {
      const batch = await api('GET', `/repos/${repo}/releases?per_page=100&page=${page}`)
      allReleases.push(...batch)
      if (batch.length < 100) break
      page++
    }
    const matches = allReleases.filter(r => r.tag_name === tag || r.tag_name === version || r.name === version)
    console.log('匹配到的 Release 数：' + matches.length)

    // 2) 保留资产最多的一个，删除其余重复 draft
    let main = null
    for (const m of matches) {
      if (!main || (m.assets || []).length > (main.assets || []).length) main = m
    }
    for (const m of matches) {
      if (main && m.id === main.id) continue
      console.log('删除重复 Release #' + m.id + '（assets: ' + (m.assets || []).length + '）')
      await api('DELETE', `/repos/${repo}/releases/${m.id}`)
    }

    // 3) 没有则创建（直接发布，不带 draft）
    if (!main || !matches.length) {
      console.log('创建 Release：' + tag)
      main = await api('POST', `/repos/${repo}/releases`, { body: { tag_name: tag, name: version, draft: false, generate_release_notes: true } })
    }

    // 4) 上传本地缺失的资产（只传与当前版本匹配的 Setup/blockmap 和 latest.yml）
    const wantNames = new Set()
    for (const f of fs.readdirSync(RELEASE_DIR)) {
      if (!f.includes(version)) continue
      if (/\.blockmap$/.test(f) || /\.exe$/.test(f)) wantNames.add(f)
    }
    if (fs.existsSync(path.join(RELEASE_DIR, 'latest.yml'))) wantNames.add('latest.yml')
    console.log('待上传资产：' + [...wantNames].join(', '))

    if (!main) { console.error('未获取到 Release'); process.exit(1) }

    /** 按 tag 重新解析 Release；不存在则创建（用于 release 被删/失效时恢复） */
    const ensureRelease = async () => {
      const rel = await api('GET', `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`).catch(() => null)
      if (rel) return rel
      console.log('按 tag 重建 Release：' + tag)
      return api('POST', `/repos/${repo}/releases`, { body: { tag_name: tag, name: version, draft: false, generate_release_notes: true } })
    }

    // 上传统一走 release.upload_url（GitHub 标准方式，指向有效的 uploads 域名）
    let release = main
    let assetBase = (release.upload_url || '').replace('{?name,label}', '')
    if (!assetBase) assetBase = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets`

    let existingAssets = []
    try {
      existingAssets = await api('GET', `/repos/${repo}/releases/${release.id}/assets`)
    } catch (e) {
      // release 已失效（被手动删除等）：重建
      console.log('Release 失效，重建中...')
      release = await ensureRelease()
      assetBase = (release.upload_url || '').replace('{?name,label}', '')
      if (!assetBase) assetBase = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets`
      existingAssets = await api('GET', `/repos/${repo}/releases/${release.id}/assets`)
    }
    const haveNames = new Set(existingAssets.map(a => a.name))

    for (const name of wantNames) {
      if (haveNames.has(name)) { console.log('已存在，跳过：' + name); continue }
      const filePath = path.join(RELEASE_DIR, name)
      console.log('上传：' + name)
      const data = fs.readFileSync(filePath)
      try {
        await api('POST', assetBase + '?name=' + encodeURIComponent(name), { body: data, isBinary: true, headers: { 'Content-Length': data.length } })
      } catch (e) {
        if (!/404|410/.test(String(e.message))) throw e
        // 上传目标 release 失效：按 tag 重建后重试一次
        console.log('上传目标失效，按 tag 重建后重试：' + name)
        release = await ensureRelease()
        assetBase = (release.upload_url || '').replace('{?name,label}', '')
        await api('POST', assetBase + '?name=' + encodeURIComponent(name), { body: data, isBinary: true, headers: { 'Content-Length': data.length } })
      }
    }

    // 5) 确保已发布（draft:false → 标记为 Latest）
    if (release.draft !== false) {
      await api('PATCH', `/repos/${repo}/releases/${release.id}`, { body: { draft: false } })
      console.log('已发布 Release：' + tag)
    } else {
      console.log('Release 已是发布状态：' + tag)
    }
    console.log('发布完成：https://github.com/' + repo + '/releases/tag/' + tag)
  })().catch(e => { console.error('发布失败：' + e.message); process.exit(1) })
}

// ========== CLI ==========
const cmds = { 'install-deps': installDeps, 'make-ico': makeIco, 'pre-clean-release': preCleanRelease, 'cleanup-release': cleanupRelease, 'publish-release': publishRelease }
const cmd = process.argv[2]
if (!cmd || !cmds[cmd]) { console.error('Usage: node scripts/build-tools.cjs <cmd>\n  cmds: ' + Object.keys(cmds).join(', ')); process.exit(1) }
Promise.resolve(cmds[cmd]()).catch(e => { console.error(e); process.exit(1) })
