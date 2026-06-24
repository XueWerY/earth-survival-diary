<template>
  <div class="tool-container">
    <div class="toolbar">
      <span class="count-badge">共 {{ items.length }} 条提醒</span>
      <el-button size="small" text @click="loadData">刷新</el-button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="items.length === 0" class="empty">
      <span class="empty-icon">✅</span>
      <p>暂无待调度的提醒</p>
      <p class="empty-hint">如需课程提醒，请在「课程表」设置中配置学期起始日期</p>
    </div>

    <div v-else :class="['card-grid', { 'android-grid': isAndroid }]">
      <div v-for="item in sortedItems" :key="item.id" class="reminder-card">
        <div class="card-top">
          <div class="reminder-name">{{ item.name }}</div>
          <div class="card-top-right">
            <span :class="['status-badge', timeStatus(item.triggerTime)]">{{ timeLabel(item.triggerTime) }}</span>
          </div>
        </div>
        <div class="card-second-row">
          <span class="trigger-time">{{ formatTime(item.triggerTime) }}</span>
          <span v-if="item.listName && item.repeatStrategy && item.repeatStrategy !== 'none'" class="repeat-label">重复任务</span>
        </div>
        <div v-if="item.listName" class="reminder-source">
          <span v-if="item.folderName" :style="{ color: getColor(item.folderName, 'folder') }">{{ item.folderName }}</span>
          <span v-if="item.folderName && item.listName" class="source-sep"> / </span>
          <span :style="{ color: getColor(item.listName, 'list') }">{{ item.listName }}</span>
          <span v-if="item.groupName" class="source-sep"> / </span>
          <span v-if="item.groupName" :style="{ color: getColor(item.listName + ':' + item.groupName, 'group') }">{{ item.groupName }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFocusStore } from '../../../../stores/focusStore'
import { useListStore } from '../../../../stores/listStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { getData } from '../../../../services/storageService'
import dayjs from 'dayjs'

const focusStore = useFocusStore()
const listStore = useListStore()
const settingsStore = useSettingsStore()
const loading = ref(false)
const items = ref<any[]>([])
const isAndroid = computed(() => typeof window !== 'undefined' && !(window as any).electronAPI && typeof (window as any).Capacitor !== 'undefined')

const sortedItems = computed(() => {
  return [...items.value].sort((a, b) => new Date(a.triggerTime).getTime() - new Date(b.triggerTime).getTime())
})

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function timeStatus(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'overdue'
  if (diff < 3600000) return 'soon'
  return ''
}

function timeLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return '已过期'
  if (diff < 3600000) {
    const min = Math.ceil(diff / 60000)
    return `${min}分钟后`
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}小时后`
  }
  const days = Math.floor(diff / 86400000)
  return `${days}天后`
}

function getColor(name: string, type: 'folder' | 'list' | 'group'): string {
  if (type === 'folder') {
    const folder = listStore.folders.find(f => f.name === name)
    return folder?.color || '#667eea'
  }
  if (type === 'list') {
    const list = listStore.taskLists.find(l => l.name === name)
    return list?.color || '#667eea'
  }
  const sepIdx = name.indexOf(':')
  const listName = name.substring(0, sepIdx)
  const groupName = name.substring(sepIdx + 1)
  const list = listStore.taskLists.find(l => l.name === listName)
  if (!list) return '#667eea'
  const group = list.groups.find(g => g.name === groupName)
  return group?.color || '#667eea'
}

function getNextOccurrence(baseDate: string, strategy: string, customDays: number, from: dayjs.Dayjs): dayjs.Dayjs | null {
  const base = dayjs(baseDate)
  let next = base
  if (!next.isBefore(from, 'day')) return next
  switch (strategy) {
    case 'daily': return from
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
    default: return base
  }
}

async function loadData() {
  loading.value = true
  try {
    const allReminders: any[] = []
    const now = dayjs()
    const today = now.startOf('day')

    // 收集任务提醒
    const lists = listStore.lists.filter((m: any) => !m.completed && m.reminderStrategy !== 'none' && m.date)
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

      let listName = ''
      let groupName = ''
      let folderName = ''
      const list = listStore.taskLists.find((l: any) => l.id === m.listId)
      if (list) {
        listName = list.name
        const group = list.groups.find((g: any) => g.id === m.groupId)
        if (group) groupName = group.name
        const folder = listStore.folders.find((f: any) => f.listIds.includes(m.listId))
        if (folder) folderName = folder.name
      }

      allReminders.push({
        id: m.id,
        name: m.name,
        body: '截止: ' + nextDate.format('YYYY-MM-DD') + (m.endTime ? ' ' + m.endTime : ''),
        triggerTime: triggerTime.toISOString(),
        listName,
        groupName,
        folderName,
        repeatStrategy: m.repeatStrategy
      })
    }

    // 收集倒数日提醒
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

          allReminders.push({
            id: cm.id,
            name: cm.name,
            body: `倒数日「${cm.name}」即将到达`,
            triggerTime: triggerTime.toISOString()
          })
        }
      }
    } catch {
      // 倒数日数据加载失败，跳过
    }

    // 收集课程提醒
    try {
      const courseSettings = settingsStore.settings?.course
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
          for (const course of courses) {
            if (!course.periodIds || course.periodIds.length === 0) continue
            const dwList = Array.isArray(course.dayOfWeek) ? course.dayOfWeek : [course.dayOfWeek]
            if (!dwList || dwList.length === 0) continue
            // weeks 为空数组表示全部周（与 CourseSchedule.vue 一致）
            const sortedWeeks = course.weeks && course.weeks.length > 0
              ? [...course.weeks].sort((a: number, b: number) => a - b)
              : Array.from({ length: courseSettings?.totalWeeks || 20 }, (_, i) => i + 1)

            const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
            const addMinutes = (time: string, minutes: number) => {
              const total = timeToMinutes(time) + minutes
              const h = Math.floor(total / 60) % 24
              const m = total % 60
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
            }
            const getCourseStartTime = (periodIds: number[]): string => {
              const firstStart = courseSettings?.firstPeriodStart || '08:00'
              const dur = courseSettings?.periodDuration || 45
              const brk = courseSettings?.breakDuration || 10
              const lunch = courseSettings?.lunchBreakMinutes ?? 120
              const dinner = courseSettings?.dinnerBreakMinutes ?? 90
              const counts = courseSettings?.periodCountPerSession || { morning: 4, afternoon: 4, evening: 2 }
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

            for (const dw of dwList) {
              const dayOffset = dw === 0 ? 6 : dw - 1
              for (const week of sortedWeeks) {
                if (week < currentWeek) continue
                const classDate = semesterMonday.add((week - 1) * 7 + dayOffset, 'day')
                const startTime = getCourseStartTime(course.periodIds)
                const triggerTime = dayjs(classDate.format('YYYY-MM-DD') + 'T' + startTime).subtract(courseReminderMinutes, 'minute')
                if (triggerTime.valueOf() <= now.valueOf() - 60000) continue

                allReminders.push({
                  id: `course-${course.id}-${dw}`,
                  name: course.name,
                  body: `「${course.name}」即将开始`,
                  triggerTime: triggerTime.toISOString(),
                  repeatStrategy: 'weekly',
                  courseStartTime: classDate.format('YYYY-MM-DD') + 'T' + startTime
                })
                break
              }
            }
          }
        }
      }
    } catch {
      // 课程数据加载失败，跳过
    }

    // 收集专注提醒（番茄钟和正计时整点）
    try {
      const timerState = focusStore.timerState
      if (timerState) {
        if (timerState.type === 'pomodoro') {
          const nowMs = Date.now()
          const elapsedSinceStart = Math.floor((nowMs - timerState.startTimestamp) / 1000)
          const totalSeconds = timerState.targetDuration * 60
          const remaining = Math.max(0, totalSeconds - Math.max(0, elapsedSinceStart))
          if (remaining > 0) {
            allReminders.push({
              id: 'focus-pomodoro',
              name: timerState.name || '专注完成',
              body: '专注完成，请放松一下吧',
              triggerTime: new Date(nowMs + remaining * 1000).toISOString(),
              repeatStrategy: 'none',
              focusDuration: timerState.targetDuration
            })
          }
        } else if (timerState.type === 'stopwatch') {
          const nowMs = Date.now()
          const elapsedMs = nowMs - timerState.startTimestamp
          const elapsedMinutes = Math.floor(elapsedMs / 60000)
          const nextHourMark = (Math.floor(elapsedMinutes / 60) + 1) * 60
          const minutesUntilNextHour = nextHourMark - elapsedMinutes
          allReminders.push({
            id: 'focus-hourly',
            name: timerState.name || '专注提醒',
            body: '已达整数小时，继续加油！',
            triggerTime: new Date(nowMs + minutesUntilNextHour * 60000).toISOString(),
            repeatStrategy: 'hourly'
          })
        }
      }
    } catch {
      // 专注数据加载失败，跳过
    }

    items.value = allReminders
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.tool-container {
  padding: 8px 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.count-badge {
  color: var(--chalk-white-60);
  font-size: 12px;
}

.loading {
  text-align: center;
  color: var(--chalk-white-40);
  padding: 30px 0;
  font-size: 13px;
}

.empty {
  text-align: center;
  padding: 40px 0;
  color: var(--chalk-white-60);
}

.empty-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 12px;
  margin-top: 8px;
  opacity: 0.6;
}

.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.card-grid.android-grid {
  grid-template-columns: 1fr;
}

.reminder-card {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.reminder-name {
  color: var(--chalk-white);
  font-size: 14px;
  font-weight: 500;
  min-width: 0;
  flex: 1;
}

.card-top-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.card-second-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trigger-time {
  color: #d4b85a;
  font-size: 11px;
}

.repeat-label {
  color: var(--chalk-white-70);
  font-size: 11px;
}

.reminder-source {
  font-size: 11px;
  opacity: 0.9;
}

.source-sep {
  color: #fff;
  font-size: 11px;
}

.status-badge {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(102, 126, 234, 0.15);
  color: #8ab4f8;
}

.status-badge.overdue {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.status-badge.soon {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

@media (max-width: 640px) {
  .card-grid:not(.android-grid) {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 400px) {
  .card-grid:not(.android-grid) {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
.tool-page-body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.tool-page-body::-webkit-scrollbar {
  display: none;
}
</style>