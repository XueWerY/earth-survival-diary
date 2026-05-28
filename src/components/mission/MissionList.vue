<template>
  <div class="mission-container">
    <div v-if="showBreadcrumb" class="mission-breadcrumb-bar">
      <button class="breadcrumb-module" @click="pageNav.setNavPath(['mission'])" title="回到清单首页">📋</button>
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
      <button v-if="plusAction" class="breadcrumb-plus-btn" @click="plusAction" title="添加"><el-icon><PlusIcon /></el-icon></button>
    </div>

    <div v-if="activeDropdown === 'segment'" class="page-dropdown" :style="dropdownPosStyle" @click.stop>
      <div v-for="item in segmentDropdownItems" :key="item.id" class="page-dropdown-item" :class="{ current: item.current }" @click="handleSegmentDropdownSelect(item)">
        <span class="page-dropdown-dot" :style="{ background: item.color }"></span>
        <span>{{ item.name }}</span>
      </div>
    </div>

    <div class="main-content" @click="closeDropdown">
      <el-scrollbar>

        <div v-if="isMissionRoot" class="card-grid card-grid-root" :class="isElectron ? 'grid-4cols' : 'grid-2cols'">
          <div class="folder-card has-actions" @click="pageNav.setNavPath(['mission', 'smart'])">
            <div class="folder-card-icon smart-icon-bg"><el-icon><List /></el-icon></div>
            <span class="folder-card-name">智能清单</span>
            <span class="folder-card-count">{{ smartListCount }}个清单</span>
          </div>
          <div v-for="folder in sortedFolders" :key="folder.id" class="folder-card has-actions" @click="pageNav.setNavPath(['mission', 'custom', folder.id])">
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
          <div class="card-grid">
            <div class="folder-card" @click="pageNav.setNavPath(['mission', 'smart', 'today'])">
              <div class="folder-card-icon today-icon-bg"><el-icon><Calendar /></el-icon></div>
              <span class="folder-card-name">今天</span>
              <span class="folder-card-count">{{ todayMissionsCount }}个任务</span>
            </div>
            <div class="folder-card" @click="pageNav.setNavPath(['mission', 'smart', 'expired'])">
              <div class="folder-card-icon expired-icon-bg"><el-icon><Clock /></el-icon></div>
              <span class="folder-card-name">已过期</span>
              <span class="folder-card-count">{{ expiredMissionsCount }}个任务</span>
            </div>
            <div class="folder-card" @click="pageNav.setNavPath(['mission', 'smart', 'future'])">
              <div class="folder-card-icon future-icon-bg"><el-icon><Timer /></el-icon></div>
              <span class="folder-card-name">未来七天</span>
              <span class="folder-card-count">{{ futureMissionsCount }}个任务</span>
            </div>
          </div>
        </template>

        <template v-else-if="isSmartDetail">
          <el-empty v-if="smartDetailMissions.length === 0" :description="smartDetailEmptyText" :image-size="120" />
          <div v-else :class="[smartDetailIsToday ? 'today-missions' : 'smart-missions', isElectron ? 'grid-2cols' : 'grid-1cols']">
              <MissionCard v-for="mission in smartDetailMissions" :key="mission.id" :mission="mission" :context="smartDetailCardContext" @delete="deleteMission" />
            </div>
        </template>

        <template v-else-if="isCustomOverview">
          <el-empty v-if="sortedFolders.length === 0" description="还没有自定义文件夹" :image-size="120" />
          <div v-else class="card-grid">
            <div v-for="folder in sortedFolders" :key="folder.id" class="folder-card has-actions" @click="pageNav.setNavPath(['mission', 'custom', folder.id])">
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
          <div v-else class="card-grid">
            <div v-for="list in sortedFolderLists" :key="list.id" class="folder-card has-actions" @click="pageNav.setNavPath(['mission', 'custom', currentFolderIdFromPath, list.id])">
              <div class="card-top-actions" @click.stop>
                <button class="card-icon-btn" title="编辑清单" @click="handleEditListCard(list)"><el-icon><Edit /></el-icon></button>
                <button class="card-icon-btn danger" title="删除清单" @click="handleDeleteListCard(list)"><el-icon><Delete /></el-icon></button>
              </div>
              <div class="folder-card-icon" :style="{ background: list.color }">
                <el-icon><Folder /></el-icon>
              </div>
              <span class="folder-card-name">{{ list.name }}</span>
              <span class="folder-card-count">{{ getListGroupCount(list.id) }}个分组{{ getListMissionCount(list.id) }}个任务</span>
            </div>
          </div>
        </template>

        <template v-else-if="isListView">
          <el-empty v-if="currentGroups.length === 0" description="还没有分组" :image-size="120" />
          <div v-else class="card-grid">
            <div v-for="group in currentSortedGroups" :key="group.id" class="folder-card has-actions" @click="pageNav.setNavPath(['mission', 'custom', currentFolderIdFromPath, currentListIdFromPath, group.id])">
              <div class="card-top-actions" @click.stop>
                <button class="card-icon-btn" title="编辑分组" @click="handleEditGroupCard(group)"><el-icon><Edit /></el-icon></button>
                <button v-if="!isDefaultGroup(group.id)" class="card-icon-btn danger" title="删除分组" @click="handleDeleteGroupCard(group)"><el-icon><Delete /></el-icon></button>
              </div>
              <div class="folder-card-icon" :style="{ background: group.color }">
                <el-icon><Folder /></el-icon>
              </div>
              <span class="folder-card-name">{{ group.name }}</span>
              <span class="folder-card-count">{{ getGroupMissionCount(group.id) }} 个任务</span>
            </div>
          </div>
        </template>

        <template v-else-if="isGroupTasksView">
          <el-empty v-if="currentGroupMissions.length === 0" description="暂无任务" :image-size="120" />
          <div v-else class="mission-list" :class="isElectron ? 'grid-2cols' : 'grid-1cols'">
            <MissionCard v-for="mission in currentGroupMissions" :key="mission.id" :mission="mission" context="custom-list" @delete="deleteMission" />
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

  <Teleport v-if="showMissionDialog" to="body">
    <div class="dialog-overlay mission-dialog-overlay" @click.self="closeMissionDialog">
      <div class="dialog-container folder-color-dialog mission-add-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">添加任务</span>
        </div>
        <div class="dialog-body">
          <MissionForm :list-id="missionDialogListId" :group-id="missionDialogGroupId" @submit="onMissionSubmit" @cancel="closeMissionDialog" />
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
        <MoveMissionPage :mission-id="moveMissionId" @submit="onMoveSubmit" @cancel="closeMoveDialog" />
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
import { Calendar, Clock, Timer, Close, Warning, Edit, Plus as PlusIcon, Delete, List, Folder, Check } from '@element-plus/icons-vue'
import ListFormPage from './ListFormPage.vue'
import GroupFormPage from './GroupFormPage.vue'
import MissionForm from './MissionForm.vue'
import MissionCard from './MissionCard.vue'
import MoveMissionPage from './MoveMissionPage.vue'
import dayjs from 'dayjs'
import { useMissionStore, DEFAULT_FOLDER_COLORS, EXTENDED_FOLDER_COLORS, type Mission, type MissionList, type MissionGroup, type MissionFolder } from '../../stores/missionStore'
import { usePageNav, restoreModuleNavPath, type BreadcrumbSegment, type DropdownItem } from '../../composables/usePageNav'
import { logger } from '../../lib/logger'

const pageNav = usePageNav()

const missionStore = useMissionStore()

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

const isMissionRoot = computed(() => {
  const result = navPath.value.length === 1 && navPath.value[0] === 'mission'
  logger.debug('[MissionList] isMissionRoot 计算', { navPath: [...navPath.value], result })
  return result
})
const isSmartOverview = computed(() => navPath.value.length === 2 && navPath.value[0] === 'mission' && navPath.value[1] === 'smart')
const isSmartDetail = computed(() => navPath.value.length === 3 && navPath.value[0] === 'mission' && navPath.value[1] === 'smart')
const isCustomOverview = computed(() => navPath.value.length === 2 && navPath.value[0] === 'mission' && navPath.value[1] === 'custom')
const isFolderView = computed(() => navPath.value.length === 3 && navPath.value[0] === 'mission' && navPath.value[1] === 'custom')
const isListView = computed(() => navPath.value.length === 4 && navPath.value[0] === 'mission' && navPath.value[1] === 'custom')
const isGroupTasksView = computed(() => navPath.value.length === 5 && navPath.value[0] === 'mission' && navPath.value[1] === 'custom')
const isAtSmartDetail = computed(() => navPath.value.length >= 3 && navPath.value[0] === 'mission' && navPath.value[1] === 'smart')

function computeBreadcrumbSegments(): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = []
  const path = pageNav.navPath.value

  if (path.length < 2 || path[0] !== 'mission') return segments

  const buildFolderDropdownItems = (): DropdownItem[] => {
    const items: DropdownItem[] = []
    const isSmart = path[1] === 'smart'
    items.push({
      id: 'smart', name: '智能清单', color: '#667eea', current: isSmart,
      onSelect: () => pageNav.setNavPath(['mission', 'smart'])
    })
    for (const f of sortedFolders.value) {
      const isCurrent = path[1] === 'custom' && path[2] === f.id
      items.push({
        id: f.id, name: f.name, color: f.color, current: isCurrent,
        onSelect: () => pageNav.setNavPath(['mission', 'custom', f.id])
      })
    }
    return items
  }

  const buildSmartItemsDropdown = (currentType: string): DropdownItem[] => [
    { id: 'today', name: '今天', color: '#22c55e', current: currentType === 'today', onSelect: () => pageNav.setNavPath(['mission', 'smart', 'today']) },
    { id: 'expired', name: '已过期', color: '#ef4444', current: currentType === 'expired', onSelect: () => pageNav.setNavPath(['mission', 'smart', 'expired']) },
    { id: 'future', name: '未来七天', color: '#3b82f6', current: currentType === 'future', onSelect: () => pageNav.setNavPath(['mission', 'smart', 'future']) },
  ]

  const buildListsDropdown = (folderId: string, currentListId: string): DropdownItem[] => {
    const rawLists = folderId ? missionStore.getListsInFolder(folderId) : []
    return [...rawLists].sort((a, b) => a.order - b.order).map(l => ({
      id: l.id, name: l.name, color: l.color, current: l.id === currentListId,
      onSelect: () => pageNav.setNavPath(['mission', 'custom', folderId, l.id])
    }))
  }

  const buildGroupsDropdown = (folderId: string, listId: string, currentGroupId: string): DropdownItem[] => {
    const rawList = listId ? missionStore.lists.find(l => l.id === listId) : undefined
    const rawGroups = rawList?.groups || []
    return [...rawGroups].sort((a, b) => a.order - b.order).map(g => ({
      id: g.id, name: g.name, color: g.color, current: g.id === currentGroupId,
      onSelect: () => pageNav.setNavPath(['mission', 'custom', folderId, listId, g.id])
    }))
  }

  if (path[1] === 'smart') {
    segments.push({
      label: '智能清单',
      color: '#667eea',
      clickable: true,
      onClick: () => pageNav.setNavPath(['mission', 'smart']),
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
        onClick: () => pageNav.setNavPath(['mission', 'smart', type]),
        dropdownItems: buildSmartItemsDropdown(type)
      })
    }
  } else if (path[1] === 'custom') {
    if (path.length === 2) {
      segments.push({
        label: '自定义清单',
        color: '#667eea',
        clickable: true,
        onClick: () => pageNav.setNavPath(['mission', 'custom']),
        dropdownItems: buildFolderDropdownItems()
      })
    } else if (path.length >= 3) {
      const folder = sortedFolders.value.find(f => f.id === path[2])
      segments.push({
        label: folder?.name || '自定义清单',
        color: folder?.color || '#667eea',
        clickable: true,
        onClick: () => pageNav.setNavPath(['mission', 'custom', path[2]]),
        dropdownItems: buildFolderDropdownItems()
      })
      if (path.length >= 4) {
        const list = missionStore.lists.find(l => l.id === path[3])
        segments.push({
          label: list?.name || '',
          color: list?.color || '',
          clickable: true,
          onClick: () => pageNav.setNavPath(['mission', 'custom', path[2], path[3]]),
          dropdownItems: buildListsDropdown(path[2], path[3])
        })
        if (path.length >= 5) {
          const listForGroup = missionStore.lists.find(l => l.id === path[3])
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
  const result = path.length >= 1 && path[0] === 'mission'
  logger.debug('[MissionList] showBreadcrumb 计算', { path: [...path], result })
  return result
})

const plusAction = computed(() => {
  if (isMissionRoot.value) return handleAddFolder
  if (isFolderView.value) return handleAddList
  if (isCustomOverview.value) return handleAddFolder
  if (isListView.value) return handleAddGroupToCurrent
  if (isGroupTasksView.value) return handleOpenAddMissionAtCurrent
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

const currentFolderIdFromPath = computed(() => {
  if (navPath.value.length >= 3 && navPath.value[0] === 'mission' && navPath.value[1] === 'custom') return navPath.value[2]
  return ''
})
const currentListIdFromPath = computed(() => {
  if (navPath.value.length >= 4 && navPath.value[0] === 'mission' && navPath.value[1] === 'custom') return navPath.value[3]
  return ''
})
const currentGroupIdFromPath = computed(() => {
  if (navPath.value.length >= 5 && navPath.value[0] === 'mission' && navPath.value[1] === 'custom') return navPath.value[4]
  return ''
})

const currentListIdForDialog = computed(() => currentListIdFromPath.value)

const missionDialogListId = computed(() => currentListIdFromPath.value)
const missionDialogGroupId = computed(() => currentGroupIdFromPath.value)

const lists = computed(() => missionStore.lists)
const folders = computed(() => missionStore.folders)
const sortedLists = computed(() => [...lists.value].sort((a, b) => a.order - b.order))
const sortedFolders = computed(() => [...folders.value].filter(f => f.type === 'custom').sort((a, b) => a.order - b.order))

const folderLists = computed(() => {
  const fid = currentFolderIdFromPath.value
  if (!fid) return []
  return missionStore.getListsInFolder(fid)
})
const sortedFolderLists = computed(() => [...folderLists.value].sort((a, b) => a.order - b.order))

const currentList = computed(() => lists.value.find(l => l.id === currentListIdFromPath.value))
const currentGroups = computed(() => {
  if (!currentList.value?.groups) return []
  return [...currentList.value.groups].sort((a, b) => a.order - b.order)
})
const currentSortedGroups = computed(() => currentGroups.value)

watch([navPath, sortedFolders, () => missionStore.lists], () => {
  logger.debug('[MissionList] breadcrumb watch 触发', { navPath: [...navPath.value], foldersCount: sortedFolders.value.length, listsCount: missionStore.lists?.length })
  localBreadcrumbSegments.value = computeBreadcrumbSegments()
  logger.debug('[MissionList] breadcrumb watch 结果', { segments: localBreadcrumbSegments.value })
  closeDropdown()
  scrollBreadcrumbToEnd()
}, { immediate: true, deep: true })

const smartListCount = computed(() => 3)

const getFolderListCount = (folderId: string) => missionStore.getListsInFolder(folderId).length

const todayDate = computed(() => dayjs().format('YYYY-MM-DD'))
const todayMissions = computed(() => {
  const po = { high: 0, medium: 1, low: 2, none: 3 }
  return missionStore.missions.filter(m => m.date === todayDate.value).sort((a, b) => {
    if (!a.startTime && b.startTime) return 1; if (a.startTime && !b.startTime) return -1
    if (!a.startTime && !b.startTime) return po[a.priority] - po[b.priority]
    const tc = a.startTime.localeCompare(b.startTime); if (tc !== 0) return tc
    return po[a.priority] - po[b.priority]
  })
})
const todayIncompleteMissions = computed(() => todayMissions.value.filter(m => !m.completed))
const todayMissionsCount = computed(() => todayIncompleteMissions.value.length)

const isMissionOverdue = (m: Mission) => {
  if (!m.date || m.completed) return false
  const md = dayjs(m.date)
  let targetTime = md
  if (m.endTime) { const [h, min] = m.endTime.split(':').map(Number); targetTime = md.hour(h).minute(min) }
  else { targetTime = md.endOf('day') }
  return targetTime.isBefore(dayjs())
}
const expiredMissions = computed(() => missionStore.missions.filter(m => !m.completed && isMissionOverdue(m)))
const expiredMissionsCount = computed(() => expiredMissions.value.length)
const futureMissions = computed(() => missionStore.missions.filter(m => !m.completed && m.date && dayjs(m.date).isAfter(dayjs(), 'day') && dayjs(m.date).isBefore(dayjs().add(8, 'day'))))
const futureMissionsCount = computed(() => futureMissions.value.length)

const smartDetailMissions = computed(() => {
  if (!isSmartDetail.value) return []
  const type = navPath.value[2]
  if (type === 'today') return todayIncompleteMissions.value
  if (type === 'expired') return expiredMissions.value
  if (type === 'future') return futureMissions.value
  return []
})
const smartDetailIsToday = computed(() => navPath.value.length === 3 && navPath.value[0] === 'mission' && navPath.value[1] === 'smart' && navPath.value[2] === 'today')
const smartDetailIsExpired = computed(() => navPath.value.length === 3 && navPath.value[0] === 'mission' && navPath.value[1] === 'smart' && navPath.value[2] === 'expired')
const smartDetailIsFuture = computed(() => navPath.value.length === 3 && navPath.value[0] === 'mission' && navPath.value[1] === 'smart' && navPath.value[2] === 'future')
const smartDetailCardContext = computed(() => smartDetailIsToday.value ? 'today' : 'default')
const smartDetailEmptyText = computed(() => {
  if (smartDetailIsToday.value) return '今天没有任务，好好休息吧'
  if (smartDetailIsExpired.value) return '没有已过期的任务'
  return '未来七天没有任务'
})

const currentGroupMissions = computed(() => {
  if (!currentGroupIdFromPath.value) return []
  const po = { high: 0, medium: 1, low: 2, none: 3 }
  return missionStore.missions.filter(m => m.groupId === currentGroupIdFromPath.value && !m.completed).sort((a, b) => {
    if (!a.date && b.date) return 1; if (a.date && !b.date) return -1
    if (!a.date && !b.date) return po[a.priority] - po[b.priority]
    const dc = dayjs(a.date).valueOf() - dayjs(b.date).valueOf(); if (dc !== 0) return dc
    return po[a.priority] - po[b.priority]
  })
})

const getListMissionCount = (listId: string) => missionStore.missions.filter(m => m.listId === listId && !m.completed).length
const getListGroupCount = (listId: string) => lists.value.find(l => l.id === listId)?.groups.length || 0
const getGroupMissionCount = (groupId: string) => missionStore.missions.filter(m => m.groupId === groupId && !m.completed).length

const isDefaultGroup = (groupId: string) => {
  if (!currentList.value) return false
  const sorted = currentGroups.value
  return sorted.length > 0 && sorted[0].id === groupId
}

const initMissionState = async () => {
  logger.debug('[MissionList] initMissionState 开始', { navPath: pageNav.navPath.value })
  const currentPath = pageNav.navPath.value
  if (currentPath.length > 1) {
    logger.debug('[MissionList] initMissionState 已有深层路径，跳过恢复', { currentPath })
    return
  }
  const restoredPath = await restoreModuleNavPath('mission')
  logger.debug('[MissionList] initMissionState 恢复的路径', { restoredPath, currentNavPath: currentPath })
  if (restoredPath.length > 1) {
    pageNav.setNavPath(restoredPath)
    logger.debug('[MissionList] initMissionState 已恢复深度路径', { navPath: pageNav.navPath.value })
  } else {
    logger.debug('[MissionList] initMissionState 无需恢复', { navPath: pageNav.navPath.value })
  }
}

onMounted(async () => {
  logger.debug('[MissionList] onMounted 开始', { navPath: pageNav.navPath.value, isLoaded: missionStore.isLoaded })
  if (pageNav.navPath.value.length === 0 || pageNav.navPath.value[0] !== 'mission') {
    logger.debug('[MissionList] onMounted guard触发：navPath为空或非mission，设为[mission]', { prev: pageNav.navPath.value })
    pageNav.setNavPath(['mission'])
    logger.debug('[MissionList] onMounted guard后 navPath', { navPath: pageNav.navPath.value })
  } else {
    logger.debug('[MissionList] onMounted guard未触发：navPath已是mission', { navPath: pageNav.navPath.value })
  }
  logger.debug('[MissionList] onMounted 调用 loadData 前', { isLoaded: missionStore.isLoaded })
  await missionStore.loadData()
  logger.debug('[MissionList] onMounted loadData 完成', { isLoaded: missionStore.isLoaded, listsCount: missionStore.lists?.length })
  await initMissionState()
  logger.debug('[MissionList] onMounted 结束', { navPath: pageNav.navPath.value, showBreadcrumb: showBreadcrumb.value, isMissionRoot: isMissionRoot.value })
})

const showFolderDialog = ref(false)
const folderFormName = ref('')
const folderFormColor = ref(DEFAULT_FOLDER_COLORS[0])

const showListDialog = ref(false)
const showGroupDialog = ref(false)
const showMissionDialog = ref(false)
const showMoveDialog = ref(false)
const showConfirmDialog = ref(false)

const dialogFolder = ref<MissionFolder | null>(null)
const dialogList = ref<MissionList | null>(null)
const dialogGroup = ref<MissionGroup | null>(null)

const moveMissionId = ref('')
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
let pendingConfirmAction: (() => void) | null = null



const handleAddFolder = () => { dialogFolder.value = null; folderFormName.value = ''; folderFormColor.value = DEFAULT_FOLDER_COLORS[0]; showFolderDialog.value = true }
const handleAddList = () => { dialogList.value = null; showListDialog.value = true }

const handleEditFolder = (folder: MissionFolder) => { dialogFolder.value = folder; folderFormName.value = folder.name; folderFormColor.value = folder.color; showFolderDialog.value = true }

const handleDeleteFolder = (folder: MissionFolder) => {
  confirmDialogTitle.value = '删除文件夹'
  confirmDialogMessage.value = `确定要删除文件夹「${folder.name}」吗？`
  pendingConfirmAction = async () => {
    await missionStore.deleteFolder(folder.id)
    ElMessage.success('文件夹已删除')
    if (pageNav.navPath.value[0] === 'mission' && pageNav.navPath.value[1] === 'custom' && pageNav.navPath.value[2] === folder.id) {
      pageNav.setNavPath(['mission', 'custom'])
    }
  }
  showConfirmDialog.value = true
}

const handleEditListCard = (list: MissionList) => { dialogList.value = list; showListDialog.value = true }

const handleDeleteListCard = (list: MissionList) => {
  const missionCount = getListMissionCount(list.id)
  confirmDialogTitle.value = '删除清单'
  confirmDialogMessage.value = `确定要删除清单「${list.name}」吗？${missionCount > 0 ? `该清单下有 ${missionCount} 个任务，将一起被删除。` : ''}`
  pendingConfirmAction = async () => {
    await missionStore.deleteList(list.id)
    ElMessage.success('清单已删除')
    if (pageNav.navPath.value.length >= 4 && pageNav.navPath.value[3] === list.id) {
      const folderId = pageNav.navPath.value[2]
      pageNav.setNavPath(['mission', 'custom', folderId])
    }
  }
  showConfirmDialog.value = true
}

const handleAddGroupToCurrent = () => { dialogGroup.value = null; showGroupDialog.value = true }
const handleEditGroupCard = (group: MissionGroup) => { dialogGroup.value = group; showGroupDialog.value = true }

const handleDeleteGroupCard = (group: MissionGroup) => {
  confirmDialogTitle.value = '删除分组'
  confirmDialogMessage.value = `确定要删除分组「${group.name}」吗？`
  pendingConfirmAction = async () => {
    const listId = currentListIdFromPath.value
    if (!listId) return
    await missionStore.deleteGroupFromList(listId, group.id)
    ElMessage.success('分组已删除')
  }
  showConfirmDialog.value = true
}

const handleOpenAddMissionAtCurrent = () => {
  const listId = currentListIdFromPath.value
  const groupId = currentGroupIdFromPath.value
  if (listId && groupId) { showMissionDialog.value = true }
}

const deleteMission = async (mission: Mission) => {
  const hadReminder = mission.reminderStrategy !== 'none' && mission.date
  await missionStore.deleteMission(mission.id)
  ElMessage.success('任务已删除')
  if (hadReminder) refreshReminders()
}

const closeFolderDialog = () => { showFolderDialog.value = false; dialogFolder.value = null }
const closeListDialog = () => { showListDialog.value = false; dialogList.value = null }
const closeGroupDialog = () => { showGroupDialog.value = false; dialogGroup.value = null }
const closeMissionDialog = () => { showMissionDialog.value = false }
const closeMoveDialog = () => { showMoveDialog.value = false; moveMissionId.value = '' }
const closeConfirmDialog = () => { showConfirmDialog.value = false; pendingConfirmAction = null }

const onFolderFormSubmit = async () => {
  const name = folderFormName.value.trim()
  if (!name) return
  const color = folderFormColor.value.trim() || DEFAULT_FOLDER_COLORS[0]
  if (dialogFolder.value) {
    await missionStore.updateFolder(dialogFolder.value.id, { name, color })
    ElMessage.success('文件夹已更新')
  } else {
    await missionStore.addFolder(name, color)
    ElMessage.success('文件夹已创建')
  }
  closeFolderDialog()
}

const onListSubmit = (data: Record<string, unknown>) => {
  if (dialogList.value) {
    missionStore.updateList(dialogList.value.id, { name: data.name as string, color: data.color as string })
    ElMessage.success('清单已更新')
  } else {
    missionStore.addList(data.name as string, data.color as string)
    ElMessage.success('清单已创建')
  }
  closeListDialog()
}

const onGroupSubmit = (data: Record<string, unknown>) => {
  if (dialogGroup.value) {
    missionStore.updateGroupInList(data.listId as string, data.groupId as string, { name: data.name as string, color: data.color as string })
    ElMessage.success('分组已更新')
  } else {
    missionStore.addGroupToList(data.listId as string, data.name as string, data.color as string)
    ElMessage.success('分组已创建')
  }
  closeGroupDialog()
}

const onMissionSubmit = async (data: Record<string, unknown>) => {
  const hasReminder = data.reminderStrategy !== 'none' && data.date
  await missionStore.addMission({ ...data, listId: data.listId || currentListIdFromPath.value, groupId: data.groupId || currentGroupIdFromPath.value } as any)
  ElMessage.success('任务已添加')
  closeMissionDialog()
  if (hasReminder) refreshReminders()
}

const onMoveSubmit = async (data: Record<string, unknown>) => {
  await missionStore.updateMission(moveMissionId.value, { listId: data.listId as string, groupId: data.groupId as string })
  ElMessage.success('任务已移动')
  closeMoveDialog()
}

const handleConfirmAction = () => {
  if (pendingConfirmAction) { pendingConfirmAction(); pendingConfirmAction = null }
  showConfirmDialog.value = false
}
</script>

<style scoped>
.mission-container { display: flex; flex-direction: column; height: 100%; position: relative; }

.mission-breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  z-index: 20;
  min-height: 40px;
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

.main-content { flex: 1; min-height: 0; }
.main-content :deep(.el-scrollbar) { height: 100%; }
.main-content :deep(.el-scrollbar__view) { min-height: 100%; padding: 24px 0; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 0; }

.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; width: 80%; margin: 0 auto; }
.card-grid-root { width: 80%; }
.card-grid-root.grid-4cols { grid-template-columns: repeat(4, 1fr); }
.card-grid-root.grid-2cols { grid-template-columns: 1fr; }
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

.mission-list, .today-missions, .smart-missions { width: 80%; margin: 0 auto; column-count: 2; column-gap: 8px; }
.mission-list.grid-1cols, .today-missions.grid-1cols, .smart-missions.grid-1cols { column-count: 1; }
.mission-list :deep(.mission-card), .today-missions :deep(.mission-card), .smart-missions :deep(.mission-card) { break-inside: avoid; margin-bottom: 8px; }

:deep(.el-empty__description) { color: var(--chalk-muted); }

.dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; overflow-y: auto; }
.mission-dialog-overlay { flex-direction: column; justify-content: flex-start; align-items: center; padding: 20px 0; }
.mission-dialog-overlay::before { content: none; }
.mission-dialog-overlay::after { content: none; }

.dialog-container { background: rgba(30, 28, 52, 0.98); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); width: 210px; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; }
.mission-add-dialog { max-height: none; margin-top: auto; margin-bottom: auto; }
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