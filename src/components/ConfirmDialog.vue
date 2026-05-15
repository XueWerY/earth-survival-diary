<template>
  <div class="confirm-dialog-container">
    <div class="confirm-dialog">
      <div class="dialog-icon">
        <el-icon class="icon-warning"><Warning /></el-icon>
      </div>
      <h3 class="dialog-title">{{ title }}</h3>
      <p class="dialog-message">{{ message }}</p>
      <div class="dialog-actions">
        <el-button type="default" @click="handleCancel">取消</el-button>
        <el-button type="danger" @click="handleConfirm">确认删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Warning } from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const props = defineProps<{
  title?: string
  message?: string
}>()

const title = computed(() => props.title || '确认操作')
const message = computed(() => props.message || '确定要执行此操作吗？')

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.confirm-dialog-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 12, 41, 0.9);
}

.confirm-dialog {
  background: rgba(30, 28, 52, 0.95);
  border-radius: 16px;
  padding: 32px;
  width: 360px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.dialog-icon {
  text-align: center;
  margin-bottom: 16px;
}

.icon-warning {
  font-size: 48px;
  color: #f59e0b;
}

.dialog-title {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 12px 0;
}

.dialog-message {
  text-align: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

:deep(.el-button) {
  padding: 8px 24px;
  font-size: 14px;
  border-radius: 8px;
}

:deep(.el-button--danger) {
  background: #ef4444;
  border-color: #ef4444;
}

:deep(.el-button--danger:hover) {
  background: #dc2626;
  border-color: #dc2626;
}
</style>