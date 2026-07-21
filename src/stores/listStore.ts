import { defineStore } from 'pinia'
import { ref } from 'vue'
import dayjs from 'dayjs'
import * as api from '../lib/api'
import { logger } from '../lib/logger'
import { getData, setData } from '../services/storageService'

export interface CompletedListRecord {
  taskId: string
  name: string
  listId: string
  completedDate: string
  completedTime: string
  priority: string
}

// 重复策略
export type RepeatStrategy = 'none' | 'daily' | 'custom_days' | 'weekly_select' | 'monthly_selected_day' | 'monthly_last_day' | 'lunar_date'

// 结束重复策略
export type RepeatEndStrategy = 'never' | 'date' | 'count'

// 优先级
export type Priority = 'none' | 'high' | 'medium' | 'low'

// 检查事项
export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

// 任务分组（在清单内部）
export interface Group {
  id: string
  name: string
  color: string
  order: number
}

// 提醒策略
export type ReminderStrategy = 'none' | 'on_time' | 'advance'

// 任务
export interface Task {
  id: string
  name: string
  listId: string
  groupId: string
  date: string
  endTime: string
  repeatStrategy: RepeatStrategy
  repeatCustomDays: number
  repeatWeekdays: number[]
  repeatMonthDay: number
  repeatLunarMonth: number
  repeatLunarDay: number
  repeatEndStrategy: RepeatEndStrategy
  repeatEndDate: string
  repeatCount: number
  repeatCompletedCount: number
  priority: Priority
  checklist: ChecklistItem[]
  completed: boolean
  completedStartTime: string
  completedEndTime: string
  notes: string
  reminderStrategy: ReminderStrategy
  reminderDays: number
  reminderHours: number
  reminderMinutes: number
  createdAt: string
  updatedAt: string
}

// 任务清单
export interface List {
  id: string
  name: string
  color: string
  groups: Group[]
  order: number
  createdAt: string
}

// 文件夹（客户端抽象层，包裹清单）
export interface Folder {
  id: string
  name: string
  type: 'smart' | 'custom'
  color: string
  listIds: string[]
  order: number
}

// 优先级配置
export const PRIORITIES = [
  { value: 'none', label: '⚪ 无', color: '#909399' },
  { value: 'high', label: '🔴 高', color: '#ef4444' },
  { value: 'medium', label: '🟡 中', color: '#f59e0b' },
  { value: 'low', label: '🟢 低', color: '#22c55e' }
] as const

// 重复策略配置
export const REPEAT_STRATEGIES = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'custom_days', label: '每隔 N 天' },
  { value: 'weekly_select', label: '每周选择' },
  { value: 'monthly_selected_day', label: '每月指定日期' },
  { value: 'monthly_last_day', label: '每月最后一天' },
  { value: 'lunar_date', label: '农历' },
] as const

// 结束重复策略配置
export const REPEAT_END_STRATEGIES = [
  { value: 'never', label: '永不结束' },
  { value: 'date', label: '指定日期' },
  { value: 'count', label: '指定次数' }
] as const

// 默认清单颜色
export const DEFAULT_LIST_COLORS = [
  '#667eea', '#f093fb', '#4facfe', '#43e97b',
  '#fa709a', '#fee140', '#a8edea', '#d299c2',
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'
]

// 默认分组颜色
export const DEFAULT_GROUP_COLORS = [
  '#667eea', '#f093fb', '#4facfe', '#43e97b',
  '#fa709a', '#fee140', '#a8edea', '#d299c2'
]

// 扩展颜色库（40色，用于文件夹/清单/分组颜色选择器）
export const EXTENDED_FOLDER_COLORS = [
  '#667eea', '#764ba2', '#f093fb', '#d53a9d', '#4facfe', '#00b4db', '#43e97b', '#11998e',
  '#fa709a', '#ee5a24', '#fee140', '#f6d365', '#a8edea', '#a18cd1', '#d299c2', '#fbc2eb',
  '#ff6b6b', '#4ecdc4', '#26d0ce', '#45b7d1', '#2b32b2', '#96ceb4', '#e1eec3', '#fc4a1a',
  '#f7b733', '#00b09b', '#96c93d', '#834d9b', '#d04ed6', '#2c3e50', '#3498db', '#e74c3c',
  '#f39c12', '#1abc9c', '#9b59b6', '#e67e22', '#2ecc71', '#e91e63', '#00bcd4', '#8e44ad',
]

// 默认文件夹颜色
export const DEFAULT_FOLDER_COLORS = [
  '#667eea', '#f093fb', '#4facfe', '#43e97b',
  '#fa709a', '#fee140', '#ae7ede', '#d299c2'
]

export const useListStore = defineStore('list', () => {
  const taskLists = ref<List[]>([])
  const lists = ref<Task[]>([])
  const folders = ref<Folder[]>([])
  const isLoaded = ref(false)

  const LS_GROUPS_KEY = 'esd_groups_backup'

  const saveCompletedRecord = async (task: Task) => {
    try {
      const records = await getData<CompletedListRecord[]>('list', 'completed') || []
      const now = dayjs().format('HH:mm:ss')
      records.push({
        taskId: task.id,
        name: task.name,
        listId: task.listId,
        completedDate: task.date,
        completedTime: now,
        priority: task.priority
      })
      await setData('list', 'completed', records)
    } catch {}
  }

  const saveGroupsLocal = () => {
    try {
      const data = taskLists.value.map(l => ({ id: l.id, groups: l.groups.map(g => ({ id: g.id, name: g.name, color: g.color, order: g.order })) }))
      localStorage.setItem(LS_GROUPS_KEY, JSON.stringify(data))
    } catch { /* 静默失败 */ }
  }

  const loadGroupsLocal = () => {
    try {
      const raw = localStorage.getItem(LS_GROUPS_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch { return null }
  }

  const saveFolders = async () => {
    try {
      await api.setData('list/folders', folders.value)
    } catch { /* 静默失败 */ }
  }

  const loadFolders = async () => {
    try {
      const result = await api.getData<Folder[]>('list/folders')
      if (result.success && result.data && Array.isArray(result.data)) {
        folders.value = result.data
      }
    } catch { /* 静默失败 */ }
  }

  const ensureAllListsInFolders = async () => {
    const customFolders = folders.value.filter(f => f.type === 'custom')
    const allAssignedIds = new Set<string>()
    customFolders.forEach(f => f.listIds.forEach(id => allAssignedIds.add(id)))
    const unassigned = taskLists.value.filter(l => !allAssignedIds.has(l.id))
    if (unassigned.length > 0 && customFolders.length > 0) {
      const defaultFolder = customFolders[0]
      defaultFolder.listIds.push(...unassigned.map(l => l.id))
      await saveFolders()
    }
  }

  // getUserId 不再需要，保留用于未来扩展
  // const getUserId = () => {
  //   const authStore = useAuthStore()
  //   return authStore.user?.id
  // }

  // 加载数据
  const loadData = async () => {
    if (isLoaded.value) {
      logger.debug('[ListStore] loadData 跳过（已加载）')
      return
    }
    logger.debug('[ListStore] loadData 开始')

    try {
      // 加载清单
      const { lists: dbLists } = await api.getLists()
      logger.debug('[ListStore] loadData 获取清单', { count: dbLists?.length })
      const localBackup = loadGroupsLocal()
      taskLists.value = dbLists.map(db => {
        const rawGroups = (db.groups && db.groups.length > 0) ? db.groups : [{
          id: `${db.id}-default`,
          name: '默认分组',
          color: DEFAULT_GROUP_COLORS[0],
          order: 0
        }]
        // 从本地备份恢复 order（当 API 数据缺失 order 时）
        const localList = localBackup?.find((l: any) => l.id === db.id)
        if (localList) {
          rawGroups.forEach((g: any) => {
            if (g.order == null) {
              const local = localList.groups.find((lg: any) => lg.id === g.id)
              if (local != null && local.order != null) g.order = local.order
            }
          })
        }
        rawGroups.sort((a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0))
        rawGroups.forEach((g: any, i: number) => { if (g.order == null) g.order = i })
        return {
          id: db.id,
          name: db.name,
          color: db.icon || '#667eea',
          groups: rawGroups,
          order: db.order || 0,
          createdAt: db.created_at
        }
      })

      saveGroupsLocal()

      // 加载任务 - 保留所有原始字段
      const { listTasks: dbTasks } = await api.getListTasks()
      lists.value = dbTasks.map(db => ({
        id: db.id,
        name: db.name,
        listId: db.list_id,
        groupId: db.group_id || '',
        date: db.date || '',
        endTime: db.end_time || '',
        repeatStrategy: (db.repeat_strategy || 'none') as RepeatStrategy,
        repeatCustomDays: db.repeat_custom_days || 1,
        repeatWeekdays: db.repeat_weekdays || [],
        repeatMonthDay: db.repeat_month_day || 1,
        repeatLunarMonth: db.repeat_lunar_month || 1,
        repeatLunarDay: db.repeat_lunar_day || 1,
        repeatEndStrategy: (db.repeat_end_strategy || 'never') as RepeatEndStrategy,
        repeatEndDate: db.repeat_end_date || '',
        repeatCount: db.repeat_count || 1,
        repeatCompletedCount: db.repeat_completed_count ?? db.current_count ?? 0,
        priority: (db.priority || 'none') as Priority,
        checklist: db.checklist || [],
        completed: db.completed,
        completedStartTime: db.completed_start_time || '',
        completedEndTime: db.completed_end_time || '',
        notes: db.notes || db.description || '',
        reminderStrategy: (db.reminder_strategy || 'none') as ReminderStrategy,
        reminderDays: db.reminder_days || 0,
        reminderHours: db.reminder_hours || 0,
        reminderMinutes: db.reminder_minutes || 0,
        createdAt: db.created_at,
        updatedAt: db.updated_at || db.created_at
      }))

      // 加载文件夹
      await loadFolders()

      // 如果没有文件夹，创建默认"我的清单"文件夹
      if (folders.value.length === 0) {
        const defaultFolder: Folder = {
          id: 'folder-' + Date.now(),
          name: '我的清单',
          type: 'custom',
          color: '#764ba2',
          listIds: taskLists.value.map(l => l.id),
          order: 0
        }
        folders.value.push(defaultFolder)
        await saveFolders()
      }

      // 确保所有清单都归属到某个文件夹
      await ensureAllListsInFolders()

      isLoaded.value = true
      logger.debug('[ListStore] loadData 完成', { listsCount: taskLists.value.length, tasksCount: lists.value.length, foldersCount: folders.value.length })
    } catch (error) {
      logger.error('[ListStore] loadData 失败', { error })
    }
  }

  // ========== 清单操作 ==========

  // 添加清单
  const addList = async (name: string, icon: string) => {
    try {
      const { list: dbList } = await api.addList(name, icon)
      const newList: List = {
        id: dbList.id,
        name: dbList.name,
        color: dbList.icon || icon,
        groups: [{
          id: `${dbList.id}-default`,
          name: '默认分组',
          color: DEFAULT_GROUP_COLORS[0],
          order: 0
        }],
        order: taskLists.value.length,
        createdAt: dbList.created_at
      }
      taskLists.value.push(newList)
      // 添加到默认文件夹
      const customFolders = folders.value.filter(f => f.type === 'custom')
      if (customFolders.length > 0) {
        customFolders[0].listIds.push(newList.id)
        await saveFolders()
      }
      return newList
    } catch (error) {
      console.error('Failed to add list:', error)
      return null
    }
  }

  // 更新清单
  const updateList = async (id: string, updates: { name?: string; color?: string }) => {
    try {
      const { list: dbList } = await api.updateList(id, {
        name: updates.name,
        icon: updates.color
      })
      const index = taskLists.value.findIndex(l => l.id === id)
      if (index !== -1) {
        taskLists.value[index] = {
          ...taskLists.value[index],
          name: dbList.name,
          color: dbList.icon
        }
      }
    } catch (error) {
      console.error('Failed to update list:', error)
    }
  }

  // 删除清单（同时删除该清单下的所有任务）
  const deleteList = async (id: string) => {
    try {
      await api.deleteList(id)
      lists.value = lists.value.filter(m => m.listId !== id)
      taskLists.value = taskLists.value.filter(l => l.id !== id)
      // 从所有文件夹中移除该清单
      folders.value.forEach(f => { f.listIds = f.listIds.filter(lid => lid !== id) })
      await saveFolders()
    } catch (error) {
      console.error('Failed to delete list:', error)
    }
  }

  // 上移清单
  const moveListUp = async (id: string) => {
    const index = taskLists.value.findIndex(l => l.id === id)
    if (index <= 0) return

    const prevItem = taskLists.value[index - 1]
    taskLists.value[index - 1] = taskLists.value[index]
    taskLists.value[index] = prevItem

    try {
      const orders = taskLists.value.map((l, i) => ({ id: l.id, order: i }))
      taskLists.value.forEach((l, i) => l.order = i)
      await api.reorderLists(orders)
    } catch (error) {
      console.error('Failed to reorder lists:', error)
    }
  }

  const moveListDown = async (id: string) => {
    const index = taskLists.value.findIndex(l => l.id === id)
    if (index < 0 || index >= taskLists.value.length - 1) return

    const nextItem = taskLists.value[index + 1]
    taskLists.value[index + 1] = taskLists.value[index]
    taskLists.value[index] = nextItem

    try {
      const orders = taskLists.value.map((l, i) => ({ id: l.id, order: i }))
      taskLists.value.forEach((l, i) => l.order = i)
      await api.reorderLists(orders)
    } catch (error) {
      console.error('Failed to reorder lists:', error)
    }
  }

  // ========== 文件夹操作（客户端层） ==========

  const addFolder = async (name: string, color: string): Promise<Folder> => {
    const newFolder: Folder = {
      id: 'folder-' + Date.now(),
      name,
      type: 'custom',
      color: color || DEFAULT_FOLDER_COLORS[folders.value.length % DEFAULT_FOLDER_COLORS.length],
      listIds: [],
      order: folders.value.filter(f => f.type === 'custom').length
    }
    folders.value.push(newFolder)
    await saveFolders()
    return newFolder
  }

  const updateFolder = async (id: string, updates: { name?: string; color?: string }) => {
    const folder = folders.value.find(f => f.id === id)
    if (!folder) return
    if (updates.name !== undefined) folder.name = updates.name
    if (updates.color !== undefined) folder.color = updates.color
    await saveFolders()
  }

  const deleteFolder = async (id: string) => {
    const folder = folders.value.find(f => f.id === id)
    if (!folder || folder.type === 'smart') return
    folders.value = folders.value.filter(f => f.id !== id)
    await saveFolders()
  }

  const addListToFolder = async (folderId: string, listId: string) => {
    const folder = folders.value.find(f => f.id === folderId)
    if (!folder) return
    if (!folder.listIds.includes(listId)) {
      folder.listIds.push(listId)
      await saveFolders()
    }
  }

  const removeListFromFolder = async (folderId: string, listId: string) => {
    const folder = folders.value.find(f => f.id === folderId)
    if (!folder) return
    folder.listIds = folder.listIds.filter(id => id !== listId)
    await saveFolders()
  }

  const getListsInFolder = (folderId: string): List[] => {
    if (folderId === 'smart') return [] // smart lists are virtual
    const folder = folders.value.find(f => f.id === folderId)
    if (!folder) return []
    return taskLists.value.filter(l => folder.listIds.includes(l.id))
  }

  // ========== 清单内分组操作 ==========

  // 添加分组到清单
  const addGroupToList = async (listId: string, name: string, color: string) => {
    const list = taskLists.value.find(l => l.id === listId)
    if (!list) return null

    try {
      const { group: dbGroup } = await api.addGroup(listId, {
        name,
        color,
        order: list.groups.length
      })
      
      const newGroup: Group = {
        id: dbGroup.id,
        name: dbGroup.name,
        color: dbGroup.color,
        order: dbGroup.order
      }

      list.groups.push(newGroup)
      saveGroupsLocal()
      return newGroup
    } catch (error) {
      console.error('Failed to add group:', error)
      return null
    }
  }

  // 更新清单内的分组
  const updateGroupInList = async (listId: string, groupId: string, updates: Partial<Omit<Group, 'id'>>) => {
    const list = taskLists.value.find(l => l.id === listId)
    if (!list) return

    const groupIndex = list.groups.findIndex(g => g.id === groupId)
    if (groupIndex === -1) return

    list.groups[groupIndex] = { ...list.groups[groupIndex], ...updates }

    try {
      await api.updateGroup(listId, groupId, updates)
    } catch (error) {
      console.error('Failed to update group:', error)
    }
  }

  // 上移分组
  const moveGroupUp = async (listId: string, groupId: string) => {
    const list = taskLists.value.find(l => l.id === listId)
    if (!list) return
    const index = list.groups.findIndex(g => g.id === groupId)
    if (index <= 0) return
    const item = list.groups.splice(index, 1)[0]
    list.groups.splice(index - 1, 0, item)
    list.groups.forEach((g, i) => { g.order = i })
    saveGroupsLocal()

    try {
      const orders = list.groups.map(g => ({ id: g.id, order: g.order }))
      console.log('[ListStore] moveGroupUp completed', { listId, groupId, fromIndex: index, toIndex: index - 1, orders })
      await api.reorderGroups(listId, orders)
    } catch (error) {
      console.error('[ListStore] moveGroupUp sync failed', error)
    }
  }

  // 下移分组
  const moveGroupDown = async (listId: string, groupId: string) => {
    const list = taskLists.value.find(l => l.id === listId)
    if (!list) return
    const index = list.groups.findIndex(g => g.id === groupId)
    if (index < 0 || index >= list.groups.length - 1) return
    const item = list.groups.splice(index, 1)[0]
    list.groups.splice(index + 1, 0, item)
    list.groups.forEach((g, i) => { g.order = i })
    saveGroupsLocal()

    try {
      const orders = list.groups.map(g => ({ id: g.id, order: g.order }))
      console.log('[ListStore] moveGroupDown completed', { listId, groupId, fromIndex: index, toIndex: index + 1, orders })
      await api.reorderGroups(listId, orders)
    } catch (error) {
      console.error('[ListStore] moveGroupDown sync failed', error)
    }
  }

  // 删除清单内的分组（任务移到默认分组）
  const deleteGroupFromList = async (listId: string, groupId: string) => {
    const list = taskLists.value.find(l => l.id === listId)
    if (!list || list.groups.length <= 1) return

    const defaultGroup = list.groups.find(g => g.id !== groupId)
    
    try {
      await api.deleteGroup(listId, groupId)
    } catch (error) {
      console.error('Failed to delete group:', error)
      return
    }

    list.groups = list.groups.filter(g => g.id !== groupId)
    list.groups.forEach((g, i) => { g.order = i })
    saveGroupsLocal()

    // 更新任务的分组
    if (defaultGroup) {
      lists.value.forEach(m => {
        if (m.listId === listId && m.groupId === groupId) {
          m.groupId = defaultGroup.id
        }
      })
    }
  }

  // 获取清单内的分组列表
  const getGroupsInList = (listId: string) => {
    const list = taskLists.value.find(l => l.id === listId)
    return list?.groups || []
  }

  // ========== 任务操作 ==========

  // 计算下一个重复日期
  const getNextRepeatDate = (currentDate: string, strategy: RepeatStrategy, customDays: number = 1, weekdays: number[] = [], monthDay: number = 1, lunarMonth: number = 1, lunarDay: number = 1): string => {
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
      case 'weekly_select': {
        if (weekdays.length === 0) return current.add(1, 'week').format('YYYY-MM-DD')
        const dayjsDay = current.day()
        const currentWeekday = (dayjsDay + 6) % 7
        const sorted = [...weekdays].sort((a, b) => a - b)
        const nextDay = sorted.find(d => d > currentWeekday)
        if (nextDay !== undefined) {
          const diff = nextDay - currentWeekday
          return current.add(diff, 'day').format('YYYY-MM-DD')
        }
        const diff = 7 - currentWeekday + sorted[0]
        return current.add(diff, 'day').format('YYYY-MM-DD')
      }
      case 'monthly':
        return current.add(1, 'month').format('YYYY-MM-DD')
      case 'monthly_selected_day': {
        let next = current.add(1, 'month')
        let attempts = 0
        while (monthDay > next.daysInMonth() && attempts < 12) {
          next = next.add(1, 'month')
          attempts++
        }
        const targetDay = Math.min(monthDay, next.daysInMonth())
        return next.date(targetDay).format('YYYY-MM-DD')
      }
      case 'monthly_last_day':
        return current.add(1, 'month').endOf('month').format('YYYY-MM-DD')
      case 'lunar_date': {
        try {
          const { Lunar } = require('lunar-javascript') as any
          const solar = require('lunar-javascript').Solar.fromYmd(current.year(), current.month() + 1, current.date())
          const currentLunar = solar.getLunar()
          let lunarYear = currentLunar.getYear()
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const targetLunar = Lunar.fromYmd(lunarYear + attempt, lunarMonth, lunarDay)
              const targetSolar = targetLunar.getSolar()
              const targetDate = dayjs(`${targetSolar.getYear()}-${String(targetSolar.getMonth()).padStart(2, '0')}-${String(targetSolar.getDay()).padStart(2, '0')}`)
              if (targetDate.isAfter(current)) {
                return targetDate.format('YYYY-MM-DD')
              }
            } catch {}
          }
          const nextLunar = Lunar.fromYmd(lunarYear + 1, lunarMonth, lunarDay)
          const nextSolar = nextLunar.getSolar()
          return `${nextSolar.getYear()}-${String(nextSolar.getMonth()).padStart(2, '0')}-${String(nextSolar.getDay()).padStart(2, '0')}`
        } catch {
          return currentDate
        }
      }
      case 'yearly':
        return current.add(1, 'year').format('YYYY-MM-DD')
      case 'custom_days':
        return current.add(customDays, 'day').format('YYYY-MM-DD')
      default:
        return currentDate
    }
  }

  // 检查下一个重复日期是否超过结束日期
  const isRepeatDateBeyondEndDate = (nextDate: string, repeatEndStrategy: RepeatEndStrategy, repeatEndDate: string, repeatCount: number, repeatCompletedCount: number): boolean => {
    if (repeatEndStrategy === 'never') return false
    if (repeatEndStrategy === 'date' && repeatEndDate) {
      return dayjs(nextDate).isAfter(dayjs(repeatEndDate), 'day')
    }
    if (repeatEndStrategy === 'count' && repeatCount) {
      return repeatCompletedCount >= repeatCount
    }
    return false
  }

  // 添加任务
  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'repeatCompletedCount'>) => {
    try {
      const { listTask: dbTask } = await api.addListTask({
        listId: task.listId,
        name: task.name,
        description: task.notes,
        targetCount: task.repeatCount || 1,
        groupId: task.groupId,
        date: task.date,
        endTime: task.endTime,
        repeatStrategy: task.repeatStrategy,
        repeatCustomDays: task.repeatCustomDays,
        repeatWeekdays: task.repeatWeekdays,
        repeatMonthDay: task.repeatMonthDay,
        repeatLunarMonth: task.repeatLunarMonth,
        repeatLunarDay: task.repeatLunarDay,
        repeatEndStrategy: task.repeatEndStrategy,
        repeatEndDate: task.repeatEndDate,
        repeatCount: task.repeatCount,
        priority: task.priority,
        checklist: task.checklist,
        notes: task.notes,
        reminderStrategy: task.reminderStrategy,
        reminderDays: task.reminderDays,
        reminderHours: task.reminderHours,
        reminderMinutes: task.reminderMinutes
      })

      const newTask: Task = {
        id: dbTask.id,
        name: dbTask.name,
        listId: dbTask.list_id,
        groupId: dbTask.group_id || '',
        date: dbTask.date || '',
        endTime: dbTask.end_time || '',
        repeatStrategy: (dbTask.repeat_strategy || 'none') as RepeatStrategy,
        repeatCustomDays: dbTask.repeat_custom_days || 1,
        repeatWeekdays: dbTask.repeat_weekdays || [],
        repeatMonthDay: dbTask.repeat_month_day || 1,
        repeatLunarMonth: dbTask.repeat_lunar_month || 1,
        repeatLunarDay: dbTask.repeat_lunar_day || 1,
        repeatEndStrategy: (dbTask.repeat_end_strategy || 'never') as RepeatEndStrategy,
        repeatEndDate: dbTask.repeat_end_date || '',
        repeatCount: dbTask.repeat_count || 1,
        repeatCompletedCount: dbTask.repeat_completed_count ?? dbTask.current_count ?? 0,
        priority: (dbTask.priority || 'none') as Priority,
        checklist: dbTask.checklist || [],
        completed: dbTask.completed,
        completedStartTime: dbTask.completed_start_time || '',
        completedEndTime: dbTask.completed_end_time || '',
        notes: dbTask.notes || dbTask.description || '',
        reminderStrategy: (dbTask.reminder_strategy || 'none') as ReminderStrategy,
        reminderDays: dbTask.reminder_days || 0,
        reminderHours: dbTask.reminder_hours || 0,
        reminderMinutes: dbTask.reminder_minutes || 0,
        createdAt: dbTask.created_at,
        updatedAt: dbTask.updated_at || dbTask.created_at
      }

      lists.value.unshift(newTask)
      return newTask
    } catch (error) {
      console.error('Failed to add task:', error)
      return null
    }
  }

  // 更新任务
  const updateTask = async (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const index = lists.value.findIndex(m => m.id === id)
    if (index === -1) return

    const task = lists.value[index]

    try {
      await api.updateListTask(id, {
        name: updates.name,
        description: updates.notes,
        repeatCompletedCount: updates.repeatCompletedCount,
        completed: updates.completed,
        groupId: updates.groupId,
        date: updates.date,
        endTime: updates.endTime,
        repeatStrategy: updates.repeatStrategy,
        repeatCustomDays: updates.repeatCustomDays,
        repeatWeekdays: updates.repeatWeekdays,
        repeatMonthDay: updates.repeatMonthDay,
        repeatLunarMonth: updates.repeatLunarMonth,
        repeatLunarDay: updates.repeatLunarDay,
        repeatEndStrategy: updates.repeatEndStrategy,
        repeatEndDate: updates.repeatEndDate,
        repeatCount: updates.repeatCount,
        priority: updates.priority,
        checklist: updates.checklist,
        completedStartTime: updates.completedStartTime,
        completedEndTime: updates.completedEndTime,
        notes: updates.notes,
        reminderStrategy: updates.reminderStrategy,
        reminderDays: updates.reminderDays,
        reminderHours: updates.reminderHours,
        reminderMinutes: updates.reminderMinutes
      })

      // 更新本地状态
      if (updates.name !== undefined) task.name = updates.name
      if (updates.groupId !== undefined) task.groupId = updates.groupId
      if (updates.date !== undefined) task.date = updates.date
      if (updates.endTime !== undefined) task.endTime = updates.endTime
      if (updates.repeatStrategy !== undefined) task.repeatStrategy = updates.repeatStrategy
      if (updates.repeatCustomDays !== undefined) task.repeatCustomDays = updates.repeatCustomDays
      if (updates.repeatWeekdays !== undefined) task.repeatWeekdays = updates.repeatWeekdays
      if (updates.repeatMonthDay !== undefined) task.repeatMonthDay = updates.repeatMonthDay
      if (updates.repeatLunarMonth !== undefined) task.repeatLunarMonth = updates.repeatLunarMonth
      if (updates.repeatLunarDay !== undefined) task.repeatLunarDay = updates.repeatLunarDay
      if (updates.repeatEndStrategy !== undefined) task.repeatEndStrategy = updates.repeatEndStrategy
      if (updates.repeatEndDate !== undefined) task.repeatEndDate = updates.repeatEndDate
      if (updates.repeatCount !== undefined) task.repeatCount = updates.repeatCount
      if (updates.repeatCompletedCount !== undefined) task.repeatCompletedCount = updates.repeatCompletedCount
      if (updates.priority !== undefined) task.priority = updates.priority
      if (updates.checklist !== undefined) task.checklist = updates.checklist
      if (updates.completed !== undefined) task.completed = updates.completed
      if (updates.completedStartTime !== undefined) task.completedStartTime = updates.completedStartTime
      if (updates.completedEndTime !== undefined) task.completedEndTime = updates.completedEndTime
      if (updates.notes !== undefined) task.notes = updates.notes
      if (updates.reminderStrategy !== undefined) task.reminderStrategy = updates.reminderStrategy
      if (updates.reminderDays !== undefined) task.reminderDays = updates.reminderDays
      if (updates.reminderHours !== undefined) task.reminderHours = updates.reminderHours
      if (updates.reminderMinutes !== undefined) task.reminderMinutes = updates.reminderMinutes
      task.updatedAt = new Date().toISOString()
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  // 删除任务
  const deleteTask = async (id: string) => {
    try {
      await api.deleteListTask(id)
      lists.value = lists.value.filter(m => m.id !== id)
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  // 完成任务
  const completeTask = async (id: string) => {
    const task = lists.value.find(m => m.id === id)
    if (!task) return

    await saveCompletedRecord(task)

    if (task.checklist.length > 0) {
      task.checklist.forEach(item => item.completed = true)
    }

    if (task.repeatStrategy !== 'none') {
      task.repeatCompletedCount++
      const baseDate = task.date || dayjs().format('YYYY-MM-DD')
      const nextDate = getNextRepeatDate(baseDate, task.repeatStrategy, task.repeatCustomDays, task.repeatWeekdays, task.repeatMonthDay, task.repeatLunarMonth, task.repeatLunarDay)

      if (isRepeatDateBeyondEndDate(nextDate, task.repeatEndStrategy, task.repeatEndDate, task.repeatCount, task.repeatCompletedCount)) {
        await deleteTask(id)
      } else {
        task.date = nextDate
        task.checklist.forEach(item => item.completed = false)
        await updateTask(id, {
          completed: false,
          repeatCompletedCount: task.repeatCompletedCount,
          checklist: task.checklist,
          date: task.date
        })
      }
    } else {
      await deleteTask(id)
    }
  }

  // 取消完成任务
  const uncompleteTask = async (id: string) => {
    await updateTask(id, { completed: false, completedStartTime: '', completedEndTime: '' })
  }

  // 切换任务完成状态（简化版，用于兼容）
  const toggleTask = (id: string) => {
    const task = lists.value.find(m => m.id === id)
    if (task) {
      if (task.completed) {
        uncompleteTask(id)
      }
    }
  }

  // 切换检查事项完成状态，返回是否触发了任务完成/进入下一轮
  const toggleChecklistItem = async (taskId: string, itemId: string): Promise<boolean> => {
    const task = lists.value.find(m => m.id === taskId)
    if (!task) return false

    const item = task.checklist.find(c => c.id === itemId)
    if (!item) return false

    // 切换完成状态
    item.completed = !item.completed

    if (task.repeatStrategy === 'none') {
      // 非重复性任务：所有检查事项完成后自动完成任务
      const allCompleted = task.checklist.length > 0 && task.checklist.every(c => c.completed)

      if (allCompleted) {
        // 记录完成记录，然后删除任务
        await saveCompletedRecord(task)
        task.checklist.forEach(c => c.completed = true)
        await deleteTask(taskId)
        return true
      } else {
        await updateTask(taskId, { checklist: task.checklist })
        return false
      }
    } else {
      // 重复性任务：所有检查事项完成后进入下一轮
      const allCompleted = task.checklist.length > 0 && task.checklist.every(c => c.completed)

      if (allCompleted) {
        task.repeatCompletedCount++
        const baseDate = task.date || dayjs().format('YYYY-MM-DD')
        const nextDate = getNextRepeatDate(baseDate, task.repeatStrategy, task.repeatCustomDays, task.repeatWeekdays, task.repeatMonthDay, task.repeatLunarMonth, task.repeatLunarDay)

        // 检查是否超过结束日期或次数
        if (isRepeatDateBeyondEndDate(nextDate, task.repeatEndStrategy, task.repeatEndDate, task.repeatCount, task.repeatCompletedCount)) {
          // 超过结束条件，直接删除
          await deleteTask(taskId)
        } else {
          task.date = nextDate
          task.checklist.forEach(c => c.completed = false)
          await updateTask(taskId, {
            completed: false,
            repeatCompletedCount: task.repeatCompletedCount,
            checklist: task.checklist,
            date: task.date
          })
        }
        return true
      } else {
        await updateTask(taskId, { checklist: task.checklist })
        return false
      }
    }
  }

  // 添加检查事项
  const addChecklistItem = async (taskId: string, text: string) => {
    const task = lists.value.find(m => m.id === taskId)
    if (!task) return

    task.checklist.push({
      id: Date.now().toString(),
      text,
      completed: false
    })

    await updateTask(taskId, { checklist: task.checklist })
  }

  // 删除检查事项
  const deleteChecklistItem = async (taskId: string, itemId: string) => {
    const task = lists.value.find(m => m.id === taskId)
    if (!task) return

    task.checklist = task.checklist.filter(c => c.id !== itemId)

    await updateTask(taskId, { checklist: task.checklist })
  }

  // 更新检查事项
  const updateChecklistItem = async (taskId: string, itemId: string, text: string) => {
    const task = lists.value.find(m => m.id === taskId)
    if (!task) return

    const item = task.checklist.find(c => c.id === itemId)
    if (!item) return

    item.text = text

    await updateTask(taskId, { checklist: task.checklist })
  }

  // 删除已完成的任务
  const deleteCompletedTasks = async (listId?: string) => {
    const toDelete = lists.value.filter(m => {
      if (!m.completed) return false
      if (listId && m.listId !== listId) return false
      return true
    })

    for (const task of toDelete) {
      await api.deleteListTask(task.id)
    }

    lists.value = lists.value.filter(m => {
      if (!m.completed) return true
      if (listId && m.listId !== listId) return true
      return false
    })
  }

  // 获取已完成任务的数量
  const getCompletedTasksCount = (listId?: string) => {
    if (listId) {
      return lists.value.filter(m => m.listId === listId && m.completed).length
    }
    return lists.value.filter(m => m.completed).length
  }

  // Reset store (used when logging out)
  const reset = () => {
    taskLists.value = []
    lists.value = []
    folders.value = []
    isLoaded.value = false
  }

  return {
    taskLists,
    lists,
    folders,
    isLoaded,
    loadData,
    addList,
    updateList,
    deleteList,
    moveListUp,
    moveListDown,
    addFolder,
    updateFolder,
    deleteFolder,
    addListToFolder,
    removeListFromFolder,
    getListsInFolder,
    addGroupToList,
    updateGroupInList,
    deleteGroupFromList,
    moveGroupUp,
    moveGroupDown,
    getGroupsInList,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    completeTask,
    uncompleteTask,
    toggleChecklistItem,
    addChecklistItem,
    deleteChecklistItem,
    updateChecklistItem,
    deleteCompletedTasks,
    getCompletedTasksCount,
    reset
  }
})
