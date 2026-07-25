<template>
  <div class="footprint-container" ref="containerRef" :class="{ 'is-mobile': !isElectron }">
    <div class="page-header">
      <button class="header-nav-btn" @click="shiftDate(-1)" title="前一天">
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <div class="header-title" @click="openDatePicker" title="点击跳转日期">
        <div class="header-title-main">{{ selectedDateLabel }}</div>
        <div class="header-title-sub">{{ lunarDateLabel }}</div>
      </div>
      <button class="header-nav-btn" @click="shiftDate(1)" title="后一天">
        <el-icon><ArrowRight /></el-icon>
      </button>
      <div class="header-actions">
        <button class="header-action-btn add-btn" @click="handleAddTask" title="记录足迹">
          <el-icon><DocumentAdd /></el-icon>
          <span class="btn-text">记录足迹</span>
        </button>
        <button class="header-action-btn diary-btn" @click="handleAddDiary" title="写日记">
          <el-icon><EditPen /></el-icon>
          <span class="btn-text">写日记</span>
        </button>
      </div>
    </div>

    <div class="footprint-content">
      <el-scrollbar>
        <div v-if="filteredTasks.length === 0" class="empty-state">
          <el-empty
              :description="emptyText"
              :image-size="120"
          />
        </div>

        <template v-else>
            <div class="diary-content">
              <div id="section-morning" v-if="morningRecordCards.length > 0" class="diary-period">
                <p class="period-title period-morning" @click="morningCollapsed = !morningCollapsed">
                  <span class="collapse-arrow">{{ morningCollapsed ? '▶' : '▼' }}</span> 🌤️ 上午
                </p>
                <div v-if="!morningCollapsed" class="period-items" :style="{ gridTemplateColumns: 'repeat(' + cardColumns + ', 1fr)' }">
                  <template v-for="card in morningRecordCards" :key="card.id">
                    <div v-if="card.type === 'record' && card.record && (card.record.isDiary || card.record.category === 'diary')" class="period-item">
                      <DiaryCard
                        :record="card.record"
                        :editing-name-id="editingNameId"
                        :editing-name-value="editingNameValue"
                        :editing-notes-id="editingNotesId"
                        :editing-notes-value="editingNotesValue"
                        @update:editing-name-value="editingNameValue = $event"
                        @update:editing-notes-value="editingNotesValue = $event"
                        @start-name-edit="startNameEdit"
                        @save-name-edit="saveNameEdit"
                        @cancel-name-edit="cancelNameEdit"
                        @start-notes-edit="startNotesEdit"
                        @save-notes-edit="saveNotesEdit"
                        @cancel-notes-edit="cancelNotesEdit"
                        @delete="openDeleteConfirm"
                      />
                    </div>
                    <div v-else-if="card.type === 'record' && card.record" class="period-item">
                      <RecordCard
                        :record="card.record"
                        :editing-name-id="editingNameId"
                        :editing-name-value="editingNameValue"
                        :editing-notes-id="editingNotesId"
                        :editing-notes-value="editingNotesValue"
                        @update:editing-name-value="editingNameValue = $event"
                        @update:editing-notes-value="editingNotesValue = $event"
                        @start-name-edit="startNameEdit"
                        @save-name-edit="saveNameEdit"
                        @cancel-name-edit="cancelNameEdit"
                        @start-notes-edit="startNotesEdit"
                        @save-notes-edit="saveNotesEdit"
                        @cancel-notes-edit="cancelNotesEdit"
                        @delete="openDeleteConfirm"
                        @update:start-time="(id, v) => taskStore.updateTask(id, { startTime: v })"
                        @update:end-time="(id, v) => taskStore.updateTask(id, { endTime: v })"
                        @edit="handleEditRecord"
                        @star="handleStarRecord"
                      />
                    </div>
                  </template>
                </div>
              </div>

              <div id="section-afternoon" v-if="afternoonRecordCards.length > 0" class="diary-period">
                <p class="period-title period-afternoon" @click="afternoonCollapsed = !afternoonCollapsed">
                  <span class="collapse-arrow">{{ afternoonCollapsed ? '▶' : '▼' }}</span> 🌞 下午
                </p>
                <div v-if="!afternoonCollapsed" class="period-items" :style="{ gridTemplateColumns: 'repeat(' + cardColumns + ', 1fr)' }">
                  <template v-for="card in afternoonRecordCards" :key="card.id">
                    <div v-if="card.type === 'record' && card.record && (card.record.isDiary || card.record.category === 'diary')" class="period-item">
                      <DiaryCard
                        :record="card.record"
                        :editing-name-id="editingNameId"
                        :editing-name-value="editingNameValue"
                        :editing-notes-id="editingNotesId"
                        :editing-notes-value="editingNotesValue"
                        @update:editing-name-value="editingNameValue = $event"
                        @update:editing-notes-value="editingNotesValue = $event"
                        @start-name-edit="startNameEdit"
                        @save-name-edit="saveNameEdit"
                        @cancel-name-edit="cancelNameEdit"
                        @start-notes-edit="startNotesEdit"
                        @save-notes-edit="saveNotesEdit"
                        @cancel-notes-edit="cancelNotesEdit"
                        @delete="openDeleteConfirm"
                      />
                    </div>
                    <div v-else-if="card.type === 'record' && card.record" class="period-item">
                      <RecordCard
                        :record="card.record"
                        :editing-name-id="editingNameId"
                        :editing-name-value="editingNameValue"
                        :editing-notes-id="editingNotesId"
                        :editing-notes-value="editingNotesValue"
                        @update:editing-name-value="editingNameValue = $event"
                        @update:editing-notes-value="editingNotesValue = $event"
                        @start-name-edit="startNameEdit"
                        @save-name-edit="saveNameEdit"
                        @cancel-name-edit="cancelNameEdit"
                        @start-notes-edit="startNotesEdit"
                        @save-notes-edit="saveNotesEdit"
                        @cancel-notes-edit="cancelNotesEdit"
                        @delete="openDeleteConfirm"
                        @update:start-time="(id, v) => taskStore.updateTask(id, { startTime: v })"
                        @update:end-time="(id, v) => taskStore.updateTask(id, { endTime: v })"
                        @edit="handleEditRecord"
                        @star="handleStarRecord"
                      />
                    </div>
                  </template>
                </div>
              </div>

              <div id="section-evening" v-if="eveningRecordCards.length > 0" class="diary-period">
                <p class="period-title period-evening" @click="eveningCollapsed = !eveningCollapsed">
                  <span class="collapse-arrow">{{ eveningCollapsed ? '▶' : '▼' }}</span> 🌙 晚上
                </p>
                <div v-if="!eveningCollapsed" class="period-items" :style="{ gridTemplateColumns: 'repeat(' + cardColumns + ', 1fr)' }">
                  <template v-for="card in eveningRecordCards" :key="card.id">
                    <div v-if="card.type === 'record' && card.record && (card.record.isDiary || card.record.category === 'diary')" class="period-item">
                      <DiaryCard
                        :record="card.record"
                        :editing-name-id="editingNameId"
                        :editing-name-value="editingNameValue"
                        :editing-notes-id="editingNotesId"
                        :editing-notes-value="editingNotesValue"
                        @update:editing-name-value="editingNameValue = $event"
                        @update:editing-notes-value="editingNotesValue = $event"
                        @start-name-edit="startNameEdit"
                        @save-name-edit="saveNameEdit"
                        @cancel-name-edit="cancelNameEdit"
                        @start-notes-edit="startNotesEdit"
                        @save-notes-edit="saveNotesEdit"
                        @cancel-notes-edit="cancelNotesEdit"
                        @delete="openDeleteConfirm"
                      />
                    </div>
                    <div v-else-if="card.type === 'record' && card.record" class="period-item">
                      <RecordCard
                        :record="card.record"
                        :editing-name-id="editingNameId"
                        :editing-name-value="editingNameValue"
                        :editing-notes-id="editingNotesId"
                        :editing-notes-value="editingNotesValue"
                        @update:editing-name-value="editingNameValue = $event"
                        @update:editing-notes-value="editingNotesValue = $event"
                        @start-name-edit="startNameEdit"
                        @save-name-edit="saveNameEdit"
                        @cancel-name-edit="cancelNameEdit"
                        @start-notes-edit="startNotesEdit"
                        @save-notes-edit="saveNotesEdit"
                        @cancel-notes-edit="cancelNotesEdit"
                        @delete="openDeleteConfirm"
                        @update:start-time="(id, v) => taskStore.updateTask(id, { startTime: v })"
                        @update:end-time="(id, v) => taskStore.updateTask(id, { endTime: v })"
                        @edit="handleEditRecord"
                        @star="handleStarRecord"
                      />
                    </div>
                  </template>
                </div>
              </div>

              </div>
        </template>
      </el-scrollbar>
    </div>

    <DiaryForm
        v-model:visible="diaryFormVisible"
        :task="editingTask"
        :defaultDate="selectedDate"
        @submit="handleFormSubmit"
    />

    <RecordForm
        v-model:visible="recordFormVisible"
        :task="editingTask"
        :defaultDate="selectedDate"
        @submit="handleFormSubmit"
    />

    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="确认删除"
      :message="deleteMessage"
      @confirm="onDeleteConfirmed"
    />

    <DateScrollPicker
      v-model="headerDatePickerValue"
      v-model:visible="headerDatePickerVisible"
      @update:model-value="onHeaderDatePicked"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, DocumentAdd, EditPen } from '@element-plus/icons-vue'
import { Solar } from 'lunar-javascript'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { useTaskStore, type Task } from '../../stores/taskStore'
import { useFootprintCards } from '../../composables/useFootprintCards'
import { usePageNav } from '../../composables/usePageNav'
import RecordCard from './RecordCard.vue'
import DiaryCard from './DiaryCard.vue'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import DiaryForm from './DiaryForm.vue'
import RecordForm from './RecordForm.vue'
import { logger } from '../../lib/logger'

dayjs.locale('zh-cn')

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const isGuideActive = inject('guideVisible', ref(false))
const isElectron = inject<boolean>('isElectron', false)

const taskStore = useTaskStore()
const pageNav = usePageNav()

const editingNameId = ref<string | null>(null)
const editingNameValue = ref('')
const editingNotesId = ref<string | null>(null)
const editingNotesValue = ref('')

const startNameEdit = (record: Task) => {
  editingNameId.value = record.id
  editingNameValue.value = record.name
  nextTick(() => {
    const el = document.querySelector('.inline-edit-textarea') as HTMLTextAreaElement | null
    el?.focus()
  })
}

const saveNameEdit = async (record: Task) => {
  const trimmed = editingNameValue.value.trim()
  await taskStore.updateTask(record.id, { name: trimmed })
  editingNameId.value = null
}

const cancelNameEdit = () => {
  editingNameId.value = null
}

const startNotesEdit = (record: Task) => {
  editingNotesId.value = record.id
  editingNotesValue.value = record.notes || ''
  nextTick(() => {
    const el = document.querySelector('.inline-edit-textarea') as HTMLTextAreaElement | null
    el?.focus()
  })
}

const saveNotesEdit = async (record: Task) => {
  const trimmed = editingNotesValue.value.trim()
  if (trimmed !== (record.notes || '')) {
    await taskStore.updateTask(record.id, { notes: trimmed || null })
  }
  editingNotesId.value = null
}

const cancelNotesEdit = () => {
  editingNotesId.value = null
}

const handleAddTask = () => {
  editingTask.value = null
  recordFormVisible.value = true
}

const handleAddDiary = () => {
  editingTask.value = null
  diaryFormVisible.value = true
}

const handleEditTask = (task: Task) => {
  editingTask.value = task
  if (task.isDiary || task.category === 'diary') {
    diaryFormVisible.value = true
  } else {
    recordFormVisible.value = true
  }
}

const handleEditRecord = (record: Task) => {
  editingTask.value = record
  recordFormVisible.value = true
}

const handleStarRecord = async (record: Task) => {
  const newPinned = !record.pinned
  await taskStore.updateTask(record.id, { pinned: newPinned })
  logger.info('[足迹] 星标记录', { taskId: record.id, pinned: newPinned })
  ElMessage.success(newPinned ? '已设为星标' : '已取消星标')
}

const handleDeleteTask = (id: string) => {
  const task = taskStore.tasks.find(t => t.id === id)
  const isDiary = task?.isDiary || task?.category === 'diary'
  taskStore.deleteTask(id)
  logger.info('[足迹] 删除足迹', { taskId: id })
  ElMessage.success(isDiary ? '日记删除成功' : '记录删除成功')
}

const openDeleteConfirm = (id: string) => {
  deleteTargetId.value = id
  showDeleteConfirm.value = true
}

const onDeleteConfirmed = () => {
  handleDeleteTask(deleteTargetId.value)
}

const handleFormSubmit = () => {
  if (editingTask.value) {
    logger.info('[足迹] 编辑足迹', { taskId: editingTask.value.id, name: editingTask.value.name })
  } else {
    logger.info('[足迹] 添加足迹')
  }
  editingTask.value = null
}

onMounted(() => {
  logger.debug('[TaskList] onMounted', { navPath: pageNav.navPath.value })
  if (pageNav.navPath.value.length === 0) {
    logger.debug('[TaskList] onMounted navPath为空，设为[footprint]')
    pageNav.setNavPath(['footprint'])
  }
  updateCardColumns()
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateCardColumns())
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
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

const selectedDateLabel = computed(() => dayjs(selectedDateValue.value).format('YYYY年M月D日'))

const lunarDateLabel = computed(() => {
  const d = dayjs(selectedDateValue.value)
  const solar = Solar.fromYmd(d.year(), d.month() + 1, d.date())
  const lunar = solar.getLunar()
  const monthCn = lunar.getMonthInChinese()
  const dayCn = lunar.getDayInChinese()
  const weekCn = ['日', '一', '二', '三', '四', '五', '六'][d.day()]
  const festival = lunar.getFestivals()[0] || lunar.getJieQi() || ''
  const lunarText = `${monthCn}月${dayCn} · 星期${weekCn}`
  return festival ? `${festival} · ${lunarText}` : lunarText
})

const headerDatePickerVisible = ref(false)
const headerDatePickerValue = ref(selectedDateValue.value)

watch(selectedDateValue, (v) => { headerDatePickerValue.value = v })

const openDatePicker = () => {
  headerDatePickerValue.value = selectedDateValue.value
  headerDatePickerVisible.value = true
}

const onHeaderDatePicked = (date: string) => {
  if (date && date !== selectedDateValue.value) {
    selectedDateValue.value = date
  }
}

const shiftDate = (delta: number) => {
  selectedDateValue.value = dayjs(selectedDateValue.value).add(delta, 'day').format('YYYY-MM-DD')
}

// 动态卡片列数
const containerRef = ref<HTMLElement | null>(null)
const GAP = 16
const cardColumns = ref(1)
let resizeObserver: ResizeObserver | null = null

const updateCardColumns = () => {
  if (!containerRef.value) return
  const width = containerRef.value.clientWidth - 2 * GAP
  cardColumns.value = Math.max(1, Math.floor((width + GAP) / (250 + GAP)))
}

// 折叠状态
const morningCollapsed = ref(false)
const afternoonCollapsed = ref(false)
const eveningCollapsed = ref(false)

const {
  morningCards,
  afternoonCards,
  eveningCards,
  filteredTasks,
} = useFootprintCards(selectedDateValue, ref<any[]>([]), isGuideActive)

const morningRecordCards = computed(() => morningCards.value.filter(c => c.type === 'record'))
const afternoonRecordCards = computed(() => afternoonCards.value.filter(c => c.type === 'record'))
const eveningRecordCards = computed(() => eveningCards.value.filter(c => c.type === 'record'))

const todayTasks = computed(() => {
  return filteredTasks.value
})

const diaryFormVisible = ref(false)
const recordFormVisible = ref(false)
const editingTask = ref<Task | null>(null)
const showDeleteConfirm = ref(false)
const deleteTargetId = ref('')
const deleteMessage = computed(() => {
  const task = taskStore.tasks.find(t => t.id === deleteTargetId.value)
  const isDiary = task?.isDiary || task?.category === 'diary'
  return isDiary ? '确定删除这篇日记吗？' : '确定删除这条记录吗？'
})

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

</script>

<style scoped>
.footprint-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 16px;
}

.footprint-container.is-mobile .footprint-content {
  padding-bottom: 16px;
}

.footprint-container.is-mobile .footprint-content :deep(.el-scrollbar__view) {
  padding-bottom: 16px;
}

.footprint-container:not(.is-mobile) .footprint-content {
  padding-bottom: 16px;
}

.footprint-container:not(.is-mobile) .footprint-content :deep(.el-scrollbar__view) {
  padding-bottom: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 0 10px;
  flex-shrink: 0;
}

.header-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--chalk-white-60);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}

.header-nav-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white);
}

.header-nav-btn .el-icon {
  font-size: 16px;
}

.header-title {
  width: 150px;
  flex: none;
  text-align: center;
  cursor: pointer;
  padding: 2px 10px;
  border-radius: 8px;
  transition: background 0.2s;
  user-select: none;
}

.header-title:hover {
  background: rgba(255, 255, 255, 0.05);
}

.header-title-main {
  font-size: 17px;
  font-weight: 700;
  color: var(--chalk-white);
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.header-title-sub {
  font-size: 12px;
  color: var(--chalk-muted);
  margin-top: 2px;
  line-height: 1.2;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
}

.header-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--chalk-white);
  transition: all 0.2s;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

.header-action-btn .el-icon {
  font-size: 13px;
}

.header-action-btn.add-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.header-action-btn.add-btn:hover {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.45);
  transform: translateY(-1px);
}

.header-action-btn.diary-btn {
  background: linear-gradient(135deg, #f472b6 0%, #a78bfa 100%);
  box-shadow: 0 2px 8px rgba(244, 114, 182, 0.3);
}

.header-action-btn.diary-btn:hover {
  box-shadow: 0 4px 12px rgba(244, 114, 182, 0.45);
  transform: translateY(-1px);
}

@media (max-width: 500px) {
  .header-action-btn .btn-text {
    display: none;
  }
  .header-action-btn {
    width: 30px;
    padding: 0;
  }
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

.footprint-content :deep(.el-scrollbar__wrap) {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.footprint-content :deep(.el-scrollbar__wrap::-webkit-scrollbar) {
  display: none;
}
.footprint-content :deep(.el-scrollbar__bar) {
  display: none !important;
}
.footprint-content :deep(.el-scrollbar) {
  height: 100%;
}
.footprint-content :deep(.el-scrollbar__view) {
  min-height: 100%;
}

.important-section {
  margin-top: 20px;
  width: 100%;
}

.collapse-arrow {
  font-size: 11px;
  margin-right: 4px;
  display: inline-block;
  transition: transform 0.2s;
}

.important-title {
  font-weight: 600;
  color: #fbbf24;
  margin: 0 0 12px 0;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  user-select: none;
}

.diary-content {
  line-height: 1.8;
  text-align: left;
}

.diary-period {
  margin-top: 20px;
}

.period-title {
  font-weight: 600;
  color: var(--chalk-white);
  margin: 0 0 12px 0;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  user-select: none;
}

.period-title.period-morning {
  color: var(--chalk-orange);
}

.period-title.period-afternoon {
  color: var(--chalk-cyan);
}

.period-title.period-evening {
  color: var(--chalk-violet);
}

.period-items {
  display: grid;
  gap: 16px;
  width: 100%;
}

.period-item {
  min-width: 0;
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
  gap: 8px;
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
  gap: 8px;
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
  gap: 8px;
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