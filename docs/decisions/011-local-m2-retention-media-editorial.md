# ADR-011 — Local retention, media rights and editorial history

Status: accepted decisions under the direct approval of M2 v0.1 on 2026-10-16. [GCMS-M2-001](../tasks/GCMS-M2-001.md) contains the complete approved plan and provenance. This ADR records those decisions; it grants no additional authority. M2 is now HUMAN_ACCEPTED within approved local scope; the [human acceptance append](../tasks/GCMS-M2-001.md#human-m2-acceptance--2026-10-16) records the direct source. Technical CODE_INTEGRATED + VERIFIED_LOCAL and all historical FAIL/Unknown/NOT_RUN limits remain unchanged; no new runtime proof, S09–S18 execution or commit/push/deploy authority follows.

## Context and decision

S05 lead operations and S03 publication remain the owning capabilities. M2 adds retention, an optional VI service cover, and editorial history through their explicit contracts. It retains Bun, PostgreSQL transactions, the existing local S3-compatible service, two administrator roles, password-only authentication and current tenant authorization. No broker, Redis cache, mandatory clinical gate, real email or production topology is introduced.

| Approved decision | Settled behavior |
| --- | --- |
| S06-D01 | Last substantive contact plus180days; creation if none. Closed expiry is the earlier of close+90days and activity+180days; spam adds an earlier30day limit. Views, notes, assignment, status, reopen and retry do not renew activity. Notice begins7days before expiry and cannot postpone deletion. |
| S06-D02 | An authorized current tenant administrator may explicitly extend before expiry with reason, future expiry, expected version, operation ID and password assurance within5minutes. Effective expiry is max(normal deadline, explicit extension). No new maximum extension period is selected. |
| S06-D03 | Retention notices address all currently eligible tenant administrators, including authorized suspended-tenant read access. These recipients are separate from S05 intake notification settings. Private capture contains no client name/contact/message or lead identifier. |
| S06-D04 | Current expiry precedes reads and operation replay. Browser deadlines are derived from serverTime/validUntil and request start; expired detail, list/count/badge, history, comparisons and unsaved input are cleared. A restricted positively scoped worker deletes the complete private graph transactionally. A minimal deletion identity prevents stale restored-row resurrection. Audit expiry remains365days. Deletion-identity retention and operational backup retention/recovery remain D5 decisions; no new periods are invented. |
| S07-D01 | Upload accepts JPEG/PNG/WebP at most5MiB; static single frame, at most16MP and8192px per edge. SVG and remote import are excluded. Server sniffing and full decode/re-encode determine acceptance; filenames never select storage keys. |
| S07-D02 | Original/quarantine and metadata-stripped WebP derivatives are private. The native decoder receives stdin bytes only, with no network, credentials or private mounts; readonly filesystem, nonroot,384MiB memory/swap,1CPU and64PIDs. Output is capped and errors cannot become ready assets. |
| S07-D03 | Ordinary material has no invented clinical review. Patient-derived material requires an explicit service_cover permission record and evidence reference. An optional service cover carries asset ID, revision and alt text through save, private preview and publication. |
| S07-D04 | Private access is same current session/tenant and signed for at most60seconds. Public bytes require a current eligible active publication reference and current media eligibility. Anonymous direct storage access is denied. |
| S07-D05 | Withdrawal immediately revokes delivery and filters cover reference/alt from public closure. Already started controlled delivery is bounded to60seconds. Derivative purge targets5minutes and exposes pending/failed/retry; original retention is not selected here. History or restore cannot regrant media rights. |
| S07-D06 | Narrow worker functions, leases, fences and asset I/O locks prevent stale completion or purge racing late writes. Unknown decoder settlement durably fails the job and blocks further native work for that tenant. A private recovery receipt maps the job to the exact acknowledged container ID/name/nonce; no generic retry clears the latch. Purge remains possible because the isolated decoder has no storage access. |
| S08-D01 | Immutable editorial revisions cover VI service and site name/footer. Existing rows receive an honest baseline; overwritten pre-M2 drafts cannot be reconstructed. Lists are scoped and paginated. |
| S08-D02 | Restore creates a new versioned draft and receipt, never a publication or restored permission. Current locked routing, current actor and current media eligibility remain authoritative. |
| S08-D03 | Publication head separates the active pointer from monotonic publication counter and revision. Unpublish requires current rights, CSRF, recent password proof, expected versions and operation ID. Old publish/unpublish replay reports current activation without granting new access. Existing snapshots/intents and lead source references remain immutable. |
| S08-D04 | Explicit publish alone changes live content. Pending drafts and private preview remain separate. Public page and cover metadata share one PostgreSQL statement snapshot. SSR uses no-store and the controlled image gateway; no fictional cache-purge claim is made. |

## Integration repairs and trade-offs

Applied migrations0001–0014 remain unchanged. Forward0015–0022 and0024 add the M2 schema, backfills and observed SQL repairs; numbering0023 was reserved during diagnosis and was not needed. Every application verifies retained checksums and never starts a worker. Workers only process explicit new fixture scopes; S06 additionally requires an explicit lead allowlist. Retained S04/S05 backlog is not enrolled.

The actual Bun1.4.3 binding contract requires serialized JSON strings to pass through text before jsonb. SQLNULL remains distinct from JSONnull. Worker scheduling refreshes its clock after job creation; native settlement requires real daemon inspection rather than CLI exit alone. Timestamp DTOs preserve milliseconds.

Publishing skips already locked routing metadata. An initial lock records the current responsible actor. This satisfies the existing RLS write policy without rewriting an already locked site saved by another administrator, changing its content version, or fabricating an editorial revision.

Sharp0.35.5 is an exact direct API dependency; the existing package-version set is unchanged. The existing storage topology can serve the new M2 media bucket but has no free volumes for another collection. The denial-control bucket exists and rejects the scoped request; no successful object write into that control collection is claimed. Existing capacity/configuration was preserved.

## Evidence and limits

Actual results and historical failures live in [M2 evidence](../evidence/m2/) and the [execution ledger](../tasks/GCMS-M2-001.md#execution-ledger). Static checks, API/SQL, actual Docker/storage/worker, rendered browser, human acceptance and production are distinct. Controlled synthetic deadlines do not prove natural180/365day waiting or operational backup restore.

The high braces advisory remains FAIL/open. An independent fresh local-M2 exposure assessment retains the bounded local deferral: desktop reassessment on2026-10-22, or earlier patch/dependency/exposure change and before production. No production waiver, external delivery, DNS/TLS, Git delivery or deployment follows.
