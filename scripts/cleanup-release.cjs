const { readdirSync, rmSync, statSync, existsSync } = require('fs')
const { join } = require('path')

const dir = 'release'
if (!existsSync(dir)) process.exit(0)

const keepFile = '地球 Online 生存日记 Setup 1.0.0.exe'

readdirSync(dir).forEach(f => {
  const p = join(dir, f)
  const s = statSync(p)
  if (s.isFile() && f !== keepFile) rmSync(p)
  if (s.isDirectory() && f.startsWith('.')) rmSync(p, { recursive: true })
  if (s.isDirectory() && f === 'win-unpacked') rmSync(p, { recursive: true })
})
