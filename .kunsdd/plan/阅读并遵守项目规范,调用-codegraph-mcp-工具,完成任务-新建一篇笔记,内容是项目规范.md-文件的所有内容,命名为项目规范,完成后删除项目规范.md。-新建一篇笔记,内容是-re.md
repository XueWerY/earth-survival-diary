## Summary

将项目根目录下的 `项目规范.md` 和 `README.md` 两个 Markdown 文件的内容迁移到应用内部的笔记系统中，然后删除原始 .md 文件。通过编写一个 Node.js 迁移脚本来直接操作用户数据目录中的 JSON 文件完成笔记创建。迁移完成后删除脚本。

## Steps

### Step 1: 创建迁移脚本 `scripts/migrate-docs-to-notes.cjs`

编写一个独立的 Node.js 脚本，完成以下工作：

1. **读取源文件内容**：读取 `项目规范.md` 和 `README.md` 的完整内容
2. **定位数据目录**：通过 `process.env.APPDATA`（Windows）找到应用数据目录 `earth-survival-diary/data/`
3. **查找现有用户**：读取 `data/users/` 目录下所有 `.json` 文件，解析出用户 ID 和 email
4. **为每个用户创建笔记**：
  - 确保 `notes/categories.json` 存在，不存在则使用默认分类（个人/工作/学习/灵感）
  - 读取现有 `notes/notes.json`，追加两条新笔记：
    - 笔记1：title=`项目规范`，categoryId=`study`，pinned=true，content=项目规范.md 的完整 Markdown 原文
    - 笔记2：title=`使用指南`，categoryId=`study`，pinned=true，content=README.md 的完整 Markdown 原文
  - 内容格式使用 JSON 页面格式：`{pages: [{id, title:"正文", level:1, content: "<p>行1</p><p>行2</p>..."}]}`
5. **处理边缘情况**：
  - 无用户存在时：静默跳过（首次运行应用时自动创建）
  - 笔记已存在时：跳过不重复创建（幂等性）
  - 源 .md 文件不存在时：提前报错退出
6. **删除源文件**：删除 `项目规范.md` 和 `README.md`

### Step 2: 运行脚本

执行 `node scripts/migrate-docs-to-notes.cjs` 完成迁移。

### Step 3: 更新版本号

在 `package.json` 中将 `version` 更新为 `YYYY.M.DD-X` 格式（如 `2026.7.8-4`）。

### Step 4: 更新 CHANGELOG.md

在 CHANGELOG.md 标题行下方添加条目：

```
### v<版本号> (<日期>)
- 将项目规范和使用指南文档迁移至应用内笔记系统，方便随时查阅
```

### Step 5: 更新项目规范笔记（如果需要）

本次修改涉及项目基础文件结构变更（.md 文档迁移），需要在项目规范笔记中更新文档说明部分——但这属于 Step 1 创建的笔记内容更新。由于项目规范笔记的内容就是项目规范.md 原文，若原文中提到了 README.md 的引用关系，则需同步调整。但迁移后不再有 .md 文件存在，所以可能需要更新。**待实施时根据实际内容判断**。

## Key Design Decisions

1. **使用直接文件操作而非 HTTP API**：开发环境中无需启动应用和认证，脚本更简单可靠
2. **内容以纯文本段落存储**：将 Markdown 按行转为 `<p>` 标签 HTML，保留原始内容可读性（不做 Markdown 渲染）
3. **幂等设计**：检查笔记 title 避免重复创建
4. **分类选择**：两个笔记归入"学习"分类（`study`），因为它们都是文档性质

## Verification

1. 运行脚本后检查数据目录中 `notes/notes.json` 是否包含两条新笔记
2. 确认 `项目规范.md` 和 `README.md` 已被删除
3. 启动应用，进入笔记模块 → 学习分类，确认两条笔记可见且内容完整
4. 确认版本号和 CHANGELOG 已更新

## Risks

- **低风险**：数据目录路径依赖平台特定路径，脚本需要在 Windows 环境运行（与项目匹配）
- 如果用户尚未注册（无用户数据），笔记创建将跳过，用户注册后才能看到。这是预期行为——新用户首次登录时系统会自动创建示例笔记，届时可考虑将这两个文档笔记也纳入自动创建逻辑

