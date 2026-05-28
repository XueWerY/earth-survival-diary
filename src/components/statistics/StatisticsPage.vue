<template>
  <div class="statistics-container">
    <!-- 顶部导航区 -->
    <div class="top-nav-area">
      <div class="nav-scroll-wrapper" ref="navScrollRef">
        <div class="nav-inner">
          <div
              v-for="tab in tabs"
              :key="tab.name"
              class="nav-item"
              :class="{ active: activeTab === tab.name }"
              :ref="setNavItemRef"
              @click="handleTabClick(tab.name)"
          >
            <span class="nav-icon">{{ tab.icon }}</span>
            <span class="nav-label">{{ tab.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <FootprintStats v-if="activeTab === 'footprint'" />
      <FocusStats v-else-if="activeTab === 'focus'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import FootprintStats from './FootprintStats.vue'
import FocusStats from '../focus/FocusStats.vue'
import { getSystemStateField, setSystemStateField } from '../../services/storageService'
import { usePageNav } from '../../composables/usePageNav'
import { logger } from '../../lib/logger'

const CENTERED_WIDTH = 800

const pageNav = usePageNav()

const tabs = [
  { name: 'footprint', icon: '📝', label: '足迹' },
  { name: 'focus', icon: '⏱️', label: '专注' }
]

const activeTab = ref('footprint')
const navScrollRef = ref<HTMLElement | null>(null)
const itemRefs = ref<HTMLElement[]>([])

const setNavItemRef = (el: any) => {
  if (el) itemRefs.value.push(el as HTMLElement)
}

const scrollToActiveTab = () => {
  const container = navScrollRef.value
  if (!container) return

  const containerWidth = container.clientWidth
  const activeIndex = tabs.findIndex(t => t.name === activeTab.value)
  const activeEl = itemRefs.value[activeIndex]
  if (!activeEl) return

  const activeLeft = activeEl.offsetLeft
  const activeWidth = activeEl.offsetWidth
  const scrollLeft = activeLeft - containerWidth / 2 + activeWidth / 2

  container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
}

const handleTabClick = async (name: string) => {
  logger.info('[统计] 切换导航项', { tab: name })
  activeTab.value = name
  await setSystemStateField('statsActiveTab', name)
  await nextTick()
  itemRefs.value = []
  await nextTick()
  scrollToActiveTab()
}

onMounted(async () => {
  if (pageNav.navPath.value.length === 0) {
    pageNav.setNavPath(['statistics'])
  }
  pageNav.setNavContext({
    segments: [],
    plusVisible: false,
    plusOnClick: null,
    goModuleHome: () => { pageNav.setNavPath(['statistics']) }
  })

  await nextTick()
  const savedTab = await getSystemStateField('statsActiveTab')
  if (savedTab) {
    activeTab.value = savedTab as string
  }
  await nextTick()
  scrollToActiveTab()
})
</script>

<style scoped>
.statistics-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
}

/* 顶部导航区 */
.top-nav-area {
  padding: 16px 0;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nav-scroll-wrapper {
  max-width: v-bind(CENTERED_WIDTH + 'px');
  margin: 0 auto;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  padding: 0 24px;
}

.nav-scroll-wrapper::-webkit-scrollbar {
  display: none;
}

.nav-inner {
  display: flex;
  gap: 12px;
  min-width: max-content;
  justify-content: center;
}

.nav-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.nav-item.active {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.15) 100%);
  border-color: rgba(102, 126, 234, 0.4);
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.15);
}

.nav-icon {
  font-size: 18px;
  line-height: 1;
}

.nav-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  transition: color 0.2s ease;
}

.nav-item.active .nav-label {
  color: #fff;
  font-weight: 500;
}

/* 主内容区 */
.main-content {
  flex: 1;
  overflow: hidden;
}
</style>
