import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

function fixVueuseCore(): Plugin {
  return {
    name: 'fix-vueuse-core',
    transform(code, id) {
      if (id.includes('@vueuse/core/dist/index.js')) {
        return code
          .replace(
            '/* #__PURE__ */\nconst events = /* @__PURE__ */ new Map()',
            'const events = /* @__PURE__ */ new Map()'
          )
          .replace(
            'const defaultState = (/* #__PURE__ */ {',
            'const defaultState = ({'
          )
      }
    }
  }
}

export default defineConfig({
  base: './',
  // 主窗口与速记窗口分别作为 HTML 入口；Electron 正式版直接从 dist 加载。
  input: {
    main: path.resolve(__dirname, 'index.html'),
    quickCapture: path.resolve(__dirname, 'quick-capture.html')
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  plugins: [vue(), fixVueuseCore(), {
    name: 'version-inline',
    resolveId(id) {
      if (id === 'virtual:version') return id
      return null
    },
    load(id) {
      if (id === 'virtual:version') {
        const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
        return `export default ${JSON.stringify(pkg.version)}`
      }
      return null
    }
  } as Plugin]
})
