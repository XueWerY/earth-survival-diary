<template>
  <div class="move-form-page">
    <div class="move-form-container">
      <el-form label-width="80px" class="form-body">
        <el-form-item label="任务名称">
          <span class="move-mission-name">{{ missionName }}</span>
        </el-form-item>
        <el-form-item label="目标清单">
          <el-select v-model="targetListId" placeholder="选择清单" style="width: 100%" @change="onListChange">
            <el-option v-for="list in allLists" :key="list.id" :label="list.name" :value="list.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标分组">
          <el-select v-model="targetGroupId" placeholder="选择分组" style="width: 100%">
            <el-option v-for="group in targetGroups" :key="group.id" :label="group.name" :value="group.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <div class="form-footer">
            <el-button type="primary" @click="handleSubmit">确定移动</el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMissionStore } from '../stores/missionStore'

const props = defineProps<{ missionId: string }>()

const emit = defineEmits<{
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'cancel'): void
}>()

const missionStore = useMissionStore()

const targetListId = ref('')
const targetGroupId = ref('')

const mission = computed(() => missionStore.missions.find(m => m.id === props.missionId))
const missionName = computed(() => mission.value?.name || '')

const allLists = computed(() => missionStore.lists.filter(l => l.id !== mission.value?.listId))

const targetGroups = computed(() => {
  const lid = targetListId.value
  if (!lid) return []
  const list = missionStore.lists.find(l => l.id === lid)
  return list?.groups || []
})

function onListChange() {
  const g = targetGroups.value
  targetGroupId.value = g.length > 0 ? g[0].id : ''
}

function handleSubmit() {
  if (!targetListId.value || !targetGroupId.value) return
  emit('submit', { listId: targetListId.value, groupId: targetGroupId.value })
}
</script>

<style scoped>
.move-form-page {
  width: 100%;
  height: 100%;
  padding: 20px 24px;
  box-sizing: border-box;
}
.move-form-container {
  max-width: 400px;
  margin: 0 auto;
}
.move-mission-name {
  color: #fff;
  font-size: 14px;
}
.form-footer {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-top: 24px;
}
</style>