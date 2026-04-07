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
            <el-button @click="showStats = true" class="stats-btn">
              <el-icon><DataLine /></el-icon>
              统计
            </el-button>
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
          <div class="timer-ring active" :class="{ 'stopwatch-mode': focusType === 'stopwatch' }">
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
            <el-button size="large" @click="cancelFocus">
              <el-icon><Close /></el-icon>
              取消
            </el-button>
            <el-button type="primary" size="large" @click="completeFocus">
              <el-icon><Check /></el-icon>
              完成
            </el-button>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 统计全屏展示 -->
    <div v-if="showStats" class="stats-fullscreen">
      <div class="stats-header">
        <div class="stats-header-left">
          <h2>专注统计</h2>
        </div>
        <div class="stats-header-right">
          <el-radio-group v-model="statsRange" size="default" @change="handleRangeChange">
            <el-radio-button value="day">日</el-radio-button>
            <el-radio-button value="week">周</el-radio-button>
            <el-radio-button value="month">月</el-radio-button>
            <el-radio-button value="year">年</el-radio-button>
          </el-radio-group>
          <!-- 日模式使用农历日期选择器 -->
          <LunarDatePicker
              v-if="statsRange === 'day'"
              v-model="selectedDayDate"
              placeholder="选择日期"
          />
          <!-- 周/月/年模式使用 el-date-picker -->
          <el-date-picker
              v-else
              v-model="selectedDate"
              :type="datePickerType"
              :placeholder="datePickerPlaceholder"
              :clearable="false"
              size="default"
              :format="datePickerFormat"
              :value-format="datePickerValueFormat"
          />
          <el-button @click="showStats = false" circle :icon="Close" />
        </div>
      </div>

      <el-scrollbar class="stats-body">
        <!-- 概览 -->
        <div class="stats-overview">
          <div class="stat-card">
            <div class="stat-value">{{ rangeFocusCount }}</div>
            <div class="stat-label">专注次数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ formatDuration(rangeFocusDuration) }}</div>
            <div class="stat-label">专注时长</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ avgFocusDuration }}</div>
            <div class="stat-label">平均时长</div>
          </div>
        </div>

        <!-- 趋势图 -->
        <div class="trend-chart">
          <div class="chart-title">{{ getTrendTitle() }}</div>
          <div class="chart-bars" :style="{ height: getChartHeight() }">
            <div
                v-for="(stat, index) in trendData"
                :key="index"
                class="chart-bar-item"
            >
              <div class="bar-wrapper">
                <div
                    class="bar"
                    :style="{ height: getBarHeight(stat.duration) + '%' }"
                >
                  <span class="bar-value" v-if="stat.duration > 0">{{ formatBarValue(stat.duration) }}</span>
                </div>
              </div>
              <div class="bar-label">{{ stat.label }}</div>
            </div>
          </div>
        </div>

        <!-- 专注事项排行 -->
        <div class="focus-ranking" v-if="rangeStatsByName.length > 0">
          <div class="ranking-title">专注事项排行</div>
          <div class="ranking-list">
            <div
                v-for="(item, index) in rangeStatsByName.slice(0, 10)"
                :key="item.name"
                class="ranking-item"
            >
              <span class="ranking-num">{{ index + 1 }}</span>
              <span class="ranking-name">{{ item.name }}</span>
              <span class="ranking-count">{{ item.count }}次</span>
              <span class="ranking-duration">{{ formatDuration(item.duration) }}</span>
            </div>
          </div>
        </div>

        <!-- 无数据提示 -->
        <div v-if="rangeFocusCount === 0" class="no-data">
          <el-empty description="该时间段暂无专注记录" :image-size="120" />
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay, Close, Check, DataLine, Star, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useFocusStore, type FavoriteFocus, type TimerState as StoredTimerState } from '../stores/focusStore'
import { useTaskStore } from '../stores/taskStore'
import { useSettingsStore } from '../stores/settingsStore'
import LunarDatePicker from './LunarDatePicker.vue'

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

// 设置（从全局设置读取）
const showStats = ref(false)
type StatsRange = 'day' | 'week' | 'month' | 'year'
const statsRange = ref<StatsRange>('day')
const selectedDate = ref<Date>(new Date())
// 日模式下的字符串日期（用于 LunarDatePicker）
const selectedDayDate = ref<string>(dayjs().format('YYYY-MM-DD'))

// 番茄时长（本地可变，初始值从全局设置读取）
const localPomodoroDuration = ref(settingsStore.settings.focus?.pomodoroDuration || 25)

// 监听统计全屏状态变化
watch(showStats, (val) => {
  emit('fullscreen-change', val)
})

// 同步 selectedDayDate 和 selectedDate
watch(selectedDayDate, (newVal) => {
  if (newVal) {
    selectedDate.value = dayjs(newVal).toDate()
  }
})

watch(selectedDate, (newVal) => {
  selectedDayDate.value = dayjs(newVal).format('YYYY-MM-DD')
})

// 日期选择器配置
const datePickerType = computed(() => {
  switch (statsRange.value) {
    case 'day':
      return 'date'
    case 'week':
      return 'week'
    case 'month':
      return 'month'
    case 'year':
      return 'year'
    default:
      return 'date'
  }
})

const datePickerPlaceholder = computed(() => {
  switch (statsRange.value) {
    case 'day':
      return '选择日期'
    case 'week':
      return '选择周'
    case 'month':
      return '选择月份'
    case 'year':
      return '选择年份'
    default:
      return '选择日期'
  }
})

const datePickerFormat = computed(() => {
  switch (statsRange.value) {
    case 'day':
      return 'YYYY-MM-DD'
    case 'week':
      return 'YYYY年 第ww周'
    case 'month':
      return 'YYYY年MM月'
    case 'year':
      return 'YYYY年'
    default:
      return 'YYYY-MM-DD'
  }
})

const datePickerValueFormat = computed(() => {
  switch (statsRange.value) {
    case 'day':
      return 'YYYY-MM-DD'
    case 'week':
      return 'YYYY-MM-DD'
    case 'month':
      return 'YYYY-MM'
    case 'year':
      return 'YYYY'
    default:
      return 'YYYY-MM-DD'
  }
})

// 处理范围变化
const handleRangeChange = () => {
  // 切换范围时重置为当前时间
  selectedDate.value = new Date()
}

// 统计数据计算
const rangeStartDate = computed(() => {
  const dateValue = selectedDate.value
  let date: dayjs.Dayjs

  switch (statsRange.value) {
    case 'day':
      date = dayjs(dateValue)
      return date.format('YYYY-MM-DD')
    case 'week':
      // 周选择器返回的是该周的某一天
      date = dayjs(dateValue)
      return date.startOf('week').format('YYYY-MM-DD')
    case 'month':
      // 月选择器返回 YYYY-MM 格式
      date = dayjs(dateValue)
      return date.startOf('month').format('YYYY-MM-DD')
    case 'year':
      // 年选择器返回 YYYY 格式
      date = dayjs(dateValue)
      return date.startOf('year').format('YYYY-MM-DD')
    default:
      date = dayjs(dateValue)
      return date.format('YYYY-MM-DD')
  }
})

const rangeEndDate = computed(() => {
  const dateValue = selectedDate.value
  let date: dayjs.Dayjs

  switch (statsRange.value) {
    case 'day':
      date = dayjs(dateValue)
      return date.format('YYYY-MM-DD')
    case 'week':
      date = dayjs(dateValue)
      return date.endOf('week').format('YYYY-MM-DD')
    case 'month':
      date = dayjs(dateValue)
      return date.endOf('month').format('YYYY-MM-DD')
    case 'year':
      date = dayjs(dateValue)
      return date.endOf('year').format('YYYY-MM-DD')
    default:
      date = dayjs(dateValue)
      return date.format('YYYY-MM-DD')
  }
})

const rangeFocusCount = computed(() => {
  return focusStore.getCountByRange(rangeStartDate.value, rangeEndDate.value)
})

const rangeFocusDuration = computed(() => {
  return focusStore.getDurationByRange(rangeStartDate.value, rangeEndDate.value)
})

const avgFocusDuration = computed(() => {
  if (rangeFocusCount.value === 0) return '0分钟'
  const avg = Math.round(rangeFocusDuration.value / rangeFocusCount.value)
  return formatDuration(avg)
})

// 趋势数据 - 根据不同范围返回不同格式的数据
interface TrendDataItem {
  label: string
  duration: number
  count: number
}

const trendData = computed((): TrendDataItem[] => {
  switch (statsRange.value) {
    case 'day': {
      // 按小时统计
      const date = dayjs(selectedDate.value).format('YYYY-MM-DD')
      const hourlyStats = focusStore.getHourlyStatsByDate(date)
      // 只显示有数据的小时，或者显示6:00-24:00
      const activeHours = hourlyStats.filter(s => s.duration > 0)
      if (activeHours.length > 0) {
        // 找出最早和最晚的活跃小时
        const minHour = Math.min(...activeHours.map(s => s.hour))
        const maxHour = Math.max(...activeHours.map(s => s.hour))
        return hourlyStats
            .filter(s => s.hour >= Math.max(0, minHour - 1) && s.hour <= Math.min(23, maxHour + 1))
            .map(s => ({
              label: `${s.hour.toString().padStart(2, '0')}:00`,
              duration: s.duration,
              count: s.count
            }))
      }
      // 如果没有数据，显示6:00-22:00
      return hourlyStats
          .filter(s => s.hour >= 6 && s.hour <= 22)
          .map(s => ({
            label: `${s.hour.toString().padStart(2, '0')}:00`,
            duration: s.duration,
            count: s.count
          }))
    }
    case 'week': {
      const dailyStats = focusStore.getDailyStatsByRange(rangeStartDate.value, rangeEndDate.value)
      return dailyStats.map(s => ({
        label: dayjs(s.date).format('ddd'),
        duration: s.duration,
        count: s.count
      }))
    }
    case 'month': {
      const dailyStats = focusStore.getDailyStatsByRange(rangeStartDate.value, rangeEndDate.value)
      // 按周分组显示
      const weeks: TrendDataItem[] = []
      const start = dayjs(rangeStartDate.value)
      const end = dayjs(rangeEndDate.value)
      let current = start
      let weekIndex = 1
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const weekEnd = current.add(6, 'day').isAfter(end) ? end : current.add(6, 'day')
        const weekStats = dailyStats.filter(s => {
          const d = dayjs(s.date)
          return (d.isAfter(current) || d.isSame(current, 'day')) &&
              (d.isBefore(weekEnd) || d.isSame(weekEnd, 'day'))
        })
        weeks.push({
          label: `第${weekIndex}周`,
          duration: weekStats.reduce((sum, s) => sum + s.duration, 0),
          count: weekStats.reduce((sum, s) => sum + s.count, 0)
        })
        current = weekEnd.add(1, 'day')
        weekIndex++
      }
      return weeks
    }
    case 'year': {
      const year = dayjs(selectedDate.value).year()
      const monthlyStats = focusStore.getMonthlyStatsByYear(year)
      return monthlyStats.map(s => ({
        label: `${s.month + 1}月`,
        duration: s.duration,
        count: s.count
      }))
    }
    default:
      return []
  }
})

const rangeStatsByName = computed(() => {
  return focusStore.getStatsByNameByRange(rangeStartDate.value, rangeEndDate.value)
})

// 获取趋势标题
const getTrendTitle = () => {
  switch (statsRange.value) {
    case 'day':
      return '今日专注分布'
    case 'week':
      return '本周专注趋势'
    case 'month':
      return '本月专注趋势'
    case 'year':
      return '本年专注趋势'
    default:
      return '专注趋势'
  }
}

// 获取图表高度
const getChartHeight = () => {
  switch (statsRange.value) {
    case 'day':
      return '120px'
    case 'week':
      return '150px'
    case 'month':
      return '200px'
    case 'year':
      return '250px'
    default:
      return '150px'
  }
}

// 格式化柱状图值
const formatBarValue = (duration: number) => {
  if (statsRange.value === 'day') {
    return `${duration}m`
  }
  const hours = Math.round(duration / 60)
  return hours > 0 ? `${hours}h` : `${duration}m`
}

// 获取柱状图高度
const getBarHeight = (duration: number) => {
  const maxDuration = Math.max(...trendData.value.map(s => s.duration), 1)
  return (duration / maxDuration) * 100
}

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
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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

// 格式化时长
const formatDuration = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}分钟`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}

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
  ElMessage.success('已删除')
}

// 开始专注
const startFocus = async () => {
  if (!focusName.value.trim()) {
    ElMessage.warning('请输入专注事项')
    return
  }

  timerState.value = 'running'
  startTimestamp.value = Date.now() // 使用毫秒时间戳
  lastUpdateTime.value = Date.now()

  // 保存计时状态到 store
  const state: StoredTimerState = {
    name: focusName.value,
    notes: focusNotes.value,
    type: focusType.value,
    targetDuration: focusType.value === 'pomodoro' ? localPomodoroDuration.value : 0,
    startTimestamp: startTimestamp.value,
    elapsedSeconds: 0
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
      completeFocus()
    }
  }

  updateTimer() // 立即执行一次
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

  updateTimer() // 立即执行一次
  timerInterval = setInterval(updateTimer, 1000)
}

// 取消专注
const cancelFocus = async () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  timerState.value = 'idle'
  remainingSeconds.value = 0
  elapsedSeconds.value = 0
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
  const duration = Math.floor(elapsedSeconds.value / 60) // 分钟
  const startTime = dayjs(startTimestamp.value)
  const date = startTime.format('YYYY-MM-DD')
  const startTimeStr = startTime.format('HH:mm')
  const endTimeStr = dayjs(endTime).format('HH:mm')

  // 保存专注记录
  await focusStore.addRecord({
    name: focusName.value,
    notes: focusNotes.value,
    type: focusType.value,
    duration,
    targetDuration: focusType.value === 'pomodoro' ? localPomodoroDuration.value : 0,
    startTime: startTimeStr,
    endTime: endTimeStr,
    date,
    completed: focusType.value === 'pomodoro' ? remainingSeconds.value === 0 : true
  })

  // 调用记录足迹功能
  await taskStore.addCompletedTask({
    id: `focus-${Date.now()}`,
    name: focusName.value,
    startTime: startTimeStr,
    endTime: endTimeStr,
    date,
    completed: true,
    duration,
    notes: focusNotes.value || undefined
  })

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

  ElMessage.success('专注完成！')

  // 显示保存常用对话框
  showSaveFavorite.value = true
}

// 保存为常用
const saveAsFavorite = async () => {
  if (!lastCompletedFocus.value) return

  await focusStore.addFavorite({
    name: lastCompletedFocus.value.name,
    notes: lastCompletedFocus.value.notes,
    type: lastCompletedFocus.value.type,
    targetDuration: lastCompletedFocus.value.targetDuration
  })

  showSaveFavorite.value = false
  lastCompletedFocus.value = null
  ElMessage.success('已保存为常用专注')
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

    // 使用时间戳计算已经过去的时间
    const now = Date.now()
    const elapsedSinceStart = Math.floor((now - savedState.startTimestamp) / 1000)

    startTimestamp.value = savedState.startTimestamp
    lastUpdateTime.value = now
    timerState.value = 'running'

    if (savedState.type === 'pomodoro') {
      // 番茄钟模式：计算剩余时间
      const totalSeconds = savedState.targetDuration * 60
      const remaining = totalSeconds - elapsedSinceStart

      if (remaining > 0) {
        remainingSeconds.value = remaining
        elapsedSeconds.value = elapsedSinceStart
        startCountdown()
      } else {
        // 时间已经到了，自动完成
        elapsedSeconds.value = totalSeconds
        remainingSeconds.value = 0
        await completeFocus()
      }
    } else {
      // 正计时模式：继续计时
      elapsedSeconds.value = elapsedSinceStart
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
      elapsedSeconds: elapsedSeconds.value
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
  width: 240px;
  height: 240px;
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
  font-size: 42px;
  font-weight: 700;
  color: #fff;
  font-family: 'SF Mono', 'Monaco', monospace;
  display: block;
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

.mode-switch .stats-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.mode-switch .stats-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
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

/* 统计对话框样式 */
.stats-content {
  padding: 8px 0;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.1) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #667eea;
}

.stat-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8px;
}

/* 图表 */
.trend-chart {
  margin-bottom: 32px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.05) 100%);
  border: 1px solid rgba(102, 126, 234, 0.15);
  border-radius: 16px;
  padding: 24px;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-title::before {
  content: '';
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
}

.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 120px;
  padding: 0 8px 24px;
  position: relative;
}

.chart-bars::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
}

.chart-bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.bar-wrapper {
  width: 100%;
  max-width: 40px;
  height: 100px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 100%;
  max-width: 28px;
  min-height: 4px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px 6px 2px 2px;
  transition: all 0.3s ease;
  position: relative;
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
}

.bar:hover {
  box-shadow: 0 0 30px rgba(102, 126, 234, 0.5);
  filter: brightness(1.1);
}

.bar-value {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 600;
  color: #667eea;
  white-space: nowrap;
  background: rgba(15, 15, 30, 0.9);
  padding: 2px 6px;
  border-radius: 4px;
}

.bar-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 8px;
  white-space: nowrap;
}

/* 排行 */
.focus-ranking {
  margin-top: 24px;
}

.ranking-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 16px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.ranking-num {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 50%;
}

.ranking-name {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-count {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.ranking-duration {
  font-size: 13px;
  color: #667eea;
  font-weight: 500;
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

/* 统计全屏展示 */
.stats-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: linear-gradient(135deg, rgba(15, 15, 30, 0.98) 0%, rgba(25, 25, 50, 0.98) 100%);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.stats-header-left h2 {
  margin: 0;
  font-size: 22px;
  color: #fff;
  font-weight: 600;
}

.stats-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stats-header-right :deep(.el-radio-button__inner) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
}

.stats-header-right :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: #fff;
}

.stats-body {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;
  max-width: 800px;
}

.trend-chart {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.focus-ranking {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
}

.no-data {
  padding: 60px 0;
}
</style>
