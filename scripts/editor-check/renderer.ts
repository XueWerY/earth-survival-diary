import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import MilkdownEditor from '../../src/components/editor/MilkdownEditor.vue'
import NoteInsertDialog from '../../src/components/notes/NoteInsertDialog.vue'
import MediaInsertDialog from '../../src/components/notes/MediaInsertDialog.vue'
import NoteEditor from '../../src/components/notes/NoteEditor.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { buildMediaSnippet, mediaMimeTypeOfFile, readFileAsDataUrl, storeMediaAsset } from '../../src/composables/useNoteMedia'
import { renderMathPreview } from '../../src/components/editor/mathPreview'
import { mathDelimitersToEditor, mathEditorToDelimiters } from '../../src/components/editor/mathSyntax'
import { parseMediaTagText } from '../../src/components/editor/mediaMarkdown'

document.body.style.cssText = 'margin:0;background:#151225;color:#e2e8f0;font-family:Arial,sans-serif;--chalk-white:#f1f5f9'
const results: Array<{ name: string; ok: boolean; error?: string }> = []
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
async function waitFor(predicate: () => unknown, message: string, timeout = 12000) {
  const start = Date.now()
  while (!predicate()) { if (Date.now() - start > timeout) throw new Error(message); await sleep(30) }
}
async function check(name: string, run: () => unknown) {
  try { await run(); results.push({ name, ok: true }); console.log('[check] PASS ' + name) }
  catch (error) { results.push({ name, ok: false, error: error instanceof Error ? error.stack : String(error) }) }
}
function fixture(component: any, initial: Record<string, unknown>) {
  const props = ref(initial)
  const instance = ref<any>()
  const host = document.body.appendChild(document.createElement('div'))
  const app = createApp({ setup: () => () => h(component, { ...props.value, ref: instance }) })
  app.use(createPinia())
  app.use(ElementPlus)
  app.mount(host)
  return { props, instance, host, dispose: () => { app.unmount(); host.remove() } }
}
async function editor(initial: string) {
  const f = fixture(MilkdownEditor, { modelValue: initial })
  await waitFor(() => f.instance.value?.getSelectionRange(), '编辑器未就绪', 30000)
  return f
}
function fill(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
function insertButton() {
  return document.querySelector<HTMLButtonElement>('.ins-btn-primary')!
}
async function createVideo() {
  const canvas = document.createElement('canvas')
  canvas.width = 640; canvas.height = 360
  const context = canvas.getContext('2d')!
  context.fillStyle = '#6355b9'; context.fillRect(0, 0, 640, 360)
  const stream = canvas.captureStream(0)
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' })
  const chunks: Blob[] = []
  recorder.ondataavailable = event => chunks.push(event.data)
  const stopped = new Promise<Blob>(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })) })
  const started = new Promise<void>(resolve => { recorder.onstart = () => resolve() })
  recorder.start()
  await started
  for (let i = 0; i < 6; i++) {
    context.fillStyle = i % 2 ? '#6355b9' : '#292044'
    context.fillRect(0, 0, 640, 360)
    ;(stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack).requestFrame()
    await sleep(120)
  }
  recorder.stop()
  const blob = await stopped
  stream.getTracks().forEach(track => track.stop())
  return new File([blob], 'test-video.webm', { type: 'video/webm' })
}

async function run() {
  await check('Windows 空 MIME 视频按扩展名识别', () => {
    assert(mediaMimeTypeOfFile({ name: 'clip.MP4', type: '' }) === 'video/mp4', 'MP4 MIME 兜底失败')
    assert(mediaMimeTypeOfFile({ name: 'clip.mp4', type: 'text/plain' }) === null, '不应接受冲突 MIME')
  })
  await check('媒体标签尺寸往返', () => {
    const tag = buildMediaSnippet({ kind: 'video', reference: 'esd-local-media://test', size: { width: 400, height: 225 } })
    const parsed = parseMediaTagText(tag)
    assert(parsed?.width === 400 && parsed.height === 225 && parsed.kind === 'video', '媒体标签解析失败')
  })
  await check('行内公式预览与非法公式校验', () => {
    assert(renderMathPreview('\\frac{a}{b}').html.includes('katex'), '分式未渲染')
    assert(renderMathPreview('\\frac{').error, '错误公式未拦截')
    assert(renderMathPreview('$x$').error, '重复定界符未拦截')
  })
  await check('公式转换保留行内代码和代码块原文', () => {
    const tick = String.fromCharCode(96)
    const code = tick + '\\(literal\\) $money$' + tick + '\n\n' + tick.repeat(3) + 'js\nconst formula = "\\(x\\)"; const cost = "$1 $2";\n' + tick.repeat(3)
    assert(mathDelimitersToEditor(code) === code, '进编辑器时改写了代码')
    assert(mathEditorToDelimiters(code) === code, '保存时改写了代码')
  })

  const mediaFile = await createVideo()
  const dataUrl = await readFileAsDataUrl(mediaFile)
  const reference = await storeMediaAsset(dataUrl)
  assert(reference, '测试资产存储失败')
  const videoSnippet = buildMediaSnippet({ kind: 'video', reference, size: { width: 400, height: 225 } })
  let savedVideo = ''
  await check('视频插入重复段落中的精确光标位置并可播放', async () => {
    const f = await editor('重复内容\n\n重复内容')
    try {
      f.instance.value.setSelectionRange(9, 9)
      assert(f.instance.value.insertMediaBlock(videoSnippet), '媒体插入返回失败')
      await waitFor(() => f.host.querySelector('video[src^="data:"]'), '视频引用没有解析')
      const video = f.host.querySelector('video')!
      await waitFor(() => video.readyState >= 1 || !!video.error, '视频元数据未加载')
      assert(!video.error, '视频解码失败：' + video.error?.message)
      assert(video.getAttribute('src') === dataUrl, '读取到的视频资产和原文件不一致')
      video.muted = true
      await Promise.race([video.play(), sleep(10000).then(() => { throw new Error('视频未开始播放') })])
      assert(!video.paused && video.videoWidth === 640, '视频未播放')
      video.pause()
      const paragraphs = [...f.host.querySelectorAll('.ProseMirror > p')].map(node => node.textContent)
      assert(paragraphs[0] === '重复内容' && paragraphs[1] === '重复' && paragraphs[2] === '内容', '媒体落点错误：' + JSON.stringify(paragraphs))
      savedVideo = f.instance.value.getValue()
      assert(savedVideo.includes(reference) && !savedVideo.includes('data:video'), '正文包含运行期 data URL')
      assert(video.getAttribute('width') === '400' && video.getAttribute('height') === '225', '视频尺寸丢失')
      const pm = f.host.querySelector('.ProseMirror')!
      pm.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }))
      await waitFor(() => !f.host.querySelector('video'), '视频插入不能撤销')
    } finally { f.dispose() }
  })
  await check('保存重新打开视频仍可播放并保持尺寸', async () => {
    assert(savedVideo, '上一项未生成 Markdown')
    const f = await editor(savedVideo)
    try {
      await waitFor(() => f.host.querySelector<HTMLVideoElement>('video')?.readyState! >= 1, '重开笔记后视频未加载')
      const video = f.host.querySelector('video')!
      assert(video.videoWidth === 640 && video.getAttribute('width') === '400', '视频元数据或尺寸未恢复')
    } finally { f.dispose() }
  })
  await check('选中文本插入视频会替换选区', async () => {
    const f = await editor('abcd')
    try {
      f.instance.value.setSelectionRange(2, 4)
      assert(f.instance.value.insertMediaBlock(videoSnippet), '选区替换失败')
      const text = [...f.host.querySelectorAll('.ProseMirror > p')].map(p => p.textContent).join('')
      assert(text === 'ad', '选区没有正确替换：' + text)
    } finally { f.dispose() }
  })
  await check('行内公式真实渲染、保存和重新载入', async () => {
    const f = await editor('前后')
    let markdown = ''
    try {
      f.instance.value.setSelectionRange(2, 2)
      assert(f.instance.value.insertInlineMathAtCursor('\\frac{a}{b}'), '公式插入失败')
      await waitFor(() => f.host.querySelector('.katex'), '行内公式未渲染')
      markdown = f.instance.value.getValue()
      assert(markdown.includes('\\(') && markdown.includes('\\frac{a}{b}'), '公式落盘格式错误：' + markdown)
    } finally { f.dispose() }
    const reopened = await editor(markdown)
    try { await waitFor(() => reopened.host.querySelector('.katex'), '重新打开后公式未渲染') }
    finally { reopened.dispose() }
  })
  await check('行内代码支持反引号和公式字面量往返', async () => {
    const f = await editor('正文')
    const text = 'fn(' + String.fromCharCode(96) + ') \\(literal\\)'
    let markdown = ''
    try {
      f.instance.value.setSelectionRange(3, 3)
      assert(f.instance.value.insertInlineCodeAtCursor(text), '行内代码插入失败')
      markdown = f.instance.value.getValue()
    } finally { f.dispose() }
    const reopened = await editor(markdown)
    try {
      assert(reopened.host.querySelector('.ProseMirror code')?.textContent === text, '行内代码保存后改变')
      assert(!reopened.host.querySelector('.katex'), '代码被错误渲染为公式')
    } finally { reopened.dispose() }
  })
  await check('行内代码选择语言并给出语法问题提示', async () => {
    const f = fixture(NoteInsertDialog, { visible: true, kind: 'inline-code', initialInlineLanguage: 'JavaScript', initialInlineText: 'const =', 'onUpdate:visible': () => {} })
    try {
      await waitFor(() => document.querySelector('.insert-warn'), '行内代码未审查语法')
      assert(!insertButton().disabled, '语法片段不应强制禁止行内插入')
      assert(document.querySelector('.insert-row')?.textContent?.includes('语言'), '语言选择缺失')
      document.querySelector<HTMLButtonElement>('.esd-select-trigger')!.click()
      await nextTick()
      const option = [...document.querySelectorAll<HTMLButtonElement>('.esd-select-option')].find(button => button.textContent?.trim() === 'JSON')
      assert(option, '语言列表没有 JSON')
      option.click()
      fill(document.querySelector<HTMLInputElement>('.insert-input-mono')!, '{"valid": 1}')
      await waitFor(() => document.querySelector('.insert-ok')?.textContent?.includes('语法检查通过'), '切换语言后没有重新检查')
    } finally { f.dispose() }
  })
  await check('块级代码不能在防抖窗口绕过语法检查', async () => {
    let inserted = false
    const f = fixture(NoteInsertDialog, { visible: true, kind: 'block-code', initialLanguage: 'JavaScript', 'onConfirm-block-code': () => { inserted = true } })
    try {
      await nextTick()
      const textarea = document.querySelector<HTMLTextAreaElement>('.insert-textarea')!
      fill(textarea, 'const valid = 1')
      await waitFor(() => !insertButton().disabled, '合法代码未通过检查')
      fill(textarea, 'const =')
      insertButton().click()
      await sleep(500)
      assert(!inserted && insertButton().disabled, '无效代码通过了确认')
    } finally { f.dispose() }
  })
  await check('公式弹窗示例、实时预览与确认载荷', async () => {
    let latex = ''
    const f = fixture(NoteInsertDialog, { visible: true, kind: 'inline-math', 'onConfirm-inline-math': (value: { latex: string }) => { latex = value.latex } })
    try {
      await nextTick()
      document.querySelector<HTMLButtonElement>('.insert-math-examples button')!.click()
      await nextTick()
      assert(document.querySelector('.insert-math-body .katex'), '公式弹窗没有实时预览')
      insertButton().click()
      assert(latex === '\\frac{a}{b}', '公式确认载荷错误')
    } finally { f.dispose() }
  })
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 320
  const art = canvas.getContext('2d')!
  const gradient = art.createLinearGradient(0, 0, 640, 320)
  gradient.addColorStop(0, '#4740a1'); gradient.addColorStop(1, '#17848d')
  art.fillStyle = gradient; art.fillRect(0, 0, 640, 320)
  art.fillStyle = '#e5d3a0'; art.beginPath(); art.arc(485, 80, 34, 0, Math.PI * 2); art.fill()
  art.fillStyle = '#24254c'; art.beginPath(); art.moveTo(0, 320); art.lineTo(180, 135); art.lineTo(350, 320); art.fill()
  art.fillStyle = '#34365f'; art.beginPath(); art.moveTo(250, 320); art.lineTo(450, 175); art.lineTo(640, 320); art.fill()
  const imageUrl = canvas.toDataURL('image/png')
  await check('图片插入、说明和尺寸保存恢复', async () => {
    const imageRef = await storeMediaAsset(imageUrl)
    assert(imageRef, '图片资产未保存')
    const f = await editor('正文')
    let markdown = ''
    try {
      f.instance.value.setSelectionRange(3, 3)
      assert(f.instance.value.insertMediaBlock(buildMediaSnippet({ kind: 'image', reference: imageRef, alt: '图片说明', size: { width: 320, height: 160 } })), '图片插入失败')
      await waitFor(() => f.host.querySelector<HTMLImageElement>('.ProseMirror img')?.naturalWidth === 640, '图片未显示')
      markdown = f.instance.value.getValue()
      assert(markdown.includes('{w=320,h=160}') && markdown.includes('图片说明'), '图片尺寸或说明未保存：' + markdown)
    } finally { f.dispose() }
    const reopened = await editor(markdown)
    try {
      await waitFor(() => reopened.host.querySelector<HTMLImageElement>('.ProseMirror img')?.getAttribute('width') === '320', '图片尺寸未恢复')
    } finally { reopened.dispose() }
  })
  await check('图片弹窗比例联动、非法尺寸和忙碌态', async () => {
    let closed = false
    const f = fixture(MediaInsertDialog, { visible: true, kind: 'image', fileName: '测试图片.png', previewUrl: imageUrl, 'onUpdate:visible': () => { closed = true } })
    try {
      await waitFor(() => !document.querySelector<HTMLInputElement>('.mi-aspect input')!.disabled, '图片原始尺寸未读取')
      const fields = document.querySelectorAll<HTMLInputElement>('.mi-dimensions input')
      fill(fields[0], '320'); await nextTick()
      assert(fields[1].value === '160', '比例联动失败')
      fill(fields[0], '0'); await nextTick()
      assert(document.querySelector<HTMLButtonElement>('.mi-btn-primary')!.disabled, '非法尺寸未拦截')
      f.props.value = { ...f.props.value, busy: true }
      await nextTick()
      document.querySelector<HTMLButtonElement>('.mi-btn')!.click()
      document.querySelector('.media-insert-dialog')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      assert(!closed, '保存期间可关闭弹窗')
    } finally { f.dispose() }
  })
  await check('笔记菜单、视频弹窗、文件选择、插入与自动保存完整流程', async () => {
    let saved = ''
    const note = { id: 'check-note', title: '插入测试', content: '测试正文', tagIds: [], pinned: false, trashedAt: null, categoryId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const f = fixture(NoteEditor, { note, onSave: (value: { content: string }) => { saved = value.content } })
    try {
      await waitFor(() => f.host.querySelector('.ProseMirror'), '笔记编辑器未加载')
      ;([...f.host.querySelectorAll<HTMLButtonElement>('.editor-menubar-tab')].find(button => button.textContent === '插入'))!.click()
      await nextTick()
      f.host.querySelector<HTMLButtonElement>('[title="插入视频"]')!.click()
      await nextTick()
      assert(document.querySelector('.mi-choose'), '没有打开视频选择弹窗')
      const input = document.querySelector<HTMLInputElement>('.mi-file-input')!
      const transfer = new DataTransfer()
      transfer.items.add(mediaFile)
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await waitFor(() => document.querySelector<HTMLVideoElement>('.mi-stage video')?.readyState! >= 1, '视频弹窗未预览文件')
      const width = document.querySelector<HTMLInputElement>('.mi-dimensions input')!
      fill(width, '400')
      await nextTick()
      document.querySelector<HTMLButtonElement>('.mi-btn-primary')!.click()
      await waitFor(() => !document.querySelector('.media-insert-dialog'), '插入后弹窗没有关闭')
      await waitFor(() => f.host.querySelector<HTMLVideoElement>('.ProseMirror video')?.readyState! >= 1, '笔记中视频未显示')
      await waitFor(() => saved.includes('<video'), '视频没有自动保存')
      assert(saved.includes('width="400"') && !saved.includes('data:video'), '视频正文保存错误')
      const video = f.host.querySelector<HTMLVideoElement>('.ProseMirror video')!
      const click = new MouseEvent('click', { bubbles: true, cancelable: true })
      video.dispatchEvent(click)
      assert(!click.defaultPrevented, '播放控件单击被尺寸编辑拦截')
      f.host.querySelector<HTMLButtonElement>('.esd-media-resize')!.click()
      await nextTick()
      const dimensions = f.host.querySelectorAll<HTMLInputElement>('.media-resize-panel input')
      fill(dimensions[0], '320'); fill(dimensions[1], '180')
      f.host.querySelector<HTMLButtonElement>('.media-resize-btn')!.click()
      await waitFor(() => saved.includes('width="320"'), '视频修改尺寸没有保存')
      assert(f.host.querySelector('.ProseMirror video') === video, '修改尺寸重建了播放器')
      assert((saved.match(/<\/video>/g) || []).length === 1, '修改尺寸产生重复闭合标签')
      f.host.querySelector<HTMLButtonElement>('[title="插入视频"]')!.click()
      await nextTick()
      f.props.value = { ...f.props.value, note: { ...note, id: 'another-note', content: '另一篇笔记' } }
      await waitFor(() => !document.querySelector('.media-insert-dialog'), '切换笔记后残留旧媒体弹窗')
    } finally { f.dispose() }
  })
  let preview: ReturnType<typeof fixture> | null = null
  ;(window as any).showEditorCheckPreview = async (kind: string) => {
    preview?.dispose()
    if (kind === 'image' || kind === 'video') {
      preview = fixture(MediaInsertDialog, { visible: true, kind, fileName: kind === 'image' ? '旅行照片.png' : '旅行记录.webm', previewUrl: kind === 'image' ? imageUrl : URL.createObjectURL(mediaFile), mimeType: kind === 'image' ? 'image/png' : 'video/webm', fileSize: kind === 'image' ? 84000 : mediaFile.size })
      await waitFor(() => !document.querySelector<HTMLInputElement>('.mi-aspect input')?.disabled, '截图预览未就绪')
      fill(document.querySelector<HTMLInputElement>('.mi-dimensions input')!, '400')
    } else {
      preview = fixture(NoteInsertDialog, { visible: true, kind: kind === 'math' ? 'inline-math' : 'inline-code', initialMathLatex: '\\frac{a}{b} + x^2', initialInlineText: 'const total = items.length', initialInlineLanguage: 'JavaScript' })
      await sleep(300)
    }
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  }
  return results
}
;(window as unknown as { editorCheckPromise: Promise<typeof results> }).editorCheckPromise = run()
