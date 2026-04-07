<template>
  <div class="profile-page">
    <div class="profile-header">
      <div class="avatar-section">
        <div class="avatar-wrapper" @click="triggerAvatarUpload">
          <div class="avatar" :style="avatarStyle">
            <img v-if="avatarUrl" :src="avatarUrl" alt="头像" class="avatar-img" />
            <span v-else class="avatar-placeholder">点击上传头像</span>
          </div>
          <div class="avatar-edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </div>
          <input
              ref="avatarInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleAvatarChange"
          />
        </div>
        <div class="user-info">
          <h2 class="nickname">{{ authStore.nickname }}</h2>
        </div>
      </div>
    </div>

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
import * as api from '../lib/api'
import LunarDatePicker from './LunarDatePicker.vue'

const emit = defineEmits<{
  logout: []
}>()

const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const avatarInput = ref<HTMLInputElement>()
const saving = ref(false)
const loggingOut = ref(false)
const showPhoneDialog = ref(false)
const showEmailDialog = ref(false)
const showPasswordDialog = ref(false)
const changingEmail = ref(false)
const changingPassword = ref(false)
const avatarUrl = ref('')
const avatarKey = ref('')

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

const rules: FormRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 20, message: '昵称最多20个字符', trigger: 'blur' }
  ]
}

const avatarStyle = computed(() => {
  if (avatarUrl.value) {
    return {}
  }
  return {
    background: 'rgba(255, 255, 255, 0.1)'
  }
})

// 格式化创建时间
const formatCreatedAt = () => {
  // 尝试从多个来源获取注册时间
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

// 触发头像上传
const triggerAvatarUpload = () => {
  avatarInput.value?.click()
}

// 处理头像选择
const handleAvatarChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }

  // 验证文件大小（最大 2MB）
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 2MB')
    return
  }

  try {
    const loadingMsg = ElMessage({ message: '上传中...', type: 'info', duration: 0 })

    // 读取文件为 base64
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string)?.split(',')[1]

        // 调用上传 API
        const result = await api.uploadAvatar({
          fileData: base64,
          fileName: file.name,
          contentType: file.type
        })

        avatarUrl.value = result.avatarUrl
        avatarKey.value = result.avatarKey

        // 更新 authStore 中的头像 URL
        authStore.setAvatarUrl(result.avatarUrl)

        // 更新本地存储的额外信息
        const userData = await api.getData('profile_extra')
        const extraData = {
          ...(userData.data || {}),
          avatarKey: result.avatarKey
        }
        await api.setData('profile_extra', extraData)

        loadingMsg.close()
        ElMessage.success('头像上传成功')
      } catch (error) {
        console.error('上传头像失败:', error)
        loadingMsg.close()
        ElMessage.error('上传头像失败')
      }
    }
    reader.readAsDataURL(file)
  } catch (error) {
    console.error('读取文件失败:', error)
    ElMessage.error('读取文件失败')
  }

  // 清空 input，允许重新选择相同文件
  target.value = ''
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
    // 更新本地用户信息
    if (authStore.user) {
      authStore.user.email = emailForm.newEmail
    }
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
    // 更新基本信息
    await authStore.updateProfile({ nickname: form.nickname })

    // 保存额外信息到用户数据
    const userData = await api.getData('profile_extra')
    const extraData = {
      ...(userData.data || {}),
      birthday: form.birthday,
      phone: form.phone,
      avatarKey: avatarKey.value
    }
    await api.setData('profile_extra', extraData)

    // 更新本地 profile
    ;(authStore.profile as any) = {
      ...authStore.profile,
      birthday: form.birthday,
      phone: form.phone,
      avatarKey: avatarKey.value
    }

    // 如果生日变更，同步到倒数日模块
    if (form.birthday) {
      await syncBirthdayToCountdown(form.birthday)
    }

    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 同步生日到倒数日模块
const syncBirthdayToCountdown = async (birthday: string) => {
  try {
    // 检查是否已存在生日倒数日
    const { countdowns } = await api.getCountdowns()
    const birthdayCountdown = countdowns.find((c: any) => c.is_birthday)

    const [, month, day] = birthday.split('-').map(Number)
    const birthdayDate = `${new Date().getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    if (birthdayCountdown) {
      // 更新
      await api.updateCountdown(birthdayCountdown.id, {
        name: '我的生日',
        targetDate: birthdayDate,
        is_birthday: true,
        is_system: true
      })
    } else {
      // 创建
      await api.addCountdown({
        name: '我的生日',
        targetDate: birthdayDate,
        icon: '🎂',
        is_birthday: true,
        is_system: true
      })
    }
  } catch (error) {
    console.error('同步生日到倒数日失败:', error)
  }
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
      type: 'warning'
    })

    loggingOut.value = true
    await authStore.signOut()
    emit('logout')
  } catch {
    // 取消退出
  } finally {
    loggingOut.value = false
  }
}

// 加载额外信息和头像
onMounted(async () => {
  try {
    // 加载额外信息
    const { data } = await api.getData('profile_extra')
    if (data) {
      form.birthday = data.birthday || ''
      form.phone = data.phone || ''
      phoneForm.phone = data.phone || ''
      avatarKey.value = data.avatarKey || ''
    }

    // 如果有 avatarKey，获取头像 URL
    if (avatarKey.value) {
      try {
        const result = await api.getAvatarUrl()
        avatarUrl.value = result.avatarUrl || ''
      } catch (error) {
        console.error('获取头像URL失败:', error)
      }
    }
  } catch (error) {
    console.error('加载额外信息失败:', error)
  }
})

// 同步 nickname
watch(() => authStore.profile?.nickname, (val) => {
  if (val) form.nickname = val
}, { immediate: true })
</script>

<style scoped>
.profile-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.profile-header {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 20px;
}

.avatar-wrapper {
  position: relative;
  cursor: pointer;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.2s;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  padding: 8px;
}

.avatar-wrapper:hover .avatar {
  transform: scale(1.05);
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(102, 126, 234, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-wrapper:hover .avatar-edit {
  opacity: 1;
}

.avatar-edit svg {
  width: 14px;
  height: 14px;
  color: white;
}

.user-info {
  flex: 1;
}

.nickname {
  font-size: 24px;
  font-weight: 600;
  color: white;
  margin: 0;
}

.profile-content {
  flex: 1;
  overflow: hidden;
}

.profile-section {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
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
