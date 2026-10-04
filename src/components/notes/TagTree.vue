<template>
  <div class="tag-tree">
    <button
      v-for="row in rows"
      :key="row.node.key"
      class="tt-row"
      :class="{ active: isActive(row.node) }"
      :style="{ paddingLeft: 10 + row.depth * 14 + 'px' }"
      @click="emit('select', row.node.tagId ?? 'v:' + row.node.path)"
    >
      <span
        class="tt-caret"
        :class="{ open: row.isOpen, leaf: !row.hasChildren }"
        @click.stop="row.hasChildren && toggle(row.node.key)"
      >
        <el-icon v-if="row.hasChildren"><ChevronRight /></el-icon>
      </span>
      <span class="tt-dot" :style="{ background: row.node.color }"></span>
      <span class="tt-label" :title="row.node.path">{{ row.node.label }}</span>
      <span class="tt-count">{{ row.node.count }}</span>
      <span v-if="row.node.tagId" class="tt-ops" @click.stop>
        <button class="tt-edit" title="编辑标签" @click="editTag(row.node.tagId!)">
          <el-icon><Pencil /></el-icon>
        </button>
      </span>
    </button>
    <div v-if="rows.length === 0" class="tt-empty">暂无标签</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, Pencil } from '@lucide/vue'
import { useNoteStore, type Tag } from '../../stores/noteStore'

interface TagNode {
  key: string          // 折叠状态键：真实标签用 tag id，虚拟父节点用 "v:" + 路径
  tagId: string | null // 真实标签 id；虚拟父节点（仅有子标签、自身不是标签）为 null
  path: string         // 完整路径，如 "项目/子项目"
  label: string        // 末段显示名
  color: string
  count: number        // 聚合计数 = 自身（若是真实标签）+ 全部后代
  children: TagNode[]
}

const props = defineProps<{ active: string }>()

const emit = defineEmits<{
  (e: 'select', viewId: string): void
  (e: 'edit', tag: Tag): void
}>()

const store = useNoteStore()
const collapsed = ref(new Set<string>())

const tree = computed<TagNode[]>(() => {
  const roots: TagNode[] = []
  // 按路径深度排序，保证父节点先于子节点创建
  const sorted = [...store.tags].sort((a, b) => {
    const da = a.name.split('/').length
    const db = b.name.split('/').length
    return da - db || a.name.localeCompare(b.name, 'zh')
  })
  const findChild = (list: TagNode[], label: string) => list.find(n => n.label === label)

  for (const tag of sorted) {
    const segments = tag.name.split('/')
    let list = roots
    let parentPath = ''
    for (let i = 0; i < segments.length; i++) {
      const isLeaf = i === segments.length - 1
      const path = parentPath ? parentPath + '/' + segments[i] : segments[i]
      let node = findChild(list, segments[i])
      if (!node) {
        node = { key: 'v:' + path, tagId: null, path, label: segments[i], color: 'rgba(255,255,255,0.28)', count: 0, children: [] }
        list.push(node)
      }
      if (isLeaf) {
        node.tagId = tag.id
        node.color = tag.color
        node.key = tag.id
      }
      parentPath = path
      list = node.children
    }
  }

  // 聚合计数自底向上：父节点 = 自身笔记数（若有）+ 后代笔记数
  const walk = (node: TagNode): number => {
    const own = node.tagId ? store.notes.filter(n => n.tagIds.includes(node.tagId!)).length : 0
    node.count = own + node.children.reduce((sum, child) => sum + walk(child), 0)
    return node.count
  }
  roots.forEach(walk)

  // 排序：同级按显示名（虚拟节点与真实标签混排）
  const sortNodes = (nodes: TagNode[]) => {
    nodes.sort((a, b) => a.label.localeCompare(b.label, 'zh'))
    nodes.forEach(n => sortNodes(n.children))
  }
  sortNodes(roots)
  return roots
})

const rows = computed(() => {
  const out: { node: TagNode; depth: number; hasChildren: boolean; isOpen: boolean }[] = []
  const walk = (nodes: TagNode[], depth: number) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0
      const isOpen = !collapsed.value.has(node.key)
      out.push({ node, depth, hasChildren, isOpen })
      if (hasChildren && isOpen) walk(node.children, depth + 1)
    }
  }
  walk(tree.value, 0)
  return out
})

const toggle = (key: string) => {
  const next = new Set(collapsed.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsed.value = next
}

const isActive = (node: TagNode) => props.active === (node.tagId ?? 'v:' + node.path)

const editTag = (tagId: string) => {
  const tag = store.tags.find(t => t.id === tagId)
  if (tag) emit('edit', tag)
}
</script>

<style scoped>
.tag-tree {
  display: flex;
  flex-direction: column;
}

.tt-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  margin-bottom: 2px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--chalk-white-70);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  text-align: left;
}

.tt-row:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--chalk-white-90);
}

.tt-row.active {
  background: rgba(102, 126, 234, 0.18);
  color: #93c5fd;
}

.tt-caret {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--chalk-dim);
  transition: transform 0.15s;
}

.tt-caret.open {
  transform: rotate(90deg);
}

.tt-caret.leaf {
  visibility: hidden;
}

.tt-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tt-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tt-count {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--chalk-dim);
  font-variant-numeric: tabular-nums;
}

.tt-row.active .tt-count {
  color: rgba(147, 197, 253, 0.7);
}

.tt-ops {
  display: none;
  align-items: center;
  flex-shrink: 0;
}

.tt-row:hover .tt-ops {
  display: inline-flex;
}

.tt-row:hover .tt-count {
  display: none;
}

.tt-edit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}

.tt-edit:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.tt-empty {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--chalk-dim);
}
</style>
