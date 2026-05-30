import { ref, computed, watch, nextTick } from 'vue'
import type { Ref } from 'vue'
import { getSystemStateField, setSystemStateField } from '../services/storageService'
import { logger } from '../lib/logger'

export interface DropdownItem {
  id: string
  name: string
  color: string
  current: boolean
  onSelect: () => void
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

export const MODULES = ['footprint', 'focus', 'mission', 'countdown', 'course', 'statistics', 'toolbox', 'profile']

export const MODULE_ICONS: Record<string, string> = {
  footprint: '👣', focus: '🧘', mission: '📋', countdown: '⏳', course: '📖', statistics: '📊', toolbox: '🧰', profile: '👤'
}

export const MODULE_LABELS: Record<string, string> = {
  footprint: '足迹', focus: '专注', mission: '清单', countdown: '倒数日', course: '课程表', statistics: '统计', toolbox: '工具箱', profile: '我的'
}

export const MODULE_ROUTES: Record<string, string> = {
  footprint: '/footprint', focus: '/focus', mission: '/mission', countdown: '/countdown', course: '/course', statistics: '/statistics', toolbox: '/toolbox', profile: '/profile'
}

const MODULE_PERSIST_KEYS: Record<string, string> = {
  mission: 'list',
  countdown: 'countdown'
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

watch(navPath, async () => {
    const module = currentModule.value
    const key = MODULE_PERSIST_KEYS[module]
    logger.debug('[PageNav] navPath watch 触发', { navPath: navPath.value, module, key })
    if (key && navPath.value.length > 1) {
      logger.debug('[PageNav] 持久化 navPath', { key, value: { navPath: navPath.value } })
      await setSystemStateField(key, { navPath: navPath.value })
    }
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
    const parsed = await getSystemStateField(key)
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