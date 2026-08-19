# dsh-archive-admin

[English](README.md) | 中文

> 给 DeepSeek Harness Web 侧边栏加上「已归档会话」管理：**恢复** 或 **永久删除**。

---

## ⚠️ 重要：这个包**还没发布到 npm**

`npm install dsh-archive-admin` / `pnpm add dsh-archive-admin` **必然报 404** —— 网上仓库里根本没有这个包（可以自己验证：`npm view dsh-archive-admin`）。

这不是 node、npm 或 pnpm 的问题，只是说明**没东西可下载**。所以唯一能装的方式，是从你的**本地克隆**（你硬盘上的这个仓库）出发：先把它链接进 DSH 的模块目录，再告诉 DSH 加载它。

等作者发布之后，安装就变成一条命令（`dsh plugin --profile web add dsh-archive-admin`）。在那之前，请按下面的手动步骤操作。

---

## 功能

在 DSH 里归档会话后（归档只是隐藏，**不会删除**会话），这个插件让你可以：

- **恢复**：把会话从归档区移回原来的分组和位置。
- **删除**：彻底删除会话的 **日志文件、投影缓存、分组占位和归档记录**。

## 安装（尚未发布时）

### 第 1 步 —— 把本地克隆链接进 profile 的模块目录

DSH 只在自己的模块目录里找插件。我们要在那里建一个链接，指向你的本地克隆，让 DSH "看得见"代码，而不需要经过 npm 仓库。

**Windows** —— 用**目录 junction**（junction **不需要管理员权限**，symlink 才需要）：

```powershell
New-Item -ItemType Junction `
  -Path "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-archive-admin" `
  -Target "C:\path\to\dsh-archive-admin"
```

不想用链接、直接复制一份也行：

```powershell
Copy-Item -Recurse "C:\path\to\dsh-archive-admin" "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-archive-admin"
```

**macOS / Linux** —— 用软链：

```bash
ln -s /path/to/dsh-archive-admin ~/.dsh/profiles/node_modules/dsh-archive-admin
```

> 链接是"活的"：你以后改本地克隆，DSH 立即就能看到（不用重新复制）。复制更直观，但一旦改了源码就会过期。

### 第 2 步 —— 告诉 DSH 加载这个插件

在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加（Windows 上是 `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml`）：

```yaml
- insert:
    - id: archive-admin
      name: 'dsh-archive-admin'
```

- `id: archive-admin` → 插件的内部编号（与插件源码一致）。
- `name: 'dsh-archive-admin'` → 要加载的包，正是第 1 步链接进来的那个。

### 第 3 步 —— 重启 `dsh web` 并强制刷新页面

```bash
dsh web
```

然后**强制刷新**浏览器标签页（**Ctrl+Shift+R**），让启动清单加载新的客户端插件。侧边栏底部会出现「归档」按钮。

> **为什么不用 `dsh plugin --profile web add ...`？** 这个命令会去 npm 仓库下载，而未发布的包必然失败。上面两个手动步骤**不需要 pnpm**，也**不需要 npm 仓库**。

## 使用

侧边栏底部会出现一个「归档」按钮：

- 点击打开「已归档会话」弹窗：多选框 + 全选，列表可滚动；
- **恢复 (n)**：把选中的会话恢复回原分组；
- **删除 (n)**：二次确认后永久删除选中会话。

> **注意**：删除时若某会话仍驻留在服务器内存中（例如归档后没有关闭），插件会先删掉它的日志，并在弹窗里提示「重启 dsh web 后彻底消失」。这是 DSH 没有对外提供「内存销毁会话」API 的边界——重启后即完全消失，属预期行为。

## 卸载

**顺序很重要**：先删加载配置，再删链接的包。如果先删了链接、而 `cordis.patch.yml` 里还写着加载它，DSH 启动时会去找一个不存在的包而报错。

### 第 1 步 —— 删除加载配置

把 `~/.dsh/profiles/web/cordis.patch.yml` 里你加的 `insert` 块删掉（恢复成 `[]`）。

### 第 2 步 —— 删除链接的包

**Windows**

```powershell
Remove-Item "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-archive-admin" -Recurse -Force
```

**macOS / Linux**

```bash
rm -rf ~/.dsh/profiles/node_modules/dsh-archive-admin
```

### 第 3 步 —— 重启 `dsh web`

插件不写任何自有持久化状态，卸载后 DSH 里零残留。

## 开发

运行离线测试（不需要启动 DSH 服务）：

```bash
npm test
```

## 兼容性

- 构建于 DSH `0.1.0-rc.7`。
- **不修改**任何 `@deepseek-ai/dsh-*` 源文件；唯一与版本耦合的部分是启动时给 workspace registry 补一个缺失的 `unarchiveSession` 方法，版本不兼容时会直接报错而不是静默失效。

## License

MIT
