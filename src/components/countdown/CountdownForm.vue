<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="dialog-overlay" @click.self="dialogVisible = false">
      <div class="dialog-container countdown-form-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">{{ reminderOnly ? '编辑提醒策略' : (isEdit ? '编辑倒数日' : '添加倒数日') }}</span>
        </div>
        <div class="dialog-body">
          <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
            <template v-if="!reminderOnly">
              <el-form-item label="名称" prop="name">
                <el-input v-model="form.name" placeholder="这个倒数日叫什么？" maxlength="50" />
              </el-form-item>
              <el-form-item label="类型" prop="countMode">
                <el-radio-group v-model="form.countMode" class="count-mode-group">
                  <el-radio value="countdown">倒数日</el-radio>
                  <el-radio value="countup">正数日</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item :label="form.countMode === 'countup' ? '起始日期' : '目标日期'" prop="targetDate">
                <DateScrollPicker v-model="form.targetDate" style="width: 130px" />
              </el-form-item>
              <el-form-item label="分类" prop="category">
                <el-select v-model="form.category" placeholder="选择分类" style="width: 90px">
                  <el-option
                      v-for="cat in categories"
                      :key="cat.value"
                      :label="cat.label"
                      :value="cat.value"
                  >
                    <span class="category-option">
                      <span class="category-icon">{{ cat.icon }}</span>
                      <span class="category-label">{{ cat.label }}</span>
                    </span>
                  </el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="描述">
                <el-input
                    v-model="form.description"
                    type="textarea"
                    :rows="2"
                    placeholder="添加备注（可选）"
                />
              </el-form-item>
            </template>
            <el-form-item label="提醒" v-if="form.countMode !== 'countup'">
              <div class="reminder-area">
                <el-radio-group v-model="reminderEnabled">
                  <el-radio :value="true">提醒</el-radio>
                  <el-radio :value="false">不提醒</el-radio>
                </el-radio-group>
                <div v-if="reminderEnabled" class="reminder-picker-row">
                  <ReminderTimePicker v-model="reminderTime" style="width: 170px" />
                </div>
              </div>
            </el-form-item>
            <el-form-item label="重复" v-if="form.countMode !== 'countup' && !reminderOnly">
              <el-radio-group v-model="form.repeatStrategy">
                <el-radio value="none">不重复</el-radio>
                <el-radio value="yearly">重复</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>
          <div class="form-footer">
            <button class="capsule-btn cancel-btn" @click="dialogVisible = false">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <span>取消</span>
            </button>
            <button class="capsule-btn submit-btn" @click="handleSubmit">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
              <span>{{ isEdit ? '保存' : '添加' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import dayjs from 'dayjs'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'
import ReminderTimePicker from '../common/picker/ReminderTimePicker.vue'

interface Milestone {
  id: string
  name: string
  targetDate: string
  category: string
  description: string
  countMode?: 'countdown' | 'countup'
  pinned: boolean
  createdAt: string
  updatedAt: string
  reminderStrategy?: string
  reminderDays?: number
  reminderHours?: number
  reminderMinutes?: number
  repeatStrategy?: string
}

interface Category {
  value: string
  label: string
  icon: string
  color: string
}

const props = defineProps<{
  visible: boolean
  milestone: Milestone | null
  categories: Category[]
  defaultCategory?: string
  reminderOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', data: Partial<Milestone>): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const formRef = ref<FormInstance>()

const isEdit = computed(() => !!props.milestone)

const reminderEnabled = ref(false)

const form = ref({
  name: '',
  targetDate: dayjs().format('YYYY-MM-DD'),
  category: 'life',
  description: '',
  countMode: 'countdown' as 'countdown' | 'countup',
  reminderStrategy: 'none' as string,
  reminderDays: 0,
  reminderHours: 0,
  reminderMinutes: 0,
  repeatStrategy: 'none' as string
})

const reminderTime = computed({
  get: () => ({ days: form.value.reminderDays, hours: form.value.reminderHours, minutes: form.value.reminderMinutes }),
  set: (v) => { form.value.reminderDays = v.days; form.value.reminderHours = v.hours; form.value.reminderMinutes = v.minutes }
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入倒数日名称', trigger: 'blur' },
    { min: 1, max: 50, message: '名称长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  targetDate: [
    { required: true, message: '请选择日期', trigger: 'change' }
  ],
  category: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ]
}

watch(() => props.milestone, (newVal) => {
  if (newVal) {
    form.value = {
      name: newVal.name,
      targetDate: newVal.targetDate,
      category: newVal.category,
      description: newVal.description,
      countMode: newVal.countMode === 'countup' ? 'countup' : 'countdown',
      reminderStrategy: newVal.reminderStrategy || 'none',
      reminderDays: newVal.reminderDays || 0,
      reminderHours: newVal.reminderHours || 0,
      reminderMinutes: newVal.reminderMinutes || 0,
      repeatStrategy: newVal.repeatStrategy || 'none'
    }
    reminderEnabled.value = newVal.reminderStrategy === 'on_time' || newVal.reminderStrategy === 'advance'
  } else {
    form.value.targetDate = dayjs().format('YYYY-MM-DD')
    form.value.countMode = 'countdown'
    form.value.repeatStrategy = 'none'
    form.value.reminderStrategy = 'none'
    reminderEnabled.value = false
  }
}, { immediate: true })

watch(() => props.defaultCategory, (newVal) => {
  if (newVal && !props.milestone) {
    form.value.category = newVal
  }
}, { immediate: true })

const resetForm = () => {
  formRef.value?.resetFields()
  form.value = {
    name: '',
    targetDate: dayjs().format('YYYY-MM-DD'),
    category: props.defaultCategory || 'life',
    description: '',
    countMode: 'countdown',
    reminderStrategy: 'none',
    reminderDays: 0,
    reminderHours: 0,
    reminderMinutes: 0,
    repeatStrategy: 'none'
  }
  reminderEnabled.value = false
}

const handleSubmit = async () => {
  if (!formRef.value) return

  if (!props.reminderOnly) {
    try {
      await formRef.value.validate()
    } catch {
      return
    }
  }

  if (props.reminderOnly) {
    const data: Partial<Milestone> = {}
    if (!reminderEnabled.value) {
      data.reminderStrategy = 'none'
    } else if (form.value.reminderDays === 0 && form.value.reminderHours === 0 && form.value.reminderMinutes === 0) {
      data.reminderStrategy = 'on_time'
    } else {
      data.reminderStrategy = 'advance'
      data.reminderDays = form.value.reminderDays
      data.reminderHours = form.value.reminderHours
      data.reminderMinutes = form.value.reminderMinutes
    }
    emit('submit', data)
    resetForm()
    return
  }

  const data: Partial<Milestone> = { ...form.value }
  if (data.countMode !== 'countup') {
    if (!reminderEnabled.value) {
      data.reminderStrategy = 'none'
    } else if (data.reminderDays === 0 && data.reminderHours === 0 && data.reminderMinutes === 0) {
      data.reminderStrategy = 'on_time'
    } else {
      data.reminderStrategy = 'advance'
    }
  }
  emit('submit', data)
  resetForm()
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog-container {
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: 90vw;
}

.countdown-form-dialog {
  width: 300px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.dialog-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
}

.folder-dialog-header {
  justify-content: center;
}

.folder-dialog-title {
  text-align: center;
}

.dialog-body {
  padding: 12px 16px 16px;
}

.count-mode-group {
  width: 100%;
}

.reminder-area {
  width: 100%;
}

.reminder-picker-row {
  margin-top: 8px;
}

.category-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-icon {
  font-size: 16px;
}

.form-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.capsule-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: transparent;
  color: var(--chalk-white-70);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
}

.capsule-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.capsule-btn .capsule-icon {
  width: 14px;
  height: 14px;
}

.submit-btn {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.4);
  color: #93c5fd;
}

.submit-btn:hover {
  background: rgba(102, 126, 234, 0.35);
  color: var(--chalk-white);
}

:deep(.el-form-item) {
  margin-bottom: 12px;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  color: var(--chalk-white-70);
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
  color: var(--chalk-white-90) !important;
}

:deep(.el-input__inner::placeholder),
:deep(.el-textarea__inner::placeholder) {
  color: var(--chalk-subtle);
}

:deep(.el-input__count),
:deep(.el-input__count-inner) {
  background: transparent !important;
  color: var(--chalk-subtle) !important;
}

:deep(.date-trigger) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.el-radio) {
  margin-right: 12px;
}

:deep(.el-radio__label) {
  color: var(--chalk-white-70);
}
</style>