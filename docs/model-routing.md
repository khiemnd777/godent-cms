# Model routing and native adapters

The task delivery owner is normally the main session using the developer's selected model. Existing named Godent CMS coordinators retain their assigned integration and shared-record accountability; a separate Coordinator is not required for each task. Start the main session normally. Do not force a main-session `--agent` flag or replace the default system prompt to use this kit. The role documents describe responsibilities; native adapters configure optional subagents.

## Project task routing first

For godent-cms, apply the [task effort policy](task-effort-policy.md) and [machine-readable matrix](task-effort-policy.json) before general defaults. Classify the task and risk signals, choose the highest applicable exact effort and record the route. Matched tasks use explicit supported effort selection; do not simply inherit an arbitrary parent effort. The policy applies to the coordinator and every delegated task, including reviews and tests.

The Codex role adapters still omit `model` and `model_reasoning_effort` intentionally: a role is not a task category. Preserve the developer's selected model; set effort per classified task through supported invocation/runtime controls. Do not pin a single effort to kit-explorer, kit-implementer or kit-reviewer. [Official precedence](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents) resolves omitted settings from explicit spawn values, agent defaults and parent settings, while an explicit custom-agent setting takes precedence over that result. Verify the route, not only the requested argument.

## General fallback

Use inheritance only after no matrix task category and no risk floor matches. Record the unclassified task and reason. This is the project's general fallback, not a Medium default. An unsupported required effort, missing role selector or unknown observed setting does not justify lowering a matched task or calling it unclassified. Preserve the existing model selection and report the resulting observed effort if exposed.

The Claude adapters use `model: inherit` and omit effort. Their effort mechanism/equivalence has not been verified for the installed client. Do not map Codex labels into unsupported Claude fields or claim the task's required effort was applied merely from prose.

For each delegated task, keep requested and runtime-observed routing evidence in its existing record under the project effort policy. Reuse valid observations instead of repeating model reports per phase; the meaningful-boundary check and mismatch rule remain binding. If the runtime does not expose the resolved model or effort, mark the value **Unknown**. Do not claim inheritance was verified from a successful configuration parse.

## Deliberate project customization

If a project needs different routes, document the reason and approved scope in that project's instructions and task contract. Verify the installed runtime schema before adding supported project-local model fields or invocation overrides. Keep the main coordinator choice separate from subagent settings. Do not edit global profiles, settings, environment variables, hooks or MCP configuration as part of kit setup.

Model selection does not grant tools, filesystem access or approval. Every adapter retains parent permission limits and the assigned task boundary. Investigation and review remain free of application code changes, implementation and deployment even if another model is selected. A runtime may reject a setting or restrict a child further; report that outcome rather than bypassing it.

## Role responsibilities and runtime permissions

Explorer and reviewer roles do not change application code, implement features or repairs, or deploy. Their adapters omit Codex `sandbox_mode` and Claude `tools`, `disallowedTools` and `permissionMode`; the kit does not impose a permission profile by role. Codex inherits omitted session settings from the parent. Claude inherits available subagent tools and the parent permission mode when those fields are omitted. Managed policy, runtime filtering and actual task authorization still apply.

Authorized checks, application/browser inspection and evidence capture may use inherited tools when the task covers their side effects, fixtures and destinations. Available tools do not authorize application edits or out-of-scope actions. Implementer writes remain limited to approved ownership. Follow runtime approval mechanisms and report restrictions without bypassing them. Static parsing verifies omitted fields and role text; effective access and role behavior require separate native observations.

The adapters use their platform's schema and explicit instructions to read common role documents. Paths in prose are instructions to read files; they are not an automatic import mechanism. No child may recursively spawn agents. The assigning delivery owner integrates authorized delegated work. Existing designated Project Coordinators or directly human-authorized bounded writers retain shared-record authority. No default Supervisor or additional approval hierarchy is added.

## Evidence status

**Verified:** adapter files specify the documented inheritance intent and bounded role instructions. Static parsing can verify syntax and expected fields.

The classifier emits intent. The [runtime launcher/check](task-effort-policy.md#runtime-execution-and-observation) also binds matrix effort to new CLI coordinator execution and checks runtime-written metadata. For native children, pass the classified payload to the actual spawn tool and compare the returned runtime identity/settings. Run the coordinator check at task boundaries; a mismatch blocks affected work. An active desktop turn cannot silently switch its own effort.

**Verified on this machine:** [GCMS-EFFORT-002](tasks/GCMS-EFFORT-002.md) observed current desktop coordinator high, a launcher-selected medium coordinator and exact kit-implementer / kit-explorer / kit-reviewer children at medium / high / xhigh. All recorded the selected gpt-6.1-sol model; child metadata matches the actual native spawn arguments and parent IDs. This is configuration conformance for the tested runtime, not a role-wide effort pin or application review.

**Unknown / NOT_RUN:** effective child permission enforcement, Claude effort equivalence and two-machine behavior. Fresh CLI discovery/invocation passed; the existing desktop tool schema still lacks exact Kit selectors. Record separate observations for other clients/machines before claiming portability. Runtime-written configuration does not reveal internal reasoning.

## Sources

Upstream permission sources were checked on 2026-10-13 and model sources on 2026-10-12. Codex custom-agent effort/schema/precedence was rechecked for this project on 2026-10-15:

- [Codex custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents)
- [Claude subagent model selection](https://code.claude.com/docs/en/sub-agents#choose-a-model)
- [Claude tool inheritance](https://code.claude.com/docs/en/sub-agents#frontmatter-reference)
- [Claude permission modes](https://code.claude.com/docs/en/sub-agents#permission-modes)

These describe the intended configuration; verify version-sensitive behavior against the installed runtime when adopting or customizing the kit.
