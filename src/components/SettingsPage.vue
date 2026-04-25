<template>
  <div class="settings-page">
    <div class="settings-content">
      <el-scrollbar>
        <!-- 专注模块设置 -->
        <div class="settings-section">
          <h3 class="section-title">
            <span class="title-icon">🍅</span>
            专注设置
          </h3>
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
              />
            </div>
          </div>
        </div>

        <!-- 课程表模块设置 -->
        <div class="settings-section">
          <h3 class="section-title">
            <span class="title-icon">📚</span>
            课程表设置
          </h3>
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
              />
            </div>
          </div>

          <div class="setting-tip" v-if="courseSettings.semesterStartDate">
            当前学期第 {{ currentWeekNumber }} 周 / 共 {{ courseSettings.totalWeeks }} 周
          </div>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'
import LunarDatePicker from './LunarDatePicker.vue'
import dayjs from 'dayjs'

const settingsStore = useSettingsStore()

// 本地设置状态（用于实时编辑）
const focusSettings = ref({
  pomodoroDuration: 25
})

const courseSettings = ref({
  semesterStartDate: '',
  totalWeeks: 20
})

// 计算当前周次
const currentWeekNumber = computed(() => {
  if (!courseSettings.value.semesterStartDate) return 1
  const startDate = dayjs(courseSettings.value.semesterStartDate)
  const today = dayjs()
  const diff = today.diff(startDate, 'week')
  return Math.max(1, diff + 1)
})

// 加载设置
onMounted(async () => {
  await settingsStore.loadSettings()
  // 同步到本地状态
  focusSettings.value.pomodoroDuration = settingsStore.settings.focus?.pomodoroDuration || 25
  courseSettings.value.semesterStartDate = settingsStore.settings.course?.semesterStartDate || ''
  courseSettings.value.totalWeeks = settingsStore.settings.course?.totalWeeks || 20
})

// 监听专注设置变化并保存
watch(() => focusSettings.value.pomodoroDuration, async (val) => {
  await settingsStore.updateFocusSettings({ pomodoroDuration: val })
})

// 监听课程表设置变化并保存
watch(() => courseSettings.value.semesterStartDate, async (val) => {
  await settingsStore.updateCourseSettings({ semesterStartDate: val })
})

watch(() => courseSettings.value.totalWeeks, async (val) => {
  await settingsStore.updateCourseSettings({ totalWeeks: val })
})
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(15, 12, 41, 0.6);
  backdrop-filter: blur(20px);
}

.settings-content {
  flex: 1;
  overflow: hidden;
}

.settings-section {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px 0;
}

.title-icon {
  font-size: 18px;
}

.section-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 20px 0;
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

.setting-tip {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  color: #667eea;
  font-size: 13px;
}
</style>
