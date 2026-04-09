<template>
  <div class="app-container">
    <!-- 移动端横屏提示 -->
    <div v-if="showOrientationWarning" class="orientation-warning">
      <div class="warning-content">
        <div class="warning-icon">📱</div>
        <h2>请横屏使用</h2>
        <p>为了获得最佳体验，请将设备旋转至横屏模式</p>
        <div class="rotate-animation">🔄</div>
      </div>
    </div>

    <!-- 被踢出提示 -->
    <template v-else-if="authStore.kickedOut">
      <div class="kicked-out-container">
        <div class="kicked-out-content">
          <div class="kicked-out-icon">⚠️</div>
          <h2>账号已在其他设备登录</h2>
          <p>您的账号已在另一台设备登录，当前会话已失效。</p>
          <el-button type="primary" @click="handleReLogin">重新登录</el-button>
        </div>
      </div>
    </template>

    <!-- 未登录时显示登录页面 -->
    <template v-else-if="!authStore.isAuthenticated && !authStore.loading">
      <AuthPage @success="handleAuthSuccess" />
    </template>

    <!-- 加载中（认证中或数据加载中） -->
    <template v-else-if="authStore.loading || !dataInitialized">
      <div class="loading-container">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p class="loading-text">{{ authStore.loading ? '验证身份中...' : '加载数据中...' }}</p>
        </div>
      </div>
    </template>

    <!-- 已登录且数据加载完成，显示主界面 -->
    <template v-else>
      <!-- 星空背景 -->
      <canvas ref="starCanvas" class="star-canvas"></canvas>

      <!-- 左侧导航栏 -->
      <nav class="side-nav" :class="{ 'nav-hidden': isNotesFullscreen || isFocusFullscreen || isStatsFullscreen }">
        <div class="nav-menu">
          <!-- 足迹记录 -->
          <div
              class="nav-item"
              :class="{ active: currentPage === 'footprint' }"
              @click="currentPage = 'footprint'"
          >
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <circle cx="12" cy="6" r="4" fill="currentColor"/>
                <ellipse cx="8" cy="16" rx="3" ry="5" fill="currentColor"/>
                <ellipse cx="16" cy="16" rx="3" ry="5" fill="currentColor"/>
              </svg>
            </span>
            <span class="nav-label">足迹</span>
          </div>

          <!-- 专注时光 -->
          <div
              class="nav-item"
              :class="{ active: currentPage === 'focus' }"
              @click="currentPage = 'focus'"
          >
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <circle cx="12" cy="14" r="9" fill="#ef4444"/>
                <ellipse cx="9" cy="11" rx="2" ry="3" fill="rgba(255,255,255,0.2)"/>
                <path d="M12 5 Q10 3 12 2 Q14 3 12 5" fill="#22c55e"/>
                <path d="M12 5 Q8 4 9 2" fill="none" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M12 5 Q16 4 15 2" fill="none" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="12" y1="14" x2="12" y2="9" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="12" y1="14" x2="16" y2="14" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
                <circle cx="12" cy="14" r="1.5" fill="#fff"/>
              </svg>
            </span>
            <span class="nav-label">专注</span>
          </div>

          <!-- 清单 -->
          <div
              class="nav-item"
              :class="{ active: currentPage === 'mission' }"
              @click="currentPage = 'mission'"
          >
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M12 2C12 2 8 6 8 12C8 14 8.5 16 9 17.5L12 22L15 17.5C15.5 16 16 14 16 12C16 6 12 2 12 2Z" fill="currentColor"/>
                <path d="M8 12L5 15L7 16L8 14Z" fill="currentColor" opacity="0.8"/>
                <path d="M16 12L19 15L17 16L16 14Z" fill="currentColor" opacity="0.8"/>
                <circle cx="12" cy="9" r="2" fill="rgba(255,255,255,0.3)"/>
                <path d="M10 17L12 22L14 17L12 19L10 17Z" fill="#f59e0b"/>
              </svg>
            </span>
            <span class="nav-label">清单</span>
          </div>

          <!-- 星际里程碑 -->
          <div
              class="nav-item"
              :class="{ active: currentPage === 'countdown' }"
              @click="currentPage = 'countdown'"
          >
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                <path d="M12 2 A10 10 0 0 1 22 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 6 L13.5 10 L18 10 L14.5 12.5 L16 17 L12 14.5 L8 17 L9.5 12.5 L6 10 L10.5 10 Z" fill="#f59e0b"/>
              </svg>
            </span>
            <span class="nav-label">倒数日</span>
          </div>

          <!-- 课程表 -->
          <div
              class="nav-item"
              :class="{ active: currentPage === 'course' }"
              @click="currentPage = 'course'"
          >
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
                <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5" transform="rotate(60 12 12)"/>
                <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5" transform="rotate(120 12 12)"/>
                <circle cx="12" cy="12" r="3" fill="#10b981"/>
                <circle cx="18" cy="8" r="1.5" fill="#3b82f6"/>
                <circle cx="6" cy="8" r="1.5" fill="#f59e0b"/>
                <circle cx="12" cy="18" r="1.5" fill="#ec4899"/>
              </svg>
            </span>
            <span class="nav-label">课程表</span>
          </div>

          <!-- 星际笔记 -->
          <div
              class="nav-item"
              :class="{ active: currentPage === 'notes' }"
              @click="currentPage = 'notes'"
          >
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <rect x="4" y="3" width="16" height="18" rx="2" fill="currentColor" opacity="0.8"/>
                <line x1="8" y1="3" x2="8" y2="21" stroke="#f59e0b" stroke-width="1.5"/>
                <line x1="10" y1="8" x2="18" y2="8" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                <line x1="10" y1="11" x2="16" y2="11" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                <line x1="10" y1="14" x2="18" y2="14" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                <circle cx="16" cy="17" r="2" fill="#f59e0b"/>
              </svg>
            </span>
            <span class="nav-label">笔记</span>
          </div>

          <!-- 数据管理 -->
          <div
              v-if="isAdmin"
              class="nav-item"
              :class="{ active: currentPage === 'data' }"
              @click="currentPage = 'data'"
          >
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="currentColor" opacity="0.8"/>
                <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <polyline points="10 9 9 9 8 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            <span class="nav-label">数据管理</span>
          </div>

          <!-- 关于 -->
          <div
              class="nav-item"
              :class="{ active: currentPage === 'about' }"
              @click="currentPage = 'about'"
          >
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
              </svg>
            </span>
            <span class="nav-label">关于</span>
          </div>
        </div>

        <!-- 底部设置和个人中心入口 -->
        <div class="nav-bottom">
          <div
              class="nav-item"
              :class="{ active: currentPage === 'settings' }"
              @click="currentPage = 'settings'"
          >
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7zm0-2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                <path d="M19.43 12.02c.04-.32.07-.66.07-1.02s-.03-.7-.07-1.02l2.21-1.73a.5.5 0 0 0 .12-.64l-2.09-3.62a.5.5 0 0 0-.61-.22l-2.6 1.05c-.54-.42-1.13-.76-1.77-1.02l-.39-2.77A.5.5 0 0 0 13.86 2H9.64a.5.5 0 0 0-.5.43l-.39 2.77c-.64.26-1.23.6-1.77 1.02l-2.6-1.05a.5.5 0 0 0-.61.22l-2.09 3.62a.5.5 0 0 0 .12.64l2.21 1.73c-.04.32-.07.66-.07 1.02s.03.7.07 1.02l-2.21 1.73a.5.5 0 0 0-.12.64l2.09 3.62a.5.5 0 0 0 .61.22l2.6-1.05c.54.42 1.13.76 1.77 1.02l.39 2.77a.5.5 0 0 0 .5.43h4.22a.5.5 0 0 0 .5-.43l.39-2.77c.64-.26 1.23-.6 1.77-1.02l2.6 1.05a.5.5 0 0 0 .61-.22l2.09-3.62a.5.5 0 0 0-.12-.64l-2.21-1.73z"/>
              </svg>
            </span>
            <span class="nav-label">设置</span>
          </div>
          <div
              class="nav-item"
              :class="{ active: currentPage === 'profile' }"
              @click="currentPage = 'profile'"
          >
            <span class="nav-icon avatar-icon">
              <img v-if="authStore.avatarUrl" :src="authStore.avatarUrl" alt="头像" class="nav-avatar-img" />
              <span v-else class="nav-avatar-default">{{ avatarText }}</span>
            </span>
            <span class="nav-label">我的</span>
          </div>
        </div>
      </nav>

      <!-- 主内容区域 -->
      <main class="main-content">
        <div class="panel-wrapper">
          <TaskList v-if="currentPage === 'footprint'" @fullscreen-change="handleStatsFullscreen" />
          <FocusTimer v-else-if="currentPage === 'focus'" @fullscreen-change="handleFocusFullscreen" />
          <MissionList v-else-if="currentPage === 'mission'" />
          <CountdownList v-else-if="currentPage === 'countdown'" />
          <CourseSchedule v-else-if="currentPage === 'course'" />
          <NoteList v-else-if="currentPage === 'notes'" @fullscreen-change="handleNotesFullscreen" />
          <SettingsPage v-else-if="currentPage === 'settings'" />
          <ProfilePage v-else-if="currentPage === 'profile'" @logout="handleLogout" />
          <DataManagement v-else-if="currentPage === 'data'" />
          <AboutPage v-else-if="currentPage === 'about'" />
        </div>
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import TaskList from './components/TaskList.vue'
import MissionList from './components/MissionList.vue'
import CountdownList from './components/CountdownList.vue'
import CourseSchedule from './components/CourseSchedule.vue'
import FocusTimer from './components/FocusTimer.vue'
import AuthPage from './components/AuthPage.vue'
import ProfilePage from './components/ProfilePage.vue'
import NoteList from './components/NoteList.vue'
import SettingsPage from './components/SettingsPage.vue'
import AboutPage from './components/AboutPage.vue'
import DataManagement from './components/DataManagement.vue'
import { initCourseAutoRecord } from './composables/useCourseAutoRecord'
import { useTaskStore } from './stores/taskStore'
import { useMissionStore } from './stores/missionStore'
import { useAuthStore } from './stores/authStore'
import { useSettingsStore } from './stores/settingsStore'
import { useFocusStore } from './stores/focusStore'
import { useNoteStore } from './stores/noteStore'
import { getData, setData, preloadData, clearCache } from './services/storageService'

const taskStore = useTaskStore()
const missionStore = useMissionStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const focusStore = useFocusStore()
const noteStore = useNoteStore()

// 移动端横屏检测
const showOrientationWarning = ref(false)
const checkOrientation = () => {
  if (window.innerWidth < window.innerHeight) {
    // 竖屏
    showOrientationWarning.value = true
  } else {
    // 横屏
    showOrientationWarning.value = false
  }
}
// 检测是否为移动端（通过 UA 或屏幕宽度）
const isMobile = () => {
  // 暂时返回 false，禁用横屏检测
  return false
  // return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768
}
// 初始化横屏检测
const initOrientationCheck = () => {
  if (isMobile()) {
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
  } else {
    showOrientationWarning.value = false
  }
}

// 数据是否已初始化
const dataInitialized = ref(false)

// 用户头像文字
const avatarText = computed(() => {
  return (authStore.nickname || 'U').charAt(0).toUpperCase()
})

// 是否为管理员
const isAdmin = computed(() => {
  return authStore.user?.role === 'admin'
})

// 认证成功处理
const handleAuthSuccess = async () => {
  console.log('[App] handleAuthSuccess 被调用')
  await initializeData()
}

// 退出登录处理
const handleLogout = () => {
  console.log('[App] handleLogout 被调用')
  // 重置所有 store 状态
  taskStore.reset()
  missionStore.reset()
  focusStore.reset()
  noteStore.reset()
  settingsStore.reset()
  // 清除所有缓存数据
  clearCache()
  dataInitialized.value = false
}

// 重新登录处理
const handleReLogin = async () => {
  console.log('[App] handleReLogin 被调用')
  // 重置所有 store 状态
  taskStore.reset()
  missionStore.reset()
  focusStore.reset()
  noteStore.reset()
  settingsStore.reset()
  // 清除所有缓存数据
  clearCache()
  // 重置数据初始化状态
  dataInitialized.value = false

  // 只重置本地状态，不调用服务端 signOut
  authStore.resetKickedOut()
  authStore.clearUser()
  console.log('[App] 本地状态已重置，等待用户重新登录')
}

// 数据存储键
const COUNTDOWN_KEY = 'earth-countdowns'
const COUNTDOWN_CATEGORY_KEY = 'earth-countdown-categories'
const COURSE_KEY = 'earth-courses'
const RECORDED_COURSE_KEY = 'earth-recorded-courses'

// 初始化所有数据
const initializeData = async () => {
  console.log('[App] 开始初始化数据...')
  try {
    // 清除旧缓存，确保加载新用户数据
    clearCache()

    console.log('[App] 开始并行加载所有模块数据...')
    // 并行加载所有模块数据
    await Promise.all([
      taskStore.loadTasks(),
      missionStore.loadData(),
      settingsStore.loadSettings(),
      focusStore.loadData(),
      noteStore.loadData(),
      initPageState(),
      authStore.fetchAvatarUrl(),
      preloadCountdownData(),
      preloadCourseData(),
    ])

    console.log('[App] 并行加载完成，初始化课程自动记录...')
    await initCourseAutoRecordFromStorage()
    console.log('[App] 数据初始化完成')
  } catch (error) {
    console.error('[App] 初始化数据失败:', error)
  } finally {
    dataInitialized.value = true
    console.log('[App] dataInitialized 已设置为 true')
  }
}

// 预加载倒数日数据
const preloadCountdownData = async () => {
  const [milestones, categories] = await Promise.all([
    getData(COUNTDOWN_KEY),
    getData(COUNTDOWN_CATEGORY_KEY)
  ])
  if (milestones) preloadData(COUNTDOWN_KEY, milestones)
  if (categories) preloadData(COUNTDOWN_CATEGORY_KEY, categories)
}

// 预加载课程表数据
const preloadCourseData = async () => {
  const [courses, recordedCourses] = await Promise.all([
    getData(COURSE_KEY),
    getData(RECORDED_COURSE_KEY)
  ])
  if (courses) preloadData(COURSE_KEY, courses)
  if (recordedCourses) preloadData(RECORDED_COURSE_KEY, recordedCourses)
}

// 从 Redis 恢复页面状态
const PAGE_KEY = 'earth-survival-current-page'
const currentPage = ref<'footprint' | 'focus' | 'mission' | 'countdown' | 'course' | 'notes' | 'settings' | 'profile' | 'data' | 'about'>('footprint')

// 初始化页面状态
const initPageState = async () => {
  const savedPage = await getData<string>(PAGE_KEY)
  if (savedPage && ['footprint', 'focus', 'mission', 'countdown', 'course', 'notes', 'settings', 'profile', 'data', 'about'].includes(savedPage)) {
    currentPage.value = savedPage as any
  }
}

// 监听认证状态变化，当用户登录成功时初始化数据
watch(
    () => authStore.isAuthenticated,
    async (isAuthenticated, wasAuthenticated) => {
      console.log('[App] isAuthenticated 变化:', { wasAuthenticated, isAuthenticated, dataInitialized: dataInitialized.value })
      if (isAuthenticated && !wasAuthenticated && !dataInitialized.value) {
        console.log('[App] 检测到用户登录，开始初始化数据')
        await initializeData()
      }
    }
)

// 监听页面切换，保存到 Redis
watch(currentPage, async (newPage) => {
  await setData(PAGE_KEY, newPage)
})

// 星际笔记全屏状态
const isNotesFullscreen = ref(false)

const handleNotesFullscreen = (fullscreen: boolean) => {
  isNotesFullscreen.value = fullscreen
}

// 专注模块全屏状态
const isFocusFullscreen = ref(false)

const handleFocusFullscreen = (fullscreen: boolean) => {
  isFocusFullscreen.value = fullscreen
}

// 统计模块全屏状态
const isStatsFullscreen = ref(false)

const handleStatsFullscreen = (fullscreen: boolean) => {
  isStatsFullscreen.value = fullscreen
}

const starCanvas = ref<HTMLCanvasElement>()
let animationId: number
let resizeHandler: (() => void) | null = null

interface Star {
  x: number
  y: number
  radius: number
  opacity: number
  speed: number
  twinkleSpeed: number
}

interface Meteor {
  x: number
  y: number
  length: number
  speed: number
  opacity: number
  angle: number
}

// 初始化课程自动记录功能
const initCourseAutoRecordFromStorage = async () => {
  try {
    const COURSES_KEY = 'earth-survival-courses'
    const SEMESTER_KEY = 'earth-survival-semester'

    const [savedCourses, savedSemester] = await Promise.all([
      getData<any[]>(COURSES_KEY),
      getData<{ startDate?: string }>(SEMESTER_KEY)
    ])

    if (savedCourses) {
      const semesterStartDate = savedSemester?.startDate || null
      await initCourseAutoRecord(savedCourses, semesterStartDate)
    }
  } catch (e) {
    console.error('Failed to init course auto record:', e)
  }
}

onMounted(async () => {
  // 初始化横屏检测
  initOrientationCheck()

  // 先初始化认证状态
  await authStore.init()

  // 如果已登录，初始化数据
  if (authStore.isAuthenticated) {
    await initializeData()
  }

  const canvas = starCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 设置 canvas 大小
  resizeHandler = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resizeHandler()
  window.addEventListener('resize', resizeHandler)

  // 创建星星
  const stars: Star[] = []
  const starCount = 200

  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.5 + 0.5,
      opacity: Math.random(),
      speed: Math.random() * 0.5 + 0.1,
      twinkleSpeed: Math.random() * 0.02 + 0.005
    })
  }

  // 创建流星
  const meteors: Meteor[] = []

  const createMeteor = () => {
    if (Math.random() < 0.02 && meteors.length < 3) {
      meteors.push({
        x: Math.random() * canvas.width,
        y: 0,
        length: Math.random() * 80 + 50,
        speed: Math.random() * 8 + 6,
        opacity: 1,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2
      })
    }
  }

  // 动画循环
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    stars.forEach(star => {
      star.opacity += star.twinkleSpeed
      if (star.opacity > 1 || star.opacity < 0.3) {
        star.twinkleSpeed = -star.twinkleSpeed
      }

      ctx.beginPath()
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
      ctx.fill()

      if (star.radius > 1) {
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.radius * 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * 0.2})`
        ctx.fill()
      }

      star.y += star.speed * 0.1
      if (star.y > canvas.height) {
        star.y = 0
        star.x = Math.random() * canvas.width
      }
    })

    createMeteor()

    meteors.forEach((meteor, index) => {
      meteor.x += Math.cos(meteor.angle) * meteor.speed
      meteor.y += Math.sin(meteor.angle) * meteor.speed
      meteor.opacity -= 0.01

      if (meteor.opacity <= 0 || meteor.x > canvas.width || meteor.y > canvas.height) {
        meteors.splice(index, 1)
        return
      }

      const gradient = ctx.createLinearGradient(
          meteor.x, meteor.y,
          meteor.x - Math.cos(meteor.angle) * meteor.length,
          meteor.y - Math.sin(meteor.angle) * meteor.length
      )
      gradient.addColorStop(0, `rgba(255, 255, 255, ${meteor.opacity})`)
      gradient.addColorStop(0.3, `rgba(200, 220, 255, ${meteor.opacity * 0.6})`)
      gradient.addColorStop(1, 'rgba(200, 220, 255, 0)')

      ctx.beginPath()
      ctx.moveTo(meteor.x, meteor.y)
      ctx.lineTo(
          meteor.x - Math.cos(meteor.angle) * meteor.length,
          meteor.y - Math.sin(meteor.angle) * meteor.length
      )
      ctx.strokeStyle = gradient
      ctx.lineWidth = 2
      ctx.stroke()
    })

    animationId = requestAnimationFrame(animate)
  }

  animate()
})

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', checkOrientation)
  window.removeEventListener('orientationchange', checkOrientation)
})
</script>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(to bottom, #0f0c29 0%, #302b63 50%, #24243e 100%);
  position: relative;
  overflow: hidden;
  display: flex;
}

/* 移动端横屏提示 */
.orientation-warning {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.warning-content {
  text-align: center;
  color: #fff;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.warning-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.warning-content h2 {
  font-size: 24px;
  margin: 0 0 12px 0;
}

.warning-content p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 20px;
}

.rotate-animation {
  font-size: 32px;
  animation: rotate 1.5s ease-in-out infinite;
  display: inline-block;
}

@keyframes rotate {
  0% { transform: rotate(0deg); }
  50% { transform: rotate(90deg); }
  100% { transform: rotate(0deg); }
}

/* 被踢出提示 */
.kicked-out-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kicked-out-content {
  text-align: center;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.kicked-out-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.kicked-out-content h2 {
  color: #fff;
  margin: 0 0 12px 0;
  font-size: 22px;
}

.kicked-out-content p {
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 24px 0;
  font-size: 14px;
}

.star-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

/* 左侧导航栏 */
.side-nav {
  position: relative;
  z-index: 20;
  width: 64px;
  height: 100%;
  background: rgba(15, 12, 41, 0.6);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: visible;
  transition: opacity 0.3s, width 0.3s, margin 0.3s;
}

.side-nav.nav-hidden {
  opacity: 0;
  width: 0;
  margin-left: -64px;
  pointer-events: none;
}

.nav-menu {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  overflow-x: visible;
}

.nav-menu::-webkit-scrollbar {
  width: 4px;
}

.nav-menu::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.nav-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 8px;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 4px;
}

.nav-item:hover {
  color: #fff;
}

.nav-item.active {
  color: #fff;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-icon svg {
  transition: all 0.3s ease;
}

.nav-item:hover .nav-icon svg {
  transform: scale(1.1);
  filter: drop-shadow(0 0 4px rgba(102, 126, 234, 0.5));
}

.nav-item.active .nav-icon svg {
  animation: iconPulse 1.5s ease-in-out infinite;
}

.nav-label {
  font-size: 10px;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  opacity: 0.9;
}

@keyframes iconPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.main-content {
  position: relative;
  z-index: 10;
  flex: 1;
  height: 100%;
  min-width: 0;
}

.panel-wrapper {
  width: 100%;
  height: 100%;
}

.loading-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to bottom, #0f0c29 0%, #302b63 50%, #24243e 100%);
}

.loading-content {
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.nav-bottom {
  padding: 12px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.avatar-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.nav-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nav-avatar-default {
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}
</style>