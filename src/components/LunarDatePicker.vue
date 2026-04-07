<template>
  <el-popover
      v-model:visible="showPicker"
      placement="bottom-start"
      :width="320"
      trigger="click"
      popper-class="lunar-date-picker-popover"
  >
    <template #reference>
      <div
          class="date-picker-trigger"
          :class="{ 'size-small': size === 'small', 'size-large': size === 'large', 'full-width': fullWidth }"
      >
        <svg class="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span class="date-text">{{ displayDate }}</span>
        <span v-if="showLunar && modelValue" class="lunar-text">{{ lunarDateStr }}</span>
      </div>
    </template>

    <div class="date-picker-content">
      <!-- 月份导航 -->
      <div class="picker-header">
        <button class="nav-btn" @click="prevYear">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="11 17 6 12 11 7"></polyline>
            <polyline points="18 17 13 12 18 7"></polyline>
          </svg>
        </button>
        <button class="nav-btn" @click="prevMonth">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="current-date">
          <span class="year-month">{{ currentYear }}年{{ currentMonth }}月</span>
          <span class="lunar-month">{{ lunarMonthStr }}</span>
        </div>
        <button class="nav-btn" @click="nextMonth">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <button class="nav-btn" @click="nextYear">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="13 17 18 12 13 7"></polyline>
            <polyline points="6 17 11 12 6 7"></polyline>
          </svg>
        </button>
      </div>

      <!-- 星期标题 -->
      <div class="weekdays">
        <span v-for="day in weekdays" :key="day" class="weekday">{{ day }}</span>
      </div>

      <!-- 日期网格 -->
      <div class="days-grid">
        <div
            v-for="(day, index) in days"
            :key="index"
            class="day-cell"
            :class="{
            'other-month': !day.currentMonth,
            'today': day.isToday,
            'selected': day.date === selectedDateStr,
            'festival': day.festival
          }"
            @click="selectDate(day)"
        >
          <span class="solar-day">{{ day.day }}</span>
          <span v-if="showLunar" class="lunar-day" :class="{ festival: day.lunarFestival }">
            {{ day.lunarDay }}
          </span>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="picker-footer">
        <button class="today-btn" @click="selectToday">今天</button>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Solar } from 'lunar-javascript'

const props = withDefaults(defineProps<{
  modelValue?: string // YYYY-MM-DD format
  showLunar?: boolean
  placeholder?: string
  size?: 'default' | 'small' | 'large'
  fullWidth?: boolean
}>(), {
  showLunar: true,
  placeholder: '选择日期',
  size: 'default',
  fullWidth: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const showPicker = ref(false)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const selectedDateStr = computed(() => props.modelValue || '')

// 显示日期
const displayDate = computed(() => {
  if (props.modelValue) {
    const [y, m, d] = props.modelValue.split('-')
    return `${y}/${m}/${d}`
  }
  return props.placeholder
})

// 农历日期显示
const lunarDateStr = computed(() => {
  if (props.modelValue) {
    const [y, m, d] = props.modelValue.split('-').map(Number)
    const solar = Solar.fromYmd(y, m, d)
    const lunar = solar.getLunar()
    return `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
  }
  return ''
})

// 当前月份的农历月份
const lunarMonthStr = computed(() => {
  const solar = Solar.fromYmd(currentYear.value, currentMonth.value, 1)
  const lunar = solar.getLunar()
  return `${lunar.getMonthInChinese()}月`
})

// 生成日期网格
const days = computed(() => {
  const result: any[] = []
  const firstDay = new Date(currentYear.value, currentMonth.value - 1, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value, 0)
  const startDay = firstDay.getDay()

  // 上个月的日期
  const prevMonthDays = new Date(currentYear.value, currentMonth.value - 1, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i
    const prevMonth = currentMonth.value === 1 ? 12 : currentMonth.value - 1
    const prevYear = currentMonth.value === 1 ? currentYear.value - 1 : currentYear.value
    result.push(createDayCell(prevYear, prevMonth, day, false))
  }

  // 当前月的日期
  for (let day = 1; day <= lastDay.getDate(); day++) {
    result.push(createDayCell(currentYear.value, currentMonth.value, day, true))
  }

  // 下个月的日期
  const remaining = 42 - result.length
  const nextMonth = currentMonth.value === 12 ? 1 : currentMonth.value + 1
  const nextYear = currentMonth.value === 12 ? currentYear.value + 1 : currentYear.value
  for (let day = 1; day <= remaining; day++) {
    result.push(createDayCell(nextYear, nextMonth, day, false))
  }

  return result
})

// 创建日期单元格数据
const createDayCell = (year: number, month: number, day: number, currentMonth: boolean) => {
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()
  const today = new Date()
  const isToday = currentMonth &&
      year === today.getFullYear() &&
      month === today.getMonth() + 1 &&
      day === today.getDate()

  // 获取农历日
  let lunarDay = lunar.getDayInChinese()
  const lunarFestival = lunar.getFestivals().length > 0

  // 农历节日或节气
  const festivals = lunar.getFestivals()
  const jieQi = lunar.getJieQi()

  if (festivals.length > 0) {
    lunarDay = festivals[0]
  } else if (jieQi) {
    lunarDay = jieQi
  } else if (lunar.getDay() === 1) {
    lunarDay = lunar.getMonthInChinese() + '月'
  }

  return {
    year,
    month,
    day,
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    currentMonth,
    isToday,
    lunarDay,
    lunarFestival,
    festival: festivals.length > 0 || !!jieQi
  }
}

// 选择日期
const selectDate = (day: any) => {
  emit('update:modelValue', day.date)
  showPicker.value = false
}

// 选择今天
const selectToday = () => {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  emit('update:modelValue', dateStr)
  currentYear.value = today.getFullYear()
  currentMonth.value = today.getMonth() + 1
  showPicker.value = false
}

// 导航
const prevYear = () => {
  currentYear.value--
}

const nextYear = () => {
  currentYear.value++
}

const prevMonth = () => {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

// 同步选中日期到当前视图
watch(() => props.modelValue, (val) => {
  if (val) {
    const [y, m] = val.split('-').map(Number)
    currentYear.value = y
    currentMonth.value = m
  }
}, { immediate: true })
</script>

<style scoped>
.date-picker-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.date-picker-trigger.full-width {
  width: 100%;
}

.date-picker-trigger.size-small {
  padding: 6px 10px;
  gap: 6px;
}

.date-picker-trigger.size-small .calendar-icon {
  width: 14px;
  height: 14px;
}

.date-picker-trigger.size-small .date-text {
  font-size: 13px;
}

.date-picker-trigger.size-large {
  padding: 10px 16px;
  gap: 10px;
}

.date-picker-trigger.size-large .calendar-icon {
  width: 18px;
  height: 18px;
}

.date-picker-trigger.size-large .date-text {
  font-size: 15px;
}

.date-picker-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.calendar-icon {
  width: 16px;
  height: 16px;
  color: rgba(255, 255, 255, 0.6);
}

.date-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.lunar-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
}

.date-picker-content {
  background: rgba(26, 26, 46, 0.98);
  border-radius: 12px;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.nav-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav-btn svg {
  width: 16px;
  height: 16px;
}

.current-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.year-month {
  font-size: 15px;
  font-weight: 600;
  color: white;
}

.lunar-month {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.weekday {
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding: 8px;
}

.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 40px;
}

.day-cell:hover {
  background: rgba(255, 255, 255, 0.1);
}

.day-cell.other-month {
  opacity: 0.3;
}

.day-cell.today {
  background: rgba(102, 126, 234, 0.2);
}

.day-cell.selected {
  background: rgba(102, 126, 234, 0.4);
}

.day-cell.festival .lunar-day {
  color: #f59e0b;
}

.solar-day {
  font-size: 14px;
  color: white;
  font-weight: 500;
}

.lunar-day {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.lunar-day.festival {
  color: #f59e0b;
}

.picker-footer {
  display: flex;
  justify-content: center;
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.today-btn {
  padding: 8px 20px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 6px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.today-btn:hover {
  background: rgba(102, 126, 234, 0.3);
}
</style>
