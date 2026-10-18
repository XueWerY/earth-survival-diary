<template>
  <!--
    z-index 取 10100：项目自绘滚动条（.app-scrollbar-track）基础层级是 10050，
    并且它按「宿主祖先最大 z-index + 1」计算实际层级。BaseDialog 默认 9999 时
    两者层级接近，笔记列表的滚动条会盖在弹窗上（用户报告「被笔记列表滚动条挡住」）。
    把整个弹窗抬到明显高于滚动条层即可消除遮挡。
    auto-height + 下面的 .sc-scroll 结构：让滚动条贴到**弹窗自己的右边框**。
    原因：BaseDialog 的 .dialog-body 有 padding: 12px 20px，
    若直接在 body 里滚动，滚动条会挂在「内容盒」右边缘、距弹窗边框还差 20px
    （用户报告「吸附在滚动容器边界而不是弹窗边界」）。
    改为：body 内不再滚动（auto-height），由 .sc-scroll 占满宽度并自身滚动，
    再把 20px 的左右留白下沉到 .sc-dialog 内部 —— 这样滚动容器右边缘
    就等于弹窗内容区右边缘，滚动条紧贴弹窗边框。
  -->
  <BaseDialog
    :visible="visible"
    title="快捷键设置"
    :width="620"
    :z-index="10100"
    auto-height
    @update:visible="emit('update:visible', $event)"
  >
    <!--
      .sc-scroll 占满弹窗内容区的整宽并自身滚动：它的右边缘 = 弹窗内容区右边缘，
      因此项目自绘滚动条会紧贴弹窗边框。
      左右 20px 留白下沉到内部的 .sc-dialog，避免留白把滚动条推离边框。
    -->
    <div class="sc-scroll">
    <div class="sc-dialog">
      <!--
        整句写在同一行：模板里的换行会被 HTML 折叠成一个空格，
        会让文字之间多出空档（用户指出）。
        用 <strong> 而不是 Markdown 的 **…**（Vue 模板不是 Markdown，星号会原样显示）。
      -->
      <p class="sc-tip">点「录制」后按下想要的组合键即可重新绑定。这里只检查<strong>笔记模块内部的冲突</strong>（同一个组合键被两个动作占用时，靠后的那个不会生效）。不再检测与系统/其它软件的冲突——应用无法探测外部占用，那种检测没有实际作用。<strong>如果某个快捷键按下无效，请点那一行的「录制」自己换一个组合键。</strong></p>

      <div v-if="conflicts.length" class="sc-conflicts">
        <div class="sc-conflicts-head">检测到 {{ conflicts.length }} 处冲突</div>
        <ul>
          <li v-for="(c, i) in conflicts" :key="i">
            <code>{{ formatCombo(c.combo) }}</code>
            <span v-if="c.kind === 'duplicate'">
              —— 多个动作占用同一按键：
              <strong>{{ c.actionIds.map(id => labelOf(id)).join('、') }}</strong>
              （只有声明靠前者生效）
            </span>
            <span v-else-if="c.kind === 'unusable'">
              ——
              <strong>{{ c.actionIds.map(id => labelOf(id)).join('、') }}</strong>
              ：{{ c.reason }}
            </span>
            <span v-else>—— {{ c.reason }}</span>
          </li>
        </ul>
      </div>
      <div v-else class="sc-ok">未检测到内部冲突（同一组合键没有被两个动作占用）</div>

      <!-- 上次被拦下的动作：解释「绑了却没反应」，与上面的静态冲突区分开 -->
      <div v-if="blockedText" class="sc-blocked">{{ blockedText }}</div>

      <!--
        按键诊断：把最近按下的按键逐条列出，说明它落在哪一层。
        默认**展开**（之前放在折叠的 <details> 里，用户容易以为「没有收录」）。
        用法：在这里按一下无效的快捷键，即可判断页面到底有没有收到这个按键。
      -->
      <details class="sc-traces" open>
        <summary>
          按键诊断（最近 {{ keyTraces.length }} 条）
          <span class="sc-traces-hint">在这里直接按一下无效的快捷键，就能看到它有没有到达页面</span>
        </summary>
        <ul v-if="keyTraces.length">
          <li v-for="(t, i) in keyTraces.slice().reverse()" :key="i">
            <code>{{ t.combo || t.rawKey || '(仅修饰键)' }}</code>
            <span v-if="t.executed">
              →
              <strong>{{ labelOf(t.actionId || '') }}</strong>
              {{ t.ok ? '执行成功' : '执行失败' }}
            </span>
            <span v-else-if="t.blockedBy">→ 被拦下：{{ t.blockedBy }}</span>
            <span v-else>→ 已派发</span>
          </li>
        </ul>
        <p v-else class="sc-traces-empty">
          还没有任何记录。<strong>若你刚按过快捷键却仍为空，说明该按键根本没有到达本应用</strong>
          —— 通常是被输入法或其它软件的**系统级热键**抢占了，
          本应用无法拦截，也无法从应用内检测到（浏览器没有这个能力）。
          解决办法：换一个组合键（点对应行的「录制」重新绑定），
          或在那个占用它的软件里取消该热键。
        </p>
      </details>

      <div class="sc-groups">
        <div v-for="group in groups" :key="group.name" class="sc-group">
          <div class="sc-group-head">{{ group.name }}</div>
          <div
            v-for="row in group.rows"
            :key="row.id"
            class="sc-row"
            :class="{ recording: recordingId === row.id, conflicted: conflictsOf(row.id).length > 0 }"
          >
            <span class="sc-row-label">{{ row.label }}</span>
            <span class="sc-row-combo" :title="row.combo">
              <template v-if="recordingId === row.id">请按下组合键…</template>
              <code v-else>{{ formatCombo(row.combo) || '未绑定' }}</code>
            </span>
            <span class="sc-row-actions">
              <button
                type="button"
                class="sc-btn"
                :class="{ on: recordingId === row.id }"
                @click="toggleRecord(row)"
              >{{ recordingId === row.id ? '取消' : '录制' }}</button>
              <button
                type="button"
                class="sc-btn"
                :disabled="row.required"
                :title="row.required ? '关键操作不能解绑' : '恢复默认'"
                @click="onClear(row)"
              >清除</button>
            </span>
          </div>
        </div>
      </div>

      <p v-if="message" class="sc-message" :class="{ error: messageIsError }">{{ message }}</p>
    </div>
    </div>

    <template #footer>
      <button class="sc-btn" @click="onReset">全部恢复默认</button>
      <button class="sc-btn sc-btn-primary" @click="emit('update:visible', false)">完成</button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BaseDialog from '../ui/BaseDialog.vue'
import {
  SHORTCUT_ACTIONS,
  clear as clearBinding,
  comboFromEvent,
  formatCombo,
  reset as resetBindings,
  bind as bindCombo,
  bindings,
  findConflicts,
  getRunFailures,
  getKeyTraces,
} from '../../stores/shortcutStore'

const props = withDefaults(defineProps<{
  visible: boolean
  /**
   * 最近一次快捷键被拦下的原因（由 NoteEditor 记录）。
   * 用于解释「明明绑了、按了却没反应」——区分「动作实现不可用」与「事件被守卫拦掉」。
   */
  blockedReason?: { actionId: string; reason: string } | null
}>(), { visible: false, blockedReason: null })

/** 被拦动作的可读描述 */
const blockedText = computed(() => {
  const b = props.blockedReason
  if (!b) return ''
  return `「${labelOf(b.actionId)}」上次没有生效：${b.reason}`
})

/** 最近的按键诊断记录（打开弹窗时读取一次即可） */
const keyTraces = computed(() => {
  void props.visible
  return getKeyTraces()
})
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

/** 正在录制的动作 id（null 表示未录制） */
const recordingId = ref<string | null>(null)
const message = ref('')
const messageIsError = ref(false)

const labelOf = (id: string) => SHORTCUT_ACTIONS.find(a => a.id === id)?.label || id

const conflicts = computed(() => {
  // 依赖 bindings 触发重算；同时依赖「运行时失败记录」——
  // 用户在笔记里按了快捷键失败后打开本弹窗，应能看到那一条失败。
  void bindings.value
  void getRunFailures()
  // findConflicts() 不带参数 → 走「真的把所有动作派发一遍（test 模式）」的检测，
  // 因此能发现「同一按键被多个动作认领」这类真实冲突，而不只是字符串重复。
  return findConflicts()
})

const conflictsOf = (id: string) => {
  const combo = comboFor(id)
  return conflicts.value.filter(c => c.combo === combo)
}

const comboFor = (id: string) => bindings.value[id] ?? SHORTCUT_ACTIONS.find(a => a.id === id)?.default ?? ''

const groups = computed(() => {
  void bindings.value
  const order: string[] = []
  const map = new Map<string, typeof SHORTCUT_ACTIONS>()
  for (const action of SHORTCUT_ACTIONS) {
    if (!map.has(action.group)) {
      map.set(action.group, [])
      order.push(action.group)
    }
    map.get(action.group)!.push(action)
  }
  return order.map(name => ({
    name,
    rows: (map.get(name) || []).map(a => ({ ...a, combo: comboFor(a.id) })),
  }))
})

const notify = (text: string, isError = false) => {
  message.value = text
  messageIsError.value = isError
}

const toggleRecord = (row: { id: string }) => {
  if (recordingId.value === row.id) {
    recordingId.value = null
    return
  }
  recordingId.value = row.id
  message.value = ''
  // 捕获阶段拦截按键，避免被编辑器/全局快捷键截走
  window.addEventListener('keydown', onRecordKeydown, true)
}

/**
 * 录制中的按键处理：Esc 取消，修饰键单独按下忽略。
 *
 * ⚠️ 这里必须做「防呆自愈」，否则会造成全局快捷键集体失效（真实故障）：
 *  本监听器注册在 **window 捕获阶段**并调用 stopPropagation()，
 *  意味着它一旦残留，会拦掉**所有**按键——包括编辑器的全局快捷键
 *  （删除线 Ctrl+Shift+X、大纲 Ctrl+Shift+O 等会表现为「按了完全没反应」，
 *  且按键日志里也查不到，因为事件在 window 就被截住了）。
 *  它能残留下来的典型路径：用户点了「录制」后又用别的方式关闭弹窗
 *  （Esc / 点遮罩 / 路由切换）而没有走 stopRecording。
 *  因此这里加三重自愈：
 *    1) 弹窗不可见时立刻自行注销（不再依赖调用方是否记得调 stopRecording）；
 *    2) 只对「本弹窗仍处于打开状态」的按键生效，否则注销并放行；
 *    3) 收到的按键若不属于本弹窗的交互目标，也放行。
 */
const onRecordKeydown = (event: KeyboardEvent) => {
  // 自愈 1：弹窗已关闭 → 立即注销自己并把事件放行（绝不吞键）
  if (!props.visible) {
    stopRecording()
    return
  }
  if (!recordingId.value) {
    // 自愈 2：没有在录制 → 这个监听器本不该存在，注销并放行
    stopRecording()
    return
  }
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    stopRecording()
    return
  }
  const combo = comboFromEvent(event)
  if (!combo) return // 仅按下修饰键，继续等待

  const result = bindCombo(recordingId.value, combo)
  const actionLabel = labelOf(recordingId.value)
  if (!result.ok) {
    // 绑定被拒（只剩「未知动作 / 组合键为空」这类本地校验，不再有外部保留键拒绝）
    notify(result.error || '绑定失败', true)
    return
  }
  if (result.conflict) {
    // 与其它动作重复：绑定已写入，但必须明确告知冲突（不再「静默成功」，
    // 否则用户会以为没冲突 —— 这正是之前「根本没检测到冲突」的观感来源）
    const others = result.conflict.actionIds
      .filter(id => id !== recordingId.value)
      .map(id => labelOf(id))
      .join('、')
    notify(`已设为 ${formatCombo(combo)}，但与「${others}」重复：按声明顺序只有前者生效`, true)
    stopRecording()
    return
  }
  notify(`已把「${actionLabel}」设为 ${formatCombo(combo)}`)
  stopRecording()
}

const stopRecording = () => {
  recordingId.value = null
  window.removeEventListener('keydown', onRecordKeydown, true)
}

const onClear = (row: { id: string; required?: boolean }) => {
  if (row.required) {
    notify('关键操作不能解绑', true)
    return
  }
  const result = clearBinding(row.id)
  if (!result.ok) {
    notify(result.error || '清除失败', true)
    return
  }
  notify(`「${labelOf(row.id)}」已恢复默认`)
}

const onReset = () => {
  resetBindings()
  notify('已全部恢复默认快捷键')
}

watch(() => props.visible, visible => {
  if (!visible && recordingId.value) stopRecording()
  if (visible) message.value = ''
})

onBeforeUnmount(stopRecording)
</script>

<style scoped>
/* 滚动容器：占满弹窗内容区整宽，自身滚动。
   它的右边缘就是弹窗内容区右边缘 → 项目自绘滚动条紧贴弹窗边框
   （BaseDialog 的 .dialog-body 自带 20px 左右 padding，若让它滚动，
   滚动条会挂在 padding 内缩后的位置，即用户说的「吸附在滚动容器边界」）。
   注意不要在这里加 padding-right，否则滚动条又会被推离边框。 */
.sc-scroll {
  max-height: 62vh;
  overflow-y: auto;
}

/* 内容区：左右 20px 留白放在这里（滚动容器内部），
   这样留白不会影响滚动条贴边 */
.sc-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 20px;
}

.sc-tip {
  margin: 0;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.9);
  line-height: 1.7;
}

.sc-conflicts {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.sc-conflicts-head {
  font-size: 12px;
  font-weight: 600;
  color: #fca5a5;
  margin-bottom: 6px;
}

.sc-conflicts ul {
  margin: 0;
  padding-left: 18px;
  color: #fecaca;
  font-size: 12px;
  line-height: 1.8;
}

.sc-conflicts code {
  color: #fde68a;
}

.sc-ok {
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
  font-size: 12px;
}

/* 上次被拦下的动作说明：用琥珀色与「静态冲突」的红色区分开 */
.sc-blocked {
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.32);
  color: #fcd34d;
  font-size: 12px;
  line-height: 1.6;
}

/* 按键诊断：默认展开，不打扰正常使用 */
.sc-traces {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  color: var(--chalk-white-80, #cbd5e1);
}
.sc-traces summary {
  cursor: pointer;
  color: var(--chalk-dim, #94a3b8);
  font-size: 11.5px;
}
.sc-traces-hint {
  display: block;
  margin-top: 2px;
  color: rgba(148, 163, 184, 0.65);
  font-size: 10.5px;
}
.sc-traces-empty {
  margin: 6px 0 0;
  color: var(--chalk-dim, #94a3b8);
  font-size: 11.5px;
  line-height: 1.7;
}
.sc-traces-empty strong {
  color: #fcd34d;
  font-weight: 600;
}
.sc-traces ul {
  margin: 6px 0 0;
  padding-left: 16px;
  max-height: 180px;
  overflow-y: auto;
}
.sc-traces li {
  margin: 3px 0;
  line-height: 1.5;
}
.sc-traces code {
  margin-right: 4px;
}

.sc-groups { display: flex; flex-direction: column; gap: 14px; }

.sc-group-head {
  font-size: 12px;
  font-weight: 600;
  color: rgba(191, 219, 254, 0.9);
  margin-bottom: 6px;
}

.sc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
}

.sc-row:hover { background: rgba(255, 255, 255, 0.04); }

.sc-row.recording {
  background: rgba(102, 126, 234, 0.18);
  box-shadow: inset 0 0 0 1px rgba(102, 126, 234, 0.5);
}

.sc-row.conflicted { background: rgba(239, 68, 68, 0.1); }

.sc-row-label {
  flex: 1;
  font-size: 13px;
  color: #e2e8f0;
}

.sc-row-combo { min-width: 132px; }

.sc-row-combo code {
  font-size: 12px;
  color: #fde68a;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.09);
}

.sc-row.recording .sc-row-combo { color: #c7d2fe; font-size: 12px; }

.sc-row-actions { display: flex; gap: 6px; }

.sc-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.16s;
}

.sc-btn:hover:not(:disabled) { background: rgba(102, 126, 234, 0.22); }
.sc-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.sc-btn.on { background: rgba(102, 126, 234, 0.4); color: #e0e7ff; }
.sc-btn-primary { background: rgba(102, 126, 234, 0.4); color: #f1f5f9; font-weight: 600; }

.sc-message { margin: 0; font-size: 12px; color: #86efac; }
.sc-message.error { color: #fca5a5; }
</style>
