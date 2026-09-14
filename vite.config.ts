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
  // 开发模式配置：dev server 提供前端 HMR，/api 转发到 Electron 内置 Express 服务。
  // 仅 `vite` dev 生效，`vite build` 忽略该键，不影响生产构建。
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:5000'
    }
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
