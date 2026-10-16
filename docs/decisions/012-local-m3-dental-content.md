# ADR-012 — Local M3 dental content and scoped publication

Status: accepted decisions under Khiêm's direct M3 v0.1 approval on 2026-10-16. The [complete plan and approval](../tasks/GCMS-M3-001.md#current-authority-and-ownership) is the authority. This record grants no additional scope. M1/AUTH/S01–S08/M2 acceptance and their proof limits remain unchanged; M3 S09–S12 is [HUMAN_ACCEPTED](../tasks/GCMS-M3-001.md#human-m3-acceptance--2026-10-16) within local scope; technical evidence and all historical FAIL/Unknown/NOT_RUN remain unchanged. Acceptance adds no runtime or Production proof.

## Context and decision

Dental Content extends the existing Bun modular monolith with eleven VI content kinds: specialty, service group, location, doctor, price, case, gallery, testimonial, article, category and FAQ. Existing service/site publishing, private Media and shared Leads keep their ownership. No clinical review state, child tenant, location permission, booking engine, external delivery or new infrastructure is introduced.

| Approved decisions | Behavior |
| --- | --- |
| M3-D01–D06 | Draft → Published; saved private preview/history; restore creates a draft; explicit publish alone changes live. Immutable reference pins and site snapshots remain subject to current tenant, publication generation and media permission. VI no-store SSR/local noindex; existing service snapshots and locked URLs remain compatible. |
| S09-D01–D04 | Flat specialties/groups, many-to-many service references, ordered selected related services. No guessed taxonomy backfill, self-reference, duplicates or cross-tenant references. |
| S10-D01–D03 | Locations are ordinary organization content; doctors are website profiles. Neither creates accounts, branch permissions or separate lead queues. No selected location means unspecified applicability. Credentials/attribution are supplied content, not verified clinical claims. |
| S10-D04–D05 | Exact/range/from prices use decimal strings and PostgreSQL exact numeric comparisons; 24 integer and 6 fractional digits. Explicit currency/unit and exactly one service. No floating-point conversion, invented zero or exchange rates. |
| S11-D01–D06 | Case/gallery/testimonial text and every image require resource/revision-scoped permission, including ordinary-classified images. An ordinary exemption remains only for nonpatient doctor/article images. Service-cover rights are not a wildcard. Text withdrawal blocks the resource; image withdrawal removes the image and its alt/caption, or the complete before/after pair. Restore never regrants rights. |
| S12-D01–D04 | Flat article categories, supplied attribution and ordered reusable immutable FAQ references. Saving or republishing a FAQ does not silently replace a parent's chosen publication. Unpublish invalidates old references; deliberate parent publication is required to adopt a new generation. |

## Data and integration boundaries

`gcms_m3` owns resources, revisions, publications, immutable reference pins, command receipts, scoped permissions and delivery-invalidation intents. Existing tenant authorization/FORCE RLS and tenant advisory locks protect commands. Expected versions, monotonic publication revisions, operation IDs and payload fingerprints protect conflicts and retry. Read models return bounded source-side pages (default20, maximum50) and context-bound cursors; cursor possession grants no authority.

Service content links use an explicit publication seam. Referenced published content keeps its pinned version while its current generation remains eligible. Unpublish/withdrawal overrides historical snapshots. Optional references are removed when ineligible; a required service or explicitly selected location applicability cannot degrade into an organization-wide price.

Permission history has its own bounded pages (default50, maximum100), ordered by exact UTC microsecond grant time and ID. Its cursor binds tenant, resource, kind and page size; singleton reads retain current authorization. Commands return the affected permission even when it is older than the first page. The CMS keeps loaded older rows/cursor through canonical refresh and singleton purge polling; stale pre-mutation reads cannot restore active status. Doctor/article permission history must remain accessible when a newer pending draft removes its image, because an older published revision may still use that image. Empty current scopes prevent a new grant, not historical withdrawal or retry.

An optional location on consultation intake is validated against the current eligible service context and stored as a minimal snapshot on the existing lead row. No selection keeps the original fingerprint semantics. The location snapshot follows that row through S06 deletion; no parallel private copy is introduced. All authorized same-tenant administrators retain the shared list.

Public graphs admit at most250 reference nodes, depth3 and1MiB expanded DTO. A conservative bounded traversal runs before full projection, followed by exact post-projection admission in the publication transaction. Complete list/service-links DTOs also stay within1MiB. A byte-limited list page resumes after its last returned resource; an excluded eligible item is reconsidered on the next page. Internal continuation flags are stripped before public serialization. M3 JSON commands have a bounded512KiB transport parser; other JSON endpoints retain64KiB. Media uploads retain their separate5MiB limits. A transport rejection keeps editor input; it is not a saved draft.

## Withdrawal and storage

Resource media routes bind tenant/resource/publication/asset/revision and recheck current eligibility. Originals and derivatives remain private. Resource-scoped withdrawal durably schedules **delivery invalidation**; this no-store design owns zero copied HTML/media objects per resource. Its completed status does not claim physical deletion. Global Media withdrawal separately blocks all uses and purges actual derivatives, retaining the existing60second delivery and5minute purge targets and pending/failed/retry/fencing contracts.

Workers require an explicit positively enrolled M3 tenant scope. API startup/migration does not dispatch existing S04/S05/M2 backlog. Applied migrations through0031 are immutable;0030 adds bounded preflight/reverse candidate filtering and0031 adds complete DTO/list continuation bounds. New fixtures have private ownership manifests and synthetic identities/content only. Preservation hashes compare retained original-column row projections, private file modes/hashes and protected historical evidence; they are not a backup/restore test.

## Trade-offs and verification

The local solution uses the existing database and private S3-compatible storage, without a broker, cache or extra service. The conservative admission budget can reject a graph before the final exact DTO limit; this bounds construction cost and leaves the prior publication intact. Substring search remains bounded source-side scanning with stable pagination; representative query plans and measured limits are retained in M3 evidence rather than claiming unmeasured scale.

Actual source, SQL/API, storage/worker and browser results are recorded in the [M3 execution ledger](../tasks/GCMS-M3-001.md#execution-ledger) and [evidence](../evidence/m3/). S13–S18, EN/theme/domain implementation, full MVP, operational backup/restore and Production remain outside this package. The braces advisory remains FAIL/open, with a fresh independently reviewed bounded local-M3 assessment and reassessment on2026-10-22 or earlier patch/dependency/exposure change and before Production.
