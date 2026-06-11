import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { getData, setData, getSystemStateField, setSystemStateField } from '../services/storageService'

// 专注记录
export interface FocusRecord {
    id: string
    name: string
    notes: string
    type: 'pomodoro' | 'stopwatch' // 番茄钟或正计时
    duration: number // 实际时长（分钟）
    targetDuration: number // 目标时长（分钟），仅番茄钟有效
    startTime: string // 开始时间 HH:mm
    endTime: string // 结束时间 HH:mm
    date: string
    completed: boolean // 是否完成目标
    createdAt: string
}

// 常用专注
export interface FavoriteFocus {
    id: string
    name: string
    notes: string
    type: 'pomodoro' | 'stopwatch'
    targetDuration: number // 目标时长（分钟）
    createdAt: string
}

// 计时状态（用于持久化）
export interface TimerState {
    name: string
    notes: string
    type: 'pomodoro' | 'stopwatch'
    startTimestamp: number // 开始时间戳（毫秒）
    targetDuration: number // 目标时长（分钟），番茄钟用
    elapsedSeconds: number // 已计时秒数（用于备份）
    isPaused: boolean // 是否处于暂停状态
}

// 状态

export const useFocusStore = defineStore('focus', () => {
    const records = ref<FocusRecord[]>([])
    const favorites = ref<FavoriteFocus[]>([])
    const timerState = ref<TimerState | null>(null) // 当前计时状态
    const focusDisplayTime = ref('')
    const isLoaded = ref(false)

    // 加载数据
    const loadData = async () => {
        if (isLoaded.value) return
        const [savedRecords, savedFavorites, savedTimerState] = await Promise.all([
            getData<FocusRecord[]>('focus', 'records'),
            getData<FavoriteFocus[]>('focus', 'favorites'),
            getSystemStateField('focusTimer')
        ])
        if (savedRecords) records.value = savedRecords
        if (savedFavorites) favorites.value = savedFavorites
        if (savedTimerState) timerState.value = savedTimerState
        isLoaded.value = true
    }

    // 保存数据
    const saveRecords = async () => {
        await setData('focus', 'records', records.value)
    }

    const saveFavorites = async () => {
        await setData('focus', 'favorites', favorites.value)
    }

    // 保存计时状态
    const saveTimerState = async (state: TimerState | null) => {
        timerState.value = state
        await setSystemStateField('focusTimer', state)
    }

    // 清除计时状态
    const clearTimerState = async () => {
        timerState.value = null
        await setSystemStateField('focusTimer', null)
    }

    // 添加专注记录
    const addRecord = async (record: Omit<FocusRecord, 'id' | 'createdAt'>) => {
        const newRecord: FocusRecord = {
            ...record,
            id: Date.now().toString(),
            createdAt: new Date().toISOString()
        }
        records.value.push(newRecord)
        await saveRecords()
        return newRecord
    }

    // 删除专注记录
    const deleteRecord = async (id: string) => {
        const index = records.value.findIndex(r => r.id === id)
        if (index !== -1) {
            records.value.splice(index, 1)
            await saveRecords()
        }
    }

    // 添加常用专注
    const addFavorite = async (favorite: Omit<FavoriteFocus, 'id' | 'createdAt'>) => {
        // 检查是否存在相同名称和类型的常用专注
        const exists = favorites.value.some(f => f.name === favorite.name && f.type === favorite.type)
        if (exists) {
            return null
        }

        const newFavorite: FavoriteFocus = {
            ...favorite,
            id: Date.now().toString(),
            createdAt: new Date().toISOString()
        }
        favorites.value.push(newFavorite)
        await saveFavorites()
        return newFavorite
    }

    // 删除常用专注
    const deleteFavorite = async (id: string) => {
        const index = favorites.value.findIndex(f => f.id === id)
        if (index !== -1) {
            favorites.value.splice(index, 1)
            await saveFavorites()
        }
    }

    // 统计：今日专注次数
    const todayFocusCount = computed(() => {
        const today = dayjs().format('YYYY-MM-DD')
        return records.value.filter(r => r.date === today).length
    })

    // 统计：今日专注时长（分钟）
    const todayFocusDuration = computed(() => {
        const today = dayjs().format('YYYY-MM-DD')
        return records.value
            .filter(r => r.date === today)
            .reduce((sum, r) => sum + r.duration, 0)
    })

    // 统计：本周专注时长
    const weeklyFocusDuration = computed(() => {
        const startOfWeek = dayjs().startOf('week')
        return records.value
            .filter(r => {
                const date = dayjs(r.date)
                return date.isAfter(startOfWeek) || date.isSame(startOfWeek, 'day')
            })
            .reduce((sum, r) => sum + r.duration, 0)
    })

    // 统计：本周每日专注时长
    const weeklyDailyStats = computed(() => {
        const stats: { date: string; duration: number; count: number }[] = []
        for (let i = 6; i >= 0; i--) {
            const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
            const dayRecords = records.value.filter(r => r.date === date)
            stats.push({
                date,
                duration: dayRecords.reduce((sum, r) => sum + r.duration, 0),
                count: dayRecords.length
            })
        }
        return stats
    })

    // 统计：本月专注时长
    const monthlyFocusDuration = computed(() => {
        const startOfMonth = dayjs().startOf('month')
        return records.value
            .filter(r => {
                const date = dayjs(r.date)
                return date.isAfter(startOfMonth) || date.isSame(startOfMonth, 'day')
            })
            .reduce((sum, r) => sum + r.duration, 0)
    })

    // 统计：总专注时长
    const totalFocusDuration = computed(() => {
        return records.value.reduce((sum, r) => sum + r.duration, 0)
    })

    // 统计：总专注次数
    const totalFocusCount = computed(() => records.value.length)

    // 统计：按名称统计
    const statsByName = computed(() => {
        const map = new Map<string, { count: number; duration: number }>()
        records.value.forEach(r => {
            const existing = map.get(r.name) || { count: 0, duration: 0 }
            map.set(r.name, {
                count: existing.count + 1,
                duration: existing.duration + r.duration
            })
        })
        return Array.from(map.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.duration - a.duration)
    })

    // 获取指定日期的记录
    const getRecordsByDate = (date: string) => {
        return records.value.filter(r => r.date === date)
    }

    // 获取指定日期范围的记录
    const getRecordsByDateRange = (startDate: string, endDate: string) => {
        return records.value.filter(r => r.date >= startDate && r.date <= endDate)
    }

    // 获取指定日期范围的每日统计
    const getDailyStatsByRange = (startDate: string, endDate: string) => {
        const stats: { date: string; duration: number; count: number }[] = []
        const start = dayjs(startDate)
        const end = dayjs(endDate)
        const days = end.diff(start, 'day') + 1

        for (let i = 0; i < days; i++) {
            const date = start.add(i, 'day').format('YYYY-MM-DD')
            const dayRecords = records.value.filter(r => r.date === date)
            stats.push({
                date,
                duration: dayRecords.reduce((sum, r) => sum + r.duration, 0),
                count: dayRecords.length
            })
        }
        return stats
    }

    // 获取指定日期按小时的统计
    const getHourlyStatsByDate = (date: string) => {
        const stats: { hour: number; duration: number; count: number }[] = []
        const dayRecords = records.value.filter(r => r.date === date)

        for (let hour = 0; hour < 24; hour++) {
            const hourRecords = dayRecords.filter(r => {
                const startHour = parseInt(r.startTime.split(':')[0])
                return startHour === hour
            })
            stats.push({
                hour,
                duration: hourRecords.reduce((sum, r) => sum + r.duration, 0),
                count: hourRecords.length
            })
        }
        return stats
    }

    // 获取指定年份按月的统计
    const getMonthlyStatsByYear = (year: number) => {
        const stats: { month: number; duration: number; count: number }[] = []

        for (let month = 0; month < 12; month++) {
            const startDate = dayjs().year(year).month(month).startOf('month').format('YYYY-MM-DD')
            const endDate = dayjs().year(year).month(month).endOf('month').format('YYYY-MM-DD')
            const monthRecords = records.value.filter(r => r.date >= startDate && r.date <= endDate)
            stats.push({
                month,
                duration: monthRecords.reduce((sum, r) => sum + r.duration, 0),
                count: monthRecords.length
            })
        }
        return stats
    }

    // 获取指定日期范围内的专注时长
    const getDurationByRange = (startDate: string, endDate: string) => {
        return records.value
            .filter(r => r.date >= startDate && r.date <= endDate)
            .reduce((sum, r) => sum + r.duration, 0)
    }

    // 获取指定日期范围内的专注次数
    const getCountByRange = (startDate: string, endDate: string) => {
        return records.value.filter(r => r.date >= startDate && r.date <= endDate).length
    }

    // 获取指定日期范围内的按名称统计
    const getStatsByNameByRange = (startDate: string, endDate: string) => {
        const map = new Map<string, { count: number; duration: number }>()
        records.value
            .filter(r => r.date >= startDate && r.date <= endDate)
            .forEach(r => {
                const existing = map.get(r.name) || { count: 0, duration: 0 }
                map.set(r.name, {
                    count: existing.count + 1,
                    duration: existing.duration + r.duration
                })
            })
        return Array.from(map.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.duration - a.duration)
    }

    // Reset store (used when logging out)
    const reset = () => {
        records.value = []
        favorites.value = []
        timerState.value = null
        isLoaded.value = false
    }

    return {
        records,
        favorites,
        isLoaded,
        loadData,
        addRecord,
        deleteRecord,
        addFavorite,
        deleteFavorite,
        todayFocusCount,
        todayFocusDuration,
        weeklyFocusDuration,
        weeklyDailyStats,
        monthlyFocusDuration,
        totalFocusDuration,
        totalFocusCount,
        statsByName,
        getRecordsByDate,
        getRecordsByDateRange,
        getDailyStatsByRange,
        getHourlyStatsByDate,
        getMonthlyStatsByYear,
        getDurationByRange,
        getCountByRange,
        getStatsByNameByRange,
        // 计时状态持久化
        timerState,
        focusDisplayTime,
        saveTimerState,
        clearTimerState,
        reset
    }
})
