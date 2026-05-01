import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const INPUT_PNG = path.join(process.cwd(), 'build', 'app-icon.png')
const OUTPUT_DIR = path.join(process.cwd(), 'build')

const sizes = {
  'icon.png': 512,
  'icon-256.png': 256,
  'icon-128.png': 128,
  'icon-64.png': 64,
  'icon-32.png': 32,
  'icon-16.png': 16
}

async function generateIcons() {
  const pngBuffer = fs.readFileSync(INPUT_PNG)

  for (const [filename, size] of Object.entries(sizes)) {
    const outputPath = path.join(OUTPUT_DIR, filename)
    await sharp(pngBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)
    console.log(`✓ Generated ${filename} (${size}x${size})`)
  }

  console.log('\nAll icons generated in build/')
}

generateIcons().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})