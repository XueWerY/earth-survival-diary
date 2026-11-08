import { parse, postprocess, preprocess } from 'micromark'

export interface MediaSourceToken {
  kind: 'image' | 'video' | 'audio'
  markdownStart: number
  markdownEnd: number
  pathStart: number
  pathEnd: number
  displayStart: number
  displayEnd: number
  reference: string
  displayText: string
  editableReference: boolean
}

export interface MediaSourceProjection {
  text: string
  tokens: MediaSourceToken[]
}

interface Candidate {
  kind: MediaSourceToken['kind']
  start: number
  end: number
  pathStart: number
  pathEnd: number
  reference: string
  displayText: string
  editableReference: boolean
}

function codeRanges(markdown: string): Array<{ start: number; end: number }> {
  try {
    const events = postprocess(parse().document().write(preprocess()(markdown, undefined, true)))
    const ranges: Array<{ start: number; end: number }> = []
    const codeTypes = new Set(['codeFenced', 'codeIndented', 'codeText'])
    for (const [event, token] of events) {
      if (event !== 'enter' || !codeTypes.has(token.type)) continue
      const start = token.start.offset
      const end = token.end.offset
      if (typeof start === 'number' && typeof end === 'number') ranges.push({ start, end })
    }
    return ranges
  } catch {
    return []
  }
}

function isInsideCode(start: number, end: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some(range => start < range.end && end > range.start)
}

function findCandidates(markdown: string): Candidate[] {
  const ranges = codeRanges(markdown)
  const candidates: Candidate[] = []
  const imagePattern = /!\[[^\]]*\]\(([^)\s]+?)(?:\{w=\d*,h=\d*(?:,lock=1)?(?:,name=[^,}]+)?(?:,row=single)?\})?(?:\s+(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'))?\)/g
  let imageMatch: RegExpExecArray | null
  while ((imageMatch = imagePattern.exec(markdown))) {
    const start = imageMatch.index
    const end = start + imageMatch[0].length
    if (isInsideCode(start, end, ranges)) continue
    const reference = imageMatch[1]
    const pathStart = start + imageMatch[0].indexOf('](') + 2
    const embedded = /^data:image\//i.test(reference)
    candidates.push({
      kind: 'image', start, end, pathStart, pathEnd: pathStart + reference.length,
      reference,
      displayText: embedded ? '内嵌图片' : reference,
      editableReference: !embedded,
    })
  }

  const mediaPattern = /<(video|audio)\b[^>]*>\s*<\/\1\s*>/gi
  let mediaMatch: RegExpExecArray | null
  while ((mediaMatch = mediaPattern.exec(markdown))) {
    const start = mediaMatch.index
    const end = start + mediaMatch[0].length
    if (isInsideCode(start, end, ranges)) continue
    const srcMatch = /\bsrc\s*=\s*"([^"]*)"/i.exec(mediaMatch[0])
    if (!srcMatch) continue
    const reference = srcMatch[1]
    const pathStart = start + srcMatch.index + srcMatch[0].indexOf(reference)
    const embedded = /^data:(?:video|audio)\//i.test(reference)
    candidates.push({
      kind: mediaMatch[1].toLowerCase() as 'video' | 'audio',
      start, end, pathStart, pathEnd: pathStart + reference.length,
      reference,
      displayText: embedded ? (mediaMatch[1].toLowerCase() === 'video' ? '内嵌视频' : '内嵌音频') : reference,
      editableReference: !embedded,
    })
  }

  return candidates.sort((a, b) => a.start - b.start || a.end - b.end)
}

export function projectMediaPaths(markdown: string): MediaSourceProjection {
  const candidates = findCandidates(markdown)
  const tokens: MediaSourceToken[] = []
  let cursor = 0
  let display = ''
  for (const candidate of candidates) {
    if (candidate.start < cursor) continue
    display += markdown.slice(cursor, candidate.start)
    const displayStart = display.length
    display += candidate.displayText
    tokens.push({
      ...candidate,
      markdownStart: candidate.start,
      markdownEnd: candidate.end,
      displayStart,
      displayEnd: display.length,
    })
    cursor = candidate.end
  }
  display += markdown.slice(cursor)
  return { text: display, tokens }
}

export function mediaDisplayOffsetToMarkdown(projection: MediaSourceProjection, offset: number, side: 'start' | 'end' = 'start'): number {
  const position = Math.max(0, Math.min(projection.text.length, offset))
  let markdownCursor = 0
  let displayCursor = 0
  for (const token of projection.tokens) {
    if (position < token.displayStart) return markdownCursor + (position - displayCursor)
    if (position === token.displayStart) return side === 'end' ? token.markdownStart : token.pathStart
    if (position === token.displayEnd) return side === 'start' ? token.markdownEnd : token.pathEnd
    if (position < token.displayEnd) {
      if (!token.editableReference) return side === 'start' ? token.pathStart : token.pathEnd
      const relative = Math.max(0, Math.min(token.displayText.length, position - token.displayStart))
      return token.pathStart + Math.min(token.pathEnd - token.pathStart, relative)
    }
    markdownCursor = token.markdownEnd
    displayCursor = token.displayEnd
  }
  return markdownCursor + (position - displayCursor)
}

export function mediaDisplayRangeToMarkdown(projection: MediaSourceProjection, start: number, end: number): { start: number; end: number } {
  const from = Math.max(0, Math.min(projection.text.length, Math.min(start, end)))
  const to = Math.max(from, Math.min(projection.text.length, Math.max(start, end)))
  if (from === to) {
    const atStart = projection.tokens.find(token => from === token.displayStart)
    if (atStart) return { start: atStart.markdownStart, end: atStart.markdownStart }
    const atEnd = projection.tokens.find(token => from === token.displayEnd)
    if (atEnd) return { start: atEnd.markdownEnd, end: atEnd.markdownEnd }
  }
  const affected = from === to
    ? []
    : projection.tokens.filter(token => from < token.displayEnd && to > token.displayStart)
  const first = affected[0]
  const last = affected[affected.length - 1]
  if (affected.length === 1 && first && from >= first.displayStart && to <= first.displayEnd
    && (from !== first.displayStart || to !== first.displayEnd)) {
    return {
      start: mediaDisplayOffsetToMarkdown(projection, from, 'start'),
      end: mediaDisplayOffsetToMarkdown(projection, to, 'end'),
    }
  }
  return {
    start: first && from >= first.displayStart ? first.markdownStart : mediaDisplayOffsetToMarkdown(projection, from, 'start'),
    end: last && to <= last.displayEnd ? last.markdownEnd : mediaDisplayOffsetToMarkdown(projection, to, 'end'),
  }
}

export function mediaMarkdownOffsetToDisplay(projection: MediaSourceProjection, offset: number, side: 'start' | 'end' = 'end'): number {
  const position = Math.max(0, offset)
  let markdownCursor = 0
  let displayCursor = 0
  for (const token of projection.tokens) {
    if (position < token.markdownStart) return displayCursor + (position - markdownCursor)
    if (position <= token.markdownEnd) {
      if (position <= token.pathStart) return token.displayStart
      if (position >= token.pathEnd) return token.displayEnd
      if (!token.editableReference) return side === 'start' ? token.displayStart : token.displayEnd
      return token.displayStart + Math.min(token.displayText.length, position - token.pathStart)
    }
    markdownCursor = token.markdownEnd
    displayCursor = token.displayEnd
  }
  return displayCursor + (position - markdownCursor)
}

function safeReference(reference: string, kind: MediaSourceToken['kind']): string {
  const value = reference.trim().replace(/[\r\n]/g, '')
  if (kind === 'video' || kind === 'audio') return value.replace(/["<>]/g, '')
  return value.replace(/\s/g, '%20').replace(/\)/g, '%29')
}

/** Apply the user's edit to the compact source view while retaining each media token's Markdown wrapper. */
export function applyMediaSourceEdit(markdown: string, projection: MediaSourceProjection, nextDisplay: string): string {
  const previousDisplay = projection.text
  if (previousDisplay === nextDisplay) return markdown
  let prefix = 0
  const maxPrefix = Math.min(previousDisplay.length, nextDisplay.length)
  while (prefix < maxPrefix && previousDisplay[prefix] === nextDisplay[prefix]) prefix++
  let oldEnd = previousDisplay.length
  let newEnd = nextDisplay.length
  while (oldEnd > prefix && newEnd > prefix && previousDisplay[oldEnd - 1] === nextDisplay[newEnd - 1]) {
    oldEnd--
    newEnd--
  }
  const inserted = nextDisplay.slice(prefix, newEnd)
  if (oldEnd === prefix) {
    const tokenAtStart = projection.tokens.find(token => prefix === token.displayStart)
    const tokenAtEnd = projection.tokens.find(token => prefix === token.displayEnd)
    // Keep structural prefixes (heading, quote and list markers) outside a media token.
    if (tokenAtStart && (/^(?:#{1,6}|>|[-*+])(?:[ \t]|$)|^\d+[.)][ \t]/.test(inserted) || /^[\s]+$/.test(inserted))) {
      return markdown.slice(0, tokenAtStart.markdownStart) + inserted + markdown.slice(tokenAtStart.markdownStart)
    }
    if (tokenAtEnd && /^[\s]+$/.test(inserted)) {
      return markdown.slice(0, tokenAtEnd.markdownEnd) + inserted + markdown.slice(tokenAtEnd.markdownEnd)
    }
  }
  const affected = projection.tokens.filter(token =>
    oldEnd === prefix
      ? prefix >= token.displayStart && prefix <= token.displayEnd
      : prefix < token.displayEnd && oldEnd > token.displayStart,
  )

  if (affected.length === 1) {
    const token = affected[0]
    if (token.editableReference && prefix >= token.displayStart && oldEnd <= token.displayEnd) {
      const reference = safeReference(
        previousDisplay.slice(token.displayStart, prefix) + inserted + previousDisplay.slice(oldEnd, token.displayEnd),
        token.kind,
      )
      if (!reference) return markdown.slice(0, token.markdownStart) + markdown.slice(token.markdownEnd)
      return markdown.slice(0, token.pathStart) + reference + markdown.slice(token.pathEnd)
    }
  }

  let markdownStart = mediaDisplayOffsetToMarkdown(projection, prefix, 'start')
  let markdownEnd = mediaDisplayOffsetToMarkdown(projection, oldEnd, 'end')
  if (affected.length) {
    const first = affected[0]
    const last = affected[affected.length - 1]
    if (prefix >= first.displayStart) markdownStart = first.markdownStart
    if (oldEnd <= last.displayEnd) markdownEnd = last.markdownEnd
  }
  return markdown.slice(0, markdownStart) + inserted + markdown.slice(markdownEnd)
}
