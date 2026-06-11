import { createRouter, createWebHashHistory } from 'vue-router'
import { defineAsyncComponent } from 'vue'
import { logger } from '../lib/logger'
import { getPluginPageOverride } from '../lib/pluginLoader'

const defaultTaskList = () => import('../components/footprint/TaskList.vue')
const defaultFocusTimer = () => import('../components/focus/FocusTimer.vue')
const defaultListPage = () => import('../components/list/ListPage.vue')
const defaultCountdownList = () => import('../components/countdown/CountdownList.vue')
const defaultCourseSchedule = () => import('../components/course/CourseSchedule.vue')
const defaultStatisticsPage = () => import('../components/statistics/StatisticsPage.vue')
const defaultToolboxPage = () => import('../components/toolbox/ToolboxPage.vue')
const defaultProfilePage = () => import('../components/profile/ProfilePage.vue')

const pageComponentNames: Record<string, string> = {
  footprint: 'TaskList',
  focus: 'FocusTimer',
  list: 'ListPage',
  countdown: 'CountdownList',
  course: 'CourseSchedule',
  statistics: 'StatisticsPage',
  toolbox: 'ToolboxPage',
  profile: 'ProfilePage',
}

const defaultLoaders: Record<string, () => Promise<any>> = {
  footprint: defaultTaskList,
  focus: defaultFocusTimer,
  list: defaultListPage,
  countdown: defaultCountdownList,
  course: defaultCourseSchedule,
  statistics: defaultStatisticsPage,
  toolbox: defaultToolboxPage,
  profile: defaultProfilePage,
}

function resolveComponent(routeName: string) {
  const componentName = pageComponentNames[routeName]
  if (componentName) {
    const override = getPluginPageOverride(componentName)
    if (override) {
      logger.info(`[Router] 使用插件页面覆盖: ${componentName}`)
      return defineAsyncComponent(override)
    }
  }
  const loader = defaultLoaders[routeName]
  if (loader) {
    return defineAsyncComponent(loader)
  }
  return undefined
}

const routes = [
  { path: '/', redirect: '/footprint' },
  { path: '/footprint', name: 'footprint', component: resolveComponent('footprint') },
  { path: '/focus', name: 'focus', component: resolveComponent('focus') },
  { path: '/list', name: 'list', component: resolveComponent('list') },
  { path: '/countdown', name: 'countdown', component: resolveComponent('countdown') },
  { path: '/course', name: 'course', component: resolveComponent('course') },
  { path: '/statistics', name: 'statistics', component: resolveComponent('statistics') },
  { path: '/toolbox', name: 'toolbox', component: resolveComponent('toolbox') },
  { path: '/profile', name: 'profile', component: resolveComponent('profile') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, from) => {
  if (from.name) {
    logger.info(`[Router] 路由切换: ${String(from.name)} → ${String(to.name)}`)
  }
})

export default router