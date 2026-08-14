<template>
  <div class="split-panel">
    <div class="split-panel-content">
      <component
        :is="moduleComponents[module]"
        :key="`split-${panelIndex}-${module}`"
        @fullscreen-change="emit('fullscreenChange')"
        @logout="emit('logout')"
        @refreshData="emit('refreshData')"
        @profile-updated="emit('profileUpdated')"
        @close-profile="emit('closeProfile', panelIndex)"
      />
    </div>
    <MainNav variant="split" noHover :activeModule="module" split-active @navigate="emit('navigate', $event)" @split="emit('split')" />
  </div>
</template>

<script setup lang="ts">
import { provideNavState, MODULES, MODULE_ICONS } from '../../composables/usePageNav'
import MainNav from './nav/MainNav.vue'

const props = defineProps<{
  module: string
  panelIndex: number
  moduleComponents: Record<string, any>
}>()

const emit = defineEmits<{
  (e: 'navigate', module: string): void
  (e: 'split'): void
  (e: 'fullscreenChange'): void
  (e: 'logout'): void
  (e: 'refreshData'): void
  (e: 'profileUpdated'): void
  (e: 'closeProfile', panelIndex: number): void
}>()

// 为每个拆分面板提供独立的导航状态（路由互不污染）
provideNavState()
</script>

<style scoped>
.split-panel { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; position: relative; }
.split-panel-content { flex: 1; min-height: 0; overflow: hidden; }
</style>
