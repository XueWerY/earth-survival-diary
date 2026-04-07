# 地球 Online 生存日记

一个帮助记录生活足迹、规划目标、管理时间的个人效率应用。

## 功能特性

### 🎯 任务清单
- 多清单管理，支持自定义分组
- 任务设置：日期、时间、优先级
- 重复任务：每日/每周/每月/每年/自定义周期
- 检查事项：任务拆解为可勾选项
- 完成机制：非重复任务自动清理，重复任务自动进入下一轮

### 👣 足迹记录
- 时间线视图：按日期/周/月/年查看活动
- 统计分析：自动生成活动时长统计和分类饼图
- 筛选功能：支持时间范围和活动类型筛选
- 日记导出：一键复制日记格式文本
- 农历支持：日期选择器显示农历信息

### 🚀 倒数日
- 倒计时管理：创建重要事件的目标日期
- 农历日期：支持农历生日、传统节日等
- 分类管理：自定义分类和图标
- 星标置顶：重要事件优先展示
- 智能分组：按时间自动分为进行中、即将到来、未来展望、时光印记

### 📚 课程表
- 周课表管理：按周查看课程安排
- 课程详情：地点、教师、周次设置
- 自动记录：已结束课程自动写入足迹
- 颜色标识：不同课程使用不同颜色区分

### ⏱️ 专注计时
- 双模式：番茄钟计时和正向计时
- 自定义时长：灵活设置专注时间
- 自动记录：专注完成后自动生成足迹
- 常用专注：保存常用事项快速开始
- 统计分析：查看专注次数和时长统计

### 📝 笔记
- Markdown 编辑器：基于 Vditor，支持实时预览
- 丰富格式：代码高亮、表格、数学公式
- 分类管理：自定义笔记分类
- 全文搜索：快速定位笔记内容
- 自动保存：编辑时自动保存草稿

### 👤 用户系统
- 账号管理：邮箱注册和登录
- 数据隔离：每个用户独立的数据文件
- 个人资料：自定义昵称和头像
- 安全机制：单点登录，异地登录自动踢出

## 技术栈

| 类型 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript |
| 构建工具 | Vite |
| UI 组件库 | Element Plus |
| 状态管理 | Pinia |
| 日期处理 | Day.js + lunar-javascript |
| Markdown | Vditor |
| 图表 | ECharts |
| 后端服务 | Express |
| 数据存储 | YAML 文件存储 |

## 快速开始

### 环境要求
- Node.js 18+
- pnpm 8+

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 同时启动前端和后端
pnpm run dev:all

# 或分别启动
pnpm run dev      # 前端（默认 5173 端口）
pnpm run server   # 后端（默认 5000 端口）
```

访问 http://localhost:5000

### 生产部署

```bash
# 构建
pnpm run build

# 启动服务
pnpm start
```

## 数据存储

数据以 YAML 文件格式存储在 `data/` 目录，无需数据库配置。

### 目录结构

```
data/
├── users.yaml           # 用户索引（邮箱、密码哈希、用户ID）
└── user_{userId}.yaml   # 用户数据文件（每人独立）
```

### 用户数据内容

每个用户的数据文件包含：
- 个人资料：昵称、头像、生日
- 足迹记录：活动时间和分类
- 任务清单：清单、分组、任务项
- 笔记数据：分类和笔记内容
- 课程表：课程安排
- 设置项：应用配置、快捷键绑定

### 数据备份

直接复制 `data/` 目录即可完成备份，恢复时放回原位置即可。

## 项目结构

```
├── src/
│   ├── components/           # Vue 组件
│   │   ├── AuthPage.vue          # 登录/注册
│   │   ├── MissionList.vue       # 任务清单
│   │   ├── TaskList.vue          # 足迹记录
│   │   ├── CountdownList.vue     # 倒数日
│   │   ├── CourseSchedule.vue    # 课程表
│   │   ├── FocusTimer.vue        # 专注计时
│   │   ├── NoteList.vue          # 笔记
│   │   ├── ProfilePage.vue       # 个人中心
│   │   ├── SettingsPage.vue      # 设置
│   │   ├── AboutPage.vue         # 关于
│   │   └── LunarDatePicker.vue   # 农历日期选择器
│   ├── stores/               # Pinia 状态管理
│   │   ├── authStore.ts          # 用户认证
│   │   ├── missionStore.ts       # 任务管理
│   │   ├── taskStore.ts          # 足迹管理
│   │   ├── noteStore.ts          # 笔记管理
│   │   └── settingsStore.ts      # 设置管理
│   ├── lib/                  # 工具库
│   │   └── api.ts                # API 客户端
│   ├── composables/          # 组合式函数
│   │   └── useCourseAutoRecord.ts
│   ├── services/             # 服务层
│   │   └── storageService.ts
│   └── types/                # TypeScript 类型
├── server/
│   └── index.js              # Express 服务器
├── data/                     # 数据存储目录
├── public/                   # 静态资源
└── scripts/                  # 脚本文件
```

## API 接口

### 认证模块
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/signup | 用户注册 |
| POST | /api/auth/signin | 用户登录 |
| POST | /api/auth/signout | 用户登出 |
| GET | /api/auth/user | 获取当前用户 |

### 足迹模块
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks | 获取足迹列表 |
| POST | /api/tasks | 添加足迹 |
| PUT | /api/tasks/:id | 更新足迹 |
| DELETE | /api/tasks/:id | 删除足迹 |

### 笔记模块
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/note-categories | 获取笔记分类 |
| POST | /api/note-categories | 添加分类 |
| PUT | /api/note-categories/:id | 更新分类 |
| DELETE | /api/note-categories/:id | 删除分类 |
| GET | /api/notes | 获取笔记列表 |
| GET | /api/notes/:id | 获取笔记详情 |
| POST | /api/notes | 添加笔记 |
| PUT | /api/notes/:id | 更新笔记 |
| DELETE | /api/notes/:id | 删除笔记 |

### 任务模块
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/mission-lists | 获取任务清单 |
| POST | /api/mission-lists | 添加清单 |
| PUT | /api/mission-lists/:id | 更新清单 |
| DELETE | /api/mission-lists/:id | 删除清单 |
| GET | /api/missions | 获取任务列表 |
| POST | /api/missions | 添加任务 |
| PUT | /api/missions/:id | 更新任务 |
| DELETE | /api/missions/:id | 删除任务 |

### 通用接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/data/:key | 获取数据 |
| POST | /api/data/:key | 保存数据 |

## 更新日志

### v1.4.0
- 关于模块：智能读取 README.md 并展示，无需手动同步内容

### v1.3.0
- 关于模块：新增独立关于页面，展示项目说明、功能特性、技术栈和更新日志
- 移动端适配：检测移动端竖屏时显示横屏提示，提升移动端使用体验
- 导航栏优化：增加“关于”入口，调整导航顺序

### v1.2.0
- 农历支持：全局日期选择器支持农历显示
- 统一侧边栏：所有模块侧边栏统一折叠交互
- 深色主题优化：完善 Element Plus 组件深色主题适配
- 设置页面：展示项目说明文档
- 统计功能：足迹统计和专注统计按钮位置优化
- 样式修复：修复字数统计、下拉菜单等白色背景问题

### v1.1.0
- 笔记模块：Markdown 编辑器、分类管理、全文搜索、自动保存

### v1.0.0
- 用户系统：注册、登录、数据隔离
- 任务清单：清单、分组、检查事项、重复任务
- 足迹记录：时间线、统计图表
- 倒数日：倒计时、农历支持
- 课程管理：周课表、自动记录
- 专注计时：番茄钟、自动记录

## License

MIT
