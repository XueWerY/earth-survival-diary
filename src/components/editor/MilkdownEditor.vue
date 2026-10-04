<template>
  <div ref="rootRef" class="md-editor">
    <!-- 唯一滚动容器：保留 md-blocks 类，供笔记大纲定位复用 -->
    <div ref="blocksContainerRef" class="md-blocks markdown-body">
      <div ref="crepeRootRef" class="md-crepe-root"></div>
    </div>

    <!-- [[ wiki-link 联想弹层 -->
    <div v-if="wikiSuggestion" class="wiki-sug" :style="sugPosStyle" @mousedown.prevent>
      <button
        v-for="(n, i) in sugNotes"
        :key="n.id"
        class="wiki-sug-item"
        :class="{ hl: i === sugIndex }"
        :title="n.title"
        @click="applyWikiSuggestion(n.title)"
        @mouseenter="sugIndex = i"
      >
        <span class="wiki-sug-title">{{ n.title || '新笔记' }}</span>
      </button>
      <button
        v-if="sugCreateLabel"
        class="wiki-sug-item"
        :class="{ hl: sugIndex === sugNotes.length }"
        @click="applyWikiSuggestion()"
        @mouseenter="sugIndex = sugNotes.length"
      >
        <span class="wiki-sug-title">链接到「{{ sugCreateLabel }}」</span>
        <span class="wiki-sug-sub">回车创建</span>
      </button>
      <div v-if="!sugNotes.length && !sugCreateLabel" class="wiki-sug-empty">继续输入以匹配笔记</div>
    </div>

    <!-- 右键格式工具栏：选中文本后右键呼出（行内格式 + 块转换） -->
    <div
      v-if="ctxMenu.open"
      class="md-ctx-menu"
      :style="{ top: ctxMenu.top + 'px', left: ctxMenu.left + 'px' }"
      @mousedown.prevent
      @contextmenu.prevent
    >
      <div v-for="(g, gi) in ctxGroups" :key="gi" class="md-ctx-row">
        <button
          v-for="it in g"
          :key="it.title"
          class="md-ctx-btn"
          :class="[it.cls, { active: it.active }]"
          :title="it.title"
          @click="runCtxItem(it)"
        >{{ it.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Crepe } from '@milkdown/crepe'
import { replaceAll } from '@milkdown/kit/utils'
import { editorViewCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { toggleMark, setBlockType, wrapIn, lift } from '@milkdown/kit/prose/commands'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import { useNoteStore } from '../../stores/noteStore'
import {
  WIKI_LINK_NODE,
  remarkWikiLink,
  wikiLinkSchema,
  wikiLinkInputRule,
  computeWikiSuggestion,
  insertWikiLink,
  type WikiSuggestion,
} from './wikiLink'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  /** 当前笔记 id：联想列表排除自身链接 */
  currentNoteId?: string
}>(), {
  placeholder: '开始编写 Markdown 笔记...',
  currentNoteId: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input', value: string): void
  (e: 'open-wiki-link', payload: { target: string }): void
}>()

const noteStore = useNoteStore()
const blocksContainerRef = ref<HTMLDivElement>()
const crepeRootRef = ref<HTMLDivElement>()
const rootRef = ref<HTMLDivElement>()

let crepe: Crepe | null = null
let ready = false
let view: EditorView | null = null
// 最近一次与编辑器同步过的 markdown，用于切断 props 回写的循环
let syncedValue = ''

// 丢弃旧版图片宽度语法 {w:N}，并抹平尾部空行（沿用旧编辑器“无尾部换行”的输出约定）
const normalize = (md: string): string =>
  (md || '')
    .replace(/(!\[[^\]]*\]\([^)\s]+\))\s*\{w:\d+\}/g, '$1')
    .replace(/\s+$/, '')

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const createEditor = async () => {
  const root = crepeRootRef.value
  if (!root) return

  const initial = normalize(props.modelValue)
  syncedValue = initial

  const instance = new Crepe({
    root,
    defaultValue: initial,
    features: {
      [Crepe.Feature.Latex]: false,
      [Crepe.Feature.AI]: false,
      // 行左侧的拖拽/加号按钮与选中文本浮动工具栏均移除：
      // 格式与块转换统一由自建「右键工具栏」提供（见 ctxMenu 相关实现）
      [Crepe.Feature.Toolbar]: false,
      [Crepe.Feature.BlockEdit]: false,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: props.placeholder, mode: 'doc' },
      [Crepe.Feature.ImageBlock]: {
        onUpload: toDataUrl,
        inlineUploadButton: '上传图片',
        inlineUploadPlaceholderText: '或粘贴图片链接',
        inlineConfirmButton: '确定',
        blockUploadButton: '上传图片',
        blockUploadPlaceholderText: '或粘贴图片链接',
        blockCaptionPlaceholderText: '图片说明',
        blockConfirmButton: '确定',
      },
      [Crepe.Feature.CodeMirror]: {
        searchPlaceholder: '搜索语言',
        noResultText: '无匹配结果',
      },
    },
  })

  // 自建 wiki-link：必须在 create() 之前注册（remark 解析 → schema → 输入规则）
  instance.editor.use(remarkWikiLink).use(wikiLinkSchema).use(wikiLinkInputRule)

  // 必须在 create() 之前注册监听
  instance.on((api) => {
    api.markdownUpdated((_ctx, markdown) => {
      const next = normalize(markdown)
      if (next === syncedValue) return
      syncedValue = next
      emit('update:modelValue', next)
      emit('input', next)
    })
  })

  crepe = instance
  await instance.create()
  ready = true

  // 取 ProseMirror 视图并包装 dispatch：每次事务后重算 [[ 联想状态
  instance.editor.action((ctx) => {
    view = ctx.get(editorViewCtx)
  })
  if (view) {
    const rawDispatch = view.dispatch.bind(view)
    view.dispatch = (tr: Parameters<EditorView['dispatch']>[0]) => {
      rawDispatch(tr)
      updateWikiSuggestion()
    }
  }
  updateWikiSuggestion()
  refreshResolvedLinks()
}

// ====== 右键格式工具栏（替代 Crepe 浮动工具栏与行左侧按钮） ======
const ctxMenu = ref({ open: false, top: 0, left: 0 })
const closeCtxMenu = () => { if (ctxMenu.value.open) ctxMenu.value = { open: false, top: 0, left: 0 } }

interface CtxItem { label: string; cls?: string; title: string; active?: boolean; run: () => void }

const ctxGroups = computed<CtxItem[][]>(() => {
  if (!ctxMenu.value.open || !view) return []
  const v = view
  const state = v.state
  const { from, to } = state.selection
  const marks = state.schema.marks as Record<string, any>
  const nodes = state.schema.nodes as Record<string, any>
  const $from = state.selection.$from
  const parentName = $from.parent.type.name
  const hasMark = (name: string) => !!marks[name] && state.doc.rangeHasMark(from, to, marks[name])
  const d = (tr: any) => v.dispatch(tr)
  const markCmd = (name: string) => () => {
    const mt = marks[name]
    if (!mt) return
    toggleMark(mt)(state, d, v)
  }
  const ancestorIs = (name: string) => {
    const nt = nodes[name]
    if (!nt) return false
    for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === nt) return true
    return false
  }
  const setBlock = (name: string, attrs: Record<string, any> | null = null) => () => {
    const nt = nodes[name]
    if (!nt) return
    setBlockType(nt, attrs || undefined)(state, d, v)
  }
  const wrapOrLift = (name: string) => () => {
    const nt = nodes[name]
    if (!nt) return
    if (ancestorIs(name)) lift(state, d, v)
    else wrapIn(nt)(state, d, v)
  }
  const linkCmd = () => {
    const href = window.prompt('链接地址：')
    if (href === null) return
    if (!href.trim() && !state.doc.rangeHasMark(from, to, marks.link)) return
    toggleMark(marks.link, href.trim() ? { href: href.trim() } : undefined)(state, d, v)
  }
  const lv = parentName === 'heading' ? Number($from.parent.attrs.level || 0) : 0
  const row1: CtxItem[] = []
  if (marks.strong) row1.push({ label: 'B', cls: 'b', title: '加粗', active: hasMark('strong'), run: markCmd('strong') })
  if (marks.em) row1.push({ label: 'I', cls: 'i', title: '斜体', active: hasMark('em'), run: markCmd('em') })
  if (marks.strikethrough) row1.push({ label: 'S', cls: 's', title: '删除线', active: hasMark('strikethrough'), run: markCmd('strikethrough') })
  if (marks.code_inline) row1.push({ label: '‹›', cls: 'c', title: '行内代码', active: hasMark('code_inline'), run: markCmd('code_inline') })
  if (marks.link) row1.push({ label: '链接', title: '插入 / 移除链接', active: hasMark('link'), run: linkCmd })
  const row2: CtxItem[] = [
    { label: '正文', title: '正文段落', active: parentName === 'paragraph', run: setBlock('paragraph') },
  ]
  if (nodes.heading) {
    row2.push({ label: 'H1', title: '一级标题', active: parentName === 'heading' && lv === 1, run: setBlock('heading', { level: 1 }) })
    row2.push({ label: 'H2', title: '二级标题', active: parentName === 'heading' && lv === 2, run: setBlock('heading', { level: 2 }) })
    row2.push({ label: 'H3', title: '三级标题', active: parentName === 'heading' && lv === 3, run: setBlock('heading', { level: 3 }) })
  }
  if (nodes.blockquote) row2.push({ label: '❝', title: '引用（已引用则解除）', active: ancestorIs('blockquote'), run: wrapOrLift('blockquote') })
  const row3: CtxItem[] = []
  if (nodes.bullet_list) row3.push({ label: '• 列表', title: '无序列表（已包裹则解除）', active: ancestorIs('bullet_list'), run: wrapOrLift('bullet_list') })
  if (nodes.ordered_list) row3.push({ label: '1. 列表', title: '有序列表（已包裹则解除）', active: ancestorIs('ordered_list'), run: wrapOrLift('ordered_list') })
  const row4: CtxItem[] = []
  if (nodes.task_list) row4.push({ label: '☐ 任务', title: '任务列表', active: ancestorIs('task_list_item'), run: wrapOrLift('task_list') })
  if (nodes.code_block) row4.push({ label: '代码块', title: '代码块', active: parentName === 'code_block', run: setBlock('code_block') })
  return [row1, row2, row3, row4].filter(g => g.length)
})

const runCtxItem = (it: CtxItem) => { it.run(); closeCtxMenu() }

const onEditorContext = (e: MouseEvent) => {
  if (!view) return
  const sel = view.state.selection
  if (sel.empty) return  // 无选区：保留默认行为
  e.preventDefault()
  const mw = 270, mh = 130
  ctxMenu.value = {
    open: true,
    top: Math.max(8, Math.min(e.clientY + 4, window.innerHeight - mh - 8)),
    left: Math.max(8, Math.min(e.clientX + 4, window.innerWidth - mw - 8)),
  }
}
const onDocMouseDownClose = (e: MouseEvent) => {
  const t = e.target as HTMLElement | null
  if (t && t.closest && t.closest('.md-ctx-menu')) return
  closeCtxMenu()
}
const onDocKeyClose = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCtxMenu() }
const onScrollClose = () => closeCtxMenu()

// ====== [[ wiki-link 联想 ======
const wikiSuggestion = ref<WikiSuggestion | null>(null)
const sugIndex = ref(0)
const sugPos = ref({ top: 0, left: 0 })
let dismissed: { from: number; to: number } | null = null

const sugNotes = computed(() => {
  const s = wikiSuggestion.value
  if (!s) return []
  const q = s.query.trim().toLowerCase()
  return noteStore.notes
    .filter(n => n.id !== props.currentNoteId)
    .filter(n => !q || n.title.toLowerCase().includes(q))
    .slice(0, 8)
})

const sugCreateLabel = computed(() => {
  const s = wikiSuggestion.value
  if (!s) return ''
  const q = s.query.trim()
  if (!q) return ''
  const exact = noteStore.notes.some(n => n.title.trim().toLowerCase() === q.toLowerCase())
  return exact ? '' : q
})

const sugPosStyle = computed(() => ({ top: `${sugPos.value.top}px`, left: `${sugPos.value.left}px` }))

const updateWikiSuggestion = () => {
  if (!view) {
    wikiSuggestion.value = null
    return
  }
  let s = computeWikiSuggestion(view.state)
  if (s && dismissed) {
    // Esc 关闭后：位置与光标都未变则保持关闭，否则恢复
    if (dismissed.from === s.from && view.state.selection.from === dismissed.to) s = null
    else dismissed = null
  }
  wikiSuggestion.value = s
  if (!s) {
    sugIndex.value = 0
    return
  }
  nextTick(positionSuggestion)
}

const positionSuggestion = () => {
  if (!view || !wikiSuggestion.value || !crepeRootRef.value) return
  try {
    const coords = view.coordsAtPos(wikiSuggestion.value.from)
    const hostRect = rootRef.value?.getBoundingClientRect()
    if (!hostRect) return
    const POPOVER_W = 240
    const POPOVER_H = 200
    let top = coords.bottom - hostRect.top + 6
    let left = coords.left - hostRect.left
    if (top + POPOVER_H > hostRect.height) {
      top = Math.max(4, coords.top - hostRect.top - POPOVER_H - 6)
    }
    left = Math.max(8, Math.min(left, hostRect.width - POPOVER_W - 8))
    sugPos.value = { top, left }
  } catch {
    // 位置计算失败（节点已删除等）时静默跳过
  }
}

const applyWikiSuggestion = (title?: string) => {
  const s = wikiSuggestion.value
  if (!s || !view) return
  let target = title
  if (!target) {
    const pick = sugNotes.value[sugIndex.value]
    target = (pick ? pick.title : sugCreateLabel.value).trim()
  }
  if (!target) return
  insertWikiLink(view, s.from, view.state.selection.from, target)
  wikiSuggestion.value = null
  sugIndex.value = 0
}

const onRootKeydown = (e: KeyboardEvent) => {
  if (!wikiSuggestion.value || e.isComposing) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    e.stopPropagation()
    const max = sugNotes.value.length + (sugCreateLabel.value ? 1 : 0) - 1
    sugIndex.value = Math.min(sugIndex.value + 1, Math.max(max, 0))
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()
    sugIndex.value = Math.max(sugIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    applyWikiSuggestion()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    if (view && wikiSuggestion.value) {
      dismissed = { from: wikiSuggestion.value.from, to: view.state.selection.from }
    }
    wikiSuggestion.value = null
  }
}

// ====== 点击跳转 ======
const onRootClick = (e: MouseEvent) => {
  const el = (e.target as HTMLElement).closest?.(`span[data-type="${WIKI_LINK_NODE}"]`) as HTMLElement | null
  if (!el) return
  e.preventDefault()
  e.stopPropagation()
  const target = (el.dataset.target || '').trim()
  if (target) emit('open-wiki-link', { target })
}

// ====== 已解析/未解析样式标记 ======
const resolvedTitleSet = computed(() => new Set(noteStore.notes.map(n => n.title.trim().toLowerCase())))

const refreshResolvedLinks = () => {
  const root = crepeRootRef.value
  if (!root) return
  root.querySelectorAll<HTMLElement>(`span[data-type="${WIKI_LINK_NODE}"]`).forEach(el => {
    const target = (el.dataset.target || '').trim().toLowerCase()
    el.dataset.resolved = target && resolvedTitleSet.value.has(target) ? 'true' : 'false'
  })
}

let domObserver: MutationObserver | null = null

watch(resolvedTitleSet, () => refreshResolvedLinks())

// ====== 列表样式注入：Crepe 的列表由 ListBlock 组件渲染（bullet 在 .label-wrapper 内、
// 颜色走 --crepe-color-outline 变量），scoped 样式与 ::marker 均不可达，用全局 <style> 覆盖 ======
let listStyleEl: HTMLStyleElement | null = null
const injectListStyle = () => {
  if (listStyleEl) return
  listStyleEl = document.createElement('style')
  // 符号用 #e9d5ff（purple-200），与光标 #a78bfa 明显区分
  listStyleEl.textContent = [
    '.md-editor .ProseMirror { --crepe-color-outline: #e9d5ff; }',
    '.md-editor .milkdown-list-item-block li .label-wrapper { color: #e9d5ff !important; }',
    '.md-editor .milkdown-list-item-block li .label-wrapper svg { fill: #e9d5ff !important; }',
    '.md-editor .milkdown-list-item-block > .list-item { gap: 4px !important; }',
    '.md-editor .milkdown-list-item-block > .list-item > .label-wrapper, .md-editor .milkdown-list-item-block li .label-wrapper { width: 16px !important; min-width: 16px !important; height: 28px !important; }',
    '.md-editor .milkdown-list-item-block li .label-wrapper .label { width: 16px !important; padding: 2px 0 !important; }',
    '.md-editor .ProseMirror ul { padding-left: 4px !important; margin-left: 0 !important; }',
    '.md-editor .ProseMirror li { margin-left: 0 !important; }',
    '.md-editor .ProseMirror ul li::marker { color: #e9d5ff !important; }',
    '.md-editor .ProseMirror ul li::before { color: #e9d5ff !important; }',
  ].join('\n')
  document.head.appendChild(listStyleEl)
}
const removeListStyle = () => { listStyleEl?.remove(); listStyleEl = null }

onMounted(() => {
  injectListStyle()
  createEditor()
  // 键盘导航（捕获阶段，先于 ProseMirror 处理）与链接点击跳转
  rootRef.value?.addEventListener('contextmenu', onEditorContext)
  document.addEventListener('mousedown', onDocMouseDownClose, true)
  document.addEventListener('keydown', onDocKeyClose, true)
  blocksContainerRef.value?.addEventListener('scroll', onScrollClose, { passive: true })
  rootRef.value?.addEventListener('keydown', onRootKeydown, true)
  rootRef.value?.addEventListener('click', onRootClick, true)
  // wiki-link chip 由 ProseMirror 增删重建，用 MutationObserver 维护已解析标记
  if (crepeRootRef.value) {
    domObserver = new MutationObserver(() => refreshResolvedLinks())
    domObserver.observe(crepeRootRef.value, { childList: true, subtree: true })
  }
})

onBeforeUnmount(async () => {
  removeListStyle()
  ready = false
  rootRef.value?.removeEventListener('contextmenu', onEditorContext)
  document.removeEventListener('mousedown', onDocMouseDownClose, true)
  document.removeEventListener('keydown', onDocKeyClose, true)
  blocksContainerRef.value?.removeEventListener('scroll', onScrollClose)
  rootRef.value?.removeEventListener('keydown', onRootKeydown, true)
  rootRef.value?.removeEventListener('click', onRootClick, true)
  domObserver?.disconnect()
  domObserver = null
  view = null
  await crepe?.destroy()
  crepe = null
})

// 外部切换笔记 / 日记时重建全文（含空值重置）
watch(() => props.modelValue, (value) => {
  const next = normalize(value)
  if (!ready || next === syncedValue) return
  syncedValue = next
  crepe?.editor.action(replaceAll(next, true))
})

const getValue = (): string => (ready ? normalize(crepe!.getMarkdown()) : normalize(props.modelValue))

const setValue = (content: string) => {
  const next = normalize(content)
  syncedValue = next
  if (ready) crepe?.editor.action(replaceAll(next, true))
  emit('update:modelValue', next)
  emit('input', next)
}

const focus = () => {
  blocksContainerRef.value?.querySelector<HTMLElement>('.ProseMirror')?.focus()
}

defineExpose({ getValue, setValue, focus, blocksContainerRef })
</script>

<style scoped>
.md-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
}

/* 唯一滚动容器 */
.md-blocks {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(102, 126, 234, 0.25) transparent;
}
.md-blocks::-webkit-scrollbar { width: 6px; }
.md-blocks::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.25);
  border-radius: 3px;
}

.md-crepe-root {
  min-height: 100%;
}

/* ====== 编辑器光标与选区（显眼紫色系；:deep 穿透 Milkdown 动态 DOM，scoped 下必须） ====== */
.md-editor :deep(.ProseMirror) {
  caret-color: #a78bfa;
}
.md-editor :deep(.ProseMirror) ::selection {
  background: rgba(102, 126, 234, 0.45);
}

/* ====== 右键格式工具栏 ====== */
.md-ctx-menu {
  position: fixed;
  z-index: 120;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px;
  background: rgba(23, 22, 48, 0.98);
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.md-ctx-row { display: flex; gap: 2px; }
.md-ctx-btn {
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1;
  padding: 6px 9px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.md-ctx-btn:hover { background: rgba(102, 126, 234, 0.25); color: #ffffff; }
.md-ctx-btn.active { background: rgba(102, 126, 234, 0.35); color: #93c5fd; }
.md-ctx-btn.b { font-weight: 700; }
.md-ctx-btn.i { font-style: italic; }
.md-ctx-btn.s { text-decoration: line-through; }
.md-ctx-btn.c { font-family: Consolas, Monaco, monospace; }

/* ====== wiki-link（[[ 笔记链接 ]]）====== */
.md-editor {
  position: relative;
}

.md-editor :deep(span[data-type='wikiLink']) {
  display: inline-block;
  padding: 0 5px;
  border-radius: 5px;
  background: rgba(102, 126, 234, 0.14);
  color: #93c5fd;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  user-select: none;
  -webkit-user-select: none;
}

.md-editor :deep(span[data-type='wikiLink']:hover) {
  background: rgba(102, 126, 234, 0.28);
  color: #c7d2fe;
}

.md-editor :deep(span[data-type='wikiLink'][data-resolved='false']) {
  background: transparent;
  color: rgba(147, 197, 253, 0.8);
  border: 1px dashed rgba(102, 126, 234, 0.45);
  padding: 0 4px;
}

.wiki-sug {
  position: absolute;
  z-index: 60;
  width: 240px;
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
  background: rgba(23, 22, 48, 0.97);
  border: 1px solid rgba(102, 126, 234, 0.25);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  scrollbar-width: thin;
  scrollbar-color: rgba(102, 126, 234, 0.25) transparent;
}

.wiki-sug-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(203, 213, 225, 0.85);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.1s;
}

.wiki-sug-item.hl {
  background: rgba(102, 126, 234, 0.18);
  color: #93c5fd;
}

.wiki-sug-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wiki-sug-sub {
  flex-shrink: 0;
  font-size: 10px;
  color: rgba(148, 163, 184, 0.8);
}

.wiki-sug-empty {
  padding: 8px;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.8);
}

/* ====== Crepe 主题：极光青绿（Aurora）暗色配色 + 交还滚动控制权 ====== */
.md-editor :deep(.milkdown) {
  height: auto;
  overflow: visible;
  padding: 0;
  background: transparent;

  --crepe-color-background: transparent;
  --crepe-color-on-background: #cbd5e1;
  --crepe-color-surface: rgba(23, 22, 48, 0.96);
  --crepe-color-surface-low: rgba(102, 126, 234, 0.1);
  --crepe-color-on-surface: #cbd5e1;
  --crepe-color-on-surface-variant: #7d8db5;
  --crepe-color-outline: rgba(102, 126, 234, 0.28);
  --crepe-color-primary: #667eea;
  --crepe-color-secondary: rgba(102, 126, 234, 0.18);
  --crepe-color-on-secondary: #cbd5e1;
  --crepe-color-inverse: rgba(23, 22, 48, 0.98);
  --crepe-color-on-inverse: #cbd5e1;
  --crepe-color-inline-code: #93c5fd;
  --crepe-color-error: #f87171;
  --crepe-color-hover: rgba(102, 126, 234, 0.15);
  --crepe-color-selected: rgba(102, 126, 234, 0.35);
  --crepe-color-inline-area: rgba(102, 126, 234, 0.3);

  --crepe-base-font-size: 15px;
  --crepe-font-title: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  --crepe-font-default: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  --crepe-font-code: 'Consolas', 'Monaco', 'Courier New', monospace;
  --crepe-shadow-1: 0 2px 8px rgba(0, 0, 0, 0.35);
  --crepe-shadow-2: 0 6px 20px rgba(0, 0, 0, 0.4);
}

.md-editor :deep(.milkdown .ProseMirror) {
  overflow: visible;
  outline: none;
}

/* ====== 内容排版：极光青绿（Aurora）配色 ====== */
.md-editor :deep(.markdown-body) {
  color: #cbd5e1;
  font-size: 15px;
  line-height: 1.85;
  background: transparent;
  word-wrap: break-word;
}

.md-editor :deep(.markdown-body h1),
.md-editor :deep(.markdown-body h2),
.md-editor :deep(.markdown-body h3),
.md-editor :deep(.markdown-body h4),
.md-editor :deep(.markdown-body h5),
.md-editor :deep(.markdown-body h6) {
  margin-top: 0.5em;
  margin-bottom: 0.3em;
  font-weight: 700;
  line-height: 1.4;
}
.md-editor :deep(.markdown-body h1) { font-size: 24px; color: #93c5fd; border-bottom: 1px solid rgba(102, 126, 234, 0.25); padding-bottom: 6px; }
.md-editor :deep(.markdown-body h2) { font-size: 21px; color: #93c5fd; }
.md-editor :deep(.markdown-body h3) { font-size: 18px; color: #c4b5fd; }
.md-editor :deep(.markdown-body h4) { font-size: 16px; color: #c4b5fd; }
.md-editor :deep(.markdown-body h5) { font-size: 15px; color: #94a3b8; }
.md-editor :deep(.markdown-body h6) { font-size: 14px; color: #94a3b8; }

.md-editor :deep(.markdown-body p) { margin: 0; }

/* 引用：左侧竖条由 Crepe 的 ::before 绘制（取 --crepe-color-selected），此处只加底色，避免出现双竖条 */
.md-editor :deep(.markdown-body blockquote) {
  background: rgba(102, 126, 234, 0.06);
  color: #7d8db5;
  padding-right: 14px;
  border-radius: 0 6px 6px 0;
}
.md-editor :deep(.markdown-body blockquote p) { margin: 0; }

/* 行内代码的配色由 --crepe-color-inline-code / --crepe-color-inline-area 驱动，无需额外覆盖 */

.md-editor :deep(.markdown-body a) {
  color: #93c5fd;
  text-decoration: none;
}
.md-editor :deep(.markdown-body a:hover) { text-decoration: underline; }

.md-editor :deep(.markdown-body hr) {
  border: none;
  border-top: 1px solid rgba(102, 126, 234, 0.18);
  margin: 0.5em 0;
}

.md-editor :deep(.markdown-body ul),
.md-editor :deep(.markdown-body ol) {
  padding-left: 24px;
  margin: 0;
  margin-left: 8px;
}

.md-editor :deep(.markdown-body img) {
  max-width: 100%;
  border-radius: 6px;
}

.md-editor :deep(.markdown-body strong) {
  color: #eef2ff;
  font-weight: 700;
}

.md-editor :deep(.markdown-body del) { color: #5d6b94; }


</style>