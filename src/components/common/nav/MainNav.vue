<template>
  <div
    ref="navBarRef"
    class="main-nav-bar"
    :class="[`nav-${variant}`, { 'nav-hidden': hidden, 'no-hover': noHover, 'collapsed': collapsed && variant === 'left' }]"
    @click.capture="onClickCapture"
  >
    <div class="nav-items-scroll" ref="scrollRef">
      <button
        v-for="m in MODULES"
        :key="m"
        class="nav-item"
        :class="{ active: activeModule === m }"
        @click="emit('navigate', m)"
      >
        <span class="nav-item-icon">
          <component :is="MODULE_ICONS[m]" />
        </span>
        <span class="nav-item-label">{{ MODULE_LABELS[m] }}</span>
      </button>
      <button
        class="nav-item nav-split-item"
        :class="{ active: splitActive }"
        :title="splitActive ? '退出拆分界面' : '拆分界面'"
        @click="emit('split')"
      >
        <span class="nav-item-icon">
          <el-icon><Operation /></el-icon>
        </span>
        <span class="nav-item-label">{{ splitActive ? '合并' : '拆分' }}</span>
      </button>
    </div>
    <button
      v-if="variant === 'left'"
      class="nav-toggle"
      :title="collapsed ? '展开导航' : '收起导航'"
      @click="emit('toggle')"
    >
      <el-icon><component :is="collapsed ? Expand : Fold" /></el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Operation, Fold, Expand } from '@element-plus/icons-vue'
import { MODULES, MODULE_ICONS, MODULE_LABELS } from '../../../composables/usePageNav'

const props = withDefaults(defineProps<{
  activeModule: string
  variant?: 'left' | 'bottom' | 'split'
  hidden?: boolean
  noHover?: boolean
  splitActive?: boolean
  collapsed?: boolean
}>(), {
  variant: 'bottom',
  hidden: false,
  noHover: false,
  splitActive: false,
  collapsed: false,
})

const emit = defineEmits<{
  (e: 'navigate', module: string): void
  (e: 'split'): void
  (e: 'toggle'): void
}>()

const scrollRef = ref<HTMLElement | null>(null)
const navBarRef = ref<HTMLElement | null>(null)

const scrollToActive = () => {
  nextTick(() => {
    const container = scrollRef.value
    if (!container) return
    const activeItem = container.querySelector('.nav-item.active') as HTMLElement
    if (!activeItem) return
    if (props.variant === 'left') {
      const containerHeight = container.clientHeight
      const itemTop = activeItem.offsetTop
      const itemHeight = activeItem.offsetHeight
      container.scrollTo({ top: itemTop - containerHeight / 2 + itemHeight / 2, behavior: 'smooth' })
    } else {
      const containerWidth = container.clientWidth
      const itemLeft = activeItem.offsetLeft
      const itemWidth = activeItem.offsetWidth
      container.scrollTo({ left: itemLeft - containerWidth / 2 + itemWidth / 2, behavior: 'smooth' })
    }
  })
}

watch(() => props.activeModule, scrollToActive)

// 鼠标单击切换页面，长按左键进入左右滑动模式
const LONG_PRESS_MS = 300
let pressTimer: ReturnType<typeof setTimeout> | null = null
let longPressActive = false
let suppressClick = false
let dragStartX = 0
let dragStartScrollLeft = 0
let isPointerDown = false
let isCapturing = false

const onPointerDown = (e: PointerEvent) => {
  const container = scrollRef.value
  if (!container || container.scrollWidth <= container.clientWidth) return
  if (e.button !== 0) return
  isPointerDown = true
  longPressActive = false
  suppressClick = false
  dragStartX = e.clientX
  dragStartScrollLeft = container.scrollLeft
  // 长按超过阈值才进入滑动模式并捕获指针；短按不捕获，click 正常触发导航切换
  pressTimer = setTimeout(() => {
    longPressActive = true
    suppressClick = true
    try {
      navBarRef.value?.setPointerCapture(e.pointerId)
      isCapturing = true
    } catch { /* noop */ }
  }, LONG_PRESS_MS)
}

const onPointerMove = (e: PointerEvent) => {
  if (!isPointerDown || !longPressActive) return
  const container = scrollRef.value
  if (!container) return
  const dx = e.clientX - dragStartX
  if (Math.abs(dx) > 4) suppressClick = true
  container.scrollLeft = dragStartScrollLeft - dx
}

const onPointerUp = (e: PointerEvent) => {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
  if (!isPointerDown) return
  isPointerDown = false
  if (isCapturing) {
    try { navBarRef.value?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
    isCapturing = false
  }
}

// 长按/滑动后阻止随后的点击触发导航项切换；短按点击正常触发
const onClickCapture = (e: MouseEvent) => {
  if (suppressClick) {
    e.preventDefault()
    e.stopPropagation()
    suppressClick = false
  }
}

onMounted(() => {
  const el = navBarRef.value
  el?.addEventListener('pointerdown', onPointerDown)
  el?.addEventListener('pointermove', onPointerMove)
  el?.addEventListener('pointerup', onPointerUp)
  el?.addEventListener('pointercancel', onPointerUp)
})
onBeforeUnmount(() => {
  const el = navBarRef.value
  el?.removeEventListener('pointerdown', onPointerDown)
  el?.removeEventListener('pointermove', onPointerMove)
  el?.removeEventListener('pointerup', onPointerUp)
  el?.removeEventListener('pointercancel', onPointerUp)
})
</script>

<style scoped>
.main-nav-bar {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  transition: opacity 0.3s, height 0.3s, width 0.3s;
  overflow: hidden;
}

/* === 桌面端左侧垂直导航栏 === */
.nav-left {
  width: 120px;
  height: 100%;
  margin: 0;
  border-radius: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

/* 左侧导航栏收起态：仅显示图标 */
.nav-left.collapsed {
  width: 64px;
}

.nav-left.collapsed .nav-item-label {
  display: none;
}

.nav-left.collapsed .nav-items-scroll {
  align-items: center;
  padding-left: 0;
  padding-right: 0;
}

.nav-left.collapsed .nav-item {
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}

/* 收起/展开按钮：位于导航栏底部 */
.nav-toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px 0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  transition: all 0.15s;
}

.nav-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-85);
}

.nav-toggle .el-icon {
  font-size: 18px;
}

/* 桌面端导航栏已移至底部常驻浮条，左侧 logo+标题已移除 */

/* === 移动端底部水平导航栏（透明固定浮层，默认隐藏） === */
.nav-bottom {
  width: 500px;
  max-width: calc(100vw - 50px);
  margin: 0 auto;
  border-top: none;
  border-radius: 16px;
  /* 透明浮层：移除背景/模糊/边框/阴影 */
  background: transparent;
  backdrop-filter: none;
  border: none;
  box-shadow: none;
  position: fixed;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
}

/* === 桌面端底部常驻浮条（fixed 透明浮层，距底 25px） === */
.main-nav-bar.desktop-dock {
  position: fixed;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  width: 500px;
  max-width: calc(100vw - 50px);
  margin: 0;
  border-top: none;
  border-radius: 16px;
  /* 透明浮层：移除背景、模糊、边框、阴影 */
  background: transparent;
  backdrop-filter: none;
  border: none;
  box-shadow: none;
}

.main-nav-bar.desktop-dock.nav-hidden {
  opacity: 0;
  pointer-events: none;
  height: auto;
}

/* 所有平台统一样式：上方图标，下方标签（与 Electron 桌面端一致） */
.desktop-dock .nav-item,
.nav-bottom .nav-item,
.nav-split .nav-item {
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  width: auto;
}

.desktop-dock .nav-item-label,
.nav-bottom .nav-item-label,
.nav-split .nav-item-label {
  font-size: 12px;
}

/* === 拆分面板底部导航区（顶部内容区 + 底部导航区，撑满拆分面板宽度） === */
.nav-split {
  position: relative;
  width: 100%;
  flex-shrink: 0;
  margin: 0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0;
  background: var(--chalk-white-04);
  backdrop-filter: none;
  box-shadow: none;
}

/* === 桌面端左侧导航栏收起状态 === */
/* 折叠态已随左侧导航栏移除 */

/* === 收起/展开按钮 === */
/* 收起/展开按钮已随左侧导航栏移除 */

@media (max-width: 500px) {
  .nav-bottom {
    width: 80%;
  }
}

/* === 隐藏状态 === */
.nav-hidden {
  opacity: 0;
  pointer-events: none;
}

.nav-bottom.nav-hidden {
  opacity: 0;
  pointer-events: none;
  height: auto;
}

.nav-left.nav-hidden {
  width: 0;
  min-width: 0;
}

.nav-split.nav-hidden {
  height: 0;
  min-height: 0;
}

/* === 导航项滚动容器 === */
.nav-items-scroll {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  padding: 4px 12px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.nav-items-scroll::-webkit-scrollbar {
  display: none;
}

/* 垂直导航栏：纵向滚动，垂直居中 */
.nav-left .nav-items-scroll {
  flex: 1;
  flex-direction: column;
  justify-content: center;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 10px 8px 12px;
  gap: 8px;
}

/* 底部导航栏：溢出时左对齐，否则居中 */
.nav-bottom .nav-items-scroll,
.nav-split .nav-items-scroll {
  justify-content: flex-start;
}

.nav-bottom .nav-items-scroll::before,
.nav-bottom .nav-items-scroll::after,
.nav-split .nav-items-scroll::before,
.nav-split .nav-items-scroll::after {
  content: '';
  flex: 1;
  min-width: 0;
}

/* === 导航项 === */
.nav-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
  width: 100%;
  min-width: 0;
}

.nav-item:not(.active):hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-85);
}

/* 桌面端取消鼠标悬停效果（高亮项除外） */
.no-hover .nav-item:hover {
  background: transparent;
  color: var(--chalk-white-60);
}
.no-hover .nav-item.active:hover {
  background: rgba(102, 126, 234, 0.18);
  color: var(--chalk-white);
}

.nav-item.active {
  background: rgba(102, 126, 234, 0.18);
  color: var(--chalk-white);
  font-weight: 600;
}

.nav-item-icon {
  font-size: 18px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-item-icon svg {
  width: 18px;
  height: 18px;
}

.nav-item-label {
  font-size: 13px;
  line-height: 1;
}
</style>
