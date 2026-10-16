import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '../lib/api'
import { logger } from '../lib/logger'

export interface User {
    id: string
    email: string
    createdAt?: string
    role?: string
    user_metadata?: {
        nickname?: string
    }
}

export interface UserProfile {
    id: string
    nickname: string
    birthday?: string // 生日
    birthdayCalendar?: 'solar' | 'lunar'
    phone?: string // 手机号
    avatarDataUrl?: string
    createdAt?: string
    created_at?: string
    updated_at?: string
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null)
    const profile = ref<UserProfile | null>(null)
    const loading = ref(true)

    const isAuthenticated = computed(() => !!user.value)
    const nickname = computed(() => profile.value?.nickname || user.value?.email?.split('@')[0] || '用户')

    // 初始化：检查当前会话
    const init = async () => {
        loading.value = true
        try {
            const { user: currentUser } = await api.getUser()
            if (currentUser) {
                user.value = currentUser as User
                await fetchProfile()
            }
        } catch {
            api.setToken(null)
        } finally {
            loading.value = false
        }
    }

    // 获取用户配置
    const fetchProfile = async () => {
        try {
            const { profile: userProfile } = await api.getProfile()
            profile.value = {
                ...userProfile,
                id: user.value?.id || userProfile.id,
                nickname: userProfile.nickname || user.value?.email?.split('@')[0] || '地球 Online 玩家',
                createdAt: userProfile.createdAt || userProfile.created_at || user.value?.createdAt,
                created_at: userProfile.createdAt || userProfile.created_at || user.value?.createdAt,
                avatarDataUrl: typeof userProfile.avatarDataUrl === 'string' ? userProfile.avatarDataUrl : ''
            }
        } catch (error) {
            logger.error('[Auth] 获取用户资料失败', { error: error instanceof Error ? error.message : String(error) })
        }
    }

    // 更新用户配置
    const updateProfile = async (updates: { nickname?: string }) => {
        if (!user.value) return

        if (updates.nickname) {
            const { profile: updatedProfile } = await api.updateProfile({ nickname: updates.nickname })
            profile.value = updatedProfile
        }
    }

    // 注册
    const signUp = async (email: string, password: string, nickname?: string) => {
        const result = await api.signUp({ email, password })

        if (result.user) {
            user.value = result.user as User
            await api.updateProfile({ nickname: nickname?.trim() || '地球 Online 玩家' })
            await fetchProfile()
        }

        return result
    }

    // 登录
    const signIn = async (email: string, password: string) => {
        const result = await api.signIn({ email, password })

        if (result.user) {
            user.value = result.user as User
            await fetchProfile()
        }

        return result
    }

    // 登出
    const signOut = async () => {
        await api.signOut()
        user.value = null
        profile.value = null
        loading.value = false
    }

    // 只清除本地账号状态，用于重新登录
    const clearUser = () => {
        api.setToken(null)
        user.value = null
        profile.value = null
        loading.value = false
    }

    // 获取访问令牌
    const getAccessToken = () => {
        return localStorage.getItem('auth_token')
    }

    return {
        user,
        profile,
        loading,
        isAuthenticated,
        nickname,
        init,
        fetchProfile,
        updateProfile,
        signUp,
        signIn,
        signOut,
        clearUser,
        getAccessToken
    }
})
