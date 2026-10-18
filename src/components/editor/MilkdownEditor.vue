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

    <!-- 媒体尺寸编辑浮层 -->
    <div
      v-if="mediaResize?.visible"
      class="media-resize-panel"
      :style="{ top: `${mediaResize.top}px`, left: `${mediaResize.left}px` }"
      @mousedown.prevent
    >
      <span class="media-resize-title">尺寸</span>
      <input v-model="mediaResize.width" type="number" min="0" max="4096" placeholder="宽" @keyup.enter="applyMediaResize">
      <span class="media-resize-sep">×</span>
      <input v-model="mediaResize.height" type="number" min="0" max="4096" placeholder="高" @keyup.enter="applyMediaResize">
      <button type="button" class="media-resize-btn" @click="applyMediaResize">应用</button>
      <button type="button" class="media-resize-btn ghost" @click="resetMediaResize">重置</button>
      <button type="button" class="media-resize-btn ghost" @click="closeMediaResize">关闭</button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Crepe } from '@milkdown/crepe'
import { replaceAll } from '@milkdown/kit/utils'
import { editorViewCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { TextSelection, NodeSelection } from '@milkdown/kit/prose/state'
import { wrapIn } from '@milkdown/kit/prose/commands'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import { useNoteStore } from '../../stores/noteStore'
import { logger } from '../../lib/logger'
import {
  WIKI_LINK_NODE,
  remarkWikiLink,
  wikiLinkSchema,
  wikiLinkInputRule,
  computeWikiSuggestion,
  insertWikiLink,
  type WikiSuggestion,
} from './wikiLink'
import { readMediaAsset } from '../../services/mediaAssets'
import { useTempNoteStore } from '../../stores/tempNoteStore'
import { storeMediaAsset } from '../../composables/useNoteMedia'
import type { SearchMatch } from '../../composables/useNoteSearch'
import { remarkMathSyntax, mathDelimitersToEditor, mathEditorToDelimiters } from './mathSyntax'
import {
  remarkTextStyle, textStyleStringify, highlightMark, textColorMark, underlineMark,
  superscriptMark, subscriptMark,
} from './textStyleMarks'
import { mathLiveInputPlugin } from './mathLiveInput'
import { renderCodePreview } from './codeLanguages'
import { registerLanguageDescriptions } from './codeGrammar'
import { findAnchorElement, anchorIdFromHref } from './blockAnchors'
import { codeBlockConfig as codeBlockConfigCtx } from '@milkdown/kit/component/code-block'
import {
  editorSearchPlugin,
  editorSearchPluginKey,
  buildSearchDecorations,
  SEARCH_HIT_CLASS,
  SEARCH_HIT_CURRENT_CLASS,
  type EditorSearchState,
} from './editorSearch'
// 图片尺寸后缀：`![alt](esd-local-media://xxx{w=300,h=200})`。
// Milkdown/Crepe 的图片块只认 `![alt](src)`（裸 <img> 会被解析成内联 html 节点、
// 渲染不出图片），因此尺寸以后缀形式持久化，由本文件在进出编辑器时剥离/还原：
//  - prepareMarkdown（进编辑器）：剥掉后缀得到干净 src，同时把尺寸记入 imageSizes；
//  - 渲染后（resolveMediaReferencesInDom）：按 imageSizes 把 width/height 写到 <img>；
//  - markdownUpdated（对外输出）：用 imageSizes 把后缀拼回 URL，保证存储带尺寸。

/** 「引用 → 尺寸」，进入编辑器时填充，输出时用于还原后缀 */
const imageSizes = new Map<string, { width?: number; height?: number }>()

/** 剥掉图片 URL 上的尺寸后缀，并把尺寸记录到 imageSizes */
function stripImageSizeSuffixes(md: string): string {
  imageSizes.clear()
  const stripped = (md || '').replace(
    /(!\[[^\]]*\]\()([^)\s]+?)\s*\{w=(\d*),h=(\d*)\}\)/g,
    (_full, prefix: string, url: string, width: string, height: string) => {
      const parsedWidth = width ? Number(width) : undefined
      const parsedHeight = height ? Number(height) : undefined
      imageSizes.set(url, {
        width: parsedWidth && parsedWidth > 0 ? parsedWidth : undefined,
        height: parsedHeight && parsedHeight > 0 ? parsedHeight : undefined,
      })
      return prefix + url + ')'
    },
  )
  return stripped
}

/** 按 imageSizes 把尺寸后缀拼回图片 URL（对外输出/存储前调用） */
function restoreImageSizeSuffixes(md: string): string {
  if (!imageSizes.size) return md
  return (md || '').replace(/(!\[[^\]]*\]\()([^)\s]+?)(\))/g, (full, prefix: string, url: string, suffix: string) => {
    const size = imageSizes.get(url)
    if (!size) return full
    const width = size.width ?? ''
    const height = size.height ?? ''
    if (!width && !height) return full
    return `${prefix}${url}{w=${width},h=${height}}${suffix}`
  })
}

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  /** 当前笔记 id：联想列表排除自身链接 */
  currentNoteId?: string
  /** 临时笔记 id：非空时把正文里的 `media/...` 相对引用按原 .md 同级目录解析 */
  tempNoteId?: string
}>(), {
  placeholder: '开始编写 Markdown 笔记...',
  currentNoteId: '',
  tempNoteId: '',
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

// 抹平尾部空行（沿用旧编辑器“无尾部换行”的输出约定），
// 并剥离旧版图片宽度语法 `{w:N}`（该语法已被 `{w=W,h=H}` 后缀取代，旧数据可能残留）。
// 注意：保留 `{w=W,h=H}` 尺寸后缀——它由 stripImageSizeSuffixes 在进入编辑器前剥离，
// 再由 restoreImageSizeSuffixes 在输出前拼回。
const normalize = (md: string): string =>
  (md || '')
    .replace(/!\[[^\]]*\]\([^)\s]+?\)\s*\{w:\d+\}/g, match => match.replace(/\s*\{w:\d+\}/, ''))
    .replace(/&#8203;|\u200b/gi, '')
    .replace(/\s+$/, '')

// 进编辑器前的准备：剥图片尺寸后缀、把 \(…\) / \[…\] 公式定界符转为 $…$。
//
// 历史包袱说明：这里曾对「**粗体** + CJK」注入 &#8203; 以图修复闭合识别，
// 但那个正则无法区分开/闭标记——它会把前一处粗体的**闭合** `**` 当成下一处
// 粗体的**开头**，把零宽字符插到错误位置，反而让第 2、3 处粗体解析失败
// （实测 micromark 对「中文**粗体**中文」本来就能正确解析）。
// 因此这里不再注入；normalize 仍会剥离旧数据中残留的零宽字符。
const prepareMarkdown = (md: string): string => mathDelimitersToEditor(stripImageSizeSuffixes(normalize(md)))

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

// 浏览器无法直接加载 esd-local-media:// 引用。正文与存储里一律保存引用，
// 编辑器渲染层（DOM）在节点出现后把 src 换成 data URL，因此：
//  - 对外输出的 markdown 始终只含引用，自动保存重复序列化不会复制媒体；
//  - 相同内容的文件在保存时由内容寻址复用同一资产，只保留一份。
// 尺寸不走 PM 节点（Milkdown 图片节点只有 src/alt），而是从正文的 <img> 属性
// 同步到 DOM，因此渲染尺寸与正文始终一致。
async function resolveMediaReferencesInDom(root: HTMLElement): Promise<void> {
  if (!root) return

  // 临时笔记：正文里的 media/xxx 是相对原 .md 同级 media 目录的路径，
  // 浏览器不能直接加载文件，需读盘转成 data URL。
  if (props.tempNoteId) {
    const tempStore = useTempNoteStore()
    const tempNodes = root.querySelectorAll<HTMLElement>(
      'img[src^="media/"], video[src^="media/"], audio[src^="media/"], img[src^="./media/"], video[src^="./media/"], audio[src^="./media/"]'
    )
    if (tempNodes.length) {
      const tempCache = new Map<string, string>()
      await Promise.all([...tempNodes].map(async node => {
        const src = node.getAttribute('src') || ''
        node.setAttribute('data-media-ref', src)
        const size = imageSizes.get(src)
        if (size?.width) node.setAttribute('width', String(size.width))
        else node.removeAttribute('width')
        if (size?.height) node.setAttribute('height', String(size.height))
        else node.removeAttribute('height')
        let dataUrl = tempCache.get(src)
        if (!dataUrl) {
          dataUrl = (await tempStore.resolveMedia(props.tempNoteId, src)) || ''
          tempCache.set(src, dataUrl)
        }
        if (dataUrl) node.setAttribute('src', dataUrl)
        else node.setAttribute('data-media-missing', 'true')
      }))
    }
  }

  const nodes = root.querySelectorAll<HTMLElement>('img[src^="esd-local-media://"], video[src^="esd-local-media://"], audio[src^="esd-local-media://"]')
  if (!nodes.length) return

  // 尺寸来自进入编辑器时记录下来的 imageSizes（引用 → width/height）
  const cache = new Map<string, string>()
  await Promise.all([...nodes].map(async node => {
    const src = node.getAttribute('src') || ''
    const match = /^esd-local-media:\/\/([a-z0-9_-]+)$/.exec(src)
    if (!match) return
    // 保留原始引用，供尺寸编辑反查 markdown 源
    node.setAttribute('data-media-ref', src)
    // 同步正文中记录的尺寸
    const size = imageSizes.get(src)
    if (size?.width) node.setAttribute('width', String(size.width))
    else node.removeAttribute('width')
    if (size?.height) node.setAttribute('height', String(size.height))
    else node.removeAttribute('height')

    let dataUrl = cache.get(src)
    if (!dataUrl) {
      dataUrl = await readMediaAsset('media:asset:' + match[1]) || ''
      cache.set(src, dataUrl)
    }
    if (dataUrl) node.setAttribute('src', dataUrl)
    else node.setAttribute('data-media-missing', 'true')
  }))
}

// Milkdown 内建图片上传：落库为内容寻址资产后返回 esd-local-media:// 引用，
// 避免 data URL 进入正文（否则每次自动保存都会重新序列化同一张大图）。
const uploadEditorImage = async (file: File): Promise<string> => {
  const dataUrl = await toDataUrl(file)
  const reference = await storeMediaAsset(dataUrl)
  if (!reference) throw new Error('不支持的图片格式')
  return reference
}
const createEditor = async () => {
  const root = crepeRootRef.value
  if (!root) return

  // 进入编辑器前剥掉尺寸后缀（ Cream 只认干净 src），
  // syncedValue 仍保留带后缀的形态，与对外输出保持一致。
  const initial = prepareMarkdown(props.modelValue)
  syncedValue = normalizeStored(restoreImageSizeSuffixes(initial))

  const instance = new Crepe({
    root,
    defaultValue: prepareMarkdown(initial),
    features: {
      // Latex 启用：行内 \(…\) 公式渲染 + 点击出现 CodeMirror 编辑气泡
      //（定界符适配见 mathSyntax.ts，Crepe 原生只认 $…$）
      [Crepe.Feature.Latex]: true,
      [Crepe.Feature.AI]: false,
      // 禁用编辑器内建浮动工具栏与行左侧块编辑按钮，由笔记页统一展示文本格式菜单。
      [Crepe.Feature.Toolbar]: false,
      [Crepe.Feature.BlockEdit]: false,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: props.placeholder, mode: 'doc' },
      [Crepe.Feature.ImageBlock]: {
        onUpload: uploadEditorImage,
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
        // 工具栏文案中文化：复制 / 编辑（预览态）/ 隐藏（源码态）
        copyText: '复制',
        previewToggleText: (previewOnlyMode: boolean) => (previewOnlyMode ? '编辑' : '隐藏'),
        previewLabel: '预览',
        previewLoading: '加载中…',
        // 默认只显示预览、收起源码（点「编辑」展开 CodeMirror）
        previewOnlyByDefault: true,
        // 所有语言的只读预览：highlight.js 着色（LaTeX 由 Crepe 的 katex 管线先行处理）
        renderPreview: (language: string, code: string) => renderCodePreview(language, code),
      },
    },
  })

  // 自建 wiki-link：必须在 create() 之前注册（remark 解析 → schema → 输入规则）
  instance.editor.use(remarkWikiLink).use(wikiLinkSchema).use(wikiLinkInputRule)

  // 编辑器内搜索：装饰器插件，同样要在 create() 前注册
  instance.editor.use(editorSearchPlugin)

  // 公式定界符适配：\(…\) / \[…\] ↔ inlineMath / math（Crepe Latex 原生只认 $）。
  // remarkMathSyntax 是完整 remark 插件（micromark 扩展 + from/toMarkdown），
  // 直接以 RemarkPluginRaw 形式注册；$…$ 由 Crepe 自带的 remark-math 识别，
  // 序列化时统一改写为 \( \)，存储格式单一。
  instance.editor.use(remarkMathSyntax)

  // 行内公式「输入即渲染」：敲完 \(…\) 立即转为公式节点（PM appendTransaction）
  instance.editor.use(mathLiveInputPlugin)

  // 高亮 / 文字颜色 / 下划线 / 上下标：自定义 mark + remark 双向桥接（行内 HTML ⇄ PM mark）
  instance.editor
    .use(textStyleStringify)
    .use(remarkTextStyle)
    .use(highlightMark)
    .use(textColorMark)
    .use(underlineMark)
    .use(superscriptMark)
    .use(subscriptMark)

  // 必须在 create() 之前注册监听
  // markdownUpdated 收到的是 Cream 序列化结果（图片 URL 已剥掉尺寸后缀），
  // 这里把后缀拼回去，并把 $…$ 公式定界符还原为 \(…\)，
  // 保证对外输出与存储的正文始终是 \( \) 格式。
  instance.on((api) => {
    api.markdownUpdated((_ctx, markdown) => {
      const next = normalizeStored(restoreImageSizeSuffixes(markdown))
      if (next === syncedValue) return
      syncedValue = next
      emit('update:modelValue', next)
      emit('input', next)
    })
  })

  crepe = instance
  await instance.create()
  ready = true

  // 载入即规范化：`syncedValue` 已是「存储形态」（公式定界符 \( \)、\[ \]），
  // 但父组件里的正文可能还是旧形态（例如早期版本落盘的 `$$` 块，
  // 或把块级公式压成单行后保存的损坏文本）。这里把规范形态回写父组件，
  // 让「源码模式」看到的就是真实存储内容，并由自动保存把规范化落盘。
  const raw = props.modelValue || ''
  const hasMathDelimiters = raw.includes('\\(') || raw.includes('\\[') || raw.includes('$$')
  if (hasMathDelimiters) {
    const canonical = normalizeStored(restoreImageSizeSuffixes(crepe?.getMarkdown() || ''))
    if (canonical && canonical !== normalize(raw)) {
      syncedValue = canonical
      emit('update:modelValue', canonical)
      emit('input', canonical)
    }
  }

  // 渲染层解析媒体引用：把 DOM 里的 esd-local-media:// src 换成 data URL
  void resolveMediaReferencesInDom(crepeRootRef.value as HTMLElement)

  // 取 ProseMirror 视图并包装 dispatch：每次事务后重算 [[ 联想状态
  instance.editor.action((ctx) => {
    view = ctx.get(editorViewCtx)
  })
  if (view) {
    const rawDispatch = view.dispatch.bind(view)
    view.dispatch = (tr: Parameters<EditorView['dispatch']>[0]) => {
      rawDispatch(tr)
      updateWikiSuggestion()
      /*
        文档变化后必须**同步**重建引用折叠装饰器：
          · 装饰器里存的是绝对 PM 位置，输入会让位置漂移；
          · prosemirror-view 每次事务都用 innerDeco.eq() 与缓存比较，
            位置不一致就会重建整个 docView（进而所有引用块闪一次）。
        因此这里立刻重建，让装饰器与文档对齐，PM 走增量更新路径。
        （旧的 120ms 防抖会让装饰器在防抖窗口内保持陈旧，反而每次都整篇重绘。）
        这里只改装饰器、不动文档，不会触发新事务，不存在递归。
      */
      if (tr.docChanged) scheduleRebuildQuoteDecorations(true)
    }
  }
  updateWikiSuggestion()
  refreshResolvedLinks()
  // 首次渲染后建立引用折叠按钮
  scheduleRebuildQuoteDecorations()

  // 把编辑器自带的语言列表（Crepe 默认注入的 @codemirror/language-data 全集，约 150 种）
  // 交给语法审查模块，使插入弹窗的语言与代码容器工具栏下拉完全一致。
  // 不新增依赖：这些 LanguageDescription 对象已随 Crepe 打包，这里只是读出来复用。
  try {
    instance.editor.action((ctx) => {
      const config = ctx.get(codeBlockConfigCtx.key) as unknown as { languages?: unknown[] }
      const list = config?.languages
      if (Array.isArray(list) && list.length) registerLanguageDescriptions(list)
    })
  } catch (e) {
    logger.warn('[编辑器] 读取代码块语言列表失败，弹窗将使用内置目录', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

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

// ====== 引用块「收起/展开」======
/**
 * 引用块折叠。
 *
 * ⚠️ 必须用 **ProseMirror widget 装饰器**，绝不能往 blockquote 里 insertBefore 一个按钮。
 *
 * 踩过的坑（真实故障：用户报告「打开这篇笔记直接卡住」）：
 *  最初把 <button class="esd-quote-toggle"> 直接插进 blockquote 的第一个子节点。
 *  blockquote 的子节点属于 **ProseMirror 的文档内容**，往里插 DOM 会让 PM 认为
 *  文档结构变了 → 触发重渲染 → MutationObserver 再次回调 → 又插一次……
 *  形成无限循环。引用越多越严重：实测该笔记有 204 个引用行（68KB），打开即卡死。
 *
 *  同时，插入的按钮还污染了 textContent（多出「收起」二字），
 *  让 blockAnchors 的文本哈希对不上——这正是「点链接跳不过去」的根因。
 *
 * widget 装饰器由 PM 渲染层绘制，不进入文档、不触发 markdownUpdated、
 * 不污染 textContent，也不怕「重渲染把 DOM class 抹掉」。
 */
const QUOTE_COLLAPSE_CLASS = 'esd-quote-collapsed'
/**
 * 标记「收起时要保留的那个内容块」（引用块的第一个子块）。
 *
 * 为什么需要显式标记，而不是用 CSS 的 :first-of-type / :first-child：
 *   - :first-of-type 是**按标签名**判断的。引用内容为 `<p>说明</p><ul>…</ul>` 时，
 *     <ul> 恰好是「第一个 ul」→ 它也会被当成 first-of-type 而**不被隐藏**，
 *     于是列表照样展开显示（这正是用户报告的「含列表时收起不正常」）。
 *   - :first-child 又会被 ProseMirror 的收起按钮（widget，恰好也是直接子元素）抢占。
 *  因此在装饰器里给第一个内容块打上 .esd-quote-first，CSS 只认这个 class，
 *  与标签种类、按钮位置都无关。
 */
const QUOTE_FIRST_CLASS = 'esd-quote-first'
/**
 * 用户要求「默认收起所有的引用区域」。
 *
 * 语义取舍（重要）：不能简单地把每个 blockquote 都塞进 collapsedQuotes ——
 * 因为**新增**的引用块也会被默认收起，用户写一句引用后只能看到第一行，
 * 会以为内容丢了。因此采用「默认收起 + 显式展开」的模型：
 *   - 默认：所有引用都收起（用户要求）；
 *   - 用户点开某个引用 → 记入 expandedQuotes，该块保持展开；
 *   - 换笔记 / 内容重建 → 集合清空，回到「全部默认收起」。
 * 这样「默认收起」与「手动展开不被重置」两个诉求都能满足。
 *
 * ⚠️ 键必须是**引用块序号**，不能是 PM 绝对位置。
 * 用户报告：「每输入/删除一个字符（即每次触发自动保存），光标后面所有引用块
 * 都会快速完成一次从展开到收起的动作」。
 * 根因：旧实现 `Set<number>` 存的是 blockquote 的 **doc 位置 pos**。
 * 在光标之前插入/删除字符时，其**后面所有块的位置都会漂移**（±1 或更多），
 * 于是 `expandedQuotes.has(pos)` 对旧键返回 false → 已展开的块被误判为收起。
 * 位置每变一次就误判一次，表现为「展开→收起」反复跳变。
 * 序号（该块在文档中是第几个引用块）在纯文本增删时**不会变化**，
 * 因此用它作键即可让展开状态稳定，彻底消除跳变。
 */
const expandedQuotes = ref<Set<number>>(new Set())
/** 引用块折叠装饰器（与搜索/锚点高亮合并下发） */
let quoteDecorationSet: DecorationSet | null = null

/** 生成展开/收起按钮的 DOM（widget 内容，不属于文档） */
const createQuoteToggleDom = (index: number, collapsed: boolean): HTMLElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'esd-quote-toggle'
  // 记录的是**引用块序号**（不是 PM 位置）：位置会随输入漂移，序号不会。
  button.dataset.quoteIndex = String(index)
  // 标记为「编辑器注入的 widget」：blockAnchors 取块文本时会剔除带此标记的节点，
  // 避免按钮文字污染锚点哈希（否则点链接跳不过去）。
  button.setAttribute('data-esd-widget', 'quote-toggle')
  button.contentEditable = 'false'
  // 用户要求「只显示图标不显示文本」：按钮内不放任何文字，
  // 箭头由 CSS ::before 绘制（▾ 展开态 / ▸ 收起态），
  // 含义说明放进 title，悬停即可看到。
  button.textContent = ''
  button.title = collapsed ? '展开引用（显示全部内容）' : '收起引用（只显示第一行）'
  button.setAttribute('aria-label', collapsed ? '展开引用' : '收起引用')
  button.setAttribute('aria-expanded', String(!collapsed))
  return button
}

/**
 * 收集文档里所有 blockquote 的「序号 → 位置」映射。
 * 序号 = 该块在文档中是第几个引用块（从 0 开始，按文档顺序）。
 * 序号用作展开状态的键：纯文本增删不会改变它（位置会变）。
 */
const collectQuotePositions = (): Array<{ index: number; pos: number }> => {
  const list: Array<{ index: number; pos: number }> = []
  if (!view) return list
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') return true
    list.push({ index: list.length, pos })
    // 不深入 blockquote 内部：嵌套引用极少见，递归还会让同一 pos 重复出装饰
    return false
  })
  return list
}

/**
 * 重建引用块装饰器集合。
 * 每个 blockquote 画两个装饰：
 *  1) node 装饰加 class —— 收起时用于隐藏非首行内容；
 *  2) widget 装饰放「收起/展开」按钮。
 *
 * 展开状态以**序号**为键（见 expandedQuotes 注释）：
 * 输入文字时块的位置会漂移，但序号不变，因此已展开的块不会被误判为收起。
 */
const rebuildQuoteDecorations = () => {
  if (!view) return
  const doc = view.state.doc
  const decorations: Decoration[] = []

  collectQuotePositions().forEach(({ index, pos }) => {
    const node = doc.nodeAt(pos)
    if (!node) return
    // 默认收起：不在 expandedQuotes 里就是收起态
    const collapsed = !expandedQuotes.value.has(index)
    if (collapsed) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: QUOTE_COLLAPSE_CLASS }))
    }
    // 标记第一个「真实内容块」：收起时只保留它（其余隐藏）。
    // 位置 = blockquote 内容起点 pos+1；跳过 widget（按钮在 pos+1 处，side:-1，
    // 不属于文档节点，因此这里取到的是第一个文档子节点）。
    const firstChild = node.firstChild
    if (firstChild) {
      decorations.push(
        Decoration.node(pos + 1, pos + 1 + firstChild.nodeSize, { class: QUOTE_FIRST_CLASS }),
      )
    }
    decorations.push(
      Decoration.widget(pos + 1, () => createQuoteToggleDom(index, collapsed), {
        side: -1,
        key: `quote-toggle-${index}-${collapsed ? 1 : 0}`,
      }),
    )
  })

  quoteDecorationSet = decorations.length ? DecorationSet.create(doc, decorations) : null
  pushDecorations()
}

/** 点击「收起/展开」按钮（widget 内的按钮） */
const onQuoteToggleClick = (button: HTMLElement) => {
  const raw = button.dataset.quoteIndex
  const index = raw === undefined ? NaN : Number(raw)
  if (!Number.isFinite(index)) return
  // 默认收起模型：记录的是「被显式展开」的块；取消展开即回到默认收起
  const next = new Set(expandedQuotes.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  expandedQuotes.value = next
  // 重建装饰器即可：PM 会重绘按钮文案与收起 class
  rebuildQuoteDecorations()
}

/**
 * 重建引用装饰器（同步执行，必须紧跟文档变化）。
 *
 * ⚠️ 用户报告：「每输入/删除一个字符（即每次触发自动保存），光标后面所有
 * 引用块都会快速完成一次从展开到收起的动作」。
 *
 * 这个缺陷有**两层**原因，我用真实的 prosemirror-view 1.42.4 验证过：
 *
 * 【第一层】展开状态按**绝对 PM 位置**存储（旧实现）
 *   expandedQuotes 存的是 blockquote 的 doc 位置。在光标之前增删字符时，
 *   其后面所有块的位置都会漂移（实测 0,7,14,21 → 0,8,15,22），
 *   于是 `expandedQuotes.has(旧位置)` 返回 false → 已展开的块被误判为收起。
 *   → 已改为按**引用块序号**作键（序号不随纯文本增删变化）。
 *
 * 【第二层，更根本】装饰器位置**没有跟随文档更新**
 *   prosemirror-view 每次事务都会（updateStateInner）：
 *     L5566  viewDecorations(this)              ← 重新读 decorations prop
 *     L5569  docView.matchesNode(doc, outerDeco, innerDeco)
 *     L1373  innerDeco.eq(this.innerDeco)       ← 与内部缓存比较
 *   若我们下发的 DecorationSet 位置与当前文档不一致，eq() 返回 false
 *   （已实测：位置漂移后 `decoBefore.eq(decoAfter) === false`）→
 *   updateDoc = true → **整个 docView 被 destroy 并重建**（L5592-5593）→
 *   所有引用块连同按钮、收起样式一起重绘 → 看上去就是「整篇闪一下」。
 *
 * 因此**不能**靠「结构没变就跳过重建」来优化——跳过会让装饰器位置更陈旧，
 * eq() 必然失败，反而每次都整篇重绘。正确做法是：
 *   每次 docChanged 都**同步**重建（位置立刻与文档对齐，eq() 得以相等，
 *   PM 只做增量更新、不重建 docView），同时靠序号键让收起状态稳定。
 *
 * 关于防抖的取舍：原先用 120ms 防抖，但防抖期间装饰器位置是**陈旧的**，
 * 期间每个事务都会判定 eq() 失败 → 整篇重绘。改为同步重建后，
 * 装饰器始终最新，PM 走增量路径；代价是每次敲键遍历一次引用块
 * （本机 204 个引用块，遍历成本远低于一次整篇 DOM 重建）。
 */
let quoteRebuildTimer: number | null = null

/**
 * 计划重建。
 *
 * `immediate` 为 true 时立刻重建（用于 docChanged：必须与文档同步对齐）；
 * 其余情况（如初始化、延迟补建）仍走 120ms 防抖，合并短时间内的重复调用。
 */
const scheduleRebuildQuoteDecorations = (immediate = false) => {
  if (immediate) {
    if (quoteRebuildTimer !== null) {
      window.clearTimeout(quoteRebuildTimer)
      quoteRebuildTimer = null
    }
    rebuildQuoteDecorations()
    return
  }
  if (quoteRebuildTimer !== null) window.clearTimeout(quoteRebuildTimer)
  quoteRebuildTimer = window.setTimeout(() => {
    quoteRebuildTimer = null
    rebuildQuoteDecorations()
  }, 120)
}

const onRootClick = (e: MouseEvent) => {
  // 引用块「收起/展开」按钮：优先级最高，避免被下方的 wiki/链接/媒体分支吃掉
  const quoteToggle = (e.target as HTMLElement | null)?.closest?.('.esd-quote-toggle') as HTMLElement | null
  if (quoteToggle && crepeRootRef.value?.contains(quoteToggle)) {
    e.preventDefault()
    e.stopPropagation()
    onQuoteToggleClick(quoteToggle)
    return
  }
  // 语言锁定兜底：CSS 已把 .language-button 设为 pointer-events:none，
  // 但键盘（Enter/Space）与程序化点击仍可能触发，这里在捕获阶段一律吞掉，
  // 保证插入后语言不可再改（改语言会让已通过的语法审查与预览失效）。
  const langHit = (e.target as HTMLElement | null)?.closest?.('.language-button, .language-picker, .expand-icon')
  if (langHit && crepeRootRef.value?.contains(langHit as Node)) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  // 代码块工具栏「删除」按钮（由 syncCodeBlockDeleteButtons 注入）
  const deleteHit = (e.target as HTMLElement | null)?.closest?.('.esd-code-delete-button')
  if (deleteHit && crepeRootRef.value?.contains(deleteHit as Node)) {
    e.preventDefault()
    e.stopPropagation()
    const block = (deleteHit as HTMLElement).closest('.milkdown-code-block') as HTMLElement | null
    if (block) removeCodeBlock(block)
    return
  }
  const el = (e.target as HTMLElement).closest?.(`span[data-type="${WIKI_LINK_NODE}"]`) as HTMLElement | null
  if (el) {
    e.preventDefault()
    e.stopPropagation()
    const target = (el.dataset.target || '').trim()
    if (target) emit('open-wiki-link', { target })
    return
  }
  // 点击普通链接：锚点链接（本笔记内的块）滚动跳转，http/https 用系统浏览器打开
  const anchor = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
  if (anchor && crepeRootRef.value?.contains(anchor)) {
    e.preventDefault()
    e.stopPropagation()
    const href = anchor.getAttribute('href') || ''
    // 块锚点：#esd-ref-xxxx → 跳到对应引用块/标题并高亮
    const anchorId = anchorIdFromHref(href)
    if (anchorId) {
      // 链接的可见文字（如「结构分析」）作为回退匹配依据：
      // 旧链接的哈希对应的是建链当时的文字，目标文字被编辑后就失效了。
      scrollToBlockAnchor(anchorId, (anchor.textContent || '').trim())
      return
    }
    if (/^https?:\/\//i.test(href)) {
      // Electron：主进程 shell.openExternal 调系统浏览器；浏览器预览：新标签页
      const api = (window as any).electronAPI
      if (api?.openExternal) void api.openExternal(href)
      else window.open(href, '_blank', 'noopener')
    }
    return
  }
  // 点击媒体节点：打开尺寸编辑浮层
  const mediaEl = (e.target as HTMLElement).closest?.('img, video, audio') as HTMLElement | null
  if (mediaEl && crepeRootRef.value?.contains(mediaEl)) {
    e.preventDefault()
    e.stopPropagation()
    openMediaResize(mediaEl)
  }
}

// ====== 媒体尺寸编辑 ======
// DOM 解析引用时会把原始 esd-local-media:// 引用写到 data-media-ref 属性上，
// 因此这里能稳定反查到该节点对应的 markdown 源，改尺寸后可精确回写。
const mediaResize = ref<{
  visible: boolean
  kind: 'img' | 'video' | 'audio'
  width: string
  height: string
  reference: string
  top: number
  left: number
} | null>(null)

let mediaResizeAnchor: HTMLElement | null = null

function openMediaResize(node: HTMLElement) {
  const reference = node.getAttribute('data-media-ref') || ''
  if (!reference || !crepe?.getMarkdown) return
  const rect = node.getBoundingClientRect()
  const hostRect = rootRef.value?.getBoundingClientRect()
  mediaResizeAnchor = node
  mediaResize.value = {
    visible: true,
    kind: node.tagName.toLowerCase() as 'img' | 'video' | 'audio',
    width: node.getAttribute('width') || '',
    height: node.getAttribute('height') || '',
    reference,
    top: Math.max(8, rect.bottom - (hostRect?.top || 0) + 6),
    left: Math.max(8, rect.left - (hostRect?.left || 0)),
  }
}

const closeMediaResize = () => {
  mediaResize.value = null
  mediaResizeAnchor = null
}

/**
 * 应用尺寸：同步回 markdown。
 * 图片：有尺寸写 `<img alt src width height>`，无尺寸写回 `![alt](src)`；
 * 音视频：改 HTML 标签上的 width/height 属性。
 */
/**
 * 应用尺寸：同步回 markdown。
 * 图片：改 `![alt](ref){w=W,h=H}` 后缀（Cream 只认这个语法）；
 * 音视频：改 HTML 标签上的 width/height 属性。
 */
function applyMediaResize() {
  const state = mediaResize.value
  if (!state || !mediaResizeAnchor) return
  const width = Number.parseInt(state.width, 10)
  const height = Number.parseInt(state.height, 10)
  const hasWidth = Number.isFinite(width) && width > 0
  const hasHeight = Number.isFinite(height) && height > 0

  const reference = state.reference
  const escapedReference = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Cream 序列化结果里图片是不带后缀的，音视频是 HTML 标签
  const current = normalize(crepe?.getMarkdown() || '')
  const altMatch = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedReference}\\)`).exec(current)
  const alt = altMatch ? altMatch[1] : ''

  let nextSource: string
  if (state.kind === 'img') {
    const suffix = hasWidth || hasHeight ? `{w=${hasWidth ? width : ''},h=${hasHeight ? height : ''}}` : ''
    nextSource = `![${alt}](${reference}${suffix})`
  } else {
    const sizeAttributes = `${hasWidth ? ` width="${width}"` : ''}${hasHeight ? ` height="${height}"` : ''}`
    nextSource = `<${state.kind} controls${state.kind === 'video' ? ' preload="metadata"' : ''}${sizeAttributes} src="${reference}"></${state.kind}>`
  }

  // 替换目标：图片用 markdown 语法（可带旧后缀），音视频用 HTML 标签
  const imagePattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapedReference}(?:\\{w=\\d*,h=\\d*\\})?\\)`)
  const htmlPattern = new RegExp(`<(?:img|video|audio)\\b[^>]*src="${escapedReference}"[^>]*>`, 'i')

  let next = current
  if (state.kind === 'img' && imagePattern.test(current)) next = current.replace(imagePattern, nextSource)
  else if (htmlPattern.test(current)) next = current.replace(htmlPattern, nextSource)
  else if (imagePattern.test(current)) next = current.replace(imagePattern, nextSource)
  else { closeMediaResize(); return }

  // 更新尺寸表并重新进入编辑器：剥后缀 → replaceAll → 输出时拼回
  if (hasWidth || hasHeight) {
    imageSizes.set(reference, {
      width: hasWidth ? width : undefined,
      height: hasHeight ? height : undefined,
    })
  } else {
    imageSizes.delete(reference)
  }

  syncedValue = normalizeStored(restoreImageSizeSuffixes(next))
  crepe?.editor.action(replaceAll(prepareMarkdown(next), true))
  emit('update:modelValue', syncedValue)
  emit('input', syncedValue)
  void resolveMediaReferencesInDom(crepeRootRef.value as HTMLElement)
  closeMediaResize()
}

/** 清除尺寸，恢复默认比例 */
function resetMediaResize() {
  const state = mediaResize.value
  if (!state) return
  state.width = ''
  state.height = ''
  applyMediaResize()
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
    '.md-editor .milkdown-list-item-block > .list-item { gap: 4px !important; align-items: flex-start !important; }',
    '.md-editor .milkdown-list-item-block li { gap: 4px !important; align-items: flex-start !important; }',
    '.md-editor .milkdown-list-item-block li .label-wrapper { display: flex !important; align-items: center !important; justify-content: center !important; align-self: flex-start !important; flex: 0 0 16px !important; width: 16px !important; min-width: 16px !important; height: 1.6em !important; transform: translateY(0.22em) !important; }',
    '.md-editor .milkdown-list-item-block li .label-wrapper .label { display: flex !important; align-items: center !important; justify-content: center !important; width: 16px !important; height: 100% !important; padding: 0 !important; }',
    '.md-editor .ProseMirror ol, .md-editor .ProseMirror ul { padding-left: 40px !important; margin-left: 0 !important; }',
    '.md-editor .ProseMirror li { margin-left: 0 !important; }',
    '.md-editor .ProseMirror ul li::marker { color: #e9d5ff !important; }',
    '.md-editor .ProseMirror ul li::before { color: #e9d5ff !important; }',
    // 媒体块：图片/视频/音频默认独占一行、左对齐，宽度可由 width 属性覆盖
    '.md-editor .ProseMirror img { display: block; max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }',
    '.md-editor .ProseMirror video { display: block; max-width: 100%; border-radius: 8px; margin: 8px 0; background: rgba(0,0,0,.3); }',
    '.md-editor .ProseMirror audio { display: block; width: 100%; max-width: 420px; margin: 8px 0; }',
    '.md-editor .ProseMirror figure { margin: 8px 0; }',
    '.md-editor .ProseMirror figcaption { color: rgba(245,243,255,.55); font-size: 12px; text-align: center; margin-top: 4px; }',
  ].join('\n')
  document.head.appendChild(listStyleEl)
}
const removeListStyle = () => { listStyleEl?.remove(); listStyleEl = null }

onMounted(() => {
  injectListStyle()
  injectSearchStyle()
  createEditor()
  // 键盘导航（捕获阶段，先于 ProseMirror 处理）与链接点击跳转
  rootRef.value?.addEventListener('keydown', onRootKeydown, true)
  rootRef.value?.addEventListener('click', onRootClick, true)
  // wiki-link chip 由 ProseMirror 增删重建，用 MutationObserver 维护已解析标记；
  // 媒体节点同样会被重建，这里一并刷新 DOM 里的引用解析
  if (crepeRootRef.value) {
    domObserver = new MutationObserver(() => {
      refreshResolvedLinks()
      syncCodeBlockDeleteButtons()
      void resolveMediaReferencesInDom(crepeRootRef.value as HTMLElement)
    })
    domObserver.observe(crepeRootRef.value, { childList: true, subtree: true })
  }
})

onBeforeUnmount(async () => {
  removeListStyle()
  ready = false
  rootRef.value?.removeEventListener('keydown', onRootKeydown, true)
  rootRef.value?.removeEventListener('click', onRootClick, true)
  domObserver?.disconnect()
  domObserver = null
  view = null
  await crepe?.destroy()
  crepe = null
})

// 外部切换笔记 / 日记时重建全文（含空值重置）
// 比较与存储都用「存储形态」（\( \) 公式定界符 + 尺寸后缀），
// 进入编辑器则用 prepareMarkdown 做全部 inbound 转换。
// normalizeStored：对外形态的统一归一化（含序列化双转义折叠），
// 所有 syncedValue 赋值与 modelValue 比较都必须经过它，
// 否则「双反斜杠 vs 单反斜杠」的形态差会让防抖失效、textarea 显示错误格式。
const normalizeStored = (md: string): string => normalize(mathEditorToDelimiters(md))

watch(() => props.modelValue, (value) => {
  const next = normalizeStored(value)
  if (!ready || next === syncedValue) return
  syncedValue = next
  // 换笔记时清掉引用展开状态：键是 PM 位置，跨文档沿用会张冠李戴。
  // 由于默认收起，清空后新笔记的所有引用回到「全部收起」。
  expandedQuotes.value = new Set()
  crepe?.editor.action(replaceAll(prepareMarkdown(next), true))
  void resolveMediaReferencesInDom(crepeRootRef.value as HTMLElement)
  // 内容替换后文档结构已变，重建引用折叠装饰器（按钮随装饰器一起出现）
  window.setTimeout(() => rebuildQuoteDecorations(), 60)
})

const getValue = (): string =>
  ready
    ? normalizeStored(restoreImageSizeSuffixes(crepe!.getMarkdown()))
    : normalize(props.modelValue)

/**
 * 编辑器内部形态的 markdown（公式为 $…$）。
 * 用于需要 markdown 形态的场景（如媒体插入偏移估算）；
 * 搜索不再使用它，见 getSearchMarkdown。
 */
const getEditorMarkdown = (): string =>
  ready ? normalize(restoreImageSizeSuffixes(crepe!.getMarkdown())) : ''

/**
 * 编辑器内搜索的匹配基准：**PM 文档摊平后的纯文本**。
 *
 * 为什么不用 markdown：markdown 里含 `**`、反引号、`$…$`、链接语法等，
 * 而 PM 里对应的是纯文本（行内代码只有文字、公式是 atom），两者逐字符对不上，
 * 只要有行内语法就会整块映射失败（实测「匹配 1 / 可高亮 0」）。
 * 直接在 PM 上取文本，并记录每个字符对应的 PM 位置，匹配即位置，零错位。
 */
const getSearchMarkdown = (): string => (ready ? buildFlatDocText().text : '')

/**
 * 引用块切换：光标/选区在 blockquote 内 → 取出（拆包）；否则包进（wrapIn）。
 * 取出方向不用 prosemirror-commands 的 lift（对深层选区常返回 false，实测），
 * 改为直接构造 transaction：把 blockquote 的子内容整体移到其外层位置。
 * 直接使用 PM 当前 state.selection（selectionchange 已同步 DOM 选区）。
 * @returns 'wrapped' | 'lifted' | 'none'
 */
const toggleBlockquote = (): 'wrapped' | 'lifted' | 'none' => {
  if (!view) return 'none'
  view.focus()
  const { state } = view
  const blockquoteType = state.schema.nodes['blockquote']
  if (!blockquoteType) return 'none'
  const { $from } = state.selection
  let quoteDepth = -1
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === blockquoteType) { quoteDepth = d; break }
  }

  const tr = state.tr
  if (quoteDepth > 0) {
    // 取出：用 blockquote 的子内容整体替换 blockquote 节点本身。
    // （只删内部内容会留下空 blockquote 节点，引用块依然存在。）
    const quoteFrom = $from.before(quoteDepth)
    const quoteTo = $from.after(quoteDepth)
    // 直接取 blockquote 的子内容 Fragment（Node.content），整体替换掉 blockquote 节点
    const quoteContent = $from.node(quoteDepth).content
    const caretOffset = Math.max(0, $from.pos - (quoteFrom + 1))
    tr.replaceWith(quoteFrom, quoteTo, quoteContent)
    const caretPos = Math.min(quoteFrom + caretOffset, tr.doc.content.size)
    tr.setSelection((state.selection.constructor as any).near(tr.doc.resolve(caretPos)))
    view.dispatch(tr.scrollIntoView())
    return 'lifted'
  }

  const wrapped = wrapIn(blockquoteType)(state, view.dispatch)
  return wrapped ? 'wrapped' : 'none'
}

/**
 * 设置当前光标/选区所在块的标题级别（0 = 正文）。
 *
 * 为什么用 PM 事务而不是 document.execCommand('formatBlock')：
 *  与删除线/下划线同样的教训 —— execCommand 产生的 DOM 变更不进入 PM 文档模型，
 *  在 ProseMirror 里不可靠（尤其「取消标题」方向）。这里直接改块类型，
 *  既生效也能正确往返保存成 markdown。
 *
 * @returns 是否真的改变了块类型
 */
const setHeadingLevel = (level: number): boolean => {
  if (!view) return false
  const { state } = view
  const headingType = state.schema.nodes['heading']
  const paragraphType = state.schema.nodes['paragraph']
  const targetType = level > 0 ? headingType : paragraphType
  if (!targetType) return false

  const { from, to, $from } = state.selection
  const tr = state.tr
  // 覆盖选区涉及的**所有**块（多段选中时逐块设置）
  const seen: number[] = []
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isBlock || node.isLeaf) return undefined
    if (node.type !== headingType && node.type !== paragraphType) return undefined
    if (seen.includes(pos)) return undefined
    seen.push(pos)
    return undefined
  })
  // 若选区为空（光标），nodesBetween 不会命中，改为处理光标所在块
  if (!seen.length) {
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d)
      if (node.type === headingType || node.type === paragraphType) {
        seen.push($from.before(d))
        break
      }
    }
  }
  if (!seen.length) return false

  // 从后往前改，避免位置位移
  for (const pos of seen.sort((a, b) => b - a)) {
    const node = tr.doc.nodeAt(pos)
    if (!node || (node.type !== headingType && node.type !== paragraphType)) continue
    const attrs = level > 0 ? { level } : null
    tr.setNodeMarkup(pos, targetType, attrs)
  }
  if (!tr.docChanged) return false
  view.dispatch(tr)
  view.focus()
  return true
}

/**
 * 切换无序 / 有序列表。
 *
 * 同样用 PM 命令而非 execCommand('insertUnorderedList')：
 * execCommand 在 PM 里不可靠，且「取消列表」方向常常无效。
 *
 * @returns 是否真的改变了结构
 */
const toggleList = (ordered: boolean): boolean => {
  if (!view) return false
  const { state } = view
  const listType = state.schema.nodes[ordered ? 'ordered_list' : 'bullet_list']
  const itemType = state.schema.nodes['list_item']
  if (!listType || !itemType) return false

  const { $from } = state.selection
  // 已在该类型列表内 → 取消（把列表项内容提升为普通块）
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type !== listType) continue
    const listFrom = $from.before(d)
    const listTo = $from.after(d)
    const tr = state.tr
    // 取列表各项的**内容**，逐项还原为段落
    const blocks: any[] = []
    node.forEach(child => {
      if (child.type === itemType) {
        child.forEach(grand => blocks.push(grand))
      } else {
        blocks.push(child)
      }
    })
    tr.replaceWith(listFrom, listTo, blocks.length ? blocks : [state.schema.nodes['paragraph'].create()])
    view.dispatch(tr.scrollIntoView())
    view.focus()
    return true
  }

  // 不在列表内 → 包一层列表
  const wrapped = wrapIn(listType)(state, view.dispatch)
  if (wrapped) view.focus()
  return wrapped
}

/** 富文本选区设置（给选区相关操作复用） */
const setRichSelection = (from: number, to: number): boolean => {
  if (!view) return false
  const max = view.state.doc.content.size
  const s = Math.max(0, Math.min(from, max))
  const e = Math.max(s, Math.min(to, max))
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, s, e))
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

/**
 * 该 mark 是否存在于当前 schema。
 *
 * 用途：快捷键的能力探针（检测「键绑了但动作用不了」）。
 * 为什么需要它：删除线曾经绑到 Ctrl+Shift+X 且能正确派发，
 * 但实现走了 document.execCommand（PM 里无效），表现为「按了没反应」。
 * 探针通过检查 schema 是否有对应 mark，能在检测阶段就发现这类静默失效。
 */
function hasMarkType(name: string): boolean {
  if (!view) return false
  return !!view.state.schema.marks[name]
}

/**
 * 行内代码开关（富文本）。
 * 与 toggleStrikeMark 同样的两个要点：
 *  1) 必须走 PM 事务加 mark，不能用 execCommand('insertHTML','<code>')；
 *  2) 优先用 DOM Range 换算位置（view.posAtDOM），规避 state.selection 未同步。
 * @param range 可选的 DOM 选区（来自调用方捕获的 active.range）
 */
const toggleInlineCodeMark = (range?: Range | null): boolean => {
  if (!view) return false
  const markType = view.state.schema.marks['inlineCode']
  if (!markType) return false

  let from = -1
  let to = -1
  const effectiveRange = range ?? (typeof window !== 'undefined' ? window.getSelection()?.getRangeAt?.(0) ?? null : null)
  if (effectiveRange) {
    try {
      from = view.posAtDOM(effectiveRange.startContainer, effectiveRange.startOffset)
      to = view.posAtDOM(effectiveRange.endContainer, effectiveRange.endOffset)
    } catch {
      from = -1
      to = -1
    }
  }
  if (from < 0 || to < 0 || from === to) {
    const sel = view.state.selection
    if (sel.empty) return false
    from = sel.from
    to = sel.to
  }
  if (from > to) [from, to] = [to, from]
  if (from === to) return false

  const { doc } = view.state
  // 选区整体已带 inlineCode → 取消；否则统一加上
  let allCoded = true
  doc.nodesBetween(from, to, (node) => {
    if (node.isText && !markType.isInSet(node.marks)) allCoded = false
    return undefined
  })

  const tr = view.state.tr
  if (allCoded) tr.removeMark(from, to, markType)
  else tr.addMark(from, to, markType.create())
  view.dispatch(tr.scrollIntoView())
  return true
}

/**
 * 删除线开关（富文本）。
 *
 * ⚠️ 这是「删除线快捷键按了没反应」的根因修复，分两层：
 *
 * 1) 不能用 document.execCommand('insertHTML','<del>…</del>')。
 *    PM 接管编辑行为，execCommand 产生的 DOM 变更不进 PM 文档模型
 *    （与下划线当初的教训相同）。Milkdown 内置 strike_through mark
 *    （parseDOM 认 <del> 与 text-decoration:line-through），直接 toggle 该 mark 即可。
 *
 * 2) **不能只依赖 view.state.selection**。
 *    菜单栏/快捷键触发前会用 DOM 选区做「恢复选区」操作，PM 的 state.selection
 *    此时可能尚未同步（PM 通过 selectionchange 异步跟进），于是读到空选区
 *    → 直接 return false → 表现为「按了没反应」。
 *    高亮/文字颜色之所以能正常工作，是因为它们走 applyTextStyleMarkViaRange，
 *    用 view.posAtDOM(range.startContainer, …) **从 DOM 直接换算位置**，
 *    绕开了 state.selection 的同步时机问题。
 *    因此这里改为优先用传入的 DOM Range 换算（与高亮同一条路径），
 *    没有 Range 时才退回 state.selection。
 *
 * @param range 可选的 DOM 选区（来自调用方捕获的 active.range）
 */
const toggleStrikeMark = (range?: Range | null): boolean => {
  if (!view) return false
  const markType = view.state.schema.marks['strike_through']
  if (!markType) return false

  // 位置来源优先级（与高亮同一条已证可用的路径）：
  //  1) 调用方捕获的 DOM Range —— 最可靠，直接避开 state.selection 的同步时机问题；
  //  2) 当前 DOM 选区（若调用方没传 Range）；
  //  3) PM 的 state.selection 兜底。
  let from = -1
  let to = -1
  const effectiveRange = range ?? (typeof window !== 'undefined' ? window.getSelection()?.getRangeAt?.(0) ?? null : null)
  if (effectiveRange) {
    try {
      from = view.posAtDOM(effectiveRange.startContainer, effectiveRange.startOffset)
      to = view.posAtDOM(effectiveRange.endContainer, effectiveRange.endOffset)
    } catch {
      from = -1
      to = -1
    }
  }
  if (from < 0 || to < 0 || from === to) {
    const sel = view.state.selection
    if (sel.empty) return false
    from = sel.from
    to = sel.to
  }
  if (from > to) [from, to] = [to, from]
  if (from === to) return false

  const { doc } = view.state
  // 选区整体已带删除线 → 取消；否则统一加上（与加粗等格式的切换语义一致）。
  // 注意：这里**不要求选区里必须有文本节点**——只要位置有效就下发事务，
  // 否则「选中了文字但 nodesBetween 没遍历到 text」会误判失败（返回 false）。
  let allStruck = true
  doc.nodesBetween(from, to, (node) => {
    if (node.isText && !markType.isInSet(node.marks)) allStruck = false
    return undefined
  })

  const tr = view.state.tr
  if (allStruck) tr.removeMark(from, to, markType)
  else tr.addMark(from, to, markType.create())
  view.dispatch(tr.scrollIntoView())
  // 只要成功下发了事务就返回 true：是否真的改变了内容由 PM 决定，
  // 但「没生效」不再被误报成失败（避免冲突检测出现假阳性）。
  return true
}

/**
 * 在当前选区施加/移除高亮或文字颜色 mark。
 * @param kind 'highlight' | 'textColor'
 * @param color 颜色值；传 null 表示移除该 mark
 * @returns 是否成功（选区为空或 mark 不存在时返回 false）
 */
const applyTextStyleMark = (kind: 'highlight' | 'textColor', color: string | null): boolean => {
  if (!view) return false
  const markName = kind === 'highlight' ? 'esdHighlight' : 'esdTextColor'
  const markType = view.state.schema.marks[markName]
  if (!markType) return false
  const { from, to, empty } = view.state.selection
  if (empty) return false
  const tr = view.state.tr
  if (color === null) {
    tr.removeMark(from, to, markType)
  } else {
    tr.removeMark(from, to, markType)
    tr.addMark(from, to, markType.create({ color }))
  }
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

/**
 * 通用「无属性行内标记」开关：下划线 / 上标 / 下标共用。
 *
 * 为什么统一走 PM mark、不用 execCommand：
 *   Milkdown 默认 schema 里没有 u / sup / sub 的 mark，execCommand 插进来的
 *   <u>/<sup>/<sub> 不属于 schema，会被解析丢弃或原样回吐，样式不生效
 *   且无法往返保存（下划线当初就是这个坑，上下标同理）。
 *
 * @param markName schema 里的 mark 名
 * @param range 调用方捕获的 DOM Range（优先用，规避 state.selection 同步时机问题）
 */
const toggleMarkByName = (markName: string, range?: Range | null): boolean => {
  if (!view) return false
  const markType = view.state.schema.marks[markName]
  if (!markType) return false

  // 位置来源优先级与高亮/删除线一致：
  //   1) 调用方传入的 Range（最可靠）
  //   2) 当前 DOM 选区
  //   3) PM state.selection
  let from = -1
  let to = -1
  const effectiveRange = range
    ?? (typeof window !== 'undefined' ? window.getSelection()?.getRangeAt?.(0) ?? null : null)
  if (effectiveRange) {
    try {
      from = view.posAtDOM(effectiveRange.startContainer, effectiveRange.startOffset)
      to = view.posAtDOM(effectiveRange.endContainer, effectiveRange.endOffset)
    } catch {
      from = -1
      to = -1
    }
  }
  if (from < 0 || to < 0 || from === to) {
    const sel = view.state.selection
    if (sel.empty) return false
    from = sel.from
    to = sel.to
  }
  if (from > to) [from, to] = [to, from]
  if (from === to) return false

  const { doc } = view.state
  let allHave = true
  doc.nodesBetween(from, to, (node) => {
    if (node.isText && !markType.isInSet(node.marks)) allHave = false
    return undefined
  })
  const tr = view.state.tr
  if (allHave) tr.removeMark(from, to, markType)
  else tr.addMark(from, to, markType.create())
  view.dispatch(tr.scrollIntoView())
  return true
}

/**
 * 下划线开关（富文本）。
 * 用自定义 esdUnderline mark 切换，而不是 document.execCommand('underline')。
 */
const toggleUnderlineMark = (range?: Range | null): boolean => toggleMarkByName('esdUnderline', range)

/** 上标开关（富文本）：`<sup>` ↔ esdSuperscript mark */
const toggleSuperscriptMark = (range?: Range | null): boolean => toggleMarkByName('esdSuperscript', range)

/** 下标开关（富文本）：`<sub>` ↔ esdSubscript mark */
const toggleSubscriptMark = (range?: Range | null): boolean => toggleMarkByName('esdSubscript', range)

/** 当前选区/光标是否带下划线（菜单栏高亮态） */
const isUnderlineActive = (): boolean => {
  if (!view) return false
  const markType = view.state.schema.marks['esdUnderline']
  if (!markType) return false
  const { from, to, empty, $from } = view.state.selection
  if (empty) return !!markType.isInSet(view.state.storedMarks || $from.marks())
  const { doc } = view.state
  let has = false
  doc.nodesBetween(from, to, (node) => {
    if (node.isText && markType.isInSet(node.marks)) has = true
    return undefined
  })
  return has
}

/**
 * 视图装饰器的单一来源：搜索高亮 + 块锚点跳转高亮都在这里合并下发。
 *
 * 为什么要合并：`view.setProps({ decorations })` 是**整份覆盖**的，
 * 搜索高亮与锚点高亮各自 setProps 会把对方抹掉。因此两者只更新自己的
 * 片段，再由 pushDecorations() 统一合并后下发。
 */
let searchDecorationSet: DecorationSet | null = null
let anchorDecorationSet: DecorationSet | null = null

const pushDecorations = () => {
  if (!view) return
  const merged = mergeDecorationSets(view.state.doc, searchDecorationSet, anchorDecorationSet, quoteDecorationSet)
  view.setProps({ decorations: () => merged })
}

/** 合并多个装饰器集合（PM 的 DecorationSet 支持 .add 叠加） */
function mergeDecorationSets(doc: Parameters<typeof DecorationSet.create>[0], ...sets: Array<DecorationSet | null>): DecorationSet | null {
  let merged: DecorationSet | null = null
  for (const set of sets) {
    if (!set) continue
    merged = merged ? merged.add(doc, set.find()) : set
  }
  return merged
}

/**
 * 块锚点跳转后的短暂高亮。
 *
 * 为什么用 node 装饰器而不是给 DOM 加 class：
 *  实测直接 `el.classList.add(...)` 会被 ProseMirror 的下一次重绘抹掉
 *  （约 200ms 后 class 就没了，因为滚动/选区变化会触发节点视图重建）。
 *  装饰器由 PM 渲染层持有，不写入 doc、不影响自动保存，且能稳定存活；
 *  到期后清除即可。
 */
let anchorFlashTimer: number | null = null

const applyAnchorFlash = (pos: number, nodeSize: number) => {
  if (!view) return
  const size = view.state.doc.content.size
  const from = Math.max(0, Math.min(pos, size))
  const to = Math.max(from, Math.min(from + nodeSize, size))
  if (from >= to) return
  const decoration = Decoration.node(from, to, { class: 'esd-anchor-flash' })
  anchorDecorationSet = DecorationSet.create(view.state.doc, [decoration])
  pushDecorations()
  if (anchorFlashTimer !== null) window.clearTimeout(anchorFlashTimer)
  anchorFlashTimer = window.setTimeout(() => {
    anchorFlashTimer = null
    anchorDecorationSet = null
    pushDecorations()
  }, 1600)
}

/**
 * 滚动到块锚点（引用块/标题）并短暂高亮，让用户看清跳到了哪里。
 */
/**
 * 若某个 PM 位置处在「已收起的引用块」内，则把它展开。
 *
 * 为什么需要（用户报告两个问题都源于此）：
 *  1) 「搜索/替换跳到引用块里的内容，跳转失败」——引用默认收起后，
 *     目标文字被 `display:none` / `overflow:hidden` 藏起来了，
 *     浏览器无法把**不可见元素**滚动到视口内（getBoundingClientRect 为 0 或极小），
 *     于是看起来「没跳过去」；替换同理（对隐藏文本操作后用户看不到变化）。
 *  2) 「链接跳转到引用块又出问题了」——同上：目标块被收起，
 *     scrollIntoView 对隐藏内容无效，锚点高亮也看不见。
 *
 * 解决办法：跳转前先展开包含目标的引用块，再滚动。
 * @returns 是否发生了展开（调用方据此决定是否等待一帧再滚动）
 */
const expandQuoteAtPos = (pos: number): boolean => {
  if (!view) return false
  const $pos = view.state.doc.resolve(Math.max(0, Math.min(pos, view.state.doc.content.size)))
  // 向上查找所属的 blockquote
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.type.name !== 'blockquote') continue
    const start = $pos.before(d)
    // 展开状态以**序号**为键：把该块的位置换算成「第几个引用块」
    const index = collectQuotePositions().find(q => q.pos === start)?.index
    if (index === undefined) return false
    if (expandedQuotes.value.has(index)) return false
    const next = new Set(expandedQuotes.value)
    next.add(index)
    expandedQuotes.value = next
    rebuildQuoteDecorations()
    return true
  }
  return false
}

/**
 * 把某个 DOM 元素所属的引用块展开（供锚点跳转使用）。
 * @returns 是否发生了展开
 */
const expandQuoteForElement = (el: HTMLElement): boolean => {
  if (!view) return false
  try {
    // +1 进入元素内部，避免落在 blockquote 边界之外
    const pos = view.posAtDOM(el, 0) + 1
    return expandQuoteAtPos(pos)
  } catch {
    return false
  }
}

const scrollToBlockAnchor = (anchorId: string, fallbackText?: string): boolean => {
  const root = crepeRootRef.value
  if (!view || !root) return false
  /*
    两级定位：先精确哈希；若目标文字在建链接后已被编辑过（旧哈希永久失效），
    用链接的可见文字做前缀回退。详见 blockAnchors.findAnchorElement 的注释。
  */
  const target = findAnchorElement(root, anchorId, fallbackText)
  if (!target) return false
  /*
    收起态下目标是隐藏的 → 浏览器无法滚动到它（用户报告「链接跳转又出问题」）。
    因此先展开包含目标的引用块，等一帧让 DOM 完成重排后再滚动。
  */
  if (expandQuoteForElement(target)) {
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  } else {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  /*
    高亮目标块。
    ⚠️ 必须**进入块内部**再取范围（用 posAtDOM 得到的是块边界的 doc 层位置，
    此时 resolve() 的 depth=0、parent 是整篇 doc，before(0) 会直接抛错
    「There is no position before the top-level node」——
    这正是「链接跳转到引用块」高亮失效/跳转异常的原因）。
    正确做法：pos+1 进入块内，向上找块级祖先，用它 before(d) 与 nodeSize 定范围。
  */
  try {
    const pos = view.posAtDOM(target, 0) + 1
    const $pos = view.state.doc.resolve(Math.max(0, Math.min(pos, view.state.doc.content.size)))
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d)
      if (node.type.name === 'blockquote' || /^h[1-6]$/.test(node.type.name)) {
        applyAnchorFlash($pos.before(d), node.nodeSize)
        break
      }
    }
  } catch {
    /* 定位失败时仍保证滚动已发生 */
  }
  return true
}

/**
 * 在指定 PM 位置插入链接（不依赖 DOM Range，供对话框确认时使用）。
 * - from === to：光标处插入文字并加链接 mark
 * - from !== to：给选中文本加链接 mark（保留原文字）
 */
/**
 * 在指定区间插入 wiki 链接 `[[目标名]]`（用于「链接到其它笔记」）。
 * 与插入普通链接不同：wiki 链接是独立节点，由 remark 插件解析，
 * 点击时走 open-wiki-link 事件跳转。
 */
const insertWikiLinkAtPositions = (from: number, to: number, target: string): boolean => {
  if (!view) return false
  const nodeType = view.state.schema.nodes[WIKI_LINK_NODE]
  if (!nodeType) return false
  const size = view.state.doc.content.size
  const start = Math.max(0, Math.min(from, size))
  const end = Math.max(start, Math.min(to, size))
  const name = String(target || '').trim()
  if (!name) return false
  const tr = view.state.tr
  const node = nodeType.create({ target: name })
  if (start === end) {
    tr.insert(start, node)
    tr.setSelection(TextSelection.create(tr.doc, start + node.nodeSize))
  } else {
    tr.replaceWith(start, end, node)
    tr.setSelection(TextSelection.create(tr.doc, start + node.nodeSize))
  }
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

const insertLinkAtPositions = (from: number, to: number, url: string, text?: string): boolean => {
  if (!view) return false
  const linkType = view.state.schema.marks['link']
  if (!linkType) return false
  const size = view.state.doc.content.size
  const start = Math.max(0, Math.min(from, size))
  const end = Math.max(start, Math.min(to, size))
  const href = String(url || '').trim()
  if (!href) return false
  const tr = view.state.tr
  if (start === end) {
    const label = String(text || '').trim() || href
    tr.insertText(label, start, end)
    tr.addMark(start, start + label.length, linkType.create({ href, title: null }))
    tr.setSelection(TextSelection.create(tr.doc, start + label.length))
  } else {
    tr.addMark(start, end, linkType.create({ href, title: null }))
    tr.setSelection(TextSelection.create(tr.doc, end))
  }
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

/**
 * 把「块节点」精确插入到光标处：段落中间时把当前段切成「前段 + 块 + 后段」。
 * 不能用 replaceSelectionWith / 开放切片——闭合切片无法把块节点塞进文本块，
 * PM 会直接拒绝（表现为块被顶到段落后 / 文末）。
 */
function insertBlockNode(node: import('@milkdown/kit/prose/model').Node, $from: { parent: import('@milkdown/kit/prose/model').Node & { isTextblock?: boolean }; parentOffset: number; depth: number; before: (d: number) => number; after: (d: number) => number }): boolean {
  if (!view) return false
  const { state } = view

  // 1) 光标在空段落里：整段替换为该块
  if ($from.parent.isTextblock && $from.parent.content.size === 0) {
    const blockStart = $from.before($from.depth)
    const blockEnd = $from.after($from.depth)
    const tr = state.tr.replaceWith(blockStart, blockEnd, node)
    tr.setSelection(NodeSelection.create(tr.doc, blockStart))
    view.dispatch(tr.scrollIntoView())
    view.focus()
    return true
  }

  // 2) 段落中间：切成 前段 + 块 + 后段
  if ($from.parent.isTextblock) {
    const blockNode = $from.parent
    const offset = $from.parentOffset
    const blockStart = $from.before($from.depth)
    const blockEnd = $from.after($from.depth)
    const prefix = blockNode.type.create(blockNode.attrs, blockNode.content.cut(0, offset))
    const suffix = blockNode.type.create(blockNode.attrs, blockNode.content.cut(offset))
    const children = []
    if (prefix.content.size > 0) children.push(prefix)
    children.push(node)
    if (suffix.content.size > 0) children.push(suffix)

    const tr = state.tr
    tr.replaceWith(blockStart, blockEnd, children)
    const nodeStart = blockStart + (prefix.content.size > 0 ? prefix.nodeSize : 0)
    tr.setSelection(NodeSelection.create(tr.doc, nodeStart))
    view.dispatch(tr.scrollIntoView())
    view.focus()
    return true
  }

  // 3) 兜底：插到光标所在节点之后
  const after = $from.after($from.depth)
  const tr = state.tr.insert(after, node)
  tr.setSelection(NodeSelection.create(tr.doc, after))
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

/**
 * 行内代码：有选区则给选区加 inlineCode mark；无选区则在光标插入带 mark 的文字。
 * 走 PM 事务，落点严格在光标处，可撤销。
 */
const insertInlineCodeAtCursor = (text: string): boolean => {
  if (!view || !ready) return false
  const value = String(text || '')
  if (!value.trim()) return false
  const { state } = view
  const codeMark = state.schema.marks['inlineCode']
  if (!codeMark) return false
  const { from, to } = state.selection
  try {
    const tr = state.tr
    if (from === to) {
      tr.insertText(value, from)
      tr.addMark(from, from + value.length, codeMark.create())
      tr.setSelection(TextSelection.create(tr.doc, from + value.length))
    } else {
      // 有选区：替换选区文本并加 mark
      tr.insertText(value, from, to)
      tr.addMark(from, from + value.length, codeMark.create())
      tr.setSelection(TextSelection.create(tr.doc, from + value.length))
    }
    view.dispatch(tr.scrollIntoView())
    view.focus()
    return true
  } catch (error) {
    logger.error('[编辑器] 插入行内代码失败', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

/**
 * 块级代码：插入 code_block(language) 节点，落点在光标处（段落会被就地拆开）。
 * language 为 Crepe/CodeMirror 认可的语言名（如 JavaScript / LaTeX）。
 */
const insertCodeBlockAtCursor = (language: string, code: string): boolean => {
  if (!view || !ready) return false
  const value = String(code || '')
  if (!value.trim()) return false
  const { state } = view
  const blockType = state.schema.nodes['code_block']
  if (!blockType) return false
  const { $from } = state.selection
  try {
    const node = blockType.create({ language: language || 'Plain Text' }, state.schema.text(value))
    return insertBlockNode(node, $from)
  } catch (error) {
    logger.error('[编辑器] 插入代码块失败', { language, error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

/**
 * 删除整个代码块容器（工具栏「删除」按钮）。
 * 走 PM 事务删除节点，因此可 Ctrl+Z 撤销；
 * 不能直接 DOM remove——那会让文档与视图不一致。
 */
const removeCodeBlock = (element: HTMLElement): boolean => {
  if (!view) return false
  const block = element.closest('.milkdown-code-block') as HTMLElement | null
  if (!block) return false
  try {
    const start = view.posAtDOM(block, 0)
    const $start = view.state.doc.resolve(start)
    const depth = $start.depth
    const from = $start.before(depth)
    const to = $start.after(depth)
    const tr = view.state.tr.delete(from, to)
    // 删完把光标落到删除处所在段落，避免选区悬空
    const target = Math.min(from, tr.doc.content.size)
    tr.setSelection(TextSelection.near(tr.doc.resolve(target)))
    view.dispatch(tr.scrollIntoView())
    view.focus()
    return true
  } catch (error) {
    logger.error('[编辑器] 删除代码块失败', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

/** 删除按钮的 SVG（垃圾桶），与 Crepe 自带图标同尺寸 */
const CODE_DELETE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>'

/**
 * 给每个代码块工具栏注入「删除」按钮。
 * 代码块节点视图由 Crepe 自行渲染/重建，无法改它的模板，
 * 因此在 DOM 变化后补齐按钮；带标记避免重复注入。
 */
const syncCodeBlockDeleteButtons = () => {
  const root = crepeRootRef.value
  if (!root) return
  const groups = root.querySelectorAll<HTMLElement>('.milkdown-code-block .tools-button-group')
  groups.forEach(group => {
    if (group.querySelector('.esd-code-delete-button')) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'esd-code-delete-button'
    button.title = '删除整个代码块'
    button.innerHTML = `${CODE_DELETE_ICON}<span>删除</span>`
    group.appendChild(button)
  })
}

/**
 * 在当前光标/选区处插入一段 markdown 文本（走 PM 事务，可撤销）。
 * 用于「插入链接」等在无选中文本时的落点插入。
 */
const insertSnippetAtCursor = (snippet: string): boolean => {
  if (!view || !snippet) return false
  const { from, to } = view.state.selection
  const tr = view.state.tr.insertText(snippet, from, to)
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

/** 在当前光标处插入真正的链接（文字 + link mark，可撤销） */
const insertLinkAtCursor = (text: string, url: string): boolean => {
  if (!view || !text) return false
  const linkType = view.state.schema.marks['link']
  const { from, to } = view.state.selection
  const tr = view.state.tr.insertText(text, from, to)
  if (linkType) {
    tr.addMark(from, from + text.length, linkType.create({ href: url, title: null }))
  }
  tr.setSelection(TextSelection.create(tr.doc, from + text.length))
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

/** 用 DOM Range 指定的选中文本创建链接 mark（避免旧偏移把范围包错） */
const insertLinkAtRange = (range: Range, url: string): boolean => {
  if (!view || !range) return false
  const linkType = view.state.schema.marks['link']
  if (!linkType) return false
  let from = -1
  let to = -1
  try {
    from = view.posAtDOM(range.startContainer, range.startOffset)
    to = view.posAtDOM(range.endContainer, range.endOffset)
  } catch {
    return false
  }
  if (from > to) [from, to] = [to, from]
  if (from === to) return false
  const tr = view.state.tr.addMark(from, to, linkType.create({ href: url, title: null }))
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

/** 当前光标/选区处的格式状态（供菜单栏按钮高亮） */
export interface ActiveFormats {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
  link: boolean
  highlight: boolean
  textColor: boolean
  superscript: boolean
  subscript: boolean
  heading: number
  quote: boolean
  bullet: boolean
  ordered: boolean
}

const EMPTY_FORMATS: ActiveFormats = {
  bold: false, italic: false, underline: false, strike: false, code: false, link: false,
  highlight: false, textColor: false, superscript: false, subscript: false,
  heading: 0, quote: false, bullet: false, ordered: false,
}

/**
 * 读取当前选区的格式状态。
 * 空选区看光标处的 storedMarks/marks；非空选区看区间内是否整体带该 mark。
 */
const getActiveFormats = (): ActiveFormats => {
  if (!view) return { ...EMPTY_FORMATS }
  const { state } = view
  const { from, to, empty, $from } = state.selection
  const hasMark = (name: string): boolean => {
    const type = state.schema.marks[name]
    if (!type) return false
    if (empty) return !!type.isInSet(state.storedMarks || $from.marks())
    return state.doc.rangeHasMark(from, to, type)
  }
  let heading = 0
  let quote = false
  let bullet = false
  let ordered = false
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'heading') heading = Number(node.attrs.level) || 0
    else if (node.type.name === 'blockquote') quote = true
    else if (node.type.name === 'bullet_list') bullet = true
    else if (node.type.name === 'ordered_list') ordered = true
  }
  return {
    bold: hasMark('strong'),
    italic: hasMark('emphasis'),
    underline: hasMark('esdUnderline'),
    strike: hasMark('strike_through'),
    code: hasMark('inlineCode'),
    link: hasMark('link'),
    highlight: hasMark('esdHighlight'),
    textColor: hasMark('esdTextColor'),
    superscript: hasMark('esdSuperscript'),
    subscript: hasMark('esdSubscript'),
    heading,
    quote,
    bullet,
    ordered,
  }
}

/**
 * 读取选区（或光标处）某个文字样式 mark 的颜色值。
 * 用于「色块单击即应用」判断：当前颜色与将应用的颜色一致时改为清除。
 * 返回 null 表示该 mark 不存在或无法确定颜色。
 */
const getTextStyleColor = (kind: 'highlight' | 'textColor'): string | null => {
  if (!view) return null
  const markName = kind === 'highlight' ? 'esdHighlight' : 'esdTextColor'
  const type = view.state.schema.marks[markName]
  if (!type) return null
  const { from, to, empty, $from } = view.state.selection
  let mark: import('@milkdown/kit/prose/model').Mark | null = null
  if (empty) {
    mark = type.isInSet(view.state.storedMarks || $from.marks()) ?? null
  } else {
    const found: Array<import('@milkdown/kit/prose/model').Mark> = []
    view.state.doc.nodesBetween(from, to, node => {
      node.marks.forEach(m => { if (m.type === type) found.push(m) })
    })
    mark = found[0] ?? null
  }
  if (!mark) return null
  const color = String((mark.attrs as { color?: unknown })?.color || '')
  return color ? color.toLowerCase() : null
}

/** 移除选区上的所有行内样式 mark（高亮/文字色/下划线/上标/下标） */
const clearTextStyleMarks = (): boolean => {
  if (!view) return false
  const { from, to, empty } = view.state.selection
  if (empty) return false
  const tr = view.state.tr
  const names = ['esdHighlight', 'esdTextColor', 'esdUnderline', 'esdSuperscript', 'esdSubscript']
  for (const name of names) {
    const m = view.state.schema.marks[name]
    if (m) tr.removeMark(from, to, m)
  }
  view.dispatch(tr)
  view.focus()
  return true
}

/**
 * 用「DOM Range 实时换算」的方式施加样式 mark。
 *
 * 为什么不用记录的 from/to：点击菜单栏按钮的瞬间 DOM 选区会丢失/塌陷，
 * 而 selectionchange 同步到 PM 有延迟，用旧偏移会多算或少算一两个字符
 * （表现为高亮范围偏一位）。这里直接用 Range 端点经 view.posAtDOM 换算，
 * 拿到的是此刻真实的 PM 位置，范围与用户选中的文本严格一致。
 *
 * @returns { ok, from, to } ok 为 false 时调用方可回退到其它选区来源
 */
const applyTextStyleMarkViaRange = (
  kind: 'highlight' | 'textColor',
  color: string | null,
  range: Range | null,
): { ok: boolean; from: number; to: number } => {
  if (!view || !range) return { ok: false, from: -1, to: -1 }
  const markName = kind === 'highlight' ? 'esdHighlight' : 'esdTextColor'
  const markType = view.state.schema.marks[markName]
  if (!markType) return { ok: false, from: -1, to: -1 }
  let from = -1
  let to = -1
  try {
    from = view.posAtDOM(range.startContainer, range.startOffset)
    to = view.posAtDOM(range.endContainer, range.endOffset)
  } catch {
    return { ok: false, from: -1, to: -1 }
  }
  if (from > to) [from, to] = [to, from]
  if (from === to) return { ok: false, from, to }
  const tr = view.state.tr
  tr.removeMark(from, to, markType)
  if (color !== null) tr.addMark(from, to, markType.create({ color }))
  view.dispatch(tr)
  return { ok: true, from, to }
}

const setValue = (content: string) => {
  const next = normalize(content)
  syncedValue = next
  if (ready) crepe?.editor.action(replaceAll(prepareMarkdown(next), true))
  emit('update:modelValue', next)
  emit('input', next)
  void resolveMediaReferencesInDom(crepeRootRef.value as HTMLElement)
}

const focus = () => {
  blocksContainerRef.value?.querySelector<HTMLElement>('.ProseMirror')?.focus()
}

const getSelectionRange = () => view
  ? { from: view.state.selection.from, to: view.state.selection.to }
  : null

/** 恢复选区（用于文件对话框夺走焦点后回到原落点） */
const setSelectionRange = (from: number, to: number = from): boolean => {
  if (!view) return false
  const max = view.state.doc.content.size
  const start = Math.max(0, Math.min(from, max))
  const end = Math.max(start, Math.min(to, max))
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, start, end))
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

/**
 * 在光标处插入媒体块（自成一段）。
 *
 * 直接用 `tr.insertText` 只会插入纯文本，Milkdown 的图片输入规则不会触发，
 * 媒体 markdown 会原样显示成文字。因此这里改用「改全文 → replaceAll」：
 * 调用方通过 getSelectionOffsetInMarkdown() 取到光标对应的文本偏移，
 * 我们在该偏移处插入片段并保证前后各有一个空行，再整体重建文档。
 */
const insertMediaBlock = (markdown: string): boolean => {
  if (!ready) return false
  const trimmed = markdown.trim()
  if (!trimmed) return false

  const offset = getSelectionOffsetInMarkdown()
  if (offset === null) return false

  // current 取 Cream 的干净 markdown（无尺寸后缀），插入的片段自带后缀，
  // 拼出的 next 就是「带后缀」的完整形态；syncedValue 与之保持一致。
  const current = normalize(crepe?.getMarkdown() || '')
  const start = Math.max(0, Math.min(offset, current.length))
  const before = current.slice(0, start)
  const after = current.slice(start)
  // 媒体前后补空行，保证渲染时独占一段
  const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
  const suffix = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
  const next = normalize(restoreImageSizeSuffixes(before + prefix + trimmed + suffix + after))

  // prepareMarkdown 会重新填充 imageSizes（含本次插入的尺寸）
  syncedValue = next
  crepe?.editor.action(replaceAll(prepareMarkdown(next), true))
  emit('update:modelValue', next)
  emit('input', next)
  void resolveMediaReferencesInDom(crepeRootRef.value as HTMLElement)
  return true
}

/**
 * 估算光标在 markdown 文本中的偏移。
 * ProseMirror 的 pos 与 markdown 偏移没有线性关系，这里用「光标前的纯文本」
 * 在 markdown 中就近定位：找到该片段首次出现处，偏移即其末尾；
 * 找不到时退化为文末。
 */
function getSelectionOffsetInMarkdown(): number | null {
  if (!view || !ready) return null
  const markdown = normalize(crepe?.getMarkdown() || '')
  const { $from } = view.state.selection
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  if (!textBefore) return markdown.length
  const index = markdown.indexOf(textBefore)
  if (index < 0) return markdown.length
  return index + textBefore.length
}

defineExpose({
  getValue,
  setValue,
  focus,
  getSelectionRange,
  setSelectionRange,
  blocksContainerRef,
  insertMediaBlock,
  scrollToBlockAnchor,
  insertWikiLinkAtPositions,
  setSearchMatches,
  clearSearch,
  replaceSearchMatch,
  replaceSearchMatches,
  focusMatch,
  getActiveMatchRange,
  getMatchRanges,
  getEditorMarkdown,
  getSearchMarkdown,
  toggleBlockquote,
  setHeadingLevel,
  toggleList,
  setRichSelection,
  applyTextStyleMark,
  applyTextStyleMarkViaRange,
  clearTextStyleMarks,
  insertSnippetAtCursor,
  insertLinkAtCursor,
  insertLinkAtRange,
  insertLinkAtPositions,
  insertInlineCodeAtCursor,
  insertCodeBlockAtCursor,
  getTextStyleColor,
  getActiveFormats,
  toggleUnderlineMark,
  toggleSuperscriptMark,
  toggleSubscriptMark,
  toggleStrikeMark,
  toggleInlineCodeMark,
  hasMarkType,
  isUnderlineActive,
})

// ====== 编辑器内搜索 ======
// 高亮用 ProseMirror 装饰器：只影响渲染、不写入 doc，因此不会触发自动保存，
// 正文里绝不会残留搜索痕迹。
//
// 基准选择：直接摊平 PM 文档取纯文本，并记录「每个字符 → PM 位置」，
// 搜索命中区间即 PM 区间，不需要任何 markdown 换算，也就不会因为
// 行内代码/加粗/公式/链接等语法字符而错位。

/** 当前搜索状态（含匹配、映射后的 PM 区间与可高亮子集） */
const searchState = ref<{
  query: string
  matches: SearchMatch[]
  activeIndex: number
  /** 匹配换算后的 PM 区间，与 matches 等长；null 表示该处无法映射 */
  pmRanges: Array<{ from: number; to: number } | null>
  /** 可高亮的匹配子集（对外跳转与计数的权威基准） */
  highlightable: SearchMatch[]
}>({ query: '', matches: [], activeIndex: -1, pmRanges: [], highlightable: [] })

let searchStyleEl: HTMLStyleElement | null = null

/** 注入搜索高亮样式：PM 渲染层在 scoped 样式作用域之外，必须用全局 <style> */
const injectSearchStyle = () => {
  if (searchStyleEl) return
  searchStyleEl = document.createElement('style')
  searchStyleEl.textContent = [
    `.${SEARCH_HIT_CLASS} { background: rgba(250, 204, 21, 0.32); border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.35); }`,
    `.${SEARCH_HIT_CURRENT_CLASS} { background: rgba(251, 146, 60, 0.55); box-shadow: inset 0 0 0 1px rgba(251, 146, 60, 0.85); }`,
  ].join('\n')
  document.head.appendChild(searchStyleEl)
}

const removeSearchStyle = () => {
  searchStyleEl?.remove()
  searchStyleEl = null
}

/**
 * 摊平 PM 文档为纯文本，并记录每个字符的 PM 位置。
 * 文本块之间插入 '\n' 作分隔（位置记 -1，跨块匹配会被过滤）。
 * 行内 atom（公式、图片等）不贡献文本，因此其内容不参与搜索——
 * 这是可接受的降级（用户搜的是可见文字）。
 */
function buildFlatDocText(): { text: string; posAt: number[] } {
  if (!view) return { text: '', posAt: [] }
  const chars: string[] = []
  const posAt: number[] = []
  view.state.doc.descendants((node, pos) => {
    // 代码块的内容由 Crepe 的 CodeMirror 渲染，PM 装饰器无法在其上绘制高亮；
    // 若纳入基准会出现「计数 N 处但一处都看不到」的不一致，因此整块跳过。
    if (node.type.name === 'code_block') return false
    if (node.isText) {
      const value = node.text || ''
      for (let i = 0; i < value.length; i++) {
        chars.push(value[i])
        posAt.push(pos + i)
      }
      return false
    }
    if (node.isTextblock && chars.length > 0) {
      chars.push('\n')
      posAt.push(-1)
    }
    return true
  })
  return { text: chars.join(''), posAt }
}

/** 重算映射与装饰器 */
function recomputeSearchDecorations() {
  if (!view) return
  const { matches, activeIndex } = searchState.value
  const { posAt } = buildFlatDocText()
  const pmRanges = matches.map(match => {
    if (match.start < 0 || match.end > posAt.length || match.start >= match.end) return null
    const from = posAt[match.start]
    const toChar = posAt[match.end - 1]
    if (from < 0 || toChar < 0) return null
    return { from, to: toChar + 1 }
  })
  searchState.value.pmRanges = pmRanges

  const ranges = matches
    .map((match, index) => ({ match, pm: pmRanges[index] }))
    .filter((entry): entry is { match: SearchMatch; pm: { from: number; to: number } } => !!entry.pm)
    .map(({ match, pm }) => ({
      from: pm.from,
      to: pm.to,
      // active 判断用原始 matches 下标，避免过滤后错位
      active: matches.indexOf(match) === activeIndex,
    }))

  searchDecorationSet = buildSearchDecorations(view.state.doc, ranges)
  // 与锚点高亮合并下发：setProps 是整份覆盖，不能各自为政
  pushDecorations()
  view.dispatch(view.state.tr.setMeta(editorSearchPluginKey, {
    query: searchState.value.query,
    activeIndex,
  } as EditorSearchState))
}

/**
 * 应用外部算好的匹配结果（单一数据源）。
 *
 * 匹配由调用方（NoteEditor）基于它自己的文本基准完成，这里只负责
 * markdown 区间 → PM 区间 的换算与装饰器渲染；不再内部重复匹配，
 * 避免两边计数不一致。
 *
 * 跨块匹配（如正则跨越段落边界）无法换算成 PM 区间，会被过滤掉。
 *
 * @param matches     markdown 字符区间（调用方的基准文本）
 * @param activeIndex 当前匹配下标；-1 表示不高亮任何一处
 * @returns 过滤后「可高亮」的匹配列表——调用方应以此作为权威计数与跳转基准，
 *          避免出现「计数 5 处却只高亮 3 处」的不一致
 */
function setSearchMatches(matches: SearchMatch[], activeIndex = -1): SearchMatch[] {
  searchState.value = {
    query: searchState.value.query,
    matches,
    activeIndex: activeIndex >= 0 && activeIndex < matches.length ? activeIndex : -1,
    pmRanges: [],
    highlightable: [],
  }
  recomputeSearchDecorations()
  // pmRanges 与 matches 等长，null 表示该处无法映射
  const highlightable = matches.filter((_match, index) => searchState.value.pmRanges[index])
  searchState.value.highlightable = highlightable
  // activeIndex 以 highlightable 为基准，需要换算回完整 matches 的下标
  if (activeIndex >= 0 && activeIndex < highlightable.length) {
    const target = highlightable[activeIndex]
    searchState.value.activeIndex = matches.indexOf(target)
  }
  recomputeSearchDecorations()
  return highlightable
}

/** 清除全部高亮与内部状态 */
function clearSearch(): void {
  searchState.value = { query: '', matches: [], activeIndex: -1, pmRanges: [], highlightable: [] }
  recomputeSearchDecorations()
}

/**
 * 替换搜索匹配（富文本模式）。
 *
 * 调用方（NoteEditor）的搜索基准正是 getSearchMarkdown()，也就是
 * buildFlatDocText() 摊平出来的纯文本；它给出的 start/end 是这个基准里的下标。
 * buildFlatDocText 同时产出 posAt（每个字符 → PM 位置），因此 start/end 可直接
 * 换算成 PM 区间——与高亮走同一套映射，不会错位。
 * 用 PM 事务做替换，才能保留 Ctrl+Z 撤销。
 */
function replaceSearchMatch(start: number, end: number, text: string): boolean {
  if (!view) return false
  const { posAt } = buildFlatDocText()
  if (start < 0 || end > posAt.length || start >= end) return false
  const fromChar = posAt[start]
  const toChar = posAt[end - 1]
  if (fromChar < 0 || toChar < 0) return false
  const from = fromChar
  const to = toChar + 1
  const max = view.state.doc.content.size
  const safeFrom = Math.max(0, Math.min(from, max))
  const safeTo = Math.max(safeFrom, Math.min(to, max))
  if (safeFrom === safeTo && !text) return false
  try {
    const tr = view.state.tr.insertText(String(text ?? ''), safeFrom, safeTo)
    tr.setSelection(TextSelection.create(tr.doc, safeFrom + String(text ?? '').length))
    view.dispatch(tr)
    return true
  } catch (error) {
    logger.error('[编辑器] 替换失败', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

/**
 * 全部替换（富文本模式）。
 * 从后往前应用，避免前一处替换导致后面区间位移；
 * 合并进**单个事务**，因此一次 Ctrl+Z 即可整体撤销。
 */
function replaceSearchMatches(ranges: SearchMatch[], text: string): boolean {
  if (!view || !ranges.length) return false
  const { posAt } = buildFlatDocText()
  const max = view.state.doc.content.size
  // 换算成 PM 区间，并从后往前排序
  const pmRanges = ranges
    .map(r => {
      if (r.start < 0 || r.end > posAt.length || r.start >= r.end) return null
      const a = posAt[r.start]
      const b = posAt[r.end - 1]
      if (a < 0 || b < 0) return null
      return { from: Math.max(0, Math.min(a, max)), to: Math.max(0, Math.min(b + 1, max)) }
    })
    .filter((x): x is { from: number; to: number } => !!x && x.to > x.from)
    .sort((x, y) => y.from - x.from)

  if (!pmRanges.length) return false
  try {
    let tr = view.state.tr
    for (const range of pmRanges) {
      // 每次替换后位置会变，需基于最新 tr.doc 重新钳制
      const size = tr.doc.content.size
      const from = Math.max(0, Math.min(range.from, size))
      const to = Math.max(from, Math.min(range.to, size))
      tr = tr.insertText(String(text ?? ''), from, to)
    }
    view.dispatch(tr)
    return true
  } catch (error) {
    logger.error('[编辑器] 全部替换失败', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

 /**
  * 跳到指定匹配处：index 以 highlightable（可高亮子集）为基准。
  *
  * 只设置选区、**不调用 view.focus()**：焦点必须留在搜索输入框，
  * 否则 Enter / Shift+Enter 会被 ProseMirror 当作软换行处理，直接改坏正文。
  *
  * 但正因为不 focus，PM 的 `tr.scrollIntoView()` 不可靠——它依赖视图自身的
  * 滚动逻辑，而本项目的滚动容器是外层 `.md-blocks`（不是 PM 根）。
  * 实测表现就是「切换上/下一处时内容不滚动」（用户报告的问题）。
  * 因此这里改为**显式滚动**：把匹配所在的 DOM 节点滚进可视区中间。
  */
 function focusMatch(index: number): boolean {
   const { highlightable, matches } = searchState.value
   if (index < 0 || index >= highlightable.length) return false
   const target = highlightable[index]
   const realIndex = matches.indexOf(target)
   searchState.value.activeIndex = realIndex
 
   const pm = searchState.value.pmRanges[realIndex]
   if (pm && view) {
     const max = view.state.doc.content.size
     const from = Math.max(0, Math.min(pm.from, max))
     const to = Math.max(from, Math.min(pm.to, max))
     // 选区仍要设置：便于用户看清范围，也是后续替换的目标
     view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)))
     /*
       用户报告「搜索的内容在引用块中，引用块默认收起，跳转失败」（替换同理）。
       根因：引用收起后目标文字被 display:none / overflow:hidden 隐藏，
       其 DOM rect 为 0，scrollPmRangeIntoView 算不出有效位置 → 看起来没跳。
       因此先展开包含目标的引用块，再等一帧重排后滚动。
     */
     if (expandQuoteAtPos(from)) {
       requestAnimationFrame(() => scrollPmRangeIntoView(from, to))
     } else {
       // 显式滚动（不依赖 scrollIntoView）
       scrollPmRangeIntoView(from, to)
     }
   }
 
   recomputeSearchDecorations()
   return true
 }

 /**
  * 把某个 PM 区间滚动到滚动容器可视区内（尽量居中）。
  *
  * 为什么不直接用 `tr.scrollIntoView()`：
  *  该 API 走 PM 自身的滚动处理，而本项目真正的滚动容器是 `.md-blocks`
  *  （PM 根不是 scroller），加上跳转时刻意不 focus，实测不滚动。
  * 这里取出区间首尾的 DOM 坐标，直接算相对 `.md-blocks` 的偏移并设置 scrollTop。
  */
 function scrollPmRangeIntoView(from: number, to: number): void {
   if (!view || !blocksContainerRef.value) return
   const scroller = blocksContainerRef.value
   try {
     const start = view.domAtPos(from)
     const end = view.domAtPos(to)
     const startEl = start.node instanceof HTMLElement ? start.node : start.node.parentElement
     if (!startEl) return
     const range = document.createRange()
     range.setStart(start.node, start.offset)
     try {
       range.setEnd(end.node, end.offset)
     } catch {
       // 起止不在同一节点时退化为「只算起点」
       range.setEnd(start.node, start.offset)
     }
     const rect = range.getBoundingClientRect()
     const scrollerRect = scroller.getBoundingClientRect()
     if (!rect.height && !rect.width) return
     // 目标相对滚动容器内容顶部的偏移 = 当前 scrollTop + (目标视口位置 - 容器视口位置)
     const delta = rect.top - scrollerRect.top
     const target = scroller.scrollTop + delta - Math.max(0, (scroller.clientHeight - rect.height) / 2)
     scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
   } catch {
     /* 位置换算失败时不滚动，至少选区已设置 */
   }
 }

/** 取当前匹配在 markdown 中的区间（供源码模式定位） */
function getActiveMatchRange(): { start: number; end: number } | null {
  const { matches, activeIndex } = searchState.value
  if (activeIndex < 0 || activeIndex >= matches.length) return null
  return matches[activeIndex]
}

/** 取可高亮的匹配区间（与 setSearchMatches 返回值一致） */
function getMatchRanges(): SearchMatch[] {
  return searchState.value.highlightable
}

onBeforeUnmount(() => {
  removeSearchStyle()
})
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
  /* 上下 5px 内缩放在滚动容器的**父级**：这样滚动视口本身比卡片小 5px，
     任何滚动位置内容都不会贴到卡片上下边界。
     （放在滚动容器自身上没用——滚动容器的 padding 会随内容一起滚走。） */
  padding: 5px 0;
}

/* 唯一滚动容器（左右 60px 由 .ProseMirror 提供，横向不滚动） */
.md-blocks {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
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

/* 媒体尺寸编辑浮层 */
.media-resize-panel {
  position: absolute;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid rgba(196, 181, 253, 0.22);
  border-radius: 10px;
  background: rgba(28, 25, 54, 0.97);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(14px);
}

.media-resize-title {
  color: rgba(245, 243, 255, 0.6);
  font-size: 11px;
}

.media-resize-panel input {
  width: 62px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid rgba(196, 181, 253, 0.2);
  border-radius: 6px;
  color: #f4f1ff;
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}

.media-resize-panel input:focus {
  border-color: rgba(167, 139, 250, 0.6);
  outline: none;
}

.media-resize-sep {
  color: rgba(245, 243, 255, 0.4);
  font-size: 11px;
}

.media-resize-btn {
  height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.22);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.media-resize-btn:hover {
  background: rgba(139, 92, 246, 0.38);
  color: #fff;
}

.media-resize-btn.ghost {
  color: rgba(245, 243, 255, 0.6);
  background: rgba(255, 255, 255, 0.06);
}

.media-resize-btn.ghost:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

/* 编辑器内媒体节点：缺失资产时给出提示样式 */
.md-editor :deep(img[data-media-missing='true']),
.md-editor :deep(video[data-media-missing='true']) {
  min-height: 48px;
  border: 1px dashed rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.08);
}

/* 媒体只通过笔记右键菜单插入，保留已有图片的显示与尺寸操作。 */
.md-editor :deep(.milkdown .milkdown-image-inline .empty-image-inline),
.md-editor :deep(.milkdown .milkdown-image-block > .image-edit) {
  display: none !important;
}

/* ====== 编辑器光标与选区（显眼紫色系；:deep 穿透 Milkdown 动态 DOM，scoped 下必须） ====== */
/*
  内容与容器间距：固定左右 60px，覆盖 Crepe 主题的 `padding: 60px 120px`。
  上下为 0：由滚动容器外层的 .md-editor 提供 5px（见其注释），
  这样滚动时内容不会贴边。

  ⚠️ 曾考虑改成百分比留白（随容器宽度缩放，想让全屏/未全屏差异更明显），
  但实测计算表明**适得其反**：
    固定 60px 时，正文可用宽度在未全屏(861px)→全屏(1281px) 之间
      由 741px 变到 1161px，差值 420px（+56.7%）
    改成 min(60px, 4%) 时，留白随宽度一起放大，
      正文宽 792→1179px，差值只有 386px（+48.8%）
  百分比留白把本应体现出来的宽度差异又吃掉了一部分，因此保留固定值。
  真正影响「区域是否随全屏变化」的是状态逻辑（见 NotesPage 的 fs-edit 与
  fullscreenEdit 复位），不是这里的留白。 */
.md-editor :deep(.milkdown .ProseMirror) {
  padding: 0 60px;
}
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

/* 块锚点链接（本笔记内的块）：与 wiki 链接区分，用下划虚线 + 定位图标语感 */
.md-editor :deep(a[href^='#esd-ref-']) {
  cursor: pointer;
  text-decoration: underline dotted rgba(147, 197, 253, 0.7);
  text-underline-offset: 3px;
}

.md-editor :deep(a[href^='#esd-ref-']:hover) {
  background: rgba(102, 126, 234, 0.2);
  border-radius: 3px;
}

/* 跳转后短暂高亮目标块，帮助用户确认落点 */
.md-editor :deep(.esd-anchor-flash) {
  animation: esd-anchor-flash 1.6s ease-out;
}

@keyframes esd-anchor-flash {
  0% { background: rgba(102, 126, 234, 0.42); box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.22); }
  100% { background: transparent; box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
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
/* 六级标题独立配色（极光梯度：亮蓝→天蓝→靛蓝→紫→浅紫→粉紫） */
.md-editor :deep(.markdown-body h1) { font-size: 24px; color: #93c5fd; border-bottom: 1px solid rgba(102, 126, 234, 0.25); padding-bottom: 6px; }
.md-editor :deep(.markdown-body h2) { font-size: 21px; color: #7dd3fc; }
.md-editor :deep(.markdown-body h3) { font-size: 18px; color: #a5b4fc; }
.md-editor :deep(.markdown-body h4) { font-size: 16px; color: #c4b5fd; }
.md-editor :deep(.markdown-body h5) { font-size: 15px; color: #d8b4fe; }
.md-editor :deep(.markdown-body h6) { font-size: 14px; color: #f0abfc; }

.md-editor :deep(.markdown-body p) {
  margin: 0;
  text-indent: 2em;
}

/* 首行缩进只应作用于段落的首行；段内的行内元素会继承 text-indent，
   而 Crepe 的行内代码是 display:inline-block（等于块容器），
   会把 2em 缩进作用到自己的内容上——表现为行内代码 chip 左侧一大片空白。
   这里在段内后代上重置缩进。 */
.md-editor :deep(.markdown-body p *) {
  text-indent: 0;
}

.md-editor :deep(.markdown-body li p),
.md-editor :deep(.markdown-body blockquote p) {
  text-indent: 0;
}

/* 引用块排版：首行（小标题，如「承载力」）保持顶格不缩进；
   从第二段起按正文习惯首行缩进两个字符。
   ⚠️ 用 `:first-of-type` 而不是 `:first-child`：
   引用块的「收起/展开」widget 按钮会被 ProseMirror 渲染成 blockquote 的**第一个子元素**，
   于是真正的第一个 <p> 不再是 :first-child——旧写法 `p:first-child` 匹配不到它，
   反而被 `p:not(:first-child)` 命中，导致「引用第一行也缩进两字符」（用户报告的问题）。
   `:first-of-type` 按元素类型计数，与同类中谁排在前无关，天然不受该按钮影响。 */
.md-editor :deep(.markdown-body blockquote > p:first-of-type) {
  text-indent: 0;
}

.md-editor :deep(.markdown-body blockquote > p:not(:first-of-type)) {
  text-indent: 2em;
}

/* 引用：左侧竖条由 Crepe 的 ::before 绘制（取 --crepe-color-selected），此处只加底色，避免出现双竖条 */
.md-editor :deep(.markdown-body blockquote) {
  background: rgba(102, 126, 234, 0.06);
  color: #7d8db5;
  /* 左侧让出「收起箭头」：箭头 left:8px、宽 17px → 占到 x=25，
     因此正文从 28px 起，与箭头留 3px 间隙、且不压住竖条（4px）。 */
  padding-left: 28px;
  padding-right: 14px;
  border-radius: 0 6px 6px 0;
  /* 收起箭头绝对定位到左上角，因此这里作为定位上下文；
     同时收起态需要 max-height 兜底 */
  position: relative;
}

/* 引用块的「收起 / 展开」按钮（左侧小箭头，位于第一行文本左侧）。
   它由 ProseMirror 的 widget 装饰器渲染，是 blockquote 的第一个子元素；
   绝对定位到左上角，不占用正文排版空间。
   样式与引用区域保持一致的设计语言：靛蓝描边、圆角、悬停提亮，
   并按展开/收起两态给出不同的视觉权重（收起时常显，避免找不到入口）。 */
.md-editor :deep(.esd-quote-toggle) {
  position: absolute;
  /* 贴在第一行文字左侧：竖条(4px) + 间隙 */
  left: 8px;
  /*
    与第一行文字垂直居中（用户要求）。
    修正依据（实测 Crepe reset.css 的真实生效值）：
      .milkdown .ProseMirror p { font-size: 1em; line-height: 1.5; padding: 4px 0; }
    这条比我们的 .markdown-body { line-height: 1.85 } 更具体，因此**段落实际**
    行盒高 = 1.5 × 15px = 22.5px，且段落有 4px 上内边距。
    第一行文字的视觉中心 y = 4 + 22.5/2 = 15.25px，
    按钮高 17px，故 top = 15.25 - 8.5 = 6.75px。

    上一版按 1.85 算得 5.38px，偏差 1.37px（用户反馈「没居中」）；
    最初写死 3px 则偏差 3.75px。
    用 calc + em 表达（em 以继承的正文 15px 为基准），字号变化时自动跟随。
    再次注意：本元素**不设 font-size**，否则 em 会以自己的字号解析而算错。
  */
  top: calc(4px + (1.5em - 17px) / 2);
  z-index: 2;
  box-sizing: border-box;
  width: 17px;
  height: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 0;
  /* 与引用底色同色系：靛蓝的浅淡底 + 描边 */
  color: #a5b4fc;
  background: rgba(102, 126, 234, 0.14);
  border: 1px solid rgba(102, 126, 234, 0.34);
  border-radius: 5px;
  cursor: pointer;
  /* 展开态默认低调，悬停引用块时显现（与引用底色融为一体，不干扰阅读） */
  opacity: 0.55;
  transition: opacity 0.16s, background 0.16s, border-color 0.16s, color 0.16s, transform 0.16s;
}

/* 悬停引用块或按钮本身 → 提亮 */
.md-editor :deep(.markdown-body blockquote:hover .esd-quote-toggle),
.md-editor :deep(.esd-quote-toggle:hover),
.md-editor :deep(.esd-quote-toggle:focus-visible) {
  opacity: 1;
  color: #e0e7ff;
  background: rgba(102, 126, 234, 0.34);
  border-color: rgba(129, 140, 248, 0.62);
}

.md-editor :deep(.esd-quote-toggle:active) {
  transform: scale(0.92);
}

/* 箭头方向：展开态 ▾（可收起），收起态 ▸（已折叠、点击展开）。
   用「块」绘制三角而非字符，避免不同字体下大小/基线不一致。 */
.md-editor :deep(.esd-quote-toggle::before) {
  content: '';
  width: 0;
  height: 0;
  /* 展开态：向下的实心三角（表示「可以收起来」） */
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
}
.md-editor :deep(.markdown-body blockquote.esd-quote-collapsed .esd-quote-toggle::before) {
  /* 收起态：向右的实心三角（表示「可以展开」），需要把三角转 90° */
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid currentColor;
  border-right: none;
}

/* 已收起：按钮常显并加强，提示这里可以展开 */
.md-editor :deep(.markdown-body blockquote.esd-quote-collapsed .esd-quote-toggle) {
  opacity: 1;
  color: #c7d2fe;
  background: rgba(102, 126, 234, 0.28);
  border-color: rgba(129, 140, 248, 0.55);
}

/* 收起态：给左侧箭头让位，并只保留第一行。
   容器限高兜底，防止首个段落自身很高时仍撑满。 */
.md-editor :deep(.markdown-body blockquote.esd-quote-collapsed) {
  max-height: 3.4em;
  overflow: hidden;
}

/*
  收起态：只保留「第一行」，隐藏其余所有内容。

  用户报告「引用中有列表时收起不正常、没有正确收起到只显示第一行」，
  根因是前一版只隐藏 `p:nth-of-type(n+2)`：
  引用里的列表在 DOM 里是 <ul>/<ol>，**根本没有 <p>**，
  所以列表完全不受影响、照常显示，收起形同无效。

  现在由装饰器给第一个内容块打上 .esd-quote-first（见 QUOTE_FIRST_CLASS），
  CSS 只认这个 class：
    · 与标签种类无关（p / ul / ol / 标题都能统一处理）；
    · 与按钮位置无关（按钮是 widget，另一个直接子元素）。

  ⚠️ 必须显式排除收起按钮：它也是 blockquote 的直接子元素，
  若被一起隐藏，收起后就再也没有「展开」入口了（历史故障）。
  按钮带 data-esd-widget 标记，这里据此排除。
*/
.md-editor :deep(.markdown-body blockquote.esd-quote-collapsed > :not(.esd-quote-first):not([data-esd-widget])) {
  display: none;
}

/* 首个内容块：单行显示（超出裁切 + 省略号）。
   列表时额外只保留第一个列表项，并对该项做同样的单行处理。
   list-style-position: inside 让项目符号落在内容盒内，不会被 overflow 裁掉。 */
.md-editor :deep(.markdown-body blockquote.esd-quote-collapsed > .esd-quote-first),
.md-editor :deep(.markdown-body blockquote.esd-quote-collapsed > .esd-quote-first > li:first-child) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.md-editor :deep(.markdown-body blockquote.esd-quote-collapsed > ul.esd-quote-first),
.md-editor :deep(.markdown-body blockquote.esd-quote-collapsed > ol.esd-quote-first) {
  list-style-position: inside;
}
.md-editor :deep(.markdown-body blockquote.esd-quote-collapsed > .esd-quote-first > li:nth-child(n + 2)) {
  display: none;
}

.md-editor :deep(.markdown-body blockquote p) { margin: 0; }

/* 用户明确要求：引用内加粗文字的颜色取「未加粗引用文字颜色的深色系」。
   未加粗的引用文字是 #7d8db5，这里用同色相更深的 #5c6a95（R/G/B 三通道都更低），
   让加粗看起来是「同样颜色加深」而不是换成另一种亮紫。
   用户显式设置的文字颜色（esdTextColor 内联 style）优先级更高，不受影响。 */
.md-editor :deep(.markdown-body blockquote strong) {
  color: #5c6a95;
}
.md-editor :deep(.markdown-body blockquote em) {
  color: #6b7aa3;
}
.md-editor :deep(.markdown-body blockquote code) {
  color: #8b97bf;
}

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

/*
  删除线：显式声明 line-through + 提高颜色对比度。
  ⚠️ 这是「删除线快捷键无效 / 检测不出冲突」的真正原因（视觉层）：
  strike_through mark 一直存在、快捷键也一直在正常派发与写入 mark，
  但旧的 del 颜色 #5d6b94 在深色底上对比度只有 2.96（正文是 10.48），
  划掉的文字几乎看不见 → 用户感知就是「按了没反应」。
  而冲突检测只看「动作是否可用」，自然检测不出这种「样式不可见」的问题。

  现在的取值：#94a3b8，对比度 6.07，既清楚可读、又看得出被划掉。
  text-decoration 显式写出来，避免被 reset 的其它规则清掉。
*/
.md-editor :deep(.markdown-body del) {
  color: #94a3b8;
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

/*
  上标 / 下标：显式声明样式。
  浏览器的默认 sup/sub 在不同内核下字号与基线偏移不一致，且会继承正文的
  line-height 造成行高跳动（上下标最常见的问题）。这里统一固定：
    · font-size: 0.75em（默认值偏小，0.75 更易读）
    · line-height: 0 → 不参与行高计算，避免整行被撑高
    · vertical-align 用固定比例，跨浏览器一致
*/
.md-editor :deep(.markdown-body sup) {
  font-size: 0.75em;
  line-height: 0;
  vertical-align: super;
  position: relative;
  top: -0.15em;
}
.md-editor :deep(.markdown-body sub) {
  font-size: 0.75em;
  line-height: 0;
  vertical-align: sub;
  position: relative;
  bottom: -0.15em;
}
/* 引用内的上下标沿用引用文字色，与其它行内样式保持一致 */
.md-editor :deep(.markdown-body blockquote sup),
.md-editor :deep(.markdown-body blockquote sub) {
  color: inherit;
}

/* ====== 表格容器（覆盖 crepe milkdown-table-block 默认透明样式）====== */
.md-editor :deep(.markdown-body .milkdown-table-block),
.md-editor :deep(.milkdown-table-block) {
  border-collapse: collapse;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(102, 126, 234, 0.28);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
  font-size: 13.5px;
}

.md-editor :deep(.milkdown-table-block th),
.md-editor :deep(.milkdown-table-block td) {
  border: none;
  border-bottom: 1px solid rgba(102, 126, 234, 0.16);
  border-right: 1px solid rgba(102, 126, 234, 0.12);
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.025);
}

.md-editor :deep(.milkdown-table-block th) {
  background: rgba(102, 126, 234, 0.16);
  color: #bfdbfe;
  font-weight: 600;
}

.md-editor :deep(.milkdown-table-block tr:last-child td) {
  border-bottom: none;
}

.md-editor :deep(.milkdown-table-block td:last-child),
.md-editor :deep(.milkdown-table-block th:last-child) {
  border-right: none;
}

.md-editor :deep(.milkdown-table-block tbody tr:hover td) {
  background: rgba(102, 126, 234, 0.08);
}

/* ====== 行内代码容器：中性色块，不用边框/彩色，避免像被高亮 ====== */
.md-editor :deep(.markdown-body :not(pre) > code) {
  background: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
  border: none;
  border-radius: 4px;
  padding: 1px 5px;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.88em;
}

/* ====== 块级代码容器：紧凑卡片，工具栏悬浮在容器上方 ======
   配色：蓝紫玻璃质感——半透明紫罗兰渐变 + 淡紫描边 + 内高光/外投影，
   让卡片像「浮在星空上」，而不是一块突兀的纯黑板。 */
.md-editor :deep(.markdown-body .milkdown-code-block) {
  position: relative;
  display: block;
  margin: 16px 0;
  /* 上下内距对称；工具栏移到容器外上方，无需额外顶部留白 */
  padding: 10px 12px;
  background: linear-gradient(180deg, rgba(72, 62, 140, 0.26), rgba(34, 29, 74, 0.40));
  border: 1px solid rgba(167, 139, 250, 0.20);
  border-radius: 10px;
  box-shadow:
    0 6px 22px rgba(8, 6, 26, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(6px);
  overflow: visible;
}

/* 工具栏：绝对定位到容器上方（.tools 仍是容器的 DOM 后代，
   悬停它时容器的 :hover 依然成立，按钮不会在鼠标移入时消失） */
.md-editor :deep(.markdown-body .milkdown-code-block .tools) {
  position: absolute;
  bottom: 100%;
  top: auto;
  right: 0;
  left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 0;
  padding: 0;
  margin: 0;
  border: none;
  z-index: 4;
}

/* 语言锁定：语言在「插入块级代码」弹窗里选定，插入后不允许再改
   （改语言会让已通过的语法审查与预览失效）。按钮只作展示：
   指针事件关掉、下拉箭头隐藏，并额外有捕获阶段 click 拦截兜底。 */
.md-editor :deep(.markdown-body .milkdown-code-block .tools .language-button) {
  pointer-events: none;
  cursor: default;
}

.md-editor :deep(.markdown-body .milkdown-code-block .tools .language-button .expand-icon) {
  display: none;
}

.md-editor :deep(.markdown-body .milkdown-code-block .tools .language-picker) {
  display: none;
}

/* 语言按钮：半透明紫罗兰小胶囊（悬浮于代码之上也要清晰可读） */
.md-editor :deep(.markdown-body .milkdown-code-block .tools .language-button) {
  margin-bottom: 0;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(88, 76, 160, 0.55);
  border: 1px solid rgba(167, 139, 250, 0.30);
  box-shadow: 0 2px 10px rgba(10, 8, 30, 0.40);
  color: #ddd6fe;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  backdrop-filter: blur(6px);
}

.md-editor :deep(.markdown-body .milkdown-code-block .tools .language-button:hover) {
  background: rgba(110, 95, 195, 0.72);
  border-color: rgba(196, 181, 253, 0.45);
  color: #f5f3ff;
}

.md-editor :deep(.markdown-body .milkdown-code-block .tools .language-button .expand-icon svg) {
  color: currentColor;
  width: 12px;
  height: 12px;
}

/* 复制/预览按钮：同款半透明紫罗兰胶囊 */
.md-editor :deep(.markdown-body .milkdown-code-block .tools .tools-button-group button) {
  background: rgba(88, 76, 160, 0.55);
  border: 1px solid rgba(167, 139, 250, 0.30);
  box-shadow: 0 2px 10px rgba(10, 8, 30, 0.40);
  color: #ddd6fe;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  backdrop-filter: blur(6px);
}

.md-editor :deep(.markdown-body .milkdown-code-block .tools .tools-button-group button:hover) {
  background: rgba(110, 95, 195, 0.72);
  border-color: rgba(196, 181, 253, 0.45);
  color: #f5f3ff;
}

.md-editor :deep(.markdown-body .milkdown-code-block .tools .tools-button-group button svg) {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

/* 语言下拉：深色浮层 + 规整列表 */
.md-editor :deep(.markdown-body .milkdown-code-block .language-picker) {
  position: absolute;
  z-index: 30;
  padding-top: 6px;
}

.md-editor :deep(.markdown-body .milkdown-code-block .language-picker .list-wrapper) {
  background: rgba(32, 27, 66, 0.96);
  border: 1px solid rgba(167, 139, 250, 0.22);
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(6, 4, 20, 0.50);
  padding: 8px 0 6px;
  min-width: 190px;
  backdrop-filter: blur(10px);
}

.md-editor :deep(.markdown-body .milkdown-code-block .language-picker .search-box) {
  margin: 0 8px 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(167, 139, 250, 0.12);
}

.md-editor :deep(.markdown-body .milkdown-code-block .language-picker .search-box .search-input) {
  color: #e2e8f0;
  font-size: 12px;
  background: transparent;
  border: none;
  outline: none;
}

.md-editor :deep(.markdown-body .milkdown-code-block .language-picker .language-list) {
  padding: 0;
  margin: 0;
  list-style: none;
  max-height: 280px;
  overflow-y: auto;
}

.md-editor :deep(.markdown-body .milkdown-code-block .language-picker .language-list-item) {
  padding: 5px 14px;
  margin: 0;
  font-size: 12px;
  color: #cbd5e1;
  cursor: pointer;
}

.md-editor :deep(.markdown-body .milkdown-code-block .language-picker .language-list-item:hover),
.md-editor :deep(.markdown-body .milkdown-code-block .language-picker .language-list-item.selected) {
  background: rgba(99, 102, 241, 0.18);
  color: #f1f5f9;
}

/* ====== 代码块 / LaTeX 块的预览区（Crepe 的 latex 与 code 块复用 .milkdown-code-block）======
   默认只显示预览（previewOnlyByDefault），点「编辑」展开 CodeMirror 改源码。
   淡紫渐变分隔线 + 低饱和大写标签 + 略暗的预览底。 */
.md-editor :deep(.markdown-body .milkdown-code-block .preview-panel) {
  margin-top: 8px;
  padding-top: 0;
}

/* 预览独占整块时（源码已收起），去掉分隔线与留白，避免顶部空一大截 */
.md-editor :deep(.markdown-body .milkdown-code-block .codemirror-host.hidden + .preview-panel),
.md-editor :deep(.markdown-body .milkdown-code-block .codemirror-host.hidden ~ .preview-panel) {
  margin-top: 0;
}

.md-editor :deep(.markdown-body .milkdown-code-block .preview-divider) {
  height: 1px;
  background: linear-gradient(90deg, rgba(167, 139, 250, 0), rgba(167, 139, 250, 0.34), rgba(167, 139, 250, 0));
}

.md-editor :deep(.markdown-body .milkdown-code-block .preview-label) {
  margin: 8px 0 4px;
  color: rgba(196, 181, 253, 0.62);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

.md-editor :deep(.markdown-body .milkdown-code-block .preview) {
  padding: 6px 8px 8px;
  border-radius: 8px;
  background: rgba(14, 11, 34, 0.28);
  color: #e2e8f0;
  overflow-x: auto;
}

/* 着色代码预览（highlight.js 输出）：等宽、保留换行、不额外套边框 */
.md-editor :deep(.markdown-body .milkdown-code-block .preview .code-preview) {
  margin: 0;
  padding: 4px 2px;
  background: transparent;
  border: none;
  overflow: visible;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre;
}

.md-editor :deep(.markdown-body .milkdown-code-block .preview .code-preview code) {
  background: transparent;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
}

/* CodeMirror：无边框、无多余留白 */
.md-editor :deep(.markdown-body .milkdown-code-block .codemirror-host) {
  margin: 0;
}

.md-editor :deep(.markdown-body .milkdown-code-block .cm-editor) {
  background: transparent;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
}

.md-editor :deep(.markdown-body .milkdown-code-block .cm-scroller) {
  padding: 0;
  line-height: 1.7;
  font-size: 13px;
}

/* 行号栏：整条隐藏——它会在代码左侧留下明显空白（尤其单行代码块），
   笔记里的代码块不需要行号；隐藏后正文紧贴容器内边距。 */
.md-editor :deep(.markdown-body .milkdown-code-block .cm-gutters) {
  display: none !important;
}

.md-editor :deep(.markdown-body .milkdown-code-block .cm-content) {
  padding: 0 0 0 4px;
  caret-color: #a78bfa;
}

.md-editor :deep(.markdown-body .milkdown-code-block .cm-line) {
  padding: 0;
}

/* 当前行：极淡，避免整行像被选中 */
.md-editor :deep(.markdown-body .milkdown-code-block .cm-activeLine) {
  background: rgba(148, 163, 184, 0.07);
}

.md-editor :deep(.markdown-body .milkdown-code-block .cm-activeLineGutter) {
  color: #c4b5fd;
  background: transparent;
}

.md-editor :deep(.markdown-body .milkdown-code-block .cm-selectionBackground),
.md-editor :deep(.markdown-body .milkdown-code-block .cm-content ::selection) {
  background: rgba(102, 126, 234, 0.3) !important;
}

/* 未选择语言时的占位区域 */
.md-editor :deep(.markdown-body .milkdown-code-block .milkdown-code-block-placeholder) {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #cbd5e1;
  white-space: pre-wrap;
}

/* 普通 pre（非 crepe 代码块）*/
.md-editor :deep(.markdown-body pre:not(.milkdown-code-block-placeholder)) {
  background: linear-gradient(180deg, rgba(72, 62, 140, 0.26), rgba(34, 29, 74, 0.40));
  border: 1px solid rgba(167, 139, 250, 0.20);
  border-radius: 10px;
  padding: 12px 14px;
  margin: 12px 0;
  overflow-x: auto;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
}

.md-editor :deep(.markdown-body pre code) {
  background: transparent;
  border: none;
  padding: 0;
  color: #d6e2ff;
  font-size: 13px;
  font-family: inherit;
}


</style>
