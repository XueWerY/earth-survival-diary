<template>
  <BaseDialog
    :visible="modelValue"
    :title="props.title || '确认操作'"
    :width="300"
    teleport
    @update:visible="handleCancel"
  >
    <div class="confirm-body">
      <p class="confirm-message">{{ messageText }}</p>
      <slot />
    </div>
    <template #footer>
      <button class="capsule-btn cancel-btn" @click="handleCancel">
        <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        <span>取消</span>
      </button>
      <button class="capsule-btn capsule-confirm" @click="handleConfirm">
        <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
        <span>确认</span>
      </button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseDialog from '../../ui/BaseDialog.vue'

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
.confirm-body { display: flex; flex-direction: column; align-items: center; }
.confirm-message { text-align: center; font-size: 14px; color: #fbbf24; margin: 0; line-height: 1.6; }
.capsule-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 18px; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; background: transparent; color: var(--chalk-white-70); cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.2s; }
.capsule-btn:hover { background: rgba(255,255,255,0.08); color: var(--chalk-white); }
.capsule-btn .capsule-icon { width: 14px; height: 14px; }
.capsule-confirm { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4); color: #fca5a5; }
.capsule-confirm:hover { background: rgba(239,68,68,0.35); color: var(--chalk-white); }
</style>
