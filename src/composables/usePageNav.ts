import { ref, computed, watch, nextTick } from 'vue'
import type { Ref } from 'vue'
import {
  MapPin, Notebook, List, Clock, Calendar, BarChart3, LayoutGrid, User
} from '@lucide/vue'
import { getSystemStateField, setSystemStateField, type SystemState } from '../services/storageService'
import { useListStore } from '../stores/listStore'
import { useNoteStore } from '../stores/noteStore'
import { logger } from '../lib/logger'
import { getCountdownCategoryLabel } from '../utils/navPathLabels'

export interface DropdownItem {
  id: string
  name: string
  color: string
  current: boolean
  onSelect: () => void
}

export interface FavoriteItem {
  id: string
  name: string
  navPath: string[]
}

export interface BreadcrumbSegment {
  label: string
  color: string
  clickable: boolean
  onClick: (() => void) | null
  dropdownItems: DropdownItem[] | null
}

export interface NavAction {
  icon: string
  onClick: () => void
  title: string
}

export interface NavContext {
  segments: BreadcrumbSegment[]
  plusVisible: boolean
  plusOnClick: (() => void) | null
  goModuleHome: () => void
  actions?: NavAction[]
}

export const MODULES = ['footprint', 'notes', 'list', 'countdown', 'course', 'statistics', 'toolbox', 'profile']

export const MODULE_ICONS: Record<string, any> = {
  footprint: MapPin, notes: Notebook, list: List, countdown: Clock, course: Calendar, statistics: BarChart3, toolbox: LayoutGrid, profile: User
}

export const MODULE_LABELS: Record<string, string> = {
  footprint: '足迹', notes: '笔记', list: '清单', countdown: '倒数日', course: '课程表', statistics: '统计', toolbox: '工具箱', profile: '我的'
}

export const MODULE_ROUTES: Record<string, string> = {
  footprint: '/footprint', notes: '/notes', list: '/list', countdown: '/countdown', course: '/course', statistics: '/statistics', toolbox: '/toolbox', profile: '/profile'
}

const MODULE_PERSIST_KEYS: Partial<Record<string, keyof SystemState>> = {
  list: 'list',
  countdown: 'countdown',
  notes: 'notes'
}

const NAV_PATH_SEGMENT_LABELS: Record<string, string> = {
  smart: '智能清单', custom: '自定义清单', all: '全部', __all__: '全部',
  today: '今天', expired: '已过期', future: '未来七天', recent: '最近',
  favorites: '收藏', trash: '回收站', archived: '归档',
  birthday: '生日', anniversary: '纪念日', holiday: '节日', travel: '旅行',
  entertainment: '娱乐', work: '工作', study: '学习', life: '生活'
}

export interface NavState {
  navPath: Ref<string[]>
  navContext: Ref<NavContext>
  currentModule: Ref<string>
  moduleIcon: Ref<string>
  moduleLabel: Ref<string>
  setNavPath: (path: string[]) => void
  setNavContext: (ctx: NavContext) => void
  goModuleHome: () => void
}

function createNavState(): NavState {
  const navPath: Ref<string[]> = ref([])
  const navContext: Ref<NavContext> = ref({
    segments: [],
    plusVisible: false,
    plusOnClick: null,
    goModuleHome: () => {}
  })
  const currentModule = computed(() => navPath.value[0] || '')
  const moduleIcon = computed(() => MODULE_ICONS[currentModule.value] || '')
  const moduleLabel = computed(() => MODULE_LABELS[currentModule.value] || '')

  const describeNavPath = (path: string[]) => {
    if (path[0] === 'notes' && path.length > 1) {
      try {
        const noteStore = useNoteStore()
        const noteTagLabels: Record<string, string> = {
          personal: '个人',
          work: '工作',
          guide: '攻略',
          study: '学习'
        }
        return path
          .map((segment, index) => {
            if (index === 0) return MODULE_LABELS[segment] || segment
            if (noteTagLabels[segment]) return noteTagLabels[segment]
            if (NAV_PATH_SEGMENT_LABELS[segment]) return NAV_PATH_SEGMENT_LABELS[segment]
            const note = noteStore.notes.find(item => item.id === segment)
            if (note) return note.title?.trim() || '无标题'
            const tag = noteStore.tags.find(item => item.id === segment)
            return tag?.name || segment
          })
          .join(' / ')
      } catch {}
    }

    if (path[0] === 'list' && path[1] === 'custom' && path.length > 2) {
      let folderName = path[2] || ''
      let listName = path[3] || ''
      let groupName = path[4] || ''

      try {
        const listStore = useListStore()
        folderName = listStore.folders.find(folder => folder.id === path[2])?.name || folderName

        const list = path[3]
          ? listStore.taskLists.find(item => item.id === path[3])
          : undefined
        listName = list?.name || listName
        groupName = list?.groups.find(group => group.id === path[4])?.name || groupName
      } catch {}

      const labels = [MODULE_LABELS.list, folderName]
      if (path[3]) labels.push(listName)
      if (path[4]) labels.push(groupName)
      return labels.join(' / ')
    }

    return path
      .map((segment, index) => {
        if (index === 0) return MODULE_LABELS[segment] || segment
        if (path[0] === 'countdown' && index === 1) return getCountdownCategoryLabel(segment) || NAV_PATH_SEGMENT_LABELS[segment] || segment
        return NAV_PATH_SEGMENT_LABELS[segment] || segment
      })
      .join(' / ') || '未设置'
  }

  let pendingNavPathLog: { previousPath: string[]; path: string[] } | null = null
  let stopWaitingForListData: (() => void) | null = null

  function setNavPath(path: string[]) {
    const previousPath = navPath.value
    const unchanged = previousPath.length === path.length && previousPath.every((segment, index) => segment === path[index])
    if (!unchanged) {
      const listStore = path[0] === 'list' && path[1] === 'custom' ? useListStore() : null
      if (listStore && !listStore.isLoaded) {
        const firstPreviousPath = pendingNavPathLog?.previousPath || [...previousPath]
        pendingNavPathLog = { previousPath: firstPreviousPath, path: [...path] }
        if (!stopWaitingForListData) {
          stopWaitingForListData = watch(
            () => listStore.isLoaded,
            isLoaded => {
              if (!isLoaded || !pendingNavPathLog) return
              const pending = pendingNavPathLog
              pendingNavPathLog = null
              stopWaitingForListData?.()
              stopWaitingForListData = null
              logger.debug(`[PageNav] 导航路径更新：${describeNavPath(pending.previousPath)} → ${describeNavPath(pending.path)}`)
            }
          )
        }
      } else {
        const fromPath = pendingNavPathLog?.previousPath || previousPath
        pendingNavPathLog = null
        stopWaitingForListData?.()
        stopWaitingForListData = null
        logger.debug(`[PageNav] 导航路径更新：${describeNavPath(fromPath)} → ${describeNavPath(path)}`)
      }
    }
    navPath.value = path
  }

  function goModuleHome() {
    const module = currentModule.value
    if (module) {
      setNavPath([])
      nextTick(() => setNavPath([module]))
    }
  }

  function setNavContext(ctx: NavContext) {
    navContext.value = ctx
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  watch(navPath, async () => {
      const module = currentModule.value
      const key = MODULE_PERSIST_KEYS[module]
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(async () => {
        if (key) {
          const existing = (await getSystemStateField(key)) as Record<string, any> | undefined
          await setSystemStateField(key, { ...(existing || {}), navPath: navPath.value } as any)
        }
      }, 300)
    }, { deep: true })

  return { navPath, navContext, currentModule, moduleIcon, moduleLabel, setNavPath, setNavContext, goModuleHome }
}

const defaultState = createNavState()

export function usePageNav(): NavState & typeof moduleConstants {
  return {
    ...defaultState,
    MODULES, MODULE_ICONS, MODULE_LABELS, MODULE_ROUTES,
  }
}

const moduleConstants = { MODULES, MODULE_ICONS, MODULE_LABELS, MODULE_ROUTES }

export async function restoreModuleNavPath(module: string): Promise<string[]> {
  const key = MODULE_PERSIST_KEYS[module]
  if (!key) {
    return [module]
  }
  try {
    const parsed = (await getSystemStateField(key)) as Record<string, any> | undefined
    if (parsed?.navPath && Array.isArray(parsed.navPath)) {
      if (parsed.navPath.length > 0 && parsed.navPath[0] === module) {
        return parsed.navPath
      }
    }
  } catch (e) {
    logger.warn('[PageNav] 读取模块导航路径失败', { module, key, error: e })
  }
  return [module]
}
