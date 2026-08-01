<template>
  <div class="task-card diary-card">
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
      <span v-else class="task-card-name" @dblclick="emit('start-name-edit', record)">{{ record.name }}</span>
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
    <span class="task-card-diary-time">创建于 {{ formatDiaryTime(record.createdAt) }}</span>
    <div v-if="(record as any).content" class="task-card-content">{{ (record as any).content }}</div>
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
import { Star, StarFilled, Edit, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
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
  'star': [record: Task]
  'edit': [record: Task]
}>()

const isEditingName = computed(() => props.editingNameId === props.record.id)
const isEditingNotes = computed(() => props.editingNotesId === props.record.id)

const formatDiaryTime = (createdAt?: string) => {
  if (!createdAt) return ''
  return dayjs(createdAt).format('HH:mm')
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
}

.task-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
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

.task-card-content {
  font-size: 13px;
  color: var(--chalk-white-70);
  margin-top: 6px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
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
</style>