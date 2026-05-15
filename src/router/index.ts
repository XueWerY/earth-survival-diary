import { createRouter, createWebHashHistory } from 'vue-router'
import { logger } from '../lib/logger'
import TaskList from '../components/TaskList.vue'
import FocusTimer from '../components/FocusTimer.vue'
import MissionList from '../components/MissionList.vue'
import CountdownList from '../components/CountdownList.vue'
import CourseSchedule from '../components/CourseSchedule.vue'
import NotesPage from '../components/NotesPage.vue'
import StatisticsPage from '../components/StatisticsPage.vue'
import ProfilePage from '../components/ProfilePage.vue'

const routes = [
  { path: '/', redirect: '/footprint' },
  { path: '/footprint', name: 'footprint', component: TaskList },
  { path: '/focus', name: 'focus', component: FocusTimer },
  { path: '/mission', name: 'mission', component: MissionList },
  { path: '/countdown', name: 'countdown', component: CountdownList },
  { path: '/course', name: 'course', component: CourseSchedule },
  { path: '/notes', name: 'notes', component: NotesPage },
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