<template>
  <div class="course-container" :class="{ 'is-electron': isElectron }">
    <div class="course-inner">
      <div class="week-area">
        <el-button :icon="ArrowLeft" circle size="small" class="week-nav-btn" @click="prevWeek" :disabled="displayWeekNumber <= 1" />
        <div class="week-info">
          <span class="week-number">第{{ displayWeekNumber }}周</span>
          <span class="week-date">{{ weekDateRange }}</span>
        </div>
        <el-button :icon="ArrowRight" circle size="small" class="week-nav-btn" @click="nextWeek" :disabled="displayWeekNumber >= totalWeeks" />
      </div>

      <div class="course-grid-wrapper">
        <!-- 顶部：设置按钮 + 星期标签 -->
        <div class="grid-top-row" :style="{ gridTemplateColumns: gridColumns }">
          <button class="corner-settings-btn" title="课程表设置" @click="showCourseSettings = true">
            <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
          <div v-for="(day, di) in weekDays" :key="day.dayOfWeek" class="day-header-tag" :class="{ today: day.isToday }" :style="{ gridColumn: (di + 2).toString() }">
            <span class="tag-name">{{ day.name }}</span>
          </div>
        </div>

        <!-- 分段网格 -->
        <template v-for="(section, sIdx) in gridSections" :key="sIdx">
          <div v-if="section.breakLabel" class="break-section-tag" :style="{ gridTemplateColumns: gridColumns }">
            <span :style="{ gridColumn: `1 / span ${totalDayCount + 1}` }">{{ section.breakLabel }}</span>
          </div>
          <div class="course-grid" :style="{ gridTemplateColumns: gridColumns }">
            <template v-for="cell in section.cells" :key="cell.key">
              <div v-if="cell.type === 'period-label'" class="period-label-cell" :style="{ gridRow: cell.gridRow, gridColumn: cell.gridColumn }">
                <span class="pl-name">{{ cell.period!.name }}</span>
                <span class="pl-start">{{ cell.period!.start }}</span>
                <span class="pl-end">{{ cell.period!.end }}</span>
              </div>
              <div v-else-if="cell.type === 'course'" class="grid-cell has-course" :style="{ gridRow: cell.gridRow, gridColumn: cell.gridColumn }" @click="handleShowDetail(cell.course!)">
                <div class="course-card">
                  <div class="card-name" :style="{ color: cell.course!.color }">{{ cell.course!.name }}</div>
                  <div class="card-meta">
                    <span v-if="cell.course!.location" class="card-location">{{ cell.course!.location }}</span>
                    <span v-if="cell.course!.teacher" class="card-teacher">{{ cell.course!.teacher }}</span>
                  </div>
                  <div v-if="cell.course!.note" class="card-note">{{ cell.course!.note }}</div>
                  <div v-if="showNonCurrentWeekCourses && !cell.isCurrentWeek && cell.course!.weeks && cell.course!.weeks.length > 0" class="card-weeks">第{{ formatWeeks(cell.course!.weeks) }}周</div>
                </div>
                <div v-if="cell.overlapCount && cell.overlapCount > 0" class="overlap-badge">+{{ cell.overlapCount }}</div>
              </div>
              <div v-else-if="cell.type === 'empty'" class="grid-cell" :style="{ gridRow: cell.gridRow, gridColumn: cell.gridColumn }" @click="handleCellClick(cell.dayIndex!, cell.period!)">
                <div class="cell-empty"><span class="cell-plus">+</span></div>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- 课程弹窗 -->
  <Teleport to="body">
    <div v-if="dialogVisible" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog-container course-form-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">{{ editingCourse ? '编辑课程' : '添加课程' }}</span>
        </div>
        <div class="dialog-body">
          <el-form :model="courseForm" :rules="courseRules" ref="courseFormRef" label-width="90px" class="course-form">
            <el-form-item label="课程名称" prop="name">
              <el-input v-model="courseForm.name" placeholder="输入课程名称" maxlength="30" show-word-limit />
            </el-form-item>
            <el-form-item label="上课时间">
              <div class="time-area">
                <div class="time-day-row">
                  <el-radio-group v-model="courseForm.dayOfWeek">
                    <el-radio v-for="d in DAY_OPTIONS" :key="d.value" :value="d.value" class="day-radio">{{ d.label }}</el-radio>
                  </el-radio-group>
                </div>
                <div class="time-periods-row">
                  <el-checkbox v-for="p in periods" :key="p.id" :model-value="courseForm.periodIds.includes(p.id)" @change="(val: boolean) => togglePeriod(p.id, val)" class="period-checkbox">{{ p.name }}</el-checkbox>
                </div>
                <div class="time-range-row">
                  <span class="time-range-text">{{ computedTimeRange }}</span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="上课地点">
              <el-input v-model="courseForm.location" placeholder="教室/地点（可选）" maxlength="30" />
            </el-form-item>
            <el-form-item label="授课教师">
              <el-input v-model="courseForm.teacher" placeholder="教师姓名（可选）" maxlength="20" />
            </el-form-item>
            <el-form-item label="课程颜色">
              <div class="color-section">
                <div class="color-grid">
                  <div v-for="c in EXTENDED_COLORS" :key="c" class="color-swatch" :class="{ selected: courseForm.color === c }" :style="{ background: c }" @click="courseForm.color = c"></div>
                </div>
                <div class="color-custom">
                  <span class="color-custom-label">自定义</span>
                  <el-input v-model="courseForm.color" placeholder="#667eea" size="small" class="color-custom-input" />
                </div>
              </div>
            </el-form-item>
            <el-form-item label="上课周次">
              <div class="weeks-setting">
                <el-checkbox v-model="allWeeks">每周都有</el-checkbox>
                <div v-if="!allWeeks" class="week-selector">
                  <el-checkbox-group v-model="courseForm.weeks">
                    <el-checkbox v-for="w in maxWeeks" :key="w" :value="w">第{{ w }}周</el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="courseForm.note" type="textarea" :rows="2" placeholder="添加备注（可选）" maxlength="100" show-word-limit />
            </el-form-item>
          </el-form>
          <div class="form-footer">
            <button v-if="editingCourse" class="capsule-btn delete-btn" @click="handleDeleteCourseClick()">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
              <span>删除</span>
            </button>
            <button class="capsule-btn cancel-btn" @click="closeDialog">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <span>取消</span>
            </button>
            <button class="capsule-btn submit-btn" @click="handleCourseFormSubmit">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
              <span>{{ editingCourse ? '保存' : '添加' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 课程详情弹窗 -->
  <Teleport to="body">
    <div v-if="showCourseDetail && detailCourse" class="dialog-overlay" @click.self="showCourseDetail = false">
      <div class="dialog-container course-detail-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title" :style="{ color: detailCourse.color }">{{ detailCourse.name }}</span>
        </div>
        <div class="dialog-body">
          <div class="detail-row">
            <span class="detail-label">上课时间</span>
            <span class="detail-value">{{ getCourseDaysText(detailCourse) }} {{ getCoursePeriodsText(detailCourse) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">上课地点</span>
            <span class="detail-value">{{ detailCourse.location || '未设置' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">授课教师</span>
            <span class="detail-value">{{ detailCourse.teacher || '未设置' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">上课周次</span>
            <span class="detail-value">{{ getCourseWeeksText(detailCourse) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">备注</span>
            <span class="detail-value">{{ detailCourse.note || '无' }}</span>
          </div>
          <div class="form-footer">
            <button class="capsule-btn submit-btn" @click="openEditFromDetail">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>编辑</span>
            </button>
            <button class="capsule-btn cancel-btn" @click="showCourseDetail = false">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <span>关闭</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 删除课程确认弹窗 -->
  <Teleport to="body">
    <div v-if="showDeleteCourseConfirm" class="confirm-top-overlay" @click.self="showDeleteCourseConfirm = false">
      <div class="confirm-dialog-box">
        <div class="dialog-icon"><el-icon class="icon-warning"><Warning /></el-icon></div>
        <h3 class="dialog-title">删除确认</h3>
        <p class="dialog-message">确定要删除这门课程吗？</p>
        <div class="dialog-actions">
          <el-button type="default" @click="showDeleteCourseConfirm = false">取消</el-button>
          <el-button type="danger" @click="confirmDeleteCourse">确认删除</el-button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 课程表设置弹窗 -->
  <Teleport to="body">
    <div v-if="showCourseSettings" class="dialog-overlay" @click.self="cancelCourseSettings">
      <div class="dialog-container course-settings-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">课程表设置</span>
        </div>
        <div class="dialog-body">
          <div class="setting-item">
            <span class="setting-label">开学日期</span>
            <span class="setting-desc">学期第一周的周一日期</span>
            <div class="setting-control">
              <DateScrollPicker
                  v-model="courseSettingsDraft.semesterStartDate"
              />
            </div>
          </div>

          <div class="setting-item">
            <span class="setting-label">学期周数</span>
            <span class="setting-desc">本学期总共有多少周</span>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettingsDraft.totalWeeks"
                  :min="1"
                  :max="30"
                  :step="1"
                  size="default"
              />
            </div>
          </div>

          <div class="setting-item">
            <span class="setting-label">提前提醒</span>
            <span class="setting-desc">上课前多少分钟发送系统通知提醒</span>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettingsDraft.reminderMinutes"
                  :min="1"
                  :max="60"
                  :step="1"
                  controls-position="right"
                  size="default"
              />
            </div>
          </div>

          <div class="setting-item">
            <span class="setting-label">第1节开始时间</span>
            <span class="setting-desc">每天第一节上课的时间</span>
            <div class="setting-control">
              <TimePickerPopover
                  v-model="courseSettingsDraft.firstPeriodStart"
              />
            </div>
          </div>

          <div class="setting-item">
            <span class="setting-label">每节时长</span>
            <span class="setting-desc">每节课持续的分钟数</span>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettingsDraft.periodDuration"
                  :min="15"
                  :max="120"
                  :step="5"
                  size="default"
              />
            </div>
          </div>

          <div class="setting-item setting-item-break">
            <span class="setting-label">课间休息时长</span>
            <span class="setting-desc">相邻两节课之间的休息分钟数</span>
            <div class="break-mode-row">
              <el-radio-group v-model="courseSettingsDraft.breakMode" size="default">
                <el-radio-button value="uniform">统一时长</el-radio-button>
                <el-radio-button value="custom">自由时长</el-radio-button>
              </el-radio-group>
            </div>
            <div class="setting-control">
              <el-input-number
                  v-if="courseSettingsDraft.breakMode !== 'custom'"
                  v-model="courseSettingsDraft.breakDuration"
                  :min="5"
                  :max="60"
                  :step="5"
                  size="default"
              />
              <el-button
                  v-else
                  size="default"
                  class="setting-break-custom-btn"
                  @click="showCourseCustomBreakDialog = true"
              >自定义课间休息</el-button>
            </div>
          </div>

          <div class="setting-item">
            <span class="setting-label">午休时长</span>
            <span class="setting-desc">上午最后一节到下午第一节之间的休息分钟数</span>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettingsDraft.lunchBreakMinutes"
                  :min="0"
                  :max="240"
                  :step="5"
                  size="default"
              />
            </div>
          </div>

          <div class="setting-item">
            <span class="setting-label">晚休时长</span>
            <span class="setting-desc">下午最后一节到晚上第一节之间的休息分钟数</span>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettingsDraft.dinnerBreakMinutes"
                  :min="0"
                  :max="240"
                  :step="5"
                  size="default"
              />
            </div>
          </div>

          <div class="setting-item">
            <span class="setting-label">显示周末</span>
            <span class="setting-desc">在课程表中显示周六和周日</span>
            <div class="setting-control">
              <el-switch
                  v-model="courseSettingsDraft.showWeekend"
                  inline-prompt
                  size="default"
              />
            </div>
          </div>

          <div class="setting-item">
            <span class="setting-label">显示非本周课程</span>
            <span class="setting-desc">在课程表中显示其他周的课程安排</span>
            <div class="setting-control">
              <el-switch
                  v-model="courseSettingsDraft.showNonCurrentWeekCourses"
                  inline-prompt
                  size="default"
              />
            </div>
          </div>

          <div class="setting-item">
            <span class="setting-label">课表节数设置</span>
            <span class="setting-desc">设置上午、下午和晚上各有多少节课</span>
            <div class="setting-control">
              <PeriodCountPicker
                  v-model="courseSettingsDraft.periodCountPerSession"
              />
            </div>
          </div>

          <div class="form-footer">
            <button class="capsule-btn cancel-btn" @click="cancelCourseSettings">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <span>取消</span>
            </button>
            <button class="capsule-btn submit-btn" @click="confirmCourseSettings">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
              <span>确认</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 自由课间休息时长设置弹窗 -->
  <Teleport to="body">
    <div v-if="showCourseCustomBreakDialog" class="dialog-overlay" @click.self="showCourseCustomBreakDialog = false" style="z-index: 10000;">
      <div class="dialog-container custom-break-dialog">
        <div class="dialog-header folder-dialog-header">
          <span class="dialog-header-title folder-dialog-title">自由课间休息时长设置</span>
        </div>
        <div class="dialog-body">
          <div v-if="courseCustomBreakGaps.length === 0" class="custom-break-empty">课表节数不足，无需设置课间休息</div>
          <div v-for="(gap, idx) in courseCustomBreakGaps" :key="idx" class="custom-break-item">
            <span class="custom-break-label">{{ gap.label }}</span>
            <el-input-number
                v-model="courseCustomBreakDurationsDraft[idx]"
                :min="0"
                :max="60"
                :step="5"
                size="small"
                controls-position="right"
            />
          </div>
          <div class="form-footer" style="margin-top: 16px; border-top: none;">
            <button class="capsule-btn cancel-btn" @click="showCourseCustomBreakDialog = false">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <span>取消</span>
            </button>
            <button class="capsule-btn submit-btn" @click="confirmCourseCustomBreak">
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
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Warning } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getData, setData } from '../../services/storageService'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePageNav } from '../../composables/usePageNav'
import { logger } from '../../lib/logger'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'
import TimePickerPopover from '../common/picker/TimePickerPopover.vue'
import PeriodCountPicker from '../common/picker/PeriodCountPicker.vue'

interface Course {
  id: string
  name: string
  dayOfWeek: number
  periodIds: number[]
  location: string
  teacher: string
  color: string
  weeks: number[]
  note: string
  createdAt: string
  updatedAt: string
}

interface Period {
  id: number
  name: string
  start: string
  end: string
}

interface GridCellItem {
  type: 'corner' | 'day-header' | 'period-label' | 'empty' | 'course' | 'break-transition'
  gridRow: string
  gridColumn: string
  key: string
  day?: { name: string; date: string; dayOfWeek: number; isToday: boolean }
  period?: Period
  course?: Course
  dayIndex?: number
  overlapCount?: number
  breakLabel?: string
  isCurrentWeek?: boolean
}

const EXTENDED_COLORS = [
  '#667eea', '#764ba2', '#f093fb', '#d53a9d', '#4facfe', '#00b4db', '#43e97b', '#11998e',
  '#fa709a', '#ee5a24', '#fee140', '#f6d365', '#a8edea', '#a18cd1', '#d299c2', '#fbc2eb',
  '#ff6b6b', '#4ecdc4', '#26d0ce', '#45b7d1', '#2b32b2', '#96ceb4', '#e1eec3', '#fc4a1a',
  '#f7b733', '#00b09b', '#96c93d', '#834d9b', '#d04ed6', '#2c3e50', '#3498db', '#e74c3c',
  '#f39c12', '#1abc9c', '#9b59b6', '#e67e22', '#2ecc71', '#e91e63', '#00bcd4', '#8e44ad',
]

const DAY_OPTIONS = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' }, { value: 3, label: '周三' },
  { value: 4, label: '周四' }, { value: 5, label: '周五' }, { value: 6, label: '周六' }, { value: 0, label: '周日' }
]

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function formatWeeks(weeks: number[]): string {
  if (!weeks || weeks.length === 0) return ''
  const sorted = [...weeks].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let end = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`)
      start = sorted[i]
      end = sorted[i]
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`)
  return ranges.join(',')
}

const COURSES_KEY = 'course' as const
const COURSES_SUB = 'courses' as const

const courses = ref<Course[]>([])

const settingsStore = useSettingsStore()
const pageNav = usePageNav()

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electronAPI)

const semesterStartDate = computed(() => settingsStore.settings.course?.semesterStartDate || '')
const totalWeeks = computed(() => settingsStore.settings.course?.totalWeeks || 20)
const firstPeriodStart = computed(() => settingsStore.settings.course?.firstPeriodStart || '08:00')
const periodDuration = computed(() => settingsStore.settings.course?.periodDuration || 45)
const breakDuration = computed(() => settingsStore.settings.course?.breakDuration || 10)
const breakMode = computed(() => settingsStore.settings.course?.breakMode || 'uniform')
const customBreakDurations = computed(() => settingsStore.settings.course?.customBreakDurations || [])
const lunchBreakMinutes = computed(() => settingsStore.settings.course?.lunchBreakMinutes ?? 120)
const dinnerBreakMinutes = computed(() => settingsStore.settings.course?.dinnerBreakMinutes ?? 90)
const showWeekend = computed(() => settingsStore.settings.course?.showWeekend !== false)
const showNonCurrentWeekCourses = computed(() => settingsStore.settings.course?.showNonCurrentWeekCourses !== false)
const periodCountPerSession = computed(() => settingsStore.settings.course?.periodCountPerSession || { morning: 4, afternoon: 4, evening: 2 })

const periods = computed<Period[]>(() => {
  const start = firstPeriodStart.value
  const dur = periodDuration.value
  const brk = breakDuration.value
  const mode = breakMode.value
  const customBks = customBreakDurations.value
  const lunch = lunchBreakMinutes.value
  const dinner = dinnerBreakMinutes.value
  const counts = periodCountPerSession.value
  const result: Period[] = []
  let currentStart = start
  let idCounter = 1
  let customGapIdx = 0

  for (let i = 0; i < counts.morning; i++) {
    const end = addMinutes(currentStart, dur)
    result.push({ id: idCounter++, name: `第${idCounter - 1}节`, start: currentStart, end })
    if (i < counts.morning - 1) {
      currentStart = addMinutes(end, mode === 'custom' ? (customBks[customGapIdx] ?? brk) : brk)
      customGapIdx++
    } else {
      currentStart = addMinutes(end, brk)
    }
  }

  if (counts.morning > 0 && counts.afternoon > 0) {
    currentStart = addMinutes(result[result.length - 1].end, lunch)
  } else if (counts.morning === 0 && counts.afternoon > 0) {
    currentStart = start
  }

  for (let i = 0; i < counts.afternoon; i++) {
    const end = addMinutes(currentStart, dur)
    result.push({ id: idCounter++, name: `第${idCounter - 1}节`, start: currentStart, end })
    if (i < counts.afternoon - 1) {
      currentStart = addMinutes(end, mode === 'custom' ? (customBks[customGapIdx] ?? brk) : brk)
      customGapIdx++
    } else {
      currentStart = addMinutes(end, brk)
    }
  }

  if (counts.afternoon > 0 && counts.evening > 0) {
    currentStart = addMinutes(result[result.length - 1].end, dinner)
  } else if (counts.afternoon === 0 && counts.evening > 0) {
    currentStart = start
  }

  for (let i = 0; i < counts.evening; i++) {
    const end = addMinutes(currentStart, dur)
    result.push({ id: idCounter++, name: `第${idCounter - 1}节`, start: currentStart, end })
    if (i < counts.evening - 1) {
      currentStart = addMinutes(end, mode === 'custom' ? (customBks[customGapIdx] ?? brk) : brk)
      customGapIdx++
    } else {
      currentStart = addMinutes(end, brk)
    }
  }

  return result
})

const currentWeekStart = ref(getMondayOfWeek(dayjs()))

function getMondayOfWeek(date: dayjs.Dayjs): dayjs.Dayjs {
  const day = date.day()
  const diff = day === 0 ? -6 : 1 - day
  return date.add(diff, 'day').startOf('day')
}

const displayWeekNumber = computed(() => getWeekNumber(currentWeekStart.value))

const weekDateRange = computed(() => {
  const start = currentWeekStart.value
  const end = start.add(6, 'day')
  return `${start.format('M.D')}-${end.format('M.D')}`
})

const weekDays = computed(() => {
  const today = dayjs()
  const count = showWeekend.value ? 7 : 5
  return Array.from({ length: count }, (_, i) => {
    const date = currentWeekStart.value.add(i, 'day')
    return {
      name: DAY_NAMES[i],
      date: date.format('DD'),
      fullDate: date.format('YYYY-MM-DD'),
      dayOfWeek: i === 6 ? 0 : i + 1,
      isToday: today.format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
    }
  })
})

function getWeekNumber(date: dayjs.Dayjs): number {
  if (!semesterStartDate.value) {
    const startOfYear = date.startOf('year')
    const mondayOfFirstWeek = getMondayOfWeek(startOfYear)
    const diff = getMondayOfWeek(date).diff(mondayOfFirstWeek, 'week')
    return Math.max(1, diff + 1)
  }
  const startDate = getMondayOfWeek(dayjs(semesterStartDate.value))
  const diff = getMondayOfWeek(date).diff(startDate, 'week')
  return Math.max(1, diff + 1)
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function addMinutes(time: string, minutes: number): string {
  const total = timeToMinutes(time) + minutes
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function findClosestPeriod(time: string): number {
  const minutes = timeToMinutes(time)
  let best = periods.value.length > 0 ? periods.value[0].id : 1
  let bestDiff = Infinity
  for (const p of periods.value) {
    const diff = Math.abs(minutes - timeToMinutes(p.start))
    if (diff < bestDiff) { bestDiff = diff; best = p.id }
  }
  return best
}

function findPeriodsForTimeRange(startTime: string, endTime: string): number[] {
  if (periods.value.length === 0) return []
  const startP = findClosestPeriod(startTime)
  const endP = findClosestPeriod(endTime)
  const minP = Math.min(startP, endP)
  const maxP = Math.max(startP, endP)
  const ids: number[] = []
  for (let i = minP; i <= maxP; i++) ids.push(i)
  return ids
}

function getPeriodById(id: number): Period | undefined {
  return periods.value.find(p => p.id === id)
}

const gridColumns = computed(() => {
  const dayCount = showWeekend.value ? 7 : 5
  if (isElectron.value) {
    return `70px repeat(${dayCount}, 1fr)`
  }
  const totalCols = 1 + dayCount
  const gapTotal = (totalCols - 1) * 2
  const colWidth = `calc((100% - ${gapTotal}px) / ${totalCols})`
  return `repeat(${totalCols}, ${colWidth})`
})

const totalDayCount = computed(() => showWeekend.value ? 7 : 5)
const gridCells = computed<GridCellItem[]>(() => {
  const cells: GridCellItem[] = []
  const weekNum = displayWeekNumber.value
  const days = weekDays.value
  const ps = periods.value
  const dayCount = totalDayCount.value

  interface CourseLayout {
    course: Course
    periods: number[]
    dayIndex: number
    isCurrentWeek: boolean
  }
  const layouts: CourseLayout[] = []
  for (const course of courses.value) {
    if (!showNonCurrentWeekCourses.value && course.weeks && course.weeks.length > 0 && !course.weeks.includes(weekNum)) continue
    if (course.dayOfWeek == null) continue
    const pIds = (course.periodIds || []).slice().sort((a, b) => a - b)
    if (pIds.length === 0) continue
    const dayIndex = course.dayOfWeek === 0 ? 6 : course.dayOfWeek - 1
    if (dayIndex >= dayCount) continue
    const isCurrentWeek = !course.weeks || course.weeks.length === 0 || course.weeks.includes(weekNum)
    layouts.push({ course, periods: pIds, dayIndex, isCurrentWeek })
  }

  layouts.sort((a, b) => {
    if (a.isCurrentWeek && !b.isCurrentWeek) return -1
    if (!a.isCurrentWeek && b.isCurrentWeek) return 1
    return 0
  })

  const occupied = new Set<string>()

  ps.forEach((period, pi) => {
    const row = (pi + 1).toString()
    cells.push({ type: 'period-label', gridRow: row, gridColumn: '1', key: `pl-${period.id}`, period })

    days.forEach((day, di) => {
      const cKey = `c-${pi}-${di}`
      if (occupied.has(cKey)) return

      const layout = layouts.find(l =>
        l.periods.includes(period.id) &&
        l.dayIndex === di &&
        period.id === l.periods[0]
      )

      if (layout) {
        const rowSpan = layout.periods.length
        for (let r = 0; r < rowSpan; r++) {
          occupied.add(`c-${pi + r}-${di}`)
        }
        const cellOverlapping = layouts.filter(l =>
          l !== layout && l.periods.some(pid => layout.periods.includes(pid)) && l.dayIndex === di
        )
        cells.push({
          type: 'course',
          gridRow: `${row} / span ${rowSpan}`,
          gridColumn: (di + 2).toString(),
          key: `course-${layout.course.id}-${pi}-${di}`,
          course: layout.course,
          overlapCount: cellOverlapping.length,
          isCurrentWeek: layout.isCurrentWeek
        })
      } else {
        cells.push({
          type: 'empty',
          gridRow: row,
          gridColumn: (di + 2).toString(),
          key: `empty-${pi}-${di}`,
          dayIndex: di,
          period
        })
      }
    })
  })

  return cells
})

const morningRowCount = computed(() => {
  const counts = periodCountPerSession.value
  return counts.morning || 0
})
const afternoonRowCount = computed(() => {
  const counts = periodCountPerSession.value
  return counts.afternoon || 0
})
const eveningRowCount = computed(() => {
  const counts = periodCountPerSession.value
  return counts.evening || 0
})

const gridSections = computed(() => {
  const cells = gridCells.value
  const mr = morningRowCount.value
  const ar = afternoonRowCount.value
  const er = eveningRowCount.value

  function renumberRow(gridRow: string, offset: number): string {
    const m = gridRow.match(/^(\d+)(?:\s*\/\s*span\s+(\d+))?$/)
    if (!m) return gridRow
    const row = parseInt(m[1]) - offset
    return m[2] ? `${row} / span ${m[2]}` : `${row}`
  }

  const result: { cells: GridCellItem[]; breakLabel: string | null }[] = []

  if (mr > 0) {
    const morningCells = cells
      .filter(c => parseInt(c.gridRow) <= mr)
      .map(c => ({ ...c, gridRow: renumberRow(c.gridRow, 0) }))
    result.push({ cells: morningCells, breakLabel: null })
  }

  if (ar > 0) {
    const offset = mr
    const afternoonCells = cells
      .filter(c => { const row = parseInt(c.gridRow); return row > mr && row <= mr + ar })
      .map(c => ({ ...c, gridRow: renumberRow(c.gridRow, offset) }))
    result.push({ cells: afternoonCells, breakLabel: '午休' })
  }

  if (er > 0) {
    const offset = mr + ar
    const eveningCells = cells
      .filter(c => { const row = parseInt(c.gridRow); return row > mr + ar })
      .map(c => ({ ...c, gridRow: renumberRow(c.gridRow, offset) }))
    result.push({ cells: eveningCells, breakLabel: '晚休' })
  }

  return result
})

function prevWeek() {
  if (displayWeekNumber.value > 1) {
    currentWeekStart.value = currentWeekStart.value.subtract(7, 'day')
    logger.info('[课程表] 切换上一周', { week: displayWeekNumber.value })
  }
}

function nextWeek() {
  if (displayWeekNumber.value < totalWeeks.value) {
    currentWeekStart.value = currentWeekStart.value.add(7, 'day')
    logger.info('[课程表] 切换下一周', { week: displayWeekNumber.value })
  }
}

// ===== 课程弹窗 =====
const dialogVisible = ref(false)
const editingCourse = ref<Course | null>(null)
const courseFormRef = ref()
const courseForm = ref({
  name: '',
  dayOfWeek: 1,
  periodIds: [] as number[],
  location: '',
  teacher: '',
  color: EXTENDED_COLORS[0],
  weeks: [] as number[],
  note: ''
})
const allWeeks = ref(true)

const computedTimeRange = computed(() => {
  if (courseForm.value.periodIds.length === 0) return '未选择节次'
  const sorted = [...courseForm.value.periodIds].sort((a, b) => a - b)
  const first = getPeriodById(sorted[0])
  const last = getPeriodById(sorted[sorted.length - 1])
  if (first && last) return `${first.start} - ${last.end}`
  return '未选择节次'
})

function togglePeriod(periodId: number, checked: boolean) {
  if (checked) {
    if (!courseForm.value.periodIds.includes(periodId)) courseForm.value.periodIds = [...courseForm.value.periodIds, periodId]
  } else {
    courseForm.value.periodIds = courseForm.value.periodIds.filter(id => id !== periodId)
  }
}

const courseRules = { name: [{ required: true, message: '请输入课程名称', trigger: 'blur' }] }
const maxWeeks = computed(() => totalWeeks.value || 25)

function handleCellClick(dayIndex: number, period: Period) {
  const dayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1
  editingCourse.value = null
  courseForm.value = {
    name: '',
    dayOfWeek,
    periodIds: [period.id],
    location: '',
    teacher: '',
    color: EXTENDED_COLORS[Math.floor(Math.random() * EXTENDED_COLORS.length)],
    weeks: [],
    note: ''
  }
  allWeeks.value = true
  dialogVisible.value = true
}

function handleEditCourse(course: Course) {
  editingCourse.value = { ...course }
  courseForm.value = {
    name: course.name,
    dayOfWeek: course.dayOfWeek,
    periodIds: [...(course.periodIds || [])],
    location: course.location,
    teacher: course.teacher,
    color: course.color,
    weeks: [...(course.weeks || [])],
    note: course.note
  }
  allWeeks.value = !course.weeks || course.weeks.length === 0
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
  editingCourse.value = null
}

// ===== 课程详情弹窗 =====
const showCourseDetail = ref(false)
const detailCourse = ref<Course | null>(null)

function handleShowDetail(course: Course) {
  detailCourse.value = course
  showCourseDetail.value = true
}

function openEditFromDetail() {
  if (!detailCourse.value) return
  showCourseDetail.value = false
  handleEditCourse(detailCourse.value)
}

function getCourseDaysText(course: Course): string {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return names[course.dayOfWeek]
}

function getCoursePeriodsText(course: Course): string {
  return course.periodIds.map(id => {
    const p = getPeriodById(id)
    return p ? `${p.name}(${p.start}-${p.end})` : ''
  }).filter(Boolean).join('、')
}

function getCourseWeeksText(course: Course): string {
  if (!course.weeks || course.weeks.length === 0) return '每周都有'
  return `第${formatWeeks(course.weeks)}周`
}

async function handleCourseFormSubmit() {
  if (!courseFormRef.value) return
  await courseFormRef.value.validate((valid: boolean) => {
    if (!valid) return
    if (editingCourse.value) {
      const idx = courses.value.findIndex(c => c.id === editingCourse.value!.id)
      if (idx > -1) {
        const updated = {
          ...courses.value[idx],
          name: courseForm.value.name,
          dayOfWeek: courseForm.value.dayOfWeek,
          periodIds: [...courseForm.value.periodIds],
          location: courseForm.value.location,
          teacher: courseForm.value.teacher,
          color: courseForm.value.color,
          weeks: allWeeks.value ? [] : [...courseForm.value.weeks],
          note: courseForm.value.note,
          updatedAt: new Date().toISOString()
        }
        courses.value[idx] = updated
        ElMessage.success('课程已更新')
        logger.info('[课程表] 编辑课程', { id: editingCourse.value.id, name: courseForm.value.name })
      }
    } else {
      const newCourse: Course = {
        id: Date.now().toString(),
        name: courseForm.value.name,
        dayOfWeek: courseForm.value.dayOfWeek,
        periodIds: [...courseForm.value.periodIds],
        location: courseForm.value.location,
        teacher: courseForm.value.teacher,
        color: courseForm.value.color,
        weeks: allWeeks.value ? [] : [...courseForm.value.weeks],
        note: courseForm.value.note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      courses.value = [...courses.value, newCourse]
      ElMessage.success('课程已添加')
      logger.info('[课程表] 添加课程', { name: courseForm.value.name })
    }
    saveCourses()
    closeDialog()
  })
}

const showDeleteCourseConfirm = ref(false)
const pendingDeleteCourseId = ref<string | null>(null)

function handleDeleteCourseClick() {
  if (!editingCourse.value) return
  pendingDeleteCourseId.value = editingCourse.value.id
  showDeleteCourseConfirm.value = true
}

async function confirmDeleteCourse() {
  const id = pendingDeleteCourseId.value
  if (!id) return
  courses.value = courses.value.filter(c => c.id !== id)
  showDeleteCourseConfirm.value = false
  pendingDeleteCourseId.value = null
  closeDialog()
  await saveCourses()
  ElMessage.success('课程已删除')
  logger.info('[课程表] 删除课程', { id })
}

const showCourseSettings = ref(false)
const showCourseCustomBreakDialog = ref(false)

const courseSettingsDraft = ref({
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

const courseCustomBreakDurationsDraft = ref<number[]>([])

const courseCustomBreakGaps = computed(() => {
  const counts = courseSettingsDraft.value.periodCountPerSession
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

function initCourseSettingsDraft() {
  courseSettingsDraft.value.semesterStartDate = settingsStore.settings.course?.semesterStartDate || ''
  courseSettingsDraft.value.totalWeeks = settingsStore.settings.course?.totalWeeks || 20
  courseSettingsDraft.value.reminderMinutes = settingsStore.settings.course?.reminderMinutes || 5
  courseSettingsDraft.value.firstPeriodStart = settingsStore.settings.course?.firstPeriodStart || '08:00'
  courseSettingsDraft.value.periodDuration = settingsStore.settings.course?.periodDuration || 45
  courseSettingsDraft.value.breakDuration = settingsStore.settings.course?.breakDuration || 10
  courseSettingsDraft.value.breakMode = settingsStore.settings.course?.breakMode || 'uniform'
  courseSettingsDraft.value.customBreakDurations = settingsStore.settings.course?.customBreakDurations || []
  courseSettingsDraft.value.lunchBreakMinutes = settingsStore.settings.course?.lunchBreakMinutes ?? 120
  courseSettingsDraft.value.dinnerBreakMinutes = settingsStore.settings.course?.dinnerBreakMinutes ?? 90
  courseSettingsDraft.value.showWeekend = settingsStore.settings.course?.showWeekend !== false
  courseSettingsDraft.value.showNonCurrentWeekCourses = settingsStore.settings.course?.showNonCurrentWeekCourses !== false
  courseSettingsDraft.value.periodCountPerSession = settingsStore.settings.course?.periodCountPerSession || { morning: 4, afternoon: 4, evening: 2 }
}

function cancelCourseSettings() {
  showCourseSettings.value = false
}

async function confirmCourseSettings() {
  await settingsStore.updateCourseSettings({
    semesterStartDate: courseSettingsDraft.value.semesterStartDate,
    totalWeeks: courseSettingsDraft.value.totalWeeks,
    reminderMinutes: courseSettingsDraft.value.reminderMinutes,
    firstPeriodStart: courseSettingsDraft.value.firstPeriodStart,
    periodDuration: courseSettingsDraft.value.periodDuration,
    breakDuration: courseSettingsDraft.value.breakDuration,
    breakMode: courseSettingsDraft.value.breakMode,
    customBreakDurations: courseSettingsDraft.value.customBreakDurations,
    lunchBreakMinutes: courseSettingsDraft.value.lunchBreakMinutes,
    dinnerBreakMinutes: courseSettingsDraft.value.dinnerBreakMinutes,
    showWeekend: courseSettingsDraft.value.showWeekend,
    showNonCurrentWeekCourses: courseSettingsDraft.value.showNonCurrentWeekCourses,
    periodCountPerSession: courseSettingsDraft.value.periodCountPerSession
  })
  logger.info('[设置] 修改课程表设置')
  showCourseSettings.value = false
}

function confirmCourseCustomBreak() {
  courseSettingsDraft.value.customBreakDurations = [...courseCustomBreakDurationsDraft.value]
  showCourseCustomBreakDialog.value = false
}

watch(showCourseSettings, (val) => {
  if (val) {
    initCourseSettingsDraft()
  }
})

watch(showCourseCustomBreakDialog, (val) => {
  if (val) {
    const existing = courseSettingsDraft.value.customBreakDurations
    const gapCount = courseCustomBreakGaps.value.length
    courseCustomBreakDurationsDraft.value = Array.from(
      { length: gapCount },
      (_, i) => (existing && i < existing.length ? existing[i] : null) ?? courseSettingsDraft.value.breakDuration
    )
  }
})

// ===== 持久化 =====
async function saveCourses() {
  const ok = await setData(COURSES_KEY, COURSES_SUB, courses.value)
  if (!ok) logger.error('[课程表] 保存课程失败')
}

async function loadCourses() {
  try {
    const saved = await getData<Course[]>(COURSES_KEY, COURSES_SUB)
    if (saved && Array.isArray(saved)) {
      courses.value = saved.map(c => ({
        id: c.id || Date.now().toString(),
        name: c.name || '未命名课程',
        dayOfWeek: Array.isArray(c.dayOfWeek) ? (c.dayOfWeek[0] ?? 1) : (c.dayOfWeek ?? 1),
        periodIds: Array.isArray((c as any).periodIds) && (c as any).periodIds.length > 0
          ? (c as any).periodIds
          : ((c as any).startTime && (c as any).endTime ? findPeriodsForTimeRange((c as any).startTime, (c as any).endTime) : []),
        location: c.location || '',
        teacher: c.teacher || '',
        color: c.color || EXTENDED_COLORS[0],
        weeks: Array.isArray(c.weeks) ? c.weeks : [],
        note: c.note || '',
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || new Date().toISOString()
      }))
      logger.info('[课程表] 加载课程', { count: courses.value.length })
    }
  } catch (e) {
    logger.error('[课程表] 加载课程失败', e)
    courses.value = []
  }
}

onMounted(async () => {
  if (pageNav.navPath.value.length === 0) pageNav.setNavPath(['course'])
  pageNav.setNavContext({
    segments: [],
    plusVisible: false,
    plusOnClick: null,
    goModuleHome: () => { pageNav.setNavPath(['course']) }
  })
  await settingsStore.loadSettings()
  await loadCourses()
})


</script>

<style scoped>
.course-container { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.course-inner { display: flex; flex-direction: column; align-items: center; padding: 16px 0; gap: 16px; height: 100%; }

.week-area { display: flex; align-items: center; justify-content: center; gap: 16px; width: 100%; flex-shrink: 0; }
.is-electron .week-area { width: 500px; }
.week-nav-btn { flex-shrink: 0; }
.week-nav-btn:deep(.el-icon) { color: var(--chalk-white-75); }
.week-info { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.week-number { font-size: 13px; font-weight: 600; color: var(--chalk-white); }
.is-electron .week-number { font-size: 16px; }
.week-date { font-size: 11px; color: var(--chalk-muted); }
.is-electron .week-date { font-size: 13px; }

.course-grid-wrapper { width: 100%; flex: 1; overflow: auto; scrollbar-width: none; -ms-overflow-style: none; }
.is-electron .course-grid-wrapper { width: 80%; }
.course-grid-wrapper::-webkit-scrollbar { display: none; }
.course-grid { display: grid; gap: 2px; min-width: 0; grid-auto-rows: 64px; }

.grid-top-row {
  display: grid;
  gap: 2px;
  align-items: center;
  margin-bottom: 4px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.day-header-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 100px;
  min-height: 32px;
}
.tag-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--chalk-white-70);
}
.day-header-tag.today .tag-name {
  color: var(--chalk-blue);
}

.break-section-tag {
  display: grid;
  gap: 2px;
  padding: 6px 0;
}
.break-section-tag span {
  font-size: 12px;
  color: var(--chalk-subtle);
  letter-spacing: 2px;
  padding: 6px 0;
  border-radius: 100px;
  background: rgba(255, 255, 255, 0.04);
  text-align: center;
}

.period-label-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 6px; background: rgba(255,255,255,0.02); border-radius: 4px; cursor: default; transition: background 0.15s; }
.period-label-cell:hover { background: rgba(255,255,255,0.06); }
.pl-name { font-size: 10px; color: var(--chalk-white-75); font-weight: 500; }
.is-electron .pl-name { font-size: 13px; }
.pl-start, .pl-end { font-size: 10px; color: var(--chalk-subtle); }

.grid-cell { border-radius: 4px; background: rgba(255,255,255,0.02); cursor: pointer; transition: background 0.15s; padding: 2px; display: flex; align-items: stretch; min-height: 0; }
.grid-cell:hover { background: rgba(255,255,255,0.05); }
.grid-cell.has-course { background: rgba(255,255,255,0.04); }

.cell-empty { flex: 1; display: flex; align-items: center; justify-content: center; }
.cell-plus { font-size: 20px; color: var(--chalk-muted); opacity: 0; transition: opacity 0.15s; }
.grid-cell:hover .cell-plus { opacity: 1; }

.course-card {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.is-electron .course-card {
  flex-direction: column;
  padding: 4px 6px;
  white-space: normal;
  justify-content: center;
  align-items: flex-start;
}
.course-card:hover { background: rgba(255,255,255,0.1); }
.card-name { font-size: 10px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; max-width: 45%; }
.is-electron .card-name { font-size: 12px; word-break: break-all; line-height: 1.3; white-space: normal; overflow: visible; text-overflow: clip; flex-shrink: 1; max-width: none; }
.card-meta { display: inline-flex; gap: 2px; flex-shrink: 1; overflow: hidden; min-width: 0; }
.is-electron .card-meta { margin-top: 2px; flex-wrap: wrap; gap: 4px; }
.card-location, .card-teacher { font-size: 10px; color: var(--chalk-white-60); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-note { font-size: 10px; color: var(--chalk-subtle); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; max-width: 30%; }
.is-electron .card-note { margin-top: 2px; word-break: break-all; line-height: 1.3; white-space: normal; overflow: visible; text-overflow: clip; flex-shrink: 1; max-width: none; }

/* 安卓端：课程卡片分四行显示，不截断文本 */
.course-container:not(.is-electron) .course-card {
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  overflow: visible;
  white-space: normal;
}
.course-container:not(.is-electron) .card-meta {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.course-container:not(.is-electron) .card-name,
.course-container:not(.is-electron) .card-location,
.course-container:not(.is-electron) .card-teacher,
.course-container:not(.is-electron) .card-note {
  font-size: 5px;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  max-width: none;
  flex-shrink: 1;
}

.has-course { position: relative; }
.overlap-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(255, 165, 0, 0.85);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 0 4px;
  border-radius: 3px;
  line-height: 16px;
  pointer-events: none;
  z-index: 2;
}

.card-weeks {
  font-size: 10px;
  color: var(--chalk-orange);
  margin-top: 2px;
  word-break: break-all;
  line-height: 1.3;
}

/* 弹窗 */
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.dialog-container { background: rgba(30,28,52,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }
.course-form-dialog { width: 420px; }

.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 0; flex-shrink: 0; }
.dialog-header-title { font-size: 16px; font-weight: 600; color: var(--chalk-white); }
.folder-dialog-header { justify-content: center; }
.folder-dialog-title { text-align: center; }
.dialog-body { padding: 12px 16px 16px; overflow-y: auto; flex: 1; scrollbar-width: none; -ms-overflow-style: none; }
.dialog-body::-webkit-scrollbar { display: none; }

.course-form :deep(.el-form-item) { margin-bottom: 12px; }
.course-form :deep(.el-form-item:last-child) { margin-bottom: 0; }
.course-form :deep(.el-form-item__label) { color: var(--chalk-white-70); }
.course-form :deep(.el-input__wrapper) { background: rgba(255,255,255,0.05) !important; border: 1px solid rgba(255,255,255,0.1); box-shadow: none !important; }
.course-form :deep(.el-input__wrapper:hover) { border-color: rgba(102,126,234,0.5); }
.course-form :deep(.el-input__inner),
.course-form :deep(.el-textarea__inner) { color: var(--chalk-white-90) !important; }
.course-form :deep(.el-input__inner::placeholder),
.course-form :deep(.el-textarea__inner::placeholder) { color: var(--chalk-subtle); }
.course-form :deep(.el-textarea__inner) { background: rgba(255,255,255,0.05) !important; border: 1px solid rgba(255,255,255,0.1); box-shadow: none !important; }
.course-form :deep(.el-textarea__inner:hover) { border-color: rgba(102,126,234,0.5); }
.course-form :deep(.el-checkbox__label) { color: var(--chalk-white-85); }
.course-form :deep(.el-input__count), .course-form :deep(.el-input__count-inner) { background: transparent !important; color: var(--chalk-subtle) !important; }

.time-area { display: flex; flex-direction: column; gap: 6px; }
.time-day-row { display: flex; flex-wrap: wrap; gap: 2px; }
.day-radio { margin-right: 0; }
.day-radio :deep(.el-radio__label) { font-size: 12px; }
.time-periods-row { display: flex; flex-wrap: wrap; gap: 4px; }
.period-checkbox { margin-right: 0; }
.period-checkbox :deep(.el-checkbox__label) { font-size: 12px; }
.time-range-row { display: flex; align-items: center; }
.time-range-text { font-size: 12px; color: var(--chalk-muted); }

.color-section { display: flex; flex-direction: column; gap: 8px; }
.color-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
.color-swatch { width: 100%; aspect-ratio: 1; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; box-sizing: border-box; }
.color-swatch:hover { transform: scale(1.15); }
.color-swatch.selected { border-color: #fff; transform: scale(1.15); box-shadow: 0 0 8px rgba(255,255,255,0.3); }
.color-custom { display: flex; align-items: center; gap: 10px; }
.color-custom-label { font-size: 13px; color: var(--chalk-dim); flex-shrink: 0; }
.color-custom-input { width: 140px; }

.weeks-setting { display: flex; flex-direction: column; gap: 8px; }
.week-selector { max-height: 120px; overflow-y: auto; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px; scrollbar-width: none; -ms-overflow-style: none; }
.week-selector::-webkit-scrollbar { display: none; }
.week-selector :deep(.el-checkbox-group) { display: flex; flex-wrap: wrap; gap: 8px; }
.week-selector :deep(.el-checkbox) { margin-right: 0; min-width: 70px; }

.form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
.capsule-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 18px; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; background: transparent; color: var(--chalk-white-70); cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.2s; }
.capsule-btn:hover { background: rgba(255,255,255,0.08); color: var(--chalk-white); }
.capsule-btn .capsule-icon { width: 14px; height: 14px; }
.submit-btn { background: rgba(102,126,234,0.2); border-color: rgba(102,126,234,0.4); color: #93c5fd; }
.submit-btn:hover { background: rgba(102,126,234,0.35); color: var(--chalk-white); }
.delete-btn { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.35); color: #fca5a5; }
.delete-btn:hover { background: rgba(239,68,68,0.3); color: var(--chalk-white); }

.confirm-top-overlay { position: fixed; inset: 0; z-index: 10001; background: rgba(15,12,41,0.92); display: flex; align-items: center; justify-content: center; }
.confirm-dialog-box { background: rgba(30,28,52,0.98); border-radius: 16px; padding: 32px; width: 300px; max-width: 300px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.icon-warning { font-size: 48px; color: var(--chalk-orange); }
.dialog-icon { text-align: center; margin-bottom: 16px; }
.dialog-title { text-align: center; font-size: 18px; font-weight: 600; color: var(--chalk-white); margin: 0 0 12px 0; }
.dialog-message { text-align: center; font-size: 14px; color: var(--chalk-white-70); margin: 0 0 24px 0; line-height: 1.6; }
.dialog-actions { display: flex; gap: 12px; justify-content: center; }

.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.dialog-container { background: rgba(30,28,52,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }
.course-settings-dialog { width: 300px; }
.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 0; flex-shrink: 0; }
.dialog-header-title { font-size: 16px; font-weight: 600; color: var(--chalk-white); }
.folder-dialog-header { justify-content: center; }
.folder-dialog-title { text-align: center; }

.dialog-body { padding: 12px 16px 16px; overflow-y: auto; flex: 1; scrollbar-width: none; -ms-overflow-style: none; }
.dialog-body::-webkit-scrollbar { display: none; }

.setting-item { display: flex; flex-direction: column; padding: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; gap: 8px; margin-bottom: 8px; }
.setting-item-break { gap: 10px; }
.setting-label { font-size: 14px; font-weight: 500; color: #fff; }
.setting-desc { font-size: 12px; color: rgba(255, 255, 255, 0.5); }
.setting-control { display: flex; align-items: center; gap: 8px; }

.corner-settings-btn { padding: 4px; min-width: auto; border: none; background: transparent; color: #fff; }
.corner-settings-btn .capsule-icon { width: 16px; height: 16px; }
.corner-settings-btn:hover { background: transparent; }

.form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
.capsule-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 18px; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; background: transparent; color: var(--chalk-white-70); cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.2s; }
.capsule-btn:hover { background: rgba(255,255,255,0.08); color: var(--chalk-white); }
.capsule-btn .capsule-icon { width: 14px; height: 14px; }
.submit-btn { background: rgba(102,126,234,0.2); border-color: rgba(102,126,234,0.4); color: #93c5fd; }
.submit-btn:hover { background: rgba(102,126,234,0.35); color: var(--chalk-white); }

.break-mode-row { display: flex; align-items: center; }
.setting-break-custom-btn { white-space: nowrap; }

.custom-break-dialog { width: 250px; }
.custom-break-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
.custom-break-item:last-child { border-bottom: none; }
.custom-break-label { font-size: 13px; color: rgba(255,255,255,0.8); }
.custom-break-empty { text-align: center; color: rgba(255,255,255,0.5); padding: 20px 0; font-size: 14px; }

/* 课程详情弹窗 */
.course-detail-dialog { width: 360px; }
.detail-row { display: flex; flex-direction: column; gap: 2px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
.detail-row:last-of-type { border-bottom: none; }
.detail-label { font-size: 11px; color: var(--chalk-muted); }
.detail-value { font-size: 13px; color: var(--chalk-white-85); line-height: 1.5; }
</style>