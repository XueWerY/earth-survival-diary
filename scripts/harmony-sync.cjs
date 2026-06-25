// 鸿蒙构建同步脚本
// 将 dist/ 目录的 Web 资源复制到鸿蒙工程的 rawfile/web/ 目录
// 同时复制应用图标到鸿蒙资源目录
// 并将 ES module 打包为 IIFE 格式，避免 ArkWeb resource:// 协议跨域限制

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

// 3. 处理 HTML：将 ES module 打包为 IIFE，移除 crossorigin 属性
const indexPath = path.join(HARMONY_RAWFILE_WEB, 'index.html')
let htmlContent = fs.readFileSync(indexPath, 'utf-8')

// 提取入口 JS 文件名
const entryMatch = htmlContent.match(/<script type="module" crossorigin src="\.\/assets\/(index-[^.]+\.js)"><\/script>/)
if (entryMatch) {
  const entryName = entryMatch[1]
  const entryPath = path.join(HARMONY_RAWFILE_WEB, 'assets', entryName)
  const iifeName = entryName.replace('.js', '.iife.js')
  const iifePath = path.join(HARMONY_RAWFILE_WEB, 'assets', iifeName)

  // 使用 esbuild 将所有模块打包为单个 IIFE 文件
  const esbuild = require('esbuild')
  esbuild.buildSync({
    entryPoints: [entryPath],
    bundle: true,
    format: 'iife',
    globalName: 'app',
    write: true,
    outfile: iifePath,
    minify: false,
  })
  console.log('[harmony-sync] IIFE 打包完成: assets/' + iifeName)

  // 4. 修复 IIFE 中的 import_meta.url 为 undefined 导致 ArkWeb 崩溃的问题
  //    esbuild 将 import.meta.url 替换为 import_meta 变量但未赋值，
  //    动态导入时会调用 new URL(path, undefined) 触发 SIGSEGV
  let iifeContent = fs.readFileSync(iifePath, 'utf-8')
  const metaUrlExpr = '(document.currentScript&&document.currentScript.src)||window.location.href'
  // 替换第一个 import_meta 声明（主作用域）
  iifeContent = iifeContent.replace(
    'var import_meta,',
    `var import_meta = { url: ${metaUrlExpr} },`
  )
  // 替换 import_meta2 声明（__esm 作用域）
  iifeContent = iifeContent.replace(
    'var import_meta2,',
    `var import_meta2 = { url: ${metaUrlExpr} },`
  )
  fs.writeFileSync(iifePath, iifeContent)
  console.log('[harmony-sync] IIFE 已修复：import_meta.url 已赋值为当前脚本路径')

  // 修改 HTML：移除 modulepreload、crossorigin，替换 script 为延迟加载的普通脚本
  htmlContent = htmlContent
    // 移除 modulepreload 链接
    .replace(/<link rel="modulepreload"[^>]*>/g, '')
    // 移除 CSS 的 crossorigin 属性（普通 CSS 加载不需要 CORS）
    .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"')
    // 将 ES module 脚本替换为 defer 普通脚本
    .replace(
      /<script type="module" crossorigin src="\.\/assets\/index-[^.]+\.js"><\/script>/,
      `<script defer src="./assets/${iifeName}"></script>`
    )

  fs.writeFileSync(indexPath, htmlContent)
  console.log('[harmony-sync] HTML 已处理：移除 module/crossorigin，使用 IIFE 普通脚本')
} else {
  console.warn('[harmony-sync] 警告: 未找到入口 ES module 脚本，跳过 HTML 处理')
}

// 4. 复制应用图标
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
