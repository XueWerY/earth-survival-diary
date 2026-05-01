const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SOURCE = path.join(ROOT, 'build', 'icon-256.png')
const OUTPUT = path.join(ROOT, 'build', 'icon.ico')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

async function main() {
    const pngs = await Promise.all(SIZES.map(size =>
        sharp(SOURCE).resize(size, size).png().toBuffer()
    ))

    const header = Buffer.alloc(6 + 16 * SIZES.length)
    header.writeUInt16LE(0, 0)
    header.writeUInt16LE(1, 2)
    header.writeUInt16LE(SIZES.length, 4)

    let offset = header.length
    const chunks = []

    for (let i = 0; i < SIZES.length; i++) {
        const size = SIZES[i]
        const buf = pngs[i]
        const entry = i * 16 + 6
        const w = size >= 256 ? 0 : size
        header.writeUInt8(w, entry)
        header.writeUInt8(w, entry + 1)
        header.writeUInt8(0, entry + 2)
        header.writeUInt8(0, entry + 3)
        header.writeUInt16LE(1, entry + 4)
        header.writeUInt16LE(32, entry + 6)
        header.writeUInt32LE(buf.length, entry + 8)
        header.writeUInt32LE(offset, entry + 12)
        chunks.push(buf)
        offset += buf.length
    }

    fs.writeFileSync(OUTPUT, Buffer.concat([header, ...chunks]))
    console.log(`icon.ico created (${SIZES.length} sizes)`)
}

main().catch(e => { console.error(e); process.exit(1) })
