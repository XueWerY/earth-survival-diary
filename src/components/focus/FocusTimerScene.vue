<template>
  <canvas ref="canvasRef" class="flip-3d-canvas"></canvas>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import * as THREE from 'three'

const props = defineProps<{
  chars: string[]
  prevChars: string[]
  flippingIndices: Set<number>
  color: string
}>()

const canvasRef = ref<HTMLCanvasElement>()
const CARD_W = 0.9, CARD_H = 1.6, GAP = 0.1
const FONT = 'bold 44px "SF Mono","Consolas",monospace'

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let cardGroups: THREE.Group[] = []
let rafId = 0
let loopActive = false
let resizeObs: ResizeObserver | null = null

// 纹理缓存
const texCache = new Map<string, THREE.CanvasTexture>()

function makeTexture(char: string, half: 'top' | 'bottom'): THREE.CanvasTexture {
  const key = `${char}_${half}_${props.color}`
  if (texCache.has(key)) return texCache.get(key)!.clone()
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = props.color || '#fff'
  ctx.font = FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = half === 'top' ? 'top' : 'bottom'
  ctx.fillText(char, 64, half === 'top' ? 2 : 62)
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  texCache.set(key, tex)
  return tex.clone()
}

function buildCards() {
  cardGroups.forEach(g => { g.traverse(c => { if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose() }); scene.remove(g) })
  cardGroups = []

  const totalW = props.chars.length * (CARD_W + GAP) - GAP
  const startX = -totalW / 2 + CARD_W / 2

  props.chars.forEach((ch, i) => {
    const g = new THREE.Group()
    g.position.set(startX + i * (CARD_W + GAP), 0, 0)

    if (ch === ':') {
      // 冒号：简单平面
      const geo = new THREE.PlaneGeometry(CARD_W * 0.3, CARD_H)
      const mat = new THREE.MeshBasicMaterial({ color: props.color, transparent: true, opacity: 0.7 })
      const m = new THREE.Mesh(geo, mat)
      g.add(m)
      g.userData = { isColon: true }
    } else {
      // 底部半片（静态）
      const btmGeo = new THREE.PlaneGeometry(CARD_W, CARD_H / 2)
      const btmTex = makeTexture(ch, 'bottom')
      const btmMat = new THREE.MeshBasicMaterial({ map: btmTex, transparent: true, color: '#111' })
      const btm = new THREE.Mesh(btmGeo, btmMat)
      btm.position.y = -CARD_H / 4
      g.add(btm)

      // 上部静态平面（翻片后面）
      const topGeo = new THREE.PlaneGeometry(CARD_W, CARD_H / 2)
      const topTex = makeTexture(ch, 'top')
      const topMat = new THREE.MeshBasicMaterial({ map: topTex, transparent: true, color: '#111', depthWrite: true })
      const topStatic = new THREE.Mesh(topGeo, topMat)
      topStatic.position.y = CARD_H / 4
      topStatic.position.z = -0.01
      g.add(topStatic)

      // 翻片 pivot（铰链位于卡片中央 y=0）
      const pivot = new THREE.Group()
      pivot.position.y = 0
      g.add(pivot)

      // 翻片正面（旧数字）
      const oldTex = makeTexture(props.prevChars[i] || ch, 'top')
      const frontMat = new THREE.MeshBasicMaterial({ map: oldTex, transparent: true, color: '#181818', side: THREE.DoubleSide })
      const frontPlane = new THREE.Mesh(topGeo, frontMat)
      frontPlane.position.y = CARD_H / 4
      frontPlane.name = 'flapFront'
      pivot.add(frontPlane)

      // 翻片背面（新数字）
      const newTex = makeTexture(ch, 'top')
      const backMat = new THREE.MeshBasicMaterial({ map: newTex, transparent: true, color: '#181818', side: THREE.DoubleSide })
      const backPlane = new THREE.Mesh(topGeo, backMat)
      backPlane.position.y = CARD_H / 4
      backPlane.rotation.x = Math.PI
      backPlane.name = 'flapBack'
      pivot.add(backPlane)

      g.userData = { pivot }
    }

    scene.add(g)
    cardGroups.push(g)
  })
}

const activeFlips = new Map<number, { pivot: THREE.Group; startTime: number; newCh: string }>()

// 监听 flippingIndices 启动动画
watch(() => new Set(props.flippingIndices), (flips) => {
  flips.forEach(i => {
    const g = cardGroups[i]
    if (!g || g.userData.isColon) return
    const pivot = g.userData.pivot as THREE.Group
    if (!pivot) return

    // 更新底部纹理为新数字
    const btm = g.children[0] as THREE.Mesh
    const newBtmTex = makeTexture(props.chars[i], 'bottom')
    ;(btm.material as THREE.MeshBasicMaterial).map?.dispose()
    ;(btm.material as THREE.MeshBasicMaterial).map = newBtmTex
    ;(btm.material as THREE.MeshBasicMaterial).needsUpdate = true

    // 更新静态上部
    const topStatic = g.children[1] as THREE.Mesh
    const newTopTex = makeTexture(props.chars[i], 'top')
    ;(topStatic.material as THREE.MeshBasicMaterial).map?.dispose()
    ;(topStatic.material as THREE.MeshBasicMaterial).map = newTopTex
    ;(topStatic.material as THREE.MeshBasicMaterial).needsUpdate = true

    // 更新翻片背面纹理
    const backPlane = pivot.children.find(c => c.name === 'flapBack') as THREE.Mesh
    if (backPlane) {
      ;(backPlane.material as THREE.MeshBasicMaterial).map?.dispose()
      ;(backPlane.material as THREE.MeshBasicMaterial).map = makeTexture(props.chars[i], 'top')
      ;(backPlane.material as THREE.MeshBasicMaterial).needsUpdate = true
    }

    activeFlips.set(i, { pivot, startTime: performance.now(), newCh: props.chars[i] })
  })
})

function tick() {
  if (!loopActive) return
  rafId = requestAnimationFrame(tick)
  const now = performance.now()

  activeFlips.forEach((flip, i) => {
    const elapsed = (now - flip.startTime) / 1000
    const duration = 0.55
    if (elapsed >= duration) {
      flip.pivot.rotation.x = 0
      // 更新翻片正面纹理
      const g = cardGroups[i]
      if (g) {
        const pivot = g.userData.pivot as THREE.Group
        const frontPlane = pivot.children.find(c => c.name === 'flapFront') as THREE.Mesh
        if (frontPlane) {
          ;(frontPlane.material as THREE.MeshBasicMaterial).map?.dispose()
          ;(frontPlane.material as THREE.MeshBasicMaterial).map = makeTexture(flip.newCh, 'top')
          ;(frontPlane.material as THREE.MeshBasicMaterial).needsUpdate = true
        }
      }
      activeFlips.delete(i)
    } else {
      // ease-out 插值
      const t = elapsed / duration
      const eased = 1 - Math.pow(1 - t, 3)
      flip.pivot.rotation.x = -Math.PI * eased
    }
  })

  renderer.render(scene, camera)
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  const scale = Math.min(w / (props.chars.length * 2.5), h / 2.8, 2.5)
  camera.position.set(0, 0, scale)
}

function startLoop() {
  if (loopActive) return
  loopActive = true
  tick()
}

function stopLoop() {
  loopActive = false
  cancelAnimationFrame(rafId)
}

watch(() => props.chars, () => { buildCards() }, { deep: true })
watch(() => props.color, () => { texCache.clear(); buildCards() })

onMounted(() => {
  const canvas = canvasRef.value!
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
  camera.position.set(0, 0, 8)

  scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  const dl = new THREE.DirectionalLight(0xffffff, 0.3)
  dl.position.set(2, 3, 4)
  scene.add(dl)

  buildCards()
  resizeObs = new ResizeObserver(resize)
  resizeObs.observe(canvas)
  resize()
  startLoop()
})

onActivated(startLoop)
onDeactivated(stopLoop)

onUnmounted(() => {
  stopLoop()
  resizeObs?.disconnect()
  cardGroups.forEach(g => g.traverse(c => { if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose() }))
  texCache.forEach(t => t.dispose())
  texCache.clear()
  renderer.dispose()
})
</script>

<style scoped>
.flip-3d-canvas {
  display: block;
  width: 100%;
  height: 100px;
  margin-bottom: 48px;
}
</style>
