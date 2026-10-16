# GCMS-EFFORT-001 — Apply project task effort routing

## Assignment and authority

- Revision: GCMS-EFFORT-001 v1; tracking ID assigned in this chat, not a claim that Khiêm typed this identifier.
- Owner/shared-record writer: this Codex main session as Project Coordinator for the explicitly requested governance update.
- Date: 2026-10-15, Asia/Ho_Chi_Minh.
- Branch/base: main, no commit; preserve all pre-existing untracked setup files.
- Direct human instruction: “Làm rõ effort dành riêng cho dự án này. Vì model's effort rất quan trọng để cho ra kết quả tốt nhất. Vì vậy tôi không muốn effort chung chung, phải assign đúng effort cho đúng loại task, và sau đó mới fallback về policy chung nếu chưa phân loại được loại task. Tham khảo matrix effort tôi gửi, đánh giá, áp dụng.”
- Scope: evaluate and apply the supplied matrix through project governance documents, deterministic routing helper/regression checks and necessary provenance updates.
- Latest restriction: pause project-detail/application work. No application, package installation, migration, service, Git delivery, paid resource, global configuration or model replacement is authorized.
- No agent was delegated. The setup's historical approval remains separate; it is not the authority for this change.

## Effort decision for this task

| Field | Current value |
| --- | --- |
| Task type | agent-policy-design |
| Risk signals | No application/data/security boundary change; routing/ownership policy design |
| Required effort | High |
| Selected model | Preserve developer selection; no model pin or replacement |
| Current main-session effort control | No exposed tool to read/change it |
| Runtime-requested effort for this main turn | Not controllable through the exposed tools |
| Observed model/effort | Unknown; do not claim High was actually applied to this turn |
| Child dispatch | NOT_RUN; no native role invocation or effort probe |

This record assigns the required effort and preserves the observation gap. It cannot retroactively set the effort of earlier work or the current running turn.

## Sources and decisions

The attached task/effort image was inspected directly as user-supplied reference data. The user request authorizes applying the matrix; the image does not add unrelated instructions or authority. The matrix has 12 original work categories; ambiguous ranges are split into 14 explicit routing categories.

- Preserve the matrix's High/xHigh assignments for analysis, architecture and audits.
- Resolve agent/document generation to Medium for settled rules and High for policy design.
- Resolve complex debugging to High; use xHigh for exceptional ambiguity/critical invariants.
- Keep ordinary implementation/tests Medium; apply higher domain risk floors for tenant, auth, private-data, publication and transaction/concurrency work.
- General inheritance occurs only when no task type/risk signal matches.
- Keep role adapters unpinned so one role can receive different explicit per-task effort.
- A policy file, prompt or helper output does not change runtime settings or prove their use.
- Do not downgrade or substitute models when the required effort/role is unavailable.
- Official schema and resolution mechanics were fetched from [Codex custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents) and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference). The current collaboration tool exposes reasoning_effort and requires fork_turns=none for an explicit override.
- No optimal-quality/cost claim is made; this matrix is a project policy, not a measured benchmark.

Skills applied: OpenAI Docs, documentation-and-adrs and TechNote. Current repository skill names are now advertised through the live developer-supplied catalog; this is discovery metadata, not proof that all 17 skills were invoked. The three project native agent selectors are still not exposed in this turn's spawn schema.

## Owned files

AGENTS.md, README.md, CONTRIBUTING.md; docs/model-routing.md; docs/agent-coordination-templates.md; docs/task-effort-policy.md and .json; scripts/route_task_effort.py; scripts/tests/test_task_effort.py; shared project context/plan/state; adoption and manifest updates; this task record and current verification results.

Canonical task matrix: docs/task-effort-policy.json. Explanation and dispatch rules: docs/task-effort-policy.md. Project Coordinator owns both and resolves any inconsistency. No role adapter, canonical/mirrored skill, license or global setting changes.

## Acceptance and evidence

| ID | Required outcome | Status |
| --- | --- | --- |
| E1 | All source categories retained; ranges resolve to one exact level | PASS: source-image comparison and exact routing cases |
| E2 | Category/risk first; mixed tasks take the highest required level; fallback only when unmatched | PASS: routing tests, CLI examples and missing-reason rejection |
| E3 | Sensitive implementation/tests escalate; unsupported xHigh does not silently downgrade | PASS: risk-floor negatives and expected unsupported exit 2; xhigh retained, fallback null |
| E4 | Explicit dispatch intent preserves role/model/permissions and reports observation limits | PASS: payload tests and unchanged role sources; runtime use remains NOT_RUN |
| E5 | AGENTS, coordination template, routing policy, shared state and adoption provenance agree | PASS: source review, 81 current hashes, nine declared local adaptations and local links |
| E6 | Current runtime effort remains Unknown unless exposed; no application/global/Git delivery changes | PASS: scoped output/Git inspection and explicit evidence boundaries; no native/settings change claimed |

## Verification

Actual scoped checks:

- python3 -B -m unittest discover -s scripts/tests -p 'test_*.py': PASS, 13 routing/negative tests. This tests the project helper, not native agents or the application.
- python3 scripts/route_task_effort.py: policy design → high; tenant implementation → xhigh with explicit reasoning_effort and fork_turns=none; unclassified task plus inspected reason → GENERAL_FALLBACK without effort override; ordinary examples exit 0.
- Architecture-review input with only medium/high supplied as supported values: expected exit 2, UNSUPPORTED, required xhigh retained, dispatch_allowed_by_effort false and no fallback. Caller-supplied capabilities are test inputs, not observed model support.
- python3 scripts/verify_agent_setup.py: PASS, 81 maintained hashes, nine declared local adaptations, 28 mirrors, 17 skills per root and three native definitions per client. Historical --setup-only mode is no longer applicable to this second authorized governance task.
- Original package-integrity recipe extracted and run directly: PASS, 20 original/six adapted canonical upstream files; no inherited PASS.
- Python AST: PASS. Source/allowlist review: PASS; only the five declared maintained source edits changed plus scoped project records/helper/tests. No source role/skill/license/global configuration changed.
- Git inspection: local main, no commits/remotes/staged files. No application/package artifacts or service execution.

The first broad patch was rejected because one README context line did not match. Inspection confirmed no partial write; the corrected exact-context patch succeeded. A separate state-file replacement was rejected for duplicate target operations and then corrected to a normal update. These were local edit-tool errors, not runtime effort failures or permission changes.

No independent native reviewer, child/runtime observation, benchmark, Claude effort equivalence or application test is claimed.

## State and handoff

Current state: POLICY_ROUTING_VERIFIED_NATIVE_NOT_RUN. Current result: matrix, deterministic helper, regression tests and linked project directives applied. Receiver: Khiêm. Application/project-detail work remains paused; choosing effort does not resume it. Current main/child effort remains Unknown until exposed by runtime metadata; no fixed role effort, model pin, global setting or native invocation was introduced.
