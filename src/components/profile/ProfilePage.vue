<template>
  <div class="profile-page">
    <div class="profile-nav-wrapper" ref="profileNavRef">
      <div class="profile-nav-inner">
        <div
            v-for="item in navItems"
            :key="item.key"
            class="profile-nav-item"
            :class="{ active: activeNavKey === item.key }"
            :ref="setProfileNavItemRef"
            @click="scrollToSection(item.key, item.id)"
        >
          <el-icon v-if="item.icon" class="nav-icon"><component :is="item.icon" /></el-icon>
          <span class="nav-name">{{ item.name }}</span>
        </div>
      </div>
    </div>
    <div class="profile-content">
      <el-scrollbar ref="profileScrollbarRef" @scroll="handleProfileScroll">
        <div class="profile-section" id="section-profile">
          <h3 class="section-title">个人信息</h3>

          <el-form
              ref="formRef"
              :model="form"
              :rules="rules"
              label-position="top"
              class="profile-form"
          >
            <el-form-item label="昵称" prop="nickname">
              <el-input
                  v-model="form.nickname"
                  placeholder="请输入昵称"
                  maxlength="20"
                  show-word-limit
              />
            </el-form-item>

            <el-form-item label="生日">
              <LunarDatePicker
                  v-model="form.birthday"
                  placeholder="选择生日"
                  full-width
              />
            </el-form-item>
          </el-form>
        </div>

        <div class="profile-section" id="section-security">
          <h3 class="section-title">账号安全</h3>

          <div class="security-item">
            <div class="security-info">
              <span class="security-label">账号</span>
              <span class="security-value">{{ maskEmail(authStore.user?.email) }}</span>
            </div>
            <el-button size="small" @click="showEmailDialog = true">
              修改
            </el-button>
          </div>

          <div class="security-item">
            <div class="security-info">
              <span class="security-label">密码</span>
              <span class="security-value">••••••••</span>
            </div>
            <el-button size="small" @click="showPasswordDialog = true">
              修改
            </el-button>
          </div>

          <div class="security-item">
            <div class="security-info">
              <span class="security-label">手机号</span>
              <span class="security-value">{{ form.phone || '未绑定' }}</span>
            </div>
            <el-button size="small" @click="showPhoneDialog = true">
              {{ form.phone ? '修改' : '绑定' }}
            </el-button>
          </div>

          <div class="security-item">
            <div class="security-info">
              <span class="security-label">注册时间</span>
              <span class="security-value">{{ formatCreatedAt() }}</span>
            </div>
          </div>

          <div class="security-actions">
            <el-button type="danger" @click="handleLogout" :loading="loggingOut">
              退出登录
            </el-button>
            <el-button type="danger" plain @click="handleDeleteAccount" :loading="deletingAccount">
              注销账号
            </el-button>
          </div>
        </div>

        <div class="profile-section" id="section-focus">
          <h3 class="section-title">专注设置</h3>
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
                  @change="handleFocusSettingChange"
              />
            </div>
          </div>
        </div>

        <div class="profile-section" id="section-course">
          <h3 class="section-title">课程表设置</h3>
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
                  @update:model-value="handleCourseSettingChange"
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
                  @change="handleCourseWeeksChange"
              />
            </div>
          </div>

          <div class="setting-item course-reminder-item">
            <div class="setting-info">
              <span class="setting-label">提前提醒</span>
              <span class="setting-desc">上课前多少分钟发送系统通知提醒</span>
            </div>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettings.reminderMinutes"
                  :min="1"
                  :max="60"
                  :step="1"
                  controls-position="right"
                  size="default"
                  @change="handleCourseReminderChange"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">第1节开始时间</span>
              <span class="setting-desc">每天第一节上课的时间</span>
            </div>
            <div class="setting-control">
              <TimePickerPopover
                  v-model="courseSettings.firstPeriodStart"
                  @update:model-value="handleCourseFirstPeriodStartChange"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">每节时长</span>
              <span class="setting-desc">每节课持续的分钟数</span>
            </div>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettings.periodDuration"
                  :min="15"
                  :max="120"
                  :step="5"
                  size="default"
                  @change="handleCoursePeriodDurationChange"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">课间休息时长</span>
              <span class="setting-desc">相邻两节课之间的休息分钟数</span>
            </div>
            <div class="setting-control setting-control-break">
              <div class="break-mode-toggle">
                <el-radio-group v-model="courseSettings.breakMode" size="default" @change="handleCourseBreakModeChange">
                  <el-radio-button value="uniform">统一时长</el-radio-button>
                  <el-radio-button value="custom">自由时长</el-radio-button>
                </el-radio-group>
              </div>
              <el-input-number
                  v-if="courseSettings.breakMode !== 'custom'"
                  v-model="courseSettings.breakDuration"
                  :min="5"
                  :max="60"
                  :step="5"
                  size="default"
                  class="setting-break-input"
                  @change="handleCourseBreakDurationChange"
              />
              <el-button
                  v-else
                  size="default"
                  class="setting-break-custom-btn"
                  @click="showCustomBreakDialog = true"
              >自定义课间休息</el-button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">午休时长</span>
              <span class="setting-desc">上午最后一节到下午第一节之间的休息分钟数</span>
            </div>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettings.lunchBreakMinutes"
                  :min="0"
                  :max="240"
                  :step="5"
                  size="default"
                  @change="handleCourseLunchBreakChange"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">晚休时长</span>
              <span class="setting-desc">下午最后一节到晚上第一节之间的休息分钟数</span>
            </div>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettings.dinnerBreakMinutes"
                  :min="0"
                  :max="240"
                  :step="5"
                  size="default"
                  @change="handleCourseDinnerBreakChange"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">显示周末</span>
              <span class="setting-desc">在课程表中显示周六和周日</span>
            </div>
            <div class="setting-control">
              <el-switch
                  v-model="courseSettings.showWeekend"
                  inline-prompt
                  size="default"
                  @change="handleCourseShowWeekendChange"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">显示非本周课程</span>
              <span class="setting-desc">在课程表中显示其他周的课程安排</span>
            </div>
            <div class="setting-control">
              <el-switch
                  v-model="courseSettings.showNonCurrentWeekCourses"
                  inline-prompt
                  size="default"
                  @change="handleCourseShowNonCurrentWeekChange"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">课表节数设置</span>
              <span class="setting-desc">设置上午、下午和晚上各有多少节课</span>
            </div>
            <div class="setting-control">
              <PeriodCountPicker
                  v-model="courseSettings.periodCountPerSession"
                  @update:model-value="handlePeriodCountChange"
              />
            </div>
          </div>
        </div>

        <div class="profile-section" id="section-system">
          <h3 class="section-title">系统设置</h3>
          <p class="section-desc">配置程序在系统中的行为。</p>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">开机自启动</span>
              <span class="setting-desc">登录系统时自动启动程序</span>
            </div>
            <div class="setting-control">
              <el-switch
                  v-model="autoLaunch"
                  inline-prompt
                  size="default"
                  @change="handleAutoLaunchChange"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">关闭程序时</span>
              <span class="setting-desc">点击窗口关闭按钮时的行为</span>
            </div>
            <div class="setting-control">
              <el-select
                  v-model="closeAction"
                  size="default"
                  style="width: 140px;"
                  @change="handleCloseActionChange"
              >
                <el-option label="隐藏到托盘" value="minimize" />
                <el-option label="直接退出" value="exit" />
              </el-select>
            </div>
          </div>

        </div>

        <div class="profile-section" id="section-about">
          <h3 class="section-title">关于</h3>

          <div class="about-item">
            <span class="about-label">项目地址</span>
            <a class="about-link" @click.prevent="openProjectUrl">https://github.com/XueWerY/earth-survival-diary</a>
          </div>

          <div class="about-item">
            <span class="about-label">版本号</span>
            <span class="about-value">v{{ version }}</span>
            <el-button size="small" @click="checkForUpdate" :disabled="isGuideActive">检查更新</el-button>
            <el-button size="small" @click="openChangelogDialog" :disabled="isGuideActive">查看更新日志</el-button>
          </div>
          <div class="about-item about-tools-row">
            <el-button size="small" type="primary" @click="startGuide" :disabled="isGuideActive">新手引导</el-button>
            <el-button size="small" class="storage-btn storage-btn-normal" @click="handleViewLogs" :disabled="isGuideActive">查看日志</el-button>
          </div>
        </div>

        <div class="profile-section" id="section-storage">
          <h3 class="section-title">存储管理</h3>

          <div class="storage-list">
            <div class="storage-item">
              <div class="storage-item-info">
                <span class="storage-item-label">导出数据</span>
                <span class="storage-item-desc">选择模块导出为 JSON 文件</span>
              </div>
              <el-button class="storage-btn storage-btn-normal" @click="showExportDialog = true" :disabled="isGuideActive">
                导出
              </el-button>
            </div>
            <div class="storage-item">
              <div class="storage-item-info">
                <span class="storage-item-label">导入数据</span>
                <span class="storage-item-desc">从 JSON 文件导入数据</span>
              </div>
              <el-button class="storage-btn storage-btn-normal" @click="showImportDialog = true" :disabled="isGuideActive">
                导入
              </el-button>
            </div>
            <div class="storage-item">
              <div class="storage-item-info">
                <span class="storage-item-label">清空日志</span>
                <span class="storage-item-desc">{{ logFileSizeDesc }}</span>
              </div>
              <div class="storage-item-actions">
                <span class="switch-label">自动清理日志</span>
                <el-switch
                    v-model="autoCleanEnabled"
                    inline-prompt
                    size="small"
                    @change="handleAutoCleanChange"
                />
                <el-button class="storage-btn storage-btn-danger" @click="handleClearLogs" :loading="clearingLogs" :disabled="isGuideActive">
                  清空
                </el-button>
              </div>
            </div>
            <div v-if="autoCleanEnabled" class="auto-clean-setting">
              <span class="auto-clean-label">自动清理过去</span>
              <el-input-number
                  v-model="autoCleanDays"
                  :min="1"
                  :max="365"
                  :step="1"
                  size="small"
                  controls-position="right"
                  @change="handleAutoCleanDaysChange"
              />
              <span class="auto-clean-unit">天的日志</span>
            </div>
            <div class="storage-item">
              <div class="storage-item-info">
                <span class="storage-item-label">清理数据</span>
                <span class="storage-item-desc">数据文件共占用 {{ dataDirSizeDesc }}，按账号选择数据模块清理</span>
              </div>
              <el-button class="storage-btn storage-btn-danger" @click="handleOpenCleanWindow" :loading="cleaningData" :disabled="isGuideActive">
                清理
              </el-button>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 手机号绑定对话框 -->
    <el-dialog
        v-model="showPhoneDialog"
        title="绑定手机号"
        width="400px"
        :append-to-body="true"
    >
      <el-form :model="phoneForm" label-width="80px">
        <el-form-item label="手机号">
          <el-input v-model="phoneForm.phone" placeholder="请输入手机号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPhoneDialog = false">取消</el-button>
        <el-button type="primary" @click="savePhone">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改账号对话框 -->
    <el-dialog
        v-model="showEmailDialog"
        title="修改账号"
        width="400px"
        :append-to-body="true"
    >
      <el-form :model="emailForm" label-width="80px">
        <el-form-item label="新账号">
          <el-input v-model="emailForm.newEmail" placeholder="请输入新邮箱" />
        </el-form-item>
        <el-form-item label="当前密码">
          <el-input v-model="emailForm.password" type="password" placeholder="请输入当前密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEmailDialog = false">取消</el-button>
        <el-button type="primary" @click="changeEmail" :loading="changingEmail">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码对话框 -->
    <el-dialog
        v-model="showPasswordDialog"
        title="修改密码"
        width="400px"
        :append-to-body="true"
    >
      <el-form :model="passwordForm" label-width="100px">
        <el-form-item label="当前密码">
          <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码（至少6位）" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" @click="changePassword" :loading="changingPassword">确定</el-button>
      </template>
    </el-dialog>

    <!-- 导出数据对话框 -->
    <el-dialog
        v-model="showExportDialog"
        title="导出数据"
        width="450px"
        :append-to-body="true"
    >
      <div class="export-tree">
        <div class="select-all-row">
          <el-checkbox v-model="selectAllExportModules" @change="onSelectAllExportChange">全选</el-checkbox>
        </div>
        <div v-for="group in exportGroups" :key="group.key" class="export-group">
          <div class="group-header" @click="toggleGroup(group.key)">
            <span class="expand-icon">{{ expandedGroups.includes(group.key) ? '−' : '+' }}</span>
            <span class="group-label">{{ group.label }}</span>
          </div>
          <div v-show="expandedGroups.includes(group.key)" class="group-children">
            <div v-for="child in group.children" :key="child.key" class="child-item">
              <el-checkbox
                  v-model="selectedModules"
                  :label="child.key"
              >{{ child.label }}</el-checkbox>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleExport" :loading="exporting">导出</el-button>
      </template>
    </el-dialog>

    <!-- 导入数据对话框 -->
    <el-dialog
        v-model="showImportDialog"
        title="导入数据"
        width="450px"
        :append-to-body="true"
    >
      <div class="import-description">
        <div class="import-desc-header">
          <span class="import-desc-icon">⚠</span>
          <span class="import-desc-title">导入说明</span>
        </div>
        <p class="import-desc-text">请选择不包含邮箱标识的通用数据文件（earth-survival-diary-export-YYYY-MM-DD.json），导入将覆盖当前用户的对应数据。</p>
      </div>
      <div class="import-file-info" v-if="importFileInfo">
        <p>已选择文件: {{ importFileInfo.name }}</p>
        <p>导出时间: {{ formatExportTime(importFileInfo.exportTime) }}</p>
      </div>
      <div class="import-select-prompt" v-else>
        请选择文件
      </div>
      <div class="import-tree" v-if="importFileInfo">
        <div class="select-all-row">
          <el-checkbox v-model="selectAllModules" @change="onSelectAllChange">全选</el-checkbox>
        </div>
        <div v-for="group in importGroups" :key="group.key" class="import-group">
          <div class="group-header" @click="toggleImportGroup(group.key)">
            <span class="expand-icon">{{ expandedImportGroups.includes(group.key) ? '−' : '+' }}</span>
            <span class="group-label">{{ group.label }}</span>
          </div>
          <div v-show="expandedImportGroups.includes(group.key)" class="group-children">
            <div v-for="child in group.children" :key="child.key" class="child-item">
              <el-checkbox
                  v-model="selectedImportModules"
                  :label="child.key"
                  :disabled="!importDataAvailable[child.key]"
              >{{ child.label }} {{ !importDataAvailable[child.key] ? '(无数据)' : '' }}</el-checkbox>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeImportDialog">取消</el-button>
        <el-button @click="selectImportFile">选择文件</el-button>
        <el-button type="primary" @click="handleImport" :loading="importing" :disabled="!importDataRaw">导入</el-button>
      </template>
    </el-dialog>

    <div v-if="showChangelogDialog" class="changelog-panel">
      <div class="changelog-panel-header">
        <span class="changelog-panel-title">更新日志</span>
        <button class="changelog-panel-close" @click="showChangelogDialog = false">&times;</button>
      </div>
      <div class="changelog-panel-body" v-html="changelogHtml"></div>
    </div>

  </div>

  <Teleport to="body">
    <div v-if="showCustomBreakDialog" class="dialog-overlay" @click.self="showCustomBreakDialog = false">
      <div class="dialog-container custom-break-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">自由课间休息时长设置</span>
        </div>
        <div class="dialog-body">
          <div v-if="customBreakGaps.length === 0" class="custom-break-empty">课表节数不足，无需设置课间休息</div>
          <div v-for="(gap, idx) in customBreakGaps" :key="idx" class="custom-break-item">
            <span class="custom-break-label">{{ gap.label }}</span>
            <el-input-number
                v-model="customBreakDurationsDraft[idx]"
                :min="0"
                :max="60"
                :step="5"
                size="small"
                controls-position="right"
            />
          </div>
          <div class="form-footer" style="margin-top: 16px;">
            <button class="capsule-btn cancel-btn" @click="showCustomBreakDialog = false">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <span>取消</span>
            </button>
            <button class="capsule-btn submit-btn" @click="handleCustomBreakConfirm">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
              <span>确认</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick, inject } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Calendar, Lock, Timer, Setting, InfoFilled, Files, Bell, Monitor } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePageNav } from '../../composables/usePageNav'
import * as api from '../../lib/api'
import LunarDatePicker from '../common/picker/LunarDatePicker.vue'
import TimePickerPopover from '../common/picker/TimePickerPopover.vue'
import PeriodCountPicker from '../common/picker/PeriodCountPicker.vue'
import { logger } from '../../lib/logger'
import appVersion from 'virtual:version'
// @ts-expect-error - Vite raw import
import changelogContent from '../../../CHANGELOG.md?raw'

const emit = defineEmits<{
  logout: []
  profileUpdated: []
}>()

const startGuide = inject<() => void>('startGuide', () => {})
const isGuideActive = inject('guideVisible', ref(false))

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const pageNav = usePageNav()

const formRef = ref<FormInstance>()
const loggingOut = ref(false)
const deletingAccount = ref(false)
const exporting = ref(false)
const showExportDialog = ref(false)
const selectedModules = ref<string[]>(['user_index', 'tasks', 'focus_favorites', 'focus_records', 'lists', 'countdown', 'courses', 'profile', 'login_info', 'settings', 'system_state'])
const expandedGroups = ref<string[]>(['tasks', 'focus', 'lists', 'countdown', 'courses', 'profile'])
const selectAllExportModules = ref(true)

const allExportModuleKeys = computed(() => {
  const keys: string[] = []
  exportGroups.forEach(group => {
    group.children.forEach(child => keys.push(child.key))
  })
  return keys
})

const onSelectAllExportChange = (checked: boolean) => {
  if (checked) {
    selectedModules.value = allExportModuleKeys.value
  } else {
    selectedModules.value = []
  }
}

const exportGroups = [
  {
    key: 'tasks',
    label: '足迹',
    children: [
      { key: 'tasks', label: '足迹记录' }
    ]
  },
  {
    key: 'focus',
    label: '专注',
    children: [
      { key: 'focus_favorites', label: '常用专注' },
      { key: 'focus_records', label: '专注记录' }
    ]
  },
  {
    key: 'lists',
    label: '清单',
    children: [
      { key: 'lists', label: '清单列表及其任务' }
    ]
  },
  {
    key: 'countdown',
    label: '倒数日',
    children: [
      { key: 'countdown', label: '倒数日分类及其倒数日' }
    ]
  },
  {
    key: 'courses',
    label: '课程表',
    children: [
      { key: 'courses', label: '课程' }
    ]
  },
  {
    key: 'profile',
    label: '我的',
    children: [
      { key: 'user_index', label: '账户信息' },
      { key: 'profile', label: '我的' },
      { key: 'login_info', label: '登录信息' },
      { key: 'settings', label: '设置' },
      { key: 'system_state', label: '系统状态' }
    ]
  }
]

// 导出复选框对应的实际服务端 key
const exportKeyMapping: Record<string, string[]> = {
  lists: ['lists', 'missions'],
  countdown: ['countdown_categories', 'countdowns'],
  courses: ['courses', 'course_recorded_courses']
}

const toggleGroup = (key: string) => {
  const idx = expandedGroups.value.indexOf(key)
  if (idx >= 0) {
    expandedGroups.value.splice(idx, 1)
  } else {
    expandedGroups.value.push(key)
  }
}

// 导入相关状态
const showImportDialog = ref(false)
const importing = ref(false)
const importDataRaw = ref<any>(null)
const importFileInfo = ref<{ name: string, exportTime?: string } | null>(null)
const selectedImportModules = ref<string[]>(['user_index', 'tasks', 'focus_favorites', 'focus_records', 'lists', 'countdown', 'courses', 'profile', 'login_info', 'settings', 'system_state'])
const expandedImportGroups = ref<string[]>(['tasks', 'focus', 'lists', 'countdown', 'courses', 'profile'])
const selectAllModules = ref(true)

const importGroups = exportGroups

const importKeyMapping = exportKeyMapping

const allImportModuleKeys = computed(() => {
  const keys: string[] = []
  importGroups.forEach(group => {
    group.children.forEach(child => keys.push(child.key))
  })
  return keys
})

const importDataAvailable = computed(() => {
  const available: Record<string, boolean> = {}
  Object.keys(importKeyMapping).forEach(key => {
    const keys = importKeyMapping[key]
    available[key] = keys.some(k => importDataRaw.value && importDataRaw.value[k] !== undefined && importDataRaw.value[k] !== null)
  })
  importGroups.forEach(group => {
    group.children.forEach(child => {
      if (!importKeyMapping[child.key]) {
        available[child.key] = importDataRaw.value && importDataRaw.value[child.key] !== undefined && importDataRaw.value[child.key] !== null
      }
    })
  })
  return available
})

const toggleImportGroup = toggleGroup

const onSelectAllChange = (checked: boolean) => {
  if (checked) {
    selectedImportModules.value = allImportModuleKeys.value.filter(key => importDataAvailable.value[key])
  } else {
    selectedImportModules.value = []
  }
}

const formatExportTime = (time?: string) => {
  if (!time) return '未知'
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const closeImportDialog = () => {
  showImportDialog.value = false
  importDataRaw.value = null
  importFileInfo.value = null
  selectedImportModules.value = ['user_index', 'tasks', 'focus_favorites', 'focus_records', 'lists', 'countdown', 'courses', 'notebooks', 'profile', 'login_info', 'settings', 'system_state']
  selectAllModules.value = true
}

const selectImportFile = async () => {
  const filePath = await window.electronAPI.openFileDialog({
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })

  if (!filePath) return

  // 只允许不包含邮箱标识的文件
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || ''
  if (fileName.includes('@')) {
    ElMessage.error('只能导入不包含邮箱标识的通用数据文件')
    return
  }

  try {
    const content = await window.electronAPI.readFile(filePath)
    if (!content) {
      ElMessage.error('读取文件失败')
      return
    }

    const data = JSON.parse(content)
    importDataRaw.value = data
    importFileInfo.value = {
      name: fileName,
      exportTime: data.exportTime || '未知'
    }
    selectedImportModules.value = allImportModuleKeys.value.filter(key => importDataAvailable.value[key])
    selectAllModules.value = selectedImportModules.value.length > 0
  } catch (e) {
    console.error('解析导入文件失败:', e)
    ElMessage.error('文件格式错误')
  }
}

const handleImport = async () => {
  if (!importDataRaw.value) {
    ElMessage.warning('请先选择导入文件')
    return
  }

  if (selectedImportModules.value.length === 0) {
    ElMessage.warning('请至少选择一个模块')
    return
  }

  try {
    await ElMessageBox.confirm(
      '导入将覆盖当前用户的对应数据，此操作不可恢复！\n确定要导入吗？',
      '导入确认',
      {
        type: 'warning',
        confirmButtonText: '确定导入',
        cancelButtonText: '取消'
      }
    )

    importing.value = true

    const importObj: any = {}
    selectedImportModules.value.forEach(key => {
      const keys = importKeyMapping[key] || [key]
      keys.forEach(k => {
        if (importDataRaw.value[k] !== undefined) {
          importObj[k] = importDataRaw.value[k]
        }
      })
    })

    await api.importData(importObj)

    logger.info('[我的] 导入数据成功，准备重启应用', { modules: selectedImportModules.value })
    ElMessage.success('导入成功')

    // 导入成功后重启应用
    setTimeout(async () => {
      await window.electronAPI.restartApp()
    }, 500)
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error('导入数据失败:', err)
      ElMessage.error(err?.response?.data?.error || '导入数据失败')
    }
  } finally {
    importing.value = false
  }
}
const showPhoneDialog = ref(false)
const showEmailDialog = ref(false)
const showPasswordDialog = ref(false)
const changingEmail = ref(false)
const changingPassword = ref(false)

const form = reactive({
  nickname: authStore.profile?.nickname || '',
  birthday: authStore.profile?.birthday || '',
  phone: authStore.profile?.phone || ''
})

const phoneForm = reactive({
  phone: ''
})

const emailForm = reactive({
  newEmail: '',
  password: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const focusSettings = ref({
  pomodoroDuration: 25
})

const courseSettings = ref({
  semesterStartDate: '',
  totalWeeks: 20,
  reminderMinutes: 5,
  firstPeriodStart: '08:00',
  periodDuration: 45,
  breakDuration: 10,
  breakMode: 'uniform' as 'uniform' | 'custom',
  customBreakDurations: [] as number[],
  lunchBreakMinutes: 120,
  dinnerBreakMinutes: 90,
  showWeekend: true,
  showNonCurrentWeekCourses: true,
  periodCountPerSession: {
    morning: 4,
    afternoon: 4,
    evening: 2
  }
})

const autoLaunch = ref(false)
const closeAction = ref('minimize')

const loadSystemSettings = async () => {
  if (window.electronAPI) {
    autoLaunch.value = await window.electronAPI.getAutoLaunch()
    closeAction.value = await window.electronAPI.getCloseAction() || 'minimize'
  }
}

const handleAutoLaunchChange = async (val: boolean) => {
  if (window.electronAPI) {
    await window.electronAPI.setAutoLaunch(val)
    logger.info('[设置] 修改开机自启动', { enabled: val })
  }
}

const handleCloseActionChange = async (val: string) => {
  if (window.electronAPI) {
    await window.electronAPI.setCloseAction(val)
    logger.info('[设置] 修改关闭程序行为', { action: val })
  }
}

const version = ref(appVersion.replace('-', '.'))

const logFileSizeDesc = ref('加载...')
const dataDirSizeDesc = ref('加载...')
const clearingLogs = ref(false)
const cleaningData = ref(false)
const autoCleanEnabled = ref((settingsStore.settings as any)?.autoClean?.enabled ?? false)
const autoCleanDays = ref((settingsStore.settings as any)?.autoClean?.days ?? 30)

const loadSizes = async () => {
  try {
    if (window.electronAPI) {
      const logSize = await window.electronAPI.getLogDirSize()
      logFileSizeDesc.value = logSize.size > 0 ? formatSize(logSize.size) : '暂无日志文件'
      const dataSize = await window.electronAPI.getDataDirSize()
      dataDirSizeDesc.value = formatSize(dataSize.size)
      console.log('[ProfilePage] loadSizes 完成', { logBytes: logSize.size, logDesc: logFileSizeDesc.value, dataBytes: dataSize.size, dataDesc: dataDirSizeDesc.value })
    } else {
      logFileSizeDesc.value = '仅 Electron 可用'
      dataDirSizeDesc.value = '仅 Electron 可用'
    }
  } catch (e) {
    console.error('[ProfilePage] loadSizes 失败', e)
    logFileSizeDesc.value = '获取失败'
    dataDirSizeDesc.value = '获取失败'
  }
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const handleViewLogs = async () => {
  logger.info('[我的] 查看日志')
  try {
    const content = await window.electronAPI.getLogContent()
    window.electronAPI?.openLogViewer?.(content)
    ElMessage.success('日志查看器已打开')
  } catch (e) {
    logger.error('[我的] 打开日志失败', { error: e instanceof Error ? e.message : String(e) })
    ElMessage.error('打开日志失败')
  }
}

const handleClearLogs = async () => {
  try {
    await ElMessageBox.confirm('确定要清空当前日志文件吗？', '清空确认', { type: 'warning' })
    clearingLogs.value = true
    logger.info('[我的] 清空日志')
    await window.electronAPI.clearLogs()
    await loadSizes()
    ElMessage.success('日志已清空')
  } catch (err: any) {
    if (err !== 'cancel') {
      logger.error('[我的] 清空日志失败', { error: err instanceof Error ? err.message : String(err) })
    }
  } finally {
    clearingLogs.value = false
  }
}

const checkForUpdate = async () => {
  if (!window.electronAPI?.checkForUpdate) return
  try {
    const result = await window.electronAPI.checkForUpdate()
    logger.info('[关于] 检查更新结果', result)
  } catch (e) {
    logger.error('[关于] 检查更新失败', { error: e instanceof Error ? e.message : String(e) })
  }
}

const showChangelogDialog = ref(false)

const showCustomBreakDialog = ref(false)
const customBreakDurationsDraft = ref<number[]>([])

const customBreakGaps = computed(() => {
  const counts = courseSettings.value.periodCountPerSession
  const gaps: { label: string }[] = []
  let absFrom = 1

  const addGaps = (count: number) => {
    if (count <= 0) return
    const end = absFrom + count - 1
    while (absFrom < end) {
      gaps.push({ label: `第${absFrom}节→第${absFrom + 1}节` })
      absFrom++
    }
    absFrom++
  }

  addGaps(counts.morning)
  addGaps(counts.afternoon)
  addGaps(counts.evening)

  return gaps
})

watch(showCustomBreakDialog, (val) => {
  if (val) {
    const existing = courseSettings.value.customBreakDurations
    const gapCount = customBreakGaps.value.length
    customBreakDurationsDraft.value = Array.from(
      { length: gapCount },
      (_, i) => (existing && i < existing.length ? existing[i] : null) ?? courseSettings.value.breakDuration
    )
  }
})

const handleCustomBreakConfirm = async () => {
  await settingsStore.updateCourseSettings({
    customBreakDurations: [...customBreakDurationsDraft.value]
  })
  courseSettings.value.customBreakDurations = [...customBreakDurationsDraft.value]
  showCustomBreakDialog.value = false
  logger.info('[设置] 修改自定义课间休息时长', { customBreakDurations: customBreakDurationsDraft.value })
}

const changelogHtml = computed(() => {
  const content = changelogContent.replace(/^# 更新日志\n*/, '')
  const lines = content.split('\n')
  let html = ''
  let inList = false
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false }
      html += `<h3 class="cl-version">${line.slice(4)}</h3>`
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul class="cl-list">'; inList = true }
      html += `<li>${line.slice(2)}</li>`
    } else if (!line.trim()) {
      if (inList) { html += '</ul>'; inList = false }
    }
  }
  if (inList) html += '</ul>'
  return html
})

const openChangelogDialog = () => {
  showChangelogDialog.value = true
}

const openProjectUrl = () => {
  window.electronAPI?.openExternal('https://github.com/XueWerY/earth-survival-diary')
}

const currentWeekNumber = computed(() => {
  if (!courseSettings.value.semesterStartDate) return 1
  const startDate = dayjs(courseSettings.value.semesterStartDate)
  const today = dayjs()
  const diff = today.diff(startDate, 'week')
  return Math.max(1, diff + 1)
})

const rules: FormRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 20, message: '昵称最多20个字符', trigger: 'blur' }
  ]
}

// 格式化创建时间
const formatCreatedAt = () => {
  const createdAt = authStore.profile?.created_at || (authStore.user as any)?.createdAt || (authStore.user as any)?.created_at
  if (!createdAt) return '未知'
  return dayjs(createdAt).format('YYYY-MM-DD HH:mm')
}

// 遮蔽邮箱
const maskEmail = (email: string | undefined) => {
  if (!email) return '未知'
  const [name, domain] = email.split('@')
  if (!domain) return email
  const maskedName = name.length > 2
      ? name[0] + '***' + name[name.length - 1]
      : name[0] + '***'
  return `${maskedName}@${domain}`
}

const savePhone = async () => {
  if (!phoneForm.phone.trim()) {
    ElMessage.warning('请输入手机号')
    return
  }
  form.phone = phoneForm.phone
  showPhoneDialog.value = false
  try {
    await api.updateProfile({ phone: form.phone })
    ;(authStore.profile as any) = { ...authStore.profile, phone: form.phone }
    logger.info('[我的] 修改手机号')
    ElMessage.success('手机号已保存')
  } catch (error) {
    console.error('保存手机号失败:', error)
    ElMessage.error('保存失败')
  }
}

// 修改账号
const changeEmail = async () => {
  if (!emailForm.newEmail.trim()) {
    ElMessage.warning('请输入新邮箱')
    return
  }
  if (!emailForm.password.trim()) {
    ElMessage.warning('请输入当前密码')
    return
  }

  changingEmail.value = true
  try {
    await api.changeEmail(emailForm.newEmail, emailForm.password)
    if (authStore.user) {
      authStore.user.email = emailForm.newEmail
    }
    logger.info('[我的] 修改账号', { oldEmail: authStore.user?.email, newEmail: emailForm.newEmail })
    showEmailDialog.value = false
    emailForm.newEmail = ''
    emailForm.password = ''
    ElMessage.success('账号修改成功')
  } catch (error: any) {
    console.error('修改账号失败:', error)
    ElMessage.error(error?.response?.data?.error || '修改账号失败')
  } finally {
    changingEmail.value = false
  }
}

// 修改密码
const changePassword = async () => {
  if (!passwordForm.oldPassword.trim()) {
    ElMessage.warning('请输入当前密码')
    return
  }
  if (!passwordForm.newPassword.trim()) {
    ElMessage.warning('请输入新密码')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少6位')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  changingPassword.value = true
  try {
    await api.changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    logger.info('[我的] 修改密码')
    showPasswordDialog.value = false
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    ElMessage.success('密码修改成功')
  } catch (error: any) {
    console.error('修改密码失败:', error)
    ElMessage.error(error?.response?.data?.error || '修改密码失败')
  } finally {
    changingPassword.value = false
  }
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
      type: 'warning'
    })

    loggingOut.value = true
    logger.info('[我的] 退出登录')
    await authStore.signOut()
    if (window.electronAPI) {
      await window.electronAPI.restartApp()
    } else {
      emit('logout')
    }
  } catch {
  } finally {
    loggingOut.value = false
  }
}

const handleDeleteAccount = async () => {
  try {
    await ElMessageBox.confirm(
      '注销账号将永久删除您的所有数据，此操作不可恢复！\n确定要注销吗？',
      '注销确认',
      {
        type: 'warning',
        confirmButtonText: '确定注销',
        cancelButtonText: '取消'
      }
    )

    deletingAccount.value = true
    logger.info('[我的] 注销账号')
    await api.deleteAccount()
    await authStore.signOut()
    logger.info('[我的] 注销成功')
    if (window.electronAPI) {
      await window.electronAPI.restartApp()
    } else {
      emit('logout')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error('注销账号失败:', err)
      ElMessage.error(err?.response?.data?.error || '注销账号失败')
    }
  } finally {
    deletingAccount.value = false
  }
}

const handleExport = async () => {
  if (selectedModules.value.length === 0) {
    ElMessage.warning('请至少选择一个模块')
    return
  }

  exporting.value = true
  try {
    const { data } = await api.exportData()
    const exportObj: any = { exportTime: new Date().toISOString() }
    selectedModules.value.forEach(key => {
      const keys = exportKeyMapping[key] || [key]
      keys.forEach(k => {
        if (data[k] !== undefined) exportObj[k] = data[k]
      })
    })

    const includeEmail = selectedModules.value.includes('user_index')
    const emailSuffix = includeEmail && authStore.user?.email
      ? `-${authStore.user.email}`
      : ''
    const filePath = await window.electronAPI.saveFileDialog({
      defaultPath: `earth-survival-diary-export${emailSuffix}-${new Date().toISOString().slice(0, 10)}.json`
    })

    if (!filePath) {
      ElMessage.info('已取消保存')
      return
    }

    const success = await window.electronAPI.writeFile(filePath, JSON.stringify(exportObj, null, 2))
    if (!success) {
      ElMessage.error('写入文件失败')
      return
    }

    logger.info('[我的] 导出数据', { modules: selectedModules.value, filePath })
    ElMessage.success('导出成功')
    showExportDialog.value = false
  } catch (err: any) {
    console.error('导出数据失败:', err)
    ElMessage.error(err?.response?.data?.error || '导出数据失败')
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  if (pageNav.navPath.value.length === 0) {
    pageNav.setNavPath(['profile'])
  }
  pageNav.setNavContext({
    segments: [],
    plusVisible: false,
    plusOnClick: null,
    goModuleHome: () => { pageNav.setNavPath(['profile']) }
  })

  if (authStore.profile) {
    form.birthday = authStore.profile.birthday || ''
    form.phone = authStore.profile.phone || ''
    phoneForm.phone = authStore.profile.phone || ''
  }

  focusSettings.value.pomodoroDuration = settingsStore.settings.focus?.pomodoroDuration || 25
  courseSettings.value.semesterStartDate = settingsStore.settings.course?.semesterStartDate || ''
  courseSettings.value.totalWeeks = settingsStore.settings.course?.totalWeeks || 20
  courseSettings.value.reminderMinutes = settingsStore.settings.course?.reminderMinutes || 5
  courseSettings.value.firstPeriodStart = settingsStore.settings.course?.firstPeriodStart || '08:00'
  courseSettings.value.periodDuration = settingsStore.settings.course?.periodDuration || 45
  courseSettings.value.breakDuration = settingsStore.settings.course?.breakDuration || 10
  courseSettings.value.breakMode = settingsStore.settings.course?.breakMode || 'uniform'
  courseSettings.value.customBreakDurations = settingsStore.settings.course?.customBreakDurations || []
  courseSettings.value.lunchBreakMinutes = settingsStore.settings.course?.lunchBreakMinutes ?? 120
  courseSettings.value.dinnerBreakMinutes = settingsStore.settings.course?.dinnerBreakMinutes ?? 90
  courseSettings.value.showWeekend = settingsStore.settings.course?.showWeekend !== false
  courseSettings.value.showNonCurrentWeekCourses = settingsStore.settings.course?.showNonCurrentWeekCourses !== false
  courseSettings.value.periodCountPerSession = settingsStore.settings.course?.periodCountPerSession || { morning: 4, afternoon: 4, evening: 2 }

  loadSystemSettings()
  loadSizes()

  nextTick(() => {
    initProfileNavDrag()
    centerNavActive()
  })
  window.addEventListener('resize', () => {
    scrollingLock = true
    centerNavActive()
    setTimeout(() => { scrollingLock = false }, 400)
  })
})

// 导航栏相关

const navItems = [
  { key: 'profile', name: '个人信息', id: 'section-profile', icon: Calendar },
  { key: 'security', name: '账号安全', id: 'section-security', icon: Lock },
  { key: 'focus', name: '专注设置', id: 'section-focus', icon: Timer },
  { key: 'course', name: '课程表设置', id: 'section-course', icon: Setting },
  { key: 'system', name: '系统设置', id: 'section-system', icon: Monitor },
  { key: 'about', name: '关于', id: 'section-about', icon: InfoFilled },
  { key: 'storage', name: '存储管理', id: 'section-storage', icon: Files }
]

const activeNavKey = ref('profile')
const profileNavRef = ref<HTMLElement>()
const profileScrollbarRef = ref()
const profileNavItemRefs = ref<HTMLElement[]>([])

const setProfileNavItemRef = (el: HTMLElement | null) => {
  if (el) profileNavItemRefs.value.push(el)
}

const centerNavActive = () => {
  const wrapper = profileNavRef.value
  if (!wrapper) return
  const inner = wrapper.querySelector('.profile-nav-inner') as HTMLElement
  if (!inner) return

  const wrapperWidth = wrapper.clientWidth
  const innerWidth = inner.scrollWidth

  if (innerWidth <= wrapperWidth) {
    inner.style.marginLeft = ((wrapperWidth - innerWidth) / 2) + 'px'
    wrapper.scrollLeft = 0
    return
  }

  inner.style.marginLeft = '0'
  const idx = navItems.findIndex(item => item.key === activeNavKey.value)
  if (idx < 0) return
  const activeEl = profileNavItemRefs.value[idx]
  if (!activeEl) return
  const visibleWidth = wrapperWidth - 32
  const maxScroll = Math.max(0, innerWidth - visibleWidth)
  const target = activeEl.offsetLeft - (visibleWidth - activeEl.offsetWidth) / 2
  wrapper.scrollTo({ left: Math.max(0, Math.min(target, maxScroll)), behavior: 'smooth' })
}

let scrollingLock = false

const scrollToSection = (key: string, domId: string) => {
  activeNavKey.value = key
  nextTick(() => centerNavActive())
  const el = document.getElementById(domId)
  if (!el) return
  const scrollbarEl = profileScrollbarRef.value?.$el?.querySelector('.el-scrollbar__wrap')
  if (scrollbarEl) {
    scrollingLock = true
    scrollbarEl.scrollTo({ top: el.offsetTop - 10, behavior: 'smooth' })
    setTimeout(() => { scrollingLock = false }, 600)
  }
}

const handleProfileScroll = () => {
  if (scrollingLock) return
  const scrollbarEl = profileScrollbarRef.value?.$el?.querySelector('.el-scrollbar__wrap')
  if (!scrollbarEl) return
  const sections = navItems.map(item => ({ key: item.key, el: document.getElementById(item.id) }))
    .filter(s => s.el)
  let currentKey = 'profile'
  for (const section of sections) {
    if (section.el && section.el.offsetTop <= scrollbarEl.scrollTop + 60) {
      currentKey = section.key
    }
  }
  const last = sections[sections.length - 1]
  if (last && last.el && last.el.offsetTop + last.el.offsetHeight <= scrollbarEl.scrollTop + scrollbarEl.offsetHeight) {
    currentKey = last.key
  }
  activeNavKey.value = currentKey
}

let isProfileDragging = false
let profileDragStartX = 0
let profileDragStartScrollLeft = 0

const initProfileNavDrag = () => {
  const el = profileNavRef.value
  if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => {
    const inner = el.querySelector('.profile-nav-inner') as HTMLElement
    if (inner && inner.scrollWidth <= el.clientWidth) return
    isProfileDragging = false
    profileDragStartX = e.pageX
    profileDragStartScrollLeft = el.scrollLeft
    const onMove = (ev: MouseEvent) => {
      const diff = ev.pageX - profileDragStartX
      if (Math.abs(diff) > 3) isProfileDragging = true
      el.scrollLeft = profileDragStartScrollLeft - diff
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
  el.addEventListener('click', (e: MouseEvent) => {
    if (isProfileDragging) { e.preventDefault(); e.stopPropagation(); isProfileDragging = false }
  }, true)
}

// 清理数据子窗口
const handleOpenCleanWindow = async () => {
  if (!window.electronAPI) {
    ElMessage.warning('仅 Electron 环境可用')
    return
  }

  try {
    cleaningData.value = true
    logger.info('[我的] 打开清理数据窗口')

    const moduleSizes = await window.electronAPI.getModuleSizes()
    if (!moduleSizes.users || moduleSizes.users.length === 0) {
      ElMessage.info('暂无用户数据')
      cleaningData.value = false
      return
    }

    const result = await window.electronAPI.openCleanDataWindow({
      users: moduleSizes.users,
      totalDataSize: moduleSizes.totalDataSize,
      moduleGroups: moduleSizes.moduleGroups
    })

    if (!result) {
      logger.info('[我的] 取消清理数据')
      return
    }

    if (result.deleteAll) {
      logger.info('[我的] 清空全部应用数据')
      await api.clearAllData()
      ElMessage.success('全部数据已清空')
    } else if (result.modules.length > 0) {
      logger.info('[我的] 清理数据', { modules: result.modules })
      const cleanObj: any = {}
      result.modules.forEach(key => {
        const keys = cleanKeyMapping[key] || [key]
        keys.forEach(k => { cleanObj[k] = null })
      })
      await api.cleanData(cleanObj)
      ElMessage.success('清理成功')
    } else {
      ElMessage.warning('请至少选择一个模块')
      return
    }

    loadSizes()

    setTimeout(async () => {
      await window.electronAPI.restartApp()
    }, 500)
  } catch (err: any) {
    console.error('[ProfilePage] 清理数据失败:', err)
    ElMessage.error(err?.response?.data?.error || '清理数据失败')
  } finally {
    cleaningData.value = false
  }
}

const cleanKeyMapping: Record<string, string[]> = {
  lists: ['lists', 'missions'],
  countdown: ['countdown_categories', 'countdowns'],
  courses: ['courses', 'course_recorded_courses']
}

// 自动清理日志
const handleAutoCleanChange = async (val: boolean) => {
  try {
    await api.updateSettings({ autoClean: { enabled: val, days: autoCleanDays.value } } as any)
    logger.info('[我的] 设置自动清理日志', { enabled: val, days: autoCleanDays.value })
  } catch (e) {
    console.error('[ProfilePage] 保存自动清理设置失败:', e)
  }
}

const handleAutoCleanDaysChange = async (val: number) => {
  try {
    await api.updateSettings({ autoClean: { enabled: autoCleanEnabled.value, days: val } } as any)
    logger.info('[我的] 设置自动清理天数', { days: val })
  } catch (e) {
    console.error('[ProfilePage] 保存自动清理天数失败:', e)
  }
}

watch(() => authStore.profile?.nickname, (val) => {
  if (val) form.nickname = val
}, { immediate: true })

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

const autoSaveProfile = async () => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(async () => {
    try {
      const nickname = form.nickname || ''
      const birthday = form.birthday || ''
      await api.updateProfile({ nickname, birthday })
      ;(authStore.profile as any) = { ...authStore.profile, nickname, birthday }
      if (form.birthday) {
        emit('profileUpdated')
      }
      logger.info('[我的] 个人资料自动保存')
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }, 800)
}

watch(() => form.nickname, () => {
  autoSaveProfile()
})

watch(() => form.birthday, () => {
  autoSaveProfile()
})

const handleFocusSettingChange = async (val: number) => {
  await settingsStore.updateFocusSettings({ pomodoroDuration: val })
  logger.info('[设置] 修改专注时长', { pomodoroDuration: val })
}

const handleCourseSettingChange = async (val: string) => {
  await settingsStore.updateCourseSettings({ semesterStartDate: val })
  logger.info('[设置] 修改开学日期', { semesterStartDate: val })
}

const handleCourseWeeksChange = async (val: number) => {
  await settingsStore.updateCourseSettings({ totalWeeks: val })
  logger.info('[设置] 修改学期周数', { totalWeeks: val })
}

const handleCourseReminderChange = async (val: number) => {
  await settingsStore.updateCourseSettings({ reminderMinutes: val })
  logger.info('[设置] 修改课程提醒', { reminderMinutes: val })
}

const handleCourseFirstPeriodStartChange = async (val: string) => {
  await settingsStore.updateCourseSettings({ firstPeriodStart: val })
  logger.info('[设置] 修改第1节开始时间', { firstPeriodStart: val })
}

const handleCoursePeriodDurationChange = async (val: number) => {
  await settingsStore.updateCourseSettings({ periodDuration: val })
  logger.info('[设置] 修改每节时长', { periodDuration: val })
}

const handleCourseBreakDurationChange = async (val: number) => {
  await settingsStore.updateCourseSettings({ breakDuration: val })
  logger.info('[设置] 修改课间休息时长', { breakDuration: val })
}

const handleCourseBreakModeChange = async (val: string) => {
  await settingsStore.updateCourseSettings({ breakMode: val as 'uniform' | 'custom' })
  courseSettings.value.breakMode = val as 'uniform' | 'custom'
  logger.info('[设置] 修改课间休息模式', { breakMode: val })
}

const handleCourseLunchBreakChange = async (val: number) => {
  await settingsStore.updateCourseSettings({ lunchBreakMinutes: val })
  logger.info('[设置] 修改午休时长', { lunchBreakMinutes: val })
}

const handleCourseDinnerBreakChange = async (val: number) => {
  await settingsStore.updateCourseSettings({ dinnerBreakMinutes: val })
  logger.info('[设置] 修改晚休时长', { dinnerBreakMinutes: val })
}

const handleCourseShowWeekendChange = async (val: boolean) => {
  await settingsStore.updateCourseSettings({ showWeekend: val })
  logger.info('[设置] 修改显示周末', { showWeekend: val })
}

const handleCourseShowNonCurrentWeekChange = async (val: boolean) => {
  await settingsStore.updateCourseSettings({ showNonCurrentWeekCourses: val })
  logger.info('[设置] 修改显示非本周课程', { showNonCurrentWeekCourses: val })
}

const handlePeriodCountChange = async (val: { morning: number; afternoon: number; evening: number }) => {
  courseSettings.value.periodCountPerSession = val
  await settingsStore.updateCourseSettings({ periodCountPerSession: val })
  logger.info('[设置] 修改课表节数设置', val)
}
</script>

<style scoped>
.profile-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  justify-content: center;
}

.profile-nav-wrapper {
  overflow: hidden;
  padding: 12px 16px;
  -webkit-user-select: none;
  user-select: none;
  flex-shrink: 0;
}

.profile-nav-inner {
  display: inline-flex;
  gap: 8px;
  white-space: nowrap;
}

.profile-nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  flex-shrink: 0;
}

.profile-nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.profile-nav-item.active {
  background: rgba(102, 126, 234, 0.25);
  color: #667eea;
}

.nav-icon {
  font-size: 14px;
}

.nav-name {
  white-space: nowrap;
}

.profile-content {
  flex: 1;
  overflow: hidden;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 840px) {
  .profile-content {
    max-width: none;
  }
}

.profile-section {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 20px 0;
}

.profile-form {
  max-width: 400px;
}

:deep(.el-form-item__label) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: none !important;
}

:deep(.el-input__inner) {
  color: white !important;
}

:deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.3) !important;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.02) !important;
}

:deep(.el-input.is-disabled .el-input__inner) {
  color: rgba(255, 255, 255, 0.5) !important;
}

:deep(.el-date-editor) {
  --el-date-editor-width: 100% !important;
}

:deep(.el-date-editor .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.security-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.security-item:last-child {
  border-bottom: none;
}

.security-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.security-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.security-value {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
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

.course-reminder-item {
  margin-top: 16px;
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

.setting-control-break {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.break-mode-toggle {
  flex-shrink: 0;
}

.setting-break-input {
  flex-shrink: 0;
}

.setting-break-custom-btn {
  flex-shrink: 0;
}

.custom-break-dialog {
  max-width: 360px;
}

.custom-break-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.custom-break-item:last-child {
  border-bottom: none;
}

.custom-break-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
}

.custom-break-empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  padding: 16px 0;
}

.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.dialog-container { background: rgba(30,28,52,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }

.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 0; flex-shrink: 0; }
.dialog-header-title { font-size: 16px; font-weight: 600; color: var(--chalk-white); }
.folder-dialog-header { justify-content: center; }
.folder-dialog-title { text-align: center; }
.dialog-body { padding: 12px 16px 16px; overflow-y: auto; flex: 1; scrollbar-width: none; -ms-overflow-style: none; }
.dialog-body::-webkit-scrollbar { display: none; }

.form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
.capsule-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 18px; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; background: transparent; color: var(--chalk-white-70); cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.2s; }
.capsule-btn:hover { background: rgba(255,255,255,0.08); color: var(--chalk-white); }
.capsule-btn .capsule-icon { width: 14px; height: 14px; }
.submit-btn { background: rgba(102,126,234,0.2); border-color: rgba(102,126,234,0.4); color: #93c5fd; }
.submit-btn:hover { background: rgba(102,126,234,0.35); color: var(--chalk-white); }

.setting-tip {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  color: #667eea;
  font-size: 13px;
}

.about-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  gap: 12px;
}

.about-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  width: 60px;
  flex-shrink: 0;
}

.about-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.about-tools-row {
  display: flex;
  gap: 8px;
  justify-content: flex-start;
  margin-top: 8px;
}

.about-link {
  font-size: 13px;
  color: #6496ff;
  cursor: pointer;
  text-decoration: none;
}

.about-link:hover {
  text-decoration: underline;
}

.security-actions {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  margin-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.storage-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.storage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  gap: 16px;
}

.storage-item-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* 存储管理按钮样式 */
.storage-btn {
  border: none !important;
  border-radius: 6px !important;
  padding: 8px 18px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  color: #fff !important;
  transition: all 0.2s ease !important;
  flex-shrink: 0;
}

.storage-btn-normal {
  background: linear-gradient(135deg, #4facfe, #667eea) !important;
}
.storage-btn-normal:hover {
  background: linear-gradient(135deg, #63baff, #7b93f5) !important;
  box-shadow: 0 2px 12px rgba(79, 172, 254, 0.4) !important;
}

.storage-btn-danger {
  background: linear-gradient(135deg, #f5576c, #ff6b6b) !important;
}
.storage-btn-danger:hover {
  background: linear-gradient(135deg, #f76d7f, #ff8585) !important;
  box-shadow: 0 2px 12px rgba(245, 87, 108, 0.4) !important;
}

.switch-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

/* 自动清理日志设置 */
.auto-clean-setting {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px 12px 16px;
  margin-top: -4px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.auto-clean-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.auto-clean-unit {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.storage-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.storage-item-label {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.storage-item-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

:deep(.el-button--danger) {
  background: rgba(239, 68, 68, 0.2) !important;
  border-color: rgba(239, 68, 68, 0.4) !important;
  color: #ef4444 !important;
}

:deep(.el-button--danger:hover) {
  background: rgba(239, 68, 68, 0.3) !important;
}

:deep(.el-input__count),
:deep(.el-input__count-inner) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.4) !important;
}

/* 导出对话框样式 */
.export-tree {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.select-all-row {
  padding: 4px 0 8px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;
}

.select-all-row :deep(.el-checkbox__label) {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.export-group {
  margin-bottom: 8px;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}

.group-header:hover {
  background: rgba(255, 255, 255, 0.08);
}

.expand-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.85);
  margin-right: 8px;
}

.group-label {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.group-children {
  padding: 8px 0 8px 28px;
}

.child-item {
  padding: 4px 0;
}

.child-item :deep(.el-checkbox__label) {
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
}

.child-item :deep(.el-checkbox.is-checked .el-checkbox__label) {
  color: #8ab4f8;
}

/* 导入对话框样式 */
.import-description {
  margin-bottom: 16px;
}

.import-desc-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.import-desc-icon {
  color: #e6a23c;
  font-size: 16px;
}

.import-desc-title {
  color: #e6a23c;
  font-size: 14px;
  font-weight: 500;
}

.import-desc-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.import-file-info p {
  margin: 4px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.import-select-prompt {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  padding: 20px 0;
  font-size: 14px;
}

.import-tree {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
}

.import-group {
  margin-bottom: 8px;
}

.changelog-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 3000;
  width: 480px;
  max-height: 55vh;
  background: rgba(20, 16, 55, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  animation: changelogSlideIn 0.3s ease-out;
}

@keyframes changelogSlideIn {
  from { opacity: 0; transform: translateY(20px) translateX(20px); }
  to { opacity: 1; transform: translateY(0) translateX(0); }
}

.changelog-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.changelog-panel-title {
  color: #f0c040;
  font-size: 16px;
  font-weight: 600;
}

.changelog-panel-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 22px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}

.changelog-panel-close:hover {
  color: rgba(255, 255, 255, 0.9);
}

.changelog-panel-body {
  overflow-y: auto;
  padding: 8px 16px 12px 8px;
  flex: 1;
  min-height: 0;
}

.changelog-panel-body::-webkit-scrollbar { width: 4px; }
.changelog-panel-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.changelog-panel-body::-webkit-scrollbar-track { background: transparent; }
.changelog-panel-body :deep(.cl-version) { color: #f0c040; font-size: 14px; font-weight: 600; margin: 14px 0 6px; padding: 5px 0 5px 10px; border-left: 3px solid #f0c040; background: linear-gradient(90deg, rgba(240,192,64,0.06) 0%, transparent 100%); border-radius: 0 4px 4px 0; }
.changelog-panel-body :deep(.cl-list) { margin: 0 0 4px 16px; padding: 0; list-style: none; color: rgba(255,255,255,0.75); }
.changelog-panel-body :deep(.cl-list li) { font-size: 12px; line-height: 1.7; padding: 2px 0; position: relative; padding-left: 14px; }
.changelog-panel-body :deep(.cl-list li)::before { content: '•'; position: absolute; left: 0; color: rgba(255,255,255,0.25); font-size: 10px; top: 5px; }
</style>
