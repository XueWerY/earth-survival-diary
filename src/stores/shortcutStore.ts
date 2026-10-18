// 快捷键绑定、冲突检测与持久化。
//
// 设计要点：
//  - 动作 + 组合键的映射存在这里，编辑器/笔记页只通过 lookup(action) 取键，
//    避免快捷键散落在各处、无法统一检测冲突；
//  - 冲突检测只针对**笔记模块内部**：
//      · 同一组合键被多个动作占用 → 按声明顺序只有靠前者生效（kind: 'duplicate'）；
//      · 动作在当前环境不可用 → 按下不会生效（kind: 'unusable'）。
//    【已删除】原先还有「与系统/其它软件保留键冲突」的检测——应用无法探测外部占用，
//    那张手工清单既不可穷举也无法验证，只会误导；用户要求删除，改为提示
//    「快捷键无效时请自己录制新的组合键」。
//  - 持久化到 data/<用户ID>/notes/shortcuts.yaml（与临时笔记路径同目录），
//    因此换设备/重装后仍在 data 目录里可迁移。

import { ref } from 'vue'
import { getData, setData } from '../services/storageService'

// 复用既有的读写通道（与 tempNotes 保持一致）
const DATA_TYPE = 'notes'
const DATA_KEY = 'shortcuts'

/** 动作定义：id 稳定，label 用于界面展示 */
export interface ShortcutAction {
  id: string
  label: string
  /** 动作分组，用于界面归类 */
  group: string
  /** 默认组合键（未绑定时使用） */
  default: string
  /** 是否允许用户清空（关键能力不允许留空） */
  required?: boolean
}

/**
 * 快捷键动作清单。
 *
 * 用户明确要求：
 *   删除「保存笔记」「新建笔记」「标签选择器」「帮助」；
 *   新增「切换全屏显示/退出全屏」；
 *   本轮再删除「插入块级代码」的快捷键（功能按钮仍在插入分页里，只是不再占快捷键）。
 *   保留 搜索 / 替换 / 加粗 / 斜体 / 下划线 / 删除线 / 高亮 / 行内代码 / 引用块 /
 *        插入链接 / 切换源码 / 大纲面板 / 全屏编辑。
 */
export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: 'search', label: '笔记内搜索', group: '编辑', default: 'Ctrl+F' },
  { id: 'replace', label: '替换', group: '编辑', default: 'Ctrl+H' },
  { id: 'bold', label: '加粗', group: '格式', default: 'Ctrl+B' },
  { id: 'italic', label: '斜体', group: '格式', default: 'Ctrl+I' },
  { id: 'underline', label: '下划线', group: '格式', default: 'Ctrl+U' },
  /*
    上标 / 下标（本轮新增）。
    键位取 Google Docs 的通行约定 Ctrl+. / Ctrl+,：
      · 不用 Ctrl+Shift+= / Ctrl+= —— 这两个在不同键盘布局下 event.key 会是 '+' / '='，
        归一化结果不稳定，容易「绑了按不出来」；
      · '.' 与 ',' 的 key 值在所有布局下都稳定，且不与系统保留键冲突。
  */
  { id: 'superscript', label: '上标', group: '格式', default: 'Ctrl+.' },
  { id: 'subscript', label: '下标', group: '格式', default: 'Ctrl+,' },
  { id: 'strike', label: '删除线', group: '格式', default: 'Ctrl+Shift+X' },
  { id: 'highlight', label: '高亮', group: '格式', default: 'Ctrl+Shift+H' },
  { id: 'code', label: '行内代码', group: '格式', default: 'Ctrl+E' },
  { id: 'quote', label: '引用块', group: '格式', default: 'Ctrl+Shift+Q' },
  /*
    列表 / 标题 / 正文（本轮按用户要求新增）。
    键位取业界通行约定：
      · 无序/有序列表：Google Docs 用 Ctrl+Shift+7 / Ctrl+Shift+8；
        这里改用更易按的 Ctrl+Shift+U（unordered）/ Ctrl+Shift+L（list），
        避开 F 系列与浏览器标签相关组合，也避开已用的 Ctrl+Shift+X/H/Q/O。
      · 标题 H1~H6：Google Docs 用 Ctrl+Alt+1..6，本应用沿用同一套，
        因为 Ctrl+Alt+数字 在编辑场景下几乎不冲突，且便于记忆（数字对应层级）。
      · 正文（清除块级格式）：Google Docs 用 Ctrl+Alt+0，这里沿用。
    注意：归一化时数字键的 event.key 是 '1'..'6'，稳定可依赖。
  */
  { id: 'unordered', label: '无序列表', group: '格式', default: 'Ctrl+Shift+U' },
  { id: 'ordered', label: '有序列表', group: '格式', default: 'Ctrl+Shift+L' },
  { id: 'h1', label: '标题 1', group: '格式', default: 'Ctrl+Alt+1' },
  { id: 'h2', label: '标题 2', group: '格式', default: 'Ctrl+Alt+2' },
  { id: 'h3', label: '标题 3', group: '格式', default: 'Ctrl+Alt+3' },
  { id: 'h4', label: '标题 4', group: '格式', default: 'Ctrl+Alt+4' },
  { id: 'h5', label: '标题 5', group: '格式', default: 'Ctrl+Alt+5' },
  { id: 'h6', label: '标题 6', group: '格式', default: 'Ctrl+Alt+6' },
  { id: 'body', label: '正文（取消块级格式）', group: '格式', default: 'Ctrl+Alt+0' },
  { id: 'link', label: '插入链接', group: '插入', default: 'Ctrl+K' },
  // 「插入块级代码」快捷键已删除（见上方说明）
  { id: 'toggleSource', label: '切换源码/所见即所得', group: '视图', default: 'Ctrl+/' },
  { id: 'outline', label: '大纲面板', group: '视图', default: 'Ctrl+Shift+O' },
  { id: 'fullscreen', label: '切换全屏显示', group: '视图', default: 'F11' },
]

/*
  【已按用户要求删除】原先这里维护一张「与其它软件/系统保留键」的冲突表
  （Ctrl+W 关闭、F5 刷新、Win 键、Alt+Tab 等约 30 条），用于在绑定/检测时提示
  「这个组合可能被系统或别的软件占用」。

  删除原因（用户原话）：「删除快捷键冲突检测的外部检测逻辑，反正也没什么用，
  只检测笔记模块内部的冲突」。

  为什么它确实没什么用：
    1) 应用**无法探测**外部软件是否真的占用了某个组合键 —— 浏览器/Electron
       没有这个能力的 API。那张表只是「常见系统热键的手工清单」，
       既不可能穷举（用户机器上装了什么软件、输入法、显卡驱动都未知），
       也无法验证，所以它给出的结论天然不可靠。
    2) 真被外部占用时，表现为「按了没反应」；此时唯一可靠的解法是
       **换一个组合键**，而不是让应用去猜。
    3) 它还会误伤：例如 F11 被本应用用作全屏键，却被列进表里，
       一度造成「自己和自己冲突」的假警报。
  因此保留它只会制造噪音与误导，连兼容占位也一并删掉。
*/

/** 绑定的组合键（归一化后的字符串），actions 里的 default 会被覆盖 */
const bindings = ref<Record<string, string>>({})

/** 是否已从磁盘加载 */
const loaded = ref(false)

/**
 * 把键盘事件归一化成组合键字符串。
 * 归一化规则必须固定，否则 'Ctrl+S' 与 'ctrl+s' 会被当成两个键。
 */
export function comboFromEvent(event: KeyboardEvent | { key: string; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }): string {
  const key = String(event.key || '')
  // 单独的修饰键不构成组合
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return ''
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')
  if (event.metaKey) parts.push('Meta')
  parts.push(normalizeKeyName(key))
  return parts.join('+')
}

/** 键名归一化：单字母大写、空格用 Space、方向键保持原样 */
export function normalizeKeyName(key: string): string {
  if (!key) return ''
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  return key
}

/** 展示用格式（与存储格式相同，便于直接展示） */
export function formatCombo(combo: string): string {
  return String(combo || '').replace(/\+/g, ' + ')
}

/** 取某动作当前生效的组合键（未绑定则用默认值） */
export function comboFor(actionId: string): string {
  const action = SHORTCUT_ACTIONS.find(a => a.id === actionId)
  if (!action) return ''
  return bindings.value[actionId] ?? action.default
}

/** 按组合键反查动作 id（返回第一个匹配；冲突时由 findConflicts 报告） */
export function actionForCombo(combo: string): string | null {
  if (!combo) return null
  for (const action of SHORTCUT_ACTIONS) {
    if (comboFor(action.id) === combo) return action.id
  }
  return null
}

/** 冲突项 */
export interface ShortcutConflict {
  combo: string
  actionIds: string[]
  /**
   * 冲突类型（只针对笔记模块内部）：
   *   duplicate —— 多个动作占用同一组合键（靠后的不生效）
   *   unusable  —— 动作在当前环境不可用（按下不会生效）
   */
  kind: 'duplicate' | 'unusable'
  reason?: string
}

/**
 * 快捷键的两种运行模式（用户明确要求的设计）。
 *
 * 为什么需要它：
 *  冲突检测不能只看「表里有没有重复的字符串」——那只能发现静态重复，
 *  发现不了「两个动作注册到同一个按键、其中一个被先处理」这类真实冲突。
 *  正确做法是**真的把每个动作都跑一遍**：
 *    - test 模式：只返回成功/失败（谁胜出、谁被顶掉），不做任何实际副作用；
 *    - run  模式：真正执行动作。
 *  检测器用 test 模式跑全部动作，把「同一组合键被多个动作认领」暴露出来，
 *  同时保证检测过程绝不改动用户的文档。
 */
export type ShortcutMode = 'run' | 'test'

/** 单次派发的结果 */
export interface ShortcutDispatchResult {
  /** 该组合键是否属于某个动作 */
  handled: boolean
  /** 胜出的动作 id（handled 时必有） */
  actionId?: string
  /** 因同一组合键被更靠前的动作抢占、而未能执行的动作 id 列表 */
  shadowedActionIds: string[]
  /** test 模式下不执行动作，故恒为 true；run 模式下表示动作是否真的执行成功 */
  ok: boolean
}

/**
 * 动作的实际执行表。由 UI 层（NoteEditor / NotesPage）在挂载时注册，
 * 使 store 能在 test/run 两种模式下统一派发。
 */
type ShortcutRunner = () => boolean
const runners = new Map<string, ShortcutRunner>()

/**
 * 动作的「能力探针」表：只回答「这个动作在当前环境能否生效」，绝不产生副作用。
 *
 * 为什么还需要探针（用户报告的核心问题）：
 *  仅靠「绑定表里有没有这个键」无法发现「键绑了、但动作实现是坏的」——
 *  实测案例：删除线快捷键绑定正确、按键也确实派发到了 action，
 *  但实现里用了 document.execCommand（在 ProseMirror 中无效），
 *  于是「按了没反应」，而冲突检测完全看不出来。
 *  探针让检测能发现这一类「静默失效」：test 模式下运行探针，
 *  返回 false 即报告为「该快捷键无法生效」。
 */
type ShortcutProbe = () => boolean
const probes = new Map<string, ShortcutProbe>()

/**
 * 运行时失败记录：真实按键执行动作后，如果动作报告失败，就在这里记一笔。
 *
 * 为什么必须有它（用户核心诉求「按了没反应却检测不出冲突」）：
 *  探针只能在**事先**检查前置条件（schema 是否存在、编辑器是否就绪…），
 *  但很多失效是**运行时**才发生的：选区为空、面板刚打开就被关掉、
 *  命令因当前文档结构返回 false……探针事前无从得知。
 *  只靠探针，这类「按了确实失败」的情况永远检测不出来。
 *  因此在 run 模式记录真实失败，让检测能把它报出来（下次成功时清除）。
 *
 * 用 ref 而不是普通 Map：界面（快捷键弹窗）需要响应式地看到新记录，
 * 否则用户按下失败的快捷键后打开弹窗，列表不会更新。
 */
const runFailures = ref<Record<string, { reason: string; at: number }>>({})

/** 读取当前记录的运行时失败（供检测/界面展示） */
export function getRunFailures(): Array<{ actionId: string; reason: string; at: number }> {
  return Object.entries(runFailures.value).map(([actionId, v]) => ({ actionId, ...v }))
}

/** 清除某动作的失败记录（手动重试成功后） */
export function clearRunFailure(actionId: string): void {
  if (actionId in runFailures.value) {
    const next = { ...runFailures.value }
    delete next[actionId]
    runFailures.value = next
  }
}

/**
 * 按键事件的可观测记录（诊断用）。
 *
 * 为什么需要：用户反复报告「某快捷键无效且检测不出冲突」，但按键究竟走到哪一步了，
 * 从外部完全看不到。此记录把每次按下的关键事实留下来：
 *   - 归一出什么组合键（是不是我预期的那个）
 *   - 有没有匹配到动作
 *   - 是被什么原因提前拦下的（对话框、源码模式守卫、输入框守卫）
 *   - 最终是否真正执行、成功与否
 * 这样「无效」就能被定位到**具体哪一层**，而不是继续推测。
 */
export interface KeyTrace {
  at: number
  rawKey: string
  combo: string
  actionId?: string
  /** 在到达动作之前被拦下的原因；未拦下则为空 */
  blockedBy?: string
  executed?: boolean
  ok?: boolean
}

const keyTraces = ref<KeyTrace[]>([])

/** 记录一次按键（只保留最近 50 条，避免长期占用内存） */
export function traceKey(entry: KeyTrace): void {
  const next = [...keyTraces.value, entry]
  keyTraces.value = next.length > 50 ? next.slice(next.length - 50) : next
}

/** 读取按键记录（诊断用） */
export function getKeyTraces(): KeyTrace[] {
  return [...keyTraces.value]
}

/** 清空按键记录 */
export function clearKeyTraces(): void {
  keyTraces.value = []
}

/** 注册（或覆盖）某动作的执行函数 */
export function registerRunner(actionId: string, runner: ShortcutRunner): void {
  runners.set(actionId, runner)
}

/** 注册某动作的能力探针（无副作用，仅用于检测） */
export function registerProbe(actionId: string, probe: ShortcutProbe): void {
  probes.set(actionId, probe)
}

/** 注销某动作的执行函数与探针（组件卸载时调用，避免悬挂引用） */
export function unregisterRunner(actionId: string): void {
  runners.delete(actionId)
  probes.delete(actionId)
}

/**
 * 按组合键派发一次快捷键。
 *
 * 这是**唯一的派发入口**：编辑器/笔记页的键盘处理都应调用它，
 * 而不是各自写 if-else 比较组合键。这样冲突检测与真实行为必然一致
 * （检测器用同一张表 + 同一个派发函数跑 test 模式）。
 *
 * 冲突语义：同一组合键被多个动作绑定时，按 SHORTCUT_ACTIONS 的**声明顺序**
 * 取第一个能执行的动作，其余记为 shadowed（被顶掉）。
 * 检测界面据此把「被顶掉」的动作标出来——这才是真正的冲突，而不是字符串重复。
 */
export function dispatch(combo: string, mode: ShortcutMode = 'run'): ShortcutDispatchResult {
  if (!combo) return { handled: false, shadowedActionIds: [], ok: false }
  const matched = SHORTCUT_ACTIONS.filter(a => comboFor(a.id) === combo)
  if (!matched.length) return { handled: false, shadowedActionIds: [], ok: false }

  const action = matched[0]
  const shadowed = matched.slice(1).map(a => a.id)

  if (mode === 'test') {
    // 测试模式：不执行真实动作（无副作用），只回答「这个键归谁」+ 探针结论
    const probe = probes.get(action.id)
    const ok = probe ? probe() : runners.has(action.id)
    return { handled: true, actionId: action.id, shadowedActionIds: shadowed, ok }
  }

  const runner = runners.get(action.id)
  const ok = runner ? runner() : false
  // 记录运行时失败：这是探针无法事前发现的失效（空选区、命令返回 false…）
  if (!ok) {
    runFailures.value = {
      ...runFailures.value,
      [action.id]: { reason: '按下后动作报告失败（可能是选区为空或当前状态不支持）', at: Date.now() },
    }
  } else {
    clearRunFailure(action.id)
  }
  return { handled: true, actionId: action.id, shadowedActionIds: shadowed, ok }
}

/**
 * 检测**笔记模块内部**的快捷键冲突。
 *
 * 用户要求（本轮变更）：
 *   「删除快捷键冲突检测的外部检测逻辑，反正也没什么用，只检测笔记模块内部的冲突」。
 *
 * 因此本函数只做内部检查，共两类：
 *   1) duplicate：同一组合键被多个动作认领 → 按声明顺序只有靠前者生效，
 *      其余等于「按了没反应」。由 test 模式真实派发得出，不是字符串比对。
 *   2) unusable：该动作在当前环境无法生效（缺实现、或能力探针判定不可用）。
 *
 * 不再检查「与其它软件/系统保留键」的冲突（原因见文件上方 RESERVED_COMBOS 处的说明：
 * 应用无法探测外部占用，那张表既不可穷举也无法验证，只会制造误导）。
 * 界面上会改为提示用户：若某个快捷键确实无效，请**自己录制一个新的组合键**。
 */
export function detectConflicts(): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = []
  const seenCombo = new Set<string>()

  for (const action of SHORTCUT_ACTIONS) {
    const combo = comboFor(action.id)
    if (!combo) continue
    if (seenCombo.has(combo)) continue
    seenCombo.add(combo)

    // 同一按键被多个动作认领 → 靠后的动作实际失效（用 test 模式真实派发判定）
    const result = dispatch(combo, 'test')
    if (result.shadowedActionIds.length) {
      conflicts.push({
        combo,
        actionIds: [result.actionId as string, ...result.shadowedActionIds],
        kind: 'duplicate',
      })
    }

    // 探针判定「绑了但用不了」→ 报告为不可用。
    // 键位、绑定都正确，但动作实现在当前环境不生效（例如所需 mark 缺失）。
    if (!result.ok) {
      conflicts.push({
        combo,
        actionIds: [result.actionId as string],
        kind: 'unusable',
        reason: '该快捷键在当前环境无法生效（动作实现或所需能力不可用）',
      })
    }
  }

  // 缺执行函数且没有探针的动作：按了必然没反应。
  // test 模式已在上面通过 result.ok 覆盖了「有探针但探针失败」的情况；
  // 这里再兜一层「完全没有实现」的动作。
  for (const action of SHORTCUT_ACTIONS) {
    const combo = comboFor(action.id)
    if (!combo) continue
    if (runners.has(action.id) || probes.has(action.id)) continue
    const already = conflicts.some(c => c.actionIds.includes(action.id))
    if (already) continue
    conflicts.push({
      combo,
      actionIds: [action.id],
      kind: 'unusable',
      reason: '该动作没有可执行的实现（按下不会生效）',
      })
    }

  // 运行时失败：探针事前检查不出来、但用户真实按下后确实失败了。
  // 这是「按了没反应，却说没冲突」的最后一块拼图 —— 记录来自 run 模式的真实执行。
  for (const { actionId, reason } of getRunFailures()) {
    const combo = comboFor(actionId)
    if (!combo) continue
    if (conflicts.some(c => c.actionIds.includes(actionId))) continue
    conflicts.push({ combo, actionIds: [actionId], kind: 'unusable', reason })
  }

  return conflicts
}

/**
 * 预演一组绑定，检测其中的冲突（录制时实时校验用）。
 * 只做**组内重复**的静态比较 —— 外部保留键检测已按用户要求删除。
 */
export function previewConflicts(map: Record<string, string>): ShortcutConflict[] {
  const byCombo = new Map<string, string[]>()
  for (const action of SHORTCUT_ACTIONS) {
    const combo = map[action.id] ?? action.default
    if (!combo) continue
    const list = byCombo.get(combo) || []
    list.push(action.id)
    byCombo.set(combo, list)
  }
  const conflicts: ShortcutConflict[] = []
  for (const [combo, actionIds] of byCombo) {
    if (actionIds.length > 1) {
      conflicts.push({ combo, actionIds, kind: 'duplicate' })
    }
  }
  return conflicts
}

/**
 * 检测所有冲突。
 * 保留旧名字作为兼容入口：不带参数走真实派发检测，带 map 走预演。
 */
export function findConflicts(map?: Record<string, string>): ShortcutConflict[] {
  if (map) return previewConflicts(map)
  return detectConflicts()
}

/** 某动作当前是否被其它动作顶掉（用于界面标注） */
export function isShadowed(actionId: string): boolean {
  const combo = comboFor(actionId)
  if (!combo) return false
  const result = dispatch(combo, 'test')
  return !!result.actionId && result.actionId !== actionId
}

/**
 * 绑定组合键。
 *
 * 返回结构化结果而非单纯的 ok/error：调用方（设置弹窗）需要知道
 * 「被哪个动作占用」，才能给出可操作提示。
 *
 * 注意（本轮变更）：**不再做外部保留键检测**（用户要求删除）。
 * 因此这里不再拒绝任何组合键——包括 Ctrl+W、F5 这类可能被系统占用的键。
 * 理由见 RESERVED_COMBOS 处的说明：应用无法探测外部占用，拒绝反而会挡住
 * 用户真正需要的键位。若绑了之后发现无效，界面会提示用户换一个组合键。
 *
 * 另外：允许绑定到已被其它动作占用的组合键（并如实报告 conflict），
 * 不再直接拒绝——用户可能正是想调整绑定顺序，或想先看看冲突在哪。
 * 真正的「谁生效」由 dispatch 的声明顺序决定，界面会把冲突明确标出来。
 */
export function bind(actionId: string, combo: string): { ok: boolean; error?: string; conflict?: ShortcutConflict } {
  const action = SHORTCUT_ACTIONS.find(a => a.id === actionId)
  if (!action) return { ok: false, error: '未知动作' }
  if (!combo) return { ok: false, error: '组合键不能为空' }

  // 是否被其它动作占用：仍然写入绑定，但把冲突一并告知调用方
  const taken = SHORTCUT_ACTIONS.find(a => a.id !== actionId && comboFor(a.id) === combo)
  bindings.value = { ...bindings.value, [actionId]: combo }
  void persist()

  if (taken) {
    return {
      ok: true,
      conflict: { combo, actionIds: [taken.id, actionId], kind: 'duplicate' },
      error: `注意：「${taken.label}」也绑定了这个组合键，两者冲突（按声明顺序只有前者生效）`,
    }
  }
  return { ok: true }
}

/** 清空某动作的绑定（回退到默认值）；required 动作不允许清空 */
export function clear(actionId: string): { ok: boolean; error?: string } {
  const action = SHORTCUT_ACTIONS.find(a => a.id === actionId)
  if (!action) return { ok: false, error: '未知动作' }
  if (action.required) return { ok: false, error: `「${action.label}」是关键操作，不能解绑` }
  const next = { ...bindings.value }
  delete next[actionId]
  bindings.value = next
  void persist()
  return { ok: true }
}

/** 全部恢复默认绑定 */
export function reset() {
  bindings.value = {}
  void persist()
}

/** 从磁盘加载（幂等） */
export async function load(): Promise<void> {
  if (loaded.value) return
  try {
    const raw = await getData<Record<string, unknown>>(DATA_TYPE, DATA_KEY)
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const next: Record<string, string> = {}
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string' && SHORTCUT_ACTIONS.some(a => a.id === key)) next[key] = value
      }
      bindings.value = next
    }
  } catch {
    /* 读不到就用默认值 */
  } finally {
    loaded.value = true
  }
}

/** 写入磁盘（fire-and-forget，失败不打断编辑） */
async function persist(): Promise<void> {
  try {
    await setData(DATA_TYPE, DATA_KEY, { ...bindings.value })
  } catch {
    /* 忽略写入失败 */
  }
}

/** 供界面展示：动作 + 当前键 + 冲突标记 */
export interface ShortcutRow extends ShortcutAction {
  combo: string
  conflicts: ShortcutConflict[]
  /** 是否被其它动作顶掉 */
  shadowed?: boolean
}

export const shortcutRows = () => SHORTCUT_ACTIONS.map(action => {
  const combo = comboFor(action.id)
  return {
    ...action,
    combo,
    conflicts: findConflicts().filter(c => c.combo === combo),
    /** 被其它动作顶掉（真实冲突的表现） */
    shadowed: isShadowed(action.id),
  }
})

export { bindings }
