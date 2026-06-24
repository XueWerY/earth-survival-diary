// 鸿蒙构建同步脚本
// 将 dist/ 目录的 Web 资源复制到鸿蒙工程的 rawfile/web/ 目录
// 同时复制应用图标到鸿蒙资源目录

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')
const HARMONY_RAWFILE_WEB = path.join(ROOT, 'harmony', 'entry', 'src', 'main', 'resources', 'rawfile', 'web')
const HARMONY_MEDIA = path.join(ROOT, 'harmony', 'AppScope', 'resources', 'base', 'media')
const ICON_SOURCE = path.join(ROOT, 'build', 'app-icon.png')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function copyDir(src, dest) {
  ensureDir(dest)
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

console.log('[harmony-sync] 开始同步 Web 资源到鸿蒙工程...')

// 1. 检查 dist 目录
if (!fs.existsSync(DIST_DIR)) {
  console.error('[harmony-sync] 错误: dist/ 目录不存在，请先运行 pnpm build')
  process.exit(1)
}

// 2. 清空并复制 Web 资源到 rawfile/web/
removeDir(HARMONY_RAWFILE_WEB)
copyDir(DIST_DIR, HARMONY_RAWFILE_WEB)
console.log('[harmony-sync] Web 资源已同步到 harmony/entry/src/main/resources/rawfile/web/')

// 3. 复制应用图标
if (fs.existsSync(ICON_SOURCE)) {
  ensureDir(HARMONY_MEDIA)
  fs.copyFileSync(ICON_SOURCE, path.join(HARMONY_MEDIA, 'app_icon.png'))
  console.log('[harmony-sync] 应用图标已同步到 harmony/AppScope/resources/base/media/')
} else {
  console.warn('[harmony-sync] 警告: build/app-icon.png 不存在，跳过图标同步')
}

console.log('[harmony-sync] 同步完成')
console.log('')
console.log('后续步骤:')
console.log('  1. 用 DevEco Studio 打开 harmony/ 目录')
console.log('  2. 等待项目同步完成')
console.log('  3. 连接鸿蒙设备或启动模拟器')
console.log('  4. 点击 Run 或 Build → Build Hap(s)/APP(s)')
