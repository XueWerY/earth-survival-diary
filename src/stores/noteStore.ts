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

// 笔记页面（编辑器按页存储内容）
export interface NotePage {
  id: string
  title: string
  level: 1 | 2 | 3  // 1 = 一级页面, 2 = 二级页面（子页面）, 3 = 三级页面（孙页面）
  parentId?: string  // 二级/三级页面所属的上一级页面 id
  content: string  // HTML 内容
  type?: 'cover' | 'thanks'  // 封面页 / 致谢页（特殊页面，自动管理内容）
}

// 将纯文本转换为 HTML 段落
const textToHtml = (text: string): string => {
  return text.split('\n').map(l => l.trim() ? `<p>${l}</p>` : '<p><br></p>').join('')
}

// 解析笔记内容为页面数组（兼容旧版 HTML/纯文本格式）
export const parseNotePages = (content: string): NotePage[] => {
  if (!content) return []
  // 新版 JSON 格式
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content)
      if (parsed.pages && Array.isArray(parsed.pages)) return parsed.pages
    } catch { /* 降级为 HTML 解析 */ }
  }
  // 旧版 HTML/纯文本格式：按标题拆分为页面
  const html = (content.includes('<') && content.includes('>')) ? content : textToHtml(content)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body
  const pages: NotePage[] = []
  let currentPage: NotePage | null = null
  let currentLevel1Id: string | undefined
  let currentLevel2Id: string | undefined
  let pendingContent = ''

  const flushPending = () => {
    if (currentPage && pendingContent) {
      currentPage.content += pendingContent
      pendingContent = ''
    }
  }

  const genId = () => 'p_' + Date.now() + Math.random().toString(36).slice(2, 8)

  Array.from(body.childNodes).forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test((node as Element).tagName)) {
      flushPending()
      const el = node as Element
      const text = el.textContent?.trim() || ''
      if (!text) return
      const levelNum = parseInt(el.tagName.charAt(1))
      const level: 1 | 2 | 3 = levelNum === 1 ? 1 : (levelNum === 2 ? 2 : 3)
      const id = genId()
      if (level === 1) {
        currentLevel1Id = id
        currentLevel2Id = undefined
      } else if (level === 2) {
        currentLevel2Id = id
      }
      const parentId = level === 1 ? undefined : (level === 2 ? currentLevel1Id : currentLevel2Id)
      currentPage = { id, title: text, level, parentId, content: '' }
      pages.push(currentPage)
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) pendingContent += `<p>${text}</p>`
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      pendingContent += (node as Element).outerHTML || ''
    }
  })
  flushPending()

  // 无标题但有内容：创建单个页面
  if (pages.length === 0 && body.textContent?.trim()) {
    pages.push({ id: genId(), title: '正文', level: 1, content: html })
  }
  return pages
}

// 序列化页面数组为笔记内容字符串
export const serializeNotePages = (pages: NotePage[]): string => {
  return JSON.stringify({ pages })
}

// 将所有页面合并为 HTML（用于字数统计、卡片预览）
export const pagesToHtml = (pages: NotePage[]): string => {
  return pages.map(p => `<h${p.level}>${p.title}</h${p.level}>${p.content}`).join('')
}

// 获取笔记纯文本（用于卡片预览和字数统计）
export const getNotePlainText = (content: string): string => {
  const pages = parseNotePages(content)
  if (pages.length === 0) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = pagesToHtml(pages)
  return (tmp.textContent || tmp.innerText || '').trim()
}

// 创建新页面
export const createNotePage = (level: 1 | 2 | 3, parentId?: string): NotePage => {
  return {
    id: 'p_' + Date.now() + Math.random().toString(36).slice(2, 8),
    title: '新页面',
    level,
    parentId,
    content: '',
  }
}

// 判断页面是否参与编号（封面页和致谢页不参与）
const isCountedPage = (p: NotePage): boolean => p.type !== 'cover' && p.type !== 'thanks'

// 计算页面序号（一级：1, 2, 3...；二级：1.1, 1.2, 2.1...；三级：1.1.1, 1.1.2...）
// 封面页和致谢页不参与编号，返回空字符串
export const computePageNumber = (pages: NotePage[], idx: number): string => {
  const page = pages[idx]
  if (!page) return ''
  if (!isCountedPage(page)) return ''
  if (page.level === 1) {
    let num = 0
    for (let i = 0; i <= idx; i++) {
      if (pages[i].level === 1 && isCountedPage(pages[i])) num++
    }
    return String(num)
  }
  if (page.level === 2) {
    const parentId = page.parentId
    let parentNum = 0
    let subNum = 0
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].level === 1 && isCountedPage(pages[i])) {
        parentNum++
        subNum = 0
        if (pages[i].id === parentId) {
          for (let j = i + 1; j <= idx; j++) {
            if (pages[j].level === 2 && pages[j].parentId === parentId) subNum++
          }
          return `${parentNum}.${subNum}`
        }
      }
    }
    return ''
  }
  // 三级页面：查找父级二级页面，再查二级页面的父级一级页面
  const parent2Id = page.parentId
  let parent2Idx = -1
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].id === parent2Id && pages[i].level === 2) {
      parent2Idx = i
      break
    }
  }
  if (parent2Idx === -1) return ''
  const parent2 = pages[parent2Idx]
  const parent1Id = parent2.parentId
  let parent1Num = 0
  let parent2Num = 0
  let subNum = 0
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].level === 1 && isCountedPage(pages[i])) {
      parent1Num++
      parent2Num = 0
      if (pages[i].id === parent1Id) {
        for (let j = i + 1; j <= parent2Idx; j++) {
          if (pages[j].level === 2 && pages[j].parentId === parent1Id) {
            parent2Num++
            if (pages[j].id === parent2Id) {
              for (let k = parent2Idx + 1; k <= idx; k++) {
                if (pages[k].level === 3 && pages[k].parentId === parent2Id) subNum++
              }
              return `${parent1Num}.${parent2Num}.${subNum}`
            }
          }
        }
      }
    }
  }
  return ''
}

// 封面页和致谢页共用的水平垂直居中样式
const CENTER_STYLE = 'min-height:60vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;'

// 生成封面页内容（根据其他页面生成大纲，noteTitle 为笔记标题）
export const generateCoverContent = (pages: NotePage[], noteTitle: string): string => {
  let outlineHtml = ''
  pages.forEach((p, idx) => {
    if (p.type === 'cover' || p.type === 'thanks') return
    const num = computePageNumber(pages, idx)
    const indent = (p.level - 1) * 20
    outlineHtml += `<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px dashed rgba(0,0,0,0.1);padding-left:${indent}px;"><span style="font-weight:700;color:#1e40af;min-width:36px;text-align:center;">${num}</span><span style="color:#334155;">${p.title}</span></div>`
  })
  return `<div style="${CENTER_STYLE}"><h1>${noteTitle || '新笔记'}</h1><p>大纲</p>${outlineHtml ? `<div style="max-width:500px;width:100%;">${outlineHtml}</div>` : ''}</div>`
}

// 确保致谢页内容被居中 div 包裹（强制水平垂直居中）
export const wrapThanksContent = (content: string): string => {
  if (!content) return `<div style="${CENTER_STYLE}"><p>感谢聆听！</p></div>`
  if (content.includes(CENTER_STYLE)) return content
  const tmp = document.createElement('div')
  tmp.innerHTML = content
  return `<div style="${CENTER_STYLE}">${tmp.innerHTML}</div>`
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
