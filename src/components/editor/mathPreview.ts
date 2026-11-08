// 行内公式弹窗的 KaTeX 预览桥（design.md 2.2.2 F / 2.6.7，冻结契约）。
//
// 校验顺序与既有入口链路严格一致：空 → 含 `$` → KaTeX 渲染。
// 必须与 `mathLiveInput.findPendingMath`、`mathSyntax.convertInlineDelimitersToDollars`
// 的「空表达式/含 `$` 不转换」规则完全一致，避免「预览通过但插入后不渲染」。
//
// 为什么静态 import：
//   KaTeX 已在 package.json 显式声明（与 @milkdown/crepe 实际解析版本对齐），静态 import
//   能让构建期直接暴露依赖缺失，而不是运行时才静默降级。
//   CSS 需一并引入：弹窗 teleport 到 body，不在 .milkdown 作用域内，Crepe 主题里的
//   KaTeX 样式不会命中弹窗预览，必须自带。
import katex from 'katex'
import 'katex/dist/katex.min.css'

export interface MathPreviewResult {
  /** 渲染结果 HTML（不可用或校验失败时为空串） */
  html: string
  /** 校验/解析错误（给用户看的文案）；null 表示通过 */
  error: string | null
  /** KaTeX 不可用（降级提示，「插入后由公式引擎渲染」） */
  unavailable: boolean
}

/** KaTeX 是否可用（渲染函数存在）；不可用时弹窗降级为源码提示 */
export function isMathPreviewAvailable(): boolean {
  return typeof katex?.renderToString === 'function'
}

/** 把 KaTeX 的原始报错转成用户可读文案 */
function readableKatexError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  // KaTeX 报错形如：KaTeX parse error: Undefined control sequence: \x at position 1: ...
  return raw.replace(/^KaTeX parse error:\s*/i, '公式解析错误：')
}

/**
 * 校验并渲染行内公式预览（纯函数，无副作用）。
 *
 * @param latex 纯 LaTeX 源码（不含 `\( \)` 定界符）
 * @param options.displayMode 是否以块级样式渲染，默认 false（行内，与插入形态一致）
 */
export function renderMathPreview(
  latex: string,
  options?: { displayMode?: boolean },
): MathPreviewResult {
  const source = String(latex ?? '')

  // 1) 空表达式：与 mathLiveInput/mathSyntax 一致，不渲染
  if (!source.trim()) {
    return { html: '', error: '请输入公式', unavailable: false }
  }
  // 2) 含 `$`：定界符由应用统一拼 `\( \)`，用户不应输入 `$`（与既有策略一致）
  if (source.includes('$')) {
    return { html: '', error: '请勿输入 $ 定界符', unavailable: false }
  }
  // 3) KaTeX 不可用：降级（不阻塞插入，由编辑器管线渲染）
  if (!isMathPreviewAvailable()) {
    return { html: '', error: null, unavailable: true }
  }

  try {
    const html = katex.renderToString(source, {
      displayMode: options?.displayMode ?? false,
      throwOnError: true,
      trust: false,
    })
    return { html, error: null, unavailable: false }
  } catch (error) {
    // 语法非法：给出可读错误，弹窗据此禁用插入
    return { html: '', error: readableKatexError(error), unavailable: false }
  }
}
