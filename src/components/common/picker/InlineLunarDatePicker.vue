<template>
  <div
    class="inline-picker-container"
    :class="{ 'hide-header-actions': !showHeaderActions }"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div class="picker-header">
      <div class="header-left">
        <span class="year-month">{{ currentYear }}年{{ currentMonth }}月</span>
      </div>
      <div v-if="showHeaderActions" class="header-right">
        <button class="icon-btn" title="跳转日期" @click="showDatePicker = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </button>
        <button class="icon-btn add-btn" title="添加足迹" @click="emit('addFootprint')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button class="icon-btn diary-btn" title="添加日记" @click="emit('addDiary')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </button>
      </div>
    </div>

    <div class="weekdays">
      <span v-for="day in weekdays" :key="day" class="weekday">{{ day }}</span>
    </div>

    <div class="days-grid">
      <template v-for="(row, rowIdx) in visibleRows" :key="rowIdx">
        <div
          v-for="day in row"
          :key="day.key"
          class="day-cell"
          :class="{
            'empty-cell': !day.currentMonth,
            'today': day.isToday,
            'selected': day.date === selectedDateStr
          }"
          @click="selectDate(day)"
        >
          <template v-if="day.currentMonth">
            <span class="solar-day">{{ day.day }}</span>
            <span class="lunar-day-text" :class="{ festival: day.festival }">{{ day.lunarLabel }}</span>
          </template>
        </div>
      </template>
    </div>

    <div class="expand-hint" @click="expanded = !expanded">
      <span class="hint-dot" :class="{ 'collapse-dot': expanded }"></span>
    </div>

    <DateScrollPicker
      v-model="datePickerValue"
      v-model:visible="showDatePicker"
      @update:model-value="onDatePicked"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Solar } from 'lunar-javascript'
import DateScrollPicker from './DateScrollPicker.vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  showHeaderActions?: boolean
}>(), {
  showHeaderActions: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'addFootprint'): void
  (e: 'addDiary'): void
}>()

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth() + 1)
const expanded = ref(false)
const weekOffset = ref(0)
const showDatePicker = ref(false)
const datePickerValue = ref(todayStr)

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const selectedDateStr = computed(() => {
  if (props.modelValue) return props.modelValue
  emit('update:modelValue', todayStr)
  return todayStr
})

const days = computed(() => {
  const result: any[] = []
  const firstDay = new Date(currentYear.value, currentMonth.value - 1, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value, 0)
  const startDay = firstDay.getDay()

  for (let i = startDay - 1; i >= 0; i--) {
    result.push({ key: `empty-${i}`, year: 0, month: 0, day: 0, date: '', currentMonth: false, isToday: false, lunarLabel: '', festival: false })
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const solar = Solar.fromYmd(currentYear.value, currentMonth.value, day)
    const lunar = solar.getLunar()
    const isToday =
      currentYear.value === today.getFullYear() &&
      currentMonth.value === today.getMonth() + 1 &&
      day === today.getDate()

    let lunarLabel = lunar.getDayInChinese()
    let festival = false
    const festivals = lunar.getFestivals()
    const jieQi = lunar.getJieQi()

    if (festivals.length > 0) {
      lunarLabel = festivals[0]
      festival = true
    } else if (jieQi) {
      lunarLabel = jieQi
      festival = true
    } else if (lunar.getDay() === 1) {
      lunarLabel = lunar.getMonthInChinese() + '月'
    }

    result.push({
      key: `d-${day}`,
      year: currentYear.value,
      month: currentMonth.value,
      day,
      date: `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      currentMonth: true,
      isToday,
      lunarLabel,
      festival
    })
  }

  return result
})

const rows = computed(() => {
  const result: any[][] = []
  const allDays = days.value
  for (let i = 0; i < allDays.length; i += 7) {
    result.push(allDays.slice(i, i + 7))
  }
  return result
})

const computedWeekOffset = computed(() => {
  const selDate = selectedDateStr.value
  if (!selDate) return 0
  const [y, m, d] = selDate.split('-').map(Number)
  if (y !== currentYear.value || m !== currentMonth.value) return 0
  const firstDay = new Date(currentYear.value, currentMonth.value - 1, 1)
  const startDay = firstDay.getDay()
  const totalDaysBefore = startDay + (d - 1)
  return Math.floor(totalDaysBefore / 7)
})

const visibleRows = computed(() => {
  if (expanded.value) return rows.value
  const totalRows = rows.value.length
  const idx = Math.max(0, Math.min(computedWeekOffset.value, totalRows - 1))
  if (totalRows === 0) return []
  return [rows.value[idx]]
})

const clampWeekOffset = () => {
  const totalRows = rows.value.length
  weekOffset.value = Math.max(0, Math.min(weekOffset.value, totalRows - 1))
}

watch([currentYear, currentMonth], () => {
  weekOffset.value = computedWeekOffset.value
  clampWeekOffset()
})

watch(() => props.modelValue, (val) => {
  if (val) {
    const [y, m] = val.split('-').map(Number)
    currentYear.value = y
    currentMonth.value = m
    weekOffset.value = computedWeekOffset.value
    clampWeekOffset()
  }
})

const selectDate = (day: any) => {
  if (!day.currentMonth) return
  emit('update:modelValue', day.date)
}

const prevMonth = () => {
  if (expanded.value) {
    if (currentMonth.value === 1) {
      currentMonth.value = 12
      currentYear.value--
    } else {
      currentMonth.value--
    }
  } else {
    if (weekOffset.value <= 0) {
      if (currentMonth.value === 1) {
        currentMonth.value = 12
        currentYear.value--
      } else {
        currentMonth.value--
      }
      weekOffset.value = rows.value.length - 1
      clampWeekOffset()
    } else {
      weekOffset.value--
      clampWeekOffset()
    }
  }
}

const nextMonth = () => {
  if (expanded.value) {
    if (currentMonth.value === 12) {
      currentMonth.value = 1
      currentYear.value++
    } else {
      currentMonth.value++
    }
  } else {
    if (weekOffset.value >= rows.value.length - 1) {
      if (currentMonth.value === 12) {
        currentMonth.value = 1
        currentYear.value++
      } else {
        currentMonth.value++
      }
      weekOffset.value = 0
      clampWeekOffset()
    } else {
      weekOffset.value++
      clampWeekOffset()
    }
  }
}

let touchStartX = 0
let touchStartY = 0
let touchMoved = false

const onTouchStart = (e: TouchEvent) => {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  touchMoved = false
}

const onTouchMove = (e: TouchEvent) => {
  touchMoved = true
}

const onTouchEnd = (e: TouchEvent) => {
  if (!touchMoved) return
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY

  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 30) {
    if (dy > 30 && !expanded.value) {
      expanded.value = true
    } else if (dy < -30 && expanded.value) {
      expanded.value = false
      clampWeekOffset()
    }
  } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
    if (dx < -40) {
      nextMonth()
    } else if (dx > 40) {
      prevMonth()
    }
  }
}

watch(expanded, (val) => {
  if (!val) {
    weekOffset.value = computedWeekOffset.value
    clampWeekOffset()
  }
})

const onDatePicked = (dateStr: string) => {
  datePickerValue.value = dateStr
  emit('update:modelValue', dateStr)
  const [y, m] = dateStr.split('-').map(Number)
  currentYear.value = y
  currentMonth.value = m
  weekOffset.value = computedWeekOffset.value
  clampWeekOffset()
}

defineExpose({ openDatePicker: () => { showDatePicker.value = true } })
</script>

<style scoped>
.inline-picker-container {
  width: 100%;
  max-width: 600px;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-x pan-y;
}

.hide-header-actions {
  max-width: 500px;
}

.hide-header-actions .picker-header {
  justify-content: center;
}

.hide-header-actions .header-left {
  text-align: center;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 8px 0;
}

.header-left {
  flex: 55;
  text-align: left;
}

.header-right {
  flex: 45;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0;
}

.year-month {
  font-size: 18px;
  font-weight: 700;
  color: var(--chalk-white);
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--chalk-white-70);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--chalk-white);
}

.icon-btn.add-btn:hover {
  background: rgba(102, 126, 234, 0.25);
  color: var(--chalk-blue);
}

.icon-btn.diary-btn:hover {
  background: rgba(167, 139, 250, 0.25);
  color: var(--chalk-violet);
}

.icon-svg {
  width: 18px;
  height: 18px;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 4px 0;
}

.weekday {
  text-align: center;
  font-size: 12px;
  color: var(--chalk-subtle);
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 2px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
}

.day-cell.empty-cell {
  cursor: default;
}

.day-cell.today .solar-day {
  font-weight: 800;
  color: var(--chalk-blue);
}

.day-cell.selected .solar-day {
  font-weight: 800;
  color: var(--chalk-primary);
}

.solar-day {
  font-size: 14px;
  color: var(--chalk-white);
  font-weight: 500;
  line-height: 1.2;
}

.lunar-day-text {
  font-size: 10px;
  color: var(--chalk-subtle);
  line-height: 1.1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lunar-day-text.festival {
  color: var(--chalk-orange);
}

.expand-hint {
  display: flex;
  justify-content: center;
  padding: 4px 0 2px;
}

.hint-dot {
  width: 28px;
  height: 3px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  transition: all 0.2s;
}

.collapse-dot {
  height: 2px;
  background: rgba(255, 255, 255, 0.25);
}
</style>