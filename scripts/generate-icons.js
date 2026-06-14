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

// Android mipmap 密度与尺寸
const androidDensities = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
]

const ANDROID_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

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

  // 2. 生成 Android mipmap 图标
  if (fs.existsSync(ANDROID_RES)) {
    console.log('\n=== Android mipmap icons ===')
    for (const d of androidDensities) {
      const resDir = path.join(ANDROID_RES, d.name)
      if (!fs.existsSync(resDir)) continue

      // ic_launcher.png / ic_launcher_round.png：非自适应图标，直接缩放
      await sharp(pngBuffer)
        .resize(d.size, d.size)
        .png()
        .toFile(path.join(resDir, 'ic_launcher.png'))
      await sharp(pngBuffer)
        .resize(d.size, d.size)
        .png()
        .toFile(path.join(resDir, 'ic_launcher_round.png'))

      // ic_launcher_foreground.png：自适应图标前景图，会被设备蒙版裁剪
      // 添加 16% 内边距，确保图标内容位于安全区内
      const PADDING = 0.16
      const contentSize = Math.floor(d.size * (1 - 2 * PADDING))
      const contentBuf = await sharp(pngBuffer)
        .resize(contentSize, contentSize)
        .png()
        .toBuffer()
      await sharp({
        create: { width: d.size, height: d.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      })
        .composite([{ input: contentBuf, top: Math.floor(d.size * PADDING), left: Math.floor(d.size * PADDING) }])
        .png()
        .toFile(path.join(resDir, 'ic_launcher_foreground.png'))

      console.log(`✓ Generated ${d.name}/ic_launcher*.png (${d.size}x${d.size})`)
    }
  } else {
    console.log('\n! Android resource directory not found, skipping Android icons')
  }

  console.log('\nAll icons generated successfully!')
}

generateIcons().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})