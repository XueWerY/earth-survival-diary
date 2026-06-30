<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <div class="dialog-container category-form-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">{{ isEdit ? '编辑分类' : '新建分类' }}</span>
        </div>
        <div class="dialog-divider"></div>
        <div class="dialog-body">
          <div class="form-row">
            <span class="field-label">名称</span>
            <el-input ref="nameInputRef" v-model="form.name" placeholder="分类名称" maxlength="20" @keyup.enter="handleSubmit" />
          </div>
          <div class="form-row">
            <span class="field-label">图标</span>
            <div class="icon-radio-grid">
              <button
                v-for="emoji in ICON_OPTIONS"
                :key="emoji"
                type="button"
                class="icon-radio-item"
                :class="{ selected: form.icon === emoji }"
                @click="form.icon = emoji"
              >{{ emoji }}</button>
            </div>
          </div>
          <div class="color-section">
            <span class="color-label">颜色</span>
            <div class="color-grid">
              <div
                v-for="c in EXTENDED_NOTE_COLORS"
                :key="c"
                class="color-swatch"
                :class="{ selected: form.color === c }"
                :style="{ background: c }"
                @click="form.color = c"
              ></div>
            </div>
            <div class="custom-color">
              <span class="color-label">自定义</span>
              <el-input v-model="form.color" placeholder="#667eea" size="small" class="custom-color-input" />
            </div>
          </div>
          <div class="form-footer">
            <button class="capsule-btn cancel-btn" @click="handleCancel">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <span>取消</span>
            </button>
            <button class="capsule-btn submit-btn" @click="handleSubmit">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
              <span>{{ isEdit ? '保存' : '添加' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { EXTENDED_NOTE_COLORS, type NoteCategory } from '../../stores/noteStore'

const ICON_OPTIONS = [
  '📝', '🗒️', '📓', '📔', '📕', '📗', '📘', '📙', '💼', '📚', '💡', '✏️',
  '🖊️', '🖋️', '🖌️', '📐', '📏', '🔨', '🛠️', '⚙️', '🔧', '📌', '📍', '🏷️',
  '🔖', '🎯', '⭐', '🌟', '✨', '🔥', '💖', '❤️', '🧡', '💛', '💚', '💙',
  '💜', '🖤', '🤍', '🎉', '🎈', '🎁', '🏆', '🥇', '🎖️', '🔍', '🔬', '🧪',
  '🧫', '🧬', '💻', '🖥️', '⌨️', '🖱️', '💾', '📱', '📞', '📡', '📺', '📻',
  '⏰', '⏳', '📅', '📆', '🗓️', '🎲', '♟️', '🧩', '🎨', '🎭', '🎤', '🎧',
  '🎼', '🎵', '🎶', '🎸', '🎹', '🥁', '🎺', '🚗', '✈️', '🚀', '🚲', '🛴',
  '⛵', '🚂', '🗺️', '🧭', '🏠', '🏡', '🏢', '🏥', '🏫', '🏬', '🏭', '🌳',
  '🌲', '🌴', '🌵', '🌷', '🌹', '🌺', '🌸', '🌼', '🌻', '🌿', '🍀', '☘️',
  '🍁', '🌾', '🍄', '🌍', '🌎', '🌏', '🌕', '☀️', '🌙', '⛅', '☁️', '⚡',
]

const props = defineProps<{
  visible: boolean
  category?: NoteCategory | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'submit', data: { name: string; icon: string; color: string; id?: string }): void
}>()

const form = ref({ name: '', icon: '📝', color: EXTENDED_NOTE_COLORS[0] })
const nameInputRef = ref<{ focus?: () => void; input?: { focus?: () => void } } | null>(null)

const isEdit = ref(false)

const focusNameInput = () => {
  nextTick(() => {
    const ref = nameInputRef.value as any
    if (ref?.focus) ref.focus()
    else if (ref?.input?.focus) ref.input.focus()
  })
}

watch(() => props.visible, (v) => {
  if (v) {
    if (props.category) {
      form.value = { name: props.category.name, icon: props.category.icon, color: props.category.color }
      isEdit.value = true
    } else {
      form.value = { name: '', icon: '📝', color: EXTENDED_NOTE_COLORS[0] }
      isEdit.value = false
    }
    focusNameInput()
  }
})

const handleCancel = () => {
  emit('update:visible', false)
}

const handleSubmit = () => {
  const name = form.value.name.trim()
  if (!name) return
  const icon = form.value.icon.trim() || '📝'
  const color = form.value.color.trim() || EXTENDED_NOTE_COLORS[0]
  emit('submit', { name, icon, color, id: props.category?.id })
  emit('update:visible', false)
}
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

.category-form-dialog {
  width: 400px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.dialog-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
}

.folder-dialog-header {
  justify-content: center;
}

.folder-dialog-title {
  text-align: center;
}

.dialog-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 12px 16px 0;
  flex-shrink: 0;
}

.dialog-body {
  padding: 12px 16px 16px;
  overflow-y: auto;
}

.form-row {
  margin-bottom: 12px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--chalk-dim);
  margin-bottom: 6px;
}

.form-row :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.form-row :deep(.el-input__inner) {
  color: var(--chalk-white);
}

.form-row :deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

.icon-radio-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 4px;
  max-height: 160px;
  overflow-y: auto;
  padding: 6px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  scrollbar-width: none;
}

.icon-radio-grid::-webkit-scrollbar {
  display: none;
}

.icon-radio-item {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}

.icon-radio-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.icon-radio-item.selected {
  background: rgba(102, 126, 234, 0.25);
  border-color: rgba(102, 126, 234, 0.6);
}

.color-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.color-label {
  font-size: 13px;
  color: var(--chalk-dim);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 24px);
  gap: 3px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  box-sizing: border-box;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.selected {
  border-color: #fff;
  transform: scale(1.15);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
}

.custom-color {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-color-input {
  width: 70px;
}

.custom-color-input :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.custom-color-input :deep(.el-input__inner) {
  color: var(--chalk-white);
}

.form-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
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
  transition: all 0.2s;
}

.capsule-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.capsule-btn .capsule-icon {
  width: 14px;
  height: 14px;
}

.submit-btn {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.4);
  color: #93c5fd;
}

.submit-btn:hover {
  background: rgba(102, 126, 234, 0.35);
  color: var(--chalk-white);
}
</style>
