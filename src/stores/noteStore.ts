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

// ============ 数据模型 ============
// 笔记以「标签」组织（tagIds 多标签），不再有单一 categoryId。
// categoryId 仅作为过渡期的派生字段保留给尚未重写的旧界面使用（阶段 2 移除）。

export interface Tag {
  id: string
  name: string        // 支持嵌套路径名，如 "项目/子项目"
  color: string
  order: number
  folderPath: string  // 标签只属于一个笔记文件夹
}

export interface Note {
  id: string
  title: string
  content: string
  tagIds: string[]
  folderPath: string
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

// 默认标签集合；图标仅供旧笔记界面的兼容视图使用。
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
  // 代码围栏状态：``` / ~~~ 之内的「# 注释」不是标题，必须跳过，
  // 否则大纲会出现伪条目、且跳转行号指向注释行。
  let fence: { marker: string; length: number } | null = null
  lines.forEach((line, i) => {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      const length = fenceMatch[1].length
      if (!fence) {
        fence = { marker, length }
        return
      }
      // 同种标记且不短于开启长度 → 围栏闭合
      if (marker === fence.marker && length >= fence.length) {
        fence = null
        return
      }
      return
    }
    if (fence) return
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

export const useNoteStore = defineStore('note', () => {
  const notes = ref<Note[]>([])
  const tags = ref<Tag[]>([])
  const isLoaded = ref(false)
  // 笔记库切换时，旧库可能仍有未完成的异步读取。用代数丢弃这些迟到结果，
  // 避免旧库笔记在新库的目录树上重新出现。
  let dataGeneration = 0
  let syncGeneration = 0

  const normalizeTagFolderPath = (value: string | undefined) => String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const withScopedTags = (note: NoteRecord): Note => {
    const folderPath = normalizeTagFolderPath(note.folderPath)
    const tagIds = (note.tagIds || []).filter(id => tags.value.some(tag => tag.id === id && normalizeTagFolderPath(tag.folderPath) === folderPath))
    return withDerived({ ...note, folderPath, tagIds })
  }

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
    const generation = dataGeneration
    try {
      const [savedNotes, savedTags] = await Promise.all([
        listNotes(),
        getData<Tag[]>('notes', 'tags')
      ])
      if (generation !== dataGeneration) return

      // 首次使用且没有标签时初始化默认标签。
      if (!savedTags || savedTags.length === 0) {
        tags.value = DEFAULT_NOTE_CATEGORIES.map((c, i) => ({
          id: c.id, name: c.name, color: c.color, order: i, folderPath: ''
        }))
        await saveTags()
      } else {
        tags.value = savedTags.map(tag => ({ ...tag, folderPath: normalizeTagFolderPath(tag.folderPath) }))
        // 补齐缺失的内置标签
        const missing = DEFAULT_NOTE_CATEGORIES.filter(c => !tags.value.some(t => !t.folderPath && (t.id === c.id || t.name === c.name)))
        if (missing.length > 0) {
          missing.forEach(c => {
            const id = tags.value.some(t => t.id === c.id) ? `tag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : c.id
            tags.value.push({ id, name: c.name, color: c.color, order: tags.value.filter(t => !t.folderPath).length, folderPath: '' })
          })
          await saveTags()
        }
      }

      // 兼容旧版本留下的软删除记录：当前版本不再保留应用内回收站，启动时永久清理。
      const legacyTrash = savedNotes.filter(note => note.trashedAt)
      for (const note of legacyTrash) {
        if (generation !== dataGeneration) return
        if (!await deleteNoteById(note.id)) {
          // 旧回收站条目清理失败不应阻止当前笔记库的正常笔记加载；
          // 失败条目仍会被下面的过滤排除，并在后续同步时重试清理。
          logger.warn('[笔记] 旧回收站笔记清理失败，继续加载其他笔记', { id: note.id, title: note.title })
        }
      }
      if (generation !== dataGeneration) return
      notes.value = savedNotes.filter(note => !note.trashedAt).map(withScopedTags)

      isLoaded.value = true
    } catch (e) {
      logger.error('[笔记] 数据加载失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  const reset = () => {
    dataGeneration++
    syncGeneration++
    notes.value = []
    tags.value = []
    isLoaded.value = false
  }

  // 窗口重新聚焦时重载本地数据文件，保持当前状态与磁盘数据一致：
  // 主窗口失焦期间内容已强制落库，focus 回来时全量替换是安全的
  const syncFromRemote = async () => {
    if (!isLoaded.value) return
    const generation = dataGeneration
    const sync = ++syncGeneration
    const isCurrent = () => generation === dataGeneration && sync === syncGeneration
    try {
      const remoteTags = await getData<Tag[]>('notes', 'tags')
      if (!isCurrent()) return
      if (Array.isArray(remoteTags)) tags.value = remoteTags.map(tag => ({ ...tag, folderPath: normalizeTagFolderPath(tag.folderPath) }))
      const remote = await listNotes()
      if (!isCurrent()) return
      for (const note of remote) {
        if (!isCurrent()) return
        if (note.trashedAt && !await deleteNoteById(note.id)) {
          logger.warn('[笔记] 旧回收站笔记清理失败，继续同步其他笔记', { id: note.id, title: note.title })
        }
      }
      if (!isCurrent()) return
      notes.value = remote.filter(note => !note.trashedAt).map(withScopedTags)
      if (Array.isArray(remoteTags)) {
        const nextTags = [...tags.value]
        const missing = DEFAULT_NOTE_CATEGORIES.filter(category => !nextTags.some(tag => !tag.folderPath && (tag.id === category.id || tag.name === category.name)))
        if (missing.length) {
          missing.forEach(category => {
            const id = nextTags.some(tag => tag.id === category.id) ? `tag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : category.id
            nextTags.push({ id, name: category.name, color: category.color, order: nextTags.filter(tag => !tag.folderPath).length, folderPath: '' })
          })
          if (!isCurrent()) return
          tags.value = nextTags
          await saveTags()
        }
      }
    } catch (e) {
      logger.error('[笔记] 远程同步失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  const saveTags = async (): Promise<boolean> => {
    try {
      return await setData('notes', 'tags', tags.value)
    } catch (e) {
      logger.error('[笔记] 保存标签失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  // ========== 笔记操作（记录级读写，不做整份数组写回） ==========

  const addNote = async (
    data: { title: string; content?: string; pinned?: boolean; tagIds?: string[]; categoryId?: string; folderPath?: string }
  ): Promise<Note | null> => {
    try {
      const folderPath = normalizeTagFolderPath(data.folderPath)
      const requestedTagIds = data.tagIds ?? (data.categoryId ? [data.categoryId] : [])
      const tagIds = requestedTagIds.filter(id => tags.value.some(tag => tag.id === id && tag.folderPath === folderPath))
      const created = await createNote({
        title: data.title,
        content: data.content || '',
        tagIds,
        folderPath,
        pinned: !!data.pinned
      })
      if (!created) return null
      const note = withScopedTags(created)
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
    data: Partial<{ title: string; content: string; pinned: boolean; tagIds: string[]; categoryId: string; folderPath: string }>
  ): Promise<boolean> => {
    try {
      const current = notes.value.find(note => note.id === id)
      if (!current) return false
      const sourceFolderPath = normalizeTagFolderPath(current.folderPath)
      const targetFolderPath = normalizeTagFolderPath(data.folderPath !== undefined ? data.folderPath : sourceFolderPath)
      if (data.folderPath !== undefined && targetFolderPath !== normalizeTagFolderPath(current.folderPath) && data.tagIds === undefined) {
        logger.warn('[笔记] 拒绝直接跨文件夹移动笔记，必须先迁移标签', { id })
        return false
      }
      const patch: Partial<NoteRecord> = {}
      if (data.title !== undefined) patch.title = data.title
      if (data.content !== undefined) patch.content = data.content
      if (data.pinned !== undefined) patch.pinned = data.pinned
      if (data.folderPath !== undefined) patch.folderPath = targetFolderPath
      if (data.tagIds !== undefined) {
        patch.tagIds = data.tagIds.filter(tagId => tags.value.some(tag => tag.id === tagId && normalizeTagFolderPath(tag.folderPath) === targetFolderPath))
      } else if (data.categoryId !== undefined) {
        const tag = tags.value.find(item => item.id === data.categoryId && normalizeTagFolderPath(item.folderPath) === targetFolderPath)
        patch.tagIds = tag ? [tag.id] : []
      }

      const saved = await patchNote(id, patch)
      if (!saved) return false

      const idx = notes.value.findIndex(n => n.id === id)
      if (idx !== -1) notes.value[idx] = withScopedTags(saved)
      const updatedTitle = notes.value.find(note => note.id === id)?.title || '无标题'
      logger.info(`[笔记] 更新笔记，笔记名称: ${updatedTitle}，编号: ${id}`)
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
      const idx = notes.value.findIndex(n => n.id === id)
      if (idx !== -1) notes.value.splice(idx, 1)
      logger.info('[笔记] 永久删除笔记', { id })
      return true
    } catch (e) {
      logger.error('[笔记] 删除笔记失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
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

  const newTag = (name: string, folderPath: string): Tag => ({
    id: genTagId(),
    name,
    color: DEFAULT_NOTE_COLORS[tags.value.filter(tag => normalizeTagFolderPath(tag.folderPath) === folderPath).length % DEFAULT_NOTE_COLORS.length],
    order: tags.value.filter(tag => normalizeTagFolderPath(tag.folderPath) === folderPath).length,
    folderPath,
  })

  const addTag = async (data: { name: string; color?: string; folderPath?: string }): Promise<Tag | null> => {
    const previousTags = tags.value.map(tag => ({ ...tag }))
    try {
      const name = normalizeTagName(data.name)
      if (!name) return null
      const folderPath = normalizeTagFolderPath(data.folderPath)
      // 同名标签已存在：直接返回既有标签（供属性栏"输入即关联"复用）
      const existing = tags.value.find(t => normalizeTagFolderPath(t.folderPath) === folderPath && t.name === name)
      if (existing) return existing
      // 自动创建缺失的祖先标签，保证树中父节点真实存在（如建 "项目/子项目" 时先建 "项目"）
      const segments = name.split('/')
      for (let i = 1; i < segments.length; i++) {
        const ancestorPath = segments.slice(0, i).join('/')
        if (!tags.value.some(t => normalizeTagFolderPath(t.folderPath) === folderPath && t.name === ancestorPath)) {
          tags.value.push(newTag(ancestorPath, folderPath))
        }
      }
      const tag: Tag = { ...newTag(name, folderPath), ...(data.color ? { color: data.color } : {}) }
      tags.value.push(tag)
      if (!await saveTags()) {
        tags.value = previousTags
        return null
      }
      logger.info('[笔记] 新增标签', { id: tag.id, name: tag.name })
      return tag
    } catch (e) {
      tags.value = previousTags
      logger.error('[笔记] 新增标签失败', { error: e instanceof Error ? e.message : String(e) })
      return null
    }
  }

  const updateTag = async (id: string, data: Partial<Omit<Tag, 'id' | 'folderPath'>>): Promise<boolean> => {
    try {
      const idx = tags.value.findIndex(t => t.id === id)
      if (idx === -1) return false
      if (data.name !== undefined) {
        const newName = normalizeTagName(data.name)
        if (!newName) return false
        const oldName = tags.value[idx].name
        const folderPath = tags.value[idx].folderPath
        if (newName !== oldName) {
          // 与其他标签重名视为冲突（重命名后聚合路径会混乱），交由调用方提示
          if (tags.value.some(t => t.id !== id && t.folderPath === folderPath && t.name === newName)) return false
          // 重命名级联：后代标签的路径前缀同步更新，避免树断链
          const prefix = oldName + '/'
          tags.value.forEach((t, i) => {
            if (t.folderPath === folderPath && t.name.startsWith(prefix)) {
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
      for (const note of affected) {
        const saved = await patchNote(note.id, { tagIds: note.tagIds.filter(tagId => tagId !== id) })
        if (!saved) return false
      }
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

  const moveNoteToFolder = async (id: string, folderPath: string): Promise<boolean> => {
    const note = notes.value.find(item => item.id === id)
    if (!note) return false
    const destination = normalizeTagFolderPath(folderPath)
    if (destination === normalizeTagFolderPath(note.folderPath)) return true
    const nextTagIds: string[] = []
    for (const tagId of note.tagIds) {
      const sourceTag = tags.value.find(tag => tag.id === tagId && normalizeTagFolderPath(tag.folderPath) === normalizeTagFolderPath(note.folderPath))
      if (!sourceTag) continue
      let destinationTag = tags.value.find(tag => normalizeTagFolderPath(tag.folderPath) === destination && tag.name === sourceTag.name)
      if (!destinationTag) destinationTag = await addTag({ name: sourceTag.name, color: sourceTag.color, folderPath: destination }) || undefined
      if (!destinationTag || normalizeTagFolderPath(destinationTag.folderPath) !== destination) return false
      nextTagIds.push(destinationTag.id)
    }
    return await updateNote(id, { folderPath: destination, tagIds: nextTagIds })
  }

  return {
    notes,
    tags,
    categories,
    isLoaded,
    loadData,
    syncFromRemote,
    reset,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    addTag,
    updateTag,
    deleteTag,
    moveNoteToFolder,
  }
})

// 热更新时重建 store 实例：否则 HMR 沿组件链更新后 Pinia 仍返回旧 setup 的
// 实例，新增的方法（如 syncFromRemote）会报 "is not a function"
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNoteStore, import.meta.hot))
}
