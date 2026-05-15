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
      <!-- 顶部导航栏 -->
      <nav class="top-nav" :class="{ 'nav-hidden': isFocusFullscreen }">
        <div class="nav-scroll-container" ref="navScrollContainer">
          <div class="nav-menu">
            <div
                class="nav-item"
                :class="{ active: isActive('footprint') }"
                :ref="setNavItemRef"
                @click="navigateTo('/footprint')"
            >
              <span class="nav-label">足迹</span>
            </div>
            <div
                class="nav-item"
                :class="{ active: isActive('focus') }"
                :ref="setNavItemRef"
                @click="navigateTo('/focus')"
            >
              <span class="nav-label">专注</span>
            </div>
            <div
                class="nav-item"
                :class="{ active: isActive('mission') }"
                :ref="setNavItemRef"
                @click="navigateTo('/mission')"
            >
              <span class="nav-label">清单</span>
            </div>
            <div
                class="nav-item"
                :class="{ active: isActive('countdown') }"
                :ref="setNavItemRef"
                @click="navigateTo('/countdown')"
            >
              <span class="nav-label">倒数日</span>
            </div>
            <div
                class="nav-item"
                :class="{ active: isActive('course') }"
                :ref="setNavItemRef"
                @click="navigateTo('/course')"
            >
              <span class="nav-label">课程表</span>
            </div>
            <div
                class="nav-item"
                :class="{ active: isActive('notes') }"
                :ref="setNavItemRef"
                @click="navigateTo('/notes')"
            >
              <span class="nav-label">笔记</span>
            </div>
            <div
                class="nav-item"
                :class="{ active: isActive('statistics') }"
                :ref="setNavItemRef"
                @click="navigateTo('/statistics')"
            >
              <span class="nav-label">统计</span>
            </div>
            <div
                class="nav-item"
                :class="{ active: isActive('profile') }"
                :ref="setNavItemRef"
                @click="navigateTo('/profile')"
            >
              <span class="nav-label">我的</span>
            </div>
          </div>
          <div class="scroll-shadow-left" :class="{ 'shadow-hidden': !showLeftShadow }"></div>
          <div class="scroll-shadow-right" :class="{ 'shadow-hidden': !showRightShadow }"></div>
        </div>
      </nav>

      <!-- 主内容区域 -->
      <main class="main-content">
        <div class="panel-wrapper">
          <router-view v-slot="{ Component }">
            <component
              :is="Component"
              :key="`${String($route.name)}-${userKey}`"
              @fullscreen-change="handleFullscreenFromRoute"
              @logout="handleLogout"
              @refreshData="handleRefreshData"
            />
          </router-view>
        </div>
      </main>

      <!-- 版本更新对话框 -->
      <el-dialog
          v-model="updateDialogVisible"
          title="版本更新"
          width="380px"
          :close-on-click-modal="false"
          :show-close="true"
          append-to-body
          class="update-dialog"
      >
        <div class="update-dialog-body">
          <div class="update-icon">🌍</div>
          <div
              class="update-status"
              :class="{ 'update-error': updateStatus === 'error', 'update-no-new': updateStatus === 'no-update' }"
          >
            {{ updateStatusText }}
          </div>
          <div v-if="updateStatus === 'available'" class="update-version">
            v{{ updateVersion }}
          </div>
          <div v-if="updateStatus === 'error' && updateMessage" class="update-message">
            {{ updateMessage }}
          </div>
        </div>
        <template #footer>
          <el-button v-if="updateStatus === 'available'" type="primary" @click="handleUpdateDownload">
            前往 GitHub Releases 下载
          </el-button>
          <el-button v-else @click="updateDialogVisible = false">关闭</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="showAppChangelogDialog" title="更新日志" width="600px" class="changelog-dialog" center>
        <div class="changelog-body" v-html="appChangelogHtml"></div>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AuthPage from './components/AuthPage.vue'
import { initCourseAutoRecord } from './composables/useCourseAutoRecord'
import { useTaskStore } from './stores/taskStore'
import { useMissionStore } from './stores/missionStore'
import { useAuthStore } from './stores/authStore'
import { useSettingsStore } from './stores/settingsStore'
import { useFocusStore } from './stores/focusStore'
import { getData, setData, preloadData, clearCache, getSystemStateField, setSystemStateField } from './services/storageService'
import { logger } from './lib/logger'
import dayjs from 'dayjs'
// @ts-expect-error - Vite raw import
import changelogContent from '../CHANGELOG.md?raw'

const router = useRouter()
const route = useRoute()

const VALID_ROUTES = ['footprint', 'focus', 'mission', 'countdown', 'course', 'notes', 'statistics', 'profile']
const MAX_SCHEDULE_DELAY = 20 * 24 * 3600 * 1000

const isActive = (name: string) => route.name === name

const navigateTo = (path: string) => {
  router.push(path)
}

const taskStore = useTaskStore()
const missionStore = useMissionStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const focusStore = useFocusStore()

const navScrollContainer = ref<HTMLElement>()
const navItems = ref<HTMLElement[]>([])
const showLeftShadow = ref(false)
const showRightShadow = ref(false)
const isNavOverflow = ref(false)
const setNavItemRef = (el: any) => {
  if (el) {
    navItems.value.push(el)
  }
}

const scrollNavToCenter = () => {
  nextTick(() => {
    const container = navScrollContainer.value
    if (!container) return
    
    const containerWidth = container.clientWidth
    const scrollWidth = container.scrollWidth
    
    // 如果内容宽度小于等于容器宽度，居中由CSS控制
    if (scrollWidth <= containerWidth) {
      container.scrollLeft = 0
      return
    }
    
    // 找到当前激活的导航项
    const activeIndex = navItems.value.findIndex(
      item => item.classList.contains('active')
    )
    
    if (activeIndex === -1) return
    
    const activeItem = navItems.value[activeIndex]
    const itemOffsetLeft = activeItem.offsetLeft
    const itemWidth = activeItem.offsetWidth
    
    const scrollTarget = itemOffsetLeft - (containerWidth / 2) + (itemWidth / 2)
    
    container.scrollTo({
      left: scrollTarget,
      behavior: 'smooth'
    })
  })
}

let isNavDragging = false
let navDragStartX = 0
let navDragScrollLeft = 0

const checkNavOverflow = () => {
  const el = navScrollContainer.value
  if (!el) return
  isNavOverflow.value = el.scrollWidth > el.clientWidth
  updateNavShadows()
}

const updateNavShadows = () => {
  const el = navScrollContainer.value
  if (!el) return
  isNavOverflow.value = el.scrollWidth > el.clientWidth
  const { scrollLeft, scrollWidth, clientWidth } = el
  showLeftShadow.value = scrollLeft > 2
  showRightShadow.value = scrollLeft < scrollWidth - clientWidth - 2
}

const initNavDrag = () => {
  const el = navScrollContainer.value
  if (!el) return

  // 拦截非左键的默认行为（中键自动滚动、右键菜单等）
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, { capture: true })

  el.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isNavDragging = true
      navDragStartX = e.pageX
      navDragScrollLeft = el.scrollLeft
      el.style.cursor = 'grabbing'
      el.style.userSelect = 'none'
    }
  })

  window.addEventListener('mousemove', (e) => {
    if (!isNavDragging) return
    e.preventDefault()
    const x = e.pageX
    const walk = navDragStartX - x
    const newScroll = navDragScrollLeft + walk
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollLeft = Math.max(0, Math.min(maxScroll, newScroll))
    updateNavShadows()
  })

  const endDrag = () => {
    if (!isNavDragging) return
    isNavDragging = false
    el.style.cursor = ''
    el.style.userSelect = ''
    updateNavShadows()
  }

  window.addEventListener('mouseup', endDrag)
  window.addEventListener('mouseleave', endDrag)

  let touchStartX = 0
  let touchScrollLeft = 0
  let isTouchDragging = false

  el.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].pageX
    touchScrollLeft = el.scrollLeft
    isTouchDragging = true
  }, { passive: true })

  el.addEventListener('touchmove', (e) => {
    if (!isTouchDragging) return
    const x = e.touches[0].pageX
    const walk = touchStartX - x
    const newScroll = touchScrollLeft + walk
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollLeft = Math.max(0, Math.min(maxScroll, newScroll))
    updateNavShadows()
  }, { passive: true })

  el.addEventListener('touchend', () => {
    isTouchDragging = false
    updateNavShadows()
  })

  el.addEventListener('scroll', updateNavShadows, { passive: true })

  // 禁用右键菜单
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })

  checkNavOverflow()
  window.addEventListener('resize', () => {
    checkNavOverflow()
    scrollNavToCenter()
  })
  
  // 初始化后滚动到当前激活项 - 增加延迟确保DOM完全渲染
  setTimeout(() => {
    scrollNavToCenter()
  }, 300)
}

// 星星画布显示条件
const showStarCanvas = computed(() => {
  return authStore.isAuthenticated
})

// 数据是否已初始化
const dataInitialized = ref(false)
const isInitializing = ref(false)
const userKey = ref(0)

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
  // 更新用户标识，强制 keep-alive 组件重新渲染
  userKey.value++
  // 等待 DOM 更新后重新加载数据
  await nextTick()
  await initializeData()
}

const showAppChangelogDialog = ref(false)

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
    case 'available': return '发现新版本，请前往下载'
    case 'error': return '更新检查失败'
    case 'no-update': return '已是最新版本'
    default: return ''
  }
})

let updateNoUpdateTimer: ReturnType<typeof setTimeout> | null = null

const handleUpdateDownload = () => {
  logger.info('[App] 用户点击前往下载，关闭更新对话框')
  updateDialogVisible.value = false
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(RELEASES_URL)
  }
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

          let triggerTime = dayjs(cm.targetDate + 'T00:00:00')
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
    if (timerState) {
      const now = Date.now()
      const elapsedSinceStart = Math.floor((now - timerState.startTimestamp) / 1000)
      if (timerState.type === 'pomodoro') {
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
      } else {
        const nextHourIndex = Math.floor(Math.max(0, elapsedSinceStart) / 3600) + 1
        reminders.push({
          id: 'focus-stopwatch',
          name: '专注提醒',
          body: `您已经专注${nextHourIndex}个小时了，要劳逸结合哦~`,
          triggerTime: new Date(timerState.startTimestamp + nextHourIndex * 3600 * 1000).toISOString(),
          repeatStrategy: 'hourly'
        })
        logger.info('[提醒] 专注提醒已加入调度', { name: '专注提醒' })
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
      if (savedPage && VALID_ROUTES.includes(savedPage)) {
        router.replace(`/${savedPage}`)
        logger.debug('[App] 恢复路由状态:', { page: savedPage })
      }
    } catch {
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

    logger.debug('[App] 并行加载完成，初始化课程自动记录...')
    await initCourseAutoRecordFromStorage()
    logger.info('[App] 数据初始化完成')

    scheduleMissionReminders()
  } catch (error) {
    logger.error('[App] 初始化数据失败:', { error: error instanceof Error ? error.message : String(error) })
  } finally {
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
      reminderMinutes: m.reminderMinutes || 0
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
        pinned: true,
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminderStrategy: 'advance',
        reminderDays: 1,
        reminderHours: 0,
        reminderMinutes: 0
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
      name: '已使用地球 Online 生存日记',
      targetDate: registrationDay,
      category: 'anniversary',
      description: '记录你在这个宇宙中的旅程',
      pinned: true,
      isSystem: true,
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
      milestonesArr[bIdx] = { ...bm, targetDate: bDate, reminderStrategy: bm.reminderStrategy || 'advance', reminderDays: bm.reminderDays || 1, reminderHours: bm.reminderHours || 0, reminderMinutes: bm.reminderMinutes || 0, updatedAt: new Date().toISOString() }
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
  const [courses, recordedCourses] = await Promise.all([
    getData('course', 'courses'),
    getData('course', 'recorded-courses')
  ])
  if (courses) preloadData('course', 'courses', courses)
  if (recordedCourses) preloadData('course', 'recorded-courses', recordedCourses)
}

// 从 Redis 恢复页面状态 - 已由路由接管

// 监听路由变化，保存到系统状态
watch(
  () => route.name,
  async (newName) => {
    if (newName && typeof newName === 'string' && VALID_ROUTES.includes(newName)) {
      await setSystemStateField('currentPage', newName)
    }
    scrollNavToCenter()
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

// 初始化课程自动记录功能
const initCourseAutoRecordFromStorage = async () => {
  try {
    const savedCourses = await getData<any[]>('course', 'courses')

    if (savedCourses) {
      const settingsStore = useSettingsStore()
      await settingsStore.loadSettings()
      const semesterStartDate = settingsStore.settings.course?.semesterStartDate || null
      await initCourseAutoRecord(savedCourses, semesterStartDate)
    }
  } catch (e) {
    logger.error('Failed to init course auto record:', { error: e instanceof Error ? e.message : String(e) })
  }
}

onMounted(async () => {

  // 注册倒数日刷新回调
  (window as any).__countdownRefresh = () => {
    scheduleMissionReminders()
  }

  // 先初始化认证状态
  await authStore.init()

  // 如果已登录，初始化数据
  if (authStore.isAuthenticated) {
    await initializeData()

    // 版本更新检测 - 非阻塞，在数据初始化完成后静默检测
    if (window.electronAPI?.checkVersionUpdate && authStore.user?.id) {
      window.electronAPI.checkVersionUpdate(authStore.user.id).then(result => {
        if (result.isUpdated) {
          logger.info('[App] 检测到版本更新', { oldVersion: result.oldVersion, newVersion: result.newVersion })
          showAppChangelogDialog.value = true
        }
      }).catch(e => {
        console.error('[App] 版本更新检测失败:', e)
      })
    }

    // 注册版本更新状态监听器（替代原有的独立子窗口）
    setupUpdateStatusListener()
  }

  // 初始化导航栏拖拽滑动
  initNavDrag()
  updateNavShadows()

  // 滚动到当前激活的导航项
  nextTick(() => {
    scrollNavToCenter()
  })

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
  color: #fff;
  margin: 0 0 12px 0;
  font-size: 22px;
}

.kicked-out-content p {
  color: rgba(255, 255, 255, 0.6);
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

/* 顶部导航栏 */
.top-nav {
  position: relative;
  z-index: 20;
  width: 100%;
  height: 56px;
  background: rgba(15, 12, 41, 0.6);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
  overflow: visible;
  transition: opacity 0.3s, height 0.3s, margin 0.3s;
}

.top-nav.nav-hidden {
  opacity: 0;
  height: 0;
  margin-top: -56px;
  pointer-events: none;
}

.nav-scroll-container {
  flex: 1;
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  cursor: grab;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-user-select: none;
  user-select: none;
  display: flex;
}

.nav-scroll-container::-webkit-scrollbar {
  display: none;
}

.nav-menu {
  padding: 6px 8px;
  display: flex;
  flex-direction: row;
  gap: 4px;
  align-items: center;
  width: max-content;
  margin: 0 auto;
}

.scroll-shadow-left,
.scroll-shadow-right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 30px;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 5;
}

.scroll-shadow-left {
  left: 0;
  background: linear-gradient(to right, rgba(15, 12, 41, 0.8) 0%, transparent 100%);
}

.scroll-shadow-right {
  right: 0;
  background: linear-gradient(to left, rgba(15, 12, 41, 0.8) 0%, transparent 100%);
}

.shadow-hidden {
  opacity: 0;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.nav-item.active {
  color: #fff;
  background: rgba(102, 126, 234, 0.2);
}

.nav-label {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
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
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

/* 版本更新对话框样式 */
:deep(.update-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 20px 20px 0;
}

:deep(.update-dialog .el-dialog__title) {
  color: #fff;
  font-size: 17px;
  font-weight: 600;
}

:deep(.update-dialog .el-dialog__body) {
  padding: 24px 20px 12px;
}

:deep(.update-dialog .el-dialog__footer) {
  padding: 12px 20px 20px;
  border-top: none;
  display: flex;
  justify-content: center;
}

.update-dialog-body {
  text-align: center;
}

.update-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.update-status {
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
}

.update-status.update-error {
  color: rgba(255, 100, 100, 0.9);
}

.update-status.update-no-new {
  color: rgba(100, 255, 100, 0.8);
}

.update-version {
  font-size: 13px;
  color: rgba(100, 200, 255, 0.85);
  margin-top: 8px;
}

.update-message {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 8px;
  word-break: break-all;
}

.changelog-dialog :deep(.el-dialog__header) { position: relative; display: flex; justify-content: center; }
.changelog-dialog :deep(.el-dialog__headerbtn) { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); }
.changelog-body { max-height: 60vh; overflow-y: auto; padding: 4px 16px 4px 8px; }
.changelog-body::-webkit-scrollbar { width: 4px; }
.changelog-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.changelog-body::-webkit-scrollbar-track { background: transparent; }
.changelog-body :deep(.cl-version) { color: #f0c040; font-size: 15px; font-weight: 600; margin: 16px 0 8px; padding: 6px 0 6px 12px; border-left: 3px solid #f0c040; background: linear-gradient(90deg, rgba(240,192,64,0.06) 0%, transparent 100%); border-radius: 0 4px 4px 0; }
.changelog-body :deep(.cl-list) { margin: 0 0 4px 20px; padding: 0; list-style: none; color: rgba(255,255,255,0.75); }
.changelog-body :deep(.cl-list li) { font-size: 13px; line-height: 1.8; padding: 2px 0; position: relative; padding-left: 16px; }
.changelog-body :deep(.cl-list li)::before { content: '•'; position: absolute; left: 0; color: rgba(255,255,255,0.25); font-size: 10px; top: 6px; }
</style>
