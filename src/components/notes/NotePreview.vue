<template>
  <div class="preview-container">
    <!-- 主容器 -->
    <div class="preview-main">
      <!-- 侧边栏导航 -->
      <aside class="preview-sidebar" v-if="!isFullscreen">
        <div class="preview-sidebar-inner">
          <div class="preview-sidebar-title">目录</div>
          <ul class="preview-sidebar-nav">
            <template v-for="(page, idx) in pages" :key="page.id">
              <li :class="'nav-l' + page.level">
                <a :class="{ active: currentSlide === idx }" @click="showSlide(idx)">
                  <span class="nav-num" v-if="computePageNumber(pages, idx)">{{ computePageNumber(pages, idx) }}</span>
                  <span class="nav-title-text">{{ page.title }}</span>
                </a>
              </li>
            </template>
          </ul>
        </div>
      </aside>

      <!-- 主内容区 -->
      <div class="preview-content-area">
        <div class="slide-viewport" ref="slideViewportRef" :class="{ fullscreen: isFullscreen }" @mouseenter="handleSlideMouseEnter" @mouseleave="handleSlideMouseLeave">
          <div class="slide-container" ref="slideContainerRef">
            <!-- 幻灯片（封面页内容已包含大纲，由编辑器自动生成） -->
            <div
              v-for="(page, idx) in pages"
              :key="page.id"
              class="slide"
              :class="{ active: idx === 0 }"
              :data-title="page.title"
              :data-type="page.type || ''"
            >
              <div class="slide-content" v-html="page.content"></div>
            </div>
          </div>

          <!-- 底部导航栏 -->
          <div class="slide-nav">
            <div class="slide-nav-side slide-nav-left">
              <button class="slide-nav-btn" :disabled="currentSlide === 0" @click="showSlide(currentSlide - 1)" title="上一页">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span class="slide-nav-prev-title">{{ currentSlide > 0 ? (slides[currentSlide - 1]?.getAttribute('data-title') || '') : '' }}</span>
            </div>
            <div class="slide-nav-center">
              <span class="slide-nav-curr-title">{{ slides[currentSlide]?.getAttribute('data-title') || '' }}</span>
              <span class="slide-nav-counter">{{ currentSlide + 1 }} / {{ slides.length }}</span>
            </div>
            <div class="slide-nav-side slide-nav-right">
              <span class="slide-nav-next-title">{{ currentSlide < slides.length - 1 ? (slides[currentSlide + 1]?.getAttribute('data-title') || '') : '' }}</span>
              <button class="slide-nav-btn" :disabled="currentSlide >= slides.length - 1" @click="showSlide(currentSlide + 1)" title="下一页">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="preview-status-bar" v-if="!isFullscreen">
      <div class="preview-status-left">
        <button class="preview-back-btn" @click="$emit('close')" title="返回">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <span>{{ clockDisplay }}</span>
        <span class="preview-status-sep">|</span>
        <span>全文字数: {{ totalWordCount }}</span>
        <span class="preview-status-sep">|</span>
        <span>创建于 {{ formatTime(note?.createdAt) }}</span>
        <span class="preview-status-sep">|</span>
        <span>更新于 {{ formatTime(note?.updatedAt) }}</span>
      </div>
      <div class="preview-status-right">
        <button class="card-icon-btn" :class="{ active: note?.pinned }" :title="note?.pinned ? '取消置顶' : '置顶'" @click="$emit('togglePin')">
          <el-icon><StarFilled v-if="note?.pinned" /><Star v-else /></el-icon>
        </button>
        <button class="card-icon-btn" title="编辑" @click="$emit('edit')"><el-icon><Edit /></el-icon></button>
        <span class="preview-status-sep">|</span>
        <button class="preview-status-btn" title="导出为 HTML 文件，可在浏览器中打开汇报" @click="exportToHtml">导出</button>
        <button class="preview-status-btn" @click="$emit('toggleFullscreen')">{{ isFullscreen ? '退出' : '放映' }}</button>
      </div>
    </div>

    <!-- 文字选择弹出工具栏 -->
    <div class="text-popup" ref="textPopupRef" v-show="textPopupVisible" :style="textPopupStyle">
      <button @click="addWavy">添加波浪下划线</button>
      <button class="remove-btn" @click="removeWavy">取消波浪下划线</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Star, StarFilled, Edit } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Note, NoteCategory, NotePage } from '../../stores/noteStore'
import { parseNotePages, computePageNumber } from '../../stores/noteStore'

const props = defineProps<{
  note: Note | null
  categories: NoteCategory[]
  clockDisplay: string
  totalWordCount: number
  isFullscreen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'togglePin'): void
  (e: 'toggleFullscreen'): void
}>()

const categoryName = computed(() => {
  if (!props.note) return ''
  return props.categories.find(c => c.id === props.note.categoryId)?.name || '未分类'
})

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

// 解析笔记内容为页面数组（兼容旧版 HTML/纯文本格式）
const pages = computed<NotePage[]>(() => {
  if (!props.note?.content) return []
  return parseNotePages(props.note.content)
})

// 幻灯片管理
const slideViewportRef = ref<HTMLElement | null>(null)
const slideContainerRef = ref<HTMLElement | null>(null)
const currentSlide = ref(0)
const slideFocused = ref(false)

const handleSlideMouseEnter = () => { slideFocused.value = true }
const handleSlideMouseLeave = () => { slideFocused.value = false }

const slides = ref<HTMLElement[]>([])

const refreshSlides = () => {
  if (!slideContainerRef.value) return
  slides.value = Array.from(slideContainerRef.value.querySelectorAll('.slide')) as HTMLElement[]
}

// 笔记变化时（如从编辑模式切回预览）重新渲染幻灯片
watch(() => props.note, () => {
  currentSlide.value = 0
  nextTick(() => {
    refreshSlides()
    showSlide(0)
  })
})

const showSlide = (idx: number) => {
  if (slides.value.length === 0) return
  if (idx < 0) idx = 0
  if (idx >= slides.value.length) idx = slides.value.length - 1
  slides.value.forEach((s, i) => s.classList.toggle('active', i === idx))
  currentSlide.value = idx
  if (slideContainerRef.value) {
    slideContainerRef.value.scrollTop = 0
  }
}

// 键盘导航
const handleKeydown = (e: KeyboardEvent) => {
  if (!slideFocused.value && !props.isFullscreen) return
  const key = e.key.toLowerCase()
  if (key === 'p' || key === 'arrowleft' || key === 'arrowup') {
    e.preventDefault()
    showSlide(currentSlide.value - 1)
  } else if (key === 'n' || key === 'arrowright' || key === 'arrowdown' || key === ' ') {
    e.preventDefault()
    showSlide(currentSlide.value + 1)
  } else if (key === 'escape' && props.isFullscreen) {
    e.preventDefault()
    emit('toggleFullscreen')
  }
}

// 触摸滑动
let touchStartX = 0
const handleTouchStart = (e: TouchEvent) => {
  touchStartX = e.touches[0].clientX
}
const handleTouchEnd = (e: TouchEvent) => {
  const diff = touchStartX - e.changedTouches[0].clientX
  if (Math.abs(diff) > 60) {
    showSlide(currentSlide.value + (diff > 0 ? 1 : -1))
  }
}

// 文字选择弹出工具栏
const textPopupRef = ref<HTMLElement | null>(null)
const textPopupVisible = ref(false)
const textPopupStyle = ref({ left: '0px', top: '0px' })
let popupTarget: Range | null = null

const handleMouseUp = () => {
  setTimeout(() => {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (!text) {
      textPopupVisible.value = false
      popupTarget = null
      return
    }
    const range = sel!.getRangeAt(0)
    const container = range.commonAncestorContainer
    const inSlide = container.nodeType === 1
      ? (container as Element).closest('.slide')
      : (container.parentElement && container.parentElement.closest('.slide'))
    if (!inSlide) {
      textPopupVisible.value = false
      popupTarget = null
      return
    }
    const rect = range.getBoundingClientRect()
    textPopupVisible.value = true
    textPopupStyle.value = {
      left: Math.min(rect.left + rect.width / 2, window.innerWidth - 200) + 'px',
      top: (rect.bottom + window.scrollY + 6) + 'px'
    }
    popupTarget = range
  }, 10)
}

const handleMouseDown = (e: MouseEvent) => {
  if (textPopupRef.value && !textPopupRef.value.contains(e.target as Node)) {
    textPopupVisible.value = false
  }
}

// 选区变化时（如按 Delete 键删除选中文本后）隐藏波浪下划线弹窗
const handleSelectionChange = () => {
  if (!textPopupVisible.value) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    textPopupVisible.value = false
    popupTarget = null
  }
}

const addWavy = () => {
  if (!popupTarget) return
  const span = document.createElement('span')
  span.className = 'wavy'
  try {
    popupTarget.surroundContents(span)
  } catch {
    popupTarget.extractContents()
    span.appendChild(popupTarget.cloneContents())
    popupTarget.insertNode(span)
  }
  window.getSelection()?.removeAllRanges()
  textPopupVisible.value = false
  popupTarget = null
}

const removeWavy = () => {
  if (!popupTarget) return
  const container = popupTarget.commonAncestorContainer
  const parent = container.nodeType === 3 ? container.parentNode : container
  const wavyEl = (parent as Element)?.closest?.('.wavy')
  if (wavyEl) {
    const p = wavyEl.parentNode!
    while (wavyEl.firstChild) {
      p.insertBefore(wavyEl.firstChild, wavyEl)
    }
    p.removeChild(wavyEl)
    p.normalize()
  }
  window.getSelection()?.removeAllRanges()
  textPopupVisible.value = false
  popupTarget = null
}

// 导出整个笔记为 HTML 文件，布局/样式/操作/内容与预览界面完全一致
const exportToHtml = async () => {
  if (!props.note) return
  const noteTitle = props.note.title || '未命名笔记'
  const allPages = pages.value

  // 预计算侧边栏目录项
  const sidebarItems = allPages.map((page, idx) => {
    const num = computePageNumber(allPages, idx)
    const numDisplay = (page.type === 'cover' || page.type === 'thanks') ? '' : (num || '')
    const numHtml = numDisplay ? '<span class="nav-num">' + numDisplay + '</span>' : ''
    return '<li class="nav-l' + page.level + '"><a data-idx="' + idx + '" class="' + (idx === 0 ? 'active' : '') + '">' + numHtml + '<span class="nav-title-text">' + page.title + '</span></a></li>'
  }).join('\n')

  // 预计算幻灯片内容
  const slidesHtml = allPages.map((page, idx) => {
    return '<div class="slide' + (idx === 0 ? ' active' : '') + '" data-title="' + page.title + '" data-type="' + (page.type || '') + '"><div class="slide-content">' + page.content + '</div></div>'
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${noteTitle}</title>
<style>
:root {
  --chalk-white: #fff;
  --chalk-white-60: rgba(255,255,255,0.6);
  --chalk-white-70: rgba(255,255,255,0.7);
  --chalk-white-85: rgba(255,255,255,0.85);
  --chalk-white-90: rgba(255,255,255,0.9);
  --chalk-muted: rgba(255,255,255,0.5);
  --chalk-primary: #667eea;
  --chalk-amber: #fbbf24;
  --chalk-subtle: rgba(255,255,255,0.4);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; background: linear-gradient(to bottom, #0f0c29 0%, #302b63 50%, #24243e 100%); }
body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; color: #e0e0e0; line-height: 1.8; }
.star-canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
.preview-container { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; min-height: 100vh; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; color: #e0e0e0; line-height: 1.8; padding: 16px; gap: 16px; background: transparent; }
.preview-top-header { flex-shrink: 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 10px 20px; text-align: center; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; }
.preview-header-item { font-size: 14px; color: #e0e0e0; }
.preview-header-sep { margin: 0 10px; opacity: 0.5; font-size: 14px; color: #e0e0e0; }
.preview-main { flex: 1; min-height: 0; display: flex; overflow: hidden; gap: 16px; }
.preview-sidebar { width: 220px; flex-shrink: 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
.preview-sidebar-inner { flex: 1; overflow-y: auto; padding: 12px 10px; scrollbar-width: none; }
.preview-sidebar-inner::-webkit-scrollbar { display: none; }
.preview-sidebar-title { font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; padding-left: 4px; }
.preview-sidebar-nav { list-style: none; padding: 0; margin: 0; }
.preview-sidebar-nav li { margin: 1px 0; line-height: 1.4; }
.preview-sidebar-nav .nav-l1 a { display: flex; align-items: center; padding: 5px 8px; font-size: 13px; font-weight: 600; color: #cbd5e1; text-decoration: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
.preview-sidebar-nav .nav-l1 a:hover { background: rgba(102,126,234,0.15); color: #93c5fd; }
.preview-sidebar-nav .nav-l1 a.active { background: rgba(102,126,234,0.2); color: #93c5fd; }
.preview-sidebar-nav .nav-l2 a { display: flex; align-items: center; padding: 4px 8px 4px 18px; font-size: 12px; color: #94a3b8; text-decoration: none; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
.preview-sidebar-nav .nav-l2 a:hover { background: rgba(102,126,234,0.12); color: #93c5fd; }
.preview-sidebar-nav .nav-l2 a.active { background: rgba(102,126,234,0.15); color: #93c5fd; }
.preview-sidebar-nav .nav-l3 a { display: flex; align-items: center; padding: 3px 8px 3px 28px; font-size: 11px; color: #64748b; text-decoration: none; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
.preview-sidebar-nav .nav-l3 a:hover { background: rgba(102,126,234,0.1); color: #93c5fd; }
.preview-sidebar-nav .nav-l3 a.active { background: rgba(102,126,234,0.12); color: #93c5fd; }
.preview-sidebar-nav .nav-num { flex-shrink: 0; margin-right: 6px; color: #94a3b8; font-weight: 600; }
.preview-sidebar-nav .nav-title-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-content-area { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.slide-viewport { display: flex; flex-direction: column; height: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; }
.slide-viewport.fullscreen { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999; border-radius: 0; border: none; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); }
.slide-container { flex: 1; overflow-y: auto; position: relative; scrollbar-width: none; }
.slide-container::-webkit-scrollbar { display: none; }
.slide { display: none; animation: slideFadeIn 0.35s ease; min-height: 100%; flex-direction: column; justify-content: flex-start; padding: 20px 40px 30px; box-sizing: border-box; }
.slide.active { display: flex; }
@keyframes slideFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.cover-wrap { padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; }
.cover-title { font-size: 22px; font-weight: 700; color: #93c5fd; margin-bottom: 8px; text-align: center; }
.cover-subtitle { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
.cover-outline { max-width: 500px; width: 100%; }
.cover-outline-row { display: flex; align-items: baseline; gap: 12px; padding: 10px 0; border-bottom: 1px dashed rgba(255,255,255,0.1); }
.cover-outline-row:last-child { border-bottom: none; }
.cover-outline-num { font-size: 16px; font-weight: 700; color: #93c5fd; min-width: 36px; text-align: center; }
.cover-outline-name { font-size: 14px; color: #cbd5e1; }
.cover-empty { color: rgba(255,255,255,0.5); font-size: 14px; margin-top: 16px; }
.slide-content { flex: 1; display: flex; flex-direction: column; font-size: 14px; line-height: 1.8; color: #e0e0e0; }
.slide[data-type="cover"] .slide-content, .slide[data-type="thanks"] .slide-content { font-family: '宋体', SimSun, 'Times New Roman', serif; font-size: 10.5pt; }
.slide-content [style*="60vh"] { min-height: 0 !important; flex: 1; }
.slide-content h1 { font-size: 22px; color: #93c5fd; margin: 20px 0 12px; padding-bottom: 8px; border-bottom: 2px solid rgba(102,126,234,0.3); }
.slide-content h2 { font-size: 20px; color: #93c5fd; margin: 18px 0 10px; }
.slide-content h3 { font-size: 18px; color: #a78bfa; margin: 16px 0 8px; }
.slide-content h4 { font-size: 16px; color: #a78bfa; margin: 14px 0 8px; }
.slide-content h5 { font-size: 15px; color: #cbd5e1; margin: 12px 0 6px; }
.slide-content h6 { font-size: 14px; color: #cbd5e1; margin: 10px 0 6px; }
.slide-content p { margin: 6px 0; text-align: justify; }
.slide-content ul, .slide-content ol { margin: 8px 0 12px 1.5em; }
.slide-content li { margin-bottom: 4px; }
.slide-content blockquote { border-left: 3px solid #667eea; padding-left: 12px; margin: 8px 0; color: #94a3b8; }
.slide-content pre { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; color: #a8edea; font-family: 'Consolas', 'Monaco', monospace; white-space: pre-wrap; margin: 8px 0; font-size: 13px; }
.slide-content code { background: rgba(102,126,234,0.15); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
.slide-content table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; }
.slide-content th { background: rgba(102,126,234,0.15); color: #93c5fd; font-weight: 600; border: 1px solid rgba(255,255,255,0.15); padding: 8px 10px; text-align: left; }
.slide-content td { border: 1px solid rgba(255,255,255,0.1); padding: 8px 10px; }
.slide-content img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
.slide-content strong { color: #fbbf24; }
.slide-content em { color: #f472b6; }
.slide-nav { display: flex; align-items: center; padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
.slide-nav-side { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.slide-nav-left { justify-content: flex-start; }
.slide-nav-right { justify-content: flex-end; }
.slide-nav-center { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; padding: 0 12px; }
.slide-nav-btn { flex-shrink: 0; width: 36px; height: 36px; border: 1.5px solid rgba(255,255,255,0.15); border-radius: 50%; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: #94a3b8; }
.slide-nav-btn:hover { background: rgba(102,126,234,0.15); border-color: #93c5fd; color: #93c5fd; }
.slide-nav-btn:disabled { opacity: 0.3; cursor: default; pointer-events: none; }
.slide-nav-btn svg { width: 18px; height: 18px; }
.slide-nav-prev-title, .slide-nav-next-title { color: #64748b; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
.slide-nav-curr-title { color: #e0e0e0; font-weight: 700; white-space: nowrap; font-size: 13px; }
.slide-nav-counter { font-size: 11px; color: #64748b; white-space: nowrap; margin-top: 1px; }
.preview-status-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; flex-shrink: 0; font-size: 12px; color: rgba(255,255,255,0.5); }
.preview-status-left { display: flex; align-items: center; gap: 10px; }
.preview-status-right { display: flex; align-items: center; gap: 4px; }
.preview-status-sep { color: rgba(255,255,255,0.1); }
.preview-status-btn { background: none; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 4px 10px; font-size: 12px; color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; font-family: inherit; }
.preview-status-btn:hover { color: #93c5fd; background: rgba(102,126,234,0.15); border-color: #93c5fd; }
@media (max-width: 768px) {
  .preview-container { padding: 8px; gap: 8px; }
  .preview-top-header { padding: 10px 12px; }
  .preview-header-item { font-size: 12px; }
  .preview-header-sep { margin: 0 6px; font-size: 12px; }
  .preview-main { gap: 8px; flex-direction: column; }
  .preview-sidebar { width: 100%; height: auto; flex-shrink: 0; flex-direction: row; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
  .preview-sidebar::-webkit-scrollbar { display: none; }
  .preview-sidebar-inner { padding: 8px 12px; overflow: visible; }
  .preview-sidebar-title { display: none; }
  .preview-sidebar-nav { display: flex; flex-wrap: nowrap; gap: 4px; }
  .preview-sidebar-nav li { margin: 0; white-space: nowrap; }
  .preview-sidebar-nav .nav-l1 a { padding: 4px 10px; font-size: 12px; }
  .preview-sidebar-nav .nav-l2 a { padding: 4px 8px 4px 10px; font-size: 11px; }
  .preview-sidebar-nav .nav-l3 a { padding: 4px 6px 4px 14px; font-size: 10px; }
  .slide { padding: 16px 16px 24px; }
  .slide-nav { padding: 8px 8px; }
  .slide-nav-prev-title, .slide-nav-next-title { display: none; }
  .slide-nav-center { padding: 0 4px; }
  .slide-nav-curr-title { font-size: 11px; }
  .preview-status-bar { padding: 6px 10px; font-size: 11px; flex-wrap: wrap; gap: 4px; }
  .preview-status-left { gap: 6px; }
}
</style>
</head>
<body>
<canvas id="starCanvas" class="star-canvas"></canvas>
<div class="preview-container">
  <div class="preview-top-header">
    <span class="preview-header-item">${noteTitle}</span>
  </div>
  <div class="preview-main">
    <aside class="preview-sidebar">
      <div class="preview-sidebar-inner">
        <div class="preview-sidebar-title">目录</div>
        <ul class="preview-sidebar-nav">
          ${sidebarItems}
        </ul>
      </div>
    </aside>
    <div class="preview-content-area">
      <div class="slide-viewport" id="slideViewport">
        <div class="slide-container" id="slideContainer">
          ${slidesHtml}
        </div>
        <div class="slide-nav">
          <div class="slide-nav-side slide-nav-left">
            <button class="slide-nav-btn" id="prevBtn" title="上一页">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="slide-nav-prev-title" id="prevTitle"></span>
          </div>
          <div class="slide-nav-center">
            <span class="slide-nav-curr-title" id="currTitle"></span>
            <span class="slide-nav-counter" id="counter"></span>
          </div>
          <div class="slide-nav-side slide-nav-right">
            <span class="slide-nav-next-title" id="nextTitle"></span>
            <button class="slide-nav-btn" id="nextBtn" title="下一页">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="preview-status-bar">
    <div class="preview-status-left">
      <span>${props.clockDisplay}</span>
      <span class="preview-status-sep">|</span>
      <span>全文字数: ${props.totalWordCount}</span>
      <span class="preview-status-sep">|</span>
      <span>更新于 ${formatTime(props.note.updatedAt)}</span>
    </div>
    <div class="preview-status-right">
      <button class="preview-status-btn" id="fullscreenBtn">放映</button>
    </div>
  </div>
</div>
<script>
// 星空背景动画
(function() {
  var canvas = document.getElementById('starCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var stars = [];
  var starPalette = ['#ffffff', '#ffe8d0', '#d0e8ff', '#ffd0d0', '#fff0d0', '#d0ffd0', '#d0d0ff'];
  var starDensity = 3 / 5000;
  function syncStarCount() {
    var target = Math.floor(canvas.width * canvas.height * starDensity);
    while (stars.length < target) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.7 + 0.3,
        color: starPalette[Math.floor(Math.random() * starPalette.length)],
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02
      });
    }
    while (stars.length > target) stars.pop();
  }
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    syncStarCount();
  }
  var meteors = [];
  function createMeteor() {
    if (Math.random() < 0.035 && meteors.length < 3) {
      var edge = Math.floor(Math.random() * 4);
      var x, y;
      switch (edge) {
        case 0: x = Math.random() * canvas.width; y = 0; break;
        case 1: x = canvas.width; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height; break;
        default: x = 0; y = Math.random() * canvas.height; break;
      }
      meteors.push({ x: x, y: y, length: Math.random() * 80 + 50, speed: Math.random() * 0.3 + 0.1, opacity: 1, angle: Math.random() * Math.PI * 2 });
    }
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(function(star) {
      star.opacity += star.twinkleSpeed;
      if (star.opacity > 1 || star.opacity < 0.3) star.twinkleSpeed = -star.twinkleSpeed;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = star.color;
      ctx.globalAlpha = star.opacity;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (star.radius > 1) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = star.opacity * 0.12;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      star.x += star.vx;
      star.y += star.vy;
      if (star.y > canvas.height) { star.y = 0; star.x = Math.random() * canvas.width; }
      else if (star.y < 0) { star.y = canvas.height; star.x = Math.random() * canvas.width; }
      if (star.x > canvas.width) { star.x = 0; star.y = Math.random() * canvas.height; }
      else if (star.x < 0) { star.x = canvas.width; star.y = Math.random() * canvas.height; }
    });
    createMeteor();
    meteors.forEach(function(meteor, index) {
      meteor.x += Math.cos(meteor.angle) * meteor.speed;
      meteor.y += Math.sin(meteor.angle) * meteor.speed;
      if (meteor.x < 0 || meteor.x > canvas.width || meteor.y < 0 || meteor.y > canvas.height) {
        meteors.splice(index, 1);
        return;
      }
      var headX = meteor.x, headY = meteor.y;
      var trailDx = -Math.cos(meteor.angle);
      var trailDy = -Math.sin(meteor.angle);
      var txs = [];
      if (trailDx > 0) txs.push((canvas.width - headX) / trailDx);
      if (trailDx < 0) txs.push(-headX / trailDx);
      if (trailDy > 0) txs.push((canvas.height - headY) / trailDy);
      if (trailDy < 0) txs.push(-headY / trailDy);
      var t = Math.min.apply(null, txs);
      var trailEndX = headX + trailDx * t;
      var trailEndY = headY + trailDy * t;
      var trailGradient = ctx.createLinearGradient(trailEndX, trailEndY, headX, headY);
      trailGradient.addColorStop(0, 'rgba(150, 210, 255, 0)');
      trailGradient.addColorStop(0.3, 'rgba(150, 210, 255, 0.08)');
      trailGradient.addColorStop(0.7, 'rgba(180, 220, 255, 0.2)');
      trailGradient.addColorStop(1, 'rgba(200, 230, 255, 0.4)');
      ctx.beginPath();
      ctx.moveTo(trailEndX, trailEndY);
      ctx.lineTo(headX, headY);
      ctx.strokeStyle = trailGradient;
      ctx.lineWidth = 2;
      ctx.stroke();
      var headGlow = ctx.createRadialGradient(headX, headY, 0, headX, headY, 12);
      headGlow.addColorStop(0, 'rgba(255, 240, 150, 1)');
      headGlow.addColorStop(0.3, 'rgba(255, 200, 50, 0.8)');
      headGlow.addColorStop(0.6, 'rgba(255, 160, 30, 0.3)');
      headGlow.addColorStop(1, 'rgba(255, 160, 30, 0)');
      ctx.beginPath();
      ctx.arc(headX, headY, 12, 0, Math.PI * 2);
      ctx.fillStyle = headGlow;
      ctx.fill();
      var rainbowGlow = ctx.createRadialGradient(headX, headY, 6, headX, headY, 20);
      rainbowGlow.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
      rainbowGlow.addColorStop(0.5, 'rgba(255, 150, 200, 0.2)');
      rainbowGlow.addColorStop(0.7, 'rgba(130, 180, 255, 0.15)');
      rainbowGlow.addColorStop(1, 'rgba(130, 180, 255, 0)');
      ctx.beginPath();
      ctx.arc(headX, headY, 20, 0, Math.PI * 2);
      ctx.fillStyle = rainbowGlow;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(headX, headY, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 220, 1)';
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  resize();
  window.addEventListener('resize', resize);
  animate();
})();
(function() {
  var slides = [];
  var currentSlide = 0;
  var slideContainer = document.getElementById('slideContainer');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var prevTitle = document.getElementById('prevTitle');
  var currTitle = document.getElementById('currTitle');
  var counter = document.getElementById('counter');
  var nextTitle = document.getElementById('nextTitle');
  var slideViewport = document.getElementById('slideViewport');
  var fullscreenBtn = document.getElementById('fullscreenBtn');
  var navLinks = document.querySelectorAll('.preview-sidebar-nav a');
  var isFullscreen = false;

  function showSlide(idx) {
    if (slides.length === 0) return;
    if (idx < 0) idx = 0;
    if (idx >= slides.length) idx = slides.length - 1;
    for (var i = 0; i < slides.length; i++) {
      slides[i].classList.toggle('active', i === idx);
    }
    currentSlide = idx;
    slideContainer.scrollTop = 0;
    for (var j = 0; j < navLinks.length; j++) { navLinks[j].classList.remove('active'); }
    if (navLinks[idx]) navLinks[idx].classList.add('active');
    updateNav();
  }

  function updateNav() {
    prevBtn.disabled = currentSlide === 0;
    nextBtn.disabled = currentSlide >= slides.length - 1;
    prevTitle.textContent = currentSlide > 0 ? (slides[currentSlide - 1].getAttribute('data-title') || '') : '';
    currTitle.textContent = slides[currentSlide] ? (slides[currentSlide].getAttribute('data-title') || '') : '';
    counter.textContent = (currentSlide + 1) + ' / ' + slides.length;
    nextTitle.textContent = currentSlide < slides.length - 1 ? (slides[currentSlide + 1].getAttribute('data-title') || '') : '';
  }

  function init() {
    slides = Array.prototype.slice.call(slideContainer.querySelectorAll('.slide'));
    showSlide(0);
  }

  prevBtn.addEventListener('click', function() { showSlide(currentSlide - 1); });
  nextBtn.addEventListener('click', function() { showSlide(currentSlide + 1); });

  for (var k = 0; k < navLinks.length; k++) {
    navLinks[k].addEventListener('click', function(e) {
      e.preventDefault();
      var idx = parseInt(this.getAttribute('data-idx'), 10);
      showSlide(idx);
    });
  }

  document.addEventListener('keydown', function(e) {
    var key = e.key.toLowerCase();
    if (key === 'p' || key === 'arrowleft' || key === 'arrowup') {
      e.preventDefault();
      showSlide(currentSlide - 1);
    } else if (key === 'n' || key === 'arrowright' || key === 'arrowdown' || key === ' ') {
      e.preventDefault();
      showSlide(currentSlide + 1);
    } else if (key === 'escape' && isFullscreen) {
      e.preventDefault();
      exitFullscreen();
    }
  });

  var touchStartX = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    var diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      showSlide(currentSlide + (diff > 0 ? 1 : -1));
    }
  }, { passive: true });

  function enterFullscreen() {
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
    isFullscreen = true;
    slideViewport.classList.add('fullscreen');
    fullscreenBtn.textContent = '退出';
  }

  function exitFullscreen() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
    isFullscreen = false;
    slideViewport.classList.remove('fullscreen');
    fullscreenBtn.textContent = '放映';
  }

  fullscreenBtn.addEventListener('click', function() {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  });

  init();
})();
<\/script>
</body>
</html>`

  const fileName = `${noteTitle}.html`
  const isElectronEnv = !!(window as any).electronAPI
  if (isElectronEnv) {
    try {
      const filePath = await (window as any).electronAPI.saveFileDialog({
        defaultPath: fileName,
        filters: [{ name: 'HTML', extensions: ['html'] }]
      })
      if (filePath) {
        await (window as any).electronAPI.writeFile(filePath, html)
        ElMessage.success('已导出')
      }
    } catch {
      ElMessage.error('导出失败')
    }
  } else {
    // 浏览器/安卓/鸿蒙端：使用 Blob + a 链接下载
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('已导出')
  }
}

onMounted(() => {
  nextTick(() => {
    refreshSlides()
    showSlide(0)
  })
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('selectionchange', handleSelectionChange)
  document.addEventListener('touchstart', handleTouchStart, { passive: true })
  document.addEventListener('touchend', handleTouchEnd, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('mousedown', handleMouseDown)
  document.removeEventListener('selectionchange', handleSelectionChange)
  document.removeEventListener('touchstart', handleTouchStart)
  document.removeEventListener('touchend', handleTouchEnd)
})
</script>

<style scoped>
/* ====== 全局重置 ====== */
.preview-container {
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

.wavy {
  text-decoration: underline;
  text-decoration-color: #e74c3c;
  text-decoration-style: wavy;
  text-underline-offset: 4px;
  text-decoration-thickness: 1.5px;
}

/* ====== 顶部标题栏 ====== */
.preview-top-header {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 10px 20px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}

.preview-header-item {
  font-size: 14px;
  color: #e0e0e0;
}

.preview-header-sep {
  margin: 0 10px;
  opacity: 0.5;
  font-size: 14px;
  color: #e0e0e0;
}

/* ====== 主容器 ====== */
.preview-main {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  gap: 16px;
}

/* ====== 侧边栏 ====== */
.preview-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-sidebar-inner {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
  scrollbar-width: none;
}

.preview-sidebar-inner::-webkit-scrollbar { display: none; }

.preview-sidebar-title {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 12px;
  padding-left: 4px;
}

.preview-sidebar-nav {
  list-style: none;
  padding: 0;
  margin: 0;
}

.preview-sidebar-nav li { margin: 1px 0; line-height: 1.4; }

.preview-sidebar-nav .nav-l1 a {
  display: flex;
  align-items: center;
  padding: 5px 8px;
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
  text-decoration: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-sidebar-nav .nav-l1 a:hover { background: rgba(102, 126, 234, 0.15); color: #93c5fd; }
.preview-sidebar-nav .nav-l1 a.active { background: rgba(102, 126, 234, 0.2); color: #93c5fd; }

.preview-sidebar-nav .nav-l2 a {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 18px;
  font-size: 12px;
  color: #94a3b8;
  text-decoration: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-sidebar-nav .nav-l2 a:hover { background: rgba(102, 126, 234, 0.12); color: #93c5fd; }
.preview-sidebar-nav .nav-l2 a.active { background: rgba(102, 126, 234, 0.15); color: #93c5fd; }

.preview-sidebar-nav .nav-l3 a {
  display: flex;
  align-items: center;
  padding: 3px 8px 3px 28px;
  font-size: 11px;
  color: #64748b;
  text-decoration: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-sidebar-nav .nav-l3 a:hover { background: rgba(102, 126, 234, 0.1); color: #93c5fd; }
.preview-sidebar-nav .nav-l3 a.active { background: rgba(102, 126, 234, 0.12); color: #93c5fd; }

.preview-sidebar-nav .nav-num {
  flex-shrink: 0;
  margin-right: 6px;
  color: #94a3b8;
  font-weight: 600;
}

.preview-sidebar-nav .nav-title-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ====== 主内容区 ====== */
.preview-content-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.slide-viewport {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
}

.slide-viewport.fullscreen {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9999;
  border-radius: 0;
  border: none;
  background: linear-gradient(to bottom, #0f0c29 0%, #302b63 50%, #24243e 100%);
}

.slide-container {
  flex: 1;
  overflow-y: auto;
  position: relative;
  scrollbar-width: none;
}

.slide-container::-webkit-scrollbar { display: none; }

.slide {
  display: none;
  animation: slideFadeIn 0.35s ease;
  min-height: 100%;
  flex-direction: column;
  justify-content: flex-start;
  padding: 20px 40px 30px;
  box-sizing: border-box;
}

.slide.active {
  display: flex;
}

@keyframes slideFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ====== 封面页 ====== */
.cover-wrap {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
}

.cover-title {
  font-size: 22px;
  font-weight: 700;
  color: #93c5fd;
  margin-bottom: 8px;
  text-align: center;
}

.cover-subtitle {
  font-size: 14px;
  color: #94a3b8;
  margin-bottom: 24px;
}

.cover-outline {
  max-width: 500px;
  width: 100%;
}

.cover-outline-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
}

.cover-outline-row:last-child { border-bottom: none; }

.cover-outline-num {
  font-size: 16px;
  font-weight: 700;
  color: #93c5fd;
  min-width: 36px;
  text-align: center;
}

.cover-outline-name {
  font-size: 14px;
  color: #cbd5e1;
}

.cover-empty {
  color: var(--chalk-muted);
  font-size: 14px;
  margin-top: 16px;
}

/* ====== 幻灯片内容样式 ====== */
.slide-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  line-height: 1.8;
  color: #e0e0e0;
}

/* 封面页：中文宋体五号，英文 Times New Roman 五号（10.5pt） */
.slide[data-type="cover"] .slide-content {
  font-family: '宋体', SimSun, 'Times New Roman', serif;
  font-size: 10.5pt;
}

/* 致谢页：二号字（22pt） */
.slide[data-type="thanks"] .slide-content {
  font-family: '宋体', SimSun, 'Times New Roman', serif;
  font-size: 22pt;
}

/* 覆盖内联 60vh 居中样式，使垂直居中容器填满幻灯片高度，实现真正垂直居中 */
.slide-content :deep([style*="60vh"]) {
  min-height: 0 !important;
  flex: 1;
}

.slide-content :deep(h1) { font-size: 22px; color: #93c5fd; margin: 20px 0 12px; padding-bottom: 8px; border-bottom: 2px solid rgba(102, 126, 234, 0.3); }
.slide-content :deep(h2) { font-size: 20px; color: #93c5fd; margin: 18px 0 10px; }
.slide-content :deep(h3) { font-size: 18px; color: #a78bfa; margin: 16px 0 8px; }
.slide-content :deep(h4) { font-size: 16px; color: #a78bfa; margin: 14px 0 8px; }
.slide-content :deep(h5) { font-size: 15px; color: #cbd5e1; margin: 12px 0 6px; }
.slide-content :deep(h6) { font-size: 14px; color: #cbd5e1; margin: 10px 0 6px; }
.slide-content :deep(p) { margin: 6px 0; text-align: justify; }
.slide-content :deep(ul), .slide-content :deep(ol) { margin: 8px 0 12px 1.5em; }
.slide-content :deep(li) { margin-bottom: 4px; }
.slide-content :deep(blockquote) {
  border-left: 3px solid #667eea; padding-left: 12px; margin: 8px 0; color: #94a3b8;
}
.slide-content :deep(pre) {
  background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; color: #a8edea;
  font-family: 'Consolas', 'Monaco', monospace; white-space: pre-wrap; margin: 8px 0; font-size: 13px;
}
.slide-content :deep(code) {
  background: rgba(102, 126, 234, 0.15); padding: 2px 6px; border-radius: 4px; font-size: 13px;
}
.slide-content :deep(table) {
  border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px;
}
.slide-content :deep(th) {
  background: rgba(102, 126, 234, 0.15); color: #93c5fd; font-weight: 600;
  border: 1px solid rgba(255,255,255,0.15); padding: 8px 10px; text-align: left;
}
.slide-content :deep(td) {
  border: 1px solid rgba(255,255,255,0.1); padding: 8px 10px;
}
.slide-content :deep(img) { max-width: 100%; border-radius: 8px; margin: 8px 0; }
.slide-content :deep(strong) { color: #fbbf24; }
.slide-content :deep(em) { color: #f472b6; }

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
.preview-status-bar {
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

.preview-status-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.preview-status-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.preview-status-sep {
  color: rgba(255, 255, 255, 0.1);
}

.preview-back-btn {
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

.preview-back-btn:hover {
  color: #93c5fd;
  background: rgba(102, 126, 234, 0.15);
  border-color: #93c5fd;
}

.preview-status-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--chalk-muted);
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.preview-status-btn:hover {
  color: #93c5fd;
  background: rgba(102, 126, 234, 0.15);
  border-color: #93c5fd;
}

.card-icon-btn {
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

.card-icon-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.card-icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.card-icon-btn.active {
  color: var(--chalk-amber);
}

/* ====== 文字弹出工具栏 ====== */
.text-popup {
  position: fixed;
  z-index: 10000;
  background: #1e293b;
  color: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.text-popup button {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
}

.text-popup button:hover { background: #2563eb; }

.text-popup button.remove-btn {
  background: #ef4444;
}

.text-popup button.remove-btn:hover { background: #dc2626; }

/* ====== 响应式 ====== */
@media (max-width: 768px) {
  .preview-container {
    padding: 8px;
    gap: 8px;
  }

  .preview-top-header {
    padding: 10px 12px;
  }

  .preview-header-item { font-size: 12px; }
  .preview-header-sep { margin: 0 6px; font-size: 12px; }

  .preview-main {
    gap: 8px;
  }

  .preview-sidebar {
    width: 100%;
    height: auto;
    flex-shrink: 0;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .preview-sidebar::-webkit-scrollbar { display: none; }

  .preview-sidebar-inner {
    padding: 8px 12px;
    overflow: visible;
  }

  .preview-sidebar-title { display: none; }

  .preview-sidebar-nav {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
  }

  .preview-sidebar-nav li { margin: 0; white-space: nowrap; }

  .preview-sidebar-nav .nav-l1 a { padding: 4px 10px; font-size: 12px; }
  .preview-sidebar-nav .nav-l2 a { padding: 4px 8px 4px 10px; font-size: 11px; }
  .preview-sidebar-nav .nav-l3 a { padding: 4px 6px 4px 14px; font-size: 10px; }

  .preview-main { flex-direction: column; }

  .slide { padding: 16px 16px 24px; }

  .slide-nav { padding: 8px 8px; }
  .slide-nav-prev-title, .slide-nav-next-title { display: none; }
  .slide-nav-center { padding: 0 4px; }
  .slide-nav-curr-title { font-size: 11px; }

  .preview-status-bar { padding: 6px 10px; font-size: 11px; flex-wrap: wrap; gap: 4px; }
  .preview-status-left { gap: 6px; }
}
</style>