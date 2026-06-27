<template>
  <div
    class="main-nav-bar"
    :class="[`nav-${variant}`, { 'nav-hidden': hidden, 'no-hover': noHover }]"
  >
    <div class="nav-items-scroll" ref="scrollRef">
      <button
        v-for="m in MODULES"
        :key="m"
        class="nav-item"
        :class="{ active: activeModule === m, 'nav-item-bottom': variant === 'left' && m === 'toolbox' }"
        @click="emit('navigate', m)"
      >
        <span class="nav-item-icon">{{ MODULE_ICONS[m] }}</span>
        <span class="nav-item-label">{{ MODULE_LABELS[m] }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { MODULES, MODULE_ICONS, MODULE_LABELS } from '../../../composables/usePageNav'

const props = withDefaults(defineProps<{
  activeModule: string
  variant?: 'left' | 'bottom' | 'split'
  hidden?: boolean
  noHover?: boolean
}>(), {
  variant: 'bottom',
  hidden: false,
  noHover: false,
})

const emit = defineEmits<{
  (e: 'navigate', module: string): void
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
  width: 84px;
  height: 100%;
  margin: 0;
  border-radius: 0;
  display: flex;
  flex-direction: column;
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

/* 垂直导航栏：纵向滚动 */
.nav-left .nav-items-scroll {
  flex: 1;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 12px 4px;
  gap: 8px;
}

/* 垂直导航栏：工具箱及之后的导航项推到底部 */
.nav-left .nav-item-bottom {
  margin-top: auto;
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
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
  min-width: 52px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-85);
}

/* 桌面端取消鼠标悬停效果 */
.no-hover .nav-item:hover {
  background: transparent;
  color: var(--chalk-white-60);
}

.nav-item.active {
  background: transparent;
  color: var(--chalk-white);
  font-weight: 600;
}

.nav-item-icon {
  font-size: 18px;
  line-height: 1;
}

.nav-item-label {
  font-size: 12px;
  line-height: 1;
}
</style>
