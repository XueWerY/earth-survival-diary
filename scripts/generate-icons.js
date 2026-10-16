import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const INPUT_PNG = path.join(ROOT, 'build', 'images', 'app-icon.png')
const BUILD_DIR = path.join(ROOT, 'build', 'images')

// 桌面端 PNG 图标尺寸
const desktopSizes = {
  'icon.png': 512,
  'icon-256.png': 256,
  'icon-128.png': 128,
  'icon-64.png': 64,
  'icon-32.png': 32,
  'icon-16.png': 16
}

async function generateIcons() {
  if (!fs.existsSync(INPUT_PNG)) {
    console.error(`错误：未找到源图标：${INPUT_PNG}`)
    process.exit(1)
  }

  const pngBuffer = fs.readFileSync(INPUT_PNG)

  // 1. 生成桌面端 PNG 图标
  console.log('=== 桌面端 PNG 图标 ===')
  for (const [filename, size] of Object.entries(desktopSizes)) {
    const outputPath = path.join(BUILD_DIR, filename)
    await sharp(pngBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)
    console.log(`✓ 已生成 ${filename}（${size}×${size}）`)
  }

  console.log('\n图标已全部生成！')
}

generateIcons().catch(err => {
  console.error('生成图标失败：', err)
  process.exit(1)
})
