<template>
  <div class="profile-page">
    <div class="profile-content">
      <el-scrollbar>
        <div class="profile-section">
          <h3 class="section-title">个人信息</h3>

          <el-form
              ref="formRef"
              :model="form"
              :rules="rules"
              label-position="top"
              class="profile-form"
          >
            <el-form-item label="昵称" prop="nickname">
              <el-input
                  v-model="form.nickname"
                  placeholder="请输入昵称"
                  maxlength="20"
                  show-word-limit
              />
            </el-form-item>

            <el-form-item label="生日">
              <LunarDatePicker
                  v-model="form.birthday"
                  placeholder="选择生日"
                  full-width
              />
            </el-form-item>

            <el-form-item>
              <el-button
                  type="primary"
                  :loading="saving"
                  @click="handleSave"
              >
                保存修改
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="profile-section">
          <h3 class="section-title">账号安全</h3>

          <div class="security-item">
            <div class="security-info">
              <span class="security-label">账号</span>
              <span class="security-value">{{ maskEmail(authStore.user?.email) }}</span>
            </div>
            <el-button size="small" @click="showEmailDialog = true">
              修改
            </el-button>
          </div>

          <div class="security-item">
            <div class="security-info">
              <span class="security-label">密码</span>
              <span class="security-value">••••••••</span>
            </div>
            <el-button size="small" @click="showPasswordDialog = true">
              修改
            </el-button>
          </div>

          <div class="security-item">
            <div class="security-info">
              <span class="security-label">手机号</span>
              <span class="security-value">{{ form.phone || '未绑定' }}</span>
            </div>
            <el-button size="small" @click="showPhoneDialog = true">
              {{ form.phone ? '修改' : '绑定' }}
            </el-button>
          </div>

          <div class="security-item">
            <div class="security-info">
              <span class="security-label">注册时间</span>
              <span class="security-value">{{ formatCreatedAt() }}</span>
            </div>
          </div>
        </div>

        <div class="profile-section">
          <h3 class="section-title">专注设置</h3>
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
                  @change="handleFocusSettingChange"
              />
            </div>
          </div>
        </div>

        <div class="profile-section">
          <h3 class="section-title">课程表设置</h3>
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
                  @update:model-value="handleCourseSettingChange"
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
                  @change="handleCourseWeeksChange"
              />
            </div>
          </div>

          <div class="setting-item course-reminder-item">
            <div class="setting-info">
              <span class="setting-label">提前提醒</span>
              <span class="setting-desc">上课前多少分钟发送系统通知提醒</span>
            </div>
            <div class="setting-control">
              <el-input-number
                  v-model="courseSettings.reminderMinutes"
                  :min="1"
                  :max="60"
                  :step="1"
                  controls-position="right"
                  size="default"
                  @change="handleCourseReminderChange"
              />
            </div>
          </div>
        </div>

        <div class="profile-section">
          <h3 class="section-title">关于</h3>

          <div class="about-item">
            <span class="about-label">项目地址</span>
            <a class="about-link" @click.prevent="openProjectUrl">https://github.com/XueWerY/earth-survival-diary</a>
          </div>

          <div class="about-item">
            <span class="about-label">版本号</span>
            <span class="about-value">v{{ version }}</span>
            <el-button size="small" @click="checkForUpdate">检查更新</el-button>
          </div>
        </div>

        <div class="profile-section danger-zone">
          <el-button type="danger" @click="handleLogout" :loading="loggingOut">
            退出登录
          </el-button>
        </div>
      </el-scrollbar>
    </div>

    <!-- 手机号绑定对话框 -->
    <el-dialog
        v-model="showPhoneDialog"
        title="绑定手机号"
        width="400px"
        :append-to-body="true"
    >
      <el-form :model="phoneForm" label-width="80px">
        <el-form-item label="手机号">
          <el-input v-model="phoneForm.phone" placeholder="请输入手机号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPhoneDialog = false">取消</el-button>
        <el-button type="primary" @click="savePhone">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改账号对话框 -->
    <el-dialog
        v-model="showEmailDialog"
        title="修改账号"
        width="400px"
        :append-to-body="true"
    >
      <el-form :model="emailForm" label-width="80px">
        <el-form-item label="新账号">
          <el-input v-model="emailForm.newEmail" placeholder="请输入新邮箱" />
        </el-form-item>
        <el-form-item label="当前密码">
          <el-input v-model="emailForm.password" type="password" placeholder="请输入当前密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEmailDialog = false">取消</el-button>
        <el-button type="primary" @click="changeEmail" :loading="changingEmail">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码对话框 -->
    <el-dialog
        v-model="showPasswordDialog"
        title="修改密码"
        width="400px"
        :append-to-body="true"
    >
      <el-form :model="passwordForm" label-width="100px">
        <el-form-item label="当前密码">
          <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码（至少6位）" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" @click="changePassword" :loading="changingPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import * as api from '../lib/api'
import LunarDatePicker from './LunarDatePicker.vue'
import { logger } from '../lib/logger'
import appVersion from 'virtual:version'

const emit = defineEmits<{
  logout: []
}>()

const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const formRef = ref<FormInstance>()
const saving = ref(false)
const loggingOut = ref(false)
const showPhoneDialog = ref(false)
const showEmailDialog = ref(false)
const showPasswordDialog = ref(false)
const changingEmail = ref(false)
const changingPassword = ref(false)

const form = reactive({
  nickname: authStore.profile?.nickname || '',
  birthday: authStore.profile?.birthday || '',
  phone: authStore.profile?.phone || ''
})

const phoneForm = reactive({
  phone: ''
})

const emailForm = reactive({
  newEmail: '',
  password: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const focusSettings = ref({
  pomodoroDuration: 25
})

const courseSettings = ref({
  semesterStartDate: '',
  totalWeeks: 20,
  reminderMinutes: 5
})

const version = ref(appVersion)

const checkForUpdate = async () => {
  if (!window.electronAPI?.checkForUpdate) return
  try {
    const result = await window.electronAPI.checkForUpdate()
    logger.info('[关于] 检查更新结果', result)
  } catch (e) {
    logger.error('[关于] 检查更新失败', { error: e instanceof Error ? e.message : String(e) })
  }
}

const openProjectUrl = () => {
  window.electronAPI?.openExternal('https://github.com/XueWerY/earth-survival-diary')
}

const currentWeekNumber = computed(() => {
  if (!courseSettings.value.semesterStartDate) return 1
  const startDate = dayjs(courseSettings.value.semesterStartDate)
  const today = dayjs()
  const diff = today.diff(startDate, 'week')
  return Math.max(1, diff + 1)
})

const rules: FormRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 20, message: '昵称最多20个字符', trigger: 'blur' }
  ]
}

// 格式化创建时间
const formatCreatedAt = () => {
  const createdAt = authStore.profile?.created_at || (authStore.user as any)?.createdAt || (authStore.user as any)?.created_at
  if (!createdAt) return '未知'
  return dayjs(createdAt).format('YYYY-MM-DD HH:mm')
}

// 遮蔽邮箱
const maskEmail = (email: string | undefined) => {
  if (!email) return '未知'
  const [name, domain] = email.split('@')
  if (!domain) return email
  const maskedName = name.length > 2
      ? name[0] + '***' + name[name.length - 1]
      : name[0] + '***'
  return `${maskedName}@${domain}`
}

const savePhone = async () => {
  if (!phoneForm.phone.trim()) {
    ElMessage.warning('请输入手机号')
    return
  }
  form.phone = phoneForm.phone
  showPhoneDialog.value = false
  await handleSave()
}

// 修改账号
const changeEmail = async () => {
  if (!emailForm.newEmail.trim()) {
    ElMessage.warning('请输入新邮箱')
    return
  }
  if (!emailForm.password.trim()) {
    ElMessage.warning('请输入当前密码')
    return
  }

  changingEmail.value = true
  try {
    await api.changeEmail(emailForm.newEmail, emailForm.password)
    if (authStore.user) {
      authStore.user.email = emailForm.newEmail
    }
    logger.info('[我的] 修改账号', { oldEmail: authStore.user?.email, newEmail: emailForm.newEmail })
    showEmailDialog.value = false
    emailForm.newEmail = ''
    emailForm.password = ''
    ElMessage.success('账号修改成功')
  } catch (error: any) {
    console.error('修改账号失败:', error)
    ElMessage.error(error?.response?.data?.error || '修改账号失败')
  } finally {
    changingEmail.value = false
  }
}

// 修改密码
const changePassword = async () => {
  if (!passwordForm.oldPassword.trim()) {
    ElMessage.warning('请输入当前密码')
    return
  }
  if (!passwordForm.newPassword.trim()) {
    ElMessage.warning('请输入新密码')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少6位')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  changingPassword.value = true
  try {
    await api.changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    logger.info('[我的] 修改密码')
    showPasswordDialog.value = false
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    ElMessage.success('密码修改成功')
  } catch (error: any) {
    console.error('修改密码失败:', error)
    ElMessage.error(error?.response?.data?.error || '修改密码失败')
  } finally {
    changingPassword.value = false
  }
}

const handleSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const changed: string[] = []
    if (form.nickname !== authStore.profile?.nickname) changed.push('nickname')
    if (form.birthday !== authStore.profile?.birthday) changed.push('birthday')
    if (form.phone !== authStore.profile?.phone) changed.push('phone')

    await api.updateProfile({ nickname: form.nickname, birthday: form.birthday, phone: form.phone })

    ;(authStore.profile as any) = {
      ...authStore.profile,
      nickname: form.nickname,
      birthday: form.birthday,
      phone: form.phone
    }

    if (changed.length > 0) {
      logger.info('[我的] 修改个人资料', { fields: changed })
    }

    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
      type: 'warning'
    })

    loggingOut.value = true
    logger.info('[我的] 退出登录')
    await authStore.signOut()
    emit('logout')
  } catch {
  } finally {
    loggingOut.value = false
  }
}

onMounted(async () => {
  if (authStore.profile) {
    form.birthday = authStore.profile.birthday || ''
    form.phone = authStore.profile.phone || ''
    phoneForm.phone = authStore.profile.phone || ''
  }

  await settingsStore.loadSettings()
  focusSettings.value.pomodoroDuration = settingsStore.settings.focus?.pomodoroDuration || 25
  courseSettings.value.semesterStartDate = settingsStore.settings.course?.semesterStartDate || ''
  courseSettings.value.totalWeeks = settingsStore.settings.course?.totalWeeks || 20
  courseSettings.value.reminderMinutes = settingsStore.settings.course?.reminderMinutes || 5
})

watch(() => authStore.profile?.nickname, (val) => {
  if (val) form.nickname = val
}, { immediate: true })

const handleFocusSettingChange = async (val: number) => {
  await settingsStore.updateFocusSettings({ pomodoroDuration: val })
  logger.info('[设置] 修改专注时长', { pomodoroDuration: val })
}

const handleCourseSettingChange = async (val: string) => {
  await settingsStore.updateCourseSettings({ semesterStartDate: val })
  logger.info('[设置] 修改开学日期', { semesterStartDate: val })
}

const handleCourseWeeksChange = async (val: number) => {
  await settingsStore.updateCourseSettings({ totalWeeks: val })
  logger.info('[设置] 修改学期周数', { totalWeeks: val })
}

const handleCourseReminderChange = async (val: number) => {
  await settingsStore.updateCourseSettings({ reminderMinutes: val })
  logger.info('[设置] 修改课程提醒', { reminderMinutes: val })
}
</script>

<style scoped>
.profile-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  justify-content: center;
}

.profile-content {
  flex: 1;
  overflow: hidden;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 840px) {
  .profile-content {
    max-width: none;
  }
}

.profile-section {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 20px 0;
}

.profile-form {
  max-width: 400px;
}

:deep(.el-form-item__label) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: none !important;
}

:deep(.el-input__inner) {
  color: white !important;
}

:deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.3) !important;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.02) !important;
}

:deep(.el-input.is-disabled .el-input__inner) {
  color: rgba(255, 255, 255, 0.5) !important;
}

:deep(.el-date-editor) {
  --el-date-editor-width: 100% !important;
}

:deep(.el-date-editor .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.security-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.security-item:last-child {
  border-bottom: none;
}

.security-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.security-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.security-value {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
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

.course-reminder-item {
  margin-top: 16px;
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

.about-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  gap: 12px;
}

.about-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  width: 60px;
  flex-shrink: 0;
}

.about-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.about-link {
  font-size: 13px;
  color: #6496ff;
  cursor: pointer;
  text-decoration: none;
}

.about-link:hover {
  text-decoration: underline;
}

.danger-zone {
  border-bottom: none;
}

:deep(.el-button--danger) {
  background: rgba(239, 68, 68, 0.2) !important;
  border-color: rgba(239, 68, 68, 0.4) !important;
  color: #ef4444 !important;
}

:deep(.el-button--danger:hover) {
  background: rgba(239, 68, 68, 0.3) !important;
}

:deep(.el-input__count),
:deep(.el-input__count-inner) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.4) !important;
}
</style>
