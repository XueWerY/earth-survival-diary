<template>
  <div class="task-card diary-card" :class="{ 'task-card-pinned': record.pinned }">
    <div class="task-card-row">
      <span class="task-card-name">{{ record.icon || '📖' }} {{ record.name }}</span>
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
    <div v-if="record.notes" class="task-card-notes">{{ record.notes }}</div>
  </div>
</template>

<script setup lang="ts">
import { Delete, Edit, Star, StarFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Task } from '../../stores/taskStore'

const props = defineProps<{
  record: Task
}>()

const emit = defineEmits<{
  'delete': [id: string]
  'edit': [record: Task]
  'star': [record: Task]
}>()

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
  height: 100%;
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

.task-card-diary-time {
  font-size: 12px;
  color: var(--chalk-blue);
  margin-top: 6px;
}

.task-card-content {
  font-size: 13px;
  color: var(--chalk-white-70);
  margin-top: 6px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.task-card-notes {
  font-size: 12px;
  color: var(--chalk-subtle);
  margin-top: 6px;
  line-height: 1.4;
}
</style>
