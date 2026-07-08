/**
 * 默认笔记内容（项目规范 & 使用指南）
 *
 * 首次安装应用时自动创建这两个笔记。
 * 通过 DEFAULT_NOTES_VERSION 版本号控制内容更新：版本号提升后，已有用户也会自动更新。
 */
import type { NotePage } from '../stores/noteStore'

// 默认笔记内容版本号（每次修改笔记内容时递增，已有用户会自动更新）
export const DEFAULT_NOTES_VERSION = 1

let _idCounter = 0
const genPageId = () => 'p_def_' + Date.now().toString(36) + '_' + (_idCounter++)

// ====== 项目规范笔记 ======

export function createProjectSpecPages(): NotePage[] {
  const pages: NotePage[] = []

  // 封面
  pages.push({ id: genPageId(), title: '封面', level: 1, type: 'cover', content: '' })

  // 一、项目概述
  pages.push({
    id: genPageId(),
    title: '一、项目概述',
    level: 1,
    content: `<p><strong>地球 Online 生存日记</strong>是一款跨平台生活管理应用，将地球 Online 的游戏化概念融入日常时间管理，帮助玩家（用户）记录足迹、管理任务、专注计时、规划课程，并在 3D 地球可视化中呈现生存轨迹。</p>
<h3>核心定位</h3>
<ul><li>跨平台支持：Windows 桌面端、Android、HarmonyOS、浏览器</li><li>游戏化体验：以"地球 Online 玩家"的身份管理生活</li><li>3D 可视化：Three.js 渲染地球、月球、太阳及流星粒子</li><li>本地优先：数据存储在用户本地，支持多用户隔离</li></ul>
<h3>功能模块</h3>
<p>应用包含足迹记录、笔记、专注计时、清单、倒数日、课程表、统计、工具箱、插件系统等功能模块，覆盖日常生活管理的各个方面。</p>`
  })

  // 二、开发环境配置
  pages.push({
    id: genPageId(),
    title: '二、开发环境配置',
    level: 1,
    content: `<h3>基础环境</h3>
<ul><li>Node.js（建议 18+）</li><li>pnpm（包管理器）</li><li>TypeScript 5.8+</li></ul>
<h3>安装依赖</h3>
<pre><code>pnpm install</code></pre>
<h3>开发调试</h3>
<ul><li>Web 开发服务器：<code>pnpm dev</code></li><li>Electron 开发：<code>pnpm electron:dev</code></li><li>HarmonyOS 同步：<code>pnpm harmony:sync</code></li></ul>
<h3>注意事项</h3>
<ul><li>Electron 的 node_modules 需单独安装到 electron/ 目录</li><li>HarmonyOS 构建需先执行 <code>pnpm harmony:build</code> 同步代码</li><li>Android 构建需通过 Android Studio 打开 android/ 目录</li></ul>`
  })

  // 三、项目目录结构
  pages.push({
    id: genPageId(),
    title: '三、项目目录结构',
    level: 1,
    content: `<pre><code>earth-survival-diary/
├── src/                    # 前端源码
│   ├── components/         # Vue 组件（按模块组织）
│   │   ├── auth/           # 认证页面
│   │   ├── common/         # 通用组件（导航、卡片、弹窗、选择器）
│   │   ├── countdown/      # 倒数日
│   │   ├── course/         # 课程表
│   │   ├── focus/          # 专注计时
│   │   ├── footprint/      # 足迹记录
│   │   ├── list/           # 清单
│   │   ├── notes/          # 笔记
│   │   ├── profile/        # 个人中心
│   │   ├── statistics/     # 统计
│   │   └── toolbox/        # 工具箱
│   ├── composables/        # 组合式函数
│   ├── data/               # 静态数据（引导步骤、默认笔记）
│   ├── lib/                # 工具库（API、存储、日志、文件系统）
│   ├── plugins/            # 插件系统
│   ├── router/             # 路由配置
│   ├── services/           # 存储服务
│   ├── stores/             # Pinia 状态管理
│   ├── App.vue             # 根组件
│   └── main.ts             # 入口文件
├── electron/               # Electron 主进程
├── android/                # Android (Capacitor)
├── harmony/                # HarmonyOS
├── scripts/                # 构建工具脚本
├── build/                  # 图标资源
├── CHANGELOG.md            # 更新日志
└── package.json            # 项目配置</code></pre>`
  })

  // 四、技术架构
  pages.push({
    id: genPageId(),
    title: '四、技术架构',
    level: 1,
    content: `<h3>前端框架</h3>
<ul><li>Vue 3 + Composition API + TypeScript</li><li>Pinia 状态管理</li><li>Vue Router 路由</li><li>Element Plus UI 组件库</li></ul>
<h3>3D 可视化</h3>
<ul><li>Three.js 渲染地球、月球、太阳</li><li>NASA 真实卫星图片作为纹理</li><li>Canvas 流星粒子动画（z-index 低于 Three.js 元素）</li><li>MeshPhongMaterial 须包含 fallback 颜色 (0x2a6f97) 防止纹理加载失败黑屏</li></ul>
<h3>跨平台</h3>
<ul><li>Electron：Windows 桌面端，内置 Express HTTP 服务器</li><li>Capacitor：Android 平台</li><li>HarmonyOS：ArkWeb 引擎，需特殊处理 esbuild IIFE 打包</li></ul>
<h3>编辑器与图表</h3>
<ul><li>Vditor：笔记编辑器</li><li>ECharts：统计图表</li><li>lunar-javascript：农历日期计算</li></ul>`
  })

  // 五、编码规范
  pages.push({
    id: genPageId(),
    title: '五、编码规范',
    level: 1,
    content: `<h3>基本原则</h3>
<ul><li>用最少的代码解决问题，不编写多余内容</li><li>仅改动必要内容，不擅自优化周边代码</li><li>遵循原有代码风格（缩进、命名、导入方式）</li><li>不开发需求以外的额外功能</li><li>单次使用的代码不做抽象封装</li></ul>
<h3>修改规则</h3>
<ul><li>只清理自身修改产生的冗余</li><li>不擅自删除原本就存在的无用代码</li><li>删除本次修改后不再使用的导入语句、变量、函数</li><li>不对运行正常的代码进行重构</li><li>不对不可能出现的场景编写异常处理逻辑</li></ul>
<h3>验证原则</h3>
<p>将任务转化为可验证的目标，完成后进行验证。对于多步骤任务，列出执行计划。</p>`
  })

  // 六、UI/UX 规范
  pages.push({
    id: genPageId(),
    title: '六、UI/UX 规范',
    level: 1,
    content: `<h3>视觉风格</h3>
<ul><li>深色星空背景主题，渐变色系（#0f0c29 → #302b63 → #24243e）</li><li>主色调：#667eea（蓝紫渐变）</li><li>强调色：#fbbf24（琥珀色，用于置顶/重要标识）</li><li>文字颜色使用 rgba 白色透明度梯度</li></ul>
<h3>布局规范</h3>
<ul><li>模块间使用面包屑地址栏导航，支持下拉快速切换</li><li>卡片网格布局，响应式列数（最多 6 列）</li><li>支持分屏显示（左右双面板）</li></ul>
<h3>交互规范</h3>
<ul><li>卡片右上角 hover 显示操作按钮（编辑/删除）</li><li>下拉菜单使用固定定位 + backdrop-filter 模糊背景</li><li>确认操作使用 ConfirmDialog 组件</li><li>消息提示使用 ElMessage</li></ul>
<h3>3D 场景层级</h3>
<p>Canvas 元素（流星画布）的 z-index 必须低于 Three.js 元素（地球、月球、太阳），避免遮挡。</p>`
  })

  // 七、组件使用规范
  pages.push({
    id: genPageId(),
    title: '七、组件使用规范',
    level: 1,
    content: `<h3>组件组织</h3>
<ul><li>组件按功能模块组织在 src/components/ 下</li><li>通用组件放在 common/ 下（nav、card、overlay、picker）</li><li>每个模块的页面组件以 Page 结尾命名（如 NotesPage.vue）</li></ul>
<h3>常用组件</h3>
<ul><li><strong>MainNav</strong>：全局底部导航栏</li><li><strong>ReminderCard</strong>：提醒卡片（每 5 秒弹出一张）</li><li><strong>ConfirmDialog</strong>：确认弹窗（v-model:visible 控制）</li><li><strong>ColorPickerPanel</strong>：颜色选择面板（位于 picker/ 目录）</li><li><strong>GuideOverlay</strong>：新手引导遮罩层</li></ul>
<h3>选择器组件</h3>
<ul><li>DateScrollPicker / InlineLunarDatePicker：日期选择</li><li>TimePickerPopover / ReminderTimePicker：时间选择</li><li>PeriodCountPicker：周期计数选择</li></ul>`
  })

  // 八、版本控制策略
  pages.push({
    id: genPageId(),
    title: '八、版本控制策略',
    level: 1,
    content: `<h3>版本号格式</h3>
<p>版本号格式为 <strong>YYYY.M.DD-X</strong>，其中：</p>
<ul><li>YYYY：年份（4 位）</li><li>M：月份（不补零，如 5 月写 5 不写 05）</li><li>DD：日期（不补零）</li><li>X：当日第 X 次发布（从 1 开始递增）</li></ul>
<p>示例：<code>2026.7.8-1</code> 表示 2026 年 7 月 8 日第 1 次发布。</p>
<h3>CHANGELOG 规范</h3>
<ul><li>更新日志添加在 CHANGELOG.md 顶部（标题行下方）</li><li>格式：### v&lt;版本号&gt; (&lt;日期&gt;)</li><li>描述使用非程序员也能看懂的语言</li></ul>
<h3>发布流程</h3>
<ol><li>在 package.json 中更新 version 字段</li><li>在使用指南笔记中反映本次修改内容</li><li>在 CHANGELOG.md 顶部添加更新日志条目</li><li>如涉及基础性约定，同步更新项目规范笔记</li><li>如涉及插件更新，更新插件版本号</li></ol>`
  })

  // 九、构建与部署规范
  pages.push({
    id: genPageId(),
    title: '九、构建与部署规范',
    level: 1,
    content: `<h3>Windows 构建</h3>
<pre><code>pnpm electron:build:win</code></pre>
<p>该命令依次执行：清理 release → vite build → 安装 Electron 依赖 → 生成图标 → electron-builder 打包 → 修复 latest.yml → 清理。</p>
<h3>HarmonyOS 构建</h3>
<pre><code>pnpm harmony:build</code></pre>
<p>先执行 vite build，再通过 harmony-sync.cjs 同步到鸿蒙工程。需注意：</p>
<ul><li>esbuild IIFE 中的 import.meta.url 需后处理替换</li><li>Vite __vitePreload 机制需跳过 JS 预加载，仅保留 CSS</li></ul>
<h3>Android 构建</h3>
<p>通过 Android Studio 打开 android/ 目录，执行 Gradle 构建。</p>
<h3>发布</h3>
<pre><code>pnpm publish-release</code></pre>
<p>发布到 GitHub generic provider，通过 electron-updater 实现自动更新。</p>`
  })

  // 十、插件系统
  pages.push({
    id: genPageId(),
    title: '十、插件系统',
    level: 1,
    content: `<h3>插件结构</h3>
<p>插件位于 src/plugins/ 目录下，每个插件包含：</p>
<ul><li>index.ts：插件入口</li><li>plugin.json：插件元数据（名称、版本、描述）</li><li>tools/：插件工具目录，每个工具有独立的 Vue 组件</li></ul>
<h3>内置插件</h3>
<ul><li><strong>file-manager</strong>：文件管理器（含 HTTP 服务器）</li><li><strong>random-number</strong>：随机数生成器</li><li><strong>reminder-viewer</strong>：提醒查看器</li></ul>
<h3>插件加载</h3>
<p>通过 pluginLoader.ts 动态加载插件，工具箱页面展示已安装的插件列表。</p>`
  })

  // 十一、数据管理
  pages.push({
    id: genPageId(),
    title: '十一、数据管理',
    level: 1,
    content: `<h3>存储架构</h3>
<ul><li>Electron 端：通过 Express HTTP 服务器 + 本地文件系统（YAML 后端）</li><li>Capacitor 端（Android/HarmonyOS）：本地 localStorage 存储</li><li>数据按用户 ID 隔离，路径为 data/&lt;用户ID&gt;/&lt;类型&gt;/&lt;键&gt;</li></ul>
<h3>系统状态</h3>
<p>SystemState 存储在 system/state 中，包含各模块的状态字段。defaultsInitialized 标记是否已初始化默认数据，defaultNotesVersion 标记默认笔记（项目规范、使用指南）的内容版本，版本号提升时自动更新已有用户的笔记内容。</p>
<h3>默认笔记</h3>
<p>首次安装时系统自动创建「项目规范」和「使用指南」两篇笔记（位于"学习"分类、置顶），内容定义在 src/data/defaultNotes.ts 中。通过 DEFAULT_NOTES_VERSION 版本号控制内容更新。</p>
<h3>关键数据路径</h3>
<ul><li>窗口分辨率设置：data/&lt;用户ID&gt;/settings/settings.json</li><li>清单收藏和快速访问：data/&lt;用户ID&gt;/list/ 目录</li><li>笔记数据：data/&lt;用户ID&gt;/notes/notes.json</li><li>笔记分类：data/&lt;用户ID&gt;/notes/categories.json</li></ul>
<h3>缓存机制</h3>
<p>storageService 使用内存缓存（Map）减少重复请求，clearCache() 可清除缓存。</p>`
  })

  // 致谢
  pages.push({ id: genPageId(), title: '致谢', level: 1, type: 'thanks', content: '' })

  return pages
}

// ====== 使用指南笔记 ======

export function createUserGuidePages(): NotePage[] {
  const pages: NotePage[] = []

  // 封面
  pages.push({ id: genPageId(), title: '封面', level: 1, type: 'cover', content: '' })

  // 功能特性（L1，作为 L2 子页面的父页面）
  const featuresPageId = genPageId()
  pages.push({
    id: featuresPageId,
    title: '功能特性',
    level: 1,
    content: `<p>地球 Online 生存日记提供丰富的生活管理功能，每个模块都围绕"记录、规划、专注"的理念设计。</p>
<p>点击左侧目录中的各功能模块，了解详细使用方法。</p>`
  })

  // L2 子页面：各功能模块
  pages.push({
    id: genPageId(),
    title: '👣 足迹记录',
    level: 2,
    parentId: featuresPageId,
    content: `<p>足迹模块用于记录每日的活动行为和用时，按时段（上午/下午/晚上）分组展示。</p>
<h3>核心功能</h3>
<ul><li>农历日期选择器：默认显示当前周，可展开查看整月日历</li><li>添加足迹：记录活动名称、时间段、备注</li><li>添加日记：书写每日文字记录</li><li>双击快捷编辑：足迹名称和备注支持双击直接编辑</li></ul>
<h3>使用方法</h3>
<ol><li>选择日期（默认今天）</li><li>点击"添加足迹"按钮</li><li>填写活动名称、起止时间、备注</li><li>保存后足迹会按时段分组显示</li></ol>`
  })

  pages.push({
    id: genPageId(),
    title: '📝 笔记',
    level: 2,
    parentId: featuresPageId,
    content: `<p>笔记模块支持多页面笔记，提供编辑、预览、放映三种模式，适合记录结构化内容。</p>
<h3>核心功能</h3>
<ul><li>分类管理：支持自定义分类（颜色、图标）</li><li>多页面笔记：每篇笔记可包含多个页面，支持一级/二级/三级层级</li><li>封面页和致谢页：特殊页面自动生成大纲</li><li>面包屑导航：点击">"下拉快速切换分类和笔记</li><li>收藏与快速访问：可将常用视图收藏</li><li>排序：按更新时间、创建时间、标题排序</li><li>导出 HTML：将笔记导出为可在浏览器打开的 HTML 文件，保留页面层级</li><li>导入 HTML：在笔记首页面包屑栏点击导入按钮，从导出的 HTML 文件还原笔记</li><li>放映模式：全屏幻灯片展示，支持键盘和触摸操作</li></ul>
<h3>默认笔记</h3>
<p>首次安装应用时，系统自动创建「项目规范」和「使用指南」两篇笔记（位于"学习"分类），帮助用户了解项目和使用方法。笔记内容会随版本更新自动更新。</p>
<h3>页面层级</h3>
<ul><li>一级页面：主章节（编号 1, 2, 3...）</li><li>二级页面：子章节（编号 1.1, 1.2...）</li><li>三级页面：孙章节（编号 1.1.1...）</li><li>封面页和致谢页不参与编号</li></ul>`
  })

  pages.push({
    id: genPageId(),
    title: '⏱️ 专注计时',
    level: 2,
    parentId: featuresPageId,
    content: `<p>专注模块提供番茄钟和正计时两种模式，帮助你保持专注。</p>
<h3>核心功能</h3>
<ul><li>番茄钟模式：固定时长倒计时（默认 25 分钟）</li><li>正计时模式：自由计时，手动停止</li><li>星轨环动画：专注进行时的视觉反馈</li><li>常用专注：保存常用专注事项，快速选择</li><li>自动生成足迹：专注完成后自动记录到足迹</li><li>专注统计：查看专注时长统计</li></ul>
<h3>使用方法</h3>
<ol><li>输入专注事项名称（必填）</li><li>可选：添加备注</li><li>点击"开始专注"</li><li>专注完成后自动保存并生成足迹记录</li></ol>`
  })

  pages.push({
    id: genPageId(),
    title: '📋 清单',
    level: 2,
    parentId: featuresPageId,
    content: `<p>清单模块提供智能清单和自定义文件夹管理任务，支持分组、优先级、重复任务等。</p>
<h3>核心功能</h3>
<ul><li>智能清单：今天、已过期、未来七天自动筛选</li><li>自定义文件夹和清单：层层深入管理</li><li>分组管理：清单下可创建多个分组</li><li>任务属性：日期、时间、优先级、备注、检查事项</li><li>重复任务：支持按天/周/月/农历重复</li><li>提醒功能：提前提醒（分钟/小时/天）</li><li>面包屑导航：下拉快速切换清单</li><li>收藏与快速访问：常用视图收藏</li></ul>
<h3>数据持久化</h3>
<p>清单模块的收藏和快速访问数据持久化到 data/&lt;用户ID&gt;/list/ 目录下。</p>`
  })

  pages.push({
    id: genPageId(),
    title: '🚀 倒数日',
    level: 2,
    parentId: featuresPageId,
    content: `<p>倒数日模块帮你追踪重要日期，系统会自动生成常见节日倒数日。</p>
<h3>核心功能</h3>
<ul><li>分类管理：生日、纪念日、节日、旅行等</li><li>自动节日：系统自动生成重要节日倒数日</li><li>倒数/累计：支持倒数（距离还有几天）和累计（已过几天）</li><li>置顶：重要倒数日可置顶显示</li><li>面包屑导航：下拉快速切换分类</li></ul>`
  })

  pages.push({
    id: genPageId(),
    title: '📚 课程表',
    level: 2,
    parentId: featuresPageId,
    content: `<p>课程表模块按教学周和节次管理课程，支持周视图查看。</p>
<h3>核心功能</h3>
<ul><li>教学周切换：左右箭头切换周次</li><li>节次管理：在"我的"页面配置节次时间</li><li>课程属性：名称、地点、教师、颜色、周次</li><li>多周次选择：一门课可分布在多个周次</li><li>空数组表示全部周：weeks 为空表示该课程在所有周都有</li></ul>
<h3>课程提醒卡片</h3>
<p>上课时间根据第 1 节开始时间、每节时长、课间休息、午休、晚休和课表节数动态计算。提醒卡片每 5 秒弹出一张（与桌面端一致）。</p>`
  })

  pages.push({
    id: genPageId(),
    title: '📊 统计',
    level: 2,
    parentId: featuresPageId,
    content: `<p>统计模块通过图表展示足迹和专注数据，帮助你了解时间分布。</p>
<h3>核心功能</h3>
<ul><li>日期范围筛选：自定义统计时间段</li><li>足迹统计：按时段、日期统计活动分布</li><li>专注统计：专注时长、次数趋势图</li><li>ECharts 可视化：折线图、饼图、柱状图</li></ul>`
  })

  pages.push({
    id: genPageId(),
    title: '🧰 工具箱',
    level: 2,
    parentId: featuresPageId,
    content: `<p>工具箱汇集了实用小工具和已安装的插件。</p>
<h3>核心功能</h3>
<ul><li>数据工具：导出数据、导入数据、清理数据</li><li>插件列表：查看和使用已安装的插件</li><li>工具卡片：点击即可打开使用</li></ul>`
  })

  pages.push({
    id: genPageId(),
    title: '🧩 插件系统',
    level: 2,
    parentId: featuresPageId,
    content: `<p>插件系统支持扩展应用功能，插件位于 src/plugins/ 目录下。</p>
<h3>内置插件</h3>
<ul><li>文件管理器：含 HTTP 服务器功能</li><li>随机数生成器：生成随机数字</li><li>提醒查看器：查看所有提醒</li></ul>
<h3>插件结构</h3>
<p>每个插件包含 index.ts 入口、plugin.json 元数据、tools/ 工具目录。通过工具箱页面可访问插件功能。</p>`
  })

  pages.push({
    id: genPageId(),
    title: '👤 用户系统',
    level: 2,
    parentId: featuresPageId,
    content: `<p>用户系统支持多用户隔离，每个用户的数据独立存储。</p>
<h3>核心功能</h3>
<ul><li>注册/登录：邮箱 + 密码认证</li><li>个人信息：昵称、生日管理</li><li>账号安全：修改密码、手机号绑定</li><li>桌面端设置：开机自启、关闭行为</li><li>数据隔离：每个用户数据存储在独立目录</li></ul>`
  })

  pages.push({
    id: genPageId(),
    title: '🔄 自动更新',
    level: 2,
    parentId: featuresPageId,
    content: `<p>Windows 桌面端支持自动更新，通过 electron-updater 实现。</p>
<h3>核心功能</h3>
<ul><li>自动检查更新：启动时自动检查</li><li>手动检查：在"我的"页面点击"检查更新"</li><li>更新日志：查看版本变更记录</li><li>后台下载：下载完成后提示安装</li></ul>
<h3>注意事项</h3>
<ul><li>CapacitorHttp 请求无默认超时，需同时设置 connectTimeout/readTimeout 并用 Promise.race 加 JS 层超时兜底</li><li>Android 和 HarmonyOS 需通过应用商店或手动安装更新</li></ul>`
  })

  pages.push({
    id: genPageId(),
    title: '🧭 新手引导',
    level: 2,
    parentId: featuresPageId,
    content: `<p>新手引导帮助新用户快速了解各功能模块的使用方法。</p>
<h3>核心功能</h3>
<ul><li>首次启动自动播放：注册后首次进入应用自动启动引导</li><li>分模块引导：足迹、笔记、专注、清单、倒数日、课程表、统计、工具箱、我的</li><li>高亮提示：引导步骤高亮目标区域并显示说明</li><li>随时重新查看：在"我的"页面可重新打开引导</li></ul>
<h3>操作方式</h3>
<ul><li>点击"下一步"继续引导</li><li>点击"上一步"回看</li><li>点击"跳过"结束引导</li></ul>`
  })

  // 技术栈
  pages.push({
    id: genPageId(),
    title: '技术栈',
    level: 1,
    content: `<h3>前端</h3>
<ul><li>Vue 3 + TypeScript + Composition API</li><li>Pinia 状态管理</li><li>Vue Router 路由</li><li>Element Plus UI 组件库</li><li>Vditor 笔记编辑器</li><li>ECharts 统计图表</li><li>Three.js 3D 可视化</li><li>lunar-javascript 农历计算</li></ul>
<h3>跨平台</h3>
<ul><li>Electron：Windows 桌面端</li><li>Capacitor：Android</li><li>HarmonyOS：鸿蒙原生</li></ul>
<h3>构建工具</h3>
<ul><li>Vite 构建</li><li>electron-builder 打包</li><li>esbuild（HarmonyOS IIFE 打包）</li></ul>`
  })

  // 数据存储
  pages.push({
    id: genPageId(),
    title: '数据存储',
    level: 1,
    content: `<h3>存储方式</h3>
<ul><li>Windows 桌面端：本地文件系统（YAML 后端），通过 Express HTTP 服务器读写</li><li>Android / HarmonyOS：本地 localStorage 存储</li><li>浏览器：通过 API 请求存储到服务端</li></ul>
<h3>数据隔离</h3>
<p>每个用户的数据存储在独立目录：data/&lt;用户ID&gt;/</p>
<h3>用户数据内容</h3>
<ul><li>足迹记录（task）</li><li>笔记和分类（notes）</li><li>专注记录（focusTimer）</li><li>清单和任务（list）</li><li>倒数日（countdown）</li><li>课程表（course）</li><li>系统设置和状态（system）</li></ul>`
  })

  // 致谢
  pages.push({ id: genPageId(), title: '致谢', level: 1, type: 'thanks', content: '' })

  return pages
}

// 获取默认笔记内容（JSON 字符串）
export function getProjectSpecNoteContent(): string {
  return JSON.stringify({ pages: createProjectSpecPages() })
}

export function getUserGuideNoteContent(): string {
  return JSON.stringify({ pages: createUserGuidePages() })
}
