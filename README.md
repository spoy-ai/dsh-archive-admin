# dsh-archive-admin

English | [中文](README.zh.md)

> Adds archived-session management to the DSH web sidebar: **restore** or **permanently delete**.

---

## ⚠️ Important: this package is **NOT published to npm yet**

`npm install dsh-archive-admin` / `pnpm add dsh-archive-admin` **will fail with 404** — the package does not exist on the registry (check: `npm view dsh-archive-admin`).

That is not a problem with node, npm, or pnpm — it simply means there is **nothing to download**. Because of this, the only way to install is from your **local checkout** (this repository on your disk), by linking it into DSH's module directory, then telling DSH to load it.

Once the package is published, installing becomes a one-liner (`dsh plugin --profile web add dsh-archive-admin`). Until then, follow the manual steps below.

---

## What it does

Once you archive sessions in DSH (archiving only hides them — it does not delete them), this plugin lets you:

- **Restore**: remove the session from the archive set; it reappears in its original workspace and position.
- **Delete**: permanently remove the session's **log file, projection-cache row, workspace slot and archive record**.

## Install (while unpublished)

### Step 1 — Link the local checkout into the profile module root

DSH looks for plugins in its module directory. We create a link there that points at your local clone, so DSH can "see" the code without needing the npm registry.

**Windows** — use a directory junction (a junction needs **no admin rights**; a symlink does):

```powershell
New-Item -ItemType Junction `
  -Path "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-archive-admin" `
  -Target "C:\path\to\dsh-archive-admin"
```

Prefer a plain copy instead of a link? Also fine:

```powershell
Copy-Item -Recurse "C:\path\to\dsh-archive-admin" "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-archive-admin"
```

**macOS / Linux** — use a symlink:

```bash
ln -s /path/to/dsh-archive-admin ~/.dsh/profiles/node_modules/dsh-archive-admin
```

> A link stays "live": edits you make to the local clone are immediately visible to DSH (no re-copy needed). A copy is simpler to reason about but goes stale as soon as you edit the source.

### Step 2 — Tell DSH to load the plugin

Append this to `~/.dsh/profiles/web/cordis.patch.yml` (`%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml` on Windows):

```yaml
- insert:
    - id: archive-admin
      name: 'dsh-archive-admin'
```

- `id: archive-admin` → the plugin's internal id (matches the plugin source).
- `name: 'dsh-archive-admin'` → the package to load — the very one you just linked in Step 1.

### Step 3 — Restart `dsh web` and hard-refresh the page

```bash
dsh web
```

Then hard-refresh the browser tab (**Ctrl+Shift+R**) so the boot graph picks up the new client bundle. An "Archived" button appears at the bottom of the sidebar.

> **Why not `dsh plugin --profile web add ...`?** That command downloads from the npm registry, which fails for an unpublished package. The manual two steps above need **no pnpm** and **no npm registry**.

## Usage

An "Archived" button appears at the bottom of the sidebar:

- Click it to open the "Archived sessions" dialog: checkbox multi-select + select-all, scrollable list;
- **Restore (n)**: restores the selected sessions;
- **Delete (n)**: permanently deletes the selection after a confirmation dialog.

> **Note**: if a deleted session is still loaded in server memory (e.g. it was archived without being closed), the plugin deletes its log and tells you to restart `dsh web` for it to fully disappear. DSH exposes no in-memory dispose API, so a restart clears it — this is expected.

## Uninstall

**Order matters.** Remove the loading config **first**, then the linked package. If you delete the link first while `cordis.patch.yml` still tells DSH to load it, DSH will fail to start looking for a package that no longer exists.

### Step 1 — Remove the loading config

Delete the `insert` block you added from `~/.dsh/profiles/web/cordis.patch.yml` (revert it to `[]`).

### Step 2 — Remove the linked package

**Windows**

```powershell
Remove-Item "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-archive-admin" -Recurse -Force
```

**macOS / Linux**

```bash
rm -rf ~/.dsh/profiles/node_modules/dsh-archive-admin
```

### Step 3 — Restart `dsh web`

The plugin writes no persistent state of its own — after uninstall nothing is left behind.

## Development

Run the offline tests (no DSH server needed):

```bash
npm test
```

## Compatibility

- Built against DSH `0.1.0-rc.7`.
- Modifies **no** `@deepseek-ai/dsh-*` package; the only version-coupled part is a runtime patch that adds the missing `unarchiveSession` method to the workspace registry at startup, and it fails loudly instead of misbehaving on an incompatible version.

## License

MIT
