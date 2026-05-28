<template>
  <el-popover
    ref="popoverRef"
    placement="bottom"
    :width="popoverWidth"
    trigger="click"
    :teleported="true"
    :show-arrow="false"
    popper-class="time-picker-popover"
    @after-enter="onPopoverAfterEnter"
  >
    <template #reference>
      <div class="time-btn">
        {{ displayTime }}
      </div>
    </template>
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
        <el-button size="small" @click="cancel">取消</el-button>
        <el-button size="small" type="primary" @click="confirm">确定</el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'

const props = defineProps<{
  modelValue: string
  offsetMinutes?: number
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
const popoverRef = ref()

const ITEM_HEIGHT = 40
const SCROLL_OFFSET = 40

const popoverWidth = computed(() => {
  return 200
})

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

const displayTime = computed(() => props.modelValue || getCurrentTime())

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

function onPopoverAfterEnter() {
  const offset = props.offsetMinutes ?? 0
  const { hour, minute } = getTargetTime(offset)
  currentHour.value = hour
  currentMinute.value = minute
  requestAnimationFrame(() => {
    scrollToHour(hour)
    scrollToMinute(minute)
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
  popoverRef.value?.hide()
}

function cancel() {
  parseTime(props.modelValue)
  popoverRef.value?.hide()
}

onMounted(() => {
  nextTick(() => {
    parseTime(props.modelValue)
    scrollToHour(currentHour.value)
    scrollToMinute(currentMinute.value)
  })
})

defineExpose({ popoverRef })
</script>

<style scoped>
.drum-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.drum-container {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 4px 12px;
  width: 100%;
  overflow: hidden;
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
  gap: 12px;
  margin-top: 14px;
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
  border-color: rgba(102, 126, 234, 0.5);
}
</style>

<style>
.time-picker-popover {
  left: 50% !important;
  transform: translateX(-50%) !important;
}
</style>
