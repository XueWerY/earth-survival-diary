<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <h1 class="auth-title">地球 Online 生存日记</h1>
      </div>

      <div class="auth-tabs">
        <div
            class="tab-item"
            :class="{ active: mode === 'login' }"
            @click="mode = 'login'"
        >
          登录
        </div>
        <div
            class="tab-item"
            :class="{ active: mode === 'register' }"
            @click="switchMode('register')"
        >
          注册
        </div>
      </div>

      <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          class="auth-form"
          @submit.prevent="handleSubmit"
      >
        <el-form-item prop="email">
          <el-input
              v-if="mode === 'register'"
              v-model="form.email"
              placeholder="请输入邮箱"
              size="large"
              :prefix-icon="Message"
          />
          <el-select
              v-else
              v-model="form.email"
              placeholder="请输入邮箱"
              size="large"
              filterable
              allow-create
              class="email-select"
          >
            <el-option
                v-for="item in allEmailOptions"
                :key="item.email"
                :label="item.email"
                :value="item.email"
            >
              <div class="history-option">
                <el-icon><Message /></el-icon>
                <span>{{ item.email }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item prop="password">
          <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              :prefix-icon="Lock"
              show-password
          />
        </el-form-item>

        <el-form-item v-if="mode === 'register'" prop="confirmPassword">
          <el-input
              v-model="form.confirmPassword"
              type="password"
              placeholder="请确认密码"
              size="large"
              :prefix-icon="Lock"
              show-password
          />
        </el-form-item>

        <el-form-item v-if="mode === 'register'" prop="nickname">
          <el-input
              v-model="form.nickname"
              placeholder="请输入昵称（可选）"
              size="large"
              :prefix-icon="User"
          />
        </el-form-item>

        <el-button
            type="primary"
            size="large"
            class="submit-btn"
            :loading="submitting"
            @click="handleSubmit"
        >
          {{ mode === 'login' ? '登录' : '注册' }}
        </el-button>
      </el-form>

      <div class="auth-footer">
        <div v-if="mode === 'login'" class="footer-row">
          <span>还没有账号？</span>
          <span class="link" @click="switchMode('register')">立即注册</span>
          <span class="divider">|</span>
          <span class="import-link" @click="showImportDialog = true">导入数据</span>
        </div>
        <div v-else class="footer-row">
          <span>已有账号？</span>
          <span class="link" @click="switchMode('login')">立即登录</span>
          <span class="divider">|</span>
          <span class="import-link" @click="showImportDialog = true">导入数据</span>
        </div>
      </div>

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
          <p class="import-desc-text">请选择通过该应用导出的 earth-survival-diary-export-邮箱-YYYY-MM-DD.json 文件，导入可能会覆盖当前用户的对应数据。</p>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Message, Lock, User } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useAuthStore } from '../stores/authStore'
import { logger } from '../lib/logger'
import * as api from '../lib/api'

const emit = defineEmits<{
  success: []
}>()

const authStore = useAuthStore()

const mode = ref<'login' | 'register'>('login')
const formRef = ref<FormInstance>()
const submitting = ref(false)
const allUsers = ref<Array<{ email: string, nickname: string }>>([])

const switchMode = (newMode: 'login' | 'register') => {
  mode.value = newMode
  form.email = ''
  form.password = ''
  form.confirmPassword = ''
  form.nickname = ''
}

onMounted(async () => {
  try {
    const res = await api.getUsers()
    allUsers.value = res.users || []
  } catch (e) { /* ignore */ }
})

const allEmailOptions = computed(() => {
  return allUsers.value.map(u => ({ email: u.email }))
})

const showImportDialog = ref(false)
const importing = ref(false)
const importDataRaw = ref<any>(null)
const importFileInfo = ref<{ name: string, exportTime?: string } | null>(null)
const selectedImportModules = ref<string[]>(['user_index', 'tasks', 'focus_favorites', 'focus_records', 'lists', 'countdown', 'courses', 'notebooks', 'profile', 'login_info', 'settings', 'system_state'])
const expandedImportGroups = ref<string[]>(['tasks', 'focus', 'lists', 'countdown', 'courses', 'notes', 'profile'])
const selectAllModules = ref(true)

const allImportModuleKeys = computed(() => {
  const keys: string[] = []
  importGroups.forEach(group => {
    group.children.forEach(child => keys.push(child.key))
  })
  return keys
})

const onSelectAllChange = (checked: boolean) => {
  if (checked) {
    selectedImportModules.value = allImportModuleKeys.value.filter(key => importDataAvailable.value[key])
  } else {
    selectedImportModules.value = []
  }
}

const importGroups = [
  { key: 'tasks', label: '足迹', children: [{ key: 'tasks', label: '足迹记录' }] },
  {
    key: 'focus', label: '专注',
    children: [
      { key: 'focus_favorites', label: '常用专注' },
      { key: 'focus_records', label: '专注记录' }
    ]
  },
  { key: 'lists', label: '清单', children: [{ key: 'lists', label: '清单列表及其任务' }] },
  { key: 'countdown', label: '倒数日', children: [{ key: 'countdown', label: '倒数日分类及其倒数日' }] },
  { key: 'courses', label: '课程表', children: [{ key: 'courses', label: '课程' }] },
  { key: 'notes', label: '笔记', children: [{ key: 'notebooks', label: '笔记本及其笔记' }] },
  {
    key: 'profile', label: '我的',
    children: [
      { key: 'user_index', label: '账户信息' },
      { key: 'profile', label: '我的' },
      { key: 'login_info', label: '登录信息' },
      { key: 'settings', label: '设置' },
      { key: 'system_state', label: '系统状态' }
    ]
  }
]

const importKeyMapping: Record<string, string[]> = {
  lists: ['lists', 'missions'],
  countdown: ['countdown_categories', 'countdowns'],
  courses: ['courses', 'course_recorded_courses'],
  notebooks: ['notebooks', 'notes']
}

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

const toggleImportGroup = (key: string) => {
  const idx = expandedImportGroups.value.indexOf(key)
  if (idx >= 0) expandedImportGroups.value.splice(idx, 1)
  else expandedImportGroups.value.push(key)
}

const formatExportTime = (time?: string) => {
  if (!time) return '未知'
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  nickname: ''
})

const validatePassword = (_rule: any, value: any, callback: any) => {
  if (mode.value === 'register' && value.length < 6) {
    callback(new Error('密码长度至少6位'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (_rule: any, value: any, callback: any) => {
  if (mode.value === 'register' && value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { validator: validatePassword, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (mode.value === 'login') {
      await authStore.signIn(form.email, form.password)
      logger.info('[Auth] 用户登录成功', { email: form.email })
      ElMessage.success('登录成功')
    } else {
      await authStore.signUp(form.email, form.password, form.nickname || undefined)
      logger.info('[Auth] 用户注册成功', { email: form.email })
      ElMessage.success('注册成功')
    }
    emit('success')
  } catch (error: any) {
    console.error('认证失败:', error)
    ElMessage.error(error.message || (mode.value === 'login' ? '登录失败' : '注册失败'))
  } finally {
    submitting.value = false
  }
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

  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || ''
  // 只允许包含邮箱标识的文件
  const emailMatch = fileName.match(/earth-survival-diary-export-([^@]+@[^\-]+)-\d{4}-\d{2}-\d{2}\.json/)
  if (!emailMatch) {
    ElMessage.error('请选择包含邮箱标识的导出文件（格式：earth-survival-diary-export-邮箱-YYYY-MM-DD.json）')
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

    logger.info('[Auth] 导入数据成功，准备重启应用', { modules: selectedImportModules.value })

    // 导入成功后重启应用
    ElMessage.success('导入成功')
    setTimeout(async () => {
      window.electronAPI.restartApp()
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
</script>

<style scoped>
.auth-page {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 20px;
}

.auth-container {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 40px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.auth-header {
  text-align: center;
  margin-bottom: 30px;
}

.auth-title {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.auth-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.auth-tabs {
  display: flex;
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 4px;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 12px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s;
}

.tab-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.auth-form {
  margin-bottom: 20px;
}

.auth-form :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.auth-form :deep(.el-input__wrapper:hover) {
  border-color: rgba(102, 126, 234, 0.5);
}

.auth-form :deep(.el-input__wrapper.is-focus) {
  border-color: #667eea;
}

.auth-form :deep(.el-input__inner) {
  color: #fff;
}

.email-select :deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.email-select :deep(.el-select__wrapper:hover) {
  border-color: rgba(102, 126, 234, 0.5);
}

.email-select :deep(.el-select__wrapper.is-focus) {
  border-color: #667eea;
}

.email-select :deep(.el-select__input) {
  color: #fff;
}

.history-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-option span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-option .delete-icon {
  color: #f56c6c;
  cursor: pointer;
}

.history-option .delete-icon:hover {
  color: #f89898;
}

.el-select-dropdown__item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.auth-form :deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

.auth-form :deep(.el-input__prefix) {
  color: rgba(255, 255, 255, 0.4);
}

.auth-form :deep(.el-form-item__error) {
  color: #f87171;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  font-size: 16px;
  height: 48px;
  border-radius: 10px;
}

.submit-btn:hover {
  opacity: 0.9;
}

.auth-footer {
  text-align: center;
}

.footer-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.divider {
  color: rgba(255, 255, 255, 0.2);
}

.import-link {
  color: #667eea;
  cursor: pointer;
  font-size: 13px;
}

.import-link:hover {
  text-decoration: underline;
}

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
  color: #606266;
  font-size: 13px;
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.import-file-info p {
  margin: 4px 0;
  font-size: 14px;
  color: #606266;
}

.import-select-prompt {
  text-align: center;
  color: #909399;
  padding: 20px 0;
  font-size: 14px;
}

.select-all-row {
  padding: 4px 0 8px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 8px;
}

.import-tree {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
}

.import-group {
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

.child-item :deep(.el-checkbox.is-disabled .el-checkbox__label) {
  color: rgba(255, 255, 255, 0.3);
}
</style>
