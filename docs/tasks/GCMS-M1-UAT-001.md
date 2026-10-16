# GCMS-M1-UAT-001 — Approved M1 browser-proof completion v0.1

## Authority and initial state

**Current revision — authentication-policy update under separately approved GCMS-AUTH-001 v0.1.** Prior PARTIAL_VERIFIED_LOCAL_UAT and all historical results remain unchanged. TOTP/MFA/backup-specific current criteria SUPERSEDED/not applicable under the approved password-only policy, never PASS. AUTH implementation/automatic UAT starts NOT_RUN and does not automatically close this package.

**APPROVED_EXECUTION_PLAN v0.1 / PLAN_SAVED — 2026-10-16, Asia/Ho_Chi_Minh.** Initial package-specific application/runtime/fixture/browser checks are **NOT_RUN**. This source-complete approved plan is saved before dependent runtime or fixture writes. S01–S05 remain HUMAN_ACCEPTED within their separately approved scopes; their historical technical results, failures and NOT_RUN limits remain unchanged. This package closes missing M1 browser proof for S01–S04, not a new implementation slice.

Khiêm (Project Lead) directly approved:

> Duyệt GCMS-M1-UAT-001 v0.1. Lưu kế hoạch rồi thực hiện UAT bù trong phạm vi local đã đề xuất; hướng dẫn tôi khi cần thao tác trực tiếp. Chưa sửa ứng dụng, nâng dependency, commit/push hoặc deploy.

Source: direct human message, desktop conversation `01a1402c-3c81-7933-9927-d974f70c9fbc`, parent turn `01a142c5-ff45-7091-ab89-34db257ba1d5`,2026-10-16 Asia/Ho_Chi_Minh. Desktop verified the direct source; no later stop was supplied. The in-chat proposal is now this approved execution plan. A document/agent/status label cannot grant authority; human acceptance of prior slices adds no new technical proof. Silence grants neither approval nor TechNote-level progression.

Desktop `/root` remains accountable Project Coordinator and integration/runtime owner. This native settled writer owns only this new task and the explicitly assigned current pointers/maintained AGENTS+README hash provenance, then releases them. No app/scripts/evidence JSON/runtime/private/DB/browser/Git writes or child delegation by this writer. Package execution begins only after PLAN_SAVED; implementation repairs are outside this approval.

## Goal and proof boundary

Complete the missing browser evidence for M1(S01–S04) using current local applications and preserved accepted resources. Build a missing-proof matrix first. Classify each criterion as fresh browser execution needed, equivalent current evidence verified/reused, or specific NOT_RUN with a reason. Reused API evidence stays API evidence; a saved document, build or screenshot alone does not prove a sensitive browser workflow.

All S01–S05 HUMAN_ACCEPTED records stay intact. The package's technical closure and later human acceptance are separate. The accepted S05 cursor evidence may close an equivalent earlier browser gap only after T00/T08 establish the same current UI contract, dataset identity, tenant/detail isolation and covered steps. Do not repeat already equivalent sensitive flows without need.

## Approved local scope and preservation

- Existing local apps/Docker and only their owned processes; bounded timed faults with recovery, coordinated so shared API interruption does not collide with another flow.
- At most **two new synthetic tenants**, at most **eight new accounts**, and the minimum leads needed for missing proof. Record resource IDs and ownership privately. New controlled records do not authorize changing retained accounts or draining notification backlog.
- Private UAT manifests and local email capture for approved registration/verification/reset steps. Redact passwords, tokens, factors and sensitive links from durable evidence. No secret values in this task, screenshots or logs.
- Preserve existing accounts/passwords/MFA, tenant data, volumes, credentials, accepted resources and pending backlog. No destructive reset, old-password bootstrap rerun or unapproved factor replacement.
- No migrations, dependency installation/upgrade, application edits, external email/provider, production/DNS/TLS/global configuration, paid services, real customer data, Git/commit/push/deploy or S06–S18 execution. No new S06 plan is saved.
- If an application bug appears, record evidence and a concrete repair proposal. Do not edit the application under this UAT approval. Any affected material change requires its own approved repair scope.
- If a tool/provider is blocked, retain a specific NOT_RUN and guide Khiêm through a human-executed alternative. Do not bypass tool confirmations, auth, sandbox or credential-access controls.

The root's pre-write ordinary-file baseline is `/tmp/gcms-m1-uat-before.json` (595 files). Preserve13approved UI pins,18exact master rows and old evidence bytes. Runtime/fixture owners must take the approved scoped inventory/preservation observations before writes; the settled writer's document checks do not substitute for T01.

## Roles, ownership and effort

| Responsibility | Owner/capability | Required effort / boundary |
| --- | --- | --- |
| Sensitive entry, registration/reset/MFA factors, grants/revokes and CAPTCHA | Khiêm, with coordinator guidance | Human action at the sensitive step; tools cannot imply human confirmation |
| Runtime/fault coordination, ownership, integration and final evidence | Desktop `/root` Project Coordinator | High mechanical coordination/integration; not a sensitive-task xhigh claim |
| Account/session QA | Bounded sensitive QA owner, assigned by coordinator before execution | Native xhigh where auth/session/data are involved |
| Website/CMS QA | Bounded browser QA owner, assigned by coordinator before execution | Native xhigh when auth/data are involved |
| Security/exposure review | Bounded independent reviewer, assigned by coordinator | Native xhigh; review does not itself authorize repair |
| Settled plan/current-pointer writing | `/root/s03_record` native Kit implementer | Medium, documentation only; no delegation |

These are approved capability assignments, not fabricated future worker identities. Coordinator records actual disjoint owners/runtime metadata before dispatch. Do not allow parallel writers to the same records or overlapping shared API faults. Inherit the selected model; actual required/requested/observed effort must be checked separately.

Current writer metadata PASS before writes: agent-artifact-generation, required/requested/observed medium/medium/medium, native kit-implementer, inherited gpt-6.1-sol, child `01a141fb-3c88-7972-ac27-5ee18b0e6c80`, exact parent above; current turn `01a142c6-aaa8-7f21-91a5-57d6b80c06ad`, timestamp03:34:38.593Z. This records runtime configuration, not reasoning quality or browser behavior. Selected documentation-and-adrs/TechNote workflows support this settled save only.

## Ordered task contract

| Task | Approved work and expected proof | Owner/capability | Dependencies | Initial package status |
| --- | --- | --- | --- | --- |
| T00 — Missing-proof matrix | Inventory missing M1 browser criteria. Classify fresh/reused-equivalent/NOT_RUN; cite exact versions/resources/steps and distinguish browser vs API proof. Save full approval/plan before execution. | Coordinator + settled writer | Human approval | Plan saved; matrix execution NOT_RUN |
| T01 — Owned preflight and feasibility | Record owned resource/process/browser baseline and preservation; establish fault feasibility, recovery and human interaction path. Check bounded browser/provider availability before dependent sensitive flows. | Coordinator High + sensitive QA xhigh | T00 | NOT_RUN |
| T02 — Platform and multi-tab content | Actual PlatformOnly login/read. Run multi-A/B tabs/version conflict/dirty Cancel–Discard only if equivalent current S03 proof is absent. Confirm tenant/permission/input boundaries, no overwrite. | Account/session + CMS QA xhigh | T01 | NOT_RUN; equivalent proof not yet classified |
| T03 — New-account lifecycle | New owned provisioning/invitation → human registration → local verification → MFA → membership. Prove fixed binding and used/resend/revoke denials. Invitation expiry/race API evidence is reused separately; do not label it browser execution. | Sensitive account QA xhigh + Khiêm | T01 | NOT_RUN |
| T04 — Revocation and disablement | Revoke and disable only new UAT users; show current-session/private-data clearing and last-admin denial. Preserve all retained accounts and other active administrators. | Sensitive account/session QA xhigh + Khiêm | T03, distinct owned accounts | NOT_RUN |
| T05 — Reset and MFA | Human reset/MFA enrollment/challenge/backup-code change; generic single-use reset, all-old-session revocation, MFA retained, consumed backup denied. No new global TOTP single-value guarantee. | Sensitive account/session QA xhigh + Khiêm | T03, accounts distinct from T04 | NOT_RUN |
| T06 — Human CAPTCHA completion | Actual challenge-required → invalid attempt creates no lead → human valid challenge creates exactly one lead with ACK and authorized CMS read. Keep local adapter proof separate from production bot protection. | Website/CMS QA xhigh + Khiêm | T01; sequential controlled intake/quota with T07 | NOT_RUN |
| T07 — Browser postcommit response loss | Browser unknown result + retry with same frozen key/normalized payload yields exactly one lead+intent. **Prove initial commit before first response loss.** If only precommit interruption is observed, the required postcommit browser criterion remains NOT_RUN. Keep API postcommit-loss/restart evidence separate. | Sensitive website QA xhigh + coordinator fault owner | T06; coordinated quota/fault sequencing | NOT_RUN |
| T08 — Cursor gap mapping | Map actual S05 20/50-page,56-row proof to current UI. Execute only missing Next/Back/first-last/page-size/stable dataset IDs/tenant/detail boundary steps. Do not replace current evidence with a redundant fabricated rerun. | CMS QA xhigh | T01; T00 equivalent-proof decision | NOT_RUN; existing evidence requires mapping |
| T09 — S03 loading proof | Capture actual S03 loading image plus accessibility/busy state and recovery under bounded real latency. No fake UI or forced application state. Coordinate shared API fault/recovery. | CMS QA xhigh + coordinator fault owner | T01; no overlapping shared API fault | NOT_RUN |
| T10 — Fresh dependency exposure | Fresh audit/advisory exposure review; preserve advisory FAIL/open separately. A local deferral is never an audit PASS or production waiver. | Independent security reviewer xhigh | T00 | NOT_RUN |
| T11 — Integrated evidence and acceptance | Reconcile proof matrix/results, resource/credential/data preservation, static checks and no-secret scan; report remaining limits and obtain direct human package acceptance. Do not close with missing browser criteria or blocking access/data/idempotency/loss defect. | Coordinator + QA/reviewer + settled writer; Khiêm accepts | T02–T10 dispositions complete | NOT_RUN; human acceptance pending |

Main dependency path: T00→T01; T02/T03 afterT01; T04/T05 afterT03 using distinct accounts; T06/T07 sequentially controlled for intake quota; T08/T09 afterT01 with shared faults coordinated; T10 afterT00; T11 after all. Early tool blockage remains explicit, not silently skipped. Estimated **18–24hours for preparation/UAT/documentation, with2–3hours of human participation**, excluding repairs or upgrades; these are estimates, not actual effort claims.

## Evidence and acceptance matrix

| Group | Required acceptance evidence | Initial result / reuse boundary |
| --- | --- | --- |
| Planning/preflight | Approved plan saved before dependent writes; missing-proof matrix/owned baseline/fault+recovery feasibility | Plan written; execution NOT_RUN |
| Platform/content browser | Actual PlatformOnly read and required multi-tab/conflict/dirty sequence, or verified equivalent current S03 proof | NOT_RUN until matrix classification |
| Invitation/registration | Human registration/local verification/MFA/membership, fixed binding and used/resend/revoke denials | NOT_RUN; expiry/race API proof separate |
| Revoke/disable/reset/MFA | Only new UAT accounts; session/privacy clearing, last-admin denial, generic/single-use reset, all-old-session revoke, MFA retained, consumed backup denial | NOT_RUN; no global TOTP policy assertion |
| CAPTCHA | Actual required/invalid-no-lead/human-valid-one-lead/ACK/authorized read | NOT_RUN; no provider-confirmation bypass |
| Intake unknown/retry | Initial committed lead+intent established before loss, same frozen key/payload retry gives exactly one | NOT_RUN; precommit-only or API-only proof cannot close browser postcommit criterion |
| Cursor | Equivalent S05 mapping plus any missing Next/Back/first-last/size/stable IDs/tenant/detail steps | NOT_RUN until checked equivalence/missing browser steps |
| Loading | Real S03 image and AX/busy/recovery under controlled latency | NOT_RUN; no fake UI/loading simulation |
| Security/preservation | Fresh exposure review, retained data/resources/credentials/backlog, no-secret evidence and static integrity | NOT_RUN; audit may remain separate FAIL/open |
| Package closure | Every missing browser gap PASS via new execution or verified equivalent current proof, no blocking rights/data/idempotency/loss defect, preservation/no secrets and direct human acceptance | NOT_RUN; not automatic from S01–S05 acceptance |

Each executed/reused criterion records application version, resource IDs, steps, expected/actual result, time and UI/API/DB proof scope. Evidence must redact passwords, tokens, factors and sensitive links. Record failed/blocked attempts and exact limitations; do not rewrite historical evidence to PASS. Human-executed alternatives must be labelled as such with the actual steps/results; guidance alone is not execution proof.

## Closure limits and next action

Close this package only when all missing browser gaps pass through new execution or verified current equivalents, no blocking rights/data/idempotency/loss defects remain, preservation/no-secret checks pass and Khiêm directly accepts the package. If a criterion is blocked, report the exact NOT_RUN and the human-executed alternative; no bypass or generic fake completion.

Dependency audit may remain separate **FAIL/open**, with desktop owner/reassessment2026-10-22 or earlier patch/dependency/exposure/before-production triggers. Local deferral never means all technical debt is closed or production-safe. Global TOTP single-value policy, backup restore and S05 open browser-expiry/Enter-triggered recovery scenarios are outside this package. S06–S18 remain unapproved. S01–S05 human acceptance is unchanged; this package is not full-MVP/production acceptance.

After PLAN_SAVED, coordinator performs T00 matrix/T01 preflight and assigns exact bounded execution owners. Khiêm is guided only when direct sensitive interaction/confirmation is needed. App defects require a separate repair proposal; there is no application-edit permission in this plan.

## Initial documentation checks and ownership release

PLAN_SAVED was sent immediately after the full task save, before current-pointer/static completion. Desktop independently read the approved plan and confirmed the writer current-turn medium role/model/parent metadata PASS. Coordinator may now assign/perform only the approved UAT scope; writer itself ran no application/fixture/browser/runtime/DB checks.

Actual documentation checks PASS: `python3 -B scripts/verify_agent_setup.py`81maintained hashes/9adaptations/28mirror pairs/17skills per root/3native roles per client/121Markdown/1194local links; unchanged original integrity recipe20original/6adapted;13immutable UI pins/18exact master rows;10owned text whitespace/final newline. Current pointers and AGENTS/README maintained hashes+appended provenance only accompany the new task. All10owned documentation paths RELEASED to desktop; initial package execution/acceptance remains NOT_RUN/pending, and no prior FAIL/NOT_RUN is converted to PASS by this save.

## T07 isolated-browser authorization — 2026-10-16

Khiêm directly answered the bounded T07 alternative question:

> Cho phép dùng Playwright biệt lập cho T07

Source: actual asynchronous human reply2026-10-16 Asia/Ho_Chi_Minh in the same desktop conversation `01a1402c-3c81-7933-9927-d974f70c9fbc`, parent turn `01a142c5-ff45-7091-ab89-34db257ba1d5`; desktop verified the direct source. The question specifically permitted **already-installed Playwright with a new isolated browser** to submit the real public form→real API200, drop the first response, then retry the same frozen key/payload and prove exactly one lead+intent. This direct request satisfies the CUA tool's specific-human-request exception for the other UI technology **only for T07**. It grants no account-UI automation exception.

Use no existing browser profile/cookies/CDP, downloads, application-source edits or disabled security controls. Existing xhigh QA received bounded coordinator GO. T07 result remains NOT_RUN at this authorization checkpoint; real initial commit must still be proved before first response loss. No result is inferred from authorization or an API200 alone. Other package tasks, human-sensitive entries/grants/revokes/CAPTCHA, preservation/credential boundaries and no-app-edit/Git/deploy limits remain unchanged.

This settled append is task-only; fresh native medium Kit implementer/model/parent metadata PASS, turn `01a142cb-0c99-7181-a400-1b0a4a8c5b58` at03:39:25.756Z. Writer executed no Playwright/browser/runtime/private/API/DB/scripts/evidence JSON/Git mutation. Root's separate read-only preflight observed same3healthy containers/4HTTP200/no restart; it is not T07 or complete UAT proof. Ownership returns after documentation static check; full outcomes remain with execution owners.

T07 authorization-record static check actual PASS: ordinary verifier81hashes/9adaptations/28mirror pairs/17skills/3roles/121Markdown/1194links; task whitespace/final newline PASS. Task-only ownership RELEASED; T07 execution and package acceptance remain NOT_RUN/pending at this checkpoint. No maintained AGENTS/README hash update is needed because those files were not changed.

## Actual execution checkpoint — 2026-10-16

**IN_PROGRESS / HUMAN_GUIDED_UAT; not complete.** Desktop supplied these settled callbacks. S01–S05 HUMAN_ACCEPTED is unchanged. Initial plan/task tables and previous NOT_RUN authorization checkpoints remain historical, not rewritten as results. No app/dependency/migration/Git/deploy authority is added.

| Task / boundary | Actual current disposition |
| --- | --- |
| T00/T01 preflight | Baseline PASS31tables/124892rows/87privatefiles. Same3Docker healthy/4HTTP200/no restart at read-only preflight. [Runtime preflight](../evidence/m1-uat/runtime-preflight.json). Package-wide final preservation is separate. |
| T02 platform/content | Fresh actual PlatformOnly login+MFA/read25rows PASS. Current S03 same-tenant conflict/dirty evidence reused as equivalent, not rerun. Multi-A/B/private-lead denial remains NOT_RUN. [UI progress](../evidence/m1-uat/ui/progress.md) records exact observations. |
| T03 invitation | Staged new tenant M1UAT20261016A and local initial-admin target m1-uat-owner-32b4312f@example.test. Human reported generic403; exact cause Unknown (reauth age>5min is a hypothesis, not verified cause). Existing-account reauth attempt then AUTO_REVIEW rejected before execution because the human had not known/provided credentials. This is a tool-approval rejection history, not an application defect or successful auth/grant. Root disclosed missing private handoff, queued the labelled PlatformOnly file and asked explicit permission. After the explicit human authority below, the same CUA approval path reauthenticated existing PlatformOnly successfully (5-minute notice/password fields reset), then created the exact tenant/initial invitation: UI success/form gone/no errors PASS. No new-user password/MFA entry yet. Registration/verification/MFA/invitation acceptance NOT_RUN. Local capture file/IDs are being resolved privately; capture count not verified yet. |
| T04/T05/T06/T09 | NOT_RUN/pending human interaction and safe handoff. No auth/CAPTCHA/loading PASS or completed UAT is inferred. |
| T07 actual browser | Attempt1 FAIL/0POST retained due exact-label selector mismatch. Separate GET diagnostic200/0POST confirmed exactlabel0/role1; only the private helper selector changed, no app change. Attempt2 PASS2POSTs/1discard: realAPI200 at03:52:14.190→read-only DB1lead/1intent/1result at.192→first response aborted at.193→unknown frozen form at.283→same body/key retry at.307→ACK/DBsame1/1/1 at.412. Initial commit is established **before** first response loss. Source tenant sequence56→57 exactly one new approved request; root inspected both images and mechanical source, independent xhigh reviewer supports scoped PASS. [Attempt1](../evidence/m1-uat/ui/t07-result.json), [diagnostic](../evidence/m1-uat/ui/t07-diagnostic.json), [attempt2](../evidence/m1-uat/ui/t07-result-attempt2.json). |
| T08 equivalent dataset | [Exact correlation](../evidence/m1-uat/ui/t08-correlation.json) PASS56IDs/codes/source/baseline at03:44 **beforeT07**; existing20/50/Back sequence valid for that stable56-row snapshot. Current sequence now57 afterT07; do not relabel old paging evidence as a57-row rerun. Fresh detail/tenant boundary remains pending. |
| T10 fresh audit | Actual audit FAILexit1/one high braces advisory;33traces/zero advisory-chain references, fresh scoped local deferral. [Review](../evidence/m1-uat/security/review.md) and [review evidence](../evidence/m1-uat/security/security-review.json). Desktop reassesses2026-10-22 or earlier patch/dependency/exposure/before production; no deferral-as-PASS or production waiver. |
| Checkpoint preservation | [Pre-grant preservation](../evidence/m1-uat/ui/checkpoint-preservation.json) PASS87/87privatefiles,25stable tables' original rows and3credential invariants unchanged; exact approved sequence56→57/newT07rows only. Root additionally confirmed460protected source/config/oldS01–S05evidence bytes unchanged afterT07. **Snapshot is before the newly authorized reauth/grant**, not final/post-grant proof. New exact-value secret scan and post-grant preservation remain NOT_RUN/pending. |

### Direct human reauthentication/invitation authority

Khiêm's exact asynchronous answer2026-10-16 Asia/Ho_Chi_Minh in the same parent conversation/current parent turn:

> Cho phép xác thực lại và gửi lời mời này

Source question `call_dfddf2453bd748d68b93ecc499dba79a` specifically requested using the existing PlatformOnly password+MFA from private S02 fixtures for reauthentication, then creating **M1UAT20261016A** and its initial-admin **local** invitation to **m1-uat-owner-32b4312f@example.test**, with no credential changes or external mail. Desktop verified the human reply and sent that exact bounded GO to existing QA. This supplies the formerly missing authority without erasing the earlier auto-review rejection. A later actual CUA callback now proves exact reauth/provision/invitation UI PASS via the same approval path, not a workaround. Human onboarding/capture confirmation and post-grant preservation remain pending; no result is inferred solely from an appearing artifact. No broader private-credential/account authority is granted.

Current writer runtime PASS before this task/current-pointer append: native agent-artifact-generation/kit-implementer/gpt-6.1-sol/exact parent, required/requested/observed medium/medium/medium; turn `01a142db-a9d7-7523-826c-a34c790b1cdd` at03:57:34.600Z. Writer made only assigned documentation/provenance writes, no code/private/evidence JSON/runtime/DB/browser/Git mutation. Package acceptance remains pending. Coordinator receives ownership after the ordinary documentation/source-integrity checks below; later actual callbacks are distinct dated records, not an implied closure loop.

Checkpoint documentation checks actual PASS: ordinary verifier81hashes/9adaptations/28mirror pairs/17skills/3roles/123Markdown/1228local links; original unchanged integrity recipe20original/6adapted;13immutable UI pins/18exact master rows;10owned text whitespace/final newline. Read-only595-file original baseline comparison found zero outside-owned byte changes (new owner evidence is separate); no source/evidence bytes were changed by this writer. Current grant UI PASS is separate from pending human onboarding/capture confirmation/post-grant preservation. All10documentation paths RELEASED; task remains HUMAN_GUIDED_UAT_IN_PROGRESS, not package acceptance.

## Human steering and autonomous checkpoint — 2026-10-16

Khiêm directly stated in the parent desktop conversation:

> haizz, phiền phức quá đi, mày tự xử đi, tao chỉ cần mày báo cáo kết quả và gửi tao cho tài khoản + mật khẩu.

Desktop verified this latest human steering2026-10-16 Asia/Ho_Chi_Minh. It declines ongoing manual onboarding prompts. Coordinator announced no more step-by-step human requests and will complete independent autonomous cases using ordinary existing fixtures: T02multi-A/B/private boundary, T08tenant/detail and T09real loading. Their current results are pending FE callback. Original no-app-edit/dependency/Git scope remains; this instruction does not authorize API/SQL/Playwright bypass of browser new-password/MFA/CAPTCHA human requirements. Registration/reset/factor/CAPTCHA gaps remain NOT_RUN with the explicit tool boundary/user-declined-manual reason. No waiting-for-signup question or inferred full-UAT/human package acceptance remains current. S01–S05 HUMAN_ACCEPTED unchanged.

T03 exact new tenant/invitation UI plus **local capture binding PASS1/1**, with **accounts0/members0**. The new-password form was staged **empty/unsubmitted**; the proposed new owner is not login-ready. Preserve earlier approval/rejection history and the exact resolved reauth/grant human permission; neither becomes a completed new-account flow.

[Post-grant preservation](../evidence/m1-uat/ui/checkpoint-preservation-postgrant.json) actual PASS87/87privatefiles/31tables/25stabletables/3credential invariants unchanged; only exact new tenant+invitation+capture and T07newrows/counter change. This snapshot is **before future logins and any signup**, not a final all-future-state proof. Earlier pre-grant snapshot remains correctly labelled before grant.

Human requested account/password delivery through ignored private `.local/m1-uat-login-handoff.md`,mode0600. FE is preparing a selected **existing** A1/A2/multi-A/B/PlatformOnly account handoff with current MFA setup/instructions; no values are copied into chat/public documentation, no new-owner/login-ready claim and no credential reset. File creation/delivery is **pending actual confirmation**. This writer does not read/create the private file. Report only the confirmed private file path and safe usage once the owning worker supplies actual evidence.

Current settled writer medium role/model/parent check PASS before writes: native kit-implementer/gpt-6.1-sol, required/requested/observed medium, turn `01a142e2-0bac-7b33-8279-c0dc1bcfb552` at04:04:32.850Z. Six assigned current records/task updated only; no app/code/private/evidence JSON/runtime/DB/browser/Git writes or children. Further autonomous results remain separate actual callbacks; no full-UAT closure is claimed.

Steering-checkpoint documentation checks actual PASS: ordinary verifier81hashes/9adaptations/28mirrors/17skills/3roles/123Markdown/1235links; original unchanged integrity recipe20original/6adapted;13immutable UI pins/18exact master rows;6owned text whitespace/final newline. AGENTS/README/manifest were unchanged in this six-record followup. All assigned documentation ownership RELEASED; autonomous results/private handoff are pending actual owner callbacks, manual criteria remain NOT_RUN, no full-UAT acceptance.

## Final partial local UAT handoff — 2026-10-16

**PARTIAL_VERIFIED_LOCAL_UAT / MANUAL_GAPS_NOT_RUN.** Autonomous approved checks are complete. Full package browser-proof closure and human package acceptance are **not** achieved; S01–S05 remain HUMAN_ACCEPTED with unchanged evidence/limits. Latest human instruction ended ongoing manual prompts. No new application/dependency/migration/Git/deploy scope or tool-boundary bypass follows.

| Criterion | Final actual disposition and precise limit |
| --- | --- |
| T02 platform/isolation | Fresh PlatformOnly login/MFA/metadata read25rows PASS. [MultiAB](../evidence/m1-uat/ui/t02-multiAB.json) two-tab A/B isolation+forged resource denial PASS. [PlatformOnly private denial](../evidence/m1-uat/ui/t02-platform-private-denial.json) actual private lead/editor access denied/0private inputs/no save PASS. Current S03 same-tenant conflict/dirty equivalent proof reused separately. No writes to old content. |
| T03 initial invitation | Exact authorized tenant/invitation UI plus [bound local capture](../evidence/m1-uat/ui/t03-provision-proof.json)1/1 PASS; accounts0/members0. Empty new-password form unsubmitted; Owner not login-ready. Registration/verification/MFA/membership and invitation negatives NOT_RUN after declined human onboarding. Prior generic403 cause remains Unknown; auto-review rejection and later exact explicit permission/same-tool success remain history. |
| T04/T05/T06 manual | New-user revoke/disable/reset/factor/backup flows and actual human valid CAPTCHA completion NOT_RUN: required direct sensitive browser interaction/tool boundary and user declined continued manual actions. Existing API proof/staged forms/permission do not fill these browser gaps. No API/SQL/Playwright bypass. |
| T07 idempotency | Actual2POSTs/1response discard, realAPI200→independent read-only DB1lead/1intent/1result **before abort**→frozen unknown→byte-identical key/body retry→ACK/same1/1/1 PASS. First0POST selector failure retained; private helper locator-only repair. Explicit human isolated-Playwright exception remains T07-only, no account-UI authority. |
| T08 paging/detail | Prior56ID/code/source snapshot and exact20/50/Back paging reused **beforeT07addition**. Current [A1/A2detail](../evidence/m1-uat/ui/t08-current-detail.json) total57, YC57v1/New/unassigned and retainedYC1v10/A2/Contacted PASS; authorized other-tenant switch clears detail/source. No old56paging→57rerun claim. Exact originalA dropdown switch remains unexecuted because that observed tenant is absent from100current options; no reorder/grant/cleanup/repair. |
| T09 real loading | [Loading/AX/recovery](../evidence/m1-uat/ui/t09-loading.json) **PASS_EQUIVALENT_CURRENT_COMPONENT**, same DraftEditor/ShellState/serviceGET through available S05service. Root actual30.076-second API pause/watchdog resume samePID89699, not a strict≤30seconds guarantee. Stop04:13:26.001260→loading image04:13:42.031926→watchdog04:13:56.077375→recovery04:14:13.658584→5HTTP200at04:16:09.159613. Real “Đang tải dịch vụ”/status/aria-busy/0inputs→same “Tư vấn nha khoa”v1/8inputs/no busy/Save disabled. No field/content writes. Originalc300record loading NOT_RUN due missing current100options; no exact-original-record proof. |
| T10 advisory | Fresh audit remains FAIL/high braces,33traces/zero advisory-chain references, scoped local deferral only. Desktop owner reassesses2026-10-22 or earlier patch/dependency/exposure/before production. No audit-as-PASS/all-debt-closed/production waiver. |
| Final runtime/preservation/review | Root [runtime recovery](../evidence/m1-uat/runtime-recovery.json)5HTTP200/correct hosts after watchdog. [Final preservation](../evidence/m1-uat/ui/final-preservation.json) readOnlytrue/PASS87of87retainedprivatefiles,31tables/25stable/3credentialinvariants unchanged, exactallowedsequence1/unexpectedstabletables0, accounts0/members0 guards. This is a read-only snapshot, not restore/global future guarantee. Independent fresh xhigh artifact review PASS/no actionable findings supports T02/T08/T09 and five unchanged source hashes; [review/addendum](../evidence/m1-uat/security/review.md). |

[Final UI handoff](../evidence/m1-uat/ui/progress.md) is FROZEN/RELEASED. Ordinary A2 restored to S05 total57/selectedYC57v1/New/unassigned, clean/no pending writes or auth inputs; live review tab is the deliverable. Private ignored `.local/m1-uat-login-handoff.md` exists/nonempty/mode0600 and its private link is DELIVERED. It supplies four **existing** A1/A2/multiAB/PlatformOnly labels with unchanged passwords/current factor instructions; no secret value is copied here, and invited new Owner is explicitly not usable. Writer does not read/create the private handoff. Account delivery does not prove missing new-account workflows.

Final exact-known-value secret scan is recorded separately in the [scan artifact](../evidence/m1-uat/ui/secret-scan.json). This is a coordinator-owned mechanical integration check; its known-value/no-OCR scope remains explicit, and the artifact carries the actual result. Source baseline595 has no outside10assigned-doc byte changes per root; no app/source/migration/dependency/credential/factor/old-content/Git/deploy change. Restore/global-TOTP/S05open-expiry/Enter scenarios remain outside scope. No new manual prompt, no full-UAT closure or package human-acceptance claim.

Fresh settled writer metadata PASS before writes: native agent-artifact-generation/kit-implementer/gpt-6.1-sol/exact parent; required/requested/observed medium; turn `01a142ed-cde1-7fd3-99da-9cd785ac377d` at04:17:23.490Z. Only six assigned task/current-record files changed; root retains final mechanical integration/evidence JSON. Ordinary documentation/source-integrity check results and ownership release are reported in the closing handoff. Final text is frozen before coordinator secret scanning; no application/runtime/DB/browser check by this writer. No pending manual request remains.

## Authentication-policy revision — 2026-10-16

Khiêm directly approved [GCMS-AUTH-001 v0.1](GCMS-AUTH-001.md) for coordinated removal of active MFA/TOTP UI/API/DB requirements and automatic local UAT. Exact quote/provenance/full P01–P07 plan are in that independent package. Both roles retain verified-email/password policy, password-only recent reauth, session revocation/CSRF/roles/tenant isolation/last-admin safeguards. Old encrypted factor data remains inert; old fixture credentials/business data are preserved, all old sessions/reauth grants are invalidated once at approved cutover.

This is the current M1 UAT criteria revision. TOTP enrollment/challenge/global-single-value/backup-code requirements become **SUPERSEDED — not applicable under the new MVP policy**, not PASS. Historical T03–T06 manual NOT_RUN and old proof are retained; only the new policy supersedes MFA-specific criteria. Password-only invitation→registration→emailverification→membership, wrong password/unverified/expired/logout/revoke/disable/cross-tenant/last-admin/reset and reauth remain testable requirements. CAPTCHA remains separate, using the approved ordinary local arithmetic adapter with no counter reset. Reuse T07/T08/T09 only where still valid after auth changes; revalidate invalidated evidence. AUTH runtime/UAT initially NOT_RUN; AUTH approval or completion does not itself close M1 or grant package human acceptance.

Automatic UAT may use installed Playwright/fresh isolated context/local email capture and create/reset **new owned UAT** account passwords; unchanged old fixture passwords are retained. Overall prior2tenant/8account/minimumlead budget remains. Secrets/private handoff0600 only; no existing profile/cookies/CDP, downloads, external mail, dependency upgrade/Git/deploy. No new S06 work. This revision is documentation-only by the settled writer; no app/runtime/DB/browser/evidence JSON writes.

## AUTH automatic-browser mapping checkpoint — 2026-10-16

[AUTH actual checkpoint](GCMS-AUTH-001.md#actual-source-and-ui-checkpoint--2026-10-16) now supplies scoped password-only new-account onboarding/verification/acceptance, revoke/disable/last-admin/reset/current-password and local arithmetic CAPTCHA browser proof. This supersedes the former manual-tool-blocked disposition only for the actually executed current-policy cases; it does not rewrite historical M1 results or mark TOTP-only cases PASS. Old factor cases remain SUPERSEDED. Fresh browser invitation-expiry and natural8-hour wait remain NOT_RUN; old/API expiry/race proof is separately identified reuse. T07/T08/T09 old bounded evidence remains historical unless explicitly validated under the current contract. Final AUTH API/preservation/review/secret callback and human AUTH acceptance pending; M1 full closure is not automatic.

## AUTH final mapping — separate technical handoff, 2026-10-16

[AUTH final local handoff](GCMS-AUTH-001.md#final-local-handoff--2026-10-16) is CODE_INTEGRATED/VERIFIED_LOCAL scoped/READY_FOR_USER_REVIEW, human AUTH acceptance pending. New password-only browser onboarding/verification/membership, revoke/disable/last-admin/reset/currentpassword, invitation-negative and ordinary local CAPTCHA proofs map to their current-policy criteria. MFA/TOTP/backup cases stay SUPERSEDED, not PASS. Fresh browser invitation-expiry/natural8-hour wait NOT_RUN; old expiry/race API proof and current bounded API9/79 remain distinct. Prior M1T07postcommit/T08dataset/T09equivalent-component evidence remains its exact historical scope. This independent AUTH completion does **not** automatically close M1 or record M1human acceptance; do not erase old manual/tool-boundary history or original-record limitations. No S06+ execution follows.
