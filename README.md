# 🌍 地球 Online 生存日记

一款将游戏化概念融入日常时间管理的 Windows 桌面应用。版本：`2026.10.18-1`。Electron 桌面端账号和业务数据保存在本机 YAML 文件中。

## ✨ 功能模块

- **足迹与任务**：记录日常事项、完成状态与时间。
- **笔记**：使用 Milkdown 编辑器整理笔记和标签，清单中的关联笔记预览与编辑器内容样式保持一致。
  - **富文本格式**：标题、加粗、斜体、下划线、上标、下标、删除线、高亮、文字颜色、行内代码，插入引用块、无序/有序列表、表格、公式与代码块。
  - **公式**：行内 `\(…\)` 与块级 `\[…\]` 公式由 KaTeX 渲染，存储统一使用反斜杠定界符。
  - **块锚点链接**：可为引用块与标题生成 `#esd-ref-…` 锚点链接，点击跳转并短暂高亮目标块。
  - **引用块折叠**：引用块默认收起、只显示首行，点左侧按钮展开；跳转/替换到被收起的引用块时会先自动展开。
  - **编辑器内搜索替换**：`Ctrl+F` / `Ctrl+H`，随输入实时高亮并可逐个跳转。
  - **快捷键中心**：24 项动作可自定义组合键，检测笔记模块内部的重复占用；快捷键无效时可自行重新录制。
  - **临时笔记**：直接打开并原地编辑本机 `.md` 文件，自动轮询外部改动，并记住每篇的阅读位置。
  - **导出**：导出 Markdown 或自带样式的独立 HTML。
- **清单与倒数日**：规划待办、课程和重要日期。
- **专注计时**：记录专注过程与统计。
- **提醒**：由 Electron 主进程调度，并在本机保存提醒状态。
- **插件系统**：管理手动安装的插件。
- **全局滚动条**：统一使用自绘滚动条，覆盖页面中的滚动区域及原本隐藏滚动条的区域；需要保持无滚动条外观的滚动容器（如滚轮选择器）添加 `data-app-scrollbar-off` 属性即可跳过。

## 🛠️ 技术栈

- Vue 3、TypeScript、Vite、Pinia、Vue Router
- Electron；渲染进程通过 preload IPC 使用受控的主进程能力
- Electron 桌面端使用本地 YAML 文件；浏览器预览使用 localStorage

## 🚀 开发

需要安装 Node.js 和 npm。

```sh
npm install
npm run dev
```

浏览器调试可直接启动 Vite：

```sh
npx vite
```

浏览器预览没有 Electron 文件访问能力时，数据保存在浏览器 localStorage 中。

## 💾 本地数据

Electron 桌面端使用 YAML 文件保存账号与模块数据，根目录为：

```text
%APPDATA%\earth-survival-diary\data\
```

账号信息按用户 ID 分文件保存；模块数据按用户 ID 和模块分目录保存。账号密码以派生哈希保存，不以明文写入。登录会话令牌由 Chromium 本地存储管理。

```text
data\users\<用户ID>.yaml
data\<用户ID>\countdown\categories.yaml
data\<用户ID>\countdown\countdowns.yaml
data\<用户ID>\course\courses.yaml
data\<用户ID>\focus\favorites.yaml
data\<用户ID>\focus\records.yaml
data\<用户ID>\footprint\diary.yaml
data\<用户ID>\footprint\footprint.yaml
data\<用户ID>\list\completed.yaml
data\<用户ID>\list\favorites.yaml
data\<用户ID>\list\folders.yaml
data\<用户ID>\list\lists.yaml
data\<用户ID>\list\tasks.yaml
data\<用户ID>\notes\<笔记ID>.md
data\<用户ID>\notes\media\<资源ID>.yaml
data\<用户ID>\notes\tags.yaml
data\<用户ID>\notes\tempNotes.yaml
data\<用户ID>\notes\tempReading.yaml
data\<用户ID>\profile\profile.yaml
data\<用户ID>\settings\settings.yaml
data\<用户ID>\system\reminders.yaml
data\<用户ID>\system\state.yaml
```

主进程通过 YAML 解析器读写这些文件。每篇笔记以 Markdown 文件保存，标签保存在 `tags.yaml`；图片和视频资源分别写入 `notes\media\` 下的 YAML 资源文件。

**临时笔记**（直接编辑本机已有的 `.md` 文件）不复制进笔记库，只在 `tempNotes.yaml` 中保存**文件路径清单**，正文始终以磁盘上的文件为准；每篇的阅读位置单独记录在 `tempReading.yaml`。外部编辑器的改动通过轮询与窗口聚焦自动重读。

程序不会自动迁移旧数据，文件管理器不提供数据导入导出功能。

## 🏗️ 构建与发布

```sh
npm run build
npm run electron:build:win
```

构建产物输出到 `release/`。配置 GitHub 发布令牌后，`npm run publish-release` 可上传当前发布产物。

### 安装与卸载（Inno Setup）

安装与卸载程序由 [Inno Setup](https://jrsoftware.org/isinfo.php) 制作，不再使用 NSIS。

- 安装脚本模板：[`build/installer.iss`](build/installer.iss)（构建时由脚本替换变量生成 `build/installer.generated.iss`）
- 安装器图形：[`scripts/generate-installer-images.js`](scripts/generate-installer-images.js) 生成左侧星空大图（240×459，星空 + 居中地球）与备用小图（PNG）
- 简体中文语言文件：[`build/languages/ChineseSimplified.isl`](build/languages/ChineseSimplified.isl)（Inno Setup 未官方提供简体中文翻译，由项目维护）
- 中文许可协议：[`build/installer-license.txt`](build/installer-license.txt)（安装器展示用，仓库根目录的 MIT 原文保持不变）
- 编译器获取：[`scripts/setup-inno.cjs`](scripts/setup-inno.cjs) 优先使用本机已装的 Inno Setup，否则自动下载官方安装器并静默安装到 `build/tools/`
- 安装包构建：[`scripts/build-installer.cjs`](scripts/build-installer.cjs) 生成 `.iss` 并调用 `ISCC.exe` 编译，同时产出 `.blockmap` 与 `latest.yml`

```sh
npm run electron:build:win        # electron-builder 产出 win-unpacked + 编译 Inno Setup 安装包
npm run setup:inno                # 只准备 Inno Setup 编译器
npm run build:installer           # 已有 win-unpacked 时只重新编译安装包
```

安装行为：

- **界面全部中文化**：使用项目自带的简体中文语言文件，不显示语言选择对话框；卸载界面同为中文
- **左侧星空**：星空直接画在左侧大图 `installer-sidebar.png` 内（240×459），只覆盖左侧面板；`[Code]` 段的 `CurPageChanged` 控制显示范围为**欢迎页与安装完成页**，内页（许可协议、选择安装位置等）保持空白
- **安装路径全英文**：默认装到 `%LOCALAPPDATA%\Programs\Earth-Survival-Diary`（与主程序文件名一致），磁盘路径中不出现中文；界面与开始菜单仍显示中文产品名"地球 Online 生存日记"
- 默认每用户安装（免管理员）；可在"选择安装位置"页切换到管理员模式（所有用户，装到 `%ProgramFiles%\Earth-Survival-Diary`）
- 安装与卸载过程中自动检测应用是否正在运行（调用系统 `tasklist` 查询主程序进程）；应用运行时卸载会被拦截提示，静默卸载直接中止，避免文件占用导致残留
- 卸载详情实时显示：删除前统计文件规模，删除后枚举残留，被占用无法删除的文件逐个列出
- 卸载默认**保留** `%APPDATA%\earth-survival-diary` 下的笔记、设置与日志；卸载时会询问是否一并删除
- 静默安装：`Earth-Survival-Diary-Setup-<version>.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`
- 静默卸载：`<安装目录>\unins000.exe /VERYSILENT`

## 📁 项目结构

```text
src/
├── lib/api.ts                    # 业务 API 适配层，路由到本地实现
├── services/                     # 本地账号与业务请求
│   ├── localApi.ts               # 本地账号与业务请求
│   ├── localDataStore.ts         # 本地数据访问与媒体引用处理
│   └── tempNotes.ts              # 临时笔记：路径清单与阅读位置
├── stores/                       # Pinia 状态管理
│   ├── noteStore.ts              # 笔记与标签
│   ├── shortcutStore.ts          # 快捷键动作、组合键与冲突检测
│   └── tempNoteStore.ts          # 临时笔记清单与磁盘同步
├── components/
│   ├── editor/                   # 编辑器内核扩展
│   │   ├── blockAnchors.ts       # 块锚点（引用块/标题的链接跳转与高亮）
│   │   ├── mathSyntax.ts         # 公式定界符 ↔ 编辑器语法的往返转换
│   │   ├── textStyleMarks.ts     # 高亮/文字颜色/下划线/上标/下标 mark
│   │   ├── codeGrammar.ts        # 代码块语言描述与语法校验
│   │   ├── codeLanguages.ts      # 代码语言目录与高亮预览
│   │   ├── codePreviewBridge.ts  # 链接与行内代码校验
│   │   └── mathLiveInput.ts      # 公式实时输入插件
│   ├── notes/                    # 笔记页、编辑器与相关弹窗
│   └── ...                       # 其它页面与通用组件
├── styles/                       # 全局样式（代码高亮 token 等）
└── utils/
    ├── noteExport.ts             # 导出 Markdown
    └── noteExportHtml.ts         # 导出独立 HTML

electron/
├── main.cjs                      # Electron 主进程及 YAML 文件 IPC
├── preload.cjs                   # 受限 renderer IPC
└── lib/                          # 日志等桌面端工具

build/
├── installer.iss                 # Inno Setup 安装/卸载脚本模板
├── installer-license.txt         # 安装器展示的中文许可协议
├── languages/                    # 安装器语言文件
│   └── ChineseSimplified.isl     # 简体中文翻译（项目维护）
└── images/                       # 应用图标与安装器图形（PNG/ICO）

scripts/
├── dev.cjs                       # 启动 Vite 和 Electron
├── build-tools.cjs               # 构建、清理与发布工具
├── build-installer.cjs           # 生成 .iss 并用 ISCC 编译安装包
├── setup-inno.cjs                # 获取/安装 Inno Setup 编译器
├── generate-icons.js             # 生成应用图标
└── generate-installer-images.js  # 生成安装器图形
```

`src/plugins/file-manager` 是独立 Git 仓库，供本地开发模式使用；父项目不跟踪该目录，也不会把它打进安装包。既有用户插件副本会继续保留并加载。

## 📐 数据访问流程

```text
Vue 页面和 Pinia stores
        ↓
src/lib/api.ts
        ↓
src/services/localApi.ts
        ↓
src/services/localDataStore.ts
        ↓
preload IPC → Electron main process → 用户与模块 YAML 文件
```

桌面端数据文件通过主进程写入，渲染进程不直接访问 Node.js 文件系统。账号文件保存在 `data\users\<用户ID>.yaml`，各模块文件保存在对应用户目录下。

## 📄 许可

详见仓库中的 LICENSE 文件。
