// Offline verification of the settings page: load the client bundle with a
// stubbed module loader and react, then exercise the pure helpers, the slot
// wiring, and one real render pass through the component.
import assert from "node:assert/strict";

const clientPath = new URL("../lib/client.js", import.meta.url);

/** Capture the module spec the bundle registers with the client module loader. */
let captured;
globalThis.window = {
	__ModuleLoader__: {
		load: (spec) => {
			captured = spec;
		}
	}
};
await import(clientPath.href);

assert.ok(captured, "the bundle registered with the module loader");
assert.equal(captured.id, "dsh-per-model-subagent");

/** A minimal react stand-in: hooks are stateless, createElement builds a tree. */
const reactStub = {
	createElement(type, props, ...children) {
		return {
			type,
			props: props ?? {},
			children: children.flat(Infinity).filter((child) => child !== null && child !== void 0 && child !== false)
		};
	},
	useState(initial) {
		return [typeof initial === "function" ? initial() : initial, () => {}];
	},
	useEffect() {}
};

const plugin = captured.factory((name) => {
	if (name === "react") return reactStub;
	throw new Error(`unexpected require(${JSON.stringify(name)})`);
});

const { __test } = plugin;
assert.ok(__test, "the bundle exports its pure helpers");
assert.equal(plugin.NAMESPACE, "per-model-subagent", "the page id must match the config namespace");

const cases = [];
const test = (label, fn) => cases.push({ label, fn });

// ── draft normalization ────────────────────────────────────────────────────

test("an absent value normalizes to the plugin's own defaults", () => {
	assert.deepEqual(__test.draftOf(void 0), { enabled: true, onViolation: "clamp", rules: [] });
	assert.deepEqual(__test.draftOf(null).rules, []);
	assert.deepEqual(__test.draftOf({ rules: "junk" }).rules, []);
});

test("a stored rule round-trips through draft and back", () => {
	const stored = {
		enabled: false,
		onViolation: "reject",
		rules: [
			{
				parent: { provider: "deepseek-account", model: "deepseek-flash" },
				allowed: [
					{ provider: "deepseek-account", model: "deepseek-flash" },
					{ provider: "xiaomi", model: "mimo-v2.6-flash" }
				],
				default: { provider: "xiaomi", model: "mimo-v2.6-flash" }
			},
			{ allowed: [{ provider: "qoder-cn", model: "qfmodel" }] }
		]
	};
	const draft = __test.draftOf(stored);
	assert.equal(draft.enabled, false);
	assert.equal(draft.onViolation, "reject");
	assert.equal(draft.rules[0].parentProvider, "deepseek-account");
	assert.equal(draft.rules[0].allowed.length, 2);
	assert.equal(draft.rules[1].parentProvider, "", "a rule without a parent stays the fallback rule");
	assert.deepEqual(__test.rulesOf(draft), stored.rules);
});

test("a schema-materialized empty parent still reads as the fallback rule", () => {
	const draft = __test.draftOf({ rules: [{ parent: {}, allowed: [{ provider: "p", model: "c" }], default: {} }] });
	assert.equal(draft.rules[0].parentProvider, "");
	assert.equal(draft.rules[0].parentModel, "");
	assert.equal(draft.rules[0].defaultProvider, "");
	assert.deepEqual(__test.rulesOf(draft), [{ allowed: [{ provider: "p", model: "c" }] }]);
});

// ── validation ─────────────────────────────────────────────────────────────

test("a well-formed draft has no issues", () => {
	assert.deepEqual(__test.issuesOf(__test.draftOf({
		rules: [{ parent: { provider: "p", model: "a" }, allowed: [{ provider: "p", model: "b" }], default: { provider: "p", model: "b" } }]
	})), []);
});

test("structural mistakes are reported", () => {
	const base = () => __test.draftOf({ rules: [{ parent: { provider: "p", model: "a" }, allowed: [{ provider: "p", model: "b" }] }] });
	const halfParent = base();
	halfParent.rules[0].parentModel = "";
	assert.match(__test.issuesOf(halfParent).join("\n"), /needs both provider and model/);

	const emptyAllowed = base();
	emptyAllowed.rules[0].allowed = [{ provider: "", model: "" }];
	assert.match(__test.issuesOf(emptyAllowed).join("\n"), /at least one allowed model/);

	const halfAllowed = base();
	halfAllowed.rules[0].allowed = [{ provider: "p", model: "" }];
	assert.match(__test.issuesOf(halfAllowed).join("\n"), /every allowed model needs both/);

	const outsideDefault = base();
	outsideDefault.rules[0].defaultProvider = "p";
	outsideDefault.rules[0].defaultModel = "z";
	assert.match(__test.issuesOf(outsideDefault).join("\n"), /must also be an allowed model/);

	const duplicate = base();
	duplicate.rules.push(__test.draftOf({ rules: [{ parent: { provider: "p", model: "a" }, allowed: [{ provider: "p", model: "c" }] }] }).rules[0]);
	assert.match(__test.issuesOf(duplicate).join("\n"), /duplicate rule for parent model/);

	const twoFallbacks = __test.draftOf({
		rules: [{ allowed: [{ provider: "p", model: "a" }] }, { allowed: [{ provider: "p", model: "b" }] }]
	});
	assert.match(__test.issuesOf(twoFallbacks).join("\n"), /At most one fallback rule/);
});

test("a blank rule row is valid once filled", () => {
	const row = __test.emptyRuleRow();
	const draft = { enabled: true, onViolation: "clamp", rules: [row] };
	assert.ok(__test.issuesOf(draft).length > 0, "a blank row is not yet savable");
	row.allowed = [{ provider: "p", model: "c" }];
	assert.deepEqual(__test.issuesOf(draft), []);
});

// ── write operations ───────────────────────────────────────────────────────

test("a save submits exactly the three volatile fields", () => {
	const draft = __test.draftOf({ rules: [{ allowed: [{ provider: "p", model: "c" }] }] });
	assert.deepEqual(__test.opsOf(draft), [
		{ op: "set", path: ["enabled"], value: true },
		{ op: "set", path: ["onViolation"], value: "clamp" },
		{ op: "set", path: ["rules"], value: [{ allowed: [{ provider: "p", model: "c" }] }] }
	]);
});

test("route text is trimmed and half-filled allowed rows are dropped", () => {
	const draft = __test.draftOf({
		rules: [{ parent: { provider: " p ", model: " a " }, allowed: [{ provider: " p ", model: " b " }, { provider: "", model: "" }] }]
	});
	assert.deepEqual(__test.rulesOf(draft), [{ parent: { provider: "p", model: "a" }, allowed: [{ provider: "p", model: "b" }] }]);
});

// ── catalog ────────────────────────────────────────────────────────────────

test("the host model catalog becomes sorted datalist options", () => {
	const lists = __test.catalogLists({
		groups: [
			{ id: "xiaomi", models: [{ id: "mimo-v2.6-pro" }, { id: "mimo-v2.6-flash" }] },
			{ id: "deepseek-account", models: [{ id: "deepseek-flash" }] },
			{ id: "xiaomi", models: [{ id: "mimo-v2.6-pro" }] }
		]
	});
	assert.deepEqual(lists.providers.values, ["deepseek-account", "xiaomi"]);
	assert.deepEqual(lists.models.values, ["deepseek-flash", "mimo-v2.6-flash", "mimo-v2.6-pro"]);
	assert.deepEqual(__test.catalogLists(void 0).providers.values, []);
});

// ── slot wiring ────────────────────────────────────────────────────────────

test("the page registers into plugins.item under the config namespace", () => {
	const registrations = [];
	const disposers = [];
	const form = { getSnapshot: () => ({ status: "ready", writable: true, revision: 0, value: {} }), subscribe: () => () => {}, mutate: async () => true, dispose: () => { disposers.push("form"); } };
	const ctx = {
		effect: (fn) => {
			const dispose = fn();
			dispose !== void 0 && disposers.push(dispose);
			return () => {};
		},
		locale: { bind: () => (key) => key, register: () => () => {} },
		configForms: { get: (ns) => (ns === "per-model-subagent" ? form : void 0) },
		slots: {
			inject: (_name, fn) => fn(),
			register: (options, Component) => {
				registrations.push({ options, Component });
				return () => {};
			}
		},
		get: () => void 0
	};
	plugin.apply(ctx);
	assert.deepEqual(plugin.inject, ["slots", "locale", "configForms"]);
	assert.equal(registrations.length, 1);
	const { options, Component } = registrations[0];
	assert.equal(options.name, "plugins.item");
	assert.equal(options.id, "per-model-subagent");
	assert.equal(typeof options.label, "function");
	assert.equal(options.label(), "title");
	assert.ok(Number.isFinite(options.order));
	const face = options.inject();
	assert.equal(face.form, form);
	assert.equal(typeof face.t, "function");
	assert.equal(face.loadCatalog().constructor, Promise);
	return face.loadCatalog().then((value) => assert.equal(value, null, "no remote means no catalog, not a failure"));
});

// ── render smoke test ──────────────────────────────────────────────────────

/** Collect every rendered string, from children and from string-valued props. */
function stringsOf(node) {
	const found = [];
	const visit = (value) => {
		if (typeof value === "string") found.push(value);
		else if (Array.isArray(value)) value.forEach(visit);
		else if (value !== null && typeof value === "object") {
			if (value.props !== void 0) {
				for (const entry of Object.values(value.props)) if (typeof entry === "string") found.push(entry);
				visit(value.children);
			} else visit(Object.values(value));
		}
	};
	visit(node);
	return found;
}

test("the page renders stored rules, controls, and the save action", () => {
	const value = {
		enabled: true,
		onViolation: "clamp",
		rules: [{
			parent: { provider: "deepseek-account", model: "deepseek-flash" },
			allowed: [{ provider: "deepseek-account", model: "deepseek-flash" }, { provider: "xiaomi", model: "mimo-v2.6-flash" }],
			default: { provider: "xiaomi", model: "mimo-v2.6-flash" }
		}]
	};
	const form = { getSnapshot: () => ({ status: "ready", writable: true, revision: 3, value }), subscribe: () => () => {} };
	let rendered;
	const ctx = {
		effect: (fn) => {
			fn();
			return () => {};
		},
		locale: { bind: () => (key) => key, register: () => () => {} },
		configForms: { get: () => form },
		slots: { inject: (_name, fn) => fn(), register: (_options, Page) => { rendered = Page; return () => {}; } },
		get: () => void 0
	};
	plugin.apply(ctx);
	assert.equal(typeof rendered, "function");
	const tree = rendered({ form, t: (key) => key, loadCatalog: async () => null });
	const strings = stringsOf(tree);
	for (const expected of ["description", "enabled", "enabledHelp", "onViolation", "rules", "rulesHelp", "addRule", "removeRule", "addAllowed", "removeAllowed", "save", "parent", "allowed", "fallbackDefault"]) {
		assert.ok(strings.includes(expected), `the page renders "${expected}"`);
	}
	assert.ok(strings.includes("deepseek-account"), "the stored provider is rendered");
	assert.ok(strings.includes("xiaomi"), "the stored default provider is rendered");
});

test("the page renders an empty state without rules and never throws on junk", () => {
	const form = { getSnapshot: () => ({ status: "ready", writable: false, revision: 0, value: { rules: [{}] } }), subscribe: () => () => {} };
	let rendered;
	const ctx = {
		effect: (fn) => {
			fn();
			return () => {};
		},
		locale: { bind: () => (key) => key, register: () => () => {} },
		configForms: { get: () => form },
		slots: { inject: (_name, fn) => fn(), register: (_options, Page) => { rendered = Page; return () => {}; } },
		get: () => void 0
	};
	plugin.apply(ctx);
	const tree = rendered({ form, t: (key) => key, loadCatalog: async () => null });
	const strings = stringsOf(tree);
	assert.ok(strings.includes("readOnly"), "a read-only deployment says so");
	assert.ok(strings.includes("save"));
});

test("a loading namespace renders the loading state, not a broken form", () => {
	const form = { getSnapshot: () => ({ status: "loading", writable: false, revision: void 0, value: void 0 }), subscribe: () => () => {} };
	let rendered;
	const ctx = {
		effect: (fn) => {
			fn();
			return () => {};
		},
		locale: { bind: () => (key) => key, register: () => () => {} },
		configForms: { get: () => form },
		slots: { inject: (_name, fn) => fn(), register: (_options, Page) => { rendered = Page; return () => {}; } },
		get: () => void 0
	};
	plugin.apply(ctx);
	const tree = rendered({ form, t: (key) => key, loadCatalog: async () => null });
	assert.deepEqual(stringsOf(tree), ["loading"]);
});

// ── run ────────────────────────────────────────────────────────────────────

let failed = 0;
for (const item of cases) {
	try {
		await item.fn();
		console.log(`ok   ${item.label}`);
	} catch (error) {
		failed += 1;
		console.error(`FAIL ${item.label}\n     ${error?.message ?? error}`);
	}
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed === 0 ? 0 : 1);
