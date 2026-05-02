# 地球 Online 生存日记

一个帮助记录生活足迹、管理任务清单、专注时间的个人效率应用。

项目地址：[https://gitee.com/firefly3/earth-survival-diary](https://gitee.com/firefly3/earth-survival-diary)

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

### 📋 清单

- 多清单管理，支持自定义分组
- 任务设置：日期、时间、优先级
- 重复任务：每日/每周/每月/每年/自定义周期
- 检查事项：任务拆解为可勾选项
- 智能列表：今天、已过期、未来七天

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

### 🔄 自动更新

- 启动时自动检查新版本
- 后台静默下载，下载完成后提示重启安装
- 手动检查更新入口

## 技术栈

| 类型     | 技术                        |
| ------ | ------------------------- |
| 前端框架   | Vue 3 + TypeScript        |
| 构建工具   | Vite                      |
| UI 组件库 | Element Plus              |
| 状态管理   | Pinia                     |
| 日期处理   | Day.js + lunar-javascript |
| 图表     | ECharts                   |
| 后端服务   | Express                   |
| 数据存储   | 本地文件存储                  |
| 桌面应用   | Electron + electron-updater |
| 实时通信   | WebSocket                 |

## 数据存储

所有数据存储在本地 JSON 文件中（`data/` 目录），用户数据通过 userId 隔离。

### 用户数据内容

每个用户的数据包含：

- 个人资料：昵称、生日
- 足迹记录：活动名称、日期、起止时间、备注
- 任务清单：清单、分组、任务项、检查事项
- 倒数日：事件、目标日期、分类、星标
- 课程表：课程安排、地点、教师、周次
- 专注记录：常用专注事项
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
│   │   ├── StatisticsPage.vue    # 统计
│   │   ├── FootprintStats.vue    # 足迹统计
│   │   ├── ProfilePage.vue       # 个人中心（含设置）
│   │   ├── AboutPage.vue         # 关于
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
├── server/
│   ├── index.js              # Express 服务器
│   └── local-storage.js      # 本地存储适配器
├── electron/
│   ├── main.cjs              # Electron 主进程
│   ├── preload.cjs           # 预加载脚本（IPC 桥接）
│   └── prod-server.cjs       # 生产环境内嵌服务器
├── scripts/                  # 构建与发布脚本
├── public/                   # 静态资源
├── data/                     # 本地数据目录
└── logs/                     # 日志目录
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm

### 安装依赖

```bash
pnpm install
```

### Web 模式

```bash
# 开发模式（前端 + 后端）
pnpm dev:all

# 仅启动前端
pnpm dev

# 仅启动后端
pnpm server

# 构建生产版本
pnpm build

# 预览生产版本
pnpm preview
```

### Electron 桌面应用

```bash
# 开发模式
pnpm electron:dev

# 打包 Windows 应用
pnpm electron:build:win
```

## API 接口

### 认证模块

| 方法   | 路径                        | 说明     |
| ---- | ------------------------- | ------ |
| POST | /api/auth/signup          | 用户注册   |
| POST | /api/auth/signin          | 用户登录   |
| POST | /api/auth/signout         | 用户登出   |
| POST | /api/auth/change-email    | 修改邮箱   |
| POST | /api/auth/change-password | 修改密码   |
| GET  | /api/auth/user            | 获取当前用户 |
| POST | /api/auth/check-session   | 检查会话   |

### 资料模块

| 方法  | 路径           | 说明     |
| --- | ------------ | ------ |
| GET | /api/profile | 获取个人资料 |
| PUT | /api/profile | 更新个人资料 |

### 足迹模块

| 方法     | 路径             | 说明     |
| ------ | -------------- | ------ |
| GET    | /api/tasks     | 获取足迹列表 |
| POST   | /api/tasks     | 添加足迹   |
| PUT    | /api/tasks/:id | 更新足迹   |
| DELETE | /api/tasks/:id | 删除足迹   |

### 清单模块

| 方法     | 路径                                         | 说明     |
| ------ | ------------------------------------------ | ------ |
| GET    | /api/mission-lists                         | 获取清单列表 |
| POST   | /api/mission-lists                         | 添加清单   |
| PUT    | /api/mission-lists/:id                     | 更新清单   |
| PUT    | /api/mission-lists/reorder                 | 清单排序   |
| DELETE | /api/mission-lists/:id                     | 删除清单   |
| POST   | /api/mission-lists/:listId/groups          | 添加分组   |
| PUT    | /api/mission-lists/:listId/groups/:groupId | 更新分组   |
| PUT    | /api/mission-lists/:listId/groups/reorder  | 分组排序   |
| DELETE | /api/mission-lists/:listId/groups/:groupId | 删除分组   |
| GET    | /api/missions                              | 获取任务列表 |
| POST   | /api/missions                              | 添加任务   |
| PUT    | /api/missions/:id                          | 更新任务   |
| DELETE | /api/missions/:id                          | 删除任务   |

### 通用数据接口

| 方法     | 路径                     | 说明   |
| ------ | ---------------------- | ---- |
| GET    | /api/data/:type/:key   | 获取数据 |
| POST   | /api/data/:type/:key   | 保存数据 |
| DELETE | /api/data/:type/:key   | 删除数据 |

### 设置模块

| 方法  | 路径            | 说明   |
| --- | ------------- | ---- |
| GET | /api/settings | 获取设置 |
| PUT | /api/settings | 更新设置 |

### 日志模块

| 方法   | 路径        | 说明   |
| ---- | --------- | ---- |
| POST | /api/logs | 写入日志 |
| GET  | /api/logs | 获取日志 |

### 其他接口

| 方法  | 路径           | 说明   |
| --- | ------------ | ---- |
| GET | /api/stats   | 获取统计 |
| GET | /api/health  | 健康检查 |
| GET | /api/version | 版本信息 |

## 更新日志

### v1.1.1 (2026-05)

- 修复 Gitee raw 下载大文件 403 问题，改用 Gitee Releases 分发安装包
- 新增 `fix-latest-yml.cjs` 脚本自动生成发布用 latest.yml

### v1.1.0 (2026-05)

- 新增 Electron 桌面应用自动更新功能（基于 electron-updater + Gitee Releases）
- 重构数据目录结构为 `<userId>/<type>/<key>.json`
- 简化 API 接口：通用数据接口路径变为 `/api/data/:type/:key`
- 修复安装后程序图标变黑的问题
- 修复开学日期设置无法保存的问题
- 将 npm 依赖安装从应用启动移至安装阶段

### v1.0.0 (2026-04)

- 首个正式版本
- 足迹记录、专注计时、清单管理、倒数日、课程表、统计功能
- 用户系统：邮箱注册/登录、数据隔离
- Electron 桌面应用支持

## License

MIT