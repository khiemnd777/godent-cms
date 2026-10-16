# ADR-013 — Local M4 builder, campaigns and locales

Status: accepted decisions under Khiêm's direct M4 v0.1 approval on 2026-10-16. The [complete approved plan and authority](../tasks/GCMS-M4-001.md#current-authority-and-ownership) governs S13–S15. This ADR records settled decisions; it grants no additional execution, Git or Production authority. Runtime evidence remains separate from design and human acceptance.

## Context and decision

M4 extends the existing Bun modular monolith. The builder, existing service and eleven dental content kinds share typed publication contracts. The two original public themes are `clarity` and `showcase`, with a small allowlist of palette, font and layout presets. No arbitrary HTML, CSS, script, remote font or imported website assets are supported.

| Approved decisions | Behavior |
| --- | --- |
| S13-D01–D06 | One shared typed section catalog; independent versioned site presentation; explicit config publication changes adopted live presentation without publishing content drafts. Legacy publications retain their output until deliberate adoption. Internal menu/CTA targets are typed same-tenant references with current eligibility checks. Saved private preview resolves references and signed private media. |
| S14-D01–D03 | Promotions use absolute instants and authored timezone with half-open `[startAt,endAt)` eligibility. Unspecified location does not mean all locations. Published upcoming/expired information may remain visible; offer CTA and new promotional intake are unavailable. Loss of selected applicability never widens the campaign. |
| S14-D04–D06 | Real service/landing source union, optional interest, server-confirmed immutable source/publication snapshot and bounded tracking tokens. No fake service ID, raw referrer/query, first-touch cookie, booking, redemption or price engine. Lead, durable notification intent and accepted receipt remain atomic. |
| S15-D01–D06 | VI paths stay unchanged; EN uses the same locked slug under `/en`. Locale heads publish independently. Missing, draft or unavailable EN gives a whole-page 302 to eligible VI; neither available gives 404. Backend/transport errors remain errors. Narrative fields never silently fall back. Actual form locale owns consent version/copy independently of preferred contact language. HTML language, menu, canonical, alternates, sitemap, social and JSON-LD describe the actual published language. |

## Ownership and consistency

`gcms_m4` owns locale variants, immutable revisions/publications, current heads, scoped permissions, command receipts and delivery-invalidation intents. Existing tenant/membership authorization, FORCE RLS and tenant locks remain authoritative. Expected versions and stable operation IDs protect conflicts and retries. Saving or restoring changes drafts only. First publication locks the shared route slug; withdrawal and unpublish retain history.

An adopted resource preserves exact historical pins while the current resource generation and permissions remain eligible. Compatibility guards cover the old anonymous service/content/reference/media seams as well as new builder routes. No migration rewrites old snapshots or publishes drafts. Current unpublish or rights withdrawal overrides historical delivery. EN rights are separate resource/locale/revision grants; VI permission never authorizes EN patient-derived narrative.

Resource asset-use withdrawal is locale-specific across that resource's historical revisions; global S07 media withdrawal still blocks every locale. Restoring a pre-rename revision retains the current permanently locked technical slug and creates a new Draft; it does not mutate the selected history row or the live head.

Graphs use cumulative pre-expansion node/byte admission plus final exact DTO checks. Public and private queries use bounded transactions. Lists apply current eligibility before page formation and return explicit continuation after the last returned identity when the byte budget cuts a page. Permission history uses bounded time-and-ID keyset pages and authorized singleton reads so older loaded grants remain withdrawable and observable.

Private preview resolves a saved draft with current eligible references, signed private media and its selected presentation. Unresolved required data is explicit. Preview does not publish, deliver a live form or replace failed reads with a reference count.

## Intake, withdrawal and workers

New landing intake validates source/content/config identity and current applicability. The promotion clock is checked after lock acquisition immediately before a new durable acceptance. A matching accepted receipt is resolved first under the existing 24-hour contract, subject to current lead expiry; replay does not create a lead or refresh activity/retention. Source/tracking follows the existing S06 lead deletion graph. Existing S05 delivery continues to exclude lead contact, message and source details.

Resource permission withdrawal schedules delivery invalidation. Completion means current output can no longer deliver the withdrawn scope; it does not claim physical deletion of media owned by another module. Global Media withdrawal owns derivative purge. M4 workers require explicit enrollment of positively owned M4 tenants. API startup and migrations never dispatch retained S04/S05/M2/M3 backlog.

## Locale routing and trade-offs

Anonymous EN GET/HEAD preflight produces an exact 302 only for the canonical fallback result. The proxy strips caller-supplied internal headers and passes expected content/config identities. Metadata and body share one request-scoped read and fail closed if those identities change. This is a bounded local consistency seam, not a cross-request cache or a Production availability guarantee. Unsupported website methods remain 405.

The local deployment retains no-store responses and noindex directives. Custom-domain activation/301 belongs to S16; lifecycle/quota belongs to S17 and full local MVP acceptance to S18. DNS/TLS, external delivery, Production topology/SLO and operational backup/restore are outside M4. The `braces` audit remains FAIL/open, with a fresh M4 exposure assessment required and reassessment on 2026-10-22 or earlier patch/dependency/exposure change and before Production.

Actual checks, failures, repairs and remaining limits belong in the [M4 execution ledger](../tasks/GCMS-M4-001.md#execution-ledger) and [M4 evidence](../evidence/m4/). This decision record alone proves no runtime behavior.
