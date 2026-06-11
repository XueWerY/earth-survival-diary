<template>
  <div class="task-card">
    <div class="task-card-row">
      <span class="task-card-name">
        <span class="course-card-icon">📖</span>
        <span :style="{ color: course.color }">{{ course.name }}</span>
      </span>
    </div>
    <div class="course-card-row">
      <span class="course-card-week">{{ formatCourseWeeks(course.weeks) }}</span>
      <span v-if="course.periodText" class="course-card-period">{{ course.periodText }}</span>
      <span class="course-card-time">{{ course.startTime }} - {{ course.endTime }}</span>
    </div>
    <div v-if="course.location" class="course-card-location">📍 {{ course.location }}</div>
    <div v-if="course.teacher" class="course-card-teacher">👨‍🏫 {{ course.teacher }}</div>
    <div v-if="course.note" class="course-card-note">{{ course.note }}</div>
  </div>
</template>

<script setup lang="ts">
import type { CourseInfo } from '../../composables/useFootprintCards'

defineProps<{
  course: CourseInfo
}>()

const formatCourseWeeks = (weeks: number[]): string => {
  if (!weeks || weeks.length === 0) return '每周'
  const sorted = [...weeks].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let end = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`)
      if (i < sorted.length) { start = sorted[i]; end = sorted[i] }
    }
  }
  return `第${ranges.join(',')}周`
}
</script>

<style scoped>
.task-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s;
  text-align: left;
  width: 100%;
}

.task-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.task-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.task-card-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--chalk-white);
  flex: 1;
  min-width: 0;
}

.course-card-icon {
  margin-right: 6px;
  font-size: 14px;
}

.course-card-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  flex-wrap: wrap;
}

.course-card-week {
  color: var(--chalk-blue);
  font-weight: 500;
}

.course-card-period {
  color: var(--chalk-cyan);
  font-weight: 500;
}

.course-card-time {
  color: var(--chalk-blue);
  font-weight: 500;
}

.course-card-location {
  font-size: 12px;
  color: var(--chalk-white-60);
  margin-top: 6px;
}

.course-card-teacher {
  font-size: 12px;
  color: var(--chalk-white-60);
  margin-top: 4px;
}

.course-card-note {
  font-size: 12px;
  color: var(--chalk-subtle);
  margin-top: 6px;
  line-height: 1.4;
}
</style>