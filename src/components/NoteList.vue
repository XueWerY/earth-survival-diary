<template>
  <div class="note-container" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- 左侧边栏：分类 + 笔记列表 -->
    <aside class="note-sidebar" v-show="!isFullscreen" :class="{ collapsed: sidebarCollapsed }">
      <!-- 分类列表容器 -->
      <div class="category-list-container">
        <!-- 现有分类 -->
        <div
            v-for="category in noteStore.categories"
            :key="category.id"
            class="category-group"
        >
          <!-- 分类头部 -->
          <div
              class="category-header"
              :class="{ active: expandedCategoryId === category.id }"
          >
            <div class="category-info" @click="toggleCategory(category.id)">
              <span class="category-icon">{{ category.icon }}</span>
              <span class="category-name">{{ category.name }}</span>
              <span class="category-count">{{ getCategoryNoteCount(category.id) }}</span>
              <svg
                  class="expand-icon"
                  :class="{ expanded: expandedCategoryId === category.id }"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
            <div class="category-actions">
              <button class="action-btn" @click.stop="createNoteInCategory(category.id)" title="新建笔记">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button class="action-btn" @click.stop="openEditCategory(category)" title="编辑分类">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="action-btn delete" @click.stop="confirmDeleteCategory(category.id)" title="删除分类">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- 分类下的笔记列表 -->
          <div class="note-list" v-show="expandedCategoryId === category.id">
            <div
                v-for="note in getNotesByCategory(category.id)"
                :key="note.id"
                class="note-item"
                :class="{ active: noteStore.currentNote?.id === note.id }"
                @click="selectNote(note.id)"
            >
              <span class="note-title">{{ note.title || '无标题' }}</span>
            </div>
            <div v-if="getNotesByCategory(category.id).length === 0" class="empty-note">
              暂无笔记
            </div>
          </div>
        </div>

        <!-- 新增分类按钮 -->
        <div class="add-category-item" @click="showCategoryDialog = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>新建分类</span>
        </div>

        <!-- 无分类提示 -->
        <div v-if="noteStore.categories.length === 0" class="no-category-hint">
          <div class="hint-icon">📁</div>
          <p>点击上方创建第一个分类</p>
        </div>
      </div>
    </aside>

    <!-- 折叠按钮（放在侧边栏外面，确保折叠后仍可见） -->
    <div class="sidebar-toggle" @click="toggleSidebar" v-show="!isFullscreen">
      <el-icon v-if="sidebarCollapsed"><DArrowRight /></el-icon>
      <el-icon v-else><DArrowLeft /></el-icon>
    </div>

    <!-- 编辑区域 -->
    <div class="note-editor-panel" :class="{ 'fullscreen-mode': isFullscreen }" v-if="noteStore.currentNote">
      <!-- 全屏提示 -->
      <div class="fullscreen-hint" v-if="isFullscreen">
        按 ESC 退出全屏
      </div>
      <div class="editor-header">
        <div class="title-area">
          <input
              type="text"
              v-model="noteTitle"
              class="note-title-input"
              placeholder="输入标题..."
              @input="handleTitleChange"
          />
        </div>
        <div class="editor-actions">
          <span v-if="hasUnsavedChanges" class="save-status unsaved">未保存</span>
          <span v-else class="save-status saved">已保存</span>
          <button class="save-btn" @click="handleSaveNote" :disabled="!hasUnsavedChanges">
            <span class="btn-tooltip">保存 (Ctrl+S)</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          </button>
          <select v-model="noteCategoryId" class="category-select" @change="handleCategoryChange">
            <option v-for="cat in noteStore.categories" :key="cat.id" :value="cat.id">
              {{ cat.icon }} {{ cat.name }}
            </option>
          </select>
          <button v-if="!isFullscreen" class="fullscreen-btn" @click="toggleFullscreen" title="全屏编辑">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </svg>
          </button>
          <button class="delete-btn" @click="confirmDeleteNote" title="删除笔记">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div ref="editorContainer" class="editor-container"></div>
    </div>

    <!-- 空状态 -->
    <div class="note-editor-panel empty-editor" v-else>
      <div class="empty-editor-content">
        <div class="empty-icon-large">✍️</div>
        <p>选择或创建一个笔记开始编辑</p>
      </div>
    </div>

    <!-- 添加分类对话框 -->
    <el-dialog
        v-model="showCategoryDialog"
        title="添加分类"
        width="400px"
        :append-to-body="true"
    >
      <el-form :model="categoryForm" label-width="80px">
        <el-form-item label="分类名称">
          <el-input v-model="categoryForm.name" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="categoryForm.icon" placeholder="如: 📚" maxlength="2" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="categoryForm.color" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCategoryDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddCategory">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑分类对话框 -->
    <el-dialog
        v-model="showEditCategoryDialog"
        title="编辑分类"
        width="400px"
        :append-to-body="true"
    >
      <el-form :model="editCategoryForm" label-width="80px">
        <el-form-item label="分类名称">
          <el-input v-model="editCategoryForm.name" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="editCategoryForm.icon" placeholder="如: 📚" maxlength="2" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="editCategoryForm.color" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditCategoryDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateCategory">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { useNoteStore } from '../stores/noteStore'
import { useSettingsStore } from '../stores/settingsStore'

const noteStore = useNoteStore()
const settingsStore = useSettingsStore()

// 定义 emit
const emit = defineEmits<{
  (e: 'fullscreen-change', isFullscreen: boolean): void
}>()

// 编辑器相关
const editorContainer = ref<HTMLElement>()
let vditor: Vditor | null = null

// 表单数据
const showCategoryDialog = ref(false)
const showEditCategoryDialog = ref(false)
const categoryForm = ref({
  name: '',
  icon: '📝',
  color: '#667eea'
})
const editCategoryForm = ref({
  id: '',
  name: '',
  icon: '📝',
  color: '#667eea'
})

// 当前笔记编辑状态
const noteTitle = ref('')
const noteCategoryId = ref<string | null>(null)
const isFullscreen = ref(false)
const hasUnsavedChanges = ref(false)

// 当前展开的分类
const expandedCategoryId = ref<string | null>(null)

// 侧边栏折叠状态
const sidebarCollapsed = ref(false)

// 展开/收起分类
const toggleCategory = (categoryId: string) => {
  expandedCategoryId.value = expandedCategoryId.value === categoryId ? null : categoryId
}

// 折叠/展开侧边栏
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// 获取分类下的笔记
const getNotesByCategory = (categoryId: string) => {
  return noteStore.notes
      .filter(n => n.category_id === categoryId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

// 获取分类笔记数量
const getCategoryNoteCount = (categoryId: string) => {
  return noteStore.notes.filter(n => n.category_id === categoryId).length
}

// 在指定分类下新建笔记
const createNoteInCategory = async (categoryId: string) => {
  expandedCategoryId.value = categoryId
  await noteStore.createNote(categoryId)
}

// 打开编辑分类对话框
const openEditCategory = (category: any) => {
  editCategoryForm.value = {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color
  }
  showEditCategoryDialog.value = true
}

// 确认删除分类
const confirmDeleteCategory = async (categoryId: string) => {
  try {
    await ElMessageBox.confirm('删除分类将同时删除该分类下的所有笔记，确定要删除吗？', '删除确认', {
      type: 'warning'
    })
    await noteStore.deleteCategory(categoryId)
    if (expandedCategoryId.value === categoryId) {
      expandedCategoryId.value = null
    }
    ElMessage.success('分类已删除')
  } catch {
    // 取消删除
  }
}

// 快捷键配置（从 settingsStore 获取）
const shortcutConfig = computed(() => settingsStore.settings.shortcuts)

// 解析快捷键字符串
const parseShortcut = (shortcut: string) => {
  const parts = shortcut.toLowerCase().split('+')
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts[parts.length - 1]
  }
}

// 匹配快捷键
const matchShortcut = (e: KeyboardEvent, shortcut: string): boolean => {
  const parsed = parseShortcut(shortcut)
  const ctrlMatch = parsed.ctrl === (e.ctrlKey || e.metaKey)
  const shiftMatch = parsed.shift === e.shiftKey
  const altMatch = parsed.alt === e.altKey
  const keyMatch = parsed.key === e.key.toLowerCase()
  return ctrlMatch && shiftMatch && altMatch && keyMatch
}

// 插入行内公式（支持选中转换）
const insertInlineMath = () => {
  if (!vditor) return

  const selection = vditor.getSelection()

  if (selection && selection.trim()) {
    vditor.updateValue(`$${selection}$`)
  } else {
    vditor.insertValue('$E=mc^2$')
  }
}

// 插入块级公式（支持选中转换）
const insertBlockMath = () => {
  if (!vditor) return

  const selection = vditor.getSelection()

  if (selection && selection.trim()) {
    vditor.updateValue(`\n$$\n${selection}\n$$\n`)
  } else {
    vditor.insertValue('\n$$\n\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n\n$$\n')
  }
}

// 切换全屏
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  emit('fullscreen-change', isFullscreen.value)
}

// ESC 键退出全屏
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
    emit('fullscreen-change', false)
  }
}

// 手动保存笔记
const handleSaveNote = async () => {
  if (!noteStore.currentNote || !hasUnsavedChanges.value) return

  try {
    const content = vditor?.getValue() || ''
    await noteStore.updateNote(noteStore.currentNote.id, {
      title: noteTitle.value,
      content: content,
      categoryId: noteCategoryId.value
    })
    hasUnsavedChanges.value = false
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

// 初始化编辑器
const initEditor = () => {
  if (!editorContainer.value) return

  vditor = new Vditor(editorContainer.value, {
    height: '100%',
    theme: 'dark',
    mode: 'ir',
    placeholder: '开始记录你的想法...',
    value: noteStore.currentNote?.content || '',
    cache: {
      enable: false
    },
    toolbar: [
      'headings',
      'bold',
      'italic',
      'strike',
      '|',
      'line',
      'quote',
      '|',
      'list',
      'ordered-list',
      'check',
      '|',
      'code',
      'inline-code',
      {
        name: 'inline-math',
        tip: `行内公式 (${shortcutConfig.value.inlineMath})`,
        icon: '<svg viewBox="0 0 24 24" width="16" height="16"><text x="2" y="18" font-size="16" fill="currentColor">fx</text></svg>',
        click: insertInlineMath
      },
      {
        name: 'block-math',
        tip: `块级公式 (${shortcutConfig.value.blockMath})`,
        icon: '<svg viewBox="0 0 24 24" width="16" height="16"><text x="1" y="18" font-size="14" fill="currentColor">∑</text></svg>',
        click: insertBlockMath
      },
      '|',
      'link',
      'table',
      '|',
      'undo',
      'redo',
      '|',
      'outline',
      '|',
      'export'
    ],
    hint: {
      parse: false,
      emoji: {}
    },
    input: () => {
      hasUnsavedChanges.value = true
    },
    after: () => {
      const handleKeydown = (e: KeyboardEvent) => {
        if (matchShortcut(e, shortcutConfig.value.inlineMath)) {
          e.preventDefault()
          e.stopPropagation()
          insertInlineMath()
          return
        }
        if (matchShortcut(e, shortcutConfig.value.blockMath)) {
          e.preventDefault()
          e.stopPropagation()
          insertBlockMath()
          return
        }
        if (matchShortcut(e, shortcutConfig.value.save)) {
          e.preventDefault()
          handleSaveNote()
          return
        }
      }

      document.addEventListener('keydown', handleKeydown, true)
      ;(vditor as any).__keydownHandler = handleKeydown
    }
  })
}

// 销毁编辑器
const destroyEditor = () => {
  if (vditor) {
    const handler = (vditor as any).__keydownHandler
    if (handler) {
      document.removeEventListener('keydown', handler, true)
    }
    vditor.destroy()
    vditor = null
  }
}

// 选择笔记
const selectNote = async (id: string) => {
  await noteStore.selectNote(id)
}

// 删除笔记确认
const confirmDeleteNote = async () => {
  if (!noteStore.currentNote) return

  try {
    await ElMessageBox.confirm('确定要删除这个笔记吗？', '删除确认', {
      type: 'warning'
    })
    await noteStore.deleteNote(noteStore.currentNote.id)
    ElMessage.success('笔记已删除')
  } catch {
    // 取消删除
  }
}

// 标题变更
const handleTitleChange = () => {
  hasUnsavedChanges.value = true
}

// 分类变更
const handleCategoryChange = () => {
  hasUnsavedChanges.value = true
}

// 添加分类
const handleAddCategory = async () => {
  if (!categoryForm.value.name.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }

  try {
    await noteStore.addCategory(categoryForm.value)
    showCategoryDialog.value = false
    categoryForm.value = { name: '', icon: '📝', color: '#667eea' }
    ElMessage.success('分类已添加')
  } catch {
    ElMessage.error('添加分类失败')
  }
}

// 更新分类
const handleUpdateCategory = async () => {
  if (!editCategoryForm.value.name.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }

  try {
    await noteStore.updateCategory(editCategoryForm.value.id, editCategoryForm.value)
    showEditCategoryDialog.value = false
    ElMessage.success('分类已更新')
  } catch {
    ElMessage.error('更新分类失败')
  }
}

// 监听当前笔记变化
watch(() => noteStore.currentNote, (note) => {
  if (note) {
    noteTitle.value = note.title
    noteCategoryId.value = note.category_id
    hasUnsavedChanges.value = false

    nextTick(() => {
      destroyEditor()
      initEditor()
    })
  } else {
    destroyEditor()
    noteTitle.value = ''
    noteCategoryId.value = null
    hasUnsavedChanges.value = false
  }
}, { immediate: true })

// 加载数据
onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)

  await Promise.all([
    settingsStore.loadSettings(),
    noteStore.loadData()
  ])

  if (noteStore.currentNote) {
    nextTick(() => {
      initEditor()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  destroyEditor()
})
</script>

<style scoped>
.note-container {
  display: flex;
  height: 100%;
  width: 100%;
  background: transparent;
  overflow: hidden;
  transition: all 0.3s ease;
  position: relative;
}

/* 侧边栏样式 */
.note-sidebar {
  width: 280px;
  height: 100%;
  background: rgba(15, 12, 41, 0.6);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: all 0.3s ease;
  position: relative;
}

.note-sidebar.collapsed {
  width: 0;
  border-right: none;
  overflow: hidden;
}

/* 分类列表容器 */
.category-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 分类组 */
.category-group {
  border-radius: 10px;
  overflow: hidden;
}

/* 分类头部 */
.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.category-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.category-header.active {
  background: rgba(255, 255, 255, 0.08);
}

.category-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.category-icon {
  font-size: 18px;
}

.category-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}

.category-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 10px;
}

.expand-icon {
  width: 16px;
  height: 16px;
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

/* 分类操作按钮 */
.category-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.category-header:hover .category-actions {
  opacity: 1;
}

.action-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.action-btn svg {
  width: 14px;
  height: 14px;
}

/* 分类下的笔记列表 */
.note-list {
  padding: 4px 0 4px 24px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.note-item {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.note-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.note-item.active {
  background: rgba(102, 126, 234, 0.2);
}

.note-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-item.active .note-title {
  color: white;
}

/* 空笔记提示 */
.empty-note {
  padding: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
}

/* 新增分类按钮 */
.add-category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.5);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  margin-top: 8px;
}

.add-category-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.3);
}

.add-category-item svg {
  width: 16px;
  height: 16px;
}

.add-category-item span {
  font-size: 13px;
}

/* 无分类提示 */
.no-category-hint {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.3);
}

.hint-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.no-category-hint p {
  font-size: 13px;
}

/* 编辑器面板 */
.note-editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.title-area {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.note-title-input {
  flex: 1;
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  outline: none;
}

.note-title-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 保存状态 */
.save-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.save-status.unsaved {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}

.save-status.saved {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

/* 保存按钮 */
.save-btn {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 6px;
  color: #22c55e;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.2);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-btn svg {
  width: 16px;
  height: 16px;
}

.save-btn .btn-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(26, 26, 46, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  pointer-events: none;
  z-index: 100;
}

.save-btn:hover .btn-tooltip {
  opacity: 1;
  visibility: visible;
}

.category-select {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}

.category-select option {
  background: #1a1a2e;
  color: #fff;
}

.fullscreen-btn,
.delete-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.fullscreen-btn {
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  color: #667eea;
}

.fullscreen-btn:hover {
  background: rgba(102, 126, 234, 0.2);
}

.delete-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.fullscreen-btn svg,
.delete-btn svg {
  width: 16px;
  height: 16px;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

/* 全屏模式 */
.note-container.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: linear-gradient(to bottom, #0f0c29 0%, #302b63 50%, #24243e 100%);
}

.note-editor-panel.fullscreen-mode {
  width: 100%;
  height: 100%;
}

/* 全屏提示 */
.fullscreen-hint {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  z-index: 10;
  animation: fadeInOut 3s ease-in-out;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  20%, 80% { opacity: 1; }
}

/* 空编辑器 */
.empty-editor {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-editor-content {
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
}

.empty-icon-large {
  font-size: 72px;
  margin-bottom: 16px;
}

.empty-editor-content p {
  font-size: 14px;
}

/* Vditor 暗色主题适配 */
:deep(.vditor) {
  border: none !important;
  background: transparent !important;
}

:deep(.vditor-toolbar) {
  background: rgba(255, 255, 255, 0.05) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  padding: 8px 12px !important;
  display: flex !important;
  justify-content: center !important;
}

:deep(.vditor-toolbar__item) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.vditor-toolbar__item:hover) {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #fff !important;
}

:deep(.vditor-tooltipped::after) {
  position: absolute !important;
  z-index: 10000 !important;
  pointer-events: none !important;
  top: 100% !important;
  bottom: auto !important;
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%) !important;
  margin-left: 0 !important;
  margin-top: 6px !important;
  margin-bottom: 0 !important;
  background: rgba(26, 26, 46, 0.98) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-radius: 4px !important;
  padding: 4px 8px !important;
  font-size: 12px !important;
  color: rgba(255, 255, 255, 0.9) !important;
  white-space: nowrap !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
}

:deep(.vditor-tooltipped::before) {
  display: none !important;
}

:deep(.vditor-tooltipped:hover::after) {
  opacity: 1 !important;
  visibility: visible !important;
}

:deep(.vditor-panel) {
  z-index: 10000 !important;
}

:deep(.vditor-ir) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.vditor-ir pre.vditor-reset) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.vditor-ir pre.vditor-reset:focus) {
  background: transparent !important;
}

:deep(.vditor-preview) {
  background: transparent !important;
}

:deep(.vditor-ir strong),
:deep(.vditor-preview strong) {
  color: #fbbf24 !important;
  font-weight: 600 !important;
}

:deep(.vditor-hint) {
  background: rgba(26, 26, 46, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

:deep(.vditor-hint button) {
  color: rgba(255, 255, 255, 0.8) !important;
}

:deep(.vditor-hint button:hover),
:deep(.vditor-hint button:focus) {
  background: rgba(255, 255, 255, 0.1) !important;
}

/* 折叠按钮 */
.sidebar-toggle {
  position: absolute;
  bottom: 16px;
  left: 268px;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  transition: all 0.3s ease;
}

.note-sidebar.collapsed + .sidebar-toggle {
  left: 0;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.sidebar-toggle .el-icon {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
</style>
