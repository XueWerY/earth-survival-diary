<template>
  <div class="countdown-container">
    <div class="top-nav-area">
      <div class="category-nav-scroll-wrapper" ref="categoryNavRef">
        <div class="category-nav-inner">
          <div
              class="nav-item"
              :class="{ active: currentCategory === '' }"
              :ref="setCategoryNavItemRef"
              @click="selectCategory('')"
          >
            <span class="nav-icon">📋</span>
            <span class="nav-name">全部</span>
            <span class="nav-count">{{ milestones.length }}</span>
          </div>
          <div
              v-for="cat in categories"
              :key="cat.value"
              class="nav-item"
              :class="{ active: currentCategory === cat.value }"
              :ref="setCategoryNavItemRef"
              @click="selectCategory(cat.value)"
          >
            <span class="nav-icon">{{ cat.icon }}</span>
            <span class="nav-name">{{ cat.label }}</span>
            <span class="nav-count">{{ getCategoryCount(cat.value) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="ops-nav-area">
      <div class="ops-nav-scroll-wrapper" ref="opsNavRef">
        <div class="ops-nav-inner">
          <div class="ops-item" :ref="setOpsNavItemRef" @click="handleEditCurrentCategory">
            <span class="ops-icon">✏️</span>
            <span class="ops-name">编辑分类</span>
          </div>
          <div class="ops-item" :ref="setOpsNavItemRef" @click="handleAddCategory">
            <span class="ops-icon">➕</span>
            <span class="ops-name">添加分类</span>
          </div>
          <div class="ops-item" :ref="setOpsNavItemRef" @click="handleDeleteCurrentCategory">
            <span class="ops-icon">🗑️</span>
            <span class="ops-name">删除分类</span>
          </div>
          <div class="ops-item" :ref="setOpsNavItemRef" @click="moveCategoryLeft">
            <span class="ops-icon">⬅️</span>
            <span class="ops-name">左移分类</span>
          </div>
          <div class="ops-item" :ref="setOpsNavItemRef" @click="moveCategoryRight">
            <span class="ops-icon">➡️</span>
            <span class="ops-name">右移分类</span>
          </div>
          <div class="ops-item ops-add-milestone" :ref="setOpsNavItemRef" @click="handleAddMilestone">
            <span class="ops-icon">📅</span>
            <span class="ops-name">添加倒数日</span>
          </div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="content-wrapper">
        <div class="content-body">
          <el-scrollbar>
            <el-empty
                v-if="milestones.length === 0"
                description="暂无倒数日，点击下方操作栏添加你的第一个重要时刻"
                :image-size="120"
            />

            <el-empty
                v-else-if="filteredMilestones.length === 0"
                description="该分类下暂无倒数日"
                :image-size="120"
            />

            <template v-else>
              <div v-if="pinnedMilestones.length > 0" class="section pinned-section">
                <div class="section-title">
                  <el-icon><Star /></el-icon>
                  <span>星标倒数日</span>
                </div>
                <div class="milestone-grid">
                  <div
                      v-for="milestone in pinnedMilestones"
                      :key="milestone.id"
                      class="milestone-card pinned"
                      :class="{ 'system-card': milestone.isSystem }"
                  >
                    <div class="card-header">
                      <span class="category-badge">
                        {{ getCategoryIcon(milestone.category) }}
                      </span>
                      <div class="card-actions">
                        <el-button v-if="!milestone.isSystem" type="info" size="small" text :icon="Edit" class="card-btn" @click.stop="handleEditMilestone(milestone)" title="编辑" />
                        <el-button v-if="!milestone.isSystem" type="warning" size="small" text :icon="Star" class="card-btn card-btn-unpin" @click.stop="handleCommand('unpin', milestone)" title="取消星标" />
                        <el-button v-if="!milestone.isSystem" type="danger" size="small" text :icon="Delete" class="card-btn" @click.stop="handleCommand('delete', milestone)" title="删除" />
                        <span v-if="milestone.isSystem" class="system-badge">系统</span>
                      </div>
                    </div>

                    <h3 class="milestone-name" @click="!milestone.isSystem && handleEditMilestone(milestone)">{{ milestone.name }}</h3>

                    <div class="milestone-date">
                      <el-icon><Calendar /></el-icon>
                      {{ formatDate(milestone.targetDate) }}
                      <template v-if="getReminderLabel(milestone)">
                        <span class="reminder-text">
                          <el-icon><Bell /></el-icon>
                          {{ getReminderLabel(milestone) }}
                        </span>
                      </template>
                    </div>

                    <div class="countdown-display" :class="getCountdownClass(milestone)">
                      <span class="countdown-number">{{ getCountdownDays(milestone) }}</span>
                      <span class="countdown-unit">{{ getCountdownUnit(milestone) }}</span>
                    </div>

                    <p v-if="milestone.description" class="milestone-desc">{{ milestone.description }}</p>
                  </div>
                </div>
              </div>

              <div v-if="upcomingMilestones.length > 0" class="section upcoming-section">
                <div class="section-title">
                  <el-icon><Clock /></el-icon>
                  <span>即将到来</span>
                </div>
                <div class="milestone-grid">
                  <div
                      v-for="milestone in upcomingMilestones"
                      :key="milestone.id"
                      class="milestone-card"
                      :class="{ 'urgent': isUrgent(milestone) }"
                  >
                    <div class="card-header">
                      <span class="category-badge">
                        {{ getCategoryIcon(milestone.category) }}
                      </span>
                      <div class="card-actions">
                        <el-button type="info" size="small" text :icon="Edit" class="card-btn" @click.stop="handleEditMilestone(milestone)" title="编辑" />
                        <el-button type="warning" size="small" text :icon="Star" class="card-btn" @click.stop="handleCommand('pin', milestone)" title="设为星标" />
                        <el-button type="danger" size="small" text :icon="Delete" class="card-btn" @click.stop="handleCommand('delete', milestone)" title="删除" />
                      </div>
                    </div>

                    <h3 class="milestone-name" @click="handleEditMilestone(milestone)">{{ milestone.name }}</h3>

                    <div class="milestone-date">
                      <el-icon><Calendar /></el-icon>
                      {{ formatDate(milestone.targetDate) }}
                      <template v-if="getReminderLabel(milestone)">
                        <span class="reminder-text">
                          <el-icon><Bell /></el-icon>
                          {{ getReminderLabel(milestone) }}
                        </span>
                      </template>
                    </div>

                    <div class="countdown-display" :class="getCountdownClass(milestone)">
                      <span class="countdown-number">{{ getCountdownDays(milestone) }}</span>
                      <span class="countdown-unit">{{ getCountdownUnit(milestone) }}</span>
                    </div>

                    <p v-if="milestone.description" class="milestone-desc">{{ milestone.description }}</p>
                  </div>
                </div>
              </div>

              <div v-if="futureMilestones.length > 0" class="section future-section">
                <div class="section-title">
                  <el-icon><Sunny /></el-icon>
                  <span>未来展望</span>
                </div>
                <div class="milestone-grid">
                  <div
                      v-for="milestone in futureMilestones"
                      :key="milestone.id"
                      class="milestone-card"
                  >
                    <div class="card-header">
                      <span class="category-badge">
                        {{ getCategoryIcon(milestone.category) }}
                      </span>
                      <div class="card-actions">
                        <el-button type="info" size="small" text :icon="Edit" class="card-btn" @click.stop="handleEditMilestone(milestone)" title="编辑" />
                        <el-button type="warning" size="small" text :icon="Star" class="card-btn" @click.stop="handleCommand('pin', milestone)" title="设为星标" />
                        <el-button type="danger" size="small" text :icon="Delete" class="card-btn" @click.stop="handleCommand('delete', milestone)" title="删除" />
                      </div>
                    </div>

                    <h3 class="milestone-name" @click="handleEditMilestone(milestone)">{{ milestone.name }}</h3>

                    <div class="milestone-date">
                      <el-icon><Calendar /></el-icon>
                      {{ formatDate(milestone.targetDate) }}
                      <template v-if="getReminderLabel(milestone)">
                        <span class="reminder-text">
                          <el-icon><Bell /></el-icon>
                          {{ getReminderLabel(milestone) }}
                        </span>
                      </template>
                    </div>

                    <div class="countdown-display" :class="getCountdownClass(milestone)">
                      <span class="countdown-number">{{ getCountdownDays(milestone) }}</span>
                      <span class="countdown-unit">{{ getCountdownUnit(milestone) }}</span>
                    </div>

                    <p v-if="milestone.description" class="milestone-desc">{{ milestone.description }}</p>
                  </div>
                </div>
              </div>

              <div v-if="passedMilestones.length > 0" class="section passed-section">
                <div class="section-title">
                  <el-icon><Timer /></el-icon>
                  <span>时光印记</span>
                </div>
                <div class="milestone-grid passed">
                  <div
                      v-for="milestone in passedMilestones"
                      :key="milestone.id"
                      class="milestone-card passed"
                  >
                    <div class="card-header">
                      <span class="category-badge">
                        {{ getCategoryIcon(milestone.category) }}
                      </span>
                      <div class="card-actions">
                        <el-button type="info" size="small" text :icon="Edit" class="card-btn" @click.stop="handleEditMilestone(milestone)" title="编辑" />
                        <el-button type="warning" size="small" text :icon="Star" class="card-btn" @click.stop="handleCommand('pin', milestone)" title="设为星标" />
                        <el-button type="danger" size="small" text :icon="Delete" class="card-btn" @click.stop="handleCommand('delete', milestone)" title="删除" />
                      </div>
                    </div>

                    <h3 class="milestone-name" @click="handleEditMilestone(milestone)">{{ milestone.name }}</h3>

                    <div class="milestone-date">
                      <el-icon><Calendar /></el-icon>
                      {{ formatDate(milestone.targetDate) }}
                      <template v-if="getReminderLabel(milestone)">
                        <span class="reminder-text">
                          <el-icon><Bell /></el-icon>
                          {{ getReminderLabel(milestone) }}
                        </span>
                      </template>
                    </div>

                    <div class="countdown-display" :class="getCountdownClass(milestone)">
                      <span class="countdown-number">{{ getCountdownDays(milestone) }}</span>
                      <span class="countdown-unit">{{ getCountdownUnit(milestone) }}</span>
                    </div>

                    <p v-if="milestone.description" class="milestone-desc">{{ milestone.description }}</p>
                  </div>
                </div>
              </div>
            </template>
          </el-scrollbar>
        </div>
      </div>
    </div>

    <CountdownForm
        v-model:visible="countdownFormVisible"
        :milestone="editingMilestoneForForm"
        :categories="categories"
        :default-category="currentCategory || 'life'"
        @submit="handleCountdownFormSubmit"
    />

    <el-dialog
        v-model="categoryFormVisible"
        :title="editingCategory ? '编辑分类' : '添加分类'"
        width="400px"
        modal-class="category-dialog-overlay"
        class="category-form-dialog"
    >
      <el-form :model="categoryForm" label-width="80px">
        <el-form-item label="分类名称">
          <el-input v-model="categoryForm.label" placeholder="输入分类名称" maxlength="10" />
        </el-form-item>
        <el-form-item label="图标">
          <div class="icon-picker">
            <div
                v-for="icon in ICON_OPTIONS"
                :key="icon"
                class="icon-option"
                :class="{ active: categoryForm.icon === icon }"
                @click="categoryForm.icon = icon"
            >
              {{ icon }}
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryFormVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCategoryFormSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, onUnmounted, watch, nextTick, onBeforeUpdate, inject, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Calendar, Clock, Timer, Star, Sunny, Bell, Edit, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import CountdownForm from './CountdownForm.vue'
import { setData, getSystemStateField, setSystemStateField } from '../services/storageService'
import { logger } from '../lib/logger'

interface Milestone {
  id: string
  name: string
  targetDate: string
  category: string
  description: string
  countMode?: 'countdown' | 'countup'
  pinned: boolean
  isSystem?: boolean
  createdAt: string
  updatedAt: string
  reminderStrategy?: string
  reminderDays?: number
  reminderHours?: number
  reminderMinutes?: number
}

interface Category {
  value: string
  label: string
  icon: string
  color: string
  isCustom?: boolean
}

const SYSTEM_MILESTONE_ID = 'system-usage-days'

const isSystemUsageMilestone = (m: Milestone): boolean => m.id === SYSTEM_MILESTONE_ID

const getDaysSinceAccountRegistration = (milestone: Milestone): number => {
  const today = dayjs().startOf('day')
  const start = dayjs(milestone.targetDate).startOf('day')
  if (!start.isValid()) return 0
  const n = today.diff(start, 'day')
  return n < 0 ? 0 : n
}

const DEFAULT_CATEGORIES: Category[] = [
  { value: 'birthday', label: '生日', icon: '🎂', color: '#f472b6' },
  { value: 'anniversary', label: '纪念日', icon: '💕', color: '#ec4899' },
  { value: 'holiday', label: '节日', icon: '🎉', color: '#a855f7' },
  { value: 'travel', label: '旅行', icon: '✈️', color: '#06b6d4' },
  { value: 'entertainment', label: '娱乐', icon: '🎮', color: '#8b5cf6' },
  { value: 'work', label: '工作', icon: '💼', color: '#3b82f6' },
  { value: 'study', label: '学习', icon: '📚', color: '#10b981' },
  { value: 'life', label: '生活', icon: '🌟', color: '#f59e0b' }
]

const ICON_OPTIONS = ['🎂', '💕', '🎉', '✈️', '🎮', '💼', '📚', '🌟', '🎵', '🎬', '🏠', '❤️', '🎁', '🏆', '📅', '🎯']

const COLOR_OPTIONS = ['#f472b6', '#ec4899', '#a855f7', '#8b5cf6', '#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280']

const STORAGE_KEY = ['countdown', 'countdowns'] as const
const CATEGORY_KEY = ['countdown', 'categories'] as const

const milestones = inject<Ref<Milestone[]>>('countdownMilestones', ref<Milestone[]>([]))
const categories = inject<Ref<Category[]>>('countdownCategories', ref<Category[]>([...DEFAULT_CATEGORIES]))
const currentCategory = ref('')

const categoryNavRef = ref<HTMLElement>()
const opsNavRef = ref<HTMLElement>()
const categoryNavItemsRef = ref<HTMLElement[]>([])
const opsNavItemsRef = ref<HTMLElement[]>([])

const clearNavRefs = () => {
  categoryNavItemsRef.value = []
  opsNavItemsRef.value = []
}

const setCategoryNavItemRef = (el: any) => {
  if (el) categoryNavItemsRef.value.push(el)
}

const setOpsNavItemRef = (el: any) => {
  if (el) opsNavItemsRef.value.push(el)
}

const scrollToCenter = (container: HTMLElement, target: HTMLElement) => {
  if (!container || !target) return
  const containerWidth = container.clientWidth
  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const targetCenterInContainer = targetRect.left - containerRect.left + container.scrollLeft + (targetRect.width / 2)
  container.scrollTo({ left: Math.max(0, targetCenterInContainer - (containerWidth / 2)), behavior: 'smooth' })
}

const scrollCategoryNavToActive = () => {
  nextTick(() => {
    const container = categoryNavRef.value as HTMLElement
    if (!container) return
    const activeItem = categoryNavItemsRef.value.find(item => item.classList.contains('active')) as HTMLElement || container.querySelector('.nav-item.active') as HTMLElement
    if (activeItem) scrollToCenter(container, activeItem)
  })
}

let isCategoryNavDragging = false
let categoryNavDragStartX = 0
let categoryNavDragScrollLeft = 0
let isCategoryNavDragInitialized = false

const initCategoryNavDrag = () => {
  if (isCategoryNavDragInitialized) return
  isCategoryNavDragInitialized = true
  const el = categoryNavRef.value
  if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isCategoryNavDragging = true; categoryNavDragStartX = e.pageX; categoryNavDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isCategoryNavDragging) return; e.preventDefault(); const walk = categoryNavDragStartX - e.pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, categoryNavDragScrollLeft + walk)) })
  const endDrag = () => { if (!isCategoryNavDragging) return; isCategoryNavDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', endDrag); window.addEventListener('mouseleave', endDrag)
  el.addEventListener('touchstart', (e: TouchEvent) => { categoryNavDragStartX = e.touches[0].pageX; categoryNavDragScrollLeft = el.scrollLeft }, { passive: true })
  el.addEventListener('touchmove', (e: TouchEvent) => { const walk = categoryNavDragStartX - e.touches[0].pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, categoryNavDragScrollLeft + walk)) }, { passive: true })
}

let isOpsNavDragging = false
let opsNavDragStartX = 0
let opsNavDragScrollLeft = 0
let isOpsNavDragInitialized = false

const initOpsNavDrag = () => {
  if (isOpsNavDragInitialized) return
  isOpsNavDragInitialized = true
  const el = opsNavRef.value
  if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isOpsNavDragging = true; opsNavDragStartX = e.pageX; opsNavDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isOpsNavDragging) return; e.preventDefault(); const walk = opsNavDragStartX - e.pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, opsNavDragScrollLeft + walk)) })
  const endOpsDrag = () => { if (!isOpsNavDragging) return; isOpsNavDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', endOpsDrag); window.addEventListener('mouseleave', endOpsDrag)
  el.addEventListener('touchstart', (e: TouchEvent) => { opsNavDragStartX = e.touches[0].pageX; opsNavDragScrollLeft = el.scrollLeft }, { passive: true })
  el.addEventListener('touchmove', (e: TouchEvent) => { const walk = opsNavDragStartX - e.touches[0].pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, opsNavDragScrollLeft + walk)) }, { passive: true })
}

const isDefaultCategory = (value: string): boolean => {
  return DEFAULT_CATEGORIES.some(c => c.value === value)
}

const initFilterState = async () => {
  const parsedState = await getSystemStateField('countdown')
  if (parsedState) {
    currentCategory.value = parsedState.currentCategory || ''
  }
}

watch(currentCategory, async () => {
  const state = { currentCategory: currentCategory.value }
  await setSystemStateField('countdown', state)
  scrollCategoryNavToActive()
})

const filteredMilestones = computed(() => {
  let result = [...milestones.value]

  if (currentCategory.value) {
    result = result.filter(m => m.category === currentCategory.value)
  }

  result.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())

  return result
})

const getCategoryCount = (categoryValue: string): number => {
  return milestones.value.filter(m => m.category === categoryValue).length
}

const pinnedMilestones = computed(() => {
  return filteredMilestones.value.filter(m => m.pinned === true)
})

const upcomingMilestones = computed(() => {
  return filteredMilestones.value.filter(m => {
    if (m.pinned === true) return false
    const days = getDaysDiff(m)
    return days >= 0 && days <= 30
  })
})

const futureMilestones = computed(() => {
  return filteredMilestones.value.filter(m => {
    if (m.pinned === true) return false
    const days = getDaysDiff(m)
    return days > 30
  })
})

const passedMilestones = computed(() => {
  return filteredMilestones.value.filter(m => {
    if (m.pinned === true) return false
    return getDaysDiff(m) < 0
  })
})

const getDaysDiff = (milestone: Milestone): number => {
  const today = dayjs().startOf('day')
  const target = dayjs(milestone.targetDate).startOf('day')

  if (!target.isValid()) {
    return 999999
  }

  return target.diff(today, 'day')
}

const getCountdownDays = (milestone: Milestone): number => {
  if (isSystemUsageMilestone(milestone)) {
    return getDaysSinceAccountRegistration(milestone)
  }
  const days = getDaysDiff(milestone)
  if (milestone.countMode === 'countup') {
    if (days > 0) return days
    if (days < 0) return Math.abs(days)
    return 0
  }
  return Math.abs(days)
}

const getCountdownUnit = (milestone: Milestone): string => {
  if (isSystemUsageMilestone(milestone)) {
    return getDaysSinceAccountRegistration(milestone) === 0 ? '今天' : '天'
  }
  const days = getDaysDiff(milestone)
  if (milestone.countMode === 'countup') {
    if (days > 0) return '天后'
    if (days < 0) return '天'
    return '今天'
  }
  if (days > 0) return '天后'
  if (days < 0) return '天前'
  return '今天'
}

const getReminderLabel = (milestone: Milestone) => {
  if (milestone.countMode === 'countup') return ''
  if (milestone.reminderStrategy === 'none' || !milestone.reminderStrategy) return ''
  if (milestone.reminderStrategy === 'on_time') return '准时提醒'
  if (milestone.reminderStrategy === 'advance') {
    const parts: string[] = []
    if (milestone.reminderDays) parts.push(`${milestone.reminderDays}天`)
    if (milestone.reminderHours) parts.push(`${milestone.reminderHours}小时`)
    if (milestone.reminderMinutes) parts.push(`${milestone.reminderMinutes}分钟`)
    return `提前${parts.join('')}`
  }
  return ''
}

const getCountdownClass = (milestone: Milestone): string => {
  if (isSystemUsageMilestone(milestone)) {
    return getDaysSinceAccountRegistration(milestone) === 0 ? 'today' : 'passed'
  }
  const days = getDaysDiff(milestone)
  if (days === 0) return 'today'
  if (days > 0 && days <= 7) return 'urgent'
  if (days > 0) return 'upcoming'
  return 'passed'
}

const isUrgent = (milestone: Milestone): boolean => {
  const days = getDaysDiff(milestone)
  return days >= 0 && days <= 7
}

const formatDate = (date: string): string => {
  return dayjs(date).format('YYYY年MM月DD日')
}

const getCategoryIcon = (categoryValue: string): string => {
  if (!categoryValue) return '📌'
  const cat = categories.value.find(c => c.value === categoryValue)
  return cat?.icon || '📌'
}

const saveData = async () => {
  const saved = await setData(STORAGE_KEY[0], STORAGE_KEY[1], milestones.value)
  logger.info('[倒数日] 保存数据', { success: saved, count: milestones.value.length })
}

const saveCategories = async () => {
  await setData(CATEGORY_KEY[0], CATEGORY_KEY[1], categories.value)
}

const selectCategory = (category: string) => {
  logger.info('[倒数日] 切换分类', { category: category || '全部' })
  currentCategory.value = category
}

const countdownFormVisible = ref(false)
const editingMilestoneForForm = ref<Milestone | null>(null)

const handleAddMilestone = () => {
  editingMilestoneForForm.value = null
  countdownFormVisible.value = true
  logger.info('[倒数日] 打开添加倒数日对话框')
}

const handleEditMilestone = (milestone: Milestone) => {
  editingMilestoneForForm.value = { ...milestone }
  countdownFormVisible.value = true
  logger.info('[倒数日] 打开编辑倒数日对话框', { id: milestone.id, name: milestone.name })
}

const handleCountdownFormSubmit = (data: Partial<Milestone>) => {
  const hasReminder = data.reminderStrategy === 'advance'
  if (editingMilestoneForForm.value) {
    const index = milestones.value.findIndex(m => m.id === editingMilestoneForForm.value!.id)
    if (index > -1) {
      milestones.value[index] = {
        ...milestones.value[index],
        ...data,
        updatedAt: new Date().toISOString()
      }
      logger.info('[倒数日] 编辑倒数日', { id: editingMilestoneForForm.value.id, name: data.name, reminder: data.reminderStrategy === 'advance' ? `提前${data.reminderDays}天${data.reminderHours}小时${data.reminderMinutes}分钟` : data.reminderStrategy })
      ElMessage.success('更新成功')
    }
  } else {
    const newMilestone: Milestone = {
      id: Date.now().toString(),
      name: data.name || '未命名',
      targetDate: data.targetDate || dayjs().format('YYYY-MM-DD'),
      category: data.category || 'life',
      description: data.description || '',
      countMode: data.countMode === 'countup' ? 'countup' : 'countdown',
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reminderStrategy: data.reminderStrategy || 'none',
      reminderDays: data.reminderDays || 0,
      reminderHours: data.reminderHours || 0,
      reminderMinutes: data.reminderMinutes || 0
    }
    milestones.value.push(newMilestone)
    logger.info('[倒数日] 添加倒数日', { name: data.name })
    ElMessage.success('添加成功')
  }
  saveData()
  if (hasReminder) refreshReminders()
  editingMilestoneForForm.value = null
}

const handleCommand = (command: string, milestone: Milestone) => {
  const index = milestones.value.findIndex(m => m.id === milestone.id)

  switch (command) {
    case 'edit':
      if (milestone.isSystem) {
        ElMessage.warning('系统倒数日不可编辑')
        return
      }
      handleEditMilestone(milestone)
      break
    case 'pin':
      if (index > -1) {
        milestones.value[index].pinned = true
        saveData()
        if (milestone.reminderStrategy === 'advance') refreshReminders()
        logger.info('[倒数日] 设为星标', { id: milestone.id, name: milestone.name })
        ElMessage.success('已设为星标')
      }
      break
    case 'unpin':
      if (milestone.isSystem) {
        ElMessage.warning('系统倒数日不可取消星标')
        return
      }
      if (index > -1) {
        milestones.value[index].pinned = false
        saveData()
        if (milestone.reminderStrategy === 'advance') refreshReminders()
        logger.info('[倒数日] 取消星标', { id: milestone.id, name: milestone.name })
        ElMessage.success('已取消星标')
      }
      break
    case 'delete':
      if (milestone.isSystem) {
        ElMessage.warning('系统倒数日不可删除')
        return
      }
      ElMessageBox.confirm('确定要删除这个倒数日吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        const deleteIndex = milestones.value.findIndex(m => m.id === milestone.id)
        if (deleteIndex > -1) {
          const hadReminder = milestones.value[deleteIndex].reminderStrategy === 'advance'
          milestones.value.splice(deleteIndex, 1)
          saveData()
          if (hadReminder) refreshReminders()
          logger.info('[倒数日] 删除倒数日', { id: milestone.id, name: milestone.name })
          ElMessage.success('删除成功')
        }
      }).catch(() => {})
      break
  }
}

const handleEditCurrentCategory = () => {
  if (!currentCategory.value) {
    ElMessage.warning('请先选择一个分类')
    return
  }
  const cat = categories.value.find(c => c.value === currentCategory.value)
  if (cat) {
    editingCategory.value = currentCategory.value
    categoryForm.value = {
      label: cat.label,
      icon: cat.icon
    }
    categoryFormVisible.value = true
    logger.info('[倒数日] 编辑当前分类', { value: currentCategory.value })
  }
}

const handleAddCategory = () => {
  editingCategory.value = null
  categoryForm.value = {
    label: '',
    icon: '📌'
  }
  categoryFormVisible.value = true
  logger.info('[倒数日] 打开添加分类对话框')
}

const handleDeleteCurrentCategory = () => {
  if (!currentCategory.value) {
    ElMessage.warning('请先选择一个分类')
    return
  }
  if (isDefaultCategory(currentCategory.value)) {
    ElMessage.warning('系统默认分类不可删除')
    return
  }
  const count = milestones.value.filter(m => m.category === currentCategory.value).length
  if (count > 0) {
    ElMessage.warning(`该分类下有 ${count} 个倒数日，请先删除或移动这些倒数日`)
    return
  }
  ElMessageBox.confirm('确定要删除当前分类吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const index = categories.value.findIndex(c => c.value === currentCategory.value)
    if (index > -1) {
      categories.value.splice(index, 1)
      saveCategories()
      logger.info('[倒数日] 删除分类', { value: currentCategory.value })
      ElMessage.success('删除成功')
      currentCategory.value = ''
    }
  }).catch(() => {})
}

const moveCategoryLeft = () => {
  if (!currentCategory.value) {
    ElMessage.warning('请先选择一个分类')
    return
  }
  const index = categories.value.findIndex(c => c.value === currentCategory.value)
  if (index <= 0) {
    ElMessage.warning('已经是第一个分类，无法左移')
    return
  }
  const [moved] = categories.value.splice(index, 1)
  categories.value.splice(index - 1, 0, moved)
  saveCategories()
  logger.info('[倒数日] 左移分类', { value: currentCategory.value })
  ElMessage.success('分类已左移')
}

const moveCategoryRight = () => {
  if (!currentCategory.value) {
    ElMessage.warning('请先选择一个分类')
    return
  }
  const index = categories.value.findIndex(c => c.value === currentCategory.value)
  if (index >= categories.value.length - 1) {
    ElMessage.warning('已经是最后一个分类，无法右移')
    return
  }
  const [moved] = categories.value.splice(index, 1)
  categories.value.splice(index + 1, 0, moved)
  saveCategories()
  logger.info('[倒数日] 右移分类', { value: currentCategory.value })
  ElMessage.success('分类已右移')
}

const categoryFormVisible = ref(false)
const editingCategory = ref<string | null>(null)
const categoryForm = ref({
  label: '',
  icon: '📌'
})

const handleCategoryFormSubmit = () => {
  if (!categoryForm.value.label.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }

  if (editingCategory.value) {
    const index = categories.value.findIndex(c => c.value === editingCategory.value)
    if (index > -1) {
      categories.value[index] = {
        ...categories.value[index],
        label: categoryForm.value.label,
        icon: categoryForm.value.icon,
        color: categories.value[index].color
      }
      logger.info('[倒数日] 编辑分类', { value: editingCategory.value, label: categoryForm.value.label })
      ElMessage.success('分类已更新')
    }
  } else {
    const value = `custom-${Date.now()}`
    const defaultColorIndex = categories.value.length % COLOR_OPTIONS.length
    categories.value.push({
      value,
      label: categoryForm.value.label,
      icon: categoryForm.value.icon,
      color: COLOR_OPTIONS[defaultColorIndex],
      isCustom: true
    })
    logger.info('[倒数日] 添加分类', { label: categoryForm.value.label })
    ElMessage.success('分类已添加')
  }
  saveCategories()
  categoryFormVisible.value = false
}

const refreshReminders = () => {
  if (typeof window !== 'undefined' && (window as any).__countdownRefresh) {
    (window as any).__countdownRefresh()
  }
}

onMounted(async () => {
  if (milestones.value.length === 0) {
    await new Promise<void>(resolve => {
      const check = () => {
        if (milestones.value.length > 0) { resolve(); return }
        setTimeout(check, 50)
      }
      check()
    })
  }
  await initFilterState()
  nextTick(() => {
    initCategoryNavDrag()
    initOpsNavDrag()
    scrollCategoryNavToActive()
  })
})

onBeforeUpdate(() => clearNavRefs())

onUnmounted(() => {
})

onActivated(async () => {
  nextTick(() => {
    scrollCategoryNavToActive()
  })
})
</script>

<style scoped>
.countdown-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  position: relative;
}

.top-nav-area {
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.category-nav-scroll-wrapper {
  height: 48px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.category-nav-scroll-wrapper::-webkit-scrollbar {
  display: none;
}

.category-nav-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 16px;
  white-space: nowrap;
  width: max-content;
  min-width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.ops-nav-area {
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.ops-nav-scroll-wrapper {
  height: 40px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.ops-nav-scroll-wrapper::-webkit-scrollbar {
  display: none;
}

.ops-nav-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px 16px;
  white-space: nowrap;
  width: max-content;
  min-width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.ops-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  height: 32px;
}

.ops-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.ops-icon {
  font-size: 13px;
  width: 16px;
  text-align: center;
}

.ops-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.ops-add-milestone .ops-name {
  color: rgba(102, 126, 234, 0.85);
  font-weight: 500;
}

.ops-add-milestone:hover {
  background: rgba(102, 126, 234, 0.15);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  position: relative;
  height: 36px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.nav-item.active {
  background: rgba(102, 126, 234, 0.2);
}

.nav-item.active .nav-name {
  color: #fff;
  font-weight: 500;
}

.nav-icon {
  font-size: 15px;
  width: 18px;
  text-align: center;
}

.nav-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  white-space: nowrap;
}

.nav-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  min-width: 20px;
  text-align: center;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 1240px) {
  .content-wrapper {
    max-width: none;
  }
}

.content-body {
  flex: 1;
  overflow: hidden;
}

.section {
  padding: 20px 24px;
  box-sizing: border-box;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 16px;
}

.milestone-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.milestone-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  overflow: hidden;
}

.milestone-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border-color: rgba(102, 126, 234, 0.5);
}

.milestone-card.pinned {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
  border-color: rgba(251, 191, 36, 0.3);
}

.milestone-card.urgent {
  border-color: rgba(239, 68, 68, 0.3);
}

.milestone-card.passed {
  opacity: 0.85;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.card-btn {
  opacity: 0;
  transition: opacity 0.2s;
  width: 24px;
  height: 24px;
  padding: 2px;
  flex-shrink: 0;
}

.milestone-card:hover .card-btn {
  opacity: 1;
}

.card-btn-unpin {
  opacity: 1;
}

.category-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.milestone-name {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.milestone-date {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 16px;
}

.milestone-date .reminder-text {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #f59e0b;
  margin-left: 4px;
}

.countdown-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 12px;
}

.countdown-display.today {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%);
}

.countdown-display.urgent {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(249, 115, 22, 0.1) 100%);
}

.countdown-display.upcoming {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%);
}

.countdown-display.passed {
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.15) 0%, rgba(75, 85, 99, 0.1) 100%);
}

.countdown-number {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
}

.countdown-display.today .countdown-number {
  color: #10b981;
}

.countdown-display.urgent .countdown-number {
  color: #ef4444;
}

.countdown-display.upcoming .countdown-number {
  color: #3b82f6;
}

.countdown-display.passed .countdown-number {
  color: rgba(255, 255, 255, 0.6);
}

.countdown-unit {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.milestone-desc {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pinned-section {
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.05) 0%, transparent 100%);
}

.upcoming-section {
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.03) 0%, transparent 100%);
}

.future-section {
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, transparent 100%);
}

.passed-section {
  background: linear-gradient(180deg, rgba(107, 114, 128, 0.03) 0%, transparent 100%);
}

.milestone-card.system-card {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
  border-color: rgba(59, 130, 246, 0.3);
}

.milestone-card.system-card:hover {
  transform: none;
  box-shadow: none;
  border-color: rgba(59, 130, 246, 0.3);
}

.system-badge {
  font-size: 11px;
  color: rgba(59, 130, 246, 0.8);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.icon-option {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.icon-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.icon-option.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.category-form-dialog :deep(.el-dialog) {
  width: 400px;
}

@media (max-width: 440px) {
  .category-form-dialog :deep(.el-dialog) {
    width: calc(100vw - 32px);
    margin: 16px auto;
  }
}
</style>

<style>
.category-dialog-overlay .el-dialog {
  background: rgba(30, 30, 50, 0.98) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px !important;
}

.category-dialog-overlay .el-dialog__header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 16px 20px !important;
  margin-right: 0 !important;
}

.category-dialog-overlay .el-dialog__title {
  color: #fff !important;
  font-weight: 600 !important;
}

.category-dialog-overlay .el-dialog__headerbtn .el-dialog__close {
  color: rgba(255, 255, 255, 0.5) !important;
}

.category-dialog-overlay .el-dialog__body {
  padding: 20px !important;
}

.category-dialog-overlay .el-form-item__label {
  color: rgba(255, 255, 255, 0.8) !important;
}

.category-dialog-overlay .el-input__wrapper {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: none !important;
}

.category-dialog-overlay .el-input__inner {
  color: #fff !important;
}
</style>