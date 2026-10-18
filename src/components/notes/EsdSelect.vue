<template>
  <div ref="rootRef" class="esd-select" :class="{ 'is-open': open, 'is-disabled': disabled }">
    <!-- 触发条：宽度即面板宽度的基准 -->
    <button
      ref="triggerRef"
      type="button"
      class="esd-select-trigger"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="esd-select-value" :title="displayText">{{ displayText }}</span>
      <span class="esd-select-arrow" aria-hidden="true">▾</span>
    </button>

    <!-- 弹出面板：用 fixed 定位跟随触发条，避免被 .dialog-body 的 overflow 裁掉 -->
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="esd-select-panel"
        :style="panelStyle"
        role="listbox"
        @mousedown="onPanelMousedown"
      >
        <!-- 搜索过滤：选项多时（如 139 种语言）必用 -->
        <div v-if="searchable" class="esd-select-search">
          <input
            ref="searchRef"
            v-model="query"
            class="esd-select-search-input"
            type="text"
            spellcheck="false"
            :placeholder="searchPlaceholder"
            @keydown="onPanelKeydown"
          >
        </div>

        <div ref="listRef" class="esd-select-list">
          <button
            v-for="(opt, i) in filtered"
            :key="opt.value"
            type="button"
            class="esd-select-option"
            :class="{ 'is-active': opt.value === modelValue, 'is-hover': i === hoverIndex }"
            role="option"
            :aria-selected="opt.value === modelValue"
            @click="choose(opt)"
            @mouseenter="hoverIndex = i"
          >
            <span v-if="opt.badge" class="esd-select-badge">{{ opt.badge }}</span>
            <span class="esd-select-option-text">{{ opt.label }}</span>
          </button>
          <div v-if="!filtered.length" class="esd-select-empty">{{ emptyText }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * 自定义下拉选择器：替代 Electron/浏览器原生 <select>。
 *
 * 为什么要自己写：
 *  1) 原生 select 在下拉展开时由操作系统绘制，样式完全不可控（用户明确反馈「很丑」），
 *     且长列表的滚动条也拿不到项目自定义滚动条；
 *  2) 原生 select 的面板宽度由内容决定，无法与触发区严格等宽（用户明确要求等宽）。
 *
 * 两个实现要点：
 *  - 面板用 `position: fixed` + 由触发条 getBoundingClientRect() 计算坐标，
 *    而不是放在触发条的父容器里。因为弹窗的 .dialog-body 有 overflow-y:auto，
 *    内联下拉会被它裁剪；fixed 定位脱离该裁剪上下文，同时仍能跟随触发条。
 *  - 列表容器保持 `overflow-y: auto`，项目里的 ScrollbarManager 会自动为它挂上
 *    自定义滚动条（它扫描全文档、给所有 overflow 为 auto/scroll 的元素挂载），
 *    所以这里**不需要**手动调用 attachCustomScrollbar。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export interface EsdSelectOption {
  label: string
  value: string
  /** 可选的短徽标（如引用用 ❝、标题用 H2） */
  badge?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: EsdSelectOption[]
  /** 是否提供搜索过滤（选项很多时开启） */
  searchable?: boolean
  searchPlaceholder?: string
  emptyText?: string
  placeholder?: string
  disabled?: boolean
}>(), {
  searchable: false,
  searchPlaceholder: '搜索…',
  emptyText: '无匹配项',
  placeholder: '请选择',
  disabled: false
})

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

const open = ref(false)
const query = ref('')
const hoverIndex = ref(0)
/** 面板坐标（相对视口） */
const panelStyle = ref<Record<string, string>>({})

const displayText = computed(() => {
  const hit = props.options.find(o => o.value === props.modelValue)
  return hit ? hit.label : (props.modelValue || props.placeholder)
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q || !props.searchable) return props.options
  return props.options.filter(o =>
    o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q)
  )
})

/** 计算面板位置与宽度：宽度严格等于触发条宽度（用户明确要求） */
const updatePanelPosition = () => {
  const trigger = triggerRef.value
  if (!trigger) return
  const r = trigger.getBoundingClientRect()
  const width = Math.round(r.width)
  // 估算面板高度，用于判断「向下展开是否会超出视口」，超出则向上弹
  const estimated = Math.min(props.options.length * 34 + (props.searchable ? 44 : 8) + 8, 300)
  const spaceBelow = window.innerHeight - r.bottom
  const dropUp = spaceBelow < estimated + 12 && r.top > estimated + 12
  const top = dropUp ? Math.max(8, r.top - estimated - 6) : r.bottom + 6
  panelStyle.value = {
    position: 'fixed',
    left: `${Math.round(r.left)}px`,
    /* 宽度与触发区完全一致——用户要求「弹出来的下拉列表的宽度要与触发区域的宽度相同」 */
    width: `${width}px`,
    top: `${Math.round(top)}px`,
    maxHeight: `${Math.max(120, Math.min(300, dropUp ? r.top - 12 : spaceBelow - 12))}px`,
  }
}

const openPanel = async () => {
  if (props.disabled) return
  open.value = true
  query.value = ''
  // 定位需要等 DOM 就绪（面板宽高会影响 maxHeight 判断）
  await nextTick()
  updatePanelPosition()
  // 当前选中项滚到可见位置
  const idx = filtered.value.findIndex(o => o.value === props.modelValue)
  hoverIndex.value = idx >= 0 ? idx : 0
  await nextTick()
  scrollHoverIntoView()
  if (props.searchable) searchRef.value?.focus()
}

const closePanel = () => {
  open.value = false
  query.value = ''
}

const toggle = () => (open.value ? closePanel() : void openPanel())

const choose = (opt: EsdSelectOption) => {
  emit('update:modelValue', opt.value)
  closePanel()
}

const scrollHoverIntoView = () => {
  const list = listRef.value
  if (!list) return
  const el = list.children[hoverIndex.value] as HTMLElement | undefined
  if (!el || !(el instanceof HTMLElement)) return
  const top = el.offsetTop
  const bottom = top + el.offsetHeight
  if (top < list.scrollTop) list.scrollTop = top
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
}

/** 触发条上的键盘操作 */
const onTriggerKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    void openPanel()
  }
}

/** 面板内键盘操作：过滤框与列表共用 */
const onPanelKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closePanel()
    focusTrigger()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const opt = filtered.value[hoverIndex.value]
    if (opt) choose(opt)
    return
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (!filtered.value.length) return
    const delta = e.key === 'ArrowDown' ? 1 : -1
    hoverIndex.value = (hoverIndex.value + delta + filtered.value.length) % filtered.value.length
    void nextTick(scrollHoverIntoView)
  }
}

const focusTrigger = () => triggerRef.value?.focus()

// 过滤结果变化时把高亮项归位，避免越界；查询变化时重新从第一项开始
watch(query, () => {
  hoverIndex.value = 0
})
watch(filtered, () => {
  if (hoverIndex.value >= filtered.value.length) hoverIndex.value = 0
})

const onDocumentPointerDown = (e: MouseEvent) => {
  if (!open.value) return
  const target = e.target as Node
  if (rootRef.value?.contains(target) || panelRef.value?.contains(target)) return
  closePanel()
}

/**
 * 面板内的 mousedown：
 *  - 点搜索框时**不能** preventDefault，否则输入框拿不到焦点、无法打字；
 *  - 点选项时要 preventDefault，避免焦点从搜索框移走导致列表失焦闪烁。
 */
const onPanelMousedown = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('.esd-select-search')) return
  e.preventDefault()
}

const onViewportChange = () => {
  if (open.value) updatePanelPosition()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown, true)
  // 滚动/缩放时面板需要跟随（fixed 定位不会自动跟随）
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown, true)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})

defineExpose({ open: openPanel, close: closePanel })
</script>

<style scoped>
.esd-select { position: relative; width: 100%; }

.esd-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.16s, background 0.16s;
}

.esd-select-trigger:hover:not(:disabled) { background: rgba(102, 126, 234, 0.14); }
.esd-select.is-open .esd-select-trigger {
  border-color: rgba(102, 126, 234, 0.55);
  background: rgba(102, 126, 234, 0.16);
}
.esd-select-trigger:disabled { opacity: 0.5; cursor: not-allowed; }

.esd-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.esd-select-arrow {
  flex-shrink: 0;
  font-size: 10px;
  color: rgba(148, 163, 184, 0.9);
  transition: transform 0.16s;
}
.esd-select.is-open .esd-select-arrow { transform: rotate(180deg); }
</style>

<!-- 面板 teleport 到 body，不能用 scoped 样式（scoped 属性不会加到 body 下的节点） -->
<style>
.esd-select-panel {
  z-index: 10060;                /* 高于弹窗(9999)与滚动条(10050) */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 6px;
  background: rgba(23, 22, 48, 0.98);
  border: 1px solid rgba(102, 126, 234, 0.35);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.esd-select-search { padding: 2px 2px 6px; }

.esd-select-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  font-size: 12px;
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  outline: none;
}
.esd-select-search-input:focus { border-color: rgba(102, 126, 234, 0.5); }
.esd-select-search-input::placeholder { color: rgba(148, 163, 184, 0.6); }

/* 列表自身 overflow-y:auto —— 项目 ScrollbarManager 会自动挂上自定义滚动条 */
.esd-select-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.esd-select-option {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  color: #cbd5e1;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}

.esd-select-option.is-hover { background: rgba(102, 126, 234, 0.22); }

.esd-select-option.is-active {
  color: #e0e7ff;
  font-weight: 600;
  background: rgba(102, 126, 234, 0.32);
}

.esd-select-badge {
  flex-shrink: 0;
  min-width: 22px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  color: #c4b5fd;
  background: rgba(196, 181, 253, 0.14);
  border-radius: 4px;
}

.esd-select-option-text {
  flex: 1;
  min-width: 0;
  /* 长文本省略号——「本笔记中的块」的文本可能很长 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.esd-select-empty {
  padding: 10px 8px;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.75);
  text-align: center;
}
</style>
