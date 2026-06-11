<template>
  <div class="auth-page" :class="{ 'is-mobile': !isElectron }">
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

      <Transition name="form-slide" mode="out-in">
        <div :key="mode">
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
            </div>
            <div v-else class="footer-row">
              <span>已有账号？</span>
              <span class="link" @click="switchMode('login')">立即登录</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { Message, Lock, User } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useAuthStore } from '../../stores/authStore'
import { logger } from '../../lib/logger'
import * as api from '../../lib/api'

const emit = defineEmits<{
  success: []
}>()

const authStore = useAuthStore()

const isElectron = inject<boolean>('isElectron', false)

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
  -webkit-tap-highlight-color: transparent;
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

.auth-page.is-mobile .auth-title {
  font-size: 22px;
  background: none;
  -webkit-background-clip: initial;
  -webkit-text-fill-color: initial;
  background-clip: initial;
  color: #667eea;
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

.link {
  color: #667eea;
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
}

/* 登录/注册切换过渡动画 */
.form-slide-enter-active,
.form-slide-leave-active {
  transition: all 0.25s ease;
}

.form-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.form-slide-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
