<template>
  <div class="date-scroll-picker">
    <div v-if="visible === undefined" class="date-trigger" @click="openDialog">
      <span>{{ displayDate }}</span>
    </div>
    <Teleport to="body">
      <div v-if="dialogVisible" class="date-dialog-overlay" @click.self="onCancel">
        <div class="date-dialog-container" @click.stop>
          <div class="date-dialog-header">
            <span class="date-dialog-title">{{ props.dialogTitle }}</span>
          </div>
          <div class="date-dialog-body">
            <div class="jump-toggle">
              <button
                class="capsule-btn"
                :class="{ 'capsule-btn-primary': !isLunarMode }"
                @click="switchToSolar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capsule-svg">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <span>公历</span>
              </button>
              <button
                class="capsule-btn"
                :class="{ 'capsule-btn-primary': isLunarMode }"
                @click="switchToLunar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capsule-svg">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                <span>农历</span>
              </button>
            </div>
            <div class="jump-scrolls">
              <div class="jump-scroll-col" data-app-scrollbar-off ref="yearScrollRef" @scroll="onYearScroll">
                <div class="jump-scroll-spacer"></div>
                <div
                  v-for="y in yearOptions"
                  :key="y.value"
                  class="jump-scroll-item"
                  :class="{ selected: pickerYear === y.value }"
                  @click="pickerYear = y.value; scrollToCol(yearScrollRef, yearOptions.findIndex(o => o.value === y.value))"
                >{{ y.label }}</div>
                <div class="jump-scroll-spacer"></div>
              </div>
              <div class="jump-scroll-col" data-app-scrollbar-off ref="monthScrollRef" @scroll="onMonthScroll">
                <div class="jump-scroll-spacer"></div>
                <div
                  v-for="m in monthOptions"
                  :key="m.value"
                  class="jump-scroll-item"
                  :class="{ selected: pickerMonth === m.value }"
                  @click="pickerMonth = m.value; scrollToCol(monthScrollRef, monthOptions.findIndex(o => o.value === m.value))"
                >{{ m.label }}</div>
                <div class="jump-scroll-spacer"></div>
              </div>
              <div class="jump-scroll-col" data-app-scrollbar-off ref="dayScrollRef" @scroll="onDayScroll">
                <div class="jump-scroll-spacer"></div>
                <div
                  v-for="d in dayOptions"
                  :key="d.value"
                  class="jump-scroll-item"
                  :class="{ selected: pickerDay === d.value }"
                  @click="pickerDay = d.value; scrollToCol(dayScrollRef, dayOptions.findIndex(o => o.value === d.value))"
                >{{ d.label }}</div>
                <div class="jump-scroll-spacer"></div>
              </div>
            </div>
            <div class="jump-actions">
              <button class="capsule-btn" style="border-radius:8px" @click="goToToday">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capsule-svg">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>回到今天</span>
              </button>
              <button class="capsule-btn" style="border-radius:8px" @click="onCancel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capsule-svg">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>取消</span>
              </button>
              <button class="capsule-btn capsule-btn-primary" style="border-radius:8px" @click="confirmDate">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capsule-svg">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>保存</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Solar, Lunar } from 'lunar-javascript'

const props = withDefaults(defineProps<{
  modelValue: string
  visible?: boolean
  dialogTitle?: string
  initialLunarMode?: boolean
}>(), {
  visible: undefined,
  dialogTitle: '跳转日期',
  initialLunarMode: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:visible', value: boolean): void
  (e: 'update:calendarMode', value: 'solar' | 'lunar'): void
}>()

const ITEM_HEIGHT = 36

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const dialogVisible = ref(false)
const isLunarMode = ref(false)

const pickerYear = ref(today.getFullYear())
const pickerMonth = ref(today.getMonth() + 1)
const pickerDay = ref(today.getDate())

const CHINESE_NUMERALS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const LUNAR_DAY_NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

const formatLunarYear = (year: number) =>
  `${String(year).split('').map(digit => CHINESE_NUMERALS[Number(digit)]).join('')}年`

const formatLunarDay = (day: number) => {
  if (day < 10) return `初${LUNAR_DAY_NUMERALS[day]}`
  if (day === 10) return '初十'
  if (day < 20) return `十${LUNAR_DAY_NUMERALS[day % 10]}`
  if (day === 20) return '二十'
  if (day < 30) return `廿${LUNAR_DAY_NUMERALS[day % 10]}`
  return '三十'
}

const yearScrollRef = ref<HTMLElement | null>(null)
const monthScrollRef = ref<HTMLElement | null>(null)
const dayScrollRef = ref<HTMLElement | null>(null)

const displayDate = computed(() => {
  if (!props.modelValue) return '选择日期'
  if (!props.initialLunarMode) return props.modelValue

  try {
    const [year, month, day] = props.modelValue.split('-').map(Number)
    const lunar = Solar.fromYmd(year, month, day).getLunar() as any
    return `农历${lunar.getYear()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
  } catch {
    return props.modelValue
  }
})

const yearOptions = computed(() => {
  const years = []
  for (let y = 1900; y <= 2100; y++) {
    years.push({ value: y, label: isLunarMode.value ? formatLunarYear(y) : `${y}年` })
  }
  return years
})

const monthOptions = computed(() => {
  const months = []
  if (isLunarMode.value) {
    for (let m = 1; m <= 12; m++) {
      months.push({ value: m, label: Lunar.fromYmd(pickerYear.value, m, 1).getMonthInChinese() + '月' })
    }
  } else {
    for (let m = 1; m <= 12; m++) {
      months.push({ value: m, label: String(m) + '月' })
    }
  }
  return months
})

const dayOptions = computed(() => {
  const days = []
  let maxDay = 31
  if (isLunarMode.value) {
    try {
      const lunar = Lunar.fromYmd(pickerYear.value, pickerMonth.value, 1)
      maxDay = lunar.getMonthMaxDay()
    } catch {
      maxDay = 30
    }
  } else {
    maxDay = new Date(pickerYear.value, pickerMonth.value, 0).getDate()
  }
  for (let d = 1; d <= maxDay; d++) {
    let label: string
    if (isLunarMode.value) {
      try {
        const lunar = Lunar.fromYmd(pickerYear.value, pickerMonth.value, d)
        const festivals = lunar.getFestivals()
        const jieQi = lunar.getJieQi()
        if (festivals.length > 0) {
          label = festivals[0]
        } else if (jieQi) {
          label = jieQi
        } else {
          const chineseDay = lunar.getDayInChinese()
          label = /^\d+$/.test(chineseDay) ? formatLunarDay(d) : chineseDay
        }
      } catch {
        label = formatLunarDay(d)
      }
    } else {
      label = String(d) + '日'
    }
    days.push({ value: d, label })
  }
  return days
})

const switchToLunar = () => {
  if (isLunarMode.value) return
  isLunarMode.value = true
  const solarDate = props.modelValue || todayStr
  const [y, m, d] = solarDate.split('-').map(Number)
  const solar = Solar.fromYmd(y, m, d)
  const lunar = solar.getLunar()
  pickerYear.value = lunar.getYear()
  pickerMonth.value = lunar.getMonth()
  pickerDay.value = lunar.getDay()
  scrollPicker()
}

const switchToSolar = () => {
  if (!isLunarMode.value) return
  try {
    const solar = Lunar.fromYmd(pickerYear.value, pickerMonth.value, pickerDay.value).getSolar()
    pickerYear.value = solar.getYear()
    pickerMonth.value = solar.getMonth()
    pickerDay.value = solar.getDay()
  } catch {
    return
  }
  isLunarMode.value = false
  scrollPicker()
}

const scrollToCol = (refEl: any, index: number) => {
  nextTick(() => {
    const el = refEl?.value || refEl
    if (el) {
      el.scrollTop = index * ITEM_HEIGHT
    }
  })
}

const scrollPicker = () => {
  nextTick(() => {
    const yIdx = yearOptions.value.findIndex(o => o.value === pickerYear.value)
    const mIdx = monthOptions.value.findIndex(o => o.value === pickerMonth.value)
    const dIdx = dayOptions.value.findIndex(o => o.value === pickerDay.value)
    scrollToCol(yearScrollRef, yIdx >= 0 ? yIdx : 0)
    scrollToCol(monthScrollRef, mIdx >= 0 ? mIdx : 0)
    scrollToCol(dayScrollRef, dIdx >= 0 ? dIdx : 0)
  })
}

const onYearScroll = () => {
  if (!yearScrollRef.value) return
  const idx = Math.round(yearScrollRef.value.scrollTop / ITEM_HEIGHT)
  if (idx >= 0 && idx < yearOptions.value.length) {
    pickerYear.value = yearOptions.value[idx].value
  }
}

const onMonthScroll = () => {
  if (!monthScrollRef.value) return
  const idx = Math.round(monthScrollRef.value.scrollTop / ITEM_HEIGHT)
  if (idx >= 0 && idx < monthOptions.value.length) {
    pickerMonth.value = monthOptions.value[idx].value
  }
}

const onDayScroll = () => {
  if (!dayScrollRef.value) return
  const idx = Math.round(dayScrollRef.value.scrollTop / ITEM_HEIGHT)
  if (idx >= 0 && idx < dayOptions.value.length) {
    pickerDay.value = dayOptions.value[idx].value
  }
}

const goToToday = () => {
  isLunarMode.value = false
  pickerYear.value = today.getFullYear()
  pickerMonth.value = today.getMonth() + 1
  pickerDay.value = today.getDate()
  scrollPicker()
}

const confirmDate = () => {
  let dateStr: string
  if (isLunarMode.value) {
    try {
      const lunar = Lunar.fromYmd(pickerYear.value, pickerMonth.value, pickerDay.value)
      const solar = lunar.getSolar()
      dateStr = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`
    } catch {
      return
    }
  } else {
    dateStr = `${pickerYear.value}-${String(pickerMonth.value).padStart(2, '0')}-${String(pickerDay.value).padStart(2, '0')}`
  }
  emit('update:modelValue', dateStr)
  emit('update:calendarMode', isLunarMode.value ? 'lunar' : 'solar')
  isLunarMode.value = false
  dialogVisible.value = false
}

const onCancel = () => {
  dialogVisible.value = false
}

const initPicker = () => {
  isLunarMode.value = props.initialLunarMode
  const solarDate = props.modelValue || todayStr
  const [y, m, d] = solarDate.split('-').map(Number)
  if (isLunarMode.value) {
    const lunar = Solar.fromYmd(y, m, d).getLunar()
    pickerYear.value = lunar.getYear()
    pickerMonth.value = lunar.getMonth()
    pickerDay.value = lunar.getDay()
  } else {
    pickerYear.value = y
    pickerMonth.value = m
    pickerDay.value = d
  }
  scrollPicker()
}

watch(dialogVisible, (val) => {
  if (val) {
    initPicker()
  }
  emit('update:visible', val)
})

watch(() => props.visible, (val) => {
  if (val !== undefined) {
    dialogVisible.value = val
  }
}, { immediate: true })

function openDialog() {
  if (props.visible !== undefined) {
    emit('update:visible', true)
  } else {
    dialogVisible.value = true
  }
}

watch([pickerYear, pickerMonth], () => {
  const maxDay = dayOptions.value.length
  if (pickerDay.value > maxDay) {
    pickerDay.value = maxDay
  }
})

const isCurrentLunarDayValid = (day: number) => {
  try {
    const lunar = (Lunar as any).fromYmd(pickerYear.value, pickerMonth.value, day)
    const roundTrip = lunar.getSolar().getLunar()
    return roundTrip.getYear() === Number(pickerYear.value)
      && Math.abs(roundTrip.getMonth()) === Math.abs(Number(pickerMonth.value))
      && roundTrip.getDay() === day
  } catch {
    return false
  }
}

watch(dayOptions, (options) => {
  if (!isLunarMode.value) return
  const validOptions = options.filter((option: any) => {
    const day = Number(option.value)
    return Number.isInteger(day) && isCurrentLunarDayValid(day)
  })
  if (validOptions.length !== options.length) {
    options.splice(0, options.length, ...validOptions)
  }
  if (!validOptions.some((option: any) => Number(option.value) === Number(pickerDay.value))) {
    pickerDay.value = Number(validOptions[validOptions.length - 1]?.value || 1)
  }
}, { immediate: true, flush: 'sync' })

</script>

<style scoped>
.date-scroll-picker { width: 100%; }

.date-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 32px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--chalk-blue);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.date-trigger:hover { border-color: rgba(102, 126, 234, 0.5); }

.date-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.date-dialog-container {
  background: rgba(30, 28, 52, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  width: 400px;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.date-dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px 12px;
  position: relative;
  flex-shrink: 0;
}

.date-dialog-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.date-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--chalk-white);
  text-align: center;
}

.date-dialog-body {
  padding: 12px 20px 20px;
  min-height: 0;
  overflow-y: auto;
}

.jump-toggle {
  display: flex;
  padding: 0 0 12px 0;
  gap: 8px;
}

.jump-toggle .capsule-btn {
  flex: 1;
  border-radius: 8px;
  height: 36px;
  font-size: 13px;
}

.jump-scrolls {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 108px;
  min-height: 108px;
  overflow: hidden;
}

.jump-scroll-col {
  width: 100%;
  min-width: 0;
  height: 108px;
  max-height: 108px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  scrollbar-width: none;
  scroll-snap-type: y mandatory;
}

.jump-scroll-col::-webkit-scrollbar {
  display: none;
}

.jump-scroll-spacer {
  height: 36px;
  flex-shrink: 0;
}

.jump-scroll-item {
  height: 36px;
  box-sizing: border-box;
  line-height: 36px;
  text-align: center;
  font-size: 16px;
  color: var(--chalk-white-30);
  scroll-snap-align: center;
  cursor: pointer;
  transition: color 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
}

.jump-scroll-item.selected {
  color: var(--chalk-primary);
  font-weight: 700;
  font-size: 18px;
}

.jump-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 12px;
}

.capsule-btn {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--chalk-white-60);
  cursor: pointer;
  border-radius: 16px;
  transition: all 0.2s;
  flex-shrink: 0;
  font-size: 12px;
}

.capsule-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--chalk-white);
}

.capsule-btn-primary {
  background: rgba(102, 126, 234, 0.3);
  color: var(--chalk-blue);
}

.capsule-btn-primary:hover {
  background: rgba(102, 126, 234, 0.45);
  color: #fff;
}

.capsule-svg {
  width: 14px;
  height: 14px;
}
</style>
