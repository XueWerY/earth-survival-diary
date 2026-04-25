import { defineStore } from 'pinia'
import { ref } from 'vue'
import dayjs from 'dayjs'
import * as api from '../lib/api'

// 重复策略
export type RepeatStrategy = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom_days' | 'weekdays'

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
export interface MissionGroup {
  id: string
  name: string
  color: string
  order: number
}

// 任务
export interface Mission {
  id: string
  name: string
  listId: string
  groupId: string
  date: string
  startTime: string
  endTime: string
  repeatStrategy: RepeatStrategy
  repeatCustomDays: number
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
  createdAt: string
  updatedAt: string
}

// 任务清单
export interface MissionList {
  id: string
  name: string
  color: string
  groups: MissionGroup[]
  order: number
  createdAt: string
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
  { value: 'weekdays', label: '工作日（周一到周五）' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
  { value: 'custom_days', label: '每隔n天' }
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

export const useMissionStore = defineStore('mission', () => {
  const lists = ref<MissionList[]>([])
  const missions = ref<Mission[]>([])
  const isLoaded = ref(false)

  // getUserId 不再需要，保留用于未来扩展
  // const getUserId = () => {
  //   const authStore = useAuthStore()
  //   return authStore.user?.id
  // }

  // 加载数据
  const loadData = async () => {
    if (isLoaded.value) return

    try {
      // 加载清单
      const { lists: dbLists } = await api.getMissionLists()
      lists.value = dbLists.map(db => ({
        id: db.id,
        name: db.name,
        color: db.icon || '#667eea',
        groups: (db.groups && db.groups.length > 0) ? db.groups : [{
          id: `${db.id}-default`,
          name: '默认分组',
          color: DEFAULT_GROUP_COLORS[0],
          order: 0
        }],
        order: db.order || 0,
        createdAt: db.created_at
      }))

      // 加载使命 - 保留所有原始字段
      const { missions: dbMissions } = await api.getMissions()
      missions.value = dbMissions.map(db => ({
        id: db.id,
        name: db.name,
        listId: db.list_id,
        groupId: db.group_id || '',
        date: db.date || '',
        startTime: db.start_time || '',
        endTime: db.end_time || '',
        repeatStrategy: (db.repeat_strategy || 'none') as RepeatStrategy,
        repeatCustomDays: db.repeat_custom_days || 1,
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
        createdAt: db.created_at,
        updatedAt: db.updated_at || db.created_at
      }))

      // 如果没有清单，创建默认清单
      if (lists.value.length === 0) {
        await addList('我的任务', '📋')
      }

      isLoaded.value = true
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  // ========== 清单操作 ==========

  // 添加清单
  const addList = async (name: string, icon: string) => {
    try {
      const { list: dbList } = await api.addMissionList(name, icon)
      const newList: MissionList = {
        id: dbList.id,
        name: dbList.name,
        color: dbList.icon || icon,
        groups: [{
          id: `${dbList.id}-default`,
          name: '默认分组',
          color: DEFAULT_GROUP_COLORS[0],
          order: 0
        }],
        order: lists.value.length,
        createdAt: dbList.created_at
      }
      lists.value.push(newList)
      return newList
    } catch (error) {
      console.error('Failed to add list:', error)
      return null
    }
  }

  // 更新清单
  const updateList = async (id: string, updates: { name?: string; color?: string }) => {
    try {
      const { list: dbList } = await api.updateMissionList(id, {
        name: updates.name,
        icon: updates.color
      })
      const index = lists.value.findIndex(l => l.id === id)
      if (index !== -1) {
        lists.value[index] = {
          ...lists.value[index],
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
      await api.deleteMissionList(id)
      missions.value = missions.value.filter(m => m.listId !== id)
      lists.value = lists.value.filter(l => l.id !== id)
    } catch (error) {
      console.error('Failed to delete list:', error)
    }
  }

  // 上移清单
  const moveListUp = async (id: string) => {
    const index = lists.value.findIndex(l => l.id === id)
    if (index <= 0) return

    const prevItem = lists.value[index - 1]
    lists.value[index - 1] = lists.value[index]
    lists.value[index] = prevItem

    try {
      const orders = lists.value.map((l, i) => ({ id: l.id, order: i }))
      lists.value.forEach((l, i) => l.order = i)
      await api.reorderMissionLists(orders)
    } catch (error) {
      console.error('Failed to reorder lists:', error)
    }
  }

  const moveListDown = async (id: string) => {
    const index = lists.value.findIndex(l => l.id === id)
    if (index < 0 || index >= lists.value.length - 1) return

    const nextItem = lists.value[index + 1]
    lists.value[index + 1] = lists.value[index]
    lists.value[index] = nextItem

    try {
      const orders = lists.value.map((l, i) => ({ id: l.id, order: i }))
      lists.value.forEach((l, i) => l.order = i)
      await api.reorderMissionLists(orders)
    } catch (error) {
      console.error('Failed to reorder lists:', error)
    }
  }

  // ========== 清单内分组操作 ==========

  // 添加分组到清单
  const addGroupToList = async (listId: string, name: string, color: string) => {
    const list = lists.value.find(l => l.id === listId)
    if (!list) return null

    try {
      const { group: dbGroup } = await api.addMissionGroup(listId, {
        name,
        color,
        order: list.groups.length
      })
      
      const newGroup: MissionGroup = {
        id: dbGroup.id,
        name: dbGroup.name,
        color: dbGroup.color,
        order: dbGroup.order
      }

      list.groups.push(newGroup)
      return newGroup
    } catch (error) {
      console.error('Failed to add group:', error)
      return null
    }
  }

  // 更新清单内的分组
  const updateGroupInList = async (listId: string, groupId: string, updates: Partial<Omit<MissionGroup, 'id'>>) => {
    const list = lists.value.find(l => l.id === listId)
    if (!list) return

    const groupIndex = list.groups.findIndex(g => g.id === groupId)
    if (groupIndex === -1) return

    list.groups[groupIndex] = { ...list.groups[groupIndex], ...updates }

    try {
      await api.updateMissionGroup(listId, groupId, updates)
    } catch (error) {
      console.error('Failed to update group:', error)
    }
  }

  // 上移分组
  const moveGroupUp = async (listId: string, groupId: string) => {
    const list = lists.value.find(l => l.id === listId)
    if (!list) return
    const index = list.groups.findIndex(g => g.id === groupId)
    if (index <= 0) return
    const temp = list.groups[index].order
    list.groups[index].order = list.groups[index - 1].order
    list.groups[index - 1].order = temp
    list.groups.sort((a, b) => a.order - b.order)

    try {
      const orders = list.groups.map(g => ({ id: g.id, order: g.order }))
      await api.reorderGroups(listId, orders)
    } catch (error) {
      console.error('Failed to reorder groups:', error)
    }
  }

  // 下移分组
  const moveGroupDown = async (listId: string, groupId: string) => {
    const list = lists.value.find(l => l.id === listId)
    if (!list) return
    const index = list.groups.findIndex(g => g.id === groupId)
    if (index < 0 || index >= list.groups.length - 1) return
    const temp = list.groups[index].order
    list.groups[index].order = list.groups[index + 1].order
    list.groups[index + 1].order = temp
    list.groups.sort((a, b) => a.order - b.order)

    try {
      const orders = list.groups.map(g => ({ id: g.id, order: g.order }))
      await api.reorderGroups(listId, orders)
    } catch (error) {
      console.error('Failed to reorder groups:', error)
    }
  }

  // 删除清单内的分组（任务移到默认分组）
  const deleteGroupFromList = async (listId: string, groupId: string) => {
    const list = lists.value.find(l => l.id === listId)
    if (!list || list.groups.length <= 1) return

    const defaultGroup = list.groups.find(g => g.id !== groupId)
    
    try {
      await api.deleteMissionGroup(listId, groupId)
    } catch (error) {
      console.error('Failed to delete group:', error)
      return
    }

    list.groups = list.groups.filter(g => g.id !== groupId)

    // 更新使命的分组
    if (defaultGroup) {
      missions.value.forEach(m => {
        if (m.listId === listId && m.groupId === groupId) {
          m.groupId = defaultGroup.id
        }
      })
    }
  }

  // 获取清单内的分组列表
  const getGroupsInList = (listId: string) => {
    const list = lists.value.find(l => l.id === listId)
    return list?.groups || []
  }

  // ========== 任务操作 ==========

  // 计算下一个重复日期
  const getNextRepeatDate = (currentDate: string, strategy: RepeatStrategy, customDays: number = 1): string => {
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
        return current.add(1, 'week').format('YYYY-MM-DD')
      case 'monthly':
        return current.add(1, 'month').format('YYYY-MM-DD')
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
      return repeatCompletedCount + 1 >= repeatCount
    }
    return false
  }

  // 添加任务
  const addMission = async (mission: Omit<Mission, 'id' | 'createdAt' | 'updatedAt' | 'repeatCompletedCount'>) => {
    try {
      const { mission: dbMission } = await api.addMission({
        listId: mission.listId,
        name: mission.name,
        description: mission.notes,
        targetCount: mission.repeatCount || 1,
        groupId: mission.groupId,
        date: mission.date,
        startTime: mission.startTime,
        endTime: mission.endTime,
        repeatStrategy: mission.repeatStrategy,
        repeatCustomDays: mission.repeatCustomDays,
        repeatEndStrategy: mission.repeatEndStrategy,
        repeatEndDate: mission.repeatEndDate,
        repeatCount: mission.repeatCount,
        priority: mission.priority,
        checklist: mission.checklist,
        notes: mission.notes
      })

      const newMission: Mission = {
        id: dbMission.id,
        name: dbMission.name,
        listId: dbMission.list_id,
        groupId: dbMission.group_id || '',
        date: dbMission.date || '',
        startTime: dbMission.start_time || '',
        endTime: dbMission.end_time || '',
        repeatStrategy: (dbMission.repeat_strategy || 'none') as RepeatStrategy,
        repeatCustomDays: dbMission.repeat_custom_days || 1,
        repeatEndStrategy: (dbMission.repeat_end_strategy || 'never') as RepeatEndStrategy,
        repeatEndDate: dbMission.repeat_end_date || '',
        repeatCount: dbMission.repeat_count || 1,
        repeatCompletedCount: dbMission.repeat_completed_count ?? dbMission.current_count ?? 0,
        priority: (dbMission.priority || 'none') as Priority,
        checklist: dbMission.checklist || [],
        completed: dbMission.completed,
        completedStartTime: dbMission.completed_start_time || '',
        completedEndTime: dbMission.completed_end_time || '',
        notes: dbMission.notes || dbMission.description || '',
        createdAt: dbMission.created_at,
        updatedAt: dbMission.updated_at || dbMission.created_at
      }

      missions.value.unshift(newMission)
      return newMission
    } catch (error) {
      console.error('Failed to add mission:', error)
      return null
    }
  }

  // 更新任务
  const updateMission = async (id: string, updates: Partial<Omit<Mission, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const index = missions.value.findIndex(m => m.id === id)
    if (index === -1) return

    const mission = missions.value[index]

    try {
      await api.updateMission(id, {
        name: updates.name,
        description: updates.notes,
        currentCount: updates.repeatCompletedCount,
        completed: updates.completed,
        groupId: updates.groupId,
        date: updates.date,
        startTime: updates.startTime,
        endTime: updates.endTime,
        repeatStrategy: updates.repeatStrategy,
        repeatCustomDays: updates.repeatCustomDays,
        repeatEndStrategy: updates.repeatEndStrategy,
        repeatEndDate: updates.repeatEndDate,
        repeatCount: updates.repeatCount,
        priority: updates.priority,
        checklist: updates.checklist,
        completedStartTime: updates.completedStartTime,
        completedEndTime: updates.completedEndTime,
        notes: updates.notes
      })

      // 更新本地状态
      if (updates.name !== undefined) mission.name = updates.name
      if (updates.groupId !== undefined) mission.groupId = updates.groupId
      if (updates.date !== undefined) mission.date = updates.date
      if (updates.startTime !== undefined) mission.startTime = updates.startTime
      if (updates.endTime !== undefined) mission.endTime = updates.endTime
      if (updates.repeatStrategy !== undefined) mission.repeatStrategy = updates.repeatStrategy
      if (updates.repeatCustomDays !== undefined) mission.repeatCustomDays = updates.repeatCustomDays
      if (updates.repeatEndStrategy !== undefined) mission.repeatEndStrategy = updates.repeatEndStrategy
      if (updates.repeatEndDate !== undefined) mission.repeatEndDate = updates.repeatEndDate
      if (updates.repeatCount !== undefined) mission.repeatCount = updates.repeatCount
      if (updates.repeatCompletedCount !== undefined) mission.repeatCompletedCount = updates.repeatCompletedCount
      if (updates.priority !== undefined) mission.priority = updates.priority
      if (updates.checklist !== undefined) mission.checklist = updates.checklist
      if (updates.completed !== undefined) mission.completed = updates.completed
      if (updates.completedStartTime !== undefined) mission.completedStartTime = updates.completedStartTime
      if (updates.completedEndTime !== undefined) mission.completedEndTime = updates.completedEndTime
      if (updates.notes !== undefined) mission.notes = updates.notes
      mission.updatedAt = new Date().toISOString()
    } catch (error) {
      console.error('Failed to update mission:', error)
    }
  }

  // 删除任务
  const deleteMission = async (id: string) => {
    try {
      await api.deleteMission(id)
      missions.value = missions.value.filter(m => m.id !== id)
    } catch (error) {
      console.error('Failed to delete mission:', error)
    }
  }

  // 完成使命
  const completeMission = async (id: string) => {
    const mission = missions.value.find(m => m.id === id)
    if (!mission) return

    // 如果有检查事项，自动完成所有检查事项
    if (mission.checklist.length > 0) {
      mission.checklist.forEach(item => item.completed = true)
    }

    if (mission.repeatStrategy !== 'none') {
      // 重复性使命：完成一轮后自动进入下一轮
      mission.repeatCompletedCount++
      const baseDate = mission.date || dayjs().format('YYYY-MM-DD')
      const nextDate = getNextRepeatDate(baseDate, mission.repeatStrategy, mission.repeatCustomDays)

      // 检查是否超过结束日期或次数
      if (isRepeatDateBeyondEndDate(nextDate, mission.repeatEndStrategy, mission.repeatEndDate, mission.repeatCount, mission.repeatCompletedCount)) {
        // 超过结束条件，直接删除
        await deleteMission(id)
      } else {
        mission.date = nextDate
        mission.checklist.forEach(item => item.completed = false)
        await updateMission(id, {
          completed: false,
          repeatCompletedCount: mission.repeatCompletedCount,
          checklist: mission.checklist,
          date: mission.date
        })
      }
    } else {
      // 非重复性使命：直接删除
      await deleteMission(id)
    }
  }

  // 取消完成使命
  const uncompleteMission = async (id: string) => {
    await updateMission(id, { completed: false, completedStartTime: '', completedEndTime: '' })
  }

  // 切换任务完成状态（简化版，用于兼容）
  const toggleMission = (id: string) => {
    const mission = missions.value.find(m => m.id === id)
    if (mission) {
      if (mission.completed) {
        uncompleteMission(id)
      }
    }
  }

  // 切换检查事项完成状态
  const toggleChecklistItem = async (missionId: string, itemId: string) => {
    const mission = missions.value.find(m => m.id === missionId)
    if (!mission) return

    const item = mission.checklist.find(c => c.id === itemId)
    if (!item) return

    // 切换完成状态
    item.completed = !item.completed

    if (mission.repeatStrategy === 'none') {
      // 非重复性使命：完成检查事项后立即删除该检查事项
      if (item.completed) {
        // 先保存状态用于判断
        const remainingCount = mission.checklist.filter(c => c.id !== itemId).length

        // 删除已完成的检查事项
        mission.checklist = mission.checklist.filter(c => c.id !== itemId)

        if (remainingCount === 0) {
          // 没有更多检查事项了，删除整个使命
          await deleteMission(missionId)
        } else {
          // 还有其他检查事项，保存更新
          await updateMission(missionId, { checklist: mission.checklist })
        }
      } else {
        // 取消完成，直接保存
        await updateMission(missionId, { checklist: mission.checklist })
      }
    } else {
      // 重复性使命：所有检查事项完成后进入下一轮
      const allCompleted = mission.checklist.length > 0 && mission.checklist.every(c => c.completed)

      if (allCompleted) {
        mission.repeatCompletedCount++
        const baseDate = mission.date || dayjs().format('YYYY-MM-DD')
        const nextDate = getNextRepeatDate(baseDate, mission.repeatStrategy, mission.repeatCustomDays)

        // 检查是否超过结束日期或次数
        if (isRepeatDateBeyondEndDate(nextDate, mission.repeatEndStrategy, mission.repeatEndDate, mission.repeatCount, mission.repeatCompletedCount)) {
          // 超过结束条件，直接删除
          await deleteMission(missionId)
        } else {
          mission.date = nextDate
          mission.checklist.forEach(c => c.completed = false)
          await updateMission(missionId, {
            completed: false,
            repeatCompletedCount: mission.repeatCompletedCount,
            checklist: mission.checklist,
            date: mission.date
          })
        }
      } else {
        await updateMission(missionId, { checklist: mission.checklist })
      }
    }
  }

  // 添加检查事项
  const addChecklistItem = async (missionId: string, text: string) => {
    const mission = missions.value.find(m => m.id === missionId)
    if (!mission) return

    mission.checklist.push({
      id: Date.now().toString(),
      text,
      completed: false
    })

    await updateMission(missionId, { checklist: mission.checklist })
  }

  // 删除检查事项
  const deleteChecklistItem = async (missionId: string, itemId: string) => {
    const mission = missions.value.find(m => m.id === missionId)
    if (!mission) return

    mission.checklist = mission.checklist.filter(c => c.id !== itemId)

    await updateMission(missionId, { checklist: mission.checklist })
  }

  // 更新检查事项
  const updateChecklistItem = async (missionId: string, itemId: string, text: string) => {
    const mission = missions.value.find(m => m.id === missionId)
    if (!mission) return

    const item = mission.checklist.find(c => c.id === itemId)
    if (!item) return

    item.text = text

    await updateMission(missionId, { checklist: mission.checklist })
  }

  // 删除已完成的使命
  const deleteCompletedMissions = async (listId?: string) => {
    const toDelete = missions.value.filter(m => {
      if (!m.completed) return false
      if (listId && m.listId !== listId) return false
      return true
    })

    for (const mission of toDelete) {
      await api.deleteMission(mission.id)
    }

    missions.value = missions.value.filter(m => {
      if (!m.completed) return true
      if (listId && m.listId !== listId) return true
      return false
    })
  }

  // 获取已完成使命的数量
  const getCompletedMissionsCount = (listId?: string) => {
    if (listId) {
      return missions.value.filter(m => m.listId === listId && m.completed).length
    }
    return missions.value.filter(m => m.completed).length
  }

  // Reset store (used when logging out)
  const reset = () => {
    lists.value = []
    missions.value = []
    isLoaded.value = false
  }

  return {
    lists,
    missions,
    isLoaded,
    loadData,
    addList,
    updateList,
    deleteList,
    moveListUp,
    moveListDown,
    addGroupToList,
    updateGroupInList,
    deleteGroupFromList,
    moveGroupUp,
    moveGroupDown,
    getGroupsInList,
    addMission,
    updateMission,
    deleteMission,
    toggleMission,
    completeMission,
    uncompleteMission,
    toggleChecklistItem,
    addChecklistItem,
    deleteChecklistItem,
    updateChecklistItem,
    deleteCompletedMissions,
    getCompletedMissionsCount,
    reset
  }
})
