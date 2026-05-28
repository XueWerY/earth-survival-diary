<template>
  <div class="countdown-container">
    <div v-if="showBreadcrumb" class="countdown-breadcrumb-bar">
      <button class="breadcrumb-module" @click="pageNav.setNavPath(['countdown'])" title="回到倒数日首页">⏳</button>
      <div class="breadcrumb-scroll">
        <template v-for="(seg, idx) in localBreadcrumbSegments" :key="idx">
          <span v-if="seg.dropdownItems" class="breadcrumb-sep clickable" @click.stop="openSegmentDropdown(seg, $event)">></span>
          <span v-else class="breadcrumb-sep">></span>
          <span
            class="breadcrumb-segment"
            :class="{ clickable: seg.clickable }"
            :style="{ color: seg.color }"
            @click="seg.clickable && seg.onClick && seg.onClick()"
          >{{ seg.label }}</span>
        </template>
      </div>
      <button v-if="plusAction" class="breadcrumb-plus-btn" @click="plusAction" title="添加"><el-icon><Plus /></el-icon></button>
    </div>

    <div v-if="activeDropdown === 'segment'" class="page-dropdown" :style="dropdownPosStyle" @click.stop>
      <div v-for="item in segmentDropdownItems" :key="item.id" class="page-dropdown-item" :class="{ current: item.current }" @click="handleSegmentDropdownSelect(item)">
        <span class="page-dropdown-dot" :style="{ background: item.color }"></span>
        <span>{{ item.name }}</span>
      </div>
    </div>

    <div class="main-content" @click="closeDropdown">
      <div class="content-wrapper">
        <div class="content-body">
          <el-scrollbar>
            <div v-if="isCountdownHome" class="category-cards" :class="isElectron ? 'cols-3' : 'cols-1'">
              <div class="folder-card has-actions" @click="pageNav.setNavPath(['countdown', ALL_CATEGORY_VALUE])">
                <div class="folder-card-icon" style="background: #667eea">📋</div>
                <span class="folder-card-name">全部</span>
                <span class="folder-card-count">{{ milestones.length }}个倒数日</span>
              </div>
              <div v-for="cat in categories" :key="cat.value" class="folder-card has-actions" @click="pageNav.setNavPath(['countdown', cat.value])">
                <div class="card-top-actions" @click.stop>
                  <button v-if="cat.isCustom" class="card-icon-btn" title="编辑分类" @click="editCategoryFromCard(cat)"><el-icon><Edit /></el-icon></button>
                  <button v-if="cat.isCustom" class="card-icon-btn danger" title="删除分类" @click="deleteCategoryFromCard(cat)"><el-icon><Delete /></el-icon></button>
                  <button class="card-icon-btn" title="左移" @click="moveCategoryCard(cat, 'left')">⬅</button>
                  <button class="card-icon-btn" title="右移" @click="moveCategoryCard(cat, 'right')">➡</button>
                </div>
                <div class="folder-card-icon" :style="{ background: cat.color }">{{ cat.icon }}</div>
                <span class="folder-card-name">{{ cat.label }}</span>
                <span class="folder-card-count">{{ getCategoryCount(cat.value) }}个倒数日</span>
              </div>
            </div>

            <template v-else-if="isCategoryView">
              <el-empty
                  v-if="filteredMilestones.length === 0"
                  :description="isAllView ? '暂无倒数日' : '该分类下暂无倒数日'"
                  :image-size="120"
              />

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
                  >
                    <div class="card-header">
                      <span class="category-badge">
                        {{ getCategoryIcon(milestone.category) }}
                      </span>
                      <div class="card-actions">
                        <el-button type="warning" size="small" text :icon="Star" class="card-btn card-btn-unpin" @click.stop="handleCommand('unpin', milestone)" title="取消星标" />
                        <el-button type="danger" size="small" text :icon="Delete" class="card-btn" @click.stop="handleCommand('delete', milestone)" title="删除" />
                      </div>
                    </div>
                    <template v-if="editingNameId === milestone.id">
                      <textarea
                        v-model="editingNameValue"
                        class="inline-edit-textarea"
                        @blur="saveNameEdit(milestone)"
                        @keydown.escape.prevent="cancelNameEdit"
                        @keydown.enter.prevent="saveNameEdit(milestone)"
                        rows="2"
                        autofocus
                      />
                    </template>
                    <h3 v-else class="milestone-name" @dblclick="startNameEdit(milestone)">{{ milestone.name }}</h3>
                    <div class="milestone-date">
                      <span class="date-plain-text" @click.stop="openDatePicker(milestone)">
                      <el-icon><Calendar /></el-icon>
                      {{ formatDate(milestone.targetDate) }}
                    </span>
                    </div>
                    <div class="milestone-meta">
                      <template v-if="milestone.countMode !== 'countup'">
                        <span class="meta-item repeat-text" @click.stop="toggleRepeat(milestone)">
                          {{ milestone.repeatStrategy === 'yearly' ? '每年重复' : '不重复' }}
                        </span>
                        <span class="meta-separator">·</span>
                        <template v-if="getReminderLabel(milestone)">
                          <span class="meta-item reminder-has" @click.stop="openReminderPicker(milestone)">
                            {{ getReminderLabel(milestone) }}
                          </span>
                        </template>
                        <template v-else>
                          <span class="meta-item reminder-none" @click.stop="openReminderPicker(milestone)">不提醒</span>
                        </template>
                      </template>
                    </div>
                    <div class="countdown-display" :class="getCountdownClass(milestone)">
                      <span class="countdown-number">{{ getCountdownDays(milestone) }}</span>
                      <span class="countdown-unit">{{ getCountdownUnit(milestone) }}</span>
                    </div>
                    <template v-if="editingDescId === milestone.id">
                      <textarea
                        v-model="editingDescValue"
                        class="inline-edit-textarea desc-textarea"
                        @blur="saveDescEdit(milestone)"
                        @keydown.escape.prevent="cancelDescEdit"
                        rows="2"
                        placeholder="添加描述"
                        autofocus
                      />
                    </template>
                    <template v-else>
                      <p v-if="milestone.description" class="milestone-desc" @dblclick="startDescEdit(milestone)">{{ milestone.description }}</p>
                      <p v-else class="milestone-desc desc-placeholder" @dblclick="startDescEdit(milestone)">双击添加描述</p>
                    </template>
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
                      <span class="category-badge">{{ getCategoryIcon(milestone.category) }}</span>
                      <div class="card-actions">
                        <el-button type="warning" size="small" text :icon="Star" class="card-btn" @click.stop="handleCommand('pin', milestone)" title="设为星标" />
                        <el-button type="danger" size="small" text :icon="Delete" class="card-btn" @click.stop="handleCommand('delete', milestone)" title="删除" />
                      </div>
                    </div>
                    <template v-if="editingNameId === milestone.id">
                      <textarea
                        v-model="editingNameValue"
                        class="inline-edit-textarea"
                        @blur="saveNameEdit(milestone)"
                        @keydown.escape.prevent="cancelNameEdit"
                        @keydown.enter.prevent="saveNameEdit(milestone)"
                        rows="2"
                        autofocus
                      />
                    </template>
                    <h3 v-else class="milestone-name" @dblclick="startNameEdit(milestone)">{{ milestone.name }}</h3>
                    <div class="milestone-date">
                      <span class="date-plain-text" @click.stop="openDatePicker(milestone)">
                      <el-icon><Calendar /></el-icon>
                      {{ formatDate(milestone.targetDate) }}
                    </span>
                    </div>
                    <div class="milestone-meta">
                      <template v-if="milestone.countMode !== 'countup'">
                        <span class="meta-item repeat-text" @click.stop="toggleRepeat(milestone)">
                          {{ milestone.repeatStrategy === 'yearly' ? '每年重复' : '不重复' }}
                        </span>
                        <span class="meta-separator">·</span>
                        <template v-if="getReminderLabel(milestone)">
                          <span class="meta-item reminder-has" @click.stop="openReminderPicker(milestone)">
                            {{ getReminderLabel(milestone) }}
                          </span>
                        </template>
                        <template v-else>
                          <span class="meta-item reminder-none" @click.stop="openReminderPicker(milestone)">不提醒</span>
                        </template>
                      </template>
                    </div>
                    <div class="countdown-display" :class="getCountdownClass(milestone)">
                      <span class="countdown-number">{{ getCountdownDays(milestone) }}</span>
                      <span class="countdown-unit">{{ getCountdownUnit(milestone) }}</span>
                    </div>
                    <template v-if="editingDescId === milestone.id">
                      <textarea
                        v-model="editingDescValue"
                        class="inline-edit-textarea desc-textarea"
                        @blur="saveDescEdit(milestone)"
                        @keydown.escape.prevent="cancelDescEdit"
                        rows="2"
                        placeholder="添加描述"
                        autofocus
                      />
                    </template>
                    <template v-else>
                      <p v-if="milestone.description" class="milestone-desc" @dblclick="startDescEdit(milestone)">{{ milestone.description }}</p>
                      <p v-else class="milestone-desc desc-placeholder" @dblclick="startDescEdit(milestone)">双击添加描述</p>
                    </template>
                  </div>
                </div>
              </div>

              <div v-if="futureMilestones.length > 0" class="section future-section">
                <div class="section-title">
                  <el-icon><Sunny /></el-icon>
                  <span>未来展望</span>
                </div>
                <div class="milestone-grid">
                  <div v-for="milestone in futureMilestones" :key="milestone.id" class="milestone-card">
                    <div class="card-header">
                      <span class="category-badge">{{ getCategoryIcon(milestone.category) }}</span>
                      <div class="card-actions">
                        <el-button type="warning" size="small" text :icon="Star" class="card-btn" @click.stop="handleCommand('pin', milestone)" title="设为星标" />
                        <el-button type="danger" size="small" text :icon="Delete" class="card-btn" @click.stop="handleCommand('delete', milestone)" title="删除" />
                      </div>
                    </div>
                    <template v-if="editingNameId === milestone.id">
                      <textarea
                        v-model="editingNameValue"
                        class="inline-edit-textarea"
                        @blur="saveNameEdit(milestone)"
                        @keydown.escape.prevent="cancelNameEdit"
                        @keydown.enter.prevent="saveNameEdit(milestone)"
                        rows="2"
                        autofocus
                      />
                    </template>
                    <h3 v-else class="milestone-name" @dblclick="startNameEdit(milestone)">{{ milestone.name }}</h3>
                    <div class="milestone-date">
                      <span class="date-plain-text" @click.stop="openDatePicker(milestone)">
                      <el-icon><Calendar /></el-icon>
                      {{ formatDate(milestone.targetDate) }}
                    </span>
                    </div>
                    <div class="milestone-meta">
                      <template v-if="milestone.countMode !== 'countup'">
                        <span class="meta-item repeat-text" @click.stop="toggleRepeat(milestone)">
                          {{ milestone.repeatStrategy === 'yearly' ? '每年重复' : '不重复' }}
                        </span>
                        <span class="meta-separator">·</span>
                        <template v-if="getReminderLabel(milestone)">
                          <span class="meta-item reminder-has" @click.stop="openReminderPicker(milestone)">
                            {{ getReminderLabel(milestone) }}
                          </span>
                        </template>
                        <template v-else>
                          <span class="meta-item reminder-none" @click.stop="openReminderPicker(milestone)">不提醒</span>
                        </template>
                      </template>
                    </div>
                    <div class="countdown-display" :class="getCountdownClass(milestone)">
                      <span class="countdown-number">{{ getCountdownDays(milestone) }}</span>
                      <span class="countdown-unit">{{ getCountdownUnit(milestone) }}</span>
                    </div>
                    <template v-if="editingDescId === milestone.id">
                      <textarea
                        v-model="editingDescValue"
                        class="inline-edit-textarea desc-textarea"
                        @blur="saveDescEdit(milestone)"
                        @keydown.escape.prevent="cancelDescEdit"
                        rows="2"
                        placeholder="添加描述"
                        autofocus
                      />
                    </template>
                    <template v-else>
                      <p v-if="milestone.description" class="milestone-desc" @dblclick="startDescEdit(milestone)">{{ milestone.description }}</p>
                      <p v-else class="milestone-desc desc-placeholder" @dblclick="startDescEdit(milestone)">双击添加描述</p>
                    </template>
                  </div>
                </div>
              </div>

              <div v-if="passedMilestones.length > 0" class="section passed-section">
                <div class="section-title">
                  <el-icon><Timer /></el-icon>
                  <span>时光印记</span>
                </div>
                <div class="milestone-grid passed">
                  <div v-for="milestone in passedMilestones" :key="milestone.id" class="milestone-card passed">
                    <div class="card-header">
                      <span class="category-badge">{{ getCategoryIcon(milestone.category) }}</span>
                      <div class="card-actions">
                        <el-button type="warning" size="small" text :icon="Star" class="card-btn" @click.stop="handleCommand('pin', milestone)" title="设为星标" />
                        <el-button type="danger" size="small" text :icon="Delete" class="card-btn" @click.stop="handleCommand('delete', milestone)" title="删除" />
                      </div>
                    </div>
                    <template v-if="editingNameId === milestone.id">
                      <textarea
                        v-model="editingNameValue"
                        class="inline-edit-textarea"
                        @blur="saveNameEdit(milestone)"
                        @keydown.escape.prevent="cancelNameEdit"
                        @keydown.enter.prevent="saveNameEdit(milestone)"
                        rows="2"
                        autofocus
                      />
                    </template>
                    <h3 v-else class="milestone-name" @dblclick="startNameEdit(milestone)">{{ milestone.name }}</h3>
                    <div class="milestone-date">
                      <span class="date-plain-text" @click.stop="openDatePicker(milestone)">
                      <el-icon><Calendar /></el-icon>
                      {{ formatDate(milestone.targetDate) }}
                    </span>
                    </div>
                    <div class="milestone-meta">
                      <template v-if="milestone.countMode !== 'countup'">
                        <span class="meta-item repeat-text" @click.stop="toggleRepeat(milestone)">
                          {{ milestone.repeatStrategy === 'yearly' ? '每年重复' : '不重复' }}
                        </span>
                        <span class="meta-separator">·</span>
                        <template v-if="getReminderLabel(milestone)">
                          <span class="meta-item reminder-has" @click.stop="openReminderPicker(milestone)">
                            {{ getReminderLabel(milestone) }}
                          </span>
                        </template>
                        <template v-else>
                          <span class="meta-item reminder-none" @click.stop="openReminderPicker(milestone)">不提醒</span>
                        </template>
                      </template>
                    </div>
                    <div class="countdown-display" :class="getCountdownClass(milestone)">
                      <span class="countdown-number">{{ getCountdownDays(milestone) }}</span>
                      <span class="countdown-unit">{{ getCountdownUnit(milestone) }}</span>
                    </div>
                    <template v-if="editingDescId === milestone.id">
                      <textarea
                        v-model="editingDescValue"
                        class="inline-edit-textarea desc-textarea"
                        @blur="saveDescEdit(milestone)"
                        @keydown.escape.prevent="cancelDescEdit"
                        rows="2"
                        placeholder="添加描述"
                        autofocus
                      />
                    </template>
                    <template v-else>
                      <p v-if="milestone.description" class="milestone-desc" @dblclick="startDescEdit(milestone)">{{ milestone.description }}</p>
                      <p v-else class="milestone-desc desc-placeholder" @dblclick="startDescEdit(milestone)">双击添加描述</p>
                    </template>
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
        :default-category="currentCategoryFromPath !== ALL_CATEGORY_VALUE ? currentCategoryFromPath : 'life'"
        @submit="handleCountdownFormSubmit"
    />

    <Teleport to="body">
      <div v-if="reminderPickerVisible" class="dialog-overlay" @click.self="cancelReminderPicker">
        <div class="dialog-container reminder-picker-dialog">
          <div class="dialog-header folder-dialog-header">
            <span class="dialog-header-title folder-dialog-title">设置提醒</span>
          </div>
          <div class="dialog-body">
            <ReminderTimePicker v-model="reminderPickerValue" />
            <div class="form-footer">
              <button class="capsule-btn cancel-btn" @click="cancelReminderPicker">
                <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                <span>取消</span>
              </button>
              <button class="capsule-btn submit-btn" @click="saveReminderPicker">
                <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
                <span>保存</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <DateScrollPicker
      v-if="datePickerMilestoneId"
      v-model="datePickerTargetDate"
      v-model:visible="datePickerVisible"
      @update:model-value="onDatePickerConfirm"
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
import { ref, computed, onMounted, watch, inject, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Calendar, Clock, Timer, Star, Sunny, Delete, Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import CountdownForm from './CountdownForm.vue'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'
import ReminderTimePicker from '../common/picker/ReminderTimePicker.vue'
import { setData } from '../../services/storageService'
import { logger } from '../../lib/logger'
import { usePageNav, restoreModuleNavPath, type BreadcrumbSegment, type DropdownItem } from '../../composables/usePageNav'

const pageNav = usePageNav()

const isElectron = inject<boolean>('isElectron', false)

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
  repeatStrategy?: string
}

interface Category {
  value: string
  label: string
  icon: string
  color: string
  isCustom?: boolean
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

const navPath = computed(() => pageNav.navPath.value)

const ALL_CATEGORY_VALUE = 'all'

const isCountdownHome = computed(() => navPath.value.length === 1 && navPath.value[0] === 'countdown')
const isCategoryView = computed(() => navPath.value.length === 2 && navPath.value[0] === 'countdown')
const isAllView = computed(() => navPath.value.length === 2 && navPath.value[0] === 'countdown' && navPath.value[1] === ALL_CATEGORY_VALUE)

const currentCategoryFromPath = computed(() => {
  if (isCategoryView.value) return navPath.value[1]
  return ''
})

const categoryLabel = computed(() => {
  if (!isCategoryView.value) return ''
  if (isAllView.value) return '全部'
  const cat = categories.value.find(c => c.value === currentCategoryFromPath.value)
  return cat?.label || currentCategoryFromPath.value
})

const categoryLabelColor = computed(() => {
  if (!isCategoryView.value) return ''
  if (isAllView.value) return '#667eea'
  const cat = categories.value.find(c => c.value === currentCategoryFromPath.value)
  return cat?.color || '#667eea'
})

const milestones = inject<Ref<Milestone[]>>('countdownMilestones', ref<Milestone[]>([]))
const categories = inject<Ref<Category[]>>('countdownCategories', ref<Category[]>([...DEFAULT_CATEGORIES]))

const computeBreadcrumbSegments = () => {
  const segments: BreadcrumbSegment[] = []
  const module = navPath.value[0]
  if (!module || module !== 'countdown') return segments

  if (isCountdownHome.value) return segments

  if (isCategoryView.value) {
    const catValue = navPath.value[1]
    const allDropdownItems: DropdownItem[] = [
      {
        id: ALL_CATEGORY_VALUE,
        name: '全部',
        color: '#667eea',
        current: catValue === ALL_CATEGORY_VALUE,
        onSelect: () => pageNav.setNavPath(['countdown', ALL_CATEGORY_VALUE])
      },
      ...categories.value.map(c => ({
        id: c.value,
        name: c.label,
        color: c.color,
        current: catValue === c.value,
        onSelect: () => pageNav.setNavPath(['countdown', c.value])
      }))
    ]
    if (isAllView.value) {
      segments.push({
        label: '全部',
        color: '#667eea',
        clickable: false,
        onClick: null,
        dropdownItems: allDropdownItems
      })
    } else {
      const cat = categories.value.find(c => c.value === catValue)
      segments.push({
        label: cat?.label || catValue,
        color: cat?.color || '#667eea',
        clickable: false,
        onClick: null,
        dropdownItems: allDropdownItems
      })
    }
  }

  return segments
}

const localBreadcrumbSegments = ref<BreadcrumbSegment[]>([])

const showBreadcrumb = computed(() => {
  const mod = navPath.value[0]
  return mod === 'countdown' && !isCountdownHome.value
})

const plusAction = computed(() => {
  if (isCountdownHome.value) return handleAddCategory
  if (isCategoryView.value) return handleAddMilestone
  return null
})

const activeDropdown = ref<string | null>(null)
const dropdownPos = ref({ top: 0, left: 0 })

const dropdownPosStyle = computed(() => ({
  top: dropdownPos.value.top + 'px',
  left: dropdownPos.value.left + 'px'
}))

const activeSegment = ref<BreadcrumbSegment | null>(null)

const segmentDropdownItems = computed<DropdownItem[]>(() => {
  if (activeDropdown.value !== 'segment' || !activeSegment.value) return []
  return activeSegment.value.dropdownItems || []
})

const openSegmentDropdown = (seg: BreadcrumbSegment, event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  dropdownPos.value = { top: rect.bottom + 4, left: rect.left - 8 }
  activeDropdown.value = 'segment'
  activeSegment.value = seg
}

const handleSegmentDropdownSelect = (item: DropdownItem) => {
  activeDropdown.value = null
  activeSegment.value = null
  item.onSelect()
}

const closeDropdown = () => {
  activeDropdown.value = null
  activeSegment.value = null
}

watch(
  [navPath, categories],
  () => {
    localBreadcrumbSegments.value = computeBreadcrumbSegments()
    closeDropdown()
  },
  { immediate: true, deep: true }
)

const isDefaultCategory = (value: string): boolean => {
  return DEFAULT_CATEGORIES.some(c => c.value === value)
}

const initFilterState = async () => {
  logger.debug('[CountdownList] initFilterState 开始', { navPath: pageNav.navPath.value })
  const restored = await restoreModuleNavPath('countdown')
  logger.debug('[CountdownList] initFilterState 恢复的路径', { restored, currentNavPath: pageNav.navPath.value })
  if (restored.length === 1 && restored[0] === 'countdown') {
    pageNav.setNavPath(['countdown', ALL_CATEGORY_VALUE])
  } else {
    pageNav.setNavPath(restored)
  }
  logger.debug('[CountdownList] initFilterState 完成', { navPath: pageNav.navPath.value })
}

const filteredMilestones = computed(() => {
  let result = [...milestones.value]

  if (currentCategoryFromPath.value && currentCategoryFromPath.value !== ALL_CATEGORY_VALUE) {
    result = result.filter(m => m.category === currentCategoryFromPath.value)
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
  const days = getDaysDiff(milestone)
  if (milestone.countMode === 'countup') {
    if (days > 0) return days
    if (days < 0) return Math.abs(days)
    return 0
  }
  return Math.abs(days)
}

const getCountdownUnit = (milestone: Milestone): string => {
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
  logger.info('[倒数日] 切换分类', { category: category || '所有' })
  if (category) {
    pageNav.setNavPath(['countdown', category])
  } else {
    pageNav.setNavPath(['countdown'])
  }
}

const countdownFormVisible = ref(false)
const editingMilestoneForForm = ref<Milestone | null>(null)

const editingNameId = ref<string | null>(null)
const editingNameValue = ref('')
const editingDescId = ref<string | null>(null)
const editingDescValue = ref('')
const datePickerVisible = ref(false)
const datePickerMilestoneId = ref<string | null>(null)
const datePickerTargetDate = ref('')
const reminderPickerVisible = ref(false)
const reminderPickerMilestoneId = ref<string | null>(null)
const reminderPickerValue = ref({ days: 0, hours: 0, minutes: 0 })

const startNameEdit = (milestone: Milestone) => {
  editingNameId.value = milestone.id
  editingNameValue.value = milestone.name
}

const saveNameEdit = async (milestone: Milestone) => {
  const trimmed = editingNameValue.value.trim()
  if (trimmed && trimmed !== milestone.name) {
    const index = milestones.value.findIndex(m => m.id === milestone.id)
    if (index > -1) {
      milestones.value[index].name = trimmed
      milestones.value[index].updatedAt = new Date().toISOString()
      saveData()
    }
  }
  editingNameId.value = null
}

const cancelNameEdit = () => {
  editingNameId.value = null
}

const startDescEdit = (milestone: Milestone) => {
  editingDescId.value = milestone.id
  editingDescValue.value = milestone.description || ''
}

const saveDescEdit = async (milestone: Milestone) => {
  const trimmed = editingDescValue.value.trim()
  if (trimmed !== (milestone.description || '')) {
    const index = milestones.value.findIndex(m => m.id === milestone.id)
    if (index > -1) {
      milestones.value[index].description = trimmed || ''
      milestones.value[index].updatedAt = new Date().toISOString()
      saveData()
    }
  }
  editingDescId.value = null
}

const cancelDescEdit = () => {
  editingDescId.value = null
}

const openDatePicker = (milestone: Milestone) => {
  datePickerMilestoneId.value = milestone.id
  datePickerTargetDate.value = milestone.targetDate
  datePickerVisible.value = true
}

const onDatePickerConfirm = () => {
  if (datePickerMilestoneId.value) {
    const index = milestones.value.findIndex(m => m.id === datePickerMilestoneId.value)
    if (index > -1) {
      milestones.value[index].targetDate = datePickerTargetDate.value
      milestones.value[index].updatedAt = new Date().toISOString()
      saveData()
      refreshReminders()
    }
  }
  datePickerMilestoneId.value = null
}

const toggleRepeat = (milestone: Milestone) => {
  const index = milestones.value.findIndex(m => m.id === milestone.id)
  if (index > -1) {
    milestones.value[index].repeatStrategy = milestones.value[index].repeatStrategy === 'yearly' ? 'none' : 'yearly'
    milestones.value[index].updatedAt = new Date().toISOString()
    saveData()
    refreshReminders()
  }
}

const openReminderPicker = (milestone: Milestone) => {
  reminderPickerMilestoneId.value = milestone.id
  reminderPickerValue.value = {
    days: milestone.reminderDays || 0,
    hours: milestone.reminderHours || 0,
    minutes: milestone.reminderMinutes || 0
  }
  reminderPickerVisible.value = true
}

const saveReminderPicker = () => {
  if (reminderPickerMilestoneId.value) {
    const index = milestones.value.findIndex(m => m.id === reminderPickerMilestoneId.value)
    if (index > -1) {
      milestones.value[index].reminderStrategy = 'advance'
      milestones.value[index].reminderDays = reminderPickerValue.value.days
      milestones.value[index].reminderHours = reminderPickerValue.value.hours
      milestones.value[index].reminderMinutes = reminderPickerValue.value.minutes
      milestones.value[index].updatedAt = new Date().toISOString()
      saveData()
      refreshReminders()
    }
  }
  reminderPickerMilestoneId.value = null
  reminderPickerVisible.value = false
}

const cancelReminderPicker = () => {
  reminderPickerMilestoneId.value = null
  reminderPickerVisible.value = false
}

const handleEditMilestone = (milestone: Milestone) => {
  editingMilestoneForForm.value = { ...milestone }
  countdownFormVisible.value = true
  logger.info('[倒数日] 打开编辑倒数日对话框', { id: milestone.id, name: milestone.name })
}

const handleAddMilestone = () => {
  editingMilestoneForForm.value = null
  countdownFormVisible.value = true
  logger.info('[倒数日] 打开添加倒数日对话框')
}

const editCategoryFromCard = (cat: Category) => {
  editingCategory.value = cat.value
  categoryForm.value = { label: cat.label, icon: cat.icon }
  categoryFormVisible.value = true
}

const deleteCategoryFromCard = (cat: Category) => {
  if (isDefaultCategory(cat.value)) { ElMessage.warning('系统默认分类不可删除'); return }
  const count = milestones.value.filter(m => m.category === cat.value).length
  if (count > 0) { ElMessage.warning(`该分类下有 ${count} 个倒数日，请先删除或移动这些倒数日`); return }
  ElMessageBox.confirm('确定要删除该分类吗？', '提示', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
  }).then(() => {
    const index = categories.value.findIndex(c => c.value === cat.value)
    if (index > -1) {
      categories.value.splice(index, 1)
      saveCategories()
      if (currentCategoryFromPath.value === cat.value) pageNav.setNavPath(['countdown'])
      ElMessage.success('删除成功')
    }
  }).catch(() => {})
}

const moveCategoryCard = (cat: Category, direction: 'left' | 'right') => {
  const index = categories.value.findIndex(c => c.value === cat.value)
  if (direction === 'left' && index <= 0) { ElMessage.warning('已经是第一个分类，无法左移'); return }
  if (direction === 'right' && index >= categories.value.length - 1) { ElMessage.warning('已经是最后一个分类，无法右移'); return }
  const [moved] = categories.value.splice(index, 1)
  categories.value.splice(direction === 'left' ? index - 1 : index + 1, 0, moved)
  saveCategories()
  ElMessage.success('分类已' + (direction === 'left' ? '左' : '右') + '移')
}

const handleCountdownFormSubmit = (data: Partial<Milestone>) => {
  const hasReminder = data.reminderStrategy && data.reminderStrategy !== 'none'
  if (editingMilestoneForForm.value) {
    const index = milestones.value.findIndex(m => m.id === editingMilestoneForForm.value!.id)
    if (index > -1) {
      milestones.value[index] = {
        ...milestones.value[index],
        ...data,
        updatedAt: new Date().toISOString()
      }
      logger.info('[倒数日] 编辑倒数日', { id: editingMilestoneForForm.value.id, name: data.name, reminder: data.reminderStrategy === 'advance' ? `提前${data.reminderDays}天${data.reminderHours}小时${data.reminderMinutes}分钟` : data.reminderStrategy, repeat: data.repeatStrategy })
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
      reminderMinutes: data.reminderMinutes || 0,
      repeatStrategy: data.repeatStrategy || 'none'
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
      if (index > -1) {
        milestones.value[index].pinned = false
        saveData()
        if (milestone.reminderStrategy === 'advance') refreshReminders()
        logger.info('[倒数日] 取消星标', { id: milestone.id, name: milestone.name })
        ElMessage.success('已取消星标')
      }
      break
    case 'delete':
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

const handleAddCategory = () => {
    editingCategory.value = null
    categoryForm.value = {
      label: '',
      icon: '📌'
    }
    categoryFormVisible.value = true
    logger.info('[倒数日] 打开添加分类对话框')
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
  if (!editingCategory.value) {
    const newCat = categories.value[categories.value.length - 1]
    if (newCat) pageNav.setNavPath(['countdown', newCat.value])
  }
}

const refreshReminders = () => {
  if (typeof window !== 'undefined' && (window as any).__countdownRefresh) {
    (window as any).__countdownRefresh()
  }
}

onMounted(async () => {
  logger.debug('[CountdownList] onMounted 开始', { navPath: pageNav.navPath.value })
  await initFilterState()
  logger.debug('[CountdownList] onMounted 结束', { navPath: pageNav.navPath.value })
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

.countdown-breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  z-index: 20;
  min-height: 40px;
  width: 80%;
  margin: 8px auto 16px auto;
  border-radius: 8px;
}

.breadcrumb-module {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  border-radius: 6px;
  font-size: 16px;
  flex-shrink: 0;
  transition: all 0.15s;
}

.breadcrumb-module:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.breadcrumb-scroll {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  white-space: nowrap;
  flex: 1;
}

.breadcrumb-scroll::-webkit-scrollbar {
  display: none;
}

.breadcrumb-sep {
  color: var(--chalk-white);
  font-size: 14px;
  font-weight: bold;
  user-select: none;
  flex-shrink: 0;
}

.breadcrumb-sep.clickable {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.15s;
}

.breadcrumb-sep.clickable:hover {
  color: var(--chalk-white);
  background: rgba(255, 255, 255, 0.08);
}

.breadcrumb-segment {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 2px 4px;
  border-radius: 4px;
}

.breadcrumb-segment.clickable {
  cursor: pointer;
  transition: all 0.15s;
}

.breadcrumb-segment.clickable:hover {
  background: rgba(255, 255, 255, 0.08);
}

.breadcrumb-plus-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 14px;
  flex-shrink: 0;
}

.breadcrumb-plus-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.page-dropdown {
  position: fixed;
  z-index: 2000;
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  min-width: 75px;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.page-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--chalk-white-75);
  transition: all 0.15s;
}

.page-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.page-dropdown-item.current {
  background: rgba(102, 126, 234, 0.15);
  color: var(--chalk-white);
  font-weight: 500;
}

.page-dropdown-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-cards {
  padding: 20px;
  width: 80%;
  margin: 0 auto;
  box-sizing: border-box;
}

.category-cards.cols-3 {
  column-count: 3;
  column-gap: 16px;
}

.category-cards.cols-1 {
  column-count: 1;
}

.category-cards .folder-card {
  break-inside: avoid;
  margin-bottom: 16px;
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
  overflow-y: auto;
  overflow-x: hidden;
  width: 80%;
  margin: 0 auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.content-wrapper::-webkit-scrollbar {
  display: none;
}

:deep(.el-scrollbar__bar.is-vertical) {
  display: none !important;
}

:deep(.el-scrollbar__bar.is-horizontal) {
  display: none !important;
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
  padding: 20px 0;
  box-sizing: border-box;
  background: transparent;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--chalk-white-85);
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
  background: none;
  border: none;
  box-shadow: none;
}

.milestone-card:hover .card-btn {
  opacity: 1;
}

:deep(.milestone-card .el-button.is-text) {
  background: none !important;
  border: none !important;
  box-shadow: none !important;
}

:deep(.milestone-card .el-button.is-text:hover) {
  background: none !important;
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
  color: var(--chalk-white);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}

.milestone-date {
  margin-bottom: 8px;
}

.date-plain-text {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--chalk-muted);
  cursor: pointer;
  transition: color 0.15s;
}

.date-plain-text .el-icon {
  font-size: 13px;
}

.date-plain-text:hover {
  color: var(--chalk-white);
}

.milestone-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  min-height: 18px;
}

.meta-item {
  cursor: pointer;
  transition: color 0.15s;
}

.meta-item:hover {
  color: var(--chalk-white);
}

.repeat-text {
  color: var(--chalk-blue);
}

.reminder-has {
  color: var(--chalk-orange);
}

.reminder-none {
  color: var(--chalk-muted);
}

.meta-separator {
  color: var(--chalk-white-30);
  user-select: none;
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
  color: var(--chalk-white);
}

.countdown-display.today .countdown-number {
  color: var(--chalk-green);
}

.countdown-display.urgent .countdown-number {
  color: var(--chalk-danger);
}

.countdown-display.upcoming .countdown-number {
  color: var(--chalk-blue);
}

.countdown-display.passed .countdown-number {
  color: var(--chalk-white-60);
}

.countdown-unit {
  font-size: 14px;
  color: var(--chalk-muted);
}

.milestone-desc {
  margin: 0;
  font-size: 13px;
  color: var(--chalk-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
}

.milestone-desc.desc-placeholder {
  color: var(--chalk-subtle);
  font-style: italic;
}

.inline-edit-textarea {
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(102, 126, 234, 0.5);
  border-radius: 6px;
  color: var(--chalk-white-90);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.inline-edit-textarea:focus {
  border-color: rgba(102, 126, 234, 0.8);
  background: rgba(255, 255, 255, 0.08);
}

.inline-edit-textarea::placeholder {
  color: var(--chalk-subtle);
}

.desc-textarea {
  font-size: 13px;
  margin-bottom: 0;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog-container {
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: 90vw;
}

.reminder-picker-dialog {
  width: 350px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.dialog-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
}

.folder-dialog-header {
  justify-content: center;
}

.folder-dialog-title {
  text-align: center;
}

.dialog-body {
  padding: 12px 16px 16px;
}

.form-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.capsule-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: transparent;
  color: var(--chalk-white-70);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
}

.capsule-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.capsule-btn .capsule-icon {
  width: 14px;
  height: 14px;
}

.submit-btn {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.4);
  color: #93c5fd;
}

.submit-btn:hover {
  background: rgba(102, 126, 234, 0.35);
  color: var(--chalk-white);
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