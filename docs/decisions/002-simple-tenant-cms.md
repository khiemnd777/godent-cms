# ADR-002: Simple tenant CMS, direct publishing and shared leads

## Status

Accepted for documentation/planning under [GCMS-DOCS-001 v1](../tasks/GCMS-DOCS-001.md) on 2026-10-15, Asia/Ho_Chi_Minh. Direct human approval and authoritative corrections are in that task. Application implementation, runtime proof and delivery acceptance remain separate and unapproved/unverified.

Partially supersedes the original editorial/access assumptions associated with [ADR-001](001-bun-modular-monolith.md) and the initial scope/architecture. Bun, TypeScript, Next.js, NestJS/Express, PostgreSQL 18, Drizzle, the auth adapter baseline and modular-monolith direction remain unchanged.

## Context

The first documentation/analysis baseline introduced separate editorial/reviewer roles, clinical review gates and location-level access/operating assumptions beyond the intended simple CMS. Khiêm explicitly corrected these: an organization needs one branded website, ordinary location information, tenant administrators who write/publish and manage all tenant leads, and a simple two-state editorial workflow.

The three GCMS-ANALYSIS-001 specialist handoffs are historical risk inputs, not current product decisions or implementation approval. Their useful tenant-isolation, publication-reference, private-media, intake and compatibility concerns remain. The human corrections supersede conflicting role/review/branch and hosting proposals.

## Decision

- **D1:** one organization tenant, one branded website. Locations are ordinary tenant-owned address/contact/opening rows rendered as lists/cards/sections. VI+EN, two original themes and manual entitlements remain baseline; no numeric pilot quotas or branch-limit scheme is selected.
- **D2:** platform administrator versus tenant administrator. An active tenant administrator manages own-tenant content and all leads, including safe same-tenant grants. Platform operations confer no blanket private-lead access. Location/assignment are not security boundaries. Extra roles/support mechanisms require future confirmed need and authority.
- **D3:** exactly Draft → Published. Active public pointer defines Published; a pending draft can coexist. Save does not change live output. The same administrator explicitly publishes; unpublish removes the pointer/eligibility and returns Draft; restore creates a draft for explicit publication. No mandatory clinical/reviewer/Reviewed workflow, self-review constraint or review-invalidation gate remains.
- Preserve immutable publication/reference closure, optimistic conflicts, authorized private preview, history and current revocation. Permission to publish patient-derived material is an eligibility control, not a clinical review stage.
- **D4:** retain the approved intake, one shared tenant list, status/assignment rules, retention/extension deadlines, durable private notifications, tenant-scoped idempotency and private-media withdrawal targets in [workflows](../workflows.md). All same-tenant administrators retain lead visibility.
- **D5:** direction only: a moderate VPS running Docker and S3-compatible storage in Vietnam. Vietnix is an example, not selection. Provider/SKU, database placement, budget, recovery/availability/load targets, backup schedule/retention and tenant lifecycle choices remain deferred; prior DigitalOcean/Singapore/AWS/SES proposals are not selected.

Canonical detail lives in [access control](../access-control.md) and [workflows](../workflows.md); [acceptance](../acceptance-criteria.md) states future observable proof. This decision authorizes documentation only.

## Alternatives considered

- **Separate owner/manager/editor/clinical-reviewer/publisher/receptionist roles:** can support future specialized organizations, but adds grants, UI states and operational dependencies. Not selected without a confirmed need.
- **Mandatory independent clinical review and Reviewed state:** adds separation of duties but blocks the intended administrator's direct publish workflow. Rejected by the human correction; product safety must not be represented as an unapproved review gate.
- **Child tenants, branch administration/permissions or per-branch queues:** unnecessary for displaying location rows. They would alter tenancy and lead visibility. Not selected.
- **Assignment-restricted leads:** can narrow individual access but conflicts with the approved common tenant lead list. Not selected.
- **Concrete managed-cloud/provider/SKU or numerical D5 package:** may become a future operating choice, but was not approved. Record only the Vietnam VPS Docker + S3 direction and resolve dependent choices later.

## Consequences

Fewer roles and states reduce workflow/configuration overhead. Tenant administrators have deliberately broad same-tenant content and lead access; assignments do not provide confidentiality between them. There is no independent clinical-review control to claim. The organization remains responsible for what its administrators publish.

Backend tenant authorization, safe grants, tenant-consistent references/RLS, private preview, immutable snapshots, current media permission, durable intake and audit remain necessary. Ordinary locations do not weaken tenant isolation. Withdrawal must override immutable history and stale jobs without adding editorial states.

The full dental-content/website/SEO/domain/lead MVP remains. A narrow first publish-to-lead journey changes implementation order, not completion scope. D4 periods/targets are accepted future proof requirements, not measured SLA or legal compliance. Backup/tenant lifecycle decisions are unresolved and must not silently inherit D4 retention.

## Sources

- [GCMS-DOCS-001 authority, scope and actual checks](../tasks/GCMS-DOCS-001.md)
- [Current product scope](../product-scope.md)
- [Current architecture](../architecture.md)
- [Original Bun/modular-monolith decision](001-bun-modular-monolith.md)
