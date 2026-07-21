<template>
  <div class="md-editor">
    <!-- 工具栏 -->
    <div class="md-toolbar">
      <button v-for="btn in toolbarButtons" :key="btn.label"
        class="md-toolbar-btn" :title="btn.label"
        @click="handleToolbar(btn)">
        <span v-html="btn.icon"></span>
      </button>
    </div>

    <!-- 块级编辑区 -->
    <div ref="blocksContainerRef" class="md-blocks markdown-body" @click="handleContainerClick">
      <div
        v-for="block in blocks"
        :key="block.id"
        :ref="(el: any) => setBlockRef(block.id, el)"
        class="md-block"
        :class="{ 'md-block--editing': activeBlockId === block.id }"
        @click.stop="activateBlock(block.id)"
      >
        <!-- 预览态 -->
        <div
          v-if="activeBlockId !== block.id"
          class="md-block-preview"
          v-html="block.html"
        ></div>
        <!-- 编辑态 -->
        <textarea
          v-else
          :ref="(el: any) => setTextareaRef(block.id, el)"
          class="md-block-textarea"
          :value="block.source"
          @input="onBlockInput(block.id, $event)"
          @blur="deactivateBlock()"
          @keydown.escape.prevent="deactivateBlock()"
          @keydown.tab.prevent="onBlockTab(block.id)"
        ></textarea>
      </div>
      <!-- 无内容时占位 -->
      <div v-if="blocks.length === 0" class="md-placeholder" @click="addEmptyBlock">
        {{ placeholder }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

// ====== 类型 ======
interface ToolBtn { label: string; icon: string; insert: string }
interface MdBlockData {
  id: number
  source: string
  html: string
  lineCount: number
}

// ====== Props & Emits ======
const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
}>(), {
  placeholder: '开始编写 Markdown 笔记...'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input', value: string): void
}>()

// ====== Refs ======
const blocksContainerRef = ref<HTMLDivElement>()
const blocks = ref<MdBlockData[]>([])
const activeBlockId = ref<number | null>(null)
const blockRefs: Record<number, HTMLDivElement> = {}
const textareaRefs: Record<number, HTMLTextAreaElement> = {}
let nextId = 1

// ====== 工具栏 ======
const toolbarButtons: ToolBtn[] = [
  { label: '粗体',        icon: '<b>B</b>',                     insert: '**$1**' },
  { label: '斜体',        icon: '<i>I</i>',                     insert: '*$1*' },
  { label: '删除线',      icon: '<s>S</s>',                     insert: '~~$1~~' },
  { label: '标题 H2',     icon: 'H2',                            insert: '## $1' },
  { label: '标题 H3',     icon: 'H3',                            insert: '### $1' },
  { label: '引用',        icon: '❝',                              insert: '> $1' },
  { label: '代码块',      icon: '⊕',                             insert: '```\n$1\n```' },
  { label: '行内代码',    icon: '&lt;/&gt;',                    insert: '`$1`' },
  { label: '链接',        icon: '🔗',                              insert: '[$2]($1)' },
  { label: '图片',        icon: '🖼',                              insert: '![$2]($1)' },
  { label: '无序列表',    icon: '•',                              insert: '- $1' },
  { label: '有序列表',    icon: '1.',                            insert: '1. $1' },
  { label: '分隔线',      icon: '—',                             insert: '\n---\n' },
  { label: '表格',        icon: '◫',                              insert: '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| $1 | $1 | $1 |\n' },
]

// ====== 块拆分 ======
function splitMarkdownToBlocks(md: string): string[] {
  if (!md.trim()) return []

  // 先按双换行拆分
  const rawBlocks = md.split(/\n\n+/)
  const result: string[] = []

  let i = 0
  while (i < rawBlocks.length) {
    let block = rawBlocks[i].trim()

    // 代码块：收集直到闭合 ```
    if (block.startsWith('```') && !block.slice(3).includes('```')) {
      while (i + 1 < rawBlocks.length) {
        i++
        block += '\n\n' + rawBlocks[i]
        if (rawBlocks[i].includes('```')) break
      }
    }

    // 表格：表头 + 分隔行 + 数据行
    if (block.includes('| ---') || block.includes('| :--')) {
      result.push(block)
      i++
      continue
    }

    // 列表项聚合：连续的 `- ` 或 `1. ` 开头的行合并为一个块
    if (/^[-*]\s/.test(block) || /^\d+\.\s/.test(block)) {
      let listBlock = block
      while (i + 1 < rawBlocks.length) {
        const next = rawBlocks[i + 1].trim()
        if (/^[-*]\s/.test(next) || /^\d+\.\s/.test(next)) {
          i++
          listBlock += '\n' + next
        } else {
          break
        }
      }
      result.push(listBlock)
      i++
      continue
    }

    result.push(block)
    i++
  }

  return result
}

function blockToHtml(source: string): string {
  if (!source) return ''
  return parseInlineMarkdown(source)
}

function parseInlineMarkdown(md: string): string {
  let html = md

  // 转义
  html = html.replace(/&(?!#?\w+;)/g, '&amp;')
  html = html.replace(/</g, '&lt;')
  html = html.replace(/>/g, '&gt;')

  // 代码块（完整处理）
  const codeBlocks: string[] = []
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length
    let highlighted: string
    try {
      const raw = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      highlighted = lang && hljs.getLanguage(lang)
        ? hljs.highlight(raw, { language: lang }).value
        : hljs.highlightAuto(raw).value
    } catch {
      highlighted = code
    }
    codeBlocks.push(`<pre><code class="hljs${lang ? ' language-' + lang : ''}">${highlighted}</code></pre>`)
    return `\n〔CODEBLOCK_${idx}〕\n`
  })

  // 表格（表头前允许行首也允许换行符）
  html = html.replace(/(?:^|\n)\|(.+)\|\n\|[-: |]+\|\n((?:\|.+\|\n?)+)/gm, (_m, header, rows) => {
    const hCells = header.split('|').map((c: string) => c.trim()).filter(Boolean)
    const thead = `<tr>${hCells.map((c: string) => `<th>${c}</th>`).join('')}</tr>`
    const tbody = rows.trim().split('\n').map((row: string) => {
      const cells = row.replace(/^\||\|$/g, '').split('|').map((c: string) => c.trim())
      return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`
    }).join('')
    return `\n<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>\n`
  })

  // 分隔线
  html = html.replace(/^(---|\*\*\*|___)\s*$/gm, '<hr>')

  // 标题
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // 引用
  html = html.replace(/^&gt; (.*)$/gm, '<blockquote><p>$1</p></blockquote>')
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n')

  // 无序列表
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
  if (/<li>/.test(html)) {
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
  }

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, (m: string) => '<ol-li>' + m.replace(/^\d+\. /, '') + '</ol-li>')
  if (/<ol-li>/.test(html)) {
    html = html.replace(/((?:<ol-li>.*<\/ol-li>\n?)+)/g, (m: string) =>
      '<ol>' + m.replace(/<ol-li>/g, '<li>').replace(/<\/ol-li>/g, '</li>') + '</ol>')
  }

  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  // 粗斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')
  // 删除线
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // 段落：未被块级标签包裹的行
  html = html.replace(/^(?!<(h[1-6]|blockquote|ul|ol|li|pre|table|hr|img|a|code|strong|em|del))(.+)/gm, (m) => {
    if (m.startsWith('〔CODEBLOCK_')) return m
    return `<p>${m}</p>`
  })

  // 还原代码块
  html = html.replace(/〔CODEBLOCK_(\d+)〕/g, (_m, idx) => codeBlocks[parseInt(idx)] || '')

  return html
}

// ====== 重建 blocks ======
function rebuildBlocks(md: string) {
  const sources = splitMarkdownToBlocks(md)
  const prevMap = new Map<number, MdBlockData>()
  for (const b of blocks.value) prevMap.set(b.id, b)

  blocks.value = sources.map((source) => {
    // 如果 source 与已存在的某个 block 完全匹配，复用其 id（保持 Vue key 稳定）
    for (const [id, prev] of prevMap) {
      if (prev.source === source) {
        prevMap.delete(id)
        return { ...prev, html: blockToHtml(source), lineCount: source.split('\n').length || 1 }
      }
    }
    return {
      id: nextId++,
      source,
      html: blockToHtml(source),
      lineCount: source.split('\n').length || 1,
    }
  })
}

// ====== 全量 md 组装与发送 ======
function emitFullMd() {
  const md = blocks.value.map(b => b.source).join('\n\n')
  emit('update:modelValue', md)
  emit('input', md)
}

// ====== 监听外部 modelValue 变化 ======
watch(() => props.modelValue, (val) => {
  // 只有外部变更才重建（避免与自身 emit 形成循环）
  const currentMd = blocks.value.map(b => b.source).join('\n\n')
  if (val === currentMd) return
  rebuildBlocks(val)
  activeBlockId.value = null
}, { immediate: true })

// ====== textarea 自适应高度 ======
function autoResize(ta: HTMLTextAreaElement) {
  ta.style.height = '0'
  ta.style.height = ta.scrollHeight + 'px'
}

// ====== 块激活/取消 ======
const setBlockRef = (id: number, el: any) => { if (el) blockRefs[id] = el }
const setTextareaRef = (id: number, el: any) => {
  if (!el) return
  textareaRefs[id] = el
  // 延迟到 DOM 绑定完成后读取 scrollHeight
  nextTick(() => autoResize(el))
}

const activateBlock = (id: number) => {
  activeBlockId.value = id
  nextTick(() => {
    const ta = textareaRefs[id]
    if (ta) {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = ta.value.length
      autoResize(ta)
    }
  })
}

const deactivateBlock = () => {
  activeBlockId.value = null
  emitFullMd()
}

// ====== 块编辑 ======
const onBlockInput = (id: number, e: Event) => {
  const ta = e.target as HTMLTextAreaElement
  const source = ta.value
  const block = blocks.value.find(b => b.id === id)
  if (!block) return
  block.source = source
  block.html = blockToHtml(source)
  block.lineCount = source.split('\n').length || 1
  autoResize(ta)
}

const onBlockTab = (id: number) => {
  const ta = textareaRefs[id]
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end)
  ta.selectionStart = ta.selectionEnd = start + 2
  onBlockInput(id, { target: ta } as any)
}

// ====== 容器点击（空白区域新建块） ======
const handleContainerClick = (e: MouseEvent) => {
  if (e.target === blocksContainerRef.value) {
    addEmptyBlock()
  }
}

const addEmptyBlock = () => {
  const newBlock: MdBlockData = { id: nextId++, source: '', html: '', lineCount: 1 }
  blocks.value.push(newBlock)
  nextTick(() => activateBlock(newBlock.id))
}

// ====== 工具栏操作 ======
const handleToolbar = (btn: ToolBtn) => {
  let targetId = activeBlockId.value

  // 无激活块则新建一个
  if (targetId === null) {
    const newBlock: MdBlockData = { id: nextId++, source: '', html: '', lineCount: 1 }
    blocks.value.push(newBlock)
    targetId = newBlock.id
    nextTick(() => {
      activeBlockId.value = targetId!
      const ta = textareaRefs[targetId!]
      if (ta) {
        ta.focus()
        insertIntoBlock(targetId!, btn)
      }
    })
    return
  }

  insertIntoBlock(targetId, btn)
}

function insertIntoBlock(id: number, btn: ToolBtn) {
  const ta = textareaRefs[id]
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.slice(start, end)

  let insertText = btn.insert
    .replace(/\$1/g, selected || '文字')
    .replace(/\$2/g, selected || '描述')

  if (btn.insert.startsWith('\n') && start > 0 && ta.value[start - 1] !== '\n') {
    insertText = '\n' + insertText
  }

  const newVal = ta.value.slice(0, start) + insertText + ta.value.slice(end)
  ta.value = newVal
  ta.selectionStart = ta.selectionEnd = start + insertText.length
  onBlockInput(id, { target: ta } as any)
  ta.focus()
}

// ====== 暴露给父组件 ======
const getValue = (): string => props.modelValue
const setValue = (content: string) => {
  emit('update:modelValue', content)
  rebuildBlocks(content)
  activeBlockId.value = null
}
const focus = () => {
  const firstBlock = blocks.value[0]
  if (firstBlock) activateBlock(firstBlock.id)
}
const activeTextareaRef = () => activeBlockId.value ? textareaRefs[activeBlockId.value] : null

defineExpose({ getValue, setValue, focus, activeTextareaRef, blocksContainerRef })
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

/* ====== 工具栏 ====== */
.md-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px 8px;
  background: rgba(20, 18, 50, 0.6);
  border-bottom: 1px solid rgba(102, 126, 234, 0.15);
  flex-shrink: 0;
}
.md-toolbar-btn {
  width: 30px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  font-family: inherit;
}
.md-toolbar-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: #93c5fd;
}

/* ====== 块容器 ====== */
.md-blocks {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(102, 126, 234, 0.2) transparent;
}
.md-blocks::-webkit-scrollbar { width: 6px; }
.md-blocks::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.2);
  border-radius: 3px;
}

/* ====== 块 ====== */
.md-block {
  position: relative;
  border-radius: 6px;
  transition: background 0.15s;
  cursor: text;
}
.md-block:hover {
  background: rgba(102, 126, 234, 0.04);
}
.md-block--editing {
  background: rgba(102, 126, 234, 0.06);
}

.md-block-preview {
  padding: 6px 8px;
  min-height: 1.85em;
  word-wrap: break-word;
}

/* 块级文本域（自适应高度） */
.md-block-textarea {
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  outline: none;
  resize: none;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  color: #e2e8f0;
  font-size: 15px;
  line-height: 1.85;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Consolas', 'Monaco', sans-serif;
  box-sizing: border-box;
}

/* 占位文本 */
.md-placeholder {
  color: #64748b;
  font-size: 15px;
  padding: 6px 8px;
  cursor: text;
  min-height: 1.85em;
}
</style>

<!-- 非 scoped：markdown 预览样式（暗色星空主题） -->
<style>
.markdown-body {
  color: #e2e8f0;
  font-size: 15px;
  line-height: 1.85;
  background: transparent;
  word-wrap: break-word;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 0.5em;
  margin-bottom: 0.3em;
  font-weight: 700;
  line-height: 1.4;
}
.markdown-body h1 { font-size: 24px; color: #93c5fd; border-bottom: 1px solid rgba(102,126,234,0.25); padding-bottom: 6px; }
.markdown-body h2 { font-size: 21px; color: #93c5fd; }
.markdown-body h3 { font-size: 18px; color: #c4b5fd; }
.markdown-body h4 { font-size: 16px; color: #c4b5fd; }
.markdown-body h5 { font-size: 15px; color: #cbd5e1; }
.markdown-body h6 { font-size: 14px; color: #cbd5e1; }

.markdown-body p {
  margin: 0;
}

.markdown-body blockquote {
  border-left: 3px solid #667eea;
  background: rgba(102,126,234,0.08);
  color: #94a3b8;
  padding: 8px 14px;
  margin: 0;
}
.markdown-body blockquote p {
  margin: 0;
}

.markdown-body code {
  background: rgba(102,126,234,0.18);
  color: #93c5fd;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

.markdown-body pre {
  background: rgba(20, 18, 50, 0.6);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 0;
  overflow-x: auto;
}
.markdown-body pre code {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #e2e8f0;
}

.markdown-body table {
  border-collapse: collapse;
  margin: 0;
  width: 100%;
}
.markdown-body th,
.markdown-body td {
  border: 1px solid rgba(255,255,255,0.1);
  padding: 6px 10px;
  text-align: left;
}
.markdown-body th {
  background: rgba(102,126,234,0.2);
  color: #93c5fd;
  font-weight: 700;
}

.markdown-body a {
  color: #93c5fd;
  text-decoration: none;
}
.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 0.5em 0;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 24px;
  margin: 0;
  margin-left: 8px;
}

.markdown-body img {
  max-width: 100%;
  border-radius: 6px;
}

.markdown-body strong {
  color: #cbd5e1;
  font-weight: 700;
}

.markdown-body del {
  color: #64748b;
}
</style>
