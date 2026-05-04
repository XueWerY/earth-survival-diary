<template>
  <div class="mission-container">
    <div class="top-nav-area">
      <div class="list-nav-scroll-wrapper" ref="listNavRef">
        <div class="list-nav-inner">
          <div
              class="nav-item smart-nav-item"
              :class="{ active: isTodaySmartList }"
              :ref="setListNavItemRef"
              @click="selectTodaySmartList"
          >
            <el-icon class="smart-icon"><Calendar /></el-icon>
            <span class="nav-item-name">今天</span>
            <span class="nav-item-count">{{ todayMissionsCount }}</span>
          </div>
          <div
              class="nav-item smart-nav-item"
              :class="{ active: isExpiredSmartList }"
              :ref="setListNavItemRef"
              @click="selectExpiredSmartList"
          >
            <el-icon class="smart-icon"><Clock /></el-icon>
            <span class="nav-item-name">已过期</span>
            <span class="nav-item-count">{{ expiredMissionsCount }}</span>
          </div>
          <div
              class="nav-item smart-nav-item"
              :class="{ active: isFutureSmartList }"
              :ref="setListNavItemRef"
              @click="selectFutureSmartList"
          >
            <el-icon class="smart-icon"><Timer /></el-icon>
            <span class="nav-item-name">未来七天</span>
            <span class="nav-item-count">{{ futureMissionsCount }}</span>
          </div>
          <div class="nav-divider"></div>
          <div
              v-for="(list, index) in lists"
              :key="list.id"
              class="nav-item"
              :class="{ active: isListSelected(list.id) && !isSmartListActive }"
              :ref="setListNavItemRef"
              @click="selectList(list.id)"
          >
            <span class="list-color-dot" :style="{ background: list.color }"></span>
            <span class="nav-item-name">{{ list.name }}</span>
            <span class="nav-item-count">{{ getListMissionCount(list.id) }}</span>
            <el-dropdown trigger="click" @command="(cmd: string) => handleListCommand(cmd, list, index)">
              <el-button type="info" size="small" text :icon="MoreFilled" class="nav-more" @click.stop />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑清单</el-dropdown-item>
                  <el-dropdown-item command="moveUp" :disabled="index === 0">左移</el-dropdown-item>
                  <el-dropdown-item command="moveDown" :disabled="index === lists.length - 1">右移</el-dropdown-item>
                  <el-dropdown-item command="delete" :disabled="lists.length <= 1">删除清单</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="nav-item add-list-nav" :ref="setListNavItemRef" @click="handleAddList">
            <el-icon><Plus /></el-icon>
            <span class="nav-item-name">添加清单</span>
          </div>
        </div>
      </div>
      <div class="group-nav-scroll-wrapper" v-show="showGroupNav" ref="groupNavRef">
        <div class="group-nav-inner">
          <div
              v-for="(group, groupIndex) in currentSelectedListGroups"
              :key="group.id"
              class="group-nav-item"
              :class="{ active: isGroupSelected(group.id) }"
              :ref="setGroupNavItemRef"
              @click="selectGroup(currentSelectedListId, group.id)"
          >
            <span class="group-color-dot" :style="{ background: group.color }"></span>
            <span class="group-nav-name">{{ group.name }}</span>
            <span class="group-nav-count">{{ getGroupMissionCount(group.id) }}</span>
            <el-dropdown trigger="click" @command="(cmd: string) => handleGroupCommand(cmd, group, currentSelectedListId, groupIndex)">
              <el-button type="info" size="small" text :icon="MoreFilled" class="group-nav-more" @click.stop />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="addMission">添加任务</el-dropdown-item>
                  <el-dropdown-item command="edit">编辑分组</el-dropdown-item>
                  <el-dropdown-item command="moveUp" :disabled="groupIndex === 0">左移</el-dropdown-item>
                  <el-dropdown-item command="moveDown" :disabled="groupIndex === currentSelectedListGroups.length - 1">右移</el-dropdown-item>
                  <el-dropdown-item command="delete" :disabled="currentSelectedListGroups.length <= 1">删除分组</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="group-nav-item add-group-nav" :ref="setGroupNavItemRef" @click="handleAddGroup">
            <el-icon><Plus /></el-icon>
            <span class="group-nav-name">添加分组</span>
          </div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <template v-if="isEditMode">
        <div class="mission-form-page">
          <div class="form-page-body">
            <MissionFormInner
                :mission="editingMission"
                :list-id="currentListId"
                :group-id="currentGroupId"
                @submit="handleMissionFormSubmit"
                @cancel="isEditMode = false"
            />
          </div>
        </div>
      </template>

      <template v-else-if="isMoveMode">
        <div class="move-form-page">
          <div class="move-form-body">
            <div class="move-form-container">
              <div class="move-title">{{ movingMission?.name }}</div>
              <el-form label-width="100px" class="form-body">
                <el-form-item label="目标清单">
                  <el-select v-model="moveTargetListId" placeholder="选择清单" style="width: 100%" @change="handleMoveListChange">
                    <el-option v-for="list in lists" :key="list.id" :label="list.name" :value="list.id">
                      <span class="list-option"><span class="list-color-option" :style="{ background: list.color }"></span>{{ list.name }}</span>
                    </el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="目标分组">
                  <el-select v-model="moveTargetGroupId" placeholder="选择分组" style="width: 100%">
                    <el-option v-for="group in moveTargetGroups" :key="group.id" :label="group.name" :value="group.id">
                      <span class="list-option"><span class="list-color-option" :style="{ background: group.color }"></span>{{ group.name }}</span>
                    </el-option>
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <div class="form-footer">
                    <el-button @click="handleMoveCancel">取消</el-button>
                    <el-button type="primary" @click="confirmMove">确定移动</el-button>
                  </div>
                </el-form-item>
              </el-form>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="isEditListMode">
        <ListFormPage
            :list="editingList"
            @submit="handleListFormSubmit"
            @cancel="isEditListMode = false"
        />
      </template>

      <template v-else-if="isEditGroupMode">
        <GroupFormPage
            :group="editingGroup"
            :list-id="editingGroupListId"
            @submit="handleGroupFormSubmit"
            @cancel="isEditGroupMode = false"
        />
      </template>

      <template v-else-if="isTodaySmartList">
        <el-scrollbar class="content-body">
          <el-empty v-if="todayMissions.length === 0" description="今天没有任务，好好休息吧" :image-size="120" />
          <div v-else class="today-missions">
            <div v-for="mission in todayIncompleteMissions" :key="mission.id" class="mission-card">
              <div class="mission-header">
                <el-checkbox :model-value="mission.completed" @change="handleMissionComplete(mission)" />
                <div class="mission-name" :style="{ color: getPriorityColor(mission.priority) }">{{ mission.name }}</div>
                <div class="mission-actions">
                  <el-dropdown trigger="click" @command="(cmd: string) => handleMissionAction(cmd, mission)">
                    <el-button class="mission-action-btn">
                      <el-icon><MoreFilled /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                        <el-dropdown-item command="move"><el-icon><Rank /></el-icon>移动</el-dropdown-item>
                        <el-dropdown-item command="delete" class="dropdown-delete"><el-icon><Delete /></el-icon>删除</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
              <div class="mission-body">
                <div class="mission-meta">
                  <span v-if="mission.endTime" class="meta-item">
                    <el-icon><Clock /></el-icon>
                    {{ mission.endTime }} 结束
                  </span>
                  <span v-if="getReminderLabel(mission)" class="meta-item reminder-label">
                    <el-icon><Bell /></el-icon>
                    {{ getReminderLabel(mission) }}
                  </span>
                  <span v-if="mission.repeatStrategy !== 'none'" class="meta-item repeat">
                    <el-icon><RefreshRight /></el-icon>
                    {{ getRepeatLabel(mission.repeatStrategy, mission.date, mission.repeatCustomDays) }}
                  </span>
                  <span v-if="getRepeatEndLabel(mission)" class="meta-item repeat-end-label">
                    {{ getRepeatEndLabel(mission) }}
                  </span>
                  <span class="meta-item source-list">
                    <span class="list-dot" :style="{ background: getListColor(mission.listId) }"></span>
                    <span :style="{ color: getListColor(mission.listId) }">{{ getListName(mission.listId) }}</span>
                    <template v-if="getGroupName(mission.listId, mission.groupId)">
                      / <span :style="{ color: getGroup(mission.listId, mission.groupId)?.color }">{{ getGroupName(mission.listId, mission.groupId) }}</span>
                    </template>
                  </span>
                  <span v-if="getRemainingTime(mission)" class="meta-item remaining-time" :class="getRemainingTime(mission)?.type">
                    {{ getRemainingTime(mission)?.text }}
                  </span>
                </div>
                <div v-if="mission.checklist.length > 0" class="checklist-items-always">
                  <div v-for="item in mission.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed }" @click="toggleChecklistItem(mission.id, item.id, $event)">
                    <el-icon class="check-icon" v-if="item.completed"><Check /></el-icon>
                    <el-icon class="check-icon" v-else><CircleCheck /></el-icon>
                    <span class="check-text">{{ item.text }}</span>
                  </div>
                </div>
                <div v-if="mission.notes" class="mission-notes-content">{{ mission.notes }}</div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </template>

      <template v-else-if="isExpiredSmartList">
        <el-scrollbar class="content-body">
          <el-empty v-if="expiredMissions.length === 0" description="没有已过期的任务" :image-size="120" />
          <div v-else class="smart-missions">
            <div v-for="mission in expiredMissions" :key="mission.id" class="mission-card expired-card">
              <div class="mission-header">
                <el-checkbox :model-value="mission.completed" @change="handleMissionComplete(mission)" />
                <div class="mission-name" :style="{ color: getPriorityColor(mission.priority) }">{{ mission.name }}</div>
                <div class="mission-actions">
                  <el-dropdown trigger="click" @command="(cmd: string) => handleMissionAction(cmd, mission)">
                    <el-button class="mission-action-btn">
                      <el-icon><MoreFilled /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                        <el-dropdown-item command="move"><el-icon><Rank /></el-icon>移动</el-dropdown-item>
                        <el-dropdown-item command="delete" class="dropdown-delete"><el-icon><Delete /></el-icon>删除</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
              <div class="mission-body">
                <div class="mission-meta">
                  <span v-if="mission.date" class="meta-item overdue-date">
                    <el-icon><Calendar /></el-icon>
                    {{ getExpiredDateOnly(mission) }}
                  </span>
                  <span v-if="mission.endTime" class="meta-item">
                    <el-icon><Clock /></el-icon>
                    {{ mission.endTime }} 结束
                  </span>
                  <span v-if="getReminderLabel(mission)" class="meta-item reminder-label">
                    <el-icon><Bell /></el-icon>
                    {{ getReminderLabel(mission) }}
                  </span>
                  <span v-if="mission.repeatStrategy !== 'none'" class="meta-item repeat">
                    <el-icon><RefreshRight /></el-icon>
                    {{ getRepeatLabel(mission.repeatStrategy, mission.date, mission.repeatCustomDays) }}
                  </span>
                  <span v-if="getRepeatEndLabel(mission)" class="meta-item repeat-end-label">
                    {{ getRepeatEndLabel(mission) }}
                  </span>
                  <span class="meta-item source-list">
                    <span class="list-dot" :style="{ background: getListColor(mission.listId) }"></span>
                    <span :style="{ color: getListColor(mission.listId) }">{{ getListName(mission.listId) }}</span>
                    <template v-if="getGroupName(mission.listId, mission.groupId)">
                      / <span :style="{ color: getGroup(mission.listId, mission.groupId)?.color }">{{ getGroupName(mission.listId, mission.groupId) }}</span>
                    </template>
                  </span>
                  <span v-if="getOverduePreciseTime(mission)" class="meta-item remaining-time overdue-precise">
                    {{ getOverduePreciseTime(mission) }}
                  </span>
                </div>
                <div v-if="mission.checklist.length > 0" class="checklist-items-always">
                  <div v-for="item in mission.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed }" @click="toggleChecklistItem(mission.id, item.id, $event)">
                    <el-icon class="check-icon" v-if="item.completed"><Check /></el-icon>
                    <el-icon class="check-icon" v-else><CircleCheck /></el-icon>
                    <span class="check-text">{{ item.text }}</span>
                  </div>
                </div>
                <div v-if="mission.notes" class="mission-notes-content">{{ mission.notes }}</div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </template>

      <template v-else-if="isFutureSmartList">
        <el-scrollbar class="content-body">
          <el-empty v-if="futureMissions.length === 0" description="未来七天没有任务" :image-size="120" />
          <div v-else class="smart-missions">
            <div v-for="mission in futureMissions" :key="mission.id" class="mission-card future-card">
              <div class="mission-header">
                <el-checkbox :model-value="mission.completed" @change="handleMissionComplete(mission)" />
                <div class="mission-name" :style="{ color: getPriorityColor(mission.priority) }">{{ mission.name }}</div>
                <div class="mission-actions">
                  <el-dropdown trigger="click" @command="(cmd: string) => handleMissionAction(cmd, mission)">
                    <el-button class="mission-action-btn">
                      <el-icon><MoreFilled /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                        <el-dropdown-item command="move"><el-icon><Rank /></el-icon>移动</el-dropdown-item>
                        <el-dropdown-item command="delete" class="dropdown-delete"><el-icon><Delete /></el-icon>删除</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
              <div class="mission-body">
                <div class="mission-meta">
                  <span v-if="mission.date" class="meta-item">
                    <el-icon><Calendar /></el-icon>
                    {{ formatDate(mission.date) }}
                  </span>
                  <span v-if="mission.endTime" class="meta-item">
                    <el-icon><Clock /></el-icon>
                    {{ mission.endTime }} 结束
                  </span>
                  <span v-if="getReminderLabel(mission)" class="meta-item reminder-label">
                    <el-icon><Bell /></el-icon>
                    {{ getReminderLabel(mission) }}
                  </span>
                  <span v-if="mission.repeatStrategy !== 'none'" class="meta-item repeat">
                    <el-icon><RefreshRight /></el-icon>
                    {{ getRepeatLabel(mission.repeatStrategy, mission.date, mission.repeatCustomDays) }}
                  </span>
                  <span v-if="getRepeatEndLabel(mission)" class="meta-item repeat-end-label">
                    {{ getRepeatEndLabel(mission) }}
                  </span>
                  <span class="meta-item source-list">
                    <span class="list-dot" :style="{ background: getListColor(mission.listId) }"></span>
                    <span :style="{ color: getListColor(mission.listId) }">{{ getListName(mission.listId) }}</span>
                    <template v-if="getGroupName(mission.listId, mission.groupId)">
                      / <span :style="{ color: getGroup(mission.listId, mission.groupId)?.color }">{{ getGroupName(mission.listId, mission.groupId) }}</span>
                    </template>
                  </span>
                  <span v-if="getRemainingTime(mission)" class="meta-item remaining-time future">
                    {{ getRemainingTime(mission)?.text }}
                  </span>
                </div>
                <div v-if="mission.checklist.length > 0" class="checklist-items-always">
                  <div v-for="item in mission.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed }" @click="toggleChecklistItem(mission.id, item.id, $event)">
                    <el-icon class="check-icon" v-if="item.completed"><Check /></el-icon>
                    <el-icon class="check-icon" v-else><CircleCheck /></el-icon>
                    <span class="check-text">{{ item.text }}</span>
                  </div>
                </div>
                <div v-if="mission.notes" class="mission-notes-content">{{ mission.notes }}</div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </template>

      <template v-else-if="currentGroup">
        <el-scrollbar class="content-body">
          <el-empty v-if="currentGroupMissions.length === 0" description="暂无任务，点击添加" :image-size="120" />
          <div v-else class="mission-list">
            <div v-for="mission in currentGroupMissions" :key="mission.id" class="mission-card">
              <div class="mission-header">
                <el-checkbox :model-value="mission.completed" @change="handleMissionComplete(mission)" />
                <div class="mission-name" :style="{ color: getPriorityColor(mission.priority) }">{{ mission.name }}</div>
                <div class="mission-actions">
                  <el-dropdown trigger="click" @command="(cmd: string) => handleMissionAction(cmd, mission)">
                    <el-button class="mission-action-btn">
                      <el-icon><MoreFilled /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                        <el-dropdown-item command="move"><el-icon><Rank /></el-icon>移动</el-dropdown-item>
                        <el-dropdown-item command="delete" class="dropdown-delete"><el-icon><Delete /></el-icon>删除</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
              <div class="mission-body">
                <div class="mission-meta" v-if="mission.date || mission.startTime || mission.endTime || mission.repeatStrategy !== 'none' || mission.reminderStrategy !== 'none'">
                  <span v-if="mission.date" class="meta-item">
                    <el-icon><Calendar /></el-icon>
                    {{ formatDate(mission.date) }}
                  </span>
                  <span v-if="mission.endTime" class="meta-item">
                    <el-icon><Clock /></el-icon>
                    {{ mission.endTime }} 结束
                  </span>
                  <span v-if="getReminderLabel(mission)" class="meta-item reminder-label">
                    <el-icon><Bell /></el-icon>
                    {{ getReminderLabel(mission) }}
                  </span>
                  <span v-if="mission.repeatStrategy !== 'none'" class="meta-item repeat">
                    <el-icon><RefreshRight /></el-icon>
                    {{ getRepeatLabel(mission.repeatStrategy, mission.date, mission.repeatCustomDays) }}
                  </span>
                  <span v-if="getRepeatEndLabel(mission)" class="meta-item repeat-end-label">
                    {{ getRepeatEndLabel(mission) }}
                  </span>
                  <span v-if="getRemainingTime(mission)" class="meta-item remaining-time" :class="getRemainingTime(mission)?.type">
                    {{ getRemainingTime(mission)?.text }}
                  </span>
                </div>
                <div v-if="mission.checklist.length > 0" class="checklist-items-always">
                  <div v-for="item in mission.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed }" @click="toggleChecklistItem(mission.id, item.id, $event)">
                    <el-icon class="check-icon" v-if="item.completed"><Check /></el-icon>
                    <el-icon class="check-icon" v-else><CircleCheck /></el-icon>
                    <span class="check-text">{{ item.text }}</span>
                  </div>
                </div>
                <div v-if="mission.notes" class="mission-notes-content">{{ mission.notes }}</div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </template>

      <template v-else>
        <div class="empty-state">
          <el-empty description="请选择一个分组" :image-size="120" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onBeforeUpdate, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete, Calendar, Clock, RefreshRight, Check, CircleCheck, MoreFilled, Rank, Timer, Bell } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useMissionStore, REPEAT_STRATEGIES, type Mission, type MissionList, type MissionGroup } from '../stores/missionStore'
import MissionFormInner from './MissionForm.vue'
import ListFormPage from './ListFormPage.vue'
import GroupFormPage from './GroupFormPage.vue'
import { getData, setData, getSystemStateField, setSystemStateField } from '../services/storageService'
import { logger } from '../lib/logger'

const missionStore = useMissionStore()

const sendNotification = (title: string, body: string) => {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') new Notification(title, { body })
    })
  }
}

const triggeredReminders = new Set<string>()

const checkReminders = () => {
  const now = dayjs()
  missionStore.missions.forEach(mission => {
    if (mission.completed || mission.reminderStrategy === 'none') return
    if (!mission.date) return

    let triggerTime = dayjs(mission.date + (mission.endTime ? 'T' + mission.endTime : ''))
    if (mission.reminderStrategy === 'advance') {
      const offsetMinutes = (mission.reminderDays || 0) * 1440 + (mission.reminderHours || 0) * 60 + (mission.reminderMinutes || 0)
      triggerTime = triggerTime.subtract(offsetMinutes, 'minute')
    }

    const reminderKey = mission.id + '_' + mission.date + '_' + mission.endTime
    const diffMs = now.diff(triggerTime, 'millisecond')
    if (diffMs >= 0 && diffMs < 3600000 && !triggeredReminders.has(reminderKey)) {
      triggeredReminders.add(reminderKey)
      sendNotification('任务提醒', `「${mission.name}」即将到期，请处理`)
      setTimeout(() => triggeredReminders.delete(reminderKey), 3600000)
    }
  })
}

let reminderInterval: ReturnType<typeof setInterval> | null = null

const startReminderChecker = () => {
  if (reminderInterval) clearInterval(reminderInterval)
  reminderInterval = setInterval(checkReminders, 30000)
  checkReminders()
}

const stopReminderChecker = () => {
  if (reminderInterval) { clearInterval(reminderInterval); reminderInterval = null }
}

const currentListId = ref<string>('')
const currentGroupId = ref<string>('')
const currentSelectedListId = ref<string>('')

const listNavRef = ref()
const groupNavRef = ref()
const listNavItemsRef = ref<HTMLElement[]>([])
const groupNavItemsRef = ref<HTMLElement[]>([])

const clearNavRefs = () => { listNavItemsRef.value = []; groupNavItemsRef.value = [] }
const setListNavItemRef = (el: any) => { if (el) listNavItemsRef.value.push(el) }
const setGroupNavItemRef = (el: any) => { if (el) groupNavItemsRef.value.push(el) }

const scrollToCenter = (container: HTMLElement, target: HTMLElement) => {
  if (!container || !target) return
  const containerWidth = container.clientWidth
  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const targetCenterInContainer = targetRect.left - containerRect.left + container.scrollLeft + (targetRect.width / 2)
  container.scrollTo({ left: Math.max(0, targetCenterInContainer - (containerWidth / 2)), behavior: 'smooth' })
}

const scrollListNavToActive = () => {
  nextTick(() => {
    const container = listNavRef.value as HTMLElement
    if (!container) return
    const activeItem = listNavItemsRef.value.find(item => item.classList.contains('active')) as HTMLElement || container.querySelector('.nav-item.active') as HTMLElement
    if (activeItem) scrollToCenter(container, activeItem)
  })
}

const scrollGroupNavToActive = () => {
  nextTick(() => {
    const container = groupNavRef.value as HTMLElement
    if (!container) return
    const activeItem = groupNavItemsRef.value.find(item => item.classList.contains('active')) as HTMLElement || container.querySelector('.group-nav-item.active') as HTMLElement
    if (activeItem) scrollToCenter(container, activeItem)
  })
}

let isListNavDragging = false, listNavDragStartX = 0, listNavDragScrollLeft = 0, isListNavDragInitialized = false
let isGroupNavDragging = false, groupNavDragStartX = 0, groupNavDragScrollLeft = 0, isGroupNavDragInitialized = false

const initListNavDrag = () => {
  if (isListNavDragInitialized) return
  isListNavDragInitialized = true
  const el = listNavRef.value
  if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isListNavDragging = true; listNavDragStartX = e.pageX; listNavDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isListNavDragging) return; e.preventDefault(); const walk = listNavDragStartX - e.pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, listNavDragScrollLeft + walk)) })
  const endDrag = () => { if (!isListNavDragging) return; isListNavDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', endDrag); window.addEventListener('mouseleave', endDrag)
  el.addEventListener('touchstart', (e: TouchEvent) => { listNavDragStartX = e.touches[0].pageX; listNavDragScrollLeft = el.scrollLeft }, { passive: true })
  el.addEventListener('touchmove', (e: TouchEvent) => { const walk = listNavDragStartX - e.touches[0].pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, listNavDragScrollLeft + walk)) }, { passive: true })
}

const initGroupNavDrag = () => {
  if (isGroupNavDragInitialized) return
  isGroupNavDragInitialized = true
  const el = groupNavRef.value
  if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isGroupNavDragging = true; groupNavDragStartX = e.pageX; groupNavDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isGroupNavDragging) return; e.preventDefault(); const walk = groupNavDragStartX - e.pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, groupNavDragScrollLeft + walk)) })
  const endDrag = () => { if (!isGroupNavDragging) return; isGroupNavDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', endDrag); window.addEventListener('mouseleave', endDrag)
  el.addEventListener('touchstart', (e: TouchEvent) => { groupNavDragStartX = e.touches[0].pageX; groupNavDragScrollLeft = el.scrollLeft }, { passive: true })
  el.addEventListener('touchmove', (e: TouchEvent) => { const walk = groupNavDragStartX - e.touches[0].pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, groupNavDragScrollLeft + walk)) }, { passive: true })
}

const isSmartListActive = computed(() => isTodaySmartList.value || isExpiredSmartList.value || isFutureSmartList.value)
const showGroupNav = computed(() => !isSmartListActive.value && currentSelectedListId.value !== '')
const currentSelectedListGroups = computed(() => { const list = lists.value.find(l => l.id === currentSelectedListId.value); return list?.groups || [] })

const initMissionState = async () => {
  const parsed = await getSystemStateField('list')
  if (parsed) {
    currentListId.value = parsed.currentListId || ''
    currentGroupId.value = parsed.currentGroupId || ''
    currentSelectedListId.value = parsed.currentSelectedListId || parsed.currentListId || ''
  }
}

onMounted(async () => {
  await missionStore.loadData()
  await initMissionState()
  const isSmart = currentListId.value === 'today-smart-list' || currentListId.value === 'expired-smart-list' || currentListId.value === 'future-smart-list'
  const isValid = lists.value.some(l => l.id === currentListId.value)
  if (!currentListId.value || (!isSmart && !isValid)) {
    if (lists.value.length > 0) {
      const f = lists.value[0]; if (f.groups.length > 0) { currentListId.value = f.id; currentGroupId.value = f.groups[0].id; currentSelectedListId.value = f.id }
    }
  }
  nextTick(() => { initListNavDrag(); initGroupNavDrag(); scrollListNavToActive(); if (showGroupNav.value) scrollGroupNavToActive() })
  startReminderChecker()
})

onUnmounted(() => {
  stopReminderChecker()
})

onBeforeUpdate(() => clearNavRefs())

watch([currentListId, currentGroupId, currentSelectedListId], async () => {
  await setSystemStateField('list', { currentListId: currentListId.value, currentGroupId: currentGroupId.value, currentSelectedListId: currentSelectedListId.value })
  nextTick(() => { scrollListNavToActive(); if (showGroupNav.value) scrollGroupNavToActive() })
}, { deep: true })

const listFormVisible = ref(false)
const groupFormVisible = ref(false)
const isEditListMode = ref(false)
const isEditGroupMode = ref(false)
const moveTargetListId = ref('')
const moveTargetGroupId = ref('')
const editingMission = ref<Mission | null>(null)
const editingList = ref<MissionList | null>(null)
const editingGroup = ref<MissionGroup | null>(null)
const editingGroupListId = ref<string>('')
const isEditMode = ref(false)
const isMoveMode = ref(false)
const movingMission = ref<Mission | null>(null)

const getPriorityColor = (priority: string) => {
  switch (priority) { case 'high': return '#ef4444'; case 'medium': return '#f59e0b'; case 'low': return '#22c55e'; default: return 'rgba(255, 255, 255, 0.5)' }
}

const getGroup = (listId: string, groupId: string) => {
  const list = lists.value.find(l => l.id === listId); if (!list) return null; return list.groups.find(g => g.id === groupId) || null
}

const getExpiredDateText = (mission: Mission) => {
  if (!mission.date) return ''
  let t = dayjs(mission.date)
  if (mission.endTime) { const [h, m] = mission.endTime.split(':').map(Number); t = t.hour(h).minute(m) }
  return t.format('MM月DD日 HH:mm')
}

const getExpiredDateOnly = (mission: Mission) => {
  if (!mission.date) return ''
  return dayjs(mission.date).format('MM月DD日')
}

const formatTimeDiff = (days: number, hours: number, minutes: number, isOverdue: boolean): string => {
  const prefix = isOverdue ? '已过期' : '还剩'
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  if (parts.length === 0) return prefix + '0分钟'
  return prefix + parts.join('')
}

const getOverduePreciseTime = (mission: Mission) => {
  if (!mission.date || mission.completed) return null
  const now = dayjs()
  const md = dayjs(mission.date)
  let targetTime = md
  if (mission.endTime) { const [h, m] = mission.endTime.split(':').map(Number); targetTime = md.hour(h).minute(m) }
  else { targetTime = md.hour(23).minute(59) }
  const diffMinutes = now.diff(targetTime, 'minute')
  if (diffMinutes <= 0) return null
  const totalHours = Math.floor(diffMinutes / 60)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const minutes = diffMinutes % 60
  return formatTimeDiff(days, hours, minutes, true)
}

const getRepeatEndLabel = (mission: Mission) => {
  if (!mission.repeatStrategy || mission.repeatStrategy === 'none' || mission.repeatEndStrategy === 'never') return null
  if (mission.repeatEndStrategy === 'date' && mission.repeatEndDate) return `至 ${dayjs(mission.repeatEndDate).format('MM月DD日')}`
  if (mission.repeatEndStrategy === 'count' && mission.repeatCount) return `共${mission.repeatCount}次`
  return null
}

const lists = computed(() => missionStore.lists)
const currentList = computed(() => lists.value.find(l => l.id === currentListId.value))
const currentGroup = computed(() => { if (!currentList.value || !currentGroupId.value) return null; return currentList.value.groups.find(g => g.id === currentGroupId.value) })

const isTodaySmartList = computed(() => currentListId.value === 'today-smart-list' && currentGroupId.value === '')
const isExpiredSmartList = computed(() => currentListId.value === 'expired-smart-list' && currentGroupId.value === '')
const isFutureSmartList = computed(() => currentListId.value === 'future-smart-list' && currentGroupId.value === '')

const todayDate = computed(() => dayjs().format('YYYY-MM-DD'))

const todayMissions = computed(() => {
  const po = { high: 0, medium: 1, low: 2, none: 3 }; const today = todayDate.value
  return missionStore.missions.filter(m => m.date === today).sort((a, b) => {
    if (!a.startTime && b.startTime) return 1; if (a.startTime && !b.startTime) return -1
    if (!a.startTime && !b.startTime) return po[a.priority] - po[b.priority]
    const tc = a.startTime.localeCompare(b.startTime); if (tc !== 0) return tc; return po[a.priority] - po[b.priority]
  })
})
const todayIncompleteMissions = computed(() => todayMissions.value.filter(m => !m.completed))
const todayMissionsCount = computed(() => todayIncompleteMissions.value.length)

const expiredMissions = computed(() => missionStore.missions.filter(m => !m.completed && m.date && dayjs(m.date).isBefore(dayjs(), 'day')).sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()))
const expiredMissionsCount = computed(() => expiredMissions.value.length)

const futureMissions = computed(() => missionStore.missions.filter(m => !m.completed && m.date && dayjs(m.date).isAfter(dayjs(), 'day') && dayjs(m.date).isBefore(dayjs().add(8, 'day'))).sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()))
const futureMissionsCount = computed(() => futureMissions.value.length)

const currentGroupMissions = computed(() => {
  if (!currentGroupId.value) return []
  const po = { high: 0, medium: 1, low: 2, none: 3 }
  return missionStore.missions.filter(m => m.groupId === currentGroupId.value && !m.completed).sort((a, b) => {
    if (!a.date && b.date) return 1; if (a.date && !b.date) return -1; if (!a.date && !b.date) return po[a.priority] - po[b.priority]
    const dc = dayjs(a.date).valueOf() - dayjs(b.date).valueOf(); if (dc !== 0) return dc; return po[a.priority] - po[b.priority]
  })
})

const moveTargetGroups = computed(() => { const list = lists.value.find(l => l.id === moveTargetListId.value); return list?.groups || [] })

const getListMissionCount = (listId: string) => missionStore.missions.filter(m => m.listId === listId && !m.completed).length
const getGroupMissionCount = (groupId: string) => missionStore.missions.filter(m => m.groupId === groupId && !m.completed).length
const getListName = (listId: string) => { const list = lists.value.find(l => l.id === listId); return list?.name || '未知清单' }
const getListColor = (listId: string) => { const list = lists.value.find(l => l.id === listId); return list?.color || '#409EFF' }
const getGroupName = (listId: string, groupId: string) => { const list = lists.value.find(l => l.id === listId); if (!list) return ''; const group = list.groups.find(g => g.id === groupId); if (!group || group.name === '默认分组') return ''; return group.name }

const isListSelected = (listId: string) => currentListId.value === listId
const isGroupSelected = (groupId: string) => currentGroupId.value === groupId

const selectList = (listId: string) => { logger.info('[清单] 切换清单项', { listId, listName: lists.value.find(l => l.id === listId)?.name }); isEditMode.value = false; isMoveMode.value = false; isEditListMode.value = false; isEditGroupMode.value = false; currentListId.value = listId; currentGroupId.value = ''; currentSelectedListId.value = listId; const list = lists.value.find(l => l.id === listId); if (list && list.groups.length > 0) currentGroupId.value = list.groups[0].id }
const selectTodaySmartList = () => { logger.info('[清单] 切换清单项', { listId: 'today-smart-list' }); isEditMode.value = false; isMoveMode.value = false; isEditListMode.value = false; isEditGroupMode.value = false; currentListId.value = 'today-smart-list'; currentGroupId.value = ''; currentSelectedListId.value = '' }
const selectExpiredSmartList = () => { logger.info('[清单] 切换清单项', { listId: 'expired-smart-list' }); isEditMode.value = false; isMoveMode.value = false; isEditListMode.value = false; isEditGroupMode.value = false; currentListId.value = 'expired-smart-list'; currentGroupId.value = ''; currentSelectedListId.value = '' }
const selectFutureSmartList = () => { logger.info('[清单] 切换清单项', { listId: 'future-smart-list' }); isEditMode.value = false; isMoveMode.value = false; isEditListMode.value = false; isEditGroupMode.value = false; currentListId.value = 'future-smart-list'; currentGroupId.value = ''; currentSelectedListId.value = '' }
const selectGroup = (listId: string, groupId: string) => { const list = lists.value.find(l => l.id === listId); const group = list?.groups.find(g => g.id === groupId); logger.info('[清单] 切换分组项', { listId, listName: list?.name, groupId, groupName: group?.name }); isEditMode.value = false; isMoveMode.value = false; isEditListMode.value = false; isEditGroupMode.value = false; currentListId.value = listId; currentGroupId.value = groupId; currentSelectedListId.value = listId }

const formatDate = (date: string) => { if (!date) return ''; return dayjs(date).format('MM月DD日') }

const getRemainingTime = (mission: Mission) => {
  if (!mission.date || mission.completed) return null
  const now = dayjs(); const md = dayjs(mission.date); const isToday = md.isSame(now, 'day'); const isPast = md.isBefore(now, 'day')
  let targetTime = md
  if (mission.endTime) { const [h, m] = mission.endTime.split(':').map(Number); targetTime = md.hour(h).minute(m) }
  else { targetTime = md.hour(23).minute(59) }
  if (isPast || (isToday && targetTime.isBefore(now))) {
    const diffMinutes = now.diff(targetTime, 'minute')
    const totalHours = Math.floor(diffMinutes / 60)
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    const minutes = diffMinutes % 60
    return { text: formatTimeDiff(days, hours, minutes, true), type: 'overdue' }
  }
  if (isToday) { 
    const diffMinutes = targetTime.diff(now, 'minute')
    const totalHours = Math.floor(diffMinutes / 60)
    const days = 0
    const hours = totalHours
    const minutes = diffMinutes % 60
    const textType = diffMinutes <= 60 ? 'urgent' : 'today'
    return { text: formatTimeDiff(days, hours, minutes, false), type: textType }
  }
  const dd = targetTime.diff(now, 'day')
  if (dd <= 0) { 
    const diffMinutes = targetTime.diff(now, 'minute')
    if (diffMinutes <= 0) return { text: '已过期', type: 'overdue' }
    const totalHours = Math.floor(diffMinutes / 60)
    const days = 0
    const hours = totalHours
    const minutes = diffMinutes % 60
    const textType = diffMinutes <= 60 ? 'urgent' : 'today'
    return { text: formatTimeDiff(days, hours, minutes, false), type: textType }
  }
  const totalDiffMinutes = targetTime.diff(now, 'minute')
  const totalHours = Math.floor(totalDiffMinutes / 60)
  const days = dd
  const hours = totalHours % 24
  const minutes = totalDiffMinutes % 60
  return { text: formatTimeDiff(days, hours, minutes, false), type: 'future' }
}

const getRepeatLabel = (strategy: string, missionDate?: string, customDays?: number) => {
  if (strategy === 'custom_days' && customDays) return `每隔${customDays}天`
  if (strategy === 'weekly' && missionDate) {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const dayOfWeek = dayjs(missionDate).day()
    return `每周${weekDays[dayOfWeek]}`
  }
  if (strategy === 'monthly' && missionDate) {
    const dayOfMonth = dayjs(missionDate).date()
    return `每月${dayOfMonth}号`
  }
  return REPEAT_STRATEGIES.find(s => s.value === strategy)?.label || strategy
}

const getReminderLabel = (mission: Mission) => {
  if (mission.reminderStrategy === 'none' || !mission.reminderStrategy) return ''
  if (mission.reminderStrategy === 'on_time') return '准时提醒'
  if (mission.reminderStrategy === 'advance') {
    const parts: string[] = []
    if (mission.reminderDays) parts.push(`${mission.reminderDays}天`)
    if (mission.reminderHours) parts.push(`${mission.reminderHours}小时`)
    if (mission.reminderMinutes) parts.push(`${mission.reminderMinutes}分钟`)
    return `提前${parts.join('')}`
  }
  return ''
}

const handleAddList = () => { editingList.value = null; isEditListMode.value = true }

const handleListCommand = async (command: string, list: MissionList, _index: number) => {
  if (command === 'edit') { editingList.value = list; isEditListMode.value = true }
  else if (command === 'moveUp') { await missionStore.moveListUp(list.id); nextTick(() => scrollListNavToActive()) }
  else if (command === 'moveDown') { await missionStore.moveListDown(list.id); nextTick(() => scrollListNavToActive()) }
  else if (command === 'delete') { missionStore.deleteList(list.id); logger.info('[清单] 删除清单', { listId: list.id, listName: list.name }); ElMessage.success('清单已删除'); if (currentListId.value === list.id) { const f = lists.value[0]; if (f && f.groups.length > 0) { currentListId.value = f.id; currentGroupId.value = f.groups[0].id } else { currentListId.value = ''; currentGroupId.value = '' } } }
}

const handleAddGroup = () => { if (!currentSelectedListId.value) return; editingGroup.value = null; editingGroupListId.value = currentSelectedListId.value; isEditGroupMode.value = true }

const handleGroupCommand = async (command: string, group: MissionGroup, listId: string, _groupIndex: number) => {
  if (command === 'addMission') { currentListId.value = listId; currentGroupId.value = group.id; editingMission.value = null; isEditMode.value = true }
  else if (command === 'edit') { editingGroup.value = group; editingGroupListId.value = listId; isEditGroupMode.value = true }
  else if (command === 'moveUp') { await missionStore.moveGroupUp(listId, group.id); nextTick(() => scrollGroupNavToActive()) }
  else if (command === 'moveDown') { await missionStore.moveGroupDown(listId, group.id); nextTick(() => scrollGroupNavToActive()) }
  else if (command === 'delete') { missionStore.deleteGroupFromList(listId, group.id); logger.info('[清单] 删除分组', { listId, groupId: group.id, groupName: group.name }); ElMessage.success('分组已删除'); if (currentGroupId.value === group.id) { const list = lists.value.find(l => l.id === listId); if (list && list.groups.length > 0) currentGroupId.value = list.groups[0].id } }
}

const handleEditMission = (mission: Mission) => { editingMission.value = mission; isEditMode.value = true }

const handleMissionAction = (cmd: string, mission: Mission) => {
  if (cmd === 'edit') handleEditMission(mission)
  else if (cmd === 'move') handleMoveMission(mission)
  else if (cmd === 'delete') deleteMission(mission.id)
}

const toggleChecklistItem = (missionId: string, itemId: string, event: Event) => { event.stopPropagation(); const mission = missionStore.missions.find(m => m.id === missionId); const item = mission?.checklist.find(c => c.id === itemId); logger.info('[清单] 完成检查事项', { missionId, missionName: mission?.name, itemId, itemName: item?.text }); missionStore.toggleChecklistItem(missionId, itemId) }

const getChecklistProgress = (checklist: { completed: boolean }[]) => { const c = checklist.filter(i => i.completed).length; return `${c}/${checklist.length}` }

const deleteMission = (id: string) => { missionStore.deleteMission(id); logger.info('[清单] 删除任务', { missionId: id }); ElMessage.success('任务已删除') }

const handleMissionComplete = (mission: Mission) => { if (mission.completed) missionStore.uncompleteMission(mission.id); else missionStore.completeMission(mission.id) }

const handleMoveMission = (mission: Mission) => { movingMission.value = mission; moveTargetListId.value = mission.listId; moveTargetGroupId.value = mission.groupId; isMoveMode.value = true }

const handleMoveCancel = () => { isMoveMode.value = false; movingMission.value = null }

const handleMoveListChange = () => { const groups = moveTargetGroups.value; moveTargetGroupId.value = groups[0]?.id || '' }

const confirmMove = () => {
  if (!moveTargetListId.value) { ElMessage.warning('请选择目标清单'); return }
  if (!moveTargetGroupId.value) { ElMessage.warning('请选择目标分组'); return }
  if (movingMission.value) { missionStore.updateMission(movingMission.value.id, { listId: moveTargetListId.value, groupId: moveTargetGroupId.value }); logger.info('[清单] 移动任务', { missionId: movingMission.value.id, toListId: moveTargetListId.value, toGroupId: moveTargetGroupId.value }); isMoveMode.value = false; movingMission.value = null; ElMessage.success('任务已移动') }
}

const handleMissionFormSubmit = () => { if (editingMission.value) { logger.info('[清单] 编辑任务', { missionId: editingMission.value.id }) } else { logger.info('[清单] 添加任务') }; ElMessage.success(editingMission.value ? '任务已更新' : '任务已添加'); editingMission.value = null; isEditMode.value = false }

const handleListFormSubmit = () => { if (editingList.value) { logger.info('[清单] 编辑清单', { listId: editingList.value.id, listName: editingList.value.name }) } else { logger.info('[清单] 添加清单') }; ElMessage.success(editingList.value ? '清单已更新' : '清单已创建'); isEditListMode.value = false; if (!editingList.value && missionStore.lists.length > 0) { const nl = missionStore.lists[missionStore.lists.length - 1]; currentListId.value = nl.id; currentSelectedListId.value = nl.id; if (nl.groups.length > 0) currentGroupId.value = nl.groups[0].id } }

const handleGroupFormSubmit = () => { if (editingGroup.value) { logger.info('[清单] 编辑分组', { groupId: editingGroup.value.id, groupName: editingGroup.value.name }) } else { logger.info('[清单] 添加分组') }; ElMessage.success(editingGroup.value ? '分组已更新' : '分组已创建'); isEditGroupMode.value = false }
</script>

<style scoped>
.mission-container { display: flex; flex-direction: column; height: 100%; position: relative; }
.top-nav-area { background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-shrink: 0; }
.list-nav-scroll-wrapper { height: 56px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
.list-nav-scroll-wrapper::-webkit-scrollbar { display: none; }
.list-nav-inner { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 16px; white-space: nowrap; width: max-content; min-width: 100%; height: 100%; box-sizing: border-box; }
.nav-item { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; user-select: none; position: relative; height: 40px; }
.nav-item:hover { background: rgba(255, 255, 255, 0.08); }
.nav-item.active { background: rgba(102, 126, 234, 0.2); }
.nav-item.active .nav-item-name { color: #fff; font-weight: 500; }
.smart-nav-item { background: rgba(102, 126, 234, 0.08); }
.smart-nav-item:hover { background: rgba(102, 126, 234, 0.15); }
.smart-nav-item.active { background: rgba(102, 126, 234, 0.25); }
.smart-icon { font-size: 16px; color: rgba(102, 126, 234, 0.8); }
.nav-item-name { font-size: 14px; color: rgba(255, 255, 255, 0.75); white-space: nowrap; }
.nav-item-count { font-size: 11px; color: rgba(255, 255, 255, 0.45); padding: 2px 6px; border-radius: 10px; background: rgba(255, 255, 255, 0.1); min-width: 20px; text-align: center; }
.nav-divider { width: 1px; height: 24px; background: rgba(255, 255, 255, 0.12); margin: 0 8px; }
.list-color-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.add-list-nav { color: rgba(255, 255, 255, 0.5); }
.add-list-nav:hover { color: rgba(255, 255, 255, 0.8); }
.add-list-nav .nav-item-name { color: rgba(255, 255, 255, 0.5); }
.nav-more { opacity: 0; transition: opacity 0.2s; width: 20px; height: 20px; flex-shrink: 0; }
.nav-item:hover .nav-more { opacity: 1; }
.group-nav-scroll-wrapper { height: 48px; border-top: 1px solid rgba(255, 255, 255, 0.06); overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
.group-nav-scroll-wrapper::-webkit-scrollbar { display: none; }
.group-nav-inner { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 16px; white-space: nowrap; width: max-content; min-width: 100%; height: 100%; box-sizing: border-box; }
.group-nav-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; user-select: none; height: 36px; }
.group-nav-item:hover { background: rgba(255, 255, 255, 0.08); }
.group-nav-item.active { background: rgba(102, 126, 234, 0.2); }
.group-nav-item.active .group-nav-name { color: #fff; font-weight: 500; }
.group-color-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.group-nav-name { font-size: 13px; color: rgba(255, 255, 255, 0.7); white-space: nowrap; }
.group-nav-count { font-size: 11px; color: rgba(255, 255, 255, 0.4); padding: 1px 5px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); min-width: 16px; text-align: center; }
.group-nav-more { opacity: 0; transition: opacity 0.2s; width: 18px; height: 18px; flex-shrink: 0; }
.group-nav-item:hover .group-nav-more { opacity: 1; }
.add-group-nav { color: rgba(255, 255, 255, 0.5); }
.add-group-nav:hover { color: rgba(255, 255, 255, 0.8); }
.add-group-nav .group-nav-name { color: rgba(255, 255, 255, 0.5); }

.mission-form-page { display: flex; flex-direction: column; height: 100%; }
.form-page-body { flex: 1; overflow-y: auto; padding: 24px; }

.move-form-page { display: flex; flex-direction: column; height: 100%; }
.move-form-body { flex: 1; overflow-y: auto; padding: 24px; }
.move-form-container { max-width: 600px; width: 100%; margin: 0 auto; }
.move-title { font-size: 18px; font-weight: 500; color: #fff; margin-bottom: 24px; text-align: center; }

.main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; }
.content-body { flex: 1; padding: 20px 24px; overflow: hidden; }

.mission-list, .today-missions, .smart-missions { max-width: 900px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }

.expired-card { opacity: 0.85; background: rgba(239, 68, 68, 0.05); }
.expired-card:hover { opacity: 1; background: rgba(239, 68, 68, 0.08); }
.future-card { background: rgba(34, 197, 94, 0.05); }
.future-card:hover { background: rgba(34, 197, 94, 0.08); }

.mission-card { background: rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 14px 16px; transition: all 0.2s; }
.mission-card:hover { background: rgba(255, 255, 255, 0.08); }
.mission-card.completed { opacity: 0.6; }
.mission-card.completed .mission-name { text-decoration: line-through; color: rgba(255, 255, 255, 0.5) !important; }

.mission-header { display: flex; align-items: center; gap: 10px; }
.mission-header .mission-name { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; color: #fff; margin-bottom: 0; }
.mission-body { margin-top: 8px; }
.mission-name { font-size: 15px; font-weight: 500; margin-bottom: 4px; }
.mission-meta { display: flex; flex-wrap: wrap; gap: 12px; }

.meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: rgba(255, 255, 255, 0.5); white-space: nowrap; }
.meta-item.reminder-label { color: #f59e0b; }
.meta-item.repeat { color: #667eea; }
.meta-item.repeat-end-label { color: rgba(255, 255, 255, 0.45); }
.meta-item.checklist-toggle { cursor: pointer; color: rgba(255, 255, 255, 0.55); user-select: none; transition: color 0.2s; }
.meta-item.checklist-toggle:hover { color: rgba(255, 255, 255, 0.8); }
.overdue-date { color: #ef4444; }
.overdue-time { color: #ef4444; }
.overdue-precise { color: #ef4444; font-weight: 500; }
.remaining-time { font-weight: 500; }
.remaining-time.overdue { color: #ef4444; }
.remaining-time.urgent { color: #f59e0b; }
.remaining-time.today { color: #22c55e; }
.remaining-time.future { color: rgba(255, 255, 255, 0.6); }

.checklist-items-always { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; padding-left: 4px; }
.mission-notes-content { margin-top: 8px; font-size: 13px; color: rgba(180, 170, 150, 0.75); line-height: 1.6; word-break: break-word; }
.checklist-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255, 255, 255, 0.7); padding: 6px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; }
.checklist-item:hover { background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.9); }
.checklist-item .check-icon { font-size: 16px; flex-shrink: 0; }
.checklist-item .check-text { flex: 1; word-break: break-word; }
.checklist-item.completed { color: rgba(255, 255, 255, 0.5); }
.checklist-item.completed .check-text { text-decoration: line-through; }
.checklist-item.completed .check-icon { color: #667eea; }

.mission-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.mission-action-btn { background: transparent !important; border: none !important; color: rgba(255,255,255,0.5); width: 32px; height: 32px; padding: 0; }
.mission-action-btn:hover { background: rgba(255,255,255,0.1) !important; color: rgba(255,255,255,0.8); }
.dropdown-delete { color: #ef4444 !important; }

:deep(.el-checkbox__inner) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
:deep(.el-checkbox__input.is-checked .el-checkbox__inner) { background: #667eea; border-color: #667eea; }
:deep(.el-empty__description) { color: rgba(255, 255, 255, 0.5); }
:deep(.el-button.is-circle) { background: rgba(255, 255, 255, 0.1); border-color: transparent; }
:deep(.el-button.is-circle:hover) { background: rgba(255, 255, 255, 0.15); }

.form-footer { display: flex; justify-content: flex-end; gap: 12px; width: 100%; }
.list-option { display: flex; align-items: center; gap: 8px; }
.list-color-option { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
</style>
