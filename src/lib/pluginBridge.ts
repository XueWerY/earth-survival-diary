/**
 * 插件运行时桥（生产环境）
 *
 * 运行时打包的插件工具（electron/build-plugin.cjs 产物）不自带共享依赖，
 * 而是通过 window.__ESD_BRIDGE__ 引用主应用的模块实例，
 * 保证插件与主应用共用同一个 Vue/Pinia/Element Plus 实例。
 *
 * 桥接键与 build-plugin.cjs 中的 BARE_BRIDGE / SRC_BRIDGE 白名单一一对应，
 * 新增可桥接模块时需两端同步登记。
 */
import * as Vue from 'vue'
import * as Pinia from 'pinia'
import * as ElementPlus from 'element-plus'
import * as IconsVue from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import * as CapacitorCore from '@capacitor/core'
import * as CapacitorFilesystem from '@capacitor/filesystem'
import { logger } from './logger'
import * as api from './api'
import * as storageService from '../services/storageService'
import { useSettingsStore } from '../stores/settingsStore'
import { useFocusStore } from '../stores/focusStore'
import { useListStore } from '../stores/listStore'
import BaseDialog from '../components/ui/BaseDialog.vue'
import ConfirmDialog from '../components/common/overlay/ConfirmDialog.vue'

;(window as any).__ESD_BRIDGE__ = {
  // npm 依赖
  vue: Vue,
  pinia: Pinia,
  'element-plus': ElementPlus,
  '@element-plus/icons-vue': IconsVue,
  dayjs,
  qrcode: QRCode,
  jsqr: jsQR,
  '@capacitor/core': CapacitorCore,
  '@capacitor/filesystem': CapacitorFilesystem,
  // 应用内部模块（键 = 相对 src/ 的路径）
  'lib/logger': { logger },
  'lib/api': api,
  'services/storageService': storageService,
  'stores/settingsStore': { useSettingsStore },
  'stores/focusStore': { useFocusStore },
  'stores/listStore': { useListStore },
  'components/common/BaseDialog.vue': BaseDialog,
  'components/common/overlay/ConfirmDialog.vue': ConfirmDialog,
}
