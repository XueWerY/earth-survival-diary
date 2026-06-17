<template>
  <div class="reminder-card">
    <div class="reminder-card-header">
      <span class="reminder-icon">🔔</span>
      <span class="reminder-title">{{ title }}</span>
      <button class="reminder-close" @click="$emit('dismiss')">✕</button>
    </div>
    <div class="reminder-card-name">{{ reminder.name }}</div>
    <!-- 第三行：任务显示重复策略，课程显示提醒正文 -->
    <div v-if="type === 'task' && repeatText" class="reminder-card-row reminder-row-repeat">
      <span class="repeat-text">{{ repeatText }}</span>
      <span v-if="repeatEndText" class="repeat-end-text"> · {{ repeatEndText }}</span>
    </div>
    <div v-else-if="type === 'course'" class="reminder-card-row reminder-row-course">
      <span class="course-text">课程即将开始！</span>
    </div>
    <div v-else-if="type === 'focus'" class="reminder-card-row reminder-row-focus">
      <span class="focus-text">{{ reminder.body }}</span>
    </div>
    <div v-else-if="type === 'countdown'" class="reminder-card-row reminder-row-countdown">
      <span class="countdown-text">倒数日即将到达！</span>
    </div>
    <!-- 第四行：所属文件夹/清单/分组（有颜色） -->
    <div v-if="hasSource" class="reminder-card-row reminder-row-source">
      <span v-if="reminder.folderName" :style="{ color: getEntityColor(reminder.folderName, 'folder') }">{{ reminder.folderName }}</span>
      <span v-if="reminder.folderName && reminder.listName" class="source-sep"> / </span>
      <span v-if="reminder.listName" :style="{ color: getEntityColor(reminder.listName, 'list') }">{{ reminder.listName }}</span>
      <span v-if="reminder.listName && reminder.groupName" class="source-sep"> / </span>
      <span v-if="reminder.groupName" :style="{ color: getEntityColor(reminder.listName + ':' + reminder.groupName, 'group') }">{{ reminder.groupName }}</span>
    </div>
    <!-- 第五行：结束日期和时间 -->
    <div v-if="endDateText" class="reminder-card-row reminder-row-time">
      <span class="time-label">{{ endDateText.label }}</span>
      <span class="time-value">{{ endDateText.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useListStore } from '../../../stores/listStore'

const props = defineProps<{
  reminder: ReminderItem
}>()

defineEmits<{
  dismiss: []
}>()

const listStore = useListStore()

const type = computed(() => {
  if (props.reminder.id.startsWith('course-')) return 'course'
  if (props.reminder.id === 'focus-pomodoro' || props.reminder.id === 'focus-hourly') return 'focus'
  if (props.reminder.listName || props.reminder.folderName || props.reminder.groupName) return 'task'
  return 'countdown'
})

const title = computed(() => {
  switch (type.value) {
    case 'task': return '任务提醒'
    case 'course': return '课程提醒'
    case 'focus': return '专注提醒'
    case 'countdown': return '倒数日提醒'
  }
})

const repeatText = computed(() => {
  const s = props.reminder.repeatStrategy
  if (!s || s === 'none') return ''
  if (s === 'daily') return '每天重复'
  if (s === 'weekdays') return '工作日重复'
  if (s === 'weekly') return '每周重复'
  if (s === 'monthly') return '每月重复'
  if (s === 'yearly') return '每年重复'
  if (s === 'custom_days') return `每${props.reminder.repeatCustomDays}天重复`
  return ''
})

const repeatEndText = computed(() => {
  const es = props.reminder.repeatEndStrategy
  if (es === 'date' && props.reminder.repeatEndDate) {
    const d = props.reminder.repeatEndDate.slice(0, 10)
    return `截止 ${d} 结束`
  }
  if (es === 'count' && props.reminder.repeatCount) {
    const left = props.reminder.repeatCount - (props.reminder.repeatCompletedCount || 0)
    return `还有${left}次结束`
  }
  if (es === 'never') return '永不结束'
  return ''
})

const hasSource = computed(() => {
  return !!(props.reminder.folderName || props.reminder.listName || props.reminder.groupName)
})

function getEntityColor(name: string, kind: 'folder' | 'list' | 'group'): string {
  if (kind === 'folder') {
    const folder = listStore.folders.find(f => f.name === name)
    return folder?.color || '#667eea'
  }
  if (kind === 'list') {
    const l = listStore.taskLists.find(ll => ll.name === name)
    return l?.color || '#667eea'
  }
  // group — name is "listName:groupName" compound key
  const sepIdx = name.indexOf(':')
  const listName = name.substring(0, sepIdx)
  const gName = name.substring(sepIdx + 1)
  const list = listStore.taskLists.find(l => l.name === listName)
  if (!list) return '#667eea'
  const group = list.groups.find(g => g.name === gName)
  return group?.color || '#667eea'
}

// 解析 body 中的截止日期
function extractDeadlineFromBody(): string | null {
  const body = props.reminder.body
  if (!body) return null
  const match = body.match(/截止:\s*([\d-]+(?:\s+[\d:]+)?)/)
  return match ? match[1] : null
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const endDateText = computed<{ label: string; value: string } | null>(() => {
  if (type.value === 'task') {
    const deadline = extractDeadlineFromBody()
    if (deadline) return { label: '截止时间：', value: deadline }
    if (props.reminder.endTime && props.reminder.triggerTime) {
      const d = props.reminder.triggerTime.slice(0, 10)
      return { label: '截止时间：', value: `${d} ${props.reminder.endTime}` }
    }
    return null
  }
  if (type.value === 'course') {
    return { label: '上课时间：', value: formatTime(props.reminder.triggerTime) }
  }
  if (type.value === 'focus') {
    if (props.reminder.focusDuration) {
      return { label: '专注时长：', value: `${props.reminder.focusDuration} 分钟` }
    }
    return { label: '完成时间：', value: formatTime(props.reminder.triggerTime) }
  }
  // countdown — 使用实际倒数日目标日期，只显示日期不显示时间
  if (props.reminder.targetDate) {
    return { label: '目标日期：', value: props.reminder.targetDate.slice(0, 10) }
  }
  return null
})
</script>

<style scoped>
.reminder-card {
  width: 300px;
  background: rgba(20, 16, 55, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  animation: reminderSlideIn 0.3s ease-out;
  pointer-events: auto;
  overflow: hidden;
  padding: 14px 16px 12px;
}

@keyframes reminderSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reminder-card-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  margin-bottom: 10px;
}

.reminder-icon {
  font-size: 16px;
  margin-right: 6px;
  line-height: 1;
}

.reminder-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--chalk-amber);
  line-height: 1;
}

.reminder-close {
  position: absolute;
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  transition: color 0.2s;
}

.reminder-close:hover {
  color: rgba(255, 255, 255, 0.8);
}

.reminder-card-name {
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: var(--chalk-white);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reminder-card-row {
  text-align: center;
  font-size: 12px;
  line-height: 1.4;
  margin-bottom: 4px;
}

.reminder-row-repeat {
  color: var(--chalk-white-70);
}

.repeat-text {
  color: #d4b85a;
}

.repeat-end-text {
  color: var(--chalk-white-70);
}

.reminder-row-course .course-text {
  color: #8ab4f8;
}

.reminder-row-focus .focus-text {
  color: #a78bfa;
}

.reminder-row-countdown .countdown-text {
  color: #f97316;
}

.reminder-row-source {
  color: var(--chalk-white-70);
}

.source-sep {
  color: rgba(255, 255, 255, 0.3);
}

.reminder-row-time {
  color: var(--chalk-white-70);
}

.time-label {
  color: #d4b85a;
}

.time-value {
  color: var(--chalk-white-70);
}
</style>