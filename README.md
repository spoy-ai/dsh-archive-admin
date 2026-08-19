# dsh-archive-admin

> 给 DeepSeek Harness Web 侧边栏加上"已归档会话"管理：**恢复** 或 **永久删除**。
> Adds archived-session management to the DSH web sidebar: **restore** or **permanently delete**.

## 功能 / What it does

在 DSH 里归档会话后（归档只是隐藏，**不会删除**会话），这个插件让你可以：
Once you archive sessions in DSH (archiving only hides them — it does not delete them), this plugin lets you:

- **恢复 / Restore**：把会话从归档区移回原来的分组和位置。
  Remove the session from the archive set; it reappears in its original workspace and position.
- **永久删除 / Delete**：彻底删除会话的 **日志文件、投影缓存、分组占位和归档记录**。
  Permanently remove the session's **log file, projection-cache row, workspace slot and archive record**.

## 安装 / Install

1. 安装到 profile 的模块目录 / Install into the profile module root:

   ```bash
   # 已发布时 / when published:
   npm install --prefix ~/.dsh/profiles dsh-archive-admin

   # 开发时用软链 / while developing, symlink the checkout:
   ln -s /path/to/dsh-archive-admin ~/.dsh/profiles/node_modules/dsh-archive-admin
   ```

2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 里追加 / Append to `~/.dsh/profiles/web/cordis.patch.yml`:

   ```yaml
   - insert:
       - id: archive-admin
         name: 'dsh-archive-admin'
   ```

3. 重启 `dsh web` 并刷新页面 / Restart `dsh web`, then refresh the page.

## 使用 / Usage

侧边栏底部会出现一个「归档」按钮 / An "Archived" button appears at the bottom of the sidebar:

- 点击打开「已归档会话」弹窗：多选框 + 全选，列表可滚动 / it opens the "Archived sessions" dialog: checkbox multi-select + select-all, scrollable list;
- **恢复 (n)**：把选中的会话恢复回原分组 / restores the selected sessions;
- **删除 (n)**：二次确认后永久删除选中会话 / permanently deletes the selection after a confirmation dialog.

> **注意 / Note**：删除时若某会话仍驻留在服务器内存中（例如归档后没有关闭），插件会先删掉它的日志，并在弹窗里提示"重启 dsh web 后彻底消失"。这是 DSH 没有对外提供"内存销毁会话"API 的边界——重启后即完全消失，属预期行为。
> If a deleted session is still loaded in server memory (e.g. it was archived without being closed), the plugin deletes its log and tells you to restart `dsh web` for it to fully disappear. DSH exposes no in-memory dispose API, so a restart clears it — this is expected.

## 卸载 / Uninstall

1. 从 `cordis.patch.yml` 里删除上面的 `insert` 块 / Remove the `insert` block from `cordis.patch.yml`;
2. `rm -rf ~/.dsh/profiles/node_modules/dsh-archive-admin`;
3. 重启 `dsh web` / Restart `dsh web`.

插件不写任何自有持久化状态，卸载后 DSH 里零残留。
The plugin writes no persistent state of its own — after uninstall nothing is left behind.

## 兼容性 / Compatibility

- 构建于 DSH `0.1.0-rc.7` / Built against DSH `0.1.0-rc.7`.
- **不修改**任何 `@deepseek-ai/dsh-*` 源文件；唯一与版本耦合的部分是启动时给 workspace registry 补一个缺失的 `unarchiveSession` 方法，版本不兼容时会直接报错而不是静默失效。 / Modifies **no** `@deepseek-ai/dsh-*` package; the only version-coupled part is a runtime patch that adds the missing `unarchiveSession` method to the workspace registry at startup, and it fails loudly instead of misbehaving on an incompatible version.

## License

MIT
