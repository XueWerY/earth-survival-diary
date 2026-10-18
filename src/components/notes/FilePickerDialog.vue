<template>
  <!--
    z-index 取 10100：高于项目自绘滚动条层（.app-scrollbar-track 基础 10050，
    并且它按「宿主祖先最大 z-index + 1」计算），避免像快捷键弹窗那样被列表滚动条盖住。
    auto-height：让 BaseDialog 的 body 不自己滚动，由内部各列表单独滚动，
    避免「弹窗套多层滚动条」。
  -->
  <BaseDialog
    :visible="visible"
    :title="title"
    :width="640"
    :z-index="10100"
    auto-height
    @update:visible="emit('update:visible', $event)"
  >
    <div class="fp">
      <!-- 常用位置 + 盘符快捷入口 -->
      <div class="fp-shortcuts">
        <button
          v-for="root in roots"
          :key="root.path"
          type="button"
          class="fp-chip"
          :class="{ on: isCurrent(root.path) }"
          :title="root.path"
          @click="go(root.path)"
        >{{ root.label }}</button>
        <button
          v-for="drive in drives"
          :key="drive"
          type="button"
          class="fp-chip"
          :class="{ on: isCurrent(drive) }"
          @click="go(drive)"
        >{{ drive.replace('\\', '') }}</button>
      </div>

      <!-- 当前路径 + 上一级 -->
      <div class="fp-pathbar">
        <button type="button" class="fp-up" :disabled="!currentParent" title="上一级" @click="goUp">
          ↑
        </button>
        <input
          v-model="pathDraft"
          class="fp-path-input"
          type="text"
          spellcheck="false"
          placeholder="绝对路径"
          @keydown.enter.prevent="go(pathDraft)"
        >
        <button type="button" class="fp-go" title="前往该路径" @click="go(pathDraft)">前往</button>
      </div>

      <!-- 文件列表（自身 overflow-y:auto → 自动获得项目自定义滚动条） -->
      <div ref="listRef" class="fp-list" tabindex="0" @keydown="onListKeydown">
        <div v-if="loading" class="fp-state">正在读取目录…</div>
        <template v-else>
          <button
            v-for="entry in visibleEntries"
            :key="entry.path"
            type="button"
            class="fp-item"
            :class="{ 'is-dir': entry.isDirectory, 'is-active': entry.path === activePath }"
            @click="onEntryClick(entry)"
            @dblclick="onEntryDblClick(entry)"
          >
            <span class="fp-item-icon">{{ entry.isDirectory ? '📁' : '📄' }}</span>
            <span class="fp-item-name" :title="entry.name">{{ entry.name }}</span>
            <span v-if="!entry.isDirectory" class="fp-item-size">{{ formatSize(entry.size) }}</span>
          </button>
          <div v-if="!visibleEntries.length" class="fp-state">
            {{ errorMessage || (hasAnyVisibleEntry ? '该目录下没有目标类型的文件' : '该目录为空') }}
          </div>
        </template>
      </div>

      <p class="fp-hint">
        双击文件夹进入；单击选中 .md 文件后点「打开」。
        <template v-if="extensions.length">仅显示 {{ extensions.map(e => '.' + e).join(' / ') }} 文件。</template>
      </p>
      <p v-if="errorMessage" class="fp-error">{{ errorMessage }}</p>
    </div>

    <template #footer>
      <button type="button" class="fp-btn" @click="emit('update:visible', false)">取消</button>
      <button type="button" class="fp-btn fp-btn-primary" :disabled="!selectedFile" @click="confirm">
        打开
      </button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
/**
 * 应用内文件选择弹窗（替代 Electron 原生 openFileDialog）。
 *
 * 为什么不用原生：原生系统文件框由操作系统绘制，风格与本应用完全脱节（用户明确要求替换）。
 *
 * 为什么不用 readDirectory：该 IPC 有 isPathAllowed() 白名单，只允许 userData/logs 与插件目录，
 * 而这里要浏览用户任意位置的 .md 文件，用它必然 "Access denied"。
 * 因此主进程新增了 listDirectoryForPicker（只读、只返回元信息），本组件用它列目录。
 *
 * 滚动条：列表容器保持 overflow-y:auto，项目 ScrollbarManager 会自动为它挂上
 * 自绘滚动条（它扫描全文档、给所有 overflow 为 auto/scroll 的元素挂载）。
 */
import { computed, nextTick, ref, watch } from 'vue'
import BaseDialog from '../ui/BaseDialog.vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  /** 允许选择的文件扩展名（不含点），如 ['md','markdown'] */
  extensions?: string[]
  /** 起始目录 */
  initialPath?: string
}>(), {
  title: '打开文件',
  extensions: () => ['md', 'markdown'],
  initialPath: ''
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', filePath: string): void
}>()

interface PickerEntry { name: string; path: string; isDirectory: boolean; size: number }

const listRef = ref<HTMLElement | null>(null)
const currentDir = ref('')
const currentParent = ref<string | null>(null)
const entries = ref<PickerEntry[]>([])
const drives = ref<string[]>([])
const roots = ref<Array<{ label: string; path: string }>>([])
const pathDraft = ref('')
const activePath = ref('')
const loading = ref(false)
const errorMessage = ref('')

const isCurrent = (p: string) => !!p && currentDir.value.toLowerCase() === p.toLowerCase()

/** 只显示目录 + 目标扩展名的文件（目录始终显示，便于继续下钻） */
const visibleEntries = computed(() => {
  const exts = props.extensions.map(e => e.toLowerCase().replace(/^\./, ''))
  return entries.value.filter(entry => {
    if (entry.isDirectory) return true
    if (!exts.length) return true
    const dot = entry.name.lastIndexOf('.')
    if (dot < 0) return false
    return exts.includes(entry.name.slice(dot + 1).toLowerCase())
  })
})

/** 目录里是否存在任何目录项（用于区分「空目录」与「没有目标类型文件」） */
const hasAnyVisibleEntry = computed(() => entries.value.some(e => e.isDirectory))

const selectedFile = computed(() => {
  const hit = entries.value.find(e => e.path === activePath.value)
  return hit && !hit.isDirectory ? hit : null
})

const formatSize = (size: number) => {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 列出目录。
 * 优先用 listDirectoryForPicker；在旧版 preload（没有该接口）上退化为
 * 「要求用户手填绝对路径」——不做静默失败。
 */
const loadDir = async (dirPath: string) => {
  const target = String(dirPath || '').trim()
  if (!target) return
  loading.value = true
  errorMessage.value = ''
  try {
    const api = window.electronAPI
    if (!api?.listDirectoryForPicker) {
      errorMessage.value = '当前版本不支持目录浏览，请直接输入文件绝对路径'
      return
    }
    const result = await api.listDirectoryForPicker(target)
    if (!result?.ok) {
      errorMessage.value = result?.error || '无法读取该目录'
      return
    }
    currentDir.value = target
    pathDraft.value = target
    currentParent.value = result.parent
    entries.value = result.entries || []
    if (result.drives?.length) drives.value = result.drives
    activePath.value = ''
    // 键盘操作需要列表可聚焦
    await nextTick()
    listRef.value?.focus()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : '读取目录失败'
  } finally {
    loading.value = false
  }
}

const go = (dirPath: string) => { void loadDir(dirPath) }
const goUp = () => { if (currentParent.value) void loadDir(currentParent.value) }

const onEntryClick = (entry: PickerEntry) => {
  activePath.value = entry.path
}

/** 双击：目录则进入；文件则直接确认（与系统文件框习惯一致） */
const onEntryDblClick = (entry: PickerEntry) => {
  if (entry.isDirectory) {
    void loadDir(entry.path)
    return
  }
  activePath.value = entry.path
  confirm()
}

/** 列表键盘操作：↑↓ 移动选中、Enter 进入目录或确认、Backspace 上一级 */
const onListKeydown = (event: KeyboardEvent) => {
  const list = visibleEntries.value
  if (!list.length) return
  const index = list.findIndex(e => e.path === activePath.value)
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const next = index < 0 ? 0 : Math.min(index + 1, list.length - 1)
    activePath.value = list[next].path
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const next = index <= 0 ? 0 : index - 1
    activePath.value = list[next].path
    scrollActiveIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const hit = list[index >= 0 ? index : 0]
    if (!hit) return
    if (hit.isDirectory) void loadDir(hit.path)
    else { activePath.value = hit.path; confirm() }
  } else if (event.key === 'Backspace') {
    event.preventDefault()
    goUp()
  }
}

const scrollActiveIntoView = () => {
  const list = listRef.value
  if (!list) return
  const el = list.querySelector('.fp-item.is-active') as HTMLElement | null
  if (!el) return
  const top = el.offsetTop
  const bottom = top + el.offsetHeight
  if (top < list.scrollTop) list.scrollTop = top
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
}

const confirm = () => {
  const file = selectedFile.value
  if (!file) return
  emit('confirm', file.path)
  emit('update:visible', false)
}

/** 每次打开时初始化：读常用位置，并跳到起始目录 */
watch(() => props.visible, async (visible) => {
  if (!visible) return
  activePath.value = ''
  errorMessage.value = ''
  try {
    const api = window.electronAPI
    if (api?.getPickerRoots) roots.value = await api.getPickerRoots()
  } catch {
    roots.value = []
  }
  const start = props.initialPath || roots.value[0]?.path || ''
  if (start) {
    await loadDir(start)
    return
  }
  // 没有常用位置（例如某些系统取不到桌面/文档）时，退化为「先取一次盘符」，
  // 让弹窗至少给用户可点入口，而不是一片空白 + 报错。
  try {
    const api = window.electronAPI
    if (api?.listDirectoryForPicker) {
      const probe = await api.listDirectoryForPicker('')
      if (probe?.drives?.length) {
        drives.value = probe.drives
        errorMessage.value = '请从上方选择盘符或输入绝对路径'
        return
      }
    }
  } catch {
    /* 忽略：下面统一给提示 */
  }
  errorMessage.value = '请选择上方位置或输入绝对路径'
})
</script>

<style scoped>
.fp { display: flex; flex-direction: column; gap: 10px; }

.fp-shortcuts { display: flex; flex-wrap: wrap; gap: 6px; }

.fp-chip {
  padding: 4px 10px;
  font-size: 12px;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.16s, border-color 0.16s;
}
.fp-chip:hover { background: rgba(102, 126, 234, 0.2); }
.fp-chip.on { background: rgba(102, 126, 234, 0.34); border-color: rgba(102, 126, 234, 0.5); color: #e0e7ff; }

.fp-pathbar { display: flex; align-items: center; gap: 6px; }

.fp-up, .fp-go {
  flex-shrink: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  cursor: pointer;
}
.fp-up:disabled { opacity: 0.4; cursor: not-allowed; }
.fp-up:hover:not(:disabled), .fp-go:hover { background: rgba(102, 126, 234, 0.25); }

.fp-path-input {
  flex: 1;
  min-width: 0;
  padding: 6px 9px;
  font-size: 12px;
  color: #e2e8f0;
  background: rgba(15, 13, 34, 0.55);
  border: 1px solid rgba(167, 139, 250, 0.22);
  border-radius: 6px;
  outline: none;
}
.fp-path-input:focus { border-color: rgba(167, 139, 250, 0.55); }

/* 列表自身滚动 → 自动获得项目自绘滚动条；右侧留 4px 给轨道 */
.fp-list {
  height: 300px;
  overflow-y: auto;
  padding: 4px 4px 4px 0;
  background: rgba(15, 13, 34, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  outline: none;
}

.fp-item {
  display: flex;
  align-items: center;
  gap: 8px;
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
.fp-item:hover { background: rgba(102, 126, 234, 0.16); }
.fp-item.is-active { background: rgba(102, 126, 234, 0.34); color: #e0e7ff; }
.fp-item.is-dir .fp-item-name { color: #bfdbfe; }

.fp-item-icon { flex-shrink: 0; width: 18px; text-align: center; }

.fp-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fp-item-size { flex-shrink: 0; font-size: 11px; color: rgba(148, 163, 184, 0.7); }

.fp-state { padding: 14px 10px; font-size: 12px; color: rgba(148, 163, 184, 0.75); text-align: center; }

.fp-hint { margin: 0; font-size: 11px; color: rgba(148, 163, 184, 0.75); }
.fp-error { margin: 0; font-size: 12px; color: #fca5a5; }

.fp-btn {
  padding: 6px 18px;
  font-size: 13px;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  cursor: pointer;
}
.fp-btn:hover:not(:disabled) { background: rgba(102, 126, 234, 0.25); }
.fp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.fp-btn-primary { background: rgba(102, 126, 234, 0.42); color: #f1f5f9; font-weight: 600; }
</style>
