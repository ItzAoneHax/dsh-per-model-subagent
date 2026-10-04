# dsh-per-model-subagent

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的子代理委托加上
**按父模型（当前对话模型）限定子代理模型**的能力，并在 Web 客户端的插件设置页提供配置界面。

「父模型」就是你在对话界面里选择的模型，无论它来自哪个提供方（`deepseek-account`、`xiaomi`、
`qoder-cn`、`opencode-go` …），因此**对话界面模型选择里的每个模型都能各自配置**。

## 功能

- 为**每个父模型**配置允许的子代理模型清单：`deepseek-flash` 能做的不等于 `mimo-v2.6-pro` 能做的
- 违反清单时按配置**替换**为该规则的默认模型，或**直接拒绝**这次委托
- 把当前模型可用的子代理模型写进运行时上下文，让模型一开始就知道边界
- 提供 `list_allowed_subagent_models` 工具，模型可随时查询当前生效的路由
- 在 **设置 → 插件** 页面提供配置界面（启用开关、违规处理、规则表、模型目录下拉建议）

## 工作原理

宿主半包（`lib/index.js`）包装 `ctx.subagents` 的两个入口，在子代理被建立**之前**介入：

| 入口 | 覆盖的委托 |
|------|-----------|
| `subagents.start(name, request)` | 前台 / 后台的一次性（one-shot）委托 |
| `subagents.startContinuable(spec)` | 可继续（continuable）委托 |

判定的是**子代理最终要跑的模型**：

1. 子代理若显式给了 `provider`/`model`，用这个；没给则它本会继承父模型，就用父模型
2. 用父模型匹配规则：精确匹配优先，否则用「回退规则」（没写 `parent` 的那条）
3. 命中且被允许 → 原样放行；不命中 →
   - `clamp`：改写为该规则的 `default`（缺省 `allowed[0]`）。因为路由变了，会一并清掉原有的
     `reasoning_effort`，让新模型用自身默认推理强度（与 DSH「换路由不带强度就用新模型默认值」一致）
   - `reject`：报错拒绝——但只拒绝**显式选择**；仅仅「继承父模型」这种没得选的情况仍会替换，
     避免把该父模型的委托整个堵死
4. 替换后的路由会先用 `llm.resolveCallConfig` 验证真实可用，再交给子代理

另外注册：

- 一条运行时上下文（命中规则时才出现），告知模型当前可用的子代理模型
- `list_allowed_subagent_models` 工具，无参数，返回调用者当前模型对应的允许清单

闸门装在共享的 `subagents` 服务上（`Symbol.for` 槽位）且只装一次，每次加载把绑定指向最新配置，
所以热重载不会留下指向旧闭包的「僵尸」闸门；插件卸载后闸门自动变回直通。

## 安装

### 方式 A：通过插件管理器安装（推荐，完全托管）

1. 准备 tgz：

   ```bash
   npm pack          # 产出 dsh-per-model-subagent-0.1.1.tgz
   ```

2. 在 DSH 里打开 **设置 → 插件 → 安装**，填入该 tgz 的绝对路径。

   管理器会把它加入 profile 依赖、安装进 profile 的 `node_modules`、把包名加入
   `dsh.profile.bundles` 并重载。

3. 刷新一次浏览器页面（客户端半包随新页面加载），然后打开 **设置 → 插件 → 子智能体模型路由**。

profile 目录：Windows 为 `%USERPROFILE%\.dsh\profiles\<profile>`，其他平台为
`~/.dsh/profiles/<profile>`。Desktop 应用的 profile 由应用独占管理，`dsh plugin` CLI 无法写入。

### 方式 B：手动安装（等价于管理器所做的步骤）

1. 把包加进 profile 的 `package.json` 依赖：

   ```json
   "dsh-per-model-subagent": "file:/abs/path/dsh-per-model-subagent-0.1.1.tgz"
   ```

2. 在 profile 目录用该 DSH 自带的 pnpm 安装：

   ```bash
   cd <profile-dir>
   node <dsh-runtime>/pnpm/bin/pnpm.mjs install
   ```

3. 在 profile `package.json` 的 `dsh.profile.bundles` 末尾追加 `dsh-per-model-subagent`。

   包自带的 `cordis.patch.yml`（由 `dsh.bundle.patch` 声明）会插入插件的 loader 行——
   **插件行由包自己挂载**，这是它能被插件管理器识别和管理的关键。普通顶层补丁行不会插入条目，
   只会覆盖已存在的行。

4. （可选，但要让插件管理器的启停开关可定位）在 profile 的 `cordis.patch.yml` 加一条**普通顶层行**：

   ```yaml
   - id: per-model-subagent
     name: dsh-per-model-subagent
     config: {}
   ```

5. 触发一次 profile 重载（改一下 `cordis.patch.yml` 就会被热加载）或重启应用。

> 不要另外在 profile 补丁层手写 `insert:` 挂载同一插件——那会重复挂载，出现两份工具与两道闸门。

## 设置页面

**设置 → 插件 → 子智能体模型路由**（Settings → Plugins），由包内客户端半包
`lib/client.js`（`dsh.client` 声明，`platform: web`）注册进 `plugins.item` 插槽提供。

页面包含：

- 启用开关：关闭后不限制子代理模型选择（规则保留）
- 违规处理方式：替换为该规则默认模型 / 直接拒绝委托
- 规则表：每条规则的父模型、允许的子代理模型清单、默认模型；规则与允许项均可增删
- provider / model 输入框带模型目录下拉建议（与对话界面模型选择同一份目录），也可手填任意路由
- 保存走 DSH settings 的修订号栅栏；其他位置改动过时会提示重新载入

客户端模块变更需要刷新浏览器页面才会生效（除非同时在跑 `pnpm run dev:web`）。

## 配置参考

### 字段

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enabled` | boolean | `true` | 总开关 |
| `onViolation` | string | `"clamp"` | `clamp` 换成默认模型；`reject` 直接报错拒绝 |
| `rules` | array | `[]` | 路由规则；**留空 = 完全不生效**，不改变任何现有行为 |

### 规则字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `parent` | `{provider, model}` | 否 | 该规则管哪个父模型；**省略即为回退规则**，对所有未列出的父模型生效 |
| `allowed` | `{provider, model}[]` | 是 | 该父模型允许交给子代理的模型 |
| `default` | `{provider, model}` | 否 | 被拒绝或未指定子代理模型时改用谁；缺省为 `allowed[0]`；必须在 `allowed` 内 |

约束：回退规则最多一条；同一父模型不能重复；`allowed` 不能为空；`default` 必须在 `allowed` 内。
违反会在插件加载时报错（DSH 的「失败要响」风格），而不是悄悄降级。

### 示例

```yaml
rules:
  # 便宜模型当父模型时，只允许交给便宜的子代理模型
  - parent: { provider: deepseek-account, model: deepseek-flash }
    allowed:
      - { provider: deepseek-account, model: deepseek-flash }
      - { provider: xiaomi, model: mimo-v2.6-flash }
    default: { provider: deepseek-account, model: deepseek-flash }

  # 强模型当父模型时，可以交给强一些的子代理模型
  - parent: { provider: deepseek-account, model: deepseek-v4-pro }
    allowed:
      - { provider: deepseek-account, model: deepseek-flash }
      - { provider: xiaomi, model: mimo-v2.6-pro }
      - { provider: qoder-cn, model: qfmodel }
    default: { provider: xiaomi, model: mimo-v2.6-pro }
```

### 与全局白名单的关系

DSH 自带的 `subagent-model-selection-settings` 提供一份**全局**允许模型清单，本插件的规则在它之后
进一步收紧。因此 `allowed` 应是全局白名单的子集，否则会出现「模型选了却被全局挡掉」的困惑。

## 工具

### `list_allowed_subagent_models`

无参数。返回调用它的 agent 当前模型对应的允许清单，例如：

```
Current agent model: deepseek-account/deepseek-flash
Allowed subagent models: deepseek-account/deepseek-flash, xiaomi/mimo-v2.6-flash
Default when none is selected: deepseek-account/deepseek-flash
```

没有匹配规则时返回 `... is unrestricted.`；`enabled: false` 时也会如实报告已停用。

## 测试

```bash
# 设置页面：13 项——纯函数（草稿归一化/校验/写操作/模型目录）、插槽接线、一次真实渲染
node test/client.test.mjs

# 宿主行为：21 项——放行/替换/拒绝/回退/继承被拦/校验/重载重绑定/卸载直通/重复注册容错
node test/host.test.mjs
```

`client.test.mjs` 不需要 DSH，直接可跑。`host.test.mjs` 用假的 cordis context 驱动插件，
不需要启动 DSH，但插件里的 `@deepseek-ai/*` 导入必须能解析——所以在**装有本包的 DSH 运行时**里运行它，
或把 `DSH_PMS_MODULE` 指向另一个可解析的副本（裸包名或 file URL）。

## 已知限制

- 设置页的插件条目停用后会从列表消失（没有可配置的行），重新启用需用 profile 的 bundle 选择，
  或把 profile 补丁行里的 `disabled` 改回 `false`。
- 只约束「模型选择」，不改变权限、深度、并发等其它委托策略。
- 需要 DSH 的 `subagents`、`systemPrompt`、`tools` 三个宿主服务。
- 客户端页面依赖 `@deepseek-ai/dsh-client-ui-settings`、`@deepseek-ai/dsh-client-ui-plugin-manager`、
  `@deepseek-ai/dsh-client-locale` 三个客户端包（`dsh.client.inject` 已声明）。

## 许可

MIT
