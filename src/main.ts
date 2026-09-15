import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { logger } from './lib/logger'
import './lib/pluginBridge'

logger.info('应用启动')

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(ElementPlus, {
    locale: zhCn,
})
app.use(router)
app.mount('#app')