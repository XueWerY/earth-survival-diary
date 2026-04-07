<template>
  <div class="countdown-container">
    <!-- 左侧边栏 -->
    <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <el-scrollbar class="sidebar-content">
        <!-- 全部分类 -->
        <div
            class="category-item all"
            :class="{ active: currentCategory === '' }"
            @click="selectCategory('')"
        >
          <span class="category-icon">📋</span>
          <span class="category-name" v-show="!sidebarCollapsed">全部</span>
          <span class="category-count" v-show="!sidebarCollapsed">{{ milestones.length }}</span>
          <template v-if="!sidebarCollapsed">
            <span class="btn-placeholder"></span>
            <span class="btn-placeholder"></span>
          </template>
        </div>

        <div class="category-divider" v-show="!sidebarCollapsed"></div>

        <!-- 分类列表 -->
        <div
            v-for="cat in categories"
            :key="cat.value"
            class="category-item"
            :class="{ active: currentCategory === cat.value }"
            @click="selectCategory(cat.value)"
        >
          <span class="category-icon">{{ cat.icon }}</span>
          <span class="category-name" v-show="!sidebarCollapsed">{{ cat.label }}</span>
          <span class="category-count" v-show="!sidebarCollapsed">{{ getCategoryCount(cat.value) }}</span>
          <template v-if="!sidebarCollapsed">
            <el-button
                type="primary"
                size="small"
                :icon="Plus"
                circle
                class="add-btn"
                @click.stop="handleAddMilestone(cat.value)"
            />
            <el-dropdown
                trigger="click"
                @command="(cmd: string) => handleCategoryCommand(cmd, cat.value)"
                @click.stop
            >
              <el-button type="info" size="small" text :icon="MoreFilled" class="more-btn" @click.stop />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑分类</el-dropdown-item>
                  <el-dropdown-item v-if="!isDefaultCategory(cat.value)" command="delete" divided>删除分类</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </div>

        <!-- 添加分类按钮 -->
        <div class="add-category-btn" v-show="!sidebarCollapsed" @click="handleAddCategory">
          <el-icon><Plus /></el-icon>
          <span>添加分类</span>
        </div>
      </el-scrollbar>
    </div>

    <!-- 折叠按钮（放在侧边栏外面，确保折叠后仍可见） -->
    <div class="sidebar-toggle" @click="toggleSidebar">
      <el-icon v-if="sidebarCollapsed"><DArrowRight /></el-icon>
      <el-icon v-else><DArrowLeft /></el-icon>
    </div>

    <!-- 右侧内容 -->
    <div class="main-content">
      <!-- 头部 -->
      <div class="content-header">
        <div class="header-left">
          <span class="category-indicator" :style="{ background: getCategoryColor(currentCategory) }"></span>
          <h2>{{ currentCategoryTitle }}</h2>
          <span class="milestone-count">{{ filteredMilestones.length }} 个</span>
        </div>
      </div>

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
                    <span class="category-badge" :style="{ background: getCategoryColor(milestone.category) }">
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
                    <span class="category-badge" :style="{ background: getCategoryColor(milestone.category) }">
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
                  </div>

                  <div class="countdown-display" :class="getCountdownClass(milestone)">
                    <span class="countdown-number">{{ getCountdownDays(milestone) }}</span>
                    <span class="countdown-unit">{{ getCountdownUnit(milestone) }}</span>
                  </div>

                  <p v-if="milestone.description" class="milestone-desc">{{ milestone.description }}</p>

                  <div v-if="isUrgent(milestone)" class="urgent-badge">
                    <el-icon><Warning /></el-icon>
                    即将到来
                  </div>
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
                    <span class="category-badge" :style="{ background: getCategoryColor(milestone.category) }">
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
                    <span class="category-badge" :style="{ background: getCategoryColor(milestone.category) }">
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

    <!-- 表单对话框 -->
    <CountdownForm
        v-model:visible="formVisible"
        :milestone="editingMilestone"
        :default-category="defaultCategory"
        :categories="categories"
        @submit="handleFormSubmit"
    />

    <!-- 分类表单对话框 -->
    <el-dialog
        v-model="categoryFormVisible"
        :title="editingCategory ? '编辑分类' : '添加分类'"
        width="400px"
        modal-class="category-dialog-overlay"
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
        <el-form-item label="颜色">
          <div class="color-picker">
            <div
                v-for="color in COLOR_OPTIONS"
                :key="color"
                class="color-option"
                :class="{ active: categoryForm.color === color }"
                :style="{ backgroundColor: color }"
                @click="categoryForm.color = color"
            />
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
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Calendar, Clock, Timer, Star, MoreFilled, Warning, Sunny, DArrowRight, DArrowLeft } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import CountdownForm from './CountdownForm.vue'
import { getData, setData } from '../services/storageService'

// 里程碑类型定义
interface Milestone {
  id: string
  name: string
  targetDate: string
  category: string
  description: string
  /** 倒数日：距目标日；正数日：从起始日起已过天数 */
  countMode?: 'countdown' | 'countup'
  pinned: boolean
  isSystem?: boolean
  createdAt: string
  updatedAt: string
}

// 分类类型定义
interface Category {
  value: string
  label: string
  icon: string
  color: string
  isCustom?: boolean
}

// 系统倒数日ID（「已使用地球 Online 生存日记」：账号注册日至今日的天数）
const SYSTEM_MILESTONE_ID = 'system-usage-days'

const isSystemUsageMilestone = (m: Milestone): boolean => m.id === SYSTEM_MILESTONE_ID

/** 自然日从注册日（targetDate）到今日的天数，用于系统「已使用」卡片 */
const getDaysSinceAccountRegistration = (milestone: Milestone): number => {
  const today = dayjs().startOf('day')
  const start = dayjs(milestone.targetDate).startOf('day')
  if (!start.isValid()) return 0
  const n = today.diff(start, 'day')
  return n < 0 ? 0 : n
}

// 默认分类
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

// 图标选项
const ICON_OPTIONS = ['🎂', '💕', '🎉', '✈️', '🎮', '💼', '📚', '🌟', '🎵', '🎬', '🏠', '❤️', '🎁', '🏆', '📅', '🎯']

// 颜色选项
const COLOR_OPTIONS = ['#f472b6', '#ec4899', '#a855f7', '#8b5cf6', '#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280']

// 本地存储键名
const STORAGE_KEY = 'earth-survival-milestones'
const CATEGORY_KEY = 'earth-survival-countdown-categories'
const STATE_KEY = 'earth-survival-countdown-state'

// 数据
const milestones = ref<Milestone[]>([])
const categories = ref<Category[]>([...DEFAULT_CATEGORIES])
const currentCategory = ref('')

// 侧边栏折叠状态
const sidebarCollapsed = ref(false)

// 切换侧边栏折叠
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// 表单相关
const formVisible = ref(false)
const editingMilestone = ref<Milestone | null>(null)
const defaultCategory = ref('')

// 分类表单相关
const categoryFormVisible = ref(false)
const editingCategory = ref<string | null>(null)
const categoryForm = ref({
  label: '',
  icon: '📌',
  color: '#6b7280'
})

// 判断是否是默认分类
const isDefaultCategory = (value: string): boolean => {
  return DEFAULT_CATEGORIES.some(c => c.value === value)
}

// 从存储恢复状态
const initFilterState = async () => {
  const parsedState = await getData<{ currentCategory?: string }>(STATE_KEY)
  if (parsedState) {
    currentCategory.value = parsedState.currentCategory || ''
  }
}

// 保存状态到存储
watch(currentCategory, async () => {
  const state = { currentCategory: currentCategory.value }
  await setData(STATE_KEY, state)
})

// 当前分类标题
const currentCategoryTitle = computed(() => {
  if (!currentCategory.value) return '全部'
  const cat = categories.value.find(c => c.value === currentCategory.value)
  return cat?.label || '未知分类'
})

// 计算属性：过滤后的里程碑
const filteredMilestones = computed(() => {
  let result = [...milestones.value]

  // 分类过滤
  if (currentCategory.value) {
    result = result.filter(m => m.category === currentCategory.value)
  }

  // 按日期排序
  result.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())

  return result
})

// 获取分类数量
const getCategoryCount = (categoryValue: string): number => {
  return milestones.value.filter(m => m.category === categoryValue).length
}

// 置顶的里程碑
const pinnedMilestones = computed(() => {
  return filteredMilestones.value.filter(m => m.pinned === true)
})

// 即将到来的里程碑
const upcomingMilestones = computed(() => {
  return filteredMilestones.value.filter(m => {
    if (m.pinned === true) return false
    const days = getDaysDiff(m)
    return days >= 0 && days <= 30
  })
})

// 未来的里程碑
const futureMilestones = computed(() => {
  return filteredMilestones.value.filter(m => {
    if (m.pinned === true) return false
    const days = getDaysDiff(m)
    return days > 30
  })
})

// 已过期的里程碑
const passedMilestones = computed(() => {
  return filteredMilestones.value.filter(m => {
    if (m.pinned === true) return false
    return getDaysDiff(m) < 0
  })
})

// 工具函数
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

// 数据持久化
const saveData = async () => {
  await setData(STORAGE_KEY, milestones.value)
}

const saveCategories = async () => {
  await setData(CATEGORY_KEY, categories.value)
}

const loadData = async () => {
  try {
    // 加载分类
    const savedCategories = await getData<Category[]>(CATEGORY_KEY)
    if (savedCategories && savedCategories.length > 0) {
      categories.value = savedCategories
    }

    // 加载里程碑
    const saved = await getData<Milestone[]>(STORAGE_KEY)
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
        updatedAt: m.updatedAt || new Date().toISOString()
      }))
    }

    // 账号注册时间（与资料页一致：profile 或 user 上的创建时间）
    const authStore = await import('../stores/authStore').then(m => m.useAuthStore())
    const userAny = authStore.user as { createdAt?: string; created_at?: string } | null | undefined
    const startDate =
        authStore.profile?.created_at ||
        userAny?.createdAt ||
        userAny?.created_at ||
        new Date().toISOString()
    const registrationDay = dayjs(startDate).format('YYYY-MM-DD')

    // 确保系统倒数日存在：起始日为注册日，展示为注册日至今日的天数，归类「纪念日」
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
  } catch (e) {
    console.error('Failed to load data:', e)
    milestones.value = []
  }
}

// 选择分类
const selectCategory = (category: string) => {
  currentCategory.value = category
}

// 添加里程碑
const handleAddMilestone = (category?: string) => {
  editingMilestone.value = null
  defaultCategory.value = category || currentCategory.value || 'life'
  formVisible.value = true
}

// 编辑里程碑
const handleEditMilestone = (milestone: Milestone) => {
  editingMilestone.value = { ...milestone }
  formVisible.value = true
}

// 里程碑操作
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
          ElMessage.success('删除成功')
        }
      }).catch(() => {})
      break
  }
}

// 表单提交
const handleFormSubmit = (data: Partial<Milestone>) => {
  if (editingMilestone.value) {
    const index = milestones.value.findIndex(m => m.id === editingMilestone.value!.id)
    if (index > -1) {
      milestones.value[index] = {
        ...milestones.value[index],
        ...data,
        updatedAt: new Date().toISOString()
      }
      ElMessage.success('更新成功')
    }
  } else {
    const newMilestone: Milestone = {
      id: Date.now().toString(),
      name: data.name || '',
      targetDate: data.targetDate || '',
      category: data.category || 'life',
      description: data.description || '',
      countMode: data.countMode === 'countup' ? 'countup' : 'countdown',
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    milestones.value.push(newMilestone)
    ElMessage.success('添加成功')
  }
  saveData()
  formVisible.value = false
}

// 添加分类
const handleAddCategory = () => {
  editingCategory.value = null
  categoryForm.value = {
    label: '',
    icon: '📌',
    color: '#6b7280'
  }
  categoryFormVisible.value = true
}

// 分类操作
const handleCategoryCommand = (command: string, categoryValue: string) => {
  if (command === 'edit') {
    const cat = categories.value.find(c => c.value === categoryValue)
    if (cat) {
      editingCategory.value = categoryValue
      categoryForm.value = {
        label: cat.label,
        icon: cat.icon,
        color: cat.color
      }
      categoryFormVisible.value = true
    }
  } else if (command === 'delete') {
    // 检查是否有倒数日使用此分类
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
        ElMessage.success('删除成功')
        if (currentCategory.value === categoryValue) {
          currentCategory.value = ''
        }
      }
    }).catch(() => {})
  }
}

// 分类表单提交
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
        color: categoryForm.value.color
      }
      ElMessage.success('分类已更新')
    }
  } else {
    const value = `custom-${Date.now()}`
    categories.value.push({
      value,
      label: categoryForm.value.label,
      icon: categoryForm.value.icon,
      color: categoryForm.value.color,
      isCustom: true
    })
    ElMessage.success('分类已添加')
  }
  saveCategories()
  categoryFormVisible.value = false
}

// 初始化
onMounted(async () => {
  await loadData()
  await initFilterState()
})
</script>

<style scoped>
.countdown-container {
  height: 100%;
  display: flex;
  background: transparent;
  position: relative;
}

/* 左侧边栏 */
.sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  transition: width 0.3s ease;
  position: relative;
}

.sidebar.collapsed {
  width: 0;
  border-right: none;
  overflow: hidden;
}

.sidebar-content {
  flex: 1;
  padding: 12px 8px;
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

.sidebar.collapsed + .sidebar-toggle {
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

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.category-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.category-item.active {
  background: rgba(255, 255, 255, 0.1);
}

.category-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.category-name {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.category-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  min-width: 20px;
  text-align: right;
}

.add-btn {
  opacity: 0;
  transition: opacity 0.2s;
  width: 24px !important;
  height: 24px !important;
}

.category-item:hover .add-btn:not(:disabled) {
  opacity: 1;
}

.btn-placeholder {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.add-btn.hidden {
  visibility: hidden;
}

.more-btn {
  opacity: 0;
  transition: opacity 0.2s;
  width: 24px !important;
  height: 24px !important;
  padding: 0 !important;
}

.category-item:hover .more-btn:not(:disabled) {
  opacity: 1;
}

.category-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 8px 0;
}

.add-category-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  margin-top: 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s;
}

.add-category-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
}

/* 右侧内容 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-indicator {
  width: 4px;
  height: 20px;
  border-radius: 2px;
}

.header-left h2 {
  margin: 0;
  font-size: 20px;
  color: #fff;
  font-weight: 600;
}

.milestone-count {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.content-body {
  flex: 1;
  overflow: hidden;
}

.section {
  padding: 20px 24px;
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

.urgent-badge {
  position: absolute;
  top: 12px;
  right: 48px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.15);
  border-radius: 4px;
  font-size: 12px;
  color: #ef4444;
}

/* 分区样式 */
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

/* 系统倒数日样式 */
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

/* 图标选择器 */
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

/* 颜色选择器 */
.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}
</style>

<style>
/* 分类对话框暗色主题 */
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
