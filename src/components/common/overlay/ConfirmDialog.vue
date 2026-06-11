<template>
  <div v-if="modelValue" class="confirm-dialog-overlay" @click.self="handleCancel">
    <div class="confirm-dialog">
      <div class="dialog-header-row">
        <el-icon class="icon-warning"><Warning /></el-icon>
        <h3 class="dialog-title">{{ titleText }}</h3>
      </div>
      <p class="dialog-message">{{ messageText }}</p>
      <div class="dialog-actions">
        <button class="capsule-btn" @click="handleCancel">
          <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          <span>取消</span>
        </button>
        <button class="capsule-btn capsule-confirm" @click="handleConfirm">
          <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
          <span>确认</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Warning } from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  message?: string
}>(), {
  modelValue: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const titleText = computed(() => props.title || '确认操作')
const messageText = computed(() => props.message || '确定要执行此操作吗？')

const handleConfirm = () => {
  emit('update:modelValue', false)
  emit('confirm')
}

const handleCancel = () => {
  emit('update:modelValue', false)
  emit('cancel')
}
</script>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 12, 41, 0.9);
}

.confirm-dialog {
  background: rgba(30, 28, 52, 0.95);
  border-radius: 16px;
  padding: 32px;
  width: 300px;
  max-width: 300px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

@media (max-width: 300px) {
  .confirm-dialog {
    width: 80vw;
    max-width: 80vw;
    border-radius: 0;
  }
}

.dialog-header-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.icon-warning {
  font-size: 24px;
  color: var(--chalk-orange);
}

.dialog-title {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--chalk-white);
  margin: 0;
}

.dialog-message {
  text-align: center;
  font-size: 14px;
  color: var(--chalk-white-70);
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.capsule-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: transparent;
  color: var(--chalk-white-70);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}

.capsule-btn .capsule-icon {
  width: 14px;
  height: 14px;
}

.capsule-confirm {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}
</style>