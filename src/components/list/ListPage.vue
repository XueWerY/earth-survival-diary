<template>
  <div class="list-container">
    <div v-if="showBreadcrumb" class="list-breadcrumb-bar">
      <button class="breadcrumb-module" @click="pageNav.setNavPath(['list'])" title="回到清单首页">📋</button>
      <div class="breadcrumb-scroll" ref="breadcrumbScrollRef">
        <template v-for="(seg, idx) in localBreadcrumbSegments" :key="idx">
          <span v-if="seg.dropdownItems" class="breadcrumb-sep clickable" @click.stop="openSegmentDropdown(seg, $event)">{{ (activeDropdown === 'segment' && activeSegment === seg) ? '∨' : '>' }}</span>
          <span v-else class="breadcrumb-sep">></span>
          <span
            class="breadcrumb-segment"
            :class="{ clickable: seg.clickable }"
            :style="{ color: seg.color }"
            @click="seg.clickable && seg.onClick && seg.onClick()"
          >{{ seg.label }}</span>
        </template>
      </div>
      <button v-if="navPath.length >= 2" class="breadcrumb-fav-btn" :class="{ active: isCurrentFavorited }" @click="toggleFavorite" title="收藏当前视图">
        <el-icon><StarFilled v-if="isCurrentFavorited" /><Star v-else /></el-icon>
      </button>
      <button class="breadcrumb-quick-btn" @click="openFavoritesDropdown" title="快速访问">
        <el-icon><CollectionTag /></el-icon>
      </button>
      <button v-if="showSortButton" class="breadcrumb-sort-btn" @click="openSortDropdown" title="排序">
        <el-icon><Sort /></el-icon>
      </button>
      <button v-if="plusAction" class="breadcrumb-plus-btn" @click="plusAction" title="添加"><el-icon><PlusIcon /></el-icon></button>
    </div>

    <div v-if="activeDropdown === 'segment'" class="page-dropdown" :style="dropdownPosStyle" @click.stop>
      <div v-for="item in segmentDropdownItems" :key="item.id" class="page-dropdown-item" :class="{ current: item.current }" @click="handleSegmentDropdownSelect(item)">
        <span class="page-dropdown-dot" :style="{ background: item.color }"></span>
        <span>{{ item.name }}</span>
      </div>
    </div>

    <div v-if="activeDropdown === 'sort'" class="page-dropdown" :style="sortDropdownPosStyle" @click.stop>
      <div v-for="opt in sortOptions" :key="opt.value" class="page-dropdown-item" :class="{ current: currentSort === opt.value }" @click="selectSortOption(opt.value)">
        <span>{{ opt.label }}</span>
      </div>
    </div>

    <div v-if="activeDropdown === 'favorites'" class="page-dropdown" :style="dropdownPosStyle" @click.stop>
      <div v-if="favorites.length === 0" class="page-dropdown-empty">暂无收藏</div>
      <div v-for="fav in favorites" :key="fav.id" class="page-dropdown-item" @click="selectFavorite(fav)">
        <span>{{ fav.name }}</span>
      </div>
    </div>

    <div class="main-content" @click="closeDropdown">
      <el-scrollbar>

        <div v-if="isTaskRoot" class="card-grid card-grid-root" :class="isElectron ? 'grid-4cols' : 'grid-2cols'">
          <div class="folder-card has-actions" @click="pageNav.setNavPath(['list', 'smart'])">
            <div class="folder-card-icon smart-icon-bg"><el-icon><List /></el-icon></div>
            <span class="folder-card-name">智能清单</span>
            <span class="folder-card-count">{{ smartListCount }}个清单</span>
          </div>
          <div v-for="folder in sortedFolders" :key="folder.id" class="folder-card has-actions" @click="pageNav.setNavPath(['list', 'custom', folder.id])">
            <div class="card-top-actions" @click.stop>
              <button class="card-icon-btn" title="编辑文件夹" @click="handleEditFolder(folder)"><el-icon><Edit /></el-icon></button>
              <button class="card-icon-btn danger" title="删除文件夹" @click="handleDeleteFolder(folder)"><el-icon><Delete /></el-icon></button>
            </div>
            <div class="folder-card-icon" :style="{ background: folder.color }"><el-icon><Folder /></el-icon></div>
            <span class="folder-card-name">{{ folder.name }}</span>
            <span class="folder-card-count">{{ getFolderListCount(folder.id) }}个清单</span>
          </div>
        </div>

        <template v-else-if="isSmartOverview">
          <div class="card-grid" :class="!isElectron ? 'grid-2cols' : ''">
            <div class="folder-card" @click="pageNav.setNavPath(['list', 'smart', 'today'])">
              <div class="folder-card-icon today-icon-bg"><el-icon><Calendar /></el-icon></div>
              <span class="folder-card-name">今天</span>
              <span class="folder-card-count">{{ todayTasksCount }}个任务</span>
            </div>
            <div class="folder-card" @click="pageNav.setNavPath(['list', 'smart', 'expired'])">
              <div class="folder-card-icon expired-icon-bg"><el-icon><Clock /></el-icon></div>
              <span class="folder-card-name">已过期</span>
              <span class="folder-card-count">{{ expiredTasksCount }}个任务</span>
            </div>
            <div class="folder-card" @click="pageNav.setNavPath(['list', 'smart', 'future'])">
              <div class="folder-card-icon future-icon-bg"><el-icon><Timer /></el-icon></div>
              <span class="folder-card-name">未来七天</span>
              <span class="folder-card-count">{{ futureTasksCount }}个任务</span>
            </div>
          </div>
        </template>

        <template v-else-if="isSmartDetail">
          <el-empty v-if="smartDetailTasks.length === 0" :description="smartDetailEmptyText" :image-size="120" />
          <div v-else :class="[smartDetailIsToday ? 'today-lists' : 'smart-lists', isElectron ? 'grid-2cols' : '']">
              <TaskCard v-for="list in smartDetailTasks" :key="list.id" :list="list" :context="smartDetailCardContext" @delete="deleteTask" />
            </div>
        </template>

        <template v-else-if="isCustomOverview">
          <el-empty v-if="sortedFolders.length === 0" description="还没有自定义文件夹" :image-size="120" />
          <div v-else class="card-grid" :class="!isElectron ? 'grid-2cols' : ''">
            <div v-for="folder in sortedFolders" :key="folder.id" class="folder-card has-actions" @click="pageNav.setNavPath(['list', 'custom', folder.id])">
              <div class="card-top-actions" @click.stop>
                <button class="card-icon-btn" title="编辑文件夹" @click="handleEditFolder(folder)"><el-icon><Edit /></el-icon></button>
                <button class="card-icon-btn danger" title="删除文件夹" @click="handleDeleteFolder(folder)"><el-icon><Delete /></el-icon></button>
              </div>
              <div class="folder-card-icon" :style="{ background: folder.color }"><el-icon><Folder /></el-icon></div>
              <span class="folder-card-name">{{ folder.name }}</span>
              <span class="folder-card-count">{{ getFolderListCount(folder.id) }}个清单</span>
            </div>
          </div>
        </template>

        <template v-else-if="isFolderView">
          <el-empty v-if="folderLists.length === 0" description="该文件夹下还没有清单" :image-size="120" />
          <div v-else class="card-grid" :class="!isElectron ? 'grid-2cols' : ''">
            <div v-for="list in sortedFolderLists" :key="list.id" class="folder-card has-actions" @click="pageNav.setNavPath(['list', 'custom', currentFolderIdFromPath, list.id])">
              <div class="card-top-actions" @click.stop>
                <button class="card-icon-btn" title="编辑清单" @click="handleEditListCard(list)"><el-icon><Edit /></el-icon></button>
                <button class="card-icon-btn danger" title="删除清单" @click="handleDeleteListCard(list)"><el-icon><Delete /></el-icon></button>
              </div>
              <div class="folder-card-icon" :style="{ background: list.color }">
                <el-icon><Folder /></el-icon>
              </div>
              <span class="folder-card-name">{{ list.name }}</span>
              <span class="folder-card-count">{{ getListGroupCount(list.id) }}个分组{{ getListTaskCount(list.id) }}个任务</span>
            </div>
          </div>
        </template>

        <template v-else-if="isListView">
          <el-empty v-if="currentGroups.length === 0" description="还没有分组" :image-size="120" />
          <div v-else class="card-grid" :class="!isElectron ? 'grid-2cols' : ''">
            <div v-for="group in currentSortedGroups" :key="group.id" class="folder-card has-actions" @click="pageNav.setNavPath(['list', 'custom', currentFolderIdFromPath, currentListIdFromPath, group.id])">
              <div class="card-top-actions" @click.stop>
                <button class="card-icon-btn" title="编辑分组" @click="handleEditGroupCard(group)"><el-icon><Edit /></el-icon></button>
                <button v-if="!isDefaultGroup(group.id)" class="card-icon-btn danger" title="删除分组" @click="handleDeleteGroupCard(group)"><el-icon><Delete /></el-icon></button>
              </div>
              <div class="folder-card-icon" :style="{ background: group.color }">
                <el-icon><Folder /></el-icon>
              </div>
              <span class="folder-card-name">{{ group.name }}</span>
              <span class="folder-card-count">{{ getGroupTaskCount(group.id) }} 个任务</span>
            </div>
          </div>
        </template>

        <template v-else-if="isGroupTasksView">
          <el-empty v-if="currentGroupTasks.length === 0" description="暂无任务" :image-size="120" />
          <div v-else class="list-list" :class="isElectron ? 'grid-2cols' : ''">
            <TaskCard v-for="list in currentGroupTasks" :key="list.id" :list="list" context="custom-list" @delete="deleteTask" />
          </div>
        </template>

        <div v-else class="empty-state">
          <el-empty description="请选择一个清单" :image-size="120" />
        </div>

      </el-scrollbar>
    </div>
  </div>

  <div v-if="showFolderDialog" class="dialog-overlay" @click.self="closeFolderDialog">
      <div class="dialog-container folder-color-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">{{ dialogFolder ? '编辑文件夹' : '添加文件夹' }}</span>
        </div>
        <div class="dialog-body">
          <div class="folder-form">
            <el-input v-model="folderFormName" placeholder="请输入文件夹名称" @keyup.enter="onFolderFormSubmit" />
            <div class="folder-color-section">
              <span class="folder-color-label">颜色</span>
              <div class="folder-color-grid">
                <div
                  v-for="c in EXTENDED_FOLDER_COLORS"
                  :key="c"
                  class="folder-color-swatch"
                  :class="{ selected: folderFormColor === c }"
                  :style="{ background: c }"
                  @click="folderFormColor = c"
                ></div>
              </div>
              <div class="folder-color-custom">
                <span class="folder-color-label">自定义</span>
                <el-input v-model="folderFormColor" placeholder="#667eea" size="small" class="folder-color-input" />
              </div>
            </div>
            <div class="folder-form-footer">
              <el-button @click="closeFolderDialog">取消</el-button>
              <el-button type="primary" @click="onFolderFormSubmit">保存</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

  <div v-if="showListDialog" class="dialog-overlay" @click.self="closeListDialog">
    <div class="dialog-container folder-color-dialog">
      <div class="dialog-header folder-dialog-header">
        <span class="dialog-header-title folder-dialog-title">{{ dialogList ? '编辑清单' : '添加清单' }}</span>
      </div>
      <div class="dialog-body">
        <ListFormPage :list="dialogList" @submit="onListSubmit" @cancel="closeListDialog" />
      </div>
    </div>
  </div>

  <div v-if="showGroupDialog" class="dialog-overlay" @click.self="closeGroupDialog">
    <div class="dialog-container folder-color-dialog">
      <div class="dialog-header folder-dialog-header">
        <span class="dialog-header-title folder-dialog-title">{{ dialogGroup ? '编辑分组' : '添加分组' }}</span>
      </div>
      <div class="dialog-body">
        <GroupFormPage :group="dialogGroup" :list-id="currentListIdForDialog" @submit="onGroupSubmit" @cancel="closeGroupDialog" />
      </div>
    </div>
  </div>

  <Teleport v-if="showTaskDialog" to="body">
    <div class="dialog-overlay list-dialog-overlay" @click.self="closeTaskDialog">
      <div class="dialog-container folder-color-dialog list-add-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">添加任务</span>
        </div>
        <div class="dialog-body">
          <TaskForm :list-id="listDialogListId" :group-id="listDialogGroupId" @submit="onTaskSubmit" @cancel="closeTaskDialog" />
        </div>
      </div>
    </div>
  </Teleport>

  <div v-if="showMoveDialog" class="dialog-overlay" @click.self="closeMoveDialog">
    <div class="dialog-container">
      <div class="dialog-header">
        <span class="dialog-header-title">移动任务</span>
        <el-button class="dialog-close-btn" text @click="closeMoveDialog"><el-icon><Close /></el-icon></el-button>
      </div>
      <div class="dialog-body">
        <MoveTaskPage :list-id="moveTaskId" @submit="onMoveSubmit" @cancel="closeMoveDialog" />
      </div>
    </div>
  </div>

  <div v-if="showConfirmDialog" class="dialog-overlay" @click.self="closeConfirmDialog">
    <div class="dialog-container confirm-dialog-container">
      <div class="confirm-icon"><el-icon class="warning-icon"><Warning /></el-icon></div>
      <h3 class="confirm-title">{{ confirmDialogTitle }}</h3>
      <p class="confirm-message">{{ confirmDialogMessage }}</p>
      <div class="confirm-actions">
        <el-button type="default" @click="closeConfirmDialog">取消</el-button>
        <el-button type="danger" @click="handleConfirmAction">确认删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar, Clock, Timer, Close, Warning, Edit, Plus as PlusIcon, Delete, List, Folder, Check, Sort, Star, StarFilled, CollectionTag } from '@element-plus/icons-vue'
import ListFormPage from './ListFormPage.vue'
import GroupFormPage from './GroupFormPage.vue'
import TaskForm from './TaskForm.vue'
import TaskCard from './TaskCard.vue'
import MoveTaskPage from './MoveTaskPage.vue'
import dayjs from 'dayjs'
import { useListStore, DEFAULT_FOLDER_COLORS, EXTENDED_FOLDER_COLORS, type Task, type ListPage, type TaskGroup, type TaskFolder } from '../../stores/listStore'
import { usePageNav, restoreModuleNavPath, type BreadcrumbSegment, type DropdownItem, type FavoriteItem } from '../../composables/usePageNav'
import { getSystemStateField, setSystemStateField } from '../../services/storageService'
import { logger } from '../../lib/logger'

const pageNav = usePageNav()

const listStore = useListStore()

const refreshReminders = inject<() => void>('refreshReminders', () => {})
const isGuideActive = inject('guideVisible', ref(false))

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electronAPI)

const navPath = computed(() => {
  const val = pageNav.navPath.value
  return val
})

const breadcrumbScrollRef = ref<HTMLElement | null>(null)

const scrollBreadcrumbToEnd = () => {
  nextTick(() => {
    const el = breadcrumbScrollRef.value
    if (el) el.scrollLeft = el.scrollWidth
  })
}

const isTaskRoot = computed(() => {
  const result = navPath.value.length === 1 && navPath.value[0] === 'list'
  logger.debug('[ListPage] isTaskRoot 计算', { navPath: [...navPath.value], result })
  return result
})
const isSmartOverview = computed(() => navPath.value.length === 2 && navPath.value[0] === 'list' && navPath.value[1] === 'smart')
const isSmartDetail = computed(() => navPath.value.length === 3 && navPath.value[0] === 'list' && navPath.value[1] === 'smart')
const isCustomOverview = computed(() => navPath.value.length === 2 && navPath.value[0] === 'list' && navPath.value[1] === 'custom')
const isFolderView = computed(() => navPath.value.length === 3 && navPath.value[0] === 'list' && navPath.value[1] === 'custom')
const isListView = computed(() => navPath.value.length === 4 && navPath.value[0] === 'list' && navPath.value[1] === 'custom')
const isGroupTasksView = computed(() => navPath.value.length === 5 && navPath.value[0] === 'list' && navPath.value[1] === 'custom')
const isAtSmartDetail = computed(() => navPath.value.length >= 3 && navPath.value[0] === 'list' && navPath.value[1] === 'smart')

type SortMode = 'name' | 'date' | 'endTime' | 'priority'

const currentSort = ref<SortMode>('priority')

const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'name', label: '按名称排序' },
  { value: 'date', label: '按结束日期排序' },
  { value: 'endTime', label: '按结束时间排序' },
  { value: 'priority', label: '按优先级排序' },
]

const sortDropdownPos = ref({ top: 0, left: 0 })
const sortDropdownPosStyle = computed(() => ({
  top: sortDropdownPos.value.top + 'px',
  left: sortDropdownPos.value.left + 'px'
}))

const showSortButton = computed(() => isSmartDetail.value || isGroupTasksView.value)

function sortTasks(tasks: Task[]): Task[] {
  const po: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 }
  const mode = currentSort.value
  return [...tasks].sort((a, b) => {
    let result = 0
    // Primary sort by selected mode
    if (mode === 'name') result = a.name.localeCompare(b.name)
    else if (mode === 'date') {
      if (!a.date && !b.date) result = 0
      else if (!a.date) result = 1
      else if (!b.date) result = -1
      else result = dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
    } else if (mode === 'endTime') {
      if (!a.date && !b.date && !a.endTime && !b.endTime) result = 0
      else if (!a.date && !b.date) {
        if (!a.endTime && b.endTime) result = 1
        else if (a.endTime && !b.endTime) result = -1
        else if (a.endTime && b.endTime) result = a.endTime.localeCompare(b.endTime)
      } else if (!a.date) result = 1
      else if (!b.date) result = -1
      else {
        const dc = dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
        if (dc !== 0) result = dc
        else {
          if (!a.endTime && b.endTime) result = 1
          else if (a.endTime && !b.endTime) result = -1
          else if (a.endTime && b.endTime) result = a.endTime.localeCompare(b.endTime)
        }
      }
    } else if (mode === 'priority') {
      result = po[a.priority] - po[b.priority]
    }
    if (result !== 0) return result

    // Tie-breakers: priority > date > endTime > name
    if (mode !== 'priority') {
      const pr = po[a.priority] - po[b.priority]
      if (pr !== 0) return pr
    }
    if (mode !== 'date' && mode !== 'endTime') {
      if (!a.date && !b.date) { /* ok */ }
      else if (!a.date) return 1
      else if (!b.date) return -1
      else {
        const dr = dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
        if (dr !== 0) return dr
      }
    }
    if (mode !== 'endTime') {
      if (!a.endTime && b.endTime) return 1
      if (a.endTime && !b.endTime) return -1
      if (a.endTime && b.endTime) {
        const tr = a.endTime.localeCompare(b.endTime)
        if (tr !== 0) return tr
      }
    }
    if (mode !== 'name') {
      const nr = a.name.localeCompare(b.name)
      if (nr !== 0) return nr
    }
    return 0
  })
}

function computeBreadcrumbSegments(): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = []
  const path = pageNav.navPath.value

  if (path.length < 2 || path[0] !== 'list') return segments

  const buildFolderDropdownItems = (): DropdownItem[] => {
    const items: DropdownItem[] = []
    const isSmart = path[1] === 'smart'
    items.push({
      id: 'smart', name: '智能清单', color: '#667eea', current: isSmart,
      onSelect: () => pageNav.setNavPath(['list', 'smart'])
    })
    for (const f of sortedFolders.value) {
      const isCurrent = path[1] === 'custom' && path[2] === f.id
      items.push({
        id: f.id, name: f.name, color: f.color, current: isCurrent,
        onSelect: () => pageNav.setNavPath(['list', 'custom', f.id])
      })
    }
    return items
  }

  const buildSmartItemsDropdown = (currentType: string): DropdownItem[] => [
    { id: 'today', name: '今天', color: '#22c55e', current: currentType === 'today', onSelect: () => pageNav.setNavPath(['list', 'smart', 'today']) },
    { id: 'expired', name: '已过期', color: '#ef4444', current: currentType === 'expired', onSelect: () => pageNav.setNavPath(['list', 'smart', 'expired']) },
    { id: 'future', name: '未来七天', color: '#3b82f6', current: currentType === 'future', onSelect: () => pageNav.setNavPath(['list', 'smart', 'future']) },
  ]

  const buildListsDropdown = (folderId: string, currentListId: string): DropdownItem[] => {
    const rawLists = folderId ? listStore.getListsInFolder(folderId) : []
    return [...rawLists].sort((a, b) => a.order - b.order).map(l => ({
      id: l.id, name: l.name, color: l.color, current: l.id === currentListId,
      onSelect: () => pageNav.setNavPath(['list', 'custom', folderId, l.id])
    }))
  }

  const buildGroupsDropdown = (folderId: string, listId: string, currentGroupId: string): DropdownItem[] => {
    const rawList = listId ? listStore.taskLists.find(l => l.id === listId) : undefined
    const rawGroups = rawList?.groups || []
    return [...rawGroups].sort((a, b) => a.order - b.order).map(g => ({
      id: g.id, name: g.name, color: g.color, current: g.id === currentGroupId,
      onSelect: () => pageNav.setNavPath(['list', 'custom', folderId, listId, g.id])
    }))
  }

  if (path[1] === 'smart') {
    segments.push({
      label: '智能清单',
      color: '#667eea',
      clickable: true,
      onClick: () => pageNav.setNavPath(['list', 'smart']),
      dropdownItems: buildFolderDropdownItems()
    })
    if (path.length >= 3) {
      const type = path[2]
      const smartNames: Record<string, string> = { today: '今天', expired: '已过期', future: '未来七天' }
      const smartColors: Record<string, string> = { today: '#22c55e', expired: '#ef4444', future: '#3b82f6' }
      segments.push({
        label: smartNames[type] || '',
        color: smartColors[type] || '',
        clickable: true,
        onClick: () => pageNav.setNavPath(['list', 'smart', type]),
        dropdownItems: buildSmartItemsDropdown(type)
      })
    }
  } else if (path[1] === 'custom') {
    if (path.length === 2) {
      segments.push({
        label: '自定义清单',
        color: '#667eea',
        clickable: true,
        onClick: () => pageNav.setNavPath(['list', 'custom']),
        dropdownItems: buildFolderDropdownItems()
      })
    } else if (path.length >= 3) {
      const folder = sortedFolders.value.find(f => f.id === path[2])
      segments.push({
        label: folder?.name || '自定义清单',
        color: folder?.color || '#667eea',
        clickable: true,
        onClick: () => pageNav.setNavPath(['list', 'custom', path[2]]),
        dropdownItems: buildFolderDropdownItems()
      })
      if (path.length >= 4) {
        const list = listStore.taskLists.find(l => l.id === path[3])
        segments.push({
          label: list?.name || '',
          color: list?.color || '',
          clickable: true,
          onClick: () => pageNav.setNavPath(['list', 'custom', path[2], path[3]]),
          dropdownItems: buildListsDropdown(path[2], path[3])
        })
        if (path.length >= 5) {
          const listForGroup = listStore.taskLists.find(l => l.id === path[3])
          const group = listForGroup?.groups.find(g => g.id === path[4])
          segments.push({
            label: group?.name || '',
            color: group?.color || '',
            clickable: false,
            onClick: null,
            dropdownItems: buildGroupsDropdown(path[2], path[3], path[4])
          })
        }
      }
    }
  }

  return segments
}

const localBreadcrumbSegments = ref<BreadcrumbSegment[]>([])

const showBreadcrumb = computed(() => {
  const path = navPath.value
  const result = path.length >= 1 && path[0] === 'list'
  logger.debug('[ListPage] showBreadcrumb 计算', { path: [...path], result })
  return result
})

const plusAction = computed(() => {
  if (isTaskRoot.value) return handleAddFolder
  if (isFolderView.value) return handleAddList
  if (isCustomOverview.value) return handleAddFolder
  if (isListView.value) return handleAddGroupToCurrent
  if (isGroupTasksView.value) return handleOpenAddTaskAtCurrent
  return null
})

const activeDropdown = ref<string | null>(null)
const dropdownPos = ref({ top: 0, left: 0 })

const dropdownPosStyle = computed(() => ({
  top: dropdownPos.value.top + 'px',
  left: dropdownPos.value.left + 'px'
}))

const activeSegment = ref<BreadcrumbSegment | null>(null)

const favorites = ref<FavoriteItem[]>([])

const loadFavorites = async () => {
  const listState = await getSystemStateField('list')
  favorites.value = listState?.favorites || []
}

const currentNavPathKey = computed(() => JSON.stringify(navPath.value))
const isCurrentFavorited = computed(() => favorites.value.some(f => JSON.stringify(f.navPath) === currentNavPathKey.value))

const toggleFavorite = async () => {
  const path = navPath.value
  if (path.length < 2) return
  activeDropdown.value = null
  activeSegment.value = null
  const key = currentNavPathKey.value
  if (isCurrentFavorited.value) {
    favorites.value = favorites.value.filter(f => JSON.stringify(f.navPath) !== key)
  } else {
    const name = localBreadcrumbSegments.value.map(s => s.label).join(' > ')
    favorites.value.push({ id: 'fav-' + Date.now(), name, navPath: [...path] })
  }
  const listState = await getSystemStateField('list') || {}
  listState.favorites = favorites.value
  await setSystemStateField('list', listState)
}

const openFavoritesDropdown = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  dropdownPos.value = { top: rect.bottom + 4, left: rect.left - 8 }
  activeDropdown.value = 'favorites'
  activeSegment.value = null
}

const selectFavorite = (fav: FavoriteItem) => {
  activeDropdown.value = null
  pageNav.setNavPath([...fav.navPath])
}

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

const openSortDropdown = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  sortDropdownPos.value = { top: rect.bottom + 4, left: rect.left - 8 }
  activeDropdown.value = 'sort'
  activeSegment.value = null
}

const selectSortOption = (mode: SortMode) => {
  currentSort.value = mode
  activeDropdown.value = null
}

const closeDropdown = () => {
  activeDropdown.value = null
  activeSegment.value = null
}

const currentFolderIdFromPath = computed(() => {
  if (navPath.value.length >= 3 && navPath.value[0] === 'list' && navPath.value[1] === 'custom') return navPath.value[2]
  return ''
})
const currentListIdFromPath = computed(() => {
  if (navPath.value.length >= 4 && navPath.value[0] === 'list' && navPath.value[1] === 'custom') return navPath.value[3]
  return ''
})
const currentGroupIdFromPath = computed(() => {
  if (navPath.value.length >= 5 && navPath.value[0] === 'list' && navPath.value[1] === 'custom') return navPath.value[4]
  return ''
})

const currentListIdForDialog = computed(() => currentListIdFromPath.value)

const listDialogListId = computed(() => currentListIdFromPath.value)
const listDialogGroupId = computed(() => currentGroupIdFromPath.value)

const lists = computed(() => listStore.lists)
const folders = computed(() => listStore.folders)
const sortedLists = computed(() => [...lists.value].sort((a, b) => a.order - b.order))
const sortedFolders = computed(() => [...folders.value].filter(f => f.type === 'custom').sort((a, b) => a.order - b.order))

const folderLists = computed(() => {
  const fid = currentFolderIdFromPath.value
  if (!fid) return []
  return listStore.getListsInFolder(fid)
})
const sortedFolderLists = computed(() => [...folderLists.value].sort((a, b) => a.order - b.order))

const currentList = computed(() => listStore.taskLists.find(l => l.id === currentListIdFromPath.value))
const currentGroups = computed(() => {
  if (!currentList.value?.groups) return []
  return [...currentList.value.groups].sort((a, b) => a.order - b.order)
})
const currentSortedGroups = computed(() => currentGroups.value)

watch([navPath, sortedFolders, () => listStore.lists], () => {
  logger.debug('[ListPage] breadcrumb watch 触发', { navPath: [...navPath.value], foldersCount: sortedFolders.value.length, listsCount: listStore.lists?.length })
  localBreadcrumbSegments.value = computeBreadcrumbSegments()
  logger.debug('[ListPage] breadcrumb watch 结果', { segments: localBreadcrumbSegments.value })
  closeDropdown()
  scrollBreadcrumbToEnd()
}, { immediate: true, deep: true })

const smartListCount = computed(() => 3)

const getFolderListCount = (folderId: string) => listStore.getListsInFolder(folderId).length

const todayDate = computed(() => dayjs().format('YYYY-MM-DD'))
const todayTasks = computed(() => {
  const po = { high: 0, medium: 1, low: 2, none: 3 }
  return listStore.lists.filter(m => m.date === todayDate.value).sort((a, b) => {
    if (!a.endTime && b.endTime) return 1; if (a.endTime && !b.endTime) return -1
    if (!a.endTime && !b.endTime) return po[a.priority] - po[b.priority]
    const tc = a.endTime.localeCompare(b.endTime); if (tc !== 0) return tc
    return po[a.priority] - po[b.priority]
  })
})
const todayIncompleteTasks = computed(() => todayTasks.value.filter(m => !m.completed))
const todayTasksCount = computed(() => todayIncompleteTasks.value.length)

const isTaskOverdue = (m: Task) => {
  if (!m.date || m.completed) return false
  const md = dayjs(m.date)
  let targetTime = md
  if (m.endTime) { const [h, min] = m.endTime.split(':').map(Number); targetTime = md.hour(h).minute(min) }
  else { targetTime = md.endOf('day') }
  return targetTime.isBefore(dayjs())
}
const expiredTasks = computed(() => listStore.lists.filter(m => !m.completed && isTaskOverdue(m)))
const expiredTasksCount = computed(() => expiredTasks.value.length)
const futureTasks = computed(() => listStore.lists.filter(m => !m.completed && m.date && dayjs(m.date).isAfter(dayjs(), 'day') && dayjs(m.date).isBefore(dayjs().add(8, 'day'))))
const futureTasksCount = computed(() => futureTasks.value.length)

const smartDetailTasks = computed(() => {
  if (!isSmartDetail.value) return []
  const type = navPath.value[2]
  if (type === 'today') return sortTasks(todayIncompleteTasks.value)
  if (type === 'expired') return sortTasks(expiredTasks.value)
  if (type === 'future') return sortTasks(futureTasks.value)
  return []
})
const smartDetailIsToday = computed(() => navPath.value.length === 3 && navPath.value[0] === 'list' && navPath.value[1] === 'smart' && navPath.value[2] === 'today')
const smartDetailIsExpired = computed(() => navPath.value.length === 3 && navPath.value[0] === 'list' && navPath.value[1] === 'smart' && navPath.value[2] === 'expired')
const smartDetailIsFuture = computed(() => navPath.value.length === 3 && navPath.value[0] === 'list' && navPath.value[1] === 'smart' && navPath.value[2] === 'future')
const smartDetailCardContext = computed(() => smartDetailIsToday.value ? 'today' : 'default')
const smartDetailEmptyText = computed(() => {
  if (smartDetailIsToday.value) return '今天没有任务，好好休息吧'
  if (smartDetailIsExpired.value) return '没有已过期的任务'
  return '未来七天没有任务'
})

const currentGroupTasks = computed(() => {
  if (!currentGroupIdFromPath.value) return []
  return sortTasks(listStore.lists.filter(m => m.groupId === currentGroupIdFromPath.value && !m.completed))
})

const getListTaskCount = (listId: string) => listStore.lists.filter(m => m.listId === listId && !m.completed).length
const getListGroupCount = (listId: string) => listStore.taskLists.find(l => l.id === listId)?.groups.length || 0
const getGroupTaskCount = (groupId: string) => listStore.lists.filter(m => m.groupId === groupId && !m.completed).length

const isDefaultGroup = (groupId: string) => {
  if (!currentList.value) return false
  const sorted = currentGroups.value
  return sorted.length > 0 && sorted[0].id === groupId
}

const initTaskState = async () => {
  logger.debug('[ListPage] initTaskState 开始', { navPath: pageNav.navPath.value })
  const currentPath = pageNav.navPath.value
  if (currentPath.length > 1) {
    logger.debug('[ListPage] initTaskState 已有深层路径，跳过恢复', { currentPath })
    return
  }
  const restoredPath = await restoreModuleNavPath('list')
  logger.debug('[ListPage] initTaskState 恢复的路径', { restoredPath, currentNavPath: currentPath })
  if (restoredPath.length > 1) {
    pageNav.setNavPath(restoredPath)
    logger.debug('[ListPage] initTaskState 已恢复深度路径', { navPath: pageNav.navPath.value })
  } else {
    logger.debug('[ListPage] initTaskState 无需恢复', { navPath: pageNav.navPath.value })
  }
}

onMounted(async () => {
  logger.debug('[ListPage] onMounted 开始', { navPath: pageNav.navPath.value, isLoaded: listStore.isLoaded })
  if (pageNav.navPath.value.length === 0 || pageNav.navPath.value[0] !== 'list') {
    logger.debug('[ListPage] onMounted guard触发：navPath为空或非list，设为[list]', { prev: pageNav.navPath.value })
    pageNav.setNavPath(['list'])
    logger.debug('[ListPage] onMounted guard后 navPath', { navPath: pageNav.navPath.value })
  } else {
    logger.debug('[ListPage] onMounted guard未触发：navPath已是list', { navPath: pageNav.navPath.value })
  }
  logger.debug('[ListPage] onMounted 调用 loadData 前', { isLoaded: listStore.isLoaded })
  await listStore.loadData()
  logger.debug('[ListPage] onMounted loadData 完成', { isLoaded: listStore.isLoaded, listsCount: listStore.lists?.length })
  await loadFavorites()
  await initTaskState()
  logger.debug('[ListPage] onMounted 结束', { navPath: pageNav.navPath.value, showBreadcrumb: showBreadcrumb.value, isTaskRoot: isTaskRoot.value })
})

const showFolderDialog = ref(false)
const folderFormName = ref('')
const folderFormColor = ref(DEFAULT_FOLDER_COLORS[0])

const showListDialog = ref(false)
const showGroupDialog = ref(false)
const showTaskDialog = ref(false)
const showMoveDialog = ref(false)
const showConfirmDialog = ref(false)

const dialogFolder = ref<TaskFolder | null>(null)
const dialogList = ref<ListPage | null>(null)
const dialogGroup = ref<TaskGroup | null>(null)

const moveTaskId = ref('')
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
let pendingConfirmAction: (() => void) | null = null



const handleAddFolder = () => { dialogFolder.value = null; folderFormName.value = ''; folderFormColor.value = DEFAULT_FOLDER_COLORS[0]; showFolderDialog.value = true }
const handleAddList = () => { dialogList.value = null; showListDialog.value = true }

const handleEditFolder = (folder: TaskFolder) => { dialogFolder.value = folder; folderFormName.value = folder.name; folderFormColor.value = folder.color; showFolderDialog.value = true }

const handleDeleteFolder = (folder: TaskFolder) => {
  confirmDialogTitle.value = '删除文件夹'
  confirmDialogMessage.value = `确定要删除文件夹「${folder.name}」吗？`
  pendingConfirmAction = async () => {
    await listStore.deleteFolder(folder.id)
    ElMessage.success('文件夹已删除')
    if (pageNav.navPath.value[0] === 'list' && pageNav.navPath.value[1] === 'custom' && pageNav.navPath.value[2] === folder.id) {
      pageNav.setNavPath(['list', 'custom'])
    }
  }
  showConfirmDialog.value = true
}

const handleEditListCard = (list: ListPage) => { dialogList.value = list; showListDialog.value = true }

const handleDeleteListCard = (list: ListPage) => {
  const listCount = getListTaskCount(list.id)
  confirmDialogTitle.value = '删除清单'
  confirmDialogMessage.value = `确定要删除清单「${list.name}」吗？${listCount > 0 ? `该清单下有 ${listCount} 个任务，将一起被删除。` : ''}`
  pendingConfirmAction = async () => {
    await listStore.deleteList(list.id)
    ElMessage.success('清单已删除')
    if (pageNav.navPath.value.length >= 4 && pageNav.navPath.value[3] === list.id) {
      const folderId = pageNav.navPath.value[2]
      pageNav.setNavPath(['list', 'custom', folderId])
    }
  }
  showConfirmDialog.value = true
}

const handleAddGroupToCurrent = () => { dialogGroup.value = null; showGroupDialog.value = true }
const handleEditGroupCard = (group: TaskGroup) => { dialogGroup.value = group; showGroupDialog.value = true }

const handleDeleteGroupCard = (group: TaskGroup) => {
  confirmDialogTitle.value = '删除分组'
  confirmDialogMessage.value = `确定要删除分组「${group.name}」吗？`
  pendingConfirmAction = async () => {
    const listId = currentListIdFromPath.value
    if (!listId) return
    await listStore.deleteGroupFromList(listId, group.id)
    ElMessage.success('分组已删除')
  }
  showConfirmDialog.value = true
}

const handleOpenAddTaskAtCurrent = () => {
  const listId = currentListIdFromPath.value
  const groupId = currentGroupIdFromPath.value
  if (listId && groupId) { showTaskDialog.value = true }
}

const deleteTask = async (list: Task) => {
  const hadReminder = list.reminderStrategy !== 'none' && list.date
  await listStore.deleteTask(list.id)
  ElMessage.success('任务已删除')
  if (hadReminder) refreshReminders()
}

const closeFolderDialog = () => { showFolderDialog.value = false; dialogFolder.value = null }
const closeListDialog = () => { showListDialog.value = false; dialogList.value = null }
const closeGroupDialog = () => { showGroupDialog.value = false; dialogGroup.value = null }
const closeTaskDialog = () => { showTaskDialog.value = false }
const closeMoveDialog = () => { showMoveDialog.value = false; moveTaskId.value = '' }
const closeConfirmDialog = () => { showConfirmDialog.value = false; pendingConfirmAction = null }

const onFolderFormSubmit = async () => {
  const name = folderFormName.value.trim()
  if (!name) return
  const color = folderFormColor.value.trim() || DEFAULT_FOLDER_COLORS[0]
  if (dialogFolder.value) {
    await listStore.updateFolder(dialogFolder.value.id, { name, color })
    ElMessage.success('文件夹已更新')
  } else {
    await listStore.addFolder(name, color)
    ElMessage.success('文件夹已创建')
  }
  closeFolderDialog()
}

const onListSubmit = (data: Record<string, unknown>) => {
  if (dialogList.value) {
    listStore.updateList(dialogList.value.id, { name: data.name as string, color: data.color as string })
    ElMessage.success('清单已更新')
  } else {
    listStore.addList(data.name as string, data.color as string)
    ElMessage.success('清单已创建')
  }
  closeListDialog()
}

const onGroupSubmit = (data: Record<string, unknown>) => {
  if (dialogGroup.value) {
    listStore.updateGroupInList(data.listId as string, data.groupId as string, { name: data.name as string, color: data.color as string })
    ElMessage.success('分组已更新')
  } else {
    listStore.addGroupToList(data.listId as string, data.name as string, data.color as string)
    ElMessage.success('分组已创建')
  }
  closeGroupDialog()
}

const onTaskSubmit = async (data: Record<string, unknown>) => {
  const hasReminder = (data.reminderStrategy as string) !== 'none' && !!data.date
  await listStore.addTask({
    ...data,
    listId: (data.listId || currentListIdFromPath.value) as string,
    groupId: (data.groupId || currentGroupIdFromPath.value) as string,
    endTime: data.time as string || '',
    repeatCount: data.repeatEndCount as number || 1,
  } as any)
  ElMessage.success('任务已添加')
  closeTaskDialog()
  if (hasReminder) refreshReminders()
}

const onMoveSubmit = async (data: Record<string, unknown>) => {
  await listStore.updateTask(moveTaskId.value, { listId: data.listId as string, groupId: data.groupId as string })
  ElMessage.success('任务已移动')
  closeMoveDialog()
}

const handleConfirmAction = () => {
  if (pendingConfirmAction) { pendingConfirmAction(); pendingConfirmAction = null }
  showConfirmDialog.value = false
}
</script>

<style scoped>
.list-container { display: flex; flex-direction: column; height: 100%; position: relative; }

.list-breadcrumb-bar {
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

.breadcrumb-fav-btn, .breadcrumb-quick-btn {
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

.breadcrumb-fav-btn:hover, .breadcrumb-quick-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.breadcrumb-fav-btn.active {
  color: var(--chalk-warning);
}

.page-dropdown-empty {
  padding: 12px;
  text-align: center;
  color: var(--chalk-muted);
  font-size: 13px;
}

.breadcrumb-sort-btn {
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

.breadcrumb-sort-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
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

.main-content { flex: 1; min-height: 0; }
.main-content :deep(.el-scrollbar) { height: 100%; }
.main-content :deep(.el-scrollbar__view) { min-height: 100%; padding: 24px 0; }
.main-content :deep(.el-scrollbar__bar) { display: none; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 0; }

.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; width: 80%; margin: 0 auto; }
.card-grid-root { width: 80%; }
.card-grid-root.grid-4cols { grid-template-columns: repeat(4, 1fr); }
.card-grid-root.grid-2cols { grid-template-columns: repeat(2, 1fr); }
.card-grid.grid-2cols { grid-template-columns: repeat(2, 1fr); }
.folder-card { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 16px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; cursor: pointer; transition: all 0.2s; position: relative; }
.folder-card:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(102, 126, 234, 0.3); transform: translateY(-2px); }
.folder-card-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #fff; background: rgba(102, 126, 234, 0.6); }
.folder-card-icon.smart-icon-bg { background: rgba(102, 126, 234, 0.6); }
.folder-card-icon.custom-icon-bg { background: rgba(244, 114, 182, 0.6); }
.folder-card-icon.today-icon-bg { background: rgba(34, 197, 94, 0.6); }
.folder-card-icon.expired-icon-bg { background: rgba(239, 68, 68, 0.6); }
.folder-card-icon.future-icon-bg { background: rgba(59, 130, 246, 0.6); }
.folder-card-name { font-size: 15px; font-weight: 500; color: var(--chalk-white); text-align: center; }
.folder-card-hint { font-size: 12px; color: var(--chalk-dim); text-align: center; }
.folder-card-count { font-size: 12px; color: var(--chalk-dim); padding: 2px 10px; background: rgba(255, 255, 255, 0.08); border-radius: 10px; }

.card-top-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 2px; z-index: 2; }
.card-icon-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; background: transparent; color: var(--chalk-white-60); cursor: pointer; border-radius: 4px; font-size: 12px; transition: all 0.15s; }
.card-icon-btn:hover { background: rgba(255, 255, 255, 0.1); color: var(--chalk-white); }
.card-icon-btn.danger:hover { color: var(--chalk-danger); }

.folder-card.has-actions { padding-top: 44px; }

.list-list, .today-lists, .smart-lists { width: 80%; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
.list-list.grid-2cols, .today-lists.grid-2cols, .smart-lists.grid-2cols { display: block; column-count: 2; column-gap: 8px; }
.list-list.grid-2cols :deep(.list-card), .today-lists.grid-2cols :deep(.list-card), .smart-lists.grid-2cols :deep(.list-card) { break-inside: avoid; margin-bottom: 8px; }

:deep(.el-empty__description) { color: var(--chalk-muted); }

.dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; overflow-y: auto; }
.list-dialog-overlay { flex-direction: column; justify-content: flex-start; align-items: center; padding: 20px 0; }
.list-dialog-overlay::before { content: none; }
.list-dialog-overlay::after { content: none; }

.dialog-container { background: rgba(30, 28, 52, 0.98); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); width: 210px; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; }
.list-add-dialog { max-height: none; margin-top: auto; margin-bottom: auto; }
.confirm-dialog-container { width: 380px; text-align: center; padding: 32px; }
.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; flex-shrink: 0; }
.dialog-header-title { font-size: 16px; font-weight: 600; color: var(--chalk-white); }
.folder-dialog-header { justify-content: center; }
.folder-dialog-title { text-align: center; }
.folder-form { display: flex; flex-direction: column; gap: 16px; }
.folder-form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 8px; }
.folder-form :deep(.el-input__wrapper) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
.folder-form :deep(.el-input__inner) { color: #fff; }
.folder-form :deep(.el-input__inner::placeholder) { color: rgba(255, 255, 255, 0.4); }

.folder-color-dialog { width: 380px; }
.folder-color-section { display: flex; flex-direction: column; gap: 8px; }
.folder-color-label { font-size: 13px; color: var(--chalk-dim); }
.folder-color-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
.folder-color-swatch { width: 100%; aspect-ratio: 1; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; box-sizing: border-box; }
.folder-color-swatch:hover { transform: scale(1.15); }
.folder-color-swatch.selected { border-color: #fff; transform: scale(1.15); box-shadow: 0 0 8px rgba(255, 255, 255, 0.3); }
.folder-color-custom { display: flex; align-items: center; gap: 10px; }
.folder-color-input { width: 140px; }
.dialog-close-btn { font-size: 18px; color: var(--chalk-muted); padding: 0; min-width: auto; width: 28px; height: 28px; }
.dialog-close-btn:hover { color: var(--chalk-white-90); background: rgba(255, 255, 255, 0.08); border-radius: 6px; }
.dialog-body { flex: 1; overflow-y: auto; padding: 8px 20px 20px; }
.confirm-icon { text-align: center; margin-bottom: 12px; }
.warning-icon { font-size: 48px; color: var(--chalk-orange); }
.confirm-title { font-size: 18px; font-weight: 600; color: var(--chalk-white); margin: 0 0 12px 0; }
.confirm-message { font-size: 14px; color: var(--chalk-white-70); margin: 0 0 24px 0; line-height: 1.6; }
.confirm-actions { display: flex; gap: 12px; justify-content: center; }
.confirm-actions :deep(.el-button) { padding: 8px 24px; font-size: 14px; border-radius: 8px; }
.confirm-actions :deep(.el-button--danger) { background: #ef4444; border-color: #ef4444; }
.confirm-actions :deep(.el-button--danger:hover) { background: #dc2626; border-color: #dc2626; }
</style>