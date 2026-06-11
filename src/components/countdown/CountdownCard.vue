<template>
  <div class="milestone-card" :class="cardClasses" :style="cardStyle">
    <!-- 第一行：图标 + 名字 + 按钮（三区域） -->
    <div class="card-header">
      <div class="card-header-left">
        <span class="category-badge">{{ categoryIcon }}</span>
        <template v-if="isEditingName">
          <textarea
            ref="nameInputRef"
            :value="editingNameValue"
            class="inline-edit-textarea"
            @input="$emit('update:editingNameValue', ($event.target as HTMLTextAreaElement).value)"
            @blur="$emit('saveNameEdit')"
            @keydown.escape.prevent="$emit('cancelNameEdit')"
            @keydown.enter.prevent="$emit('saveNameEdit')"
            rows="2"
          />
        </template>
        <h3 v-else class="milestone-name" @dblclick="!compact && $emit('startNameEdit')">{{ milestone.name }}</h3>
      </div>
      <div v-if="!compact" class="card-actions">
        <button
          v-if="milestone.pinned"
          class="card-btn card-btn-starred"
          @click.stop="$emit('unpin')"
          title="取消星标"
        >
          <el-icon><Star /></el-icon>
        </button>
        <button
          v-else
          class="card-btn card-btn-star"
          @click.stop="$emit('pin')"
          title="设为星标"
        >
          <el-icon><Star /></el-icon>
        </button>
        <button class="card-btn card-btn-edit" @click.stop="$emit('edit')" title="编辑">
          <el-icon><Edit /></el-icon>
        </button>
        <button class="card-btn card-btn-delete" @click.stop="$emit('delete')" title="删除">
          <el-icon><Delete /></el-icon>
        </button>
      </div>
    </div>

    <!-- 日期行 -->
    <div class="milestone-date">
      <span class="date-plain-text" @click.stop="!compact && $emit('openDatePicker')">
        <el-icon><Calendar /></el-icon>
        {{ formatDate(milestone.targetDate) }}
      </span>
    </div>

    <!-- 元数据行（重复策略和提醒策略） -->
    <div v-if="milestone.countMode !== 'countup'" class="milestone-meta">
      <span class="meta-item repeat-text" @click.stop="!compact && $emit('toggleRepeat')">
        {{ milestone.repeatStrategy === 'yearly' ? '每年重复' : '不重复' }}
      </span>
      <span class="meta-separator">·</span>
      <template v-if="reminderLabel">
        <span class="meta-item reminder-has" @click.stop="!compact && $emit('openReminderPicker')">
          {{ reminderLabel }}
        </span>
      </template>
      <template v-else>
        <span class="meta-item reminder-none" @click.stop="!compact && $emit('openReminderPicker')">不提醒</span>
      </template>
    </div>

    <!-- "xx天" / "xx天后" 区域 -->
    <div class="countdown-display" :class="countdownDisplayClass">
      <span class="countdown-number">{{ countdownDays }}</span>
      <span class="countdown-unit">{{ countdownUnit }}</span>
    </div>

    <!-- 描述 -->
    <template v-if="isEditingDesc">
      <textarea
        ref="descInputRef"
        :value="editingDescValue"
        class="inline-edit-textarea desc-textarea"
        @input="$emit('update:editingDescValue', ($event.target as HTMLTextAreaElement).value)"
        @blur="$emit('saveDescEdit')"
        @keydown.escape.prevent="$emit('cancelDescEdit')"
        rows="2"
        placeholder="添加描述"
      />
    </template>
    <template v-else>
      <p v-if="milestone.description" class="milestone-desc" @dblclick="!compact && $emit('startDescEdit')">{{ milestone.description }}</p>
      <p v-else class="milestone-desc desc-placeholder" @dblclick="!compact && $emit('startDescEdit')">{{ compact ? '' : '双击添加描述' }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { Calendar, Star, Delete, Edit } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

interface Milestone {
  id: string
  name: string
  targetDate: string
  category: string
  description: string
  countMode?: 'countdown' | 'countup'
  pinned: boolean
  isSystem?: boolean
  createdAt: string
  updatedAt: string
  reminderStrategy?: string
  reminderDays?: number
  reminderHours?: number
  reminderMinutes?: number
  repeatStrategy?: string
}

const props = defineProps<{
  milestone: Milestone
  cardType: 'pinned' | 'upcoming' | 'future' | 'passed'
  categoryIcon: string
  countdownDays: number
  countdownUnit: string
  reminderLabel: string
  compact?: boolean
  isEditingName?: boolean
  editingNameValue?: string
  isEditingDesc?: boolean
  editingDescValue?: string
}>()

defineEmits<{
  (e: 'startNameEdit'): void
  (e: 'saveNameEdit'): void
  (e: 'cancelNameEdit'): void
  (e: 'update:editingNameValue', value: string): void
  (e: 'startDescEdit'): void
  (e: 'saveDescEdit'): void
  (e: 'cancelDescEdit'): void
  (e: 'update:editingDescValue', value: string): void
  (e: 'pin'): void
  (e: 'unpin'): void
  (e: 'delete'): void
  (e: 'edit'): void
  (e: 'openDatePicker'): void
  (e: 'toggleRepeat'): void
  (e: 'openReminderPicker'): void
}>()

const nameInputRef = ref<HTMLTextAreaElement | null>(null)
const descInputRef = ref<HTMLTextAreaElement | null>(null)

watch(() => props.isEditingName, (val) => {
  if (val) nextTick(() => nameInputRef.value?.focus())
})

watch(() => props.isEditingDesc, (val) => {
  if (val) nextTick(() => descInputRef.value?.focus())
})

const formatDate = (date: string): string => {
  return dayjs(date).format('YYYY年MM月DD日')
}

const cardClasses = computed(() => ({
  pinned: props.cardType === 'pinned',
  urgent: props.cardType === 'upcoming',
  passed: props.cardType === 'passed',
  'compact-card': props.compact
}))

const cardStyle = computed(() => {
  if (props.compact) {
    return { background: props.cardType === 'pinned' ? 'rgba(251, 191, 36, 0.06)' : 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '12px', padding: '16px' }
  }
  return {}
})

const countdownDisplayClass = computed(() => {
  if (props.compact) return 'compact'
  if (props.cardType === 'upcoming') return 'urgent'
  return props.cardType
})
</script>

<style scoped>
/* ===== 非紧凑模式（倒数日页面） ===== */
.milestone-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  overflow: hidden;
}

.milestone-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border-color: rgba(102, 126, 234, 0.5);
}

/* 星标 */
.milestone-card.pinned {
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.35);
}

.milestone-card.pinned .milestone-name { color: #fbbf24; }

/* 即将到来 - 红色 */
.milestone-card.urgent {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.35);
}

.milestone-card.urgent .milestone-name { color: #ef4444; }

/* 未来展望 */
.milestone-card:not(.pinned):not(.urgent):not(.passed) {
  background: rgba(167, 139, 250, 0.12);
  border-color: rgba(167, 139, 250, 0.3);
}

.milestone-card:not(.pinned):not(.urgent):not(.passed) .milestone-name { color: #a78bfa; }

.milestone-card.passed {
  opacity: 0.85;
}

/* ===== 第一行：三区域布局 ===== */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
}

.card-header-left {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.category-badge {
  font-size: 18px;
  flex-shrink: 0;
  line-height: 1.4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.milestone-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
  line-height: 1.4;
  word-break: break-word;
  hyphens: auto;
  user-select: none;
  flex: 1;
  min-width: 0;
}

.card-actions {
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

.card-btn-starred {
  color: #fbbf24;
}

.card-btn-starred:hover {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
}

.card-btn-star {
  color: rgba(251, 191, 36, 0.5);
}

.card-btn-star:hover {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
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

/* ===== 日期行 ===== */
.milestone-date {
  margin-bottom: 8px;
}

.date-plain-text {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--chalk-muted);
  cursor: pointer;
  transition: color 0.15s;
}

.date-plain-text .el-icon { font-size: 13px; }
.date-plain-text:hover { color: var(--chalk-white); }

/* ===== 元数据行 ===== */
.milestone-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  min-height: 18px;
}

.meta-item {
  cursor: pointer;
  transition: color 0.15s;
}

.meta-item:hover { color: var(--chalk-white); }
.repeat-text { color: var(--chalk-blue); }
.reminder-has { color: var(--chalk-orange); }
.reminder-none { color: var(--chalk-muted); }
.meta-separator { color: var(--chalk-white-30); user-select: none; }

/* ===== 倒数日/正数日显示区域 ===== */
.countdown-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 12px;
}

/* 星标 - 金色深色调 */
.countdown-display.pinned {
  background: rgba(251, 191, 36, 0.3);
}
.countdown-display.pinned .countdown-number {
  color: #fbbf24;
}

/* 即将到来 - 红色深色调 */
.countdown-display.urgent {
  background: rgba(239, 68, 68, 0.3);
}
.countdown-display.urgent .countdown-number {
  color: #ef4444;
}

/* 未来展望 - 紫色深色调 */
.countdown-display:not(.pinned):not(.urgent):not(.passed) {
  background: rgba(167, 139, 250, 0.3);
}
.countdown-display:not(.pinned):not(.urgent):not(.passed) .countdown-number {
  color: #a78bfa;
}

/* 已过去 - 灰色深色调 */
.countdown-display.passed {
  background: rgba(107, 114, 128, 0.3);
}
.countdown-display.passed .countdown-number {
  color: #9ca3af;
}

/* 紧凑模式（足迹页面） */
.countdown-display.compact {
  background: transparent;
  padding: 4px 0 0 0;
  margin-bottom: 6px;
}

.countdown-number {
  font-size: 28px;
  font-weight: 700;
}

.countdown-unit {
  font-size: 14px;
  color: var(--chalk-muted);
}

/* ===== 描述 ===== */
.milestone-desc {
  margin: 0;
  font-size: 13px;
  color: var(--chalk-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
}

.milestone-desc.desc-placeholder {
  color: var(--chalk-subtle);
  font-style: italic;
}

/* ===== 内联编辑 ===== */
.inline-edit-textarea {
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(102, 126, 234, 0.5);
  border-radius: 6px;
  color: var(--chalk-white-90);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.inline-edit-textarea:focus {
  border-color: rgba(102, 126, 234, 0.8);
  background: rgba(255, 255, 255, 0.08);
}

.inline-edit-textarea::placeholder { color: var(--chalk-subtle); }
.desc-textarea { font-size: 13px; margin-bottom: 0; }

/* ===== 紧凑模式（足迹页面） ===== */
.compact-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transition: background 0.2s;
  text-align: left;
}

.compact-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.compact-card .card-header {
  margin-bottom: 4px;
}

.compact-card .card-header-left {
  gap: 6px;
}

.compact-card .milestone-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--chalk-white-95);
  line-height: 1.4;
}

.compact-card .milestone-date {
  display: none;
}

.compact-card .milestone-meta {
  display: none;
}

.compact-card .card-actions {
  display: none;
}

.compact-card .countdown-display {
  background: transparent;
  padding: 2px 0 0 0;
  margin-bottom: 6px;
}

.compact-card .countdown-number {
  font-size: 18px;
  font-weight: 700;
  color: var(--chalk-white);
}

.compact-card .countdown-unit {
  font-size: 13px;
  color: var(--chalk-muted);
}

.compact-card .milestone-desc {
  font-size: 12px;
  margin-top: 2px;
}

.compact-card .category-badge {
  font-size: 16px;
}
</style>