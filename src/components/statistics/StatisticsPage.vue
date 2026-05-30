<template>
  <div class="statistics-container">
    <div class="stats-scroll-wrapper">
      <div class="stats-content">
        <div class="date-range-bar">
          <div class="date-range-label">统计范围</div>
          <DateScrollPicker v-model="startDate" class="date-picker-inline" />
          <span class="date-separator">至</span>
          <DateScrollPicker v-model="endDate" class="date-picker-inline" />
          <button class="capsule-btn reset-capsule" @click="resetDateRange">
            <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            <span>重置</span>
          </button>
        </div>

        <div class="module-sections">
          <div class="module-section">
            <div class="section-header">
              <span class="section-icon">👣</span>
              <span class="section-title">足迹</span>
            </div>
            <div class="section-stats">
              <div class="stat-item">
                <span class="stat-label">日记数</span>
                <span class="stat-value">{{ footprintStats.diaryCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">记录数</span>
                <span class="stat-value">{{ footprintStats.recordCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总时长</span>
                <span class="stat-value">{{ footprintStats.totalDuration }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">日均日记</span>
                <span class="stat-value">{{ footprintStats.avgDailyDiary }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">日均记录</span>
                <span class="stat-value">{{ footprintStats.avgDailyRecord }}</span>
              </div>
            </div>
            <div class="section-trend" v-if="footprintStats.diaryTrend.length > 0">
              <div class="trend-title">每日日记数</div>
              <div class="trend-bars">
                <div
                  v-for="(item, idx) in footprintStats.diaryTrend"
                  :key="'dd'+idx"
                  class="trend-bar-item"
                >
                  <div
                    class="trend-bar-label clickable"
                    :style="{ width: footprintStats.diaryLabelMaxLen + 'ch' }"
                    @click="setRangeFromTrend(item.rangeStart, item.rangeEnd)"
                  >{{ item.label }}</div>
                  <div class="trend-bar-track">
                    <div
                      class="trend-bar-fill"
                      :style="{ width: getBarPercent(item.value, footprintStats.diaryMax) + '%' }"
                    ></div>
                  </div>
                  <div class="trend-bar-val">{{ item.value }}篇</div>
                </div>
              </div>
            </div>
            <div class="section-trend" v-if="footprintStats.recordTrend.length > 0">
              <div class="trend-title">每日记录数</div>
              <div class="trend-bars">
                <div
                  v-for="(item, idx) in footprintStats.recordTrend"
                  :key="'dr'+idx"
                  class="trend-bar-item"
                >
                  <div
                    class="trend-bar-label clickable"
                    :style="{ width: footprintStats.recordLabelMaxLen + 'ch' }"
                    @click="setRangeFromTrend(item.rangeStart, item.rangeEnd)"
                  >{{ item.label }}</div>
                  <div class="trend-bar-track">
                    <div
                      class="trend-bar-fill"
                      :style="{ width: getBarPercent(item.value, footprintStats.recordMax) + '%' }"
                    ></div>
                  </div>
                  <div class="trend-bar-val">{{ item.value }}条</div>
                </div>
              </div>
            </div>
            <div class="section-empty" v-if="footprintStats.diaryCount === 0 && footprintStats.recordCount === 0">暂无数据</div>
          </div>

          <div class="module-section">
            <div class="section-header">
              <span class="section-icon">🧘</span>
              <span class="section-title">专注</span>
            </div>
            <div class="section-stats">
              <div class="stat-item">
                <span class="stat-label">常用专注</span>
                <span class="stat-value">{{ focusStats.favoriteCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">专注次数</span>
                <span class="stat-value">{{ focusStats.sessionCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总时长</span>
                <span class="stat-value">{{ focusStats.totalDuration }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">番茄/正计时</span>
                <span class="stat-value">{{ focusStats.pomodoroCount }} / {{ focusStats.stopwatchCount }}</span>
              </div>
            </div>
            <div class="section-trend" v-if="focusStats.trendData.length > 0">
              <div class="trend-title">每日专注时长</div>
              <div class="trend-bars">
                <div
                  v-for="(item, idx) in focusStats.trendData"
                  :key="idx"
                  class="trend-bar-item"
                >
                  <div
                    class="trend-bar-label clickable"
                    :style="{ width: focusStats.trendLabelMaxLen + 'ch' }"
                    @click="setRangeFromTrend(item.rangeStart, item.rangeEnd)"
                  >{{ item.label }}</div>
                  <div class="trend-bar-track">
                    <div
                      class="trend-bar-fill focus-bar-fill"
                      :style="{ width: getBarPercent(item.value, focusStats.trendMax) + '%' }"
                    ></div>
                  </div>
                  <div class="trend-bar-val">{{ formatDurationLabel(item.value) }}</div>
                </div>
              </div>
            </div>
            <div class="section-empty" v-else>暂无数据</div>
          </div>

          <div class="module-section">
            <div class="section-header">
              <span class="section-icon">📋</span>
              <span class="section-title">清单</span>
            </div>
            <div class="section-stats">
              <div class="stat-item">
                <span class="stat-label">清单数量</span>
                <span class="stat-value">{{ missionStats.listCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">任务数</span>
                <span class="stat-value">{{ missionStats.totalCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">已完成</span>
                <span class="stat-value">{{ missionStats.completedCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">完成率</span>
                <span class="stat-value">{{ missionStats.completionRate }}</span>
              </div>
            </div>
            <div class="section-trend" v-if="missionStats.priorityData.length > 0">
              <div class="priority-row">
                <div
                  v-for="p in missionStats.priorityData"
                  :key="p.label"
                  class="priority-tag"
                  :style="{ borderColor: p.color }"
                >
                  {{ p.label }} {{ p.count }}
                </div>
              </div>
            </div>
            <div class="section-trend" v-if="missionStats.dailyCompletedTrend.length > 0">
              <div class="trend-title">每日完成任务数</div>
              <div class="trend-bars">
                <div
                  v-for="(item, idx) in missionStats.dailyCompletedTrend"
                  :key="'mc'+idx"
                  class="trend-bar-item"
                >
                  <div
                    class="trend-bar-label clickable"
                    :style="{ width: missionStats.completedLabelMaxLen + 'ch' }"
                    @click="setRangeFromTrend(item.rangeStart, item.rangeEnd)"
                  >{{ item.label }}</div>
                  <div class="trend-bar-track">
                    <div
                      class="trend-bar-fill mission-bar-fill"
                      :style="{ width: getBarPercent(item.value, missionStats.completedMax) + '%' }"
                    ></div>
                  </div>
                  <div class="trend-bar-val">{{ item.value }}个</div>
                </div>
              </div>
            </div>
            <div class="section-empty" v-if="missionStats.totalCount === 0 && missionStats.completedCount === 0">暂无数据</div>
          </div>

          <div class="module-section">
            <div class="section-header">
              <span class="section-icon">⏳</span>
              <span class="section-title">倒数日</span>
            </div>
            <div class="section-stats">
              <div class="stat-item">
                <span class="stat-label">创建的倒数日</span>
                <span class="stat-value">{{ countdownStats.totalCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">倒数/正数</span>
                <span class="stat-value">{{ countdownStats.countdownCount }} / {{ countdownStats.countupCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">分类数</span>
                <span class="stat-value">{{ countdownStats.activeCategoryCount }}</span>
              </div>
            </div>
            <div class="section-trend" v-if="countdownStats.categoryData.length > 0">
              <div class="trend-title">按分类分布</div>
              <div class="trend-bars">
                <div
                  v-for="(item, idx) in countdownStats.categoryData"
                  :key="idx"
                  class="trend-bar-item"
                >
                  <div class="trend-bar-label" :style="{ color: item.color, width: countdownStats.categoryLabelMaxLen + 'em' }">{{ item.label }}</div>
                  <div class="trend-bar-track">
                    <div class="trend-bar-fill-group">
                      <div
                        class="trend-bar-fill countdown-seg-dn"
                        :style="{ width: getBarPercent(item.countdownCount, countdownStats.categoryMax) + '%' }"
                      ></div>
                      <div
                        class="trend-bar-fill countdown-seg-up"
                        :style="{ width: getBarPercent(item.countupCount, countdownStats.categoryMax) + '%' }"
                      ></div>
                    </div>
                  </div>
                  <div class="trend-bar-val">{{ item.countdownCount }}/{{ item.countupCount }}</div>
                </div>
              </div>
              <div class="trend-legend">
                <span class="legend-item"><span class="legend-dot legend-dn"></span>倒数</span>
                <span class="legend-item"><span class="legend-dot legend-up"></span>正数</span>
              </div>
            </div>
            <div class="section-empty" v-else>暂无数据</div>
          </div>

          <div class="module-section">
            <div class="section-header">
              <span class="section-icon">📖</span>
              <span class="section-title">课程表</span>
            </div>
            <div class="section-stats">
              <div class="stat-item">
                <span class="stat-label">课程总数</span>
                <span class="stat-value">{{ courseStats.totalCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">授课日</span>
                <span class="stat-value">{{ courseStats.activeDays }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">节次数</span>
                <span class="stat-value">{{ courseStats.totalPeriods }}</span>
              </div>
            </div>
            <div class="section-trend" v-if="courseStats.dayData.length > 0">
              <div class="trend-title">每周课程分布</div>
              <div class="trend-bars">
                <div
                  v-for="(item, idx) in courseStats.dayData"
                  :key="idx"
                  class="trend-bar-item"
                >
                  <div class="trend-bar-label" :style="{ width: courseStats.dayLabelMaxLen + 'em' }">{{ item.label }}</div>
                  <div class="trend-bar-track">
                    <div
                      class="trend-bar-fill course-bar-fill"
                      :style="{ width: getBarPercent(item.value, courseStats.dayMax) + '%' }"
                    ></div>
                  </div>
                  <div class="trend-bar-val">{{ item.value }}门</div>
                </div>
              </div>
            </div>
            <div class="section-empty" v-else>暂无数据</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue'
import type { Ref } from 'vue'
import dayjs from 'dayjs'
import { useAuthStore } from '../../stores/authStore'
import { useTaskStore } from '../../stores/taskStore'
import { useFocusStore } from '../../stores/focusStore'
import { useMissionStore } from '../../stores/missionStore'
import { getData } from '../../services/storageService'
import { usePageNav } from '../../composables/usePageNav'
import { logger } from '../../lib/logger'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'

const pageNav = usePageNav()
const authStore = useAuthStore()
const taskStore = useTaskStore()
const focusStore = useFocusStore()
const missionStore = useMissionStore()

const countdownMilestones = inject<Ref<any[]>>('countdownMilestones', ref([]))
const countdownCategories = inject<Ref<any[]>>('countdownCategories', ref([]))

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const startDate = ref(dayjs().format('YYYY-MM-DD'))
const endDate = ref(dayjs().format('YYYY-MM-DD'))

const courseList = ref<any[]>([])
const completedMissionRecords = ref<any[]>([])

const initDateRange = () => {
  const profileCreatedAt = authStore.profile?.created_at
  const userAny = authStore.user as { createdAt?: string; created_at?: string } | null | undefined
  const createdAt = profileCreatedAt || userAny?.createdAt || userAny?.created_at
  if (createdAt) {
    startDate.value = dayjs(createdAt).format('YYYY-MM-DD')
  } else {
    startDate.value = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
  }
  endDate.value = dayjs().format('YYYY-MM-DD')
}

const resetDateRange = () => {
  initDateRange()
}

const daysInRange = computed(() => {
  const start = dayjs(startDate.value)
  const end = dayjs(endDate.value)
  return Math.max(1, end.diff(start, 'day') + 1)
})

const buildTrend = (
  data: { date: string; value: number }[],
  valueUnit: string,
  isDuration: boolean
): { items: { label: string; value: number; rangeStart: string; rangeEnd: string }[]; maxLabelLen: number } => {
  const days = daysInRange.value
  const result: { label: string; value: number; rangeStart: string; rangeEnd: string }[] = []

  if (days <= 7) {
    const start = dayjs(startDate.value)
    for (let i = 0; i < days; i++) {
      const d = start.add(i, 'day')
      const ds = d.format('YYYY-MM-DD')
      result.push({
        label: ds,
        value: data.filter(r => r.date === ds).reduce((s, r) => s + r.value, 0),
        rangeStart: ds,
        rangeEnd: ds
      })
    }
  } else {
    const start = dayjs(startDate.value)
    const end = dayjs(endDate.value)
    let current = start
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const weekEnd = current.add(6, 'day')
      const actualEnd = weekEnd.isAfter(end) ? end : weekEnd
      let weekValue = 0
      for (let d = dayjs(current); (d.isBefore(actualEnd) || d.isSame(actualEnd, 'day')); d = d.add(1, 'day')) {
        const ds = d.format('YYYY-MM-DD')
        weekValue += data.filter(r => r.date === ds).reduce((s, r) => s + r.value, 0)
      }
      result.push({
        label: `${current.format('YYYY-MM-DD')}~${actualEnd.format('YYYY-MM-DD')}`,
        value: weekValue,
        rangeStart: current.format('YYYY-MM-DD'),
        rangeEnd: actualEnd.format('YYYY-MM-DD')
      })
      current = actualEnd.add(1, 'day')
    }
  }
  const maxLabelLen = Math.max(...result.map(r => r.label.length), 1)
  return { items: result, maxLabelLen }
}

const getTrendMax = (trend: { value: number }[]) => Math.max(...trend.map(d => d.value), 1)

const footprintStats = computed(() => {
  const rangeTasks = taskStore.tasks.filter(t => t.date >= startDate.value && t.date <= endDate.value)
  const diaries = rangeTasks.filter(t => t.isDiary)
  const records = rangeTasks.filter(t => !t.isDiary)

  const diaryCount = diaries.length
  const recordCount = records.length
  const days = daysInRange.value

  const totalDuration = rangeTasks.reduce((sum, t) => {
    if (t.startTime && t.endTime) {
      const s = t.startTime.split(':').map(Number)
      const e = t.endTime.split(':').map(Number)
      return sum + (e[0] * 60 + e[1]) - (s[0] * 60 + s[1])
    }
    return sum + (t.duration || 0)
  }, 0)

  const diaryDateData = diaries.map(d => ({ date: d.date, value: 1 }))
  const recordDateData = records.map(r => ({ date: r.date, value: 1 }))

  const { items: diaryTrend, maxLabelLen: diaryLabelMaxLen } = buildTrend(diaryDateData, '篇', false)
  const { items: recordTrend, maxLabelLen: recordLabelMaxLen } = buildTrend(recordDateData, '条', false)

  const formatDur = (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    if (h > 0 && m > 0) return `${h}h${m}m`
    if (h > 0) return `${h}h`
    return `${m}m`
  }

  return {
    diaryCount,
    recordCount,
    totalDuration: formatDur(totalDuration),
    avgDailyDiary: `${(diaryCount / days).toFixed(1)}篇/天`,
    avgDailyRecord: `${(recordCount / days).toFixed(1)}条/天`,
    diaryTrend,
    recordTrend,
    diaryMax: getTrendMax(diaryTrend),
    recordMax: getTrendMax(recordTrend),
    diaryLabelMaxLen,
    recordLabelMaxLen
  }
})

const focusStats = computed(() => {
  const rangeRecords = focusStore.records.filter(r => r.date >= startDate.value && r.date <= endDate.value)
  const sessionCount = rangeRecords.length
  const totalDuration = rangeRecords.reduce((sum, r) => sum + r.duration, 0)
  const pomodoroCount = rangeRecords.filter(r => r.type === 'pomodoro').length
  const stopwatchCount = rangeRecords.filter(r => r.type === 'stopwatch').length
  const favoriteCount = focusStore.favorites.length

  const focusDateData = rangeRecords.map(r => ({ date: r.date, value: r.duration }))
  const { items: trendData, maxLabelLen: trendLabelMaxLen } = buildTrend(focusDateData, '分', true)

  return {
    favoriteCount,
    sessionCount,
    totalDuration: formatDurationLabel(totalDuration),
    pomodoroCount,
    stopwatchCount,
    trendData,
    trendMax: getTrendMax(trendData),
    trendLabelMaxLen
  }
})

const missionStats = computed(() => {
  const allCompletedRecords = completedMissionRecords.value.filter(r => {
    if (!r.completedDate) return false
    return r.completedDate >= startDate.value && r.completedDate <= endDate.value
  })

  const rangeMissions = missionStore.missions.filter(m => {
    if (!m.date) return false
    return m.date >= startDate.value && m.date <= endDate.value
  })
  const totalCount = rangeMissions.length

  const currentlyCompleted = rangeMissions.filter(m => m.completed).length
  const archivedCompleted = allCompletedRecords.length

  const currentCompletedIds = new Set(
    rangeMissions.filter(m => m.completed).map(m => m.id)
  )
  const uniqueArchivedFromRecords = allCompletedRecords.filter(
    r => !currentCompletedIds.has(r.missionId)
  )
  const completedCount = currentlyCompleted + uniqueArchivedFromRecords.length

  const completionRate = totalCount > 0 ? `${((completedCount / totalCount) * 100).toFixed(0)}%` : '0%'

  const priorityMap: Record<string, { label: string; color: string; count: number }> = {
    high: { label: '高', color: '#ef4444', count: 0 },
    medium: { label: '中', color: '#f59e0b', count: 0 },
    low: { label: '低', color: '#22c55e', count: 0 },
    none: { label: '无', color: '#909399', count: 0 }
  }
  rangeMissions.forEach(m => {
    const p = m.priority || 'none'
    if (priorityMap[p]) priorityMap[p].count++
  })
  const priorityData = Object.values(priorityMap).filter(p => p.count > 0)

  const currentCompleted = rangeMissions.filter(m => m.completed)
  const allCompletedForTrend: { date: string; value: number }[] = [
    ...currentCompleted.map(m => ({ date: m.date, value: 1 })),
    ...allCompletedRecords.map(r => ({ date: r.completedDate, value: 1 }))
  ]

  const dailyCompletedTrend = buildTrend(allCompletedForTrend, '个', false)

  const listCount = missionStore.lists.length

  return {
    listCount,
    totalCount,
    completedCount,
    completionRate,
    priorityData,
    dailyCompletedTrend: dailyCompletedTrend.items,
    completedMax: getTrendMax(dailyCompletedTrend.items),
    completedLabelMaxLen: dailyCompletedTrend.maxLabelLen
  }
})

const countdownStats = computed(() => {
  const milestones = countdownMilestones.value
  const categories = countdownCategories.value

  const rangeMilestones = milestones.filter(m => {
    if (!m.createdAt) return false
    return dayjs(m.createdAt).format('YYYY-MM-DD') >= startDate.value &&
           dayjs(m.createdAt).format('YYYY-MM-DD') <= endDate.value
  })
  const totalCount = rangeMilestones.length
  const countdownCount = rangeMilestones.filter(m => m.countMode !== 'countup').length
  const countupCount = rangeMilestones.filter(m => m.countMode === 'countup').length

  const categoryData = categories.map((cat: any) => {
    const catMilestones = rangeMilestones.filter(m => m.category === cat.value)
    return {
      label: cat.label,
      color: cat.color,
      countdownCount: catMilestones.filter(m => m.countMode !== 'countup').length,
      countupCount: catMilestones.filter(m => m.countMode === 'countup').length,
      total: catMilestones.length
    }
  }).filter(c => c.total >= 0)

  const activeCategoryCount = categoryData.filter(c => c.total > 0).length
  const categoryMax = Math.max(...categoryData.map(d => d.countdownCount + d.countupCount), 1)
  const categoryLabelMaxLen = Math.max(...categoryData.map(d => d.label.length), 1)

  return {
    totalCount,
    countdownCount,
    countupCount,
    activeCategoryCount,
    categoryData,
    categoryMax,
    categoryLabelMaxLen
  }
})

const courseStats = computed(() => {
  const courses = courseList.value
  const totalCount = courses.length
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]
  let totalPeriods = 0
  courses.forEach((c: any) => {
    if (c.dayOfWeek && Array.isArray(c.dayOfWeek)) {
      c.dayOfWeek.forEach((d: number) => {
        dayCounts[d]++
      })
    }
    if (c.periodIds && Array.isArray(c.periodIds)) {
      totalPeriods += c.periodIds.length
    }
  })

  const dayData = DAY_NAMES.map((name, idx) => ({
    label: name,
    value: dayCounts[idx]
  }))

  const activeDays = dayData.filter(d => d.value > 0).length
  const dayMax = Math.max(...dayData.map(d => d.value), 1)
  const dayLabelMaxLen = Math.max(...dayData.map(d => d.label.length), 1)

  return { totalCount, activeDays, totalPeriods, dayData, dayMax, dayLabelMaxLen }
})

const getBarPercent = (value: number, max: number) => {
  return Math.round((value / max) * 100)
}

const formatDurationLabel = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

const setRangeFromTrend = (rangeStart: string, rangeEnd: string) => {
  startDate.value = rangeStart
  endDate.value = rangeEnd
}

const loadCourses = async () => {
  try {
    const courses = await getData<any[]>('course', 'courses')
    if (courses) courseList.value = courses
  } catch {}
}

const loadCompletedMissions = async () => {
  try {
    const records = await getData<any[]>('mission', 'completed')
    if (records) completedMissionRecords.value = records
  } catch {}
}

onMounted(async () => {
  if (pageNav.navPath.value.length === 0) {
    pageNav.setNavPath(['statistics'])
  }
  pageNav.setNavContext({
    segments: [],
    plusVisible: false,
    plusOnClick: null,
    goModuleHome: () => { pageNav.setNavPath(['statistics']) }
  })

  initDateRange()
  await Promise.all([loadCourses(), loadCompletedMissions()])
  logger.info('[统计] 统计页面挂载')
})
</script>

<style scoped>
.statistics-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.stats-scroll-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.stats-scroll-wrapper::-webkit-scrollbar {
  width: 6px;
}

.stats-scroll-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.stats-content {
  width: 80%;
  margin: 0 auto;
  padding: 24px;
}

.date-range-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  justify-content: center;
  flex-wrap: nowrap;
}

.date-range-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.date-picker-inline {
  flex-shrink: 0;
  max-width: 130px;
  min-width: 0;
}

.date-picker-inline :deep(.date-trigger) {
  max-width: 130px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.date-separator {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.capsule-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 18px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 20px;
  background: transparent;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
  flex-shrink: 0;
}

.capsule-btn:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
}

.capsule-btn .capsule-icon {
  width: 14px;
  height: 14px;
}

.reset-capsule {
  background: rgba(102,126,234,0.15);
  border-color: rgba(102,126,234,0.3);
  color: #93c5fd;
}

.reset-capsule:hover {
  background: rgba(102,126,234,0.3);
  color: #fff;
}

.module-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.module-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 20px 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.section-icon {
  font-size: 20px;
  line-height: 1;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.section-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
  color: #a78bfa;
}

.section-trend {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 12px;
}

.section-trend + .section-trend {
  margin-top: 10px;
}

.trend-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 8px;
}

.trend-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trend-bar-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trend-bar-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  flex-shrink: 0;
  text-align: right;
  white-space: nowrap;
}

.trend-bar-label.clickable {
  cursor: pointer;
  transition: color 0.2s;
}

.trend-bar-label.clickable:hover {
  color: #93c5fd;
  text-decoration: underline;
}

.trend-bar-track {
  flex: 1;
  height: 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
  overflow: hidden;
}

.trend-bar-fill {
  height: 100%;
  min-width: 2px;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.focus-bar-fill {
  background: linear-gradient(90deg, #f59e0b 0%, #ef4444 100%);
}

.mission-bar-fill {
  background: linear-gradient(90deg, #22c55e 0%, #10b981 100%);
}

.course-bar-fill {
  background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%);
}

.trend-bar-fill-group {
  height: 100%;
  display: flex;
  gap: 1px;
  border-radius: 3px;
  overflow: hidden;
}

.countdown-seg-dn {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px 0 0 3px;
}

.countdown-seg-up {
  background: linear-gradient(90deg, #f472b6 0%, #ec4899 100%);
  border-radius: 0 3px 3px 0;
}

.trend-bar-val {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  min-width: 52px;
  flex-shrink: 0;
  text-align: left;
}

.trend-legend {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-dn {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
}

.legend-up {
  background: linear-gradient(90deg, #f472b6 0%, #ec4899 100%);
}

.section-empty {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
}

.priority-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.priority-tag {
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}
</style>