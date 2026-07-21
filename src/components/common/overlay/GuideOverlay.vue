<template>
  <div class="guide-overlay" v-if="visible">
    <div class="guide-mask-top" :style="maskTopStyle" />
    <div class="guide-mask-bottom" :style="maskBottomStyle" />
    <div class="guide-mask-left" :style="maskLeftStyle" />
    <div class="guide-mask-right" :style="maskRightStyle" />
    <div class="guide-spotlight-blocker" :style="spotlightBlockerStyle" />
    <div class="guide-spotlight-border" :style="spotlightStyle" />
    <div class="guide-tooltip" :style="tooltipStyle" v-if="visible">
      <div class="guide-step-badge">{{ currentIndex + 1 }} / {{ steps.length }}</div>
      <h3 class="guide-step-title">{{ currentStep.title }}</h3>
      <p class="guide-step-desc">{{ currentStep.description }}</p>
      <div class="guide-actions">
        <el-button size="small" plain round @click="skip">
          <el-icon><Close /></el-icon>跳过引导
        </el-button>
        <el-button v-if="currentIndex > 0" size="small" round @click="prev">
          <el-icon><ArrowLeft /></el-icon>上一步
        </el-button>
        <el-button size="small" type="primary" round @click="next">
          <template v-if="currentIndex < steps.length - 1">下一步<el-icon><ArrowRight /></el-icon></template>
          <template v-else>完成<el-icon><Check /></el-icon></template>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Close, ArrowLeft, ArrowRight, Check } from '@element-plus/icons-vue'

export interface GuideStep {
  route: string
  selector: string
  title: string
  description: string
  padding?: number
  tooltipPosition?: 'bottom-right' | 'bottom-center' | 'top-center' | 'right-center'
  onActivate?: () => void
}

const props = defineProps<{
  steps: GuideStep[]
  visible: boolean
  currentIndex: number
}>()

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'skip'): void
}>()

const spotlight = ref({ x: 0, y: 0, w: 0, h: 0 })
const foundTarget = ref(false)
const isDesktop = computed(() => {
  if (typeof window === 'undefined') return false
  const cap = (window as any).Capacitor
  return !(cap && cap.isNativePlatform && cap.isNativePlatform())
})
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryCount = 0
const MAX_RETRIES = 15

const currentStep = computed(() => {
  if (props.currentIndex >= 0 && props.currentIndex < props.steps.length) {
    return props.steps[props.currentIndex]
  }
  return { route: '', selector: '', title: '', description: '' }
})

const maskTopStyle = computed(() => ({
  height: spotlight.value.y + 'px'
}))

const maskBottomStyle = computed(() => ({
  top: (spotlight.value.y + spotlight.value.h) + 'px'
}))

const maskLeftStyle = computed(() => ({
  top: spotlight.value.y + 'px',
  height: spotlight.value.h + 'px',
  width: spotlight.value.x + 'px'
}))

const maskRightStyle = computed(() => ({
  top: spotlight.value.y + 'px',
  left: (spotlight.value.x + spotlight.value.w) + 'px',
  height: spotlight.value.h + 'px'
}))

const spotlightStyle = computed(() => ({
  left: spotlight.value.x + 'px',
  top: spotlight.value.y + 'px',
  width: spotlight.value.w + 'px',
  height: spotlight.value.h + 'px',
  opacity: foundTarget.value ? 1 : 0
}))

const spotlightBlockerStyle = computed(() => ({
  left: spotlight.value.x + 'px',
  top: spotlight.value.y + 'px',
  width: spotlight.value.w + 'px',
  height: spotlight.value.h + 'px'
}))

const tooltipStyle = computed(() => {
  const gap = 16
  const pos = currentStep.value.tooltipPosition
  // 桌面端 right-center：在高亮区域右侧垂直居中
  if (pos === 'right-center' && isDesktop.value) {
    return {
      left: (spotlight.value.x + spotlight.value.w + gap) + 'px',
      top: (spotlight.value.y + spotlight.value.h / 2) + 'px',
      transform: 'translateY(-50%)',
      right: 'auto',
      bottom: 'auto'
    }
  }
  if (pos === 'top-center' || pos === 'bottom-center' || pos === 'right-center') {
    const targetMidY = spotlight.value.y + spotlight.value.h / 2
    const viewportMid = window.innerHeight / 2
    if (targetMidY > viewportMid) {
      // 中线在下半屏 → 显示在上方
      return {
        bottom: (window.innerHeight - spotlight.value.y + gap) + 'px',
        left: '50%',
        transform: 'translateX(-50%)',
        right: 'auto',
        top: 'auto'
      }
    }
    // 中线在上半屏 → 显示在下方
    return {
      top: (spotlight.value.y + spotlight.value.h + gap) + 'px',
      left: '50%',
      transform: 'translateX(-50%)',
      right: 'auto',
      bottom: 'auto'
    }
  }
  return {}
})

const locateTarget = () => {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }

  const step = currentStep.value
  if (!step.selector) {
    foundTarget.value = false
    return
  }

  const el = document.querySelector(step.selector) as HTMLElement | null
  if (!el) {
    foundTarget.value = false
    retryCount++
    if (retryCount >= MAX_RETRIES) {
      retryCount = 0
      emit('next')
      return
    }
    retryTimer = setTimeout(locateTarget, 200)
    return
  }

  retryCount = 0

  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const pad = step.padding ?? 8

  if (rect.bottom > vh || rect.top < 0) {
    el.scrollIntoView({ behavior: 'instant', block: 'center' })
  }

  const r2 = el.getBoundingClientRect()
  const sx = Math.max(0, r2.x - pad)
  const sy = Math.max(0, r2.y - pad)
  const sw = Math.min(vw - sx, r2.width + pad * 2)
  const sh = Math.min(vh - sy, r2.height + pad * 2)

  spotlight.value = { x: sx, y: sy, w: sw, h: sh }
  foundTarget.value = true
}

watch(() => props.currentIndex, () => {
  retryCount = 0
  nextTick(() => {
    currentStep.value.onActivate?.()
    setTimeout(locateTarget, 350)
  })
})

watch(() => props.visible, (v) => {
  if (v) {
    nextTick(() => {
      setTimeout(locateTarget, 400)
    })
  } else {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }
})

const skip = () => emit('skip')
const prev = () => emit('prev')
const next = () => emit('next')

let resizeHandler: (() => void) | null = null

onMounted(() => {
  resizeHandler = () => {
    if (props.visible) {
      locateTarget()
    }
  }
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  if (retryTimer) clearTimeout(retryTimer)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
})
</script>

<style scoped>
.guide-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}

.guide-mask-top,
.guide-mask-bottom,
.guide-mask-left,
.guide-mask-right {
  position: fixed;
  background: rgba(0, 0, 0, 0.65);
  pointer-events: auto;
  z-index: 10000;
  transition: all 0.3s ease;
}

.guide-mask-top {
  left: 0;
  right: 0;
  top: 0;
}

.guide-mask-bottom {
  left: 0;
  right: 0;
  bottom: 0;
}

.guide-mask-left {
  left: 0;
}

.guide-mask-right {
  right: 0;
}

.guide-spotlight-blocker {
  position: fixed;
  z-index: 10001;
  pointer-events: auto;
  background: transparent;
  transition: all 0.3s ease;
}

.guide-spotlight-border {
  position: fixed;
  z-index: 10001;
  border: 2px solid #667eea;
  border-radius: 10px;
  box-shadow: 0 0 16px rgba(102, 126, 234, 0.4), 0 0 4px rgba(102, 126, 234, 0.2);
  pointer-events: none;
  transition: all 0.3s ease;
}

.guide-tooltip {
  position: fixed;
  z-index: 10002;
  width: 320px;
  background: linear-gradient(135deg, #1a1a3e 0%, #252550 100%);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 14px;
  padding: 24px 20px 20px;
  pointer-events: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.guide-step-badge {
  display: inline-block;
  font-size: 12px;
  color: #667eea;
  background: rgba(102, 126, 234, 0.12);
  padding: 2px 10px;
  border-radius: 10px;
  margin-bottom: 12px;
}

.guide-step-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px;
}

.guide-step-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.6;
  margin: 0 0 20px;
}

.guide-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}
</style>