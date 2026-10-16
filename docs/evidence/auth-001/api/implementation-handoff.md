# AUTH-001 API and data implementation handoff

**Source integrated; bounded runtime checks pending coordinator execution.** Parent authority is the direct human approval in `docs/tasks/GCMS-AUTH-001.md`. Native kit-implementer required/requested/observed effort is xhigh; runtime identity and source checks are in `source-checks.json`. No subagents, shared-document edits, old migration edits, dependency changes or Git actions occurred in this assignment.

Verified source changes:

- Better Auth uses verified email and password without the factor plugin, factor endpoints, factor hooks, factor ORM mappings or factor session payloads. Existing passwords, role checks, CSRF, request-origin checks, rate limits and the eight-hour session boundary remain.
- Reauthentication accepts only a 12–128 character password. It verifies the password and inserts a session-bound five-minute grant with the inert legacy `mfa` field defaulting to false.
- Forward migration `0013_auth_password_only.sql` introduces canonical current membership and one recent-auth condition. Active RLS/publication/lead/settings/recipient helpers use the new policy. The exact legacy wrapper signature remains. Legacy encrypted factors remain untouched.
- Migration SHA256 is `89fc0ba78b1fe80c921506fc6c0e57f409da0b7ccc4645f22d713b04b836a2a5`. The reviewed settings call uses `authorize(p_tenant,true)`. The migration runner checks old checksums and does not repeat session invalidation when 0013 is already recorded. After application, do not change these bytes.
- Retained fixture login reads existing passwords without enrolling, changing or rewriting legacy factors. Existing auth/domain/publication/lead regression consumers use password-only contracts. New recovery/disable tests use only the two bounded new API identities.

Actual local checks: API source/tests typecheck PASS; root scripts typecheck PASS; scoped ESLint PASS; local API tests PASS49 / SKIP103 / FAIL0 /257 assertions. The integration skips do not establish database behavior. The initial reauth regression failed against old input handling and passed after repair.

Coordinator-owned runtime evidence is separate. The coordinator reported actual cutover105sessions/4grants to0/0, migration rerun skip, old valid cookie200→401 and initial existing-account browser checks PASS. This subagent did not run those socket-requiring commands or infer broader proof from them.

## Remaining mechanical checks

The coordinator owns the local runtime and database invocation. New fixture creation remains on HOLD until the frontend completes its last-admin sequence and releases the UI checkpoint.

1. Read-only installed catalog: `node_modules/.bin/bun --env-file=.env --env-file=.local/s02.env scripts/auth-001-catalog.ts --local-auth-001`.
2. After released UI checkpoint: `node_modules/.bin/bun --env-file=.env --env-file=.local/s02.env --env-file=.local/s04.env scripts/auth-001-fixtures.ts --local-auth-001 --ui-checkpoint-released`.
3. Bounded actual PostgreSQL/HTTP tests: `node_modules/.bin/bun scripts/auth-001-check.ts --local-auth-001`.
4. Final read-only retention check: `node_modules/.bin/bun --env-file=.env scripts/auth-001-preservation.ts --local-auth-001`.

The UI owns `.local/auth-001-ui-resources.json`. The API helper writes `.local/auth-001-data-fixtures.json` mode0600 with the three UI identities plus apiRecovery(A only) and apiDisable(A+B). It creates no tenants and uses actual invitation/registration/local verification/acceptance. No passwords or token values belong in public evidence.

New API evidence writes only `docs/evidence/auth-001/api/**`; catalog/preservation writes only `docs/evidence/auth-001/data/**`. Do not run the old check:s02/s03/s04/s05 wrappers: they create broad resources and overwrite historical evidence. The named M1 mutable baseline permits only column-limited existing invitation/recipient-settings/lead-sequence exceptions, with exact counter delta checked against new leads.

**NOT_RUN by this subagent:** migration/DB mutations, new fixture setup, actual PostgreSQL/HTTP integration tests, browser/worker UAT, deployment and Git delivery. Package acceptance and shared-document updates remain with the coordinator and human Project Lead.

## Bounded P04/P06 continuation

Current continuation runtime metadata PASS: native kit-implementer/gpt-6.1-sol, required/requested/observed xhigh, exact parent unchanged, turn `01a1430b-8028-7d22-9dce-03ccafdbf959`. Worker proof preparation and regression coverage remain within the approved local AUTH package.

`auth-001-worker-check.ts` is source-complete and NOT_RUN. It requires the released UI `sourceB` and exactly three `leadsB`, the new browserOwner, and a tenant B absent from the retained baseline. It verifies the actual current source, active verified membership, inert false factor flag, current recipient selection and a fresh password-only session. It uses the existing restricted worker to claim only B, validates delivery IDs against the exact lead allowlist before I/O, rejects a stale fence, and verifies physical private generic local receipts plus settled delivery/intent state. It checks all other tenant notification/delivery hashes and restores the prior worker-scope enabled value. It does not poll, create leads, send external email or modify worker runtime/core migrations.

Coordinator command after checkpoint/review: `node_modules/.bin/bun --env-file=.env --env-file=.local/s02.env --env-file=.local/s04.env --env-file=.local/s05.env scripts/auth-001-worker-check.ts --local-auth-001 --ui-checkpoint-released`.

No new last-admin race harness or fixtures were added. `data/last-admin-race-reuse.json` verifies reconstruction of the entire historical domain test source after reversing only the three AUTH login changes. The unchanged historical race case retains its historical suite PASS. The catalog runner now checks exact installed last-admin function bodies and trigger bindings against immutable migration0001. This is scoped historical reuse; a fresh concurrency run remains NOT_RUN. Fresh UI rejection remains separate.

The new-owned API recovery test now resets to a distinct generated password, stores pending/new credentials only in the private canonical fixture file, and checks old-password denial plus new-password login. It preserves reset token racing/replay, old-session revocation, expiry and absolute-session checks. No retained account password is reset.

Actual continuation source checks: API source/test typecheck PASS; root scripts typecheck PASS; scoped ESLint PASS. Worker execution and the three actual integration suites remain coordinator-owned and NOT_RUN by this child. No0013/core source bytes changed after cutover.
