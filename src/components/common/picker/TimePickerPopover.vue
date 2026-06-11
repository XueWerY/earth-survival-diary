<template>
  <div class="time-picker-wrapper">
    <div class="time-btn" @click="open">
      {{ displayTime }}
    </div>
    <Teleport to="body">
      <div v-if="visible" class="time-picker-overlay" @mousedown.self="cancel">
        <div class="drum-picker">
          <div class="drum-container">
            <div class="drum-scroll-wrapper">
              <div
                ref="hourScrollRef"
                class="drum-scroll"
                @scroll="onHourScroll"
                @scrollend="onHourScrollEnd"
              >
                <div class="drum-spacer"></div>
                <div
                  v-for="h in hours"
                  :key="h"
                  class="drum-item"
                  :class="{ 'drum-item-selected': currentHour === h }"
                  @click="selectHour(h)"
                >
                  {{ String(h).padStart(2, '0') }}
                </div>
                <div class="drum-spacer"></div>
              </div>
              <div class="drum-col-sep">:</div>
              <div
                ref="minuteScrollRef"
                class="drum-scroll"
                @scroll="onMinuteScroll"
                @scrollend="onMinuteScrollEnd"
              >
                <div class="drum-spacer"></div>
                <div
                  v-for="m in minutes"
                  :key="m"
                  class="drum-item"
                  :class="{ 'drum-item-selected': currentMinute === m }"
                  @click="selectMinute(m)"
                >
                  {{ String(m).padStart(2, '0') }}
                </div>
                <div class="drum-spacer"></div>
              </div>
            </div>
          </div>
          <div class="drum-actions">
            <button class="icon-capsule-btn" @click="cancel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span>取消</span>
            </button>
            <button class="icon-capsule-btn primary" @click="confirm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>确定</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onBeforeUnmount } from 'vue'

const props = defineProps<{
  modelValue: string
  offsetMinutes?: number
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 60 }, (_, i) => i)

const currentHour = ref(0)
const currentMinute = ref(0)
const hourScrollRef = ref<HTMLElement>()
const minuteScrollRef = ref<HTMLElement>()
const visible = ref(false)

const ITEM_HEIGHT = 40
const SCROLL_OFFSET = 40

function getCurrentTime(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function getTargetTime(offsetMin: number): { hour: number; minute: number } {
  const now = new Date()
  const totalMinutes = now.getHours() * 60 + now.getMinutes() + offsetMin
  const maxMinutes = 23 * 60 + 59
  const clamped = Math.min(totalMinutes, maxMinutes)
  return { hour: Math.floor(clamped / 60), minute: clamped % 60 }
}

const displayTime = computed(() => {
  if (props.modelValue) return props.modelValue
  if (props.placeholder) return props.placeholder
  return getCurrentTime()
})

function parseTime(time: string) {
  if (!time || !time.includes(':')) {
    currentHour.value = 0
    currentMinute.value = 0
    return
  }
  const [h, m] = time.split(':').map(Number)
  currentHour.value = isNaN(h) ? 0 : h
  currentMinute.value = isNaN(m) ? 0 : m
}

watch(() => props.modelValue, (val) => parseTime(val), { immediate: true })

function open() {
  visible.value = true
  const offset = props.offsetMinutes ?? 0
  const { hour, minute } = getTargetTime(offset)
  currentHour.value = hour
  currentMinute.value = minute
  nextTick(() => {
    requestAnimationFrame(() => {
      scrollToHour(hour)
      scrollToMinute(minute)
    })
  })
}

function scrollToHour(h: number) {
  if (hourScrollRef.value) {
    hourScrollRef.value.scrollTop = SCROLL_OFFSET + h * ITEM_HEIGHT
  }
}

function scrollToMinute(m: number) {
  if (minuteScrollRef.value) {
    minuteScrollRef.value.scrollTop = SCROLL_OFFSET + m * ITEM_HEIGHT
  }
}

function onHourScroll() {
  if (!hourScrollRef.value) return
  const scrollTop = hourScrollRef.value.scrollTop
  const idx = Math.round((scrollTop - SCROLL_OFFSET) / ITEM_HEIGHT)
  if (idx >= 0 && idx < 24) {
    currentHour.value = idx
  }
}

function onMinuteScroll() {
  if (!minuteScrollRef.value) return
  const scrollTop = minuteScrollRef.value.scrollTop
  const idx = Math.round((scrollTop - SCROLL_OFFSET) / ITEM_HEIGHT)
  if (idx >= 0 && idx < 60) {
    currentMinute.value = idx
  }
}

function onHourScrollEnd() {
  if (!hourScrollRef.value) return
  const scrollTop = hourScrollRef.value.scrollTop
  const idx = Math.round((scrollTop - SCROLL_OFFSET) / ITEM_HEIGHT)
  if (idx >= 0 && idx < 24) {
    currentHour.value = idx
    scrollToHour(idx)
  }
}

function onMinuteScrollEnd() {
  if (!minuteScrollRef.value) return
  const scrollTop = minuteScrollRef.value.scrollTop
  const idx = Math.round((scrollTop - SCROLL_OFFSET) / ITEM_HEIGHT)
  if (idx >= 0 && idx < 60) {
    currentMinute.value = idx
    scrollToMinute(idx)
  }
}

function selectHour(h: number) {
  currentHour.value = h
  scrollToHour(h)
}

function selectMinute(m: number) {
  currentMinute.value = m
  scrollToMinute(m)
}

function confirm() {
  const h = String(currentHour.value).padStart(2, '0')
  const m = String(currentMinute.value).padStart(2, '0')
  emit('update:modelValue', `${h}:${m}`)
  visible.value = false
}

function cancel() {
  parseTime(props.modelValue)
  visible.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && visible.value) {
    cancel()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
</script>

<style scoped>
.time-picker-wrapper {
  display: inline-block;
}

.drum-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.drum-container {
  padding: 4px 12px;
  width: 100%;
}

.drum-scroll-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drum-scroll {
  height: calc(40px * 3);
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  display: flex;
  flex-direction: column;
  align-items: center;
  scrollbar-width: none;
  flex: 1;
}

.drum-scroll::-webkit-scrollbar {
  display: none;
}

.drum-spacer {
  height: 80px;
  flex-shrink: 0;
}

.drum-item {
  height: 40px;
  line-height: 40px;
  text-align: center;
  font-size: 20px;
  color: var(--chalk-white-30);
  scroll-snap-align: center;
  cursor: pointer;
  width: 44px;
  flex-shrink: 0;
  transition: color 0.15s;
}

.drum-item.drum-item-selected {
  color: var(--chalk-primary);
  font-weight: 700;
}

.drum-col-sep {
  font-size: 24px;
  font-weight: 700;
  color: var(--chalk-primary);
  padding: 0 4px;
  flex-shrink: 0;
}

.drum-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.icon-capsule-btn {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-60);
  cursor: pointer;
  border-radius: 16px;
  transition: all 0.2s;
  flex-shrink: 0;
  font-size: 12px;
  -webkit-tap-highlight-color: transparent;
}

.icon-capsule-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--chalk-white);
}

.icon-capsule-btn.primary {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-primary);
}

.icon-capsule-btn.primary:hover {
  background: rgba(102, 126, 234, 0.35);
  color: var(--chalk-primary);
}

.icon-svg {
  width: 14px;
  height: 14px;
}

.time-btn {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--chalk-blue);
  font-weight: 700;
  cursor: pointer;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.time-btn:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.time-btn:focus,
.time-btn:focus-visible,
.time-btn:active {
  outline: none;
}

.time-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000;
  background: rgba(0, 0, 0, 0.3);
}

.time-picker-overlay > .drum-picker {
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
</style>