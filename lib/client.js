window.__ModuleLoader__.load({
	id: "dsh-archive-admin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const { jsx, jsxs, Fragment } = react_jsx_runtime;
		const { useState, useMemo } = react;
		const { Modal, Button, IconArchiveOutline20 } = _deepseek_ai_dsh_client_ui_primitives;

		/** Dictionary namespace owned by this plugin. */
		const NS = "archive-admin";
		/** Cordis plugin name. */
		const name = "archive-admin";
		/** Required client services. */
		const inject = ["slots", "sessions", "locale"];

		/** Simplified Chinese dictionary (key-set source of truth). */
		const zh = {
			"open": "归档",
			"title": "已归档会话",
			"restore": "恢复",
			"delete": "删除",
			"deleteConfirm": "永久删除已归档会话",
			"deleteConfirm.desc": "将永久删除选中的归档会话及其日志文件，此操作不可撤销。",
			"selectAll": "全选",
			"selected": "已选",
			"empty": "暂无已归档的会话",
			"untitled": "无标题会话",
			"blank": "新会话",
			"close": "关闭",
			"cancel": "取消",
			"liveNotice": "个会话仍驻留在服务器内存中，其存储日志已删除；重启 dsh web 后将彻底从列表消失。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"open": "Archived",
			"title": "Archived sessions",
			"restore": "Restore",
			"delete": "Delete",
			"deleteConfirm": "Delete archived sessions",
			"deleteConfirm.desc": "This permanently deletes the selected archived sessions and their logs. This cannot be undone.",
			"selectAll": "Select all",
			"selected": "Selected",
			"empty": "No archived sessions",
			"untitled": "Untitled session",
			"blank": "New Session",
			"close": "Close",
			"cancel": "Cancel",
			"liveNotice": "sessions are still loaded in server memory; their logs were removed. Restart dsh web to fully clear them from the list."
		};

		const listDivider = "1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 70%, transparent)";

		/**
		 * Sidebar footer entry: an archive button that opens the management modal.
		 * The slot framework supplies `wide`, `t`, `useWorkspaces` and `useSessions`;
		 * `refreshSessions` comes from this plugin's slot inject face.
		 */
		function ArchivedButton({ wide, t, useWorkspaces, useSessions, refreshSessions }) {
			const [open, setOpen] = useState(false);
			const [busy, setBusy] = useState(false);
			const [error, setError] = useState(null);
			const [notice, setNotice] = useState(null);
			const [confirmTarget, setConfirmTarget] = useState(null);
			const [selected, setSelected] = useState(() => new Set());

			const archived = useWorkspaces((s) => s.archivedSessionIds) ?? [];
			const sessionList = useSessions((s) => s);

			const rows = useMemo(() => archived.map((id) => {
				const summary = sessionList?.byId?.[id];
				return {
					id,
					title: summary != null ? (summary.blank ? t("blank") : summary.displayTitle) : t("untitled"),
					missing: summary == null
				};
			}), [archived, sessionList, t]);

			const allSelected = archived.length > 0 && selected.size === archived.length;

			const toggle = (id) => setSelected((prev) => {
				const next = new Set(prev);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
			const toggleAll = () => setSelected(allSelected ? new Set() : new Set(archived));
			const clearSelection = () => setSelected(new Set());

			const run = async (action, ids) => {
				if (busy || ids.length === 0) return;
				setBusy(true);
				setError(null);
				setNotice(null);
				try {
					const res = await fetch(`/archive-admin/${action}`, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ sessionIds: ids })
					});
					const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
					if (!res.ok || data.ok !== true) throw new Error(data.error ?? `HTTP ${res.status}`);
					if (action === "delete") {
						if (Array.isArray(data.deletedSessionIds) && data.deletedSessionIds.length > 0) {
							await refreshSessions();
						}
						if (Array.isArray(data.liveSessionIds) && data.liveSessionIds.length > 0) {
							setNotice(`${data.liveSessionIds.length} ${t("liveNotice")}`);
						}
					}
					clearSelection();
				} catch (reason) {
					setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};

			const restoreSelected = () => run("restore", [...selected]);
			const askDeleteSelected = () => setConfirmTarget([...selected]);
			const confirmDelete = () => {
				if (busy || confirmTarget == null) return;
				const ids = confirmTarget;
				setConfirmTarget(null);
				run("delete", ids);
			};

			const checkboxStyle = {
				width: 15,
				height: 15,
				margin: 0,
				flex: "none",
				cursor: "pointer",
				accentColor: "var(--dsw-alias-state-business-primary)"
			};
			const dangerText = { color: "var(--dsw-alias-state-error-primary)" };
			const rowLabel = {
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "6px 2px",
				cursor: "pointer",
				minWidth: 0
			};
			const rowTitle = (missing) => ({
				flex: 1,
				minWidth: 0,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				fontSize: 13,
				lineHeight: "20px",
				color: missing ? "var(--dsw-alias-label-tertiary)" : "var(--dsw-alias-label-primary)"
			});
			const listWrap = {
				maxHeight: "min(46vh, 300px)",
				overflowY: "auto",
				display: "flex",
				flexDirection: "column",
				paddingRight: 4
			};
			const selectAllRow = {
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "2px 2px 8px",
				borderBottom: listDivider,
				marginBottom: 6
			};

			return jsx(Fragment, { children: [
				jsx(Button, {
					variant: "ghost",
					title: t("open"),
					"aria-label": t("open"),
					onClick: () => setOpen(true),
					children: jsxs(Fragment, { children: [
						jsx(IconArchiveOutline20, { size: wide ? 16 : 20 }),
						wide && jsx("span", { children: t("open") })
					] })
				}),
				jsx(Modal, {
					open: open,
					onClose: () => { if (!busy) setOpen(false); },
					closeLabel: t("close"),
					title: archived.length > 0 ? `${t("title")} (${archived.length})` : t("title"),
					footer: jsxs(Fragment, { children: [
						jsx(Button, { variant: "outline", disabled: busy, onClick: () => setOpen(false), children: t("close") }),
						jsx(Button, { variant: "primary", disabled: busy || selected.size === 0, onClick: restoreSelected, children: `${t("restore")} (${selected.size})` }),
						jsx(Button, { variant: "ghost", style: dangerText, disabled: busy || selected.size === 0, onClick: askDeleteSelected, children: `${t("delete")} (${selected.size})` })
					] }),
					children: jsxs("div", { children: [
						archived.length === 0
							? jsx("div", { style: { fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-tertiary)", padding: "10px 0", textAlign: "center" }, children: t("empty") })
							: jsxs(Fragment, { children: [
									jsx("label", { style: selectAllRow, children: jsxs(Fragment, { children: [
										jsx("input", { type: "checkbox", checked: allSelected, onChange: toggleAll, style: checkboxStyle }),
										jsx("span", { style: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-secondary)", flex: 1 }, children: `${t("selectAll")}` }),
										jsx("span", { style: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-tertiary)" }, children: `${t("selected")} ${selected.size}/${archived.length}` })
									] }) }),
									jsx("div", { style: listWrap, children: rows.map((row) => jsx("label", { key: row.id, style: rowLabel, children: jsxs(Fragment, { children: [
										jsx("input", { type: "checkbox", checked: selected.has(row.id), onChange: () => toggle(row.id), style: checkboxStyle }),
										jsx("span", { title: row.id, style: rowTitle(row.missing), children: row.title })
									] }) })) })
								] }),
						error != null && jsx("div", { style: { padding: "8px 2px 0", fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-state-error-primary)" }, children: error }),
						notice != null && jsx("div", { style: { padding: "8px 2px 0", fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-secondary)" }, children: notice })
					] })
				}),
				jsx(Modal, {
					open: confirmTarget != null,
					onClose: () => { if (!busy) setConfirmTarget(null); },
					closeLabel: t("close"),
					title: t("deleteConfirm"),
					footer: jsxs(Fragment, { children: [
						jsx(Button, { variant: "outline", disabled: busy, onClick: () => setConfirmTarget(null), children: t("cancel") }),
						jsx(Button, { variant: "ghost", style: dangerText, disabled: busy, onClick: confirmDelete, children: `${t("delete")} (${confirmTarget?.length ?? 0})` })
					] }),
					children: jsx("div", { style: { fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-primary)" }, children: t("deleteConfirm.desc") })
				})
			] });
		}

		/**
		 * Register the footer action. The `sidebar.footer.action` list slot is
		 * declared by the stock sidebar plugin; `slots.inject` waits for it and
		 * re-binds across reloads.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "archive-admin: dictionaries");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "archive-admin",
				locale: NS,
				inject: () => ({
					refreshSessions: () => ctx.sessions.refresh()
				})
			}, ArchivedButton));
		}
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
