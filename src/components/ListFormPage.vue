<template>
  <div class="list-form-page">
    <div class="form-page-body">
      <div class="list-form-container">
        <div class="form-title">{{ isEdit ? '编辑清单' : '创建清单' }}</div>
        <el-form :model="form" :rules="rules" ref="formRef" label-width="70px" class="form-body">
          <el-form-item label="名称" prop="name">
            <el-input v-model="form.name" placeholder="清单名称" />
          </el-form-item>

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
          </el-form-item>

          <div class="color-tip">灰色标记的颜色已被其他清单使用，不可选择</div>

          <el-form-item>
            <div class="form-footer">
              <el-button @click="$emit('cancel')">取消</el-button>
              <el-button type="primary" @click="handleSubmit">
                {{ isEdit ? '保存' : '创建' }}
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useMissionStore, DEFAULT_LIST_COLORS, type MissionList } from '../stores/missionStore'

const props = defineProps<{
  list?: MissionList | null
}>()

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'cancel'): void
}>()

const missionStore = useMissionStore()

const formRef = ref<FormInstance>()

const isEdit = computed(() => !!props.list)

const usedColors = computed(() => {
  const colors = new Set<string>()
  missionStore.lists.forEach(list => {
    if (!props.list || list.id !== props.list.id) {
      colors.add(list.color)
    }
  })
  return Array.from(colors)
})

const availableColors = computed(() => DEFAULT_LIST_COLORS)

interface FormData {
  name: string
  color: string
}

const getDefaultForm = (): FormData => {
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

watch(() => props.list, (newList) => {
  if (newList) {
    form.value = {
      name: newList.name,
      color: newList.color
    }
  }
}, { immediate: true })

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
    }
  })
}
</script>

<style scoped>
.list-form-page { display: flex; flex-direction: column; height: 100%; }
.form-page-body { flex: 1; overflow-y: auto; padding: 24px; }
.list-form-container { max-width: 600px; width: 100%; margin: 0 auto; }
.form-title { font-size: 18px; font-weight: 500; color: #fff; margin-bottom: 24px; text-align: center; }

.color-picker { display: flex; flex-wrap: wrap; gap: 8px; }

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

.color-item:hover { transform: scale(1.1); }
.color-item.active { border-color: #667eea; box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3); }
.color-item.used { opacity: 0.5; cursor: not-allowed; }
.color-item.used:hover { opacity: 0.5; transform: none; }

.used-mark { font-size: 12px; color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
.color-tip { margin-top: 8px; font-size: 12px; color: rgba(255, 255, 255, 0.5); padding-left: 70px; }

.form-footer { display: flex; justify-content: flex-end; gap: 12px; width: 100%; }

:deep(.el-input__wrapper) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
:deep(.el-input__inner) { color: #fff; }
:deep(.el-input__inner::placeholder) { color: rgba(255, 255, 255, 0.4); }
:deep(.el-form-item__label) { color: rgba(255, 255, 255, 0.7); }
</style>
