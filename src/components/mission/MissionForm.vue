<template>
  <div class="mission-form">
    <el-input v-model="formName" placeholder="请输入任务名称" @keyup.enter="handleSubmit" />

    <div class="form-row">
      <span class="form-label">日期</span>
      <DateScrollPicker v-model="formDate" />
    </div>

    <div class="form-row" v-if="formDate">
      <span class="form-label">时间</span>
      <TimePickerPopover v-model="formTime" />
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
      <el-select v-model="formListId" placeholder="选择清单" class="full-select" popper-class="dark-select-popper">
        <el-option v-for="list in availableLists" :key="list.id" :label="list.name" :value="list.id">
          <div class="select-option-row"><span class="select-option-dot" :style="{ background: list.color }"></span>{{ list.name }}</div>
        </el-option>
      </el-select>
    </div>

    <div class="form-row" v-if="formListId">
      <span class="form-label">所属分组</span>
      <el-select v-model="formGroupId" placeholder="选择分组" class="full-select" popper-class="dark-select-popper">
        <el-option v-for="g in availableGroups" :key="g.id" :label="g.name" :value="g.id">
          <div class="select-option-row"><span class="select-option-dot" :style="{ background: g.color }"></span>{{ g.name }}</div>
        </el-option>
      </el-select>
    </div>

    <div class="form-row">
      <span class="form-label">重复</span>
      <el-select v-model="formRepeatStrategy" placeholder="不重复" class="full-select" popper-class="dark-select-popper">
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
    <div class="form-row" v-if="formRepeatStrategy === 'lunar_date'">
      <span class="form-label">农历月</span>
      <el-select v-model="repeatLunarMonth" class="full-select" popper-class="dark-select-popper">
        <el-option v-for="(m, i) in LUNAR_MONTHS" :key="i" :label="m" :value="i + 1" />
      </el-select>
      <span class="form-label" style="margin-top: 10px;">农历日</span>
      <el-input-number v-model="repeatLunarDay" :min="1" :max="30" class="full-input-num" />
    </div>

    <div class="form-row" v-if="formRepeatStrategy !== 'none'">
      <span class="form-label">结束重复</span>
      <el-select v-model="formRepeatEndStrategy" class="full-select" popper-class="dark-select-popper">
        <el-option v-for="s in REPEAT_END_STRATEGIES" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
    </div>
    <div class="form-row" v-if="formRepeatStrategy !== 'none' && formRepeatEndStrategy === 'date'">
      <span class="form-label">结束日期</span>
      <DateScrollPicker v-model="formRepeatEndDate" />
    </div>
    <div class="form-row" v-if="formRepeatStrategy !== 'none' && formRepeatEndStrategy === 'count'">
      <span class="form-label">重复次数</span>
      <el-input-number v-model="formRepeatEndCount" :min="1" :max="9999" class="full-input-num" />
    </div>

    <div class="form-row">
      <span class="form-label">提醒</span>
      <ReminderTimePicker v-model="reminderTime" />
    </div>

    <div class="form-row">
      <span class="form-label">备注</span>
      <el-input v-model="formNote" type="textarea" :rows="2" placeholder="添加备注..." />
    </div>

    <div class="mission-form-footer">
      <el-button @click="cancel">取消</el-button>
      <el-button type="primary" @click="handleSubmit">保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useMissionStore, type RepeatStrategy, type RepeatEndStrategy, REPEAT_STRATEGIES, REPEAT_END_STRATEGIES, PRIORITIES } from '../../stores/missionStore'
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

const missionStore = useMissionStore()

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']

const formName = ref('')
const formDate = ref('')
const formTime = ref('')
const formPriority = ref<typeof PRIORITIES[number]['value']>('medium')
const formListId = ref(props.listId || '')
const formGroupId = ref(props.groupId || '')
const formRepeatStrategy = ref<RepeatStrategy>('none')
const formRepeatEndStrategy = ref<RepeatEndStrategy>('never')
const formRepeatEndDate = ref('')
const formRepeatEndCount = ref(1)
const formNote = ref('')
const repeatDays = ref(1)
const repeatWeekdays = ref<number[]>([0, 1, 2, 3, 4])
const repeatLunarMonth = ref(1)
const repeatLunarDay = ref(1)
const reminderTime = ref({ days: 0, hours: 0, minutes: 15 })

const availableLists = computed(() => {
  return missionStore.lists.filter(l => !l.deleted)
})

const availableGroups = computed(() => {
  if (!formListId.value) return []
  const list = missionStore.lists.find(l => l.id === formListId.value)
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

const handleSubmit = () => {
  const name = formName.value.trim()
  if (!name) { ElMessage.warning('请输入任务名称'); return }
  if (!formListId.value) { ElMessage.warning('请选择清单'); return }
  if (!formGroupId.value) { ElMessage.warning('请选择分组'); return }
  emit('submit', {
    name,
    date: formDate.value || undefined,
    time: formTime.value || undefined,
    priority: formPriority.value,
    listId: formListId.value,
    groupId: formGroupId.value,
    repeatStrategy: formRepeatStrategy.value,
    repeatEndStrategy: formRepeatEndStrategy.value,
    repeatEndDate: formRepeatEndDate.value || undefined,
    repeatEndCount: formRepeatEndCount.value,
    repeatDays: repeatDays.value,
    repeatWeekdays: [...repeatWeekdays.value],
    repeatLunarMonth: repeatLunarMonth.value,
    repeatLunarDay: repeatLunarDay.value,
    reminder: { ...reminderTime.value },
    note: formNote.value || undefined,
  })
}

const cancel = () => emit('cancel')
</script>

<style scoped>
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

:deep(.el-select__wrapper) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
:deep(.el-input-number) { width: 100%; }
:deep(.el-input-number .el-input__wrapper) { width: 100%; background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
</style>