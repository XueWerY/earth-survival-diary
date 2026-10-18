<template>
  <div class="editor-wrap" @contextmenu.prevent>
    <!-- 主容器 -->
    <div class="editor-main">

      <!-- 顶部多分页菜单栏：文件 / 样式 / 插入 / 视图 -->
      <div class="editor-menubar">
        <div class="editor-menubar-tabs" role="tablist">
          <button
            v-for="tab in visibleMenubarTabs"
            :key="tab.key"
            type="button"
            class="editor-menubar-tab"
            :class="{ on: menubarTab === tab.key }"
            role="tab"
            :aria-selected="menubarTab === tab.key"
            @click="menubarTab = tab.key"
          >{{ tab.label }}</button>
        </div>

        <!-- 文件页 -->
        <div v-if="menubarTab === 'file'" class="editor-menubar-page">
          <button
            type="button"
            class="menubar-btn"
            :class="{ on: searchBarVisible }"
            :title="withShortcut(searchBarVisible ? '关闭编辑器内搜索 (Esc)' : '编辑器内搜索', 'search')"
            @click="toggleSearchBar"
          >
            <el-icon><Search /></el-icon><span>搜索</span>
          </button>
          <button
            type="button"
            class="menubar-btn"
            :class="{ on: replaceVisible }"
            :title="withShortcut('替换文本（在搜索栏里展开替换行）', 'replace')"
            @click="toggleReplaceBar"
          >
            <el-icon><Replace /></el-icon><span>替换</span>
          </button>
          <span class="menubar-sep"></span>
          <button type="button" class="menubar-btn" title="导出当前笔记为 Markdown" @click="forwardExportCommand('md')">
            <el-icon><FileDown /></el-icon><span>导出 Markdown</span>
          </button>
          <button type="button" class="menubar-btn" title="导出为自包含 HTML（只读预览，样式与公式离线可见）" @click="forwardExportCommand('html')">
            <el-icon><FileCode2 /></el-icon><span>导出 HTML</span>
          </button>
          <span class="menubar-sep"></span>
          <button type="button" class="menubar-btn" :class="{ on: note?.pinned }" :title="note?.pinned ? '取消收藏' : '收藏'" @click="emit('togglePin')">
            <el-icon><Star :fill="note?.pinned ? 'currentColor' : 'none'" /></el-icon><span>收藏</span>
          </button>
        </div>

        <!-- 样式页 -->
        <div v-else-if="menubarTab === 'style'" class="editor-menubar-page">
          <!--
            标题内禁止叠加行内样式（用户要求「标题不能改样式」）。
            H1～H6 的外观只由级别决定；若允许再加粗/上色，层级视觉会互相干扰。
            下面这些行内样式按钮在光标位于标题内时统一禁用（禁用而非隐藏：
            保留位置，用户能看出「此处不可用」，并附提示说明原因）。
          -->
          <button type="button" class="menubar-btn" :class="{ on: activeFormats.bold }" :disabled="inHeadingNow" :title="withShortcut(inHeadingNow ? '标题内不能加粗（标题样式由级别决定）' : '加粗', 'bold')" @mousedown.prevent @click="menubarFormat('bold')"><strong>B</strong><span>加粗</span></button>
          <button type="button" class="menubar-btn" :class="{ on: activeFormats.italic }" :disabled="inHeadingNow" :title="withShortcut(inHeadingNow ? '标题内不能设置斜体（标题样式由级别决定）' : '斜体', 'italic')" @mousedown.prevent @click="menubarFormat('italic')"><em>I</em><span>斜体</span></button>
          <button type="button" class="menubar-btn" :class="{ on: activeFormats.underline }" :disabled="inHeadingNow" :title="withShortcut(inHeadingNow ? '标题内不能设置下划线（标题样式由级别决定）' : '下划线', 'underline')" @mousedown.prevent @click="menubarFormat('underline')"><u>U</u><span>下划线</span></button>
          <button type="button" class="menubar-btn" :class="{ on: activeFormats.superscript }" :disabled="inHeadingNow" :title="withShortcut(inHeadingNow ? '标题内不能设置上标（标题样式由级别决定）' : '上标', 'superscript')" @mousedown.prevent @click="menubarFormat('superscript')"><span class="format-symbol">x²</span><span>上标</span></button>
          <button type="button" class="menubar-btn" :class="{ on: activeFormats.subscript }" :disabled="inHeadingNow" :title="withShortcut(inHeadingNow ? '标题内不能设置下标（标题样式由级别决定）' : '下标', 'subscript')" @mousedown.prevent @click="menubarFormat('subscript')"><span class="format-symbol">x₂</span><span>下标</span></button>
          <button type="button" class="menubar-btn" :class="{ on: activeFormats.strike }" :disabled="inHeadingNow" :title="withShortcut(inHeadingNow ? '标题内不能设置删除线（标题样式由级别决定）' : '删除线', 'strike')" @mousedown.prevent @click="menubarFormat('strike')"><del>S</del><span>删除线</span></button>
          <button type="button" class="menubar-btn" :class="{ on: activeFormats.quote }" :disabled="inHeadingNow" :title="withShortcut(inHeadingNow ? '标题内不能转为引用（标题样式由级别决定）' : (inQuoteNow ? '取消引用' : '引用'), 'quote')" @mousedown.prevent @click="menubarFormat('quote')"><span class="format-symbol">{{ inQuoteNow ? '❞' : '❝' }}</span><span>{{ inQuoteNow ? '取消引用' : '引用' }}</span></button>
          <span class="menubar-sep"></span>
          <button type="button" class="menubar-btn" :class="{ on: activeFormats.bullet }" :disabled="inHeadingNow" :title="withShortcut(inHeadingNow ? '标题内不能转为列表（标题样式由级别决定）' : '无序列表', 'unordered')" @mousedown.prevent @click="menubarFormat('unordered')"><span class="format-symbol">☷</span><span>无序</span></button>
          <button type="button" class="menubar-btn" :class="{ on: activeFormats.ordered }" :disabled="inHeadingNow" :title="withShortcut(inHeadingNow ? '标题内不能转为列表（标题样式由级别决定）' : '有序列表', 'ordered')" @mousedown.prevent @click="menubarFormat('ordered')"><span class="format-symbol">1.</span><span>有序</span></button>
          <span class="menubar-sep"></span>
          <button
            v-for="level in [1, 2, 3, 4, 5, 6]"
            :key="'h' + level"
            type="button"
            class="menubar-btn menubar-heading"
            :class="['mh-' + level, { on: activeFormats.heading === level }]"
            :title="withShortcut(`标题 H${level}`, 'h' + level)"
            @mousedown.prevent @click="menubarHeading(level)"
          >H{{ level }}</button>
          <button type="button" class="menubar-btn" :class="{ on: !activeFormats.heading }" :title="withShortcut('正文', 'body')" @mousedown.prevent @click="menubarHeading(0)"><span>正文</span></button>
          <span class="menubar-sep"></span>

          <!-- 高亮：色块单击立即应用（同色再点则清除），文字+箭头打开颜色面板 -->
          <div class="menubar-split">
            <button
              type="button"
              class="menubar-swatch-btn"
              :class="{ on: activeFormats.highlight }"
              :disabled="inHeadingNow"
              :title="withShortcut(inHeadingNow ? '标题内不能设置高亮（标题样式由级别决定）' : '点击应用高亮（再次点击取消）', 'highlight')"
              @mousedown.prevent
              @click="applyQuickHighlight"
            >
              <span class="menubar-swatch" :style="{ background: activeHighlightColor || DEFAULT_HIGHLIGHT_COLOR }"></span>
            </button>
            <el-dropdown trigger="click" placement="bottom-start" @command="onHighlightCommand">
              <button type="button" class="menubar-btn menubar-dropdown" :class="{ on: activeFormats.highlight }" title="高亮颜色">
                <span>高亮</span>
                <span class="menubar-caret">▾</span>
              </button>
              <template #dropdown>
                <div class="menubar-color-panel">
                  <div class="menubar-color-title">高亮颜色</div>
                  <button
                    v-for="c in HIGHLIGHT_COLORS"
                    :key="'hl' + c.value"
                    type="button"
                    class="menubar-color-item"
                    @click="menubarHighlight(c.value)"
                  >
                    <span class="menubar-color-dot" :style="{ background: c.value }"></span>
                    <span>{{ c.name }}</span>
                  </button>
                </div>
              </template>
            </el-dropdown>
          </div>

          <!-- 文字颜色：同上，色块单击即应用 -->
          <div class="menubar-split">
            <button
              type="button"
              class="menubar-swatch-btn"
              :class="{ on: activeFormats.textColor }"
              :disabled="inHeadingNow"
              :title="inHeadingNow ? '标题内不能设置文字颜色（标题样式由级别决定）' : '点击应用文字颜色（再次点击取消）'"
              @mousedown.prevent
              @click="applyQuickTextColor"
            >
              <span class="menubar-swatch" :style="{ background: activeTextColor || DEFAULT_TEXT_COLOR }"></span>
            </button>
            <el-dropdown trigger="click" placement="bottom-start" @command="onTextColorCommand">
              <button type="button" class="menubar-btn menubar-dropdown" :class="{ on: activeFormats.textColor }" title="文字颜色">
                <span>文字颜色</span>
                <span class="menubar-caret">▾</span>
              </button>
              <template #dropdown>
                <div class="menubar-color-panel">
                  <div class="menubar-color-title">文字颜色</div>
                  <button
                    v-for="c in TEXT_COLORS"
                    :key="'tc' + c.value"
                    type="button"
                    class="menubar-color-item"
                    @click="menubarTextColor(c.value)"
                  >
                    <span class="menubar-color-dot" :style="{ background: c.value }"></span>
                    <span>{{ c.name }}</span>
                  </button>
                </div>
              </template>
            </el-dropdown>
          </div>

          <!-- 「清除格式」按钮已按用户要求删除（用户认为用不到；可用 Ctrl+Z 撤销或手动改回） -->
        </div>

        <!-- 插入页 -->
        <div v-else-if="menubarTab === 'insert'" class="editor-menubar-page">
          <button type="button" class="menubar-btn" title="插入图片" @click="chooseMediaInsert('image')">
            <el-icon><ImagePlus /></el-icon><span>图片</span>
          </button>
          <button type="button" class="menubar-btn" title="插入视频" @click="chooseMediaInsert('video')">
            <el-icon><Clapperboard /></el-icon><span>视频</span>
          </button>
          <button type="button" class="menubar-btn" title="插入音频" @click="chooseMediaInsert('audio')">
            <el-icon><Music /></el-icon><span>音频</span>
          </button>
          <button type="button" class="menubar-btn" :title="withShortcut('插入链接（弹窗输入地址）', 'link')" @mousedown.prevent @click="openInsertDialog('link')">
            <el-icon><Link2 /></el-icon><span>链接</span>
          </button>
          <span class="menubar-sep"></span>
          <button type="button" class="menubar-btn" :title="withShortcut('插入行内代码（嵌在文字中，弹窗输入）', 'code')" @mousedown.prevent @click="openInsertDialog('inline-code')">
            <code class="menubar-code-symbol">&lt;/&gt;</code><span>行内代码</span>
          </button>
          <button type="button" class="menubar-btn" title="插入块级代码（独占一块，弹窗选语言并做语法审查）" @mousedown.prevent @click="openInsertDialog('block-code')">
            <span class="menubar-formula-block">{ }</span><span>块级代码</span>
          </button>
        </div>

        <!-- 视图页 -->
        <div v-else-if="menubarTab === 'view'" class="editor-menubar-page">
          <button type="button" class="menubar-btn" :class="{ on: sourceMode }" :title="withShortcut(sourceMode ? '切换到所见即所得' : '切换到 Markdown 源码', 'toggleSource')" @click="emit('toggleSourceMode')">
            <el-icon><Code v-if="!sourceMode" /><PenLine v-else /></el-icon><span>{{ sourceMode ? '富文本' : '源码' }}</span>
          </button>
          <button type="button" class="menubar-btn" :class="{ on: outlineHoverOpen }" :title="withShortcut('大纲（编辑区左上角悬浮）', 'outline')" @click="toggleOutlinePanel">
            <el-icon><ListTree /></el-icon><span>大纲</span>
          </button>
          <span class="menubar-sep"></span>
          <button type="button" class="menubar-btn" :class="{ on: fullscreenEdit }" :title="withShortcut(fullscreenEdit ? '退出全屏编辑' : '全屏编辑', 'fullscreen')" @click="emit('toggleFullscreenEdit')">
            <el-icon><Minimize2 v-if="fullscreenEdit" /><Maximize2 v-else /></el-icon><span>{{ fullscreenEdit ? '退出全屏' : '全屏编辑' }}</span>
          </button>
        </div>

        <!-- 帮助分页 -->
        <div v-else-if="menubarTab === 'help'" class="editor-menubar-page">
          <button type="button" class="menubar-btn" title="查看并自定义所有快捷键（支持冲突检测与录制）" @click="shortcutDialogVisible = true">
            <el-icon><Keyboard /></el-icon><span>快捷键</span>
          </button>
          <span class="menubar-sep"></span>
          <span class="menubar-hint">点「快捷键」可录制新组合，并查看冲突与系统保留键</span>
        </div>
      </div>
      <!-- 主内容区 -->
      <div class="editor-content-area" @paste.capture="preventMediaPaste" @drop.capture="preventMediaDrop">
        <div class="editor-viewport">
          <!-- 大纲悬浮：悬停按钮 → 按钮隐藏、面板接替其位置；移出后才收起 -->
          <div
            class="outline-float"
            :class="{ open: outlineHoverOpen }"
            @mouseenter="onOutlinePointerEnter"
            @mouseleave="onOutlinePointerLeave"
          >
            <button type="button" class="outline-float-btn" title="大纲" @click="toggleOutlinePanel">
              <el-icon><ListTree /></el-icon>
            </button>
            <div v-if="outlineHoverOpen" class="outline-float-panel">
              <div class="outline-float-head">大纲</div>
              <ul v-if="outline.length > 0" class="outline-float-list">
                <li
                  v-for="(item, idx) in outline"
                  :key="idx"
                  :class="['ofl-' + item.level]"
                >
                  <a @click="scrollToHeading(item); outlineHoverOpen = false" :title="item.text">
                    <span class="outline-float-text">{{ item.text || '未命名' }}</span>
                  </a>
                </li>
              </ul>
              <div v-else class="outline-float-empty">输入标题以生成大纲</div>
            </div>
          </div>
          <MilkdownEditor
            v-if="!sourceMode"
            ref="mdEditorRef"
            v-model="editorContent"
            :current-note-id="note?.id ?? ''"
            :temp-note-id="props.tempNoteId"
            placeholder="开始编写 Markdown 笔记...（输入 [[ 链接其他笔记）"
            @input="refreshOutline"
            @open-wiki-link="(p) => emit('openWikiLink', p)"
          />
          <div v-else class="source-wrap">
            <!-- 隐形镜像：与 textarea 同宽/同字体/同换行规则，用于量出每个逻辑行的
                 实际渲染高度（软换行后一行可能占多屏行），行号列据此逐行等高对齐。 -->
            <div ref="sourceMirrorRef" class="source-mirror" aria-hidden="true">
              <span
                v-for="(line, i) in sourceLines"
                :key="'m' + i"
                class="source-mirror-line"
              >{{ line.length ? line : '\u200b' }}</span>
            </div>
            <!-- 行号列：每行高度取镜像实测值，随 textarea 滚动同步 -->
            <div ref="sourceGutterRef" class="source-gutter" aria-hidden="true">
              <span
                v-for="(_, i) in sourceLines"
                :key="i"
                class="source-gutter-num"
                :style="{ height: (sourceLineHeights[i] || 22) + 'px' }"
                :class="{ active: i === sourceCaretLine }"
              >{{ i + 1 }}</span>
            </div>
            <textarea
              ref="sourceEditorRef"
              v-model="editorContent"
              class="editor-source"
              spellcheck="false"
              placeholder="Markdown 源码"
              @input="refreshOutline"
              @keydown="onSourceKeydown"
              @scroll="syncSourceGutter"
              @click="updateSourceCaretLine"
              @keyup="updateSourceCaretLine"
            ></textarea>
          </div>

          <!-- 编辑器内搜索浮层：右上角，不撑开布局 -->
          <div v-if="searchBarVisible" class="editor-search-bar" @mousedown.stop @keydown.stop>
            <div class="editor-search-input-wrap" :class="{ 'is-error': searchRegexError }">
              <el-icon class="editor-search-icon"><Search /></el-icon>
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                class="editor-search-input"
                placeholder="在当前笔记中搜索…"
                spellcheck="false"
                @input="onSearchInput"
                @keydown="onSearchKeydown"
              >
            </div>
            <button
              type="button"
              class="editor-search-chip"
              :class="{ on: searchCaseSensitive }"
              title="大小写敏感"
              @click="toggleCaseSensitive"
            >Aa</button>
            <button
              type="button"
              class="editor-search-chip"
              :class="{ on: searchRegex }"
              title="正则表达式"
              @click="toggleRegex"
            >.*</button>
            <span class="editor-search-count" :class="{ 'is-empty': searchTotal > 0 && searchActiveIndex < 0 }">
              {{ searchCountText }}
            </span>
            <div class="editor-search-nav">
              <button type="button" class="editor-search-step" title="上一处 (Shift+Enter)" :disabled="!searchTotal" @click="stepSearch(-1)">
                <el-icon><ArrowUp /></el-icon>
              </button>
              <button type="button" class="editor-search-step" title="下一处 (Enter)" :disabled="!searchTotal" @click="stepSearch(1)">
                <el-icon><ArrowDown /></el-icon>
              </button>
            </div>
            <button type="button" class="editor-search-close" title="关闭 (Esc)" @click="closeSearchBar">
              <el-icon><X /></el-icon>
            </button>
            <p v-if="searchRegexError" class="editor-search-error">{{ searchRegexError }}</p>
            <p v-else-if="searchTruncated" class="editor-search-hint">匹配超过 {{ MAX_SEARCH_MATCHES }} 处，仅显示前 {{ MAX_SEARCH_MATCHES }} 处</p>

            <!-- 替换行：由「替换」按钮或 Ctrl+H 展开 -->
            <div v-if="replaceVisible" class="editor-replace-row">
              <input
                ref="replaceInputRef"
                v-model="replaceText"
                type="text"
                class="editor-search-input"
                placeholder="替换为…"
                spellcheck="false"
                @keydown.enter.prevent="replaceCurrent"
              >
              <button type="button" class="editor-replace-btn" :disabled="!searchTotal" title="替换当前一处" @click="replaceCurrent">替换</button>
              <button type="button" class="editor-replace-btn" :disabled="!searchTotal" title="替换全部匹配" @click="replaceAll">全部替换</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <input ref="imageFileInput" type="file" accept="image/*" hidden @change="onMediaFileSelected('image', $event)">
    <input ref="videoFileInput" type="file" accept="video/*" hidden @change="onMediaFileSelected('video', $event)">
    <input ref="audioFileInput" type="file" accept="audio/*" hidden @change="onMediaFileSelected('audio', $event)">

    <!-- 媒体插入确认（可选尺寸） -->
    <Teleport to="body">
      <div v-if="mediaSizeDialog.visible" class="note-media-size-backdrop" @mousedown.self="cancelMediaSize">
        <section class="note-media-size-dialog" @mousedown.stop>
          <header class="note-media-size-header">
            <span>插入{{ mediaKindLabels[mediaSizeDialog.kind] }}</span>
            <span class="note-media-size-meta">{{ mediaSizeDialog.fileName }}</span>
          </header>
          <div class="note-media-size-row">
            <label>宽度（px）</label>/label>
            <input v-model.number="mediaSizeDialog.width" type="number" min="0" max="4096" placeholder="默认" @keyup.enter="confirmMediaSize">
          </div>
          <div class="note-media-size-row">
            <label>高度（px）</label>/label>
            <input v-model.number="mediaSizeDialog.height" type="number" min="0" max="4096" placeholder="默认" @keyup.enter="confirmMediaSize">
          </div>
          <p class="note-media-size-hint">留空则按默认比例显示；只填一项时另一项按比例缩放。</p>
          <footer class="note-media-size-actions">
            <button type="button" class="capsule-btn" @click="cancelMediaSize">取消</button>
            <button type="button" class="capsule-btn capsule-btn-primary" @click="confirmMediaSize">插入</button>
          </footer>
        </section>
      </div>
    </Teleport>

    <!-- 插入对话框：链接 / 行内代码 / 块级代码（统一弹窗输入 + 格式审查，落在光标处） -->
    <NoteInsertDialog
      v-model:visible="insertDialogVisible"
      :kind="insertDialogKind"
      :initial-link-text="insertLinkInitialText"
      :has-selection="insertLinkHasSelection"
      :anchors="insertLinkAnchors"
      :note-options="insertLinkNoteOptions"
      @confirm-inline-code="onInsertInlineCodeConfirm"
      @confirm-block-code="onInsertBlockCodeConfirm"
      @confirm-link="onInsertLinkConfirm"
    />

    <!-- 快捷键设置：录制绑定 + 冲突检测 + 恢复默认 -->
    <ShortcutSettingsDialog v-model:visible="shortcutDialogVisible" :blocked-reason="blockedShortcutReason" />


    <!-- 底部状态栏 -->
    <div class="editor-status-bar">
      <div class="editor-status-left">
        <span>全文字数: {{ totalWordCount }}</span>
        <span class="editor-status-sep">|</span>
        <span>创建于 {{ formatTime(note?.createdAt) }}</span>
        <span class="editor-status-sep">|</span>
        <span>更新于 {{ formatTime(note?.updatedAt) }}</span>
      </div>
      <div class="editor-status-right">
        <span v-if="savedAtText" class="editor-autosave">已自动保存 {{ savedAtText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, watch as watchNoteTitleFallback } from 'vue'
import { Code, Link2, ListTree, Maximize2, Minimize2, PenLine, Star, Search, ArrowUp, ArrowDown, X, FileDown, FileCode2, ImagePlus, Clapperboard, Music, Keyboard, Replace } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import type { Note, MdOutlineItem } from '../../stores/noteStore'
import { extractMdOutline, getMdPlainText } from '../../stores/noteStore'
import MilkdownEditor from '../editor/MilkdownEditor.vue'
import { logger } from '../../lib/logger'
import {
  buildMediaSnippet,
  containsInlineMedia,
  describeMedia,
  mediaKindLabels,
  readFileAsDataUrl,
  storeMediaAsset,
  type MediaKind,
} from '../../composables/useNoteMedia'
import { findMatches, nextMatchIndex, MAX_MATCHES } from '../../composables/useNoteSearch'
import { useTempNoteStore } from '../../stores/tempNoteStore'
import NoteInsertDialog, { type InsertKind } from './NoteInsertDialog.vue'
import ShortcutSettingsDialog from './ShortcutSettingsDialog.vue'
import { collectMarkdownAnchors } from '../editor/blockAnchors'
import {
  comboFor,
  comboFromEvent,
  dispatch,
  formatCombo,
  registerRunner,
  registerProbe,
  traceKey,
  unregisterRunner,
  load as loadShortcuts,
} from '../../stores/shortcutStore'

const props = withDefaults(defineProps<{
  note: Note | null
  sourceMode?: boolean
  fullscreenEdit?: boolean
  /** 临时笔记：被原地编辑的 .md 文件绝对路径（为空表示普通笔记） */
  tempFilePath?: string
  /** 临时笔记 id：媒体插入/渲染时用于定位同级 media 目录 */
  tempNoteId?: string
  /** 可跳转的其它笔记标题（用于「链接到其它笔记」） */
  noteTitles?: string[]
}>(), {
  sourceMode: false,
  fullscreenEdit: false,
  tempFilePath: '',
  tempNoteId: '',
  noteTitles: () => []
})

const tempNoteStore = useTempNoteStore()

const emit = defineEmits<{
  (e: 'save', data: { id: string; title: string; content: string; pinned: boolean }): void
  (e: 'togglePin'): void
  (e: 'toggleFullscreenEdit'): void
  (e: 'toggleSourceMode'): void
  (e: 'export', command: string | number | object): void
  (e: 'openWikiLink', payload: { target: string }): void
}>()

const noteTitle = ref('')
const editorContent = ref('')
const mdEditorRef = ref<InstanceType<typeof MilkdownEditor> | null>(null)
const sourceEditorRef = ref<HTMLTextAreaElement | null>(null)
const imageFileInput = ref<HTMLInputElement | null>(null)
const videoFileInput = ref<HTMLInputElement | null>(null)
const audioFileInput = ref<HTMLInputElement | null>(null)
const selectionContextMenu = ref({ visible: false, text: '', x: 0, y: 0 })
/** 打开菜单时检测选区是否已在引用内（菜单项据此显示「引用/取消引用」） */
const selectionInQuote = ref(false)
const mediaContextMenu = ref({ visible: false, x: 0, y: 0 })
// 媒体插入确认面板：选择文件后先问尺寸，再落到光标处
const mediaSizeDialog = ref({
  visible: false,
  kind: 'image' as MediaKind,
  fileName: '',
  dataUrl: '',
  width: null as number | null,
  height: null as number | null,
})
type ActiveTextSelection =
  | { kind: 'source'; element: HTMLTextAreaElement; start: number; end: number }
  | { kind: 'visual'; element: HTMLElement; range: Range; from?: number; to?: number }
type MediaInsertionSelection =
  | { kind: 'source'; start: number; end: number }
  | { kind: 'visual'; from: number; to: number }
let activeTextSelection: ActiveTextSelection | null = null
let mediaInsertionSelection: MediaInsertionSelection | null = null
const headingOptionsOpen = ref(false)
let lastNoteId: string | null = null

const closeSelectionContextMenu = () => {
  selectionContextMenu.value.visible = false
  headingOptionsOpen.value = false
}

const closeMediaContextMenu = () => {
  mediaContextMenu.value.visible = false
}

/**
 * 捕获编辑器当前选区（原右键菜单入口，现由菜单栏样式按钮经
 * ensureSelectionForFormat 间接触发，也在 selectionchange 时更新）。
 */
const openSelectionContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  const target = event.target
  const textarea = target instanceof HTMLTextAreaElement ? target : null
  const editor = target instanceof Element ? target.closest('.ProseMirror') as HTMLElement | null : null
  const browserSelection = window.getSelection()
  const range = browserSelection?.rangeCount ? browserSelection.getRangeAt(0).cloneRange() : null
  const sourceSelection = textarea ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) : ''
  const visualSelection = editor && range && editor.contains(range.commonAncestorContainer)
    ? browserSelection?.toString() || ''
    : ''
  const selectedText = sourceSelection || visualSelection
  closeMediaContextMenu()

  // 无选区也更新引用状态：光标在 blockquote 内时菜单应显示「取消引用」
  selectionInQuote.value = isSelectionInBlockquote()

  if (selectedText.trim()) {
    const pmRange = mdEditorRef.value?.getSelectionRange()
    activeTextSelection = textarea
      ? { kind: 'source', element: textarea, start: textarea.selectionStart, end: textarea.selectionEnd }
      : editor && range
        ? { kind: 'visual', element: editor, range, from: pmRange?.from, to: pmRange?.to }
        : null
    if (!activeTextSelection) return
    mediaInsertionSelection = textarea
      ? { kind: 'source', start: textarea.selectionStart, end: textarea.selectionEnd }
      : (() => {
          const selection = mdEditorRef.value?.getSelectionRange()
          return selection ? { kind: 'visual' as const, from: selection.from, to: selection.to } : null
        })()
    selectionInQuote.value = isSelectionInBlockquote()
    return
  }

  closeSelectionContextMenu()
  // 注意：这里不清除 activeTextSelection——点击菜单栏按钮本身会让
  // selectionchange 报告「无选区」，若此刻清空会丢掉用户刚选好的文本。
  // activeTextSelection 的生命周期由新的选中文本覆盖 / 笔记切换重置。
  if (textarea) {
    mediaInsertionSelection = { kind: 'source', start: textarea.selectionStart, end: textarea.selectionEnd }
  } else if (editor) {
    const selection = mdEditorRef.value?.getSelectionRange()
    mediaInsertionSelection = selection ? { kind: 'visual', from: selection.from, to: selection.to } : null
  } else {
    mediaInsertionSelection = null
  }
}

const chooseMediaInsert = (kind: MediaKind) => {
  closeSelectionContextMenu()
  closeMediaContextMenu()
  // 打开文件选择器会夺走编辑器焦点，先记录落点点?
  captureInsertionPoint()
  if (kind === 'image') imageFileInput.value?.click()
  else if (kind === 'video') videoFileInput.value?.click()
  else audioFileInput.value?.click()
}

/** 记录当前光标/选区作为媒体插入落点（源码与富文本两种模式） */
const captureInsertionPoint = () => {
  const textarea = sourceEditorRef.value
  if (textarea) {
    mediaInsertionSelection = { kind: 'source', start: textarea.selectionStart, end: textarea.selectionEnd }
    return
  }
  const selection = mdEditorRef.value?.getSelectionRange()
  mediaInsertionSelection = selection ? { kind: 'visual', from: selection.from, to: selection.to } : null
}

/** 插入前恢复富文本编辑器的落点选区（文件对话框/尺寸面板会夺走焦点） */
const restoreInsertionPoint = () => {
  const selection = mediaInsertionSelection
  if (!selection || selection.kind !== 'visual') return
  mdEditorRef.value?.setSelectionRange(selection.from, selection.to)
}

const onMediaFileSelected = async (kind: MediaKind, event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith(`${kind}/`)) {
    ElMessage.error(`请选择${mediaKindLabels[kind]}文件`)
    return
  }

  try {
    const dataUrl = await readFileAsDataUrl(file)
    const described = describeMedia(dataUrl)
    if (!described) {
      ElMessage.error('不支持的媒体格式')
      return
    }
    mediaSizeDialog.value = {
      visible: true,
      kind,
      fileName: file.name,
      dataUrl,
      width: null,
      height: null,
    }
  } catch (error) {
    logger.error('[笔记] 读取媒体文件失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error('媒体读取失败')
  }
}

const cancelMediaSize = () => {
  mediaSizeDialog.value.visible = false
  mediaSizeDialog.value.dataUrl = ''
}

const confirmMediaSize = async () => {
  const dialog = mediaSizeDialog.value
  const dataUrl = dialog.dataUrl
  const kind = dialog.kind
  dialog.visible = false
  dialog.dataUrl = ''
  if (!dataUrl) return

  try {
    // 文件对话框与尺寸面板都会夺走编辑器焦点，插入前先恢复落点选区
    restoreInsertionPoint()

    // 临时笔记：媒体写到 .md 同级 media/ 目录，正文保存相对引用（可随文件搬移）
    // 普通笔记：落库为内容寻址资产，正文里只留 esd-local-media:// 引用
    let reference: string | null = null
    if (props.tempNoteId) {
      reference = await tempNoteStore.attachMedia(props.tempNoteId, dataUrl)
    } else {
      reference = await storeMediaAsset(dataUrl)
    }
    if (!reference) {
      ElMessage.error('媒体保存失败')
      return
    }
    const size = dialog.width || dialog.height ? { width: dialog.width || undefined, height: dialog.height || undefined } : undefined
    const snippet = buildMediaSnippet({
      kind,
      reference,
      alt: dialog.fileName,
      size,
    })
    const inserted = await insertMediaSnippet(snippet)
    if (!inserted) {
      ElMessage.error('媒体插入失败')
      return
    }
    ElMessage.success(`${mediaKindLabels[kind]}已插入笔记`)
  } catch (error) {
    logger.error('[笔记] 插入媒体失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error('媒体插入失败')
  }
}

/** 把媒体片段插入到记录好的落点；富文本模式走 ProseMirror，源码模式走 textarea */
const insertMediaSnippet = async (snippet: string): Promise<boolean> => {
  const selection = mediaInsertionSelection
  mediaInsertionSelection = null

  if (selection?.kind === 'source' && sourceEditorRef.value) {
    const source = editorContent.value
    const start = Math.max(0, Math.min(selection.start, source.length))
    const end = Math.max(start, Math.min(selection.end, source.length))
    const before = source.slice(0, start)
    const after = source.slice(end)
    const prefix = before && !before.endsWith('\n') ? '\n\n' : ''
    const suffix = after && !after.startsWith('\n') ? '\n\n' : '\n'
    editorContent.value = before + prefix + snippet + suffix + after
    await nextTick()
    const caret = before.length + prefix.length + snippet.length + suffix.length
    sourceEditorRef.value?.focus()
    sourceEditorRef.value?.setSelectionRange(caret, caret)
    return true
  }

  if (mdEditorRef.value?.insertMediaBlock(snippet)) {
    return true
  }

  // 兜底：追加到末尾并保证自成一段段?
  const current = editorContent.value.trimEnd()
  editorContent.value = current ? `${current}\n\n${snippet}` : snippet
  await nextTick()
  mdEditorRef.value?.focus()
  return true
}

const containsEmbeddedMediaText = (text: string) => containsInlineMedia(text)

const preventMediaPaste = (event: ClipboardEvent) => {
  const clipboard = event.clipboardData
  if (!clipboard) return
  const items = Array.from(clipboard.items || [])
  const files = Array.from(clipboard.files || [])
  const html = clipboard.getData('text/html')
  const text = clipboard.getData('text/plain')
  const hasMediaFile = [...items, ...files].some(item => {
    const type = 'type' in item ? String(item.type).toLowerCase() : ''
    return type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')
  })
  const hasEmbeddedMedia = containsEmbeddedMediaText(html + '\n' + text)
  if (!hasMediaFile && !hasEmbeddedMedia) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  ElMessage.info('请使用右键菜单中的“插入图片 / 视频 / 音频”添加媒体')
}

const preventMediaDrop = (event: DragEvent) => {
  const files = Array.from(event.dataTransfer?.files || [])
  const hasMediaFile = files.some(file => {
    const type = String(file.type || '').toLowerCase()
    return type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')
  })
  if (!hasMediaFile) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  ElMessage.info('请使用右键菜单中的“插入图片 / 视频 / 音频”添加媒体')
}

const restoreActiveSelection = () => {
  const active = activeTextSelection
  if (!active) return false
  if (active.kind === 'source') {
    active.element.focus({ preventScroll: true })
    active.element.setSelectionRange(active.start, active.end)
    return true
  }

  active.element.focus({ preventScroll: true })
  const selection = window.getSelection()
  if (!selection) return false
  selection.removeAllRanges()
  selection.addRange(active.range)
  return true
}

const writeClipboardText = async (content: string) => {
  let copied = false
  try {
    await navigator.clipboard.writeText(content)
    copied = true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    try {
      textarea.focus()
      textarea.select()
      copied = document.execCommand('copy')
    } catch {
      copied = false
    } finally {
      textarea.remove()
    }
  }
  return copied
}

const copySelection = async () => {
  if (await writeClipboardText(selectionContextMenu.value.text)) closeSelectionContextMenu()
}

const dispatchSourceInput = (element: HTMLTextAreaElement) => {
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

const replaceSourceSelection = (transform: (text: string) => string) => {
  const active = activeTextSelection
  if (!active || active.kind !== 'source') return false
  const { element, start, end } = active
  const selectedText = element.value.slice(start, end)
  const replacement = transform(selectedText)
  element.setRangeText(replacement, start, end, 'select')
  dispatchSourceInput(element)
  activeTextSelection = { kind: 'source', element, start, end: start + replacement.length }
  return true
}

// ====== 插入对话框（链接 / 行内代码 / 块级代码）======
// 统一改为弹窗输入 + 格式审查，确认后插入到「打开弹窗前的光标/选区」处。
const insertDialogVisible = ref(false)
const insertDialogKind = ref<InsertKind>('inline-code')
const insertLinkInitialText = ref('')
const insertLinkHasSelection = ref(false)
const insertLinkAnchors = ref<Array<{ id: string; kind: 'quote' | 'heading'; text: string; firstLine?: string; level?: number }>>([])
const insertLinkNoteOptions = ref<string[]>([])

/** 打开弹窗时记录的落点：弹窗会抢焦点并让编辑器选区塌陷，必须提前记下来 */
let insertTarget:
  | { kind: 'visual'; from: number; to: number }
  | { kind: 'source'; start: number; end: number }
  | null = null

/** 读取当前选中的纯文本（用于链接文字预填） */
const getSelectedPlainText = (): string => {
  const target = insertTarget
  if (target?.kind === 'source') {
    return editorContent.value.slice(target.start, target.end).trim()
  }
  try {
    return String(window.getSelection()?.toString() || '').trim()
  } catch {
    return ''
  }
}

const openInsertDialog = (kind: InsertKind) => {
  closeSelectionContextMenu()
  headingOptionsOpen.value = false
  // 记录落点
  const textarea = sourceEditorRef.value
  const pmSelection = mdEditorRef.value?.getSelectionRange() ?? null
  if (textarea) {
    insertTarget = { kind: 'source', start: textarea.selectionStart, end: textarea.selectionEnd }
  } else if (pmSelection) {
    insertTarget = { kind: 'visual', from: pmSelection.from, to: pmSelection.to }
  } else {
    insertTarget = null
  }
  const hasSelection = !!insertTarget && (insertTarget.kind === 'source'
    ? insertTarget.start !== insertTarget.end
    : insertTarget.from !== insertTarget.to)
  insertLinkHasSelection.value = hasSelection
  insertLinkInitialText.value = hasSelection ? getSelectedPlainText() : ''
  // 链接目标候选：本笔记内的块（锚点）+ 可跳转的其它笔记
  if (kind === 'link') {
    insertLinkAnchors.value = collectMarkdownAnchors(editorContent.value).map(a => ({
      id: a.id,
      kind: a.kind,
      text: a.text,
      // 引用块在下拉里只显示第一行（用户要求），标题本身单行
      firstLine: a.firstLine,
      level: a.level,
    }))
    insertLinkNoteOptions.value = props.noteTitles
  }
  insertDialogKind.value = kind
  insertDialogVisible.value = true
}

/** 源码模式：在记录的落点插入文本，并把光标放到插入内容之后 */
const insertIntoSource = async (snippet: string, blockLevel: boolean) => {
  const target = insertTarget
  const textarea = sourceEditorRef.value
  if (!textarea) return false
  const source = editorContent.value
  const start = target?.kind === 'source' ? Math.max(0, Math.min(target.start, source.length)) : source.length
  const end = target?.kind === 'source' ? Math.max(start, Math.min(target.end, source.length)) : start
  const before = source.slice(0, start)
  const after = source.slice(end)
  const prefix = blockLevel && before && !before.endsWith('\n') ? '\n\n' : ''
  const suffix = blockLevel && after && !after.startsWith('\n') ? '\n\n' : ''
  const next = before + prefix + snippet + suffix + after
  editorContent.value = next
  await nextTick()
  const caret = before.length + prefix.length + snippet.length
  textarea.focus()
  textarea.setSelectionRange(caret, caret)
  return true
}

/** 恢复富文本落点（弹窗关闭后 PM 选区可能已塌陷） */
const restoreInsertTarget = () => {
  const target = insertTarget
  if (target?.kind === 'visual') {
    mdEditorRef.value?.setSelectionRange(target.from, target.to)
  }
}

/** 行内代码：富文本走 inlineCode mark（落在光标处），源码模式包 `…` */
const onInsertInlineCodeConfirm = async ({ text }: { text: string }) => {
  try {
    if (sourceEditorRef.value) {
      const target = insertTarget
      const source = editorContent.value
      const start = target?.kind === 'source' ? Math.max(0, Math.min(target.start, source.length)) : source.length
      const end = target?.kind === 'source' ? Math.max(start, Math.min(target.end, source.length)) : start
      const inner = text || source.slice(start, end)
      const replacement = '`' + inner + '`'
      editorContent.value = source.slice(0, start) + replacement + source.slice(end)
      await nextTick()
      const caret = start + replacement.length
      sourceEditorRef.value?.focus()
      sourceEditorRef.value?.setSelectionRange(caret, caret)
    } else {
      restoreInsertTarget()
      const ok = mdEditorRef.value?.insertInlineCodeAtCursor(text) ?? false
      if (!ok) {
        ElMessage.error('行内代码插入失败')
        return
      }
    }
    ElMessage.success('行内代码已插入')
  } finally {
    insertTarget = null
  }
}

/** 块级代码：富文本插入 code_block 节点（段落就地拆开），源码模式包 ```lang … ``` */
const onInsertBlockCodeConfirm = async ({ language, code }: { language: string; code: string }) => {
  try {
    if (sourceEditorRef.value) {
      const fence = '```'
      await insertIntoSource(`${fence}${language}\n${code}\n${fence}`, true)
    } else {
      restoreInsertTarget()
      const ok = mdEditorRef.value?.insertCodeBlockAtCursor(language, code) ?? false
      if (!ok) {
        ElMessage.error('代码块插入失败')
        return
      }
    }
    ElMessage.success('代码块已插入')
  } finally {
    insertTarget = null
  }
}

const onInsertLinkConfirm = async ({ url, text }: { url: string; text: string }) => {
  try {
    // 「链接到其它笔记」：url 形如 [[笔记名]]，插成 wiki 链接节点（点击跳转）
    const wikiName = /^\[\[(.+)\]\]$/.exec(url)?.[1]?.trim()

    if (sourceEditorRef.value) {
      const target = insertTarget
      const source = editorContent.value
      const start = target?.kind === 'source' ? Math.max(0, Math.min(target.start, source.length)) : source.length
      const end = target?.kind === 'source' ? Math.max(start, Math.min(target.end, source.length)) : start
      const selected = source.slice(start, end)
      // wiki 链接用 [[名字]]（可带别名 [[名字|显示文字]]），不走 markdown 链接语法
      const replacement = wikiName
        ? (text && text !== wikiName ? `[[${wikiName}|${text}]]` : `[[${wikiName}]]`)
        : `[${text || selected || url}](${url})`
      editorContent.value = source.slice(0, start) + replacement + source.slice(end)
      await nextTick()
      const caret = start + replacement.length
      sourceEditorRef.value?.focus()
      sourceEditorRef.value?.setSelectionRange(caret, caret)
      return
    }

    const target = insertTarget
    const from = target?.kind === 'visual' ? target.from : null
    const to = target?.kind === 'visual' ? target.to : null

    if (wikiName) {
      // 有落点：在选中位置替换成 wiki 链接；无落点：在光标处插入
      let ok = false
      if (from !== null && to !== null) {
        ok = mdEditorRef.value?.insertWikiLinkAtPositions(from, to, wikiName) ?? false
      }
      if (!ok) ok = mdEditorRef.value?.insertWikiLinkAtPositions(
        mdEditorRef.value?.getSelectionRange()?.from ?? 0,
        mdEditorRef.value?.getSelectionRange()?.to ?? 0,
        wikiName,
      ) ?? false
      if (!ok) {
        ElMessage.error('笔记链接插入失败')
        return
      }
      return
    }

    let ok = false
    if (from !== null && to !== null) {
      ok = mdEditorRef.value?.insertLinkAtPositions(from, to, url, text) ?? false
    }
    if (!ok) {
      // 无落点/位置失效：退回光标处插入
      ok = mdEditorRef.value?.insertLinkAtCursor(text || url, url) ?? false
    }
    if (!ok) {
      ElMessage.error('链接插入失败')
      return
    }
    if (!/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url)) {
      ElMessage.info('已插入链接（非 http/https 协议不会被系统浏览器打开）')
    }
  } finally {
    insertTarget = null
  }
}

/**
 * 设置标题级别（0 = 正文）。
 *
 * 富文本改走 `mdEditorRef.setHeadingLevel`（PM 事务）：
 * 旧实现用 document.execCommand('formatBlock')，在 ProseMirror 里不可靠
 * （尤其「取消标题」方向常常无效），与删除线/下划线是同一类坑。
 * 源码模式仍按行首 `#` 前缀改写文本。
 */
const applySelectionHeading = (level: number) => {
  const active = activeTextSelection
  if (level < 0 || level > 6) return
  if (active?.kind === 'source') {
    const { element, start, end } = active
    const value = element.value
    const blockStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const newlineAt = value.indexOf('\n', end)
    const blockEnd = newlineAt < 0 ? value.length : newlineAt
    const marker = level === 0 ? '' : `${'#'.repeat(level)} `
    const replacement = value.slice(blockStart, blockEnd)
      .split(/\r?\n/)
      .map(line => `${marker}${line.replace(/^#{1,6}[ \t]+/, '')}`)
      .join('\n')
    element.setRangeText(replacement, blockStart, blockEnd, 'select')
    dispatchSourceInput(element)
    activeTextSelection = { kind: 'source', element, start: blockStart, end: blockStart + replacement.length }
  } else if (!props.sourceMode) {
    // 富文本：光标位于块内即可设置级别，不要求选中文本
    mdEditorRef.value?.setHeadingLevel(level)
  }
  headingOptionsOpen.value = false
  closeSelectionContextMenu()
}

/** 检测当前选区是否已在 blockquote 内（富文本：DOM 祖先；源码：行首 > 前缀） */
const isSelectionInBlockquote = (): boolean => {
  const active = activeTextSelection
  if (!active) return false
  if (active.kind === 'source') {
    const { element, start } = active
    const lineStart = element.value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    return /^\s*> /.test(element.value.slice(lineStart))
  }
  const node = window.getSelection()?.anchorNode
  if (!node) return false
  let cursor: Node | null = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
  while (cursor) {
    if ((cursor as Element).tagName?.toLowerCase() === 'blockquote') return true
    cursor = cursor.parentElement
  }
  return false
}

// ====== 高亮与文字颜色 ======
const HIGHLIGHT_COLORS = [
  { name: '黄', value: '#fde047' },
  { name: '绿', value: '#86efac' },
  { name: '蓝', value: '#93c5fd' },
  { name: '粉', value: '#f9a8d4' },
  { name: '紫', value: '#d8b4fe' },
  { name: '橙', value: '#fdba74' },
]
const TEXT_COLORS = [
  { name: '白', value: '#f1f5f9' },
  { name: '红', value: '#fca5a5' },
  { name: '橙', value: '#fdba74' },
  { name: '黄', value: '#fde047' },
  { name: '绿', value: '#86efac' },
  { name: '蓝', value: '#93c5fd' },
  { name: '紫', value: '#d8b4fe' },
]

/** 色块单击时应用的默认色（= 各自调色板首项） */
const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0].value
const DEFAULT_TEXT_COLOR = TEXT_COLORS[0].value

/** 颜色归一化：mark 里存的是浏览器解析后的 rgb(...)，比较前统一成十六进制 */
const normalizeColor = (color: string | null): string | null => {
  if (!color) return null
  const value = color.trim().toLowerCase()
  if (value.startsWith('#')) return value.length === 4
    ? '#' + [...value.slice(1)].map(ch => ch + ch).join('')
    : value
  const rgb = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(value)
  if (!rgb) return value
  return '#' + [rgb[1], rgb[2], rgb[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')
}

/**
 * 色块单击：立即应用高亮/文字颜色，无需从下拉里选色。
 * 「同色再点即取消」——当前选区已是该色时改为清除，形成开关手感。
 */
const applyQuickHighlight = (): boolean => {
  if (!ensureSelectionForFormat()) return false
  const wanted = activeHighlightColor.value || DEFAULT_HIGHLIGHT_COLOR
  const current = normalizeColor(mdEditorRef.value?.getTextStyleColor('highlight') ?? null)
  // 选区已是该色 → 清除；否则应用该色
  const target = current === normalizeColor(wanted) ? null : wanted
  const ok = applyHighlight(target)
  refreshActiveFormats()
  return ok
}
const applyQuickTextColor = () => {
  if (!ensureSelectionForFormat()) return
  const wanted = activeTextColor.value || DEFAULT_TEXT_COLOR
  const current = normalizeColor(mdEditorRef.value?.getTextStyleColor('textColor') ?? null)
  const target = current === normalizeColor(wanted) ? null : wanted
  applyTextColor(target)
  refreshActiveFormats()
}

// ====== 顶部多分页菜单栏 ======
const MENUBAR_TABS = [
  { key: 'file', label: '文件' },
  { key: 'style', label: '样式' },
  { key: 'insert', label: '插入' },
  { key: 'view', label: '视图' },
  { key: 'help', label: '帮助' },
] as const
type MenubarTab = typeof MENUBAR_TABS[number]['key']
const menubarTab = ref<MenubarTab>('style')
/** 快捷键设置弹窗 */
const shortcutDialogVisible = ref(false)

/**
 * 源码模式下的可用分页。
 *
 * 用户要求：源码模式里「样式/插入」这两个分页的功能无效，直接隐藏，
 * 相关快捷键也一并禁用。
 * 为什么直接隐藏而不是禁用：源码模式编辑的是 markdown 原文，
 * 富文本的行内/块级插入与样式按钮都作用于 ProseMirror 选区，在这里没有语义，
 * 留着只会让用户点了没反应；隐藏后菜单栏只保留真正能用的分页。
 */
const SOURCE_MODE_TABS: MenubarTab[] = ['file', 'view', 'help']
const visibleMenubarTabs = computed(() =>
  props.sourceMode
    ? MENUBAR_TABS.filter(tab => SOURCE_MODE_TABS.includes(tab.key))
    : MENUBAR_TABS,
)

/** 源码模式下若当前停在被隐藏的分页上，自动切到可用分页（否则页面会一片空白） */
watch(() => props.sourceMode, (source) => {
  if (!source) return
  if (!SOURCE_MODE_TABS.includes(menubarTab.value)) {
    menubarTab.value = 'view'
  }
}, { immediate: true })

// ====== 选区格式状态（菜单栏按钮高亮）======
/**
 * 给按钮的 title 追加当前生效的快捷键组合。
 *
 * 用户要求：「鼠标悬停在按钮上时显示快捷键组合」。
 * 这样用户不必打开快捷键设置就能看到每个按钮对应的键位，
 * 也便于发现「某个键被自己改过」。
 *
 * 注意：comboFor 读的是 store 里的 bindings ref，因此本函数**在模板调用时**
 * 会随 bindings 变化重新求值（模板渲染天然依赖该 ref）。
 *
 * @param base 原有说明文字（可能含禁用原因）
 * @param actionId 动作 id；取不到绑定时不加后缀
 */
const withShortcut = (base: string, actionId: string): string => {
  const combo = comboFor(actionId)
  if (!combo) return base
  return `${base}（${formatCombo(combo)}）`
}

interface ActiveFormats {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
  link: boolean
  highlight: boolean
  textColor: boolean
  superscript: boolean
  subscript: boolean
  heading: number
  quote: boolean
  bullet: boolean
  ordered: boolean
}
const EMPTY_ACTIVE_FORMATS: ActiveFormats = {
  bold: false, italic: false, underline: false, strike: false, code: false, link: false,
  highlight: false, textColor: false, superscript: false, subscript: false,
  heading: 0, quote: false, bullet: false, ordered: false,
}
const activeFormats = ref<ActiveFormats>({ ...EMPTY_ACTIVE_FORMATS })
const activeHighlightColor = ref<string | null>(null)
const activeTextColor = ref<string | null>(null)

/** 光标/选区是否处于引用内（富文本用 activeFormats.quote，源码用行首 > 判断） */
const inQuoteNow = computed(() => (props.sourceMode ? selectionInQuote.value : activeFormats.value.quote))

/**
 * 光标/选区是否处于 H1～H6 标题内（用户要求「标题不能改样式」）。
 *
 * 富文本：activeFormats.heading 为 1~6 即处于标题内（由 MilkdownEditor.getActiveFormats 提供）。
 * 源码模式：菜单栏不做精细态判断，这里直接按「当前行是否为 # 开头的标题」判断，
 *   使源码模式下标题行同样被禁用行内样式（保持一致的行为预期）。
 */
const inHeadingNow = computed(() => {
  if (!props.sourceMode) return activeFormats.value.heading > 0
  const textarea = sourceEditorRef.value
  if (!textarea) return false
  const pos = textarea.selectionStart ?? 0
  const lineStart = (editorContent.value || '').lastIndexOf('\n', Math.max(0, pos - 1)) + 1
  const lineEnd = (editorContent.value || '').indexOf('\n', pos)
  const line = (editorContent.value || '').slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
  return /^#{1,6}\s+/.test(line)
})

/** 刷新菜单栏激活态 */
const refreshActiveFormats = () => {  if (props.sourceMode) {
    // 源码模式：菜单栏样式按钮不做精细态判断，仅保留引用判断
    activeFormats.value = { ...EMPTY_ACTIVE_FORMATS, quote: selectionInQuote.value }
    return
  }
  const formats = mdEditorRef.value?.getActiveFormats()
  if (!formats) {
    activeFormats.value = { ...EMPTY_ACTIVE_FORMATS }
    return
  }
  activeFormats.value = formats
}

/** 颜色下拉：Element Plus 的 @command 不用，这里用面板内按钮直接触发；保留占位避免告警 */
const onHighlightCommand = () => { /* 面板内按钮已直接调用 menubarHighlight */ }
const onTextColorCommand = () => { /* 面板内按钮已直接调用 menubarTextColor */ }

/** 菜单栏样式按钮：实时捕获编辑器当前选区/光标后执行。
 *  引用/列表是**块级**操作，支持光标模式（只需光标在块内，不要求选中文本）；
 *  其余行内格式需要真实选区。 */
const menubarFormat = (format: 'bold' | 'italic' | 'underline' | 'superscript' | 'subscript' | 'link' | 'quote' | 'code' | 'unordered' | 'ordered' | 'strike'): boolean => {
  // 标题内禁止叠加行内样式（用户要求「标题不能改样式」）。
  // 这里做运行时兜底：模板上的 :disabled 只挡住鼠标点击，
  // 快捷键（Ctrl+B 等）走 dispatch → runner → 本函数，必须在这里也拦一次。
  // 例外：'link' 不改变标题外观（只是加链接），允许使用。
  if (inHeadingNow.value && format !== 'link') {
    ElMessage.info('标题的样式由级别决定，不能在其内部再叠加行内样式')
    return false
  }
  /**
   * 块级操作（引用 / 列表）：只需光标，不需要选中文本。
   * 为什么单独处理：captureInsertionPointForFormat 要求 `sel.toString()` 非空
   * （即必须有选中文字），而列表/引用的典型用法是「光标放在某段上按快捷键」，
   * 此时没有选区 → 旧逻辑会提示「请先选中要格式化的文本」并拒绝执行。
   */
  const isBlockOp = format === 'quote' || format === 'unordered' || format === 'ordered'
  // 每次点击都重新实时捕获（上次记录的 range 可能已因文档变化失效）
  const hasLive = captureInsertionPointForFormat()
  if (!hasLive && !activeTextSelection) {
    if (isBlockOp && !props.sourceMode) {
      // 富文本块级操作：直接交给 PM 命令（无需选区）
      if (format === 'quote') {
        const result = mdEditorRef.value?.toggleBlockquote()
        if (result === 'lifted' || result === 'wrapped') {
          refreshActiveFormats()
          return true
        }
      } else {
        const ok = !!mdEditorRef.value?.toggleList(format === 'ordered')
        refreshActiveFormats()
        return ok
      }
    }
    ElMessage.info('请先选中要格式化的文本')
    return false
  }
  const ok = applySelectionFormat(format)
  refreshActiveFormats()
  return ok
}

/**
 * 菜单栏标题按钮。
 * 标题是**块级**操作，只要求光标在块内，不需要选中文本
 * （用户要求给六个标题和正文都加快捷键，若要求选区会很难用）。
 */
const menubarHeading = (level: number) => {
  // 富文本：至少要有光标位置；源码：直接用 textarea 的当前光标
  if (props.sourceMode) {
    const el = sourceEditorRef.value
    if (el) activeTextSelection = { kind: 'source', element: el, start: el.selectionStart, end: el.selectionEnd }
    else if (!activeTextSelection) return
  } else if (!captureInsertionPointForFormat() && !activeTextSelection) {
    // 富文本光标在正文中时 window.getSelection() 通常为空 range（折叠选区），
    // captureInsertionPointForFormat 会因「无选中文字」返回 false，
    // 但块级操作只需光标 —— 因此这里不拦截，直接交给 PM 命令处理。
  }
  applySelectionHeading(level)
  refreshActiveFormats()
}

/** 菜单栏高亮/颜色 */
const menubarHighlight = (color: string | null) => {
  if (inHeadingNow.value) {
    ElMessage.info('标题的样式由级别决定，不能在其内部再叠加行内样式')
    return
  }
  if (color !== null && !ensureSelectionForFormat()) return
  applyHighlight(color)
  activeHighlightColor.value = color
  refreshActiveFormats()
}
const menubarTextColor = (color: string | null) => {
  if (inHeadingNow.value) {
    ElMessage.info('标题的样式由级别决定，不能在其内部再叠加行内样式')
    return
  }
  if (color !== null && !ensureSelectionForFormat()) return
  applyTextColor(color)
  activeTextColor.value = color
  refreshActiveFormats()
}

/**
 * 确保存在可用的选区。
 * 关键：先尝试用「当前实时选区」刷新记录——若直接复用上一次的记录，
 * 连续对两段不同文本做格式化时第二次会错误地作用到第一段上。
 * 只有在实时选区为空（例如按钮点击已使选区塌陷）时才沿用上一次的记录。
 */
const ensureSelectionForFormat = (): boolean => {
  if (captureInsertionPointForFormat()) return true
  if (activeTextSelection) return true
  ElMessage.info('请先选中要格式化的文本')
  return false
}

/**
 * 从当前编辑器实时捕获选区（富文本 window.getSelection / 源码 textarea）。
 * @returns 是否捕获到非空选区
 */
const captureInsertionPointForFormat = (): boolean => {
  if (props.sourceMode) {
    const el = sourceEditorRef.value
    if (el && el.selectionStart !== el.selectionEnd) {
      activeTextSelection = { kind: 'source', element: el, start: el.selectionStart, end: el.selectionEnd }
      return true
    }
    return false
  }
  const editorEl = mdEditorRef.value?.blocksContainerRef?.querySelector('.ProseMirror')
  const sel = window.getSelection()
  if (editorEl && sel && sel.rangeCount && editorEl.contains(sel.anchorNode) && sel.toString()) {
    const pmRange = mdEditorRef.value?.getSelectionRange()
    activeTextSelection = {
      kind: 'visual',
      element: editorEl as HTMLElement,
      range: sel.getRangeAt(0).cloneRange(),
      from: pmRange?.from,
      to: pmRange?.to,
    }
    return true
  }
  return false
}

// ====== 大纲悬浮 ======
const outlineHoverOpen = ref(false)/** 面板收起延时：跨越按钮与面板之间空隙时不会闪退 */
let outlineCloseTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 是否由「显式操作」（点按钮 / 快捷键）打开。
 *
 * 为什么需要：.outline-float.open .outline-float-btn 会变成 `pointer-events: none`，
 * 鼠标若正停在按钮上，pointer-events 变化会让浏览器重算命中目标并触发 mouseleave，
 * 于是 onOutlinePointerLeave 启动 220ms 关闭定时器 → 面板刚打开就被关掉（一闪即逝）。
 * 用户感知就是「大纲快捷键无效」。
 * 显式打开时把 pinned 置 true，此时忽略 mouseleave 的自动收起。
 */
const outlinePinned = ref(false)

const onOutlinePointerEnter = () => {
  if (outlineCloseTimer) {
    clearTimeout(outlineCloseTimer)
    outlineCloseTimer = null
  }
  outlineHoverOpen.value = true
}

const onOutlinePointerLeave = () => {
  // 显式（点击/快捷键）打开的面板不因鼠标移出而关闭，避免「一闪即逝」
  if (outlinePinned.value) return
  if (outlineCloseTimer) clearTimeout(outlineCloseTimer)
  // 留一点缓冲，鼠标从按钮移到面板（或从面板移出）都不会抖动
  outlineCloseTimer = setTimeout(() => {
    outlineHoverOpen.value = false
    outlineCloseTimer = null
  }, 220)
}

/** 视图页「大纲」按钮：显式开/关（不依赖 hover） */
const toggleOutlinePanel = () => {
  if (outlineCloseTimer) {
    clearTimeout(outlineCloseTimer)
    outlineCloseTimer = null
  }
  const next = !outlineHoverOpen.value
  outlineHoverOpen.value = next
  // 打开时固定住（不受 mouseleave 影响）；关闭时解除固定
  outlinePinned.value = next
}

/** 富文本：通过自定义 mark 上色（execCommand 在 PM 内无效，见 textStyleMarks.ts）
 *  @returns 是否真的应用成功（供快捷键冲突检测判断「动作是否可用」） */
const applyRichColor = (kind: 'highlight' | 'textColor', color: string | null): boolean => {
  const active = activeTextSelection
  if (!active) return false
  if (active.kind === 'visual') {
    // 首选：用 DOM Range 实时换算 PM 位置——范围与用户选中文本严格一致
    const result = mdEditorRef.value?.applyTextStyleMarkViaRange(kind, color, active.range)
    if (result?.ok) {
      closeSelectionContextMenu()
      return true
    }
  }
  // 回退：用捕获时记录的 PM 位置（或当前 PM 选区）
  let from = active.kind === 'visual' ? active.from : undefined
  let to = active.kind === 'visual' ? active.to : undefined
  if (from === undefined || to === undefined) {
    const current = mdEditorRef.value?.getSelectionRange()
    if (!current) return false
    from = current.from
    to = current.to
  }
  mdEditorRef.value?.setRichSelection(from, to)
  const ok = !!mdEditorRef.value?.applyTextStyleMark(kind, color)
  if (!ok) ElMessage.info('请先选中要设置样式的文本')
  closeSelectionContextMenu()
  return ok
}

/** 源码：包裹内联 HTML 标签（存储格式，与富文本 mark 的序列化一致） */
const applySourceColor = (kind: 'highlight' | 'text', color: string) => {
  const wrap = kind === 'highlight'
    ? (t: string) => `<mark style="background:${color}">${t}</mark>`
    : (t: string) => `<span style="color:${color}">${t}</span>`
  replaceSourceSelection(text => wrap(text))
  closeSelectionContextMenu()
}

/**
 * 源码：清除选区上的标签。
 * 用户通常只选中标签内的文字（标签本身在选区外），因此先向外扩展选区，
 * 把紧邻的成对标签一并纳入再删除；否则清除会无效。
 */
const clearSourceTag = (tag: 'mark' | 'span') => {
  const active = activeTextSelection
  if (!active || active.kind !== 'source') return
  const { element } = active
  const value = element.value
  let start = active.start
  let end = active.end
  const openMatch = new RegExp(`<${tag}\\b[^>]*>$`).exec(value.slice(0, start))
  if (openMatch) start -= openMatch[0].length
  const closeMatch = new RegExp(`^</${tag}>`).exec(value.slice(end))
  if (closeMatch) end += closeMatch[0].length
  const scoped = value.slice(start, end)
  const cleaned = tag === 'mark'
    ? scoped.replace(/<\/?mark[^>]*>/g, '')
    : scoped.replace(/<span style="[^"]*color:[^"]*">([\s\S]*?)<\/span>/g, '$1')
  activeTextSelection = { kind: 'source', element, start, end }
  replaceSourceSelection(() => cleaned)
  closeSelectionContextMenu()
}

/** 菜单入口：应用高亮 */
const applyHighlight = (color: string | null): boolean => {
  const active = activeTextSelection
  if (!active) return false
  if (active.kind === 'source') {
    if (color === null) clearSourceTag('mark')
    else applySourceColor('highlight', color)
    return true
  }
  return applyRichColor('highlight', color)
}

/** 菜单入口：应用文字颜色 */
const applyTextColor = (color: string | null): boolean => {
  const active = activeTextSelection
  if (!active) return false
  if (active.kind === 'source') {
    if (color === null) clearSourceTag('span')
    else applySourceColor('text', color)
    return true
  }
  return applyRichColor('textColor', color)
}

const applySelectionFormat = (format: 'bold' | 'italic' | 'underline' | 'superscript' | 'subscript' | 'link' | 'quote' | 'code' | 'unordered' | 'ordered' | 'strike'): boolean => {
  const active = activeTextSelection
  if (!active) return false

  if (format === 'link') {
    openInsertDialog('link')
    return true
  }

  if (active.kind === 'source') {
    if (format === 'quote') {
      // 源码模式：已引用则剥掉行首 > ，否则加前缀
      replaceSourceSelection(text => text.split(/\r?\n/).map(line =>
        /^\s*> /.test(line) ? line.replace(/^(\s*)> /, '$1') : `> ${line}`
      ).join('\n'))
    } else if (format === 'unordered' || format === 'ordered') {
      /*
        源码模式的列表：按行加/去行首标记。
        支持**光标模式**（无选中文字）：若 active.start === active.end，
        取光标所在那一整行来操作（典型用法是「光标放在某行按快捷键」，
        没有选区时也应生效）。
      */
      let start = active.start
      let end = active.end
      if (start === end) {
        const value = active.element.value
        start = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
        const nl = value.indexOf('\n', end)
        end = nl < 0 ? value.length : nl
        activeTextSelection = { kind: 'source', element: active.element, start, end }
      }
      const marker = format === 'unordered' ? '- ' : ''
      const stripRe = /^[ \t]*([-*+]|\d+[.)])[ \t]+/
      replaceSourceSelection(text => text.split(/\r?\n/).map((line, index) => {
        // 已有列表标记 → 取消（整行都带则整体去掉）
        const bare = line.replace(stripRe, '')
        if (bare !== line) return bare
        return format === 'ordered' ? `${index + 1}. ${line}` : `${marker}${line}`
      }).join('\n'))
    } else {
      /*
        Markdown 没有下划线/上下标语法，统一用行内 HTML（Typora/Obsidian 通行的可移植写法）：
          下划线 <u>文字</u>、上标 <sup>文字</sup>、下标 <sub>文字</sub>
        与富文本侧的自定义 mark 序列化结果保持一致（同一份存储格式）。
        其余格式用对应的 markdown 标记。
      */
      const plainTag = format === 'underline' ? 'u'
        : format === 'superscript' ? 'sup'
          : format === 'subscript' ? 'sub'
            : null
      if (plainTag) {
        replaceSourceSelection(text =>
          // 二次点击应取消：若选区已被同一标签包裹，则剥掉标签
          new RegExp(`^<${plainTag}>([\\s\\S]*)</${plainTag}>$`).test(text)
            ? text.replace(new RegExp(`^<${plainTag}>([\\s\\S]*)</${plainTag}>$`), '$1')
            : `<${plainTag}>${text}</${plainTag}>`)
        closeSelectionContextMenu()
        return true
      }
      const marker = format === 'bold' ? '**'
        : format === 'italic' ? '*'
          : format === 'strike' ? '~~'
            : '`'
      replaceSourceSelection(text => `${marker}${text}${marker}`)
    }
    closeSelectionContextMenu()
    return true
  }

  if (!restoreActiveSelection()) return false
  if (format === 'quote') {
    // 用 PM 原生 wrapIn/lift 切换（execCommand formatBlock 对取消方向无效）。
    // toggleBlockquote 内部会 focus 编辑器——PM 会从 DOM 选区同步 state.selection。
    const result = mdEditorRef.value?.toggleBlockquote()
    if (result && result !== 'none') {
      closeSelectionContextMenu()
      return true
    }
    // PM 命令失败时退回 execCommand
    const fallback = document.execCommand('formatBlock', false, isSelectionInBlockquote() ? 'p' : 'blockquote')
    closeSelectionContextMenu()
    return fallback
  } else if (format === 'unordered' || format === 'ordered') {
    /*
      富文本：走 PM 的 toggleList（execCommand('insertUnorderedList') 在 PM 里不可靠，
      尤其「取消列表」方向常常无效 —— 与删除线/下划线是同一类坑）。
    */
    const ok = !!mdEditorRef.value?.toggleList(format === 'ordered')
    closeSelectionContextMenu()
    return ok
  } else if (format === 'code') {
    // 富文本：用 inlineCode mark（execCommand insertHTML 在 PM 里不进文档模型）。
    // 有选区时对选区加 mark；无选区交给 PM 命令处理，失败则报告失败。
    const codeRange = active.kind === 'visual' ? active.range : null
    const ok = !!mdEditorRef.value?.toggleInlineCodeMark?.(codeRange)
    closeSelectionContextMenu()
    return ok
  } else if (format === 'strike') {
    // 富文本：走 Milkdown 内置的 strike_through mark（详见 toggleStrikeMark 注释）。
    // ⚠️ 必须把捕获到的 DOM Range 传进去：PM 的 state.selection 在「DOM 选区刚恢复」
    // 时可能还没同步，只看 state.selection 会读到空选区并直接失败
    // ——这正是「删除线快捷键按了没反应」的原因（高亮/颜色因为走 Range 换算所以正常）。
    const strikeRange = active.kind === 'visual' ? active.range : null
    const ok = !!mdEditorRef.value?.toggleStrikeMark(strikeRange)
    closeSelectionContextMenu()
    // 诚实返回：失败时不再谎报成功，否则冲突检测永远发现不了问题
    return ok
  } else if (format === 'underline' || format === 'superscript' || format === 'subscript') {
    /*
      富文本：走自定义 mark（Milkdown 默认 schema 没有 u/sup/sub 的 mark，
      execCommand 插入的标签不属于 schema，会被丢弃／样式不生效）。
      统一用 Range 换算位置，规避 state.selection 未同步的问题。
    */
    const range = active.kind === 'visual' ? active.range : null
    const ok = format === 'underline'
      ? !!mdEditorRef.value?.toggleUnderlineMark(range)
      : format === 'superscript'
        ? !!mdEditorRef.value?.toggleSuperscriptMark(range)
        : !!mdEditorRef.value?.toggleSubscriptMark(range)
    closeSelectionContextMenu()
    return ok
  } else {
    const ok = document.execCommand(format === 'bold' ? 'bold' : 'italic')
    closeSelectionContextMenu()
    return ok
  }
}

const cutSelection = async () => {
  if (!(await writeClipboardText(selectionContextMenu.value.text))) return
  if (activeTextSelection?.kind === 'source') {
    const { element, start, end } = activeTextSelection
    element.setRangeText('', start, end, 'start')
    dispatchSourceInput(element)
  } else if (restoreActiveSelection()) {
    document.execCommand('delete')
  }
  closeSelectionContextMenu()
}

const pasteSelection = async () => {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    if (restoreActiveSelection()) document.execCommand('paste')
    closeSelectionContextMenu()
    return
  }

  if (containsEmbeddedMediaText(text)) {
  ElMessage.info('请使用右键菜单中的“插入图片”或“插入视频”添加媒体')
    closeSelectionContextMenu()
    return
  }

  if (activeTextSelection?.kind === 'source') {
    const { element, start, end } = activeTextSelection
    element.setRangeText(text, start, end, 'end')
    dispatchSourceInput(element)
  } else if (restoreActiveSelection()) {
    document.execCommand('insertText', false, text)
  }
  closeSelectionContextMenu()
}

const selectAllEditorText = () => {
  const active = activeTextSelection
  if (!active) return
  if (active.kind === 'source') {
    active.element.focus({ preventScroll: true })
    active.element.select()
  } else {
    active.element.focus({ preventScroll: true })
    document.execCommand('selectAll')
  }
  closeSelectionContextMenu()
}

const runNativeTextCommand = (command: 'undo' | 'redo') => {
  if (!restoreActiveSelection()) return
  document.execCommand(command)
  closeSelectionContextMenu()
}

/**
 * 格式/视图类快捷键的**捕获阶段**处理。
 *
 * 为什么必须用捕获阶段：
 *  加粗(Ctrl+B)、斜体(Ctrl+I) 等组合键 ProseMirror / Crepe 内部也绑定了
 *  （已核对打包产物：Crepe 的 CodeMirror keymap 里确有 Mod-b/Mod-i 等条目），
 *  它们在编辑器 DOM 上通过 handleKeyDown 处理并 preventDefault。
 *  之前我只在 document 的**冒泡阶段**监听，事件早被编辑器消费掉，
 *  因此「按了没反应」（用户报告的现象）。捕获阶段在编辑器之前拿到事件，
 *  就能先做我们自己的分发。
 *
 * 只拦「本应用确实绑定了动作」的组合；其余键一律放行，不影响编辑器原生行为。
 */
/**
 * 把本编辑器的快捷键动作注册到快捷键中心（run 模式的实际执行函数）。
 *
 * 为什么集中注册：用户要求「冲突检测要把所有快捷键跑一遍」，
 * 因此每个动作必须有一个可被 store 调用的执行函数；检测器用 test 模式跑（无副作用），
 * 真实按键走 run 模式。store 的 dispatch 是唯一派发入口，检测与行为必然一致。
 */
const registerShortcutRunners = () => {
  registerRunner('search', () => { openSearchBar(); return true })
  registerRunner('replace', () => {
    if (!searchBarVisible.value) openSearchBar()
    if (!replaceVisible.value) toggleReplaceBar()
    nextTick(() => replaceInputRef.value?.focus())
    return true
  })
  registerRunner('toggleSource', () => { emit('toggleSourceMode'); return true })
  registerRunner('outline', () => {
    const before = outlineHoverOpen.value
    toggleOutlinePanel()
    // 诚实返回：切换确实改变了面板状态才算成功。
    // 注意不能直接返回 outlineHoverOpen —— 再次按下是「关闭」，同样是成功操作，
    // 若返回 false 会造成假失败记录。
    return outlineHoverOpen.value !== before
  })
  registerRunner('fullscreen', () => { emit('toggleFullscreenEdit'); return true })

  /*
    ⚠️ 格式类 runner 必须诚实返回是否真的生效
    （这是「按了没反应、却检测不出冲突」的核心原因）：
    menubarFormat / applyQuickHighlight 内部会在「无选区」「标题内禁止叠加样式」
    「mark 不可用」等情况下静默 return，以前 runner 一律 `return true`，
    于是 run/test 两种模式都报告成功，检测自然永远发现不了问题。
    改为返回它们真实的布尔结果，检测就能看到失败。
  */
  registerRunner('bold', () => menubarFormat('bold'))
  registerRunner('italic', () => menubarFormat('italic'))
  registerRunner('underline', () => menubarFormat('underline'))
  registerRunner('superscript', () => menubarFormat('superscript'))
  registerRunner('subscript', () => menubarFormat('subscript'))
  registerRunner('strike', () => menubarFormat('strike'))
  registerRunner('code', () => menubarFormat('code'))
  registerRunner('quote', () => menubarFormat('quote'))
  registerRunner('highlight', () => applyQuickHighlight())

  // 块级动作（本轮新增快捷键）：列表 / 标题 / 正文。
  // 它们是块级操作，只需光标，因此单独走 menubarFormat('unordered'|'ordered')
  // 与 menubarHeading(level)，不做「必须有选区」的前置校验。
  registerRunner('unordered', () => menubarFormat('unordered'))
  registerRunner('ordered', () => menubarFormat('ordered'))
  registerRunner('h1', () => { menubarHeading(1); return true })
  registerRunner('h2', () => { menubarHeading(2); return true })
  registerRunner('h3', () => { menubarHeading(3); return true })
  registerRunner('h4', () => { menubarHeading(4); return true })
  registerRunner('h5', () => { menubarHeading(5); return true })
  registerRunner('h6', () => { menubarHeading(6); return true })
  registerRunner('body', () => { menubarHeading(0); return true })

  registerRunner('link', () => { openInsertDialog('link'); return true })
  // 'blockCode' 的快捷键已按用户要求删除，因此不再注册执行函数。
  // 功能本身仍在插入分页的「块级代码」按钮里，那条路径直接调用 openInsertDialog，与此无关。

  // ====== 能力探针：让检测能发现「键绑了但用不了」 ======
  // 探针只回答「动作在当前环境能不能生效」，**绝不改动文档**。
  // 与 runner 的区别：runner 是「真的执行一次」，探针是「不产生副作用地检查前置条件」。
  // 检测（test 模式）优先用探针，避免真的改动用户文档。
  const markAvailable = (name: string): boolean => {
    // 富文本：PM schema 里必须有对应 mark；源码模式直接支持行内标记，视为可用
    if (props.sourceMode) return true
    return mdEditorRef.value?.hasMarkType?.(name) ?? false
  }
  // 编辑器尚未就绪时不要误报：此时 schema 还没建立，探针应返回 true（未知而非失败）。
  // 否则用户一打开笔记、编辑器还在初始化时点开快捷键设置就会看到一堆假冲突。
  const editorReady = () => !!mdEditorRef.value?.hasMarkType?.('strong') || props.sourceMode
  registerProbe('bold', () => !editorReady() || markAvailable('strong'))
  registerProbe('italic', () => !editorReady() || markAvailable('emphasis'))
  registerProbe('underline', () => !editorReady() || markAvailable('esdUnderline'))
  registerProbe('superscript', () => !editorReady() || markAvailable('esdSuperscript'))
  registerProbe('subscript', () => !editorReady() || markAvailable('esdSubscript'))
  registerProbe('strike', () => !editorReady() || markAvailable('strike_through'))
  registerProbe('code', () => !editorReady() || markAvailable('inlineCode'))
  registerProbe('highlight', () => !editorReady() || markAvailable('esdHighlight'))
  // 引用/列表/标题是块级操作，依赖 PM 命令而非 mark，只要有编辑器视图即可用
  registerProbe('quote', () => props.sourceMode || !editorReady() || !!mdEditorRef.value)
  registerProbe('unordered', () => props.sourceMode || !editorReady() || !!mdEditorRef.value)
  registerProbe('ordered', () => props.sourceMode || !editorReady() || !!mdEditorRef.value)
  for (const id of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body']) {
    registerProbe(id, () => props.sourceMode || !editorReady() || !!mdEditorRef.value)
  }
  // 视图类与插入类：不依赖 mark，恒可用
  registerProbe('search', () => true)
  registerProbe('replace', () => true)
  registerProbe('toggleSource', () => true)
  registerProbe('outline', () => true)
  registerProbe('fullscreen', () => true)
  registerProbe('link', () => true)
}

/** 组件卸载时注销，避免悬挂引用 */
const UNREGISTERABLE_RUNNER_IDS = [
  'search', 'replace', 'toggleSource', 'outline', 'fullscreen',
  'bold', 'italic', 'underline', 'superscript', 'subscript', 'strike', 'code', 'quote', 'highlight',
  'unordered', 'ordered', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body',
  'link',
]

const unregisterShortcutRunners = () => {
  UNREGISTERABLE_RUNNER_IDS.forEach(id => unregisterRunner(id))
}

/** 作用于正文选区的动作：焦点在输入框里时不应触发（避免误改正文） */
const CONTENT_SCOPE_ACTIONS = new Set([
  'bold', 'italic', 'underline', 'superscript', 'subscript', 'strike', 'code', 'quote', 'highlight', 'link',
  // 块级动作（列表/标题/正文）同样会改正文，焦点在搜索框等输入框里时必须跳过
  'unordered', 'ordered', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body',
])

/**
 * 最近一次「快捷键被拦下」的记录。
 *
 * 为什么要记录：快捷键失效有两层原因——(a) 动作实现本身不生效（由 store 的探针覆盖），
 * (b) 事件在到达动作之前就被守卫拦掉（例如焦点在搜索框里）。
 * 后者以前完全不可见，用户只会觉得「按了没反应」，检测界面也无从解释。
 * 记下来后，可以在帮助/快捷键界面提示「刚才那条为什么没生效」，避免再出现
 * 「明明绑了、按了却没反应、还说没冲突」的情况。
 */
const blockedShortcutReason = ref<{ actionId: string; reason: string } | null>(null)

/**
 * 全局快捷键处理器（注册在 **window 捕获阶段**）。
 *
 * 为什么从 document 改到 window（本轮的重要修正）：
 *  用户报告「删除线/大纲快捷键无效，且最近的按键记录里完全查不到」。
 *  查不到意味着事件**根本没进本处理器**。捕获阶段的事件流顺序是
 *      window → document → … → target
 *  注册在 document 上时，任何在 window/document 之间做 stopPropagation 的监听器
 *  都能把我这条挡掉；而注册在 window 捕获阶段则是**整条链上最早**的一环，
 *  页面内任何监听器都不可能抢先拦下它。
 *  因此把主处理器上移到 window，从机制上消除这一类失效。
 *
 * 同时保留完整诊断埋点：任何一步提前 return 都记录原因，
 * 并且对**每个带修饰键的按键**先记一条（即使最终没有匹配动作），
 * 这样「按键到底有没有到达页面」是可判定的，而不是靠推测。
 */
const onGlobalShortcutKeydownCapture = (event: KeyboardEvent) => {
  const rawKey = String(event.key || '')
  const hasModifier = event.ctrlKey || event.altKey || event.metaKey

  /**
   * 记录一次按键的**最终结论**。
   *
   * ⚠️ 关键设计：一次按键只允许产生一条记录。
   * 用户截图里每次按键都出现两行（「f → 被拦下」「Ctrl+F → 已派发」），
   * 那其实是同一次按键：
   *   第 1 条 = 刚进处理器时的中间态（我旧代码在这里就 push 了一条）
   *   第 2 条 = 判定后的结论
   * 于是总条数虚高一倍，而且「已派发」这个中间态看起来像成功、与结论自相矛盾。
   *
   * 现在改为：全程只在**确定结论后**记录一次，中间不再落库。
   * 结论一定有 combo（不再让 UI 回退到 rawKey），并明确写「最终结果」。
   */
  const settle = (
    combo: string,
    extra: { actionId?: string; blockedBy?: string; executed?: boolean; ok?: boolean },
  ) => {
    const entry = { at: Date.now(), rawKey, combo, ...extra }
    traceKey(entry)
    try {
      // eslint-disable-next-line no-console
      console.debug('[shortcut]', entry)
    } catch { /* 忽略 */ }
  }

  /**
   * 纯修饰键必须跳过：按 Ctrl+Shift+X 会产生 Control/Shift/X 三个 keydown，
   * 前两个是纯修饰键、本身不构成快捷键，记下来只是噪音
   * （用户曾报告「显示未识别为组合键」，根因就是这里）。
   */
  const PURE_MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock']
  if (PURE_MODIFIER_KEYS.includes(rawKey)) return

  // 普通打字（无修饰键）不记录，避免刷屏；只关注快捷键类按键
  const combo = comboFromEvent(event)
  const looksLikeShortcut = hasModifier
  if (!looksLikeShortcut && !combo) return

  /**
   * 已被本应用处理过的标记。
   *
   * 消除截图里那对矛盾记录的关键：
   *  若处理器存在**多个实例**（例如 window 与 document 各注册了一个，
   *  或组件重复挂载），第一个实例 preventDefault + stopPropagation 之后，
   *  第二个实例仍会被调用（stopPropagation 只挡父子传播，**不挡同元素上的其它监听器**），
   *  于是它看到 defaultPrevented=true，就记下「被上游 preventDefault」——
   *  而实际上那是我们自己的第一个实例拦的，不是别的软件。
   *  用事件对象上的标记识别这种情况：直接跳过，不再产生第二条记录。
   */
  const HANDLED_FLAG = '__esdShortcutHandled'
  if ((event as any)[HANDLED_FLAG]) return

  if (event.defaultPrevented || event.isComposing) {
    if (looksLikeShortcut) {
      settle(combo || rawKey, {
        blockedBy: event.isComposing ? '输入法组合中(isComposing)' : '事件已被上游 preventDefault（更早的监听器已处理，本应用无法再收到）',
      })
    }
    return
  }
  if (shortcutDialogVisible.value) {
    settle(combo || rawKey, { blockedBy: '快捷键设置弹窗打开中' })
    return
  }
  if (!combo) {
    if (looksLikeShortcut) settle(rawKey, { blockedBy: `无法归一化（key="${rawKey}"）` })
    return
  }

  const result = dispatch(combo, 'test')
  if (!result.handled || !result.actionId) {
    if (looksLikeShortcut) settle(combo, { blockedBy: '没有动作绑定到这个组合键' })
    return
  }

  // 源码模式下「样式/插入」类动作一律不生效（用户要求相关快捷键也禁用）
  if (props.sourceMode && CONTENT_SCOPE_ACTIONS.has(result.actionId)) {
    ;(event as any)[HANDLED_FLAG] = true
    event.preventDefault()
    event.stopImmediatePropagation()
    settle(combo, { actionId: result.actionId, blockedBy: '源码模式（样式类快捷键已禁用）' })
    ElMessage.info('源码模式不支持样式/插入操作，已禁用对应快捷键')
    return
  }

  /**
   * 焦点是否在「真正的输入控件」里。
   *
   * ⚠️ 这里必须把**编辑器本体排除掉**（这是「删除线/高亮/引用/链接快捷键无效」的根因）：
   * ProseMirror 的根节点本身就是 `contenteditable` 的 div，简单用
   * `target.isContentEditable` 判断会把编辑器当成输入框，
   * 于是所有作用于正文的格式类快捷键在光标位于正文时**全部被跳过**，
   * 结果就是「按了没反应」。而加粗/斜体因为 Milkdown 自带 Mod-b/Mod-i keymap
   * 在冒泡阶段由 PM 处理，看起来还正常，从而掩盖了这个缺陷。
   *
   * 判定改为：只有搜索框/标签输入框等**非编辑器**的输入控件才拦截；
   * 编辑器本体（.ProseMirror / 源码 textarea）里的按键必须正常生效。
   */
  const target = event.target as HTMLElement | null
  const inEditor = !!target && (
    target.closest?.('.ProseMirror') !== null
    || target.classList?.contains('ProseMirror')
    || target === (sourceEditorRef.value as HTMLElement | null)
  )
  const isPlainInput = !!target && !inEditor && (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target.isContentEditable
  )
  if (isPlainInput && CONTENT_SCOPE_ACTIONS.has(result.actionId)) {
    blockedShortcutReason.value = {
      actionId: result.actionId,
      reason: '焦点在输入框内，为避免误改正文已跳过该动作',
    }
    settle(combo, { actionId: result.actionId, blockedBy: '焦点在输入框内（正文类动作被跳过）' })
    return
  }

  event.preventDefault()
  // stopImmediatePropagation（而不是 stopPropagation）：
  // 除了挡住事件继续向下传播，还能阻止**同一元素上后续注册的监听器**。
  // 这从源头消除「第二个处理器实例看到 defaultPrevented 就误记被上游拦截」的假象。
  ;(event as any)[HANDLED_FLAG] = true
  event.stopImmediatePropagation()
  // run 模式真正执行；失败时也记录原因（供检测界面展示）
  const runResult = dispatch(combo, 'run')
  blockedShortcutReason.value = runResult.ok
    ? null
    : { actionId: result.actionId, reason: '动作执行失败（当前环境或状态下无法生效）' }
  settle(combo, { actionId: result.actionId, executed: true, ok: runResult.ok })
}

const onSelectionMenuKeydown = (event: KeyboardEvent) => {
  // 媒体尺寸面板：Enter 确认 / Esc 取消（优先级最高，与搜索栏互不重叠）?
  if (mediaSizeDialog.value.visible) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelMediaSize()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void confirmMediaSize()
    }
    return
  }
  // 搜索栏 Esc：关闭并清除高亮（早于右键菜单，避免同时打开时误关菜单）
  if (searchBarVisible.value && event.key === 'Escape') {
    event.preventDefault()
    closeSearchBar()
    return
  }
  if (mediaContextMenu.value.visible && event.key === 'Escape') {
    event.preventDefault()
    closeMediaContextMenu()
    return
  }
  // 注意：格式/视图/插入类快捷键一律由 onGlobalShortcutKeydownCapture（捕获阶段）处理，
  // 见其注释——放在冒泡阶段会被 ProseMirror/Crepe 先消费掉，导致「按了没反应」。
  // 这里只保留搜索/替换（它们不冲突），避免同一按键被处理两次。
  if (comboFromEvent(event) === comboFor('search')) {
    event.preventDefault()
    openSearchBar()
    return
  }
  // 替换：Ctrl+H（可在快捷键设置里改）
  if (comboFromEvent(event) === comboFor('replace')) {
    event.preventDefault()
    if (!searchBarVisible.value) openSearchBar()
    if (!replaceVisible.value) toggleReplaceBar()
    nextTick(() => replaceInputRef.value?.focus())
    return
  }
  if (!selectionContextMenu.value.visible) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (headingOptionsOpen.value) headingOptionsOpen.value = false
    else closeSelectionContextMenu()
    return
  }
  if (event.target instanceof HTMLInputElement) return
  if (!(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 'c') {
    event.preventDefault()
    void copySelection()
  } else if (key === 'x') {
    event.preventDefault()
    void cutSelection()
  } else if (key === 'v') {
    event.preventDefault()
    void pasteSelection()
  } else if (key === 'a') {
    event.preventDefault()
    selectAllEditorText()
  } else if (key === 'z') {
    event.preventDefault()
    runNativeTextCommand(event.shiftKey ? 'redo' : 'undo')
  } else if (key === 'y') {
    event.preventDefault()
    runNativeTextCommand('redo')
  }
}

// ====== 自动保存 ======
// - 输入防抖 800ms 后落库?
// - 切换/关闭笔记、组件卸载或窗口隐藏时强制落库未保存的修改
// - savedTitle/savedContent 为「已发出保存」快照，用于去重与切换前差异判断
const AUTOSAVE_DELAY = 800
let savedTitle = ''
let savedContent = ''
let justSavedForId: string | null = null // 刚发出保存的笔记 id：防止保存回写触发内容重置?
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
const savedAt = ref<Date | null>(null)

const savedAtText = computed(() => (savedAt.value ? dayjs(savedAt.value).format('HH:mm:ss') : ''))

// 字数统计直接取编辑器当前内容（比由父组件按已落库内容计算更实时）
const totalWordCount = computed(() => {
  const text = getMdPlainText(editorContent.value)
  return text.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length
})

// 大纲
const outline = ref<MdOutlineItem[]>([])
const sidebarCollapsed = ref(true)
const toggleSidebar = () => { sidebarCollapsed.value = !sidebarCollapsed.value }

const refreshOutline = () => {
  outline.value = extractMdOutline(editorContent.value)
}

// 滚动到指定标题位置
const scrollToHeading = (item: MdOutlineItem) => {
  // 源码模式：按镜像实测的行高累计出该行的真实顶部偏移（软换行下 行号×行高 不成立），
  // 并把光标放到该标题行首。
  const textarea = sourceEditorRef.value
  if (textarea) {
    measureSourceLines()
    const lines = sourceLines.value
    const targetLine = Math.max(0, Math.min(item.line, lines.length - 1))
    const offset = sourceLineOffsets.value[targetLine] ?? 0

    // ⚠️ 顺序很重要（用户报告「要点两次才跳对」的根因）：
    //   textarea 在 focus() / setSelectionRange() 时，浏览器会自动滚动，
    //   把光标位置带进可视区。如果先 scrollTo 再设光标，我们算好的 scrollTop
    //   会被浏览器的「光标滚入」覆盖——第一次点击时旧光标在别处，于是落点错误；
    //   第二次点击时光标已在目标行附近，浏览器几乎不再滚动，位置才正确。
    //   因此这里必须**先设置焦点与光标，再用 'auto' 精确设置 scrollTop**，
    //   让我们的滚动成为最后一次生效的布局操作。
    textarea.focus()
    textarea.setSelectionRange(offset, offset)
    sourceCaretLine.value = targetLine

    // 用户明确要求：判定标准是「标题位于容器最上方」；
    // 若因接近文档末尾无法顶到最上方，则尽量靠上（取 scrollHeight 允许的最大值）。
    const lineTop = sourceLineTop(targetLine)
    const maxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight)
    const top = Math.max(0, Math.min(lineTop, maxScroll))
    // 同步设置：'auto' 避免平滑动画期间又被光标滚动打断
    textarea.scrollTop = top
    syncSourceGutter()
    // 有些浏览器在光标设置后仍会做一次异步滚动校正，下一帧再确认一次位置
    requestAnimationFrame(() => {
      const el = sourceEditorRef.value
      if (!el) return
      // 只有当用户没有手动滚动过、且位置确实被改偏时才纠正
      if (Math.abs(el.scrollTop - top) > 2) {
        el.scrollTop = Math.max(0, Math.min(top, el.scrollHeight - el.clientHeight))
      }
      syncSourceGutter()
    })
    // 焦点/选区变化后行高可能因软换行重算，补测一次让行号列与内容对齐
    scheduleMeasure()
    return
  }

  const md = editorContent.value || ''
  const totalLines = md ? md.split('\n').length : 1
  const ratio = item.line / totalLines

  // 滚动块容器
  const container = mdEditorRef.value?.blocksContainerRef
  if (container) {
    container.scrollTo({ top: ratio * container.scrollHeight, behavior: 'smooth' })
  }

  // 按标题文本在编辑容器内精确定位
  const selector = Array.from({ length: 6 }, (_, i) => `h${i + 1}`).join(',')
  const headings: NodeListOf<HTMLElement> = container
    ? container.querySelectorAll(selector)
    : document.querySelectorAll(selector)
  const searchText = item.text.trim()
  for (const h of headings) {
    if ((h.textContent || '').trim() === searchText) {
      h.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }
  }
}

// ====== 源码模式：行号列（镜像实测逐行高度） ======
const sourceGutterRef = ref<HTMLDivElement | null>(null)
const sourceMirrorRef = ref<HTMLDivElement | null>(null)
const sourceCaretLine = ref(0)
const sourceLines = computed<string[]>(() => (editorContent.value || '').split('\n'))
/** 每个逻辑行的实际渲染高度（软换行后可能占多个屏行） */
const sourceLineHeights = ref<number[]>([])
/** 每个逻辑行在内容中的起始字符偏移（跳转用） */
const sourceLineOffsets = computed<number[]>(() => {
  const offsets: number[] = []
  let acc = 0
  for (const line of sourceLines.value) {
    offsets.push(acc)
    acc += line.length + 1
  }
  return offsets
})

let measureTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 用隐形镜像量出每个逻辑行的渲染高度。
 * 软换行让「行数 ≠ 屏行数」，固定行高的行号列会逐行错位，必须实测。
 */
const measureSourceLines = () => {
  const mirror = sourceMirrorRef.value
  const textarea = sourceEditorRef.value
  if (!mirror || !textarea) return
  // 镜像宽度必须等于 textarea 的「内容宽度」，否则换行点不同、测出的行高不准。
  // clientWidth 已扣除纵向滚动条与边框，再减去左右内距即内容宽度。
  const cs = getComputedStyle(textarea)
  const contentWidth = textarea.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
  if (contentWidth > 0) mirror.style.width = `${Math.round(contentWidth)}px`
  const spans = mirror.querySelectorAll<HTMLElement>('.source-mirror-line')
  const heights: number[] = []
  for (const span of spans) heights.push(span.offsetHeight || 22)
  sourceLineHeights.value = heights
}

const scheduleMeasure = () => {
  if (measureTimer) clearTimeout(measureTimer)
  measureTimer = setTimeout(() => {
    measureTimer = null
    measureSourceLines()
  }, 120)
}

/** 累计到某逻辑行顶部的像素偏移（含上内边距） */
const sourceLineTop = (lineIndex: number): number => {
  const textarea = sourceEditorRef.value
  const padTop = textarea ? parseFloat(getComputedStyle(textarea).paddingTop) || 0 : 0
  let top = padTop
  for (let i = 0; i < lineIndex; i++) top += sourceLineHeights.value[i] || 22
  return top
}

/** textarea 滚动时行号列同步 */
const syncSourceGutter = () => {
  const textarea = sourceEditorRef.value
  const gutter = sourceGutterRef.value
  if (!textarea || !gutter) return
  gutter.scrollTop = textarea.scrollTop
}

/** 记录光标所在行，让行号列高亮当前行 */
const updateSourceCaretLine = () => {
  const textarea = sourceEditorRef.value
  if (!textarea) return
  const before = textarea.value.slice(0, textarea.selectionStart)
  sourceCaretLine.value = (before.match(/\n/g) || []).length
}

// 内容变化后重新测量（镜像已随 v-for 更新，等一帧再量）
watch(sourceLines, async () => {
  await nextTick()
  scheduleMeasure()
})

// 容器尺寸变化 / 字体就绪都会改变换行结果，需要重测
let sourceResizeObserver: ResizeObserver | null = null

// 切换进/出源码模式后重建行号状态
watch(() => props.sourceMode, async (isSource) => {
  if (!isSource) return
  await nextTick()
  measureSourceLines()
  syncSourceGutter()
  updateSourceCaretLine()
  // 镜像节点此刻才存在，补挂尺寸监听
  if (sourceResizeObserver && sourceMirrorRef.value) sourceResizeObserver.observe(sourceMirrorRef.value)
})

  /** 立即保存 targetNote 的当前编辑内容（内容仍留在 editorContent 中时调用）*/
const flushPending = (targetNote: Note) => {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  const title = noteTitle.value.trim() || '新笔记'
  const content = editorContent.value
  if (title === savedTitle && content === savedContent) return
  savedTitle = title
  savedContent = content
  justSavedForId = targetNote.id
  savedAt.value = new Date()
  emit('save', {
    id: targetNote.id,
    title,
    content,
    pinned: targetNote.pinned || false,
  })
}

const scheduleAutosave = () => {
  if (!props.note) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    if (props.note) flushPending(props.note)
  }, AUTOSAVE_DELAY)
}

watch([editorContent, noteTitle], scheduleAutosave)

// 监听笔记切换
watch(() => props.note, (note, oldNote) => {
  // 切换/关闭笔记前，强制落库旧笔记的未保存修改（此刻 editorContent 仍是旧内容）
  if (oldNote && (!note || note.id !== oldNote.id)) {
    flushPending(oldNote)
    // 旧笔记的匹配位置已失效：清空查询与高亮，避免残留到新笔记
    closeSearchBar()
  }
  if (!note) {
    lastNoteId = null
    return
  }
  if (justSavedForId && note.id === justSavedForId) {
    // 自动保存回写：只消费标记，不重置编辑内容
    justSavedForId = null
    lastNoteId = note.id
    return
  }
  const isNewNote = note.id !== lastNoteId
  lastNoteId = note.id
  if (!isNewNote) return
  noteTitle.value = note.title
  editorContent.value = note.content || ''
  savedTitle = note.title
  savedContent = note.content || ''
  nextTick(refreshOutline)
}, { immediate: true })

const formatTime = (date?: string): string => {
  if (!date) return ''
  const d = dayjs(date)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : ''
}

/**
 * 从外部重新载入当前笔记正文。
 * 用途：临时笔记「重新从磁盘读取」——文件被其它编辑器改动后，把磁盘内容灌回编辑器。
 * 注意：watch(props.note) 只在「切换笔记」时重置内容（避免自动保存回写把自己覆盖），
 * 所以同一篇笔记的外部变更需要显式调用本方法。
 */
const reloadFromNote = () => {
  const note = props.note
  if (!note) return
  editorContent.value = note.content || ''
  savedContent = note.content || ''
  savedTitle = note.title
  lastNoteId = note.id
  noteTitle.value = note.title
  flushPending(note)
  void nextTick(() => {
    refreshOutline()
    if (!props.sourceMode) mdEditorRef.value?.setValue(editorContent.value)
  })
}

/** 是否有未落盘的编辑（自动重读前必须确认，否则会吃掉用户正在输入的字符） */
const hasPendingEdits = (): boolean => editorContent.value !== savedContent

/** 当前阅读位置：滚动偏移 + 光标所在逻辑行（源码模式） */
const getReadingPosition = (): { scrollTop: number; caretLine: number } => {
  const textarea = sourceEditorRef.value
  if (textarea) {
    return { scrollTop: Math.round(textarea.scrollTop), caretLine: sourceCaretLine.value }
  }
  const container = mdEditorRef.value?.blocksContainerRef
  return { scrollTop: Math.round(container?.scrollTop || 0), caretLine: 0 }
}

/**
 * 恢复阅读位置（自动重读/重新打开后回到原来看的地方）。
 *
 * 不用固定延时：切换笔记时「NoteEditor 灌内容 → MilkdownEditor 重建文档」是异步链，
 * 固定 260ms 只是"看起来够用"。这里轮询确认两件事：
 *  1) 编辑器内容已经是目标笔记（否则滚动位置是针对旧文档的，恢复无意义）；
 *  2) 容器真的能滚到目标位置（渲染完成前 scrollTop 会被夹住）。
 * 最多等 ~1.5s，超时放弃（宁可位置不对，不可卡住）。
 */
const restoreReadingPosition = async (
  position: { scrollTop: number; caretLine: number },
  expectedContent?: string,
) => {
  const deadline = Date.now() + 1500
  for (;;) {
    await nextTick()
    const contentReady = expectedContent === undefined || editorContent.value === expectedContent
    const textarea = sourceEditorRef.value
    if (textarea) {
      if (!contentReady) {
        if (Date.now() > deadline) return
        await new Promise(resolve => setTimeout(resolve, 80))
        continue
      }
      measureSourceLines()
      const targetLine = Math.max(0, Math.min(position.caretLine, sourceLines.value.length - 1))
      const offset = sourceLineOffsets.value[targetLine] ?? 0
      textarea.scrollTop = position.scrollTop
      syncSourceGutter()
      textarea.setSelectionRange(offset, offset)
      sourceCaretLine.value = targetLine
      return
    }
    const container = mdEditorRef.value?.blocksContainerRef
    if (container && contentReady) {
      container.scrollTop = position.scrollTop
      const settled = position.scrollTop <= 2 || Math.abs(container.scrollTop - position.scrollTop) <= 2
      if (settled || Date.now() > deadline) return
    } else if (Date.now() > deadline) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 80))
  }
}

const forwardExportCommand = (command: string | number | object) => emit('export', command)

  // 父组件调用以更新笔记标题（属性栏标题输入）
const setNoteTitle = (title: string) => {
  noteTitle.value = title
}

// 源码模式：Tab 插入两个空格而非移动焦点
const onSourceKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const el = e.currentTarget as HTMLTextAreaElement
  const { selectionStart, selectionEnd, value } = el
  editorContent.value = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd)
  nextTick(() => {
    el.selectionStart = el.selectionEnd = selectionStart + 2
  })
}

// ====== 编辑器内搜索 ======
  // 富文本模式：查询与跳转都委托给 MilkdownEditor（ProseMirror 装饰器高亮）；
  // 源码模式：这里自行匹配 textarea 内容，用原生 setSelectionRange 定位。
  // 两边共用 findMatches，保证「第 N 处」语义一致。
const MAX_SEARCH_MATCHES = MAX_MATCHES

const searchBarVisible = ref(false)
const searchQuery = ref('')
const searchCaseSensitive = ref(false)
const searchRegex = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchMatches = ref<Array<{ start: number; end: number }>>([])
const searchActiveIndex = ref(-1)
const searchTruncated = ref(false)
const searchRegexError = ref('')

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const searchTotal = computed(() => searchMatches.value.length)

const searchCountText = computed(() => {
  if (!searchQuery.value.trim()) return '0/0'
  if (searchRegexError.value) return '无效'
  if (!searchTotal.value) return '0/0'
  const current = searchActiveIndex.value >= 0 ? searchActiveIndex.value + 1 : '?'
  return `${current}/${searchTotal.value}`
})

const clearSearchDebounce = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
}

/**
 * 重新匹配并同步到富文本编辑器（源码模式只更新本地计数）。
 *
 * @param activeIndex 搜索完成后要激活的匹配索引。
 *   - 省略 / -1：新查询默认不高亮任何一处，等用户按 Enter/箭头再定位；
 *   - >= 0：搜完立即激活该索引。
 * @param minStart 只考虑 start >= minStart 的匹配（用于替换后前进）。
 *
 * ⚠️ 为什么需要 minStart（用户报告的「无法接着替换」根因）：
 *   用户把「你好」替换成「你好1」——替换结果**仍然包含查询词**（"你好1" 里有"你好"）。
 *   若按「同一索引」前进，就会重新选中**刚插入的那处匹配**，
 *   于是每次替换都把同一位置越改越长（你好1 → 你好11 → 你好111），
 *   表现为「无法接着替换」。
 *   正确做法：只从「替换位置之后」找下一处，跳过刚写入的内容。
 *   因此这里同时支持 minStart 过滤。
 */
const runSearch = (activeIndex = -1, minStart = -1) => {
  const query = searchQuery.value
  if (!query.trim()) {
    searchMatches.value = []
    searchActiveIndex.value = -1
    searchTruncated.value = false
    searchRegexError.value = ''
    if (!props.sourceMode) mdEditorRef.value?.clearSearch()
    return
  }

  // 富文本：匹配编辑器摊平后的纯文本（getSearchMarkdown），
  // 与 setSearchMatches 的位置基准完全同源，命中即 PM 位置，不会错位；
  // 源码：匹配 textarea 的原始内容
  const text = props.sourceMode
    ? (sourceEditorRef.value?.value ?? editorContent.value)
    : (mdEditorRef.value?.getSearchMarkdown() || editorContent.value)
  const result = findMatches(text, query, {
    caseSensitive: searchCaseSensitive.value,
    regex: searchRegex.value,
  })

  searchTruncated.value = result.truncated
  searchRegexError.value = result.regexError

  // 富文本：把匹配区间交给编辑器做映射与高亮（单一数据源）。
  // 编辑器返回「可高亮」的子集，这里直接用它作为权威列表，
  // 保证计数与高亮数量、跳转目标三者一致；
  // 跨块匹配（如正则跨越段落）会被过滤，这是已知且可接受的降级。
  if (!props.sourceMode) {
    const highlightable = mdEditorRef.value?.setSearchMatches(result.matches, activeIndex) ?? result.matches
    if (import.meta.env.DEV) {
      logger.debug(`[搜索] query=${query} 基准长度=${text.length} 匹配=${result.matches.length} 可高亮=${highlightable.length}`)
    }
    searchMatches.value = highlightable
  } else {
    searchMatches.value = result.matches
  }

  /*
    激活索引：
      - 传入了 >= 0 的 activeIndex（替换后前进）：
          1) 若给了 minStart，优先取 start >= minStart 的第一处匹配
             —— 这样「替换结果仍含查询词」时不会原地打转；
          2) 否则用 activeIndex；越界回落第一处（循环替换直觉）。
      - 未传入（新查询）：置 -1，等用户按键再定位。
  */
  if (activeIndex >= 0 && searchMatches.value.length > 0) {
    let target = -1
    if (minStart >= 0) {
      target = searchMatches.value.findIndex(m => m.start >= minStart)
    }
    if (target < 0) {
      target = activeIndex < searchMatches.value.length ? activeIndex : 0
    }
    searchActiveIndex.value = target
    if (!props.sourceMode) {
      // 目标与编辑器侧传下去的可能不同（minStart 过滤后），显式同步一次
      mdEditorRef.value?.setSearchMatches(searchMatches.value, target)
      mdEditorRef.value?.focusMatch(target)
    } else {
      focusSearchMatch(target)
    }
  } else {
    // 新查询默认不高亮任何一处
    searchActiveIndex.value = -1
  }
}

/** 输入防抖：避免长笔记下每次按键都全量重算 */
const onSearchInput = () => {
  clearSearchDebounce()
  searchDebounceTimer = setTimeout(runSearch, 120)
}

/** 跳到第 index 处；富文本委托 MilkdownEditor，源码直接设选区 */
const focusSearchMatch = (index: number) => {
  if (index < 0 || index >= searchMatches.value.length) return
  searchActiveIndex.value = index

  if (props.sourceMode) {
    const textarea = sourceEditorRef.value
    const match = searchMatches.value[index]
    if (textarea && match) {
      // 不 focus：焦点须留在搜索框，否则 Enter/Shift+Enter 会被
      // textarea 当作换行处理，改坏正文。setSelectionRange 仍会高亮选区。
      textarea.setSelectionRange(match.start, match.end)

      // 滚动定位：必须用「镜像实测的逐行高度」而不是 linesBefore * lineHeight。
      // 后者在软换行时严重偏小（一个逻辑行可能占多屏行），实测会滚不到位置
      // ——这正是用户报告「搜索切换上下个内容不跳转」的原因之一。
      measureSourceLines()
      const line = Math.max(0, textarea.value.slice(0, match.start).split('\n').length - 1)
      const heights = sourceLineHeights.value
      let targetTop = 0
      for (let i = 0; i < line; i++) targetTop += heights[i] || 22
      const lineH = heights[line] || 22
      const viewTop = textarea.scrollTop
      const viewBottom = viewTop + textarea.clientHeight
      // 只有当匹配不在可视区内（或贴边）才滚动，避免每次跳转都晃动整页
      if (targetTop < viewTop || targetTop + lineH > viewBottom) {
        const maxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight)
        const top = Math.max(0, Math.min(targetTop - Math.max(0, (textarea.clientHeight - lineH) / 2), maxScroll))
        textarea.scrollTop = top
      }
      syncSourceGutter()
      sourceCaretLine.value = line
    }
    return
  }

  // 跳转只改 PM 选区，但 Cream 会随之重新序列化全文；标记 navigating
  // 屏蔽这次回写引发的重搜，待其稳定后再按当前正文校准一次匹配，
  // 并尽量保留用户当前所在的匹配项。
  if (!props.sourceMode) {
    navigatingMatch = true
    mdEditorRef.value?.focusMatch(index)
    nextTick(() => {
      setTimeout(() => {
        navigatingMatch = false
        const activeBefore = searchActiveIndex.value
        runSearch()
        if (activeBefore >= 0 && activeBefore < searchMatches.value.length) {
          searchActiveIndex.value = activeBefore
          mdEditorRef.value?.setSearchMatches(searchMatches.value, activeBefore)
        }
      }, 60)
    })
    return
  }

  mdEditorRef.value?.focusMatch(index)
}

/** 循环跳转：direction 1 下一处，-1 上一处 */
const stepSearch = (direction: 1 | -1) => {
  if (!searchTotal.value) return
  const next = nextMatchIndex(searchActiveIndex.value, searchTotal.value, direction)
  focusSearchMatch(next)
}

const toggleCaseSensitive = () => {
  searchCaseSensitive.value = !searchCaseSensitive.value
  runSearch()
}

const toggleRegex = () => {
  searchRegex.value = !searchRegex.value
  runSearch()
}

// ====== 替换（文件分页「替换」按钮 / Ctrl+H，快捷键可改）======
const replaceVisible = ref(false)
const replaceText = ref('')
const replaceInputRef = ref<HTMLInputElement | null>(null)

/** 打开/关闭替换行；打开时联动搜索栏 */
const toggleReplaceBar = () => {
  if (!replaceVisible.value && !searchBarVisible.value) openSearchBar()
  replaceVisible.value = !replaceVisible.value
  if (replaceVisible.value) nextTick(() => replaceInputRef.value?.focus())
}

/**
 * 替换当前高亮的这一处，并**自动跳到下一处**（用户要求：「替换一处后，
 * 应该自动切换到下一个」）。
 *
 * 为什么需要自动前进：连续替换的典型操作是「按一次替换 → 改下一处 → 再按」。
 * 若替换后停在原处或回到第一处，用户每替换一次都要手动点「下一处」，
 * 体验上等于没有连续替换能力。
 *
 * 实现要点：替换会改变位置基准，必须重跑搜索拿到新区间；
 * 然后定位到「原索引位置」——因为被替换的那处已消失，索引处自然就是下一处
 * （末处被替换时索引越界，回落到第一处，与循环替换的直觉一致）。
 * 源码模式直接改 textarea 文本；富文本走 PM 事务（保留撤销栈）。
 */
const replaceCurrent = () => {
  if (!searchTotal.value) return
  const index = searchActiveIndex.value >= 0 ? searchActiveIndex.value : 0
  const match = searchMatches.value[index]
  if (!match) return

  // 替换后要前进到的目标索引：同一索引即为「下一处」（原处已消失）。
  /*
    替换后前进的目标位置：**替换起点 + 替换文本长度**。
    不能只按「同一索引」前进 —— 若替换结果仍含查询词（例如 你好 → 你好1），
    同一索引会重新选中刚插入的那处，于是原地打转、越改越长
    （用户报告的「无法接着替换」正是这个现象）。从替换位置之后找，
    才能跳过刚写入的内容，正常推进到下一处。
  */
  const advanceFrom = match.start + replaceText.value.length

  if (props.sourceMode) {
    const textarea = sourceEditorRef.value
    if (!textarea) return
    const source = textarea.value
    const next = source.slice(0, match.start) + replaceText.value + source.slice(match.end)
    editorContent.value = next
    nextTick(() => {
      if (searchTotal.value > 0) {
        // 交给 runSearch 从替换位置之后定位（minStart 过滤）
        runSearch(advanceFrom, advanceFrom)
      } else {
        // 没有剩余匹配：光标落在替换文本之后
        const caret = match.start + replaceText.value.length
        textarea.setSelectionRange(caret, caret)
      }
    })
    return
  }

  const ok = mdEditorRef.value?.replaceSearchMatch(match.start, match.end, replaceText.value) ?? false
  if (!ok) {
    ElMessage.error('替换失败')
    return
  }
  /*
    富文本：Cream 重新序列化全文有延迟，必须等它稳定后再重搜，
    否则 runSearch 读到旧内容、匹配列表与替换后的实际不符。
    定位交给 runSearch(advanceFrom, advanceFrom)，保证「计数、高亮、跳转目标」一致。
  */
  navigatingMatch = true
  nextTick(() => {
    setTimeout(() => {
      navigatingMatch = false
      runSearch(advanceFrom, advanceFrom)
    }, 60)
  })
}

/** 全部替换：源码模式逐段拼接一次写完（避免 N 次 reactivity 抖动） */
const replaceAll = () => {
  if (!searchTotal.value) return
  const count = searchTotal.value

  if (props.sourceMode) {
    const textarea = sourceEditorRef.value
    if (!textarea) return
    const source = textarea.value
    // 从后往前替换，避免前面的替换影响后面 match 的下标
    let next = source
    for (let i = searchMatches.value.length - 1; i >= 0; i--) {
      const m = searchMatches.value[i]
      next = next.slice(0, m.start) + replaceText.value + next.slice(m.end)
    }
    editorContent.value = next
    nextTick(() => runSearch())
  } else {
    const ok = mdEditorRef.value?.replaceSearchMatches(searchMatches.value, replaceText.value) ?? false
    if (!ok) {
      ElMessage.error('全部替换失败')
      return
    }
    navigatingMatch = true
    nextTick(() => {
      setTimeout(() => {
        navigatingMatch = false
        runSearch()
      }, 80)
    })
  }
  ElMessage.success(`已替换 ${count} 处`)
}

const openSearchBar = () => {
  if (searchBarVisible.value) {
    // 已打开：聚焦输入框并全选，方便直接改关键词
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
    return
  }
  searchBarVisible.value = true
  nextTick(() => {
    searchInputRef.value?.focus()
    // 预填当前选中文本，省一次输入
    const selected = props.sourceMode
      ? (() => {
          const el = sourceEditorRef.value
          return el ? el.value.slice(el.selectionStart, el.selectionEnd) : ''
        })()
      : (window.getSelection()?.toString() || '')
    const seed = (selected || '').trim()
    if (seed) {
      searchQuery.value = seed
      runSearch()
    }
  })
}

const closeSearchBar = () => {
  clearSearchDebounce()
  searchBarVisible.value = false
  searchQuery.value = ''
  searchMatches.value = []
  searchActiveIndex.value = -1
  searchTruncated.value = false
  searchRegexError.value = ''
  if (!props.sourceMode) mdEditorRef.value?.clearSearch()
}

const toggleSearchBar = () => {
  if (searchBarVisible.value) closeSearchBar()
  else openSearchBar()
}

/** 搜索框内键盘：Enter/Shift+Enter 跳转，Esc 关闭 */
const onSearchKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    stepSearch(e.shiftKey ? -1 : 1)
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    closeSearchBar()
  }
}

// 富文本 ↔ 源码切换：两边的匹配位置基准不同，保留查询词但重置选中态，
    // 并按新模式重新匹配（markdown 全文 vs textarea 原文）。
watch(() => props.sourceMode, () => {
  if (!searchBarVisible.value) return
  searchActiveIndex.value = -1
  runSearch()
})

// 正文变化时刷新匹配：编辑会让旧偏移失效，重新匹配才能保证跳转准确。
// 仅在有查询词时刷新，避免给无搜索的常规编辑增加开销。
//
// 跳转保护：focusMatch 会改 PM 选区，Cream 随后重新序列化全文，
// 可能产生与跳转前不同的 markdown（例如空段落序列化成 <br />）。
// 这类「跳转引发的变化」不是用户编辑，若据此重搜会把刚设好的
// activeIndex 与匹配列表重置掉，表现为「跳到第 1 处后计数变 0」。
// 因此跳转期间置位 navigating，屏蔽刷新；跳转结束后再按当前正文校准一次。
let navigatingMatch = false

watch(editorContent, () => {
  if (!searchBarVisible.value || !searchQuery.value.trim()) return
  if (navigatingMatch) return
  clearSearchDebounce()
  searchDebounceTimer = setTimeout(runSearch, 200)
})

// 组件卸载 / 窗口隐藏时强制落库，避免退出丢失未保存修改
const flushOnLeave = () => {
  const note = props.note
  if (note && note.id === lastNoteId) flushPending(note)
}
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  /*
    全局快捷键注册在 **window 捕获阶段**。
    捕获阶段顺序是 window → document → … → target，
    window 是最早的一环，页面内任何监听器都无法抢先把它拦掉。

    ⚠️ 这里必须先移除再添加，并且用**固定的函数引用**（window 上挂的引用），
    否则会出现「同一实例被注册两次」或「HMR 热更新后旧实例残留」：
      - 注册两次 → 第一个实例 preventDefault 后，第二个实例看到
        defaultPrevented=true（stopPropagation 挡不住同元素上的其它监听器）
        → 记录出「被上游 preventDefault」这种自相矛盾的结论（用户截图现象）；
      - 旧实例残留（热更新）→ 旧代码没有本轮的标记位，同样干扰。
    注册前 removeEventListener 能保证同一引用只生效一次；
    配合处理器里的 HANDLED_FLAG，可彻底消除重复处理。
  */
  window.removeEventListener('keydown', onGlobalShortcutKeydownCapture, true)
  window.addEventListener('keydown', onGlobalShortcutKeydownCapture, true)
  document.addEventListener('keydown', onSelectionMenuKeydown)
  // 把动作执行函数注册到快捷键中心（冲突检测靠它跑 test 模式，真实按键跑 run 模式）
  registerShortcutRunners()
  // 选区变化时实时捕获（菜单栏样式按钮依赖 activeTextSelection）
  document.addEventListener('selectionchange', onDocumentSelectionChange)
  // 容器宽度变化会改变软换行结果 → 行高必须重测
  if (typeof ResizeObserver !== 'undefined') {
    sourceResizeObserver = new ResizeObserver(() => scheduleMeasure())
    const watchTarget = sourceMirrorRef.value || sourceEditorRef.value
    if (watchTarget) sourceResizeObserver.observe(watchTarget)
  }
  // 字体异步就绪后换行位置会变，补测一次
  void document.fonts?.ready?.then(() => scheduleMeasure())
  // 加载用户自定义快捷键（读不到则用默认绑定）
  void loadShortcuts()
})
onBeforeUnmount(() => {
  flushOnLeave()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  // 注册在 window 捕获阶段（见 onMounted），移除时必须用同一个目标，否则监听器会泄漏
  window.removeEventListener('keydown', onGlobalShortcutKeydownCapture, true)
  document.removeEventListener('keydown', onSelectionMenuKeydown)
  unregisterShortcutRunners()
  document.removeEventListener('selectionchange', onDocumentSelectionChange)
  sourceResizeObserver?.disconnect()
  sourceResizeObserver = null
  if (measureTimer) clearTimeout(measureTimer)
  if (autosaveTimer) clearTimeout(autosaveTimer)
  clearSearchDebounce()
})
const onVisibilityChange = () => {
  if (document.visibilityState === 'hidden') flushOnLeave()
}

/** 选区变化捕获：模拟右键菜单时代的选区记录，供菜单栏样式按钮使用 */
const onDocumentSelectionChange = (event: Event) => {
  // 构造伪 MouseEvent 复用既有捕获逻辑（其 event.clientX/Y 已不再使用）
  openSelectionContextMenu(event as unknown as MouseEvent)
  // 同步菜单栏激活态（光标移动、选中文本都会走到这里）
  refreshActiveFormats()
  // ProseMirror 自身的 selectionchange 同步可能晚于本监听器（DOMObserver 异步 flush），
  // 下一帧再校准一次，避免激活态停留在上一次的选区状态。
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => refreshActiveFormats())
  }
}

defineExpose({ setNoteTitle, sidebarCollapsed, toggleSidebar, reloadFromNote, hasPendingEdits, getReadingPosition, restoreReadingPosition })

let lastFallbackNoteId: unknown = Symbol('initial-note')
watchNoteTitleFallback(
  () => {
    const note = (props as any).note
    return [note?.id, note?.title, note?.content] as const
  },
  ([id, title, content]) => {
    const isNewNote = id !== lastFallbackNoteId
    lastFallbackNoteId = id
    const storedTitle = String(title || '').trim()
    if (!isNewNote && !storedTitle && noteTitle.value.trim()) return
    const markdownTitle = String(content || '').match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim()
    noteTitle.value = storedTitle || markdownTitle || ''
  },
  { immediate: true }
)
</script>

<style scoped>
.editor-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* flex 项必须允许横向收缩：否则内部较宽内容（工具栏/表格）的 min-content
     宽度会把本容器撑出父级，导致右侧被 overflow:hidden 裁掉
     （即用户报告的「编辑页容器贴住窗口右边界、被遮挡」）。 */
  min-width: 0;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  color: #e0e0e0;
  line-height: 1.8;
  /* 不用 padding/gap：外边距下移到各子元素，
     使本组件的外框正好从菜单栏上边界到状态栏下边界——
     这样同级放置的反向链接面板才能与菜单栏/状态栏严格对齐。 */
  padding: 0;
  gap: 0;
  background: transparent;
}

/* ====== 主容器 ====== */
.editor-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  /* 纵向：菜单栏在上、编辑区在下方铺满 */
  flex-direction: column;
  overflow: hidden;
  gap: 0;
}

/* ====== 侧边栏 ====== */
.editor-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.25s ease;
}

.editor-sidebar.collapsed {
  width: 40px;
}

.editor-sidebar-inner {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
  scrollbar-width: none;
}

.editor-sidebar.collapsed .editor-sidebar-inner {
  padding: 8px 6px;
  overflow: hidden;
}

.editor-sidebar-inner::-webkit-scrollbar { display: none; }

.editor-sidebar-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.65);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.editor-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-left: 4px;
}

.sidebar-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.sidebar-toggle-btn:hover {
  background: rgba(102, 126, 234, 0.18);
  color: #93c5fd;
}

.editor-sidebar.collapsed .editor-sidebar-header {
  margin-bottom: 0;
  padding-left: 0;
  justify-content: center;
}

.editor-sidebar.collapsed .sidebar-toggle-btn {
  width: 28px;
  height: 28px;
  font-size: 13px;
}

.editor-sidebar-nav {
  list-style: none;
  padding: 0;
  margin: 0;
  position: relative;
}

.editor-sidebar-nav li { margin: 2px 0; line-height: 1.4; position: relative; }

/* 竖线连接线段：非首项从上一项圆点延伸到本项圆点，使相邻两点之间连线连贯；首项上方、末项下方均不延伸 */
.editor-sidebar-nav li:not(:first-child)::before {
  content: '';
  position: absolute;
  left: 7px;
  top: -50%;
  width: 1px;
  height: 100%;
  background: rgba(102, 126, 234, 0.25);
}

/* 层级引导线：横线 + 节点圆点，横线长度随层级递增 */
.editor-sidebar-nav a { position: relative; }
.editor-sidebar-nav a::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 7px;
  transform: translateY(-50%);
  height: 1px;
  background: rgba(102, 126, 234, 0.35);
}
.editor-sidebar-nav a::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 7px;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(102, 126, 234, 0.55);
}
.editor-sidebar-nav a:hover::after { background: #93c5fd; }

/* 层级视觉区分：逐级增横线长度 + 缩进 + 递减字号/字重/颜色 */
.editor-sidebar-nav .nav-l1 a {
  display: flex;
  align-items: center;
  padding: 5px 8px 5px 22px;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.88);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.editor-sidebar-nav .nav-l1 a::before { width: 13px; }
.editor-sidebar-nav .nav-l1 a:hover { background: rgba(102, 126, 234, 0.18); color: #93c5fd; }

.editor-sidebar-nav .nav-l2 a {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 30px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.editor-sidebar-nav .nav-l2 a::before { width: 21px; }
.editor-sidebar-nav .nav-l2 a:hover { background: rgba(102, 126, 234, 0.14); color: #93c5fd; }

.editor-sidebar-nav .nav-l3 a {
  display: flex;
  align-items: center;
  padding: 3px 8px 3px 38px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.58);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.editor-sidebar-nav .nav-l3 a::before { width: 29px; }
.editor-sidebar-nav .nav-l3 a:hover { background: rgba(102, 126, 234, 0.1); color: #93c5fd; }

.editor-sidebar-nav .nav-l4 a,
.editor-sidebar-nav .nav-l5 a,
.editor-sidebar-nav .nav-l6 a {
  display: flex;
  align-items: center;
  padding: 3px 8px 3px 46px;
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.45);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.editor-sidebar-nav .nav-l4 a::before,
.editor-sidebar-nav .nav-l5 a::before,
.editor-sidebar-nav .nav-l6 a::before { width: 37px; }
.editor-sidebar-nav .nav-l4 a:hover,
.editor-sidebar-nav .nav-l5 a:hover,
.editor-sidebar-nav .nav-l6 a:hover { background: rgba(102, 126, 234, 0.08); color: #93c5fd; }

.nav-title-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-empty {
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  padding: 8px 4px;
}

/* ====== 主内容区 ====== */
.editor-content-area {
  flex: 1;
  min-width: 0;
  min-height: 0;
  /* 左右外边距取代原 editor-wrap 的水平内边距 */
  margin: 0 16px;
  display: flex;
  flex-direction: column;
}

.editor-viewport {
  position: relative;   /* 大纲悬浮按钮的定位上下文（编辑区左上角） */
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}

/* ====== 底部状态栏 ====== */
.editor-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  /* 原 editor-wrap 的底部/水平外边距下移到这里（底部与面板共用变量） */
  margin: var(--editor-outer-gap, 16px) 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  /* 同 .editor-menubar：flex 项 + flex-shrink:0 时必须配 min-width:0，
     否则 min-content 宽度会阻止收缩、把卡片撑出父容器而被裁（见该规则注释）。 */
  flex-shrink: 0;
  min-width: 0;
  font-size: 12px;
  color: var(--chalk-muted);
}

.editor-status-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.editor-status-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 4px;
}

.editor-status-sep {
  color: rgba(255, 255, 255, 0.1);
}

.editor-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  flex-shrink: 0;
  transition: all 0.15s;
}

.editor-action-btn:hover {
  color: #93c5fd;
  background: rgba(102, 126, 234, 0.12);
  border-color: rgba(102, 126, 234, 0.45);
}

.editor-action-btn.outline-toggle {
  border-color: rgba(167, 139, 250, 0.5);
  background: rgba(167, 139, 250, 0.15);
  color: #d8b4fe;
}

.editor-action-btn.outline-toggle:hover {
  background: rgba(167, 139, 250, 0.3);
  color: #ede9fe;
}

.editor-action-btn.on {
  border-color: rgba(167, 139, 250, 0.45);
  background: rgba(167, 139, 250, 0.12);
  color: #d8b4fe;
}

.editor-action-btn.favorite.on {
  color: var(--chalk-amber);
}

.editor-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.editor-status-right :deep(.el-dropdown) {
  display: inline-flex;
}

/* ====== 编辑器内搜索浮层 ====== */
.editor-search-bar {
  position: absolute;
  top: 10px;
  right: 14px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid rgba(196, 181, 253, 0.22);
  border-radius: 10px;
  background: rgba(28, 25, 54, 0.96);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(16px);
  /* 展开替换行后需要换行显示（搜索行在上、替换行在下），
     因此允许换行并给替换行 100% 宽度。 */
  flex-wrap: wrap;
  max-width: min(560px, calc(100% - 28px));
}

/* 替换行：占满整行，显示在搜索行下方 */
.editor-replace-row {
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.editor-replace-row .editor-search-input { flex: 1; min-width: 100px; }

.editor-replace-btn {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 12px;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.16s;
}

.editor-replace-btn:hover:not(:disabled) { background: rgba(102, 126, 234, 0.25); }
.editor-replace-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.editor-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid rgba(196, 181, 253, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  transition: border-color 0.15s ease;
}

.editor-search-input-wrap:focus-within {
  border-color: rgba(167, 139, 250, 0.6);
}

.editor-search-input-wrap.is-error {
  border-color: rgba(248, 113, 113, 0.7);
}

.editor-search-icon {
  display: inline-flex;
  color: rgba(245, 243, 255, 0.45);
  font-size: 13px;
}

.editor-search-input {
  width: 168px;
  border: none;
  outline: none;
  color: #f4f1ff;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
}

.editor-search-input::placeholder {
  color: rgba(245, 243, 255, 0.35);
}

.editor-search-chip {
  height: 22px;
  min-width: 28px;
  padding: 0 6px;
  border: 1px solid rgba(196, 181, 253, 0.2);
  border-radius: 6px;
  color: rgba(245, 243, 255, 0.55);
  background: rgba(255, 255, 255, 0.04);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.editor-search-chip:hover {
  color: #ede9fe;
  background: rgba(255, 255, 255, 0.1);
}

.editor-search-chip.on {
  border-color: rgba(167, 139, 250, 0.55);
  color: #d8b4fe;
  background: rgba(139, 92, 246, 0.22);
}

.editor-search-count {
  min-width: 40px;
  color: rgba(245, 243, 255, 0.7);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

.editor-search-count.is-empty {
  color: rgba(248, 113, 113, 0.85);
}

.editor-search-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

.editor-search-step,
.editor-search-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  color: rgba(245, 243, 255, 0.6);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.editor-search-step:hover:not(:disabled),
.editor-search-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.editor-search-step:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.editor-search-error,
.editor-search-hint {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  margin: 0;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
}

.editor-search-error {
  color: #fca5a5;
  background: rgba(127, 29, 29, 0.85);
}

.editor-search-hint {
  color: rgba(245, 243, 255, 0.6);
  background: rgba(28, 25, 54, 0.92);
}

/* ====== 源码模式：行号 + 内容区 ======
   内容与容器间距：左右 60px、上下 5px（与富文本模式一致）。
   文本自动换行（无横向滚动条），因此行号列高度不能按「行号 × 固定行高」算——
   用隐形镜像实测每个逻辑行的渲染高度，行号逐行取该高度，保证像素级对齐。 */
.source-wrap {
  /* 左侧间距：用户反馈上一版留白过大，要求「只要行号不被大纲悬浮按钮遮挡就行」。
     几何约束（实测）：悬浮按钮 34px 宽、left:14px → 占据 x=14..48；
     行号右对齐在行号列内，必须整体落在 x≥48 的区间才不被压住。
     因此最小可行的组合是「让位 48px + 行号列 30px」：正文起点 = 48+30 = 78px，
     比上一版的 112px 明显收窄，同时行号仍在按钮右侧（不再被遮挡）。 */
  --source-outline-reserve: 48px;
  --source-gutter-w: 30px;
  --source-pad-y: 5px;
  --source-font-size: 14px;
  --source-line-height: 22px;
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
  /* 上下 5px 放在滚动容器外层：textarea 自身滚动时其内边距会滚走，
     实测滚动到中间会贴边；放在这里则任何滚动位置都不贴上下边界。 */
  padding: var(--source-pad-y) 0 var(--source-pad-y) var(--source-outline-reserve);
}

/* 镜像：与 textarea 完全同宽、同字体、同换行规则；不可见但参与布局测量 */
.source-mirror {
  position: absolute;
  /* 移出可视区但保留渲染（offsetHeight 需要） */
  left: -99999px;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  box-sizing: border-box;
  /* 宽度由 JS 按 textarea 内容宽度实测设置（换行点必须与 textarea 完全一致）；
     内边距必须与 textarea 完全相同（textarea 已无上下内距），否则量出的行高会偏移 */
  padding: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: var(--source-font-size);
  line-height: var(--source-line-height);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;
}

.source-mirror-line {
  display: block;
}

.source-gutter {
  /* 行号列宽度由 --source-gutter-w 控制（见 .source-wrap 注释里的几何推导）：
     它位于「让位区」之后，因此行号天然落在大纲悬浮按钮右侧，不会被遮挡。
     宽度取 30px 足够放下 3 位数行号，同时把正文起点收窄到合理位置。 */
  flex: 0 0 var(--source-gutter-w);
  box-sizing: border-box;
  overflow: hidden;
  /* 上下内边距已移到 .source-wrap（滚动时不贴边），此处只留右侧间隙 */
  padding: 0 8px 0 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  background: transparent;
  user-select: none;
  scrollbar-width: none;
}

.source-gutter::-webkit-scrollbar { display: none; }

/* 每行高度由 JS 按镜像实测值内联设置（软换行时一行可能占多个屏行） */
.source-gutter-num {
  display: block;
  line-height: var(--source-line-height);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.35);
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: pre;
}

.source-gutter-num.active {
  color: #c4b5fd;
}

.editor-source {
  flex: 1;
  width: 100%;
  min-height: 0;
  box-sizing: border-box;
  /* 右侧保留 24px 呼吸位；左侧间距由 .source-wrap 的让位区 + 行号列共同构成
     （上下 5px 由 .source-wrap 提供，滚动时不贴边） */
  padding: 0 24px 0 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: #cbd5e1;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: var(--source-font-size);
  line-height: var(--source-line-height);
  caret-color: #a78bfa;
  /* 自动换行：不再出现横向滚动条 */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;
  overflow-x: hidden;
}

.editor-source::placeholder {
  color: rgba(203, 213, 225, 0.35);
}

/* ====== 自动保存指示 ====== */
.editor-autosave {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.85);
}

/* ====== 响应式 ====== */
@media (max-width: 768px) {
  .editor-wrap {
    padding: 8px;
    gap: 8px;
  }

  .editor-main {
    gap: 8px;
    flex-direction: column;
  }

  .editor-sidebar {
    width: 100%;
    height: auto;
    flex-shrink: 0;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .editor-sidebar.collapsed {
    width: 40px;
    overflow: hidden;
  }

  .editor-sidebar::-webkit-scrollbar { display: none; }

  .editor-sidebar-inner {
    padding: 8px 12px;
    overflow: visible;
  }

  .editor-sidebar-title { display: none; }

  .editor-sidebar-nav {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
  }

  .editor-sidebar-nav li { margin: 0; white-space: nowrap; }
  .editor-sidebar-nav .nav-l1 a { padding: 4px 10px; font-size: 13px; }
  .editor-sidebar-nav .nav-l2 a { padding: 4px 8px 4px 10px; font-size: 12px; }
  .editor-sidebar-nav .nav-l3 a { padding: 4px 6px 4px 14px; font-size: 11px; }
  /* 移动端横向标签流，不显示层级引导 */
  .editor-sidebar-nav li::before,
  .editor-sidebar-nav a::before,
  .editor-sidebar-nav a::after { display: none; }

  .editor-status-bar { padding: 6px 10px; font-size: 11px; flex-wrap: wrap; gap: 4px; }
  .editor-status-left { gap: 6px; }
}

/* 全屏编辑按钮（状态栏右侧） */
.editor-fs-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(167, 139, 250, 0.4);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}
.editor-fs-btn:hover {
  border-color: rgba(167, 139, 250, 0.6);
  background: rgba(167, 139, 250, 0.12);
  color: #d8b4fe;
}

/* 收起大纲按钮：紫系圆形（重设计） */
.sidebar-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(167, 139, 250, 0.5);
  border-radius: 999px;
  background: rgba(167, 139, 250, 0.15);
  color: #d8b4fe;
  cursor: pointer;
}
.sidebar-toggle-btn:hover {
  background: rgba(167, 139, 250, 0.3);
  color: #ede9fe;
}
.note-text-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: transparent;
}

.note-text-menu {
  position: fixed;
  width: min(340px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  padding: 9px;
  border: 1px solid rgba(196, 181, 253, 0.22);
  border-radius: 15px;
  color: #f4f1ff;
  background: rgba(28, 25, 54, 0.97);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.025) inset;
  backdrop-filter: blur(18px);
  animation: note-text-menu-in 120ms ease-out;
}

.note-media-insert-menu {
  width: min(240px, calc(100vw - 24px));
}

/* 媒体插入尺寸面板 */
.note-media-size-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 20, 0.55);
  backdrop-filter: blur(2px);
}

.note-media-size-dialog {
  width: min(320px, calc(100vw - 32px));
  padding: 16px;
  border: 1px solid rgba(196, 181, 253, 0.22);
  border-radius: 14px;
  background: rgba(28, 25, 54, 0.98);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.note-media-size-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  color: #f4f1ff;
  font-size: 14px;
  font-weight: 650;
}

.note-media-size-meta {
  overflow: hidden;
  max-width: 55%;
  color: rgba(245, 243, 255, 0.5);
  font-size: 11px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-media-size-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.note-media-size-row label {
  flex: 0 0 76px;
  color: rgba(245, 243, 255, 0.75);
  font-size: 12px;
}

.note-media-size-row input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(196, 181, 253, 0.2);
  border-radius: 8px;
  color: #f4f1ff;
  background: rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

.note-media-size-row input:focus {
  border-color: rgba(167, 139, 250, 0.6);
  outline: none;
}

.note-media-size-hint {
  margin: 2px 0 14px;
  color: rgba(245, 243, 255, 0.45);
  font-size: 11px;
  line-height: 1.5;
}

.note-media-size-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.note-text-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 4px 7px;
  color: rgba(245, 243, 255, 0.86);
  font-size: 12px;
  font-weight: 650;
}

.note-text-menu-count {
  padding: 2px 7px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 999px;
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.12);
  font-size: 10px;
  font-weight: 500;
}

.note-text-menu-section-title {
  margin: 8px 3px 6px;
  color: rgba(226, 221, 245, 0.48);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.04em;
}

.note-text-menu-format-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

/* 高亮/文字颜色色板 */
.note-color-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 2px 6px;
  flex-wrap: wrap;
}

.note-color-swatch {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 5px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.note-color-swatch:hover {
  transform: scale(1.16);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
}

.note-color-clear {
  height: 20px;
  padding: 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 5px;
  color: rgba(245, 243, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
  font-size: 11px;
  cursor: pointer;
}

.note-color-clear:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.note-text-menu-format {
  display: flex;
  min-width: 0;
  min-height: 48px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 4px 2px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #e9e4fa;
  background: rgba(255, 255, 255, 0.035);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.note-text-menu-format:hover,
.note-text-menu-format:focus-visible {
  border-color: rgba(167, 139, 250, 0.22);
  outline: none;
  background: rgba(139, 92, 246, 0.16);
}

.note-text-menu-format > :first-child { color: #c4b5fd; font-size: 14px; line-height: 1; }
.note-text-menu-format code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.note-text-menu-format .format-symbol { font-size: 16px; }
.note-text-menu-divider { height: 1px; margin: 9px 2px 6px; background: rgba(255, 255, 255, 0.08); }

.note-text-menu-submenu {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  padding: 6px;
  border: 1px solid rgba(167, 139, 250, 0.16);
  border-radius: 9px;
  background: rgba(10, 9, 25, 0.45);
}

.note-text-menu-submenu button,
.note-text-menu-link-form button {
  min-height: 28px;
  padding: 4px 9px;
  border: 1px solid rgba(167, 139, 250, 0.16);
  border-radius: 7px;
  color: #e9e4fa;
  background: rgba(255, 255, 255, 0.045);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.note-text-menu-submenu button:hover,
.note-text-menu-link-form button:hover { background: rgba(139, 92, 246, 0.2); }

.note-text-menu-link-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 5px;
  margin-top: 7px;
}

.note-text-menu-link-form input {
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 7px;
  outline: none;
  color: #f4f1ff;
  background: rgba(10, 9, 25, 0.65);
  font: inherit;
  font-size: 11px;
}

.note-text-menu-link-form input:focus { border-color: rgba(167, 139, 250, 0.6); }
.note-text-menu-link-form button[type='submit'] { color: #fff; background: rgba(139, 92, 246, 0.55); }
.note-text-menu-link-form button.cancel { color: rgba(226, 221, 245, 0.65); }

.note-text-menu-actions { display: grid; gap: 3px; }

.note-text-menu-action {
  display: flex;
  width: 100%;
  min-height: 43px;
  align-items: center;
  gap: 9px;
  padding: 5px 7px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
}

.note-text-menu-action:hover,
.note-text-menu-action:focus-visible {
  border-color: rgba(167, 139, 250, 0.18);
  outline: none;
  background: rgba(139, 92, 246, 0.16);
}

.note-text-menu-action:active { transform: scale(0.985); }
.note-text-menu-action.compact { min-height: 34px; }
.note-text-menu-action.compact .note-text-menu-icon { width: 23px; height: 23px; font-size: 10px; }
.note-text-menu-action.compact .note-text-menu-label strong { font-size: 11px; }

.note-text-menu-icon {
  display: grid;
  width: 27px;
  height: 27px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.16);
  font-size: 12px;
  font-weight: 700;
}

.note-text-menu-icon.quote { font-size: 18px; }
.note-text-menu-label { display: grid; flex: 1; gap: 2px; }
.note-text-menu-label strong { font-size: 12px; font-weight: 600; }
.note-text-menu-label small { color: rgba(226, 221, 245, 0.48); font-size: 10px; }

.note-text-menu-action kbd {
  padding: 2px 5px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 5px;
  color: rgba(226, 221, 245, 0.48);
  font-family: inherit;
  font-size: 10px;
}

.note-text-menu-hint {
  margin: 5px 4px 0;
  padding-top: 7px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(226, 221, 245, 0.38);
  font-size: 10px;
  text-align: right;
}

@keyframes note-text-menu-in {
  from { opacity: 0; transform: translateY(-3px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ====== 顶部多分页菜单栏 ====== */
.editor-menubar {
  flex-shrink: 0;
  /*
    ⚠️ 必须 min-width:0 + 允许横向收缩。
    用户报告「编辑页三个区域容器与窗口右边界没有间距、直接被遮挡」。
    根因：本元素是 flex 项且 flex-shrink:0，但没有 min-width:0，
    于是它的 **min-content 宽度**（工具栏一整行的最小宽度）成为不可压缩下限。
    全屏编辑时窗口较窄 → 该下限超过可用宽度 → 卡片被撑到父容器之外，
    父级 .np-editor 的 overflow:hidden 再把右侧裁掉，
    看起来就是「卡片右边缘贴住窗口、内容被遮挡」。
    min-width:0 解除该下限，让卡片能收缩到容器宽度内（内部工具栏自己换行/滚动）。
  */
  min-width: 0;
  /* 顶部外边距与反向链接面板共用同一变量，保证两者上边界对齐 */
  margin: var(--editor-outer-gap, 16px) 16px 26px;
  /* 与底部状态栏同款容器质感 */
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 6px 10px 8px;
}

.editor-menubar-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 0 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 6px;
}

.editor-menubar-tab {
  height: 28px;
  padding: 0 14px;
  border: none;
  border-radius: 8px 8px 0 0;
  color: rgba(226, 221, 245, 0.55);
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.editor-menubar-tab:hover {
  color: #ede9fe;
  background: rgba(255, 255, 255, 0.06);
}

.editor-menubar-tab.on {
  color: #d8b4fe;
  background: rgba(139, 92, 246, 0.16);
}

.editor-menubar-page {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0;
  min-height: 30px;
}

.menubar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  color: rgba(226, 221, 245, 0.75);
  background: rgba(255, 255, 255, 0.03);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.14s ease;
  flex-shrink: 0;
}

.menubar-btn:hover:not(:disabled) {
  color: #ede9fe;
  border-color: rgba(167, 139, 250, 0.45);
  background: rgba(139, 92, 246, 0.12);
}

.menubar-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.menubar-btn.on {
  border-color: rgba(167, 139, 250, 0.5);
  color: #d8b4fe;
  background: rgba(139, 92, 246, 0.18);
}

.menubar-heading { font-weight: 700; }
.menubar-heading.mh-1 { color: #93c5fd; }
.menubar-heading.mh-2 { color: #7dd3fc; }
.menubar-heading.mh-3 { color: #a5b4fc; }
.menubar-heading.mh-4 { color: #c4b5fd; }
.menubar-heading.mh-5 { color: #d8b4fe; }
.menubar-heading.mh-6 { color: #f0abfc; }

.menubar-sep {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 4px;
  flex-shrink: 0;
}

/* 帮助分页里的说明文字 */
.menubar-hint {
  font-size: 12px;
  color: rgba(148, 163, 184, 0.8);
  align-self: center;
  padding-left: 2px;
}

.menubar-colors {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 颜色分组：左侧色块（单击即应用）+ 右侧文字下拉（选色） */
.menubar-split {
  display: inline-flex;
  align-items: stretch;
}

.menubar-split .menubar-btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

/* 色块按钮：本身是小方块，但用 padding 撑出可点区域 */
.menubar-swatch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  padding: 0;
  border: 1px solid rgba(196, 181, 253, 0.18);
  border-right: none;
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

/* 色块按钮禁用态（标题内不能加行内样式时）：与 .menubar-btn:disabled 观感一致 */
.menubar-swatch-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.menubar-swatch-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.menubar-swatch-btn.on {
  box-shadow: inset 0 0 0 1px rgba(196, 181, 253, 0.55);
}

.menubar-swatch-btn .menubar-swatch {
  width: 14px;
  height: 14px;
}

/* 颜色下拉：按钮带当前色块 + 箭头 */
.menubar-dropdown {
  gap: 6px;
}

.menubar-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.menubar-caret {
  font-size: 9px;
  opacity: 0.7;
  margin-left: 1px;
}

/* 下拉面板（Element Plus popper 内的自定义内容） */
.menubar-color-panel {
  min-width: 168px;
  padding: 8px;
  background: #1b1736;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
}

.menubar-color-title {
  padding: 2px 6px 8px;
  color: rgba(226, 221, 245, 0.6);
  font-size: 11px;
  font-weight: 600;
}

.menubar-color-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #d7d3e8;
  font-size: 12px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.menubar-color-item:hover {
  background: rgba(139, 92, 246, 0.18);
  color: #f1f5f9;
}

.menubar-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  flex-shrink: 0;
}

.menubar-color-dot.clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(245, 243, 255, 0.7);
  font-size: 10px;
}

.menubar-color-divider {
  height: 1px;
  margin: 6px 4px;
  background: rgba(255, 255, 255, 0.08);
}

/* 块级公式按钮的符号：与行内公式的 Σ 图标区分 */
.menubar-formula-block {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  color: inherit;
}

.menubar-form {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.menubar-form input {
  width: 230px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid rgba(196, 181, 253, 0.22);
  border-radius: 7px;
  color: #f4f1ff;
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}

.menubar-form input:focus {
  border-color: rgba(167, 139, 250, 0.6);
  outline: none;
}

.menubar-form button {
  height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  color: #d8b4fe;
  background: rgba(139, 92, 246, 0.22);
  font-size: 12px;
  cursor: pointer;
}

.menubar-form button.cancel {
  color: rgba(245, 243, 255, 0.55);
  background: rgba(255, 255, 255, 0.06);
}

/* ====== 大纲悬浮（编辑区左上角）====== */
.outline-float {
  position: absolute;
  top: 12px;
  left: 14px;
  z-index: 45;
  display: flex;
  justify-content: flex-start;
}

.outline-float-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(196, 181, 253, 0.28);
  border-radius: 50%;
  color: #c4b5fd;
  background: rgba(28, 25, 54, 0.9);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.outline-float-btn:hover {
  color: #ede9fe;
  border-color: rgba(167, 139, 250, 0.65);
  background: rgba(139, 92, 246, 0.24);
}

/* 悬停展开后：按钮隐藏，由面板接替同一位置（鼠标不会离开 hover 区域） */
.outline-float.open .outline-float-btn {
  opacity: 0;
  transform: scale(0.9);
  pointer-events: none;
}

.outline-float-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: auto;
  width: min(300px, calc(100vw - 48px));
  max-height: min(460px, calc(100vh - 220px));
  overflow-y: auto;
  padding: 10px;
  border: 1px solid rgba(196, 181, 253, 0.22);
  border-radius: 12px;
  background: rgba(28, 25, 54, 0.97);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(16px);
}

.outline-float-head {
  margin-bottom: 8px;
  color: rgba(245, 243, 255, 0.65);
  font-size: 11px;
  font-weight: 650;
}

.outline-float-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.outline-float-list li a {
  display: block;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12.5px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background 0.12s ease;
}

.outline-float-list li a:hover {
  background: rgba(139, 92, 246, 0.16);
}

/* 分级颜色 + 缩进（与正文标题色一致） */
.outline-float-list .ofl-1 a { color: #93c5fd; padding-left: 6px; font-weight: 650; }
.outline-float-list .ofl-2 a { color: #7dd3fc; padding-left: 20px; }
.outline-float-list .ofl-3 a { color: #a5b4fc; padding-left: 34px; }
.outline-float-list .ofl-4 a { color: #c4b5fd; padding-left: 48px; font-size: 12px; }
.outline-float-list .ofl-5 a { color: #d8b4fe; padding-left: 62px; font-size: 12px; }
.outline-float-list .ofl-6 a { color: #f0abfc; padding-left: 76px; font-size: 11.5px; }

.outline-float-empty {
  padding: 8px 6px;
  color: rgba(245, 243, 255, 0.38);
  font-size: 12px;
}

</style>


