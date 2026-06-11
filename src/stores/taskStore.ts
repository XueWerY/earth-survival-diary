import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import * as api from '../lib/api'

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
  category?: string
  createdAt?: string
  isDiary?: boolean
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
  category: dbTask.category || undefined,
  createdAt: dbTask.created_at,
  isDiary: dbTask.category === 'diary'
})

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoaded = ref(false)

  // Load tasks from API
  const loadTasks = async () => {
    if (isLoaded.value) return

    try {
      const { tasks: dbTasks } = await api.getTasks()
      tasks.value = dbTasks.map(dbToTask)
      isLoaded.value = true
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
  }

  // Calculate duration in minutes
  const calculateDuration = (startTime: string, endTime: string): number => {
    const start = dayjs(`2000-01-01 ${startTime}`)
    const end = dayjs(`2000-01-01 ${endTime}`)
    return end.diff(start, 'minute')
  }

  // Add a new task
  const addTask = async (task: Omit<Task, 'id' | 'duration' | 'completed'>) => {
    try {
      const duration = calculateDuration(task.startTime, task.endTime)
      const { task: dbTask } = await api.addTask({
        name: task.name,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        notes: task.notes,
        category: task.category
      })
      tasks.value.unshift({ ...dbToTask(dbTask), duration })
    } catch (error) {
      console.error('Failed to add task:', error)
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
        category: task.category
      })
      tasks.value.unshift({ ...dbToTask(dbTask), duration, completed: true })
    } catch (error) {
      console.error('Failed to add completed task:', error)
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
        console.error('Failed to add split task:', error)
      }
    }
  }

  // Update a task
  const updateTask = async (id: string, updates: Partial<Omit<Task, 'id'>>) => {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index === -1) return

    try {
      const { task: dbTask } = await api.updateTask(id, {
        name: updates.name,
        date: updates.date,
        startTime: updates.startTime,
        endTime: updates.endTime,
        notes: updates.notes,
        category: updates.category,
        completed: updates.completed
      })
      tasks.value[index] = dbToTask(dbTask)
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  // Delete a task
  const deleteTask = async (id: string) => {
    try {
      await api.deleteTask(id)
      const index = tasks.value.findIndex(t => t.id === id)
      if (index !== -1) {
        tasks.value.splice(index, 1)
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
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
