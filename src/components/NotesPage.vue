<template>
  <div class="notes-container">
    <div class="top-nav-area">
      <div class="cat-nav-wrapper" ref="catNavRef">
        <div class="cat-nav-inner">
          <div
            v-for="(cat, index) in categories"
            :key="cat.id"
            class="nav-item"
            :class="{ active: currentCategoryId === cat.id }"
            :ref="setCatNavItemRef"
            @click="selectCategory(cat.id)"
          >
            <span class="cat-color-dot" :style="{ background: cat.color }"></span>
            <span class="nav-item-name">{{ cat.name }}</span>
            <el-dropdown trigger="click" @command="(cmd: string) => handleCatCommand(cmd, cat, index)">
              <el-button type="info" size="small" text :icon="MoreFilled" class="nav-more" @click.stop />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑分类</el-dropdown-item>
                  <el-dropdown-item command="delete">删除分类</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="nav-item add-nav" :ref="setCatNavItemRef" @click="addCategory">
            <el-icon><Plus /></el-icon>
            <span class="nav-item-name">添加分类</span>
          </div>
        </div>
      </div>
      <div class="nb-nav-wrapper" v-show="currentCategoryId" ref="nbNavRef">
        <div class="nb-nav-inner">
          <div
            v-for="(nb, index) in currentCategoryNotebooks"
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

    <div class="main-content">
      <template v-if="!currentNotebookId">
        <div class="empty-state">
          <el-empty description="选择一个笔记本" :image-size="80" />
        </div>
      </template>
      <template v-else-if="!currentNoteId">
        <div class="note-list-sidebar">
          <div class="sidebar-header">
            <span>笔记列表</span>
            <el-button type="primary" size="small" :icon="Plus" @click="createNote">新建笔记</el-button>
          </div>
          <div class="sidebar-list">
            <div
              v-for="note in currentNotebookNotes"
              :key="note.id"
              class="sidebar-item"
              :class="{ active: currentNoteId === note.id }"
              @click="selectNote(note)"
              @dblclick="openNote(note)"
            >
              <div class="sidebar-item-title">{{ note.title }}</div>
              <div class="sidebar-item-date">{{ formatDate(note.updated_at) }}</div>
            </div>
            <el-empty v-if="currentNotebookNotes.length === 0" description="暂无笔记" :image-size="50" />
          </div>
        </div>
        <div class="editor-area">
          <div class="editor-empty">双击笔记打开编辑</div>
        </div>
      </template>
      <template v-else>
        <div class="note-list-sidebar">
          <div class="sidebar-header">
            <span>笔记列表</span>
            <el-button type="primary" size="small" :icon="Plus" @click="createNote">新建笔记</el-button>
          </div>
          <div class="sidebar-list">
            <div
              v-for="note in currentNotebookNotes"
              :key="note.id"
              class="sidebar-item"
              :class="{ active: currentNoteId === note.id }"
              @click="openNote(note)"
            >
              <div class="sidebar-item-title">{{ note.title }}</div>
              <div class="sidebar-item-date">{{ formatDate(note.updated_at) }}</div>
            </div>
            <el-empty v-if="currentNotebookNotes.length === 0" description="暂无笔记" :image-size="50" />
          </div>
        </div>
        <div class="editor-area editing">
          <div class="editor-header">
            <el-input
              v-model="currentNoteTitle"
              placeholder="笔记标题"
              class="note-title-input"
              @blur="saveNoteTitle"
            />
            <el-button type="danger" size="small" @click="deleteCurrentNote">删除笔记</el-button>
          </div>
          <div id="vditor-container" class="vditor-wrapper"></div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUpdate, watch, nextTick, onBeforeUnmount } from 'vue'
import { Plus, MoreFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import dayjs from 'dayjs'
import { getSystemStateField, setSystemStateField } from '../services/storageService'

interface Category { id: string; name: string; color: string; order: number; created_at: string }
interface Notebook { id: string; categoryId: string; name: string; order: number; created_at: string }
interface Note { id: string; notebookId: string; title: string; content: string; created_at: string; updated_at: string }

const CAT_COLORS = ['#667eea', '#f56c6c', '#67c23a', '#e6a23c', '#909399', '#409eff']

function getAuthToken() { return localStorage.getItem('auth_token') }
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = getAuthToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

const categories = ref<Category[]>([])
const notebooks = ref<Notebook[]>([])
const notes = ref<Note[]>([])
const currentCategoryId = ref('')
const currentNotebookId = ref('')
const currentNoteId = ref('')
const currentNoteTitle = ref('')

let vditor: Vditor | null = null

const catNavRef = ref<HTMLElement>()
const nbNavRef = ref<HTMLElement>()
const catNavItemsRef = ref<HTMLElement[]>([])
const nbNavItemsRef = ref<HTMLElement[]>([])

const clearNavRefs = () => { catNavItemsRef.value = []; nbNavItemsRef.value = [] }
const setCatNavItemRef = (el: any) => { if (el) catNavItemsRef.value.push(el) }
const setNbNavItemRef = (el: any) => { if (el) nbNavItemsRef.value.push(el) }

const scrollToCenter = (container: HTMLElement, target: HTMLElement) => {
  if (!container || !target) return
  const w = container.clientWidth
  const rect = target.getBoundingClientRect()
  const cRect = container.getBoundingClientRect()
  const center = rect.left - cRect.left + container.scrollLeft + rect.width / 2
  container.scrollTo({ left: Math.max(0, center - w / 2), behavior: 'smooth' })
}

const scrollCatNav = () => {
  nextTick(() => {
    const el = catNavRef.value; if (!el) return
    const active = catNavItemsRef.value.find(i => i.classList.contains('active'))
    if (active) scrollToCenter(el, active)
  })
}

const scrollNbNav = () => {
  nextTick(() => {
    const el = nbNavRef.value; if (!el) return
    const active = nbNavItemsRef.value.find(i => i.classList.contains('active'))
    if (active) scrollToCenter(el, active)
  })
}

let isCatDragging = false, catDragStartX = 0, catDragScrollLeft = 0
let isNbDragging = false, nbDragStartX = 0, nbDragScrollLeft = 0
let isCatDragInit = false, isNbDragInit = false

const initCatDrag = () => {
  if (isCatDragInit) return; isCatDragInit = true
  const el = catNavRef.value; if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isCatDragging = true; catDragStartX = e.pageX; catDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isCatDragging) return; e.preventDefault(); el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, catDragScrollLeft + catDragStartX - e.pageX)) })
  const end = () => { if (!isCatDragging) return; isCatDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', end); window.addEventListener('mouseleave', end)
}

const initNbDrag = () => {
  if (isNbDragInit) return; isNbDragInit = true
  const el = nbNavRef.value; if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isNbDragging = true; nbDragStartX = e.pageX; nbDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isNbDragging) return; e.preventDefault(); el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, nbDragScrollLeft + nbDragStartX - e.pageX)) })
  const end = () => { if (!isNbDragging) return; isNbDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', end); window.addEventListener('mouseleave', end)
}

// Navigation persistence
watch([currentCategoryId, currentNotebookId, currentNoteId], async () => {
  await setSystemStateField('notes', {
    currentCategoryId: currentCategoryId.value,
    currentNotebookId: currentNotebookId.value,
    currentNoteId: currentNoteId.value
  })
  nextTick(() => { scrollCatNav(); if (currentCategoryId.value) scrollNbNav() })
}, { deep: true })

// Computed
const currentCategoryNotebooks = computed(() => notebooks.value.filter(n => n.categoryId === currentCategoryId.value))
const currentNotebookNotes = computed(() => notes.value.filter(n => n.notebookId === currentNotebookId.value))

// Data loading
async function loadData() {
  try {
    const [catRes, nbRes] = await Promise.all([
      fetch('/api/notes-categories', { headers: authHeaders() }),
      fetch('/api/notes-notebooks', { headers: authHeaders() })
    ])
    const catData = await catRes.json()
    const nbData = await nbRes.json()
    categories.value = catData.categories || []
    notebooks.value = nbData.notebooks || []
  } catch { ElMessage.error('加载笔记数据失败') }
}

async function loadNotes() {
  if (!currentNotebookId.value) { notes.value = []; return }
  try {
    const res = await fetch(`/api/notes?notebookId=${currentNotebookId.value}`, { headers: authHeaders() })
    const data = await res.json()
    notes.value = data.notes || []
  } catch { ElMessage.error('加载笔记列表失败') }
}

// Category operations
function selectCategory(id: string) {
  currentCategoryId.value = id
  currentNotebookId.value = ''
  currentNoteId.value = ''
  destroyVditor()
  const nbs = currentCategoryNotebooks.value
  if (nbs.length > 0) {
    currentNotebookId.value = nbs[0].id
  }
}

async function addCategory() {
  try {
    const { value } = await ElMessageBox.prompt('输入分类名称', '新建分类', { confirmButtonText: '确定', cancelButtonText: '取消' })
    if (!value) return
    const res = await fetch('/api/notes-categories', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: value, color: CAT_COLORS[categories.value.length % CAT_COLORS.length] })
    })
    const data = await res.json()
    categories.value.push(data.category)
    selectCategory(data.category.id)
  } catch { /* cancelled */ }
}

async function handleCatCommand(cmd: string, cat: Category, _index: number) {
  if (cmd === 'edit') {
    try {
      const { value } = await ElMessageBox.prompt('编辑分类名称', '编辑分类', {
        confirmButtonText: '确定', cancelButtonText: '取消', inputValue: cat.name
      })
      if (!value) return
      await fetch(`/api/notes-categories/${cat.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ name: value })
      })
      const idx = categories.value.findIndex(c => c.id === cat.id)
      if (idx !== -1) categories.value[idx].name = value
    } catch { /* cancelled */ }
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除分类「${cat.name}」及其所有笔记本和笔记？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
      await fetch(`/api/notes-categories/${cat.id}`, { method: 'DELETE', headers: authHeaders() })
      categories.value = categories.value.filter(c => c.id !== cat.id)
      if (currentCategoryId.value === cat.id) {
        currentCategoryId.value = ''
        currentNotebookId.value = ''
        currentNoteId.value = ''
        destroyVditor()
        if (categories.value.length > 0) selectCategory(categories.value[0].id)
      }
      await loadData()
    } catch { /* cancelled */ }
  }
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
      body: JSON.stringify({ categoryId: currentCategoryId.value, name: value })
    })
    const data = await res.json()
    notebooks.value.push(data.notebook)
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
        const nbs = currentCategoryNotebooks.value
        if (nbs.length > 0) selectNotebook(nbs[0].id)
      }
      notes.value = notes.value.filter(n => n.notebookId !== nb.id)
    } catch { /* cancelled */ }
  }
}

// Note operations
function selectNote(note: Note) {
  currentNoteId.value = note.id
}

function openNote(note: Note) {
  currentNoteId.value = note.id
  currentNoteTitle.value = note.title
  nextTick(() => initVditor(note.content))
}

async function createNote() {
  try {
    const res = await fetch('/api/notes', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ notebookId: currentNotebookId.value, title: '无标题', content: '' })
    })
    const data = await res.json()
    notes.value.unshift(data.note)
    openNote(data.note)
  } catch { ElMessage.error('创建笔记失败') }
}

async function saveNoteTitle() {
  if (!currentNoteId.value) return
  try {
    const content = vditor ? vditor.getValue() : ''
    const res = await fetch(`/api/notes/${currentNoteId.value}`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify({ title: currentNoteTitle.value, content })
    })
    const data = await res.json()
    const idx = notes.value.findIndex(n => n.id === data.note.id)
    if (idx !== -1) { notes.value[idx].title = data.note.title; notes.value[idx].updated_at = data.note.updated_at }
  } catch { ElMessage.error('保存失败') }
}

async function deleteCurrentNote() {
  if (!currentNoteId.value) return
  try {
    await ElMessageBox.confirm(`确定删除笔记「${currentNoteTitle.value}」？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await fetch(`/api/notes/${currentNoteId.value}`, { method: 'DELETE', headers: authHeaders() })
    notes.value = notes.value.filter(n => n.id !== currentNoteId.value)
    destroyVditor()
    currentNoteId.value = ''
    currentNoteTitle.value = ''
  } catch { /* cancelled */ }
}

// Vditor lifecycle
function destroyVditor() {
  if (vditor) { vditor.destroy(); vditor = null }
}

function initVditor(content: string) {
  destroyVditor()
  const el = document.getElementById('vditor-container')
  if (!el) return
  vditor = new Vditor(el, {
    height: '100%',
    mode: 'sv',
    value: content,
    placeholder: '开始编写...',
    toolbar: ['headings', 'bold', 'italic', 'strike', '|', 'line', 'quote', 'list', 'ordered-list', 'check', '|', 'code', 'inline-code', 'link', 'table', '|', 'undo', 'redo', 'fullscreen'],
    cache: { enable: false },
    after: () => { vditor?.focus() }
  })
}

function formatDate(date: string) {
  return dayjs(date).format('MM-DD HH:mm')
}

// Init
onMounted(async () => {
  await loadData()
  const state = await getSystemStateField('notes') as any
  if (state?.currentCategoryId && categories.value.some(c => c.id === state.currentCategoryId)) {
    currentCategoryId.value = state.currentCategoryId
    if (state.currentNotebookId) {
      await loadNotes()
      const nbs = notebooks.value.filter(n => n.categoryId === state.currentCategoryId)
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
    }
  } else if (categories.value.length > 0) {
    selectCategory(categories.value[0].id)
    await loadNotes()
  }
  nextTick(() => { initCatDrag(); initNbDrag(); scrollCatNav() })
})

onBeforeUpdate(() => clearNavRefs())

onBeforeUnmount(() => destroyVditor())
</script>

<style scoped>
.notes-container { display: flex; flex-direction: column; height: 100%; position: relative; }
.top-nav-area { background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-shrink: 0; }
.cat-nav-wrapper { height: 56px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; }
.cat-nav-wrapper::-webkit-scrollbar { display: none; }
.cat-nav-inner { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 16px; white-space: nowrap; width: max-content; min-width: 100%; height: 100%; box-sizing: border-box; }
.nav-item { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; user-select: none; height: 40px; }
.nav-item:hover { background: rgba(255, 255, 255, 0.08); }
.nav-item.active { background: rgba(102, 126, 234, 0.2); }
.nav-item.active .nav-item-name { color: #fff; font-weight: 500; }
.nav-item-name { font-size: 14px; color: rgba(255, 255, 255, 0.75); white-space: nowrap; }
.cat-color-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.add-nav { color: rgba(255, 255, 255, 0.5); }
.add-nav:hover { color: rgba(255, 255, 255, 0.8); }
.add-nav .nav-item-name { color: rgba(255, 255, 255, 0.5); }
.nav-more { opacity: 0; transition: opacity 0.2s; width: 20px; height: 20px; flex-shrink: 0; }
.nav-item:hover .nav-more { opacity: 1; }

.nb-nav-wrapper { height: 48px; border-top: 1px solid rgba(255, 255, 255, 0.06); overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; }
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

.main-content { flex: 1; display: flex; min-width: 0; overflow: hidden; }

.note-list-sidebar { width: 200px; min-width: 200px; border-right: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.02); }
.sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.sidebar-header span { color: #fff; font-size: 13px; }
.sidebar-list { flex: 1; overflow-y: auto; padding: 6px; }
.sidebar-item { padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: background 0.15s; margin-bottom: 1px; }
.sidebar-item:hover { background: rgba(255, 255, 255, 0.06); }
.sidebar-item.active { background: rgba(102, 126, 234, 0.15); }
.sidebar-item-title { color: #e0e0e0; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-item-date { color: rgba(255, 255, 255, 0.3); font-size: 11px; margin-top: 1px; }

.editor-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.editor-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255, 255, 255, 0.3); font-size: 14px; }
.editor-area.editing { }
.editor-header { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.note-title-input { flex: 1; }
.vditor-wrapper { flex: 1; overflow: hidden; }

.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; }
</style>
