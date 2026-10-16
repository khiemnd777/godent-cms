# GCMS-DOCS-004 — Local MVP and accepted product decisions

## Assignment and direct authority

| Field | Value |
| --- | --- |
| Revision / date | GCMS-DOCS-004 v1 / 2026-10-15, Asia/Ho_Chi_Minh |
| Human Project Lead / approver | Khiêm |
| Accountable task/shared-document owner | Desktop main / Project Coordinator; retains final integration and closing bookkeeping |
| Sole execution writer | Existing bounded xhigh CLI documentation session on desktop's behalf; no independent decisions, new delegation or parallel writer |
| Goal | Synchronize approved local ports, fallback, builder/media/leads/quotas/domain/lifecycle directions and local-versus-production acceptance; expose remaining product choices |
| State | STATIC_DOCS_VERIFIED; desktop static/source integration PASS; human delivery acceptance unrecorded |
| Workspace | Preserve all prior/untracked work; no Git inspection or Git writes in this task |

Fresh direct human approval was **“Approve”**, in response to this desktop proposal:

> Next: synchronize the project documents with your latest decisions. That documentation pass should record: approved local Docker ports, including Redis and S3; Vietnamese fallback when translation missing; section builder for MVP/full Web Builder later; production hosting and AC-09 deferred beyond local MVP work; accepted media, lead, quota, domain and tenant-lifecycle proposals. Then resolve remaining product choices tenant account creation/recovery and initial theme/section catalog. Next approval should cover documentation synchronization only. Application implementation remains unapproved.

This is documentation/static-check authority for this task only. Earlier tasks and the read-only review are complete and grant no inherited execution approval. No application, Docker/compose/config artifact, package/lockfile, dependency, service, fixture, test data, database/migration, DNS/TLS, Git/global/external/paid write or resource is authorized. No new agents, tools/harness, background writer or independent reviewer. Native permissions/model are unchanged. Silence grants no approval.

## Human feedback and bounded interpretation

| Human feedback | Current interpretation / limit |
| --- | --- |
| “1. Tại sao gọi là admin đầu tiên? Admin cho cái gì?” | Platform admin manages Godent; tenant admin manages its organization website/leads. Initial assigned tenant admin means the first person with the same existing tenant-admin role, not a hierarchy. Account creation/provisioning, invitation-only policy, MFA, last-admin and recovery proposals remain unapproved. Existing minimal roles/safe grants remain. |
| “2. cái này chỉ áp dụng production, dưới docker localhost: sẽ có site admin (:5891) và site website (:5892).”; “API :5890, redis :5889, postgres, s3 (tự đề xuất quanh 58xx)”; then “2. OK” | Approves local host-port table: admin 5891, website 5892, API 5890, Redis 5889, PostgreSQL 5888, S3 API 5887, optional service console 5886; host bindings 127.0.0.1. Not created or availability-tested. Container service names/internal ports differ from host mappings. Production admin-origin proposal does not mandate local proxy/BFF or cookie port isolation. |
| “3. OK” | Pin versions after actual Bun compatibility proof, no silent Node fallback; proof NOT_RUN. |
| “4. Nếu thiếu bản dịch thì fallback, không hiển thị 404.” | Published eligible Vietnamese/default fallback, not 404 solely for missing translation. Exact locale syntax, page/field mechanism and requested-URL/redirect/canonical/hreflang behavior remain bounded technical contracts; no draft/revoked media or false EN alternate. |
| “5. MVP tạm chấp nhận. Nhưng the best là phải làm Web Builder - tính sau.” | MVP two original themes/shared-schema sections, limited color/font/layout, no arbitrary HTML/scripts; brand/menu/theme Draft then explicit Publish. Exact initial theme/section catalog still needs review. Full Web Builder is future direction only. |
| “6. OK” | JPEG/PNG/WebP, at most 5 MiB/image, no SVG/remote URL imports; safe pixel/decompression/transform implementation unselected. D4 remains. |
| “7. OK” | Tenant/IP rate limits, CAPTCHA on abnormal traffic, transactional email to tenant-selected active admins, default initial assigned tenant admin. Provider/thresholds/CAPTCHA integration/retry limits unselected. Existing durability/redaction/idempotency retained. |
| “8. MVP tạm chấp nhận.” | Manual entitlements/quotas, no auto billing; excess blocks corresponding resource growth only, never deletes published content/leads; no branch limits. Numeric limits unselected. |
| “9. OK” | Controlled manual domain migration/reverification/equivalent-page mapping, no automatic primary reversal, no reuse of old binding. Detailed removal/replacement/reactivation/renewal/failure contracts still to engineer. ADR-004 initial activation/301 retained. |
| “10. OK” | Suspension stops public/intake/publish, retains authorized tenant-admin read/export; deletion only on confirmed request. Export/recovery/reactivation/grace/backup-retention details unselected; no new retention periods. |
| “11. Để sau, không ảnh hưởng đến local và MVP” | Production hosting/DB placement/provider/budget/HA/RPO/RTO/backups/ops deferred beyond local MVP. The preceding recommendation of PostgreSQL on the VPS, lack of HA and offsite backup was not approved. Existing moderate VPS Docker + S3 Vietnam direction only. |
| “12. AC-01–12 là gì?”; after explanation, “12) OK” | Accepts AC traceability, not implementation/PASS. AC-09 production readiness deferred; other applicable local functional/security/D4 criteria remain. AC-07 local routing proof separate from later authorized live DNS/TLS proof. |

## Exact file scope and sources

```text
AGENTS.md
README.md
CONTRIBUTING.md
docs/product-scope.md
docs/architecture.md
docs/access-control.md
docs/workflows.md
docs/acceptance-criteria.md
docs/project-context.md
docs/project-plan.md
docs/project-state.md
docs/tasks/README.md
docs/tasks/GCMS-DOCS-004.md
docs/decisions/005-local-mvp-and-content-fallback.md
docs/verification-results.md
docs/agent-kit/adoption.md
docs/skills-manifest.json
```

Read applicable AGENTS/team-policy/coordinator, documentation-and-adrs, affected current product/project documents and ADR-004. Reuse same-day skill/verifier/recipe knowledge; no broad history/research refresh. Architecture owns local ports/technical contracts; workflows owns fallback/media/leads/quotas/lifecycle. ADR-005 records only latest changes and references prior ADRs unchanged. Old task/evidence/ADR/reference, generic Kit/skills/config, upstream snapshots, matrix/helpers/scripts/verification-guide and Git metadata are outside scope.

Entry comparison against `/tmp/gcms-docs004-before.json`: **PASS, all 115 non-Git files matched, no extras/missing files**. Preserve binary .DS_Store by hash. Maintain 81 Kit files/nine adaptations; new project docs stay outside inventory. Append previous digest/task/reason only for intentionally changed maintained entrypoints and one project_changes record; preserve upstream/source/template/mirror and earlier provenance.

## Runtime effort

Required/requested **xhigh**, inherited selected **gpt-6.1-sol**; architecture-review plus tenant-isolation, authorization and publication-integrity, policy GCMS-EFFORT-001 v1. No fallback or settings/policy/script change.

```sh
python3 -B scripts/runtime_task_effort.py --task-type architecture-review --risk tenant-isolation --risk authorization --risk publication-integrity --current-session
```

**PASS, exit 0 before substantive work:** observed gpt-6.1-sol/xhigh; turn `01a13f97-25b7-7e80-a136-46ea236e3447`, timestamp `2026-10-15T12:43:58.443Z`, thread `01a13e94-1f95-7410-90b0-3249ab30c1c7`, CLI `0.162.0-alpha.17.2`, source kind exec, role/parent null, evidence runtime_written_turn_context; policy SHA-256 `a75d33f9599567cd7385b9b35fba9ef4b9c92ff453899b82311261744b6ee6e9`. Recorded configuration is not hidden reasoning, quality or permission enforcement. Desktop reports high mismatch; this checked writer performs substantive documentation work only.

## Documentation acceptance and results

| ID | Outcome | Result |
| --- | --- | --- |
| DOC-01 | Approved local table/Redis/S3, loopback host bindings and port-versus-cookie/internal-network boundaries | PASS — canonical local endpoints, Redis/S3 selection, loopback/internal-network and non-port-isolated cookie contract agree |
| DOC-02 | Eligible Published VI fallback and truthful SEO-language contract; no translation-only 404 requirement | PASS — eligible Published VI fallback, no translation-only 404 or false EN alternate; exact mechanics explicitly bounded |
| DOC-03 | Accepted section/media/lead/quota/domain/tenant policies recorded; account/recovery and initial catalog still open | PASS — accepted builder/media/lead/quota/domain/tenant policies aligned; account/recovery/MFA and exact initial catalog remain open |
| DOC-04 | AC-09/production deferral separated from full local MVP and applicable functional/security/D4 proof | PASS — production AC-09 deferred beyond local MVP; applicable local functional/security/isolation/D4 and full capability breadth retained |
| DOC-05 | Existing ordinary verifier/unchanged recipe, focused source/whitespace, 115-file preservation and maintained provenance pass | PASS — ordinary verifier/original recipe; 99 Markdown/494 links, 116 text files, 15 modified/two new/100 preserved and maintained provenance |
| DOC-06 | Current closing records align; desktop integration recorded separately, human delivery acceptance unrecorded and product checks NOT_RUN | PASS — current closing records reconciled; desktop static/source integration PASS, human delivery acceptance unrecorded, all product checks NOT_RUN |

**STATIC_DOCS_VERIFIED; desktop static/source integration PASS (see below).** Fresh policy/documentation approval is recorded above; human delivery acceptance is unrecorded.

| Actual check | Result / proof boundary |
| --- | --- |
| Ordinary package verifier | PASS, exit 0: python3 -B scripts/verify_agent_setup.py; 81 maintained hashes, nine adaptations, 28 mirror pairs, 17 skills/root, three native definitions/client, 20 original/six adapted upstream canonical files; 99 Markdown files/494 local links and anchors; plain frontmatter/TOML and setup/Bun provenance valid |
| Existing original recipe | PASS, exit 0: original Python heredoc extracted from docs/verification-guide.md and executed unchanged in memory with python3 -B -; inventory/mirrors/17 skills/20 original/six adapted upstream valid; no saved/new harness |
| Sequential source consistency | PASS, source only: approved ports/loopback/internal service separation, no cookie port isolation/local BFF mandate, chosen local Redis/S3 contract, Published VI fallback/truthful language, accepted 5 MiB/media/leads/quotas/lifecycle, remaining account/catalog decisions and production-only AC-09 agree across current docs |
| Known-text whitespace/newlines | PASS: 116 known text files including untracked files; no trailing whitespace/missing final newline. Binary .DS_Store excluded from text scan |
| Supplied baseline/path preservation | PASS: 115 baseline files → 15 existing allowlisted modifications, two new project docs, 100 byte-identical files, 117 total; no deletion/unexpected path. All old task/evidence/ADR/reference and generic Kit/config/skills/scripts/helpers/matrix/verification-guide preserved |
| Maintained provenance | PASS: exactly three entrypoint updates with baseline previous digest/task/reason and one appended project_changes; inventory 81/nine adaptations and all source/template/origin/mirror/prior provenance preserved |
| Binary preservation | .DS_Store unchanged, SHA-256 99b60e8a0494b15778f22e441a06e440e3062306dc73362216b7bfe142e68343 |
| Omitted work | No application/Docker/service/port/compatibility/routing/security/build/browser/fixture/DNS/TLS tests, unchanged routing unit suite, Git inspection, external research/writes, new agent/reviewer or background writer |

Changed existing paths: all 15 existing allowlisted paths above. New paths: this task and ADR-005. Closing edits update result prose only, preserving the checked Markdown link graph and maintained entrypoint bytes; final focused text/path/provenance checks reconcile closure. Sequential xhigh source review only; no independent reviewer. All application/Docker/port availability/runtime compatibility/routing/browser/security/build/fixtures/DNS/TLS checks NOT_RUN. Policy approval is distinct from documentation delivery acceptance, application permission and production launch. After desktop integration, next product decisions are account creation/recovery/MFA policy and initial theme/section catalog; only then propose the first bounded implementation task for separate approval.

## Desktop final integration inspection

**PASS — static/source integration complete.** Desktop inspected the completed xhigh handoff (native exit 0), ADR-005, current local endpoint/fallback/acceptance references and closing records. It independently reran the ordinary package verifier and unchanged original recipe: PASS, 81 maintained hashes, nine adaptations, 99 Markdown files and 494 local links/anchors. Whitespace/newline checks passed for 116 text files. All-file baseline inspection confirms 15 allowlisted existing changes, two additions, 100 preserved files, no deletion or unexpected path; exactly three maintained entrypoint updates retain previous-digest/task/reason provenance. Historical tasks/ADRs/evidence/reference and protected tooling are unchanged.

Desktop closing-record bookkeeping uses its observed high effort; substantive architecture/workflow synchronization used the recorded gpt-6.1-sol/xhigh turn above. This is sequential documentation integration, not an independent security review or runtime proof. Current task/context/plan/state/results now record integration PASS. Human delivery acceptance is unrecorded; receiver is Khiêm. Account creation/recovery/MFA and the exact initial theme/section catalog remain product choices. All application/Docker/service/port/compatibility/routing/security/DNS/TLS checks remain NOT_RUN. No implementation, Docker configuration, external write or Git delivery follows.
