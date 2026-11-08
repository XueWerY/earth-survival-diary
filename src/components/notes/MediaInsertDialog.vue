<template>
  <BaseDialog :visible="visible" :title="title" :width="680" teleport :no-overlay-close="busy" @update:visible="close">
    <div class="media-insert-dialog" @keydown.esc.stop.prevent="close">
      <input ref="fileInput" class="mi-file-input" type="file" :accept="accept" :disabled="busy" @change="onFileInput">
      <div class="mi-layout">
        <div class="mi-stage" :class="{ 'mi-stage-empty': !previewUrl }" @dragover.prevent @drop.prevent="onDrop">
          <template v-if="previewUrl">
            <img v-if="kind === 'image'" ref="imageRef" :key="previewUrl" :src="previewUrl" :alt="altDraft" @load="onImageLoad" @error="onPreviewError">
            <video v-else-if="kind === 'video'" ref="mediaRef" :key="previewUrl" :src="previewUrl" controls controlslist="nodownload noplaybackrate noremoteplayback" disablepictureinpicture playsinline preload="metadata" @contextmenu.prevent @loadedmetadata="onMetadata" @error="onPreviewError"></video>
            <audio v-else ref="mediaRef" :key="previewUrl" :src="previewUrl" controls controlslist="nodownload noplaybackrate noremoteplayback" @contextmenu.prevent preload="metadata" @loadedmetadata="onMetadata" @error="onPreviewError"></audio>
            <span v-if="previewState === 'loading'" class="mi-loading" role="status">正在载入预览…</span>
          </template>
          <button v-else type="button" class="mi-choose" :disabled="busy" @click="fileInput?.click()">
            <span class="mi-upload-symbol" aria-hidden="true">{{ kind === 'image' ? '▧' : kind === 'video' ? '▷' : '♫' }}</span>
            <strong>{{ editMode ? '选择替换文件' : '选择' + label + '文件' }}</strong>
            <span>{{ editMode ? '不选择文件时只保存当前设置' : '也可以将文件拖到这里' }}</span>
          </button>
        </div>
        <div class="mi-settings">
          <div class="mi-file-summary">
            <span class="mi-eyebrow">本地{{ label }}</span>
            <strong class="mi-file-name" :title="fileName">{{ fileName || ('尚未选择' + label) }}</strong>
            <span class="mi-file-meta">{{ fileDescription }}</span>
            <button v-if="editMode || previewUrl" type="button" class="mi-text-button" :disabled="busy" @click="fileInput?.click()">更换文件</button>
          </div>
          <fieldset class="mi-layout-choice" :disabled="busy">
            <legend>媒体排版</legend>
            <button type="button" :class="{ active: layoutDraft === 'flow' }" :aria-pressed="layoutDraft === 'flow'" @click="layoutDraft = 'flow'">与相邻媒体并排</button>
            <button type="button" :class="{ active: layoutDraft === 'standalone' }" :aria-pressed="layoutDraft === 'standalone'" @click="layoutDraft = 'standalone'">单独成行</button>
          </fieldset>
          <p class="mi-layout-hint">每项媒体可分别设置；插入后可拖动调整顺序，图片、视频和音频可以混排。</p>
          <template v-if="kind !== 'audio'">
            <div class="mi-section-head">
              <strong>显示尺寸</strong>
              <button type="button" class="mi-text-button" :disabled="busy" @click="resetSize">恢复默认</button>
            </div>
            <div class="mi-dimensions">
              <label :for="id + '-width'">宽度（px）
                <span class="mi-number-input">
                  <input :id="id + '-width'" :value="widthDraft" :disabled="busy" type="number" min="1" max="4096" step="1" placeholder="自动" @input="onDimensionInput('width', $event)" @keydown.enter.prevent="confirm">
                  <span class="mi-number-steps" aria-label="调整宽度">
                    <button type="button" :disabled="busy" aria-label="增加宽度" @click="stepDimension('width', 1)">+</button>
                    <button type="button" :disabled="busy" aria-label="减小宽度" @click="stepDimension('width', -1)">−</button>
                  </span>
                </span>
              </label>
              <span class="mi-times" aria-hidden="true">×</span>
              <label :for="id + '-height'">高度（px）
                <span class="mi-number-input">
                  <input :id="id + '-height'" :value="heightDraft" :disabled="busy" type="number" min="1" max="4096" step="1" placeholder="自动" @input="onDimensionInput('height', $event)" @keydown.enter.prevent="confirm">
                  <span class="mi-number-steps" aria-label="调整高度">
                    <button type="button" :disabled="busy" aria-label="增加高度" @click="stepDimension('height', 1)">+</button>
                    <button type="button" :disabled="busy" aria-label="减小高度" @click="stepDimension('height', -1)">−</button>
                  </span>
                </span>
              </label>
            </div>
            <label class="mi-aspect"><input v-model="aspectLocked" :disabled="busy || (!naturalSize && !editMode)" type="checkbox">锁定原始比例</label>
            <p class="mi-hint">{{ naturalSize ? ('原始尺寸 ' + naturalSize.width + ' × ' + naturalSize.height + ' px。留空时自适应编辑区。') : '留空时自适应编辑区；读取原始尺寸后可锁定比例。' }}</p>
          </template>
          <template v-else-if="editMode">
            <div class="mi-section-head">
              <strong>显示尺寸</strong>
              <button type="button" class="mi-text-button" :disabled="busy" @click="resetSize">恢复默认</button>
            </div>
            <div class="mi-dimensions mi-dimensions-single">
              <label :for="id + '-width'">播放器宽度（px）
                <span class="mi-number-input">
                  <input :id="id + '-width'" :value="widthDraft" :disabled="busy" type="number" min="1" max="4096" step="1" placeholder="默认" @input="onDimensionInput('width', $event)" @keydown.enter.prevent="confirm">
                  <span class="mi-number-steps" aria-label="调整宽度">
                    <button type="button" :disabled="busy" aria-label="增加宽度" @click="stepDimension('width', 1)">+</button>
                    <button type="button" :disabled="busy" aria-label="减小宽度" @click="stepDimension('width', -1)">−</button>
                  </span>
                </span>
              </label>
            </div>
            <p class="mi-hint">留空时使用默认播放器宽度。</p>
          </template>
          <label v-if="kind === 'image'" class="mi-alt" :for="id + '-alt'">图片说明
            <input :id="id + '-alt'" v-model="altDraft" :disabled="busy" type="text" maxlength="120" placeholder="描述图片内容（可选）" @keydown.enter.prevent="confirm">
          </label>
          <p v-if="kind === 'video'" class="mi-hint">视频插入后可直接播放。推荐 MP4（H.264）或 WebM 格式。</p>
        </div>
      </div>
      <p v-if="previewState === 'failed'" class="mi-warning" role="status">无法预览此{{ label }}，可能是文件损坏或当前环境不支持其编码。可以更换文件，或保留原文件插入。</p>
      <p v-if="dimensionError || error" class="mi-error" role="alert">{{ dimensionError || error }}</p>
    </div>
    <template #footer>
      <button type="button" class="mi-btn" :disabled="busy" @click="close">取消</button>
      <button type="button" class="mi-btn mi-btn-primary" :disabled="!canSubmit" @click="confirm">{{ busy ? (editMode && phase === 'inserting' ? '正在保存更改…' : phase === 'finalizing' ? '文件已写入，正在完成保存…' : phase === 'inserting' ? '文件已保存，正在插入笔记…' : (progress !== null ? ('正在保存 ' + progress + '%…') : '正在保存…')) : (editMode ? '保存更改' : '插入' + label) }}</button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import BaseDialog from '../ui/BaseDialog.vue'
import { mediaKindLabels, sanitizeAltText, type MediaKind } from '../../composables/useNoteMedia'

const props = withDefaults(defineProps<{
  visible: boolean
  kind: MediaKind
  editMode?: boolean
  initialSettings?: { width: number | null; height: number | null; alt: string; aspectLocked: boolean; layout: 'flow' | 'standalone' }
  fileName: string
  previewUrl: string
  fileSize?: number
  mimeType?: string
  busy?: boolean
  progress?: number | null
  phase?: 'saving' | 'finalizing' | 'inserting'
  error?: string
}>(), {
  busy: false,
  progress: null,
  phase: 'saving',
  error: '',
  fileSize: 0,
  mimeType: '',
  editMode: false,
  initialSettings: () => ({ width: null, height: null, alt: '', aspectLocked: false, layout: 'flow' }),
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'select-file': [file: File]
  confirm: [payload: { width: number | null; height: number | null; alt: string; aspectLocked: boolean; layout: 'flow' | 'standalone' }]
}>()
const id = useId()
const fileInput = ref<HTMLInputElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const mediaRef = ref<HTMLMediaElement | null>(null)
const widthDraft = ref('')
const heightDraft = ref('')
const altDraft = ref('')
const badInput = ref({ width: false, height: false })
const aspectLocked = ref(false)
const layoutDraft = ref<'flow' | 'standalone'>('flow')
const lastEdited = ref<'width' | 'height'>('width')
const naturalSize = ref<{ width: number; height: number } | null>(null)
const duration = ref<number | null>(null)
const previewState = ref<'loading' | 'ready' | 'failed'>('loading')
const label = computed(() => mediaKindLabels[props.kind])
const title = computed(() => (props.editMode ? '设置' : '插入') + label.value)
const accept = computed(() => props.kind === 'image' ? 'image/*' : props.kind === 'video' ? 'video/*,.mp4,.webm,.mov,.mkv,.m4v' : 'audio/*,.mp3,.m4a,.wav,.ogg')
const fileDescription = computed(() => {
  if (!props.previewUrl) return props.kind === 'image' ? 'PNG、JPEG、GIF、WebP 等' : props.kind === 'video' ? 'MP4、WebM、MOV、MKV 等' : 'MP3、M4A、WAV、OGG 等'
  const fileExtension = props.fileName.split('.').pop()?.toUpperCase()
  const parts = [props.mimeType ? props.mimeType.split('/')[1]?.toUpperCase() : (fileExtension && fileExtension !== props.fileName.toUpperCase() ? fileExtension : '')]
  if (props.fileSize > 0) {
    const units = ['B', 'KB', 'MB', 'GB']
    const index = Math.min(Math.floor(Math.log(props.fileSize) / Math.log(1024)), 3)
    parts.push((props.fileSize / 1024 ** index).toFixed(index ? 1 : 0) + ' ' + units[index])
  }
  if (duration.value !== null) parts.push(Math.floor(duration.value / 60) + ':' + String(Math.floor(duration.value % 60)).padStart(2, '0'))
  return parts.filter(Boolean).join(' · ')
})
const dimensionError = computed(() => {
  if (props.kind === 'audio' && !props.editMode) return ''
  for (const [key, name] of [['width', '宽度'], ['height', '高度']] as const) {
    const value = key === 'width' ? widthDraft.value : heightDraft.value
    if (badInput.value[key] || (value && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 4096))) return name + '请输入 1–4096 的整数'
  }
  return ''
})
const canSubmit = computed(() => !!(props.previewUrl || props.editMode) && !props.busy && !dimensionError.value)
function resetSize() {
  widthDraft.value = ''
  heightDraft.value = ''
  badInput.value = { width: false, height: false }
}
function linkDimensions() {
  if (!aspectLocked.value || !naturalSize.value) return
  const source = lastEdited.value === 'width' ? widthDraft.value : heightDraft.value
  if (!source || badInput.value[lastEdited.value] || !/^\d+$/.test(source) || Number(source) < 1 || Number(source) > 4096) return
  const ratio = naturalSize.value.width / naturalSize.value.height
  const linked = Math.max(1, Math.round(lastEdited.value === 'width' ? Number(source) / ratio : Number(source) * ratio))
  if (lastEdited.value === 'width') {
    heightDraft.value = String(linked)
    badInput.value.height = false
  } else {
    widthDraft.value = String(linked)
    badInput.value.width = false
  }
}
function onDimensionInput(key: 'width' | 'height', event: Event) {
  const input = event.target as HTMLInputElement
  badInput.value[key] = input.validity.badInput
  if (key === 'width') widthDraft.value = input.value
  else heightDraft.value = input.value
  lastEdited.value = key
  if (!input.value && !input.validity.badInput && aspectLocked.value) resetSize()
  else linkDimensions()
}
function stepDimension(key: 'width' | 'height', amount: number) {
  const current = key === 'width' ? widthDraft.value : heightDraft.value
  const next = Math.min(4096, Math.max(1, (Number(current) || 0) + amount))
  if (key === 'width') widthDraft.value = String(next)
  else heightDraft.value = String(next)
  badInput.value[key] = false
  lastEdited.value = key
  linkDimensions()
}
function setNaturalSize(width: number, height: number) {
  naturalSize.value = width > 0 && height > 0 ? { width, height } : null
  previewState.value = 'ready'
  linkDimensions()
}
function onImageLoad(event: Event) {
  const image = event.target as HTMLImageElement
  if (image.getAttribute('src') === props.previewUrl) setNaturalSize(image.naturalWidth, image.naturalHeight)
}
function onMetadata(event: Event) {
  const media = event.target as HTMLVideoElement
  if (media.getAttribute('src') !== props.previewUrl) return
  duration.value = Number.isFinite(media.duration) ? media.duration : null
  setNaturalSize(media.videoWidth || 0, media.videoHeight || 0)
}
function onPreviewError(event: Event) {
  if ((event.target as HTMLElement).getAttribute('src') === props.previewUrl) previewState.value = 'failed'
}
function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file && !props.busy) emit('select-file', file)
}
function onDrop(event: DragEvent) {
  if (props.busy) return
  const file = event.dataTransfer?.files[0]
  if (file) emit('select-file', file)
}
function releasePlayer() {
  const player = mediaRef.value
  if (!player) return
  // 仅暂停已脱离界面的预览播放器。重置 src/load 会同步触发 Chromium 媒体管线，
  // 可能拖住刚关闭弹窗后的首帧；元素卸载且对象 URL 回收后由浏览器释放资源。
  window.setTimeout(() => {
    try { player.pause() } catch {}
  }, 100)
}
watch(aspectLocked, linkDimensions)

function syncPreviewMetadata(): void {
  const image = imageRef.value
  if (image?.complete && image.naturalWidth) setNaturalSize(image.naturalWidth, image.naturalHeight)
  const player = mediaRef.value as HTMLVideoElement | null
  if (player && player.readyState >= 1) {
    duration.value = Number.isFinite(player.duration) ? player.duration : null
    setNaturalSize(player.videoWidth || 0, player.videoHeight || 0)
  }
}

watch(() => [props.visible, props.kind] as const, async ([visible]) => {
  releasePlayer()
  if (!visible) return
  widthDraft.value = props.initialSettings.width ? String(props.initialSettings.width) : ''
  heightDraft.value = props.initialSettings.height ? String(props.initialSettings.height) : ''
  altDraft.value = props.kind === 'image'
    ? (props.editMode ? props.initialSettings.alt : sanitizeAltText(props.fileName))
    : ''
  badInput.value = { width: false, height: false }
  aspectLocked.value = props.initialSettings.aspectLocked
  layoutDraft.value = props.initialSettings.layout
  lastEdited.value = 'width'
  naturalSize.value = null
  duration.value = null
  previewState.value = 'loading'
  await nextTick()
  if (!props.previewUrl) fileInput.value?.nextElementSibling?.querySelector<HTMLButtonElement>('button')?.focus()
  syncPreviewMetadata()
}, { immediate: true })

watch(() => props.previewUrl, async () => {
  releasePlayer()
  naturalSize.value = null
  duration.value = null
  previewState.value = 'loading'
  if (!props.visible || !props.previewUrl) return
  await nextTick()
  syncPreviewMetadata()
})
watch(() => props.fileName, (name) => {
  if (!props.editMode && props.kind === 'image' && !altDraft.value && name) altDraft.value = sanitizeAltText(name)
})
onBeforeUnmount(releasePlayer)
function close() {
  if (!props.busy) emit('update:visible', false)
}
function confirm() {
  if (!canSubmit.value) return
  emit('confirm', {
    width: (props.kind !== 'audio' || props.editMode) && widthDraft.value ? Number(widthDraft.value) : null,
    height: props.kind !== 'audio' && heightDraft.value ? Number(heightDraft.value) : null,
    alt: props.kind === 'image' ? altDraft.value : '',
    aspectLocked: props.kind !== 'audio' && aspectLocked.value && !!naturalSize.value,
    layout: layoutDraft.value,
  })
}
</script>

<style scoped>
.media-insert-dialog { display: flex; flex-direction: column; gap: 14px; }
.mi-file-input { display: none; }
.mi-layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: center; gap: 24px; }
.mi-stage { position: relative; display: flex; align-items: center; justify-content: center; min-height: 240px; align-self: stretch; overflow: hidden; border: 1px solid rgba(167,139,250,.2); border-radius: 12px; background: rgba(9,8,22,.65); }
.mi-stage-empty { border-style: dashed; background: rgba(139,92,246,.04); }
.mi-stage img, .mi-stage video { display: block; max-width: 100%; max-height: 290px; object-fit: contain; border-radius: 9px; }
.mi-stage video { width: 100%; color-scheme: dark; accent-color: var(--chalk-primary, #667eea); background: #111026; }
.mi-stage audio { width: calc(100% - 24px); color-scheme: dark; accent-color: var(--chalk-primary, #667eea); }
.mi-stage video::-webkit-media-controls-panel, .mi-stage audio::-webkit-media-controls-panel { background-color: rgba(31,27,58,.96); }
.mi-choose { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; width: 100%; height: 100%; min-height: 240px; padding: 24px 12px; border: 0; color: #ddd6fe; background: transparent; cursor: pointer; font: inherit; text-align: center; }
.mi-choose > span:last-child { color: #94a3b8; font-size: 12px; }
.mi-upload-symbol { color: #a78bfa; font-size: 40px; line-height: 1; }
.mi-loading { position: absolute; top: 10px; left: 10px; padding: 5px 8px; border-radius: 6px; color: #cbd5e1; background: rgba(15,13,34,.8); font-size: 11px; pointer-events: none; }
.mi-settings { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.mi-file-summary { display: flex; flex-direction: column; align-items: start; gap: 7px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,.08); }
.mi-eyebrow { color: #a78bfa; font-size: 11px; }
.mi-file-name { max-width: 100%; overflow-wrap: anywhere; color: #e2e8f0; font-size: 14px; line-height: 1.5; }
.mi-file-meta { color: #94a3b8; font-size: 11px; }
.mi-layout-choice { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin: 0; padding: 0; border: 0; }
.mi-layout-choice legend { grid-column: 1 / -1; margin-bottom: 0; color: #cbd5e1; font-size: 12px; }
.mi-layout-choice button { min-width: 0; padding: 7px 4px; border: 1px solid rgba(167,139,250,.2); border-radius: 8px; color: #cbd5e1; background: rgba(255,255,255,.025); cursor: pointer; font: inherit; font-size: 11px; text-align: center; }
.mi-layout-choice button.active { border-color: rgba(167,139,250,.56); color: #ede9fe; background: rgba(139,92,246,.2); }
.mi-layout-choice button:disabled { opacity: .5; cursor: not-allowed; }
.mi-layout-hint { margin: -6px 0 0; color: #64748b; font-size: 11px; line-height: 1.45; }
.mi-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #cbd5e1; font-size: 12px; }
.mi-text-button { padding: 0; border: 0; color: #c4b5fd; background: none; font: inherit; font-size: 12px; cursor: pointer; }
.mi-text-button:hover:not(:disabled) { color: #ede9fe; text-decoration: underline; }
.mi-dimensions { display: flex; align-items: end; gap: 8px; }
.mi-dimensions label, .mi-alt { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 7px; color: #cbd5e1; font-size: 12px; }
.mi-times { padding-bottom: 10px; color: #64748b; font-size: 14px; }
.mi-number-input { position: relative; display: flex; width: 100%; min-width: 0; }
.mi-dimensions input, .mi-alt input { width: 100%; min-width: 0; box-sizing: border-box; height: 36px; padding: 0 34px 0 10px; border: 1px solid rgba(167,139,250,.25); border-radius: 8px; outline: 0; color: #e2e8f0; background: rgba(15,13,34,.55); font: inherit; }
.mi-dimensions input { appearance: textfield; -moz-appearance: textfield; }
.mi-dimensions input::-webkit-inner-spin-button, .mi-dimensions input::-webkit-outer-spin-button { margin: 0; -webkit-appearance: none; }
.mi-dimensions input:focus, .mi-alt input:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(139,92,246,.13); }
.mi-number-steps { position: absolute; inset: 1px 1px 1px auto; display: flex; flex-direction: column; width: 27px; overflow: hidden; border-left: 1px solid rgba(167,139,250,.2); border-radius: 0 7px 7px 0; background: rgba(109,40,217,.12); }
.mi-number-steps button { flex: 1; min-height: 0; padding: 0; border: 0; color: #c4b5fd; background: transparent; font: 600 11px/1 system-ui, sans-serif; cursor: pointer; transition: color .14s, background .14s; }
.mi-number-steps button + button { border-top: 1px solid rgba(167,139,250,.16); }
.mi-number-steps button:hover:not(:disabled) { color: #fff; background: rgba(139,92,246,.42); }
.mi-number-steps button:disabled { opacity: .45; cursor: not-allowed; }
.mi-aspect { display: flex; align-items: center; gap: 7px; color: #cbd5e1; font-size: 12px; }
.mi-aspect input { margin: 0; accent-color: #a78bfa; }
.mi-hint { margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.7; }
.mi-error, .mi-warning { margin: 0; padding: 9px 12px; border: 1px solid rgba(248,113,113,.25); border-radius: 8px; color: #fca5a5; background: rgba(248,113,113,.08); font-size: 12px; line-height: 1.6; }
.mi-warning { border-color: rgba(251,191,36,.25); color: #fcd34d; background: rgba(251,191,36,.06); }
.mi-btn { padding: 8px 22px; border: 1px solid rgba(255,255,255,.14); border-radius: 9px; color: #cbd5e1; background: transparent; font: inherit; font-size: 13px; cursor: pointer; }
.mi-btn-primary { border-color: rgba(167,139,250,.45); color: #ede9fe; background: rgba(129,140,248,.25); }
.mi-btn:hover:not(:disabled) { background: rgba(167,139,250,.18); }
button:disabled, input:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 640px) { .mi-layout { grid-template-columns: minmax(0,1fr); gap: 16px; } .mi-stage, .mi-choose { min-height: 160px; } .mi-stage img, .mi-stage video { max-height: 190px; } }
</style>
