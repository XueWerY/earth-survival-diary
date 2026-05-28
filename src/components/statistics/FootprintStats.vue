<template>
  <el-scrollbar>
    <div class="stats-content">
      <div class="stats-toolbar">
        <el-radio-group v-model="statsRange" size="default">
          <el-radio-button value="day">日</el-radio-button>
          <el-radio-button value="week">周</el-radio-button>
          <el-radio-button value="month">月</el-radio-button>
          <el-radio-button value="year">年</el-radio-button>
        </el-radio-group>
        <LunarDatePicker
            v-if="statsRange === 'day'"
            v-model="statsDayDate"
            placeholder="选择日期"
        />
        <el-date-picker
            v-else
            v-model="statsDate"
            :type="statsDatePickerType"
            :placeholder="statsDatePickerPlaceholder"
            :clearable="false"
            size="default"
            :format="statsDateFormat"
            :value-format="statsDateValueFormat"
        />
      </div>

      <div v-if="statsTaskCount === 0" class="empty-state">
        <el-empty description="该时间段暂无足迹记录" :image-size="120" />
      </div>

      <template v-else>
        <div class="trend-chart overview-section">
          <div class="chart-title">足迹概览</div>
          <div class="overview-stats">
            <div class="overview-item">
              <span class="overview-label">足迹数量：</span>
              <span class="overview-value">{{ statsTaskCount }}</span>
            </div>
            <div class="overview-item">
              <span class="overview-label">总时长：</span>
              <span class="overview-value">{{ formatDuration(statsTotalDuration) }}</span>
            </div>
          </div>
        </div>

        <div class="trend-chart">
          <div class="chart-title">{{ statsTrendTitle }}</div>
          <div class="chart-bars">
            <div v-for="(stat, index) in statsTrendData" :key="index" class="chart-bar-item">
              <div class="bar-label" :title="stat.timeRange">{{ stat.label }}</div>
              <div class="bar-wrapper">
                <div class="bar" :style="{ width: getStatsBarWidth(stat.duration) + '%' }">
                  <span class="bar-value" v-if="stat.duration > 0">{{ formatStatsBarValue(stat.duration) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="trend-chart pie-section">
          <div class="chart-title">事项分布</div>
          <div class="pie-chart-container">
            <svg viewBox="0 0 100 100" class="pie-chart">
              <circle cx="50" cy="50" r="40" fill="rgba(255,255,255,0.05)" />
              <template v-for="(segment, index) in statsPieSegments" :key="index">
                <path :d="segment.path" :fill="segment.color" class="pie-segment" />
              </template>
            </svg>
            <div class="chart-legend">
              <div class="legend-item" v-for="item in statsTaskRanking" :key="item.name">
                <span class="legend-color" :style="{ background: getStatsTaskColor(statsTaskRanking.indexOf(item)) }"></span>
                <span class="legend-text">{{ item.name }} {{ formatDuration(item.duration) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="focus-ranking">
          <div class="ranking-title">事项排行</div>
          <div class="ranking-list">
            <div v-for="(item, index) in statsTaskRanking.slice(0, 10)" :key="item.name" class="ranking-item">
              <span class="ranking-num">{{ index + 1 }}</span>
              <span class="ranking-name">{{ item.name }}</span>
              <span class="ranking-count">{{ item.count }}次</span>
              <span class="ranking-duration">{{ formatDuration(item.duration) }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </el-scrollbar>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import 'dayjs/locale/zh-cn'
import { useTaskStore, type Task } from '../../stores/taskStore'
import LunarDatePicker from '../common/picker/LunarDatePicker.vue'
import { logger } from '../../lib/logger'

dayjs.extend(isoWeek)
dayjs.locale('zh-cn')

const taskStore = useTaskStore()

const statsRange = ref<'day' | 'week' | 'month' | 'year'>('day')
const statsDate = ref<Date>(new Date())
const statsDayDate = ref<string>(dayjs().format('YYYY-MM-DD'))

watch(statsRange, (newVal) => {
  logger.info('[统计] 切换统计范围', { range: newVal })
})

watch(statsDayDate, (newVal) => {
  if (newVal) {
    statsDate.value = dayjs(newVal).toDate()
    logger.info('[统计] 选择日期', { date: newVal, range: statsRange.value })
  }
})

watch(statsDate, (newVal) => {
  statsDayDate.value = dayjs(newVal).format('YYYY-MM-DD')
  const range = statsRange.value
  if (range !== 'day') {
    const formatted = range === 'week' ? dayjs(newVal).format('YYYY-第w周') : range === 'month' ? dayjs(newVal).format('YYYY-MM') : dayjs(newVal).format('YYYY')
    logger.info('[统计] 选择日期', { date: formatted, range })
  }
})

const statsDatePickerType = computed(() => {
  switch (statsRange.value) {
    case 'day': return 'date'
    case 'week': return 'week'
    case 'month': return 'month'
    case 'year': return 'year'
    default: return 'date'
  }
})

const statsDatePickerPlaceholder = computed(() => {
  switch (statsRange.value) {
    case 'day': return '选择日期'
    case 'week': return '选择周'
    case 'month': return '选择月份'
    case 'year': return '选择年份'
    default: return '选择日期'
  }
})

const statsDateFormat = computed(() => {
  switch (statsRange.value) {
    case 'day': return 'YYYY-MM-DD'
    case 'week': return 'YYYY [第] ww [周]'
    case 'month': return 'YYYY-MM'
    case 'year': return 'YYYY'
    default: return 'YYYY-MM-DD'
  }
})

const statsDateValueFormat = computed(() => {
  switch (statsRange.value) {
    case 'day': return 'YYYY-MM-DD'
    case 'week': return 'YYYY-MM-DD'
    case 'month': return 'YYYY-MM'
    case 'year': return 'YYYY'
    default: return 'YYYY-MM-DD'
  }
})

const statsDateRange = computed(() => {
  const date = dayjs(statsDate.value)
  switch (statsRange.value) {
    case 'day':
      return { start: date.format('YYYY-MM-DD'), end: date.format('YYYY-MM-DD') }
    case 'week':
      return {
        start: date.startOf('isoWeek').format('YYYY-MM-DD'),
        end: date.endOf('isoWeek').format('YYYY-MM-DD')
      }
    case 'month':
      return {
        start: date.startOf('month').format('YYYY-MM-DD'),
        end: date.endOf('month').format('YYYY-MM-DD')
      }
    case 'year':
      return {
        start: date.startOf('year').format('YYYY-MM-DD'),
        end: date.endOf('year').format('YYYY-MM-DD')
      }
    default:
      return { start: date.format('YYYY-MM-DD'), end: date.format('YYYY-MM-DD') }
  }
})

const statsTasks = computed(() => {
  const { start, end } = statsDateRange.value
  return taskStore.tasks.filter(t => t.date >= start && t.date <= end)
})

const getTaskDuration = (task: Task): number => {
  if (task.startTime && task.endTime) {
    const start = task.startTime.split(':').map(Number)
    const end = task.endTime.split(':').map(Number)
    return (end[0] * 60 + end[1]) - (start[0] * 60 + start[1])
  }
  return task.duration || 0
}

const statsTaskCount = computed(() => statsTasks.value.length)

const statsTotalDuration = computed(() => {
  return statsTasks.value.reduce((sum, task) => sum + getTaskDuration(task), 0)
})

const statsTrendTitle = computed(() => {
  switch (statsRange.value) {
    case 'day': return '时间分布'
    case 'week': return '本周每日趋势'
    case 'month': return '本月每周趋势'
    case 'year': return '本年每月趋势'
    default: return '时间趋势'
  }
})

const statsTrendData = computed(() => {
  const { start, end } = statsDateRange.value
  const startDate = dayjs(start)
  const endDate = dayjs(end)
  const data: { label: string; duration: number; count: number }[] = []

  if (statsRange.value === 'day') {
    const periods = [
      { label: '凌晨', startHour: 0, endHour: 6 },
      { label: '上午', startHour: 6, endHour: 12 },
      { label: '中午', startHour: 12, endHour: 14 },
      { label: '下午', startHour: 14, endHour: 18 },
      { label: '晚上', startHour: 18, endHour: 24 }
    ]

    periods.forEach(period => {
      const periodTasks = statsTasks.value.filter(t => {
        const taskHour = parseInt((t.startTime || '00:00').split(':')[0])
        return taskHour >= period.startHour && taskHour < period.endHour
      })
      const duration = periodTasks.reduce((sum, t) => sum + getTaskDuration(t), 0)
      data.push({ label: period.label, timeRange: `${period.startHour}:00-${period.endHour}:00`, duration, count: periodTasks.length })
    })
  } else if (statsRange.value === 'week') {
    for (let d = 0; d < 7; d++) {
      const date = startDate.add(d, 'day')
      const dateStr = date.format('YYYY-MM-DD')
      const dayTasks = statsTasks.value.filter(t => t.date === dateStr)
      const duration = dayTasks.reduce((sum, t) => sum + getTaskDuration(t), 0)
      data.push({ label: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][d], duration, count: dayTasks.length })
    }
  } else if (statsRange.value === 'month') {
    const weeksInMonth = Math.ceil(endDate.date() / 7)
    for (let w = 1; w <= weeksInMonth && w <= 5; w++) {
      const weekStart = startDate.add((w - 1) * 7, 'day')
      const weekEnd = w === weeksInMonth ? endDate : startDate.add(w * 7 - 1, 'day')
      const weekTasks = statsTasks.value.filter(t =>
        t.date >= weekStart.format('YYYY-MM-DD') && t.date <= weekEnd.format('YYYY-MM-DD')
      )
      const duration = weekTasks.reduce((sum, t) => sum + getTaskDuration(t), 0)
      data.push({ label: `第${w}周`, duration, count: weekTasks.length })
    }
  } else if (statsRange.value === 'year') {
    for (let m = 0; m < 12; m++) {
      const monthStart = startDate.month(m).startOf('month')
      const monthEnd = startDate.month(m).endOf('month')
      const monthTasks = statsTasks.value.filter(t =>
        t.date >= monthStart.format('YYYY-MM-DD') && t.date <= monthEnd.format('YYYY-MM-DD')
      )
      const duration = monthTasks.reduce((sum, t) => sum + getTaskDuration(t), 0)
      data.push({ label: `${m + 1}月`, duration, count: monthTasks.length })
    }
  }

  return data
})

const statsTaskRanking = computed(() => {
  const taskStats: Record<string, { count: number; duration: number }> = {}
  statsTasks.value.forEach(task => {
    if (!taskStats[task.name]) {
      taskStats[task.name] = { count: 0, duration: 0 }
    }
    taskStats[task.name].count++
    taskStats[task.name].duration += getTaskDuration(task)
  })

  return Object.entries(taskStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.duration - a.duration)
})

const generatePiePath = (startAngle: number, endAngle: number): string => {
  const cx = 50, cy = 50, r = 40
  if (endAngle - startAngle >= 360) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`
  }
  const startRad = (startAngle - 90) * Math.PI / 180
  const endRad = (endAngle - 90) * Math.PI / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

const getStatsTaskColor = (index: number): string => {
  const colors = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
    '#fee140', '#a8edea', '#d299c2', '#fbbf24', '#f472b6',
    '#67e8f9', '#a78bfa', '#34d399', '#fb7185', '#38bdf8'
  ]
  return colors[index % colors.length]
}

const statsPieSegments = computed((): { path: string; color: string }[] => {
  const segments: { path: string; color: string }[] = []
  const total = statsTotalDuration.value
  if (total === 0) return segments

  let currentAngle = 0
  statsTaskRanking.value.forEach((item, index) => {
    if (item.duration > 0) {
      const angle = (item.duration / total) * 360
      segments.push({
        path: generatePiePath(currentAngle, currentAngle + angle),
        color: getStatsTaskColor(index)
      })
      currentAngle += angle
    }
  })

  return segments
})

const getStatsBarWidth = (duration: number): number => {
  const maxDuration = Math.max(...statsTrendData.value.map(d => d.duration), 1)
  return (duration / maxDuration) * 100
}

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟`
  if (hours > 0) return `${hours}小时`
  return `${mins}分钟`
}

const formatStatsBarValue = (duration: number): string => {
  if (duration <= 0) return ''
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟`
  if (hours > 0) return `${hours}小时`
  return `${mins}分钟`
}

onMounted(async () => {
  await taskStore.loadTasks()
})
</script>

<style scoped>
.stats-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.stats-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  justify-content: center;
}

.overview-section {
  text-align: center;
}

.overview-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-left: 0;
  align-items: flex-start;
}

.overview-item {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
}

.overview-label {
  color: rgba(255, 255, 255, 0.5);
}

.overview-value {
  font-weight: 600;
  color: #a78bfa;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.stat-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.trend-chart {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 20px;
  text-align: center;
}

.chart-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-bar-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  text-align: left;
  flex-shrink: 0;
}

.bar-wrapper {
  flex: 1;
  height: 24px;
  position: relative;
}

.bar {
  height: 100%;
  min-width: 4px;
  max-width: calc(100% - 60px);
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 4px 4px 0;
  position: relative;
  transition: width 0.3s ease;
}

.bar-value {
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.pie-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pie-chart-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
}

.pie-chart {
  width: 160px;
  height: 160px;
  flex-shrink: 0;
}

.pie-segment {
  transition: opacity 0.2s ease;
}

.pie-segment:hover {
  opacity: 0.8;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.focus-ranking {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ranking-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 16px;
  text-align: center;
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
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
}

.ranking-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
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
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}

.ranking-duration {
  font-size: 13px;
  color: #67e8f9;
  font-weight: 500;
  flex-shrink: 0;
}
</style>
