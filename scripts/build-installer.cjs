/**
 * Inno Setup 安装/卸载程序构建（scripts/build-installer.cjs）
 *
 * 依赖 electron-builder 先产出 release/win-unpacked（`electron-builder --win dir`），
 * 再用本脚本生成 .iss 并调用 ISCC 编译出正式的安装/卸载程序。
 *
 * 用法：
 *   node scripts/build-installer.cjs                生成 installer.iss 并编译
 *   node scripts/build-installer.cjs --print-script  只打印生成的脚本，不编译
 *   node scripts/build-installer.cjs --skip-setup    不自动安装 Inno Setup
 *
 * 产物：release/Earth-Survival-Diary-Setup-<version>.exe（与 electron-builder NSIS 产物同名）
 * 同时生成 .blockmap，便于发布与更新校验。
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync, spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')
const IMAGE_DIR = path.join(ROOT, 'build', 'images')
const TOOLS_DIR = path.join(ROOT, 'build', 'tools')
const GENERATED_PATH = path.join(ROOT, 'build', 'installer.generated.iss')

// electron-builder 实际输出目录：默认 release/，但 pre-clean-release 在检测到
// win-unpacked 被占用时会生成 build/electron-builder.override.json 把输出切到
// release/out-<时间戳>/。这里读取同一份覆盖配置，保证两边路径一致。
const OVERRIDE_PATH = path.join(ROOT, 'build', 'electron-builder.override.json')
const BUILDER_OUT_DIR = (() => {
  try {
    if (fs.existsSync(OVERRIDE_PATH)) {
      const ov = JSON.parse(fs.readFileSync(OVERRIDE_PATH, 'utf8'))
      if (ov && ov.directories && ov.directories.output) {
        return path.resolve(ROOT, ov.directories.output)
      }
    }
  } catch (_) {}
  return RELEASE_DIR
})()
const UNPACKED_DIR = path.join(BUILDER_OUT_DIR, 'win-unpacked')

const ARGS = new Set(process.argv.slice(2))
const PRINT_ONLY = ARGS.has('--print-script')
const SKIP_SETUP = ARGS.has('--skip-setup')

const pkg = require(path.join(ROOT, 'package.json'))
const build = pkg.build || {}
// Inno Setup 配置放在 package.json 根级（electron-builder 只读取 build 字段，避免 schema 校验失败）
const inno = pkg.innoSetup || build.innoSetup || {}
const legacyNsis = build.nsis || {}
// 安装脚本模板路径，可用 innoSetup.scriptTemplate 覆盖
const TEMPLATE_PATH = inno.scriptTemplate
  ? path.resolve(ROOT, inno.scriptTemplate)
  : path.join(ROOT, 'build', 'installer.iss')

const APP_NAME = build.productName || '地球 Online 生存日记'
const APP_VERSION = pkg.version
const APP_EXE = (build.win && build.win.executableName) || APP_NAME
// 安装目录名：与主程序文件名保持一致（Earth-Survival-Diary），避免在磁盘路径中出现中文。
// 开始菜单文件夹仍使用中文产品名（APP_NAME），仅磁盘路径改英文。
const INSTALL_DIR_NAME = APP_EXE
const APP_PUBLISHER = pkg.author || ''
const APP_ID = inno.guid || legacyNsis.guid || '302f4125-b87c-51f8-aebe-24e8fdc371d8'
const APP_DATA_DIR = 'earth-survival-diary'
// 侧边图边缘填充色：与 installer-sidebar.png 星空底色（TOP = #0F0C29）一致，
// 避免侧边图与面板之间出现白色缝隙。
const SIDEBAR_BACK_COLOR = '#0F0C29'
const ARTIFACT_NAME = inno.artifactName || legacyNsis.artifactName || build.artifactName || 'Earth-Survival-Diary-Setup-${version}.${ext}'
const OUTPUT_NAME = ARTIFACT_NAME.replace('${version}', APP_VERSION).replace('${ext}', 'exe')

/**
 * 把项目版本号（如 2026.10.12-1）转换成 Inno Setup 的 VersionInfoVersion
 * 要求的 1-4 段纯数字（如 2026.10.12.1）。
 */
function toNumericVersion(raw) {
  const parts = String(raw)
    .split(/[.+-]/)
    .map(p => p.trim())
    .filter(p => /^\d+$/.test(p))
  if (parts.length === 0) return '1.0.0.0'
  const padded = [...parts, '0', '0', '0', '0'].slice(0, 4)
  return padded.join('.')
}

const APP_VERSION_NUMERIC = toNumericVersion(APP_VERSION)

function fail(message) {
  console.error('构建安装程序失败：' + message)
  process.exit(1)
}

function requireFile(p, hint) {
  if (!fs.existsSync(p)) fail(`缺少 ${hint}：${p}`)
}

/** 生成 .iss：把模板占位符替换为实际值 */
function generateScript() {
  requireFile(TEMPLATE_PATH, '安装脚本模板')
  let text = fs.readFileSync(TEMPLATE_PATH, 'utf8')

  const replacements = {
    '{{AppName}}': APP_NAME,
    '{{InstallDirName}}': INSTALL_DIR_NAME,
    '{{AppVersion}}': APP_VERSION,
    '{{AppVersionNumeric}}': APP_VERSION_NUMERIC,
    '{{AppExeName}}': APP_EXE,
    '{{AppPublisher}}': APP_PUBLISHER,
    '{{AppId}}': APP_ID,
    '{{AppDataDir}}': APP_DATA_DIR,
    '{{SourceDir}}': UNPACKED_DIR,
    '{{OutputDir}}': RELEASE_DIR,
    '{{OutputBaseFilename}}': OUTPUT_NAME.replace(/\.exe$/, ''),
    '{{IconFile}}': path.join(IMAGE_DIR, 'icon.ico'),
    '{{LanguageFile}}': path.join(ROOT, 'build', 'languages', 'ChineseSimplified.isl'),
    '{{SidebarImage}}': path.join(IMAGE_DIR, 'installer-sidebar.png'),
    '{{SidebarBackColor}}': SIDEBAR_BACK_COLOR,
    '{{WizardSmallImage}}': path.join(IMAGE_DIR, 'installer-small.png'),
    '{{LicenseFile}}': path.join(ROOT, 'build', 'installer-license.txt')
  }

  for (const [key, value] of Object.entries(replacements)) {
    text = text.split(key).join(value)
  }

  const leftover = text.match(/\{\{[A-Za-z][A-Za-z0-9]*\}\}/)
  if (leftover) fail(`模板存在未替换的占位符：${leftover[0]}`)

  fs.writeFileSync(GENERATED_PATH, text, 'utf8')
  return GENERATED_PATH
}

/** 生成 blockmap（与 electron-builder 的 latest.yml 格式兼容） */
function writeBlockmap(exePath) {
  const data = fs.readFileSync(exePath)
  const hash = crypto.createHash('sha512').update(data).digest('base64')
  const size = data.length
  const BLOCK_SIZE = 1024 * 1024
  const blockCount = Math.ceil(size / BLOCK_SIZE)

  const entries = []
  for (let i = 0; i < blockCount; i++) {
    const start = i * BLOCK_SIZE
    const block = data.subarray(start, Math.min(start + BLOCK_SIZE, size))
    const sha = crypto.createHash('sha256').update(block).digest('base64')
    entries.push({ csize: block.length, size: block.length, sha2: sha })
  }

  // 与 electron-builder 一致的简单映射（单文件，不拆分 differential）
  const map = {
    blockMapSize: size,
    size,
    sha512: hash,
    files: [{ name: path.basename(exePath), blockMapSize: size, size, sha512: hash, blocks: entries }]
  }

  const out = exePath + '.blockmap'
  fs.writeFileSync(out, JSON.stringify(map, null, 2), 'utf8')
  console.log('已生成 blockmap：' + path.relative(ROOT, out))
  return out
}

/** 生成 latest.yml（保留原有 electron-builder 更新元数据格式） */
function writeLatestYml(exePath) {
  const data = fs.readFileSync(exePath)
  const hash = crypto.createHash('sha512').update(data).digest('base64')
  const out = path.join(RELEASE_DIR, 'latest.yml')
  const yml = [
    `version: ${APP_VERSION}`,
    'files:',
    `  - url: ${path.basename(exePath)}`,
    `    sha512: ${hash}`,
    `    size: ${data.length}`,
    `path: ${path.basename(exePath)}`,
    `sha512: ${hash}`,
    `releaseDate: '${new Date().toISOString()}'`
  ].join('\n') + '\n'
  fs.writeFileSync(out, yml, 'utf8')
  console.log('已生成更新元数据：' + path.relative(ROOT, out))
  return out
}

async function main() {
  if (!fs.existsSync(UNPACKED_DIR)) {
    fail(`未找到应用目录 ${path.relative(ROOT, UNPACKED_DIR)}；请先执行 electron-builder --win dir（npm run electron:build:win 会自动完成）。`)
  }

  requireFile(path.join(UNPACKED_DIR, APP_EXE + '.exe'), '主程序')
  for (const f of ['icon.ico', 'installer-sidebar.png', 'installer-small.png']) {
    requireFile(path.join(IMAGE_DIR, f), '安装器资源')
  }
  requireFile(path.join(ROOT, 'build', 'installer-license.txt'), '许可协议')
  // 简体中文语言文件：Inno Setup 未官方提供，由项目维护
  requireFile(path.join(ROOT, 'build', 'languages', 'ChineseSimplified.isl'), '简体中文语言文件')

  const scriptPath = generateScript()
  if (PRINT_ONLY) {
    console.log(fs.readFileSync(scriptPath, 'utf8'))
    return
  }

  // 解析 ISCC 编译器
  let iscc = process.env.ESD_ISCC || ''
  if (iscc && !fs.existsSync(iscc)) fail(`ESD_ISCC 指向的编译器不存在：${iscc}`)

  if (!iscc && !SKIP_SETUP) {
    const setup = require('./setup-inno.cjs')
    const info = await setup.resolveIscc()
    iscc = info.iscc
  }
  if (!iscc) fail('未找到 Inno Setup 编译器；请安装 Inno Setup 6 或设置 ESD_ISCC 指向 ISCC.exe。')

  console.log(`\n正在编译安装程序（${path.basename(iscc)}）……`)
  const started = Date.now()
  const result = spawnSync(iscc, [`"${scriptPath}"`], { stdio: 'inherit', cwd: ROOT, windowsVerbatimArguments: true })
  if (result.error) fail(result.error.message)
  if (result.status !== 0) fail(`ISCC 退出码 ${result.status}`)

  const exePath = path.join(RELEASE_DIR, OUTPUT_NAME)
  requireFile(exePath, '安装包产物')
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  const mb = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1)
  console.log(`\n安装程序编译完成（${seconds}s，${mb} MB）：${path.relative(ROOT, exePath)}`)
  console.log('支持静默安装：' + OUTPUT_NAME + ' /VERYSILENT /SUPPRESSMSGBOXES /NORESTART')
  console.log('支持静默卸载：' + path.join(UNPACKED_DIR, 'unins000.exe') + ' /VERYSILENT')

  writeBlockmap(exePath)
  writeLatestYml(exePath)
}

main().catch(e => fail(e && e.message ? e.message : String(e)))
