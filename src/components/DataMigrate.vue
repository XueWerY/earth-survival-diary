<template>
  <el-dialog
      v-model="visible"
      title="数据迁移"
      width="500px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
  >
    <div class="migrate-content">
      <el-icon class="migrate-icon"><Upload /></el-icon>
      <p class="migrate-desc">
        检测到浏览器本地存储中有数据，是否迁移到服务器统一存储？
      </p>
      <p class="migrate-hint">
        迁移后，您的数据将保存在服务器的 YAML 文件中，可在不同设备间共享。
      </p>

      <div v-if="migrating" class="migrate-progress">
        <el-progress :percentage="progress" :status="progress === 100 ? 'success' : ''" />
        <p>{{ migrateStatus }}</p>
      </div>
    </div>

    <template #footer>
      <el-button @click="skipMigrate" :disabled="migrating">跳过</el-button>
      <el-button type="primary" @click="doMigrate" :loading="migrating">
        开始迁移
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'

const emit = defineEmits(['migrated', 'skip'])

const visible = ref(false)
const migrating = ref(false)
const progress = ref(0)
const migrateStatus = ref('')

// 需要迁移的数据键名列表
const MIGRATE_KEYS = [
  'earth-survival-tasks',
  'earth-survival-current-page',
  'earth-survival-courses',
  'earth-survival-semester',
  'earth-survival-recorded-courses',
  'earth-survival-date-state',
  'earth-survival-mission-state',
  'earth-survival-milestones',
  'earth-survival-milestone-state',
  'mission-lists',
  'mission-missions'
]

// 检查是否有本地数据需要迁移
function hasLocalData(): boolean {
  return MIGRATE_KEYS.some(key => {
    const data = localStorage.getItem(key)
    return data !== null && data !== undefined && data !== ''
  })
}

// 收集本地数据
function collectLocalData(): Record<string, any> {
  const data: Record<string, any> = {}

  for (const key of MIGRATE_KEYS) {
    const value = localStorage.getItem(key)
    if (value !== null && value !== undefined && value !== '') {
      try {
        data[key] = JSON.parse(value)
      } catch {
        data[key] = value
      }
    }
  }

  return data
}

// 执行迁移
async function doMigrate() {
  migrating.value = true
  progress.value = 0
  migrateStatus.value = '正在收集本地数据...'

  try {
    // 收集数据
    const localData = collectLocalData()
    progress.value = 30
    migrateStatus.value = `发现 ${Object.keys(localData).length} 项数据，正在上传...`

    // 发送到服务器
    const response = await fetch('/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: localData })
    })

    progress.value = 70

    const result = await response.json()

    if (result.success) {
      progress.value = 100
      migrateStatus.value = `迁移完成！已迁移 ${result.migrated} 项数据`

      // 清理本地存储（可选）
      setTimeout(() => {
        MIGRATE_KEYS.forEach(key => localStorage.removeItem(key))
        ElMessage.success('数据迁移成功，本地缓存已清理')
        visible.value = false
        emit('migrated')
      }, 1000)
    } else {
      throw new Error(result.error || '迁移失败')
    }
  } catch (err: any) {
    migrateStatus.value = `迁移失败: ${err.message || '未知错误'}`
    ElMessage.error('数据迁移失败，请重试')
  } finally {
    migrating.value = false
  }
}

// 跳过迁移
function skipMigrate() {
  visible.value = false
  emit('skip')
}

onMounted(() => {
  // 检查是否需要迁移
  if (hasLocalData()) {
    // 检查是否已经迁移过
    const migrated = localStorage.getItem('earth-survival-data-migrated')
    if (!migrated) {
      visible.value = true
    }
  }
})
</script>

<style scoped>
.migrate-content {
  text-align: center;
  padding: 20px 0;
}

.migrate-icon {
  font-size: 48px;
  color: #667eea;
  margin-bottom: 16px;
}

.migrate-desc {
  font-size: 16px;
  color: #333;
  margin-bottom: 12px;
}

.migrate-hint {
  font-size: 13px;
  color: #909399;
  margin-bottom: 20px;
}

.migrate-progress {
  margin-top: 20px;
}
</style>
