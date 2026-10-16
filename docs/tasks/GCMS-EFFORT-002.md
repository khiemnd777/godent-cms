# GCMS-EFFORT-002 — Runtime effort verification

## Authority and scope

On 2026-10-15 Khiêm directly requested: “Kiểm tra cách áp dụng và xác minh effort thực tế của coordinator và subagents. Tôi muốn matrix được dùng khi chạy task, không chỉ nằm trong tài liệu. Chưa triển khai ứng dụng.”

Owner/shared writer: this main Codex session. Scope: trace matrix-to-runtime dispatch, inspect filtered settings/turn metadata, run bounded synthetic native conformance checks, implement scoped governance wiring/evidence where needed, and reconcile project records. Application work, packages, migrations, deployment, global settings and Git delivery remain excluded.

Required effort: agent-policy-design → high. The current chat's runtime-written context matches the latest user request and records gpt-6.1-sol / high. That is recorded runtime configuration evidence, not a claim about internal reasoning contents or quality.

## Findings before native execution

- route_task_effort.py computes a route/payload; it does not execute it.
- Current desktop spawn schema does not expose the exact Kit selectors.
- Existing control-socket proxy was unavailable, including after narrow runtime permission; no active turn/settings were changed.
- A separately started temporary stdio app-server succeeded after runtime permission. Filtered config/read reported model gpt-6.1-sol, effort high, and no explicit child defaults.
- model/list reported medium/high/xhigh supported for gpt-6.1-sol.
- Installed CLI: 0.162.0-alpha.17.2. Generated version-specific protocol schema confirms turn/start.effort overrides the turn's effort.
- A standalone config/read is disk-default evidence; the persisted active turn context is the coordinator observation.
- Source body, credentials and full unrelated chat history must not enter project evidence.

## Synthetic native conformance assignment

A separate CLI probe coordinator uses this repository and the same selected model at high. It may make exactly one bounded native call to each available exact Kit role, with matrix-derived efforts:

| Probe | Category | Role | Required effort |
| --- | --- | --- | --- |
| Normalize a small inline artifact under settled rules | agent-artifact-generation | kit-implementer | medium |
| Inspect the project effort-routing rule | agent-policy-design | kit-explorer | high |
| Review a synthetic routing invariant | architecture-review | kit-reviewer | xhigh |

Children have read-only task scope, no writes or recursive delegation. They report short tokens/findings. If a Kit selector/effort is unavailable, report the gap; do not substitute an unrelated role/model. The CLI conformance root is separate from the live desktop coordinator. Verify parent/child links and actual turn context, not self-report. Keep scope, permissions and client environment differences explicit.

## Acceptance / current state

1. Match current desktop coordinator's recorded model/effort to matrix: observed high, required high.
2. Real Kit role invocation and actual child effort: PASS for all three exact roles in fresh CLI.
3. Medium/high/xhigh selected from the matrix and compared with runtime metadata: PASS; actual spawn arguments, child identity/parent and model also match.
4. Missing selector, unsupported/mismatched effort and inability to inspect remain visible; no silent fallback.
5. No application/global/Git delivery changes.

State: RUNTIME_EFFORT_VERIFIED_BOUNDED. The requested configuration conformance and local execution wiring are complete. Human acceptance is not recorded.

## Actual runtime results

| Runtime | Task category | Required / observed | Result |
| --- | --- | --- | --- |
| Current desktop coordinator | agent-policy-design | high / high | PASS |
| Separate CLI probe coordinator | agent-policy-design | high / high | PASS |
| Matrix-launched CLI coordinator | agent-artifact-generation | medium / medium | PASS |
| Native kit-implementer child | agent-artifact-generation | medium / medium | PASS |
| Native kit-explorer child | agent-policy-design | high / high | PASS |
| Native kit-reviewer child | architecture-review | xhigh / xhigh | PASS |

All six runtime contexts record gpt-6.1-sol. The native root exited 0 after three children completed. Each child used fork_turns=none, an explicit reasoning_effort argument, no model override and no recursive delegation. The synthetic reviewer check is not an application or complete-package architecture audit.

[Filtered evidence](../evidence/effort-runtime-002.json) records runtime session/turn identities, source basenames, timestamps, installed version, matrix digest and exact non-prompt spawn arguments. Read from session_meta / turn_context and actual native function calls; no conclusions depend on agent self-report. Personal paths are normalized to the project root. This is runtime-recorded configuration evidence, not access to hidden model reasoning.

## Reusable execution changes

- scripts/runtime_task_effort.py uses the canonical resolver. Check mode verifies current coordinator or explicit child metadata, workspace, thread, expected model, role and parent. Missing/mismatched proof returns exit 3.
- --execute derives model from the observed parent and effort from the matrix, passes a per-process codex exec override, then checks the resulting actual runtime. The real launch selected medium and observed medium. It starts an independent coordinator and does not transfer writer authority.
- Native children use route_task_effort.py spawn_arguments through the actual supported spawn tool. The checker rejects using CLI root execution as a substitute for a child.
- AGENTS, policy, routing, contribution and assignment instructions require this task-boundary workflow. No global hook or host-wide interceptor was installed.
- An intentional architecture-review check against current high observed the xhigh mismatch and returned FAIL / exit 3 without launching execution. A known task never enters general fallback to evade a mismatch.

## Verification and limits

23 focused tests PASS; three child CLI metadata comparisons PASS; current coordinator comparison PASS. Package/mirror/provenance/link checks and the existing upstream recipe PASS as recorded in [results](../verification-results.md). A sequential coordinator source review checked scope, non-shell execution, preserved selected model, explicit effort binding, identity comparisons, missing evidence and unsupported-level behavior. No independent review of the final helper is claimed.

The active desktop turn cannot change its own effort. A supported next-turn selection or an explicitly authorized new CLI coordinator is needed when it differs from the matrix. Fresh CLI discovery does not prove the existing desktop schema changed. Child permission enforcement, Claude effort equivalence and two-machine portability remain Unknown / NOT_RUN. The matrix is not benchmarked as optimal quality/cost. No application, dependencies, global settings, migrations, deployment or Git delivery were changed.
