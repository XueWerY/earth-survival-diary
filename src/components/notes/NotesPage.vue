<template>
  <div class="notes-page" :class="{ 'fs-edit': fullscreenEdit }">
    <!-- ====== 左栏：导航 ====== -->
    <aside class="np-nav" :class="{ 'drawer-open': navDrawerOpen }">

      <nav class="np-nav-scroll">
        <button class="np-nav-item" :class="{ active: currentView === 'all' }" @click="setView('all')">
          <el-icon><Files /></el-icon>
          <span class="np-nav-name">全部笔记</span>
          <span class="np-nav-count">{{ activeNotes.length }}</span>
        </button>
        <button class="np-nav-item" :class="{ active: currentView === 'today' }" @click="setView('today')">
          <el-icon><CalendarDays /></el-icon>
          <span class="np-nav-name">今日</span>
          <span class="np-nav-count">{{ viewCount('today') }}</span>
        </button>
        <button class="np-nav-item" :class="{ active: currentView === 'favorites' }" @click="setView('favorites')">
          <el-icon><Star /></el-icon>
          <span class="np-nav-name">收藏</span>
          <span class="np-nav-count">{{ viewCount('favorites') }}</span>
        </button>

        <div class="np-nav-label np-nav-label-row">
          <span>标签</span>
          <button class="np-label-add" title="新建标签" @click="openCreateTag">
            <el-icon><Plus /></el-icon>
          </button>
        </div>
        <div class="np-nav-tree">
          <TagTree :active="currentView" @select="setView" @edit="openEditTag" />
        </div>

        <div class="np-nav-label">更多</div>
        <button class="np-nav-item" :class="{ active: currentView === 'trash' }" @click="setView('trash')">
          <el-icon><Trash2 /></el-icon>
          <span class="np-nav-name">回收站</span>
          <span class="np-nav-count">{{ viewCount('trash') }}</span>
        </button>
      </nav>
    </aside>
    <transition name="np-fade">
      <div v-if="navDrawerOpen" class="np-drawer-mask" @click="navDrawerOpen = false"></div>
    </transition>

    <!-- ====== 中栏：笔记列表 ====== -->
    <section class="np-list">
      <div class="np-list-head">
        <button class="np-nav-toggle" title="打开导航" @click="navDrawerOpen = true">
          <el-icon><PanelLeft /></el-icon>
        </button>
        <div class="np-search">
          <el-icon><Search /></el-icon>
          <input v-model="query" placeholder="搜索标题、正文、标签" />
        </div>
        <button v-if="currentView === 'trash'" class="np-empty-trash" title="清空回收站" @click="askEmptyTrash">
          <el-icon><Trash2 /></el-icon>
          <span>清空</span>
        </button>
        <button v-else class="np-add-btn" title="新建笔记" @click="createNote">
          <el-icon><Plus /></el-icon>
        </button>
      </div>

      <div ref="listRef" class="np-list-scroll">
        <button
          v-for="note in visibleNotes"
          :key="note.id"
          class="np-item"
          :class="{ active: note.id === selectedId }"
          @click="onItemClick(note)"
        >
          <div class="np-item-top">
            <span class="np-item-title">{{ note.title || '新笔记' }}</span>
            <span class="np-item-actions" @click.stop>
              <template v-if="currentView === 'trash'">
                <button class="np-item-btn" title="恢复笔记" @click="restoreNoteFromTrash(note)">
                  <el-icon><RotateCcw /></el-icon>
                </button>
                <button class="np-item-btn danger" title="彻底删除" @click="askDeleteNote(note)">
                  <el-icon><Trash2 /></el-icon>
                </button>
              </template>
              <template v-else>
                <button
                  class="np-item-btn"
                  :class="{ on: note.pinned }"
                  :title="note.pinned ? '取消收藏' : '收藏'"
                  @click="togglePin(note)"
                >
                  <el-icon><Star :fill="note.pinned ? 'currentColor' : 'none'" /></el-icon>
                </button>
                <button class="np-item-btn danger" title="删除" @click="askDeleteNote(note)">
                  <el-icon><Trash2 /></el-icon>
                </button>
              </template>
            </span>
            <el-icon v-if="note.pinned && currentView !== 'trash'" class="np-item-pin"><Star fill="currentColor" /></el-icon>
          </div>
          <div class="np-item-excerpt">{{ excerpt(note) }}</div>
          <div class="np-item-meta">
            <span class="np-item-tags">
              <span
                v-for="t in itemTags(note)"
                :key="t.id"
                class="np-item-tag"
                :style="{ color: t.color, borderColor: t.color }"
              >{{ shortTagName(t.name) }}</span>
            </span>
            <span class="np-item-time">{{ timeText(note.updatedAt) }}</span>
          </div>
        </button>

        <div v-if="visibleNotes.length === 0" class="np-empty">
          <p>{{ emptyText }}</p>
          <p class="np-empty-sub">{{ emptySub }}</p>
          <button v-if="currentView === 'today' && !query.trim()" class="np-empty-create" @click="createDailyNote">
            <el-icon><Plus /></el-icon>
            <span>新建今日笔记</span>
          </button>
        </div>
      </div>
    </section>

    <!-- ====== 右栏：编辑器 ====== -->
    <section class="np-editor" :class="{ 'editor-open': !!selectedNote }">
      <template v-if="selectedNote">
        <div class="np-editor-main">
          <div class="np-editor-col">
            <div class="np-editor-head">
          <input
            ref="titleInputRef"
            v-model="titleDraft"
            class="np-title-input"
            placeholder="无标题"
            @input="onTitleInput"
          />
          <!-- 属性栏：标签 -->
          <div class="np-props">
            <div class="np-props-tags" @click.stop>
              <span
                v-for="t in noteTags"
                :key="t.id"
                class="np-tag-chip"
                :style="{ color: t.color, borderColor: t.color }"
              >
                {{ t.name }}
                <button class="np-tag-x" title="移除标签" @click="detachTag(t)">
                  <el-icon><X /></el-icon>
                </button>
              </span>
              <button class="np-tag-add" title="添加标签 (Ctrl+Shift+T)" @click="openTagPicker">
                <el-icon><Plus /></el-icon>
                <span>标签</span>
              </button>

              <div v-if="tagPickerOpen" class="np-tag-picker">
                <input
                  ref="tagInputRef"
                  v-model="tagQuery"
                  class="np-tag-input"
                  placeholder="输入标签名，/ 建层级，回车确认"
                  @keydown="onTagKeydown"
                />
                <div class="np-tag-sugs">
                  <button
                    v-for="(s, i) in tagSuggestions"
                    :key="s.kind + ':' + s.label"
                    class="np-tag-sug"
                    :class="{ hl: i === sugIndex }"
                    @mousedown.prevent="applySuggestion(s)"
                    @mouseenter="sugIndex = i"
                  >
                    <span
                      class="np-tag-sug-dot"
                      :style="{ background: s.kind === 'existing' ? s.tag.color : 'rgba(255,255,255,0.28)' }"
                    ></span>
                    <span class="np-tag-sug-label">{{ s.label }}</span>
                    <span class="np-tag-sug-sub">{{ s.kind === 'existing' ? `${s.count} 篇` : '新建' }}</span>
                  </button>
                  <div v-if="tagSuggestions.length === 0" class="np-tag-sug-empty">输入名称后回车创建</div>
                </div>
              </div>
            </div>
            </div>
        </div>
        <NoteEditor
          ref="editorRef"
          :fullscreen-edit="fullscreenEdit"
          @toggle-fullscreen-edit="fullscreenEdit = !fullscreenEdit"
          :note="selectedNote"
          :source-mode="editorSourceMode"
          :backlinks-open="backlinksOpen"
          :backlinks-count="currentBacklinks.length"
          :exporting="exporting"
          @save="handleEditorSave"
          @toggle-pin="selectedNote && togglePin(selectedNote)"
          @toggle-backlinks="backlinksOpen = !backlinksOpen"
          @toggle-source-mode="editorSourceMode = !editorSourceMode"
          @export="handleExportCommand"
          @open-wiki-link="openWikiLink"
        />
          </div>

          <!-- 反向链接面板 -->
          <aside v-if="backlinksOpen" class="np-backlinks">
            <div class="np-bl-head">
              <span class="np-bl-title">反向链接</span>
              <span class="np-bl-count">{{ currentBacklinks.length }}</span>
              <button class="np-bl-close" title="收起" @click="backlinksOpen = false">
                <el-icon><X /></el-icon>
              </button>
            </div>
            <div class="np-bl-list">
              <button
                v-for="bl in currentBacklinks"
                :key="bl.note.id"
                class="np-bl-item"
                @click="openNote(bl.note.id)"
              >
                <span class="np-bl-item-title">{{ bl.note.title || '新笔记' }}</span>
                <span class="np-bl-snippet">{{ bl.snippet || '（无上下文）' }}</span>
              </button>
              <div v-if="currentBacklinks.length === 0" class="np-bl-empty">
                <p>还没有笔记链接到这里</p>
                <p class="np-bl-hint">在其他笔记中输入 [[ 可创建链接</p>
              </div>
            </div>
          </aside>
        </div>
      </template>
      <div v-else class="np-editor-empty">
        <el-icon class="np-empty-icon"><Notebook /></el-icon>
        <p>在左侧选择一篇笔记，或开始新的一篇</p>
        <button class="np-empty-create" @click="createNote">
          <el-icon><Plus /></el-icon>
          <span>新建笔记</span>
        </button>
      </div>
    </section>

    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="删除笔记"
      :message="deletingFromTrash
        ? `彻底删除「${deletingTitle}」？该操作不可恢复。`
        : `确定删除「${deletingTitle}」吗？将移入回收站，保留 30 天。`"
      @confirm="onDeleteConfirmed"
    />

    <ConfirmDialog
      v-model="showEmptyTrashConfirm"
      title="清空回收站"
      :message="`确定清空回收站吗？${noteStore.trashedNotes.length} 篇笔记将被彻底删除，不可恢复。`"
      @confirm="onEmptyTrashConfirmed"
    />

    <TagForm
      :visible="tagFormVisible"
      :tag="editingTag"
      @update:visible="tagFormVisible = $event"
      @submit="handleTagFormSubmit"
      @delete="handleTagDelete"
    />
    <ConfirmDialog
      v-model="showTagDeleteConfirm"
      title="删除标签"
      :message="`确定删除标签「${deletingTagName}」吗？笔记会保留，仅移除该标签。`"
      @confirm="onTagDeleteConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Files, CalendarDays, Star, Trash2,
  Plus, Search, PanelLeft, X, RotateCcw
} from '@lucide/vue'
import NoteEditor from './NoteEditor.vue'
import TagTree from './TagTree.vue'
import TagForm from './TagForm.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import { useNoteStore, getMdPlainText, type Note, type Tag } from '../../stores/noteStore'
import { createBigramIndex } from '../../utils/bigramSearch'
import { extractWikiLinks } from '../editor/wikiLink'
import { exportNoteMarkdown, exportNoteImage } from '../../utils/noteExport'
import { usePageNav, restoreModuleNavPath } from '../../composables/usePageNav'
import { useCardEntrance } from '../../composables/useMotion'
import dayjs from 'dayjs'
import { logger } from '../../lib/logger'

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const pageNav = usePageNav()
const noteStore = useNoteStore()

// ====== 视图状态（navPath: ['notes', view] / ['notes', view, noteId]）======
// view ∈ 'all' | 'today' | 'favorites' | 'trash' | 标签id
// 兼容旧持久化数据：旧路径 ['notes', 分类id, 笔记id] 中分类 id 已在迁移时复用为标签 id
const RESERVED_VIEWS = ['all', 'today', 'favorites', 'trash']

const navPath = computed(() => pageNav.navPath.value)

const currentView = computed(() => {
  const v = navPath.value[1] || 'all'
  if (RESERVED_VIEWS.includes(v)) return v
  // 虚拟父节点视图（"v:" + 路径）：仅有子标签、自身不是标签时的聚合入口
  if (v.startsWith('v:')) return v
  if (noteStore.tags.some(t => t.id === v)) return v
  return 'all'
})

const selectedNote = computed<Note | null>(() => {
  if (navPath.value.length < 3) return null
  return noteStore.notes.find(n => n.id === navPath.value[2]) || null
})
const selectedId = computed(() => selectedNote.value?.id || null)

const setView = (view: string) => {
  moduleMenuOpen.value = false
  navDrawerOpen.value = false
  if (currentView.value === view && navPath.value.length <= 2) return
  pageNav.setNavPath(['notes', view])
}

const openNote = (id: string) => {
  pageNav.setNavPath(['notes', currentView.value, id])
}

// navPath 指向不存在的笔记时回退（如笔记已被删除）
watch(navPath, () => {
  const path = pageNav.navPath.value
  if (path[0] !== 'notes') return
  if (path.length >= 3) {
    const exists = noteStore.notes.some(n => n.id === path[2])
    if (!exists) {
      pageNav.setNavPath(['notes', path[1] || 'all'])
      return
    }
    navDrawerOpen.value = false
  }
})

// ====== 左栏 ======
const moduleMenuOpen = ref(false)
const navDrawerOpen = ref(false)

  // ====== 侧栏收起/展开（宽屏；localStorage 记忆） ======
  // ====== 全屏编辑（隐藏两个侧边栏，只留编辑器内容；状态上报 App 隐藏全局导航） ======
  const fullscreenEdit = ref(false)
  watch(fullscreenEdit, (v) => emit('fullscreen-change', v))



const onDocClick = () => {
  moduleMenuOpen.value = false
  tagPickerOpen.value = false
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    moduleMenuOpen.value = false
    navDrawerOpen.value = false
    tagPickerOpen.value = false
  } else if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
    if (!selectedNote.value) return
    e.preventDefault()
    openTagPicker()
  } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'n' || e.key === 'N')) {
    // Ctrl+N：应用内新建笔记（快速捕获入口之一）
    e.preventDefault()
    createNote()
  }
}

const onResize = () => {
  if (window.innerWidth >= 1100) navDrawerOpen.value = false
  // 反链面板在窄屏自动收起（可手动再开）
  if (window.innerWidth < 1400) backlinksOpen.value = false
}

const onWindowFocus = () => {
  // 从速记窗切回主窗口：拉取捕获窗落库的变更
  noteStore.syncFromRemote()
}

// ====== 中栏：列表 ======
const query = ref('')
const listRef = ref<HTMLElement | null>(null)
const entrance = useCardEntrance(listRef, '.np-item')

const activeNotes = computed(() => noteStore.notes)

// ====== 全文检索（标题 + 正文纯文本 + 标签名，CJK 双字倒排 + ASCII 子串）======
const searchIndex = createBigramIndex()

const searchableText = (n: Note) => {
  const tagNames = n.tagIds
    .map(id => noteStore.tags.find(t => t.id === id)?.name)
    .filter(Boolean)
    .join(' ')
  return `${n.title}\n${getMdPlainText(n.content)}\n${tagNames}`
}

// 数据版本号：笔记或标签变化时重建索引（个人规模下全量重建为毫秒级）
const searchVersion = computed(() =>
  noteStore.notes.map(n => `${n.id}:${n.updatedAt}`).join('|') +
  '|' + noteStore.trashedNotes.map(n => `${n.id}:${n.updatedAt}`).join('|') +
  '|' + noteStore.tags.map(t => `${t.id}:${t.name}`).join('|')
)

watch(searchVersion, () => {
  searchIndex.reset()
  for (const n of noteStore.notes) searchIndex.setDoc(n.id, searchableText(n))
  for (const n of noteStore.trashedNotes) searchIndex.setDoc(n.id, searchableText(n))
}, { immediate: true })

// 当前视图聚合的标签 id 集合：父标签 = 自身 + 全部后代（按路径前缀匹配）；
// 笔记只归属实际被打的标签，聚合仅在查看时展开
const activeTagIds = computed<string[] | null>(() => {
  const view = currentView.value
  if (view === 'all' || view === 'today' || view === 'favorites' || view === 'trash') return null
  let path: string
  if (view.startsWith('v:')) {
    path = view.slice(2)
  } else {
    const tag = noteStore.tags.find(t => t.id === view)
    if (!tag) return null
    path = tag.name
  }
  return noteStore.tags
    .filter(t => t.name === path || t.name.startsWith(path + '/'))
    .map(t => t.id)
})

const notesForView = computed(() => {
  const view = currentView.value
  if (view === 'today') {
    const today = dayjs().format('YYYY-MM-DD')
    return noteStore.notes.filter(n => n.title === today)
  }
  if (view === 'favorites') return noteStore.notes.filter(n => n.pinned)
  if (view === 'trash') return noteStore.trashedNotes
  const ids = activeTagIds.value
  if (!ids) return noteStore.notes
  const idSet = new Set(ids)
  return noteStore.notes.filter(n => n.tagIds.some(id => idSet.has(id)))
})

const visibleNotes = computed(() => {
  let list = notesForView.value
  const q = query.value.trim()
  if (q) {
    // 依赖 searchVersion：数据变化时本计算属性随之失效重建
    void searchVersion.value
    const hits = new Set(searchIndex.search(q))
    list = list.filter(n => hits.has(n.id))
  }
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt.localeCompare(a.updatedAt)
  })
})

const viewCount = (view: string) => {
  if (view === 'favorites') return noteStore.notes.filter(n => n.pinned).length
  if (view === 'today') {
    const today = dayjs().format('YYYY-MM-DD')
    return noteStore.notes.filter(n => n.title === today).length
  }
  if (view === 'trash') return noteStore.trashedNotes.length
  return noteStore.notes.length
}

const excerpt = (note: Note) => {
  const text = getMdPlainText(note.content)
  return text.slice(0, 60) || '（空白笔记）'
}

const itemTags = (note: Note) =>
  note.tagIds
    .map(id => noteStore.tags.find(t => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .slice(0, 3)

const shortTagName = (name: string) => name.split('/').pop() || name

const timeText = (dt?: string) => {
  if (!dt) return ''
  const d = dayjs(dt)
  const diffMin = dayjs().diff(d, 'minute')
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  const diffDay = Math.floor(diffMin / 60 / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return d.format('M月D日')
}

const emptyText = computed(() => {
  const view = currentView.value
  if (query.value.trim()) return '没有匹配的笔记'
  if (view === 'today') return '今日还没有笔记'
  if (view === 'favorites') return '暂无收藏'
  if (view === 'trash') return '回收站是空的'
  if (view === 'all') return '还没有笔记'
  return '此标签下暂无笔记'
})
const emptySub = computed(() => {
  if (query.value.trim()) return '换个关键词试试'
  if (currentView.value === 'trash') return '删除的笔记将在这里保留 30 天'
  return '点击右上角 + 新建'
})

// ====== 右栏：编辑器 ======
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const titleDraft = ref('')

watch(selectedId, (id) => {
  titleDraft.value = id ? (selectedNote.value?.title || '') : ''
})

const onTitleInput = () => {
  // 同步到 NoteEditor 内部标题，保存时一并落库（自动保存在阶段 4 接入）
  editorRef.value?.setNoteTitle(titleDraft.value)
}

// ====== 属性栏：标签 ======
const noteTags = computed<Tag[]>(() => {
  const note = selectedNote.value
  if (!note) return []
  return note.tagIds
    .map(id => noteStore.tags.find(t => t.id === id))
    .filter((t): t is Tag => !!t)
})

const attachTag = async (tag: Tag) => {
  const note = selectedNote.value
  if (!note) return
  if (note.tagIds.includes(tag.id)) {
    tagPickerOpen.value = false
    return
  }
  await noteStore.updateNote(note.id, { tagIds: [...note.tagIds, tag.id] })
  tagPickerOpen.value = false
  tagQuery.value = ''
}

const detachTag = async (tag: Tag) => {
  const note = selectedNote.value
  if (!note) return
  await noteStore.updateNote(note.id, { tagIds: note.tagIds.filter(id => id !== tag.id) })
}

// —— 标签选择器（联想已有标签 / 输入即建新标签，支持 / 层级）——
const tagPickerOpen = ref(false)
const tagQuery = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)
const sugIndex = ref(0)

const openTagPicker = () => {
  tagPickerOpen.value = true
  tagQuery.value = ''
  sugIndex.value = 0
  nextTick(() => tagInputRef.value?.focus())
}

watch(selectedId, () => {
  tagPickerOpen.value = false
  tagQuery.value = ''
})

type TagSuggestion =
  | { kind: 'existing'; tag: Tag; label: string; count: number }
  | { kind: 'create'; label: string }

const tagSuggestions = computed<TagSuggestion[]>(() => {
  const q = tagQuery.value.trim().replace(/^#/, '').toLowerCase()
  const attached = new Set(selectedNote.value?.tagIds || [])
  const matches: TagSuggestion[] = noteStore.tags
    .filter(t => !attached.has(t.id) && (!q || t.name.toLowerCase().includes(q)))
    .slice(0, 8)
    .map(t => ({
      kind: 'existing',
      tag: t,
      label: t.name,
      count: noteStore.notes.filter(n => n.tagIds.includes(t.id)).length,
    }))
  const exact = noteStore.tags.some(t => t.name.toLowerCase() === q)
  const createEntry: TagSuggestion[] = q && !exact ? [{ kind: 'create', label: q }] : []
  return [...matches, ...createEntry]
})

watch(tagQuery, () => { sugIndex.value = 0 })

const applySuggestion = async (s: TagSuggestion) => {
  if (s.kind === 'existing') {
    await attachTag(s.tag)
    return
  }
  const t = await noteStore.addTag({ name: s.label })
  if (t) await attachTag(t)
  else ElMessage.error('创建标签失败')
}

const onTagKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    sugIndex.value = Math.min(sugIndex.value + 1, tagSuggestions.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    sugIndex.value = Math.max(sugIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const s = tagSuggestions.value[sugIndex.value]
    if (s) applySuggestion(s)
  }
}

// —— 标签表单（左栏新建/编辑）——
const tagFormVisible = ref(false)
const editingTag = ref<Tag | null>(null)

const openCreateTag = () => {
  editingTag.value = null
  tagFormVisible.value = true
}

const openEditTag = (tag: Tag) => {
  editingTag.value = tag
  tagFormVisible.value = true
}

const handleTagFormSubmit = async (data: { id?: string; name: string; color: string }) => {
  if (data.id) {
    const ok = await noteStore.updateTag(data.id, { name: data.name, color: data.color })
    if (!ok) {
      ElMessage.error('保存失败：标签名称与其他标签冲突')
      return
    }
    ElMessage.success('标签已保存')
  } else {
    const t = await noteStore.addTag({ name: data.name, color: data.color })
    if (!t) {
      ElMessage.error('创建标签失败')
      return
    }
    ElMessage.success('标签已创建')
  }
  tagFormVisible.value = false
}

const showTagDeleteConfirm = ref(false)
const deletingTag = ref<Tag | null>(null)
const deletingTagName = computed(() => deletingTag.value?.name || '')

const handleTagDelete = (tag: Tag) => {
  deletingTag.value = tag
  showTagDeleteConfirm.value = true
}

const onTagDeleteConfirmed = async () => {
  const tag = deletingTag.value
  if (!tag) return
  const ok = await noteStore.deleteTag(tag.id)
  if (ok) {
    ElMessage.success('标签已删除')
    const view = currentView.value
    if (view === tag.id || view === 'v:' + tag.name) setView('all')
  }
  showTagDeleteConfirm.value = false
  tagFormVisible.value = false
  deletingTag.value = null
}

// ====== wiki-link：链接解析与反向链接索引 ======
// 目标按标题解析（同名取最近更新）；回收站中的笔记不可作为链接目标
const linkIndex = computed(() => {
  const byTitle = new Map<string, Note>()
  const sorted = [...noteStore.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  for (const n of sorted) {
    const key = n.title.trim().toLowerCase()
    if (key && !byTitle.has(key)) byTitle.set(key, n)
  }
  const resolve = (target: string): Note | null => byTitle.get(target.trim().toLowerCase()) ?? null

  const backlinks = new Map<string, Note[]>()
  for (const n of noteStore.notes) {
    for (const ref of extractWikiLinks(n.content)) {
      const resolved = resolve(ref.target)
      if (!resolved || resolved.id === n.id) continue
      const list = backlinks.get(resolved.id) ?? []
      if (!list.some(x => x.id === n.id)) list.push(n)
      backlinks.set(resolved.id, list)
    }
  }
  return { resolve, backlinks }
})

const currentBacklinks = computed(() => {
  const note = selectedNote.value
  if (!note) return [] as { note: Note; snippet: string }[]
  const titleKey = note.title.trim().toLowerCase()
  if (!titleKey) return []
  return (linkIndex.value.backlinks.get(note.id) ?? []).map(src => {
    const line = src.content
      .split('\n')
      .find(l => extractWikiLinks(l).some(t => t.target.toLowerCase() === titleKey))
    return { note: src, snippet: (line || '').trim().slice(0, 60) }
  })
})

const openWikiLink = async (p: { target: string }) => {
  const resolved = linkIndex.value.resolve(p.target)
  if (resolved) {
    pageNav.setNavPath(['notes', currentView.value, resolved.id])
    return
  }
  // 未解析的链接：以链接目标为标题创建新笔记并打开
  const tagIds = RESERVED_VIEWS.includes(currentView.value) ? [] : [currentView.value]
  const note = await noteStore.addNote({ title: p.target, content: '', tagIds, pinned: false })
  if (note) {
    ElMessage.success(`已创建「${p.target}」`)
    pageNav.setNavPath(['notes', currentView.value, note.id])
    entrance.play()
  }
}

// 反链面板由编辑器状态栏按钮控制展开与收起
const backlinksOpen = ref(false)

// 源码 / 所见即所得模式（会话内记忆）
const editorSourceMode = ref(false)

// ====== 导出 ======
const exporting = ref(false)

const handleExportCommand = async (cmd: string | number | object) => {
  const note = selectedNote.value
  if (!note || exporting.value) return
  if (cmd === 'md') {
    exportNoteMarkdown(note, noteTags.value)
    ElMessage.success('Markdown 已导出')
    return
  }
  if (cmd !== 'png') return
  exporting.value = true
  try {
    if (editorSourceMode.value) {
      // 长图基于渲染态 DOM：源码模式下先切回富文本
      editorSourceMode.value = false
      await nextTick()
    }
    const el = await waitForProseMirror()
    if (!el) throw new Error('编辑器尚未就绪')
    await exportNoteImage(el, note.title)
    ElMessage.success('长图已导出')
  } catch (e) {
    logger.error('[笔记] 长图导出失败', { error: e instanceof Error ? e.message : String(e) })
    ElMessage.error('长图导出失败')
  } finally {
    exporting.value = false
  }
}

// 等待 Milkdown 渲染完成（源码模式切回后编辑器异步重建）
const waitForProseMirror = async (): Promise<HTMLElement | null> => {
  for (let i = 0; i < 30; i++) {
    const el = document.querySelector<HTMLElement>('.md-editor .ProseMirror')
    if (el && el.innerHTML.trim()) return el
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return null
}

// 自动保存回写（NoteEditor 防抖 800ms 或切换/卸载前强刷触发）；
// 不再传 categoryId——标签改动只经属性栏的 tagIds 路径，避免互相覆盖
const handleEditorSave = async (data: { id: string; title: string; content: string; pinned: boolean }) => {
  const ok = await noteStore.updateNote(data.id, {
    title: data.title,
    content: data.content,
    pinned: data.pinned,
  })
  if (!ok) logger.error('[笔记] 自动保存失败', { id: data.id })
}

const createNote = async () => {
  const tagIds = RESERVED_VIEWS.includes(currentView.value) ? [] : [currentView.value]
  const note = await noteStore.addNote({ title: '新笔记', content: '', tagIds, pinned: false })
  if (!note) return
  pageNav.setNavPath(['notes', currentView.value, note.id])
  titleDraft.value = note.title
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
  entrance.play()
}

// ====== 每日笔记：标题为当天日期的普通笔记 + 系统标签「每日」 ======
const DAILY_TAG_NAME = '每日'

const createDailyNote = async () => {
  const today = dayjs().format('YYYY-MM-DD')
  const existing = noteStore.notes.find(n => n.title === today)
  if (existing) {
    openNote(existing.id)
    return
  }
  // 「每日」标签不存在时自动创建（addTag 同名幂等）
  const tag = await noteStore.addTag({ name: DAILY_TAG_NAME })
  const note = await noteStore.addNote({ title: today, content: '', tagIds: tag ? [tag.id] : [], pinned: false })
  if (note) {
    ElMessage.success('已创建今日笔记')
    openNote(note.id)
    entrance.play()
  }
}

const togglePin = async (note: Note) => {
  await noteStore.togglePin(note.id)
}

// 回收站中的笔记不可打开编辑，仅可恢复/彻底删除
const onItemClick = (note: Note) => {
  if (currentView.value !== 'trash') openNote(note.id)
}

// ====== 删除 / 回收站 ======
const showDeleteConfirm = ref(false)
const deletingId = ref<string | null>(null)
const deletingTitle = ref('')
const deletingFromTrash = ref(false)

const askDeleteNote = (note: Note) => {
  deletingId.value = note.id
  deletingTitle.value = note.title || '新笔记'
  deletingFromTrash.value = currentView.value === 'trash'
  showDeleteConfirm.value = true
}

const onDeleteConfirmed = async () => {
  if (!deletingId.value) return
  if (deletingFromTrash.value) {
    const ok = await noteStore.deleteNote(deletingId.value)
    if (ok) ElMessage.success('已彻底删除')
  } else {
    const ok = await noteStore.trashNote(deletingId.value)
    if (ok) {
      ElMessage.success('已移入回收站')
      entrance.play()
    }
  }
  deletingId.value = null
}

const restoreNoteFromTrash = async (note: Note) => {
  const ok = await noteStore.restoreNote(note.id)
  if (ok) {
    ElMessage.success('已恢复')
    entrance.play()
  }
}

// ====== 清空回收站 ======
const showEmptyTrashConfirm = ref(false)

const askEmptyTrash = () => {
  if (noteStore.trashedNotes.length === 0) return
  showEmptyTrashConfirm.value = true
}

const onEmptyTrashConfirmed = async () => {
  const count = await noteStore.emptyTrash()
  ElMessage.success(`已清空 ${count} 篇笔记`)
  entrance.play()
}

// ====== 初始化 ======
const initNavPath = async () => {
  const path = pageNav.navPath.value
  if (path.length > 1 && path[0] === 'notes') return
  const restored = await restoreModuleNavPath('notes')
  pageNav.setNavPath(restored)
}

onMounted(async () => {
  emit('fullscreen-change', fullscreenEdit.value)
  await noteStore.loadData()
  await initNavPath()
  // 进入笔记页与窗口重新聚焦时同步云端变更，接收其他客户端的笔记更新
  noteStore.syncFromRemote()
  window.addEventListener('focus', onWindowFocus)
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
  await nextTick()
  entrance.play()
  logger.info('[笔记] 三栏页面已挂载', { notes: noteStore.notes.length, tags: noteStore.tags.length })
})

onBeforeUnmount(() => {
  emit('fullscreen-change', false)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('focus', onWindowFocus)
})

// 视图切换 / 笔记增删时重放列表进场动效（遵循全局 reduced-motion 约定）
watch([currentView, () => noteStore.notes.length], () => {
  nextTick(() => entrance.play())
})
</script>

<style scoped>
/* 宽屏：双侧栏可收起（窄屏沿用抽屉交互） */
@media (min-width: 1100px) {
  .np-nav,
  .np-list {
    transition: width 0.2s ease, margin 0.2s ease, opacity 0.18s ease;
  }
  .notes-page.fs-edit { gap: 0; }
  /* 全屏编辑：两个侧边栏移除，只显示编辑器内容 */
  .notes-page.fs-edit .np-nav,
  .notes-page.fs-edit .np-list {
    display: none;
  }
}

.notes-page {
  position: relative;
  display: flex;
  gap: 12px;
  height: 100%;
  padding: 16px;
  overflow: hidden;
}

/* ====== 左栏：导航 ====== */
.np-nav {
  position: relative;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 220px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: visible;
}










.np-nav-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.np-nav-scroll::-webkit-scrollbar { width: 5px; }
.np-nav-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.np-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 2px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--chalk-white-70);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  text-align: left;
}

.np-nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--chalk-white-90);
}

.np-nav-item.active {
  background: rgba(102, 126, 234, 0.18);
  color: #93c5fd;
}

.np-nav-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-nav-count {
  font-size: 11px;
  color: var(--chalk-dim);
  font-variant-numeric: tabular-nums;
}

.np-nav-item.active .np-nav-count {
  color: rgba(147, 197, 253, 0.7);
}

.np-nav-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px 6px;
  font-size: 11px;
  color: var(--chalk-dim);
  letter-spacing: 1px;
}

.np-label-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--chalk-dim);
  cursor: pointer;
  font-size: 12px;
  letter-spacing: 0;
  transition: all 0.15s;
}

.np-label-add:hover {
  background: rgba(102, 126, 234, 0.2);
  color: #93c5fd;
}

.np-nav-tree {
  padding: 0 4px;
}

.np-drawer-mask {
  display: none;
}

/* ====== 中栏：列表 ====== */
.np-list {
  display: flex;
  flex-direction: column;
  width: 300px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
}

.np-list-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.np-nav-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.np-nav-toggle:hover {
  background: rgba(102, 126, 234, 0.15);
  color: #93c5fd;
}

.np-search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--chalk-dim);
  transition: border-color 0.2s;
}

.np-search:focus-within {
  border-color: rgba(102, 126, 234, 0.5);
}

.np-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--chalk-white-90);
  font-size: 13px;
  font-family: inherit;
}

.np-search input::placeholder {
  color: var(--chalk-dim);
}

.np-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 8px;
  background: rgba(102, 126, 234, 0.2);
  color: #93c5fd;
  cursor: pointer;
  transition: all 0.2s;
}

.np-add-btn:hover {
  background: rgba(102, 126, 234, 0.35);
  color: var(--chalk-white);
}

.np-empty-trash {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 5px 10px;
  border: 1px solid rgba(245, 108, 108, 0.35);
  border-radius: 8px;
  background: rgba(245, 108, 108, 0.08);
  color: var(--chalk-red);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.np-empty-trash:hover {
  background: rgba(245, 108, 108, 0.18);
  border-color: rgba(245, 108, 108, 0.6);
}

.np-list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.np-list-scroll::-webkit-scrollbar { width: 5px; }
.np-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.np-item {
  position: relative;
  display: block;
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
}

.np-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.np-item.active {
  background: rgba(102, 126, 234, 0.14);
  border-color: rgba(102, 126, 234, 0.35);
}

.np-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.np-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: var(--chalk-white-90);
}

.np-item.active .np-item-title {
  color: #93c5fd;
}

.np-item-pin {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--chalk-amber);
}

.np-item-actions {
  display: none;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.np-item:hover .np-item-actions {
  display: inline-flex;
}

.np-item:hover .np-item-pin {
  display: none;
}

.np-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.np-item-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.np-item-btn.on {
  color: var(--chalk-amber);
}

.np-item-btn.danger:hover {
  background: rgba(245, 108, 108, 0.18);
  color: var(--chalk-red);
}

.np-item-excerpt {
  margin-top: 4px;
  font-size: 12px;
  color: var(--chalk-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  min-width: 0;
}

.np-item-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.np-item-tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1.5;
  opacity: 0.85;
}

.np-item-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--chalk-dim);
}

.np-empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--chalk-muted);
  font-size: 13px;
}

.np-empty-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--chalk-dim);
}

/* ====== 右栏：编辑器 ====== */
.np-editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.np-editor-main {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}

.np-editor-col {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ====== 反向链接面板 ====== */
.np-backlinks {
  display: flex;
  flex-direction: column;
  width: 240px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
}

.np-bl-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.np-bl-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: var(--chalk-muted);
  letter-spacing: 1px;
}

.np-bl-count {
  font-size: 11px;
  color: #93c5fd;
  font-variant-numeric: tabular-nums;
}

.np-bl-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--chalk-dim);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}

.np-bl-close:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--chalk-white-90);
}

.np-bl-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.np-bl-list::-webkit-scrollbar { width: 5px; }
.np-bl-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.np-bl-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}

.np-bl-item:hover {
  background: rgba(102, 126, 234, 0.12);
  border-color: rgba(102, 126, 234, 0.3);
}

.np-bl-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--chalk-white-90);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-bl-item:hover .np-bl-item-title {
  color: #93c5fd;
}

.np-bl-snippet {
  font-size: 11px;
  color: var(--chalk-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-bl-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--chalk-muted);
  font-size: 12px;
}

.np-bl-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--chalk-dim);
}

.np-editor-head {
  padding: 4px 16px 10px;
}

.np-title-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--chalk-white-95);
  font-size: 20px;
  font-weight: 700;
  font-family: inherit;
  padding: 6px 4px;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.np-title-input:focus {
  border-bottom-color: rgba(102, 126, 234, 0.4);
}

.np-title-input::placeholder {
  color: var(--chalk-dim);
}

/* ====== 属性栏：标签 ====== */
.np-props {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 2px;
  padding: 0 4px;
}

.np-props-tags {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.np-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 2px 8px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.5;
  opacity: 0.9;
}

.np-tag-x {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 9px;
  opacity: 0.6;
  transition: all 0.15s;
}

.np-tag-x:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}

.np-tag-add {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: transparent;
  color: var(--chalk-muted);
  font-size: 11px;
  line-height: 1.5;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.np-tag-add:hover {
  border-color: rgba(102, 126, 234, 0.5);
  color: #93c5fd;
}

.np-tag-picker {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 45;
  width: 260px;
  padding: 8px;
  background: rgba(23, 22, 48, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.np-tag-input {
  width: 100%;
  padding: 6px 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  outline: none;
  background: rgba(255, 255, 255, 0.04);
  color: var(--chalk-white-90);
  font-size: 12px;
  font-family: inherit;
}

.np-tag-input:focus {
  border-color: rgba(102, 126, 234, 0.5);
}

.np-tag-input::placeholder {
  color: var(--chalk-dim);
}

.np-tag-sugs {
  margin-top: 6px;
  max-height: 220px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.np-tag-sug {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--chalk-white-75);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.1s;
}

.np-tag-sug.hl {
  background: rgba(102, 126, 234, 0.18);
  color: #93c5fd;
}

.np-tag-sug-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.np-tag-sug-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-tag-sug-sub {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--chalk-dim);
}

.np-tag-sug-empty {
  padding: 8px;
  font-size: 11px;
  color: var(--chalk-dim);
}

.np-editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--chalk-dim);
  font-size: 14px;
}

.np-empty-icon {
  font-size: 40px;
  color: rgba(255, 255, 255, 0.12);
}

.np-empty-create {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 18px;
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 8px;
  background: rgba(102, 126, 234, 0.18);
  color: #93c5fd;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.np-empty-create:hover {
  background: rgba(102, 126, 234, 0.32);
  color: var(--chalk-white);
}

/* ====== 通用过渡 ====== */
.np-fade-enter-active,
.np-fade-leave-active {
  transition: opacity 0.15s ease;
}

.np-fade-enter-from,
.np-fade-leave-to {
  opacity: 0;
}

/* ====== 窄屏降级 ====== */
/* < 1100px：左栏收起为抽屉，由列表头部的导航按钮呼出 */
@media (max-width: 1099px) {
  .np-nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 60;
    border-radius: 0 12px 12px 0;
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    background: rgba(20, 18, 44, 0.98);
  }

  .np-nav.drawer-open {
    transform: translateX(0);
  }

  .np-drawer-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(0, 0, 0, 0.45);
  }

  .np-nav-toggle {
    display: flex;
  }

  .np-list {
    width: 280px;
  }
}

/* < 900px：列表优先，编辑器整屏下钻（小米笔记/锤子便签式） */
@media (max-width: 899px) {
  .notes-page {
    padding: 10px;
    gap: 10px;
  }

  .np-list {
    width: 100%;
  }

  .np-editor {
    display: none;
  }

  /* 选中笔记：编辑器整屏覆盖列表 */
  .np-editor.editor-open {
    display: flex;
    position: absolute;
    inset: 0;
    z-index: 40;
    padding: 10px;
    background: #0f0c29;
    overflow-y: auto;
  }
}
</style>
