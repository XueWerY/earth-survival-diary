const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const releaseRoot = path.join(projectRoot, 'release')
const projectPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
const serverPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'server', 'package.json'), 'utf8'))
const outputRoot = path.join(releaseRoot, `server-${projectPackage.version}`)

const files = [
  ['server/index.cjs', 'server/index.cjs'],
  ['server/README.md', 'README.md'],
  ['server/prod-server.cjs', 'server/prod-server.cjs'],
  ['server/lib/logger.cjs', 'server/lib/logger.cjs'],
  ['server/lib/_pretty-stream.cjs', 'server/lib/_pretty-stream.cjs'],
  ['server/lib/yaml-store.cjs', 'server/lib/yaml-store.cjs'],
  ['server/lib/notes-migration.cjs', 'server/lib/notes-migration.cjs']
]

const resolvedOutput = path.resolve(outputRoot)
if (!resolvedOutput.toLowerCase().startsWith(`${path.resolve(releaseRoot).toLowerCase()}${path.sep}`)) {
  throw new Error('服务端包输出路径必须位于 release 目录中')
}
if (fs.existsSync(resolvedOutput)) {
  throw new Error(`服务端包已存在，为避免覆盖请先移走或删除：${resolvedOutput}`)
}

for (const [sourcePath] of files) {
  const absoluteSource = path.join(projectRoot, sourcePath)
  if (!fs.existsSync(absoluteSource)) throw new Error(`缺少服务端文件：${sourcePath}`)
}

serverPackage.version = projectPackage.version

fs.mkdirSync(resolvedOutput, { recursive: true })
for (const [sourcePath, targetPath] of files) {
  const source = path.join(projectRoot, sourcePath)
  const target = path.join(resolvedOutput, targetPath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
}

fs.writeFileSync(
  path.join(resolvedOutput, 'package.json'),
  `${JSON.stringify(serverPackage, null, 2)}\n`,
  'utf8'
)

console.log(`服务端独立包已生成：${path.relative(projectRoot, resolvedOutput)}`)
console.log(`仅包含 ${files.length} 个服务端源文件及精简依赖清单；未包含客户端源码、桌面主进程、YAML 数据目录或依赖目录。`)
