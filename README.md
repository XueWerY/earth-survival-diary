# 地球 Online 生存日记

一款 Vue 3 本地应用。页面在浏览器中显示；Vite 的 Node 进程同时承接本机文件、媒体、插件和 YAML 数据操作，并把前端日志输出到启动终端。

## 功能

- 足迹、任务、清单、倒数日、课程表、专注计时和提醒。
- 笔记编辑、标签、媒体附件、公式、搜索替换、临时 Markdown 文件，以及 Markdown/HTML 导出。
- 插件市场、随项目构建的内置插件，以及保存在本机的外部插件。
- 用户数据按账号保存为 YAML 文件；笔记正文、标签、媒体附件及其索引由用户选择的文件夹库管理。

## 开发

需要 Node.js 与 pnpm。

```sh
pnpm install
pnpm dev
```

`pnpm dev` 启动本机 Vite/Node 服务，在默认浏览器打开 `http://127.0.0.1:5173`。关闭终端会停止服务。浏览器中的应用日志会转发到这个终端，并保存在本机日志目录。

构建静态前端并通过带本机服务的预览服务器运行：

```sh
pnpm build
pnpm preview
```

请通过 `pnpm dev` 或 `pnpm preview` 打开应用；单独打开 `dist/index.html` 不会启用本机数据与文件服务。

## 本机数据

默认位置为：

```text
%APPDATA%\earth-survival-diary\data\
```

用户业务数据按用户 ID 分目录。笔记库由笔记模块通过系统文件夹选择器添加；首次设置时会把旧笔记和媒体附件迁入所选目录。之后可以从笔记模块侧栏的“笔记库”入口切换已添加的笔记库，或添加新库；切换不会合并或搬动其他笔记库的数据。应用数据目录保存笔记库清单和插件养成记录：

```text
data\<用户ID>\star-rail-character-growth\records.yaml
data\<用户ID>\genshin-character-growth\records.yaml
```

每个笔记库中的 Markdown 文件按文件夹实际存放，笔记 frontmatter 记录文件夹路径。笔记只允许在同一最外层文件夹内移动。标签按文件夹隔离；标签索引和媒体附件存放在各笔记库根目录的 `.earth-survival-diary` 中。

```text
<笔记库>/工作/*.md
<笔记库>/学习/*.md
<笔记库>/.earth-survival-diary/tags.yaml
<笔记库>/.earth-survival-diary/media/metadata.yaml
<笔记库>/.earth-survival-diary/media/<媒体资产>
```

临时 Markdown 文件由浏览器文件选择器授权。支持 File System Access API 的浏览器可以直接保存回原文件；其他浏览器会将内容保存在当前浏览器的本地副本中。浏览器窗口大小由浏览器自身调整。

账号密码使用派生哈希保存。普通模块数据由本机服务写入应用数据目录，不依赖浏览器 IndexedDB。
