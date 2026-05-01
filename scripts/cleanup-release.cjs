const { readdirSync, rmSync, statSync, existsSync } = require('fs')
const { join } = require('path')

const dir = 'release'
if (!existsSync(dir)) process.exit(0)

const keepFiles = ['latest.yml']
const keepExts = ['.exe', '.blockmap']

readdirSync(dir).forEach(f => {
  const p = join(dir, f)
  const s = statSync(p)
  if (s.isFile() && !keepFiles.includes(f) && !keepExts.some(ext => f.endsWith(ext))) rmSync(p)
  if (s.isDirectory() && f.startsWith('.')) rmSync(p, { recursive: true })
  if (s.isDirectory() && f === 'win-unpacked') rmSync(p, { recursive: true })
})
