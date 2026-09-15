import { onBeforeUnmount, type Ref } from 'vue'
import gsap from 'gsap'

/** 是否尊重系统「减少动态效果」偏好（全局动效开关） */
export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * 按视觉位置排序（同行从左到右，换行自上而下）。
 * 使 stagger 呈「行优先」顺序，避免深色主题下时序交错的 Z 字形闪烁。
 */
function sortByPosition(targets: NodeListOf<HTMLElement>): HTMLElement[] {
  return [...targets].sort((a, b) => {
    if (Math.abs(a.offsetTop - b.offsetTop) > 8) return a.offsetTop - b.offsetTop
    return a.offsetLeft - b.offsetLeft
  })
}

/**
 * 卡片进场动效：卡片逐个出现（页面先空，再一张接一张上浮淡入）。
 * 由调用方在 onMounted / 数据变化 watch 中主动调用 play()。
 * - 初始即隐藏：play() 同步先把全部卡片置于隐藏态，杜绝"先全部可见再逐个重绘"的闪烁；
 * - 逐个出现：stagger 间隔拉长，视觉上"一张接一张"依次浮现；
 * - 防抖合并：数据加载期间连续触发只执行最后一次，保证动画完整收敛；
 * - 互斥清理：任何中断都会先恢复元素到最终态并清除内联样式；
 * - 动画期间屏蔽 CSS transition，避免与 GSAP 逐帧写入冲突。
 * @param containerRef 容器元素引用
 * @param selector     需要动效的子元素选择器
 */
export function useCardEntrance(containerRef: Ref<HTMLElement | null>, selector: string) {
  let tl: gsap.core.Timeline | null = null
  let playTimer: ReturnType<typeof setTimeout> | null = null

  /** 一次性暂存并屏蔽 CSS transition（幂等：只在首次暂存，避免重复读取被改过的值） */
  const stashTransition = (t: HTMLElement) => {
    if (t.dataset.motionTrans === undefined) {
      t.dataset.motionTrans = t.style.transition || ''
      t.style.transition = 'none'
    }
  }
  /** 还原 CSS transition */
  const restoreTransition = (t: HTMLElement) => {
    if (t.dataset.motionTrans !== undefined) {
      t.style.transition = t.dataset.motionTrans
      delete t.dataset.motionTrans
    }
  }

  /** 把目标元素恢复为最终可见状态，清除 GSAP 残留的内联样式与临时 transition 屏蔽 */
  const resetToFinal = (targets: NodeListOf<HTMLElement> | HTMLElement[]) => {
    if (!targets || targets.length === 0) return
    ;[...targets].forEach(restoreTransition)
    gsap.set(targets, { y: 0, opacity: 1, clearProps: 'transform,opacity' })
  }

  const play = () => {
    // 同步先隐藏当前可见的卡片：让页面在动画正式开始前就是"空白"状态，
    // 避免先渲染出全部卡片、再逐张清空重绘的闪变
    const nowEl = containerRef.value
    if (nowEl && !prefersReducedMotion) {
      const current = nowEl.querySelectorAll<HTMLElement>(selector)
      if (current.length) {
        ;[...current].forEach(stashTransition)
        gsap.set(current, { y: 10, opacity: 0 })
      }
    }

    // 防抖：同一批次多次触发合并为最后一次，动画不会被中途 kill 而卡在中间帧
    if (playTimer) clearTimeout(playTimer)
    playTimer = setTimeout(() => {
      playTimer = null
      const el = containerRef.value

      // 无论后续是否匹配到目标，先终止旧动画并恢复元素到最终态，防止残留中间帧
      if (tl) {
        if (el) resetToFinal(el.querySelectorAll(selector))
        tl.kill()
        tl = null
      }

      if (!el || prefersReducedMotion) return
      const all = el.querySelectorAll<HTMLElement>(selector)
      if (all.length === 0) return

      const targets = sortByPosition(all)
      resetToFinal(targets)

      // 全部卡片同步置为初始隐藏态（页面空白），再由 stagger 一张张浮现
      ;[...targets].forEach(stashTransition)
      gsap.set(targets, { y: 10, opacity: 0 })

      tl = gsap.timeline()
      tl.to(targets, {
        y: 0,
        opacity: 1,
        duration: 0.36,
        ease: 'power2.out',
        stagger: 0.16,
        overwrite: true,
      })
        .set(targets, { clearProps: 'transform,opacity' })
        .call(() => [...targets].forEach(restoreTransition))
    }, 150)
  }

  /** 立即取消：清掉挂起的防抖与进行中的动画，并恢复元素到最终态 */
  const cancel = () => {
    if (playTimer) { clearTimeout(playTimer); playTimer = null }
    if (tl) {
      const el = containerRef.value
      if (el) resetToFinal(el.querySelectorAll(selector))
      tl.kill()
      tl = null
    }
  }

  const stop = () => { cancel() }

  onBeforeUnmount(stop)
  return { play, stop, cancel }
}

/**
 * 数字滚动动效：从当前值平滑过渡到目标值。
 * 用于倒计时天数、专注时长等数字变化场景。
 * @param onChange 每帧回调当前（取整）值
 */
export function useCountTween(getValue: () => number, onChange: (v: number) => void, duration = 0.6) {
  const obj = { v: getValue() }
  let tween: gsap.core.Tween | null = null

  const to = (v: number) => {
    if (prefersReducedMotion) { onChange(v); obj.v = v; return }
    if (tween) tween.kill()
    tween = gsap.to(obj, {
      v,
      duration,
      ease: 'power1.out',
      onUpdate: () => onChange(Math.round(obj.v)),
      onComplete: () => onChange(v),
    })
  }

  const kill = () => { if (tween) tween.kill() }
  onBeforeUnmount(kill)
  return { to, kill }
}