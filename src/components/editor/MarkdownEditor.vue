<template>
  <div class="md-editor">
    <!-- 工具栏（mousedown.prevent：点击按钮不转移焦点，避免 textarea 失焦退出编辑态） -->
    <div class="md-toolbar" @mousedown.prevent>
      <!-- 插入按钮（编辑态自动禁用，工具栏最左侧） -->
      <div class="md-toolbar-dropdown">
        <button class="md-toolbar-btn md-dropdown-trigger" title="插入" @click="toggleInsertMenu">
          <span>＋</span><span class="md-caret">▾</span>
        </button>
        <div v-if="insertMenuOpen" class="md-toolbar-menu">
          <button class="md-menu-item" @click="insertBlockAtEnd(); insertMenuOpen = false">📝 插入块</button>
          <button class="md-menu-item" @click="insertCodeBlockAtEnd(); insertMenuOpen = false">💻 插入代码块</button>
          <button class="md-menu-item" @click="insertImageBlockAtEnd(); insertMenuOpen = false">📷 插入图片</button>
          <button class="md-menu-item" @click="insertDividerAtEnd(); insertMenuOpen = false">➖ 插入分隔线</button>
          <button class="md-menu-item" @click="insertTableAtEnd(); insertMenuOpen = false">📊 插入表格</button>
        </div>
      </div>
      <template v-for="btn in toolbarButtons" :key="btn.label">
        <!-- 标题：下拉列表（正文 / H1~H6） -->
        <div v-if="btn.action === 'heading'" class="md-toolbar-dropdown">
          <button class="md-toolbar-btn md-dropdown-trigger" :title="btn.label" :disabled="activeBlockId === null" @click="toggleHeadingMenu">
            <span v-html="btn.icon"></span><span class="md-caret">▾</span>
          </button>
          <div v-if="headingMenuOpen" class="md-toolbar-menu">
            <button class="md-menu-item" @click="applyHeading(0)">正文</button>
            <button v-for="n in 6" :key="n" class="md-menu-item" @click="applyHeading(n)">H{{ n }}</button>
          </div>
        </div>
        <!-- 普通按钮 -->
        <button v-else class="md-toolbar-btn" :title="btn.label" :disabled="activeBlockId === null || (btn.requiresSelection && !hasSelection)" @click="handleToolbar(btn)">
          <span v-html="btn.icon"></span>
        </button>
      </template>
    </div>

    <!-- 块级编辑区 -->
    <div ref="blocksContainerRef" class="md-blocks markdown-body">
      <div
        v-for="block in blocks"
        :key="block.id"
        :ref="(el: any) => setBlockRef(block.id, el)"
        class="md-block"
        :class="{ 'md-block--editing': activeBlockId === block.id }"
        :data-block-id="block.id"
        @click.stop="handleBlockClick(block)"
      >
        <!-- 图片块 + 右方滑块 -->
        <template v-if="activeImgSlider === block.id">
        <div class="md-img-slider-wrap" @click.stop @mousedown.stop>
          <div class="md-block-preview" v-html="block.html"></div>
          <div class="md-img-slider">
            <input
              type="range"
              min="10"
              max="100"
              :value="getImgWidth(block.source)"
              @input="onImgSliderInput($event, block)"
            />
            <span class="md-img-slider-val">{{ getImgWidth(block.source) }}%</span>
          </div>
        </div>
        </template>
        <!-- 普通预览态 -->
        <template v-else-if="activeBlockId !== block.id">
        <div
          class="md-block-preview"
          v-html="block.html"
        ></div>
        </template>
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
          @mouseup="updateSelection"
          @keyup="updateSelection"
          @select="updateSelection"
        ></textarea>
      </div>
      <!-- 无内容时占位 -->
      <div v-if="blocks.length === 0" class="md-placeholder" @click="addEmptyBlock">
        {{ placeholder }}
      </div>
    </div>

    <!-- 隐藏的图片上传 input -->
    <input ref="imageInputRef" type="file" accept="image/*" style="display:none" @change="onImageFileSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

// ====== 类型 ======
interface ToolBtn {
  label: string
  icon: string
  action: 'wrap' | 'quote' | 'heading' | 'list'
  insert?: string
  requiresSelection?: boolean
  listType?: 'ul' | 'ol'
}
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
let prevActiveBlockId: number | null = null // 切换前被编辑的块，供 blur 时正确清理空块

// ====== 工具栏 ======
const toolbarButtons: ToolBtn[] = [
  { label: '粗体', icon: '<b>B</b>', action: 'wrap', insert: '**$1**', requiresSelection: true },
  { label: '斜体', icon: '<i>I</i>', action: 'wrap', insert: '*$1*', requiresSelection: true },
  { label: '删除线', icon: '<s>S</s>', action: 'wrap', insert: '~~$1~~', requiresSelection: true },
  { label: '标题', icon: 'H', action: 'heading' },
  { label: '引用', icon: '❝', action: 'quote' },
  { label: '行内代码', icon: '&lt;/&gt;', action: 'wrap', insert: '`$1`' },
  { label: '链接', icon: '🔗', action: 'wrap', insert: '[$2]($1)' },
  { label: '无序列表', icon: '•', action: 'list', listType: 'ul' },
  { label: '有序列表', icon: '1.', action: 'list', listType: 'ol' },
]

// 标题下拉菜单状态
const headingMenuOpen = ref(false)
const toggleHeadingMenu = () => { headingMenuOpen.value = !headingMenuOpen.value }

// 插入下拉菜单状态
const insertMenuOpen = ref(false)
const toggleInsertMenu = () => { insertMenuOpen.value = !insertMenuOpen.value }

// 当前编辑块是否有文字选中（控制加粗/斜体/删除线按钮禁用态）
const hasSelection = ref(false)
const updateSelection = () => {
  const id = activeBlockId.value
  if (id === null) { hasSelection.value = false; return }
  const ta = textareaRefs[id]
  hasSelection.value = ta ? ta.selectionStart !== ta.selectionEnd : false
}

// 图片上传
const imageInputRef = ref<HTMLInputElement>()

// 图片宽度滑块状态
const activeImgSlider = ref<number | null>(null)

// 点击编辑器外部时关闭下拉（捕获阶段，避免被 @click.stop 阻断）
const onDocClick = (e: MouseEvent) => {
  if (!(e.target as HTMLElement).closest('.md-toolbar-dropdown')) { headingMenuOpen.value = false; insertMenuOpen.value = false }
  if (!(e.target as HTMLElement).closest('.md-img-slider-wrap')) activeImgSlider.value = null
}
onMounted(() => {
  document.addEventListener('click', onDocClick, true)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick, true)
})

// ====== 块拆分 ======
function splitMarkdownToBlocks(md: string): string[] {
  if (!md.trim()) return []

  // 先按双换行拆分，再拆出独立分隔线（--- / *** / ___）
  const rawBlocks = md.split(/\n\n+/)
  const expanded: string[] = []
  for (const b of rawBlocks) {
    if (/^(---+|\*\*\*+|___+)\s*$/.test(b.trim())) {
      expanded.push(b.trim())
    } else {
      const lines = b.split('\n')
      let chunk = ''
      for (const line of lines) {
        if (/^(---+|\*\*\*+|___+)\s*$/.test(line.trim())) {
          if (chunk.trim()) expanded.push(chunk.trim())
          expanded.push(line.trim())
          chunk = ''
        } else {
          chunk += (chunk ? '\n' : '') + line
        }
      }
      if (chunk.trim()) expanded.push(chunk.trim())
    }
  }

  const result: string[] = []

  let i = 0
  while (i < expanded.length) {
    let block = expanded[i].trim()

    // 代码块：收集直到闭合 ```
    if (block.startsWith('```') && !block.slice(3).includes('```')) {
      while (i + 1 < expanded.length) {
        i++
        block += '\n\n' + expanded[i]
        if (expanded[i].includes('```')) break
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
      while (i + 1 < expanded.length) {
        const next = expanded[i + 1].trim()
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

  // 图片（带尺寸：{w:N}）
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)\s*\{w:(\d+)\}/g, '<div class="md-resize-img" style="width:$3%"><img src="$2" alt="$1" style="width:100%" loading="lazy"></div>')
  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="md-resize-img"><img src="$2" alt="$1" loading="lazy"></div>')
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

const activateBlock = (id: number, cursorPos?: number) => {
  // 块已在编辑态时直接返回：避免点击 textarea 冒泡到块容器重复触发，
  // 导致光标被强制重置到文本末尾
  if (activeBlockId.value === id) return
  // 图片块仅预览，禁用编辑态
  const block = blocks.value.find(b => b.id === id)
  if (block && /^!\[/.test(block.source)) return
  prevActiveBlockId = activeBlockId.value // 记录切换前的块，供 blur 时正确清理空块
  activeBlockId.value = id
  nextTick(() => {
    const ta = textareaRefs[id]
    if (ta) {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = cursorPos ?? (ta.value.startsWith('```') ? ta.value.length - 4 : ta.value.length)
      autoResize(ta)
    }
  })
}

const deactivateBlock = () => {
  headingMenuOpen.value = false
  hasSelection.value = false

  // 切换块导致的 blur：应清理「前一个」块，而非已被 activateBlock 改写的当前块
  // 注意：此处不调用 emitFullMd()，因为 deactivateBlock 在 Vue 渲染阶段由
  // textarea 卸载的 @blur 触发，此时 props.modelValue 尚未更新，emit 会导致
  // watch 用旧值 rebuildBlocks，可能重现已删除的空块或额外创建空块。
  if (prevActiveBlockId !== null) {
    const idx = blocks.value.findIndex(b => b.id === prevActiveBlockId)
    if (idx !== -1 && !blocks.value[idx].source.trim()) {
      blocks.value.splice(idx, 1)
    }
    prevActiveBlockId = null
    return
  }

  // 正常失焦（点击外部 / Escape）
  const id = activeBlockId.value
  // 如果当前块正在等待文件选择器返回，保持编辑态
  if (id !== null && Number(imageInputRef.value?.dataset.blockId) === id) return
  activeBlockId.value = null
  if (id !== null) {
    const idx = blocks.value.findIndex(b => b.id === id)
    if (idx !== -1 && !blocks.value[idx].source.trim()) {
      blocks.value.splice(idx, 1)
    }
  }
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

// ====== 块点击分发 ======
const handleBlockClick = (block: MdBlockData) => {
  if (block.source.startsWith('![')) {
    activeImgSlider.value = activeImgSlider.value === block.id ? null : block.id
  } else {
    activeImgSlider.value = null
    activateBlock(block.id)
  }
}

const addEmptyBlock = () => {
  const newBlock: MdBlockData = { id: nextId++, source: '', html: '', lineCount: 1 }
  blocks.value.push(newBlock)
  nextTick(() => activateBlock(newBlock.id))
}

// ====== 图片宽度滑块 ======
const getImgWidth = (source: string): number => {
  const m = source.match(/\{w:(\d+)\}/)
  return m ? parseInt(m[1]) : 100
}

const onImgSliderInput = (e: Event, block: MdBlockData) => {
  const pct = parseInt((e.target as HTMLInputElement).value)
  if (/\{w:\d+\}/.test(block.source)) {
    block.source = block.source.replace(/\{w:\d+\}/, `{w:${pct}}`)
  } else {
    block.source = block.source.replace(/!\[([^\]]*)\]\(([^)]+)\)/, `![$1]($2) {w:${pct}}`)
  }
  block.html = blockToHtml(block.source)
  emitFullMd()
}

// ====== 插入（工具栏用）：编辑态插入到当前编辑块之后，否则追加到末尾 ======
const insertIndex = (): number => {
  const id = activeBlockId.value
  if (id !== null) {
    const idx = blocks.value.findIndex(b => b.id === id)
    if (idx !== -1) return idx + 1
  }
  return blocks.value.length
}

const insertBlockAtEnd = () => {
  const newBlock: MdBlockData = { id: nextId++, source: '', html: '', lineCount: 1 }
  blocks.value.splice(insertIndex(), 0, newBlock)
  nextTick(() => activateBlock(newBlock.id))
}

const insertCodeBlockAtEnd = () => {
  const source = '```\n\n```'
  const newBlock: MdBlockData = { id: nextId++, source, html: blockToHtml(source), lineCount: 3 }
  blocks.value.splice(insertIndex(), 0, newBlock)
  nextTick(() => activateBlock(newBlock.id, 4))
}

const insertDividerAtEnd = () => {
  const source = '---'
  blocks.value.splice(insertIndex(), 0, { id: nextId++, source, html: blockToHtml(source), lineCount: 1 })
  emitFullMd()
}

const insertTableAtEnd = () => {
  const source = '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |'
  blocks.value.splice(insertIndex(), 0, { id: nextId++, source, html: blockToHtml(source), lineCount: 3 })
  emitFullMd()
}

const insertImageBlockAtEnd = () => {
  const newBlock: MdBlockData = { id: nextId++, source: '', html: '', lineCount: 1 }
  blocks.value.splice(insertIndex(), 0, newBlock)
  nextTick(() => {
    activateBlock(newBlock.id)
    handleImageUpload(newBlock.id)
  })
}

// ====== 图片上传 ======
const handleImageUpload = (id: number) => {
  const input = imageInputRef.value
  if (!input) return
  input.value = ''
  input.dataset.blockId = String(id)
  input.click()
}

const onImageFileSelected = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  const id = Number(input.dataset.blockId)
  if (!file || isNaN(id)) return

  const reader = new FileReader()
  reader.onload = () => {
    const ta = textareaRefs[id]
    if (!ta) return
    const base64 = reader.result as string
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const alt = file.name.replace(/\.[^.]+$/, '')
    const md = `![${alt}](${base64}) {w:100}`
    const newVal = ta.value.slice(0, start) + md + ta.value.slice(end)
    ta.value = newVal
    ta.selectionStart = ta.selectionEnd = start + md.length
    onBlockInput(id, { target: ta } as any)
    input.dataset.blockId = ''
    deactivateBlock()
  }
  reader.readAsDataURL(file)
}

// ====== 列表切换（当前行 toggle 前缀） ======
const toggleList = (id: number, listType: 'ul' | 'ol') => {
  const ta = textareaRefs[id]
  if (!ta) return
  const prefix = listType === 'ul' ? '- ' : '1. '
  const lines = ta.value.split('\n')

  const allHavePrefix = lines.length > 0 && lines.every(l => l.trim() === '' || l.startsWith(prefix))

  const newVal = allHavePrefix
    ? lines.map(l => l.startsWith(prefix) ? l.slice(prefix.length) : l).join('\n')
    : lines.map(l => l.trim() === '' ? l : prefix + l).join('\n')

  ta.value = newVal
  ta.selectionStart = ta.selectionEnd = newVal.length
  onBlockInput(id, { target: ta } as any)
  ta.focus()
}

// ====== 工具栏操作 ======
const handleToolbar = (btn: ToolBtn) => {
  const id = activeBlockId.value
  if (id === null) return
  const ta = textareaRefs[id]
  if (!ta) return

  if (btn.action === 'quote') {
    toggleBlockQuote(ta, id)
    return
  }
  if (btn.action === 'list') {
    toggleList(id, btn.listType!)
    return
  }
  // 需选中文字的工具（粗体/斜体/删除线）未选中时点击无效
  if (btn.requiresSelection && ta.selectionStart === ta.selectionEnd) return
  insertIntoBlock(id, btn)
}

// 整块切换引用：所有行均为引用时取消，否则逐行加引用前缀
function toggleBlockQuote(ta: HTMLTextAreaElement, id: number) {
  const lines = ta.value.split('\n')
  const allQuoted = lines.length > 0 && lines.every(l => l.startsWith('> '))
  const newVal = allQuoted
    ? lines.map(l => l.slice(2)).join('\n')
    : lines.map(l => '> ' + l).join('\n')
  ta.value = newVal
  ta.selectionStart = ta.selectionEnd = newVal.length
  onBlockInput(id, { target: ta } as any)
  ta.focus()
}

// 整块切换标题：level=0 为正文（取消标题）；H1~H6 替换而非叠加
function applyHeading(level: number) {
  headingMenuOpen.value = false
  const id = activeBlockId.value
  if (id === null) return
  const ta = textareaRefs[id]
  if (!ta) return
  let src = ta.value.replace(/^#{1,6}\s+/, '')
  if (level > 0) src = '#'.repeat(level) + ' ' + src
  ta.value = src
  ta.selectionStart = ta.selectionEnd = src.length
  onBlockInput(id, { target: ta } as any)
  ta.focus()
}

function insertIntoBlock(id: number, btn: ToolBtn) {
  const ta = textareaRefs[id]
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.slice(start, end)

  let insertText = btn.insert!
    .replace(/\$1/g, selected || '文字')
    .replace(/\$2/g, selected || '描述')

  if (btn.insert!.startsWith('\n') && start > 0 && ta.value[start - 1] !== '\n') {
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
.md-toolbar-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}

/* 标题下拉 */
.md-toolbar-dropdown {
  position: relative;
  display: flex;
}
.md-dropdown-trigger {
  width: auto;
  padding: 0 6px;
  gap: 2px;
}
.md-caret {
  font-size: 9px;
  margin-left: 1px;
}
.md-toolbar-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: rgba(30, 27, 75, 0.98);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 20;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}
.md-menu-item {
  border: none;
  background: transparent;
  color: #cbd5e1;
  font-size: 13px;
  text-align: left;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}
.md-menu-item:hover {
  background: rgba(102, 126, 234, 0.25);
  color: #93c5fd;
}

/* ====== 块容器 ====== */
.md-blocks {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
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
  cursor: text;
}

.md-block-preview {
  padding: 6px 8px;
  min-height: 1.85em;
  word-wrap: break-word;
}

/* 图片容器 */
.md-resize-img {
  max-width: 100%;
}
.md-resize-img img {
  display: block;
  max-width: 100%;
  pointer-events: none;
}

/* 图片 + 滑块并排 */
.md-img-slider-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.md-img-slider-wrap .md-block-preview {
  flex: 1 1 auto;
  min-width: 0;
}

/* 垂直滑块 */
.md-img-slider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  flex-shrink: 0;
}
.md-img-slider input[type="range"] {
  -webkit-appearance: slider-vertical;
  width: 20px;
  height: 100px;
  background: rgba(102, 126, 234, 0.2);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.md-img-slider input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #93c5fd;
  cursor: pointer;
  border: 2px solid rgba(102, 126, 234, 0.5);
}
.md-img-slider input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #93c5fd;
  cursor: pointer;
  border: 2px solid rgba(102, 126, 234, 0.5);
}
.md-img-slider-val {
  font-size: 11px;
  color: #93c5fd;
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
