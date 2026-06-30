<template>
  <div class="notes-container" ref="containerRef">
    <!-- 面包屑 -->
    <div v-if="showBreadcrumb && viewMode === 'list'" class="notes-breadcrumb-bar">
      <button class="breadcrumb-module" @click="pageNav.setNavPath(['notes'])" title="回到笔记首页">📝</button>
      <div class="breadcrumb-scroll">
        <template v-for="(seg, idx) in localBreadcrumbSegments" :key="idx">
          <span v-if="seg.dropdownItems" class="breadcrumb-sep clickable" @click.stop="toggleSegmentDropdown(seg, $event)">{{ (activeDropdown === 'segment' && activeSegment === seg) ? '∨' : '>' }}</span>
          <span v-else class="breadcrumb-sep">></span>
          <span
            class="breadcrumb-segment"
            :class="{ clickable: seg.clickable }"
            :style="{ color: seg.color }"
            @click="seg.clickable && seg.onClick && seg.onClick()"
          >{{ seg.label }}</span>
        </template>
      </div>
      <button v-if="plusAction" class="breadcrumb-plus-btn" @click="plusAction" title="添加"><el-icon><Plus /></el-icon></button>
    </div>

    <div v-if="activeDropdown === 'segment'" class="page-dropdown" :style="dropdownPosStyle" @click.stop>
      <div v-for="item in segmentDropdownItems" :key="item.id" class="page-dropdown-item" :class="{ current: item.current }" @click="handleSegmentDropdownSelect(item)">
        <span class="page-dropdown-dot" :style="{ background: item.color }"></span>
        <span>{{ item.name }}</span>
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-if="viewMode === 'list'" class="main-content" @click="closeDropdown">
      <div v-if="isNotesHome" class="card-grid" :style="{ gridTemplateColumns: `repeat(${cardColumns}, 1fr)` }">
        <div class="folder-card has-actions" @click="pageNav.setNavPath(['notes', ALL_CATEGORY_VALUE])">
          <div class="folder-card-icon" style="background: linear-gradient(135deg, #667eea, #764ba2)">📋</div>
          <span class="folder-card-name">全部笔记</span>
          <span class="folder-card-count">{{ noteStore.notes.length }} 条笔记</span>
        </div>
        <div v-for="cat in noteStore.categories" :key="cat.id" class="folder-card has-actions" @click="pageNav.setNavPath(['notes', cat.id])">
          <div class="card-top-actions" @click.stop>
            <button class="card-icon-btn" title="编辑分类" @click="editCategoryFromCard(cat)"><el-icon><Edit /></el-icon></button>
            <button class="card-icon-btn danger" title="删除分类" @click="deleteCategoryFromCard(cat)"><el-icon><Delete /></el-icon></button>
          </div>
          <div class="folder-card-icon" :style="{ background: cat.color }">{{ cat.icon }}</div>
          <span class="folder-card-name">{{ cat.name }}</span>
          <span class="folder-card-count">{{ noteStore.getCategoryCount(cat.id) }} 条笔记</span>
        </div>
      </div>

      <div v-else class="content-wrapper">
        <div class="content-body">
          <el-scrollbar>
            <template v-if="isCategoryView">
              <el-empty
                v-if="filteredNotes.length === 0"
                description="还没有笔记，点击右上角 + 写第一条吧"
                :image-size="120"
              />

              <div v-if="pinnedNotes.length > 0" class="section pinned-section">
                <div class="section-title">
                  <el-icon><Star /></el-icon>
                  <span>置顶</span>
                </div>
                <div class="note-grid" :style="{ gridTemplateColumns: `repeat(${cardColumns}, 1fr)` }">
                  <div
                    v-for="note in pinnedNotes"
                    :key="note.id"
                    class="note-card pinned"
                    @click="openDetail(note)"
                  >
                    <div class="note-card-first-row">
                      <div class="note-card-title">{{ note.title }}</div>
                      <div class="note-card-actions">
                        <button class="card-icon-btn" title="取消置顶" @click.stop="handleTogglePin(note)"><el-icon><Star /></el-icon></button>
                        <button class="card-icon-btn" title="编辑" @click.stop="handleEditNote(note)"><el-icon><Edit /></el-icon></button>
                        <button class="card-icon-btn danger" title="删除" @click.stop="handleDeleteNote(note)"><el-icon><Delete /></el-icon></button>
                      </div>
                    </div>
                    <div v-if="note.content" class="note-card-content" v-html="stripHtml(note.content)"></div>
                    <div class="note-card-footer">
                      <span class="note-card-date">{{ formatDate(note.updatedAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="otherNotes.length > 0" class="section">
                <div v-if="pinnedNotes.length > 0" class="section-title">
                  <el-icon><Document /></el-icon>
                  <span>其他</span>
                </div>
                <div class="note-grid" :style="{ gridTemplateColumns: `repeat(${cardColumns}, 1fr)` }">
                  <div
                    v-for="note in otherNotes"
                    :key="note.id"
                    class="note-card"
                    @click="openDetail(note)"
                  >
                    <div class="note-card-first-row">
                      <div class="note-card-title">{{ note.title }}</div>
                      <div class="note-card-actions">
                        <button class="card-icon-btn" title="置顶" @click.stop="handleTogglePin(note)"><el-icon><StarFilled /></el-icon></button>
                        <button class="card-icon-btn" title="编辑" @click.stop="handleEditNote(note)"><el-icon><Edit /></el-icon></button>
                        <button class="card-icon-btn danger" title="删除" @click.stop="handleDeleteNote(note)"><el-icon><Delete /></el-icon></button>
                      </div>
                    </div>
                    <div v-if="note.content" class="note-card-content" v-html="stripHtml(note.content)"></div>
                    <div class="note-card-footer">
                      <span class="note-card-date">{{ formatDate(note.updatedAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </el-scrollbar>
        </div>
      </div>
    </div>

    <!-- 详情视图 -->
    <div v-else-if="viewMode === 'detail' && detailNote" class="detail-view">
      <div class="detail-header">
        <button class="back-btn" @click="closeDetail" title="返回">
          <el-icon><ArrowLeft /></el-icon>
          <span>返回</span>
        </button>
        <span class="detail-title">{{ detailNote.title }}</span>
        <div class="detail-actions">
          <button class="card-icon-btn" :class="{ active: detailNote.pinned }" :title="detailNote.pinned ? '取消置顶' : '置顶'" @click="handleTogglePin(detailNote); detailNote = { ...detailNote, pinned: !detailNote.pinned }">
            <el-icon><StarFilled v-if="detailNote.pinned" /><Star v-else /></el-icon>
          </button>
          <button class="card-icon-btn" title="编辑" @click="handleEditNote(detailNote)"><el-icon><Edit /></el-icon></button>
          <button class="card-icon-btn danger" title="删除" @click="handleDeleteNote(detailNote)"><el-icon><Delete /></el-icon></button>
        </div>
      </div>
      <div class="detail-divider"></div>
      <div class="detail-body">
        <div class="detail-meta">
          <span>{{ getCategoryName(detailNote.categoryId) }}</span>
          <span class="detail-dot">·</span>
          <span>更新于 {{ formatDate(detailNote.updatedAt) }}</span>
        </div>
        <div class="detail-content" v-html="renderDetailContent(detailNote.content)"></div>
      </div>
    </div>

    <!-- 编辑/写笔记视图 -->
    <NoteForm
      v-else-if="viewMode === 'edit'"
      :visible="noteFormVisible"
      :note="editingNote"
      :categories="noteStore.categories"
      :default-category-id="currentCategoryFromPath"
      @update:visible="onNoteFormVisibleChange"
      @submit="handleNoteFormSubmit"
    />

    <CategoryForm
      v-model:visible="categoryFormVisible"
      :category="editingCategory"
      @submit="handleCategoryFormSubmit"
    />

    <ConfirmDialog
      v-model="showDeleteNoteConfirm"
      title="提示"
      message="确定要删除这条笔记吗？"
      @confirm="onNoteDeleteConfirmed"
    />

    <ConfirmDialog
      v-model="showDeleteCategoryConfirm"
      :message="`确定要删除该分类吗？分类下的笔记将自动归入其他分类。`"
      @confirm="onCategoryDeleteConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete, Star, StarFilled, Document, ArrowLeft } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import NoteForm from './NoteForm.vue'
import CategoryForm from './CategoryForm.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import { useNoteStore, ALL_CATEGORY_VALUE, type Note, type NoteCategory } from '../../stores/noteStore'
import { usePageNav, restoreModuleNavPath, type BreadcrumbSegment, type DropdownItem } from '../../composables/usePageNav'
import { logger } from '../../lib/logger'

const pageNav = usePageNav()
const noteStore = useNoteStore()
const isElectron = inject<boolean>('isElectron', false)

const navPath = computed(() => pageNav.navPath.value)

const isNotesHome = computed(() => navPath.value.length === 1 && navPath.value[0] === 'notes')
const isCategoryView = computed(() => navPath.value.length === 2 && navPath.value[0] === 'notes')
const isAllView = computed(() => navPath.value.length === 2 && navPath.value[0] === 'notes' && navPath.value[1] === ALL_CATEGORY_VALUE)

const currentCategoryFromPath = computed(() => {
  if (isCategoryView.value) return navPath.value[1]
  return ''
})

const showBreadcrumb = computed(() => navPath.value[0] === 'notes')

const plusAction = computed(() => {
  if (viewMode.value !== 'list') return null
  if (isNotesHome.value) return handleAddCategory
  if (isCategoryView.value) return handleAddNote
  return null
})

// 视图模式：list / detail / edit
const viewMode = ref<'list' | 'detail' | 'edit'>('list')
const noteFormVisible = ref(false)

const computeBreadcrumbSegments = (): BreadcrumbSegment[] => {
  const segments: BreadcrumbSegment[] = []
  if (navPath.value[0] !== 'notes') return segments
  if (isNotesHome.value) return segments

  if (isCategoryView.value) {
    const catId = navPath.value[1]
    const allDropdownItems: DropdownItem[] = [
      {
        id: ALL_CATEGORY_VALUE,
        name: '全部笔记',
        color: '#667eea',
        current: catId === ALL_CATEGORY_VALUE,
        onSelect: () => pageNav.setNavPath(['notes', ALL_CATEGORY_VALUE])
      },
      ...noteStore.categories.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        current: catId === c.id,
        onSelect: () => pageNav.setNavPath(['notes', c.id])
      }))
    ]
    if (isAllView.value) {
      segments.push({
        label: '全部笔记',
        color: '#667eea',
        clickable: false,
        onClick: null,
        dropdownItems: allDropdownItems
      })
    } else {
      const cat = noteStore.categories.find(c => c.id === catId)
      segments.push({
        label: cat?.name || catId,
        color: cat?.color || '#667eea',
        clickable: false,
        onClick: null,
        dropdownItems: allDropdownItems
      })
    }
  }
  return segments
}

const localBreadcrumbSegments = ref<BreadcrumbSegment[]>([])

const activeDropdown = ref<string | null>(null)
const dropdownPos = ref({ top: 0, left: 0 })
const dropdownPosStyle = computed(() => ({
  top: dropdownPos.value.top + 'px',
  left: dropdownPos.value.left + 'px'
}))
const activeSegment = ref<BreadcrumbSegment | null>(null)

const segmentDropdownItems = computed<DropdownItem[]>(() => {
  if (activeDropdown.value !== 'segment' || !activeSegment.value) return []
  return activeSegment.value.dropdownItems || []
})

const toggleSegmentDropdown = (seg: BreadcrumbSegment, event: MouseEvent) => {
  if (activeDropdown.value === 'segment' && activeSegment.value === seg) {
    closeDropdown()
    return
  }
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  dropdownPos.value = { top: rect.bottom + 4, left: rect.left - 8 }
  activeDropdown.value = 'segment'
  activeSegment.value = seg
}

const handleSegmentDropdownSelect = (item: DropdownItem) => {
  activeDropdown.value = null
  activeSegment.value = null
  item.onSelect()
}

const closeDropdown = () => {
  activeDropdown.value = null
  activeSegment.value = null
}

watch(
  [navPath, () => noteStore.categories],
  () => {
    localBreadcrumbSegments.value = computeBreadcrumbSegments()
    closeDropdown()
  },
  { immediate: true, deep: true }
)

const filteredNotes = computed(() => {
  if (!currentCategoryFromPath.value || isAllView.value) return noteStore.notes
  return noteStore.notes.filter(n => n.categoryId === currentCategoryFromPath.value)
})

const pinnedNotes = computed(() => filteredNotes.value.filter(n => n.pinned))
const otherNotes = computed(() => filteredNotes.value.filter(n => !n.pinned))

// 时间自动更新
const now = ref(Date.now())
let timeTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timeTimer = setInterval(() => { now.value = Date.now() }, 60000)
})
onBeforeUnmount(() => {
  if (timeTimer) clearInterval(timeTimer)
})

const formatDate = (date: string): string => {
  void now.value
  const d = dayjs(date)
  const cur = dayjs()
  const diffMin = cur.diff(d, 'minute')
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return d.format('YYYY-MM-DD')
}

const stripHtml = (html: string): string => {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const text = (tmp.textContent || tmp.innerText || '').trim()
  return text.length > 120 ? text.slice(0, 120) + '...' : text
}

const renderDetailContent = (content: string): string => {
  if (!content) return '<p style="color:var(--chalk-muted)">（无内容）</p>'
  if (content.includes('<') && content.includes('>')) return content
  return content.split('\n').map((l) => l.trim() ? `<p>${l}</p>` : '<p><br></p>').join('')
}

const getCategoryName = (id: string): string => {
  return noteStore.categories.find(c => c.id === id)?.name || '未分类'
}

// 动态卡片列数
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(800)
const CARD_WIDTH = 250
const CARD_GAP = 14
const cardColumns = computed(() => {
  const width = containerWidth.value
  const cols = Math.max(1, Math.ceil((width - CARD_GAP) / (CARD_WIDTH + CARD_GAP)))
  return Math.min(cols, 6)
})
let resizeObserver: ResizeObserver | null = null
const updateWidth = () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
  }
}

// 笔记编辑
const editingNote = ref<Note | null>(null)

const handleAddNote = () => {
  editingNote.value = null
  viewMode.value = 'edit'
  noteFormVisible.value = true
}

const handleEditNote = (note: Note) => {
  editingNote.value = { ...note }
  viewMode.value = 'edit'
  noteFormVisible.value = true
}

const onNoteFormVisibleChange = (v: boolean) => {
  noteFormVisible.value = v
  if (!v) {
    viewMode.value = 'list'
    editingNote.value = null
  }
}

const handleNoteFormSubmit = async (data: { title: string; content: string; color: string; categoryId: string; pinned: boolean; id?: string }) => {
  if (data.id) {
    const ok = await noteStore.updateNote(data.id, {
      title: data.title,
      content: data.content,
      color: data.color,
      categoryId: data.categoryId,
      pinned: data.pinned,
    })
    if (ok) ElMessage.success('笔记已保存')
  } else {
    const note = await noteStore.addNote({
      title: data.title,
      content: data.content,
      color: data.color,
      categoryId: data.categoryId,
      pinned: data.pinned,
    })
    if (note) ElMessage.success('已添加笔记')
  }
}

const handleTogglePin = async (note: Note) => {
  await noteStore.togglePin(note.id)
}

// 详情视图
const detailNote = ref<Note | null>(null)
const openDetail = (note: Note) => {
  detailNote.value = { ...note }
  viewMode.value = 'detail'
}
const closeDetail = () => {
  detailNote.value = null
  viewMode.value = 'list'
}

// 删除笔记
const showDeleteNoteConfirm = ref(false)
const deletingNoteId = ref<string | null>(null)

const handleDeleteNote = (note: Note) => {
  deletingNoteId.value = note.id
  showDeleteNoteConfirm.value = true
}

const onNoteDeleteConfirmed = async () => {
  if (!deletingNoteId.value) return
  const ok = await noteStore.deleteNote(deletingNoteId.value)
  if (ok) {
    ElMessage.success('已删除')
    if (detailNote.value && detailNote.value.id === deletingNoteId.value) {
      closeDetail()
    }
  }
  deletingNoteId.value = null
}

// 分类表单
const categoryFormVisible = ref(false)
const editingCategory = ref<NoteCategory | null>(null)

const handleAddCategory = () => {
  editingCategory.value = null
  categoryFormVisible.value = true
}

const editCategoryFromCard = (cat: NoteCategory) => {
  editingCategory.value = { ...cat }
  categoryFormVisible.value = true
}

const handleCategoryFormSubmit = async (data: { name: string; icon: string; color: string; id?: string }) => {
  if (data.id) {
    const ok = await noteStore.updateCategory(data.id, { name: data.name, icon: data.icon, color: data.color })
    if (ok) ElMessage.success('分类已保存')
  } else {
    const cat = await noteStore.addCategory({ name: data.name, icon: data.icon, color: data.color })
    if (cat) ElMessage.success('已添加分类')
  }
}

// 删除分类（包括系统分类）
const showDeleteCategoryConfirm = ref(false)
const deletingCategoryId = ref<string | null>(null)

const deleteCategoryFromCard = (cat: NoteCategory) => {
  deletingCategoryId.value = cat.id
  showDeleteCategoryConfirm.value = true
}

const onCategoryDeleteConfirmed = async () => {
  if (!deletingCategoryId.value) return
  const ok = await noteStore.deleteCategory(deletingCategoryId.value)
  if (ok) {
    ElMessage.success('已删除分类')
    if (currentCategoryFromPath.value === deletingCategoryId.value) {
      pageNav.setNavPath(['notes'])
    }
  }
  deletingCategoryId.value = null
}

// 初始化
const initNavPath = async () => {
  if (pageNav.navPath.value.length > 1 && pageNav.navPath.value[0] === 'notes') {
    return
  }
  const restored = await restoreModuleNavPath('notes')
  pageNav.setNavPath(restored)
}

onMounted(async () => {
  await noteStore.loadData()
  await initNavPath()
  updateWidth()
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateWidth())
    resizeObserver.observe(containerRef.value)
  }
  logger.info('[笔记] 页面已挂载', { notes: noteStore.notes.length, categories: noteStore.categories.length })
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<style scoped>
.notes-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.notes-breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  margin: 16px 16px 0;
  background: rgba(30, 28, 52, 0.4);
  border-radius: 8px;
  flex-shrink: 0;
}

.breadcrumb-module {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--chalk-white);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.breadcrumb-scroll {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.breadcrumb-scroll::-webkit-scrollbar { display: none; }

.breadcrumb-sep {
  color: var(--chalk-muted);
  font-size: 14px;
  user-select: none;
  flex-shrink: 0;
}

.breadcrumb-sep.clickable {
  cursor: pointer;
  padding: 0 2px;
}

.breadcrumb-sep.clickable:hover {
  color: var(--chalk-primary);
}

.breadcrumb-segment {
  font-size: 14px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.breadcrumb-segment.clickable {
  cursor: pointer;
}

.breadcrumb-segment.clickable:hover {
  background: rgba(255, 255, 255, 0.06);
}

.breadcrumb-plus-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #93c5fd;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  font-size: 16px;
}

.breadcrumb-plus-btn:hover {
  color: var(--chalk-white);
}

.page-dropdown {
  position: fixed;
  z-index: 100;
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 4px;
  min-width: 140px;
  max-height: 280px;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
}

.page-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--chalk-white-85);
  cursor: pointer;
  transition: background 0.15s;
}

.page-dropdown-item:hover {
  background: rgba(102, 126, 234, 0.2);
}

.page-dropdown-item.current {
  background: rgba(102, 126, 234, 0.15);
  color: #93c5fd;
}

.page-dropdown-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 16px;
}

.card-grid {
  display: grid;
  gap: 14px;
  height: 100%;
  overflow-y: auto;
  align-content: start;
}

.folder-card {
  position: relative;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 18px 16px;
  padding-top: 44px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.folder-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(102, 126, 234, 0.3);
  transform: translateY(-2px);
}

.card-top-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.folder-card:hover .card-top-actions {
  opacity: 1;
}

.card-icon-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--chalk-white-70);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.15s;
}

.card-icon-btn:hover {
  background: rgba(102, 126, 234, 0.3);
  color: var(--chalk-white);
}

.card-icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.card-icon-btn.active {
  color: var(--chalk-amber);
}

.folder-card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
}

.folder-card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--chalk-white);
  text-align: center;
}

.folder-card-count {
  font-size: 12px;
  color: var(--chalk-muted);
}

.content-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.content-body {
  flex: 1;
  min-height: 0;
}

.section {
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--chalk-white-70);
  margin-bottom: 12px;
  padding: 0 4px;
}

.pinned-section .section-title {
  color: var(--chalk-amber);
}

.note-grid {
  display: grid;
  gap: 14px;
}

.note-card {
  position: relative;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  min-height: 120px;
  overflow: hidden;
}

.note-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
}

.note-card.pinned {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.06), rgba(255, 255, 255, 0.04));
  border-color: rgba(251, 191, 36, 0.18);
}

.note-card-first-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.note-card-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.note-card:hover .note-card-actions {
  opacity: 1;
}

.note-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--chalk-white);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.note-card-content {
  flex: 1;
  font-size: 13px;
  line-height: 1.6;
  color: var(--chalk-white-70);
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.note-card-footer {
  display: flex;
  align-items: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.note-card-date {
  font-size: 11px;
  color: var(--chalk-muted);
}

/* 详情视图 */
.detail-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 12px;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: transparent;
  color: var(--chalk-white-70);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-actions {
  display: flex;
  gap: 4px;
}

.detail-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 16px;
  flex-shrink: 0;
}

.detail-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--chalk-muted);
  margin-bottom: 16px;
}

.detail-dot {
  color: var(--chalk-subtle);
}

.detail-content {
  font-size: 14px;
  line-height: 1.8;
  color: var(--chalk-white-90);
  word-break: break-word;
}

.detail-content :deep(p) {
  margin: 6px 0;
}

.detail-content :deep(blockquote) {
  border-left: 3px solid #667eea;
  padding-left: 10px;
  margin: 8px 0;
  color: var(--chalk-white-70);
}

.detail-content :deep(pre) {
  background: rgba(0,0,0,0.3);
  padding: 10px;
  border-radius: 6px;
  color: #a8edea;
  font-family: monospace;
  white-space: pre-wrap;
  margin: 6px 0;
}

.detail-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 6px 0;
}

.detail-content :deep(td) {
  border: 1px solid rgba(255,255,255,0.2);
  padding: 6px;
}

.detail-content :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}

.detail-content :deep(video) {
  max-width: 100%;
  border-radius: 6px;
}
</style>
