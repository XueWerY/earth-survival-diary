/**
 * 插件打包脚本
 * 用法：node build-plugin.cjs <插件目录>
 *
 * 用 esbuild 将每个工具的 index.vue 打包为单文件 ESM 产物（dist/<toolId>.js）：
 * - @vue/compiler-sfc 负责 SFC 编译（script/template/style），esbuild 负责打包与 TS 剥离
 * - 共享依赖（vue/pinia/应用内部模块等）不打包进产物，
 *   统一改写为 window.__ESD_BRIDGE__ 引用（渲染端 src/lib/pluginBridge.ts 暴露）
 * - 插件可引用的模块受白名单约束（BARE_BRIDGE / SRC_BRIDGE），新增依赖需两端同步登记
 */
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const esbuild = require('esbuild')
const sfc = require('@vue/compiler-sfc')

// 渲染端桥接对象 window.__ESD_BRIDGE__ 的键白名单
// 键的来源：裸导入直接用模块名；应用内部导入用相对 src/ 的路径（.ts/.js 扩展名省略，.vue 保留）
const BARE_BRIDGE = new Set([
  'vue', 'pinia', 'element-plus', '@element-plus/icons-vue',
  'dayjs', 'qrcode', 'jsqr',
  '@capacitor/core', '@capacitor/filesystem',
])
const SRC_BRIDGE = new Set([
  'lib/logger', 'lib/api', 'services/storageService',
  'stores/settingsStore', 'stores/focusStore', 'stores/listStore',
  'components/ui/BaseDialog.vue', 'components/common/overlay/ConfirmDialog.vue',
])

function genPlaceholderToolJs(toolName) {
  // 占位组件使用 render 函数（运行时 Vue 无模板编译器，template 选项无法渲染）
  return `const __h = (typeof window !== 'undefined' && window.__ESD_BRIDGE__ && window.__ESD_BRIDGE__.vue && window.__ESD_BRIDGE__.vue.h) || function () { return null }
export default { render() { return __h('div', { style: 'padding:20px;text-align:center;color:#999' }, '${toolName} 编译失败，请查看应用日志') } }
`
}

/** 把共享依赖改写为 window.__ESD_BRIDGE__ 引用的 esbuild 插件 */
function makeBridgePlugin(pluginDir) {
  const pluginDirName = path.basename(pluginDir)
  return {
    name: 'esd-bridge',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const spec = args.path
        if (args.kind === 'entry-point') return null

        if (!spec.startsWith('.')) {
          if (BARE_BRIDGE.has(spec)) return { path: spec, namespace: 'esdBridge' }
          throw new Error(`插件依赖了未桥接的模块: ${spec}（需加入桥接白名单）`)
        }

        // 相对导入：按"插件位于 src/plugins/<目录名>"的虚拟布局解析，
        // 与应用开发模式（Vite glob src/plugins/）保持一致的解析结果
        const importerDir = path.dirname(args.importer)
        const relToPlugin = path.relative(pluginDir, importerDir).split(path.sep).join('/')
        const virtualDir = path.posix.join('src/plugins', pluginDirName, relToPlugin)
        const virtualResolved = path.posix.normalize(path.posix.join(virtualDir, spec))

        if (virtualResolved.startsWith('src/plugins/')) return null // 插件内部文件，走默认解析
        if (!virtualResolved.startsWith('src/')) {
          throw new Error(`插件导入了 src 之外的路径: ${spec}`)
        }
        let key = virtualResolved.slice('src/'.length)
        key = key.replace(/\.(ts|js)$/, '')
        if (!SRC_BRIDGE.has(key)) {
          throw new Error(`插件导入了未桥接的应用模块: ${key}（需加入桥接白名单）`)
        }
        return { path: key, namespace: 'esdBridge' }
      })

      build.onLoad({ filter: /.*/, namespace: 'esdBridge' }, (args) => ({
        // CJS 形式：esbuild 打包时自动做 ESM 互操作，具名/默认导入均可工作
        contents: `module.exports = window.__ESD_BRIDGE__[${JSON.stringify(args.path)}]`,
        loader: 'js',
      }))
    },
  }
}

/** 编译 .vue SFC 的 esbuild 插件（script + template + style 注入） */
const vueSfcPlugin = {
  name: 'vue-sfc',
  setup(build) {
    build.onLoad({ filter: /\.vue$/ }, (args) => {
      const source = fs.readFileSync(args.path, 'utf-8')
      const { descriptor, errors } = sfc.parse(source, { filename: args.path })
      if (errors.length) {
        throw new Error(`SFC 解析失败: ${errors.map(e => e.message).join('; ')}`)
      }

      const scopeId = 'data-v-' + crypto.createHash('md5').update(args.path).digest('hex').slice(0, 8)
      let scriptContent = ''

      if (descriptor.scriptSetup) {
        // script setup：inlineTemplate 自动合并渲染函数并正确处理绑定
        scriptContent = sfc.compileScript(descriptor, {
          id: scopeId,
          inlineTemplate: !!descriptor.template,
        }).content
      } else {
        scriptContent = descriptor.script
          ? sfc.compileScript(descriptor, { id: scopeId }).content
          : ''
        if (descriptor.template) {
          const tpl = sfc.compileTemplate({
            source: descriptor.template.content,
            filename: args.path,
            id: scopeId,
            compilerOptions: { mode: 'module' },
          })
          if (tpl.errors.length) {
            throw new Error(`模板编译失败: ${tpl.errors.map(e => e.message).join('; ')}`)
          }
          scriptContent += '\n' + tpl.code.replace(/export\s+function\s+render/, 'function render')
          scriptContent += '\n_sfc_main.render = render'
        }
        if (!scriptContent.trim()) scriptContent = 'const _sfc_main = {}'
      }

      // 统一改写默认导出，便于附加 __scopeId
      scriptContent = scriptContent.replace(/export\s+default(?![\s\S]*export\s+default)/, 'const _sfc_main =')
      if (descriptor.styles.some(s => s.scoped)) {
        scriptContent += `\n_sfc_main.__scopeId = '${scopeId}'`
      }
      scriptContent += '\nexport default _sfc_main\n'

      // 样式：编译后随模块加载注入 <style>
      let css = ''
      for (const style of descriptor.styles) {
        const res = sfc.compileStyle({
          source: style.content,
          filename: args.path,
          id: scopeId,
          scoped: !!style.scoped,
        })
        if (res.errors.length) {
          throw new Error(`样式编译失败: ${res.errors.map(e => e.message).join('; ')}`)
        }
        css += res.code + '\n'
      }
      if (css.trim()) {
        scriptContent = `const __pluginCss = ${JSON.stringify(css)}
if (typeof document !== 'undefined') { const __styleEl = document.createElement('style'); __styleEl.textContent = __pluginCss; document.head.appendChild(__styleEl) }
` + scriptContent
      }

      return { contents: scriptContent, loader: 'ts', resolveDir: path.dirname(args.path) }
    })
  },
}

async function compilePlugin(pluginDir, outputDir) {
  const pluginJsonPath = path.join(pluginDir, 'plugin.json')
  if (!fs.existsSync(pluginJsonPath)) {
    console.error(`[build-plugin] 缺少 plugin.json: ${pluginJsonPath}`)
    return false
  }

  const manifest = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'))
  const { tools: toolsMeta = {}, name, version } = manifest

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  for (const toolId of Object.keys(toolsMeta)) {
    const outPath = path.join(outputDir, `${toolId}.js`)
    const vueFile = path.join(pluginDir, 'tools', toolId, 'index.vue')

    if (!fs.existsSync(vueFile)) {
      console.warn(`[build-plugin] 跳过不存在的组件: ${vueFile}`)
      fs.writeFileSync(outPath, genPlaceholderToolJs(toolId), 'utf-8')
      continue
    }

    try {
      await esbuild.build({
        entryPoints: [vueFile],
        bundle: true,
        format: 'esm',
        target: 'es2020',
        outfile: outPath,
        logLevel: 'silent',
        plugins: [makeBridgePlugin(pluginDir), vueSfcPlugin],
      })
    } catch (e) {
      // GUI 模式下 console.error 不可见，落盘到 PLUGINS_DIR 旁的 bundler-errors.log 便于排障
      const errLog = path.join(path.dirname(pluginDir), 'bundler-errors.log')
      const lines = (e.errors || []).flat().map(x => x.text || (x.location && `${x.location.file}:${x.location.line} ${x.location.lineText}`) || JSON.stringify(x)).concat([e.message, e.stack && e.stack.split('\n').slice(0, 3).join('\n')].filter(Boolean))
      fs.appendFileSync(errLog, `\n[${new Date().toISOString()}] ${toolId}: ${e.message}\n${lines.join('\n')}\n`, 'utf-8')
      console.error(`[build-plugin] 工具打包失败 ${toolId}: ${e.message}`)
      fs.writeFileSync(outPath, genPlaceholderToolJs(toolId), 'utf-8')
    }
  }

  console.log(`[build-plugin] ${name} v${version} 打包完成 (${Object.keys(toolsMeta).length} 个工具)`)
  return true
}

module.exports = { compilePlugin }

// CLI（仅在直接运行时执行，被 require 时不执行）
if (require.main === module) {
  const pluginDir = process.argv[2]
  if (!pluginDir) {
    console.error('用法: node build-plugin.cjs <插件目录>')
    process.exit(1)
  }
  const outputDir = path.join(pluginDir, 'dist')
  compilePlugin(pluginDir, outputDir)
    .then(ok => process.exit(ok ? 0 : 1))
    .catch(() => process.exit(1))
}
