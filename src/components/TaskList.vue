<template>
  <div class="footprint-container">
    <div class="footprint-header">
      <h2>{{ pageTitle }}</h2>
    </div>
    <div class="header-actions">
      <!-- 日期选择 -->
      <LunarDatePicker
          v-model="selectedDateValue"
          placeholder="选择日期"
      />

      <!-- 记录足迹按钮 -->
      <el-button type="primary" @click="handleAddTask">
        <el-icon><Plus /></el-icon>
        记录足迹
      </el-button>
    </div>

    <div class="footprint-content">
      <el-scrollbar>
        <!-- 空状态 -->
        <div v-if="filteredTasks.length === 0" class="empty-state">
          <el-empty
              :description="emptyText"
              :image-size="120"
          />
          <el-button type="primary" @click="handleAddTask" class="empty-add-btn">
            <el-icon><Plus /></el-icon>
            记录足迹
          </el-button>
        </div>

        <template v-else>
          <!-- 单日模式 -->
          <div class="diary-section">
            <div class="diary-header">
              <div class="diary-header-left">
                <p class="diary-date-display">{{ formatFullDate(selectedDate) }}</p>
                <p class="diary-intro">{{ diaryIntro }}</p>
                <p class="diary-mood">{{ diaryMood }}</p>
              </div>
            </div>

            <div class="diary-content">
              <!-- 时段记录 -->
              <div v-if="morningTasks.length > 0" class="diary-period">
                <p class="period-title">上午</p>
                <div class="period-items">
                  <div v-for="task in morningTasks" :key="task.id" class="period-item">
                    <div class="item-row">
                      <span class="item-time">{{ task.startTime }} - {{ task.endTime }}</span>
                      <span class="item-name">{{ task.name }}</span>
                      <span class="item-desc">{{ generateTaskDescription(task) }}</span>
                    </div>
                    <div v-if="task.notes" class="item-notes">{{ task.notes }}</div>
                    <div class="item-actions">
                      <el-button
                          type="primary"
                          :icon="Edit"
                          circle
                          size="small"
                          @click="handleEditTask(task)"
                      />
                      <el-popconfirm
                          title="确定删除这条记录吗？"
                          @confirm="handleDeleteTask(task.id)"
                          confirm-button-text="确定"
                          cancel-button-text="取消"
                      >
                        <template #reference>
                          <el-button
                              type="danger"
                              :icon="Delete"
                              circle
                              size="small"
                          />
                        </template>
                      </el-popconfirm>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="afternoonTasks.length > 0" class="diary-period">
                <p class="period-title">下午</p>
                <div class="period-items">
                  <div v-for="task in afternoonTasks" :key="task.id" class="period-item">
                    <div class="item-row">
                      <span class="item-time">{{ task.startTime }} - {{ task.endTime }}</span>
                      <span class="item-name">{{ task.name }}</span>
                      <span class="item-desc">{{ generateTaskDescription(task) }}</span>
                    </div>
                    <div v-if="task.notes" class="item-notes">{{ task.notes }}</div>
                    <div class="item-actions">
                      <el-button
                          type="primary"
                          :icon="Edit"
                          circle
                          size="small"
                          @click="handleEditTask(task)"
                      />
                      <el-popconfirm
                          title="确定删除这条记录吗？"
                          @confirm="handleDeleteTask(task.id)"
                          confirm-button-text="确定"
                          cancel-button-text="取消"
                      >
                        <template #reference>
                          <el-button
                              type="danger"
                              :icon="Delete"
                              circle
                              size="small"
                          />
                        </template>
                      </el-popconfirm>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="eveningTasks.length > 0" class="diary-period">
                <p class="period-title">晚上</p>
                <div class="period-items">
                  <div v-for="task in eveningTasks" :key="task.id" class="period-item">
                    <div class="item-row">
                      <span class="item-time">{{ task.startTime }} - {{ task.endTime }}</span>
                      <span class="item-name">{{ task.name }}</span>
                      <span class="item-desc">{{ generateTaskDescription(task) }}</span>
                    </div>
                    <div v-if="task.notes" class="item-notes">{{ task.notes }}</div>
                    <div class="item-actions">
                      <el-button
                          type="primary"
                          :icon="Edit"
                          circle
                          size="small"
                          @click="handleEditTask(task)"
                      />
                      <el-popconfirm
                          title="确定删除这条记录吗？"
                          @confirm="handleDeleteTask(task.id)"
                          confirm-button-text="确定"
                          cancel-button-text="取消"
                      >
                        <template #reference>
                          <el-button
                              type="danger"
                              :icon="Delete"
                              circle
                              size="small"
                          />
                        </template>
                      </el-popconfirm>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 智能总结 -->
              <div class="diary-summary">
                <p class="summary-title">{{ summaryTitle }}</p>
                <p class="summary-content">
                  <template v-for="(segment, index) in summarySegments" :key="index">
                    <span :class="`segment-${segment.type}`">{{ segment.text }}</span>
                  </template>
                </p>
              </div>
            </div>
          </div>
        </template>
      </el-scrollbar>
    </div>

    <TaskForm
        v-model:visible="formVisible"
        :task="editingTask"
        :defaultDate="selectedDate"
        @submit="handleFormSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import 'dayjs/locale/zh-cn'
import { useTaskStore, type Task } from '../stores/taskStore'
import TaskForm from './TaskForm.vue'
import LunarDatePicker from './LunarDatePicker.vue'
import { logger } from '../lib/logger'

dayjs.extend(isoWeek)
dayjs.locale('zh-cn')

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const taskStore = useTaskStore()

// 选中的日期（默认今天）
const selectedDateValue = ref(dayjs().format('YYYY-MM-DD'))

watch(selectedDateValue, (newDate) => {
  logger.info('[足迹] 切换日期', { date: newDate })
})

// 计算日期范围（单日模式）
const dateRange = computed(() => {
  return {
    start: selectedDateValue.value,
    end: selectedDateValue.value
  }
})

// 当前选择的日期（用于日记显示）
const selectedDate = computed(() => dateRange.value.start)

// 判断是否是当前日期
const isCurrentDay = computed(() => {
  return selectedDateValue.value === dayjs().format('YYYY-MM-DD')
})

// 页面标题
const pageTitle = computed(() => {
  if (isCurrentDay.value) return '今日足迹'
  return `${dayjs(dateRange.value.start).format('YYYY年M月D日')}足迹`
})

// 空状态文本
const emptyText = computed(() => {
  if (isCurrentDay.value) return '今天还没有留下足迹，快去记录吧！'
  return '这一天还没有留下足迹'
})

// 筛选任务
const filteredTasks = computed(() => {
  const { start, end } = dateRange.value
  return taskStore.tasks
      .filter(t => t.date >= start && t.date <= end)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.startTime || '00:00').localeCompare(b.startTime || '00:00')
      })
})

// 单日模式的任务列表
const todayTasks = computed(() => {
  return filteredTasks.value
})

const formVisible = ref(false)
const editingTask = ref<Task | null>(null)

// 计算各时段任务
const morningTasks = computed(() => {
  return todayTasks.value.filter(task => {
    const hour = parseInt((task.startTime || '00:00').split(':')[0])
    return hour < 12
  })
})

const afternoonTasks = computed(() => {
  return todayTasks.value.filter(task => {
    const hour = parseInt((task.startTime || '00:00').split(':')[0])
    return hour >= 12 && hour < 18
  })
})

const eveningTasks = computed(() => {
  return todayTasks.value.filter(task => {
    const hour = parseInt((task.startTime || '00:00').split(':')[0])
    return hour >= 18
  })
})

// 计算总时长
const totalDuration = computed(() => {
  return filteredTasks.value.reduce((sum, task) => {
    if (task.startTime && task.endTime) {
      const start = task.startTime.split(':').map(Number)
      const end = task.endTime.split(':').map(Number)
      return sum + (end[0] * 60 + end[1]) - (start[0] * 60 + start[1])
    }
    return sum + (task.duration || 0)
  }, 0)
})

// 日记开篇
const diaryIntro = computed(() => {
  if (filteredTasks.value.length === 1) {
    return '简单的一天，专注于做一件事。'
  } else if (filteredTasks.value.length >= 5) {
    return '忙碌而充实的一天，记录下这些美好的时刻。'
  }
  return '平凡的一天，也值得被记录。'
})

// 日记心情
const diaryMood = computed(() => {
  const total = filteredTasks.value.length
  if (total === 0) return '今日关键词：探索'
  if (total === 1) return '今日关键词：专注'
  if (total >= 5) return '今日关键词：充实'
  return '今日关键词：平凡'
})

// 时段标题
const morningTitle = computed(() => morningTasks.value.length >= 3 ? '晨间时光' : '上午')
const afternoonTitle = computed(() => afternoonTasks.value.length >= 3 ? '午后时光' : '下午')
const eveningTitle = computed(() => eveningTasks.value.length >= 3 ? '晚间时光' : '晚上')
const summaryTitle = computed(() => '今日总结')

// 智能总结
const diarySummary = computed(() => {
  const total = filteredTasks.value.length
  const duration = totalDuration.value
  const durationText = duration > 0 ? `，总计约${formatDuration(duration)}` : ''

  // 日模式
  if (total === 0) {
    if (isCurrentDay.value) return '今天还没有留下足迹，快去记录吧！'
    return '这一天还没有留下足迹。'
  }
  if (total === 1) return '专注做一件事，有时候比忙碌一整天更有意义。'
  if (total >= 6) return `今天完成了${total}件事${durationText}，高效且充实。`
  return `今天完成了${total}件事${durationText}，平凡的一天也有它的意义。`
})

// 总结文本分段（用于颜色区分）
interface SummarySegment {
  text: string
  type: 'normal' | 'number' | 'duration' | 'keyword' | 'highlight'
}

const summarySegments = computed((): SummarySegment[] => {
  const text = diarySummary.value
  const segments: SummarySegment[] = []

  // 匹配数字（如：1件事、6件事）
  const numberPattern = /(\d+)件/g
  // 匹配时长（如：总计约2小时30分钟）
  const durationPattern = /，总计约([^，。]+)/g
  // 匹配关键词
  const keywords = ['高效', '充实', '运动', '学习', '放松休息', '进步', '专注', '意义', '坚持']

  let lastIndex = 0
  const matches: { index: number; length: number; type: SummarySegment['type'] }[] = []

  // 找出所有数字匹配
  let match
  while ((match = numberPattern.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length, type: 'number' })
  }

  // 找出时长匹配
  while ((match = durationPattern.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length, type: 'duration' })
  }

  // 找出关键词匹配
  keywords.forEach(keyword => {
    let idx = text.indexOf(keyword)
    while (idx !== -1) {
      matches.push({ index: idx, length: keyword.length, type: 'keyword' })
      idx = text.indexOf(keyword, idx + 1)
    }
  })

  // 按位置排序
  matches.sort((a, b) => a.index - b.index)

  // 构建分段
  matches.forEach(m => {
    if (m.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, m.index), type: 'normal' })
    }
    if (m.index >= lastIndex) {
      segments.push({ text: text.slice(m.index, m.index + m.length), type: m.type })
      lastIndex = m.index + m.length
    }
  })

  // 添加剩余文本
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), type: 'normal' })
  }

  return segments.length > 0 ? segments : [{ text, type: 'normal' }]
})

// 根据任务内容生成个性化描述
const generateTaskDescription = (task: Task) => {
  const name = task.name.toLowerCase()

  const keywordDescriptions: Record<string, string> = {
    '跑步|跑步机|晨跑|夜跑': '在奔跑中感受风的自由',
    '健身|力量|哑铃|器械': '挥洒汗水，塑造更好的自己',
    '游泳|泳池': '在水中畅游，享受运动的快乐',
    '瑜伽|冥想': '静心养性，身心合一',
    '篮球|足球|羽毛球|网球': '一场酣畅淋漓的运动',
    '读书|看书|阅读': '沉浸书海，收获新知',
    '英语|单词|学习': '每天进步一点点',
    '编程|代码|开发': '用代码创造可能',
    '写作|写文章': '用文字记录灵感',
    '会议|开会': '高效沟通，推进项目',
    '加班': '加班加点，努力向前',
    '面试': '每一次面试都是成长',
    '汇报': '展示成果，总结经验',
    '早餐|午餐|晚餐|吃饭': '好好吃饭，照顾好自己',
    '睡觉|午休|休息': '适当休息，积蓄能量',
    '购物|买东西': '逛街购物，生活需要仪式感',
    '做饭|烹饪|煮饭': '下厨时光，充满烟火气',
    '游戏|打游戏|玩游戏': '游戏时光，释放压力',
    '看电影|追剧|电视剧': '享受影视，放松身心',
    '听音乐|音乐': '沉浸在音乐的世界里',
    '聊天|聚会|朋友': '与朋友相聚，时光美好',
    '约会|见面': '珍惜每一次相遇',
    '上课|课堂|听课': '汲取知识，充实自我',
  }

  for (const [pattern, desc] of Object.entries(keywordDescriptions)) {
    if (new RegExp(pattern, 'i').test(name)) return desc
  }

  return '完成了这件事'
}

// 格式化
const formatFullDate = (date: string) => dayjs(date).format('YYYY年MM月DD日 dddd')
const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`
  if (hours > 0) return `${hours}h`
  return `${mins}min`
}

// 操作
const handleAddTask = () => {
  editingTask.value = null
  formVisible.value = true
}

const handleEditTask = (task: Task) => {
  editingTask.value = task
  formVisible.value = true
}

const handleDeleteTask = (id: string) => {
  taskStore.deleteTask(id)
  logger.info('[足迹] 删除足迹', { taskId: id })
  ElMessage.success('记录删除成功')
}

const handleFormSubmit = (task: Task) => {
  if (editingTask.value) {
    logger.info('[足迹] 编辑足迹', { taskId: task.id, name: task.name })
  } else {
    logger.info('[足迹] 添加足迹', { name: task.name })
  }
  editingTask.value = null
}

// 复制日记
const copyDiary = () => {
  let text = `${formatFullDate(selectedDate.value)}\n\n`
  text += `${diaryIntro.value}\n`
  text += `${diaryMood.value}\n\n`

  if (morningTasks.value.length > 0) {
    text += `【${morningTitle.value}】\n`
    morningTasks.value.forEach(task => {
      text += `【${task.startTime}】-【${task.endTime}】，【${task.name}】，${generateTaskDescription(task)}\n`
    })
    text += '\n'
  }

  if (afternoonTasks.value.length > 0) {
    text += `【${afternoonTitle.value}】\n`
    afternoonTasks.value.forEach(task => {
      text += `【${task.startTime}】-【${task.endTime}】，【${task.name}】，${generateTaskDescription(task)}\n`
    })
    text += '\n'
  }

  if (eveningTasks.value.length > 0) {
    text += `【${eveningTitle.value}】\n`
    eveningTasks.value.forEach(task => {
      text += `【${task.startTime}】-【${task.endTime}】，【${task.name}】，${generateTaskDescription(task)}\n`
    })
    text += '\n'
  }

  text += `【${summaryTitle.value}】\n`
  text += `${diarySummary.value}`

  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('日记已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败，请手动复制')
  })
}
</script>

<style scoped>
.footprint-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.03);
}

.footprint-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.footprint-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.header-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 24px;
  gap: 12px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
}

.empty-add-btn {
  margin-top: 16px;
}

.date-input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
}

.date-input-wrapper .date-input {
  width: auto;
  flex-shrink: 0;
}

.date-input-wrapper .date-input.year {
  width: 4.5ch;
  min-width: 3.5ch;
}

.date-input-wrapper .date-input.small {
  width: 2.5ch;
  min-width: 2ch;
}

.date-input-wrapper .date-input :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none;
  padding: 0 4px;
}

.date-input-wrapper .date-input :deep(.el-input__inner) {
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
}

.date-suffix {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  padding-right: 6px;
  user-select: none;
}

.date-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  flex-shrink: 0;
  white-space: nowrap;
}

.add-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
  flex-shrink: 0;
}

.footprint-content {
  flex: 1;
  min-height: 0;
}

.footprint-content :deep(.el-scrollbar) {
  height: 100%;
}

.footprint-content :deep(.el-scrollbar__view) {
  min-height: 100%;
}

/* 日记区域样式 */
.diary-section {
  margin: 24px;
  padding: 24px;
}

.diary-header {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.diary-header-left {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.diary-date-display {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 12px 0;
}

.diary-intro {
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 8px 0;
}

.diary-mood {
  color: rgba(167, 139, 250, 0.9);
  font-size: 14px;
  padding: 6px 12px;
  background: rgba(167, 139, 250, 0.15);
  border-radius: 20px;
  display: inline-block;
  margin: 0;
}

.diary-content {
  line-height: 1.8;
  text-align: center;
}

/* 时段区域 */
.diary-period {
  margin-top: 20px;
}

.period-title {
  font-weight: 600;
  color: #fff;
  margin: 0 0 12px 0;
  font-size: 15px;
  text-align: center;
}

.period-items {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.period-item {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 14px;
  margin: 8px 0;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  transition: all 0.2s ease;
  width: 100%;
  max-width: 600px;
}

.period-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.item-row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-category {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 4px;
  flex-shrink: 0;
}

.item-time {
  color: rgba(147, 197, 253, 0.9);
  font-size: 13px;
  flex-shrink: 0;
  font-weight: 500;
}

.item-name {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
  font-size: 14px;
}

.item-desc {
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
}

.item-notes {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin-top: 4px;
  padding-left: 14px;
  line-height: 1.5;
  border-left: 2px solid rgba(255, 255, 255, 0.15);
}

.item-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.period-item:hover .item-actions {
  opacity: 1;
}

/* 总结区域 */
.diary-summary {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
  width: 100%;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.summary-title {
  font-weight: 600;
  color: #fff;
  margin: 0 0 12px 0;
  font-size: 15px;
  text-align: center;
}

.summary-content {
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  line-height: 1.8;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  margin: 0;
}

.summary-content .segment-number {
  color: #fbbf24;
  font-weight: 600;
}

.summary-content .segment-duration {
  color: #67e8f9;
  font-weight: 500;
}

.summary-content .segment-keyword {
  color: #a78bfa;
  font-weight: 500;
}

.summary-content .segment-highlight {
  color: #f472b6;
  font-weight: 500;
}

.summary-content .segment-normal {
  color: rgba(255, 255, 255, 0.75);
}

/* 时间统计 */
.diary-stats {
  margin: 0 24px 24px 24px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.stats-title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  padding-left: 8px;
  border-left: 3px solid rgba(103, 232, 249, 0.8);
}

.stats-total {
  font-size: 14px;
  color: #67e8f9;
  font-weight: 500;
}

.stats-charts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.chart-section {
  flex: 1;
  min-width: 200px;
}

.section-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 12px;
}

.pie-chart-container {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pie-chart {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}

.pie-segment {
  transition: opacity 0.2s ease;
}

.pie-segment:hover {
  opacity: 0.8;
}

.chart-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  flex: 1;
}

.legend-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

/* 日期类型选择器样式 */
.date-type-select {
  width: 72px;
  flex-shrink: 0;
}

.date-type-select :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: none !important;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.date-type-select :deep(.el-input__wrapper):hover {
  border-color: rgba(102, 126, 234, 0.5) !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

.date-type-select :deep(.el-input__wrapper.is-focus) {
  border-color: #667eea !important;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2) !important;
}

.date-type-select :deep(.el-input__inner) {
  color: rgba(255, 255, 255, 0.9) !important;
}

.date-type-select :deep(.el-input__suffix) {
  color: rgba(255, 255, 255, 0.6) !important;
}

.date-type-select :deep(.el-input__suffix-inner) {
  color: rgba(255, 255, 255, 0.6) !important;
}

.date-type-select :deep(.el-select__caret) {
  color: rgba(255, 255, 255, 0.6) !important;
}

/* 日期下拉选择器容器 */
.date-select-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 日期下拉选择器样式 */
.date-select {
  flex-shrink: 0;
}

.date-select.year {
  width: 91px !important;
}

.date-select.month {
  width: 75px !important;
}

.date-select.day {
  width: 75px !important;
}

.date-select :deep(.el-input) {
  width: 100% !important;
}

.date-select :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: none !important;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.date-select :deep(.el-input__wrapper):hover {
  border-color: rgba(102, 126, 234, 0.5) !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

.date-select :deep(.el-input__wrapper.is-focus) {
  border-color: #667eea !important;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2) !important;
}

.date-select :deep(.el-input__inner) {
  color: rgba(255, 255, 255, 0.9) !important;
  text-align: center;
}

.date-select :deep(.el-input__suffix),
.date-select :deep(.el-select__caret) {
  color: rgba(255, 255, 255, 0.6) !important;
}

/* 数字输入框通用样式 */
.header-actions .date-input-wrapper {
  background: rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.header-actions .date-input-wrapper:hover {
  border-color: rgba(102, 126, 234, 0.5) !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

.header-actions .date-input-wrapper:focus-within {
  border-color: #667eea !important;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2) !important;
}

/* 统计全屏展示样式 */
.stats-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-shrink: 0;
}

.stats-header-left h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.stats-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stats-header-right :deep(.el-radio-button__inner) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
}

.stats-header-right :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: #fff;
}

.stats-body {
  flex: 1;
  min-height: 0;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.trend-chart {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 20px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  padding-top: 20px;
}

.chart-bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.bar-wrapper {
  width: 100%;
  height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
}

.bar {
  width: 100%;
  max-width: 40px;
  min-height: 4px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0.3s ease;
}

.bar-value {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.bar-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8px;
  text-align: center;
}

.focus-ranking {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ranking-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 16px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
}

.ranking-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.ranking-name {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-count {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}

.ranking-duration {
  font-size: 13px;
  color: #67e8f9;
  font-weight: 500;
  flex-shrink: 0;
}

.no-data {
  padding: 60px 0;
}
</style>
