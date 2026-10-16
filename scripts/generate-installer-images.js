// Inno Setup 安装器图形生成（scripts/generate-installer-images.js）
//
// 由 `npm run build` 调用，输出：
//   build/images/installer-sidebar.png  左侧大图（WizardImageFile，240×459）
//                                       —— 星空背景 + 水平居中的地球
//   build/images/installer-small.png    右上小图（WizardSmallImageFile，147×147，透明背景）
//
// 设计说明：
//   - 星空画在侧边图内部，所以只覆盖左侧区域，不会铺满整个向导窗口。
//     （WizardBackImageFile 会铺满整窗，已弃用。）
//   - 侧边图尺寸取 240×459：保持 Inno 要求的 164:314 宽高比，
//     且不小于官方推荐的 202×386，避免高 DPI 下模糊。
//   - 侧边图背景为不透明星空；透明区域由 WizardImageBackColor 控制，
//     已设为 none（保持透明），因此不会出现白色底块。

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const imageDirectory = path.join(process.cwd(), 'build', 'images')

// ============ 尺寸 ============
// 侧边图宽高比固定为 Inno 要求的 164:314（≈0.5223）
const SIDEBAR_W = 240
const SIDEBAR_H = 459
const SMALL_SIZE = 147

// ============ 颜色 ============
const TOP = hex('0F0C29')
const BOTTOM = hex('302B63')
const PURPLE = hex('8B5CF6')
const STAR_A = hex('BFDBFE')
const STAR_B = hex('F5F3FF')

function hex(value) {
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
}

// ============ RGBA 画布 ============
function canvas(width, height) {
  // pixels 为 RGBA 四通道，初始 alpha=0（全透明）
  return { width, height, pixels: Buffer.alloc(width * height * 4) }
}

/** 在画布上混合一个颜色（支持 alpha） */
function blend(image, x, y, rgb, opacity = 1) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return
  const offset = (y * image.width + x) * 4
  const srcA = Math.max(0, Math.min(1, opacity))
  const dstA = image.pixels[offset + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) return
  for (let channel = 0; channel < 3; channel += 1) {
    const src = rgb[channel]
    const dst = image.pixels[offset + channel]
    image.pixels[offset + channel] = Math.round((src * srcA + dst * dstA * (1 - srcA)) / outA)
  }
  image.pixels[offset + 3] = Math.round(outA * 255)
}

/** 实心绘制（忽略目标 alpha，直接覆盖） */
function plot(image, x, y, rgb, alpha = 255) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return
  const offset = (y * image.width + x) * 4
  image.pixels[offset] = rgb[0]
  image.pixels[offset + 1] = rgb[1]
  image.pixels[offset + 2] = rgb[2]
  image.pixels[offset + 3] = alpha
}

// ============ 背景（星空渐变）============
function starfieldBackground(width, height, starCount = 360, seed = 20261013) {
  const image = canvas(width, height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const diagonal = Math.min(1, x / width * 0.35 + y / height * 0.75)
      const distance = Math.hypot(x - width * 0.54, y - height * 0.43)
      const glow = Math.max(0, 1 - distance / Math.max(width, height) * 0.72) ** 2 * 0.2
      const offset = (y * width + x) * 4
      for (let channel = 0; channel < 3; channel += 1) {
        const gradient = TOP[channel] + (BOTTOM[channel] - TOP[channel]) * diagonal
        image.pixels[offset + channel] = Math.round(gradient + (PURPLE[channel] - gradient) * glow)
      }
      image.pixels[offset + 3] = 255
    }
  }

  // 星星
  let state = seed >>> 0
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
  for (let index = 0; index < starCount; index += 1) {
    const cx = Math.floor(random() * width)
    const cy = Math.floor(random() * height)
    const radius = random() > 0.86 ? 1.2 : 0.55
    const rgb = random() > 0.68 ? STAR_A : STAR_B
    const alpha = 0.42 + random() * 0.5
    drawFilledCircle(image, cx, cy, radius, rgb, alpha)
  }
  return image
}

function drawFilledCircle(image, cx, cy, radius, rgb, opacity = 1) {
  const startX = Math.floor(cx - radius)
  const endX = Math.ceil(cx + radius)
  const startY = Math.floor(cy - radius)
  const endY = Math.ceil(cy + radius)
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) blend(image, x, y, rgb, opacity)
    }
  }
}

// ============ PNG 解码（8 位 RGBA 非交错）============
function decodePng(buffer) {
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  const bitDepth = buffer[24]
  const colorType = buffer[25]
  if (bitDepth !== 8 || colorType !== 6 || buffer[28] !== 0) {
    throw new Error('应用图标必须是非交错的 8 位 RGBA PNG。')
  }

  const chunks = []
  let offset = 8
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
    if (type === 'IEND') break
  }

  const rowBytes = width * 4
  const compressed = zlib.inflateSync(Buffer.concat(chunks))
  const pixels = Buffer.alloc(height * rowBytes)
  let inputOffset = 0
  for (let y = 0; y < height; y += 1) {
    const filter = compressed[inputOffset++]
    const rowOffset = y * rowBytes
    const previousOffset = rowOffset - rowBytes
    for (let index = 0; index < rowBytes; index += 1) {
      const raw = compressed[inputOffset++]
      const left = index >= 4 ? pixels[rowOffset + index - 4] : 0
      const up = y > 0 ? pixels[previousOffset + index] : 0
      const upperLeft = y > 0 && index >= 4 ? pixels[previousOffset + index] : 0
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = up
      else if (filter === 3) predictor = Math.floor((left + up) / 2)
      else if (filter === 4) {
        const estimate = left + up - upperLeft
        const leftDistance = Math.abs(estimate - left)
        const upDistance = Math.abs(estimate - up)
        const cornerDistance = Math.abs(estimate - upperLeft)
        predictor = leftDistance <= upDistance && leftDistance <= cornerDistance
          ? left
          : upDistance <= cornerDistance ? up : upperLeft
      } else if (filter !== 0) throw new Error('不支持的 PNG 行过滤器。')
      pixels[rowOffset + index] = (raw + predictor) & 0xff
    }
  }
  return { width, height, pixels }
}

/** 把源 PNG 缩放绘制到目标画布指定区域（保留 alpha） */
function drawPngScaled(target, source, x, y, width, height) {
  for (let ty = 0; ty < height; ty += 1) {
    const sy = Math.min(source.height - 1, Math.floor(ty / height * source.height))
    for (let tx = 0; tx < width; tx += 1) {
      const sx = Math.min(source.width - 1, Math.floor(tx / width * source.width))
      const srcOffset = (sy * source.width + sx) * 4
      const alpha = source.pixels[srcOffset + 3] / 255
      if (alpha <= 0) continue
      blend(target, x + tx, y + ty, [
        source.pixels[srcOffset],
        source.pixels[srcOffset + 1],
        source.pixels[srcOffset + 2]
      ], alpha)
    }
  }
}

// ============ PNG 编码（8 位 RGBA 非交错，filter 0）============
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(image) {
  const { width, height, pixels } = image
  const rowBytes = width * 4
  const raw = Buffer.alloc(height * (rowBytes + 1))
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (rowBytes + 1)
    raw[rowStart] = 0 // filter: none
    pixels.copy(raw, rowStart + 1, y * rowBytes, (y + 1) * rowBytes)
  }
  const compressed = zlib.deflateSync(raw, { level: 9 })

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type: RGBA
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ============ 主流程 ============
function main() {
  const icon = decodePng(fs.readFileSync(path.join(imageDirectory, 'app-icon.png')))

  // 1) 左侧大图：星空背景 + 水平居中的地球
  //    星空只铺满这张 240×459 的侧边图，因此只覆盖向导左侧区域。
  const sidebar = starfieldBackground(SIDEBAR_W, SIDEBAR_H, 120, 20261013)
  const earthSize = Math.round(SIDEBAR_W * 0.62)
  const earthX = Math.round((SIDEBAR_W - earthSize) / 2)   // 水平居中
  const earthY = Math.round(SIDEBAR_H * 0.42 - earthSize / 2)
  drawPngScaled(sidebar, icon, earthX, earthY, earthSize, earthSize)
  fs.writeFileSync(path.join(imageDirectory, 'installer-sidebar.png'), encodePng(sidebar))
  console.log(`已生成左侧大图 installer-sidebar.png（${SIDEBAR_W}×${SIDEBAR_H}，星空 + 地球水平居中）`)

  // 2) 右上小图：透明背景 + 水平居中的地球
  const small = canvas(SMALL_SIZE, SMALL_SIZE)
  const smallEarth = Math.round(SMALL_SIZE * 0.82)
  const smallX = Math.round((SMALL_SIZE - smallEarth) / 2)
  const smallY = Math.round((SMALL_SIZE - smallEarth) / 2)
  drawPngScaled(small, icon, smallX, smallY, smallEarth, smallEarth)
  fs.writeFileSync(path.join(imageDirectory, 'installer-small.png'), encodePng(small))
  console.log(`已生成右上小图 installer-small.png（${SMALL_SIZE}×${SMALL_SIZE}，透明背景）`)

  // 3) 清理不再使用的独立背景图（星空已并入侧边图）
  for (const legacy of ['installer-background.bmp', 'installer-background.png']) {
    const p = path.join(imageDirectory, legacy)
    if (fs.existsSync(p)) {
      fs.rmSync(p)
      console.log(`已清理不再使用的文件 ${legacy}`)
    }
  }
}

try {
  main()
} catch (error) {
  console.error('生成安装器图形失败：', error)
  process.exitCode = 1
}
