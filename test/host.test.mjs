// Behavioral harness for dsh-per-model-subagent: exercises apply() and the
// delegation gate against fakes, so no DSH boot is required. The plugin's bare
// @deepseek-ai/* imports must resolve, so run this where the package is
// installed inside a DSH runtime (see README, "测试"). Set DSH_PMS_MODULE to a
// bare specifier or file URL to point at another copy.
import assert from "node:assert/strict";

const specifier = process.env.DSH_PMS_MODULE ?? "dsh-per-model-subagent";
const { apply, name, inject } = await import(specifier);

const route = (provider, model) => ({ provider, model });

/** A config object shaped like cordis' volatile refs. */
function config({ enabled = true, onViolation = "clamp", rules = [] } = {}) {
  return {
    enabled: { get: () => enabled },
    onViolation: { get: () => onViolation },
    rules: { get: () => rules }
  };
}

/** A minimal cordis-like context capturing the plugin's registrations. */
function fakeCtx() {
  const captured = { contexts: [], tools: [], effects: [] };
  const calls = { start: [], startContinuable: [] };
  const subagents = {
    async start(n, request) { calls.start.push({ n, request }); return { id: "run" }; },
    async startContinuable(spec) { calls.startContinuable.push(spec); return { childId: "child" }; }
  };
  const ctx = {
    subagents,
    logger: { warn: () => {} },
    get: () => undefined,
    effect: (fn) => { const dispose = fn(); if (typeof dispose === "function") captured.effects.push(dispose); return () => {}; },
    systemPrompt: { context: (entry) => { captured.contexts.push(entry); return () => {}; } },
    tools: { register: (definition) => { captured.tools.push(definition); return () => {}; } }
  };
  return { ctx, captured, calls, subagents };
}

/** A delegating parent agent whose current route is the given one. */
function parent(provider, model) {
  const header = { config: route(provider, model) };
  return { options: route(provider, model), session: { requestHeader: () => header } };
}

const cases = [];
const test = (label, fn) => cases.push({ label, fn });

// ── matching and clamping ──────────────────────────────────────────────────

test("an allowed explicit child route passes through untouched", async () => {
  const { ctx, calls } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a")] }] }));
  const request = { parent: parent("p", "parent"), agentOptions: route("p", "child-a") };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("p", "child-a"));
  assert.equal(calls.start.length, 1);
});

test("a disallowed explicit route is clamped to the rule default", async () => {
  const { ctx, calls } = fakeCtx();
  apply(ctx, config({
    rules: [{
      parent: route("p", "parent"),
      allowed: [route("p", "child-a"), route("p", "child-b")],
      default: route("p", "child-b")
    }]
  }));
  const request = { parent: parent("p", "parent"), agentOptions: { ...route("other", "x"), reasoningEffort: "high" } };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("p", "child-b"));
  assert.equal(request.agentOptions.reasoningEffort, undefined, "route change drops the foreign effort");
  assert.equal(calls.start.length, 1);
});

test("clamping falls back to the first allowed route without an explicit default", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a"), route("p", "child-b")] }] }));
  const request = { parent: parent("p", "parent"), agentOptions: route("other", "x") };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("p", "child-a"));
});

test("an inherited parent route outside the allowed set is clamped", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a")] }] }));
  const request = { parent: parent("p", "parent") };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("p", "child-a"));
});

test("a parent route inside the allowed set keeps an unspecified child route", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "parent")] }] }));
  const request = { parent: parent("p", "parent") };
  await ctx.subagents.start("spawn", request);
  assert.equal(request.agentOptions, undefined);
});

test("reject mode refuses a disallowed explicit route", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ onViolation: "reject", rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a")] }] }));
  const request = { parent: parent("p", "parent"), agentOptions: route("other", "x") };
  await assert.rejects(() => ctx.subagents.start("spawn", request), /not allowed for parent model/);
});

test("reject mode still clamps a merely inherited disallowed route", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ onViolation: "reject", rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a")] }] }));
  const request = { parent: parent("p", "parent") };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("p", "child-a"));
});

test("the fallback rule governs an unlisted parent model", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ rules: [{ allowed: [route("p", "only")] }] }));
  const request = { parent: parent("z", "unknown") };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("p", "only"));
});

test("a parent model with no matching rule and no fallback is unrestricted", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a")] }] }));
  const request = { parent: parent("z", "unlisted"), agentOptions: route("other", "x") };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("other", "x"));
});

test("a disabled plugin never rewrites the request", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ enabled: false, rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a")] }] }));
  const request = { parent: parent("p", "parent"), agentOptions: route("other", "x") };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("other", "x"));
});

// ── continuable path ───────────────────────────────────────────────────────

test("startContinuable is gated through spec.request", async () => {
  const { ctx, calls } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a")] }] }));
  const spec = { provider: "spawn", label: "t", request: { parent: parent("p", "parent"), agentOptions: route("other", "x") } };
  await ctx.subagents.startContinuable(spec);
  assert.deepEqual(spec.request.agentOptions, route("p", "child-a"));
  assert.equal(calls.startContinuable.length, 1);
});

// ── registrations ──────────────────────────────────────────────────────────

test("plugin metadata and registrations are well formed", () => {
  const { ctx, captured } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a")] }] }));
  assert.equal(name, "per-model-subagent");
  assert.deepEqual(inject, ["subagents", "systemPrompt", "tools"]);
  assert.equal(captured.contexts.length, 1);
  assert.equal(captured.contexts[0].name, "subagent:per-model-routing");
  assert.ok(Number.isFinite(captured.contexts[0].order));
  assert.equal(captured.tools.length, 1);
  assert.equal(captured.tools[0].name, "list_allowed_subagent_models");
});

test("the prompt context states the allowed models for the assembling agent", () => {
  const { ctx, captured } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a"), route("p", "child-b")] }] }));
  const text = captured.contexts[0].text({ agent: parent("p", "parent") });
  assert.match(text, /p\/child-a, p\/child-b/);
  assert.equal(captured.contexts[0].text({}), "", "no agent contributes nothing");
  const unlisted = captured.contexts[0].text({ agent: parent("z", "unlisted") });
  assert.equal(unlisted, "");
});

test("the discovery tool reports the calling agent's routing", async () => {
  const { ctx, captured } = fakeCtx();
  apply(ctx, config({
    rules: [{
      parent: route("p", "parent"),
      allowed: [route("p", "child-a")],
      default: route("p", "child-a")
    }]
  }));
  const tool = captured.tools[0];
  const answer = await tool.execute({}, { agent: parent("p", "parent") });
  assert.match(answer, /Current agent model: p\/parent/);
  assert.match(answer, /Allowed subagent models: p\/child-a/);
  assert.match(answer, /Default when none is selected: p\/child-a/);
  const free = await tool.execute({}, { agent: parent("z", "unlisted") });
  assert.match(free, /unrestricted/);
});

// ── validation ─────────────────────────────────────────────────────────────

test("invalid rule sets are rejected at load time", () => {
  const cases = [
    [{ parent: route("p", "a"), allowed: [] }, /at least one allowed route/],
    [{ parent: route("p", "a") }, /at least one allowed route/],
    [{ allowed: [] }, /at least one allowed route/],
    [{ parent: route("p", "a"), allowed: [route("p", "c")], default: route("p", "z") }, /is not in the allowed list/]
  ];
  const duplicate = [
    { parent: route("p", "a"), allowed: [route("p", "c")] },
    { parent: route("p", "a"), allowed: [route("p", "d")] }
  ];
  for (const [rule, pattern] of cases) {
    const { ctx } = fakeCtx();
    assert.throws(() => apply(ctx, config({ rules: [rule] })), pattern);
  }
  const { ctx } = fakeCtx();
  assert.throws(() => apply(ctx, config({ rules: duplicate })), /duplicate rule for parent model/);
  const { ctx: bad } = fakeCtx();
  assert.throws(() => apply(bad, config({ onViolation: "explode" })), /onViolation must be/);
});

test("a single fallback rule is valid, and an incomplete default is ignored", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ rules: [{ allowed: [route("p", "c")], default: { provider: "p" } }] }));
  const request = { parent: parent("z", "unknown"), agentOptions: route("x", "y") };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("p", "c"), "an unusable default falls back to the first allowed route");
});

test("two fallback rules are refused", () => {
  const { ctx } = fakeCtx();
  assert.throws(
    () => apply(ctx, config({ rules: [{ allowed: [route("p", "a")] }, { allowed: [route("p", "b")] }] })),
    /at most one fallback rule/
  );
});

test("a schema-materialized empty parent object still acts as the fallback rule", async () => {
  const { ctx } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: {}, allowed: [route("p", "only")] }] }));
  const request = { parent: parent("z", "unknown") };
  await ctx.subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("p", "only"));
});

// ── gate identity ──────────────────────────────────────────────────────────

test("re-applying keeps one gate and rebinds it to the newest configuration", async () => {
  const { ctx, subagents, calls } = fakeCtx();
  const firstStart = subagents.start;
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "first")] }] }));
  const gatedStart = subagents.start;
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "second")] }] }));
  assert.equal(subagents.start, gatedStart, "the gate is installed once");
  assert.notEqual(gatedStart, firstStart);
  const request = { parent: parent("p", "parent"), agentOptions: route("x", "y") };
  await subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("p", "second"), "the newest binding wins");
  assert.equal(calls.start.length, 1);
});

test("releasing the binding turns the gate back into a pass-through", async () => {
  const { ctx, captured, subagents } = fakeCtx();
  apply(ctx, config({ rules: [{ parent: route("p", "parent"), allowed: [route("p", "child-a")] }] }));
  captured.effects.forEach((dispose) => dispose());
  const request = { parent: parent("p", "parent"), agentOptions: route("other", "x") };
  await subagents.start("spawn", request);
  assert.deepEqual(request.agentOptions, route("other", "x"));
});

test("duplicate registrations are tolerated instead of fatal", () => {
  const { ctx } = fakeCtx();
  const duplicateError = () => { throw new Error('prompt context "subagent:per-model-routing" is already registered in this scope'); };
  ctx.systemPrompt.context = duplicateError;
  const toolError = () => { throw new Error('tool "list_allowed_subagent_models" is already registered in this scope'); };
  ctx.tools.register = toolError;
  assert.doesNotThrow(() => apply(ctx, config({ rules: [] })));
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
