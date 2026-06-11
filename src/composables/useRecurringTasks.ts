import { computed } from 'vue'
import dayjs from 'dayjs'
import { useListStore, type Task, type RepeatStrategy } from '../stores/listStore'

export function useRecurringTasks() {
  const listStore = useListStore()

  const getNextRepeatDate = (currentDate: string, strategy: RepeatStrategy, customDays: number = 1, lunarMonth: number = 1, lunarDay: number = 1): string => {
    const current = dayjs(currentDate)
    switch (strategy) {
      case 'daily':
        return current.add(1, 'day').format('YYYY-MM-DD')
      case 'weekdays': {
        let next = current.add(1, 'day')
        const dayOfWeek = next.day()
        if (dayOfWeek === 0) next = next.add(1, 'day')
        else if (dayOfWeek === 6) next = next.add(2, 'day')
        return next.format('YYYY-MM-DD')
      }
      case 'weekly':
        return current.add(1, 'week').format('YYYY-MM-DD')
      case 'monthly':
        return current.add(1, 'month').format('YYYY-MM-DD')
      case 'lunar_date': {
        try {
          const { Lunar } = require('lunar-javascript') as any
          const solar = require('lunar-javascript').Solar.fromYmd(current.year(), current.month() + 1, current.date())
          const currentLunar = solar.getLunar()
          const lunarYear = currentLunar.getYear()
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const targetLunar = Lunar.fromYmd(lunarYear + attempt, lunarMonth, lunarDay)
              const targetSolar = targetLunar.getSolar()
              const targetDate = dayjs(`${targetSolar.getYear()}-${String(targetSolar.getMonth()).padStart(2, '0')}-${String(targetSolar.getDay()).padStart(2, '0')}`)
              if (targetDate.isAfter(current)) {
                return targetDate.format('YYYY-MM-DD')
              }
            } catch {}
          }
          const nextLunar = Lunar.fromYmd(lunarYear + 1, lunarMonth, lunarDay)
          const nextSolar = nextLunar.getSolar()
          return `${nextSolar.getYear()}-${String(nextSolar.getMonth()).padStart(2, '0')}-${String(nextSolar.getDay()).padStart(2, '0')}`
        } catch {
          return currentDate
        }
      }
      case 'yearly':
        return current.add(1, 'year').format('YYYY-MM-DD')
      case 'custom_days':
        return current.add(customDays, 'day').format('YYYY-MM-DD')
      default:
        return currentDate
    }
  }

  const getPrevRepeatDate = (currentDate: string, strategy: RepeatStrategy, customDays: number = 1): string => {
    const current = dayjs(currentDate)
    switch (strategy) {
      case 'daily':
        return current.subtract(1, 'day').format('YYYY-MM-DD')
      case 'weekdays': {
        let prev = current.subtract(1, 'day')
        const dayOfWeek = prev.day()
        if (dayOfWeek === 0) prev = prev.subtract(2, 'day')
        else if (dayOfWeek === 6) prev = prev.subtract(1, 'day')
        return prev.format('YYYY-MM-DD')
      }
      case 'weekly':
        return current.subtract(1, 'week').format('YYYY-MM-DD')
      case 'monthly':
        return current.subtract(1, 'month').format('YYYY-MM-DD')
      case 'yearly':
        return current.subtract(1, 'year').format('YYYY-MM-DD')
      case 'custom_days':
        return current.subtract(customDays, 'day').format('YYYY-MM-DD')
      default:
        return currentDate
    }
  }

  const isRepeatDateBeyondEndDate = (
    date: string,
    repeatEndStrategy: string,
    repeatEndDate: string,
    repeatCount: number,
    repeatCompletedCount: number
  ): boolean => {
    if (repeatEndStrategy === 'never') return false
    if (repeatEndStrategy === 'date' && repeatEndDate) {
      return dayjs(date).isAfter(dayjs(repeatEndDate), 'day')
    }
    if (repeatEndStrategy === 'count' && repeatCount) {
      return repeatCompletedCount >= repeatCount
    }
    return false
  }

  /**
   * 检查重复任务是否在某日期有实例
   * 从任务的原始日期开始，向前推进直到等于或超过目标日期
   */
  const taskOccursOnDate = (task: Task, targetDate: string): boolean => {
    if (task.repeatStrategy === 'none') {
      return task.date === targetDate
    }

    const startDate = dayjs(task.date).startOf('day')
    const target = dayjs(targetDate).startOf('day')

    if (target.isBefore(startDate)) {
      return false
    }

    let current = task.date
    let cycleCount = 0
    const maxCycles = 365 * 10

    while (cycleCount < maxCycles) {
      const currentDayjs = dayjs(current).startOf('day')

      if (currentDayjs.isSame(target)) {
        if (isRepeatDateBeyondEndDate(current, task.repeatEndStrategy, task.repeatEndDate, task.repeatCount, cycleCount)) {
          return false
        }
        return true
      }

      if (currentDayjs.isAfter(target)) {
        return false
      }

      current = getNextRepeatDate(current, task.repeatStrategy, task.repeatCustomDays, task.repeatLunarMonth, task.repeatLunarDay)
      cycleCount++
    }

    return false
  }

  /**
   * 获取给定日期对应的重复任务实例日期
   * 返回该日期在重复模式中对应的日期，如果不存在则返回null
   */
  const getTaskDateForDate = (task: Task, targetDate: string): string | null => {
    if (task.repeatStrategy === 'none') {
      return task.date === targetDate ? task.date : null
    }

    if (taskOccursOnDate(task, targetDate)) {
      return targetDate
    }

    return null
  }

  /**
   * 获取指定日期应显示的所有任务（包括周期性任务的实例）
   */
  const getTasksForDate = (targetDate: string): Task[] => {
    const result: Task[] = []

    for (const task of listStore.lists) {
      if (taskOccursOnDate(task, targetDate)) {
        result.push({
          ...task,
          date: targetDate
        })
      }
    }

    return result
  }

  const recurringTasks = computed(() => {
    return listStore.lists.filter(m => m.repeatStrategy !== 'none')
  })

  const nonRecurringTasks = computed(() => {
    return listStore.lists.filter(m => m.repeatStrategy === 'none')
  })

  return {
    getNextRepeatDate,
    getPrevRepeatDate,
    isRepeatDateBeyondEndDate,
    taskOccursOnDate,
    getTaskDateForDate,
    getTasksForDate,
    recurringTasks,
    nonRecurringTasks,
  }
}