<template>
  <div class="file-manager">
    <!-- 模式切换栏 -->
    <div class="fm-mode-bar">
      <button class="fm-mode-btn" :class="{ active: mode === 'browse' }" @click="switchMode('browse')">
        <span class="fm-mode-icon">📁</span>
        <span class="fm-mode-label">文件浏览</span>
      </button>
      <button class="fm-mode-btn" :class="{ active: mode === 'export' }" @click="switchMode('export')">
        <span class="fm-mode-icon">📤</span>
        <span class="fm-mode-label">数据导出</span>
      </button>
      <button class="fm-mode-btn" :class="{ active: mode === 'import' }" @click="switchMode('import')">
        <span class="fm-mode-icon">📥</span>
        <span class="fm-mode-label">数据导入</span>
      </button>
      <button class="fm-mode-btn" :class="{ active: mode === 'clean-logs' }" @click="switchMode('clean-logs')">
        <span class="fm-mode-icon">🗑️</span>
        <span class="fm-mode-label">清理日志</span>
      </button>
    </div>

    <!-- 文件浏览模式 -->
    <template v-if="mode === 'browse'">
    <div class="fm-header">
      <div class="fm-breadcrumb">
        <span class="fm-breadcrumb-item" @click="navigateTo('root')">根目录</span>
        <template v-for="(seg, idx) in breadcrumbs" :key="idx">
          <span class="fm-sep">/</span>
          <span class="fm-breadcrumb-item" @click="seg.isFile ? null : navigateTo(seg.path)">{{ seg.name }}</span>
        </template>
      </div>
    </div>

    <!-- 日志查看器模式 -->
    <div v-if="viewingLogFile" class="log-viewer">
      <div class="log-toolbar">
        <input v-model="logFilterText" type="text" placeholder="搜索日志..." class="log-filter-input" @input="renderLogLines">
        <div class="log-filter-actions">
          <div class="log-level-select-wrap" @click.stop="logLevelMenuVisible = !logLevelMenuVisible">
            <span class="log-level-trigger-text">{{ logCurrentLevelLabel }}</span>
            <span class="log-level-arrow">&#9660;</span>
            <div v-if="logLevelMenuVisible" class="log-level-menu" @click.stop>
              <div v-for="opt in logLevelOptions" :key="opt.value" class="log-level-option" :class="{ active: logLevelFilter === opt.value }" @click="selectLogLevel(opt.value)">{{ opt.label }}</div>
            </div>
          </div>
          <button class="log-clear-btn" @click="clearLogFilter">清除过滤</button>
        </div>
      </div>
      <div class="log-container">
        <div v-if="logLines.length === 0" class="log-empty">暂无日志内容</div>
        <div v-else-if="logFilteredLines.length === 0" class="log-empty">没有匹配的记录</div>
        <div v-for="(line, idx) in logFilteredLines" :key="idx" class="log-line" v-html="line"></div>
      </div>
    </div>

    <!-- 文件列表模式 -->
    <template v-else>
      <div v-if="loading" class="fm-loading">加载中...</div>
      <div v-else-if="error" class="fm-error">{{ error }}</div>
      <div v-else class="fm-body">
        <div v-if="entries.length === 0" class="fm-empty">此目录为空</div>
        <div v-else class="fm-list">
          <div
            v-for="entry in sortedEntries"
            :key="entry.path"
            class="fm-item"
            :class="{ 'fm-item-dir': entry.isDirectory }"
            @click="entry.isDirectory ? navigateTo(entry.path) : openFile(entry)"
          >
            <span class="fm-icon">{{ entry.isDirectory ? '📁' : getFileIcon(entry.name) }}</span>
            <span class="fm-name">{{ entry.name }}</span>
            <span class="fm-size">{{ formatSize(entry.size) }}</span>
            <span class="fm-actions" @click.stop>
              <button class="fm-action-btn delete-btn" title="删除" @click="confirmDelete(entry)">🗑️</button>
            </span>
          </div>
        </div>
      </div>

      <!-- 文件内容查看弹窗 -->
      <div v-if="previewFile" class="fm-overlay" @click.self="previewFile = null">
        <div class="fm-preview-dialog">
          <div class="fm-preview-header">
            <span class="fm-preview-name">{{ previewFile.name }}</span>
            <button class="fm-preview-close" @click="previewFile = null">✕</button>
          </div>
          <pre class="fm-preview-content">{{ previewContent || '加载中...' }}</pre>
        </div>
      </div>

      <!-- 删除确认弹窗 -->
      <div v-if="deleteTarget" class="fm-overlay" @click.self="deleteTarget = null">
        <div class="fm-confirm-dialog">
          <div class="fm-confirm-title">确认删除</div>
          <div class="fm-confirm-msg">{{ deleteTarget.isDirectory ? '确定要删除目录 ' : '确定要删除文件 ' }}<strong>{{ deleteTarget.name }}</strong> 吗？{{ deleteTarget.isDirectory ? '目录内的所有内容将被删除。' : '' }}</div>
          <div class="fm-confirm-actions">
            <button class="fm-btn-cancel" @click="deleteTarget = null">取消</button>
            <button class="fm-btn-confirm" @click="doDelete">确认删除</button>
          </div>
        </div>
      </div>
    </template>
    </template>

    <!-- 数据导出模式 -->
    <template v-else-if="mode === 'export'">
      <div class="tool-container">
        <p class="tool-desc">选择要导出的数据模块，通过局域网发送给其他设备</p>
        <div class="module-tree">
          <div class="select-all-row">
            <el-checkbox v-model="exportSelectAll" @change="onExportSelectAll">全选</el-checkbox>
            <el-button v-if="!lanServerInfo" type="primary" size="default" round @click="handleExportViaLan" :loading="exportLoading" :disabled="exportSelected.length === 0">
              <span style="margin-right:4px">📤</span>通过局域网发送
            </el-button>
          </div>
          <div v-for="group in exportGroups" :key="group.key" class="module-group">
            <div class="group-header" @click="toggleExportGroup(group.key)">
              <span class="expand-icon">{{ exportExpanded.includes(group.key) ? '−' : '+' }}</span>
              <span class="group-label">{{ group.label }}</span>
            </div>
            <div v-show="exportExpanded.includes(group.key)" class="group-children">
              <div v-for="child in group.children" :key="child.key" class="child-item">
                <el-checkbox v-model="exportSelected" :label="child.key">{{ child.label }}</el-checkbox>
              </div>
            </div>
          </div>
        </div>

        <!-- 局域网传输就绪弹窗 -->
        <div v-if="lanServerInfo" class="fm-overlay" @click.self="handleStopLanServer">
          <div class="lan-dialog">
            <div class="lan-dialog-icon">📡</div>
            <div class="lan-dialog-title">局域网传输已就绪</div>
            <p class="lan-dialog-desc">请在另一台设备的「数据导入」中输入以下地址：</p>
            <div class="lan-address-box">
              <span class="lan-address-text">{{ lanServerInfo.ip }}:{{ lanServerInfo.port }}</span>
              <el-button type="primary" size="small" round @click="copyLanAddress">📋 复制</el-button>
            </div>
            <div class="lan-qr-section">
              <div class="lan-qr-divider"><span>或</span></div>
              <p class="lan-qr-hint">使用其他设备的「扫码导入」扫描下方二维码</p>
              <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="二维码" class="lan-qr-image" />
            </div>
            <p class="lan-status-hint">数据传输中请勿关闭此页面</p>
            <el-button round @click="handleStopLanServer">⏹️ 停止传输</el-button>
          </div>
        </div>
      </div>
    </template>

    <!-- 数据导入模式 -->
    <template v-else-if="mode === 'import'">
      <div class="tool-container">
        <p class="tool-desc">从局域网其他设备导入数据，覆盖当前用户的对应数据</p>

        <div v-if="!importedData" class="lan-connect-area">
          <div class="lan-connect-row">
            <input v-model="lanTargetAddress" type="text" class="lan-ip-input" placeholder="发送方地址，例如：192.168.1.100:5789" />
            <el-button type="primary" round @click="handleConnectLan" :loading="importConnecting">🔗 连接</el-button>
          </div>
          <div class="lan-or-divider"><span>或</span></div>
          <div class="lan-scan-btn-row">
            <el-button title="扫描二维码" round @click="openQRScanner">📷 扫码</el-button>
          </div>
          <div v-if="importErrorMsg" class="lan-error-msg">{{ importErrorMsg }}</div>
        </div>

        <div v-else>
          <div class="module-tree">
            <div class="select-all-row">
              <el-checkbox v-model="importSelectAll" @change="onImportSelectAll">全选</el-checkbox>
            </div>
            <div v-for="group in importGroups" :key="group.key" class="module-group">
              <div class="group-header" @click="toggleImportGroup(group.key)">
                <span class="expand-icon">{{ importExpanded.includes(group.key) ? '−' : '+' }}</span>
                <span class="group-label">{{ group.label }}</span>
              </div>
              <div v-show="importExpanded.includes(group.key)" class="group-children">
                <div v-for="child in group.children" :key="child.key" class="child-item">
                  <el-checkbox v-model="importSelected" :label="child.key" :disabled="!importAvailable[child.key]">
                    {{ child.label }} {{ !importAvailable[child.key] ? '(无数据)' : '' }}
                  </el-checkbox>
                </div>
              </div>
            </div>
          </div>

          <div class="tool-footer tool-footer-center">
            <el-button round @click="handleResetImport">🔄 重新连接</el-button>
            <el-button type="primary" round @click="handleImportData" :loading="importLoading" :disabled="importSelected.length === 0">📥 导入</el-button>
          </div>
        </div>
      </div>

      <!-- QR 码扫描弹窗 -->
      <div v-if="showQRScanner" class="fm-overlay" @click.self="closeQRScanner">
        <div class="qr-scanner-dialog">
          <div class="qr-scanner-header">
            <span class="qr-scanner-title">扫描二维码</span>
            <button class="fm-preview-close" @click="closeQRScanner">✕</button>
          </div>
          <div class="qr-scanner-container">
            <video ref="scannerVideo" autoplay playsinline class="qr-scanner-video"></video>
            <canvas ref="scannerCanvas" class="qr-scanner-canvas"></canvas>
          </div>
          <p class="qr-scanner-hint">将二维码对准摄像头</p>
          <el-button round @click="closeQRScanner">取消</el-button>
        </div>
      </div>
    </template>

    <!-- 清理日志模式 -->
    <template v-else-if="mode === 'clean-logs'">
      <div class="tool-container">
        <p class="tool-desc">设置自动清理日志的规则，登录后会自动执行清理</p>
        <div class="clean-logs-card">
          <div class="clean-logs-row">
            <span class="clean-logs-label">自动清理日志</span>
            <el-switch v-model="autoCleanEnabled" size="small" @change="handleAutoCleanToggle" />
          </div>
          <div v-if="autoCleanEnabled" class="clean-logs-days">
            <span>自动清理过去</span>
            <el-input-number v-model="autoCleanDays" :min="1" :max="365" size="small" controls-position="right" @change="handleAutoCleanDaysChange" />
            <span>天的日志</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { CapacitorHttp } from '@capacitor/core'
import HttpServer from './capacitor-http-server'
import { logger } from '../../../../lib/logger'
import { useSettingsStore } from '../../../../stores/settingsStore'
import * as api from '../../../../lib/api'
import QRCode from 'qrcode'
import jsQR from 'jsqr'

// ====== 导入/导出模块定义 ======
interface ModuleChildDef {
  key: string
  label: string
  dataKeys: string[]
}

interface ModuleGroupDef {
  key: string
  label: string
  children: ModuleChildDef[]
}

const MODULE_DEFS: ModuleGroupDef[] = [
  {
    key: 'footprint',
    label: '足迹',
    children: [
      { key: 'footprint', label: '足迹记录', dataKeys: ['footprint/footprint'] }
    ]
  },
  {
    key: 'focus',
    label: '专注',
    children: [
      { key: 'focus', label: '专注数据', dataKeys: ['focus/favorites', 'focus/records'] }
    ]
  },
  {
    key: 'list',
    label: '清单',
    children: [
      { key: 'list', label: '清单数据', dataKeys: ['list/lists', 'list/tasks', 'list/folders', 'list/completed'] }
    ]
  },
  {
    key: 'countdown',
    label: '倒数日',
    children: [
      { key: 'countdown', label: '倒数日数据', dataKeys: ['countdown/categories', 'countdown/countdowns'] }
    ]
  },
  {
    key: 'course',
    label: '课程表',
    children: [
      { key: 'course', label: '课程表数据', dataKeys: ['course/courses'] }
    ]
  },
  {
    key: 'profile',
    label: '个人资料',
    children: [
      { key: 'profile', label: '个人资料', dataKeys: ['profile/profile'] },
      { key: 'settings', label: '设置', dataKeys: ['settings/settings'] }
    ]
  }
]

interface FsEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

interface Breadcrumb {
  name: string
  path: string
  isFile: boolean
}

const isElectron = !!(window as any).electronAPI
const loading = ref(false)
const error = ref('')
const currentDir = ref<string>('root')
const entries = ref<FsEntry[]>([])
const breadcrumbs = ref<Breadcrumb[]>([])
const previewFile = ref<FsEntry | null>(null)
const previewContent = ref('')
const deleteTarget = ref<FsEntry | null>(null)

// Electron 端的根目录路径
const electronRoots = ref<{ data: string; logs: string }>({ data: '', logs: '' })

// 日志查看器状态
const viewingLogFile = ref(false)
const logFilterText = ref('')
const logLevelFilter = ref('')
const logContent = ref('')
const logLines = ref<string[]>([])
const logFilteredLines = ref<string[]>([])
const logLevelMenuVisible = ref(false)
let logRefreshTimer: ReturnType<typeof setInterval> | null = null

// 自动清理日志设置
const settingsStore = useSettingsStore()
const autoCleanEnabled = ref((settingsStore.settings as any)?.autoClean?.enabled ?? false)
const autoCleanDays = ref((settingsStore.settings as any)?.autoClean?.days ?? 30)

// ====== 模式切换 ======
const mode = ref<'browse' | 'export' | 'import' | 'clean-logs'>('browse')

// ====== 导出状态 ======
const exportSelectAll = ref(false)
const exportSelected = ref<string[]>([])
const exportExpanded = ref<string[]>(MODULE_DEFS.map(g => g.key))
const lanServerInfo = ref<{ ip: string; port: number } | null>(null)
const exportLoading = ref(false)

// ====== 导入状态 ======
const importSelectAll = ref(false)
const importSelected = ref<string[]>([])
const importExpanded = ref<string[]>(MODULE_DEFS.map(g => g.key))
const importAvailable = ref<Record<string, boolean>>({})
const importedData = ref<any>(null)
const lanTargetAddress = ref('')
const importConnecting = ref(false)
const importLoading = ref(false)
const importErrorMsg = ref('')

// ====== QR 码状态 ======
const qrCodeDataUrl = ref('')
const showQRScanner = ref(false)

// ====== 导出/导入目录树 ======
const exportGroups = computed(() => MODULE_DEFS)
const importGroups = computed(() => MODULE_DEFS)

// ====== 全选框同步 ======
watch(exportSelected, (val) => {
  const allChildKeys: string[] = []
  MODULE_DEFS.forEach(g => g.children.forEach(c => allChildKeys.push(c.key)))
  exportSelectAll.value = allChildKeys.length > 0 && val.length === allChildKeys.length
}, { deep: true })

watch(importSelected, (val) => {
  const allAvailable: string[] = []
  MODULE_DEFS.forEach(g => g.children.forEach(c => {
    if (importAvailable.value[c.key]) allAvailable.push(c.key)
  }))
  importSelectAll.value = allAvailable.length > 0 && val.length === allAvailable.length
}, { deep: true })

const logLevelOptions = [
  { value: '', label: '全部级别' },
  { value: 'DEBUG', label: 'DEBUG' },
  { value: 'INFO', label: 'INFO' },
  { value: 'WARN', label: 'WARN' },
  { value: 'ERROR', label: 'ERROR' },
]

const logCurrentLevelLabel = computed(() => {
  const opt = logLevelOptions.find(o => o.value === logLevelFilter.value)
  return opt ? opt.label : '全部级别'
})

const sortedEntries = computed(() => {
  const dirs = entries.value.filter(e => e.isDirectory)
  const files = entries.value.filter(e => !e.isDirectory)
  dirs.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.name.localeCompare(b.name))
  return [...dirs, ...files]
})

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'json') return '📋'
  if (ext === 'log') return '📝'
  if (ext === 'txt' || ext === 'md') return '📄'
  return '📄'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0
  try {
    let items: Array<{ name: string; path: string; isDirectory: boolean; size: number }>
    if (isElectron) {
      const electronAPI = (window as any).electronAPI
      const raw = await electronAPI.readDirectory(dirPath)
      items = raw.map((e: any) => ({
        name: e.name, path: e.path, isDirectory: e.isDirectory, size: e.size
      }))
    } else {
      const result = await Filesystem.readdir({ path: dirPath, directory: Directory.Data })
      items = []
      for (const item of result.files) {
        const itemPath = dirPath ? dirPath + '/' + item.name : item.name
        try {
          const stat = await Filesystem.stat({ path: itemPath, directory: Directory.Data })
          items.push({
            name: item.name, path: itemPath,
            isDirectory: stat.type === 'directory',
            size: stat.type === 'file' ? stat.size : 0
          })
        } catch { /* skip */ }
      }
    }
    const sizes = await Promise.all(items.map(async (item) => {
      if (item.isDirectory) return await getDirectorySize(item.path)
      return item.size
    }))
    totalSize = sizes.reduce((a, b) => a + b, 0)
  } catch { /* return 0 */ }
  return totalSize
}

async function computeDirSizes(entryList: FsEntry[]) {
  const dirs = entryList.filter(e => e.isDirectory)
  if (dirs.length === 0) return
  await Promise.all(dirs.map(async (dir) => {
    dir.size = await getDirectorySize(dir.path)
  }))
}

async function loadDir(dirPath: string) {
  loading.value = true
  error.value = ''
  try {
    if (isElectron) {
      const electronAPI = (window as any).electronAPI
      const raw = await electronAPI.readDirectory(dirPath)
      entries.value = raw.map((e: any) => ({
        name: e.name,
        path: e.path,
        isDirectory: e.isDirectory,
        size: e.size
      }))
    } else {
      const result = await Filesystem.readdir({
        path: dirPath,
        directory: Directory.Data
      })
      const list: FsEntry[] = []
      for (const item of result.files) {
        const itemPath = dirPath ? dirPath + '/' + item.name : item.name
        try {
          const stat = await Filesystem.stat({
            path: itemPath,
            directory: Directory.Data
          })
          list.push({
            name: item.name,
            path: itemPath,
            isDirectory: stat.type === 'directory',
            size: stat.type === 'file' ? stat.size : 0
          })
        } catch {
          list.push({
            name: item.name,
            path: itemPath,
            isDirectory: false,
            size: 0
          })
        }
      }
      entries.value = list
    }
    // 计算目录大小
    await computeDirSizes(entries.value)
  } catch (e: any) {
    entries.value = []
  } finally {
    loading.value = false
  }
}

async function navigateTo(target: string) {
  // 退出日志查看模式
  closeLogViewer()

  if (target === 'root') {
    currentDir.value = 'root'
    breadcrumbs.value = []
    await showRoots()
    return
  }
  currentDir.value = target
  await loadDir(target)
  updateBreadcrumbs()
}

function updateBreadcrumbs() {
  if (currentDir.value === 'root') {
    breadcrumbs.value = []
    return
  }
  let relativePath: string
  let baseName = ''
  if (isElectron) {
    const dataDir = electronRoots.value.data
    const logsDir = electronRoots.value.logs
    if (currentDir.value.startsWith(dataDir)) {
      relativePath = currentDir.value.substring(dataDir.length).replace(/\\/g, '/').replace(/^\//, '')
      baseName = 'data'
    } else if (currentDir.value.startsWith(logsDir)) {
      relativePath = currentDir.value.substring(logsDir.length).replace(/\\/g, '/').replace(/^\//, '')
      baseName = 'logs'
    } else {
      relativePath = currentDir.value
    }
    // 保持层级完整性：始终将 data/logs 目录名作为路径前缀
    if (baseName) {
      relativePath = relativePath ? baseName + '/' + relativePath : baseName
    }
  } else {
    relativePath = currentDir.value
  }

  const segs = relativePath.split('/').filter(Boolean)
  const crumbs: Breadcrumb[] = []
  let acc = ''
  for (const seg of segs) {
    if (isElectron) {
      if (!acc) {
        acc = seg === 'data' ? electronRoots.value.data : seg === 'logs' ? electronRoots.value.logs : seg
      } else {
        acc = acc + '\\' + seg
      }
    } else {
      acc = acc ? acc + '/' + seg : seg
    }
    crumbs.push({ name: seg, path: acc || seg, isFile: false })
  }
  breadcrumbs.value = crumbs
}

async function showRoots() {
  loading.value = true
  error.value = ''
  try {
    if (isElectron) {
      const electronAPI = (window as any).electronAPI
      const dataPath = await electronAPI.getDataDirPath()
      const logsPath = await electronAPI.getLogDirPath()
      electronRoots.value = { data: dataPath, logs: logsPath }
      entries.value = [
        { name: 'data', path: dataPath, isDirectory: true, size: 0 },
        { name: 'logs', path: logsPath, isDirectory: true, size: 0 }
      ]
    } else {
      const allEntries: FsEntry[] = []
      for (const dirName of ['data', 'logs']) {
        allEntries.push({
          name: dirName,
          path: dirName,
          isDirectory: true,
          size: 0
        })
      }
      entries.value = allEntries
    }
    // 计算根目录大小
    await computeDirSizes(entries.value)
  } catch (e: any) {
    error.value = '加载失败: ' + (e.message || String(e))
    logger.error('[文件管理器] 加载根目录失败', { error: e })
  } finally {
    loading.value = false
  }
}

async function openFile(entry: FsEntry) {
  if (entry.isDirectory) return

  const ext = entry.name.split('.').pop()?.toLowerCase()

  // 点击 .log 文件时进入日志查看器模式
  if (ext === 'log') {
    viewingLogFile.value = true
    // 更新面包屑显示文件路径
    if (isElectron) {
      const logsDir = electronRoots.value.logs
      const dataDir = electronRoots.value.data
      let relPath: string
      let baseDirPath = ''
      if (entry.path.startsWith(logsDir)) {
        relPath = 'logs/' + entry.path.substring(logsDir.length).replace(/\\/g, '/').replace(/^\//, '')
        baseDirPath = logsDir
      } else if (entry.path.startsWith(dataDir)) {
        relPath = 'data/' + entry.path.substring(dataDir.length).replace(/\\/g, '/').replace(/^\//, '')
        baseDirPath = dataDir
      } else {
        relPath = entry.name
      }
      const segs = relPath.split('/').filter(Boolean)
      let acc = ''
      breadcrumbs.value = segs.map((seg, i) => {
        if (i === 0) {
          acc = baseDirPath
        } else {
          acc = acc + '\\' + seg
        }
        return { name: seg, path: acc, isFile: i === segs.length - 1 }
      })
    } else {
      breadcrumbs.value = entry.path.split('/').filter(Boolean).map((seg: string) => ({ name: seg, path: seg, isFile: false }))
      if (breadcrumbs.value.length > 0) {
        breadcrumbs.value[breadcrumbs.value.length - 1].isFile = true
      }
    }
    await loadLogFile(entry)
    return
  }

  // 非 .log 文件使用原有的预览弹窗
  previewFile.value = entry
  previewContent.value = '加载中...'
  try {
    let content: string
    if (isElectron) {
      const electronAPI = (window as any).electronAPI
      content = await electronAPI.readTextFilePath(entry.path)
    } else {
      const result = await Filesystem.readFile({
        path: entry.path,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      })
      content = result.data as string
    }
    if (ext === 'json') {
      try {
        content = JSON.stringify(JSON.parse(content), null, 2)
      } catch { /* 保持原内容 */ }
    }
    previewContent.value = content
  } catch (e: any) {
    previewContent.value = '读取文件失败: ' + (e.message || String(e))
    logger.error('[文件管理器] 读取文件失败', { path: entry.path, error: e })
  }
}

function closeLogViewer() {
  if (viewingLogFile.value) {
    viewingLogFile.value = false
    if (logRefreshTimer) {
      clearInterval(logRefreshTimer)
      logRefreshTimer = null
    }
  }
}

// ====== 日志查看器函数 ======
async function loadLogFile(entry: FsEntry) {
  try {
    // 读文件前先等待日志写入队列完成，确保读取到最新内容
    if (!isElectron) {
      await logger.flushWriteQueue()
    }
    let content: string
    if (isElectron) {
      const electronAPI = (window as any).electronAPI
      content = await electronAPI.readTextFilePath(entry.path)
    } else {
      const result = await Filesystem.readFile({
        path: entry.path,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      })
      content = result.data as string
    }
    // 统一换行符，避免 \r\n 导致行解析异常
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    if (content !== logContent.value) {
      logContent.value = content
      logLines.value = content.split('\n')
      renderLogLines()
    }
  } catch {
    logLines.value = ['加载日志失败']
    logFilteredLines.value = []
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function colorizeJson(pretty: string): string {
  return pretty
    .replace(/("[^"]*")\s*:/g, '<span class="jk">$1</span>:')
    .replace(/: "(.*?)"/g, ': <span class="js">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="jn">$1</span>')
    .replace(/: (true|false)/g, ': <span class="jb">$1</span>')
    .replace(/: (null)/g, ': <span class="jnl">$1</span>')
    .replace(/([{}\[\],])/g, '<span class="jp">$1</span>')
}

function formatContent(content: string): string {
  const start = content.indexOf('{')
  if (start === -1) return escapeHtml(content)

  let depth = 0, inStr = false
  for (let i = start; i < content.length; i++) {
    const ch = content[i]
    if (ch === '\\' && inStr) { i++; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const before = formatContent(content.substring(0, start))
        const json = content.substring(start, i + 1)
        const after = formatContent(content.substring(i + 1))
        try {
          const obj = JSON.parse(json)
          return before + colorizeJson(JSON.stringify(obj, null, 2)) + after
        } catch {
          return before + escapeHtml(json) + after
        }
      }
    }
  }
  return escapeHtml(content)
}

function parseLogLine(line: string) {
  const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)/)
  if (!match) return { time: '', level: '', content: line }
  return { time: match[1], level: match[2], content: match[3] }
}

function renderLogLine(line: string): string {
  const parsed = parseLogLine(line)
  if (parsed.time) {
    const levelClass = parsed.level ? 'log-level-' + parsed.level.toLowerCase() : ''
    return `[<span class="log-time">${escapeHtml(parsed.time)}</span>] [<span class="${levelClass}">${escapeHtml(parsed.level)}</span>] <span class="log-content">${formatContent(parsed.content)}</span>`
  }
  return `<span class="log-content">${formatContent(parsed.content)}</span>`
}

function renderLogLines() {
  const filter = logFilterText.value.toLowerCase()
  const level = logLevelFilter.value
  logFilteredLines.value = logLines.value.filter(line => {
    if (!line.trim()) return false
    if (filter && line.toLowerCase().indexOf(filter) === -1) return false
    if (level) {
      const parsed = parseLogLine(line)
      if (parsed.level !== level) return false
    }
    return true
  }).map(renderLogLine)
}

function selectLogLevel(value: string) {
  logLevelFilter.value = value
  logLevelMenuVisible.value = false
  renderLogLines()
}

function clearLogFilter() {
  logFilterText.value = ''
  logLevelFilter.value = ''
  renderLogLines()
}

function confirmDelete(entry: FsEntry) {
  deleteTarget.value = entry
}

async function doDelete() {
  const target = deleteTarget.value
  if (!target) return
  deleteTarget.value = null
  try {
    if (isElectron) {
      const electronAPI = (window as any).electronAPI
      await electronAPI.deleteFilePath(target.path)
    } else {
      if (target.isDirectory) {
        await Filesystem.rmdir({
          path: target.path,
          directory: Directory.Data,
          recursive: true
        })
      } else {
        await Filesystem.deleteFile({
          path: target.path,
          directory: Directory.Data
        })
      }
    }
    logger.info('[文件管理器] 删除成功', { name: target.name })
    if (currentDir.value !== 'root') {
      await loadDir(currentDir.value)
    } else {
      await showRoots()
    }
  } catch (e: any) {
    logger.error('[文件管理器] 删除失败', { name: target.name, error: e })
    error.value = '删除失败: ' + (e.message || String(e))
  }
}

// ====== 自动清理日志 ======
async function runAutoClean() {
  if (!autoCleanEnabled.value) return
  try {
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - autoCleanDays.value)
    const thresholdStr = thresholdDate.toISOString().slice(0, 10)

    if (isElectron) {
      const electronAPI = (window as any).electronAPI
      const logDirPath = await electronAPI.getLogDirPath()
      const items = await electronAPI.readDirectory(logDirPath)
      for (const item of items) {
        if (item.isDirectory) continue
        const m = item.name.match(/app-(\d{4}-\d{2}-\d{2})\.log/)
        if (m && m[1] < thresholdStr) {
          await electronAPI.deleteFilePath(item.path)
        }
      }
    } else {
      const result = await Filesystem.readdir({ path: 'logs', directory: Directory.Data })
      for (const item of result.files) {
        const m = item.name.match(/app-(\d{4}-\d{2}-\d{2})\.log/)
        if (m && m[1] < thresholdStr) {
          await Filesystem.deleteFile({ path: 'logs/' + item.name, directory: Directory.Data })
        }
      }
    }
    logger.info('[文件管理器] 自动清理日志完成', { threshold: thresholdStr })
  } catch (e: any) {
    logger.error('[文件管理器] 自动清理日志失败', { error: e })
  }
}

async function handleAutoCleanToggle(val: boolean) {
  try {
    await api.updateSettings({ autoClean: { enabled: val, days: autoCleanDays.value } } as any)
    if (val) {
      await runAutoClean()
    }
  } catch (e) {
    logger.error('[文件管理器] 保存自动清理设置失败', { error: e })
  }
}

async function handleAutoCleanDaysChange(val: number) {
  try {
    await api.updateSettings({ autoClean: { enabled: autoCleanEnabled.value, days: val } } as any)
  } catch (e) {
    logger.error('[文件管理器] 保存自动清理天数失败', { error: e })
  }
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.log-level-select-wrap')) {
    logLevelMenuVisible.value = false
  }
}

// ====== 模式切换 ======
function switchMode(newMode: 'browse' | 'export' | 'import' | 'clean-logs') {
  if (newMode === 'browse') {
    handleStopLanServer()
  }
  mode.value = newMode
}

// ====== 数据导出函数 ======
function onExportSelectAll(val: boolean) {
  if (val) {
    const allKeys: string[] = []
    MODULE_DEFS.forEach(g => g.children.forEach(c => allKeys.push(c.key)))
    exportSelected.value = allKeys
  } else {
    exportSelected.value = []
  }
}

function toggleExportGroup(key: string) {
  const idx = exportExpanded.value.indexOf(key)
  if (idx >= 0) {
    exportExpanded.value.splice(idx, 1)
  } else {
    exportExpanded.value.push(key)
  }
}

async function handleExportViaLan() {
  if (exportSelected.value.length === 0) return
  exportLoading.value = true
  try {
    const exportData: Record<string, any> = {}
    for (const group of MODULE_DEFS) {
      for (const child of group.children) {
        if (exportSelected.value.includes(child.key)) {
          for (const dataKey of child.dataKeys) {
            try {
              const result = await api.getData(dataKey)
              if (result.success && result.data !== null) {
                exportData[dataKey] = result.data
              }
            } catch (e) {
              logger.warn('[文件管理器] 读取数据失败: ' + dataKey, { error: e })
            }
          }
        }
      }
    }
    if (Object.keys(exportData).length === 0) {
      logger.error('[文件管理器] 没有可导出的数据')
      return
    }
    if (isElectron) {
      const result = await (window as any).electronAPI.startLanServer(exportData)
      lanServerInfo.value = result
      logger.info('[文件管理器] 局域网导出服务器已启动')
    } else {
      try {
        const result = await HttpServer.startServer({ data: JSON.stringify(exportData), port: 5789 })
        lanServerInfo.value = result
        logger.info('[文件管理器] 安卓端局域网导出服务器已启动')
      } catch (e: any) {
        logger.error('[文件管理器] 安卓端启动局域网服务器失败: ' + (e.message || e))
        alert('启动局域网服务器失败，请确保已重新打包 APK 并安装了最新版本。错误: ' + (e.message || e))
        return
      }
    }
    await generateQRCode()
  } catch (e: any) {
    logger.error('[文件管理器] 导出失败', { error: e })
  } finally {
    exportLoading.value = false
  }
}

function copyLanAddress() {
  if (!lanServerInfo.value) return
  const address = `${lanServerInfo.value.ip}:${lanServerInfo.value.port}`
  navigator.clipboard.writeText(address).catch(() => {})
}

async function handleStopLanServer() {
  if (isElectron) {
    try { await (window as any).electronAPI.stopLanServer() } catch {}
  } else {
    try { await HttpServer.stopServer() } catch {}
  }
  lanServerInfo.value = null
  qrCodeDataUrl.value = ''
}

// ====== 数据导入函数 ======
function onImportSelectAll(val: boolean) {
  if (val) {
    const allKeys: string[] = []
    MODULE_DEFS.forEach(g => g.children.forEach(c => {
      if (importAvailable.value[c.key]) {
        allKeys.push(c.key)
      }
    }))
    importSelected.value = allKeys
  } else {
    importSelected.value = []
  }
}

function toggleImportGroup(key: string) {
  const idx = importExpanded.value.indexOf(key)
  if (idx >= 0) {
    importExpanded.value.splice(idx, 1)
  } else {
    importExpanded.value.push(key)
  }
}

async function handleConnectLan() {
  const addr = lanTargetAddress.value.trim()
  if (!addr) return

  let ip = addr
  let port = '5789'
  if (addr.includes(':')) {
    const parts = addr.split(':')
    ip = parts[0]
    port = parts[1]
  }

  importConnecting.value = true
  importErrorMsg.value = ''
  try {
    const url = `http://${ip}:${port}/api/lan-export`
    let data: any
    if (!isElectron) {
      // Capacitor 模式: 使用原生 HTTP 插件绕过混合内容限制
      const res = await CapacitorHttp.get({ url })
      if (res.status !== 200) throw new Error('HTTP ' + res.status)
      data = res.data
    } else {
      const response = await fetch(url, { mode: 'cors' })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      data = await response.json()
    }
    importedData.value = data

    const available: Record<string, boolean> = {}
    MODULE_DEFS.forEach(g => {
      g.children.forEach(c => {
        available[c.key] = c.dataKeys.some((k: string) => data[k] !== undefined)
      })
    })
    importAvailable.value = available

    const allAvailable: string[] = []
    MODULE_DEFS.forEach(g => g.children.forEach(c => {
      if (available[c.key]) allAvailable.push(c.key)
    }))
    importSelected.value = allAvailable

    logger.info('[文件管理器] 局域网连接成功')
  } catch (e: any) {
    importErrorMsg.value = '连接失败: ' + (e.message || '未知错误')
    logger.error('[文件管理器] 连接失败', { error: e })
  } finally {
    importConnecting.value = false
  }
}

function handleResetImport() {
  importedData.value = null
  importSelected.value = []
  importAvailable.value = {}
  lanTargetAddress.value = ''
  importErrorMsg.value = ''
}

async function handleImportData() {
  if (!importedData.value || importSelected.value.length === 0) return
  importLoading.value = true
  try {
    for (const group of MODULE_DEFS) {
      for (const child of group.children) {
        if (importSelected.value.includes(child.key)) {
          for (const dataKey of child.dataKeys) {
            if (importedData.value[dataKey] !== undefined) {
              try {
                await api.setData(dataKey, importedData.value[dataKey])
              } catch (e) {
                logger.warn('[文件管理器] 写入数据失败: ' + dataKey, { error: e })
              }
            }
          }
        }
      }
    }
    logger.info('[文件管理器] 数据导入完成')
    handleResetImport()
    // 重启软件使导入数据生效
    if (isElectron) {
      (window as any).electronAPI.restartApp()
    } else {
      window.location.reload()
    }
  } catch (e: any) {
    logger.error('[文件管理器] 导入失败', { error: e })
  } finally {
    importLoading.value = false
  }
}

// ====== QR 码生成 ======
async function generateQRCode() {
  if (!lanServerInfo.value) return
  const url = `http://${lanServerInfo.value.ip}:${lanServerInfo.value.port}`
  try {
    qrCodeDataUrl.value = await QRCode.toDataURL(url, { width: 200, margin: 2, color: { dark: '#ffffff', light: '#1a1a2e' } })
  } catch (e) {
    logger.error('[文件管理器] 生成二维码失败', { error: e })
  }
}

// ====== QR 码扫描 ======
const scannerVideo = ref<HTMLVideoElement | null>(null)
const scannerCanvas = ref<HTMLCanvasElement | null>(null)
let scanTimer: ReturnType<typeof setInterval> | null = null
let mediaStream: MediaStream | null = null

async function openQRScanner() {
  showQRScanner.value = true
  await nextTick()
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { min: 360 }, height: { min: 360 } }
    })
    const video = scannerVideo.value
    if (video) {
      video.srcObject = mediaStream
      await video.play()
      startScanLoop()
    }
  } catch (e: any) {
    logger.error('[文件管理器] 启动扫码失败', { error: e })
    alert('无法启动摄像头，请确保已授予相机权限')
    closeQRScanner()
  }
}

function startScanLoop() {
  const video = scannerVideo.value
  const canvas = scannerCanvas.value
  if (!video || !canvas) return

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  const scan = () => {
    if (!showQRScanner.value) return
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        onQRCodeScanned(code.data)
        return
      }
    }
    scanTimer = setTimeout(scan, 200)
  }
  scanTimer = setTimeout(scan, 200)
}

function closeQRScanner() {
  if (scanTimer) {
    clearTimeout(scanTimer)
    scanTimer = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop())
    mediaStream = null
  }
  showQRScanner.value = false
}

function onQRCodeScanned(decodedText: string) {
  closeQRScanner()
  try {
    const url = new URL(decodedText)
    lanTargetAddress.value = url.host
  } catch {
    lanTargetAddress.value = decodedText
  }
  handleConnectLan()
}

onMounted(async () => {
  logger.info('[文件管理器] 已打开')
  await showRoots()
  document.addEventListener('click', handleClickOutside)
  // 读取已在登录后加载的自动清理日志设置
  const stored = (settingsStore.settings as any)?.autoClean
  if (stored) {
    autoCleanEnabled.value = stored.enabled ?? false
    autoCleanDays.value = stored.days ?? 30
  }
})

onUnmounted(() => {
  if (logRefreshTimer) {
    clearInterval(logRefreshTimer)
    logRefreshTimer = null
  }
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.file-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: #ddd;
}

.fm-auto-clean-bar {
  padding: 6px 0 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fm-auto-clean-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fm-auto-clean-label {
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
}

.fm-auto-clean-days {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.fm-header {
  padding: 8px 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.fm-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
}

.fm-breadcrumb-item {
  color: var(--chalk-primary);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}

.fm-breadcrumb-item:hover {
  background: rgba(102, 126, 234, 0.15);
}

.fm-sep {
  color: var(--chalk-dim);
  font-size: 12px;
}

.fm-loading,
.fm-error,
.fm-empty {
  text-align: center;
  padding: 32px 0;
  color: var(--chalk-dim);
}

.fm-error {
  color: var(--chalk-red);
}

.fm-body {
  flex: 1;
  overflow-y: auto;
  padding-top: 8px;
}

.fm-body::-webkit-scrollbar {
  width: 6px;
}

.fm-body::-webkit-scrollbar-track {
  background: transparent;
}

.fm-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.fm-list {
  display: flex;
  flex-direction: column;
}

.fm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.fm-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.fm-item-dir {
  font-weight: 500;
}

.fm-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.fm-name {
  flex: 1;
  color: var(--chalk-white);
  word-break: break-all;
}

.fm-size {
  color: var(--chalk-dim);
  font-size: 12px;
  flex-shrink: 0;
  min-width: 60px;
  text-align: right;
}

.fm-actions {
  flex-shrink: 0;
}

.fm-action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s;
  line-height: 1;
}

.fm-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Overlay */
.fm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Preview Dialog */
.fm-preview-dialog {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  width: 80%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fm-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.fm-preview-name {
  color: var(--chalk-white);
  font-size: 14px;
  font-weight: 600;
}

.fm-preview-close {
  background: transparent;
  border: none;
  color: var(--chalk-dim);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.fm-preview-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.fm-preview-content {
  padding: 16px 18px;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #ccc;
  max-height: 60vh;
  margin: 0;
}

.fm-preview-content::-webkit-scrollbar {
  width: 6px;
}

.fm-preview-content::-webkit-scrollbar-track {
  background: transparent;
}

.fm-preview-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* Confirm Dialog */
.fm-confirm-dialog {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  width: 360px;
  padding: 24px;
}

.fm-confirm-title {
  color: var(--chalk-white);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 12px;
}

.fm-confirm-msg {
  color: var(--chalk-white-70);
  font-size: 13px;
  text-align: center;
  margin-bottom: 20px;
  line-height: 1.5;
}

.fm-confirm-msg strong {
  color: var(--chalk-white);
}

.fm-confirm-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.fm-btn-cancel,
.fm-btn-confirm {
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.fm-btn-cancel {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

.fm-btn-cancel:hover {
  background: rgba(255, 255, 255, 0.12);
}

.fm-btn-confirm {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.fm-btn-confirm:hover {
  background: rgba(239, 68, 68, 0.3);
}

/* ====== 日志查看器样式 ====== */
.log-viewer {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.log-toolbar {
  display: flex;
  gap: 8px;
  padding: 12px 0;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.log-filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.log-filter-input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ddd;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  width: 160px;
  outline: none;
}

.log-filter-input:focus {
  border-color: rgba(102, 126, 234, 0.5);
}

.log-filter-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.log-level-select-wrap {
  position: relative;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  font-size: 12px;
  background: transparent;
  color: var(--chalk-dim);
}

.log-level-arrow {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
}

.log-level-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: rgba(30, 30, 50, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  min-width: 100%;
  z-index: 1000;
  overflow: hidden;
  white-space: nowrap;
}

.log-level-option {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  color: #ddd;
  transition: background 0.15s;
}

.log-level-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.log-level-option.active {
  background: rgba(102, 126, 234, 0.3);
  color: #fff;
}

.log-clear-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ddd;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.log-clear-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 12px;
  line-height: 1.8;
}

.log-container::-webkit-scrollbar {
  width: 6px;
}

.log-container::-webkit-scrollbar-track {
  background: transparent;
}

.log-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.log-empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.35);
  padding: 40px 0;
  font-size: 14px;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
}

.log-line :deep(.log-time) { color: #88c0d0; }
.log-line :deep(.log-level-debug) { color: #5e81ac; }
.log-line :deep(.log-level-info) { color: #a3be8c; }
.log-line :deep(.log-level-warn) { color: #ebcb8b; }
.log-line :deep(.log-level-error) { color: #bf616a; }
.log-line :deep(.log-content) { color: #d8dee9; }
.log-line :deep(.jk) { color: #9cdcfe; font-weight: bold; }
.log-line :deep(.js) { color: #ce9178; }
.log-line :deep(.jn) { color: #b5cea8; }
.log-line :deep(.jb) { color: #569cd6; font-weight: bold; }
.log-line :deep(.jnl) { color: #569cd6; font-weight: bold; }
.log-line :deep(.jp) { color: #808080; }

/* ====== 模式切换栏 ====== */
.fm-mode-bar {
  display: flex;
  gap: 8px;
  padding: 0 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.fm-mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.fm-mode-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.fm-mode-btn.active {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.4);
  color: var(--chalk-primary);
}

.fm-mode-icon {
  font-size: 16px;
  line-height: 1;
}

@media (max-width: 540px) {
  .fm-mode-btn {
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px;
    font-size: 11px;
  }
  .fm-mode-icon {
    font-size: 18px;
  }
}

/* ====== 导入/导出通用样式 ====== */
.tool-container {
  padding: 16px 0;
  flex: 1;
  overflow-y: auto;
}

.tool-container::-webkit-scrollbar {
  width: 6px;
}

.tool-container::-webkit-scrollbar-track {
  background: transparent;
}

.tool-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.tool-desc {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin: 0 0 16px;
  line-height: 1.5;
}

/* ====== 目录树 ====== */
.module-tree {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 8px 0;
  margin-bottom: 16px;
}

.select-all-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 4px;
}

.module-group {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.module-group:last-child {
  border-bottom: none;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 500;
}

.group-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.expand-icon {
  width: 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  flex-shrink: 0;
}

.group-label {
  flex: 1;
}

.group-children {
  padding: 2px 0 6px 36px;
}

.child-item {
  padding: 4px 0;
  font-size: 13px;
}

/* ====== 操作按钮区 ====== */
.tool-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}

.tool-footer-center {
  justify-content: center;
}

/* ====== 局域网传输就绪弹窗 ====== */
.lan-dialog {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 32px 28px;
  max-width: 380px;
  width: 80%;
  text-align: center;
}

.lan-dialog-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.lan-dialog-title {
  color: var(--chalk-white);
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
}

.lan-dialog-desc {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin: 0 0 16px;
}

.lan-address-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 12px;
}

.lan-address-text {
  color: var(--chalk-primary);
  font-size: 18px;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
}

.lan-status-hint {
  color: rgba(255, 255, 255, 0.35);
  font-size: 12px;
  margin: 0 0 16px;
}

/* ====== 导出二维码 ====== */
.lan-qr-section {
  margin-bottom: 12px;
}

.lan-qr-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.lan-qr-divider::before,
.lan-qr-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.lan-qr-divider span {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.lan-qr-hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin: 0 0 10px;
}

.lan-qr-image {
  display: block;
  width: 180px;
  height: 180px;
  margin: 0 auto;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

/* ====== QR 码扫描弹窗 ====== */
.qr-scanner-dialog {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 24px;
  max-width: 380px;
  width: 80%;
  text-align: center;
}

.qr-scanner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.qr-scanner-title {
  color: var(--chalk-white);
  font-size: 16px;
  font-weight: 600;
}

.qr-scanner-container {
  position: relative;
  width: 100%;
  max-width: 300px;
  margin: 0 auto 12px;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.qr-scanner-video {
  display: block;
  width: 100%;
  height: auto;
}

.qr-scanner-canvas {
  display: none;
}

.qr-scanner-hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin: 0 0 16px;
}

/* ====== 局域网连接区（导入） ====== */
.lan-connect-area {
  padding: 24px 0;
}

.lan-connect-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lan-connect-btn-row {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

.lan-or-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

.lan-or-divider::before,
.lan-or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.lan-or-divider span {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  flex-shrink: 0;
}

.lan-scan-btn-row {
  display: flex;
  justify-content: center;
}

.lan-connect-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  flex-shrink: 0;
}

.lan-ip-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ddd;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  outline: none;
  transition: border-color 0.2s;
}

.lan-ip-input:focus {
  border-color: rgba(102, 126, 234, 0.5);
}

.lan-ip-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.lan-error-msg {
  color: #f56c6c;
  font-size: 13px;
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(245, 108, 108, 0.08);
  border-radius: 6px;
  word-break: break-all;
}

/* 覆盖 el-checkbox 样式 */
:deep(.el-checkbox__label) {
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
}

:deep(.el-checkbox.is-checked .el-checkbox__label) {
  color: var(--chalk-primary);
}

:deep(.el-checkbox.is-disabled .el-checkbox__label) {
  color: rgba(255, 255, 255, 0.3);
}

/* ====== 清理日志模式 ====== */
.clean-logs-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 16px;
}

.clean-logs-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.clean-logs-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.clean-logs-days {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

/* ====== 隐藏所有滚动条 ====== */
.fm-body::-webkit-scrollbar,
.tool-container::-webkit-scrollbar,
.fm-preview-content::-webkit-scrollbar,
.log-container::-webkit-scrollbar {
  display: none;
}

.fm-body,
.tool-container,
.fm-preview-content,
.log-container {
  scrollbar-width: none;
}
</style>