<template>
  <div class="footprint-container" :class="{ 'is-mobile': !isElectron }">
    <div class="header-actions">
      <InlineLunarDatePicker ref="datePickerRef" v-model="selectedDateValue" @add-footprint="handleAddTask" @add-diary="handleAddDiary" />
    </div>

    <div class="footprint-content">
      <el-scrollbar>
        <div v-if="filteredTasks.length === 0 && listCards.length === 0 && courseCards.length === 0 && countdownDisplayCards.length === 0" class="empty-state">
          <el-empty
              :description="emptyText"
              :image-size="120"
          />
        </div>

        <template v-else>
          <div v-if="pinnedCountdownCards.length > 0 || pinnedRecords.length > 0" class="important-section">
            <p class="important-title">⭐ 重要</p>
            <div v-if="pinnedCountdownCards.length > 0" class="countdown-section">
              <div v-for="item in pinnedCountdownCards" :key="item.milestone.id" class="countdown-item">
                <CountdownCard
                  :milestone="item.milestone"
                  :card-type="item.cardType"
                  :category-icon="item.categoryIcon"
                  :countdown-days="item.countdownDays"
                  :countdown-unit="item.countdownUnit"
                  :reminder-label="item.reminderLabel"
                  :is-editing-name="countdownEditingNameId === item.milestone.id"
                  :editing-name-value="countdownEditingNameValue"
                  :is-editing-desc="countdownEditingDescId === item.milestone.id"
                  :editing-desc-value="countdownEditingDescValue"
                  @start-name-edit="startCountdownNameEdit(item.milestone)"
                  @save-name-edit="saveCountdownNameEdit(item.milestone)"
                  @cancel-name-edit="cancelCountdownNameEdit"
                  @update:editing-name-value="countdownEditingNameValue = $event"
                  @start-desc-edit="startCountdownDescEdit(item.milestone)"
                  @save-desc-edit="saveCountdownDescEdit(item.milestone)"
                  @cancel-desc-edit="cancelCountdownDescEdit"
                  @update:editing-desc-value="countdownEditingDescValue = $event"
                  @pin="handleCountdownCommand('pin', item.milestone)"
                  @unpin="handleCountdownCommand('unpin', item.milestone)"
                  @delete="handleCountdownCommand('delete', item.milestone)"
                  @edit="openCountdownEditForm(item.milestone)"
                  @open-date-picker="openCountdownDatePicker(item.milestone)"
                  @toggle-repeat="toggleRepeatCountdown(item.milestone)"
                  @open-reminder-picker="openCountdownReminderForm(item.milestone)"
                />
              </div>
            </div>
            <div v-if="pinnedRecords.length > 0" class="countdown-section">
              <div v-for="record in pinnedRecords" :key="record.id" class="period-item">
                <RecordCard
                  :record="record"
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
            </div>
          </div>

            <div v-if="unpinnedCountdownCards.length > 0" class="countdown-section">
              <div v-for="item in unpinnedCountdownCards" :key="item.milestone.id" class="countdown-item">
                <CountdownCard
                  :milestone="item.milestone"
                  :card-type="item.cardType"
                  :category-icon="item.categoryIcon"
                  :countdown-days="item.countdownDays"
                  :countdown-unit="item.countdownUnit"
                  :reminder-label="item.reminderLabel"
                  :is-editing-name="countdownEditingNameId === item.milestone.id"
                  :editing-name-value="countdownEditingNameValue"
                  :is-editing-desc="countdownEditingDescId === item.milestone.id"
                  :editing-desc-value="countdownEditingDescValue"
                  @start-name-edit="startCountdownNameEdit(item.milestone)"
                  @save-name-edit="saveCountdownNameEdit(item.milestone)"
                  @cancel-name-edit="cancelCountdownNameEdit"
                  @update:editing-name-value="countdownEditingNameValue = $event"
                  @start-desc-edit="startCountdownDescEdit(item.milestone)"
                  @save-desc-edit="saveCountdownDescEdit(item.milestone)"
                  @cancel-desc-edit="cancelCountdownDescEdit"
                  @update:editing-desc-value="countdownEditingDescValue = $event"
                  @pin="handleCountdownCommand('pin', item.milestone)"
                  @unpin="handleCountdownCommand('unpin', item.milestone)"
                  @delete="handleCountdownCommand('delete', item.milestone)"
                  @edit="openCountdownEditForm(item.milestone)"
                  @open-date-picker="openCountdownDatePicker(item.milestone)"
                  @toggle-repeat="toggleRepeatCountdown(item.milestone)"
                  @open-reminder-picker="openCountdownReminderForm(item.milestone)"
                />
              </div>
            </div>

            <div class="diary-content">
              <div v-if="unpinnedMorningCards.length > 0" class="diary-period">
                <p class="period-title period-morning">🌤️ 上午</p>
                <div class="period-items">
                  <template v-for="card in unpinnedMorningCards" :key="card.id">
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
                    <div v-else-if="card.type === 'list' && card.list" class="period-item">
                      <TaskCard :list="card.list" context="footprint" @delete="handleTaskDelete" @complete="onTaskComplete" />
                    </div>
                    <div v-else-if="card.type === 'course' && card.course" class="period-item">
                      <CourseCard :course="card.course" />
                    </div>
                  </template>
                </div>
              </div>

              <div v-if="unpinnedAfternoonCards.length > 0" class="diary-period">
                <p class="period-title period-afternoon">🌞 下午</p>
                <div class="period-items">
                  <template v-for="card in unpinnedAfternoonCards" :key="card.id">
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
                    <div v-else-if="card.type === 'list' && card.list" class="period-item">
                      <TaskCard :list="card.list" context="footprint" @delete="handleTaskDelete" @complete="onTaskComplete" />
                    </div>
                    <div v-else-if="card.type === 'course' && card.course" class="period-item">
                      <CourseCard :course="card.course" />
                    </div>
                  </template>
                </div>
              </div>

              <div v-if="unpinnedEveningCards.length > 0" class="diary-period">
                <p class="period-title period-evening">🌙 晚上</p>
                <div class="period-items">
                  <template v-for="card in unpinnedEveningCards" :key="card.id">
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
                    <div v-else-if="card.type === 'list' && card.list" class="period-item">
                      <TaskCard :list="card.list" context="footprint" @delete="handleTaskDelete" @complete="onTaskComplete" />
                    </div>
                    <div v-else-if="card.type === 'course' && card.course" class="period-item">
                      <CourseCard :course="card.course" />
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

    <div v-if="showMoveDialog" class="dialog-overlay" @click.self="closeMoveDialog">
      <div class="dialog-container">
        <div class="dialog-header">
          <span class="dialog-header-title">移动任务</span>
          <el-button class="dialog-close-btn" text @click="closeMoveDialog"><el-icon><Close /></el-icon></el-button>
        </div>
        <div class="dialog-body">
          <MoveTaskPage :list-id="moveTaskId" @submit="onMoveSubmit" @cancel="closeMoveDialog" />
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model="showTaskDeleteConfirm"
      title="确认删除"
      message="确定删除这个任务吗？"
      @confirm="onTaskDeleteConfirmed"
    />

    <ConfirmDialog
      v-model="showCountdownDeleteConfirm"
      title="提示"
      message="确定要删除这个倒数日吗？"
      @confirm="onCountdownDeleteConfirmed"
    />

    <DateScrollPicker
      v-if="datePickerMilestoneId"
      v-model="datePickerTargetDate"
      v-model:visible="datePickerVisible"
      @update:model-value="onDatePickerConfirm"
    />

    <CountdownForm
      v-model:visible="countdownFormVisible"
      :milestone="editingCountdownForForm"
      :categories="countdownCategories"
      :reminder-only="countdownFormReminderOnly"
      @submit="handleCountdownFormSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, nextTick, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { useTaskStore, type Task } from '../../stores/taskStore'
import { useListStore, type Task as ListTask } from '../../stores/listStore'
import { useFootprintCards } from '../../composables/useFootprintCards'
import { usePageNav } from '../../composables/usePageNav'
import RecordCard from './RecordCard.vue'
import DiaryCard from './DiaryCard.vue'
import CourseCard from '../course/CourseCard.vue'
import TaskCard from '../list/TaskCard.vue'
import CountdownCard from '../countdown/CountdownCard.vue'
import CountdownForm from '../countdown/CountdownForm.vue'
import MoveTaskPage from '../list/MoveTaskPage.vue'
import InlineLunarDatePicker from '../common/picker/InlineLunarDatePicker.vue'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import DiaryForm from './DiaryForm.vue'
import RecordForm from './RecordForm.vue'
import { logger } from '../../lib/logger'
import { chalk } from '../../lib/chalk'
import { setData } from '../../services/storageService'

dayjs.locale('zh-cn')

const emit = defineEmits<{
  (e: 'fullscreen-change', fullscreen: boolean): void
}>()

const isGuideActive = inject('guideVisible', ref(false))
const isElectron = inject<boolean>('isElectron', false)

const taskStore = useTaskStore()
const listStore = useListStore()
const pageNav = usePageNav()

const countdownMilestones = inject<Ref<any[]>>('countdownMilestones', ref<any[]>([]))
const countdownCategories = inject<Ref<any[]>>('countdownCategories', ref<any[]>([]))

const countdownFormVisible = ref(false)
const countdownFormReminderOnly = ref(false)
const editingCountdownForForm = ref<any>(null)

const openCountdownEditForm = (milestone: any) => {
  editingCountdownForForm.value = { ...milestone }
  countdownFormReminderOnly.value = false
  countdownFormVisible.value = true
}

const openCountdownReminderForm = (milestone: any) => {
  editingCountdownForForm.value = { ...milestone }
  countdownFormReminderOnly.value = true
  countdownFormVisible.value = true
}

const toggleRepeatCountdown = (milestone: any) => {
  const index = countdownMilestones.value.findIndex((m: any) => m.id === milestone.id)
  if (index > -1) {
    countdownMilestones.value[index].repeatStrategy = countdownMilestones.value[index].repeatStrategy === 'yearly' ? 'none' : 'yearly'
    countdownMilestones.value[index].updatedAt = new Date().toISOString()
    saveCountdownData()
  }
}

const handleCountdownFormSubmit = async (data: any) => {
  const index = countdownMilestones.value.findIndex((m: any) => m.id === editingCountdownForForm.value.id)
  if (index > -1) {
    countdownMilestones.value[index] = {
      ...countdownMilestones.value[index],
      ...data,
      updatedAt: new Date().toISOString()
    }
    await saveCountdownData()
  }
  editingCountdownForForm.value = null
}

const COUNTDOWN_STORAGE_KEY = ['countdown', 'milestones'] as const

const saveCountdownData = async () => {
  await setData(COUNTDOWN_STORAGE_KEY[0], COUNTDOWN_STORAGE_KEY[1], countdownMilestones.value)
}

const countdownEditingNameId = ref<string | null>(null)
const countdownEditingNameValue = ref('')
const countdownEditingDescId = ref<string | null>(null)
const countdownEditingDescValue = ref('')

const startCountdownNameEdit = (milestone: any) => {
  countdownEditingNameId.value = milestone.id
  countdownEditingNameValue.value = milestone.name
}

const saveCountdownNameEdit = async (milestone: any) => {
  const trimmed = countdownEditingNameValue.value.trim()
  if (trimmed && trimmed !== milestone.name) {
    const idx = countdownMilestones.value.findIndex((m: any) => m.id === milestone.id)
    if (idx > -1) {
      countdownMilestones.value[idx].name = trimmed
      await saveCountdownData()
      logger.info('[足迹][倒数日] 更新名称', { id: milestone.id, name: trimmed })
    }
  }
  countdownEditingNameId.value = null
}

const cancelCountdownNameEdit = () => {
  countdownEditingNameId.value = null
}

const startCountdownDescEdit = (milestone: any) => {
  countdownEditingDescId.value = milestone.id
  countdownEditingDescValue.value = milestone.description || ''
}

const saveCountdownDescEdit = async (milestone: any) => {
  const trimmed = countdownEditingDescValue.value.trim()
  if (trimmed !== (milestone.description || '')) {
    const idx = countdownMilestones.value.findIndex((m: any) => m.id === milestone.id)
    if (idx > -1) {
      countdownMilestones.value[idx].description = trimmed
      await saveCountdownData()
      logger.info('[足迹][倒数日] 更新描述', { id: milestone.id })
    }
  }
  countdownEditingDescId.value = null
}

const cancelCountdownDescEdit = () => {
  countdownEditingDescId.value = null
}

const datePickerMilestoneId = ref<string | null>(null)
const datePickerTargetDate = ref('')
const datePickerVisible = ref(false)

const openCountdownDatePicker = (milestone: any) => {
  datePickerMilestoneId.value = milestone.id
  datePickerTargetDate.value = milestone.targetDate
  datePickerVisible.value = true
}

const onDatePickerConfirm = async () => {
  if (datePickerMilestoneId.value) {
    const index = countdownMilestones.value.findIndex((m: any) => m.id === datePickerMilestoneId.value)
    if (index > -1) {
      countdownMilestones.value[index].targetDate = datePickerTargetDate.value
      await saveCountdownData()
      logger.info('[足迹][倒数日] 更新日期', { id: datePickerMilestoneId.value, targetDate: datePickerTargetDate.value })
    }
  }
  datePickerMilestoneId.value = null
}

const handleCountdownCommand = async (command: string, milestone: any) => {
  const index = countdownMilestones.value.findIndex((m: any) => m.id === milestone.id)
  switch (command) {
    case 'pin':
      if (index > -1) {
        countdownMilestones.value[index].pinned = true
        await saveCountdownData()
        logger.info('[足迹][倒数日] 设为星标', { id: milestone.id, name: milestone.name })
        ElMessage.success('已设为星标')
      }
      break
    case 'unpin':
      if (index > -1) {
        countdownMilestones.value[index].pinned = false
        await saveCountdownData()
        logger.info('[足迹][倒数日] 取消星标', { id: milestone.id, name: milestone.name })
        ElMessage.success('已取消星标')
      }
      break
    case 'delete':
      countdownDeleteTarget.value = milestone
      showCountdownDeleteConfirm.value = true
      break
  }
}

const datePickerRef = ref<InstanceType<typeof InlineLunarDatePicker> | null>(null)

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

const handleFormSubmit = (task: Task) => {
  if (editingTask.value) {
    logger.info('[足迹] 编辑足迹', { taskId: task.id, name: task.name })
  } else {
    logger.info('[足迹] 添加足迹', { name: task.name })
  }
  editingTask.value = null
}

const showMoveDialog = ref(false)
const moveTaskId = ref('')

const handleTaskMove = (list: Task) => {
  moveTaskId.value = list.id
  showMoveDialog.value = true
}

const closeMoveDialog = () => {
  showMoveDialog.value = false
  moveTaskId.value = ''
}

const onMoveSubmit = () => {
  closeMoveDialog()
}

const showTaskDeleteConfirm = ref(false)
const deleteTaskTargetId = ref('')

const handleTaskDelete = (list: Task) => {
  deleteTaskTargetId.value = list.id
  showTaskDeleteConfirm.value = true
}

const onTaskDeleteConfirmed = async () => {
  const id = deleteTaskTargetId.value
  const list = listStore.lists.find(m => m.id === id)
  const hadReminder = list && list.reminderStrategy !== 'none' && list.date
  await listStore.deleteTask(id)
  logger.info('[足迹] 删除任务', { listId: id })
  ElMessage.success('任务已删除')
  if (hadReminder) {
    const refreshReminders = inject<() => void>('refreshReminders', () => {})
    refreshReminders()
  }
}

const onTaskComplete = () => {}

const showCountdownDeleteConfirm = ref(false)
const countdownDeleteTarget = ref<any>(null)

const onCountdownDeleteConfirmed = async () => {
  const target = countdownDeleteTarget.value
  if (!target) return
  const deleteIndex = countdownMilestones.value.findIndex((m: any) => m.id === target.id)
  if (deleteIndex > -1) {
    countdownMilestones.value.splice(deleteIndex, 1)
    await saveCountdownData()
    logger.info('[足迹][倒数日] 删除倒数日', { id: target.id, name: target.name })
    ElMessage.success('删除成功')
  }
  countdownDeleteTarget.value = null
}

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
  countdownDisplayCards,
  listCards,
  courseCards,
  allCards,
  morningCards,
  afternoonCards,
  eveningCards,
  filteredTasks,
} = useFootprintCards(selectedDateValue, countdownMilestones, isGuideActive)

const pinnedCountdownCards = computed(() =>
  countdownDisplayCards.value.filter(item => item.milestone.pinned)
)

const unpinnedCountdownCards = computed(() =>
  countdownDisplayCards.value.filter(item => !item.milestone.pinned)
)

const pinnedRecords = computed(() =>
  allCards.value
    .filter(card => card.type === 'record' && card.record && card.record.pinned)
    .map(card => card.record!)
)

const unpinnedMorningCards = computed(() =>
  morningCards.value.filter(card => !(card.type === 'record' && card.record?.pinned))
)

const unpinnedAfternoonCards = computed(() =>
  afternoonCards.value.filter(card => !(card.type === 'record' && card.record?.pinned))
)

const unpinnedEveningCards = computed(() =>
  eveningCards.value.filter(card => !(card.type === 'record' && card.record?.pinned))
)

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

const morningTitle = computed(() => morningTasks.value.length >= 3 ? '晨间时光' : '上午')
const afternoonTitle = computed(() => afternoonTasks.value.length >= 3 ? '午后时光' : '下午')
const eveningTitle = computed(() => eveningTasks.value.length >= 3 ? '晚间时光' : '晚上')

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
  width: min(500px, 80vw);
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
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

.header-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
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

.important-title {
  font-weight: 600;
  color: #fbbf24;
  margin: 0 0 12px 0;
  font-size: 15px;
  text-align: center;
}

.important-section .countdown-section {
  margin-top: 0;
  margin-bottom: 0;
}

.countdown-section {
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
}

.countdown-item {
  margin-bottom: 8px;
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
  width: 100%;
  margin: 0 auto;
}

.period-item {
  display: flex;
  text-align: left;
  margin-bottom: 8px;
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