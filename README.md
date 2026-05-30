# 地球 Online 生存日记

一个帮助记录生活足迹、管理任务清单、专注时间的桌面与移动端效率应用。

## 功能特性

### 👣 足迹记录

- **内联农历日期选择器**：页面顶部始终显示日历面板，每个日期下方展示农历（含节气、节日）；收起状态自动展示选中日期所在周；选中和今日日期以加粗彩色突出显示（无背景框）。选择器与下方卡片展示区之间间隔 16px
- 卡片展示区（含倒数日、正数日、上午/下午时段、日记）整体宽度 500px 水平居中，无背景框无内边距
- 滑动交互：下滑展开完整月份视图，上滑收起为单行；左右滑动切换周或月份
- 日期跳转弹窗：三列滚动选择器（年/月/日），支持公历/农历切换，带回到今日按钮
- 快捷记录：日期选择器标题行分为左右两个区域——左侧展示年月标题文本、右侧放置跳转日期、添加足迹和添加日记三个快捷按钮。选择器与下方标题行间距 16px
- 记录卡片和日记卡片支持双击快捷编辑：双击标题修改名称，记录卡片时间行分为"开始时间 - 结束时间"点击弹出滚轮时分选择器（纯文本无背景框，时间文字使用高对比度白色半透明），双击备注区域可直接编辑备注，无备注卡片显示"双击添加备注"提示。每张卡片右侧保留圆形删除按钮。删除确认弹窗 300px 宽
- 时间线视图：按日期查看活动记录、清单任务和课程，按结束时间排序
- 记录卡片显示时长标签（共xx小时xx分钟），不足1小时不显示小时数
- 足迹的增删改：事件名称、日期、起止时间、备注
- 今日总结文本与界面下边界保持 16px 固定间距
- 时间选择器默认显示当前时间，选中后加粗并高亮为蓝色
- **公历/农历双历法**：DateScrollPicker 滚轮日期选择器支持公历和农历切换，农历模式下显示中文月份和日期（节气优先），弹窗底部“回到今日”、“取消”、“保存”按钮居中排列
- 清单任务展示：对应日期的清单任务直接显示在足迹页面，保留编辑、移动、删除、检查事项和备注全部功能，已完成任务名称前显示对钩
- 日记卡片：开始结束时间都不填时为日记卡片，显示创建时间。支持双击名称和备注进行快捷编辑，右侧显示圆形删除按钮
- 卡片数据收集系统：切换日期后自动查询倒数日、正数日、清单任务和课程，生成对应卡片
- 课程展示：今日课程直接显示在足迹页面，课程名称保留颜色，显示上课地点和教师

### ⏱️ 专注计时

- 番茄钟计时与正计时两种模式，切换按钮和开始专注按钮都是图标加文字样式，开始按钮放在输入框下方居中
- 星轨环视觉动画，性能优化后安卓端流畅运行
- 自定义时长：灵活设置专注时间
- 自动记录：专注完成后自动生成足迹
- 常用专注：保存常用事项快速开始
- 取消/完成按钮：计时中显示的取消和完成按钮采用图标加文字样式，与切换按钮风格统一
- 提醒弹窗：番茄钟完成后通过右下方悬浮弹窗提醒，已接入统一提醒调度系统

### 📋 清单

- **全局导航栏**：顶部（桌面端）或底部（安卓端）显示八个功能模块的导航栏（👣足迹、🧘专注、📋清单、⏳倒数日、📖课程表、📊统计、🧰工具箱、👤我的），宽度 500px 水平居中，与上下内容区间距 16px，图标在上、描述文字在下纵向排列，当前所在模块以白色加粗文字标识（无高亮背景框），点击即可快速切换。切换模块时自动清空前一个模块的状态并交由新模块自行恢复浏览位置，确保页面按钮和内容正确加载。导航项鼠标悬停不显示提示文字
- **独立面包屑导航**：清单页面和倒数日页面各有独立的面包屑地址栏，宽度为页面宽度的 80%，水平居中并与顶部导航栏保持间距，格式为"模块图标 > 智能清单/文件夹名 > 清单名 > 分组名"，所有文本段使用对应颜色渲染——智能清单为紫色、文件夹和清单/分组使用其 color 属性、智能清单子项（今天/已过期/未来七天）分别使用绿色/红色/蓝色
- **下拉列表交互**：面包屑中每个 `>` 均可点击弹出下拉列表——弹出对应层级的列表（带颜色标记），点击项即可跳转
- **导航栏自适应**：小屏幕设备上导航栏支持左右滑动浏览，选中的导航项自动滚动到屏幕中间
- **页面操作按钮**：清单和倒数日页面在各自面包屑地址栏右侧显示添加按钮
- **导航状态验证**：恢复浏览位置时严格验证路径是否属于当前模块，防止错误状态导致页面空白
- **调试日志支持**：清单页面及相关模块（usePageNav、missionStore、CountdownList、TaskList、App.vue）已添加完整的 debug 级别日志，方便定位页面渲染和导航状态问题，可通过浏览器控制台查看详细执行流程
- **内容区布局**：使用 `el-scrollbar` 包裹内容，通过 `:deep()` 样式确保滚动区域正确填充父容器高度，`__view` 设置 `min-height: 100%` 保证内容撑满视口，与足迹页面布局一致

### 🚀 倒数日

- 倒计时管理：创建重要事件的目标日期，支持倒数日和正数日两种模式
- 农历日期：支持农历生日、传统节日等
- 分类管理：首页以卡片形式展示所有分类（与文件夹卡片统一布局），桌面端三列、移动端单列，80% 宽度水平居中。"全部"分类卡片优先展示，默认选中可查看所有倒数日和正数日
- 独立面包屑导航：倒数日页面有独立面包屑地址栏，宽度80%水平居中，支持下拉列表切换分类，与下方卡片区保持16px间距
- 星标置顶：重要事件优先展示，系统自动生成的倒数日仅生日和使用天数为默认星标
- 节日倒数日：元旦、春节、元宵、清明、端午、七夕、中元、中秋、重阳、腊八、小年、除夕等二十余个常见节日自动生成，农历节日精确计算，过期自动顺延至明年
- 提醒功能：支持准时提醒和提前提醒，已接入统一提醒调度系统；卡片上点击提醒文本可快速设置
- 重复策略：新增/编辑倒数日时支持设置"不重复"或"重复"（仅倒数日支持，正数日不适用），公历日期按每年重复，农历日期按农历年重复；卡片上点击重复文本可一键切换。系统自动创建的节日、生日等默认设为每年重复，修改日期或重复策略后自动重新调度提醒
- 快捷编辑：双击卡片名称区域可直接修改名称（多行文本），点击"日历图标+日期文本"弹出滚轮式农历日期选择器修改日期，双击描述区域可添加或编辑描述。卡片按钮默认隐藏，鼠标悬浮时显示。页面完整隐藏了滚动条（包括 Element Plus 组件自带的竖向和横向滑块），滚动功能不受影响
- 新增/编辑弹窗：宽度固定400px，标题居中无关闭图标，表单标签区80px宽确保"目标日期"等四字标签完整显示在一行，底部按钮为图标胶囊样式。正数日模式下不显示重复策略和提醒设置选项
- navPath 导航：使用共享全局导航栏，支持分类切换下拉列表

### 📚 课程表

- 周视图网格：按节次和星期划分的网格视图，整周课程一目了然，表头同时显示周几和日期
- 网格合并：跨越多个节次的课程自动合并显示，全周课程全选时合为一整行（含节次标签）
- 单击操作：单击空白网格添加课程，单击课程卡片编辑课程，悬停空白处显示加号图标
- 课程卡片：显示课程名、地点、教师、备注和节次起止时间，文字支持多行显示，全周卡片水平垂直居中
- 多天上课：编辑课程时支持选择多个上课日（周一~周日七选多）和多个节次
- 午休/晚休：上午最后一节与下午第一节之间显示午休过渡区域，下午最后一节与晚上第一节之间显示晚休过渡区域
- 课表节数设置：在课程表页面左上角设置按钮打开的弹窗中可分别设置上午、下午和晚上的节数（滚轮选择器，每列范围1-10，显示3个待选项）
- 午休/晚休时长设置：在课程表设置弹窗中可设置午休和晚休的时长（分钟数）
- 课间休息时长支持统一和自由两种模式：统一模式所有课间使用相同分钟数，自由模式可为每两节课之间分别设置不同休息时长
- 智能节次计算：所有节次的起止时间完全根据设置中的第1节开始时间、每节时长、课间休息时长（统一/自由）、课表节数（上午/下午/晚上）、午休时长和晚休时长自动动态生成，无需手动编辑节次；在课程表设置弹窗中修改任意设置后，课程表页面的节次信息立即自动同步更新
- 非本周课程显示：开启"显示非本周课程"后，课程卡片上会显示对应的周次信息
- 智能数据存储：课程使用节次编号数组存储，修改设置后网格自动更新，无需手动调整
- 40色颜色选择器：与清单文件夹颜色选择器同款，支持自定义颜色输入
- 删除课程和节次使用自定义确认弹窗，显示在编辑弹窗上方清晰可见
- 周次切换：左右箭头切换周次，周次和日期范围居中显示于导航栏下方

### 📊 统计

- 五合一统计面板：在一个页面同时查看足迹、专注、清单、倒数日和课程表五大模块的使用情况
- 滚轮农历日期选择器：支持公历和农历自由切换选择开始和结束日期，默认统计从注册当天到今天
- 图标胶囊重置按钮：一键恢复默认统计范围
- 足迹统计：日记数和记录数分开计算，日均日记数和日均记录数，总时长；每日日记数趋势柱状图和每日记录数趋势柱状图分别展示
- 专注统计：常用专注数、专注次数、总时长、番茄钟与正计时数量、每日专注时长趋势
- 清单统计：清单数量、任务数量、已完成数量和完成率、优先级分布、每日完成任务数趋势；已完成任务持久化到 JSON 文件，不怕丢失
- 倒数日统计：所有分类（含 0 计数的分类）均展示，每类同时显示倒数日数量与正数日数量，彩色双段柱形图区分
- 课程表统计：课程总数、授课天数、总节次数、每周课程分布
- 智能趋势图：不超过 7 天按日展示（标签显示完整日期），超过 7 天按周汇总（标签显示起止日期范围）；点击日期标签可直接切换统计范围到该时间段

### 🧰 工具箱

- 插件小工具：汇集社区开发者提供的小工具，点击卡片即可打开使用
- 插件管理：查看已安装插件列表及其功能覆盖情况（页面改造、存储规则、小工具）

### 🧩 插件系统

- 页面重构：社区开发者可创建同名组件覆盖任意模块的默认页面，系统优先使用插件版本
- 数据持久化规则：开发者可创建任意名称的 Store 文件自由制定数据持久化逻辑
- 小工具开发：开发者可创建独立小工具，系统自动加载并展示在工具箱页面
- 内置存储管理插件：提供导出数据、导入数据、清空日志和清理数据四个小工具

### 👤 用户系统

- 账号管理：邮箱注册和登录
- 数据隔离：每个用户独立的数据
- 每日起始时间：设置每天从几点开始算新的一天（默认4点）

### 🔄 自动更新

- 启动时自动检查新版本
- 发现新版本弹窗提示，前往 GitHub Releases 手动下载
- 我的页面支持手动检查更新

### 🧭 新手引导

- 自动引导：首次登录后自动弹出引导教程，逐页介绍各模块功能
- 视觉指引：目标区域高亮，引导卡片固定于窗口右下角
- 操作保护：引导期间自动禁用非引导项操作，防止误触
- 随时重看：在我的页面"关于"中可随时重新查看教程

## 技术栈

| 类型 | 技术 |
|---|---|
| 前端框架 | Vue 3 + TypeScript |
| 构建工具 | Vite |
| UI 组件库 | Element Plus |
| 状态管理 | Pinia |
| 日期处理 | Day.js + lunar-javascript |
| 图表 | ECharts |
| 后端服务 | Express (内嵌) |
| 数据存储 | 本地 JSON 文件 |
| 桌面应用 | Electron + electron-updater |
| 移动应用 | Capacitor |
| 安装包 | NSIS |

## 数据存储

**桌面版（Windows）**：所有数据存储在 `%APPDATA%/earth-survival-diary/data/` 目录中，通过内嵌 Express 服务器读写 JSON 文件。用户数据通过 userId 隔离。更新或重装不会影响已有数据。卸载时可选择是否删除。桌面窗口默认大小为 1280×720。

**安卓版**：与桌面版使用完全相同的路径化 JSON 文件结构存储数据，通过 Capacitor Filesystem 插件直接读写设备本地的 JSON 文件，无需联网，所有操作在设备端完成。卸载应用会清除数据。

日志文件存储在 `%APPDATA%/earth-survival-diary/logs/` 目录中，按日轮转（app-YYYY-MM-DD.log）。

### 用户数据内容

每个用户的数据包含：

- 个人资料：昵称、生日
- 足迹记录：活动名称、日期、起止时间、备注
- 任务清单：清单、分组、任务项、检查事项
- 倒数日：事件、目标日期、分类、星标
- 课程表：课程安排、地点、教师、周次
- 专注记录：常用专注事项
- 设置项：专注时长、学期信息、第1节开始时间、每节时长、课间休息时长、课表节数设置（上午/下午/晚上节数）、周末显示开关、非本周课程显示开关等应用配置

## 项目结构

```
├── src/
│   ├── components/           # Vue 组件
│   │   ├── AuthPage.vue          # 登录/注册
│   │   ├── TaskList.vue          # 足迹记录
│   │   ├── TaskForm.vue          # 足迹表单
│   │   ├── FocusTimer.vue        # 专注计时
│   │   ├── FocusStats.vue        # 专注统计
│   │   ├── MissionList.vue       # 清单
│   │   ├── MissionCard.vue       # 可复用任务卡片组件
│   │   ├── MissionForm.vue       # 任务表单
│   │   ├── ListFormPage.vue      # 清单表单
│   │   ├── GroupFormPage.vue     # 分组表单
│   │   ├── CountdownList.vue     # 倒数日
│   │   ├── CourseSchedule.vue    # 课程表
│   │   ├── StatisticsPage.vue    # 统计
│   │   ├── FootprintStats.vue    # 足迹统计
│   │   ├── ProfilePage.vue       # 个人中心（含设置、关于）
│   │   ├── HistoryFootprint.vue  # 历史足迹
│   │   ├── LunarDatePicker.vue   # 农历日期选择器
│   │   └── ToolboxPage.vue       # 工具箱（插件小工具）
│   ├── stores/               # Pinia 状态管理
│   │   ├── authStore.ts          # 用户认证
│   │   ├── taskStore.ts          # 足迹管理
│   │   ├── focusStore.ts         # 专注管理
│   │   ├── missionStore.ts       # 清单管理
│   │   └── settingsStore.ts      # 设置管理
│   ├── lib/                  # 工具库
│   │   ├── api.ts                # API 客户端
│   │   ├── pluginLoader.ts       # 插件加载器（各插件 index.ts 的聚合入口）
│   │   ├── chalk.ts              # 文本颜色常量
│   │   └── logger.ts             # 日志服务
│   ├── composables/          # 组合式函数
│   │   └── useRecurringMissions.ts # 周期性任务管理
│   ├── plugins/              # 插件目录（每个子目录一个插件，含 index.ts 入口）
│   │   ├── sample-plugin/        # 示例插件（字符计数器）
│   │   ├── storage-manager/      # 存储管理插件（导出/导入/清空日志/清理数据）
│   │   └── random-number/        # 随机数生成器插件
│   ├── services/             # 服务层
│   │   └── storageService.ts
│   └── types/                # TypeScript 类型
│       └── electron.d.ts
├── electron/
│   ├── main.cjs              # Electron 主进程
│   ├── preload.cjs           # 预加载脚本（IPC 桥接）
│   ├── update.html           # 更新进度独立窗口
│   └── prod-server.cjs       # 生产环境内嵌服务器
├── scripts/                  # 构建、图标、安装脚本
├── public/                   # 静态资源
└── build/                    # 构建资源（图标等）
```

## 构建 Windows 应用

### 环境要求

- Node.js >= 18
- pnpm

### 安装依赖

```
pnpm install
```

### 打包

```
# 构建 Windows 安装包
pnpm electron:build:win
```

构建完成后，安装包输出在 `release/` 目录下。

## 构建 Android 应用

### 环境要求

- Node.js >= 18
- pnpm
- Android Studio（用于编译 APK）

### 开发调试

```
# 构建 Web 资源并同步到 Android 项目
pnpm build && npx cap sync

# 在 Android Studio 中打开项目
npx cap open android
```

在 Android Studio 中连接设备或启动模拟器，点击 Run 即可。

### 构建 APK

在 Android Studio 中选择 Build → Build Bundle(s) / APK(s) → Build APK(s)。

构建完成后，APK 输出在 `android/app/build/outputs/apk/` 目录下。

## API 接口

### 认证模块

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/auth/signup | 用户注册 |
| POST | /api/auth/signin | 用户登录 |
| POST | /api/auth/signout | 用户登出 |
| POST | /api/auth/change-email | 修改邮箱 |
| POST | /api/auth/change-password | 修改密码 |
| GET | /api/auth/user | 获取当前用户 |
| POST | /api/auth/check-session | 检查会话 |

### 资料模块

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/profile | 获取个人资料 |
| PUT | /api/profile | 更新个人资料 |

### 足迹模块

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/tasks | 获取足迹列表 |
| POST | /api/tasks | 添加足迹 |
| PUT | /api/tasks/:id | 更新足迹 |
| DELETE | /api/tasks/:id | 删除足迹 |

### 清单模块

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/mission-lists | 获取清单列表 |
| POST | /api/mission-lists | 添加清单 |
| PUT | /api/mission-lists/:id | 更新清单 |
| PUT | /api/mission-lists/reorder | 清单排序 |
| DELETE | /api/mission-lists/:id | 删除清单 |
| POST | /api/mission-lists/:listId/groups | 添加分组 |
| PUT | /api/mission-lists/:listId/groups/:groupId | 更新分组 |
| PUT | /api/mission-lists/:listId/groups/reorder | 分组排序 |
| DELETE | /api/mission-lists/:listId/groups/:groupId | 删除分组 |
| GET | /api/missions | 获取任务列表 |
| POST | /api/missions | 添加任务 |
| PUT | /api/missions/:id | 更新任务 |
| DELETE | /api/missions/:id | 删除任务 |

### 通用数据接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/data/:type/:key | 获取数据 |
| POST | /api/data/:type/:key | 保存数据 |
| DELETE | /api/data/:type/:key | 删除数据 |

### 设置模块

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/settings | 获取设置 |
| PUT | /api/settings | 更新设置 |

### 日志模块

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/logs | 写入日志 |
| GET | /api/logs | 获取日志 |

### 其他接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/stats | 获取统计 |
| GET | /api/health | 健康检查 |
| GET | /api/version | 版本信息 |

## License

MIT License

Copyright (c) 2026 XueWerY

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
