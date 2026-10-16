<template>
  <div class="editor-wrap" @contextmenu.prevent>
    <!-- 主容器 -->
    <div class="editor-main">
      <!-- 侧边栏大纲 -->
      <aside v-if="!sidebarCollapsed" class="editor-sidebar">
        <div class="editor-sidebar-inner">
          <div class="editor-sidebar-header">
            <span v-if="!sidebarCollapsed" class="editor-sidebar-title">大纲</span>
            <button v-if="!sidebarCollapsed" class="sidebar-toggle-btn" @click="toggleSidebar" title="收起大纲">
              <el-icon><PanelLeftClose /></el-icon>
            </button>
          </div>
          <template v-if="!sidebarCollapsed">
            <ul v-if="outline.length > 0" class="editor-sidebar-nav">
              <li
                v-for="(item, idx) in outline"
                :key="idx"
                :class="['nav-l' + item.level]"
              >
                <a @click="scrollToHeading(item)" :title="item.text">
                  <span class="nav-title-text">{{ item.text || '未命名' }}</span>
                </a>
              </li>
            </ul>
            <div v-else class="outline-empty">输入标题以生成大纲</div>
          </template>
        </div>
      </aside>

      <!-- 主内容区 -->
      <div class="editor-content-area" @contextmenu="openSelectionContextMenu" @paste.capture="preventMediaPaste" @drop.capture="preventMediaDrop">
        <div class="editor-viewport">
          <MilkdownEditor
            v-if="!sourceMode"
            ref="mdEditorRef"
            v-model="editorContent"
            :current-note-id="note?.id ?? ''"
            placeholder="开始编写 Markdown 笔记...（输入 [[ 链接其他笔记）"
            @input="refreshOutline"
            @open-wiki-link="(p) => emit('openWikiLink', p)"
          />
          <textarea
            v-else
            ref="sourceEditorRef"
            v-model="editorContent"
            class="editor-source"
            spellcheck="false"
            placeholder="Markdown 源码"
            @input="refreshOutline"
            @keydown="onSourceKeydown"
          ></textarea>

          <!-- 编辑器内搜索浮层：右上角，不撑开布局 -->
          <div v-if="searchBarVisible" class="editor-search-bar" @mousedown.stop @keydown.stop>
            <div class="editor-search-input-wrap" :class="{ 'is-error': searchRegexError }">
              <el-icon class="editor-search-icon"><Search /></el-icon>
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                class="editor-search-input"
                placeholder="在当前笔记中搜索…"
                spellcheck="false"
                @input="onSearchInput"
                @keydown="onSearchKeydown"
              >
            </div>
            <button
              type="button"
              class="editor-search-chip"
              :class="{ on: searchCaseSensitive }"
              title="大小写敏感"
              @click="toggleCaseSensitive"
            >Aa</button>
            <button
              type="button"
              class="editor-search-chip"
              :class="{ on: searchRegex }"
              title="正则表达式"
              @click="toggleRegex"
            >.*</button>
            <span class="editor-search-count" :class="{ 'is-empty': searchTotal > 0 && searchActiveIndex < 0 }">
              {{ searchCountText }}
            </span>
            <div class="editor-search-nav">
              <button type="button" class="editor-search-step" title="上一处 (Shift+Enter)" :disabled="!searchTotal" @click="stepSearch(-1)">
                <el-icon><ArrowUp /></el-icon>
              </button>
              <button type="button" class="editor-search-step" title="下一处 (Enter)" :disabled="!searchTotal" @click="stepSearch(1)">
                <el-icon><ArrowDown /></el-icon>
              </button>
            </div>
            <button type="button" class="editor-search-close" title="关闭 (Esc)" @click="closeSearchBar">
              <el-icon><X /></el-icon>
            </button>
            <p v-if="searchRegexError" class="editor-search-error">{{ searchRegexError }}</p>
            <p v-else-if="searchTruncated" class="editor-search-hint">匹配超过 {{ MAX_SEARCH_MATCHES }} 处，仅显示前 {{ MAX_SEARCH_MATCHES }} 处</p>
          </div>
        </div>
      </div>
    </div>

    <input ref="imageFileInput" type="file" accept="image/*" hidden @change="onMediaFileSelected('image', $event)">
    <input ref="videoFileInput" type="file" accept="video/*" hidden @change="onMediaFileSelected('video', $event)">
    <input ref="audioFileInput" type="file" accept="audio/*" hidden @change="onMediaFileSelected('audio', $event)">

    <!-- 媒体插入确认（可选尺寸） -->
    <Teleport to="body">
      <div v-if="mediaSizeDialog.visible" class="note-media-size-backdrop" @mousedown.self="cancelMediaSize">
        <section class="note-media-size-dialog" @mousedown.stop>
          <header class="note-media-size-header">
            <span>插入{{ mediaKindLabels[mediaSizeDialog.kind] }}</span>
            <span class="note-media-size-meta">{{ mediaSizeDialog.fileName }}</span>
          </header>
          <div class="note-media-size-row">
            <label>宽度（px）</label>/label>
            <input v-model.number="mediaSizeDialog.width" type="number" min="0" max="4096" placeholder="默认" @keyup.enter="confirmMediaSize">
          </div>
          <div class="note-media-size-row">
            <label>高度（px）</label>/label>
            <input v-model.number="mediaSizeDialog.height" type="number" min="0" max="4096" placeholder="默认" @keyup.enter="confirmMediaSize">
          </div>
          <p class="note-media-size-hint">留空则按默认比例显示；只填一项时另一项按比例缩放。</p>
          <footer class="note-media-size-actions">
            <button type="button" class="capsule-btn" @click="cancelMediaSize">取消</button>
            <button type="button" class="capsule-btn capsule-btn-primary" @click="confirmMediaSize">插入</button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="selectionContextMenu.visible"
        class="note-text-menu-backdrop"
        @mousedown.self="closeSelectionContextMenu"
        @contextmenu.prevent
      >
        <section
          class="note-text-menu"
          :style="{ left: `${selectionContextMenu.x}px`, top: `${selectionContextMenu.y}px` }"
          role="menu"
          aria-label="选中文本操作"
          @mousedown.stop
        >
          <div class="note-text-menu-header">
            <span>选中文本</span>
            <span class="note-text-menu-count">{{ Array.from(selectionContextMenu.text).length }} 字</span>
          </div>
          <div class="note-text-menu-section-title">格式</div>
          <div class="note-text-menu-format-grid">
            <button type="button" class="note-text-menu-format" role="menuitem" title="加粗" @mousedown.prevent @click="applySelectionFormat('bold')"><strong>B</strong><span>加粗</span></button>
            <button type="button" class="note-text-menu-format" role="menuitem" title="斜体" @mousedown.prevent @click="applySelectionFormat('italic')"><em>I</em><span>斜体</span></button>
            <button type="button" class="note-text-menu-format" role="menuitem" title="插入链接" @mousedown.prevent @click="openSelectionLinkInput"><span class="format-symbol">↗</span><span>链接</span></button>
            <button type="button" class="note-text-menu-format" role="menuitem" title="引用" @mousedown.prevent @click="applySelectionFormat('quote')"><span class="format-symbol">❝</span><span>引用</span></button>
            <button type="button" class="note-text-menu-format" role="menuitem" title="正文与标题级别" @mousedown.prevent @click="toggleHeadingOptions"><strong>H</strong><span>标题</span></button>
            <button type="button" class="note-text-menu-format" role="menuitem" title="行内代码" @mousedown.prevent @click="applySelectionFormat('code')"><code>&lt;/&gt;</code><span>代码</span></button>
            <button type="button" class="note-text-menu-format" role="menuitem" title="无序列表" @mousedown.prevent @click="applySelectionFormat('unordered')"><span class="format-symbol">☷</span><span>无序列表</span></button>
            <button type="button" class="note-text-menu-format" role="menuitem" title="删除线" @mousedown.prevent @click="applySelectionFormat('strike')"><del>S</del><span>删除线</span></button>
            <button type="button" class="note-text-menu-format" role="menuitem" title="有序列表" @mousedown.prevent @click="applySelectionFormat('ordered')"><span class="format-symbol">1.</span><span>有序列表</span></button>
          </div>
          <div v-if="headingOptionsOpen" class="note-text-menu-submenu" aria-label="标题级别">
            <button v-for="level in [0, 1, 2, 3, 4, 5, 6]" :key="level" type="button" @mousedown.prevent @click="applySelectionHeading(level)">
              {{ level === 0 ? '正文' : `H${level}` }}
            </button>
          </div>
          <form v-if="linkInputVisible" class="note-text-menu-link-form" @submit.prevent="applySelectionLink">
            <input ref="linkUrlInput" v-model="linkUrl" type="text" aria-label="链接地址" placeholder="输入链接地址">
            <button type="submit">插入</button>
            <button type="button" class="cancel" @mousedown.prevent @click="linkInputVisible = false">取消</button>
          </form>
          <div class="note-text-menu-divider"></div>
          <div class="note-text-menu-section-title">文本操作</div>
          <div class="note-text-menu-actions">
            <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="runNativeTextCommand('undo')">
              <span class="note-text-menu-icon">↶</span><span class="note-text-menu-label"><strong>撤销</strong></span><kbd>Ctrl Z</kbd>
            </button>
            <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="runNativeTextCommand('redo')">
              <span class="note-text-menu-icon">↷</span><span class="note-text-menu-label"><strong>重做</strong></span><kbd>Ctrl Y</kbd>
            </button>
            <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="cutSelection">
              <span class="note-text-menu-icon">剪</span><span class="note-text-menu-label"><strong>剪切</strong></span><kbd>Ctrl X</kbd>
            </button>
            <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="copySelection">
              <span class="note-text-menu-icon">复</span><span class="note-text-menu-label"><strong>复制</strong></span><kbd>Ctrl C</kbd>
            </button>
            <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="pasteSelection">
              <span class="note-text-menu-icon">贴</span><span class="note-text-menu-label"><strong>粘贴</strong></span><kbd>Ctrl V</kbd>
            </button>
            <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="selectAllEditorText">
              <span class="note-text-menu-icon">全</span><span class="note-text-menu-label"><strong>全选</strong></span><kbd>Ctrl A</kbd>
            </button>
          </div>
          <div class="note-text-menu-section-title">插入媒体</div>
          <div class="note-text-menu-actions">
            <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="chooseMediaInsert('image')">
              <span class="note-text-menu-icon">图</span><span class="note-text-menu-label"><strong>插入图片</strong></span>
            </button>
            <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="chooseMediaInsert('video')">
              <span class="note-text-menu-icon">影</span><span class="note-text-menu-label"><strong>插入视频</strong></span>
            </button>
            <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="chooseMediaInsert('audio')">
              <span class="note-text-menu-icon">音</span><span class="note-text-menu-label"><strong>插入音频</strong></span>
            </button>
          </div>
          <div class="note-text-menu-hint">按 Esc 关闭</div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="mediaContextMenu.visible"
        class="note-text-menu-backdrop"
        @mousedown.self="closeMediaContextMenu"
        @contextmenu.prevent
      >
        <section
          class="note-text-menu note-media-insert-menu"
          :style="{ left: `${mediaContextMenu.x}px`, top: `${mediaContextMenu.y}px` }"
          role="menu"
          aria-label="插入媒体"
          @mousedown.stop
        >
          <div class="note-text-menu-header"><span>插入媒体</span></div>
          <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="chooseMediaInsert('image')">
              <span class="note-text-menu-icon">图</span><span class="note-text-menu-label"><strong>插入图片</strong></span>
          </button>
          <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="chooseMediaInsert('video')">
              <span class="note-text-menu-icon">影</span><span class="note-text-menu-label"><strong>插入视频</strong></span>
          </button>
          <button type="button" class="note-text-menu-action compact" role="menuitem" @mousedown.prevent @click="chooseMediaInsert('audio')">
              <span class="note-text-menu-icon">音</span><span class="note-text-menu-label"><strong>插入音频</strong></span>
          </button>
        </section>
      </div>
    </Teleport>

    <!-- 底部状态栏 -->
    <div class="editor-status-bar">
      <div class="editor-status-left">
        <span>全文字数: {{ totalWordCount }}</span>
        <span class="editor-status-sep">|</span>
        <span>创建于 {{ formatTime(note?.createdAt) }}</span>
        <span class="editor-status-sep">|</span>
        <span>更新于 {{ formatTime(note?.updatedAt) }}</span>
      </div>
      <div class="editor-status-right">
        <button
          class="editor-action-btn outline-toggle"
          :class="{ on: searchBarVisible }"
          :title="searchBarVisible ? '关闭编辑器内搜索 (Esc)' : '编辑器内搜索 (Ctrl+F)'"
          @click="toggleSearchBar"
        >
          <el-icon><Search /></el-icon>
          <span>搜索</span>
        </button>
        <button
          v-if="sidebarCollapsed"
          class="editor-action-btn outline-toggle"
          title="展开大纲"
          @click="toggleSidebar"
        >
          <el-icon><ListTree /></el-icon>
          <span>大纲</span>
        </button>
        <button
          class="editor-action-btn"
          :class="{ on: backlinksOpen }"
          :title="backlinksOpen ? '收起反向链接面板' : '展开反向链接面板'"
          @click="emit('toggleBacklinks')"
        >
          <el-icon><Link2 /></el-icon>
          <span>{{ backlinksCount }}</span>
        </button>
        <el-dropdown trigger="click" @command="forwardExportCommand">
          <button class="editor-action-btn" :disabled="exporting" title="导出当前笔记">
            <el-icon><Download /></el-icon>
            <span>{{ exporting ? '导出中' : '导出' }}</span>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="md">Markdown（.md，含标签）</el-dropdown-item>
              <el-dropdown-item command="png">长图（.png）</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <button
          class="editor-action-btn"
          :class="{ on: sourceMode }"
          :title="sourceMode ? '切换到所见即所得' : '切换到 Markdown 源码'"
          @click="emit('toggleSourceMode')"
        >
          <el-icon><Code v-if="!sourceMode" /><PenLine v-else /></el-icon>
          <span>{{ sourceMode ? '富文本' : '源码' }}</span>
        </button>
        <button
          class="editor-action-btn favorite"
          :class="{ on: note?.pinned }"
          :title="note?.pinned ? '取消收藏' : '收藏'"
          @click="emit('togglePin')"
        >
          <el-icon><Star :fill="note?.pinned ? 'currentColor' : 'none'" /></el-icon>
          <span>收藏</span>
        </button>
        <span v-if="savedAtText" class="editor-autosave">已自动保存 存   ?{{ savedAtText }}</span>
        <button class="editor-fs-btn" @click="$emit('toggleFullscreenEdit')" :title="fullscreenEdit ? '退出全屏编辑' : '全屏编辑'">
          <el-icon><Minimize2 v-if="fullscreenEdit" /><Maximize2 v-else /></el-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, watch as watchNoteTitleFallback } from 'vue'
import { Code, Download, Link2, ListTree, Maximize2, Minimize2, PanelLeftClose, PenLine, Star, Search, ArrowUp, ArrowDown, X } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import type { Note, MdOutlineItem } from '../../stores/noteStore'
import { extractMdOutline, getMdPlainText } from '../../stores/noteStore'
import MilkdownEditor from '../editor/MilkdownEditor.vue'
import { logger } from '../../lib/logger'
import {
  buildMediaSnippet,
  containsInlineMedia,
  describeMedia,
  mediaKindLabels,
  readFileAsDataUrl,
  storeMediaAsset,
  type MediaKind,
} from '../../composables/useNoteMedia'
import { findMatches, nextMatchIndex, MAX_MATCHES } from '../../composables/useNoteSearch'

const props = withDefaults(defineProps<{
  note: Note | null
  sourceMode?: boolean
  fullscreenEdit?: boolean
  backlinksOpen?: boolean
  backlinksCount?: number
  exporting?: boolean
}>(), {
  sourceMode: false,
  fullscreenEdit: false,
  backlinksOpen: false,
  backlinksCount: 0,
  exporting: false
})

const emit = defineEmits<{
  (e: 'save', data: { id: string; title: string; content: string; pinned: boolean }): void
  (e: 'togglePin'): void
  (e: 'toggleFullscreenEdit'): void
  (e: 'toggleBacklinks'): void
  (e: 'toggleSourceMode'): void
  (e: 'export', command: string | number | object): void
  (e: 'openWikiLink', payload: { target: string }): void
}>()

const noteTitle = ref('')
const editorContent = ref('')
const mdEditorRef = ref<InstanceType<typeof MilkdownEditor> | null>(null)
const sourceEditorRef = ref<HTMLTextAreaElement | null>(null)
const imageFileInput = ref<HTMLInputElement | null>(null)
const videoFileInput = ref<HTMLInputElement | null>(null)
const audioFileInput = ref<HTMLInputElement | null>(null)
const selectionContextMenu = ref({ visible: false, text: '', x: 0, y: 0 })
const mediaContextMenu = ref({ visible: false, x: 0, y: 0 })
// 媒体插入确认面板：选择文件后先问尺寸，再落到光标处
const mediaSizeDialog = ref({
  visible: false,
  kind: 'image' as MediaKind,
  fileName: '',
  dataUrl: '',
  width: null as number | null,
  height: null as number | null,
})
type ActiveTextSelection =
  | { kind: 'source'; element: HTMLTextAreaElement; start: number; end: number }
  | { kind: 'visual'; element: HTMLElement; range: Range }
type MediaInsertionSelection =
  | { kind: 'source'; start: number; end: number }
  | { kind: 'visual'; from: number; to: number }
let activeTextSelection: ActiveTextSelection | null = null
let mediaInsertionSelection: MediaInsertionSelection | null = null
const headingOptionsOpen = ref(false)
const linkInputVisible = ref(false)
const linkUrl = ref('')
const linkUrlInput = ref<HTMLInputElement | null>(null)
let lastNoteId: string | null = null

const closeSelectionContextMenu = () => {
  selectionContextMenu.value.visible = false
  headingOptionsOpen.value = false
  linkInputVisible.value = false
}

const closeMediaContextMenu = () => {
  mediaContextMenu.value.visible = false
}

const openSelectionContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  const target = event.target
  const textarea = target instanceof HTMLTextAreaElement ? target : null
  const editor = target instanceof Element ? target.closest('.ProseMirror') as HTMLElement | null : null
  const browserSelection = window.getSelection()
  const range = browserSelection?.rangeCount ? browserSelection.getRangeAt(0).cloneRange() : null
  const sourceSelection = textarea ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) : ''
  const visualSelection = editor && range && editor.contains(range.commonAncestorContainer)
    ? browserSelection?.toString() || ''
    : ''
  const selectedText = sourceSelection || visualSelection
  closeMediaContextMenu()

  if (selectedText.trim()) {
    activeTextSelection = textarea
      ? { kind: 'source', element: textarea, start: textarea.selectionStart, end: textarea.selectionEnd }
      : editor && range
        ? { kind: 'visual', element: editor, range }
        : null
    if (!activeTextSelection) return
    mediaInsertionSelection = textarea
      ? { kind: 'source', start: textarea.selectionStart, end: textarea.selectionEnd }
      : (() => {
          const selection = mdEditorRef.value?.getSelectionRange()
          return selection ? { kind: 'visual' as const, from: selection.from, to: selection.to } : null
        })()

    const menuWidth = 340
    const menuHeight = 650
    const maxX = Math.max(12, window.innerWidth - menuWidth - 12)
    const maxY = Math.max(12, window.innerHeight - menuHeight - 12)
    selectionContextMenu.value = {
      visible: true,
      text: selectedText,
      x: Math.max(12, Math.min(event.clientX, maxX)),
      y: Math.max(12, Math.min(event.clientY, maxY))
    }
    return
  }

  closeSelectionContextMenu()
  activeTextSelection = null
  if (textarea) {
    mediaInsertionSelection = { kind: 'source', start: textarea.selectionStart, end: textarea.selectionEnd }
  } else if (editor) {
    const selection = mdEditorRef.value?.getSelectionRange()
    mediaInsertionSelection = selection ? { kind: 'visual', from: selection.from, to: selection.to } : null
  } else {
    mediaInsertionSelection = null
  }
  const menuWidth = 240
  const menuHeight = 140
  const maxX = Math.max(12, window.innerWidth - menuWidth - 12)
  const maxY = Math.max(12, window.innerHeight - menuHeight - 12)
  mediaContextMenu.value = {
    visible: true,
    x: Math.max(12, Math.min(event.clientX, maxX)),
    y: Math.max(12, Math.min(event.clientY, maxY))
  }
}

const chooseMediaInsert = (kind: MediaKind) => {
  closeSelectionContextMenu()
  closeMediaContextMenu()
  // 打开文件选择器会夺走编辑器焦点，先记录落点点?
  captureInsertionPoint()
  if (kind === 'image') imageFileInput.value?.click()
  else if (kind === 'video') videoFileInput.value?.click()
  else audioFileInput.value?.click()
}

/** 记录当前光标/选区作为媒体插入落点（源码与富文本两种模式） */
const captureInsertionPoint = () => {
  const textarea = sourceEditorRef.value
  if (textarea) {
    mediaInsertionSelection = { kind: 'source', start: textarea.selectionStart, end: textarea.selectionEnd }
    return
  }
  const selection = mdEditorRef.value?.getSelectionRange()
  mediaInsertionSelection = selection ? { kind: 'visual', from: selection.from, to: selection.to } : null
}

/** 插入前恢复富文本编辑器的落点选区（文件对话框/尺寸面板会夺走焦点） */
const restoreInsertionPoint = () => {
  const selection = mediaInsertionSelection
  if (!selection || selection.kind !== 'visual') return
  mdEditorRef.value?.setSelectionRange(selection.from, selection.to)
}

const onMediaFileSelected = async (kind: MediaKind, event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith(`${kind}/`)) {
    ElMessage.error(`请选择${mediaKindLabels[kind]}文件`)
    return
  }

  try {
    const dataUrl = await readFileAsDataUrl(file)
    const described = describeMedia(dataUrl)
    if (!described) {
      ElMessage.error('不支持的媒体格式')
      return
    }
    mediaSizeDialog.value = {
      visible: true,
      kind,
      fileName: file.name,
      dataUrl,
      width: null,
      height: null,
    }
  } catch (error) {
    logger.error('[笔记] 读取媒体文件失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error('媒体读取失败')
  }
}

const cancelMediaSize = () => {
  mediaSizeDialog.value.visible = false
  mediaSizeDialog.value.dataUrl = ''
}

const confirmMediaSize = async () => {
  const dialog = mediaSizeDialog.value
  const dataUrl = dialog.dataUrl
  const kind = dialog.kind
  dialog.visible = false
  dialog.dataUrl = ''
  if (!dataUrl) return

  try {
    // 文件对话框与尺寸面板都会夺走编辑器焦点，插入前先恢复落点选区
    restoreInsertionPoint()

    // 落库为内容寻址资产：相同内容只保存一份，正文里只留引用?
    const reference = await storeMediaAsset(dataUrl)
    if (!reference) {
      ElMessage.error('媒体保存失败')
      return
    }
    const size = dialog.width || dialog.height ? { width: dialog.width || undefined, height: dialog.height || undefined } : undefined
    const snippet = buildMediaSnippet({
      kind,
      reference,
      alt: dialog.fileName,
      size,
    })
    const inserted = await insertMediaSnippet(snippet)
    if (!inserted) {
      ElMessage.error('媒体插入失败')
      return
    }
    ElMessage.success(`${mediaKindLabels[kind]}已插入笔记`)
  } catch (error) {
    logger.error('[笔记] 插入媒体失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error('媒体插入失败')
  }
}

/** 把媒体片段插入到记录好的落点；富文本模式走 ProseMirror，源码模式走 textarea */
const insertMediaSnippet = async (snippet: string): Promise<boolean> => {
  const selection = mediaInsertionSelection
  mediaInsertionSelection = null

  if (selection?.kind === 'source' && sourceEditorRef.value) {
    const source = editorContent.value
    const start = Math.max(0, Math.min(selection.start, source.length))
    const end = Math.max(start, Math.min(selection.end, source.length))
    const before = source.slice(0, start)
    const after = source.slice(end)
    const prefix = before && !before.endsWith('\n') ? '\n\n' : ''
    const suffix = after && !after.startsWith('\n') ? '\n\n' : '\n'
    editorContent.value = before + prefix + snippet + suffix + after
    await nextTick()
    const caret = before.length + prefix.length + snippet.length + suffix.length
    sourceEditorRef.value?.focus()
    sourceEditorRef.value?.setSelectionRange(caret, caret)
    return true
  }

  if (mdEditorRef.value?.insertMediaBlock(snippet)) {
    return true
  }

  // 兜底：追加到末尾并保证自成一段段?
  const current = editorContent.value.trimEnd()
  editorContent.value = current ? `${current}\n\n${snippet}` : snippet
  await nextTick()
  mdEditorRef.value?.focus()
  return true
}

const containsEmbeddedMediaText = (text: string) => containsInlineMedia(text)

const preventMediaPaste = (event: ClipboardEvent) => {
  const clipboard = event.clipboardData
  if (!clipboard) return
  const items = Array.from(clipboard.items || [])
  const files = Array.from(clipboard.files || [])
  const html = clipboard.getData('text/html')
  const text = clipboard.getData('text/plain')
  const hasMediaFile = [...items, ...files].some(item => {
    const type = 'type' in item ? String(item.type).toLowerCase() : ''
    return type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')
  })
  const hasEmbeddedMedia = containsEmbeddedMediaText(html + '\n' + text)
  if (!hasMediaFile && !hasEmbeddedMedia) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  ElMessage.info('请使用右键菜单中的“插入图片 / 视频 / 音频”添加媒体')
}

const preventMediaDrop = (event: DragEvent) => {
  const files = Array.from(event.dataTransfer?.files || [])
  const hasMediaFile = files.some(file => {
    const type = String(file.type || '').toLowerCase()
    return type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')
  })
  if (!hasMediaFile) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  ElMessage.info('请使用右键菜单中的“插入图片 / 视频 / 音频”添加媒体')
}

const restoreActiveSelection = () => {
  const active = activeTextSelection
  if (!active) return false
  if (active.kind === 'source') {
    active.element.focus({ preventScroll: true })
    active.element.setSelectionRange(active.start, active.end)
    return true
  }

  active.element.focus({ preventScroll: true })
  const selection = window.getSelection()
  if (!selection) return false
  selection.removeAllRanges()
  selection.addRange(active.range)
  return true
}

const writeClipboardText = async (content: string) => {
  let copied = false
  try {
    await navigator.clipboard.writeText(content)
    copied = true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    try {
      textarea.focus()
      textarea.select()
      copied = document.execCommand('copy')
    } catch {
      copied = false
    } finally {
      textarea.remove()
    }
  }
  return copied
}

const copySelection = async () => {
  if (await writeClipboardText(selectionContextMenu.value.text)) closeSelectionContextMenu()
}

const dispatchSourceInput = (element: HTMLTextAreaElement) => {
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

const replaceSourceSelection = (transform: (text: string) => string) => {
  const active = activeTextSelection
  if (!active || active.kind !== 'source') return false
  const { element, start, end } = active
  const selectedText = element.value.slice(start, end)
  const replacement = transform(selectedText)
  element.setRangeText(replacement, start, end, 'select')
  dispatchSourceInput(element)
  activeTextSelection = { kind: 'source', element, start, end: start + replacement.length }
  return true
}

const openSelectionLinkInput = () => {
  headingOptionsOpen.value = false
  linkUrl.value = 'https://'
  linkInputVisible.value = true
  void nextTick(() => linkUrlInput.value?.focus({ preventScroll: true }))
}

const applySelectionLink = () => {
  const url = linkUrl.value.trim()
  if (!url || !activeTextSelection) return
  if (activeTextSelection.kind === 'source') {
    replaceSourceSelection(text => `[${text}](${url})`)
  } else if (restoreActiveSelection()) {
    document.execCommand('createLink', false, url)
  }
  linkInputVisible.value = false
  closeSelectionContextMenu()
}

const toggleHeadingOptions = () => {
  linkInputVisible.value = false
  headingOptionsOpen.value = !headingOptionsOpen.value
}

const applySelectionHeading = (level: number) => {
  const active = activeTextSelection
  if (!active || level < 0 || level > 6) return
  if (active.kind === 'source') {
    const { element, start, end } = active
    const value = element.value
    const blockStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const newlineAt = value.indexOf('\n', end)
    const blockEnd = newlineAt < 0 ? value.length : newlineAt
    const marker = level === 0 ? '' : `${'#'.repeat(level)} `
    const replacement = value.slice(blockStart, blockEnd)
      .split(/\r?\n/)
      .map(line => `${marker}${line.replace(/^#{1,6}[ \t]+/, '')}`)
      .join('\n')
    element.setRangeText(replacement, blockStart, blockEnd, 'select')
    dispatchSourceInput(element)
    activeTextSelection = { kind: 'source', element, start: blockStart, end: blockStart + replacement.length }
  } else if (restoreActiveSelection()) {
    document.execCommand('formatBlock', false, level === 0 ? 'p' : `h${level}`)
  }
  headingOptionsOpen.value = false
  closeSelectionContextMenu()
}

const applySelectionFormat = (format: 'bold' | 'italic' | 'link' | 'quote' | 'code' | 'unordered' | 'ordered' | 'strike') => {
  const active = activeTextSelection
  if (!active) return

  if (format === 'link') {
    openSelectionLinkInput()
    return
  }

  if (active.kind === 'source') {
    if (format === 'quote' || format === 'unordered' || format === 'ordered') {
      const marker = format === 'quote' ? '> ' : '- '
      replaceSourceSelection(text => text.split(/\r?\n/).map((line, index) =>
        format === 'ordered' ? `${index + 1}. ${line}` : `${marker}${line}`
      ).join('\n'))
    } else {
      const marker = format === 'bold' ? '**' : format === 'italic' ? '*' : format === 'strike' ? '~~' : '`'
      replaceSourceSelection(text => `${marker}${text}${marker}`)
    }
    closeSelectionContextMenu()
    return
  }

  if (!restoreActiveSelection()) return
  if (format === 'quote') {
    document.execCommand('formatBlock', false, 'blockquote')
  } else if (format === 'unordered') {
    document.execCommand('insertUnorderedList')
  } else if (format === 'ordered') {
    document.execCommand('insertOrderedList')
  } else if (format === 'code') {
    const selectedText = window.getSelection()?.toString() || ''
    const escapedText = selectedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    document.execCommand('insertHTML', false, `<code>${escapedText}</code>`)
  } else if (format === 'strike') {
    const selectedText = window.getSelection()?.toString() || ''
    const escapedText = selectedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    if (!document.execCommand('insertHTML', false, `<del>${escapedText}</del>`)) {
      document.execCommand('strikeThrough')
    }
  } else {
    document.execCommand(format === 'bold' ? 'bold' : 'italic')
  }
  closeSelectionContextMenu()
}

const cutSelection = async () => {
  if (!(await writeClipboardText(selectionContextMenu.value.text))) return
  if (activeTextSelection?.kind === 'source') {
    const { element, start, end } = activeTextSelection
    element.setRangeText('', start, end, 'start')
    dispatchSourceInput(element)
  } else if (restoreActiveSelection()) {
    document.execCommand('delete')
  }
  closeSelectionContextMenu()
}

const pasteSelection = async () => {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    if (restoreActiveSelection()) document.execCommand('paste')
    closeSelectionContextMenu()
    return
  }

  if (containsEmbeddedMediaText(text)) {
  ElMessage.info('请使用右键菜单中的“插入图片”或“插入视频”添加媒体')
    closeSelectionContextMenu()
    return
  }

  if (activeTextSelection?.kind === 'source') {
    const { element, start, end } = activeTextSelection
    element.setRangeText(text, start, end, 'end')
    dispatchSourceInput(element)
  } else if (restoreActiveSelection()) {
    document.execCommand('insertText', false, text)
  }
  closeSelectionContextMenu()
}

const selectAllEditorText = () => {
  const active = activeTextSelection
  if (!active) return
  if (active.kind === 'source') {
    active.element.focus({ preventScroll: true })
    active.element.select()
  } else {
    active.element.focus({ preventScroll: true })
    document.execCommand('selectAll')
  }
  closeSelectionContextMenu()
}

const runNativeTextCommand = (command: 'undo' | 'redo') => {
  if (!restoreActiveSelection()) return
  document.execCommand(command)
  closeSelectionContextMenu()
}

const onSelectionMenuKeydown = (event: KeyboardEvent) => {
  // 媒体尺寸面板：Enter 确认 / Esc 取消（优先级最高，与搜索栏互不重叠）?
  if (mediaSizeDialog.value.visible) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelMediaSize()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void confirmMediaSize()
    }
    return
  }
  // 搜索栏 Esc：关闭并清除高亮（早于右键菜单，避免同时打开时误关菜单）
  if (searchBarVisible.value && event.key === 'Escape') {
    event.preventDefault()
    closeSearchBar()
    return
  }
  if (mediaContextMenu.value.visible && event.key === 'Escape') {
    event.preventDefault()
    closeMediaContextMenu()
    return
  }
  // Ctrl/Cmd+F：编辑器内搜索（阻止浏览器原生查找）
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    openSearchBar()
    return
  }
  if (!selectionContextMenu.value.visible) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (linkInputVisible.value) linkInputVisible.value = false
    else if (headingOptionsOpen.value) headingOptionsOpen.value = false
    else closeSelectionContextMenu()
    return
  }
  if (event.target instanceof HTMLInputElement) return
  if (!(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 'c') {
    event.preventDefault()
    void copySelection()
  } else if (key === 'x') {
    event.preventDefault()
    void cutSelection()
  } else if (key === 'v') {
    event.preventDefault()
    void pasteSelection()
  } else if (key === 'a') {
    event.preventDefault()
    selectAllEditorText()
  } else if (key === 'z') {
    event.preventDefault()
    runNativeTextCommand(event.shiftKey ? 'redo' : 'undo')
  } else if (key === 'y') {
    event.preventDefault()
    runNativeTextCommand('redo')
  }
}

// ====== 自动保存 ======
// - 输入防抖 800ms 后落库?
// - 切换/关闭笔记、组件卸载或窗口隐藏时强制落库未保存的修改
// - savedTitle/savedContent 为「已发出保存」快照，用于去重与切换前差异判断
const AUTOSAVE_DELAY = 800
let savedTitle = ''
let savedContent = ''
let justSavedForId: string | null = null // 刚发出保存的笔记 id：防止保存回写触发内容重置?
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
const savedAt = ref<Date | null>(null)

const savedAtText = computed(() => (savedAt.value ? dayjs(savedAt.value).format('HH:mm:ss') : ''))

// 字数统计直接取编辑器当前内容（比由父组件按已落库内容计算更实时）
const totalWordCount = computed(() => {
  const text = getMdPlainText(editorContent.value)
  return text.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length
})

// 大纲
const outline = ref<MdOutlineItem[]>([])
const sidebarCollapsed = ref(true)
const toggleSidebar = () => { sidebarCollapsed.value = !sidebarCollapsed.value }

const refreshOutline = () => {
  outline.value = extractMdOutline(editorContent.value)
}

// 滚动到指定标题位置置?
const scrollToHeading = (item: MdOutlineItem) => {
  const md = editorContent.value || ''
  const totalLines = md ? md.split('\n').length : 1
  const ratio = item.line / totalLines

  // 滚动块容器（源码模式下无 Milkdown 容器，跳过比例滚动）
  const container = mdEditorRef.value?.blocksContainerRef
  if (container) {
    container.scrollTo({ top: ratio * container.scrollHeight, behavior: 'smooth' })
  }

  // 按标题文本在编辑容器内精确定位位?
  const selector = Array.from({ length: 6 }, (_, i) => `h${i + 1}`).join(',')
  const headings: NodeListOf<HTMLElement> = container
    ? container.querySelectorAll(selector)
    : document.querySelectorAll(selector)
  const searchText = item.text.trim()
  for (const h of headings) {
    if ((h.textContent || '').trim() === searchText) {
      h.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }
  }
}

  /** 立即保存 targetNote 的当前编辑内容（内容仍留在 editorContent 中时调用）*/
const flushPending = (targetNote: Note) => {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  const title = noteTitle.value.trim() || '新笔记'
  const content = editorContent.value
  if (title === savedTitle && content === savedContent) return
  savedTitle = title
  savedContent = content
  justSavedForId = targetNote.id
  savedAt.value = new Date()
  emit('save', {
    id: targetNote.id,
    title,
    content,
    pinned: targetNote.pinned || false,
  })
}

const scheduleAutosave = () => {
  if (!props.note) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    if (props.note) flushPending(props.note)
  }, AUTOSAVE_DELAY)
}

watch([editorContent, noteTitle], scheduleAutosave)

// 监听笔记切换
watch(() => props.note, (note, oldNote) => {
  // 切换/关闭笔记前，强制落库旧笔记的未保存修改（此刻 editorContent 仍是旧内容）
  if (oldNote && (!note || note.id !== oldNote.id)) {
    flushPending(oldNote)
    // 旧笔记的匹配位置已失效：清空查询与高亮，避免残留到新笔记
    closeSearchBar()
  }
  if (!note) {
    lastNoteId = null
    return
  }
  if (justSavedForId && note.id === justSavedForId) {
    // 自动保存回写：只消费标记，不重置编辑内容
    justSavedForId = null
    lastNoteId = note.id
    return
  }
  const isNewNote = note.id !== lastNoteId
  lastNoteId = note.id
  if (!isNewNote) return
  noteTitle.value = note.title
  editorContent.value = note.content || ''
  savedTitle = note.title
  savedContent = note.content || ''
  nextTick(refreshOutline)
}, { immediate: true })

const formatTime = (date?: string): string => {
  if (!date) return ''
  const d = dayjs(date)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : ''
}

const forwardExportCommand = (command: string | number | object) => emit('export', command)

  // 父组件调用以更新笔记标题（属性栏标题输入）
const setNoteTitle = (title: string) => {
  noteTitle.value = title
}

// 源码模式：Tab 插入两个空格而非移动焦点
const onSourceKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const el = e.currentTarget as HTMLTextAreaElement
  const { selectionStart, selectionEnd, value } = el
  editorContent.value = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd)
  nextTick(() => {
    el.selectionStart = el.selectionEnd = selectionStart + 2
  })
}

// ====== 编辑器内搜索 ======
  // 富文本模式：查询与跳转都委托给 MilkdownEditor（ProseMirror 装饰器高亮）；
  // 源码模式：这里自行匹配 textarea 内容，用原生 setSelectionRange 定位。
  // 两边共用 findMatches，保证「第 N 处」语义一致。
const MAX_SEARCH_MATCHES = MAX_MATCHES

const searchBarVisible = ref(false)
const searchQuery = ref('')
const searchCaseSensitive = ref(false)
const searchRegex = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchMatches = ref<Array<{ start: number; end: number }>>([])
const searchActiveIndex = ref(-1)
const searchTruncated = ref(false)
const searchRegexError = ref('')

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const searchTotal = computed(() => searchMatches.value.length)

const searchCountText = computed(() => {
  if (!searchQuery.value.trim()) return '0/0'
  if (searchRegexError.value) return '无效'
  if (!searchTotal.value) return '0/0'
  const current = searchActiveIndex.value >= 0 ? searchActiveIndex.value + 1 : '?'
  return `${current}/${searchTotal.value}`
})

const clearSearchDebounce = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
}

/** 重新匹配并同步到富文本编辑器（源码模式只更新本地计数）*/
const runSearch = () => {
  const query = searchQuery.value
  if (!query.trim()) {
    searchMatches.value = []
    searchActiveIndex.value = -1
    searchTruncated.value = false
    searchRegexError.value = ''
    if (!props.sourceMode) mdEditorRef.value?.clearSearch()
    return
  }

  // 富文本：匹配 Cream 的 markdown 全文（与正文存储形态一致）
  // 源码：匹配 textarea 的原始内容
  const text = props.sourceMode
    ? (sourceEditorRef.value?.value ?? editorContent.value)
    : editorContent.value
  const result = findMatches(text, query, {
    caseSensitive: searchCaseSensitive.value,
    regex: searchRegex.value,
  })

  searchTruncated.value = result.truncated
  searchRegexError.value = result.regexError
  // 新查询默认不高亮任何一处，等用户按 Enter/箭头再定位
  searchActiveIndex.value = -1

  // 富文本：把匹配区间交给编辑器做映射与高亮（单一数据源）。
  // 编辑器返回「可高亮」的子集，这里直接用它作为权威列表，
  // 保证计数与高亮数量、跳转目标三者一致；
  // 跨块匹配（如正则跨越段落）会被过滤，这是已知且可接受的降级。
  if (!props.sourceMode) {
    searchMatches.value = mdEditorRef.value?.setSearchMatches(result.matches, -1) ?? result.matches
  } else {
    searchMatches.value = result.matches
  }
}

/** 输入防抖：避免长笔记下每次按键都全量重算 */
const onSearchInput = () => {
  clearSearchDebounce()
  searchDebounceTimer = setTimeout(runSearch, 120)
}

/** 跳到第 index 处；富文本委托 MilkdownEditor，源码直接设选区 */
const focusSearchMatch = (index: number) => {
  if (index < 0 || index >= searchMatches.value.length) return
  searchActiveIndex.value = index

  if (props.sourceMode) {
    const textarea = sourceEditorRef.value
    const match = searchMatches.value[index]
    if (textarea && match) {
      // 不 focus：焦点须留在搜索框，否则 Enter/Shift+Enter 会被
      // textarea 当作换行处理，改坏正文。setSelectionRange 仍会高亮选区。
      textarea.setSelectionRange(match.start, match.end)
      // textarea 不会自动滚动到选区，手动按行高估算滚动位置
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20
      const linesBefore = textarea.value.slice(0, match.start).split('\n').length - 1
      const targetTop = linesBefore * lineHeight
      const viewTop = textarea.scrollTop
      const viewBottom = viewTop + textarea.clientHeight
      if (targetTop < viewTop || targetTop > viewBottom - lineHeight) {
        textarea.scrollTop = Math.max(0, targetTop - textarea.clientHeight / 2)
      }
    }
    return
  }

  // 跳转只改 PM 选区，但 Cream 会随之重新序列化全文；标记 navigating
  // 屏蔽这次回写引发的重搜，待其稳定后再按当前正文校准一次匹配，
  // 并尽量保留用户当前所在的匹配项。
  if (!props.sourceMode) {
    navigatingMatch = true
    mdEditorRef.value?.focusMatch(index)
    nextTick(() => {
      setTimeout(() => {
        navigatingMatch = false
        const activeBefore = searchActiveIndex.value
        runSearch()
        if (activeBefore >= 0 && activeBefore < searchMatches.value.length) {
          searchActiveIndex.value = activeBefore
          mdEditorRef.value?.setSearchMatches(searchMatches.value, activeBefore)
        }
      }, 60)
    })
    return
  }

  mdEditorRef.value?.focusMatch(index)
}

/** 循环跳转：direction 1 下一处，-1 上一处 */
const stepSearch = (direction: 1 | -1) => {
  if (!searchTotal.value) return
  const next = nextMatchIndex(searchActiveIndex.value, searchTotal.value, direction)
  focusSearchMatch(next)
}

const toggleCaseSensitive = () => {
  searchCaseSensitive.value = !searchCaseSensitive.value
  runSearch()
}

const toggleRegex = () => {
  searchRegex.value = !searchRegex.value
  runSearch()
}

const openSearchBar = () => {
  if (searchBarVisible.value) {
    // 已打开：聚焦输入框并全选，方便直接改关键词
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
    return
  }
  searchBarVisible.value = true
  nextTick(() => {
    searchInputRef.value?.focus()
    // 预填当前选中文本，省一次输入
    const selected = props.sourceMode
      ? (() => {
          const el = sourceEditorRef.value
          return el ? el.value.slice(el.selectionStart, el.selectionEnd) : ''
        })()
      : (window.getSelection()?.toString() || '')
    const seed = (selected || '').trim()
    if (seed) {
      searchQuery.value = seed
      runSearch()
    }
  })
}

const closeSearchBar = () => {
  clearSearchDebounce()
  searchBarVisible.value = false
  searchQuery.value = ''
  searchMatches.value = []
  searchActiveIndex.value = -1
  searchTruncated.value = false
  searchRegexError.value = ''
  if (!props.sourceMode) mdEditorRef.value?.clearSearch()
}

const toggleSearchBar = () => {
  if (searchBarVisible.value) closeSearchBar()
  else openSearchBar()
}

/** 搜索框内键盘：Enter/Shift+Enter 跳转，Esc 关闭 */
const onSearchKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    stepSearch(e.shiftKey ? -1 : 1)
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    closeSearchBar()
  }
}

// 富文本 ↔ 源码切换：两边的匹配位置基准不同，保留查询词但重置选中态，
    // 并按新模式重新匹配（markdown 全文 vs textarea 原文）。
watch(() => props.sourceMode, () => {
  if (!searchBarVisible.value) return
  searchActiveIndex.value = -1
  runSearch()
})

// 正文变化时刷新匹配：编辑会让旧偏移失效，重新匹配才能保证跳转准确。
// 仅在有查询词时刷新，避免给无搜索的常规编辑增加开销。
//
// 跳转保护：focusMatch 会改 PM 选区，Cream 随后重新序列化全文，
// 可能产生与跳转前不同的 markdown（例如空段落序列化成 <br />）。
// 这类「跳转引发的变化」不是用户编辑，若据此重搜会把刚设好的
// activeIndex 与匹配列表重置掉，表现为「跳到第 1 处后计数变 0」。
// 因此跳转期间置位 navigating，屏蔽刷新；跳转结束后再按当前正文校准一次。
let navigatingMatch = false

watch(editorContent, () => {
  if (!searchBarVisible.value || !searchQuery.value.trim()) return
  if (navigatingMatch) return
  clearSearchDebounce()
  searchDebounceTimer = setTimeout(runSearch, 200)
})

// 组件卸载 / 窗口隐藏时强制落库，避免退出丢失未保存修改
const flushOnLeave = () => {
  const note = props.note
  if (note && note.id === lastNoteId) flushPending(note)
}
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  document.addEventListener('keydown', onSelectionMenuKeydown)
})
onBeforeUnmount(() => {
  flushOnLeave()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  document.removeEventListener('keydown', onSelectionMenuKeydown)
  if (autosaveTimer) clearTimeout(autosaveTimer)
  clearSearchDebounce()
})
const onVisibilityChange = () => {
  if (document.visibilityState === 'hidden') flushOnLeave()
}

defineExpose({ setNoteTitle, sidebarCollapsed, toggleSidebar })

let lastFallbackNoteId: unknown = Symbol('initial-note')
watchNoteTitleFallback(
  () => {
    const note = (props as any).note
    return [note?.id, note?.title, note?.content] as const
  },
  ([id, title, content]) => {
    const isNewNote = id !== lastFallbackNoteId
    lastFallbackNoteId = id
    const storedTitle = String(title || '').trim()
    if (!isNewNote && !storedTitle && noteTitle.value.trim()) return
    const markdownTitle = String(content || '').match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim()
    noteTitle.value = storedTitle || markdownTitle || ''
  },
  { immediate: true }
)
</script>

<style scoped>
.editor-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  color: #e0e0e0;
  line-height: 1.8;
  padding: 16px;
  gap: 16px;
  background: transparent;
}

/* ====== 主容器 ====== */
.editor-main {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  gap: 16px;
}

/* ====== 侧边栏 ====== */
.editor-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.25s ease;
}

.editor-sidebar.collapsed {
  width: 40px;
}

.editor-sidebar-inner {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
  scrollbar-width: none;
}

.editor-sidebar.collapsed .editor-sidebar-inner {
  padding: 8px 6px;
  overflow: hidden;
}

.editor-sidebar-inner::-webkit-scrollbar { display: none; }

.editor-sidebar-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.65);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.editor-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-left: 4px;
}

.sidebar-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.sidebar-toggle-btn:hover {
  background: rgba(102, 126, 234, 0.18);
  color: #93c5fd;
}

.editor-sidebar.collapsed .editor-sidebar-header {
  margin-bottom: 0;
  padding-left: 0;
  justify-content: center;
}

.editor-sidebar.collapsed .sidebar-toggle-btn {
  width: 28px;
  height: 28px;
  font-size: 13px;
}

.editor-sidebar-nav {
  list-style: none;
  padding: 0;
  margin: 0;
  position: relative;
}

.editor-sidebar-nav li { margin: 2px 0; line-height: 1.4; position: relative; }

/* 竖线连接线段：非首项从上一项圆点延伸到本项圆点，使相邻两点之间连线连贯；首项上方、末项下方均不延伸 */
.editor-sidebar-nav li:not(:first-child)::before {
  content: '';
  position: absolute;
  left: 7px;
  top: -50%;
  width: 1px;
  height: 100%;
  background: rgba(102, 126, 234, 0.25);
}

/* 层级引导线：横线 + 节点圆点，横线长度随层级递增 */
.editor-sidebar-nav a { position: relative; }
.editor-sidebar-nav a::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 7px;
  transform: translateY(-50%);
  height: 1px;
  background: rgba(102, 126, 234, 0.35);
}
.editor-sidebar-nav a::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 7px;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(102, 126, 234, 0.55);
}
.editor-sidebar-nav a:hover::after { background: #93c5fd; }

/* 层级视觉区分：逐级增横线长度 + 缩进 + 递减字号/字重/颜色 */
.editor-sidebar-nav .nav-l1 a {
  display: flex;
  align-items: center;
  padding: 5px 8px 5px 22px;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.88);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.editor-sidebar-nav .nav-l1 a::before { width: 13px; }
.editor-sidebar-nav .nav-l1 a:hover { background: rgba(102, 126, 234, 0.18); color: #93c5fd; }

.editor-sidebar-nav .nav-l2 a {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 30px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.editor-sidebar-nav .nav-l2 a::before { width: 21px; }
.editor-sidebar-nav .nav-l2 a:hover { background: rgba(102, 126, 234, 0.14); color: #93c5fd; }

.editor-sidebar-nav .nav-l3 a {
  display: flex;
  align-items: center;
  padding: 3px 8px 3px 38px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.58);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.editor-sidebar-nav .nav-l3 a::before { width: 29px; }
.editor-sidebar-nav .nav-l3 a:hover { background: rgba(102, 126, 234, 0.1); color: #93c5fd; }

.editor-sidebar-nav .nav-l4 a,
.editor-sidebar-nav .nav-l5 a,
.editor-sidebar-nav .nav-l6 a {
  display: flex;
  align-items: center;
  padding: 3px 8px 3px 46px;
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.45);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.editor-sidebar-nav .nav-l4 a::before,
.editor-sidebar-nav .nav-l5 a::before,
.editor-sidebar-nav .nav-l6 a::before { width: 37px; }
.editor-sidebar-nav .nav-l4 a:hover,
.editor-sidebar-nav .nav-l5 a:hover,
.editor-sidebar-nav .nav-l6 a:hover { background: rgba(102, 126, 234, 0.08); color: #93c5fd; }

.nav-title-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-empty {
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  padding: 8px 4px;
}

/* ====== 主内容区 ====== */
.editor-content-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.editor-viewport {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}

/* ====== 底部状态栏 ====== */
.editor-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--chalk-muted);
}

.editor-status-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.editor-status-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 4px;
}

.editor-status-sep {
  color: rgba(255, 255, 255, 0.1);
}

.editor-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  flex-shrink: 0;
  transition: all 0.15s;
}

.editor-action-btn:hover {
  color: #93c5fd;
  background: rgba(102, 126, 234, 0.12);
  border-color: rgba(102, 126, 234, 0.45);
}

.editor-action-btn.outline-toggle {
  border-color: rgba(167, 139, 250, 0.5);
  background: rgba(167, 139, 250, 0.15);
  color: #d8b4fe;
}

.editor-action-btn.outline-toggle:hover {
  background: rgba(167, 139, 250, 0.3);
  color: #ede9fe;
}

.editor-action-btn.on {
  border-color: rgba(167, 139, 250, 0.45);
  background: rgba(167, 139, 250, 0.12);
  color: #d8b4fe;
}

.editor-action-btn.favorite.on {
  color: var(--chalk-amber);
}

.editor-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.editor-status-right :deep(.el-dropdown) {
  display: inline-flex;
}

/* ====== 编辑器内搜索浮层 ====== */
.editor-search-bar {
  position: absolute;
  top: 10px;
  right: 14px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid rgba(196, 181, 253, 0.22);
  border-radius: 10px;
  background: rgba(28, 25, 54, 0.96);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(16px);
}

.editor-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid rgba(196, 181, 253, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  transition: border-color 0.15s ease;
}

.editor-search-input-wrap:focus-within {
  border-color: rgba(167, 139, 250, 0.6);
}

.editor-search-input-wrap.is-error {
  border-color: rgba(248, 113, 113, 0.7);
}

.editor-search-icon {
  display: inline-flex;
  color: rgba(245, 243, 255, 0.45);
  font-size: 13px;
}

.editor-search-input {
  width: 168px;
  border: none;
  outline: none;
  color: #f4f1ff;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
}

.editor-search-input::placeholder {
  color: rgba(245, 243, 255, 0.35);
}

.editor-search-chip {
  height: 22px;
  min-width: 28px;
  padding: 0 6px;
  border: 1px solid rgba(196, 181, 253, 0.2);
  border-radius: 6px;
  color: rgba(245, 243, 255, 0.55);
  background: rgba(255, 255, 255, 0.04);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.editor-search-chip:hover {
  color: #ede9fe;
  background: rgba(255, 255, 255, 0.1);
}

.editor-search-chip.on {
  border-color: rgba(167, 139, 250, 0.55);
  color: #d8b4fe;
  background: rgba(139, 92, 246, 0.22);
}

.editor-search-count {
  min-width: 40px;
  color: rgba(245, 243, 255, 0.7);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

.editor-search-count.is-empty {
  color: rgba(248, 113, 113, 0.85);
}

.editor-search-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

.editor-search-step,
.editor-search-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  color: rgba(245, 243, 255, 0.6);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.editor-search-step:hover:not(:disabled),
.editor-search-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.editor-search-step:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.editor-search-error,
.editor-search-hint {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  margin: 0;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
}

.editor-search-error {
  color: #fca5a5;
  background: rgba(127, 29, 29, 0.85);
}

.editor-search-hint {
  color: rgba(245, 243, 255, 0.6);
  background: rgba(28, 25, 54, 0.92);
}

/* ====== 源码模式 ====== */
.editor-source {
  flex: 1;
  width: 100%;
  min-height: 0;
  padding: 16px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: #cbd5e1;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  caret-color: #a78bfa;
}

.editor-source::placeholder {
  color: rgba(203, 213, 225, 0.35);
}

/* ====== 自动保存指示 ====== */
.editor-autosave {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.85);
}

/* ====== 响应式 ====== */
@media (max-width: 768px) {
  .editor-wrap {
    padding: 8px;
    gap: 8px;
  }

  .editor-main {
    gap: 8px;
    flex-direction: column;
  }

  .editor-sidebar {
    width: 100%;
    height: auto;
    flex-shrink: 0;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .editor-sidebar.collapsed {
    width: 40px;
    overflow: hidden;
  }

  .editor-sidebar::-webkit-scrollbar { display: none; }

  .editor-sidebar-inner {
    padding: 8px 12px;
    overflow: visible;
  }

  .editor-sidebar-title { display: none; }

  .editor-sidebar-nav {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
  }

  .editor-sidebar-nav li { margin: 0; white-space: nowrap; }
  .editor-sidebar-nav .nav-l1 a { padding: 4px 10px; font-size: 13px; }
  .editor-sidebar-nav .nav-l2 a { padding: 4px 8px 4px 10px; font-size: 12px; }
  .editor-sidebar-nav .nav-l3 a { padding: 4px 6px 4px 14px; font-size: 11px; }
  /* 移动端横向标签流，不显示层级引导 */
  .editor-sidebar-nav li::before,
  .editor-sidebar-nav a::before,
  .editor-sidebar-nav a::after { display: none; }

  .editor-status-bar { padding: 6px 10px; font-size: 11px; flex-wrap: wrap; gap: 4px; }
  .editor-status-left { gap: 6px; }
}

/* 全屏编辑按钮（状态栏右侧） */
.editor-fs-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(167, 139, 250, 0.4);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}
.editor-fs-btn:hover {
  border-color: rgba(167, 139, 250, 0.6);
  background: rgba(167, 139, 250, 0.12);
  color: #d8b4fe;
}

/* 收起大纲按钮：紫系圆形（重设计） */
.sidebar-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(167, 139, 250, 0.5);
  border-radius: 999px;
  background: rgba(167, 139, 250, 0.15);
  color: #d8b4fe;
  cursor: pointer;
}
.sidebar-toggle-btn:hover {
  background: rgba(167, 139, 250, 0.3);
  color: #ede9fe;
}
.note-text-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: transparent;
}

.note-text-menu {
  position: fixed;
  width: min(340px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  padding: 9px;
  border: 1px solid rgba(196, 181, 253, 0.22);
  border-radius: 15px;
  color: #f4f1ff;
  background: rgba(28, 25, 54, 0.97);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.025) inset;
  backdrop-filter: blur(18px);
  animation: note-text-menu-in 120ms ease-out;
}

.note-media-insert-menu {
  width: min(240px, calc(100vw - 24px));
}

/* 媒体插入尺寸面板 */
.note-media-size-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 20, 0.55);
  backdrop-filter: blur(2px);
}

.note-media-size-dialog {
  width: min(320px, calc(100vw - 32px));
  padding: 16px;
  border: 1px solid rgba(196, 181, 253, 0.22);
  border-radius: 14px;
  background: rgba(28, 25, 54, 0.98);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.note-media-size-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  color: #f4f1ff;
  font-size: 14px;
  font-weight: 650;
}

.note-media-size-meta {
  overflow: hidden;
  max-width: 55%;
  color: rgba(245, 243, 255, 0.5);
  font-size: 11px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-media-size-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.note-media-size-row label {
  flex: 0 0 76px;
  color: rgba(245, 243, 255, 0.75);
  font-size: 12px;
}

.note-media-size-row input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(196, 181, 253, 0.2);
  border-radius: 8px;
  color: #f4f1ff;
  background: rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

.note-media-size-row input:focus {
  border-color: rgba(167, 139, 250, 0.6);
  outline: none;
}

.note-media-size-hint {
  margin: 2px 0 14px;
  color: rgba(245, 243, 255, 0.45);
  font-size: 11px;
  line-height: 1.5;
}

.note-media-size-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.note-text-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 4px 7px;
  color: rgba(245, 243, 255, 0.86);
  font-size: 12px;
  font-weight: 650;
}

.note-text-menu-count {
  padding: 2px 7px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 999px;
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.12);
  font-size: 10px;
  font-weight: 500;
}

.note-text-menu-section-title {
  margin: 8px 3px 6px;
  color: rgba(226, 221, 245, 0.48);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.04em;
}

.note-text-menu-format-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

.note-text-menu-format {
  display: flex;
  min-width: 0;
  min-height: 48px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 4px 2px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #e9e4fa;
  background: rgba(255, 255, 255, 0.035);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.note-text-menu-format:hover,
.note-text-menu-format:focus-visible {
  border-color: rgba(167, 139, 250, 0.22);
  outline: none;
  background: rgba(139, 92, 246, 0.16);
}

.note-text-menu-format > :first-child { color: #c4b5fd; font-size: 14px; line-height: 1; }
.note-text-menu-format code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.note-text-menu-format .format-symbol { font-size: 16px; }
.note-text-menu-divider { height: 1px; margin: 9px 2px 6px; background: rgba(255, 255, 255, 0.08); }

.note-text-menu-submenu {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  padding: 6px;
  border: 1px solid rgba(167, 139, 250, 0.16);
  border-radius: 9px;
  background: rgba(10, 9, 25, 0.45);
}

.note-text-menu-submenu button,
.note-text-menu-link-form button {
  min-height: 28px;
  padding: 4px 9px;
  border: 1px solid rgba(167, 139, 250, 0.16);
  border-radius: 7px;
  color: #e9e4fa;
  background: rgba(255, 255, 255, 0.045);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.note-text-menu-submenu button:hover,
.note-text-menu-link-form button:hover { background: rgba(139, 92, 246, 0.2); }

.note-text-menu-link-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 5px;
  margin-top: 7px;
}

.note-text-menu-link-form input {
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 7px;
  outline: none;
  color: #f4f1ff;
  background: rgba(10, 9, 25, 0.65);
  font: inherit;
  font-size: 11px;
}

.note-text-menu-link-form input:focus { border-color: rgba(167, 139, 250, 0.6); }
.note-text-menu-link-form button[type='submit'] { color: #fff; background: rgba(139, 92, 246, 0.55); }
.note-text-menu-link-form button.cancel { color: rgba(226, 221, 245, 0.65); }

.note-text-menu-actions { display: grid; gap: 3px; }

.note-text-menu-action {
  display: flex;
  width: 100%;
  min-height: 43px;
  align-items: center;
  gap: 9px;
  padding: 5px 7px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
}

.note-text-menu-action:hover,
.note-text-menu-action:focus-visible {
  border-color: rgba(167, 139, 250, 0.18);
  outline: none;
  background: rgba(139, 92, 246, 0.16);
}

.note-text-menu-action:active { transform: scale(0.985); }
.note-text-menu-action.compact { min-height: 34px; }
.note-text-menu-action.compact .note-text-menu-icon { width: 23px; height: 23px; font-size: 10px; }
.note-text-menu-action.compact .note-text-menu-label strong { font-size: 11px; }

.note-text-menu-icon {
  display: grid;
  width: 27px;
  height: 27px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.16);
  font-size: 12px;
  font-weight: 700;
}

.note-text-menu-icon.quote { font-size: 18px; }
.note-text-menu-label { display: grid; flex: 1; gap: 2px; }
.note-text-menu-label strong { font-size: 12px; font-weight: 600; }
.note-text-menu-label small { color: rgba(226, 221, 245, 0.48); font-size: 10px; }

.note-text-menu-action kbd {
  padding: 2px 5px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 5px;
  color: rgba(226, 221, 245, 0.48);
  font-family: inherit;
  font-size: 10px;
}

.note-text-menu-hint {
  margin: 5px 4px 0;
  padding-top: 7px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(226, 221, 245, 0.38);
  font-size: 10px;
  text-align: right;
}

@keyframes note-text-menu-in {
  from { opacity: 0; transform: translateY(-3px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

</style>


