import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '../lib/api'

export const useNoteStore = defineStore('note', () => {
    // 状态
    const categories = ref<api.NoteCategory[]>([])
    const notes = ref<api.Note[]>([])
    const currentNote = ref<api.Note | null>(null)
    const isLoaded = ref(false)
    const isLoading = ref(false)
    const searchQuery = ref('')
    const selectedCategoryId = ref<string | null>(null)

    // 计算属性
    const filteredNotes = computed(() => {
        let result = notes.value

        // 按分类筛选
        if (selectedCategoryId.value) {
            result = result.filter(n => n.category_id === selectedCategoryId.value)
        }

        // 搜索筛选
        if (searchQuery.value) {
            const query = searchQuery.value.toLowerCase()
            result = result.filter(n =>
                n.title.toLowerCase().includes(query) ||
                n.content.toLowerCase().includes(query)
            )
        }

        return result
    })

    const notesByCategory = computed(() => {
        const map = new Map<string | null, api.Note[]>()

        // 初始化所有分类
        categories.value.forEach(cat => {
            map.set(cat.id, [])
        })
        map.set(null, []) // 未分类

        // 分组笔记
        notes.value.forEach(note => {
            const catId = note.category_id
            const arr = map.get(catId)
            if (arr) {
                arr.push(note)
            }
        })

        return map
    })

    // 加载数据
    const loadData = async () => {
        if (isLoaded.value) return

        isLoading.value = true
        try {
            const [categoriesRes, notesRes] = await Promise.all([
                api.getNoteCategories(),
                api.getNotes()
            ])
            categories.value = categoriesRes.categories
            notes.value = notesRes.notes
            isLoaded.value = true
        } catch (error) {
            console.error('Failed to load notes data:', error)
        } finally {
            isLoading.value = false
        }
    }

    // 刷新笔记列表
    const refreshNotes = async () => {
        try {
            const { notes: freshNotes } = await api.getNotes()
            notes.value = freshNotes
        } catch (error) {
            console.error('Failed to refresh notes:', error)
        }
    }

    // 分类操作
    const addCategory = async (data: { name: string; icon?: string; color?: string }) => {
        try {
            const { category } = await api.addNoteCategory(data)
            categories.value.push(category)
            return category
        } catch (error) {
            console.error('Failed to add category:', error)
            throw error
        }
    }

    const updateCategory = async (id: string, data: { name?: string; icon?: string; color?: string }) => {
        try {
            const { category } = await api.updateNoteCategory(id, data)
            const index = categories.value.findIndex(c => c.id === id)
            if (index !== -1) {
                categories.value[index] = category
            }
            return category
        } catch (error) {
            console.error('Failed to update category:', error)
            throw error
        }
    }

    const deleteCategory = async (id: string) => {
        try {
            await api.deleteNoteCategory(id)
            categories.value = categories.value.filter(c => c.id !== id)
            // 同时移除该分类下的笔记
            notes.value = notes.value.filter(n => n.category_id !== id)
            if (selectedCategoryId.value === id) {
                selectedCategoryId.value = null
            }
        } catch (error) {
            console.error('Failed to delete category:', error)
            throw error
        }
    }

    // 笔记操作
    const selectNote = async (id: string) => {
        try {
            const { note } = await api.getNote(id)
            currentNote.value = note
            return note
        } catch (error) {
            console.error('Failed to select note:', error)
            throw error
        }
    }

    const createNote = async (categoryId?: string | null) => {
        try {
            const { note } = await api.addNote({ categoryId })
            notes.value.unshift(note)
            currentNote.value = note
            return note
        } catch (error) {
            console.error('Failed to create note:', error)
            throw error
        }
    }

    const updateNote = async (id: string, data: api.NoteFormData) => {
        try {
            const { note } = await api.updateNote(id, data)
            const index = notes.value.findIndex(n => n.id === id)
            if (index !== -1) {
                notes.value[index] = note
            }
            if (currentNote.value?.id === id) {
                currentNote.value = note
            }
            return note
        } catch (error) {
            console.error('Failed to update note:', error)
            throw error
        }
    }

    const deleteNote = async (id: string) => {
        try {
            await api.deleteNote(id)
            notes.value = notes.value.filter(n => n.id !== id)
            if (currentNote.value?.id === id) {
                currentNote.value = null
            }
        } catch (error) {
            console.error('Failed to delete note:', error)
            throw error
        }
    }

    // 自动保存（防抖）
    let saveTimeout: ReturnType<typeof setTimeout> | null = null

    const autoSaveNote = (id: string, data: api.NoteFormData) => {
        if (saveTimeout) {
            clearTimeout(saveTimeout)
        }

        saveTimeout = setTimeout(async () => {
            try {
                await updateNote(id, data)
            } catch (error) {
                console.error('Auto save failed:', error)
            }
        }, 1000)
    }

    // Reset store (used when logging out)
    const reset = () => {
        categories.value = []
        notes.value = []
        currentNote.value = null
        searchQuery.value = ''
        selectedCategoryId.value = null
        isLoaded.value = false
    }

    return {
        // 状态
        categories,
        notes,
        currentNote,
        isLoaded,
        isLoading,
        searchQuery,
        selectedCategoryId,

        // 计算属性
        filteredNotes,
        notesByCategory,

        // 方法
        loadData,
        refreshNotes,
        addCategory,
        updateCategory,
        deleteCategory,
        selectNote,
        createNote,
        updateNote,
        deleteNote,
        autoSaveNote,
        reset
    }
})
