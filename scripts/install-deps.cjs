const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const MODULES_DIR = path.join(__dirname, '..', 'electron', 'node_modules')

if (fs.existsSync(MODULES_DIR)) {
  fs.rmSync(MODULES_DIR, { recursive: true, force: true })
}

execSync(`npm install --prefix "${path.join(__dirname, '..', 'electron')}" express@4 cors --no-audit --no-fund --no-save --loglevel=error --omit=dev`, {
  stdio: 'inherit'
})

fs.writeFileSync(path.join(__dirname, '..', 'electron', '.deps-ok'), '1')
console.log('Dependencies installed to electron/node_modules')
