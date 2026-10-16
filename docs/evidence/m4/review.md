# M4 independent architecture and security review

## Scope and status

**Current bounded independent review: CLOSED R1–R13 / no remaining actionable source finding in the reviewed snapshots.** The affected source repairs have corresponding scoped coordinator-run native/HTTP evidence, including final SEO continuation, timing and role controls. The final API build serving exposure was refreshed; exact unchanged admin/website trace pins were reused. The dependency audit remains **FAIL/open** under the independently assessed bounded local M4 deferral and stated reassessment triggers. Full M4 integration/human acceptance remain coordinator/Project Lead responsibilities. This review answers whether the new M4 API/SQL preserves tenant, publication, media, lead retention/idempotency and locale fallback boundaries. It is a bounded source review, not M4 completion or human acceptance. The implementation is still in progress. Only relevant repairs and new evidence invalidate the affected conclusions below. The original findings and initial snapshot remain historical evidence.

Authority: approved local M4 v0.1, source thread `01a144ca-5b34-7a52-b1f7-2a36f6c206f1`, approval turn `01a144d4-e576-7152-a79f-3b22f3e04258`. No application/shared coordination edits, DB mutations, fixture writes, credential access, uploads, Git mutation or deployment were performed by this reviewer. Authorized reviewer evidence destinations are this review, review-sourcepins.json and new review evidence JSON; shared coordination records remain coordinator-owned.

Reviewer runtime: native `kit-reviewer`, thread `01a144e9-273c-7cc1-b99e-f5c01f4c33e6`, parent as above, inherited `gpt-6.1-sol`, required/requested/observed `xhigh`. Parent independently verified identity/model/role/parent/exact effort PASS before substantive source inspection. Recorded metadata does not establish hidden reasoning quality or effective permission enforcement. Observed permissions cover the actual filesystem reads, this evidence write and the pure tests below; other effective permissions remain Unknown.

Preparation read: AGENTS.md, team policy, current context/state/plan, full GCMS-M4-001, task effort policy, reviewer role, TechNote and selected code-review-and-quality/security-and-hardening skill entrypoints. Project scope overrides the upstream mutation-testing example: no application source was mutated for testing. TechNote progression remains human-controlled; silence grants no approval.

## Findings

All findings below are **Verified from source** for the hashes in this record. DB/browser reproductions by the reviewer are **NOT_RUN** because this assignment is source review without DB/credential/fixture mutation authority. Repairs are **Proposed**, owned by the API/Data implementer and coordinator unless noted. No blanket team freeze is requested.

### R1 — High / Required: replacement legacy intake rejects every valid legacy command

- Evidence: `apps/api/migrations/0035_m4_intake_sources.sql:70–79`, especially lines 71–72.
- Trigger: any valid legacy accept, challenge or accepted replay after SQL0035 applies.
- Cause: the allowlist permits legacy `serviceSlug` fields but line 72 additionally requires string `sourceSlug`, `sourceType` and `locale`. Those keys are absent from valid legacy commands and forbidden by the allowlist. The function returns `INVALID_INPUT` for every legacy command.
- Impact: breaks retained S04 intake, CAPTCHA and semantic-v1 accepted retries before reaching the receipt branch.
- Proposed repair: remove the accidental M4-only requirements from the legacy validator. Keep legacy shape/copy/fingerprint exact. Use an additive correction if SQL0035 has already applied; preserve applied checksums.
- Relevant verification: one new owned legacy service accepts a normal submission, creates a challenge and replays an accepted semantic-v1 request; changed-payload replay still conflicts. Include a retained-shape SQL probe without touching retained requests.

### R2 — Medium / Required: SQL content validation accepts null or wrong-type fields

- Evidence: `apps/api/migrations/0032_m4_publication.sql:17`, `:19`, `:26`, `:31`.
- Trigger: direct restricted-role SQL commands with a JSON-null section/menu `id`, JSON-null promotion `startAt`/`endAt`, or a numeric route slug.
- Cause: regex/date comparisons over `->>` can evaluate SQL NULL. An `IF` condition that evaluates NULL does not reject. The function later returns true. Slugs also use extracted text without a JSON string type check. The TypeScript parser rejects these inputs, but the SQL boundary does not.
- Impact: malformed immutable drafts/publications can cross the execute-only SQL command boundary, fail public DTO parsing or produce incorrect promotion state. A null end instant does not enforce the approved half-open interval.
- Proposed repair: forward strict JSON type checks and use fail-closed `IS NOT TRUE` conditions for nullable predicates. Preserve unknown-field guards. Do not modify applied SQL0032.
- Relevant verification: read-only `valid_content` probes and owned restricted-role create/save negatives for null IDs, null dates, numeric slug and unknown keys; exact valid controls remain accepted.

### R3 — High / Required: legacy public seams bypass M4 unpublish/withdrawal

- Evidence: `apps/api/migrations/0033_m4_public_reads.sql:113–121` guards writes only; M4 unpublish/withdraw updates M4 heads (`0037_m4_legacy_conflicts.sql:51–65`) without invalidating retained legacy delivery. `apps/api/src/modules/publication.service.ts:191–201` still calls `gcms_s02.read_public_service`; `content.service.ts:84–98` still calls M3 public list/read/reference functions; `media.service.ts:130–148` still calls legacy service/M3 gateways. Legacy public SQL `0017_s08_editorial.sql:166–174`, `0025_m3_content.sql:232–277`, `0030_m3_bounded_admission.sql:60–94` does not consult M4 adoption/revocation.
- Trigger: publish an adopted VI service or M3 resource through M4, then unpublish it or withdraw its M4 patient-text/media permission.
- Impact: old anonymous APIs, references or saved old media URLs can continue to expose the pre-adoption publication under the retained legacy heads. Blocking old write commands does not enforce current public revocation.
- Proposed repair: additive compatibility eligibility checks across legacy public/read/reference/media paths for adopted resources. Preserve old snapshots and pre-adoption behavior. Bind historical pins to current adoption/generation/revocation rules; prevent recursive delegation between adapters.
- Relevant verification: owned adopted service and patient-derived M3 resource, old/new anonymous API URLs and saved media URL before/after M4 unpublish and withdrawal; both locales and parent references. Confirm untouched pre-M4 resources retain their prior behavior.

### R4 — Medium / Required: byte-limited public list silently loses continuation

- Evidence: `apps/api/migrations/0033_m4_public_reads.sql:98–101`; `apps/api/src/modules/builder.service.ts:32`.
- Trigger: eligible content reaches the 900000-byte response budget before `pageSize + 1` rows are collected. For example, three eligible items around 400 KiB each with page size 20.
- Cause: SQL exits on the byte budget, but the API infers more results only from `items.length > pageSize`.
- Impact: the response returns fewer rows and `nextCursor: null`; remaining eligible items are unreachable through pagination.
- Proposed repair: return explicit continuation state/last returned identity from SQL or use a bounded summary list DTO. Keep eligibility filtering before page formation and ensure a single item cannot create a non-advancing cursor.
- Relevant verification: multiple near-limit eligible records, ineligible gaps and continuation to the final row without omission, duplication or cursor loop.

### R5 — High / Required: published builder hero media URLs always fail authorization

- Evidence: `apps/api/migrations/0036_m4_scope_integrity.sql:73` excludes home/page/landing assets from `page.media`; `:84–92` puts hero media in `sections[*].media`. The unchanged `0033_m4_public_reads.sql:103–106` authorizes non-config media only through `page.media`.
- Trigger: publish a builder home/page/landing with an eligible ready hero image and fetch its emitted gateway URL.
- Impact: the gateway returns no target/404 for a valid emitted hero image. The representative no-image journey does not cover this branch.
- Proposed repair: authorize the exact publication/asset/revision against eligible section media as well as root media, keeping current permission and derivative-only access.
- Relevant verification: actual emitted hero URL GET succeeds, then fails after scope/global withdrawal; both locales and themes use the same gateway contract. No public original/upload URL becomes available.

### R6 — Medium / Required: promotion acceptance uses time from before lock acquisition

- Evidence: `apps/api/migrations/0035_m4_intake_sources.sql:22–24`, `:38–43`; `0036_m4_scope_integrity.sql:95` derives `promotionState` from `statement_timestamp()`.
- Trigger: a new intake statement waits on the tenant lock across promotion `endAt` or `startAt`.
- Cause: intake captures `clock_timestamp()` after the lock, but eligibility relies on projection state computed from the original statement start. Intake does not compare its acceptance clock to the promotion instants.
- Impact: a new request can be accepted after endAt, or refused after startAt. Accepted replay must retain its separate no-new-write semantics.
- Proposed repair: enforce `[startAt, endAt)` at new acceptance using a post-lock clock immediately before the durable write. Keep accepted replay before current source/time eligibility.
- Relevant verification: controlled lock crossing the exact end/start boundary; accepted replay remains accepted without lead/activity/retention growth while a distinct new request is rejected after endAt. This is controlled clock/lock proof, not natural waiting.

### R7 — Medium / Required: graph limits apply after potentially large expansion

- Evidence: `apps/api/migrations/0033_m4_public_reads.sql:87`, `:109`; current `0036_m4_scope_integrity.sql:64–71`. Contrast the existing pre-expansion cumulative `walk_budget`/`admit_references` seam in `0030_m3_bounded_admission.sql:4–25`. `BuilderService.publicRead/publicList/seo` execute outside the bounded tenant transaction.
- Trigger: a parent combines many individually valid near-limit child closures.
- Cause: M4 limits top-level pins and depth, then constructs child JSON and concatenates the full parent before checking node count/serialized bytes. There is no cumulative pre-expansion node/byte budget. Public DB execution also lacks the private transaction's 5-second statement timeout.
- Impact: authenticated publication or repeated public reads can allocate a much larger graph than the declared 250-node/1-MiB contract before rejection. This is a missing resource bound; no latency or memory benchmark was run.
- Proposed repair: adapt the existing cumulative graph budget before projection and apply a bounded public query timeout. Retain final exact DTO checks and atomic pointer/intent/receipt rollback.
- Relevant verification: an over-budget graph stops before broad expansion; valid near-limit graph succeeds; no pointer/intent/receipt remains after rejection; public enumeration remains bounded and continuable after eligibility filtering.

### R8 — High / Required: repeated section pins produce an invalid public DTO

**Affected source follow-up:** ready `0038_m4_reference_resolution.sql:14`, SHA-256 `017c9f671bc708015ce8841d1cbaa6c4ebfc3a0f6929b2f2fe81a8ceeea078c8`, deduplicates exact root pins, keeps first occurrence order and merges required with `bool_or`. This closes the duplicate-pin cause for new publication commands after application. **SOURCE_REPAIRED / runtime NOT_RUN**, not a current new-publication defect in the latest ready source. Existing immutable duplicate-pin publications, if any, are not rewritten by this fix; their existence and runtime handling are Unknown. The coordinator reported SQL0038 is ready but not yet applied at this review.

- Evidence: `apps/api/migrations/0032_m4_publication.sql:69–94` emits/appends section references without page-wide deduplication; `0036_m4_scope_integrity.sql:64–71` preserves them in root `page.references`. `apps/website/lib/public-builder-validation.ts:110–112` rejects duplicate resolved kind/id/publication keys; invoked for root refs at line 188.
- Trigger: the approved landing composition includes a promotion block and a consultation form that reference the same promotion. Two reference sections selecting the same FAQ cause the same issue.
- Impact: valid section content publishes but fails the website's public DTO validator and SSR. Per-section uniqueness checks do not prevent legitimate cross-section reuse.
- Proposed repair: deduplicate canonical root pins/projection by kind/id/publication while retaining each section's occurrence. Merge required eligibility so any required occurrence remains required. Align graph accounting with the actual consumer traversal.
- Relevant verification: actual promotion + consultation landing save/publish/read/DTO parsing; two sections reuse a reference; withdrawing the reused required reference blocks the appropriate output and optional references remain optional.

SQL0038's `project_core(..., resolve_actions=false)` target resolution prevents CTA/menu recursion while preserving ordinary content-depth resolution. Its applicability intersection restricts form options to the chosen promotion's eligible reference closure. These are inspected source changes; runtime is NOT_RUN. R5 remains in its replacement media_target at lines 70–74 because it still searches only root `page.media`. R6 remains at its projection line 58. R7 remains in its recursive projection and new target projection because there is still no cumulative budget before expansion.

## Other incomplete integration

The lead-source SQL mapping correctly coalesces the new private source snapshot for list/detail, and `s04.ts` now declares the source union. At this snapshot `apps/admin/components/lead-detail.tsx:34` still reads `lead.source.serviceTitle`, which the landing source does not have. The CMS owner must add type-aware title/source/promotion presentation before S14 completion. This is an in-progress consumer gap, not evidence that the future completed S14 UI was reviewed.

## Verified positive source properties

- M4 tables enable and FORCE RLS. Tenant row selection depends on current tenant context and membership. M4 application mutations use the execute-only command function; owner policies remain distinct.
- Commands call current actor/membership/active-tenant authorization and require recent authentication for publish/unpublish/permission mutations. The existing tenant advisory lock serializes publication, membership and intake actions.
- Save/restore change drafts only. Publication snapshots/revisions/receipts/intents are immutable; publication pointer, intent and receipt are written in one SQL transaction. Per-locale heads and current generations are distinct.
- M4 intake uses a genuine service/landing union and stores attribution on the private lead row. Lead + durable notification intent + accepted receipt are written atomically. Tenant receipt/rate/activity namespaces are shared with legacy intake; changed source/payload conflicts across the namespace.
- New M4 challenge binding includes source type/resource/locale/content/config publication, request key and IP hash. The narrow anonymous HTTP route rejects credentials and foreign origins. IP comes from the socket rather than forwarded headers.
- M4 accepted replay occurs before current source eligibility, checks the retained accepted fingerprint and existing unexpired lead, and does not update activity/expiry. New acceptance stores consent from actual form locale independently from preferred contact language.
- Source/tracking lives in the existing S06 private lead deletion graph. No separate marketing copy was added. Existing S05 local delivery shape contains only delivery/admin-recipient/sign-in information, not lead contact/message/source data.
- New M4 media delivery is derivative-only and rechecks the target after storage fetch. Current S07 global eligibility is consulted. The specific hero lookup gap is R5.
- Public canonical URLs derive from registered site context, not raw Host/query. EN absence uses an explicit fallback result; HTTP/DB exceptions are not caught and converted into missing translation. Website reads omit credentials, use no-store, bound response size and fail on non-404 backend errors. Representative homepage metadata/body share a render-scoped React cache resolution.
- TypeScript content schemas use bounded typed sections/presets and existing safe rich text. No arbitrary HTML/CSS/scripts/font URLs/imports were added. Tracking accepts only three short token fields, with no raw URL/referrer.

These are source properties, not independent runtime/UAT proof of every negative path.

## Verification and limits

Reviewer command:

```sh
./node_modules/.bin/bun --no-env-file test apps/api/test/m4-validation.test.ts apps/api/test/m4-security.test.ts
```

**PASS:** Bun1.4.3; 8 tests, 72 assertions, 0 failures across two files. This proves the tested pure schema/HTTP middleware cases only. Source snapshots were inspected with `rg`, `nl`, `sed`, Git read-only status/diff and SHA-256 hashing. No external browsing/source transfer occurred.

**NOT_RUN by reviewer:** DB commands/migrations, integration test fixtures, browser/UAT, worker execution, upload/storage mutation, full build/type/lint, performance measurement, operational backup/restore, external delivery, DNS/TLS and Production. Parent's earlier 2-test/46-assertion integration and representative browser reports are separate coordinator evidence, not reviewer-run proof. Dependency audit remains **FAIL/open**; no M4 deferral/waiver is established here. Fresh exposure review awaits the final build/traces.

## Reviewed snapshot hashes

```text
afdb288824bd046e4ced3674af653e7b0bebded003798462470eada0c714ca66  apps/api/migrations/0032_m4_publication.sql
73e07da949c97ddcd77e65d3aa929157d5f1b6be52edffcecda117ce73e60256  apps/api/migrations/0033_m4_public_reads.sql
595463df6c58200b2cae916e2e3911637cb30364bbd9ef8d27f335f7443b837b  apps/api/migrations/0034_m4_projection_integrity.sql
27522dc7c81afced64a23fcb10f02385797fc1a1cb56a204bc95fe6f4152c08d  apps/api/migrations/0035_m4_intake_sources.sql
cb7782214a676a7e526db3e6db8397754dff1f3c17f223a1cf45d2563b19f520  apps/api/migrations/0036_m4_scope_integrity.sql
b589dafd38e4b9855afb499e5045b8fdd0a633c927884454ba17299da4bc04e3  apps/api/migrations/0037_m4_legacy_conflicts.sql
017c9f671bc708015ce8841d1cbaa6c4ebfc3a0f6929b2f2fe81a8ceeea078c8  apps/api/migrations/0038_m4_reference_resolution.sql
466668f525e0e44d7898065d03d5acd808cbbe9e894468db98b7fa8296a90564  apps/api/src/contracts/m4-validation.ts
6790e61a37f5af46ca4a68dc97951da7bec6152566e1e77f061d2d89c12bdf4f  apps/api/src/contracts/m4.ts
5bb2b0b8b4fdaa9397a847b22a4f07b80aa832cb4a34e83c90a0ce4455fdb3b8  apps/api/src/modules/builder-intake.service.ts
1cfcb28771599a67fb39a3a05ef5b09fe2fa69557658c3a0885912b3717b1738  apps/api/src/modules/builder.module.ts
36c3a41c1c26940f471f52003627811efc007dd2759eeb9f61373b98f57cb283  apps/api/src/modules/builder.service.ts
7844894b51c9e0d3355ead4cf344b72b872184d9850abaa17da968081b4e2acc  apps/website/lib/public-builder-validation.ts
```

Additional inspected seams: app module registration; content JSON/intake HTTP middleware; legacy intake/leads DTO mapping; legacy publication/content reads and media gateway; M3 publication/reference/permission budget functions; S05 local capture privacy; S06 worker deletion; M4 content-purge worker scope. Shared context/state/plan updates remain the coordinator's responsibility.

## Resumed affected review — SQL0039–0045 and expanded consumers

Parent independently verified the resumed native reviewer turn `01a14509-6671-7fe3-a7ae-1566e15c7cef`: exact role, model, parent and xhigh PASS before substantive work. Original authority and reviewer boundaries remain unchanged. Source snapshots for the inspected files and the pure probe below are in [review-sourcepins.json](review-sourcepins.json). The coordinator reports SQL0032–0042 applied immutably; SQL0043–0045 are ready at inspection. This section reviews only affected repairs and new consumers. It does not invalidate or rerun unchanged evidence.

### Repair status from inspected source

| Finding | Inspected repair | Current reviewer status |
| --- | --- | --- |
| R1 | Corrected pre-application SQL0035 legacy allowlist/type checks; current SHA-256 `ff7dce23dde0dfb485d12858573a7e70575f0363cac54e7a7006f7571b00ae84` | Original cause SOURCE_REPAIRED; expanded runtime is coordinator-owned |
| R2 | SQL0039:41–55 explicit string/type guards before original strict validator | Original null-ID/date/numeric-slug cause SOURCE_REPAIRED; DB negative regression pending reviewer evidence |
| R3 | SQL0039 current adoption eligibility across old service/M3 reads/references/gateways | PARTIALLY_REPAIRED; raw old service cover metadata residual below |
| R4 | SQL0039 public-list internal `budgetLimited`/`hasMore`, API `BuilderService.publicList` creates cursor from explicit continuation and removes internal fields | Original cause SOURCE_REPAIRED; byte budget includes header/cursor and fails rather than looping on an oversized first card |
| R5 | SQL0039:256–260 authorizes exact eligible root or section media | Original hero lookup cause SOURCE_REPAIRED; actual byte/withdrawal tests remain coordinator evidence |
| R6 | Ready SQL0043 substitutes post-lock `clock_timestamp()` in the projection | SOURCE_REPAIRED in ready migration; apply and controlled lock-crossing result NOT_RUN by reviewer |
| R7 | SQL0039 cumulative walk/admission before projection, section-use reservation, API 5-second statement/3-second lock timeouts | PARTIALLY_REPAIRED; form-option occurrence accounting residual below |
| R8 | SQL0038 exact-pin union with first order and required OR retained | SOURCE_REPAIRED for new publications; full promotion+form runtime remains coordinator evidence |

These statuses concern source causes. They are not a blanket runtime PASS or human acceptance.

### R3 residual — Required / High: old service JSON still contains revoked cover alt

`0039_m4_boundary_repairs.sql:75` returns `gcms_s08.eligible_closure` for the legacy service API. Its current definition in `0026_m3_service_links.sql:39–41` checks only S07 `publishable`. After adoption, an M4 service `page` image permission can be withdrawn while the old S07 `service_cover` permission remains active. The M4 head remains active, so `legacy_eligible` stays true. New old-gateway checks deny bytes, but the old API's `service.coverImage` can still contain the asset reference and alt text because `eligible_closure` does not consult `legacy_asset_eligible`.

**Proposed:** additive current M4 asset-scope filtering in the legacy service cover projection/eligible closure, preserving its contentLinks removal and immutable snapshot. **Relevant check:** old public service JSON contains no revoked cover reference/alt after an M4 page-scope withdrawal; saved old media URL is denied; history remains unchanged. Global S07 withdrawal already uses the existing publishable filter. This is an inspected residual, not an observed runtime reproduction.

### R7 residual — Required / Medium: accepted landing shape exceeds consumer node budget

`0039_m4_boundary_repairs.sql:223` reserves root pins plus one section reference occurrence. A consultation option appears in three locations in the public DTO: root `references`, section `form` options and top-level `page.form` options. The website validator counts all three in the shared `context.nodes` (`public-builder-validation.ts:117–139`, and root/section/form calls in publicPage). SQL final admission still counts only the root reference graph.

**Independent in-memory reproduction — Verified, no DB/files/fixtures mutated:**

| Landing form options | Input schema | Serialized reference occurrences | DTO bytes | Actual public parser |
| --- | --- | --- | --- | --- |
| 40 service + 40 location | Accepted | 240 | 159087 | PASS |
| 50 service + 50 location | Accepted | 300 | 198267 | Throws `Public graph too large` |

The latter shape has 100 root pins and an estimated 200-node reservation under the inspected SQL logic, so the new admission can still permit output that the consumer rejects. This is below the byte limit. The pure probe proves the consumer boundary and exact valid input shape; an actual DB publication of that shape was NOT_RUN by this reviewer.

**Proposed:** align admission and consumer accounting for every serialized form occurrence, or use an explicit shared-identity accounting rule on both sides. Keep the 250-node contract and atomic rejection behavior. Add valid-near-limit and over-limit landing-option controls. Do not reduce unrelated assertions or treat the pending DB proof as failed.

### R9 — Required / High: PL/pgSQL variant record collides with legacy SQL aliases

Two SQL0039 functions declare local `d gcms_m4.variant%ROWTYPE` and also use `JOIN gcms_m3.resource d`: `admit_public:226–230` and `matches_filter:312–316`. Their qualified `d.*` references collide between a PL/pgSQL record and SQL alias in the legacy M3 branch. The coordinator reported an actual EN case read 500 during VI alternate resolution and is investigating that exact seam. Reviewer source inspection found the second affected function; no reviewer DB invocation was made.

Ready SQL0044, SHA-256 `d069862b74a08d48e8b1eb125adb5a50b2d2580d3c13f70c31fb651eebf6d2e5`, replaces both SQL aliases with `source_resource`. **SOURCE_REPAIRED / runtime NOT_RUN by reviewer.** Regression scope: EN case read with legacy VI alternate, VI legacy M3 listing and reverse-reference filtering. Other inspected functions use distinct SQL aliases in these branches and did not show this collision.

### R10 — Required / Medium: EN listing fallback had no reachable missing-config signal

The expanded website proxy falls back on a null/404 EN list. SQL0039 returned an active tenant list even when its EN config was NULL, so the fallback regression's mocked 404 did not match that real API condition. The coordinator supplied ready SQL0045, SHA-256 `7577156197317e2922eadd98842ed26809152bf47ec7151cbf57af62db051548`, which returns NULL for an EN list without published EN config. **SOURCE_REPAIRED / actual API-proxy regression pending.** No new listing product decision is required for this missing-config case.

SQL0045 also replaces access to an uninitialized generic legacy RECORD in the virtual builder locale's version expression with the already captured typed legacy state. That source correction was inspected. It adds no public draft access.

### Expanded consumer observations

- Saved private preview binds tenant/kind/resource/locale/draft version. Virtual drafts are not represented as saved previews. Consultation controls are inert. Signed media uses the existing allowlisted preview access, expiry and complete-pair gallery behavior.
- Permission history uses grant timestamp plus UUID keyset pagination, preserves PostgreSQL microseconds, refreshes the exact affected grant and uses an explicit authoritative merge after a confirmed purge retry. Retry remains current-authorized, recent-authenticated and scope-bound; operation replay does not reset twice.
- SQL0042 draft identity rename is atomic under tenant serialization, versions sibling locales and retains locked slugs after any first publication/unpublish. It creates revision records and updates legacy source-state guards. Runtime conflict/rename evidence is pending.
- The lead UI now handles the service/landing union and shows source title/type, promotion/tracking and form locale/consent separately from preferred contact language. The earlier source presentation gap is source-repaired.
- EN proxy strips credentials, forwarded metadata and caller `x-gcms-*`; fallback uses GET/HEAD only. Backend/identity failures return 503 instead of another language. It pins expected publication/config identifiers across the separate proxy/page reads. Metadata/body use one render-scoped resolution. Header stripping, safe query carryover and selected DTO/transport negatives pass the pure tests below.
- New public/SEO rendering uses current eligible derivative metadata and safely escapes JSON-LD. Actual rendered all-family/all-state/two-theme/mobile proof is pending the coordinator's browser work.

### Exact reviewer checks in resumed turn

```sh
./node_modules/.bin/bun --no-env-file test apps/api/test/m4-validation.test.ts apps/api/test/m4-security.test.ts apps/admin/lib/builder-permission-pages.test.ts apps/admin/lib/builder-preview-state.test.ts apps/admin/components/builder-private-copy.test.tsx apps/website/proxy.test.ts apps/website/lib/public-builder-validation.test.ts apps/website/lib/public-builder.test.ts
```

**PASS:** 34 tests / 187 assertions / 0 failures across eight files, Bun1.4.3. An additional no-env, in-memory Bun probe produced the two R7 cases above. No application test was weakened or source changed. These checks are schema/middleware/helper/rendered-string tests, not authenticated browser or DB verification.

Coordinator-reported results at dispatch: core 2/52 PASS, intake 3/54 PASS, locale 1 PASS / 2 FAIL with 30 assertions (including the uninitialized/alias seam and a thenable assertion issue), boundary suite in progress. Those are reported provenance, not reviewer-run or final results. Broader browser/worker/retention/media/race results remain pending filtered evidence from the coordinator; reviewer has not read private fixture files, credentials or raw contact-bearing logs.

Read-only dependency evidence `.local/m4-dependency-audit.json` still reports `braces <=3.0.3`, severity high, GHSA-vfj7-8cjw-p6xm. Dependency/lockfile drift inspection found script-only package.json changes and no bun.lock diff. **Audit remains FAIL/open.** Fresh final serving-build trace assessment is NOT_RUN until the final build/traces are ready. No inherited M3 waiver, new M4 deferral or Production clearance is claimed.

### SQL0046 affected source follow-up

Ready `0046_m4_serialized_scope_budget.sql`, SHA-256 `b9a4cf2805dfb2c5decc38fa45dcb99b63cfa6a5a2331d96c1fdfc13248b79b6`, was inspected after the resumed findings reached the API owner.

- **R3 residual SOURCE_REPAIRED:** its eligible_closure now maps the immutable service slug to its own resource and checks current M4 asset-scope eligibility as well as S07 publishability. Revoked cover metadata is removed together with the old gateway target; the historical snapshot and contentLinks filter remain intact. No recursive eligible_closure/publicability cycle was found in the inspected functions.
- **R7 plain-form residual SOURCE_REPAIRED:** admission counts the root page plus root pins and both serialized form option occurrences. The previously demonstrated 100-option/301-node output is therefore rejected by the ready source's cumulative budget. The below-limit control still needs actual DB evidence.
- **Remaining focused alignment check:** SQL0046 `promotion_scope_pins:8–17` includes direct promotion service/location pins and price service/location children. The current public projection still selects form applicability through recursively flattened promotion descendants (`0039 project_core:298`). A location nested under a directly selected service can therefore enter the public form while not entering the helper's extra form budget. The producer/accounting sets should use the same canonical applicability result. A focused case with a direct promoted service containing location references will resolve whether those options are pruned or fully counted; reviewer DB/runtime proof is NOT_RUN. This observation does not select a new product scope policy.

Evidence file syntax check: `python3 -m json.tool docs/evidence/m4/review-sourcepins.json` PASS. The review Markdown no-index whitespace check emitted no diagnostics; exit 1 is the expected new-file difference result. No shared coordination record was edited.


## Affected follow-up — current SQL0046/0047, ready SQL0048 and fresh serving exposure

Parent independently verified current reviewer turn `01a14519-6455-7283-b48a-0ec0dd7d351c`: `kit-reviewer`, inherited `gpt-6.1-sol`, exact parent and `xhigh` PASS before substantive work. Scope and permissions remain unchanged. The earlier SQL0046 ready snapshot above is preserved as historical evidence; it was corrected before the coordinator reported immutable application. Current exact hashes are appended in [review-sourcepins.json](review-sourcepins.json).

### Affected source conclusions

- **R3 residual SOURCE_REPAIRED:** current `0046_m4_serialized_scope_budget.sql:3–7`, SHA-256 `b334a35ae8a7d897a11c42de8e9a2dcb6e70243492b6a9fa075d7a5f8bfa89dd`, preserves the previously inspected exact asset-scope pruning in legacy service JSON. The cover reference and alt are removed when the matching current M4 use is ineligible. This does not mutate the immutable historical snapshot.
- **R7 remaining alignment SOURCE_REPAIRED:** SQL0046:16–27 now reserves both serialized form occurrences for **all authored options**. The earlier narrower `promotion_scope_pins` helper is absent. Current or later promotion applicability cannot produce an unreserved authored form option. Root, section and top-level form occurrences remain counted against the existing 250-node contract. Runtime boundary rejection and the valid-near-limit control remain coordinator evidence.
- **Native asset grant error SOURCE_REPAIRED:** `0047_m4_asset_scope_expression.sql:3–7`, SHA-256 `500d65edd0b3a48118ca3faee1303c0412b3552fdb4cef0dfb61670099779cb7`, changes `c->'scope'-ARRAY[...]` to `(c->'scope')-ARRAY[...]` in the existing guarded command. The JSON scope allowlist and current authorization/receipt boundaries remain intact. The coordinator reported the pre-fix native `22P02` / token `scope` failure and successful rollback-compile/application of the additive repair. A successful actual gallery grant remains pending filtered runtime evidence here.
- **Ready restore correction SOURCE_ACCEPTABLE:** `0048_m4_restore_locked_identity.sql:3–7`, SHA-256 `ed2444f80120a3d62de15cd511057b03ac9c88a00dbb172b08696a5b1ebd4cf4`, substitutes the current locked technical slug only in the copied restore document. It leaves the selected history row unchanged, retains tenant/resource/locale selection and expected-version guards, and still creates Draft requiring explicit publish. This closes the inspected pre-rename-history/current-locked-slug conflict without changing published identity. Apply and actual restore regression are **NOT_RUN by reviewer / pending coordinator evidence**.

No new actionable source finding was identified in these bounded corrections. The conclusion applies to these exact snapshots and the affected claims, not every M4 path or later changes.

### Runtime evidence supplied by coordinator

At this follow-up the coordinator reports core **2 tests / 52 assertions PASS**, intake **3 / 54 PASS**, locale **3 / 41 PASS**, and boundary **7 / 321 PASS**. The boundary suite covers SQL NULL/type negatives, private closure with blank EN, 53-grant keyset continuation, direct affected-grant refresh, atomic graph rejection, slug lifecycle and byte-budget cursor continuation. The earlier locale failures remain historical; this later scoped result supersedes their active outcome only for the cases actually rerun.

The coordinator reports SQL0046/0047 rollback-compile and immutable apply PASS with prior checksums preserved. These are coordinator-run results, not reviewer DB execution. New media/lifecycle/graph/promotion suites, restored-history regression, worker and expanded browser results are pending at this checkpoint. No raw contact-bearing logs, private fixtures or credentials were read by the reviewer.

### Fresh bounded local M4 dependency assessment

**Audit FAIL/open:** the authorized `.local/m4-dependency-audit.json` reports high severity `braces <=3.0.3`, advisory `GHSA-vfj7-8cjw-p6xm`. Native dependency-graph output places installed `braces@3.0.3` under `micromatch@4.0.8 → fast-glob@3.3.1 → @next/eslint-plugin-next@16.4.1 → eslint-config-next@16.4.1 → root devDependency`. The command returned exit 0. Bun printed an `.env` auto-load notice; no environment values or credentials were returned or examined, and no DB call occurred. Do not interpret that notice as secret inspection or a product test failure.

Fresh static serving-artifact inspection is **Verified** for the exact builds recorded in [review-exposure.json](review-exposure.json):

| Artifact | Inspected count | Advisory-chain matches |
| --- | --- | --- |
| Admin build `XMsSHmxA-tjDWpXLtllwY` | 29 Next trace files / 5491 listed references | 0 |
| Website build `EGARJ64aBgOHEXvG8XTn9` | 16 Next trace files / 3174 listed references | 0 |
| API `dist` | 67 JavaScript files, literal import scan | 0 |
| Admin / website server output | 221 / 106 JavaScript files, literal import scan | 0 |

The 8665 trace references are listed occurrences, not a unique dependency count. The scan checked `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next` and `eslint`, including Bun package-store path forms. Trace digests and audit hash are in the JSON evidence. Root package changes inspected at this boundary are script aliases; no dependency declaration/version or lockfile change was found. API serving uses compiled `dist/main.js`; lint commands are separate developer scripts.

**Assessment:** this fresh M4 evidence supports a bounded local M4 deferral under the recorded local authority. It is independently assessed from M3 and does not remove the audit FAIL, toolchain risk or existing deadline. Reassess by **2026-10-22**, earlier on an available patch, dependency change or serving-exposure change, and before Production. No Production waiver, deployment authority or current patch-availability claim is made. Static trace/import absence is not dynamic proof of every runtime path.

No new test run was needed for these SQL-only source and fresh artifact checks. The independent pure-test result remains **34 tests / 187 assertions PASS** from the prior affected turn; actual DB and browser proof remains separately attributed above. Source pins and exposure JSON syntax/whitespace verification are recorded after saving this append. Human acceptance remains pending and human-controlled.

Evidence checks after this append: `python3 -m json.tool` PASS for both review JSON files; direct whitespace/final-LF checks PASS for all three reviewer evidence files. No application or shared coordination file was changed.


## Final affected checkpoint — applied SQL0048/0049 and preview adapter; SEO repair pending

Parent independently verified reviewer turn `01a14532-fb57-7c10-b0ff-89ebfc8d4bba`: exact role/model/parent/`xhigh` PASS before substantive work. The reviewer reread current policy, role, state/task checkpoint and only affected source/evidence. Ownership and local M4 authority remain unchanged.

### Applied source and matching native regressions

- **SQL0048 / restore:** exact previously inspected hash remains `ed2444f80120a3d62de15cd511057b03ac9c88a00dbb172b08696a5b1ebd4cf4`. Actual restoration **2 tests / 43 assertions PASS** in `integration-checks-1792161705420.json`. The source tests preserve the current locked technical slug, restore old narrative into a new private Draft, retain VI/EN live publication identifiers and verify the original history content is exact. The second case checks old-source generation/pointer changes despite the same draft version and denies stale adoption before an explicit new save.
- **SQL0049 / asset locale:** `0049_m4_locale_asset_use_withdrawal.sql:4–10`, SHA-256 `16f2414604ed9ad1dd44c99816c342b0845a72fba1bce00e12589c21aa58d892`, limits M4 asset-use withdrawal to the exact resource and locale. Current S07 global readiness/withdrawal still precedes every use. Legacy asset compatibility checks use VI, matching old public routes. Actual asset-locale **1 / 44 PASS** in the same record: EN-use withdrawal removes EN bytes/reference/alt while VI and old VI gateway remain eligible; global withdrawal removes both locales and old cover JSON. No widening of global rights was found.
- **Preview adapter:** `builder.service.ts:37`, SHA-256 `64d11b94e4ea2153e8dfcf3999655236cb65ebd7cc1a495ae19a1101088e6f42`, explicitly carries `headers`, `originalUrl` and GET method to the existing media access service. It preserves the session/header getter previously lost through Express object spread. Media access still authorizes the actor/tenant and signs the exact asset/revision/variant with user/session; actual private media delivery verifies that session and current target again. Native media **5 / 184 PASS** in `integration-checks-1792161200871.json` covers signed saved preview with authenticated cookie, hero bytes in both locales, current/global withdrawal, old path/metadata pruning, gallery pair/label removal, usage separation and restricted worker failure/retry/lease fencing. The earlier media failure remains historical.

**Original finding closure:** R1 legacy shape is covered by boundary test `legacy S04 accept, source-bound challenge and exact accepted replay`; R2 by direct SQL NULL/type negatives; R3/R5 by the native media and locale-asset cases; R4 by filtered byte-budget cursor continuation; R6 by actual lock-crossing promotion start/end; R7 by corrected cumulative admission and atomic over-budget rejection; R8 by the successful promotion+consultation/intake flows; R9/R10 by the coordinator's repaired locale and native EN listing checks. These close the specific reported causes and corresponding bounded proof. They do not claim every possible M4 input or browser state passed.

The graph positive control is now **70 options / 211 serialized nodes**, with native admission and serialized bytes both at most 1 MiB. **84 options / 253 nodes** rejects atomically with no publication, intent or receipt. The earlier assumption that 83 options / 250 nodes must fit was incorrect: the coordinator's read-only native estimate was 1,139,049 bytes before config, above the existing 1,048,576-byte limit. A node count at the node boundary does not guarantee the byte budget fits. The test correction changes the invalid positive assumption; it does not raise production limits or remove the negative atomicity assertions. This negative proves rejection of that over-budget graph, not isolated attribution to one particular budget guard.

Filtered records independently inspected by reviewer contain these later successful suites: core **2/52**, intake **3/54**, boundary **7/321**, media **5/184**, lifecycle **4/46**, graph **1/186**, promotion-scope **2/34**, restoration **2/43**, asset-locale **1/44**. Coordinator/task report locale **3/41 PASS**, giving **30 tests / 1005 assertions across 10 files** in total. At this exact checkpoint the matching filtered locale success record is not present among the inspected integration JSON; its source is explicitly the coordinator/task report. No private raw log was opened to fill that evidence pin. Detailed file hashes and provenance are appended in `review-sourcepins.json`.

### Browser and backend evidence boundaries

`ui/full-afbf6b99-1cc5-43ab-98fd-5878f4ac44d2/results.json` has **256 completed PASS cases**: login 1, detail 184, listing 56, public five-width 10 and authenticated editor five-width 5. It spans both themes, VI/EN and widths 320/390/768/1024/1440. The overall record remains **FAIL at fallback_http**. The coordinator identified the absolute-versus-relative Location assertion issue; this reviewer did not inspect all rendered screenshots and does not turn the case count into independent visual approval.

`ui/full-0b67a678-1f7b-4138-9ad3-6b196a0110e4/results.json` records the later real HTTP EN fallback/missing-listing/method/header case PASS, then overall **FAIL at sitemap**. These two partial runs remain distinct historical evidence, not a full browser PASS.

`fault-checks-1792162284388.json` is **PASS**: positively identified owned API paused for at most 10 seconds; EN website returned 503 without fallback/Location at 5002 ms; the exact API resumed and health/page recovered 200. This supports the actual bounded fail-closed transport behavior only. It does not prove every backend failure, Production recovery/SLO or backup/restore.

### R11 — Required / Medium: actual SEO enumeration exceeds the existing statement budget

Known coordinator-native reproduction: sitemap fails 503 after API/native SQL `57014` at approximately 5017 ms under the preserved 5-second statement timeout. The old source in `0033_m4_public_reads.sql:135–139` enumerates candidate locales and invokes full `project` plus `decorate` per row; these repeat full closure/config/alternate resolution. The demo has 30 resources / 57 authored locale variants and menu15, so the affected supported local shape is concrete. Reviewer has not executed a DB timing probe.

**Owner:** API implementer prepares forward SQL0050 with a narrow SEO read model and private required-pin eligibility walk. **Proposed bounded repair:** read current VI/EN publication/config heads once; preserve tenant/public-enabled checks, actual published language, current-generation and patient-text eligibility, exact required pins, reciprocal eligible alternates, existing graph admission and stable 51-row lookahead/keyset. Keep timeout and payload limits. Avoid projecting full public media/content/section/config closures solely to emit SEO identifiers and URLs.

**Closure condition:** inspect the ready affected source and matching native >50-row pagination/menu15/current-revocation/time result, then refresh the API serving-artifact evidence after the final build. Existing failure and partial browser records stay preserved. Final SEO source/runtime and final API exposure remain **NOT_RUN / pending**, so full M4 review closure is not claimed here. No new human approval gate is introduced for this routine repair inside approved M4 authority.

Locale evidence addendum: reviewer inspected the later standalone `integration-checks-1792162444167.json`: **3 tests / 41 assertions / exit 0 / PASS**. The aggregate **30 tests / 1005 assertions / 10 files PASS** now has matching filtered artifacts for every suite. The earlier combined locale-success/boundary-beforeAll429 run remains historical overall FAIL; the separate boundary **7/321 PASS** is its corresponding successful scope. No private raw log was read.


### Frozen SQL0050 source conclusion and R12 direct-SQL limit guard

API owner froze `0050_m4_seo_eligibility.sql` for focused read-only review. The first frozen SHA-256 was `5666d194e6169aabc46df84f00b6442502f4a0743a88be764afbb9637d88f871`.

**R12 — Required / Medium, Verified from source:** its original line62 used `IF lim NOT BETWEEN 1 AND 51` without `lim IS NULL`. A permitted direct SQL call with NULL limit bypasses that guard and also the line94 return condition, so it accumulates all eligible rows. The public HTTP adapter always supplies 51; this finding is a direct SQL bound gap, not a demonstrated anonymous HTTP bypass. Reviewer made no DB call.

The coordinator confirmed SQL0050 was not applied, released only this routine guard correction and had the owner refreeze it. Current SHA-256 is **`ade84e01a91f65d0d93588093d4da5dbeacc683ef9d3dfddd78fcbcd0c3ed451`**. The reviewer verified that removing exactly `lim IS NULL OR` from the corrected file reconstructs the first frozen hash. No other SQL change occurred. NULL/0/52 native contract assertions are present in the test source; runtime remains pending. No immutable applied file was edited.

**Affected source assessment: SOURCE_ACCEPTABLE.** No further actionable source defect was found in this exact correction:

- `seo_page_identity:39–56` keeps active tenant/public site, actual locale, active adopted head, exact pinned publication in the current generation, exact resource/locale/revision patient-text permission and recursively surviving required pins. Historical pins remain bound to their pinned snapshot rather than silently reading another publication. Optional references and removed media prune from normal delivery without exposing content/alt in SEO.
- `seo_legacy_identity:10–32` follows current legacy eligibility and immutable publication selection. Terminal service snapshots may exist at depth4 exactly where the legacy/M4 projectors construct them without another recursive page. Other legacy kinds stop after depth3. Authored price locations must still have a surviving eligible location, and a legacy price at depth3 with authored locations is rejected because normal delivery prunes those locations. The surviving service requirement remains in `gcms_m3.resource_eligible`.
- `seo:65–95` reads published configuration identifiers once and each candidate VI/EN identity once, excludes EN without an active published EN config, emits reciprocal actual-locale alternates and keeps existing conservative admission. Candidate selection retains a pair when a cursor splits EN/VI; per-entry filtering then emits only keys strictly after the cursor. Output remains at most51 internally /50 at the API and uses registered `canonical_origin` plus the canonical path function, not raw Host/query.
- Both new helpers are `SECURITY DEFINER` with `search_path=pg_catalog`, schema-qualified app references and PUBLIC execution revoked. No blanket/default tenant execution grant for new functions was found in the inspected migrations/bootstrap scripts. The public SEO function retains its existing runtime grant. Effective helper execution denial remains a pending native role probe, not inferred enforcement proof.

The source blocker for applying this corrected migration is cleared within existing M4 authority. **R11 native time/pagination/revocation and R12 native invalid-limit/helper-denial results are pending.** The coordinator's fresh rollback-compile/shape probe PASS is separate reported evidence, not reviewer execution. The final API build/exposure refresh also remains pending; the prior dependency assessment is valid only for its recorded artifact pins until refreshed.


Browser addendum: reviewer inspected the filtered result fields in `ui/full-1bbf2a71-d8a0-4002-9d3d-597bb90ebfc2/results.json`: ordinary login and `real_en_form_unknown_ack_same_request_retry_to_shared_cms_source_contact_vi` are completed **PASS**; overall remains **FAIL at lifecycle_create**. The subsequent `ui/full-876a69e4-ad44-4e03-b206-d383fb0cfc9e/results.json` is separate **PASS / lifecycle_only**, with login plus `actual_cms_history_restore_draft_unpublish` PASS and zero browser errors. These are coordinator-run actual browser evidence, not this reviewer's independent visual inspection. Existing catalog/layout positives can be reused while their product source and inputs remain unchanged; SEO-only repair does not require a ritual rerun of unrelated 256 cases.


### SQL0050 native controls and R13 API cursor continuation

Reviewer inspected `seo-sql-role-controls.json`: **PASS**, two private helper execute denials under the runtime role, and SQL NULL/0/52 limit controls all true. **R12 CLOSED** for the corrected source and these actual coordinator-run controls. The private helper effective execution denial is now observed within this probe, rather than inferred only from grants. The coordinator reports corrected SQL0050 applied immutably after fresh rollback-compile/shape probe PASS.

The coordinator's actual demo SQL returns51 rows in133 ms, demonstrating that the original full projection multiplier is removed for that supported shape. This is not yet end-to-end SEO closure: `integration-checks-1792162892452.json` remains **FAIL**, 1 PASS / 1 FAIL /116 assertions. The successful case covers global media withdrawal with retained lawful SEO identity; the first case fails while authoring an invalid blank EN fixture before its enumeration checks. The owner is correcting fixture construction without changing product validation. The SQL deadline result alone does not supersede this failed suite.

**R13 — Required / Medium, Verified from source with matching coordinator reproduction:** `builder.service.ts:63` generates the SEO cursor after-key `kind:id:locale`, but `request-security.ts:31–39` accepts only `[A-Za-z0-9_-]{1,128}` for decoded `after`. The generic decoder therefore rejects the generated colon-bearing key before the SEO-specific validator runs. Coordinator actual API page0 returned200/50 items in150 ms; page1 returned400 in1 ms. This blocks traversal above50 rows and causes the website's complete-only sitemap reader (`public-builder.ts:33–45`) to fail rather than silently return a partial sitemap.

**Proposed / owner API:** a bounded SEO-specific decoder/codec that retains the600-character/base64url input bound, exact `{scope,after}` shape, tenant-specific SEO context and allowlisted resource kind/UUID/locale; keep the generic helper unchanged. Verify round-trip plus malformed/wrong-tenant/extra-field negatives and actual >50-row traversal, then repeat actual complete sitemap and refresh final API serving-artifact evidence. This is a routine repair within current M4 scope, not an expanded product decision. **R11/R13 remain open** until the affected source and actual continuation/time results are available.

Additional filtered UI evidence: `ui/states-0587a50b-4b6d-4bdc-ae0a-9b66c20788ae/results.json` is **PASS**, eight cases / zero browser errors. Real cases cover two-tab backend conflict with input preservation/explicit rebase, committed save with lost acknowledgement and exact operation replay, source-filtered empty state, loaded signed/reference preview images and mobile menu keyboard behavior. Loading/503/403 cases use explicitly controlled HTTP responses and prove UI handling; they do not prove an actual outage or revoked actor. The separate actual bounded API outage record remains the transport-fault proof.


### R13 affected cursor source repair — independent pure PASS

Frozen `builder-seo-cursor.ts`, SHA-256 **`2ca3ad0f2fbe54d0bfb336a6cb32941a8a6ef566e4df8fad4977639eda018773`**, encodes the composite `kind:UUID:locale` into a canonical inner base64url token before using the existing generic outer cursor. Decode keeps the generic600-character/base64url/exact-shape/tenant-context checks, verifies canonical inner and outer encodings and checks the exact M4 kind/UUID/locale allowlists. This opaque encoding is not an authorization token; the public query still checks actual publication eligibility on every request.

`BuilderService.seo` uses the new codec on both issue and read, SHA-256 **`6b93111581714dc04f580f24add6f13ac38d2b691cfde7f81047325b2d5feb53`**. The generic `request-security.ts` SHA-256 **`3c735f6bc43345186df5848ebc067fd9c7051a306581bf27850e521b59b40329`** is unchanged from the preceding inspection. SQL0050 remains exactly its reviewed immutable `ade84e01…` snapshot. No new actionable source defect was found in this bounded adapter/consumer repair.

Reviewer independently ran:

```sh
./node_modules/.bin/bun --no-env-file test apps/api/test/m4-seo-cursor.test.ts
```

**PASS: 4 tests /124 assertions /0 failures /1 file, Bun1.4.3.** This includes the actual service accepting its own issued50-row continuation, all kinds/locales round-trip, malformed/cross-context/old raw-colon rejection, canonical encoding negatives and unchanged generic cursor behavior. The mocked query does not prove DB pagination; actual >50-row API/sitemap traversal remains pending. **R13 SOURCE_REPAIRED; R11/R13 runtime closure and final API serving-build refresh remain open.**

The new integration fixture explicitly authors valid EN hero/body/summary rather than copying virtual blank narrative or changing production validators. Its frozen source still checks a split EN/VI boundary, complete reciprocal alternates, current page/config/patient-text revocation, required versus optional references, invalid SQL limits, existing deadline and global media withdrawal. No reviewer execution of that DB/fixture suite occurred.

Differential source check: removing only the new SEO codec import and reconstructing the prior `seo` method yields the exact preceding BuilderService hash `64d11b94…`. All other methods, including the already verified preview adapter, remain unchanged. This supports reuse of unaffected native results; it does not replace the pending SEO continuation proof.


## Final bounded handoff — R1–R13 closed, audit FAIL/open retained

The final reviewed source pins remain unchanged: SQL0050 `ade84e01…`, SEO cursor `2ca3ad0f…`, BuilderService `6b931115…`, generic request security `3c735f6b…`, native SEO test `3d3ce5eb…`. Exact full SHA-256 values and evidence hashes are in `review-sourcepins.json`. No further product source change was reported during the final root build/checks.

### R11 and R13 scoped runtime closure

Reviewer inspected final filtered `integration-checks-1792163336362.json`: **2 tests /3941 assertions /0 failures /exit0 PASS** for the native SEO file. Combined with the earlier unaffected matching records this is **32 unique tests /4946 assertions /11 files PASS**, all coordinator-run. Native test source and these results cover the >50-row EN/VI split boundary, stable/no-duplicate continuation, reciprocal actual alternates, unpublished drafts, page/config/patient-text revocation, required-versus-optional closure behavior, global media withdrawal and existing SQL bounds. The preserved 5-second deadline was not raised.

`seo-native-timings.json` contains eight scoped measurements; maximum per-page observed time is **18 ms**, including the initial split `[50,4]` pages. These small owned fixtures do not prove Production scale or an SLO.

Actual demo `seo-http-final.json` is **PASS**: API pages **50 and9 items**, status200 at **112 ms /19 ms**; full consumer returns **59 entries**, overall measured408 ms; actual sitemap XML is **200 /59 entries /117 ms /no-store**. This is one owned local demo run. It proves that the old generated-cursor400 and sitemap timeout are repaired for the affected supported flow.

Actual browser/HTTP `ui/full-7b976684-eea2-4b5e-b84a-b369e5d461ff/results.json` is **PASS /http_only**, three cases /zero browser errors: ordinary login, real EN fallback/missing listing/method/header behavior, and real sitemap actual-locale/local robots. The earlier partial/full runs remain historical FAIL and are not rewritten as successful runs.

**R11 CLOSED; R13 CLOSED** for the exact source and matching native/demo/HTTP proof. R12 was already closed by the native private-helper denial/NULL-limit controls. Original R1–R10 remain closed within their recorded source and matching scoped regression proof. No required source finding remains open in this bounded review.

### Final API serving exposure

After root reported the stable final API build exit0, reviewer scanned the released `apps/api/dist`: **68 JavaScript files /zero advisory-chain literal imports**. Exact sorted JS artifact manifest SHA-256 is **`4b9a2d75dee39892604f53ed35ef9f1281ebaca401b882bc5999501ef985d72c`**. Compiled entrypoint, BuilderService and cursor helper hashes are recorded in `review-exposure.json`.

Both admin/website BUILD_ID values and sorted trace digests match the prior independently inspected pins exactly. The unchanged **45 Next traces /8665 listed references /zero advisory-chain matches** are therefore reused. The audit metadata input hash also remains unchanged. No dependency graph command was rerun and no private raw build log/credentials/contact-bearing output was read.

**Fresh final assessment:** bounded local M4 deferral remains supported for the pinned serving builds. Audit remains **FAIL/open**, dev toolchain risk remains, and no Production waiver is granted. Reassess by **2026-10-22**, earlier on patch availability/dependency/serving-exposure change, and before Production. Current patch availability was not checked by this source/artifact review.

### Verification, limits and ownership

Latest reviewer execution is the independent **4/124 pure cursor PASS**, plus the previous **34/187 pure PASS** at its recorded affected snapshot. Native DB/browser/worker/build/type/lint/preservation execution belongs to the coordinator. The reviewer inspected filtered records and source, not private fixture files or raw contact-bearing logs. Root additionally reports final type/lint/build PASS, current launcher3Bun/6diagnostics PASS, and preservation63 baseline tables /226905 baseline rows /1048 files with zero unexpected changes; those remain coordinator-attributed evidence.

Only existing reviewer evidence files were changed: `review.md`, `review-sourcepins.json`, `review-exposure.json`. No application, script, generic helper, shared coordination record, DB/fixture/credential, Git or deployment action was changed/performed by reviewer. Hidden permission enforcement remains Unknown beyond observed scoped reads/evidence writes/pure checks. This technical closure adds no human acceptance, full-MVP, Production or deployment claim. Historical FAIL/Unknown/NOT_RUN limits remain intact.

Concrete next actions within existing ownership:

1. Coordinator integrates this bounded review and exact final pins into the M4 handoff/current records alongside its remaining final checks.
2. Project Lead reviews the local M4 handoff and controls any human acceptance; silence remains no approval.
3. Coordinator retains the open audit item and reassesses by the recorded date or earlier trigger; no new automation or Production authority follows.

Final evidence checks: both reviewer JSON files parse PASS; all three owned evidence files pass trailing-whitespace/final-LF checks. Independent aggregation of the latest filtered record per native suite confirms **11 files /32 tests /4946 assertions /zero failed suites**. Existing reviewer files are released after this handoff; root-only additional editor-control browser proof does not alter the reviewed frozen application snapshots.
