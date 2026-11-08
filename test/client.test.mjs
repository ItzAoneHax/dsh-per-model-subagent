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
	useEffect() {},
	useRef(initial) {
		return { current: initial };
	}
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
//
// The provider/model lists ARE the host catalog `remote.session.modelCatalog()`
// projects — the same value the workspace's own model picker reads — so both
// halves of a route are chosen from what the conversation can actually select.

/** A catalog shaped like the one `remote.session.modelCatalog()` returns. */
const sampleCatalog = {
	groups: [
		{ id: "xiaomi", name: "Xiaomi", models: [{ id: "mimo-v2.6-pro", name: "MiMo-V2.6-Pro" }, { id: "mimo-v2.6-flash", name: "MiMo-V2.6-Flash" }] },
		{ id: "deepseek-account", name: "DeepSeek", models: [{ id: "deepseek-flash", name: "DeepSeek-V4.1-Flash" }] },
		// A provider that advertises no usable model is not offerable, matching
		// the picker's own "non-empty provider groups" projection.
		{ id: "empty-provider", name: "Empty", models: [] }
	]
};


test("the host model catalog becomes provider entries in catalog order", () => {
	const providers = __test.catalogOf(sampleCatalog).providers;
	assert.deepEqual(providers.map((provider) => provider.id), ["xiaomi", "deepseek-account"], "catalog order is kept and empty providers are dropped");
	assert.deepEqual(providers[0].models, [{ id: "mimo-v2.6-pro", name: "MiMo-V2.6-Pro" }, { id: "mimo-v2.6-flash", name: "MiMo-V2.6-Flash" }]);
	assert.deepEqual(__test.catalogOf(void 0), { providers: [], failures: [] });
	assert.deepEqual(__test.catalogOf({ groups: [{ id: "p" }, { models: [{ id: "m" }] }] }).providers, [], "providers without usable models never reach the list");
});

test("a provider the host could not read is reported, not silently dropped", () => {
	const face = __test.catalogOf({
		groups: [{ id: "xiaomi", models: [{ id: "mimo-v2.6-flash", name: "MiMo-V2.6-Flash" }] }],
		failures: [{ id: "opencode-go", name: "OpenCode Go", message: "401 unauthorized" }, { id: "", message: "ignored" }]
	});
	assert.deepEqual(face.providers.map((provider) => provider.id), ["xiaomi"]);
	assert.deepEqual(face.failures, [{ id: "opencode-go", message: "401 unauthorized" }], "the reason a provider is missing stays visible on the page");
});

test("the provider list offers the catalog plus routes the catalog lost", () => {
	const providers = __test.catalogOf(sampleCatalog).providers;
	const stored = [{ provider: "qoder-cn", model: "qfmodel" }, { provider: "xiaomi", model: "mimo-v2.6-flash" }];
	assert.deepEqual(__test.providerChoices(providers, sampleCatalog, stored), [
		{ value: "xiaomi", label: "xiaomi", available: true },
		{ value: "deepseek-account", label: "deepseek-account", available: true },
		{ value: "qoder-cn", label: "qoder-cn", available: false }
	], "a stored provider the catalog no longer serves stays selectable and is marked");
});

test("the model list is narrowed to the chosen provider", () => {
	const providers = __test.catalogOf(sampleCatalog).providers;
	assert.deepEqual(__test.modelChoices(providers, "deepseek-account", [], ""), [
		{ value: "deepseek-flash", label: "DeepSeek-V4.1-Flash", available: true }
	], "another provider's models never appear as an option");
	assert.deepEqual(__test.modelChoices(providers, "", [], ""), [], "no provider means no model option");
	assert.deepEqual(__test.modelChoices(providers, "xiaomi", [], "mimo-v2.6-pro").map((choice) => choice.value), ["mimo-v2.6-pro", "mimo-v2.6-flash"]);
});

test("a stored route outside the catalog stays visible and marked", () => {
	const providers = __test.catalogOf(sampleCatalog).providers;
	const choices = __test.modelChoices(providers, "xiaomi", [{ provider: "xiaomi", model: "mimo-legacy" }], "mimo-legacy");
	assert.deepEqual(choices.map((choice) => choice.value), ["mimo-v2.6-pro", "mimo-v2.6-flash", "mimo-legacy"]);
	assert.deepEqual(choices[2], { value: "mimo-legacy", label: "mimo-legacy", available: false });
	assert.equal(__test.catalogModelName(providers[0], "mimo-v2.6-pro"), "MiMo-V2.6-Pro");
	assert.equal(__test.catalogModelName(providers[0], "gone"), "gone", "an unknown model falls back to its id");
});

test("the stored routes of one rule are read for the option lists", () => {
	const rule = __test.emptyRuleRow();
	rule.parentProvider = "xiaomi";
	rule.parentModel = "mimo-v2.6-pro";
	rule.defaultProvider = "deepseek-account";
	rule.defaultModel = "deepseek-flash";
	assert.deepEqual(__test.storedRoutesOf(rule), [
		{ provider: "xiaomi", model: "mimo-v2.6-pro" },
		{ provider: "deepseek-account", model: "deepseek-flash" }
	], "the blank allowed row names no route and is dropped");
});

// ── slot wiring ────────────────────────────────────────────────────────────

test("the page registers as a dedicated DSH Settings section", () => {
	const registrations = [];
	const disposers = [];
	const calls = [];
	const form = { getSnapshot: () => ({ status: "ready", writable: true, revision: 0, value: {} }), subscribe: () => () => {}, mutate: async () => true, dispose: () => { disposers.push("form"); } };
	const remote = {
		session: {
			modelCatalog: async () => {
				calls.push("modelCatalog");
				return { ok: true, value: { groups: [{ id: "xiaomi", name: "Xiaomi", models: [{ id: "mimo-v2.6-flash", name: "MiMo-V2.6-Flash" }] }] } };
			}
		}
	};
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
		remote,
		// A deliberately absent `get`: the catalog read must go through the injected
		// service, never through a dynamic lookup that Cordis cannot resolve.
		get: () => void 0
	};
	plugin.apply(ctx);
	assert.deepEqual(plugin.inject, ["slots", "locale", "configForms", "remote", "remote.session", "remote.settings"], "every service the entry reads must be declared, including the settings write transport");
	assert.equal(registrations.length, 1);
	const { options, Component } = registrations[0];
	assert.equal(options.name, "settings.section");
	assert.equal(options.id, "per-model-subagent");
	assert.equal(options.order, 45);
	assert.equal(typeof options.label, "function");
	assert.equal(options.label(), "title");
	assert.ok(Number.isFinite(options.order));
	const face = options.inject();
	assert.equal(face.formController, form);
	assert.equal(face.form, void 0, "the owner's `form` prop must never be shadowed by the entry's inject");
	assert.equal(typeof face.t, "function");
	return face.loadCatalog().then((value) => {
		assert.deepEqual(calls, ["modelCatalog"], "the catalog is read from the injected remote service");
		assert.deepEqual(value, {
			catalog: { groups: [{ id: "xiaomi", name: "Xiaomi", models: [{ id: "mimo-v2.6-flash", name: "MiMo-V2.6-Flash" }] }] },
			projection: { providers: [{ id: "xiaomi", models: [{ id: "mimo-v2.6-flash", name: "MiMo-V2.6-Flash" }] }], failures: [] }
		}, "and carries the raw catalog with its projection");
	});
});

test("the settings save path preserves the host rejection and refreshes the form", async () => {
	let face;
	let recoveries = 0;
	let response = { ok: false, error: { message: "revision mismatch: expected 2, received 1" } };
	const calls = [];
	const form = {
		getSnapshot: () => ({ status: "ready", value: {}, revision: 1, writable: true }),
		subscribe: () => () => {},
		mutate: async () => { throw new Error("the boolean-only fallback must not hide the host error"); },
		recover: () => { recoveries += 1; return new Promise(() => {}); }
	};
	const ctx = {
		effect: (fn) => { fn(); return () => {}; },
		locale: { bind: () => (key) => key, register: () => () => {} },
		configForms: { get: () => form },
		slots: { inject: (_name, fn) => fn(), register: (options) => { face = options.inject(); return () => {}; } },
		remote: { settings: { mutate: async (ns, ops, revision) => { calls.push({ ns, ops, revision }); return response; } } }
	};
	plugin.apply(ctx);
	const ops = [{ op: "set", path: ["enabled"], value: true }];
	assert.deepEqual(await face.saveConfig(ops, 1), { accepted: false, error: "revision mismatch: expected 2, received 1" });
	response = { ok: true };
	assert.deepEqual(await face.saveConfig(ops, 2), { accepted: true });
	assert.deepEqual(calls.map((call) => call.ns), ["per-model-subagent", "per-model-subagent"]);
	assert.equal(recoveries, 2, "cache recovery starts without blocking either save result");
});

test("a host without the catalog remote is not a failure", () => {
	let rendered;
	const ctx = {
		effect: (fn) => {
			fn();
			return () => {};
		},
		locale: { bind: () => (key) => key, register: () => () => {} },
		configForms: { get: () => void 0 },
		slots: { inject: (_name, fn) => fn(), register: (_options, Page) => { rendered = Page; return () => {}; } },
		remote: { session: {} },
		get: () => void 0
	};
	plugin.apply(ctx);
	assert.equal(typeof rendered, "function", "the page still registers");
});

// ── the props the Plugins page actually hands the entry ────────────────────
//
// `plugins.item` is rendered by ui-renderer as
//   standard kit + entry inject + owner props      (owner wins)
// so `renderSlot("plugins.item", { view, form }, { only: id })` REPLACES any
// injected prop that shares a name with the owner's. The page must therefore
// read the owner's face, and the card's summary view must stay inert: a throw
// inside an entry is caught by the slot's per-entry boundary, which then
// abdicates (retires) that entry for the rest of the session — the card and its
// page both disappear until the client plugin is applied again.

/** Register the page and return its component plus the face its inject provides. */
function registerPage(controllerSnapshot = { status: "unavailable", value: void 0, revision: void 0, writable: false }) {
	let rendered;
	let face;
	const ctx = {
		effect: (fn) => {
			fn();
			return () => {};
		},
		locale: { bind: () => (key) => key, register: () => () => {} },
		configForms: { get: () => ({ getSnapshot: () => controllerSnapshot, subscribe: () => () => {}, mutate: async () => false }) },
		slots: {
			inject: (_name, fn) => fn(),
			register: (options, Component) => {
				rendered = Component;
				face = options.inject();
				return () => {};
			}
		},
		get: () => void 0
	};
	plugin.apply(ctx);
	return { Component: rendered, face, t: (key) => key };
}

/** The `plugins.item` page view's own form face: a point-in-time snapshot plus the write queue. */
function ownerFace(value, revision = 7) {
	const writes = [];
	return {
		writes,
		face: {
			state: { status: "ready", value, base: value, user: value, revision, writable: true, mode: "host" },
			mutate: async (ops, expected) => {
				writes.push({ ops, expected });
				return true;
			}
		}
	};
}

test("the settings section renders the complete form directly", () => {
	const value = { enabled: true, rules: [{ allowed: [{ provider: "p", model: "c" }] }] };
	const { Component, face } = registerPage({ status: "ready", value, revision: 1, writable: true });
	// settings.section supplies only { close }; the entry's own inject supplies
	// the shared controller, locale, and catalog loader.
	const strings = pageStrings(Component, { ...face, close: () => {} });
	for (const control of ["save", "addRule", "rulesHelp", "removeRule"]) {
		assert.ok(strings.includes(control), `the settings section renders "${control}"`);
	}
});

test("the page view renders the form the Plugins page hands it", () => {
	const { Component, face } = registerPage();
	const value = {
		enabled: true,
		onViolation: "clamp",
		rules: [{
			parent: { provider: "deepseek-account", model: "deepseek-flash" },
			allowed: [{ provider: "xiaomi", model: "mimo-v2.6-flash" }]
		}]
	};
	const { face: handed, writes } = ownerFace(value, 11);
	// Owner props win over the entry's own inject, so this is the real shape.
	const strings = pageStrings(Component, { ...face, view: "page", form: handed });
	for (const expected of ["save", "rules", "addAllowed", "removeRule"]) {
		assert.ok(strings.includes(expected), `the page renders "${expected}"`);
	}
	assert.ok(strings.includes("xiaomi"), "the stored rule is rendered from the owner's snapshot");
	assert.deepEqual(writes, [], "rendering alone must not write");
});

test("the page view survives an owner that supplies no form", () => {
	const { Component, face } = registerPage();
	const strings = pageStrings(Component, { ...face, view: "page", form: void 0 });
	assert.ok(strings.includes("unavailable"), "an unserved namespace says so, not a crash");
});

test("the page view tolerates a bare controller in the owner's form prop", () => {
	const { Component, face } = registerPage();
	const controller = {
		getSnapshot: () => ({ status: "ready", value: { enabled: false, rules: [] }, revision: 2, writable: true }),
		subscribe: () => () => {},
		mutate: async () => true
	};
	const strings = pageStrings(Component, { ...face, view: "page", form: controller });
	assert.ok(strings.includes("save"));
	assert.ok(strings.includes("empty"), "a rule-less namespace says so");
});

test("the plugin never disposes the settings provider's shared form", () => {
	const disposers = [];
	let disposed = 0;
	const form = {
		getSnapshot: () => ({ status: "ready", value: {}, revision: 0, writable: true }),
		subscribe: () => () => {},
		mutate: async () => true,
		dispose: () => {
			disposed += 1;
		}
	};
	const ctx = {
		effect: (fn) => {
			const dispose = fn();
			dispose !== void 0 && disposers.push(dispose);
			return () => {};
		},
		locale: { bind: () => (key) => key, register: () => () => {} },
		configForms: { get: () => form },
		slots: { inject: (_name, fn) => fn(), register: () => () => {} },
		get: () => void 0
	};
	plugin.apply(ctx);
	for (const dispose of disposers) dispose();
	assert.equal(disposed, 0, "ctx.configForms owns the shared form's lifetime");
});

// ── render smoke test ──────────────────────────────────────────────────────

/**
 * Resolve function elements the way React's renderer does, so a component that
 * returns another component (the entry dispatcher) is expanded before reading.
 */
function renderToHost(node) {
	if (Array.isArray(node)) return node.map(renderToHost);
	if (node === null || typeof node !== "object") return node;
	if (typeof node.type === "function") return renderToHost(node.type({ ...node.props }));
	return { ...node, children: (node.children ?? []).map(renderToHost) };
}

/** Render one entry through the stub react and collect every string it shows. */
function pageStrings(Component, props) {
	return stringsOf(renderToHost(Component(props)));
}

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

/** Collect every rendered element, outermost first. */
function nodesOf(node) {
	const found = [];
	const visit = (value) => {
		if (Array.isArray(value)) value.forEach(visit);
		else if (value === null || typeof value !== "object") return;
		else if (value.props !== void 0) {
			found.push(value);
			visit(value.children);
		} else visit(Object.values(value));
	};
	visit(node);
	return found;
}

/** Collect every `select` the entry rendered, in document order. */
function selectsOf(node) {
	const found = [];
	const visit = (value) => {
		if (Array.isArray(value)) value.forEach(visit);
		else if (value === null || typeof value !== "object") return;
		else if (value.props !== void 0) {
			if (value.type === "select") found.push(value);
			visit(value.children);
		} else visit(Object.values(value));
	};
	visit(node);
	return found;
}

/** The values a rendered `select` offers, in order. */
function optionValues(select) {
	return select.children.filter((child) => child.type === "option").map((option) => option.props.value);
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
	const form = { getSnapshot: () => ({ status: "ready", writable: true, revision: 3, value }), subscribe: () => () => {}, mutate: async () => true };
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
	const strings = pageStrings(rendered, { formController: form, t: (key) => key, catalog: sampleCatalog, loadCatalog: async () => null });
	for (const expected of ["description", "enabled", "enabledHelp", "onViolation", "rules", "rulesHelp", "addRule", "removeRule", "addAllowed", "removeAllowed", "save", "parent", "stepAllowed", "stepDefault", "guideTitle", "addFallbackRule", "saveHint"]) {
		assert.ok(strings.includes(expected), `the page renders "${expected}"`);
	}
	assert.ok(strings.includes("deepseek-account"), "the stored provider is rendered");
	assert.ok(strings.includes("xiaomi"), "the stored default provider is rendered");
});

test("every route field is a list of the models the conversation can select", () => {
	const value = {
		enabled: true,
		onViolation: "clamp",
		rules: [{
			parent: { provider: "deepseek-account", model: "deepseek-flash" },
			allowed: [{ provider: "deepseek-account", model: "deepseek-flash" }, { provider: "xiaomi", model: "mimo-v2.6-flash" }],
			default: { provider: "qoder-cn", model: "qfmodel" }
		}]
	};
	const { Component, face } = registerPage({ status: "ready", value, revision: 1, writable: true });
	const selects = selectsOf(renderToHost(Component({ ...face, view: "page", catalog: sampleCatalog }))).filter((select) => select.props["aria-label"] === "provider" || select.props["aria-label"] === "model");
	assert.deepEqual(selects.map((select) => select.props["aria-label"]), [
		"provider", "model", // parent
		"provider", "model", // first allowed model
		"provider", "model", // second allowed model
		"provider", "model" // default
	]);
	assert.ok(selects.every((select) => select.props.value !== void 0), "each list keeps the stored selection");

	const providers = ["", "xiaomi", "deepseek-account", "qoder-cn"];
	for (const at of [0, 2, 4, 6]) assert.deepEqual(optionValues(selects[at]), providers, "every route field offers the catalog's providers plus the routes the config still stores");
	assert.deepEqual(optionValues(selects[1]), ["", "deepseek-flash"], "the parent model list is that provider's models");
	assert.deepEqual(optionValues(selects[5]), ["", "mimo-v2.6-pro", "mimo-v2.6-flash"], "each allowed row narrows to its provider, in catalog order");
	assert.deepEqual(optionValues(selects[7]), ["", "qfmodel"], "a stored default route the catalog lost keeps its model");
	assert.equal(selects[7].props.value, "qfmodel", "and it stays the selected value");
});

test("a route the catalog no longer serves is marked in the list", () => {
	const value = {
		enabled: true,
		rules: [{ allowed: [{ provider: "xiaomi", model: "mimo-legacy" }] }]
	};
	const { Component, face } = registerPage({ status: "ready", value, revision: 1, writable: true });
	const selects = selectsOf(renderToHost(Component({ ...face, view: "page", catalog: sampleCatalog }))).filter((select) => select.props["aria-label"] === "provider" || select.props["aria-label"] === "model");
	const modelSelect = selects[3];
	assert.deepEqual(optionValues(modelSelect), ["", "mimo-v2.6-pro", "mimo-v2.6-flash", "mimo-legacy"]);
	const labels = modelSelect.children.filter((child) => child.type === "option").map((option) => option.children.join(""));
	assert.equal(labels[0], "modelUnset");
	assert.equal(labels[1], "MiMo-V2.6-Pro");
	assert.equal(labels[2], "MiMo-V2.6-Flash");
	assert.equal(labels[3], "mimo-legacy unavailableOption", "an unlisted stored route is labelled as unavailable");
});

test("an unavailable model catalog says so and offers a retry", () => {
	// A read that only settles after mount needs a real reconciler; what this stub
	// can pin is the state such a read leaves behind — a catalog that offers no
	// route at all, whether it is missing or simply empty. The stub also keeps its
	// initial state for the rest of the process, so this is its own mount.
	const value = { enabled: true, rules: [] };
	const { Component, face } = registerPage({ status: "ready", value, revision: 1, writable: true });
	const failed = renderToHost(Component({ ...face, view: "page", catalog: {}, loadCatalog: async () => null }));
	const strings = stringsOf(failed);
	assert.ok(strings.includes("catalogFailed"), "the page explains why no model can be chosen");
	assert.ok(strings.includes("retry"), "and offers a retry");
	assert.ok(nodesOf(failed).some((node) => node.type === "button" && node.children.includes("retry")), "the retry is a button");
});

test("the page renders an empty state without rules and never throws on junk", () => {
	const form = { getSnapshot: () => ({ status: "ready", writable: false, revision: 0, value: { rules: [{}] } }), subscribe: () => () => {}, mutate: async () => false };
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
	const strings = pageStrings(rendered, { formController: form, t: (key) => key, loadCatalog: async () => null });
	assert.ok(strings.includes("readOnly"), "a read-only deployment says so");
	assert.ok(strings.includes("save"));
});

test("a loading namespace renders the loading state, not a broken form", () => {
	const form = { getSnapshot: () => ({ status: "loading", writable: false, revision: void 0, value: void 0 }), subscribe: () => () => {}, mutate: async () => false };
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
	assert.deepEqual(pageStrings(rendered, { formController: form, t: (key) => key, loadCatalog: async () => null }), ["loading"]);
});

test("the empty state explains the next action and unrestricted status", () => {
	const { Component, face } = registerPage({ status: "ready", value: { enabled: true, rules: [] }, revision: 1, writable: true });
	const strings = pageStrings(Component, { ...face, catalog: sampleCatalog });
	for (const expected of ["guideTitle", "emptyTitle", "empty", "statusNoRules", "addRule", "addFallbackRule"]) {
		assert.ok(strings.includes(expected), `the empty state renders "${expected}"`);
	}
});

test("a fallback rule is named and its coverage is stated", () => {
	const { Component, face } = registerPage({
		status: "ready",
		value: { enabled: true, rules: [{ allowed: [{ provider: "xiaomi", model: "mimo-v2.6-flash" }] }] },
		revision: 1,
		writable: true
	});
	const tree = renderToHost(Component({ ...face, catalog: sampleCatalog }));
	const strings = stringsOf(tree);
	assert.ok(strings.includes("ruleFallback"));
	assert.ok(strings.includes("statusFallback"));
	const fallbackButton = nodesOf(tree).find((node) => node.type === "button" && node.children.includes("addFallbackRule"));
	assert.equal(fallbackButton.props.disabled, true, "a second fallback cannot be added");
});

test("validation messages use the page translator", () => {
	const draft = __test.draftOf({ rules: [{ parent: { provider: "xiaomi" }, allowed: [] }] });
	const issues = __test.issuesOf(draft, (key, variables) => `${key}:${variables?.index ?? ""}`);
	assert.deepEqual(issues, ["issueParentPair:1", "issueAllowedRequired:1"]);
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
