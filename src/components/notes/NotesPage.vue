<template>
  <div
    class="notes-page"
    :class="{ 'fs-edit': fullscreenEdit }"
    @contextmenu.prevent
  >
    <!-- ====== 左栏：导航 ====== -->
    <aside class="np-nav" :class="{ 'drawer-open': navDrawerOpen }">

      <nav class="np-nav-scroll">
        <button class="np-nav-item" :class="{ active: currentView === 'all' }" @click="setView('all')">
          <el-icon><Files /></el-icon>
          <span class="np-nav-name">全部笔记</span>
          <span class="np-nav-count">{{ activeNotes.length }}</span>
        </button>
        <button class="np-nav-item np-nav-item-temp" :class="{ active: currentView === 'temp' }" @click="setView('temp')" :title="'临时笔记：直接编辑本地 .md 文件（不存入笔记库）'">
          <el-icon><FileText /></el-icon>
          <span class="np-nav-name">临时笔记</span>
          <span class="np-nav-count">{{ tempNotes.length }}</span>
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
        <button v-else-if="currentView === 'temp'" class="np-add-btn np-temp-add" title="打开 .md 文件（原地编辑，不复制进笔记库）" @click="addTempNoteFromDialog">
          <el-icon><FilePlus2 /></el-icon>
        </button>
        <button v-else class="np-add-btn" title="新建笔记" @click="createNote">
          <el-icon><Plus /></el-icon>
        </button>
      </div>

      <div
        ref="listRef"
        class="np-list-scroll"
        :style="{ '--np-card-cols': String(cardCols), '--np-card-gap': `${CARD_GAP}px` }"
      >
        <button
          v-for="note in visibleNotes"
          :key="note.id"
          class="np-item"
          :class="{ active: note.id === selectedId, 'is-temp': currentView === 'temp' }"
          @click="onItemClick(note)"
        >
          <div class="np-item-top">
            <span class="np-item-title">
              <span v-if="currentView === 'temp'" class="np-item-badge">临时</span>
              {{ note.title || '新笔记' }}
            </span>
            <span class="np-item-actions" @click.stop>
              <template v-if="currentView === 'trash'">
                <button class="np-item-btn" title="恢复笔记" @click="restoreNoteFromTrash(note)">
                  <el-icon><RotateCcw /></el-icon>
                </button>
                <button class="np-item-btn danger" title="彻底删除" @click="askDeleteNote(note)">
                  <el-icon><Trash2 /></el-icon>
                </button>
              </template>
              <template v-else-if="currentView === 'temp'">
                <!--
                  用户要求：删除临时笔记卡片上的「重新从磁盘读取」按钮。
                  外部改动现在由 NotesPage 的自动轮询 + 窗口聚焦自动重读处理
                  （见 checkTempNoteExternalChange），不再需要手动按钮。
                  这里只保留「从列表移除」（不删除源文件）。
                -->
                <button class="np-item-btn danger" title="从列表移除（不删除源文件）" @click="askRemoveTempNote(note)">
                  <el-icon><X /></el-icon>
                </button>
              </template>
              <template v-else>
                <button class="np-item-btn" title="编辑笔记" @click.stop="openNote(note.id)">
                  <el-icon><Pencil /></el-icon>
                </button>
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
              <span v-if="currentView === 'temp'" class="np-item-path" :title="tempFilePath(note.id)">{{ tempFilePath(note.id) }}</span>
            </span>
            <span class="np-item-time">{{ timeText(note.updatedAt) }}</span>
          </div>
        </button>

        <div v-if="visibleNotes.length === 0" class="np-empty">
          <p>{{ emptyText }}</p>
          <p class="np-empty-sub">{{ emptySub }}</p>
        </div>
      </div>
    </section>

    <!-- ====== 右栏：编辑器 ====== -->
    <section class="np-editor" :class="{ 'editor-open': !!selectedNote }">
      <template v-if="selectedNote">
        <div class="np-editor-main">
          <!-- 标题 + 文件路径/标签：同一行显示（head 用 flex 横向排列） -->
          <div class="np-editor-head">
          <!--
            返回列表：用户要求「点击笔记卡片进入编辑页面，全屏显示」，
            因此编辑页是全屏覆盖层，需要一个明确的返回入口（否则只能靠 Esc/点卡片）。
          -->
          <button
            type="button"
            class="np-editor-back"
            title="返回列表 (Esc)"
            @click="closeEditor"
          >
            <el-icon><ArrowLeft /></el-icon>
            <span>返回</span>
          </button>
          <input
            ref="titleInputRef"
            v-model="titleDraft"
            class="np-title-input"
            :readonly="isTempNote"
            :title="isTempNote ? '临时笔记的标题取自文件名，不可修改' : ''"
            placeholder="无标题"
            @input="onTitleInput"
          />
          <!-- 临时笔记：没有标签概念，改为显示来源文件，提示保存位置 -->
          <div v-if="isTempNote" class="np-props np-props-temp">
            <span class="np-temp-file" :title="selectedTempNote?.filePath || ''">
              <el-icon><FileCode2 /></el-icon>
              <span class="np-temp-file-path">{{ selectedTempNote?.filePath || '' }}</span>
            </span>
            <span class="np-temp-hint">原地保存</span>
          </div>
          <!-- 属性栏：标签 -->
          <div v-else class="np-props">
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

        <!-- 编辑主体：菜单栏起、状态栏止——反向链接面板与编辑器组件同高，上下边界自动对齐 -->
        <div class="np-editor-body">
        <NoteEditor
          ref="editorRef"
          :fullscreen-edit="fullscreenEdit"
          @toggle-fullscreen-edit="fullscreenEdit = !fullscreenEdit"
          :note="selectedNote"
          :source-mode="editorSourceMode"
          :temp-file-path="selectedTempNote?.filePath || ''"
          :temp-note-id="selectedTempNote?.id || ''"
          :note-titles="linkableNoteTitles"
          @toggle-pin="selectedNote && togglePin(selectedNote)"
          @toggle-source-mode="editorSourceMode = !editorSourceMode"
          @export="handleExportCommand"
          @open-wiki-link="openWikiLink"
          @save="handleEditorSave"
        />
        </div>
        </div>
      </template>
      <!--
        用户要求（本节第 1 项）：「右边这块新建笔记区域就不要了」。
        即列表视图下**不再显示**「在左侧选择一篇笔记，或开始新的一篇 / 新建笔记」
        这个占位区；列表区因此独占整行宽度（卡片网格按可用宽度排 1~3 列）。
        新建笔记入口仍保留在列表头部的「+」按钮（.np-add-btn）以及 Ctrl+N。
      -->
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

    <!-- 移除临时笔记：用项目通用确认弹窗（替代 ElMessageBox / Electron 原生弹窗） -->
    <ConfirmDialog
      v-model="removeTempNoteVisible"
      title="移除临时笔记"
      :message="`「${removingTempNote?.title || ''}」只是从列表移除，磁盘上的 .md 文件不会被删除。`"
      @confirm="onRemoveTempNoteConfirmed"
    />

    <!-- 打开临时笔记：应用内文件选择弹窗（替代 Electron 原生文件框） -->
    <FilePickerDialog
      v-model:visible="tempFilePickerVisible"
      title="打开 Markdown 文件"
      :extensions="['md', 'markdown']"
      @confirm="onFilePickerConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, inject } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Files, Star, Trash2, Pencil,
  Plus, Search, PanelLeft, X, RotateCcw,
  FileText, FilePlus2, FileCode2, ArrowLeft
} from '@lucide/vue'
import NoteEditor from './NoteEditor.vue'
import TagTree from './TagTree.vue'
import TagForm from './TagForm.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import FilePickerDialog from './FilePickerDialog.vue'
import { useNoteStore, getMdPlainText, type Note, type Tag } from '../../stores/noteStore'
import { useTempNoteStore } from '../../stores/tempNoteStore'
import { createBigramIndex } from '../../utils/bigramSearch'
import { extractWikiLinks } from '../editor/wikiLink'
import { exportNoteMarkdown } from '../../utils/noteExport'
import { exportNoteHtml } from '../../utils/noteExportHtml'
import { comboFromEvent } from '../../stores/shortcutStore'
import { usePageNav, restoreModuleNavPath } from '../../composables/usePageNav'
import { useCardEntrance } from '../../composables/useMotion'
import dayjs from 'dayjs'
import { logger } from '../../lib/logger'

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const pageNav = usePageNav()
const noteStore = useNoteStore()
const tempNoteStore = useTempNoteStore()
const guideRunning = inject('guideRunning', ref(false))

// ====== 视图状态（navPath: ['notes', view] / ['notes', view, noteId]）======
// view ∈ 'all' | 'temp' | 'favorites' | 'trash' | 标签id
// 旧导航路径中的分类 ID 与默认标签 ID 相同，因此仍可直接解析。
const RESERVED_VIEWS = ['all', 'temp', 'favorites', 'trash']

/** 临时笔记（直接编辑外部 .md 文件）列表，用于导航计数与视图渲染 */
const tempNotes = computed(() =>
  [...tempNoteStore.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
)

/**
 * 把临时笔记映射成列表/编辑器可用的 Note 形状。
 * 临时笔记没有标签/收藏/回收站概念，这些字段给空值；id 前缀 tmp: 便于识别来源。
 */
const tempNotesAsNotes = computed<Note[]>(() =>
  tempNotes.value.map(t => ({
    id: t.id,
    title: t.title,
    content: t.content,
    tagIds: [],
    pinned: false,
    trashedAt: null,
    createdAt: t.updatedAt,
    updatedAt: t.updatedAt,
    categoryId: '',
  }))
)

/** 当前选中的是否是临时笔记 */
const isTempNote = computed(() => currentView.value === 'temp')

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
  const id = navPath.value[2]
  if (isTempNote.value) return tempNotesAsNotes.value.find(n => n.id === id) || null
  return noteStore.notes.find(n => n.id === id) || null
})
const selectedId = computed(() => selectedNote.value?.id || null)

/** 选中的临时笔记（含真实文件路径等元数据） */
const selectedTempNote = computed(() =>
  isTempNote.value ? tempNotes.value.find(n => n.id === navPath.value[2]) || null : null
)

const setView = (view: string) => {
  moduleMenuOpen.value = false
  navDrawerOpen.value = false
  if (currentView.value === view && navPath.value.length <= 2) return
  pageNav.setNavPath(['notes', view])
}

const openNote = (id: string) => {
  pageNav.setNavPath(['notes', currentView.value, id])
}

/**
 * 关闭编辑器、回到列表。
 *
 * 用户要求「点击笔记卡片进入编辑页面，全屏显示」，因此编辑页是**全屏覆盖层**；
 * 返回列表 = 把导航路径退回视图层（去掉笔记 id），并退出全屏编辑。
 */
const closeEditor = () => {
  if (fullscreenEdit.value) fullscreenEdit.value = false
  pageNav.setNavPath(['notes', currentView.value])
}

// navPath 指向不存在的笔记时回退（如笔记已被删除 / 临时笔记文件已被移走）
watch(navPath, () => {
  const path = pageNav.navPath.value
  if (path[0] !== 'notes') return
  if (path.length >= 3) {
    const exists = path[1] === 'temp'
      ? tempNotes.value.some(n => n.id === path[2])
      : noteStore.notes.some(n => n.id === path[2])
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

  // ====== 全屏编辑（隐藏两个侧边栏，只留编辑器内容；状态上报 App 隐藏全局导航） ======
  const fullscreenEdit = ref(false)
  watch(fullscreenEdit, (v) => emit('fullscreen-change', v))

  /*
    ⚠️ 全屏状态与「是否选中笔记」绑定。

    用户要求：「点击笔记卡片进入笔记编辑页面，全屏显示」——
    即选中笔记时自动进入全屏（隐藏全局导航与两个侧栏），返回列表时退出全屏。

    这条 watch 同时解决了上一轮报告的
    「未全屏时区域显示成全屏大小」（状态残留）：
    现在全屏状态**由 selectedNote 派生**，不再是一个只由按钮切换、
    可以长期滞留的独立 ref。
  */
  watch(
    () => !!selectedNote.value,
    (hasNote) => {
      if (hasNote) {
        // 打开笔记 → 全屏编辑
        if (!fullscreenEdit.value) fullscreenEdit.value = true
      } else {
        // 回到列表 → 退出全屏
        if (fullscreenEdit.value) fullscreenEdit.value = false
      }
    },
    { immediate: true },
  )



const onDocClick = () => {
  moduleMenuOpen.value = false
  tagPickerOpen.value = false
}

/**
 * 笔记页的两个固定快捷键。
 *
 * 用户在本轮要求从「快捷键设置」里删除「新建笔记」与「标签选择器」两项，
 * 但这两个功能本身要保留，因此改用**固定组合键**（不再出现在快捷键中心、
 * 不参与改键与冲突检测）：Ctrl+N 新建笔记、Ctrl+Shift+T 标签选择器。
 * 注意不能继续用 comboFor('newNote')——那两个 action 已被移除，
 * comboFor 会返回空串，导致按键静默失效。
 */
const FIXED_NEW_NOTE_COMBO = 'Ctrl+N'
const FIXED_TAG_PICKER_COMBO = 'Ctrl+Shift+T'

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    // 优先关闭页面级浮层；它们都关着时才用 Esc 退出全屏编辑（返回列表）。
    // 注意不能无条件关编辑页：编辑器内部的搜索/替换栏也用 Esc，
    // 若在这里抢先退出全屏，用户按 Esc 关搜索会连带把编辑页关掉。
    const hadPopup = moduleMenuOpen.value || navDrawerOpen.value || tagPickerOpen.value
    moduleMenuOpen.value = false
    navDrawerOpen.value = false
    tagPickerOpen.value = false
    if (!hadPopup && selectedNote.value) closeEditor()
    return
  }
  const combo = comboFromEvent(e)
  if (!combo) return
  if (combo === FIXED_TAG_PICKER_COMBO) {
    if (!selectedNote.value) return
    e.preventDefault()
    openTagPicker()
    return
  }
  if (combo === FIXED_NEW_NOTE_COMBO) {
    // Ctrl+N：应用内新建笔记（快速捕获入口之一）
    e.preventDefault()
    createNote()
  }
}

const onResize = () => {
  if (window.innerWidth >= 1100) navDrawerOpen.value = false
}

const onWindowFocus = () => {
  // 从速记窗切回主窗口：拉取捕获窗落库的变更
  noteStore.syncFromRemote()
  // 回到窗口时立刻检查当前临时笔记是否被外部编辑器改过
  void checkTempNoteExternalChange()
}

// ====== 临时笔记：自动从磁盘重读 + 阅读位置记忆 ======
/** 轮询间隔：3 秒（只 stat 当前打开的那一篇，开销可忽略） */
const TEMP_POLL_MS = 3000
let tempPollTimer: ReturnType<typeof setInterval> | null = null
/** 重读进行中标记，避免上一轮未完成又进一轮 */
let checkingTempNote = false

/**
 * 检查当前打开的临时笔记是否被外部改动：
 *  - 只比较 mtime（不读全文），我们自己保存后 mtime 基准会被同步刷新，不会误报；
 *  - 有未保存编辑时跳过，避免覆盖用户正在输入的字符；
 *  - 命中后重读并恢复阅读位置（滚动 + 光标行）。
 */
const checkTempNoteExternalChange = async () => {
  const note = selectedTempNote.value
  if (!note) return
  if (checkingTempNote) return
  checkingTempNote = true
  try {
    const changed = await tempNoteStore.isExternallyChanged(note.id)
    if (!changed) return
    if (editorRef.value?.hasPendingEdits()) return
    const position = editorRef.value?.getReadingPosition()
    await tempNoteStore.reload(note.id)
    await nextTick()
    editorRef.value?.reloadFromNote()
    if (position) await editorRef.value?.restoreReadingPosition(position)
    logger.info('[临时笔记] 检测到外部改动，已自动重读', { file: note.filePath })
  } catch (e) {
    logger.error('[临时笔记] 自动重读失败', { error: e instanceof Error ? e.message : String(e) })
  } finally {
    checkingTempNote = false
  }
}

/** 记录当前临时笔记的阅读位置（store 内部去重，无变化不写盘） */
const recordTempReading = async () => {
  const note = selectedTempNote.value
  if (!note || !editorRef.value) return
  await tempNoteStore.recordReading(note.id, editorRef.value.getReadingPosition())
}

// ====== 中栏：列表 ======
const query = ref('')
const listRef = ref<HTMLElement | null>(null)
const entrance = useCardEntrance(listRef, '.np-item')

/*
  卡片网格：按可用宽度决定一行几张，卡片 16:9。
  规格（用户给定，d = 16px，一行最多 3 张）：
    available <  800 + d         → 1 张，卡片宽 = available
    800+d ≤ available < 1200+2d  → 2 张，卡片宽 = (available - d)/2
    1200+2d ≤ available          → 3 张，卡片宽 = (available - 2d)/3
  卡片宽由 CSS 的 grid 列宽自动算出（1fr 分配），因此这里只需给出**列数**；
  calc 详见 .np-list-scroll 的 grid-template-columns。

  为什么用 JS 测宽而不是纯 CSS 媒体查询：
  列表区宽度取决于「两个侧栏是否收起 / 是否全屏编辑 / 窗口宽度」三者组合，
  与视口宽度并非一一对应（例如全屏编辑时视口没变但列表区消失）。
  因此用 ResizeObserver 观测**容器自身**宽度，判定才准确。
*/
const CARD_GAP = 16
const listWidth = ref(0)

/** 由可用宽度推算一行卡片数（与用户给定分段一致） */
const computeCardCols = (w: number): number => {
  if (w < 800 + CARD_GAP) return 1
  if (w < 1200 + 2 * CARD_GAP) return 2
  return 3 // 一行最多 3 张
}

const cardCols = computed(() => computeCardCols(listWidth.value))
let listResizeObserver: ResizeObserver | null = null

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
  if (view === 'all' || view === 'favorites' || view === 'trash') return null
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
  if (view === 'temp') return tempNotesAsNotes.value
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
  if (view === 'temp') return tempNotes.value.length
  if (view === 'favorites') return noteStore.notes.filter(n => n.pinned).length
  if (view === 'trash') return noteStore.trashedNotes.length
  return noteStore.notes.length
}

const excerpt = (note: Note) => {
  /*
    摘要取更长的前缀（此前只取 60 字符）。
    卡片改为三段式后，摘要区占据卡片剩余高度。实测所需字符数：
      3 列（窗口 1400）→ 约 238 字；3 列（1740）→ 约 430 字；
      极宽窗口（2380）→ 约 960 字。
    取 600 可覆盖到 1740px 宽窗口，更大窗口下摘要自然行尾截断
    （容器 overflow:hidden + 底部渐隐），不会出现生硬缺口。
    getMdPlainText 本来就要处理全文，多截几十字符不增加额外开销。
  */
  const text = getMdPlainText(note.content).replace(/\s+/g, ' ').trim()
  return text.slice(0, 600) || '（空白笔记）'
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
  if (view === 'temp') return '还没有临时笔记'
  if (view === 'favorites') return '暂无收藏'
  if (view === 'trash') return '回收站是空的'
  if (view === 'all') return '还没有笔记'
  return '此标签下暂无笔记'
})
const emptySub = computed(() => {
  if (query.value.trim()) return '换个关键词试试'
  if (currentView.value === 'temp') return '点击右上角按钮打开本地 .md 文件，原地编辑并保存'
  if (currentView.value === 'trash') return '删除的笔记将在这里保留 30 天'
  return '点击右上角 + 新建'
})

// ====== 右栏：编辑器 ======
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const titleDraft = ref('')

watch([selectedId, () => selectedNote.value?.title], ([id, title]) => {
  titleDraft.value = id ? (title || '') : ''
}, { immediate: true })

const onTitleInput = () => {
  // 临时笔记标题取自文件名，不可改（改名会改变磁盘文件，超出「原地编辑」范围）
  if (isTempNote.value) return
  // 同步到 NoteEditor 内部标题，保存时一并落库（自动保存在阶段 4 接入）
  editorRef.value?.setNoteTitle(titleDraft.value)
}

// ====== 临时笔记（直接编辑外部 .md 文件）======
/** 临时笔记的磁盘路径（列表里显示来源） */
const tempFilePath = (id: string) => tempNoteStore.find(id)?.filePath || ''

/** 选择一个 .md 文件加入临时笔记，并打开它 */
/**
 * 打开临时笔记。
 *
 * 用户要求「移除 electron 原生弹窗，改用应用内通用弹窗」——因此这里不再调用
 * window.electronAPI.openFileDialog（系统文件框），而是打开应用内的 FilePickerDialog。
 * 真正的落盘逻辑放在 onFilePickerConfirm 里，两条入口（按钮 / Ctrl+N 引导）都走它。
 */
const tempFilePickerVisible = ref(false)

const addTempNoteFromDialog = () => {
  // 只校验「能不能读文件」；目录浏览由弹窗内的只读 IPC 负责
  const bridge = window.electronAPI
  if (!bridge?.readBinaryFile && !bridge?.readFile) {
    ElMessage.info('当前环境不支持打开本地文件')
    return
  }
  tempFilePickerVisible.value = true
}

/** 应用内文件弹窗选定文件后：加入临时笔记列表并打开 */
const onFilePickerConfirm = async (filePath: string) => {
  if (!filePath) return
  try {
    const note = await tempNoteStore.addFile(filePath)
    if (!note) {
      ElMessage.error('读取文件失败')
      return
    }
    pageNav.setNavPath(['notes', 'temp', note.id])
    ElMessage.success(`已打开「${note.title}」（原地编辑）`)
  } catch (e) {
    logger.error('[笔记] 打开临时笔记失败', { error: e instanceof Error ? e.message : String(e) })
    ElMessage.error('打开文件失败')
  }
}

/**
 * 手动「重新从磁盘读取」已移除（用户要求删除卡片上的按钮）。
 * 外部编辑器改动现由自动机制覆盖：
 *   - 窗口重新获得焦点时（onWindowFocus → checkTempNoteExternalChange）
 *   - 以及每 3 秒的 mtime 轮询（TEMP_POLL_MS）
 * 两条路径都会跳过「本地有未保存改动」的情况，再重读并恢复阅读位置。
 */

/**
 * 从临时笔记列表移除（提示不会删除源文件）。
 *
 * 用户要求「移除临时笔记弹窗，应用通用弹窗组件而不是 electron 原生弹窗组件」——
 * 因此这里不再用 Element Plus 的 ElMessageBox（全局命令式弹窗，不在本项目
 * 自己的弹窗体系里），改为项目通用的 ConfirmDialog（与标签删除等确认框一致）。
 * 本函数只负责「打开确认框」，真正的移除在 onRemoveTempNoteConfirmed 里。
 */
const removingTempNote = ref<Note | null>(null)
const removeTempNoteVisible = ref(false)

const askRemoveTempNote = (note: Note) => {
  removingTempNote.value = note
  removeTempNoteVisible.value = true
}

/** 确认移除：只从列表移除，不删磁盘文件 */
const onRemoveTempNoteConfirmed = async () => {
  const note = removingTempNote.value
  removingTempNote.value = null
  if (!note) return
  await tempNoteStore.remove(note.id)
  if (selectedId.value === note.id) pageNav.setNavPath(['notes', 'temp'])
  ElMessage.success('已从临时笔记列表移除')
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

/**
 * 反向链接面板已按用户要求删除（面板与入口按钮一并移除）。
 * linkIndex 仍然保留：它是 wiki 链接解析（openWikiLink）的基础，
 * 与「反向链接面板」是两件事，删面板不影响链接跳转。
 */

/** 可作为「链接到其它笔记」目标的笔记标题（排除当前笔记与临时笔记） */
const linkableNoteTitles = computed(() => {
  const current = selectedNote.value
  return noteStore.notes
    .filter(n => n.id !== current?.id && !n.id.startsWith('tmp:'))
    .map(n => (n.title || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
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

// 源码 / 所见即所得模式（会话内记忆）
const editorSourceMode = ref(false)

// ====== 导出 ======
const handleExportCommand = async (cmd: string | number | object) => {
  const note = selectedNote.value
  if (!note) return
  if (cmd === 'md') {
    exportNoteMarkdown(note, noteTags.value)
    ElMessage.success('Markdown 已导出')
    return
  }
  if (cmd === 'html') {
    await exportSelectedNoteHtml(note)
  }
}

/**
 * 导出 HTML：基于编辑器当前渲染产物（`.ProseMirror`），
 * 因此公式、代码着色、图片都已经在 DOM 里，无需重新渲染。
 * 源码模式下先切回富文本并等渲染就绪。
 */
const exportSelectedNoteHtml = async (note: Note) => {
  try {
    if (editorSourceMode.value) {
      editorSourceMode.value = false
      await nextTick()
    }
    const el = await waitForProseMirror()
    if (!el) {
      ElMessage.error('编辑器尚未就绪，请稍后再试')
      return
    }
    await exportNoteHtml({ note, tags: noteTags.value, contentEl: el })
    ElMessage.success('HTML 已导出（自包含，可离线打开）')
  } catch (e) {
    logger.error('[笔记] 导出 HTML 失败', { error: e instanceof Error ? e.message : String(e) })
    ElMessage.error('HTML 导出失败')
  }
}

/** 等待 Milkdown 渲染完成（源码模式切回后编辑器异步重建） */
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
  // 临时笔记：原地写回被打开的 .md 文件，不进入笔记库
  if (isTempNote.value && data.id.startsWith('tmp:')) {
    const ok = await tempNoteStore.saveContent(data.id, data.content)
    if (!ok) logger.error('[笔记] 临时笔记保存失败', { file: tempNoteStore.find(data.id)?.filePath || '' })
    return
  }
  const ok = await noteStore.updateNote(data.id, {
    title: data.title,
    content: data.content,
    pinned: data.pinned,
  })
  if (!ok) logger.error('[笔记] 自动保存失败', { id: data.id })
}

const createNote = async () => {
  // 临时笔记视图里没有「新建空笔记」概念：临时笔记是磁盘上真实存在的 .md 文件，
  // 只能通过打开文件创建。若不拦这一下，Ctrl+N 会往笔记库塞一篇该视图看不见的笔记
  // （实测表现：按了没反应，连按几次就留下几篇空白笔记），因此改为引导打开文件。
  if (isTempNote.value) {
    ElMessage.info('临时笔记来自磁盘上的 .md 文件，请点「打开文件」添加')
    addTempNoteFromDialog()
    return
  }
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

const togglePin = async (note: Note) => {
  // 临时笔记不进入笔记库，没有收藏概念
  if (isTempNote.value || note.id.startsWith('tmp:')) return
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
  if (guideRunning.value) {
    if (pageNav.navPath.value[0] !== 'notes') pageNav.setNavPath(['notes', 'all'])
    return
  }
  const path = pageNav.navPath.value
  if (path.length > 1 && path[0] === 'notes') return
  const restored = await restoreModuleNavPath('notes')
  pageNav.setNavPath(restored)
}

onMounted(async () => {
  emit('fullscreen-change', fullscreenEdit.value)
  await noteStore.loadData()
  // 临时笔记：读数据目录里的文件路径清单（data/<用户ID>/notes/tempNotes.yaml），再逐个读盘
  await tempNoteStore.load()
  await initNavPath()
  // 进入笔记页与窗口重新聚焦时重载本地文件，读取最新的本机笔记
  noteStore.syncFromRemote()
  window.addEventListener('focus', onWindowFocus)
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
  // 滚动即记录阅读位置：capture 阶段可捕获 textarea 与富文本容器的滚动
  document.addEventListener('scroll', onEditorScroll, true)
  tempPollTimer = setInterval(() => { void checkTempNoteExternalChange() }, TEMP_POLL_MS)
  // 卡片网格列数：观测列表容器**自身**宽度（受侧栏是否收起/全屏编辑影响，
  // 与视口宽度并非一一对应，因此不能用媒体查询）
  if (listRef.value && typeof ResizeObserver !== 'undefined') {
    listResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) listWidth.value = entry.contentRect.width
    })
    listResizeObserver.observe(listRef.value)
    listWidth.value = listRef.value.clientWidth
  }
  await nextTick()
  entrance.play()
})

onBeforeUnmount(() => {
  emit('fullscreen-change', false)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('scroll', onEditorScroll, true)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('focus', onWindowFocus)
  listResizeObserver?.disconnect()
  listResizeObserver = null
  if (tempPollTimer) {
    clearInterval(tempPollTimer)
    tempPollTimer = null
  }
  if (readingRecordTimer) clearTimeout(readingRecordTimer)
  // 离开页面前落盘一次阅读位置
  void recordTempReading()
})

/** 滚动记录去抖：滚动过程中不频繁写盘 */
let readingRecordTimer: ReturnType<typeof setTimeout> | null = null
const onEditorScroll = () => {
  if (!selectedTempNote.value) return
  if (readingRecordTimer) clearTimeout(readingRecordTimer)
  readingRecordTimer = setTimeout(() => {
    readingRecordTimer = null
    void recordTempReading()
  }, 500)
}

// 打开某篇临时笔记后，恢复它上次的阅读位置
// （restoreReadingPosition 内部会等内容与渲染都就绪，这里不再用固定延时）
watch(selectedId, async (id) => {
  if (!id || !selectedTempNote.value) return
  const position = await tempNoteStore.takeReading(id)
  if (!position) return
  const expected = selectedNote.value?.content
  // 选中笔记后编辑器组件才渲染，等一帧拿到实例
  await nextTick()
  await editorRef.value?.restoreReadingPosition(position, expected)
})

// 视图切换 / 笔记增删时重放列表进场动效（遵循全局 reduced-motion 约定）
watch([currentView, () => noteStore.notes.length], () => {
  nextTick(() => entrance.play())
})
</script>

<style scoped>
/*
  ⚠️ 全屏编辑（.notes-page.fs-edit）的规则**必须放在顶层**，不能放进宽度媒体查询。

  用户报告的缺陷：「笔记详情区域没有根据全屏/未全屏动态调整区域大小，
  未全屏时显示成全屏时的大小」。
  根因就是这里原本写成：

    @media (min-width: 1100px) {
      .np-nav, .np-list { transition: ... }
      .notes-page.fs-edit { gap: 0; }
      .notes-page.fs-edit .np-nav,
      .notes-page.fs-edit .np-list { display: none; }
    }

  这使「是否隐藏侧栏、编辑区是否铺满」取决于**窗口宽度**，而不是
  `fullscreenEdit` 这个**状态**。于是窗口窄于 1100 CSS px 时：
    · 进入全屏 → 隐藏侧栏的规则不生效 → 侧栏照旧、区域大小毫无变化；
    · 同时 max-width:1099 分支把 .np-nav 变成 position:fixed（脱离布局流），
      编辑区在任何状态下都近乎铺满。
  两种状态看起来一样 —— 正是用户描述的现象。

  现在把「状态相关」的规则上移到顶层（任何宽度都按状态生效），
  只把「宽度相关」的过渡留给媒体查询。

  ── 本轮（item 3）的变化 ──
  用户要求「点击笔记卡片进入笔记编辑页面，**全屏显示**」，
  并确认全屏指「覆盖整个应用窗口（连左侧模块导航栏一起隐藏）」。
  因此编辑页改为**真全屏覆盖层**：
    · 列表区变成占满宽度的卡片网格（一行最多 3 张，16:9）；
    · 选中笔记后，编辑区 fixed 覆盖整个窗口（inset:0, z-index 高于全局导航）；
    · 全屏状态由 selectedNote 派生（见 script 里的 watch），返回列表即退出。
*/

/* 全屏编辑：两个侧栏移除，编辑区自动铺满剩余宽度。 */
.notes-page.fs-edit {
  gap: 0;
}

.notes-page.fs-edit .np-nav,
.notes-page.fs-edit .np-list {
  display: none;
}

/*
  ====== 真全屏（item 3）======
  用户要求「点击笔记卡片进入笔记编辑页面，全屏显示」，
  并确认「覆盖整个应用窗口（连左侧模块导航栏一起隐藏）」。

  实现：编辑区 fixed 覆盖整个窗口。
    · inset:0 → 从窗口左上角开始，覆盖 MainNav（其 z-index:20）
    · z-index:50 → 高于 MainNav(20)、也高于列表内浮层
    · 背景用不透明底色 → 避免下层导航透出来
    · 内边距复刻 .notes-page 的 16px，保持与列表视图一致的呼吸感
  这样「返回」按钮回到列表时，导航栏随之回来（全屏状态由 selectedNote 派生）。
*/
.notes-page.fs-edit .np-editor {
  position: fixed;
  inset: 0;
  z-index: 50;
  padding: 16px;
  background: #0f0c29;
  overflow: hidden;
}

/* 编辑页头部的「返回」按钮：全屏时可见（列表视图下编辑区被 display:none 隐藏） */
.np-editor-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--chalk-white-70);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.np-editor-back:hover {
  background: rgba(102, 126, 234, 0.18);
  border-color: rgba(102, 126, 234, 0.45);
  color: #93c5fd;
}

/*
  编辑区宽度过渡：切换全屏时区域大小是平滑变化的，而不是瞬间跳变。
  transition 放在顶层：窄屏下同样需要（窄屏也会隐藏 .np-list）。
*/
.np-editor {
  transition: width 0.2s ease, flex-basis 0.2s ease;
}

/* 宽屏：双侧栏可收起（窄屏沿用抽屉交互） */
@media (min-width: 1100px) {
  .np-nav,
  .np-list {
    transition: width 0.2s ease, margin 0.2s ease, opacity 0.18s ease;
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

/* ====== 中栏：列表（卡片网格）======
   用户要求：
     · 列表区右边界延伸到应用窗口右侧（保留一定间距）
     · 卡片 16:9，同行等高，一行最多 3 张
     · 判定：available < 800+d → 1 张；< 1200+2d → 2 张；否则 3 张（d=16）
   卡片宽由 grid 的 1fr 自动分配，因此只需给出列数（--np-card-cols，由 JS 测量容器宽度后计算）。
   之所以用 JS 测宽：列表区宽度取决于「侧栏是否收起 / 是否全屏编辑 / 窗口宽度」，
   与视口宽度并非一一对应（全屏编辑时视口不变但列表区消失），媒体查询判不准。
*/
.np-list {
  display: flex;
  flex-direction: column;
  /* 列表区占满可用宽度（右边界延伸到窗口右侧，间距由外层 padding 提供） */
  flex: 1;
  min-width: 0;
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
  /* 卡片网格：列数由 JS 按容器宽度算出（--np-card-cols），间隔用 --np-card-gap */
  display: grid;
  grid-template-columns: repeat(var(--np-card-cols, 1), minmax(0, 1fr));
  gap: var(--np-card-gap, 16px);
  align-content: start;
  /* 右侧留出滚动条槽位：自绘滚动条吸附容器右边界，而不是贴着卡片右边缘 */
  padding: 8px 18px 8px 8px;
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
  display: flex;
  flex-direction: column;
  /* 撑满所在网格列（宽度由 1fr 决定） */
  width: 100%;
  min-width: 0;
  /* 16:9 宽高比（用户要求） */
  aspect-ratio: 16 / 9;
  /*
    三段式纵向布局（用户反馈「卡片布局不太行」）：
      ① 标题行（最多 2 行）
      ② 摘要（flex:1，吃满中间弹性区域，多行截断）
      ③ 元信息（钉在底部）
    此前内容总高仅约 69px，而 16:9 的卡片高约 280px → **约 75% 是空白**，
    这才是「布局不太行」的根源。现在让摘要占据剩余空间，卡片被填满。
  */
  padding: 12px 14px;
  /* 用户要求「给笔记卡片加上背景框」：常态即有可见的底色 + 边框，
     不再依赖 hover 才显现（此前 background 为 transparent，卡片像"浮"在面板上）。 */
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  overflow: hidden;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

/* 同行卡片等高：grid 默认 stretch，卡片已由 aspect-ratio 决定高度；
   同一行内显式拉伸，避免内容多少不同导致高度不一致。 */
.np-list-scroll > .np-item {
  align-self: stretch;
}

.np-item:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
}

.np-item.active {
  background: rgba(102, 126, 234, 0.16);
  border-color: rgba(102, 126, 234, 0.45);
}

.np-item-top {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  flex-shrink: 0;
}

.np-item-title {
  flex: 1;
  min-width: 0;
  /* 标题最多 2 行：卡片够高，允许长标题换行比强制单行省略更易读 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--chalk-white-90);
  word-break: break-word;
}

.np-item.active .np-item-title {
  color: #93c5fd;
}

/*
  操作按钮：常态**占据布局空间但不可见**，悬停/聚焦/选中时才显现。
  为什么不用绝对定位浮在右上角：卡片标题现在可占 2 行，浮层会与文字重叠。
  保留占位则标题宽度稳定、不会因按钮出现而跳动；pointer-events 防止误点。
*/
.np-item-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-top: -2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.np-item:hover .np-item-actions,
.np-item:focus-within .np-item-actions,
.np-item.active .np-item-actions {
  opacity: 1;
  pointer-events: auto;
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

/*
  摘要：占据标题与元信息之间的全部剩余高度（flex:1）。
  多行截断而非单行 nowrap —— 卡片高约 280px，单行摘要会浪费纵向空间。

  line-clamp 取 20：实测最极端情况（1 列、卡片高 428px）摘要区约 327px、
  约 15 行，因此 20 行足够覆盖所有窗口尺寸，实际截断交给容器高度
  （overflow:hidden + 底部渐隐 mask），不会再出现「文字只占 12 行、
  下方留 80px 空白」的情况。
*/
.np-item-excerpt {
  flex: 1;
  min-height: 0;
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--chalk-dim);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 20;
  overflow: hidden;
  word-break: break-word;
  /* 底部渐隐：内容被高度截断时不会出现生硬的半行切口 */
  mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
}

.np-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  /* 钉在卡片底部：与上方标题/摘要形成稳定的三段结构 */
  margin-top: auto;
  padding-top: 8px;
  min-width: 0;
  flex-shrink: 0;
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

/* ====== 临时笔记（直接编辑外部 .md 文件）====== */
/* 列表里的「临时」小徽标 */
.np-item-badge {
  display: inline-block;
  margin-right: 6px;
  padding: 0 5px;
  border-radius: 4px;
  background: rgba(251, 191, 36, 0.18);
  border: 1px solid rgba(251, 191, 36, 0.4);
  color: #fbbf24;
  font-size: 9px;
  font-weight: 600;
  line-height: 1.5;
  vertical-align: 1px;
}

/* 列表里的来源文件路径（替代标签行） */
.np-item-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: rgba(148, 163, 184, 0.6);
  direction: rtl;      /* 过长时优先保留文件名 */
  text-align: left;
}

/* 临时笔记打开按钮（列表头） */
.np-temp-add {
  color: #fbbf24;
}

/* 编辑器头部：临时笔记的来源路径 */
.np-props-temp {
  justify-content: flex-start;
  gap: 10px;
}

.np-temp-file {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 70%;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(203, 213, 225, 0.7);
  font-size: 11px;
}

.np-temp-file-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
  text-align: left;
}

.np-temp-hint {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.14);
  border: 1px solid rgba(251, 191, 36, 0.35);
  color: #fbbf24;
  font-size: 10px;
}

.np-empty {
  /* 空状态是网格的子元素，必须跨满所有列，否则会被挤进第一列 */
  grid-column: 1 / -1;
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

/*
  未选中笔记时，编辑区**不占位**（否则它 flex:1 会与列表各占一半宽度，
  列表就只有窗口一半宽、卡片放不下 2~3 列 —— 正是用户截图里的现象）。
  选中笔记时才渲染（.editor-open）并由 fs-edit 的 fixed 覆盖层铺满全屏。
  用户已要求删掉「未选中」时的占位提示区，因此这里直接隐藏。
*/
.np-editor:not(.editor-open) {
  display: none;
}

.np-editor-main {
  flex: 1;
  min-height: 0;
  /* flex 项需允许横向收缩，避免内部较宽内容把容器撑出父级（右侧被裁） */
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/*
  ⚠️ 这段样式（.np-editor-head / .np-title-input）是上一轮误删后补回的。
  原因：上一轮删「反向链接面板」CSS 时，我按行号范围删除，
  结果把紧邻其后的这两条规则一起删掉了 —— 表现就是笔记详情页顶部标题
  失去样式（变成默认白色输入框、被挤到单独一行），即用户截图里的样子。
  现在标题、文件路径、「原地保存」在同一行显示：head 用 flex 横向排列，
  标题占满剩余宽度，路径与徽标按内容宽度收缩。
*/
.np-editor-head {
  /* 标题、文件路径、「原地保存」徽标同一行；gap 提供「挨着但有间距」的观感 */
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 4px 16px 10px;
}

.np-title-input {
  /*
    标题不再「占满剩余宽度」（旧写法 flex: 1 1 auto 会把路径与徽标顶到最右侧，
    视觉上彼此离得很远）。改为按内容自适应宽度，用 field-sizing: content
    让输入框随标题文字长度伸缩；再配合 min/max 宽度兜底，
    这样标题、路径、徽标会自然挨在一起，同时保留 10px 的间距。
  */
  flex: 0 1 auto;
  field-sizing: content;
  min-width: 6ch;
  /* 上限避免超长标题把路径挤到下一行；超出部分输入框内部滚动 */
  max-width: 55%;
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

/* 编辑主体：菜单栏 → 状态栏这一段；反向链接面板与编辑器组件同行同高。
   --editor-outer-gap 由编辑器组件与面板共享，保证面板上下边界
   严格对齐菜单栏上边界与状态栏下边界。 */
.np-editor-body {
  --editor-outer-gap: 16px;
  flex: 1;
  min-height: 0;
  min-width: 0;
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


/* ====== 属性栏：标签（紧跟标题同行）====== */
.np-props {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  margin-top: 0;
  justify-content: flex-start;
  gap: 8px;
  flex-wrap: wrap;
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

  /* 列表区仍占满可用宽度（网格列数由 JS 按实际宽度算，这里不设固定宽） */
}

/* < 900px：列表优先，编辑器整屏下钻（小米笔记/锤子便签式） */
@media (max-width: 899px) {
  .notes-page {
    padding: 10px;
    gap: 10px;
  }

  /*
    窄屏下编辑区默认不渲染（选中笔记后由 .notes-page.fs-edit .np-editor
    的 fixed 全屏覆盖层接管 —— 见文件开头的说明）。
    这里保留一条兜底：万一 fs-edit 未生效（例如状态尚未同步），
    仍用 editor-open 把编辑区铺满，避免「点了卡片看不到编辑区」。
  */
  .np-editor {
    display: none;
  }

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
