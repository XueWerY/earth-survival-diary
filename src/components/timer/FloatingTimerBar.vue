<template>
  <div
    v-if="visible"
    ref="barRef"
    class="floating-timer-bar"
    :style="barStyle"
    @mousedown="handleMouseDown"
    @click="goFocus"
  >
    <span class="ft-name">{{ timerState.name }}</span>
    <span class="ft-time">{{ displayTime }}</span>
    <span class="ft-type">{{ timerState.type === 'pomodoro' ? '🍅' : '⏱️' }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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

// 拖动逻辑：仅允许移动位置，宽高锁定为按下时实测值，移动后位置持久化（不再回弹）
const barRef = ref<HTMLElement | null>(null)
const pos = ref<{ left: number; top: number } | null>(null)
const isDragging = ref(false)
let hasDragged = false
let offsetX = 0; let offsetY = 0
let dragW = 0; let dragH = 0

const barStyle = computed(() => {
  if (!pos.value) return {}
  // 锁定 right/bottom 为 auto，避免与 left/top 同时生效导致拉伸变形；
  // width/height 锁定为按下时实测值，确保宽高不可被修改。
  return {
    left: pos.value.left + 'px',
    top: pos.value.top + 'px',
    right: 'auto',
    bottom: 'auto',
    transform: 'none',
    width: dragW + 'px',
    height: dragH + 'px',
  }
})

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
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
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
  gap: 12px;
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

.floating-timer-bar:hover {
  background: rgba(16, 24, 50, 0.95);
}

.floating-timer-bar:active {
  cursor: grabbing;
}

.ft-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ft-time {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 15px;
  font-weight: 700;
  color: #a78bfa;
  font-variant-numeric: tabular-nums;
}

.ft-type {
  font-size: 14px;
}
</style>
