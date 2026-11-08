// 音视频使用独立的块节点，Markdown 持久化仍保存标准 HTML 标签和媒体引用。
import { $nodeSchema, $remark, $view } from '@milkdown/kit/utils'
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model'
import type { NodeView } from '@milkdown/kit/prose/view'
import { buildMediaTagText, parseMediaTagText, toPositiveInt, type EsdMediaAttrs, type EsdMediaKind } from './mediaMarkdown'
export { buildMediaTagText, parseMediaTagText } from './mediaMarkdown'

export const ESD_MEDIA_NODE = 'esdMedia' as const

let activeMediaPlayer: HTMLMediaElement | null = null
const coordinatedDocuments = new WeakSet<Document>()

function coordinateSingleMediaPlayback(doc: Document): void {
  if (coordinatedDocuments.has(doc)) return
  coordinatedDocuments.add(doc)
  doc.addEventListener('play', (event) => {
    const next = event.target
    if (!(next instanceof HTMLMediaElement)) return
    if (activeMediaPlayer && activeMediaPlayer !== next) activeMediaPlayer.pause()
    activeMediaPlayer = next
  }, true)
  const releaseActivePlayer = (event: Event): void => {
    if (event.target === activeMediaPlayer) activeMediaPlayer = null
  }
  doc.addEventListener('pause', releaseActivePlayer, true)
  doc.addEventListener('ended', releaseActivePlayer, true)
}

if (typeof document !== 'undefined') coordinateSingleMediaPlayback(document)

function audioTitleWithoutExtension(fileName: string): string {
  const baseName = String(fileName ?? '').split(/[\\/]/).pop() || ''
  const extensionStart = baseName.lastIndexOf('.')
  const title = extensionStart > 0 ? baseName.slice(0, extensionStart) : baseName
  return title || '未命名音频'
}

// ===== remark 扩展：mdast `html` → `esdMedia` =====

/** 最小 mdast 节点接口（不使用 any）；索引签名允许承载应用媒体属性 */
interface MdastNode {
  type?: string
  value?: unknown
  children?: MdastNode[]
  [key: string]: unknown
}

/** 可作为块级 esdMedia 容器的 mdast 父节点类型；其余容器视为内联上下文，不改写 */
const BLOCK_MEDIA_CONTAINERS = new Set(['root', 'blockquote', 'listItem'])

function rewriteMediaNodes(node: MdastNode): void {
  const children = node.children
  if (!Array.isArray(children)) return
  // 只在块级容器中改写：
  //   esdMedia 是 `group: 'block'` 节点。若把 paragraph/heading 等内联容器里的 html
  //   改写成块级节点，会形成「block 节点置于 inline 容器」的非法结构，
  //   下游 PM 解析可能报错或渲染异常（design R6 已知边界）。
  //   正常的媒体插入始终独占一段（块级 html），因此这里只放行块级容器。
  const inBlockContainer = BLOCK_MEDIA_CONTAINERS.has(String(node.type ?? ''))
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (!child) continue
    // remark 也会把独占一行的媒体标签拆为 paragraph 内的起止 html 节点。
    // 整段匹配后提升为块，兼容旧版被转义为 text 的媒体标签，避免块节点进入行内容器。
    if (inBlockContainer && child.type === 'paragraph' && Array.isArray(child.children)) {
      const parts = child.children
      if (parts.every(part => (part.type === 'html' || part.type === 'text') && typeof part.value === 'string')) {
        const attrs = parseMediaTagText(parts.map(part => part.value).join(''))
        if (attrs) {
          children[i] = { type: ESD_MEDIA_NODE, ...attrs }
          continue
        }
      }
    }
    // 只处理 html 节点：代码块内容在 code 节点里，天然隔离（design R5）
    if (child.type === 'html') {
      if (!inBlockContainer) continue // 内联 html：原样保留（已知边界，富文本不渲染但源码可见）
      const attrs = typeof child.value === 'string' ? parseMediaTagText(child.value) : null
      if (attrs) {
        // 就地改写为自定义节点；字段名与 parseMarkdown.runner 的读取一一对应
        children[i] = {
          type: ESD_MEDIA_NODE,
          ...attrs,
        }
        continue
      }
    }
    rewriteMediaNodes(child)
  }
}

/**
 * remark 插件：把 mdast 中的媒体 html 节点改写为 `esdMedia`。
 * 未命中的 html 节点原样保留（不破坏落盘）；签名接受 unknown 以便直接挂到
 * unified 的 Transformer 位置，内部再做最小接口收窄（避免 any）。
 */
export const remarkMediaHtml = $remark('remarkMediaHtml', () => () => transformMediaHtml)

function transformMediaHtml(tree: unknown): void {
  rewriteMediaNodes(tree as MdastNode)
}

// ===== 节点 attrs 读取辅助 =====

function readNodeAttrs(node: ProseMirrorNode): EsdMediaAttrs {
  const raw = node.attrs as Record<string, unknown>
  return {
    kind: raw.kind === 'audio' ? 'audio' : 'video',
    src: String(raw.src ?? ''),
    width: toPositiveInt(raw.width),
    height: toPositiveInt(raw.height),
    name: String(raw.name ?? ''),
    aspectLocked: raw.aspectLocked === true,
    layout: raw.layout === 'standalone' ? 'standalone' : 'flow',
  }
}

/**
 * parseDOM 的 attrs 读取：优先用运行期写上的 `data-media-ref`（原始引用），
 * 否则退回 src；src 为 data URL 且无 data-media-ref 时拒绝（不把 data URL 收进节点）。
 */
function readDomAttrs(dom: HTMLElement, kind: EsdMediaKind): EsdMediaAttrs | false {
  const ref = dom.getAttribute('data-media-ref') ?? ''
  const src = dom.getAttribute('src') ?? ''
  const effective = ref || src
  if (!effective) return false
  if (!ref && /^data:/i.test(effective)) return false
  return {
    kind,
    src: effective,
    width: toPositiveInt(dom.getAttribute('width')),
    height: toPositiveInt(dom.getAttribute('height')),
    name: dom.getAttribute('data-esd-name') ?? '',
    aspectLocked: dom.getAttribute('data-esd-aspect-locked') === 'true',
    layout: dom.getAttribute('data-esd-layout') === 'standalone' ? 'standalone' : 'flow',
  }
}

/** 把 attrs 同步到原生媒体元素；布局选择保存在 data-esd-layout 属性中。 */
function syncMediaDomElement(el: HTMLElement, attrs: EsdMediaAttrs): void {
  el.setAttribute('controls', '')
  el.setAttribute('controlsList', 'nodownload noremoteplayback')
  el.setAttribute('disableRemotePlayback', '')
  if (attrs.kind === 'video') el.setAttribute('preload', 'metadata')
  if (attrs.width) el.setAttribute('width', String(attrs.width))
  else el.removeAttribute('width')
  if (attrs.height) el.setAttribute('height', String(attrs.height))
  else el.removeAttribute('height')
  if (attrs.name) el.setAttribute('data-esd-name', attrs.name)
  else el.removeAttribute('data-esd-name')
  if (attrs.aspectLocked) el.setAttribute('data-esd-aspect-locked', 'true')
  else el.removeAttribute('data-esd-aspect-locked')
  if (attrs.layout === 'standalone') el.setAttribute('data-esd-layout', 'standalone')
  else el.removeAttribute('data-esd-layout')
  if (attrs.kind === 'video') {
    el.style.width = attrs.width ? `${attrs.width}px` : ''
    el.style.height = attrs.height ? `${attrs.height}px` : ''
  } else {
    el.style.width = attrs.width ? `${attrs.width}px` : 'min(520px, 80vw)'
  }
  if (!/^(?:esd-local-media:\/\/|(?:\.\/)?media\/)/.test(attrs.src)) el.setAttribute('src', attrs.src)
  // 供尺寸横条反查 markdown 源；不会进入落盘 markdown
  el.setAttribute('data-media-ref', attrs.src)
}

// ===== 节点 schema（双向序列化） =====

export const esdMediaSchema = $nodeSchema(ESD_MEDIA_NODE, () => ({
  group: 'block',
  atom: true,
  isolating: true,
  draggable: true,
  attrs: {
    kind: { default: 'video' },
    src: { default: '' },
    width: { default: null },
    height: { default: null },
    name: { default: '' },
    aspectLocked: { default: false },
    layout: { default: 'flow' },
  },
  parseDOM: [
    {
      tag: 'video',
      getAttrs: (dom) => readDomAttrs(dom as HTMLElement, 'video'),
    },
    {
      tag: 'audio',
      getAttrs: (dom) => readDomAttrs(dom as HTMLElement, 'audio'),
    },
  ],
  toDOM: (node) => {
    const attrs = readNodeAttrs(node)
    // 返回原生元素（与 wikiLink 一致）：HTML 序列化 / 剪贴板 / parseDOM 往返都走这里。
    // 编辑器内实际渲染由 MediaNodeView 接管。
    const el = document.createElement(attrs.kind)
    syncMediaDomElement(el, attrs)
    return el
  },
  parseMarkdown: {
    match: (node) => node.type === ESD_MEDIA_NODE,
    runner: (state, node, type) => {
      const raw = node as MdastNode
      state.addNode(type, {
        kind: raw.kind === 'audio' ? 'audio' : 'video',
        src: String(raw.src ?? ''),
        width: toPositiveInt(raw.width),
        height: toPositiveInt(raw.height),
        name: String(raw.name ?? ''),
        aspectLocked: raw.aspectLocked === true,
        layout: raw.layout === 'standalone' ? 'standalone' : 'flow',
      })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === ESD_MEDIA_NODE,
    runner: (state, node) => {
      const attrs = readNodeAttrs(node)
      // 必须用 html 节点逐字写回标签（与 wikiLink.ts 同法）：
      // text 节点会被 remark-stringify 转义 `<` `>`，破坏 HTML 标签与落盘协议。
      state.addNode('html', undefined, buildMediaTagText(attrs))
    },
  },
}))

// ===== NodeView：主题化媒体控件 =====

/**
 * 视频和音频都使用应用内主题控件；原生媒体元素只负责解码与播放。
 *
 * - `ignoreMutation()` 恒 true：媒体元素自身（如浏览器对播放状态的属性变更）
 *   不应被 PM 当作文档变更，避免无谓事务 / 死循环；
 * - `stopEvent()` 把播放器交互交还给原生元素，同时放行拖放事件让 ProseMirror
 *   能够重新排列媒体块；
 * - `update()` 同步 attrs 到 DOM（尺寸/引用），keep 已被渲染层换成流式 URL 的 src。
 */
export class MediaNodeView implements NodeView {
  readonly dom: HTMLElement
  private readonly player: HTMLMediaElement
  private readonly resizeHandle: HTMLDivElement
  private readonly cleanup: Array<() => void> = []
  private pointerStartX = 0
  private pointerStartY = 0
  private pointerStartWidth = 0

  constructor(node: ProseMirrorNode) {
    coordinateSingleMediaPlayback(document)
    const attrs = readNodeAttrs(node)
    const el = document.createElement(attrs.kind)
    syncMediaDomElement(el, attrs)
    this.player = el
    const wrapper = document.createElement('div')
    wrapper.className = 'esd-media-block'
    wrapper.dataset.kind = attrs.kind
    wrapper.dataset.esdLayout = attrs.layout
    const playerWrapper = document.createElement('div')
    playerWrapper.className = 'esd-media-player-wrap'
    this.resizeHandle = document.createElement('div')
    this.resizeHandle.className = 'esd-media-resize-handle'
    this.resizeHandle.setAttribute('role', 'slider')
    this.resizeHandle.setAttribute('aria-label', `调整${attrs.kind === 'video' ? '视频' : '音频'}宽度`)
    this.resizeHandle.tabIndex = 0
    this.resizeHandle.title = '拖动横条调整尺寸'
    this.resizeHandle.addEventListener('pointerdown', this.onPointerDown)
    this.resizeHandle.addEventListener('keydown', this.onResizeKeydown)
    if (attrs.kind === 'video') {
      el.removeAttribute('controls')
      el.setAttribute('controlsList', 'nodownload noremoteplayback')
      el.setAttribute('disablePictureInPicture', '')
      el.setAttribute('playsinline', '')
      const shell = document.createElement('div')
      shell.className = 'esd-player-shell esd-video-shell'
      shell.dataset.paused = 'true'
      shell.append(el)
      this.buildMediaControls(shell, el as HTMLVideoElement, 'video')
      shell.append(this.resizeHandle)
      playerWrapper.append(shell)
    } else {
      el.removeAttribute('controls')
      el.setAttribute('controlsList', 'nodownload noremoteplayback')
      el.removeAttribute('style')
      el.setAttribute('preload', 'metadata')
      const shell = document.createElement('div')
      shell.className = 'esd-player-shell esd-audio-shell'
      shell.dataset.paused = 'true'
      if (attrs.width) shell.style.width = `${attrs.width}px`
      const title = document.createElement('div')
      title.className = 'esd-audio-title'
      title.textContent = audioTitleWithoutExtension(attrs.name)
      shell.append(title, el)
      this.buildMediaControls(shell, el, 'audio')
      shell.append(this.resizeHandle)
      playerWrapper.append(shell)
    }
    // 媒体文件名保留在 Markdown 元数据中；仅音频播放器标题展示去扩展名后的名称。
    wrapper.append(playerWrapper)
    this.syncResizeHandle(attrs)
    this.dom = wrapper
  }

  private readonly onNativeContextMenu = (event: Event): void => event.preventDefault()

  private listen(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener)
    this.cleanup.push(() => target.removeEventListener(type, listener))
  }

  private buildMediaControls(shell: HTMLDivElement, media: HTMLMediaElement, kind: 'video' | 'audio'): void {
    const button = (label: string, ariaLabel: string, className = 'esd-player-button'): HTMLButtonElement => {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = className
      element.textContent = label
      element.setAttribute('aria-label', ariaLabel)
      return element
    }
    const controls = document.createElement('div')
    controls.className = 'esd-player-controls'
    const progress = document.createElement('input')
    progress.className = 'esd-player-progress'
    progress.type = 'range'
    progress.min = '0'
    progress.max = '0'
    progress.step = '0.1'
    progress.value = '0'
    progress.setAttribute('aria-label', `${kind === 'video' ? '视频' : '音频'}进度`)
    const toolbar = document.createElement('div')
    toolbar.className = 'esd-player-toolbar'
    const leftControls = document.createElement('div')
    leftControls.className = 'esd-player-controls-left'
    const rightControls = document.createElement('div')
    rightControls.className = 'esd-player-controls-right'
    const play = button('', `播放${kind === 'video' ? '视频' : '音频'}`)
    play.classList.add('esd-player-play')
    const setPlayIcon = (paused: boolean): void => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('width', '18')
      svg.setAttribute('height', '18')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', paused ? 'M8 5v14l11-7z' : 'M7 5h4v14H7zM13 5h4v14h-4z')
      path.setAttribute('fill', 'currentColor')
      svg.append(path)
      play.replaceChildren(svg)
    }
    const time = document.createElement('span')
    time.className = 'esd-player-time'
    time.textContent = '0:00 / 0:00'
    const volumeButton = button('🔊', '静音')
    volumeButton.classList.add('esd-player-volume-button')
    const setVolumeIcon = (muted: boolean): void => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('width', '19')
      svg.setAttribute('height', '19')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', 'M4 10v4h4l5 4V6l-5 4H4z')
      path.setAttribute('fill', 'currentColor')
      svg.append(path)
      const wave = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      wave.setAttribute('d', muted ? 'm17 9 4 6m0-6-4 6' : 'M16 9a4 4 0 0 1 0 6m2-9a7 7 0 0 1 0 12')
      wave.setAttribute('fill', 'none')
      wave.setAttribute('stroke', 'currentColor')
      wave.setAttribute('stroke-width', '2')
      wave.setAttribute('stroke-linecap', 'round')
      svg.append(wave)
      volumeButton.replaceChildren(svg)
    }
    const volume = document.createElement('input')
    volume.className = 'esd-player-volume'
    volume.type = 'range'
    volume.min = '0'
    volume.max = '1'
    volume.step = '0.05'
    volume.value = String(media.volume)
    volume.setAttribute('aria-label', '音量')
    const fullscreen = button('⛶', kind === 'video' ? '全屏播放' : '最大化音频播放器')
    const menuButton = button('⋮', '更多播放选项')
    menuButton.classList.add('esd-player-menu-toggle')
    leftControls.append(play, time)
    rightControls.append(volumeButton, volume, fullscreen, menuButton)
    toolbar.append(leftControls, rightControls)
    controls.append(progress, toolbar)

    const menu = document.createElement('div')
    menu.className = 'esd-player-menu'
    menu.hidden = true
    menu.setAttribute('role', 'menu')
    const speedToggle = button('播放速度　1×　›', '选择播放速度', 'esd-player-menu-item')
    const speedOptions = document.createElement('div')
    speedOptions.className = 'esd-player-speed-options'
    speedOptions.hidden = true
    speedOptions.setAttribute('role', 'group')
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const speedButtons = speeds.map(speed => {
      const speedButton = button(`${speed}×`, `播放速度 ${speed} 倍`, 'esd-player-speed-option')
      speedButton.dataset.speed = String(speed)
      speedOptions.append(speedButton)
      return speedButton
    })
    const pip = kind === 'video' ? button('画中画', '在应用右下角显示画中画', 'esd-player-menu-item') : null
    menu.append(speedToggle, speedOptions)
    if (pip) menu.append(pip)
    const closePip = kind === 'video' ? button('×', '退出画中画', 'esd-player-pip-close') : null
    shell.append(controls, menu)
    if (closePip) shell.append(closePip)

    const formatTime = (value: number): string => {
      if (!Number.isFinite(value) || value < 0) return '0:00'
      const seconds = Math.floor(value)
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const remainder = String(seconds % 60).padStart(2, '0')
      return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`
    }
    const setTextNode = (element: HTMLElement, value: string): void => {
      const textNode = element.firstChild
      if (textNode?.nodeType === Node.TEXT_NODE) {
        if (textNode.nodeValue !== value) textNode.nodeValue = value
      } else element.textContent = value
    }
    let previousMuted: boolean | null = null
    let previousPaused: boolean | null = null
    const syncControls = (): void => {
      if (previousPaused !== media.paused) {
        setPlayIcon(media.paused)
        play.setAttribute('aria-label', `${media.paused ? '播放' : '暂停'}${kind === 'video' ? '视频' : '音频'}`)
        previousPaused = media.paused
      }
      shell.dataset.paused = String(media.paused)
      const duration = Number.isFinite(media.duration) ? media.duration : 0
      progress.max = String(duration)
      progress.value = String(Math.min(media.currentTime || 0, duration))
      const displayTime = `${formatTime(media.currentTime)} / ${formatTime(duration)}`
      setTextNode(time, displayTime)
      const muted = media.muted || media.volume === 0
      if (previousMuted !== muted) {
        setVolumeIcon(muted)
        previousMuted = muted
      }
      volumeButton.setAttribute('aria-label', muted ? '取消静音' : '静音')
      volume.value = String(media.muted ? 0 : media.volume)
      const currentSpeed = `${media.playbackRate}×`
      const speedLabel = `播放速度　${currentSpeed}　›`
      setTextNode(speedToggle, speedLabel)
      for (const option of speedButtons) {
        option.classList.toggle('active', Number(option.dataset.speed) === media.playbackRate)
      }
    }

    const positionMenuAboveToggle = (): void => {
      const shellRect = shell.getBoundingClientRect()
      const triggerRect = menuButton.getBoundingClientRect()
      const triggerRight = triggerRect.right - shellRect.left - shell.clientLeft
      const triggerTop = triggerRect.top - shellRect.top - shell.clientTop
      menu.style.right = `${Math.max(0, shell.clientWidth - triggerRight)}px`
      menu.style.bottom = `${Math.max(0, shell.clientHeight - triggerTop + 6)}px`
    }

    this.listen(play, 'click', () => {
      if (media.paused) void media.play().catch(() => undefined)
      else media.pause()
    })
    this.listen(progress, 'input', () => {
      if (Number.isFinite(media.duration)) media.currentTime = Number(progress.value)
    })
    this.listen(volumeButton, 'click', () => {
      if (media.muted || media.volume === 0) {
        if (media.volume === 0) media.volume = 0.5
        media.muted = false
      } else media.muted = true
    })
    this.listen(volume, 'input', () => {
      media.volume = Number(volume.value)
      media.muted = media.volume === 0
    })
    this.listen(fullscreen, 'click', () => {
      if (document.fullscreenElement === shell) void document.exitFullscreen().catch(() => undefined)
      else void shell.requestFullscreen().catch(() => undefined)
    })
    const syncFullscreenLabel = (): void => {
      const expanded = document.fullscreenElement === shell
      fullscreen.setAttribute('aria-label', expanded
        ? (kind === 'video' ? '退出全屏' : '退出最大化')
        : (kind === 'video' ? '全屏播放' : '最大化音频播放器'))
    }
    this.listen(document, 'fullscreenchange', syncFullscreenLabel)
    this.listen(menuButton, 'click', () => {
      if (menu.hidden) positionMenuAboveToggle()
      menu.hidden = !menu.hidden
      speedOptions.hidden = true
      menuButton.setAttribute('aria-expanded', String(!menu.hidden))
    })
    this.listen(window, 'resize', () => {
      if (!menu.hidden) positionMenuAboveToggle()
    })
    this.listen(speedToggle, 'click', () => { speedOptions.hidden = !speedOptions.hidden })
    for (const option of speedButtons) {
      this.listen(option, 'click', () => {
        media.playbackRate = Number(option.dataset.speed)
        syncControls()
        speedOptions.hidden = true
      })
    }
    if (kind === 'video' && pip && closePip) {
      const togglePip = (): void => {
        const enabled = shell.dataset.pip !== 'true'
        shell.dataset.pip = String(enabled)
        this.dom.dataset.pip = String(enabled)
        menu.hidden = true
        menuButton.setAttribute('aria-expanded', 'false')
      }
      this.listen(pip, 'click', togglePip)
      this.listen(closePip, 'click', togglePip)
    }
    this.listen(shell, 'contextmenu', this.onNativeContextMenu)
    for (const eventName of ['timeupdate', 'durationchange', 'loadedmetadata', 'play', 'pause', 'volumechange', 'ratechange', 'ended']) {
      this.listen(media, eventName, syncControls)
    }
    syncControls()
  }

  private syncResizeHandle(attrs: EsdMediaAttrs): void {
    const locked = attrs.kind === 'video' && attrs.aspectLocked
    this.resizeHandle.hidden = locked
    this.resizeHandle.setAttribute('aria-disabled', String(locked))
    this.resizeHandle.dataset.locked = String(locked)
  }

  private currentWidth(): number {
    const width = toPositiveInt(this.player.getAttribute('width'))
    if (width) return width
    const display = this.player.closest<HTMLElement>('.esd-player-shell') ?? this.player
    const rect = display.getBoundingClientRect()
    return Math.round(rect.width) || (this.player.tagName.toLowerCase() === 'audio' ? 520 : 640)
  }

  private dispatchResize(width: number): void {
    const kind = this.player.tagName.toLowerCase()
    const safeWidth = Math.max(kind === 'audio' ? 180 : 80, Math.min(kind === 'audio' ? 520 : 720, Math.round(width)))
    let height: number | undefined
    if (kind === 'video') {
      const video = this.player as HTMLVideoElement
      const currentWidth = toPositiveInt(video.getAttribute('width'))
      const currentHeight = toPositiveInt(video.getAttribute('height'))
      const ratio = video.videoWidth > 0 && video.videoHeight > 0
        ? video.videoWidth / video.videoHeight
        : currentWidth && currentHeight ? currentWidth / currentHeight : 16 / 9
      height = Math.max(1, Math.round(safeWidth / ratio))
    }
    this.resizeHandle.dispatchEvent(new CustomEvent('esd-media-resize', {
      bubbles: true,
      detail: { width: safeWidth, height },
    }))
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.resizeHandle.dataset.locked === 'true' || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    this.pointerStartX = event.clientX
    this.pointerStartY = event.clientY
    this.pointerStartWidth = this.currentWidth()
    this.resizeHandle.setPointerCapture(event.pointerId)
    this.resizeHandle.addEventListener('pointermove', this.onPointerMove)
    this.resizeHandle.addEventListener('pointerup', this.onPointerEnd, { once: true })
    this.resizeHandle.addEventListener('pointercancel', this.onPointerEnd, { once: true })
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.resizeHandle.hasPointerCapture(event.pointerId)) return
    const deltaX = event.clientX - this.pointerStartX
    const deltaY = this.pointerStartY - event.clientY
    const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY
    this.dispatchResize(this.pointerStartWidth + delta * 2)
  }

  private readonly onPointerEnd = (event: PointerEvent): void => {
    this.resizeHandle.removeEventListener('pointermove', this.onPointerMove)
    if (this.resizeHandle.hasPointerCapture(event.pointerId)) this.resizeHandle.releasePointerCapture(event.pointerId)
  }

  private readonly onResizeKeydown = (event: KeyboardEvent): void => {
    if (this.resizeHandle.dataset.locked === 'true') return
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowDown' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp') return
    event.preventDefault()
    this.dispatchResize(this.currentWidth() + (event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 20 : -20))
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type.name !== ESD_MEDIA_NODE) return false
    const attrs = readNodeAttrs(node)
    // kind 变化无法就地改元素标签 → 让 PM 重建 NodeView
    if (this.player.tagName.toLowerCase() !== attrs.kind) return false
    const prevRef = this.player.getAttribute('data-media-ref') ?? ''
    this.player.setAttribute('controlsList', 'nodownload noremoteplayback')
    if (attrs.kind === 'video') {
      this.player.removeAttribute('controls')
      this.player.setAttribute('disablePictureInPicture', '')
      this.player.setAttribute('preload', 'metadata')
    } else {
      this.player.removeAttribute('controls')
      this.player.setAttribute('preload', 'metadata')
      this.player.removeAttribute('disablePictureInPicture')
    }
    if (attrs.width) this.player.setAttribute('width', String(attrs.width))
    else this.player.removeAttribute('width')
    if (attrs.height) this.player.setAttribute('height', String(attrs.height))
    else this.player.removeAttribute('height')
    if (attrs.name) this.player.setAttribute('data-esd-name', attrs.name)
    else this.player.removeAttribute('data-esd-name')
    if (attrs.kind === 'audio') {
      const audioTitle = this.dom.querySelector<HTMLElement>('.esd-audio-title')
      if (audioTitle) audioTitle.textContent = audioTitleWithoutExtension(attrs.name)
    }
    if (attrs.aspectLocked) this.player.setAttribute('data-esd-aspect-locked', 'true')
    else this.player.removeAttribute('data-esd-aspect-locked')
    if (attrs.layout === 'standalone') this.player.setAttribute('data-esd-layout', 'standalone')
    else this.player.removeAttribute('data-esd-layout')
    // 引用未变时不要重写 src：此时 DOM 上的 src 已被 resolveMediaReferencesInDom
    // 换成流式 URL，重写回引用会导致画面闪断并需再次解析。
    if (prevRef !== attrs.src) {
      this.player.setAttribute('data-media-ref', attrs.src)
      this.player.removeAttribute('data-media-resolved')
      this.player.removeAttribute('data-media-missing')
      this.dom.removeAttribute('data-media-missing')
      this.player.hidden = false
      const videoShell = this.dom.querySelector<HTMLDivElement>('.esd-video-shell')
      if (videoShell) {
        videoShell.hidden = false
        videoShell.dataset.pip = 'false'
        this.dom.removeAttribute('data-pip')
      }
      const audioShell = this.dom.querySelector<HTMLDivElement>('.esd-audio-shell')
      if (audioShell) audioShell.hidden = false
      this.dom.querySelector('.esd-media-failure')?.remove()
      if (/^(?:esd-local-media:\/\/|(?:\.\/)?media\/)/.test(attrs.src)) this.player.removeAttribute('src')
      else this.player.setAttribute('src', attrs.src)
    }
    this.dom.dataset.esdLayout = attrs.layout
    if (attrs.kind === 'audio') {
      this.player.style.width = ''
      const audioShell = this.dom.querySelector<HTMLDivElement>('.esd-audio-shell')
      if (audioShell) audioShell.style.width = attrs.width ? `${attrs.width}px` : ''
    } else {
      this.player.style.width = attrs.width ? `${attrs.width}px` : ''
      this.player.style.height = attrs.height ? `${attrs.height}px` : ''
    }
    this.syncResizeHandle(attrs)
    return true
  }

  destroy(): void {
    this.resizeHandle.removeEventListener('pointerdown', this.onPointerDown)
    this.resizeHandle.removeEventListener('pointermove', this.onPointerMove)
    this.resizeHandle.removeEventListener('keydown', this.onResizeKeydown)
    for (const dispose of this.cleanup.splice(0)) dispose()
    this.player.pause()
    this.player.removeAttribute('src')
    this.player.load()
  }

  ignoreMutation(): boolean {
    return true
  }

  stopEvent(event: Event): boolean {
    const target = event.target
    if (!(target instanceof Node) || !this.dom.contains(target)) return false
    // 保留媒体播放交互，同时让 ProseMirror 接管媒体块拖放，便于重新排列媒体顺序。
    return !['dragstart', 'dragenter', 'dragover', 'drop'].includes(event.type)
  }
}

/**
 * NodeView 注册插件。
 *
 * 说明：Milkdown 的 `$nodeSchema` spec 等价于 ProseMirror `NodeSpec`，**不支持**
 * 在其内部声明 `view`（design 2.1.3(5) 的 `view: () => MediaNodeView` 为抽象描述）。
 * Milkdown 的官方做法是用 `$view` 组合子把 NodeView 注册到 `nodeViewCtx`，
 * 因此这里额外导出 `esdMediaView`，由 `MilkdownEditor` 与 schema 一起 `use`。
 * 注意 `NodeViewConstructor` 是「返回 NodeView 的函数」而非构造器，故这里用工厂函数。
 */
export const esdMediaView = $view(
  esdMediaSchema.node,
  () => (node: ProseMirrorNode) => new MediaNodeView(node),
)
