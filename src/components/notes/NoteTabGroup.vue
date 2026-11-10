<template>
  <section class="np-tab-group" :class="{ active: isActive, stacked }" @mousedown="emit('activate', group.id)">
    <header class="np-group-tabbar" :class="{ stacked }">
      <div v-if="!stacked" class="np-group-tab-strip" role="tablist" :aria-label="group.label || '笔记标签组'">
        <template v-for="segment in tabSegments" :key="segment.key">
          <div v-if="segment.type === 'container'" class="np-visual-tab-container" :title="segment.container.label">
            <span class="np-visual-tab-container-label">{{ segment.container.label }}</span>
            <div v-for="note in segment.notes" :key="note.id" class="np-group-tab-item"
              :class="{ active: group.activeId === note.id, pinned: pinnedIds.includes(note.id) }"
              @contextmenu.prevent.stop="emit('tab-contextmenu', $event, group.id, note.id)">
              <button type="button" role="tab" class="np-group-tab" :aria-selected="group.activeId === note.id"
                :title="note.title || '新笔记'" @click="emit('select', group.id, note.id)">
                <el-icon><FileText /></el-icon><span>{{ note.title || '新笔记' }}</span>
              </button>
              <button type="button" class="np-group-tab-close" title="关闭标签页" @click.stop="emit('close', group.id, note.id)"><el-icon><X /></el-icon></button>
            </div>
          </div>
          <div v-else-if="segment.note" :key="segment.note.id" class="np-group-tab-item"
            :class="{ active: group.activeId === segment.note.id, pinned: pinnedIds.includes(segment.note.id) }"
            @contextmenu.prevent.stop="emit('tab-contextmenu', $event, group.id, segment.note.id)">
            <button type="button" role="tab" class="np-group-tab" :aria-selected="group.activeId === segment.note.id"
              :title="segment.note.title || '新笔记'" @click="emit('select', group.id, segment.note.id)">
              <el-icon><FileText /></el-icon><span>{{ segment.note.title || '新笔记' }}</span>
            </button>
            <button type="button" class="np-group-tab-close" title="关闭标签页" @click.stop="emit('close', group.id, segment.note.id)"><el-icon><X /></el-icon></button>
          </div>
        </template>
        <div v-if="group.startOpen" class="np-group-tab-item welcome" :class="{ active: !group.activeId && group.startActive }">
          <button type="button" class="np-group-tab" role="tab" :aria-selected="!group.activeId && group.startActive"
            @click="emit('select', group.id, 'start')"><span>新标签页</span></button>
          <button type="button" class="np-group-tab-close" title="关闭标签页" @click.stop="emit('close-start', group.id)"><el-icon><X /></el-icon></button>
        </div>
        <button type="button" class="np-group-new-tab" title="新标签页" aria-label="新标签页" @click.stop="emit('new-tab', group.id)"><el-icon><Plus /></el-icon></button>
      </div>
      <template v-else>
        <div v-if="activeNote" class="np-group-current-tab" :class="{ pinned: pinnedIds.includes(activeNote.id) }"
          @contextmenu.prevent.stop="emit('tab-contextmenu', $event, group.id, activeNote.id)">
          <el-icon><FileText /></el-icon>
          <span class="np-group-current-tab-title" :title="activeNote.title || '新笔记'">{{ activeNote.title || '新笔记' }}</span>
          <button type="button" class="np-group-tab-close" title="关闭标签页" @click.stop="emit('close', group.id, activeNote.id)"><el-icon><X /></el-icon></button>
        </div>
        <span v-else class="np-group-label">{{ group.startActive ? '新标签页' : (group.label || '标签组') }}</span>
        <button type="button" class="np-group-new-tab" title="新标签页" aria-label="新标签页" @click.stop="emit('new-tab', group.id)"><el-icon><Plus /></el-icon></button>
      </template>
      <slot name="toolbar"></slot>
    </header>

    <div v-if="stacked && groupNotes.length" class="np-stacked-layout">
      <div v-for="note in notesBeforeActive" :key="'before-' + note.id" class="np-stacked-rail"
        :class="{ pinned: pinnedIds.includes(note.id) }"
        @contextmenu.prevent.stop="emit('tab-contextmenu', $event, group.id, note.id)">
        <button type="button" class="np-stacked-rail-close" title="关闭标签页" aria-label="关闭标签页" @click="emit('close', group.id, note.id)"><el-icon><X /></el-icon></button>
        <el-icon class="np-stacked-rail-icon"><FileText /></el-icon>
        <button type="button" class="np-stacked-rail-title" :title="note.title || '新笔记'" @click="emit('select', group.id, note.id)">
          {{ note.title || '新笔记' }}
        </button>
      </div>
      <article v-if="activeNote" class="np-group-editor-pane">
        <NoteEditorHeader :note="activeNote" :tags="tagsForNote(activeNote)" :source-mode="sourceModeForNote(activeNote.id)"
          :status="status" @title-input="onTitleInput" @toggle-source="emit('toggle-source', activeNote.id)" @toggle-outline="toggleOutline" />
        <div ref="editorRoot" class="np-group-editor-body">
          <NoteEditor ref="editorRef" :note="activeNote" :source-mode="sourceModeForNote(activeNote.id)"
            :note-titles="noteTitlesFor(activeNote.id)" @save="emit('save', $event)" @status-change="onStatusChange"
            @toggle-pin="emit('toggle-favorite', activeNote.id)" @toggle-source-mode="emit('toggle-source', activeNote.id)"
            @export="forwardExport(activeNote.id, $event)" @open-wiki-link="emit('open-wiki-link', $event)" />
        </div>
      </article>
      <section v-else-if="!group.activeId && group.startActive" class="np-group-welcome">
        <el-icon><FileText /></el-icon><strong>{{ libraryWritable ? '选择或新建一篇笔记' : '先选择笔记库' }}</strong>
        <span>{{ libraryWritable ? '从左侧文件树打开笔记，或创建新笔记。' : '笔记会按照目录保存在你选择的笔记库中。' }}</span>
        <button v-if="libraryWritable" type="button" @click="emit('create-note', group.id)"><el-icon><Plus /></el-icon>新建笔记</button>
        <button v-else type="button" @click="emit('choose-library')"><el-icon><Folder /></el-icon>选择笔记库</button>
      </section>
      <div v-else class="np-group-empty" aria-hidden="true"></div>
      <div v-for="note in notesAfterActive" :key="'after-' + note.id" class="np-stacked-rail"
        :class="{ pinned: pinnedIds.includes(note.id) }"
        @contextmenu.prevent.stop="emit('tab-contextmenu', $event, group.id, note.id)">
        <button type="button" class="np-stacked-rail-close" title="关闭标签页" aria-label="关闭标签页" @click="emit('close', group.id, note.id)"><el-icon><X /></el-icon></button>
        <el-icon class="np-stacked-rail-icon"><FileText /></el-icon>
        <button type="button" class="np-stacked-rail-title" :title="note.title || '新笔记'" @click="emit('select', group.id, note.id)">
          {{ note.title || '新笔记' }}
        </button>
      </div>
    </div>

    <template v-else>
      <article v-if="activeNote" class="np-group-editor-pane">
        <NoteEditorHeader :note="activeNote" :tags="tagsForNote(activeNote)" :source-mode="sourceModeForNote(activeNote.id)"
          :status="status" @title-input="onTitleInput" @toggle-source="emit('toggle-source', activeNote.id)" @toggle-outline="toggleOutline" />
        <div ref="editorRoot" class="np-group-editor-body">
          <NoteEditor ref="editorRef" :note="activeNote" :source-mode="sourceModeForNote(activeNote.id)"
            :note-titles="noteTitlesFor(activeNote.id)" @save="emit('save', $event)" @status-change="onStatusChange"
            @toggle-pin="emit('toggle-favorite', activeNote.id)" @toggle-source-mode="emit('toggle-source', activeNote.id)"
            @export="forwardExport(activeNote.id, $event)" @open-wiki-link="emit('open-wiki-link', $event)" />
        </div>
      </article>
      <section v-else-if="group.startOpen && group.startActive" class="np-group-welcome">
        <el-icon><FileText /></el-icon><strong>{{ libraryWritable ? '选择或新建一篇笔记' : '先选择笔记库' }}</strong>
        <span>{{ libraryWritable ? '从左侧文件树打开笔记，或创建新笔记。' : '笔记会按照目录保存在你选择的笔记库中。' }}</span>
        <button v-if="libraryWritable" type="button" @click="emit('create-note', group.id)"><el-icon><Plus /></el-icon>新建笔记</button>
        <button v-else type="button" @click="emit('choose-library')"><el-icon><Folder /></el-icon>选择笔记库</button>
      </section>
      <div v-else class="np-group-empty" aria-hidden="true"></div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileText, Folder, Plus, X } from '@lucide/vue'
import NoteEditor from './NoteEditor.vue'
import NoteEditorHeader from './NoteEditorHeader.vue'
import type { Note, Tag } from '../../stores/noteStore'

export type NoteTabGroupState = {
  id: string
  label: string
  tabIds: string[]
  activeId: string | null
  previewId: string | null
  startOpen: boolean
  startActive: boolean
}

export type NoteVisualTabContainer = { id: string; label: string; noteIds: string[] }

const props = defineProps<{
  group: NoteTabGroupState
  notes: Note[]
  allNotes: Note[]
  tags: Tag[]
  pinnedIds: string[]
  tabContainers: NoteVisualTabContainer[]
  stacked: boolean
  isActive: boolean
  libraryWritable: boolean
  sourceModes: Record<string, boolean>
}>()

const emit = defineEmits<{
  (e: 'activate', groupId: string): void
  (e: 'select', groupId: string, noteId: string | 'start'): void
  (e: 'close', groupId: string, noteId: string): void
  (e: 'close-start', groupId: string): void
  (e: 'new-tab', groupId: string): void
  (e: 'tab-contextmenu', event: MouseEvent, groupId: string, noteId: string): void
  (e: 'save', data: { id: string; title: string; content: string; pinned: boolean }): void
  (e: 'toggle-favorite', noteId: string): void
  (e: 'toggle-source', noteId: string): void
  (e: 'export', noteId: string, command: string | number | object, editor: InstanceType<typeof NoteEditor> | null, root: ParentNode): void
  (e: 'open-wiki-link', payload: { target: string }): void
  (e: 'create-note', groupId: string): void
  (e: 'choose-library'): void
}>()

const groupNotes = computed(() => props.group.tabIds.map(id => props.notes.find(note => note.id === id)).filter((note): note is Note => !!note))
const tabSegments = computed(() => {
  const segments: Array<{ key: string; type: 'container'; container: NoteVisualTabContainer; notes: Note[] } | { key: string; type: 'note'; note: Note }> = []
  const groupedIds = new Set<string>()
  const containersByNoteId = new Map<string, NoteVisualTabContainer>()
  for (const container of props.tabContainers) for (const id of container.noteIds) containersByNoteId.set(id, container)
  for (const note of groupNotes.value) {
    const container = containersByNoteId.get(note.id)
    if (!container) {
      segments.push({ key: 'note:' + note.id, type: 'note', note })
      continue
    }
    if (groupedIds.has(container.id)) continue
    groupedIds.add(container.id)
    const notes = container.noteIds.map(id => groupNotes.value.find(item => item.id === id)).filter((item): item is Note => !!item)
    segments.push({ key: 'container:' + container.id, type: 'container', container, notes })
  }
  return segments
})
const activeNote = computed(() => props.group.activeId ? props.notes.find(note => note.id === props.group.activeId) || null : null)
const activeIndex = computed(() => activeNote.value ? groupNotes.value.findIndex(note => note.id === activeNote.value?.id) : -1)
const notesBeforeActive = computed(() => activeIndex.value < 0 ? groupNotes.value : groupNotes.value.slice(0, activeIndex.value))
const notesAfterActive = computed(() => activeIndex.value < 0 ? [] : groupNotes.value.slice(activeIndex.value + 1))
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
const editorRoot = ref<HTMLElement | null>(null)
const status = ref({ wordCount: 0, savedAtText: '' })
const sourceModeForNote = (id: string) => !!props.sourceModes[id]
const tagsForNote = (note: Note) => note.tagIds.map(id => props.tags.find(tag => tag.id === id)).filter((tag): tag is Tag => !!tag)
const noteTitlesFor = (id: string) => props.allNotes.filter(note => note.id !== id).map(note => note.title.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh'))
const onTitleInput = (value: string) => editorRef.value?.setNoteTitle(value)
const onStatusChange = (value: { wordCount: number; savedAtText: string }) => { status.value = value }
const toggleOutline = () => editorRef.value?.toggleOutlinePanel?.()
const forwardExport = (noteId: string, command: string | number | object) => {
  const root = editorRoot.value
  if (root) emit('export', noteId, command, editorRef.value, root)
}
watch(activeNote, note => {
  status.value = { wordCount: 0, savedAtText: '' }
  if (note) status.value.wordCount = (note.content || '').replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length
}, { immediate: true })

defineExpose({ getEditor: () => editorRef.value, getEditorRoot: () => editorRoot.value })
</script>

<style scoped>
.np-tab-group { display:flex; box-sizing:border-box; flex-direction:column; min-width:0; min-height:0; overflow:hidden; border:1px solid rgba(167,139,250,.28); border-radius:10px; background:rgba(255,255,255,.012); }
.np-tab-group.active { border-color:rgba(167,139,250,.42); }
.np-group-tabbar { display:flex; flex:0 0 40px; align-items:center; min-width:0; border-bottom:0; background:rgba(255,255,255,.025); }
.np-group-tab-strip { display:flex; flex:1; align-items:center; gap:4px; min-width:0; height:100%; overflow-x:auto; scrollbar-width:thin; }
.np-visual-tab-container { display:flex; flex:0 0 auto; align-items:center; gap:4px; min-width:0; max-width:100%; height:30px; padding:0 4px 0 7px; border:1px solid rgba(167,139,250,.32); border-left-width:2px; border-radius:8px; background:rgba(139,92,246,.07); }
.np-visual-tab-container-label { flex:0 0 auto; max-width:84px; padding-right:7px; overflow:hidden; border-right:1px solid rgba(196,181,253,.22); color:var(--chalk-white-60); font-size:10px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.np-group-tab-item { display:flex; flex:0 0 auto; align-items:center; min-width:0; max-width:240px; height:26px; border:0; border-radius:7px; color:var(--chalk-white-75); }
.np-group-tab-item.active { color:#fff; background:rgba(167,139,250,.22); box-shadow:inset 0 0 0 1px rgba(196,181,253,.16); }
.np-group-tab-item:hover { color:#f5f3ff; background:rgba(255,255,255,.08); }
.np-group-tab-item.pinned .np-group-tab > span { color:#c4b5fd; }
.np-group-tab { display:flex; align-items:center; gap:7px; min-width:0; height:100%; padding:0 8px 0 11px; border:0; background:transparent; color:inherit; font:inherit; font-size:12px; cursor:pointer; }
.np-group-tab span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.np-group-tab .el-icon { flex:0 0 auto; }
.np-group-tab-close,.np-group-new-tab { display:grid; place-items:center; flex:0 0 28px; width:28px; height:28px; border:0; border-radius:7px; background:transparent; color:var(--chalk-white-70); cursor:pointer; }
.np-group-tab-close:hover,.np-group-new-tab:hover { background:rgba(255,255,255,.1); color:var(--chalk-white-95); }
.np-group-tab-strip > .np-group-new-tab { margin:0 4px; background:transparent; }
.np-group-tabbar > .np-group-new-tab { margin:0 4px; }
.np-group-toolbar-menu { display:flex; align-items:center; flex:0 0 auto; margin:0 6px 0 2px; }
.np-group-tabbar.stacked { justify-content:space-between; padding-left:12px; }
.np-group-label { min-width:0; overflow:hidden; color:var(--chalk-white-70); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.np-group-current-tab { display:flex; align-items:center; gap:7px; min-width:0; height:100%; color:var(--chalk-white-90); font-size:12px; }
.np-group-current-tab.pinned .np-group-current-tab-title { color:#c4b5fd; }
.np-group-current-tab > .el-icon { flex:0 0 auto; color:var(--chalk-muted); }
.np-group-current-tab-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.np-group-editor-pane { display:flex; flex:1; flex-direction:column; min-width:0; min-height:0; overflow:hidden; container:np-editor-pane / inline-size; }
.np-note-titlebar { display:flex; flex:0 0 auto; align-items:center; gap:4px; min-width:0; padding:3px 7px; border-bottom:1px solid rgba(255,255,255,.09); }
.np-note-title-main { display:flex; flex:1 1 auto; flex-direction:row; align-items:center; gap:4px; min-width:100px; }
.np-title-input { flex:0 1 auto; width:auto; max-width:none; min-width:26px; padding:0; border:0; outline:0; background:transparent; color:var(--chalk-white-95); font:inherit; font-size:17px; font-weight:700; }
.np-title-input::placeholder { color:var(--chalk-white-45); }
.np-note-tags-preview { display:flex; flex-wrap:nowrap; gap:4px; min-height:0; min-width:0; overflow:hidden; }
.np-note-tag-preview { padding:0 6px; border:1px solid; border-radius:999px; font-size:10px; line-height:17px; opacity:.88; }
.np-note-title-actions { display:flex; flex:0 1 auto; align-items:center; justify-content:flex-end; gap:4px; min-width:0; }
.np-note-status { max-width:36vw; overflow:hidden; color:var(--chalk-white-65); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.np-note-editor-action { display:inline-flex; flex:0 0 auto; align-items:center; gap:4px; min-height:26px; padding:0 7px; border:1px solid transparent; border-radius:6px; background:transparent; color:var(--chalk-white-70); font:inherit; font-size:11px; cursor:pointer; }
.np-note-editor-action:hover { border-color:rgba(255,255,255,.12); background:rgba(255,255,255,.07); color:var(--chalk-white-95); }
.np-note-editor-action .el-icon { font-size:14px; }
.np-group-editor-body { display:flex; flex:1; min-width:0; min-height:0; overflow:hidden; }
.np-group-editor-body :deep(.editor-wrap) { flex:1; min-width:0; min-height:0; }
.np-group-welcome { display:flex; flex:1; align-items:center; justify-content:center; flex-direction:column; gap:9px; min-width:0; min-height:0; padding:24px; color:rgba(255,255,255,.82); text-align:center; }
.np-group-empty { flex:1; min-width:0; min-height:0; }
.np-group-welcome > .el-icon { color:#a78bfa; font-size:34px; }
.np-group-welcome strong { color:#fff; font-size:16px; }
.np-group-welcome span { max-width:360px; color:rgba(255,255,255,.82); font-size:12px; }
.np-group-welcome button { display:inline-flex; align-items:center; gap:6px; margin-top:6px; padding:7px 12px; border:1px solid rgba(167,139,250,.4); border-radius:8px; background:rgba(139,92,246,.12); color:var(--chalk-white-90); cursor:pointer; }
.np-stacked-layout { display:flex; flex:1; align-items:stretch; min-width:0; min-height:0; overflow:hidden; }
.np-stacked-rail { display:flex; flex:0 0 48px; flex-direction:column; align-items:center; min-width:0; min-height:0; padding:5px 3px; border-right:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.025); color:var(--chalk-white-60); }
.np-stacked-rail:hover { background:rgba(255,255,255,.08); color:var(--chalk-white-90); }
.np-stacked-rail-icon { flex:0 0 21px; font-size:15px; }
.np-stacked-rail-title { flex:1; min-width:0; min-height:0; padding:3px 0; overflow:hidden; border:0; background:transparent; color:inherit; font:inherit; font-size:12px; text-align:left; text-overflow:ellipsis; writing-mode:vertical-rl; text-orientation:mixed; cursor:pointer; }
.np-stacked-rail-close { display:grid; flex:0 0 24px; place-items:center; width:24px; padding:0; border:0; border-radius:5px; background:transparent; color:var(--chalk-muted); cursor:pointer; }
.np-stacked-rail-close:hover { background:rgba(255,255,255,.1); color:var(--chalk-white-95); }
.np-stacked-layout > .np-group-editor-pane,.np-stacked-layout > .np-group-welcome { flex:1 1 0; min-width:0; }
@media (max-width: 820px) {
  .np-note-titlebar { align-items:center; flex-wrap:wrap; gap:3px 6px; padding:4px 8px 6px; }
  .np-note-title-main { flex:1 1 100%; }
  .np-title-input { flex:1 1 120px; font-size:16px; }
  .np-note-title-actions { width:100%; justify-content:flex-start; }
  .np-note-status { flex:1 1 auto; max-width:none; }
  .np-stacked-rail { flex-basis:38px; }
}
</style>
