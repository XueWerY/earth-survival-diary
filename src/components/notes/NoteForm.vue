<template>
  <div class="note-editor-page">
    <div class="editor-header">
      <button class="back-btn" @click="handleCancel" title="返回">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </button>
      <span class="editor-title">{{ isEdit ? '编辑笔记' : '写笔记' }}</span>
      <div class="header-actions">
        <button
          class="pin-toggle"
          :class="{ active: form.pinned }"
          @click="form.pinned = !form.pinned"
          :title="form.pinned ? '取消置顶' : '置顶'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pin-icon">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>{{ form.pinned ? '已置顶' : '置顶' }}</span>
        </button>
        <button class="capsule-btn submit-btn" @click="handleSubmit">
          <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
          <span>{{ isEdit ? '保存' : '添加' }}</span>
        </button>
      </div>
    </div>
    <div class="editor-divider"></div>

    <div class="editor-body">
      <div class="form-row">
        <span class="field-label">标题</span>
        <el-input
          ref="titleInputRef"
          v-model="form.title"
          placeholder="笔记标题"
          maxlength="100"
          class="title-input"
          @keyup.enter="handleSubmit"
        />
      </div>

      <div class="form-row form-row-content">
        <span class="field-label">内容</span>
        <div class="toolbar">
          <div class="tb-dropdown-wrap">
            <button class="tb-select" @click="toggleBlockMenu" title="标题和正文">{{ blockLabel }}</button>
            <div v-if="showBlockMenu" class="tb-dropdown" @click.stop>
              <button
                v-for="opt in BLOCK_OPTIONS"
                :key="opt.value"
                class="tb-dropdown-item"
                :style="opt.style"
                @click="applyBlockValue(opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>
          <select class="tb-select" @change="applyFontName($event)" title="字体">
            <option value="">字体</option>
            <option v-for="f in systemFonts" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
          </select>
          <select class="tb-select" @change="applyFontSize($event)" title="字号">
            <option value="">字号</option>
            <option v-for="s in [12,14,16,18,20,24,28,32,36,48]" :key="s" :value="s">{{ s }}px</option>
          </select>
          <button class="tb-btn" @click="exec('bold')" title="加粗"><b>B</b></button>
          <button class="tb-btn" @click="exec('italic')" title="斜体"><i>I</i></button>
          <button class="tb-btn" @click="exec('underline')" title="下划线"><u>U</u></button>
          <button class="tb-btn" @click="exec('strikeThrough')" title="删除线"><s>S</s></button>
          <button class="tb-btn color-btn" @click="openColorPicker('hiliteColor')" title="底纹颜色">
            <span class="color-letter">A</span>
            <span class="color-underline" :style="{ background: lastHilite }"></span>
          </button>
          <button class="tb-btn color-btn" @click="openColorPicker('foreColor')" title="字体颜色">
            <span class="color-letter" :style="{ color: lastFore }">A</span>
            <span class="color-underline" :style="{ background: lastFore }"></span>
          </button>
          <button class="tb-btn" @click="exec('superscript')" title="上标">X²</button>
          <button class="tb-btn" @click="exec('subscript')" title="下标">X₂</button>
          <button class="tb-btn" @click="exec('insertUnorderedList')" title="项目符号">•</button>
          <button class="tb-btn" @click="exec('insertOrderedList')" title="数字编号">1.</button>
          <button class="tb-btn" @click="insertTodo" title="待办事项">☐</button>
          <button class="tb-btn" @click="exec('outdent')" title="减少缩进">⇤</button>
          <button class="tb-btn" @click="exec('indent')" title="增加缩进">⇥</button>
          <select class="tb-select" @change="applyAlign($event)" title="对齐方式">
            <option value="">对齐</option>
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
            <option value="justify">两端对齐</option>
          </select>
          <select class="tb-select" @change="applyLineHeight($event)" title="调整行距">
            <option value="">行距</option>
            <option value="1">1.0</option>
            <option value="1.5">1.5</option>
            <option value="2">2.0</option>
            <option value="2.5">2.5</option>
            <option value="3">3.0</option>
          </select>
          <button class="tb-btn" @click="exec('formatBlock', 'blockquote')" title="引用">❝</button>
          <button class="tb-btn" @click="insertHighlightBlock" title="插入高亮块">▧</button>
          <button class="tb-btn" @click="openParagraphSettings" title="段落设置">¶</button>
          <button class="tb-btn" @click="openFindReplace" title="查找和替换">⌕</button>
          <button class="tb-btn" @click="exec('undo')" title="撤销">↶</button>
          <button class="tb-btn" @click="toggleFormatPainter" :class="{ active: painterActive }" title="格式刷">🖌</button>
          <div class="tb-insert-wrap">
            <button class="tb-btn" @click="toggleInsertMenu" title="插入">⊕ 插入</button>
            <div v-if="showInsertMenu" class="insert-menu" @click.stop>
              <button @click="insertImage">图片</button>
              <button @click="insertVideo">视频</button>
              <button @click="insertShape">形状</button>
              <button @click="insertTable">表格</button>
              <button @click="insertLink">链接</button>
              <button @click="insertCodeBlock">代码块</button>
              <button @click="notSupported('公式')">公式</button>
              <button @click="openSymbolPicker">符号</button>
              <button @click="notSupported('批注')">批注</button>
              <button @click="exec('insertHorizontalRule'); showInsertMenu = false">分隔线</button>
              <button @click="notSupported('页眉页脚')">页眉页脚</button>
              <button @click="insertPageBreak">分隔符</button>
              <button @click="notSupported('脚注尾注')">脚注尾注</button>
              <button @click="notSupported('页码')">页码</button>
            </div>
          </div>
        </div>
        <div
          ref="contentRef"
          class="content-editor"
          contenteditable="true"
          @input="onContentInput"
          @mouseup="captureSelection"
          @keyup="captureSelection"
          data-placeholder="写下你的想法..."
        ></div>
      </div>

      <div class="color-section">
        <span class="color-label">颜色</span>
        <div class="color-grid">
          <div
            v-for="c in EXTENDED_NOTE_COLORS"
            :key="c"
            class="color-swatch"
            :class="{ selected: form.color === c }"
            :style="{ background: c }"
            @click="form.color = c"
          ></div>
        </div>
        <div class="custom-color">
          <span class="color-label">自定义</span>
          <el-input v-model="form.color" placeholder="#667eea" size="small" class="custom-color-input" />
        </div>
      </div>

      <div class="meta-row">
        <div class="meta-item">
          <span class="meta-label">分类</span>
          <el-select v-model="form.categoryId" placeholder="选择分类" class="category-select">
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            >
              <span class="category-option">
                <span class="category-option-icon">{{ cat.icon }}</span>
                <span class="category-option-name">{{ cat.name }}</span>
              </span>
            </el-option>
          </el-select>
        </div>
      </div>
    </div>

    <div v-if="showColorPicker" class="color-picker-popover" :style="pickerPosStyle" @click.stop>
      <div class="picker-colors">
        <button
          v-for="c in PICKER_COLORS"
          :key="c"
          class="picker-color"
          :style="{ background: c }"
          @click="applyPickerColor(c)"
        ></button>
      </div>
    </div>

    <div v-if="showFindReplace" class="find-replace-dialog" @click.stop>
      <div class="fr-row">
        <span class="fr-label">查找</span>
        <input v-model="findText" class="fr-input" placeholder="查找内容" />
      </div>
      <div class="fr-row">
        <span class="fr-label">替换</span>
        <input v-model="replaceText" class="fr-input" placeholder="替换为" />
      </div>
      <div class="fr-actions">
        <button class="fr-btn" @click="doFind">查找下一个</button>
        <button class="fr-btn" @click="doReplace">替换</button>
        <button class="fr-btn" @click="doReplaceAll">全部替换</button>
        <button class="fr-btn fr-close" @click="showFindReplace = false">关闭</button>
      </div>
    </div>

    <div v-if="showSymbolPicker" class="symbol-dialog" @click.stop>
      <div class="symbol-grid">
        <button
          v-for="s in SYMBOLS"
          :key="s"
          class="symbol-item"
          @click="insertSymbol(s)"
        >{{ s }}</button>
      </div>
      <div class="symbol-close">
        <button class="fr-btn fr-close" @click="showSymbolPicker = false">关闭</button>
      </div>
    </div>

    <div v-if="showTablePicker" class="table-picker" @click.stop>
      <div class="table-grid">
        <button
          v-for="n in 64"
          :key="n"
          class="table-cell"
          :class="{ active: tableHover === n }"
          @mouseenter="tableHover = n"
          @click="insertTableBySize(n)"
        ></button>
      </div>
      <div class="table-size-label">{{ tableHover ? `${Math.ceil(tableHover/8)} × ${tableHover - (Math.ceil(tableHover/8)-1)*8}` : '选择尺寸' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { EXTENDED_NOTE_COLORS, DEFAULT_NOTE_COLORS, type Note, type NoteCategory } from '../../stores/noteStore'

const props = defineProps<{
  visible: boolean
  note?: Note | null
  categories: NoteCategory[]
  defaultCategoryId?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'submit', data: { title: string; content: string; color: string; categoryId: string; pinned: boolean; id?: string }): void
}>()

const form = ref({
  title: '',
  content: '',
  color: DEFAULT_NOTE_COLORS[0],
  categoryId: 'personal',
  pinned: false,
})

const isEdit = ref(false)
const contentRef = ref<HTMLElement | null>(null)
const titleInputRef = ref<{ focus?: () => void; input?: { focus?: () => void } } | null>(null)

const PICKER_COLORS = [
  '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
  '#ff0000', '#ff6600', '#ff9900', '#ffcc00', '#ffff00', '#99cc00',
  '#33cc33', '#00cc66', '#00cccc', '#0099ff', '#0033ff', '#6600ff',
  '#cc00ff', '#ff00cc', '#ff0066', '#993300', '#663300', '#336600',
]

const SYMBOLS = [
  '×','÷','±','≈','≠','≤','≥','∞','√','∑','∏','∫','∂','∇','π','Σ','Ω','α','β','γ','δ','ε','ζ','η','θ','λ','μ','ν','ξ','ρ','σ','τ','φ','χ','ψ','ω',
  '℃','℉','°','‰','§','№','★','☆','◆','◇','○','●','△','▲','▽','▼','□','■','▷','▶','◁','◀','♠','♣','♥','♦','♪','♫','♬','✓','✗','✔','✘',
  '①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳',
  '⒈','⒉','⒊','⒋','⒌','⒍','⒎','⒏','⒐','⒑','⒒','⒓','⒔','⒕','⒖','⒗','⒘','⒙','⒚','⒛',
  '【','】','《','》','「','」','『','』','〔','〕','〈','〉','［','］','｛','｝','〖','〗',
  '…','—','－','～','｜','·','。','，','、','；','：','？','！','＆','＊','＠','＃','＄','％','＾',
]

watch(() => props.visible, (v) => {
  if (v) {
    if (props.note) {
      form.value = {
        title: props.note.title,
        content: '',
        color: props.note.color,
        categoryId: props.note.categoryId,
        pinned: props.note.pinned,
      }
      isEdit.value = true
      nextTick(() => setContentHtml(props.note!.content))
    } else {
      form.value = {
        title: '',
        content: '',
        color: DEFAULT_NOTE_COLORS[0],
        categoryId: props.defaultCategoryId && props.defaultCategoryId !== 'all' ? props.defaultCategoryId : (props.categories[0]?.id || 'personal'),
        pinned: false,
      }
      isEdit.value = false
      nextTick(() => setContentHtml(''))
    }
    nextTick(() => {
      const ref = titleInputRef.value as any
      if (ref?.focus) ref.focus()
      else if (ref?.input?.focus) ref.input.focus()
    })
  }
}, { immediate: true })

const setContentHtml = (content: string) => {
  if (!contentRef.value) return
  if (!content) {
    contentRef.value.innerHTML = ''
    return
  }
  if (content.includes('<') && content.includes('>')) {
    contentRef.value.innerHTML = content
  } else {
    contentRef.value.textContent = content
  }
}

const onContentInput = () => {
  if (contentRef.value) {
    form.value.content = contentRef.value.innerHTML
  }
}

const exec = (cmd: string, value?: string) => {
  contentRef.value?.focus()
  restoreSelection()
  document.execCommand(cmd, false, value)
  onContentInput()
}

const BLOCK_OPTIONS = [
  { value: 'P', label: '正文', style: { fontSize: '13px' } },
  { value: 'H1', label: '标题1', style: { fontSize: '20px', fontWeight: '700' } },
  { value: 'H2', label: '标题2', style: { fontSize: '18px', fontWeight: '700' } },
  { value: 'H3', label: '标题3', style: { fontSize: '16px', fontWeight: '700' } },
  { value: 'H4', label: '标题4', style: { fontSize: '15px', fontWeight: '700' } },
  { value: 'H5', label: '标题5', style: { fontSize: '14px', fontWeight: '700' } },
  { value: 'H6', label: '标题6', style: { fontSize: '13px', fontWeight: '700' } },
]
const showBlockMenu = ref(false)
const blockLabel = ref('正文')
const toggleBlockMenu = () => {
  showBlockMenu.value = !showBlockMenu.value
}
const applyBlockValue = (val: string) => {
  exec('formatBlock', val)
  const opt = BLOCK_OPTIONS.find(o => o.value === val)
  if (opt) blockLabel.value = opt.label
  showBlockMenu.value = false
}

const FALLBACK_FONTS = ['宋体', '黑体', '微软雅黑', '楷体', '仿宋', 'Arial', 'Times New Roman', 'Courier New']
const systemFonts = ref<string[]>([...FALLBACK_FONTS])
const loadSystemFonts = async () => {
  try {
    const qlf = (window as any).queryLocalFonts
    if (typeof qlf === 'function') {
      const fonts = await qlf()
      const names = [...new Set(fonts.map((f: any) => f.family))]
      systemFonts.value = names.sort((a, b) => a.localeCompare(b))
    }
  } catch {}
}

const applyFontName = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (val) exec('fontName', val)
  ;(e.target as HTMLSelectElement).value = ''
}

const applyFontSize = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (val) {
    contentRef.value?.focus()
    restoreSelection()
    document.execCommand('fontSize', false, '7')
    const fontElements = contentRef.value?.querySelectorAll('font[size="7"]')
    fontElements?.forEach(el => {
      const f = el as HTMLElement
      f.removeAttribute('size')
      f.style.fontSize = val + 'px'
    })
    onContentInput()
  }
  ;(e.target as HTMLSelectElement).value = ''
}

const applyAlign = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (val === 'left') exec('justifyLeft')
  else if (val === 'center') exec('justifyCenter')
  else if (val === 'right') exec('justifyRight')
  else if (val === 'justify') exec('justifyFull')
  ;(e.target as HTMLSelectElement).value = ''
}

const applyLineHeight = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (val && contentRef.value) {
    contentRef.value.style.lineHeight = val
    onContentInput()
  }
  ;(e.target as HTMLSelectElement).value = ''
}

const insertTodo = () => {
  exec('insertHTML', '<div><input type="checkbox" style="margin-right:6px" /> </div>')
}

const insertHighlightBlock = () => {
  exec('insertHTML', '<div style="background:#fff3a0;padding:8px 12px;border-radius:6px;margin:4px 0;">高亮内容</div>')
}

const insertCodeBlock = () => {
  exec('insertHTML', '<pre style="background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;color:#a8edea;font-family:monospace;margin:4px 0;">代码</pre>')
}

const insertPageBreak = () => {
  exec('insertHTML', '<hr style="border:none;border-top:2px dashed #667eea;margin:12px 0;" /><div style="text-align:center;color:var(--chalk-muted);font-size:12px;">— 分页 —</div>')
}

const insertImage = () => {
  showInsertMenu.value = false
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      exec('insertHTML', `<img src="${reader.result}" style="max-width:100%;border-radius:6px;margin:4px 0;" />`)
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

const insertVideo = () => {
  showInsertMenu.value = false
  const url = window.prompt('请输入视频地址（URL）')
  if (url) exec('insertHTML', `<video src="${url}" controls style="max-width:100%;border-radius:6px;margin:4px 0;"></video>`)
}

const insertShape = () => {
  showInsertMenu.value = false
  exec('insertHTML', '<div style="width:80px;height:80px;background:rgba(102,126,234,0.3);border:2px solid #667eea;border-radius:8px;display:inline-block;margin:4px;"></div>')
}

const insertLink = () => {
  showInsertMenu.value = false
  const url = window.prompt('请输入链接地址（URL）')
  if (url) exec('createLink', url)
}

const insertTable = () => {
  showInsertMenu.value = false
  showTablePicker.value = true
}

const insertTableBySize = (n: number) => {
  const rows = Math.ceil(n / 8)
  const cols = n - (rows - 1) * 8
  let html = '<table style="border-collapse:collapse;width:100%;margin:4px 0;">'
  for (let r = 0; r < rows; r++) {
    html += '<tr>'
    for (let c = 0; c < cols; c++) {
      html += '<td style="border:1px solid rgba(255,255,255,0.2);padding:6px;min-width:40px;">&nbsp;</td>'
    }
    html += '</tr>'
  }
  html += '</table>'
  exec('insertHTML', html)
  showTablePicker.value = false
  tableHover.value = 0
}

const notSupported = (name: string) => {
  showInsertMenu.value = false
  ElMessage.info(`「${name}」功能暂未支持`)
}

// 颜色选择器
const showColorPicker = ref(false)
const pickerTarget = ref<'foreColor' | 'hiliteColor'>('foreColor')
const pickerPos = ref({ top: 0, left: 0 })
const pickerPosStyle = ref({})
const lastFore = ref('#ffffff')
const lastHilite = ref('#fff3a0')

const openColorPicker = (target: 'foreColor' | 'hiliteColor') => {
  const sel = window.getSelection()
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    pickerPos.value = { top: rect.bottom + 4, left: rect.left }
  }
  pickerPosStyle.value = { top: pickerPos.value.top + 'px', left: pickerPos.value.left + 'px' }
  pickerTarget.value = target
  showColorPicker.value = true
}

const applyPickerColor = (c: string) => {
  exec(pickerTarget.value, c)
  if (pickerTarget.value === 'foreColor') lastFore.value = c
  else lastHilite.value = c
  showColorPicker.value = false
}

// 选区保存
let savedRange: Range | null = null
const captureSelection = () => {
  const sel = window.getSelection()
  if (sel && sel.rangeCount && !sel.isCollapsed) {
    savedRange = sel.getRangeAt(0).cloneRange()
  }
}
const restoreSelection = () => {
  if (savedRange) {
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange)
    }
  }
}

// 格式刷
const painterActive = ref(false)
let painterFormat: string | null = null
const toggleFormatPainter = () => {
  if (painterActive.value) {
    painterActive.value = false
    painterFormat = null
    return
  }
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    ElMessage.warning('请先选中要复制格式的文本')
    return
  }
  const range = sel.getRangeAt(0)
  const parent = range.commonAncestorContainer.parentElement
  if (parent) {
    painterFormat = parent.outerHTML.replace(/<[^>]+>[^<]*<[^>]+>/, '').match(/<[^>]+>/)?.[0] || null
    const clone = parent.cloneNode(false) as HTMLElement
    painterFormat = clone.outerHTML
  }
  painterActive.value = true
  ElMessage.info('格式刷已启用，选中文本后自动应用')
}

const closePainterOnClick = () => {
  if (painterActive.value && painterFormat) {
    const styleMatch = painterFormat.match(/style="([^"]*)"/)
    if (styleMatch) {
      document.execCommand('removeFormat')
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) {
        const range = sel.getRangeAt(0)
        const span = document.createElement('span')
        span.setAttribute('style', styleMatch[1])
        try {
          range.surroundContents(span)
        } catch {
          span.appendChild(range.extractContents())
          range.insertNode(span)
        }
        onContentInput()
      }
    }
    painterActive.value = false
    painterFormat = null
  }
}

// 查找替换
const showFindReplace = ref(false)
const findText = ref('')
const replaceText = ref('')
const openFindReplace = () => {
  showFindReplace.value = true
}
const doFind = () => {
  if (!findText.value || !contentRef.value) return
  const text = findText.value
  const sel = window.getSelection()
  let baseOffset = sel?.anchorOffset || 0
  const fullText = contentRef.value.innerText
  const idx = fullText.indexOf(text, baseOffset)
  const next = idx === -1 ? fullText.indexOf(text, 0) : idx
  if (next === -1) {
    ElMessage.info('未找到匹配内容')
    return
  }
  const range = document.createRange()
  const walker = document.createTreeWalker(contentRef.value, NodeFilter.SHOW_TEXT)
  let count = 0
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const len = node.textContent?.length || 0
    if (count + len > next) {
      const start = next - count
      range.setStart(node, Math.max(0, start))
      range.setEnd(node, Math.min(len, start + text.length))
      sel?.removeAllRanges()
      sel?.addRange(range)
      const r = range.getBoundingClientRect()
      contentRef.value.scrollTop = r.top - 200
      savedRange = range.cloneRange()
      break
    }
    count += len
  }
}
const doReplace = () => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    doFind()
    return
  }
  if (sel.toString() === findText.value) {
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(replaceText.value))
    onContentInput()
  }
  doFind()
}
const doReplaceAll = () => {
  if (!findText.value || !contentRef.value) return
  const text = contentRef.value.innerText
  if (!text.includes(findText.value)) {
    ElMessage.info('未找到匹配内容')
    return
  }
  const newText = text.split(findText.value).join(replaceText.value)
  contentRef.value.textContent = newText
  onContentInput()
  ElMessage.success('已全部替换')
}

// 符号
const showSymbolPicker = ref(false)
const openSymbolPicker = () => {
  showInsertMenu.value = false
  showSymbolPicker.value = true
}
const insertSymbol = (s: string) => {
  exec('insertHTML', s)
  showSymbolPicker.value = false
}

// 表格选择
const showTablePicker = ref(false)
const tableHover = ref(0)

// 段落设置
const openParagraphSettings = () => {
  ElMessage.info('段落设置：请使用行距和对齐工具调整段落格式')
}

// 插入菜单
const showInsertMenu = ref(false)
const toggleInsertMenu = () => {
  showInsertMenu.value = !showInsertMenu.value
}

const closeAllPopovers = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (showColorPicker.value && !target.closest('.color-picker-popover') && !target.closest('.color-btn')) {
    showColorPicker.value = false
  }
  if (showInsertMenu.value && !target.closest('.tb-insert-wrap')) {
    showInsertMenu.value = false
  }
  if (showBlockMenu.value && !target.closest('.tb-dropdown-wrap')) {
    showBlockMenu.value = false
  }
  if (showTablePicker.value && !target.closest('.table-picker') && !target.closest('.insert-menu')) {
    showTablePicker.value = false
  }
  if (painterActive.value && contentRef.value && target.closest('.content-editor')) {
    closePainterOnClick()
  }
}

onMounted(() => {
  document.addEventListener('click', closeAllPopovers)
  loadSystemFonts()
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeAllPopovers)
})

const handleCancel = () => {
  emit('update:visible', false)
}

const handleSubmit = () => {
  const title = form.value.title.trim()
  if (!title) {
    ElMessage.warning('请输入笔记标题')
    return
  }
  emit('submit', {
    title,
    content: form.value.content.trim(),
    color: form.value.color,
    categoryId: form.value.categoryId,
    pinned: form.value.pinned,
    id: props.note?.id,
  })
  emit('update:visible', false)
}
</script>

<style scoped>
.note-editor-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(15, 12, 41, 0.4);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 12px;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: transparent;
  color: var(--chalk-white-70);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.editor-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
  flex: 1;
  text-align: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.editor-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 16px;
  flex-shrink: 0;
}

.editor-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: thin;
}

.editor-body::-webkit-scrollbar {
  width: 6px;
}

.editor-body::-webkit-scrollbar-track {
  background: transparent;
}

.editor-body::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}

.editor-body:hover::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row.form-row-content {
  flex: 1;
  min-height: 0;
}

.field-label {
  font-size: 13px;
  color: var(--chalk-dim);
}

.form-row :deep(.el-input__wrapper),
.form-row :deep(.el-textarea__inner) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--chalk-white);
  box-shadow: none;
}

.form-row :deep(.el-input__inner) {
  color: var(--chalk-white);
}

.form-row :deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

.title-input :deep(.el-input__inner) {
  font-size: 15px;
  font-weight: 600;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  align-items: center;
}

.tb-select {
  height: 28px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: var(--chalk-white);
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

.tb-select option {
  background: #1e1c34;
  color: #fff;
}

.tb-dropdown-wrap {
  position: relative;
}

.tb-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 4px;
  min-width: 120px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.tb-dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--chalk-white);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.tb-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tb-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--chalk-white-85);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.tb-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.tb-btn.active {
  background: rgba(102, 126, 234, 0.35);
  border-color: rgba(102, 126, 234, 0.6);
}

.color-btn {
  position: relative;
  flex-direction: column;
  padding: 2px 6px;
}

.color-letter {
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.color-underline {
  width: 14px;
  height: 3px;
  border-radius: 2px;
  margin-top: 2px;
}

.tb-insert-wrap {
  position: relative;
}

.insert-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  padding: 4px;
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 50;
  min-width: 160px;
}

.insert-menu button {
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--chalk-white-85);
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  font-family: inherit;
}

.insert-menu button:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.content-editor {
  flex: 1;
  min-height: 0;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--chalk-white);
  font-size: 14px;
  line-height: 1.7;
  outline: none;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
}

.content-editor:empty::before {
  content: attr(data-placeholder);
  color: rgba(255, 255, 255, 0.4);
}

.content-editor :deep(blockquote) {
  border-left: 3px solid #667eea;
  padding-left: 10px;
  margin: 6px 0;
  color: var(--chalk-white-70);
}

.content-editor :deep(pre) {
  white-space: pre-wrap;
}

.content-editor :deep(table) {
  display: table;
}

.pin-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
}

.pin-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.pin-toggle.active {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
  color: var(--chalk-amber);
}

.pin-icon {
  width: 14px;
  height: 14px;
}

.color-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.color-label {
  font-size: 13px;
  color: var(--chalk-dim);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 24px);
  gap: 3px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  box-sizing: border-box;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.selected {
  border-color: #fff;
  transform: scale(1.15);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
}

.custom-color {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.custom-color-input {
  width: 70px;
}

.custom-color-input :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.custom-color-input :deep(.el-input__inner) {
  color: var(--chalk-white);
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-label {
  font-size: 13px;
  color: var(--chalk-dim);
  flex-shrink: 0;
}

.category-select {
  width: 100px;
}

.category-select :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: none;
}

.category-select :deep(.el-input__inner) {
  color: var(--chalk-white);
}

.category-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-option-icon {
  font-size: 14px;
}

.category-option-name {
  color: var(--chalk-white);
}

.capsule-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: transparent;
  color: var(--chalk-white-70);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
}

.capsule-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.capsule-btn .capsule-icon {
  width: 14px;
  height: 14px;
}

.submit-btn {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.4);
  color: #93c5fd;
}

.submit-btn:hover {
  background: rgba(102, 126, 234, 0.35);
  color: var(--chalk-white);
}

.color-picker-popover {
  position: fixed;
  z-index: 100;
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.picker-colors {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.picker-color {
  width: 22px;
  height: 22px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.picker-color:hover {
  transform: scale(1.15);
}

.find-replace-dialog,
.symbol-dialog,
.table-picker {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  min-width: 280px;
}

.fr-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.fr-label {
  font-size: 13px;
  color: var(--chalk-dim);
  width: 40px;
  flex-shrink: 0;
}

.fr-input {
  flex: 1;
  height: 30px;
  padding: 0 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: var(--chalk-white);
  font-size: 13px;
  outline: none;
}

.fr-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.fr-btn {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: var(--chalk-white-85);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
}

.fr-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.fr-close {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.symbol-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.symbol-item {
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--chalk-white);
  cursor: pointer;
  font-size: 16px;
  font-family: inherit;
}

.symbol-item:hover {
  background: rgba(102, 126, 234, 0.2);
}

.symbol-close {
  margin-top: 8px;
  text-align: right;
}

.table-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}

.table-cell {
  width: 18px;
  height: 18px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
  padding: 0;
}

.table-cell.active {
  background: rgba(102, 126, 234, 0.4);
  border-color: rgba(102, 126, 234, 0.6);
}

.table-size-label {
  margin-top: 6px;
  text-align: center;
  font-size: 12px;
  color: var(--chalk-dim);
}
</style>
