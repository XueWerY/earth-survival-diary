import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const INPUT_PNG = path.join(ROOT, 'build', 'app-icon.png')
const BUILD_DIR = path.join(ROOT, 'build')

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
    console.error(`Error: Source icon not found at ${INPUT_PNG}`)
    process.exit(1)
  }

  const pngBuffer = fs.readFileSync(INPUT_PNG)

  // 1. 生成桌面端 PNG 图标
  console.log('=== Desktop PNG icons ===')
  for (const [filename, size] of Object.entries(desktopSizes)) {
    const outputPath = path.join(BUILD_DIR, filename)
    await sharp(pngBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)
    console.log(`✓ Generated ${filename} (${size}x${size})`)
  }

  console.log('\nAll icons generated successfully!')
}

generateIcons().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
