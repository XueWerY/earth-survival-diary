<template>
  <div class="settings-page">
    <div class="settings-content">
      <el-scrollbar>
        <!-- 专注模块设置 -->
        <div class="settings-section">
          <h3 class="section-title">
            <span class="title-icon">🍅</span>
            专注设置
          </h3>
          <p class="section-desc">配置番茄钟的默认时长。</p>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">番茄时长</span>
              <span class="setting-desc">每个番茄钟的默认工作时长（分钟）</span>
            </div>
            <div class="setting-control">
              <el-input-number
                  v-model="focusSettings.pomodoroDuration"
                  :min="1"
                  :max="120"
                  :step="5"
                  size="default"
              />
            </div>
          </div>
        </div>

        <!-- 课程表模块设置 -->
        <div class="settings-section">
          <h3 class="section-title">
            <span class="title-icon">📚</span>
            课程表设置
          </h3>
          <p class="section-desc">设置学期信息，用于计算当前周次。</p>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">开学日期</span>
              <span class="setting-desc">学期第一周的周一日期</span>
            </div>
            <div class="setting-control">
              <LunarDatePicker
                  v-model="courseSettings.semesterStartDate"
                  :show-lunar="true"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">学期周数</span>
              <span class="setting-desc">本学期总共有多少周</span>
            </div>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettings.totalWeeks"
                  :min="1"
                  :max="30"
                  :step="1"
                  size="default"
              />
            </div>
          </div>

          <div class="setting-tip" v-if="courseSettings.semesterStartDate">
            当前学期第 {{ currentWeekNumber }} 周 / 共 {{ courseSettings.totalWeeks }} 周
          </div>
        </div>

        <!-- 快捷键设置 -->
        <div class="settings-section">
          <h3 class="section-title">
            <span class="title-icon">⌨️</span>
            星际笔记快捷键
          </h3>
          <p class="section-desc">自定义星际笔记编辑器的快捷键，点击输入框后按下新的组合键即可换绑。</p>

          <div class="shortcut-list">
            <div class="shortcut-item">
              <div class="shortcut-info">
                <span class="shortcut-label">行内公式</span>
                <span class="shortcut-desc">将选中文本或插入行内公式</span>
              </div>
              <div class="shortcut-input-wrapper">
                <input
                    type="text"
                    class="shortcut-input"
                    :value="settingsStore.settings.shortcuts.inlineMath"
                    readonly
                    @keydown="handleShortcutInput($event, 'inlineMath')"
                    placeholder="点击后按下组合键"
                />
              </div>
            </div>

            <div class="shortcut-item">
              <div class="shortcut-info">
                <span class="shortcut-label">块级公式</span>
                <span class="shortcut-desc">将选中文本或插入块级公式</span>
              </div>
              <div class="shortcut-input-wrapper">
                <input
                    type="text"
                    class="shortcut-input"
                    :value="settingsStore.settings.shortcuts.blockMath"
                    readonly
                    @keydown="handleShortcutInput($event, 'blockMath')"
                    placeholder="点击后按下组合键"
                />
              </div>
            </div>

            <div class="shortcut-item">
              <div class="shortcut-info">
                <span class="shortcut-label">保存笔记</span>
                <span class="shortcut-desc">保存当前编辑的笔记</span>
              </div>
              <div class="shortcut-input-wrapper">
                <input
                    type="text"
                    class="shortcut-input"
                    :value="settingsStore.settings.shortcuts.save"
                    readonly
                    @keydown="handleShortcutInput($event, 'save')"
                    placeholder="点击后按下组合键"
                />
              </div>
            </div>
          </div>

          <div class="shortcut-conflict-warning" v-if="conflictMsg">
            ⚠️ {{ conflictMsg }}
          </div>

          <div class="shortcut-actions">
            <el-button @click="handleReset">恢复默认</el-button>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../stores/settingsStore'
import LunarDatePicker from './LunarDatePicker.vue'
import dayjs from 'dayjs'

const settingsStore = useSettingsStore()
const conflictMsg = ref('')

// 本地设置状态（用于实时编辑）
const focusSettings = ref({
  pomodoroDuration: 25
})

const courseSettings = ref({
  semesterStartDate: '',
  totalWeeks: 20
})

// 计算当前周次
const currentWeekNumber = computed(() => {
  if (!courseSettings.value.semesterStartDate) return 1
  const startDate = dayjs(courseSettings.value.semesterStartDate)
  const today = dayjs()
  const diff = today.diff(startDate, 'week')
  return Math.max(1, diff + 1)
})

// 加载设置
onMounted(async () => {
  await settingsStore.loadSettings()
  // 同步到本地状态
  focusSettings.value.pomodoroDuration = settingsStore.settings.focus?.pomodoroDuration || 25
  courseSettings.value.semesterStartDate = settingsStore.settings.course?.semesterStartDate || ''
  courseSettings.value.totalWeeks = settingsStore.settings.course?.totalWeeks || 20
})

// 监听专注设置变化并保存
watch(() => focusSettings.value.pomodoroDuration, async (val) => {
  await settingsStore.updateFocusSettings({ pomodoroDuration: val })
})

// 监听课程表设置变化并保存
watch(() => courseSettings.value.semesterStartDate, async (val) => {
  await settingsStore.updateCourseSettings({ semesterStartDate: val })
})

watch(() => courseSettings.value.totalWeeks, async (val) => {
  await settingsStore.updateCourseSettings({ totalWeeks: val })
})

// 检测快捷键冲突
const checkConflict = (shortcut: string, excludeKey?: string): string | null => {
  const shortcuts: Record<string, string> = {}
  if (excludeKey !== 'inlineMath') {
    shortcuts[settingsStore.settings.shortcuts.inlineMath] = '行内公式'
  }
  if (excludeKey !== 'blockMath') {
    shortcuts[settingsStore.settings.shortcuts.blockMath] = '块级公式'
  }
  if (excludeKey !== 'save') {
    shortcuts[settingsStore.settings.shortcuts.save] = '保存笔记'
  }
  return shortcuts[shortcut] || null
}

// 处理快捷键输入
const handleShortcutInput = async (e: KeyboardEvent, key: 'inlineMath' | 'blockMath' | 'save') => {
  e.preventDefault()
  e.stopPropagation()

  // 忽略单独的修饰键
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return
  }

  // 构建快捷键字符串
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (e.key && e.key !== ' ') parts.push(e.key.toUpperCase())

  if (parts.length < 2) {
    conflictMsg.value = '请使用组合键（如 Ctrl+M）'
    return
  }

  const newShortcut = parts.join('+')

  // 检测冲突
  const conflict = checkConflict(newShortcut, key)
  if (conflict) {
    conflictMsg.value = `${newShortcut} 已被 "${conflict}" 占用，请使用其他组合键`
    return
  }

  // 清除冲突提示
  conflictMsg.value = ''

  // 保存到服务器
  const success = await settingsStore.updateShortcut(key, newShortcut)
  if (success) {
    ElMessage.success(`快捷键已更改为 ${newShortcut}`)
  } else {
    ElMessage.error('保存失败，请重试')
  }
}

// 恢复默认
const handleReset = async () => {
  try {
    await settingsStore.resetSettings()
    // 重置本地状态
    focusSettings.value.pomodoroDuration = 25
    courseSettings.value.semesterStartDate = ''
    courseSettings.value.totalWeeks = 20
    conflictMsg.value = ''
    ElMessage.success('已恢复默认设置')
  } catch {
    ElMessage.error('恢复默认设置失败')
  }
}
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(15, 12, 41, 0.6);
  backdrop-filter: blur(20px);
}

.settings-content {
  flex: 1;
  overflow: hidden;
}

.settings-section {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px 0;
}

.title-icon {
  font-size: 18px;
}

.section-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 20px 0;
}

/* 设置项 */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin-bottom: 12px;
  gap: 16px;
}

.setting-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.setting-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.setting-control {
  flex-shrink: 0;
}

.setting-tip {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  color: #667eea;
  font-size: 13px;
}

/* 快捷键列表 */
.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  gap: 16px;
}

.shortcut-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shortcut-label {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.shortcut-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.shortcut-input-wrapper {
  flex-shrink: 0;
}

.shortcut-input {
  width: 140px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  text-align: center;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
  transition: all 0.2s;
}

.shortcut-input:hover {
  border-color: rgba(102, 126, 234, 0.5);
  background: rgba(255, 255, 255, 0.15);
}

.shortcut-input:focus {
  outline: none;
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.1);
}

.shortcut-conflict-warning {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #f87171;
  font-size: 13px;
}

.shortcut-actions {
  margin-top: 20px;
}
</style>