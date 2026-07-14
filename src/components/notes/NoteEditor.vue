<template>
  <div class="editor-wrap">
    <!-- 主容器 -->
    <div class="editor-main">
      <!-- 侧边栏导航 -->
      <aside class="editor-sidebar">
        <div class="editor-sidebar-inner">
          <div class="editor-sidebar-header">
            <span class="editor-sidebar-title">目录</span>
          </div>
          <ul class="editor-sidebar-nav">
            <template v-for="(page, idx) in pages" :key="page.id">
              <li
                :class="['nav-l' + page.level, { 'nav-dragging': dragIdx === idx, 'nav-drop-target': dragOverIdx === idx && dragIdx !== -1 && dragIdx !== idx }]"
                @pointerdown="onNavPointerDown($event, idx)"
                @contextmenu.prevent.stop="handleNavContextmenu($event, idx)"
              >
                <a :class="{ active: currentPageIdx === idx }" @click="goToSlide(idx)">
                  <span class="nav-num">{{ computePageNumber(pages, idx) }}</span>
                  <input
                    v-if="renamingIdx === idx"
                    :ref="(el) => setRenameInputRef(el as HTMLInputElement | null)"
                    v-model="renamingInput"
                    class="nav-rename-input"
                    @click.stop
                    @pointerdown.stop
                    @keyup.enter="commitRename"
                    @blur="commitRename"
                  />
                  <span v-else class="nav-title-text">{{ page.title || '未命名' }}</span>
                </a>
              </li>
            </template>
          </ul>
        </div>
      </aside>

      <!-- 主内容区 -->
      <div class="editor-content-area">
        <div class="editor-viewport">
          <div class="editor-body">
            <div class="editor-content-wrap">
              <div class="editor-toolbar" v-if="!isCoverPage && !isThanksPage">
                <select class="editor-tb-select editor-tb-font" :disabled="!hasSelection" :value="currentFont" @change="onFontChange(($event.target as HTMLSelectElement).value)" title="字体">
                  <option value="" disabled hidden></option>
                  <option v-if="currentFont && !isFontInList(currentFont)" :value="currentFont" :style="{ fontFamily: currentFont }">{{ currentFont }}</option>
                  <optgroup v-if="usedFonts.length" label="页面正在使用的字体">
                    <option v-for="f in usedFonts" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
                  </optgroup>
                  <optgroup label="常用字体">
                    <option v-for="f in commonFonts" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
                  </optgroup>
                </select>
                <select class="editor-tb-select editor-tb-size" :disabled="!hasSelection" :value="currentFontSize" @change="onFontSizeChange(($event.target as HTMLSelectElement).value)" title="字号">
                  <option value="" disabled hidden></option>
                  <option v-if="currentFontSize && !isSizeInList(currentFontSize)" :value="currentFontSize">{{ currentFontSize }}</option>
                  <optgroup label="中文字号">
                    <option v-for="s in cnFontSizes" :key="s.name" :value="s.pt + 'pt'">{{ s.name }}</option>
                  </optgroup>
                  <optgroup label="数字字号">
                    <option v-for="s in numFontSizes" :key="s" :value="s + 'pt'">{{ s }}</option>
                  </optgroup>
                </select>
                <select class="editor-tb-select" @change="exec('formatBlock', ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
                  <option value="">正文</option>
                  <option value="H1">标题1</option>
                  <option value="H2">标题2</option>
                  <option value="H3">标题3</option>
                  <option value="H4">标题4</option>
                  <option value="H5">标题5</option>
                  <option value="H6">标题6</option>
                </select>
                <button class="editor-tb-btn" :disabled="!hasSelection" @click="exec('bold')" title="加粗"><b>B</b></button>
                <button class="editor-tb-btn" :disabled="!hasSelection" @click="exec('italic')" title="斜体"><i>I</i></button>
                <div class="editor-tb-underline-wrap">
                  <button class="editor-tb-btn editor-tb-underline-btn" :disabled="!hasSelection" @click="toggleUnderlineMenu" title="下划线">
                    <span class="editor-tb-underline-preview"><u>U</u></span>
                  </button>
                  <div v-if="underlineMenuVisible" class="underline-menu" @click.stop @mousedown.prevent>
                    <div class="underline-menu-styles">
                      <button v-for="s in underlineStyles" :key="s.name" class="underline-menu-item" @click="applyUnderlineStyle(s.css)">
                        <span class="underline-menu-line" :style="s.lineStyle">{{ s.name === '波浪线' ? '\u00A0' : '' }}</span>
                      </button>
                    </div>
                    <div class="underline-menu-divider"></div>
                    <button class="underline-menu-item underline-menu-none" @click="removeUnderline">
                      <span class="underline-menu-name">无</span>
                    </button>
                    <div class="underline-menu-divider"></div>
                    <div class="underline-color-item" @click="toggleUnderlineColorPanel($event)">
                      <span class="underline-menu-name">下划线颜色</span>
                      <span class="underline-menu-arrow">›</span>
                    </div>
                  </div>
                </div>
                <button class="editor-tb-btn" :disabled="!hasSelection" @click="exec('strikeThrough')" title="删除线"><s>S</s></button>
                
                <div class="editor-tb-font-color-wrap">
                  <button class="editor-tb-btn editor-tb-font-color-btn" :class="{ active: fontColorPanelVisible }" :disabled="!hasSelection" @click="toggleFontColorPanel" title="字体颜色">
                    <span class="editor-tb-font-color-swatch" :style="{ background: currentFontColor }">A</span>
                  </button>
                  <div v-if="fontColorPanelVisible" class="font-color-panel-wrap">
                    <ColorPickerPanel
                      :modelValue="currentFontColor"
                      @apply="applyFontColor"
                      @cancel="fontColorPanelVisible = false"
                    />
                  </div>
                </div>
                <button class="editor-tb-btn" @click="exec('insertUnorderedList')" title="项目符号">•</button>
                <button class="editor-tb-btn" @click="exec('insertOrderedList')" title="数字编号">1.</button>
                <div class="editor-tb-align">
                  <button class="editor-tb-align-btn" :class="{ active: currentAlign === 'left' }" @click="execAlign('left')" title="左对齐">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                  </button>
                  <button class="editor-tb-align-btn" :class="{ active: currentAlign === 'center' }" @click="execAlign('center')" title="居中">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                  </button>
                  <button class="editor-tb-align-btn" :class="{ active: currentAlign === 'right' }" @click="execAlign('right')" title="右对齐">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
                  </button>
                </div>
                <div class="editor-tb-sep"></div>
                <button class="editor-tb-btn" @click="exec('formatBlock', 'blockquote')" title="引用">❝</button>
                <button class="editor-tb-btn" @click="insertHtmlCodeBlock" title="插入 HTML 代码">&lt;/&gt;</button>
                <button class="editor-tb-btn" @click="exec('undo')" title="撤销">↶</button>
                <div class="editor-tb-sep"></div>
                <button class="editor-tb-btn" :disabled="!hasSelection" @click="copySelectionStyle" title="复制样式">📋</button>
                <button class="editor-tb-btn" :disabled="!hasSelection || !savedStyle" @click="applySelectionStyle" title="应用样式">📌</button>
              </div>
              <div
                v-if="!isThanksPage"
                ref="contentRef"
                class="editor-content"
                :contenteditable="!isCoverPage"
                @paste="handlePaste"
              ></div>
              <div v-else class="editor-thanks-wrap">
                <div class="editor-thanks-display" v-html="pages[currentPageIdx]?.content"></div>
              </div>
            </div>
          </div>

          <!-- 底部导航栏 -->
          <div class="slide-nav">
            <div class="slide-nav-side slide-nav-left">
              <button class="slide-nav-btn" :disabled="currentPageIdx <= 0" @click="goToSlide(currentPageIdx - 1)" title="上一页">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span class="slide-nav-prev-title">{{ currentPageIdx > 0 ? (pages[currentPageIdx - 1]?.title || '') : '' }}</span>
            </div>
            <div class="slide-nav-center">
              <span class="slide-nav-curr-title">{{ pages[currentPageIdx]?.title || '' }}</span>
              <span class="slide-nav-counter">{{ pages.length ? (currentPageIdx + 1) + ' / ' + pages.length : '0 / 0' }}</span>
            </div>
            <div class="slide-nav-side slide-nav-right">
              <span class="slide-nav-next-title">{{ currentPageIdx < pages.length - 1 ? (pages[currentPageIdx + 1]?.title || '') : '' }}</span>
              <button class="slide-nav-btn" :disabled="currentPageIdx >= pages.length - 1" @click="goToSlide(currentPageIdx + 1)" title="下一页">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="editor-status-bar">
      <div class="editor-status-left">
        <button class="editor-back-btn" @click="handleBack" title="返回笔记列表">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <span>{{ clockDisplay }}</span>
        <span class="editor-status-sep">|</span>
        <span>全文字数: {{ totalWordCount }}</span>
        <span class="editor-status-sep">|</span>
        <span>创建于 {{ formatTime(note?.createdAt) }}</span>
        <span class="editor-status-sep">|</span>
        <span>更新于 {{ formatTime(note?.updatedAt) }}</span>
      </div>
      <div class="editor-status-right">
        <button class="editor-pin-btn" :class="{ active: note?.pinned }" @click="$emit('togglePin')" :title="note?.pinned ? '取消置顶' : '置顶'">
          <el-icon><StarFilled v-if="note?.pinned" /><Star v-else /></el-icon>
        </button>
        <button class="editor-preview-btn" @click="handlePreview" title="预览">预览</button>
        <button class="editor-save-btn" @click="handleSave">保存</button>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="ctxMenuVisible"
        class="nav-ctx-menu"
        :style="{ left: ctxMenuPos.x + 'px', top: ctxMenuPos.y + 'px' }"
        @click.stop
        @contextmenu.prevent
      >
        <button v-if="pages[ctxTargetIdx]?.type === 'thanks'" class="nav-ctx-item" @click="openThanksDialog"><span class="nav-ctx-icon">✏️</span>修改致谢内容</button>
        <button class="nav-ctx-item" @click="ctxCut"><span class="nav-ctx-icon">✂️</span>剪切幻灯片</button>
        <button class="nav-ctx-item" @click="ctxCopy"><span class="nav-ctx-icon">📋</span>复制幻灯片</button>
        <button class="nav-ctx-item" @click="ctxNewSameDown"><span class="nav-ctx-icon">➕</span>新建幻灯片</button>
        <button class="nav-ctx-item" :disabled="pages[ctxTargetIdx]?.level >= 3" @click="ctxNewSubDown"><span class="nav-ctx-icon">🔗</span>新建子幻灯片</button>
        <button class="nav-ctx-item" :disabled="pages[ctxTargetIdx]?.type === 'cover' || pages[ctxTargetIdx]?.type === 'thanks'" @click="ctxRename"><span class="nav-ctx-icon">✏️</span>重命名幻灯片</button>
        <button class="nav-ctx-item" :disabled="pages[ctxTargetIdx]?.type === 'cover' || pages[ctxTargetIdx]?.type === 'thanks'" @click="ctxDelete"><span class="nav-ctx-icon">🗑️</span>删除幻灯片</button>
        <button class="nav-ctx-item" :disabled="!clipboard" @click="ctxPasteDown"><span class="nav-ctx-icon">📎</span>粘贴幻灯片</button>
        <button class="nav-ctx-item" @click="ctxNewUp"><span class="nav-ctx-icon">⬆️</span>向上插入幻灯片</button>
      </div>
      <!-- 致谢内容修改弹窗 -->
      <div v-if="thanksDialogVisible" class="thanks-dialog-overlay" @click.self="thanksDialogVisible = false">
        <div class="thanks-dialog">
          <div class="thanks-dialog-title">修改致谢内容</div>
          <div class="thanks-dialog-divider"></div>
          <textarea
            v-model="thanksDialogInput"
            class="thanks-dialog-textarea"
            :rows="thanksDialogRows"
            placeholder="输入致谢内容..."
          ></textarea>
          <div class="thanks-dialog-actions">
            <button class="thanks-dialog-btn cancel" @click="thanksDialogVisible = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              <span>取消</span>
            </button>
            <button class="thanks-dialog-btn save" @click="saveThanksDialog">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>保存</span>
            </button>
          </div>
        </div>
      </div>
      <!-- 粘贴选项菜单 -->
      <div
        v-if="pasteMenuVisible"
        class="nav-ctx-menu paste-menu"
        :style="{ left: pasteMenuPos.x + 'px', top: pasteMenuPos.y + 'px' }"
        @click.stop
        @contextmenu.prevent
      >
        <button class="nav-ctx-item" @mousedown.prevent @click="pasteSourceFormat"><span class="nav-ctx-icon">📋</span>保留源格式</button>
        <button class="nav-ctx-item" @mousedown.prevent @click="pasteTextOnly"><span class="nav-ctx-icon">📝</span>只保留文本</button>
      </div>
      <!-- 下划线颜色选择面板（Teleport 到 body 以避免被编辑器容器 overflow:hidden 裁剪） -->
      <div
        v-if="underlineColorPanelVisible"
        class="underline-color-popover"
        :style="underlineColorPanelStyle"
        @click.stop
        @mousedown.prevent
      >
        <ColorPickerPanel
          :modelValue="currentUnderlineColor"
          @apply="applyUnderlineColor"
          @cancel="underlineColorPanelVisible = false"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ArrowLeft, Star, StarFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Note, NoteCategory, NotePage } from '../../stores/noteStore'
import { parseNotePages, serializeNotePages, createNotePage, computePageNumber, generateCoverContent, wrapThanksContent } from '../../stores/noteStore'
import ColorPickerPanel from '../common/picker/ColorPickerPanel.vue'
import { highlightCodeBlocks, serializeCodeBlocks } from '../../utils/codeBlock'
import { deleteData, getData, setData } from '../../services/storageService'

const props = defineProps<{
  note: Note | null
  categories: NoteCategory[]
  clockDisplay: string
  totalWordCount: number
}>()

const emit = defineEmits<{
  (e: 'save', data: { title: string; content: string; categoryId: string; pinned: boolean }): void
  (e: 'cancel'): void
  (e: 'back'): void
  (e: 'togglePin'): void
  (e: 'preview', data: { title: string; content: string; categoryId: string; pinned: boolean }): void
}>()

// noteTitle 笔记标题，pageTitle 当前页面标题
const noteTitle = ref('')
const editCategoryId = ref('')
// 记录上次笔记 id，用于 watch 判断是否为同一篇笔记（保存后引用变化但 id 相同）
// 使用 null 而非 ''，避免新建笔记 id='' 时被误判为同一篇笔记而跳过初始化
let lastNoteId: string | null = null
// 保存后标记：保存新笔记后 props.note 引用会变化（id 从 '' 变为新 id），需跳过重新初始化以免丢失编辑内容
let justSaved = false
const contentRef = ref<HTMLElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const titleMeasureRef = ref<HTMLElement | null>(null)
const editingTitle = ref(false)
// 笔记名称输入框宽度自适应
const titleInputWidth = ref('auto')
const adjustTitleInputWidth = () => {
  if (!titleMeasureRef.value) return
  titleMeasureRef.value.textContent = noteTitle.value || '新笔记'
  titleInputWidth.value = (titleMeasureRef.value.offsetWidth + 16) + 'px'
}
const pages = ref<NotePage[]>([])
const currentPageIdx = ref(0)
// 当前页是否为封面页（不可编辑）或致谢页（标题不可改，内容可改）
const isCoverPage = computed(() => pages.value[currentPageIdx.value]?.type === 'cover')
const isThanksPage = computed(() => pages.value[currentPageIdx.value]?.type === 'thanks')
// 致谢内容修改弹窗
const thanksDialogVisible = ref(false)
const thanksDialogInput = ref('')
const thanksDialogRows = computed(() => {
  const lines = thanksDialogInput.value.split('\n').length
  return Math.max(1, Math.min(lines, 10))
})

const startEditTitle = () => {
  editingTitle.value = true
  nextTick(() => {
    adjustTitleInputWidth()
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

const endEditTitle = () => {
  editingTitle.value = false
}

// 监听笔记名称变化，动态调整输入框宽度
watch(noteTitle, () => {
  if (editingTitle.value) nextTick(adjustTitleInputWidth)
})

// 保存当前编辑器内容到当前页面
const saveCurrentPageContent = () => {
  if (contentRef.value && pages.value[currentPageIdx.value]) {
    // 克隆后序列化 HTML 代码块，避免破坏编辑器中的交互 UI
    const clone = contentRef.value.cloneNode(true) as HTMLElement
    serializeHtmlCodeBlocks(clone)
    // 将 <pre> 内高亮标记还原为纯文本，避免 hljs span 持久化
    serializeCodeBlocks(clone)
    const html = clone.innerHTML
    // 无文本内容且无图片/表格等媒体元素时视为空内容
    const text = (clone.textContent || '').trim()
    const isEmpty = !text && !clone.querySelector('img,table,hr,video')
    pages.value[currentPageIdx.value].content = isEmpty ? '' : html
  }
}

// 加载指定页面内容到编辑器
const loadPageContent = (idx: number) => {
  if (contentRef.value && pages.value[idx]) {
    // 空内容时使用 <div><br></div> 占位，提供块级容器确保 contenteditable 可聚焦光标并支持粘贴
    contentRef.value.innerHTML = pages.value[idx].content || '<div><br></div>'
    // 将 HTML 代码块转换为可交互的代码/运行双视图
    setupHtmlCodeBlocks(contentRef.value)
    // 对原生 <pre> 代码块应用语法高亮与格式化（HTML 代码块内的代码视图不处理）
    highlightCodeBlocks(contentRef.value)
  }
}

// ====== HTML 代码块（仅代码视图） ======
// 存储格式：<div class="html-code-block">HTML 代码文本</div>
// 编辑态：可编辑的代码视图
// 预览/放映态：转为 <pre><code> 由 highlightCodeBlocks 处理高亮

const setupHtmlCodeBlocks = (root: HTMLElement) => {
  const blocks = root.querySelectorAll('.html-code-block')
  blocks.forEach(block => {
    const el = block as HTMLElement
    // 已是交互态则跳过
    if (el.querySelector('.html-code-codeview')) return
    const code = el.textContent || ''
    el.contentEditable = 'false'
    el.innerHTML = '<div class="html-code-codeview" contenteditable="true"></div>'
    const codeview = el.querySelector('.html-code-codeview') as HTMLElement
    codeview.textContent = code
  })
}

// 保存前将交互态代码块还原为存储格式（仅保留代码文本）
const serializeHtmlCodeBlocks = (root: HTMLElement) => {
  const blocks = root.querySelectorAll('.html-code-block')
  blocks.forEach(block => {
    const el = block as HTMLElement
    const codeview = el.querySelector('.html-code-codeview') as HTMLElement | null
    const code = codeview ? codeview.textContent : el.textContent || ''
    el.innerHTML = ''
    el.textContent = code
    el.removeAttribute('contenteditable')
  })
}

const insertHtmlCodeBlock = () => {
  contentRef.value?.focus()
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const block = document.createElement('div')
  block.className = 'html-code-block'
  block.contentEditable = 'false'
  block.innerHTML = '<div class="html-code-codeview" contenteditable="true"><br></div>'
  range.insertNode(block)
  // 后接空段落，方便继续编辑正文
  const p = document.createElement('p')
  p.innerHTML = '<br>'
  if (block.parentNode) block.parentNode.insertBefore(p, block.nextSibling)
  const codeview = block.querySelector('.html-code-codeview') as HTMLElement
  codeview.focus()
}



watch(() => props.note, (note) => {
  if (!note) return
  // 保存新笔记后 props.note 引用变化（id 从 '' 变为新 id），跳过重新初始化以免丢失编辑内容
  if (justSaved) {
    justSaved = false
    lastNoteId = note.id
    return
  }
  // 仅在切换不同笔记时完整初始化；保存后 props.note 引用变化但 id 相同，保留当前编辑状态
  const isNewNote = note.id !== lastNoteId
  lastNoteId = note.id
  if (!isNewNote) return
  noteTitle.value = note.title
  editCategoryId.value = note.categoryId
  pages.value = parseNotePages(note.content)
  if (pages.value.length === 0) {
    // 新建笔记默认添加封面页、正文页和致谢页
    const genId = () => 'p_' + Date.now() + Math.random().toString(36).slice(2, 8)
    const bodyPage = createNotePage(1)
    pages.value = [
      { id: genId(), title: '封面', level: 1, content: '', type: 'cover' },
      bodyPage,
      { id: genId() + 'a', title: '致谢', level: 1, content: wrapThanksContent('<p>感谢聆听！</p>'), type: 'thanks' },
    ]
    // 生成封面页大纲内容
    pages.value[0].content = generateCoverContent(pages.value, note.title || '新笔记')
  }
  currentPageIdx.value = 0
  nextTick(() => {
    loadPageContent(0)
  })
}, { immediate: true })

// 封面页大纲实时同步：监听页面结构（数量/标题/层级/父级/顺序）和笔记名称变化
watch(
  [
    () => pages.value.length,
    () => pages.value.map(p => p.title + '|' + p.level + '|' + (p.parentId || '')).join('||'),
    noteTitle,
  ],
  () => {
    const coverIdx = pages.value.findIndex(p => p.type === 'cover')
    if (coverIdx !== -1) {
      pages.value[coverIdx].content = generateCoverContent(pages.value, noteTitle.value.trim() || '新笔记')
      // 如果当前正在查看封面页，同步更新编辑器显示
      if (currentPageIdx.value === coverIdx && contentRef.value) {
        contentRef.value.innerHTML = pages.value[coverIdx].content
      }
    }
  }
)

const goToSlide = (idx: number) => {
  if (idx < 0 || idx >= pages.value.length) return
  saveCurrentPageContent()
  currentPageIdx.value = idx
  nextTick(() => {
    loadPageContent(idx)
    updateUsedFonts()
    updateCurrentFontAndSize()
    contentRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

const formatTime = (date?: string): string => {
  if (!date) return ''
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

const exec = (cmd: string, value?: string) => {
  contentRef.value?.focus()
  document.execCommand(cmd, false, value)
}

// ====== 粘贴选项 ======
const pasteMenuVisible = ref(false)
const pasteMenuPos = ref({ x: 0, y: 0 })
let pendingPasteHtml = ''
let pendingPasteText = ''
// 保存粘贴时的选区范围，菜单按钮点击后恢复以确保 insertHTML 在正确位置
let pendingPasteRange: Range | null = null

const handlePaste = async (e: ClipboardEvent) => {
  // 优先从事件自身的 clipboardData 同步读取（所有平台都支持）
  pendingPasteHtml = e.clipboardData?.getData('text/html') || ''
  pendingPasteText = e.clipboardData?.getData('text/plain') || ''
  // 如果事件 clipboardData 为空，尝试 Electron 主进程 clipboard 或 navigator.clipboard
  if (!pendingPasteText && !pendingPasteHtml) {
    if (window.electronAPI?.readClipboardText) {
      try {
        pendingPasteText = (await window.electronAPI.readClipboardText()) || ''
        if (window.electronAPI.readClipboardHTML) {
          pendingPasteHtml = (await window.electronAPI.readClipboardHTML()) || ''
        }
      } catch { /* ignore */ }
    } else if (navigator.clipboard?.readText) {
      try {
        pendingPasteText = (await navigator.clipboard.readText()) || ''
      } catch { /* ignore */ }
    }
  }
  // 如果没有任何粘贴内容，不阻止默认行为，让浏览器原生处理
  if (!pendingPasteText && !pendingPasteHtml) return
  e.preventDefault()
  const clientX = e.clientX
  const clientY = e.clientY
  // 保存当前选区范围
  const sel = window.getSelection()
  if (sel && sel.rangeCount) {
    pendingPasteRange = sel.getRangeAt(0).cloneRange()
    const rect = pendingPasteRange.getBoundingClientRect()
    // 空内容时光标 getBoundingClientRect 可能全为 0，使用编辑器位置兜底
    if (rect.left === 0 && rect.top === 0 && contentRef.value) {
      const editorRect = contentRef.value.getBoundingClientRect()
      pasteMenuPos.value = { x: editorRect.left + 20, y: editorRect.top + 20 }
    } else {
      pasteMenuPos.value = {
        x: rect.left || clientX,
        y: (rect.bottom || clientY) + 4
      }
    }
  } else {
    pendingPasteRange = null
    // 无选区时使用编辑器位置定位菜单，避免键盘粘贴时 clientX/clientY 为 0 导致菜单不可见
    const editorRect = contentRef.value?.getBoundingClientRect()
    pasteMenuPos.value = editorRect
      ? { x: editorRect.left + 20, y: editorRect.top + 20 }
      : { x: clientX, y: clientY }
  }
  pasteMenuVisible.value = true
}

const closePasteMenu = () => {
  pasteMenuVisible.value = false
  pendingPasteHtml = ''
  pendingPasteText = ''
  pendingPasteRange = null
}

// 在恢复的选区位置执行插入命令
const restoreSelectionAndExec = (cmd: string, value: string) => {
  contentRef.value?.focus()
  if (pendingPasteRange) {
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(pendingPasteRange)
    }
  } else {
    const sel = window.getSelection()
    if (sel && contentRef.value) {
      const range = document.createRange()
      if (contentRef.value.childNodes.length === 0) {
        range.setStart(contentRef.value, 0)
      } else {
        range.selectNodeContents(contentRef.value)
        range.collapse(true)
      }
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }
  document.execCommand(cmd, false, value)
}

// 保留源格式：直接插入原始 HTML
const pasteSourceFormat = () => {
  if (!pasteMenuVisible.value) return
  if (pendingPasteHtml) {
    restoreSelectionAndExec('insertHTML', pendingPasteHtml)
  } else {
    restoreSelectionAndExec('insertText', pendingPasteText)
  }
  closePasteMenu()
}

// 只保留文本：中文用宋体五号，英文用 Times New Roman 五号
const pasteTextOnly = () => {
  if (!pasteMenuVisible.value) return
  const esc = pendingPasteText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  // 将文本按中英文字符分段，中文段用宋体，英文段用 Times New Roman；五号 = 10.5pt
  const parts: string[] = []
  let last = 0
  const re = /([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(esc)) !== null) {
    if (m.index > last) {
      parts.push('<span style="font-family: \'Times New Roman\'; font-size: 10.5pt">' + esc.slice(last, m.index) + '</span>')
    }
    parts.push('<span style="font-family: \'宋体\', SimSun; font-size: 10.5pt">' + m[1] + '</span>')
    last = m.index + m[1].length
  }
  if (last < esc.length) {
    parts.push('<span style="font-family: \'Times New Roman\'; font-size: 10.5pt">' + esc.slice(last) + '</span>')
  }
  restoreSelectionAndExec('insertHTML', parts.join(''))
  closePasteMenu()
}

const execAlign = (val: 'left' | 'center' | 'right') => {
  if (val === 'left') exec('justifyLeft')
  else if (val === 'center') exec('justifyCenter')
  else if (val === 'right') exec('justifyRight')
  currentAlign.value = val
}

// 当前光标所在行/选中文本的对齐方式（用于工具栏按钮选中状态联动）
const currentAlign = ref<'left' | 'center' | 'right'>('left')

const updateCurrentAlign = () => {
  if (!contentRef.value) return
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  // 仅在光标位于编辑器内时更新
  if (!contentRef.value.contains(sel.anchorNode)) return
  let node: Node | null = sel.anchorNode
  while (node && node !== contentRef.value) {
    if (node.nodeType === 1) {
      const el = node as HTMLElement
      if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(el.tagName)) {
        const align = el.style.textAlign || getComputedStyle(el).textAlign || 'left'
        if (align === 'center' || align === 'right') {
          currentAlign.value = align
        } else {
          currentAlign.value = 'left'
        }
        return
      }
    }
    node = node.parentNode
  }
}

const handleSelectionChange = () => {
  updateCurrentAlign()
  updateCurrentFontAndSize()
  updateCurrentFontColor()
  updateHasSelection()
}

// ====== 选中文本状态 ======
// 当前是否有选中文本（用于主工具栏按钮禁用态）
const hasSelection = ref(false)

const updateHasSelection = () => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount || !contentRef.value?.contains(sel.anchorNode)) {
    hasSelection.value = false
    return
  }
  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  hasSelection.value = !!(rect && rect.width !== 0)
}

// ====== 复制/应用样式（持久化） ======
// 持久化的样式状态：字体、字号、加粗、斜体、下划线、删除线、文字颜色、项目符号、项目编号、对齐方式、引用
interface SavedStyle {
  fontFamily?: string
  fontSize?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikeThrough?: boolean
  color?: string
  list?: 'ul' | 'ol'
  align?: 'left' | 'center' | 'right'
  blockquote?: boolean
}

const savedStyle = ref<SavedStyle | null>(null)

// 从选中文本提取样式状态
const gatherStyle = (): SavedStyle | null => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount || !contentRef.value) return null
  const elements = getSelectionElements()
  if (elements.length === 0) return null
  const el = elements[0]
  const style: SavedStyle = {}
  // 字体/字号/颜色：向上查找最近设置了内联样式的元素（保留 pt 与 hex 单位）
  let node: HTMLElement | null = el
  while (node && node !== contentRef.value) {
    if (node.style.fontFamily) {
      style.fontFamily = node.style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() || undefined
      break
    }
    node = node.parentElement
  }
  node = el
  while (node && node !== contentRef.value) {
    if (node.style.fontSize) { style.fontSize = node.style.fontSize; break }
    node = node.parentElement
  }
  node = el
  while (node && node !== contentRef.value) {
    if (node.style.color) { style.color = node.style.color; break }
    node = node.parentElement
  }
  // 加粗/斜体/下划线/删除线：使用计算样式（兼容 <b>/<i>/<u>/<s> 标签与内联样式）
  const cs = getComputedStyle(el)
  const fw = cs.fontWeight
  style.bold = parseInt(fw) >= 700 || fw === 'bold' || fw === 'bolder'
  style.italic = cs.fontStyle === 'italic' || cs.fontStyle === 'oblique'
  const td = cs.textDecorationLine || cs.textDecoration || ''
  style.underline = td.includes('underline')
  style.strikeThrough = td.includes('line-through')
  // 项目符号/项目编号：向上查找最近的列表
  let p: Node | null = el
  while (p && p !== contentRef.value) {
    if (p.nodeType === 1) {
      const tag = (p as HTMLElement).tagName
      if (tag === 'UL') { style.list = 'ul'; break }
      if (tag === 'OL') { style.list = 'ol'; break }
    }
    p = p.parentNode
  }
  // 引用：向上查找最近的 blockquote
  p = el
  while (p && p !== contentRef.value) {
    if (p.nodeType === 1 && (p as HTMLElement).tagName === 'BLOCKQUOTE') {
      style.blockquote = true
      break
    }
    p = p.parentNode
  }
  // 对齐方式：向上查找最近的块级元素
  p = el
  while (p && p !== contentRef.value) {
    if (p.nodeType === 1) {
      const e = p as HTMLElement
      if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(e.tagName)) {
        const a = e.style.textAlign || getComputedStyle(e).textAlign || 'left'
        style.align = (a === 'center' || a === 'right') ? a : 'left'
        break
      }
    }
    p = p.parentNode
  }
  return style
}

const copySelectionStyle = async () => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return
  const style = gatherStyle()
  savedStyle.value = style
  if (style) await setData('notes', 'style', style)
}

const applySelectionStyle = () => {
  const s = savedStyle.value
  if (!s) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return
  contentRef.value?.focus()
  // 内联样式：文字颜色、字体、字号
  if (s.color) {
    document.execCommand('styleWithCSS', false, true)
    document.execCommand('foreColor', false, s.color)
    document.execCommand('styleWithCSS', false, false)
  }
  if (s.fontFamily) {
    document.execCommand('styleWithCSS', false, true)
    document.execCommand('fontName', false, s.fontFamily)
    document.execCommand('styleWithCSS', false, false)
  }
  if (s.fontSize) applyFontSize(s.fontSize)
  // 加粗/斜体/下划线/删除线：仅在当前状态与目标不一致时切换
  if (s.bold !== undefined && document.queryCommandState('bold') !== s.bold) document.execCommand('bold')
  if (s.italic !== undefined && document.queryCommandState('italic') !== s.italic) document.execCommand('italic')
  if (s.underline !== undefined && document.queryCommandState('underline') !== s.underline) document.execCommand('underline')
  if (s.strikeThrough !== undefined && document.queryCommandState('strikeThrough') !== s.strikeThrough) document.execCommand('strikeThrough')
  // 块级：项目符号/项目编号、引用、对齐方式
  if (s.list === 'ul') document.execCommand('insertUnorderedList')
  else if (s.list === 'ol') document.execCommand('insertOrderedList')
  if (s.blockquote) document.execCommand('formatBlock', false, 'blockquote')
  if (s.align) execAlign(s.align)
  updateCurrentFontAndSize()
}

// 加载持久化的样式
const loadSavedStyle = async () => {
  const data = await getData<SavedStyle>('notes', 'style')
  savedStyle.value = data || null
}

const updateCurrentFontColor = () => {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !contentRef.value?.contains(sel.anchorNode)) {
    currentFontColor.value = '#000000'
    return
  }
  const elements = getSelectionElements()
  if (elements.length === 0) {
    currentFontColor.value = '#000000'
    return
  }
  const colors = new Set<string>()
  elements.forEach(el => {
    let node: HTMLElement | null = el
    let found = false
    while (node && node !== contentRef.value) {
      const c = (node as HTMLElement).style.color
      if (c) { colors.add(c); found = true; break }
      node = node.parentElement
    }
    if (!found) colors.add('#000000')
  })
  currentFontColor.value = colors.size === 1 ? Array.from(colors)[0] : '#000000'
}

// ====== 字体和字号 ======
// 中文字号映射（name → pt）
const cnFontSizes = [
  { name: '初号', pt: 42 },
  { name: '小初', pt: 36 },
  { name: '一号', pt: 26 },
  { name: '小一', pt: 24 },
  { name: '二号', pt: 22 },
  { name: '小二', pt: 18 },
  { name: '三号', pt: 16 },
  { name: '小三', pt: 15 },
  { name: '四号', pt: 14 },
  { name: '小四', pt: 12 },
  { name: '五号', pt: 10.5 },
  { name: '小五', pt: 9 },
  { name: '六号', pt: 7.5 },
  { name: '小六', pt: 6.5 },
  { name: '七号', pt: 5.5 },
  { name: '八号', pt: 5 },
]
// 数字字号（pt 单位）
const numFontSizes = [5, 5.5, 6.5, 7.5, 8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
// 常用字体列表（所有平台统一使用）
const commonFonts = [
  '微软雅黑', '宋体', '黑体', '楷体', '仿宋', '隶书',
  'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana',
  'Microsoft YaHei', 'SimSun', 'SimHei', 'KaiTi', 'FangSong',
]
// 当前页面正在使用的字体（提取自元素 style.fontFamily）
const usedFonts = ref<string[]>([])
// 工具栏显示的当前光标位置/选中文本的字体和字号（多种时为空字符串）
const currentFont = ref('')
const currentFontSize = ref('')

// ====== 字体颜色 ======
const fontColorPanelVisible = ref(false)
const currentFontColor = ref('#000000')

const toggleFontColorPanel = () => {
  if (fontColorPanelVisible.value) {
    fontColorPanelVisible.value = false
    return
  }
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !contentRef.value?.contains(sel.anchorNode)) return
  fontColorPanelVisible.value = true
}

const applyFontColor = (color: string) => {
  if (!color || !contentRef.value) return
  contentRef.value.focus()
  document.execCommand('styleWithCSS', false, true)
  document.execCommand('foreColor', false, color)
  document.execCommand('styleWithCSS', false, false)
  currentFontColor.value = color
  fontColorPanelVisible.value = false
  updateCurrentFontAndSize()
}

// ====== 下划线样式菜单 ======
const underlineStyles = [
  { name: '单实线', css: 'text-decoration: underline solid;', lineStyle: 'border-bottom: 1px solid var(--chalk-white-90);' },
  { name: '双实线', css: 'text-decoration: underline double;', lineStyle: 'border-bottom: 3px double var(--chalk-white-90);' },
  { name: '粗实线', css: 'text-decoration: underline solid; text-decoration-thickness: 3px;', lineStyle: 'border-bottom: 3px solid var(--chalk-white-90);' },
  { name: '虚线', css: 'text-decoration: underline dotted;', lineStyle: 'border-bottom: 1px dotted var(--chalk-white-90);' },
  { name: '短虚线', css: 'text-decoration: underline dashed;', lineStyle: 'border-bottom: 1px dashed var(--chalk-white-90);' },
  { name: '长虚线', css: 'text-decoration: underline dashed; text-decoration-thickness: 2px; text-underline-offset: 2px;', lineStyle: 'border-bottom: 2px dashed var(--chalk-white-90);' },
  { name: '点划线', css: 'background-image: repeating-linear-gradient(90deg, currentColor 0, currentColor 1px, transparent 1px, transparent 4px, currentColor 4px, currentColor 8px, transparent 8px, transparent 12px); background-position: 0 100%; background-size: 12px 2px; background-repeat: repeat-x; padding-bottom: 2px;', lineStyle: 'background: repeating-linear-gradient(90deg, var(--chalk-white-90) 0px, var(--chalk-white-90) 2px, transparent 2px, transparent 6px, var(--chalk-white-90) 6px, var(--chalk-white-90) 10px, transparent 10px, transparent 14px); background-position: 0 100%; background-size: 14px 2px; background-repeat: repeat-x;' },
  { name: '波浪线', css: 'text-decoration: underline wavy;', lineStyle: 'background: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'8\' viewBox=\'0 0 24 8\'%3E%3Cpath d=\'M0 4 Q2 1 4 4 Q6 7 8 4 Q10 1 12 4 Q14 7 16 4 Q18 1 20 4 Q22 7 24 4\' fill=\'none\' stroke=\'rgba(255,255,255,0.9)\' stroke-width=\'1\'/%3E%3C/svg%3E") repeat-x; background-position: center bottom; background-size: 24px 8px;' },
]
// 主工具栏下拉菜单可见状态
const underlineMenuVisible = ref(false)
const underlineColorPanelVisible = ref(false)
const currentUnderlineColor = ref('#667eea')
// 下划线颜色面板（Teleport 到 body）的定位样式
const underlineColorPanelStyle = ref<Record<string, string>>({})

const toggleUnderlineMenu = () => {
  underlineMenuVisible.value = !underlineMenuVisible.value
}

const applyUnderlineStyle = (css: string) => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return
  contentRef.value?.focus()
  const span = document.createElement('span')
  span.setAttribute('style', css)
  span.textContent = sel.toString()
  document.execCommand('insertHTML', false, span.outerHTML)
  underlineMenuVisible.value = false
  updateCurrentFontAndSize()
}

const removeUnderline = () => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return
  contentRef.value?.focus()
  document.execCommand('underline', false)
  const span = document.createElement('span')
  span.style.cssText = 'text-decoration-line: none; border-bottom: none; background-image: none;'
  span.textContent = sel.toString()
  document.execCommand('insertHTML', false, span.outerHTML)
  underlineMenuVisible.value = false
  updateCurrentFontAndSize()
}

const toggleUnderlineColorPanel = (e?: MouseEvent) => {
  if (!underlineColorPanelVisible.value) {
    const trigger = (e?.currentTarget as HTMLElement) || null
    const rect = trigger?.getBoundingClientRect()
    const vpW = window.innerWidth
    const vpH = window.innerHeight
    const panelW = 280
    let x = 8
    let y = 8
    if (rect) {
      // 默认在触发器右侧展开，空间不足时切换到左侧
      x = rect.right + 4
      if (x + panelW > vpW - 8) x = rect.left - panelW - 4
      if (x < 8) x = 8
      y = rect.top
    }
    // 顶部过高时上移，确保至少 220px 可视高度，内容超出时面板自身滚动条出现
    const minPanelH = 220
    if (y + minPanelH > vpH - 8) y = Math.max(8, vpH - minPanelH - 8)
    const maxH = vpH - y - 8
    underlineColorPanelStyle.value = {
      left: x + 'px',
      top: y + 'px',
      '--ucp-max-height': maxH + 'px'
    }
  }
  underlineColorPanelVisible.value = !underlineColorPanelVisible.value
}

const applyUnderlineColor = (color: string) => {
  if (!color) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return
  contentRef.value?.focus()
  const span = document.createElement('span')
  span.style.textDecoration = 'underline'
  span.style.textDecorationColor = color
  span.textContent = sel.toString()
  document.execCommand('insertHTML', false, span.outerHTML)
  currentUnderlineColor.value = color
  underlineColorPanelVisible.value = false
  underlineMenuVisible.value = false
  updateCurrentFontAndSize()
}

// ====== 字体/字号仅在选中文本时生效 ======
const onFontChange = (font: string) => {
  if (!font) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  applyFont(font)
}

const onFontSizeChange = (size: string) => {
  if (!size) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  applyFontSize(size)
}

const isFontInList = (font: string): boolean => {
  if (usedFonts.value.includes(font)) return true
  return commonFonts.includes(font)
}

const isSizeInList = (size: string): boolean => {
  if (cnFontSizes.some(s => s.pt + 'pt' === size)) return true
  return numFontSizes.some(s => s + 'pt' === size)
}

const updateUsedFonts = () => {
  if (!contentRef.value) return
  const fonts = new Set<string>(['宋体', 'Times New Roman'])
  contentRef.value.querySelectorAll('[style*="font-family"]').forEach(el => {
    const ff = (el as HTMLElement).style.fontFamily
    if (ff) {
      const first = ff.split(',')[0].replace(/['"]/g, '').trim()
      if (first) fonts.add(first)
    }
  })
  usedFonts.value = Array.from(fonts)
}

// 收集当前选区（光标或选中文本）涉及的元素
const getSelectionElements = (): HTMLElement[] => {
  if (!contentRef.value) return []
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return []
  if (!contentRef.value.contains(sel.anchorNode)) return []

  if (sel.isCollapsed) {
    // 光标位置：取前一个字符所在元素
    let node: Node | null = sel.anchorNode
    let offset = sel.anchorOffset
    // 如果光标在文本节点开头，尝试取前一个兄弟节点
    if (node.nodeType === 3 && offset === 0) {
      const prev = node.previousSibling
      if (prev) {
        if (prev.nodeType === 3) return [prev.parentElement!]
        if (prev.nodeType === 1) return [prev as HTMLElement]
      }
      // 没有前一个兄弟，使用当前节点的父元素
      return node.parentElement ? [node.parentElement] : []
    }
    if (node.nodeType === 3) return node.parentElement ? [node.parentElement] : []
    if (node.nodeType === 1) return [node as HTMLElement]
    return []
  }
  // 选中文本：收集范围内的所有元素
  const range = sel.getRangeAt(0)
  const elements = new Set<HTMLElement>()
  const walker = document.createTreeWalker(contentRef.value, NodeFilter.SHOW_TEXT, null)
  while (walker.nextNode()) {
    const textNode = walker.currentNode
    if (range.intersectsNode(textNode)) {
      const parent = textNode.parentElement
      if (parent) elements.add(parent)
    }
  }
  return Array.from(elements)
}

// 更新工具栏字体和字号显示（基于光标位置或选中文本）
const updateCurrentFontAndSize = () => {
  if (!contentRef.value) {
    currentFont.value = ''
    currentFontSize.value = ''
    return
  }
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !contentRef.value.contains(sel.anchorNode)) {
    currentFont.value = ''
    currentFontSize.value = ''
    return
  }
  const elements = getSelectionElements()
  if (elements.length === 0) {
    currentFont.value = ''
    currentFontSize.value = ''
    return
  }
  const fonts = new Set<string>()
  const sizes = new Set<string>()
  elements.forEach(el => {
    // 向上查找最近的设置了 font-family 的元素，未找到则使用默认字体"宋体"
    let node: HTMLElement | null = el
    let foundFont = false
    while (node && node !== contentRef.value) {
      const ff = node.style.fontFamily
      if (ff) {
        const first = ff.split(',')[0].replace(/['"]/g, '').trim()
        if (first) {
          fonts.add(first)
          foundFont = true
        }
        break
      }
      node = node.parentElement
    }
    if (!foundFont) fonts.add('宋体')
    // 向上查找最近的设置了 font-size 的元素，未找到则使用默认字号"10.5pt"（五号）
    node = el
    let foundSize = false
    while (node && node !== contentRef.value) {
      if (node.style.fontSize) {
        sizes.add(node.style.fontSize)
        foundSize = true
        break
      }
      node = node.parentElement
    }
    if (!foundSize) sizes.add('10.5pt')
  })
  currentFont.value = fonts.size === 1 ? Array.from(fonts)[0] : ''
  currentFontSize.value = sizes.size === 1 ? Array.from(sizes)[0] : ''
}

const applyFont = (font: string) => {
  if (!font) return
  contentRef.value?.focus()
  document.execCommand('styleWithCSS', false, true)
  document.execCommand('fontName', false, font)
  document.execCommand('styleWithCSS', false, false)
  updateUsedFonts()
  updateCurrentFontAndSize()
}

const applyFontSize = (size: string) => {
  if (!size) return
  contentRef.value?.focus()
  // execCommand fontSize 仅支持 1-7，用 7 创建 <font size="7">，再替换为带 style.fontSize 的 span
  document.execCommand('fontSize', false, '7')
  if (contentRef.value) {
    const fontElements = contentRef.value.querySelectorAll('font[size="7"]')
    fontElements.forEach(fontEl => {
      const span = document.createElement('span')
      span.style.fontSize = size
      while (fontEl.firstChild) span.appendChild(fontEl.firstChild)
      fontEl.replaceWith(span)
    })
  }
  updateCurrentFontAndSize()
}

// ====== 幻灯片重命名（侧边栏原地编辑）======
const renamingIdx = ref(-1)
const renamingInput = ref('')
const renamingInputRef = ref<HTMLInputElement | null>(null)

const setRenameInputRef = (el: HTMLInputElement | null) => {
  renamingInputRef.value = el
}

const ctxRename = () => {
  const idx = ctxTargetIdx.value
  if (idx < 0 || idx >= pages.value.length) return
  const page = pages.value[idx]
  if (page.type === 'cover' || page.type === 'thanks') {
    closeCtxMenu()
    return
  }
  renamingInput.value = page.title || ''
  renamingIdx.value = idx
  closeCtxMenu()
  nextTick(() => {
    renamingInputRef.value?.focus()
    renamingInputRef.value?.select()
  })
}

const commitRename = () => {
  if (renamingIdx.value < 0) return
  const idx = renamingIdx.value
  if (pages.value[idx]) {
    const newTitle = renamingInput.value.trim()
    pages.value[idx].title = newTitle || '未命名'
  }
  renamingIdx.value = -1
  renamingInput.value = ''
}

// 打开致谢内容修改弹窗
const openThanksDialog = () => {
  const page = pages.value[ctxTargetIdx.value]
  if (!page) return
  const tmp = document.createElement('div')
  tmp.innerHTML = page.content
  tmp.querySelectorAll('br').forEach(br => br.replaceWith('\n'))
  thanksDialogInput.value = (tmp.textContent || '').trim()
  thanksDialogVisible.value = true
  ctxMenuVisible.value = false
}

// 保存致谢内容弹窗
const saveThanksDialog = () => {
  const page = pages.value[ctxTargetIdx.value]
  if (page) {
    const text = thanksDialogInput.value.trim() || '感谢聆听！'
    page.content = wrapThanksContent(`<p>${text.replace(/\n/g, '<br>')}</p>`)
  }
  thanksDialogVisible.value = false
}

// ====== 右键菜单 ======
const ctxMenuVisible = ref(false)
const ctxMenuPos = ref({ x: 0, y: 0 })
const ctxTargetIdx = ref(-1)
// 剪贴板（剪切/复制使用）
const clipboard = ref<NotePage | null>(null)

const openContextMenu = (e: MouseEvent, idx: number) => {
  ctxTargetIdx.value = idx
  const menuWidth = 150
  const menuHeight = 296
  let x = e.clientX
  let y = e.clientY
  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 4
  if (y + menuHeight > window.innerHeight) y = Math.max(4, window.innerHeight - menuHeight - 4)
  ctxMenuPos.value = { x, y }
  ctxMenuVisible.value = true
}

const closeCtxMenu = () => {
  ctxMenuVisible.value = false
  ctxTargetIdx.value = -1
}

// 侧边导航栏右键：统一打开幻灯片菜单（致谢页的"修改致谢内容"已合并其中）
const handleNavContextmenu = (e: MouseEvent, idx: number) => {
  openContextMenu(e, idx)
}

// 选中指定索引页面（保存当前页内容并加载新页）
const selectPage = (idx: number) => {
  currentPageIdx.value = idx
  nextTick(() => {
    loadPageContent(idx)
    contentRef.value?.focus()
  })
}

// 剪切幻灯片
const ctxCut = () => {
  const idx = ctxTargetIdx.value
  if (idx < 0 || idx >= pages.value.length) return
  saveCurrentPageContent()
  clipboard.value = { ...pages.value[idx] }
  pages.value.splice(idx, 1)
  if (pages.value.length === 0) {
    const newPage = createNotePage(1)
    pages.value.push(newPage)
    selectPage(0)
  } else if (currentPageIdx.value >= pages.value.length) {
    selectPage(pages.value.length - 1)
  } else if (idx < currentPageIdx.value) {
    currentPageIdx.value--
  }
  closeCtxMenu()
}

// 复制幻灯片
const ctxCopy = () => {
  const idx = ctxTargetIdx.value
  if (idx < 0 || idx >= pages.value.length) return
  saveCurrentPageContent()
  clipboard.value = { ...pages.value[idx] }
  closeCtxMenu()
}

// 新建同级幻灯片（向下插入）
const ctxNewSameDown = () => {
  const idx = ctxTargetIdx.value
  if (idx < 0 || idx >= pages.value.length) return
  saveCurrentPageContent()
  const current = pages.value[idx]
  const newPage = createNotePage(current.level, current.parentId)
  pages.value.splice(idx + 1, 0, newPage)
  selectPage(idx + 1)
  closeCtxMenu()
}

// 新建子幻灯片（向下插入，最多三级）
const ctxNewSubDown = () => {
  const idx = ctxTargetIdx.value
  if (idx < 0 || idx >= pages.value.length) return
  const current = pages.value[idx]
  if (current.level >= 3) {
    closeCtxMenu()
    return
  }
  saveCurrentPageContent()
  const newPage = createNotePage((current.level + 1) as 1 | 2 | 3, current.id)
  pages.value.splice(idx + 1, 0, newPage)
  selectPage(idx + 1)
  closeCtxMenu()
}

// 删除幻灯片
const ctxDelete = () => {
  const idx = ctxTargetIdx.value
  if (idx < 0 || idx >= pages.value.length) return
  saveCurrentPageContent()
  pages.value.splice(idx, 1)
  if (pages.value.length === 0) {
    const newPage = createNotePage(1)
    pages.value.push(newPage)
    selectPage(0)
  } else if (currentPageIdx.value >= pages.value.length) {
    selectPage(pages.value.length - 1)
  } else if (idx < currentPageIdx.value) {
    currentPageIdx.value--
  }
  closeCtxMenu()
}

// 粘贴幻灯片（向下插入，智能匹配最近父级）
const ctxPasteDown = () => {
  const idx = ctxTargetIdx.value
  if (!clipboard.value || idx < 0 || idx >= pages.value.length) return
  saveCurrentPageContent()
  const newPage: NotePage = {
    ...clipboard.value,
    id: 'p_' + Date.now() + Math.random().toString(36).slice(2, 8),
  }
  // 智能匹配：向上找最近的 level = newPage.level - 1 的页面作为父级
  if (newPage.level > 1) {
    let parentId: string | undefined
    for (let i = idx; i >= 0; i--) {
      if (pages.value[i].level === newPage.level - 1) {
        parentId = pages.value[i].id
        break
      }
    }
    if (parentId) {
      newPage.parentId = parentId
    } else {
      // 无合适父级，升级为一级页面
      newPage.level = 1
      newPage.parentId = undefined
    }
  } else {
    newPage.parentId = undefined
  }
  pages.value.splice(idx + 1, 0, newPage)
  selectPage(idx + 1)
  closeCtxMenu()
}

// 向上插入幻灯片（同级，新建空白）
const ctxNewUp = () => {
  const idx = ctxTargetIdx.value
  if (idx < 0 || idx >= pages.value.length) return
  saveCurrentPageContent()
  const current = pages.value[idx]
  const newPage = createNotePage(current.level, current.parentId)
  pages.value.splice(idx, 0, newPage)
  selectPage(idx)
  closeCtxMenu()
}

// ====== 长按拖拽排序 ======
const dragIdx = ref(-1)
const dragOverIdx = ref(-1)
let longPressTimer: number | undefined
let pointerStartX = 0
let pointerStartY = 0
let pointerDownIdx = -1

const reorderPages = (from: number, to: number) => {
  if (from === to || from < 0 || to < 0 || from >= pages.value.length || to >= pages.value.length) return
  saveCurrentPageContent()
  const [moved] = pages.value.splice(from, 1)
  pages.value.splice(to, 0, moved)
  if (currentPageIdx.value === from) {
    currentPageIdx.value = to
  } else if (from < currentPageIdx.value && to >= currentPageIdx.value) {
    currentPageIdx.value--
  } else if (from > currentPageIdx.value && to <= currentPageIdx.value) {
    currentPageIdx.value++
  }
}

const onNavPointerDown = (e: PointerEvent, idx: number) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  pointerDownIdx = idx
  pointerStartX = e.clientX
  pointerStartY = e.clientY

  if (e.pointerType !== 'mouse') {
    // 触摸：长按 500ms 后进入拖拽
    longPressTimer = window.setTimeout(() => {
      dragIdx.value = idx
      if (navigator.vibrate) navigator.vibrate(50)
    }, 500)
  }
  // 鼠标模式：不立即设置 dragIdx，等 onDocPointerMove 中移动超过阈值才进入拖拽
}

const onDocPointerMove = (e: PointerEvent) => {
  if (pointerDownIdx === -1) return
  // 未进入拖拽：检查移动距离
  if (dragIdx.value === -1) {
    const dx = Math.abs(e.clientX - pointerStartX)
    const dy = Math.abs(e.clientY - pointerStartY)
    if (e.pointerType === 'mouse') {
      // 鼠标：移动超过 5px 才进入拖拽，避免点击误触发
      if (dx > 5 || dy > 5) {
        dragIdx.value = pointerDownIdx
      } else {
        return
      }
    } else if (longPressTimer) {
      // 触摸：长按等待期间移动超过 10px 取消长按
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer)
        longPressTimer = undefined
        pointerDownIdx = -1
      }
      return
    } else {
      return
    }
  }
  // 拖拽中：阻止页面滚动
  if (e.pointerType !== 'mouse') e.preventDefault()
  // 找到当前指针所在的 li
  const target = document.elementFromPoint(e.clientX, e.clientY)
  const li = target?.closest('.editor-sidebar-nav > li') as HTMLElement | null
  if (li && li.parentElement) {
    const idx = Array.from(li.parentElement.children).indexOf(li)
    if (idx !== -1) dragOverIdx.value = idx
  }
}

const onDocPointerUp = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = undefined
  }
  if (dragIdx.value !== -1 && dragOverIdx.value !== -1 && dragIdx.value !== dragOverIdx.value) {
    reorderPages(dragIdx.value, dragOverIdx.value)
  }
  dragIdx.value = -1
  dragOverIdx.value = -1
  pointerDownIdx = -1
}

onMounted(() => {
  document.addEventListener('pointermove', onDocPointerMove, { passive: false })
  document.addEventListener('pointerup', onDocPointerUp)
  document.addEventListener('pointercancel', onDocPointerUp)
  document.addEventListener('click', closeCtxMenu)
  document.addEventListener('contextmenu', closeCtxMenu)
  document.addEventListener('click', closePasteMenu)
  document.addEventListener('click', closeFontColorPanel)
  document.addEventListener('click', closeUnderlineMenu)
  document.addEventListener('selectionchange', handleSelectionChange)
  loadSavedStyle()
})

const closeFontColorPanel = (e: MouseEvent) => {
  if (!fontColorPanelVisible.value) return
  const target = e.target as HTMLElement
  if (target.closest('.font-color-panel-wrap') || target.closest('.editor-tb-font-color-btn')) return
  fontColorPanelVisible.value = false
}

const closeUnderlineMenu = (e: MouseEvent) => {
  if (!underlineMenuVisible.value && !underlineColorPanelVisible.value) return
  const target = e.target as HTMLElement
  if (target.closest('.underline-menu') || target.closest('.editor-tb-underline-btn') || target.closest('.underline-color-popover')) return
  underlineMenuVisible.value = false
  underlineColorPanelVisible.value = false
}

onBeforeUnmount(() => {
  document.removeEventListener('pointermove', onDocPointerMove)
  document.removeEventListener('pointerup', onDocPointerUp)
  document.removeEventListener('pointercancel', onDocPointerUp)
  document.removeEventListener('click', closeCtxMenu)
  document.removeEventListener('contextmenu', closeCtxMenu)
  document.removeEventListener('click', closePasteMenu)
  document.removeEventListener('click', closeFontColorPanel)
  document.removeEventListener('click', closeUnderlineMenu)
  document.removeEventListener('selectionchange', handleSelectionChange)
  // 离开编辑界面时清空保存的样式数据（仅当前编辑会话内有效）
  savedStyle.value = null
  void deleteData('notes', 'style')
})

const handleSave = () => {
  saveCurrentPageContent()
  // 标题为空时使用默认标题"新笔记"，避免保存按钮无反应
  const title = noteTitle.value.trim() || '新笔记'
  // 确保致谢页内容被居中 div 包裹（封面页大纲已由 watch 实时同步）
  const thanksIdx = pages.value.findIndex(p => p.type === 'thanks')
  if (thanksIdx !== -1) {
    pages.value[thanksIdx].content = wrapThanksContent(pages.value[thanksIdx].content)
  }
  // 标记刚保存：新笔记保存后 props.note 引用会变化，跳过 watch 重新初始化
  justSaved = true
  emit('save', {
    title,
    content: serializeNotePages(pages.value),
    categoryId: editCategoryId.value,
    pinned: props.note?.pinned || false,
  })
}

// 收集当前编辑数据但不触发 emit，供父组件在切换地址/返回前调用以保存内容
const saveAndGetData = () => {
  saveCurrentPageContent()
  const title = noteTitle.value.trim() || '新笔记'
  const thanksIdx = pages.value.findIndex(p => p.type === 'thanks')
  if (thanksIdx !== -1) {
    pages.value[thanksIdx].content = wrapThanksContent(pages.value[thanksIdx].content)
  }
  justSaved = true
  return {
    title,
    content: serializeNotePages(pages.value),
    categoryId: editCategoryId.value,
    pinned: props.note?.pinned || false,
  }
}

// 父组件调用以更新笔记标题（如面包屑重命名）
const setNoteTitle = (title: string) => {
  noteTitle.value = title
}

// 返回前先保存当前页内容（实际保存由父组件 closeDetail 触发 saveAndGetData）
const handleBack = () => {
  saveCurrentPageContent()
  emit('back')
}

defineExpose({ saveAndGetData, setNoteTitle })

// 点击预览：先检查本地数据中有没有对应的笔记数据，携带当前编辑数据交给父组件保存后再切预览
const handlePreview = () => {
  saveCurrentPageContent()
  const title = noteTitle.value.trim() || '新笔记'
  const thanksIdx = pages.value.findIndex(p => p.type === 'thanks')
  if (thanksIdx !== -1) {
    pages.value[thanksIdx].content = wrapThanksContent(pages.value[thanksIdx].content)
  }
  // 标记刚保存：避免父组件保存后 props.note 引用变化触发 watch 重新初始化
  justSaved = true
  emit('preview', {
    title,
    content: serializeNotePages(pages.value),
    categoryId: editCategoryId.value,
    pinned: props.note?.pinned || false,
  })
}
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

/* ====== 顶部标题栏 ====== */
.editor-top-header {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 10px 20px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-header-select {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 14px;
  padding: 2px 8px;
  outline: none;
  cursor: pointer;
  font-family: inherit;
}

.editor-header-select option {
  background: #1e1c34;
  color: #fff;
}

.editor-header-item {
  font-size: 14px;
  color: #e0e0e0;
}

.editor-header-item.clickable {
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}

.editor-header-item.clickable:hover {
  background: rgba(255, 255, 255, 0.08);
}

.editor-header-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 14px;
  padding: 3px 8px;
  outline: none;
  font-family: inherit;
  min-width: 60px;
  text-align: center;
}

.title-measure {
  position: absolute;
  visibility: hidden;
  white-space: pre;
  font-size: 14px;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  padding: 3px 8px;
}

.editor-header-sep {
  margin: 0 10px;
  opacity: 0.5;
  font-size: 14px;
  color: #e0e0e0;
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
}

.editor-sidebar-inner {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
  scrollbar-width: none;
}

.editor-sidebar-inner::-webkit-scrollbar { display: none; }

.editor-sidebar-title {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
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

.editor-sidebar-nav {
  list-style: none;
  padding: 0;
  margin: 0;
}

.editor-sidebar-nav li { margin: 1px 0; line-height: 1.4; }

.editor-sidebar-nav .nav-l1 a {
  display: flex;
  align-items: center;
  padding: 5px 8px;
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.editor-sidebar-nav .nav-l1 a:hover { background: rgba(102, 126, 234, 0.15); color: #93c5fd; }
.editor-sidebar-nav .nav-l1 a.active { background: rgba(102, 126, 234, 0.2); color: #93c5fd; }

.nav-num {
  flex-shrink: 0;
  margin-right: 6px;
  color: #94a3b8;
  font-weight: 600;
}

.nav-title-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-sidebar-nav .nav-l2 a {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 18px;
  font-size: 12px;
  color: #94a3b8;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.editor-sidebar-nav .nav-l2 a:hover { background: rgba(102, 126, 234, 0.12); color: #93c5fd; }
.editor-sidebar-nav .nav-l2 a.active { background: rgba(102, 126, 234, 0.15); color: #93c5fd; }

.editor-sidebar-nav .nav-l3 a {
  display: flex;
  align-items: center;
  padding: 3px 8px 3px 28px;
  font-size: 11px;
  color: #64748b;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.editor-sidebar-nav .nav-l3 a:hover { background: rgba(102, 126, 234, 0.1); color: #93c5fd; }
.editor-sidebar-nav .nav-l3 a.active { background: rgba(102, 126, 234, 0.12); color: #93c5fd; }

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
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: none;
}

.editor-body::-webkit-scrollbar { display: none; }

.editor-content-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.editor-tb-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.editor-tb-btn:hover {
  background: rgba(102, 126, 234, 0.3);
  color: var(--chalk-white);
}

.editor-tb-btn:disabled {
  opacity: 0.3;
  cursor: default;
  pointer-events: none;
}

.editor-tb-select {
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(20, 18, 50, 0.65);
  backdrop-filter: blur(8px);
  color: var(--chalk-white-60);
  border-radius: 4px;
  font-size: 12px;
  padding: 0 6px;
  cursor: pointer;
  outline: none;
}

.editor-tb-select:hover {
  background: rgba(40, 36, 80, 0.75);
  color: var(--chalk-white);
  border-color: rgba(102, 126, 234, 0.4);
}

.editor-tb-select:disabled {
  opacity: 0.3;
  cursor: default;
  pointer-events: none;
}

.editor-tb-select option,
.editor-tb-select optgroup {
  background: rgba(20, 18, 50, 0.95);
  backdrop-filter: blur(12px);
  color: #fff;
  border: none;
}

.editor-tb-select optgroup {
  font-style: normal;
  color: #94a3b8;
  font-weight: 600;
}

.editor-tb-font, .editor-tb-size {
  max-width: 110px;
}

.editor-tb-align {
  display: flex;
  align-items: center;
  gap: 2px;
}

.editor-tb-align-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.15s;
}

.editor-tb-align-btn svg {
  width: 16px;
  height: 16px;
}

.editor-tb-align-btn:hover {
  background: rgba(102, 126, 234, 0.3);
  color: var(--chalk-white);
}

.editor-tb-align-btn.active {
  background: rgba(102, 126, 234, 0.35);
  color: var(--chalk-white);
}

.nav-rename-input {
  flex: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.6);
  border-radius: 3px;
  color: var(--chalk-white);
  font-size: inherit;
  font-family: inherit;
  padding: 1px 4px;
  outline: none;
}

.editor-content {
  flex: 1;
  padding: 14px;
  color: #e2e8f0;
  font-family: '宋体', SimSun, 'Times New Roman', serif;
  font-size: 10.5pt;
  line-height: 1.8;
  outline: none;
  word-break: break-word;
  overflow-y: auto;
  position: relative;
}

.editor-content :deep(h1) { font-size: 22px; font-weight: 700; margin: 12px 0 6px; color: #93c5fd; }
.editor-content :deep(h2) { font-size: 20px; font-weight: 700; margin: 10px 0 5px; color: #93c5fd; }
.editor-content :deep(h3) { font-size: 18px; font-weight: 600; margin: 8px 0 4px; color: #c4b5fd; }
.editor-content :deep(h4) { font-size: 16px; font-weight: 600; margin: 8px 0 4px; color: #c4b5fd; }
.editor-content :deep(h5) { font-size: 15px; font-weight: 600; margin: 8px 0 4px; color: #cbd5e1; }
.editor-content :deep(h6) { font-size: 14px; font-weight: 600; margin: 8px 0 4px; color: #cbd5e1; }
.editor-content :deep(blockquote) {
  border-left: 3px solid #667eea; padding-left: 10px; margin: 6px 0; color: #94a3b8;
}
.editor-content :deep(pre) {
  background: rgba(20, 18, 50, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(102, 126, 234, 0.2);
  padding: 10px; border-radius: 6px; color: #e2e8f0;
  font-family: 'Consolas', 'Monaco', monospace; white-space: pre-wrap; margin: 4px 0;
  font-size: 13px; line-height: 1.6;
}
.editor-content :deep(pre code) {
  background: transparent; padding: 0; border-radius: 0; color: inherit; font-size: inherit;
}
.editor-content :deep(code) {
  background: rgba(102,126,234,0.2); padding: 2px 6px; border-radius: 4px; color: #93c5fd;
  font-family: 'Consolas', 'Monaco', monospace; font-size: 0.92em;
}
.editor-content :deep(ul), .editor-content :deep(ol) { padding-left: 20px; margin: 4px 0; }
.editor-content :deep(img) { max-width: 100%; border-radius: 6px; }
.editor-content :deep(table) { border-collapse: collapse; width: 100%; margin: 4px 0; }
.editor-content :deep(th) { background: rgba(102,126,234,0.2); color: #93c5fd; font-weight: 600; border: 1px solid rgba(255,255,255,0.15); padding: 6px; }
.editor-content :deep(td) { border: 1px solid rgba(255,255,255,0.1); padding: 6px; }
.editor-content :deep(strong) { color: #fbbf24; }
.editor-content :deep(em) { color: #f9a8d4; }

/* ====== HTML 代码块 ====== */
.editor-content :deep(.html-code-block) {
  margin: 8px 0;
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(20, 18, 50, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.editor-content :deep(.html-code-codeview) {
  padding: 10px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-all;
  outline: none;
  min-height: 40px;
}

/* ====== 致谢页内容区 ====== */
.editor-thanks-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  cursor: text;
}

.editor-thanks-display {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
  color: #e2e8f0;
  font-size: 22pt;
  font-family: '宋体', SimSun, 'Times New Roman', serif;
  line-height: 1.8;
  word-break: break-word;
  scrollbar-width: none;
}

.editor-thanks-display::-webkit-scrollbar { display: none; }

/* ====== 致谢内容修改弹窗 ====== */
.thanks-dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 10002;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.thanks-dialog {
  background: #1e1c34;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 20px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.thanks-dialog-title {
  font-size: 16px;
  font-weight: 700;
  color: #e0e0e0;
  margin-bottom: 14px;
  text-align: center;
}

.thanks-dialog-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin-bottom: 14px;
}

.thanks-dialog-textarea {
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: var(--chalk-white);
  font-size: 16px;
  font-family: inherit;
  line-height: 1.8;
  outline: none;
  resize: none;
  text-align: center;
  box-sizing: border-box;
  margin-bottom: 14px;
}

.thanks-dialog-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.thanks-dialog-btn {
  height: 32px;
  border-radius: 16px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: var(--chalk-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 14px;
}

.thanks-dialog-btn svg {
  width: 16px;
  height: 16px;
}

.thanks-dialog-btn.cancel:hover {
  color: #93c5fd;
  background: rgba(102, 126, 234, 0.15);
  border-color: #93c5fd;
}

.thanks-dialog-btn.save {
  background: rgba(102, 126, 234, 0.25);
  border-color: rgba(102, 126, 234, 0.5);
  color: #93c5fd;
}

.thanks-dialog-btn.save:hover {
  background: rgba(102, 126, 234, 0.4);
  border-color: rgba(102, 126, 234, 0.7);
  color: var(--chalk-white);
}

/* ====== 底部导航栏 ====== */
.slide-nav {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.slide-nav-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.slide-nav-left { justify-content: flex-start; }
.slide-nav-right { justify-content: flex-end; }

.slide-nav-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  padding: 0 12px;
}

.slide-nav-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #94a3b8;
}

.slide-nav-btn:hover {
  background: rgba(102, 126, 234, 0.15);
  border-color: #93c5fd;
  color: #93c5fd;
}

.slide-nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
  pointer-events: none;
}

.slide-nav-btn svg { width: 18px; height: 18px; }

.slide-nav-prev-title,
.slide-nav-next-title {
  color: #64748b;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.slide-nav-curr-title {
  color: #e0e0e0;
  font-weight: 700;
  white-space: nowrap;
  font-size: 13px;
}

.slide-nav-counter {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  margin-top: 1px;
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
  gap: 10px;
}

.editor-status-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.editor-status-sep {
  color: rgba(255, 255, 255, 0.1);
}

.editor-back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all 0.2s;
}

.editor-back-btn:hover {
  color: #93c5fd;
  background: rgba(102, 126, 234, 0.15);
  border-color: #93c5fd;
}

.editor-pin-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all 0.15s;
}

.editor-pin-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.editor-pin-btn.active {
  color: var(--chalk-amber);
}

.editor-preview-btn {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: var(--chalk-muted);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.editor-preview-btn:hover {
  color: #93c5fd;
  background: rgba(102, 126, 234, 0.15);
  border-color: #93c5fd;
}

.editor-save-btn {
  padding: 4px 14px;
  background: rgba(102, 126, 234, 0.25);
  border: 1px solid rgba(102, 126, 234, 0.5);
  border-radius: 6px;
  color: #93c5fd;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  box-shadow: 0 0 12px rgba(102, 126, 234, 0.15);
}

.editor-save-btn:hover {
  background: rgba(102, 126, 234, 0.4);
  border-color: rgba(102, 126, 234, 0.7);
  color: var(--chalk-white);
  box-shadow: 0 0 18px rgba(102, 126, 234, 0.3);
}

/* ====== 响应式 ====== */
@media (max-width: 768px) {
  .editor-wrap {
    padding: 8px;
    gap: 8px;
  }

  .editor-top-header {
    padding: 10px 12px;
  }

  .editor-header-item { font-size: 12px; }
  .editor-header-sep { margin: 0 6px; font-size: 12px; }
  .editor-header-select { font-size: 12px; }
  .editor-header-input { font-size: 12px; }
  .title-measure { font-size: 12px; }

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
  .editor-sidebar-nav .nav-l1 a { padding: 4px 10px; font-size: 12px; }
  .editor-sidebar-nav .nav-l2 a { padding: 4px 8px 4px 10px; font-size: 11px; }
  .editor-sidebar-nav .nav-l3 a { padding: 4px 6px 4px 14px; font-size: 10px; }

  .slide-nav { padding: 8px 8px; }
  .slide-nav-prev-title, .slide-nav-next-title { display: none; }
  .slide-nav-center { padding: 0 4px; }
  .slide-nav-curr-title { font-size: 11px; }

  .editor-status-bar { padding: 6px 10px; font-size: 11px; flex-wrap: wrap; gap: 4px; }
  .editor-status-left { gap: 6px; }
}

/* ====== 拖拽排序视觉反馈 ====== */
.editor-sidebar-nav li.nav-dragging {
  opacity: 0.4;
}

.editor-sidebar-nav li.nav-drop-target > a {
  background: rgba(102, 126, 234, 0.25) !important;
  outline: 1px dashed #93c5fd;
  outline-offset: -1px;
}

/* ====== 右键菜单 ====== */
.nav-ctx-menu {
  position: fixed;
  z-index: 10000;
  width: 150px;
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}

.nav-ctx-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 7px 10px;
  border: none;
  background: transparent;
  color: #e0e0e0;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  font-family: inherit;
  transition: background 0.15s;
}

.nav-ctx-icon {
  margin-right: 6px;
  font-size: 13px;
  flex-shrink: 0;
}

.nav-ctx-item:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.25);
  color: #93c5fd;
}

.nav-ctx-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ====== 工具栏分隔线 ====== */
.editor-tb-sep {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 4px;
  align-self: center;
}

/* ====== 格式刷按钮 ====== */
.editor-tb-btn.active {
  background: rgba(102, 126, 234, 0.35);
  color: var(--chalk-white);
}

/* ====== 字体颜色按钮 ====== */
.editor-tb-font-color-wrap {
  position: relative;
}

.font-color-panel-wrap {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  z-index: 10001;
}

/* ====== 下划线样式下拉菜单 ====== */
.editor-tb-underline-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.editor-tb-underline-preview {
  display: inline-flex;
  align-items: center;
}

.underline-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  z-index: 10002;
  min-width: 140px;
  padding: 6px;
  background: rgba(20, 18, 50, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(102, 126, 234, 0.25);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.underline-menu-styles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.underline-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--chalk-white-85);
  font-size: 12px;
  transition: background 0.15s;
  width: 100%;
  text-align: left;
}

.underline-menu-item:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.underline-menu-none {
  justify-content: center;
  text-align: center;
}

.underline-menu-line {
  display: block;
  width: 100%;
  height: 18px;
}

.underline-menu-name {
  flex: 1;
}

.underline-menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 4px 0;
}

.underline-color-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--chalk-white-85);
  font-size: 12px;
  position: relative;
  transition: background 0.15s;
}

.underline-color-item:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.underline-menu-arrow {
  margin-left: auto;
  color: var(--chalk-white-60);
  font-size: 14px;
}

/* 下划线颜色面板（Teleport 到 body，避免被编辑器容器 overflow:hidden 裁剪） */
.underline-color-popover {
  position: fixed;
  z-index: 10003;
}

.underline-color-popover :deep(.color-picker-panel) {
  max-height: var(--ucp-max-height, 90vh);
}

.editor-tb-font-color-btn {
  position: relative;
}

.editor-tb-font-color-swatch {
  display: block;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #000;
  border-radius: 2px;
  text-shadow: 0 0 1px rgba(0,0,0,0.5);
}
</style>