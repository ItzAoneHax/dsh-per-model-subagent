# dsh-per-model-subagent [![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

中文 | [English](README.en.md)

**dsh-per-model-subagent** 是一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，按**父模型**（发起委托的对话模型）限定子智能体可使用的模型：越权选择被替换或拒绝，未显式选择时落到指定默认模型，并在 Web 客户端「插件」页提供中英双语的规则设置界面。

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

[是什么](#是什么) · [路由判定](#路由判定) · [安装](#安装) · [配置](#配置) · [Web-设置页](#web-设置页) · [兼容性](#兼容性) · [开发与测试](#开发与测试) · [制作](#制作)

</div>

## 是什么

原生 DSH 把子智能体的模型选择完全交给发起委托的模型：同一个「委派任务」调用，既可以复用父模型，也可以指名任何一个已配置的模型。多模型部署里这通常不是你想要的——重度模型把探索任务也揽给自己烧钱，轻量模型偷偷把终稿交给能力不足的模型来完成。

dsh-per-model-subagent 在 `subagents` 服务上装一道委托门（delegation gate），按当前对话模型套用路由规则：

- **按父模型路由** —— 每条规则绑定一个父模型 `provider/model`，声明允许子代理使用的模型白名单与默认替代路由；父模型留空的回退规则对一切未列出的模型生效（至多一条）。
- **两种违规处置** —— `clamp`（默认）把越权路由替换为规则默认模型；`reject` 直接拒绝本次委托并把允许列表写进错误信息。只有显式选择才会被拒绝；继承自父模型的路由始终安全替换，不会误伤。
- **模型自知** —— 向当前模型注入系统提示上下文，说明可用的子代理模型与默认值；并注册 `list_allowed_subagent_models` 工具，供模型在委托前查询当下生效的路由。显式选择通常一开始就在策略之内。
- **替换前校验** —— 改写路由前先经宿主 `llm.resolveCallConfig` 解析目标路由，配置错误的默认路由在委托时立即报错而不是静默失败；改写后沿用目标模型的默认思考档位，与 DSH 自身的委托语义一致。
- **加载期校验** —— 规则缺可用白名单、父模型重复、回退规则多于一条、默认路由不在白名单内，都在插件加载时报错，不留到运行中。
- **热重载安全** —— 委托门在共享服务上只安装一次，插件重载后自动改绑最新配置，卸载后恢复透传，不会留下过期闭包或双重门。

## 路由判定

每次子智能体启动（`start` / `startContinuable`）时，先解析父模型路由，再按「精确匹配父模型 → 回退规则」选定规则，然后：

| 交接现场 | `onViolation: clamp`（默认） | `onViolation: reject` |
| --- | --- | --- |
| 显式选择的模型在白名单内 | 原样通过 | 原样通过 |
| 显式选择的模型不在白名单内 | 替换为规则 `default`（未配置则取白名单第一项），并记录告警日志 | 拒绝本次委托，错误信息列出允许模型 |
| 未显式选择，父模型自身不在白名单内 | 替换为 `default`（同上） | 同样替换（继承路由不算显式违规） |
| 父模型没有匹配规则，也没有回退规则 | 不干预 | 不干预 |
| 插件已停用（`enabled: false`） | 不干预，规则保留 | 不干预，规则保留 |

## 安装

在装有 `dsh` CLI 的环境中：

```sh
dsh plugin --profile web add github:ItzAoneHax/dsh-per-model-subagent
```

安装后重启 `dsh web` 生效。本插件通过 bundle patch 挂载：profile 的 `dsh.profile.bundles` 选中 `dsh-per-model-subagent` 即合并出挂载行，profile 自己的 `cordis.patch.yml` 只需覆盖该行的 `config`：

```yaml
- id: per-model-subagent
  name: dsh-per-model-subagent
  config:
    enabled: true
    onViolation: clamp
    rules:
      # deepseek-flash 的对话只能把任务交给下列子代理模型
      - parent: { provider: deepseek-account, model: deepseek-flash }
        allowed:
          - { provider: deepseek-account, model: deepseek-flash }
          - { provider: xiaomi, model: mimo-v2.6-flash }
        default: { provider: xiaomi, model: mimo-v2.6-flash }
      # 回退规则：其余所有父模型都只能交给 qfmodel
      - allowed:
          - { provider: qoder-cn, model: qfmodel }
```

要临时停用整个插件，在该行加上 `disabled: true` 即可，规则会被保留。

> [!WARNING]
> 不要再在 profile patch 里手动 `insert` 一行同名挂载：同一插件被挂载两次，工具与委托门都会注册两遍。

## 配置

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 总开关。关闭后子代理模型选择不受限制，已配置的规则保留。 |
| `onViolation` | string | `"clamp"` | 越权处置方式：`clamp` 替换为默认模型；`reject` 拒绝显式的越权选择。 |
| `rules` | rule[] | `[]` | 路由规则列表，见下表。 |

每条 `rule`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `parent` | `{ provider, model }` | 否 | 规则管辖的父模型；缺省（或两项皆空）即回退规则，对未列出的模型生效，至多一条。 |
| `allowed` | `{ provider, model }[]` | 是 | 允许子代理使用的模型白名单，至少一条，provider 与 model 均不能为空。 |
| `default` | `{ provider, model }` | 否 | 替换时使用的默认模型；必须出现在 `allowed` 中，缺省取第一项。 |

## Web 设置页

在 Web 客户端「设置 → 插件 → 子智能体模型路由」中可视化编辑全部配置，无需手写 patch 文件：

- 界面提供中文 / 英文文案，跟随客户端语言；
- provider 与 model 输入框自动补全候选项来自宿主的模型目录，目录不可用时仍可手动填写；
- 保存前做与宿主一致的校验（父模型需成对填写、白名单至少一项、默认模型必须入选、回退规则至多一条、父模型不得重复）；
- 配置在别处被修改时提示冲突，可选择重载最新值；只读部署会明确提示无法保存。

## 兼容性

- DSH `>= 0.2.0-rc.2`（peer 依赖 `@deepseek-ai/dsh-subagent` 与 `@deepseek-ai/dsh-tools` 均要求 `>=0.2.0-rc.2`）
- cordis `>= 4`，schemastery `>= 3`
- 设置页运行在 Web 客户端（`platform: web`）；宿主侧的路由门与模型引导不依赖 Web 界面，headless profile 同样生效

## 开发与测试

```sh
node test/client.test.mjs   # 设置页离线测试（stub 掉 react，无需 DSH 运行时）
node test/host.test.mjs     # 委托门行为测试（需在装有 @deepseek-ai/* 依赖的 DSH 运行时中执行）
```

`DSH_PMS_MODULE` 环境变量可把行为测试指向另一份拷贝（bare specifier 或 file URL）。

## 制作

本插件由 [DeepSeek V4.1 Flash](https://www.deepseek.com/) 与 [GLM 5.3](https://chat.z.ai/) 制作。

## 许可证

[MIT](LICENSE)
