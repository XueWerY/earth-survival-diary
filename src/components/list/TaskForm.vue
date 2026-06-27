<template>
  <div class="list-form">
    <div class="form-row">
      <span class="form-label">名称</span>
      <el-input
        ref="nameInputRef"
        v-model="formName"
        placeholder="请输入任务名称"
        @keyup.enter="handleSubmit"
      />
    </div>

    <div class="form-row">
      <span class="form-label">日期</span>
      <div class="date-area-wrap">
        <DateScrollPicker v-model="formDate" />
      </div>
    </div>

    <div class="form-row" v-if="formDate">
      <span class="form-label">时间</span>
      <div class="time-area-wrap">
        <TimePickerPopover v-model="formTime" placeholder="-:-" />
      </div>
    </div>

    <div class="form-row">
      <span class="form-label">优先级</span>
      <div class="priority-buttons">
        <button v-for="p in PRIORITIES" :key="p.value"
          class="priority-btn" :class="{ active: formPriority === p.value }"
          :style="formPriority === p.value ? { borderColor: p.color, color: p.color } : {}"
          @click="formPriority = p.value">{{ p.label }}</button>
      </div>
    </div>

    <div class="form-row">
      <span class="form-label">所属清单</span>
      <el-select v-model="formListId" placeholder="选择清单" class="list-select" popper-class="dark-select-popper task-form-list-popper">
        <el-option v-for="list in availableLists" :key="list.id" :label="list.name" :value="list.id">
          <div class="select-option-row"><span class="select-option-dot" :style="{ background: list.color }"></span>{{ list.name }}</div>
        </el-option>
      </el-select>
    </div>

    <div class="form-row" v-if="formListId">
      <span class="form-label">所属分组</span>
      <el-select v-model="formGroupId" placeholder="选择分组" class="group-select" popper-class="dark-select-popper task-form-group-popper">
        <el-option v-for="g in availableGroups" :key="g.id" :label="g.name" :value="g.id">
          <div class="select-option-row"><span class="select-option-dot" :style="{ background: g.color }"></span>{{ g.name }}</div>
        </el-option>
      </el-select>
    </div>

    <template v-if="formTime">
      <div class="form-row">
        <span class="form-label">重复</span>
        <el-select v-model="formRepeatStrategy" placeholder="不重复" class="repeat-select" popper-class="dark-select-popper task-form-repeat-popper">
          <el-option v-for="s in REPEAT_STRATEGIES" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </div>

      <div class="form-row" v-if="formRepeatStrategy === 'custom_days'">
        <span class="form-label">间隔天数</span>
        <el-input-number v-model="repeatDays" :min="1" :max="999" class="full-input-num" />
      </div>
      <div class="form-row" v-if="formRepeatStrategy === 'weekly_select'">
        <span class="form-label">选择星期</span>
        <div class="weekday-grid">
          <button v-for="(d, i) in WEEKDAYS" :key="i"
            class="weekday-btn" :class="{ active: repeatWeekdays.includes(i) }"
            @click="toggleWeekday(i)">{{ d }}</button>
        </div>
      </div>
      <div class="form-row" v-if="formRepeatStrategy === 'monthly_selected_day'">
        <span class="form-label">指定日期</span>
        <el-input-number v-model="repeatMonthDay" :min="1" :max="31" class="full-input-num" />
      </div>
      <div class="form-row" v-if="formRepeatStrategy === 'lunar_date'">
        <span class="form-label">农历月</span>
        <el-select v-model="repeatLunarMonth" class="full-select" popper-class="dark-select-popper">
          <el-option v-for="(m, i) in LUNAR_MONTHS" :key="i" :label="m" :value="i + 1" />
        </el-select>
        <span class="form-label" style="margin-top: 10px;">农历日</span>
        <el-select v-model="repeatLunarDay" class="full-select" popper-class="dark-select-popper">
          <el-option v-for="(d, i) in LUNAR_DAYS" :key="i" :label="d" :value="i + 1" />
        </el-select>
      </div>

      <div class="form-row" v-if="formRepeatStrategy !== 'none'">
        <span class="form-label">结束重复</span>
        <el-select v-model="formRepeatEndStrategy" class="end-repeat-select" popper-class="dark-select-popper task-form-end-repeat-popper">
          <el-option v-for="s in REPEAT_END_STRATEGIES" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </div>
      <div class="form-row" v-if="formRepeatStrategy !== 'none' && formRepeatEndStrategy === 'date'">
        <span class="form-label">结束日期</span>
        <div class="date-area-wrap">
          <DateScrollPicker v-model="formRepeatEndDate" />
        </div>
      </div>
      <div class="form-row" v-if="formRepeatStrategy !== 'none' && formRepeatEndStrategy === 'count'">
        <span class="form-label">重复次数</span>
        <el-input-number v-model="formRepeatEndCount" :min="1" :max="9999" class="repeat-count-input" />
      </div>

      <div class="form-row">
        <span class="form-label">提醒</span>
        <div class="reminder-area">
          <el-select v-model="reminderEnabled" class="reminder-select" popper-class="task-form-reminder-popper">
            <el-option :value="false" label="不提醒" />
            <el-option :value="true" label="提醒" />
          </el-select>
          <div class="reminder-advance-wrap" v-if="reminderEnabled">
            <ReminderTimePicker v-model="reminderTime" prefix="提前" />
          </div>
        </div>
      </div>
    </template>

    <div class="form-row">
      <span class="form-label">备注</span>
      <el-input v-model="formNote" type="textarea" :rows="2" placeholder="添加备注..." />
    </div>

    <div class="form-row">
      <span class="form-label">检查事项</span>
      <div class="checklist-form-items" ref="checklistContainerRef">
        <div v-for="(item, idx) in formChecklist" :key="item.id" class="checklist-form-item" :class="{ 'drag-over': formDragOverIdx === idx }"
             @dragover.prevent="onFormChecklistDragOver($event, idx)"
             @drop="onFormChecklistDrop(idx)"
             @dragleave="onFormChecklistDragLeave(idx)">
          <el-icon class="checklist-drag-handle" draggable="true"
            @dragstart="onFormChecklistDragStart($event, idx)"
            @dragend="formDragOverIdx = null"
          ><Rank /></el-icon>
          <el-input v-model="item.text" type="textarea" autosize placeholder="输入检查事项" size="small" class="checklist-form-input" @blur="onChecklistItemBlur(idx)" />
          <button class="checklist-form-delete" @click="removeChecklistItem(idx)"><el-icon><Delete /></el-icon></button>
        </div>
        <div class="checklist-form-add" @click="addChecklistItem">
          <el-icon><Plus /></el-icon>
          <span>添加检查事项</span>
        </div>
      </div>
    </div>

    <div class="task-wavy-divider"></div>

    <div class="list-form-footer">
      <button class="capsule-btn" @click="cancel">
        <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        <span>取消</span>
      </button>
      <button class="capsule-btn capsule-save" @click="handleSubmit">
        <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
        <span>保存</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus, Rank } from '@element-plus/icons-vue'
import { useListStore, type RepeatStrategy, type RepeatEndStrategy, REPEAT_STRATEGIES, REPEAT_END_STRATEGIES, PRIORITIES, type ReminderStrategy, type ChecklistItem } from '../../stores/listStore'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'
import TimePickerPopover from '../common/picker/TimePickerPopover.vue'
import ReminderTimePicker from '../common/picker/ReminderTimePicker.vue'

const props = defineProps<{
  listId?: string
  groupId?: string
}>()

const emit = defineEmits<{
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'cancel'): void
}>()

const listStore = useListStore()

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
const LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

const nameInputRef = ref<InstanceType<typeof HTMLInputElement>>()
const checklistContainerRef = ref<HTMLElement>()
const formName = ref('')
const formDate = ref('')
const formTime = ref('')
const formPriority = ref<typeof PRIORITIES[number]['value']>('none')
const formListId = ref(props.listId || '')
const formGroupId = ref(props.groupId || '')
const formRepeatStrategy = ref<RepeatStrategy>('none')
const formRepeatEndStrategy = ref<RepeatEndStrategy>('never')
const formRepeatEndDate = ref('')
const formRepeatEndCount = ref(1)
const formNote = ref('')
const formChecklist = ref<{ id: string; text: string }[]>([])
const repeatDays = ref(1)
const repeatWeekdays = ref<number[]>([0, 1, 2, 3, 4])
const repeatMonthDay = ref(1)
const repeatLunarMonth = ref(1)
const repeatLunarDay = ref(1)
const reminderTime = ref({ days: 0, hours: 0, minutes: 15 })
const reminderEnabled = ref(false)

const availableLists = computed(() => {
  return listStore.taskLists.filter(l => !l.deleted)
})

const availableGroups = computed(() => {
  if (!formListId.value) return []
  const list = listStore.taskLists.find(l => l.id === formListId.value)
  if (!list) return []
  return [...list.groups].sort((a, b) => a.order - b.order)
})

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

const addChecklistItem = async () => {
  formChecklist.value.push({ id: 'cl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), text: '' })
  await nextTick()
  const textareas = checklistContainerRef.value?.querySelectorAll('textarea')
  const last = textareas?.[textareas.length - 1] as HTMLTextAreaElement | undefined
  last?.focus()
}

const onChecklistItemBlur = (idx: number) => {
  if (formChecklist.value[idx] && !formChecklist.value[idx].text.trim()) {
    formChecklist.value.splice(idx, 1)
  }
}

const removeChecklistItem = (idx: number) => {
  formChecklist.value.splice(idx, 1)
}

const formDragSourceIdx = ref<number | null>(null)
const formDragOverIdx = ref<number | null>(null)

const onFormChecklistDragStart = (e: DragEvent, idx: number) => {
  formDragSourceIdx.value = idx
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

const onFormChecklistDragOver = (_e: DragEvent, idx: number) => {
  formDragOverIdx.value = idx
}

const onFormChecklistDragLeave = (idx: number) => {
  if (formDragOverIdx.value === idx) formDragOverIdx.value = null
}

const onFormChecklistDrop = (targetIdx: number) => {
  formDragOverIdx.value = null
  const fromIdx = formDragSourceIdx.value
  if (fromIdx === null || fromIdx === targetIdx) return
  const items = [...formChecklist.value]
  const [moved] = items.splice(fromIdx, 1)
  items.splice(targetIdx, 0, moved)
  formChecklist.value = items
}

const handleSubmit = () => {
  const name = formName.value.trim()
  if (!name) { ElMessage.warning({ message: '任务名称没有填写', customClass: 'message-above-dialog' }); return }
  if (!formListId.value) { ElMessage.warning({ message: '请选择清单', customClass: 'message-above-dialog' }); return }
  if (!formGroupId.value) { ElMessage.warning({ message: '请选择分组', customClass: 'message-above-dialog' }); return }
  let reminderStrategy: ReminderStrategy = 'none'
  let reminderDays = 0
  let reminderHours = 0
  let reminderMinutes = 0
  if (reminderEnabled.value) {
    if (reminderTime.value.days === 0 && reminderTime.value.hours === 0 && reminderTime.value.minutes === 0) {
      reminderStrategy = 'on_time'
    } else {
      reminderStrategy = 'advance'
      reminderDays = reminderTime.value.days
      reminderHours = reminderTime.value.hours
      reminderMinutes = reminderTime.value.minutes
    }
  }
  const checklist: ChecklistItem[] = formChecklist.value
    .filter(item => item.text.trim())
    .map(item => ({ id: item.id, text: item.text.trim(), completed: false }))
  emit('submit', {
    name,
    date: formDate.value,
    time: formTime.value,
    priority: formPriority.value,
    listId: formListId.value,
    groupId: formGroupId.value,
    repeatStrategy: formRepeatStrategy.value,
    repeatEndStrategy: formRepeatEndStrategy.value,
    repeatEndDate: formRepeatEndDate.value || undefined,
    repeatEndCount: formRepeatEndCount.value,
    repeatDays: repeatDays.value,
    repeatWeekdays: [...repeatWeekdays.value],
    repeatMonthDay: repeatMonthDay.value,
    repeatLunarMonth: repeatLunarMonth.value,
    repeatLunarDay: repeatLunarDay.value,
    reminderStrategy,
    reminderDays,
    reminderHours,
    reminderMinutes,
    note: formNote.value || undefined,
    checklist,
  })
}

const cancel = () => emit('cancel')

onMounted(async () => {
  await nextTick()
  const el = document.querySelector<HTMLInputElement>('.list-form .el-input__inner')
  el?.focus()
})
</script>

<style scoped>
.list-form { display: flex; flex-direction: column; gap: 14px; }
.list-form :deep(.el-input__wrapper) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
.list-form :deep(.el-input__inner) { color: #fff; }
.list-form :deep(.el-input__inner::placeholder) { color: rgba(255, 255, 255, 0.4); }
.list-form :deep(.el-textarea__inner) { color: #fff; background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
.list-form :deep(.el-textarea__inner::placeholder) { color: rgba(255,255,255,0.4); }

.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; color: var(--chalk-dim); }
.full-select { width: 100%; }
.full-input-num { width: 100%; }
.full-input-num :deep(.el-input__wrapper) { width: 100%; }

.date-area-wrap { width: 130px; }
.time-area-wrap { width: 60px; }
.time-area-wrap :deep(.time-btn) { justify-content: center; }
.time-area-wrap :deep(.time-picker-wrapper) { display: block; width: 100%; }

.list-select { width: 90px; }
.group-select { width: 120px; }
.repeat-select { width: 140px; }
.end-repeat-select { width: 110px; }
.repeat-count-input { width: 120px !important; }
.repeat-count-input :deep(.el-input__wrapper) { width: 100%; }

.list-form-footer { display: flex; justify-content: center; gap: 12px; }

.priority-buttons { display: flex; gap: 6px; }
.priority-btn { flex: 1; padding: 6px 4px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: var(--chalk-white-70); border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.15s; }
.priority-btn:hover { background: rgba(255,255,255,0.1); }
.priority-btn.active { background: rgba(255,255,255,0.08); font-weight: 600; }

.weekday-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.weekday-btn { padding: 6px 0; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: var(--chalk-white-70); border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
.weekday-btn:hover { background: rgba(255,255,255,0.1); }
.weekday-btn.active { background: rgba(102,126,234,0.3); border-color: #667eea; color: var(--chalk-white); }

.select-option-row { display: flex; align-items: center; gap: 8px; }
.select-option-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

.reminder-area { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; width: 100%; }
.reminder-select { width: 100px; }
.reminder-select :deep(.el-select__wrapper) { padding: 0 8px; min-height: 28px; }
.reminder-select :deep(.el-select__placeholder) { font-size: 12px; }
.reminder-advance-wrap { width: 210px; }
.reminder-advance-wrap :deep(.reminder-trigger) { width: 100%; }

:deep(.el-select__wrapper) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
:deep(.el-input-number) { width: 100%; }
:deep(.el-input-number .el-input__wrapper) { width: 100%; background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }

.checklist-form-items { display: flex; flex-direction: column; gap: 6px; }
.checklist-form-items:focus-within .checklist-form-add { display: none; }
.checklist-form-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 6px; transition: all 0.2s ease; }
.checklist-form-item:hover { background: rgba(255, 255, 255, 0.05); }
.checklist-form-item.drag-over { background: rgba(102,126,234,0.15); }
.checklist-form-input { flex: 1; }
.checklist-form-input :deep(.el-textarea__inner) { font-size: 13px; }
.checklist-drag-handle { font-size: 14px; color: var(--chalk-white-30); cursor: grab; flex-shrink: 0; }
.checklist-drag-handle:active { cursor: grabbing; }
.checklist-form-delete { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; background: transparent; color: var(--chalk-muted); cursor: pointer; border-radius: 4px; transition: all 0.15s; flex-shrink: 0; }
.checklist-form-delete:hover { background: rgba(255,255,255,0.1); color: var(--chalk-danger); }
.checklist-form-add { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--chalk-subtle); padding: 4px 8px; border-radius: 6px; cursor: pointer; transition: all 0.15s; }
.checklist-form-add:hover { color: var(--chalk-white-70); background: rgba(255,255,255,0.05); }

.task-wavy-divider { height: 1px; background: rgba(255, 255, 255, 0.15); }

.capsule-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 18px; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 20px; background: transparent; color: var(--chalk-white-70); cursor: pointer; font-size: 13px; font-family: inherit; }
.capsule-btn .capsule-icon { width: 14px; height: 14px; }
.capsule-save { background: rgba(102, 126, 234, 0.2); border-color: rgba(102, 126, 234, 0.4); color: #93c5fd; }
</style>

<style>
.task-form-list-popper { min-width: 90px !important; width: 90px !important; }
.task-form-group-popper { min-width: 120px !important; width: 120px !important; }
.task-form-repeat-popper { min-width: 140px !important; width: 140px !important; }
.task-form-end-repeat-popper { min-width: 110px !important; width: 110px !important; }
.task-form-reminder-popper { min-width: 100px !important; width: 100px !important; }
</style>
