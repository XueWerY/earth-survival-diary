// API client - all requests go through the remote service

import { getApiBaseUrl, hydrateApiConfig, syncElectronApiConfig } from './apiBase'

export function getToken(): string | null {
    const token = localStorage.getItem('auth_token')
    syncElectronApiConfig()
    return token
}

export function setToken(token: string | null) {
    if (token) {
        localStorage.setItem('auth_token', token)
    } else {
        localStorage.removeItem('auth_token')
    }
    syncElectronApiConfig()
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await hydrateApiConfig()

    const token = getToken()
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    }
    if (token) headers['Authorization'] = 'Bearer ' + token

    const response = await fetch(getApiBaseUrl() + endpoint, { ...options, headers })
    const data = await response.json()
    if (!response.ok) {
        const error = new Error(data.error || 'HTTP ' + response.status) as any
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
        nickname?: string
        role?: string
        createdAt?: string
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

// 获取所有用户列表（无需登录）
export async function getUsers(): Promise<{ users: Array<{ email: string, nickname: string, createdAt: string }> }> {
    return request('/auth/users')
}

// 获取应用设置（无需登录）
export async function getAppSettings(): Promise<{ settings: Record<string, any> }> {
    return request('/auth/settings')
}

// 更新应用设置（无需登录）
export async function updateAppSetting(key: string, value: any): Promise<{ success: boolean }> {
    return request('/auth/settings', { method: 'POST', body: JSON.stringify({ key, value }) })
}

// 检查会话状态（用于单点登录检测）
export async function checkSession(): Promise<{ valid: boolean; kicked: boolean }> {
    return request('/auth/check-session', { method: 'POST' })
}

// ============ 用户配置 API ============

export interface Profile {
    id: string
    nickname: string
    birthday?: string
    phone?: string
    created_at?: string
    updated_at?: string
}

export async function getProfile(): Promise<{ profile: Profile }> {
    return request('/profile')
}

export async function updateProfile(data: { nickname?: string; birthday?: string; phone?: string }): Promise<{ profile: Profile }> {
    return request('/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
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
    content: string | null
    category: string | null
    created_at: string
    pinned?: boolean
    icon?: string | null
}

export interface TaskFormData {
    name: string
    date: string
    startTime?: string
    endTime?: string
    notes?: string
    content?: string
    category?: string
    pinned?: boolean
    icon?: string
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

export async function updateTask(id: string, data: Partial<TaskFormData & { completed?: boolean; pinned?: boolean }>): Promise<{ task: Task }> {
    return request(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteTask(id: string): Promise<{ success: boolean }> {
    return request(`/tasks/${id}`, { method: 'DELETE' })
}

// ============ 日记 API ============

export async function getDiaries(): Promise<{ tasks: Task[] }> {
    return request('/diaries')
}

export async function addDiary(data: TaskFormData): Promise<{ task: Task }> {
    return request('/diaries', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function updateDiary(id: string, data: Partial<TaskFormData & { completed?: boolean; pinned?: boolean }>): Promise<{ task: Task }> {
    return request(`/diaries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteDiary(id: string): Promise<{ success: boolean }> {
    return request(`/diaries/${id}`, { method: 'DELETE' })
}

// ============ 清单 API ============

export interface Group {
    id: string
    name: string
    color: string
    order: number
}

export interface List {
    id: string
    name: string
    icon: string
    created_at: string
    groups?: Group[]
    order?: number
}

export async function getLists(): Promise<{ lists: List[] }> {
    return request('/list-lists')
}

export async function addList(name: string, icon?: string): Promise<{ list: List }> {
    return request('/list-lists', {
        method: 'POST',
        body: JSON.stringify({ name, icon })
    })
}

export async function updateList(id: string, data: { name?: string; icon?: string }): Promise<{ list: List }> {
    return request(`/list-lists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteList(id: string, opts?: { deleteTasks?: boolean; transferToListId?: string }): Promise<{ success: boolean }> {
    return request(`/list-lists/${id}`, {
        method: 'DELETE',
        body: JSON.stringify(opts || {})
    })
}

export async function updateGroup(listId: string, groupId: string, data: { name?: string; color?: string; order?: number }): Promise<{ group: Group }> {
    return request(`/list-lists/${listId}/groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function addGroup(listId: string, data: { name: string; color: string; order: number }): Promise<{ group: Group }> {
    return request(`/list-lists/${listId}/groups`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function deleteGroup(listId: string, groupId: string, opts?: { deleteTasks?: boolean }): Promise<{ success: boolean }> {
    return request(`/list-lists/${listId}/groups/${groupId}`, {
        method: 'DELETE',
        body: JSON.stringify(opts || {})
    })
}

export async function reorderLists(orders: { id: string; order: number }[]): Promise<{ lists: List[] }> {
    return request('/list-lists/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders })
    })
}

export async function reorderGroups(listId: string, orders: { id: string; order: number }[]): Promise<{ groups: Group[] }> {
    return request(`/list-lists/${listId}/groups/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ orders })
    })
}

// ============ 任务 API ============

export interface ChecklistItem {
    id: string
    text: string
    completed: boolean
}

export interface ListTask {
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
    end_time?: string
    repeat_strategy?: string
    repeat_custom_days?: number
    repeat_lunar_month?: number
    repeat_lunar_day?: number
    repeat_end_strategy?: string
    repeat_end_date?: string
    repeat_count?: number
    repeat_completed_count?: number
    priority?: string
    checklist?: ChecklistItem[]
    linked_note_ids?: string[]
    completed_start_time?: string
    completed_end_time?: string
    notes?: string
    reminder_strategy?: string
    reminder_days?: number
    reminder_hours?: number
    reminder_minutes?: number
    updated_at?: string
}

export async function getListTasks(listId?: string): Promise<{ listTasks: ListTask[] }> {
    const query = listId ? `?listId=${listId}` : ''
    return request(`/list-tasks${query}`)
}

export interface AddListTaskData {
    listId: string
    name: string
    description?: string
    targetCount?: number
    groupId?: string
    date?: string
    endTime?: string
    repeatStrategy?: string
    repeatCustomDays?: number
    repeatWeekdays?: number[]
    repeatMonthDay?: number
    repeatLunarMonth?: number
    repeatLunarDay?: number
    repeatEndStrategy?: string
    repeatEndDate?: string
    repeatCount?: number
    priority?: string
    checklist?: ChecklistItem[]
    linkedNoteIds?: string[]
    notes?: string
    reminderStrategy?: string
    reminderDays?: number
    reminderHours?: number
    reminderMinutes?: number
}

export async function addListTask(data: AddListTaskData): Promise<{ listTask: ListTask }> {
    return request('/list-tasks', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export interface UpdateListTaskData {
    name?: string
    description?: string
    targetCount?: number
    currentCount?: number
    completed?: boolean
    groupId?: string
    date?: string
    endTime?: string
    repeatStrategy?: string
    repeatCustomDays?: number
    repeatWeekdays?: number[]
    repeatMonthDay?: number
    repeatLunarMonth?: number
    repeatLunarDay?: number
    repeatEndStrategy?: string
    repeatEndDate?: string
    repeatCount?: number
    repeatCompletedCount?: number
    priority?: string
    checklist?: ChecklistItem[]
    linkedNoteIds?: string[]
    completedStartTime?: string
    completedEndTime?: string
    notes?: string
    reminderStrategy?: string
    reminderDays?: number
    reminderHours?: number
    reminderMinutes?: number
}

export async function updateListTask(id: string, data: UpdateListTaskData): Promise<{ listTask: ListTask }> {
    return request(`/list-tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteListTask(id: string): Promise<{ success: boolean }> {
    return request(`/list-tasks/${id}`, { method: 'DELETE' })
}

// ============ 统计 API ============

export interface Stats {
    checklistCount: number
    listTaskCount: number
    footprintTaskCount: number
}

export async function getStats(): Promise<{ stats: Stats }> {
    return request('/stats')
}

// ============ 设置 API ============

export interface UserSettings {}

export const defaultSettings: UserSettings = {}

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

// ============ 账号管理 API ============

export async function deleteAccount(): Promise<{ success: boolean }> {
    return request('/auth/account', { method: 'DELETE' })
}

export async function clearAllData(): Promise<{ success: boolean }> {
    return request('/data/all', { method: 'DELETE' })
}

// ============ 导出/导入 API ============

export interface ExportData {
    profile?: any
    tasks?: any[]
    lists?: any[]
    tasks?: any[]
    settings?: any
    system_reminders?: any
    notes?: any[]
    notebooks?: any[]
    exportTime?: string
}

export async function exportData(): Promise<{ success: boolean; data: ExportData }> {
    return request('/export')
}

export async function importData(data: ExportData): Promise<{ success: boolean }> {
    return request('/import', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function cleanData(data: Record<string, null>): Promise<{ success: boolean }> {
    return request('/clean', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}
