<template>
  <div class="guide-overlay" v-if="visible">
    <div class="guide-mask-top" :style="maskTopStyle" />
    <div class="guide-mask-bottom" :style="maskBottomStyle" />
    <div class="guide-mask-left" :style="maskLeftStyle" />
    <div class="guide-mask-right" :style="maskRightStyle" />
    <div class="guide-spotlight-blocker" :style="spotlightBlockerStyle" />
    <div class="guide-spotlight-border" :style="spotlightStyle" />
    <div class="guide-tooltip" ref="tooltipRef" :style="tooltipStyle" v-if="visible" @mousedown="onTooltipDragStart">
      <div class="guide-tooltip-header">
        <div class="guide-step-badge">{{ currentIndex + 1 }} / {{ steps.length }}</div>
        <button class="guide-exit-btn" :disabled="navigating" @click="emit('exit')" title="退出引导">
          <el-icon><X /></el-icon>
        </button>
      </div>
      <h3 class="guide-step-title">{{ currentStep.title }}</h3>
      <p class="guide-step-desc" v-html="currentStep.description"></p>
      <p v-if="targetMissing" class="guide-target-missing">
        当前区域暂未显示或无法定位，可以重新定位，或继续浏览后续步骤。
        <button type="button" :disabled="navigating" @click="retryTarget">重新定位</button>
      </p>
      <div class="guide-actions">
        <el-button size="small" plain :disabled="navigating" @click="skip">
          <el-icon><X /></el-icon> 跳过引导
        </el-button>
        <el-button v-if="currentIndex > 0" size="small" :disabled="navigating" @click="prev">
          <el-icon><ArrowLeft /></el-icon> 上一步
        </el-button>
        <el-button size="small" type="primary" :disabled="navigating" @click="next">
          <template v-if="currentIndex < steps.length - 1">下一步 <el-icon><ArrowRight /></el-icon></template>
          <template v-else>完成<el-icon><Check /></el-icon></template>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { X, ArrowLeft, ArrowRight, Check } from '@lucide/vue'
import { logger } from '../../../lib/logger'

export interface GuideStep {
  route: string
  selector: string
  title: string
  description: string
  padding?: number
  tooltipPosition?: 'bottom-right' | 'bottom-center' | 'bottom-left' | 'top-center' | 'right-center' | 'fixed-bottom-right' | 'left-top' | 'center'
  tooltipGap?: number
  fallbackSelector?: string
  fallbackTitle?: string
  fallbackDescription?: string
  onActivate?: () => void | Promise<void>
}

const props = defineProps<{
  steps: GuideStep[]
  visible: boolean
  currentIndex: number
  navigating?: boolean
}>()

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'skip'): void
  (e: 'exit'): void
}>()

const spotlight = ref({ x: 0, y: 0, w: 0, h: 0 })
const foundTarget = ref(false)
const targetMissing = ref(false)
const usingFallback = ref(false)
const tooltipRef = ref<HTMLElement | null>(null)
const dragPos = ref<{ left: number; top: number } | null>(null)
let retryTimer: ReturnType<typeof setTimeout> | null = null
let activationTimer: ReturnType<typeof setTimeout> | null = null
let retryCount = 0
let activationSerial = 0
const MAX_RETRIES = 15

const currentStep = computed(() => {
  if (props.currentIndex >= 0 && props.currentIndex < props.steps.length) {
    const step = props.steps[props.currentIndex]
    if (usingFallback.value) {
      return {
        ...step,
        title: step.fallbackTitle || step.title,
        description: step.fallbackDescription || step.description
      }
    }
    return step
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
  if (targetMissing.value) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      right: 'auto',
      bottom: 'auto'
    }
  }
  if (dragPos.value) {
    return {
      left: dragPos.value.left + 'px',
      top: dragPos.value.top + 'px',
      transform: 'none',
      right: 'auto',
      bottom: 'auto'
    }
  }
  const pos = currentStep.value.tooltipPosition || 'bottom-center'
  // 窗口右下角固定
  if (pos === 'fixed-bottom-right') {
    return {
      bottom: '20px',
      right: '20px',
      left: 'auto',
      top: 'auto',
      transform: 'none'
    }
  }
  // 左侧上对齐
  if (pos === 'left-top') {
    return {
      right: (window.innerWidth - spotlight.value.x + 20) + 'px',
      top: spotlight.value.y + 'px',
      left: 'auto',
      bottom: 'auto',
      transform: 'none'
    }
  }
  // 窗口居中
  if (pos === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      right: 'auto',
      bottom: 'auto'
    }
  }
  const gap = currentStep.value.tooltipGap ?? 16
  // 底部左对齐
  if (pos === 'bottom-left') {
    return {
      top: (spotlight.value.y + spotlight.value.h + gap) + 'px',
      left: spotlight.value.x + 'px',
      transform: 'none',
      right: 'auto',
      bottom: 'auto'
    }
  }
  // 底部右对齐
  if (pos === 'bottom-right') {
    return {
      top: (spotlight.value.y + spotlight.value.h + gap) + 'px',
      left: 'auto',
      right: (window.innerWidth - (spotlight.value.x + spotlight.value.w)) + 'px',
      transform: 'none',
      bottom: 'auto'
    }
  }
  // 桌面端 right-center：在高亮区域右侧垂直居中
  if (pos === 'right-center') {
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

const findVisibleTarget = (selector: string): HTMLElement | null => {
  try {
    const elements = document.querySelectorAll<HTMLElement>(selector)
    for (const element of elements) {
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) !== 0 &&
        element.getAttribute('aria-hidden') !== 'true'
      ) return element
    }
  } catch {
    // An invalid selector is treated as a missing target so the guide can still be continued.
  }
  return null
}

const clampTooltipToViewport = () => {
  nextTick(() => {
    const element = tooltipRef.value
    if (!element) return
    const rect = element.getBoundingClientRect()
    const margin = 12
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin)
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin)
    const left = Math.min(Math.max(rect.left, margin), maxLeft)
    const top = Math.min(Math.max(rect.top, margin), maxTop)
    if (Math.abs(left - rect.left) > 1 || Math.abs(top - rect.top) > 1) {
      dragPos.value = { left, top }
    }
  })
}

const locateTarget = () => {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }

  const step = props.steps[props.currentIndex]
  if (!step || !step.selector) {
    foundTarget.value = false
    targetMissing.value = true
    return
  }

  const primaryTarget = findVisibleTarget(step.selector)
  const fallbackTarget = primaryTarget ? null : (step.fallbackSelector ? findVisibleTarget(step.fallbackSelector) : null)
  const el = primaryTarget || fallbackTarget
  if (!el) {
    foundTarget.value = false
    if (retryCount >= MAX_RETRIES) {
      retryCount = 0
      targetMissing.value = true
      return
    }
    retryCount++
    retryTimer = setTimeout(locateTarget, 200)
    return
  }

  retryCount = 0
  targetMissing.value = false
  usingFallback.value = !primaryTarget && !!fallbackTarget

  const vw = window.innerWidth
  const vh = window.innerHeight
  const pad = step.padding ?? 8

  let rect = el.getBoundingClientRect()
  if (rect.bottom > vh || rect.top < 0 || rect.right > vw || rect.left < 0) {
    el.scrollIntoView({ behavior: 'instant', block: 'center' })
    rect = el.getBoundingClientRect()
  }

  const sx = Math.max(0, rect.left - pad)
  const sy = Math.max(0, rect.top - pad)
  const right = Math.min(vw, rect.right + pad)
  const bottom = Math.min(vh, rect.bottom + pad)
  const sw = Math.max(0, right - sx)
  const sh = Math.max(0, bottom - sy)

  if (sw === 0 || sh === 0) {
    foundTarget.value = false
    targetMissing.value = true
    return
  }
  spotlight.value = { x: sx, y: sy, w: sw, h: sh }
  foundTarget.value = true
  clampTooltipToViewport()
}

watch([() => props.visible, () => props.currentIndex], async ([visible]) => {
  const serial = ++activationSerial
  if (retryTimer) clearTimeout(retryTimer)
  if (activationTimer) clearTimeout(activationTimer)
  retryTimer = null
  activationTimer = null
  retryCount = 0
  dragPos.value = null
  foundTarget.value = false
  targetMissing.value = false
  usingFallback.value = false
  spotlight.value = { x: 0, y: 0, w: 0, h: 0 }
  if (!visible) return

  await nextTick()
  if (serial !== activationSerial || !props.visible) return
  try {
    await props.steps[props.currentIndex]?.onActivate?.()
  } catch (error) {
    logger.warn('[Guide] 步骤初始化失败', { error: error instanceof Error ? error.message : String(error) })
    targetMissing.value = true
    return
  }
  await nextTick()
  if (serial !== activationSerial || !props.visible) return
  activationTimer = setTimeout(() => {
    if (serial === activationSerial && props.visible) locateTarget()
  }, 100)
}, { immediate: true })

const retryTarget = () => {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  retryCount = 0
  targetMissing.value = false
  usingFallback.value = false
  locateTarget()
}

const skip = () => emit('skip')
const prev = () => emit('prev')
const next = () => emit('next')

const onTooltipDragStart = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.guide-exit-btn')) return
  if (!(e.target as HTMLElement).closest('.guide-step-title, .guide-step-desc, .guide-step-badge')) return
  const el = tooltipRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const startX = e.clientX
  const startY = e.clientY
  const startLeft = rect.left
  const startTop = rect.top
  dragPos.value = { left: startLeft, top: startTop }

  const onMove = (ev: MouseEvent) => {
    let left = startLeft + ev.clientX - startX
    let top = startTop + ev.clientY - startY
    const r = el.getBoundingClientRect()
    left = Math.max(0, Math.min(left, window.innerWidth - r.width))
    top = Math.max(0, Math.min(top, window.innerHeight - r.height))
    dragPos.value = { left, top }
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  e.preventDefault()
}

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
  if (activationTimer) clearTimeout(activationTimer)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
})
</script>

<style scoped>
.guide-overlay {
  position: fixed;
  inset: 0;
  z-index: 20999;
  pointer-events: none;
}

.guide-mask-top,
.guide-mask-bottom,
.guide-mask-left,
.guide-mask-right {
  position: fixed;
  background: rgba(0, 0, 0, 0.65);
  pointer-events: auto;
  z-index: 21000;
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
  z-index: 21001;
  pointer-events: auto;
  background: transparent;
  transition: all 0.3s ease;
}

.guide-spotlight-border {
  position: fixed;
  z-index: 21001;
  border: 2px solid #667eea;
  border-radius: 10px;
  box-shadow: 0 0 16px rgba(102, 126, 234, 0.4), 0 0 4px rgba(102, 126, 234, 0.2);
  pointer-events: none;
  transition: all 0.3s ease;
}

.guide-tooltip {
  position: fixed;
  z-index: 21002;
  width: 320px;
  background: linear-gradient(135deg, #1a1a3e 0%, #252550 100%);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 14px;
  padding: 24px 20px 20px;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  pointer-events: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.guide-target-missing {
  margin: -8px 0 16px;
  color: #fbbf24;
  font-size: 12px;
  line-height: 1.5;
}

.guide-target-missing button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #a5b4fc;
  cursor: pointer;
  text-decoration: underline;
}

.guide-tooltip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.guide-exit-btn {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  padding: 2px;
  transition: color 0.2s, background 0.2s;
}

.guide-exit-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.08);
}

.guide-step-badge {
  display: inline-block;
  font-size: 12px;
  color: #667eea;
  background: rgba(102, 126, 234, 0.12);
  padding: 2px 10px;
  border-radius: 10px;
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

.guide-actions :deep(.el-button) {
  border-radius: 8px;
}
</style>
