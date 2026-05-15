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
          </div>
        </div>
      </div>
      <div class="op-nav-scroll-wrapper" ref="opNavRef" v-show="showGroupNav">
        <div class="op-nav-inner">
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleOpenEditList">编辑清单</div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleAddList">添加清单</div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleMoveListUp">左移清单</div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleMoveListDown">右移清单</div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleDeleteList">删除清单</div>
          <div class="op-nav-separator"></div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleOpenEditGroup">编辑分组</div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleAddGroup">添加分组</div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleMoveGroupLeft">左移分组</div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleMoveGroupRight">右移分组</div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleDeleteGroup">删除分组</div>
          <div class="op-nav-separator"></div>
          <div class="op-nav-item" :ref="setOpNavItemRef" @click="handleOpenAddMission">添加任务</div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <template v-if="isTodaySmartList">
        <el-scrollbar class="content-body">
          <el-empty v-if="todayMissions.length === 0" description="今天没有任务，好好休息吧" :image-size="120" />
          <div v-else class="today-missions">
            <div v-for="mission in todayIncompleteMissions" :key="mission.id" class="mission-card">
              <div class="mission-header">
                <el-checkbox :model-value="mission.completed" @change="handleMissionComplete(mission)" />
                <div class="mission-name" :style="{ color: getPriorityColor(mission.priority) }">{{ mission.name }}</div>
                <div class="mission-actions">
                  <el-button class="mission-icon-btn" text size="small" @click.stop="handleEditMission(mission)" title="编辑"><el-icon><Edit /></el-icon></el-button>
                  <el-button class="mission-icon-btn" text size="small" @click.stop="openChildFormMove(mission)" title="移动"><el-icon><Switch /></el-icon></el-button>
                  <el-button class="mission-icon-btn mission-icon-btn-delete" text size="small" @click.stop="deleteMission(mission.id)" title="删除"><el-icon><Delete /></el-icon></el-button>
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
                  <div v-for="item in mission.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed, 'drag-over': dragOverItemId === item.id }"
                       @dragover.prevent="onChecklistDragOver($event, mission.id, item.id)"
                       @drop="onChecklistDrop(mission.id, item.id)"
                       @dragleave="onChecklistDragLeave(item.id)">
                    <el-icon class="checklist-drag-handle" draggable="true"
                      @dragstart="onChecklistDragStart($event, mission.id, item.id)"
                      @dragend="dragOverItemId = null"
                    ><Rank /></el-icon>
                    <el-icon class="check-icon" v-if="item.completed" @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><Check /></el-icon>
                    <el-icon class="check-icon" v-else @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><CircleCheck /></el-icon>
                    <template v-if="editingChecklistId === item.id && editingChecklistMissionId === mission.id">
                      <el-input v-model="editingChecklistText" type="textarea" autosize size="small" class="checklist-edit-input"
                        @keyup.escape="cancelEditChecklistItem"
                        @blur="finishEditChecklistItem" />
                    </template>
                    <span v-else class="check-text" @click.stop="startEditChecklistItem(mission.id, item)">{{ item.text }}</span>
                  </div>
                  <div class="checklist-add-row">
                    <el-input
                      v-if="addingChecklist[mission.id]"
                      v-model="newChecklistText[mission.id]"
                      size="small"
                      placeholder="输入后回车确认"
                      :ref="(el: any) => { if (el && addingChecklistMissionId === mission.id) { nextTick(() => { const input = (el as any).input || (el as any).textarea; if (input) input.focus() }) } }"
                      @keyup.enter="handleAddChecklist(mission.id)"
                      @keyup.escape="cancelAddChecklist(mission.id)"
                      @blur="cancelAddChecklist(mission.id)"
                    />
                    <div v-else class="checklist-add-btn" @click.stop="showAddChecklist(mission.id)">
                      <el-icon><Plus /></el-icon>
                      <span>新增检查事项</span>
                    </div>
                  </div>
                </div>
                    <div v-if="editingNotesMissionId === mission.id" class="mission-notes-edit-wrapper">
                      <el-input
                        v-model="editingNotesText"
                        type="textarea"
                        autosize
                        size="small"
                        class="mission-notes-edit-input"
                        placeholder="双击编辑备注"
                        @keyup.escape="cancelEditNotes"
                        @blur="finishEditNotes"
                      />
                    </div>
                    <div v-else-if="mission.notes" class="mission-notes-content" @dblclick.stop="startEditNotes(mission)">{{ mission.notes }}</div>
                    <div v-else class="mission-notes-placeholder" @dblclick.stop="startEditNotes(mission)">双击添加备注</div>
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
                  <el-button class="mission-icon-btn" text size="small" @click.stop="handleEditMission(mission)" title="编辑"><el-icon><Edit /></el-icon></el-button>
                  <el-button class="mission-icon-btn" text size="small" @click.stop="openChildFormMove(mission)" title="移动"><el-icon><Switch /></el-icon></el-button>
                  <el-button class="mission-icon-btn mission-icon-btn-delete" text size="small" @click.stop="deleteMission(mission.id)" title="删除"><el-icon><Delete /></el-icon></el-button>
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
                  <div v-for="item in mission.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed, 'drag-over': dragOverItemId === item.id }"
                       @dragover.prevent="onChecklistDragOver($event, mission.id, item.id)"
                       @drop="onChecklistDrop(mission.id, item.id)"
                       @dragleave="onChecklistDragLeave(item.id)">
                    <el-icon class="checklist-drag-handle" draggable="true"
                      @dragstart="onChecklistDragStart($event, mission.id, item.id)"
                      @dragend="dragOverItemId = null"
                    ><Rank /></el-icon>
                    <el-icon class="check-icon" v-if="item.completed" @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><Check /></el-icon>
                    <el-icon class="check-icon" v-else @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><CircleCheck /></el-icon>
                    <template v-if="editingChecklistId === item.id && editingChecklistMissionId === mission.id">
                      <el-input v-model="editingChecklistText" type="textarea" autosize size="small" class="checklist-edit-input"
                        @keyup.escape="cancelEditChecklistItem"
                        @blur="finishEditChecklistItem" />
                    </template>
                    <span v-else class="check-text" @click.stop="startEditChecklistItem(mission.id, item)">{{ item.text }}</span>
                  </div>
                  <div class="checklist-add-row">
                    <el-input
                      v-if="addingChecklist[mission.id]"
                      v-model="newChecklistText[mission.id]"
                      size="small"
                      placeholder="输入后回车确认"
                      :ref="(el: any) => { if (el && addingChecklistMissionId === mission.id) { nextTick(() => { const input = (el as any).input || (el as any).textarea; if (input) input.focus() }) } }"
                      @keyup.enter="handleAddChecklist(mission.id)"
                      @keyup.escape="cancelAddChecklist(mission.id)"
                      @blur="cancelAddChecklist(mission.id)"
                    />
                    <div v-else class="checklist-add-btn" @click.stop="showAddChecklist(mission.id)">
                      <el-icon><Plus /></el-icon>
                      <span>新增检查事项</span>
                    </div>
                  </div>
                </div>
                    <div v-if="editingNotesMissionId === mission.id" class="mission-notes-edit-wrapper">
                      <el-input
                        v-model="editingNotesText"
                        type="textarea"
                        autosize
                        size="small"
                        class="mission-notes-edit-input"
                        placeholder="双击编辑备注"
                        @keyup.escape="cancelEditNotes"
                        @blur="finishEditNotes"
                      />
                    </div>
                    <div v-else-if="mission.notes" class="mission-notes-content" @dblclick.stop="startEditNotes(mission)">{{ mission.notes }}</div>
                    <div v-else class="mission-notes-placeholder" @dblclick.stop="startEditNotes(mission)">双击添加备注</div>
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
                  <el-button class="mission-icon-btn" text size="small" @click.stop="handleEditMission(mission)" title="编辑"><el-icon><Edit /></el-icon></el-button>
                  <el-button class="mission-icon-btn" text size="small" @click.stop="openChildFormMove(mission)" title="移动"><el-icon><Switch /></el-icon></el-button>
                  <el-button class="mission-icon-btn mission-icon-btn-delete" text size="small" @click.stop="deleteMission(mission.id)" title="删除"><el-icon><Delete /></el-icon></el-button>
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
                  <div v-for="item in mission.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed, 'drag-over': dragOverItemId === item.id }"
                       @dragover.prevent="onChecklistDragOver($event, mission.id, item.id)"
                       @drop="onChecklistDrop(mission.id, item.id)"
                       @dragleave="onChecklistDragLeave(item.id)">
                    <el-icon class="checklist-drag-handle" draggable="true"
                      @dragstart="onChecklistDragStart($event, mission.id, item.id)"
                      @dragend="dragOverItemId = null"
                    ><Rank /></el-icon>
                    <el-icon class="check-icon" v-if="item.completed" @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><Check /></el-icon>
                    <el-icon class="check-icon" v-else @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><CircleCheck /></el-icon>
                    <template v-if="editingChecklistId === item.id && editingChecklistMissionId === mission.id">
                      <el-input v-model="editingChecklistText" type="textarea" autosize size="small" class="checklist-edit-input"
                        @keyup.escape="cancelEditChecklistItem"
                        @blur="finishEditChecklistItem" />
                    </template>
                    <span v-else class="check-text" @click.stop="startEditChecklistItem(mission.id, item)">{{ item.text }}</span>
                  </div>
                  <div class="checklist-add-row">
                    <el-input
                      v-if="addingChecklist[mission.id]"
                      v-model="newChecklistText[mission.id]"
                      size="small"
                      placeholder="输入后回车确认"
                      :ref="(el: any) => { if (el && addingChecklistMissionId === mission.id) { nextTick(() => { const input = (el as any).input || (el as any).textarea; if (input) input.focus() }) } }"
                      @keyup.enter="handleAddChecklist(mission.id)"
                      @keyup.escape="cancelAddChecklist(mission.id)"
                      @blur="cancelAddChecklist(mission.id)"
                    />
                    <div v-else class="checklist-add-btn" @click.stop="showAddChecklist(mission.id)">
                      <el-icon><Plus /></el-icon>
                      <span>新增检查事项</span>
                    </div>
                  </div>
                </div>
                    <div v-if="editingNotesMissionId === mission.id" class="mission-notes-edit-wrapper">
                      <el-input
                        v-model="editingNotesText"
                        type="textarea"
                        autosize
                        size="small"
                        class="mission-notes-edit-input"
                        placeholder="双击编辑备注"
                        @keyup.escape="cancelEditNotes"
                        @blur="finishEditNotes"
                      />
                    </div>
                    <div v-else-if="mission.notes" class="mission-notes-content" @dblclick.stop="startEditNotes(mission)">{{ mission.notes }}</div>
                    <div v-else class="mission-notes-placeholder" @dblclick.stop="startEditNotes(mission)">双击添加备注</div>
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
                  <el-button class="mission-icon-btn" text size="small" @click.stop="handleEditMission(mission)" title="编辑"><el-icon><Edit /></el-icon></el-button>
                  <el-button class="mission-icon-btn" text size="small" @click.stop="openChildFormMove(mission)" title="移动"><el-icon><Switch /></el-icon></el-button>
                  <el-button class="mission-icon-btn mission-icon-btn-delete" text size="small" @click.stop="deleteMission(mission.id)" title="删除"><el-icon><Delete /></el-icon></el-button>
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
                  <div v-for="item in mission.checklist" :key="item.id" class="checklist-item" :class="{ completed: item.completed, 'drag-over': dragOverItemId === item.id }"
                       @dragover.prevent="onChecklistDragOver($event, mission.id, item.id)"
                       @drop="onChecklistDrop(mission.id, item.id)"
                       @dragleave="onChecklistDragLeave(item.id)">
                    <el-icon class="checklist-drag-handle" draggable="true"
                      @dragstart="onChecklistDragStart($event, mission.id, item.id)"
                      @dragend="dragOverItemId = null"
                    ><Rank /></el-icon>
                    <el-icon class="check-icon" v-if="item.completed" @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><Check /></el-icon>
                    <el-icon class="check-icon" v-else @click.stop="toggleChecklistItem(mission.id, item.id, $event)"><CircleCheck /></el-icon>
                    <template v-if="editingChecklistId === item.id && editingChecklistMissionId === mission.id">
                      <el-input v-model="editingChecklistText" type="textarea" autosize size="small" class="checklist-edit-input"
                        @keyup.escape="cancelEditChecklistItem"
                        @blur="finishEditChecklistItem" />
                    </template>
                    <span v-else class="check-text" @click.stop="startEditChecklistItem(mission.id, item)">{{ item.text }}</span>
                  </div>
                  <div class="checklist-add-row">
                    <el-input
                      v-if="addingChecklist[mission.id]"
                      v-model="newChecklistText[mission.id]"
                      size="small"
                      placeholder="输入后回车确认"
                      :ref="(el: any) => { if (el && addingChecklistMissionId === mission.id) { nextTick(() => { const input = (el as any).input || (el as any).textarea; if (input) input.focus() }) } }"
                      @keyup.enter="handleAddChecklist(mission.id)"
                      @keyup.escape="cancelAddChecklist(mission.id)"
                      @blur="cancelAddChecklist(mission.id)"
                    />
                    <div v-else class="checklist-add-btn" @click.stop="showAddChecklist(mission.id)">
                      <el-icon><Plus /></el-icon>
                      <span>新增检查事项</span>
                    </div>
                  </div>
                </div>
                    <div v-if="editingNotesMissionId === mission.id" class="mission-notes-edit-wrapper">
                      <el-input
                        v-model="editingNotesText"
                        type="textarea"
                        autosize
                        size="small"
                        class="mission-notes-edit-input"
                        placeholder="双击编辑备注"
                        @keyup.escape="cancelEditNotes"
                        @blur="finishEditNotes"
                      />
                    </div>
                    <div v-else-if="mission.notes" class="mission-notes-content" @dblclick.stop="startEditNotes(mission)">{{ mission.notes }}</div>
                    <div v-else class="mission-notes-placeholder" @dblclick.stop="startEditNotes(mission)">双击添加备注</div>
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

  <!-- List Dialog -->
  <div v-if="showListDialog" class="dialog-overlay" @click.self="closeListDialog">
    <div class="dialog-container">
      <div class="dialog-header">
        <span class="dialog-header-title">{{ dialogList ? '编辑清单' : '添加清单' }}</span>
        <el-button class="dialog-close-btn" text @click="closeListDialog"><el-icon><Close /></el-icon></el-button>
      </div>
      <div class="dialog-body">
        <ListFormPage :list="dialogList" @submit="onListSubmit" @cancel="closeListDialog" />
      </div>
    </div>
  </div>

  <!-- Group Dialog -->
  <div v-if="showGroupDialog" class="dialog-overlay" @click.self="closeGroupDialog">
    <div class="dialog-container">
      <div class="dialog-header">
        <span class="dialog-header-title">{{ dialogGroup ? '编辑分组' : '添加分组' }}</span>
        <el-button class="dialog-close-btn" text @click="closeGroupDialog"><el-icon><Close /></el-icon></el-button>
      </div>
      <div class="dialog-body">
        <GroupFormPage :group="dialogGroup" :list-id="currentSelectedListId" @submit="onGroupSubmit" @cancel="closeGroupDialog" />
      </div>
    </div>
  </div>

  <!-- Mission Dialog -->
  <div v-if="showMissionDialog" class="dialog-overlay" @click.self="closeMissionDialog">
    <div class="dialog-container mission-dialog-container">
      <div class="dialog-header mission-dialog-header">
        <span class="dialog-header-title mission-dialog-title">{{ dialogMission ? '编辑任务' : '添加任务' }}</span>
        <div class="mission-dialog-header-actions">
          <el-button class="mission-dialog-save-btn" text @click="triggerMissionFormSubmit" title="保存"><el-icon class="rotate-check"><Check /></el-icon></el-button>
          <el-button class="mission-dialog-close-btn" text @click="closeMissionDialog"><el-icon><Close /></el-icon></el-button>
        </div>
      </div>
      <div class="dialog-body mission-dialog-body">
        <MissionForm ref="missionFormRef" :mission="dialogMission" :list-id="currentSelectedListId" :group-id="currentGroupId" @submit="onMissionSubmit" @cancel="closeMissionDialog" />
      </div>
    </div>
  </div>

  <!-- Move Mission Dialog -->
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

  <!-- Confirm Dialog -->
  <div v-if="showConfirmDialog" class="dialog-overlay" @click.self="closeConfirmDialog">
    <div class="dialog-container confirm-dialog-container">
      <div class="confirm-icon">
        <el-icon class="warning-icon"><Warning /></el-icon>
      </div>
      <h3 class="confirm-title">{{ confirmDialogTitle }}</h3>
      <p class="confirm-message">{{ confirmDialogMessage }}</p>
      <div class="confirm-actions">
        <el-button type="default" @click="closeConfirmDialog">取消</el-button>
        <el-button type="danger" @click="handleConfirmAction">确认删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onBeforeUpdate, watch, nextTick, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar, Clock, RefreshRight, Check, CircleCheck, Timer, Bell, Close, Warning, Plus, Edit, Switch, Delete, Rank } from '@element-plus/icons-vue'
import ListFormPage from './ListFormPage.vue'
import GroupFormPage from './GroupFormPage.vue'
import MissionForm from './MissionForm.vue'
import MoveMissionPage from './MoveMissionPage.vue'
import dayjs from 'dayjs'
import { useMissionStore, REPEAT_STRATEGIES, type Mission, type MissionList, type MissionGroup } from '../stores/missionStore'
import { getData, setData, getSystemStateField, setSystemStateField } from '../services/storageService'
import { logger } from '../lib/logger'

const missionStore = useMissionStore()

const refreshReminders = inject<() => void>('refreshReminders', () => {})

const currentListId = ref<string>('')
const currentGroupId = ref<string>('')
const currentSelectedListId = ref<string>('')

const listNavRef = ref()
const groupNavRef = ref()
const opNavRef = ref()
const listNavItemsRef = ref<HTMLElement[]>([])
const groupNavItemsRef = ref<HTMLElement[]>([])
const opNavItemsRef = ref<HTMLElement[]>([])

const clearNavRefs = () => { listNavItemsRef.value = []; groupNavItemsRef.value = []; opNavItemsRef.value = [] }
const setListNavItemRef = (el: any) => { if (el) listNavItemsRef.value.push(el) }
const setGroupNavItemRef = (el: any) => { if (el) groupNavItemsRef.value.push(el) }
const setOpNavItemRef = (el: any) => { if (el) opNavItemsRef.value.push(el) }

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
let isOpNavDragging = false, opNavDragStartX = 0, opNavDragScrollLeft = 0, isOpNavDragInitialized = false

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

const initOpNavDrag = () => {
  if (isOpNavDragInitialized) return
  isOpNavDragInitialized = true
  const el = opNavRef.value
  if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isOpNavDragging = true; opNavDragStartX = e.pageX; opNavDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isOpNavDragging) return; e.preventDefault(); const walk = opNavDragStartX - e.pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, opNavDragScrollLeft + walk)) })
  const endDrag = () => { if (!isOpNavDragging) return; isOpNavDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', endDrag); window.addEventListener('mouseleave', endDrag)
  el.addEventListener('touchstart', (e: TouchEvent) => { opNavDragStartX = e.touches[0].pageX; opNavDragScrollLeft = el.scrollLeft }, { passive: true })
  el.addEventListener('touchmove', (e: TouchEvent) => { const walk = opNavDragStartX - e.touches[0].pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, opNavDragScrollLeft + walk)) }, { passive: true })
}

const isSmartListActive = computed(() => isTodaySmartList.value || isExpiredSmartList.value || isFutureSmartList.value)
const showGroupNav = computed(() => !isSmartListActive.value && currentSelectedListId.value !== '')
const currentSelectedListGroups = computed(() => { const list = lists.value.find(l => l.id === currentSelectedListId.value); if (!list?.groups) return []; return [...list.groups].sort((a, b) => a.order - b.order) })

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
  nextTick(() => { initListNavDrag(); initGroupNavDrag(); initOpNavDrag(); scrollListNavToActive(); if (showGroupNav.value) scrollGroupNavToActive() })
})

onBeforeUpdate(() => clearNavRefs())

watch([currentListId, currentGroupId, currentSelectedListId], async () => {
  await setSystemStateField('list', { currentListId: currentListId.value, currentGroupId: currentGroupId.value, currentSelectedListId: currentSelectedListId.value })
  nextTick(() => { scrollListNavToActive(); if (showGroupNav.value) scrollGroupNavToActive() })
}, { deep: true })

const showStarCanvas = ref(true)
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


const showListDialog = ref(false)
const showGroupDialog = ref(false)
const showMissionDialog = ref(false)
const showMoveDialog = ref(false)
const showConfirmDialog = ref(false)
const dialogList = ref<MissionList | null>(null)
const dialogGroup = ref<MissionGroup | null>(null)
const dialogMission = ref<Mission | null>(null)
const moveMissionId = ref('')
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
let pendingConfirmAction: (() => void) | null = null

const missionFormRef = ref<InstanceType<typeof MissionForm> | null>(null)

const triggerMissionFormSubmit = () => {
  missionFormRef.value?.handleSubmit()
}

const addingChecklist = ref<Record<string, boolean>>({})
const newChecklistText = ref<Record<string, string>>({})
const addingChecklistMissionId = ref<string>('')


const getListMissionCount = (listId: string) => missionStore.missions.filter(m => m.listId === listId && !m.completed).length
const getGroupMissionCount = (groupId: string) => missionStore.missions.filter(m => m.groupId === groupId && !m.completed).length
const getListName = (listId: string) => { const list = lists.value.find(l => l.id === listId); return list?.name || '未知清单' }
const getListColor = (listId: string) => { const list = lists.value.find(l => l.id === listId); return list?.color || '#409EFF' }
const getGroupName = (listId: string, groupId: string) => { const list = lists.value.find(l => l.id === listId); if (!list) return ''; const group = list.groups.find(g => g.id === groupId); if (!group || group.name === '默认分组') return ''; return group.name }

const isListSelected = (listId: string) => currentListId.value === listId
const isGroupSelected = (groupId: string) => currentGroupId.value === groupId

const selectList = (listId: string) => { logger.info('[清单] 切换清单项', { listId, listName: lists.value.find(l => l.id === listId)?.name }); currentListId.value = listId; currentGroupId.value = ''; currentSelectedListId.value = listId; const list = lists.value.find(l => l.id === listId); if (list && list.groups.length > 0) currentGroupId.value = list.groups[0].id }
const selectTodaySmartList = () => { logger.info('[清单] 切换清单项', { listId: 'today-smart-list' }); currentListId.value = 'today-smart-list'; currentGroupId.value = ''; currentSelectedListId.value = '' }
const selectExpiredSmartList = () => { logger.info('[清单] 切换清单项', { listId: 'expired-smart-list' }); currentListId.value = 'expired-smart-list'; currentGroupId.value = ''; currentSelectedListId.value = '' }
const selectFutureSmartList = () => { logger.info('[清单] 切换清单项', { listId: 'future-smart-list' }); currentListId.value = 'future-smart-list'; currentGroupId.value = ''; currentSelectedListId.value = '' }
const selectGroup = (listId: string, groupId: string) => { const list = lists.value.find(l => l.id === listId); const group = list?.groups.find(g => g.id === groupId); logger.info('[清单] 切换分组项', { listId, listName: list?.name, groupId, groupName: group?.name }); currentListId.value = listId; currentGroupId.value = groupId; currentSelectedListId.value = listId }

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

const handleAddList = () => { dialogList.value = null; showListDialog.value = true }

const handleAddGroup = () => { if (!currentSelectedListId.value) return; dialogGroup.value = null; showGroupDialog.value = true }

const handleEditMission = (mission: Mission) => { dialogMission.value = mission; showMissionDialog.value = true }

const handleOpenEditList = () => {
  const list = lists.value.find(l => l.id === currentSelectedListId.value)
  if (list) { dialogList.value = list; showListDialog.value = true }
}

const handleMoveListUp = async () => { if (currentSelectedListId.value) { const idx = lists.value.findIndex(l => l.id === currentSelectedListId.value); if (idx > 0) { await missionStore.moveListUp(currentSelectedListId.value); nextTick(() => scrollListNavToActive()) } } }
const handleMoveListDown = async () => { if (currentSelectedListId.value) { const idx = lists.value.findIndex(l => l.id === currentSelectedListId.value); if (idx < lists.value.length - 1) { await missionStore.moveListDown(currentSelectedListId.value); nextTick(() => scrollListNavToActive()) } } }
const handleDeleteList = () => {
  if (!currentSelectedListId.value) return
  const list = lists.value.find(l => l.id === currentSelectedListId.value)
  if (!list) return

  const missionCount = getListMissionCount(list.id)
  confirmDialogTitle.value = '删除清单'
  confirmDialogMessage.value = `确定要删除清单「${list.name}」吗？${missionCount > 0 ? `该清单下有 ${missionCount} 个任务，将一起被删除。` : ''}`
  pendingConfirmAction = async () => {
    await missionStore.deleteList(list.id)
    logger.info('[清单] 删除清单', { listId: list.id, listName: list.name })
    ElMessage.success('清单已删除')
    const f = lists.value[0]
    if (f && f.groups.length > 0) {
      currentListId.value = f.id
      currentGroupId.value = f.groups[0].id
      currentSelectedListId.value = f.id
    } else {
      currentListId.value = ''
      currentGroupId.value = ''
      currentSelectedListId.value = ''
    }
  }
  showConfirmDialog.value = true
}

const handleOpenEditGroup = () => {
  if (currentGroupId.value && currentSelectedListId.value) {
    const group = currentSelectedListGroups.value.find(g => g.id === currentGroupId.value)
    if (group) { dialogGroup.value = group; showGroupDialog.value = true }
  }
}
const handleMoveGroupLeft = async () => { if (currentGroupId.value && currentSelectedListId.value) { const idx = currentSelectedListGroups.value.findIndex(g => g.id === currentGroupId.value); if (idx > 0) { await missionStore.moveGroupUp(currentSelectedListId.value, currentGroupId.value); nextTick(() => scrollGroupNavToActive()) } } }
const handleMoveGroupRight = async () => { if (currentGroupId.value && currentSelectedListId.value) { const idx = currentSelectedListGroups.value.findIndex(g => g.id === currentGroupId.value); if (idx < currentSelectedListGroups.value.length - 1) { await missionStore.moveGroupDown(currentSelectedListId.value, currentGroupId.value); nextTick(() => scrollGroupNavToActive()) } } }
const handleDeleteGroup = () => {
  if (!currentGroupId.value || !currentSelectedListId.value) return
  const group = currentSelectedListGroups.value.find(g => g.id === currentGroupId.value)
  if (!group) return

  const missionCount = getGroupMissionCount(group.id)
  confirmDialogTitle.value = '删除分组'
  confirmDialogMessage.value = `确定要删除分组「${group.name}」吗？${missionCount > 0 ? `该分组下有 ${missionCount} 个任务，将被移到默认分组。` : ''}`
  pendingConfirmAction = async () => {
    await missionStore.deleteGroupFromList(currentSelectedListId.value, group.id)
    logger.info('[清单] 删除分组', { listId: currentSelectedListId.value, groupId: group.id, groupName: group.name })
    ElMessage.success('分组已删除')
    const remaining = (lists.value.find(l => l.id === currentSelectedListId.value)?.groups) || []
    if (remaining.length > 0) {
      currentGroupId.value = remaining[0].id
    }
  }
  showConfirmDialog.value = true
}
const handleOpenAddMission = () => {
  if (currentGroupId.value && currentSelectedListId.value) {
    currentListId.value = currentSelectedListId.value
    currentGroupId.value = currentGroupId.value
    dialogMission.value = null
    showMissionDialog.value = true
  }
}

const openChildFormMove = (mission: Mission) => {
  moveMissionId.value = mission.id
  showMoveDialog.value = true
  logger.info('[清单] 打开移动对话框', { missionId: mission.id, missionName: mission.name })
}

const toggleChecklistItem = (missionId: string, itemId: string, event: Event) => { event.stopPropagation(); const mission = missionStore.missions.find(m => m.id === missionId); const item = mission?.checklist.find(c => c.id === itemId); logger.info('[清单] 完成检查事项', { missionId, missionName: mission?.name, itemId, itemName: item?.text }); missionStore.toggleChecklistItem(missionId, itemId) }

const showAddChecklist = (missionId: string) => {
  addingChecklist.value[missionId] = true
  newChecklistText.value[missionId] = ''
  addingChecklistMissionId.value = missionId
}

const cancelAddChecklist = (missionId: string) => {
  addingChecklist.value[missionId] = false
  delete newChecklistText.value[missionId]
  if (addingChecklistMissionId.value === missionId) addingChecklistMissionId.value = ''
}

const handleAddChecklist = async (missionId: string) => {
  const text = (newChecklistText.value[missionId] || '').trim()
  if (!text) { cancelAddChecklist(missionId); return }
  await missionStore.addChecklistItem(missionId, text)
  logger.info('[清单] 快速添加检查事项', { missionId, text })
  addingChecklistMissionId.value = ''
  cancelAddChecklist(missionId)
}

const dragSourceMissionId = ref('')
const dragSourceItemId = ref('')
const dragOverItemId = ref('')
const editingChecklistId = ref('')
const editingChecklistMissionId = ref('')
const editingChecklistText = ref('')

const onChecklistDragStart = (e: DragEvent, missionId: string, itemId: string) => {
  dragSourceMissionId.value = missionId
  dragSourceItemId.value = itemId
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

const onChecklistDragOver = (_e: DragEvent, _missionId: string, itemId: string) => {
  dragOverItemId.value = itemId
}

const onChecklistDragLeave = (itemId: string) => {
  if (dragOverItemId.value === itemId) dragOverItemId.value = null
}

const onChecklistDrop = async (missionId: string, targetItemId: string) => {
  dragOverItemId.value = null
  const mission = missionStore.missions.find(m => m.id === missionId)
  if (!mission) return
  const fromIdx = mission.checklist.findIndex(c => c.id === dragSourceItemId.value)
  const toIdx = mission.checklist.findIndex(c => c.id === targetItemId)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
  const items = [...mission.checklist]
  const [moved] = items.splice(fromIdx, 1)
  items.splice(toIdx, 0, moved)
  mission.checklist = items
  await missionStore.updateMission(missionId, { checklist: items })
  logger.info('[清单] 拖拽排序检查事项', { missionId, fromIdx, toIdx })
}

const startEditChecklistItem = (missionId: string, item: { id: string; text: string }) => {
  editingChecklistId.value = item.id
  editingChecklistMissionId.value = missionId
  editingChecklistText.value = item.text
  nextTick(() => {
    const el = document.querySelector('.checklist-edit-input textarea') as HTMLTextAreaElement
    if (el) el.focus()
  })
}

const finishEditChecklistItem = async () => {
  const mission = missionStore.missions.find(m => m.id === editingChecklistMissionId.value)
  if (!mission) { cancelEditChecklistItem(); return }
  const item = mission.checklist.find(c => c.id === editingChecklistId.value)
  if (!item) { cancelEditChecklistItem(); return }
  const newText = editingChecklistText.value.trim()
  if (newText && newText !== item.text) {
    item.text = newText
    await missionStore.updateMission(editingChecklistMissionId.value, { checklist: mission.checklist })
    logger.info('[清单] 编辑检查事项', { missionId: editingChecklistMissionId.value, itemId: editingChecklistId.value, text: newText })
  }
  cancelEditChecklistItem()
}

const cancelEditChecklistItem = () => {
  editingChecklistId.value = ''
  editingChecklistMissionId.value = ''
  editingChecklistText.value = ''
}

const editingNotesMissionId = ref('')
const editingNotesText = ref('')

const startEditNotes = (mission: Mission) => {
  editingNotesMissionId.value = mission.id
  editingNotesText.value = mission.notes || ''
  nextTick(() => {
    const el = document.querySelector('.mission-notes-edit-input textarea') as HTMLTextAreaElement
    if (el) el.focus()
  })
}

const finishEditNotes = async () => {
  const mission = missionStore.missions.find(m => m.id === editingNotesMissionId.value)
  if (!mission) { cancelEditNotes(); return }
  const newText = editingNotesText.value.trim()
  await missionStore.updateMission(editingNotesMissionId.value, { notes: newText || undefined })
  logger.info('[清单] 编辑备注', { missionId: editingNotesMissionId.value, notes: newText })
  cancelEditNotes()
}

const cancelEditNotes = () => {
  editingNotesMissionId.value = ''
  editingNotesText.value = ''
}

const getChecklistProgress = (checklist: { completed: boolean }[]) => { const c = checklist.filter(i => i.completed).length; return `${c}/${checklist.length}` }

const deleteMission = async (id: string) => {
  const mission = missionStore.missions.find(m => m.id === id)
  const hadReminder = mission && mission.reminderStrategy !== 'none' && mission.date
  await missionStore.deleteMission(id)
  logger.info('[清单] 删除任务', { missionId: id })
  ElMessage.success('任务已删除')
  if (hadReminder) refreshReminders()
}

const handleMissionComplete = async (mission: Mission) => {
  const hadReminder = mission.reminderStrategy !== 'none' && mission.date
  if (mission.completed) await missionStore.uncompleteMission(mission.id)
  else await missionStore.completeMission(mission.id)
  if (hadReminder) refreshReminders()
}

const closeListDialog = () => { showListDialog.value = false; dialogList.value = null }
const closeGroupDialog = () => { showGroupDialog.value = false; dialogGroup.value = null }
const closeMissionDialog = () => { showMissionDialog.value = false; dialogMission.value = null }
const closeMoveDialog = () => { showMoveDialog.value = false; moveMissionId.value = '' }
const closeConfirmDialog = () => { showConfirmDialog.value = false; pendingConfirmAction = null }

function onListSubmit(data: Record<string, unknown>) {
  logger.info('[清单] 清单表单提交', { data })
  if (dialogList.value) {
    missionStore.updateList(dialogList.value.id, { name: data.name as string, color: data.color as string })
    logger.info('[清单] 编辑清单', { listId: dialogList.value.id, listName: data.name })
    ElMessage.success('清单已更新')
  } else {
    missionStore.addList(data.name as string, data.color as string)
    logger.info('[清单] 添加清单')
    ElMessage.success('清单已创建')
    const nl = missionStore.lists[missionStore.lists.length - 1]
    if (nl) {
      currentListId.value = nl.id
      currentSelectedListId.value = nl.id
      if (nl.groups.length > 0) currentGroupId.value = nl.groups[0].id
    }
  }
  closeListDialog()
}

function onGroupSubmit(data: Record<string, unknown>) {
  logger.info('[清单] 分组表单提交', { data })
  if (dialogGroup.value) {
    missionStore.updateGroupInList(data.listId as string, data.groupId as string, { name: data.name as string, color: data.color as string })
    logger.info('[清单] 编辑分组', { groupId: data.groupId, groupName: data.name })
    ElMessage.success('分组已更新')
  } else {
    missionStore.addGroupToList(data.listId as string, data.name as string, data.color as string)
    logger.info('[清单] 添加分组')
    ElMessage.success('分组已创建')
  }
  closeGroupDialog()
}

async function onMissionSubmit(data: Record<string, unknown>) {
  logger.info('[清单] 任务表单提交', { data })
  const hasReminder = data.reminderStrategy !== 'none' && data.date
  if (dialogMission.value) {
    await missionStore.updateMission(dialogMission.value.id, data)
    logger.info('[清单] 编辑任务', { missionId: dialogMission.value.id })
    ElMessage.success('任务已更新')
  } else {
    await missionStore.addMission({ ...data, listId: data.listId || currentListId.value, groupId: data.groupId || currentGroupId.value } as any)
    logger.info('[清单] 添加任务')
    ElMessage.success('任务已添加')
  }
  closeMissionDialog()
  if (hasReminder) refreshReminders()
}

async function onMoveSubmit(data: Record<string, unknown>) {
  const mission = missionStore.missions.find(m => m.id === moveMissionId.value)
  const hadReminder = mission && mission.reminderStrategy !== 'none' && mission.date
  await missionStore.updateMission(moveMissionId.value, { listId: data.listId as string, groupId: data.groupId as string })
  logger.info('[清单] 移动任务', { missionId: moveMissionId.value, toListId: data.listId, toGroupId: data.groupId })
  ElMessage.success('任务已移动')
  closeMoveDialog()
  if (hadReminder) refreshReminders()
}

function handleConfirmAction() {
  if (pendingConfirmAction) {
    pendingConfirmAction()
    pendingConfirmAction = null
  }
  showConfirmDialog.value = false
}
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

.op-nav-scroll-wrapper { height: 40px; border-top: 1px solid rgba(255, 255, 255, 0.06); overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
.op-nav-scroll-wrapper::-webkit-scrollbar { display: none; }
.op-nav-inner { display: flex; align-items: center; justify-content: center; gap: 2px; padding: 4px 16px; white-space: nowrap; width: max-content; min-width: 100%; height: 100%; box-sizing: border-box; }
.op-nav-item { padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; color: rgba(255, 255, 255, 0.7); transition: all 0.15s; user-select: none; height: 28px; display: flex; align-items: center; }
.op-nav-item:hover { background: rgba(102, 126, 234, 0.15); color: #fff; }
.op-nav-separator { width: 1px; height: 18px; background: rgba(255, 255, 255, 0.1); margin: 0 4px; flex-shrink: 0; }
.mission-action-btn-inline { padding: 0 8px; font-size: 12px; height: 24px; min-height: 24px; }

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
.mission-notes-content { margin-top: 8px; font-size: 13px; color: rgba(180, 170, 150, 0.75); line-height: 1.6; word-break: break-word; white-space: pre-wrap; }
.mission-notes-placeholder { margin-top: 8px; font-size: 13px; color: rgba(180, 170, 150, 0.35); line-height: 1.6; word-break: break-word; white-space: pre-wrap; cursor: pointer; transition: color 0.2s; }
.mission-notes-placeholder:hover { color: rgba(180, 170, 150, 0.55); }
.mission-notes-edit-wrapper { margin-top: 8px; }
.mission-notes-edit-input { flex: 1; }
.mission-notes-edit-input :deep(.el-textarea__inner) { background: rgba(255, 255, 255, 0.05) !important; border: 1px solid rgba(102, 126, 234, 0.3) !important; color: rgba(255, 255, 255, 0.9) !important; }
.checklist-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255, 255, 255, 0.7); padding: 6px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; }
.checklist-item:hover { background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.9); }
.checklist-item .check-icon { font-size: 16px; flex-shrink: 0; }
.checklist-item .check-text { flex: 1; word-break: break-word; }
.checklist-item.completed { color: rgba(255, 255, 255, 0.5); }
.checklist-item.completed .check-text { text-decoration: line-through; }
.checklist-item.completed .check-icon { color: #667eea; }

.checklist-add-row { margin-top: 2px; }
.checklist-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.checklist-add-btn:hover { color: rgba(255, 255, 255, 0.7); background: rgba(255, 255, 255, 0.05); }

.mission-actions { display: flex; align-items: center; gap: 1px; flex-shrink: 0; }
.mission-action-btn { background: transparent !important; border: none !important; color: rgba(255,255,255,0.5); width: 32px; height: 32px; padding: 0; }
.mission-action-btn:hover { background: rgba(255,255,255,0.1) !important; color: rgba(255,255,255,0.8); }
.mission-icon-btn { width: 22px; height: 22px; padding: 0; min-width: auto; background: transparent !important; border: none !important; }
.mission-icon-btn:nth-child(1) { color: #60a5fa; }
.mission-icon-btn:nth-child(2) { color: #4ade80; }
.mission-icon-btn:nth-child(3) { color: #f87171; }
.mission-icon-btn:nth-child(1):hover { color: #93c5fd; }
.mission-icon-btn:nth-child(2):hover { color: #86efac; }
.mission-icon-btn:nth-child(3):hover { color: #fca5a5; }
.mission-icon-btn-delete { color: #f87171; }
.mission-icon-btn-delete:hover { color: #fca5a5; }
.dropdown-delete { color: #ef4444 !important; }

.checklist-drag-handle { font-size: 14px; color: rgba(255,255,255,0.25); cursor: grab; flex-shrink: 0; }
.checklist-drag-handle:active { cursor: grabbing; }
.checklist-item.drag-over { background: rgba(102,126,234,0.15); }
.checklist-edit-input { flex: 1; }

:deep(.el-checkbox__inner) { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
:deep(.el-checkbox__input.is-checked .el-checkbox__inner) { background: #667eea; border-color: #667eea; }
:deep(.el-empty__description) { color: rgba(255, 255, 255, 0.5); }
:deep(.el-button.is-circle) { background: rgba(255, 255, 255, 0.1); border-color: transparent; }
:deep(.el-button.is-circle:hover) { background: rgba(255, 255, 255, 0.15); }

.form-footer { display: flex; justify-content: flex-end; gap: 12px; width: 100%; }
.list-option { display: flex; align-items: center; gap: 8px; }
.list-color-option { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }

/* Dialog overlays */
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

.mission-dialog-container {
  width: 580px;
  max-height: 85vh;
}
.mission-dialog-container::-webkit-scrollbar { display: none; }

.confirm-dialog-container {
  width: 380px;
  text-align: center;
  padding: 32px;
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
  color: #fff;
}

.dialog-close-btn {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.5);
  padding: 0;
  min-width: auto;
  width: 28px;
  height: 28px;
}

.dialog-close-btn:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.mission-dialog-header { justify-content: center; position: relative; }
.mission-dialog-title { flex: 1; text-align: center; }
.mission-dialog-header-actions { position: absolute; right: 12px; top: 10px; display: flex; align-items: center; gap: 4px; }
.mission-dialog-save-btn { font-size: 18px; color: rgba(255,255,255,0.6); padding: 0; min-width: auto; width: 28px; height: 28px; background: #1d1b34 !important; border-radius: 4px; }
.mission-dialog-save-btn:hover { color: #667eea; background: #1d1b34 !important; }
.rotate-check { transition: none; }
.mission-dialog-close-btn { font-size: 18px; color: #ef4444; padding: 0; min-width: auto; width: 28px; height: 28px; background: #1d1b34 !important; border-radius: 4px; }
.mission-dialog-close-btn:hover { color: #ff6b6b; background: #1d1b34 !important; }
.mission-dialog-body { }

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 20px;
}

.confirm-icon {
  text-align: center;
  margin-bottom: 12px;
}

.warning-icon {
  font-size: 48px;
  color: #f59e0b;
}

.confirm-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 12px 0;
}

.confirm-message {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.confirm-actions :deep(.el-button) {
  padding: 8px 24px;
  font-size: 14px;
  border-radius: 8px;
}

.confirm-actions :deep(.el-button--danger) {
  background: #ef4444;
  border-color: #ef4444;
}

.confirm-actions :deep(.el-button--danger:hover) {
  background: #dc2626;
  border-color: #dc2626;
}
</style>
