# S05 frontend implementation and rendered evidence

## Authority and current boundary

Parent `/root` assigned `/root/s05_frontend` only `apps/admin/**` and `docs/evidence/s05/ui/**` under the direct S05 v0.1/D01–D12 approval in [the canonical task](../../../tasks/GCMS-S05-001.md). No Git/process/Docker/database/shared-record writes belong to this worker. PLAN_SAVED and PREFLIGHT_READY were received before application writes. API owner froze [S05 types](../../../../apps/api/src/contracts/s05.ts) before dependent frontend implementation. T03 representative confirmation remains required before dependent UI expansion.

Runtime metadata check: native `kit-implementer`, thread `01a14281-ad8c-7d31-8f5e-ad93bc025baa`, parent `01a1402c-3c81-7933-9927-d974f70c9fbc`, model `gpt-6.1-sol`, required/requested/observed `xhigh/xhigh/xhigh`, PASS. Risks: authorization, sensitive-data, transaction-concurrency. The first command used an unsupported risk label, rejected before substantive work; the corrected command used actual matrix keys and passed. This proves recorded runtime configuration only.

## Approved template mapping

Source: [approved baseline v0.1+Lucide](../../../design/admin-mockup/approved-baseline.json), all 13 original pins retained by the coordinator. Leads JS SHA-256 `bed03768076ae4ad9a279e34b57e13c58be1a288f1d8c398bdf7110edc6a44d9`; CSS `d9ef0fb0ea405c58b50184ed862ba439a5b7d83a4b8e09dc9950d39e01810412`; desktop screenshot `2f9f1e5decc7130fad01985d422cf31bd3f31c5ebb241e8e87079faaa3bf56f4`; mobile list screenshot `dac3de86c06cf434c8013c5e9a74ea86e0eb3690c8560471d8e1a27605516198`. Pinned images inspected locally. Existing review server's Leads iframe returned a browser error; no server repair/restart was attempted.

| Retained element / target order | Real S05 implementation | Approved difference / stage |
| --- | --- | --- |
| Shared shell / Lucide / typography | Existing administration shell and CSS | Existing authenticated controls remain; review toolbar/sample identity removed |
| Desktop list and detail side by side | `.leads-layout` / `LeadWorkspace` | Same responsive layout; real API data |
| Customer → masked contact → request code | Real name / API masks / `code` | Real tenant-unique `YC-` code replaces synthetic IDs |
| Interest → status → received time columns | API `interest`, status, HCM timestamp | Source page is not substituted for missing interest |
| Information → assignee → status → reason → save | `LeadDetail` | T03 assignment only; status read-only until T05/T06; reason appears with later close/reopen flow |
| Save → activity history → retention | Versioned command / paged history / actual expiry | No in-memory update success; contact/note composer follows T03 checkpoint |
| Mobile list replaced by detail, back action | `.detail-open` / guarded back / row focus | Same navigation pattern |
| Search/status filter | Real server query after T03 checkpoint | T07 dependency; no fake search/filter controls |
| Recipient settings / extra filters / composers | Later approved S05 extensions | Not part of T03 source checkpoint |

Prototype-only sample rows, fixed counters/date, memory-only mutations and review messages are excluded. The primary representative flow is real public intake → A1 assigns A2 → save → A1/A2 observe the same version/history after reload, at 1440×1080 and 390×844. Root owns runtime/fixture readiness; CUA is the only browser interaction tool. Existing credentials/MFA may be used for ordinary sign-in. No factor changes, grants or CAPTCHA completion without the applicable action-time confirmation.

## T03 source checks

| Check | Actual result | Scope / limit |
| --- | --- | --- |
| Retry identity RED | Expected missing-module failure | New operation helper absent before implementation |
| Retry identity GREEN | PASS 3 tests / 7 assertions | Snapshot payload/version/ID; unresolved retry reuses identity |
| Error-code RED | Expected assertion failure | Existing transport discarded S05 conflict code |
| Error-code GREEN | PASS 5 tests / 14 assertions | Allowlisted control code; no raw server message/unknown code exposure |
| Initial admin typecheck | FAIL, nullable test fixture inference | Fixed test input type; no product/API behavior change |
| Admin typecheck after fix | PASS, exit 0 | Source/type evidence only |
| Admin unit suite | PASS 23 tests / 78 assertions | Private transport/navigation/rich-text/input/operation regression scope |
| Admin lint | PASS, exit 0 | Final T03 source, including editor remount-key refinement |
| Production build | NOT_RUN by FE | Coordinator owns build/runtime sequencing |

## Representative rendered checklist

| Criterion | Role / state | Viewport | Expected result | Evidence / result / owner |
| --- | --- | --- | --- | --- |
| List hierarchy / real code / interest / status | A1, populated | 1440×1080 | Same approved column and information order | NOT_RUN — awaiting root API/runtime fixtures; FE |
| Assignment / save / real history | A1 assigns A2 | 1440×1080 | Atomic saved version/history; deadline unchanged | NOT_RUN — awaiting root API/runtime fixtures; FE |
| Same-tenant shared data / reload | A1 and A2 | 1440×1080 | Same lead/version/history after reload | NOT_RUN — awaiting root API/runtime fixtures; FE |
| Mobile list/detail/back/focus | A1, populated | 390×844 | Detail replaces list; back restores row focus | NOT_RUN — awaiting root API/runtime fixtures; FE |
| Required controls inside own panel | A1, populated | Both | Assignment/save/history/back visible and keyboard reachable | NOT_RUN — awaiting real render; FE |
| Dirty cancel/discard | A1, edited assignment | Both | Cancel preserves input; discard changes destination | NOT_RUN — awaiting real render; FE |
| Loading / error / denied / expiry | Authorized or denied states | Both | Private content cleared; truthful retry/empty/denied | NOT_RUN — awaiting root owned fault/fixture controls; FE |
| Conflict / unknown transport retry | A1/A2 | Both | Input preserved; retry has same payload/version/ID | NOT_RUN — unit evidence is not browser proof; FE |

No rendered PASS, full S05 completion, human acceptance or production claim is made by the initial source checks.

## First real T03 browser attempt

Root released the guarded runtime after forward0008, preservation checks and production build. New public fixture `http://localhost:5892/s05-ui-ef95e0e2/dich-vu/tu-van`; tenant `4e206516-529a-4799-b146-05f950214a00`; initial lead count zero. At1440×1080, CUA submitted exactly one synthetic email-only request and observed **Đã tiếp nhận yêu cầu tư vấn**. [Accepted screenshot](t03-public-accepted.jpg). No CAPTCHA appeared; no second submission/counter reset/permission/factor change was made. ACK is not an appointment confirmation.

The first CMS list render used the existing authorized browser session and received `INVALID_INPUT` for the frozen `?pageSize=20` query. [Error screenshot](t03-list-invalid-input.jpg). The UI cleared private list/detail content and exposed the generic validation error. Console warning/error capture returned an empty array; this does not turn the HTTP error into PASS. No assignment was attempted. Current actor identity has not yet been verified as A1 or A2 in this attempt.

**FAIL / affected flow paused:** list → assignment and dependent UI expansion. API owner/root received the exact non-sensitive route/query. Proposed diagnosis: query adapter/prototype validation; cause remains unverified until the API owner inspects it. Root owns rebuild/restart after a focused source repair and checks. Retain the accepted lead and existing session; do not resubmit the public form.

## T03 representative recovery and checkpoint handoff

The API owner confirmed Express supplies null-prototype query objects. A regression reproduced the400; its focused parser repair allows only ordinary/null prototypes while retaining key/value validation. API owner reported7tests/32assertions plus type/lint PASS. Root rebuilt/restarted only the owned runtime and released the same accepted lead. FE used in-page Retry; no public resubmission or DB/credential/counter reset.

**Verified real flow:** account page confirmed existing actor **S02 A1**. A1 assigned the same `YC-000001` to **S02 A2**. Save returned **version2 / Assigned**. A1 reloaded and observed the same assignment and one history event naming A1. FE signed in ordinarily as existing A2 with its existing MFA, then reloaded the same tenant lead and observed the same version/state/assignee/history. Displayed expiry stayed `09:28 14/4/27` before and after assignment. This is bounded browser evidence; root/API retain independent transaction/database proof.

| Criterion | Exact condition | Evidence | Result |
| --- | --- | --- | --- |
| Desktop hierarchy |1440×1080, A1/A2, same single real lead |[A1 desktop](t03-a1-desktop.jpg),[A2 desktop](t03-a2-desktop.jpg) | PASS for T03 information→assignment→state→save→history→retention |
| Real request code / masked list / interest | YC-000001, actual mask and no selected interest | Same screenshots; interest remains **Chưa chọn dịch vụ**, not source title | PASS |
| Real assignment / reload / shared read | A1 save→A1 reload→A2 ordinary login/MFA→A2 reload |[Actual observations](t03-representative.json) | PASS |
| Mobile list/detail hierarchy |390×844 |[A1 list](t03-a1-mobile-list.jpg),[A1 detail](t03-a1-mobile-detail.jpg),[A2 detail](t03-a2-mobile-detail.jpg) | PASS |
| Control bounds |1440×1080 and390×844; actual required selects/save/back |[Desktop geometry](t03-desktop-geometry.json),[mobile geometry](t03-mobile-geometry.json) | PASS:40px control heights; visible controls within own panel; document width equals viewport |
| Mobile focus | Open detail→customer heading; Back→same row | Actual DOM focus in representative JSON | PASS |
| Keyboard / dirty refresh cancel | Assignee Tab→Save; unsaved A1 selection→Refresh→Cancel | Input retained, dialog closed, focus returned Refresh; reverted to persisted A2 without saving | PASS |
| Browser warning/error observation | Final representative tab | Empty warning/error array in representative JSON | PASS within captured scope |
| Full query/filter/count/badge / composer/status/settings | Later S05 tasks | No fake controls rendered; dependency checkpoint pending | NOT_RUN |
|320/768/1024 / full dirty/conflict/retry/denied/expiry | Later T13 expansion | Source/unit evidence does not prove these states | NOT_RUN |

The first screenshot `t03-a1-initial-unmatched-viewport.jpg` was captured at1874×991 and is retained as unmatched historical evidence. Viewport capability applies to the active browser tab; a fresh owned CMS tab was focused before setting1440×1080 and390×844. Exact dimensions were read from the DOM and stored with matched captures. Initial public/error screenshots likewise do not claim matched representative dimensions.

**REPRESENTATIVE_READY:** parent root received screenshot paths and the exact observation scope for inspection. Dependent UI expansion remains on hold until root confirms this checkpoint under existing approval. Human acceptance and complete S05 behavior are unproved.

Root found a cropped left sidebar in the first A2 desktop capture. Inspection verified that capture occurred during the mobile→desktop sidebar CSS transition. The settled DOM at1440×1080 has scrollX/Y0, sidebar left0/right232/width232/transformnone, shell left232. The cropped image is retained as `t03-a2-desktop-transition-crop.jpg`. `t03-a2-desktop.jpg` was recaptured after the settled accessibility/geometry observation and visually reviewed with the full logo, tenant selector and sidebar navigation visible. No application or fixture changes were needed. Root was sent the replacement capture for the still-pending checkpoint.

## Approved expansion after root checkpoint

Root directly confirmed the bounded T03 checkpoint after inspecting the settled1440 desktop and390 mobile captures and the actual shared-version report. FE then implemented the approved T04–T09/T13 source within its assigned files:

- Separate plain-text note/contact composer, NFC/code-point boundaries, real contact outcomes, append-only history, guarded closure reasons/reopen reason.
- Server name/code/status/assignee/HCM date query,20/50 cursor pages, filtered count and independent tenant-wide New badge; count does not rerun on every page step.
- Dedicated paged eligible-admin options for assignment, filters and notification recipients; no first-Members-page filtering.
- Recipient settings card and `/cms/settings/notifications`, real default/selected identities, unavailable-default warning, version/CSRF/recent reauthentication, conflict comparison and stable unknown retry.
- One unsaved action at a time prevents a separate assignment save from discarding note/contact text. Controlled transitions preserve the approved information→assignment→status/reasons→save→composer/history→retention order.

Query/text RED failed with expected missing module; GREEN4tests/15assertions. Full admin suite initially27tests/93assertions, type/lint PASS.

Independent reviewer identified a P2 settings edge: after an unknown PUT result, a later `REAUTH_REQUIRED` response cleared the original attempt identity before receipt replay. Focused repair retained the original payload/version/ID and frozen choices when the previous result is unknown; initial definitive reauthentication denial remains editable. Regression RED failed on missing decision-helper export; final GREEN operation tests include unknown→reauth→original-operation retention. The reviewer also noted Clear Filters resetting visible fields before a dirty cancel. The reset now runs only within the confirmed callback.

**Final source checks after those repairs:** admin29tests/101assertions PASS; admin typecheck PASS0; admin lint PASS0. These remain source/unit results. Root owns the production rebuild/restart. Full expanded browser flows remain NOT_RUN until that callback.

Root populated55 new technical UI fixtures plus original public `YC-000001` =56 total. The technical rows do not prove public intake and do not change the original public request/counters/history. FE will use exact-code query for the original daily workflow and the technical rows for bounded cursor/filter/UI states.

## Actual expanded browser results before final copy build

| Criterion | Actual result | Evidence / limit |
| --- | --- | --- |
| Note / literal markup / NFC | PASS: original public lead v2→v3; script-like text stays literal, no script node; decomposed accent becomes NFC; deadline unchanged |[Daily flow](daily-workflow.json) |
| Contact outcomes | PASS: email attempt v4 retains Assigned; explicit two-way test record v5 moves Contacted; server activity deadline changes | Synthetic manual test records, no real contact/email; same daily-flow evidence |
| Close / reopen | PASS: completed closure v6 shortens expiry to14/1/27; blank reopen reason refused; reasoned reopen v7 returns Contacted and preserves shortened deadline | Same daily-flow evidence and [full-page capture](daily-workflow-desktop.jpg) |
| Filtered counts / global New | PASS: exact code gives1 while global New badge55; uppercase accented substring+New+unassigned+HCM date gives55; unaccented variant0 with private detail cleared |[Server query](server-query.json) |
| Lead leaves active filter | PASS: reassigning original lead from Me→A1 removes row and keeps same detail with explicit notice; restore A2 returns same row |[Left-filter capture](left-filter.jpg); server-query evidence |
| Full20/50 keyset sequence | PASS:20/20/16 and50/6, each union56 unique codes; Back restores same prior pages; size change resets cursor |[Cursor sequence](cursor-sequence.json); technical rows only |
| Lead conflict | PASS: second editor v9 note rejected after winning v10; stale input preserved, Compare reads v10; Cancel retains draft; only explicit discard loads current |[Conflict observations](lead-conflict.json),[capture](lead-conflict.jpg); two tabs use same existing A2 session |
| Dirty navigation | PASS so far: ClearFilters, link, tenant switch, refresh, row, page and filter Cancel retain input; clear+discard resets both displayed/applied query | In-memory observations will be saved with final mobile-back proof |
| Recipient settings | PASS: default is initial A1; empty selected save disabled; A2 choice preserved across actual reauthentication requirement; existing-factor reauth→savev2→reload retains A2 |[Recipient settings](recipient-settings.json); no credential/factor/grant changes |
| Controlled GET loading | PASS: root paused only verified owned API; refresh disables controls and clears old private detail |[Loading capture](get-loading.jpg),[fault observations](unknown-reauth.json) |
| Unknown settings → expired reauth → retry | PASS:15s timeout retains/freeze2choices; natural expiry leads to actual REAUTH_REQUIRED; original operation remains pending; existing-factor reauth→same retry savesv3 cleanly |[Fault observations](unknown-reauth.json),[unknown](settings-unknown.jpg),[reauth](settings-unknown-reauth.jpg); root PG beforev2/1receipt→afterv3/2receipts, one new write |

Unknown-request boundary: root PG read after API resume showed that paused settings PUT **had not committed**. This browser check proves the unknown/re-authentication/retry state sequence and one eventual write. It is not post-commit response-loss proof; backend evidence for that condition stays separate.

The first filtered-empty render used generic unfiltered-empty text. Its historical [capture](filtered-empty.jpg) is retained. Root approved the bounded copy repair: applied query with filters now says **Không tìm thấy yêu cầu** and suggests another query/clearing filters; genuinely unfiltered empty state keeps the original copy. Initial copy implementation failed React refs lint because it read an applied-query ref during render. Focused repair tracks the applied-filter flag in state only inside confirmed Apply. Final type/lint both PASS0. No unit logic changed after29tests/101assertions. Root received **SOURCE_FREEZE + BROWSER_HOLD** for its final build/restart; pending actual empty-copy/five-width/settings-conflict/count-cap/denied/recovery checks remain open.

## Final runtime checks after the copy build

| Criterion | Actual result | Evidence / limit |
| --- | --- | --- |
| Filtered empty copy | PASS: unaccented `minh hoa` returns0, **Không tìm thấy yêu cầu**, clear-filter guidance and no private detail | [Final filtered empty](final-filtered-empty.jpg) |
| Settings conflict | PASS: stale v3 Default choice rejects after another tab saves v4 selected A2; Compare does not overwrite; Cancel retains Default; explicit discard loads current A2 | [Settings conflict](settings-conflict.json), [capture](settings-conflict.jpg) |
| Five lead widths | PASS for list/detail/workspace at320/390/768/1024/1440; no document horizontal overflow and visible controls remain inside their panel | [Geometry](responsive-geometry.json); textarea width refinement below remains open |
| Five settings widths | PASS at320/390/768/1024/1440; narrow controls wrap within panel; sidebar settles at desktop widths | `settings-320.jpg` through `settings-1440.jpg`; same geometry JSON |
| Settings keyboard | PASS: search input Tab moves to **Tìm người nhận** | Actual DOM active element BUTTON; no settings mutation |
| Capped count | PASS: approved10001-row performance tenant renders **10.000+** in filtered count and tenant-wide New badge, with20 rows on page | [Count proof](count-cap.json), [capture](count-cap.jpg); technical fixtures, no exact total claim |
| Denied UI | PASS: existing A2 requests existing tenantB; **Không có quyền truy cập nha khoa này**, zero lead regions and no original lead contact | [Denied proof](denied.json), [capture](denied.jpg); UI membership gate, separate backend isolation proof belongs to root/API |
| Current authorized read after API resume | PASS: restored A2/S05 tenant, exact YC-000001 reads v10/A2 and saved history | Fresh read; prior paused GET automatic recovery was not independently captured |

Dirty mobile Back Cancel retained the note and detail; Back Discard returned to the same list row with row focus. All dirty-navigation observations are now saved in [dirty navigation](dirty-navigation.json).

**Bounded visual finding:** the activity textarea uses its intrinsic152px width while the containing detail field offers252–314px in the inspected layouts. The approved interface expects full available width. Root approved one CSS-only repair to `.detail-field textarea` with `width:100%`. No API, behavior, dependencies, fixtures or stored data need change. Existing screenshots remain historical. Final affected five-width captures and the viewport-only1440×1080 handoff image remain pending the coordinator's final build/restart.

The CSS repair is source-complete. Admin typecheck and scoped admin ESLint each exit0 after the one-property change. No behavior/unit logic changed; no duplicate unit suite was needed for this CSS-only patch. Source was frozen before root stopped the owned launcher for one final admin build/restart.

During that outage, periodic session validation reached the fail-closed **Chưa thể kiểm tra phiên** state before the intended list Refresh click. The Refresh locator no longer existed; that attempt is recorded as unexecuted, not a list-error PASS. The loaded UI has zero lead regions and no original private contact. Keyboard Tab from **Đăng nhập** focuses **Thử lại**. [Outage capture](get-outage.jpg). Recovery after root READY remains pending; this is a session-gate outage check, distinct from the earlier list loading capture.

## Final FE handoff — 2026-10-16 Asia/Ho_Chi_Minh

**Verified:** root's final CSS admin build passes19pages and full typecheck after build. Actual CSS render now fills the field at all five widths:320→254px,390→314px,768→252px,1024→252px,1440→287px. Each textarea equals its containing field width; document width equals viewport width. [Final textarea geometry](textarea-final-geometry.json). Corrected [390 detail](final-detail-390.jpg) and [1440×1080 viewport-only desktop](final-desktop-1440x1080.jpg) were visually inspected by FE and root. Root explicitly confirmed the final visual evidence. No further application repair is open.

The existing suspended S05 fixture was opened in an independent tab under ordinary A2. Its unexpired lead and history remain readable; the suspension notice appears; assignment, status, save, activity type, textarea and note-save controls are disabled. The list/back control remains usable. No mutation was attempted. [Suspended observations](suspended-readonly.json), [capture](suspended-readonly.jpg). That tab was closed and the final deliverable returned to S05 Synthetic UI.

After the final restart, periodic session validation automatically restored the authorized S05 list before keyboard activation. The Retry locator had already disappeared, so the Enter attempt did not execute. This is actual fail-closed/private-clear → automatic authorized recovery, with keyboard reachability of Retry separately observed. [Recovery observations](get-recovery.json). **NOT_RUN:** Enter-triggered recovery and a list-specific error/retry during this final outage. No extra outage was introduced to manufacture that result.

**Current review state:** ordinary A2; tenant `4e206516-529a-4799-b146-05f950214a00`; exact query `YC-000001`; persisted v10/Contacted/A2; empty activity draft and disabled save. The matched desktop capture has viewport1440×1080, document width1440, scroll0, sidebar left0/transformnone. Final warning/error log observation is empty. [Final state](final-state.json). The owned live tab is marked as a deliverable. Temporary viewport reset was called after matched captures; saved images retain their verified dimensions.

**Source checks:** final behavior suite29tests/101assertions PASS; final admin typecheck and scoped ESLint PASS0 after the CSS repair. Root owns build/process/database checks; root reported final admin build19pages and typecheck PASS after build. Independent source reviewer closed the pending-operation reauthentication and guarded-clear repairs; no new behavior change followed that review. The final CSS property was self-reviewed and verified in the real renderer. No additional behavior tests were needed for that property.

**Boundaries / NOT_RUN:** browser timed-expiry lead removal remains unexecuted; backend expiry evidence is separate. Browser unknown settings proof covers the mounted pending operation through timeout→actual reauthentication requirement→existing-factor reauthentication→same-operation retry. The paused PUT did not commit before that retry; the proof does not cover post-commit response loss, arbitrary page reload durability, or a workspace switch during an unresolved operation. Backend post-commit/restart proof remains separate. No real customer contact/email, external service, public second submission, credential/factor/grant change, Git operation, deployment or production action occurred. Human acceptance is not claimed.

**Ownership handoff:** FE implementation and scoped rendered checks are complete within these limits. All earlier NOT_RUN tables above remain historical and are superseded only by the specific later evidence rows. Root owns integration of this handoff into the shared task/state and the final preservation/secret/static closure. FE releases `apps/admin/**` and `docs/evidence/s05/ui/**` after this record; no further writes are planned.
