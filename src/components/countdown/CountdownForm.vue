<template>
  <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑倒数日' : '添加倒数日'"
      width="500px"
      class="countdown-form-dialog"
      @close="resetForm"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
      <!-- 倒数日名称 -->
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="这个倒数日叫什么？" maxlength="50" show-word-limit />
      </el-form-item>

      <!-- 类型：倒数 / 正数 -->
      <el-form-item label="类型" prop="countMode">
        <el-radio-group v-model="form.countMode" class="count-mode-group">
          <el-radio value="countdown">倒数日</el-radio>
          <el-radio value="countup">正数日</el-radio>
        </el-radio-group>
        <p class="count-mode-hint">
          倒数日：距离目标日期还有多久；正数日：从所选日期起已过去多少天。
        </p>
      </el-form-item>

      <!-- 目标日期 -->
      <el-form-item :label="form.countMode === 'countup' ? '起始日期' : '目标日期'" prop="targetDate">
        <LunarDatePicker
            v-model="form.targetDate"
            :placeholder="form.countMode === 'countup' ? '选择起始日期' : '选择目标日期'"
            full-width
        />
      </el-form-item>

      <!-- 分类 -->
      <el-form-item label="分类" prop="category">
        <el-select v-model="form.category" placeholder="选择分类" style="width: 100%">
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

      <!-- 描述 -->
      <el-form-item label="描述">
        <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="添加一些备注（可选）"
            maxlength="200"
            show-word-limit
        />
      </el-form-item>

      <!-- 提醒 -->
      <el-form-item label="提醒" v-if="form.countMode !== 'countup'">
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
import type { FormInstance } from 'element-plus'
import dayjs from 'dayjs'
import LunarDatePicker from '../common/picker/LunarDatePicker.vue'
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

const form = ref({
  name: '',
  targetDate: dayjs().format('YYYY-MM-DD'),
  category: 'life',
  description: '',
  countMode: 'countdown' as 'countdown' | 'countup',
  reminderStrategy: 'none' as string,
  reminderDays: 0,
  reminderHours: 0,
  reminderMinutes: 0
})

const reminderTime = computed({
  get: () => ({ days: form.value.reminderDays, hours: form.value.reminderHours, minutes: form.value.reminderMinutes }),
  set: (v) => { form.value.reminderDays = v.days; form.value.reminderHours = v.hours; form.value.reminderMinutes = v.minutes }
})

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入倒数日名称', trigger: 'blur' },
    { min: 1, max: 50, message: '名称长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  targetDate: [
    { required: true, message: '请选择目标日期', trigger: 'change' }
  ],
  category: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ]
}

// 监听 milestone 变化，填充表单
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
      reminderMinutes: newVal.reminderMinutes || 0
    }
  } else {
    form.value.targetDate = dayjs().format('YYYY-MM-DD')
    form.value.countMode = 'countdown'
  }
}, { immediate: true })

// 监听 defaultCategory 变化
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
    countMode: 'countdown'
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (valid) {
      emit('submit', { ...form.value })
      resetForm()
    }
  })
}
</script>

<style scoped>
.category-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-icon {
  font-size: 16px;
}

.category-label {
  flex: 1;
}

.count-mode-group {
  width: 100%;
}

.count-mode-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--chalk-dim);
}

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
  color: var(--chalk-subtle);
}

/* 对话框深色主题 */
:deep(.el-dialog) {
  background: rgba(30, 30, 50, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

:deep(.el-dialog__title) {
  color: var(--chalk-white-95) !important;
}

:deep(.el-dialog__headerbtn .el-dialog__close) {
  color: var(--chalk-muted) !important;
}

:deep(.el-dialog__headerbtn:hover .el-dialog__close) {
  color: var(--chalk-white-90) !important;
}

:deep(.el-form-item__label) {
  color: var(--chalk-white-70) !important;
}

.reminder-row { display: flex; align-items: center; gap: 8px; width: 100%; }
.reminder-row .reminder-label { color: var(--chalk-white-60); white-space: nowrap; font-size: 13px; }

:deep(.el-input__count),
:deep(.el-input__count-inner) {
  background: transparent !important;
  color: var(--chalk-subtle) !important;
}
</style>

<style>
.countdown-form-dialog .el-dialog {
  width: 500px;
  margin-left: auto;
  margin-right: auto;
}

@media (max-width: 500px) {
  .countdown-form-dialog .el-dialog {
    width: 100vw;
    margin-left: 0;
    margin-right: 0;
  }
}
</style>
