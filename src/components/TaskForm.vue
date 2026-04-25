<template>
  <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑记录' : '添加足迹'"
      width="500px"
      @close="resetForm"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
      <el-form-item label="事件名称" prop="name">
        <el-autocomplete
            v-model="form.name"
            :fetch-suggestions="querySearch"
            placeholder="今天做了什么？"
            clearable
            style="width: 100%"
            @select="handleNameSelect"
        />
      </el-form-item>
      <el-form-item label="日期" prop="date">
        <LunarDatePicker
            v-model="form.date"
            placeholder="选择日期"
            full-width
        />
      </el-form-item>
      <el-form-item label="开始时间" prop="startTime">
        <el-time-picker
          v-model="form.startTime"
          placeholder="开始时间"
          format="HH:mm"
          value-format="HH:mm"
          clearable
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="结束时间" prop="endTime">
        <el-time-picker
          v-model="form.endTime"
          placeholder="结束时间"
          format="HH:mm"
          value-format="HH:mm"
          clearable
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="备注" prop="notes">
        <el-input
            v-model="form.notes"
            type="textarea"
            :rows="2"
            placeholder="添加备注（可选）"
            maxlength="200"
            show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ isEdit ? '更新' : '添加' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import dayjs from 'dayjs'
import { useTaskStore, type Task } from '../stores/taskStore'
import LunarDatePicker from './LunarDatePicker.vue'

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

// 历史事件名称（用于自动补全）
const historyNames = computed(() => taskStore.historyNames)

// 自动补全查询函数
const querySearch = (queryString: string, cb: (results: { value: string }[]) => void) => {
  const results = queryString
      ? historyNames.value
          .filter((name: string) => name.toLowerCase().includes(queryString.toLowerCase()))
          .map((name: string) => ({ value: name }))
      : historyNames.value.map((name: string) => ({ value: name }))
  cb(results)
}

// 选择历史记录后触发表单验证
const handleNameSelect = (item: { value: string }) => {
  form.name = item.value
  if (formRef.value) {
    formRef.value.validateField('name')
  }
}

const dialogVisible = ref(false)
const isEdit = ref(false)

const form = reactive({
  name: '',
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '',
  endTime: '',
  notes: ''
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入事件名称', trigger: 'blur' },
    { min: 1, max: 100, message: '事件名称长度在 1 到 100 个字符', trigger: 'blur' }
  ],
  date: [
    { required: true, message: '请选择日期', trigger: 'change' }
  ],
  startTime: [
    { required: true, message: '请选择开始时间', trigger: 'change' }
  ],
  endTime: [
    { required: true, message: '请选择结束时间', trigger: 'change' }
  ]
}

watch(() => props.visible, (val) => {
  dialogVisible.value = val
  if (val && props.task) {
    isEdit.value = true
    form.name = props.task.name
    form.date = props.task.date
    form.startTime = props.task.startTime
    form.endTime = props.task.endTime
    form.notes = props.task.notes || ''
  } else {
    isEdit.value = false
    form.date = props.defaultDate || dayjs().format('YYYY-MM-DD')
  }
})

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  form.name = ''
  form.date = dayjs().format('YYYY-MM-DD')
  form.startTime = ''
  form.endTime = ''
  form.notes = ''
  isEdit.value = false
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (valid) {
      if (isEdit.value && props.task) {
        taskStore.updateTask(props.task.id, {
          name: form.name,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          notes: form.notes
        })
        ElMessage.success('记录更新成功')
      } else {
        taskStore.addTask({
          name: form.name,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          notes: form.notes
        })
        ElMessage.success('记录添加成功')
      }
      dialogVisible.value = false
      emit('submit')
    }
  })
}
</script>

<style scoped>
.date-input-group {
  display: flex;
  align-items: center;
  width: 100%;
}

.date-input {
  width: 70px;
}

.date-input.small {
  width: 50px;
}

.date-sep {
  margin: 0 4px;
  color: rgba(255, 255, 255, 0.5);
}

/* 对话框内的表单样式 */
:deep(.el-dialog) {
  background: rgba(30, 30, 50, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 20px;
}

:deep(.el-dialog__title) {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}

:deep(.el-dialog__headerbtn .el-dialog__close) {
  color: rgba(255, 255, 255, 0.5);
}

:deep(.el-dialog__headerbtn:hover .el-dialog__close) {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.el-dialog__body) {
  padding: 20px;
  color: rgba(255, 255, 255, 0.85);
}

:deep(.el-dialog__footer) {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px 20px;
}

/* 表单项样式 */
:deep(.el-form-item__label) {
  color: rgba(255, 255, 255, 0.7);
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner) {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none !important;
}

:deep(.el-input__wrapper:hover),
:deep(.el-textarea__inner:hover) {
  border-color: rgba(102, 126, 234, 0.5);
}

:deep(.el-input__inner),
:deep(.el-textarea__inner) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.el-input__inner::placeholder),
:deep(.el-textarea__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}


:deep(.el-time-editor .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.el-time-editor .el-input__inner) {
  color: rgba(255, 255, 255, 0.9) !important;
}

/* 自动补全样式 */
:deep(.el-autocomplete) {
  width: 100%;
}

:deep(.el-autocomplete .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.el-autocomplete .el-input__inner) {
  color: rgba(255, 255, 255, 0.9) !important;
}

/* 字数统计样式 */
:deep(.el-input__count),
:deep(.el-input__count-inner) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.4) !important;
}

/* 按钮样式 */
:deep(.el-button) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}

:deep(.el-button:hover) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

:deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: #fff;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  border-color: #764ba2;
}

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

</style>
