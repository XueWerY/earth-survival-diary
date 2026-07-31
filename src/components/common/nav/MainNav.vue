<template>
  <div
    class="main-nav-bar"
    :class="[`nav-${variant}`, { 'nav-hidden': hidden, 'no-hover': noHover, 'nav-collapsed': collapsed }]"
  >
    <div v-if="variant === 'left'" class="nav-header">
      <img class="nav-header-logo" :src="appIconUrl" alt="logo" />
      <span class="nav-header-title">地球Online生存日记</span>
    </div>
    <div class="nav-items-scroll" ref="scrollRef">
      <button
        v-for="m in MODULES"
        :key="m"
        class="nav-item"
        :class="{ active: activeModule === m }"
        @click="emit('navigate', m)"
      >
        <span class="nav-item-icon">
          <component :is="MODULE_ICONS[m]" />
        </span>
        <span class="nav-item-label">{{ MODULE_LABELS[m] }}</span>
      </button>
    </div>
    <button
      v-if="variant === 'left'"
      class="nav-collapse-toggle"
      :title="collapsed ? '展开导航栏' : '收起导航栏'"
      @click="emit('toggle-collapse')"
    >
      <component :is="collapsed ? Expand : Fold" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Fold, Expand } from '@element-plus/icons-vue'
import { MODULES, MODULE_ICONS, MODULE_LABELS } from '../../../composables/usePageNav'
import appIconUrl from '../../../../build/app-icon.png'

const props = withDefaults(defineProps<{
  activeModule: string
  variant?: 'left' | 'bottom' | 'split'
  hidden?: boolean
  noHover?: boolean
  collapsed?: boolean
}>(), {
  variant: 'bottom',
  hidden: false,
  noHover: false,
  collapsed: false,
})

const emit = defineEmits<{
  (e: 'navigate', module: string): void
  (e: 'toggle-collapse'): void
}>()

const scrollRef = ref<HTMLElement | null>(null)

const scrollToActive = () => {
  nextTick(() => {
    const container = scrollRef.value
    if (!container) return
    const activeItem = container.querySelector('.nav-item.active') as HTMLElement
    if (!activeItem) return
    if (props.variant === 'left') {
      const containerHeight = container.clientHeight
      const itemTop = activeItem.offsetTop
      const itemHeight = activeItem.offsetHeight
      container.scrollTo({ top: itemTop - containerHeight / 2 + itemHeight / 2, behavior: 'smooth' })
    } else {
      const containerWidth = container.clientWidth
      const itemLeft = activeItem.offsetLeft
      const itemWidth = activeItem.offsetWidth
      container.scrollTo({ left: itemLeft - containerWidth / 2 + itemWidth / 2, behavior: 'smooth' })
    }
  })
}

watch(() => props.activeModule, scrollToActive)
</script>

<style scoped>
.main-nav-bar {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  transition: opacity 0.3s, height 0.3s, width 0.3s;
  overflow: hidden;
}

/* === 桌面端左侧垂直导航栏 === */
.nav-left {
  width: 210px;
  height: 100%;
  margin: 0;
  border-radius: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

.nav-left .nav-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 4px 12px;
  margin: 0 12px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
}

.nav-left .nav-header-logo {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  flex-shrink: 0;
}

.nav-left .nav-header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--chalk-white);
  line-height: 1.3;
  white-space: nowrap;
}

/* === 移动端底部水平导航栏 === */
.nav-bottom {
  width: 500px;
  margin: 0 auto;
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0;
}

/* === 拆分面板顶部水平导航栏 === */
.nav-split {
  width: 100%;
  margin: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0;
}

/* === 桌面端左侧导航栏收起状态 === */
.nav-left.nav-collapsed {
  width: 60px;
}

.nav-left.nav-collapsed .nav-header {
  justify-content: center;
  padding: 16px 0 12px;
  margin: 0 8px;
}

.nav-left.nav-collapsed .nav-header-title {
  display: none;
}

.nav-left.nav-collapsed .nav-items-scroll {
  padding: 10px 6px 12px;
}

.nav-left.nav-collapsed .nav-item {
  justify-content: center;
  padding: 8px 0;
  gap: 0;
}

.nav-left.nav-collapsed .nav-item-label {
  display: none;
}

/* === 收起/展开按钮 === */
.nav-collapse-toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  margin: 0 8px 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  transition: all 0.15s;
}

.nav-collapse-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-85);
}

.nav-collapse-toggle svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 500px) {
  .nav-bottom {
    width: 80%;
  }
}

/* === 隐藏状态 === */
.nav-hidden {
  opacity: 0;
  pointer-events: none;
}

.nav-bottom.nav-hidden {
  height: 0;
  min-height: 0;
}

.nav-left.nav-hidden {
  width: 0;
  min-width: 0;
}

.nav-split.nav-hidden {
  height: 0;
  min-height: 0;
}

/* === 导航项滚动容器 === */
.nav-items-scroll {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  padding: 4px 12px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.nav-items-scroll::-webkit-scrollbar {
  display: none;
}

/* 垂直导航栏：纵向滚动，垂直居中 */
.nav-left .nav-items-scroll {
  flex: 1;
  flex-direction: column;
  justify-content: center;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 10px 8px 12px;
  gap: 8px;
}

/* 底部导航栏：溢出时左对齐，否则居中 */
.nav-bottom .nav-items-scroll {
  justify-content: flex-start;
}

.nav-bottom .nav-items-scroll::before,
.nav-bottom .nav-items-scroll::after {
  content: '';
  flex: 1;
  min-width: 0;
}

/* === 导航项 === */
.nav-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
  width: 100%;
  min-width: 0;
}

.nav-item:not(.active):hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-85);
}

/* 桌面端取消鼠标悬停效果（高亮项除外） */
.no-hover .nav-item:hover {
  background: transparent;
  color: var(--chalk-white-60);
}
.no-hover .nav-item.active:hover {
  background: rgba(102, 126, 234, 0.18);
  color: var(--chalk-white);
}

.nav-item.active {
  background: rgba(102, 126, 234, 0.18);
  color: var(--chalk-white);
  font-weight: 600;
}

.nav-item-icon {
  font-size: 18px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-item-icon svg {
  width: 18px;
  height: 18px;
}

.nav-item-label {
  font-size: 13px;
  line-height: 1;
}
</style>
