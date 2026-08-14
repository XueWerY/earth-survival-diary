<template>
  <div class="list-card" :class="['priority-bg-' + list.priority, { completed: list.completed }]">
    <div class="card-top-actions" @click.stop>
      <button class="card-icon-btn" title="编辑任务" @click="emitEdit"><el-icon><Edit /></el-icon></button>
      <button class="card-icon-btn danger" title="删除任务" @click="showDeleteConfirm = true"><el-icon><Delete /></el-icon></button>
    </div>

    <div class="list-header">
      <el-checkbox v-if="showCheckbox" :model-value="list.completed" @change="handleTaskComplete(list)" :disabled="isGuideActive" />
      <div class="list-name">{{ list.name }}</div>
    </div>

    <div class="list-body">
      <div v-if="remainingTime" class="list-meta-line remaining-time-line">
        <span class="remaining-time" :class="remainingTime.type">{{ remainingTime.text }}</span>
      </div>

      <div class="list-meta-line" v-if="showListGroup">
        <span class="meta-item source-list">
          <span class="list-dot" :style="{ background: getListColor(list.listId) }"></span>
          <span :style="{ color: getListColor(list.listId) }">{{ getListName(list.listId) }}</span>
          <template v-if="getGroupName(list.listId, list.groupId)">
            / <span :style="{ color: getGroup(list.listId, list.groupId)?.color }">{{ getGroupName(list.listId, list.groupId) }}</span>
          </template>
        </span>
      </div>

      <div class="list-meta-line" v-if="hasDate || hasEndTime || hasReminder">
        <span v-if="hasDate" class="meta-item">
          <el-icon><Calendar /></el-icon>{{ list.date }}
        </span>
        <span v-if="hasEndTime" class="meta-item">
          <el-icon><Clock /></el-icon>{{ list.endTime }}
        </span>
        <span v-if="hasReminder" class="meta-item reminder-label">
          <el-icon><Bell /></el-icon>{{ reminderLabel }}
        </span>
      </div>

      <div class="list-meta-line" v-if="hasRepeat">
        <span class="meta-item repeat">
          <el-icon><RefreshRight /></el-icon>{{ repeatLabel }}
        </span>
        <span v-if="endRepeatLabel" class="meta-item repeat-end-label">{{ endRepeatLabel }}</span>
      </div>

      <div class="checklist-items-always" v-if="list.checklist && list.checklist.length">
        <div v-for="item in list.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed }">
          <el-icon class="check-icon" v-if="item.completed" @click.stop="toggleChecklistItem(list.id, item.id, $event)"><Check /></el-icon>
          <el-icon class="check-icon" v-else @click.stop="toggleChecklistItem(list.id, item.id, $event)"><CircleCheck /></el-icon>
          <span class="check-text" :class="{ completed: item.completed }">{{ item.text }}</span>
        </div>
      </div>

      <div v-if="list.notes" class="list-notes-content">{{ list.notes }}</div>

      <div class="linked-notes-line" v-if="linkedNotes.length" @click.stop>
        <span v-for="n in linkedNotes" :key="n.id" class="linked-note-tag" :style="{ borderColor: n.color, color: n.color }"
          @click="openLinkedNote(n)" @mouseenter="fitNotePreview">
          <span class="linked-note-label"><el-icon><Notebook /></el-icon>{{ n.title || '无标题笔记' }}</span>
          <span class="linked-note-preview">
            <span class="linked-note-preview-title">{{ n.title || '无标题笔记' }}</span>
            <span class="linked-note-preview-body">{{ notePreview(n) }}</span>
          </span>
        </span>
      </div>
    </div>

    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="确认删除"
      :message="`确定要删除任务「${list.name}」吗？`"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, inject, computed } from 'vue'
import { Calendar, RefreshRight, Check, CircleCheck, Bell, Delete, Edit, Clock, Notebook } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import { useListStore, REPEAT_STRATEGIES, type Task } from '../../stores/listStore'
import { useNoteStore, getMdPlainText, type Note } from '../../stores/noteStore'
import { usePageNav, MODULE_ROUTES } from '../../composables/usePageNav'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'

const props = withDefaults(defineProps<{
  list: Task
  context?: 'default' | 'footprint' | 'today' | 'custom-list'
  showCheckbox?: boolean
}>(), {
  context: 'default',
  showCheckbox: true
})

const emit = defineEmits<{
  (e: 'complete', list: Task): void
  (e: 'delete', list: Task): void
  (e: 'edit', list: Task): void
}>()

const listStore = useListStore()
const noteStore = useNoteStore()
const router = useRouter()
const { setNavPath } = usePageNav()
const refreshReminders = inject<() => void>('refreshReminders', () => {})
const isGuideActive = inject('guideVisible', ref(false))

// 关联笔记：按 id 取笔记本体，已删除的自动跳过
const linkedNotes = computed(() => {
  return (props.list.linkedNoteIds || [])
    .map(id => noteStore.notes.find(n => n.id === id))
    .filter((n): n is Note => !!n)
})

const openLinkedNote = (note: Note) => {
  setNavPath(['notes', note.categoryId, note.id])
  router.push(MODULE_ROUTES.notes)
}

// 预览浮层最大高度：上边界距面包屑地址栏保持与卡片-地址栏一致的 16px 间距
const fitNotePreview = (e: MouseEvent) => {
  const tag = e.currentTarget as HTMLElement
  const preview = tag.querySelector('.linked-note-preview') as HTMLElement | null
  if (!preview) return
  const crumb = document.querySelector('.list-breadcrumb-bar')
  let maxH = window.innerHeight * 0.4
  if (crumb) {
    const available = tag.getBoundingClientRect().top - crumb.getBoundingClientRect().bottom - 16
    if (available > 120) maxH = available
  }
  preview.style.maxHeight = maxH + 'px'
}

const notePreview = (note: Note): string => {
  const text = getMdPlainText(note.content || '').trim()
  if (!text) return '（空笔记）'
  // 正文首行若与标题相同，则去掉，避免标题重复显示
  const title = (note.title || '').trim()
  const lines = text.split('\n')
  if (title && lines.length && lines[0].trim() === title) {
    lines.shift()
  }
  return lines.join('\n').trim()
}

const showEndDate = computed(() => {
  return props.context !== 'footprint' && props.context !== 'today'
})

const showListGroup = computed(() => {
  return props.context !== 'custom-list'
})

const hasDate = computed(() => showEndDate.value && !!props.list.date)
const hasEndTime = computed(() => !!props.list.endTime)
const hasReminder = computed(() => !!props.list.reminderStrategy && props.list.reminderStrategy !== 'none')
const hasRepeat = computed(() => !!props.list.repeatStrategy && props.list.repeatStrategy !== 'none')

const handleTaskComplete = async (list: Task) => {
  const hadReminder = list.reminderStrategy !== 'none' && list.date
  if (list.completed) await listStore.uncompleteTask(list.id)
  else await listStore.completeTask(list.id)
  emit('complete', list)
  if (hadReminder) refreshReminders()
}

const handleDelete = () => {
  emit('delete', props.list)
}

const emitEdit = () => emit('edit', props.list)

const getGroup = (listId: string, groupId: string) => {
  const list = listStore.taskLists.find(l => l.id === listId)
  if (!list) return null
  return list.groups.find(g => g.id === groupId) || null
}

const getListName = (listId: string) => {
  const list = listStore.taskLists.find(l => l.id === listId)
  return list?.name || '未知清单'
}

const getListColor = (listId: string) => {
  const list = listStore.taskLists.find(l => l.id === listId)
  return list?.color || '#409EFF'
}

const getGroupName = (listId: string, groupId: string) => {
  const list = listStore.taskLists.find(l => l.id === listId)
  if (!list) return ''
  const group = list.groups.find(g => g.id === groupId)
  if (!group || group.name === '默认分组') return ''
  return group.name
}

const getReminderLabel = (list: Task): string => {
  if (!list.reminderStrategy || list.reminderStrategy === 'none') return '不提醒'
  if (list.reminderStrategy === 'on_time') return '准时提醒'
  if (list.reminderStrategy === 'advance') {
    const parts: string[] = []
    if (list.reminderDays) parts.push(`${list.reminderDays}天`)
    if (list.reminderHours) parts.push(`${list.reminderHours}小时`)
    if (list.reminderMinutes) parts.push(`${list.reminderMinutes}分钟`)
    return `提前${parts.join('')}`
  }
  return '不提醒'
}
const reminderLabel = computed(() => getReminderLabel(props.list))

const getRepeatLabel = (strategy: string, listDate?: string, customDays?: number, weekdays?: number[], monthDay?: number, lunarMonth?: number, lunarDay?: number) => {
  if (strategy === 'custom_days' && customDays) return `每隔${customDays}天`
  if (strategy === 'weekly' && listDate) {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const dayOfWeek = dayjs(listDate).day()
    return `每周${weekDays[dayOfWeek]}`
  }
  if (strategy === 'weekly_select' && weekdays && weekdays.length > 0) {
    const weekDays = ['一', '二', '三', '四', '五', '六', '日']
    const labels = weekdays.map(d => weekDays[d] || '?')
    return `每周${labels.join('、')}重复`
  }
  if (strategy === 'monthly' && listDate) {
    const dayOfMonth = dayjs(listDate).date()
    return `每月${dayOfMonth}号`
  }
  if (strategy === 'monthly_selected_day' && monthDay) return `每月${monthDay}号重复`
  if (strategy === 'lunar_date' && lunarMonth && lunarDay) return `每年${LUNAR_MONTHS[lunarMonth - 1] || lunarMonth}${LUNAR_DAYS[lunarDay - 1] || lunarDay}重复`
  if (strategy === 'none') return '不重复'
  return REPEAT_STRATEGIES.find(s => s.value === strategy)?.label || strategy
}
const repeatLabel = computed(() => getRepeatLabel(props.list.repeatStrategy, props.list.date, props.list.repeatCustomDays, props.list.repeatWeekdays, props.list.repeatMonthDay, props.list.repeatLunarMonth, props.list.repeatLunarDay))

const getRepeatEndLabel = (list: Task) => {
  if (!list.repeatStrategy || list.repeatStrategy === 'none') return null
  if (!list.repeatEndStrategy || list.repeatEndStrategy === 'never') return '永不结束'
  if (list.repeatEndStrategy === 'date' && list.repeatEndDate) return `至 ${dayjs(list.repeatEndDate).format('MM月DD日')}`
  if (list.repeatEndStrategy === 'count' && list.repeatCount) return `重复${list.repeatCount}次，已重复${list.repeatCompletedCount}次`
  return '永不结束'
}
const endRepeatLabel = computed(() => getRepeatEndLabel(props.list))

const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
const LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

const formatTimeDiff = (days: number, hours: number, minutes: number, isOverdue: boolean): string => {
  const prefix = isOverdue ? '已过期' : '还剩'
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  if (parts.length === 0) return prefix + '0分钟'
  return prefix + parts.join('')
}

const getRemainingTimeDisplay = (list: Task) => {
  if (!list.date || list.completed) return null
  const now = dayjs()
  const md = dayjs(list.date)
  let targetTime = md
  if (list.endTime) { const [h, m] = list.endTime.split(':').map(Number); targetTime = md.hour(h).minute(m) }
  else { targetTime = md.hour(23).minute(59) }
  const diffMinutes = targetTime.diff(now, 'minute')
  if (diffMinutes <= 0) {
    const pastMinutes = now.diff(targetTime, 'minute')
    const totalHours = Math.floor(pastMinutes / 60)
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    const minutes = pastMinutes % 60
    return { text: formatTimeDiff(days, hours, minutes, true), type: 'overdue' }
  }
  const totalHours = Math.floor(diffMinutes / 60)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const minutes = diffMinutes % 60
  if (days > 0) return { text: formatTimeDiff(days, hours, minutes, false), type: 'future' }
  if (diffMinutes <= 60) return { text: formatTimeDiff(days, hours, minutes, false), type: 'urgent' }
  return { text: formatTimeDiff(days, hours, minutes, false), type: 'today' }
}
const remainingTime = computed(() => getRemainingTimeDisplay(props.list))

const toggleChecklistItem = async (listId: string, itemId: string, event: Event) => {
  event.stopPropagation()
  const hadReminder = props.list.reminderStrategy !== 'none' && !!props.list.date
  await listStore.toggleChecklistItem(listId, itemId)
  if (hadReminder) refreshReminders()
}

const showDeleteConfirm = ref(false)
</script>

<style scoped>
.list-card {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 14px 16px;
  transition: all 0.2s;
  width: 100%;
  border-left: 3px solid transparent;
}
.list-card:hover { background: rgba(255, 255, 255, 0.08); }
.list-card.completed { opacity: 0.6; }
.list-card.priority-bg-high { background: rgba(239, 68, 68, 0.10); border-left-color: rgba(239, 68, 68, 0.55); }
.list-card.priority-bg-high:hover { background: rgba(239, 68, 68, 0.16); }
.list-card.priority-bg-medium { background: rgba(245, 158, 11, 0.10); border-left-color: rgba(245, 158, 11, 0.55); }
.list-card.priority-bg-medium:hover { background: rgba(245, 158, 11, 0.16); }
.list-card.priority-bg-low { background: rgba(34, 197, 94, 0.10); border-left-color: rgba(34, 197, 94, 0.55); }
.list-card.priority-bg-low:hover { background: rgba(34, 197, 94, 0.16); }
.list-card.completed .list-name { text-decoration: line-through; color: var(--chalk-muted) !important; }

.list-header { display: flex; align-items: center; gap: 10px; }
.list-header .list-name { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; color: var(--chalk-white); margin-bottom: 0; word-break: break-word; }

.card-top-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 2px; z-index: 2; opacity: 0; transition: opacity 0.15s; }
.list-card:hover .card-top-actions { opacity: 1; }
.card-icon-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; background: transparent; color: var(--chalk-white-60); cursor: pointer; border-radius: 4px; font-size: 12px; transition: all 0.15s; }
.card-icon-btn:hover { background: rgba(255, 255, 255, 0.1); color: var(--chalk-white); }
.card-icon-btn.danger:hover { color: var(--chalk-danger); }

.list-body { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.list-meta-line { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.meta-item { display: flex; align-items: center; gap: 3px; font-size: 12px; color: var(--chalk-muted); white-space: nowrap; }
.meta-item.reminder-label { color: var(--chalk-orange); }
.meta-item.repeat { color: var(--chalk-primary); }
.meta-item.repeat-end-label { color: var(--chalk-dim); }
.remaining-time { font-weight: 500; font-size: 12px; white-space: nowrap; flex-shrink: 0; }
.remaining-time.overdue { color: var(--chalk-danger); }
.remaining-time.urgent { color: var(--chalk-orange); }
.remaining-time.today { color: var(--chalk-success); }
.remaining-time.future { color: var(--chalk-white-60); }

.source-list { display: flex; align-items: center; gap: 4px; }
.list-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }

.checklist-items-always { margin-top: 4px; display: flex; flex-direction: column; gap: 4px; padding-left: 4px; }
.checklist-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--chalk-white-70); padding: 4px 6px; border-radius: 6px; }
.checklist-item:hover { background: rgba(255, 255, 255, 0.05); color: var(--chalk-white-90); }
.checklist-item .check-icon { font-size: 16px; flex-shrink: 0; cursor: pointer; }
.checklist-item .check-text { flex: 1; word-break: break-word; white-space: pre-wrap; }
.checklist-item.completed { color: var(--chalk-muted); }
.checklist-item.completed .check-text { text-decoration: line-through; }
.checklist-item.completed .check-icon { color: var(--chalk-primary); }

.list-notes-content { margin-top: 8px; font-size: 13px; color: rgba(180, 170, 150, 0.75); line-height: 1.6; word-break: break-word; white-space: pre-wrap; }

.linked-notes-line { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.linked-note-tag { display: inline-flex; align-items: center; max-width: 100%; padding: 2px 8px; border: 1px solid; border-radius: 10px; background: rgba(255,255,255,0.05); font-size: 12px; line-height: 1.6; cursor: pointer; transition: all 0.15s; position: relative; z-index: 5; }
.linked-note-label { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.linked-note-tag:hover { background: rgba(255,255,255,0.14); transform: translateY(-1px); }
/* 预览浮层：显示在标签上方，层级高于卡片的标记完成框/编辑删除按钮 */
.linked-note-preview {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 999;
  width: 500px;
  max-width: calc(100vw - 40px);
  padding: 8px 10px;
  background: rgba(24, 22, 42, 0.98);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  font-size: 12px;
  line-height: 1.6;
  color: var(--chalk-white-80);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-y: auto;
  scrollbar-width: thin;
  pointer-events: auto;
}
.linked-note-preview-title {
  display: block;
  text-align: center;
  font-weight: 600;
  color: var(--chalk-white);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.linked-note-tag:hover .linked-note-preview, .linked-note-preview:hover { display: block; }

:deep(.el-checkbox__inner) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
</style>
