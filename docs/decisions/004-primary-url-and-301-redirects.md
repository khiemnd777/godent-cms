# ADR-004: Godent primary URL followed by activated custom domain and 301 redirects

## Status

Accepted for documentation under fresh direct human approval in [GCMS-DOCS-003 v1](../tasks/GCMS-DOCS-003.md), 2026-10-15, Asia/Ho_Chi_Minh. Supersedes only [ADR-003](003-platform-path-and-custom-domain.md)'s canonical/preferred-host/redirect deferral. Its two entry forms and resolver boundaries remain. Earlier D1–D4, deferred D5 and Bun/TypeScript/Next/Nest/PostgreSQL 18/Drizzle/auth baseline are unchanged.

No application or DNS/configuration action is authorized. godent.vn registration is human-reported; registration, DNS/TLS and live routing are not independently verified.

## Context

One organization has one tenant website, content/theme/media, publication state/history and lead list. Its platform-path and custom-domain addresses need one consistent primary URL rather than competing identical indexed copies. The human approved option A from the preceding advisory: start on Godent, then use an explicitly activated verified custom domain with page-level 301 redirects.

## Decision

- Initially `https://godent.vn/<tenant-slug>/<site-page-path>` is primary and each eligible published page self-canonicalizes there. Domain input, verification alone or an outage never automatically changes the primary.
- An active same-tenant administrator explicitly activates its own verified active custom-host binding only with valid TLS and equivalent eligible published pages ready. Switch the tenant's stable primary/canonical base to that domain. Activation changes routing configuration, not the tenant/site or content publication; it cannot publish a pending draft or rewrite immutable history.
- After activation, public-page GET/HEAD aliases on Godent return **301**, directly to their equivalent custom-domain page and language. Remove only the platform tenant prefix, retaining the site-page/locale suffix. No homepage catchall, cross-tenant/open redirect, loop or chain. Nonexistent, withdrawn or unpublished content cannot redirect to a homepage or draft.
- Canonical URLs are absolute, same-language and self-referential on the primary pages. Navigation, sitemap, hreflang, metadata/social URLs and other SEO output agree with the approved primary and current published eligibility. Do not robots-block/noindex aliases to force canonical selection. The primary is per tenant, not an arbitrary per-page host.
- API, administration, private preview, media and intake POST retain their dedicated contracts; there is no blanket redirect or POST replay. Both valid intake entries retain one lead list and the same tenant-scoped 24-hour idempotency. Safe allowlisted tracking parameters may survive redirects while canonical omits tracking; functional query parameters require their own semantics, not blanket deletion.
- Derive destinations only from the authoritative current tenant/site binding and primary. Revalidate active membership, own binding and valid TLS at activation; delivery revalidates current binding/site/publication eligibility. Forged host/query input and stale reassignment cannot select a destination. Primary/mapping revisions, caches and durable jobs must remain consistent during races/failure. Exact transaction/schema mechanics remain implementation details.
- Temporary DNS/TLS failure does not automatically reverse the primary or create reverse 301 loops. Cached permanent redirects mean the Godent alias is not a guaranteed instant emergency fallback. Later domain change/removal/replacement/reactivation needs a future controlled migration contract; no new operating service/workflow is selected here.

Canonical detailed rules live in [architecture](../architecture.md#primary-url-and-page-redirects), with actor/workflow and future proof in [access control](../access-control.md), [workflows](../workflows.md) and [acceptance](../acceptance-criteria.md). Exact locale syntax, reserved names/slug lifecycle and DNS/TLS providers/setup remain deferred; the primary/301 policy itself is now approved.

## Alternatives considered

- **Both entries return 200 with cross-domain rel=canonical:** keeps the entered address visible, but duplicates remain crawlable and Google may choose another canonical. Not selected by the human; option A permits the address bar to change through redirect.
- **Always canonicalize to Godent:** stable platform identity, but weaker clinic-domain brand/ownership independence. Not selected. Custom-domain preference is a product/brand choice, not a ranking-boost claim.
- **Each identical copy self-canonicalizes:** conflicting identity signals; rejected as the default for one site.
- **308 permanent redirect:** Google recognizes both 301 and 308 as permanent; 301 is selected by human approval, not an asserted SEO advantage.

## Consequences

Old platform URLs remain usable through redirects after activation, but the browser shows the custom domain. Consistent primary URLs simplify visitor identity and SEO signals; they do not guarantee Google's canonical choice, rankings or traffic. Changing domains may cause temporary search fluctuations. Map equivalent pages directly, update links/sitemaps and generally retain migration redirects at least one year while source control remains; do not repeatedly change domains or redirect unrelated pages to a homepage. This technical guidance does not select an additional numeric D5 operating policy or blanket Change of Address procedure for a shared-host subsection.

Current authorization, publication snapshots and media revocation override stale historical/cache/job state. No new tenant, website, role, content-review gate, lead queue or provider is introduced. Future implementation must prove activation/races, denial cases, routing, SEO and DNS/TLS; all such checks are NOT_RUN.

## Sources

The official Google sources below were read in the same-day advisory turn, reused here without a fresh fetch. They supply technical rationale, not application proof or a legal/SEO outcome guarantee.

- [GCMS-DOCS-003 direct approval and static proof](../tasks/GCMS-DOCS-003.md)
- [Architecture primary URL contract](../architecture.md#primary-url-and-page-redirects)
- [Google canonical methods](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls): redirects/rel=canonical are strong signals, sitemap weaker; consistent absolute/self/same-language canonical output; avoid robots/noindex as canonical forcing.
- [Google redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects): 301 and 308 are permanent signals; use permanent redirects when not expecting reversal.
- [Google URL migrations](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes): equivalent-page/direct mapping, no irrelevant homepage catchall, possible fluctuations and generally at least one year of redirects while controlled.
