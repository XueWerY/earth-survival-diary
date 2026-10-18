export type ScrollbarDirection = 'vertical' | 'horizontal' | 'both' | 'auto'

export interface ScrollbarControllerOptions {
  direction?: ScrollbarDirection
  size?: number
  minThumbSize?: number
}

type Axis = 'vertical' | 'horizontal'

interface AxisGeometry {
  trackStart: number
  trackLength: number
  thumbLength: number
  thumbTravel: number
  maxScroll: number
}

const HOST_ATTRIBUTE = 'data-app-scrollbar-host'
const UI_ATTRIBUTE = 'data-app-scrollbar-ui'
/** 元素声明此属性后，自绘滚动条不再附加（用于滚轮选择器等自带隐藏滚动条的区域）。 */
export const OPT_OUT_ATTRIBUTE = 'data-app-scrollbar-off'

export function isCustomScrollbarOptedOut(element: Element): boolean {
  return element.hasAttribute(OPT_OUT_ATTRIBUTE)
}
const CLIPPING_OVERFLOW = new Set(['hidden', 'clip', 'auto', 'scroll', 'overlay'])
let generatedId = 0

function createHostId() {
  let id = ''
  do {
    id = `app-scrollbar-host-${++generatedId}`
  } while (document.getElementById(id))
  return id
}

function isAxisEnabled(host: HTMLElement, axis: Axis, direction: ScrollbarDirection): boolean {
  if (direction === 'both') return true
  if (direction === 'vertical') return axis === 'vertical'
  if (direction === 'horizontal') return axis === 'horizontal'

  const style = getComputedStyle(host)
  return axis === 'vertical'
    ? style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay'
    : style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay'
}

function getVisibleBounds(host: HTMLElement) {
  const rect = host.getBoundingClientRect()
  let left = rect.left + host.clientLeft
  let top = rect.top + host.clientTop
  let right = left + host.clientWidth
  let bottom = top + host.clientHeight

  left = Math.max(0, left)
  top = Math.max(0, top)
  right = Math.min(window.innerWidth, right)
  bottom = Math.min(window.innerHeight, bottom)

  let ancestor = host.parentElement
  while (ancestor && ancestor !== document.documentElement) {
    const style = getComputedStyle(ancestor)
    const ancestorRect = ancestor.getBoundingClientRect()
    const clipLeft = ancestorRect.left + ancestor.clientLeft
    const clipTop = ancestorRect.top + ancestor.clientTop
    const clipRight = clipLeft + ancestor.clientWidth
    const clipBottom = clipTop + ancestor.clientHeight

    if (CLIPPING_OVERFLOW.has(style.overflowX)) {
      left = Math.max(left, clipLeft)
      right = Math.min(right, clipRight)
    }
    if (CLIPPING_OVERFLOW.has(style.overflowY)) {
      top = Math.max(top, clipTop)
      bottom = Math.min(bottom, clipBottom)
    }
    ancestor = ancestor.parentElement
  }

  return { left, top, right, bottom }
}

function getAxisMetrics(host: HTMLElement, axis: Axis) {
  if (axis === 'vertical') {
    return {
      clientSize: host.clientHeight,
      contentSize: host.scrollHeight,
      scrollPosition: host.scrollTop,
    }
  }
  return {
    clientSize: host.clientWidth,
    contentSize: host.scrollWidth,
    scrollPosition: host.scrollLeft,
  }
}

function setScrollPosition(host: HTMLElement, axis: Axis, value: number) {
  if (axis === 'vertical') host.scrollTop = value
  else host.scrollLeft = value
}

function getOverlayZIndex(host: HTMLElement) {
  let zIndex = 0
  let element: HTMLElement | null = host
  while (element && element !== document.body) {
    const value = getComputedStyle(element).zIndex
    if (value !== 'auto') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) zIndex = Math.max(zIndex, parsed)
    }
    element = element.parentElement
  }
  return String(Math.max(1, zIndex + 1))
}

function createTrack(axis: Axis, host: HTMLElement) {
  const track = document.createElement('div')
  track.className = `app-scrollbar-track app-scrollbar-track--${axis}`
  track.setAttribute(UI_ATTRIBUTE, '')
  track.setAttribute('aria-hidden', 'true')

  const thumb = document.createElement('div')
  thumb.className = 'app-scrollbar-thumb'
  thumb.setAttribute(UI_ATTRIBUTE, '')
  thumb.setAttribute('role', 'scrollbar')
  thumb.setAttribute('aria-orientation', axis)
  thumb.setAttribute('aria-label', axis === 'vertical' ? '垂直滚动条' : '水平滚动条')
  thumb.setAttribute('aria-valuemin', '0')
  thumb.setAttribute('aria-valuenow', '0')
  thumb.setAttribute('aria-valuemax', '0')
  thumb.setAttribute('aria-controls', host.id)
  thumb.tabIndex = -1
  track.appendChild(thumb)

  return { track, thumb }
}

export function attachCustomScrollbar(
  host: HTMLElement,
  options: ScrollbarControllerOptions = {},
): () => void {
  if (isCustomScrollbarOptedOut(host) || host.hasAttribute(HOST_ATTRIBUTE) || !host.isConnected) return () => {}

  const direction = options.direction || 'auto'
  const size = Math.max(4, options.size || 6)
  const minThumbSize = Math.max(18, options.minThumbSize || 28)
  const originalId = host.getAttribute('id')
  if (!originalId) host.id = createHostId()

  host.setAttribute(HOST_ATTRIBUTE, '')

  const states = new Map<Axis, {
    track: HTMLDivElement
    thumb: HTMLDivElement
    geometry: AxisGeometry
  }>()

  const addAxis = (axis: Axis) => {
    const { track, thumb } = createTrack(axis, host)
    document.body.appendChild(track)
    states.set(axis, {
      track,
      thumb,
      geometry: { trackStart: 0, trackLength: 0, thumbLength: 0, thumbTravel: 0, maxScroll: 0 },
    })
  }

  if (isAxisEnabled(host, 'vertical', direction)) addAxis('vertical')
  if (isAxisEnabled(host, 'horizontal', direction)) addAxis('horizontal')
  if (!states.size) {
    host.removeAttribute(HOST_ATTRIBUTE)
    if (!originalId) host.removeAttribute('id')
    return () => {}
  }

  let updateFrame = 0
  let childResizeObserver: ResizeObserver | null = null
  let dragState: { axis: Axis; pointerId: number; startPointer: number; startScroll: number } | null = null

  const getPosition = (event: PointerEvent, axis: Axis) => axis === 'vertical' ? event.clientY : event.clientX

  const updateAxis = (axis: Axis) => {
    const state = states.get(axis)
    if (!state) return

    const { track, thumb } = state
    const metrics = getAxisMetrics(host, axis)
    const isScrollable = metrics.clientSize > 0 && metrics.contentSize > metrics.clientSize + 1
    const bounds = getVisibleBounds(host)
    const inset = 2
    const trackStart = axis === 'vertical' ? bounds.top + inset : bounds.left + inset
    const trackEnd = axis === 'vertical' ? bounds.bottom - inset : bounds.right - inset
    const trackLength = Math.max(0, trackEnd - trackStart)
    const visible = isScrollable
      && trackLength > 0
      && bounds.right > bounds.left
      && bounds.bottom > bounds.top

    track.style.display = visible ? 'block' : 'none'
    track.style.zIndex = getOverlayZIndex(host)
    track.setAttribute('aria-hidden', visible ? 'false' : 'true')
    if (!visible) {
      thumb.tabIndex = -1
      state.geometry = { trackStart, trackLength, thumbLength: 0, thumbTravel: 0, maxScroll: 0 }
      // host 处于 display:none（如全屏编辑隐藏侧栏）时安排恢复复查：
      // 重新显示不会触发 resize/scroll，若不复查 track 会停留在隐藏前的旧坐标。
      if (metrics.clientSize === 0 || host.getBoundingClientRect().width === 0) {
        scheduleHiddenRecovery()
      }
      return
    }

    if (axis === 'vertical') {
      track.style.left = `${bounds.right - size - inset}px`
      track.style.top = `${trackStart}px`
      track.style.width = `${size}px`
      track.style.height = `${trackLength}px`
    } else {
      track.style.left = `${trackStart}px`
      track.style.top = `${bounds.bottom - size - inset}px`
      track.style.width = `${trackLength}px`
      track.style.height = `${size}px`
    }

    const maxScroll = Math.max(0, metrics.contentSize - metrics.clientSize)
    const thumbLength = Math.min(trackLength, Math.max(minThumbSize, trackLength * metrics.clientSize / metrics.contentSize))
    const thumbTravel = Math.max(0, trackLength - thumbLength)
    const scrollPosition = Math.min(maxScroll, Math.max(0, metrics.scrollPosition))
    const thumbOffset = maxScroll > 0 ? thumbTravel * scrollPosition / maxScroll : 0

    if (axis === 'vertical') {
      thumb.style.width = '100%'
      thumb.style.height = `${thumbLength}px`
      thumb.style.transform = `translate3d(0, ${thumbOffset}px, 0)`
    } else {
      thumb.style.width = `${thumbLength}px`
      thumb.style.height = '100%'
      thumb.style.transform = `translate3d(${thumbOffset}px, 0, 0)`
    }

    thumb.tabIndex = 0
    thumb.setAttribute('aria-valuemax', String(Math.round(maxScroll)))
    thumb.setAttribute('aria-valuenow', String(Math.round(scrollPosition)))
    thumb.setAttribute('aria-valuetext', `${Math.round(scrollPosition / maxScroll * 100)}%`)
    state.geometry = { trackStart, trackLength, thumbLength, thumbTravel, maxScroll }
  }

  const update = () => {
    updateFrame = 0
    lastHostRect = host.getBoundingClientRect()
    for (const axis of states.keys()) updateAxis(axis)
  }

  const scheduleUpdate = () => {
    if (updateFrame) return
    updateFrame = window.requestAnimationFrame(update)
  }

  // 位置自检：布局漂移（面板宽度过渡动画、抽屉展开、字体/图片加载、
  // 缩放变化等）不会触发 scroll/resize/RO，轨道会停留在旧坐标——
  // 表现为滚动条压在卡片上、离容器右边界一截。这里低成本轮询宿主矩形，
  // 一旦发现变化就重算，保证轨道始终吸附容器边界。
  let lastHostRect = host.getBoundingClientRect()
  const positionWatchTimer = window.setInterval(() => {
    if (!host.isConnected) return
    const rect = host.getBoundingClientRect()
    if (
      Math.abs(rect.left - lastHostRect.left) > 0.5 ||
      Math.abs(rect.right - lastHostRect.right) > 0.5 ||
      Math.abs(rect.top - lastHostRect.top) > 0.5 ||
      Math.abs(rect.bottom - lastHostRect.bottom) > 0.5 ||
      Math.abs(rect.width - lastHostRect.width) > 0.5 ||
      Math.abs(rect.height - lastHostRect.height) > 0.5
    ) {
      scheduleUpdate()
    }
  }, 200)

  // 隐藏→显示恢复复查：用短轮询探测 host 重新可见（display:none→block
  // 不触发 resize/scroll，ResizeObserver 在隐藏期间也不回调）。
  let hiddenRecoveryTimer: ReturnType<typeof setInterval> | null = null
  const scheduleHiddenRecovery = () => {
    if (hiddenRecoveryTimer !== null) return
    hiddenRecoveryTimer = setInterval(() => {
      const rect = host.getBoundingClientRect()
      if (rect.width > 0 || rect.height > 0) {
        clearInterval(hiddenRecoveryTimer as ReturnType<typeof setInterval>)
        hiddenRecoveryTimer = null
        scheduleUpdate()
      }
    }, 120)
    // 兜底：最多轮询 3 秒后自动清理（host 被永久移除等场景）
    setTimeout(() => {
      if (hiddenRecoveryTimer !== null) {
        clearInterval(hiddenRecoveryTimer)
        hiddenRecoveryTimer = null
      }
    }, 3000)
  }

  const endDrag = () => {
    if (!dragState) return
    const state = states.get(dragState.axis)
    state?.thumb.classList.remove('is-dragging')
    document.removeEventListener('pointermove', moveThumb)
    document.removeEventListener('pointerup', endDrag)
    document.removeEventListener('pointercancel', endDrag)
    dragState = null
  }

  const moveThumb = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return
    const state = states.get(dragState.axis)
    if (!state) return
    const geometry = state.geometry
    if (geometry.thumbTravel <= 0) return
    const delta = getPosition(event, dragState.axis) - dragState.startPointer
    const nextScroll = dragState.startScroll + delta * geometry.maxScroll / geometry.thumbTravel
    setScrollPosition(host, dragState.axis, nextScroll)
    scheduleUpdate()
  }

  const startThumbDrag = (event: PointerEvent, axis: Axis) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const state = states.get(axis)
    if (!state) return
    dragState = {
      axis,
      pointerId: event.pointerId,
      startPointer: getPosition(event, axis),
      startScroll: axis === 'vertical' ? host.scrollTop : host.scrollLeft,
    }
    state.thumb.classList.add('is-dragging')
    document.addEventListener('pointermove', moveThumb)
    document.addEventListener('pointerup', endDrag)
    document.addEventListener('pointercancel', endDrag)
  }

  const startTrackJump = (event: PointerEvent, axis: Axis) => {
    if (event.button !== 0) return
    const state = states.get(axis)
    if (!state || event.target === state.thumb) return
    event.preventDefault()
    event.stopPropagation()
    const coordinate = getPosition(event, axis)
    const geometry = state.geometry
    if (geometry.thumbTravel <= 0 || geometry.maxScroll <= 0) return
    const ratio = (coordinate - geometry.trackStart - geometry.thumbLength / 2) / geometry.thumbTravel
    setScrollPosition(host, axis, Math.min(1, Math.max(0, ratio)) * geometry.maxScroll)
    scheduleUpdate()
  }

  const handleKeydown = (event: KeyboardEvent, axis: Axis) => {
    const vertical = axis === 'vertical'
    const positive = vertical ? 'ArrowDown' : 'ArrowRight'
    const negative = vertical ? 'ArrowUp' : 'ArrowLeft'
    const position = vertical ? host.scrollTop : host.scrollLeft
    const pageSize = vertical ? host.clientHeight : host.clientWidth
    const maxScroll = vertical ? host.scrollHeight - host.clientHeight : host.scrollWidth - host.clientWidth
    let nextPosition: number | null = null

    if (event.key === positive) nextPosition = position + 40
    else if (event.key === negative) nextPosition = position - 40
    else if (event.key === 'PageDown') nextPosition = position + pageSize * 0.9
    else if (event.key === 'PageUp') nextPosition = position - pageSize * 0.9
    else if (event.key === 'Home') nextPosition = 0
    else if (event.key === 'End') nextPosition = maxScroll

    if (nextPosition === null) return
    event.preventDefault()
    setScrollPosition(host, axis, Math.min(maxScroll, Math.max(0, nextPosition)))
    scheduleUpdate()
  }

  for (const [axis, state] of states) {
    state.track.addEventListener('pointerdown', event => startTrackJump(event, axis))
    state.thumb.addEventListener('pointerdown', event => startThumbDrag(event, axis))
    state.thumb.addEventListener('keydown', event => handleKeydown(event, axis))
  }

  host.addEventListener('scroll', scheduleUpdate, { passive: true })
  window.addEventListener('resize', scheduleUpdate, { passive: true })
  window.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true })

  if (typeof ResizeObserver !== 'undefined') {
    childResizeObserver = new ResizeObserver(scheduleUpdate)
    childResizeObserver.observe(host)
    for (const child of host.children) childResizeObserver.observe(child)
  }

  const mutationObserver = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(records => {
      if (childResizeObserver) {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLElement) childResizeObserver.observe(node)
          }
          for (const node of record.removedNodes) {
            if (node instanceof HTMLElement) childResizeObserver.unobserve(node)
          }
        }
      }
      scheduleUpdate()
    })
    : null
  mutationObserver?.observe(host, { childList: true, subtree: true, characterData: true })

  scheduleUpdate()

  return () => {
    endDrag()
    host.removeEventListener('scroll', scheduleUpdate)
    window.removeEventListener('resize', scheduleUpdate)
    window.removeEventListener('scroll', scheduleUpdate, true)
    if (updateFrame) window.cancelAnimationFrame(updateFrame)
    clearInterval(positionWatchTimer)
    if (hiddenRecoveryTimer !== null) {
      clearInterval(hiddenRecoveryTimer)
      hiddenRecoveryTimer = null
    }
    childResizeObserver?.disconnect()
    mutationObserver?.disconnect()
    for (const state of states.values()) state.track.remove()
    host.removeAttribute(HOST_ATTRIBUTE)
    if (!originalId) host.removeAttribute('id')
  }
}
