// 笔记导出：Markdown（YAML frontmatter + 正文原文）
// - frontmatter 携带标签（结构化 tagIds 若不落盘，导出后标签就丢了）；
//   正文原样保留 [[ ]] 语法，直接可迁入 Obsidian / Logseq
import type { Note, Tag } from '../stores/noteStore'

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
