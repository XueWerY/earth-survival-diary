<template>
  <div class="notes-container" ref="containerRef">
    <!-- 面包屑 -->
    <div v-if="showBreadcrumb" class="notes-breadcrumb-bar">
      <button class="breadcrumb-module" @click="handleBreadcrumbModuleClick" title="回到笔记首页">📝</button>
      <div class="breadcrumb-scroll">
        <template v-for="(seg, idx) in localBreadcrumbSegments" :key="idx">
          <span v-if="seg.dropdownItems" class="breadcrumb-sep clickable" @click.stop="toggleSegmentDropdown(seg, $event)">{{ (activeDropdown === 'segment' && activeSegment === seg) ? '∨' : '>' }}</span>
          <span v-else class="breadcrumb-sep">></span>
          <input
            v-if="isRenamingNote && idx === localBreadcrumbSegments.length - 1"
            :ref="(el) => setRenameInputRef(el as HTMLInputElement | null)"
            v-model="renameInputValue"
            class="breadcrumb-rename-input"
            @click.stop
            @keyup.enter="commitRenameNote"
            @blur="commitRenameNote"
          />
          <span
            v-else
            class="breadcrumb-segment"
            :class="{ clickable: seg.clickable }"
            :style="{ color: seg.color }"
            @click="seg.clickable && seg.onClick && seg.onClick()"
          >{{ seg.label }}</span>
        </template>
      </div>
      <button v-if="isEditing && detailNote" class="breadcrumb-rename-btn" @click="startRenameNote" title="重命名笔记">
        <el-icon><EditPen /></el-icon>
      </button>
      <button v-if="navPath.length >= 2" class="breadcrumb-fav-btn" :class="{ active: isCurrentFavorited }" @click="toggleFavorite" title="收藏当前视图">
        <el-icon><StarFilled v-if="isCurrentFavorited" /><Star v-else /></el-icon>
      </button>
      <button v-if="navPath.length >= 2" class="breadcrumb-quick-btn" @click="openFavoritesDropdown" title="快速访问">
        <el-icon><CollectionTag /></el-icon>
      </button>
      <button v-if="isCategoryView && viewMode === 'list'" class="breadcrumb-sort-btn" @click="openSortDropdown" title="排序">
        <el-icon><Sort /></el-icon>
      </button>
      <button v-if="isNotesHome" class="breadcrumb-import-btn" @click="triggerImportHtml" title="导入笔记 HTML 文件">
        <el-icon><Upload /></el-icon>
      </button>
      <button v-if="plusAction" class="breadcrumb-plus-btn" @click="plusAction" title="添加"><el-icon><Plus /></el-icon></button>
    </div>

    <input ref="importFileInputRef" type="file" accept=".html,.htm" style="display:none" @change="handleImportHtml" />

    <div v-if="activeDropdown === 'segment'" class="page-dropdown" :style="dropdownPosStyle" @click.stop>
      <div v-for="item in segmentDropdownItems" :key="item.id" class="page-dropdown-item" :class="{ current: item.current }" @click="handleSegmentDropdownSelect(item)">
        <span class="page-dropdown-dot" :style="{ background: item.color }"></span>
        <span>{{ item.name }}</span>
      </div>
    </div>

    <div v-if="activeDropdown === 'sort'" class="page-dropdown" :style="sortDropdownPosStyle" @click.stop>
      <div v-for="opt in sortOptions" :key="opt.value" class="page-dropdown-item" :class="{ current: currentSort === opt.value }" @click="selectSortOption(opt.value)">
        <span>{{ opt.label }}</span>
      </div>
    </div>

    <div v-if="activeDropdown === 'favorites'" class="page-dropdown" :style="dropdownPosStyle" @click.stop>
      <div v-if="favorites.length === 0" class="page-dropdown-empty">暂无收藏</div>
      <div v-for="fav in favorites" :key="fav.id" class="page-dropdown-item" @click="selectFavorite(fav)">
        <span>{{ fav.name }}</span>
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
                    <div class="note-card-row1">
                      <span class="note-card-title" :title="note.title">{{ note.title }}</span>
                      <div class="note-card-actions">
                        <button class="card-icon-btn" title="取消置顶" @click.stop="handleTogglePin(note)"><el-icon><Star /></el-icon></button>
                        <button class="card-icon-btn" title="编辑" @click.stop="handleEditNote(note)"><el-icon><Edit /></el-icon></button>
                        <button class="card-icon-btn danger" title="删除" @click.stop="handleDeleteNote(note)"><el-icon><Delete /></el-icon></button>
                      </div>
                    </div>
                    <div class="note-card-meta">总共{{ getPageCount(note.content) }}页，全文{{ getWordCount(note.content) }}字</div>
                    <div class="note-card-meta-time">创建于{{ formatDate(note.createdAt) }} · 修改于{{ formatDate(note.updatedAt) }}</div>
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
                    <div class="note-card-row1">
                      <span class="note-card-title" :title="note.title">{{ note.title }}</span>
                      <div class="note-card-actions">
                        <button class="card-icon-btn" title="置顶" @click.stop="handleTogglePin(note)"><el-icon><StarFilled /></el-icon></button>
                        <button class="card-icon-btn" title="编辑" @click.stop="handleEditNote(note)"><el-icon><Edit /></el-icon></button>
                        <button class="card-icon-btn danger" title="删除" @click.stop="handleDeleteNote(note)"><el-icon><Delete /></el-icon></button>
                      </div>
                    </div>
                    <div class="note-card-meta">总共{{ getPageCount(note.content) }}页，全文{{ getWordCount(note.content) }}字</div>
                    <div class="note-card-meta-time">创建于{{ formatDate(note.createdAt) }} · 修改于{{ formatDate(note.updatedAt) }}</div>
                  </div>
                </div>
              </div>
            </template>
          </el-scrollbar>
        </div>
      </div>
    </div>

    <!-- 详情/编辑视图 -->
    <div v-else-if="viewMode === 'detail'" class="detail-view">
      <NoteEditor
        v-if="isEditing"
        ref="editorRef"
        :note="detailNote"
        :categories="noteStore.categories"
        :clockDisplay="clockDisplay"
        :totalWordCount="totalWordCount"
        @save="handleSaveEdit"
        @cancel="handleCancelEdit"
        @back="closeDetail"
        @togglePin="handleTogglePin(detailNote); detailNote = { ...detailNote, pinned: !detailNote.pinned }"
        @preview="handlePreviewFromEditor"
      />
      <NotePreview
        v-else-if="detailNote"
        :note="detailNote"
        :categories="noteStore.categories"
        :clockDisplay="clockDisplay"
        :totalWordCount="totalWordCount"
        :isFullscreen="isFullscreen"
        @close="closeDetail"
        @edit="enterEditMode"
        @delete="handleDeleteNote(detailNote)"
        @togglePin="handleTogglePin(detailNote); detailNote = { ...detailNote, pinned: !detailNote.pinned }"
        @toggleFullscreen="toggleFullscreen"
      />
    </div>

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
import { ref, computed, onMounted, onBeforeUnmount, watch, inject, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete, Star, StarFilled, Document, ArrowLeft, CollectionTag, Sort, EditPen, Upload } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import NoteEditor from './NoteEditor.vue'
import NotePreview from './NotePreview.vue'
import CategoryForm from './CategoryForm.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import { useNoteStore, ALL_CATEGORY_VALUE, getNotePlainText, parseNotePages, type Note, type NoteCategory, type NotePage } from '../../stores/noteStore'
import { usePageNav, restoreModuleNavPath, type BreadcrumbSegment, type DropdownItem, type FavoriteItem } from '../../composables/usePageNav'
import { getData, setData, getSystemStateField, setSystemStateField } from '../../services/storageService'
import { logger } from '../../lib/logger'

const emit = defineEmits<{
  (e: 'fullscreen-change', val: boolean): void
}>()

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
  if (isCategoryView.value && !isAllView.value) return handleAddNote
  return null
})

const handleBreadcrumbModuleClick = async () => {
  if (viewMode.value === 'detail') {
    await closeDetail()
  }
  pageNav.setNavPath(['notes'])
}

// 视图模式：list / detail
const viewMode = ref<'list' | 'detail'>('list')

const computeBreadcrumbSegments = (): BreadcrumbSegment[] => {
  const segments: BreadcrumbSegment[] = []
  if (navPath.value[0] !== 'notes') return segments

  if (viewMode.value === 'detail' && detailNote.value) {
    const catId = detailNote.value.categoryId
    const cat = noteStore.categories.find(c => c.id === catId)
    const allDropdownItems: DropdownItem[] = [
      {
        id: ALL_CATEGORY_VALUE,
        name: '全部笔记',
        color: '#667eea',
        current: catId === ALL_CATEGORY_VALUE,
        onSelect: async () => {
          await saveCurrentEditorIfNeeded()
          closeDetailSync()
          pageNav.setNavPath(['notes', ALL_CATEGORY_VALUE])
        }
      },
      ...noteStore.categories.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        current: catId === c.id,
        onSelect: async () => {
          await saveCurrentEditorIfNeeded()
          closeDetailSync()
          pageNav.setNavPath(['notes', c.id])
        }
      }))
    ]
    segments.push({
      label: cat?.name || '全部笔记',
      color: cat?.color || '#667eea',
      clickable: true,
      onClick: async () => {
        await saveCurrentEditorIfNeeded()
        closeDetailSync()
        pageNav.setNavPath(['notes', catId])
      },
      dropdownItems: allDropdownItems
    })
    // 笔记名称段：下拉显示当前分类下所有笔记
    const notesInCategory = noteStore.notes.filter(n => n.categoryId === catId)
    const noteDropdownItems: DropdownItem[] = notesInCategory.map(n => ({
      id: n.id,
      name: n.title || '新笔记',
      color: '#cbd5e1',
      current: n.id === detailNote.value!.id,
      onSelect: async () => {
        await saveCurrentEditorIfNeeded()
        openDetail(n)
      }
    }))
    segments.push({
      label: detailNote.value.title || '新笔记',
      color: '#cbd5e1',
      clickable: false,
      onClick: null,
      dropdownItems: noteDropdownItems
    })
    return segments
  }

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

// ====== 排序功能 ======
type SortMode = 'updated' | 'created' | 'title'
const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'updated', label: '按更新时间' },
  { value: 'created', label: '按创建时间' },
  { value: 'title', label: '按标题排序' },
]
const currentSort = ref<SortMode>('updated')
const sortDropdownPos = ref({ top: 0, left: 0 })
const sortDropdownPosStyle = computed(() => ({
  top: sortDropdownPos.value.top + 'px',
  left: sortDropdownPos.value.left + 'px'
}))

const openSortDropdown = (event: MouseEvent) => {
  if (activeDropdown.value === 'sort') {
    closeDropdown()
    return
  }
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  sortDropdownPos.value = { top: rect.bottom + 4, left: rect.left - 8 }
  activeDropdown.value = 'sort'
}

const selectSortOption = (val: SortMode) => {
  currentSort.value = val
  closeDropdown()
}

const sortNotes = (notes: Note[]): Note[] => {
  return [...notes].sort((a, b) => {
    if (currentSort.value === 'title') {
      return a.title.localeCompare(b.title, 'zh-CN')
    }
    if (currentSort.value === 'created') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

// ====== 收藏功能 ======
const favorites = ref<FavoriteItem[]>([])

const loadFavorites = async () => {
  favorites.value = (await getData<FavoriteItem[]>('notes', 'favorites')) || []
}

const currentNavPathKey = computed(() => JSON.stringify(navPath.value))

const isCurrentFavorited = computed(() => favorites.value.some(f => JSON.stringify(f.navPath) === currentNavPathKey.value))

const toggleFavorite = async () => {
  const key = currentNavPathKey.value
  if (isCurrentFavorited.value) {
    favorites.value = favorites.value.filter(f => JSON.stringify(f.navPath) !== key)
  } else {
    const name = localBreadcrumbSegments.value.length > 0 
      ? localBreadcrumbSegments.value[localBreadcrumbSegments.value.length - 1].label 
      : '笔记'
    favorites.value.push({ id: 'fav-' + Date.now(), name, navPath: [...navPath.value] })
  }
  await setData('notes', 'favorites', favorites.value)
}

const openFavoritesDropdown = (event: MouseEvent) => {
  if (activeDropdown.value === 'favorites') {
    closeDropdown()
    return
  }
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  dropdownPos.value = { top: rect.bottom + 4, left: rect.left - 8 }
  activeDropdown.value = 'favorites'
}

const selectFavorite = async (fav: FavoriteItem) => {
  await saveCurrentEditorIfNeeded()
  pageNav.setNavPath(fav.navPath)
  closeDropdown()
}

const filteredNotes = computed(() => {
  let notes: Note[]
  if (!currentCategoryFromPath.value || isAllView.value) {
    notes = [...noteStore.notes]
  } else {
    notes = noteStore.notes.filter(n => n.categoryId === currentCategoryFromPath.value)
  }
  return sortNotes(notes)
})

const pinnedNotes = computed(() => sortNotes(filteredNotes.value.filter(n => n.pinned)))
const otherNotes = computed(() => sortNotes(filteredNotes.value.filter(n => !n.pinned)))

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

// 获取笔记页面数
const getPageCount = (content: string): number => {
  return parseNotePages(content).length
}

// 获取笔记全文字数（仅统计中文、字母、数字）
const getWordCount = (content: string): number => {
  const text = getNotePlainText(content)
  return text.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length
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

// ====== 导入笔记 HTML ======
const importFileInputRef = ref<HTMLInputElement | null>(null)

const triggerImportHtml = () => {
  importFileInputRef.value?.click()
}

const handleImportHtml = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  // 重置 input 以便重复导入同一文件
  input.value = ''

  try {
    const text = await file.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/html')

    // 提取笔记标题
    const titleEl = doc.querySelector('title')
    const noteTitle = titleEl?.textContent?.trim() || file.name.replace(/\.html?$/i, '')

    // 提取所有幻灯片页面
    const slideEls = doc.querySelectorAll('.slide')
    if (slideEls.length === 0) {
      ElMessage.error('未在 HTML 中找到笔记内容，请确认是导出的笔记文件')
      return
    }

    const genId = () => 'p_' + Date.now() + Math.random().toString(36).slice(2, 8)
    const pages: NotePage[] = []
    let currentLevel1Id: string | undefined
    let currentLevel2Id: string | undefined

    slideEls.forEach((slide) => {
      const pageTitle = slide.getAttribute('data-title') || ''
      const pageType = slide.getAttribute('data-type') || ''
      const levelNum = parseInt(slide.getAttribute('data-level') || '1', 10)
      const level: 1 | 2 | 3 = levelNum === 2 ? 2 : (levelNum === 3 ? 3 : 1)
      const contentEl = slide.querySelector('.slide-content')
      const content = contentEl ? contentEl.innerHTML : ''

      const id = genId()
      let parentId: string | undefined
      if (level === 1) {
        currentLevel1Id = id
        currentLevel2Id = undefined
      } else if (level === 2) {
        parentId = currentLevel1Id
        currentLevel2Id = id
      } else {
        parentId = currentLevel2Id
      }

      const page: NotePage = {
        id,
        title: pageTitle,
        level,
        content,
      }
      if (parentId) page.parentId = parentId
      if (pageType === 'cover' || pageType === 'thanks') page.type = pageType
      pages.push(page)
    })

    const content = JSON.stringify({ pages })
    const categoryId = noteStore.categories[0]?.id || 'personal'
    const note = await noteStore.addNote({
      title: noteTitle,
      content,
      color: '#667eea',
      categoryId,
      pinned: false,
    })
    if (note) {
      ElMessage.success(`已导入笔记「${noteTitle}」(${pages.length} 页)`)
    }
  } catch (e) {
    logger.error('[笔记] 导入 HTML 失败', { error: e instanceof Error ? e.message : String(e) })
    ElMessage.error('导入失败，请检查文件格式')
  }
}

// 笔记编辑（通过列表中的编辑按钮或详情视图编辑按钮）
const handleAddNote = () => {
  // "全部笔记"视图下 currentCategoryFromPath 返回 'all'，不是真实分类 id，需回退到默认分类
  const catFromPath = currentCategoryFromPath.value
  const validCategoryId = (catFromPath && catFromPath !== ALL_CATEGORY_VALUE)
    ? catFromPath
    : (noteStore.categories[0]?.id || 'personal')
  detailNote.value = {
    id: '',
    title: '',
    content: '',
    color: '#ffffff',
    categoryId: validCategoryId,
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  isEditing.value = true
  viewMode.value = 'detail'
}

const handleEditNote = (note: Note) => {
  detailNote.value = { ...note }
  isEditing.value = true
  viewMode.value = 'detail'
  // 持久化 navPath 第3层（笔记 id）
  if (note.id) {
    pageNav.setNavPath(['notes', note.categoryId, note.id])
  }
}

const enterEditMode = () => {
  isEditing.value = true
}

const handleCancelEdit = () => {
  if (detailNote.value?.id) {
    isEditing.value = false
  } else {
    closeDetail()
  }
}

const handleSaveEdit = async (data: { title: string; content: string; categoryId: string; pinned: boolean }) => {
  if (detailNote.value?.id) {
    const ok = await noteStore.updateNote(detailNote.value.id, {
      title: data.title,
      content: data.content,
      categoryId: data.categoryId,
      pinned: data.pinned,
    })
    if (ok) {
      detailNote.value = noteStore.notes.find(n => n.id === detailNote.value!.id) || null
      ElMessage.success('笔记已保存')
    }
  } else {
    const note = await noteStore.addNote({
      title: data.title,
      content: data.content,
      categoryId: data.categoryId,
      pinned: data.pinned,
    })
    if (note) {
      detailNote.value = note
      // 新笔记保存后持久化 navPath 第3层
      pageNav.setNavPath(['notes', note.categoryId, note.id])
      ElMessage.success('已添加笔记')
    }
  }
}

// 点击预览：先检查本地数据中有没有对应的笔记数据，保存/更新后切换到预览模式
const handlePreviewFromEditor = async (data: { title: string; content: string; categoryId: string; pinned: boolean }) => {
  if (detailNote.value?.id) {
    // 已有笔记：检查本地数据中是否存在，存在则更新
    const exists = noteStore.notes.some(n => n.id === detailNote.value!.id)
    if (exists) {
      const ok = await noteStore.updateNote(detailNote.value.id, {
        title: data.title,
        content: data.content,
        categoryId: data.categoryId,
        pinned: data.pinned,
      })
      if (ok) {
        detailNote.value = noteStore.notes.find(n => n.id === detailNote.value!.id) || null
      }
    }
  } else {
    // 新笔记：本地数据中不存在，先保存到本地
    const note = await noteStore.addNote({
      title: data.title,
      content: data.content,
      categoryId: data.categoryId,
      pinned: data.pinned,
    })
    if (note) {
      detailNote.value = note
      // 新笔记保存后持久化 navPath 第3层
      pageNav.setNavPath(['notes', note.categoryId, note.id])
    }
  }
  isEditing.value = false
}

const handleTogglePin = async (note: Note) => {
  await noteStore.togglePin(note.id)
}

// 详情视图
const detailNote = ref<Note | null>(null)
const isEditing = ref(false)
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
const isFullscreen = ref(false)
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  emit('fullscreen-change', isFullscreen.value)
}

// 编辑模式下保存当前编辑器内容到 store（用于切换地址/返回前）
const saveCurrentEditorIfNeeded = async () => {
  if (!isEditing.value || !editorRef.value || !detailNote.value) return
  const data = editorRef.value.saveAndGetData()
  await handleSaveEdit(data)
}

// 仅清空 detail 视图状态（不保存，不 setNavPath）
const closeDetailSync = () => {
  detailNote.value = null
  isEditing.value = false
  viewMode.value = 'list'
  // 重置全屏状态，避免删除笔记后父组件仍处于全屏模式导致停留在预览界面
  if (isFullscreen.value) {
    isFullscreen.value = false
    emit('fullscreen-change', false)
  }
}

const openDetail = (note: Note) => {
  detailNote.value = { ...note }
  isEditing.value = false
  viewMode.value = 'detail'
  // 持久化 navPath 第3层（笔记 id）
  if (note.id) {
    pageNav.setNavPath(['notes', note.categoryId, note.id])
  }
}
const closeDetail = async () => {
  // 编辑模式下先保存当前内容再关闭
  await saveCurrentEditorIfNeeded()
  closeDetailSync()
  // 持久化 navPath 第2层（移除笔记 id）
  if (navPath.value.length >= 3 && navPath.value[0] === 'notes') {
    pageNav.setNavPath(['notes', navPath.value[1]])
  }
}

// ====== 面包屑重命名笔记 ======
const isRenamingNote = ref(false)
const renameInputValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const setRenameInputRef = (el: HTMLInputElement | null) => {
  renameInputRef.value = el
}

const startRenameNote = () => {
  if (!detailNote.value) return
  renameInputValue.value = detailNote.value.title || ''
  isRenamingNote.value = true
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

const commitRenameNote = () => {
  if (!isRenamingNote.value) return
  isRenamingNote.value = false
  const newTitle = renameInputValue.value.trim()
  if (!newTitle || !detailNote.value) return
  if (newTitle === detailNote.value.title) return
  // 更新编辑器内部 noteTitle（触发封面页大纲重新生成）
  editorRef.value?.setNoteTitle(newTitle)
  // 同步 detailNote 显示
  detailNote.value = { ...detailNote.value, title: newTitle }
}

// 同步 detail 视图：根据 navPath 长度恢复或关闭 detail 视图
const syncDetailFromNavPath = () => {
  const path = pageNav.navPath.value
  if (path[0] !== 'notes') return
  if (path.length === 3) {
    const noteId = path[2]
    const note = noteStore.notes.find(n => n.id === noteId)
    if (note) {
      if (detailNote.value?.id !== noteId) {
        detailNote.value = { ...note }
        isEditing.value = false
        viewMode.value = 'detail'
      }
    } else {
      // 笔记不存在，回退到分类层
      detailNote.value = null
      isEditing.value = false
      viewMode.value = 'list'
      pageNav.setNavPath(['notes', path[1]])
    }
  } else if (path.length <= 2 && viewMode.value === 'detail' && !isEditing.value) {
    // navPath 缩短到分类层，关闭预览模式 detail 视图（编辑模式由 closeDetail 处理）
    detailNote.value = null
    viewMode.value = 'list'
  }
}

// 监听 navPath 变化，同步 detail 视图（用于从快速访问/收藏恢复 detail 视图）
watch(navPath, syncDetailFromNavPath)

watch(
  [navPath, () => noteStore.categories, viewMode, detailNote],
  () => {
    localBreadcrumbSegments.value = computeBreadcrumbSegments()
    closeDropdown()
  },
  { immediate: true, deep: true }
)

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
const clockDisplay = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null
const updateClock = () => {
  const now = new Date()
  const days = ['日', '一', '二', '三', '四', '五', '六']
  clockDisplay.value = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
    + ' 星期' + days[now.getDay()] + ' '
    + String(now.getHours()).padStart(2, '0') + ':'
    + String(now.getMinutes()).padStart(2, '0') + ':'
    + String(now.getSeconds()).padStart(2, '0')
}

const totalWordCount = computed(() => {
  if (!detailNote.value?.content) return 0
  const text = getNotePlainText(detailNote.value.content)
  return text.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length
})

const initNavPath = async () => {
  if (pageNav.navPath.value.length > 1 && pageNav.navPath.value[0] === 'notes') {
    // navPath 已存在（如从其他模块切回），手动同步 detail 视图
    syncDetailFromNavPath()
    await applyPersistedEditMode()
    return
  }
  const restored = await restoreModuleNavPath('notes')
  pageNav.setNavPath(restored)
  // 等待 navPath watcher 触发 syncDetailFromNavPath 后再恢复编辑/预览模式
  await nextTick()
  await applyPersistedEditMode()
}

// 持久化笔记编辑/预览模式的定时器
let editModePersistTimer: ReturnType<typeof setTimeout> | null = null

// 恢复笔记预览/编辑模式（仅在 detail 视图且有笔记时生效）
const applyPersistedEditMode = async () => {
  if (viewMode.value !== 'detail' || !detailNote.value) return
  // 取消待写的持久化定时器，避免在读取磁盘原值前把 isEditing=false 写入覆盖
  if (editModePersistTimer) {
    clearTimeout(editModePersistTimer)
    editModePersistTimer = null
  }
  try {
    const parsed = (await getSystemStateField('notes')) as Record<string, any> | undefined
    if (parsed && typeof parsed.isEditing === 'boolean') {
      isEditing.value = parsed.isEditing
    }
  } catch (e) {
    logger.warn('[笔记] 恢复编辑模式失败', { error: e })
  }
}

// 持久化笔记编辑/预览模式（detail 视图时记录 isEditing，离开 detail 时记录 false）
watch([isEditing, viewMode, detailNote], () => {
  if (editModePersistTimer) clearTimeout(editModePersistTimer)
  editModePersistTimer = setTimeout(async () => {
    try {
      const existing = (await getSystemStateField('notes')) as Record<string, any> | undefined
      const shouldEdit = (viewMode.value === 'detail' && detailNote.value) ? isEditing.value : false
      await setSystemStateField('notes', { ...(existing || {}), isEditing: shouldEdit })
    } catch (e) {
      logger.warn('[笔记] 持久化编辑模式失败', { error: e })
    }
  }, 300)
})

onMounted(async () => {
  await noteStore.loadData()
  await loadFavorites()
  await initNavPath()
  updateWidth()
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateWidth())
    resizeObserver.observe(containerRef.value)
  }
  logger.info('[笔记] 页面已挂载', { notes: noteStore.notes.length, categories: noteStore.categories.length })
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
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

.breadcrumb-rename-input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(102, 126, 234, 0.5);
  border-radius: 6px;
  color: var(--chalk-white);
  font-size: 14px;
  font-weight: 500;
  padding: 4px 8px;
  outline: none;
  min-width: 80px;
  max-width: 220px;
  flex-shrink: 0;
}

.breadcrumb-rename-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  font-size: 16px;
  border-radius: 6px;
}

.breadcrumb-rename-btn:hover {
  color: var(--chalk-white);
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

.breadcrumb-fav-btn, .breadcrumb-quick-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  font-size: 16px;
  border-radius: 6px;
}

.breadcrumb-fav-btn:hover, .breadcrumb-quick-btn:hover {
  color: var(--chalk-white);
  background: rgba(255, 255, 255, 0.06);
}

.breadcrumb-fav-btn.active {
  color: #fbbf24;
}

.breadcrumb-sort-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  font-size: 16px;
  border-radius: 6px;
}

.breadcrumb-sort-btn:hover {
  color: var(--chalk-white);
  background: rgba(255, 255, 255, 0.06);
}

.breadcrumb-import-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  font-size: 16px;
  border-radius: 6px;
}

.breadcrumb-import-btn:hover {
  color: var(--chalk-white);
  background: rgba(255, 255, 255, 0.06);
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

.page-dropdown-empty {
  padding: 20px;
  text-align: center;
  color: var(--chalk-muted);
  font-size: 13px;
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
  gap: 8px;
  min-height: 72px;
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

.note-card-row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.note-card-meta {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: var(--chalk-muted);
}

.note-card-meta-time {
  margin-top: 4px;
  font-size: 11px;
  color: var(--chalk-muted);
  opacity: 0.85;
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
