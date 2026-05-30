<template>
  <div class="tool-container">
    <div class="tool-header">
      <h3 class="tool-title">📝 字符计数器</h3>
      <p class="tool-desc">统计文本中的字符数、词数和行数</p>
    </div>
    <div class="tool-body">
      <el-input
        v-model="text"
        type="textarea"
        :rows="8"
        placeholder="在此输入或粘贴文本..."
        resize="none"
      />
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-label">字符数</span>
          <span class="stat-value">{{ charCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">词数</span>
          <span class="stat-value">{{ wordCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">行数</span>
          <span class="stat-value">{{ lineCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">字节数</span>
          <span class="stat-value">{{ byteCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const text = ref('')

const charCount = computed(() => text.value.length)

const wordCount = computed(() => {
  const trimmed = text.value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
})

const lineCount = computed(() => {
  const trimmed = text.value.trim()
  return trimmed ? trimmed.split('\n').length : 0
})

const byteCount = computed(() => new TextEncoder().encode(text.value).length)
</script>

<style scoped>
.tool-container {
  padding: 20px;
}

.tool-header {
  margin-bottom: 16px;
}

.tool-title {
  color: var(--chalk-white);
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.tool-desc {
  color: var(--chalk-white-60);
  font-size: 13px;
  margin: 0;
}

.stats-row {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.stat-item {
  flex: 1;
  min-width: 100px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.stat-label {
  display: block;
  color: var(--chalk-white-60);
  font-size: 12px;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  color: var(--chalk-primary);
  font-size: 20px;
  font-weight: 600;
}
</style>