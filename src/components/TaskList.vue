<template>
  <div class="footprint-container">
    <div class="footprint-header">
      <h2>{{ pageTitle }}</h2>
      <div class="header-actions">
        <!-- 日期选择 -->
        <LunarDatePicker
            v-model="selectedDateValue"
            placeholder="选择日期"
        />

        <!-- 统计按钮 -->
        <el-button @click="showStats = true">
          <el-icon><DataLine /></el-icon>
          统计
        </el-button>
      </div>
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
              <div class="diary-header-actions">
                <el-button type="primary" size="small" @click="handleAddTask" class="add-btn-small">
                  <el-icon><Plus /></el-icon>
                  记录足迹
                </el-button>
                <el-button type="primary" size="small" text @click="copyDiary" class="copy-btn">
                  复制
                </el-button>
              </div>
            </div>

            <div class="diary-content">
              <!-- 时段记录 -->
              <div v-if="morningTasks.length > 0" class="diary-period">
                <p class="period-title">{{ morningTitle }}</p>
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
                <p class="period-title">{{ afternoonTitle }}</p>
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
                <p class="period-title">{{ eveningTitle }}</p>
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

    <!-- 统计全屏展示 -->
    <div v-if="showStats" class="stats-fullscreen">
      <div class="stats-header">
        <div class="stats-header-left">
          <h2>足迹统计</h2>
        </div>
        <div class="stats-header-right">
          <el-radio-group v-model="statsRange" size="default">
            <el-radio-button value="day">日</el-radio-button>
            <el-radio-button value="week">周</el-radio-button>
            <el-radio-button value="month">月</el-radio-button>
            <el-radio-button value="year">年</el-radio-button>
          </el-radio-group>
          <!-- 日模式使用农历日期选择器 -->
          <LunarDatePicker
              v-if="statsRange === 'day'"
              v-model="statsDayDate"
              placeholder="选择日期"
          />
          <!-- 周/月/年模式使用 el-date-picker -->
          <el-date-picker
              v-else
              v-model="statsDate"
              :type="statsDatePickerType"
              :placeholder="statsDatePickerPlaceholder"
              :clearable="false"
              size="default"
              :format="statsDateFormat"
              :value-format="statsDateValueFormat"
          />
          <el-button @click="showStats = false" circle :icon="Close" />
        </div>
      </div>

      <el-scrollbar class="stats-body">
        <!-- 概览 -->
        <div class="stats-overview">
          <div class="stat-card">
            <div class="stat-value">{{ statsTaskCount }}</div>
            <div class="stat-label">足迹数量</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ formatDuration(statsTotalDuration) }}</div>
            <div class="stat-label">总时长</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ statsAvgDuration }}</div>
            <div class="stat-label">平均时长</div>
          </div>
        </div>

        <!-- 趋势图 -->
        <div class="trend-chart">
          <div class="chart-title">{{ statsTrendTitle }}</div>
          <div class="chart-bars" :style="{ height: statsChartHeight }">
            <div
                v-for="(stat, index) in statsTrendData"
                :key="index"
                class="chart-bar-item"
            >
              <div class="bar-wrapper">
                <div
                    class="bar"
                    :style="{ height: getStatsBarHeight(stat.duration) + '%' }"
                >
                  <span class="bar-value" v-if="stat.duration > 0">{{ formatStatsBarValue(stat.duration) }}</span>
                </div>
              </div>
              <div class="bar-label">{{ stat.label }}</div>
            </div>
          </div>
        </div>

        <!-- 事项分布饼图 -->
        <div v-if="statsTaskCount > 0" class="trend-chart">
          <div class="chart-title">事项分布</div>
          <div class="pie-chart-container">
            <svg viewBox="0 0 100 100" class="pie-chart">
              <circle cx="50" cy="50" r="40" fill="rgba(255,255,255,0.05)" />
              <template v-for="(segment, index) in statsPieSegments" :key="index">
                <path
                    :d="segment.path"
                    :fill="segment.color"
                    class="pie-segment"
                />
              </template>
            </svg>
            <div class="chart-legend">
              <div class="legend-item" v-for="(item, index) in statsTaskRanking" :key="item.name">
                <span class="legend-color" :style="{ background: getStatsTaskColor(index) }"></span>
                <span class="legend-text">{{ item.name }}</span>
                <span class="legend-value">{{ formatDuration(item.duration) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 事项排行 -->
        <div class="focus-ranking" v-if="statsTaskRanking.length > 0">
          <div class="ranking-title">事项排行</div>
          <div class="ranking-list">
            <div
                v-for="(item, index) in statsTaskRanking.slice(0, 10)"
                :key="item.name"
                class="ranking-item"
            >
              <span class="ranking-num">{{ index + 1 }}</span>
              <span class="ranking-name">{{ item.name }}</span>
              <span class="ranking-count">{{ item.count }}次</span>
              <span class="ranking-duration">{{ formatDuration(item.duration) }}</span>
            </div>
          </div>
        </div>

        <!-- 无数据提示 -->
        <div v-if="statsTaskCount === 0" class="no-data">
          <el-empty description="该时间段暂无足迹记录" :image-size="120" />
        </div>
      </el-scrollbar>
    </div>

    <TaskForm
        v-model:visible="formVisible"
        :task="editingTask"
        @submit="handleFormSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete, DataLine, Close } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import 'dayjs/locale/zh-cn'
import { useTaskStore, type Task } from '../stores/taskStore'
import TaskForm from './TaskForm.vue'
import LunarDatePicker from './LunarDatePicker.vue'

dayjs.extend(isoWeek)
dayjs.locale('zh-cn')

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const taskStore = useTaskStore()

// 选中的日期（默认今天）
const selectedDateValue = ref(dayjs().format('YYYY-MM-DD'))

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

// 生成饼图扇形路径
const generatePiePath = (startAngle: number, endAngle: number): string => {
  const cx = 50, cy = 50, r = 40

  // 特殊处理：完整的圆（360度）
  if (endAngle - startAngle >= 360) {
    // 使用两个半圆弧绘制完整圆
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`
  }

  const startRad = (startAngle - 90) * Math.PI / 180
  const endRad = (endAngle - 90) * Math.PI / 180

  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)

  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

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

// ========== 统计功能 ==========
const showStats = ref(false)
const statsRange = ref<'day' | 'week' | 'month' | 'year'>('day')
const statsDate = ref<Date>(new Date())
// 日模式下的字符串日期（用于 LunarDatePicker）
const statsDayDate = ref<string>(dayjs().format('YYYY-MM-DD'))

// 监听统计全屏状态变化，通知父组件
watch(showStats, (newVal) => {
  emit('fullscreen-change', newVal)
})

// 同步 statsDayDate 和 statsDate
watch(statsDayDate, (newVal) => {
  if (newVal) {
    statsDate.value = dayjs(newVal).toDate()
  }
})

watch(statsDate, (newVal) => {
  statsDayDate.value = dayjs(newVal).format('YYYY-MM-DD')
})

// 统计日期选择器类型
const statsDatePickerType = computed(() => {
  switch (statsRange.value) {
    case 'day': return 'date'
    case 'week': return 'week'
    case 'month': return 'month'
    case 'year': return 'year'
    default: return 'date'
  }
})

const statsDatePickerPlaceholder = computed(() => {
  switch (statsRange.value) {
    case 'day': return '选择日期'
    case 'week': return '选择周'
    case 'month': return '选择月份'
    case 'year': return '选择年份'
    default: return '选择日期'
  }
})

const statsDateFormat = computed(() => {
  switch (statsRange.value) {
    case 'day': return 'YYYY-MM-DD'
    case 'week': return 'YYYY [第] ww [周]'
    case 'month': return 'YYYY-MM'
    case 'year': return 'YYYY'
    default: return 'YYYY-MM-DD'
  }
})

const statsDateValueFormat = computed(() => {
  switch (statsRange.value) {
    case 'day': return 'YYYY-MM-DD'
    case 'week': return 'YYYY-MM-DD'
    case 'month': return 'YYYY-MM'
    case 'year': return 'YYYY'
    default: return 'YYYY-MM-DD'
  }
})

// 统计日期范围
const statsDateRange = computed(() => {
  const date = dayjs(statsDate.value)
  switch (statsRange.value) {
    case 'day':
      return { start: date.format('YYYY-MM-DD'), end: date.format('YYYY-MM-DD') }
    case 'week':
      return {
        start: date.startOf('isoWeek').format('YYYY-MM-DD'),
        end: date.endOf('isoWeek').format('YYYY-MM-DD')
      }
    case 'month':
      return {
        start: date.startOf('month').format('YYYY-MM-DD'),
        end: date.endOf('month').format('YYYY-MM-DD')
      }
    case 'year':
      return {
        start: date.startOf('year').format('YYYY-MM-DD'),
        end: date.endOf('year').format('YYYY-MM-DD')
      }
    default:
      return { start: date.format('YYYY-MM-DD'), end: date.format('YYYY-MM-DD') }
  }
})

// 统计数据
const statsTasks = computed(() => {
  const { start, end } = statsDateRange.value
  return taskStore.tasks.filter(t => t.date >= start && t.date <= end)
})

const statsTaskCount = computed(() => statsTasks.value.length)

const statsTotalDuration = computed(() => {
  return statsTasks.value.reduce((sum, task) => {
    if (task.startTime && task.endTime) {
      const start = task.startTime.split(':').map(Number)
      const end = task.endTime.split(':').map(Number)
      return sum + (end[0] * 60 + end[1]) - (start[0] * 60 + start[1])
    }
    return sum + (task.duration || 0)
  }, 0)
})

const statsAvgDuration = computed(() => {
  if (statsTaskCount.value === 0) return '0分钟'
  const avg = Math.round(statsTotalDuration.value / statsTaskCount.value)
  return formatDuration(avg)
})

// 统计趋势标题
const statsTrendTitle = computed(() => {
  switch (statsRange.value) {
    case 'day': return '时间分布'
    case 'week': return '本周每日趋势'
    case 'month': return '本月每周趋势'
    case 'year': return '本年每月趋势'
    default: return '时间趋势'
  }
})

// 统计图表高度
const statsChartHeight = computed(() => {
  switch (statsRange.value) {
    case 'day': return '160px'
    case 'week': return '200px'
    case 'month': return '200px'
    case 'year': return '200px'
    default: return '200px'
  }
})

// 统计趋势数据
const statsTrendData = computed(() => {
  const { start, end } = statsDateRange.value
  const startDate = dayjs(start)
  const endDate = dayjs(end)
  const data: { label: string; duration: number; count: number }[] = []

  if (statsRange.value === 'day') {
    // 按上午/下午/晚上分布
    const periods = [
      { label: '上午', startHour: 0, endHour: 12 },
      { label: '下午', startHour: 12, endHour: 18 },
      { label: '晚上', startHour: 18, endHour: 24 }
    ]

    periods.forEach(period => {
      const periodTasks = statsTasks.value.filter(t => {
        const taskHour = parseInt((t.startTime || '00:00').split(':')[0])
        return taskHour >= period.startHour && taskHour < period.endHour
      })
      const duration = periodTasks.reduce((sum, t) => {
        if (t.startTime && t.endTime) {
          const s = t.startTime.split(':').map(Number)
          const e = t.endTime.split(':').map(Number)
          return sum + (e[0] * 60 + e[1]) - (s[0] * 60 + s[1])
        }
        return sum + (t.duration || 0)
      }, 0)
      data.push({
        label: period.label,
        duration,
        count: periodTasks.length
      })
    })
  } else if (statsRange.value === 'week') {
    // 按天分布
    for (let d = 0; d < 7; d++) {
      const date = startDate.add(d, 'day')
      const dateStr = date.format('YYYY-MM-DD')
      const dayTasks = statsTasks.value.filter(t => t.date === dateStr)
      const duration = dayTasks.reduce((sum, t) => {
        if (t.startTime && t.endTime) {
          const s = t.startTime.split(':').map(Number)
          const e = t.endTime.split(':').map(Number)
          return sum + (e[0] * 60 + e[1]) - (s[0] * 60 + s[1])
        }
        return sum + (t.duration || 0)
      }, 0)
      data.push({
        label: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][d],
        duration,
        count: dayTasks.length
      })
    }
  } else if (statsRange.value === 'month') {
    // 按周分布
    const weeksInMonth = Math.ceil(endDate.date() / 7)
    for (let w = 1; w <= weeksInMonth && w <= 5; w++) {
      const weekStart = startDate.add((w - 1) * 7, 'day')
      const weekEnd = w === weeksInMonth ? endDate : startDate.add(w * 7 - 1, 'day')
      const weekTasks = statsTasks.value.filter(t =>
          t.date >= weekStart.format('YYYY-MM-DD') && t.date <= weekEnd.format('YYYY-MM-DD')
      )
      const duration = weekTasks.reduce((sum, t) => {
        if (t.startTime && t.endTime) {
          const s = t.startTime.split(':').map(Number)
          const e = t.endTime.split(':').map(Number)
          return sum + (e[0] * 60 + e[1]) - (s[0] * 60 + s[1])
        }
        return sum + (t.duration || 0)
      }, 0)
      data.push({
        label: `第${w}周`,
        duration,
        count: weekTasks.length
      })
    }
  } else if (statsRange.value === 'year') {
    // 按月分布
    for (let m = 0; m < 12; m++) {
      const monthStart = startDate.month(m).startOf('month')
      const monthEnd = startDate.month(m).endOf('month')
      const monthTasks = statsTasks.value.filter(t =>
          t.date >= monthStart.format('YYYY-MM-DD') && t.date <= monthEnd.format('YYYY-MM-DD')
      )
      const duration = monthTasks.reduce((sum, t) => {
        if (t.startTime && t.endTime) {
          const s = t.startTime.split(':').map(Number)
          const e = t.endTime.split(':').map(Number)
          return sum + (e[0] * 60 + e[1]) - (s[0] * 60 + s[1])
        }
        return sum + (t.duration || 0)
      }, 0)
      data.push({
        label: `${m + 1}月`,
        duration,
        count: monthTasks.length
      })
    }
  }

  return data
})

// 统计事项排行
const statsTaskRanking = computed(() => {
  const taskStats: Record<string, { count: number; duration: number }> = {}
  statsTasks.value.forEach(task => {
    if (!taskStats[task.name]) {
      taskStats[task.name] = { count: 0, duration: 0 }
    }
    taskStats[task.name].count++
    if (task.startTime && task.endTime) {
      const start = task.startTime.split(':').map(Number)
      const end = task.endTime.split(':').map(Number)
      taskStats[task.name].duration += (end[0] * 60 + end[1]) - (start[0] * 60 + start[1])
    } else {
      taskStats[task.name].duration += task.duration || 0
    }
  })

  return Object.entries(taskStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.duration - a.duration)
})

// 统计饼图扇形路径
const statsPieSegments = computed((): { path: string; color: string }[] => {
  const segments: { path: string; color: string }[] = []
  const total = statsTotalDuration.value
  if (total === 0) return segments

  let currentAngle = 0
  statsTaskRanking.value.forEach((item, index) => {
    if (item.duration > 0) {
      const angle = (item.duration / total) * 360
      segments.push({
        path: generatePiePath(currentAngle, currentAngle + angle),
        color: getStatsTaskColor(index)
      })
      currentAngle += angle
    }
  })

  return segments
})

// 获取统计任务颜色
const getStatsTaskColor = (index: number): string => {
  const colors = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
    '#fee140', '#a8edea', '#d299c2', '#fbbf24', '#f472b6',
    '#67e8f9', '#a78bfa', '#34d399', '#fb7185', '#38bdf8'
  ]
  return colors[index % colors.length]
}

// 获取柱状图高度百分比
const getStatsBarHeight = (duration: number): number => {
  const maxDuration = Math.max(...statsTrendData.value.map(d => d.duration), 1)
  return (duration / maxDuration) * 100
}

// 格式化柱状图值显示
const formatStatsBarValue = (duration: number): string => {
  if (duration < 60) return `${duration}分钟`
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`
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
  ElMessage.success('记录删除成功')
}

const handleFormSubmit = () => {
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
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  gap: 16px;
}

.footprint-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-end;
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
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.diary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.diary-header-left {
  flex: 1;
}

.diary-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;
}

.add-btn-small {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
}

.copy-btn {
  flex-shrink: 0;
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
  padding-left: 8px;
  border-left: 3px solid rgba(102, 126, 234, 0.8);
}

.period-items {
  padding-left: 12px;
}

.period-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  margin: 8px 0;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  transition: all 0.2s ease;
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
}

.summary-title {
  font-weight: 600;
  color: #fff;
  margin: 0 0 12px 0;
  font-size: 15px;
  padding-left: 8px;
  border-left: 3px solid rgba(167, 139, 250, 0.8);
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
