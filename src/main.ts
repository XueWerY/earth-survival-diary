import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'
import ChildFormApp from './ChildFormApp.vue'
import router from './router'
import { logger } from './lib/logger'

const urlParams = new URLSearchParams(window.location.search)
const isChildForm = urlParams.get('childForm') !== null

if (!isChildForm) {
  logger.info('应用启动')
}

const app = createApp(isChildForm ? ChildFormApp : App)
const pinia = createPinia()

app.use(pinia)
app.use(ElementPlus, {
    locale: zhCn,
})
if (!isChildForm) {
  app.use(router)
}
app.mount('#app')