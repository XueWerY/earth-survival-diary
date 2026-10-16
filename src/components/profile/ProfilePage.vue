<template>
  <div class="profile-page">
    <div class="profile-content">
      <div class="profile-section" id="section-profile">
        <h3 class="section-title">个人信息</h3>

        <div class="security-item security-item-static profile-avatar-row">
          <span class="security-label">头像：</span>
          <div class="profile-avatar profile-avatar-preview" aria-label="当前头像">
            <img :src="profileAvatar" alt="头像">
          </div>
          <input ref="avatarInput" class="profile-avatar-input" type="file" accept="image/png,image/jpeg,image/webp" @change="handleAvatarFileChange">
        </div>

        <div class="security-item security-item-static">
          <span class="security-label">昵称：</span>
          <span class="security-value">{{ form.nickname || '未设置' }}</span>
        </div>

        <div class="security-item security-item-static">
          <span class="security-label">生日：</span>
          <span class="security-value">{{ birthdayDisplay }}</span>
        </div>

        <div class="profile-edit-actions">
          <button class="capsule-btn" :disabled="avatarUploading" @click="avatarInput?.click()">
            {{ avatarUploading ? '正在上传…' : '更换头像' }}
          </button>
          <button class="capsule-btn" @click="openNicknameDialog">修改昵称</button>
          <button class="capsule-btn" @click="showBirthdayPicker = true">修改生日</button>
          <DateScrollPicker
            v-model="form.birthday"
            :visible="showBirthdayPicker"
            dialog-title="修改生日"
            :initial-lunar-mode="form.birthdayCalendar === 'lunar'"
            class="profile-birthday-picker"
            @update:visible="showBirthdayPicker = $event"
            @update:calendar-mode="form.birthdayCalendar = $event"
          />
        </div>
      </div>

      <div class="profile-section" id="section-security">
        <h3 class="section-title">账号安全</h3>

        <div class="security-item security-item-static">
          <span class="security-label">账号：</span>
          <span class="security-value">{{ maskEmail(authStore.user?.email) }}</span>
        </div>

        <div class="security-item security-item-static">
          <span class="security-label">密码：</span>
          <span class="security-value">••••••••</span>
        </div>

        <div class="security-item security-item-static">
          <span class="security-label">手机号：</span>
          <span class="security-value">{{ form.phone || '未绑定' }}</span>
        </div>

        <div class="security-item security-item-static">
          <span class="security-label">注册时间：</span>
          <span class="security-value">{{ formatCreatedAt() }}</span>
        </div>

        <div class="security-actions">
          <button class="capsule-btn" @click="showEmailDialog = true">修改账号</button>
          <button class="capsule-btn" @click="showPasswordDialog = true">修改密码</button>
          <button class="capsule-btn" @click="showPhoneDialog = true">绑定手机号</button>
          <button class="capsule-btn capsule-btn-danger" @click="handleLogout" :disabled="loggingOut">退出登录</button>
          <button class="capsule-btn capsule-btn-danger" @click="handleDeleteAccount" :disabled="deletingAccount">注销账号</button>
        </div>
      </div>

      <div class="profile-section" id="section-system">
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
                :disabled="!isElectron"
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
                :disabled="!isElectron"
                popper-class="system-select-popper"
                @change="handleCloseActionChange"
            >
              <el-option label="隐藏到托盘" value="minimize" />
              <el-option label="直接退出" value="exit" />
            </el-select>
          </div>
        </div>

      </div>

      <div class="profile-section" id="section-about">
        <h3 class="section-title">关于</h3>

        <div class="about-item">
          <span class="about-label">项目地址：</span>
          <a class="about-link" @click.prevent="openProjectUrl">https://github.com/XueWerY/earth-survival-diary</a>
        </div>

        <div class="about-item">
          <span class="about-label">版本号：</span>
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
            <svg class="capsule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="12,2 17,12 12,22 7,12"/></svg>
            <span>新手引导</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 手机号绑定对话框 -->
    <BaseDialog
        :visible="showPhoneDialog"
        title="绑定手机号"
        :width="400"
        teleport
        @update:visible="showPhoneDialog = $event"
    >
      <div class="dialog-centered-content">
        <el-form :model="phoneForm" label-width="80px">
          <el-form-item label="手机号">
            <el-input v-model="phoneForm.phone" placeholder="请输入手机号" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showPhoneDialog = false">取消</el-button>
        <el-button type="primary" @click="savePhone">确定</el-button>
      </template>
    </BaseDialog>

    <!-- 修改账号对话框 -->
    <BaseDialog
        :visible="showEmailDialog"
        title="修改账号"
        :width="400"
        teleport
        @update:visible="showEmailDialog = $event"
    >
      <div class="dialog-centered-content">
        <el-form :model="emailForm" label-width="80px">
          <el-form-item label="新账号">
            <el-input v-model="emailForm.newEmail" placeholder="请输入新邮箱" />
          </el-form-item>
          <el-form-item label="当前密码">
            <el-input v-model="emailForm.password" type="password" placeholder="请输入当前密码" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showEmailDialog = false">取消</el-button>
        <el-button type="primary" @click="changeEmail" :loading="changingEmail">确定</el-button>
      </template>
    </BaseDialog>

    <!-- 修改密码对话框 -->
    <BaseDialog
        :visible="showPasswordDialog"
        title="修改密码"
        :width="400"
        teleport
        @update:visible="showPasswordDialog = $event"
    >
      <div class="dialog-centered-content">
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
      </div>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" @click="changePassword" :loading="changingPassword">确定</el-button>
      </template>
    </BaseDialog>

    <BaseDialog :visible="showChangelogDialog" title="更新日志" :width="480" teleport @update:visible="showChangelogDialog = $event">
      <div class="changelog-content">
        <template v-for="entry in changelogEntries" :key="entry.version">
          <h3 class="cl-version">{{ entry.version }}</h3>
          <ul class="cl-list">
            <li v-for="(item, i) in entry.items" :key="i">{{ item }}</li>
          </ul>
        </template>
      </div>
      <template #footer>
        <el-button type="primary" @click="showChangelogDialog = false">确认</el-button>
      </template>
    </BaseDialog>

    <BaseDialog :visible="showLogoutDialog" title="退出确认" :width="380" teleport @update:visible="showLogoutDialog = false">
      <p style="color: #fbbf24; text-align: center;">确定要退出登录吗？</p>
      <template #footer>
        <el-button @click="showLogoutDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmLogout">确认</el-button>
      </template>
    </BaseDialog>

    <BaseDialog :visible="showDeleteAccountDialog" title="注销确认" :width="400" teleport @update:visible="showDeleteAccountDialog = false">
      <p style="color: #ef4444;">注销账号将永久删除您的所有数据，此操作不可恢复！确定要注销吗？</p>
      <template #footer>
        <el-button @click="showDeleteAccountDialog = false">取消</el-button>
        <el-button type="danger" @click="confirmDeleteAccount">确定注销</el-button>
      </template>
    </BaseDialog>

  </div>

  <BaseDialog
    :visible="showNicknameDialog"
    title="修改昵称"
    :width="400"
    teleport
    @update:visible="showNicknameDialog = $event"
  >
    <div class="dialog-centered-content">
      <el-input v-model="nicknameDraft" maxlength="20" show-word-limit placeholder="请输入昵称" />
    </div>
    <template #footer>
      <el-button @click="showNicknameDialog = false">取消</el-button>
      <el-button type="primary" @click="saveNickname">确定</el-button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, inject } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { Solar } from 'lunar-javascript'
import { useAuthStore } from '../../stores/authStore'
import { usePageNav } from '../../composables/usePageNav'
import * as api from '../../lib/api'
import DateScrollPicker from '../common/picker/DateScrollPicker.vue'
import BaseDialog from '../ui/BaseDialog.vue'
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
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)
const profileAvatar = computed(() => authStore.profile?.avatarDataUrl || './default-avatar.svg')
const pageNav = usePageNav()

const loggingOut = ref(false)
const deletingAccount = ref(false)
const showNicknameDialog = ref(false)
const showBirthdayPicker = ref(false)
const nicknameDraft = ref('')
const showPhoneDialog = ref(false)
const showEmailDialog = ref(false)
const showPasswordDialog = ref(false)
const changingEmail = ref(false)
const changingPassword = ref(false)

const form = reactive({
  nickname: authStore.profile?.nickname || '',
  birthday: authStore.profile?.birthday || '',
  birthdayCalendar: (authStore.profile?.birthdayCalendar || 'solar') as 'solar' | 'lunar',
  phone: authStore.profile?.phone || ''
})

const birthdayDisplay = computed(() => {
  if (!form.birthday) return '未设置'
  const date = dayjs(form.birthday)
  if (!date.isValid()) return form.birthday
  if (form.birthdayCalendar === 'lunar') {
    try {
    const lunar = Solar.fromYmd(date.year(), date.month() + 1, date.date()).getLunar()
      return `农历${lunar.getYear()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
    } catch {
      return '农历生日'
    }
  }
  return `公历${date.format('YYYY年MM月DD日')}`
})

const openNicknameDialog = () => {
  nicknameDraft.value = form.nickname
  showNicknameDialog.value = true
}

const saveNickname = () => {
  const nickname = nicknameDraft.value.trim()
  if (!nickname) {
    ElMessage.warning('请输入昵称')
    return
  }
  if (nickname.length > 20) {
    ElMessage.warning('昵称最多20个字符')
    return
  }
  form.nickname = nickname
  showNicknameDialog.value = false
}

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
  options.push({ label: '全屏有边框', value: 'bordered' })
  // 最大分辨率：label 用物理值展示，value 用逻辑值（与 Electron API 单位一致）
  const nativeKey = `${screenW}x${screenH}`
  options.push({ label: '全屏无边框', value: nativeKey })
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
    if (pref && pref.mode === 'bordered') {
      windowResolution.value = 'bordered'
    } else if (pref && window.electronAPI?.getScreenInfo) {
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
  if (val === 'bordered') {
    await window.electronAPI.setWindowSize(authStore.user.id, 0, 0)
    logger.info('[设置] 修改窗口分辨率为全屏有边框')
    return
  }
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
    ElMessage.info(val ? '地球 Online 生存日记试图开机自启动' : '已关闭开机自启动')
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
  if ((window as any).__checkForUpdate) {
    await (window as any).__checkForUpdate()
    return
  }
  const url = 'https://github.com/XueWerY/earth-survival-diary/releases/latest'
  if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

const showChangelogDialog = ref(false)
const showLogoutDialog = ref(false)
const showDeleteAccountDialog = ref(false)

const changelogEntries = computed<{ version: string; items: string[] }[]>(() => {
  const content = changelogContent.replace(/^# 更新日志\n*/, '')
  const entries: { version: string; items: string[] }[] = []
  let current: { version: string; items: string[] } | null = null
  for (const line of content.split('\n')) {
    if (line.startsWith('### ')) {
      current = { version: line.slice(4), items: [] }
      entries.push(current)
    } else if (line.startsWith('- ') && current) {
      current.items.push(line.slice(2))
    }
  }
  return entries
})

const openChangelogDialog = () => {
  showChangelogDialog.value = true
}

const openProjectUrl = () => {
  window.electronAPI?.openExternal('https://github.com/XueWerY/earth-survival-diary')
}

// 格式化创建时间
const formatCreatedAt = () => {
  const createdAt = authStore.profile?.createdAt || authStore.profile?.created_at || (authStore.user as any)?.createdAt || (authStore.user as any)?.created_at
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
    logger.error('[Profile] 保存手机号失败', { error: error instanceof Error ? error.message : String(error) })
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
    logger.error('[Profile] 修改账号失败', { error: error instanceof Error ? error.message : String(error) })
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
    logger.error('[Profile] 修改密码失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error(error?.response?.data?.error || '修改密码失败')
  } finally {
    changingPassword.value = false
  }
}

const handleLogout = () => {
  showLogoutDialog.value = true
}

const confirmLogout = async () => {
  showLogoutDialog.value = false
  loggingOut.value = true
  logger.info('[我的] 退出登录')
  try {
    await authStore.signOut()
    if (window.electronAPI) {
      await window.electronAPI.restartApp()
    } else {
      emit('logout')
    }
  } catch {
  } finally {
    loggingOut.value = false
  }
}

const handleDeleteAccount = () => {
  showDeleteAccountDialog.value = true
}

const confirmDeleteAccount = async () => {
  showDeleteAccountDialog.value = false
  deletingAccount.value = true
  logger.info('[我的] 注销账号')
  try {
    await api.deleteAccount()
    await authStore.signOut()
    logger.info('[我的] 注销成功')
    if (window.electronAPI) {
      await window.electronAPI.restartApp()
    } else {
      window.location.reload()
    }
  } catch (err: any) {
    logger.error('[Profile] 注销账号失败', { error: err instanceof Error ? err.message : String(err) })
    ElMessage.error(err?.response?.data?.error || '注销账号失败')
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
    form.birthdayCalendar = authStore.profile.birthdayCalendar || 'solar'
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
      const birthdayCalendar = form.birthdayCalendar || 'solar'
      await api.updateProfile({ nickname, birthday, birthdayCalendar })
      ;(authStore.profile as any) = { ...authStore.profile, nickname, birthday, birthdayCalendar }
      emit('profileUpdated')
      logger.info('[我的] 个人资料自动保存')
    } catch (error) {
      logger.error('[Profile] 自动保存资料失败', { error: error instanceof Error ? error.message : String(error) })
    }
  }, 800)
}

watch(() => form.nickname, () => {
  autoSaveProfile()
})

watch(() => form.birthday, () => {
  autoSaveProfile()
})

watch(() => form.birthdayCalendar, () => {
  autoSaveProfile()
})
const handleAvatarFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    ElMessage.error('请选择 PNG、JPG 或 WebP 图片')
    input.value = ''
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('头像文件不能超过 2 MB')
    input.value = ''
    return
  }

  avatarUploading.value = true
  try {
    const avatarDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error || new Error('读取头像失败'))
      reader.readAsDataURL(file)
    })
    const result = await api.uploadProfileAvatar(avatarDataUrl)
    authStore.profile = {
      ...(authStore.profile || { id: authStore.user?.id || '', nickname: form.nickname || '旅人' }),
      avatarDataUrl: result.avatarDataUrl
    }
    ElMessage.success('头像已保存到本地')
  } catch (error: any) {
    ElMessage.error(error?.message || '头像上传失败，请重试')
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}
</script>

<style scoped>
.profile-page {
  height: 100%;
  padding: 25px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.profile-page::-webkit-scrollbar { display: none; width: 0; height: 0; }
.profile-content {
  display: grid;
  gap: 25px;
  height: 100%;
}

.profile-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  padding: 16px 18px;
}

.profile-form :deep(.el-form-item__label) {
  width: 70px;
  text-align: right;
  justify-content: flex-end;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 12px 0;
  text-align: center;
}

.section-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 20px 0;
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
  padding: 12px 0;
  gap: 8px;
  cursor: pointer;
}

.security-item-static {
  cursor: default;
}

.security-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
  white-space: nowrap;
  width: 70px;
  text-align: right;
}

.security-value {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
}

/* 设置项 */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
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

/* TODO: 以下 .dialog-* / .form-footer / .submit-btn 样式似乎未被本组件使用（弹窗均由 BaseDialog 提供） */
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.dialog-container { background: rgba(30,28,52,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }

.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 0; flex-shrink: 0; }
.dialog-header-title { font-size: 16px; font-weight: 600; color: var(--chalk-white); }
.folder-dialog-header { justify-content: center; }
.folder-dialog-title { text-align: center; }
.dialog-body { padding: 12px 16px 16px; overflow-y: auto; flex: 1; scrollbar-width: none; -ms-overflow-style: none; }
.dialog-body::-webkit-scrollbar { display: none; }

.form-footer { display: flex; justify-content: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
.capsule-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 18px; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; background: transparent; color: var(--chalk-white-70); cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.2s; }
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
  flex-shrink: 0;
  white-space: nowrap;
  width: 70px;
  text-align: right;
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

:deep(.el-input__count),
:deep(.el-input__count-inner) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.4) !important;
}

/* 生日选择器宽度自适应弹窗 */
:deep(.date-trigger) {
  width: 100%;
}

/* 弹窗内容垂直居中 */
.dialog-centered-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* 更新日志内容（弹窗 teleport 到 body，需自带样式） */
.cl-version {
  color: var(--chalk-amber);
  font-size: 14px;
  font-weight: 600;
  margin: 14px 0 6px;
  padding: 5px 0 5px 10px;
  border-left: 3px solid #f0c040;
  background: linear-gradient(90deg, rgba(240, 192, 64, 0.06) 0%, transparent 100%);
  border-radius: 0 4px 4px 0;
}
.cl-list {
  margin: 0 0 4px 16px;
  padding: 0;
  list-style: none;
  color: var(--chalk-white-75);
}
.cl-list li {
  font-size: 12px;
  line-height: 1.7;
  padding: 2px 0;
  position: relative;
  padding-left: 14px;
}
.cl-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: rgba(255, 255, 255, 0.25);
  font-size: 10px;
  top: 5px;
}

/* 最后一个表单项去掉默认 margin-bottom，确保表单底边与最后输入框底边对齐 */
:deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

</style>

<style scoped>
.profile-page #section-profile .profile-avatar-preview > img {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  max-height: none !important;
}

.profile-page {
  width: min(920px, calc(100% - 64px));
  height: 100%;
  min-height: 0;
  margin: 0 auto;
  padding: 34px 0 48px;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: auto;
  box-sizing: border-box;
}

.profile-avatar-setting {
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 0 0 24px 70px;
}

.profile-avatar {
  display: block;
  flex: 0 0 72px;
  width: 72px;
  height: 72px;
  border: 1px solid rgba(196, 181, 253, 0.34);
  border-radius: 50%;
  background: transparent;
}

.profile-avatar-button {
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  transition: border-color 0.18s ease, transform 0.18s ease;
}

.profile-avatar-button img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.profile-avatar-button:hover:not(:disabled) {
  border-color: #c4b5fd;
  transform: scale(1.03);
}

.profile-avatar-button:disabled,
.profile-avatar-upload:disabled {
  cursor: wait;
  opacity: 0.65;
}

.profile-avatar-input {
  display: none;
}

.profile-avatar-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.profile-avatar-copy strong {
  color: #f1f5f9;
  font-size: 14px;
  font-weight: 600;
}

.profile-avatar-copy span {
  color: rgba(203, 213, 225, 0.62);
  font-size: 12px;
  line-height: 1.5;
}

.profile-avatar-upload {
  width: fit-content;
  padding: 0;
  border: 0;
  color: #c4b5fd;
  background: transparent;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.profile-avatar-upload:hover {
  color: #ddd6fe;
  text-decoration: underline;
}

.profile-content {
  display: grid;
  width: 100%;
  max-width: none;
  height: auto;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: none;
  grid-auto-rows: auto;
  grid-template-areas: "profile" "security" "system" "about";
  align-content: start;
  align-items: stretch;
  gap: 18px;
}

.profile-content > #section-profile { grid-area: profile; }
.profile-content > #section-security { grid-area: security; }
.profile-content > #section-system { grid-area: system; }
.profile-content > #section-about { grid-area: about; }

.profile-content > #section-system,
.profile-content > #section-about {
  border-bottom: 0;
}

.profile-content > #section-about {
  padding-bottom: 0;
}

.profile-content > .profile-section {
  min-width: 0;
  height: auto;
  align-self: start;
  padding: 0 0 26px;
  border: 0;
  border-bottom: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.profile-content :deep(.section-title) {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 20px;
  color: #f1f5f9;
  font-size: 17px;
  font-weight: 650;
  text-align: left;
}

.profile-content :deep(.section-title)::before {
  width: 4px;
  height: 17px;
  border-radius: 999px;
  background: linear-gradient(#a78bfa, #60a5fa);
  content: "";
}

.profile-content :deep(.section-desc) {
  margin: -8px 0 16px;
  color: rgba(203, 213, 225, 0.62);
  font-size: 12px;
}

.profile-content :deep(.security-item),
.profile-content :deep(.setting-item),
.profile-content :deep(.about-item) {
  border-color: rgba(148, 163, 184, 0.12);
  background: transparent;
  box-shadow: none;
}

.profile-content :deep(.security-item) {
  min-height: 42px;
  border-radius: 10px;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.profile-content :deep(.security-item:not(.security-item-static):hover) {
  border-color: rgba(167, 139, 250, 0.22);
  background: rgba(139, 92, 246, 0.08);
}

.profile-content :deep(.security-label),
.profile-content :deep(.setting-label),
.profile-content :deep(.about-label) {
  color: rgba(203, 213, 225, 0.72);
}

.profile-content :deep(.security-value),
.profile-content :deep(.setting-desc),
.profile-content :deep(.about-value) {
  color: #e2e8f0;
}

.profile-content :deep(.setting-item) {
  min-height: 58px;
  padding: 12px 0;
  border-radius: 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  margin-bottom: 0;
}

.profile-content > #section-system :deep(.setting-item) {
  border-bottom: 0;
}

.profile-content :deep(.about-item) {
  border: 0;
  padding: 8px 0;
}

.profile-form {
  width: 100%;
  max-width: 640px;
}

.profile-form :deep(.el-form-item__content) {
  flex: 0 1 460px;
  max-width: 460px;
}

.profile-form :deep(.el-input),
.profile-form :deep(.date-scroll-picker) {
  width: 100%;
  max-width: 460px;
}

.profile-content :deep(.about-link) {
  overflow-wrap: anywhere;
  color: #c4b5fd;
}

.profile-content :deep(.about-tools-row) {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

@media (max-width: 820px) {
  .profile-page {
    width: min(calc(100% - 32px), 620px);
    padding: 24px 0 36px;
  }

  .profile-avatar-setting { margin-left: 0; }

  .profile-content {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "profile" "security" "system" "about";
    gap: 22px;
  }

  .profile-content > .profile-section {
    padding-bottom: 22px;
  }

  .profile-form :deep(.el-form-item__content) {
    max-width: min(460px, 100%);
  }

  .profile-avatar-copy span {
    max-width: 240px;
  }
}
</style>
<style scoped>
.profile-avatar-row {
  margin: 0;
  padding: 12px 0;
}

.profile-avatar-row .profile-avatar-preview {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
  border-radius: 50%;
  border: 2px solid rgba(226, 232, 240, 0.3);
  isolation: isolate;
}

.profile-avatar-row .profile-avatar-preview > img {
  display: block;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  border-radius: 50%;
  object-fit: cover;
  object-position: center;
}

.profile-edit-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  margin: 8px 0 18px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.profile-edit-actions .capsule-btn,
.security-actions .capsule-btn {
  flex: 0 0 auto;
  white-space: nowrap;
  padding: 7px 13px;
}

.profile-birthday-picker {
  display: none;
}

.security-item {
  cursor: default !important;
}

.security-item:hover {
  background: transparent !important;
}

.security-actions {
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
}

@media (max-width: 640px) {
  .profile-edit-actions {
    margin-left: 0;
  }
}
</style>
