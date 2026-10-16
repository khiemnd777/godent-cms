# ADR-008 — Local consultation intake and read-only leads

**Current authentication policy — superseded in part by [ADR-010](010-password-only-mvp.md) / [approved AUTH v0.1](../tasks/GCMS-AUTH-001.md),2026-10-16.** Both roles use verified email+password; mandatory MFA/TOTP/backup requirements (ADR-006 D06/D07) are superseded. Sensitive actions retain5-minute password-only reauth,8-hour sessions/current roles/membership/RLS and existing lifecycle/last-admin controls. Legacy encrypted factors stay inert; one-time all-session/reauth cutover is approved, no old-token restore. Implementation IN_PROGRESS; runtime/UAT results not yet reported. The body below is retained historical policy/approval/evidence, not current MFA authority; old human acceptances/FAIL/NOT_RUN are unchanged. Saved publication, lead access/retention and worker semantics otherwise remain. No production claim.

## Historical record retained

## Status and date

**Accepted S04 v0.1/D01–D10; S04 HUMAN_ACCEPTED.** Khiêm directly stated **“Nghiệm thu S04.”** on **2026-10-16, Asia/Ho_Chi_Minh**, desktop thread `01a1402c-3c81-7933-9927-d974f70c9fbc`; desktop verified the direct human source. Historical technical CODE_INTEGRATED + VERIFIED_LOCAL_API_SSR + READY_FOR_USER_REVIEW and all evidence limits remain unchanged. Recorded2026-10-16 Asia/Ho_Chi_Minh. Khiêm directly approved in desktop thread `01a1402c-3c81-7933-9927-d974f70c9fbc`:

> Approve. Đồng ý triển khai S04 v0.1 trong phạm vi đã planned.

[Approved S04 task](../tasks/GCMS-S04-001.md) contains exact scope/provenance and current evidence. S01–S03 remain HUMAN_ACCEPTED. This ADR transcribes approved decisions; it grants no new implementation or production authority.

## Context

The existing Published VI service needs an actual consultation form and durable request acknowledgement. Both current tenant administrators must read the same New lead. Public intake must not receive private lead/auth/content privileges, expose contact in acknowledgements, or confuse a request with an appointment. Retry, current eligibility, consent, expiry and local abuse controls must hold in the same acceptance boundary.

## Decision

| Decision | Approved contract |
| --- | --- |
| D01 — Form and CMS layout | Add **“Gửi yêu cầu tư vấn”** after service content and before footer on the existing Published VI page. This is an approved new public UI extension. CMS follows the approved consultation list/detail: desktop side-by-side, mobile list/detail back navigation. No appointments. |
| D02 — Validated contact | Require phone **or** email plus preferred language/channel and consent. The selected channel requires its corresponding valid contact; every provided field must be valid. Optional name ≤120 characters; email ≤254. Phone allows presentation characters then strips to7–15 digits, without country coercion. Message ≤500 **Unicode code points after NFC normalization**, consistently in UI/API/DB; test500/501. No attachments/clinical-record fields; helper instructs users not to send health records. |
| D03 — Consent/source | Consent is not pre-ticked. Server records consent timestamp, consent-copy version and source. Source page and optional interest service are separate and must resolve to the same tenant/current eligible Published service. No location selector; reject unsupported IDs. Do not retain raw query strings/referrer PII. |
| D04 — Public trust boundary | Browser posts directly to a dedicated API5890 public route with `credentials: omit`, JSON and route-scoped exact-Origin CORS for `http://localhost:5892`, without credential allowance. Registry/slug/source publication is authoritative; body cannot choose tenant/assignee/host. Preserve admin/auth policy. Use actual socket-peer IP; do not trust X-Forwarded-For. |
| D05 — DB least privilege | Add **one execute-only technical intake role** for a narrow acceptance function. No lead/auth/content SELECT or direct DML for that role. Tenant lead reads require current MFA/session/membership and FORCE RLS; auth/platform gain no lead access. Create one new local credential only; do not rerun old bootstrap/change S02 passwords. |
| D06 — Atomic idempotency | Random opaque key,24-hour tenant+key uniqueness and normalized semantic payload fingerprint. Same key/payload returns the same opaque ACK; changed payload returns409. One transaction writes lead+intent+request result. No internal lead ID, contact, recipient, replayed flag or public receipt lookup. Timeout keeps the key. This is not phone/email deduplication. |
| D07 — Replay/current eligibility | A matching accepted24-hour request with the **same original stable binding** returns its ACK even after suspension/unpublish, without creation/quota/activity effects. A **new** request checks active tenant/current publication inside the transaction. Unknown/remapped bindings fail closed. |
| D08 — Intent and abuse | PostgreSQL durable notification intent **only**, no dispatcher/email. Intent excludes contact/message/recipient email. Local controls:5 new submissions/10minutes/tenant+IP;60 requests/minute/tenant; CAPTCHA from the3rd new submission/10minutes/tenant+IP. Local challenge adapter proves pass/fail/expired/replay/unavailable fail-closed cases. No `captcha=true` or shared bypass token. These are local thresholds, not production values or real-bot protection proof. |
| D09 — Expiry/privacy | Creation establishes initial substantive activity and180-day deadline immediately. List/detail/count deny expired leads; views/refresh/retry never renew activity/deadline. S06 notice/delete/extension/audit expiry remains future work. Redacted audit; keyed IP hash with finite TTL, no raw IP logs. |
| D10 — Tenant read model | Lead starts New. All active tenant administrators share the list; no assignment/status editor/notes/export. DB keyset order `created_at DESC,id DESC`, default20/max50, tenant/sort-bound cursor. Masked list/full authorized detail. No total count unless real; no inactive controls. A separate lead-read authorization path permits current active member/admin reads while the tenant is suspended; existing mutation wrapper remains active-tenant-only. |

Concrete canonical types/routes/bounds: [S04 contracts](../../apps/api/src/contracts/s04.ts); shared normalization/validation: [intake contract](../../apps/api/src/contracts/intake.ts). The implemented ACK is exactly `{status:"accepted"}`. Local challenge adapter proof is distinct from browser CAPTCHA completion and production bot protection. New intake role is a technical least-privilege principal, not another product role.

## Alternatives and consequences

Do not reuse privileged auth/platform/tenant direct-DML access for anonymous intake. The execute-only role and narrow database functions limit the effect. Do not deduplicate by contact or regenerate request keys after uncertain transport; same-key semantics prevent duplicate leads/intents. An ACK replay after suspension/unpublish is allowed only for the same original stable binding and accepted payload within24hours; it does not authorize new creation or renew activity.

S04 stores PostgreSQL durable notification intent only. No dispatcher/email/recipient resolution is delivered; S05 owns those contracts plus assignment/status/notes/advanced filters. S06 owns notice/delete/extension/audit-expiry workers, while initial180-day read eligibility is enforced now. No location selector/custom-host implementation; S10/S16 remain separate. No production thresholds, external delivery, appointment workflow or new retention period is selected.

Applied migrations0001–0007 remain immutable. Scoped bootstrap creates only the new intake role/private S04 schemas and credential; existing S02 role passwords/bootstrap are retained. Forward0006 handles redacted anonymous audit without fake authenticated actor. Forward0007 aligns strict mailbox checks across HTTP/SQL. This is approved local implementation detail, not permission to reset resources or rewrite applied history.

## Verification and limits

[Combined S04 API results](../evidence/s04/combined-api-checks.json) PASS25tests/313assertions across input6/46,security4/22 and realHTTP/PG15/245, zero failures/skips, including suite-owned restart/fault/retry and restricted-role/current-authorization proof. [Frontend evidence](../evidence/s04/ui/implementation.md) records actual phone/email form→API→PG→A1/A2 reads,500/501NFC/plaintext, five widths, focus and bounded empty/denied states. CAPTCHA-required was observed; solving/submission is NOT_RUN because action-time human confirmation is required. Controlled CMS GET loading/outage/keyboard retry now PASS with actual same-two-lead recovery; public unknown-timeout/same-key browser retry and full cursor UI sequence remain NOT_RUN. Unit/API proof remains distinct.

[Current checks](../evidence/s04/check-results.json) record frontend32tests/119assertions, full type/lint/build and selected S02 regressions. Initial flag-omitted0pass14skip invocation is NOT_RUN; later actual flagged suites pass. The S03 original integration suite is not rerun where its fixture would mutate retained site rows; targeted existing SSR/preservation are separate checks. Root final DB/runtime/diagnostic/public SSR/CORS/S03 SSR and dated preservation/secret artifacts now PASS within their scopes; final static/inventory refresh follows document closure.

[Repair history](../evidence/s04/initial-checks.json) remains historical, including the first stalled-suite FAIL. Final task disposition distinguishes the null-safe challenge repair, narrow schema bootstrap,403 FOR SHARE privilege repair without UPDATE grant, redacted audit and strict-mailbox forward migration. Independent final review is CLOSED. [Fresh dependency assessment](../evidence/s04/dependency-audit.json) confirms a separate local-S04 dev-only braces deferral: audit remains FAIL,32 Next traces/zero advisory-chain references; not an inherited S03 or production waiver. Desktop reassesses2026-10-22 or earlier on patch/dependency/exposure change or before production, no automation.

## Sources

- [S04 approved task/current evidence](../tasks/GCMS-S04-001.md)
- [Architecture](../architecture.md), [access](../access-control.md), [workflows](../workflows.md), [runbook](../local-development.md)
- [ADR-006 account/session](006-local-account-session.md), [ADR-007 publication](007-first-vi-publication.md)
