<template>
  <div class="child-form-loading">
    <div class="loading-spinner"></div>
    <p class="loading-text">加载数据中...</p>
  </div>
</template>

<script setup lang="ts">
import { logger } from './lib/logger'

const urlParams = new URLSearchParams(window.location.search)
const childFormType = urlParams.get('childForm') || ''

logger.info('[子窗口] 子窗口模式已弃用，请使用对话框', { childFormType })
</script>

<style scoped>
.child-form-loading {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: linear-gradient(to bottom, #0f0c29 0%, #302b63 50%, #24243e 100%);
}
.loading-spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.15); border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { color: rgba(255,255,255,0.6); font-size: 14px; }
</style>