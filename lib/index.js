import { dirname } from "node:path";
import { rm } from "node:fs/promises";

/**
 * dsh-archive-admin — host half.
 *
 * A standalone DSH plugin that adds archived-session management (restore /
 * permanent delete) without modifying any @deepseek-ai/dsh-* package:
 *
 *  1. At startup it runtime-patches the workspace registry with an
 *     `unarchiveSession` method (stock DSH ships only `archiveSession`).
 *  2. It serves a small JSON route (`/archive-admin/*`) that the client half
 *     calls to restore or delete archived sessions.
 *
 * Everything else (the archive set, workspace accounting, the projection
 * cache, the `domain/changed` → host-frame → browser sync chain) is reused
 * as-is from the stock packages: writes go through the registry/entities, so
 * the built-in SSE frames keep every tab in sync automatically.
 */

/** Cordis plugin name. */
export const name = "archive-admin";

/** Required services (all provided by the stock web bundle). */
export const inject = ["webServer", "workspaceRegistry"];

/**
 * Add `unarchiveSession(sessionId)` to the workspace registry when the stock
 * build does not provide it. This is the only version-coupled piece: it
 * reuses the registry's own `enqueueOperation` / `requireState` / `setState`
 * surface (public instance members of the stock registry class). Idempotent,
 * and fails loudly on an incompatible registry so the plugin fiber reports
 * itself as incompatible rather than silently misbehaving.
 */
function ensureUnarchive(registry) {
	if (typeof registry.unarchiveSession === "function") return;
	const missing = ["enqueueOperation", "requireState", "setState"].filter((member) => typeof registry[member] !== "function");
	if (missing.length > 0) {
		throw new Error(`archive-admin: workspace registry is missing ${missing.join(", ")} — unsupported DSH version (cannot restore archived sessions)`);
	}
	registry.unarchiveSession = (sessionId) => registry.enqueueOperation(async () => {
		const state = registry.requireState();
		if (!Array.isArray(state?.archivedSessionIds) || !state.archivedSessionIds.includes(sessionId)) return;
		await registry.setState({
			...state,
			archivedSessionIds: state.archivedSessionIds.filter((id) => id !== sessionId)
		});
	});
}

/** Read a small JSON body from a node http request. */
async function readJson(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	if (chunks.length === 0) return {};
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Read one header from a node request (string value or undefined). */
function headerOf(headers, name) {
	if (headers == null) return void 0;
	const value = headers[name];
	return typeof value === "string" ? value : void 0;
}

/** Mirror of the stock loopback test: localhost / [::1] / 127.x.y.z. */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/**
 * Reject cross-site requests the same way the stock RPC channel does: a
 * browser page on another origin must not drive archive deletion via CSRF
 * (the route only accepts loopback Host plus a matching, non-cross-site Origin).
 */
function isTrustedRequest(req) {
	const host = headerOf(req.headers, "host");
	if (host === void 0) return false;
	let hostUrl;
	try {
		hostUrl = new URL(`http://${host}`);
	} catch {
		return false;
	}
	if (!isLoopbackHostname(hostUrl.hostname)) return false;
	if (headerOf(req.headers, "sec-fetch-site") === "cross-site") return false;
	const origin = headerOf(req.headers, "origin");
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}

/** Write one JSON response. */
function sendJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(payload);
}

/**
 * Permanently delete one session's stored log directory and detach it from
 * every workspace. A session still live in the in-memory store cannot be
 * fully cleared here (DSH exposes no public dispose API), but removing its
 * durable log means it is gone for good after the next server restart —
 * which is exactly what the `liveSessionIds` report tells the caller.
 */
async function deleteStoredSession(ctx, sessionId, headers, persistence) {
	for (const workspace of ctx.workspaceRegistry.list()) await workspace.detachSession(sessionId);
	const header = headers.find((item) => item.id === sessionId);
	if (header === void 0 || persistence === void 0) return false;
	const location = persistence.locate(header);
	if (location === void 0 || location.path === void 0) return false;
	await rm(dirname(location.path), { recursive: true, force: true });
	return true;
}

export function apply(ctx) {
	ensureUnarchive(ctx.workspaceRegistry);

	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/archive-admin",
		handler: async (req, res) => {
			if (req.method !== "POST") {
				res.writeHead(405);
				res.end();
				return;
			}
			if (!isTrustedRequest(req)) {
				res.writeHead(403);
				res.end("forbidden");
				return;
			}
			const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
			let body;
			try {
				body = await readJson(req);
			} catch {
				sendJson(res, 400, { ok: false, error: "invalid JSON body" });
				return;
			}
			const ids = Array.isArray(body?.sessionIds) ? [...new Set(body.sessionIds.map((id) => String(id)))].filter((id) => id.length > 0) : [];
			if (ids.length === 0) {
				sendJson(res, 400, { ok: false, error: "sessionIds must be a non-empty array" });
				return;
			}
			try {
				if (pathname === "/archive-admin/restore") {
					for (const id of ids) await ctx.workspaceRegistry.unarchiveSession(id);
					sendJson(res, 200, { ok: true, archivedSessionIds: [...ctx.workspaceRegistry.archivedSessionIds] });
					return;
				}
				if (pathname === "/archive-admin/delete") {
					const persistence = ctx.get("sessionPersistence");
					const projectionCache = ctx.get("sessionProjectionCache");
					const sessions = ctx.get("sessions");
					const headers = persistence !== void 0 && persistence.supportsRawArtifacts ? await persistence.list() : [];
					const deletedSessionIds = [];
					const liveSessionIds = [];
					for (const id of ids) {
						await ctx.workspaceRegistry.unarchiveSession(id);
						if (projectionCache?.table !== void 0) await projectionCache.table.delete(id).catch(() => {});
						if (await deleteStoredSession(ctx, id, headers, persistence)) deletedSessionIds.push(id);
						if (sessions?.get(id) !== void 0) liveSessionIds.push(id);
					}
					sendJson(res, 200, {
						ok: true,
						archivedSessionIds: [...ctx.workspaceRegistry.archivedSessionIds],
						deletedSessionIds,
						liveSessionIds
					});
					return;
				}
				sendJson(res, 404, { ok: false, error: `unknown archive-admin route ${pathname}` });
			} catch (error) {
				sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
	}), "archive-admin: /archive-admin route");
}
