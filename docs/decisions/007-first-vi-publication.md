# ADR-007 — First local VI service publication

**Current authentication policy — superseded in part by [ADR-010](010-password-only-mvp.md) / [approved AUTH v0.1](../tasks/GCMS-AUTH-001.md),2026-10-16.** Both roles use verified email+password; mandatory MFA/TOTP/backup requirements (ADR-006 D06/D07) are superseded. Sensitive actions retain5-minute password-only reauth,8-hour sessions/current roles/membership/RLS and existing lifecycle/last-admin controls. Legacy encrypted factors stay inert; one-time all-session/reauth cutover is approved, no old-token restore. Implementation IN_PROGRESS; runtime/UAT results not yet reported. The body below is retained historical policy/approval/evidence, not current MFA authority; old human acceptances/FAIL/NOT_RUN are unchanged. Saved publication, lead access/retention and worker semantics otherwise remain. No production claim.

## Historical record retained

## Status and date

**Accepted S03-D01–D06; local implementation IN_PROGRESS.** Recorded 2026-10-16, Asia/Ho_Chi_Minh. Khiêm directly approved [S03 v0.1](../tasks/GCMS-S03-001.md) in desktop conversation `01a1402c-3c81-7933-9927-d974f70c9fbc`:

> Duyệt S03 v0.1 và S03-D01–D06. Lưu kế hoạch, cập nhật nghiệm thu S02 rồi triển khai S03 trong phạm vi local đã đề xuất, gồm migrations, fixtures và kiểm chứng. Chưa commit/push hoặc deploy.

The preceding direct human **“Đã nghiệm thu S02.”** establishes S02 HUMAN_ACCEPTED. This ADR records approved S03 decisions; it does not change historical S02 NOT_RUN checks into PASS. S03 is not human accepted. S04–S18, production, real data/external email, destructive resets, global configuration, paid services, commit/push and deployment remain outside current authority.

## Context

S02 provides current membership/session authorization and private plain-text VI drafts. The next usable flow is the same tenant administrator saving, privately previewing and explicitly publishing one VI service page. The public page must remain on the current eligible publication while an administrator saves a pending draft. Existing resources, identities, authentication factors and draft content must survive additive migration.

## Decision

| ID | Approved bounded behavior |
| --- | --- |
| S03-D01 | Minimum content-first public layout: site name, title, summary, rich text and footer. Introduction and rich-text sections only. No simulated lead CTA/form, images, doctors or prices. Full two-theme/shared-schema builder remains S13. |
| S03-D02 | Local URL `http://localhost:5892/<tenant-slug>/dich-vu/<service-slug>`. Unique tenant registry, reserved namespace and lower-case ASCII validation. Same-tenant administration only; slug locks after first publication. Reject invalid Host/path/context. Later slug/domain lifecycle remains separate. |
| S03-D03 | Title at most 160 characters and visible body text at most 20,000. Summary/SEO and bounded paragraphs, H2 headings, lists and validated links; no arbitrary HTML/scripts/embeds. Preserve S02 content/line breaks/versions and render literal HTML as text during safe conversion. |
| S03-D04 | Publish the saved draft only; dirty input requires save first. Confirmation identifies tenant/service/VI/revision. Recheck current membership/permission and reauthentication within 5 minutes. Stale versions reject with conflict while the editor preserves input. |
| S03-D05 | Current-eligible immutable SSR, no-store and no Redis queue/cache. Atomically persist snapshot, pointer and durable delivery intent. Same request key/payload replays the result; changed payload rejects. Rollback/retry must preserve one consistent publication. Do not report fictional purge completion. |
| S03-D06 | Absolute canonical from the validated local base and actual published VI language; local noindex. SSR HTML contains metadata without JavaScript. No false EN alternate, DNS/TLS/indexing/ranking claim. |

The canonical implementation contracts and bounds are [S03 API types/routes](../../apps/api/src/contracts/s03.ts) and [content validation](../../apps/api/src/contracts/content.ts). These source files define the structured document and expected draft/site/publication versions; their existence is not runtime proof. Preserve the [approved v0.1+Lucide editor reference](../design/admin-mockup/approved-baseline.json). Remove prototype-only controls/data when wiring real API data.

Snapshot closure pins the used service/site/footer/SEO/VI versions; mutable draft reads cannot supply later content to an old publication. Current eligibility overrides immutable history. Wrong-tenant, platform-only, inactive/revoked actors cannot publish or preview private content; suspended tenants cannot publish or deliver public pages. Full unpublish/restore/history UX is S08, media is S07, catalogs are S09–S12, localization is S15 and custom domains are S16. These deferrals do not waive current-public denial.

## Alternatives and consequences

Publishing on save was excluded because it would expose unfinished edits. Reading mutable drafts in public SSR was excluded because a saved V2 draft could silently alter published V1. Redis queues/cache and full themes/catalog/media were deferred because the first bounded publication flow must work without those additional systems. No-store avoids introducing a cache invalidation claim; durable intent still needs actual failure/retry evidence and must not be labeled a successful purge.

The existing S02 checksum/lock/migration runner applies new ordered migrations; a separate reset or replacement database is not required. The S03 alias intentionally retains the S02 runner/flag and restricted migration-role configuration. Preserve existing rows and credentials. Forward migrations, private fixtures and focused tests do not authorize resource deletion or production migration.

## Verification and limits

**Verified within supplied evidence:** [legacy preservation](../evidence/s03/draft-preservation.json) compares all 13 retained drafts on ID/tenant/title/body/locale/version. [Representative browser checkpoint](../evidence/s03/ui/representative-flow.json) uses an existing legitimate A1 session to create/save/reload/private-preview real VI content, including H2/list/literal-script rendering, at 1440×1080 and 390×844. It does not execute a fresh login or publication. [Combined API/unit results](../evidence/s03/combined-api-checks.json) record two passing suites; their scope excludes browser, OS process restart and human acceptance.

**Pending / NOT_RUN at this documentation checkpoint:** final public SSR/browser publish and reauthentication flow, remaining UI widths/keyboard/states, OS process restart durability and final independent security review/integration. The coordinator owns current execution evidence and final acceptance status in [S03](../tasks/GCMS-S03-001.md). Source, screenshots and API tests do not prove those pending behaviors.

## Sources

- [Approved S03 plan, decisions, ownership and acceptance](../tasks/GCMS-S03-001.md)
- [S02 acceptance and historical evidence](../tasks/GCMS-S02-001.md)
- [Architecture](../architecture.md), [access control](../access-control.md), [workflows](../workflows.md), [local runbook](../local-development.md)
- [ADR-004 primary URL policy](004-primary-url-and-301-redirects.md), [ADR-005 local MVP/fallback](005-local-mvp-and-content-fallback.md), [ADR-006 account/session decisions](006-local-account-session.md)
