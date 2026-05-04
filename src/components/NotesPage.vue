<template>
  <div class="notes-container">
    <div class="top-nav-area">
      <div class="nb-nav-wrapper" ref="nbNavRef">
        <div class="nb-nav-inner">
          <div
            v-for="(nb, index) in notebooks"
            :key="nb.id"
            class="group-nav-item"
            :class="{ active: currentNotebookId === nb.id }"
            :ref="setNbNavItemRef"
            @click="selectNotebook(nb.id)"
          >
            <span class="group-nav-name">{{ nb.name }}</span>
            <el-dropdown trigger="click" @command="(cmd: string) => handleNbCommand(cmd, nb, index)">
              <el-button type="info" size="small" text :icon="MoreFilled" class="group-nav-more" @click.stop />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑笔记本</el-dropdown-item>
                  <el-dropdown-item command="delete">删除笔记本</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="group-nav-item add-group-nav" :ref="setNbNavItemRef" @click="addNotebook">
            <el-icon><Plus /></el-icon>
            <span class="group-nav-name">添加笔记本</span>
          </div>
        </div>
      </div>
    </div>

    <div class="note-nav-area" v-if="currentNotebookId">
      <div class="note-nav-wrapper" ref="noteNavRef">
        <div class="note-nav-inner">
          <div
            v-for="note in currentNotebookNotes"
            :key="note.id"
            class="note-nav-item"
            :class="{ active: currentNoteId === note.id }"
            :ref="setNoteNavItemRef"
            @click="openNote(note)"
          >
            <span class="note-nav-title">{{ note.title }}</span>
            <span class="note-nav-date">{{ formatDate(note.updated_at) }}</span>
          </div>
          <div class="note-nav-item add-note-nav" :ref="setNoteNavItemRef" @click="createNote">
            <el-icon><Plus /></el-icon>
            <span class="note-nav-title">新建笔记</span>
          </div>
          <div class="note-nav-item delete-note-nav" v-if="currentNoteId" @click="deleteCurrentNote">
            <el-icon><Delete /></el-icon>
            <span class="note-nav-title">删除笔记</span>
          </div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <template v-if="!currentNotebookId">
        <div class="empty-state">
          <el-empty description="选择一个笔记本" :image-size="80" />
        </div>
      </template>
      <template v-else-if="!currentNoteId">
        <div class="editor-area">
          <div class="editor-empty">选择或新建笔记开始编辑</div>
        </div>
      </template>
      <template v-else>
        <div class="editor-area editing">
          <div id="vditor-container" class="vditor-wrapper"></div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUpdate, watch, nextTick, onBeforeUnmount } from 'vue'
import { Plus, MoreFilled, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import dayjs from 'dayjs'
import { getSystemStateField, setSystemStateField } from '../services/storageService'
import { logger } from '../lib/logger'

interface Notebook { id: string; name: string; order: number; created_at: string }
interface Note { id: string; notebookId: string; title: string; content: string; created_at: string; updated_at: string }

function getAuthToken() { return localStorage.getItem('auth_token') }
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = getAuthToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

const notebooks = ref<Notebook[]>([])
const notes = ref<Note[]>([])
const currentNotebookId = ref('')
const currentNoteId = ref('')
const currentNoteTitle = ref('')

let vditor: Vditor | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

const nbNavRef = ref<HTMLElement>()
const nbNavItemsRef = ref<HTMLElement[]>([])
const noteNavRef = ref<HTMLElement>()
const noteNavItemsRef = ref<HTMLElement[]>([])

const clearNavRefs = () => { nbNavItemsRef.value = []; noteNavItemsRef.value = [] }
const setNbNavItemRef = (el: any) => { if (el) nbNavItemsRef.value.push(el) }
const setNoteNavItemRef = (el: any) => { if (el) noteNavItemsRef.value.push(el) }

const scrollToCenter = (container: HTMLElement, target: HTMLElement) => {
  if (!container || !target) return
  const w = container.clientWidth
  const rect = target.getBoundingClientRect()
  const cRect = container.getBoundingClientRect()
  const center = rect.left - cRect.left + container.scrollLeft + rect.width / 2
  container.scrollTo({ left: Math.max(0, center - w / 2), behavior: 'smooth' })
}

const scrollNbNav = () => {
  nextTick(() => {
    const el = nbNavRef.value; if (!el) return
    const active = nbNavItemsRef.value.find(i => i.classList.contains('active'))
    if (active) scrollToCenter(el, active)
  })
}

const scrollNoteNav = () => {
  nextTick(() => {
    const el = noteNavRef.value; if (!el) return
    const active = noteNavItemsRef.value.find(i => i.classList.contains('active'))
    if (active) scrollToCenter(el, active)
  })
}

let isNbDragging = false, nbDragStartX = 0, nbDragScrollLeft = 0
let isNbDragInit = false
let isNoteDragging = false, noteDragStartX = 0, noteDragScrollLeft = 0
let isNoteDragInit = false

const initNbDrag = () => {
  if (isNbDragInit) return; isNbDragInit = true
  const el = nbNavRef.value; if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isNbDragging = true; nbDragStartX = e.pageX; nbDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isNbDragging) return; e.preventDefault(); el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, nbDragScrollLeft + nbDragStartX - e.pageX)) })
  const end = () => { if (!isNbDragging) return; isNbDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', end); window.addEventListener('mouseleave', end)
}

const initNoteDrag = () => {
  if (isNoteDragInit) return; isNoteDragInit = true
  const el = noteNavRef.value; if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isNoteDragging = true; noteDragStartX = e.pageX; noteDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isNoteDragging) return; e.preventDefault(); el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, noteDragScrollLeft + noteDragStartX - e.pageX)) })
  const end = () => { if (!isNoteDragging) return; isNoteDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', end); window.addEventListener('mouseleave', end)
}

// Navigation persistence
watch([currentNotebookId, currentNoteId], async () => {
  await setSystemStateField('notes', {
    currentNotebookId: currentNotebookId.value,
    currentNoteId: currentNoteId.value
  })
  nextTick(() => {
    if (currentNotebookId.value) scrollNbNav()
    if (currentNoteId.value) scrollNoteNav()
  })
}, { deep: true })

// Computed
const currentNotebookNotes = computed(() => notes.value.filter(n => n.notebookId === currentNotebookId.value))

// Data loading
async function loadNotebooks() {
  try {
    const res = await fetch('/api/notes-notebooks', { headers: authHeaders() })
    const data = await res.json()
    notebooks.value = data.notebooks || []
  } catch { ElMessage.error('加载笔记本失败') }
}

async function loadNotes() {
  if (!currentNotebookId.value) { notes.value = []; return }
  try {
    const res = await fetch(`/api/notes?notebookId=${currentNotebookId.value}`, { headers: authHeaders() })
    const data = await res.json()
    notes.value = data.notes || []
  } catch { ElMessage.error('加载笔记列表失败') }
}

// Notebook operations
function selectNotebook(id: string) {
  currentNotebookId.value = id
  currentNoteId.value = ''
  destroyVditor()
  loadNotes()
}

async function addNotebook() {
  try {
    const { value } = await ElMessageBox.prompt('输入笔记本名称', '新建笔记本', { confirmButtonText: '确定', cancelButtonText: '取消' })
    if (!value) return
    const res = await fetch('/api/notes-notebooks', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ name: value })
    })
    const data = await res.json()
    notebooks.value.push(data.notebook)
    logger.info('[笔记] 添加笔记本', { name: value })
    selectNotebook(data.notebook.id)
  } catch { /* cancelled */ }
}

async function handleNbCommand(cmd: string, nb: Notebook, _index: number) {
  if (cmd === 'edit') {
    try {
      const { value } = await ElMessageBox.prompt('编辑笔记本名称', '编辑笔记本', {
        confirmButtonText: '确定', cancelButtonText: '取消', inputValue: nb.name
      })
      if (!value) return
      await fetch(`/api/notes-notebooks/${nb.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ name: value })
      })
      const idx = notebooks.value.findIndex(n => n.id === nb.id)
      if (idx !== -1) notebooks.value[idx].name = value
      logger.info('[笔记] 编辑笔记本', { id: nb.id, oldName: nb.name, newName: value })
    } catch { /* cancelled */ }
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除笔记本「${nb.name}」及其所有笔记？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
      await fetch(`/api/notes-notebooks/${nb.id}`, { method: 'DELETE', headers: authHeaders() })
      notebooks.value = notebooks.value.filter(n => n.id !== nb.id)
      if (currentNotebookId.value === nb.id) {
        currentNotebookId.value = ''
        currentNoteId.value = ''
        destroyVditor()
        const nbs = notebooks.value
        if (nbs.length > 0) selectNotebook(nbs[0].id)
      }
      notes.value = notes.value.filter(n => n.notebookId !== nb.id)
      logger.info('[笔记] 删除笔记本', { id: nb.id, name: nb.name })
    } catch { /* cancelled */ }
  }
}

// Note operations
function openNote(note: Note) {
  currentNoteId.value = note.id
  currentNoteTitle.value = note.title
  nextTick(() => initVditor(note.content))
}

async function autoSave() {
  if (!currentNoteId.value || !vditor) return
  const content = vditor.getValue()
  try {
    const res = await fetch(`/api/notes/${currentNoteId.value}`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify({ title: currentNoteTitle.value, content })
    })
    const data = await res.json()
    const idx = notes.value.findIndex(n => n.id === data.note.id)
    if (idx !== -1) { notes.value[idx].title = data.note.title; notes.value[idx].updated_at = data.note.updated_at }
    logger.info('[笔记] 保存笔记', { id: currentNoteId.value, title: currentNoteTitle.value })
  } catch { /* silent */ }
}

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => autoSave(), 2000)
}

async function createNote() {
  try {
    const { value } = await ElMessageBox.prompt('输入笔记名称', '新建笔记', { confirmButtonText: '确定', cancelButtonText: '取消' })
    if (!value) return
    const res = await fetch('/api/notes', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ notebookId: currentNotebookId.value, title: value, content: '' })
    })
    const data = await res.json()
    notes.value.unshift(data.note)
    openNote(data.note)
    logger.info('[笔记] 新建笔记', { notebookId: currentNotebookId.value, title: value })
  } catch { /* cancelled */ }
}

// Vditor lifecycle
function destroyVditor() {
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null }
  if (vditor) { vditor.destroy(); vditor = null }
}

async function deleteCurrentNote() {
  if (!currentNoteId.value) return
  try {
    const note = notes.value.find(n => n.id === currentNoteId.value)
    await ElMessageBox.confirm(`确定删除笔记「${note?.title || '当前笔记'}」？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await fetch(`/api/notes/${currentNoteId.value}`, { method: 'DELETE', headers: authHeaders() })
    logger.info('[笔记] 删除笔记', { id: currentNoteId.value, title: note?.title })
    notes.value = notes.value.filter(n => n.id !== currentNoteId.value)
    destroyVditor()
    currentNoteId.value = ''
    currentNoteTitle.value = ''
  } catch { /* cancelled */ }
}

function initVditor(content: string) {
  destroyVditor()
  const el = document.getElementById('vditor-container')
  if (!el) return
  vditor = new Vditor(el, {
    height: '100%',
    mode: 'ir',
    value: content,
    placeholder: '开始编写...',
    toolbar: ['headings', 'bold', 'italic', 'strike', '|', 'line', 'quote', 'list', 'ordered-list', 'check', '|', 'code', 'inline-code', 'link', 'table', '|', 'undo', 'redo', 'fullscreen'],
    cache: { enable: false },
    after: () => { vditor?.focus() },
    input: () => { scheduleAutoSave() }
  })
}

function formatDate(date: string) {
  return dayjs(date).format('MM-DD HH:mm')
}

// Init
onMounted(async () => {
  await loadNotebooks()
  const state = await getSystemStateField('notes') as any
  if (state?.currentNotebookId) {
    await loadNotes()
    const nbs = notebooks.value
    if (nbs.some(n => n.id === state.currentNotebookId)) {
      currentNotebookId.value = state.currentNotebookId
      await loadNotes()
      if (state.currentNoteId && notes.value.some(n => n.id === state.currentNoteId)) {
        const note = notes.value.find(n => n.id === state.currentNoteId)
        if (note) openNote(note)
      }
    } else if (nbs.length > 0) {
      currentNotebookId.value = nbs[0].id
      await loadNotes()
    }
  } else if (notebooks.value.length > 0) {
    currentNotebookId.value = notebooks.value[0].id
    await loadNotes()
  }
  nextTick(() => { initNbDrag(); initNoteDrag(); scrollNbNav() })
})

onBeforeUpdate(() => clearNavRefs())

onBeforeUnmount(() => destroyVditor())
</script>

<style scoped>
.notes-container { display: flex; flex-direction: column; height: 100%; position: relative; }
.top-nav-area { background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-shrink: 0; }
.note-nav-area { background: rgba(255, 255, 255, 0.02); border-bottom: 1px solid rgba(255, 255, 255, 0.06); flex-shrink: 0; }

.nb-nav-wrapper { height: 48px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; }
.nb-nav-wrapper::-webkit-scrollbar { display: none; }
.nb-nav-inner { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 16px; white-space: nowrap; width: max-content; min-width: 100%; height: 100%; box-sizing: border-box; }
.group-nav-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; user-select: none; height: 36px; }
.group-nav-item:hover { background: rgba(255, 255, 255, 0.08); }
.group-nav-item.active { background: rgba(102, 126, 234, 0.2); }
.group-nav-item.active .group-nav-name { color: #fff; font-weight: 500; }
.group-nav-name { font-size: 13px; color: rgba(255, 255, 255, 0.7); white-space: nowrap; }
.group-nav-more { opacity: 0; transition: opacity 0.2s; width: 18px; height: 18px; flex-shrink: 0; }
.group-nav-item:hover .group-nav-more { opacity: 1; }
.add-group-nav { color: rgba(255, 255, 255, 0.5); }
.add-group-nav:hover { color: rgba(255, 255, 255, 0.8); }
.add-group-nav .group-nav-name { color: rgba(255, 255, 255, 0.5); }

.note-nav-wrapper { height: 40px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; }
.note-nav-wrapper::-webkit-scrollbar { display: none; }
.note-nav-inner { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 4px 16px; white-space: nowrap; width: max-content; min-width: 100%; height: 100%; box-sizing: border-box; }
.note-nav-item { display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s ease; user-select: none; height: 32px; }
.note-nav-item:hover { background: rgba(255, 255, 255, 0.06); }
.note-nav-item.active { background: rgba(102, 126, 234, 0.15); }
.note-nav-item.active .note-nav-title { color: #fff; font-weight: 500; }
.note-nav-title { font-size: 12px; color: rgba(255, 255, 255, 0.6); white-space: nowrap; }
.note-nav-date { font-size: 11px; color: rgba(255, 255, 255, 0.3); white-space: nowrap; }
.add-note-nav { color: rgba(255, 255, 255, 0.4); }
.add-note-nav:hover { color: rgba(255, 255, 255, 0.7); }
.add-note-nav .note-nav-title { color: rgba(255, 255, 255, 0.4); }
.delete-note-nav { color: rgba(255, 100, 100, 0.4); }
.delete-note-nav:hover { color: rgba(255, 100, 100, 0.8); background: rgba(255, 100, 100, 0.1); }
.delete-note-nav .note-nav-title { color: rgba(255, 100, 100, 0.4); }

.main-content { flex: 1; display: flex; min-width: 0; overflow: hidden; }

.editor-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.editor-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255, 255, 255, 0.3); font-size: 14px; }
.editor-area.editing { }
.vditor-wrapper { flex: 1; overflow: hidden; }

.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; }
</style>

<style>
.vditor { border: none !important; background: transparent !important; }
.vditor-toolbar { background: rgba(255, 255, 255, 0.03) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important; }
.vditor-toolbar__item { color: rgba(255, 255, 255, 0.6) !important; }
.vditor-toolbar__item:hover { color: rgba(255, 255, 255, 0.9) !important; background: rgba(255, 255, 255, 0.08) !important; }
.vditor-toolbar__item--current { color: #667eea !important; }
.vditor-ir { background: #0a0a1a !important; color: #e0e0e0 !important; }
.vditor-ir__node { color: #e0e0e0 !important; }
.vditor-ir__heading { color: #82d8e8 !important; }
.vditor-reset { background: transparent !important; color: #e0e0e0 !important; }
.vditor-reset h1, .vditor-reset h2, .vditor-reset h3, .vditor-reset h4, .vditor-reset h5, .vditor-reset h6 { color: #82d8e8 !important; }
.vditor-reset a { color: #667eea !important; }
.vditor-reset code { background: rgba(255, 255, 255, 0.08) !important; color: #e0e0e0 !important; }
.vditor-reset pre { background: rgba(255, 255, 255, 0.05) !important; border: 1px solid rgba(255, 255, 255, 0.08) !important; }
.vditor-reset blockquote { border-left: 3px solid #667eea !important; background: rgba(102, 126, 234, 0.08) !important; color: rgba(255, 255, 255, 0.7) !important; }
.vditor-reset table { border-color: rgba(255, 255, 255, 0.1) !important; }
.vditor-reset th, .vditor-reset td { border-color: rgba(255, 255, 255, 0.1) !important; }
.vditor-reset th { background: rgba(255, 255, 255, 0.05) !important; }
.vditor-reset hr { border-color: rgba(255, 255, 255, 0.1) !important; }
.vditor-reset input { background: rgba(255, 255, 255, 0.08) !important; border-color: rgba(255, 255, 255, 0.15) !important; }
.vditor-reset strong { color: #fff !important; }
.vditor-reset em { color: #82d8e8 !important; }
.vditor-reset li { color: #e0e0e0 !important; }
.vditor-reset p { color: #e0e0e0 !important; }
.vditor-ir__block { background: rgba(255, 255, 255, 0.03) !important; }
.vditor-ir__block--active { background: rgba(102, 126, 234, 0.1) !important; }
.vditor-ir__node[data-type="code-block"] { background: rgba(255, 255, 255, 0.05) !important; }
.vditor-reset code.hljs { background: rgba(255, 255, 255, 0.05) !important; }
.vditor-reset code:not(.hljs) { background: rgba(102, 126, 234, 0.15) !important; color: #82d8e8 !important; padding: 2px 6px !important; border-radius: 3px !important; }
.vditor-panel { background: #1a1a2e !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; }
.vditor-hint { background: #1a1a2e !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; }
.vditor-hint--current, .vditor-hint button:not([disabled]):hover { background: rgba(102, 126, 234, 0.2) !important; }
.vditor-dialog { background: #1a1a2e !important; border: 1px solid rgba(255, 255, 255, 0.15) !important; }
.vditor-dialog__bg { background: #0a0a1a !important; }
.vditor-dialog__title { color: #fff !important; }
.vditor-upload { background: #667eea !important; }
</style>
