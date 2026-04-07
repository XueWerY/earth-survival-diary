<template>
  <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑任务' : '添加任务'"
      width="600px"
      @close="resetForm"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
      <!-- 任务名称 -->
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="form.name" placeholder="你的任务是什么？" />
      </el-form-item>

      <!-- 所属分组 -->
      <el-form-item label="所属分组" prop="groupId">
        <el-select v-model="form.groupId" placeholder="选择分组" style="width: 100%">
          <el-option
              v-for="group in availableGroups"
              :key="group.id"
              :label="group.name"
              :value="group.id"
          >
            <span class="group-option">
              <span class="group-color" :style="{ background: group.color }"></span>
              {{ group.name }}
            </span>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 日期和时间 -->
      <el-form-item label="日期">
        <LunarDatePicker
            v-model="form.date"
            placeholder="选择日期"
            full-width
        />
      </el-form-item>

      <el-form-item label="时间">
        <div class="time-range">
          <el-time-picker
              v-model="form.startTime"
              placeholder="开始时间（可选）"
              format="HH:mm"
              value-format="HH:mm"
              :disabled-hours="() => form.endTime ? getDisabledHours(form.endTime) : []"
              :disabled-minutes="() => form.endTime ? getDisabledMinutes(form.endTime, form.startTime) : []"
              clearable
          />
          <span class="time-separator">至</span>
          <el-time-picker
              v-model="form.endTime"
              placeholder="结束时间（可选）"
              format="HH:mm"
              value-format="HH:mm"
              :disabled-hours="() => form.startTime ? getDisabledHours(form.startTime, false) : []"
              :disabled-minutes="() => form.startTime ? getDisabledMinutes(form.startTime, form.endTime, false) : []"
              clearable
          />
        </div>
      </el-form-item>

      <!-- 优先级 -->
      <el-form-item label="优先级" prop="priority">
        <el-radio-group v-model="form.priority">
          <el-radio-button
              v-for="p in PRIORITIES"
              :key="p.value"
              :value="p.value"
          >
            {{ p.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!-- 重复策略 -->
      <el-form-item label="重复">
        <div class="repeat-strategy-row">
          <el-select v-model="form.repeatStrategy" placeholder="选择重复策略" style="flex: 1">
            <el-option
                v-for="s in REPEAT_STRATEGIES"
                :key="s.value"
                :label="s.label"
                :value="s.value"
            />
          </el-select>
          <template v-if="form.repeatStrategy === 'custom_days'">
            <span class="custom-days-label">每隔</span>
            <el-input-number
                v-model="form.repeatCustomDays"
                :min="1"
                :max="365"
                controls-position="right"
                style="width: 100px"
            />
            <span class="custom-days-label">天</span>
          </template>
        </div>
      </el-form-item>

      <!-- 结束重复策略（仅当重复策略不为"不重复"时显示） -->
      <el-form-item v-if="form.repeatStrategy !== 'none'" label="结束重复">
        <div class="repeat-end">
          <el-select v-model="form.repeatEndStrategy" style="width: 150px">
            <el-option
                v-for="s in REPEAT_END_STRATEGIES"
                :key="s.value"
                :label="s.label"
                :value="s.value"
            />
          </el-select>

          <LunarDatePicker
              v-if="form.repeatEndStrategy === 'date'"
              v-model="form.repeatEndDate"
              placeholder="选择结束日期"
          />

          <el-input-number
              v-if="form.repeatEndStrategy === 'count'"
              v-model="form.repeatCount"
              :min="1"
              :max="999"
              controls-position="right"
              style="width: 120px"
          />
          <span v-if="form.repeatEndStrategy === 'count'" class="count-suffix">次</span>
        </div>
      </el-form-item>

      <!-- 检查事项 -->
      <el-form-item label="检查事项">
        <div class="checklist">
          <div
              v-for="item in form.checklist"
              :key="item.id"
              class="checklist-item"
          >
            <el-input
                v-model="item.text"
                placeholder="检查事项"
                size="small"
            />
            <el-button
                type="danger"
                :icon="Delete"
                circle
                size="small"
                @click="removeChecklistItem(item.id)"
            />
          </div>
          <el-button
              type="primary"
              text
              :icon="Plus"
              @click="addChecklistItem"
          >
            添加检查事项
          </el-button>
        </div>
      </el-form-item>

      <!-- 备注 -->
      <el-form-item label="备注">
        <el-input
            v-model="form.notes"
            type="textarea"
            placeholder="添加备注..."
            :rows="3"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit">
        {{ isEdit ? '保存' : '添加' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useMissionStore, PRIORITIES, REPEAT_STRATEGIES, REPEAT_END_STRATEGIES, type Mission, type ChecklistItem, type RepeatStrategy, type RepeatEndStrategy, type Priority } from '../stores/missionStore'
import LunarDatePicker from './LunarDatePicker.vue'

const props = defineProps<{
  visible: boolean
  mission?: Mission | null
  listId?: string
  groupId?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit'): void
}>()

const missionStore = useMissionStore()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const formRef = ref<FormInstance>()

const isEdit = computed(() => !!props.mission)

// 获取当前清单内的分组列表
const availableGroups = computed(() => {
  // 编辑时优先使用使命的 listId，否则使用传入的 listId
  const listId = props.mission?.listId || props.listId
  if (!listId) return []
  const list = missionStore.lists.find(l => l.id === listId)
  return list?.groups || []
})

interface FormData {
  name: string
  groupId: string
  date: string
  startTime: string
  endTime: string
  repeatStrategy: string
  repeatCustomDays: number
  repeatEndStrategy: string
  repeatEndDate: string
  repeatCount: number
  priority: string
  checklist: ChecklistItem[]
  notes: string
}

const getDefaultForm = (): FormData => {
  const groups = availableGroups.value
  return {
    name: '',
    groupId: props.groupId || groups[0]?.id || '',
    date: '',
    startTime: '',
    endTime: '',
    repeatStrategy: 'none',
    repeatCustomDays: 1,
    repeatEndStrategy: 'never',
    repeatEndDate: '',
    repeatCount: 1,
    priority: 'none',
    checklist: [],
    notes: ''
  }
}

const form = ref<FormData>(getDefaultForm())

const rules: FormRules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  groupId: [{ required: true, message: '请选择所属分组', trigger: 'change' }],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }]
}

// 获取禁用的小时（用于时间范围限制）
const getDisabledHours = (compareTime: string, isStart: boolean = true) => {
  const hours: number[] = []
  if (!compareTime) return hours

  const compareHour = parseInt(compareTime.split(':')[0])

  if (isStart) {
    // 开始时间：禁用大于比较时间的小时
    for (let i = compareHour + 1; i < 24; i++) {
      hours.push(i)
    }
  } else {
    // 结束时间：禁用小于比较时间的小时
    for (let i = 0; i < compareHour; i++) {
      hours.push(i)
    }
  }

  return hours
}

// 获取禁用的分钟（用于时间范围限制）
const getDisabledMinutes = (compareTime: string, currentTime: string, isStart: boolean = true) => {
  const minutes: number[] = []
  if (!compareTime || !currentTime) return minutes

  const compareHour = parseInt(compareTime.split(':')[0])
  const currentHour = parseInt(currentTime.split(':')[0])

  // 只有当小时相同时才需要禁用分钟
  if (isStart) {
    // 开始时间：当小时相同时，禁用大于比较时间的分钟
    if (currentHour === compareHour) {
      const compareMinute = parseInt(compareTime.split(':')[1])
      for (let i = compareMinute; i < 60; i++) {
        minutes.push(i)
      }
    }
  } else {
    // 结束时间：当小时相同时，禁用小于比较时间的分钟
    if (currentHour === compareHour) {
      const compareMinute = parseInt(compareTime.split(':')[1])
      for (let i = 0; i <= compareMinute; i++) {
        minutes.push(i)
      }
    }
  }

  return minutes
}

// 监听 mission 变化，填充表单
watch(() => props.mission, (newMission) => {
  if (newMission) {
    form.value = {
      name: newMission.name,
      groupId: newMission.groupId,
      date: newMission.date,
      startTime: newMission.startTime,
      endTime: newMission.endTime,
      repeatStrategy: newMission.repeatStrategy,
      repeatCustomDays: newMission.repeatCustomDays || 1,
      repeatEndStrategy: newMission.repeatEndStrategy,
      repeatEndDate: newMission.repeatEndDate,
      repeatCount: newMission.repeatCount,
      priority: newMission.priority,
      checklist: newMission.checklist.map(item => ({ ...item })),
      notes: newMission.notes
    }
  } else {
    // 当 mission 为 null 时，重置表单为默认值
    const groups = availableGroups.value
    form.value = {
      name: '',
      groupId: props.groupId || groups[0]?.id || '',
      date: '',
      startTime: '',
      endTime: '',
      repeatStrategy: 'none',
      repeatCustomDays: 1,
      repeatEndStrategy: 'never',
      repeatEndDate: '',
      repeatCount: 1,
      priority: 'none',
      checklist: [],
      notes: ''
    }
  }
}, { immediate: true, flush: 'sync' })

// 监听分组变化，设置默认分组
watch(() => props.groupId, (newGroupId) => {
  if (newGroupId && !props.mission) {
    form.value.groupId = newGroupId
  }
}, { immediate: true })

// 添加检查事项
const addChecklistItem = () => {
  form.value.checklist.push({
    id: Date.now().toString(),
    text: '',
    completed: false
  })
}

// 移除检查事项
const removeChecklistItem = (id: string) => {
  form.value.checklist = form.value.checklist.filter(item => item.id !== id)
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (valid) {
      // 编辑时优先使用使命的 listId，否则使用传入的 listId
      const listId = props.mission?.listId || props.listId
      if (!listId) return

      const missionData = {
        name: form.value.name,
        listId: listId,
        groupId: form.value.groupId,
        date: form.value.date,
        startTime: form.value.startTime,
        endTime: form.value.endTime,
        repeatStrategy: form.value.repeatStrategy as RepeatStrategy,
        repeatCustomDays: form.value.repeatCustomDays,
        repeatEndStrategy: form.value.repeatEndStrategy as RepeatEndStrategy,
        repeatEndDate: form.value.repeatEndDate,
        repeatCount: form.value.repeatCount,
        priority: form.value.priority as Priority,
        checklist: form.value.checklist.filter(item => item.text.trim()),
        completed: false,
        completedStartTime: '',
        completedEndTime: '',
        notes: form.value.notes
      }

      if (isEdit.value && props.mission) {
        missionStore.updateMission(props.mission.id, missionData)
      } else {
        missionStore.addMission(missionData)
      }

      emit('submit')
      dialogVisible.value = false
    }
  })
}

// 重置表单
const resetForm = () => {
  // 只有在新建模式下才重置表单
  // 编辑模式下，watch 会根据 props.mission 变化自动处理
  if (!props.mission) {
    form.value = getDefaultForm()
  }
  // 清除表单验证状态
  formRef.value?.clearValidate()
}
</script>

<style scoped>
.time-range {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-separator {
  color: #909399;
  flex-shrink: 0;
}

.repeat-end {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-input-group {
  display: flex;
  align-items: center;
}

.date-input {
  width: 70px;
}

.date-input.small {
  width: 50px;
}

.date-sep {
  margin: 0 4px;
  color: rgba(0, 0, 0, 0.4);
}

.repeat-strategy-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.custom-days-label {
  color: #606266;
  white-space: nowrap;
}

.count-suffix {
  color: #909399;
}

.checklist {
  width: 100%;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.checklist-item .el-input {
  flex: 1;
}

.group-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

:deep(.el-radio-button__inner) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
}

:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: #fff;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-textarea__inner) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: none;
}

:deep(.el-input__inner),
:deep(.el-textarea__inner) {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.el-input__inner::placeholder),
:deep(.el-textarea__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

:deep(.el-form-item__label) {
  color: rgba(255, 255, 255, 0.7);
}

:deep(.el-input__count),
:deep(.el-input__count-inner) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.4) !important;
}
</style>
