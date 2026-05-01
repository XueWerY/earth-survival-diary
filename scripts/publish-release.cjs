const fs = require('fs')
const path = require('path')

const RELEASE_DIR = path.join(__dirname, '..', 'release')
const STAGING_DIR = path.join(__dirname, '..', 'release-staging')

if (!fs.existsSync(RELEASE_DIR)) {
  console.error('release/ directory not found. Run build first: npm run electron:build:win')
  process.exit(1)
}

if (fs.existsSync(STAGING_DIR)) fs.rmSync(STAGING_DIR, { recursive: true, force: true })
fs.mkdirSync(STAGING_DIR)

const files = fs.readdirSync(RELEASE_DIR).filter(f => {
  return f.endsWith('.exe') || f.endsWith('.blockmap') || f === 'latest.yml'
})

for (const f of files) {
  fs.copyFileSync(path.join(RELEASE_DIR, f), path.join(STAGING_DIR, f))
  console.log('  ' + f)
}

console.log(`\nCopied ${files.length} files to release-staging/`)
console.log('\n--- Manual upload steps ---')
console.log('1. Create a public repo on Gitee (e.g., earth-survival-diary-releases)')
console.log('2. Clone it locally')
console.log('3. Copy release-staging/* into the repo\'s releases/ directory')
console.log('4. Commit and push:')
console.log('     git add releases/ && git commit -m "Release vX.X.X" && git push')
console.log('5. Update package.json "publish.url" to:')
console.log('     https://gitee.com/YOUR_USERNAME/YOUR_REPO/raw/main/releases/')
console.log('6. Rebuild the app with the updated URL')
