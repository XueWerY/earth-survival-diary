import { computed } from 'vue'
import dayjs from 'dayjs'
import { useMissionStore, type Mission, type RepeatStrategy } from '../stores/missionStore'

export function useRecurringMissions() {
  const missionStore = useMissionStore()

  const getNextRepeatDate = (currentDate: string, strategy: RepeatStrategy, customDays: number = 1): string => {
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
  const missionOccursOnDate = (mission: Mission, targetDate: string): boolean => {
    if (mission.repeatStrategy === 'none') {
      return mission.date === targetDate
    }

    const startDate = dayjs(mission.date).startOf('day')
    const target = dayjs(targetDate).startOf('day')

    if (target.isBefore(startDate)) {
      return false
    }

    let current = mission.date
    let cycleCount = 0
    const maxCycles = 365 * 10

    while (cycleCount < maxCycles) {
      const currentDayjs = dayjs(current).startOf('day')

      if (currentDayjs.isSame(target)) {
        if (isRepeatDateBeyondEndDate(current, mission.repeatEndStrategy, mission.repeatEndDate, mission.repeatCount, cycleCount)) {
          return false
        }
        return true
      }

      if (currentDayjs.isAfter(target)) {
        return false
      }

      current = getNextRepeatDate(current, mission.repeatStrategy, mission.repeatCustomDays)
      cycleCount++
    }

    return false
  }

  /**
   * 获取给定日期对应的重复任务实例日期
   * 返回该日期在重复模式中对应的日期，如果不存在则返回null
   */
  const getMissionDateForDate = (mission: Mission, targetDate: string): string | null => {
    if (mission.repeatStrategy === 'none') {
      return mission.date === targetDate ? mission.date : null
    }

    if (missionOccursOnDate(mission, targetDate)) {
      return targetDate
    }

    return null
  }

  /**
   * 获取指定日期应显示的所有任务（包括周期性任务的实例）
   */
  const getMissionsForDate = (targetDate: string): Mission[] => {
    const result: Mission[] = []

    for (const mission of missionStore.missions) {
      if (missionOccursOnDate(mission, targetDate)) {
        result.push({
          ...mission,
          date: targetDate
        })
      }
    }

    return result
  }

  const recurringMissions = computed(() => {
    return missionStore.missions.filter(m => m.repeatStrategy !== 'none')
  })

  const nonRecurringMissions = computed(() => {
    return missionStore.missions.filter(m => m.repeatStrategy === 'none')
  })

  return {
    getNextRepeatDate,
    getPrevRepeatDate,
    isRepeatDateBeyondEndDate,
    missionOccursOnDate,
    getMissionDateForDate,
    getMissionsForDate,
    recurringMissions,
    nonRecurringMissions,
  }
}