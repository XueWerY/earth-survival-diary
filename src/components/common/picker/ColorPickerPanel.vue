<template>
  <div class="color-picker-panel" @click.stop>
    <!-- 常用颜色 -->
    <div class="cpp-label">常用颜色</div>
    <div class="cpp-common-grid">
      <button
        v-for="(c, i) in commonColorList"
        :key="'cc' + i"
        class="cpp-grid-swatch"
        :class="{ active: selectedColor === c }"
        :style="{ background: c }"
        @click="selectColor(c)"
      ></button>
    </div>
    <div class="cpp-divider"></div>
    <!-- 自定义颜色 -->
    <div class="cpp-label">自定义颜色</div>
    <!-- 颜色选择器：十字准心 + 色相滑块 -->
    <div class="cpp-picker-area">
      <div class="cpp-spectrum" ref="spectrumRef" :style="{ background: 'linear-gradient(to right, #fff, ' + currentHueColor + ')' }" @pointerdown="onSpectrumDown">
        <div class="cpp-spectrum-white"></div>
        <div class="cpp-spectrum-black"></div>
        <div class="cpp-crosshair" :class="{ locked: crosshairLocked }" :style="{ left: spectrumX + '%', top: spectrumY + '%' }" @pointerdown.stop="toggleCrosshairLock"></div>
      </div>
      <div class="cpp-hue" ref="hueRef" @pointerdown="onHueDown">
        <div class="cpp-hue-thumb" :style="{ top: hueY + '%' }"></div>
      </div>
    </div>
    <!-- 数值输入 -->
    <div class="cpp-inputs">
      <div class="cpp-input-row">
        <span class="cpp-input-label">RGB</span>
        <input class="cpp-input" type="number" min="0" max="255" :value="rgb.r" @input="onRgbInput('r', $event)" />
        <input class="cpp-input" type="number" min="0" max="255" :value="rgb.g" @input="onRgbInput('g', $event)" />
        <input class="cpp-input" type="number" min="0" max="255" :value="rgb.b" @input="onRgbInput('b', $event)" />
      </div>
      <div class="cpp-input-row">
        <span class="cpp-input-label">HSL</span>
        <input class="cpp-input" type="number" min="0" max="360" :value="hsl.h" @input="onHslInput('h', $event)" />
        <input class="cpp-input" type="number" min="0" max="100" :value="hsl.s" @input="onHslInput('s', $event)" />
        <input class="cpp-input" type="number" min="0" max="100" :value="hsl.l" @input="onHslInput('l', $event)" />
      </div>
      <div class="cpp-input-row">
        <span class="cpp-input-label">HEX</span>
        <input class="cpp-input cpp-input-hex" type="text" :value="selectedColor" @input="onHexInput" />
      </div>
    </div>
    <!-- 预览 -->
    <div class="cpp-preview-row">
      <div class="cpp-preview-swatch" :style="{ background: selectedColor }"></div>
      <span class="cpp-preview-hex">{{ selectedColor }}</span>
    </div>
    <!-- 底部按钮 -->
    <div class="cpp-panel-actions cpp-panel-actions-center">
      <button class="cpp-action-btn cpp-action-cancel" @click="$emit('cancel')">取消</button>
      <button class="cpp-action-btn cpp-action-ok" @click="$emit('apply', selectedColor)">确定</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'apply', color: string): void
  (e: 'cancel'): void
}>()

const selectedColor = ref(props.modelValue || '#000000')
const spectrumX = ref(0)
const spectrumY = ref(0)
const hueY = ref(0)
const spectrumRef = ref<HTMLElement | null>(null)
const hueRef = ref<HTMLElement | null>(null)
const crosshairLocked = ref(false)
const hsl = reactive({ h: 0, s: 0, l: 0 })
const rgb = reactive({ r: 0, g: 0, b: 0 })

const currentHueColor = computed(() => hslToHex(hsl.h, 100, 50))

// 50个常用颜色，5行10列
const commonColorList = [
  '#FF0000', '#FF4444', '#FF8888', '#FFCCCC', '#FFE4E1', '#FF69B4', '#FF1493', '#DB7093', '#C71585', '#FFB6C1',
  '#FF4500', '#FF6347', '#FF7F50', '#FFA500', '#FFD700', '#FFFF00', '#FFFACD', '#FFEFD5', '#FFE4B5', '#FFDEAD',
  '#008000', '#00FF00', '#32CD32', '#90EE90', '#98FB98', '#00FA9A', '#00FF7F', '#3CB371', '#2E8B57', '#228B22',
  '#0000FF', '#4169E1', '#6495ED', '#87CEEB', '#00BFFF', '#00CED1', '#20B2AA', '#40E0D0', '#48D1CC', '#00FFFF',
  '#800080', '#8A2BE2', '#9370DB', '#BA55D3', '#DDA0DD', '#000000', '#808080', '#A9A9A9', '#D3D3D3', '#FFFFFF',
]

const selectColor = (color: string) => {
  selectedColor.value = color
  setColorFromHex(color)
}

const setColorFromHex = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  rgb.r = r; rgb.g = g; rgb.b = b
  const rr = r / 255, gg = g / 255, bb = b / 255
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
    else if (max === gg) h = ((bb - rr) / d + 2) / 6
    else h = ((rr - gg) / d + 4) / 6
  }
  hsl.h = Math.round(h * 360)
  hsl.s = Math.round(s * 100)
  hsl.l = Math.round(l * 100)
  hueY.value = hsl.h !== undefined ? ((360 - hsl.h) / 360) * 100 : 0
  spectrumX.value = hsl.s
  spectrumY.value = 100 - hsl.l
}

// 初始化颜色
setColorFromHex(selectedColor.value)

const hslToHex = (h: number, s: number, l: number): string => {
  const hh = h / 360
  const ss = s / 100
  const ll = l / 100
  let r: number, g: number, b: number
  if (ss === 0) {
    r = g = b = ll
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
    const p = 2 * ll - q
    r = hue2rgb(p, q, hh + 1 / 3)
    g = hue2rgb(p, q, hh)
    b = hue2rgb(p, q, hh - 1 / 3)
  }
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// 十字准心点击锁定/解锁
const toggleCrosshairLock = () => {
  crosshairLocked.value = !crosshairLocked.value
}

const onSpectrumDown = (e: PointerEvent) => {
  if (crosshairLocked.value) return
  updateSpectrum(e)
  const target = spectrumRef.value
  if (target) {
    target.setPointerCapture(e.pointerId)
    const onMove = (ev: PointerEvent) => {
      if (!crosshairLocked.value) updateSpectrum(ev)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', () => {
      target.removeEventListener('pointermove', onMove)
    }, { once: true })
  }
}

const updateSpectrum = (e: PointerEvent) => {
  const rect = spectrumRef.value?.getBoundingClientRect()
  if (!rect) return
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  spectrumX.value = x * 100
  spectrumY.value = y * 100
  hsl.s = Math.round(x * 100)
  hsl.l = Math.round((1 - y) * 100)
  const hex = hslToHex(hsl.h, hsl.s, hsl.l)
  selectedColor.value = hex
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  rgb.r = r; rgb.g = g; rgb.b = b
}

const onHueDown = (e: PointerEvent) => {
  updateHue(e)
  const target = hueRef.value
  if (target) {
    target.setPointerCapture(e.pointerId)
    target.addEventListener('pointermove', onHueDrag)
    target.addEventListener('pointerup', () => {
      target.removeEventListener('pointermove', onHueDrag)
    }, { once: true })
  }
}

const onHueDrag = (e: PointerEvent) => {
  updateHue(e)
}

const updateHue = (e: PointerEvent) => {
  const rect = hueRef.value?.getBoundingClientRect()
  if (!rect) return
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  hueY.value = y * 100
  hsl.h = Math.round((1 - y) * 360)
  const hex = hslToHex(hsl.h, hsl.s, hsl.l)
  selectedColor.value = hex
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  rgb.r = r; rgb.g = g; rgb.b = b
}

const onRgbInput = (channel: 'r' | 'g' | 'b', e: Event) => {
  const val = Math.max(0, Math.min(255, parseInt((e.target as HTMLInputElement).value) || 0))
  rgb[channel] = val
  const hex = '#' + [rgb.r, rgb.g, rgb.b].map(v => v.toString(16).padStart(2, '0')).join('')
  selectedColor.value = hex
  setColorFromHex(hex)
}

const onHslInput = (channel: 'h' | 's' | 'l', e: Event) => {
  const max = channel === 'h' ? 360 : 100
  const val = Math.max(0, Math.min(max, parseInt((e.target as HTMLInputElement).value) || 0))
  hsl[channel] = val
  const hex = hslToHex(hsl.h, hsl.s, hsl.l)
  selectedColor.value = hex
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  rgb.r = r; rgb.g = g; rgb.b = b
  spectrumX.value = hsl.s
  spectrumY.value = 100 - hsl.l
  hueY.value = ((360 - hsl.h) / 360) * 100
}

const onHexInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    selectedColor.value = val
    setColorFromHex(val)
  }
}
</script>

<style scoped>
.color-picker-panel {
  width: 280px;
  max-height: 90vh;
  overflow-y: auto;
  background: rgba(18, 16, 42, 0.96);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 自定义滚动条样式 */
.color-picker-panel::-webkit-scrollbar {
  width: 6px;
}

.color-picker-panel::-webkit-scrollbar-track {
  background: transparent;
}

.color-picker-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.color-picker-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.cpp-label {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
  font-weight: 600;
}

/* 50个常用颜色块，5行10列 */
.cpp-common-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
}

.cpp-grid-swatch {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s;
}

.cpp-grid-swatch:hover {
  border-color: rgba(255, 255, 255, 0.5);
}

.cpp-grid-swatch.active {
  border: 2px solid #93c5fd;
}

.cpp-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 8px 0;
}

/* 颜色选择器：十字准心 + 色相滑块 */
.cpp-picker-area {
  display: flex;
  gap: 8px;
  height: 120px;
  margin-top: 6px;
}

.cpp-spectrum {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  cursor: crosshair;
  touch-action: none;
}

.cpp-spectrum-white {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #000, transparent);
}

.cpp-spectrum-black {
  position: absolute;
  inset: 0;
  background: linear-gradient(to left, #000, transparent);
}

.cpp-crosshair {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.3);
  transform: translate(-50%, -50%);
  pointer-events: auto;
  cursor: pointer;
  z-index: 2;
  transition: box-shadow 0.15s;
}

.cpp-crosshair.locked {
  box-shadow: 0 0 3px rgba(0,0,0,0.5), 0 0 0 2px #93c5fd;
  border-color: #93c5fd;
}

.cpp-hue {
  width: 16px;
  flex-shrink: 0;
  position: relative;
  border-radius: 4px;
  cursor: pointer;
  touch-action: none;
  background: linear-gradient(to bottom,
    hsl(0, 100%, 50%),
    hsl(60, 100%, 50%),
    hsl(120, 100%, 50%),
    hsl(180, 100%, 50%),
    hsl(240, 100%, 50%),
    hsl(300, 100%, 50%),
    hsl(360, 100%, 50%)
  );
}

.cpp-hue-thumb {
  position: absolute;
  left: -2px;
  right: -2px;
  height: 4px;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 0 3px rgba(0,0,0,0.5);
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 2;
}

/* 数值输入 */
.cpp-inputs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
}

.cpp-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpp-input-label {
  width: 28px;
  font-size: 11px;
  color: #94a3b8;
  flex-shrink: 0;
  font-weight: 600;
}

.cpp-input {
  flex: 1;
  min-width: 0;
  height: 24px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 11px;
  font-family: monospace;
  padding: 0 6px;
  outline: none;
  text-align: center;
  -moz-appearance: textfield;
}

.cpp-input::-webkit-outer-spin-button,
.cpp-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.cpp-input-hex {
  flex: 1;
}

.cpp-input:focus {
  border-color: rgba(102, 126, 234, 0.5);
  background: rgba(255, 255, 255, 0.1);
}

/* 预览行 */
.cpp-preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
}

.cpp-preview-swatch {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.cpp-preview-hex {
  font-size: 12px;
  color: #94a3b8;
  font-family: monospace;
}

/* 底部按钮居中 */
.cpp-panel-actions-center {
  justify-content: center;
}

.cpp-panel-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}

.cpp-action-btn {
  padding: 4px 20px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  border: none;
  transition: all 0.15s;
}

.cpp-action-cancel {
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
}

.cpp-action-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #e0e0e0;
}

.cpp-action-ok {
  background: rgba(102, 126, 234, 0.3);
  color: #93c5fd;
}

.cpp-action-ok:hover {
  background: rgba(102, 126, 234, 0.5);
  color: #fff;
}
</style>