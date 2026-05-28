<template>
  <div class="reminder-trigger" @click="open">
    <span>{{ displayText }}</span>
    <svg class="trigger-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </div>
  <Teleport to="body">
    <div v-if="visible" class="reminder-overlay" @click.self="cancel">
      <div class="reminder-dialog">
        <div class="reminder-columns">
          <div class="reminder-col">
            <div class="reminder-col-list" ref="dayListRef" @scroll="onDayScroll" @scrollend="onDayScrollEnd">
              <div class="reminder-spacer" v-for="n in 2" :key="'ds'+n"></div>
              <div v-for="d in 31" :key="d - 1"
                class="reminder-item" :class="{ active: draft.days === d - 1 }"
                @click="selectDay(d - 1)">{{ d - 1 }}</div>
              <div class="reminder-spacer" v-for="n in 2" :key="'de'+n"></div>
            </div>
            <span class="reminder-col-unit">天</span>
          </div>
          <div class="reminder-col">
            <div class="reminder-col-list" ref="hourListRef" @scroll="onHourScroll" @scrollend="onHourScrollEnd">
              <div class="reminder-spacer" v-for="n in 2" :key="'hs'+n"></div>
              <div v-for="h in 24" :key="h - 1"
                class="reminder-item" :class="{ active: draft.hours === h - 1 }"
                @click="selectHour(h - 1)">{{ h - 1 }}</div>
              <div class="reminder-spacer" v-for="n in 2" :key="'he'+n"></div>
            </div>
            <span class="reminder-col-unit">时</span>
          </div>
          <div class="reminder-col">
            <div class="reminder-col-list" ref="minuteListRef" @scroll="onMinuteScroll" @scrollend="onMinuteScrollEnd">
              <div class="reminder-spacer" v-for="n in 2" :key="'ms'+n"></div>
              <div v-for="m in 60" :key="m - 1"
                class="reminder-item" :class="{ active: draft.minutes === m - 1 }"
                @click="selectMinute(m - 1)">{{ m - 1 }}</div>
              <div class="reminder-spacer" v-for="n in 2" :key="'me'+n"></div>
            </div>
            <span class="reminder-col-unit">分</span>
          </div>
        </div>
        <div class="reminder-actions">
          <el-button size="small" @click="cancel">取消</el-button>
          <el-button size="small" type="primary" @click="save">保存</el-button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, reactive } from 'vue'

interface ReminderTime {
  days: number
  hours: number
  minutes: number
}

const props = defineProps<{
  modelValue: ReminderTime
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
  if (days === 0 && hours === 0 && minutes === 0) return '不提醒'
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  return parts.length ? parts.join('') : '0分钟'
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
.reminder-trigger:hover { border-color: rgba(102, 126, 234, 0.5); }
.trigger-arrow { width: 14px; height: 14px; opacity: 0.5; flex-shrink: 0; }

.reminder-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.reminder-dialog {
  background: rgba(20, 20, 45, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 16px;
  min-width: 300px;
}

.reminder-columns { display: flex; gap: 0; }
.reminder-col { flex: 1; display: flex; align-items: center; }

.reminder-col-list {
  height: 160px;
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
  transition: all 0.15s;
}
.reminder-item:hover { background: rgba(102, 126, 234, 0.15); color: #fff; }
.reminder-item.active { color: #667eea; font-weight: 700; }

.reminder-col-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  padding: 0 6px;
  flex-shrink: 0;
}

.reminder-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
}
</style>