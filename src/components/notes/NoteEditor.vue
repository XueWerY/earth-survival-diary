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
                @contextmenu.prevent.stop="openContextMenu($event, idx)"
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
                <select class="editor-tb-select editor-tb-font" :value="currentFont" @change="onFontChange(($event.target as HTMLSelectElement).value)" title="字体">
                  <option value="" disabled hidden></option>
                  <option v-if="currentFont && !isFontInList(currentFont)" :value="currentFont" :style="{ fontFamily: currentFont }">{{ currentFont }}</option>
                  <optgroup v-if="usedFonts.length" label="页面正在使用的字体">
                    <option v-for="f in usedFonts" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
                  </optgroup>
                  <optgroup label="常用字体">
                    <option v-for="f in commonFonts" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
                  </optgroup>
                </select>
                <select class="editor-tb-select editor-tb-size" :value="currentFontSize" @change="onFontSizeChange(($event.target as HTMLSelectElement).value)" title="字号">
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
                <button class="editor-tb-btn" @click="exec('bold')" title="加粗"><b>B</b></button>
                <button class="editor-tb-btn" @click="exec('italic')" title="斜体"><i>I</i></button>
                <button class="editor-tb-btn" @click="exec('underline')" title="下划线"><u>U</u></button>
                <button class="editor-tb-btn" @click="exec('strikeThrough')" title="删除线"><s>S</s></button>
                
                <div class="editor-tb-font-color-wrap">
                  <button class="editor-tb-btn editor-tb-font-color-btn" :class="{ active: fontColorPanelVisible }" @click="toggleFontColorPanel" title="字体颜色">
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
                <button class="editor-tb-btn" @click="exec('undo')" title="撤销">↶</button>
              </div>
              <div
                v-if="!isThanksPage"
                ref="contentRef"
                class="editor-content"
                :contenteditable="!isCoverPage"
                @input="handleContentInput"
                @paste="handlePaste"
              ></div>
              <div v-else class="editor-thanks-wrap">
                <div v-if="editingThanks" class="editor-thanks-edit-center">
                  <textarea
                    ref="thanksInputRef"
                    v-model="thanksInput"
                    class="editor-thanks-input"
                    :rows="thanksInputRows"
                    @blur="saveThanks"
                    placeholder="输入致谢内容..."
                  ></textarea>
                </div>
                <div v-else class="editor-thanks-display" v-html="pages[currentPageIdx]?.content" @click="startEditThanks"></div>
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
        <button class="editor-back-btn" @click="$emit('back')" title="返回笔记列表">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <span>{{ clockDisplay }}</span>
        <span class="editor-status-sep">|</span>
        <span>全文字数: {{ totalWordCount }}</span>
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
        <button class="nav-ctx-item" @click="ctxCut"><span class="nav-ctx-icon">✂️</span>剪切幻灯片</button>
        <button class="nav-ctx-item" @click="ctxCopy"><span class="nav-ctx-icon">📋</span>复制幻灯片</button>
        <button class="nav-ctx-item" @click="ctxNewSameDown"><span class="nav-ctx-icon">➕</span>新建幻灯片</button>
        <button class="nav-ctx-item" :disabled="pages[ctxTargetIdx]?.level >= 3" @click="ctxNewSubDown"><span class="nav-ctx-icon">🔗</span>新建子幻灯片</button>
        <button class="nav-ctx-item" :disabled="pages[ctxTargetIdx]?.type === 'cover' || pages[ctxTargetIdx]?.type === 'thanks'" @click="ctxRename"><span class="nav-ctx-icon">✏️</span>重命名幻灯片</button>
        <button class="nav-ctx-item" :disabled="pages[ctxTargetIdx]?.type === 'cover' || pages[ctxTargetIdx]?.type === 'thanks'" @click="ctxDelete"><span class="nav-ctx-icon">🗑️</span>删除幻灯片</button>
        <button class="nav-ctx-item" :disabled="!clipboard" @click="ctxPasteDown"><span class="nav-ctx-icon">📎</span>粘贴幻灯片</button>
        <button class="nav-ctx-item" @click="ctxNewUp"><span class="nav-ctx-icon">⬆️</span>向上插入幻灯片</button>
      </div>
      <!-- 粘贴选项菜单 -->
      <div
        v-if="pasteMenuVisible"
        class="nav-ctx-menu paste-menu"
        :style="{ left: pasteMenuPos.x + 'px', top: pasteMenuPos.y + 'px' }"
        @click.stop
        @contextmenu.prevent
      >
        <button class="nav-ctx-item" @mousedown.prevent @click="pasteTargetFormat"><span class="nav-ctx-icon">🎯</span>使用目标格式</button>
        <button class="nav-ctx-item" @mousedown.prevent @click="pasteSourceFormat"><span class="nav-ctx-icon">📋</span>保留源格式</button>
        <button class="nav-ctx-item" @mousedown.prevent @click="pasteTextOnly"><span class="nav-ctx-icon">📝</span>只保留文本</button>
      </div>
      <!-- 选中文本工具面板 -->
      <div
        v-if="selectionPanelVisible"
        class="selection-panel"
        :style="{ left: selectionPanelPos.x + 'px', top: selectionPanelPos.y + 'px' }"
        @click.stop
        @mousedown.prevent
        @mouseup.stop
      >
        <select class="editor-tb-select editor-tb-font" :value="currentFont" @change="onFontChange(($event.target as HTMLSelectElement).value)" title="字体">
          <option value="" disabled hidden></option>
          <option v-if="currentFont && !isFontInList(currentFont)" :value="currentFont" :style="{ fontFamily: currentFont }">{{ currentFont }}</option>
          <optgroup v-if="usedFonts.length" label="页面正在使用的字体">
            <option v-for="f in usedFonts" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
          </optgroup>
          <optgroup label="常用字体">
            <option v-for="f in commonFonts" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
          </optgroup>
        </select>
        <select class="editor-tb-select editor-tb-size" :value="currentFontSize" @change="onFontSizeChange(($event.target as HTMLSelectElement).value)" title="字号">
          <option value="" disabled hidden></option>
          <option v-if="currentFontSize && !isSizeInList(currentFontSize)" :value="currentFontSize">{{ currentFontSize }}</option>
          <optgroup label="中文字号">
            <option v-for="s in cnFontSizes" :key="s.name" :value="s.pt + 'pt'">{{ s.name }}</option>
          </optgroup>
          <optgroup label="数字字号">
            <option v-for="s in numFontSizes" :key="s" :value="s + 'pt'">{{ s }}</option>
          </optgroup>
        </select>
        <button class="editor-tb-btn" @click="exec('bold')" title="加粗"><b>B</b></button>
        <button class="editor-tb-btn" @click="exec('italic')" title="斜体"><i>I</i></button>
        <button class="editor-tb-btn" @click="exec('underline')" title="下划线"><u>U</u></button>
        <button class="editor-tb-btn" @click="exec('backColor', '#FFFF00')" title="文本突出显示颜色">🖍</button>
        <button class="editor-tb-btn" @click="exec('insertUnorderedList')" title="项目符号">•</button>
        <button class="editor-tb-btn" @click="exec('insertOrderedList')" title="编号">1.</button>
        <select class="editor-tb-select" @change="exec('formatBlock', ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
          <option value="">正文</option>
          <option value="H1">标题1</option>
          <option value="H2">标题2</option>
          <option value="H3">标题3</option>
          <option value="H4">标题4</option>
          <option value="H5">标题5</option>
          <option value="H6">标题6</option>
        </select>
        <button class="editor-tb-btn" @click="copySelectionStyle" title="复制样式">📋</button>
        <button class="editor-tb-btn" :disabled="!copiedStyle" @click="applySelectionStyle" title="应用样式">📌</button>
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
// 致谢页内容编辑（点击内容出现输入框）
const editingThanks = ref(false)
const thanksInput = ref('')
const thanksInputRef = ref<HTMLTextAreaElement | null>(null)
// 致谢页输入框行数（根据内容行数动态计算，仅占内容所在行高度）
const thanksInputRows = computed(() => {
  const lines = thanksInput.value.split('\n').length
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
    pages.value[currentPageIdx.value].content = contentRef.value.innerHTML
  }
}

// 加载指定页面内容到编辑器
const loadPageContent = (idx: number) => {
  if (contentRef.value && pages.value[idx]) {
    contentRef.value.innerHTML = pages.value[idx].content || ''
  }
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
  saveThanks()
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

// 自动识别 HTML 代码并执行（渲染）
const handleContentInput = () => {
  if (!contentRef.value) return
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  let node: Node | null = sel.anchorNode
  // 找到当前所在的块级元素
  while (node && node !== contentRef.value) {
    if (node.nodeType === 1) {
      const el = node as HTMLElement
      if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(el.tagName)) {
        const text = el.textContent || ''
        // 检测是否包含完整的 HTML 标签（开闭标签）
        if (/<(\w+)([^>]*)>([\s\S]*?)<\/\1>/.test(text)) {
          // 保存光标偏移量
          const caretOffset = sel.anchorOffset
          el.innerHTML = text
          // 尝试恢复光标到最接近的位置
          const newRange = document.createRange()
          newRange.selectNodeContents(el)
          const maxOffset = newRange.endOffset
          newRange.setStart(el, Math.min(caretOffset, maxOffset))
          newRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(newRange)
        }
        break
      }
    }
    node = node.parentNode
  }
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
    pasteMenuPos.value = {
      x: rect.left || clientX,
      y: (rect.bottom || clientY) + 4
    }
  } else {
    pendingPasteRange = null
    pasteMenuPos.value = { x: clientX, y: clientY }
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

// 使用目标格式：去掉内联样式后插入 HTML
const pasteTargetFormat = () => {
  if (!pasteMenuVisible.value) return
  if (pendingPasteHtml) {
    const tmp = document.createElement('div')
    tmp.innerHTML = pendingPasteHtml
    tmp.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'))
    tmp.querySelectorAll('font').forEach(el => {
      const parent = el.parentNode!
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
    })
    restoreSelectionAndExec('insertHTML', tmp.innerHTML)
  } else {
    restoreSelectionAndExec('insertText', pendingPasteText)
  }
  closePasteMenu()
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

// 只保留文本
const pasteTextOnly = () => {
  if (!pasteMenuVisible.value) return
  restoreSelectionAndExec('insertText', pendingPasteText)
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
  updateSelectionPanel()
}

// ====== 选中文本工具面板 ======
const selectionPanelVisible = ref(false)
const selectionPanelPos = ref({ x: 0, y: 0 })
const copiedStyle = ref<string | null>(null)

const updateSelectionPanel = () => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount || !contentRef.value?.contains(sel.anchorNode)) {
    selectionPanelVisible.value = false
    return
  }
  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (!rect || rect.width === 0) {
    selectionPanelVisible.value = false
    return
  }
  // 面板放在选区下方中间
  const panelWidth = 420
  let x = rect.left + rect.width / 2 - panelWidth / 2
  let y = rect.bottom + 8
  if (x < 4) x = 4
  if (x + panelWidth > window.innerWidth - 4) x = window.innerWidth - panelWidth - 4
  if (y + 44 > window.innerHeight - 4) y = rect.top - 44
  selectionPanelPos.value = { x, y }
  selectionPanelVisible.value = true
}

const copySelectionStyle = () => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  const fragment = range.cloneContents()
  const wrapper = document.createElement('div')
  wrapper.appendChild(fragment)
  // 提取第一个有样式的 span 的样式
  const firstSpan = wrapper.querySelector('span[style]') as HTMLElement | null
  if (firstSpan) {
    copiedStyle.value = firstSpan.style.cssText
  } else {
    copiedStyle.value = ''
  }
}

const applySelectionStyle = () => {
  if (!copiedStyle.value) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return
  contentRef.value?.focus()
  const markup = `<span style="${copiedStyle.value}">${sel.toString()}</span>`
  document.execCommand('insertHTML', false, markup)
  updateCurrentFontAndSize()
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

const startEditThanks = () => {
  if (editingThanks.value) return
  const page = pages.value[currentPageIdx.value]
  if (!page) return
  const tmp = document.createElement('div')
  tmp.innerHTML = page.content
  // 将 <br> 转换为换行，便于在 textarea 中编辑
  tmp.querySelectorAll('br').forEach(br => br.replaceWith('\n'))
  thanksInput.value = (tmp.textContent || '').trim()
  editingThanks.value = true
  nextTick(() => {
    thanksInputRef.value?.focus()
    thanksInputRef.value?.select()
  })
}

// 致谢页：失焦或回车时保存输入框内容，重新用居中样式包裹
const saveThanks = () => {
  if (!editingThanks.value) return
  const page = pages.value[currentPageIdx.value]
  if (page) {
    const text = thanksInput.value.trim() || '感谢聆听！'
    page.content = wrapThanksContent(`<p>${text.replace(/\n/g, '<br>')}</p>`)
  }
  editingThanks.value = false
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

// 选中指定索引页面（保存当前页内容并加载新页）
const selectPage = (idx: number) => {
  saveThanks()
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
  document.addEventListener('selectionchange', handleSelectionChange)
})

const closeFontColorPanel = (e: MouseEvent) => {
  if (!fontColorPanelVisible.value) return
  const target = e.target as HTMLElement
  if (target.closest('.font-color-panel-wrap') || target.closest('.editor-tb-font-color-btn')) return
  fontColorPanelVisible.value = false
}

onBeforeUnmount(() => {
  document.removeEventListener('pointermove', onDocPointerMove)
  document.removeEventListener('pointerup', onDocPointerUp)
  document.removeEventListener('pointercancel', onDocPointerUp)
  document.removeEventListener('click', closeCtxMenu)
  document.removeEventListener('contextmenu', closeCtxMenu)
  document.removeEventListener('click', closePasteMenu)
  document.removeEventListener('click', closeFontColorPanel)
  document.removeEventListener('selectionchange', handleSelectionChange)
})

const handleSave = () => {
  saveThanks()
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

// 点击预览：先检查本地数据中有没有对应的笔记数据，携带当前编辑数据交给父组件保存后再切预览
const handlePreview = () => {
  saveThanks()
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
  color: var(--chalk-white);
  font-family: '宋体', SimSun, 'Times New Roman', serif;
  font-size: 10.5pt;
  line-height: 1.8;
  outline: none;
  word-break: break-word;
  overflow-y: auto;
  position: relative;
}



.editor-content :deep(h1) { font-size: 22px; font-weight: 700; margin: 12px 0 6px; }
.editor-content :deep(h2) { font-size: 20px; font-weight: 700; margin: 10px 0 5px; }
.editor-content :deep(h3) { font-size: 18px; font-weight: 600; margin: 8px 0 4px; }
.editor-content :deep(blockquote) {
  border-left: 3px solid #667eea; padding-left: 10px; margin: 6px 0; color: var(--chalk-white-70);
}
.editor-content :deep(pre) {
  background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; color: #a8edea;
  font-family: monospace; white-space: pre-wrap; margin: 4px 0;
}
.editor-content :deep(ul), .editor-content :deep(ol) { padding-left: 20px; margin: 4px 0; }
.editor-content :deep(img) { max-width: 100%; border-radius: 6px; }
.editor-content :deep(table) { border-collapse: collapse; width: 100%; margin: 4px 0; }
.editor-content :deep(td) { border: 1px solid rgba(255,255,255,0.2); padding: 6px; }

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
  color: var(--chalk-white);
  font-size: 22pt;
  font-family: '宋体', SimSun, 'Times New Roman', serif;
  line-height: 1.8;
  word-break: break-word;
  scrollbar-width: none;
}

.editor-thanks-display::-webkit-scrollbar { display: none; }

.editor-thanks-edit-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 14px;
}

.editor-thanks-input {
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
  width: 100%;
  max-width: 500px;
  box-sizing: border-box;
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

/* ====== 选中文本工具面板 ====== */
.selection-panel {
  position: fixed;
  z-index: 10001;
  display: flex;
  flex-wrap: nowrap;
  gap: 3px;
  padding: 5px 8px;
  background: rgba(18, 16, 42, 0.96);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  align-items: center;
  white-space: nowrap;
}

.selection-panel .editor-tb-btn {
  width: 26px;
  height: 26px;
  font-size: 11px;
}

.selection-panel .editor-tb-select {
  height: 26px;
  font-size: 11px;
}

.selection-panel .editor-tb-btn:disabled {
  opacity: 0.3;
}
</style>