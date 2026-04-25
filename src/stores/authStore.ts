import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '../lib/api'
import { logger } from '../lib/logger'

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

    // WebSocket 连接
    let ws: WebSocket | null = null
    let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
    let wsHeartbeatTimer: ReturnType<typeof setInterval> | null = null

    const isAuthenticated = computed(() => !!user.value)
    const nickname = computed(() => profile.value?.nickname || user.value?.email?.split('@')[0] || '用户')

    // 连接 WebSocket
    const connectWebSocket = () => {
        if (ws) return

        const token = api.getToken()
        if (!token) {
            logger.warn('[WebSocket] 跳过连接: 无 token')
            return
        }

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${location.host}/ws/session`
        logger.info('[WebSocket] 连接地址: ' + wsUrl)

        try {
            ws = new WebSocket(wsUrl)
            logger.debug('[WebSocket] 创建连接实例')

            ws.onopen = () => {
                logger.info('[WebSocket] 连接成功')
                const authMsg = JSON.stringify({ type: 'auth', payload: { token } })
                logger.info('[WebSocket] 发送认证消息')
                ws?.send(authMsg)
                wsHeartbeatTimer = setInterval(() => {
                    ws?.send(JSON.stringify({ type: 'ping', payload: null }))
                }, 25000)
            }

            let authPending = false

            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data)
                    if (msg.type === 'pong') {
                        if (authPending) {
                            logger.info('[WebSocket] 认证成功')
                            authPending = false
                        }
                        return
                    }
                    if (msg.type === 'kicked_out') {
                        logger.info('[WebSocket] 收到踢出通知', { message: msg.payload?.message })
                    }
                } catch (err) {
                    console.error('[WebSocket] 消息解析错误:', err)
                }
            }

            ws.onclose = (e) => {
                ws = null
                if (wsHeartbeatTimer) {
                    clearInterval(wsHeartbeatTimer)
                    wsHeartbeatTimer = null
                }
                if (authPending) {
                    logger.error('[WebSocket] 认证失败')
                    authPending = false
                }
                logger.info('[WebSocket] 连接已关闭', { code: e.code, reason: e.reason })
                if (user.value) {
                    wsReconnectTimer = setTimeout(connectWebSocket, 3000)
                }
            }

            ws.onerror = (e) => {
                logger.error('[WebSocket] 连接失败', { error: e })
            }
        } catch (err) {
            logger.error('[WebSocket] 创建连接失败', { error: err })
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
        try {
            const { user: currentUser } = await api.getUser()
            if (currentUser) {
                user.value = currentUser as User
                await fetchProfile()
                connectWebSocket()
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
            console.error('获取用户配置失败:', error)
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
            nickname: nickname || email.split('@')[0]
        })

        if (result.user) {
            user.value = result.user as User
            await fetchProfile()
            connectWebSocket()
        }

        return result
    }

    // 登录
    const signIn = async (email: string, password: string) => {
        const result = await api.signIn({ email, password })

        if (result.user) {
            user.value = result.user as User
            await fetchProfile()
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
        loading.value = false
    }

    // 只清除本地用户状态（不调用服务端 signOut）
    // 用于被踢出后的重新登录场景
    const clearUser = () => {
        disconnectWebSocket()
        api.setToken(null) // 只清除本地 token
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
        getAccessToken,
        connectWebSocket,
        disconnectWebSocket
    }
})
