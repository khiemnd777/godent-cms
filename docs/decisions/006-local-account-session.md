# ADR-006 — Local account, MFA and session boundary

**Current authentication policy — superseded in part by [ADR-010](010-password-only-mvp.md) / [approved AUTH v0.1](../tasks/GCMS-AUTH-001.md),2026-10-16.** Both roles use verified email+password; mandatory MFA/TOTP/backup requirements (ADR-006 D06/D07) are superseded. Sensitive actions retain5-minute password-only reauth,8-hour sessions/current roles/membership/RLS and existing lifecycle/last-admin controls. Legacy encrypted factors stay inert; one-time all-session/reauth cutover is approved, no old-token restore. Implementation IN_PROGRESS; runtime/UAT results not yet reported. The body below is retained historical policy/approval/evidence, not current MFA authority; old human acceptances/FAIL/NOT_RUN are unchanged. Saved publication, lead access/retention and worker semantics otherwise remain. No production claim.

## Historical record retained

## Status and date

**Accepted product decisions D01–D10; implementation IN_PROGRESS.** Recorded 2026-10-16, Asia/Ho_Chi_Minh. Authority is Khiêm's direct 2026-10-15 approval in [GCMS-S02-001](../tasks/GCMS-S02-001.md):

> Duyệt S02 v0.1 và D01–D10. Lưu kế hoạch, cập nhật nghiệm thu S01 rồi triển khai S02a/S02b trong phạm vi local đã đề xuất, gồm migrations, fixtures và kiểm chứng. Chưa commit/push hoặc deploy.

This ADR records settled decisions. It supersedes only earlier account/session deferrals in ADR-005 and current sources; it does not rewrite historical approval/evidence or authorize another slice. S01 is separately HUMAN_ACCEPTED. S02 human acceptance remains pending.

## Context

The shared administration app needs real authentication, current tenant membership and private drafts before publishing work. Separate local ports do not isolate cookies. Global identity and platform operations must not bypass tenant-private authorization. Recovery, invitation replay, concurrent last-admin changes and session revocation need explicit controls.

## Decision

| ID | Approved behavior |
| --- | --- |
| D01 | Platform provisions tenants and invites the initial tenant administrator. Bootstrap is local only; no public signup or platform-private-data bypass. |
| D02 | Global email/password identity; verified email before activation; multiple tenant memberships; no OAuth. |
| D03 | Active same-tenant administrators grant/revoke tenant-admin membership. Invitations fix email/tenant/role, are single use, expire after 24 hours, and resend voids old tokens. |
| D04 | Atomic changes preserve the last active tenant administrator, including concurrent revokes and global disable across memberships. |
| D05 | Generic password-reset response; single-use token valid 30 minutes; successful reset revokes all sessions. Platform cannot set another user's password. |
| D06 | TOTP MFA plus single-use backup codes. Platform MFA precedes privileged actions; tenant MFA is mandatory before S02b closes. S02a incomplete-factor paths are synthetic/local only. |
| D07 | Reauthentication protects MFA changes. Password/email recovery cannot bypass MFA. Losing all factors requires manual recovery under separate scope. |
| D08 | Absolute 8-hour session, no Remember Me or automatic renewal; sensitive changes/grants require reauthentication within 5 minutes. |
| D09 | Private local mail capture only; no real delivery/provider; redact passwords, tokens, links and factors from durable evidence. |
| D10 | Admin/API origins `http://127.0.0.1:5891` / `http://127.0.0.1:5890`; public canonical local origin `http://localhost:5892`. Retain loopback ports. Host-only HttpOnly SameSite=Lax cookie on dev HTTP, no cookie cache, exact CORS/CSRF/Host checks, public forwarding without credentials. A cookie header can arrive before unsupported-Host rejection; ports are not cookie isolation. |

Use explicit request/tab tenant context and current membership, restricted auth/tenant/platform runtime database roles, a separate migration role and transaction-bound pool context. RLS and tenant-consistent foreign keys supplement backend checks. Runtime never receives the S01 superuser or migration credential. Private VI draft is title/plain text with version conflicts and current-authorized preview, noindex/no-store; publishing and rich text belong to S03. Current API limits are title160/body20000 characters; the database body30000 ceiling is a storage guard, not a larger accepted API limit.

## Alternatives and trade-offs

Public signup, OAuth, Platform-set passwords, email-only MFA recovery, remembering sessions and automatic renewal are outside the approved S02 approach. A mandatory local proxy/BFF was not selected. Development HTTP cookies are local only; this is not production TLS/session design. Separate public hostname reduces normal credential sharing but does not make ports a cookie boundary or justify forwarding credentials.

Local mail capture permits invitation/verification/reset testing without external delivery. Its files and the synthetic credential/factor manifest remain private. MFA is mandatory even in this local acceptance target; fixtures do not establish a general HTTP privilege-bootstrap path.

## Verification and consequences

**Verified source:** Better Auth/Nest contracts, restricted runtime environment selection, local bootstrap/migration/fixture scripts and private mail capture exist. Coordinator reports separate real auth/domain/recovery/isolation/registration/regression tests PASS; see [task evidence](../tasks/GCMS-S02-001.md) for actual commands, counts and limits. RLS metadata alone is not runtime isolation proof. Backup-code consumption is single use; TOTP evidence concerns replay of a consumed challenge, not global single use of every TOTP value.

**Unknown/pending:** final S02 UI/browser breadth, full-package integration and human acceptance. Browser credential creation/change and grant submissions require human interaction as described in the [runbook](../local-development.md#human-uat-and-browser-limits); API tests remain distinct evidence. No production/email-provider/DNS/Git/deploy claim follows. S03 needs separate approval even if S02a is verified; S02b closes before S18.

## Sources

- [Approved S02 task and D01–D10](../tasks/GCMS-S02-001.md)
- [Access-control contract](../access-control.md), [architecture](../architecture.md), [local runbook](../local-development.md)
- [ADR-005](005-local-mvp-and-content-fallback.md), retained as historical context
