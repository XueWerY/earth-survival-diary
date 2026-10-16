<template>
  <div
    v-if="visible"
    ref="barRef"
    class="floating-timer-bar"
    :style="barStyle"
    @mousedown="handleMouseDown"
    @click="goFocus"
  >
    <span class="ft-type">{{ timerState.type === 'pomodoro' ? '🍅' : '⏱️' }}</span>
    <span class="ft-name" :title="timerState.name">{{ timerState.name }}</span>
    <span class="ft-time">{{ displayTime }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useFocusStore } from '../../stores/focusStore'
import { usePageNav } from '../../composables/usePageNav'

const focusStore = useFocusStore()
const pageNav = usePageNav()
const router = useRouter()

const now = ref(Date.now())
let interval: ReturnType<typeof setInterval> | null = null

const visible = computed(() => {
  const ts = focusStore.timerState
  if (!ts) return false
  return pageNav.currentModule.value !== 'focus'
})

const timerState = computed(() => focusStore.timerState!)

const displayTime = computed(() => {
  const ts = timerState.value
  if (!ts) return '00 00 00'
  const elapsed = Math.floor((now.value - ts.startTimestamp) / 1000)
  const s = Math.abs(elapsed)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h.toString().padStart(2, '0')} ${m.toString().padStart(2, '0')} ${sec.toString().padStart(2, '0')}`
})

// 默认保持窗口上方居中；拖动后保留自定义位置，并随窗口缩放限制在可视范围内。
const barRef = ref<HTMLElement | null>(null)
const pos = ref<{ left: number; top: number } | null>(null)
let hasDragged = false
let hasCustomPosition = false
let offsetX = 0; let offsetY = 0
let dragW = 0; let dragH = 0

const barStyle = computed(() => {
  if (!pos.value) return {}
  return {
    left: pos.value.left + 'px',
    top: pos.value.top + 'px',
    right: 'auto',
    bottom: 'auto',
    transform: 'none',
  }
})

const clampToViewport = (value: number, max: number) => Math.max(0, Math.min(value, max))
const syncPositionToWindow = () => {
  const element = barRef.value
  if (!element) return
  const { width, height } = element.getBoundingClientRect()
  if (!width || !height) return

  if (hasCustomPosition && pos.value) {
    pos.value = {
      left: clampToViewport(pos.value.left, window.innerWidth - width),
      top: clampToViewport(pos.value.top, window.innerHeight - height),
    }
    return
  }

  pos.value = {
    left: clampToViewport((window.innerWidth - width) / 2, window.innerWidth - width),
    top: clampToViewport(20, window.innerHeight - height),
  }
}

let resizeFrame = 0
const handleWindowResize = () => {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(syncPositionToWindow)
}

watch(visible, async (isVisible) => {
  if (!isVisible) {
    pos.value = null
    hasCustomPosition = false
    return
  }
  await nextTick()
  syncPositionToWindow()
}, { immediate: true, flush: 'post' })

const handleMouseDown = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  offsetX = e.clientX - rect.left
  offsetY = e.clientY - rect.top
  dragW = rect.width
  dragH = rect.height
  hasDragged = false
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!hasDragged && Math.abs(e.movementX) + Math.abs(e.movementY) > 2) hasDragged = true
  if (hasDragged) {
    hasCustomPosition = true
    const bw = dragW || 200
    const bh = dragH || 40
    pos.value = {
      left: Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - bw)),
      top: Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - bh)),
    }
  }
}

const handleMouseUp = () => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

const goFocus = () => {
  if (hasDragged) return
  if (pageNav.currentModule.value === 'focus') {
    pageNav.setNavPath(['focus'])
  } else {
    router.push('/focus')
  }
}

onMounted(() => {
  interval = setInterval(() => { now.value = Date.now() }, 1000)
  window.addEventListener('resize', handleWindowResize)
  syncPositionToWindow()
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
  window.removeEventListener('resize', handleWindowResize)
  cancelAnimationFrame(resizeFrame)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style scoped>
.floating-timer-bar {
  position: fixed;
  right: 25px;
  bottom: 25px;
  z-index: 2800;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 18px;
  background: rgba(12, 18, 38, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(102, 126, 234, 0.15);
  cursor: grab;
  user-select: none;
  transition: background 0.2s;
}

.ft-type,
.ft-name,
.ft-time {
  display: inline-flex;
  align-items: center;
  height: 24px;
  line-height: 24px;
  vertical-align: middle;
}

.floating-timer-bar:hover {
  background: rgba(16, 24, 50, 0.95);
}

.floating-timer-bar:active {
  cursor: grabbing;
}

.ft-name {
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(240px, 24vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.ft-time {
  flex: 0 0 auto;
  font-family: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
  font-size: 15px;
  font-weight: 700;
  color: #a78bfa;
  font-variant-numeric: tabular-nums;
}

.ft-type {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
</style>
