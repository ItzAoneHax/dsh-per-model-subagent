# dsh-per-model-subagent [![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

English | [中文](README.md)

**dsh-per-model-subagent** is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that restricts the models a subagent may run on, per **parent model** (the conversational model that delegates): out-of-policy selections are substituted or rejected, unspecified selections fall back to a designated default, and a bilingual settings page is available on the web client's Plugins page.

<p align="center">
  <img src="https://img.shields.io/github/v/release/ItzAoneHax/dsh-per-model-subagent?style=flat-square" alt="Version">
  &nbsp;
  <img src="https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4c6ef5?style=flat-square&labelColor=454a54" alt="DSH">
  &nbsp;
  <img src="https://img.shields.io/badge/cordis-v4-8b5cf6?style=flat-square" alt="Cordis">
  &nbsp;
  <img src="https://img.shields.io/badge/platform-web%20%C2%B7%20host-14b8a6?style=flat-square" alt="Platform">
  &nbsp;
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
</p>

<div align="center">

[What it does](#what-it-does) · [Routing decisions](#routing-decisions) · [Install](#install) · [Configuration](#configuration) · [Settings page](#settings-page) · [Compatibility](#compatibility) · [Development and tests](#development-and-tests)

</div>

## What it does

Native DSH leaves subagent model selection entirely to the delegating model: one "spawn a subagent" call can either reuse the parent or name any configured model. In a multi-model deployment that is usually not what you want — a heavy model burns tokens by keeping exploration tasks for itself, while a light one quietly hands the final draft to an underpowered model.

dsh-per-model-subagent installs a delegation gate on the `subagents` service and applies routing rules keyed by the current conversational model:

- **Per-parent-model routing** — each rule binds one parent model `provider/model` and declares the allowlist of models a subagent may use plus a default substitute route; a rule with an empty parent is the fallback for every unlisted model (at most one).
- **Two violation policies** — `clamp` (default) rewrites an out-of-policy route to the rule's default; `reject` refuses the delegation and lists the allowed models in the error. Only explicit selections get rejected; a route merely inherited from the parent is always substituted safely, never rejected.
- **The model knows its policy** — a system-prompt context tells the current model which subagent models it may use and which one is the default, and a `list_allowed_subagent_models` tool reports the routing in effect right now, so explicit selections are normally inside the policy to begin with.
- **Validated substitution** — before rewriting a route, the substitute is resolved through the host's `llm.resolveCallConfig`; a misconfigured default fails loudly at delegation time instead of silently. A rewritten route adopts the target model's default reasoning effort, matching DSH's own delegation semantics.
- **Load-time validation** — a rule without a usable allowlist, duplicate parents, more than one fallback, or a default outside the allowlist is rejected when the plugin loads, not mid-run.
- **Reload-safe** — the gate is installed exactly once on the shared service, rebinds to the newest configuration on plugin reload, and reverts to a pass-through on dispose; no stale closures, no double gates.

## Routing decisions

On every subagent start (`start` / `startContinuable`), the parent route is resolved, the governing rule is selected by exact parent match and then fallback, and:

| Situation | `onViolation: clamp` (default) | `onViolation: reject` |
| --- | --- | --- |
| Explicitly selected model is inside the allowlist | Passes through untouched | Passes through untouched |
| Explicitly selected model is outside the allowlist | Substituted with the rule's `default` (the first allowlist entry when unset), with a warning logged | The delegation is refused; the error lists the allowed models |
| No explicit selection, parent's own route outside the allowlist | Substituted with the `default` (as above) | Substituted as well (an inherited route is not an explicit violation) |
| No rule matches the parent and no fallback exists | Unrestricted | Unrestricted |
| Plugin disabled (`enabled: false`) | Unrestricted; rules are kept | Unrestricted; rules are kept |

## Install

With the `dsh` CLI available:

```sh
dsh plugin --profile web add github:ItzAoneHax/dsh-per-model-subagent
```

Restart `dsh web` afterwards. The plugin is mounted through its bundle patch: a profile that selects `dsh-per-model-subagent` in `dsh.profile.bundles` merges in the loader row, and the profile's own `cordis.patch.yml` only overrides that row's `config`:

```yaml
- id: per-model-subagent
  name: dsh-per-model-subagent
  config:
    enabled: true
    onViolation: clamp
    rules:
      # deepseek-flash conversations may only hand tasks to these subagent models
      - parent: { provider: deepseek-account, model: deepseek-flash }
        allowed:
          - { provider: deepseek-account, model: deepseek-flash }
          - { provider: xiaomi, model: mimo-v2.6-flash }
        default: { provider: xiaomi, model: mimo-v2.6-flash }
      # Fallback rule: every other parent model may only use qfmodel
      - allowed:
          - { provider: qoder-cn, model: qfmodel }
```

To temporarily disable the plugin, add `disabled: true` to that row; the rules are kept.

> [!WARNING]
> Do not also mount a manual `insert` row for this plugin in the profile patch file: two mounts register the same tool and delegation gate twice.

## Configuration

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Master switch. When off, subagent model selection is unrestricted and configured rules are kept. |
| `onViolation` | string | `"clamp"` | Violation policy: `clamp` substitutes the default model; `reject` refuses explicit out-of-policy selections. |
| `rules` | rule[] | `[]` | Routing rules, see below. |

Each `rule`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `parent` | `{ provider, model }` | no | The parent model this rule governs; omitted (or both fields empty) means the fallback rule, which covers every unlisted model — at most one. |
| `allowed` | `{ provider, model }[]` | yes | The allowlist of models a subagent may use; at least one entry, with non-empty provider and model. |
| `default` | `{ provider, model }` | no | The substitute route; must be one of `allowed`, defaults to the first entry. |

## Settings page

Everything above can be edited visually on the web client under **Settings → Plugins → Subagent model routing**, no patch files required:

- the page ships Chinese and English copy and follows the client's language;
- provider and model fields offer autocomplete fed by the host's model catalog — hand-typing still works when the catalog is unavailable;
- saving runs the same validation as the host (parent fields come in pairs, at least one allowed model, the default must be allowed, at most one fallback, no duplicate parents);
- changes made elsewhere surface as a conflict with an explicit reload choice, and read-only deployments say so instead of failing to save.

## Compatibility

- DSH `>= 0.2.0-rc.2` (peer dependencies `@deepseek-ai/dsh-subagent` and `@deepseek-ai/dsh-tools` both require `>=0.2.0-rc.2`)
- cordis `>= 4`, schemastery `>= 3`
- The settings page runs on the web client (`platform: web`); the host-side gate and model guidance do not depend on the web UI and work in headless profiles alike

## Development and tests

```sh
node test/client.test.mjs   # offline tests for the settings page (react stubbed, no DSH required)
node test/host.test.mjs     # behavioral tests for the delegation gate (run inside a DSH runtime with @deepseek-ai/* installed)
```

Set `DSH_PMS_MODULE` to a bare specifier or file URL to point the behavioral tests at another copy.

## License

[MIT](LICENSE)
