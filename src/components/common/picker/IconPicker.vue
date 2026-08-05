<template>
  <div class="icon-picker">
    <button type="button" class="icon-trigger" @click="toggle">
      <span class="icon-trigger-emoji">{{ modelValue || placeholder }}</span>
      <span class="icon-trigger-caret">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </span>
    </button>
    <BaseDialog
      :visible="open"
      title="选择图标"
      :width="500"
      teleport
      @update:visible="open = $event"
    >
      <div class="icon-picker-body">
        <div v-for="cat in categories" :key="cat.name" class="icon-cat">
          <div class="icon-cat-name">{{ cat.name }}</div>
          <div class="icon-grid">
            <button
              v-for="e in cat.items"
              :key="e"
              type="button"
              class="icon-cell"
              :class="{ active: modelValue === e }"
              @click="select(e)"
            >{{ e }}</button>
          </div>
        </div>
      </div>
      <template #footer>
        <button type="button" class="icon-picker-clear" @click="clear">清除</button>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BaseDialog from '../../ui/BaseDialog.vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
}>(), {
  placeholder: '📝'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)

// 图标来源于 https://www.emojiall.com/zh-hans 的分类整理
const categories: { name: string; items: string[] }[] = [
  {
    name: '表情',
    items: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '🤔', '🤨', '😐', '😏', '😒', '🙄', '😌', '😔', '😴', '😎', '🤓', '🧐', '🥳', '😢', '😭', '😤', '😡', '🤯', '🥱', '🤗', '🤭']
  },
  {
    name: '人物',
    items: ['🧑', '👩', '👨', '👧', '👦', '👶', '👵', '👴', '🧓', '👩‍💻', '👨‍💻', '🧑‍🎓', '👮', '👷', '🧑‍🔧', '👩‍🔬', '👨‍🔬', '💂', '🕵️', '👩‍🚀', '👨‍🚀', '🎅', '🧙', '🧚', '🦸', '🦹']
  },
  {
    name: '动物',
    items: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦄', '🐝', '🦋', '🐢', '🐍', '🐙', '🦖', '🐳', '🐬', '🐟', '🐠']
  },
  {
    name: '食物',
    items: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🍅', '🥑', '🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🍜', '🍣', '🍱', '🍚', '🍰', '🎂', '🍪', '🍫', '🍩', '☕', '🍵', '🧋', '🍺', '🍷']
  },
  {
    name: '活动',
    items: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🏏', '⛳', '🎿', '🥊', '🥋', '🎽', '🏋️', '🤸', '🏌️', '🏇', '🧘', '🏄', '🏊', '🚣', '🧗']
  },
  {
    name: '旅行',
    items: ['🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '✈️', '🚀', '🚁', '⛵', '🚤', '🚢', '🏍️', '🚲', '🛴', '🚂', '🚆', '🏠', '🏡', '🏢', '🏥', '🏫', '🏬', '🏭', '🏯', '🏰', '🗼', '🗽', '🏝️', '🏞️', '🕌']
  },
  {
    name: '物品',
    items: ['⌚', '📱', '💻', '🖥️', '⌨️', '🖱️', '💾', '📷', '📹', '🎥', '📞', '📺', '📻', '🧭', '🔍', '🔎', '💡', '🔦', '🔋', '📡', '📦', '🔑', '🔨', '🔧', '⚙️', '🧪', '🔬', '📐', '📏', '✂️', '📌', '📍', '📎', '🔗', '📝', '📔', '📓', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖']
  },
  {
    name: '符号',
    items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💞', '💖', '💘', '✨', '⭐', '🌟', '💫', '⚡', '🔥', '🌈', '☀️', '🌙', '⛅', '❄️', '💯', '✅', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '❌', '🚫', '🔔', '💬', '💡']
  },
  {
    name: '自然',
    items: ['🌍', '🌎', '🌏', '🌕', '🌑', '💧', '🌊', '🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🍄', '🌷', '🌹', '🌺', '🌸', '🌼', '🌻', '🌞', '🌛', '☄️']
  }
]

const toggle = () => { open.value = !open.value }

const select = (e: string) => {
  emit('update:modelValue', e)
  open.value = false
}

const clear = () => {
  emit('update:modelValue', '')
  open.value = false
}
</script>

<style scoped>
.icon-picker {
  display: block;
  width: 100%;
}

.icon-trigger {
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--chalk-blue);
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 0.2s;
  font-size: 20px;
  line-height: 1;
}

.icon-trigger:hover {
  border-color: rgba(102, 126, 234, 0.5);
}

.icon-trigger:focus,
.icon-trigger:focus-visible,
.icon-trigger:active {
  outline: none;
}

.icon-trigger-caret {
  display: flex;
  align-items: center;
  color: var(--chalk-white-50);
}

.icon-trigger-caret svg {
  width: 14px;
  height: 14px;
}

.icon-picker-body {
  padding: 0;
}

.icon-cat {
  margin-top: 12px;
}

.icon-cat-name {
  font-size: 12px;
  color: var(--chalk-white-70);
  margin-bottom: 8px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.icon-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}

.icon-cell:hover {
  background: rgba(255, 255, 255, 0.08);
}

.icon-cell.active {
  background: rgba(102, 126, 234, 0.25);
  border-color: rgba(102, 126, 234, 0.6);
}

.icon-picker-clear {
  width: 100%;
  height: 36px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-60);
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-picker-clear:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--chalk-white);
}
</style>
