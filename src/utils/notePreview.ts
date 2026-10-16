import { micromark } from 'micromark'

/** Render a linked note preview without executing raw HTML from the note. */
export function renderNotePreview(content: string, title: string): string {
  const markdown = content.trim()
  if (!markdown) return '<p>（空笔记）</p>'

  const lines = markdown.split('\n')
  const firstLine = lines[0]
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
  if (title.trim() && firstLine === title.trim()) lines.shift()

  return micromark(lines.join('\n').trim(), {
    allowDangerousHtml: false,
    allowDangerousProtocol: false,
  })
}
