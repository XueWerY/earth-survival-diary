<template>
  <div class="focus-container">
    <!-- 主内容区 -->
    <div class="focus-content">
      <el-scrollbar>
        <!-- 非计时状态：显示计时器 -->
        <div v-if="timerState === 'idle'" class="idle-view">
          <!-- 番茄钟视觉 -->
          <template v-if="focusType === 'pomodoro'">
            <div class="star-ring-container">
              <svg viewBox="0 0 260 260" class="star-ring-svg">
                <circle v-for="(star, i) in starRingStars" :key="i"
                  :cx="star.cx" :cy="star.cy" r="3"
                  :class="star.lit ? 'ring-star-lit' : 'ring-star-dim'"
                  :style="star.lit ? { animationDelay: `${i * 0.03}s` } : null"
                />
              </svg>
              <div class="emoji-earth">🌍</div>
              <div class="moon-orbit-container" :style="moonOrbitStyle">
                <div class="emoji-moon">🌙</div>
              </div>
            </div>
          </template>

          <!-- 正计时视觉：星轨环（全亮） -->
          <template v-else>
            <div class="star-ring-container">
              <svg viewBox="0 0 260 260" class="star-ring-svg">
                <circle v-for="(star, i) in stopwatchStars" :key="i"
                  :cx="star.cx" :cy="star.cy" r="3"
                  class="ring-star-lit ring-star-static"
                />
              </svg>
              <div class="emoji-earth">🌍</div>
              <div class="moon-orbit-container" :style="stopwatchMoonStyle">
                <div class="emoji-moon">🌙</div>
              </div>
            </div>
          </template>

          <!-- 控制按钮 - 放在时钟下方 -->
          <div class="focus-control-buttons">
            <button class="focus-ctrl-btn" :class="{ active: focusType === 'pomodoro' }" @click="focusType = 'pomodoro'">🍅 番茄钟</button>
            <button class="focus-ctrl-btn" :class="{ active: focusType === 'stopwatch' }" @click="focusType = 'stopwatch'">⏱️ 正计时</button>
          </div>

          <!-- 专注名称输入 -->
          <div class="focus-input-section">
            <el-input
                v-model="focusName"
                placeholder="输入专注事项（必填）"
                size="large"
                clearable
                maxlength="50"
                show-word-limit
                :disabled="isGuideActive"
            />
            <el-input
                v-model="focusNotes"
                placeholder="添加备注（可选）"
                size="large"
                clearable
                :disabled="isGuideActive"
                maxlength="200"
                style="margin-top: 12px"
            />
          </div>

          <div class="focus-start-wrapper">
            <button class="focus-ctrl-btn settings-trigger-btn" @click="showFocusSettings = true">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              <span>设置</span>
            </button>
            <button class="focus-ctrl-btn focus-start-btn" @click="startFocus">▶️ 开始专注</button>
          </div>

          <!-- 常用专注 -->
          <div v-if="favorites.length > 0" class="favorites-section">
            <div class="section-title">
              <el-icon><Star /></el-icon>
              常用专注
            </div>
            <div class="favorites-grid">
              <div
                  v-for="fav in favorites"
                  :key="fav.id"
                  class="favorite-card"
                  @click="selectFavorite(fav)"
              >
                <div class="fav-name">{{ fav.name }}</div>
                <div class="fav-info">
                  <span>{{ fav.type === 'pomodoro' ? `${fav.targetDuration}分钟` : '正计时' }}</span>
                </div>
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

        <!-- 计时中状态 -->
        <div v-else class="timing-view">
          <!-- 番茄钟：星轨环 -->
          <template v-if="focusType === 'pomodoro'">
            <div class="star-ring-container">
              <svg viewBox="0 0 260 260" class="star-ring-svg">
                <circle v-for="(star, i) in starRingStars" :key="i"
                  :cx="star.cx" :cy="star.cy" r="3"
                  :class="star.lit ? 'ring-star-lit' : 'ring-star-dim'"
                  :style="star.lit ? { animationDelay: `${i * 0.03}s` } : null"
                />
              </svg>
              <div class="emoji-earth">🌍</div>
              <div class="moon-orbit-container" :style="moonOrbitStyle">
                <div class="emoji-moon">🌙</div>
              </div>
            </div>

            <div class="focus-info-inline">
              <span class="focus-name-inline">{{ focusName }}</span>
              <span class="focus-sep-inline">:</span>
              <span class="focus-time-inline">{{ displayTime }}</span>
              <span v-if="focusNotes" class="focus-notes-inline">· {{ focusNotes }}</span>
            </div>
          </template>

          <!-- 正计时：星轨环（全亮） -->
          <template v-else>
            <div class="star-ring-container">
              <svg viewBox="0 0 260 260" class="star-ring-svg">
                <circle v-for="(star, i) in stopwatchStars" :key="i"
                  :cx="star.cx" :cy="star.cy" r="3"
                  class="ring-star-lit ring-star-static"
                />
              </svg>
              <div class="emoji-earth">🌍</div>
              <div class="moon-orbit-container moon-orbit-animated" :style="stopwatchMoonStyle">
                <div class="emoji-moon">🌙</div>
              </div>
            </div>

            <div class="focus-info-inline">
              <span class="focus-name-inline">{{ focusName }}</span>
              <span class="focus-sep-inline">:</span>
              <span class="focus-time-inline">{{ displayTime }}</span>
              <span v-if="focusNotes" class="focus-notes-inline">· {{ focusNotes }}</span>
            </div>
          </template>

          <!-- 操作按钮 -->
          <div class="action-buttons">
            <button class="focus-ctrl-btn focus-cancel-btn" @click="cancelFocus">✕ 取消</button>
            <button class="focus-ctrl-btn focus-complete-btn" @click="completeFocus">✓ 完成</button>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 完成后保存常用对话框 -->
    <el-dialog
        v-model="showSaveFavorite"
        title="保存为常用专注？"
        width="400px"
        class="dark-dialog"
    >
      <p class="dialog-text">是否将此专注保存为常用？方便下次快速开始。</p>
      <template #footer>
        <el-button @click="showSaveFavorite = false">跳过</el-button>
        <el-button type="primary" @click="saveAsFavorite">保存</el-button>
      </template>
    </el-dialog>

    <!-- 专注设置弹窗 -->
    <Teleport to="body">
      <div v-if="showFocusSettings" class="dialog-overlay" @click.self="cancelFocusSettings">
        <div class="dialog-container focus-settings-dialog">
          <div class="dialog-header folder-dialog-header">
            <span class="dialog-header-title folder-dialog-title">专注设置</span>
          </div>
          <div class="dialog-body">
            <div class="setting-item">
              <div class="setting-info">
                <span class="setting-label">番茄时长</span>
                <span class="setting-desc">每个番茄钟的默认工作时长（分钟）</span>
              </div>
              <div class="setting-control">
                <el-input-number
                    v-model="focusSettingsDraft.pomodoroDuration"
                    :min="1"
                    :max="120"
                    :step="5"
                    size="default"
                />
              </div>
            </div>
            <div class="form-footer">
              <button class="capsule-btn cancel-btn" @click="cancelFocusSettings">
                <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                <span>取消</span>
              </button>
              <button class="capsule-btn submit-btn" @click="confirmFocusSettings">
                <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
                <span>确认</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
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

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const isGuideActive = inject('guideVisible', ref(false))

const focusStore = useFocusStore()
const taskStore = useTaskStore()
const settingsStore = useSettingsStore()
const pageNav = usePageNav()

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
const lastCompletedFocus = ref<{ name: string; notes: string; type: FocusType; targetDuration: number } | null>(null)

const showFocusSettings = ref(false)
const focusSettingsDraft = ref({
  pomodoroDuration: 25
})

const cancelFocusSettings = () => {
  showFocusSettings.value = false
}

const confirmFocusSettings = async () => {
  await settingsStore.updateFocusSettings({ pomodoroDuration: focusSettingsDraft.value.pomodoroDuration })
  localPomodoroDuration.value = focusSettingsDraft.value.pomodoroDuration
  logger.info('[设置] 修改专注时长', { pomodoroDuration: focusSettingsDraft.value.pomodoroDuration })
  showFocusSettings.value = false
}

watch(showFocusSettings, (val) => {
  if (val) {
    focusSettingsDraft.value.pomodoroDuration = settingsStore.settings.focus?.pomodoroDuration || 25
  }
})

const timeChars = ref<string[]>([])
const prevTimeChars = ref<string[]>([])
const flippingChars = ref(new Set<number>())

// 星轨环 60 星
const STAR_COUNT = 60
const RING_RADIUS = 110
const RING_CX = 130
const RING_CY = 130

interface RingStar { cx: number; cy: number; lit: boolean }

const starRingStars = computed<RingStar[]>(() => {
  const total = localPomodoroDuration.value * 60
  const litCount = timerState.value === 'idle' ? 0 : Math.floor(((total - remainingSeconds.value) / total) * STAR_COUNT)
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const angle = (i / STAR_COUNT) * Math.PI * 2 - Math.PI / 2
    return {
      cx: RING_CX + Math.cos(angle) * RING_RADIUS,
      cy: RING_CY + Math.sin(angle) * RING_RADIUS,
      lit: i < litCount
    }
  })
})

// 常用专注
const favorites = computed(() => focusStore.favorites)

// 显示时间
const displayTime = computed(() => {
  if (timerState.value === 'idle') {
    if (focusType.value === 'pomodoro') {
      const minutes = localPomodoroDuration.value
      return `${minutes.toString().padStart(2, '0')}:00`
    } else {
      return '00:00'
    }
  } else {
    const seconds = focusType.value === 'pomodoro' ? remainingSeconds.value : elapsedSeconds.value
    const totalSeconds = Math.abs(seconds)

    // 计算天、小时、分钟、秒
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60

    // 动态时间格式
    if (days > 0 || totalSeconds >= 86400) {
      // >= 24小时：dd:hh:mm:ss
      return `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else if (hours > 0 || totalSeconds >= 3600) {
      // >= 60分钟但 < 24小时：hh:mm:ss
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      // < 60分钟：mm:ss
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
  }
})

// 定时器 ID
// 进度条偏移
const progressOffset = computed(() => {
  if (focusType.value === 'pomodoro') {
    const totalSeconds = localPomodoroDuration.value * 60
    const progress = remainingSeconds.value / totalSeconds
    const circumference = 2 * Math.PI * 90
    return circumference * (1 - progress)
  } else {
    // 正计时模式：进度环不显示
    return 0
  }
})

watch(displayTime, (val, old) => {
  if (timerState.value === 'running') {
    focusStore.focusDisplayTime = val
  }
  if (!old || timerState.value !== 'running' || focusType.value !== 'stopwatch') return
  const nc = val.split('')
  const oc = old.split('')
  prevTimeChars.value = [...timeChars.value]
  const flips = new Set<number>()
  const maxLen = Math.max(nc.length, oc.length)
  for (let i = 0; i < maxLen; i++) {
    if ((nc[i] || '') !== (oc[i] || '')) flips.add(i)
  }
  flippingChars.value = flips
  setTimeout(() => { flippingChars.value = new Set() }, 600)
  timeChars.value = nc
})

watch(focusType, () => {
})

const moonOrbitAngle = computed(() => {
  const total = localPomodoroDuration.value * 60
  if (total <= 0) return 0
  const progress = (total - remainingSeconds.value) / total
  return progress * 360
})

const moonOrbitStyle = computed(() => ({
  transform: `rotate(${moonOrbitAngle.value}deg)`
}))

const stopwatchStars = computed<RingStar[]>(() => {
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const angle = (i / STAR_COUNT) * Math.PI * 2 - Math.PI / 2
    return {
      cx: RING_CX + Math.cos(angle) * RING_RADIUS,
      cy: RING_CY + Math.sin(angle) * RING_RADIUS,
      lit: true
    }
  })
})

const stopwatchMoonStyle = computed(() => {
  if (timerState.value !== 'running' || focusType.value !== 'stopwatch') {
    return { transform: 'rotate(0deg)' }
  }
  const elapsedMs = (Date.now() - startTimestamp.value) % 60000
  return { animationDelay: `${-(elapsedMs / 1000)}s` }
})

// 选择常用专注
const selectFavorite = (fav: FavoriteFocus) => {
  focusName.value = fav.name
  focusNotes.value = fav.notes
  focusType.value = fav.type
  if (fav.type === 'pomodoro') {
    localPomodoroDuration.value = fav.targetDuration
  }
}

// 删除常用专注
const deleteFavorite = async (id: string) => {
  await focusStore.deleteFavorite(id)
  logger.info('[专注] 删除常用专注', { id })
  ElMessage.success('已删除')
}

// 开始专注
const startFocus = async () => {
  if (!focusName.value.trim()) {
    ElMessage.warning('请输入专注事项')
    return
  }

  logger.info('[专注] 开始专注', { name: focusName.value, type: focusType.value })

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

  updateTimer() // 立即执行一次
  timerInterval = setInterval(updateTimer, 1000)
  timeChars.value = '00:00'.split('')
  prevTimeChars.value = [...timeChars.value]
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
  focusStore.focusDisplayTime = ''

  timeChars.value = '00:00'.split('')

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
    targetDuration: localPomodoroDuration.value
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
  focusStore.focusDisplayTime = ''

  timeChars.value = '00:00'.split('')

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
    targetDuration: lastCompletedFocus.value.targetDuration
  })

  showSaveFavorite.value = false
  lastCompletedFocus.value = null

  if (result) {
    logger.info('[专注] 添加常用专注', { name: lastCompletedFocus.value.name })
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

  timeChars.value = '00:00'.split('')
  prevTimeChars.value = [...timeChars.value]
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
  display: flex;
  flex-direction: column;
  background: transparent;
}

.focus-content {
  flex: 1;
  overflow: hidden;
}

/* 空闲视图 */
.idle-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px;
}

.focus-control-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  margin-bottom: 12px;
}

.focus-ctrl-btn {
  padding: 10px 16px;
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
}

.focus-ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--chalk-white);
}

.focus-ctrl-btn.active {
  background: rgba(102, 126, 234, 0.2);
  border-color: #667eea;
  color: var(--chalk-white);
}

.focus-start-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.focus-start-wrapper .focus-ctrl-btn {
  border-color: rgba(102, 126, 234, 0.3);
}

/* 计时器圆环 */
.timer-ring {
  position: relative;
  width: 320px;
  height: 320px;
  margin-bottom: 32px;
}

.timer-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.timer-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 8;
}

.timer-progress {
  fill: none;
  stroke: #667eea;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 565.48;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 1s linear;
}

.timer-ring.stopwatch-mode .timer-progress {
  stroke: #10b981;
}

.timer-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.timer-time {
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  font-family: 'SF Mono', 'Monaco', monospace;
  display: block;
  letter-spacing: 2px;
  line-height: 1.2;
}

.timer-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 8px;
  display: block;
}

/* 番茄钟视觉区（星轨环+星空） */
.star-ring-container {
  position: relative;
  width: 260px;
  height: 260px;
  margin: 0 auto;
}

.star-ring-svg {
  width: 100%;
  height: 100%;
  animation: ring-rotate 30s linear infinite;
  will-change: transform;
}

@keyframes ring-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ring-star-dim {
  fill: rgba(255, 255, 255, 0.12);
}

.ring-star-lit {
  fill: #a4b4ff;
  animation: star-breathe 1.5s ease-in-out infinite;
}

@keyframes star-breathe {
  0%, 100% { opacity: 0.8; r: 3; }
  50% { opacity: 1; r: 3.5; }
}

.emoji-earth {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 48px;
  line-height: 1;
  user-select: none;
  z-index: 3;
  animation: earth-spin 12s linear infinite;
}

@keyframes earth-spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

.moon-orbit-container {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  transform-origin: 0 0;
}

.emoji-moon {
  position: absolute;
  top: -85px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 16px;
  user-select: none;
  z-index: 4;
}

@keyframes moon-rotate-sw {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.moon-orbit-animated {
  animation: moon-rotate-sw 60s linear infinite;
}

.ring-star-static {
  fill: #a4b4ff;
  animation: none;
  opacity: 0.9;
}

/* 番茄钟信息行 */
.focus-info-inline {
  text-align: center;
  margin-bottom: 32px;
}

.focus-name-inline {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.focus-sep-inline {
  font-size: 18px;
  color: rgba(255,255,255,0.4);
  margin: 0 8px;
}

.focus-time-inline {
  font-size: 20px;
  font-weight: 700;
  color: #82d8e8;
  font-family: 'SF Mono', 'Monaco', monospace;
  letter-spacing: 2px;
}

.focus-notes-inline {
  display: block;
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  margin-top: 4px;
}

/* 翻页时钟（正计时） */
.flip-clock-container {
  z-index: 1;
}

.flip-clock {
  display: flex;
  align-items: stretch;
  gap: 4px;
}

.flip-sep {
  font-size: 56px;
  font-weight: 700;
  color: #a4b4ff;
  font-family: 'SF Mono', 'Monaco', monospace;
  line-height: 1;
  padding: 0 2px;
  text-shadow: 0 0 12px rgba(102, 126, 234, 0.5);
  animation: sep-blink 1s step-end infinite;
}

@keyframes sep-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.flip-digit {
  position: relative;
  width: 46px;
  height: 68px;
  border-radius: 6px;
  background: linear-gradient(180deg, #12102a 0%, #1a1640 50%, #12102a 100%);
  box-shadow: 0 3px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 10px rgba(102,126,234,0.1);
  overflow: hidden;
  perspective: 400px;
}

.flip-digit::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: linear-gradient(180deg, transparent 48%, rgba(102,126,234,0.15) 49%, rgba(102,126,234,0.15) 51%, transparent 52%);
  pointer-events: none;
  z-index: 2;
}

.flip-digit-top,
.flip-digit-bottom {
  position: absolute;
  left: 0;
  right: 0;
  height: 50%;
  font-size: 52px;
  font-weight: 700;
  font-family: 'SF Mono', 'Monaco', monospace;
  color: #c8d6ff;
  text-align: center;
  line-height: 68px;
  backface-visibility: hidden;
  perspective: 400px;
}

.flip-digit-top {
  top: 0;
  transform-origin: bottom;
}

.flip-digit-bottom {
  bottom: 0;
  line-height: 0;
}

.flip-digit.flip .flip-digit-top {
  animation: digit-flip 0.6s ease-in forwards;
}

@keyframes digit-flip {
  0% { transform: perspective(400px) rotateX(0deg); }
  100% { transform: perspective(400px) rotateX(-90deg); opacity: 0; }
}

/* 常用专注 */
.focus-input-section {
  width: 100%;
  max-width: 500px;
}

.focus-input-section :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.focus-input-section :deep(.el-input__inner) {
  color: #fff;
}

.focus-input-section :deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

.focus-input-section :deep(.el-input__count),
.focus-input-section :deep(.el-input__count-inner) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.4) !important;
}

/* 常用专注 */
.favorites-section {
  width: 100%;
  max-width: 500px;
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
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
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
  border-color: rgba(102, 126, 234, 0.5);
  transform: translateY(-2px);
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

.fav-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
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

/* 计时中视图 */
.timing-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px;
  position: relative;
  overflow: hidden;
}

.timing-view::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 15% 25%, rgba(255,255,255,0.3), transparent),
    radial-gradient(2px 2px at 75% 15%, rgba(255,255,255,0.2), transparent),
    radial-gradient(1px 1px at 35% 70%, rgba(255,255,255,0.25), transparent),
    radial-gradient(1.5px 1.5px at 85% 60%, rgba(255,255,255,0.15), transparent),
    radial-gradient(2px 2px at 20% 80%, rgba(255,255,255,0.2), transparent),
    radial-gradient(1px 1px at 60% 40%, rgba(255,255,255,0.3), transparent),
    radial-gradient(1.5px 1.5px at 50% 85%, rgba(255,255,255,0.15), transparent),
    radial-gradient(1px 1px at 90% 30%, rgba(255,255,255,0.25), transparent);
  pointer-events: none;
  z-index: 0;
}

.focus-name-display {
  text-align: center;
  margin-top: 24px;
  margin-bottom: 32px;
}

.focus-name-display h3 {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.focus-name-display p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 8px 0 0;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.focus-cancel-btn:hover {
  background: rgba(220, 38, 38, 0.15) !important;
  border-color: rgba(220, 38, 38, 0.4) !important;
  color: #f87171 !important;
}

.focus-complete-btn {
  border-color: rgba(102, 126, 234, 0.3);
  color: var(--chalk-white);
}

.focus-complete-btn:hover {
  background: rgba(102, 126, 234, 0.2) !important;
  border-color: #667eea !important;
  color: var(--chalk-white) !important;
}

.settings-trigger-btn {
  margin-right: 12px;
  white-space: nowrap;
  gap: 6px;
}

.settings-trigger-btn .capsule-icon {
  width: 16px;
  height: 16px;
}

.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.dialog-container { background: rgba(30,28,52,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }
.focus-settings-dialog { width: 400px; }

.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 0; flex-shrink: 0; }
.dialog-header-title { font-size: 16px; font-weight: 600; color: var(--chalk-white); }
.folder-dialog-header { justify-content: center; }
.folder-dialog-title { text-align: center; }
.dialog-body { padding: 12px 16px 16px; overflow-y: auto; flex: 1; scrollbar-width: none; -ms-overflow-style: none; }
.dialog-body::-webkit-scrollbar { display: none; }

.setting-item { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; gap: 16px; }
.setting-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.setting-label { font-size: 14px; font-weight: 500; color: #fff; }
.setting-desc { font-size: 12px; color: rgba(255, 255, 255, 0.5); }
.setting-control { flex-shrink: 0; }

.form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
.capsule-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 18px; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; background: transparent; color: var(--chalk-white-70); cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.2s; }
.capsule-btn:hover { background: rgba(255,255,255,0.08); color: var(--chalk-white); }
.capsule-btn .capsule-icon { width: 14px; height: 14px; }
.submit-btn { background: rgba(102,126,234,0.2); border-color: rgba(102,126,234,0.4); color: #93c5fd; }
.submit-btn:hover { background: rgba(102,126,234,0.35); color: var(--chalk-white); }

/* 对话框深色主题 */
.duration-unit {
  margin-left: 8px;
  color: rgba(255, 255, 255, 0.5);
}

.dialog-text {
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

/* 深色对话框全局样式 */
:deep(.dark-dialog) {
  --el-dialog-bg-color: rgba(30, 30, 50, 0.95);
  --el-dialog-title-font-size: 18px;
}

:deep(.dark-dialog .el-dialog) {
  background: rgba(30, 30, 50, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

:deep(.dark-dialog .el-dialog__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px 24px;
}

:deep(.dark-dialog .el-dialog__title) {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}

:deep(.dark-dialog .el-dialog__headerbtn .el-dialog__close) {
  color: rgba(255, 255, 255, 0.5);
}

:deep(.dark-dialog .el-dialog__headerbtn:hover .el-dialog__close) {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark-dialog .el-dialog__body) {
  padding: 24px;
  color: rgba(255, 255, 255, 0.8);
}

:deep(.dark-dialog .el-dialog__footer) {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 24px;
}

:deep(.dark-dialog .el-form-item__label) {
  color: rgba(255, 255, 255, 0.7);
}

:deep(.dark-dialog .el-input-number) {
  background: rgba(255, 255, 255, 0.05);
}

:deep(.dark-dialog .el-input-number .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

:deep(.dark-dialog .el-input-number .el-input__inner) {
  color: #fff;
}

:deep(.dark-dialog .el-input-number__decrease),
:deep(.dark-dialog .el-input-number__increase) {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

:deep(.dark-dialog .el-input-number__decrease:hover),
:deep(.dark-dialog .el-input-number__increase:hover) {
  color: #fff;
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
