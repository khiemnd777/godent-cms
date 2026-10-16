# Project task effort policy

**Policy:** GCMS-EFFORT-001 v1. **Scope:** godent-cms only. **Source:** Khiêm's direct request on 2026-10-15 to evaluate and apply the supplied task/effort matrix, using the general policy only for unclassified tasks.

The matrix is a project decision about reasoning allocation, not an empirical guarantee of best results. Higher effort does not replace domain evidence, tests, independent review when warranted, or human authority. Preserve the developer's selected model.

## Assessment and exact assignments

The supplied matrix is adopted. Its two ranges are split into conditions; sensitive implementation/testing receives a higher risk floor instead of staying Medium.

| Task type | Required effort | Routing key / condition |
| --- | --- | --- |
| Analyze Agent Kit repository | High | agent-kit-analysis |
| Analyze dental CMS requirements | High | cms-requirements-analysis |
| Design multi-tenant SaaS architecture | xHigh | multi-tenant-architecture |
| Assess tenant isolation, RBAC and security | xHigh | tenant-rbac-security-review |
| Select technology stack | High | tech-stack-selection |
| Review architecture before a decision | xHigh | architecture-review |
| Initialize from an agreed template | Medium | template-initialization; no unresolved architectural/policy decisions |
| Generate agents, skills and documents from settled rules | Medium | agent-artifact-generation |
| Design/change agent, skill, approval, ownership or effort policy | High | agent-policy-design |
| Implement bounded APIs, services and components | Medium | implementation; settled contracts and no higher risk floor |
| Ordinary unit/integration test development/execution | Medium | test-development; no higher risk floor |
| Difficult debugging | High | complex-debugging; cross-layer ambiguity or competing causes |
| Exceptionally complex debugging | xHigh | critical-debugging; critical invariants, unresolved competing hypotheses, or a failed High investigation with new evidence requiring deeper analysis |
| Final architecture/security audit | xHigh | final-architecture-security-audit |

Use lower-case runtime values medium, high and xhigh. The [machine-readable matrix](task-effort-policy.json) is the routing source; this document explains classification. Changes to either require consistency checks.

## Classification order

1. Identify the actual task outcome and relevant risks before substantive work, assignment or review. A role name, skill name, phase label or file extension does not determine effort.
2. Match the most specific matrix category. Apply all relevant [risk floors](#risk-floors). Select the highest required effort for an inseparable mixed task; split independent tasks when useful.
3. Resolve Medium/High or High/xHigh from the stated conditions. Never leave a task assigned a range.
4. If no category and no risk signal matches after reasonable inspection, record the unclassified task and reason, then use [general fallback](model-routing.md#general-fallback). Do not start from inheritance and skip classification. A known task must not use fallback because routing or an effort level is unavailable.
5. Keep the required effort, requested effort, execution mechanism and observed effort distinct. Reclassify when the task's scope/risk changes. Do not silently downgrade to fit a budget/model.
6. A direct human override takes precedence within its stated scope. Record the exact decision and any conflict with the usual risk floor; an agent cannot manufacture an override.

No new approval round is needed for ordinary routing inside approved work. Effort assignment never approves application work, extra agents, cloud resources, a model change, writes, Git delivery or deployment.

## Risk floors

| Condition anywhere in the task | Minimum effort |
| --- | --- |
| Tenant boundaries/RLS, cross-tenant references, host/cache/media/job isolation | xHigh |
| Authentication/authorization/RBAC/session trust boundaries or security controls | xHigh |
| Sensitive lead/patient data access, leakage, retention, deletion or publication permission | xHigh |
| Publication/review revision integrity, stale review, draft leakage or public revocation | xHigh |
| Transactions, retry/idempotency correctness, races or concurrent data integrity | xHigh |
| Irreversible data changes/migration/recovery choices | xHigh |
| Shared module/API/data contracts with multiple consumers | High |
| Bun/framework/driver/auth/media/worker runtime compatibility | High; apply xHigh if a higher-risk boundary is involved |

An ordinary database read, cosmetic UI change, running an already-settled check, or recording a previously made decision does not automatically count as boundary design. Classify the reasoning needed for the actual task. Never label an auth/RLS/publication change as routine CRUD to keep Medium.

## Dispatch and coordinator responsibility

The Project Coordinator classifies each task and records the selected route. The same policy applies to the coordinator's own analysis, implementation and review.

A read-only helper prints the decision and candidate spawn arguments:

```sh
python3 scripts/route_task_effort.py --task-type agent-policy-design --role coordinator
python3 scripts/route_task_effort.py --task-type implementation --risk tenant-isolation --role implementer
python3 scripts/route_task_effort.py --task-type architecture-review --role reviewer
```

The helper does not call models, spawn agents, change settings or grant authority. It does not infer a category from natural-language task text; the coordinator must classify from the actual scope and evidence.

An unmatched invocation requires --unclassified-reason with the inspected classification reason. Without it the helper rejects fallback, rather than treating a missing category as permission to inherit automatically.

For Codex children, keep the three role adapters without fixed model/effort fields so one role can handle different task types. Where the actual tool supports invocation effort, pass the exact required value. In this conversation's collaboration tool, that is reasoning_effort; model_reasoning_effort is the TOML configuration field, not that tool parameter. An explicit effort override requires fork_turns=none here. Supply the child a sufficient bounded brief and source paths instead of claiming the full parent history was copied. Preserve the selected model by omitting a model override. Do not silently substitute a built-in/global/Noah role for an unavailable project role.

Before dispatch, verify that the installed runtime exposes the intended role and supports the selected effort for the selected model. A task prompt saying “use xHigh” is not a runtime setting. If an explicit custom-agent effort is later configured, it takes precedence over resolved spawn/default values; inspect that route rather than assuming the spawn request won.

The current desktop turn cannot change its own effort through the exposed controls. Its runtime-written session log does expose the actual recorded model/effort. Read that metadata with the check below. If the observed effort differs, stop affected substantive work and use a supported next-turn setting or an explicitly authorized new coordinator launch. If metadata is unavailable, record Unknown and keep the required criterion open. Writing a policy or prompt does not change the running turn.

If a model rejects or lacks a required effort, report the mismatch and keep affected work pending; do not fall back to a lower level or another model automatically. Native tests are useful only for a concrete authorized claim. Do not launch throwaway agents or construct permission/identity harnesses for each task.

Claude numeric/label equivalence and effective effort have not been verified. Apply the classification, but do not copy Codex effort values into unsupported Claude configuration or claim equivalent runtime settings.

## Runtime execution and observation

The [runtime helper](../scripts/runtime_task_effort.py) consumes the same JSON matrix as the classifier. At a meaningful task boundary, check the current coordinator before substantive work:

```sh
python3 -B scripts/runtime_task_effort.py --task-type agent-policy-design --current-session
```

The helper locates CODEX_THREAD_ID in local runtime history, validates the thread/workspace and reads the latest runtime-written turn context. It compares exact required effort and reports model, turn ID, policy digest and errors. PASS concerns recorded configuration, not hidden reasoning contents or output quality. A mismatch, missing evidence or native failure returns exit 3. It reads no credential configuration and exports no chat content. Session history must be available; the format is version-sensitive.

For an already-authorized task that needs a new coordinator, supply its bounded brief as a prompt file:

```sh
python3 -B scripts/runtime_task_effort.py --task-type agent-artifact-generation --current-session --execute --prompt-file /absolute/path/to/approved-task.txt
```

This is real execution, not a preview. The launcher reads the selected model from the parent metadata, derives effort from the matrix and passes model_reasoning_effort through a per-process codex exec configuration override. It then reads the new coordinator's actual metadata and compares model/effort. No global setting is changed. The CLI must be available and native approvals remain active. This starts a separate coordinator with an explicit brief; it does not transfer the desktop conversation or shared-document ownership. The default timeout is 180 seconds; a timeout is FAIL and descendant completion remains Unknown until checked. Unclassified work omits the effort override and reports the resulting CLI default; it does not claim inheritance from an unrelated desktop turn.

For a native child, take spawn_arguments from route_task_effort.py, including the exact Kit role, reasoning_effort and fork_turns=none. Send the bounded task brief through the native spawn tool; do not turn a child into an independent CLI root. Verify its runtime log with the matching category/role, --session-log, --expected-thread, --expected-parent and --expected-model. Those identities come from the actual spawn response and parent runtime. Do not use the child's self-report as evidence. The wrapper deliberately rejects --execute for child roles.

Reuse a verified result while its relevant task/turn/settings remain valid. Recheck when those inputs change; do not create test agents for every action. Current checks are project workflow controls, not a host-wide interceptor that prevents every manual Codex invocation.

## Task record fields

For each meaningful work item, record:

- Task category, risk signals, selected effort and short reason.
- Requested model selection: inherit the developer's model unless explicitly changed.
- Requested effort and mechanism: UI/runtime selection, explicit spawn parameter, or documented general fallback.
- Observed model/effort when exposed; otherwise Unknown.
- Any mismatch, human override, fallback reason, scope change and next action.

The [coordination template](agent-coordination-templates.md#task-assignment) includes these fields. Keep routine reports concise; record the detailed decision in the existing authorized task record. Do not make model/effort a dependency of the product's runtime or use agent self-report as proof.

## Evidence

**Verified:** supplied image inspected; official Codex schema/precedence checked; policy and routing helper written and locally checked as recorded in [GCMS-EFFORT-001](tasks/GCMS-EFFORT-001.md).

**Verified runtime follow-up:** [GCMS-EFFORT-002](tasks/GCMS-EFFORT-002.md) records current desktop High, a matrix-launched CLI coordinator at Medium and actual Kit children at Medium/High/xHigh. Requested spawn arguments and runtime-written role/parent/model/effort agree. [Filtered evidence](evidence/effort-runtime-002.json) contains the observations. A High coordinator intentionally checked against xHigh returns FAIL, exit 3.

**Unknown / NOT_RUN:** Claude effort equivalence, two-machine behavior, universal client discovery and internal reasoning. Exact Kit selectors were available in a fresh CLI run; the already-open desktop spawn schema still lacks them. Child permission enforcement was not tested. Past work is not retroactively relabeled High/xHigh.

The task matrix is user-selected policy. It has not been benchmarked as an optimal cost/latency/quality allocation.

Sources: [Codex custom-agent settings](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents), [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference). These support setting mechanics; they do not validate this project's task-quality matrix.
