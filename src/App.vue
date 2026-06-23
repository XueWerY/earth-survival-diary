<template>
  <div class="app-container">
    <!-- Canvas 2D 流星背景 -->
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
      <div v-if="isElectron && !splitScreen.isSplitActive.value" class="main-nav-bar" :class="{ 'nav-hidden': isFocusFullscreen }" @contextmenu.prevent="handleNavContextMenu">
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

      

      <!-- 上下文菜单 -->
      <teleport to="body">
        <div v-if="contextMenuVisible" class="context-menu-overlay" @click="closeContextMenu"></div>
        <div v-if="contextMenuVisible" class="context-menu" :style="contextMenuStyle">
          <div v-if="!splitScreen.isSplitActive.value" class="context-menu-item" @click="handleEnterSplit">
            <span>拆分界面</span>
          </div>
          <div v-if="splitScreen.isSplitActive.value" class="context-menu-item context-menu-item-danger" @click="handleExitSplitClick">
            <span>退出拆分界面</span>
          </div>
        </div>
      </teleport>

      <!-- 主内容区域 -->
      <main class="main-content">
        <div v-if="splitScreen.isSplitActive.value" class="split-container">
          <div class="split-panel">
            <div class="split-panel-nav-bar">
              <div class="nav-items-scroll">
                <button v-for="m in MODULES" :key="m" class="nav-item" :class="{ active: panelModules[0] === m }" @click="panelNavigate(0, m)">
                  <span class="nav-item-icon">{{ MODULE_ICONS[m] }}</span>
                  <span class="nav-item-label">{{ MODULE_LABELS[m] }}</span>
                </button>
              </div>
            </div>
            <div class="split-panel-content">
              <component :is="moduleComponents[panelModules[0]]" :key="`split-0-${panelModules[0]}`"
                @fullscreen-change="handleFullscreenFromRoute"
                @logout="handleLogout"
                @refreshData="handleRefreshData"
                @profile-updated="handleProfileUpdated"
              />
            </div>
          </div>
          <div class="split-divider"></div>
          <div class="split-panel">
            <div class="split-panel-nav-bar">
              <div class="nav-items-scroll">
                <button v-for="m in MODULES" :key="m" class="nav-item" :class="{ active: panelModules[1] === m }" @click="panelNavigate(1, m)">
                  <span class="nav-item-icon">{{ MODULE_ICONS[m] }}</span>
                  <span class="nav-item-label">{{ MODULE_LABELS[m] }}</span>
                </button>
              </div>
            </div>
            <div class="split-panel-content">
              <component :is="moduleComponents[panelModules[1]]" :key="`split-1-${panelModules[1]}`"
                @fullscreen-change="handleFullscreenFromRoute"
                @logout="handleLogout"
                @refreshData="handleRefreshData"
                @profile-updated="handleProfileUpdated"
              />
            </div>
          </div>
        </div>
        <div v-else class="panel-wrapper">
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
        <ReminderCard v-for="(r, i) in activeReminders" :key="r.id" :reminder="r" @dismiss="dismissReminder(i)" />
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

      <div v-if="isElectron && focusStore.timerState && route.path !== '/focus'" class="focus-status-indicator">
        <span class="focus-status-icon">{{ focusStore.timerState.type === 'pomodoro' ? '🍅' : '⏱️' }}</span>
        <span class="focus-status-text">{{ focusStore.timerState.name }}</span>
        <span class="focus-status-time">{{ focusDisplayTime }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick, provide, onErrorCaptured, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AuthPage from './components/auth/AuthPage.vue'
import { useTaskStore } from './stores/taskStore'
import { useListStore, DEFAULT_LIST_COLORS } from './stores/listStore'
import ReminderCard from './components/common/card/ReminderCard.vue'
import { useAuthStore } from './stores/authStore'
import { useSettingsStore } from './stores/settingsStore'
import { useFocusStore } from './stores/focusStore'
import { getData, setData, preloadData, clearCache, getSystemStateField, setSystemStateField } from './services/storageService'
import { logger } from './lib/logger'
import { usePageNav, MODULES, MODULE_ICONS, MODULE_LABELS, MODULE_ROUTES } from './composables/usePageNav'
import { useSplitScreen } from './composables/useSplitScreen'
import dayjs from 'dayjs'
// @ts-expect-error - Vite raw import
import changelogContent from '../CHANGELOG.md?raw'
import appVersion from 'virtual:version'
import GuideOverlay from './components/common/overlay/GuideOverlay.vue'
import { guideSteps } from './data/guideSteps'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()

const VALID_ROUTES = ['footprint', 'focus', 'list', 'countdown', 'course', 'statistics', 'toolbox', 'profile']
const MAX_SCHEDULE_DELAY = 20 * 24 * 3600 * 1000

const pageNav = usePageNav()
const splitScreen = useSplitScreen()

const moduleComponents: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  footprint: defineAsyncComponent(() => import('./components/footprint/TaskList.vue')),
  focus: defineAsyncComponent(() => import('./components/focus/FocusTimer.vue')),
  list: defineAsyncComponent(() => import('./components/list/ListPage.vue')),
  countdown: defineAsyncComponent(() => import('./components/countdown/CountdownList.vue')),
  course: defineAsyncComponent(() => import('./components/course/CourseSchedule.vue')),
  statistics: defineAsyncComponent(() => import('./components/statistics/StatisticsPage.vue')),
  toolbox: defineAsyncComponent(() => import('./components/toolbox/ToolboxPage.vue')),
  profile: defineAsyncComponent(() => import('./components/profile/ProfilePage.vue')),
}

const panelModules = ref<string[]>(['footprint', 'footprint'])

const contextMenuVisible = ref(false)
const contextMenuStyle = ref({ top: '0px', left: '0px' })

function handleNavContextMenu(event: MouseEvent) {
  contextMenuStyle.value = {
    top: `${event.clientY}px`,
    left: `${event.clientX}px`,
  }
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
}

function handleEnterSplit() {
  const current = pageNav.currentModule.value
  panelModules.value = [current, current]
  closeContextMenu()
  splitScreen.enterSplit(current)
}

function handleExitSplitClick() {
  closeContextMenu()
  splitScreen.exitSplit()
}

function panelNavigate(panelIndex: number, module: string) {
  panelModules.value[panelIndex] = module
}

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
const listStore = useListStore()
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
  // 清理所有 JS 定时器
  reminderTimers.forEach(t => clearTimeout(t))
  reminderTimers.length = 0
  // 重置所有 store 状态
  taskStore.reset()
  listStore.reset()
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
const reminderTimers: ReturnType<typeof setTimeout>[] = []
const MAX_REMINDER_DELAY = 7 * 24 * 60 * 60 * 1000 // JS 定时器最多调度 7 天内的提醒

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
  } else {
    window.open(RELEASES_URL, '_blank')
  }
}

const versionChecksStarted = ref(false)

const startVersionChecks = async () => {
  if (versionChecksStarted.value) return
  versionChecksStarted.value = true
  logger.info('[更新] 开始版本检测')

  if (authStore.user?.id) {
    if (window.electronAPI?.checkVersionUpdate) {
      try {
        const result = await window.electronAPI.checkVersionUpdate(authStore.user.id)
        if (result.isUpdated) {
          try {
            await setSystemStateField('version', result.newVersion)
            logger.info('[App] 检测到版本更新，已同步版本到前端', { oldVersion: result.oldVersion, newVersion: result.newVersion })
          } catch (e) {
            logger.warn('[App] 同步版本到前端失败', { error: e instanceof Error ? e.message : String(e) })
          }
          showAppChangelogDialog.value = true
        }
      } catch (e) {
        console.error('[App] 版本更新检测失败:', e)
      }
    } else {
      // 非 Electron 端：检查持久化的版本号
      try {
        const storedVersion = await getSystemStateField('version')
        if (storedVersion !== appVersion) {
          await setSystemStateField('version', appVersion)
          logger.info('[App] 检测到版本更新', { oldVersion: storedVersion, newVersion: appVersion })
          showAppChangelogDialog.value = true
        }
      } catch (e) {
        logger.warn('[App] 非 Electron 版本检测失败', { error: e instanceof Error ? e.message : String(e) })
      }
      // 检查 GitHub 是否有新版本
      try {
        const res = await fetch('https://api.github.com/repos/XueWerY/earth-survival-diary/releases/latest')
        if (res.ok) {
          const data = await res.json()
          const latestVersion = (data.tag_name || '').replace(/^v/, '')
          if (latestVersion && latestVersion !== appVersion) {
            updateStatus.value = 'available'
            updateVersion.value = latestVersion
            updateDialogVisible.value = true
          }
        }
      } catch { /* GitHub 不可达，静默跳过 */ }
    }
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

// 暴露全局函数供 ProfilePage 调用（非 Electron 端使用）
(window as any).__checkForUpdate = async () => {
  updateStatus.value = 'checking'
  updateDialogVisible.value = true
  try {
    const res = await fetch('https://api.github.com/repos/XueWerY/earth-survival-diary/releases/latest')
    if (!res.ok) throw new Error('网络请求失败')
    const data = await res.json()
    const latestVersion = (data.tag_name || '').replace(/^v/, '')
    if (latestVersion && latestVersion !== appVersion) {
      updateStatus.value = 'available'
      updateVersion.value = latestVersion
    } else {
      updateStatus.value = 'no-update'
    }
  } catch (e) {
    updateStatus.value = 'error'
    updateMessage.value = e instanceof Error ? e.message : '检查失败'
  }
  if (updateStatus.value === 'no-update') {
    if (updateNoUpdateTimer) clearTimeout(updateNoUpdateTimer)
    updateNoUpdateTimer = setTimeout(() => {
      updateDialogVisible.value = false
    }, 1500)
  }
}

/** 将字符串 ID 哈希为非负整数，用于 Android 通知 ID */
const hashStringId = (id: string): number => {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 2147483647
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

const scheduleListReminders = async () => {
  const isAndroidCapacitor = typeof window !== 'undefined' && !(window as any).electronAPI && typeof (window as any).Capacitor !== 'undefined'
  if (!window.electronAPI?.scheduleReminders && !isAndroidCapacitor) return
  try {
    const now = dayjs()
    const today = now.startOf('day')
    const persistDuration = settingsStore.settings?.reminderPersistDuration ?? 30
    const reminders: { id: string; name: string; body: string; triggerTime: string; listName?: string; groupName?: string; folderName?: string; repeatStrategy?: string; repeatCustomDays?: number; repeatEndStrategy?: string; repeatEndDate?: string; repeatCount?: number; repeatCompletedCount?: number; reminderStrategy?: string; reminderDays?: number; reminderHours?: number; reminderMinutes?: number; endTime?: string }[] = []

    const lists = listStore.lists.filter(m => !m.completed && m.reminderStrategy !== 'none' && m.date)

    for (const m of lists) {
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
      let folderName = ''
      const list = listStore.taskLists.find(l => l.id === m.listId)
      if (list) {
        listName = list.name
        const group = list.groups.find(g => g.id === m.groupId)
        if (group) groupName = group.name
        const folder = listStore.folders.find(f => f.listIds.includes(m.listId))
        if (folder) folderName = folder.name
      }

      reminders.push({
        id: m.id,
        name: m.name,
        body: bodyParts.join(' · '),
        triggerTime: triggerTime.toISOString(),
        listName,
        groupName,
        folderName,
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
            reminderMinutes: cm.reminderMinutes,
            targetDate: cm.targetDate
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
          name: timerState.name || '专注完成',
          body: '专注完成，请放松一下吧',
          triggerTime: new Date(now + remaining * 1000).toISOString(),
          repeatStrategy: 'none',
          focusDuration: timerState.targetDuration
        })
        logger.info('[提醒] 专注提醒已加入调度', { name: '专注完成' })
      }
    }

    // 正计时整点专注提醒
    if (timerState && timerState.type === 'stopwatch') {
      const now = Date.now()
      const elapsedMs = now - timerState.startTimestamp
      const elapsedMinutes = Math.floor(elapsedMs / 60000)
      const nextHourMark = (Math.floor(elapsedMinutes / 60) + 1) * 60
      const minutesUntilNextHour = nextHourMark - elapsedMinutes
      const triggerTime = new Date(now + minutesUntilNextHour * 60000).toISOString()
      reminders.push({
        id: 'focus-hourly',
        name: timerState.name || '专注提醒',
        body: `您已专注${nextHourMark / 60}小时，请放松一下吧！`,
        triggerTime,
        repeatStrategy: 'hourly',
        focusStartTimestamp: timerState.startTimestamp
      })
      logger.info('[提醒] 正计时整点提醒已加入调度', { nextHourMark, triggerTime })
    }

    const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const addMinutes = (time: string, minutes: number) => {
      const total = timeToMinutes(time) + minutes
      const h = Math.floor(total / 60) % 24
      const m = total % 60
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }

    const getCourseStartTime = (periodIds: number[], cs: any): string => {
      if (!periodIds || periodIds.length === 0) return cs?.firstPeriodStart || '08:00'
      const firstStart = cs?.firstPeriodStart || '08:00'
      const dur = cs?.periodDuration || 45
      const brk = cs?.breakDuration || 10
      const lunch = cs?.lunchBreakMinutes ?? 120
      const dinner = cs?.dinnerBreakMinutes ?? 90
      const counts = cs?.periodCountPerSession || { morning: 4, afternoon: 4, evening: 2 }
      const { morning, afternoon, evening } = counts
      const periods: { id: number; start: string; end: string }[] = []
      let cur = firstStart
      let idNum = 1
      const addSession = (cnt: number) => {
        for (let i = 0; i < cnt; i++) {
          const end = addMinutes(cur, dur)
          periods.push({ id: idNum++, start: cur, end })
          cur = addMinutes(end, brk)
        }
      }
      addSession(morning)
      if (morning > 0 && afternoon > 0) cur = addMinutes(periods[periods.length - 1].end, lunch)
      else if (morning === 0 && afternoon > 0) cur = firstStart
      addSession(afternoon)
      if (afternoon > 0 && evening > 0) cur = addMinutes(periods[periods.length - 1].end, dinner)
      else if (afternoon === 0 && evening > 0) cur = firstStart
      addSession(evening)
      const firstP = periods.find(p => p.id === Math.min(...periodIds))
      return firstP?.start || firstStart
    }

    try {
      const courseSettings = settingsStore.settings.course
      const courseReminderMinutes = courseSettings?.reminderMinutes ?? 5
      const semesterStartDate = courseSettings?.semesterStartDate
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
            if (!course.periodIds || course.periodIds.length === 0) continue
            const dwList = Array.isArray(course.dayOfWeek) ? course.dayOfWeek : [course.dayOfWeek]
            if (!dwList || dwList.length === 0) continue
            const sortedWeeks = [...course.weeks].sort((a: number, b: number) => a - b)
            const startTime = getCourseStartTime(course.periodIds, courseSettings)
            for (const dw of dwList) {
              const dayOffset = dw === 0 ? 6 : dw - 1
              for (const week of sortedWeeks) {
                if (week < currentWeek) continue
                const classDate = semesterMonday.add((week - 1) * 7 + dayOffset, 'day')
                const triggerTime = dayjs(classDate.format('YYYY-MM-DD') + 'T' + startTime).subtract(courseReminderMinutes, 'minute')
                if (triggerTime.valueOf() <= now.valueOf() - 60000) continue
                if (triggerTime.valueOf() > now.valueOf() + MAX_SCHEDULE_DELAY) break
                reminders.push({
                  id: `course-${course.id}-${dw}`,
                  name: course.name,
                  body: `「${course.name}」即将开始`,
                  triggerTime: triggerTime.toISOString(),
                  repeatStrategy: 'weekly'
                })
                courseCount++
                break
              }
            }
          }
          if (courseCount > 0) logger.info('[提醒] 课程提醒已加入调度', { count: courseCount })
        }
      }
    } catch (e) {
      logger.warn('[提醒] 获取课程数据失败', { error: e instanceof Error ? e.message : String(e) })
    }

    logger.info('[提醒] 调度提醒任务', { count: reminders.length, persistDuration })
    if (window.electronAPI?.scheduleReminders) {
      window.electronAPI.scheduleReminders(reminders, persistDuration)
    } else if (isAndroidCapacitor) {
      // Android 端：使用 JS 定时器调度提醒（替代系统通知）
      reminderTimers.forEach(t => clearTimeout(t))
      reminderTimers.length = 0
      const nowMs = Date.now()
      // 按触发时间排序，相同触发时间的提醒间隔 5 秒依次弹出
      const sortedReminders = [...reminders].sort((a, b) => new Date(a.triggerTime).getTime() - new Date(b.triggerTime).getTime())
      let lastScheduledMs = 0
      for (const r of sortedReminders) {
        const triggerMs = new Date(r.triggerTime).getTime()
        let delay = triggerMs - nowMs
        if (delay > 0 && delay < MAX_REMINDER_DELAY) {
          // 与前一个提醒至少保持 5 秒间隔，避免同时弹出一堆卡片
          delay = Math.max(delay, lastScheduledMs + 5000)
          lastScheduledMs = delay
          const timer = setTimeout(() => {
            activeReminders.value.push(r)
            playReminderSound()
          }, delay)
          reminderTimers.push(timer)
        }
      }
    }
  } catch (e) {
    logger.error('[提醒] 调度失败', { error: e instanceof Error ? e.message : String(e) })
  }
}

provide('refreshReminders', scheduleListReminders)
provide('isElectron', isElectron)

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

/** 为新用户创建默认数据（默认清单、示例任务、默认课程、示例足迹、示例日记） */
const ensureDefaultData = async () => {
  try {
    const initialized = await getSystemStateField('defaultsInitialized')
    if (initialized) return

    // 已有数据则跳过（避免覆盖已有数据）
    if (listStore.taskLists.length > 0) {
      await setSystemStateField('defaultsInitialized', true)
      return
    }

    // 1. 创建默认清单（含默认分组）
    const newList = await listStore.addList('默认清单', DEFAULT_LIST_COLORS[0])
    if (!newList) {
      logger.error('[App] 创建默认清单失败')
      return
    }

    // 2. 创建示例任务
    const defaultGroup = newList.groups[0]
    if (defaultGroup) {
      const now = dayjs()
      await listStore.addTask({
        name: '这是一个任务',
        listId: newList.id,
        groupId: defaultGroup.id,
        date: now.format('YYYY-MM-DD'),
        endTime: now.format('HH:mm'),
        repeatStrategy: 'none',
        repeatCustomDays: 1,
        repeatWeekdays: [],
        repeatMonthDay: 1,
        repeatLunarMonth: 1,
        repeatLunarDay: 1,
        repeatEndStrategy: 'never',
        repeatEndDate: '',
        repeatCount: 1,
        priority: 'medium',
        checklist: [],
        completed: false,
        completedStartTime: '',
        completedEndTime: '',
        notes: '这里是备注',
        reminderStrategy: 'advance',
        reminderDays: 0,
        reminderHours: 0,
        reminderMinutes: 15
      })
      logger.info('[App] 已创建示例任务')
    }

    // 3. 创建默认课程（日期为今日对应的周几）
    const todayWeekday = dayjs().day() // 0=周日, 1=周一, ..., 6=周六
    const courseDayOfWeek = todayWeekday === 0 ? 7 : todayWeekday // 转为课程系统：1=周一...7=周日
    const courses = (await getData<any[]>('course', 'courses')) || []
    courses.push({
      id: Date.now().toString(),
      name: '这是一门课程',
      dayOfWeek: [courseDayOfWeek],
      periodIds: [1],
      location: '地球',
      teacher: '官方',
      color: '#667eea',
      weeks: [],
      note: '这里是备注',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    await setData('course', 'courses', courses)
    logger.info('[App] 已创建默认课程')

    // 4. 创建示例足迹记录
    const taskNow = dayjs()
    await taskStore.addTask({
      name: '这是一个足迹',
      date: taskNow.format('YYYY-MM-DD'),
      startTime: taskNow.subtract(1, 'minute').format('HH:mm'),
      endTime: taskNow.format('HH:mm'),
      notes: '这里是备注'
    })
    logger.info('[App] 已创建示例足迹')

    // 5. 创建示例日记
    await taskStore.addTask({
      name: '这是一篇日记',
      date: taskNow.format('YYYY-MM-DD'),
      startTime: '',
      endTime: '',
      notes: '这里是备注',
      category: 'diary'
    })
    logger.info('[App] 已创建示例日记')

    // 6. 标记为已初始化
    await setSystemStateField('defaultsInitialized', true)
    logger.info('[App] 默认数据初始化完成')
  } catch (error) {
    logger.error('[App] 创建默认数据失败', { error: error instanceof Error ? error.message : String(error) })
  }
}

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
      listStore.loadData(),
      settingsStore.loadSettings(),
      focusStore.loadData(),
      preloadCountdownData(),
      preloadCourseData(),
    ])

    logger.debug('[App] 并行加载完成')

    // 为新用户创建默认数据
    await ensureDefaultData()

    logger.info('[App] 数据初始化完成')

    cleanUpCourseAutoRecordedTasks()

    scheduleListReminders()

    // 成功登录后立即加载自动清理日志设置并执行清理
    runAutoCleanAfterLogin()

    // 启动后应用已保存的窗口分辨率设置
    if (window.electronAPI?.applyWindowSize && authStore.user?.id) {
      window.electronAPI.applyWindowSize(authStore.user.id).catch((e: any) => {
        logger.warn('[App] 应用窗口分辨率失败', { error: e instanceof Error ? e.message : String(e) })
      })
    }

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

// 成功登录后加载自动清理日志设置并执行清理
function runAutoCleanAfterLogin() {
  const autoClean = (settingsStore.settings as any)?.autoClean
  if (!autoClean?.enabled) return
  const days = autoClean.days ?? 30
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - days)
  const thresholdStr = thresholdDate.toISOString().slice(0, 10)

  const electronAPI = (window as any).electronAPI
  if (electronAPI?.getLogDirPath) {
    electronAPI.getLogDirPath().then((logDirPath: string) => {
      return electronAPI.readDirectory(logDirPath)
    }).then((items: any[]) => {
      const promises = items
        .filter((item: any) => !item.isDirectory)
        .map((item: any) => {
          const m = item.name.match(/app-(\d{4}-\d{2}-\d{2})\.log/)
          if (m && m[1] < thresholdStr) {
            return electronAPI.deleteFilePath(item.path)
          }
        })
        .filter(Boolean)
      return Promise.all(promises)
    }).then(() => {
      logger.info('[App] 登录后自动清理日志完成', { threshold: thresholdStr })
    }).catch((e: any) => {
      logger.error('[App] 登录后自动清理日志失败', { error: e })
    })
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

const focusDisplayTime = ref('')
let focusDisplayTimer: ReturnType<typeof setInterval> | null = null

const updateFocusDisplayTime = () => {
  const state = focusStore.timerState
  if (!state) {
    focusDisplayTime.value = ''
    return
  }
  const now = Date.now()
  const elapsedSinceStart = Math.floor((now - state.startTimestamp) / 1000)
  let totalSeconds: number
  if (state.type === 'pomodoro') {
    totalSeconds = Math.max(0, state.targetDuration * 60 - elapsedSinceStart)
  } else {
    totalSeconds = Math.max(0, elapsedSinceStart)
  }

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (days > 0 || totalSeconds >= 86400) {
    focusDisplayTime.value = `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  } else if (hours > 0 || totalSeconds >= 3600) {
    focusDisplayTime.value = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  } else {
    focusDisplayTime.value = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
}

watch(() => focusStore.timerState, (state) => {
  if (focusDisplayTimer) {
    clearInterval(focusDisplayTimer)
    focusDisplayTimer = null
  }
  if (state) {
    updateFocusDisplayTime()
    focusDisplayTimer = setInterval(updateFocusDisplayTime, 1000)
  } else {
    focusDisplayTime.value = ''
  }
}, { immediate: true })

const starCanvas = ref<HTMLCanvasElement>()
let animationId: number
let resizeHandler: (() => void) | null = null

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
    scheduleListReminders()
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

  // 已登录时加载数据并调度提醒
  if (authStore.isAuthenticated) {
    await initializeData()
    scheduleListReminders()
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
    syncStarCount()
  }
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  window.addEventListener('resize', resizeHandler)

  // 创建彩色星星
  const stars: Array<{
    x: number
    y: number
    radius: number
    opacity: number
    color: string
    twinkleSpeed: number
    vx: number
    vy: number
  }> = []
  const starPalette = ['#ffffff', '#ffe8d0', '#d0e8ff', '#ffd0d0', '#fff0d0', '#d0ffd0', '#d0d0ff']
  const starDensity = 3 / 5000 // 每像素的星星密度（原版 3 倍）
  const syncStarCount = () => {
    const target = Math.floor(canvas.width * canvas.height * starDensity)
    while (stars.length < target) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.7 + 0.3,
        color: starPalette[Math.floor(Math.random() * starPalette.length)],
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02
      })
    }
    while (stars.length > target) {
      stars.pop()
    }
  }
  syncStarCount()

  // 创建流星
  const meteors: Meteor[] = []

  const createMeteor = () => {
    if (Math.random() < 0.035 && meteors.length < 3) {
      const edge = Math.floor(Math.random() * 4) // 0:上 1:右 2:下 3:左
      let x: number, y: number
      switch (edge) {
        case 0: x = Math.random() * canvas.width; y = 0; break
        case 1: x = canvas.width; y = Math.random() * canvas.height; break
        case 2: x = Math.random() * canvas.width; y = canvas.height; break
        default: x = 0; y = Math.random() * canvas.height; break
      }
      meteors.push({
        x,
        y,
        length: Math.random() * 80 + 50,
        speed: Math.random() * 0.3 + 0.1,
        opacity: 1,
        angle: Math.random() * Math.PI * 2
      })
    }
  }

  // 动画循环（只渲染流星）
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 渲染彩色星星
    stars.forEach(star => {
      star.opacity += star.twinkleSpeed
      if (star.opacity > 1 || star.opacity < 0.3) {
        star.twinkleSpeed = -star.twinkleSpeed
      }

      ctx.beginPath()
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
      ctx.fillStyle = star.color
      ctx.globalAlpha = star.opacity
      ctx.fill()
      ctx.globalAlpha = 1

      if (star.radius > 1) {
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.radius * 2, 0, Math.PI * 2)
        ctx.fillStyle = star.color
        ctx.globalAlpha = star.opacity * 0.12
        ctx.fill()
        ctx.globalAlpha = 1
      }

      star.x += star.vx
      star.y += star.vy
      if (star.y > canvas.height) {
        star.y = 0
        star.x = Math.random() * canvas.width
      } else if (star.y < 0) {
        star.y = canvas.height
        star.x = Math.random() * canvas.width
      }
      if (star.x > canvas.width) {
        star.x = 0
        star.y = Math.random() * canvas.height
      } else if (star.x < 0) {
        star.x = canvas.width
        star.y = Math.random() * canvas.height
      }
    })

    createMeteor()

    meteors.forEach((meteor, index) => {
      meteor.x += Math.cos(meteor.angle) * meteor.speed
      meteor.y += Math.sin(meteor.angle) * meteor.speed

      if (meteor.x < 0 || meteor.x > canvas.width || meteor.y < 0 || meteor.y > canvas.height) {
        meteors.splice(index, 1)
        return
      }

      const headX = meteor.x
      const headY = meteor.y

      const trailDx = -Math.cos(meteor.angle)
      const trailDy = -Math.sin(meteor.angle)
      const txs: number[] = []
      if (trailDx > 0) txs.push((canvas.width - headX) / trailDx)
      if (trailDx < 0) txs.push(-headX / trailDx)
      if (trailDy > 0) txs.push((canvas.height - headY) / trailDy)
      if (trailDy < 0) txs.push(-headY / trailDy)
      const t = Math.min(...txs)
      const trailEndX = headX + trailDx * t
      const trailEndY = headY + trailDy * t

      const trailGradient = ctx.createLinearGradient(trailEndX, trailEndY, headX, headY)
      trailGradient.addColorStop(0, 'rgba(150, 210, 255, 0)')
      trailGradient.addColorStop(0.3, 'rgba(150, 210, 255, 0.08)')
      trailGradient.addColorStop(0.7, 'rgba(180, 220, 255, 0.2)')
      trailGradient.addColorStop(1, 'rgba(200, 230, 255, 0.4)')

      ctx.beginPath()
      ctx.moveTo(trailEndX, trailEndY)
      ctx.lineTo(headX, headY)
      ctx.strokeStyle = trailGradient
      ctx.lineWidth = 2
      ctx.stroke()

      const headGlow = ctx.createRadialGradient(headX, headY, 0, headX, headY, 12)
      headGlow.addColorStop(0, 'rgba(255, 240, 150, 1)')
      headGlow.addColorStop(0.3, 'rgba(255, 200, 50, 0.8)')
      headGlow.addColorStop(0.6, 'rgba(255, 160, 30, 0.3)')
      headGlow.addColorStop(1, 'rgba(255, 160, 30, 0)')

      ctx.beginPath()
      ctx.arc(headX, headY, 12, 0, Math.PI * 2)
      ctx.fillStyle = headGlow
      ctx.fill()

      const rainbowGlow = ctx.createRadialGradient(headX, headY, 6, headX, headY, 20)
      rainbowGlow.addColorStop(0, 'rgba(255, 200, 100, 0.4)')
      rainbowGlow.addColorStop(0.5, 'rgba(255, 150, 200, 0.2)')
      rainbowGlow.addColorStop(0.7, 'rgba(130, 180, 255, 0.15)')
      rainbowGlow.addColorStop(1, 'rgba(130, 180, 255, 0)')

      ctx.beginPath()
      ctx.arc(headX, headY, 20, 0, Math.PI * 2)
      ctx.fillStyle = rainbowGlow
      ctx.fill()

      ctx.beginPath()
      ctx.arc(headX, headY, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 220, 1)'
      ctx.fill()
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
  if (focusDisplayTimer) {
    clearInterval(focusDisplayTimer)
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
  padding-top: var(--safe-area-inset-top, 0px);
  padding-bottom: var(--safe-area-inset-bottom, 0px);
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
  width: 500px;
  margin: 0 auto;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: auto;
}

@media (max-width: 500px) {
  .nav-bar-bottom {
    width: 80%;
  }
}

.nav-bar-bottom .nav-items-scroll {
  justify-content: flex-start;
}

.nav-bar-bottom .nav-items-scroll::before,
.nav-bar-bottom .nav-items-scroll::after {
  content: '';
  flex: 1;
  min-width: 0;
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

.focus-status-indicator {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(30, 28, 52, 0.92);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 12px;
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.focus-status-icon {
  font-size: 16px;
}

.focus-status-text {
  font-size: 13px;
  color: var(--chalk-white);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-status-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--chalk-primary);
  font-variant-numeric: tabular-nums;
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
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 3000;
  width: 380px;
  max-width: 80vw;
  background: rgba(20, 16, 55, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  animation: changelogFadeIn 0.3s ease-out;
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
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2900;
  pointer-events: none;
  width: 300px;
}

.reminder-stack :deep(.reminder-card) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.changelog-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 3000;
  width: 480px;
  max-width: 80vw;
  max-height: 85vh;
  background: rgba(20, 16, 55, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  animation: changelogFadeIn 0.3s ease-out;
}

@keyframes changelogFadeIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
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

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10000;
}

.context-menu {
  position: fixed;
  z-index: 10001;
  background: rgba(30, 28, 52, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 4px 0;
  min-width: 150px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
}

.context-menu-item {
  padding: 8px 16px;
  font-size: 13px;
  color: var(--chalk-white-85);
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}

.context-menu-item:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.context-menu-item-danger {
  color: var(--chalk-red);
}

.context-menu-item-danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--chalk-red);
}

.context-menu-divider {
  height: 1px;
  margin: 4px 8px;
  background: rgba(255, 255, 255, 0.08);
}

.split-container {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.split-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.split-panel-nav-bar {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.split-panel-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.split-divider {
  width: 4px;
  cursor: col-resize;
  background: rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
</style>
