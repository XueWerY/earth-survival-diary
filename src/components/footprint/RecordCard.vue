<template>
  <div class="task-card">
    <div class="task-card-row">
      <template v-if="isEditingName">
        <textarea
          :value="editingNameValue"
          @input="emit('update:editing-name-value', ($event.target as HTMLTextAreaElement).value)"
          class="inline-edit-textarea"
          @blur="emit('save-name-edit', record)"
          @keydown.escape.prevent="emit('cancel-name-edit')"
          rows="2"
        />
      </template>
      <span v-else class="task-card-name" @dblclick="emit('start-name-edit', record)">📝 {{ record.name }}</span>
      <div class="task-card-actions">
        <el-button :icon="Delete" circle size="small" class="task-card-btn" @click.stop="emit('delete', record.id)" />
      </div>
    </div>
    <span v-if="record.isDiary || record.category === 'diary'" class="task-card-diary-time">创建于 {{ formatDiaryTime(record.createdAt) }}</span>
    <div v-else class="task-card-time-row">
      <TimePickerPopover :model-value="record.startTime" @update:model-value="(v: string) => emit('update:start-time', record.id, v)" placeholder="开始" />
      <span class="time-sep">-</span>
      <TimePickerPopover :model-value="record.endTime" @update:model-value="(v: string) => emit('update:end-time', record.id, v)" placeholder="结束" />
      <span v-if="formatDurationLabel(record.startTime, record.endTime)" class="time-duration-label">{{ formatDurationLabel(record.startTime, record.endTime) }}</span>
    </div>
    <template v-if="isEditingNotes">
      <textarea
        :value="editingNotesValue"
        @input="emit('update:editing-notes-value', ($event.target as HTMLTextAreaElement).value)"
        class="inline-edit-textarea"
        @blur="emit('save-notes-edit', record)"
        @keydown.escape.prevent="emit('cancel-notes-edit')"
        rows="2"
        placeholder="添加备注"
      />
    </template>
    <template v-else>
      <div v-if="record.notes" class="task-card-notes" @dblclick="emit('start-notes-edit', record)">{{ record.notes }}</div>
      <div v-else class="task-card-notes task-card-notes-placeholder" @dblclick="emit('start-notes-edit', record)">双击添加备注</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import TimePickerPopover from '../common/picker/TimePickerPopover.vue'
import type { Task } from '../../stores/taskStore'

const props = defineProps<{
  record: Task
  editingNameId: string | null
  editingNameValue: string
  editingNotesId: string | null
  editingNotesValue: string
}>()

const emit = defineEmits<{
  'update:editing-name-value': [value: string]
  'update:editing-notes-value': [value: string]
  'start-name-edit': [record: Task]
  'save-name-edit': [record: Task]
  'cancel-name-edit': []
  'start-notes-edit': [record: Task]
  'save-notes-edit': [record: Task]
  'cancel-notes-edit': []
  'delete': [id: string]
  'update:start-time': [id: string, value: string]
  'update:end-time': [id: string, value: string]
}>()

const isEditingName = computed(() => props.editingNameId === props.record.id)
const isEditingNotes = computed(() => props.editingNotesId === props.record.id)

const formatDiaryTime = (createdAt?: string) => {
  if (!createdAt) return ''
  return dayjs(createdAt).format('HH:mm')
}

const formatDurationLabel = (startTime: string, endTime: string): string => {
  if (!startTime || !endTime) return ''
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm)
  if (totalMinutes <= 0) return ''
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `（共${hours}小时${minutes}分钟）`
  if (hours > 0) return `（共${hours}小时）`
  return `（共${minutes}分钟）`
}
</script>

<style scoped>
.task-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s;
  text-align: left;
  width: 100%;
}

.task-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.task-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.task-card-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--chalk-white);
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.task-card-actions {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.task-card-btn {
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
  padding: 0;
  background: none !important;
  border: none !important;
  color: var(--chalk-red) !important;
  box-shadow: none !important;
  font-size: 14px;
}

.task-card-btn:hover {
  color: var(--chalk-red) !important;
  background: transparent !important;
}

.task-card-btn:focus,
.task-card-btn:focus-visible,
.task-card-btn:active {
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
}

.task-card-time {
  font-size: 13px;
  color: var(--chalk-blue);
  font-weight: 500;
  margin-top: 6px;
}

.task-card-diary-time {
  font-size: 12px;
  color: var(--chalk-white-60);
  margin-top: 6px;
}

.task-card-notes {
  font-size: 12px;
  color: var(--chalk-subtle);
  margin-top: 6px;
  line-height: 1.4;
}

.task-card-notes-placeholder {
  cursor: pointer;
  font-style: italic;
  opacity: 0.4;
  user-select: none;
}

.task-card-notes-placeholder:hover {
  opacity: 0.7;
}

.task-card-time-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 13px;
}

.task-card-time-row :deep(.time-btn) {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  width: auto;
  height: auto;
  font-size: 13px;
  font-weight: 400;
  color: var(--chalk-blue);
}

.time-sep {
  color: var(--chalk-white-60);
  flex-shrink: 0;
}

.time-duration-label {
  color: var(--chalk-white-60);
  font-size: 12px;
  margin-left: 6px;
  flex-shrink: 0;
}

.inline-edit-textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 6px;
  color: var(--chalk-white);
  padding: 6px 10px;
  font-size: 14px;
  resize: vertical;
  font-family: inherit;
  outline: none;
  line-height: 1.4;
  box-sizing: border-box;
}

.inline-edit-textarea:focus {
  border-color: #667eea;
  background: rgba(255, 255, 255, 0.1);
}

.task-card-time :deep(span) { margin-left: 6px; }
</style>