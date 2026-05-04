import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [vue(), {
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
