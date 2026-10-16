import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getData, setData, getSystemStateField, setSystemStateField } from '../services/storageService'

// 常用专注
export interface FavoriteFocus {
    id: string
    name: string
    notes: string
    tags?: string
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
    const favorites = ref<FavoriteFocus[]>([])
    const timerState = ref<TimerState | null>(null) // 当前计时状态
    const isLoaded = ref(false)

    // 加载数据
    const loadData = async () => {
        if (isLoaded.value) return
        const [savedFavorites, savedTimerState] = await Promise.all([
            getData<FavoriteFocus[]>('footprint', 'favorites'),
            getSystemStateField('focusTimer')
        ])
        if (savedFavorites) favorites.value = savedFavorites
        else {
          // 首次使用，创建默认常用专注
          const now = new Date().toISOString()
          favorites.value = [
            { id: 'default-reading', name: '阅读', notes: '', type: 'pomodoro', targetDuration: 25, createdAt: now },
            { id: 'default-study', name: '学习', notes: '', type: 'pomodoro', targetDuration: 25, createdAt: now },
            { id: 'default-work', name: '工作', notes: '', type: 'pomodoro', targetDuration: 25, createdAt: now },
            { id: 'default-exercise', name: '锻炼', notes: '', type: 'stopwatch', targetDuration: 0, createdAt: now },
          ] as FavoriteFocus[]
          await saveFavorites()
        }
        if (savedTimerState) timerState.value = savedTimerState
        isLoaded.value = true
    }

    const saveFavorites = async () => {
        await setData('footprint', 'favorites', favorites.value)
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

    // 更新常用专注（内存实时生效，写入防抖 500ms）
    let favoriteSaveTimer: ReturnType<typeof setTimeout> | null = null
    const updateFavorite = (id: string, patch: Partial<FavoriteFocus>) => {
        const favorite = favorites.value.find(f => f.id === id)
        if (!favorite) return
        Object.assign(favorite, patch)
        if (favoriteSaveTimer) clearTimeout(favoriteSaveTimer)
        favoriteSaveTimer = setTimeout(() => { saveFavorites() }, 500)
    }

    // 删除常用专注
    const deleteFavorite = async (id: string) => {
        const index = favorites.value.findIndex(f => f.id === id)
        if (index !== -1) {
            favorites.value.splice(index, 1)
            await saveFavorites()
        }
    }

    // Reset store (used when logging out)
    const reset = () => {
        favorites.value = []
        timerState.value = null
        isLoaded.value = false
    }

    return {
        favorites,
        isLoaded,
        loadData,
        addFavorite,
        updateFavorite,
        deleteFavorite,
        // 计时状态持久化
        timerState,
        saveTimerState,
        clearTimerState,
        reset
    }
})
