<template>
  <div class="app-container">
    <!-- 星空背景 - 始终存在但通过 CSS 控制显示 -->
    <canvas ref="starCanvas" class="star-canvas" :class="{ 'canvas-hidden': !showStarCanvas }"></canvas>

    <!-- 未登录时显示登录页面 -->
    <template v-if="!authStore.isAuthenticated && !authStore.loading">
      <AuthPage @success="handleAuthSuccess" />
    </template>

    <!-- 加载中（认证中或数据加载中） -->
    <template v-else-if="authStore.loading || !dataInitialized">
      <div class="loading-container">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p class="loading-text">{{ authStore.loading ? '验证身份中...' : '加载数据中...' }}</p>
        </div>
      </div>
    </template>

    <!-- 已登录且数据加载完成，显示主界面 -->
    <template v-else>
      <!-- 主导航栏 - Electron 端在顶部 -->
      <div v-if="isElectron" class="main-nav-bar" :class="{ 'nav-hidden': isFocusFullscreen }">
        <div class="nav-items-scroll" ref="navScrollRef">
          <button
            v-for="m in MODULES"
            :key="m"
            class="nav-item"
            :class="{ active: pageNav.currentModule.value === m }"
            @click="navigateTo(m)"
          >
            <span class="nav-item-icon">{{ MODULE_ICONS[m] }}</span>
            <span class="nav-item-label">{{ MODULE_LABELS[m] }}</span>
          </button>
        </div>
      </div>

      

      <!-- 主内容区域 -->
      <main class="main-content">
        <div class="panel-wrapper">
          <router-view v-slot="{ Component }">
            <template v-if="Component">
              <component
                :is="Component"
                :key="`${String($route.name)}-${userKey}`"
                @fullscreen-change="handleFullscreenFromRoute"
                @logout="handleLogout"
                @refreshData="handleRefreshData"
                @profile-updated="handleProfileUpdated"
              />
            </template>
            <div v-else class="empty-state">
              <p>组件未找到: {{ $route.name }}</p>
            </div>
          </router-view>
        </div>
      </main>

      <GuideOverlay
        :steps="guideSteps"
        :visible="guideVisible"
        :current-index="guideCurrentIndex"
        @prev="handleGuidePrev"
        @next="handleGuideNext"
        @skip="handleGuideSkip"
      />

      <!-- 版本更新右下角面板 -->
      <template v-if="!guideVisible">
      <div v-if="updateDialogVisible" class="update-panel">
        <div class="update-panel-header">
          <span class="update-panel-title">版本更新</span>
          <button class="update-panel-close" @click="updateDialogVisible = false">&times;</button>
        </div>
        <div class="update-panel-body">
          <div
            class="update-status"
            :class="{ 'update-error': updateStatus === 'error', 'update-no-new': updateStatus === 'no-update' }"
          >
            <span v-if="updateStatus === 'available'">
              发现新版本 v{{ updateVersion }}，请前往
              <a class="update-link" href="#" @click.prevent="openReleasesUrl">GitHub Releases</a>
              下载
            </span>
            <template v-else>{{ updateStatusText }}</template>
          </div>
          <div v-if="updateStatus === 'error' && updateMessage" class="update-message">
            {{ updateMessage }}
          </div>
        </div>
      </div>

      <div v-if="showAppChangelogDialog" class="changelog-panel">
        <div class="changelog-panel-header">
          <span class="changelog-panel-title">更新日志</span>
          <button class="changelog-panel-close" @click="showAppChangelogDialog = false">&times;</button>
        </div>
        <div class="changelog-panel-body" v-html="appChangelogHtml"></div>
      </div>
      </template>
      <div class="reminder-stack">
        <div v-for="(r, i) in activeReminders" :key="r.id" class="reminder-panel">
          <div class="reminder-panel-header">
            <span class="reminder-panel-icon">🔔</span>
            <button class="reminder-panel-close" @click="dismissReminder(i)">✕</button>
          </div>
          <div class="reminder-panel-content">
            <div class="reminder-panel-title">{{ r.name }}</div>
            <div v-if="r.listName || r.groupName" class="reminder-panel-subtitle">{{ [r.listName, r.groupName].filter(Boolean).join(' / ') }}</div>
            <div class="reminder-panel-body">{{ r.body }}</div>
          </div>
        </div>
      </div>

      <!-- 主导航栏 - Android 端在底部 -->
      <div v-if="!isElectron" class="main-nav-bar nav-bar-bottom" :class="{ 'nav-hidden': isFocusFullscreen }">
        <div class="nav-items-scroll" ref="navScrollRefMobile">
          <button
            v-for="m in MODULES"
            :key="m"
            class="nav-item"
            :class="{ active: pageNav.currentModule.value === m }"
            @click="navigateTo(m)"
          >
            <span class="nav-item-icon">{{ MODULE_ICONS[m] }}</span>
            <span class="nav-item-label">{{ MODULE_LABELS[m] }}</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick, provide, onErrorCaptured } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AuthPage from './components/auth/AuthPage.vue'
import { useTaskStore } from './stores/taskStore'
import { useMissionStore } from './stores/missionStore'
import { useAuthStore } from './stores/authStore'
import { useSettingsStore } from './stores/settingsStore'
import { useFocusStore } from './stores/focusStore'
import { getData, setData, preloadData, clearCache, getSystemStateField, setSystemStateField } from './services/storageService'
import { logger } from './lib/logger'
import { usePageNav, MODULES, MODULE_ICONS, MODULE_LABELS, MODULE_ROUTES } from './composables/usePageNav'
import dayjs from 'dayjs'
// @ts-expect-error - Vite raw import
import changelogContent from '../CHANGELOG.md?raw'
import GuideOverlay from './components/common/overlay/GuideOverlay.vue'
import { guideSteps } from './data/guideSteps'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()

const VALID_ROUTES = ['footprint', 'focus', 'mission', 'countdown', 'course', 'statistics', 'toolbox', 'profile']
const MAX_SCHEDULE_DELAY = 20 * 24 * 3600 * 1000

const pageNav = usePageNav()

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electronAPI)

const navScrollRef = ref<HTMLElement | null>(null)
const navScrollRefMobile = ref<HTMLElement | null>(null)

const scrollNavToActive = () => {
  nextTick(() => {
    const container = navScrollRef.value || navScrollRefMobile.value
    if (!container) return
    const activeItem = container.querySelector('.nav-item.active') as HTMLElement
    if (!activeItem) return
    const containerWidth = container.clientWidth
    const itemLeft = activeItem.offsetLeft
    const itemWidth = activeItem.offsetWidth
    container.scrollTo({ left: itemLeft - containerWidth / 2 + itemWidth / 2, behavior: 'smooth' })
  })
}

watch(() => pageNav.currentModule.value, scrollNavToActive)

const navigateTo = (module: string) => {
  if (module === pageNav.currentModule.value) {
    pageNav.setNavPath([module])
  } else {
    pageNav.setNavPath([module])
    pageNav.setNavContext({ segments: [], plusVisible: false, plusOnClick: null, goModuleHome: () => {} })
    router.push(MODULE_ROUTES[module])
  }
}

const taskStore = useTaskStore()
const missionStore = useMissionStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const focusStore = useFocusStore()

// 星星画布显示条件
const showStarCanvas = computed(() => {
  return authStore.isAuthenticated
})

// 数据是否已初始化
const dataInitialized = ref(false)
const isInitializing = ref(false)
const userKey = ref(0)

onErrorCaptured((err, instance, info) => {
  logger.error('[App] onErrorCaptured 捕获错误', { error: err instanceof Error ? err.message : String(err), info })
  return false
})

// 认证成功处理
const handleAuthSuccess = () => {
  logger.info('[App] 登录/注册成功，准备刷新页面')
  // 直接刷新页面，确保所有状态完全重置
  window.location.reload()
}

// 登出处理
const handleLogout = async () => {
  logger.info('[App] 用户退出登录')
  if (window.electronAPI?.cancelAllReminders) {
    window.electronAPI.cancelAllReminders()
  }
  // 重置所有 store 状态
  taskStore.reset()
  missionStore.reset()
  focusStore.reset()
  settingsStore.reset()
  // 清除所有缓存数据
  clearCache()
  dataInitialized.value = false
  isInitializing.value = false
  // 更新用户标识，强制 keep-alive 组件重新渲染
  userKey.value++
}

const handleRefreshData = async () => {
  logger.info('[App] 刷新数据')
  clearCache()
  dataInitialized.value = false
  isInitializing.value = false
  userKey.value++
  await nextTick()
  await initializeData()
}

const handleProfileUpdated = async () => {
  logger.info('[App] 个人资料更新，同步倒数日数据')
  await preloadCountdownData()
}

const cleanUpCourseAutoRecordedTasks = async () => {
  try {
    const taskStore = useTaskStore()
    const courseTasks = taskStore.tasks.filter((t: any) => t.category === 'course')
    if (courseTasks.length > 0) {
      for (const t of courseTasks) {
        await taskStore.deleteTask(t.id)
      }
      logger.info('[App] 已清理课程自动记录的足迹数据', { count: courseTasks.length })
    }
  } catch (e) {
    logger.error('[App] 清理课程足迹数据失败', { error: e instanceof Error ? e.message : String(e) })
  }
}

const showAppChangelogDialog = ref(false)

const activeReminders = ref<ReminderItem[]>([])

function playReminderSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const notes = [800, 1000, 1200]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.2)
    })
  } catch (e) {
    logger.warn('[提醒] 音效播放失败', { error: e instanceof Error ? e.message : String(e) })
  }
}

function dismissReminder(index: number) {
  logger.info('[提醒] 用户关闭提醒', { id: activeReminders.value[index]?.id })
  activeReminders.value.splice(index, 1)
}

const appChangelogHtml = computed(() => {
  const content = changelogContent.replace(/^# 更新日志\n*/, '')
  const lines = content.split('\n')
  let html = ''
  let inList = false
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false }
      html += `<h3 class="cl-version">${line.slice(4)}</h3>`
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul class="cl-list">'; inList = true }
      html += `<li>${line.slice(2)}</li>`
    } else if (!line.trim()) {
      if (inList) { html += '</ul>'; inList = false }
    }
  }
  if (inList) html += '</ul>'
  return html
})

// 版本更新对话框状态
const updateDialogVisible = ref(false)
const updateStatus = ref<'checking' | 'available' | 'error' | 'no-update'>('checking')
const updateVersion = ref('')
const updateMessage = ref('')
const RELEASES_URL = 'https://github.com/XueWerY/earth-survival-diary/releases'

const updateStatusText = computed(() => {
  switch (updateStatus.value) {
    case 'checking': return '正在检查更新...'
    case 'error': return '更新检查失败'
    case 'no-update': return '已是最新版本'
    default: return ''
  }
})

let updateNoUpdateTimer: ReturnType<typeof setTimeout> | null = null

const openReleasesUrl = () => {
  logger.info('[App] 用户点击更新链接')
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(RELEASES_URL)
  }
}

const versionChecksStarted = ref(false)

const startVersionChecks = () => {
  if (versionChecksStarted.value) return
  versionChecksStarted.value = true
  logger.info('[更新] 开始版本检测')

  if (window.electronAPI?.checkVersionUpdate && authStore.user?.id) {
    window.electronAPI.checkVersionUpdate(authStore.user.id).then(async (result) => {
      if (result.isUpdated) {
        try {
          await setSystemStateField('version', result.newVersion)
          logger.info('[App] 检测到版本更新，已同步版本到前端', { oldVersion: result.oldVersion, newVersion: result.newVersion })
        } catch (e) {
          logger.warn('[App] 同步版本到前端失败', { error: e instanceof Error ? e.message : String(e) })
        }
        showAppChangelogDialog.value = true
      }
    }).catch(e => {
      console.error('[App] 版本更新检测失败:', e)
    })
  }

  setupUpdateStatusListener()
}

const setupUpdateStatusListener = () => {
  if (!window.electronAPI?.onUpdateStatus) return
  window.electronAPI.onUpdateStatus((data) => {
    logger.info('[App] 收到更新状态', data)
    if (data.status === 'available') {
      updateStatus.value = 'available'
      updateVersion.value = data.version || ''
      updateDialogVisible.value = true
    } else if (data.status === 'error') {
      updateStatus.value = 'error'
      updateMessage.value = data.message || ''
      updateDialogVisible.value = true
    } else if (data.status === 'no-update') {
      updateStatus.value = 'no-update'
      updateDialogVisible.value = true
      if (updateNoUpdateTimer) clearTimeout(updateNoUpdateTimer)
      updateNoUpdateTimer = setTimeout(() => {
        updateDialogVisible.value = false
      }, 1500)
    }
  })
}

const getNextOccurrence = (baseDate: string, strategy: string, customDays: number, from: dayjs.Dayjs): dayjs.Dayjs | null => {
  const base = dayjs(baseDate)
  let next = base

  if (!next.isBefore(from, 'day')) return next

  switch (strategy) {
    case 'daily':
      return from
    case 'weekdays': {
      let wd = from
      const dow = wd.day()
      if (dow === 0) wd = wd.add(1, 'day')
      else if (dow === 6) wd = wd.add(2, 'day')
      return wd
    }
    case 'weekly': {
      const baseDow = base.day()
      next = from
      while (next.day() !== baseDow) next = next.add(1, 'day')
      return next
    }
    case 'monthly':
      while (next.isBefore(from, 'day')) next = next.add(1, 'month')
      return next
    case 'yearly':
      while (next.isBefore(from, 'day')) next = next.add(1, 'year')
      return next
    case 'custom_days': {
      const diffDays = from.diff(base, 'day')
      const cd = customDays || 1
      const remainder = diffDays % cd
      return remainder === 0 ? from : from.add(cd - remainder, 'day')
    }
    default:
      return base
  }
}

const scheduleMissionReminders = async () => {
  if (!window.electronAPI?.scheduleReminders) return
  try {
    const now = dayjs()
    const today = now.startOf('day')
    const persistDuration = settingsStore.settings?.reminderPersistDuration ?? 30
    const reminders: { id: string; name: string; body: string; triggerTime: string; listName?: string; groupName?: string; repeatStrategy?: string; repeatCustomDays?: number; repeatEndStrategy?: string; repeatEndDate?: string; repeatCount?: number; repeatCompletedCount?: number; reminderStrategy?: string; reminderDays?: number; reminderHours?: number; reminderMinutes?: number; endTime?: string }[] = []

    const missions = missionStore.missions.filter(m => !m.completed && m.reminderStrategy !== 'none' && m.date)

    for (const m of missions) {
      let nextDate: dayjs.Dayjs

      if (m.repeatStrategy !== 'none') {
        const occ = getNextOccurrence(m.date, m.repeatStrategy, m.repeatCustomDays, today)
        if (!occ) continue
        if (m.repeatEndStrategy === 'date' && m.repeatEndDate && occ.isAfter(dayjs(m.repeatEndDate), 'day')) continue
        if (m.repeatEndStrategy === 'count' && m.repeatCount && m.repeatCompletedCount >= m.repeatCount) continue
        nextDate = occ
      } else {
        nextDate = dayjs(m.date)
      }

      const timeStr = m.endTime || '23:59'
      let triggerTime = dayjs(nextDate.format('YYYY-MM-DD') + 'T' + timeStr)
      if (m.reminderStrategy === 'advance') {
        const offsetMinutes = (m.reminderDays || 0) * 1440 + (m.reminderHours || 0) * 60 + (m.reminderMinutes || 0)
        triggerTime = triggerTime.subtract(offsetMinutes, 'minute')
      }

      if (triggerTime.valueOf() < now.valueOf() - 60000) continue

      const bodyParts = ['截止: ' + nextDate.format('YYYY-MM-DD') + (m.endTime ? ' ' + m.endTime : '')]
      if (m.repeatStrategy !== 'none') bodyParts.push('重复任务')

      let listName = ''
      let groupName = ''
      const list = missionStore.lists.find(l => l.id === m.listId)
      if (list) {
        listName = list.name
        const group = list.groups.find(g => g.id === m.groupId)
        if (group) groupName = group.name
      }

      reminders.push({
        id: m.id,
        name: m.name,
        body: bodyParts.join(' · '),
        triggerTime: triggerTime.toISOString(),
        listName,
        groupName,
        repeatStrategy: m.repeatStrategy,
        repeatCustomDays: m.repeatCustomDays,
        repeatEndStrategy: m.repeatEndStrategy,
        repeatEndDate: m.repeatEndDate,
        repeatCount: m.repeatCount,
        repeatCompletedCount: m.repeatCompletedCount,
        reminderStrategy: m.reminderStrategy,
        reminderDays: m.reminderDays,
        reminderHours: m.reminderHours,
        reminderMinutes: m.reminderMinutes,
        endTime: m.endTime
      })
    }

    try {
      const countdownMilestones = await getData<any[]>('countdown', 'countdowns')
      if (countdownMilestones && countdownMilestones.length > 0) {
        for (const cm of countdownMilestones) {
          if (cm.reminderStrategy === 'none' || !cm.reminderStrategy) continue
          if (cm.countMode === 'countup') continue
          if (!cm.targetDate) continue

          let nextDate: dayjs.Dayjs
          if (cm.repeatStrategy === 'yearly') {
            const occ = getNextOccurrence(cm.targetDate, 'yearly', undefined, today)
            if (!occ) continue
            nextDate = occ
          } else {
            nextDate = dayjs(cm.targetDate)
          }

          let triggerTime = dayjs(nextDate.format('YYYY-MM-DD') + 'T00:00:00')
          if (cm.reminderStrategy === 'advance') {
            const offsetMinutes = (cm.reminderDays || 0) * 1440 + (cm.reminderHours || 0) * 60 + (cm.reminderMinutes || 0)
            triggerTime = triggerTime.subtract(offsetMinutes, 'minute')
          }

          if (triggerTime.valueOf() < now.valueOf() - 60000) continue

          reminders.push({
            id: cm.id,
            name: cm.name,
            body: `倒数日「${cm.name}」即将到达`,
            triggerTime: triggerTime.toISOString(),
            reminderStrategy: cm.reminderStrategy,
            reminderDays: cm.reminderDays,
            reminderHours: cm.reminderHours,
            reminderMinutes: cm.reminderMinutes
          })
        }
        logger.info('[提醒] 倒数日提醒已加入调度', { count: countdownMilestones.filter((cm: any) => cm.reminderStrategy && cm.reminderStrategy !== 'none' && cm.countMode !== 'countup').length })
      }
    } catch (e) {
      logger.warn('[提醒] 获取倒数日数据失败', { error: e instanceof Error ? e.message : String(e) })
    }

    const timerState = focusStore.timerState
    if (timerState && timerState.type === 'pomodoro') {
      const now = Date.now()
      const elapsedSinceStart = Math.floor((now - timerState.startTimestamp) / 1000)
      const totalSeconds = timerState.targetDuration * 60
      const remaining = Math.max(0, totalSeconds - Math.max(0, elapsedSinceStart))
      if (remaining > 0) {
        reminders.push({
          id: 'focus-pomodoro',
          name: '专注完成',
          body: '专注完成，请放松一下吧',
          triggerTime: new Date(now + remaining * 1000).toISOString(),
          repeatStrategy: 'none'
        })
        logger.info('[提醒] 专注提醒已加入调度', { name: '专注完成' })
      }
    }

    try {
      const courseReminderMinutes = settingsStore.settings.course?.reminderMinutes ?? 5
      const semesterStartDate = settingsStore.settings.course?.semesterStartDate
      if (semesterStartDate) {
        const courses = await getData<any[]>('course', 'courses')
        if (courses && courses.length > 0) {
          const getMonday = (d: dayjs.Dayjs): dayjs.Dayjs => {
            const day = d.day()
            return d.subtract(day === 0 ? 6 : day - 1, 'day').startOf('day')
          }
          const semesterMonday = getMonday(dayjs(semesterStartDate))
          const currentWeek = Math.max(1, getMonday(now).diff(semesterMonday, 'week') + 1)
          let courseCount = 0
          for (const course of courses) {
            if (!course.weeks || course.weeks.length === 0) continue
            if (!course.startTime) continue
            const sortedWeeks = [...course.weeks].sort((a: number, b: number) => a - b)
            const dayOffset = course.dayOfWeek === 0 ? 6 : course.dayOfWeek - 1
            for (const week of sortedWeeks) {
              if (week < currentWeek) continue
              const classDate = semesterMonday.add((week - 1) * 7 + dayOffset, 'day')
              const triggerTime = dayjs(classDate.format('YYYY-MM-DD') + 'T' + course.startTime).subtract(courseReminderMinutes, 'minute')
              if (triggerTime.valueOf() <= now.valueOf() - 60000) continue
              if (triggerTime.valueOf() > now.valueOf() + MAX_SCHEDULE_DELAY) break
              reminders.push({
                id: `course-${course.id}`,
                name: '课程提醒',
                body: `「${course.name}」即将开始`,
                triggerTime: triggerTime.toISOString(),
                repeatStrategy: 'weekly'
              })
              courseCount++
              break
            }
          }
          if (courseCount > 0) logger.info('[提醒] 课程提醒已加入调度', { count: courseCount })
        }
      }
    } catch (e) {
      logger.warn('[提醒] 获取课程数据失败', { error: e instanceof Error ? e.message : String(e) })
    }

    logger.info('[提醒] 调度提醒任务', { count: reminders.length, persistDuration })
    window.electronAPI.scheduleReminders(reminders, persistDuration)
  } catch (e) {
    logger.error('[提醒] 调度失败', { error: e instanceof Error ? e.message : String(e) })
  }
}

provide('refreshReminders', scheduleMissionReminders)

const countdownMilestones = ref<any[]>([])
const countdownCategories = ref<any[]>([])
provide('countdownMilestones', countdownMilestones)
provide('countdownCategories', countdownCategories)

const guideVisible = ref(false)
const guideCurrentIndex = ref(0)
const guideCompleted = ref(false)
const guideRunning = ref(false)

const startGuide = () => {
  if (focusStore.timerState) {
    ElMessage.warning('请先停止专注')
    logger.info('[引导] 检测到正在专注，已阻止启动引导')
    return
  }
  guideCurrentIndex.value = 0
  guideVisible.value = true
  guideRunning.value = true
  if (route.path !== guideSteps[0].route) {
    router.push(guideSteps[0].route)
  }
  logger.info('[引导] 新手引导已启动')
}

const closeGuide = async () => {
  guideVisible.value = false
  guideCompleted.value = true
  guideRunning.value = false
  try {
    await setSystemStateField('guideCompleted', true)
  } catch {}
  logger.info('[引导] 新手引导已完成')
  startVersionChecks()
}

const handleGuidePrev = () => {
  if (guideCurrentIndex.value <= 0) return
  const prevIdx = guideCurrentIndex.value - 1
  const prevRoute = guideSteps[prevIdx].route
  if (prevRoute !== route.path) {
    router.push(prevRoute)
  }
  guideCurrentIndex.value = prevIdx
}

const handleGuideNext = () => {
  const nextIdx = guideCurrentIndex.value + 1
  if (nextIdx >= guideSteps.length) {
    closeGuide()
    return
  }
  const nextRoute = guideSteps[nextIdx].route
  if (nextRoute !== route.path) {
    router.push(nextRoute)
  }
  guideCurrentIndex.value = nextIdx
}

const handleGuideSkip = () => {
  closeGuide()
}

provide('startGuide', startGuide)
provide('guideVisible', guideVisible)

const initializeData = async () => {
  if (isInitializing.value) {
    logger.debug('[App] 初始化正在进行中，跳过重复调用')
    return
  }
  isInitializing.value = true
  logger.debug('[App] 开始初始化数据...')
  try {
    clearCache()

    try {
      const savedPage = await getSystemStateField('currentPage')
      logger.debug('[App] initializeData savedPage', { savedPage })
      if (savedPage && VALID_ROUTES.includes(savedPage)) {
        logger.debug('[App] initializeData router.replace 开始', { currentPage: route.name, savedPage })
        await router.replace(`/${savedPage}`)
        logger.debug('[App] initializeData router.replace 完成', { currentPage: route.name })
        logger.debug('[App] 恢复路由状态:', { page: savedPage })
      }
    } catch (e) {
      logger.warn('[App] initializeData 路由恢复失败', { error: e })
      logger.debug('[App] 恢复失败，使用默认路由')
    }

    logger.debug('[App] 开始并行加载所有模块数据...')
    // 并行加载所有模块数据
    await Promise.all([
      taskStore.loadTasks(),
      missionStore.loadData(),
      settingsStore.loadSettings(),
      focusStore.loadData(),
      preloadCountdownData(),
      preloadCourseData(),
    ])

    logger.debug('[App] 并行加载完成')
    logger.info('[App] 数据初始化完成')

    cleanUpCourseAutoRecordedTasks()

    scheduleMissionReminders()

    try {
      const isCompleted = await getSystemStateField('guideCompleted')
      guideCompleted.value = isCompleted === true
      if (!guideCompleted.value) {
        guideRunning.value = true
        setTimeout(() => {
          startGuide()
        }, 800)
      }
    } catch {
      guideRunning.value = true
      setTimeout(() => {
        startGuide()
      }, 800)
    }
  } catch (error) {
    logger.error('[App] 初始化数据失败:', { error: error instanceof Error ? error.message : String(error) })
  } finally {
    logger.debug('[App] initializeData 设置 dataInitialized = true', { navPath: pageNav.navPath.value, route: route.name })
    dataInitialized.value = true
    logger.debug('[App] dataInitialized 已设置为 true')
  }
}

// 预加载倒数日数据
const SYSTEM_MILESTONE_ID = 'system-usage-days'
const BIRTHDAY_MILESTONE_ID = 'user-birthday'
const HOLIDAY_ID_PREFIX = 'system-holiday-'

const DEFAULT_COUNTDOWN_CATEGORIES = [
  { value: 'birthday', label: '生日', icon: '🎂', color: '#f472b6' },
  { value: 'anniversary', label: '纪念日', icon: '💕', color: '#ec4899' },
  { value: 'holiday', label: '节日', icon: '🎉', color: '#a855f7' },
  { value: 'travel', label: '旅行', icon: '✈️', color: '#06b6d4' },
  { value: 'entertainment', label: '娱乐', icon: '🎮', color: '#8b5cf6' },
  { value: 'work', label: '工作', icon: '💼', color: '#3b82f6' },
  { value: 'study', label: '学习', icon: '📚', color: '#10b981' },
  { value: 'life', label: '生活', icon: '🌟', color: '#f59e0b' }
]

const lunarToSolar = (year: number, month: number, day: number): string | null => {
  try {
    const { Lunar } = require('lunar-javascript')
    const lunar = Lunar.fromYmd(year, month, day)
    const solar = lunar.getSolar()
    return `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`
  } catch {
    return null
  }
}

const getJieQiDate = (year: number, jieQi: string): string | null => {
  try {
    const { Solar } = require('lunar-javascript')
    for (let day = 4; day <= 6; day++) {
      const solar = Solar.fromYmd(year, 4, day)
      const lunar = solar.getLunar()
      if (lunar.getJieQi() === jieQi) {
        return `${year}-04-${String(day).padStart(2, '0')}`
      }
    }
    return null
  } catch {
    return null
  }
}

const getNthWeekday = (year: number, month: number, weekday: number, nth: number): string => {
  const firstDay = new Date(year, month - 1, 1)
  const firstWeekday = firstDay.getDay()
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (nth - 1) * 7
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const getLastLunarDayOfMonth = (year: number): number => {
  try {
    const { Lunar } = require('lunar-javascript')
    let day = 30
    while (day >= 29) {
      try { Lunar.fromYmd(year, 12, day); return day } catch { day-- }
    }
    return 30
  } catch { return 30 }
}

const generateHolidays = (year: number): { name: string; date: string; description: string }[] => {
  const holidays: { name: string; date: string; description: string }[] = [
    { name: '元旦', date: `${year}-01-01`, description: '新的一年开始啦！' },
    { name: '妇女节', date: `${year}-03-08`, description: '致敬每一位了不起的她！' },
    { name: '愚人节', date: `${year}-04-01`, description: '小心被骗哦！' },
    { name: '劳动节', date: `${year}-05-01`, description: '向劳动者致敬！' },
    { name: '儿童节', date: `${year}-06-01`, description: '童心未泯，快乐常在！' },
    { name: '教师节', date: `${year}-09-10`, description: '桃李芬芳，师恩难忘！' },
    { name: '国庆节', date: `${year}-10-01`, description: '祝祖国繁荣昌盛！' },
    { name: '母亲节', date: getNthWeekday(year, 5, 0, 2), description: '妈妈辛苦了，母亲节快乐！' },
    { name: '父亲节', date: getNthWeekday(year, 6, 0, 3), description: '爸爸辛苦了，父亲节快乐！' },
    { name: '感恩节', date: getNthWeekday(year, 11, 4, 4), description: '心怀感恩，温暖前行！' },
  ]

  const lunarHolidays: { name: string; lMonth: number; lDay: number; description: string }[] = [
    { name: '春节', lMonth: 1, lDay: 1, description: '农历新年，万家团圆！' },
    { name: '元宵节', lMonth: 1, lDay: 15, description: '花灯璀璨，团圆美满！' },
    { name: '端午节', lMonth: 5, lDay: 5, description: '龙舟竞渡，粽叶飘香！' },
    { name: '七夕节', lMonth: 7, lDay: 7, description: '牛郎织女，鹊桥相会！' },
    { name: '中元节', lMonth: 7, lDay: 15, description: '追思先人，敬祖尽孝！' },
    { name: '中秋节', lMonth: 8, lDay: 15, description: '月圆人团圆，千里共婵娟！' },
    { name: '重阳节', lMonth: 9, lDay: 9, description: '登高望远，敬老爱老！' },
    { name: '腊八节', lMonth: 12, lDay: 8, description: '过了腊八就是年！' },
    { name: '小年(北)', lMonth: 12, lDay: 23, description: '北方小年，祭灶迎新春！' },
    { name: '小年(南)', lMonth: 12, lDay: 24, description: '南方小年，祭灶迎新春！' },
  ]

  for (const lh of lunarHolidays) {
    const date = lunarToSolar(year, lh.lMonth, lh.lDay)
    if (date) holidays.push({ name: lh.name, date, description: lh.description })
  }

  const qingmingDate = getJieQiDate(year, '清明')
  if (qingmingDate) holidays.push({ name: '清明节', date: qingmingDate, description: '慎终追远，春暖花开！' })

  const eveDate = lunarToSolar(year, 12, getLastLunarDayOfMonth(year))
  if (eveDate) holidays.push({ name: '除夕', date: eveDate, description: '辞旧迎新，阖家团圆！' })

  return holidays
}

const generateHolidayForYear = (name: string, year: number): string | null => {
  const holidays = generateHolidays(year)
  const found = holidays.find(h => h.name === name)
  return found ? found.date : null
}

const preloadCountdownData = async () => {
  const [rawMilestones, savedCategories] = await Promise.all([
    getData<any[]>('countdown', 'countdowns'),
    getData<any[]>('countdown', 'categories')
  ])

  const categoriesArr = (savedCategories && savedCategories.length > 0)
    ? savedCategories
    : [...DEFAULT_COUNTDOWN_CATEGORIES]
  countdownCategories.value = categoriesArr
  preloadData('countdown', 'categories', categoriesArr)

  let milestonesArr: any[] = []
  if (rawMilestones) {
    milestonesArr = rawMilestones.map((m: any) => ({
      id: m.id || Date.now().toString() + Math.random(),
      name: m.name || '未命名里程碑',
      targetDate: m.targetDate || dayjs().format('YYYY-MM-DD'),
      category: m.category || 'life',
      description: m.description || '',
      countMode: m.countMode === 'countup' ? 'countup' : 'countdown',
      pinned: m.pinned === true,
      isSystem: m.isSystem || false,
      createdAt: m.createdAt || new Date().toISOString(),
      updatedAt: m.updatedAt || new Date().toISOString(),
      reminderStrategy: m.reminderStrategy || 'none',
      reminderDays: m.reminderDays || 0,
      reminderHours: m.reminderHours || 0,
      reminderMinutes: m.reminderMinutes || 0,
      repeatStrategy: m.repeatStrategy || 'none'
    }))
  }

  const today = dayjs().startOf('day')
  const year = today.year()
  const holidays = generateHolidays(year)
  const adjustedHolidays = holidays.map(h => {
    if (dayjs(h.date).isBefore(today)) {
      const nextYearDate = generateHolidayForYear(h.name, year + 1)
      if (nextYearDate) return { ...h, date: nextYearDate }
    }
    return h
  })

  const existingIds = new Set<string>()
  milestonesArr.forEach((m: any) => {
    if (m.id && m.id.startsWith(HOLIDAY_ID_PREFIX)) existingIds.add(m.id)
  })

  for (const holiday of adjustedHolidays) {
    const holidayId = HOLIDAY_ID_PREFIX + holiday.name
    if (existingIds.has(holidayId)) {
      const idx = milestonesArr.findIndex((m: any) => m.id === holidayId)
      if (idx > -1) {
        milestonesArr[idx].targetDate = holiday.date
        milestonesArr[idx].reminderStrategy = 'advance'
        milestonesArr[idx].reminderDays = 1
        milestonesArr[idx].reminderHours = 0
        milestonesArr[idx].reminderMinutes = 0
        milestonesArr[idx].repeatStrategy = 'yearly'
        milestonesArr[idx].updatedAt = new Date().toISOString()
      }
      existingIds.delete(holidayId)
    } else {
      milestonesArr.push({
        id: holidayId,
        name: holiday.name,
        targetDate: holiday.date,
        category: 'holiday',
        description: holiday.description,
        countMode: 'countdown',
        pinned: false,
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminderStrategy: 'advance',
        reminderDays: 1,
        reminderHours: 0,
        reminderMinutes: 0,
        repeatStrategy: 'yearly'
      })
    }
  }

  existingIds.forEach(staleId => {
    const idx = milestonesArr.findIndex((m: any) => m.id === staleId)
    if (idx > -1) milestonesArr.splice(idx, 1)
  })

  const userAny = authStore.user as { createdAt?: string; created_at?: string } | null | undefined
  const startDate = authStore.profile?.created_at || userAny?.createdAt || userAny?.created_at || new Date().toISOString()
  const registrationDay = dayjs(startDate).format('YYYY-MM-DD')
  const systemIdx = milestonesArr.findIndex((m: any) => m.id === SYSTEM_MILESTONE_ID)
  if (systemIdx === -1) {
    milestonesArr.unshift({
      id: SYSTEM_MILESTONE_ID,
      name: '使用地球 Online 生存日记',
      targetDate: registrationDay,
      category: 'anniversary',
      description: '记录你在这个宇宙中的旅程',
      countMode: 'countup',
      pinned: true,
      isSystem: true,
      repeatStrategy: 'yearly',
      createdAt: startDate,
      updatedAt: new Date().toISOString()
    })
  } else {
    const sm = milestonesArr[systemIdx]
    if (sm.targetDate !== registrationDay || sm.category !== 'anniversary') {
      milestonesArr[systemIdx] = { ...sm, targetDate: registrationDay, category: 'anniversary', updatedAt: new Date().toISOString() }
    }
  }

  const birthday = (authStore.profile as any)?.birthday
  const bIdx = milestonesArr.findIndex((m: any) => m.id === BIRTHDAY_MILESTONE_ID)
  if (birthday && bIdx === -1) {
    const [, m, d] = birthday.split('-').map(Number)
    milestonesArr.push({
      id: BIRTHDAY_MILESTONE_ID,
      name: '我的生日',
      targetDate: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      category: 'birthday', description: '', pinned: true, isSystem: true,
      repeatStrategy: 'yearly',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      reminderStrategy: 'advance', reminderDays: 1, reminderHours: 0, reminderMinutes: 0
    })
  } else if (!birthday && bIdx > -1) {
    milestonesArr.splice(bIdx, 1)
  } else if (birthday && bIdx > -1) {
    const [, m, d] = birthday.split('-').map(Number)
    const bDate = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const bm = milestonesArr[bIdx]
    if (bm.targetDate !== bDate || !bm.reminderStrategy) {
      milestonesArr[bIdx] = { ...bm, targetDate: bDate, reminderStrategy: bm.reminderStrategy || 'advance', reminderDays: bm.reminderDays || 1, reminderHours: bm.reminderHours || 0, reminderMinutes: bm.reminderMinutes || 0, repeatStrategy: 'yearly', updatedAt: new Date().toISOString() }
    }
  }

  countdownMilestones.value = milestonesArr
  await setData('countdown', 'categories', categoriesArr)
  await setData('countdown', 'countdowns', milestonesArr)
  preloadData('countdown', 'countdowns', milestonesArr)
  logger.info('[预加载] 倒数日数据加载完成', { milestones: milestonesArr.length, categories: categoriesArr.length })
}

// 预加载课程表数据
const preloadCourseData = async () => {
  const courses = await getData('course', 'courses')
  if (courses) preloadData('course', 'courses', courses)
}

// 从 Redis 恢复页面状态 - 已由路由接管

// 监听路由变化，保存到系统状态
watch(
  () => route.name,
  async (newName, oldName) => {
    logger.debug('[App] route watch 触发', { oldName, newName, currentModule: pageNav.currentModule.value, navPath: [...pageNav.navPath.value] })
    if (newName && typeof newName === 'string' && VALID_ROUTES.includes(newName)) {
      if (pageNav.currentModule.value !== newName) {
        logger.debug('[App] route watch 模块变化，设置 navPath', { from: pageNav.currentModule.value, to: newName })
        pageNav.setNavPath([newName])
        pageNav.setNavContext({ segments: [], plusVisible: false, plusOnClick: null, goModuleHome: () => {} })
      } else {
        logger.debug('[App] route watch 模块未变化，跳过 navPath 设置', { module: newName })
      }
      await setSystemStateField('currentPage', newName)
    }
  }
)
watch(
    () => authStore.isAuthenticated,
    async (isAuthenticated, wasAuthenticated) => {
      logger.debug('[App] isAuthenticated 变化:', { wasAuthenticated, isAuthenticated, dataInitialized: dataInitialized.value })
      if (isAuthenticated && !wasAuthenticated && !dataInitialized.value) {
        logger.info('[App] 检测到用户登录，开始初始化数据')
        await initializeData()
      }
    }
)

// 专注模块全屏状态
const isFocusFullscreen = ref(false)

// 统计模块全屏状态
const isStatsFullscreen = ref(false)

const handleFullscreenFromRoute = (fullscreen: boolean) => {
  if (route.name === 'focus') {
    isFocusFullscreen.value = fullscreen
  } else if (route.name === 'footprint') {
    isStatsFullscreen.value = fullscreen
  }
}

const starCanvas = ref<HTMLCanvasElement>()
let animationId: number
let resizeHandler: (() => void) | null = null

interface Star {
  x: number
  y: number
  radius: number
  opacity: number
  speed: number
  twinkleSpeed: number
}

interface Meteor {
  x: number
  y: number
  length: number
  speed: number
  opacity: number
  angle: number
}

onMounted(async () => {

  // 注册倒数日刷新回调
  (window as any).__countdownRefresh = () => {
    scheduleMissionReminders()
  }

  // 注册提醒 IPC 监听
  if (window.electronAPI?.onShowReminder) {
    window.electronAPI.onShowReminder((reminder: ReminderItem) => {
      logger.info('[提醒] 收到提醒', { id: reminder.id, name: reminder.name })
      activeReminders.value.push(reminder)
      playReminderSound()
    })
  }

  // 先初始化认证状态
  await authStore.init()

  // 如果已登录，初始化数据
  if (authStore.isAuthenticated) {
    await initializeData()
    startVersionChecks()
  }

  const canvas = starCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 设置 canvas 大小
  resizeHandler = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resizeHandler()
  window.addEventListener('resize', resizeHandler)

  // 创建星星
  const stars: Star[] = []
  const starCount = 200

  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.5 + 0.5,
      opacity: Math.random(),
      speed: Math.random() * 0.5 + 0.1,
      twinkleSpeed: Math.random() * 0.02 + 0.005
    })
  }

  // 创建流星
  const meteors: Meteor[] = []

  const createMeteor = () => {
    if (Math.random() < 0.02 && meteors.length < 3) {
      meteors.push({
        x: Math.random() * canvas.width,
        y: 0,
        length: Math.random() * 80 + 50,
        speed: Math.random() * 8 + 6,
        opacity: 1,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2
      })
    }
  }

  // 动画循环
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    stars.forEach(star => {
      star.opacity += star.twinkleSpeed
      if (star.opacity > 1 || star.opacity < 0.3) {
        star.twinkleSpeed = -star.twinkleSpeed
      }

      ctx.beginPath()
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
      ctx.fill()

      if (star.radius > 1) {
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.radius * 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * 0.2})`
        ctx.fill()
      }

      star.y += star.speed * 0.1
      if (star.y > canvas.height) {
        star.y = 0
        star.x = Math.random() * canvas.width
      }
    })

    createMeteor()

    meteors.forEach((meteor, index) => {
      meteor.x += Math.cos(meteor.angle) * meteor.speed
      meteor.y += Math.sin(meteor.angle) * meteor.speed
      meteor.opacity -= 0.01

      if (meteor.opacity <= 0 || meteor.x > canvas.width || meteor.y > canvas.height) {
        meteors.splice(index, 1)
        return
      }

      const gradient = ctx.createLinearGradient(
          meteor.x, meteor.y,
          meteor.x - Math.cos(meteor.angle) * meteor.length,
          meteor.y - Math.sin(meteor.angle) * meteor.length
      )
      gradient.addColorStop(0, `rgba(255, 255, 255, ${meteor.opacity})`)
      gradient.addColorStop(0.3, `rgba(200, 220, 255, ${meteor.opacity * 0.6})`)
      gradient.addColorStop(1, 'rgba(200, 220, 255, 0)')

      ctx.beginPath()
      ctx.moveTo(meteor.x, meteor.y)
      ctx.lineTo(
          meteor.x - Math.cos(meteor.angle) * meteor.length,
          meteor.y - Math.sin(meteor.angle) * meteor.length
      )
      ctx.strokeStyle = gradient
      ctx.lineWidth = 2
      ctx.stroke()
    })

    animationId = requestAnimationFrame(animate)
  }

  animate()
})

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (updateNoUpdateTimer) {
    clearTimeout(updateNoUpdateTimer)
  }
})
</script>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(to bottom, #0f0c29 0%, #302b63 50%, #24243e 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 被踢出提示 */
.kicked-out-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kicked-out-content {
  text-align: center;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.kicked-out-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.kicked-out-content h2 {
  color: var(--chalk-white);
  margin: 0 0 12px 0;
  font-size: 22px;
}

.kicked-out-content p {
  color: var(--chalk-white-60);
  margin: 0 0 24px 0;
  font-size: 14px;
}

.star-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.canvas-hidden {
  display: none;
}

/* 主导航栏 */
.main-nav-bar {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  transition: opacity 0.3s, height 0.3s;
  overflow: hidden;
  width: 500px;
  margin: 16px auto;
  border-radius: 10px;
}

.main-nav-bar.nav-hidden {
  opacity: 0;
  height: 0;
  min-height: 0;
  pointer-events: none;
}

.nav-bar-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: auto;
}

.nav-items-scroll {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  padding: 4px 12px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.nav-items-scroll::-webkit-scrollbar {
  display: none;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
  min-width: 52px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-85);
}

.nav-item.active {
  background: transparent;
  color: var(--chalk-white);
  font-weight: 600;
}

.nav-item-icon {
  font-size: 18px;
  line-height: 1;
}

.nav-item-label {
  font-size: 12px;
  line-height: 1;
}

/* 顶部页面导航栏 - 已废弃，保留以兼容旧引用 */
.page-nav-bar {
  display: none;
}

.main-content {
  position: relative;
  z-index: 10;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.panel-wrapper {
  width: 100%;
  height: 100%;
}

.loading-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to bottom, #0f0c29 0%, #302b63 50%, #24243e 100%);
}

.loading-content {
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: var(--chalk-white-60);
  font-size: 14px;
}

.update-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 3000;
  width: 380px;
  background: rgba(20, 16, 55, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  animation: changelogSlideIn 0.3s ease-out;
}

.update-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.update-panel-title {
  color: var(--chalk-amber);
  font-size: 16px;
  font-weight: 600;
}

.update-panel-close {
  background: none;
  border: none;
  color: var(--chalk-muted);
  font-size: 22px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}

.update-panel-close:hover {
  color: var(--chalk-white-90);
}

.update-panel-body {
  padding: 16px 20px 18px;
}

.update-status {
  font-size: 15px;
  line-height: 1.6;
  color: var(--chalk-white-85);
}

.update-status.update-error {
  color: rgba(255, 100, 100, 0.9);
}

.update-status.update-no-new {
  color: rgba(100, 255, 100, 0.8);
}

.update-link {
  color: rgba(100, 200, 255, 0.9);
  text-decoration: none;
  border-bottom: 1px solid rgba(100, 200, 255, 0.3);
  transition: color 0.2s, border-color 0.2s;
}

.update-link:hover {
  color: rgba(100, 200, 255, 1);
  border-bottom-color: rgba(100, 200, 255, 0.6);
}

.update-message {
  font-size: 12px;
  color: var(--chalk-muted);
  margin-top: 8px;
  word-break: break-all;
}

.reminder-stack {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2900;
  pointer-events: none;
  display: flex;
  flex-direction: column-reverse;
  gap: 12px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  scrollbar-width: none;
}

.reminder-stack::-webkit-scrollbar {
  display: none;
}

.reminder-panel {
  position: relative;
  width: 320px;
  flex-shrink: 0;
  background: rgba(20, 16, 55, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  animation: changelogSlideIn 0.3s ease-out;
  pointer-events: auto;
  overflow: hidden;
}

.reminder-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 4px;
}

.reminder-panel-icon {
  font-size: 18px;
  line-height: 1;
}

.reminder-panel-close {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--chalk-muted);
  font-size: 14px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: all 0.2s;
}

.reminder-panel-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--chalk-white);
}

.reminder-panel-content {
  padding: 2px 14px 10px;
}

.reminder-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--chalk-amber);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.reminder-panel-subtitle {
  font-size: 11px;
  color: var(--chalk-subtle);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.reminder-panel-body {
  font-size: 12px;
  color: var(--chalk-white-60);
  line-height: 1.4;
}

.changelog-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 3000;
  width: 480px;
  max-height: 55vh;
  background: rgba(20, 16, 55, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  animation: changelogSlideIn 0.3s ease-out;
}

@keyframes changelogSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px) translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0) translateX(0);
  }
}

.changelog-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.changelog-panel-title {
  color: var(--chalk-amber);
  font-size: 16px;
  font-weight: 600;
}

.changelog-panel-close {
  background: none;
  border: none;
  color: var(--chalk-muted);
  font-size: 22px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}

.changelog-panel-close:hover {
  color: var(--chalk-white-90);
}

.changelog-panel-body {
  overflow-y: auto;
  padding: 8px 16px 12px 8px;
  flex: 1;
  min-height: 0;
}

.changelog-panel-body::-webkit-scrollbar { width: 4px; }
.changelog-panel-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.changelog-panel-body::-webkit-scrollbar-track { background: transparent; }
.changelog-panel-body :deep(.cl-version) { color: var(--chalk-amber); font-size: 14px; font-weight: 600; margin: 14px 0 6px; padding: 5px 0 5px 10px; border-left: 3px solid #f0c040; background: linear-gradient(90deg, rgba(240,192,64,0.06) 0%, transparent 100%); border-radius: 0 4px 4px 0; }
.changelog-panel-body :deep(.cl-list) { margin: 0 0 4px 16px; padding: 0; list-style: none; color: var(--chalk-white-75); }
.changelog-panel-body :deep(.cl-list li) { font-size: 12px; line-height: 1.7; padding: 2px 0; position: relative; padding-left: 14px; }
.changelog-panel-body :deep(.cl-list li)::before { content: '•'; position: absolute; left: 0; color: rgba(255,255,255,0.25); font-size: 10px; top: 5px; }
</style>
