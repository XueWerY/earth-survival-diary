<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="dialog-overlay" @click.self="dialogVisible = false">
      <div class="dialog-container task-form-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">{{ dialogTitle }}</span>
        </div>
        <div class="dialog-body">
          <el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
            <el-form-item label="事件名称" prop="name">
              <el-input
                  v-model="form.name"
                  type="textarea"
                  :rows="2"
                  placeholder="今天做了什么？"
              />
            </el-form-item>
            <el-form-item label="开始时间" v-if="props.mode !== 'diary'">
              <TimePickerPopover v-model="form.startTime" :offset-minutes="0" />
            </el-form-item>
            <el-form-item label="结束时间" v-if="props.mode !== 'diary'">
              <TimePickerPopover v-model="form.endTime" :offset-minutes="60" />
            </el-form-item>
            <el-form-item label="备注" prop="notes">
              <el-input
                  v-model="form.notes"
                  type="textarea"
                  :rows="3"
                  placeholder="添加备注"
              />
            </el-form-item>
          </el-form>
          <div class="form-footer">
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
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import dayjs from 'dayjs'
import { useTaskStore, type Task } from '../../stores/taskStore'
import TimePickerPopover from '../common/picker/TimePickerPopover.vue'

const props = defineProps<{
  visible: boolean
  task?: Task | null
  defaultDate?: string
  mode?: 'record' | 'diary'
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
  if (isEdit.value) return props.mode === 'diary' ? '编辑日记' : '编辑记录'
  return props.mode === 'diary' ? '添加日记' : '添加足迹'
})

const getDefaultTimes = () => {
  const now = new Date()
  const later = new Date(now.getTime() + 60 * 60 * 1000)
  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return { startTime: fmt(now), endTime: fmt(later) }
}

const form = reactive({
  name: '',
  date: dayjs().format('YYYY-MM-DD'),
  startTime: getDefaultTimes().startTime,
  endTime: getDefaultTimes().endTime,
  notes: ''
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
  } else if (val) {
    isEdit.value = false
    form.name = ''
    form.date = props.defaultDate || dayjs().format('YYYY-MM-DD')
    const defaults = getDefaultTimes()
    form.startTime = defaults.startTime
    form.endTime = defaults.endTime
    form.notes = ''
  } else {
    isEdit.value = false
  }
})

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  form.name = ''
  form.date = dayjs().format('YYYY-MM-DD')
  const defaults = getDefaultTimes()
  form.startTime = defaults.startTime
  form.endTime = defaults.endTime
  form.notes = ''
  isEdit.value = false
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  const isDiaryMode = props.mode === 'diary'

  if (!isDiaryMode) {
    if (form.startTime && !form.endTime) {
      ElMessage.warning('填写了开始时间则必须填写结束时间')
      return
    }

    if (form.startTime && form.endTime && form.startTime >= form.endTime) {
      ElMessage.warning('结束时间必须大于开始时间')
      return
    }
  }

  const now = new Date()
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const isDiary = isDiaryMode || (!form.startTime && !form.endTime)

  const newTask: any = {
    name: form.name,
    date: form.date,
    startTime: isDiary ? nowTime : form.startTime,
    endTime: isDiary ? nowTime : form.endTime,
    notes: form.notes,
    category: isDiary ? 'diary' : 'activity',
    isDiary: isDiary,
    createdAt: new Date().toISOString(),
  }

  try {
    if (isEdit.value && props.task) {
      await taskStore.updateTask(props.task.id, {
        ...props.task,
        ...newTask,
        updatedAt: new Date().toISOString(),
      })
      ElMessage.success(props.mode === 'diary' ? '日记已更新' : '记录已更新')
    } else {
      await taskStore.addTask(newTask)
      ElMessage.success(props.mode === 'diary' ? '日记已添加' : '记录已添加')
    }
    dialogVisible.value = false
    emit('submit')
  } catch (e: any) {
    console.error('[TaskForm] 保存失败', e.message)
    ElMessage.error('保存失败，请重试')
  }
}
</script>

<style scoped>
.dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.dialog-container { background: rgba(30, 28, 52, 0.98); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); max-width: 90vw; }
.task-form-dialog { width: 300px; }
.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 0; flex-shrink: 0; }
.dialog-header-title { font-size: 16px; font-weight: 600; color: var(--chalk-white); }
.folder-dialog-header { justify-content: center; }
.folder-dialog-title { text-align: center; }
.dialog-body { padding: 12px 16px 16px; }

.form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08); }

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
  border-radius: 16px;
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
:deep(.el-form-item__label) { color: var(--chalk-white-70); width: 80px !important; }
:deep(.el-input__wrapper),
:deep(.el-textarea__inner) { background: rgba(255, 255, 255, 0.05) !important; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: none !important; }
:deep(.el-input__wrapper:hover),
:deep(.el-textarea__inner:hover) { border-color: rgba(102, 126, 234, 0.5); }
:deep(.el-input__inner),
:deep(.el-textarea__inner) { color: var(--chalk-white-90) !important; }
:deep(.el-input__inner::placeholder),
:deep(.el-textarea__inner::placeholder) { color: var(--chalk-subtle); }
:deep(.el-autocomplete) { width: 100%; }
:deep(.el-input__count),
:deep(.el-input__count-inner) { background: transparent !important; color: var(--chalk-subtle) !important; }
</style>