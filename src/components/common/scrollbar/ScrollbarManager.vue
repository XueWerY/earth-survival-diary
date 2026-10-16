<template>
  <!-- Installs custom scrollbars without adding a layout element. -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { attachCustomScrollbar, isCustomScrollbarOptedOut } from './scrollbarController'

const managed = new Map<HTMLElement, { detach: () => void; overflow: string }>()
let observer: MutationObserver | null = null

const getOverflowSignature = (element: HTMLElement) => {
  const style = getComputedStyle(element)
  return `${style.overflowX}|${style.overflowY}`
}

const isPotentialScrollHost = (element: HTMLElement) => {
  if (element === document.body || element === document.documentElement) return false
  if (element.hasAttribute('data-app-scrollbar-ui')) return false
  if (element.classList.contains('app-scrollbar')) return false
  if (isCustomScrollbarOptedOut(element)) return false

  const style = getComputedStyle(element)
  return ['auto', 'scroll', 'overlay'].includes(style.overflowX)
    || ['auto', 'scroll', 'overlay'].includes(style.overflowY)
}

const syncElement = (element: Element) => {
  if (!(element instanceof HTMLElement)) return
  const existing = managed.get(element)
  if (existing) {
    if (!isPotentialScrollHost(element)) {
      existing.detach()
      managed.delete(element)
      return
    }
    const overflow = getOverflowSignature(element)
    if (existing.overflow === overflow) return
    existing.detach()
    managed.delete(element)
  }

  if (element.hasAttribute('data-app-scrollbar-host') || !isPotentialScrollHost(element)) return
  const detach = attachCustomScrollbar(element, { direction: 'auto' })
  managed.set(element, { detach, overflow: getOverflowSignature(element) })
}

const scanSubtree = (node: Node) => {
  if (!(node instanceof Element)) return
  syncElement(node)
  for (const descendant of node.querySelectorAll('*')) syncElement(descendant)
}

const pruneDetached = () => {
  for (const [element, entry] of managed) {
    if (element.isConnected) continue
    entry.detach()
    managed.delete(element)
  }
}

const scanDocument = () => {
  if (document.body) scanSubtree(document.body)
  pruneDetached()
}

onMounted(() => {
  if (typeof document === 'undefined' || !document.body) return
  scanDocument()

  observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.target instanceof HTMLElement && record.target.hasAttribute('data-app-scrollbar-ui')) continue
        if (record.target instanceof Element) scanSubtree(record.target)
        continue
      }
      for (const node of record.addedNodes) scanSubtree(node)
    }
    pruneDetached()
  })

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'style'],
    childList: true,
    subtree: true,
  })
  window.addEventListener('resize', scanDocument, { passive: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  window.removeEventListener('resize', scanDocument)
  for (const entry of managed.values()) entry.detach()
  managed.clear()
})
</script>
