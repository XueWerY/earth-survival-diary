import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useTaskStore } from '../stores/taskStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useRecurringTasks } from './useRecurringTasks'
import { getData } from '../services/storageService'
import { logger } from '../lib/logger'
import type { Task } from '../stores/listStore'

dayjs.extend(isoWeek)

export interface CourseInfo {
  id: string
  name: string
  startTime: string
  endTime: string
  location: string
  teacher: string
  color: string
  note: string
  weeks: number[]
  periodText: string
  dayOfWeek: number
}

interface CountdownCard {
  id: string
  name: string
  timeText: string
  description: string
  sortKey: number
}

interface PositiveDayCard {
  id: string
  name: string
  timeText: string
  description: string
  sortKey: number
}

interface CountdownDisplayItem {
  milestone: any
  categoryIcon: string
  countdownDays: number
  countdownUnit: string
  cardType: 'pinned' | 'upcoming' | 'future' | 'passed'
  reminderLabel: string
}

type CardItemType = 'record' | 'list' | 'course'

interface CardItem {
  type: CardItemType
  id: string
  sortKey: string
  record?: any
  list?: Task
  course?: CourseInfo
}

export function useFootprintCards(
  selectedDateValue: Ref<string>,
  countdownMilestones: Ref<any[]>,
  isGuideActive: Ref<boolean>
) {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const { getTasksForDate } = useRecurringTasks()

  const loadedCourses = ref<CourseInfo[]>([])

  const getMondayOfWeek = (date: dayjs.Dayjs): dayjs.Dayjs => {
    const day = date.day()
    const diff = day === 0 ? -6 : 1 - day
    return date.add(diff, 'day').startOf('day')
  }

  const getWeekNumber = (date: dayjs.Dayjs): number => {
    const semesterStartDate = settingsStore.settings.course?.semesterStartDate
    if (!semesterStartDate) {
      const startOfYear = date.startOf('year')
      const mondayOfFirstWeek = getMondayOfWeek(startOfYear)
      const diff = getMondayOfWeek(date).diff(mondayOfFirstWeek, 'week')
      return Math.max(1, diff + 1)
    }
    const startDate = getMondayOfWeek(dayjs(semesterStartDate))
    const diff = getMondayOfWeek(date).diff(startDate, 'week')
    return Math.max(1, diff + 1)
  }

  const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const addMinutes = (time: string, minutes: number): string => {
    const total = timeToMinutes(time) + minutes
    const h = Math.floor(total / 60) % 24
    const m = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const computePeriodsFromSettings = () => {
    const courseSettings = settingsStore.settings.course
    const start = courseSettings?.firstPeriodStart || '08:00'
    const dur = courseSettings?.periodDuration || 45
    const brk = courseSettings?.breakDuration || 10
    const mode = courseSettings?.breakMode || 'uniform'
    const customBks = courseSettings?.customBreakDurations || []
    const lunch = courseSettings?.lunchBreakMinutes ?? 120
    const dinner = courseSettings?.dinnerBreakMinutes ?? 90
    const counts = courseSettings?.periodCountPerSession || { morning: 4, afternoon: 4, evening: 2 }
    const result: { id: number; name: string; start: string; end: string }[] = []
    let currentStart = start
    let idCounter = 1
    let customGapIdx = 0

    for (let i = 0; i < counts.morning; i++) {
      const end = addMinutes(currentStart, dur)
      result.push({ id: idCounter++, name: `第${idCounter - 1}节`, start: currentStart, end })
      if (i < counts.morning - 1) {
        currentStart = addMinutes(end, mode === 'custom' ? (customBks[customGapIdx] ?? brk) : brk)
        customGapIdx++
      } else {
        currentStart = addMinutes(end, brk)
      }
    }

    if (counts.morning > 0 && counts.afternoon > 0) {
      currentStart = addMinutes(result[result.length - 1].end, lunch)
    } else if (counts.morning === 0 && counts.afternoon > 0) {
      currentStart = start
    }

    for (let i = 0; i < counts.afternoon; i++) {
      const end = addMinutes(currentStart, dur)
      result.push({ id: idCounter++, name: `第${idCounter - 1}节`, start: currentStart, end })
      if (i < counts.afternoon - 1) {
        currentStart = addMinutes(end, mode === 'custom' ? (customBks[customGapIdx] ?? brk) : brk)
        customGapIdx++
      } else {
        currentStart = addMinutes(end, brk)
      }
    }

    if (counts.afternoon > 0 && counts.evening > 0) {
      currentStart = addMinutes(result[result.length - 1].end, dinner)
    } else if (counts.afternoon === 0 && counts.evening > 0) {
      currentStart = start
    }

    for (let i = 0; i < counts.evening; i++) {
      const end = addMinutes(currentStart, dur)
      result.push({ id: idCounter++, name: `第${idCounter - 1}节`, start: currentStart, end })
      if (i < counts.evening - 1) {
        currentStart = addMinutes(end, mode === 'custom' ? (customBks[customGapIdx] ?? brk) : brk)
        customGapIdx++
      } else {
        currentStart = addMinutes(end, brk)
      }
    }

    return result
  }

  const loadCourses = async () => {
    try {
      const courses = await getData<any[]>('course', 'courses')
      const periods = computePeriodsFromSettings()
      if (courses && courses.length > 0) {
        const selDate = dayjs(selectedDateValue.value)
        const dayOfWeek = selDate.day()
        const weekNum = getWeekNumber(selDate)

        const getTimeFromPeriodIds = (periodIds: number[]): { startTime: string; endTime: string } => {
          if (periodIds.length === 0 || periods.length === 0) return { startTime: '08:00', endTime: '09:00' }
          const sorted = [...periodIds].sort((a, b) => a - b)
          const firstP = periods.find((p: any) => p.id === sorted[0])
          const lastP = periods.find((p: any) => p.id === sorted[sorted.length - 1])
          return { startTime: firstP?.start || '08:00', endTime: lastP?.end || '09:00' }
        }

        const periodIdsFromTimeRange = (startTime: string, endTime: string): number[] => {
          if (periods.length === 0) return []
          const startMins = timeToMinutes(startTime)
          const endMins = timeToMinutes(endTime)
          let bestStart = periods[0].id
          let bestEnd = periods[0].id
          let bestStartDiff = Infinity
          let bestEndDiff = Infinity
          for (const p of periods) {
            const diff = Math.abs(startMins - timeToMinutes(p.start))
            if (diff < bestStartDiff) { bestStartDiff = diff; bestStart = p.id }
            const diffEnd = Math.abs(endMins - timeToMinutes(p.end))
            if (diffEnd < bestEndDiff) { bestEndDiff = diffEnd; bestEnd = p.id }
          }
          const minP = Math.min(bestStart, bestEnd)
          const maxP = Math.max(bestStart, bestEnd)
          const ids: number[] = []
          for (let i = minP; i <= maxP; i++) ids.push(i)
          return ids
        }

        loadedCourses.value = courses
          .filter((c: any) => {
            const days = Array.isArray(c.dayOfWeek) ? c.dayOfWeek : [c.dayOfWeek]
            if (!days.includes(dayOfWeek)) return false
            if (c.weeks && c.weeks.length > 0) {
              return c.weeks.includes(weekNum)
            }
            return true
          })
          .map((c: any) => {
            const pIds: number[] = Array.isArray(c.periodIds) && c.periodIds.length > 0
              ? c.periodIds
              : (c.startTime && c.endTime ? periodIdsFromTimeRange(c.startTime, c.endTime) : [])
            const { startTime, endTime } = getTimeFromPeriodIds(pIds)
            // 格式化节次文本
            const sortedP = [...pIds].sort((a, b) => a - b)
            const periodText = sortedP.length > 0
              ? `第${sortedP[0]}${sortedP[0] !== sortedP[sortedP.length - 1] ? `-${sortedP[sortedP.length - 1]}` : ''}节`
              : ''
            return {
              id: c.id,
              name: c.name,
              startTime,
              endTime,
              location: c.location || '',
              teacher: c.teacher || '',
              color: c.color || '#3b82f6',
              note: c.note || '',
              weeks: Array.isArray(c.weeks) ? c.weeks : [],
              periodText,
              dayOfWeek: c.dayOfWeek
            }
          })
      }
    } catch (e) {
      logger.warn('[足迹卡片] 加载课程数据失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  watch(selectedDateValue, () => {
    loadCourses()
  }, { immediate: true })

  const filteredTasks = computed(() => {
    const date = selectedDateValue.value
    return taskStore.tasks
      .filter(t => t.date === date)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.startTime || '00:00').localeCompare(b.startTime || '00:00')
      })
  })

  /**
   * 倒数日卡片
   * 条件：选中日期 <= 目标日期
   * 显示规则：星标卡片始终显示，非星标仅在当天显示
   */
  const countdownCards: ComputedRef<CountdownCard[]> = computed(() => {
    const selDate = dayjs(selectedDateValue.value).startOf('day')
    return countdownMilestones.value
      .filter((m: any) => {
        if (m.countMode === 'countup') return false
        const t = dayjs(m.targetDate).startOf('day')
        const days = t.diff(selDate, 'day')
        if (days < 0) return false
        if (m.pinned) return true
        return days === 0
      })
      .map((m: any) => {
        const t = dayjs(m.targetDate).startOf('day')
        const isToday = t.isSame(selDate, 'day')
        const days = t.diff(selDate, 'day')
        let timeText: string
        if (isToday) {
          timeText = `今天就是${m.name}了`
        } else {
          timeText = `还有${Math.abs(days)}天`
        }
        return { id: m.id, name: m.name, timeText, description: m.description || '', sortKey: isToday ? 0 : Math.abs(days) }
      })
      .sort((a, b) => a.sortKey - b.sortKey)
  })

  /**
   * 正数日卡片
   * 条件：选中日期 >= 起始日期
   */
  const positiveDayCards: ComputedRef<PositiveDayCard[]> = computed(() => {
    const selDate = dayjs(selectedDateValue.value).startOf('day')
    return countdownMilestones.value
      .filter((m: any) => {
        if (m.countMode !== 'countup') return false
        const startDate = dayjs(m.targetDate).startOf('day')
        const days = selDate.diff(startDate, 'day')
        return days >= 0
      })
      .map((m: any) => {
        const startDate = dayjs(m.targetDate).startOf('day')
        const days = selDate.diff(startDate, 'day')
        return {
          id: m.id,
          name: m.name,
          timeText: days === 0 ? '今天开始' : `${days}天`,
          description: m.description || '',
          sortKey: days
        }
      })
      .sort((a, b) => b.sortKey - a.sortKey)
  })

  /**
   * 倒数日展示卡片（供 CountdownCard 组件使用）
   * 综合 countdownCards 和 positiveDayCards 的筛选逻辑，返回完整 milestone 数据
   */
  const countdownDisplayCards: ComputedRef<CountdownDisplayItem[]> = computed(() => {
    const selDate = dayjs(selectedDateValue.value).startOf('day')
    const getIcon = (category: string): string => {
      const iconMap: Record<string, string> = {
        birthday: '🎂', anniversary: '💕', holiday: '🎉', travel: '✈️',
        entertainment: '🎮', work: '💼', study: '📚', life: '🌟'
      }
      return iconMap[category] || '📌'
    }
    const getCardType = (m: any, selDate: dayjs.Dayjs): 'pinned' | 'upcoming' | 'future' | 'passed' => {
      if (m.pinned) return 'pinned'
      const target = dayjs(m.targetDate).startOf('day')
      const days = target.diff(selDate, 'day')
      if (days < 0) return 'passed'
      if (days <= 7) return 'upcoming'
      return 'future'
    }
    const getReminderLabel = (m: any): string => {
      if (m.countMode === 'countup') return ''
      if (m.reminderStrategy === 'none' || !m.reminderStrategy) return ''
      if (m.reminderStrategy === 'on_time') return '准时提醒'
      if (m.reminderStrategy === 'advance') {
        const parts: string[] = []
        if (m.reminderDays) parts.push(`${m.reminderDays}天`)
        if (m.reminderHours) parts.push(`${m.reminderHours}小时`)
        if (m.reminderMinutes) parts.push(`${m.reminderMinutes}分钟`)
        return `提前${parts.join('')}`
      }
      return ''
    }
    return countdownMilestones.value
      .filter((m: any) => {
        if (m.countMode !== 'countup') {
          const t = dayjs(m.targetDate).startOf('day')
          const days = t.diff(selDate, 'day')
          if (days < 0) return false
          if (m.pinned) return true
          return days === 0
        }
        const startDate = dayjs(m.targetDate).startOf('day')
        const days = selDate.diff(startDate, 'day')
        return days >= 0 && m.pinned
      })
      .map((m: any) => {
        const target = dayjs(m.targetDate).startOf('day')
        const diffDays = m.countMode === 'countup' ? selDate.diff(target, 'day') : target.diff(selDate, 'day')
        const absDays = Math.abs(diffDays)
        let unit: string
        if (m.countMode === 'countup') {
          unit = diffDays === 0 ? '今天开始' : '天'
        } else if (diffDays > 0) {
          unit = '天后'
        } else if (diffDays < 0) {
          unit = '天前'
        } else {
          unit = '今天'
        }
        return {
          milestone: m,
          categoryIcon: getIcon(m.category),
          countdownDays: absDays,
          countdownUnit: unit,
          cardType: getCardType(m, selDate),
          reminderLabel: getReminderLabel(m)
        }
      })
      .sort((a, b) => a.countdownDays - b.countdownDays)
  })

  /**
   * 清单任务卡片
   * 条件：选中日期与任务日期相同，或在周期性任务管理系统查询到的周期内
   */
  const listCards = computed(() => {
    const today = selectedDateValue.value
    return getTasksForDate(today)
  })

  /**
   * 课程卡片
   * 条件：选中日期符合课程表中规定的上课日期（星期几 + 周次）
   */
  const courseCards = computed(() => loadedCourses.value)

  /**
   * 所有可排序卡片（记录 + 任务 + 课程），按结束时间排序
   */
  const allCards: ComputedRef<CardItem[]> = computed(() => {
    const cards: CardItem[] = []

    for (const task of filteredTasks.value) {
      cards.push({
        type: 'record',
        id: task.id,
        sortKey: task.endTime || (task.createdAt ? dayjs(task.createdAt).format('HH:mm') : '99:99'),
        record: task
      })
    }

    for (const list of listCards.value) {
      cards.push({
        type: 'list',
        id: list.id,
        sortKey: list.endTime || list.startTime || '99:99',
        list
      })
    }

    for (const course of courseCards.value) {
      cards.push({
        type: 'course',
        id: course.id,
        sortKey: course.endTime || course.startTime || '99:99',
        course
      })
    }

    cards.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    return cards
  })

  const getHourFromSortKey = (sortKey: string): number => {
    const parts = sortKey.split(':')
    return parseInt(parts[0]) || 0
  }

  const morningCards = computed(() => {
    return allCards.value.filter(card => getHourFromSortKey(card.sortKey) < 12)
  })

  const afternoonCards = computed(() => {
    return allCards.value.filter(card => {
      const h = getHourFromSortKey(card.sortKey)
      return h >= 12 && h < 18
    })
  })

  const eveningCards = computed(() => {
    return allCards.value.filter(card => getHourFromSortKey(card.sortKey) >= 18)
  })

  /**
   * 刷新课程数据（切换足迹页面时调用）
   */
  const refreshCourses = () => {
    loadCourses()
  }

  return {
    countdownCards,
    positiveDayCards,
    countdownDisplayCards,
    listCards,
    courseCards,
    allCards,
    morningCards,
    afternoonCards,
    eveningCards,
    filteredTasks,
    loadCourses,
    refreshCourses,
  }
}