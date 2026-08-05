<template>
  <div class="focus-container">
    <!-- 主内容区 -->
    <div class="focus-content">
      <el-scrollbar>

        <!-- 计时器风格选择 -->
        <div v-if="timerState === 'idle'" class="mode-row focus-style-row">
          <span class="mode-label">计时器风格</span>
          <div class="type-toggle style-2-seg" :class="styleToggleClass">
            <div class="toggle-slider" />
            <button class="type-btn" :class="{ active: timerStyle === 'ring' }" @click="setTimerStyle('ring')">⭕ 圆环</button>
            <button class="type-btn" :class="{ active: timerStyle === 'plain' }" @click="setTimerStyle('plain')">🔢 数字</button>
          </div>
        </div>

        <!-- 进度圆环（仅 idle 时显示在 el-scrollbar 顶部；running 时由 timing-view 内的计时器展示） -->
        <template v-if="timerState === 'idle'">
          <div v-if="timerStyle === 'ring'" class="timer-ring">
            <svg class="ring-svg" viewBox="0 0 120 120">
              <defs>
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#667eea" />
                  <stop offset="100%" stop-color="#a78bfa" />
                </linearGradient>
                <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle class="ring-track" cx="60" cy="60" r="54" />
              <circle class="ring-progress" cx="60" cy="60" r="54"
                stroke="url(#ringGradient)"
                filter="url(#ringGlow)"
                :stroke-dasharray="ringCircumference"
                :stroke-dashoffset="ringCircumference * (1 - ringProgress)" />
            </svg>
            <span class="ring-time">
              <span v-for="(g, i) in displayTime.split(' ')" :key="i" class="time-group">{{ g }}</span>
            </span>
          </div>

          <!-- 数字 -->
          <div v-else class="timer-time">{{ displayTime }}</div>

          <div class="focus-start-wrapper">
            <button class="focus-ctrl-btn focus-start-btn" @click="startFocus">▶️ 开始专注</button>
          </div>
        </template>

        <!-- 非计时状态 -->
        <div v-if="timerState === 'idle'" class="idle-view">
          <!-- 模式切换 -->
          <div class="mode-row focus-mode-row">
            <span class="mode-label">模式</span>
            <div class="type-toggle" :class="{ 'active-right': focusType === 'stopwatch' }">
              <div class="toggle-slider" />
              <button class="type-btn" :class="{ active: focusType === 'pomodoro' }" @click="focusType = 'pomodoro'">🍅 番茄钟</button>
              <button class="type-btn" :class="{ active: focusType === 'stopwatch' }" @click="focusType = 'stopwatch'">⏱️ 正计时</button>
            </div>
          </div>

          <div class="focus-input-section">
            <div class="input-label">事项名称</div>
            <el-input
                v-model="focusName"
                placeholder="输入专注事项（必填）"
                size="large"
                type="textarea"
                :autosize="{ minRows: 1, maxRows: 3 }"
                :disabled="isGuideActive"
            />
            <div class="input-label" style="margin-top: 16px">图标</div>
            <IconPicker v-model="focusIcon" />
            <div v-if="focusType === 'pomodoro'" class="input-label" style="margin-top: 16px">番茄时长（分钟）</div>
            <el-input-number
                v-if="focusType === 'pomodoro'"
                v-model="localPomodoroDuration"
                :min="1"
                :max="120"
                :step="5"
                size="large"
                :disabled="isGuideActive"
                style="margin-top: 0; width: 100%"
            />
            <div class="input-label" style="margin-top: 16px">备注</div>
            <el-input
                v-model="focusNotes"
                placeholder="添加备注（可选）"
                size="large"
                clearable
                type="textarea"
                :autosize="{ minRows: 1, maxRows: 3 }"
                :disabled="isGuideActive"
                style="margin-top: 0"
            />
          </div>

          <!-- 常用专注 -->
          <div v-if="favorites.length > 0" class="favorites-section">
            <div class="section-title">
              <el-icon><Star /></el-icon>
              常用专注
            </div>
            <div ref="favoritesGridRef" class="favorites-grid" :style="{ gridTemplateColumns: `repeat(${favoritesCols}, 1fr)` }">
              <div
                  v-for="fav in favorites"
                  :key="fav.id"
                  class="favorite-card"
                  :class="{ editing: editingFavoriteId === fav.id }"
                  @click="selectFavorite(fav)"
              >
                <div class="fav-name">
                  <span class="fav-icon">{{ fav.icon || '📝' }}</span>
                  {{ fav.name }}
                </div>
                <div class="fav-info">
                  <span>{{ fav.type === 'pomodoro' ? `${fav.targetDuration}分钟` : '正计时' }}</span>
                </div>
                <div v-if="fav.notes" class="fav-notes">{{ fav.notes }}</div>
                <el-button
                    type="danger"
                    :icon="Delete"
                    circle
                    size="small"
                    class="fav-delete"
                    @click.stop="deleteFavorite(fav.id)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 计时中状态（计时器+信息+按钮整体居中） -->
        <div v-else class="timing-view">
          <!-- 进度圆环 -->
          <div v-if="timerStyle === 'ring'" class="timer-ring">
            <svg class="ring-svg" viewBox="0 0 120 120">
              <defs>
                <linearGradient id="ringGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#667eea" />
                  <stop offset="100%" stop-color="#a78bfa" />
                </linearGradient>
                <filter id="ringGlow2" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle class="ring-track" cx="60" cy="60" r="54" />
              <circle class="ring-progress" cx="60" cy="60" r="54"
                stroke="url(#ringGradient2)"
                filter="url(#ringGlow2)"
                :stroke-dasharray="ringCircumference"
                :stroke-dashoffset="ringCircumference * (1 - ringProgress)" />
              <!-- 正计时粒子 -->
              <g v-if="focusType === 'stopwatch'" class="ring-particles" filter="url(#ringGlow2)">
                <circle v-for="i in 16" :key="i" class="ring-particle"
                  :cx="(60 + 54 * Math.cos((i - 1) * Math.PI / 8 - Math.PI / 2))"
                  :cy="(60 + 54 * Math.sin((i - 1) * Math.PI / 8 - Math.PI / 2))" r="2.5" />
              </g>
            </svg>
            <span class="ring-time">
              <span v-for="(g, i) in displayTime.split(' ')" :key="i" class="time-group">{{ g }}</span>
            </span>
          </div>

          <!-- 数字 -->
          <div v-else class="timer-time">{{ displayTime }}</div>

          <!-- 专注信息 -->
          <div class="focus-info-card">
            <div class="focus-info-name">{{ focusName }}</div>
            <div v-if="focusNotes" class="focus-info-notes">{{ focusNotes }}</div>
          </div>

          <!-- 操作按钮 -->
          <div class="action-buttons">
            <button class="focus-ctrl-btn focus-cancel-btn" @click="cancelFocus">✕ 取消</button>
            <button class="focus-ctrl-btn focus-complete-btn" @click="completeFocus">✓ 完成</button>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 完成后保存常用对话框 -->
    <BaseDialog
        :visible="showSaveFavorite"
        title="保存为常用专注？"
        :width="400"
        @update:visible="showSaveFavorite = $event"
    >
      <p class="dialog-text">是否将此专注保存为常用？方便下次快速开始。</p>
      <template #footer>
        <el-button @click="showSaveFavorite = false">跳过</el-button>
        <el-button type="primary" @click="saveAsFavorite">保存</el-button>
      </template>
    </BaseDialog>

    <ConfirmDialog
      v-model="deleteFavoriteConfirmVisible"
      title="删除确认"
      message="确定要删除这个常用专注吗？"
      @confirm="confirmDeleteFavorite"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, watch, inject, provide } from 'vue'
import { ElMessage } from 'element-plus'
import { Star, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useFocusStore, type FavoriteFocus, type TimerState as StoredTimerState } from '../../stores/focusStore'
import { useTaskStore } from '../../stores/taskStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePageNav } from '../../composables/usePageNav'
import { logger } from '../../lib/logger'
import BaseDialog from '../ui/BaseDialog.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import IconPicker from '../common/picker/IconPicker.vue'

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const isGuideActive = inject('guideVisible', ref(false))

const focusStore = useFocusStore()
const taskStore = useTaskStore()
const settingsStore = useSettingsStore()
const pageNav = usePageNav()
const refreshReminders = inject<() => void>('refreshReminders', () => {})

// 计时器状态
type TimerState = 'idle' | 'running'
const timerState = ref<TimerState>('idle')

// 专注类型
type FocusType = 'pomodoro' | 'stopwatch'
const focusType = ref<FocusType>('pomodoro')

// 专注信息
const focusName = ref('')
const focusNotes = ref('')

// 计时相关 - 使用时间戳解决后台计时暂停问题
const remainingSeconds = ref(0)
const elapsedSeconds = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null
const startTimestamp = ref<number>(0) // 使用时间戳而不是 Date 对象
const lastUpdateTime = ref<number>(0) // 上次更新时间戳

// 番茄时长（本地可变，初始值从全局设置读取）
const localPomodoroDuration = ref(settingsStore.settings.focus?.pomodoroDuration || 25)

// 保存常用
const showSaveFavorite = ref(false)
const lastCompletedFocus = ref<{ name: string; notes: string; type: FocusType; targetDuration: number; icon?: string } | null>(null)

const timerStyle = ref<'ring' | 'plain'>('ring')
const styleToggleClass = computed(() => {
  return timerStyle.value === 'plain' ? 'active-right' : ''
})
const setTimerStyle = async (s: 'ring' | 'plain') => {
  timerStyle.value = s
  await settingsStore.updateFocusSettings({ timerStyle: s })
}

// 常用专注
const favorites = computed(() => focusStore.favorites)
const favoritesGridRef = ref<HTMLDivElement>()
const favoritesCols = ref(4)
const focusIcon = ref('🎯')
const CARD_GAP = 24
const updateFavoritesCols = () => {
  if (!favoritesGridRef.value) return
  const w = favoritesGridRef.value.clientWidth
  let k = 1
  while (w >= 300 + (k - 1) * 150 + k * CARD_GAP) k++
  favoritesCols.value = Math.max(1, k - 1)
}
let favGridObs: ResizeObserver | null = null

// 显示时间
const displayTime = computed(() => {
  let totalSeconds: number
  if (timerState.value === 'idle') {
    totalSeconds = focusType.value === 'pomodoro' ? localPomodoroDuration.value * 60 : 0
  } else {
    totalSeconds = focusType.value === 'pomodoro' ? remainingSeconds.value : elapsedSeconds.value
  }
  totalSeconds = Math.abs(totalSeconds)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h.toString().padStart(2, '0')} ${m.toString().padStart(2, '0')} ${s.toString().padStart(2, '0')}`
})

// 沙漏进度（0=上满下空，1=上空下满）
const sandProgress = computed(() => {
  if (timerState.value !== 'running') {
    return 0
  }
  if (focusType.value === 'pomodoro') {
    const totalSeconds = localPomodoroDuration.value * 60
    if (totalSeconds <= 0) return 0
    return 1 - Math.max(0, Math.min(1, remainingSeconds.value / totalSeconds))
  }
  return 0
})

// 圆环进度：番茄钟按剩余时间递减（满→空），正计时无目标恒为满圈
const ringCircumference = 2 * Math.PI * 54
const ringProgress = computed(() => {
  if (focusType.value === 'stopwatch') return 1
  return 1 - sandProgress.value
})

// 选择常用专注（再次点击同一卡片退出编辑态）
const editingFavoriteId = ref<string | null>(null)

const selectFavorite = (fav: FavoriteFocus) => {
  if (editingFavoriteId.value === fav.id) {
    editingFavoriteId.value = null
    return
  }
  focusName.value = fav.name
  focusNotes.value = fav.notes
  focusIcon.value = fav.icon || ''
  focusType.value = fav.type
  if (fav.type === 'pomodoro') {
    localPomodoroDuration.value = fav.targetDuration
  }
  editingFavoriteId.value = fav.id
}

// 编辑态下输入区改动实时同步到对应卡片
watch([focusName, focusNotes, focusIcon, focusType, localPomodoroDuration], () => {
  if (!editingFavoriteId.value) return
  focusStore.updateFavorite(editingFavoriteId.value, {
    name: focusName.value,
    notes: focusNotes.value,
    icon: focusIcon.value,
    type: focusType.value,
    targetDuration: focusType.value === 'pomodoro' ? localPomodoroDuration.value : 0
  })
})

// 删除常用专注
const deleteFavoriteConfirmVisible = ref(false)
const pendingDeleteFavoriteId = ref<string | null>(null)

const deleteFavorite = (id: string) => {
  pendingDeleteFavoriteId.value = id
  deleteFavoriteConfirmVisible.value = true
}

const confirmDeleteFavorite = async () => {
  const id = pendingDeleteFavoriteId.value
  if (!id) return
  await focusStore.deleteFavorite(id)
  logger.info('[专注] 删除常用专注', { id })
  ElMessage.success('已删除')
  pendingDeleteFavoriteId.value = null
}

// 开始专注
const startFocus = async () => {
  if (!focusName.value.trim()) {
    ElMessage.warning('请输入专注事项')
    return
  }

  logger.info('[专注] 开始专注', { name: focusName.value, type: focusType.value })

  editingFavoriteId.value = null
  timerState.value = 'running'
  startTimestamp.value = Date.now()
  lastUpdateTime.value = Date.now()

  // 保存计时状态到 store
  const state: StoredTimerState = {
    name: focusName.value,
    notes: focusNotes.value,
    type: focusType.value,
    targetDuration: focusType.value === 'pomodoro' ? localPomodoroDuration.value : 0,
    startTimestamp: startTimestamp.value,
    elapsedSeconds: 0,
    isPaused: false
  }
  await focusStore.saveTimerState(state)

  if (focusType.value === 'pomodoro') {
    remainingSeconds.value = localPomodoroDuration.value * 60
    elapsedSeconds.value = 0
    startCountdown()
    ;(window as any).__countdownRefresh?.()
  } else {
    elapsedSeconds.value = 0
    startStopwatch()
    refreshReminders()
  }
}

// 开始倒计时 - 使用时间戳计算
const startCountdown = () => {
  if (timerInterval) clearInterval(timerInterval)
  const totalSeconds = localPomodoroDuration.value * 60

  const updateTimer = () => {
    const now = Date.now()
    const elapsed = Math.floor((now - startTimestamp.value) / 1000)
    elapsedSeconds.value = elapsed
    remainingSeconds.value = Math.max(0, totalSeconds - elapsed)
    lastUpdateTime.value = now

    if (remainingSeconds.value <= 0) {
      completeFocus()
    }
  }

  updateTimer()
  timerInterval = setInterval(updateTimer, 1000)
}

// 开始正计时 - 使用时间戳计算
const startStopwatch = () => {
  if (timerInterval) clearInterval(timerInterval)

  const updateTimer = () => {
    const now = Date.now()
    elapsedSeconds.value = Math.floor((now - startTimestamp.value) / 1000)
    lastUpdateTime.value = now
  }

  updateTimer()
  timerInterval = setInterval(updateTimer, 1000)
}

// 取消专注
const cancelFocus = async () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  logger.info('[专注] 取消专注', { name: focusName.value })
  timerState.value = 'idle'
  remainingSeconds.value = 0
  elapsedSeconds.value = 0
  startTimestamp.value = 0
  lastUpdateTime.value = 0

  if (focusType.value === 'pomodoro') {
    ;(window as any).__countdownRefresh?.()
  }

  // 清除 store 中的计时状态
  await focusStore.clearTimerState()

  refreshReminders()

  ElMessage.info('已取消专注')
}

// 完成专注
const completeFocus = async () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  if (!startTimestamp.value) return

  const endTime = Date.now()
  const totalDuration = Math.floor(elapsedSeconds.value / 60) // 总分钟数
  const startTime = dayjs(startTimestamp.value)
  const endTimeObj = dayjs(endTime)
  const startDate = startTime.format('YYYY-MM-DD')
  const endDate = endTimeObj.format('YYYY-MM-DD')
  const startTimeStr = startTime.format('HH:mm')
  const endTimeStr = endTimeObj.format('HH:mm')

  // 检查是否跨日（开始日期和结束日期不同）
  const isCrossDay = startDate !== endDate

  if (isCrossDay) {
    // 跨日分割处理
    const splitRecords: Array<{ date: string; startTime: string; endTime: string; duration: number }> = []

    // 计算需要分割的天数
    const daysDiff = endTimeObj.startOf('day').diff(startTime.startOf('day'), 'day')
    let currentDate = startTime.clone().startOf('day')

    // 分割每一天的记录
    for (let i = 0; i <= daysDiff; i++) {
      const nextDayStart = currentDate.clone().add(1, 'day')

      // 计算当天实际计时区间
      const segmentStart = i === 0 ? startTime : currentDate
      const segmentEnd = i === daysDiff ? endTimeObj : nextDayStart

      // 计算当天时长（分钟），精确计算
      const segmentDuration = Math.floor(segmentEnd.diff(segmentStart, 'minute'))

      if (segmentDuration > 0) {
        splitRecords.push({
          date: currentDate.format('YYYY-MM-DD'),
          startTime: i === 0 ? startTimeStr : '00:00',
          // 中间日显示23:59，但实际duration计算到午夜
          endTime: i === daysDiff ? endTimeStr : '23:59',
          duration: segmentDuration
        })
      }

      currentDate = nextDayStart
    }

    // 保存分割的专注记录
    for (const record of splitRecords) {
      await focusStore.addRecord({
        name: focusName.value,
        notes: focusNotes.value,
        type: focusType.value,
        duration: record.duration,
        targetDuration: focusType.value === 'pomodoro' ? localPomodoroDuration.value : 0,
        startTime: record.startTime,
        endTime: record.endTime,
        date: record.date,
        completed: focusType.value === 'pomodoro' ? remainingSeconds.value === 0 : true
      })
    }

    // 保存分割的足迹任务
    const splitTasks = splitRecords.map((record) => ({
      name: focusName.value,
      startTime: record.startTime,
      endTime: record.endTime,
      date: record.date,
      duration: record.duration,
      notes: focusNotes.value || undefined
    }))
    await taskStore.addSplitTasks(splitTasks)
  } else {
    // 同一天内，正常保存
    await focusStore.addRecord({
      name: focusName.value,
      notes: focusNotes.value,
      type: focusType.value,
      duration: totalDuration,
      targetDuration: focusType.value === 'pomodoro' ? localPomodoroDuration.value : 0,
      startTime: startTimeStr,
      endTime: endTimeStr,
      date: startDate,
      completed: focusType.value === 'pomodoro' ? remainingSeconds.value === 0 : true
    })

    // 调用记录足迹功能
    await taskStore.addCompletedTask({
      id: `focus-${Date.now()}`,
      name: focusName.value,
      startTime: startTimeStr,
      endTime: endTimeStr,
      date: startDate,
      completed: true,
      duration: totalDuration,
      notes: focusNotes.value || undefined
    })
  }

  // 保存最后完成的专注信息
  lastCompletedFocus.value = {
    name: focusName.value,
    notes: focusNotes.value,
    type: focusType.value,
    targetDuration: localPomodoroDuration.value,
    icon: focusIcon.value || undefined
  }

  // 重置状态
  timerState.value = 'idle'
  remainingSeconds.value = 0
  elapsedSeconds.value = 0
  startTimestamp.value = 0
  lastUpdateTime.value = 0

  if (focusType.value === 'pomodoro') {
    ;(window as any).__countdownRefresh?.()
  }

  // 清除 store 中的计时状态
  await focusStore.clearTimerState()

  refreshReminders()

  logger.info('[专注] 完成专注', { name: focusName.value, duration: totalDuration })
  ElMessage.success('专注完成！')

  // 检查是否已存在相同名称和类型的常用专注
  const alreadyExists = focusStore.favorites.some(f =>
    f.name === focusName.value && f.type === focusType.value
  )

  if (!alreadyExists) {
    // 显示保存常用对话框
    showSaveFavorite.value = true
  }
}

// 保存为常用
const saveAsFavorite = async () => {
  if (!lastCompletedFocus.value) return

  const result = await focusStore.addFavorite({
    name: lastCompletedFocus.value.name,
    notes: lastCompletedFocus.value.notes,
    type: lastCompletedFocus.value.type,
    targetDuration: lastCompletedFocus.value.targetDuration,
    icon: lastCompletedFocus.value.icon
  })

  showSaveFavorite.value = false
  const savedName = lastCompletedFocus.value.name
  lastCompletedFocus.value = null

  if (result) {
    logger.info('[专注] 添加常用专注', { name: savedName })
    ElMessage.success('已保存为常用专注')
  } else {
    ElMessage.info('该专注已在常用列表中')
  }
}

// 初始化
onMounted(async () => {
  if (pageNav.navPath.value.length === 0) {
    pageNav.setNavPath(['focus'])
  }

  await focusStore.loadData()
  await settingsStore.loadSettings()
  const savedStyle = settingsStore.settings.focus?.timerStyle || 'ring'
  timerStyle.value = (savedStyle === 'plain') ? 'plain' : 'ring'

  // 恢复计时状态
  const savedState = focusStore.timerState
  if (savedState) {
    // 恢复专注信息
    focusName.value = savedState.name
    focusNotes.value = savedState.notes || ''
    focusType.value = savedState.type
    if (savedState.type === 'pomodoro') {
      localPomodoroDuration.value = savedState.targetDuration
    }

    // 计算已经过去的时间（包含暂停前已计时的时间）
    const elapsedSinceStart = Math.floor((Date.now() - savedState.startTimestamp) / 1000)
    const totalElapsed = Math.max(elapsedSinceStart, savedState.elapsedSeconds || 0)

    startTimestamp.value = Date.now() - (totalElapsed * 1000)
    lastUpdateTime.value = Date.now()
    timerState.value = 'running'

    if (savedState.type === 'pomodoro') {
      const totalSeconds = savedState.targetDuration * 60
      const remaining = totalSeconds - totalElapsed

      if (remaining > 0) {
        remainingSeconds.value = remaining
        elapsedSeconds.value = totalElapsed
        startCountdown()
      } else {
        elapsedSeconds.value = totalSeconds
        remainingSeconds.value = 0
        await completeFocus()
      }
    } else {
      elapsedSeconds.value = totalElapsed
      startStopwatch()
    }
  }

  // 监听页面可见性变化，确保后台计时准确
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 响应式卡片列数
  if (favoritesGridRef.value) {
    favGridObs = new ResizeObserver(updateFavoritesCols)
    favGridObs.observe(favoritesGridRef.value)
    updateFavoritesCols()
  }
})

// 页面可见性变化处理
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && timerState.value === 'running' && startTimestamp.value) {
    // 页面重新可见时，重新计算时间
    const now = Date.now()
    const elapsed = Math.floor((now - startTimestamp.value) / 1000)

    if (focusType.value === 'pomodoro') {
      const totalSeconds = localPomodoroDuration.value * 60
      remainingSeconds.value = Math.max(0, totalSeconds - elapsed)
      elapsedSeconds.value = elapsed

      if (remainingSeconds.value <= 0) {
      completeFocus()
    }
    } else {
      elapsedSeconds.value = elapsed
    }

    lastUpdateTime.value = now
  }
}

onActivated(() => {
  if (timerState.value !== 'running' || !startTimestamp.value) return

  const now = Date.now()
  const elapsed = Math.floor((now - startTimestamp.value) / 1000)

  if (focusType.value === 'pomodoro') {
    const totalSeconds = localPomodoroDuration.value * 60
    remainingSeconds.value = Math.max(0, totalSeconds - elapsed)
    elapsedSeconds.value = elapsed
    if (remainingSeconds.value <= 0) {
      completeFocus()
    }
  } else {
    elapsedSeconds.value = elapsed
    lastUpdateTime.value = now
  }
})

// 清理
onUnmounted(async () => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }

  document.removeEventListener('visibilitychange', handleVisibilityChange)
  favGridObs?.disconnect()

  // 如果计时正在进行中，保存当前状态
  if (timerState.value === 'running' && startTimestamp.value) {
    const state: StoredTimerState = {
      name: focusName.value,
      notes: focusNotes.value,
      type: focusType.value,
      targetDuration: focusType.value === 'pomodoro' ? localPomodoroDuration.value : 0,
      startTimestamp: startTimestamp.value,
      elapsedSeconds: elapsedSeconds.value,
      isPaused: false
    }
    await focusStore.saveTimerState(state)
  }
})
</script>

<style scoped>
.focus-container {
  height: 100%;
  background: transparent;
  padding: 0 24px;
}

.focus-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.focus-content :deep(.el-scrollbar) {
  flex: 1;
  min-height: 0;
}

.focus-content :deep(.el-scrollbar__view) {
  display: block;
  min-height: 100%;
}
/* 禁用浏览器滚动锚定，防止内容高度变化时顶部元素意外下移 */
.focus-content :deep(.el-scrollbar__wrap) {
  height: 100%;
  position: relative;
  overflow-anchor: none;
}

/* ========== 类型切换 ========== */
.mode-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 16px;
  margin-bottom: 20px;
  width: 100%;
}

.mode-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.65);
  flex-shrink: 0;
}

.type-toggle {
  position: relative;
  display: flex;
  align-items: center;
  padding: 3px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 100px;
  overflow: hidden;
}

.toggle-slider {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.35) 0%, rgba(192, 132, 252, 0.35) 100%);
  border-radius: 100px;
  transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 14px rgba(167, 139, 250, 0.3);
}

.type-toggle.active-right .toggle-slider {
  left: calc(50% + 0px);
}

.type-btn {
  position: relative;
  z-index: 1;
  padding: 6px 20px;
  font-size: 13px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  transition: color 0.35s;
  font-family: inherit;
  white-space: nowrap;
  flex: 1;
  text-align: center;
}

.type-btn:hover {
  color: var(--chalk-white);
}

.type-btn.active {
  color: var(--chalk-white);
}

/* 两段式风格切换（圆环 / 数字） */
.style-2-seg .toggle-slider {
  width: calc(50% - 3px);
  transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 时间数字 */
.timer-time {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-weight: 700;
  font-size: 72px;
  color: #a78bfa;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  line-height: 1;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 48px;
}

/* ========== 进度圆环 ========== */
.timer-ring {
  position: relative;
  width: 180px;
  height: 180px;
  margin: 0 auto 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a78bfa;
}

.ring-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 6;
}

.ring-progress {
  fill: none;
  stroke-width: 6;
  transition: stroke-dashoffset 0.3s ease;
}

.ring-particles {
  animation: particle-rotate 8s linear infinite;
  transform-origin: 60px 60px;
}

.ring-particle {
  fill: #c4b5fd;
}

@keyframes particle-rotate {
  to { transform: rotate(360deg); }
}

.ring-time {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-weight: 800;
  font-size: 32px;
  color: currentColor;
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  white-space: nowrap;
}

.time-group {
  position: relative;
  display: inline-block;
}

/* ========== 空闲视图 ========== */
.idle-view {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0 0 40px;
}

/* ========== 通用按钮 ========== */
.focus-ctrl-btn {
  padding: 10px 18px;
  font-size: 14px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: var(--chalk-white-60);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
  font-family: inherit;
}

.focus-ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--chalk-white);
}

/* 输入区 */
.focus-input-section {
  width: 100%;
}

.input-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.65);
  margin-bottom: 6px;
}

.focus-input-section :deep(.el-textarea__inner) {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
  color: #fff;
  transition: all 0.2s ease;
  font-family: inherit;
}

.focus-input-section :deep(.el-textarea__inner:hover) {
  border-color: rgba(167, 139, 250, 0.4);
}

.focus-input-section :deep(.el-textarea__inner:focus) {
  border-color: rgba(167, 139, 250, 0.6);
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.12);
}

.focus-input-section :deep(.el-textarea__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

.focus-input-section :deep(.el-input-number .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
}
.focus-input-section :deep(.el-input-number .el-input__inner) {
  color: #fff;
}
.focus-input-section :deep(.el-input-number__decrease),
.focus-input-section :deep(.el-input-number__increase) {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.focus-input-section :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
  transition: all 0.2s ease;
}

.focus-input-section :deep(.el-input__wrapper:hover) {
  border-color: rgba(167, 139, 250, 0.4);
}

.focus-input-section :deep(.el-input__wrapper.is-focus) {
  border-color: rgba(167, 139, 250, 0.6);
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.12);
}

.focus-input-section :deep(.el-input__inner) {
  color: #fff;
}

.focus-input-section :deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

/* 开始按钮 + 设置按钮 */
.focus-start-wrapper {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
  width: 100%;
}

.focus-start-btn {
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.3) 0%, rgba(192, 132, 252, 0.3) 100%);
  border-color: rgba(167, 139, 250, 0.5);
  color: var(--chalk-white);
  font-weight: 600;
}

.focus-start-btn:hover {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.45) 0%, rgba(192, 132, 252, 0.45) 100%);
  border-color: rgba(167, 139, 250, 0.7);
  box-shadow: 0 0 18px rgba(167, 139, 250, 0.35);
  color: var(--chalk-white);
}

/* ========== 常用专注 ========== */
.favorites-section {
  width: 100%;
  margin-top: 32px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 16px;
}

.favorites-grid {
  display: grid;
  gap: 24px;
}

.favorite-card {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.favorite-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(167, 139, 250, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(167, 139, 250, 0.15);
}

.favorite-card.editing {
  background: rgba(167, 139, 250, 0.12);
  border-color: rgba(167, 139, 250, 0.8);
  box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.4);
}

.fav-name {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fav-icon {
  margin-right: 6px;
}

.fav-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.fav-notes {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.65);
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fav-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.favorite-card:hover .fav-delete {
  opacity: 1;
}

/* ========== 计时中视图 ========== */
.timing-view {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: calc(100% - 48px);
  padding: 40px 0;
  z-index: 1;
}

.focus-info-card {
  margin-top: 12px;
  padding: 14px 24px;
  text-align: center;
  max-width: 420px;
  width: 100%;
}

.focus-info-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--chalk-white);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-info-notes {
  margin-top: 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.focus-cancel-btn:hover {
  background: rgba(220, 38, 38, 0.15) !important;
  border-color: rgba(220, 38, 38, 0.4) !important;
  color: #f87171 !important;
}

.focus-complete-btn {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.3) 0%, rgba(192, 132, 252, 0.3) 100%);
  border-color: rgba(167, 139, 250, 0.5);
  color: var(--chalk-white);
  font-weight: 600;
}

.focus-complete-btn:hover {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.45) 0%, rgba(192, 132, 252, 0.45) 100%);
  border-color: rgba(167, 139, 250, 0.7);
  box-shadow: 0 0 18px rgba(167, 139, 250, 0.35);
  color: var(--chalk-white) !important;
}

.dialog-text {
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

/* 按钮样式 - 适配深色主题 */
:deep(.el-button) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}

:deep(.el-button:hover) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

:deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: #fff;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  border-color: #764ba2;
}

:deep(.el-button--danger) {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

:deep(.el-button--danger:hover) {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.5);
  color: #fca5a5;
}
</style>
