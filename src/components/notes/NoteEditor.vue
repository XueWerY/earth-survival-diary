<template>
  <div class="editor-wrap">
    <!-- 主容器 -->
    <div class="editor-main">
      <!-- 侧边栏大纲 -->
      <aside class="editor-sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="editor-sidebar-inner">
          <div class="editor-sidebar-header">
            <span v-if="!sidebarCollapsed" class="editor-sidebar-title">大纲</span>
            <button class="sidebar-toggle-btn" @click="sidebarCollapsed = !sidebarCollapsed" :title="sidebarCollapsed ? '展开大纲' : '收起大纲'">
              <el-icon><ArrowLeft v-if="!sidebarCollapsed" /><ArrowRight v-else /></el-icon>
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
          <MarkdownEditor
            ref="mdEditorRef"
            v-model="editorContent"
            placeholder="开始编写 Markdown 笔记..."
            @input="refreshOutline"
          />
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
        <button class="editor-save-btn" @click="handleSave">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { ArrowLeft, ArrowRight, Star, StarFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Note, MdOutlineItem } from '../../stores/noteStore'
import { extractMdOutline } from '../../stores/noteStore'
import MarkdownEditor from '../editor/MarkdownEditor.vue'

const props = defineProps<{
  note: Note | null
  clockDisplay: string
  totalWordCount: number
}>()

const emit = defineEmits<{
  (e: 'save', data: { title: string; content: string; categoryId: string; pinned: boolean }): void
  (e: 'back'): void
  (e: 'togglePin'): void
}>()

const noteTitle = ref('')
const editCategoryId = ref('')
const editorContent = ref('')
const mdEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
let lastNoteId: string | null = null
let justSaved = false

// 大纲
const outline = ref<MdOutlineItem[]>([])
const sidebarCollapsed = ref(false)

const refreshOutline = () => {
  outline.value = extractMdOutline(editorContent.value)
}

// 滚动到指定标题位置
const scrollToHeading = (item: MdOutlineItem) => {
  const md = editorContent.value || ''
  const totalLines = md ? md.split('\n').length : 1
  const ratio = item.line / totalLines

  // 滚动块容器
  const container = mdEditorRef.value?.blocksContainerRef
  if (container) {
    container.scrollTo({ top: ratio * container.scrollHeight, behavior: 'smooth' })
  }

  // 按标题文本匹配精确定位
  const selector = Array.from({ length: 6 }, (_, i) => `h${i + 1}`).join(',')
  const headings: NodeListOf<HTMLElement> = document.querySelectorAll('.md-blocks ' + selector)
  const searchText = item.text.trim()
  for (const h of headings) {
    if ((h.textContent || '').trim() === searchText) {
      h.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }
  }
}

// 获取编辑器内容
const getEditorContent = (): string => {
  return editorContent.value
}

// 监听笔记切换
watch(() => props.note, (note) => {
  if (!note) return
  if (justSaved) {
    justSaved = false
    lastNoteId = note.id
    return
  }
  const isNewNote = note.id !== lastNoteId
  lastNoteId = note.id
  if (!isNewNote) return
  noteTitle.value = note.title
  editCategoryId.value = note.categoryId
  editorContent.value = note.content || ''
  nextTick(refreshOutline)
}, { immediate: true })

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

const handleSave = () => {
  const title = noteTitle.value.trim() || '新笔记'
  justSaved = true
  emit('save', {
    title,
    content: getEditorContent(),
    categoryId: editCategoryId.value,
    pinned: props.note?.pinned || false,
  })
}

const handleBack = () => {
  emit('back')
}

// 获取保存数据（供父组件在切换地址前调用）
const saveAndGetData = () => {
  const title = noteTitle.value.trim() || '新笔记'
  justSaved = true
  return {
    title,
    content: getEditorContent(),
    categoryId: editCategoryId.value,
    pinned: props.note?.pinned || false,
  }
}

// 父组件调用以更新笔记标题（如面包屑重命名）
const setNoteTitle = (title: string) => {
  noteTitle.value = title
}

defineExpose({ saveAndGetData, setNoteTitle })
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
</style>


