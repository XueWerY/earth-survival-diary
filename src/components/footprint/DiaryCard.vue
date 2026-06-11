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
      <span v-else class="task-card-name" @dblclick="emit('start-name-edit', record)">{{ record.name }}</span>
      <div class="task-card-actions">
        <el-button :icon="Delete" circle size="small" class="task-card-btn" @click.stop="emit('delete', record.id)" />
      </div>
    </div>
    <span class="task-card-diary-time">创建于 {{ formatDiaryTime(record.createdAt) }}</span>
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