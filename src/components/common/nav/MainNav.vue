<template>
  <div
    class="main-nav-bar nav-left"
    :class="{ 'nav-hidden': hidden, 'collapsed': collapsed }"
  >
    <div class="nav-items-scroll" ref="scrollRef">
      <button
        v-for="m in MODULES"
        :key="m"
        class="nav-item"
        :class="{ active: activeModule === m }"
        :title="MODULE_LABELS[m]"
        @click="emit('navigate', m)"
      >
        <span class="nav-item-icon">
          <component :is="MODULE_ICONS[m]" />
        </span>
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
  hidden?: boolean
  collapsed?: boolean
}>(), {
  hidden: false,
  collapsed: false,
})

const emit = defineEmits<{
  (e: 'navigate', module: string): void
  (e: 'toggle'): void
}>()

const scrollRef = ref<HTMLElement | null>(null)

const scrollToActive = () => {
  nextTick(() => {
    const container = scrollRef.value
    if (!container) return
    const activeItem = container.querySelector('.nav-item.active') as HTMLElement
    if (!activeItem) return
    const containerHeight = container.clientHeight
    const itemTop = activeItem.offsetTop
    const itemHeight = activeItem.offsetHeight
    container.scrollTo({ top: itemTop - containerHeight / 2 + itemHeight / 2, behavior: 'smooth' })
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
  width: 120px;
  height: 100%;
  margin: 0;
  border-radius: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

/* 左侧导航栏收起态：仅显示图标 */
.nav-left.collapsed {
  width: 64px;
}

.nav-left.collapsed .nav-item-label {
  display: none;
}

.nav-left.collapsed .nav-items-scroll {
  align-items: center;
  padding-left: 0;
  padding-right: 0;
}

.nav-left.collapsed .nav-item {
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}

/* 收起/展开按钮：位于导航栏底部 */
.nav-toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px 0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  transition: all 0.15s;
}

.nav-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-85);
}

.nav-toggle .el-icon {
  font-size: 18px;
}

/* 桌面端导航栏位于窗口左侧。 */

/* === 桌面端左侧导航栏收起状态 === */
/* 折叠态已随左侧导航栏移除 */

/* === 收起/展开按钮 === */
/* 收起/展开按钮已随左侧导航栏移除 */

/* === 隐藏状态 === */
.nav-hidden {
  opacity: 0;
  pointer-events: none;
}

.nav-left.nav-hidden {
  width: 0;
  min-width: 0;
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

/* 左侧导航常驻仅图标模式：项自顶部对齐 */
.nav-left {
  width: 64px;
}
.nav-left .nav-item-label {
  display: none;
}
.nav-left .nav-items-scroll {
  justify-content: flex-start;
  align-items: center;
}
.nav-left .nav-item {
  width: 100%;
  justify-content: center;
}
</style>
