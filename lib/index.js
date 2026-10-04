import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { parentAgentOptionsForDelegation } from "@deepseek-ai/dsh-subagent";

const name = "per-model-subagent";
const inject = ["subagents", "systemPrompt", "tools"];

// ── Config schema ──────────────────────────────────────────────────────────

const RouteSchema = z.object({
  provider: z.string().required(),
  model: z.string().required()
});

const RuleSchema = z.object({
  parent: RouteSchema,
  allowed: z.array(RouteSchema).default([]),
  default: RouteSchema
});

const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  onViolation: z.string().default("clamp").volatile(),
  rules: z.array(RuleSchema).default([]).volatile()
});

// ── Helpers ────────────────────────────────────────────────────────────────

function routeKey(route) {
  return `${route.provider}/${route.model}`;
}

function routeListHas(routes, route) {
  return routes.some(r => r.provider === route.provider && r.model === route.model);
}

function formatRoute(route) {
  return `${route.provider}/${route.model}`;
}

function parentRouteOf(parent) {
  const opts = parentAgentOptionsForDelegation(parent);
  if (opts.provider === undefined || opts.model === undefined) return undefined;
  return { provider: opts.provider, model: opts.model };
}

/**
 * Read one configured route, treating a half-filled or schema-materialized
 * empty object as absent. Schemastery may materialize an omitted nested object
 * as `{}` rather than `undefined`, so presence must be judged by its fields.
 * @param value - candidate route record.
 * @returns the route, or undefined when it names no provider/model pair.
 */
function routeOf(value) {
  if (value === null || typeof value !== "object") return undefined;
  const { provider, model } = value;
  if (typeof provider !== "string" || provider.length === 0) return undefined;
  if (typeof model !== "string" || model.length === 0) return undefined;
  return { provider, model };
}

/** The parent route a rule governs, or undefined for the fallback rule. */
function ruleParent(rule) {
  return routeOf(rule?.parent);
}

/** The rule's configured substitute route, when it declares one. */
function ruleDefault(rule) {
  return routeOf(rule?.default);
}

/** The routes a rule permits, ignoring malformed entries. */
function ruleAllowed(rule) {
  const list = rule?.allowed;
  if (!Array.isArray(list)) return [];
  return list.map(routeOf).filter((route) => route !== undefined);
}

/**
 * Select the rule governing one parent route: an exact parent match wins,
 * otherwise the single fallback rule (one without a parent route) applies.
 * @param route - the delegating agent's current route.
 * @param rules - configured rules.
 * @returns the governing rule, or undefined when the parent model is unrestricted.
 */
function matchRule(route, rules) {
  let fallback;
  for (const rule of rules) {
    const parent = ruleParent(rule);
    if (parent === undefined) { fallback ??= rule; continue; }
    if (route !== undefined && routeKey(parent) === routeKey(route)) return rule;
  }
  return fallback;
}

// ── Enforcement ────────────────────────────────────────────────────────────

async function enforce(request, signal, ctx, config) {
  if (!config.enabled.get()) return;
  if (request === undefined) return;

  const parent = request.parent;
  if (parent === undefined) return;

  const parentRoute = parentRouteOf(parent);
  const rule = matchRule(parentRoute, config.rules.get());
  if (rule === undefined) return;

  const allowed = ruleAllowed(rule);
  if (allowed.length === 0) {
    ctx.logger?.warn("per-model-subagent: a routing rule declares no usable allowed route; delegation was left unrestricted");
    return;
  }

  const agentOptions = request.agentOptions;
  const explicitRoute = routeOf(agentOptions);
  const effectiveRoute = explicitRoute ?? parentRoute;

  // The child may run the route the parent already runs; that is inside the policy.
  if (effectiveRoute !== undefined && routeListHas(allowed, effectiveRoute)) return;

  const substitute = ruleDefault(rule) ?? allowed[0];
  const parentLabel = parentRoute === undefined ? "unknown" : formatRoute(parentRoute);
  const allowedList = allowed.map(formatRoute).join(", ");

  if (config.onViolation.get() === "reject" && explicitRoute !== undefined) {
    throw new Error(
      `subagent model "${formatRoute(explicitRoute)}" is not allowed for parent model "${parentLabel}". ` +
      `Allowed subagent models: ${allowedList}. ` +
      `Use one of these or omit the child model selection.`
    );
  }

  // Validate the substitute route against the live adapter before installing it.
  const llm = ctx.get("llm");
  if (llm !== undefined && signal !== undefined) {
    try {
      await llm.resolveCallConfig({ provider: substitute.provider, model: substitute.model }, signal);
    } catch (error) {
      throw new Error(
        `per-model-subagent: configured default route "${formatRoute(substitute)}" is not resolvable: ` +
        `${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (explicitRoute !== undefined) {
    ctx.logger?.warn(
      `per-model-subagent: clamped child model from "${formatRoute(explicitRoute)}" to ` +
      `"${formatRoute(substitute)}" for parent model "${parentLabel}"`
    );
  }

  const next = { ...agentOptions, provider: substitute.provider, model: substitute.model };
  // A route change adopts the selected model's default effort, matching DSH's
  // own delegation semantics.
  delete next.reasoningEffort;
  request.agentOptions = next;
}

// ── Plugin ─────────────────────────────────────────────────────────────────

// ── Registration ───────────────────────────────────────────────────────────

/** Process-stable binding slot on the shared `subagents` service. */
const DELEGATION_GATE = Symbol.for("dsh.per-model-subagent.delegationGate");

/** The prompt-context slot that states the current model's routing. */
const ROUTING_CONTEXT_NAME = "subagent:per-model-routing";

/** The model-facing tool that reports the current model's routing. */
const DISCOVERY_TOOL_NAME = "list_allowed_subagent_models";

/**
 * Run one registration, tolerating a duplicate-name rejection. A plugin reload
 * may re-apply against a scope whose registrations are still live; the existing
 * entry already says the same thing, so the duplicate is not an error.
 * @param register - the registration to attempt.
 * @returns the registration's result, or undefined when the name was taken.
 */
function tolerateDuplicate(register) {
  try {
    return register();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already registered/.test(message)) return undefined;
    throw error;
  }
}

/**
 * Reject a rule set that cannot be enforced as declared, so a configuration
 * mistake surfaces when the plugin loads rather than during a delegation.
 * @param rules - configured routing rules.
 */
function validateRules(rules) {
  const seenParents = new Set();
  let fallbackCount = 0;
  for (const rule of rules) {
    const allowed = ruleAllowed(rule);
    if (allowed.length === 0) {
      throw new Error("per-model-subagent: every rule needs at least one allowed route with a non-empty provider and model");
    }
    const parent = ruleParent(rule);
    if (parent === undefined) {
      fallbackCount += 1;
      if (fallbackCount > 1) throw new Error("per-model-subagent: at most one fallback rule (one without a parent route) is allowed");
    } else {
      const key = routeKey(parent);
      if (seenParents.has(key)) throw new Error(`per-model-subagent: duplicate rule for parent model "${key}"`);
      seenParents.add(key);
    }
    const substitute = ruleDefault(rule);
    if (substitute !== undefined && !routeListHas(allowed, substitute)) {
      throw new Error(
        `per-model-subagent: default route "${formatRoute(substitute)}" is not in the allowed list for parent ` +
        `"${parent === undefined ? "(fallback)" : formatRoute(parent)}"`
      );
    }
  }
}

/**
 * Install the delegation gate on the shared subagents service exactly once, and
 * keep it pointed at this plugin's newest binding. The gate reads the binding
 * per call, so a reloaded plugin never keeps enforcing through a stale closure.
 * @param subagents - the shared subagents service.
 * @param binding - this plugin instance's context and configuration.
 * @returns the mutable holder the disposer clears.
 */
function bindDelegationGate(subagents, binding) {
  const existing = subagents[DELEGATION_GATE];
  if (existing !== undefined) {
    existing.current = binding;
    return existing;
  }
  const holder = { current: binding };
  const originalStart = subagents.start;
  const originalStartContinuable = subagents.startContinuable;
  subagents.start = async function (name, request) {
    const active = holder.current;
    if (active !== undefined) await enforce(request, request?.signal, active.ctx, active.config);
    return originalStart.call(this, name, request);
  };
  subagents.startContinuable = async function (spec) {
    const active = holder.current;
    if (active !== undefined) await enforce(spec?.request, spec?.signal, active.ctx, active.config);
    return originalStartContinuable.call(this, spec);
  };
  subagents[DELEGATION_GATE] = holder;
  return holder;
}

/**
 * State the current model's allowed subagent models to the model itself, so an
 * explicit selection is normally already inside the policy.
 * @param ctx - plugin context.
 * @param config - plugin configuration.
 */
function registerGuidance(ctx, config) {
  tolerateDuplicate(() => ctx.systemPrompt.context({
    name: ROUTING_CONTEXT_NAME,
    order: 121,
    text: (assemblyContext) => {
      if (!config.enabled.get()) return "";
      const agent = assemblyContext?.agent;
      if (agent === undefined) return "";
      const rule = matchRule(parentRouteOf(agent), config.rules.get());
      if (rule === undefined) return "";
      const allowed = ruleAllowed(rule);
      if (allowed.length === 0) return "";
      const substitute = ruleDefault(rule);
      let text = `Subagent model routing: the models you may give a subagent are ${allowed.map(formatRoute).join(", ")}.`;
      if (substitute !== undefined) {
        text += ` Omitting the child model selection uses ${formatRoute(substitute)}.`;
      }
      text += ` Use the ${DISCOVERY_TOOL_NAME} tool for the routing that applies right now.`;
      return text;
    }
  }));
}

/**
 * Register the model-facing discovery tool for the current model's routing.
 * @param ctx - plugin context.
 * @param config - plugin configuration.
 */
function registerDiscoveryTool(ctx, config) {
  tolerateDuplicate(() => ctx.tools.register(defineTool({
    name: DISCOVERY_TOOL_NAME,
    description: "List the subagent models allowed for your current model. " +
      "Call this before delegating to a subagent to discover which child models are permitted.",
    parameters: {},
    output: {
      schema: { type: "string" },
      render: (_args, result) => [{ type: "text", text: result }]
    },
    execute(_args, exec) {
      const agent = exec.agent;
      if (agent === undefined) return "No calling agent available.";
      if (!config.enabled.get()) {
        return "Per-model subagent routing is disabled; subagent model selection is unrestricted.";
      }
      const route = parentRouteOf(agent);
      const rule = matchRule(route, config.rules.get());
      const lines = [`Current agent model: ${route === undefined ? "(not resolved)" : formatRoute(route)}`];
      if (rule === undefined) {
        lines.push("No routing rule matches your model; subagent model selection is unrestricted.");
        return lines.join("\n");
      }
      const allowed = ruleAllowed(rule);
      lines.push(allowed.length === 0
        ? "A routing rule matches your model but declares no usable allowed route; selection is unrestricted."
        : `Allowed subagent models: ${allowed.map(formatRoute).join(", ")}`);
      const substitute = ruleDefault(rule);
      if (substitute !== undefined) lines.push(`Default when none is selected: ${formatRoute(substitute)}`);
      return lines.join("\n");
    }
  })));
}

// ── Plugin ─────────────────────────────────────────────────────────────────

function apply(ctx, config) {
  const onViolation = config.onViolation.get();
  if (onViolation !== "clamp" && onViolation !== "reject") {
    throw new Error(`per-model-subagent: onViolation must be "clamp" or "reject", got "${onViolation}"`);
  }
  validateRules(config.rules.get());

  const binding = { ctx, config };
  const holder = bindDelegationGate(ctx.subagents, binding);
  ctx.effect(() => () => {
    if (holder.current === binding) holder.current = undefined;
  }, "per-model-subagent: release delegation gate");

  registerGuidance(ctx, config);
  registerDiscoveryTool(ctx, config);
}

export { Config, apply, inject, name };
