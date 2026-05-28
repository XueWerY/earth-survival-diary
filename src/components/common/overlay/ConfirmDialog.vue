<template>
  <div v-if="modelValue" class="confirm-dialog-overlay" @click.self="handleCancel">
    <div class="confirm-dialog">
      <div class="dialog-icon">
        <el-icon class="icon-warning"><Warning /></el-icon>
      </div>
      <h3 class="dialog-title">{{ titleText }}</h3>
      <p class="dialog-message">{{ messageText }}</p>
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
  width: 600px;
  max-width: 600px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

@media (max-width: 600px) {
  .confirm-dialog {
    width: 100vw;
    max-width: 100vw;
    border-radius: 0;
  }
}

.dialog-icon {
  text-align: center;
  margin-bottom: 16px;
}

.icon-warning {
  font-size: 48px;
  color: var(--chalk-orange);
}

.dialog-title {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--chalk-white);
  margin: 0 0 12px 0;
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
</style>