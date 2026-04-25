import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../lib/api'

// 扩展用户设置接口
export interface ExtendedUserSettings {
    // 专注模块设置
    focus: {
        pomodoroDuration: number // 番茄时长（分钟）
    }
    // 课程表模块设置
    course: {
        semesterStartDate: string // 开学日期 YYYY-MM-DD
        totalWeeks: number // 学期总周数
    }
}

// 默认设置
export const defaultSettings: ExtendedUserSettings = {
    focus: {
        pomodoroDuration: 25
    },
    course: {
        semesterStartDate: '',
        totalWeeks: 20
    }
}

export const useSettingsStore = defineStore('settings', () => {
    // 状态
    const settings = ref<ExtendedUserSettings>(defaultSettings)
    const isLoaded = ref(false)
    const isLoading = ref(false)

    // 加载设置
    const loadSettings = async () => {
        if (isLoaded.value) return

        isLoading.value = true
        try {
            const result = await api.getSettings()
            settings.value = {
                ...defaultSettings,
                ...result.settings
            }
            isLoaded.value = true
        } catch (error) {
            console.error('Failed to load settings:', error)
        } finally {
            isLoading.value = false
        }
    }

    // 更新设置
    const updateSettings = async (newSettings: Partial<ExtendedUserSettings>) => {
        try {
            const result = await api.updateSettings(newSettings)
            // 合并返回的设置
            settings.value = {
                ...settings.value,
                ...result.settings
            }
            return true
        } catch (error) {
            console.error('Failed to update settings:', error)
            return false
        }
    }

    // 更新专注设置
    const updateFocusSettings = async (focusSettings: Partial<ExtendedUserSettings['focus']>) => {
        return updateSettings({
            focus: {
                ...settings.value.focus,
                ...focusSettings
            }
        })
    }

    // 更新课程表设置
    const updateCourseSettings = async (courseSettings: Partial<ExtendedUserSettings['course']>) => {
        return updateSettings({
            course: {
                ...settings.value.course,
                ...courseSettings
            }
        })
    }

    // 恢复默认设置
    const resetSettings = async () => {
        return updateSettings(defaultSettings)
    }

    // Reset store state (used when logging out)
    const reset = () => {
        settings.value = { ...defaultSettings }
        isLoaded.value = false
    }

    return {
        settings,
        isLoaded,
        isLoading,
        loadSettings,
        updateSettings,
        updateFocusSettings,
        updateCourseSettings,
        resetSettings,
        reset
    }
})
