<template>
  <ScrollbarManager />
  <BirthdayCelebration
    :visible="birthdayCelebrationVisible"
    :nickname="birthdayCelebrationNickname"
    @close="birthdayCelebrationVisible = false"
  />
  <div v-if="isElectron" class="app-container desktop-layout">
    <!-- Canvas 2D 流星背景 -->
    <canvas ref="starCanvas" class="star-canvas" :class="{ 'canvas-hidden': !showStarCanvas }"></canvas>

    <!-- 计时中跨页面常驻弹窗 -->
    <FloatingTimerBar class="focus-timer-floating" />

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
      <!-- 主导航栏 - 桌面端左侧导航区 -->
      <MainNav
        :collapsed="navCollapsed"
        :activeModule="pageNav.currentModule.value"
        :hidden="isFocusFullscreen"
        @navigate="navigateTo"
        @toggle="toggleNav"
      />
      <!-- 主内容区域 -->
      <main class="main-content">
        <div class="panel-wrapper">
          <ErrorDialog
            :visible="!!capturedError"
            :message="capturedError || ''"
            title="应用发生错误"
            @update:visible="capturedError = null"
          />
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
        :navigating="guideNavigationBusy"
        @prev="handleGuidePrev"
        @next="handleGuideNext"
        @skip="handleGuideSkip"
        @exit="handleGuideExit"
      />

      <!-- 版本更新/更新日志面板 -->
      <template v-if="!guideVisible">
      <BaseDialog :visible="updateDialogVisible" title="版本更新" :width="380" :z-index="10000" noOverlayClose @update:visible="updateDialogVisible = false">
        <div class="update-status" :class="{ 'update-error': updateStatus === 'error', 'update-no-new': updateStatus === 'no-update' }" style="text-align: center;">
          <template v-if="updateStatus === 'available'">
            <p>发现新版本 v{{ updateVersion }}</p>
            <p class="update-hint">
              <template v-if="updateDownloadUrl">
                前往 GitHub Releases 下载：
                <a class="update-link" :href="updateDownloadUrl" @click.prevent="openUpdateUrl">查看发布页</a>
              </template>
            </p>
          </template>
          <template v-else-if="updateStatus === 'downloading'">
            <el-progress type="line" :percentage="updatePercent" :stroke-width="10" />
          </template>
          <template v-else>{{ updateStatusText }}</template>
        </div>
        <div v-if="updateStatus === 'error' && updateMessage" class="update-message">
          {{ updateMessage }}
        </div>
        <template #footer>
          <el-button v-if="updateStatus === 'available'" type="primary" @click="handleDownloadUpdate">前往 GitHub 下载</el-button>
          <el-button v-else type="primary" @click="updateDialogVisible = false">确认</el-button>
        </template>
      </BaseDialog>

      <BaseDialog :visible="showAppChangelogDialog" title="更新日志" :width="480" @update:visible="showAppChangelogDialog = $event">
        <div v-html="appChangelogHtml"></div>
        <template #footer>
          <el-button type="primary" @click="showAppChangelogDialog = false">确认</el-button>
        </template>
      </BaseDialog>
      </template>
      <div class="reminder-stack">
        <ReminderCard v-for="(r, i) in activeReminders" :key="r.id" :reminder="r" @dismiss="dismissReminder(i)" />
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick, provide, onErrorCaptured } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AuthPage from './components/auth/AuthPage.vue'
import BaseDialog from './components/ui/BaseDialog.vue'
import FloatingTimerBar from './components/timer/FloatingTimerBar.vue'
import ScrollbarManager from './components/common/scrollbar/ScrollbarManager.vue'
import { useTaskStore } from './stores/taskStore'
import { useListStore, DEFAULT_LIST_COLORS } from './stores/listStore'
import { taskChecklistChangeDetails, taskCompletionChangeDetails, taskCompletionChangeVersion } from './lib/taskCompletionEvents'
import { useNoteStore } from './stores/noteStore'
import ReminderCard from './components/common/card/ReminderCard.vue'
import { useAuthStore } from './stores/authStore'
import { useSettingsStore } from './stores/settingsStore'
import { useFocusStore } from './stores/focusStore'
import { getData, setData, preloadData, clearCache, getSystemStateField, setSystemStateField } from './services/storageService'
import { fetchLatestReleaseVersion, UPDATE_BASE_URL } from './services/versionChecker'
import { logger } from './lib/logger'
import { usePageNav, MODULE_ROUTES } from './composables/usePageNav'
import ErrorDialog from './components/ui/ErrorDialog.vue'
import MainNav from './components/common/nav/MainNav.vue'
import dayjs from 'dayjs'
import { getNextAnnualDate, solarDateToLunarParts } from './utils/annualDate'
// @ts-expect-error - Vite raw import
import changelogContent from '../CHANGELOG.md?raw'
import appVersion from 'virtual:version'
import GuideOverlay from './components/common/overlay/GuideOverlay.vue'
import BirthdayCelebration from './components/common/overlay/BirthdayCelebration.vue'
import { guideSteps } from './data/guideSteps'
import { ElMessage } from 'element-plus'
import { LunarMonth as BirthdayLunarMonth, LunarYear as BirthdayLunarYear, Solar as BirthdaySolar } from 'lunar-javascript'

const router = useRouter()
const route = useRoute()

const VALID_ROUTES = ['footprint', 'notes', 'list', 'countdown', 'course', 'statistics', 'toolbox', 'profile']
const MAX_SCHEDULE_DELAY = 20 * 24 * 3600 * 1000

const pageNav = usePageNav()

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electronAPI)

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
const noteStore = useNoteStore()
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

const capturedError = ref<string | null>(null)

onErrorCaptured((err, instance, info) => {
  const errMsg = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err)
  logger.error('[App] 捕获应用错误', { error: errMsg, info })
  capturedError.value = `[${info}] ${errMsg}`
  return false
})

// 认证成功处理
const handleAuthSuccess = () => {
  logger.info('[App] 登录/注册成功，准备刷新页面')
  // 直接刷新页面，确保所有状态完全重置
  window.location.reload()
}

const resetAuthenticatedState = () => {
  if (window.electronAPI?.cancelAllReminders) {
    window.electronAPI.cancelAllReminders()
  }
  // 重置所有 store 状态
  taskStore.reset()
  listStore.reset()
  noteStore.reset()
  focusStore.reset()
  settingsStore.reset()
  // 清除所有缓存数据
  clearCache()
  dataInitialized.value = false
  isInitializing.value = false
  // 更新用户标识，强制 keep-alive 组件重新渲染
  userKey.value++
}

const handleLogout = async () => {
  logger.info('[App] 用户退出登录')
  resetAuthenticatedState()
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
  await scheduleListReminders('生日资料更新')
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
const updateStatus = ref<'checking' | 'available' | 'error' | 'no-update' | 'downloading' | 'downloaded'>('checking')
const updateVersion = ref('')
const updateMessage = ref('')
const updateDownloadUrl = ref('')
const updatePercent = ref(0)

const updateStatusText = computed(() => {
  switch (updateStatus.value) {
    case 'checking': return '正在检查更新...'
    case 'error': return '更新检查失败'
    case 'no-update': return '已是最新版本'
    case 'downloading': return `正在下载更新... ${updatePercent.value}%`
    case 'downloaded': return '下载完成，点击下方按钮安装更新'
    default: return ''
  }
})

const openUpdateUrl = () => {
  const url = updateDownloadUrl.value || UPDATE_BASE_URL
  logger.info('[App] 用户前往 GitHub Releases')
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

const versionChecksStarted = ref(false)

const startVersionChecks = async () => {
  if (versionChecksStarted.value) return
  versionChecksStarted.value = true
  logger.info('[更新] 开始版本检测')
  if (authStore.user?.id) {
    try {
      const storedVersion = await getSystemStateField('version')
      if (storedVersion !== appVersion) {
        await setSystemStateField('version', appVersion)
        logger.info('[App] 客户端版本记录已更新', { oldVersion: storedVersion, newVersion: appVersion })
        showAppChangelogDialog.value = true
      }
    } catch (e) {
      logger.warn('[App] 本地版本状态读取失败', { error: e instanceof Error ? e.message : String(e) })
    }
    void checkRemoteUpdate(appVersion)
  }
}

/** 检查 GitHub Releases 的最新版本，安装包由用户在浏览器中下载。 */
const checkRemoteUpdate = async (currentVersion: string) => {
  try {
    const result = await fetchLatestReleaseVersion(currentVersion)
    if (result.error) {
      logger.warn('[更新] 版本检测失败', { error: result.error })
      return
    }
    if (result.hasUpdate && result.latestVersion) {
      updateStatus.value = 'available'
      updateVersion.value = result.latestVersion
      updateDownloadUrl.value = result.downloadUrl || ''
      updateDialogVisible.value = true
      logger.info('[更新] GitHub Releases 有新版本', { current: currentVersion, latest: result.latestVersion })
    } else {
      logger.info('[更新] 版本检测完成，当前无可用更新', { current: currentVersion })
    }
  } catch (error) {
    logger.warn('[更新] 版本检测失败', { error: error instanceof Error ? error.message : String(error) })
  }
}

const setupUpdateStatusListener = () => {
  if (!window.electronAPI?.onUpdateStatus) return
  window.electronAPI.onUpdateStatus((data) => {
    logger.info('[App] 收到更新状态', data)
    if (data.status === 'available') {
      updateStatus.value = 'available'
      updateVersion.value = data.version || ''
      updateDownloadUrl.value = data.downloadUrl || updateDownloadUrl.value
      updateDialogVisible.value = true
    } else if (data.status === 'downloading') {
      updateStatus.value = 'downloading'
      updatePercent.value = data.percent || 0
    } else if (data.status === 'downloaded') {
      updateStatus.value = 'downloaded'
    } else if (data.status === 'error') {
      updateStatus.value = 'error'
      updateMessage.value = data.message || ''
      updateDialogVisible.value = true
    } else if (data.status === 'no-update') {
      updateStatus.value = 'no-update'
      updateDialogVisible.value = true
    }
  })
}

/** 打开 GitHub Releases，用户自行下载并安装。 */
const handleDownloadUpdate = () => openUpdateUrl()

// 暴露全局函数供 ProfilePage 调用（非 Electron 端使用）
(window as any).__checkForUpdate = async () => {
  updateStatus.value = 'checking'
  updateDialogVisible.value = true
  try {
    const result = await fetchLatestReleaseVersion(appVersion)
    if (result.error) {
      updateStatus.value = 'error'
      updateMessage.value = result.error
    } else if (result.hasUpdate && result.latestVersion) {
      updateStatus.value = 'available'
      updateVersion.value = result.latestVersion
      updateDownloadUrl.value = result.downloadUrl || ''
    } else {
      updateStatus.value = 'no-update'
    }
  } catch (e) {
    updateStatus.value = 'error'
    updateMessage.value = e instanceof Error ? e.message : '检查失败'
  }
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

const scheduleListReminders = async (reason = '外部模块主动刷新') => {
  if (!window.electronAPI?.scheduleReminders) return
  const userId = authStore.user?.id
  if (!userId) return
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
            nextDate = dayjs(getNextAnnualDate(
              cm.targetDate,
              cm.repeatCalendar === 'lunar' ? 'lunar' : 'solar',
              cm.lunarMonth,
              cm.lunarDay,
              today.format('YYYY-MM-DD')
            ))
            if (!nextDate.isValid()) continue
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
        const countdownReminderCount = countdownMilestones.filter((cm: any) => cm.reminderStrategy && cm.reminderStrategy !== 'none' && cm.countMode !== 'countup').length
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
      const mode = cs?.breakMode || 'uniform'
      const customBks = cs?.customBreakDurations || []
      const lunch = cs?.lunchBreakMinutes ?? 120
      const dinner = cs?.dinnerBreakMinutes ?? 90
      const counts = cs?.periodCountPerSession || { morning: 4, afternoon: 4, evening: 2 }
      const { morning, afternoon, evening } = counts
      const periods: { id: number; start: string; end: string }[] = []
      let cur = firstStart
      let idNum = 1
      let customGapIdx = 0
      const addSession = (cnt: number) => {
        for (let i = 0; i < cnt; i++) {
          const end = addMinutes(cur, dur)
          periods.push({ id: idNum++, start: cur, end })
          if (i < cnt - 1) {
            cur = addMinutes(end, mode === 'custom' ? (customBks[customGapIdx] ?? brk) : brk)
            customGapIdx++
          } else {
            cur = addMinutes(end, brk)
          }
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
            if (!course.periodIds || course.periodIds.length === 0) continue
            const dwList = Array.isArray(course.dayOfWeek) ? course.dayOfWeek : [course.dayOfWeek]
            if (!dwList || dwList.length === 0) continue
            // weeks 为空数组表示全部周（与 CourseSchedule.vue 一致）
            const sortedWeeks = course.weeks && course.weeks.length > 0
              ? [...course.weeks].sort((a: number, b: number) => a - b)
              : Array.from({ length: courseSettings?.totalWeeks || 20 }, (_, i) => i + 1)
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
                  repeatStrategy: 'weekly',
                  courseStartTime: classDate.format('YYYY-MM-DD') + 'T' + startTime
                })
                courseCount++
                break
              }
            }
          }
        }
      }
    } catch (e) {
      logger.warn('[提醒] 获取课程数据失败', { error: e instanceof Error ? e.message : String(e) })
    }

    if (authStore.user?.id !== userId) {
      logger.debug('[提醒] 生成提醒期间用户已切换，丢弃旧调度请求', { userId })
      return
    }
    await window.electronAPI.scheduleReminders(userId, reminders, persistDuration, reason)
  } catch (e) {
    logger.error('[提醒] 调度失败', { error: e instanceof Error ? e.message : String(e) })
  }
}

const isChecklistToggleCaller = () => Boolean(new Error().stack?.includes('toggleChecklistItem'))
provide('refreshReminders', (reason?: string) => {
  if (!reason && isChecklistToggleCaller()) {
    const change = taskChecklistChangeDetails.value
    const taskLabel = change
      ? `${change.taskName}（${change.taskId}）`
      : '未知任务'
    logger.debug(`[Reminder] 检查事项变更，任务 = ${taskLabel}，跳过提醒计划更新`)
    return
  }
  return scheduleListReminders(reason || '外部模块主动刷新')
})
provide('isElectron', isElectron)

const countdownMilestones = ref<any[]>([])
const countdownCategories = ref<any[]>([])
provide('countdownMilestones', countdownMilestones)
provide('countdownCategories', countdownCategories)

watch(taskCompletionChangeVersion, () => {
  if (!dataInitialized.value) return
  const change = taskCompletionChangeDetails.value
  const reason = change
    ? `任务完成状态变化，任务编号 = ${change.taskId}，${change.previous ? '已完成' : '未完成'} → ${change.completed ? '已完成' : '未完成'}`
    : '任务完成状态变化'
  void scheduleListReminders(reason)
})

const guideVisible = ref(false)
const guideCurrentIndex = ref(0)
const guideCompleted = ref(false)
const guideRunning = ref(false)
const guideStartBusy = ref(false)
const guideNavigationBusy = ref(false)

const navigateGuideToStep = async (index: number) => {
  if (guideNavigationBusy.value) return
  const step = guideSteps[index]
  if (!step) return

  const module = step.route.replace(/^\//, '')
  guideNavigationBusy.value = true
  try {
    if (route.path !== step.route) {
      await router.push(step.route)
    }
    pageNav.setNavContext({ segments: [], plusVisible: false, plusOnClick: null, goModuleHome: () => {} })
    pageNav.setNavPath([module])
    await nextTick()
    guideCurrentIndex.value = index
    setSystemStateField('guideLastIndex', index).catch(() => {})
  } finally {
    guideNavigationBusy.value = false
  }
}

const startGuide = async () => {
  if (guideVisible.value || guideStartBusy.value || guideNavigationBusy.value) return
  guideStartBusy.value = true
  try {
    if (focusStore.timerState) {
      guideRunning.value = false
      ElMessage.warning('请先停止专注')
      logger.info('[引导] 检测到正在专注，已阻止启动引导')
      return
    }

    let lastIndex = 0
    try {
      const saved = await getSystemStateField('guideLastIndex')
      if (typeof saved === 'number' && Number.isInteger(saved) && saved > 0 && saved < guideSteps.length) {
        lastIndex = saved
      }
    } catch {}

    guideRunning.value = true
    await navigateGuideToStep(lastIndex)
    guideVisible.value = true
    logger.info('[引导] 新手引导已启动', { fromStep: lastIndex })
  } catch (error) {
    guideRunning.value = false
    logger.warn('[引导] 无法打开引导页面', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error('打开引导失败，请重试')
  } finally {
    guideStartBusy.value = false
  }
}

const closeGuide = async () => {
  if (guideNavigationBusy.value) return
  guideVisible.value = false
  guideCompleted.value = true
  guideRunning.value = false
  try {
    await setSystemStateField('guideCompleted', true)
    await setSystemStateField('guideLastIndex', 0)
  } catch {}
  logger.info('[引导] 新手引导已完成')
  startVersionChecks()
}

const handleGuidePrev = async () => {
  if (guideNavigationBusy.value) return
  if (guideCurrentIndex.value <= 0) return
  const prevIdx = guideCurrentIndex.value - 1
  try {
    await navigateGuideToStep(prevIdx)
  } catch (error) {
    logger.warn('[引导] 上一步页面切换失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error('页面切换失败，请重试')
  }
}

const handleGuideNext = async () => {
  if (guideNavigationBusy.value) return
  const nextIdx = guideCurrentIndex.value + 1
  if (nextIdx >= guideSteps.length) {
    await closeGuide()
    return
  }
  try {
    await navigateGuideToStep(nextIdx)
  } catch (error) {
    logger.warn('[引导] 下一步页面切换失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error('页面切换失败，请重试')
  }
}

const handleGuideSkip = () => {
  closeGuide()
}

const handleGuideExit = async () => {
  if (guideNavigationBusy.value) return
  guideVisible.value = false
  guideRunning.value = false
  await setSystemStateField('guideLastIndex', guideCurrentIndex.value).catch(() => {})
  logger.info('[引导] 退出引导，已保存进度', { step: guideCurrentIndex.value })
}

provide('startGuide', startGuide)
provide('guideVisible', guideVisible)
provide('guideRunning', guideRunning)

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
        linkedNoteIds: [],
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
      category: 'diary',
      pinned: true
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
  try {
    clearCache()

    try {
      const savedPage = await getSystemStateField('currentPage')
      const DEFAULT_PAGE = 'footprint'
      if (savedPage && VALID_ROUTES.includes(savedPage)) {
        const savedModuleState = savedPage === 'list'
          ? (await getSystemStateField('list')) as Record<string, any> | undefined
          : undefined
        const savedNavPath = savedModuleState?.navPath
        const restoredNavPath = Array.isArray(savedNavPath) && savedNavPath[0] === savedPage
          ? savedNavPath as string[]
          : [savedPage]
        pageNav.setNavPath(restoredNavPath)
        await router.replace(`/${savedPage}`)
        // hash 路由下 router.replace 到相同路由是空操作，不会触发 route watch 来设置 navPath，
        // 因此这里显式恢复选中模块，保证刷新后导航栏高亮正确（含此前缺漏的 toolbox 等模块）
        logger.debug('[App] 已恢复上次打开页面', { currentPage: savedPage })
      } else {
        // state.yaml 缺失 / currentPage 字段缺失 / 值无效：回退默认首页，并记录 currentPage 以便下次恢复
        logger.debug('[App] 没有有效页面记录，回到默认首页', { savedPage, default: DEFAULT_PAGE })
        await router.replace(MODULE_ROUTES[DEFAULT_PAGE])
        pageNav.setNavPath([DEFAULT_PAGE])
        await setSystemStateField('currentPage', DEFAULT_PAGE)
      }
    } catch (e) {
      logger.warn('[App] 恢复上次页面失败', { error: e })
      logger.debug('[App] 恢复失败，使用默认路由')
    }

    // 先以 profile.yaml 的账号资料为准，再同步注册日和生日倒数日。
    await authStore.fetchProfile()

    // 并行加载所有模块数据
    await Promise.all([
      taskStore.loadTasks(),
      listStore.loadData(),
      settingsStore.loadSettings(),
      focusStore.loadData(),
      preloadCountdownData(),
      preloadCourseData(),
      noteStore.loadData(),
    ])

    // 为新用户创建默认数据
    await ensureDefaultData()

    logger.info('[App] 数据初始化完成')

    cleanUpCourseAutoRecordedTasks()

    await scheduleListReminders('登录后数据初始化')

    // 成功登录后立即加载自动清理日志设置并执行清理
    runAutoCleanAfterLogin()

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

    try {
      navCollapsed.value = (await getSystemStateField('navCollapsed')) === true
    } catch {}

  } catch (error) {
    logger.error('[App] 初始化数据失败:', { error: error instanceof Error ? error.message : String(error) })
  } finally {
    dataInitialized.value = true
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
      logger.info('[App] 旧日志清理完成')
    }).catch((e: any) => {
      logger.error('[App] 登录后自动清理日志失败', { error: e })
    })
  }
}

// 预加载倒数日数据
const SYSTEM_MILESTONE_ID = 'system-usage-days'
const BIRTHDAY_MILESTONE_ID = 'user-birthday'

const BIRTHDAY_MILESTONE_DESCRIPTION = '生日快乐！愿新的一岁平安喜乐，心愿皆成。'
let birthdayCelebrationShownInSession = ''
const birthdayCelebrationVisible = ref(false)
const birthdayCelebrationNickname = ref('')

function showBirthdayBlessing(nickname = '') {
  birthdayCelebrationNickname.value = nickname
  birthdayCelebrationVisible.value = true
}

function checkBirthdayCelebration() {
  const profile = authStore.profile as Record<string, unknown> | null
  const birthdayValue = profile?.birthday ?? profile?.birthdayDate ?? profile?.birthDate
  const birthdayMatch = String(birthdayValue ?? '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!birthdayMatch) return

  const [, year, month, day] = birthdayMatch
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth() + 1
  const todayDay = today.getDate()
  const todayKey = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`
  const calendar = String(profile?.birthdayCalendar ?? profile?.birthdayType ?? 'solar').toLowerCase()
  let isBirthday = false

  if (calendar === 'lunar' || calendar === '农历') {
    const birthdayParts = BirthdaySolar.fromYmd(Number(year), Number(month), Number(day)).getLunar()
    const todayParts = BirthdaySolar.fromYmd(todayYear, todayMonth, todayDay).getLunar()
    const targetMonth = Math.abs(birthdayParts.getMonth())
    const leapMonth = BirthdayLunarYear.fromYear(todayParts.getYear()).getLeapMonth()
    const expectedMonth = birthdayParts.getMonth() < 0 && leapMonth === targetMonth ? -targetMonth : targetMonth
    const currentMonth = todayParts.getMonth()
    const dayCount = BirthdayLunarMonth.fromYm(todayParts.getYear(), expectedMonth).getDayCount()
    isBirthday = currentMonth === expectedMonth && todayParts.getDay() === Math.min(birthdayParts.getDay(), dayCount)
  } else {
    const birthdayMonth = Number(month)
    const birthdayDay = Number(day)
    const isLeapYear = new Date(todayYear, 1, 29).getMonth() === 1
    const expectedDay = birthdayMonth === 2 && birthdayDay === 29 && !isLeapYear ? 28 : birthdayDay
    isBirthday = todayMonth === birthdayMonth && todayDay === expectedDay
  }

  if (!isBirthday) return
  const userKey = String(profile?.id ?? authStore.user?.id ?? profile?.email ?? 'current-user')
  const storageKey = `birthday-celebration:${userKey}:${todayKey}`
  if (birthdayCelebrationShownInSession === storageKey) return
  try {
    if (localStorage.getItem(storageKey)) return
    localStorage.setItem(storageKey, 'shown')
  } catch {
    // Storage may be unavailable; session state still prevents repeated celebrations.
  }
  birthdayCelebrationShownInSession = storageKey
  showBirthdayBlessing(String(profile?.nickname ?? profile?.displayName ?? ''))
}

let birthdayCelebrationTimer: number | undefined
watch(() => authStore.profile, checkBirthdayCelebration, { deep: true })
onMounted(() => {
  checkBirthdayCelebration()
  birthdayCelebrationTimer = window.setInterval(checkBirthdayCelebration, 60_000)
})
onUnmounted(() => {
  if (birthdayCelebrationTimer !== undefined) window.clearInterval(birthdayCelebrationTimer)
})
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

  const categoriesArr = Array.isArray(savedCategories) ? [...savedCategories] : []
  for (const defaultCategory of DEFAULT_COUNTDOWN_CATEGORIES) {
    if (!categoriesArr.some(category => category.value === defaultCategory.value)) {
      categoriesArr.push({ ...defaultCategory })
    }
  }
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
      repeatStrategy: m.repeatStrategy || 'none',
      repeatCalendar: m.repeatCalendar === 'lunar' ? 'lunar' : 'solar',
      lunarMonth: m.lunarMonth || 1,
      lunarDay: m.lunarDay || 1
    }))
  }

  const today = dayjs().startOf('day')
  const year = today.year()
  for (const milestone of milestonesArr) {
    if (milestone.repeatStrategy !== 'yearly' || milestone.countMode === 'countup') continue
    const nextDate = getNextAnnualDate(
      milestone.targetDate,
      milestone.repeatCalendar === 'lunar' ? 'lunar' : 'solar',
      milestone.lunarMonth,
      milestone.lunarDay,
      today.format('YYYY-MM-DD')
    )
    if (nextDate !== milestone.targetDate) {
      milestone.targetDate = nextDate
      milestone.updatedAt = new Date().toISOString()
    }
  }
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
  const systemIdx = milestonesArr.findIndex((m: any) => m.id === SYSTEM_MILESTONE_ID)
  const existingSystemMilestone = systemIdx > -1 ? milestonesArr[systemIdx] : null
  const registrationDate = [
    authStore.profile?.createdAt,
    userAny?.createdAt,
    authStore.profile?.created_at,
    userAny?.created_at,
    existingSystemMilestone?.targetDate,
    existingSystemMilestone?.createdAt
  ].find(value => typeof value === 'string' && dayjs(value).isValid()) || today.toISOString()
  const registrationDay = dayjs(registrationDate).format('YYYY-MM-DD')
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
      createdAt: registrationDate,
      updatedAt: new Date().toISOString()
    })
  } else {
    const sm = milestonesArr[systemIdx]
    if (sm.targetDate !== registrationDay || sm.category !== 'anniversary' || sm.createdAt !== registrationDate) {
      milestonesArr[systemIdx] = { ...sm, targetDate: registrationDay, category: 'anniversary', createdAt: registrationDate, updatedAt: new Date().toISOString() }
    }
  }

  const rawBirthday = (authStore.profile as any)?.birthday
  const birthday = typeof rawBirthday === 'string' && dayjs(rawBirthday).isValid()
    ? dayjs(rawBirthday).format('YYYY-MM-DD')
    : ''
  const birthdayCalendar = (authStore.profile as any)?.birthdayCalendar === 'lunar' ? 'lunar' : 'solar'
  const birthdayLunarParts = birthday ? solarDateToLunarParts(birthday) : null
  const birthdayMonth = birthdayCalendar === 'lunar' ? birthdayLunarParts?.month : undefined
  const birthdayDay = birthdayCalendar === 'lunar' ? birthdayLunarParts?.day : undefined
  const birthdayDate = birthday ? getNextAnnualDate(
    birthday,
    birthdayCalendar,
    birthdayMonth,
    birthdayDay,
    today.format('YYYY-MM-DD')
  ) : ''
  const bIdx = milestonesArr.findIndex((m: any) => m.id === BIRTHDAY_MILESTONE_ID)
  if (birthday && birthdayDate && bIdx === -1) {
    milestonesArr.push({
      id: BIRTHDAY_MILESTONE_ID,
      name: '我的生日',
      targetDate: birthdayDate,
      category: 'birthday', description: BIRTHDAY_MILESTONE_DESCRIPTION, countMode: 'countdown', pinned: true, isSystem: true,
      repeatStrategy: 'yearly',
      repeatCalendar: birthdayCalendar,
      lunarMonth: birthdayMonth || 1,
      lunarDay: birthdayDay || 1,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      reminderStrategy: 'advance', reminderDays: 1, reminderHours: 0, reminderMinutes: 0
    })
  } else if (authStore.profile && !birthday && bIdx > -1) {
    milestonesArr.splice(bIdx, 1)
  } else if (birthday && birthdayDate && bIdx > -1) {
    const bm = milestonesArr[bIdx]
    if (bm.name !== '我的生日' || bm.targetDate !== birthdayDate || bm.category !== 'birthday' || bm.description !== BIRTHDAY_MILESTONE_DESCRIPTION || bm.countMode !== 'countdown' || bm.repeatStrategy !== 'yearly' || bm.repeatCalendar !== birthdayCalendar || bm.lunarMonth !== (birthdayMonth || 1) || bm.lunarDay !== (birthdayDay || 1) || !bm.reminderStrategy) {
      milestonesArr[bIdx] = {
        ...bm,
        name: '我的生日',
        targetDate: birthdayDate,
        category: 'birthday',
        description: BIRTHDAY_MILESTONE_DESCRIPTION,
        countMode: 'countdown',
        pinned: true,
        isSystem: true,
        repeatStrategy: 'yearly',
        repeatCalendar: birthdayCalendar,
        lunarMonth: birthdayMonth || 1,
        lunarDay: birthdayDay || 1,
        reminderStrategy: bm.reminderStrategy || 'advance',
        reminderDays: bm.reminderDays ?? 1,
        reminderHours: bm.reminderHours ?? 0,
        reminderMinutes: bm.reminderMinutes ?? 0,
        updatedAt: new Date().toISOString()
      }
    }
  }

  countdownMilestones.value = milestonesArr
  await setData('countdown', 'categories', categoriesArr)
  await setData('countdown', 'countdowns', milestonesArr)
  preloadData('countdown', 'countdowns', milestonesArr)
}

// 预加载课程表数据
const preloadCourseData = async () => {
  const courses = await getData('course', 'courses')
  if (courses) preloadData('course', 'courses', courses)
}

// 页面状态恢复已由路由接管

// 监听路由变化，保存到系统状态
watch(
  () => route.name,
  async (newName, oldName) => {
    // 初始化阶段（含默认路由重定向）不持久化 currentPage，避免覆盖已保存的上次浏览页
    if (!dataInitialized.value) return
    if (newName && typeof newName === 'string' && VALID_ROUTES.includes(newName)) {
      if (pageNav.currentModule.value !== newName) {
        pageNav.setNavPath([newName])
        pageNav.setNavContext({ segments: [], plusVisible: false, plusOnClick: null, goModuleHome: () => {} })
      }
      await setSystemStateField('currentPage', newName)
    }
  }
)
watch(
    () => authStore.isAuthenticated,
    async (isAuthenticated, wasAuthenticated) => {
      logger.debug(`[App] 登录状态切换为${isAuthenticated ? '已登录' : '未登录'}`)
      if (isAuthenticated && !wasAuthenticated && !dataInitialized.value) {
        logger.info('[App] 开始初始化数据')
        await initializeData()
      }
    }
)

// 专注模块全屏状态
const isFocusFullscreen = ref(false)

// 桌面端左侧导航栏收起状态（保存到本地账户配置）
const navCollapsed = ref(false)
const toggleNav = () => {
  navCollapsed.value = !navCollapsed.value
  setSystemStateField('navCollapsed', navCollapsed.value).catch(() => {})
}

// 统计模块全屏状态
const isStatsFullscreen = ref(false)

const handleFullscreenFromRoute = (fullscreen: boolean) => {
  // 笔记页：常规模式显示全局导航，全屏编辑模式下隐藏（fullscreen=true）
  if (route.name === 'notes') {
    isFocusFullscreen.value = fullscreen
  } else if (route.name === 'footprint') {
    isStatsFullscreen.value = fullscreen
  }
}

// 离开全屏笔记页时复位导航显隐，避免其他模块停留在导航被隐藏的状态
watch(() => route.name, (name) => {
  if (name !== 'notes') {
    isFocusFullscreen.value = false
  }
})

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
    scheduleListReminders('倒数日数据变更')
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
  stopServerHealthChecks()
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
  if (animationId) {
    cancelAnimationFrame(animationId)
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

/* 桌面端横向布局（导航栏在左侧） */
.app-container.desktop-layout {
  flex-direction: row;
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

/* 桌面端导航移至左侧，内容不再需要底部间距 */
.app-container.desktop-layout .main-content {
  padding-bottom: 0;
}

/* 移动端导航仍为固定浮层，内容保留 25px 下边界间距 */
.app-container:not(.desktop-layout) .main-content {
  padding-bottom: 25px;
}

/* 导航栏展开按钮：默认隐藏时显示于页面底部居中、紧贴下边界的胶囊把手 */
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
  top: 20px;
  right: 24px;
  left: auto;
  transform: none;
  z-index: 2900;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  pointer-events: none;
  width: min(308px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow-x: hidden;
  overflow-y: auto;
  padding: 4px;
}

.reminder-stack :deep(.reminder-card) {
  width: 100%;
  flex: 0 0 auto;
}

@media (max-width: 600px) {
  .reminder-stack {
    top: 12px;
    right: 12px;
    width: calc(100vw - 24px);
  }
}

:deep(.cl-version) { color: var(--chalk-amber); font-size: 14px; font-weight: 600; margin: 14px 0 6px; padding: 5px 0 5px 10px; border-left: 3px solid #f0c040; background: linear-gradient(90deg, rgba(240,192,64,0.06) 0%, transparent 100%); border-radius: 0 4px 4px 0; }
:deep(.cl-list) { margin: 0 0 4px 16px; padding: 0; list-style: none; color: var(--chalk-white-75); }
:deep(.cl-list li) { font-size: 12px; line-height: 1.7; padding: 2px 0; position: relative; padding-left: 14px; }
:deep(.cl-list li)::before { content: '•'; position: absolute; left: 0; color: rgba(255,255,255,0.25); font-size: 10px; top: 5px; }</style>
<style>
.nav-profile-item.active {
  background: transparent !important;
}

/* 全局提示固定到窗口右上角，使用与应用主题一致的轻透玻璃卡片。 */
.el-message {
  left: auto !important;
  right: 24px !important;
  transform: none !important;
  box-sizing: border-box;
  min-width: 300px;
  max-width: min(440px, calc(100vw - 32px));
  padding: 13px 17px;
  border: 1px solid rgba(196, 181, 253, 0.28) !important;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(28, 27, 58, 0.96), rgba(22, 34, 62, 0.94)) !important;
  box-shadow: 0 14px 38px rgba(5, 8, 24, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  backdrop-filter: blur(18px);
}

.el-message .el-message__content {
  color: #eef2ff;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.el-message .el-message__icon {
  font-size: 18px;
}

.el-message .el-message__closeBtn {
  color: rgba(226, 232, 240, 0.62);
}

.el-message--success { border-color: rgba(52, 211, 153, 0.38) !important; }
.el-message--warning { border-color: rgba(251, 191, 36, 0.4) !important; }
.el-message--error { border-color: rgba(248, 113, 113, 0.42) !important; }

@media (max-width: 600px) {
  .el-message {
    right: 12px !important;
    min-width: 0;
    max-width: calc(100vw - 24px);
  }
}
</style>
