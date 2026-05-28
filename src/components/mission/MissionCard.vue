<template>
  <div class="mission-card" :class="{ completed: mission.completed }">
    <div class="mission-header">
      <el-checkbox v-if="showCheckbox" :model-value="mission.completed" @change="handleMissionComplete(mission)" :disabled="isGuideActive" />
      <template v-if="isEditingName">
        <el-input
          v-model="editingName"
          type="textarea"
          autosize
          size="small"
          class="mission-name-input"
          @keyup.enter="saveName"
          @keyup.escape="cancelEditName"
          @blur="saveName"
        />
      </template>
      <div v-else class="mission-name" @click.stop="startEditName">{{ mission.name }}</div>
      <button class="priority-btn" :class="'priority-' + mission.priority" :title="priorityLabel" @click.stop="cyclePriority">
        <el-icon><Flag /></el-icon>
      </button>
      <button class="delete-btn" title="删除任务" @click.stop="showDeleteConfirm = true">
        <el-icon><Delete /></el-icon>
      </button>
    </div>
    <div class="mission-body">
      <div v-if="remainingTime" class="mission-meta-line remaining-time-line">
        <span class="remaining-time" :class="remainingTime.type">
          {{ remainingTime.text }}
        </span>
      </div>
      <div class="mission-meta-line" v-if="showListGroup">
        <span class="meta-item source-list clickable" @click.stop="openListGroupDialog">
          <span class="list-dot" :style="{ background: getListColor(mission.listId) }"></span>
          <span :style="{ color: getListColor(mission.listId) }">{{ getListName(mission.listId) }}</span>
          <template v-if="getGroupName(mission.listId, mission.groupId)">
            / <span :style="{ color: getGroup(mission.listId, mission.groupId)?.color }">{{ getGroupName(mission.listId, mission.groupId) }}</span>
          </template>
        </span>
      </div>
      <div class="mission-meta-line">
        <span v-if="showEndDate" class="meta-item clickable" @click.stop="openDatePicker">
          <el-icon><Calendar /></el-icon>
          {{ mission.date || '--' }}
        </span>
        <span class="meta-item clickable">
          <TimePickerPopover :model-value="mission.endTime || '00:00'" @update:model-value="onTimePicked" />
        </span>
        <span class="meta-item reminder-label clickable" @click.stop="openReminderDialog">
          <el-icon><Bell /></el-icon>
          {{ reminderLabel }}
        </span>
      </div>
      <div class="mission-meta-line">
        <span class="meta-item repeat clickable" @click.stop="openRepeatDialog">
          <el-icon><RefreshRight /></el-icon>
          {{ repeatLabel }}
        </span>
        <span v-if="endRepeatLabel" class="meta-item repeat-end-label clickable" @click.stop="openEndRepeatDialog">
          {{ endRepeatLabel }}
        </span>
      </div>
      <slot name="extra-meta"></slot>
      <div v-if="mission.checklist.length > 0" class="checklist-items-always" :style="isGuideActive ? { pointerEvents: 'none', opacity: '0.7' } : {}">
        <div v-for="item in mission.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed, 'drag-over': dragOverItemId === item.id }"
             @dragover.prevent="onChecklistDragOver($event, mission.id, item.id)"
             @drop="onChecklistDrop(mission.id, item.id)"
             @dragleave="onChecklistDragLeave(item.id)">
          <el-icon class="checklist-drag-handle" draggable="true"
            @dragstart="onChecklistDragStart($event, mission.id, item.id)"
            @dragend="dragOverItemId = null"
          ><Rank /></el-icon>
          <el-icon class="check-icon" v-if="item.completed" @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><Check /></el-icon>
          <el-icon class="check-icon" v-else @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><CircleCheck /></el-icon>
          <template v-if="editingChecklistId === item.id && editingChecklistMissionId === mission.id">
            <el-input v-model="editingChecklistText" type="textarea" autosize size="small" class="checklist-edit-input"
              @keyup.escape="cancelEditChecklistItem"
              @blur="finishEditChecklistItem" />
          </template>
          <span v-else class="check-text" @click.stop="startEditChecklistItem(mission.id, item)">{{ item.text }}</span>
        </div>
        <div class="checklist-add-row" :style="isGuideActive ? { pointerEvents: 'none', opacity: '0.7' } : {}">
          <el-input
            v-if="addingChecklist[mission.id]"
            v-model="newChecklistText"
            size="small"
            placeholder="输入后回车确认"
            :ref="(el: any) => { if (el && addingChecklistMissionId === mission.id) { nextTick(() => { const input = (el as any).input || (el as any).textarea; if (input) input.focus() }) } }"
            @keyup.enter="handleAddChecklist(mission.id)"
            @keyup.escape="cancelAddChecklist(mission.id)"
            @blur="cancelAddChecklist(mission.id)"
          />
          <div v-else class="checklist-add-btn" @click.stop="showAddChecklist(mission.id)">
            <el-icon><Plus /></el-icon>
            <span>新增检查事项</span>
          </div>
        </div>
      </div>
      <div v-if="editingNotesMissionId === mission.id" class="mission-notes-edit-wrapper">
        <el-input
          v-model="editingNotesText"
          type="textarea"
          autosize
          size="small"
          class="mission-notes-edit-input"
          placeholder="双击编辑备注"
          @keyup.escape="cancelEditNotes"
          @blur="finishEditNotes"
        />
      </div>
      <div v-else-if="mission.notes" class="mission-notes-content" @dblclick.stop="!isGuideActive && startEditNotes(mission)">{{ mission.notes }}</div>
      <div v-else class="mission-notes-placeholder" @dblclick.stop="!isGuideActive && startEditNotes(mission)">双击添加备注</div>
    </div>

    <DateScrollPicker v-model="datePickerValue" v-model:visible="showDatePicker" @update:model-value="onDatePicked" />

    <Teleport to="body">
      <div v-if="showReminderDialog" class="dialog-overlay" @click.self="showReminderDialog = false">
        <div class="dialog-container folder-color-dialog">
          <div class="dialog-header folder-dialog-header">
            <span class="dialog-header-title folder-dialog-title">设置提醒</span>
          </div>
          <div class="dialog-body">
            <div class="mission-form">
              <div class="form-row">
                <span class="form-label">提醒</span>
                <ReminderTimePicker v-model="reminderTimeValue" />
              </div>
              <div class="mission-form-footer">
                <el-button @click="showReminderDialog = false">取消</el-button>
                <el-button type="primary" @click="saveReminder">保存</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showRepeatDialog" class="dialog-overlay" @click.self="showRepeatDialog = false">
        <div class="dialog-container folder-color-dialog">
          <div class="dialog-header folder-dialog-header">
            <span class="dialog-header-title folder-dialog-title">设置重复</span>
          </div>
          <div class="dialog-body">
            <div class="mission-form">
              <div class="form-row">
                <span class="form-label">重复</span>
                <el-select v-model="repeatForm.strategy" placeholder="不重复" class="full-select" popper-class="dark-select-popper">
                  <el-option v-for="s in REPEAT_STRATEGIES" :key="s.value" :label="s.label" :value="s.value" />
                </el-select>
              </div>
              <div class="form-row" v-if="repeatForm.strategy === 'custom_days'">
                <span class="form-label">间隔天数</span>
                <el-input-number v-model="repeatForm.customDays" :min="1" :max="999" class="full-input-num" />
              </div>
              <div class="form-row" v-if="repeatForm.strategy === 'weekly_select'">
                <span class="form-label">选择星期</span>
                <div class="weekday-grid">
                  <button v-for="(d, i) in WEEKDAYS" :key="i"
                    class="weekday-btn" :class="{ active: repeatWeekdays.includes(i) }"
                    @click="toggleWeekday(i)">{{ d }}</button>
                </div>
              </div>
              <div class="form-row" v-if="repeatForm.strategy === 'lunar_date'">
                <span class="form-label">农历月</span>
                <el-select v-model="repeatLunarMonth" class="full-select" popper-class="dark-select-popper">
                  <el-option v-for="(m, i) in LUNAR_MONTHS" :key="i" :label="m" :value="i + 1" />
                </el-select>
                <span class="form-label" style="margin-top: 10px;">农历日</span>
                <el-input-number v-model="repeatLunarDay" :min="1" :max="30" class="full-input-num" />
              </div>
              <div class="mission-form-footer">
                <el-button @click="showRepeatDialog = false">取消</el-button>
                <el-button type="primary" @click="saveRepeat">保存</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showEndRepeatDialog" class="dialog-overlay" @click.self="showEndRepeatDialog = false">
        <div class="dialog-container folder-color-dialog">
          <div class="dialog-header folder-dialog-header">
            <span class="dialog-header-title folder-dialog-title">结束重复</span>
          </div>
          <div class="dialog-body">
            <div class="mission-form">
              <div class="form-row">
                <span class="form-label">结束重复</span>
                <el-select v-model="endRepeatForm.strategy" class="full-select" popper-class="dark-select-popper">
                  <el-option v-for="s in REPEAT_END_STRATEGIES" :key="s.value" :label="s.label" :value="s.value" />
                </el-select>
              </div>
              <div class="form-row" v-if="endRepeatForm.strategy === 'date'">
                <span class="form-label">结束日期</span>
                <DateScrollPicker v-model="endRepeatForm.date" />
              </div>
              <div class="form-row" v-if="endRepeatForm.strategy === 'count'">
                <span class="form-label">重复次数</span>
                <el-input-number v-model="endRepeatForm.count" :min="1" :max="9999" class="full-input-num" />
              </div>
              <div class="mission-form-footer">
                <el-button @click="showEndRepeatDialog = false">取消</el-button>
                <el-button type="primary" @click="saveEndRepeat">保存</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showListGroupDialog" class="dialog-overlay" @click.self="showListGroupDialog = false">
        <div class="dialog-container folder-color-dialog">
          <div class="dialog-header folder-dialog-header">
            <span class="dialog-header-title folder-dialog-title">所属清单分组</span>
          </div>
          <div class="dialog-body">
            <div class="mission-form">
              <div class="form-row">
                <span class="form-label">所属清单</span>
                <el-select v-model="listGroupForm.listId" placeholder="选择清单" class="full-select" popper-class="dark-select-popper">
                  <el-option v-for="list in availableLists" :key="list.id" :label="list.name" :value="list.id">
                    <div class="select-option-row"><span class="select-option-dot" :style="{ background: list.color }"></span>{{ list.name }}</div>
                  </el-option>
                </el-select>
              </div>
              <div class="form-row" v-if="listGroupForm.listId">
                <span class="form-label">所属分组</span>
                <el-select v-model="listGroupForm.groupId" placeholder="选择分组" class="full-select" popper-class="dark-select-popper">
                  <el-option v-for="g in availableGroups" :key="g.id" :label="g.name" :value="g.id">
                    <div class="select-option-row"><span class="select-option-dot" :style="{ background: g.color }"></span>{{ g.name }}</div>
                  </el-option>
                </el-select>
              </div>
              <div class="mission-form-footer">
                <el-button @click="showListGroupDialog = false">取消</el-button>
                <el-button type="primary" @click="saveListGroup">保存</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="确认删除"
      :message="`确定要删除任务「${mission.name}」吗？`"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, inject, nextTick, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar, RefreshRight, Check, CircleCheck, Bell, Plus, Rank, Flag, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useMissionStore, REPEAT_STRATEGIES, REPEAT_END_STRATEGIES, type Mission, type RepeatStrategy, type RepeatEndStrategy, type ReminderStrategy, type Priority } from '../../stores/missionStore'
import { logger } from '../../lib/logger'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'
import TimePickerPopover from '../common/picker/TimePickerPopover.vue'
import ReminderTimePicker from '../common/picker/ReminderTimePicker.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'

const props = withDefaults(defineProps<{
  mission: Mission
  context?: 'default' | 'footprint' | 'today' | 'custom-list'
  showCheckbox?: boolean
}>(), {
  context: 'default',
  showCheckbox: true
})

const emit = defineEmits<{
  (e: 'complete', mission: Mission): void
  (e: 'delete', mission: Mission): void
}>()

const missionStore = useMissionStore()
const refreshReminders = inject<() => void>('refreshReminders', () => {})
const isGuideActive = inject('guideVisible', ref(false))

const showEndDate = computed(() => {
  return props.context !== 'footprint' && props.context !== 'today'
})

const showListGroup = computed(() => {
  return props.context !== 'custom-list'
})

const isEditingName = ref(false)
const editingName = ref('')

const startEditName = () => {
  editingName.value = props.mission.name
  isEditingName.value = true
  nextTick(() => {
    const el = document.querySelector('.mission-name-input textarea') as HTMLTextAreaElement
    if (el) el.focus()
  })
}

const saveName = async () => {
  if (!isEditingName.value) return
  const newName = editingName.value.trim()
  if (newName && newName !== props.mission.name) {
    await missionStore.updateMission(props.mission.id, { name: newName })
    logger.info('[清单] 修改任务名称', { missionId: props.mission.id, name: newName })
  }
  isEditingName.value = false
  editingName.value = ''
}

const cancelEditName = () => {
  isEditingName.value = false
  editingName.value = ''
}

const priorityLabels: Record<Priority, string> = {
  'none': '无优先级',
  'high': '高优先级',
  'medium': '中优先级',
  'low': '低优先级'
}

const priorityLabel = computed(() => priorityLabels[props.mission.priority])

const PRIORITY_CYCLE: Priority[] = ['none', 'high', 'medium', 'low']

const cyclePriority = async () => {
  const idx = PRIORITY_CYCLE.indexOf(props.mission.priority)
  const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]
  await missionStore.updateMission(props.mission.id, { priority: next } as any)
  logger.info('[清单] 修改优先级', { missionId: props.mission.id, priority: next })
}

const handleMissionComplete = async (mission: Mission) => {
  const hadReminder = mission.reminderStrategy !== 'none' && mission.date
  if (mission.completed) await missionStore.uncompleteMission(mission.id)
  else await missionStore.completeMission(mission.id)
  emit('complete', mission)
  if (hadReminder) refreshReminders()
}

const handleDelete = () => {
  emit('delete', props.mission)
}

const getGroup = (listId: string, groupId: string) => {
  const list = missionStore.lists.find(l => l.id === listId)
  if (!list) return null
  return list.groups.find(g => g.id === groupId) || null
}

const getListName = (listId: string) => {
  const list = missionStore.lists.find(l => l.id === listId)
  return list?.name || '未知清单'
}

const getListColor = (listId: string) => {
  const list = missionStore.lists.find(l => l.id === listId)
  return list?.color || '#409EFF'
}

const getGroupName = (listId: string, groupId: string) => {
  const list = missionStore.lists.find(l => l.id === listId)
  if (!list) return ''
  const group = list.groups.find(g => g.id === groupId)
  if (!group || group.name === '默认分组') return ''
  return group.name
}

const getReminderLabel = (mission: Mission): string => {
  if (!mission.reminderStrategy || mission.reminderStrategy === 'none') return '不提醒'
  if (mission.reminderStrategy === 'on_time') return '准时提醒'
  if (mission.reminderStrategy === 'advance') {
    const parts: string[] = []
    if (mission.reminderDays) parts.push(`${mission.reminderDays}天`)
    if (mission.reminderHours) parts.push(`${mission.reminderHours}小时`)
    if (mission.reminderMinutes) parts.push(`${mission.reminderMinutes}分钟`)
    return `提前${parts.join('')}`
  }
  return '不提醒'
}

const reminderLabel = computed(() => getReminderLabel(props.mission))

const getRepeatLabel = (strategy: string, missionDate?: string, customDays?: number) => {
  if (strategy === 'custom_days' && customDays) return `每隔${customDays}天`
  if (strategy === 'weekly' && missionDate) {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const dayOfWeek = dayjs(missionDate).day()
    return `每周${weekDays[dayOfWeek]}`
  }
  if (strategy === 'monthly' && missionDate) {
    const dayOfMonth = dayjs(missionDate).date()
    return `每月${dayOfMonth}号`
  }
  return REPEAT_STRATEGIES.find(s => s.value === strategy)?.label || strategy
}

const repeatLabel = computed(() => getRepeatLabel(props.mission.repeatStrategy, props.mission.date, props.mission.repeatCustomDays))

const getRepeatEndLabel = (mission: Mission) => {
  if (!mission.repeatStrategy || mission.repeatStrategy === 'none') return null
  if (!mission.repeatEndStrategy || mission.repeatEndStrategy === 'never') return '永不结束'
  if (mission.repeatEndStrategy === 'date' && mission.repeatEndDate) return `至 ${dayjs(mission.repeatEndDate).format('MM月DD日')}`
  if (mission.repeatEndStrategy === 'count' && mission.repeatCount) return `共${mission.repeatCount}次`
  return '永不结束'
}

const endRepeatLabel = computed(() => getRepeatEndLabel(props.mission))

const formatTimeDiff = (days: number, hours: number, minutes: number, isOverdue: boolean): string => {
  const prefix = isOverdue ? '已过期' : '还剩'
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  if (parts.length === 0) return prefix + '0分钟'
  return prefix + parts.join('')
}

const getRemainingTimeDisplay = (mission: Mission) => {
  if (!mission.date || mission.completed) return null
  const now = dayjs()
  const md = dayjs(mission.date)
  let targetTime = md
  if (mission.endTime) { const [h, m] = mission.endTime.split(':').map(Number); targetTime = md.hour(h).minute(m) }
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

const remainingTime = computed(() => getRemainingTimeDisplay(props.mission))

const showDatePicker = ref(false)
const datePickerValue = ref(props.mission.date || '')
const showDeleteConfirm = ref(false)

const openDatePicker = () => {
  datePickerValue.value = props.mission.date || dayjs().format('YYYY-MM-DD')
  showDatePicker.value = true
}

const onDatePicked = async (dateStr: string) => {
  await missionStore.updateMission(props.mission.id, { date: dateStr })
  logger.info('[清单] 修改结束日期', { missionId: props.mission.id, date: dateStr })
}

const onTimePicked = async (val: string) => {
  await missionStore.updateMission(props.mission.id, { endTime: val })
  logger.info('[清单] 修改结束时间', { missionId: props.mission.id, endTime: val })
}

const showReminderDialog = ref(false)
const reminderTimeValue = ref({ days: 0, hours: 0, minutes: 15 })

const openReminderDialog = () => {
  reminderTimeValue.value = {
    days: props.mission.reminderStrategy === 'advance' ? (props.mission.reminderDays || 0) : 0,
    hours: props.mission.reminderStrategy === 'advance' ? (props.mission.reminderHours || 0) : 0,
    minutes: props.mission.reminderStrategy === 'advance' ? (props.mission.reminderMinutes || 0) : (props.mission.reminderStrategy === 'none' ? 0 : 15)
  }
  showReminderDialog.value = true
}

const showRepeatDialog = ref(false)
const repeatForm = reactive({
  strategy: 'none' as RepeatStrategy,
  customDays: 1
})
const repeatWeekdays = ref<number[]>([0, 1, 2, 3, 4])
const repeatLunarMonth = ref(1)
const repeatLunarDay = ref(1)

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']

const toggleWeekday = (idx: number) => {
  const arr = [...repeatWeekdays.value]
  const pos = arr.indexOf(idx)
  if (pos >= 0) {
    if (arr.length > 1) arr.splice(pos, 1)
  } else {
    arr.push(idx)
  }
  repeatWeekdays.value = arr.sort()
}

const openRepeatDialog = () => {
  repeatForm.strategy = props.mission.repeatStrategy as RepeatStrategy
  repeatForm.customDays = props.mission.repeatCustomDays || 1
  repeatWeekdays.value = [0, 1, 2, 3, 4]
  repeatLunarMonth.value = 1
  repeatLunarDay.value = 1
  showRepeatDialog.value = true
}

const showEndRepeatDialog = ref(false)
const endRepeatForm = reactive({
  strategy: 'never' as RepeatEndStrategy,
  date: '',
  count: 1
})

const openEndRepeatDialog = () => {
  endRepeatForm.strategy = (props.mission.repeatEndStrategy || 'never') as RepeatEndStrategy
  endRepeatForm.date = props.mission.repeatEndDate || ''
  endRepeatForm.count = props.mission.repeatCount || 1
  showEndRepeatDialog.value = true
}

const showListGroupDialog = ref(false)
const listGroupForm = reactive({
  listId: '',
  groupId: ''
})

const availableLists = computed(() => {
  return missionStore.lists.filter(l => !l.deleted)
})

const availableGroups = computed(() => {
  if (!listGroupForm.listId) return []
  const list = missionStore.lists.find(l => l.id === listGroupForm.listId)
  if (!list) return []
  return [...list.groups].sort((a, b) => a.order - b.order)
})

const openListGroupDialog = () => {
  listGroupForm.listId = props.mission.listId
  listGroupForm.groupId = props.mission.groupId
  showListGroupDialog.value = true
}

const saveReminder = async () => {
  const { days, hours, minutes } = reminderTimeValue.value
  const strategy: ReminderStrategy = (days === 0 && hours === 0 && minutes === 0) ? 'none' : 'advance'
  await missionStore.updateMission(props.mission.id, {
    reminderStrategy: strategy,
    reminderDays: days,
    reminderHours: hours,
    reminderMinutes: minutes
  })
  showReminderDialog.value = false
  refreshReminders()
  ElMessage.success('提醒设置已更新')
}

const saveRepeat = async () => {
  await missionStore.updateMission(props.mission.id, {
    repeatStrategy: repeatForm.strategy,
    repeatCustomDays: repeatForm.strategy === 'custom_days' ? repeatForm.customDays : 1
  })
  showRepeatDialog.value = false
  ElMessage.success('重复策略已更新')
}

const saveEndRepeat = async () => {
  await missionStore.updateMission(props.mission.id, {
    repeatEndStrategy: endRepeatForm.strategy,
    repeatEndDate: endRepeatForm.strategy === 'date' ? endRepeatForm.date : '',
    repeatCount: endRepeatForm.strategy === 'count' ? endRepeatForm.count : 1
  })
  showEndRepeatDialog.value = false
  ElMessage.success('结束重复策略已更新')
}

const saveListGroup = async () => {
  await missionStore.updateMission(props.mission.id, {
    listId: listGroupForm.listId,
    groupId: listGroupForm.groupId
  })
  showListGroupDialog.value = false
  ElMessage.success('所属清单分组已更新')
}

const toggleChecklistItem = (missionId: string, itemId: string, event: Event) => {
  event.stopPropagation()
  const mission = missionStore.missions.find(m => m.id === missionId)
  const item = mission?.checklist.find(c => c.id === itemId)
  logger.info('[清单] 完成检查事项', { missionId, missionName: mission?.name, itemId, itemName: item?.text })
  missionStore.toggleChecklistItem(missionId, itemId)
}

const addingChecklist = ref<Record<string, boolean>>({})
const newChecklistText = ref('')
const addingChecklistMissionId = ref<string>('')

const showAddChecklist = (missionId: string) => {
  addingChecklist.value[missionId] = true
  newChecklistText.value = ''
  addingChecklistMissionId.value = missionId
}

const cancelAddChecklist = (missionId: string) => {
  addingChecklist.value[missionId] = false
  newChecklistText.value = ''
  if (addingChecklistMissionId.value === missionId) addingChecklistMissionId.value = ''
}

const handleAddChecklist = async (missionId: string) => {
  const text = newChecklistText.value.trim()
  if (!text) { cancelAddChecklist(missionId); return }
  await missionStore.addChecklistItem(missionId, text)
  logger.info('[清单] 快速添加检查事项', { missionId, text })
  addingChecklistMissionId.value = ''
  cancelAddChecklist(missionId)
}

const dragSourceMissionId = ref('')
const dragSourceItemId = ref('')
const dragOverItemId = ref('')
const editingChecklistId = ref('')
const editingChecklistMissionId = ref('')
const editingChecklistText = ref('')

const onChecklistDragStart = (e: DragEvent, missionId: string, itemId: string) => {
  dragSourceMissionId.value = missionId
  dragSourceItemId.value = itemId
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

const onChecklistDragOver = (_e: DragEvent, _missionId: string, itemId: string) => {
  dragOverItemId.value = itemId
}

const onChecklistDragLeave = (itemId: string) => {
  if (dragOverItemId.value === itemId) dragOverItemId.value = null
}

const onChecklistDrop = async (missionId: string, targetItemId: string) => {
  dragOverItemId.value = null
  const mission = missionStore.missions.find(m => m.id === missionId)
  if (!mission) return
  const fromIdx = mission.checklist.findIndex(c => c.id === dragSourceItemId.value)
  const toIdx = mission.checklist.findIndex(c => c.id === targetItemId)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
  const items = [...mission.checklist]
  const [moved] = items.splice(fromIdx, 1)
  items.splice(toIdx, 0, moved)
  mission.checklist = items
  await missionStore.updateMission(missionId, { checklist: items })
  logger.info('[清单] 拖拽排序检查事项', { missionId, fromIdx, toIdx })
}

const startEditChecklistItem = (missionId: string, item: { id: string; text: string }) => {
  editingChecklistId.value = item.id
  editingChecklistMissionId.value = missionId
  editingChecklistText.value = item.text
  nextTick(() => {
    const el = document.querySelector('.checklist-edit-input textarea') as HTMLTextAreaElement
    if (el) el.focus()
  })
}

const finishEditChecklistItem = async () => {
  const mission = missionStore.missions.find(m => m.id === editingChecklistMissionId.value)
  if (!mission) { cancelEditChecklistItem(); return }
  const item = mission.checklist.find(c => c.id === editingChecklistId.value)
  if (!item) { cancelEditChecklistItem(); return }
  const newText = editingChecklistText.value.trim()
  if (newText && newText !== item.text) {
    item.text = newText
    await missionStore.updateMission(editingChecklistMissionId.value, { checklist: mission.checklist })
    logger.info('[清单] 编辑检查事项', { missionId: editingChecklistMissionId.value, itemId: editingChecklistId.value, text: newText })
  }
  cancelEditChecklistItem()
}

const cancelEditChecklistItem = () => {
  editingChecklistId.value = ''
  editingChecklistMissionId.value = ''
  editingChecklistText.value = ''
}

const editingNotesMissionId = ref('')
const editingNotesText = ref('')

const startEditNotes = (mission: Mission) => {
  editingNotesMissionId.value = mission.id
  editingNotesText.value = mission.notes || ''
  nextTick(() => {
    const el = document.querySelector('.mission-notes-edit-input textarea') as HTMLTextAreaElement
    if (el) el.focus()
  })
}

const finishEditNotes = async () => {
  const mission = missionStore.missions.find(m => m.id === editingNotesMissionId.value)
  if (!mission) { cancelEditNotes(); return }
  const newText = editingNotesText.value.trim()
  await missionStore.updateMission(editingNotesMissionId.value, { notes: newText || undefined })
  logger.info('[清单] 编辑备注', { missionId: editingNotesMissionId.value, notes: newText })
  cancelEditNotes()
}

const cancelEditNotes = () => {
  editingNotesMissionId.value = ''
  editingNotesText.value = ''
}
</script>

<style scoped>
.mission-card { background: rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 14px 16px; transition: all 0.2s; }
.mission-card:hover { background: rgba(255, 255, 255, 0.08); }
.mission-card.completed { opacity: 0.6; }
.mission-card.completed .mission-name { text-decoration: line-through; color: var(--chalk-muted) !important; }

.mission-header { display: flex; align-items: center; gap: 10px; }
.mission-header .mission-name { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; color: var(--chalk-white); margin-bottom: 0; cursor: pointer; }
.mission-header .mission-name:hover { opacity: 0.8; }
.mission-name-input { flex: 1; min-width: 0; }
.mission-name-input :deep(.el-textarea__inner) { background: rgba(255, 255, 255, 0.05) !important; border: 1px solid rgba(102, 126, 234, 0.3) !important; color: var(--chalk-white-90) !important; }

.mission-body { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.mission-meta-line { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.priority-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: none; background: transparent; color: var(--chalk-muted); cursor: pointer; border-radius: 4px; transition: all 0.2s; flex-shrink: 0; }
.priority-btn:hover { background: rgba(255,255,255,0.1); }
.priority-btn.priority-high { color: var(--chalk-danger); }
.priority-btn.priority-medium { color: var(--chalk-orange); }
.priority-btn.priority-low { color: var(--chalk-success); }

.delete-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: none; background: transparent; color: var(--chalk-muted); cursor: pointer; border-radius: 4px; transition: all 0.2s; flex-shrink: 0; }
.delete-btn:hover { background: rgba(255,255,255,0.1); color: var(--chalk-danger); }

.meta-item { display: flex; align-items: center; gap: 3px; font-size: 12px; color: var(--chalk-muted); white-space: nowrap; }
.meta-item.clickable { cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: all 0.2s; }
.meta-item.clickable:hover { background: rgba(255,255,255,0.08); color: var(--chalk-white-85); }
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

.dialog-options { display: flex; flex-wrap: wrap; gap: 8px; }
.dialog-option { padding: 8px 16px; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; cursor: pointer; font-size: 14px; color: var(--chalk-white-70); transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
.dialog-option:hover { border-color: var(--chalk-primary); color: var(--chalk-white); }
.dialog-option.active { border-color: var(--chalk-primary); background: rgba(102,126,234,0.2); color: var(--chalk-white); }
.advance-inputs { display: flex; align-items: center; gap: 6px; margin-top: 14px; color: var(--chalk-white-70); font-size: 14px; }
.list-group-select { display: flex; flex-direction: column; gap: 12px; }
.select-label { font-size: 14px; color: var(--chalk-white-70); font-weight: 500; }

.checklist-items-always { margin-top: 4px; display: flex; flex-direction: column; gap: 4px; padding-left: 4px; }
.mission-notes-content { margin-top: 8px; font-size: 13px; color: rgba(180, 170, 150, 0.75); line-height: 1.6; word-break: break-word; white-space: pre-wrap; }
.mission-notes-placeholder { margin-top: 8px; font-size: 13px; color: rgba(180, 170, 150, 0.35); line-height: 1.6; word-break: break-word; white-space: pre-wrap; cursor: pointer; transition: color 0.2s; }
.mission-notes-placeholder:hover { color: rgba(180, 170, 150, 0.55); }
.mission-notes-edit-wrapper { margin-top: 8px; }
.mission-notes-edit-input { flex: 1; }
.mission-notes-edit-input :deep(.el-textarea__inner) { background: rgba(255, 255, 255, 0.05) !important; border: 1px solid rgba(102, 126, 234, 0.3) !important; color: var(--chalk-white-90) !important; }

.checklist-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--chalk-white-70); padding: 6px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; }
.checklist-item:hover { background: rgba(255, 255, 255, 0.05); color: var(--chalk-white-90); }
.checklist-item .check-icon { font-size: 16px; flex-shrink: 0; }
.checklist-item .check-text { flex: 1; word-break: break-word; }
.checklist-item.completed { color: var(--chalk-muted); }
.checklist-item.completed .check-text { text-decoration: line-through; }
.checklist-item.completed .check-icon { color: var(--chalk-primary); }

.checklist-add-row { margin-top: 2px; }
.checklist-add-btn { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--chalk-subtle); padding: 4px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; }
.checklist-add-btn:hover { color: var(--chalk-white-70); background: rgba(255, 255, 255, 0.05); }

.checklist-drag-handle { font-size: 14px; color: var(--chalk-white-30); cursor: grab; flex-shrink: 0; }
.checklist-drag-handle:active { cursor: grabbing; }
.checklist-item.drag-over { background: rgba(102,126,234,0.15); }
.checklist-edit-input { flex: 1; }

:deep(.el-checkbox__inner) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
:deep(.el-checkbox__inner.is-checked .el-checkbox__inner) { background: #667eea; border-color: #667eea; }

.dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; overflow-y: auto; }
.dialog-container { background: rgba(30, 28, 52, 0.98); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; }
.folder-color-dialog { width: 380px; }
.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; flex-shrink: 0; }
.dialog-header-title { font-size: 16px; font-weight: 600; color: var(--chalk-white); }
.folder-dialog-header { justify-content: center; }
.folder-dialog-title { text-align: center; }
.dialog-body { padding: 16px 20px 20px; overflow-y: auto; }

.mission-form { display: flex; flex-direction: column; gap: 14px; }
.mission-form :deep(.el-input__wrapper) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
.mission-form :deep(.el-input__inner) { color: #fff; }
.mission-form :deep(.el-input__inner::placeholder) { color: rgba(255, 255, 255, 0.4); }
.mission-form :deep(.el-textarea__inner) { color: #fff; background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
.mission-form :deep(.el-textarea__inner::placeholder) { color: rgba(255,255,255,0.4); }

.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; color: var(--chalk-dim); }
.full-select { width: 100%; }
.full-input-num { width: 100%; }
.full-input-num :deep(.el-input__wrapper) { width: 100%; }

.mission-form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 8px; }

.weekday-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.weekday-btn { padding: 6px 0; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: var(--chalk-white-70); border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
.weekday-btn:hover { background: rgba(255,255,255,0.1); }
.weekday-btn.active { background: rgba(102,126,234,0.3); border-color: #667eea; color: var(--chalk-white); }

.select-option-row { display: flex; align-items: center; gap: 8px; }
.select-option-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

:deep(.el-select__wrapper) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
:deep(.el-input-number) { width: 100%; }
:deep(.el-input-number .el-input__wrapper) { width: 100%; background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }

:deep(.time-btn) { background: transparent; border: none; padding: 0; height: auto; font-size: 13px; color: var(--chalk-blue); font-weight: 400; }
:deep(.time-btn:hover) { border: none; }
</style>