# GCMS-DOCS-003 — Primary URL and page-level 301 redirects

## Assignment and direct authority

| Field | Value |
| --- | --- |
| Revision / date | GCMS-DOCS-003 v1 / 2026-10-15, Asia/Ho_Chi_Minh |
| Human Project Lead / approver | Khiêm |
| Accountable task/shared-document owner | Desktop main / Project Coordinator; retains final integration inspection |
| Sole execution writer | Existing bounded CLI documentation session on desktop's behalf; no independent decisions, parallel writer or new delegation |
| Goal | Record approved option A and synchronize primary URL, activation, canonical/301 contracts and future acceptance |
| State | STATIC_DOCS_VERIFIED; desktop static/source integration PASS; human delivery acceptance unrecorded |
| Workspace / Git | Preserve existing tracked/untracked work; Git not inspected in this task and no Git writes authorized |

Fresh direct human approval in the current conversation, 2026-10-15:

> Approved phương án A. Cập nhật tài liệu: dùng URL Godent trước; khi admin kích hoạt tên miền riêng đã xác minh và TLS hợp lệ, chuyển canonical sang tên miền riêng và redirect 301 từng trang. Chưa triển khai ứng dụng hay cấu hình DNS.

This approves documentation/static checks only for GCMS-DOCS-003, not inherited execution authority from GCMS-DOCS-002 or the preceding read-only advisory. Earlier D1–D4 and deferred D5 remain unchanged. The latest restriction is exactly “Chưa triển khai ứng dụng hay cấu hình DNS.” No application, package/lockfile, dependency, fixture, service, database/migration, Docker artifact, DNS/TLS/configuration, Git/global/external/paid write, purchase or real data is authorized. No agents or background writers are launched. Native permissions and the selected model are unchanged. Silence grants no approval.

## Scope and sources

Authorized affected paths only:

```text
AGENTS.md
README.md
CONTRIBUTING.md
docs/product-scope.md
docs/architecture.md
docs/workflows.md
docs/acceptance-criteria.md
docs/access-control.md
docs/project-context.md
docs/project-plan.md
docs/project-state.md
docs/tasks/README.md
docs/tasks/GCMS-DOCS-003.md
docs/decisions/004-primary-url-and-301-redirects.md
docs/verification-results.md
docs/agent-kit/adoption.md
docs/skills-manifest.json
```

Read applicable AGENTS/team policy/coordinator, documentation-and-adrs, affected current product/project sources, ADR-003 and existing verifier/manifest recipe. Architecture remains the canonical detailed resolver/primary-URL contract; ADR-004 supersedes only ADR-003's canonical deferral without editing historical ADRs/tasks/evidence or source observations. No generic Kit role/skill/config, source snapshot, matrix/helper, script or Git metadata changes.

Entry hash comparison against the supplied immutable `/tmp/gcms-canonical-before.json`: **PASS, 113/113 files matched, zero extras or missing files**. Include untracked files and preserve binary .DS_Store by hash, never text decoding. New project task/ADR remain outside the 81-file maintained Kit inventory; preserve its nine adaptation paths and all source/template provenance. Refresh only intentionally changed maintained entrypoints, appending previous digest/task/reason and one project_changes record.

## Approved contract and acceptance

| ID | Required documentation outcome | Result |
| --- | --- | --- |
| URL-01 | One tenant/site/content/publication/leads; Godent primary/self-canonical initially, own custom domain after explicit active same-tenant admin activation with verified active binding, valid TLS and equivalent eligible published pages | PASS — Godent-first, explicit own-domain activation and one-site/current-publication invariants agree across current sources |
| URL-02 | Public GET/HEAD platform aliases return 301 directly to same-page/same-language custom target; no homepage catchall, drafts, loops/chains/cross-tenant/open redirects or blanket API/admin/preview/media/POST redirect | PASS — direct same-page/same-language 301 only for public GET/HEAD, dedicated non-page contracts and negative acceptance cases |
| URL-03 | Stable primary per tenant; current mapping/publication/cache/jobs and SEO outputs remain consistent through activation/races; no draft publication or outage-driven reversal | PASS — tenant-level primary, consistent current mapping/publication/cache/jobs/SEO and no draft publication or outage reversal |
| URL-04 | D1–D4/D5 and prior files preserved; only genuinely open locale/slug/later-domain-lifecycle/provider details deferred | PASS — D1–D4/D5 unchanged; all historical/protected baseline files byte-identical, remaining deferrals explicit |
| URL-05 | Existing ordinary verifier/original recipe, focused source review, known-text whitespace, baseline/path hashes and maintained provenance pass | PASS — ordinary verifier/original recipe, 97 Markdown/456 links, 114 text files, scoped hashes and maintained provenance |
| URL-06 | Closing records distinguish static proof, separate desktop inspection, unrecorded human delivery acceptance and live NOT_RUN | PASS — current closing records reconciled; desktop static/source integration PASS and human delivery acceptance unrecorded; live checks NOT_RUN |

## Runtime effort

Actual task **multi-tenant-architecture**, risks **tenant-isolation** and **publication-integrity** → required **xhigh**, matrix GCMS-EFFORT-001 v1. Requested inherited desktop-selected **gpt-6.1-sol / xhigh** per process; no fallback, policy/helper/model/configuration change.

Before substantive work:

```sh
python3 -B scripts/runtime_task_effort.py --task-type multi-tenant-architecture --risk tenant-isolation --risk publication-integrity --current-session
```

**PASS, exit 0:** observed **gpt-6.1-sol / xhigh**; turn `01a13f6b-f628-7110-9303-70f6a7f52c81`, timestamp `2026-10-15T11:56:47.307Z`, thread `01a13e94-1f95-7410-90b0-3249ab30c1c7`, CLI `0.162.0-alpha.17.2`, source kind exec, role/parent null, evidence runtime_written_turn_context; policy SHA-256 `a75d33f9599567cd7385b9b35fba9ef4b9c92ff453899b82311261744b6ee6e9`. This proves recorded settings, not hidden reasoning, quality or permission enforcement. Desktop reports its own high mismatch; only this checked writer performs substantive architecture edits. No child or independent reviewer ran.

## Results and handoff

**STATIC_DOCS_VERIFIED; desktop static/source integration PASS (see below).** Human product-policy approval is recorded above; human delivery acceptance is unrecorded. No delivery acceptance or independent review is inferred from static PASS.

| Actual check | Result / proof boundary |
| --- | --- |
| Ordinary package verifier | PASS, exit 0: python3 -B scripts/verify_agent_setup.py; 81 maintained hashes, nine declared adaptations, 28 mirror pairs, 17 skills per root, three native definitions per client, 20 original/six adapted upstream canonical files, 97 Markdown files and 456 local links/anchors; frontmatter/TOML and setup/Bun provenance valid |
| Unchanged original recipe | PASS, exit 0: original Python heredoc extracted from docs/verification-guide.md and executed unchanged in memory with python3 -B -; inventory/mirrors/17 skills/20 original/six adapted upstream files valid; no saved harness |
| Sequential source review | PASS, source only: current sources consistently select Godent-first primary, explicit same-tenant activation and page 301; no stale unresolved canonical decision. Roles/publication/D4/D5 retained; no independent reviewer or agent |
| Known-text whitespace/newlines | PASS: 114 known text files, including untracked files; no trailing whitespace/missing final newline. Binary .DS_Store excluded from text scan |
| Baseline/path preservation | PASS: supplied 113-file baseline → 15 existing allowlisted files modified, two allowed new docs, 98 byte-identical files, 115 total; no deletion or unexpected path. Historical tasks/ADRs/evidence/reference, helpers/scripts/config/skills/mirrors and source snapshots preserved |
| Maintained provenance | PASS: exactly three existing entrypoint updates with baseline previous digest/task/reason and one appended project_changes; 81 inventory/nine adapted paths, upstream origins/template digests, mirror inventory and prior provenance preserved |
| Binary preservation | .DS_Store unchanged, SHA-256 99b60e8a0494b15778f22e441a06e440e3062306dc73362216b7bfe142e68343 |
| Reused sources / omitted checks | Google technical sources read in the same-day advisory and reused, not fetched again. No new harness, unchanged routing unit suite, application tests or Git inspection ran; no background writer launched |

All 15 existing paths in this task's allowlist changed; the two new paths are this task and ADR-004. No other path changed. Final closing records update only result prose; the verified Markdown link graph and maintained entrypoint bytes are unchanged. Focused final text/path/provenance checks reconcile that closing update.

Receiver: desktop main for its separate final integration inspection. Future implementation owners remain unassigned. No new product decision, presentation level or execution authority is inferred.

Application/runtime/routing/browser/security/build/fixtures, registration/DNS/TLS/provider and deployment checks are **NOT_RUN**: outside authority and no application implementation exists. Domain registration remains human-reported. Static documentation proof cannot establish live behavior, SEO results or legal compliance. Desktop integration and human delivery acceptance remain separate; no implementation follows automatically.

## Desktop final integration inspection

**PASS — static/source integration complete.** Desktop inspected the completed xhigh writer handoff (native exit 0), current ADR-004/architecture/acceptance and closing-source references. It independently reran the existing ordinary package verifier and unchanged original recipe: PASS, 81 maintained hashes, nine adaptations, 97 Markdown files and 456 local links/anchors. Known-text whitespace/newline checks passed for 114 files. All-file baseline comparison confirms 15 existing allowlisted changes, two additions, 98 byte-identical files, no deletion and no unexpected path; exactly three maintained entrypoint updates retain provenance. Historical task/evidence/ADR/reference and helper/config sources are preserved.

Desktop closing-record bookkeeping uses its runtime-observed high effort and does not redesign the routing contract. The execution writer's current gpt-6.1-sol/xhigh metadata above remains the architecture-work evidence. This is sequential integration, not an independent security/architecture or live application review. Task/context/plan/state/results now record this delivery's own integration PASS. Human delivery acceptance is unrecorded; receiver is Khiêm. Application, routing, DNS/TLS and deployment checks remain NOT_RUN; no application, configuration or Git delivery follows.
