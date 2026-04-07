import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '../lib/api'

export interface User {
    id: string
    email: string
    user_metadata?: {
        nickname?: string
    }
}

export interface UserProfile {
    id: string
    nickname: string
    avatar_url?: string
    avatarUrl?: string // 头像 URL
    birthday?: string // 生日
    phone?: string // 手机号
    created_at?: string
    updated_at?: string
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null)
    const profile = ref<UserProfile | null>(null)
    const avatarUrl = ref<string | null>(null) // 头像 URL
    const loading = ref(true)
    const kickedOut = ref(false) // 是否被踢出

    // WebSocket 连接
    let ws: WebSocket | null = null
    let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
    let wsHeartbeatTimer: ReturnType<typeof setInterval> | null = null

    const isAuthenticated = computed(() => !!user.value)
    const nickname = computed(() => profile.value?.nickname || user.value?.email?.split('@')[0] || '用户')

    // 连接 WebSocket
    const connectWebSocket = () => {
        console.log('[WebSocket] 尝试连接...', { ws: !!ws, kickedOut: kickedOut.value })
        if (ws || kickedOut.value) {
            console.log('[WebSocket] 跳过连接: 已有连接或已被踢出')
            return
        }

        const token = api.getToken()
        console.log('[WebSocket] Token:', token ? '存在' : '不存在')
        if (!token) {
            console.log('[WebSocket] 跳过连接: 无 token')
            return
        }

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${location.host}/ws/session`
        console.log('[WebSocket] 连接地址:', wsUrl)

        try {
            ws = new WebSocket(wsUrl)
            console.log('[WebSocket] 创建连接实例')

            ws.onopen = () => {
                console.log('[WebSocket] 连接已打开')
                // 发送认证消息
                const authMsg = JSON.stringify({ type: 'auth', payload: { token } })
                console.log('[WebSocket] 发送认证消息')
                ws?.send(authMsg)
                // 启动心跳
                wsHeartbeatTimer = setInterval(() => {
                    ws?.send(JSON.stringify({ type: 'ping', payload: null }))
                }, 25000)
            }

            ws.onmessage = (e) => {
                console.log('[WebSocket] 收到消息:', e.data)
                try {
                    const msg = JSON.parse(e.data)

                    if (msg.type === 'pong') return

                    if (msg.type === 'kicked_out') {
                        console.log('[WebSocket] 收到踢出通知!', msg)
                        kickedOut.value = true
                        disconnectWebSocket()
                    }
                } catch (err) {
                    console.error('[WebSocket] 消息解析错误:', err)
                }
            }

            ws.onclose = (e) => {
                console.log('[WebSocket] 连接已关闭', { code: e.code, reason: e.reason })
                ws = null
                if (wsHeartbeatTimer) {
                    clearInterval(wsHeartbeatTimer)
                    wsHeartbeatTimer = null
                }
                // 如果不是被踢出，尝试重连
                if (!kickedOut.value && user.value) {
                    console.log('[WebSocket] 3秒后尝试重连...')
                    wsReconnectTimer = setTimeout(connectWebSocket, 3000)
                }
            }

            ws.onerror = (e) => {
                console.error('[WebSocket] 连接错误:', e)
            }
        } catch (err) {
            console.error('[WebSocket] 创建连接失败:', err)
        }
    }

    // 断开 WebSocket
    const disconnectWebSocket = () => {
        console.log('[WebSocket] 断开连接...')
        if (wsReconnectTimer) {
            clearTimeout(wsReconnectTimer)
            wsReconnectTimer = null
        }
        if (wsHeartbeatTimer) {
            clearInterval(wsHeartbeatTimer)
            wsHeartbeatTimer = null
        }
        if (ws) {
            ws.close()
            ws = null
        }
    }

    // 初始化：检查当前会话
    const init = async () => {
        loading.value = true
        kickedOut.value = false
        try {
            const { user: currentUser } = await api.getUser()
            if (currentUser) {
                user.value = currentUser as User
                await fetchProfile()
                // 登录成功后连接 WebSocket
                connectWebSocket()
            }
        } catch (error: any) {
            // 检查是否是被踢出
            if (error?.response?.data?.kicked) {
                kickedOut.value = true
            }
            // 未登录或 token 失效，清除本地状态
            console.log('用户未登录或会话已过期')
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
            console.error('获取用户配置失败:', error)
        }
    }

    // 获取头像 URL
    const fetchAvatarUrl = async () => {
        try {
            const result = await api.getAvatarUrl()
            avatarUrl.value = result.avatarUrl
        } catch (error) {
            console.error('获取头像URL失败:', error)
            avatarUrl.value = null
        }
    }

    // 设置头像 URL（本地更新）
    const setAvatarUrl = (url: string | null) => {
        avatarUrl.value = url
    }

    // 更新用户配置
    const updateProfile = async (updates: { nickname?: string }) => {
        if (!user.value) return

        if (updates.nickname) {
            const { profile: updatedProfile } = await api.updateProfile(updates.nickname)
            profile.value = updatedProfile
        }
    }

    // 注册
    const signUp = async (email: string, password: string, nickname?: string) => {
        const result = await api.signUp({
            email,
            password,
            nickname: nickname || email.split('@')[0]
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
            // 登录成功后连接 WebSocket
            connectWebSocket()
        }

        return result
    }

    // 登出
    const signOut = async () => {
        disconnectWebSocket()
        await api.signOut()
        user.value = null
        profile.value = null
        avatarUrl.value = null
        kickedOut.value = false
        loading.value = false // 确保 loading 为 false
    }

    // 只清除本地用户状态（不调用服务端 signOut）
    // 用于被踢出后的重新登录场景
    const clearUser = () => {
        disconnectWebSocket()
        api.setToken(null) // 只清除本地 token
        user.value = null
        profile.value = null
        avatarUrl.value = null
        loading.value = false
    }

    // 重置被踢出状态
    const resetKickedOut = () => {
        kickedOut.value = false
    }

    // 获取访问令牌
    const getAccessToken = () => {
        return localStorage.getItem('auth_token')
    }

    return {
        user,
        profile,
        avatarUrl,
        loading,
        isAuthenticated,
        nickname,
        kickedOut,
        init,
        fetchProfile,
        fetchAvatarUrl,
        setAvatarUrl,
        updateProfile,
        signUp,
        signIn,
        signOut,
        clearUser,
        getAccessToken,
        connectWebSocket,
        disconnectWebSocket,
        resetKickedOut
    }
})
