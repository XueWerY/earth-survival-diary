import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'
import { logger } from './lib/logger'

// 初始化日志系统
logger.info('应用启动')

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(ElementPlus, {
    locale: zhCn,
})
app.mount('#app')
