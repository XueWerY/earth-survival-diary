const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')

// ========== 容错删除 ==========
// Windows 上 rmSync 偶发 EPERM/EBUSY：杀毒软件、搜索索引器、资源管理器窗口或
// 上次构建残留的进程可能仍持有文件句柄（句柄释放与文件系统索引有延迟）。
// 这里做有限次重试 + 退避；仍失败则给出明确的占用诊断，而不是把 EPERM 直接抛给用户。
function forceRemove(target, { retries = 6, delayMs = 800 } = {}) {
  let lastErr = null
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
      return true
    } catch (e) {
      lastErr = e
      if (attempt < retries) {
        // 退避等待句柄释放；用 Atomics.wait 避免引入额外依赖
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
      }
    }
  }
  // 重试耗尽：列出具体占用者协助定位
  const detail = describeLockedFiles(target)
  throw new Error(
    `无法删除 ${path.relative(ROOT, target)}：${lastErr && lastErr.message ? lastErr.message : lastErr}` +
    (detail ? `\n可能仍被占用的文件：\n${detail}` : '') +
    `\n请关闭可能正在使用 release/ 目录的程序（资源管理器窗口、杀毒软件、` +
    `已安装的应用实例），或重启后重试。`
  )
}

// 递归找出目录内仍存在的文件（删除失败时这些就是被占用的），最多列 10 个
function describeLockedFiles(target) {
  const stuck = []
  const walk = (dir, depth) => {
    if (depth > 4 || stuck.length >= 10) return
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch (_) { return }
    for (const e of entries) {
      if (stuck.length >= 10) return
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full, depth + 1)
      else stuck.push('  ' + path.relative(ROOT, full))
    }
  }
  try {
    if (fs.statSync(target).isDirectory()) walk(target, 0)
    else stuck.push('  ' + path.relative(ROOT, target))
  } catch (_) {}
  return stuck.join('\n')
}

// ========== install-deps ==========
function installDeps() {
  const ELECTRON_DIR = path.join(ROOT, 'electron')
  const ELECTRON_DEPS_OK = path.join(ELECTRON_DIR, '.deps-ok')
  const manifest = fs.readFileSync(path.join(ELECTRON_DIR, 'package.json'), 'utf8')
  const required = Object.keys(JSON.parse(manifest).dependencies || {})
  const depsReady = fs.existsSync(ELECTRON_DEPS_OK) &&
    fs.readFileSync(ELECTRON_DEPS_OK, 'utf8') === manifest &&
    required.every(d => fs.existsSync(path.join(ELECTRON_DIR, 'node_modules', d, 'package.json')))
  if (depsReady) { console.log('桌面主进程依赖已安装。'); return }
  console.log('正在安装桌面主进程依赖……')
  execSync('npm install --no-package-lock --no-audit --no-fund', { cwd: ELECTRON_DIR, stdio: 'inherit' })
  fs.writeFileSync(ELECTRON_DEPS_OK, manifest)
  console.log('桌面主进程依赖安装完成。')
}

// ========== make-ico ==========
async function makeIco() {
  const sharp = require('sharp')
  const SOURCE = path.join(ROOT, 'build', 'images', 'app-icon.png')
  const OUTPUT = path.join(ROOT, 'build', 'images', 'icon.ico')
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
  console.log(`已生成 icon.ico（${SIZES.length} 种尺寸）`)
}

// ========== prepare-installer ==========
// 安装与卸载由 Inno Setup 完成（build/installer.iss + scripts/build-installer.cjs），
// 不再需要生成 NSIS 自解包配置；此命令保留以兼容旧调用。
function prepareInstaller() {
  console.log('已跳过：安装与卸载由 Inno Setup 脚本处理。')
}

// ========== cleanup-release ==========
// 构建后清理中间产物，只保留 .exe / .blockmap / .yml。
// 需要清理：win-unpacked、electron-builder 因输出目录被切换而产生的 out-* 目录，
// 以及构建辅助用的点开头目录。这些目录刚被写入、最易被占用，
// 删除失败时降级为告警，不影响已生成的安装包。
function cleanupRelease() {
  if (!fs.existsSync(RELEASE_DIR)) return
  const failures = []
  for (const f of fs.readdirSync(RELEASE_DIR)) {
    const p = path.join(RELEASE_DIR, f), s = fs.statSync(p)
    const shouldDelete = s.isFile()
      ? (!f.endsWith('.exe') && !f.endsWith('.blockmap') && !f.endsWith('.yml') && !f.endsWith('.yaml'))
      : (f.startsWith('.') || f === 'win-unpacked' || /^out-\d+$/.test(f))
    if (!shouldDelete) continue
    try {
      forceRemove(p)
    } catch (e) {
      failures.push(path.relative(ROOT, p))
    }
  }
  if (failures.length > 0) {
    console.warn('以下中间产物被占用、未能清理（不影响安装包使用）：')
    for (const f of failures) console.warn('  ' + f)
  }
}

// ========== pre-clean-release ==========
// 清理 release/ 下的历史产物。Windows 上残留文件可能被占用（杀毒、索引器、
// 上一次构建的进程、资源管理器窗口），删不掉不应阻塞构建。
// 对删不掉的目录（典型是 win-unpacked）做两件事：
//   1) 降级为告警，让 electron-builder 继续；
//   2) 生成 electron-builder 覆盖配置，把输出目录切到 release/ 下全新的子目录，
//      绕开被占用的 <output>/win-unpacked，使本次构建立即成功。
function preCleanRelease() {
  if (!fs.existsSync(RELEASE_DIR)) return
  const failures = []
  for (const f of fs.readdirSync(RELEASE_DIR)) {
    const p = path.join(RELEASE_DIR, f)
    try {
      forceRemove(p, { retries: 4, delayMs: 600 })
    } catch (e) {
      failures.push(path.relative(ROOT, p))
    }
  }
  if (failures.length > 0) {
    console.warn('以下历史产物被占用、暂时无法删除（不影响本次构建）：')
    for (const f of failures) console.warn('  ' + f)
    console.warn('提示：如遇文件被占用，请关闭可能使用 release/ 目录的程序后重试。')
  }

  // electron-builder 的 --config 要求文件必须存在，因此始终写入覆盖配置：
  // win-unpacked 被占用时把输出目录切到 release/out-<时间戳>/（全新路径，无占用），
  // 避免它在 unlink 旧 app.asar 时报 EBUSY 中断构建；无占用时写 {} 保持默认 release/。
  if (fs.existsSync(path.join(RELEASE_DIR, 'win-unpacked'))) {
    writeBuilderOverride()
  } else {
    writeEmptyBuilderOverride()
  }
  console.log('已清空 release/ 目录')
}

// electron-builder 覆盖配置：electron:build:win 用 --config 传入，
// 让输出目录指向 release/ 下带时间戳的新目录（全新 win-unpacked，无占用）。
const OVERRIDE_PATH = path.join(ROOT, 'build', 'electron-builder.override.json')
function writeOverrideConfig(directories) {
  fs.mkdirSync(path.dirname(OVERRIDE_PATH), { recursive: true })
  fs.writeFileSync(OVERRIDE_PATH, JSON.stringify({ directories }, null, 2))
}
function writeBuilderOverride() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const outDir = path.join('release', 'out-' + stamp)
  writeOverrideConfig({ output: outDir })
  console.log('检测到 win-unpacked 被占用，本次构建输出目录切换为：' + outDir)
  return outDir
}
function writeEmptyBuilderOverride() {
  // electron-builder 的 --config 会整体替换 directories 对象：
  // 写 {} 会把 package.json 里的 output:"release" 抹掉，导致输出回退到默认的 dist/。
  // 因此无占用时也要显式带上 package.json 中配置的输出目录。
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const configured = (pkg.build && pkg.build.directories && pkg.build.directories.output) || 'release'
  writeOverrideConfig({ output: configured })
}

// ========== publish-release ==========
// 用 GH_TOKEN（或 GITHUB_TOKEN）把 release/ 目录产物发布为 GitHub Release：
//   1. 自动合并同版本的重复 draft（electron-builder 并发上传竞态产生的拆家 release）；
//   2. 上传本地缺失的资产（Setup exe、blockmap、latest.yml）；
//   3. 发布 Release（draft:false），成为 Latest。
//
// ⚠️ 令牌解析顺序（2026-10-18 增补）：
//   1) 环境变量 GH_TOKEN / GITHUB_TOKEN（CI 或用户显式设置）
//   2) 本机 GitHub CLI 的登录态（`gh auth token`）
// 为什么要加第 2 条：此前只认环境变量，而手动设置的 PAT 会过期，
// 一旦过期就报 `401 Bad credentials`，用户很难判断是「令牌过期」还是「脚本出错」。
// gh 的登录令牌由 keyring 托管、可通过 `gh auth login` 续期，作为兜底更可靠。
/*
  读取 GitHub CLI 在 keyring 里的登录令牌。

  ⚠️ 必须**清掉 GH_TOKEN / GITHUB_TOKEN 再调用 gh**：
  gh CLI 在环境变量存在时会直接回显它（实测：设了失效的 GH_TOKEN 后
  `gh auth token` 返回的就是那个失效的 ghp_ 令牌，而非 keyring 里的 gho_ 令牌）。
  这样兜底才真正拿到「另一个」令牌，否则等于原地打转。
*/
function readGhToken() {
  const env = { ...process.env }
  delete env.GH_TOKEN
  delete env.GITHUB_TOKEN
  try {
    return require('child_process')
      .execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env })
      .trim()
  } catch {
    return ''
  }
}

function resolveGithubToken() {
  const fromEnv = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim()
  if (fromEnv) return { token: fromEnv, source: 'env' }
  const fromGh = readGhToken()
  if (fromGh) return { token: fromGh, source: 'gh' }
  return { token: '', source: 'none' }
}

function publishRelease() {
  const https = require('https')
  return (async () => {
    let { token, source } = resolveGithubToken()
    if (!token) {
      console.error('缺少 GitHub 访问令牌，发布中止。可任选一种方式配置：')
      console.error('  1) 设置环境变量 GH_TOKEN（需 repo 权限的个人访问令牌）')
      console.error('  2) 安装 GitHub CLI 并登录：gh auth login')
      process.exit(1)
    }
    const pkg = require(path.join(ROOT, 'package.json'))
    const version = pkg.version
    const repo = pkg.repository
    if (typeof repo !== 'string') { console.error('package.json 缺少仓库地址配置'); process.exit(1) }
    const tag = 'v' + version

    /*
      发布前先校验令牌可用性。
      为什么要「先校验」而不是直接发：环境变量里的旧 PAT 可能已过期，
      若不校验，脚本会先跑完查询/创建 Release 才在后续步骤报 401，
      甚至留下半成品 draft。这里先探测一次，失败时若 gh 可用则自动切换，
      实现自愈（用户无需手动清理过期环境变量）。
    */
    const probe = () => new Promise(resolve => {
      const req = https.request({
        hostname: 'api.github.com',
        path: `/repos/${repo}`,
        method: 'GET',
        headers: {
          Authorization: 'token ' + token,
          'User-Agent': 'earth-survival-diary-build',
          Accept: 'application/vnd.github+json',
        },
      }, res => {
        res.resume()
        res.on('end', () => resolve(res.statusCode))
      })
      req.on('error', () => resolve(-1))
      req.end()
    })

    let status = await probe()
    if (status === 401 || status === 403) {
      const hintSource = source
      const ghToken = readGhToken()
      if (ghToken && ghToken !== token) {
        console.log(
          `环境变量里的令牌被 GitHub 拒绝（HTTP ${status}），已自动改用 GitHub CLI 的登录令牌重试。`,
        )
        console.log('提示：旧的 GH_TOKEN 已失效，建议用 setx GH_TOKEN "<新令牌>" 更新，或直接删除该变量。')
        token = ghToken
        source = 'gh'
        status = await probe()
      }
      if (status === 401 || status === 403) {
        console.error([
          '',
          '────────────────────────────────────────',
          `GitHub 拒绝了访问令牌（HTTP ${status}，来源：${hintSource}）。常见原因：`,
          '  · 令牌已过期或被撤销（经典 PAT 有有效期）',
          '  · 令牌缺少该仓库的 repo 权限（细粒度令牌需显式授权）',
          '',
          '处理方式（任选其一）：',
          '  1) 重新生成 PAT 并更新环境变量：',
          '       setx GH_TOKEN "<新的令牌>"     （需重新打开终端生效）',
          '  2) 删除失效变量，改用 GitHub CLI 登录：',
          '       setx GH_TOKEN ""               （或在系统设置里删除）',
          '       gh auth login',
          '────────────────────────────────────────',
        ].join('\n'))
        process.exit(1)
      }
    }
    if (source === 'gh') console.log('使用 GitHub CLI 的登录令牌发布。')

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
            /*
              401/403 单独给出可操作的提示：
              此前只抛出原始 JSON `Bad credentials`，用户无法判断
              是「令牌过期」还是「脚本有 bug」。这里补上排查方向。
            */
            if (res.statusCode === 401 || res.statusCode === 403) {
              const hint = [
                '',
                '────────────────────────────────────────',
                `GitHub 拒绝了访问令牌（HTTP ${res.statusCode}）。常见原因：`,
                '  · 令牌已过期或被撤销（经典 PAT 有有效期）',
                '  · 令牌缺少该仓库的 repo 权限（细粒度令牌需显式授权）',
                '',
                '处理方式：',
                '  1) 重新生成 PAT 并设置为环境变量：',
                '       setx GH_TOKEN "<新的令牌>"   （重新打开终端生效）',
                '  2) 或改用 GitHub CLI 登录后重试（脚本会自动读取）：',
                '       gh auth login',
                '     然后直接执行 npm run publish-release',
                '────────────────────────────────────────',
              ].join('\n')
              console.error(hint)
            }
            reject(new Error(`GitHub API ${method} ${urlPath} -> ${res.statusCode}: ${text.slice(0, 300)}`))
          }
        })
      })
      req.on('error', reject)
      if (body) req.write(isBinary ? body : JSON.stringify(body))
      req.end()
    })

    // 1) 列出全部 releases，找到与 tag/version 匹配的条目
      console.log('正在查询仓库发布版本：' + repo)
    const allReleases = []
    let page = 1
    for (;;) {
      const batch = await api('GET', `/repos/${repo}/releases?per_page=100&page=${page}`)
      allReleases.push(...batch)
      if (batch.length < 100) break
      page++
    }
    const matches = allReleases.filter(r => r.tag_name === tag || r.tag_name === version || r.name === version)
      console.log('匹配到的发布版本数量：' + matches.length)

    // 2) 保留资产最多的一个，删除其余重复 draft
    let main = null
    for (const m of matches) {
      if (!main || (m.assets || []).length > (main.assets || []).length) main = m
    }
    for (const m of matches) {
      if (main && m.id === main.id) continue
      console.log('删除重复发布版本 #' + m.id + '（资源文件数：' + (m.assets || []).length + '）')
      await api('DELETE', `/repos/${repo}/releases/${m.id}`)
    }

    // 3) 没有则创建（直接发布，不带 draft）
    if (!main || !matches.length) {
      console.log('创建发布版本：' + tag)
      main = await api('POST', `/repos/${repo}/releases`, { body: { tag_name: tag, name: version, draft: false, generate_release_notes: true } })
    }

    // 4) 上传本地缺失的资产（只传与当前版本匹配的 Setup/blockmap 和 latest.yml）
    const wantNames = new Set()
    for (const f of fs.readdirSync(RELEASE_DIR)) {
      if (!f.includes(version)) continue
      if (/\.blockmap$/.test(f) || /\.exe$/.test(f)) wantNames.add(f)
    }
    if (fs.existsSync(path.join(RELEASE_DIR, 'latest.yml'))) wantNames.add('latest.yml')
      console.log('待上传文件：' + [...wantNames].join(', '))

      if (!main) { console.error('未获取到发布版本'); process.exit(1) }

    /** 按 tag 重新解析 Release；不存在则创建（用于 release 被删/失效时恢复） */
    const ensureRelease = async () => {
      const rel = await api('GET', `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`).catch(() => null)
      if (rel) return rel
      console.log('正在按标记重建发布版本：' + tag)
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
      console.log('发布版本已失效，正在重建……')
      release = await ensureRelease()
      assetBase = (release.upload_url || '').replace('{?name,label}', '')
      if (!assetBase) assetBase = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets`
      existingAssets = await api('GET', `/repos/${repo}/releases/${release.id}/assets`)
    }
    const haveNames = new Set(existingAssets.map(a => a.name))

    for (const name of wantNames) {
      if (haveNames.has(name)) { console.log('文件已存在，跳过：' + name); continue }
      const filePath = path.join(RELEASE_DIR, name)
      console.log('正在上传：' + name)
      const data = fs.readFileSync(filePath)
      try {
        await api('POST', assetBase + '?name=' + encodeURIComponent(name), { body: data, isBinary: true, headers: { 'Content-Length': data.length } })
      } catch (e) {
        if (!/404|410/.test(String(e.message))) throw e
        // 上传目标 release 失效：按 tag 重建后重试一次
        console.log('上传目标已失效，重建发布版本后重试：' + name)
        release = await ensureRelease()
        assetBase = (release.upload_url || '').replace('{?name,label}', '')
        await api('POST', assetBase + '?name=' + encodeURIComponent(name), { body: data, isBinary: true, headers: { 'Content-Length': data.length } })
      }
    }

    // 5) 确保已发布（draft:false → 标记为 Latest）
    if (release.draft !== false) {
      await api('PATCH', `/repos/${repo}/releases/${release.id}`, { body: { draft: false } })
      console.log('已发布版本：' + tag)
    } else {
      console.log('该版本已发布：' + tag)
    }
    console.log('发布完成：https://github.com/' + repo + '/releases/tag/' + tag)
  })().catch(e => { console.error('发布失败：' + e.message); process.exit(1) })
}

// ========== CLI ==========
const cmds = { 'install-deps': installDeps, 'make-ico': makeIco, 'prepare-installer': prepareInstaller, 'pre-clean-release': preCleanRelease, 'cleanup-release': cleanupRelease, 'publish-release': publishRelease }
const cmd = process.argv[2]
if (!cmd || !cmds[cmd]) { console.error('用法：node scripts/build-tools.cjs <命令>\n  可用命令：' + Object.keys(cmds).join('、')); process.exit(1) }
Promise.resolve(cmds[cmd]()).catch(e => { console.error(e); process.exit(1) })
