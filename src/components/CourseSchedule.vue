<template>
  <div class="course-container">
    <!-- 左侧边栏 -->
    <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <!-- 周信息 -->
      <div class="week-info" v-show="!sidebarCollapsed">
        <div class="week-nav">
          <el-button :icon="ArrowLeft" circle size="small" @click="prevWeek" />
          <div class="week-text">
            <span class="week-number">第{{ displayWeekNumber }}周</span>
            <span class="week-date">{{ weekDateRange }}</span>
          </div>
          <el-button :icon="ArrowRight" circle size="small" @click="nextWeek" />
        </div>
        <div class="week-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: weekProgress + '%' }"></div>
          </div>
          <span class="progress-text">共{{ totalWeeks }}周</span>
        </div>
        <el-button size="small" class="today-btn" @click="goToToday">今天</el-button>
      </div>

      <el-scrollbar class="sidebar-content">
        <!-- 周一到周日的分类 -->
        <div
            v-for="(day, index) in weekDays"
            :key="index"
            class="day-item"
            :class="{
            active: selectedDay === index,
            today: isToday(index)
          }"
            @click="selectDay(index)"
        >
          <span class="day-color" :style="{ background: getDayColor(index) }"></span>
          <span class="day-name" v-show="!sidebarCollapsed">{{ day.name }}</span>
          <span class="day-date" v-show="!sidebarCollapsed">{{ day.date }}</span>
          <span class="course-count" v-show="!sidebarCollapsed">{{ getDayCourseCount(index) }}</span>
          <el-button
              type="primary"
              size="small"
              :icon="Plus"
              circle
              class="add-btn"
              v-show="!sidebarCollapsed"
              @click.stop="handleAddCourse(index)"
          />
        </div>
      </el-scrollbar>
    </div>

    <!-- 折叠按钮（放在侧边栏外面，确保折叠后仍可见） -->
    <div class="sidebar-toggle" @click="toggleSidebar">
      <el-icon v-if="sidebarCollapsed"><DArrowRight /></el-icon>
      <el-icon v-else><DArrowLeft /></el-icon>
    </div>

    <!-- 右侧内容：时间线视图 -->
    <div class="main-content">
      <!-- 头部 -->
      <div class="content-header">
        <div class="header-left">
          <span class="day-indicator" :style="{ background: getDayColor(selectedDay) }"></span>
          <h2>{{ currentDayTitle }}</h2>
          <span class="course-count-header">{{ currentDayCourses.length }} 节课</span>
        </div>
      </div>

      <!-- 时间线内容 -->
      <el-scrollbar class="content-body">
        <!-- 空状态 -->
        <el-empty
            v-if="currentDayCourses.length === 0"
            :description="`周${['一', '二', '三', '四', '五', '六', '日'][selectedDay]}暂无课程`"
            :image-size="120"
        />

        <!-- 时间线 -->
        <div v-else class="timeline">
          <div
              v-for="course in currentDayCourses"
              :key="course.id"
              class="course-card"
              :style="{ borderLeftColor: course.color }"
              @click="handleEditCourse(course)"
          >
            <div class="course-time">
              <span class="time-start">{{ course.startTime }}</span>
              <span class="time-sep">-</span>
              <span class="time-end">{{ course.endTime }}</span>
            </div>
            <div class="course-content">
              <div class="course-name">{{ course.name }}</div>
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

    <!-- 表单对话框 -->
    <CourseForm
        v-model:visible="formVisible"
        :course="editingCourse"
        :default-day="selectedDay"
        :total-weeks="totalWeeks"
        @submit="handleFormSubmit"
        @delete="handleDeleteCourse"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ArrowLeft, ArrowRight, Location, User, DArrowRight, DArrowLeft } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import CourseForm from './CourseForm.vue'
import { checkAndRecordFinishedCourses, loadRecordedCourses } from '../composables/useCourseAutoRecord'
import { getData, setData } from '../services/storageService'
import { useSettingsStore } from '../stores/settingsStore'

// 课程类型定义
interface Course {
  id: string
  name: string
  dayOfWeek: number // 0-6, 周日到周六
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

// 预设颜色
const COURSE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
]

// 每天的颜色
const DAY_COLORS = [
  '#3b82f6', // 周一 - 蓝
  '#10b981', // 周二 - 绿
  '#f59e0b', // 周三 - 橙
  '#ef4444', // 周四 - 红
  '#8b5cf6', // 周五 - 紫
  '#06b6d4', // 周六 - 青
  '#ec4899', // 周日 - 粉
]

// 本地存储键名
const STORAGE_KEY = 'earth-survival-courses'

// 数据
const courses = ref<Course[]>([])
const selectedDay = ref(0) // 0=周一, 6=周日

// 侧边栏折叠状态
const sidebarCollapsed = ref(false)

// 切换侧边栏折叠
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// 全局设置
const settingsStore = useSettingsStore()

// 学期设置（从全局设置读取）
const semesterStartDate = computed(() => settingsStore.settings.course?.semesterStartDate || '')
const totalWeeks = computed(() => settingsStore.settings.course?.totalWeeks || 20)

// 表单相关
const formVisible = ref(false)
const editingCourse = ref<Course | null>(null)

// 当前周
const currentWeekStart = ref(getMondayOfWeek(dayjs()))

// 获取周一
function getMondayOfWeek(date: dayjs.Dayjs): dayjs.Dayjs {
  const day = date.day()
  const diff = day === 0 ? -6 : 1 - day
  return date.add(diff, 'day').startOf('day')
}

// 显示的周次
const displayWeekNumber = computed(() => {
  return getWeekNumber(currentWeekStart.value)
})

// 周进度
const weekProgress = computed(() => {
  const current = displayWeekNumber.value
  return Math.min((current / totalWeeks.value) * 100, 100)
})

// 周日期范围
const weekDateRange = computed(() => {
  const start = currentWeekStart.value
  const end = start.add(6, 'day')
  if (start.month() === end.month()) {
    return `${start.format('M.D')}-${end.format('D')}`
  }
  return `${start.format('M.D')}-${end.format('M.D')}`
})

// 周日期列表（周一到周日）
const weekDays = computed(() => {
  const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return Array.from({ length: 7 }, (_, i) => {
    const date = currentWeekStart.value.add(i, 'day')
    return {
      name: names[i],
      date: date.format('D'),
      fullDate: date.format('YYYY-MM-DD'),
      dayOfWeek: i === 6 ? 0 : i + 1 // dayjs day(): 周日=0, 周一=1...
    }
  })
})

// 当前选中天的标题
const currentDayTitle = computed(() => {
  const day = weekDays.value[selectedDay.value]
  return `${day.name} (${currentWeekStart.value.add(selectedDay.value, 'day').format('M月D日')})`
})

// 当前选中天的课程
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

// 获取某天的课程数量
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

// 获取天的颜色
function getDayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex]
}

// 是否是今天
function isToday(dayIndex: number): boolean {
  const today = dayjs()
  const dayDate = currentWeekStart.value.add(dayIndex, 'day')
  return today.format('YYYY-MM-DD') === dayDate.format('YYYY-MM-DD')
}

// 获取周次
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

// 切换周
function prevWeek() {
  const newWeek = displayWeekNumber.value - 1
  if (newWeek >= 1) {
    currentWeekStart.value = currentWeekStart.value.subtract(7, 'day')
  }
}

function nextWeek() {
  const newWeek = displayWeekNumber.value + 1
  if (newWeek <= totalWeeks.value) {
    currentWeekStart.value = currentWeekStart.value.add(7, 'day')
  }
}

function goToToday() {
  currentWeekStart.value = getMondayOfWeek(dayjs())
  // 自动选中今天
  const today = dayjs().day()
  selectedDay.value = today === 0 ? 6 : today - 1
}

// 选择天
function selectDay(index: number) {
  selectedDay.value = index
}

// 添加课程
function handleAddCourse(dayIndex?: number) {
  if (dayIndex !== undefined) {
    selectedDay.value = dayIndex
  }
  editingCourse.value = null
  formVisible.value = true
}

// 编辑课程
function handleEditCourse(course: Course) {
  editingCourse.value = { ...course }
  formVisible.value = true
}

// 删除课程
async function handleDeleteCourse(courseId: string) {
  try {
    await ElMessageBox.confirm('确定要删除这门课程吗？', '删除确认', {
      type: 'warning'
    })

    const index = courses.value.findIndex(c => c.id === courseId)
    if (index > -1) {
      courses.value.splice(index, 1)
      await saveData()
      ElMessage.success('课程已删除')
    }
    formVisible.value = false
  } catch {
    // 取消删除
  }
}

// 表单提交
function handleFormSubmit(data: Partial<Course>) {
  if (editingCourse.value) {
    const index = courses.value.findIndex(c => c.id === editingCourse.value!.id)
    if (index > -1) {
      courses.value[index] = {
        ...courses.value[index],
        ...data,
        updatedAt: new Date().toISOString()
      }
      ElMessage.success('课程已更新')
    }
  } else {
    const newCourse: Course = {
      id: Date.now().toString(),
      name: data.name || '',
      dayOfWeek: data.dayOfWeek ?? 1,
      startTime: data.startTime || '08:00',
      endTime: data.endTime || '09:00',
      location: data.location || '',
      teacher: data.teacher || '',
      color: data.color || COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)],
      weeks: data.weeks || [],
      note: data.note || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    courses.value.push(newCourse)
    ElMessage.success('课程已添加')
  }
  saveData()
  formVisible.value = false
}

// 数据持久化
async function saveData() {
  await setData(STORAGE_KEY, courses.value)
}

async function loadData() {
  try {
    const saved = await getData<Course[]>(STORAGE_KEY)
    if (saved) {
      courses.value = saved.map(c => ({
        id: c.id || Date.now().toString(),
        name: c.name || '未命名课程',
        dayOfWeek: c.dayOfWeek ?? 1,
        startTime: c.startTime || '08:00',
        endTime: c.endTime || '09:00',
        location: c.location || '',
        teacher: c.teacher || '',
        color: c.color || COURSE_COLORS[0],
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

// 初始化
onMounted(async () => {
  await settingsStore.loadSettings()
  await loadData()
  await loadRecordedCourses()

  // 自动选中今天
  const today = dayjs().day()
  selectedDay.value = today === 0 ? 6 : today - 1

  // 定时检测课程
  const interval = setInterval(async () => {
    await checkAndRecordFinishedCourses(courses.value, semesterStartDate.value)
  }, 60000)

  onUnmounted(() => clearInterval(interval))
})
</script>

<style scoped>
.course-container {
  height: 100%;
  display: flex;
  background: transparent;
  position: relative;
}

/* 左侧边栏 */
.sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  transition: width 0.3s ease;
  position: relative;
}

.sidebar.collapsed {
  width: 0;
  border-right: none;
  overflow: hidden;
}

/* 周信息 */
.week-info {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.week-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.week-text {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.week-number {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.week-date {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.today-btn {
  width: 100%;
}

.week-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.progress-bar {
  flex: 1;
  height: 4px;
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

.sidebar-content {
  flex: 1;
  padding: 8px;
}

/* 天列表项 */
.day-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.day-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.day-item.active {
  background: rgba(255, 255, 255, 0.1);
}

.day-item.today .day-name {
  color: #3b82f6;
}

.day-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.day-name {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.day-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 20px;
}

.course-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  min-width: 20px;
  text-align: right;
}

.add-btn {
  opacity: 0;
  transition: opacity 0.2s;
  width: 24px !important;
  height: 24px !important;
}

.day-item:hover .add-btn {
  opacity: 1;
}

/* 折叠按钮 */
.sidebar-toggle {
  position: absolute;
  bottom: 16px;
  left: 268px;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  transition: all 0.3s ease;
}

.sidebar.collapsed + .sidebar-toggle {
  left: 0;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.sidebar-toggle .el-icon {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

/* 右侧内容 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.day-indicator {
  width: 4px;
  height: 20px;
  border-radius: 2px;
}

.header-left h2 {
  margin: 0;
  font-size: 20px;
  color: #fff;
  font-weight: 600;
}

.course-count-header {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.content-body {
  flex: 1;
  padding: 16px 24px;
}

/* 时间线 */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.course-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border-left: 4px solid;
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
  color: #fff;
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

.course-weeks {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 8px;
}

/* 拖拽相关 */
.drag-over {
  background: rgba(100, 200, 255, 0.1) !important;
  border: 1px dashed rgba(100, 200, 255, 0.5) !important;
}
</style>
