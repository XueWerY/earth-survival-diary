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

console.log('\n--- Publish steps ---')
console.log('git add release/latest.yml "release/' + files.find(f => f.endsWith('.exe')) + '"')
console.log('git commit -m "release: v' + require('../package.json').version + '"')
console.log('git push')
