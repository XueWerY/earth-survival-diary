<template>
  <el-popover
    :visible="visible"
    placement="bottom-start"
    :width="300"
    trigger="click"
    :show-arrow="false"
    :popper-class="'reminder-picker-popper'"
    @show="visible = true"
    @hide="visible = false"
  >
    <template #reference>
      <div class="reminder-picker-trigger" @click="visible = !visible">
        <span>{{ displayText }}</span>
      </div>
    </template>
    <div class="reminder-picker-panel">
      <div class="picker-columns">
        <div class="picker-column">
          <div class="picker-column-label">天</div>
          <div class="picker-column-list">
            <div
              v-for="d in 31"
              :key="d - 1"
              class="picker-item"
              :class="{ active: modelValue.days === d - 1 }"
              @click="selectDay(d - 1)"
            >{{ d - 1 }}</div>
          </div>
        </div>
        <div class="picker-column">
          <div class="picker-column-label">时</div>
          <div class="picker-column-list">
            <div
              v-for="h in 24"
              :key="h - 1"
              class="picker-item"
              :class="{ active: modelValue.hours === h - 1 }"
              @click="selectHour(h - 1)"
            >{{ h - 1 }}</div>
          </div>
        </div>
        <div class="picker-column">
          <div class="picker-column-label">分</div>
          <div class="picker-column-list">
            <div
              v-for="m in 60"
              :key="m - 1"
              class="picker-item"
              :class="{ active: modelValue.minutes === m - 1 }"
              @click="selectMinute(m - 1)"
            >{{ m - 1 }}</div>
          </div>
        </div>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

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

const displayText = computed(() => {
  const { days, hours, minutes } = props.modelValue
  if (days === 0 && hours === 0 && minutes === 0) return '0 分钟'
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  return parts.join(' ') || '0 分钟'
})

function selectDay(d: number) {
  emit('update:modelValue', { ...props.modelValue, days: d })
}

function selectHour(h: number) {
  emit('update:modelValue', { ...props.modelValue, hours: h })
}

function selectMinute(m: number) {
  emit('update:modelValue', { ...props.modelValue, minutes: m })
}
</script>

<style>
.reminder-picker-popper {
  background: rgba(20, 20, 45, 0.98) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  padding: 0 !important;
}
</style>

<style scoped>
.reminder-picker-trigger {
  display: flex;
  align-items: center;
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
}
.reminder-picker-trigger:hover {
  border-color: rgba(102, 126, 234, 0.5);
}

.reminder-picker-panel {
  padding: 8px;
}

.picker-columns {
  display: flex;
  gap: 4px;
}

.picker-column {
  flex: 1;
  text-align: center;
}

.picker-column-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  padding: 4px 0 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 4px;
}

.picker-column-list {
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}
.picker-column-list::-webkit-scrollbar {
  width: 4px;
}
.picker-column-list::-webkit-scrollbar-track {
  background: transparent;
}
.picker-column-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

.picker-item {
  padding: 4px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}
.picker-item:hover {
  background: rgba(102, 126, 234, 0.15);
  color: #fff;
}
.picker-item.active {
  background: rgba(102, 126, 234, 0.25);
  color: #667eea;
  font-weight: 500;
}
</style>