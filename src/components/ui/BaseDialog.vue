<template>
  <Teleport to="body" :disabled="!teleport">
    <div v-if="visible" class="dialog-overlay" :class="{ 'dialog-overlay-fullscreen': fullscreen, 'dialog-overlay-inline': inline }" :style="{ zIndex }" @click.self="!noOverlayClose && $emit('update:visible', false)">
      <div class="dialog-container" :class="{ 'dialog-container-fullscreen': fullscreen }" :style="width && !fullscreen ? { width: width + 'px' } : {}">
        <div class="dialog-header">
          <span class="dialog-header-title">{{ title }}</span>
        </div>
        <div class="dialog-separator"></div>
        <div class="dialog-body">
          <slot></slot>
        </div>
        <template v-if="slots.footer">
          <div class="dialog-separator"></div>
          <div class="dialog-footer">
            <slot name="footer"></slot>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const slots = defineSlots<{ default?: any; footer?: any }>()

withDefaults(defineProps<{
  visible: boolean
  title: string
  width?: number
  teleport?: boolean
  noOverlayClose?: boolean
  fullscreen?: boolean
  inline?: boolean
  zIndex?: number
}>(), {
  teleport: false,
  noOverlayClose: false,
  fullscreen: false,
  inline: false,
  zIndex: 9999
})

defineEmits<{
  'update:visible': [value: boolean]
}>()
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  overflow-y: auto;
}

.dialog-container {
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px 0;
  flex-shrink: 0;
}

.dialog-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
}

.dialog-separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 12px 20px;
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 20px 20px;
  flex-shrink: 0;
}

.dialog-footer :deep(.el-button) {
  padding: 8px 24px;
  font-size: 14px;
  border-radius: 8px;
}

.dialog-footer :deep(.el-button--danger) {
  background: #ef4444 !important;
  border-color: #ef4444 !important;
  color: #fff !important;
}

.dialog-footer :deep(.el-button--danger:hover) {
  background: #dc2626 !important;
  border-color: #dc2626 !important;
}

.dialog-overlay-fullscreen { align-items: stretch; }
.dialog-container-fullscreen { width: 100vw; height: 100vh; max-width: 100vw; max-height: 100vh; border-radius: 0; }
/* 容器内弹窗：相对最近定位祖先（如拆分面板），限定在容器内显示 */
.dialog-overlay-inline { position: absolute; }
</style>
