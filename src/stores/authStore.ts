import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '../lib/api'

export interface User {
    id: string
    email: string
    role?: string
    user_metadata?: {
        nickname?: string
    }
}

export interface UserProfile {
    id: string
    nickname: string
    birthday?: string // 生日
    phone?: string // 手机号
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
            profile.value = userProfile
        } catch (error) {
            console.error('Failed to get user profile:', error)
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
        const result = await api.signUp({
            email,
            password,
            nickname: nickname || '地球 Online 玩家'
        })

        if (result.user) {
            user.value = result.user as User
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

    // 只清除本地用户状态（不调用服务端 signOut）
    // 用于被踢出后的重新登录场景
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
