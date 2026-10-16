import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import * as api from '../lib/api'
import { logger } from '../lib/logger'

// 前端任务类型
export interface Task {
  id: string
  name: string
  startTime: string
  endTime: string
  date: string
  completed: boolean
  duration: number // in minutes
  notes?: string
  content?: string
  category?: string
  createdAt?: string
  isDiary?: boolean
  pinned?: boolean
  icon?: string
}

// 转换数据库任务到前端任务
const dbToTask = (dbTask: api.Task): Task => ({
  id: dbTask.id,
  name: dbTask.name,
  startTime: dbTask.startTime || '',
  endTime: dbTask.endTime || '',
  date: dbTask.date,
  completed: dbTask.completed,
  duration: dbTask.duration,
  notes: dbTask.notes || undefined,
  content: dbTask.content || undefined,
  category: dbTask.category || undefined,
  createdAt: dbTask.created_at,
  isDiary: dbTask.category === 'diary',
  pinned: dbTask.pinned,
  icon: dbTask.icon || undefined
})

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoaded = ref(false)

  // Load tasks from API
  const loadTasks = async () => {
    if (isLoaded.value) return

    try {
      const [footprintRes, diaryRes] = await Promise.all([
        api.getTasks(),
        api.getDiaries()
      ])
      const footprintTasks = footprintRes.tasks.map(dbToTask)
      const diaryTasks = diaryRes.tasks.map(dbToTask)
      tasks.value = [...footprintTasks, ...diaryTasks]
      isLoaded.value = true
    } catch (error) {
      logger.error('[Data] 加载足迹和日记失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  // Calculate duration in minutes
  const calculateDuration = (startTime: string, endTime: string): number => {
    const start = dayjs(`2000-01-01 ${startTime}`)
    const end = dayjs(`2000-01-01 ${endTime}`)
    return end.diff(start, 'minute')
  }

  // Add a new task
  const addTask = async (task: Omit<Task, 'id' | 'duration' | 'completed'>): Promise<Task | null> => {
    try {
      const duration = calculateDuration(task.startTime, task.endTime)
      const apiCall = task.category === 'diary' ? api.addDiary : api.addTask
      const { task: dbTask } = await apiCall({
        name: task.name,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        notes: task.notes,
        content: task.content,
        category: task.category,
        icon: task.icon,
        pinned: (task as any).pinned
      })
      const createdTask = { ...dbToTask(dbTask), duration }
      tasks.value.unshift(createdTask)
      return createdTask
    } catch (error) {
      const isDiary = task.category === 'diary'
      logger.error(isDiary ? '[Diary] 新增日记失败' : '[Footprint] 新增足迹失败', {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  // Add a completed task (used when list is completed)
  const addCompletedTask = async (task: Task) => {
    try {
      const duration = calculateDuration(task.startTime, task.endTime)
      const { task: dbTask } = await api.addTask({
        name: task.name,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        notes: task.notes,
        content: task.content,
        category: task.category
      })
      tasks.value.unshift({ ...dbToTask(dbTask), duration, completed: true })
    } catch (error) {
      logger.error('[Footprint] 添加已完成足迹失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  // 添加分割后的跨日任务（支持多条记录）
  const addSplitTasks = async (splitTasks: Array<{ name: string; startTime: string; endTime: string; date: string; duration: number; notes?: string }>) => {
    for (const task of splitTasks) {
      try {
        const { task: dbTask } = await api.addTask({
          name: task.name,
          date: task.date,
          startTime: task.startTime,
          endTime: task.endTime,
          notes: task.notes,
          category: 'focus'
        })
        tasks.value.unshift({ ...dbToTask(dbTask), duration: task.duration })
      } catch (error) {
        logger.error('[Footprint] 添加分段足迹失败', { error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  // Update a task
  const updateTask = async (id: string, updates: Partial<Omit<Task, 'id'>>) => {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index === -1) return

    try {
      const isDiary = tasks.value[index].isDiary
      const apiCall = isDiary ? api.updateDiary : api.updateTask
      const { task: dbTask } = await apiCall(id, {
        name: updates.name,
        date: updates.date,
        startTime: updates.startTime,
        endTime: updates.endTime,
        notes: updates.notes,
        content: updates.content,
        category: updates.category,
        icon: updates.icon,
        completed: updates.completed,
        pinned: updates.pinned
      })
      tasks.value[index] = dbToTask(dbTask)
    } catch (error) {
      const isDiary = tasks.value[index].isDiary || tasks.value[index].category === 'diary'
      logger.error(isDiary ? '[Diary] 更新日记失败' : '[Footprint] 更新足迹失败', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Delete a task
  const deleteTask = async (id: string) => {
    const task = tasks.value.find(item => item.id === id)
    if (!task) return
    const isDiary = task.isDiary || task.category === 'diary'
    try {
      const index = tasks.value.findIndex(t => t.id === id)
      if (index === -1) return
      const apiCall = isDiary ? api.deleteDiary : api.deleteTask
      await apiCall(id)
      tasks.value.splice(index, 1)
    } catch (error) {
      logger.error(isDiary ? '[Diary] 删除日记失败' : '[Footprint] 删除足迹失败', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Toggle task completion
  const toggleTask = async (id: string) => {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return

    await updateTask(id, { completed: !task.completed })
  }

  // Get unique history names for autocomplete
  const historyNames = computed(() => {
    const names = tasks.value.map(t => t.name)
    return [...new Set(names)]
  })

  // Reset store (used when logging out)
  const reset = () => {
    tasks.value = []
    isLoaded.value = false
  }

  return {
    tasks,
    isLoaded,
    historyNames,
    loadTasks,
    addTask,
    addCompletedTask,
    addSplitTasks,
    updateTask,
    deleteTask,
    toggleTask,
    reset
  }
})
