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
import { TextSelection } from '@milkdown/kit/prose/state'
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
import { readMediaAsset } from '../../services/mediaAssets'
import { storeMediaAsset } from '../../composables/useNoteMedia'
import type { SearchMatch } from '../../composables/useNoteSearch'
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

// 抹平尾部空行（沿用旧编辑器“无尾部换行”的输出约定），
// 并剥离旧版图片宽度语法 `{w:N}`（该语法已被 `{w=W,h=H}` 后缀取代，旧数据可能残留）。
// 注意：保留 `{w=W,h=H}` 尺寸后缀——它由 stripImageSizeSuffixes 在进入编辑器前剥离，
// 再由 restoreImageSizeSuffixes 在输出前拼回。
const normalize = (md: string): string =>
  (md || '')
    .replace(/!\[[^\]]*\]\([^)\s]+?\)\s*\{w:\d+\}/g, match => match.replace(/\s*\{w:\d+\}/, ''))
    .replace(/&#8203;|\u200b/gi, '')
    .replace(/\s+$/, '')

// Markdown 的强调语法在中文粗体标签后紧接汉字时可能无法识别闭合标记。
// 插入零宽 HTML 实体让闭合标记成为合法分隔符；导出与保存时由 normalize 移除它。
// 同时剥掉图片尺寸后缀，避免 Cream 把 `{w=,h=}` 当成 URL 的一部分。
const prepareMarkdown = (md: string): string => stripImageSizeSuffixes(normalize(md))
  .replace(/(\*\*[^*\n]+?\*\*)(?=[\u3400-\u9fff\uf900-\ufaff])/g, '$1&#8203;')

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
  syncedValue = normalize(restoreImageSizeSuffixes(initial))

  const instance = new Crepe({
    root,
    defaultValue: prepareMarkdown(initial),
    features: {
      [Crepe.Feature.Latex]: false,
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
      },
    },
  })

  // 自建 wiki-link：必须在 create() 之前注册（remark 解析 → schema → 输入规则）
  instance.editor.use(remarkWikiLink).use(wikiLinkSchema).use(wikiLinkInputRule)

  // 编辑器内搜索：装饰器插件，同样要在 create() 前注册
  instance.editor.use(editorSearchPlugin)

  // 必须在 create() 之前注册监听
  // markdownUpdated 收到的是 Cream 序列化结果（图片 URL 已剥掉尺寸后缀），
  // 这里把后缀拼回去，保证对外输出与存储的正文始终带尺寸信息。
  instance.on((api) => {
    api.markdownUpdated((_ctx, markdown) => {
      const next = normalize(restoreImageSizeSuffixes(markdown))
      if (next === syncedValue) return
      syncedValue = next
      emit('update:modelValue', next)
      emit('input', next)
    })
  })

  crepe = instance
  await instance.create()
  ready = true

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
    }
  }
  updateWikiSuggestion()
  refreshResolvedLinks()
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

// ====== 点击跳转 ======
const onRootClick = (e: MouseEvent) => {
  const el = (e.target as HTMLElement).closest?.(`span[data-type="${WIKI_LINK_NODE}"]`) as HTMLElement | null
  if (el) {
    e.preventDefault()
    e.stopPropagation()
    const target = (el.dataset.target || '').trim()
    if (target) emit('open-wiki-link', { target })
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

  syncedValue = normalize(restoreImageSizeSuffixes(next))
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
// 比较与存储都用「带尺寸后缀」的形态，进入编辑器则用 prepareMarkdown 剥离后缀。
watch(() => props.modelValue, (value) => {
  const next = normalize(value)
  if (!ready || next === syncedValue) return
  syncedValue = next
  crepe?.editor.action(replaceAll(prepareMarkdown(next), true))
  void resolveMediaReferencesInDom(crepeRootRef.value as HTMLElement)
})

const getValue = (): string =>
  ready ? normalize(restoreImageSizeSuffixes(crepe!.getMarkdown())) : normalize(props.modelValue)

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
  setSearchMatches,
  clearSearch,
  focusMatch,
  getActiveMatchRange,
  getMatchRanges,
})

// ====== 编辑器内搜索 ======
// 高亮用 ProseMirror 装饰器：只影响渲染、不写入 doc，因此不会触发自动保存，
// 正文里绝不会残留搜索痕迹。
//
// 关键技术点：PM 的 pos 与 markdown 字符偏移没有线性关系（节点边界、媒体节点
// 都会造成偏移），所以每次更新查询时都重建一张「markdown 区间 → PM 区间」的
// 分段线性映射表；映射失败的匹配直接丢弃（宁可少高亮，不可错位）。

interface BlockMapping {
  /** 该文本块在 markdown 中的区间 */
  mdStart: number
  mdEnd: number
  /** 该文本块在 PM 中的起始 pos */
  pmFrom: number
}

/** 当前搜索状态（含 markdown 匹配、映射后的 PM 区间与可高亮子集） */
const searchState = ref<{
  query: string
  matches: SearchMatch[]
  activeIndex: number
  /** markdown 匹配换算后的 PM 区间，与 matches 等长；null 表示该处无法映射 */
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

/** 遍历文档文本块，建立 markdown ↔ PM 的分段映射 */
function buildBlockMappings(markdown: string): BlockMapping[] {
  if (!view) return []
  const mappings: BlockMapping[] = []
  let searchFrom = 0

  view.state.doc.descendants((node, pos) => {
    if (!node.isTextblock || !node.textContent) return
    const text = node.textContent
    const found = markdown.indexOf(text, searchFrom)
    // 找不到就跳过该块：不参与映射，也绝不错位到别处
    if (found < 0) return
    mappings.push({ mdStart: found, mdEnd: found + text.length, pmFrom: pos + 1 })
    searchFrom = found + text.length
  })

  return mappings
}

/** 把 markdown 区间换算成 PM 区间；无法映射返回 null */
function toPmRange(mappings: BlockMapping[], start: number, end: number): { from: number; to: number } | null {
  for (const block of mappings) {
    if (start >= block.mdStart && end <= block.mdEnd) {
      // 同一块内：偏移差即为 PM 偏移差（块内无嵌套节点时成立）
      return {
        from: block.pmFrom + (start - block.mdStart),
        to: block.pmFrom + (end - block.mdStart),
      }
    }
  }
  return null
}

/** 重算匹配、映射与装饰器 */
function recomputeSearchDecorations() {
  if (!view) return
  const { matches, activeIndex } = searchState.value
  // 映射表只建一次：所有匹配共用
  const mappings = buildBlockMappings(normalize(crepe?.getMarkdown() || ''))
  const pmRanges = matches.map(match => toPmRange(mappings, match.start, match.end))
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

  const decorationSet = buildSearchDecorations(view.state.doc, ranges)
  // 通过 view.props.decorations 下发：setProps 本身就会触发重绘，
  // 无需再 dispatch；插件 state 同步更新仅供调试/未来扩展。
  view.setProps({ decorations: () => decorationSet })
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
 * 跳到指定匹配处：index 以 highlightable（可高亮子集）为基准。
 * 只设置选区并滚动进入视野——不调用 view.focus()：
 * 焦点必须留在搜索输入框，否则 Enter / Shift+Enter 会被 ProseMirror
 * 当作软换行命令处理，直接改坏正文（选中态下还会替换掉匹配文本）。
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
    const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to))
    view.dispatch(tr.scrollIntoView())
  }

  recomputeSearchDecorations()
  return true
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

.md-editor :deep(.markdown-body p) {
  margin: 0;
  text-indent: 2em;
}

.md-editor :deep(.markdown-body li p),
.md-editor :deep(.markdown-body blockquote p) {
  text-indent: 0;
}

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
