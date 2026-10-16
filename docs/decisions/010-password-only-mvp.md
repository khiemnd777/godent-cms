# ADR-010 — Password-only MVP authentication

## Status, authority and context

**APPROVED_POLICY — 2026-10-16, Asia/Ho_Chi_Minh. CODE_INTEGRATED / VERIFIED_LOCAL within final task scope / READY_FOR_USER_REVIEW; human AUTH acceptance pending.** [GCMS-AUTH-001 v0.1](../tasks/GCMS-AUTH-001.md) retains the full approved plan/P01–P07/source hash. Khiêm directly approved in desktop conversation `01a1402c-3c81-7933-9927-d974f70c9fbc`:

> Duyệt GCMS-AUTH-001 v0.1. Lưu kế hoạch rồi triển khai bỏ MFA/TOTP đồng bộ UI, backend, database và chạy UAT tự động trong phạm vi local đã đề xuất. Chưa commit/push hoặc deploy.

Both Platform Admin and Tenant Admin move to verified email+password. Prior MFA onboarding/tool handoff requirements left manual browser gaps. The direct approval changes the MVP authentication policy and permits coherent local implementation/automatic UAT; it does not retroactively turn old unexecuted criteria into PASS. S01–S05 human acceptances and evidence are historical and unchanged. [M1 UAT current revision](../tasks/GCMS-M1-UAT-001.md#authentication-policy-revision--2026-10-16) marks TOTP/MFA/backup-only criteria SUPERSEDED, not verified.

## Decision

- Both administrator roles use verified email+password. Retain12–128-character passwords, login rate controls, absolute8-hour sessions, logout and5-minute **password-only** reauthentication for sensitive actions. No Remember Me/automatic renewal or client role claim replaces current server authorization.
- Remove active twoFactor plugin, MFA/TOTP/backup endpoints, session contract fields and UI enrollment/challenge/setup/recovery paths. Existing MFA-enabled fixture accounts use unchanged email/password. Do not synthesize `mfaVerified=true` to bypass an old guard.
- Current password-authenticated session, active account/current same-tenant membership and existing CSRF/Origin/Host/role controls remain authoritative. Preserve tenant RLS/pool context, tenant-consistent references, restricted roles and atomic last-admin protection. Platform authority alone still cannot access tenant-private leads or publish.
- Publication retains saved-revision confirmation/conflict/current-permission/5-minute password-reauth checks. Lead access/mutations, eligible assignees/recipients/settings and worker eligibility remove the MFA prerequisite while keeping verified email/current active account/membership/tenant/expiry rules. Worker recipients still need not hold an open session; CMS access requires current password-authenticated authorization. Existing suspended-read/active-only-write distinction remains.
- Password reset retains generic request response, single-use30-minute token and revocation of all old sessions; disable/revocation/current-access checks remain. Invitation binding/lifetime/resend/revoke/single-use rules stay intact; onboarding no longer enrolls MFA. Platform cannot set another retained user's password.

This supersedes **ADR-006 D06/D07 mandatory-factor policy** and only related MFA requirements in [ADR-007](007-first-vi-publication.md), [ADR-008](008-local-consultation-intake.md) and [ADR-009](009-local-lead-operations-and-notifications.md). It does not change saved publication semantics, lead visibility, retention, idempotency, notification delivery or roles.

## Database and cutover boundary

Use forward migration0013; applied0001–0012 stay immutable. Canonical `has_current_membership(text)` expresses the current policy. Legacy `has_membership(text,bool DEFAULT true)` is a compatibility wrapper only; `p_mfa` no longer selects factor enforcement. Update all active SQL/domain callers consistently; source-level naming alone is not effective RLS proof.

Retain old encrypted factor columns/tables/rows **inert**, without DROP/purge/reset. Active runtime/API no longer uses or exposes them. Preserve old user IDs/email/password hashes/memberships/business content/leads/backlog and existing credentials. This is not a promise that legacy data is deleted or a broader retention decision.

The approved local cutover drains in-flight owned work/stops owned API/worker, applies matched source/schema, invalidates **all existing sessions and reauthentication grants once**, then restarts. Existing users log in with unchanged passwords. Old token state is never restored. Precommit migration failure rolls back atomically; post-cutover corrections roll forward with a new migration if needed. Do not dispatch retained backlog on migration/API startup or poll it for proof.

## Trade-offs and rejected shortcuts

Removing MFA removes one account-protection layer. Password-only is the explicitly approved MVP policy; retained rate/session/CSRF/role/RLS controls do not make it equivalent to MFA or establish production readiness. Keeping encrypted legacy data inert preserves history and avoids a destructive migration, but does not satisfy deletion/cleanup proof. Reusing old session tokens would blur the policy cutover and is rejected. Fake MFA booleans, disabling permission checks, deleting legacy factor storage and resetting retained account credentials are outside the approved approach.

## Verification and limits

P02–P07 owners must prove password-only old/new-account login/onboarding/reset and current rights/tenant/last-admin/recent-password rules through affected real DB/API tests and isolated installed-Playwright browser flows. Prove old sessions unusable, removed MFA endpoints/session fields and no active factor requirement across publication/leads/assignment/settings/worker. Run affected tests/typecheck/lint/build, independent review and preservation/secret checks. No completion result is inferred here.

Automatic local UAT may create/reset new owned UAT passwords with private0600capture/handoff, preserving old fixture passwords and the overall prior2tenant/8account/minimumlead budget. Ordinary local arithmetic CAPTCHA remains a separate proof, with no counter reset or production bot-protection claim. Revalidate auth-affected old evidence; reuse only remaining valid proof. AUTH completion does not automatically close M1 UAT or grant human acceptance.

No dependency install/upgrade, external email/provider, production/DNS/TLS/global/paid/real-data/destructive-reset/Git/commit/push/deploy/S06+ work. Fresh braces audit FAIL/local-deferral/reassessment2026-10-22 or earlier triggers remains separate, not a production waiver. This ADR records settled approved policy only; actual runtime/UAT is reported in the task/evidence by its owners.

## Historical verified-local implementation checkpoint — 2026-10-16

Root reports0013and forward0014 applied/checksum-replay PASS, with0013immutable and no second all-session/reauth invalidation. Both roles use browser password login. New-user onboarding, saved publication, lead assignment/filter/recipient settings, bounded worker3of3, exact replay1history/1receipt and five-width/Tab flows PASS within their scoped evidence. Final integration/two login tail checks remain pending; AUTH human acceptance and M1 closure are separate.

A genuine UAT integration defect exposed ordinary Better Auth32-character text user IDs while S05 assign/filter/recipient TypeScript validation and SQL lead_command assumed UUID. Shared canonical opaque-user-ID parsing was repaired RED→GREEN10tests/123assertions; full type/lint/API build PASS, but actual UI still400 through the SQL predicate, confirmed independent-review P1. Forward0014 narrowly repairs the assignment-ID predicate. Tenant/resource UUID rules remain unchanged, null unassignment retains its meaning, applied0013is not rewritten and no session-revocation replay occurs. Original failed attempts are retained in new AUTH evidence. [Exact replay](../evidence/auth-001/api/assignment-exact-replay.json), [forward review](../evidence/auth-001/security/forward-0014-review.json) and the [AUTH task](../tasks/GCMS-AUTH-001.md) retain actual proof; this is a correctness repair inside approved scope, not a new role or policy.

Only this ADR and the runbook are updated in this bounded checkpoint. Final task/state/M1 records remain with coordinator until final results. No application/private/evidence JSON/runtime/DB/Git writes by the settled writer; native medium metadata PASS turn01a14329-8a75-7902-ad31-9aac4e96d9bd at05:22:41.437Z. Historical policy/acceptance/evidence remains unchanged; no production claim.

## Final verification disposition — 2026-10-16

[Final AUTH ledger](../tasks/GCMS-AUTH-001.md#final-local-handoff--2026-10-16) records actual bounded API9tests/79assertions, full type/lint/latest applicable appbuilds, completed scoped browser lifecycle/invitation/operations/CAPTCHA/keyboard/five-width proofs, worker3local captures and exact assignment replay. DB preservation31of31PASS after classifying exactly2approved global identity.disabled audit events; original764audit rows unchanged. Preliminary classification failure/diagnosis is retained, not erased. Protected349files/private106only permitted process metadata/13pins checks and preclosure known-secret scan140values/167forms/57textfiles/18newcaptures/no match PASS within their limited artifacts. The after-document scan is a separate final coordinator receipt, not preclaimed here. Fresh browser invitation expiry/natural8-hour wait NOT_RUN, old/API boundary/race proof separate. Audit braces FAIL/open, no production waiver. Human AUTH acceptance and M1 closure remain separate; no new policy/data scope follows.
