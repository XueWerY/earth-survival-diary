# 地球 Online 生存日记 · 服务端包

这是独立部署的 Express 服务。服务端不连接数据库，账号、模块数据和全局设置均以 YAML 文件保存在 `config.yaml` 指定的数据目录；同时从 `updatesDir` 提供桌面更新清单和安装包，不托管桌面页面。

## 生成与上传

在完整项目根目录运行：

```powershell
npm run server:package
```

命令会在 `release/server-<项目版本>/` 生成精简服务端包。把该目录上传并解压到 Windows Server 2025，例如 `C:\apps\earth-survival-diary-server`。不要把 YAML 数据目录放在服务端包目录中，这样更新服务端时可以保留数据。

## 配置并启动

在部署包目录打开 PowerShell 或命令提示符，先安装一次服务端依赖，再启动服务。首次启动时会在包根目录创建 `config.yaml`。配置从 `server/config.example.yaml` 初始化，JWT 密钥会自动生成并写入配置文件。

```powershell
npm install --omit=dev
npm start
```

```yaml
host: 127.0.0.1
port: 5000
dataDir: "C:/Earth-Survival-Diary/data"
updatesDir: "C:/Earth-Survival-Diary/updates"
jwtSecret: ""
```

服务启动时会把模板复制为包根目录的 `config.yaml`，并生成随机 JWT 密钥填入空值。若旧环境变量仍存在，会在首次生成时迁移 `HOST`、`PORT`、`ESD_DATA_DIR` 和 `ESD_JWT_SECRET`；之后只读取 YAML 配置。首次启动后可编辑 `config.yaml` 修改 `host`、`port`、`dataDir` 和 `updatesDir`。Nginx 与 API 在同一台服务器时，`host` 保持 `127.0.0.1`。数据目录与更新目录应位于持久磁盘，并限制为服务账号和管理员可访问；更换服务端版本时保留这些目录。不要把包含 JWT 密钥的 `config.yaml` 上传到公开仓库或客户端。

在服务器的另一个 PowerShell 窗口检查：

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

预期返回 `status: ok` 和 `storage: yaml`。YAML 文件按账号和模块分开保存，文件替换采用临时文件后重命名。请定期备份 `config.yaml` 中 `dataDir` 指定的目录；备份前停止 API，可获得同一时间点的完整文件集。

## 从旧 MySQL 导入

只有旧服务端已经在 MySQL 保存数据时才需要此步骤。先备份目标 YAML 数据目录，再在能够同时访问旧 MySQL 和目标数据目录的完整源码环境运行 `npm run data:migrate:mysql-to-yaml`。脚本默认拒绝覆盖同邮箱账号；确认备份后才使用 `--overwrite`。完成导入并核对账号和数据后，可停用旧 MySQL。部署包本身不包含 MySQL 驱动，正常服务运行也不会访问 MySQL。

旧 JSON 文件存储可以直接由 YAML 存储层兼容读取；对应数据下次写入时保存为 YAML 文件。

## 公网访问

给 API 配置域名，并将域名 DNS A 记录指向云服务器 `101.43.31.173`。在 Windows Server 配置 HTTPS 证书和反向代理，将 HTTPS 请求转发到 `http://127.0.0.1:5000`。公网只开放反向代理所需端口，不直接开放 API 5000。

客户端更新安装包由同一个服务托管。Nginx 的 HTTPS `server` 中还需加入：

```nginx
location /updates/ {
    proxy_pass http://127.0.0.1:5000/updates/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 600s;
}
```

在开发机运行 `pnpm electron:build:win` 后，将 `release/` 中最新版本的 `.exe`、`.blockmap` 和 `latest.yml` 复制到 `config.yaml` 指定的 `updatesDir`。服务不需要重启；可在浏览器打开 `https://www.earth-survival-diary.icu/updates/latest.yml` 检查清单是否可访问。下次启动或手动检查更新的桌面客户端会从该清单下载并安装更新。

如果访问上述地址返回 404，请确认 `latest.yml` 与对应版本的 `.exe`、`.blockmap` 都已复制到 `updatesDir`，并确认 Nginx 的 HTTPS `server` 中配置了 `/updates/` 代理。只有更新清单实际可访问后，客户端才能检查到新版本。

桌面客户端登录页填写 HTTPS API 根地址（不带 `/api`），点「测试连接」后再用同一账号登录。
