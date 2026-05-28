<template>
  <el-scrollbar>
    <div class="stats-content">
      <div class="stats-toolbar">
        <el-radio-group v-model="statsRange" size="default" @change="handleRangeChange">
          <el-radio-button value="day">日</el-radio-button>
          <el-radio-button value="week">周</el-radio-button>
          <el-radio-button value="month">月</el-radio-button>
          <el-radio-button value="year">年</el-radio-button>
        </el-radio-group>
        <LunarDatePicker
            v-if="statsRange === 'day'"
            v-model="selectedDayDate"
            placeholder="选择日期"
        />
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
      </div>

      <div v-if="rangeFocusCount === 0" class="empty-state">
        <el-empty description="该时间段暂无专注记录" :image-size="120" />
      </div>

      <template v-else>
        <div class="trend-chart overview-section">
          <div class="chart-title">专注概览</div>
          <div class="overview-stats">
            <div class="overview-item">
              <span class="overview-label">专注次数：</span>
              <span class="overview-value">{{ rangeFocusCount }}</span>
            </div>
            <div class="overview-item">
              <span class="overview-label">总时长：</span>
              <span class="overview-value">{{ formatDuration(rangeFocusDuration) }}</span>
            </div>
          </div>
        </div>

        <div class="trend-chart">
          <div class="chart-title">{{ trendTitle }}</div>
          <div class="chart-bars">
            <div v-for="(stat, index) in trendData" :key="index" class="chart-bar-item">
              <div class="bar-label" :title="stat.timeRange">{{ stat.label }}</div>
              <div class="bar-wrapper">
                <div class="bar" :style="{ width: getBarWidth(stat.duration) + '%' }">
                  <span class="bar-value" v-if="stat.duration > 0">{{ formatBarValue(stat.duration) }}</span>
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
              <template v-for="(segment, index) in pieSegments" :key="index">
                <path :d="segment.path" :fill="segment.color" class="pie-segment" />
              </template>
            </svg>
            <div class="chart-legend">
              <div class="legend-item" v-for="item in rangeStatsByName" :key="item.name">
                <span class="legend-color" :style="{ background: getTaskColor(rangeStatsByName.indexOf(item)) }"></span>
                <span class="legend-text">{{ item.name }} {{ formatDuration(item.duration) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="focus-ranking">
          <div class="ranking-title">事项排行</div>
          <div class="ranking-list">
            <div v-for="(item, index) in rangeStatsByName.slice(0, 10)" :key="item.name" class="ranking-item">
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
import 'dayjs/locale/zh-cn'
import { useFocusStore } from '../../stores/focusStore'
import LunarDatePicker from '../common/picker/LunarDatePicker.vue'
import { logger } from '../../lib/logger'

dayjs.locale('zh-cn')

const focusStore = useFocusStore()

const statsRange = ref<'day' | 'week' | 'month' | 'year'>('day')
const selectedDate = ref<Date>(new Date())
const selectedDayDate = ref<string>(dayjs().format('YYYY-MM-DD'))

watch(statsRange, (newVal) => {
  logger.info('[统计] 切换统计范围', { range: newVal })
  selectedDate.value = new Date()
})

watch(selectedDayDate, (newVal) => {
  if (newVal) {
    selectedDate.value = dayjs(newVal).toDate()
    logger.info('[统计] 选择日期', { date: newVal, range: statsRange.value })
  }
})

watch(selectedDate, (newVal) => {
  selectedDayDate.value = dayjs(newVal).format('YYYY-MM-DD')
  const range = statsRange.value
  if (range !== 'day') {
    const formatted = range === 'week' ? dayjs(newVal).format('YYYY-第w周') : range === 'month' ? dayjs(newVal).format('YYYY-MM') : dayjs(newVal).format('YYYY')
    logger.info('[统计] 选择日期', { date: formatted, range })
  }
})

const handleRangeChange = () => {
  selectedDate.value = new Date()
}

const datePickerType = computed(() => {
  switch (statsRange.value) {
    case 'day': return 'date'
    case 'week': return 'week'
    case 'month': return 'month'
    case 'year': return 'year'
    default: return 'date'
  }
})

const datePickerPlaceholder = computed(() => {
  switch (statsRange.value) {
    case 'day': return '选择日期'
    case 'week': return '选择周'
    case 'month': return '选择月份'
    case 'year': return '选择年份'
    default: return '选择日期'
  }
})

const datePickerFormat = computed(() => {
  switch (statsRange.value) {
    case 'day': return 'YYYY-MM-DD'
    case 'week': return 'YYYY [第] ww [周]'
    case 'month': return 'YYYY-MM'
    case 'year': return 'YYYY'
    default: return 'YYYY-MM-DD'
  }
})

const datePickerValueFormat = computed(() => {
  switch (statsRange.value) {
    case 'day': return 'YYYY-MM-DD'
    case 'week': return 'YYYY-MM-DD'
    case 'month': return 'YYYY-MM'
    case 'year': return 'YYYY'
    default: return 'YYYY-MM-DD'
  }
})

const rangeStartDate = computed(() => {
  const dateValue = selectedDate.value
  switch (statsRange.value) {
    case 'day': return dayjs(dateValue).format('YYYY-MM-DD')
    case 'week': return dayjs(dateValue).startOf('week').format('YYYY-MM-DD')
    case 'month': return dayjs(dateValue).startOf('month').format('YYYY-MM-DD')
    case 'year': return dayjs(dateValue).startOf('year').format('YYYY-MM-DD')
    default: return dayjs(dateValue).format('YYYY-MM-DD')
  }
})

const rangeEndDate = computed(() => {
  const dateValue = selectedDate.value
  switch (statsRange.value) {
    case 'day': return dayjs(dateValue).format('YYYY-MM-DD')
    case 'week': return dayjs(dateValue).endOf('week').format('YYYY-MM-DD')
    case 'month': return dayjs(dateValue).endOf('month').format('YYYY-MM-DD')
    case 'year': return dayjs(dateValue).endOf('year').format('YYYY-MM-DD')
    default: return dayjs(dateValue).format('YYYY-MM-DD')
  }
})

const rangeFocusCount = computed(() => focusStore.getCountByRange(rangeStartDate.value, rangeEndDate.value))
const rangeFocusDuration = computed(() => focusStore.getDurationByRange(rangeStartDate.value, rangeEndDate.value))

const rangeRecords = computed(() => {
  const start = dayjs(rangeStartDate.value)
  const end = dayjs(rangeEndDate.value)
  return focusStore.records.filter(r => {
    const d = dayjs(r.date)
    return (d.isAfter(start) || d.isSame(start, 'day')) && (d.isBefore(end) || d.isSame(end, 'day'))
  })
})

const trendTitle = computed(() => {
  switch (statsRange.value) {
    case 'day': return '时间分布'
    case 'week': return '本周每日趋势'
    case 'month': return '本月每周趋势'
    case 'year': return '本年每月趋势'
    default: return '时间趋势'
  }
})

const trendData = computed(() => {
  const start = dayjs(rangeStartDate.value)
  const end = dayjs(rangeEndDate.value)
  const data: { label: string; timeRange?: string; duration: number; count: number }[] = []

  if (statsRange.value === 'day') {
    const periods = [
      { label: '凌晨', startHour: 0, endHour: 6 },
      { label: '上午', startHour: 6, endHour: 12 },
      { label: '中午', startHour: 12, endHour: 14 },
      { label: '下午', startHour: 14, endHour: 18 },
      { label: '晚上', startHour: 18, endHour: 24 }
    ]

    periods.forEach(p => {
      const dur = focusStore.records.filter(r => {
        if (!rangeRecords.value.includes(r)) return false
        const h = parseInt(r.startTime.split(':')[0])
        return h >= p.startHour && h < p.endHour
      }).reduce((s, r) => s + r.duration, 0)
      data.push({ label: p.label, timeRange: `${p.startHour}:00-${p.endHour}:00`, duration: dur, count: 0 })
    })
  } else if (statsRange.value === 'week') {
    const dailyStats = focusStore.getDailyStatsByRange(rangeStartDate.value, rangeEndDate.value)
    return dailyStats.map(s => ({ label: dayjs(s.date).format('ddd'), duration: s.duration, count: s.count }))
  } else if (statsRange.value === 'month') {
    const dailyStats = focusStore.getDailyStatsByRange(rangeStartDate.value, rangeEndDate.value)
    const weeks: { label: string; duration: number; count: number }[] = []
    let current = start
    let weekIndex = 1
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const weekEnd = current.add(6, 'day').isAfter(end) ? end : current.add(6, 'day')
      const weekStats = dailyStats.filter(s => {
        const d = dayjs(s.date)
        return (d.isAfter(current) || d.isSame(current, 'day')) && (d.isBefore(weekEnd) || d.isSame(weekEnd, 'day'))
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
  } else if (statsRange.value === 'year') {
    const year = dayjs(selectedDate.value).year()
    const monthlyStats = focusStore.getMonthlyStatsByYear(year)
    return monthlyStats.map(s => ({ label: `${s.month + 1}月`, duration: s.duration, count: s.count }))
  }

  return data
})

const rangeStatsByName = computed(() => focusStore.getStatsByNameByRange(rangeStartDate.value, rangeEndDate.value))

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟`
  if (hours > 0) return `${hours}小时`
  return `${mins}分钟`
}

const formatBarValue = (duration: number) => {
  if (duration <= 0) return ''
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟`
  if (hours > 0) return `${hours}小时`
  return `${mins}分钟`
}

const getBarWidth = (duration: number) => {
  const maxDuration = Math.max(...trendData.value.map(s => s.duration), 1)
  return (duration / maxDuration) * 100
}

const getTaskColor = (index: number): string => {
  const colors = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
    '#fee140', '#a8edea', '#d299c2', '#fbbf24', '#f472b6',
    '#67e8f9', '#a78bfa', '#34d399', '#fb7185', '#38bdf8'
  ]
  return colors[index % colors.length]
}

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

const pieSegments = computed((): { path: string; color: string }[] => {
  const segments: { path: string; color: string }[] = []
  const total = rangeFocusDuration.value
  if (total === 0) return segments

  let currentAngle = 0
  rangeStatsByName.value.forEach((item, index) => {
    if (item.duration > 0) {
      const angle = (item.duration / total) * 360
      segments.push({
        path: generatePiePath(currentAngle, currentAngle + angle),
        color: getTaskColor(index)
      })
      currentAngle += angle
    }
  })

  return segments
})

onMounted(async () => {
  await focusStore.loadData()
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

.empty-state {
  padding: 60px 0;
  text-align: center;
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
