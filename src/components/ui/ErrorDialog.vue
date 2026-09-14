<template>
  <div v-if="visible" class="captured-error">
    <div class="captured-error-header">
      <span class="captured-error-title">{{ title }}</span>
    </div>
    <pre>{{ message }}</pre>
    <div class="captured-error-separator"></div>
    <div class="captured-error-buttons">
      <button class="error-btn copy" @click="onCopy">复制错误</button>
      <button class="error-btn close" @click="onClose">关闭</button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  message: string
  title?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

function onClose() {
  emit('update:visible', false)
}

function onCopy() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(props.message).catch(() => {})
  }
}
</script>

<style>
.captured-error {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  max-width: 90vw;
  max-height: 80vh;
  overflow: auto;
  padding: 12px;
  background: rgba(40, 0, 0, 0.95);
  border: 1px solid rgba(255, 80, 80, 0.5);
  border-radius: 8px;
}

.captured-error-header {
  text-align: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 80, 80, 0.3);
}

.captured-error-title {
  color: #ffcccc;
  font-size: 14px;
  font-weight: 600;
}

.captured-error-separator {
  border-top: 1px solid rgba(255, 80, 80, 0.3);
  margin: 8px 0;
}

.captured-error-buttons {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.captured-error-buttons .error-btn {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.captured-error-buttons .error-btn.copy {
  background: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.5);
}

.captured-error-buttons .error-btn.copy:hover {
  background: rgba(59, 130, 246, 0.5);
  color: #ffffff;
}

.captured-error-buttons .error-btn.close {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.5);
}

.captured-error-buttons .error-btn.close:hover {
  background: rgba(239, 68, 68, 0.5);
  color: #ffffff;
}

.captured-error pre {
  margin: 0;
  color: #ff8080;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
