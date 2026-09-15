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
function publishRelease() {
  const pkg = require(path.join(ROOT, 'package.json'))
  const version = pkg.version
  console.log('当前版本：' + version)
  console.log('')
  console.log('发布步骤：')
  console.log('  1. 确保已登录 GitHub CLI：gh auth login')
  console.log('  2. 执行发布命令（自动构建 + 打 tag + 上传 Release）：')
  console.log('     npm run electron:build:win:release')
  console.log('')
  console.log('electron-builder 会自动：')
  console.log('    - 打包 NSIS 安装包 (.exe) + blockmap + latest.yml')
  console.log('    - 创建 tag v' + version)
  console.log('    - 创建 GitHub Release 并上传所有产物')
  console.log('')
  console.log('electron-updater 会从 GitHub Release API 读取 tag_name 作为最新版本号')
  console.log('和安装包地址，无需手动维护 latest.yml URL。')
}

// ========== CLI ==========
const cmds = { 'install-deps': installDeps, 'make-ico': makeIco, 'pre-clean-release': preCleanRelease, 'cleanup-release': cleanupRelease, 'publish-release': publishRelease }
const cmd = process.argv[2]
if (!cmd || !cmds[cmd]) { console.error('Usage: node scripts/build-tools.cjs <cmd>\n  cmds: ' + Object.keys(cmds).join(', ')); process.exit(1) }
Promise.resolve(cmds[cmd]()).catch(e => { console.error(e); process.exit(1) })
