<template>
  <BaseDialog
    :visible="dialogVisible"
    :title="dialogTitle"
    teleport
    fullscreen
    @update:visible="dialogVisible = $event"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
      <el-form-item label="名称" prop="name">
        <el-input
            v-model="form.name"
            type="textarea"
            :rows="2"
            placeholder="给日记起个名字"
        />
      </el-form-item>
      <el-form-item label="内容" class="content-editor-form-item">
        <MarkdownEditor
            v-model="form.content"
            placeholder="记录今天的心情和故事"
        />
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
import MarkdownEditor from '../common/MarkdownEditor.vue'
import BaseDialog from '../common/BaseDialog.vue'

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
  return isEdit.value ? '编辑日记' : '写日记'
})

const nowTime = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

const form = reactive({
  name: '',
  date: dayjs().format('YYYY-MM-DD'),
  notes: '',
  content: ''
})

const rules = reactive<FormRules>({
  name: [{ required: true, message: '请输入日记名称', trigger: 'blur' }]
})

watch(() => props.visible, (val) => {
  if (val && props.task) {
    isEdit.value = true
    form.name = props.task.name
    form.date = props.task.date
    form.notes = props.task.notes || ''
    form.content = (props.task as any).content || ''
  } else if (val) {
    isEdit.value = false
    form.name = ''
    form.date = props.defaultDate || dayjs().format('YYYY-MM-DD')
    form.notes = ''
    form.content = ''
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

  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const newTask: any = {
    name: form.name,
    date: form.date,
    startTime: timeStr,
    endTime: timeStr,
    notes: form.notes,
    content: form.content,
    category: 'diary',
    isDiary: true,
    createdAt: new Date().toISOString(),
  }

  try {
    if (isEdit.value && props.task) {
      await taskStore.updateTask(props.task.id, {
        ...newTask,
        updatedAt: new Date().toISOString(),
      })
      ElMessage.success('日记已更新')
    } else {
      await taskStore.addTask(newTask)
      ElMessage.success('日记已添加')
    }
    dialogVisible.value = false
    emit('submit')
  } catch (e: any) {
    console.error('[DiaryForm] Save failed', e.message)
    ElMessage.error('保存失败，请重试')
  }
}
</script>

<style scoped>
:deep(.dialog-body) { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

:deep(.el-form) { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.content-editor-form-item { flex: 1; min-height: 0; }
.content-editor-form-item :deep(.el-form-item__content) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.content-editor-form-item :deep(.md-editor) { width: 100%; }
.content-editor-form-item :deep(.md-block) { padding-left: 0; }
.content-editor-form-item :deep(.md-block-preview) { padding-left: 11px; padding-right: 11px; }

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
:deep(.el-form-item__label) { color: var(--chalk-white-70); }
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
