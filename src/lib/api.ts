// API 客户端 - 所有请求通过后端代理

const API_BASE = '/api'

// 获取存储的 token
export function getToken(): string | null {
    return localStorage.getItem('auth_token')
}

// 保存 token
export function setToken(token: string | null) {
    if (token) {
        localStorage.setItem('auth_token', token)
    } else {
        localStorage.removeItem('auth_token')
    }
}

// 通用请求函数
async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken()

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    })

    const data = await response.json()

    if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status}`) as any
        error.response = { data }
        throw error
    }

    return data
}

// ============ 认证 API ============

export interface SignUpParams {
    email: string
    password: string
    nickname?: string
}

export interface SignInParams {
    email: string
    password: string
}

export interface AuthResponse {
    user: {
        id: string
        email: string
        user_metadata?: {
            nickname?: string
        }
    } | null
    session: {
        access_token: string
        refresh_token: string
        expires_at: number
    } | null
}

export async function signUp(params: SignUpParams): Promise<AuthResponse> {
    const result = await request<AuthResponse>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(params)
    })

    if (result.session?.access_token) {
        setToken(result.session.access_token)
    }

    return result
}

export async function signIn(params: SignInParams): Promise<AuthResponse> {
    const result = await request<AuthResponse>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify(params)
    })

    if (result.session?.access_token) {
        setToken(result.session.access_token)
    }

    return result
}

export async function signOut(): Promise<void> {
    await request('/auth/signout', { method: 'POST' })
    setToken(null)
}

export async function getUser(): Promise<{ user: AuthResponse['user'] }> {
    return request('/auth/user')
}

// 检查会话状态（用于单点登录检测）
export async function checkSession(): Promise<{ valid: boolean; kicked: boolean }> {
    return request('/auth/check-session', { method: 'POST' })
}

// ============ 用户配置 API ============

export interface Profile {
    id: string
    nickname: string
    avatar_url?: string
    created_at?: string
    updated_at?: string
}

export async function getProfile(): Promise<{ profile: Profile }> {
    return request('/profile')
}

export async function updateProfile(nickname: string): Promise<{ profile: Profile }> {
    return request('/profile', {
        method: 'PUT',
        body: JSON.stringify({ nickname })
    })
}

// ============ 任务 API ============

export interface Task {
    id: string
    name: string
    date: string
    startTime: string | null
    endTime: string | null
    duration: number
    completed: boolean
    notes: string | null
    category: string | null
    created_at: string
}

export interface TaskFormData {
    name: string
    date: string
    startTime?: string
    endTime?: string
    notes?: string
    category?: string
}

export async function getTasks(): Promise<{ tasks: Task[] }> {
    return request('/tasks')
}

export async function addTask(data: TaskFormData): Promise<{ task: Task }> {
    return request('/tasks', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function updateTask(id: string, data: Partial<TaskFormData & { completed?: boolean }>): Promise<{ task: Task }> {
    return request(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteTask(id: string): Promise<{ success: boolean }> {
    return request(`/tasks/${id}`, { method: 'DELETE' })
}

// ============ 使命列表 API ============

export interface MissionGroup {
    id: string
    name: string
    color: string
    order: number
}

export interface MissionList {
    id: string
    name: string
    icon: string
    created_at: string
    groups?: MissionGroup[]
    order?: number
}

export async function getMissionLists(): Promise<{ lists: MissionList[] }> {
    return request('/mission-lists')
}

export async function addMissionList(name: string, icon?: string): Promise<{ list: MissionList }> {
    return request('/mission-lists', {
        method: 'POST',
        body: JSON.stringify({ name, icon })
    })
}

export async function updateMissionList(id: string, data: { name?: string; icon?: string }): Promise<{ list: MissionList }> {
    return request(`/mission-lists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteMissionList(id: string): Promise<{ success: boolean }> {
    return request(`/mission-lists/${id}`, { method: 'DELETE' })
}

// ============ 使命 API ============

export interface ChecklistItem {
    id: string
    text: string
    completed: boolean
}

export interface Mission {
    id: string
    list_id: string
    name: string
    description: string | null
    target_count: number
    current_count: number
    completed: boolean
    created_at: string
    // 额外字段
    group_id?: string
    date?: string
    start_time?: string
    end_time?: string
    repeat_strategy?: string
    repeat_custom_days?: number
    repeat_end_strategy?: string
    repeat_end_date?: string
    repeat_count?: number
    repeat_completed_count?: number
    priority?: string
    checklist?: ChecklistItem[]
    completed_start_time?: string
    completed_end_time?: string
    notes?: string
    updated_at?: string
}

export async function getMissions(listId?: string): Promise<{ missions: Mission[] }> {
    const query = listId ? `?listId=${listId}` : ''
    return request(`/missions${query}`)
}

export interface AddMissionData {
    listId: string
    name: string
    description?: string
    targetCount?: number
    groupId?: string
    date?: string
    startTime?: string
    endTime?: string
    repeatStrategy?: string
    repeatCustomDays?: number
    repeatEndStrategy?: string
    repeatEndDate?: string
    repeatCount?: number
    priority?: string
    checklist?: ChecklistItem[]
    notes?: string
}

export async function addMission(data: AddMissionData): Promise<{ mission: Mission }> {
    return request('/missions', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export interface UpdateMissionData {
    name?: string
    description?: string
    targetCount?: number
    currentCount?: number
    completed?: boolean
    groupId?: string
    date?: string
    startTime?: string
    endTime?: string
    repeatStrategy?: string
    repeatCustomDays?: number
    repeatEndStrategy?: string
    repeatEndDate?: string
    repeatCount?: number
    repeatCompletedCount?: number
    priority?: string
    checklist?: ChecklistItem[]
    completedStartTime?: string
    completedEndTime?: string
    notes?: string
}

export async function updateMission(id: string, data: UpdateMissionData): Promise<{ mission: Mission }> {
    return request(`/missions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteMission(id: string): Promise<{ success: boolean }> {
    return request(`/missions/${id}`, { method: 'DELETE' })
}

// ============ 统计 API ============

export interface Stats {
    listCount: number
    missionCount: number
    taskCount: number
}

export async function getStats(): Promise<{ stats: Stats }> {
    return request('/stats')
}

// ============ 笔记分类 API ============

export interface NoteCategory {
    id: string
    name: string
    icon: string
    color: string
    created_at: string
}

export async function getNoteCategories(): Promise<{ categories: NoteCategory[] }> {
    return request('/note-categories')
}

export async function addNoteCategory(data: { name: string; icon?: string; color?: string }): Promise<{ category: NoteCategory }> {
    return request('/note-categories', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function updateNoteCategory(id: string, data: { name?: string; icon?: string; color?: string }): Promise<{ category: NoteCategory }> {
    return request(`/note-categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteNoteCategory(id: string): Promise<{ success: boolean }> {
    return request(`/note-categories/${id}`, { method: 'DELETE' })
}

// ============ 笔记 API ============

export interface Note {
    id: string
    category_id: string | null
    title: string
    content: string
    tags: string[]
    created_at: string
    updated_at: string
}

export interface NoteFormData {
    categoryId?: string | null
    title?: string
    content?: string
    tags?: string[]
}

export async function getNotes(params?: { categoryId?: string; search?: string }): Promise<{ notes: Note[] }> {
    const query = new URLSearchParams()
    if (params?.categoryId) query.append('categoryId', params.categoryId)
    if (params?.search) query.append('search', params.search)
    const queryString = query.toString()
    return request(`/notes${queryString ? `?${queryString}` : ''}`)
}

export async function getNote(id: string): Promise<{ note: Note }> {
    return request(`/notes/${id}`)
}

export async function addNote(data: NoteFormData): Promise<{ note: Note }> {
    return request('/notes', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function updateNote(id: string, data: NoteFormData): Promise<{ note: Note }> {
    return request(`/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteNote(id: string): Promise<{ success: boolean }> {
    return request(`/notes/${id}`, { method: 'DELETE' })
}

// ============ 倒数日 API ============

export interface Countdown {
    id: string
    name: string
    target_date: string
    icon?: string
    is_birthday?: boolean
    is_system?: boolean
    created_at: string
}

export interface CountdownFormData {
    name: string
    targetDate: string
    icon?: string
    is_birthday?: boolean
    is_system?: boolean
}

export async function getCountdowns(): Promise<{ countdowns: Countdown[] }> {
    return request('/countdowns')
}

export async function addCountdown(data: CountdownFormData): Promise<{ countdown: Countdown }> {
    return request('/countdowns', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function updateCountdown(id: string, data: Partial<CountdownFormData>): Promise<{ countdown: Countdown }> {
    return request(`/countdowns/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteCountdown(id: string): Promise<{ success: boolean }> {
    return request(`/countdowns/${id}`, { method: 'DELETE' })
}

// ============ 设置 API ============

export interface UserSettings {
    shortcuts: {
        inlineMath: string
        blockMath: string
        save: string
    }
}

export const defaultSettings: UserSettings = {
    shortcuts: {
        inlineMath: 'Ctrl+M',
        blockMath: 'Ctrl+Shift+M',
        save: 'Ctrl+S'
    }
}

export async function getSettings(): Promise<{ settings: UserSettings }> {
    return request('/settings')
}

export async function updateSettings(settings: Partial<UserSettings>): Promise<{ settings: UserSettings }> {
    return request('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
    })
}

// ============ 通用数据存储 API ============

export async function getData<T = any>(key: string): Promise<{ success: boolean; data: T | null }> {
    return request(`/data/${key}`)
}

export async function setData(key: string, data: any): Promise<{ success: boolean }> {
    return request(`/data/${key}`, {
        method: 'POST',
        body: JSON.stringify({ data })
    })
}

export async function deleteData(key: string): Promise<{ success: boolean }> {
    return request(`/data/${key}`, { method: 'DELETE' })
}

// ============ 头像上传 API ============

export interface UploadAvatarParams {
    fileData: string // base64 encoded
    fileName: string
    contentType: string
}

export async function uploadAvatar(params: UploadAvatarParams): Promise<{
    success: boolean
    avatarKey: string
    avatarUrl: string
}> {
    return request('/avatar/upload', {
        method: 'POST',
        body: JSON.stringify(params)
    })
}

export async function getAvatarUrl(): Promise<{ avatarUrl: string | null }> {
    return request('/avatar/url')
}

// ============ 账号安全 API ============

export async function changeEmail(newEmail: string, password: string): Promise<{ success: boolean }> {
    return request('/auth/change-email', {
        method: 'POST',
        body: JSON.stringify({ newEmail, password })
    })
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean }> {
    return request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
    })
}
