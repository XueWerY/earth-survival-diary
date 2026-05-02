const fs = require('fs')
const path = require('path')

const RELEASE_DIR = path.join(__dirname, '..', 'release')

if (!fs.existsSync(RELEASE_DIR)) {
  console.error('release/ directory not found. Run build first: npm run electron:build:win')
  process.exit(1)
}

const files = fs.readdirSync(RELEASE_DIR).filter(f => {
  return f.endsWith('.exe') || f.endsWith('.blockmap') || f === 'latest.yml'
})

console.log('Release files in release/:')
for (const f of files) {
  console.log('  ' + f)
}

const version = require('../package.json').version
const exeFile = files.find(f => f.endsWith('.exe') && f.includes(version))
const blockmapFile = files.find(f => f.endsWith('.blockmap') && f.includes(version))
const tag = 'v' + version

console.log('\n--- Publish steps ---')
console.log('1. Run fix-latest-yml to update URLs:')
console.log('     node scripts/fix-latest-yml.cjs')
console.log('')
console.log('2. Create GitHub Release at:')
console.log('     https://github.com/firefly3/earth-survival-diary/releases/new')
console.log('   Tag: ' + tag)
console.log('   Upload: release/' + exeFile)
if (blockmapFile) console.log('   Upload: release/' + blockmapFile)
console.log('')
console.log('3. Commit and push latest.yml:')
console.log('     git add release/latest.yml')
console.log('     git commit -m "release: v' + version + '"')
console.log('     git push')
