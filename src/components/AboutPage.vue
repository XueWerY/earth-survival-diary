<template>
  <div class="about-page">
    <div
        class="toc-bar"
        ref="tocBarRef"
    >
      <div class="toc-bar-inner">
        <div
            v-for="item in toc"
            :key="item.id"
            class="toc-item"
            :class="{ active: activeToc === item.id }"
            :ref="setTocItemRef"
            @click="scrollToSection(item.id)"
        >
          {{ item.text }}
        </div>
      </div>
    </div>

    <el-scrollbar ref="scrollbarRef">
      <div class="about-container">
        <div class="hero-section">
          <div class="hero-bg">
            <div class="planet"></div>
            <div class="orbit orbit-1"></div>
            <div class="orbit orbit-2"></div>
            <div class="stars"></div>
          </div>
          <div class="hero-content">
            <div class="logo-wrapper">
              <span class="logo-icon">🌍</span>
            </div>
            <h1 class="hero-title">地球 Online 生存日记</h1>
            <p class="hero-desc">一个帮助记录生活足迹、规划目标、管理时间的个人效率应用</p>
            <div class="version-row">
              <div class="version-badge">
                <span class="version-icon">⭐</span>
                {{ version }}
              </div>
              <button class="check-update-btn" @click="checkForUpdate">检查更新</button>
            </div>
          </div>
        </div>

        <div class="readme-section">
          <div v-if="loading" class="readme-loading">
            <div class="loading-spinner"></div>
            <p>加载中...</p>
          </div>
          <div v-else-if="error" class="readme-error">
            <p>加载失败</p>
            <el-button type="primary" size="small" @click="fetchData">重试</el-button>
          </div>
          <template v-else>
            <div class="readme-content" ref="readmeContentRef" v-html="renderedHtml"></div>
          </template>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import { logger } from '../lib/logger'

const loading = ref(true)
const error = ref(false)
const version = ref('v0.0.0')
const renderedHtml = ref('')
const toc = ref<{ id: string; text: string }[]>([])
const activeToc = ref('')
const scrollbarRef = ref()
const readmeContentRef = ref<HTMLElement>()
const tocBarRef = ref<HTMLElement>()
const tocItemRefs = ref<HTMLElement[]>([])

const checkForUpdate = async () => {
  if (!window.electronAPI?.checkForUpdate) {
    console.log('[关于] 非 Electron 环境，无法检查更新')
    return
  }
  try {
    const result = await window.electronAPI.checkForUpdate()
    logger.info('[关于] 检查更新结果', result)
  } catch (e) {
    logger.error('[关于] 检查更新失败', { error: e instanceof Error ? e.message : String(e) })
  }
}

marked.setOptions({
  breaks: true,
  gfm: true
})

const clearTocRefs = () => { tocItemRefs.value = [] }
const setTocItemRef = (el: any) => { if (el) tocItemRefs.value.push(el) }

const scrollToCenter = (container: HTMLElement, target: HTMLElement) => {
  const containerWidth = container.clientWidth
  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const targetCenterInContainer = targetRect.left - containerRect.left + container.scrollLeft + (targetRect.width / 2)
  container.scrollTo({ left: Math.max(0, targetCenterInContainer - (containerWidth / 2)), behavior: 'smooth' })
}

const scrollToTocItem = () => {
  nextTick(() => {
    const container = tocBarRef.value as HTMLElement
    if (!container) return
    const activeItem = tocItemRefs.value.find(item => item.classList.contains('active')) as HTMLElement
    if (activeItem) scrollToCenter(container, activeItem)
  })
}

let isTocDragging = false
let tocDragStartX = 0
let tocDragScrollLeft = 0
let isTocDragInit = false

const initTocDrag = () => {
  if (isTocDragInit) return
  isTocDragInit = true
  const el = tocBarRef.value
  if (!el) return
  el.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0) { isTocDragging = true; tocDragStartX = e.pageX; tocDragScrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; el.style.userSelect = 'none' } })
  window.addEventListener('mousemove', (e: MouseEvent) => { if (!isTocDragging) return; e.preventDefault(); const walk = tocDragStartX - e.pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, tocDragScrollLeft + walk)) })
  const endDrag = () => { if (!isTocDragging) return; isTocDragging = false; el.style.cursor = ''; el.style.userSelect = '' }
  window.addEventListener('mouseup', endDrag); window.addEventListener('mouseleave', endDrag)
  el.addEventListener('touchstart', (e: TouchEvent) => { tocDragStartX = e.touches[0].pageX; tocDragScrollLeft = el.scrollLeft }, { passive: true })
  el.addEventListener('touchmove', (e: TouchEvent) => { const walk = tocDragStartX - e.touches[0].pageX; el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, tocDragScrollLeft + walk)) }, { passive: true })
}

const buildToc = () => {
  setTimeout(() => {
    if (!readmeContentRef.value) return
    const h2s = readmeContentRef.value.querySelectorAll('h2')
    toc.value = []
    clearTocRefs()
    h2s.forEach((h2, i) => {
      const id = `about-section-${i}`
      h2.id = id
      toc.value.push({ id, text: h2.textContent || '' })
      nextTick(() => scrollToTocItem())
    })
    nextTick(() => initTocDrag())
  }, 100)
}

const scrollToSection = (id: string) => {
  logger.info('[关于] 切换导航项', { section: id })
  activeToc.value = id
  scrollToTocItem()
  nextTick(() => {
    const target = readmeContentRef.value?.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null
    const wrap = scrollbarRef.value?.$el?.querySelector('.el-scrollbar__wrap') as HTMLElement | null
    if (target && wrap) {
      wrap.scrollTo({ top: target.offsetTop - wrap.offsetTop - 16, behavior: 'smooth' })
    }
  })
}

const fetchData = async () => {
  loading.value = true
  error.value = false

  try {
    const [versionRes, readmeRes] = await Promise.all([
      fetch('/api/version'),
      fetch('/api/readme')
    ])

    if (!versionRes.ok || !readmeRes.ok) {
      throw new Error('API request failed')
    }

    const versionData = await versionRes.json()
    const readmeText = await readmeRes.text()

    version.value = `v${versionData.version}`
    renderedHtml.value = await marked.parse(readmeText)
    buildToc()
  } catch (err) {
    console.error('Failed to load data:', err)
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.about-page {
  height: 100%;
  background: transparent;
  overflow: hidden;
  position: relative;
}

.about-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
      radial-gradient(ellipse at 20% 20%, rgba(100, 150, 255, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(150, 100, 255, 0.06) 0%, transparent 50%);
  pointer-events: none;
  z-index: 1;
}

.about-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 32px 60px;
  position: relative;
  z-index: 1;
}

/* 英雄区域 */
.hero-section {
  position: relative;
  padding: 80px 0 50px;
  text-align: center;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 500px;
  height: 500px;
  pointer-events: none;
}

.planet {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 180px;
  height: 180px;
  background:
      radial-gradient(circle at 35% 35%, rgba(100, 200, 255, 0.5) 0%, rgba(60, 120, 200, 0.3) 30%, rgba(30, 60, 120, 0.2) 60%, transparent 80%);
  border-radius: 50%;
  animation: planetFloat 8s ease-in-out infinite;
  box-shadow:
      0 0 60px rgba(100, 200, 255, 0.2),
      0 0 120px rgba(100, 200, 255, 0.1);
}

@keyframes planetFloat {
  0%, 100% { transform: translate(-50%, -50%) translateY(0) scale(1); }
  50% { transform: translate(-50%, -50%) translateY(-15px) scale(1.02); }
}

.orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid rgba(100, 200, 255, 0.1);
  border-radius: 50%;
  animation: orbitPulse 4s ease-in-out infinite;
}

.orbit-1 {
  width: 260px;
  height: 260px;
  transform: translate(-50%, -50%);
  animation-delay: 0s;
}

.orbit-2 {
  width: 340px;
  height: 340px;
  transform: translate(-50%, -50%);
  animation-delay: 1s;
}

@keyframes orbitPulse {
  0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.02); }
}

.stars {
  position: fixed;
  inset: 0;
  background-image:
      radial-gradient(1px 1px at 30px 40px, rgba(255, 255, 255, 0.8), transparent),
      radial-gradient(2px 2px at 80px 60px, rgba(255, 255, 255, 0.6), transparent),
      radial-gradient(1px 1px at 130px 30px, rgba(255, 255, 255, 0.7), transparent),
      radial-gradient(2px 2px at 180px 100px, rgba(255, 255, 255, 0.5), transparent),
      radial-gradient(1px 1px at 220px 50px, rgba(255, 255, 255, 0.6), transparent),
      radial-gradient(2px 2px at 280px 80px, rgba(255, 255, 255, 0.4), transparent),
      radial-gradient(1px 1px at 350px 120px, rgba(255, 255, 255, 0.5), transparent),
      radial-gradient(2px 2px at 400px 60px, rgba(255, 255, 255, 0.6), transparent),
      radial-gradient(1px 1px at 450px 150px, rgba(255, 255, 255, 0.4), transparent);
  background-size: 500px 200px;
  animation: starsTwinkle 5s ease-in-out infinite;
  z-index: 0;
  pointer-events: none;
}

@keyframes starsTwinkle {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.hero-content {
  position: relative;
  z-index: 1;
}

.logo-wrapper {
  margin-bottom: 20px;
}

.logo-icon {
  font-size: 72px;
  display: inline-block;
  animation: logoBounce 3s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(100, 200, 255, 0.4));
}

@keyframes logoBounce {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-8px) rotate(-2deg); }
  75% { transform: translateY(-8px) rotate(2deg); }
}

.hero-title {
  font-size: 42px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 16px;
  letter-spacing: 2px;
  text-shadow: 0 0 40px rgba(100, 200, 255, 0.3);
}

.hero-desc {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 24px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: linear-gradient(135deg, rgba(100, 200, 255, 0.15) 0%, rgba(150, 100, 255, 0.15) 100%);
  border: 1px solid rgba(100, 200, 255, 0.25);
  border-radius: 30px;
  font-size: 14px;
  color: rgba(100, 200, 255, 0.95);
  font-weight: 600;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(100, 200, 255, 0.1);
}

.version-icon {
  font-size: 12px;
}

.version-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.check-update-btn {
  padding: 8px 18px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(100,200,255,0.25);
  border-radius: 30px;
  font-size: 13px;
  color: rgba(100,200,255,0.85);
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
}
.check-update-btn:hover {
  background: rgba(100,200,255,0.12);
  border-color: rgba(100,200,255,0.5);
}

/* 加载状态 */
.readme-loading,
.readme-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  color: rgba(255, 255, 255, 0.5);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(100, 200, 255, 0.1);
  border-top-color: rgba(100, 200, 255, 0.8);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* README 内容样式 */
.readme-section {
  margin-top: 10px;
}

/* 目录导航栏 */
.toc-bar {
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.toc-bar-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px;
  white-space: nowrap;
  width: max-content;
  min-width: 100%;
  height: 56px;
  box-sizing: border-box;
}

.toc-bar::-webkit-scrollbar {
  display: none;
}

.toc-bar {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.toc-item {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toc-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.toc-item.active {
  background: rgba(100, 200, 255, 0.15);
  border-color: rgba(100, 200, 255, 0.3);
  color: rgba(100, 200, 255, 0.95);
}

.readme-content {
  color: rgba(255, 255, 255, 0.85);
  font-size: 15px;
  line-height: 1.9;
}

/* 隐藏原标题和描述（已在英雄区域显示） */
.readme-content :deep(h1) {
  display: none;
}

.readme-content :deep(h1 + p) {
  display: none;
}

/* H2 区块标题 */
.readme-content :deep(h2) {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin: 48px 0 24px 0;
  padding: 0 0 16px 0;
  border-bottom: 2px solid rgba(100, 200, 255, 0.2);
  position: relative;
}

.readme-content :deep(h2)::before {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, rgba(100, 200, 255, 0.8), transparent);
}

/* H3 功能标题 - 卡片样式 */
.readme-content :deep(h3) {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  margin: 28px 0 14px 0;
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(10px);
}

.readme-content :deep(h3):hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
  border-color: rgba(100, 200, 255, 0.2);
}

/* 段落 */
.readme-content :deep(p) {
  margin: 14px 0;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.8;
}

/* 链接 */
.readme-content :deep(a) {
  color: rgba(100, 200, 255, 0.9);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
}

.readme-content :deep(a:hover) {
  border-bottom-color: rgba(100, 200, 255, 0.5);
}

/* 列表 */
.readme-content :deep(ul),
.readme-content :deep(ol) {
  padding-left: 0;
  margin: 16px 0;
  list-style: none;
}

.readme-content :deep(li) {
  position: relative;
  padding-left: 24px;
  margin: 10px 0;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.7;
}

.readme-content :deep(li)::before {
  content: '→';
  position: absolute;
  left: 0;
  color: rgba(100, 200, 255, 0.6);
  font-weight: 600;
}

.readme-content :deep(ol) {
  counter-reset: item;
}

.readme-content :deep(ol > li) {
  counter-increment: item;
}

.readme-content :deep(ol > li)::before {
  content: counter(item) '.';
  font-weight: 600;
}

/* 内联代码 */
.readme-content :deep(code) {
  background: rgba(100, 200, 255, 0.1);
  padding: 3px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 0.88em;
  color: rgba(100, 200, 255, 0.95);
  border: 1px solid rgba(100, 200, 255, 0.15);
}

/* 代码块 */
.readme-content :deep(pre) {
  background: rgba(0, 0, 0, 0.4);
  padding: 20px 24px;
  border-radius: 12px;
  overflow-x: auto;
  margin: 20px 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.readme-content :deep(pre)::before {
  content: '';
  position: absolute;
  top: 12px;
  left: 16px;
  width: 8px;
  height: 8px;
  background: rgba(255, 95, 87, 0.8);
  border-radius: 50%;
  box-shadow: 16px 0 0 rgba(255, 189, 46, 0.8), 32px 0 0 rgba(39, 201, 63, 0.8);
}

.readme-content :deep(pre code) {
  background: transparent;
  padding: 0;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  display: block;
  margin-top: 16px;
}

/* 引用 */
.readme-content :deep(blockquote) {
  border-left: 3px solid rgba(100, 200, 255, 0.5);
  margin: 20px 0;
  padding: 12px 20px;
  background: rgba(100, 200, 255, 0.05);
  border-radius: 0 8px 8px 0;
  color: rgba(255, 255, 255, 0.65);
}

/* 表格 */
.readme-content :deep(table) {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  margin: 24px 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.readme-content :deep(th),
.readme-content :deep(td) {
  padding: 14px 18px;
  text-align: left;
}

.readme-content :deep(th) {
  background: rgba(100, 200, 255, 0.1);
  font-weight: 600;
  color: #fff;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.readme-content :deep(td) {
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.75);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.readme-content :deep(tr:hover td) {
  background: rgba(255, 255, 255, 0.05);
}

/* 分隔线 */
.readme-content :deep(hr) {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(100, 200, 255, 0.3), transparent);
  margin: 40px 0;
}

/* 图片 */
.readme-content :deep(img) {
  max-width: 100%;
  border-radius: 12px;
  margin: 16px 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

/* 响应式 */
@media (max-width: 768px) {
  .about-container {
    padding: 0 20px 40px;
  }

  .hero-section {
    padding: 50px 0 40px;
  }

  .hero-title {
    font-size: 32px;
    letter-spacing: 1px;
  }

  .hero-desc {
    font-size: 14px;
  }

  .logo-icon {
    font-size: 56px;
  }

  .readme-content :deep(h2) {
    font-size: 20px;
  }

  .readme-content :deep(h3) {
    font-size: 15px;
  }

  .readme-content :deep(table) {
    font-size: 13px;
  }

  .readme-content :deep(th),
  .readme-content :deep(td) {
    padding: 10px 12px;
  }
}
</style>
