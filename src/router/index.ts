import { createRouter, createWebHashHistory } from 'vue-router'
import { logger } from '../lib/logger'
import TaskList from '../components/footprint/TaskList.vue'
import FocusTimer from '../components/focus/FocusTimer.vue'
import MissionList from '../components/mission/MissionList.vue'
import CountdownList from '../components/countdown/CountdownList.vue'
import CourseSchedule from '../components/course/CourseSchedule.vue'
import StatisticsPage from '../components/statistics/StatisticsPage.vue'
import ProfilePage from '../components/profile/ProfilePage.vue'

const routes = [
  { path: '/', redirect: '/footprint' },
  { path: '/footprint', name: 'footprint', component: TaskList },
  { path: '/focus', name: 'focus', component: FocusTimer },
  { path: '/mission', name: 'mission', component: MissionList },
  { path: '/countdown', name: 'countdown', component: CountdownList },
  { path: '/course', name: 'course', component: CourseSchedule },
  { path: '/statistics', name: 'statistics', component: StatisticsPage },
  { path: '/profile', name: 'profile', component: ProfilePage },
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