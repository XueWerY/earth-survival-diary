import hljs from 'highlight.js/lib/common'

// 标记已高亮，避免重复处理（hljs 自身也会置 data-highlighted）
const HL_FLAG = 'data-cb-hl'

// 简单代码格式化：去除首尾空行、行尾空白、统一缩进前的制表符
const formatCodeText = (raw: string): string => {
  const lines = raw.replace(/\t/g, '  ').split('\n')
  // 去除首尾空行
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  // 去除行尾空白
  return lines.map(l => l.replace(/\s+$/, '')).join('\n')
}

// 对 root 内所有 <pre> 应用语法高亮（自动检测语言）并格式化
// 已高亮的先用纯文本重置再重算，保证内容更新后仍能正确着色
export const highlightCodeBlocks = (root: HTMLElement) => {
  const pres = root.querySelectorAll('pre')
  pres.forEach(pre => {
    const target = (pre.querySelector('code') || pre) as HTMLElement
    // 重置已高亮的内容
    if (target.getAttribute(HL_FLAG)) {
      target.textContent = target.textContent
    }
    const raw = target.textContent || ''
    if (!raw.trim()) return
    // 格式化代码文本
    target.textContent = formatCodeText(raw)
    try {
      target.removeAttribute('data-highlighted')
      target.className = target.className.replace(/hljs(\s|$)/, '').trim()
      hljs.highlightElement(target)
      target.setAttribute(HL_FLAG, '1')
    } catch { /* 忽略无法识别的内容 */ }
  })
}

// 保存前将 <pre> 内高亮标记还原为纯文本，避免 hljs 的 span 持久化到笔记内容
export const serializeCodeBlocks = (root: HTMLElement) => {
  const pres = root.querySelectorAll('pre')
  pres.forEach(pre => {
    const target = (pre.querySelector('code') || pre) as HTMLElement
    if (target.getAttribute(HL_FLAG)) {
      target.textContent = target.textContent
      target.removeAttribute(HL_FLAG)
      target.removeAttribute('data-highlighted')
      target.className = target.className.replace(/hljs(\s|$)/, '').trim()
    }
  })
}
