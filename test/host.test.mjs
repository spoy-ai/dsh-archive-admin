// Offline integration test for the dsh-archive-admin host half: drives the
// plugin's apply() against a simulated cordis context and exercises the
// /archive-admin routes end to end (restore, delete, live-session reporting,
// request-trust gate). Run with `node test/host.test.mjs`.
import { apply, name, inject } from "../lib/index.js";
import { mkdir, writeFile, rm as fsRm, access } from "node:fs/promises";

let failures = 0;
const assert = (cond, msg) => {
	if (cond) console.log("  PASS", msg);
	else { failures += 1; console.error("  FAIL", msg); }
};

const ROOT = "/tmp/dsh-archive-admin-test";

// --- fake workspace registry (mirrors stock dsh-workspace instance shape) ---
const workspaceEntity = {
	workspaceId: "ws1",
	sessionIds: ["s1", "s2", "s3"],
	async detachSession(id) { this.sessionIds = this.sessionIds.filter((x) => x !== id); }
};
const state = { initialized: true, workspaceIds: ["ws1"], archivedSessionIds: ["s1", "s2", "s3"] };
const registry = {
	state,
	requireState() { return this.state; },
	async setState(next) { this.state = next; },
	enqueueOperation(fn) { return fn(); },
	list() { return [workspaceEntity]; },
	get archivedSessionIds() { return [...this.state.archivedSessionIds]; }
};

// --- fake services ---
const sessionsStore = { get: (id) => (id === "s_live" ? {} : void 0) };
const projectionTable = { deleted: [], async delete(id) { projectionTable.deleted.push(id); return true; } };
const persistence = {
	supportsRawArtifacts: true,
	async list() { return [{ id: "s1" }, { id: "s2" }, { id: "s3" }]; },
	locate(header) { return { kind: "jsonl", path: `${ROOT}/sessions/${header.id}/session.jsonl.zstd` }; }
};

const ctx = {
	workspaceRegistry: registry,
	get(name) {
		switch (name) {
			case "sessions": return sessionsStore;
			case "sessionPersistence": return persistence;
			case "sessionProjectionCache": return { table: projectionTable };
			default: return void 0;
		}
	},
	effect(cb, label) { const cleanup = cb(); return () => cleanup?.(); }
};

// --- fixture log files ---
await fsRm(ROOT, { recursive: true, force: true });
for (const id of ["s1", "s2", "s3"]) {
	await mkdir(`${ROOT}/sessions/${id}`, { recursive: true });
	await writeFile(`${ROOT}/sessions/${id}/session.jsonl.zstd`, "fake");
}

let registeredRoute;
ctx.webServer = { register(route) { registeredRoute = route; return () => {}; } };

console.log("host plugin exports:", { name, inject: inject.join(",") });
assert(typeof apply === "function", "apply is a function");

apply(ctx);
assert(typeof registry.unarchiveSession === "function", "runtime-patched unarchiveSession onto registry");
assert(registeredRoute?.kind === "prefix" && registeredRoute.path === "/archive-admin", "registered /archive-admin prefix route");

function drive(pathname, body, headers = { host: "127.0.0.1:3080" }) {
	const chunks = [Buffer.from(JSON.stringify(body))];
	const req = {
		method: "POST",
		url: pathname,
		headers,
		[Symbol.asyncIterator]: () => ({ next: async () => chunks.length ? { value: chunks.shift(), done: false } : { done: true } })
	};
	let status, payload;
	const res = {
		writeHead(s) { status = s; },
		end(p) { if (p != null && p !== "") { try { payload = JSON.parse(p); } catch { payload = String(p); } } }
	};
	return registeredRoute.handler(req, res).then(() => ({ status, payload }));
}

console.log("\n-- restore flow --");
let r = await drive("/archive-admin/restore", { sessionIds: ["s1"] });
assert(r.status === 200 && r.payload.ok === true, "restore responds 200 ok");
assert(JSON.stringify(registry.archivedSessionIds) === JSON.stringify(["s2", "s3"]), "s1 removed from archive set");
assert(await access(`${ROOT}/sessions/s1/session.jsonl.zstd`).then(() => true, () => false), "restore does NOT delete the log");

console.log("\n-- delete flow --");
r = await drive("/archive-admin/delete", { sessionIds: ["s2"] });
assert(r.status === 200 && r.payload.ok === true, "delete responds 200 ok");
assert(JSON.stringify(r.payload.archivedSessionIds) === JSON.stringify(["s3"]), "s2 removed from archive set");
assert(JSON.stringify(r.payload.deletedSessionIds) === JSON.stringify(["s2"]), "deletedSessionIds contains s2");
assert((await access(`${ROOT}/sessions/s2`).then(() => true, () => false)) === false, "s2 log directory removed");
assert(projectionTable.deleted.includes("s2"), "s2 projection-cache row dropped");
assert(!workspaceEntity.sessionIds.includes("s2"), "s2 detached from workspace accounting");

console.log("\n-- live session: log removed + reported --");
await writeFile(`${ROOT}/sessions/s3/session.jsonl.zstd`, "fake");
sessionsStore.get = (id) => (id === "s3" ? {} : void 0);
r = await drive("/archive-admin/delete", { sessionIds: ["s3"] });
assert(JSON.stringify(r.payload.deletedSessionIds) === JSON.stringify(["s3"]), "live session log still removed from disk");
assert(JSON.stringify(r.payload.liveSessionIds) === JSON.stringify(["s3"]), "live session reported in liveSessionIds");
assert((await access(`${ROOT}/sessions/s3`).then(() => true, () => false)) === false, "live session log directory removed");

console.log("\n-- bad input --");
r = await drive("/archive-admin/restore", { sessionIds: [] });
assert(r.status === 400, "empty sessionIds -> 400");
r = await drive("/archive-admin/nope", { sessionIds: ["x"] });
assert(r.status === 404, "unknown route -> 404");

console.log("\n-- request trust --");
r = await drive("/archive-admin/restore", { sessionIds: ["s1"] }, { host: "127.0.0.1:3080", "sec-fetch-site": "cross-site" });
assert(r.status === 403, "cross-site sec-fetch-site -> 403");
r = await drive("/archive-admin/restore", { sessionIds: ["s1"] }, { host: "127.0.0.1:3080", origin: "http://evil.example" });
assert(r.status === 403, "mismatched origin -> 403");
r = await drive("/archive-admin/restore", { sessionIds: ["s1"] }, { host: "evil.example" });
assert(r.status === 403, "non-loopback host -> 403");
r = await drive("/archive-admin/restore", { sessionIds: ["s1"] }, { host: "127.0.0.1:3080", origin: "http://127.0.0.1:3080" });
assert(r.status === 200, "matching loopback origin -> 200");

await fsRm(ROOT, { recursive: true, force: true });
console.log(`\n${failures === 0 ? "ALL HOST TESTS PASSED" : failures + " FAILURES"}`);
process.exit(failures === 0 ? 0 : 1);
