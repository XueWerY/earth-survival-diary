<template>
  <div class="course-container">
    <!-- 顶部日期导航区 -->
    <div class="top-nav-area">
      <div class="date-nav-scroll-wrapper" ref="dateNavRef">
        <div class="date-nav-inner">
          <div
              v-for="(day, index) in weekDays"
              :key="index"
              class="nav-item"
              :class="{
                active: selectedDay === index,
                today: isToday(index)
              }"
              :ref="setDayNavItemRef"
              @click="selectDay(index)"
          >
            <span class="nav-day-name">{{ day.name }}</span>
            <span class="nav-day-date">{{ day.date }}</span>
            <span class="nav-count">{{ getDayCourseCount(index) }}</span>
            <el-dropdown
                trigger="click"
                @command="(cmd: string) => handleDayCommand(cmd, index)"
                @click.stop
            >
              <el-button type="info" size="small" text :icon="MoreFilled" class="nav-more" @click.stop />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="add-course">添加课程</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <!-- 周信息区 -->
      <div class="week-info-bar">
        <div class="week-nav">
          <el-button :icon="ArrowLeft" circle size="small" @click="prevWeek" />
          <span class="week-number">第{{ displayWeekNumber }}周</span>
          <span class="week-date">{{ weekDateRange }}</span>
          <el-button :icon="ArrowRight" circle size="small" @click="nextWeek" />
        </div>
        <div class="week-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: weekProgress + '%' }"></div>
          </div>
          <span class="progress-text">共{{ totalWeeks }}周</span>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <template v-if="!isFormMode">
        <div class="content-wrapper">
          <!-- 课程列表区 -->
          <div class="content-body">
            <el-scrollbar>
              <!-- 空状态 -->
              <el-empty
                  v-if="currentDayCourses.length === 0"
                  :description="`周${['一', '二', '三', '四', '五', '六', '日'][selectedDay]}暂无课程`"
                  :image-size="120"
              />

              <!-- 课程列表 -->
              <div v-else class="course-list">
                <div
                    v-for="course in currentDayCourses"
                    :key="course.id"
                    class="course-card"
                    @click="handleEditCourse(course)"
                >
                  <div class="course-time">
                    <span class="time-start">{{ course.startTime }}</span>
                    <span class="time-sep">-</span>
                    <span class="time-end">{{ course.endTime }}</span>
                  </div>
                  <div class="course-content">
                    <div class="course-name" :style="{ color: course.color }">{{ course.name }}</div>
                    <div class="course-meta">
                      <span v-if="course.location" class="meta-item">
                        <el-icon><Location /></el-icon>
                        {{ course.location }}
                      </span>
                      <span v-if="course.teacher" class="meta-item">
                        <el-icon><User /></el-icon>
                        {{ course.teacher }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </template>

      <template v-else>
        <!-- 添加/编辑课程界面 -->
        <div class="course-form-page">
          <div class="form-page-header">
            <h2 class="form-page-title">{{ editingCourse ? '编辑课程' : '添加课程' }}</h2>
          </div>
          <div class="form-page-body">
            <el-scrollbar>
              <div class="form-container">
                <el-form :model="courseForm" :rules="courseRules" ref="courseFormRef" label-width="80px" class="course-form">
                  <el-form-item label="课程名称" prop="name">
                    <el-input v-model="courseForm.name" placeholder="输入课程名称" maxlength="30" show-word-limit />
                  </el-form-item>

                  <el-form-item label="上课时间" required>
                    <div class="time-row">
                      <el-select v-model="courseForm.dayOfWeek" placeholder="选择星期" style="width: 120px">
                        <el-option v-for="day in WEEKDAYS" :key="day.value" :label="day.label" :value="day.value" />
                      </el-select>
                      <el-time-select
                          v-model="courseForm.startTime"
                          placeholder="开始时间"
                          :max-time="courseForm.endTime"
                          start="08:00"
                          step="00:05"
                          end="20:40"
                          style="width: 110px"
                      />
                      <span class="time-sep-text">至</span>
                      <el-time-select
                          v-model="courseForm.endTime"
                          placeholder="结束时间"
                          :min-time="courseForm.startTime"
                          start="08:00"
                          step="00:05"
                          end="20:40"
                          style="width: 110px"
                      />
                    </div>
                  </el-form-item>

                  <el-form-item label="上课地点">
                    <el-input v-model="courseForm.location" placeholder="教室/地点（可选）" maxlength="30" />
                  </el-form-item>

                  <el-form-item label="授课教师">
                    <el-input v-model="courseForm.teacher" placeholder="教师姓名（可选）" maxlength="20" />
                  </el-form-item>

                  <el-form-item label="课程颜色">
                    <div class="color-picker">
                      <div
                          v-for="color in COLORS"
                          :key="color"
                          class="color-option"
                          :class="{ active: courseForm.color === color }"
                          :style="{ backgroundColor: color }"
                          @click="courseForm.color = color"
                      />
                    </div>
                  </el-form-item>

                  <el-form-item label="上课周次">
                    <div class="weeks-setting">
                      <el-checkbox v-model="allWeeks">每周都有</el-checkbox>
                      <div v-if="!allWeeks" class="week-selector">
                        <el-checkbox-group v-model="courseForm.weeks">
                          <el-checkbox v-for="w in maxWeeks" :key="w" :value="w">第{{ w }}周</el-checkbox>
                        </el-checkbox-group>
                      </div>
                    </div>
                  </el-form-item>

                  <el-form-item label="备注">
                    <el-input
                        v-model="courseForm.note"
                        type="textarea"
                        :rows="2"
                        placeholder="添加备注（可选）"
                        maxlength="100"
                        show-word-limit
                    />
                  </el-form-item>
                </el-form>

                <div class="form-actions">
                  <el-button v-if="editingCourse" type="danger" @click="handleDeleteCourse">删除</el-button>
                  <div class="form-actions-right">
                    <el-button @click="isFormMode = false">取消</el-button>
                    <el-button type="primary" @click="handleCourseFormSubmit">
                      {{ editingCourse ? '保存' : '添加' }}
                    </el-button>
                  </div>
                </div>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, onBeforeUpdate } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight, Location, User, MoreFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { checkAndRecordFinishedCourses, loadRecordedCourses } from '../composables/useCourseAutoRecord'
import { getData, setData } from '../services/storageService'
import { useSettingsStore } from '../stores/settingsStore'
import { logger } from '../lib/logger'

interface Course {
  id: string
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string
  location: string
  teacher: string
  color: string
  weeks: number[]
  note: string
  createdAt: string
  updatedAt: string
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
]

const DAY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899',
]

const WEEKDAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' }
]

const STORAGE_KEY = ['course', 'courses'] as const

const courses = ref<Course[]>([])
const selectedDay = ref(0)

const dateNavRef = ref<HTMLElement>()
const dateNavItemsRef = ref<HTMLElement[]>([])

const clearNavRefs = () => {
  dateNavItemsRef.value = []
}

const setDayNavItemRef = (el: any) => {
  if (el) dateNavItemsRef.value.push(el)
}

const scrollToCenter = (container: HTMLElement, target: HTMLElement) => {
  if (!container || !target) return
  const containerWidth = container.clientWidth
  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const targetCenterInContainer = targetRect.left - containerRect.left + container.scrollLeft + (targetRect.width / 2)
  container.scrollTo({ left: Math.max(0, targetCenterInContainer - (containerWidth / 2)), behavior: 'smooth' })
}

const scrollDateNavToActive = () => {
  nextTick(() => {
    const container = dateNavRef.value as HTMLElement
    if (!container) return
    const activeItem = dateNavItemsRef.value.find(item => item.classList.contains('active')) as HTMLElement || container.querySelector('.nav-item.active') as HTMLElement
    if (activeItem) scrollToCenter(container, activeItem)
  })
}

let isDateNavDragging = false
let dateNavDragStartX = 0
let dateNavDragScrollLeft = 0
let isDateNavDragInitialized = false

const initDateNavDrag = () => {
  if (isDateNavDragInitialized) return
  isDateNavDragInitialized = true
  const el = dateNavRef.value
  if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isDateNavDragging = true; dateNavDragStartX = e.pageX; dateNavDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isDateNavDragging) return; e.preventDefault(); const walk = dateNavDragStartX - e.pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, dateNavDragScrollLeft + walk)) })
  const endDrag = () => { if (!isDateNavDragging) return; isDateNavDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', endDrag); window.addEventListener('mouseleave', endDrag)
  el.addEventListener('touchstart', (e: TouchEvent) => { dateNavDragStartX = e.touches[0].pageX; dateNavDragScrollLeft = el.scrollLeft }, { passive: true })
  el.addEventListener('touchmove', (e: TouchEvent) => { const walk = dateNavDragStartX - e.touches[0].pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, dateNavDragScrollLeft + walk)) }, { passive: true })
}

// 全局设置
const settingsStore = useSettingsStore()
const semesterStartDate = computed(() => settingsStore.settings.course?.semesterStartDate || '')
const totalWeeks = computed(() => settingsStore.settings.course?.totalWeeks || 20)

// 表单相关
const isFormMode = ref(false)
const editingCourse = ref<Course | null>(null)
const courseFormRef = ref()
const courseForm = ref({
  name: '',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '09:00',
  location: '',
  teacher: '',
  color: COLORS[0],
  weeks: [] as number[],
  note: ''
})
const allWeeks = ref(true)

const courseRules = {
  name: [
    { required: true, message: '请输入课程名称', trigger: 'blur' }
  ]
}

const maxWeeks = computed(() => totalWeeks.value || 25)

// 当前周
const currentWeekStart = ref(getMondayOfWeek(dayjs()))

function getMondayOfWeek(date: dayjs.Dayjs): dayjs.Dayjs {
  const day = date.day()
  const diff = day === 0 ? -6 : 1 - day
  return date.add(diff, 'day').startOf('day')
}

const displayWeekNumber = computed(() => getWeekNumber(currentWeekStart.value))

const weekProgress = computed(() => {
  const current = displayWeekNumber.value
  return Math.min((current / totalWeeks.value) * 100, 100)
})

const weekDateRange = computed(() => {
  const start = currentWeekStart.value
  const end = start.add(6, 'day')
  return `${start.format('M.D')}-${end.format('M.D')}`
})

const weekDays = computed(() => {
  const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return Array.from({ length: 7 }, (_, i) => {
    const date = currentWeekStart.value.add(i, 'day')
    return {
      name: names[i],
      date: date.format('D'),
      fullDate: date.format('YYYY-MM-DD'),
      dayOfWeek: i === 6 ? 0 : i + 1
    }
  })
})

const currentDayTitle = computed(() => {
  const day = weekDays.value[selectedDay.value]
  return `${day.name} (${currentWeekStart.value.add(selectedDay.value, 'day').format('M月D日')})`
})

const currentDayCourses = computed(() => {
  const dayOfWeek = selectedDay.value === 6 ? 0 : selectedDay.value + 1
  const weekNum = displayWeekNumber.value

  return courses.value
      .filter(course => {
        if (course.dayOfWeek !== dayOfWeek) return false
        if (course.weeks && course.weeks.length > 0) {
          return course.weeks.includes(weekNum)
        }
        return true
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
})

function getDayCourseCount(dayIndex: number): number {
  const dayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1
  const weekNum = displayWeekNumber.value

  return courses.value.filter(course => {
    if (course.dayOfWeek !== dayOfWeek) return false
    if (course.weeks && course.weeks.length > 0) {
      return course.weeks.includes(weekNum)
    }
    return true
  }).length
}

function getWeekNumber(date: dayjs.Dayjs): number {
  if (!semesterStartDate.value) {
    const startOfYear = date.startOf('year')
    const mondayOfFirstWeek = getMondayOfWeek(startOfYear)
    const diff = getMondayOfWeek(date).diff(mondayOfFirstWeek, 'week')
    return Math.max(1, diff + 1)
  }

  const startDate = getMondayOfWeek(dayjs(semesterStartDate.value))
  const diff = getMondayOfWeek(date).diff(startDate, 'week')
  return Math.max(1, diff + 1)
}

function isToday(dayIndex: number): boolean {
  const today = dayjs()
  const dayDate = currentWeekStart.value.add(dayIndex, 'day')
  return today.format('YYYY-MM-DD') === dayDate.format('YYYY-MM-DD')
}

function prevWeek() {
  const newWeek = displayWeekNumber.value - 1
  if (newWeek >= 1) {
    currentWeekStart.value = currentWeekStart.value.subtract(7, 'day')
    logger.info('[课程表] 切换周数', { week: newWeek })
  }
}

function nextWeek() {
  const newWeek = displayWeekNumber.value + 1
  if (newWeek <= totalWeeks.value) {
    currentWeekStart.value = currentWeekStart.value.add(7, 'day')
    logger.info('[课程表] 切换周数', { week: newWeek })
  }
}

function selectDay(index: number) {
  selectedDay.value = index
  logger.info('[课程表] 切换日期', { day: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index] })
  if (isFormMode.value) {
    isFormMode.value = false
  }
  scrollDateNavToActive()
}

function handleDayCommand(command: string, dayIndex: number) {
  if (command === 'add-course') {
    handleAddCourse(dayIndex)
  }
}

const openFormMode = () => {
  isFormMode.value = true
}

function handleAddCourse(dayIndex?: number) {
  if (dayIndex !== undefined) {
    selectedDay.value = dayIndex
  }
  editingCourse.value = null
  const defaultDayOfWeek = selectedDay.value === 6 ? 0 : selectedDay.value + 1
  courseForm.value = {
    name: '',
    dayOfWeek: defaultDayOfWeek,
    startTime: '08:00',
    endTime: '09:00',
    location: '',
    teacher: '',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    weeks: [],
    note: ''
  }
  allWeeks.value = true
  openFormMode()
}

function handleEditCourse(course: Course) {
  editingCourse.value = { ...course }
  courseForm.value = {
    name: course.name,
    dayOfWeek: course.dayOfWeek,
    startTime: course.startTime,
    endTime: course.endTime,
    location: course.location,
    teacher: course.teacher,
    color: course.color,
    weeks: [...(course.weeks || [])],
    note: course.note
  }
  allWeeks.value = !course.weeks || course.weeks.length === 0
  openFormMode()
}

async function handleCourseFormSubmit() {
  if (!courseFormRef.value) return
  await courseFormRef.value.validate((valid: boolean) => {
    if (!valid) return
    if (editingCourse.value) {
      const index = courses.value.findIndex(c => c.id === editingCourse.value!.id)
      if (index > -1) {
        courses.value[index] = {
          ...courses.value[index],
          ...courseForm.value,
          weeks: allWeeks.value ? [] : courseForm.value.weeks,
          updatedAt: new Date().toISOString()
        }
        logger.info('[课程表] 编辑课程', { id: editingCourse.value.id, name: courseForm.value.name })
        ElMessage.success('课程已更新')
      }
    } else {
      const newCourse: Course = {
        id: Date.now().toString(),
        name: courseForm.value.name,
        dayOfWeek: courseForm.value.dayOfWeek,
        startTime: courseForm.value.startTime,
        endTime: courseForm.value.endTime,
        location: courseForm.value.location,
        teacher: courseForm.value.teacher,
        color: courseForm.value.color,
        weeks: allWeeks.value ? [] : courseForm.value.weeks,
        note: courseForm.value.note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      courses.value.push(newCourse)
      logger.info('[课程表] 添加课程', { name: courseForm.value.name })
      ElMessage.success('课程已添加')
    }
    saveData()
    isFormMode.value = false
  })
}

async function handleDeleteCourse() {
  try {
    await ElMessageBox.confirm('确定要删除这门课程吗？', '删除确认', {
      type: 'warning'
    })
    if (editingCourse.value) {
      const index = courses.value.findIndex(c => c.id === editingCourse.value!.id)
      if (index > -1) {
        courses.value.splice(index, 1)
        await saveData()
        logger.info('[课程表] 删除课程', { id: editingCourse.value.id, name: editingCourse.value.name })
        ElMessage.success('课程已删除')
      }
    }
    isFormMode.value = false
  } catch {
    // 取消删除
  }
}

async function saveData() {
  await setData(STORAGE_KEY[0], STORAGE_KEY[1], courses.value)
}

async function loadData() {
  try {
    const saved = await getData<Course[]>(STORAGE_KEY[0], STORAGE_KEY[1])
    if (saved) {
      courses.value = saved.map(c => ({
        id: c.id || Date.now().toString(),
        name: c.name || '未命名课程',
        dayOfWeek: c.dayOfWeek ?? 1,
        startTime: c.startTime || '08:00',
        endTime: c.endTime || '09:00',
        location: c.location || '',
        teacher: c.teacher || '',
        color: c.color || COLORS[0],
        weeks: c.weeks || [],
        note: c.note || '',
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || new Date().toISOString()
      }))
    }
  } catch (e) {
    console.error('Failed to load courses:', e)
    courses.value = []
  }
}

let interval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await settingsStore.loadSettings()
  await loadData()
  await loadRecordedCourses()

  const today = dayjs().day()
  selectedDay.value = today === 0 ? 6 : today - 1

  nextTick(() => {
    initDateNavDrag()
    scrollDateNavToActive()
  })

  interval = setInterval(async () => {
    await checkAndRecordFinishedCourses(courses.value, semesterStartDate.value)
  }, 60000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})

onBeforeUpdate(() => clearNavRefs())
</script>

<style scoped>
.course-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  position: relative;
}

/* 顶部日期导航区 */
.top-nav-area {
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.date-nav-scroll-wrapper {
  height: 56px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.date-nav-scroll-wrapper::-webkit-scrollbar {
  display: none;
}

.date-nav-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px;
  white-space: nowrap;
  width: max-content;
  min-width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  position: relative;
  height: 40px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.nav-item.active {
  background: rgba(102, 126, 234, 0.2);
}

.nav-item.active .nav-day-name {
  color: #fff;
  font-weight: 500;
}

.nav-item.today .nav-day-name {
  color: #3b82f6;
}

.nav-day-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  white-space: nowrap;
}

.nav-day-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.nav-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  min-width: 20px;
  text-align: center;
}

.nav-more {
  opacity: 0;
  transition: opacity 0.2s;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-item:hover .nav-more {
  opacity: 1;
}

/* 周信息条 */
.week-info-bar {
  padding: 8px 16px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.week-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.week-number {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.week-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.week-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.progress-bar {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  border-radius: 2px;
  transition: width 0.3s;
}

.progress-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 1240px) {
  .content-wrapper {
    max-width: none;
  }
}

.content-body {
  flex: 1;
  overflow: hidden;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 24px;
}

/* 课程卡片 */
.course-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border-left: 4px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.course-card:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateX(4px);
}

.course-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 60px;
}

.time-start, .time-end {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.time-sep {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin: 2px 0;
}

.course-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.course-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.course-meta {
  display: flex;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

/* 表单页面 */
.course-form-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.form-page-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  text-align: center;
}

.form-page-title {
  margin: 0;
  font-size: 18px;
  color: #fff;
  font-weight: 600;
}

.form-page-body {
  flex: 1;
  overflow: hidden;
}

.form-container {
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
}

.course-form :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.course-form :deep(.el-input__inner) {
  color: #fff;
}

.course-form :deep(.el-textarea__inner) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
  color: #fff;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-sep-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.weeks-setting {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.week-selector {
  max-height: 120px;
  overflow-y: auto;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.week-selector :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.week-selector :deep(.el-checkbox) {
  margin-right: 0;
  min-width: 70px;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
}

.form-actions-right {
  display: flex;
  gap: 12px;
}

/* 对话框深色主题 */
:deep(.el-checkbox__label) {
  color: rgba(255, 255, 255, 0.85) !important;
}
</style>
