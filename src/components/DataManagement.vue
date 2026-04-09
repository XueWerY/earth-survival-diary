<template>
  <div class="data-management">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>用户数据管理</span>
          <el-button type="primary" size="small" @click="refreshFiles">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button type="success" size="small" @click="backupData">
            <el-icon><Download /></el-icon>
            备份数据
          </el-button>
        </div>
      </template>
      
      <!-- 文件列表 -->
      <div class="file-list-section">
        <el-input
          v-model="searchQuery"
          placeholder="搜索文件"
          prefix-icon="el-icon-search"
          style="margin-bottom: 16px"
        />
        <el-table
          :data="filteredFiles"
          style="width: 100%"
          @row-click="handleFileClick"
        >
          <el-table-column prop="path" label="文件路径" min-width="400" />
          <el-table-column prop="size" label="大小" width="100">
            <template #default="{ row }">
              {{ formatFileSize(row.size) }}
            </template>
          </el-table-column>
          <el-table-column prop="mtime" label="修改时间" width="200">
            <template #default="{ row }">
              {{ formatDate(row.mtime) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click.stop="editFile(row)">
                编辑
              </el-button>
              <el-button type="danger" size="small" @click.stop="confirmDelete(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <!-- 文件编辑对话框 -->
      <el-dialog
        v-model="editDialogVisible"
        :title="editingFile ? `编辑文件: ${editingFile.path}` : '编辑文件'"
        width="80%"
        destroy-on-close
      >
        <div class="file-editor">
          <el-input
            :value="editingFile?.path"
            @input="updateFilePath"
            placeholder="文件路径"
            style="margin-bottom: 16px"
            :disabled="!editingFile"
          />
          <el-input
            v-model="fileContent"
            type="textarea"
            :rows="20"
            placeholder="文件内容"
            style="width: 100%"
          />
        </div>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="editDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveFile">保存</el-button>
          </span>
        </template>
      </el-dialog>
      
      <!-- 管理员管理 -->
      <div class="admin-section" style="margin-top: 32px">
        <h3>管理员管理</h3>
        <el-button type="primary" size="small" @click="refreshUsers">
          <el-icon><Refresh /></el-icon>
          刷新用户列表
        </el-button>
        <el-table
          :data="users"
          style="width: 100%; margin-top: 16px"
        >
          <el-table-column prop="email" label="邮箱" width="200" />
          <el-table-column prop="nickname" label="昵称" width="150" />
          <el-table-column prop="role" label="角色" width="100" />
          <el-table-column prop="createdAt" label="创建时间" width="200">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-select
                v-model="row.role"
                size="small"
                @change="updateUserRole(row.id, row.role)"
              >
                <el-option label="普通用户" value="user" />
                <el-option label="管理员" value="admin" />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Download } from '@element-plus/icons-vue'
import * as api from '../lib/api'

// 状态
const files = ref<api.FileInfo[]>([])
const users = ref<api.SystemUser[]>([])
const searchQuery = ref('')
const editDialogVisible = ref(false)
const editingFile = ref<api.FileInfo | null>(null)
const fileContent = ref('')

// 计算属性
const filteredFiles = computed(() => {
  if (!searchQuery.value) return files.value
  return files.value.filter(file => 
    file.path.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// 方法
const refreshFiles = async () => {
  try {
    const response = await api.getFiles()
    files.value = response.files
  } catch (error) {
    ElMessage.error('获取文件列表失败')
  }
}

const refreshUsers = async () => {
  try {
    const response = await api.getUsers()
    users.value = response.users
  } catch (error) {
    ElMessage.error('获取用户列表失败')
  }
}

const handleFileClick = (row: api.FileInfo) => {
  editFile(row)
}

const editFile = async (file: api.FileInfo) => {
  editingFile.value = file
  try {
    const response = await api.readFile(file.path)
    fileContent.value = response.content
    editDialogVisible.value = true
  } catch (error) {
    ElMessage.error('读取文件失败')
  }
}

const saveFile = async () => {
  if (!editingFile.value) return
  
  try {
    await api.writeFile(editingFile.value.path, fileContent.value)
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    refreshFiles()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const confirmDelete = async (file: api.FileInfo) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件 ${file.path} 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await api.deleteFile(file.path)
    ElMessage.success('删除成功')
    refreshFiles()
  } catch (error) {
    // 取消删除
  }
}

const backupData = async () => {
  try {
    const response = await api.backupFiles()
    ElMessage.success(`备份成功，文件名: ${response.backupFile}`)
  } catch (error) {
    ElMessage.error('备份失败')
  }
}

const updateUserRole = async (userId: string, role: string) => {
  try {
    await api.updateUserRole(userId, role as 'admin' | 'user')
    ElMessage.success('角色更新成功')
  } catch (error) {
    ElMessage.error('角色更新失败')
    // 恢复原来的角色
    refreshUsers()
  }
}

const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const updateFilePath = (value: string) => {
  if (editingFile.value) {
    editingFile.value.path = value
  }
}

// 生命周期
onMounted(() => {
  refreshFiles()
  refreshUsers()
})
</script>

<style scoped>
.data-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-editor {
  width: 100%;
}

.admin-section {
  margin-top: 32px;
}

.admin-section h3 {
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}
</style>