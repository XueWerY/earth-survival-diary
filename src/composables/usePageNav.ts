import { ref, computed, watch, nextTick, inject, provide } from 'vue'
import type { Ref, InjectionKey } from 'vue'
import {
  MapLocation, Notebook, Timer, List, AlarmClock, Calendar, Histogram, Grid, User
} from '@element-plus/icons-vue'
import { getSystemStateField, setSystemStateField, type SystemState } from '../services/storageService'
import { logger } from '../lib/logger'

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

export const MODULES = ['footprint', 'notes', 'focus', 'list', 'countdown', 'course', 'statistics', 'toolbox', 'profile']

export const MODULE_ICONS: Record<string, any> = {
  footprint: MapLocation, notes: Notebook, focus: Timer, list: List, countdown: AlarmClock, course: Calendar, statistics: Histogram, toolbox: Grid, profile: User
}

export const MODULE_LABELS: Record<string, string> = {
  footprint: '足迹', notes: '笔记', focus: '专注', list: '清单', countdown: '倒数日', course: '课程表', statistics: '统计', toolbox: '工具箱', profile: '我的'
}

export const MODULE_ROUTES: Record<string, string> = {
  footprint: '/footprint', notes: '/notes', focus: '/focus', list: '/list', countdown: '/countdown', course: '/course', statistics: '/statistics', toolbox: '/toolbox', profile: '/profile'
}

const MODULE_PERSIST_KEYS: Partial<Record<string, keyof SystemState>> = {
  list: 'list',
  countdown: 'countdown',
  notes: 'notes'
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

const navStateKey: InjectionKey<NavState> = Symbol('navState')

// 创建独立的导航状态实例（拆分界面每个面板一个，互不污染）
function createNavState(persist: boolean): NavState {
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

  function setNavPath(path: string[]) {
    logger.debug('[PageNav] setNavPath', { prev: navPath.value, next: path, persist })
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

  // 仅默认实例持久化（拆分面板不持久化，避免覆盖主界面状态）
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  if (persist) {
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
  }

  return { navPath, navContext, currentModule, moduleIcon, moduleLabel, setNavPath, setNavContext, goModuleHome }
}

const defaultState = createNavState(true)

export function usePageNav(): NavState & typeof moduleConstants {
  // 拆分界面由父级 provide 独立导航状态，否则使用全局默认实例
  const injected = inject(navStateKey, null)
  const s = injected ?? defaultState
  return {
    ...s,
    MODULES, MODULE_ICONS, MODULE_LABELS, MODULE_ROUTES,
  }
}

const moduleConstants = { MODULES, MODULE_ICONS, MODULE_LABELS, MODULE_ROUTES }

// 在拆分面板子组件内调用，为面板创建并提供独立的导航状态
export function provideNavState(): NavState {
  const state = createNavState(false)
  provide(navStateKey, state)
  return state
}

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
    logger.warn('[PageNav] restoreModuleNavPath 读取失败', { module, key, error: e })
  }
  return [module]
}
