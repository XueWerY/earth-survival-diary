# 开发模式完整热重载方案

## Context（背景）

当前项目没有 `dev` 脚本，Electron 调试流程是「改代码 → `npm run build` 重新构建 dist → `npx electron .` 重启」，没有 HMR，效率低。

架构事实（已核实）：
- Electron 主进程（[main.cjs](file:///d:/Project/earth-survival-diary/electron/main.cjs)）启动内置 Express 服务（[prod-server.cjs](file:///d:/Project/earth-survival-diary/electron/prod-server.cjs)，端口 5000-5003），`express.static` 托管 Vite 构建产物 `dist/`，窗口加载 `http://127.0.0.1:5000`。
- 前端所有后端请求均为相对路径 `/api`（[api.ts](file:///d:/Project/earth-survival-diary/src/lib/api.ts)、storageService.ts），**无硬编码端口** → Vite dev server + `server.proxy` 可以无痛接管。
- 认证走 `Authorization: Bearer`（非 cookie），经 proxy 行为不变；项目无 WebSocket，不需要 `ws`。
- Express 服务仅暴露 `/api/*` 路由 + 静态托管，dev 模式下前端页面由 Vite 提供，`/api` 全部转发回 Express 即可。
- 单实例锁：main.cjs 已做 `requestSingleInstanceLock`，重启时需要等旧进程完全退出并处理锁竞态。

目标：开发模式前端获得真正 HMR（Vite dev server），改 `electron/*.cjs`（主进程/preload/内置服务）自动重启 Electron；**完全不改生产构建流程与产物**。

## 方案概览

不引入 electron-vite / vite-plugin-electron（避免重构 2444 行主进程的构建与 `__dirname` 路径逻辑），采用「Vite dev server + proxy + 自研 dev 运行器」实现完整热重载：

```
npm run dev
 └─ scripts/dev.cjs
     ├─ 启动 vite dev server（127.0.0.1:5173，strictPort）
     │    └─ proxy /api → http://127.0.0.1:5000（Express 内置服务）
     ├─ 等 5173 就绪后 spawn Electron（注入 ESD_DEV_URL / ESD_SERVER_PORT 环境变量）
     └─ fs.watch 监听 electron/**/*.cjs（排除 node_modules）
          └─ 改动 → taskkill /T /F 杀 Electron 进程树 → 等锁/端口释放 → 重启
```

## 改动文件

### 1. `vite.config.ts` — 加 `server` 配置（仅 dev 生效，`vite build` 忽略）

在 `base: './'` 后新增：

```ts
server: {
  host: '127.0.0.1',
  port: 5173,
  strictPort: true,
  proxy: {
    '/api': 'http://127.0.0.1:5000'
  }
}
```

不改 `base`、不改现有插件、不动构建逻辑。

### 2. `electron/main.cjs` — 最小改动（prod 路径零变化）

在 `let serverPort = 5000`（L66）附近新增：

```js
const DEV_SERVER_URL = process.env.ESD_DEV_URL || null
function entryUrl(port) { return DEV_SERVER_URL || ('http://127.0.0.1:' + port) }
```

- **startServer**（L1311）：`ESD_SERVER_PORT` 存在时 `portsToTry` 只用该端口，否则维持 `[5000,5001,5002,5003]`。
- **createWindow**（L1374）：`devTools: !!DEV_SERVER_URL`。
- **did-fail-load**（L1402）：dev 下瞬时失败（如 -102）600ms 后重试 `loadURL(DEV_SERVER_URL)`，最多 3 次，`did-finish-load` 重置计数。
- **whenReady**（L2210）：`const url = entryUrl(port)`。
- **activate**（L2233）：`createWindow(entryUrl(serverPort))`（原硬编码 `http://127.0.0.1:' + serverPort`）。

### 3. 新增 `scripts/dev.cjs` — 开发运行器（核心）

逻辑要点：
- `const electronPath = require('electron')`（纯 Node 上下文返回 `node_modules/electron/dist/electron.exe` 路径字符串，已核实）。
- **vite 启动**：`spawn('node', ['node_modules/vite/bin/vite.js'], { cwd: ROOT, stdio: 'inherit' })`。
- **健康检查**：`net.connect` 轮询 5173 就绪（超时 30s 报错退出）；spawn Electron 前确认 5000 端口未被占用。
- **Electron 启动**：`spawn(electronPath, ['.'], { cwd: ROOT, env: { ...process.env, ESD_DEV_URL: 'http://127.0.0.1:5173', ESD_SERVER_PORT: '5000' } })`，stdout/stderr 透传。
- **文件监听重启**：`fs.watch(electron 目录, { recursive: true })`，过滤 `node_modules`，仅 `*.cjs` 触发，200ms debounce + `restarting` 锁防重入。重启序列：
  1. `taskkill /PID <pid> /T /F`（杀整棵 Electron 进程树，含内置 Express）
  2. 等 child `close` + 250ms settle（释放单实例命名互斥锁）
  3. `waitPortFree(5000)`（避免 EADDRINUSE）
  4. 重新 spawn；若 4s 内 stdout 出现 `Another instance is already running` 判定锁竞态 → 杀后重试，最多 3 次
- **退出清理**：SIGINT/SIGTERM 时杀 Electron 树 + vite，然后退出。

### 4. `package.json` — 加脚本

```json
"dev": "node scripts/dev.cjs"
```

无新增依赖。

### 5. README.md + CHANGELOG.md（按项目约定）

- README「快速开始」L52-54 前新增：
  `# Electron 端开发（HMR + 主进程热重启）` + `pnpm dev`
- CHANGELOG 顶部新增条目，注明「新增开发模式热重载（`pnpm dev`）：前端 Vite HMR，主进程/preload/内置服务改动自动重启」。
- 版本号：本次为开发体验增强，若按发版流程需要则同步递增，否则仅更新文档（遵循既有约定）。

## 验证步骤

1. `npm run dev`：5173 就绪 → Electron 窗口弹出并加载 `http://127.0.0.1:5173`，日志含 `Server started on port 5000`。
2. 改任意 `src/*.vue/.ts`：页面即时 HMR，Electron 不重启。
3. 改 `electron/main.cjs`（如加一行日志）：dev.cjs 打印「重启主进程」，窗口重开，**登录态与数据保留**（localStorage 同源 + userData 持久）。
4. 改 `electron/preload.cjs` / `prod-server.cjs`：同样触发重启。
5. 10 秒内连续保存两次：只重启一次（debounce 生效）。
6. 回归 `npm run build`：产物与改动前一致（server 配置不进入构建）。

## 风险与回退

- **单实例锁竞态**：三重防护（等 close + settle + 端口探空 + stdout 检测重试）。
- **端口残留**：`waitPortFree(5000)` 兜底。
- **回退**：删除 `scripts/dev.cjs`、还原 vite.config.ts / main.cjs / package.json 的三处增量，prod 路径零改动，安全。