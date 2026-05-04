<template>
  <div class="countdown-container">
    <!-- 顶部区域分类导航区 -->
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
            <el-dropdown
                trigger="click"
                @command="(cmd: string) => handleCategoryCommand(cmd, cat.value)"
                @click.stop
            >
              <el-button type="info" size="small" text :icon="MoreFilled" class="nav-more" @click.stop />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑分类</el-dropdown-item>
                  <el-dropdown-item command="add">添加倒数日</el-dropdown-item>
                  <el-dropdown-item v-if="!isDefaultCategory(cat.value)" command="delete" divided>删除分类</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="nav-item add-nav-item" :ref="setCategoryNavItemRef" @click="handleAddCategory">
            <el-icon><Plus /></el-icon>
            <span class="nav-name">添加分类</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <div class="content-wrapper">
      <template v-if="!isFormMode">
        <!-- 主内容 -->
        <div class="content-body">
          <el-scrollbar>
            <!-- 空状态 -->
            <el-empty
                v-if="milestones.length === 0"
                description="暂无倒数日，点击左侧分类添加你的第一个重要时刻"
                :image-size="120"
            />

            <!-- 筛选结果为空 -->
            <el-empty
                v-else-if="filteredMilestones.length === 0"
                description="该分类下暂无倒数日"
                :image-size="120"
            />

            <template v-else>
              <!-- 星标倒数日 -->
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
                      @click="!milestone.isSystem && handleEditMilestone(milestone)"
                  >
                    <div class="card-header" @click.stop>
                      <span class="category-badge">
                        {{ getCategoryIcon(milestone.category) }}
                      </span>
                      <el-dropdown v-if="!milestone.isSystem" trigger="click" @command="(cmd: string) => handleCommand(cmd, milestone)">
                        <el-button type="info" size="small" text :icon="MoreFilled" @click.stop />
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="edit">编辑</el-dropdown-item>
                            <el-dropdown-item command="unpin">取消星标</el-dropdown-item>
                            <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                      <span v-else class="system-badge">系统</span>
                    </div>

                    <h3 class="milestone-name">{{ milestone.name }}</h3>

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

              <!-- 即将到来 -->
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
                      @click="handleEditMilestone(milestone)"
                  >
                    <div class="card-header" @click.stop>
                      <span class="category-badge">
                        {{ getCategoryIcon(milestone.category) }}
                      </span>
                      <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, milestone)">
                        <el-button type="info" size="small" text :icon="MoreFilled" @click.stop />
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="edit">编辑</el-dropdown-item>
                            <el-dropdown-item command="pin">设为星标</el-dropdown-item>
                            <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>

                    <h3 class="milestone-name">{{ milestone.name }}</h3>

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

              <!-- 未来展望 -->
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
                      @click="handleEditMilestone(milestone)"
                  >
                    <div class="card-header" @click.stop>
                      <span class="category-badge">
                        {{ getCategoryIcon(milestone.category) }}
                      </span>
                      <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, milestone)">
                        <el-button type="info" size="small" text :icon="MoreFilled" @click.stop />
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="edit">编辑</el-dropdown-item>
                            <el-dropdown-item command="pin">设为星标</el-dropdown-item>
                            <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>

                    <h3 class="milestone-name">{{ milestone.name }}</h3>

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

              <!-- 时光印记 -->
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
                      @click="handleEditMilestone(milestone)"
                  >
                    <div class="card-header" @click.stop>
                      <span class="category-badge">
                        {{ getCategoryIcon(milestone.category) }}
                      </span>
                      <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, milestone)">
                        <el-button type="info" size="small" text :icon="MoreFilled" @click.stop />
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="edit">编辑</el-dropdown-item>
                            <el-dropdown-item command="pin">设为星标</el-dropdown-item>
                            <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>

                    <h3 class="milestone-name">{{ milestone.name }}</h3>

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
      </template>

      <template v-else>
        <!-- 添加/编辑倒数日界面 -->
        <div class="milestone-form-page">
          <div class="form-page-header">
            <h2 class="form-page-title">{{ editingMilestone ? '编辑倒数日' : '添加倒数日' }}</h2>
          </div>
          <div class="form-page-body">
            <el-scrollbar>
              <div class="form-container">
                <el-form :model="milestoneForm" :rules="milestoneRules" ref="milestoneFormRef" label-width="80px" class="milestone-form">
                  <el-form-item label="名称" prop="name">
                    <el-input v-model="milestoneForm.name" placeholder="这个倒数日叫什么？" maxlength="50" show-word-limit />
                  </el-form-item>

                  <el-form-item label="类型" prop="countMode">
                    <el-radio-group v-model="milestoneForm.countMode" class="count-mode-group">
                      <el-radio value="countdown">倒数日</el-radio>
                      <el-radio value="countup">正数日</el-radio>
                    </el-radio-group>
                    <p class="count-mode-hint">
                      倒数日：距离目标日期还有多久；正数日：从所选日期起已过去多少天。
                    </p>
                  </el-form-item>

                  <el-form-item :label="milestoneForm.countMode === 'countup' ? '起始日期' : '目标日期'" prop="targetDate">
                    <LunarDatePicker
                        v-model="milestoneForm.targetDate"
                        :placeholder="milestoneForm.countMode === 'countup' ? '选择起始日期' : '选择目标日期'"
                        full-width
                    />
                  </el-form-item>

                  <el-form-item label="分类" prop="category">
                    <el-select v-model="milestoneForm.category" placeholder="选择分类" style="width: 100%">
                      <el-option
                          v-for="cat in categories"
                          :key="cat.value"
                          :label="cat.label"
                          :value="cat.value"
                      >
                        <span class="category-option">
                          <span class="category-icon">{{ cat.icon }}</span>
                          <span class="category-label">{{ cat.label }}</span>
                        </span>
                      </el-option>
                    </el-select>
                  </el-form-item>

                  <el-form-item label="描述">
                    <el-input
                        v-model="milestoneForm.description"
                        type="textarea"
                        :rows="3"
                        placeholder="添加一些备注（可选）"
                        maxlength="200"
                        show-word-limit
                    />
                  </el-form-item>

                  <el-form-item label="提醒" v-if="milestoneForm.countMode !== 'countup'">
                    <div class="reminder-row">
                      <el-select v-model="milestoneForm.reminderStrategy" placeholder="选择提醒方式" style="width: 180px">
                        <el-option label="不提醒" value="none" />
                        <el-option label="准时提醒" value="on_time" />
                        <el-option label="提前提醒" value="advance" />
                      </el-select>
                      <template v-if="milestoneForm.reminderStrategy === 'advance'">
                        <span class="reminder-label">提前</span>
                        <el-input-number v-model="milestoneForm.reminderDays" :min="0" :max="365" controls-position="right" style="width: 80px" />
                        <span class="reminder-label">天</span>
                        <el-input-number v-model="milestoneForm.reminderHours" :min="0" :max="23" controls-position="right" style="width: 80px" />
                        <span class="reminder-label">小时</span>
                        <el-input-number v-model="milestoneForm.reminderMinutes" :min="milestoneForm.reminderDays === 0 && milestoneForm.reminderHours === 0 ? 1 : 0" :max="59" controls-position="right" style="width: 80px" />
                        <span class="reminder-label">分钟</span>
                      </template>
                    </div>
                  </el-form-item>

                  <div class="form-actions">
                    <el-button @click="isFormMode = false">取消</el-button>
                    <el-button type="primary" @click="handleMilestoneFormSubmit">
                      {{ editingMilestone ? '保存' : '添加' }}
                    </el-button>
                  </div>
                </el-form>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </template>
      </div>
    </div>

    <!-- 分类表单对话框 -->
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
import { ref, computed, onMounted, onActivated, onUnmounted, watch, nextTick, onBeforeUpdate } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Calendar, Clock, Timer, Star, MoreFilled, Sunny, Bell } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import LunarDatePicker from './LunarDatePicker.vue'
import { getData, setData, getSystemStateField, setSystemStateField } from '../services/storageService'
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
const BIRTHDAY_MILESTONE_ID = 'user-birthday'

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

const milestones = ref<Milestone[]>([])
const categories = ref<Category[]>([...DEFAULT_CATEGORIES])
const currentCategory = ref('')

const categoryNavRef = ref<HTMLElement>()
const categoryNavItemsRef = ref<HTMLElement[]>([])

const clearNavRefs = () => {
  categoryNavItemsRef.value = []
}

const setCategoryNavItemRef = (el: any) => {
  if (el) categoryNavItemsRef.value.push(el)
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

const currentCategoryTitle = computed(() => {
  if (!currentCategory.value) return '全部'
  const cat = categories.value.find(c => c.value === currentCategory.value)
  return cat?.label || '未知分类'
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

const getCategoryColor = (categoryValue: string): string => {
  if (!categoryValue) return '#6b7280'
  const cat = categories.value.find(c => c.value === categoryValue)
  return cat?.color || '#6b7280'
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

const sendCountdownNotification = (title: string, body: string) => {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') new Notification(title, { body })
    })
  }
}

const triggeredCountdownReminders = new Set<string>()

const checkCountdownReminders = () => {
  const now = dayjs()
  milestones.value.forEach(milestone => {
    if (milestone.reminderStrategy === 'none' || !milestone.reminderStrategy) return
    if (!milestone.targetDate) return

    let triggerTime = dayjs(milestone.targetDate + 'T00:00:00')
    if (milestone.reminderStrategy === 'advance') {
      const offsetMinutes = (milestone.reminderDays || 0) * 1440 + (milestone.reminderHours || 0) * 60 + (milestone.reminderMinutes || 0)
      triggerTime = triggerTime.subtract(offsetMinutes, 'minute')
    }

    const reminderKey = milestone.id + '_' + milestone.targetDate
    const diffMs = now.diff(triggerTime, 'millisecond')
    if (diffMs >= 0 && diffMs < 3600000 && !triggeredCountdownReminders.has(reminderKey)) {
      triggeredCountdownReminders.add(reminderKey)
      sendCountdownNotification('倒数日提醒', `「${milestone.name}」即将到达`)
      setTimeout(() => triggeredCountdownReminders.delete(reminderKey), 3600000)
    }
  })
}

let countdownReminderInterval: ReturnType<typeof setInterval> | null = null

const startCountdownReminderChecker = () => {
  if (countdownReminderInterval) clearInterval(countdownReminderInterval)
  countdownReminderInterval = setInterval(checkCountdownReminders, 30000)
  checkCountdownReminders()
}

const stopCountdownReminderChecker = () => {
  if (countdownReminderInterval) { clearInterval(countdownReminderInterval); countdownReminderInterval = null }
}

const loadData = async () => {
  try {
    const savedCategories = await getData<Category[]>(CATEGORY_KEY[0], CATEGORY_KEY[1])
    if (savedCategories && savedCategories.length > 0) {
      categories.value = savedCategories
    }

    const saved = await getData<Milestone[]>(STORAGE_KEY[0], STORAGE_KEY[1])
    if (saved) {
      milestones.value = saved.map((m: Milestone) => ({
        id: m.id || Date.now().toString() + Math.random(),
        name: m.name || '未命名里程碑',
        targetDate: m.targetDate || dayjs().format('YYYY-MM-DD'),
        category: m.category || 'life',
        description: m.description || '',
        countMode: m.countMode === 'countup' ? 'countup' : 'countdown',
        pinned: m.pinned === true,
        isSystem: m.isSystem || false,
        createdAt: m.createdAt || new Date().toISOString(),
        updatedAt: m.updatedAt || new Date().toISOString(),
        reminderStrategy: m.reminderStrategy || 'none',
        reminderDays: m.reminderDays || 0,
        reminderHours: m.reminderHours || 0,
        reminderMinutes: m.reminderMinutes || 0
      }))
      logger.info('[倒数日] 加载数据', { count: milestones.value.length, withReminder: milestones.value.filter(m => m.reminderStrategy !== 'none').length })
    }

    const authStore = await import('../stores/authStore').then(m => m.useAuthStore())
    const userAny = authStore.user as { createdAt?: string; created_at?: string } | null | undefined
    const startDate =
        authStore.profile?.created_at ||
        userAny?.createdAt ||
        userAny?.created_at ||
        new Date().toISOString()
    const registrationDay = dayjs(startDate).format('YYYY-MM-DD')

    const systemMilestoneIndex = milestones.value.findIndex(m => m.id === SYSTEM_MILESTONE_ID)
    if (systemMilestoneIndex === -1) {
      milestones.value.unshift({
        id: SYSTEM_MILESTONE_ID,
        name: '已使用地球 Online 生存日记',
        targetDate: registrationDay,
        category: 'anniversary',
        description: '记录你在这个宇宙中的旅程',
        pinned: true,
        isSystem: true,
        createdAt: startDate,
        updatedAt: new Date().toISOString()
      })
      await saveData()
    } else {
      const existingMilestone = milestones.value[systemMilestoneIndex]
      const needUpdate =
          existingMilestone.targetDate !== registrationDay ||
          existingMilestone.category !== 'anniversary'
      if (needUpdate) {
        milestones.value[systemMilestoneIndex] = {
          ...existingMilestone,
          targetDate: registrationDay,
          category: 'anniversary',
          updatedAt: new Date().toISOString()
        }
        await saveData()
      }
    }

    const birthday = (authStore.profile as any)?.birthday

    const birthdayMilestoneIndex = milestones.value.findIndex(m => m.id === BIRTHDAY_MILESTONE_ID)
    if (birthday && birthdayMilestoneIndex === -1) {
      const [, month, day] = birthday.split('-').map(Number)
      const birthdayDate = `${new Date().getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      milestones.value.push({
        id: BIRTHDAY_MILESTONE_ID,
        name: '我的生日',
        targetDate: birthdayDate,
        category: 'birthday',
        description: '',
        pinned: true,
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminderStrategy: 'advance',
        reminderDays: 1,
        reminderHours: 0,
        reminderMinutes: 0
      })
      await saveData()
    } else if (!birthday && birthdayMilestoneIndex > -1) {
      milestones.value.splice(birthdayMilestoneIndex, 1)
      await saveData()
    } else if (birthday && birthdayMilestoneIndex > -1) {
      const [, month, day] = birthday.split('-').map(Number)
      const birthdayDate = `${new Date().getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const existingMilestone = milestones.value[birthdayMilestoneIndex]
      if (existingMilestone.targetDate !== birthdayDate || !existingMilestone.reminderStrategy) {
        milestones.value[birthdayMilestoneIndex] = {
          ...existingMilestone,
          targetDate: birthdayDate,
          reminderStrategy: existingMilestone.reminderStrategy || 'advance',
          reminderDays: existingMilestone.reminderDays || 1,
          reminderHours: existingMilestone.reminderHours || 0,
          reminderMinutes: existingMilestone.reminderMinutes || 0,
          updatedAt: new Date().toISOString()
        }
        await saveData()
      }
    }
  } catch (e) {
    console.error('Failed to load data:', e)
    milestones.value = []
  }
}

const selectCategory = (category: string) => {
  logger.info('[倒数日] 切换分类', { category: category || '全部' })
  currentCategory.value = category
  if (isFormMode.value) {
    isFormMode.value = false
  }
}

const isFormMode = ref(false)
const editingMilestone = ref<Milestone | null>(null)
const milestoneFormRef = ref()
const milestoneForm = ref({
  name: '',
  targetDate: dayjs().format('YYYY-MM-DD'),
  category: 'life',
  description: '',
  countMode: 'countdown' as 'countdown' | 'countup',
  reminderStrategy: 'none' as string,
  reminderDays: 0,
  reminderHours: 0,
  reminderMinutes: 0
})

const milestoneRules = {
  name: [
    { required: true, message: '请输入倒数日名称', trigger: 'blur' },
    { min: 1, max: 50, message: '名称长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  targetDate: [
    { required: true, message: '请选择目标日期', trigger: 'change' }
  ],
  category: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ]
}

const openFormMode = () => {
  isFormMode.value = true
}

const handleAddMilestone = () => {
  editingMilestone.value = null
  milestoneForm.value = {
    name: '',
    targetDate: dayjs().format('YYYY-MM-DD'),
    category: currentCategory.value || 'life',
    description: '',
    countMode: 'countdown',
    reminderStrategy: 'none',
    reminderDays: 0,
    reminderHours: 0,
    reminderMinutes: 0
  }
  openFormMode()
}

const handleEditMilestone = (milestone: Milestone) => {
  editingMilestone.value = { ...milestone }
  milestoneForm.value = {
    name: milestone.name,
    targetDate: milestone.targetDate,
    category: milestone.category,
    description: milestone.description,
    countMode: milestone.countMode === 'countup' ? 'countup' : 'countdown',
    reminderStrategy: milestone.reminderStrategy || 'none',
    reminderDays: milestone.reminderDays || 0,
    reminderHours: milestone.reminderHours || 0,
    reminderMinutes: milestone.reminderMinutes || 0
  }
  openFormMode()
}

const handleMilestoneFormSubmit = async () => {
  if (!milestoneFormRef.value) return
  await milestoneFormRef.value.validate((valid: boolean) => {
    if (!valid) return
    if (editingMilestone.value) {
      const index = milestones.value.findIndex(m => m.id === editingMilestone.value!.id)
      if (index > -1) {
        milestones.value[index] = {
          ...milestones.value[index],
          ...milestoneForm.value,
          updatedAt: new Date().toISOString()
        }
        logger.info('[倒数日] 编辑倒数日', { id: editingMilestone.value.id, name: milestoneForm.value.name, reminder: milestoneForm.value.reminderStrategy === 'advance' ? `提前${milestoneForm.value.reminderDays}天${milestoneForm.value.reminderHours}小时${milestoneForm.value.reminderMinutes}分钟` : milestoneForm.value.reminderStrategy })
        ElMessage.success('更新成功')
      }
    } else {
      const newMilestone: Milestone = {
        id: Date.now().toString(),
        name: milestoneForm.value.name,
        targetDate: milestoneForm.value.targetDate,
        category: milestoneForm.value.category || 'life',
        description: milestoneForm.value.description,
        countMode: milestoneForm.value.countMode === 'countup' ? 'countup' : 'countdown',
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminderStrategy: milestoneForm.value.reminderStrategy,
        reminderDays: milestoneForm.value.reminderDays,
        reminderHours: milestoneForm.value.reminderHours,
        reminderMinutes: milestoneForm.value.reminderMinutes
      }
      milestones.value.push(newMilestone)
      logger.info('[倒数日] 添加倒数日', { name: milestoneForm.value.name, reminder: milestoneForm.value.reminderStrategy === 'advance' ? `提前${milestoneForm.value.reminderDays}天${milestoneForm.value.reminderHours}小时${milestoneForm.value.reminderMinutes}分钟` : milestoneForm.value.reminderStrategy })
      ElMessage.success('添加成功')
    }
    saveData()
    isFormMode.value = false
  })
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
          milestones.value.splice(deleteIndex, 1)
          saveData()
          logger.info('[倒数日] 删除倒数日', { id: milestone.id, name: milestone.name })
          ElMessage.success('删除成功')
        }
      }).catch(() => {})
      break
  }
}

const handleAddCategory = () => {
  editingCategory.value = null
  categoryForm.value = {
    label: '',
    icon: '📌'
  }
  categoryFormVisible.value = true
}

const handleCategoryCommand = (command: string, categoryValue: string) => {
  if (command === 'edit') {
    const cat = categories.value.find(c => c.value === categoryValue)
    if (cat) {
      editingCategory.value = categoryValue
      categoryForm.value = {
        label: cat.label,
        icon: cat.icon
      }
      categoryFormVisible.value = true
    }
  } else if (command === 'add') {
    editingMilestone.value = null
    milestoneForm.value = {
      name: '',
      targetDate: dayjs().format('YYYY-MM-DD'),
      category: categoryValue,
      description: '',
      countMode: 'countdown'
    }
    isFormMode.value = true
  } else if (command === 'delete') {
    const count = milestones.value.filter(m => m.category === categoryValue).length
    if (count > 0) {
      ElMessage.warning(`该分类下有 ${count} 个倒数日，请先删除或移动这些倒数日`)
      return
    }
    ElMessageBox.confirm('确定要删除这个分类吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      const index = categories.value.findIndex(c => c.value === categoryValue)
      if (index > -1) {
        categories.value.splice(index, 1)
        saveCategories()
        logger.info('[倒数日] 删除分类', { value: categoryValue })
        ElMessage.success('删除成功')
        if (currentCategory.value === categoryValue) {
          currentCategory.value = ''
        }
      }
    }).catch(() => {})
  }
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

onMounted(async () => {
  await loadData()
  await initFilterState()
  nextTick(() => {
    initCategoryNavDrag()
    scrollCategoryNavToActive()
  })
  startCountdownReminderChecker()
})

onBeforeUpdate(() => clearNavRefs())

onUnmounted(() => {
  stopCountdownReminderChecker()
})

onActivated(async () => {
  await loadData()
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.category-nav-scroll-wrapper {
  height: 56px;
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
  padding: 8px 16px;
  white-space: nowrap;
  width: max-content;
  min-width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  position: relative;
  height: 40px;
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
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.nav-name {
  font-size: 14px;
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

.nav-more {
  opacity: 0;
  transition: opacity 0.2s;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-item:hover .nav-more {
  opacity: 1;
}

.add-nav-item {
  color: rgba(255, 255, 255, 0.5);
}

.add-nav-item:hover {
  color: rgba(255, 255, 255, 0.8);
}

.add-nav-item .nav-name {
  color: rgba(255, 255, 255, 0.5);
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
  cursor: pointer;
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
  cursor: default;
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

.milestone-form-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.form-page-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  text-align: center;
}

.form-page-title {
  margin: 0;
  font-size: 18px;
  color: #fff;
  font-weight: 600;
}

.form-page-body {
  flex: 1;
  overflow: hidden;
}

.form-container {
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
}

.milestone-form :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.milestone-form :deep(.el-input__inner) {
  color: #fff;
}

.milestone-form :deep(.el-textarea__inner) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
  color: #fff;
}

.count-mode-group {
  width: 100%;
}

.count-mode-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.45);
}

.reminder-row { display: flex; align-items: center; gap: 8px; width: 100%; flex-wrap: wrap; }
.reminder-row .reminder-label { color: rgba(255,255,255,0.6); white-space: nowrap; font-size: 13px; }

.category-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-icon {
  font-size: 16px;
}

.category-label {
  flex: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 24px;
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
