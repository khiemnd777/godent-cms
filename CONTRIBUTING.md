# Contributing to godent-cms

Read [AGENTS.md](AGENTS.md), [team policy](docs/team-policy.md), [project context](docs/project-context.md), [plan](docs/project-plan.md), [state](docs/project-state.md) and the task record before editing.

## Current scope

The repository contains documentation and Agent Kit only. Do not infer application authority from project goals, architecture documents, examples or setup completion. A task needs direct human approval covering its current revision, owner, files, checks and side effects. Routine work under valid approval continues without per-file approval.

Khiêm is Project Lead. Desktop main owns GCMS-DOCS-005/shared records and final integration inspection. This run has one explicitly authorized bounded documentation execution writer acting on its behalf, no parallel writer and no new agents; independent decision authority is not transferred. Otherwise, the designated coordinator writes shared records and task owners write their assigned records. Future implementation owners are unassigned. Preserve other developers' work.

The latest [GCMS-DOCS-005](docs/tasks/GCMS-DOCS-005.md) saves the canonical [master plan Draft v0.2](docs/project-plan.md), not implementation authority. Shared Next app5891 contains Platform Admin `/platform` and Tenant CMS `/cms`, separate layouts/navigation/shared components/API5890; public Next5892 stays separate. Backend authorization governs protected effects, not prefixes. S01 includes both administration/public shells and runtime proof only; no tenant schema/fixtures/login/CRUD claim. S02 adds tenant/auth/private data, S03 editor/publish. Next is a detailed S01 review/implementation-plan proposal; open account/MFA/catalog choices do not block saving or scaffold planning.

## Current product decisions

[GCMS-DOCS-001](docs/tasks/GCMS-DOCS-001.md) records the direct documentation approval and authoritative D1–D4 corrections. Follow [ADR-002](docs/decisions/002-simple-tenant-cms.md), [access control](docs/access-control.md) and [workflows](docs/workflows.md): one organization/site, ordinary location rows, minimal platform/tenant administrators, all own-tenant leads, and Draft → Published by the same administrator. No branch authorization, mandatory clinical review or separate publisher/lead-view capability is required. Permission to publish patient-derived media and current revocation still apply.

[GCMS-DOCS-004](docs/tasks/GCMS-DOCS-004.md) / [ADR-005](docs/decisions/005-local-mvp-and-content-fallback.md) record approved local endpoints/Redis/S3, Published VI fallback, section builder and accepted media/lead/quota/domain/tenant lifecycle policies. See architecture for ports/internal-network/session boundaries, and workflows for canonical semantics. Cookies are not port-isolated, no local proxy/BFF is mandated; production admin-origin proposal stays production-only. Account creation/recovery/MFA policy and exact initial theme/section catalog remain open. D5 is only moderate VPS Docker + S3-compatible storage in Vietnam; concrete production choices and AC-09 are deferred beyond local MVP. Do not import the unapproved PostgreSQL-on-VPS/no-HA/offsite-backup advisory. Local security/isolation/functional/D4 proof still applies. D4 lead/audit retention is approved and distinct. Product-policy approval, documentation delivery acceptance and future execution authority remain separate.

[GCMS-DOCS-002](docs/tasks/GCMS-DOCS-002.md) / [ADR-003](docs/decisions/003-platform-path-and-custom-domain.md) established platform-path and verified custom-host entry to one tenant/site, publication state and lead list. Use the [canonical resolver](docs/architecture.md#public-entry-resolution); do not infer tenant from hostname alone on godent.vn or reinterpret a custom-host path as another tenant. Registration is human-reported; no DNS/TLS serving proof or configuration action is authorized. Prior [GCMS-DOCS-003](docs/tasks/GCMS-DOCS-003.md) / [ADR-004](docs/decisions/004-primary-url-and-301-redirects.md) approve Godent as initial primary/self-canonical, then custom primary after explicit active same-tenant admin activation of its own verified active binding, valid TLS and equivalent eligible published pages. Godent public GET/HEAD aliases then return 301 directly to equivalent same-language pages; no draft publication or blanket API/admin/preview/media/intake POST redirect. Exact locale/reserved names/slug lifecycle, detailed later domain lifecycle and DNS/TLS implementation remain deferred.

## Development baseline

Bun is the runtime baseline. Use Bun workspaces and a text Bun lockfile when application bootstrap is approved. Choose and pin compatible dependency versions in that task. Use explicit Bun execution for CLIs with Node shebangs. Verify actual process runtime; a Bun package installation does not prove that a process uses Bun.

No application commands are available yet. Do not install dependencies, start infrastructure or create synthetic runtime data as a side effect of documentation checks.

Apply the [project effort matrix](docs/task-effort-policy.md) before substantive work or delegation. A task category plus risk determines exact effort; role names do not. Use general inheritance only for genuinely unclassified work. Keep model selection unchanged and report requested/observed settings separately. The classifier emits intent; the [runtime check/launcher](docs/task-effort-policy.md#runtime-execution-and-observation) compares actual metadata and binds new CLI execution to the matrix. At task boundaries verify the coordinator; for native children use exact routed spawn arguments and verify role/parent/model/effort. A mismatch blocks affected work. The current desktop turn cannot change its own effort.

## Checks and review

Run `python3 -B scripts/verify_agent_setup.py` for relevant agent-package changes. The check uses Python's standard library and writes no repository files. It checks package consistency, not effective permissions, native discovery or application security.

Use behavioral tests appropriate to future tasks. Keep source checks, runtime behavior, human acceptance and release authority distinct. Record FAIL or NOT_RUN honestly. Use English TechNote and preserve exact product labels.

Do not expose secrets, patient information, lead details or another project's private data. Elite Dental is a functional reference; do not copy its protected material.

## Git and upstream updates

No commit, push, remote creation or release is authorized by the setup task. Keep ordinary Git delivery separately scoped.

For a future Agent Kit update, inspect the pinned source and local adaptations, propose a bounded update and preserve fresh project records. Keep the upstream snapshot manifest immutable. Update local digests only for reviewed changes, retain provenance and rerun applicable checks. Do not modify global configuration.
