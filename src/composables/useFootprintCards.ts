import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useTaskStore } from '../stores/taskStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useRecurringMissions } from './useRecurringMissions'
import { getData } from '../services/storageService'
import { logger } from '../lib/logger'
import type { Mission } from '../stores/missionStore'

dayjs.extend(isoWeek)

interface CourseInfo {
  id: string
  name: string
  startTime: string
  endTime: string
  location: string
  teacher: string
  color: string
  note: string
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

type CardItemType = 'record' | 'mission' | 'course'

interface CardItem {
  type: CardItemType
  id: string
  sortKey: string
  record?: any
  mission?: Mission
  course?: CourseInfo
}

export function useFootprintCards(
  selectedDateValue: Ref<string>,
  countdownMilestones: Ref<any[]>,
  isGuideActive: Ref<boolean>
) {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const { getMissionsForDate } = useRecurringMissions()

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

  const loadCourses = async () => {
    try {
      const courses = await getData<any[]>('course', 'courses')
      if (courses && courses.length > 0) {
        const selDate = dayjs(selectedDateValue.value)
        const dayOfWeek = selDate.day()
        const weekNum = getWeekNumber(selDate)
        loadedCourses.value = courses
          .filter((c: any) => {
            if (c.dayOfWeek !== dayOfWeek) return false
            if (c.weeks && c.weeks.length > 0) {
              return c.weeks.includes(weekNum)
            }
            return true
          })
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            startTime: c.startTime,
            endTime: c.endTime,
            location: c.location || '',
            teacher: c.teacher || '',
            color: c.color || '#3b82f6',
            note: c.note || ''
          }))
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
   * 清单任务卡片
   * 条件：选中日期与任务日期相同，或在周期性任务管理系统查询到的周期内
   */
  const missionCards = computed(() => {
    const today = selectedDateValue.value
    return getMissionsForDate(today)
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
        sortKey: task.endTime || '99:99',
        record: task
      })
    }

    for (const mission of missionCards.value) {
      cards.push({
        type: 'mission',
        id: mission.id,
        sortKey: mission.endTime || mission.startTime || '99:99',
        mission
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
    missionCards,
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