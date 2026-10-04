<template>
  <BaseDialog
    :visible="visible"
    :title="tag ? '编辑标签' : '新建标签'"
    :width="460"
    @update:visible="v => emit('update:visible', v)"
  >
    <span class="tag-form-label">名称</span>
    <el-input
      v-model="name"
      placeholder="支持嵌套层级，如：项目/子项目"
      maxlength="60"
      @keyup.enter="submit"
    />
    <div class="tag-form-hint">
      用 / 分隔层级，缺失的父级标签会自动创建；点击父级标签可汇总查看其下所有笔记
    </div>

    <span class="tag-form-label">颜色</span>
    <ColorGrid v-model="color" />

    <template #footer>
      <el-button v-if="tag" type="danger" plain @click="emit('delete', tag)">删除</el-button>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="submit">确定</el-button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BaseDialog from '../ui/BaseDialog.vue'
import ColorGrid from '../ui/ColorGrid.vue'
import { type Tag } from '../../stores/noteStore'

const props = defineProps<{
  visible: boolean
  tag: Tag | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'submit', data: { id?: string; name: string; color: string }): void
  (e: 'delete', tag: Tag): void
}>()

const name = ref('')
const color = ref('#667eea')

watch(() => props.visible, (v) => {
  if (!v) return
  name.value = props.tag?.name || ''
  color.value = props.tag?.color || '#667eea'
})

const submit = () => {
  const normalized = name.value.split('/').map(s => s.trim()).filter(Boolean).join('/')
  if (!normalized) {
    ElMessage.warning('请输入标签名称')
    return
  }
  emit('submit', { id: props.tag?.id, name: normalized, color: color.value })
}
</script>

<style scoped>
.tag-form-label {
  display: block;
  margin: 14px 0 8px;
  font-size: 13px;
  color: var(--chalk-muted);
}

.tag-form-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--chalk-dim);
}
</style>
