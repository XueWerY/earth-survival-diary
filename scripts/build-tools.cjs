const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')

// ========== install-deps ==========
function installDeps() {
  const ELECTRON_DIR = path.join(ROOT, 'electron')
  const ELECTRON_DEPS_OK = path.join(ELECTRON_DIR, '.deps-ok')
  if (fs.existsSync(ELECTRON_DEPS_OK)) { console.log('Electron deps already installed.'); return }
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

// ========== fix-latest-yml ==========
function fixLatestYml() {
  const pkg = require(path.join(ROOT, 'package.json'))
  const latestPath = path.join(ROOT, 'release', 'latest.yml')
  const version = pkg.version
  const baseUrl = `https://github.com/XueWerY/earth-survival-diary/releases/download/v${version}`

  if (fs.existsSync(latestPath)) {
    let content = fs.readFileSync(latestPath, 'utf-8')
    const exeFile = content.match(/path: (.+)/)[1]
    const encodedFile = encodeURIComponent(exeFile)
    content = content.replace(/^path: .+$/m, `path: ${baseUrl}/${encodedFile}`)
    content = content.replace(/^(  - url: ).+$/m, `$1${baseUrl}/${encodedFile}`)
    fs.writeFileSync(latestPath, content)
    console.log('Updated latest.yml with GitHub URLs')
    console.log('  version: ' + version)
    console.log('  exe: ' + encodedFile)
    return
  }

  const exeFile = fs.readdirSync(RELEASE_DIR).find(f => f.endsWith('.exe') && !f.includes('__uninstaller'))
  if (!exeFile) { console.log('No installer exe found, skipping latest.yml generation'); return }

  const crypto = require('crypto')
  const filePath = path.join(RELEASE_DIR, exeFile)
  const fileBuf = fs.readFileSync(filePath)
  const sha512 = crypto.createHash('sha512').update(fileBuf).digest('base64')
  const releaseDate = new Date(fs.statSync(filePath).mtime).toISOString()
  const encodedFile = encodeURIComponent(exeFile)

  const yaml = `version: ${version}
path: ${baseUrl}/${encodedFile}
sha512: ${sha512}
releaseDate: ${releaseDate}
`

  fs.writeFileSync(latestPath, yaml)
  console.log('Generated latest.yml')
  console.log('  version: ' + version)
  console.log('  exe: ' + encodedFile)
}

// ========== cleanup-release ==========
function cleanupRelease() {
  if (!fs.existsSync(RELEASE_DIR)) return
  const keepFiles = ['latest.yml']
  const keepExts = ['.exe', '.blockmap', '.deb']
  for (const f of fs.readdirSync(RELEASE_DIR)) {
    const p = path.join(RELEASE_DIR, f), s = fs.statSync(p)
    if (s.isFile() && !keepFiles.includes(f) && !keepExts.some(ext => f.endsWith(ext))) fs.rmSync(p)
    if (s.isDirectory() && (f.startsWith('.') || f === 'win-unpacked' || f === 'linux-unpacked')) fs.rmSync(p, { recursive: true })
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
  if (!fs.existsSync(RELEASE_DIR)) { console.error('release/ directory not found. Run build first.'); process.exit(1) }
  const files = fs.readdirSync(RELEASE_DIR).filter(f => f.endsWith('.exe') || f.endsWith('.blockmap') || f === 'latest.yml')
  console.log('Release files in release/:'); files.forEach(f => console.log('  ' + f))
  const pkg = require(path.join(ROOT, 'package.json'))
  const version = pkg.version, tag = 'v' + version
  const exeFile = files.find(f => f.endsWith('.exe') && f.includes(version))
  const blockmapFile = files.find(f => f.endsWith('.blockmap') && f.includes(version))
  console.log('\n--- Publish steps ---')
  console.log('1. Fix latest.yml URLs:')
  console.log('     node scripts/build-tools.cjs fix-latest-yml')
  console.log('2. Create GitHub Release at:')
  console.log('     https://github.com/XueWerY/earth-survival-diary/releases/new')
  console.log('   Tag: ' + tag)
  console.log('   Upload: release/' + exeFile)
  if (blockmapFile) console.log('   Upload: release/' + blockmapFile)
  console.log('3. Commit and push latest.yml:')
  console.log('     git add release/latest.yml')
  console.log('     git commit -m "release: v' + version + '"')
  console.log('     git push')
}

// ========== CLI ==========
const cmds = { 'install-deps': installDeps, 'make-ico': makeIco, 'pre-clean-release': preCleanRelease, 'fix-latest-yml': fixLatestYml, 'cleanup-release': cleanupRelease, 'publish-release': publishRelease }
const cmd = process.argv[2]
if (!cmd || !cmds[cmd]) { console.error('Usage: node scripts/build-tools.cjs <cmd>\n  cmds: ' + Object.keys(cmds).join(', ')); process.exit(1) }
Promise.resolve(cmds[cmd]()).catch(e => { console.error(e); process.exit(1) })
