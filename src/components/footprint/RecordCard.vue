<template>
  <div class="task-card" :class="{ 'task-card-pinned': record.pinned }">
    <div class="task-card-row">
      <template v-if="isEditingName">
        <textarea
          :value="editingNameValue"
          @input="emit('update:editing-name-value', ($event.target as HTMLTextAreaElement).value)"
          class="inline-edit-textarea"
          @blur="emit('save-name-edit', record)"
          @keydown.escape.prevent="emit('save-name-edit', record)"
          rows="2"
        />
      </template>
      <span v-else class="task-card-name" @dblclick="emit('start-name-edit', record)">📝 {{ record.name }}</span>
      <div class="task-card-actions">
        <button class="card-btn card-btn-star" :class="{ starred: record.pinned }" @click.stop="emit('star', record)" title="星标">
          <el-icon><Star v-if="!record.pinned" /><StarFilled v-else /></el-icon>
        </button>
        <button class="card-btn card-btn-edit" @click.stop="emit('edit', record)" title="编辑">
          <el-icon><Edit /></el-icon>
        </button>
        <button class="card-btn card-btn-delete" @click.stop="emit('delete', record.id)" title="删除">
          <el-icon><Delete /></el-icon>
        </button>
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
import { Delete, Edit, Star, StarFilled } from '@element-plus/icons-vue'
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
  'edit': [record: Task]
  'star': [record: Task]
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

.task-card-pinned {
  background: rgba(241, 196, 15, 0.08) !important;
  border-color: rgba(241, 196, 15, 0.15) !important;
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
  gap: 2px;
  flex-shrink: 0;
}

.card-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.15s;
  color: var(--chalk-white-50);
}

.card-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--chalk-white);
}

.card-btn-star {
  color: rgba(251, 191, 36, 0.5);
}

.card-btn-star:hover {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}

.card-btn-star.starred {
  color: #fbbf24;
}

.card-btn-star.starred:hover {
  background: rgba(251, 191, 36, 0.15);
}

.card-btn-edit {
  color: rgba(102, 126, 234, 0.5);
}

.card-btn-edit:hover {
  color: #667eea;
  background: rgba(102, 126, 234, 0.12);
}

.card-btn-delete {
  color: rgba(239, 68, 68, 0.5);
}

.card-btn-delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
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