# Local development and verification

## Current M3 local operation

The [complete approved M3 plan and execution ledger](tasks/GCMS-M3-001.md) governs S09–S12. M1/AUTH/S01–S08/M2 remain HUMAN_ACCEPTED; M3 S09–S12 is [HUMAN_ACCEPTED](tasks/GCMS-M3-001.md#human-m3-acceptance--2026-10-16) within recorded local scope. Acceptance adds no runtime proof or new execution authority; historical FAIL/Unknown/NOT_RUN remain unchanged. [ADR-012](decisions/012-local-m3-dental-content.md) records the contracts. Existing Bun1.4.3, ports, database, storage and credentials are retained; no dependency version/global Bun/DNS/TLS/external email/deployment change is required. Historical procedures below do not authorize resets or old backlog dispatch.

Use project-local `./node_modules/.bin/bun`. [package.json](../package.json) aliases select the exact scripts/local flags/private env used in M3 evidence:

| Command | Scope |
| --- | --- |
| `bun run m3:bootstrap` | Assert/create only the owner-scoped M3 namespace; no credential change. |
| `bun run m3:migrate` | Allowlisted forward0025–0031 in one transaction/advisory lock, every retained checksum verified, no dispatch. Stop the positively identified owned launcher before0031 so SQL/API continuation contracts change together. With the private migration env, `scripts/m3-migrate.ts --local-m3 --through=0031 --compile-only --probe-content` rolls back intentionally. |
| `bun run m3:fixtures` | Two new tenants/four synthetic identities and owned service/site, exclusive0600manifest. Complete manifest returns without reset. |
| `bun run m3:demo` | Seventeen owned content resources, three locations/three prices/two shared-FAQ articles, two generated images through native processing. Complete manifest preserves later browser edits. |
| `bun run m3:worker-scope` | Explicitly enroll only the two owned M3 tenants in content invalidation; this command never dispatches. |
| `bun run start:m3-worker -- content --tenant <owned-M3-tenant-id> --once` | One claim with minimal execute-only worker environment. `ownedObjects:0` describes delivery invalidation, not physical asset deletion. Omitting `content` selects the separately scoped Media worker. |
| `bun run test:m3:unit` | Pure M3 input/transport/CMS/public checks; no integration hooks. |
| `bun run test:m3` | Explicit M3_INTEGRATION=1; manifest-owned tests and actual ephemeral API/SQL/storage/native/isolated retention cases. Raw output0600private, filtered dated evidence. Do not rerun old broad mutating suites as a substitute. |
| `bun run m3:performance` | Dedicated owned tenant,1000published synthetic articles/2categories, tenant-role/RLS EXPLAIN and sparse reverse measurement. Complete data reused; no planner disabling/global instrumentation/production extrapolation. |
| `bun run m3:readonly` | Anonymous SSR/list/detail/media/status, migration hashes and exact known-value secret scan; no product mutation. |
| `bun run m3:preserve` | Original-column retained row/file comparison against exclusive .local/m3-baseline.json. Narrow session/rate/challenge expiry, launcher metadata and original-prefix log appends only. Not backup/restore. |

Demo [public service](http://localhost:5892/m3-8a09242b-a/dich-vu/cham-soc-rang), [CMS](http://127.0.0.1:5891/cms). Synthetic login secrets remain only in private `.local/m3-fixtures.json`. Admin/API use127.0.0.1, public useslocalhost; current session/origin/CSRF boundaries remain. Do not bypass browser CAPTCHA confirmation through another submission path; keep that exact browser action separate from API proof.

Public VI responses use no-store/noindex. Directed references remain pinned until deliberate parent publication; reverse discovery by resource identity keeps eligible older pins within the current generation. Unavailable pages return404 before streaming. Complete graphs/list/service-links DTOs stay within1MiB; a byte-limited page can contain fewer than20cards with continuation after the last returned ID. M3 JSON commands admit512KiB; other JSON stays64KiB and uploads5MiB. Resource invalidation owns no copies; global Media withdrawal remains physical derivative purge.

Permission history uses separate default50/max100 source-side pages, exact microsecond timestamp/ID cursors and authorized singleton refresh. The CMS preserves loaded history and pending polling even when a new draft removes its image. The explicit opt-in `apps/api/test/m3-permission-browser-fixture.ts --m3-permission-browser-fixture` creates a separate205-grant case; `apps/api/test/m3-historical-image-browser-fixture.ts --m3-historical-image-browser-fixture` creates a new isolated doctor/article patient-derived image scope with PublishedV1 and pendingV2image:null. Both require `M3_INTEGRATION=1` and the same five private env files as `test:m3`, record private ownership before writes, and leave new records for browser verification. They are optional fixture creation, not ordinary startup or cleanup. Do not rerun to reset a completed journey. The existing completed demo command returns `reset:false` and preserves browser changes.

`./node_modules/.bin/bun --no-env-file scripts/m3-runtime-checks.ts --local-m3` checks the actual owned listener ancestry/executable and six health/ready/redacted statuses. It does not infer Node from Next's process title or claim persistent availability.

Audit braces remains **FAIL/open** under the fresh bounded local-M3 assessment. Reassess2026-10-22 or earlier patch/dependency/exposure change and before Production. No Production waiver, commit, push or deploy follows.

## Current M2 local operation

M2 v0.1/S06–S08 has direct local execution approval; see [the complete task and evidence limits](tasks/GCMS-M2-001.md) and [ADR-011](decisions/011-local-m2-retention-media-editorial.md). No Git delivery, deployment, external provider or production action is authorized. Earlier S06+ restrictions below describe historical checkpoints.

The API reads only the selected media signing/bucket/scoped storage fields from ignored `.local/m2.env`0600. It does not inherit S06/S07 worker or migration credentials. The decoder image has no private mounts/network/credentials. The workspace lock preserves its package-version set; Sharp0.35.5 is now a direct API edge. API readiness never dispatches jobs.

Existing PostgreSQL/Redis/SeaweedFS services retain their containers/configuration and credentials. The new M2 media bucket has its own dynamically loaded scoped identity; original static storage configuration is unchanged. Bootstrap verifies an owned marker, filtered enumeration, cross-bucket request403 and unsigned403. The denial-control collection cannot allocate a volume in the retained local topology; its object write is NOT_RUN/failed capacity, not successful storage proof. No capacity/configuration expansion was performed.

| Command from repository root, pinned Bun1.4.3 | Local scope |
| --- | --- |
| `./node_modules/.bin/bun run m2:bootstrap` | New narrow worker identities and private config; explicit local identity checks; preserve existing credentials |
| `./node_modules/.bin/bun run m2:migrate` | Apply only approved forward migrations; verify every retained checksum; no dispatch |
| `./node_modules/.bin/bun run m2:storage` | New bucket/dynamic scoped identity and boundary checks; no service restart/static config rewrite |
| `./node_modules/.bin/bun run m2:fixtures` | Two new owned UI tenants/initial synthetic data; complete rerun refuses to reset browser changes or deleted leads |
| `./node_modules/.bin/bun run test:s06` | Input/capture/worker-environment/service and actual retention API/SQL cases; new M2 evidence |
| `./node_modules/.bin/bun run test:s07` | Input/security/native decoder, actual Docker lifecycle, API/private storage/worker/fault/race cases |
| `./node_modules/.bin/bun run test:s08` | Editorial input and actual history/restore/publish/unpublish/replay/transaction/race cases |
| `./node_modules/.bin/bun run start:m2-worker s06 --tenant <selected-new-tenant-id> --once` | Explicit manifest tenant and per-lead allowlist, restricted execute-only role; private generic retention capture/audit expiry |
| `./node_modules/.bin/bun run start:m2-worker s07 --tenant <selected-new-tenant-id> --once` | Explicit manifest media tenant, restricted role, bounded process/purge batch; no old backlog enrollment |

Aliases map to the verified scripts; task/evidence records the exact invocations. New synthetic browser identities are stored privately in `.local/m2-browser-identities.json`0600. This avoids the existing session response's100-membership cap on heavily reused test identities; old users/passwords and the AUTH product contract are unchanged. Synthetic verified accounts are fixture-only; normal invitation/onboarding remains the existing workflow. No credentials belong in chat or screenshots.

Retention capture uses `.local/m2-retention-mail`0700 and0600files. It contains generic subject/sign-in notice and recipient delivery identity, with no private lead payload. S06 deletion only processes explicitly enrolled new lead IDs. Audit expiry includes selected365day synthetic cases; it does not sweep historical global authentication records. Operational backup restore and natural180/365day waiting are not claimed.

If native decoder settlement is unknown, the media worker first durably marks the job failed and tenant native processing blocked. It then writes/fsyncs an exclusive0600 `.local/s07-recovery-<error-id>.json` mapping job/tenant/asset/fence/worker to exact container ID/name/nonce, without bytes/object keys/secrets. A receipt-write error does not clear the DB latch or continue the batch. The CLI reports only blocked state and the private receipt path. Generic API retry cannot unblock it. Resolve the exact recorded labelled container and verify real termination/removal before an authorized owner clears the latch; never kill all decoders or infer termination from CLI timeout. Manual operator unblock remains NOT_RUN; actual lifecycle mapping, durable block, receipt failure and continued withdrawal/purge have separate tests.

Independent M2 audit is FAIL/open for the known high braces advisory. Reassess2026-10-22 or earlier patch/dependency/exposure change and before production. Source/trace exposure evidence and the bounded local-only deferral are in [the independent review](evidence/m2/review.md); no production waiver applies.


**M1 result — HUMAN_ACCEPTED — 2026-10-16.** Khiêm directly stated “Nghiệm thu Chặng 1.”; [full acceptance and next-stage direction](tasks/GCMS-M1-UAT-001.md#human-m1-acceptance-and-next-stage-direction--2026-10-16) record the source. Technical status remains VERIFIED_LOCAL_UAT_COMPLETE with the existing scoped local evidence and historical FAIL/NOT_RUN limits. S01–S05 and AUTH remain HUMAN_ACCEPTED. Khiêm will create a separate thread to plan each slice of all M2; M2 as a whole is not accepted, and S06–S18 execution remains unapproved. Acceptance adds no runtime proof, Git delivery or deployment authority.

**AUTH result — HUMAN_ACCEPTED.** Khiêm directly stated “Nghiệm thu AUTH.” in the latest [approval](tasks/GCMS-AUTH-001.md#human-acceptance-and-m1-closure--2026-10-16). Password-only implementation and prior scoped API9tests/79assertions/build/type/lint/browser/worker evidence remain valid. Historical failed/NOT_RUN records are preserved; MFA-only cases are SUPERSEDED, not PASS. Natural eight-hour waiting and the exact unavailable historical c300/tenant navigation remain NOT_RUN as execution modes; controlled boundary and accessible equivalent-component proof satisfy the criteria. `braces` audit stays FAIL/open under the bounded local deferral, reassessment2026-10-22 or earlier patch/dependency/exposure/before production. No dependency upgrade, Git delivery, deployment, full-MVP/production or S06+ authority follows.

**Current S05 scope — HUMAN_ACCEPTED — Khiêm directly stated “Nghiệm thu S05.” on2026-10-16 Asia/Ho_Chi_Minh.** Historical technical CODE_INTEGRATED/scoped local verification/READY_FOR_USER_REVIEW and API/worker32tests/472assertions, admin29/101, scoped final browser/five-width checks, build/type/lint/diagnostics/runtime PASS. [Final task ledger](tasks/GCMS-S05-001.md#final-local-handoff--2026-10-16) records exact proof and historical failures. Browser expired-lead removal/Enter-triggered outage recovery and backup restore remain NOT_RUN. Independent source review CLOSED; audit FAIL/fresh local-S05 deferral, final33traces/zero advisory-chain references, reassess2026-10-22 or earlier stated triggers. Root post-release preservation/exact-value secret scan/final static checks PASS within the final task ledger; dated snapshots are refreshed mechanically after this factual closure. S01–S05 HUMAN_ACCEPTED; no S06+/external email/full-MVP/production/Git/deploy claim. [Human acceptance provenance](tasks/GCMS-S05-001.md#human-acceptance--2026-10-16); acceptance adds no runtime proof or execution authority.

**Historical S04 scope — HUMAN_ACCEPTED.** Khiêm directly stated **“Nghiệm thu S04.”** on **2026-10-16, Asia/Ho_Chi_Minh**, desktop thread `01a1402c-3c81-7933-9927-d974f70c9fbc`; desktop verified the direct human source. Historical technical CODE_INTEGRATED + VERIFIED_LOCAL_API_SSR + READY_FOR_USER_REVIEW and check limits are unchanged. [S04 v0.1/D01–D10](tasks/GCMS-S04-001.md) was directly approved by Khiêm on2026-10-16 Asia/Ho_Chi_Minh: “Approve. Đồng ý triển khai S04 v0.1 trong phạm vi đã planned.” [ADR-008](decisions/008-local-consultation-intake.md) records settled local intake/read-only lead contracts; [canonical API types](../apps/api/src/contracts/s04.ts) and [shared input rules](../apps/api/src/contracts/intake.ts) define concrete shapes. Real browser phone/email→API/PG→A1/A2 read and actual25tests/313assertions pass within the task ledger. CAPTCHA solving/submission, public unknown-timeout/same-key browser retry and full cursor UI sequence remain NOT_RUN. Controlled CMS GET loading/outage/keyboard retry now PASS without new submissions; local challenge-required observation is separate. S01–S04 are HUMAN_ACCEPTED. No dispatcher/email/retention worker/S05+ or full-MVP/production claim; final integration/preservation/secret checks are recorded separately.

## Current password-only local operation

Open administration at `http://127.0.0.1:5891/login`. Platform Admin and Tenant Admin use verified email and password, including retained accounts formerly enrolled in MFA. Use the delivered ignored private `.local/m1-uat-login-handoff.md`/retained credential manifest privately; no password reset/factor entry is needed for an existing account. Do not paste secrets or captured invitation/verification/reset links into chat/screenshots. The former TOTP/setup/backup instructions below describe old releases only.

After the one-time AUTH cutover, old cookies/reauth grants are invalid; sign in again. Tenant membership/resource authorization still controls `/cms`; PlatformOnly uses `/platform` and gains no private tenant data. Sensitive actions prompt for the current password when5-minute assurance has expired. Sessions have the retained absolute8-hour limit. Logout/reset/account disable invalidate relevant sessions; do not restore old tokens or use stale client membership as authorization.

New-user onboarding is fixed local invitation→name/password registration→captured email verification→sign-in/membership acceptance, with no MFA enrollment. Reset uses a generic request response and single-use30-minute local captured token; no OTP. AUTH permits automatic isolated installed-Playwright flows/new-owned UAT credentials within the existing fixture budget. Preserve old fixture passwords; local mail stays ignored `.local/s02-mail`0700directory/0600files, with no external delivery.

| Current route (API `http://127.0.0.1:5890`) | Current operation |
| --- | --- |
| `GET /api/session` | Current actor/memberships/CSRF contract without active MFA fields |
| `POST /api/session/reauth` | Current password-only5-minute assurance; same current session/permission checks |
| `/api/auth/sign-in/email`, `/api/auth/sign-out` | Password login/logout for both roles; no TOTP challenge |
| `POST /api/auth/invitation-register` | Fixed invitation identity; name/password only, no role/tenant selection or MFA step |
| `/api/auth/send-verification-email`, `/api/auth/verify-email` | Private local verification; no public token/log sharing |
| `/api/auth/request-password-reset`, `/api/auth/reset-password` | Generic request/single-use reset/session revocation under password-only policy |
| `/api/auth/two-factor/*` | Removed from the current supported contract; never follow the historical enable/verify/backup instructions below |

Normal root command aliases remain `./node_modules/.bin/bun run typecheck`, `lint`, `build` and `start:local`; no new AUTH alias/dependency is introduced. Production-mode build precedes an owned-app start, and `start:local` uses sanitized runtime environments. Leave already-owned running apps alone unless the coordinator is performing an authorized restart. Do not rerun bootstrap/fixtures/migrations to obtain a login or clear an unexplained failure. The historical setup commands below retain their dated scope, not blanket reset authority.

Root checkpoint: both-role password login, new onboarding/publication/lead assignment+filter/recipient settings, three-of-three bounded local worker captures, exact command replay with one history/receipt and five-width/Tab checks PASS within their actual artifacts. Final bounded API9tests/79assertions and login-tail continuation PASS; fresh browser invitation-expiry/natural8-hour wait NOT_RUN. This operational result is not automatic M1 closure/human AUTH acceptance/production proof. Ordinary authentication user IDs are opaque text, not necessarily UUID.0014 fixes the assignment predicate after the shared TypeScript validator repair; tenant/resource UUID contracts are unchanged,0013 is immutable and session invalidation is not repeated.

## Runtime and installation

Selected and pinned: project-local Bun 1.4.3, TypeScript 5.9.3, Next 16.4.1, React 19.3.1, Nest/Express 12.1.3, Drizzle 0.45.4 with `Bun.SQL`, Better Auth 1.7.10, Redis client 6.3.0 and S3 SDK 3.1152.0. The machine's global Bun 1.3.1 is unchanged. Next production builds failed on that older runtime and passed on the project-local runtime; app processes do not fall back to Node. Node may execute the reviewed Bun package installation script; that is not an application runtime claim.

Run from the repository root with Docker Desktop available. Bootstrap with an existing Bun installation, then use the pinned local executable:

```sh
bun install --frozen-lockfile
./node_modules/.bin/bun --version
./node_modules/.bin/bun run setup:local
./node_modules/.bin/bun run infra:up
./node_modules/.bin/bun run typecheck
./node_modules/.bin/bun run lint
./node_modules/.bin/bun run test
./node_modules/.bin/bun run build
./node_modules/.bin/bun run check:services
./node_modules/.bin/bun run check:api
```

`check:api` owns port 5890 temporarily and must run before `start:local`, or after stopping that launcher. `check:services` requires the three Docker services. Build precedes production-mode start. For current S02 startup, complete the S02 steps below before `start:local`. S01 check commands above retain their original technical-trial scope. First dependency/image acquisition needs network access. Fresh frozen installation and Next lint were verified with no project credentials in the temporary copy/environment; lockfile bytes remained unchanged. [Install policy evidence](evidence/s01-install-policy.json) records the exact proof and limits.

Only `bun` is in `trustedDependencies`; its reviewed postinstall selects the exact optional platform binary. Other dependency lifecycle scripts are denied. Keep optional dependencies enabled. If Bun's installer reports an npm/download fallback, stop and investigate before proceeding. Initial historical installs used Bun's curated default policy; the later explicit policy does not retroactively change that fact. Do not replace the lockfile or broaden trust to bypass an installation failure.

`setup:local` generates checkout-specific `.env` and `.local/s3.json` with mode 0600 and `.local` mode 0700. It preserves existing credentials and refuses inconsistent existing configuration. These paths are ignored. Do not print, copy into browser bundles or commit them. Do not regenerate credentials against existing PostgreSQL volumes as a password reset.

## S02 local preparation and start

**Historical pre-AUTH procedure/reference.** Retained for dated S02/S03/M1 evidence. Mandatory MFA/TOTP/backup steps and human-only onboarding instructions here are superseded by the current password-only operation above and ADR-010; they are not current operational requirements. Existing results/NOT_RUN are unchanged.

Retain the existing `.env`, Docker project `godent-cms-s01`, volumes and original PostgreSQL administrator credentials. Bootstrap needs the original root `.env` administrator `DATABASE_URL`; never replace that credential with a tenant runtime URL in the retained file. The bootstrap validates loopback port5888/database `gcms_s01`/original `gcms_local` identity and refuses unowned role/schema collisions. Its role configuration is private `.local/s02.env` mode 0600; `.local` is mode 0700.

After infrastructure readiness, execute in this order from the repository root, within approved local S02 authority:

```sh
./node_modules/.bin/bun --env-file=.env scripts/s02-bootstrap.ts --local-s02
./node_modules/.bin/bun --env-file=.local/s02.env scripts/s02-migrate.ts --local-s02
./node_modules/.bin/bun --env-file=.env --env-file=.local/s02.env scripts/s02-fixtures.ts --local-s02 --synthetic-fixtures
./node_modules/.bin/bun run build
./node_modules/.bin/bun run start:local
```

The root aliases `s02:bootstrap`, `s02:migrate` and `s02:fixtures` encode the same local flags/environment order; bootstrap uses Bun's root `.env` loading. Migration uses `.local/s02.env`; fixtures explicitly need both `.env` and `.local/s02.env`. Migrations apply in a transaction under a separate migration role with a migration lock and checksum checks; an applied checksum mismatch is an error, not permission to edit history/reset data. Fixtures preserve matching identities/records and refuse unexpected identity collisions; they do not reset existing passwords/factors or repair altered fixture state automatically. Do not rerun fixture tools as cleanup or recovery for an unexplained failure.

`start:local` and `start:api` / `start:admin` / `start:website` use `loadRuntimeEnvironment`. API receives only restricted auth/tenant/platform database URLs and necessary service credentials; its `DATABASE_URL` is the tenant role. API receives neither `POSTGRES_PASSWORD` nor the migration URL. Web processes receive no database/auth/S3 secrets. Child Bun processes use `--no-env-file` to prevent implicit `.env` loading. Do not start the built API directly with the superuser root environment. Current source requires private S02 role configuration before launcher startup; S01-only instructions no longer suffice.

### Private synthetic accounts and local mail

**Historical pre-AUTH procedure/reference.** Retained for dated S02/S03/M1 evidence. Mandatory MFA/TOTP/backup steps and human-only onboarding instructions here are superseded by the current password-only operation above and ADR-010; they are not current operational requirements. Existing results/NOT_RUN are unchanged.

Two tenants A/B and six identities are retained: A1/A2 in A, B1 in B, multiAB in both, PlatformOnly without tenant membership, noMembership without tenant membership. The ignored `.local/s02-fixtures.json` mode 0600 contains synthetic login credentials and, after enrollment, TOTP secrets/backup codes. The human can open that file locally. Do not paste its contents, passwords or factors into chat, screenshots, logs or committed docs. Existing enrolled synthetic factors can be used in the human's authenticator; the test helper `fixtureTotp` uses the installed Better Auth generator/decoder. It is not a general recovery or factor-reset command.

Fixtures alone create verified synthetic email identities; MFA enrollment remains required and test runs may already have enrolled them. New HTTP users must use invitation registration, verify the captured email, sign in and complete MFA. PlatformOnly's bootstrap platform flag exists only in the explicit local fixture path; HTTP clients cannot supply that flag or acquire platform authority by signup.

Mail is private JSON capture in ignored `.local/s02-mail` (directory 0700/files 0600), not an SMTP provider or publicly served inbox. The human can inspect the relevant invitation/verification/reset message locally and follow its local link without sharing it in chat/evidence. Registration and recovery tokens remain confidential. No real email is sent.

### Retained S02 API and private-draft contract

**Historical pre-AUTH procedure/reference.** Retained for dated S02/S03/M1 evidence. Mandatory MFA/TOTP/backup steps and human-only onboarding instructions here are superseded by the current password-only operation above and ADR-010; they are not current operational requirements. Existing results/NOT_RUN are unchanged.

All paths below are relative to `http://127.0.0.1:5890`. Source-complete routes do not prove every corresponding UI state is ready. Custom mutations require JSON, exact administration Origin and `X-CSRF-Token` from the authenticated `GET /api/session` response. Current actor, MFA, membership and recent reauthentication apply to protected effects.

| Route | Contract |
| --- | --- |
| `GET /api/session`; `POST /api/session/reauth` | Current session/memberships/CSRF; sensitive-action reauthentication |
| `/api/auth/sign-in/email`, `/api/auth/sign-out` | Email/password login and server logout; MFA challenges as required |
| `POST /api/auth/invitation-register` | Only token/name/password; server derives invited email; public `/api/auth/sign-up/email` disabled |
| `/api/auth/send-verification-email`, `/api/auth/verify-email` | Private captured-address verification; no automatic login after verification |
| `/api/auth/request-password-reset`, `/api/auth/reset-password` | Generic request response; 30-minute single-use reset revokes all sessions and preserves MFA |
| `/api/auth/two-factor/*` | Allowed enable/verify-totp/verify-backup-code/disable/generate-backup-codes/get-totp-uri endpoints; MFA changes require current/recent assurance |
| `GET/POST /api/tenants/:tenantId/services` | List/create private VI draft |
| `GET/PUT /api/tenants/:tenantId/services/:draftId`; `GET .../:draftId/preview` | Current-authorized read/versioned save/private preview |
| `GET /api/tenants/:tenantId/members`; `DELETE .../members/:userId` | Tenant membership list/revoke; atomic last-admin guard |
| `GET/POST /api/tenants/:tenantId/invitations`; `POST .../invitations/:invitationId/resend`; `DELETE .../invitations/:invitationId` | Same-tenant invitation lifecycle, single use/24h, resend voids old |
| `POST /api/invitations/accept` | Verified fixed identity accepts an active invitation, without tenant/role substitution |
| `GET/POST /api/platform/tenants`; `POST /api/platform/users/:userId/disable` | Platform provision/list and non-orphaning global disable; no tenant-private access |

Drafts accept title at most 160 characters and plain body at most 20000; body 30000 in the database is a storage ceiling, not the API contract. Saves carry `expectedVersion`; conflicts must preserve the other saved version. Draft locale is VI. Preview is private/noindex/no-store. S02 does not publish or add rich text. Tenant context belongs to the explicit request/tab, not one mutable global selected tenant.

## S03 local preparation and checks

Use the retained S02 `.env`, `.local/s02.env`, role configuration, Docker project/volumes and private synthetic identities. Do not bootstrap new credentials, reset passwords/factors or replace resources to prepare S03. Inspect current process/port owners and retained data before changing anything. New S03 records are separately owned synthetic fixtures; existing S02 authentication and legacy drafts must remain intact.

From the repository root, after the S02 prerequisites and infrastructure readiness:

```sh
./node_modules/.bin/bun run s03:migrate
./node_modules/.bin/bun run s03:fixtures
./node_modules/.bin/bun run test:s03
```

`package.json` defines the exact aliases. **`s03:migrate` intentionally calls the existing `scripts/s02-migrate.ts --local-s02` runner with `.local/s02.env`**, not a new S03 runner or reset command. That runner applies ordered pending migrations under the restricted migration role in a transaction with lock/checksum protection, including S03 `0004`. Already-applied checksum changes fail; do not edit/reset applied history. `s03:fixtures` loads `.local/s02.env` and calls `scripts/s03-fixtures.ts --local-s03 --synthetic-fixtures`. The fixture tool adds owned S03 A/B/revocation tenants and memberships for retained identities, without creating/replacing passwords/factors. It refuses unexpected tenant ownership/manifest collisions. Do not use fixture reruns as recovery for unexplained altered data.

The ignored mode-0600 `.local/s03-fixtures.json` contains S03 tenant/service identifiers. Existing credentials/factors remain only in `.local/s02-fixtures.json`; the human opens them privately. Do not publish either manifest, secrets, tokens or captured mail. New S03 tenants use retained A1/A2/multiAB or B1/multiAB identities as appropriate. The initial S03 legacy example contains literal markup as text; it is synthetic, not copied patient/reference content.

`test:s03` runs content-unit and real local publication-integration suites in separate processes with the local synthetic integration flag. It loads existing private configuration and creates owned test targets; no production/real data. The [combined result](evidence/s03/combined-api-checks.json) is PASS at the current checkpoint, 19 tests/116 assertions. Browser and human acceptance remain separate checks; a separate actual owned-process restart now passes within the limits below. Normal `typecheck`, `lint` and `build` aliases remain as above; S03 full typecheck/lint/build now pass; API-unit31 passed/52 gated skipped/145 assertions and frontend-unit25 passed/93 assertions are separate from actual integration19/116. Build before using `start:local`; identify/stop only owned launcher processes through the existing stop procedure. No port-owner kill or resource reset is implied.

Coordinator reports `0004` and fixtures applied through the direct runner. [Preservation evidence](evidence/s03/draft-preservation.json) confirms 13 retained legacy drafts match on ID/tenant/title/body/locale/version. [Representative browser evidence](evidence/s03/ui/representative-flow.json) confirms existing-session A1 CMS tenant selection → create/save/reload/private preview, H2/list/literal-script rendering and desktop/mobile editor checkpoint at 1440×1080/390×844. It does not prove a fresh login or publish. [Installation evidence](evidence/s03/install.json) verifies the existing dependency tree with frozen lockfile/ignore-scripts and unchanged lock; it is not a fresh-tree install. S03 audit remains FAIL for the high dev-only braces advisory. Fresh independent S03 source/trace review is CLOSED with a scoped local deferral: zero advisory-chain references in31 Next production traces, official patched-version field “None” reviewed2026-10-16. This is not inherited S02 or production waiver. Desktop reassesses by2026-10-22 or earlier on patch/dependency/exposure change or before production; no automation.

### S03 actual process and public HTTP proof

[Process durability](evidence/s03/process-durability.json) records an actual restart of the owned application launcher processes while PostgreSQL remains retained: one intent before/after, unchanged immutable closure and public API JSON. This is not machine-crash/power-loss/backup-restore proof. [Final DB evidence](evidence/s03/database-final.json) records four migration checksums/16 catalog tables/five restricted roles and two rollback-only owner UPDATE denials with SQLSTATE23514. No applied SQL0001–0004 was changed after application. Catalog checks and effective API/restricted-role isolation tests remain distinct.

[HTTP SSR evidence](evidence/s03/ssr-http.json) verifies this real synthetic publication URL:

`http://localhost:5892/s03-synthetic-a/dich-vu/loss-98943c6a-9fe1-418f-97c0-b4b99ca27646`

Anonymous HTML without JavaScript has the published snapshot title, actualVI language, matching absolute local canonical, noindex, no-store and no admin cookie. Seven HTTP cases cover HEAD/forwarded-host/wrong-host/unknown-tenant/draft-only/encoded-path/reserved-tenant. Forwarded-host does not select another tenant; wrongHost421 and missing/draft/encoded/reserved404. These are real HTTP observations, not final browser UI proof or DNS/TLS/indexing/EN/custom-domain claims. [Final runtime](evidence/s03/runtime.json) passes after the owned three-app restart; do not assume permanent availability.

S02 scoped regression runs passed domain7/88 and pool/isolation3/50. Independent source/security review closed with no open actionable findings; selected reviewer pure19/81 overlaps earlier checks and is not independent DB/browser rerun proof. [Repair history](evidence/s03/initial-checks.json) preserves early errors and confirming checks. [Current S03 checks](evidence/s03/check-results.json) and the execution ledger identify final browser/human acceptance limits. Extra owned synthetic records remain retained; do not reset/clean shared resources.

### S03 routes and local UAT

Administration stays `http://127.0.0.1:5891`. Use `/cms`, then the appropriate S03 tenant's `/cms/services?tenant=<tenant-id>`, `/cms/services/new?tenant=<tenant-id>`, `/cms/services/<service-id>?tenant=<tenant-id>` and private preview. Site settings source is `/cms/settings/site?tenant=<tenant-id>`. The approved public route is **`http://localhost:5892/<tenant-slug>/dich-vu/<service-slug>`**. Actual public no-JS HTTP SSR now passes within the evidence below; final bounded browser publication/UI proof is now recorded separately; continuing availability remains an observation. No consultation lead form/intake or S04 behavior is delivered in S03.

The canonical [S03 types/routes/bounds](../apps/api/src/contracts/s03.ts) define the versioned site/service/publication payloads. API paths are relative to `http://127.0.0.1:5890`:

| Route | Scope |
| --- | --- |
| `GET/PUT /api/tenants/:tenantId/publication/site` | Current-authorized versioned site name/footer/tenant slug |
| `GET/POST /api/tenants/:tenantId/publication/services` | Current-authorized bounded list/create |
| `GET/PUT /api/tenants/:tenantId/publication/services/:id` | Read/save structured VI draft with expected draft version |
| `GET .../services/:id/preview` | Authorized saved private preview, noindex/no-store |
| `POST .../services/:id/publish` | Saved draft/site/publication versions and request key; current same-tenant access/5-minute reauthentication |
| `GET /api/public/sites/:tenant/services/:slug` | Eligible immutable public service; credentials must not be forwarded by the public website |

Steps below are repeatable **human review steps**. Actual completed checks and limits are in the final S03 ledger; the steps do not assert every possible browser state was exercised:

1. The human signs in with the retained synthetic account/factors privately. Select the S03 tenant, set a unique allowed lower-case ASCII tenant slug/site name/footer, and save. Preserve any active publication while changing drafts.
2. Create/edit VI title, summary, bounded rich text and SEO. Save, reload and privately preview. Confirm literal script/HTML is text, links are validated, and H2/list/line breaks are retained. Compare the editor against the approved baseline and required viewport/keyboard/states.
3. If input is dirty, save before publishing. Confirm tenant/service/VI/revision. Complete current password-only recent reauthentication; preserve retained credentials/inert legacy factor data. Explicitly publish and open the approved local URL anonymously. Check SSR HTML/metadata/absolute canonical/actual VI/local noindex without JavaScript.
4. Publish V1, save V2 as a pending draft and confirm public remains V1. Explicitly publish saved V2 and confirm public changes. Use a second administrator/tab to test stale confirmation/save/publish conflict; preserve the unsaved input and other administrator's saved revision.
5. Confirm cross-tenant/platform-only/revoked/suspended denial, same page slug in two tenants, wrong Host/path rejection and no credential forwarding/draft leakage. Failure/retry/transaction-race/OS-restart proof must be separately recorded within authorized owned-resource scope; UAT does not permit destructive resets or disabling controls.

Existing browser credential/grant policy below remains applicable. Recheck the previous native-confirmation/provider blocker with bounded recovery; do not bypass it. If blocked, record the exact affected browser checks as NOT_RUN and hand the human the pending steps. Keep API/DB evidence separate and continue independent authorized work. S03 is HUMAN_ACCEPTED. These steps remain available for review; acceptance does not execute new checks or authorize S04.

### Final S03 browser review result

[Actual browser flow](evidence/s03/ui/actual-flow.json) PASS: ordinary A1 login/existingMFA/real reauth → publishV1 → saveV2/privateV2/publicV1 → stale save409/input preserved/compare → unsaved cancel/discard → stale confirmation rejection → explicit publishV2/publicV2. The public demo is `http://localhost:5892/s03-synthetic-a/dich-vu/cham-soc-rang-dinh-ky-ui-s03`; [anonymous no-JS SSR](evidence/s03/ui-published-ssr.json) passes for this UI-publishedV2.

[Container geometry](evidence/s03/ui/container-geometry.json) passes at320/390/768/1024/1440; actual1440×1080/390×844 renders and nested editor/control geometry are recorded. Two scoped CSS selectors now restrict mobile action-bar positioning to `.editor-head > .editor-actions`, preserving static live/pending badges above the editor. Focused admin typecheck/lint/build and final390 badge/action observations pass after the owned restart; no extra DB mutation was needed for that recheck.

Bounded final states pass: cross-tenantB denies A1/no editor at390; missing owned-tenant service shows error+retry at390; an existing authorized S02 empty fixture shows0items/CTA under read-only observation. Loading was observed through accessibility; transient screenshot NOT_RUN because the state was not captured, with no forced delay. MenuEscape returns focus; admin/public console has zero errors/warnings. This is bounded UI evidence, not an assertion of every possible state. Human S03 acceptance is recorded in the task; the technical results and NOT_RUN limits are unchanged.

[Diagnostic regression](evidence/s03/diagnostics.json) PASS covers health/readiness,5 invalid/3 not-found cases,PG/Redis/S3 unavailable503 and SIGTERM/SIGINT/listener closure. [Final runtime](evidence/s03/runtime.json), [resource preservation](evidence/s03/resources-final.json), [original-draft preservation](evidence/s03/draft-preservation.json), [repository preservation](evidence/s03/preservation.json) and [exact-value secret scan](evidence/s03/secret-scan.json) retain dated scopes. All13 original draft rows including update metadata and original resources/private configuration are preserved; new owned S03 records remain. Preservation counts may be refreshed by desktop after final docs; no comprehensive secret/OCR or backup-restore claim. Runbook steps never authorize reset/destruction or later slices.

## S04 local preparation and review

**Historical slice/package procedures and checkpoints.** Preserve the dated results below; current AUTH password-only operation and final task ledger supersede old factor/manual-only/pending-status wording. No old bootstrap/reset or additional UAT authority follows.

Retain `.env`, `.local/s02.env`, original roles/passwords/factors, S01–S03 resources and publications. S04 uses its own additive bootstrap/migration path, not an old bootstrap reset. From repository root with existing infrastructure ready and pinned local Bun:

```sh
./node_modules/.bin/bun run s04:bootstrap
./node_modules/.bin/bun run s04:migrate
./node_modules/.bin/bun run s04:fixtures
./node_modules/.bin/bun run test:s04
```

Aliases in `package.json` encode exact environment order: bootstrap uses `.env` and explicit `--local-s04`; S04 migrate uses `.local/s02.env` then `.local/s04.env`; fixtures use `.env` plus both private role files and `--local-s04 --synthetic-fixtures`. Bootstrap adds only new owned intake role/schemas and private crypto setup, refuses collisions, and never resets existing role passwords. `.local/s04.env` mode0600 holds new intake URL/HMAC secret; `.local/s04-fixtures.json` mode0600 holds UI identifiers. Existing A1/A2 credentials/factors remain in `.local/s02-fixtures.json`; inspect privately, never paste secrets/tokens/contact into chat/screenshots/repository. Repeated fixture setup validates existing ownership/publication without resetting counters/records. After forward0005–0007 use `s04:migrate`, not an older migration alias that lacks S04 private-key setup. Applied0001–0007 checksums remain immutable.

Build with the normal typecheck/lint/build commands before the owned launcher start procedure above. API receives four restricted role URLs and the S04 HMAC configuration; web processes receive no server secrets. No direct superuser API start. Existing admin/session/origin controls remain. `test:s04` runs three separate unit/security/realHTTP-PG suites with owned synthetic targets; PASS25tests/313assertions. FE units32/119 and full type/lint/build pass. Selected flagged S02 regressions7/88+3/50 pass; initial flag-omitted skipped invocation is NOT_RUN. S03 original integration fixtures were not rerun to avoid retained-site mutations; read-only original SSR regression is separate proof.

Public demo: `http://localhost:5892/s04-synthetic-ui/dich-vu/tu-van`. CMS: `http://127.0.0.1:5891/cms/leads?tenant=c4000000-0000-4000-8000-000000000001`. [UI evidence](evidence/s04/ui/implementation.md) records real phone-only and email-only submissions and A1/A2 reads of the same two New leads,500/501NFC/literal text/consent/contact guards, five widths and focus/mobile-back/empty/wrong-tenant gate. No appointment is booked. No dispatcher/email delivery/retention-worker result is claimed.

The third new request genuinely requires the local challenge. **Browser solving/submission is NOT_RUN because action-time human confirmation is required.** Do not bypass it with a shared token, fake answer, counter reset or another fixture. Human review may complete the challenge under that policy; API tests already exercise pass/fail/expiry/replay/unavailable separately. Controlled CMS GET loading/outage/keyboard retry now PASS with no new submission and same-two-lead recovery. Public unknown-timeout/same-key browser retry and full cursor UI sequence remain NOT_RUN; unit/API simulations do not become browser proof. Retry after unknown transport keeps the existing key and semantic payload; no PII in URL/localStorage/sessionStorage/cookies.

Review steps: open public Published VI page; validate contact/channel/consent/message; submit within local controls; sign in privately as A1/A2 and compare masked list/full authorized detail; check mobile back/focus/denied/empty states. Two accepted UI requests already exist; do not create extra submissions just to reproduce screenshots. Keep current retained resources and new synthetic rows. Current runtime/DB/diagnostic checks and remaining final preservation/secret/static disposition are in [S04 ledger](tasks/GCMS-S04-001.md#actual-execution-and-handoff--2026-10-16). Fresh local-S04 braces deferral is independently confirmed: audit FAIL,32traces/zero chain refs, reassess2026-10-22 or earlier patch/dependency/exposure/before production, no automation or production waiver. Human S04 acceptance remains pending; no S05+ execution/Git/deploy.

## S05 local preparation and bounded worker

**Historical slice/package procedures and checkpoints.** Preserve the dated results below; current AUTH password-only operation and final task ledger supersede old factor/manual-only/pending-status wording. No old bootstrap/reset or additional UAT authority follows.

Use existing `.env`/S02/S04 role configuration/resources/auth/factors. Do not rerun old bootstrap/reset passwords/MFA or delete retained records. Approved new S05 setup from repository root uses pinned local Bun:

```sh
./node_modules/.bin/bun run s05:bootstrap
./node_modules/.bin/bun run s05:migrate
./node_modules/.bin/bun run s05:migrate:worker
./node_modules/.bin/bun run s05:fixtures
./node_modules/.bin/bun run test:s05
```

Aliases in `package.json` encode explicit local flags/environment: bootstrap root `.env`; migrate/worker-migrate `.local/s02.env`; fixtures `.env`,S02/S04/S05 private env files. New `.local/s05.env` mode0600 contains only worker role URL. New `.local/s05-fixtures.json` identifies the owned tenant/service; `.local/s05-ui-pagination.json` tracks technical pagination rows. Existing credentials/factors remain private S02 fixtures; do not print/copy them. Setup preserves applied checksums0001–0012 and existing role passwords; migrations never dispatch backlog. Worker-specific migration includes0009 and forward0010–0012. Use the new aliases, not old migration shortcuts that lack worker-scope contracts.

Actual S05 UI tenant `4e206516-529a-4799-b146-05f950214a00`: public `http://localhost:5892/s05-ui-ef95e0e2/dich-vu/tu-van`; CMS `/cms/leads?tenant=4e206516-529a-4799-b146-05f950214a00`; settings `/cms/settings/notifications?tenant=4e206516-529a-4799-b146-05f950214a00` on admin127.0.0.1:5891. One original browser intake YC-000001 plus55 technical rows makes56; only the original proves public intake. `bun run s05:fixtures --populate-ui-leads` adds the owned55 idempotently, never resets counters/first lead. `bun run s05:fixtures --enable-worker` explicitly enables only the new fixture tenant. These are scoped preparation commands, not permission to repeat capture or drain retained S04 backlog as cleanup.

After relevant production-mode builds and owned launcher readiness, the bounded local worker command is:

```sh
./node_modules/.bin/bun run start:s05-worker --tenant 4e206516-529a-4799-b146-05f950214a00 --once
```

The launcher validates selected new-fixture identity/mode0600, sanitizes environment to the worker URL and basic process variables, and starts actual Bun with `--no-env-file`. Worker receives no auth/tenant/platform/intake/migration/admin secrets. API remains on its existing four restricted roles/HMAC; web receives no server secrets. No daemon, API/migration auto-dispatch, retained S04 scope or production provider. Actual bounded polls0/1/10 and corrected future captures are recorded in [worker CLI evidence](evidence/s05/worker-cli.json); do not run another poll merely to reproduce a screenshot.

Capture directory `.local/s05-mail` is0700/files0600, separate from S02 invitation/reset mail. Receipts are idempotent per delivery ID and contain only generic notification/authorized recipient address/allowlisted `/login`, not client name/contact/message/login token. The first wrong `/sign-in`404 receipt is retained byte-identical/not resent; only later new captures prove `/login`200. A captured receipt is not email delivery. SIGTERM requests shutdown; it cannot promise already-started capture was revoked. The worker waits for I/O settlement rather than declaring timeout means stopped.

[Combined tests](evidence/s05/combined-api-checks.json) PASS32/472 across six suites; local10001-row EXPLAIN includes count423.685ms/scanning10001, not production proof. [Selected regressions](evidence/s05/selected-regressions.json) preserve gated NOT_RUN and initial error-shape failure, later1/1PASS, actual S04intake14/230 with one unchanged superseded pagination case intentionally filtered. [Retained S03 SSR](evidence/s05/retained-s03-ui-published-ssr.json), [retained S04 SSR](evidence/s05/retained-s04-public-http.json) and [current public](evidence/s05/public-http.json) are read-only regressions, not fixture mutation.

Review real assignment/note/contact/closure/reopen and shared A1/A2 history; note/email_sent do not fake Contacted, only two_way does; reopen preserves the shortened expiry. Cursor20 and50 next/back across56 actual rows and accent-sensitive name/code/filter/count proof are recorded. Final conflict/settings/five-width/fault/dirty/error/expiry breadth and tiny filtered-empty-copy rebuild remain pending callback; no fabricated complete UI claim. Existing browser credential/grant/CAPTCHA policies and historical NOT_RUN remain. No external mail/retention worker/S06+/Git/deploy.

Root final full build/typecheck/lint/diagnostics and3actualBun/6HTTP runtime PASS after the CSS repair/restart. Final retained projection468original rows/10tables and DB12checksums/15FORCERLS/7restricted roles/same3healthycontainers PASS. Root post-release preservation/secret/static PASS within the final task ledger; dated snapshots are refreshed mechanically after this factual closure. Pre-S05 private backup416259bytes/0600 exists, restore NOT_RUN; projected row checks are not restore/all-auth-row guarantees. [Fresh S05 audit](evidence/s05/dependency-audit.json) FAIL/high braces with independent scoped local deferral, final33traces/zero advisory-chain refs and independent source review CLOSED. Desktop reassesses2026-10-22/earlier patch/dependency/exposure/before production, no automation/provider/production waiver. Current task ledger is authoritative for later actual results.

## Human UAT and browser limits

**Historical pre-AUTH procedure/reference.** Retained for dated S02/S03/M1 evidence. Mandatory MFA/TOTP/backup steps and human-only onboarding instructions here are superseded by the current password-only operation above and ADR-010; they are not current operational requirements. Existing results/NOT_RUN are unchanged.

Administration URLs currently have source consumers at `/login`, `/account`, `/forgot-password`, `/reset-password`, `/verify-email`, `/cms`, `/cms/services`, `/cms/services/new`, `/cms/services/:id`, `/cms/services/:id/preview` and `/platform`. S02b source consumers include `/cms/settings/members?tenant=<current-membership>`, `/platform/accounts` and `/invitations`; their historical observed form/read/render scope is retained in the S02 ledger. Source integration does not prove sensitive browser submissions.

For credential creation/change, computer-use policy requires: “Changing a password or other authentication credential: Ask the user to take over before any new credential is entered, and have them complete the entry, confirmation, and submission steps themselves.” Grant actions require action-time confirmation: “This is required even if the user has pre-approved the action.” Therefore those automated browser submissions are NOT_RUN; focused source/API/database tests are separate proof. This browser interaction boundary does not add another project-wide S02 approval round.

1. The human opens the private fixture manifest locally and signs in at `http://127.0.0.1:5891/login`. The human completes any new-password/factor entry, confirmation and submission. Preserve existing factors; do not disable/reset them to ease testing.
2. With A1/A2, select A and save a private VI draft. Reload and preview. In another tab/session, create a version conflict and confirm no silent overwrite. With B1/PlatformOnly/noMembership, confirm unauthorized draft access is denied; multiAB tabs keep their own tenant context.
3. With the integrated S02b controls, use PlatformOnly to provision/invite, with action-time human confirmation for grants. The invited human creates a password, opens captured verification mail locally, verifies email, completes MFA and accepts membership. Check resend/expiry/revoke and no cross-tenant role/email substitution.
4. The human performs reset/MFA changes using private captured links/current factors. Verify generic request response, old-session denial and retained MFA. Confirm last-active-admin revocation/global disable is rejected. Loss of all factors remains separate manual recovery scope.

Record actual observed results and remaining NOT_RUN states in the relevant slice task. S02 is human accepted; these historical UAT steps are not a claim that every browser action ran.

## Endpoints and data boundaries

| Endpoint | Purpose |
| --- | --- |
| http://127.0.0.1:5891/cms | Current authenticated tenant context/private drafts; broader CMS remains later scope |
| http://127.0.0.1:5891/platform | Separate Platform administration; S02b source integrated; ordinary PlatformOnly browser login/read NOT_RUN; source/API checked |
| http://localhost:5892 | Public server-rendered shell, noindex/nofollow |
| http://127.0.0.1:5890/health | Process/runtime liveness only |
| http://127.0.0.1:5890/ready | Bounded actual PG/Redis/S3 probes; 503 if unavailable |
| 127.0.0.1:5888 | PostgreSQL 18.4, container 5432 |
| 127.0.0.1:5889 | Redis 7.4.9, container 6379 |
| http://127.0.0.1:5887 | Authenticated SeaweedFS 4.48 S3 API, container 8333 |

Compose project is `godent-cms-s01`; image digests are pinned in [compose.yaml](../compose.yaml). The bridge network retains Docker service-name routing and loopback published mappings. PG and S3 named volumes are project-local; Redis persistence is disabled. No console 5886 is supplied. SeaweedFS is a local implementation choice, not the production storage decision. A container healthcheck alone is insufficient: use the application service trials.

Service checks create only a session-local PG temporary table, `gcms:s01:` UUID Redis keys and uniquely named technical S3 resources. They check commit/rollback, TTL, byte equality, denied/missing-object cases, timeouts and cleanup. They do not create tenant tables, migrations or fixtures. Better Auth adapter initialization does not establish a login/session contract. The S01 trials did not register auth endpoints. Current S02 uses the [approved D10 boundary](decisions/006-local-account-session.md): host-only HttpOnly SameSite=Lax dev-HTTP cookie, cookie cache disabled, exact administration CORS/CSRF/Host checks. Ports do not isolate cookies; unsupported Host rejection occurs after a cookie header can already arrive. Public canonical localhost5892 forwarding omits credentials.

## Stop and preserve

In the terminal running `start:local`, press Ctrl+C. The launcher stops only its own children, including cleanup after startup failure; `.local/processes.json` is observational metadata and may be stale after exit. If a port is occupied, identify its owner before acting; the launcher refuses to replace it. Never kill an arbitrary port owner.

Stop this project's infrastructure while retaining data:

```sh
docker compose stop
```

Use `infra:up` to resume. Do not use `down -v`, prune volumes or reset existing data as routine cleanup. Only this task's disposable UI fixture server was stopped at handoff; the final three apps and Docker services were left running for local review. Their availability is an observation at handoff, not a persistent service guarantee.

## Evidence, advisory and limits

- [API/service proof](evidence/s01-api.json): genuine success, validation, unavailable-service, timeout, shutdown and cleanup observations.
- [Process/HTTP proof](evidence/s01-runtime.json), [Docker proof](evidence/s01-docker.json), [launcher failure cleanup](evidence/s01-launcher.json).
- [CMS viewport/keyboard proof](evidence/s01/cms-observations.json), [navigation](evidence/s01/cms-navigation.json), [component states](evidence/s01/component-states.json), [Platform](evidence/s01/platform-observations.json), [public](evidence/s01/public-observations.json).

`bun audit --json` returned **FAIL, exit 1**: high advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), `braces@3.0.3`, no patched version at review. Chain: dev-only `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. Fixed local lint patterns receive no HTTP input; the dependency chain was absent from 14 Next production traces. S01 had a local-only deferral. A fresh independent S02 review justified a separate bounded local deferral on 2026-10-16; official advisory checked2026-10-16 had no patched version. Final source scan found0 advisory-chain references in29 Next production traces; [S02 assessment](evidence/s02/dependency-audit.json) records scope. This is not an audit PASS or a production waiver. Coordinator owns reassessment by **2026-10-22**, or earlier on a patch/dependency/exposure change or before production use; no reminder automation is scheduled.

Browser proof covers actual rendered shells at desktop/mobile, five CMS/Platform widths, keyboard skip link/drawer/Escape/focus trap, and actual shared state components in a disposable fixture. Denied UI is presentation proof only. That historical shell proof did not establish authenticated permissions or tenant isolation. Human S01/S02 acceptance is recorded; the following S02 results preserve their original observed scope and unexecuted browser limits. Coordinator reports PASS from individual real auth (1), domain (7), recovery/isolation (7), registration (2) and review-regression (2) tests, covering two tenants, races/replay/reset/MFA/RLS/pooling within those cases. The current root `bun run test:s02` invokes seven sequential separate-process suites and is PASS; final individual outputs total22 tests/232 assertions. The earlier monolithic all-suite invocation is not claimed. Metadata checks alone do not prove RLS; consumed-challenge replay denial does not prove global one-time use of a TOTP value. S02a actual browser core and final responsive/drawer proof pass. S02b member read/confirmation/cancel PASS in the earlier source snapshot; additional PlatformOnly login/read, multi-tab/conflict and unsaved-navigation browser checks remain NOT_RUN. Native confirmation blocked the provider. Sensitive browser submissions remain NOT_RUN notwithstanding S02 human acceptance. S03 resolver/public SSR proof is separate; production performance, backup/restore, DNS/TLS and deployment remain unverified.

Official compatibility sources used: [Bun Next guide](https://bun.sh/guides/ecosystem/nextjs), [Next installation](https://nextjs.org/docs/app/getting-started/installation), [Nest first steps](https://docs.nestjs.com/first-steps), [Drizzle Bun SQL](https://orm.drizzle.team/docs/connect-bun-sql), [Better Auth Drizzle](https://better-auth.com/docs/adapters/drizzle), [Bun lifecycle policy](https://bun.sh/docs/pm/lifecycle), [SeaweedFS S3 credentials](https://github.com/seaweedfs/seaweedfs/wiki/S3-Credentials). Actual local results above, rather than documentation alone, support the compatibility claim.

## Current local review URLs and evidence

Use `http://127.0.0.1:5891/login`. The human opens `.local/s02-fixtures.json` privately for existing fixture credentials/factors; no values belong in chat/evidence. For fixture A, use `/cms/services?tenant=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` and `/cms/settings/members?tenant=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`. Use `/platform`, `/platform/accounts`, `/account` and `/invitations` for their authenticated flows. Invitation/reset links remain private; preserve the actual token without publishing it. Public canonical local shell is `http://localhost:5892`; wrong admin/public aliases return421. No tenant public resolver/publish behavior is delivered in S02.

The original Docker project/root `.env`/volumes are retained. Additional uniquely owned API-test records remain local; do not reset them or shared fixtures as cleanup. Backend factor rotation/global-disable tests used owned synthetic targets and preserved A1 access and noMembership's password/factor artifact. [Current execution ledger](tasks/GCMS-S02-001.md#actual-execution-and-handoff--2026-10-16), [combined API proof](evidence/s02/combined-api-checks.json), [S02a browser flow](evidence/s02/ui/initial-observations.json), [responsive proof](evidence/s02/ui/responsive-final.json) and [drawer final](evidence/s02/ui/drawer-keyboard-final.json) define actual coverage. Historical failed opening-focus evidence is superseded by the final checks. S02 human acceptance is now recorded; current separately approved S03 execution/evidence is described above. Historical NOT_RUN browser cases below remain unexecuted.

Additional manual browser UAT: log in as existing PlatformOnly and inspect tenant administration without private tenant drafts; open multiAB in two tabs with explicit different tenant URLs; save competing draft versions and check409; edit without saving and cancel/confirm navigation. These UI cases are NOT_RUN by automation. The browser provider remained blocked by its native confirmation dialog despite a bounded new-tab/owned-tab-close recovery; no application defect is inferred from that limit. Core member screenshots precede the last limits/copy/CSS rebuild; final core editor/drawer/denial captures use the final build.

### S04 controlled loading/outage review evidence

[Actual fault-control evidence](evidence/s04/ui-fault-control.json) records an owned API pause/watchdog resume and guarded launcher stop/restart, no new submission. CMS loading clears stale details/disables refresh, then automatically restores the same two leads. Actual redacted connection outage keeps contact/message hidden; keyboard-focused in-page retry after restart restores the same two leads/full authorized detail without page reload. This proves the CMS GET loading/outage/retry path, not the public POST unknown-timeout/same-key browser retry. Current remaining browser NOT_RUN are that public retry, full cursor UI sequence and CAPTCHA completion requiring action-time confirmation. No reset/counter cleanup or provider bypass is authorized by these review steps.

S05 final UI: daily operations/conflict/dirty/settings/reauthentication,56-row cursor/query,10001-row capped count and five-width controls PASS. The final textarea width100% repair is rendered at320/390/768/1024/1440. Controlled API pause gives actual loading/private clearing; full launcher outage reaches fail-closed session gate, keyboard focuses Retry and periodic polling automatically recovers. Enter-triggered recovery and browser expired-lead removal remain NOT_RUN. Reuse original operation after unknown settings+reauth; browser had no observed commit before retry, while postcommit-loss/restart proof is API-only. Do not create new records or drain retained S04 intents to replay screenshots. Human S05 acceptance recorded2026-10-16; no additional runtime or next-slice authority.

## M1 local UAT preparation

**Historical slice/package procedures and checkpoints.** Preserve the dated results below; current AUTH password-only operation and final task ledger supersede old factor/manual-only/pending-status wording. No old bootstrap/reset or additional UAT authority follows.

[GCMS-M1-UAT-001](tasks/GCMS-M1-UAT-001.md) is the current approved UAT-only package. Coordinator first records the missing-proof matrix, owned resources/browser/fault feasibility and preservation baseline. Use existing running applications and existing local scripts only within this package; no migration/dependency install/app repair is authorized. At most2new synthetic tenants/8newaccounts/minimumleads; retain old account passwords/MFA and pending backlog. Latest human steering declines ongoing manual onboarding prompts. Do not bypass required new-password/MFA/CAPTCHA tool boundaries through API/SQL/Playwright; record manual criteria NOT_RUN. Private local manifests/capture must not expose tokens/factors/sensitive links in evidence. Coordinate timed API faults, bounded recovery and browser checks sequentially where quota or shared resources overlap. Initial package execution was NOT_RUN at plan save; final task records scoped T02/T07/T08 and equivalent-component T09 proof with manual criteria NOT_RUN. Reuse only independently checked equivalent current evidence. If a tool is blocked, record the exact NOT_RUN and guide the human alternative without bypassing confirmation. Any app bug needs its own repair proposal before edits. Global TOTP single-value policy, backup restore and S05 open expiry/Enter scenarios remain outside this package. No new CLI/runtime PASS is asserted by this runbook update.

## AUTH password-only cutover preparation

**Historical approved preparation.** Cutover0013and forward0014are now applied/verified in the final AUTH ledger; do not repeat session invalidation or use this paragraph as a new cutover instruction.

[GCMS-AUTH-001](tasks/GCMS-AUTH-001.md) authorizes local coordinated UI/API/DB changes/forward0013 and automatic UAT, not a claim they have run. Coordinator matches source/schema, drains in-flight owned requests/stops API+worker, applies forward migration, invalidates all old sessions/reauth grants once and restarts before login. Never restore old tokens or rerun old password/factor bootstrap. Keep existing user/password/business data and encrypted legacy factors inert. No API-start backlog dispatch/retained backlog drain. Installed isolated Playwright/local captures/new-owned UAT secrets0600 only; overall prior2tenant/8account/minimumlead budget. Use current package evidence for actual results/commands after implementation; this save invents no command execution, migration PASS or runtime proof. Historical MFA instructions describe prior releases; current policy and pending execution are in AUTH, with M1 TOTP-only criteria SUPERSEDED/not PASS.

### Final AUTH verification commands and limits

Actual root [final source/integration result](evidence/auth-001/final-source-checks.json) records full `bun run typecheck`/`bun run lint` exit0, latest admin/API builds PASS and unchanged website build reused after initial AUTH build. Actual bounded runner `node_modules/.bin/bun scripts/auth-001-check.ts --local-auth-001` exit0:3suites/9tests/79assertions with real auth limiter enabled. This named runner uses only owned AUTH fixtures; do not rerun old S02–S05 check wrappers, which create broad resources/overwrite historical evidence. Read-only catalog/preservation commands in the API handoff remain coordinator-owned under AUTH scope, not credential bootstrap/reset commands. All14applied migration checksums remain immutable.

Use `.local/auth-001-ui-login-handoff.md` privately for current email/password-only entries. It preserves old fixture passwords and provides usable Owner; disabled Peer is not a login account. The handoff's A1 entry does not itself prove fresh AUTH A1 browser login. No TOTP/backup material is needed or exposed. No external email: private captured verification/reset/notification delivery stays local. Full packet proof, remaining NOT_RUN and human-acceptance status are in the final AUTH task. Coordinator's after-document exact-known-value scan is recorded separately; known forms/no-OCR is not comprehensive secret detection.

### M1 closure verification — 2026-10-16

[Automated M1 closure](tasks/GCMS-M1-UAT-001.md#automated-local-closure-results--2026-10-16) is technically complete with current password-only browser/API/DB evidence; AUTH is HUMAN_ACCEPTED. All owned helper commands and exact results/limits are in that ledger. Existing `.local/auth-001-ui-login-handoff.md` remains the private current password-only handoff; the closure did not change retained credentials or add accounts. Fresh A1 browser login is now proved by the current paging/loading execution. Do not rerun helper mutations or broad fixture wrappers merely to inspect evidence. One new owned pending intent remains undispatched, with old backlog unchanged. `braces` remains FAIL under its current local-only deferral; no upgrade/deploy/production/backup-restore claim.


## M4 local package — S13–S15

[GCMS-M4-001](tasks/GCMS-M4-001.md) holds direct approval, complete plan, current execution status and evidence. [ADR-013](decisions/013-local-m4-builder-campaigns-locales.md) records settled builder/campaign/locale decisions. M3 acceptance and its historical proof limits remain unchanged. These commands are scoped to new, positively owned M4 fixtures; they do not authorize Production, Git delivery, reset or retained-backlog dispatch.

Use project-local Bun1.4.3. The root aliases encode explicit flags and private environment order:

| Command | Scope |
| --- | --- |
| `bun run m4:bootstrap` | Create the additive M4 namespace under the existing owner; no credential replacement. |
| `bun run m4:migrate` | Apply only allowlisted forward M4 migrations with checksum verification and transaction/advisory lock. Use explicit `--through=NNNN` for a released boundary; `--compile-only --probe-content` intentionally rolls back after SQL checks. |
| `bun run m4:fixtures` | New M4 synthetic tenants/actors and baseline services; private0600manifest. A complete rerun preserves records and reportsresetfalse. |
| `bun run m4:demo` | Resumable owned catalog/media/VI–EN/campaign fixtures for local review; refuses ownership mismatch and preserves the representative VI home live/pending drafts. |
| `bun run test:m4:unit` / `bun run test:m4` | Explicit pure or isolated SQL/API suites. The runner stops at the first failure; later suites remain NOT_RUN. Raw logs stay private; filtered evidence goes to docs/evidence/m4. |
| `bun run m4:worker-scope` | Explicitly enroll only the two M4 fixture tenants for M4 delivery-invalidation work; does not start dispatch. |
| `bun run start:m4-worker -- content --tenant <owned-id> --once` | Run the narrow M4 content-invalidation worker for one owned tenant. Media and S06 lead retention keep their separate worker contracts. |
| `bun run m4:preserve` | Compare the exclusive M4 baseline's original-column row hashes and protected file hashes/modes. This is not backup/restore. |
| `bun run check:runtime:m4` | Inspect current owned listener executables/ancestry/loopback and six diagnostic requests. Availability is point-in-time. |
| `bun run check:ui:m4` | Actual installed Chrome in a fresh Playwright context; normal own-fixture login, public themes/locales, forms and lifecycle. This is a mutating synthetic journey, not a read-only health check. |
| `bun run check:ui:m4 -- --http-only` | Scoped own-fixture login plus HTTP fallback/sitemap/robots; no new lead/content writes. `--workflow-only` and `--lifecycle-only` are separate mutating synthetic scopes, not proof of omitted checks. |
| `bun --no-env-file scripts/m4-ui-states.ts --local-m4` | Requires an owned saved workflow manifest; actual conflict/save-replay plus explicitly controlled loading/503/403 and real preview/menu checks. Mutates only that owned Draft. |
| `bun --no-env-file scripts/m4-editor-controls.ts --local-m4` | Requires the owned two-section unpublished workflow Draft; actual add/move/hide/picker/remove persistence. Refuses a different starting shape rather than resetting it. |

Use `http://127.0.0.1:5891/login` with the private `.local/m4-fixtures.json` values. Do not publish those values. CMS uses `?tenant=<owned-id>`; `/cms/pages`, `/cms/website`, `/cms/promotions` and `/cms/variants/<kind>/<id>/<vi|en>` use the shared authenticated shell. Public entry is `http://localhost:5892/<owned-tenant-slug>`; EN adds `/en` after the tenant. API remains127.0.0.1:5890. No DNS/TLS or custom-domain activation is involved.

Save and restore change drafts only. Explicit publish changes the selected locale; config publish changes adopted presentation without publishing content drafts. Unpublish/withdrawal overrides saved public URLs. A missing EN variant redirects302 only when eligibleVI exists. Backend errors remain errors. Local responses stayno-store/noindex.

Read current execution evidence before rerunning fixtures or synthetic journeys. Preserve all earlier manifests, credentials, media and failed records; do not use fixture tools as automatic recovery. Start/stop only the positively identified repository launcher and its owned three apps. Never drain old S04/S05/M2/M3 jobs. The braces audit remainsFAIL/open; the [fresh final M4 assessment](evidence/m4/review.md#final-bounded-handoff--r1r13-closed-audit-failopen-retained) supports only the pinned local builds. Reassess2026-10-22 or earlier stated trigger and before Production; no Production waiver.
