# GCMS-DOCS-002 — Platform path and custom domain for one website

## Assignment and direct authority

| Field | Value |
| --- | --- |
| Revision / date | GCMS-DOCS-002 v1 / 2026-10-15, Asia/Ho_Chi_Minh |
| Human Project Lead / approver | Khiêm |
| Accountable task/shared-document owner | Desktop main / Project Coordinator; retains final integration inspection |
| Sole execution writer | Existing bounded CLI documentation session, acting on desktop's behalf; no independent product decisions or new delegation |
| Goal | Document two entry routes to one tenant website and synchronize resolver, isolation, URL generation and future acceptance |
| State | STATIC_DOCS_VERIFIED; desktop static/source integration PASS; human delivery acceptance unrecorded |
| Branch / base | Existing untracked main with no commits; preserve all prior edits |

The direct human clarification in the current conversation is:

> khách vào website bằng 2 cách: godent.vn/tên-nha-khoa và tên miền của riêng họ. tên miền godent.vn chính là tên miền của dự án này. đã được đăng ký.

The human then explicitly approved:

> Cập nhật tài liệu để hỗ trợ godent.vn/tên-nha-khoa và tên miền riêng cùng trỏ về một website của tenant. Đồng bộ kiến trúc, routing và tiêu chí nghiệm thu. Chưa triển khai ứng dụng hay cấu hình DNS.

This is fresh documentation authority for GCMS-DOCS-002, not inherited execution approval from GCMS-DOCS-001. The latter's simple D1–D4, corrected inactivity retention and deferred D5 remain unchanged. Only the platform-subdomain routing assumption is superseded. Registration of godent.vn is **human-reported**; DNS, TLS and serving status are **not verified**. No external browsing/probing is performed or needed for this approved specification.

No application/packages/lockfiles, dependencies, services, fixtures, databases/migrations, Git writes, global/custom-agent configuration, DNS/TLS configuration, purchases, real data, email, paid resources or external writes. No new agents, parallel writer or independent decision authority. Preserve other work. Policy approval, static documentation proof, desktop integration and human delivery acceptance remain separate.

## Scope and source contracts

Authorized paths only:

```text
AGENTS.md
README.md
CONTRIBUTING.md
docs/product-scope.md
docs/architecture.md
docs/acceptance-criteria.md
docs/workflows.md
docs/access-control.md
docs/project-context.md
docs/project-plan.md
docs/project-state.md
docs/tasks/README.md
docs/tasks/GCMS-DOCS-002.md
docs/decisions/003-platform-path-and-custom-domain.md
docs/verification-results.md
docs/agent-kit/adoption.md
docs/skills-manifest.json
```

Change only affected paths. Access control need not change because its tenant/resource/action and minimal-role rules still apply. No previous task/evidence, ADR-001/002, reference observation, generic Kit role/skill/config, script, model/effort matrix/helper or Git metadata may change. ADR-003 references the earlier decisions without editing their historical text. Architecture is the canonical detailed resolver contract; do not create another routing spec.

Read AGENTS/team policy/coordinator role, documentation-and-adrs, git-workflow for read-only Git inspection, current project/product/architecture/workflow/acceptance documents, current ADRs and relevant existing verification/provenance code. Baseline `/tmp/gcms-domains-before.json` supplies 111 non-Git file hashes; entry comparison matched all 111 with no additions/deletions. Preserve the pre-existing binary .DS_Store by hash, not text decoding. Preserve this baseline unchanged.

## Approved behavior and deferred choices

- `godent.vn/<tenant-slug>/<site-page-path>` and `<verified-custom-host>/<site-page-path>` resolve to the same tenant/site, theme/content/media, publication state and lead list. No second website, content copy, product or analytics feature is introduced.
- On the platform host, registered path prefix selects the public tenant/site; hostname alone cannot do so. On a verified active custom host, its binding selects the tenant/site and the full path stays within that site; another tenant's slug in its first segment cannot switch tenants.
- Validate unique normalized slugs, reserved platform/admin/API/static namespaces, normalized hosts/trusted proxies, current bindings and tenant/site/resource eligibility. Raw host/path/form hints never override private authorization or validated tenant context.
- Navigation/forms/assets/locales/SEO/cache and link-producing durable jobs must use the validated entry base and current mapping identity. Prevent leakage across equal page paths, stale bindings and reassignment. Both intake routes use the same tenant-wide list and tenant-scoped 24-hour idempotency contract.
- Exact locale syntax, reserved-name list, slug lifecycle/aliases, DNS/TLS providers/setup, preferred/canonical host, cross-entry redirects and duplicate-content/SEO policy remain deferred before dependent implementation. No forced custom-domain redirect or resolved canonical policy is claimed.

## Runtime observation

Actual task: **multi-tenant-architecture**, risk **tenant-isolation**. Matrix GCMS-EFFORT-001 v1 requires **xhigh**. Requested: inherited desktop-selected gpt-6.1-sol with per-process xhigh; no fallback or setting/script change.

Before substantive edits:

```sh
python3 -B scripts/runtime_task_effort.py --task-type multi-tenant-architecture --risk tenant-isolation --current-session
```

**PASS, exit 0:** observed model **gpt-6.1-sol**, effort **xhigh**, required **xhigh**; runtime-written turn `01a13f47-269f-7870-8b4e-aadf44031c97`, timestamp `2026-10-15T11:16:32.770Z`, thread `01a13e94-1f95-7410-90b0-3249ab30c1c7`, source kind exec, CLI `0.162.0-alpha.17.2`; policy SHA-256 `a75d33f9599567cd7385b9b35fba9ef4b9c92ff453899b82311261744b6ee6e9`. This proves recorded configuration, not hidden reasoning, quality or permission enforcement. Desktop reports its own High mismatch; only this checked execution writer performs substantive architecture/routing edits. No child ran.

## Acceptance and verification

| ID | Documentation outcome | Result |
| --- | --- | --- |
| ROUTE-01 | Both entry forms map to one tenant/site/publication and lead list; no content duplication | PASS — one tenant/site/publication/theme/content/media/lead list across both entries |
| ROUTE-02 | Resolver discriminates shared-host path prefixes from custom-host bindings, reserves platform namespaces and preserves tenant authorization | PASS — canonical resolver distinguishes path versus custom-host binding, reserved namespaces and current authorization |
| ROUTE-03 | Entry-base URLs, SEO deferral, cache/mapping freshness and durable-job identity are explicit, with future negatives/positives | PASS — validated entry-base consumers, mapping-safe cache/jobs and explicit SEO/locale/lifecycle deferrals |
| ROUTE-04 | Simple D1–D4 and deferred D5 retained; historical tasks/ADRs/evidence/reference and protected code untouched | PASS — unchanged simple model/D4/D5; protected baseline hashes retained |
| ROUTE-05 | Existing ordinary checker/recipe, known-text whitespace, maintained provenance and baseline path/hash checks pass | PASS — 95 Markdown/421 links, original recipe, 112 text files, 81 hashes/nine adaptations and scoped provenance |
| ROUTE-06 | Current task/context/plan/state/results align; desktop inspection recorded separately and application/DNS tests NOT_RUN | PASS — current closing records reconciled; desktop static/source inspection PASS; live/app/DNS checks NOT_RUN |

Use existing `python3 -B scripts/verify_agent_setup.py`, the original fenced Python recipe extracted in memory from verification-guide, focused source/Markdown/known-text whitespace and all-file hash preservation against the supplied baseline. Refresh only intentionally changed maintained entrypoint hashes with previous digest/task/reason; preserve origins/template digests, 81-file inventory and nine adaptation paths. No new harness/tests or unchanged routing unit suite.

## Results and handoff

**STATIC_DOCS_VERIFIED**, with desktop main's separate final static/source integration inspection PASS (see below). Human policy approval is recorded above; human delivery acceptance is unrecorded. No application or DNS action follows automatically.

| Actual check | Result and evidence boundary |
| --- | --- |
| Runtime effort | PASS/exit 0 before edits, required/requested/observed xhigh, gpt-6.1-sol; exact metadata above; no setting/policy change or fallback |
| Ordinary package checker | PASS/exit 0: `python3 -B scripts/verify_agent_setup.py`; 81 maintained hashes, nine adaptations, 28 mirror pairs, 17 skills per root, three native definitions per client, 20 original/six adapted canonical files; 95 Markdown files and 421 local links/anchors |
| Existing original recipe | PASS/exit 0: existing fenced Python in docs/verification-guide.md extracted and executed unchanged in memory with `python3 -B -`; inventory/mirrors/upstream counts valid; no new saved harness or tests |
| Source consistency/whitespace | PASS: sequential resolver/acceptance/current-pointer review and focused known-text scan; 112 text files including untracked sources have no trailing whitespace/missing final newline. Synthetic route examples are documentation only. |
| Supplied baseline/preservation | PASS: compared all files against /tmp/gcms-domains-before.json (111 entries), 14 existing allowlisted files changed, two allowed new files, 97 baseline files byte-identical, no deletion/out-of-scope change; final total 113 files |
| Protected binary/history | .DS_Store unchanged: SHA-256 99b60e8a0494b15778f22e441a06e440e3062306dc73362216b7bfe142e68343. All old task/evidence, ADR-001/002, reference analysis, access-control, generic Kit/config/skills/scripts/matrix/helper sources retain baseline hashes. |
| Maintained provenance | PASS: exactly three GCMS-DOCS-002 entrypoint updates, previous digests match supplied baseline, each task/reason recorded, one appended project_changes record. Origins/template digests and 81-file/nine-adaptation inventory preserved. |
| Read-only Git/artifact inspection | PASS: existing untracked main, no commits/remotes/staging; git diff --check exit 0 covers tracked files only, text/hash checks cover untracked files. No app/package/lockfile/Docker/service/database/migration artifact added. |
| Review/NOT_RUN | Sequential source review only, no independent reviewer/new agent. Unchanged helper unit suite, application/runtime/browser/security/build/fixtures, live routing/domain registration/DNS/TLS/storage/provider/deployment checks NOT_RUN; outside authority. |

Changed existing paths: AGENTS.md, README.md, CONTRIBUTING.md, product-scope, architecture, acceptance-criteria, workflows, project-context, project-plan, project-state, tasks/README, verification-results, agent-kit/adoption and skills-manifest (all docs paths per allowlist). New paths: this task and ADR-003. Access-control and both prior ADRs did not need edits; no supersession annotation was added to historical files.

Closing source review confirms both route forms are approved now, while canonical/preferred-host/redirect/duplicate-SEO, exact locale syntax, reserved names/slug lifecycle and DNS/TLS setup/providers are not selected. Unknown/inactive/unverified mappings and cross-tenant hints fail safely; equal-path caches/jobs and cross-entry idempotency have future negative/positive proof requirements. Shared platform/admin/API/static assets use an explicit namespace rather than accidental loss of tenant identity. Simple D1–D4, including corrected inactivity retention and current media revocation, and deferred D5 remain unchanged.

Preparation/authority/ownership, bounded edits, actual checks, preserved history and closing task/context/plan/state/results are reconciled. Receiver: desktop main for final integration inspection; Khiêm for delivery review. Static PASS is not live routing, security, DNS/TLS or application proof. The user controls TechNote levels; silence grants no approval.

## Desktop final integration inspection

**PASS — static/source integration complete.** The desktop coordinator inspected the completed xhigh writer handoff (native exit 0), current ADR/resolver/acceptance references and closing records. It reran the ordinary package verifier and unchanged original recipe: PASS, 81 maintained hashes, nine adaptations, 95 Markdown files and 421 local links/anchors. Known-text whitespace/final newline checks passed for 112 files. Baseline comparison independently confirms 14 existing changes, two additions, 97 unchanged files, no deletion and no unexpected path. All historical task/evidence/ADR sources and helpers retain their original hashes.

Desktop closing-record bookkeeping uses its observed high effort and does not redesign the xhigh routing contract. The execution writer's gpt-6.1-sol/xhigh metadata remains the architecture-work evidence. This is sequential coordination, not independent architecture/security or live application review. Task/context/plan/state/results now record this delivery's own inspection, separate from earlier tasks and human acceptance. Human delivery acceptance is unrecorded; receiver is Khiêm. Application, live routing, DNS/TLS and deployment checks remain NOT_RUN; no implementation, configuration or Git delivery follows.
