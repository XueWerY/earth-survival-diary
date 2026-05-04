# 地球 Online 生存日记

一个帮助记录生活足迹、管理任务清单、专注时间的 Windows 桌面效率应用。

## 功能特性

### 👣 足迹记录

- 时间线视图：按日期查看活动记录
- 足迹的增删改：事件名称、日期、起止时间、备注
- 农历支持：日期选择器显示农历信息

### ⏱️ 专注计时

- 双模式：番茄钟计时和正计时
- 自定义时长：灵活设置专注时间
- 自动记录：专注完成后自动生成足迹
- 常用专注：保存常用事项快速开始
- 系统通知：番茄钟完成提醒、正计时每小时自动提醒

### 📋 清单

- 多清单管理，支持自定义分组
- 任务设置：日期、时间、优先级
- 重复任务：每日/每周/每月/每年/自定义周期
- 检查事项：任务拆解为可勾选项
- 智能列表：今天、已过期、未来七天
- 任务提醒：准时/提前提醒，Windows 系统通知推送

### 🚀 倒数日

- 倒计时管理：创建重要事件的目标日期
- 农历日期：支持农历生日、传统节日等
- 分类管理：自定义分类和图标
- 星标置顶：重要事件优先展示

### 📚 课程表

- 周课表管理：按周查看课程安排
- 课程详情：地点、教师、周次设置
- 自动记录：已结束课程自动写入足迹
- 颜色标识：不同课程使用不同颜色区分

### 📊 统计

- 足迹统计：按日/周/月/年查看时间分布和事项排行
- 专注统计：专注次数、时长、时间分布

### 👤 用户系统

- 账号管理：邮箱注册和登录
- 数据隔离：每个用户独立的数据
- 个人资料：自定义昵称

### 📝 笔记

- 笔记本管理：创建、编辑、删除笔记本
- 双导航栏设计：顶部笔记本导航栏 + 笔记导航栏，层级清晰
- 导航交互：支持鼠标拖拽滚动、自动居中激活项
- 即时渲染编辑：Vditor ir 模式，所见即所得，编辑即预览
- 星空主题：编辑器全面适配深空星空配色
- 自动保存：输入停止 2 秒后自动保存，无需手动操作
- 状态持久化：自动保存当前笔记本和笔记位置

### 🔄 自动更新

- 启动时自动检查新版本
- 发现新版本弹窗提示，前往 GitHub Releases 手动下载
- 我的页面支持手动检查更新

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
| 安装包 | NSIS |

## 数据存储

所有数据存储在 `%APPDATA%/earth-survival-diary/data/` 目录中，用户数据通过 userId 隔离。更新或重装不会影响已有数据。卸载时可选择是否删除。

日志文件存储在 `%APPDATA%/earth-survival-diary/logs/` 目录中，按日轮转（app-YYYY-MM-DD.log）。

### 用户数据内容

每个用户的数据包含：

- 个人资料：昵称、生日
- 足迹记录：活动名称、日期、起止时间、备注
- 任务清单：清单、分组、任务项、检查事项
- 倒数日：事件、目标日期、分类、星标
- 课程表：课程安排、地点、教师、周次
- 专注记录：常用专注事项
- 笔记：笔记本、笔记内容（Markdown 格式）
- 设置项：专注时长、学期信息等应用配置

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
│   │   ├── MissionForm.vue       # 任务表单
│   │   ├── ListFormPage.vue      # 清单表单
│   │   ├── GroupFormPage.vue     # 分组表单
│   │   ├── CountdownList.vue     # 倒数日
│   │   ├── CourseSchedule.vue    # 课程表
│   │   ├── NotesPage.vue         # 笔记
│   │   ├── StatisticsPage.vue    # 统计
│   │   ├── FootprintStats.vue    # 足迹统计
│   │   ├── ProfilePage.vue       # 个人中心（含设置、关于）
│   │   ├── HistoryFootprint.vue  # 历史足迹
│   │   └── LunarDatePicker.vue   # 农历日期选择器
│   ├── stores/               # Pinia 状态管理
│   │   ├── authStore.ts          # 用户认证
│   │   ├── taskStore.ts          # 足迹管理
│   │   ├── focusStore.ts         # 专注管理
│   │   ├── missionStore.ts       # 清单管理
│   │   └── settingsStore.ts      # 设置管理
│   ├── lib/                  # 工具库
│   │   ├── api.ts                # API 客户端
│   │   └── logger.ts             # 日志服务
│   ├── composables/          # 组合式函数
│   │   └── useCourseAutoRecord.ts
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

### 笔记模块

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/notes-notebooks | 获取笔记本列表 |
| POST | /api/notes-notebooks | 添加笔记本 |
| PUT | /api/notes-notebooks/:id | 更新笔记本 |
| DELETE | /api/notes-notebooks/:id | 删除笔记本 |
| GET | /api/notes | 获取笔记列表 |
| POST | /api/notes | 添加笔记 |
| PUT | /api/notes/:id | 更新笔记 |
| DELETE | /api/notes/:id | 删除笔记 |

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

## 更新日志

### v2.32.0 (2026-05)

- 应用关闭日志文本优化：`[DEBUG] [Electron] 应用即将关闭` → `[DEBUG] [Electron] 应用已关闭`
- 课程表设置新增"提前提醒"设置项：可配置上课前多少分钟发送系统通知提醒（1-60分钟）
- 删除"当前学期第 x 周 / 共 y 周"提示文本，精简课程表设置界面
- 提前提醒设置项与前面的设置项之间增加视觉间隔

### v2.31.2 (2026-05)

- 日志系统优化：每次启动应用时在日志文件开头写入分隔标记（`=== 应用启动 ===`），便于区分不同会话的日志
- 日志系统优化：应用关闭前（`before-quit`）写入"应用即将关闭"日志
- 构建流程优化：打包前新增 `pre-clean-release` 步骤，清空 `release/` 目录中的所有文件后再执行构建

### v2.31.1 (2026-05)

- 修复倒数日提醒策略未持久化问题：`loadData` 恢复数据时新增提醒字段的读取映射
- 新增详细日志记录：倒数日加载/保存/添加/编辑操作均记录提醒策略信息

### v2.31.0 (2026-05)

- 我的生日倒数日默认提前1天提醒：新建和已存在的生日倒数日自动设置提前提醒策略

### v2.30.0 (2026-05)

- 倒数日卡片新增提醒文本显示：在目标日期后显示提醒信息（准时提醒/提前X天X小时X分钟），橙色高亮标识
- 正数日（countup 模式）不允许设置提醒：编辑或添加倒数日时切换为正数日自动隐藏提醒策略下拉列表
- 提醒策略仅对倒数日（countdown 模式）生效

### v2.29.0 (2026-05)

- 倒数日模块新增提醒功能：添加或编辑倒数日时可设置不提醒/准时提醒/提前提醒
- 提前提醒支持自定义天数、小时、分钟（最少1分钟），与清单任务提醒策略一致
- 倒数日提醒通过 Windows 系统通知触发，后台定时检查目标日期
- 倒数日表单新增提醒下拉列表，UI 与清单任务表单保持一致

### v2.28.4 (2026-05)

- 任务卡片新增提醒策略文本显示：在结束时间后显示提醒信息（准时提醒/提前X天X小时X分钟），橙色高亮标识

### v2.28.3 (2026-05)

- 修复任务提醒字段未保存问题：后端 POST/PUT API 新增 reminder_strategy、reminder_days、reminder_hours、reminder_minutes 字段的读写支持

### v2.28.2 (2026-05)

- 修复准时提醒未触发问题：扩大提醒检查窗口至1小时，覆盖用户创建任务后立即到期或错过原5分钟窗口的场景

### v2.28.1 (2026-05)

- 修复任务提醒未生效问题：修正时间差判断逻辑，使用毫秒差值精确判断5分钟窗口
- 修复提醒分钟数限制：天数和小时均为0时分钟最小值为1，否则为0

### v2.28.0 (2026-05)

- 清单模块任务新增提醒功能：支持不提醒、准时提醒、提前提醒三种模式
- 提前提醒支持自定义天数、小时、分钟（最少1分钟）
- 提醒通过 Windows 系统通知触发，后台定时检查任务到期情况
- 任务表单新增提醒配置区域，编辑和添加任务时均可设置

### v2.27.0 (2026-05)

- 专注模块新增系统通知功能：番茄钟完成时弹出"专注完成，请放松一下吧"
- 正计时每满 1 小时自动提醒：通知内容"您已累计专注x小时，请放松一下吧"
- 支持页面恢复、取消、完成等场景的通知状态重置，避免重复或遗漏通知

### v2.26.0 (2026-05)

- 笔记模块保存操作新增日志记录：自动保存笔记时通过 `logger.info` 记录保存操作（笔记 ID 和标题）

### v2.25.0 (2026-05)

- 笔记编辑器改为即时渲染模式（ir）：所见即所得，编辑即预览，移除右侧预览区域
- 编辑器全面适配星空主题：工具栏、代码块、引用、表格、标题等元素统一深空配色
- 新增自动保存功能：输入停止 2 秒后自动保存笔记内容，无需手动操作
- 新建笔记改为先填写笔记名称：使用弹窗输入，体验与新建笔记本一致
- 删除按钮移至笔记导航栏，删除当前笔记更便捷
- 移除旧的标题输入框和手动保存逻辑，简化交互

### v2.24.0 (2026-05)

- 笔记模块UI重构：新增笔记导航栏，替换左侧笔记列表侧边栏
- 布局调整：笔记本导航栏 → 笔记导航栏 → 编辑器区域，导航统一在顶部
- 笔记导航栏支持鼠标拖拽滚动、自动居中激活项、响应式状态持久化
- 删除未使用的 `selectNote` 函数及侧边栏相关样式

### v2.23.0 (2026-05)

- 笔记模块新增日志记录：添加笔记本、编辑笔记本、删除笔记本、新建笔记、编辑笔记、删除笔记操作均通过 `logger.info` 记录日志

### v2.22.0 (2026-05)

- 移除笔记模块「分类」层级：笔记本直接作为顶层导航，不再嵌套分类
- 删除分类导航栏 UI、`Category` 接口、`categories` 变量、`selectCategory`/`addCategory`/`handleCatCommand` 函数
- 删除服务端分类 API 路由（GET/POST/PUT/DELETE `/api/notes-categories`）
- 笔记本不再携带 `categoryId` 字段，POST 创建笔记本仅需 `name` 参数
- `onMounted` 初始化逻辑简化，移除 `currentCategoryId` 相关恢复逻辑

### v2.20.0 (2026-05)

- 新增笔记模块后端 API 路由：分类、笔记本、笔记的增删改查（12 个端点）
- 修复添加分类后导航栏不显示的问题：服务端此前缺少 `/api/notes-categories`、`/api/notes-notebooks`、`/api/notes` 路由，前端调用返回 404

### v2.19.0 (2026-05)

- 地球自转动画改为 2D 旋转：`rotateY(360deg)` → `rotate(360deg)`，顺时针平面旋转

### v2.18.0 (2026-05)

- 地球 emoji 🌍 新增顺时针自转动画：使用 `rotateY(360deg)` 实现 3D 翻转效果，周期 12 秒，配合 `translate(-50%, -50%)` 保持居中

### v2.17.0 (2026-05)

- 增大月亮轨道半径：`top: -60px` → `top: -85px`，月亮离地球更远，视觉更协调

### v2.16.0 (2026-05)

- 修复正计时计时中状态月亮不在星轨环内侧的问题：新增 `.moon-orbit-container` 容器负责旋转（`transform-origin: 0 0`），`.emoji-moon` 仅负责定位偏移（`top: -60px; left: 50%; transform: translateX(-50%)`），分离旋转和居中 transform 避免冲突
- 番茄钟计时中状态也统一使用 `.moon-orbit-container` 容器结构
- `stopwatchMoonStyle` 和 `moonOrbitStyle` 统一仅输出 `transform: rotate(...)`，不再包含 `translateY`
- 修复 `animateMoon`：仅在 `running` 状态时请求下一帧，避免 idle 后 rAF 循环继续运行
- 修复 `startMoonAnimation`：移除多余的角度重置，避免恢复计时状态时初始角度被覆盖
- 修复 `watch(focusType)`：确保切换模式时重置月亮角度，idle 状态月亮始终在顶部

### v2.15.0 (2026-05)

### v2.14.5 (2026-05)

- 修复正计时计时中状态月亮不在星轨环内侧的问题
- 修复从页面切换回来恢复正计时状态时月亮动画未启动的问题
- 统一计时中状态的视觉布局：番茄钟和正计时均在星轨环下方显示名称和时间信息

### v2.14.4 (2026-05)

- 修复正计时月亮在外侧的问题：`stopwatchMoonStyle` 轨道半径从 `translateY(-150px)` 改为 `translateY(-80px)`
- 修复正计时月亮不转的问题：`startMoonAnimation()` 移到 `startStopwatch()` 之后调用，确保 `timerState` 和 `startTimestamp` 已就绪

### v2.14.3 (2026-05)

- 月亮轨道移至星轨环内侧：`translateY(-150px)` → `translateY(-80px)`
- 月亮60秒匀速绕地球一圈（已在 v2.14.0 实现，仅调整轨道半径）

### v2.14.2 (2026-05)

- 月亮轨道半径从 `105px` 扩大至 `150px`，避免与星轨环（半径 `110px`）重合

### v2.14.1 (2026-05)

- 正计时计时中状态下方增加时间文本：`名称 : 时间 · 附注`，与番茄钟布局一致
- 删除旧的仅正计时使用的 `.focus-name-display` 区块（标题+附注），统一使用 `.focus-info-inline`
- 时间文本颜色从 `#667eea` 改为 `#82d8e8` 星空青，更适配深空背景

### v2.14.0 (2026-05)

- 正计时视觉改为与番茄钟统一的星轨环样式：60 颗星星全部点亮 + 地球居中 + 月亮公转
- 月亮以 60 秒固定周期匀速公转（与倒计时进度无关），使用 `requestAnimationFrame` 驱动
- idle 状态下正计时也显示星轨环样式

### v2.13.9 (2026-05)

- 彻底修复翻页时钟翻转方向：移除 `.flip-digit-top` 上的 `overflow: hidden`
- 根因：`.flip-digit-top` 作为翻转动画元素，`overflow: hidden` 会将 3D 旋转中超出裁剪区域的部分裁掉，导致用户看到的是"被吸进屏幕"的效果而非向前翻转。`.flip-digit` 父容器已有 `overflow: hidden` 负责裁剪上半/下半区域，子元素无需重复设置

### v2.13.8 (2026-05)

- 翻页时钟翻转方向修正：`rotateX(90deg)` → `rotateX(-90deg)`
- 配合 `perspective(400px)` + `transform-origin: bottom`，`rotateX(-90deg)` 使上半叶从里（近处）向外（远离）翻转，呈现经典翻页钟从上往下翻页效果

### v2.13.7 (2026-05)

- 再次修复翻页时钟翻转方向：将 `perspective(400px)` 直接写入 keyframes 动画内，`rotateX(-90deg)` → `rotateX(90deg)`
- 根因：上一版本将 `perspective` 放在父容器 `.flip-digit` 上，但 CSS 规范中当子元素使用 `overflow: hidden` 且自身有 transform 时，继承的 perspective 可能不生效；将 perspective 写入 transform 属性内联确保 3D 翻转正确

### v2.13.6 (2026-05)

- 修复翻页时钟方向：给 `.flip-digit` 添加 `perspective: 400px` + `backface-visibility: hidden`
- 根因：缺少 CSS `perspective`，`rotateX` 被正交投影渲染为压扁效果，视觉上像是被吸进屏幕而非向前翻转
- 现在上半叶清晰地向前（向观众方向）翻转，呈现经典翻页钟效果

### v2.13.5 (2026-05)

- 翻页时钟方向修正：`rotateX(90deg)` → `rotateX(-90deg)`，上半叶从里向外翻转（经典翻页钟效果）
- 修复完成/取消正计时后时间未归零的问题：`cancelFocus` 和 `completeFocus` 中追加 `timeChars` 重置为 `00:00`

### v2.13.4 (2026-05)

- 修复 idle 状态下星轨环全部点亮的问题（根因：`remainingSeconds=0` 导致 `progress=1`）
- 模式切换按钮移至时钟下方紧贴处（`margin-top: 24px`）
- 翻页时钟动画方向修正：`rotateX(-90deg)` → `rotateX(90deg)`，从上向下翻页
- 翻页时钟重新设计为星空主题配色：冷蓝紫（`#c8d6ff` 数字、`#a4b4ff` 分隔符、`#12102a` 深空背景）

### v2.13.3 (2026-05)

- 专注模块 idle 状态视觉改为与计时中相同的样式
- 选中番茄钟：显示星轨环 + 地球 + 月亮（不计时，星轨环全暗）
- 选中正计时：显示翻页时钟（显示 00:00，无翻转动画）

### v2.13.2 (2026-05)

- 修复取消番茄计时/正计时后切换页面回来仍继续计时的 bug
- 根因：`cancelFocus` 中引用了未声明的 `pausedElapsedSeconds` 导致 ReferenceError，后续清理代码（`clearTimerState` 等）未执行

### v2.13.1 (2026-05)

- 删除三层星空 Canvas 背景及所有相关绘制代码
- 地球和月球改回 emoji 🌍🌙 显示

### v2.13.0 (2026-05)

- 番茄钟视觉系统全新重构：三层星空 Canvas 背景
  - 远星层：220颗极小星点，缓慢绕画面中心旋转
  - 近星层：40颗星点，不规则闪烁 + 十字辉光
  - 星云层：深蓝紫径向渐变叠加
- 星轨环：60颗星星沿圆环排列，按倒计时进度顺时针逐个点亮
  - 点亮的星星呈现亮色并带呼吸光晕动画
  - 星轨环整体 30s 匀速旋转
- 中心 emoji 🌍 带发光呼吸，🌙 沿轨道公转（随倒计时进度改变位置）
- 移除旧的 CSS 地球球体、扇形填充、进度指针等废弃视觉元素

### v2.12.13 (2026-05)

- 番茄钟地球和月球改用纯 CSS 渐变球体设计，不再使用 emoji
- 地球：蓝色径向渐变球体 + 绿色大陆 + 半透明云层，`rotateY` 3D 自转
- 月球：灰褐色径向渐变球体 + 陨石坑点缀，沿轨道公转

### v2.12.12 (2026-05)

- 番茄钟中心地球改为🌍 emoji + `rotateY` 3D 翻转动画（6s循环）
- 删除扇形填充、指针、粒子轨道，改为🌙 emoji 绕地球公转
- 🌙起始位置在正上方（12点方向），按倒计时进度顺时针旋转一周

### v2.12.11 (2026-05)

- 番茄钟去掉圆环，粒子环绕轨道旋转，中心放置自转地球（纯CSS实现）
- 时间文字移至名称右侧，以冒号分隔，附注在下方
- 扇形填充起始位置与指针对齐（均从12点方向顺时针扫过）

### v2.12.10 (2026-05)

- 番茄钟：轨道粒子增至16颗，删除时间下方的名称标签
- 进度展示改为指针扫过扇形区域：指针从12点顺时针扫过，已扫区域以半透明 conic-gradient 填充
- 指针末端带发光圆点，渐变色从白到蓝紫

### v2.12.9 (2026-05)

- "专注"模块视觉美化：Minee4 极简风格 + 星空主题适配
- 番茄钟计时采用增强圆环：渐变轨迹 + glow 滤镜 + 8颗轨道公转粒子 + 星空背景
- 正计时采用翻页时钟：CSS 3D rotateX 翻页动画，暖金色调，冒号闪烁

### v2.12.8 (2026-05)

- "倒数日"和"课程表"模块删除"全部/当天"标题及任务计数行
- 两个模块的"添加"按钮移至导航项更多下拉菜单中

### v2.12.7 (2026-05)

- 删除"专注设置"和"课程表设置"标题前的图标
- "关于"部分版本号和检查更新按钮改为同行展示

### v2.12.6 (2026-05)

- 删除"关于"独立模块，不再打包 README.md
- "我的"模块新增关于部分：展示项目地址、版本号和检查更新按钮
- 移除未使用的依赖：marked、vue-router

### v2.12.5 (2026-05)

- 修复关于模块布局：改用 flex column 布局，导航栏置于底部正常文档流
- 版本号改为构建时内联（`virtual:version`），不再依赖 /api/version 请求
- 内容区 max-width: 900px 居中，窄屏时自适应满宽
- 隐藏 README 中首个 h1（避免与 hero 标题重复）
- 导航栏支持横向滚动（无滚动条），选中项水平居中

### v2.12.4 (2026-05)

- 修复关于模块 README.md 无法显示的问题：构建时将 README.md 内容内联到 JS bundle（虚拟模块 `virtual:readme`），不再依赖运行时文件读取或 API 请求

### v2.12.3 (2026-05)

- 修复关于模块 README.md 无法显示的问题：marked v17+ 的 parse() 改为异步调用，需 await

### v2.12.1 (2026-05)

- 修复关于模块 README.md 无法加载的问题：删除重复的 /api/readme 旧路由（两个同名路由冲突导致响应失败）

### v2.12.0 (2026-05)

- 修复关于模块 README.md 无法加载的问题：README.md 打包至安装目录根（`C:\Program Files\Earth-Survival-Diary\`），服务端从该路径读取
- 移除 build 中的 copy-readme 步骤，不再需要手动复制

### v2.11.9 (2026-05)

- 合并构建脚本：6 个独立脚本统一为 scripts/build-tools.cjs，通过子命令调用
- 新增 `npm run publish-release` 脚本打印 GitHub 发布步骤

### v2.11.8 (2026-05)

- 修复关于模块 README.md 无法显示的问题：构建时自动复制 README.md 到 dist，新增 /api/readme 服务端接口

### v2.11.7 (2026-05)

- Electron 主进程日志改为写入 `%APPDATA%/earth-survival-diary/logs/`，统一格式为 [时间] [级别] 消息

### v2.11.6 (2026-05)

- 修复清单任务重复规则：指定次数模式下少执行一次的问题

### v2.11.5 (2026-05)

- 允许多设备同时登录，移除会话踢出检测逻辑

### v2.11.4 (2026-05)

- 修复 WebSocket 连接失败报错：移除前端无效的 /ws/session 连接（服务端无此端点）
- authStore 精简，移除未使用的 logger 导入

### v2.11.3 (2026-05)

- 日志目录迁移至 `%APPDATA%/earth-survival-diary/logs/`，无需管理员权限即可正常写入
- 取消管理员权限启动要求

### v2.11.2 (2026-05)

- 程序改为以管理员权限启动，修复日志文件无法写入安装目录的问题

### v2.11.1 (2026-05)

- 更新弹窗点击下载按钮后自动关闭，打开系统默认浏览器前往 GitHub Releases

### v2.11.0 (2026-05)

- 取消程序内下载更新，改为提示用户前往 GitHub Releases 手动下载安装包

### v2.10.3 (2026-05)

- 确认日志系统完整实现：登录前后所有日志均写入 C:\Program Files\earth-survival-diary\logs\app-YYYY-MM-DD.log

### v2.10.2 (2026-05)

- 日志系统修复：POST /api/logs 去掉认证限制，未登录时的日志也能正常写入文件；新增 GET /api/logs 返回今日日志

### v2.10.1 (2026-05)

- 确认 .gitignore 已排除安装包大文件，修复 GitHub 同步报错

### v2.10.0 (2026-05)

- NSIS 定制 artifactName，彻底消除安装包文件名中的空格和 %20

### v2.9.0 (2026-05)

- 安装包文件名空格改连字符，避免 %20 被 GitHub 处理为 .

### v2.8.0 (2026-05)

- 安装包文件名中文改英文，修复 URL 编码不一致导致更新下载失败

### v2.7.1 (2026-05)

- 修正 publish.url 分支名 master→main，修复 latest.yml 404 导致更新检查失败

### v2.7.0 (2026-05)

- 日志目录改为 C:\Program Files\earth-survival-diary\logs，格式优化为 [时间] [级别] 消息

### v2.6.0 (2026-05)

- 日志系统改为文件写入：logs/app-yyyy-mm-dd.log，每日轮转

### v2.5.0 (2026-05)

- 修复日志系统：prod-server 补充缺失的 /api/logs 路由

### v2.4.0 (2026-05)

- 修正仓库地址为 XueWerY/earth-survival-diary，修复更新检查 404 问题

### v2.3.0 (2026-05)

- 安装包下载从 raw 直链改为 GitHub Releases，修复更新检查失败问题

### v2.2.0 (2026-05)

- 代码仓库和安装包分发从 Gitee 迁移至 GitHub

### v2.1.0 (2026-05)

- 安装包超过 Gitee Releases 单个附件 100MB 限制，下载地址改为仓库 raw 文件直链

### v2.0.0 (2026-05)

- 移除 Web 模式和 Electron 开发模式，专注 Windows 桌面应用
- 精简项目结构和构建脚本
- 更新界面改为独立窗口
- 用户数据迁移至 `%APPDATA%` 独立存储

### v1.1.4 (2026-05)

- 修复安装后无法加载前端页面的问题

### v1.1.3 (2026-05)

- 修复更新/重装时 data 目录被删除的问题，用户数据移至 `%APPDATA%` 独立存储
- 首次启动自动迁移旧版 data 目录
- 卸载时可选择是否删除用户数据

### v1.1.2 (2026-05)

- fix-latest-yml.cjs 已集成到构建命令，构建时自动生成 Gitee Releases 下载地址

### v1.1.1 (2026-05)

- 修复 Gitee raw 下载大文件 403 问题，改用 Gitee Releases 分发安装包
- 新增 `fix-latest-yml.cjs` 脚本自动生成发布用 latest.yml

### v1.1.0 (2026-05)

- 新增 Electron 桌面应用自动更新功能
- 重构数据目录结构
- 简化 API 接口
- 修复安装后程序图标变黑的问题
- 修复开学日期设置无法保存的问题

### v1.0.0 (2026-04)

- 首个正式版本
- 足迹记录、专注计时、清单管理、倒数日、课程表、统计功能
- 用户系统：邮箱注册/登录、数据隔离
- Electron 桌面应用支持

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
