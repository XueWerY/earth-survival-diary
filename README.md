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
- 提醒弹窗：番茄钟完成和正计时每小时休息均通过右下方悬浮弹窗提醒，不支持自动关闭，已接入统一提醒调度系统

### 📋 清单

- 多清单管理，支持自定义分组
- 任务设置：日期、时间、优先级
- 重复任务：每日/每周/每月/每年/自定义周期
- 检查事项：任务拆解为可勾选项
- 智能列表：今天、已过期、未来七天
- 任务提醒：支持截止时间提醒和提前提醒，右下角弹窗带提示音

### 🚀 倒数日

- 倒计时管理：创建重要事件的目标日期，支持倒数日和正数日两种模式
- 农历日期：支持农历生日、传统节日等
- 分类管理：自定义分类和图标，支持分类的添加、编辑、删除和排序
- 星标置顶：重要事件优先展示
- 节日倒数日：元旦、春节、元宵、清明、端午、七夕、中元、中秋、重阳、腊八、小年、除夕等二十余个常见节日自动生成，农历节日精确计算，过期自动顺延至明年
- 提醒功能：支持准时提醒和提前提醒，已接入统一提醒调度系统
- 操作导航栏：编辑分类、添加分类、删除分类、左移/右移分类、添加倒数日等快捷操作

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
