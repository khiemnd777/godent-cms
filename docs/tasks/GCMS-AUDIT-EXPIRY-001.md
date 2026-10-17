# GCMS-AUDIT-EXPIRY-001 — Approved v0.1 local repair

**Current Git delivery authority — 2026-10-17.** Khiêm separately authorized normal commit/push of this accepted package to current `main`; [direct instruction and bounded scope](#git-delivery-authority--2026-10-17) supersede earlier no-Git statements only for this package. Local acceptance and all existing data/evidence/FAIL/NOT_RUN limits remain unchanged. No deployment authority.

**Current result — ACCEPTED_UNDER_DELEGATED_AUTHORITY — 2026-10-17.** Khiêm directly delegated local review/acceptance; the [delegation, coordinator decision and fresh proof](#delegated-local-acceptance--2026-10-17) are separate from a direct HUMAN_ACCEPTED statement. Technical CODE_INTEGRATED + VERIFIED_LOCAL remains within the original scope. Earlier pending checkpoints below and original final-checks.json are historical and preserved. No commit/push/deploy; original data and all approved limits remain protected.

## Authority, ownership and initial state

**APPROVED_LOCAL_EXECUTION / PLAN_SAVED. Implementation and verification initially NOT_RUN.** Khiêm directly instructed on 2026-10-17, Asia/Saigon, desktop thread `01a146ff-66a1-7c73-a60d-1ac38e25e73d`, turn `01a14708-8541-7363-b308-fb4013a3f581`:

> Duyệt GCMS-AUDIT-EXPIRY-001 v0.1. Lưu kế hoạch rồi triển khai local, gồm migration và regression test có xóa fixture mới. Bảo toàn dữ liệu cũ, giữ các giới hạn đã duyệt; chưa commit/push/deploy.

This is direct human approval of the preceding v0.1 plan, including its local migration and new-fixture deletion regression. The complete plan is recorded below before dependent application writes. Desktop `/root` in this thread owns this bounded repair, its record, contracts, local execution and final integration. Prior milestone acceptance, ownership, historical evidence and limits remain within their original scopes. No latest stop other than no commit/push/deploy was supplied.

Approved scope: additive forward migration; independent audit-retention authorization; audit-only worker invocation; scoped unit/PostgreSQL/CLI/concurrency tests; new owned synthetic fixtures; preservation and documentation. No old tenant deletion/reset/re-enrollment, old worker/backlog dispatch, credential replacement, dependency upgrade, external provider, global configuration, paid service, DNS/TLS or Production action. No Git writes, commit/push/deploy.

Source baseline: main `340ec16fdbb70b4945bb64e824d13b7adc37d75b`; clean worktree/index at intake. Runtime effort: implementation with tenant-isolation/sensitive-data/transaction-concurrency/irreversible-data-change floors; required/requested/observed xhigh, inherited gpt-6.1-sol, exact thread/cwd/turn PASS. Initial helper rejected the misspelled risk `concurrency` before substantive execution; corrected matrix key `transaction-concurrency` passes. This observes configuration, not hidden reasoning or product quality.

## Complete approved plan v0.1

**Goal:** After confirmed tenant deletion, the explicitly authorized audit worker can still expire redacted audit at its unchanged 365-day deadline. Business access, lead jobs, notifications and exports stay denied.

**Verified cause:** `0051_m5_platform.sql:373` removes S06 worker enrollment and tenant-less audit mapping while retaining audit rows. `worker_expire_audit` requires that enrollment. `RetentionWorker.runOnce` claims lead work before audit expiry, so fixing SQL authorization alone does not restore a runnable post-deletion path. Runtime reproduction is initially NOT_RUN.

| Step | Work | Acceptance |
| --- | --- | --- |
| AE-T01 preflight | Check HEAD/checksums/files/data/scopes and save an exact new-fixture manifest | Protected baseline and positive new-resource ownership established before mutations |
| AE-T02 migration | Add independent audit scope, preserve exact global audit mapping through deletion | No audit deletion, timestamp change, deadline extension or worker dispatch in migration |
| AE-T03 worker | Add a bounded audit-only entry point with selected tenant/manifest and restricted credentials | No lead claim, capture, notification or backlog drain |
| AE-T04 regression | Record RED on old code, then GREEN on fresh fixtures using actual PostgreSQL and restricted roles | Due audit removed; young/control/unselected-global audit preserved; business boundaries unchanged |
| AE-T05 review/handoff | Review authorization, races, preservation and document actual evidence | Source integrated, relevant checks reported accurately; human acceptance and Production remain separate |

### Migration contract

Use a new forward migration, provisionally `0059_s06_audit_retention_scope.sql`, rechecking the sequence before creation. Never edit applied migration bytes/checksums.

- Create `gcms_s06.audit_retention_scope` independently of business `worker_scope`.
- Copy only existing enrollment states, preserving enabled/disabled values; do not implicitly enroll missing tenants.
- Reparent the existing `audit_scope` foreign key to independent audit scope, preserving its exact selected IDs for tenant-less S02 audit.
- Update `worker_expire_audit` to use audit-specific authorization and the existing tenant lock. Keep the 365-day predicate, batch bounds and result shape.
- Update tenant cleanup to retain audit scope/mapping while removing business worker and lead scopes.
- Retain owner-only RLS and execute-only restricted worker permissions; no direct private-table grants or new general-purpose role.
- Compile inside an intentional rollback before applying a bounded migration transaction. Use bounded lock waits. Migration does not dispatch/expire work.

Enrollment helpers for newly created S06 fixtures must explicitly establish both independent capabilities. Existing enrolled rows are copied by migration without invoking old fixture bootstrap scripts.

### Worker and regression contract

Add a dedicated audit-only entry point using existing S06 credential isolation. Require an exact selected tenant and a private owned manifest; verify the restricted worker role before expiry. Never invoke the lead-claim path from this command. No global scheduler/sweep or provider.

Required checks:

1. Actual request/confirm/execute/cleanup of a new owned tenant followed by restricted audit expiry.
2. Authenticated, anonymous, system and explicitly selected tenant-less audit beyond 365 days is removed; younger audit, unrelated tenant audit and unselected global audit remain.
3. Business reads/exports/lead claims/notifications remain denied after deletion.
4. Concurrent/repeated audit expiry and expiry versus cleanup serialize safely, with correct bounded counts and no duplicate effects.
5. Missing/disabled scope and wrong roles are denied. Existing active/suspended audit behavior remains supported.
6. Actual audit-only CLI succeeds without lead claiming or capture, with exact env/manifest guards.

Use a fresh target for each irreversible RED/GREEN execution and a control tenant. Runtime budget: at most three new synthetic tenants and three new synthetic identities; manifest fixes exact IDs before creation. No real data, no reset of completed fixtures, no new media/storage objects required for this retention seam. Server/system clocks stay unchanged; controlled timestamps apply only to new synthetic audit rows.

### Preservation, recovery and proof limits

- Capture protected data/file/checksum baselines before new fixtures or migration; compare after execution. Admission requires the correct local database/project/roles.
- Migration never deletes old audit, changes created_at, renews deadlines, replaces credentials or dispatches retained jobs.
- Already-deleted tenants may recover audit authorization/mapping only from explicit prior enrollment evidence. Missing proof stays Unknown/unresolved; no inference from a tombstone, actor membership or global audit scan. Never re-enroll the old completed M5 fixture.
- Runtime deletion is limited to positively owned new fixtures. Protected rows/files and original snapshots/backlog remain unchanged; named auth/runtime transients must be recorded separately if needed.
- Roll-forward is the recovery approach after a committed migration. No claim that expired audit or physically deleted fixture business rows can be restored by a down migration.
- Existing `braces` audit remains FAIL/open/high, reassess 2026-10-22 or earlier patch/dependency/exposure triggers and before Production; no Production waiver or dependency upgrade.
- Backup/restore, natural 365-day waiting, full browser matrix, live DNS/TLS, external providers and Production/AC-09 remain outside this repair's proof. Controlled timestamps are not natural waiting.

Relevant checks after implementation: focused PostgreSQL/CLI regressions, affected S06 pure/enrollment tests, typecheck, lint, API build, independent authorization/retention review and before/after preservation. Do not rerun accepted mutating milestone suites/one-shot deletion merely to refresh old evidence.

### Files and handoff

Expected ownership: new migration; audit-only worker/main and launcher/fixture/migration/preservation/test helpers; affected S06 fixture enrollment callers and tests; package aliases if needed; this task and relevant current documentation. No UI change is planned. Root owns shared contracts/integration; any native reviewer is read-only and xhigh, with metadata verified before substantive work. Children do not delegate.

Detailed evidence is saved under `docs/evidence/audit-expiry/`; private credentials, manifests, raw logs and protected row/file digest inputs stay under `.local` with restrictive modes. Prior evidence remains immutable. Reports distinguish CODE_INTEGRATED, VERIFIED_LOCAL and acceptance.

## Execution ledger

2026-10-17: approved complete plan saved before application/test/fixture/migration writes. No implementation, DB or runtime result is claimed at this checkpoint. Next: preservation preflight and RED regression.


## Final local handoff — 2026-10-17

**CODE_INTEGRATED + VERIFIED_LOCAL / READY_FOR_USER_REVIEW. Human acceptance remains unrecorded for this repair.** Forward0059 and the audit-only command close the source defect. The prior milestone acceptance records and their original evidence are unchanged. No Git writes, commit/push or deploy.

### Execution, failures and actual results

- Initial default-sandbox socket/Docker access failed with no DB mutation. Escalated read-only diagnostics showed the exact project PostgreSQL container stopped. Root verified compose project/working-dir, original named volume and127.0.0.1:5888 binding, then started only that existing container. No container recreation, volume/configuration/credential change or unrelated service action.
- Protected preflight:86tables/236619rows/1599files;57applied migration checksums matched. A new exclusive0600manifest fixed3newtenants (Red/Green/Control) and3newidentities before creation. No media objects or real data were created. Prior fixtures and worker backlog were not enrolled/drained.
- First RED helper failed22P02 in a read-only query because Bun.SQL array binding was incompatible. It failed before deletion. Helper changed to separate bound IDs/explicit JSON selection; no assertion was reduced. Original red.xml and initial receipt remain.
- Actual RED: new Red tenant underwent normal HTTPrequest/confirmation/platform execution, actual restricted M5cleanup completed with0media objects, audits remained, and S06expiry failed42501/Retention scope denied. Original red-postgresql.xml is expectedFAIL and remains immutable. Red is not recreated or re-enrolled.
- 0059 compiled in intentional rollback, then applied once in a bounded transaction.57prior disk/DB checksums preserved; no audit DML or dispatch in migration. Final check-only sees58matching applied checksums including0059. `audit_scope` mappings are retained through future cleanup via the independent FK. Existing tombstones lacking prior scope are not inferred/recovered.
- Actual GREEN prefix: new Green tenant's normal HTTPrequest→confirmation→execution→restricted cleanup completed; audit expiry returned authenticated2/anonymous1/system1. Young audit, unselected global audit and Control audit were preserved. Business read/export/lead-claim/mixed-worker denial also passed.
- Initial broader GREEN later timed out in the rights helper because a lazy Bun.SQL query was handed directly to a rejection matcher. Read-only DB diagnostics showed no waiting/inflight SQL. Root stopped only its own exec test session with nativeCtrl-C(exit130). `green-initial-partial.json` retains2PASS/rights-timeout/remainingNOT_RUN; it is not an all-pass suite. Promise.resolve drives the query; assertions are unchanged. No deletion prefix was repeated.
- Final selected PostgreSQL follow-up:5PASS/37assertions in green-final-focused.xml (rights, limits/concurrent expiry/replay, active/suspended rollback, lock/stale cleanup, real built CLI), plus1PASS/5assertions in green-final-business-denial.xml. Combined coverage:7unique successful cases,1valid earlier deletion-prefixPASS reused +6freshPASS. Earlier focused3/26 and supplemental2/11 overlap; do not add them again.
- Active/suspended predicate checks ran as fixture-owner inside intentional rollback and left Control unchanged. Restricted-role permission and actual CLI checks are separate. Fresh valid cleanup overlapping expiry is NOT_RUN; source lock ordering plus actual stale-cleanup/expiry wait and real sequential deletion proof support serialization without claiming direct overlap.
- API build PASS, then full root typecheck PASS (admin/website/API source+test/root scripts), full lint PASS. Initial CommonJS import.meta build error was repaired with __dirname; no tsconfig change. Initial test-only implicit-any errors were fixed with explicit types. Historical failures remain; business assertions were not weakened.
- Pure affected suites:21tests/108assertions PASS across audit worker, M2 worker environment, S06 input/capture/service and M5 worker/platform-unit suites. No old mutating milestone suites/one-shot deletion were rerun.

### Ownership, source and preservation

Native SQL implementer kit-implementer thread01a14709-aef3-7623-80e4-59c01f26cf16 owned only0059 and two enrollment callers, with independently observed model/xhigh/parent/role PASS. Root owned fixtures/runners/tests/CLI/runtime/shared integration. Independent kit-reviewer source findings are closed in [review](../evidence/audit-expiry/review.md); reviewer ran no DB/browser/worker/tests and made no application changes. User controls TechNote progression; silence grants no authority.

Final original-column/hash comparison PASS: all86baseline tables, all236619rows unchanged,0volatile removals, all1599protected files byte/mode-unchanged. Existing credentials/global users/audit/fixtures/backlog/evidence and all57old migration bytes remain unchanged. New Red/Green minimal tombstones and new identities remain; Control remains active with unchanged audit rows. This is not backup/restore proof.

Fresh exact-known-value scan:26selected local/new-fixture values,34representations,0hits in1160public text files at that checkpoint; no comprehensive discovery/OCR/runtime-memory claim. Static integrity PASS81maintained hashes/28mirror pairs/17skills/3native roles,144Markdown/1800links at that checkpoint; changed-text whitespace and git diff check PASS. Final receipts/source/evidence pins follow this text freeze.

### Limits and next action

- Audit braces remains FAIL/open/high. Dependency versions/lock unchanged. Current84APIcompiledJS have0advisory-chain literal matches; static method is not universal dynamic absence. Existing local restrictions persist; reassess2026-10-22 or earlier patch/dependency/exposure/before Production, no Production waiver.
- Old completed tenants with lost authorization/mapping proof remain unresolved and were not re-enrolled. No automatic scope inference, old audit sweep, tombstone TTL or new retention period was introduced.
- Natural365-day waiting, backup/restore, browser/UI/full-MVP rerun, external providers, live DNS/TLS, Production/AC-09 and direct fresh-valid-cleanup overlap remain NOT_RUN/outside this evidence. No UI source changed or need for a broad frontend build/rerun is claimed.
- Final root review covers requirement→independent scope/FK→audit-only caller→actual PostgreSQL/CLI tests→preservation. Build/source/runtime verification is separate from Khiêm's acceptance. Root's bounded task ownership does not transfer prior coordinator decisions.

**Next option — recommended:** Khiêm reviews the local repair and evidence for acceptance. Git delivery requires a separate explicit instruction; no deployment authority follows.

## Delegated local acceptance — 2026-10-17

### Direct human delegation

Khiêm directly instructed in desktop thread `01a146ff-66a1-7c73-a60d-1ac38e25e73d`, turn `01a1474e-c1f5-74c3-b7e2-9a4bf33c7f15`, on 2026-10-17 Asia/Ho_Chi_Minh:

> Review và nghiệm thu gói GCMS-AUDIT-EXPIRY-001 trong phạm vi local cho tôi. Bảo toàn dữ liệu cũ, giữ nguyên các giới hạn đã duyệt; chưa commit/push/deploy.

This delegates the local review and acceptance decision to desktop `/root` for this repair only. It does not fabricate a direct human acceptance quote or transfer another milestone's ownership. Root owns the bounded decision, shared record updates and final integration. Git delivery and deployment remain unapproved.

### Coordinator decision and acceptance evidence

**Decision: ACCEPTED_UNDER_DELEGATED_AUTHORITY for GCMS-AUDIT-EXPIRY-001 v0.1, local only.** No blocking finding remains after coordinator reconciliation and independent native source/evidence review. Technical status stays CODE_INTEGRATED + VERIFIED_LOCAL. The repaired deletion→audit-expiry behavior is supported by actual PostgreSQL and built-CLI evidence, while business capabilities remain denied.

- Before acceptance documentation writes, all15source/84compiled/25evidence/8documentation pins from the original final snapshot matched; HEAD remains `340ec16fdbb70b4945bb64e824d13b7adc37d75b`, index empty. [Input integrity](../evidence/audit-expiry-acceptance/input-pins.json) freezes that observation. The original final-checks.json `humanAcceptance=PENDING` checkpoint is unchanged, not rewritten as acceptance. Documentation changed for this decision receives separate final pins.
- Fresh pure checks:21tests/108assertions across7files PASS. Fresh read-only preservation:86baseline tables/all236619old rows unchanged/0volatile removals/0unexpected differences, all1599protected files hash/mode-unchanged. Fresh migration check-only:58applied checksums match; all57old SQL files also remain byte-identical to HEAD. No migration application, fixture reset/deletion or worker invocation occurred during this acceptance.
- The7unique successful PostgreSQL/CLI cases remain valid at unchanged inputs:1earlier successful deletion-prefix reused +6final cases/42assertions. No completed deletion or old mutating milestone suite was repeated. Original RED42501, initial22P02, timeout/exit130 and repaired build/type failures remain historical. Build/typecheck/lint PASS is reused at unchanged relevant source and compiled inputs; those commands were not rerun merely for documentation.
- [Independent review](../evidence/audit-expiry-acceptance/review.md) found no blocker. Native kit-reviewer current thread/role/parent/model/xhigh and coordinator xhigh metadata PASS are saved separately. Reviewer ran no DB/tests/CLI/browser and changed no files; coordinator owns the fresh runtime checks and acceptance decision.

[Fresh commands and results](../evidence/audit-expiry-acceptance/checks.json), [preservation](../evidence/audit-expiry-acceptance/preservation.json), [checksum check-only](../evidence/audit-expiry-acceptance/migration-check-only.json) and [acceptance snapshot](../evidence/audit-expiry-acceptance/acceptance.json) retain the exact evidence and limits.

### Retained limits and coordinator checklist

Fresh valid-cleanup overlapping expiry remains **NOT_RUN**. Shared tenant7202 first-lock source, actual wait/stale42501 and real sequential fresh deletion→expiry support the bounded local safety decision; direct overlap is not relabelled PASS. Old deleted tenants missing prior enrollment/mapping evidence remain unresolved and are not automatically re-enrolled. Natural365-day waiting, backup/restore, browser/full-MVP rerun, external providers, live DNS/TLS, Production/AC-09 remain NOT_RUN/outside this scope.

`braces` remains **FAIL/open/high** under the existing local restrictions. Reassess by2026-10-22 or earlier on patch/dependency/exposure changes and before Production. No dependency/lock upgrade or Production waiver. All prior milestone acceptance and FAIL/Unknown/NOT_RUN records remain unchanged.

Coordinator checklist: direct delegation/latest restrictions/sole decision ownership verified; source, permissions, retention predicates, batch bounds and shared-lock behavior reviewed; independent findings reconciled; protected-data and checksum checks PASS; new evidence separated from immutable history; current status pointers updated; no application repair or wider authority required. No Git writes, commit, push or deploy performed.

**Next option — recommended:** Khiêm may separately authorize normal commit/push of this accepted local repair. That requires a new explicit Git instruction; deployment remains separately scoped.

## Git delivery authority — 2026-10-17

Khiêm directly instructed in desktop thread `01a146ff-66a1-7c73-a60d-1ac38e25e73d`, turn `01a14753-68bc-7381-b3d1-6c943f2b125f`, on 2026-10-17 Asia/Ho_Chi_Minh:

> Commit và push gói GCMS-AUDIT-EXPIRY-001 đã nghiệm thu lên main. Bảo toàn dữ liệu cũ, giữ nguyên các giới hạn đã duyệt; chưa deploy.

This is separate direct Git authority: stage only the accepted repair, its fixtures/tests, immutable review/verification evidence and necessary current-record/provenance updates; create a normal commit on current `main` and push normally to `origin/main` (`https://github.com/khiemnd777/godent-cms.git`). No amend/rebase/reset/force-push, unrelated work, new application change, migration/fixture/worker execution or deployment is included. Desktop `/root` owns this bounded delivery. Earlier no-commit/push statements and final snapshot fields remain historical within their original scopes.

Pre-delivery verification: local HEAD and directly read remote main both `340ec16fdbb70b4945bb64e824d13b7adc37d75b`; index empty; accepted15source/84compiled/25original-evidence/10documentation/9acceptance-evidence pins all match before these Git-authority documentation writes. No unrelated changes were present. Prior57migration bytes/checksums and all original implementation/acceptance evidence remain untouched. Actual data-preservation proof from acceptance remains86tables/236619old rows/1599protected files unchanged; this Git-only pass performs no DB/data/fixture/worker operations and adds no runtime proof.

Effort classification: Git delivery has no named task category; sensitive-data egress review of the scoped evidence applies the matrix xhigh floor. Current coordinator gpt-6.1-sol/xhigh/turn/cwd metadata PASS. An initial unclassified invocation without its risk/reason was rejected before substantive work; the corrected risk-bound check passed. No model/effort/global configuration was changed.

Before commit, root checks scope/pins, maintained provenance/links, staged whitespace and selected known-value exposure. Existing build/type/lint,21pure/108assertions and7unique PostgreSQL/CLI cases are reused at unchanged code inputs. No old one-shot deletion, mutating milestone suite or migration is rerun for Git delivery. [Delivery preflight](../evidence/audit-expiry-git/preflight.json) records the actual checks before committing; final commit, normal push, remote SHA/divergence and worktree status are verified and reported in the closing chat, not preclaimed by this authority record.

Local acceptance remains **ACCEPTED_UNDER_DELEGATED_AUTHORITY**, technical **CODE_INTEGRATED + VERIFIED_LOCAL**. `braces` remains **FAIL/open/high**, reassess2026-10-22 or earlier patch/dependency/exposure changes/before Production; no Production waiver. Fresh-valid-cleanup overlap, natural waiting, backup/restore, browser/full-MVP rerun, live DNS/TLS, external providers and Production/AC-09 remain NOT_RUN/outside scope. Old deleted tenants without prior enrollment/mapping evidence remain unresolved and are not re-enrolled. No dependency/lockfile upgrade or old-data destruction.

**Next option — recommended:** Keep this delivered package undeployed. Any deployment requires a separate approved scope and reassessment of the retained limits.
