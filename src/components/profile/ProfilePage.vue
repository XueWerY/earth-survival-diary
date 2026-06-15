<template>
  <div class="profile-page">
    <div class="profile-content">
      <el-scrollbar>
        <div class="profile-section" id="section-profile">
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
              <DateScrollPicker
                  v-model="form.birthday"
              />
            </el-form-item>
          </el-form>
        </div>

        <div class="profile-section" id="section-security">
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

          <div class="security-actions">
            <button class="capsule-btn capsule-btn-danger" @click="handleLogout" :disabled="loggingOut">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>退出登录</span>
            </button>
            <button class="capsule-btn capsule-btn-danger" @click="handleDeleteAccount" :disabled="deletingAccount">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              <span>注销账号</span>
            </button>
          </div>
        </div>

        <div class="profile-section" id="section-system" v-if="isElectron">
          <h3 class="section-title">系统设置</h3>
          <p class="section-desc">配置程序在系统中的行为。</p>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">开机自启动</span>
              <span class="setting-desc">登录系统时自动启动程序</span>
            </div>
            <div class="setting-control">
              <el-switch
                  v-model="autoLaunch"
                  inline-prompt
                  size="default"
                  @change="handleAutoLaunchChange"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">关闭程序时</span>
              <span class="setting-desc">点击窗口关闭按钮时的行为</span>
            </div>
            <div class="setting-control">
              <el-select
                  v-model="closeAction"
                  size="default"
                  style="width: 140px;"
                  @change="handleCloseActionChange"
              >
                <el-option label="隐藏到托盘" value="minimize" />
                <el-option label="直接退出" value="exit" />
              </el-select>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">窗口分辨率</span>
              <span class="setting-desc">设置电脑端窗口显示尺寸</span>
            </div>
            <div class="setting-control">
              <el-select
                  v-model="windowResolution"
                  size="default"
                  style="width: 140px;"
                  @change="handleResolutionChange"
              >
                <el-option
                  v-for="opt in resolutionOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>
          </div>

        </div>

        <div class="profile-section" id="section-about">
          <h3 class="section-title">关于</h3>

          <div class="about-item">
            <span class="about-label">项目地址</span>
            <a class="about-link" @click.prevent="openProjectUrl">https://github.com/XueWerY/earth-survival-diary</a>
          </div>

          <div class="about-item">
            <span class="about-label">版本号</span>
            <span class="about-value">v{{ version }}</span>
            
          </div>
          <div class="about-item about-tools-row">
            <button class="capsule-btn" @click="checkForUpdate" :disabled="isGuideActive">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              <span>检查更新</span>
            </button>
            <button class="capsule-btn" @click="openChangelogDialog" :disabled="isGuideActive">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>查看更新日志</span>
            </button>
            <button class="capsule-btn" @click="startGuide" :disabled="isGuideActive">
              <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>新手引导</span>
            </button>
          </div>
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

    <div v-if="showChangelogDialog" class="changelog-panel">
      <div class="changelog-panel-header">
        <span class="changelog-panel-title">更新日志</span>
        <button class="changelog-panel-close" @click="showChangelogDialog = false">&times;</button>
      </div>
      <div class="changelog-panel-body" v-html="changelogHtml"></div>
    </div>

  </div>

</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, inject } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'
import { useAuthStore } from '../../stores/authStore'
import { usePageNav } from '../../composables/usePageNav'
import * as api from '../../lib/api'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'
import { logger } from '../../lib/logger'
import appVersion from 'virtual:version'
// @ts-expect-error - Vite raw import
import changelogContent from '../../../CHANGELOG.md?raw'

const emit = defineEmits<{
  logout: []
  profileUpdated: []
}>()

const startGuide = inject<() => void>('startGuide', () => {})
const isGuideActive = inject('guideVisible', ref(false))
const isElectron = inject<boolean>('isElectron', false)

const authStore = useAuthStore()
const pageNav = usePageNav()

const formRef = ref<FormInstance>()
const loggingOut = ref(false)
const deletingAccount = ref(false)
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

const autoLaunch = ref(false)
const closeAction = ref('minimize')
const windowResolution = ref('')
const resolutionOptions = ref<{ label: string; value: string }[]>([])

// 根据屏幕分辨率生成递退的分辨率选项
function generateResolutionOptions(screenW: number, screenH: number, scaleFactor: number) {
  // 减微小量 (0.001) 避免 Electron 截断逻辑值后 Math.round 多 1 的问题
  const physicalW = Math.round(screenW * scaleFactor - 0.001)
  const physicalH = Math.round(screenH * scaleFactor - 0.001)
  // 通用 16:9 分辨率预设（物理像素），从大到小排列
  const presets: [number, number][] = [
    [3840, 2160],
    [2560, 1440],
    [1920, 1080],
    [1600, 900],
    [1366, 768],
    [1280, 720],
    [1024, 576]
  ]
  const options: { label: string; value: string }[] = []
  // 最大分辨率：label 用物理值展示，value 用逻辑值（与 Electron API 单位一致）
  const nativeKey = `${screenW}x${screenH}`
  options.push({ label: '全屏', value: nativeKey })
  // 添加小于等于物理分辨率的预设
  for (const [pw, ph] of presets) {
    if (pw === physicalW && ph === physicalH) continue // 跳过已添加的最大分辨率
    if (pw <= physicalW && ph <= physicalH) {
      const lw = Math.round(pw / scaleFactor)
      const lh = Math.round(ph / scaleFactor)
      options.push({ label: `${pw}×${ph}`, value: `${lw}x${lh}` })
    }
  }
  resolutionOptions.value = options
}

const loadWindowSize = async () => {
  if (!authStore.user?.id) return
  if (window.electronAPI?.getScreenInfo) {
    const screenInfo = await window.electronAPI.getScreenInfo()
    generateResolutionOptions(screenInfo.width, screenInfo.height, screenInfo.scaleFactor)
  }
  if (window.electronAPI?.getWindowSize) {
    const pref = await window.electronAPI.getWindowSize(authStore.user.id)
    if (pref && window.electronAPI?.getScreenInfo) {
      // 存储的是物理值，转回逻辑值匹配选项
      const screenInfo = await window.electronAPI.getScreenInfo()
      const logicalW = Math.round(pref.width / screenInfo.scaleFactor)
      const logicalH = Math.round(pref.height / screenInfo.scaleFactor)
      windowResolution.value = `${logicalW}x${logicalH}`
    } else if (window.electronAPI?.getScreenInfo) {
      const screenInfo = await window.electronAPI.getScreenInfo()
      windowResolution.value = `${screenInfo.width}x${screenInfo.height}`
    }
  }
}

const handleResolutionChange = async (val: string) => {
  if (!window.electronAPI?.setWindowSize || !authStore.user?.id) return
  const parts = val.split('x')
  if (parts.length === 2) {
    const w = parseInt(parts[0], 10)
    const h = parseInt(parts[1], 10)
    if (!isNaN(w) && !isNaN(h)) {
      await window.electronAPI.setWindowSize(authStore.user.id, w, h)
      logger.info('[设置] 修改窗口分辨率', { width: w, height: h })
    }
  }
}

const loadSystemSettings = async () => {
  if (window.electronAPI) {
    autoLaunch.value = await window.electronAPI.getAutoLaunch()
    closeAction.value = await window.electronAPI.getCloseAction() || 'minimize'
  }
}

const handleAutoLaunchChange = async (val: boolean) => {
  if (window.electronAPI) {
    await window.electronAPI.setAutoLaunch(val)
    logger.info('[设置] 修改开机自启动', { enabled: val })
  }
}

const handleCloseActionChange = async (val: string) => {
  if (window.electronAPI) {
    await window.electronAPI.setCloseAction(val)
    logger.info('[设置] 修改关闭程序行为', { action: val })
  }
}

const version = ref(appVersion.replace('-', '.'))

const checkForUpdate = async () => {
  if (window.electronAPI?.checkForUpdate) {
    try {
      const result = await window.electronAPI.checkForUpdate()
      logger.info('[关于] 检查更新结果', result)
    } catch (e) {
      logger.error('[关于] 检查更新失败', { error: e instanceof Error ? e.message : String(e) })
    }
  } else if ((window as any).__checkForUpdate) {
    await (window as any).__checkForUpdate()
  }
}

const showChangelogDialog = ref(false)

const changelogHtml = computed(() => {
  const content = changelogContent.replace(/^# 更新日志\n*/, '')
  const lines = content.split('\n')
  let html = ''
  let inList = false
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false }
      html += `<h3 class="cl-version">${line.slice(4)}</h3>`
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul class="cl-list">'; inList = true }
      html += `<li>${line.slice(2)}</li>`
    } else if (!line.trim()) {
      if (inList) { html += '</ul>'; inList = false }
    }
  }
  if (inList) html += '</ul>'
  return html
})

const openChangelogDialog = () => {
  showChangelogDialog.value = true
}

const openProjectUrl = () => {
  window.electronAPI?.openExternal('https://github.com/XueWerY/earth-survival-diary')
}

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
  try {
    await api.updateProfile({ phone: form.phone })
    ;(authStore.profile as any) = { ...authStore.profile, phone: form.phone }
    logger.info('[我的] 修改手机号')
    ElMessage.success('手机号已保存')
  } catch (error) {
    console.error('保存手机号失败:', error)
    ElMessage.error('保存失败')
  }
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

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
      type: 'warning'
    })

    loggingOut.value = true
    logger.info('[我的] 退出登录')
    await authStore.signOut()
    if (window.electronAPI) {
      await window.electronAPI.restartApp()
    } else if (typeof (window as any).Capacitor !== 'undefined') {
      // Android (Capacitor) 端：重启应用
      window.location.reload()
    } else {
      emit('logout')
    }
  } catch {
  } finally {
    loggingOut.value = false
  }
}

const handleDeleteAccount = async () => {
  try {
    await ElMessageBox.confirm(
      '注销账号将永久删除您的所有数据，此操作不可恢复！\n确定要注销吗？',
      '注销确认',
      {
        type: 'warning',
        confirmButtonText: '确定注销',
        cancelButtonText: '取消'
      }
    )

    deletingAccount.value = true
    logger.info('[我的] 注销账号')
    await api.deleteAccount()
    await authStore.signOut()
    logger.info('[我的] 注销成功')
    if (window.electronAPI) {
      await window.electronAPI.restartApp()
    } else {
      window.location.reload()
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error('注销账号失败:', err)
      ElMessage.error(err?.response?.data?.error || '注销账号失败')
    }
  } finally {
    deletingAccount.value = false
  }
}

onMounted(async () => {
  if (pageNav.navPath.value.length === 0) {
    pageNav.setNavPath(['profile'])
  }
  pageNav.setNavContext({
    segments: [],
    plusVisible: false,
    plusOnClick: null,
    goModuleHome: () => { pageNav.setNavPath(['profile']) }
  })

  if (authStore.profile) {
    form.birthday = authStore.profile.birthday || ''
    form.phone = authStore.profile.phone || ''
    phoneForm.phone = authStore.profile.phone || ''
  }

  loadSystemSettings()
  loadWindowSize()
})

watch(() => authStore.profile?.nickname, (val) => {
  if (val) form.nickname = val
}, { immediate: true })

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

const autoSaveProfile = async () => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(async () => {
    try {
      const nickname = form.nickname || ''
      const birthday = form.birthday || ''
      await api.updateProfile({ nickname, birthday })
      ;(authStore.profile as any) = { ...authStore.profile, nickname, birthday }
      if (form.birthday) {
        emit('profileUpdated')
      }
      logger.info('[我的] 个人资料自动保存')
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }, 800)
}

watch(() => form.nickname, () => {
  autoSaveProfile()
})

watch(() => form.birthday, () => {
  autoSaveProfile()
})
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
  width: 500px;
  margin: 0 auto;
}

@media (max-width: 499px) {
  .profile-content {
    width: 80%;
  }
}

.profile-content :deep(.el-scrollbar__wrap) {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.profile-content :deep(.el-scrollbar__wrap::-webkit-scrollbar) {
  display: none;
}

.profile-content :deep(.el-scrollbar__bar) {
  display: none !important;
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

.setting-control-break {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.break-mode-toggle {
  flex-shrink: 0;
}

.setting-break-input {
  flex-shrink: 0;
}

.setting-break-custom-btn {
  flex-shrink: 0;
}

.custom-break-dialog {
  max-width: 360px;
}

.custom-break-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.custom-break-item:last-child {
  border-bottom: none;
}

.custom-break-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
}

.custom-break-empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  padding: 16px 0;
}

.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.dialog-container { background: rgba(30,28,52,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }

.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 0; flex-shrink: 0; }
.dialog-header-title { font-size: 16px; font-weight: 600; color: var(--chalk-white); }
.folder-dialog-header { justify-content: center; }
.folder-dialog-title { text-align: center; }
.dialog-body { padding: 12px 16px 16px; overflow-y: auto; flex: 1; scrollbar-width: none; -ms-overflow-style: none; }
.dialog-body::-webkit-scrollbar { display: none; }

.form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
.capsule-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 18px; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; background: transparent; color: var(--chalk-white-70); cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.2s; }
.capsule-btn:hover { background: rgba(255,255,255,0.08); color: var(--chalk-white); }
.capsule-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.capsule-btn .capsule-icon { width: 14px; height: 14px; }
.capsule-btn-danger { border-color: rgba(239, 68, 68, 0.4); color: #ef4444; }
.capsule-btn-danger:hover { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.submit-btn { background: rgba(102,126,234,0.2); border-color: rgba(102,126,234,0.4); color: #93c5fd; }
.submit-btn:hover { background: rgba(102,126,234,0.35); color: var(--chalk-white); }

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

.about-tools-row {
  display: flex;
  gap: 12px;
  justify-content: flex-start;
  margin-top: 12px;
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

.security-actions {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  margin-top: 4px;
}

.storage-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.storage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  gap: 16px;
}

.storage-item-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* 存储管理按钮样式 */
.storage-btn {
  border: none !important;
  border-radius: 6px !important;
  padding: 8px 18px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  color: #fff !important;
  transition: all 0.2s ease !important;
  flex-shrink: 0;
}

.storage-btn-normal {
  background: linear-gradient(135deg, #4facfe, #667eea) !important;
}
.storage-btn-normal:hover {
  background: linear-gradient(135deg, #63baff, #7b93f5) !important;
  box-shadow: 0 2px 12px rgba(79, 172, 254, 0.4) !important;
}

.storage-btn-danger {
  background: linear-gradient(135deg, #f5576c, #ff6b6b) !important;
}
.storage-btn-danger:hover {
  background: linear-gradient(135deg, #f76d7f, #ff8585) !important;
  box-shadow: 0 2px 12px rgba(245, 87, 108, 0.4) !important;
}

.switch-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

/* 自动清理日志设置 */
.auto-clean-setting {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px 12px 16px;
  margin-top: -4px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.auto-clean-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.auto-clean-unit {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.storage-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.storage-item-label {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.storage-item-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
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

/* 导出对话框样式 */
.export-tree {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.select-all-row {
  padding: 4px 0 8px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;
}

.select-all-row :deep(.el-checkbox__label) {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.export-group {
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

/* 导入对话框样式 */
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
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.import-file-info p {
  margin: 4px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.import-select-prompt {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  padding: 20px 0;
  font-size: 14px;
}

.import-tree {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
}

.import-group {
  margin-bottom: 8px;
}

.changelog-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 3000;
  width: 480px;
  max-width: 80vw;
  max-height: 85vh;
  background: rgba(20, 16, 55, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  animation: changelogFadeIn 0.3s ease-out;
}

@keyframes changelogFadeIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.changelog-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.changelog-panel-title {
  color: #f0c040;
  font-size: 16px;
  font-weight: 600;
}

.changelog-panel-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 22px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}

.changelog-panel-close:hover {
  color: rgba(255, 255, 255, 0.9);
}

.changelog-panel-body {
  overflow-y: auto;
  padding: 8px 16px 12px 8px;
  flex: 1;
  min-height: 0;
}

.changelog-panel-body::-webkit-scrollbar { width: 4px; }
.changelog-panel-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.changelog-panel-body::-webkit-scrollbar-track { background: transparent; }
.changelog-panel-body :deep(.cl-version) { color: #f0c040; font-size: 14px; font-weight: 600; margin: 14px 0 6px; padding: 5px 0 5px 10px; border-left: 3px solid #f0c040; background: linear-gradient(90deg, rgba(240,192,64,0.06) 0%, transparent 100%); border-radius: 0 4px 4px 0; }
.changelog-panel-body :deep(.cl-list) { margin: 0 0 4px 16px; padding: 0; list-style: none; color: rgba(255,255,255,0.75); }
.changelog-panel-body :deep(.cl-list li) { font-size: 12px; line-height: 1.7; padding: 2px 0; position: relative; padding-left: 14px; }
.changelog-panel-body :deep(.cl-list li)::before { content: '•'; position: absolute; left: 0; color: rgba(255,255,255,0.25); font-size: 10px; top: 5px; }
</style>
