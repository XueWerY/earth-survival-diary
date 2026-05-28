<template>
  <div class="footprint-container">
    <div class="footprint-header">
      <div class="header-left">
        <h2>{{ title }}</h2>
        <p class="header-desc">{{ description }}</p>
      </div>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-value">{{ totalTasks }}</span>
          <span class="stat-label">件事</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ formatDuration(totalDuration) }}</span>
          <span class="stat-label">时长</span>
        </div>
      </div>
    </div>

    <div class="footprint-content">
      <el-scrollbar>
        <el-empty
            v-if="groupedTasks.length === 0"
            :description="emptyText"
            :image-size="120"
        />

        <div v-else class="history-list">
          <div v-for="group in groupedTasks" :key="group.date" class="day-group">
            <div class="day-header">
              <span class="day-date">{{ formatDateLabel(group.date) }}</span>
              <span class="day-count">{{ group.tasks.length }} 件事</span>
            </div>

            <div class="day-diary">
              <div class="diary-intro-section">
                <p class="diary-intro">{{ generateDayIntro(group.tasks) }}</p>
                <p class="diary-mood">{{ generateDayMood(group.tasks) }}</p>
              </div>

              <!-- 时段记录 -->
              <div v-if="getMorningTasks(group.tasks).length > 0" class="diary-period">
                <p class="period-title">上午</p>
                <div class="period-items">
                  <p v-for="task in getMorningTasks(group.tasks)" :key="task.id" class="period-item">
                    <span class="item-time">{{ task.startTime }} - {{ task.endTime }}</span>
                    <span class="item-name">{{ task.name }}</span>
                    <span class="item-desc">{{ generateTaskDescription(task) }}</span>
                  </p>
                </div>
              </div>

              <div v-if="getAfternoonTasks(group.tasks).length > 0" class="diary-period">
                <p class="period-title">下午</p>
                <div class="period-items">
                  <p v-for="task in getAfternoonTasks(group.tasks)" :key="task.id" class="period-item">
                    <span class="item-time">{{ task.startTime }} - {{ task.endTime }}</span>
                    <span class="item-name">{{ task.name }}</span>
                    <span class="item-desc">{{ generateTaskDescription(task) }}</span>
                  </p>
                </div>
              </div>

              <div v-if="getEveningTasks(group.tasks).length > 0" class="diary-period">
                <p class="period-title">晚上</p>
                <div class="period-items">
                  <p v-for="task in getEveningTasks(group.tasks)" :key="task.id" class="period-item">
                    <span class="item-time">{{ task.startTime }} - {{ task.endTime }}</span>
                    <span class="item-name">{{ task.name }}</span>
                    <span class="item-desc">{{ generateTaskDescription(task) }}</span>
                  </p>
                </div>
              </div>

              <div class="diary-summary">
                <p class="summary-content">
                  <template v-for="(segment, index) in getSummarySegments(group.tasks)" :key="index">
                    <span :class="`segment-${segment.type}`">{{ segment.text }}</span>
                  </template>
                </p>
              </div>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import 'dayjs/locale/zh-cn'
import { useTaskStore, type Task } from '../../stores/taskStore'

dayjs.extend(isoWeek)
dayjs.locale('zh-cn')

const props = defineProps<{
  period: 'week' | 'month' | 'year'
}>()

const taskStore = useTaskStore()

// 标题和描述
const title = computed(() => {
  const titles = {
    week: '本周足迹',
    month: '本月足迹',
    year: '本年足迹'
  }
  return titles[props.period]
})

const description = computed(() => {
  const descs = {
    week: '这一周，你走过的每一步',
    month: '这个月，你创造的故事',
    year: '这一年，你留下的印记'
  }
  return descs[props.period]
})

const emptyText = computed(() => {
  const texts = {
    week: '这周还没有留下足迹',
    month: '这个月还没有留下足迹',
    year: '今年还没有留下足迹'
  }
  return texts[props.period]
})

// 时间范围
const dateRange = computed(() => {
  const now = dayjs()
  if (props.period === 'week') {
    return {
      start: now.startOf('isoWeek').format('YYYY-MM-DD'),
      end: now.endOf('isoWeek').format('YYYY-MM-DD')
    }
  } else if (props.period === 'month') {
    return {
      start: now.startOf('month').format('YYYY-MM-DD'),
      end: now.endOf('month').format('YYYY-MM-DD')
    }
  } else {
    return {
      start: now.startOf('year').format('YYYY-MM-DD'),
      end: now.endOf('year').format('YYYY-MM-DD')
    }
  }
})

// 筛选任务
const filteredTasks = computed(() => {
  return taskStore.tasks
      .filter(t => t.date >= dateRange.value.start && t.date <= dateRange.value.end)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date)
        return a.startTime.localeCompare(b.startTime)
      })
})

// 按日期分组
const groupedTasks = computed(() => {
  const groups: { date: string; tasks: Task[] }[] = []
  const dateMap = new Map<string, Task[]>()

  filteredTasks.value.forEach(task => {
    if (!dateMap.has(task.date)) {
      dateMap.set(task.date, [])
    }
    dateMap.get(task.date)!.push(task)
  })

  dateMap.forEach((tasks, date) => {
    groups.push({ date, tasks: tasks.sort((a, b) => a.startTime.localeCompare(b.startTime)) })
  })

  return groups
})

// 统计
const totalTasks = computed(() => filteredTasks.value.length)

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

// 时段任务
const getMorningTasks = (tasks: Task[]) => tasks.filter(t => parseInt(t.startTime.split(':')[0]) < 12)
const getAfternoonTasks = (tasks: Task[]) => {
  const h = (t: Task) => parseInt(t.startTime.split(':')[0])
  return tasks.filter(t => h(t) >= 12 && h(t) < 18)
}
const getEveningTasks = (tasks: Task[]) => tasks.filter(t => parseInt(t.startTime.split(':')[0]) >= 18)

// 生成描述
const generateDayIntro = (tasks: Task[]) => {
  const total = tasks.length
  if (total === 1) return '简单的一天，专注于做一件事。'
  if (total >= 5) return '忙碌而充实的一天。'
  return '平凡的一天。'
}

const generateDayMood = (tasks: Task[]) => {
  const total = tasks.length
  if (total === 1) return '专注'
  if (total >= 5) return '充实'
  return '平凡'
}

const generateDaySummary = (tasks: Task[]) => {
  const total = tasks.length
  const duration = tasks.reduce((sum, t) => {
    if (t.startTime && t.endTime) {
      const start = t.startTime.split(':').map(Number)
      const end = t.endTime.split(':').map(Number)
      return sum + (end[0] * 60 + end[1]) - (start[0] * 60 + start[1])
    }
    return sum + (t.duration || 0)
  }, 0)

  const durationText = duration > 0 ? `，约${formatDuration(duration)}` : ''
  return `完成了${total}件事${durationText}。`
}

// 总结文本分段（用于颜色区分）
interface SummarySegment {
  text: string
  type: 'normal' | 'number' | 'duration'
}

const getSummarySegments = (tasks: Task[]): SummarySegment[] => {
  const text = generateDaySummary(tasks)
  const segments: SummarySegment[] = []

  // 匹配数字（如：1件事）
  const numberPattern = /(\d+)件/g
  // 匹配时长（如：，约2小时30分钟）
  const durationPattern = /，约([^。]+)/g

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
}

const generateTaskDescription = (task: Task) => {
  const name = task.name.toLowerCase()

  const keywords: Record<string, string> = {
    '跑步|晨跑|夜跑': '在奔跑中感受自由',
    '健身|力量|哑铃': '挥洒汗水',
    '游泳': '在水中畅游',
    '瑜伽|冥想': '静心养性',
    '篮球|足球|羽毛球|网球': '酣畅淋漓的运动',
    '读书|看书|阅读': '沉浸书海',
    '英语|单词|学习': '每天进步',
    '编程|代码|开发': '用代码创造',
    '写作|写文章': '用文字记录',
    '会议|开会': '高效沟通',
    '早餐|午餐|晚餐|吃饭': '好好吃饭',
    '睡觉|午休|休息': '休息放松',
    '游戏|打游戏': '游戏时光',
    '看电影|追剧': '享受影视',
    '聊天|聚会|朋友': '与朋友相聚',
  }

  for (const [pattern, desc] of Object.entries(keywords)) {
    if (new RegExp(pattern, 'i').test(name)) return desc
  }

  return '完成了'
}

// 格式化
const formatDateLabel = (date: string) => {
  const d = dayjs(date)
  const today = dayjs()
  const yesterday = dayjs().subtract(1, 'day')

  if (date === today.format('YYYY-MM-DD')) return '今天'
  if (date === yesterday.format('YYYY-MM-DD')) return '昨天'
  return d.format('MM月DD日 dddd')
}

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`
  if (hours > 0) return `${hours}h`
  return `${mins}min`
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
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.header-left h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--chalk-white);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.header-desc {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--chalk-muted);
}

.header-stats {
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--chalk-white);
}

.stat-label {
  font-size: 12px;
  color: var(--chalk-muted);
}

.footprint-content {
  flex: 1;
  min-height: 0;
}

.footprint-content :deep(.el-scrollbar) {
  height: 100%;
}

.history-list {
  padding: 16px 24px;
}

.day-group {
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.06) 0%, rgba(118, 75, 162, 0.06) 100%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.day-date {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
}

.day-count {
  font-size: 12px;
  color: var(--chalk-muted);
}

.day-diary {
  line-height: 1.8;
}

.diary-intro-section {
  margin-bottom: 16px;
}

.diary-intro {
  color: var(--chalk-white-85);
  font-size: 14px;
  margin: 0 0 6px 0;
}

.diary-mood {
  color: rgba(167, 139, 250, 0.9);
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(167, 139, 250, 0.15);
  border-radius: 12px;
  display: inline-block;
  margin: 0;
}

.diary-period {
  margin-top: 12px;
}

.period-title {
  font-weight: 600;
  color: var(--chalk-white-90);
  margin: 0 0 8px 0;
  font-size: 13px;
  padding-left: 6px;
  border-left: 2px solid rgba(102, 126, 234, 0.6);
}

.period-items {
  padding-left: 10px;
}

.period-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin: 4px 0;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  font-size: 13px;
}

.item-category {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.item-time {
  color: rgba(147, 197, 253, 0.9);
  font-size: 12px;
  flex-shrink: 0;
  font-weight: 500;
}

.item-name {
  color: var(--chalk-white-95);
  font-weight: 600;
}

.item-desc {
  color: rgba(255, 255, 255, 0.55);
}

.diary-summary {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

.summary-content {
  color: var(--chalk-white-70);
  font-size: 13px;
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

.summary-content .segment-normal {
  color: var(--chalk-white-70);
}
</style>
