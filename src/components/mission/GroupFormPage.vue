<template>
  <div class="group-form">
    <el-input v-model="formName" placeholder="请输入分组名称" @keyup.enter="handleSubmit" />
    <div class="group-color-section">
      <span class="group-color-label">颜色</span>
      <div class="group-color-grid">
        <div
          v-for="c in EXTENDED_FOLDER_COLORS"
          :key="c"
          class="group-color-swatch"
          :class="{ selected: formColor === c }"
          :style="{ background: c }"
          @click="formColor = c"
        ></div>
      </div>
      <div class="group-color-custom">
        <span class="group-color-label">自定义</span>
        <el-input v-model="formColor" placeholder="#667eea" size="small" class="group-color-input" />
      </div>
    </div>
    <div class="group-form-footer">
      <el-button @click="cancel">取消</el-button>
      <el-button type="primary" @click="handleSubmit">保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { EXTENDED_FOLDER_COLORS, type MissionGroup } from '../../stores/missionStore'

const props = defineProps<{
  group?: MissionGroup | null
  listId?: string
}>()

const emit = defineEmits<{
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'cancel'): void
}>()

const formName = ref('')
const formColor = ref(EXTENDED_FOLDER_COLORS[0])

watch(() => props.group, (newGroup) => {
  if (newGroup) {
    formName.value = newGroup.name
    formColor.value = newGroup.color
  }
}, { immediate: true })

const handleSubmit = () => {
  const name = formName.value.trim()
  if (!name) return
  const color = formColor.value.trim() || EXTENDED_FOLDER_COLORS[0]
  emit('submit', { name, color })
}

const cancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.group-form { display: flex; flex-direction: column; gap: 16px; }
.group-form :deep(.el-input__wrapper) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
.group-form :deep(.el-input__inner) { color: #fff; }
.group-form :deep(.el-input__inner::placeholder) { color: rgba(255, 255, 255, 0.4); }

.group-color-section { display: flex; flex-direction: column; gap: 8px; }
.group-color-label { font-size: 13px; color: var(--chalk-dim); }
.group-color-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
.group-color-swatch { width: 100%; aspect-ratio: 1; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; box-sizing: border-box; }
.group-color-swatch:hover { transform: scale(1.15); }
.group-color-swatch.selected { border-color: #fff; transform: scale(1.15); box-shadow: 0 0 8px rgba(255, 255, 255, 0.3); }
.group-color-custom { display: flex; align-items: center; gap: 10px; }
.group-color-input { width: 140px; }

.group-form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 8px; }
</style>