// Dedicated DSH Settings section for dsh-per-model-subagent.
// Registered into `settings.section`, so the page has its own item in the
// settings dialog's left navigation instead of living inside Plugins.
window.__ModuleLoader__.load({
	id: "dsh-per-model-subagent",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const h = react.createElement;

		//#region lib/types/client/locales.js
		/** Locale bundles for the per-model subagent routing page. */
		const en = {
			title: "Subagent model routing",
			description: "Choose which subagent models each conversation model may use. Exact model rules take priority; one optional fallback rule covers everything else.",
			guideTitle: "Set up in three steps",
			guideMatch: "Choose the conversation model to match.",
			guideAllow: "List the models its subagents may use.",
			guideDefault: "Choose a default, then save. It is used when no model is specified or a requested model is replaced.",
			emptyTitle: "Start with your first rule",
			empty: "Add a model-specific rule, or add a fallback rule to cover every model without its own rule.",
			statusDisabled: "Routing is off. Your rules are saved but are not applied to subagent delegations.",
			statusNoRules: "Routing is on, but there are no rules yet. Subagent model selection remains unrestricted.",
			statusFallback: "A fallback rule is set. Models without an exact rule will use it.",
			statusNoFallback: "No fallback rule is set. Models without an exact rule remain unrestricted.",
			violationClampHelp: "An explicitly requested model outside the allowed list will be replaced by this rule's default model.",
			violationRejectHelp: "An explicitly requested model outside the allowed list will stop the delegation with an error.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			readOnly: "This deployment stores settings read-only.",
			loading: "Loading…",
			enabled: "Enable per-model routing",
			enabledHelp: "Off means subagent model selection is unrestricted and existing rules are kept.",
			onViolation: "When a child model is not allowed",
			clamp: "Substitute the rule's default model",
			reject: "Reject the delegation call",
			rules: "Routing rules",
			rulesHelp: "Exact model matches take priority. The fallback applies only when no exact rule matches.",
			addRule: "Add model rule",
			addFallbackRule: "Add fallback rule",
			removeRule: "Delete rule",
			parent: "Conversation model to match",
			parentHint: "Select the model used by the main conversation. Leave both fields as “Not specified” to make this the fallback rule.",
			ruleSpecific: "Model rule {index}",
			ruleFallback: "Fallback rule",
			stepMatch: "1. Match a conversation model",
			stepAllowed: "2. Choose allowed subagent models",
			stepDefault: "3. Set the default subagent model",
			allowed: "Models a subagent may use",
			addAllowed: "Add model",
			removeAllowed: "Remove",
			fallbackDefault: "Default subagent model",
			defaultHint: "Must be in the allowed list. Leave unselected to use the first allowed model.",
			save: "Save",
			saving: "Saving…",
			discard: "Discard changes",
			saved: "Saved. These rules apply to subsequent subagent delegations.",
			saveHint: "Changes apply after saving and affect subsequent subagent delegations.",
			saveFailed: "The deployment did not accept these values.",
			conflict: "Settings changed elsewhere. Reload to continue from the current values.",
			reload: "Reload",
			provider: "Provider",
			model: "Model",
			providerUnset: "Not specified",
			modelUnset: "Not specified",
			unavailableOption: "(unavailable — not in the current model list)",
			noModels: "This provider has no available models.",
			catalogFailed: "The model catalog is unavailable, so no model can be chosen here.",
			catalogPartial: "These providers could not be read, so their models are missing from the lists:",
			retry: "Retry",
			issueParentPair: "Rule {index}: the conversation model needs both provider and model.",
			issueDuplicateParent: "Rule {index}: duplicate rule for parent model “{parent}”.",
			issueAllowedRequired: "Rule {index}: at least one allowed model is required.",
			issueAllowedPair: "Rule {index}: every allowed model needs both provider and model.",
			issueDefaultPair: "Rule {index}: the default model needs both provider and model.",
			issueDefaultAllowed: "Rule {index}: the default model must also be an allowed model.",
			issueFallbacks: "At most one fallback rule is allowed. Delete the extra fallback rule or give it a specific conversation model."
		};
		/** Simplified Chinese copy. */
		const zh = {
			title: "子智能体模型路由",
			description: "为不同的主模型分别限定子智能体可用的模型。优先匹配主模型专属规则；未匹配时，可使用一条回退规则统一处理。",
			guideTitle: "按这三步完成配置",
			guideMatch: "选择要匹配的主模型。",
			guideAllow: "列出它的子智能体可以使用的模型。",
			guideDefault: "选择默认模型并保存；未指定模型或替换越权模型时会使用它。",
			emptyTitle: "从第一条规则开始",
			empty: "可以为某个主模型添加专属规则，也可以添加回退规则，统一处理没有专属规则的主模型。",
			statusDisabled: "路由当前已停用。规则会保留，但不会应用于子智能体委托。",
			statusNoRules: "路由已启用，但还没有规则；子智能体模型选择暂不受限。",
			statusFallback: "已设置回退规则；没有专属规则的主模型会使用它。",
			statusNoFallback: "尚未设置回退规则；没有专属规则的主模型仍不受限。",
			violationClampHelp: "显式指定了允许列表之外的模型时，自动改用该规则的默认模型。",
			violationRejectHelp: "显式指定了允许列表之外的模型时，终止此次委托并提示错误。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			readOnly: "本部署的设置为只读。",
			loading: "正在加载…",
			enabled: "启用按模型路由",
			enabledHelp: "关闭后子代理模型选择不受限制，已配置的规则会保留。",
			onViolation: "子代理模型不被允许时",
			clamp: "替换为该规则的默认模型",
			reject: "直接拒绝这次委托",
			rules: "路由规则",
			rulesHelp: "优先使用主模型完全匹配的规则；只有没有匹配项时，才使用回退规则。",
			addRule: "添加主模型规则",
			addFallbackRule: "添加回退规则",
			removeRule: "删除规则",
			parent: "要匹配的主模型",
			parentHint: "选择主对话当前使用的模型。两项都选「未指定」，这条规则就会成为回退规则。",
			ruleSpecific: "主模型规则 {index}",
			ruleFallback: "回退规则",
			stepMatch: "1. 匹配主模型",
			stepAllowed: "2. 选择允许的子智能体模型",
			stepDefault: "3. 设置默认子智能体模型",
			allowed: "允许子代理使用的模型",
			addAllowed: "添加模型",
			removeAllowed: "移除",
			fallbackDefault: "默认子智能体模型",
			defaultHint: "必须从上面的允许列表中选择；留空则自动使用第一项。",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			saved: "已保存，将应用于后续的子智能体委托。",
			saveHint: "保存后生效，并应用于后续的子智能体委托。",
			saveFailed: "本部署没有接受这些值。",
			conflict: "设置已在其他位置更新，请重新载入后继续。",
			reload: "重新载入",
			provider: "提供方",
			model: "模型",
			providerUnset: "未指定",
			modelUnset: "未指定",
			unavailableOption: "（不可用——不在当前模型列表中）",
			noModels: "该提供方当前没有可用模型。",
			catalogFailed: "模型目录暂时不可用，无法在此选择模型。",
			catalogPartial: "以下提供方读取失败，它们的模型不会出现在列表中：",
			retry: "重试",
			issueParentPair: "规则 {index}：请同时选择主模型的提供方和模型。",
			issueDuplicateParent: "规则 {index}：已有另一条规则匹配「{parent}」。",
			issueAllowedRequired: "规则 {index}：请至少添加一个允许的子智能体模型。",
			issueAllowedPair: "规则 {index}：每个允许项都要同时选择提供方和模型。",
			issueDefaultPair: "规则 {index}：请同时选择默认模型的提供方和模型。",
			issueDefaultAllowed: "规则 {index}：默认模型也必须出现在允许列表中。",
			issueFallbacks: "最多只能有一条回退规则。请删除多余规则，或为其指定主模型。"
		};
		//#endregion

		//#region lib/types/client/model.js
		/** The plugin's own configuration namespace (its profile entry id). */
		const NAMESPACE = "per-model-subagent";

		/** Read a trimmed string from an unknown value. */
		function asText(value) {
			return typeof value === "string" ? value : "";
		}

		/** Read one route record, ignoring a half-filled or schema-materialized object. */
		function routeOf(value) {
			if (value === null || typeof value !== "object") return void 0;
			const provider = asText(value.provider);
			const model = asText(value.model);
			return provider === "" && model === "" ? void 0 : { provider, model };
		}

		/**
		* Build one editable rule from a stored rule.
		* @param rule - a stored rule, possibly malformed.
		* @returns the draft row the page renders.
		*/
		function draftRuleOf(rule) {
			const source = rule !== null && typeof rule === "object" ? rule : {};
			const parent = routeOf(source.parent);
			const substitute = routeOf(source.default);
			const allowed = Array.isArray(source.allowed) ? source.allowed : [];
			return {
				parentProvider: parent === void 0 ? "" : parent.provider,
				parentModel: parent === void 0 ? "" : parent.model,
				allowed: allowed.map((entry) => {
					const route = routeOf(entry);
					return route === void 0 ? { provider: "", model: "" } : { provider: route.provider, model: route.model };
				}),
				defaultProvider: substitute === void 0 ? "" : substitute.provider,
				defaultModel: substitute === void 0 ? "" : substitute.model
			};
		}

		/**
		* Build the whole editable draft from a stored namespace value.
		* @param value - the resolved configuration value.
		* @returns the draft the page renders.
		*/
		function draftOf(value) {
			const source = value !== null && typeof value === "object" ? value : {};
			const rules = Array.isArray(source.rules) ? source.rules : [];
			return {
				enabled: source.enabled !== false,
				onViolation: source.onViolation === "reject" ? "reject" : "clamp",
				rules: rules.map(draftRuleOf)
			};
		}

		/** A blank rule row, optionally seeded with one allowed model. */
		function emptyRuleRow() {
			return {
				parentProvider: "",
				parentModel: "",
				allowed: [{ provider: "", model: "" }],
				defaultProvider: "",
				defaultModel: ""
			};
		}

		/**
		* Validate one draft before it can be written.
		* @param draft - the page's draft.
		* @returns human-readable problems; empty means valid.
		*/
		function issuesOf(draft, translate) {
			const issues = [];
			const text = (key, variables = {}) => {
				const template = translate === void 0 ? en[key] : translate(key, variables);
				return template.replace(/\{(\w+)\}/g, (_match, name) => String(variables[name] ?? ""));
			};
			let fallbacks = 0;
			const parents = new Set();
			draft.rules.forEach((rule, index) => {
				const number = index + 1;
				const hasParentProvider = rule.parentProvider.trim() !== "";
				const hasParentModel = rule.parentModel.trim() !== "";
				if (hasParentProvider !== hasParentModel) issues.push(text("issueParentPair", { index: number }));
				else if (!hasParentProvider) fallbacks += 1;
				else {
					const key = `${rule.parentProvider.trim()}/${rule.parentModel.trim()}`;
					if (parents.has(key)) issues.push(text("issueDuplicateParent", { index: number, parent: key }));
					parents.add(key);
				}
				const allowed = rule.allowed.filter((entry) => entry.provider.trim() !== "" || entry.model.trim() !== "");
				if (allowed.length === 0) issues.push(text("issueAllowedRequired", { index: number }));
				for (const entry of allowed) if (entry.provider.trim() === "" || entry.model.trim() === "") issues.push(text("issueAllowedPair", { index: number }));
				const hasDefaultProvider = rule.defaultProvider.trim() !== "";
				const hasDefaultModel = rule.defaultModel.trim() !== "";
				if (hasDefaultProvider !== hasDefaultModel) issues.push(text("issueDefaultPair", { index: number }));
				else if (hasDefaultProvider && !allowed.some((entry) => entry.provider.trim() === rule.defaultProvider.trim() && entry.model.trim() === rule.defaultModel.trim())) {
					issues.push(text("issueDefaultAllowed", { index: number }));
				}
			});
			if (fallbacks > 1) issues.push(text("issueFallbacks"));
			return issues;
		}

		/**
		* Convert a validated draft back into the stored rule shape.
		* @param draft - the page's draft.
		* @returns the rule array to write.
		*/
		function rulesOf(draft) {
			return draft.rules.map((rule) => {
				const allowed = rule.allowed
					.filter((entry) => entry.provider.trim() !== "" && entry.model.trim() !== "")
					.map((entry) => ({ provider: entry.provider.trim(), model: entry.model.trim() }));
				const parentEmpty = rule.parentProvider.trim() === "" && rule.parentModel.trim() === "";
				const defaultEmpty = rule.defaultProvider.trim() === "" && rule.defaultModel.trim() === "";
				return {
					...parentEmpty ? {} : { parent: { provider: rule.parentProvider.trim(), model: rule.parentModel.trim() } },
					allowed,
					...defaultEmpty ? {} : { default: { provider: rule.defaultProvider.trim(), model: rule.defaultModel.trim() } }
				};
			});
		}

		/** The operations one save submits, in the settings service's op shape. */
		function opsOf(draft) {
			return [
				{ op: "set", path: ["enabled"], value: draft.enabled },
				{ op: "set", path: ["onViolation"], value: draft.onViolation },
				{ op: "set", path: ["rules"], value: rulesOf(draft) }
			];
		}

		/** Whether two drafts render the same configuration. */
		function sameDraft(left, right) {
			return JSON.stringify(left) === JSON.stringify(right);
		}
		//#endregion

		//#region lib/types/client/page.js
		/** Inline styles kept to layout only, so the page follows the app's theme tokens. */
		const styles = {
			page: { display: "flex", flexDirection: "column", gap: "18px", padding: "16px 0", minWidth: 0 },
			row: { display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" },
			field: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, flex: "1 1 160px" },
			label: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px" },
			hint: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", margin: "2px 0 0", lineHeight: 1.5 },
			input: {
				boxSizing: "border-box",
				width: "100%",
				minWidth: 0,
				padding: "6px 8px",
				font: "inherit",
				fontSize: "13px",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-3, transparent)",
				border: ".5px solid var(--dsw-alias-border-l4)",
				borderRadius: "var(--dsw-radius-md, 6px)"
			},
			card: {
				display: "flex",
				flexDirection: "column",
				gap: "10px",
				padding: "12px",
				border: ".5px solid var(--dsw-alias-border-l4)",
				borderRadius: "var(--dsw-radius-lg, 8px)"
			},
			cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" },
			title: { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
			guide: {
				padding: "12px 14px",
				borderRadius: "var(--dsw-radius-lg, 8px)",
				background: "var(--dsw-alias-bg-layer-2, transparent)"
			},
			guideTitle: { margin: "0 0 6px", fontSize: "13px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
			guideList: { margin: 0, paddingLeft: "20px", color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: 1.7 },
			sectionTitle: { margin: "4px 0 0", fontSize: "13px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
			emptyState: { padding: "16px 0", display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" },
			emptyTitle: { margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
			status: { margin: 0, fontSize: "12px", lineHeight: 1.5, color: "var(--dsw-alias-label-secondary)" },
			actions: { display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", paddingTop: "4px" },
			button: {
				font: "inherit",
				fontSize: "12px",
				color: "var(--dsw-alias-brand-primary)",
				background: "transparent",
				border: 0,
				padding: "2px 0",
				cursor: "pointer"
			},
			buttonPrimary: {
				font: "inherit",
				fontSize: "13px",
				color: "var(--dsw-alias-label-primary)",
				padding: "6px 14px",
				border: ".5px solid var(--dsw-alias-border-l4)",
				borderRadius: "var(--dsw-radius-md, 6px)",
				background: "var(--dsw-alias-bg-layer-3, transparent)",
				cursor: "pointer"
			},
			error: { color: "var(--dsw-alias-state-error-primary)", fontSize: "12px", margin: 0 },
			notice: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", margin: 0 },
			// Only a select needs the marker and spacing the native control does not
			// inherit from the page's own theme.
			select: {
				appearance: "auto",
				cursor: "pointer",
				paddingRight: "4px"
			}
		};

		/**
		* Read the configuration share this section received. The normal path is
		* the injected `ctx.configForms` controller. A bare `{ state, mutate }`
		* face is also accepted for embedders and offline render tests.
		*
		* @param props - the entry's props.
		* @returns the reader, or undefined when no form is served.
		*/
		function formFaceOf(props) {
			for (const candidate of [props.form, props.formController]) {
				if (candidate === null || typeof candidate !== "object") continue;
				if (typeof candidate.mutate !== "function") continue;
				const controller = typeof candidate.getSnapshot === "function" && typeof candidate.subscribe === "function";
				const snapshot = controller ? candidate.getSnapshot() : candidate.state;
				if (snapshot === null || typeof snapshot !== "object") continue;
				return {
					controller: controller ? candidate : void 0,
					snapshot,
					// A receiver-preserving call: a controller's `mutate` reads its own
					// instance state, so it must never be detached from its object.
					mutate: (ops, revision) => candidate.mutate(ops, revision)
				};
			}
			return void 0;
		}

		/**
		* Observe one configuration face through React state: a controller
		* subscribes, a face the owner handed is refreshed by the owner's render.
		* @param face - the reader {@link formFaceOf} produced.
		* @returns the current form snapshot, or undefined when none is served.
		*/
		function useFaceSnapshot(face) {
			const controller = face === void 0 ? void 0 : face.controller;
			const [live, setLive] = react.useState(() => controller === void 0 ? null : controller.getSnapshot());
			react.useEffect(() => {
				if (controller === void 0) return void 0;
				setLive(controller.getSnapshot());
				return controller.subscribe(() => setLive(controller.getSnapshot()));
			}, [controller]);
			if (controller === void 0) return face === void 0 ? void 0 : face.snapshot;
			return live ?? controller.getSnapshot();
		}

		/**
		* Render the routing page: enablement, violation policy, and the rule table.
		* @param props - the injected config controller, locale reader, and catalog
		* loader; the settings shell also supplies a `close` callback.
		* @returns the settings page.
		*/
		function RoutingPage(props) {
			const { t } = props;
			const face = formFaceOf(props);
			const snapshot = useFaceSnapshot(face);
			const [draft, setDraft] = react.useState(null);
			const [baseRevision, setBaseRevision] = react.useState(null);
			const [baseValue, setBaseValue] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [failed, setFailed] = react.useState(false);
			const [failureDetail, setFailureDetail] = react.useState("");
			const [saved, setSaved] = react.useState(false);
			const [conflict, setConflict] = react.useState(false);
			// The fields render provider names from the raw groups, so the raw value
			// is kept beside the projection the page itself presents.
			const [catalogRaw, setCatalogRaw] = react.useState(() => props.catalog === void 0 ? null : props.catalog);
			const [catalogFace, setCatalogFace] = react.useState(() => props.catalog === void 0 ? null : catalogOf(props.catalog));
			const [catalogStatus, setCatalogStatus] = react.useState(catalogFace === null ? "idle" : "ready");
			const [attempt, setAttempt] = react.useState(0);
			// The in-flight read is guarded by a ref, not by the effect's own state:
			// a retry after a failure must be able to start a fresh read, and React
			// may run this effect twice for one mount.
			const catalogLoad = react.useRef(void 0);

			// The provider/model lists ARE the host catalog (the same projection the
			// workspace's own model picker reads), so a page without one offers no
			// route at all: it says so and offers a retry instead of a free-text box
			// that could name a route the conversation cannot select.
			react.useEffect(() => {
				if (props.loadCatalog === void 0 || catalogFace !== null || catalogLoad.current !== void 0) return;
				let cancelled = false;
				setCatalogStatus("loading");
				const read = props.loadCatalog().then((value) => {
					if (cancelled) return;
					if (value === null) setCatalogStatus("error");
					else {
						setCatalogRaw(value.catalog);
						setCatalogFace(value.projection);
						setCatalogStatus("ready");
					}
				}, () => {
					if (!cancelled) setCatalogStatus("error");
				}).finally(() => {
					if (catalogLoad.current === read) catalogLoad.current = void 0;
				});
				catalogLoad.current = read;
				return () => {
					cancelled = true;
				};
			}, [catalogFace, props.loadCatalog, attempt]);

			const ready = snapshot !== void 0 && snapshot.status === "ready";
			const dirty = draft !== null && !sameDraft(draft, baseValue);
			react.useEffect(() => {
				if (!ready) {
					setDraft(null);
					setBaseRevision(null);
					setBaseValue(null);
					return;
				}
				const next = draftOf(snapshot.value);
				if (draft === null || baseRevision === null) {
					setDraft(next);
					setBaseValue(next);
					setBaseRevision(snapshot.revision);
					setConflict(false);
					return;
				}
				if (baseRevision === snapshot.revision) return;
				// The Host moved on. A value that already matches this draft is our own
				// accepted save; a genuinely different one while local edits exist is a
				// conflict the user must resolve explicitly.
				if (!sameDraft(next, draft) && !sameDraft(draft, baseValue)) {
					setConflict(true);
					return;
				}
				setDraft(next);
				setBaseValue(next);
				setBaseRevision(snapshot.revision);
				setConflict(false);
			}, [ready, snapshot === void 0 ? void 0 : snapshot.revision, snapshot === void 0 ? void 0 : snapshot.value, baseRevision, draft, baseValue]);

			if (!ready) {
				return h("p", { style: styles.notice }, t(snapshot !== void 0 && snapshot.status === "loading" ? "loading" : "unavailable"));
			}
			const writable = snapshot.writable && !busy;
			// The first render runs before the seeding effect, so render the stored
			// value directly until a draft exists.
			const view = draft ?? draftOf(snapshot.value);
			const issues = issuesOf(view, t);
			// Every route field reads this one projection of the live catalog. The
			// fields project the raw catalog again themselves so they stay usable
			// without the page's own computed state.
			const providers = catalogFace?.providers ?? [];
			const catalogFailures = catalogFace?.failures ?? [];
			const hasFallback = view.rules.some((rule) => rule.parentProvider === "" && rule.parentModel === "");
			const addRule = () => patch((current) => ({ rules: [...current.rules, emptyRuleRow()] }));
			const patch = (change) => {
				const current = draft ?? view;
				setDraft({ ...current, ...change(current) });
				setSaved(false);
				setFailed(false);
				setFailureDetail("");
			};
			const patchRule = (index, change) => patch((current) => ({
				rules: current.rules.map((rule, at) => at === index ? { ...rule, ...change(rule) } : rule)
			}));
			const save = async () => {
				if (face === void 0 || draft === null || issues.length > 0 || busy) return;
				setBusy(true);
				setFailed(false);
				let accepted = false;
				let detail = "";
				try {
					const result = props.saveConfig === void 0
						? await face.mutate(opsOf(draft), baseRevision)
						: await props.saveConfig(opsOf(draft), baseRevision);
					accepted = typeof result === "object" && result !== null ? result.accepted === true : result === true;
					detail = typeof result === "object" && result !== null ? asText(result.error) : "";
				} catch (error) {
					accepted = false;
					detail = error instanceof Error ? error.message : String(error);
				}
				setBusy(false);
				setFailureDetail(detail);
				if (accepted) {
					// The host already committed this exact draft. Mark it clean now;
					// the controller's next snapshot will supply the new revision.
					setBaseValue(draft);
					setSaved(true);
					setConflict(false);
				} else setFailed(true);
			};
			const reload = () => {
				const next = draftOf(snapshot.value);
				setDraft(next);
				setBaseValue(next);
				setBaseRevision(snapshot.revision);
				setConflict(false);
				setFailed(false);
				setFailureDetail("");
			};

			return h("div", { style: styles.page, "data-plugin-page": NAMESPACE }, [
				h("p", { key: "desc", style: styles.hint }, t("description")),
				h("section", { key: "guide", style: styles.guide, "aria-label": t("guideTitle") }, [
					h("h3", { key: "title", style: styles.guideTitle }, t("guideTitle")),
					h("ol", { key: "steps", style: styles.guideList }, [
						h("li", { key: "match" }, t("guideMatch")),
						h("li", { key: "allow" }, t("guideAllow")),
						h("li", { key: "default" }, t("guideDefault"))
					])
				]),
				!writable && !busy ? h("p", { key: "ro", style: styles.notice }, t("readOnly")) : null,
				h("div", { key: "enabled", style: styles.row }, [
					h("label", { key: "l", style: { ...styles.field, flexDirection: "row", alignItems: "center", gap: "8px" } }, [
						h("input", {
							key: "i",
							type: "checkbox",
							checked: view.enabled,
							disabled: !writable,
							onChange: (event) => patch(() => ({ enabled: event.target.checked }))
						}),
						h("span", { key: "t", style: styles.label }, t("enabled"))
					])
				]),
				h("p", { key: "enabledHelp", style: styles.hint }, t("enabledHelp")),
				h("p", { key: "status", style: styles.status, role: "status" }, t(!view.enabled ? "statusDisabled" : view.rules.length === 0 ? "statusNoRules" : hasFallback ? "statusFallback" : "statusNoFallback")),
				h("div", { key: "violation", style: styles.field }, [
					h("span", { key: "l", style: styles.label }, t("onViolation")),
					h("select", {
						key: "s",
						style: styles.input,
						value: view.onViolation,
						disabled: !writable || !view.enabled,
						"aria-label": t("onViolation"),
						onChange: (event) => patch(() => ({ onViolation: event.target.value }))
					}, [
						h("option", { key: "clamp", value: "clamp" }, t("clamp")),
						h("option", { key: "reject", value: "reject" }, t("reject"))
					]),
					h("p", { key: "help", style: styles.hint }, t(view.onViolation === "reject" ? "violationRejectHelp" : "violationClampHelp"))
				]),
				h("div", { key: "rulesHead", style: styles.cardHead }, [
					h("h4", { key: "t", style: styles.title }, t("rules")),
					h("div", { key: "addActions", style: styles.row }, [
						h("button", {
							key: "add",
							type: "button",
							style: styles.button,
							disabled: !writable,
							onClick: addRule
						}, t("addRule")),
						h("button", {
							key: "addFallback",
							type: "button",
							style: styles.button,
							disabled: !writable || hasFallback,
							title: hasFallback ? t("statusFallback") : void 0,
							onClick: addRule
						}, t("addFallbackRule"))
					])
				]),
				h("p", { key: "rulesHelp", style: styles.hint }, t("rulesHelp")),
				view.rules.length === 0 ? h("div", { key: "empty", style: styles.emptyState }, [
					h("h4", { key: "title", style: styles.emptyTitle }, t("emptyTitle")),
					h("p", { key: "body", style: styles.hint }, t("empty")),
					h("button", { key: "add", type: "button", style: styles.buttonPrimary, disabled: !writable, onClick: addRule }, t("addRule"))
				]) : null,
				...view.rules.map((rule, index) => {
					const patchAllowed = (at, change) => patchRule(index, (current) => ({
						allowed: current.allowed.map((entry, position) => position === at ? { ...entry, ...change(entry) } : entry)
					}));
					return h("div", { key: `rule-${index}`, style: styles.card }, [
						h("div", { key: "head", style: styles.cardHead }, [
							h("h4", { key: "t", style: styles.title }, rule.parentProvider === "" && rule.parentModel === "" ? t("ruleFallback") : t("ruleSpecific", { index: index + 1 })),
							h("button", {
								key: "rm",
								type: "button",
								style: styles.button,
								disabled: !writable,
								onClick: () => patch((current) => ({ rules: current.rules.filter((_rule, at) => at !== index) }))
							}, t("removeRule"))
						]),
						h("h5", { key: "matchTitle", style: styles.sectionTitle }, t("stepMatch")),
						h("p", { key: "hint", style: styles.hint }, t("parentHint")),
						h("div", { key: "parent", style: styles.row }, [
							routeSelect({
								key: "p",
								t,
								kind: "provider",
								catalog: catalogRaw,
								rule,
								value: rule.parentProvider,
								disabled: !writable,
								onChange: (value) => patchRule(index, () => ({ parentProvider: value, parentModel: "" }))
							}),
							routeSelect({
								key: "m",
								t,
								kind: "model",
								catalog: catalogRaw,
								rule,
								value: rule.parentModel,
								provider: rule.parentProvider,
								disabled: !writable,
								onChange: (value) => patchRule(index, () => ({ parentModel: value }))
							})
						]),
						h("div", { key: "allowedHead", style: styles.cardHead }, [
							h("h5", { key: "l", style: styles.sectionTitle }, t("stepAllowed")),
							h("button", {
								key: "add",
								type: "button",
								style: styles.button,
								disabled: !writable,
								// Seed from the rule's own default: the route the rule
								// already names is the one most likely to be allowed again.
								onClick: () => patchRule(index, (current) => ({ allowed: [...current.allowed, { provider: current.defaultProvider, model: current.defaultModel }] }))
							}, t("addAllowed"))
						]),
						...rule.allowed.map((entry, at) => h("div", { key: `allowed-${at}`, style: styles.row }, [
							routeSelect({
								key: "p",
								t,
								kind: "provider",
								catalog: catalogRaw,
								rule,
								value: entry.provider,
								disabled: !writable,
								onChange: (value) => patchAllowed(at, () => ({ provider: value, model: "" }))
							}),
							routeSelect({
								key: "m",
								t,
								kind: "model",
								catalog: catalogRaw,
								rule,
								value: entry.model,
								provider: entry.provider,
								disabled: !writable,
								onChange: (value) => patchAllowed(at, () => ({ model: value }))
							}),
							h("button", {
								key: "rm",
								type: "button",
								style: styles.button,
								disabled: !writable,
								onClick: () => patchRule(index, (current) => ({ allowed: current.allowed.filter((_candidate, position) => position !== at) }))
							}, t("removeAllowed"))
						])),
						h("h5", { key: "dl", style: styles.sectionTitle }, t("stepDefault")),
						h("div", { key: "default", style: styles.row }, [
							routeSelect({
								key: "p",
								t,
								kind: "provider",
								catalog: catalogRaw,
								rule,
								value: rule.defaultProvider,
								disabled: !writable,
								onChange: (value) => patchRule(index, () => ({ defaultProvider: value, defaultModel: "" }))
							}),
							routeSelect({
								key: "m",
								t,
								kind: "model",
								catalog: catalogRaw,
								rule,
								value: rule.defaultModel,
								provider: rule.defaultProvider,
								disabled: !writable,
								onChange: (value) => patchRule(index, () => ({ defaultModel: value }))
							})
						]),
						h("p", { key: "dh", style: styles.hint }, t("defaultHint"))
					]);
				}),
				// No catalog, or a catalog that offers no route at all, means the same
				// thing to this page: there is nothing to choose from, so say so and
				// offer the reload instead of leaving the lists empty.
				catalogStatus === "error" || providers.length === 0 ? h("div", { key: "cat", style: styles.row }, [
					h("p", { key: "m", style: styles.notice }, t("catalogFailed")),
					h("button", {
						key: "r",
						type: "button",
						style: styles.button,
						onClick: () => setAttempt((current) => current + 1)
					}, t("retry"))
				]) : null,
				// A partly readable catalog still names the providers it could not
				// read, so an empty list is never mistaken for "the model is gone".
				...(catalogFailures.length === 0 ? [] : [
					h("p", { key: "catKnown", style: styles.notice }, t("catalogPartial")),
					...catalogFailures.map((failure, index) => h("p", { key: `catFailure-${index}`, style: styles.notice }, `${failure.id}: ${failure.message}`))
				]),
				...issues.map((issue, index) => h("p", { key: `issue-${index}`, style: styles.error }, issue)),
				conflict ? h("p", { key: "conflict", style: styles.error }, t("conflict")) : null,
				failed ? h("p", { key: "failed", style: styles.error }, t("saveFailed")) : null,
				failed && failureDetail !== "" ? h("p", { key: "failureDetail", style: styles.error }, failureDetail) : null,
				saved && !dirty && !failed ? h("p", { key: "saved", style: styles.notice }, t("saved")) : null,
				h("div", { key: "actions", style: styles.actions }, [
					h("span", { key: "hint", style: styles.hint }, t("saveHint")),
					h("button", {
						key: "save",
						type: "button",
						style: styles.buttonPrimary,
						disabled: !writable || !dirty || issues.length > 0,
						onClick: save
					}, t(busy ? "saving" : "save")),
					h("button", {
						key: "discard",
						type: "button",
						style: styles.button,
						disabled: !writable || !dirty,
						onClick: reload
					}, t(conflict ? "reload" : "discard"))
				])
			]);
		}

		/**
		* Render one selectable field: its label, the control, and an optional hint.
		* @param props - label, selected value, options, disablement, and change handler.
		* @returns the labelled field element.
		*/
		function selectField(props) {
			return h("label", { key: props.key, style: styles.field }, [
				h("span", { key: "l", style: styles.label }, props.label),
				h("select", {
					key: "s",
					style: { ...styles.input, ...styles.select },
					value: props.value,
					disabled: props.disabled,
					"aria-label": props.label,
					onChange: (event) => props.onChange(event.target.value)
				}, [
					h("option", { key: "none", value: "" }, props.unsetLabel),
					...props.options.map((choice) => h("option", {
						key: `${props.kind}-${choice.value}`,
						value: choice.value
					}, choice.available ? choice.label : `${choice.label} ${props.unavailableSuffix}`))
				]),
				props.hint === void 0 ? null : h("p", { key: "h", style: styles.hint }, props.hint)
			]);
		}

		/**
		* Render one provider/model route as two dependent lists.
		*
		* Both lists come from the host catalog the workspace's own model picker
		* reads, so every offerable route is one the conversation can actually
		* select. A provider the user picks narrows the model list to that
		* provider's models; a stored route the catalog no longer advertises stays
		* visible (and selectable) so saving never silently drops it.
		*
		* @param props - locale reader, the rule's stored routes, the host catalog,
		* which half of the route this field edits, its value, and its change handler.
		* @returns the two field elements.
		*/
		function routeSelect(props) {
			const providers = catalogOf(props.catalog).providers;
			const stored = storedRoutesOf(props.rule);
			const isProvider = props.kind === "provider";
			const options = isProvider
				? providerChoices(providers, props.catalog, stored)
				: modelChoices(providers, props.provider ?? "", stored, props.value);
			return selectField({
				key: props.key,
				kind: props.kind,
				label: props.t(isProvider ? "provider" : "model"),
				unsetLabel: props.t(isProvider ? "providerUnset" : "modelUnset"),
				options,
				unavailableSuffix: props.t("unavailableOption"),
				value: props.value,
				disabled: props.disabled,
				hint: !isProvider && props.provider !== "" && options.length === 0 ? props.t("noModels") : void 0,
				onChange: props.onChange
			});
		}
		//#endregion

		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.per-model-subagent";
		/** Required client services. */
		const inject = ["slots", "locale", "configForms", "remote", "remote.session", "remote.settings"];

		/**
		* Project the host catalog response into the provider list the page offers.
		*
		* The catalog is the same `remote.session.modelCatalog()` the workspace's own
		* model picker reads, so both the providers and each provider's models — in
		* catalog order — are exactly the routes the conversation can select. A
		* provider that advertises no model is dropped, matching the picker's own
		* "successful non-empty provider groups" projection.
		*
		* @param catalog - the host catalog response value, possibly malformed.
		* @returns the page's catalog face: provider entries with their models in
		* catalog order, plus every provider whose model list the host could not read.
		*/
		function catalogOf(catalog) {
			const groups = Array.isArray(catalog?.groups) ? catalog.groups : [];
			const providers = [];
			for (const group of groups) {
				if (group === null || typeof group !== "object") continue;
				const id = asText(group.id);
				if (id === "") continue;
				const models = (Array.isArray(group.models) ? group.models : [])
					.map((model) => {
						const modelId = asText(model?.id);
						return modelId === "" ? void 0 : { id: modelId, name: asText(model?.name) };
					})
					.filter((model) => model !== void 0);
				if (models.length === 0) continue;
				providers.push({ id, models });
			}
			const failures = (Array.isArray(catalog?.failures) ? catalog.failures : [])
				.map((failure) => ({ id: asText(failure?.id), message: asText(failure?.message) }))
				.filter((failure) => failure.id !== "");
			return { providers, failures };
		}

		/** The display name the catalog gives one model, falling back to its id. */
		function catalogModelName(provider, model) {
			const entry = provider?.models.find((candidate) => candidate.id === model);
			return entry === void 0 || entry.name === "" ? model : entry.name;
		}

		/**
		* Every route the rule currently stores, in the order the page renders them.
		* A route the catalog no longer advertises must stay selectable and removable,
		* so the page offers it as a marked option instead of dropping it on write.
		* @param rule - the rule's editable row.
		* @returns the stored routes, including the optional parent and default.
		*/
		function storedRoutesOf(rule) {
			return [
				{ provider: asText(rule?.parentProvider), model: asText(rule?.parentModel) },
				...(Array.isArray(rule?.allowed) ? rule.allowed : []).map((entry) => ({ provider: asText(entry?.provider), model: asText(entry?.model) })),
				{ provider: asText(rule?.defaultProvider), model: asText(rule?.defaultModel) }
			].filter((route) => route.provider !== "" && route.model !== "");
		}

		/**
		* The provider options one route field offers: the catalog's providers, plus
		* any provider the stored configuration still names that the catalog lost.
		* @param providers - catalog providers in picker order.
		* @param catalog - the host catalog response value, whose provider names are
		* used even when a provider currently advertises no model.
		* @param stored - routes the stored configuration holds.
		* @returns selectable options, each marked when the catalog lacks it.
		*/
		function providerChoices(providers, catalog, stored) {
			const choices = providers.map((provider) => ({ value: provider.id, label: provider.id, available: true }));
			const known = new Set(choices.map((choice) => choice.value));
			const names = new Map();
			for (const group of Array.isArray(catalog?.groups) ? catalog.groups : []) {
				const id = asText(group?.id);
				if (id !== "" && !names.has(id)) names.set(id, asText(group?.name));
			}
			for (const route of stored) {
				if (route.provider === "" || known.has(route.provider)) continue;
				known.add(route.provider);
				const name = names.get(route.provider) ?? route.provider;
				choices.push({ value: route.provider, label: name === "" ? route.provider : name, available: false });
			}
			return choices;
		}

		/**
		* The model options one route field offers for its chosen provider: that
		* provider's catalog models, plus any stored model it no longer advertises.
		* @param providers - catalog providers in picker order.
		* @param provider - the route's provider, empty when none is chosen.
		* @param stored - routes the stored configuration holds.
		* @param value - the route's current model, kept visible while it is stored.
		* @returns selectable options, each marked when the catalog lacks it.
		*/
		function modelChoices(providers, provider, stored, value) {
			if (provider === "") return [];
			const group = providers.find((candidate) => candidate.id === provider);
			const choices = (group?.models ?? []).map((model) => ({ value: model.id, label: model.name === "" ? model.id : model.name, available: true }));
			const known = new Set(choices.map((choice) => choice.value));
			for (const route of [{ provider, model: value }, ...stored]) {
				if (route.provider !== provider || route.model === "" || known.has(route.model)) continue;
				known.add(route.model);
				const name = catalogModelName(group, route.model);
				choices.push({ value: route.model, label: name === "" ? route.model : name, available: false });
			}
			return choices;
		}

		/**
		* Mount the routing page as a first-class DSH Settings section.
		*
		* `settings.section` supplies only the shell's `close` callback. This entry
		* injects its own shared config controller, locale, and live model catalog.
		* The section id is deliberately distinct from the config namespace: the
		* former is a navigation key, the latter is the Host profile entry id.
		*
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "per-model-subagent: dictionaries");
			// The settings provider owns every shared form's lifetime. Disposing this
			// controller here would poison the provider cache for later page mounts.
			const formController = ctx.configForms.get(NAMESPACE);
			const loadCatalog = async () => {
				const session = ctx.remote?.session;
				if (session?.modelCatalog === void 0) return null;
				const response = await session.modelCatalog();
				return response?.ok ? { catalog: response.value, projection: catalogOf(response.value) } : null;
			};
			// Keep the host's rejection reason instead of reducing every failure to
			// a generic boolean. This uses the same remote mutation and revision as
			// ConfigFormController, then refreshes its cached snapshot in both cases.
			const saveConfig = ctx.remote?.settings?.mutate === void 0 || formController?.recover === void 0 ? void 0 : async (ops, revision) => {
				const response = await ctx.remote.settings.mutate(NAMESPACE, ops, revision);
				// Recovery is only cache maintenance. Some desktop builds leave this
				// promise pending after the write has committed; never hold the Save
				// button hostage to it. The next controller snapshot reconciles us.
				void formController.recover().catch(() => {});
				if (response?.ok) return { accepted: true };
				const error = response?.error;
				return {
					accepted: false,
					error: asText(error?.message) || asText(error) || asText(response?.message)
				};
			};
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "per-model-subagent",
				order: 45,
				label: () => t("title"),
				locale: NS,
				inject: () => ({ formController, t, loadCatalog, saveConfig })
			}, RoutingPage));
		}
		//#endregion

		exports.NS = NS;
		exports.NAMESPACE = NAMESPACE;
		exports.apply = apply;
		exports.inject = inject;
		/** Pure helpers, exported for the offline page tests. */
		exports.__test = {
			draftOf,
			issuesOf,
			rulesOf,
			opsOf,
			emptyRuleRow,
			catalogOf,
			providerChoices,
			modelChoices,
			storedRoutesOf,
			catalogModelName
		};
		return module.exports;
	}
});
