// 插入对话框用到的校验与预览桥接：
//  - validateLinkUrl：链接地址格式审查
//  - validateInlineCode：行内代码内容审查（单行、非空）
//  - renderPreviewHtml：块级代码的着色预览 HTML（复用 codeLanguages 的 highlight.js 管线）

/** 链接格式检查：返回 null 表示通过 */
export function validateLinkUrl(source: string): string | null {
  const url = String(source || '').trim()
  if (!url) return '请输入链接地址'
  if (/\s/.test(url)) return '链接地址不能包含空格'
  if (!/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url)) {
    return '请输入 http(s):// 开头的地址（或 /、./、# 开头的站内/锚点链接）'
  }
  try {
    // 绝对地址必须是合法 URL；相对路径与锚点放行
    if (/^https?:\/\//i.test(url)) new URL(url)
  } catch {
    return '链接地址格式不正确'
  }
  return null
}

/** 行内代码审查：必须单行且非空（含换行会破坏行内 mark 语义） */
export function validateInlineCode(source: string): string | null {
  const text = String(source || '')
  if (!text.trim()) return '请输入代码内容'
  if (/[\r\n]/.test(text)) return '行内代码不能包含换行，请改用块级代码'
  return null
}

export { highlightInnerHtml as renderPreviewHtml } from './codeLanguages'
