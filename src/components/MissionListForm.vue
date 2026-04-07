<template>
  <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑清单' : '创建清单'"
      width="400px"
      @close="resetForm"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="70px">
      <!-- 清单名称 -->
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="清单名称" />
      </el-form-item>

      <!-- 清单颜色 -->
      <el-form-item label="颜色">
        <div class="color-picker">
          <div
              v-for="color in availableColors"
              :key="color"
              class="color-item"
              :class="{ active: form.color === color, used: usedColors.includes(color) && form.color !== color }"
              :style="{ background: color }"
              @click="usedColors.includes(color) && form.color !== color ? null : (form.color = color)"
          >
            <span v-if="usedColors.includes(color) && form.color !== color" class="used-mark">✓</span>
          </div>
        </div>
        <div class="color-tip">灰色标记的颜色已被其他清单使用，不可选择</div>
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
import { ref, computed, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useMissionStore, DEFAULT_LIST_COLORS, type MissionList } from '../stores/missionStore'

const props = defineProps<{
  visible: boolean
  list?: MissionList | null
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

const formRef = ref<FormInstance>()

const isEdit = computed(() => !!props.list)

// 已使用的颜色
const usedColors = computed(() => {
  const colors = new Set<string>()
  missionStore.lists.forEach(list => {
    // 编辑时排除当前清单的颜色
    if (!props.list || list.id !== props.list.id) {
      colors.add(list.color)
    }
  })
  return Array.from(colors)
})

// 所有颜色都可选，但已使用的会标记
const availableColors = computed(() => DEFAULT_LIST_COLORS)

interface FormData {
  name: string
  color: string
}

const getDefaultForm = (): FormData => {
  // 找到第一个未被使用的颜色
  const unusedColor = DEFAULT_LIST_COLORS.find(c => !usedColors.value.includes(c)) || DEFAULT_LIST_COLORS[0]
  return {
    name: '',
    color: unusedColor
  }
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
        missionStore.updateList(props.list.id, form.value)
      } else {
        missionStore.addList(form.value.name, form.value.color)
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
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
  color: #fff;
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
