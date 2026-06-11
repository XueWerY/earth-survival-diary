<template>
  <div class="tool-container">
    <div class="tool-body">
      <div class="input-row">
        <div class="input-group">
          <label class="input-label">最小值</label>
          <el-input-number v-model="min" :min="0" :max="999999" :step="1" size="default" controls-position="right" />
        </div>
        <div class="input-group">
          <label class="input-label">最大值</label>
          <el-input-number v-model="max" :min="0" :max="999999" :step="1" size="default" controls-position="right" />
        </div>
      </div>

      <div class="center-section">
        <el-button type="primary" size="large" @click="generate" :disabled="max <= min">
          生成随机数
        </el-button>
      </div>

      <div v-if="result !== null" class="result-card">
        <div class="result-label">随机数结果</div>
        <div class="result-value">{{ result }}</div>
      </div>

      <div v-if="history.length > 0" class="history-section">
        <div class="history-title">历史记录</div>
        <div class="history-list">
          <span v-for="(item, idx) in history" :key="idx" class="history-item">
            {{ item }}
          </span>
        </div>
        <div class="history-actions">
          <el-button size="small" text @click="history = []">清空记录</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const min = ref(1)
const max = ref(100)
const result = ref<number | null>(null)
const history = ref<number[]>([])

function generate() {
  if (max.value <= min.value) return
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  const range = max.value - min.value + 1
  const value = (array[0] % range) + min.value
  result.value = value
  if (history.value.length >= 20) {
    history.value.shift()
  }
  history.value.push(value)
}
</script>

<style scoped>
.tool-container {
  padding: 8px 0;
}

.input-row {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.input-label {
  color: var(--chalk-white-60);
  font-size: 12px;
}

@media (max-width: 600px) {
  .input-group {
    flex: 1;
  }
  .input-group :deep(.el-input-number) {
    width: 100%;
  }
}

.center-section {
  text-align: center;
  margin-bottom: 20px;
}

.result-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  margin-bottom: 16px;
  border: 1px solid rgba(102, 126, 234, 0.2);
}

.result-label {
  color: var(--chalk-white-60);
  font-size: 12px;
  margin-bottom: 8px;
}

.result-value {
  color: var(--chalk-primary);
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 2px;
}

.history-section {
  margin-top: 12px;
}

.history-title {
  color: var(--chalk-white-60);
  font-size: 12px;
  margin-bottom: 8px;
}

.history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.history-item {
  background: rgba(102, 126, 234, 0.12);
  color: #8ab4f8;
  font-size: 13px;
  padding: 3px 10px;
  border-radius: 4px;
  font-family: monospace;
}

.history-actions {
  text-align: right;
}
</style>