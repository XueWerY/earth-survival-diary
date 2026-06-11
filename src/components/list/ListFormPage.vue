<template>
  <div class="list-form">
    <el-input v-model="formName" placeholder="请输入清单名称" @keyup.enter="handleSubmit" />
    <div class="list-color-section">
      <span class="list-color-label">颜色</span>
      <div class="list-color-grid">
        <div
          v-for="c in EXTENDED_FOLDER_COLORS"
          :key="c"
          class="list-color-swatch"
          :class="{ selected: formColor === c }"
          :style="{ background: c }"
          @click="formColor = c"
        ></div>
      </div>
      <div class="list-color-custom">
        <span class="list-color-label">自定义</span>
        <el-input v-model="formColor" placeholder="#667eea" size="small" class="list-color-input" />
      </div>
    </div>
    <div class="list-form-footer">
      <el-button @click="cancel">取消</el-button>
      <el-button type="primary" @click="handleSubmit">保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { EXTENDED_FOLDER_COLORS, type ListPage } from '../../stores/listStore'

const props = defineProps<{
  list?: ListPage | null
}>()

const emit = defineEmits<{
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'cancel'): void
}>()

const isEdit = false

const formName = ref('')
const formColor = ref(EXTENDED_FOLDER_COLORS[0])

watch(() => props.list, (newList) => {
  if (newList) {
    formName.value = newList.name
    formColor.value = newList.color
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
.list-form { display: flex; flex-direction: column; gap: 16px; }
.list-form :deep(.el-input__wrapper) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
.list-form :deep(.el-input__inner) { color: #fff; }
.list-form :deep(.el-input__inner::placeholder) { color: rgba(255, 255, 255, 0.4); }

.list-color-section { display: flex; flex-direction: column; gap: 8px; }
.list-color-label { font-size: 13px; color: var(--chalk-dim); }
.list-color-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
.list-color-swatch { width: 100%; aspect-ratio: 1; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; box-sizing: border-box; }
.list-color-swatch:hover { transform: scale(1.15); }
.list-color-swatch.selected { border-color: #fff; transform: scale(1.15); box-shadow: 0 0 8px rgba(255, 255, 255, 0.3); }
.list-color-custom { display: flex; align-items: center; gap: 10px; }
.list-color-input { width: 140px; }

.list-form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 8px; }
</style>