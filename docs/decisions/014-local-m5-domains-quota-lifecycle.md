# ADR-014 — Local M5 domains, quotas and tenant lifecycle

Status: accepted decisions under Khiêm's direct M5 v0.1 approval on2026-10-16. The [complete plan, recommendations and execution authority](../tasks/GCMS-M5-001.md) govern S16–S18. This ADR records settled decisions; verification and human acceptance are separate. No Git delivery, Production, live DNS/TLS or global configuration authority follows.

Local implementation is now [ACCEPTED_UNDER_DELEGATED_AUTHORITY](../tasks/GCMS-M5-001.md#delegated-m5-acceptance--2026-10-17) under Khiêm's direct review/acceptance delegation. This does not alter the decisions or verification limits recorded here.

## Context and decisions

M5 completes the local Bun modular monolith. Both public entries resolve one tenant/site/publication/configuration/media graph and one lead list. Platform-only authority never grants tenant-private access or permission to choose a tenant's primary URL.

| Decisions | Resulting contract |
| --- | --- |
| S16-D02 | Exact ASCII hostname, distinct `www`, no wildcard/IP/port/scheme. A verifier returns evidence bound to tenant/site/binding/host/generation and time. The local adapter requires owner-enrolled, expiring `.localhost` attestation; client JSON cannot manufacture ownership or TLS evidence. Synthetic TLS eligibility is not a real certificate check. |
| S16-D03 | Current same-tenant active admin, five-minute password reauthentication, expected versions and a stable operation ID protect activation. A transaction rechecks current publication, binding and evidence. Receipt retry returns current state plus the original receipt; it cannot resurrect an old binding or reverse a later primary choice. |
| S16-D04 | Eligible same-locale page aliases return a direct301 for GET/HEAD. Missing EN returns one direct302 to eligible primary VI. Missing, revoked or unpublished resources remain unavailable; no homepage catchall. API/admin/preview/media/intake POST retain dedicated contracts. |
| S16-D05 | Reverify invalidates the current generation until explicit verification. Removal/re-registration creates a new binding identity. Replacement is explicit. Manual return to Godent warns about cached301; an eligible old custom entry serves200 with Godent canonical/navigation. Outage does not flip primary. |
| S16-D06 | Redirects retain existing allowlisted `utm_source`, `utm_medium`, `utm_campaign` and declared functional query semantics. Canonicals omit tracking. No new analytics collection is introduced. |
| S17-D01–D03 | Manual logical `content_items` and actual stored/reserved `media_bytes`; no lead/location-branch/member/locale quota. Explicit unset/monitor/enforced modes, no commercial defaults. New tenant policy precedes invitation. DB admission, stable resource identity, reservations and storage acknowledgments protect concurrent growth and retry. Lowering a limit preserves existing data; unpublish/withdrawal alone does not free stored capacity. |
| S17-D04 | Suspended tenants lose public delivery/intake/business writes. Current members retain authorized private reads/export and narrowly validated, reauthenticated unpublish/permission/global-media withdrawal. A caller-set session variable cannot grant generic safety mutation. |
| S17-D05 | Stream ZIP32 with25JSONL datasets, optional currently authorized media and a final completion manifest. Each batch rechecks access. Incomplete/revoked downloads have no completion manifest. This is a business export, not a point-in-time restore backup. |
| S17-D06–D07 | Tenant Admin requests and explicitly confirms all active tenant business data; Platform separately executes after mandatory request-specific `executeAfter`. Different people are not mandatory. Revocation/regrant invalidates confirmation. Cancellation ends before irreversible execution. No scheduler/default grace period. Local minimal tombstone has no automatic TTL. |
| S17-D08 | Explicit reactivation rechecks readiness. It does not republish, regrant, change primary, extend retention or dispatch old notifications. |

## Boundaries and failure handling

`gcms_m5` owns quota ledgers, lifecycle metadata/receipts, deletion object checkpoints, domain bindings/evidence/primary/history and positive worker scope. Existing modules keep their own business data. Restricted-role functions and FORCE RLS enforce current reads and writes, including older publication/media/lead seams. Deleting fences private reads, export, intake/replay and workers before cleanup starts.

The execute-only lifecycle worker holds a tenant lock, lease/fence and per-asset storage lock. Actual DELETE plus confirming HEAD precedes the object checkpoint. Lost acknowledgments retry idempotently; stale fences cannot checkpoint. Explicit module cleanup removes immutable business snapshots only under the confirmed cleanup capability. Original audit records and365-day policy, global users/accounts/credentials and other tenants are retained. Minimal tombstone survives; operational backups and copies outside controlled storage are separate.

Public URL context pins primary revision and entry binding identity/generation. Proxy input strips caller-injected context, cookies, authorization and forwarded trust hints. URL consumers use absolute validated primary URLs. Installed Next16.4.1 requires the app-local raw-path flag and loopback internal rewrite to avoid URL normalization turning an internal rewrite into an external redirect. No new shared-origin admin session policy is introduced.

## Migrations and trade-offs

Forward0051–0058 add quota/lifecycle/domain schema, narrow read/safety fences, protected local attestation, root canonical and fresh readiness response. Applied migration bytes/checksums remain immutable. No startup or migration dispatches a worker. Original0035 EOF whitespace finding is historical and is preserved.

Owner enrollment makes local proof reproducible without live DNS/TLS and cannot prove Internet readiness. DB locks favor correctness over speculative throughput; local concurrency tests do not establish Production capacity. ZIP streaming bounds memory and stops after lost authority, but batches are not a globally consistent database snapshot. Deliberate confirmation/fencing makes deletion recoverable by retry, not reversible by rollback after storage effects.

S18 reuses still-valid M1/AUTH/M2/M3/M4 evidence and verifies changed integrations. The current task/evidence ledger records actual results and historical failures. Audit `braces` remains FAIL/open with a fresh bounded M5 assessment, reassess2026-10-22 or earlier patch/dependency/exposure triggers and before Production. No Production waiver. AC-09, real DNS/TLS, external delivery, operational backup/restore, natural waiting and Production scale/SLO remain separate.
