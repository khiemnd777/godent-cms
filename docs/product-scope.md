# Product scope

**Current S05 scope — HUMAN_ACCEPTED — Khiêm directly stated “Nghiệm thu S05.” on2026-10-16 Asia/Ho_Chi_Minh.** Historical technical CODE_INTEGRATED/scoped local verification/READY_FOR_USER_REVIEW and API/worker32tests/472assertions, admin29/101, scoped final browser/five-width checks, build/type/lint/diagnostics/runtime PASS. [Final task ledger](tasks/GCMS-S05-001.md#final-local-handoff--2026-10-16) records exact proof and historical failures. Browser expired-lead removal/Enter-triggered outage recovery and backup restore remain NOT_RUN. Independent source review CLOSED; audit FAIL/fresh local-S05 deferral, final33traces/zero advisory-chain references, reassess2026-10-22 or earlier stated triggers. Root post-release preservation/exact-value secret scan/final static checks PASS within the final task ledger; dated snapshots are refreshed mechanically after this factual closure. S01–S05 HUMAN_ACCEPTED; no S06+/external email/full-MVP/production/Git/deploy claim. [Human acceptance provenance](tasks/GCMS-S05-001.md#human-acceptance--2026-10-16); acceptance adds no runtime proof or execution authority.

**Historical S04 scope — HUMAN_ACCEPTED.** Khiêm directly stated **“Nghiệm thu S04.”** on **2026-10-16, Asia/Ho_Chi_Minh**, desktop thread `01a1402c-3c81-7933-9927-d974f70c9fbc`; desktop verified the direct human source. Historical technical CODE_INTEGRATED + VERIFIED_LOCAL_API_SSR + READY_FOR_USER_REVIEW and check limits are unchanged. [S04 v0.1/D01–D10](tasks/GCMS-S04-001.md) was directly approved by Khiêm on2026-10-16 Asia/Ho_Chi_Minh: “Approve. Đồng ý triển khai S04 v0.1 trong phạm vi đã planned.” [ADR-008](decisions/008-local-consultation-intake.md) records settled local intake/read-only lead contracts; [canonical API types](../apps/api/src/contracts/s04.ts) and [shared input rules](../apps/api/src/contracts/intake.ts) define concrete shapes. Real browser phone/email→API/PG→A1/A2 read and actual25tests/313assertions pass within the task ledger. CAPTCHA solving/submission, public unknown-timeout/same-key browser retry and full cursor UI sequence remain NOT_RUN. Controlled CMS GET loading/outage/keyboard retry now PASS without new submissions; local challenge-required observation is separate. S01–S04 are HUMAN_ACCEPTED. No dispatcher/email/retention worker/S05+ or full-MVP/production claim; final integration/preservation/secret checks are recorded separately.

**Historical through S03:** S01–S03 are **HUMAN_ACCEPTED**; Khiêm directly stated “Đã nghiệm thu S02.” on 2026-10-16, Asia/Ho_Chi_Minh. Historical S02 NOT_RUN browser checks remain unexecuted. [S03 v0.1/S03-D01–D06](tasks/GCMS-S03-001.md) is **HUMAN_ACCEPTED** after the separate direct human “Nghiệm thu S03.” on2026-10-16; its task retains approval/acceptance provenance; [ADR-007](decisions/007-first-vi-publication.md) records the minimum local VI service publication decisions. Local additive migrations/new synthetic records and implementation/checks are approved while preserving existing resources/auth/data. [ADR-006](decisions/006-local-account-session.md) retains S02 account/MFA/session decisions. S03 is HUMAN_ACCEPTED within its recorded bounded local scope; existing API/PG/SSR/process/browser proof and limits are unchanged, with no full-MVP acceptance implied. S04–S18 execution is unapproved; no commit/push/deploy, production/DNS/TLS, global configuration, paid services, real data or external email.

Unchanged product policies remain in [ADR-002](decisions/002-simple-tenant-cms.md), [ADR-003](decisions/003-platform-path-and-custom-domain.md), [ADR-004](decisions/004-primary-url-and-301-redirects.md) and [ADR-005](decisions/005-local-mvp-and-content-fallback.md). Historical documentation approvals and the approved 18-slice master plan do not independently authorize implementation. Current S03 decisions supersede older minimum-layout/slug deferrals only within the approved local bounds.

## Purpose and actors

Enable a dental organization to create, customize, publish and manage a professional responsive website without software development expertise. Priorities are website management, publishing, SEO and consultation leads.

| Actor / audience | Product relationship |
| --- | --- |
| Platform administrator | Godent platform operations, tenant provisioning and manual entitlements within confirmed policy; no blanket tenant-private access |
| Tenant administrator | Manages the organization's website, content, members within permitted tenant grants and all its leads; writes and publishes |
| Clinic owners/managers, marketing staff, dental professionals and reception/customer service | Target-user groups that may use the tenant administrator role; not separate mandatory permission roles |
| Single-clinic or multi-location organization | The organization is one tenant with one branded website; locations are ordinary content |
| Visitor/patient | Discovers services, prices, doctors, locations and educational content; submits a consultation request |
| International visitor | Uses localized information and supported communication preferences |

Platform operations do not imply access to tenant-private leads. The minimal role model and safe membership grants are canonical in [access control](access-control.md). Additional roles require a future confirmed need.

## Administration and public applications

Platform Admin `/platform` and Tenant CMS `/cms` share one Next administration app at 127.0.0.1:5891, shared components/API5890 and separate layouts/navigation. The public website is a separate Next entry at localhost:5892 with future tenant path `/<tenant-slug>`. Backend authorization, not route prefix, governs actor/tenant/resource/action; platform admins gain no private-lead access by sharing the app.

The accepted S01 scope includes runnable shells for both admin areas (header/sidebar/content/basic navigation/responsive/states), public shell and bounded runtime/connectivity/Bun proof. It does not implement real login/tenant selection/CMS CRUD or tenant data/schema/two-tenant fixtures. S02 connects access and private draft, S03 service editing/publication. The 18-slice master plan is APPROVED_PLAN; S02/S03 are human accepted within their separately recorded local scopes. S04 v0.1/D01–D10 is separately approved; S05 v0.1/D01–D12 separately approves its bounded local operations/worker scope; S06–S18 execution remains unapproved. S01 scaffold evidence and bounded S02 API/database proof do not establish full-product behavior. No new CMS service/port/hostname or mandatory BFF is selected.

## Organization and locations

One tenant represents the dental organization and owns one branded website. A location is an ordinary row with `tenant_id`, address, contact and opening information. An organization with three locations has three such rows, displayed as a list, cards or sections. It does not have three child tenants.

Services, doctors and price entries may reference locations to describe public applicability. Those references are content relationships, not location administration, lifecycle, permissions, grants, lead queues or separate operations. A single clinic uses the same model with one location row. VI+EN, two original themes and manual entitlements remain planning baseline. No numeric pilot quota or branch-limit scheme is selected.

## Public entry routes

The human identifies **godent.vn** as the registered project domain; registration is human-reported, not independently verified. A tenant website supports both `godent.vn/<tenant-slug>/<site-page-path>` and `<verified-custom-host>/<site-page-path>`. These are two addresses for the same tenant/site, theme/content/media, publication state and common lead list, not duplicate websites or content.

On godent.vn the validated registered path prefix selects the tenant/site; on a verified active custom host the host binding selects it, and the remaining path cannot select a different tenant. Reserved platform/admin/API/static routes and unknown/inactive bindings/slugs must fail safely under the [canonical resolver](architecture.md#public-entry-resolution). Slug uniqueness/validation, route-aware links/forms/assets and current eligibility apply to both entries.

The Godent URL is initially primary/self-canonical. An active same-tenant administrator explicitly activates its own verified active custom-host binding only after valid TLS and equivalent eligible published pages are ready; then that domain becomes primary/canonical and public GET/HEAD Godent page aliases return 301 directly to equivalent same-language pages. The browser address changes; no second website or draft publication is created. Navigation and SEO follow the current primary; API/admin/preview/media/intake POST retain dedicated contracts. [Architecture](architecture.md#primary-url-and-page-redirects) defines activation, mapping, eligibility and cache/job safety.

S03-D02 and the linked API contract settle the local lower-case ASCII slug registry/reserved namespace and lock after first publication. Exact later locale/slug lifecycle, domain removal/replacement/reactivation and DNS/TLS implementation/providers remain deferred. Temporary DNS/TLS failure does not automatically reverse primary URLs. Availability/configuration was not checked and no such action is authorized. [ADR-003](decisions/003-platform-path-and-custom-domain.md) retains dual-entry routing; ADR-004 supersedes its canonical deferral only.

## MVP capabilities

| Capability | Content and boundary |
| --- | --- |
| Tenant management | Minimal memberships; approved D01–D10 invitation-only provisioning, verified global identity, mandatory MFA, controlled recovery and atomic last-admin protection. Manual entitlements/quotas block corresponding resource growth when exceeded, never delete published content/leads; no numeric/branch limits selected. Suspension blocks public/intake/publish, retains authorized admin read/export; deletion only on confirmed request. |
| Brand and themes | MVP two original themes/shared-schema section builder, limited color/font/layout; brand/menu/theme save Draft then explicit Publish with private preview. S03-D01 approves only the minimum introduction/rich-text layout; the full two-theme/section catalog remains S13; full Web Builder is future direction only. |
| Dental catalog | Specialties, services, service groups, related doctors and location applicability as content |
| Doctor profiles | Professional biography, specialties, languages, credentials and ordinary location references |
| Clinic locations | Tenant-owned address/contact/opening information, map link and displayed service/doctor associations |
| Prices | Organization price lists with location applicability; exact/range/from-price, currency, unit, inclusions and notes |
| Treatment cases | Public editorial narratives linked to services/doctors and permission-controlled galleries; no clinical chart or treatment execution |
| Galleries/testimonials | Ordered before/after pairs, captions, alt text and recorded permission to publish patient-derived material |
| Knowledge and FAQs | Categorized articles, author/professional attribution where supplied, related services and reusable FAQs |
| Campaigns | Promotions with applicability/validity and marketing landing pages assembled from supported sections |
| Localization | VI+EN, independent publication; missing translation falls back to eligible Published Vietnamese/default content, not translation-only 404. Exact URL/page/field/menu/fallback SEO mechanics remain technical contracts. |
| SEO | Server-rendered public content, metadata, canonical/hreflang, sitemap, robots, redirects, eligible structured data and social previews |
| Consultation leads | One common tenant lead list; source attribution, optional location inquiry information, assignment, notes, status history, bounded search/filtering and durable notifications |
| Domains and public entry | `godent.vn/<tenant-slug>/<site-page-path>` plus `<verified-custom-host>/<site-page-path>`, both addressing one tenant website; HTTPS remains a future requirement, not verified configuration |
| Operations | Local functional tenant isolation, audit, protected media, approved abuse/quota/lifecycle/D4 rules; production backup/restore/monitoring and AC-09 deferred beyond local MVP, without a production-readiness claim |

Free-form executable code, unrestricted HTML/scripts and arbitrary third-party embeds are outside the initial section builder. Allowlisted rich text, sections and integrations require validation. No reference-site content or patient data is imported. S03 permits new owned synthetic records while preserving S02 fixtures/auth/data. Other fixture work requires its own authority and synthetic or explicitly licensed material.

## Workflow baseline

Canonical details and D4 deadlines are in [workflows](workflows.md); keep one source for those rules.

- **Content:** exactly Draft → Published. The same tenant administrator writes and publishes. An active public pointer means Published; a Published item can also have a pending draft. Saving never changes live output. Unpublish removes the public pointer/eligibility and returns Draft. Restoration creates a draft for the administrator's own explicit publish. Immutable snapshots/references, conflict checks, private preview and history remain; clinical review is not a mandatory product stage.
- **Consultation:** anonymous intake resolves the tenant from verified website context. All tenant administrators see the common tenant lead list. Optional location and assignment do not restrict visibility or create branch queues. Accepted intake persists before acknowledgement with durable notification intent; acknowledgement is not appointment confirmation. Approved lead statuses, retention and deletion deadlines are defined in workflows.
- **Media:** originals remain private; only currently eligible derivatives can be delivered publicly. Patient-derived cases/testimonials require recorded permission to publish. Current withdrawal overrides historical publication snapshots. Permission evidence is not a clinical editorial review gate.
- **Accepted policies:** media accepts JPEG/PNG/WebP up to 5 MiB/image, no SVG/remote URL import; lead intake uses tenant/IP rate limits and CAPTCHA on abnormal traffic, with transactional email to tenant-selected active admins (default initial assigned tenant admin). Manual quota excess blocks corresponding growth only. Suspension blocks public/intake/publish, keeps authorized tenant-admin read/export; deletion only on confirmed request. Controlled manual domain migration revalidates ownership/equivalent pages, never automatically flips primary or reuses old binding. Canonical detail is in workflows; exact thresholds/provider/export/reactivation/deletion grace/backup retention are not selected. No branch lifecycle or new support workflow is introduced.

## S05 approved local operations boundary

S05 adds eligible assignment/unassignment, append-only plain-text internal note and actual contact record, controlled close/reopen with reasons, history, stable request code and source-side name/code/status/assignee/HCM-date query/count/cursors. All current same-tenant administrators share visibility; assignment is responsibility only. Contacted requires real two-way exchange. Note/view/assignment/status/retry do not renew substantive activity; reopening/status alone cannot extend current expiry. Existing D4 values are unchanged; S06 extension/notice/delete/audit-expiry workers remain separate.

Recipient settings use current eligible same-tenant IDs/version/CSRF/recent reauthentication; historical first-admin default never silently falls back. Pending delivery follows new settings; successful recipients are not resent. Close cancels not-started consultation.received; reopen does not recreate it. A narrow execute-only PostgreSQL worker role and explicit new-S05-tenant one-shot Bun/capture prove local delivery receipts, not external mail or exactly-once provider delivery. Current eligibility is serialized at attempt start; started I/O is not promised revocable. No notification center/provider editor/attachment/clinical records/location queues or appointment behavior. Full [approved plan](tasks/GCMS-S05-001.md) retains exact D01–D12/acceptance, and [runbook](local-development.md#s05-local-preparation-and-bounded-worker) retains commands and actual limits.

## Non-goals

- Dental practice management, EMR and patient clinical records.
- Clinical diagnosis, treatment plans or execution workflows.
- Dental service billing, collections, insurance or payment processing.
- Real-time appointment inventory, slot reservation or appointment confirmation.
- Automated SaaS subscription payments, advanced CRM automation and clinical AI.
- Reference-site cloning, copyrighted-content migration or patient-data import.
- Child tenants, location administration/permission systems, branch queues and mandatory separate editorial/reviewer roles.

## D5 direction and unresolved decisions

Direction only: one moderate VPS running Docker plus S3-compatible storage in Vietnam. Vietnix is an example, not a provider selection. Concrete production provider/SKU, database placement, budget, RPO/RTO, HA/availability, backup schedule/retention, workload and operations decisions are deferred beyond local MVP. Basic quota/suspension/confirmed-deletion policies are accepted in workflows; their detailed implementation is separate from production operating choices. Earlier DigitalOcean/Singapore/AWS/SES proposals are not current choices.

Local Docker endpoints and pinned Bun1.4.3/service compatibility have S01 evidence. S02 D01–D10 settle account creation/recovery/MFA and local session/CORS/CSRF policy. S03-D01–D06 settle the minimum intro/rich-text layout, local slug/first-publication lock and actual-VI/local-noindex SEO. The full theme/section catalog remains S13. Future technical contracts include locale syntax/page-versus-field fallback and truthful multilingual SEO, later slug lifecycle, safe media handling, numeric quotas/abuse thresholds, providers and detailed domain/tenant lifecycle; settle these before dependent implementation. D4 remains unchanged; production AC-09/D5 choices do not block local MVP. Product policy does not establish legal compliance or authorize application execution.
