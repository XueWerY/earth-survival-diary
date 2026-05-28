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
        <div class="color-picker">
          <div
              v-for="color in DEFAULT_GROUP_COLORS"
              :key="color"
              class="color-item"
              :class="{ active: form.color === color, used: usedColors.includes(color) && form.color !== color }"
              :style="{ background: color }"
              @click="usedColors.includes(color) && form.color !== color ? null : (form.color = color)"
          >
            <span v-if="usedColors.includes(color) && form.color !== color" class="used-mark">✓</span>
          </div>
        </div>
        <div class="color-tip">灰色标记的颜色已被其他分组使用，不可选择</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit">
        {{ isEdit ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useMissionStore, DEFAULT_GROUP_COLORS, type MissionGroup } from '../../stores/missionStore'

const props = defineProps<{
  visible: boolean
  group?: MissionGroup | null
  listId?: string
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

const screenWidth = ref(window.innerWidth)
const dialogWidth = computed(() => screenWidth.value < 600 ? '100%' : '400px')

const updateScreenWidth = () => { screenWidth.value = window.innerWidth }

onMounted(() => { window.addEventListener('resize', updateScreenWidth) })
onUnmounted(() => { window.removeEventListener('resize', updateScreenWidth) })

const formRef = ref<FormInstance>()

const isEdit = computed(() => !!props.group)

// 已使用的颜色（同一清单下的分组颜色）
const usedColors = computed(() => {
  const colors = new Set<string>()
  if (!props.listId) return []

  const currentList = missionStore.lists.find(l => l.id === props.listId)
  if (!currentList) return []

  currentList.groups.forEach(group => {
    // 编辑时排除当前分组的颜色
    if (!props.group || group.id !== props.group.id) {
      colors.add(group.color)
    }
  })
  return Array.from(colors)
})

interface FormData {
  name: string
  color: string
}

const getDefaultForm = (): FormData => {
  // 找到第一个未被使用的颜色
  const unusedColor = DEFAULT_GROUP_COLORS.find(c => !usedColors.value.includes(c)) || DEFAULT_GROUP_COLORS[0]
  return {
    name: '',
    color: unusedColor
  }
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
        missionStore.updateGroupInList(targetListId, props.group.id, form.value)
      } else {
        missionStore.addGroupToList(targetListId, form.value.name, form.value.color)
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
.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-item {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.color-item:hover {
  transform: scale(1.1);
}

.color-item.active {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

.color-item.used {
  opacity: 0.5;
  cursor: not-allowed;
}

.color-item.used:hover {
  opacity: 0.5;
  transform: none;
}

.used-mark {
  font-size: 12px;
  color: var(--chalk-white);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.color-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

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
