<template>
  <div class="mission-form-container">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px" class="form-body">
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="form.name" placeholder="你的任务是什么？" />
      </el-form-item>

      <el-form-item label="所属清单" prop="listId">
        <el-select v-model="form.listId" placeholder="选择清单" style="width: 100%" @change="handleListChange">
          <el-option v-for="list in allLists" :key="list.id" :label="list.name" :value="list.id">
            <span class="list-option"><span class="list-color-option" :style="{ background: list.color }"></span>{{ list.name }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="所属分组" prop="groupId">
        <el-select v-model="form.groupId" placeholder="选择分组" style="width: 100%">
          <el-option v-for="group in availableGroups" :key="group.id" :label="group.name" :value="group.id">
            <span class="group-option"><span class="group-color" :style="{ background: group.color }"></span>{{ group.name }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="结束日期">
        <LunarDatePicker v-model="form.date" placeholder="选择日期" full-width />
      </el-form-item>

      <el-form-item label="结束时间">
        <el-time-picker v-model="form.endTime" placeholder="选择结束时间" format="HH:mm" value-format="HH:mm" clearable style="width: 100%" />
      </el-form-item>
 
      <el-form-item label="优先级" prop="priority">
        <el-select v-model="form.priority" placeholder="选择优先级" style="width: 100%">
          <el-option v-for="p in PRIORITIES" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </el-form-item>

      <el-form-item label="重复">
        <div class="repeat-strategy-row">
          <el-select v-model="form.repeatStrategy" placeholder="选择重复策略" style="flex: 1" :disabled="!form.date">
            <el-option v-for="s in REPEAT_STRATEGIES" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <template v-if="form.repeatStrategy === 'custom_days'">
            <span class="custom-days-label">每隔</span>
            <el-input-number v-model="form.repeatCustomDays" :min="1" :max="365" controls-position="right" style="width: 100px" />
            <span class="custom-days-label">天</span>
          </template>
        </div>
      </el-form-item>

      <el-form-item v-if="form.repeatStrategy !== 'none'" label="结束重复">
        <div class="repeat-end">
          <el-select v-model="form.repeatEndStrategy" style="width: 150px">
            <el-option v-for="s in REPEAT_END_STRATEGIES" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <LunarDatePicker v-if="form.repeatEndStrategy === 'date'" v-model="form.repeatEndDate" placeholder="选择结束日期" fullWidth />
          <el-input-number v-if="form.repeatEndStrategy === 'count'" v-model="form.repeatCount" :min="1" :max="999" controls-position="right" style="width: 120px" />
          <span v-if="form.repeatEndStrategy === 'count'" class="count-suffix">次</span>
        </div>
      </el-form-item>

      <el-form-item label="检查事项" class="checklist-form-item">
        <div class="checklist">
          <div v-for="(item, index) in form.checklist" :key="item.id" class="checklist-item"
               :class="{ 'drag-over': checklistDragOverIdx === index }"
               @dragover.prevent="onChecklistDragOver(index)"
               @drop="onChecklistDrop(index)"
               @dragleave="checklistDragOverIdx = -1">
            <el-icon class="checklist-form-drag-handle" draggable="true"
              @dragstart="onChecklistDragStart(index)"
              @dragend="checklistDragOverIdx = -1"
            ><Rank /></el-icon>
            <el-input v-model="item.text" type="textarea" autosize placeholder="检查事项" size="small" class="checklist-textarea" />
            <el-button class="checklist-delete-btn" text size="small" @click="removeChecklistItem(item.id)"><el-icon><Delete /></el-icon></el-button>
          </div>
          <div class="checklist-add-btn-wrapper">
            <el-button class="checklist-add-btn" text @click="addChecklistItem"><el-icon><Plus /></el-icon><span>添加检查事项</span></el-button>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.notes" type="textarea" placeholder="添加备注..." :rows="3" />
      </el-form-item>

      <el-form-item label="提醒">
        <div class="reminder-row">
          <el-select v-model="form.reminderStrategy" placeholder="选择提醒方式" style="width: 180px">
            <el-option label="不提醒" value="none" />
            <el-option label="准时提醒" value="on_time" />
            <el-option label="提前提醒" value="advance" />
          </el-select>
          <template v-if="form.reminderStrategy === 'advance'">
            <ReminderTimePicker v-model="reminderTime" />
          </template>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Plus, Rank, Delete } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useMissionStore, PRIORITIES, REPEAT_STRATEGIES, REPEAT_END_STRATEGIES, type Mission, type ChecklistItem, type RepeatStrategy, type RepeatEndStrategy, type Priority, type ReminderStrategy } from '../stores/missionStore'
import LunarDatePicker from './LunarDatePicker.vue'
import ReminderTimePicker from './ReminderTimePicker.vue'

const props = defineProps<{ mission?: Mission | null; listId?: string; groupId?: string }>()
const emit = defineEmits<{
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'cancel'): void
}>()

const missionStore = useMissionStore()
const formRef = ref<FormInstance>()
const isEdit = computed(() => !!props.mission)
const allLists = computed(() => missionStore.lists)

const currentSelectedListId = computed(() => {
  return props.mission?.listId || props.listId || ''
})

const availableGroups = computed(() => {
  const lid = currentSelectedListId.value; if (!lid) return []; const l = missionStore.lists.find(x => x.id === lid); return l?.groups || []
})

interface FormData {
  name: string; listId: string; groupId: string; date: string; endTime: string;
  repeatStrategy: string; repeatCustomDays: number; repeatEndStrategy: string;
  repeatEndDate: string; repeatCount: number; priority: string;
  checklist: ChecklistItem[]; notes: string
  reminderStrategy: string; reminderDays: number; reminderHours: number; reminderMinutes: number
}

const getDefaultForm = (): FormData => {
  const groups = availableGroups.value
  return { name: '', listId: props.listId || (allLists.value.length > 0 ? allLists.value[0].id : ''), groupId: props.groupId || groups[0]?.id || '', date: '', endTime: '', repeatStrategy: 'none', repeatCustomDays: 1, repeatEndStrategy: 'never', repeatEndDate: '', repeatCount: 1, priority: 'none', checklist: [], notes: '', reminderStrategy: 'none', reminderDays: 0, reminderHours: 0, reminderMinutes: 10 }
}

const form = ref<FormData>(getDefaultForm())

const reminderTime = computed({
  get: () => ({ days: form.value.reminderDays, hours: form.value.reminderHours, minutes: form.value.reminderMinutes }),
  set: (v) => { form.value.reminderDays = v.days; form.value.reminderHours = v.hours; form.value.reminderMinutes = v.minutes }
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  groupId: [{ required: true, message: '请选择所属分组', trigger: 'change' }],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }]
}

watch(() => props.mission, (nm) => {
  if (nm) { 
    form.value = { name: nm.name, listId: nm.listId, groupId: nm.groupId, date: nm.date, endTime: nm.endTime || '', repeatStrategy: nm.repeatStrategy, repeatCustomDays: nm.repeatCustomDays || 1, repeatEndStrategy: nm.repeatEndStrategy, repeatEndDate: nm.repeatEndDate, repeatCount: nm.repeatCount, priority: nm.priority, checklist: nm.checklist.map(i => ({ ...i })), notes: nm.notes, reminderStrategy: nm.reminderStrategy, reminderDays: nm.reminderDays ?? 0, reminderHours: nm.reminderHours ?? 0, reminderMinutes: nm.reminderMinutes ?? 10 }
  }
  else { form.value = getDefaultForm() }
}, { immediate: true })

watch(() => props.groupId, (ng) => { if (ng && !props.mission) form.value.groupId = ng }, { immediate: true })

const handleListChange = () => { const g = availableGroups.value; form.value.groupId = g.length > 0 ? g[0].id : '' }

const addChecklistItem = () => { form.value.checklist.push({ id: Date.now().toString(), text: '', completed: false }) }
const removeChecklistItem = (id: string) => { form.value.checklist = form.value.checklist.filter(i => i.id !== id) }

const checklistDragSourceIdx = ref(-1)
const checklistDragOverIdx = ref(-1)

const onChecklistDragStart = (idx: number) => { checklistDragSourceIdx.value = idx }
const onChecklistDragOver = (idx: number) => { checklistDragOverIdx.value = idx }
const onChecklistDrop = (targetIdx: number) => {
  checklistDragOverIdx.value = -1
  const a = form.value.checklist
  const from = checklistDragSourceIdx.value
  if (from < 0 || from >= a.length || from === targetIdx) return
  const [moved] = a.splice(from, 1)
  a.splice(targetIdx, 0, moved)
  form.value.checklist = [...a]
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (valid) {
      const listId = form.value.listId; if (!listId) return
      const md = { name: form.value.name, listId, groupId: form.value.groupId, date: form.value.date, startTime: '', endTime: form.value.endTime || '', repeatStrategy: form.value.repeatStrategy as RepeatStrategy, repeatCustomDays: form.value.repeatCustomDays, repeatEndStrategy: form.value.repeatEndStrategy as RepeatEndStrategy, repeatEndDate: form.value.repeatEndDate, repeatCount: form.value.repeatCount, priority: form.value.priority as Priority, checklist: form.value.checklist.filter(i => i.text.trim()), completed: false, completedStartTime: '', completedEndTime: '', notes: form.value.notes, reminderStrategy: form.value.reminderStrategy as ReminderStrategy, reminderDays: form.value.reminderDays, reminderHours: form.value.reminderHours, reminderMinutes: form.value.reminderMinutes }
      emit('submit', md as unknown as Record<string, unknown>)
    }
  })
}

defineExpose({ handleSubmit })

</script>

<style scoped>
.mission-form-container { max-width: 600px; width: 100%; margin: 0 auto; padding-top: 20px; }
.form-body { padding: 0 8px; overflow: hidden; }
.form-body::-webkit-scrollbar { display: none; }
.repeat-end { display: flex; align-items: center; gap: 12px; }
.repeat-strategy-row { display: flex; align-items: center; gap: 8px; width: 100%; }
.custom-days-label { color: #606266; white-space: nowrap; }
.reminder-row { display: flex; align-items: center; gap: 8px; width: 100%; flex-wrap: wrap; }
.reminder-label { color: rgba(255,255,255,0.6); white-space: nowrap; font-size: 13px; }
.count-suffix { color: #909399; }
.checklist { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.checklist-item { display: flex; align-items: flex-start; gap: 4px; margin-bottom: 0; }
.checklist-item.drag-over { background: rgba(102, 126, 234, 0.1); border-radius: 6px; }
.checklist-form-drag-handle { font-size: 16px; color: rgba(255, 255, 255, 0.2); cursor: grab; flex-shrink: 0; margin-top: 6px; }
.checklist-form-drag-handle:active { cursor: grabbing; }
.checklist-textarea { flex: 1; }
.checklist-delete-btn { color: #ef4444; flex-shrink: 0; width: 24px; height: 24px; padding: 0; min-width: auto; margin-top: 4px; background: #1d1b34 !important; }
.checklist-delete-btn:hover { color: #ff6b6b; background: #1d1b34 !important; }
.checklist-add-btn-wrapper { display: flex; gap: 4px; align-items: center; }
.checklist-add-btn-wrapper::before { content: ''; width: 16px; flex-shrink: 0; }
.checklist-add-btn-wrapper::after { content: ''; width: 24px; flex-shrink: 0; }
.checklist-add-btn { flex: 1; justify-content: center; color: rgba(255, 255, 255, 0.3); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 6px 0; display: flex; align-items: center; gap: 6px; font-size: 12px; background: #1d1b34 !important; }
.checklist-add-btn:hover { color: rgba(255, 255, 255, 0.6); border-color: rgba(255, 255, 255, 0.2); background: #1d1b34 !important; }

:deep(.el-time-panel) {
  background: rgba(30, 30, 50, 0.98) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
}

:deep(.el-time-spinner__item) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.el-time-spinner__item:hover:not(.disabled):not(.active)) {
  background: rgba(102, 126, 234, 0.15) !important;
}

:deep(.el-time-spinner__item.active:not(.disabled)) {
  color: #667eea !important;
  font-weight: bold;
  background: transparent !important;
}

:deep(.el-time-spinner__list:hover) {
  background: transparent !important;
}

:deep(.el-time-spinner) {
  background: transparent !important;
}

:deep(.el-time-spinner__item.is-active) {
  color: #667eea !important;
  font-weight: bold;
  background: transparent !important;
}

:deep(.el-time-panel__footer) {
  border-color: rgba(255, 255, 255, 0.08) !important;
  background: rgba(30, 30, 50, 0.98) !important;
}

:deep(.el-time-panel__btn) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.7) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
}

:deep(.el-time-panel__btn.confirm) {
  color: #667eea !important;
}

:deep(.el-time-panel__content) {
  background: transparent !important;
}

:deep(.el-time-range-spinner) {
  background: transparent !important;
}
.group-option { display: flex; align-items: center; gap: 8px; }
.group-color { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.list-option { display: flex; align-items: center; gap: 8px; }
.list-color-option { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }

:deep(.el-radio-button__inner) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }
:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) { background: linear-gradient(135deg,#667eea,#764ba2); border-color: #667eea; color: #fff; }
:deep(.el-input__wrapper), :deep(.el-select__wrapper), :deep(.el-textarea__inner) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); box-shadow: none; }
:deep(.el-input__inner), :deep(.el-textarea__inner) { color: rgba(255,255,255,0.9); }
:deep(.el-input__inner::placeholder), :deep(.el-textarea__inner::placeholder) { color: rgba(255,255,255,0.4); }
:deep(.el-form-item__label) { color: rgba(255,255,255,0.7); }
:deep(.el-input__count), :deep(.el-input__count-inner) { background: transparent !important; color: rgba(255,255,255,0.4) !important; }
</style>
