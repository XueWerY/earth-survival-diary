<template>
  <BaseDialog
    :visible="visible"
    :title="title"
    :width="kind === 'block-code' ? 560 : 440"
    teleport
    auto-height
    @update:visible="(v) => !v && close()"
  >
    <div class="insert-dialog">
      <!-- ====== 行内代码 ====== -->
      <template v-if="kind === 'inline-code'">
        <div class="insert-field">
          <span class="insert-label">
            代码内容
            <span class="insert-label-hint">单行，插入到光标处</span>
          </span>
          <input
            ref="inlineRef"
            v-model="inlineDraft"
            class="insert-input insert-input-mono"
            type="text"
            spellcheck="false"
            placeholder="如 npm install 或 console.log"
            @keydown.enter.prevent="confirm"
            @keydown.esc.prevent="close"
          />
        </div>
        <p v-if="error" class="insert-error">{{ error }}</p>
        <p v-else-if="inlineDraft.trim()" class="insert-preview-line"><code>{{ inlineDraft }}</code></p>
      </template>

      <!-- ====== 块级代码 ====== -->
      <template v-else-if="kind === 'block-code'">
        <div class="insert-row">
          <span class="insert-label">语言</span>
          <EsdSelect
            v-model="languageDraft"
            class="insert-select-custom"
            :options="languageOptions"
            searchable
            search-placeholder="搜索语言…"
            empty-text="没有匹配的语言"
          />
        </div>
        <div class="insert-field">
          <span class="insert-label">
            代码
            <span class="insert-label-hint">{{ grammarAvailable ? '将做该语言的语法解析审查' : '将做括号/引号配平审查' }}</span>
          </span>
          <textarea
            ref="codeRef"
            v-model="codeDraft"
            class="insert-textarea"
            rows="8"
            spellcheck="false"
            placeholder="粘贴或输入代码…"
            @keydown.ctrl.enter.prevent="confirm"
            @keydown.meta.enter.prevent="confirm"
            @keydown.esc.prevent="close"
            @scroll="syncGutter"
          ></textarea>
        </div>
        <p v-if="error" class="insert-error">{{ error }}</p>
        <p v-else-if="grammarChecking" class="insert-hint">正在语法解析…</p>
        <p v-else-if="codeDraft.trim()" class="insert-ok">审查通过 · 插入后默认显示预览，点「编辑」可改源码</p>
        <div v-if="previewHtml" class="insert-preview">
          <div class="insert-preview-head">预览</div>
          <pre class="insert-preview-body"><code class="hljs" v-html="previewHtml"></code></pre>
        </div>
        <p v-else-if="codeDraft.trim() && isLatex" class="insert-hint">LaTeX 公式将在插入后由公式引擎渲染</p>
      </template>

      <!-- ====== 链接 ====== -->
      <template v-else>
        <!-- 链接目标类型：外部地址 / 本笔记内的块（引用/标题）/ 其它笔记 -->
        <div class="insert-row">
          <span class="insert-label">链接到</span>
          <div class="insert-seg">
            <button
              v-for="t in LINK_TARGETS"
              :key="t.value"
              type="button"
              class="insert-seg-btn"
              :class="{ on: linkTarget === t.value }"
              @click="linkTarget = t.value"
            >{{ t.label }}</button>
          </div>
        </div>

        <!-- 外部地址 -->
        <div v-if="linkTarget === 'url'" class="insert-field">
          <span class="insert-label">链接地址</span>
          <input
            ref="urlRef"
            v-model="urlDraft"
            class="insert-input"
            type="text"
            spellcheck="false"
            placeholder="https://example.com"
            @keydown.enter.prevent="confirm"
            @keydown.esc.prevent="close"
          />
        </div>

        <!-- 本笔记内的块：引用块 / 标题（锚点跳转） -->
        <div v-else-if="linkTarget === 'anchor'" class="insert-field">
          <span class="insert-label">
            本笔记中的块
            <span class="insert-label-hint">点击后可跳转到该引用块/标题</span>
          </span>
          <EsdSelect
            v-if="anchors.length"
            v-model="anchorDraft"
            :options="anchorSelectOptions"
            empty-text="没有匹配的块"
            searchable
            search-placeholder="搜索引用块或标题…"
          />
          <p v-else class="insert-hint">本笔记里还没有引用块或标题可作为跳转目标</p>
        </div>

        <!-- 其它笔记（wiki 链接，点击跳转到那篇笔记） -->
        <div v-else class="insert-field">
          <span class="insert-label">
            目标笔记
            <span class="insert-label-hint">插入 [[笔记名]]，点击可跳转</span>
          </span>
          <EsdSelect
            v-if="noteOptions.length"
            v-model="noteDraft"
            :options="noteSelectOptions"
            searchable
            search-placeholder="搜索笔记…"
            empty-text="没有匹配的笔记"
          />
          <input
            v-else
            v-model="noteDraft"
            class="insert-input"
            type="text"
            placeholder="输入笔记名（不存在则点击时创建）"
            @keydown.enter.prevent="confirm"
            @keydown.esc.prevent="close"
          />
        </div>

        <div class="insert-field">
          <span class="insert-label">链接文字 <span class="insert-label-hint">留空则用地址/目标名</span></span>
          <input
            v-model="textDraft"
            class="insert-input"
            type="text"
            placeholder="显示给读者看的文字"
            @keydown.enter.prevent="confirm"
            @keydown.esc.prevent="close"
          />
        </div>
        <p v-if="error" class="insert-error">{{ error }}</p>
        <p v-else class="insert-hint">{{ linkHint }}</p>
      </template>
    </div>

    <template #footer>
      <button class="ins-btn" @click="close">
        <svg class="ins-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        <span>取消</span>
      </button>
      <button class="ins-btn ins-btn-primary" :disabled="!canSubmit" @click="confirm">
        <svg class="ins-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
        <span>插入</span>
      </button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import BaseDialog from '../ui/BaseDialog.vue'
import EsdSelect, { type EsdSelectOption } from './EsdSelect.vue'
import { CODE_LANGUAGES, resolveLanguage, validateCode } from '../editor/codeLanguages'
import { validateLinkUrl, validateInlineCode, renderPreviewHtml } from '../editor/codePreviewBridge'
// 编辑器自带的语言全集（与代码容器工具栏下拉同源，约 140 种）+ 真语法解析
import { languageCatalog, checkWithGrammar, hasStrictGrammar } from '../editor/codeGrammar'

export type InsertKind = 'inline-code' | 'block-code' | 'link'

const props = withDefaults(defineProps<{
  visible: boolean
  kind: InsertKind
  /** 链接：初始文字（通常是被选中的文本） */
  initialLinkText?: string
  /** 链接：是否有选中文本（决定提示文案） */
  hasSelection?: boolean
  /** 块级代码：默认语言 */
  initialLanguage?: string
  /** 链接：本笔记内可作为跳转目标的块（引用块/标题） */
  anchors?: Array<{ id: string; kind: 'quote' | 'heading'; text: string; firstLine?: string; level?: number }>
  /** 链接：可跳转的其它笔记名 */
  noteOptions?: string[]
}>(), {
  initialLinkText: '',
  hasSelection: false,
  initialLanguage: 'JavaScript',
  anchors: () => [],
  noteOptions: () => []
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm-inline-code', payload: { text: string }): void
  (e: 'confirm-block-code', payload: { language: string; code: string }): void
  (e: 'confirm-link', payload: { url: string; text: string }): void
}>()

/** 链接目标类型 */
const LINK_TARGETS = [
  { value: 'url', label: '外部地址' },
  { value: 'anchor', label: '本笔记的块' },
  { value: 'note', label: '其它笔记' },
] as const
type LinkTarget = typeof LINK_TARGETS[number]['value']

const linkTarget = ref<LinkTarget>('url')
const anchorDraft = ref('')
const noteDraft = ref('')

const inlineRef = ref<HTMLInputElement | null>(null)
const codeRef = ref<HTMLTextAreaElement | null>(null)
const urlRef = ref<HTMLInputElement | null>(null)

const inlineDraft = ref('')
const codeDraft = ref('')
const languageDraft = ref(props.initialLanguage)
const urlDraft = ref('https://')
const textDraft = ref('')
const touched = ref(false)

/**
 * 语言下拉项：优先用编辑器注册进来的全集（与代码容器工具栏一致）；
 * 编辑器尚未就绪时退回内置目录，避免下拉为空。
 */
const languageOptions = computed<EsdSelectOption[]>(() => {
  const fromEditor = languageCatalog.value
  if (fromEditor.length) return fromEditor.map(item => ({ label: item.label, value: item.id }))
  return CODE_LANGUAGES.map(item => ({ label: item.label, value: item.id }))
})

/**
 * 「本笔记中的块」下拉项：把 kind/level 折成短徽标（❝ / H1…）。
 *
 * 用户要求：**引用块只显示第一行内容**。
 * 原因：引用块可能含多段文字，整段塞进下拉项会非常长、把其它选项挤走；
 * 而锚点本来就是按「首段」定位的（见 collectMarkdownAnchors 的 break），
 * 只显示首行与跳转目标一致，也更容易辨认。
 * 标题项本身是单行，保持原样。
 */
const anchorSelectOptions = computed<EsdSelectOption[]>(() =>
  (props.anchors || []).map(a => ({
    value: a.id,
    badge: a.kind === 'quote' ? '❝' : `H${a.level || 1}`,
    // 引用只显示第一行（上游 collectMarkdownAnchors 已提供 firstLine）
    label: a.kind === 'quote' ? (a.firstLine || firstLineOf(a.text)) : a.text,
  }))
)

/** 兜底：若上游未提供 firstLine，则按换行取首行 */
function firstLineOf(text: string): string {
  const raw = String(text || '')
  return (raw.split(/\r?\n/)[0] || '').trim()
}

/** 「目标笔记」下拉项 */
const noteSelectOptions = computed<EsdSelectOption[]>(() =>
  (props.noteOptions || []).map(n => ({ label: n, value: n }))
)

/** 当前语言是否有「会真正报错」的语法解析器（决定提示文案与是否等待解析） */
const grammarAvailable = computed(() => hasStrictGrammar(languageDraft.value))

const title = computed(() => {
  if (props.kind === 'link') return '插入链接'
  return props.kind === 'block-code' ? '插入块级代码' : '插入行内代码'
})
const isLatex = computed(() => resolveLanguage(languageDraft.value).aliases.includes('latex'))

/**
 * 真语法解析的结果（异步，仅对有 Lezer 解析器的语言）：
 *   null = 通过 / string = 报错 / undefined = 无解析器（改为只做专项检查）
 */
const grammarError = ref<string | null | undefined>(undefined)
/** 正在解析（避免用户以为已经通过） */
const grammarChecking = ref(false)
let grammarToken = 0

/**
 * 块级代码的最终错误：**专项检查 + 语法解析都要过**。
 *
 * 不能「有解析器就不跑专项检查」——实测 Lezer 的 HTML 解析器对未闭合标签是
 * 宽容的（`<div><p>x</div>` 也能解析通过），而标签配对恰是我们必须拦下的。
 * 因此两者并行，任一报错都不允许插入。
 */
const blockCodeError = computed(() => {
  const specialist = validateCode(languageDraft.value, codeDraft.value)
  if (specialist) return specialist
  if (grammarError.value !== undefined) return grammarError.value
  return null
})

/** 实时错误：未触碰前不打扰用户 */
const error = computed(() => {
  if (!touched.value) return null
  if (props.kind === 'inline-code') return validateInlineCode(inlineDraft.value)
  if (props.kind === 'block-code') return blockCodeError.value ?? null
  return linkError.value
})

const canSubmit = computed(() => {
  if (props.kind === 'inline-code') return !validateInlineCode(inlineDraft.value)
  if (props.kind === 'block-code') {
    // 解析中或待解析时先不禁用（避免抖动），点插入会再做一次同步确认
    if (grammarChecking.value) return true
    return !blockCodeError.value
  }
  return !linkError.value
})

/**
 * 触发真语法解析（语言或代码变化后防抖）。
 * 解析结果只认最后一次（用 token 丢弃过期结果）。
 */
let grammarTimer: ReturnType<typeof setTimeout> | null = null
const scheduleGrammarCheck = () => {
  if (grammarTimer) clearTimeout(grammarTimer)
  grammarTimer = setTimeout(async () => {
    grammarTimer = null
    if (props.kind !== 'block-code' || !codeDraft.value.trim()) {
      grammarError.value = undefined
      grammarChecking.value = false
      return
    }
    // 该语言没有 Lezer 解析器 → 不必等待，直接置为「无解析器」
    // （LaTeX 走专项检查；若不提前返回，提示会一直停在「正在语法解析…」）
    if (!grammarAvailable.value) {
      grammarError.value = undefined
      grammarChecking.value = false
      return
    }
    const token = ++grammarToken
    grammarChecking.value = true
    try {
      const result = await checkWithGrammar(languageDraft.value, codeDraft.value)
      if (token !== grammarToken) return
      grammarError.value = result
    } catch {
      if (token === grammarToken) grammarError.value = undefined
    } finally {
      if (token === grammarToken) grammarChecking.value = false
    }
  }, 250)
}

/** 块级代码的着色预览（LaTeX 除外——由编辑器 katex 管线渲染） */
const previewHtml = computed(() => {
  if (props.kind !== 'block-code') return ''
  if (isLatex.value) return ''
  if (blockCodeError.value) return ''
  return renderPreviewHtml(languageDraft.value, codeDraft.value)
})

/** 链接各目标类型下的提示语与校验 */
const anchorOptions = computed(() => props.anchors || [])
const noteOptions = computed(() => props.noteOptions || [])

/** 当前链接目标的校验错误（按目标类型分支） */
const linkError = computed<string | null>(() => {
  if (props.kind !== 'link') return null
  if (linkTarget.value === 'url') return validateLinkUrl(urlDraft.value)
  if (linkTarget.value === 'anchor') {
    if (!anchorDraft.value) return '请选择要链接到的块'
    return null
  }
  if (!noteDraft.value.trim()) return '请选择或输入目标笔记'
  return null
})

const linkHint = computed(() => {
  const selected = props.hasSelection ? '已选中文字：确认后变成链接' : '未选中文字：在光标处插入链接文字'
  if (linkTarget.value === 'anchor') return `${selected}；点击跳转到该引用块/标题`
  if (linkTarget.value === 'note') return `${selected}；点击跳转到那篇笔记`
  return selected
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  touched.value = false
  inlineDraft.value = ''
  codeDraft.value = ''
  languageDraft.value = props.initialLanguage || 'JavaScript'
  urlDraft.value = 'https://'
  textDraft.value = props.initialLinkText
  // 链接目标默认外部地址；笔记有锚点时也默认外部，避免误插
  linkTarget.value = 'url'
  anchorDraft.value = props.anchors?.[0]?.id || ''
  noteDraft.value = props.noteOptions?.[0] || ''
  void nextTick(() => {
    if (props.kind === 'inline-code') inlineRef.value?.focus()
    else if (props.kind === 'block-code') codeRef.value?.focus()
    else if (linkTarget.value === 'url') {
      urlRef.value?.focus()
      urlRef.value?.setSelectionRange(urlDraft.value.length, urlDraft.value.length)
    }
  })
})

watch([inlineDraft, codeDraft, urlDraft, languageDraft, linkTarget, anchorDraft, noteDraft], () => {
  touched.value = true
  if (props.kind === 'block-code') scheduleGrammarCheck()
})

const close = () => emit('update:visible', false)

const confirm = () => {
  if (!canSubmit.value) {
    touched.value = true
    return
  }
  if (props.kind === 'inline-code') {
    emit('confirm-inline-code', { text: inlineDraft.value })
  } else if (props.kind === 'block-code') {
    emit('confirm-block-code', { language: languageDraft.value, code: codeDraft.value.replace(/\s+$/, '') })
  } else {
    let url = urlDraft.value.trim()
    let fallbackText = url
    if (linkTarget.value === 'anchor') {
      url = `#${anchorDraft.value}`
      fallbackText = anchorOptions.value.find(a => a.id === anchorDraft.value)?.text || '跳转'
    } else if (linkTarget.value === 'note') {
      const name = noteDraft.value.trim()
      // 其它笔记用 wiki 链接语法，点击由 NotesPage 的既有链接解析处理
      url = `[[${name}]]`
      fallbackText = name
    }
    emit('confirm-link', { url, text: textDraft.value.trim() || fallbackText })
  }
  emit('update:visible', false)
}

/** textarea 滚动时同步行号列（若存在） */
const syncGutter = () => {
  const gutter = codeRef.value?.parentElement?.querySelector('.insert-gutter') as HTMLElement | null
  if (gutter && codeRef.value) gutter.scrollTop = codeRef.value.scrollTop
}
</script>

<style scoped>
.insert-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 340px;
}

.insert-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.insert-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.insert-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(226, 232, 240, 0.85);
}

/* 链接目标类型分段选择 */
.insert-seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.insert-seg-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(203, 213, 225, 0.85);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.16s, color 0.16s;
}

.insert-seg-btn:hover { background: rgba(102, 126, 234, 0.16); }

.insert-seg-btn.on {
  background: rgba(102, 126, 234, 0.32);
  color: #e0e7ff;
  font-weight: 600;
}

.insert-label-hint {
  font-size: 11px;
  font-weight: 400;
  color: rgba(148, 163, 184, 0.75);
}

.insert-input,
.insert-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 11px;
  border-radius: 9px;
  background: rgba(15, 13, 34, 0.55);
  border: 1px solid rgba(167, 139, 250, 0.22);
  color: #e2e8f0;
  font-size: 13px;
  line-height: 1.6;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

/* 自定义下拉的占位宽度：让「语言」行里的下拉与输入框观感一致 */
.insert-select-custom {
  flex: 1;
  min-width: 0;
}

.insert-input-mono,
.insert-textarea {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace;
}

.insert-textarea {
  resize: vertical;
  min-height: 150px;
  tab-size: 2;
}

.insert-input:focus,
.insert-textarea:focus {
  border-color: rgba(167, 139, 250, 0.55);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.16);
}

.insert-input::placeholder,
.insert-textarea::placeholder {
  color: rgba(148, 163, 184, 0.5);
}

.insert-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: rgba(148, 163, 184, 0.7);
}

.insert-error {
  margin: 0;
  padding: 6px 9px;
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.28);
  color: #fca5a5;
  font-size: 12px;
  line-height: 1.5;
}

.insert-ok {
  margin: 0;
  font-size: 11px;
  color: rgba(134, 239, 172, 0.85);
}

.insert-preview-line code {
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(167, 139, 250, 0.12);
  color: #c4b5fd;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
}

/* 块级代码的着色预览 */
.insert-preview {
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(14, 11, 34, 0.5);
}

.insert-preview-head {
  padding: 5px 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: rgba(196, 181, 253, 0.7);
  background: rgba(167, 139, 250, 0.08);
  border-bottom: 1px solid rgba(167, 139, 250, 0.14);
}

.insert-preview-body {
  margin: 0;
  padding: 10px 12px;
  max-height: 220px;
  overflow: auto;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  color: #d6e2ff;
  white-space: pre;
}

.ins-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 20px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: transparent;
  color: rgba(226, 232, 240, 0.78);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.ins-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #f1f5f9;
}

.ins-btn-icon {
  width: 14px;
  height: 14px;
}

.ins-btn-primary {
  background: rgba(129, 140, 248, 0.22);
  border-color: rgba(167, 139, 250, 0.45);
  color: #ddd6fe;
}

.ins-btn-primary:hover:not(:disabled) {
  background: rgba(129, 140, 248, 0.36);
  border-color: rgba(196, 181, 253, 0.65);
  color: #f5f3ff;
}

.ins-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
