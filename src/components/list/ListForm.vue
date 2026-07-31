<template>
  <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑清单' : '创建清单'"
      :width="dialogWidth"
      @close="resetForm"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="70px">
      <!-- 清单名称 -->
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="清单名称" />
      </el-form-item>

      <!-- 清单颜色 -->
      <el-form-item label="颜色">
        <ColorGrid v-model="form.color" :colors="DEFAULT_LIST_COLORS" />
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
import { useListStore, DEFAULT_LIST_COLORS, type ListPage } from '../../stores/listStore'
import ColorGrid from '../common/ColorGrid.vue'

const props = defineProps<{
  visible: boolean
  list?: ListPage | null
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

const isEdit = computed(() => !!props.list)

interface FormData {
  name: string
  color: string
}

const getDefaultForm = (): FormData => {
  return { name: '', color: DEFAULT_LIST_COLORS[0] }
}

const form = ref<FormData>(getDefaultForm())

const rules: FormRules = {
  name: [{ required: true, message: '请输入清单名称', trigger: 'blur' }]
}

// 监听 list 变化，填充表单
watch(() => props.list, (newList) => {
  if (newList) {
    form.value = {
      name: newList.name,
      color: newList.color
    }
  }
}, { immediate: true })

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (valid) {
      if (isEdit.value && props.list) {
        listStore.updateList(props.list.id, form.value)
      } else {
        listStore.addList(form.value.name, form.value.color)
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
