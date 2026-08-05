<template>
  <div class="reminder-trigger" @click="open">
    <span>{{ displayText }}</span>
    <svg class="trigger-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </div>
  <BaseDialog :visible="visible" title="设置提醒时间" :width="360" teleport @update:visible="visible = $event">
    <div class="reminder-columns">
      <div class="reminder-col">
        <div class="reminder-col-list" ref="dayListRef" @scroll="onDayScroll" @scrollend="onDayScrollEnd">
          <div class="reminder-spacer" v-for="n in 1" :key="'ds'+n"></div>
          <div v-for="d in 31" :key="d - 1"
            class="reminder-item" :class="{ active: draft.days === d - 1 }"
            @click="selectDay(d - 1)">{{ d - 1 }}</div>
          <div class="reminder-spacer" v-for="n in 1" :key="'de'+n"></div>
        </div>
        <span class="reminder-col-unit">天</span>
      </div>
      <div class="reminder-col">
        <div class="reminder-col-list" ref="hourListRef" @scroll="onHourScroll" @scrollend="onHourScrollEnd">
          <div class="reminder-spacer" v-for="n in 1" :key="'hs'+n"></div>
          <div v-for="h in 24" :key="h - 1"
            class="reminder-item" :class="{ active: draft.hours === h - 1 }"
            @click="selectHour(h - 1)">{{ h - 1 }}</div>
          <div class="reminder-spacer" v-for="n in 1" :key="'he'+n"></div>
        </div>
        <span class="reminder-col-unit">时</span>
      </div>
      <div class="reminder-col">
        <div class="reminder-col-list" ref="minuteListRef" @scroll="onMinuteScroll" @scrollend="onMinuteScrollEnd">
          <div class="reminder-spacer" v-for="n in 1" :key="'ms'+n"></div>
          <div v-for="m in 60" :key="m - 1"
            class="reminder-item" :class="{ active: draft.minutes === m - 1 }"
            @click="selectMinute(m - 1)">{{ m - 1 }}</div>
          <div class="reminder-spacer" v-for="n in 1" :key="'me'+n"></div>
        </div>
        <span class="reminder-col-unit">分</span>
      </div>
    </div>
    <template #footer>
      <button class="capsule-btn cancel-btn" @click="cancel">取消</button>
      <button class="capsule-btn submit-btn" @click="save">保存</button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, reactive } from 'vue'
import BaseDialog from '../../ui/BaseDialog.vue'

interface ReminderTime {
  days: number
  hours: number
  minutes: number
}

const props = defineProps<{
  modelValue: ReminderTime
  prefix?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ReminderTime]
}>()

const visible = ref(false)
const dayListRef = ref<HTMLElement | null>(null)
const hourListRef = ref<HTMLElement | null>(null)
const minuteListRef = ref<HTMLElement | null>(null)

const draft = reactive<ReminderTime>({ days: 0, hours: 0, minutes: 0 })

const ITEM_HEIGHT = 32

const displayText = computed(() => {
  const { days, hours, minutes } = props.modelValue
  let text: string
  if (days === 0 && hours === 0 && minutes === 0) text = '准时提醒'
  else {
    const parts: string[] = []
    if (days > 0) parts.push(`${days}天`)
    if (hours > 0) parts.push(`${hours}小时`)
    if (minutes > 0) parts.push(`${minutes}分钟`)
    text = parts.length ? parts.join('') : '0分钟'
  }
  return props.prefix ? `${props.prefix} ${text}` : text
})

function open() {
  draft.days = props.modelValue.days
  draft.hours = props.modelValue.hours
  draft.minutes = props.modelValue.minutes
  visible.value = true
  nextTick(() => {
    scrollToActive(dayListRef.value, draft.days)
    scrollToActive(hourListRef.value, draft.hours)
    scrollToActive(minuteListRef.value, draft.minutes)
  })
}

function scrollToActive(el: HTMLElement | null, idx: number) {
  if (!el) return
  el.scrollTop = idx * ITEM_HEIGHT
}

function selectDay(d: number) {
  draft.days = d
  nextTick(() => scrollToActive(dayListRef.value, d))
}
function selectHour(h: number) {
  draft.hours = h
  nextTick(() => scrollToActive(hourListRef.value, h))
}
function selectMinute(m: number) {
  draft.minutes = m
  nextTick(() => scrollToActive(minuteListRef.value, m))
}

function onDayScroll() {
  if (!dayListRef.value) return
  const idx = Math.round(dayListRef.value.scrollTop / ITEM_HEIGHT)
  const clamped = Math.max(0, Math.min(idx, 30))
  if (clamped !== draft.days) {
    draft.days = clamped
  }
}

function onHourScroll() {
  if (!hourListRef.value) return
  const idx = Math.round(hourListRef.value.scrollTop / ITEM_HEIGHT)
  const clamped = Math.max(0, Math.min(idx, 23))
  if (clamped !== draft.hours) {
    draft.hours = clamped
  }
}

function onMinuteScroll() {
  if (!minuteListRef.value) return
  const idx = Math.round(minuteListRef.value.scrollTop / ITEM_HEIGHT)
  const clamped = Math.max(0, Math.min(idx, 59))
  if (clamped !== draft.minutes) {
    draft.minutes = clamped
  }
}

function onDayScrollEnd() {
  if (!dayListRef.value) return
  const idx = Math.round(dayListRef.value.scrollTop / ITEM_HEIGHT)
  const clamped = Math.max(0, Math.min(idx, 30))
  draft.days = clamped
  scrollToActive(dayListRef.value, clamped)
}

function onHourScrollEnd() {
  if (!hourListRef.value) return
  const idx = Math.round(hourListRef.value.scrollTop / ITEM_HEIGHT)
  const clamped = Math.max(0, Math.min(idx, 23))
  draft.hours = clamped
  scrollToActive(hourListRef.value, clamped)
}

function onMinuteScrollEnd() {
  if (!minuteListRef.value) return
  const idx = Math.round(minuteListRef.value.scrollTop / ITEM_HEIGHT)
  const clamped = Math.max(0, Math.min(idx, 59))
  draft.minutes = clamped
  scrollToActive(minuteListRef.value, clamped)
}

function save() {
  emit('update:modelValue', { days: draft.days, hours: draft.hours, minutes: draft.minutes })
  visible.value = false
}

function cancel() {
  visible.value = false
}
</script>

<style scoped>
.reminder-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 32px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.trigger-arrow { width: 14px; height: 14px; opacity: 0.5; flex-shrink: 0; }

.reminder-columns { display: flex; gap: 0; padding-top: 8px; }
.reminder-col { flex: 1; display: flex; align-items: center; }

.reminder-col-list {
  height: 96px;
  overflow-y: auto;
  scrollbar-width: none;
  flex: 1;
}
.reminder-col-list::-webkit-scrollbar { display: none; }
.reminder-spacer { height: 32px; flex-shrink: 0; }

.reminder-item {
  height: 32px;
  line-height: 32px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  border-radius: 4px;
  text-align: center;
}
.reminder-item.active { color: #667eea; font-weight: 700; }

.reminder-col-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  padding: 0 6px;
  flex-shrink: 0;
}

.capsule-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}

.submit-btn {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.4);
  color: #93c5fd;
}
</style>