<template>
  <div class="editor-wrap">
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
      <div class="editor-content-area">
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
            v-model="editorContent"
            class="editor-source"
            spellcheck="false"
            placeholder="Markdown 源码"
            @input="refreshOutline"
            @keydown="onSourceKeydown"
          ></textarea>
        </div>
      </div>
    </div>

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
        <span v-if="savedAtText" class="editor-autosave">已自动保存 {{ savedAtText }}</span>
        <button class="editor-fs-btn" @click="$emit('toggleFullscreenEdit')" :title="fullscreenEdit ? '退出全屏编辑' : '全屏编辑'">
          <el-icon><Minimize2 v-if="fullscreenEdit" /><Maximize2 v-else /></el-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Code, Download, Link2, ListTree, Maximize2, Minimize2, PanelLeftClose, PenLine, Star } from '@lucide/vue'
import dayjs from 'dayjs'
import type { Note, MdOutlineItem } from '../../stores/noteStore'
import { extractMdOutline, getMdPlainText } from '../../stores/noteStore'
import MilkdownEditor from '../editor/MilkdownEditor.vue'

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
let lastNoteId: string | null = null

// ====== 自动保存 ======
// - 输入防抖 800ms 后落库
// - 切换/关闭笔记、组件卸载、窗口隐藏时强制落库未保存的修改
// - savedTitle/savedContent 为「已发出保存」快照，用于去重与切换前差异判断
const AUTOSAVE_DELAY = 800
let savedTitle = ''
let savedContent = ''
let justSavedForId: string | null = null // 刚发出保存的笔记 id：防止保存回写触发内容重置
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

// 滚动到指定标题位置
const scrollToHeading = (item: MdOutlineItem) => {
  const md = editorContent.value || ''
  const totalLines = md ? md.split('\n').length : 1
  const ratio = item.line / totalLines

  // 滚动块容器（源码模式下无 Milkdown 容器，跳过比例滚动）
  const container = mdEditorRef.value?.blocksContainerRef
  if (container) {
    container.scrollTo({ top: ratio * container.scrollHeight, behavior: 'smooth' })
  }

  // 按标题文本在编辑容器内精确定位
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

/** 立即保存 targetNote 的当前编辑内容（内容仍留在 editorContent 中时调用） */
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

// 组件卸载 / 窗口隐藏时强制落库，避免退出丢失未保存修改
const flushOnLeave = () => {
  const note = props.note
  if (note && note.id === lastNoteId) flushPending(note)
}
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onBeforeUnmount(() => {
  flushOnLeave()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (autosaveTimer) clearTimeout(autosaveTimer)
})
const onVisibilityChange = () => {
  if (document.visibilityState === 'hidden') flushOnLeave()
}

defineExpose({ setNoteTitle, sidebarCollapsed, toggleSidebar })
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

/* 竖线连接线段：非首项从上一项圆点延伸到本项圆点，使相邻两点之间连线连通；首项上方、末项下方均不延伸 */
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

/* 层级视觉区分：递增横线长度 + 缩进 + 递减字号/字重/颜色 */
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
  /* 移动端横向标签流，不显示层级引导线 */
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
</style>


