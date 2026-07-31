<template>
  <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑分组' : '创建分组'"
      :width="dialogWidth"
      @close="resetForm"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="70px">
      <!-- 分组名称 -->
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="分组名称" />
      </el-form-item>

      <!-- 分组颜色 -->
      <el-form-item label="颜色">
        <ColorGrid v-model="form.color" :colors="DEFAULT_GROUP_COLORS" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button style="border-radius:8px" @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" style="border-radius:8px" @click="handleSubmit">
        {{ isEdit ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useListStore, DEFAULT_GROUP_COLORS, type TaskGroup } from '../../stores/listStore'
import ColorGrid from '../common/ColorGrid.vue'

const props = defineProps<{
  visible: boolean
  group?: TaskGroup | null
  listId?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit'): void
}>()

const listStore = useListStore()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const screenWidth = ref(window.innerWidth)
const dialogWidth = computed(() => screenWidth.value < 600 ? '100%' : '400px')

const updateScreenWidth = () => { screenWidth.value = window.innerWidth }

onMounted(() => { window.addEventListener('resize', updateScreenWidth) })
onUnmounted(() => { window.removeEventListener('resize', updateScreenWidth) })

const formRef = ref<FormInstance>()

const isEdit = computed(() => !!props.group)

interface FormData {
  name: string
  color: string
}

const getDefaultForm = (): FormData => {
  return { name: '', color: DEFAULT_GROUP_COLORS[0] }
}

const form = ref<FormData>(getDefaultForm())

const rules: FormRules = {
  name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }]
}

// 监听 group 变化，填充表单
watch(() => props.group, (newGroup) => {
  if (newGroup) {
    form.value = {
      name: newGroup.name,
      color: newGroup.color
    }
  } else {
    form.value = getDefaultForm()
  }
}, { immediate: true })

// 监听 listId 变化，确保颜色选择正确
watch(() => props.listId, () => {
  if (!props.group) {
    form.value = getDefaultForm()
  }
})

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (valid) {
      const targetListId = props.listId
      if (!targetListId) return

      if (isEdit.value && props.group) {
        listStore.updateGroupInList(targetListId, props.group.id, form.value)
      } else {
        listStore.addGroupToList(targetListId, form.value.name, form.value.color)
      }

      emit('submit')
      dialogVisible.value = false
    }
  })
}

// 重置表单
const resetForm = () => {
  form.value = getDefaultForm()
  formRef.value?.resetFields()
}
</script>

<style scoped>
:deep(.el-input__wrapper) {
  background: #fff;
  border-color: #dcdfe6;
  box-shadow: none;
}

:deep(.el-input__inner) {
  color: #303133;
}

:deep(.el-input__inner::placeholder) {
  color: #c0c4cc;
}

:deep(.el-form-item__label) {
  color: #606266;
}
</style>
