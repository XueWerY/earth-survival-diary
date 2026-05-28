<template>
  <div class="footprint-container">
    <div class="header-actions">
      <InlineLunarDatePicker ref="datePickerRef" v-model="selectedDateValue" @add-footprint="handleAddTask" @add-diary="handleAddDiary" />
    </div>

    <div class="footprint-content">
      <el-scrollbar>
        <div v-if="filteredTasks.length === 0 && missionCards.length === 0 && courseCards.length === 0 && countdownCards.length === 0 && positiveDayCards.length === 0" class="empty-state">
          <el-empty
              :description="emptyText"
              :image-size="120"
          />
        </div>

        <template v-else>
          <div class="diary-section">
            <div class="diary-header">
              <div class="diary-header-left">
                <p class="diary-date-display">{{ formatFullDate(selectedDate) }}</p>
                <p class="diary-intro">{{ diaryIntro }}</p>
                <p class="diary-mood">{{ diaryMood }}</p>
              </div>
            </div>

            <div v-if="countdownCards.length > 0 || positiveDayCards.length > 0" class="countdown-section">
              <div v-if="countdownCards.length > 0" class="countdown-cards">
                <div v-for="card in countdownCards" :key="card.id" class="task-card countdown-card">
                  <div class="task-card-row">
                    <span class="task-card-name">{{ card.name }}</span>
                  </div>
                  <span class="task-card-time countdown-time">{{ card.timeText }}</span>
                  <div v-if="card.description" class="task-card-notes">{{ card.description }}</div>
                </div>
              </div>
              <div v-if="positiveDayCards.length > 0" class="positive-day-cards">
                <div v-for="card in positiveDayCards" :key="card.id" class="task-card positive-card">
                  <div class="task-card-row">
                    <span class="task-card-name">{{ card.name }}</span>
                  </div>
                  <span class="task-card-time positive-time">{{ card.timeText }}</span>
                  <div v-if="card.description" class="task-card-notes">{{ card.description }}</div>
                </div>
              </div>
            </div>

            <div class="diary-content">
              <div v-if="morningCards.length > 0" class="diary-period">
                <p class="period-title">上午</p>
                <div class="period-items">
                  <template v-for="card in morningCards" :key="card.id">
                    <div v-if="card.type === 'record' && card.record" class="period-item">
                      <div class="task-card">
                        <div class="task-card-row">
                          <span class="task-card-name">{{ card.record.name }}</span>
                          <div v-if="!isGuideActive" class="task-card-actions">
                            <el-button :icon="Edit" circle size="small" class="task-card-btn" @click="handleEditTask(card.record)" />
                            <el-button :icon="Delete" circle size="small" class="task-card-btn" @click="openDeleteConfirm(card.record.id)" />
                          </div>
                        </div>
                        <span v-if="!card.record.isDiary && card.record.category !== 'diary'" class="task-card-time" v-html="getRecordTimeDisplay(card.record.startTime, card.record.endTime)"></span>
                        <span v-else class="task-card-diary-time">创建于 {{ formatDiaryTime(card.record.createdAt) }}</span>
                        <div v-if="card.record.notes" class="task-card-notes">{{ card.record.notes }}</div>
                      </div>
                    </div>
                    <div v-else-if="card.type === 'mission' && card.mission" class="period-item">
                      <MissionCard :mission="card.mission" context="footprint" @delete="handleMissionDelete" @complete="onMissionComplete" />
                    </div>
                    <div v-else-if="card.type === 'course' && card.course" class="period-item">
                      <div class="task-card">
                        <div class="task-card-row">
                          <span class="task-card-name" :style="{ color: card.course.color }">{{ card.course.name }}</span>
                        </div>
                        <span class="task-card-time">{{ card.course.startTime }} - {{ card.course.endTime }}<template v-if="card.course.location || card.course.teacher"> | <template v-if="card.course.location">{{ card.course.location }}</template><template v-if="card.course.location && card.course.teacher"> / </template><template v-if="card.course.teacher">{{ card.course.teacher }}</template></template></span>
                        <div v-if="card.course.note" class="task-card-notes">{{ card.course.note }}</div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <div v-if="afternoonCards.length > 0" class="diary-period">
                <p class="period-title">下午</p>
                <div class="period-items">
                  <template v-for="card in afternoonCards" :key="card.id">
                    <div v-if="card.type === 'record' && card.record" class="period-item">
                      <div class="task-card">
                        <div class="task-card-row">
                          <span class="task-card-name">{{ card.record.name }}</span>
                          <div v-if="!isGuideActive" class="task-card-actions">
                            <el-button :icon="Edit" circle size="small" class="task-card-btn" @click="handleEditTask(card.record)" />
                            <el-button :icon="Delete" circle size="small" class="task-card-btn" @click="openDeleteConfirm(card.record.id)" />
                          </div>
                        </div>
                        <span v-if="!card.record.isDiary && card.record.category !== 'diary'" class="task-card-time" v-html="getRecordTimeDisplay(card.record.startTime, card.record.endTime)"></span>
                        <span v-else class="task-card-diary-time">创建于 {{ formatDiaryTime(card.record.createdAt) }}</span>
                        <div v-if="card.record.notes" class="task-card-notes">{{ card.record.notes }}</div>
                      </div>
                    </div>
                    <div v-else-if="card.type === 'mission' && card.mission" class="period-item">
                      <MissionCard :mission="card.mission" context="footprint" @delete="handleMissionDelete" @complete="onMissionComplete" />
                    </div>
                    <div v-else-if="card.type === 'course' && card.course" class="period-item">
                      <div class="task-card">
                        <div class="task-card-row">
                          <span class="task-card-name" :style="{ color: card.course.color }">{{ card.course.name }}</span>
                        </div>
                        <span class="task-card-time">{{ card.course.startTime }} - {{ card.course.endTime }}<template v-if="card.course.location || card.course.teacher"> | <template v-if="card.course.location">{{ card.course.location }}</template><template v-if="card.course.location && card.course.teacher"> / </template><template v-if="card.course.teacher">{{ card.course.teacher }}</template></template></span>
                        <div v-if="card.course.note" class="task-card-notes">{{ card.course.note }}</div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <div v-if="eveningCards.length > 0" class="diary-period">
                <p class="period-title">晚上</p>
                <div class="period-items">
                  <template v-for="card in eveningCards" :key="card.id">
                    <div v-if="card.type === 'record' && card.record" class="period-item">
                      <div class="task-card">
                        <div class="task-card-row">
                          <span class="task-card-name">{{ card.record.name }}</span>
                          <div v-if="!isGuideActive" class="task-card-actions">
                            <el-button :icon="Edit" circle size="small" class="task-card-btn" @click="handleEditTask(card.record)" />
                            <el-button :icon="Delete" circle size="small" class="task-card-btn" @click="openDeleteConfirm(card.record.id)" />
                          </div>
                        </div>
                        <span v-if="!card.record.isDiary && card.record.category !== 'diary'" class="task-card-time" v-html="getRecordTimeDisplay(card.record.startTime, card.record.endTime)"></span>
                        <span v-else class="task-card-diary-time">创建于 {{ formatDiaryTime(card.record.createdAt) }}</span>
                        <div v-if="card.record.notes" class="task-card-notes">{{ card.record.notes }}</div>
                      </div>
                    </div>
                    <div v-else-if="card.type === 'mission' && card.mission" class="period-item">
                      <MissionCard :mission="card.mission" context="footprint" @delete="handleMissionDelete" @complete="onMissionComplete" />
                    </div>
                    <div v-else-if="card.type === 'course' && card.course" class="period-item">
                      <div class="task-card">
                        <div class="task-card-row">
                          <span class="task-card-name" :style="{ color: card.course.color }">{{ card.course.name }}</span>
                        </div>
                        <span class="task-card-time">{{ card.course.startTime }} - {{ card.course.endTime }}<template v-if="card.course.location || card.course.teacher"> | <template v-if="card.course.location">{{ card.course.location }}</template><template v-if="card.course.location && card.course.teacher"> / </template><template v-if="card.course.teacher">{{ card.course.teacher }}</template></template></span>
                        <div v-if="card.course.note" class="task-card-notes">{{ card.course.note }}</div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

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
        :mode="currentMode"
        @submit="handleFormSubmit"
    />

    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="确认删除"
      message="确定删除这条记录吗？"
      @confirm="onDeleteConfirmed"
    />

    <div v-if="showMoveDialog" class="dialog-overlay" @click.self="closeMoveDialog">
      <div class="dialog-container">
        <div class="dialog-header">
          <span class="dialog-header-title">移动任务</span>
          <el-button class="dialog-close-btn" text @click="closeMoveDialog"><el-icon><Close /></el-icon></el-button>
        </div>
        <div class="dialog-body">
          <MoveMissionPage :mission-id="moveMissionId" @submit="onMoveSubmit" @cancel="closeMoveDialog" />
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model="showMissionDeleteConfirm"
      title="确认删除"
      message="确定删除这个任务吗？"
      @confirm="onMissionDeleteConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Edit, Delete, Close } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { useTaskStore, type Task } from '../../stores/taskStore'
import { useMissionStore, type Mission } from '../../stores/missionStore'
import { useFootprintCards } from '../../composables/useFootprintCards'
import { usePageNav } from '../../composables/usePageNav'
import TaskForm from './TaskForm.vue'
import MissionCard from '../mission/MissionCard.vue'
import MoveMissionPage from '../mission/MoveMissionPage.vue'
import InlineLunarDatePicker from '../common/picker/InlineLunarDatePicker.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import { logger } from '../../lib/logger'
import { chalk } from '../../lib/chalk'

dayjs.locale('zh-cn')

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const isGuideActive = inject('guideVisible', ref(false))

const taskStore = useTaskStore()
const missionStore = useMissionStore()
const pageNav = usePageNav()

const countdownMilestones = inject<Ref<any[]>>('countdownMilestones', ref<any[]>([]))

const datePickerRef = ref<InstanceType<typeof InlineLunarDatePicker> | null>(null)

onMounted(() => {
  logger.debug('[TaskList] onMounted', { navPath: pageNav.navPath.value })
  if (pageNav.navPath.value.length === 0) {
    logger.debug('[TaskList] onMounted navPath为空，设为[footprint]')
    pageNav.setNavPath(['footprint'])
  }
})

const selectedDateValue = ref(dayjs().format('YYYY-MM-DD'))

watch(selectedDateValue, (newDate) => {
  logger.info('[足迹] 切换日期', { date: newDate })
})

const dateRange = computed(() => {
  return {
    start: selectedDateValue.value,
    end: selectedDateValue.value
  }
})

const selectedDate = computed(() => dateRange.value.start)

const isCurrentDay = computed(() => {
  return selectedDateValue.value === dayjs().format('YYYY-MM-DD')
})

const emptyText = computed(() => {
  if (isCurrentDay.value) return '今天还没有留下足迹，快去记录吧！'
  return '这一天还没有留下足迹'
})

const {
  countdownCards,
  positiveDayCards,
  missionCards,
  courseCards,
  allCards,
  morningCards,
  afternoonCards,
  eveningCards,
  filteredTasks,
} = useFootprintCards(selectedDateValue, countdownMilestones, isGuideActive)

const todayTasks = computed(() => {
  return filteredTasks.value
})

const formVisible = ref(false)
const editingTask = ref<Task | null>(null)
const currentMode = ref<'record' | 'diary'>('record')
const showDeleteConfirm = ref(false)
const deleteTargetId = ref('')

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

const diaryIntro = computed(() => {
  if (filteredTasks.value.length === 1) {
    return '简单的一天，专注于做一件事。'
  } else if (filteredTasks.value.length >= 5) {
    return '忙碌而充实的一天，记录下这些美好的时刻。'
  }
  return '平凡的一天，也值得被记录。'
})

const diaryMood = computed(() => {
  const total = filteredTasks.value.length
  if (total === 0) return '今日关键词：探索'
  if (total === 1) return '今日关键词：专注'
  if (total >= 5) return '今日关键词：充实'
  return '今日关键词：平凡'
})

const morningTitle = computed(() => morningTasks.value.length >= 3 ? '晨间时光' : '上午')
const afternoonTitle = computed(() => afternoonTasks.value.length >= 3 ? '午后时光' : '下午')
const eveningTitle = computed(() => eveningTasks.value.length >= 3 ? '晚间时光' : '晚上')
const summaryTitle = computed(() => '今日总结')

const formatDurationLabel = (startTime: string, endTime: string): string => {
  if (!startTime || !endTime) return ''
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm)
  if (totalMinutes <= 0) return ''
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `（共${hours}小时${minutes}分钟）`
  if (hours > 0) return `（共${hours}小时）`
  return `（共${minutes}分钟）`
}

const getRecordTimeDisplay = (startTime: string, endTime: string): string => {
  const timeText = `${startTime || '--:--'} - ${endTime || '--:--'}`
  const duration = formatDurationLabel(startTime, endTime)
  if (!duration) return timeText
  return `${timeText} <span style="color:${chalk.dim}">${duration}</span>`
}

const diarySummary = computed(() => {
  const total = filteredTasks.value.length
  const duration = totalDuration.value
  const durationText = duration > 0 ? `，总计约${formatDuration(duration)}` : ''

  if (total === 0) {
    if (isCurrentDay.value) return '今天还没有留下足迹，快去记录吧！'
    return '这一天还没有留下足迹。'
  }
  if (total === 1) return '专注做一件事，有时候比忙碌一整天更有意义。'
  if (total >= 6) return `今天完成了${total}件事${durationText}，高效且充实。`
  return `今天完成了${total}件事${durationText}，平凡的一天也有它的意义。`
})

interface SummarySegment {
  text: string
  type: 'normal' | 'number' | 'duration' | 'keyword' | 'highlight'
}

const summarySegments = computed((): SummarySegment[] => {
  const text = diarySummary.value
  const segments: SummarySegment[] = []

  const numberPattern = /(\d+)件/g
  const durationPattern = /，总计约([^，。]+)/g
  const keywords = ['高效', '充实', '运动', '学习', '放松休息', '进步', '专注', '意义', '坚持']

  let lastIndex = 0
  const matches: { index: number; length: number; type: SummarySegment['type'] }[] = []

  let match
  while ((match = numberPattern.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length, type: 'number' })
  }

  while ((match = durationPattern.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length, type: 'duration' })
  }

  keywords.forEach(keyword => {
    let idx = text.indexOf(keyword)
    while (idx !== -1) {
      matches.push({ index: idx, length: keyword.length, type: 'keyword' })
      idx = text.indexOf(keyword, idx + 1)
    }
  })

  matches.sort((a, b) => a.index - b.index)

  matches.forEach(m => {
    if (m.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, m.index), type: 'normal' })
    }
    if (m.index >= lastIndex) {
      segments.push({ text: text.slice(m.index, m.index + m.length), type: m.type })
      lastIndex = m.index + m.length
    }
  })

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), type: 'normal' })
  }

  return segments.length > 0 ? segments : [{ text, type: 'normal' }]
})

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

const formatFullDate = (date: string) => dayjs(date).format('YYYY年MM月DD日 dddd')
const formatDiaryTime = (createdAt?: string) => {
  if (!createdAt) return ''
  return dayjs(createdAt).format('HH:mm')
}
const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`
  if (hours > 0) return `${hours}h`
  return `${mins}min`
}

const handleAddTask = () => {
  editingTask.value = null
  currentMode.value = 'record'
  formVisible.value = true
}

const handleAddDiary = () => {
  editingTask.value = null
  currentMode.value = 'diary'
  formVisible.value = true
}

const handleEditTask = (task: Task) => {
  editingTask.value = task
  currentMode.value = task.isDiary || task.category === 'diary' ? 'diary' : 'record'
  formVisible.value = true
}

const handleDeleteTask = (id: string) => {
  taskStore.deleteTask(id)
  logger.info('[足迹] 删除足迹', { taskId: id })
  ElMessage.success('记录删除成功')
}

const openDeleteConfirm = (id: string) => {
  deleteTargetId.value = id
  showDeleteConfirm.value = true
}

const onDeleteConfirmed = () => {
  handleDeleteTask(deleteTargetId.value)
}

const handleFormSubmit = (task: Task) => {
  if (editingTask.value) {
    logger.info('[足迹] 编辑足迹', { taskId: task.id, name: task.name })
  } else {
    logger.info('[足迹] 添加足迹', { name: task.name })
  }
  editingTask.value = null
}

const showMoveDialog = ref(false)
const moveMissionId = ref('')

const handleMissionMove = (mission: Mission) => {
  moveMissionId.value = mission.id
  showMoveDialog.value = true
}

const closeMoveDialog = () => {
  showMoveDialog.value = false
  moveMissionId.value = ''
}

const onMoveSubmit = () => {
  closeMoveDialog()
}

const showMissionDeleteConfirm = ref(false)
const deleteMissionTargetId = ref('')

const handleMissionDelete = (mission: Mission) => {
  deleteMissionTargetId.value = mission.id
  showMissionDeleteConfirm.value = true
}

const onMissionDeleteConfirmed = async () => {
  const id = deleteMissionTargetId.value
  const mission = missionStore.missions.find(m => m.id === id)
  const hadReminder = mission && mission.reminderStrategy !== 'none' && mission.date
  await missionStore.deleteMission(id)
  logger.info('[足迹] 删除任务', { missionId: id })
  ElMessage.success('任务已删除')
  if (hadReminder) {
    const refreshReminders = inject<() => void>('refreshReminders', () => {})
    refreshReminders()
  }
}

const onMissionComplete = () => {}
</script>

<style scoped>
.footprint-container {
  width: 500px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.03);
}

.header-actions {
  display: flex;
  flex-direction: column;
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
  color: var(--chalk-white-90);
}

.date-suffix {
  color: var(--chalk-white-60);
  font-size: 13px;
  padding-right: 6px;
  user-select: none;
}

.date-label {
  color: var(--chalk-white-70);
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
  color: var(--chalk-white-60);
  margin: 0 0 12px 0;
}

.diary-intro {
  color: var(--chalk-white-90);
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

.countdown-section {
  margin-top: 20px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 600px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.countdown-cards,
.positive-day-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.countdown-card .task-card-name {
  color: var(--chalk-orange);
}

.positive-card .task-card-name {
  color: var(--chalk-cyan);
}

.countdown-time {
  color: var(--chalk-amber) !important;
}

.positive-time {
  color: var(--chalk-cyan) !important;
}

.diary-content {
  line-height: 1.8;
  text-align: center;
}

.diary-period {
  margin-top: 20px;
}

.period-title {
  font-weight: 600;
  color: var(--chalk-white);
  margin: 0 0 12px 0;
  font-size: 15px;
  text-align: center;
}

.period-items {
  display: flex;
  flex-direction: column;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  gap: 8px;
}

.period-item {
  width: 100%;
  text-align: left;
}

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
  color: var(--chalk-white);
  margin: 0 0 12px 0;
  font-size: 15px;
  text-align: center;
}

.summary-content {
  color: var(--chalk-white-75);
  font-size: 14px;
  line-height: 1.8;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  margin: 0;
}

.summary-content .segment-number {
  color: var(--chalk-amber);
  font-weight: 600;
}

.summary-content .segment-duration {
  color: var(--chalk-cyan);
  font-weight: 500;
}

.summary-content .segment-keyword {
  color: var(--chalk-violet);
  font-weight: 500;
}

.summary-content .segment-highlight {
  color: var(--chalk-pink);
  font-weight: 500;
}

.summary-content .segment-normal {
  color: var(--chalk-white-75);
}

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
  color: var(--chalk-white);
  padding-left: 8px;
  border-left: 3px solid rgba(103, 232, 249, 0.8);
}

.stats-total {
  font-size: 14px;
  color: var(--chalk-cyan);
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
  color: var(--chalk-muted);
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
  color: var(--chalk-white-70);
  flex: 1;
}

.legend-value {
  font-size: 12px;
  color: var(--chalk-muted);
  font-weight: 500;
}

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
  color: var(--chalk-white-90) !important;
}

.date-type-select :deep(.el-input__suffix) {
  color: var(--chalk-white-60) !important;
}

.date-type-select :deep(.el-input__suffix-inner) {
  color: var(--chalk-white-60) !important;
}

.date-type-select :deep(.el-select__caret) {
  color: var(--chalk-white-60) !important;
}

.date-select-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

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
  color: var(--chalk-white-90) !important;
  text-align: center;
}

.date-select :deep(.el-input__suffix),
.date-select :deep(.el-select__caret) {
  color: var(--chalk-white-60) !important;
}

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
  color: var(--chalk-white);
}

.stats-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stats-header-right :deep(.el-radio-button__inner) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--chalk-white-70);
}

.stats-header-right :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: var(--chalk-white);
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
  color: var(--chalk-white);
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--chalk-white-60);
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
  color: var(--chalk-white);
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
  color: var(--chalk-white-70);
  white-space: nowrap;
}

.bar-label {
  font-size: 12px;
  color: var(--chalk-white-60);
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
  color: var(--chalk-white);
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
  color: var(--chalk-white);
  flex-shrink: 0;
}

.ranking-name {
  flex: 1;
  font-size: 14px;
  color: var(--chalk-white-90);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-count {
  font-size: 13px;
  color: var(--chalk-white-60);
  flex-shrink: 0;
}

.ranking-duration {
  font-size: 13px;
  color: var(--chalk-cyan);
  font-weight: 500;
  flex-shrink: 0;
}

.no-data {
  padding: 60px 0;
}

.task-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s;
  text-align: left;
}

.task-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.task-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.task-card-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--chalk-white-95);
  flex: 1;
  min-width: 0;
}

.task-card-time {
  font-size: 13px;
  color: var(--chalk-blue);
  font-weight: 500;
  margin-top: 6px;
}

.task-card-diary-time {
  font-size: 12px;
  color: var(--chalk-subtle);
  margin-top: 6px;
}

.task-card-actions {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.task-card-btn {
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
  padding: 0;
  background: none !important;
  border: none !important;
  color: var(--chalk-subtle);
  box-shadow: none !important;
  font-size: 14px;
}

.task-card-btn:hover {
  color: var(--chalk-white-85);
}

.task-card-notes {
  font-size: 12px;
  color: var(--chalk-subtle);
  margin-top: 6px;
  line-height: 1.4;
}

.task-card-time :deep(span) { margin-left: 6px; }

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog-container {
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  width: 420px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 0;
  flex-shrink: 0;
}

.dialog-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
}

.dialog-close-btn {
  font-size: 18px;
  color: var(--chalk-muted);
  padding: 0;
  min-width: auto;
  width: 28px;
  height: 28px;
}

.dialog-close-btn:hover {
  color: var(--chalk-white-90);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 20px;
}
</style>