import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logger } from '../lib/logger'
import { getData, setData } from '../services/storageService'

// 笔记
export interface Note {
  id: string
  title: string
  content: string
  color: string
  categoryId: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

// 笔记分类
export interface NoteCategory {
  id: string
  name: string
  color: string
  icon: string
  isCustom: boolean
}

// 默认分类（isCustom=false 不可删除）
export const DEFAULT_NOTE_CATEGORIES: NoteCategory[] = [
  { id: 'personal', name: '个人', icon: '📝', color: '#667eea', isCustom: false },
  { id: 'work', name: '工作', icon: '💼', color: '#3b82f6', isCustom: false },
  { id: 'study', name: '学习', icon: '📚', color: '#10b981', isCustom: false },
  { id: 'ideas', name: '灵感', icon: '💡', color: '#f59e0b', isCustom: false },
]

// 笔记可选颜色（12 色，与默认清单颜色一致）
export const DEFAULT_NOTE_COLORS = [
  '#667eea', '#f093fb', '#4facfe', '#43e97b',
  '#fa709a', '#fee140', '#a8edea', '#d299c2',
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
]

// 扩展颜色库（40 色，用于分类颜色选择器，与清单模块一致）
export const EXTENDED_NOTE_COLORS = [
  '#667eea', '#764ba2', '#f093fb', '#d53a9d', '#4facfe', '#00b4db', '#43e97b', '#11998e',
  '#fa709a', '#ee5a24', '#fee140', '#f6d365', '#a8edea', '#a18cd1', '#d299c2', '#fbc2eb',
  '#ff6b6b', '#4ecdc4', '#26d0ce', '#45b7d1', '#2b32b2', '#96ceb4', '#e1eec3', '#fc4a1a',
  '#f7b733', '#00b09b', '#96c93d', '#834d9b', '#d04ed6', '#2c3e50', '#3498db', '#e74c3c',
  '#f39c12', '#1abc9c', '#9b59b6', '#e67e22', '#2ecc71', '#e91e63', '#00bcd4', '#8e44ad',
]

export const ALL_CATEGORY_VALUE = 'all'

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
    // 跳过代码块内的行
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

export const useNoteStore = defineStore('note', () => {
  const notes = ref<Note[]>([])
  const categories = ref<NoteCategory[]>([])
  const isLoaded = ref(false)

  const loadData = async () => {
    if (isLoaded.value) return
    try {
      const [savedNotes, savedCategories] = await Promise.all([
        getData<Note[]>('notes', 'notes'),
        getData<NoteCategory[]>('notes', 'categories'),
      ])

      // 分类为空时初始化默认分类（兼容已有用户）
      if (!savedCategories || savedCategories.length === 0) {
        categories.value = [...DEFAULT_NOTE_CATEGORIES]
        await setData('notes', 'categories', categories.value)
      } else {
        categories.value = savedCategories
      }

      notes.value = savedNotes || []
      isLoaded.value = true
      logger.info('[笔记] 数据加载完成', { notes: notes.value.length, categories: categories.value.length })
    } catch (e) {
      logger.error('[笔记] 数据加载失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  const reset = () => {
    notes.value = []
    categories.value = []
    isLoaded.value = false
  }

  const saveNotes = async () => {
    try {
      await setData('notes', 'notes', notes.value)
    } catch (e) {
      logger.error('[笔记] 保存笔记失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  const saveCategories = async () => {
    try {
      await setData('notes', 'categories', categories.value)
    } catch (e) {
      logger.error('[笔记] 保存分类失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  const addNote = async (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note | null> => {
    try {
      const now = new Date().toISOString()
      const note: Note = {
        ...data,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
        createdAt: now,
        updatedAt: now,
      }
      notes.value.unshift(note)
      await saveNotes()
      logger.info('[笔记] 新增笔记', { id: note.id, title: note.title })
      return note
    } catch (e) {
      logger.error('[笔记] 新增笔记失败', { error: e instanceof Error ? e.message : String(e) })
      return null
    }
  }

  const updateNote = async (id: string, data: Partial<Omit<Note, 'id' | 'createdAt'>>): Promise<boolean> => {
    try {
      const idx = notes.value.findIndex(n => n.id === id)
      if (idx === -1) return false
      notes.value[idx] = {
        ...notes.value[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      }
      await saveNotes()
      logger.info('[笔记] 更新笔记', { id })
      return true
    } catch (e) {
      logger.error('[笔记] 更新笔记失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  const deleteNote = async (id: string): Promise<boolean> => {
    try {
      const idx = notes.value.findIndex(n => n.id === id)
      if (idx === -1) return false
      notes.value.splice(idx, 1)
      await saveNotes()
      logger.info('[笔记] 删除笔记', { id })
      return true
    } catch (e) {
      logger.error('[笔记] 删除笔记失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  const togglePin = async (id: string): Promise<boolean> => {
    const note = notes.value.find(n => n.id === id)
    if (!note) return false
    return updateNote(id, { pinned: !note.pinned })
  }

  const addCategory = async (data: Omit<NoteCategory, 'id' | 'isCustom'>): Promise<NoteCategory | null> => {
    try {
      const category: NoteCategory = {
        ...data,
        id: 'c_' + Date.now().toString() + Math.random().toString(36).slice(2, 6),
        isCustom: true,
      }
      categories.value.push(category)
      await saveCategories()
      logger.info('[笔记] 新增分类', { id: category.id, name: category.name })
      return category
    } catch (e) {
      logger.error('[笔记] 新增分类失败', { error: e instanceof Error ? e.message : String(e) })
      return null
    }
  }

  const updateCategory = async (id: string, data: Partial<Omit<NoteCategory, 'id' | 'isCustom'>>): Promise<boolean> => {
    try {
      const idx = categories.value.findIndex(c => c.id === id)
      if (idx === -1) return false
      categories.value[idx] = { ...categories.value[idx], ...data }
      await saveCategories()
      logger.info('[笔记] 更新分类', { id })
      return true
    } catch (e) {
      logger.error('[笔记] 更新分类失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  const deleteCategory = async (id: string): Promise<boolean> => {
    try {
      const category = categories.value.find(c => c.id === id)
      if (!category) return false
      // 将该分类下的笔记移动到剩余的第一个分类，避免数据丢失
      const remaining = categories.value.filter(c => c.id !== id)
      const fallbackId = remaining[0]?.id
      if (fallbackId) {
        notes.value.forEach(n => {
          if (n.categoryId === id) n.categoryId = fallbackId
        })
        await saveNotes()
      }
      categories.value = remaining
      await saveCategories()
      logger.info('[笔记] 删除分类', { id })
      return true
    } catch (e) {
      logger.error('[笔记] 删除分类失败', { error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  const getCategoryCount = (categoryId: string): number => {
    if (categoryId === ALL_CATEGORY_VALUE) return notes.value.length
    return notes.value.filter(n => n.categoryId === categoryId).length
  }

  const getNotesByCategory = (categoryId: string): Note[] => {
    if (categoryId === ALL_CATEGORY_VALUE) return notes.value
    return notes.value.filter(n => n.categoryId === categoryId)
  }

  return {
    notes,
    categories,
    isLoaded,
    loadData,
    reset,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryCount,
    getNotesByCategory,
  }
})
