<template>
  <div class="mission-container">
    <!-- 左侧边栏：清单列表 -->
    <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <el-scrollbar class="sidebar-content">
        <!-- 智能清单：今天 -->
        <div
            class="list-item smart-list"
            :class="{ active: currentListId === 'today-smart-list' }"
            @click="selectList('today-smart-list')"
        >
          <span class="drag-handle placeholder"></span>
          <span
            class="list-color"
            style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          ></span>
          <span class="list-name" v-show="!sidebarCollapsed">今天</span>
          <span class="list-count" v-show="!sidebarCollapsed">{{ todayMissionsCount }}</span>
          <span class="list-more-placeholder" v-show="!sidebarCollapsed"></span>
        </div>

        <div class="list-divider" v-show="!sidebarCollapsed"></div>

        <!-- 清单列表（支持拖拽排序） -->
        <div
            v-for="(list, index) in lists"
            :key="list.id"
            class="list-item"
            :class="{
            active: currentListId === list.id,
            dragging: draggedIndex === index,
            'drag-over': dragOverIndex === index
          }"
            draggable="true"
            @click="selectList(list.id)"
            @dragstart="handleDragStart($event, index)"
            @dragend="handleDragEnd"
            @dragover="handleDragOver($event, index)"
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, index)"
        >
          <span class="drag-handle" v-show="!sidebarCollapsed">
            <el-icon><Rank /></el-icon>
          </span>
          <span class="list-color" :style="{ background: list.color }"></span>
          <span class="list-name" v-show="!sidebarCollapsed">{{ list.name }}</span>
          <span class="list-count" v-show="!sidebarCollapsed">{{ getListMissionCount(list.id) }}</span>
          <el-dropdown v-show="!sidebarCollapsed" trigger="click" @command="(cmd: string) => handleListCommand(cmd, list)" @click.stop>
            <el-button type="info" size="small" text :icon="MoreFilled" class="list-more" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="edit">编辑清单</el-dropdown-item>
                <el-dropdown-item command="delete" :disabled="lists.length <= 1">删除清单</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 添加清单按钮 -->
        <div class="add-list-btn" v-show="!sidebarCollapsed" @click="handleAddList">
          <el-icon><Plus /></el-icon>
          <span>添加清单</span>
        </div>
      </el-scrollbar>
    </div>

    <!-- 折叠按钮（放在侧边栏外面，确保折叠后仍可见） -->
    <div class="sidebar-toggle" @click="toggleSidebar">
      <el-icon v-if="sidebarCollapsed"><DArrowRight /></el-icon>
      <el-icon v-else><DArrowLeft /></el-icon>
    </div>

    <!-- 右侧内容：分组和任务列表 -->
    <div class="main-content">
      <!-- 无选中清单时的提示 -->
      <template v-if="!currentListId">
        <div class="empty-state">
          <el-empty description="请选择一个清单" :image-size="120" />
        </div>
      </template>

      <!-- 智能清单：今天 -->
      <template v-else-if="isTodaySmartList">
        <div class="content-header">
          <div class="header-left">
            <span class="list-indicator today-indicator"></span>
            <h2>今天</h2>
            <span class="mission-count">{{ todayIncompleteMissions.length }} 个进行中</span>
          </div>
        </div>

        <el-scrollbar class="content-body">
          <!-- 空状态 -->
          <el-empty
              v-if="todayMissions.length === 0"
              description="今天没有任务，好好休息吧"
              :image-size="120"
          />

          <!-- 时间线视图 -->
          <div v-else class="today-missions">
            <!-- 进行中的任务 -->
            <div
                v-for="mission in todayIncompleteMissions"
                :key="mission.id"
                class="mission-card"
                :style="{ borderLeftColor: getListColor(mission.listId) }"
            >
              <div class="mission-main">
                <el-checkbox
                    :model-value="mission.completed"
                    @change="handleMissionComplete(mission)"
                />
                <div class="mission-info">
                  <div class="mission-name">{{ mission.name }}</div>
                  <div class="mission-meta">
                    <span v-if="mission.startTime || mission.endTime" class="meta-item">
                      <el-icon><Clock /></el-icon>
                      <template v-if="mission.startTime && mission.endTime">
                        {{ mission.startTime }} - {{ mission.endTime }}
                      </template>
                      <template v-else-if="mission.startTime">
                        {{ mission.startTime }} 开始
                      </template>
                      <template v-else>
                        {{ mission.endTime }} 结束
                      </template>
                    </span>
                    <span class="meta-item source-list">
                      <span class="list-dot" :style="{ background: getListColor(mission.listId) }"></span>
                      {{ getListAndGroupName(mission.listId, mission.groupId) }}
                    </span>
                    <span
                        v-if="getRemainingTime(mission)"
                        class="meta-item remaining-time"
                        :class="getRemainingTime(mission)?.type"
                    >
                      {{ getRemainingTime(mission)?.text }}
                    </span>
                  </div>
                  <!-- 备注 -->
                  <div v-if="mission.notes" class="mission-notes">
                    <el-icon><Document /></el-icon>
                    <span>{{ mission.notes }}</span>
                  </div>
                  <!-- 检查事项 -->
                  <div v-if="mission.checklist.length > 0" class="checklist-section">
                    <div class="checklist-header">
                      <div class="checklist-progress">
                        <div class="progress-bar">
                          <div
                              class="progress-fill"
                              :style="{ width: getChecklistPercent(mission.checklist) + '%' }"
                          ></div>
                        </div>
                        <span class="progress-text">{{ getChecklistProgress(mission.checklist) }}</span>
                      </div>
                    </div>
                    <div class="checklist-items">
                      <div
                          v-for="item in mission.checklist"
                          :key="item.id"
                          class="checklist-item"
                          :class="{ completed: item.completed }"
                          @click="toggleChecklistItem(mission.id, item.id, $event)"
                      >
                        <el-icon class="check-icon" v-if="item.completed"><Check /></el-icon>
                        <el-icon class="check-icon" v-else><CircleCheck /></el-icon>
                        <span class="check-text">{{ item.text }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="mission-actions">
                  <el-button
                      type="primary"
                      :icon="Edit"
                      circle
                      size="small"
                      @click="handleEditMission(mission)"
                  />
                  <el-popconfirm
                      title="确定删除这个任务吗？"
                      @confirm="deleteMission(mission.id)"
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
        </el-scrollbar>
      </template>

      <!-- 有选中清单时显示内容 -->
      <template v-else-if="currentList">
        <div class="content-header">
          <div class="header-left">
            <span class="list-indicator" :style="{ background: currentList.color }"></span>
            <h2>{{ currentList.name }}</h2>
            <span class="mission-count">{{ incompleteMissions.length }} 个进行中</span>
          </div>
          <div class="header-actions">
            <el-button @click="handleAddGroup">
              <el-icon><FolderAdd /></el-icon>
              添加分组
            </el-button>
            <el-button type="primary" @click="handleAddMission">
              <el-icon><Plus /></el-icon>
              添加任务
            </el-button>
          </div>
        </div>

        <el-scrollbar class="content-body">
          <!-- 空状态 -->
          <el-empty
              v-if="currentMissions.length === 0"
              description="暂无任务，点击添加"
              :image-size="120"
          />

          <!-- 时间线视图 -->
          <div v-else class="mission-groups">
            <!-- 单一默认分组模式：直接显示所有使命 -->
            <template v-if="isSingleDefaultGroup">
              <div class="single-group-missions">
                <!-- 进行中的任务 -->
                <div
                    v-for="mission in getGroupMissions(currentGroups[0]?.id, false)"
                    :key="mission.id"
                    class="mission-card"
                    :class="`priority-${mission.priority}`"
                >
                  <div class="mission-main">
                    <el-checkbox
                        :model-value="mission.completed"
                        @change="handleMissionComplete(mission)"
                    />
                    <div class="mission-info">
                      <div class="mission-name">{{ mission.name }}</div>
                      <div class="mission-meta" v-if="mission.date || mission.startTime || mission.endTime">
                        <span v-if="mission.date" class="meta-item">
                          <el-icon><Calendar /></el-icon>
                          {{ formatDate(mission.date) }}
                        </span>
                        <span v-if="mission.startTime || mission.endTime" class="meta-item">
                          <el-icon><Clock /></el-icon>
                          <template v-if="mission.startTime && mission.endTime">
                            {{ mission.startTime }} - {{ mission.endTime }}
                          </template>
                          <template v-else-if="mission.startTime">
                            {{ mission.startTime }} 开始
                          </template>
                          <template v-else>
                            {{ mission.endTime }} 结束
                          </template>
                        </span>
                        <span v-if="mission.repeatStrategy !== 'none'" class="meta-item repeat">
                          <el-icon><RefreshRight /></el-icon>
                          {{ getRepeatLabel(mission.repeatStrategy, mission.repeatCustomDays) }}
                        </span>
                        <span
                            v-if="getRemainingTime(mission)"
                            class="meta-item remaining-time"
                            :class="getRemainingTime(mission)?.type"
                        >
                          {{ getRemainingTime(mission)?.text }}
                        </span>
                      </div>
                      <!-- 备注 -->
                      <div v-if="mission.notes" class="mission-notes">
                        <el-icon><Document /></el-icon>
                        <span>{{ mission.notes }}</span>
                      </div>
                      <!-- 检查事项 -->
                      <div v-if="mission.checklist.length > 0" class="checklist-section">
                        <div class="checklist-header">
                          <div class="checklist-progress">
                            <div class="progress-bar">
                              <div
                                  class="progress-fill"
                                  :style="{ width: getChecklistPercent(mission.checklist) + '%' }"
                              ></div>
                            </div>
                            <span class="progress-text">{{ getChecklistProgress(mission.checklist) }}</span>
                          </div>
                        </div>
                        <div class="checklist-items">
                          <div
                              v-for="item in mission.checklist"
                              :key="item.id"
                              class="checklist-item"
                              :class="{ completed: item.completed }"
                              @click="toggleChecklistItem(mission.id, item.id, $event)"
                          >
                            <el-icon class="check-icon" v-if="item.completed"><Check /></el-icon>
                            <el-icon class="check-icon" v-else><CircleCheck /></el-icon>
                            <span class="check-text">{{ item.text }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="mission-actions">
                      <el-button
                          type="primary"
                          :icon="Edit"
                          circle
                          size="small"
                          @click="handleEditMission(mission)"
                      />
                      <el-button
                          type="info"
                          :icon="Rank"
                          circle
                          size="small"
                          title="移动到其他清单"
                          @click="handleMoveMission(mission)"
                      />
                      <el-popconfirm
                          title="确定删除这个任务吗？"
                          @confirm="deleteMission(mission.id)"
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
            </template>

            <!-- 多分组模式：显示分组头部 -->
            <template v-else>
              <!-- 遍历清单内的每个分组 -->
              <div
                  v-for="group in currentGroups"
                  :key="group.id"
                  class="group-section"
              >
                <div class="group-header">
                  <div class="group-info" @click="toggleGroupCollapse(group.id)">
                    <el-icon class="collapse-icon" :class="{ collapsed: collapsedGroups[group.id] }"><ArrowDown /></el-icon>
                    <span class="group-color" :style="{ background: group.color }"></span>
                    <span class="group-name">{{ group.name }}</span>
                    <span class="group-count">{{ getGroupMissionCount(group.id) }}</span>
                  </div>
                  <div class="group-actions">
                    <el-button
                        type="primary"
                        size="small"
                        text
                        :icon="Plus"
                        @click="handleAddMissionToGroup(group.id)"
                    >
                      添加
                    </el-button>
                    <el-dropdown trigger="click" @command="(cmd: string) => handleGroupCommand(cmd, group)" v-if="currentGroups.length > 1">
                      <el-button type="info" size="small" text :icon="MoreFilled" />
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="edit">编辑分组</el-dropdown-item>
                          <el-dropdown-item command="delete">删除分组</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>

                <!-- 该分组下的任务 -->
                <div class="group-missions" v-show="!collapsedGroups[group.id]">
                  <!-- 进行中的任务 -->
                  <div
                      v-for="mission in getGroupMissions(group.id, false)"
                      :key="mission.id"
                      class="mission-card"
                      :class="`priority-${mission.priority}`"
                  >
                    <div class="mission-main">
                      <el-checkbox
                          :model-value="mission.completed"
                          @change="handleMissionComplete(mission)"
                      />
                      <div class="mission-info">
                        <div class="mission-name">{{ mission.name }}</div>
                        <div class="mission-meta" v-if="mission.date || (mission.startTime && mission.endTime)">
                          <span v-if="mission.date" class="meta-item">
                            <el-icon><Calendar /></el-icon>
                            {{ formatDate(mission.date) }}
                          </span>
                          <span v-if="mission.startTime && mission.endTime" class="meta-item">
                            <el-icon><Clock /></el-icon>
                            {{ mission.startTime }} - {{ mission.endTime }}
                          </span>
                          <span v-if="mission.repeatStrategy !== 'none'" class="meta-item repeat">
                            <el-icon><RefreshRight /></el-icon>
                            {{ getRepeatLabel(mission.repeatStrategy, mission.repeatCustomDays) }}
                          </span>
                          <span
                              v-if="getRemainingTime(mission)"
                              class="meta-item remaining-time"
                              :class="getRemainingTime(mission)?.type"
                          >
                            {{ getRemainingTime(mission)?.text }}
                          </span>
                        </div>
                        <!-- 备注 -->
                        <div v-if="mission.notes" class="mission-notes">
                          <el-icon><Document /></el-icon>
                          <span>{{ mission.notes }}</span>
                        </div>
                        <!-- 检查事项 -->
                        <div v-if="mission.checklist.length > 0" class="checklist-section">
                          <div class="checklist-header">
                            <div class="checklist-progress">
                              <div class="progress-bar">
                                <div
                                    class="progress-fill"
                                    :style="{ width: getChecklistPercent(mission.checklist) + '%' }"
                                ></div>
                              </div>
                              <span class="progress-text">{{ getChecklistProgress(mission.checklist) }}</span>
                            </div>
                          </div>
                          <div class="checklist-items">
                            <div
                                v-for="item in mission.checklist"
                                :key="item.id"
                                class="checklist-item"
                                :class="{ completed: item.completed }"
                                @click="toggleChecklistItem(mission.id, item.id, $event)"
                            >
                              <el-icon class="check-icon" v-if="item.completed"><Check /></el-icon>
                              <el-icon class="check-icon" v-else><CircleCheck /></el-icon>
                              <span class="check-text">{{ item.text }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="mission-actions">
                        <el-button
                            type="primary"
                            :icon="Edit"
                            circle
                            size="small"
                            @click="handleEditMission(mission)"
                        />
                        <el-button
                            type="info"
                            :icon="Rank"
                            circle
                            size="small"
                            title="移动到其他清单"
                            @click="handleMoveMission(mission)"
                        />
                        <el-popconfirm
                            title="确定删除这个任务吗？"
                            @confirm="deleteMission(mission.id)"
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
              </div>
            </template>
          </div>
        </el-scrollbar>
      </template>

      <!-- 清单不存在时的提示 -->
      <template v-else>
        <div class="empty-state">
          <el-empty description="请选择一个清单" :image-size="120" />
        </div>
      </template>
    </div>

    <!-- 表单对话框 -->
    <MissionForm
        v-model:visible="missionFormVisible"
        :mission="editingMission"
        :list-id="currentListId"
        :group-id="defaultGroupId"
        @submit="handleMissionSubmit"
        @update:visible="onMissionFormVisibleChange"
    />

    <MissionListForm
        v-model:visible="listFormVisible"
        :list="editingList"
        @submit="handleListSubmit"
    />

    <MissionGroupForm
        v-model:visible="groupFormVisible"
        :group="editingGroup"
        :list-id="currentListId"
        @submit="handleGroupSubmit"
    />

    <!-- 移动任务对话框 -->
    <el-dialog
        v-model="moveDialogVisible"
        title="移动任务"
        width="450px"
        :close-on-click-modal="false"
    >
      <div class="move-form">
        <div class="move-row">
          <span class="move-label">目标清单</span>
          <el-select v-model="moveTargetListId" placeholder="选择清单" style="width: 100%" @change="handleMoveListChange">
            <el-option
                v-for="list in lists"
                :key="list.id"
                :label="list.name"
                :value="list.id"
            >
              <span class="list-option">
                <span class="list-color-option" :style="{ background: list.color }"></span>
                {{ list.name }}
              </span>
            </el-option>
          </el-select>
        </div>
        <div class="move-row">
          <span class="move-label">目标分组</span>
          <el-select v-model="moveTargetGroupId" placeholder="选择分组" style="width: 100%">
            <el-option
                v-for="group in moveTargetGroups"
                :key="group.id"
                :label="group.name"
                :value="group.id"
            >
              <span class="list-option">
                <span class="list-color-option" :style="{ background: group.color }"></span>
                {{ group.name }}
              </span>
            </el-option>
          </el-select>
        </div>
      </div>
      <template #footer>
        <el-button @click="moveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmMove">确定移动</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete, Calendar, Clock, RefreshRight, Check, CircleCheck, ArrowDown, MoreFilled, FolderAdd, Rank, Document, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useMissionStore, REPEAT_STRATEGIES, type Mission, type MissionList, type MissionGroup } from '../stores/missionStore'
import MissionForm from './MissionForm.vue'
import MissionListForm from './MissionListForm.vue'
import MissionGroupForm from './MissionGroupForm.vue'
import { getData, setData } from '../services/storageService'

const missionStore = useMissionStore()

// 状态存储键名
const MISSION_STATE_KEY = 'earth-survival-mission-state'

// 当前选中的清单
const currentListId = ref<string>('')

// 默认分组ID（用于添加任务时）
const defaultGroupId = ref<string>('')

// 侧边栏折叠状态
const sidebarCollapsed = ref(false)

// 切换侧边栏折叠
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// 从存储恢复使命页面状态
const initMissionState = async () => {
  const parsedMissionState = await getData<{
    currentListId?: string
  }>(MISSION_STATE_KEY)

  if (parsedMissionState) {
    currentListId.value = parsedMissionState.currentListId || ''
  }
}

// 初始化加载数据
onMounted(async () => {
  await missionStore.loadData()
  await initMissionState()
})

// 保存使命页面状态到存储
watch([currentListId], async () => {
  const state = {
    currentListId: currentListId.value
  }
  await setData(MISSION_STATE_KEY, state)
})

// 折叠分组状态
const collapsedGroups = reactive<Record<string, boolean>>({})

// 表单对话框状态
const missionFormVisible = ref(false)
const listFormVisible = ref(false)
const groupFormVisible = ref(false)

// 移动使命对话框状态
const moveDialogVisible = ref(false)
const moveTargetListId = ref('')
const moveTargetGroupId = ref('')
const movingMission = ref<Mission | null>(null)

// 拖拽排序状态
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const editingMission = ref<Mission | null>(null)
const editingList = ref<MissionList | null>(null)
const editingGroup = ref<MissionGroup | null>(null)

// 计算属性
const lists = computed(() => missionStore.lists)

const currentList = computed(() => {
  return lists.value.find(l => l.id === currentListId.value)
})

const currentGroups = computed(() => {
  return currentList.value?.groups || []
})

// 是否只有一个默认分组（不需要显示分组头部）
const isSingleDefaultGroup = computed(() => {
  if (currentGroups.value.length !== 1) return false
  const group = currentGroups.value[0]
  return group.name === '默认分组'
})

const currentMissions = computed(() => {
  if (!currentListId.value) return []

  const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 }

  return missionStore.missions
      .filter(m => m.listId === currentListId.value)
      .sort((a, b) => {
        // 按时间排序
        if (!a.date && b.date) return 1
        if (a.date && !b.date) return -1
        if (!a.date && !b.date) {
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        }
        const dateCompare = dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
        if (dateCompare !== 0) return dateCompare
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
})

const incompleteMissions = computed(() => {
  return currentMissions.value.filter(m => !m.completed)
})

const isTodaySmartList = computed(() => {
  return currentListId.value === 'today-smart-list'
})

// 今天的日期
const todayDate = computed(() => dayjs().format('YYYY-MM-DD'))

// 获取今天的所有使命（来自所有清单）
const todayMissions = computed(() => {
  const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 }
  const today = todayDate.value

  return missionStore.missions
      .filter(m => m.date === today)
      .sort((a, b) => {
        // 按开始时间排序
        if (!a.startTime && b.startTime) return 1
        if (a.startTime && !b.startTime) return -1
        if (!a.startTime && !b.startTime) {
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        }
        const timeCompare = a.startTime.localeCompare(b.startTime)
        if (timeCompare !== 0) return timeCompare
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
})

// 今天进行中的使命
const todayIncompleteMissions = computed(() => {
  return todayMissions.value.filter(m => !m.completed)
})

// 今天使命数量（用于侧边栏显示）
const todayMissionsCount = computed(() => {
  return todayIncompleteMissions.value.length
})

// 根据清单ID获取清单名称
const getListName = (listId: string) => {
  const list = lists.value.find(l => l.id === listId)
  return list?.name || '未知清单'
}

// 根据清单ID获取清单颜色
const getListColor = (listId: string) => {
  const list = lists.value.find(l => l.id === listId)
  return list?.color || '#409EFF'
}

// 根据清单ID和分组ID获取分组名称，默认分组返回空字符串
const getGroupName = (listId: string, groupId: string) => {
  const list = lists.value.find(l => l.id === listId)
  if (!list) return ''
  const group = list.groups.find(g => g.id === groupId)
  if (!group || group.name === '默认分组') return ''
  return group.name
}

// 获取清单和分组的完整显示文本
const getListAndGroupName = (listId: string, groupId: string) => {
  const listName = getListName(listId)
  const groupName = getGroupName(listId, groupId)
  return groupName ? `${listName} / ${groupName}` : listName
}

// 移动目标的分组列表
const moveTargetGroups = computed(() => {
  const list = lists.value.find(l => l.id === moveTargetListId.value)
  return list?.groups || []
})

// 获取清单的任务数量
const getListMissionCount = (listId: string) => {
  return missionStore.missions.filter(m => m.listId === listId && !m.completed).length
}

// 获取分组的任务数量
const getGroupMissionCount = (groupId: string) => {
  return missionStore.missions.filter(m => m.groupId === groupId && !m.completed).length
}

// 获取分组下的任务
const getGroupMissions = (groupId: string, completed: boolean) => {
  return currentMissions.value.filter(m => m.groupId === groupId && m.completed === completed)
}

// 选择清单
const selectList = (listId: string) => {
  currentListId.value = listId
}

// 格式化日期
const formatDate = (date: string) => {
  if (!date) return ''
  return dayjs(date).format('MM月DD日')
}

// 计算剩余时间
const getRemainingTime = (mission: Mission) => {
  if (!mission.date || mission.completed) return null

  const now = dayjs()
  const missionDate = dayjs(mission.date)
  const isToday = missionDate.isSame(now, 'day')
  const isPast = missionDate.isBefore(now, 'day')

  // 如果有过期时间，结合日期和时间计算
  let targetTime = missionDate
  if (mission.endTime) {
    const [hours, minutes] = mission.endTime.split(':').map(Number)
    targetTime = missionDate.hour(hours).minute(minutes)
  } else if (mission.startTime) {
    const [hours, minutes] = mission.startTime.split(':').map(Number)
    targetTime = missionDate.hour(hours).minute(minutes)
  }

  // 已过期
  if (isPast || (isToday && targetTime.isBefore(now))) {
    const diffMinutes = now.diff(targetTime, 'minute')
    const diffHours = now.diff(targetTime, 'hour')
    const diffDays = now.diff(targetTime, 'day')

    if (diffDays > 0) {
      return { text: `已过期${diffDays}天`, type: 'overdue' }
    } else if (diffHours > 0) {
      return { text: `已过期${diffHours}小时`, type: 'overdue' }
    } else {
      return { text: `已过期${diffMinutes}分钟`, type: 'overdue' }
    }
  }

  // 在当天
  if (isToday) {
    const diffMinutes = targetTime.diff(now, 'minute')
    const diffHours = Math.floor(diffMinutes / 60)
    const remainMinutes = diffMinutes % 60

    if (diffHours > 0) {
      if (remainMinutes > 0) {
        return { text: `还剩${diffHours}小时${remainMinutes}分钟`, type: 'today' }
      }
      return { text: `还剩${diffHours}小时`, type: 'today' }
    }
    return { text: `还剩${diffMinutes}分钟`, type: 'urgent' }
  }

  // 不在当天
  const diffDays = targetTime.diff(now, 'day')
  if (diffDays <= 0) {
    // 如果不足1天，显示剩余小时
    const diffHours = targetTime.diff(now, 'hour')
    if (diffHours > 0) {
      return { text: `还剩${diffHours}小时`, type: 'today' }
    }
    // 如果不足1小时，显示剩余分钟
    const diffMinutes = targetTime.diff(now, 'minute')
    if (diffMinutes > 0) {
      return { text: `还剩${diffMinutes}分钟`, type: 'urgent' }
    }
    return { text: '已过期', type: 'overdue' }
  }
  if (diffDays === 1) {
    return { text: '还剩1天', type: 'future' }
  }
  return { text: `还剩${diffDays}天`, type: 'future' }
}

// 获取重复策略标签
const getRepeatLabel = (strategy: string, customDays?: number) => {
  if (strategy === 'custom_days' && customDays) {
    return `每隔${customDays}天`
  }
  return REPEAT_STRATEGIES.find(s => s.value === strategy)?.label || strategy
}

// 切换分组折叠
const toggleGroupCollapse = (groupId: string) => {
  collapsedGroups[groupId] = !collapsedGroups[groupId]
}

// ========== 拖拽排序 ==========

const handleDragStart = (e: DragEvent, index: number) => {
  draggedIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }
}

const handleDragEnd = () => {
  draggedIndex.value = null
  dragOverIndex.value = null
}

const handleDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverIndex.value = index
}

const handleDragLeave = () => {
  dragOverIndex.value = null
}

const handleDrop = (e: DragEvent, targetIndex: number) => {
  e.preventDefault()
  if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
    return
  }

  // 重新排序
  const newOrder = [...lists.value.map(l => l.id)]
  const draggedId = newOrder[draggedIndex.value]
  newOrder.splice(draggedIndex.value, 1)
  newOrder.splice(targetIndex, 0, draggedId)

  missionStore.reorderLists(newOrder)
  draggedIndex.value = null
  dragOverIndex.value = null
  ElMessage.success('清单顺序已更新')
}

// ========== 清单操作 ==========

const handleAddList = () => {
  editingList.value = null
  listFormVisible.value = true
}

const handleListCommand = (command: string, list: MissionList) => {
  if (command === 'edit') {
    editingList.value = list
    listFormVisible.value = true
  } else if (command === 'delete') {
    missionStore.deleteList(list.id)
    ElMessage.success('清单已删除')
    if (currentListId.value === list.id) {
      currentListId.value = lists.value[0]?.id || ''
    }
  }
}

// ========== 分组操作 ==========

const handleAddGroup = () => {
  editingGroup.value = null
  groupFormVisible.value = true
}

const handleGroupCommand = (command: string, group: MissionGroup) => {
  if (command === 'edit') {
    editingGroup.value = group
    groupFormVisible.value = true
  } else if (command === 'delete') {
    missionStore.deleteGroupFromList(currentListId.value, group.id)
    ElMessage.success('分组已删除')
  }
}

// ========== 任务操作 ==========

const handleAddMission = () => {
  editingMission.value = null
  defaultGroupId.value = currentGroups.value[0]?.id || ''
  missionFormVisible.value = true
}

const handleAddMissionToGroup = (groupId: string) => {
  editingMission.value = null
  defaultGroupId.value = groupId
  missionFormVisible.value = true
}

const handleEditMission = (mission: Mission) => {
  editingMission.value = mission
  missionFormVisible.value = true
}

const toggleChecklistItem = (missionId: string, itemId: string, event: Event) => {
  event.stopPropagation() // 阻止事件冒泡
  missionStore.toggleChecklistItem(missionId, itemId)
}

// 获取检查事项完成进度
const getChecklistProgress = (checklist: { completed: boolean }[]) => {
  const completed = checklist.filter(item => item.completed).length
  return `${completed}/${checklist.length}`
}

// 获取检查事项完成百分比
const getChecklistPercent = (checklist: { completed: boolean }[]) => {
  const completed = checklist.filter(item => item.completed).length
  return checklist.length > 0 ? (completed / checklist.length) * 100 : 0
}

const deleteMission = (id: string) => {
  missionStore.deleteMission(id)
  ElMessage.success('任务已删除')
}

// 点击使命完成复选框
const handleMissionComplete = (mission: Mission) => {
  if (mission.completed) {
    // 已完成 -> 取消完成
    missionStore.uncompleteMission(mission.id)
  } else {
    // 未完成 -> 直接完成
    missionStore.completeMission(mission.id)
  }
}

// ========== 移动使命操作 ==========

// 打开移动对话框
const handleMoveMission = (mission: Mission) => {
  movingMission.value = mission
  moveTargetListId.value = mission.listId
  moveTargetGroupId.value = mission.groupId
  moveDialogVisible.value = true
}

// 目标清单改变时，重置分组为目标清单的第一个分组
const handleMoveListChange = () => {
  const groups = moveTargetGroups.value
  moveTargetGroupId.value = groups[0]?.id || ''
}

// 确认移动使命
const confirmMove = () => {
  if (!moveTargetListId.value) {
    ElMessage.warning('请选择目标清单')
    return
  }

  if (!moveTargetGroupId.value) {
    ElMessage.warning('请选择目标分组')
    return
  }

  if (movingMission.value) {
    missionStore.updateMission(movingMission.value.id, {
      listId: moveTargetListId.value,
      groupId: moveTargetGroupId.value
    })
    moveDialogVisible.value = false
    ElMessage.success('任务已移动')
  }
}

// ========== 表单提交 ==========

const handleMissionSubmit = () => {
  ElMessage.success(editingMission.value ? '任务已更新' : '任务已添加')
  // 提交后清空编辑状态
  editingMission.value = null
}

// 监听对话框可见状态变化
const onMissionFormVisibleChange = (visible: boolean) => {
  if (!visible) {
    // 对话框关闭时清空编辑状态
    editingMission.value = null
  }
}

const handleListSubmit = () => {
  ElMessage.success(editingList.value ? '清单已更新' : '清单已创建')
  if (!editingList.value && missionStore.lists.length > 0) {
    currentListId.value = missionStore.lists[missionStore.lists.length - 1].id
  }
}

const handleGroupSubmit = () => {
  ElMessage.success(editingGroup.value ? '分组已更新' : '分组已创建')
}
</script>

<style scoped>
.mission-container {
  display: flex;
  height: 100%;
  gap: 0;
  position: relative;
}

/* 左侧边栏 */
.sidebar {
  width: 280px;
  background: rgba(255, 255, 255, 0.03);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 0;
  border-right: none;
  overflow: hidden;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  padding: 12px 8px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s;
  margin-bottom: 4px;
  user-select: none;
}

.list-item:active {
  cursor: grabbing;
}

.list-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.list-item.dragging {
  opacity: 0.5;
  background: rgba(102, 126, 234, 0.15);
}

.list-item.drag-over {
  border: 2px dashed #667eea;
  background: rgba(102, 126, 234, 0.1);
}

.drag-handle {
  opacity: 0;
  color: rgba(255, 255, 255, 0.3);
  cursor: grab;
  transition: opacity 0.2s;
  width: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-item:hover .drag-handle {
  opacity: 1;
}

/* 智能清单的 drag-handle 占位符始终隐藏 */
.list-item.smart-list .drag-handle.placeholder {
  opacity: 0 !important;
  pointer-events: none;
}

.drag-handle:hover {
  color: rgba(255, 255, 255, 0.6);
}

.list-item.active {
  background: rgba(102, 126, 234, 0.15);
}

.list-item.active .list-name {
  color: #fff;
}

/* 智能清单样式 */
.list-item.smart-list {
  cursor: pointer;
}

.list-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 8px 12px;
}

.today-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 0 8px rgba(102, 126, 234, 0.5);
}

.today-missions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-list {
  color: rgba(255, 255, 255, 0.5);
}

.list-color {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.list-name {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.list-more {
  opacity: 0;
  transition: opacity 0.2s;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.list-item:hover .list-more {
  opacity: 1;
}

/* 智能清单的占位符，与 list-more 按钮宽度相同 */
.list-more-placeholder {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

/* 折叠按钮 */
.sidebar-toggle {
  position: absolute;
  bottom: 16px;
  left: 268px;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  transition: all 0.3s ease;
}

.sidebar.collapsed + .sidebar-toggle {
  left: 0;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.sidebar-toggle .el-icon {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

/* 添加清单按钮 */
.add-list-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 14px;
  margin: 8px 8px 0;
  border-radius: 8px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s;
}

.add-list-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
}

/* 右侧内容 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.list-indicator {
  width: 4px;
  height: 24px;
  border-radius: 2px;
  flex-shrink: 0;
}

.header-left h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #fff;
}

.mission-count {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.sort-group {
  margin-right: 8px;
}

.sort-group :deep(.el-radio-button__inner) {
  display: flex;
  align-items: center;
  gap: 4px;
}

.content-body {
  flex: 1;
  padding: 20px 24px;
  overflow: hidden;
}

/* 分组任务列表 */
.mission-groups {
  max-width: 900px;
}

.group-section {
  margin-bottom: 24px;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.group-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.group-info:hover {
  opacity: 0.8;
}

.collapse-icon {
  transition: transform 0.3s ease;
  color: rgba(255, 255, 255, 0.5);
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.group-color {
  width: 10px;
  height: 10px;
  border-radius: 5px;
  flex-shrink: 0;
}

.group-name {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.group-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 10px;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.group-missions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.single-group-missions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 任务卡片 */
.mission-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 14px 16px;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.mission-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.mission-card.priority-high {
  border-left-color: #ef4444;
}

.mission-card.priority-medium {
  border-left-color: #f59e0b;
}

.mission-card.priority-low {
  border-left-color: #22c55e;
}

.mission-card.priority-none {
  border-left-color: #909399;
}

.mission-card.completed {
  opacity: 0.6;
}

.mission-card.completed .mission-name {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.5);
}

.mission-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.mission-info {
  flex: 1;
  min-width: 0;
}

.mission-name {
  font-size: 15px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 6px;
}

.mission-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.mission-notes {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}

.mission-notes .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.4);
}

.mission-notes span {
  flex: 1;
  word-break: break-word;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.meta-item.repeat {
  color: #667eea;
}

/* 剩余时间样式 */
.remaining-time {
  font-weight: 500;
}

.remaining-time.overdue {
  color: #ef4444;
}

.remaining-time.urgent {
  color: #f59e0b;
}

.remaining-time.today {
  color: #22c55e;
}

.remaining-time.future {
  color: rgba(255, 255, 255, 0.6);
}

/* 检查事项样式 */
.checklist-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.checklist-header {
  margin-bottom: 8px;
}

.checklist-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.checklist-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.checklist-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
}

.checklist-item .check-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.checklist-item .check-text {
  flex: 1;
  word-break: break-word;
}

.checklist-item.completed {
  color: rgba(255, 255, 255, 0.5);
}

.checklist-item.completed .check-text {
  text-decoration: line-through;
}

.checklist-item.completed .check-icon {
  color: #667eea;
}

.mission-actions {
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}

.mission-card:hover .mission-actions {
  opacity: 1;
}

/* 已完成区域 */
.completed-section {
  margin-top: 12px;
}

.completed-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 8px 0;
}

.completed-header .rotated {
  transform: rotate(-90deg);
}

.completed-missions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Element Plus 样式覆盖 */
:deep(.el-checkbox__inner) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: #667eea;
  border-color: #667eea;
}

:deep(.el-empty__description) {
  color: rgba(255, 255, 255, 0.5);
}

:deep(.el-button.is-circle) {
  background: rgba(255, 255, 255, 0.1);
  border-color: transparent;
}

:deep(.el-button.is-circle:hover) {
  background: rgba(255, 255, 255, 0.15);
}

/* 完成时间对话框样式 */
.complete-time-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-label {
  width: 70px;
  color: #606266;
}

.time-label .optional-tag {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

/* 移动任务对话框样式 */
.move-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.move-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.move-label {
  width: 70px;
  color: #606266;
  flex-shrink: 0;
}

.list-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-color-option {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* 视图切换样式 */
.view-group {
  margin-right: 8px;
}

.view-group :deep(.el-radio-button__inner) {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
