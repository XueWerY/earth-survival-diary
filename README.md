# 🌍 地球 Online 生存日记

> 以「地球 Online 玩家」的身份管理生活，3D 可视化呈现你的生存轨迹。

一款将游戏化概念融入日常时间管理的跨平台应用。记录足迹、管理任务、专注计时、规划课程 — 所有数据存储在本地，隐私安全可控。

## ✨ 功能模块

| 模块 | 说明 |
|------|------|
| 👣 足迹记录 | 记录每日活动与日记 |
| 📝 笔记 | 自研 Markdown 编辑器，支持幻灯片放映 |
| ⏱️ 专注计时 | 番茄钟与正计时，完成后自动生成足迹 |
| 📋 清单 | 智能清单与任务管理 |
| 🚀 倒数日 | 重要日期追踪 |
| 📚 课程表 | 教学周与节次管理 |
| 📊 统计 | ECharts 图表展示时间分布 |
| 🧰 工具箱 | 实用小工具集合 |
| 🔌 插件系统 | 可扩展的插件支持 |

## 🔌 插件市场

应用内置社区插件市场，可在工具箱页面查看与安装。插件列表托管在独立仓库：[XueWerY/plugin-marketplace](https://github.com/XueWerY/plugin-marketplace)

## 🖥️ 支持平台

- **Windows** — Electron 桌面端
- **Android** — Capacitor 移动端

## 🛠️ 技术栈

- **框架**：Vue 3 + TypeScript + Pinia + Vue Router
- **UI**：Element Plus + 深色星空主题
- **3D 可视化**：Three.js（NASA 卫星纹理地球、月球、太阳）
- **图表**：ECharts
- **桌面端**：Electron + electron-updater 自动更新
- **移动端**：Capacitor
- **构建**：Vite

## 🚀 快速开始

```bash
# 环境要求
# Node.js 18+  &  pnpm

# 安装依赖
pnpm install

# 浏览器端开发（调试 UI）
npx vite

# Electron 桌面端开发
pnpm build
npx electron electron/main.cjs

# 构建 Windows 安装包
pnpm electron:build:win
```

## 📁 项目结构

```
earth-survival-diary/
├── src/                  # Vue 前端源码
│   ├── components/       #   按模块组织的组件
│   ├── stores/           #   Pinia 状态管理
│   ├── router/           #   路由配置
│   ├── services/         #   存储服务
│   ├── lib/              #   工具库（API、日志、文件系统）
│   └── plugins/          #   插件系统
├── electron/             # Electron 主进程
├── android/              # Android (Capacitor)
├── scripts/              # 构建脚本
├── public/               # 静态资源
├── build/                # 图标资源
└── 项目规范.html         # 开发规范文档
```

## 🔒 数据存储

所有数据存储在用户本地设备，按用户 ID 隔离，不上传任何服务器。存储路径：

- **Electron**：`%APPDATA%/earth-survival-diary/data/`
- **Android**：应用本地存储

## 📄 许可

[LICENSE](./LICENSE)
