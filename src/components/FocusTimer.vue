<template>
  <div class="focus-container">
    <!-- 主内容区 -->
    <div class="focus-content">
      <el-scrollbar>
        <!-- 非计时状态：显示计时器 -->
        <div v-if="timerState === 'idle'" class="idle-view">
          <!-- 计时器圆环 -->
          <div class="timer-ring" :class="{ 'stopwatch-mode': focusType === 'stopwatch' }">
            <svg viewBox="0 0 200 200" class="timer-svg">
              <circle cx="100" cy="100" r="90" class="timer-bg" />
              <circle cx="100" cy="100" r="90" class="timer-progress" />
            </svg>
            <div class="timer-display">
              <span class="timer-time">{{ displayTime }}</span>
              <span class="timer-label">{{ focusType === 'pomodoro' ? '番茄钟' : '正计时' }}</span>
            </div>
          </div>

          <!-- 模式切换 -->
          <div class="mode-switch">
            <el-radio-group v-model="focusType" size="large">
              <el-radio-button value="pomodoro">番茄钟</el-radio-button>
              <el-radio-button value="stopwatch">正计时</el-radio-button>
            </el-radio-group>
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
            />
            <el-input
                v-model="focusNotes"
                placeholder="添加备注（可选）"
                size="large"
                clearable
                maxlength="200"
                style="margin-top: 12px"
            />
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

          <!-- 开始按钮 -->
          <el-button
              type="primary"
              size="large"
              class="start-button"
              :disabled="!focusName.trim()"
              @click="startFocus"
          >
            <el-icon><VideoPlay /></el-icon>
            开始专注
          </el-button>
        </div>

        <!-- 计时中状态 -->
        <div v-else class="timing-view">
          <!-- 计时器圆环 -->
          <div class="timer-ring" :class="{ 'stopwatch-mode': focusType === 'stopwatch' }">
            <svg viewBox="0 0 200 200" class="timer-svg">
              <circle cx="100" cy="100" r="90" class="timer-bg" />
              <circle
                  cx="100"
                  cy="100"
                  r="90"
                  class="timer-progress"
                  :style="{ strokeDashoffset: progressOffset }"
              />
            </svg>
            <div class="timer-display">
              <span class="timer-time">{{ displayTime }}</span>
              <span class="timer-label">{{ focusName }}</span>
            </div>
          </div>

          <!-- 专注名称 -->
          <div class="focus-name-display">
            <h3>{{ focusName }}</h3>
            <p v-if="focusNotes">{{ focusNotes }}</p>
          </div>

          <!-- 操作按钮 -->
          <div class="action-buttons">
            <el-button size="large" class="text-only-btn" @click="cancelFocus">取消</el-button>
            <el-button type="primary" size="large" class="text-only-btn" @click="completeFocus">完成</el-button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay, Star, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useFocusStore, type FavoriteFocus, type TimerState as StoredTimerState } from '../stores/focusStore'
import { useTaskStore } from '../stores/taskStore'
import { useSettingsStore } from '../stores/settingsStore'
import { logger } from '../lib/logger'

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const focusStore = useFocusStore()
const taskStore = useTaskStore()
const settingsStore = useSettingsStore()

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
      // 时间到
      sendNotification(focusName.value)
      completeFocus()
    }
  }

  updateTimer() // 立即执行一次
  timerInterval = setInterval(updateTimer, 1000)
}

// 发送系统通知
const sendNotification = (name: string) => {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification('专注完成', { body: `「${name}」已完成` })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        new Notification('专注完成', { body: `「${name}」已完成` })
      }
    })
  }
}

// 开始正计时 - 使用时间戳计算
const startStopwatch = () => {
  if (timerInterval) clearInterval(timerInterval)

  const updateTimer = () => {
    const now = Date.now()
    elapsedSeconds.value = Math.floor((now - startTimestamp.value) / 1000)
    lastUpdateTime.value = now
  }

  updateTimer() // 立即执行一次
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
  pausedElapsedSeconds.value = 0
  startTimestamp.value = 0
  lastUpdateTime.value = 0

  // 清除 store 中的计时状态
  await focusStore.clearTimerState()

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

  // 清除 store 中的计时状态
  await focusStore.clearTimerState()

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
        sendNotification(focusName.value)
        await completeFocus()
      }
    } else {
      elapsedSeconds.value = totalElapsed
      startStopwatch()
    }
  }

  // 监听页面可见性变化，确保后台计时准确
  document.addEventListener('visibilitychange', handleVisibilityChange)
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
        sendNotification(focusName.value)
        completeFocus()
      }
    } else {
      elapsedSeconds.value = elapsed
    }

    lastUpdateTime.value = now
  }
}

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

.timer-ring.active .timer-progress {
  animation: pulse-ring 2s ease-in-out infinite;
}

@keyframes pulse-ring {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
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

/* 模式切换 */
.mode-switch {
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.mode-switch :deep(.el-radio-button__inner) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.mode-switch :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: #fff;
}

/* 输入区域 */
.focus-input-section {
  width: 100%;
  max-width: 400px;
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

/* 开始按钮 */
.start-button {
  margin-top: 32px;
  padding: 16px 48px;
  font-size: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.start-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

.start-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 计时中视图 */
.timing-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px;
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
  gap: 16px;
}

.action-buttons .el-button {
  padding: 12px 32px;
  font-size: 15px;
}

.text-only-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

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
