// Settings page for dsh-per-model-subagent on the dsh web client's Plugins page.
// Registered into the `plugins.item` list slot under the plugin's own config
// namespace, so it is the page the plugin manager opens for this plugin.
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
			description: "Set which models each conversation model may hand to a subagent.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			readOnly: "This deployment stores settings read-only.",
			loading: "Loading…",
			enabled: "Enable per-model routing",
			enabledHelp: "Off means subagent model selection is unrestricted and existing rules are kept.",
			onViolation: "When a child model is not allowed",
			clamp: "Substitute the rule's default model",
			reject: "Reject the delegation call",
			rules: "Rules",
			rulesHelp: "Each rule governs one parent model. A rule with an empty parent is the fallback for every unlisted model; at most one is allowed.",
			addRule: "Add rule",
			removeRule: "Remove rule",
			parent: "Parent model",
			parentHint: "The conversation model this rule governs. Leave both empty for the fallback rule.",
			allowed: "Models a subagent may use",
			addAllowed: "Add model",
			removeAllowed: "Remove",
			fallbackDefault: "Default when no model is chosen",
			defaultHint: "Optional. Must be one of the models above; defaults to the first one.",
			save: "Save",
			saving: "Saving…",
			discard: "Discard changes",
			saved: "Saved.",
			saveFailed: "The deployment did not accept these values.",
			conflict: "Settings changed elsewhere. Reload to continue from the current values.",
			reload: "Reload",
			provider: "Provider",
			model: "Model",
			empty: "No rules yet. Subagent model selection is currently unrestricted.",
			catalogFailed: "The model catalog is unavailable; routes can still be typed by hand."
		};
		/** Simplified Chinese copy. */
		const zh = {
			title: "子智能体模型路由",
			description: "按对话所用的模型，限定它可以交给子智能体的模型。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			readOnly: "本部署的设置为只读。",
			loading: "正在加载…",
			enabled: "启用按模型路由",
			enabledHelp: "关闭后子代理模型选择不受限制，已配置的规则会保留。",
			onViolation: "子代理模型不被允许时",
			clamp: "替换为该规则的默认模型",
			reject: "直接拒绝这次委托",
			rules: "路由规则",
			rulesHelp: "每条规则管一个父模型。父模型留空即为回退规则，对所有未列出的模型生效，最多只能有一条。",
			addRule: "添加规则",
			removeRule: "删除规则",
			parent: "父模型",
			parentHint: "这条规则管的对话模型。两项都留空即为回退规则。",
			allowed: "允许子代理使用的模型",
			addAllowed: "添加模型",
			removeAllowed: "移除",
			fallbackDefault: "未指定子代理模型时使用",
			defaultHint: "可留空。必须是上面允许列表中的一项；留空则用第一项。",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			saved: "已保存。",
			saveFailed: "本部署没有接受这些值。",
			conflict: "设置已在其他位置更新，请重新载入后继续。",
			reload: "重新载入",
			provider: "提供方",
			model: "模型",
			empty: "还没有规则，子代理模型选择当前不受限制。",
			catalogFailed: "模型目录暂时不可用，仍可手动填写路由。"
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
		function issuesOf(draft) {
			const issues = [];
			let fallbacks = 0;
			const parents = new Set();
			draft.rules.forEach((rule, index) => {
				const label = `#${index + 1}`;
				const hasParentProvider = rule.parentProvider.trim() !== "";
				const hasParentModel = rule.parentModel.trim() !== "";
				if (hasParentProvider !== hasParentModel) issues.push(`${label}: ${en.parent} needs both provider and model.`);
				else if (!hasParentProvider) fallbacks += 1;
				else {
					const key = `${rule.parentProvider.trim()}/${rule.parentModel.trim()}`;
					if (parents.has(key)) issues.push(`${label}: duplicate rule for parent model "${key}".`);
					parents.add(key);
				}
				const allowed = rule.allowed.filter((entry) => entry.provider.trim() !== "" || entry.model.trim() !== "");
				if (allowed.length === 0) issues.push(`${label}: at least one allowed model is required.`);
				for (const entry of allowed) if (entry.provider.trim() === "" || entry.model.trim() === "") issues.push(`${label}: every allowed model needs both provider and model.`);
				const hasDefaultProvider = rule.defaultProvider.trim() !== "";
				const hasDefaultModel = rule.defaultModel.trim() !== "";
				if (hasDefaultProvider !== hasDefaultModel) issues.push(`${label}: the default model needs both provider and model.`);
				else if (hasDefaultProvider && !allowed.some((entry) => entry.provider.trim() === rule.defaultProvider.trim() && entry.model.trim() === rule.defaultModel.trim())) {
					issues.push(`${label}: the default model must also be an allowed model.`);
				}
			});
			if (fallbacks > 1) issues.push("At most one fallback rule (empty parent) is allowed.");
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
			notice: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", margin: 0 }
		};

		/**
		* Observe one ConfigForm through React state.
		* @param form - the namespace's ConfigForm.
		* @returns its current snapshot.
		*/
		function useFormSnapshot(form) {
			const [snapshot, setSnapshot] = react.useState(() => form.getSnapshot());
			react.useEffect(() => {
				setSnapshot(form.getSnapshot());
				return form.subscribe(() => setSnapshot(form.getSnapshot()));
			}, [form]);
			return snapshot;
		}

		/**
		* Render the routing page: enablement, violation policy, and the rule table.
		* @param props - the injected form, locale reader, and optional model catalog.
		* @returns the settings page.
		*/
		function RoutingPage(props) {
			const { form, t } = props;
			const snapshot = useFormSnapshot(form);
			const [draft, setDraft] = react.useState(null);
			const [baseRevision, setBaseRevision] = react.useState(null);
			const [baseValue, setBaseValue] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [failed, setFailed] = react.useState(false);
			const [saved, setSaved] = react.useState(false);
			const [conflict, setConflict] = react.useState(false);
			const [catalog, setCatalog] = react.useState(props.catalog ?? null);
			const [catalogFailed, setCatalogFailed] = react.useState(false);

			react.useEffect(() => {
				if (props.loadCatalog === void 0 || catalog !== null) return;
				let cancelled = false;
				props.loadCatalog().then((value) => {
					if (!cancelled && value !== null) setCatalog(value);
					else if (!cancelled) setCatalogFailed(true);
				}, () => {
					if (!cancelled) setCatalogFailed(true);
				});
				return () => {
					cancelled = true;
				};
			}, [catalog, props.loadCatalog]);

			const ready = snapshot.status === "ready";
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
			}, [ready, snapshot.revision, snapshot.value, baseRevision, draft, baseValue]);

			if (!ready) {
				return h("p", { style: styles.notice }, t(snapshot.status === "loading" ? "loading" : "unavailable"));
			}
			const writable = snapshot.writable && !busy;
			// The first render runs before the seeding effect, so render the stored
			// value directly until a draft exists.
			const view = draft ?? draftOf(snapshot.value);
			const issues = issuesOf(view);
			const patch = (change) => {
				const current = draft ?? view;
				setDraft({ ...current, ...change(current) });
			};
			const patchRule = (index, change) => patch((current) => ({
				rules: current.rules.map((rule, at) => at === index ? { ...rule, ...change(rule) } : rule)
			}));
			const save = async () => {
				if (draft === null || issues.length > 0 || busy) return;
				setBusy(true);
				setFailed(false);
				const accepted = await form.mutate(opsOf(draft), baseRevision);
				setBusy(false);
				if (accepted) {
					setSaved(true);
					setConflict(false);
				} else setFailed(true);
			};
			const reload = () => {
				const next = draftOf(form.getSnapshot().value);
				setDraft(next);
				setBaseValue(next);
				setBaseRevision(form.getSnapshot().revision);
				setConflict(false);
				setFailed(false);
			};

			return h("div", { style: styles.page, "data-plugin-page": NAMESPACE }, [
				h("p", { key: "desc", style: styles.hint }, t("description")),
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
				h("div", { key: "violation", style: styles.field }, [
					h("span", { key: "l", style: styles.label }, t("onViolation")),
					h("select", {
						key: "s",
						style: styles.input,
						value: view.onViolation,
						disabled: !writable,
						onChange: (event) => patch(() => ({ onViolation: event.target.value }))
					}, [
						h("option", { key: "clamp", value: "clamp" }, t("clamp")),
						h("option", { key: "reject", value: "reject" }, t("reject"))
					])
				]),
				h("div", { key: "rulesHead", style: styles.cardHead }, [
					h("h4", { key: "t", style: styles.title }, t("rules")),
					h("button", {
						key: "add",
						type: "button",
						style: styles.button,
						disabled: !writable,
						onClick: () => patch((current) => ({ rules: [...current.rules, emptyRuleRow()] }))
					}, t("addRule"))
				]),
				h("p", { key: "rulesHelp", style: styles.hint }, t("rulesHelp")),
				view.rules.length === 0 ? h("p", { key: "empty", style: styles.notice }, t("empty")) : null,
				...view.rules.map((rule, index) => h("div", { key: `rule-${index}`, style: styles.card }, [
					h("div", { key: "head", style: styles.cardHead }, [
						h("h4", { key: "t", style: styles.title }, `${t("parent")} · #${index + 1}`),
						h("button", {
							key: "rm",
							type: "button",
							style: styles.button,
							disabled: !writable,
							onClick: () => patch((current) => ({ rules: current.rules.filter((_rule, at) => at !== index) }))
						}, t("removeRule"))
					]),
					h("p", { key: "hint", style: styles.hint }, t("parentHint")),
					h("div", { key: "parent", style: styles.row }, [
						routeField({
							key: "p",
							label: t("provider"),
							value: rule.parentProvider,
							list: catalog?.providers,
							disabled: !writable,
							onChange: (value) => patchRule(index, () => ({ parentProvider: value }))
						}),
						routeField({
							key: "m",
							label: t("model"),
							value: rule.parentModel,
							list: catalog?.models,
							disabled: !writable,
							onChange: (value) => patchRule(index, () => ({ parentModel: value }))
						})
					]),
					h("div", { key: "allowedHead", style: styles.cardHead }, [
						h("span", { key: "l", style: styles.label }, t("allowed")),
						h("button", {
							key: "add",
							type: "button",
							style: styles.button,
							disabled: !writable,
							onClick: () => patchRule(index, (current) => ({ allowed: [...current.allowed, { provider: "", model: "" }] }))
						}, t("addAllowed"))
					]),
					...rule.allowed.map((entry, at) => h("div", { key: `allowed-${at}`, style: styles.row }, [
						routeField({
							key: "p",
							label: t("provider"),
							value: entry.provider,
							list: catalog?.providers,
							disabled: !writable,
							onChange: (value) => patchRule(index, (current) => ({
								allowed: current.allowed.map((candidate, position) => position === at ? { ...candidate, provider: value } : candidate)
							}))
						}),
						routeField({
							key: "m",
							label: t("model"),
							value: entry.model,
							list: catalog?.models,
							disabled: !writable,
							onChange: (value) => patchRule(index, (current) => ({
								allowed: current.allowed.map((candidate, position) => position === at ? { ...candidate, model: value } : candidate)
							}))
						}),
						h("button", {
							key: "rm",
							type: "button",
							style: styles.button,
							disabled: !writable,
							onClick: () => patchRule(index, (current) => ({ allowed: current.allowed.filter((_candidate, position) => position !== at) }))
						}, t("removeAllowed"))
					])),
					h("span", { key: "dl", style: styles.label }, t("fallbackDefault")),
					h("div", { key: "default", style: styles.row }, [
						routeField({
							key: "p",
							label: t("provider"),
							value: rule.defaultProvider,
							list: catalog?.providers,
							disabled: !writable,
							onChange: (value) => patchRule(index, () => ({ defaultProvider: value }))
						}),
						routeField({
							key: "m",
							label: t("model"),
							value: rule.defaultModel,
							list: catalog?.models,
							disabled: !writable,
							onChange: (value) => patchRule(index, () => ({ defaultModel: value }))
						})
					]),
					h("p", { key: "dh", style: styles.hint }, t("defaultHint"))
				])),
				catalogFailed ? h("p", { key: "cat", style: styles.notice }, t("catalogFailed")) : null,
				...issues.map((issue, index) => h("p", { key: `issue-${index}`, style: styles.error }, issue)),
				conflict ? h("p", { key: "conflict", style: styles.error }, t("conflict")) : null,
				failed ? h("p", { key: "failed", style: styles.error }, t("saveFailed")) : null,
				saved && !dirty && !failed ? h("p", { key: "saved", style: styles.notice }, t("saved")) : null,
				h("div", { key: "actions", style: styles.row }, [
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
		* Render one provider/model text field with an optional catalog datalist.
		* @param props - label, value, datalist id, disablement, and change handler.
		* @returns the field element.
		*/
		function routeField(props) {
			const listId = props.list === void 0 ? void 0 : `${NAMESPACE}-${props.list.id}`;
			return h("label", { key: props.key, style: styles.field }, [
				h("span", { key: "l", style: styles.label }, props.label),
				h("input", {
					key: "i",
					type: "text",
					style: styles.input,
					value: props.value,
					disabled: props.disabled,
					list: listId,
					placeholder: props.label,
					onChange: (event) => props.onChange(event.target.value)
				}),
				listId === void 0 ? null : h("datalist", { key: "d", id: listId }, props.list.values.map((value, index) => h("option", { key: index, value })))
			]);
		}
		//#endregion

		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.per-model-subagent";
		/** Required client services. */
		const inject = ["slots", "locale", "configForms"];

		/** Collect distinct provider ids and `provider/model` values from the host catalog. */
		function catalogLists(catalog) {
			const providers = new Set();
			const models = new Set();
			for (const group of catalog?.groups ?? []) {
				providers.add(group.id);
				for (const model of group.models ?? []) models.add(model.id);
			}
			return {
				providers: { id: "provider", values: [...providers].sort() },
				models: { id: "model", values: [...models].sort() }
			};
		}

		/**
		* Mount the routing page while the Host serves this plugin's configuration.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "per-model-subagent: dictionaries");
			const form = ctx.configForms.get(NAMESPACE);
			ctx.effect(() => () => {
				form.dispose();
			}, "per-model-subagent: form subscription");
			const loadCatalog = async () => {
				const remote = ctx.get?.("remote");
				if (remote?.session?.modelCatalog === void 0) return null;
				const response = await remote.session.modelCatalog();
				return response?.ok ? catalogLists(response.value) : null;
			};
			ctx.effect(() => ctx.slots.inject("plugins.item", () => ctx.slots.register({
				name: "plugins.item",
				id: NAMESPACE,
				order: 30,
				label: () => t("title"),
				locale: NS,
				inject: () => ({ form, t, loadCatalog })
			}, RoutingPage)), "per-model-subagent: settings page");
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
			catalogLists
		};
		return module.exports;
	}
});
