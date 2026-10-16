# M3 independent review

**Status: CLOSED — bounded local independent review — 2026-10-16.** Approved GCMS-M3-001 v0.1 source and the recorded scoped behavior were reviewed. R1–R9 are closed on the final reviewed source/evidence; the dependency audit remains **FAIL/open** under the fresh bounded M3 local assessment below. This closes the independent review, not human acceptance, full-MVP or Production verification. Root owns integration, runtime/fixtures and shared records. Reviewer writes are limited to this report and its source-pin JSON. No application changes, migrations, fixture mutations, Git delivery or deployment were performed by this reviewer. Earlier open/pending checkpoints below are preserved history and are superseded only by the final closure section.

Runtime role/parent/model/effort: **Verified** `kit-reviewer`, exact parent `01a1442c-b412-7f63-b03f-b23c76825bf2`, `gpt-6.1-sol/xhigh`, from [parent-captured native metadata](reviewer-runtime.json) and the independently parent-checked final turn `01a14484-17ca-7023-a655-113c1824fb15`. The reviewer also ran the metadata helper on that turn with PASS. Effective permissions beyond observed authorized file reads, pure checks and owned review-file writes remain **Unknown**.

## Required findings

### R1 — P1: New anonymous intake rolls back at the audit insert

**Verified source:** `apps/api/migrations/0027_m3_lead_location.sql:131` inserts into `gcms_s02.audit_event` without `actor_id`. That column is NOT NULL (`0001_s02_access.sql:65`). The last predecessor, `0006_s04_anonymous_audit.sql:106`, inserts into the separate anonymous `gcms_s04.audit_event` table. A direct source comparison shows this unrelated change in the replacement function.

Trigger: a fresh otherwise-valid consultation request, with or without optional location. Impact: PostgreSQL rejects the insert and rolls back the lead, notification intent and receipt. **Runtime reproduction NOT_RUN by reviewer:** parent owns intake fixture mutation. Proposed repair: an additive forward migration restores the anonymous audit destination; assert absent/present-location intake and the anonymous audit row.

### R2 — P2: Accepted reference graphs exceed the website contract

**Verified pure reproduction:** each content document passes `parseDentalContent`, but an article with six FAQ references and fifty service references per FAQ produces 306 resolved nodes. `public_projection` recursively emits these nodes (`0025_m3_content.sql:240–248`), while website `resolved()` rejects more than 250 nodes (`apps/website/lib/public-content-validation.ts:67–70`). The project Bun probe returned `allInputDocumentsValid=true` and `publicValidation="Public reference graph too large"`.

Impact: content accepted for publication can make its public page unusable. Public listing can also spend unbounded candidate work before obtaining its requested output count. Proposed repair: authoritative graph/payload bounds aligned with the shared public contract, plus query-plan/candidate-budget evidence. Do not silently cut required graph data.

### R3 — P1: Ordinary asset classifier bypasses S11 resource permission

**Verified source:** `asset_allowed` (`0025_m3_content.sql:137`, replacement `0028_m3_integrity.sql:29`) accepts `material_kind='ordinary'` without a resource asset grant. This applies to case/gallery/testimonial too. A text grant alone can therefore publish their ordinary-classified images.

**Confirmed contract by parent:** case/gallery/testimonial require resource+revision text permission and resource+asset-revision permission for every image, regardless of upload classifier. The ordinary exemption remains for non-patient doctor/article photos. Proposed repair: enforce the S11 distinction in the DB eligibility predicate and CMS permission status; verify each S11 kind rejects missing asset scope. Runtime reproduction **NOT_RUN by reviewer**; source check is sufficient to identify the bypass.

### R4 — P2: Exhausted expired purge claims have no recovery path

**Verified source:** `purge_claim` (`0025_m3_content.sql:309`) excludes every job with `attempts=5`, including expired `processing` claims. If the fifth worker exits before `purge_finish`, the job stays `processing` permanently. `purge_retry` only accepts `failed` jobs (`0025:218`), and CMS maps processing to pending.

Impact: the durable intent has neither a terminal failure nor an administrator retry path after the last worker crash. Proposed repair: under the scope lock, mark exhausted expired leases failed before selecting a new claim. Verify fifth-claim loss, lease expiry, failed status, explicit retry and stale-fence denial. Live crash/lease reproduction **NOT_RUN by reviewer**.

## Additional verification request

**Proposed DB reproduction:** an explicit JSON `kind:null` can make `NOT gcms_m3.kind(k)` evaluate to SQL NULL (`0025:36`), bypassing the validator's rejection branch. The save mismatch comparison and table equality CHECK also accept NULL. API parsing rejects this input, so the affected boundary is the restricted-role DB command/constraint. Parent was asked to test direct malformed saves and enforce a true predicate if reproduced. Runtime outcome remains **Unknown** until that check.

## Pure verification

Project-local `node_modules/.bin/bun --no-env-file test` for the M3 API validation, CMS input/navigation/permission/references/decimal, website price/content/components and consultation suites: **PASS — 41 tests, 164 assertions, 0 fail across 10 files**. This verifies pure contracts/rendering only. It does not prove DB transactions, live routes, interactive UI or worker timing.

## Review in progress

Current scope includes migrations 0025–0028 (0028 not yet applied at review start), M3 API/contracts/media/intake/service-link seams, CMS, website and root M3 scripts. Implementers are still changing source. Findings above are early findings, not the final source pin or a completion verdict.

**Verified:** replaced-intake predecessor comparison; tenant authorization takes the tenant advisory transaction lock before command receipts; immutable publication/reference generation structure; public resource media URLs include resource and publication identity; website anonymous fetches omit credentials and use no-store; location snapshot lives on the lead row and follows row deletion.

**Unknown / NOT_RUN:** final source stability, live DB/RLS/constraint/race checks, rendered CMS/public journeys, withdrawal timing and real storage purge, final build traces and fresh M3 braces exposure decision. Parent owns runtime verification. Audit remains **FAIL/open**; no M2 deferral is inherited. Reassess 2026-10-22 or earlier on patch/dependency/exposure change and before Production.

## Affected-fix review — 2026-10-16

The historical findings and initial NOT_RUN entries above remain unchanged. This checkpoint reviews the current source and the parent's actual [integration result](integration-checks-1792147507355.json), plus filtered pass/count lines from its two private raw logs. Reviewer did not rerun the mutating suites.

| Finding | Current result | Verification and limit |
| --- | --- | --- |
| R1 anonymous audit | **CLOSED** | Forward migration 0029 restores `gcms_s04.audit_event`. The actual absent/present-location intake test passes, including one anonymous audit row, old semantic fingerprint, frozen retry and both same-tenant administrators' read. |
| R2 public graph contract | **CLOSED for graph/payload admission** | 0028 checks at most 250 resolved references and 1 MiB in the publication transaction, including service-link snapshots. Actual graph test passes: over-budget publish returns 409, with zero publication/intent and no active page. Public candidate/query-plan performance evidence remains a separate pending acceptance item. |
| R3 S11 ordinary bypass | **CLOSED** | 0028 permits the ordinary exemption only for doctor/article. Actual native-media gallery test passes: text-only and one-image-only scopes reject, complete scopes publish, old resource URL denies after withdrawal, legacy service-cover URL denies, and complete pair/alt/caption are pruned. The same DB predicate covers case/testimonial; those image variants were not separately executed in this checkpoint. |
| R4 final crashed lease | **CLOSED** | 0028 marks exhausted expired processing claims failed before selecting. Actual worker-role test passes through five lost claims, failure, explicit retry, increased fence, stale-worker denial and current completion. |
| Null-kind DB shape request | **CLOSED** | 0028 requires a string kind, uses `IS NOT TRUE`, and adds strict identity/shape constraints. Actual restricted-role malformed-save test includes `kind:null` and returns 23514. Additional malformed doctor/price/opening-hour cases also pass rejection checks. |

**Actual integrated tests inspected:** core 8 tests / 266 assertions; native media 2 tests / 61 assertions; **10 tests / 327 assertions, 0 fail, 0 skip**. This includes real API, restricted PostgreSQL and local media/storage worker behavior. The media test bounds withdrawal by 60 seconds and physical purge by 300 seconds; it does not report a precise latency distribution or Production behavior. It keeps resource delivery invalidation separate from global physical asset purge.

**Recorded representative UI evidence inspected:** [specialty journey](ui/representative.json) passes create/save/reload, private preview, password reauthentication, explicit publish, desktop 1440/mobile 390 and pending V2/public V1. This is parent-captured evidence for one specialty journey. It does not prove the remaining CMS forms or the full responsive/state matrix.

Current reviewed API/source hashes are in [review source pins](review-source-pins.json). The overall review remains **IN_PROGRESS**: CMS is still mounting remaining fields; final source release, final build/trace audit and remaining required runtime evidence are pending. A change to the reviewed predicates, migration checksums or corresponding callers invalidates only the affected closure.

## New CMS finding — R5, P2, OPEN

**Verified source:** after a successful permission mutation, `ContentPermissionsPanel.mutate` only updates permission rows (`apps/admin/components/content-permissions.tsx:31`). It does not refresh `ContentEditor`'s draft. A text withdrawal clears the current public pointer and increments `publicationRevision` in the DB, but the editor still uses its previous `activePublication`, `publishedVersion` and `publicationRevision`.

Trigger: withdraw text permission while the resource is published, without leaving/reloading the editor. Impact: the editor continues to show Published and a live link; an unchanged draft can keep the update button disabled, while subsequent publication commands carry stale revision values. Proposed repair: refresh the canonical draft/site after a confirmed permission mutation and provide a bounded retry if refresh fails. Verify the visible publication state changes immediately after text withdrawal without discarding unsaved permission input on an error. Interactive reproduction is **NOT_RUN by reviewer**; parent owns browser fixture mutation. Finding sent to parent during current CMS source construction.

## New request-boundary finding — R6, P2, OPEN

**Verified pure reproduction:** a gallery with 20 complete distinct pairs, each image's allowed 500-character alt/1000-character caption, and only 2000 body characters passes `parseDentalContent`. Its create request is **66,130 bytes**. The API's common JSON parser admits only **65,536 bytes** (`apps/api/src/app.ts:73`, `limit: '64kb'`). The request therefore exceeds transport admission despite meeting the M3 content contract; multibyte text reaches the limit sooner.

Impact: allowed gallery content cannot save, after the administrator has composed it. Proposed repair: align bounded M3 request admission with the combined allowed content shape, preserving a hard cap and explicit rejection for over-cap requests. Verify a valid above-64-KiB request through real HTTP and rejection at the selected maximum. HTTP reproduction **NOT_RUN by reviewer**; the pure probe confirms the contract/transport size mismatch without fixture mutation. Finding sent to parent.

## Public listing / picker access-pattern review

**Verified source at this checkpoint:**

- CMS list and reference-picker SQL use `LIMIT pageSize+1`, default 20/max 50, with stable resource-ID order. Cursor binding includes tenant, kind, normalized query, filters and requested limit. CMS lists use tenant-role RLS before results return.
- The non-service reference picker includes full `public_projection(...) IS NOT NULL` in its WHERE clause (`content.service.ts:67`). PostgreSQL evaluates that predicate for examined candidates before it can satisfy LIMIT. The application does not load the full catalog into the browser, but each candidate's eligibility check constructs a public graph rather than a lightweight eligibility result.
- `public_list` candidate cursors have no SQL LIMIT (`0025:284,290`). PL/pgSQL exits after enough eligible output rows, so it does **not necessarily** project all rows. An ordered index/cursor can stop early. With sparse eligibility or reverse matches, however, work can continue over every remaining candidate. For M3 content, full projection occurs before reverse-reference filtering (`0025:291–293`), including unrelated candidates.
- Service reverse lists call `service_has_reference` once per candidate; that helper scans the selected snapshot's at-most-50 JSON pins. It applies current generation eligibility, preserving withdrawal/unpublish behavior, but has no indexable reverse-membership predicate.
- Existing `content_list_keyset(tenant_id,kind,id)` supports unfiltered M3 keyset scans. Resource and publication composite primary keys support same-tenant snapshot lookup. Service draft/pointer/snapshot primary keys support service keyset scans. There is no index on reverse membership in either publication's `reference_pins` JSON. `position(q IN lower(...))` substring search cannot use these B-tree indexes to find title matches.
- Every public listing separately selects the latest eligible published site snapshot from both publication tables, sorted by `published_at` (`0025:300`). No M3 `(tenant_id,published_at DESC)` index is present. This can scan/sort active publication candidates independently of a small result page. It uses immutable Published site data, so replacing it with the current site draft would violate publication isolation.

**Proposed bounded change, subject to measurements:** apply an indexable pinned-reference candidate predicate before full projection for reverse lists, then retain current eligibility and exact publication-ID checks. A JSONB containment predicate can use a measured `jsonb_path_ops` GIN index; the existing per-row helper alone cannot. If reverse access is frequent and JSON plans remain poor, use a tenant-consistent published-edge read model maintained atomically with publication. Do not add speculative indexes or duplicate live authority. A hard candidate window requires a continuation cursor for the last examined candidate, including empty pages, so it must not skip later eligible results. The current cursor denotes the last returned item; adding LIMIT to the raw cursor without that contract would be incorrect.

### Exact read-only EXPLAIN requests for root

**NOT_RUN by reviewer.** Execute only against the owned M3 tenant, with a bounded local statement timeout and existing legitimate tenant session context for private queries. Use bind parameters; do not emit cookies/session tokens. Owner-role plans can diagnose indexes but do not prove tenant-role RLS plans. No fixture creation, ANALYZE, index creation, planner disabling or global instrumentation is requested.

Use `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT JSON)` for each SELECT below. Inspect actual rows, rows removed, loop counts, sort method, buffers and execution time. A sequential scan on a tiny fixture can be the correct plan. Record actual fixture cardinalities and do not extrapolate to scale from the plan's index choice.

**Q1 — exact CMS list row query.** `$1=owned tenant ID`, `$2=kind`, `$3=after ID or NULL`, `$4=published-only boolean`, `$5=normalized q`, `$6=pageSize+1`.

```sql
SELECT r.id,r.tenant_id AS "tenantId",r.kind,r.version,r.content,
       r.slug_locked AS "slugLocked",r.publication_version AS "publicationVersion",
       r.publication_revision AS "publicationRevision",
       (r.active_publication_id IS NOT NULL) AS "activePublication",
       p.draft_version AS "publishedVersion",r.updated_at AS "updatedAt"
FROM gcms_m3.resource r
LEFT JOIN gcms_m3.publication p
  ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id
WHERE r.tenant_id=$1 AND r.kind=$2
  AND ($3::text IS NULL OR r.id>$3)
  AND (NOT $4::boolean OR r.active_publication_id IS NOT NULL)
  AND ($5='' OR position($5 IN lower(r.content->>'title'))>0
             OR position($5 IN r.slug)>0)
ORDER BY r.id LIMIT $6;
```

Expected support: `content_list_keyset` and publication PK. Run first page, a real next-page ID, and a no-match q. This proves the actual bounded row query, not the public projection cost.

**Q2 — exact non-service reference picker.** `$1=owned tenant ID`, `$2=kind`, `$3=after ID or NULL`, `$4=normalized q`, `$5=pageSize+1`.

```sql
SELECT r.kind,r.id,p.id AS "publicationId",p.content->>'title' AS title,
       r.slug,r.version,p.publication_version AS "publicationVersion",p.content
FROM gcms_m3.resource r
JOIN gcms_m3.publication p
  ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id
WHERE r.tenant_id=$1 AND r.kind=$2
  AND gcms_m3.public_projection(r.tenant_id,r.id,p.id) IS NOT NULL
  AND ($3::text IS NULL OR r.id>$3)
  AND ($4='' OR position($4 IN lower(p.content->>'title'))>0
             OR position($4 IN r.slug)>0)
ORDER BY r.id LIMIT $5;
```

Expected support: keyset index and publication PK. The projection predicate can still account for substantial work before 21 survivors. Compare ordinary taxonomy/FAQ with price and a sparse eligible kind if those owned fixtures already exist. Do not mutate rows to force a plan.

**Q3 — exact public entrypoint.** `$1=owned tenant slug`, `$2=kind`, `$3=normalized q`, `$4=after ID or NULL`, `$5=pageSize+1`, `$6=reference kind or NULL`, `$7=reference ID or NULL`, `$8=exact pinned publication ID or NULL`.

```sql
SELECT gcms_m3.public_list($1,$2,$3,$4,$5,$6,$7,$8) AS result;
```

Run the owned category→article, location→price and taxonomy→service reverse queries with matching and nonmatching existing IDs, plus a normal listing. This measures total execution/buffers. **Limit:** EXPLAIN shows a Result node for this PL/pgSQL SECURITY DEFINER function; it does not reveal its nested query plans or count projection calls. Do not present it as proof that a nested candidate scan uses LIMIT.

**Q4 — exact M3 raw candidate query inside `public_list`.** `$1=owned tenant ID`, `$2=kind`, `$3=after ID or NULL`, `$4=normalized q`.

```sql
SELECT r.id,r.active_publication_id
FROM gcms_m3.resource r
JOIN gcms_m3.publication p
  ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id
WHERE r.tenant_id=$1 AND r.kind=$2 AND r.active_publication_id IS NOT NULL
  AND ($3::text IS NULL OR r.id>$3)
  AND ($4='' OR position($4 IN lower(p.content->>'title'))>0
             OR position($4 IN lower(r.slug))>0)
ORDER BY r.id;
```

Expected support: keyset index, tenant-scoped publication PK, no avoidable full sort for an ordered index plan. **Limit:** standalone EXPLAIN ANALYZE exhausts this query; the real FOR cursor can stop on EXIT. Its actual row count measures available candidates, not how many the function consumed.

**Q5 — diagnostic reverse-candidate query for the proposed pushdown.** `$1=owned tenant ID`, `$2=consumer kind`, `$3=reference kind`, `$4=reference resource ID`, `$5=exact reference publication ID`, `$6=after ID or NULL`, `$7=pageSize+1`. This is a read-only comparison, **not current implementation or final output eligibility**.

```sql
SELECT r.id,r.active_publication_id
FROM gcms_m3.resource r
JOIN gcms_m3.publication p
  ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id
WHERE r.tenant_id=$1 AND r.kind=$2
  AND ($6::text IS NULL OR r.id>$6)
  AND p.reference_pins @> jsonb_build_array(jsonb_build_object(
        'kind',$3::text,'id',$4::text,'publicationId',$5::text))
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.reference_pins) pin
    WHERE pin->>'kind'=$3 AND pin->>'id'=$4 AND pin->>'publicationId'=$5
      AND gcms_m3.reference_eligible($1,pin)
  )
ORDER BY r.id LIMIT $7;
```

Current expectation: no JSON-membership index, so the containment condition remains a filter. A future GIN index only helps if callers expose `@>` (or a supported JSON path operator) to the planner. Keep final resource/dependency eligibility after the candidate reduction. Service links need the equivalent predicate on `service_publication_links.reference_pins` plus the current service pointer join.

**Q6 — exact published-site selection inside `public_list`.** `$1=owned tenant ID`.

```sql
SELECT x.site
FROM (
  SELECT p.site,p.published_at
  FROM gcms_m3.publication p
  JOIN gcms_m3.resource r
    ON r.tenant_id=p.tenant_id AND r.id=p.resource_id AND r.active_publication_id=p.id
  WHERE p.tenant_id=$1
    AND gcms_m3.text_allowed(p.tenant_id,p.resource_id,p.draft_version,r.kind)
  UNION ALL
  SELECT p.closure->'site',p.published_at
  FROM gcms_s02.publication_snapshot p
  JOIN gcms_s02.publication_pointer ptr
    ON ptr.tenant_id=p.tenant_id AND ptr.service_id=p.service_id AND ptr.snapshot_id=p.id
  WHERE p.tenant_id=$1
) x
ORDER BY x.published_at DESC LIMIT 1;
```

Inspect candidate scan/sort independently of the list page. Proposed index targets, only if measurements justify them, are publication `(tenant_id,published_at DESC)` on both publication tables, together with existing active-pointer lookup. Preserve eligibility and immutable site content. No fixed latency target or index requirement is inferred from the approved plan.

## Source-ready follow-up — R5/R6 and migration 0030

**Verified source and pure checks:**

- R5's permission panel now awaits the parent callback after confirmed mutation. The parent reloads canonical draft/site, including `activePublication` and `publicationRevision`. A current-input ref plus `permissionRefreshState` preserves input typed during a late refresh. A refresh error locks further edits into the existing comparison path and reports the confirmed-mutation/failed-refresh distinction. Pure refresh/routing/scope checks: **6 tests / 25 assertions PASS**. Rendered text-withdrawal state remains **NOT_RUN in this checkpoint**.
- R6 now uses a route/type-selected **512 KiB** M3 JSON parser before the retained legacy 64 KiB parser. The selector only matches tenant content paths with the same supported JSON type contract. Shared parser errors now map 413 to the redacted standard error. Actual above-64-KiB success and above-512-KiB rejection remain **NOT_RUN in this checkpoint**; source and routing tests address the reported admission mismatch.
- `0030_m3_bounded_admission.sql` adds a conservative traversal check before full JSON projection, retaining the exact post-projection 250-node/1-MiB check. It rejects after the 251st eligible node or byte-budget breach, so a large valid graph cannot first expand all descendants. Service references count the minimal published service summary shape. Publication replay skips preflight and delegates to the original receipt path; it does not recreate a pointer.
- 0030 adds JSON containment and current pinned-reference eligibility before full M3 reverse-list projection, retaining the final projected-reference check. It does not add a raw candidate LIMIT, so sparse matches and cursor continuation keep their prior semantics. The lightweight private picker predicate checks the same current root eligibility and price's required service/location dependencies without expanding related graphs. Public projection remains the final authority.

**Actual query evidence inspected:** [before 0030](query-plans-1792148055342.json) and [after 0030](query-plans-1792148112184.json), each on 1000 owned published articles / two categories and current tenant-role RLS. The recorded sparse reverse entrypoint changes from **361.729 ms / 30,766 shared hits** to **16.919 ms / 3,909 shared hits** in these runs. This is point-in-time local evidence, not a latency guarantee. The candidate/substring scans and immutable published-site lookup still scale with matching data; no new index is justified solely by these fixtures. The earlier query appendix describes the pre-0030 source; the current picker uses `resource_eligible` and the current public cursor includes the reference prefilter.

R5/R6 are **SOURCE_REVIEWED, behavior closure pending**. 0030 source review identifies no new actionable finding. Root owns compile/apply, fresh integration and rendered size/withdrawal checks. The overall review and final source pin remain open until the released final source/build/trace evidence.

## Final integrated build / fresh M3 dependency assessment

**Verified — fresh audit:** the first sandbox native audit could not resolve the registry and returned DNSResolveFailed. The approved elevated read-only retry, `node_modules/.bin/bun --no-env-file audit --json`, reached the registry and returned **exit 1 / FAIL** with one high `braces@3.0.3` advisory, GHSA-vfj7-8cjw-p6xm. No dependency was installed or changed. The current [GitHub advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists affected versions through 3.0.3 and **no patched version**, checked 2026-10-16. The advisory concerns stack exhaustion from deeply nested brace patterns.

**Verified — current reachability:** native `bun pm why braces` reports one installed chain: root **dev** `eslint-config-next@16.4.1 → @next/eslint-plugin-next@16.4.1 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`. Dependency declarations and `bun.lock` are unchanged; root changes add M3 command aliases only. Repository ESLint/root-directory patterns are fixed source/configuration. M3 HTTP/query/content/media paths do not import this chain or pass their input to glob expansion. The final API output and Next server chunks have no advisory-chain name matches.

**Verified — final build traces:** **39** Next `.nft.json` files (**29 admin / 10 website**) reference **1236 unique existing files**, with **0 advisory-chain path/name hits** and **0 missing traced files**. The integrated build and lint logs completed successfully, consistent with root's exit-0 report. The checkpoint in `review-source-pins.json` pins the lockfile, reviewed changed application/scripts, build/lint logs and all 39 trace files. An untraced/dynamic runtime dependency remains outside what a trace scan can prove; source/installed-chain inspection provides the separate supporting check.

**Fresh M3 bounded local assessment:** continued approved local M3 verification is supportable under a new M3-specific deferral because the audited chain is development-only, inspected lint patterns are trusted repository configuration, current M3 input does not reach the chain, and the chain is absent from the final traced serving outputs. This assessment does **not** convert the audit to PASS, inherit M2's deferral, remove the advisory, or authorize Production/deployment. It does not approve processing attacker-controlled glob/configuration inputs. A source/dependency/build exposure change invalidates the affected assessment.

**Owner and reassessment:** root remains accountable for the open advisory. Reassess by **2026-10-22**, or earlier if a patch appears, dependencies change, input/runtime/build exposure changes, and **before Production**. No upgrade, global configuration or reminder automation was performed.

**R6 behavior closure — CLOSED:** the newer actual [post-0030 integration result](integration-checks-1792148189624.json) records core **8 tests / 274 assertions** and media **3 tests / 149 assertions**, **11 tests / 423 assertions, 0 fail, 0 skip**. Filtered raw pass lines agree. The added real-HTTP test uploads 40 private synthetic assets, saves a valid 20-pair gallery above 64 KiB, rejects a request above the M3 cap with redacted 413 JSON, and confirms the legacy service route retains its 64-KiB cap. Reviewer inspected these checks and did not rerun fixture mutations. R5 rendered withdrawal/canonical state and remaining final acceptance evidence are still pending; the overall review remains **IN_PROGRESS**.

## Rendered R5 closure / 0031 pagination source review

**R5 — CLOSED:** reviewer inspected [actual withdrawal record](ui/withdrawal.json) and `ui/s11-withdraw-canonical.png`. The saved screenshot shows **Bản nháp**, **Chưa xuất bản** and no live publication link after text withdrawal without page reload. The parent records normal password reauthentication with the same withdrawal reason retained. This closes the reported stale editor state for the owned case; the screenshot does not prove physical asset deletion.

**Other rendered evidence inspected:** [FAQ reuse](ui/faq-reuse.json) records child V2 preserving parent V1, explicit picker/save/parent-publish adopting V2, and a second parent retaining V1. [CMS matrix](ui/full-cms-matrix.json) records all 11 editors and location/price/gallery/article geometry at 320/390/768/1024/1440. Reviewer visually inspected the final gallery 390 and location 1440 screenshots, plus the withdrawal screenshot. These are representative local observations, not universal visual/accessibility acceptance.

**404 repair — source and actual HTTP checked:** the removed `apps/website/app/[tenant]/loading.tsx` was created within M3. Removing that early streaming boundary lets the awaited route's `notFound()` determine the response status. The current [read-only result](readonly-checks-1792149048150.json) has **63 PASS / 0 FAIL**, including real missing-resource and withdrawn-resource **404** results, no-store and scoped media/secret/checksum probes. This is actual anonymous HTTP/HTML evidence; it is not a JavaScript-disabled browser session or Production proof. The original M2 files were preserved.

**Root-identified R7 / 0031 — SOURCE_REVIEWED:** the complete list DTO, including Published site metadata and continuation cursor, now has a 1-MiB budget. SQL builds only eligible cards and stops before appending the first over-budget card. That excluded card remains after the last returned ID. API continuation uses the last **returned** ID for both short byte-limited pages and normal lookahead pages. It strips internal `budgetLimited`/`hasMore` fields, then checks the exact serialized byte size again. If the first card cannot fit, the function fails explicitly rather than looping on an empty continuation page. No raw candidate limit or last-examined skip was introduced.

0031 also checks the exact service-links DTO, including repeated location names/addresses, at snapshot admission and public delivery. Existing reference generation/current eligibility remains in the resolver. Source review identifies no new actionable pagination issue. The 600-byte cursor reservation matches `decodePageCursor`'s actual wire bound. **Pending actual proof:** traverse 20 large FAQs over byte-limited pages; assert every expected ID exactly once, each response ≤1 MiB, no internal signals, final cursor null and a readable final page. 0031 was not yet applied when this source review began.

**Website reverse discovery:** resource kind/ID now finds all currently eligible pins after a child republish; an optional exact publication-ID filter remains available. Directed embedded publication pins and intake source publication identity are unchanged. Pure current website/permission checks: **17 tests / 70 assertions PASS**. No new actionable source issue was identified in the 404/reverse repair.

Latest website source/traces are repinned below through the JSON checkpoint. The fresh M3 advisory result is reused because dependency declarations/lockfile are unchanged; changed website source and rebuilt serving traces were re-inspected for exposure. Overall review stays **IN_PROGRESS** for 0031 actual integration, the location-retention seam and final integration/state evidence.

## Latest actual behavior / R8 permission reachability

**R7 — CLOSED:** [post-0031 actual integration](integration-checks-1792149362121.json) records core **11 tests / 458 assertions** and media **3 tests / 149 assertions**, total **14 tests / 607 assertions, 0 fail, 0 skip**. Reviewer inspected the new real-HTTP 20-large-FAQ traversal: each complete DTO is at most 1 MiB; short pages have continuation; decoded continuation equals the last returned ID; changed page-size context rejects; all 20 expected IDs occur exactly once; traversal ends with a null cursor. Internal signals are absent. Reviewer did not rerun fixture mutations.

**Location-retention seam — VERIFIED within the owned local test:** the same actual suite accepts two new synthetic location-bearing leads and verifies both administrators read the selected snapshot. It adds a private note, extension receipt, delivery and the explicit S06 lead allowlist. Real retention worker execution records private-data-free notices, makes the expired selected lead unreadable, then removes its rows from all ten asserted lead-dependent tables. The deletion decision contains only its five approved metadata fields; audit/capture checks contain no test contact/message/note/location details. The expired but unallowlisted lead remains byte-for-byte unchanged. This proves the tested local deletion graph, not recovery from backup or Production retention operation.

**Rendered journey/state evidence inspected:** [location intake journey](ui/location-intake-journey.json) records the human-solved fresh CAPTCHA, accepted frozen request, and normal A1/A2 login read of the same single lead and East location. An expired challenge was rejected before the successful fresh attempt. [State evidence](ui/states.json) records denied-tenant clearing, actual owned-launcher outage and Enter retry recovery, public continuation and empty results. [Unpublish/republish](ui/s09-unpublish-republish.json) records explicit identity confirmation/password reauthentication and public denial before deliberate republish. These are root's actual bounded browser records; reviewer did not independently repeat browser mutation.

**R8 — P2, OPEN: older still-authorizing permissions are unreachable from the CMS.** `apps/api/src/modules/content.service.ts:65` returns only the newest 200 permission rows. The GET controller at `content.module.ts:21` accepts no paging query; `ContentPermissions` at `contracts/m3.ts:55` has no continuation. `apps/admin/components/content-permissions.tsx:23` replaces the list with that fixed first page, and line 37 renders withdrawal/retry controls only for returned rows. Neither content history nor the current scope selector exposes an old permission ID.

**Source reproduction:** retain an eligible Published V1 (including a parent that pins V1), then record more than 200 newer grants on subsequent saved revisions. A gallery can add 41 text/image scopes per revision, so five later full revisions can move all V1 grants beyond the fixed cutoff. The old grant still authorizes V1 but the administrator cannot select that grant for its intended resource/revision/scope withdrawal or retry. Reviewer runtime reproduction is **NOT_RUN**; the bounded query and absent continuation are directly verified source facts. Whole-resource unpublish and global media withdrawal are broader actions and do not replace the missing per-permission action.

**Proposed bounded repair:** add tenant/resource-bound keyset pagination with a stable `(granted_at,id)` descending order and a bounded page size, then expose older rows in the CMS. Refresh/purge polling must preserve or refetch loaded older rows and the selected permission; keep the R5 canonical draft refresh and unknown-outcome guards. Do not remove the bound or use active-only truncation, which still hides grants when more than 200 remain active. Add a real test with an old active grant behind more than 200 newer grants, then reach and withdraw it through the paged API and verify public denial; add the CMS older-page/reload behavior check. An order-supporting index is a measured implementation choice, not an automatic review requirement. Parent was notified immediately. Overall review remains **IN_PROGRESS** for R8 and affected final source/build evidence.

**Current final-check checkpoint:** reviewer checked the latest actual raw suite pass/count lines, successful post-build typecheck and final lint/build logs. [Latest read-only checks](readonly-checks-1792149661343.json) record **68 PASS / 0 FAIL**, adding HEAD status/no-store cases to the earlier 63 checks. Current diagnostic listener ancestry and six endpoint checks pass in [final diagnostics](final-diagnostics.json). Reviewer visually inspected the accepted intake, A2 single-lead/East-location and public gallery 390 screenshots. Current **39 Next traces** resolve **1235 existing paths: 1221 regular files and 14 package directories**, with **0 missing paths and 0 advisory-chain hits**. Earlier `uniqueFiles` trace counts included those existing directories; this checkpoint makes the distinction explicit. Fresh M3 audit remains **FAIL/open** under only the stated bounded local assessment. The source/trace checkpoint preserves R8 OPEN and is not a final closed review pin.

## R8 API release — source reviewed, actual behavior pending

**Verified source:** the private permission GET now returns `{items,nextCursor}`, defaults to 50 and caps pages at 100. Its cursor binds tenant/resource/kind/page size. PostgreSQL formats the timestamp in UTC with all six microsecond digits; the compact cursor preserves those digits without deriving the anchor from a JavaScript Date. The query uses the matching `(granted_at,id)` descending tuple and a bounded lookahead. The singleton GET checks current tenant membership and resource/kind identity before reading one grant. Permission mutations return `{operationId,replayed,permission}` for the affected grant independently of its history page. The existing database command/receipt remains authoritative for the mutation and replay.

**Verification:** reviewer ran `node_modules/.bin/bun --no-env-file test apps/api/test/m3-content.test.ts apps/api/test/m3-request.test.ts`: **9 tests / 50 assertions PASS**. Reviewer inspected the new actual-test source, which creates 205 genuine saved revisions/text grants while V1 stays published, traverses every grant in exact DB order, compares cursor timestamps to PostgreSQL's full precision, rejects context changes, and withdraws the oldest grant through its returned ID with public denial and receipt replay checks. The separate browser fixture follows the same genuine command path and records a new owned resource. Neither fixture nor the integration suite was executed by this reviewer; root's new real integration/browser evidence is still pending. No new actionable API source finding. R8 remains **OPEN** until the CMS repair and affected real behavior are reviewed.

**Root runtime-check source:** `scripts/m3-runtime-checks.ts` verifies the selected Bun version/cwd/opt-in, owned launcher command/cwd and children, one loopback listener per manifest entry, bounded listener ancestry and the actual listener executable. It checks six HTTP statuses, absence of session cookies, and exact health/ready bodies. Other diagnostic/error JSON bodies are parsed but not exact-compared. No actionable source finding; the recorded point-in-time diagnostic scope and all-error-flow limit remain appropriate.

## R8 CMS release — source reviewed, actual behavior pending

**Verified source:** older permission pages append and deduplicate by grant ID. A confirmed command upserts its affected grant while retaining older loaded rows and the continuation. Canonical draft refresh keeps the same resource-keyed permission panel. Manual **Làm mới quyền** restarts the head continuation while retaining older loaded rows; later pages can overlap and deduplicate, but older grants remain reachable. This is a live-list refresh, not a snapshot guarantee.

The panel aborts page/singleton requests and advances a read generation before each mutation. Delayed prior reads cannot overwrite the authoritative mutation. The record merge also prevents a withdrawn grant from becoming active due to an older unwithdrawn record. Pending purge polling reads pending loaded grant IDs through the singleton endpoint, with at most three concurrent reads and a 15-second request-group timeout. Cross-revision asset refresh matches both asset ID and asset revision. Read errors retain loaded rows; current authorization denial clears private rows. Existing reason/reauthentication/unknown-outcome and R5 canonical draft behavior are retained.

**Verification:** reviewer ran `node_modules/.bin/bun --no-env-file test apps/admin/lib/permission-pages.test.ts apps/admin/lib/content-permission-refresh.test.ts apps/admin/lib/content-permission.test.ts`: **10 tests / 31 assertions PASS**. This covers pure merge/preservation and cursor behavior, not React/network scheduling. No new actionable CMS source finding. R8 is **SOURCE_REVIEWED**, with actual 205-grant API traversal, rendered older-grant withdrawal/polling, final build and refreshed trace evidence pending root. Overall review remains **IN_PROGRESS**.

**Actual R8 API checkpoint:** [latest actual integration](integration-checks-1792150310599.json) records **core 12 tests / 1360 assertions + media 3 tests / 150 assertions = 15 tests / 1510 assertions, 0 fail, 0 skip**. Reviewer checked the corresponding raw pass/count lines, including the genuine 205-grant oldest-withdrawal test. The released API/CMS source hashes remain unchanged. Root's full FE log records **106 tests / 372 assertions across 30 files, 0 fail**; current full lint exits successfully. The first browser-fixture invocation refused before setup because the required explicit integration flag was missing; root reports the corrected explicit invocation in progress. R8 browser behavior and final rebuild/traces remain pending, so the overall review stays **IN_PROGRESS**.

## R9 — P2, OPEN: a pending image removal hides historical permission controls

**Verified source:** `apps/admin/components/content-editor.tsx:65` mounts the permission panel for doctor/article only if the current saved draft has an image. An eligible Published V1 can still contain its earlier image after a pending V2 saves `image:null`. For a patient-derived image, the V1 resource/asset grant remains an authorization dependency, but the CMS now offers no resource permission history or withdrawal/retry control. This violates the same revocation-reachability invariant as R8 with only two revisions; pagination does not resolve the hidden panel.

**Proposed bounded repair:** mount permission history for all five permission-capable kinds (case/gallery/testimonial/doctor/article), independently of current draft media. The grant form and current-scope status must safely handle zero current scopes: `contentPermissionScopes` returns an empty list for doctor/article `image:null`, while the current panel's `scope.scope` access assumes a scope. Keep older image permission rows and their withdrawal/retry controls visible. Verify a published doctor/article image remains eligible after saving a no-image draft, then revoke its historical scope from the CMS and observe public image denial. Reviewer runtime reproduction is **NOT_RUN**; the parent mount predicate, empty scopes and pending-publication invariant are source-verified. Parent was notified immediately. Overall review remains **IN_PROGRESS** for R8 actual browser closure and R9.

**R9 repair — SOURCE_REVIEWED:** the released parent now uses `supportsContentPermissionHistory` for all five kinds independently of media. `contentPermissionSelection` returns no selected scope for an empty or stale selection. Status lookup and submission guard that result; a zero-scope draft explains and disables new grants while retaining historical withdrawal/retry and older pages. Evidence/reason clearing is explicit, so a preserved value does not make the historical controls permanently unreachable. The single M3 permission mount and remaining row/current-scope/disabled conditions were checked for analogous hiding; no further actionable issue was identified. Reviewer reran the three affected pure suites: **13 tests / 51 assertions PASS**. This adjacent R8 reachability repair retains report identifier R9; it adds no new feature scope. Actual doctor/article pending image-removal/withdrawal behavior, R8 older-grant browser behavior and rebuilt outputs are still pending root.

## Final source and scoped behavior closure

**R8 — CLOSED:** [actual browser history](ui/r8-permission-history.json) records initial 50 rows, four older-page loads reaching 205 unique rows, oldest V1 selection, normal password reauthentication with reason preserved, withdrawal with immediate canonical unpublished state, and all 205 loaded rows retained. Reviewer inspected both saved old-row screenshots: the withdrawn V1 reason remains visible, then singleton polling changes its purge state from pending to completed without reload. The [bounded owned-tenant worker record](r8-content-worker-checks.json) records 11 calls, 10 completions and final idle, with zero copied objects. That is resource delivery invalidation, not global physical purge. The anonymous post-withdrawal case returns **404/no-store** in [final revocation checks](revocation-anonymous-final.json).

**R9 / adjacent R8 invariant — CLOSED:** [actual doctor/article browser record](ui/r9-image-history.json) and both inspected screenshots show historical V1 image permissions on saved V2 `image:null` drafts, safe disabled new-grant controls, and successful historical withdrawal. The final native regression creates a generated PNG classified `patient_derived`, processes it with the real native media worker, requires separate doctor/article resource grants, then keeps their V1 publications active after no-image draft saves. After each scoped withdrawal, the page remains public, projected image/media/alt disappear and the old resource URL returns 404. The sibling article still delivers the same asset after doctor withdrawal; the global asset remains ready and unwithdrawn. Immutable publication content retains its original asset ID. Reviewer inspected the new helper/fixture/test source and actual raw pass lines. The [final anonymous checks](revocation-anonymous-final.json) agree for both browser resources.

**Final reviewed checks:** [actual API/native integration](integration-checks-1792150656431.json) is **12 core tests / 1362 assertions + 4 media tests / 235 assertions = 16 tests / 1597 assertions, 0 fail, 0 skip**. Root's final FE log is **109 tests / 392 assertions across 30 files, 0 fail**; the [bounded unit runner](unit-checks-1792150857615.json) is **30 tests / 128 assertions, 0 fail, 0 skip**. These suites overlap and are not added together. Final build, lint and post-build typecheck logs succeed. The root demo caller now consumes and validates the affected permission command result; source review found no actionable issue. Its existing-owned early-return command was checked by root with `reset:false`; its grant-provisioning branch was **NOT_RUN after that caller repair**.

**Final preservation/runtime evidence inspected:** [retained-data comparison](preservation-1792150937419.json) passes for **50 tables / 210406 baseline rows / 894 protected files**, with no unexpected failure. The one non-PASS file label is the explicitly permitted launcher metadata change. [Current runtime diagnostics](final-diagnostics.json) pass three actual Bun listeners and six cases. The location deletion graph, private-output checks, permission/concurrency/invalidation, sparse reverse-query measurements and representative responsive/browser limits retain the specific earlier evidence boundaries.

**Final fresh M3 exposure reassessment:** current **39 Next traces (29 admin / 10 website)** resolve **1235 existing paths (1221 regular files / 14 directories)** with **0 missing paths and 0 advisory-chain references**. Final API output and Next server JavaScript have zero advisory-chain name matches. App dependency manifests and `bun.lock` match the fresh audit pins; root `package.json` changed only M3 script aliases and its dependency declarations are unchanged. The fresh native advisory result remains **FAIL/high `braces@3.0.3`**; no inherited M2 waiver or audit PASS is claimed. The M3-specific bounded local assessment remains supportable on the inspected trusted development-only inputs and final serving outputs. Root must reassess by **2026-10-22**, earlier on patch/dependency/input/runtime/build exposure change, and **before Production**.

**Conclusion and limits:** no open actionable P1/P2 source finding remains in this bounded review. Final application/scripts/test/build evidence is released in the last [source-pin checkpoint](review-source-pins.json); mutable shared coordination documents are excluded. A relevant source, migration, contract or serving-exposure change reopens only its affected review. Root retains final package records and human handoff. Reviewer did not rerun mutating database/browser fixtures; those conclusions use the inspected root actual evidence. Backup restore, Production, full-MVP operation and comprehensive accessibility/load/all-error-flow testing remain **NOT_RUN/Unknown** within this review. The user controls human acceptance and TechNote level progression; silence grants no approval.
