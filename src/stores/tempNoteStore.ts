import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '../lib/logger'
import {
  loadTempNotes,
  addTempNote,
  removeTempNotePath,
  readTempNote,
  saveTempNoteContent,
  saveTempNoteMedia,
  readTempNoteMedia,
  statTempNoteMtime,
  loadTempNoteReading,
  saveTempNoteReading,
  type TempNote,
  type TempNoteReading,
} from '../services/tempNotes'

/**
 * 临时笔记：直接编辑外部 .md 文件。
 * 正文不落在 data 目录——清单（文件路径）存 data/<用户ID>/notes/tempNotes.yaml，
 * 每次保存都原地写回 .md，媒体写到同级 media/。
 */
export const useTempNoteStore = defineStore('tempNote', () => {
  const notes = ref<TempNote[]>([])
  const isLoaded = ref(false)
  const savingId = ref<string | null>(null)
  /** 阅读位置缓存：noteId → { scrollTop, caretLine } */
  const readings = ref<Record<string, TempNoteReading>>({})

  /** 按最近修改排序 */
  const sorted = computed(() => [...notes.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))

  const find = (id: string): TempNote | undefined => notes.value.find(n => n.id === id)

  const load = async () => {
    if (isLoaded.value) return
    try {
      notes.value = await loadTempNotes()
      isLoaded.value = true
    } catch (e) {
      logger.error('[临时笔记] 加载失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  /** 重新读取所有外部文件（窗口聚焦、手动刷新时用） */
  const refresh = async () => {
    try {
      notes.value = await loadTempNotes()
    } catch (e) {
      logger.error('[临时笔记] 刷新失败', { error: e instanceof Error ? e.message : String(e) })
    }
  }

  /** 打开一个外部 .md 文件并加入临时笔记（重复打开同一路径只保留一条） */
  const addFile = async (filePath: string): Promise<TempNote | null> => {
    try {
      const note = await addTempNote(filePath)
      if (!note) return null
      const idx = notes.value.findIndex(n => n.id === note.id)
      if (idx >= 0) notes.value[idx] = note
      else notes.value.unshift(note)
      return note
    } catch (e) {
      logger.error('[临时笔记] 打开文件失败', { error: e instanceof Error ? e.message : String(e) })
      return null
    }
  }

  /** 原地保存正文到磁盘 */
  const saveContent = async (id: string, content: string): Promise<boolean> => {
    const note = find(id)
    if (!note) return false
    if (note.content === content) return true
    savingId.value = id
    try {
      const ok = await saveTempNoteContent(note, content)
      if (!ok) return false
      note.content = content
      note.updatedAt = new Date().toISOString()
      return true
    } finally {
      savingId.value = null
    }
  }

  /** 手动重新读取某个文件（外部编辑器改动后同步进来） */
  const reload = async (id: string): Promise<boolean> => {
    const note = find(id)
    if (!note) return false
    const fresh = await readTempNote(note.filePath)
    if (!fresh) return false
    Object.assign(note, fresh)
    return true
  }

  /**
   * 检查磁盘是否被外部改动（mtime 与我们上次记录的不一致）。
   * 用于自动重读轮询：只 stat 不读全文，命中才由调用方 reload。
   * 我们自己保存后 mtime 会被同步刷新，因此不会误报。
   */
  const isExternallyChanged = async (id: string): Promise<boolean> => {
    const note = find(id)
    if (!note) return false
    const mtime = await statTempNoteMtime(note.filePath)
    if (mtime === null) return false
    // 首次拿不到基准时以当前值建立基准，不触发重读
    if (!note.mtimeMs) {
      note.mtimeMs = mtime
      return false
    }
    return mtime !== note.mtimeMs
  }

  /** 记录阅读位置（滚动偏移 + 光标行），按文件路径存 data/<用户ID>/notes */
  const recordReading = async (id: string, reading: TempNoteReading): Promise<void> => {
    const note = find(id)
    if (!note) return
    const previous = readings.value[id]
    if (previous && previous.scrollTop === reading.scrollTop && previous.caretLine === reading.caretLine) return
    readings.value = { ...readings.value, [id]: reading }
    await saveTempNoteReading(note.filePath, reading)
  }

  /** 取某篇临时笔记上次记录到的阅读位置 */
  const takeReading = async (id: string): Promise<TempNoteReading | null> => {
    if (readings.value[id]) return readings.value[id]
    const note = find(id)
    if (!note) return null
    const stored = await loadTempNoteReading(note.filePath)
    if (stored) readings.value = { ...readings.value, [id]: stored }
    return stored
  }

  /** 从列表移除（不删除磁盘上的 .md 文件） */
  const remove = async (id: string): Promise<boolean> => {
    const note = find(id)
    if (!note) return false
    notes.value = notes.value.filter(n => n.id !== id)
    await removeTempNotePath(note.filePath)
    return true
  }

  /** 媒体落盘：写入 .md 同级 media/，返回正文相对引用 */
  const attachMedia = async (id: string, dataUrl: string): Promise<string | null> => {
    const note = find(id)
    if (!note) return null
    return saveTempNoteMedia(note, dataUrl)
  }

  /** 渲染用：相对引用 → data URL */
  const resolveMedia = async (id: string, reference: string): Promise<string | null> => {
    const note = find(id)
    if (!note) return null
    return readTempNoteMedia(note, reference)
  }

  const reset = () => {
    notes.value = []
    readings.value = {}
    isLoaded.value = false
  }

  return {
    notes,
    sorted,
    isLoaded,
    savingId,
    readings,
    find,
    load,
    refresh,
    addFile,
    saveContent,
    reload,
    isExternallyChanged,
    recordReading,
    takeReading,
    remove,
    attachMedia,
    resolveMedia,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTempNoteStore, import.meta.hot))
}
