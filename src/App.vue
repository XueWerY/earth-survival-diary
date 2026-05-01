<template>
  <div class="app-container">
    <!-- 更新通知 -->
    <div v-if="updateStatus" class="update-notification" :class="'update-' + updateStatus.status">
      <span class="update-text">
        <template v-if="updateStatus.status === 'available'">发现新版本 {{ updateStatus.version }}，正在下载...</template>
        <template v-else-if="updateStatus.status === 'downloading'">正在下载更新 {{ updateStatus.percent }}%
          <div class="update-progress-bar"><div class="update-progress-fill" :style="{ width: updateStatus.percent + '%' }"></div></div>
        </template>
        <template v-else-if="updateStatus.status === 'downloaded'">更新已下载完成，重启后生效</template>
        <template v-else-if="updateStatus.status === 'error'">更新失败: {{ updateStatus.message }}</template>
      </span>
      <button v-if="updateStatus.status === 'downloaded'" class="update-btn" @click="installUpdate">立即重启</button>
    </div>

    <!-- 星空背景 - 始终存在但通过 CSS 控制显示 -->
    <canvas ref="starCanvas" class="star-canvas" :class="{ 'canvas-hidden': !showStarCanvas }"></canvas>

    <!-- 未登录时显示登录页面 -->
    <template v-if="!authStore.isAuthenticated && !authStore.loading">
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
      <!-- 顶部导航栏 -->
      <nav class="top-nav" :class="{ 'nav-hidden': isFocusFullscreen }">
        <div class="nav-scroll-container" ref="navScrollContainer">
          <div class="nav-menu">
            <!-- 足迹记录 -->
            <div
                class="nav-item"
                :class="{ active: currentPage === 'footprint' }"
                :ref="setNavItemRef"
                @click="switchPage('footprint')"
            >
              <span class="nav-label">足迹</span>
            </div>

            <!-- 专注时光 -->
            <div
                class="nav-item"
                :class="{ active: currentPage === 'focus' }"
                :ref="setNavItemRef"
                @click="switchPage('focus')"
            >
              <span class="nav-label">专注</span>
            </div>

            <!-- 清单 -->
            <div
                class="nav-item"
                :class="{ active: currentPage === 'mission' }"
                :ref="setNavItemRef"
                @click="switchPage('mission')"
            >
              <span class="nav-label">清单</span>
            </div>

            <!-- 星际里程碑 -->
            <div
                class="nav-item"
                :class="{ active: currentPage === 'countdown' }"
                :ref="setNavItemRef"
                @click="switchPage('countdown')"
            >
              <span class="nav-label">倒数日</span>
            </div>

            <!-- 课程表 -->
            <div
                class="nav-item"
                :class="{ active: currentPage === 'course' }"
                :ref="setNavItemRef"
                @click="switchPage('course')"
            >
              <span class="nav-label">课程表</span>
            </div>

            <!-- 笔记 -->
            <div
                class="nav-item"
                :class="{ active: currentPage === 'notes' }"
                :ref="setNavItemRef"
                @click="switchPage('notes')"
            >
              <span class="nav-label">笔记</span>
            </div>

            <!-- 统计 -->
            <div
                class="nav-item"
                :class="{ active: currentPage === 'statistics' }"
                :ref="setNavItemRef"
                @click="switchPage('statistics')"
            >
              <span class="nav-label">统计</span>
            </div>

            <!-- 关于 -->
            <div
                class="nav-item"
                :class="{ active: currentPage === 'about' }"
                :ref="setNavItemRef"
                @click="switchPage('about')"
            >
              <span class="nav-label">关于</span>
            </div>

            <!-- 我的 -->
            <div
                class="nav-item"
                :class="{ active: currentPage === 'profile' }"
                :ref="setNavItemRef"
                @click="switchPage('profile')"
            >
              <span class="nav-label">我的</span>
            </div>
          </div>
          <div class="scroll-shadow-left" :class="{ 'shadow-hidden': !showLeftShadow }"></div>
          <div class="scroll-shadow-right" :class="{ 'shadow-hidden': !showRightShadow }"></div>
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
          <NotesPage v-else-if="currentPage === 'notes'" />
          <StatisticsPage v-else-if="currentPage === 'statistics'" />
          <ProfilePage v-else-if="currentPage === 'profile'" @logout="handleLogout" />
          <AboutPage v-else-if="currentPage === 'about'" />
        </div>
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import TaskList from './components/TaskList.vue'
import MissionList from './components/MissionList.vue'
import CountdownList from './components/CountdownList.vue'
import CourseSchedule from './components/CourseSchedule.vue'
import FocusTimer from './components/FocusTimer.vue'
import AuthPage from './components/AuthPage.vue'
import ProfilePage from './components/ProfilePage.vue'
import AboutPage from './components/AboutPage.vue'
import NotesPage from './components/NotesPage.vue'
import StatisticsPage from './components/StatisticsPage.vue'
import { initCourseAutoRecord } from './composables/useCourseAutoRecord'
import { useTaskStore } from './stores/taskStore'
import { useMissionStore } from './stores/missionStore'
import { useAuthStore } from './stores/authStore'
import { useSettingsStore } from './stores/settingsStore'
import { useFocusStore } from './stores/focusStore'
import { getData, preloadData, clearCache, getSystemStateField, setSystemStateField } from './services/storageService'
import { logger } from './lib/logger'

const taskStore = useTaskStore()
const missionStore = useMissionStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const focusStore = useFocusStore()

const navScrollContainer = ref<HTMLElement>()
const navItems = ref<HTMLElement[]>([])
const showLeftShadow = ref(false)
const showRightShadow = ref(false)
const isNavOverflow = ref(false)
const updateStatus = ref<UpdateStatus | null>(null)

function installUpdate() {
  window.electronAPI.installUpdate()
}

const setNavItemRef = (el: any) => {
  if (el) {
    navItems.value.push(el)
  }
}

const scrollNavToCenter = () => {
  nextTick(() => {
    const container = navScrollContainer.value
    if (!container) return
    
    const containerWidth = container.clientWidth
    const scrollWidth = container.scrollWidth
    
    // 如果内容宽度小于等于容器宽度，居中由CSS控制
    if (scrollWidth <= containerWidth) {
      container.scrollLeft = 0
      return
    }
    
    // 找到当前激活的导航项
    const activeIndex = navItems.value.findIndex(
      item => item.classList.contains('active')
    )
    
    if (activeIndex === -1) return
    
    const activeItem = navItems.value[activeIndex]
    const itemOffsetLeft = activeItem.offsetLeft
    const itemWidth = activeItem.offsetWidth
    
    const scrollTarget = itemOffsetLeft - (containerWidth / 2) + (itemWidth / 2)
    
    container.scrollTo({
      left: scrollTarget,
      behavior: 'smooth'
    })
  })
}

let isNavDragging = false
let navDragStartX = 0
let navDragScrollLeft = 0

const checkNavOverflow = () => {
  const el = navScrollContainer.value
  if (!el) return
  isNavOverflow.value = el.scrollWidth > el.clientWidth
  updateNavShadows()
}

const updateNavShadows = () => {
  const el = navScrollContainer.value
  if (!el) return
  isNavOverflow.value = el.scrollWidth > el.clientWidth
  const { scrollLeft, scrollWidth, clientWidth } = el
  showLeftShadow.value = scrollLeft > 2
  showRightShadow.value = scrollLeft < scrollWidth - clientWidth - 2
}

const initNavDrag = () => {
  const el = navScrollContainer.value
  if (!el) return

  // 拦截非左键的默认行为（中键自动滚动、右键菜单等）
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, { capture: true })

  el.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isNavDragging = true
      navDragStartX = e.pageX
      navDragScrollLeft = el.scrollLeft
      el.style.cursor = 'grabbing'
      el.style.userSelect = 'none'
    }
  })

  window.addEventListener('mousemove', (e) => {
    if (!isNavDragging) return
    e.preventDefault()
    const x = e.pageX
    const walk = navDragStartX - x
    const newScroll = navDragScrollLeft + walk
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollLeft = Math.max(0, Math.min(maxScroll, newScroll))
    updateNavShadows()
  })

  const endDrag = () => {
    if (!isNavDragging) return
    isNavDragging = false
    el.style.cursor = ''
    el.style.userSelect = ''
    updateNavShadows()
  }

  window.addEventListener('mouseup', endDrag)
  window.addEventListener('mouseleave', endDrag)

  let touchStartX = 0
  let touchScrollLeft = 0
  let isTouchDragging = false

  el.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].pageX
    touchScrollLeft = el.scrollLeft
    isTouchDragging = true
  }, { passive: true })

  el.addEventListener('touchmove', (e) => {
    if (!isTouchDragging) return
    const x = e.touches[0].pageX
    const walk = touchStartX - x
    const newScroll = touchScrollLeft + walk
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollLeft = Math.max(0, Math.min(maxScroll, newScroll))
    updateNavShadows()
  }, { passive: true })

  el.addEventListener('touchend', () => {
    isTouchDragging = false
    updateNavShadows()
  })

  el.addEventListener('scroll', updateNavShadows, { passive: true })

  // 禁用右键菜单
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })

  checkNavOverflow()
  window.addEventListener('resize', () => {
    checkNavOverflow()
    scrollNavToCenter()
  })
  
  // 初始化后滚动到当前激活项 - 增加延迟确保DOM完全渲染
  setTimeout(() => {
    scrollNavToCenter()
  }, 300)
}

// 星星画布显示条件
const showStarCanvas = computed(() => {
  return authStore.isAuthenticated
})

// 数据是否已初始化
const dataInitialized = ref(false)
const isInitializing = ref(false)

// 认证成功处理
const handleAuthSuccess = async () => {
  logger.info('[App] 登录/注册成功，初始化数据')
  // 先触发 UI 更新，等待 DOM 更新后再初始化数据
  await nextTick()
  await initializeData()
}

// 登出处理
const handleLogout = async () => {
  logger.info('[App] 用户退出登录')
  // 重置所有 store 状态
  taskStore.reset()
  missionStore.reset()
  focusStore.reset()
  settingsStore.reset()
  // 清除所有缓存数据
  clearCache()
  dataInitialized.value = false
}

const switchPage = (page: typeof currentPage.value) => {
  logger.info(`[App] 切换页面: ${page}`)
  currentPage.value = page
}

// 从服务器恢复页面状态
const initializeData = async () => {
  if (isInitializing.value) {
    logger.debug('[App] 初始化正在进行中，跳过重复调用')
    return
  }
  isInitializing.value = true
  logger.debug('[App] 开始初始化数据...')
  try {
    // 清除旧缓存，确保加载新用户数据
    clearCache()

    // 从服务器恢复页面状态
    try {
      const savedPage = await getSystemStateField('currentPage')
      if (savedPage && ['footprint', 'focus', 'mission', 'countdown', 'course', 'notes', 'statistics', 'profile', 'about'].includes(savedPage)) {
        currentPage.value = savedPage as any
        logger.debug('[App] 恢复页面状态:', { page: savedPage })
      }
    } catch {
      logger.debug('[App] 恢复失败，使用默认页面')
    }

    logger.debug('[App] 开始并行加载所有模块数据...')
    // 并行加载所有模块数据
    await Promise.all([
      taskStore.loadTasks(),
      missionStore.loadData(),
      settingsStore.loadSettings(),
      focusStore.loadData(),
      preloadCountdownData(),
      preloadCourseData(),
    ])

    logger.debug('[App] 并行加载完成，初始化课程自动记录...')
    await initCourseAutoRecordFromStorage()
    logger.info('[App] 数据初始化完成')
  } catch (error) {
    logger.error('[App] 初始化数据失败:', { error: error instanceof Error ? error.message : String(error) })
  } finally {
    dataInitialized.value = true
    logger.debug('[App] dataInitialized 已设置为 true')
  }
}

// 预加载倒数日数据
const preloadCountdownData = async () => {
  const [milestones, categories] = await Promise.all([
    getData('countdown', 'countdowns'),
    getData('countdown', 'categories')
  ])
  if (milestones) preloadData('countdown', 'countdowns', milestones)
  if (categories) preloadData('countdown', 'categories', categories)
}

// 预加载课程表数据
const preloadCourseData = async () => {
  const [courses, recordedCourses] = await Promise.all([
    getData('course', 'courses'),
    getData('course', 'recorded-courses')
  ])
  if (courses) preloadData('course', 'courses', courses)
  if (recordedCourses) preloadData('course', 'recorded-courses', recordedCourses)
}

// 从 Redis 恢复页面状态
const currentPage = ref<'footprint' | 'focus' | 'mission' | 'countdown' | 'course' | 'notes' | 'statistics' | 'profile' | 'about'>('footprint')

// 监听认证状态变化，当用户登录成功时初始化数据
watch(
    () => authStore.isAuthenticated,
    async (isAuthenticated, wasAuthenticated) => {
      logger.debug('[App] isAuthenticated 变化:', { wasAuthenticated, isAuthenticated, dataInitialized: dataInitialized.value })
      if (isAuthenticated && !wasAuthenticated && !dataInitialized.value) {
        logger.info('[App] 检测到用户登录，开始初始化数据')
        await initializeData()
      }
    }
)

// 监听页面切换，保存到 Redis
watch(currentPage, async (newPage) => {
  await setSystemStateField('currentPage', newPage)
  scrollNavToCenter()
})

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
    const savedCourses = await getData<any[]>('course', 'courses')

    if (savedCourses) {
      const settingsStore = useSettingsStore()
      await settingsStore.loadSettings()
      const semesterStartDate = settingsStore.settings.course?.semesterStartDate || null
      await initCourseAutoRecord(savedCourses, semesterStartDate)
    }
  } catch (e) {
    logger.error('Failed to init course auto record:', { error: e instanceof Error ? e.message : String(e) })
  }
}

onMounted(async () => {

  window.electronAPI?.onUpdateStatus((data) => {
    updateStatus.value = data
  })

  // 先初始化认证状态
  await authStore.init()

  // 如果已登录，初始化数据
  if (authStore.isAuthenticated) {
    await initializeData()
  }

  // 初始化导航栏拖拽滑动
  initNavDrag()
  updateNavShadows()

  // 滚动到当前激活的导航项
  nextTick(() => {
    scrollNavToCenter()
  })

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
  flex-direction: column;
}

/* 更新通知 */
.update-notification {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 14px;
  color: #fff;
}
.update-available, .update-downloading {
  background: rgba(59, 130, 246, 0.95);
}
.update-downloaded {
  background: rgba(34, 197, 94, 0.95);
}
.update-error {
  background: rgba(239, 68, 68, 0.95);
}
.update-progress-bar {
  width: 200px;
  height: 4px;
  background: rgba(255,255,255,0.3);
  border-radius: 2px;
  margin-top: 6px;
}
.update-progress-fill {
  height: 100%;
  background: #fff;
  border-radius: 2px;
  transition: width 0.3s;
}
.update-btn {
  padding: 4px 16px;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.update-btn:hover {
  background: rgba(255,255,255,0.3);
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

.canvas-hidden {
  display: none;
}

/* 顶部导航栏 */
.top-nav {
  position: relative;
  z-index: 20;
  width: 100%;
  height: 56px;
  background: rgba(15, 12, 41, 0.6);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
  overflow: visible;
  transition: opacity 0.3s, height 0.3s, margin 0.3s;
}

.top-nav.nav-hidden {
  opacity: 0;
  height: 0;
  margin-top: -56px;
  pointer-events: none;
}

.nav-scroll-container {
  flex: 1;
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  cursor: grab;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-user-select: none;
  user-select: none;
  display: flex;
}

.nav-scroll-container::-webkit-scrollbar {
  display: none;
}

.nav-menu {
  padding: 6px 8px;
  display: flex;
  flex-direction: row;
  gap: 4px;
  align-items: center;
  width: max-content;
  margin: 0 auto;
}

.scroll-shadow-left,
.scroll-shadow-right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 30px;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 5;
}

.scroll-shadow-left {
  left: 0;
  background: linear-gradient(to right, rgba(15, 12, 41, 0.8) 0%, transparent 100%);
}

.scroll-shadow-right {
  right: 0;
  background: linear-gradient(to left, rgba(15, 12, 41, 0.8) 0%, transparent 100%);
}

.shadow-hidden {
  opacity: 0;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.nav-item.active {
  color: #fff;
  background: rgba(102, 126, 234, 0.2);
}

.nav-label {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.main-content {
  position: relative;
  z-index: 10;
  flex: 1;
  min-height: 0;
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
</style>
