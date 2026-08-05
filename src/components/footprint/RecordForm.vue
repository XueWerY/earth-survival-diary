<template>
  <BaseDialog
    :visible="dialogVisible"
    :title="dialogTitle"
    :width="500"
    teleport
    @update:visible="dialogVisible = $event"
  >
    <el-form :model="form" :rules="rules" ref="formRef" class="record-form">
      <el-form-item label="名称" prop="name">
        <el-input
            v-model="form.name"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 5 }"
            placeholder="今天做了什么？"
        />
      </el-form-item>
      <el-form-item label="时间">
        <div class="time-range-row">
          <TimePickerPopover v-model="form.startTime" :offset-minutes="0" placeholder="开始" />
          <span class="time-range-sep">-</span>
          <TimePickerPopover v-model="form.endTime" :offset-minutes="60" placeholder="结束" />
        </div>
      </el-form-item>
      <el-form-item label="图标">
        <IconPicker v-model="form.icon" />
      </el-form-item>
      <el-form-item label="备注" prop="notes">
        <el-input
            v-model="form.notes"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 5 }"
            placeholder="添加备注"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <button class="capsule-btn" @click="dialogVisible = false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capsule-svg">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span>取消</span>
      </button>
      <button class="capsule-btn capsule-btn-primary" @click="handleSubmit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capsule-svg">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>{{ isEdit ? '更新' : '添加' }}</span>
      </button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import dayjs from 'dayjs'
import { useTaskStore, type Task } from '../../stores/taskStore'
import TimePickerPopover from '../common/picker/TimePickerPopover.vue'
import IconPicker from '../common/picker/IconPicker.vue'
import BaseDialog from '../ui/BaseDialog.vue'

const props = defineProps<{
  visible: boolean
  task?: Task | null
  defaultDate?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'submit': []
}>()

const taskStore = useTaskStore()
const formRef = ref<FormInstance>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})
const isEdit = ref(false)

const dialogTitle = computed(() => {
  return isEdit.value ? '编辑记录' : '记录足迹'
})

const form = reactive({
  name: '',
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '',
  endTime: '',
  notes: '',
  icon: ''
})

const rules = reactive<FormRules>({
  name: [{ required: true, message: '请输入事件名称', trigger: 'blur' }]
})

watch(() => props.visible, (val) => {
  if (val && props.task) {
    isEdit.value = true
    form.name = props.task.name
    form.date = props.task.date
    form.startTime = props.task.startTime
    form.endTime = props.task.endTime
    form.notes = props.task.notes || ''
    form.icon = props.task.icon || ''
  } else if (val) {
    isEdit.value = false
    form.name = ''
    form.date = props.defaultDate || dayjs().format('YYYY-MM-DD')
    form.startTime = ''
    form.endTime = ''
    form.notes = ''
    form.icon = ''
  } else {
    isEdit.value = false
  }
})

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  if (form.startTime && !form.endTime) {
    ElMessage.warning('填写了开始时间则必须填写结束时间')
    return
  }

  if (form.startTime && form.endTime && form.startTime >= form.endTime) {
    ElMessage.warning('结束时间必须大于开始时间')
    return
  }

  const newTask: any = {
    name: form.name,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    notes: form.notes,
    icon: form.icon || undefined,
    category: 'activity',
    isDiary: false,
    createdAt: new Date().toISOString(),
  }

  try {
    if (isEdit.value && props.task) {
      await taskStore.updateTask(props.task.id, {
        ...newTask,
        updatedAt: new Date().toISOString(),
      })
      ElMessage.success('记录已更新')
    } else {
      await taskStore.addTask(newTask)
      ElMessage.success('记录已添加')
    }
    dialogVisible.value = false
    emit('submit')
  } catch (e: any) {
    console.error('[RecordForm] Save failed', e.message)
    ElMessage.error('保存失败，请重试')
  }
}
</script>

<style scoped>
.record-form :deep(.el-form-item) { display: block; }
.record-form :deep(.el-form-item__label) { display: block; text-align: left; line-height: normal; padding-bottom: 4px; }
.record-form :deep(.el-form-item__content) { display: block; }

.capsule-btn {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-60);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  flex-shrink: 0;
  font-size: 12px;
}

.capsule-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--chalk-white);
}

.capsule-btn-primary {
  background: rgba(102, 126, 234, 0.3);
  color: var(--chalk-blue);
}

.capsule-btn-primary:hover {
  background: rgba(102, 126, 234, 0.45);
  color: #fff;
}

.capsule-svg {
  width: 14px;
  height: 14px;
}

:deep(.el-form-item) { margin-bottom: 20px; }
:deep(.el-form-item:last-child) { margin-bottom: 0; }
:deep(.el-form-item__label) { color: var(--chalk-white-70); width: 80px; }
:deep(.el-input__wrapper),
:deep(.el-textarea__inner) { background: rgba(255, 255, 255, 0.05) !important; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: none !important; }
:deep(.el-input__wrapper:hover),
:deep(.el-textarea__inner:hover) { border-color: rgba(102, 126, 234, 0.5); }
:deep(.el-input__inner),
:deep(.el-textarea__inner) { color: var(--chalk-white-90) !important; }
:deep(.el-input__inner::placeholder),
:deep(.el-textarea__inner::placeholder) { color: var(--chalk-subtle); }
:deep(.el-autocomplete) { width: 100%; }

.time-range-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.time-range-row :deep(.time-picker-wrapper) {
  flex: 1;
  min-width: 0;
  display: block;
  width: 100%;
}

.time-range-sep {
  color: var(--chalk-white-60);
  flex-shrink: 0;
}

:deep(.el-input__count),
:deep(.el-input__count-inner) { background: transparent !important; color: var(--chalk-subtle) !important; }
</style>