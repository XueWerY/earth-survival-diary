const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SOURCE_ROOT = path.join(ROOT, 'src', 'plugins')
const OUTPUT_ROOT = path.resolve(ROOT, 'build', 'default-plugins')
const COMPILED_TAG = 'esbuild-v3'
const BUNDLED_PLUGIN_IDS = ['file-manager']

if (!OUTPUT_ROOT.startsWith(ROOT + path.sep)) {
  throw new Error('Default plugin output directory must remain inside the project')
}

fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true })
fs.mkdirSync(OUTPUT_ROOT, { recursive: true })

for (const pluginId of BUNDLED_PLUGIN_IDS) {
  const sourceDir = path.join(SOURCE_ROOT, pluginId)
  const outputDir = path.join(OUTPUT_ROOT, pluginId)
  const manifestPath = path.join(sourceDir, 'plugin.json')
  const distDir = path.join(sourceDir, 'dist')
  const toolsDir = path.join(sourceDir, 'tools')

  if (!fs.existsSync(manifestPath) || !fs.existsSync(distDir) || !fs.existsSync(toolsDir)) {
    throw new Error(`Bundled plugin is missing its manifest, compiled output, or source tools: ${pluginId}`)
  }

  fs.mkdirSync(outputDir, { recursive: true })
  fs.copyFileSync(manifestPath, path.join(outputDir, 'plugin.json'))
  fs.cpSync(toolsDir, path.join(outputDir, 'tools'), { recursive: true })
  fs.cpSync(distDir, path.join(outputDir, 'dist'), { recursive: true })
  fs.writeFileSync(path.join(outputDir, 'dist', '.compiled'), COMPILED_TAG, 'utf-8')
}

console.log(`Prepared ${BUNDLED_PLUGIN_IDS.length} bundled default plugin(s).`)
