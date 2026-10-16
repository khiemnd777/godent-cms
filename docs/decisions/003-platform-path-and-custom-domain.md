# ADR-003: Platform path and custom domain for one tenant website

## Status

Accepted for documentation under the direct human approval in [GCMS-DOCS-002 v1](../tasks/GCMS-DOCS-002.md), 2026-10-15, Asia/Ho_Chi_Minh. It supersedes the platform-subdomain access assumption only. [ADR-001](001-bun-modular-monolith.md) and [ADR-002](002-simple-tenant-cms.md) remain unchanged for stack, simple tenancy, minimal roles, Draft → Published, D4 and deferred D5.

The human reports godent.vn is the registered project domain. Registration, DNS/TLS and live routing are not independently verified. Documentation approval authorizes neither application implementation nor DNS/configuration.

## Context

A clinic needs visitors to reach its existing branded website through a path on the project's domain or through its own verified domain. Two addresses must not create separate tenants, sites, publication histories, themes/content/media or lead lists. Shared-host path routing also means hostname-only tenant resolution is insufficient.

## Decision

- Support `godent.vn/<tenant-slug>/<site-page-path>` and `<verified-custom-host>/<site-page-path>` as two public entries to the same tenant/site.
- On godent.vn, distinguish reserved platform/admin/API/static routes first, then resolve the unique normalized registered tenant slug. On a custom host, use its verified active binding; its first path segment is a site path, never a second tenant selector.
- Use the validated tenant/site/resource identity and entry URL base throughout rendering, navigation, forms, asset/media delivery, locales, SEO, caches and relevant durable jobs. Revalidate current mapping/eligibility; a stale slug/host must not redirect sensitive work to a new tenant.
- Both consultation entries write the same tenant lead list under the existing tenant-scoped idempotency contract. URL aliases do not partition it or change authorization.
- Canonical detailed resolver ownership, inputs/outputs, denial cases and consumer requirements live in [architecture](../architecture.md#public-entry-resolution), with future proof in [acceptance](../acceptance-criteria.md).

No preferred/canonical entry, mandatory custom-domain redirect or duplicate-SEO strategy is selected. Locale syntax, reserved-name list, slug normalization/lifecycle/aliases and DNS/TLS setup/providers require explicit consistent contracts before dependent implementation. Approved platform-path support itself is not deferred.

## Alternatives considered

- **Platform subdomain per tenant:** earlier planning assumption, superseded by the human's path requirement. It would not satisfy the approved entry form.
- **Separate website/content per address:** duplicates publication and lead management and contradicts one tenant/website. Rejected.
- **Treat every first path segment as a tenant slug:** would let paths on custom domains switch tenant context and collide with platform services. Rejected.
- **Redirect one entry to the other automatically:** might become an explicit canonical/SEO choice later; not selected by this request. Both entries must remain represented in the resolver and proof requirements.

## Consequences

One website and one publication lifecycle remain simple to administer. The renderer and API can no longer assume a tenant root is always `/` or tenant identity comes from hostname alone. Entry-aware URLs, explicit route namespaces, current mapping revisions and tenant-safe caches/jobs become required contracts, not another product or deployment.

Shared platform paths are not a private authorization boundary. Existing backend tenant/resource/action checks, private preview/media, current withdrawal, publication snapshots and common lead visibility remain. SEO/canonical decisions are still open, so static documentation cannot claim duplicate-content policy, indexing, DNS/TLS or live serving is solved.

## Sources

- [GCMS-DOCS-002 human authority and proof](../tasks/GCMS-DOCS-002.md)
- [Architecture resolver contract](../architecture.md#public-entry-resolution)
- [Product scope](../product-scope.md)
- [Workflows](../workflows.md)
- [Simple tenant decision](002-simple-tenant-cms.md)
