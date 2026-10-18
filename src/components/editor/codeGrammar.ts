// 用编辑器自带的 CodeMirror 语言包做「真语法解析」审查。
//
// 为什么可行且不新增依赖：
//   Crepe 的代码块语言列表来自 @codemirror/language-data（已随 Crepe 打包），
//   我们已通过 @milkdown/kit/component/code-block 暴露的 codeBlockConfig 在运行时
//   拿到同一批 LanguageDescription 对象——它们自带 load() → LanguageSupport →
//   language.parser（Lezer LRParser）。因此能直接解析出语法树并定位错误节点，
//   不需要在我们的依赖里再声明一遍 @codemirror/*。
//
// 注册时机：编辑器创建完成后由 MilkdownEditor 调 registerLanguageDescriptions()。
// 未注册（编辑器还没起来）时 checkWithGrammar 返回 null，调用方退化为结构配平检查。

import { ref } from 'vue'

/** 结构化的 LanguageDescription 视图（避免引入未声明的 CodeMirror 类型） */
interface GrammarTree {
  cursor(): GrammarCursor
}
interface GrammarCursor {
  type: { isError?: boolean; name: string }
  from: number
  next(): boolean
}
interface GrammarSupport {
  language: { parser: { parse(input: string, partial?: boolean): GrammarTree } }
}
export interface LanguageDescriptionLike {
  name: string
  alias?: readonly string[]
  extensions?: readonly string[]
  support?: GrammarSupport
  load(): Promise<GrammarSupport>
}

/** 已注册的语言描述：键为小写名称/别名/扩展名 */
const descriptions = new Map<string, LanguageDescriptionLike>()
/** 已加载的解析器缓存（load() 会触发动态 import，只加载用过的语言） */
const loadedSupport = new WeakMap<LanguageDescriptionLike, GrammarSupport>()
/** 没有可用 grammar 的语言（load 失败或无 parser），避免每次都重试 */
const grammarUnavailable = new Set<string>()

/** 供弹窗使用的语言目录（注册后自动更新，驱动视图刷新） */
export interface CatalogLanguage {
  label: string
  id: string
  aliases: string[]
  /** 是否有真语法解析器可用 */
  grammar: boolean
}
export const languageCatalog = ref<CatalogLanguage[]>([])

/**
 * 注册编辑器自带的语言描述。
 * 幂等：重复调用只补充新项，不覆盖已加载结果。
 */
export function registerLanguageDescriptions(list: unknown): void {
  if (!Array.isArray(list)) return
  let changed = false
  for (const item of list) {
    const description = item as LanguageDescriptionLike
    if (!description || typeof description.name !== 'string' || typeof description.load !== 'function') continue
    const keys = [description.name, ...(description.alias || []), ...(description.extensions || [])]
    let seen = false
    for (const key of keys) {
      const normalized = String(key).toLowerCase()
      if (!normalized) continue
      if (descriptions.has(normalized)) seen = true
    }
    if (seen) continue
    for (const key of keys) {
      const normalized = String(key).toLowerCase()
      if (normalized && !descriptions.has(normalized)) descriptions.set(normalized, description)
    }
    changed = true
  }
  if (changed) rebuildCatalog()
}

function rebuildCatalog(): void {
  // 同一语言会以 name/alias/extension 多个键出现，按对象身份去重
  const unique = new Map<LanguageDescriptionLike, string>()
  for (const description of descriptions.values()) {
    if (!unique.has(description)) unique.set(description, description.name)
  }
  languageCatalog.value = [...unique.entries()].map(([description, name]) => ({
    label: name,
    id: name,
    aliases: [description.name, ...(description.alias || []), ...(description.extensions || [])]
      .map(v => String(v).toLowerCase())
      .filter(Boolean),
    grammar: hasStrictGrammar(name),
  })).sort((a, b) => a.label.localeCompare(b.label))
}

/** 按名称/别名/扩展名找语言描述 */
export function findDescription(rawName: string): LanguageDescriptionLike | null {
  const key = String(rawName || '').trim().toLowerCase()
  if (!key) return null
  return descriptions.get(key) || null
}

/** 该语言是否已有真语法解析器 */
export function hasGrammar(rawName: string): boolean {
  const description = findDescription(rawName)
  if (!description) return false
  return !grammarUnavailable.has(description.name.toLowerCase())
}

/**
 * 「真正会报错的语法解析」白名单（按 LanguageDescription 名称，小写）。
 *
 * 为什么需要白名单：language-data 里不少语言的 Lezer 语法是**宽容**的
 * （HTML 允许未闭合标签、Markdown/YAML 几乎什么都收、StreamLanguage 老式
 * 模式的错误恢复也不报 error 节点）。对这类语言宣称「已做语法解析」会误导用户，
 * 所以这里只对确实能定位错误的语言标 grammar=true；
 * 其余语言统一走专项 + 结构配平检查（同样会拦下乱打，只是机制不同）。
 */
const STRICT_GRAMMAR_NAMES = new Set([
  'c', 'c++', 'c#', 'java', 'javascript', 'typescript', 'jsx', 'tsx',
  'python', 'rust', 'go', 'json', 'css', 'scss', 'less', 'sql',
  'angular template', 'vue', 'php', 'jinja', 'liquid', 'wast',
  'objective-c', 'objective-c++', 'kotlin', 'scala', 'dart',
  'clojure', 'clojurescript', 'coffeescript', 'lua', 'perl', 'r', 'julia',
  'swift', 'groovy', 'haskell', 'ocaml', 'f#', 'erlang', 'elm',
  'proto', 'protobuf', 'graphql', 'toml', 'ini', 'diff',
])

/** 该语言是否有「能真正报错」的语法解析器 */
export function hasStrictGrammar(rawName: string): boolean {
  const description = findDescription(rawName)
  if (!description) return false
  const name = description.name.toLowerCase()
  if (grammarUnavailable.has(name)) return false
  return STRICT_GRAMMAR_NAMES.has(name)
}

function lineOf(code: string, position: number): number {
  return (code.slice(0, position).match(/\n/g) || []).length + 1
}

function snippetAt(code: string, position: number): string {
  const lineStart = code.lastIndexOf('\n', Math.max(0, position - 1)) + 1
  const lineEnd = code.indexOf('\n', position)
  const line = code.slice(lineStart, lineEnd < 0 ? code.length : lineEnd).trim()
  return line ? line.slice(0, 40) : ''
}

/**
 * 真语法解析：返回 null 表示「通过」，返回字符串表示错误信息（含行号）。
 * 返回 undefined 表示「该语言没有可用解析器」，调用方应退化为结构检查。
 */
export async function checkWithGrammar(rawName: string, code: string): Promise<string | null | undefined> {
  const description = findDescription(rawName)
  if (!description) return undefined
  const nameKey = description.name.toLowerCase()
  if (grammarUnavailable.has(nameKey)) return undefined

  let support: GrammarSupport | undefined = loadedSupport.get(description) || description.support
  if (!support) {
    try {
      support = await description.load()
    } catch {
      grammarUnavailable.add(nameKey)
      return undefined
    }
  }
  if (!support || typeof support.language?.parser?.parse !== 'function') {
    grammarUnavailable.add(nameKey)
    return undefined
  }
  loadedSupport.set(description, support)

  let tree: GrammarTree
  try {
    tree = support.language.parser.parse(code)
  } catch (error) {
    loggerParseFailure(nameKey, error)
    grammarUnavailable.add(nameKey)
    return undefined
  }

  // 遍历语法树找 error 节点；Lezer 对「未闭合」类问题会在末尾产出 error
  const cursor = tree.cursor()
  let firstError: { position: number; name: string } | null = null
  for (;;) {
    if (cursor.type.isError) {
      firstError = { position: cursor.from, name: cursor.type.name }
      break
    }
    if (!cursor.next()) break
  }
  if (!firstError) return null
  const line = lineOf(code, firstError.position)
  const snippet = snippetAt(code, firstError.position)
  return `第 ${line} 行：语法错误${snippet ? `（${snippet.startsWith('}') || snippet.startsWith(')') ? snippet : '此处 ' + snippet}）` : ''}`
}

/** 解析失败的静默记录：不打扰用户，只留日志便于排查 */
function loggerParseFailure(name: string, error: unknown) {
  // 延迟引入，避免与编辑器模块形成循环依赖
  void import('../../lib/logger').then(({ logger }) => {
    logger.warn('[代码审查] 语法解析器加载失败，退化为结构检查', {
      language: name,
      error: error instanceof Error ? error.message : String(error),
    })
  }).catch(() => {})
}
