# ADR-001: Bun runtime and modular monolith

## Status

Accepted as the documentation/design baseline under GCMS-SETUP-001 v2 on 2026-10-15. Application implementation and runtime compatibility remain unapproved/unverified.

**Historical annotation, GCMS-DOCS-001:** [ADR-002](002-simple-tenant-cms.md) partially supersedes the initial editorial/access assumptions associated with this baseline: the current product uses minimal platform/tenant administrators, ordinary location rows and direct Draft → Published with no mandatory clinical review. Bun and the modular-monolith/stack direction remain. References to publication review below describe the original design context, not a current gate. D5 is direction-only VPS Docker + S3-compatible storage in Vietnam; see [current authority](../tasks/GCMS-DOCS-001.md). The original text and historical evidence are retained.

## Context

godent-cms needs tenant-isolated dental websites, structured content, controlled publication and consultation leads. Long-term maintainability and modest operating overhead matter. The workspace began empty.

The initial proposal used Node.js and pnpm. Khiêm explicitly requested Bun instead and approved the revised setup/documentation plan. This is the project's first runtime decision; no Node.js implementation or inherited project decision exists.

## Decision

Use Bun as application runtime, TypeScript, Bun workspaces and a committed text bun.lock. Select and pin exact compatible versions during a separately approved application bootstrap.

Retain Next.js for public websites and the CMS, NestJS with its Express adapter for the API, PostgreSQL 18 with Drizzle for persistence, and an isolated Better Auth integration. Organize the backend by business capability with explicit contracts. Begin with one API deployment and a separately runnable worker sharing application modules.

Runtime/process selection must be explicit. Preserve Next.js's own production build pipeline. Prove framework, authentication, database/RLS, media and worker compatibility before broad application work.

## Alternatives considered

- **Node.js plus pnpm:** replaced at the user's request; no application migration is needed.
- **Bun-native framework replacement:** not selected merely because the runtime changed. A framework change needs an evidenced reason and reviewable scope.
- **Microservices:** no current scale, team or isolation requirement justifies their deployment/coordination cost.
- **Generic unstructured CMS records:** insufficient for dental relationships, publication review and tenant-consistent references; structured types plus configurable sections are the baseline.
- **Separate database per tenant:** possible future isolation option; shared PostgreSQL with application authorization, database constraints and row-level security is the current proposed operating approach. Validate scale and contractual requirements before implementation.

## Consequences

Fewer initial deployments and one main language/toolchain reduce operating complexity. Module boundaries still require discipline. Shared infrastructure increases the importance of tenant/context/cache isolation and measured limits.

Bun's Node API compatibility is not assumed complete for chosen dependencies. Authentication integration, PostgreSQL jobs, browser tooling and media processing need actual proof. Report any Node-only tool dependency; do not silently switch runtime.

Exact versions, providers, budget, scale targets and operating policies remain open. Nothing in this ADR authorizes packages, migrations, deployment, paid services or global configuration.

## Sources

- [Approved setup task](../tasks/GCMS-SETUP-001.md)
- [Architecture contracts](../architecture.md)
- [Bun Next.js guide](https://bun.sh/guides/ecosystem/nextjs)
- [Bun compatibility](https://bun.sh/docs/runtime/nodejs-compat)
- [Drizzle Bun SQL](https://orm.drizzle.team/docs/connect-bun-sql)
