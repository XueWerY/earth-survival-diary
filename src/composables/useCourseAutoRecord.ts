import { ref } from 'vue'
import dayjs from 'dayjs'
import { useTaskStore } from '../stores/taskStore'
import { getData, setData } from '../services/storageService'

// 课程类型定义
interface Course {
  id: string
  name: string
  dayOfWeek: number // 0-6, 周日到周六
  startTime: string // HH:mm
  endTime: string // HH:mm
  location: string
  teacher: string
  color: string
  weeks: number[] // 哪些周有课，空数组表示每周都有
  note: string
  createdAt: string
  updatedAt: string
}

// 本地存储键名
const RECORDED_COURSES_KEY = 'earth-survival-recorded-courses'

// 已记录的课程ID集合
const recordedCourses = ref<Set<string>>(new Set())

// 是否已初始化
let initialized = false

// 加载已记录的课程ID
export async function loadRecordedCourses() {
  try {
    const saved = await getData<string[]>(RECORDED_COURSES_KEY)
    if (saved) {
      recordedCourses.value = new Set(saved)
    }
  } catch (e) {
    console.error('Failed to load recorded courses:', e)
  }
}

// 保存已记录的课程ID
export async function saveRecordedCourses() {
  await setData(RECORDED_COURSES_KEY, [...recordedCourses.value])
}

// 获取本周周一（每周从周一开始）
function getMondayOfWeek(date: dayjs.Dayjs): dayjs.Dayjs {
  const day = date.day()
  const diff = day === 0 ? -6 : 1 - day
  return date.add(diff, 'day').startOf('day')
}

// 获取周次
function getWeekNumber(date: dayjs.Dayjs, semesterStartDate: string | null): number {
  if (!semesterStartDate) {
    const startOfYear = date.startOf('year')
    const mondayOfFirstWeek = getMondayOfWeek(startOfYear)
    const diff = getMondayOfWeek(date).diff(mondayOfFirstWeek, 'week')
    return Math.max(1, diff + 1)
  }

  const startDate = getMondayOfWeek(dayjs(semesterStartDate))
  const diff = getMondayOfWeek(date).diff(startDate, 'week')
  return Math.max(1, diff + 1)
}

// 检测并自动记录已结束的课程
export async function checkAndRecordFinishedCourses(
    courses: Course[],
    semesterStartDate: string | null,
    showMessage: boolean = true
): Promise<void> {
  const taskStore = useTaskStore()

  // 确保 taskStore 已加载
  if (!taskStore.isLoaded) {
    await taskStore.loadTasks()
  }

  const now = dayjs()
  const today = now.format('YYYY-MM-DD')
  const todayDayOfWeek = now.day()
  const currentTimeStr = now.format('HH:mm')
  const weekNum = getWeekNumber(now, semesterStartDate)

  let recordedCount = 0

  for (const course of courses) {
    // 检查是否是今天的课程
    if (course.dayOfWeek !== todayDayOfWeek) continue

    // 检查周次
    if (course.weeks && course.weeks.length > 0 && !course.weeks.includes(weekNum)) continue

    // 检查课程是否已结束
    if (course.endTime >= currentTimeStr) continue

    // 生成唯一标识
    const recordKey = `${course.id}-${today}`

    // 检查是否已记录（通过本地记录）
    if (recordedCourses.value.has(recordKey)) continue

    // 检查已记录的任务中是否有相同课程名的事件
    const courseEventName = `上《${course.name}》课`
    const existingTask = taskStore.tasks.find(t =>
        t.date === today && t.name === courseEventName
    )
    if (existingTask) {
      // 已存在同名事件，标记为已记录但不重复添加
      recordedCourses.value.add(recordKey)
      continue
    }

    // 构建备注
    const noteParts: string[] = []
    if (course.teacher) noteParts.push(`老师：${course.teacher}`)
    if (course.location) noteParts.push(`教室：${course.location}`)

    // 记录足迹
    await taskStore.addCompletedTask({
      id: `course-${recordKey}`,
      name: courseEventName,
      startTime: course.startTime,
      endTime: course.endTime,
      date: today,
      completed: true,
      duration: 0,
      notes: noteParts.join('，')
    })

    // 标记为已记录
    recordedCourses.value.add(recordKey)
    recordedCount++
  }

  if (recordedCount > 0) {
    await saveRecordedCourses()
    if (showMessage) {
      // 动态导入 ElMessage 避免循环依赖
      const { ElMessage } = await import('element-plus')
      if (recordedCount === 1) {
        ElMessage.success(`已自动记录已结束的课程到足迹`)
      } else {
        ElMessage.success(`已自动记录 ${recordedCount} 节已结束的课程到足迹`)
      }
    }
  }
}

// 初始化课程自动记录功能
export async function initCourseAutoRecord(
    courses: Course[],
    semesterStartDate: string | null
): Promise<void> {
  if (initialized) return
  initialized = true

  await loadRecordedCourses()
  await checkAndRecordFinishedCourses(courses, semesterStartDate, true)
}

// 重置初始化状态（用于测试）
export function resetCourseAutoRecordInit(): void {
  initialized = false
}
