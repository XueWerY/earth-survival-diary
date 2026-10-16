<template>
  <div
    ref="viewportRef"
    class="app-scrollbar"
    :class="forwardedClass"
    :data-app-scrollbar-direction="direction"
    :style="hostStyle"
    v-bind="forwardedAttrs"
    @scroll="emit('scroll', $event)"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useAttrs, watch } from 'vue'
import { attachCustomScrollbar, type ScrollbarDirection } from './scrollbarController'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  direction?: Exclude<ScrollbarDirection, 'auto'>
  size?: number
  minThumbSize?: number
}>(), {
  direction: 'vertical',
  size: 6,
  minThumbSize: 28,
})

const emit = defineEmits<{
  scroll: [event: Event]
}>()

const attrs = useAttrs()
const viewportRef = ref<HTMLElement | null>(null)
let detachScrollbar: (() => void) | null = null

const connectScrollbar = () => {
  detachScrollbar?.()
  detachScrollbar = viewportRef.value
    ? attachCustomScrollbar(viewportRef.value, {
      direction: props.direction,
      size: props.size,
      minThumbSize: props.minThumbSize,
    })
    : null
}

const forwardedClass = computed(() => attrs.class)
const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
const hostStyle = computed(() => [
  attrs.style,
  {
    overflowX: props.direction === 'vertical' ? 'hidden' : 'auto',
    overflowY: props.direction === 'horizontal' ? 'hidden' : 'auto',
  },
])

const scrollTo = (options: ScrollToOptions | number, y?: number) => {
  const viewport = viewportRef.value
  if (!viewport) return
  if (typeof options === 'number') viewport.scrollTo(options, y ?? 0)
  else viewport.scrollTo(options)
}

const getScrollElement = () => viewportRef.value

onMounted(connectScrollbar)

watch(() => [props.direction, props.size, props.minThumbSize], connectScrollbar, { flush: 'post' })

onBeforeUnmount(() => {
  detachScrollbar?.()
  detachScrollbar = null
})

defineExpose({ scrollTo, getScrollElement })
</script>

<style scoped>
.app-scrollbar {
  position: relative;
  min-width: 0;
  min-height: 0;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

.app-scrollbar[data-app-scrollbar-direction='vertical'] { overflow-x: hidden; overflow-y: auto; }
.app-scrollbar[data-app-scrollbar-direction='horizontal'] { overflow-x: auto; overflow-y: hidden; }
.app-scrollbar[data-app-scrollbar-direction='both'] { overflow: auto; }
.app-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
</style>
