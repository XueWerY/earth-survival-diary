// 笔记导出：Markdown（YAML frontmatter + 正文原文）与长图（离屏渲染 + html2canvas）
// - Markdown：frontmatter 携带标签（结构化 tagIds 若不落盘，导出后标签就丢了）；
//   正文原样保留 [[ ]] 语法，直接可迁入 Obsidian / Logseq
// - 长图：克隆编辑器渲染产物到离屏容器，配自包含的极光暗色排版样式
//   （编辑器样式是 scoped 的，克隆节点离开原容器会丢失，故样式随导出自带）
import html2canvas from 'html2canvas'
import type { Note, Tag } from '../stores/noteStore'

const EXPORT_IMAGE_WIDTH = 720

/** 文件名清理：去掉文件系统非法字符与换行 */
export function sanitizeFileName(name: string): string {
  return (name || '笔记').replace(/[\\/:*?"<>|\r\n]/g, '_').trim().slice(0, 60) || '笔记'
}

/** YAML 标量转义：仅保留明显安全的裸值，其余双引号包裹 */
function yamlScalar(s: string): string {
  if (/^[\w\u4e00-\u9fff][\w\u4e00-\u9fff\s-]*$/.test(s)) return s
  return JSON.stringify(s)
}

/** 构建带 frontmatter 的 Markdown（Obsidian 兼容：tags 数组 + created/updated） */
export function buildNoteMarkdown(note: Note, tags: Tag[]): string {
  const frontmatter = [
    '---',
    `title: ${yamlScalar(note.title || '无标题')}`,
    `tags: [${tags.map(t => yamlScalar(t.name)).join(', ')}]`,
    `created: ${note.createdAt}`,
    `updated: ${note.updatedAt}`,
    '---',
  ]
  const body = note.content || ''
  return `${frontmatter.join('\n')}\n\n${body}${body.endsWith('\n') ? '' : '\n'}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportNoteMarkdown(note: Note, tags: Tag[]): void {
  const md = buildNoteMarkdown(note, tags)
  downloadBlob(
    new Blob([md], { type: 'text/markdown;charset=utf-8' }),
    `${sanitizeFileName(note.title)}.md`
  )
}

// 长图自包含排版样式：与编辑器的极光暗色配色保持一致
const EXPORT_CSS = `
.note-export-body {
  width: ${EXPORT_IMAGE_WIDTH}px;
  box-sizing: border-box;
  padding: 48px;
  background: #0f0c29;
  color: #dbe7e5;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  font-size: 16px;
  line-height: 1.9;
  word-wrap: break-word;
}
.note-export-body h1, .note-export-body h2, .note-export-body h3,
.note-export-body h4, .note-export-body h5, .note-export-body h6 {
  font-weight: 700; line-height: 1.4; margin: 0.7em 0 0.4em;
}
.note-export-body h1 { font-size: 26px; color: #93c5fd; border-bottom: 1px solid rgba(102,126,234,.25); padding-bottom: 8px; }
.note-export-body h2 { font-size: 22px; color: #93c5fd; }
.note-export-body h3, .note-export-body h4 { font-size: 19px; color: #67e8f9; }
.note-export-body h5, .note-export-body h6 { font-size: 16px; color: #a7c4c0; }
.note-export-body p { margin: 0.3em 0; }
.note-export-body blockquote {
  border-left: 4px solid rgba(102,126,234,.5); background: rgba(102,126,234,.06);
  color: #8fa8a5; margin: 8px 0; padding: 8px 16px; border-radius: 0 8px 8px 0;
}
.note-export-body code {
  background: rgba(102,126,234,.18); color: #93c5fd; padding: 2px 6px;
  border-radius: 4px; font-family: 'Consolas','Monaco',monospace; font-size: 0.9em;
}
.note-export-body pre {
  background: rgba(102,126,234,.1); padding: 14px; border-radius: 8px;
  overflow: hidden; white-space: pre-wrap;
}
.note-export-body pre code { background: transparent; padding: 0; }
.note-export-body a { color: #93c5fd; }
.note-export-body strong { color: #ecfdf5; }
.note-export-body del { color: #6b8280; }
.note-export-body hr { border: none; border-top: 1px solid rgba(102,126,234,.18); margin: 1em 0; }
.note-export-body ul, .note-export-body ol { padding-left: 24px; margin: 0.3em 0; }
.note-export-body img { max-width: 100%; border-radius: 8px; }
.note-export-body table { border-collapse: collapse; margin: 0.5em 0; }
.note-export-body th, .note-export-body td { border: 1px solid rgba(255,255,255,.14); padding: 6px 12px; }
.note-export-body span[data-type='wikiLink'] {
  display: inline-block; padding: 0 5px; border-radius: 5px;
  background: rgba(102,126,234,.14); color: #93c5fd;
}
`

/**
 * 导出长图：克隆编辑器当前渲染产物 → 离屏容器（自带样式）→ html2canvas → PNG 下载
 * @param contentEl 编辑器渲染根（.ProseMirror 或源码 textarea 由调用方决定传入谁）
 */
export async function exportNoteImage(contentEl: HTMLElement, title: string): Promise<void> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-99999px;top:0;'
  const wrap = document.createElement('div')
  wrap.className = 'note-export-body'
  wrap.innerHTML = contentEl.innerHTML
  const style = document.createElement('style')
  style.textContent = EXPORT_CSS
  host.appendChild(style)
  host.appendChild(wrap)
  document.body.appendChild(host)

  try {
    const canvas = await html2canvas(wrap, {
      backgroundColor: '#0f0c29',
      scale: 2,
      useCORS: true,
      width: EXPORT_IMAGE_WIDTH,
      windowWidth: EXPORT_IMAGE_WIDTH,
    })
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob || blob.size === 0) throw new Error('长图生成失败')
    downloadBlob(blob, `${sanitizeFileName(title)}.png`)
  } finally {
    host.remove()
  }
}
