import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '../lib/logger'
import {
  listNotes,
  createNote,
  patchNote,
  deleteNoteById,
  getData,
  setData,
  type NoteRecord
} from '../services/storageService'
import { guideContent } from '../data/guideContent'

const GUIDE_NOTE_ID = 'guide-note'

// ============ 数据模型 ============
// 笔记以「标签」组织（tagIds 多标签），不再有单一 categoryId。
// categoryId 仅作为过渡期的派生字段保留给尚未重写的旧界面使用（阶段 2 移除）。

export interface Tag {
  id: string
  name: string        // 支持嵌套路径名，如 "项目/子项目"
  color: string
  order: number
}

export interface Note {
  id: string
  title: string
  content: string
  tagIds: string[]
  pinned: boolean
  trashedAt: string | null
  createdAt: string
  updatedAt: string
  /** @deprecated 过渡期派生字段：等于 tagIds[0] || ''，供旧界面读取；阶段 2 移除 */
  categoryId: string
}

/** @deprecated 过渡期兼容类型：由 Tag 派生，供旧界面读取；阶段 2 移除 */
export interface NoteCategory {
  id: string
  name: string
  color: string
  icon: string
  isCustom: boolean
}

// 旧默认分类（含图标）。迁移后作为默认标签播种，图标仅在兼容层用于展示。
export const DEFAULT_NOTE_CATEGORIES: NoteCategory[] = [
  { id: 'personal', name: '个人', icon: '📝', color: '#667eea', isCustom: false },
  { id: 'work', name: '工作', icon: '💼', color: '#3b82f6', isCustom: false },
  { id: 'study', name: '学习', icon: '📚', color: '#10b981', isCustom: false },
  { id: 'ideas', name: '灵感', icon: '💡', color: '#f59e0b', isCustom: false },
  { id: 'guide', name: '攻略', icon: '📖', color: '#ec4899', isCustom: false },
]

const DEFAULT_TAG_ICONS: Record<string, string> = Object.fromEntries(
  DEFAULT_NOTE_CATEGORIES.map(c => [c.id, c.icon])
)

export const DEFAULT_NOTE_COLORS = [
  '#667eea', '#f093fb', '#4facfe', '#43e97b',
  '#fa709a', '#fee140', '#a8edea', '#d299c2',
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
]

export const EXTENDED_NOTE_COLORS = [
  '#667eea', '#764ba2', '#f093fb', '#d53a9d', '#4facfe', '#00b4db', '#43e97b', '#11998e',
  '#fa709a', '#ee5a24', '#fee140', '#f6d365', '#a8edea', '#a18cd1', '#d299c2', '#fbc2eb',
  '#ff6b6b', '#4ecdc4', '#26d0ce', '#45b7d1', '#2b32b2', '#96ceb4', '#e1eec3', '#fc4a1a',
  '#f7b733', '#00b09b', '#96c93d', '#834d9b', '#d04ed6', '#2c3e50', '#3498db', '#e74c3c',
  '#f39c12', '#1abc9c', '#9b59b6', '#e67e22', '#2ecc71', '#e91e63', '#00bcd4', '#8e44ad',
]

// Markdown 大纲条目
export interface MdOutlineItem {
  level: number     // 1~6 对应 #~######
  text: string      // 标题文字
  line: number      // 在源码中的行号（从 0 开始）
}

// 从 markdown 文本中提取标题大纲
export const extractMdOutline = (markdown: string): MdOutlineItem[] => {
  if (!markdown) return []
  const lines = markdown.split('\n')
  const outline: MdOutlineItem[] = []
  lines.forEach((line, i) => {
    const match = line.match(/^(#{1,6})\s+(.+)/)
    if (match) {
      outline.push({ level: match[1].length, text: match[2].trim(), line: i })
    }
  })
  return outline
}

// 获取 markdown 纯文本（去除 markdown 语法标记，用于字数统计）
export const getMdPlainText = (markdown: string): string => {
  if (!markdown) return ''
  return markdown
    .replace(/^#{1,6}\s+/gm, '')          // 标题
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // 粗体/斜体
    .replace(/~~([^~]+)~~/g, '$1')        // 删除线
    .replace(/`{1,3}[^`]*`{1,3}/g, '')    // 代码
    .replace(/!\[.*?\]\(.*?\)/g, '')       // 图片
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1') // 链接
    .replace(/^>\s+/gm, '')                // 引用
    .replace(/^[-*+]\s+/gm, '')            // 无序列表
    .replace(/^\d+\.\s+/gm, '')            // 有序列表
    .replace(/^---+/gm, '')                // 分隔线
    .replace(/\|/g, ' ')                   // 表格分隔符
    .replace(/[-:]+/g, ' ')                // 表格对齐线
    .trim()
}

/** 把存储层的原始记录转成界面用的笔记对象，并补上过渡期的 categoryId 派生字段 */
function withDerived(note: NoteRecord): Note {
  return { ...note, categoryId: note.tagIds[0] || '' }
}

/** 回收站保留期：30 天，过期笔记在下次启动时清理 */
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export const useNoteStore = defineStore('note', () => {
  const notes = ref<Note[]>([])
  const trashedNotes = ref<Note[]>([])
  const tags = ref<Tag[]>([])
  const isLoaded = ref(false)

  /** @deprecated 过渡期兼容视图：把标签映射为旧分类形状，供尚未重写的旧界面读取 */
  const categories = computed<NoteCategory[]>(() =>
    tags.value.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      icon: DEFAULT_TAG_ICONS[t.id] || '🏷',
      isCustom: !DEFAULT_TAG_ICONS[t.id]
    }))
  )

  const loadData = async () => {
    if (isLoaded.value) return
    try {
      const [savedNotes, savedTags] = await Promise.all([
        listNotes(),
        getData<Tag[]>('notes', 'tags')
      ])

      // 标签为空时播种默认标签（兼容旧默认分类，兼容层会还原其图标）
      if (!savedTags || savedTags.length === 0) {
        tags.value = DEFAULT_NOTE_CATEGORIES.map((c, i) => ({
          id: c.id, name: c.name, color: c.color, order: i
        }))
        await saveTags()
      } else {
        tags.value = savedTags
        // 补齐缺失的内置标签
        const missing = DEFAULT_NOTE_CATEGORIES.filter(c => !tags.value.some(t => t.id === c.id))
        if (missing.length > 0) {
          missing.forEach(c => tags.value.push({ id: c.id, name: c.name, color: c.color, order: tags.value.length }))
          await saveTags()
        }
      }

      // 回收站：软删除的笔记单独存放，超过保留期（30 天）的启动时清理
      const activeList: Note[] = []
      const trashList: Note[] = []
      for (const n of savedNotes) {
        const note = withDerived(n)
        if (note.trashedAt) trashList.push(note)
        else activeList.push(note)
      }
      const now = Date.now()
      const expiredIds = new Set(
        trashList
          .filter(n => n.trashedAt && now - new Date(n.trashedAt).getTime() > TRASH_RETENTION_MS)
          .map(n => n.id)
      )
      if (expiredIds.size > 0) {
        await Promise.all([...expiredIds].map(id => deleteNoteById(id)))
        logger.info('[笔记] 清理过期回收站笔记', { count: expiredIds.size })
      }
      notes.value = activeList.filter(n => !expiredIds.has(n.id))
      trashedNotes.value = trashList.filter(n => !expiredIds.has(n.id))

      await ensureGuideNote()

      isLoaded.value = true
      logger.info('[笔记] 数据加载完成', {
        notes: notes.value.length,
        trashed: trashedNotes.value.length,
        tags: tags.value.length,
      })
    } catch (e) {
      logger.error('[笔记] 数据加载失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  const reset = () => {
    notes.value = []
    trashedNotes.value = []
    tags.value = []
    isLoaded.value = false
  }

  // 从服务端全量同步（速记捕获窗等其他写入方的变更感知）：
  // 主窗口失焦期间内容已强制落库，focus 回来时全量替换是安全的
  const syncFromRemote = async () => {
    if (!isLoaded.value) return
    try {
      const remote = await listNotes()
      const activeList: Note[] = []
      const trashList: Note[] = []
      for (const n of remote) {
        const note = withDerived(n)
        if (note.trashedAt) trashList.push(note)
        else activeList.push(note)
      }
      notes.value = activeList
      trashedNotes.value = trashList
    } catch (e) {
      logger.error('[笔记] 远程同步失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  const saveTags = async () => {
    try {
      await setData('notes', 'tags', tags.value)
    } catch (e) {
      logger.error('[笔记] 保存标签失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  // ========== 笔记操作（记录级读写，不做整份数组写回） ==========

  const addNote = async (
    data: { title: string; content?: string; pinned?: boolean; tagIds?: string[]; categoryId?: string }
  ): Promise<Note | null> => {
    try {
      const tagIds = data.tagIds ?? (data.categoryId ? [data.categoryId] : [])
      const created = await createNote({
        title: data.title,
        content: data.content || '',
        tagIds,
        pinned: !!data.pinned
      })
      if (!created) return null
      const note = withDerived(created)
      notes.value.unshift(note)
      logger.info('[笔记] 新增笔记', { id: note.id, title: note.title })
      return note
    } catch (e) {
      logger.error('[笔记] 新增笔记失败', { error: e instanceof Error ? e.message : String(e) })
      return null
    }
  }

  const updateNote = async (
    id: string,
    data: Partial<{ title: string; content: string; pinned: boolean; tagIds: string[]; categoryId: string; trashedAt: string | null }>
  ): Promise<boolean> => {
    try {
      const patch: Partial<NoteRecord> = {}
      if (data.title !== undefined) patch.title = data.title
      if (data.content !== undefined) patch.content = data.content
      if (data.pinned !== undefined) patch.pinned = data.pinned
      if (data.trashedAt !== undefined) patch.trashedAt = data.trashedAt
      if (data.tagIds !== undefined) patch.tagIds = data.tagIds
      else if (data.categoryId !== undefined) patch.tagIds = data.categoryId ? [data.categoryId] : []

      const saved = await patchNote(id, patch)
      if (!saved) return false

      const idx = notes.value.findIndex(n => n.id === id)
      if (idx !== -1) notes.value[idx] = withDerived(saved)
      logger.info('[笔记] 更新笔记', { id })
      return true
    } catch (e) {
      logger.error('[笔记] 更新笔记失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  const deleteNote = async (id: string): Promise<boolean> => {
    try {
      const ok = await deleteNoteById(id)
      if (!ok) return false
      // 彻底删除可能来自回收站：活跃与回收站两处都尝试摘除
      const idx = notes.value.findIndex(n => n.id === id)
      if (idx !== -1) notes.value.splice(idx, 1)
      const tIdx = trashedNotes.value.findIndex(n => n.id === id)
      if (tIdx !== -1) trashedNotes.value.splice(tIdx, 1)
      logger.info('[笔记] 删除笔记', { id })
      return true
    } catch (e) {
      logger.error('[笔记] 删除笔记失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  // ========== 回收站（软删除） ==========

  const trashNote = async (id: string): Promise<boolean> => {
    const note = notes.value.find(n => n.id === id)
    if (!note) return false
    const ok = await updateNote(id, { trashedAt: new Date().toISOString() })
    if (!ok) return false
    const idx = notes.value.findIndex(n => n.id === id)
    if (idx !== -1) {
      const [removed] = notes.value.splice(idx, 1)
      trashedNotes.value.unshift(removed)
    }
    logger.info('[笔记] 移入回收站', { id })
    return true
  }

  const restoreNote = async (id: string): Promise<boolean> => {
    const note = trashedNotes.value.find(n => n.id === id)
    if (!note) return false
    const ok = await updateNote(id, { trashedAt: null })
    if (!ok) return false
    const idx = trashedNotes.value.findIndex(n => n.id === id)
    if (idx !== -1) {
      const [removed] = trashedNotes.value.splice(idx, 1)
      notes.value.unshift(removed)
    }
    logger.info('[笔记] 从回收站恢复', { id })
    return true
  }

  const emptyTrash = async (): Promise<number> => {
    const ids = trashedNotes.value.map(n => n.id)
    await Promise.all(ids.map(id => deleteNoteById(id)))
    trashedNotes.value = []
    logger.info('[笔记] 清空回收站', { count: ids.length })
    return ids.length
  }

  // 置顶改为写在笔记自身的 pinned 字段（原先存在 notes:favorites 键，
  // 该键同时被导航收藏使用，两处互相覆盖，已废弃）
  const togglePin = async (id: string): Promise<boolean> => {
    const note = notes.value.find(n => n.id === id)
    if (!note) return false
    return updateNote(id, { pinned: !note.pinned })
  }

  // ========== 标签操作 ==========

  /** 归一化标签路径：去掉首尾与多余分隔符，如 " 项目 // 子项目 " → "项目/子项目" */
  const normalizeTagName = (raw: string): string =>
    raw.split('/').map(s => s.trim()).filter(Boolean).join('/')

  const genTagId = () => 'tag_' + Date.now().toString() + Math.random().toString(36).slice(2, 6)

  const newTag = (name: string): Tag => ({
    id: genTagId(),
    name,
    color: DEFAULT_NOTE_COLORS[tags.value.length % DEFAULT_NOTE_COLORS.length],
    order: tags.value.length
  })

  const addTag = async (data: { name: string; color?: string }): Promise<Tag | null> => {
    try {
      const name = normalizeTagName(data.name)
      if (!name) return null
      // 同名标签已存在：直接返回既有标签（供属性栏"输入即关联"复用）
      const existing = tags.value.find(t => t.name === name)
      if (existing) return existing
      // 自动创建缺失的祖先标签，保证树中父节点真实存在（如建 "项目/子项目" 时先建 "项目"）
      const segments = name.split('/')
      for (let i = 1; i < segments.length; i++) {
        const ancestorPath = segments.slice(0, i).join('/')
        if (!tags.value.some(t => t.name === ancestorPath)) {
          tags.value.push(newTag(ancestorPath))
        }
      }
      const tag: Tag = { ...newTag(name), ...(data.color ? { color: data.color } : {}) }
      tags.value.push(tag)
      await saveTags()
      logger.info('[笔记] 新增标签', { id: tag.id, name: tag.name })
      return tag
    } catch (e) {
      logger.error('[笔记] 新增标签失败', { error: e instanceof Error ? e.message : String(e) })
      return null
    }
  }

  const updateTag = async (id: string, data: Partial<Omit<Tag, 'id'>>): Promise<boolean> => {
    try {
      const idx = tags.value.findIndex(t => t.id === id)
      if (idx === -1) return false
      if (data.name !== undefined) {
        const newName = normalizeTagName(data.name)
        if (!newName) return false
        const oldName = tags.value[idx].name
        if (newName !== oldName) {
          // 与其他标签重名视为冲突（重命名后聚合路径会混乱），交由调用方提示
          if (tags.value.some(t => t.id !== id && t.name === newName)) return false
          // 重命名级联：后代标签的路径前缀同步更新，避免树断链
          const prefix = oldName + '/'
          tags.value.forEach((t, i) => {
            if (t.name.startsWith(prefix)) {
              tags.value[i] = { ...t, name: newName + t.name.slice(oldName.length) }
            }
          })
        }
        data = { ...data, name: newName }
      }
      tags.value[idx] = { ...tags.value[idx], ...data }
      await saveTags()
      logger.info('[笔记] 更新标签', { id })
      return true
    } catch (e) {
      logger.error('[笔记] 更新标签失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  // 删除标签：从所有笔记的 tagIds 中摘除，笔记本身保留；
  // 不级联删除后代标签——后代会在树中重挂到虚拟父节点下
  const deleteTag = async (id: string): Promise<boolean> => {
    try {
      const affected = notes.value.filter(n => n.tagIds.includes(id))
      await Promise.all(affected.map(n =>
        patchNote(n.id, { tagIds: n.tagIds.filter(t => t !== id) })
      ))
      affected.forEach(n => { n.tagIds = n.tagIds.filter(t => t !== id); n.categoryId = n.tagIds[0] || '' })

      tags.value = tags.value.filter(t => t.id !== id)
      await saveTags()
      logger.info('[笔记] 删除标签', { id, affected: affected.length })
      return true
    } catch (e) {
      logger.error('[笔记] 删除标签失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  const ensureGuideNote = async () => {
    if (notes.value.some(n => n.id === GUIDE_NOTE_ID)) return
    const created = await createNote({
      id: GUIDE_NOTE_ID,
      title: '使用指南',
      content: guideContent,
      tagIds: ['guide'],
      pinned: false
    })
    if (created) {
      notes.value.unshift(withDerived(created))
      logger.info('[笔记] 初始化使用指南笔记')
    }
  }

  return {
    notes,
    trashedNotes,
    tags,
    categories,
    isLoaded,
    loadData,
    syncFromRemote,
    reset,
    addNote,
    updateNote,
    deleteNote,
    trashNote,
    restoreNote,
    emptyTrash,
    togglePin,
    addTag,
    updateTag,
    deleteTag,
  }
})

// 热更新时重建 store 实例：否则 HMR 沿组件链更新后 Pinia 仍返回旧 setup 的
// 实例，新增的方法（如 syncFromRemote）会报 "is not a function"
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNoteStore, import.meta.hot))
}
