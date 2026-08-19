// Smoke test for the dsh-archive-admin client half: evaluate the bundle
// factory in a mocked __ModuleLoader__ and assert the plugin exports the
// expected {apply, inject, name} shape (the same contract the web shell's
// client module loader expects). Run with `node test/client.test.mjs`.
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

globalThis.__registered = undefined;
globalThis.window = {
	__ModuleLoader__: {
		load(handoff) { globalThis.__registered = handoff; }
	}
};

const mockRequire = (spec) => {
	switch (spec) {
		case "react":
			return { useState: (v) => [v, () => {}], useMemo: (fn) => fn(), useEffect: () => {} };
		case "react/jsx-runtime":
			return { jsx: () => ({}), jsxs: () => ({}), Fragment: Symbol("Fragment") };
		case "@deepseek-ai/dsh-client-ui-primitives":
			return { Modal: () => ({}), Button: () => ({}), IconArchiveOutline20: () => ({}) };
		default:
			throw new Error(`unexpected require: ${spec}`);
	}
};

new Function("require", src)(mockRequire);
const handoff = globalThis.__registered;
if (handoff == null) throw new Error("bundle did not call window.__ModuleLoader__.load");

const exports = handoff.factory(mockRequire);
if (typeof exports.apply !== "function") throw new Error("missing apply");
if (!Array.isArray(exports.inject) || exports.inject.length === 0) throw new Error("bad inject");
if (typeof exports.name !== "string") throw new Error("bad name");
if (new Set(exports.inject).size !== exports.inject.length) throw new Error("duplicate inject entries");

console.log("client exports:", Object.keys(exports).join(", "));
console.log("inject:", exports.inject.join(","), "| name:", exports.name);
console.log("CLIENT FACTORY EVALUATION OK");
