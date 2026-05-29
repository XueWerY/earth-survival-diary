<template>
  <div class="period-count-picker">
    <div class="pc-trigger" @click="dialogVisible = true">
      <span class="pc-trigger-text">上午{{ modelValue.morning }}节 · 下午{{ modelValue.afternoon }}节 · 晚上{{ modelValue.evening }}节</span>
      <svg class="trigger-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>
    <Teleport to="body">
      <div v-if="dialogVisible" class="pc-dialog-overlay" @click.self="onCancel">
        <div class="pc-dialog-container" @click.stop>
          <div class="pc-dialog-header">
            <span class="pc-dialog-title">课表节数设置</span>
          </div>
          <div class="pc-column-labels">
            <span class="pc-col-label">上午</span>
            <span class="pc-col-label">下午</span>
            <span class="pc-col-label">晚上</span>
          </div>
          <div class="pc-scrolls">
            <div class="pc-scroll-col" ref="morningRef" @scroll="onMorningScroll">
              <div class="pc-scroll-spacer"></div>
              <div
                v-for="v in morningOptions"
                :key="v"
                class="pc-scroll-item"
                :class="{ selected: tempMorning === v }"
                @click="tempMorning = v; scrollToCol(morningRef, morningOptions.indexOf(v))"
              >{{ v }}</div>
              <div class="pc-scroll-spacer"></div>
            </div>
            <div class="pc-scroll-col" ref="afternoonRef" @scroll="onAfternoonScroll">
              <div class="pc-scroll-spacer"></div>
              <div
                v-for="v in afternoonOptions"
                :key="v"
                class="pc-scroll-item"
                :class="{ selected: tempAfternoon === v }"
                @click="tempAfternoon = v; scrollToCol(afternoonRef, afternoonOptions.indexOf(v))"
              >{{ v }}</div>
              <div class="pc-scroll-spacer"></div>
            </div>
            <div class="pc-scroll-col" ref="eveningRef" @scroll="onEveningScroll">
              <div class="pc-scroll-spacer"></div>
              <div
                v-for="v in eveningOptions"
                :key="v"
                class="pc-scroll-item"
                :class="{ selected: tempEvening === v }"
                @click="tempEvening = v; scrollToCol(eveningRef, eveningOptions.indexOf(v))"
              >{{ v }}</div>
              <div class="pc-scroll-spacer"></div>
            </div>
          </div>
          <div class="pc-actions">
            <button class="pc-icon-btn" @click="onCancel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pc-icon-svg">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span>取消</span>
            </button>
            <button class="pc-icon-btn pc-confirm-btn" @click="onConfirm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pc-icon-svg">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>确认</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  modelValue: { morning: number; afternoon: number; evening: number }
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: { morning: number; afternoon: number; evening: number }): void
}>()

const ITEM_HEIGHT = 36

const dialogVisible = ref(false)
const tempMorning = ref(props.modelValue.morning)
const tempAfternoon = ref(props.modelValue.afternoon)
const tempEvening = ref(props.modelValue.evening)

const morningRef = ref<HTMLElement | null>(null)
const afternoonRef = ref<HTMLElement | null>(null)
const eveningRef = ref<HTMLElement | null>(null)

const morningOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const afternoonOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const eveningOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const scrollToCol = (refEl: any, index: number) => {
  nextTick(() => {
    const el = refEl?.value || refEl
    if (el) {
      el.scrollTop = index * ITEM_HEIGHT
    }
  })
}

const onMorningScroll = () => {
  if (!morningRef.value) return
  const idx = Math.round(morningRef.value.scrollTop / ITEM_HEIGHT)
  if (idx >= 0 && idx < morningOptions.length) {
    tempMorning.value = morningOptions[idx]
  }
}

const onAfternoonScroll = () => {
  if (!afternoonRef.value) return
  const idx = Math.round(afternoonRef.value.scrollTop / ITEM_HEIGHT)
  if (idx >= 0 && idx < afternoonOptions.length) {
    tempAfternoon.value = afternoonOptions[idx]
  }
}

const onEveningScroll = () => {
  if (!eveningRef.value) return
  const idx = Math.round(eveningRef.value.scrollTop / ITEM_HEIGHT)
  if (idx >= 0 && idx < eveningOptions.length) {
    tempEvening.value = eveningOptions[idx]
  }
}

const onCancel = () => {
  tempMorning.value = props.modelValue.morning
  tempAfternoon.value = props.modelValue.afternoon
  tempEvening.value = props.modelValue.evening
  dialogVisible.value = false
}

const onConfirm = () => {
  emit('update:modelValue', {
    morning: tempMorning.value,
    afternoon: tempAfternoon.value,
    evening: tempEvening.value
  })
  dialogVisible.value = false
}

watch(dialogVisible, (val) => {
  if (val) {
    tempMorning.value = props.modelValue.morning
    tempAfternoon.value = props.modelValue.afternoon
    tempEvening.value = props.modelValue.evening
    nextTick(() => {
      scrollToCol(morningRef, morningOptions.indexOf(tempMorning.value))
      scrollToCol(afternoonRef, afternoonOptions.indexOf(tempAfternoon.value))
      scrollToCol(eveningRef, eveningOptions.indexOf(tempEvening.value))
    })
  }
})
</script>

<style scoped>
.period-count-picker { width: 100%; }

.pc-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 32px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--chalk-blue);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.pc-trigger:hover { border-color: rgba(102, 126, 234, 0.5); }
.trigger-arrow { width: 14px; height: 14px; opacity: 0.5; flex-shrink: 0; }

.pc-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.pc-dialog-container {
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  width: 300px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
}

.pc-dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px 0;
  flex-shrink: 0;
}

.pc-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
  text-align: center;
}

.pc-column-labels {
  display: flex;
  padding: 12px 20px 4px;
  gap: 0;
}

.pc-col-label {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: var(--chalk-subtle);
  font-weight: 500;
}

.pc-scrolls {
  display: flex;
  height: 108px;
  overflow: hidden;
  padding: 0 20px;
}

.pc-scroll-col {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  scroll-snap-type: y mandatory;
}

.pc-scroll-col::-webkit-scrollbar {
  display: none;
}

.pc-scroll-spacer {
  height: 36px;
  flex-shrink: 0;
}

.pc-scroll-item {
  height: 36px;
  line-height: 36px;
  text-align: center;
  font-size: 16px;
  color: var(--chalk-white-30);
  scroll-snap-align: center;
  cursor: pointer;
  transition: color 0.15s, font-weight 0.15s;
}

.pc-scroll-item.selected {
  color: var(--chalk-primary);
  font-weight: 700;
  font-size: 18px;
}

.pc-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 20px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 8px;
}

.pc-icon-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.pc-icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--chalk-white);
}

.pc-confirm-btn {
  border-color: rgba(102, 126, 234, 0.4);
  color: var(--chalk-blue);
}

.pc-confirm-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-blue);
}

.pc-icon-svg {
  width: 14px;
  height: 14px;
}
</style>