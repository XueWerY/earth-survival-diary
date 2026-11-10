<template>
  <header class="np-note-titlebar">
    <div class="np-note-title-main">
      <input class="np-title-input" :style="{ width: titleInputWidth }" :value="note.title || ''" placeholder="无标题" @input="onTitleInput" />
      <div class="np-note-tags-preview">
        <span v-for="tag in tags" :key="tag.id" class="np-note-tag-preview" :style="{ color: tag.color, borderColor: tag.color }">{{ tag.name }}</span>
      </div>
    </div>
    <div class="np-note-title-actions">
      <span class="np-note-status">
        字数 {{ status.wordCount }} · 创建 {{ formatTime(note.createdAt) || '—' }} · 更新 {{ formatTime(note.updatedAt) || '—' }}<template v-if="status.savedAtText"> · 已保存 {{ status.savedAtText }}</template>
      </span>
      <button type="button" class="np-note-editor-action" :title="sourceMode ? '切换到富文本' : '切换到源码'" @click="$emit('toggle-source')">
        <el-icon><PenLine v-if="sourceMode" /><Code v-else /></el-icon><span>{{ sourceMode ? '富文本' : '源码' }}</span>
      </button>
      <button type="button" class="np-note-editor-action" title="大纲" @click="$emit('toggle-outline')"><el-icon><ListTree /></el-icon><span>大纲</span></button>
    </div>
  </header>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed } from 'vue'
import { Code, ListTree, PenLine } from '@lucide/vue'
import type { Note, Tag } from '../../stores/noteStore'

const props = defineProps<{
  note: Note
  tags: Tag[]
  sourceMode: boolean
  status: { wordCount: number; savedAtText: string }
}>()

const titleInputWidth = computed(() => {
  const title = props.note.title || ''
  const widthInEm = Array.from(title).reduce((width, character) => {
    if (/\s/.test(character)) return width + 0.32
    const codePoint = character.codePointAt(0) || 0
    if (codePoint > 0x2e7f || /[MW@#%]/.test(character)) return width + 1
    if (/[il.,'`!|]/.test(character)) return width + 0.36
    return width + 0.58
  }, 0)
  const widthInPixels = title ? widthInEm * 17 + 8 : 72
  return `${Math.max(title ? 26 : 72, Math.min(1200, widthInPixels))}px`
})

const emit = defineEmits<{
  (e: 'title-input', value: string): void
  (e: 'toggle-source'): void
  (e: 'toggle-outline'): void
}>()

const onTitleInput = (event: Event) => emit('title-input', (event.target as HTMLInputElement).value)
const formatTime = (value: string) => {
  if (!value) return ''
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : ''
}
</script>

<style scoped>
.np-note-titlebar { display:flex; flex:0 0 auto; align-items:center; gap:4px; min-width:0; padding:3px 7px; border-bottom:1px solid rgba(255,255,255,.09); }
.np-note-title-main { display:flex; flex:1 1 auto; flex-direction:row; align-items:center; gap:4px; min-width:0; }
.np-title-input { flex:0 1 auto; box-sizing:content-box; max-width:none; min-width:26px; padding:0; border:0; outline:0; background:transparent; color:var(--chalk-white-95); font:inherit; font-size:17px; font-weight:700; }
.np-title-input::placeholder { color:var(--chalk-white-45); }
.np-note-tags-preview { display:flex; flex-wrap:nowrap; gap:4px; min-height:0; min-width:0; overflow:hidden; }
.np-note-tag-preview { padding:0 6px; border:1px solid; border-radius:999px; font-size:10px; line-height:17px; opacity:.88; }
.np-note-title-actions { display:flex; flex:0 1 auto; align-items:center; justify-content:flex-end; gap:4px; min-width:0; }
.np-note-status { max-width:36vw; overflow:hidden; color:var(--chalk-white-65); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.np-note-editor-action { display:inline-flex; flex:0 0 auto; align-items:center; gap:4px; min-height:26px; padding:0 7px; border:1px solid transparent; border-radius:6px; background:transparent; color:var(--chalk-white-70); font:inherit; font-size:11px; cursor:pointer; }
.np-note-editor-action:hover { border-color:rgba(255,255,255,.12); background:rgba(255,255,255,.07); color:var(--chalk-white-95); }
.np-note-editor-action .el-icon { font-size:14px; }
@media (max-width: 820px) {
  .np-note-titlebar { align-items:center; flex-wrap:wrap; gap:3px 6px; padding:4px 8px 6px; }
  .np-note-title-main { flex:1 1 100%; }
  .np-title-input { flex:0 1 auto; font-size:16px; }
  .np-note-title-actions { width:100%; justify-content:flex-start; }
  .np-note-status { flex:1 1 auto; max-width:none; }
}
@container np-editor-pane (max-width: 700px) {
  .np-note-titlebar { flex-wrap:wrap; }
  .np-note-title-main { flex:1 1 100%; min-width:0; }
  .np-title-input { flex:0 1 auto; min-width:26px; }
  .np-note-title-actions { flex:1 1 100%; width:100%; justify-content:flex-start; }
  .np-note-status { flex:1 1 auto; max-width:none; }
}
</style>
