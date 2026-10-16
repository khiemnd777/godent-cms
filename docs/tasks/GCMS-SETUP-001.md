# GCMS-SETUP-001 — Agent Kit and project documentation

## Assignment

| Field | Value |
| --- | --- |
| Plan / revision | GCMS-SETUP-001 v2 |
| Developer / task owner | Current Codex main session under Khiêm's approval |
| Role / runtime | Setup Project Coordinator / Codex desktop; exact client version and effective model/effort unavailable |
| Branch / base commit | main / none; fresh local repository |
| Goal | Establish fresh local Agent Kit governance and a durable Bun project baseline without implementing the application |
| Completion level | Documentation and static package verification; native/runtime discovery and human acceptance remain separate |
| Current state | SETUP_COMPLETE_STATIC_VERIFIED; human acceptance not recorded |
| Shared writer | This setup Project Coordinator owns context, plan, state, requirements, architecture and integration |

## Direct human authorization

On 2026-10-15, Asia/Ho_Chi_Minh, Khiêm wrote in the initiating conversation:

> Approved GCMS-SETUP-001 v2. Khởi tạo Agent Kit và tài liệu dự án với Bun như đề xuất, chưa triển khai ứng dụng.

The preceding v2 proposal changed Node.js to Bun and recommended Bun workspaces/package management. It retained the original scope: pinned Agent Kit import, fresh project records, local Git initialization and setup verification.

Latest restriction: no application implementation. No approval exists for dependency installation, application scaffolding, package manifests/lockfiles, database/migrations, service execution, synthetic application fixtures, paid services, global configuration, commits/pushes, remote creation, DNS or deployment.

No inherited approval, kit verification result, prior Godent configuration or AI-authored status grants authority. This record preserves the human message; a future session must verify its provenance before relying on it.

## Scope and ownership

Owned paths: root AGENTS.md, CLAUDE.md, README.md, CONTRIBUTING.md, LICENSE, .gitignore; .agents/**, .claude/**, .codex/agents/**; docs/**; scripts/verify_agent_setup.py; local .git initialization only. Preserve any unexpected user work.

Permitted tools: read the named public sources; write the approved local documents/configuration and verifier; inspect Git; run Python standard-library package checks and version checks. No native delegation or independent reviewer was run. Do not stage, commit, push or add remotes.

Dependencies: exact pinned Agent Kit source and the human v2 approval. The Project Coordinator is the sole writer of shared records. Model selection inherits the developer's runtime intent; no model/effort/permission override is configured. Effective child model and permissions remain Unknown.

Sources/skills: the user's goal and v2 correction/approval; [product scope](../product-scope.md), [reference analysis](../reference-analysis.md), [adoption](../agent-kit/adoption.md); git-workflow from the current environment, Agent Kit planning-and-task-breakdown and documentation-and-adrs. TechNote Level 1 applies; the user controls progression and silence does not mean approval.

## Setup acceptance

| ID | Required outcome | Current evidence |
| --- | --- | --- |
| S1 | Exact source identity, license notices, retained 17 skills, mirrors and native definitions | PASS: pinned source blobs, 81 maintained hashes, 28 mirror pairs and retained notices; definitions are Written only |
| S2 | Fresh context/plan/state/task/evidence; only this setup approval active | PASS: one project task; historical kit tasks excluded and provenance linked upstream |
| S3 | Bun baseline, scope, architecture, ownership, reference findings, acceptance and open decisions recorded | PASS: source review across project records and ADR-001; application claims remain unimplemented |
| S4 | Hashes, mirror provenance, local links, frontmatter, adapter syntax and setup boundaries pass appropriate checks | PASS: project setup checker and original package recipe; actual results linked below |
| S5 | Fresh main with no imported history, commits or remote; no application/global/external mutation | PASS: initialization-only check and final Git inspection; local writes only |
| S6 | Written/static evidence separated from client discovery, invocation, behavior, human acceptance and release | PASS: evidence table explicitly retains NOT_RUN/Unknown limits; no native or application claim |

Native discovery is attempted only if this live client exposes the installed repository definitions. If not, record NOT_RUN with a concrete next action; never substitute static parsing or another agent. Setup completion may be reported as STATIC_VERIFIED; native compatibility remains Unknown.

## Implementation and repair notes

- Initial inspection: empty workspace, no Git repository and no ancestor AGENTS.md files found.
- Template pinned to 919ce6b8d84c8ac5ad4ce473ad6e6c2c9973d2ac; only instruction/docs package imported.
- The first package write created the upstream skill license. Sandbox directory creation under .agents was then denied before the remaining batch wrote files.
- Focused repair: inspect the partial tree, preserve the identical license, request narrow runtime permission for the approved repository-local import and Git initialization, and verify all imported content afterward. The runtime request succeeded. No sandbox setting or role permission was changed.
- Local Git initialized on main without upstream history, a commit, remote or global Git configuration.
- Local Bun 1.3.1, Python 3.13.3 and Git 2.50.1 observed. The earlier planning pnpm/Corepack probe failed to reach the package registry; it is superseded as a toolchain choice by Bun and does not block documentation setup. No package installation was attempted in this task.
- Upstream historical task/results links remain immutable external provenance, not local approvals.
- The first checker run reported three false positives for the unchanged Claude adapters' explicit model: inherit. Source inspection confirmed the inheritance intent. Focused repair accepted only omitted/inherit model selection while still rejecting explicit model pins and permission/tool overrides; subsequent static checks passed. No adapter source or protection was weakened.
- The checker exposes --setup-only for one-time initialization boundaries. Ordinary future package checks do not require empty Git history or prohibit an independently approved application.

## Verification and review

The Project Coordinator completed sequential source review and the applicable static checks. No independent native reviewer ran. [Verification results](../verification-results.md) record commands, observed counts and limits. Review covered the setup allowlist, manifest provenance, retained roles/skills/licenses, approval separation, Bun consistency, dental/tenant boundaries, traceable acceptance and truthful commands.

Static checks invalidate when the relevant files, manifests, source identity or checker change. They do not establish native registration, effective child settings, application security or runtime behavior. A missing native selector blocks that claim, not independent documentation work.

## Coordinator checklist

- [x] Read current plan, approval and latest restriction; task is covered.
- [x] Preserve Bun baseline, fresh data/authority boundaries and single-writer ownership.
- [x] Define setup acceptance, verification scope and source identity.
- [x] Inspect actual output and evidence limits.
- [x] Integrate/review and repair routine setup findings within valid approval.
- [x] Close Bun feedback across every active project surface.
- [x] Reconcile task, state, evidence and next action.
- [x] Record the outcome and remaining proof for delivery.
- [x] Keep future application work unapproved.

## Handoff

Receiver: Khiêm. Setup is complete with static proof. No committed/integrated revision exists; all outputs remain local and unstaged on main. Native discovery, invocation, effective child settings, Claude/two-machine behavior and all application checks remain NOT_RUN or Unknown. Human outcome acceptance is not recorded.

Next action: review the setup output and propose a separately bounded Bun compatibility/M1 task if requested. This approval does not authorize starting application work, installing/upgrading Bun or dependencies, Git delivery, remote resources or deployment.
