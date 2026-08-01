<template>
  <div class="note-card" :class="{ pinned: isPinned }">
    <div class="note-card-row1">
      <span class="note-card-title" :title="note.title">{{ note.title }}</span>
      <div class="note-card-actions">
        <button class="card-icon-btn" :title="isPinned ? '取消置顶' : '置顶'" @click.stop="$emit('togglePin')">
          <el-icon><Star v-if="isPinned" /><StarFilled v-else /></el-icon>
        </button>
        <button class="card-icon-btn" title="编辑" @click.stop="$emit('edit')">
          <el-icon><Edit /></el-icon>
        </button>
        <button class="card-icon-btn danger" title="删除" @click.stop="$emit('delete')">
          <el-icon><Delete /></el-icon>
        </button>
      </div>
    </div>
    <div class="note-card-meta">{{ pageCount }} 个标题，全文 {{ wordCount }} 字</div>
    <div class="note-card-meta-time">创建于{{ format(createdAt) }} · 修改于{{ format(updatedAt) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Star, StarFilled, Edit, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { extractMdOutline, getMdPlainText } from '../../stores/noteStore'
import type { Note } from '../../stores/noteStore'

const props = defineProps<{
  note: Note
  isPinned?: boolean
}>()

defineEmits<{
  (e: 'togglePin'): void
  (e: 'edit'): void
  (e: 'delete'): void
}>()

const createdAt = computed(() => props.note.createdAt)
const updatedAt = computed(() => props.note.updatedAt)

const pageCount = computed(() => extractMdOutline(props.note.content).length)
const wordCount = computed(() => {
  const text = getMdPlainText(props.note.content)
  return text.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length
})

const format = (date: string): string => {
  const d = dayjs(date)
  const cur = dayjs()
  const diffMin = cur.diff(d, 'minute')
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return d.format('YYYY-MM-DD')
}
</script>

<style scoped>
.note-card {
  position: relative;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px 16px;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 72px;
  overflow: hidden;
}

.note-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
}

.note-card.pinned {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.06), rgba(255, 255, 255, 0.04));
  border-color: rgba(251, 191, 36, 0.18);
}

.note-card-row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
}

.note-card-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.note-card:hover .note-card-actions {
  opacity: 1;
}

.note-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--chalk-white);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.note-card-meta {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: var(--chalk-muted);
}

.note-card-meta-time {
  margin-top: 4px;
  font-size: 11px;
  color: var(--chalk-muted);
  opacity: 0.85;
}

.card-icon-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--chalk-white-70);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.15s;
}

.card-icon-btn:hover {
  background: rgba(102, 126, 234, 0.3);
  color: var(--chalk-white);
}

.card-icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}
</style>
