import { ref, computed, watch, nextTick } from 'vue'
import type { Ref } from 'vue'
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

export const MODULE_ICONS: Record<string, string> = {
  footprint: '👣', notes: '📝', focus: '🧘', list: '📋', countdown: '⏳', course: '📖', statistics: '📊', toolbox: '🧰', profile: '👤'
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

let persistTimer: ReturnType<typeof setTimeout> | null = null

watch(navPath, async () => {
    const module = currentModule.value
    const key = MODULE_PERSIST_KEYS[module]
    logger.debug('[PageNav] navPath watch 触发', { navPath: navPath.value, module, key })
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(async () => {
      if (key) {
        // 合并已有数据，保留模块额外持久化字段（如笔记的 isEditing）
        const existing = (await getSystemStateField(key)) as Record<string, any> | undefined
        await setSystemStateField(key, { ...(existing || {}), navPath: navPath.value } as any)
        logger.debug('[PageNav] 持久化 navPath', { key, value: { navPath: navPath.value } })
      }
    }, 300)
  }, { deep: true })

export function usePageNav() {
  function setNavPath(path: string[]) {
    logger.debug('[PageNav] setNavPath', { prev: navPath.value, next: path, caller: new Error().stack?.split('\n')[2]?.trim() })
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

  return {
    MODULES, MODULE_ICONS, MODULE_LABELS, MODULE_ROUTES,
    navPath, currentModule, moduleIcon, moduleLabel,
    navContext,
    setNavPath, setNavContext, goModuleHome,
  }
}

export async function restoreModuleNavPath(module: string): Promise<string[]> {
  const key = MODULE_PERSIST_KEYS[module]
  logger.debug('[PageNav] restoreModuleNavPath 开始', { module, key })
  if (!key) {
    logger.debug('[PageNav] restoreModuleNavPath 无key，返回默认', { result: [module] })
    return [module]
  }
  try {
    const parsed = (await getSystemStateField(key)) as Record<string, any> | undefined
    logger.debug('[PageNav] restoreModuleNavPath 读取存储', { module, key, parsed })
    if (parsed?.navPath && Array.isArray(parsed.navPath)) {
      if (parsed.navPath.length > 0 && parsed.navPath[0] === module) {
        logger.debug('[PageNav] restoreModuleNavPath 路径匹配，恢复', { restored: parsed.navPath })
        return parsed.navPath
      }
      logger.debug('[PageNav] restoreModuleNavPath 路径不匹配，丢弃', { parsed: parsed.navPath, expected: module })
    }
  } catch (e) {
    logger.warn('[PageNav] restoreModuleNavPath 读取失败', { module, key, error: e })
  }
  logger.debug('[PageNav] restoreModuleNavPath 返回默认', { result: [module] })
  return [module]
}