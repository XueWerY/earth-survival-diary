const fs = require('fs')
const path = require('path')
const pkg = require('../package.json')

const latestPath = path.join(__dirname, '..', 'release', 'latest.yml')
if (!fs.existsSync(latestPath)) {
  console.error('latest.yml not found, run build first')
  process.exit(1)
}

let content = fs.readFileSync(latestPath, 'utf-8')
const version = pkg.version
const baseUrl = `https://gitee.com/firefly3/earth-survival-diary/raw/master/release`

const exeFile = content.match(/path: (.+)/)[1]
const encodedFile = encodeURIComponent(exeFile)

content = content.replace(/^path: .+$/m, `path: ${baseUrl}/${encodedFile}`)
content = content.replace(/^(  - url: ).+$/m, `$1${baseUrl}/${encodedFile}`)

fs.writeFileSync(latestPath, content)
console.log('Updated latest.yml with Gitee Releases URLs')
console.log('  version: ' + version)
console.log('  exe: ' + encodedFile)
