<template>
  <div class="color-section">
    <div class="color-grid">
      <div v-for="c in colorList" :key="c" class="color-swatch" :class="{ selected: modelValue === c }" :style="{ background: c }" @click="$emit('update:modelValue', c)"></div>
    </div>
    <div class="color-custom">
      <span class="color-custom-label">自定义</span>
      <el-input :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" placeholder="#667eea" size="small" class="color-custom-input" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  colors?: string[]
}>(), {
  colors: () => [
    '#667eea', '#764ba2', '#f093fb', '#d53a9d', '#4facfe', '#00b4db', '#43e97b', '#11998e',
    '#fa709a', '#ee5a24', '#fee140', '#f6d365', '#a8edea', '#a18cd1', '#d299c2', '#fbc2eb',
    '#ff6b6b', '#4ecdc4', '#26d0ce', '#45b7d1', '#2b32b2', '#96ceb4', '#e1eec3', '#fc4a1a',
    '#f7b733', '#00b09b', '#96c93d', '#834d9b', '#d04ed6', '#2c3e50', '#3498db', '#e74c3c',
    '#f39c12', '#1abc9c', '#9b59b6', '#e67e22', '#2ecc71', '#e91e63', '#00bcd4', '#8e44ad',
  ]
})

defineEmits<{
  'update:modelValue': [value: string]
}>()

const colorList = computed(() => props.colors)
</script>

<style scoped>
.color-section { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.color-grid { display: grid; grid-template-columns: repeat(10, minmax(28px, 1fr)); gap: 4px; }
.color-swatch { width: 100%; aspect-ratio: 1; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; box-sizing: border-box; }
.color-swatch:hover { transform: scale(1.15); }
.color-swatch.selected { border-color: #fff; transform: scale(1.15); box-shadow: 0 0 8px rgba(255,255,255,0.3); }
.color-custom { display: flex; flex-direction: column; gap: 4px; }
.color-custom-label { font-size: 13px; color: var(--chalk-dim); }
.color-custom-input { width: 100%; }
</style>
