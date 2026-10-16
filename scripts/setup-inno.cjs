/**
 * Inno Setup 编译器获取（scripts/setup-inno.cjs）
 *
 * 安装与卸载已从 electron-builder 原生 NSIS 切换为 Inno Setup（.iss 脚本 + ISCC 编译）。
 * NSIS 由 electron-builder 自带，而 Inno Setup 需要独立安装，本模块负责：
 *
 *  1. 优先使用本机已安装的 Inno Setup（Program Files / Program Files (x86) / LOCALAPPDATA）；
 *  2. 找不到时自动从 GitHub Release 下载官方 innosetup-<版本>.exe，
 *     以 /VERYSILENT /SUPPRESSMSGBOXES /NORESTART 静默安装到 build/tools/innosetup-<版本>；
 *  3. 校验下载文件大小与 sha512，损坏则重下；
 *  4. 返回 ISCC.exe 路径，供 build-installer.cjs 调用。
 *
 * 目标目录 build/tools/ 已加入 .gitignore，不进入版本库。
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')
const { pipeline } = require('stream/promises')
const { Readable } = require('stream')

const ROOT = path.resolve(__dirname, '..')
const TOOLS_DIR = path.join(ROOT, 'build', 'tools')

// Inno Setup 版本：与官方 Release tag（is-6_7_3）对应
const INNO_VERSION = process.env.ESD_INNO_VERSION || '6.7.3'
const RELEASE_TAG = 'is-' + INNO_VERSION.replace(/\./g, '_')
const DOWNLOAD_URL = `https://github.com/jrsoftware/issrc/releases/download/${RELEASE_TAG}/innosetup-${INNO_VERSION}.exe`
const DOWNLOAD_SIZE = 10592232
// 官方 .issig 中 file-hash 字段为 SHA-256（见 files.jrsoftware.org/is/6/innosetup-<版本>.exe.issig）
const DOWNLOAD_SHA256 = '9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732'

const INSTALL_ROOT = path.join(TOOLS_DIR, `innosetup-${INNO_VERSION}`)
const DOWNLOAD_CACHE = path.join(TOOLS_DIR, `innosetup-${INNO_VERSION}.exe`)
const ISCC_MARKER = path.join(TOOLS_DIR, `.iscc-${INNO_VERSION}.path`)

/** 本机常见 Inno Setup 安装位置 */
const SYSTEM_CANDIDATES = [
  path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Inno Setup 6'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Inno Setup 6'),
  path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Inno Setup 7'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Inno Setup 7'),
  path.join(process.env['LOCALAPPDATA'] || '', 'Programs', 'Inno Setup 6')
].filter(Boolean)

function isIsccValid(p) {
  return typeof p === 'string' && p.length > 0 && fs.existsSync(p)
}

/** 在某个目录下寻找 ISCC.exe（安装器可能把它放在根目录或子目录） */
function findIsccUnder(dir) {
  if (!dir || !fs.existsSync(dir)) return null
  const direct = path.join(dir, 'ISCC.exe')
  if (fs.existsSync(direct)) return direct
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()
    let entries = []
    try { entries = fs.readdirSync(current, { withFileTypes: true }) } catch (_) { continue }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === 'iscc.exe') return full
      if (entry.isDirectory() && stack.length < 64) stack.push(full)
    }
  }
  return null
}

/** 1) 本机已安装 */
function findSystemIscc() {
  for (const dir of SYSTEM_CANDIDATES) {
    const found = findIsccUnder(dir)
    if (found) return found
  }
  return null
}

/** 2) 之前由本脚本静默安装到 build/tools 的 */
function findManagedIscc() {
  if (fs.existsSync(ISCC_MARKER)) {
    const cached = fs.readFileSync(ISCC_MARKER, 'utf8').trim()
    if (isIsccValid(cached)) return cached
  }
  const found = findIsccUnder(INSTALL_ROOT)
  if (found) {
    fs.mkdirSync(TOOLS_DIR, { recursive: true })
    fs.writeFileSync(ISCC_MARKER, found)
    return found
  }
  return null
}

/** 3) 从 GitHub Release 下载官方安装器 */
async function downloadInstaller() {
  if (fs.existsSync(DOWNLOAD_CACHE)) {
    const size = fs.statSync(DOWNLOAD_CACHE).size
    if (size === DOWNLOAD_SIZE) {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(DOWNLOAD_CACHE)).digest('hex')
      if (hash === DOWNLOAD_SHA256) {
        console.log(`Inno Setup 安装器已缓存（${(size / 1024 / 1024).toFixed(2)} MB，校验通过）。`)
        return DOWNLOAD_CACHE
      }
    }
    console.log('缓存的 Inno Setup 安装器校验失败，重新下载。')
    fs.rmSync(DOWNLOAD_CACHE, { force: true })
  }

  fs.mkdirSync(TOOLS_DIR, { recursive: true })
  console.log(`正在下载 Inno Setup ${INNO_VERSION}：${DOWNLOAD_URL}`)
  const response = await fetch(DOWNLOAD_URL, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`下载失败：HTTP ${response.status} ${response.statusText}`)
  }

  const total = Number(response.headers.get('content-length') || 0)
  const temp = DOWNLOAD_CACHE + '.part'
  let received = 0
  let lastPercent = -1
  await pipeline(
    Readable.fromWeb(response.body),
    async function* (source) {
      for await (const chunk of source) {
        received += chunk.length
        if (total > 0) {
          const percent = Math.floor(received / total * 100)
          if (percent !== lastPercent && percent % 10 === 0) {
            lastPercent = percent
            process.stdout.write(`\r  ${percent}% (${(received / 1024 / 1024).toFixed(1)}/${(total / 1024 / 1024).toFixed(1)} MB)`)
          }
        }
        yield chunk
      }
      if (total > 0) process.stdout.write('\r  100%\n')
    },
    fs.createWriteStream(temp)
  )

  if (total > 0 && received !== total) throw new Error(`下载不完整：${received}/${total} 字节`)
  if (fs.statSync(temp).size !== DOWNLOAD_SIZE) throw new Error('下载文件大小与官方签名不符。')
  const hash = crypto.createHash('sha256').update(fs.readFileSync(temp)).digest('hex')
  if (hash !== DOWNLOAD_SHA256) throw new Error('下载文件 sha256 与官方签名不符。')
  fs.renameSync(temp, DOWNLOAD_CACHE)
  console.log('下载完成，签名校验通过。')
  return DOWNLOAD_CACHE
}

/** 4) 静默安装到 build/tools/innosetup-<版本> */
function silentInstall(installerPath) {
  if (findIsccUnder(INSTALL_ROOT)) return findIsccUnder(INSTALL_ROOT)
  fs.mkdirSync(INSTALL_ROOT, { recursive: true })
  console.log(`正在静默安装 Inno Setup 到 ${INSTALL_ROOT} ……`)
  const args = [
    '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '/NOCANCEL',
    `/DIR=${INSTALL_ROOT}`,
    `/LOG=${path.join(TOOLS_DIR, 'innosetup-install.log')}`
  ]
  const result = spawnSync(installerPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  const iscc = findIsccUnder(INSTALL_ROOT)
  if (!iscc) throw new Error('Inno Setup 安装后未找到 ISCC.exe，请查看 build/tools/innosetup-install.log。')
  fs.mkdirSync(TOOLS_DIR, { recursive: true })
  fs.writeFileSync(ISCC_MARKER, iscc)
  console.log('Inno Setup 安装完成：' + iscc)
  return iscc
}

/**
 * 获取可用的 ISCC.exe 路径。
 * @returns {{ iscc: string, source: 'system'|'managed', version: string }}
 */
async function resolveIscc() {
  const systemIscc = findSystemIscc()
  if (systemIscc) {
    console.log('使用本机已安装的 Inno Setup：' + systemIscc)
    return { iscc: systemIscc, source: 'system', version: INNO_VERSION }
  }

  const managed = findManagedIscc()
  if (managed) {
    console.log('使用项目内 Inno Setup：' + managed)
    return { iscc: managed, source: 'managed', version: INNO_VERSION }
  }

  const installer = await downloadInstaller()
  const iscc = silentInstall(installer)
  return { iscc, source: 'managed', version: INNO_VERSION }
}

module.exports = { resolveIscc, findIsccUnder, INNO_VERSION, INSTALL_ROOT, TOOLS_DIR }

if (require.main === module) {
  resolveIscc()
    .then(info => { console.log('ISCC: ' + info.iscc + ' (' + info.source + ')') })
    .catch(e => { console.error('获取 Inno Setup 失败：' + e.message); process.exit(1) })
}
