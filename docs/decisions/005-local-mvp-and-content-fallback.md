# ADR-005: Local MVP, Vietnamese fallback and accepted product directions

## Status

Accepted for documentation under fresh direct human approval in [GCMS-DOCS-004 v1](../tasks/GCMS-DOCS-004.md), 2026-10-15, Asia/Ho_Chi_Minh. Supersedes conflicting current assumptions about missing translations, local service selection, unselected accepted policies and production readiness blocking local MVP. Prior ADRs remain historical and unchanged: [ADR-002](002-simple-tenant-cms.md)'s simple organization/admin/Draft–Published model and [ADR-004](004-primary-url-and-301-redirects.md)'s primary/301 policy remain, with fallback-specific SEO mechanics to define before localized implementation.

Documentation/static checks only. No application, Docker configuration/execution, dependency, service, fixture, DNS/TLS or Git action is authorized.

## Context

The human reviewed the remaining-decision advisory, corrected local versus production assumptions, accepted specific MVP directions and explicitly deferred production operating choices. “Approve” authorizes this documentation pass, not every recommendation in the preceding advisory. Account creation/recovery/MFA policy and the exact initial theme/section catalog remain open.

## Decision

- **Local services:** approved host endpoints are admin http://localhost:5891, website http://localhost:5892, API http://localhost:5890, Redis localhost:5889, PostgreSQL localhost:5888, S3-compatible API http://localhost:5887 and optional S3 console http://localhost:5886 only if the selected service offers one. Published host ports bind 127.0.0.1. Container traffic uses service names/internal ports, not an assumed equality with host ports. [Architecture](../architecture.md#local-docker-endpoints) is canonical; nothing was created or availability-tested.
- **Local session boundary:** different ports are different origins but cookies are not isolated by port. Session/CORS/CSRF contracts remain to engineer for separate local admin/API origins. No mandatory local reverse proxy/BFF is selected. The dedicated cms.godent.vn admin-origin proposal concerns production only; it is not configured or verified. Redis is explicitly selected locally; versions/cache/queue ownership remain unassigned technical contracts, without silently replacing PostgreSQL-backed jobs. S3 implementation/image/provider is unselected.
- **Bun:** preserve Bun/TypeScript/Next public/admin/Nest Express/PostgreSQL 18/Drizzle/Better Auth adapter baseline; pin supported versions after actual compatibility proof, no silent Node fallback. No proof is claimed now.
- **Fallback:** VI+EN remain MVP. Missing translation uses eligible Published Vietnamese/default content, not 404 solely for missing translation. No drafts, revoked media or mixed unpublished content; genuinely missing/unpublished resources without eligible fallback remain safe. Page-versus-field fallback, menu details, locale URL syntax and requested-URL versus redirect/canonical/hreflang behavior are bounded technical contracts before localized implementation. SEO must reflect actual published language under current primary policy: do not label delivered VI as an EN alternate or choose an EN canonical merely from the requested locale.
- **Builder:** MVP uses two original themes, a shared-schema section catalog and limited color/font/layout; no arbitrary HTML/scripts. Brand/menu/theme changes save Draft and require explicit Publish with immutable reference/configuration consistency. Exact catalog still needs review. Full Web Builder is future direction, not a new MVP scope or implementation commitment.
- **Media and leads:** JPEG/PNG/WebP, at most 5 MiB/image, no SVG/remote URL imports; safe decoding/pixel/decompression/transform details remain technical contracts. Tenant/IP rate limits, CAPTCHA on abnormal traffic and transactional email to tenant-selected active admins, default initial assigned tenant admin, are accepted. That phrase describes assignment order within the same role, not a new onboarding policy. Provider/threshold/integration/retry limits remain open; D4 durability/redaction/24-hour idempotency, retention and media permission/withdrawal targets remain unchanged.
- **Quota and lifecycle:** manual entitlements/quotas, no auto billing; excess blocks corresponding resource growth only, never deletion of published content/leads, and no branch limits. Numeric limits remain unselected. Tenant suspension stops public/intake/publish but retains authorized tenant-admin read/export. Deletion requires a confirmed request; export format, recovery/reactivation, deletion grace and backup retention need future contracts without invented periods. Controlled manual domain migration/reverification/equivalent-page mapping is accepted, with no automatic primary outage flip and no reuse of old binding; detailed removal/replacement/reactivation/renewal/failure handling remains to engineer.
- **Local acceptance versus production:** AC-01–12 are accepted traceability, not passed behavior. Applicable local functional/security/isolation/D4 criteria remain necessary; AC-07 local route proof does not require purchasing/configuring a real domain. AC-09 production readiness and concrete production hosting/provider/SKU/DB placement/budget/HA/RPO/RTO/backups/ops decisions are deferred beyond local MVP and do not block local setup/development/acceptance. Direction only remains moderate VPS Docker + S3-compatible storage in Vietnam. The advisory's PostgreSQL-on-VPS/no-HA/offsite-backup topology was not approved. No production launch is claimed.

## Alternatives considered

- **404 solely for an absent translation:** rejected by direct human correction; Published VI fallback is required. Universal 200, draft fallback or false language metadata is not selected.
- **Full Web Builder in the MVP:** deferred by the human; the section builder keeps the initial scope bounded without removing dental content, two themes or VI+EN.
- **Require production hosting/AC-09 before local MVP:** rejected by the explicit production deferral. This does not waive local security, tenant isolation, durability, retention or withdrawal proof.
- **Treat local port separation as cookie security or require local BFF:** not selected; separate origins still need explicit session/CORS/CSRF contracts.
- **Approve the entire onboarding/recovery/MFA advisory:** not authorized by the clarification about “first admin”; these remain product decisions without new roles.

## Consequences

Current sources can guide a local MVP proposal without selecting production infrastructure. Approved ports and policies are specifications only, not working services, successful tests or implementation authority. Fallback needs language-aware publication/cache/SEO contracts; it must not become a silent draft or permission bypass. Full MVP capability breadth is retained. Resolve remaining account/recovery policy and exact initial catalog, then propose a separately authorized first implementation slice with applicable local proof and unassigned owners made explicit.

## Sources

- [GCMS-DOCS-004 human feedback, approval and static proof](../tasks/GCMS-DOCS-004.md)
- [Architecture](../architecture.md), [workflows](../workflows.md), [access control](../access-control.md) and [acceptance](../acceptance-criteria.md)
- [ADR-004 primary URL policy](004-primary-url-and-301-redirects.md), retained without historical edits

Same-day technical-source knowledge is reused; no new external research, provider selection, legal compliance assertion or runtime proof is introduced.
