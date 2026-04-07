<template>
  <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑课程' : '添加课程'"
      width="500px"
      @close="resetForm"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
      <!-- 课程名称 -->
      <el-form-item label="课程名称" prop="name">
        <el-input v-model="form.name" placeholder="输入课程名称" maxlength="30" show-word-limit />
      </el-form-item>

      <!-- 上课时间 -->
      <el-form-item label="上课时间" required>
        <div class="time-row">
          <el-select v-model="form.dayOfWeek" placeholder="选择星期" style="width: 120px">
            <el-option v-for="day in WEEKDAYS" :key="day.value" :label="day.label" :value="day.value" />
          </el-select>
          <el-time-select
              v-model="form.startTime"
              placeholder="开始时间"
              :max-time="form.endTime"
              start="08:00"
              step="00:05"
              end="20:40"
              style="width: 110px"
          />
          <span class="time-separator">至</span>
          <el-time-select
              v-model="form.endTime"
              placeholder="结束时间"
              :min-time="form.startTime"
              start="08:00"
              step="00:05"
              end="20:40"
              style="width: 110px"
          />
        </div>
      </el-form-item>

      <!-- 上课地点 -->
      <el-form-item label="上课地点">
        <el-input v-model="form.location" placeholder="教室/地点（可选）" maxlength="30" />
      </el-form-item>

      <!-- 授课教师 -->
      <el-form-item label="授课教师">
        <el-input v-model="form.teacher" placeholder="教师姓名（可选）" maxlength="20" />
      </el-form-item>

      <!-- 颜色选择 -->
      <el-form-item label="课程颜色">
        <div class="color-picker">
          <div
              v-for="color in COLORS"
              :key="color"
              class="color-option"
              :class="{ active: form.color === color }"
              :style="{ backgroundColor: color }"
              @click="form.color = color"
          />
        </div>
      </el-form-item>

      <!-- 周次设置 -->
      <el-form-item label="上课周次">
        <div class="weeks-setting">
          <el-checkbox v-model="allWeeks">每周都有</el-checkbox>
          <div v-if="!allWeeks" class="week-selector">
            <el-checkbox-group v-model="form.weeks">
              <el-checkbox v-for="w in maxWeeks" :key="w" :value="w">第{{ w }}周</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>
      </el-form-item>

      <!-- 备注 -->
      <el-form-item label="备注">
        <el-input
            v-model="form.note"
            type="textarea"
            :rows="2"
            placeholder="添加备注（可选）"
            maxlength="100"
            show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="isEdit" type="danger" text @click="handleDelete">删除</el-button>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ isEdit ? '保存' : '添加' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { type FormInstance, type FormRules } from 'element-plus'

interface Course {
  id: string
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string
  location: string
  teacher: string
  color: string
  weeks: number[]
  note: string
  createdAt: string
  updatedAt: string
}

const WEEKDAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' }
]

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16'
]

const props = defineProps<{
  visible: boolean
  course: Course | null
  defaultDay?: number // 0=周一, 6=周日
  totalWeeks?: number // 学期总周数
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'submit': [data: Partial<Course>]
  'delete': [courseId: string]
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const isEdit = computed(() => !!props.course)

// 最大周数
const maxWeeks = computed(() => props.totalWeeks || 25)

const formRef = ref<FormInstance>()
const allWeeks = ref(true)

const form = ref({
  name: '',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '09:00',
  location: '',
  teacher: '',
  color: COLORS[0],
  weeks: [] as number[],
  note: ''
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入课程名称', trigger: 'blur' }
  ]
}

// 监听 course 变化，填充表单
watch(() => props.course, (newVal) => {
  if (newVal) {
    form.value = {
      name: newVal.name,
      dayOfWeek: newVal.dayOfWeek,
      startTime: newVal.startTime,
      endTime: newVal.endTime,
      location: newVal.location,
      teacher: newVal.teacher,
      color: newVal.color,
      weeks: [...(newVal.weeks || [])],
      note: newVal.note
    }
    allWeeks.value = !newVal.weeks || newVal.weeks.length === 0
  } else {
    // 新增模式，使用默认值
    // defaultDay: 0=周一, 6=周日 -> dayOfWeek: 1=周一, 0=周日
    const defaultDayOfWeek = props.defaultDay !== undefined
        ? (props.defaultDay === 6 ? 0 : props.defaultDay + 1)
        : 1 // 默认周一

    form.value = {
      name: '',
      dayOfWeek: defaultDayOfWeek,
      startTime: '08:00',
      endTime: '09:00',
      location: '',
      teacher: '',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      weeks: [],
      note: ''
    }
    allWeeks.value = true
  }
}, { immediate: true })

// 监听 allWeeks 变化
watch(allWeeks, (val) => {
  if (val) {
    form.value.weeks = []
  }
})

const resetForm = () => {
  formRef.value?.resetFields()
  allWeeks.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (valid) {
      const data: Partial<Course> = {
        ...form.value,
        weeks: allWeeks.value ? [] : form.value.weeks
      }
      emit('submit', data)
      resetForm()
    }
  })
}

const handleDelete = () => {
  if (props.course?.id) {
    emit('delete', props.course.id)
  }
}
</script>

<style scoped>
.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-separator {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.weeks-setting {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.week-selector {
  max-height: 120px;
  overflow-y: auto;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.week-selector :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.week-selector :deep(.el-checkbox) {
  margin-right: 0;
  min-width: 70px;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  flex: 1;
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
  color: rgba(255, 255, 255, 0.95) !important;
}

:deep(.el-dialog__headerbtn .el-dialog__close) {
  color: rgba(255, 255, 255, 0.5) !important;
}

:deep(.el-dialog__headerbtn:hover .el-dialog__close) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.el-form-item__label) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.el-input__count),
:deep(.el-input__count-inner) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.4) !important;
}

:deep(.el-checkbox__label) {
  color: rgba(255, 255, 255, 0.85) !important;
}
</style>
