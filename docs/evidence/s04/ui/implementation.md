# S04 frontend evidence

Owner: `/root/s04_frontend`. Scope: `apps/admin/**`, `apps/website/**`, `docs/evidence/s04/ui/**`. Coordinator owns the task ledger, runtime, database and integration. Direct human S04 v0.1 approval and source-write/preflight release supplied by desktop. Runtime metadata matched Kit implementer, correct parent, `gpt-6.1-sol`, required/requested/observed `xhigh`; helper exit0.

Selected/read/invoked: frontend-ui-engineering, test-driven-development, incremental-implementation plus approved-template reference/checklist, TechNote. User controls explanation progression; silence grants no approval. Skills do not expand authorization.

## Approved template mapping

Reference `GCMS-UX-001 v0.1+Lucide`, pinned `approved-baseline.json` and all13 source pins preserved. Exact consultation sources: `mockup.js` `leadsPage`/detail, `mockup.css`, screenshots `lucide/04-leads-desktop.jpg` SHA256 `2f9f1e5decc7130fad01985d422cf31bd3f31c5ebb241e8e87079faaa3bf56f4`, `04-leads-mobile.jpg` SHA256 `dac3de86c06cf434c8013c5e9a74ea86e0eb3690c8560471d8e1a27605516198`.

Representative flow: published VI service consultation → API/PG → authenticated `/cms/leads?tenant=…`. Matched comparison targets1440×1080 and390×844; other widths320/768/1024. Existing Godent shell, green/muted tokens, typography, Lucide, eyebrow/title/subtitle, list/detail grid, masked list, detail contact/source/message/consent/retention, mobile detail/back are retained. Approved S04 differences: New-only read-only; remove search/filter/assignment/status editors/notes/export/history simulation/fake totals. Real page length and next-cursor footer only. Public “Gửi yêu cầu tư vấn” block after service article and before footer is D01's approved extension. Source page and optional interest are distinct; no interest selector is necessary for this minimal slice.

## Actual checks

- Initial RED: `./node_modules/.bin/bun test apps/website/lib/consultation.test.ts` exit1:0pass/1fail/1error because `./consultation` is not implemented. This is deliberate test-first evidence, not a runtime failure.
- Rendered/API/PG/browser/state evidence initially NOT_RUN, awaiting source and coordinator API/runtime readiness. No source/build claim proves the real flow.
- CUA current documentation read. Browser CAPTCHA completion requires action-time human confirmation; no CAPTCHA solving/submission will be attempted without it. API/unit adapter proof remains separate. Ordinary existing credential/factor login only; no resets/grants.

## Source integration checkpoint

`apps/website/components/consultation-form.tsx` is mounted after the real published service article and before the existing footer. Canonical `contracts/intake.ts` handles NFC/code points/contact/channel/consent; the browser helper uses a fixed API origin, JSON POST and `credentials: omit`. A normalized immutable request attempt retains its random UUID and semantic payload across uncertain transport results. Fields remain in component memory and are cleared after accepted acknowledgement. No request/contact is placed in URL, localStorage, sessionStorage, cookies or a Next forwarder. API success is accepted only for the exact minimal acknowledgement shape. Challenge loading fails closed; no shared token/boolean bypass exists. Challenge answers remain in memory.

`apps/admin/app/cms/leads/page.tsx` mounts `LeadWorkspace` within existing session/workspace/MFA gates. It reads the real masked20-item default API page and full authorized detail. Cursor back/next replaces the bounded page; no full contact in the list, fake totals, editors or unimplemented CRM controls. Source and optional interest are separate. Text uses React escaping. Session refresh reloads current access; stale requests are aborted and full detail is cleared before reload. Mobile detail/back keeps the selected row in memory and restores row focus.

Exact source checks:

- Both app typechecks: `./node_modules/.bin/bun run --cwd apps/website typecheck && ./node_modules/.bin/bun run --cwd apps/admin typecheck`: exit0.
- Focused ESLint on six new/changed TS/TSX modules: exit0, no warnings. Initial Bun fetch mock typing FAIL was repaired using the existing typed `Object.assign(..., {preconnect})` convention; the unused mock argument warning was then removed. No application control was weakened.
- `./node_modules/.bin/bun test apps/admin apps/website`: exit0, **32tests,119assertions**,13files. Consultation subset7tests26assertions covers contact/channel/consent, email-only/provided-invalid fields,500/501 NFC/emoji, immutable key/payload after unknown transport loss, anonymous transport policy, redacted errors/minimal ACK,409 and unavailable challenge.
- Final source review used code-review-and-quality; debugging-and-error-recovery applied to the typed mock error. Source review is not independent review or runtime proof.
- Build/restart/API/PG are coordinator-owned and NOT_RUN by this frontend worker. Existing running apps were still the prior S03 build at this checkpoint. Live availability and complete UI behavior remain Unknown.
- Local existing mockup server63421 connection refused. Pinned reference screenshots/source were inspected directly; no new mockup process was started.
- Coordinator later reported both Next builds PASS (admin18pages including `/cms/leads`, public dynamic service). This is coordinator-owned build evidence, not a frontend-worker build run. Coordinator requested application source freeze while API/newfixture finish; acknowledged. No further app writes without necessary coordinated repair.
- CUA actual existing `/account` identifies synthetic S02 A1 with two-factor enabled and verified for the current session. No credentials/factors were read or submitted during this preflight. Selected admin tab viewport was measured1440×1080,DPR1. S04 data/interaction remains pending.

## Verification checklist (initial)

Structure/hierarchy, workflow order, controls, state continuity, current permission, keyboard/focus, responsive structure, container clipping, populated/empty/loading/error/denied/pending-retry: NOT_RUN pending real representative flow and runtime. Preview identity: N/A, this is lead read-only UI. Human acceptance and production: Unknown/outside this handoff.

## First live browser checkpoint

Coordinator supplied API/all3 app readiness and fresh owned UI tenant `c4000000-0000-4000-8000-000000000001`, `s04-synthetic-ui`, service `tu-van`, publication `d01a888b-c83d-4709-9629-0405227570de`. No runtime/database action by FE worker.

- Actual anonymous phone-only form submitted with synthetic contact, unchecked-by-default consent checked through UI and optional synthetic message. UI returned “Đã tiếp nhận yêu cầu tư vấn” and explicitly states no confirmed appointment. `public-accepted-desktop.jpg` records this result at actual1280×720; despite an earlier capability set, the non-selected public tab retained1280×720. Do not call it1440 proof.
- Existing A1/current MFA selected the new tenant through `/cms/leads?tenant=…`; session shows active membership. Actual CMS lead GET returned403 and rendered “Không thể truy cập yêu cầu”. Affected flow paused and evidence sent to coordinator before any dependent source repair or second submission. Cause Unknown at this checkpoint. `cms-first-flow-403-desktop.jpg` is actual1440×1080, no overflow; captured console error/warn list empty. This denial is an observed failure of the intended positive flow, not an authorization-negative PASS.
- Viewport capability targets the browser-selected tab3. Using that same selected tab for both screens fixes measurement. `public-form-desktop.jpg` was recaptured at measured1440×1080 (full-page JPEG height may exceed viewport). Public form is after article and before footer; consent initially false and no horizontal overflow. First core public→CMS flow remains incomplete pending coordinator diagnosis. No second submission or CAPTCHA action performed yet.

## Core flow and responsive checkpoint after API repair

The prior403 is historical. API owner confirmed PostgreSQL42501 from an unnecessary `FOR SHARE` tenant read under the SELECT-only runtime role. API owner removed that lock; no UPDATE grant or MFA/RLS weakening. Coordinator built/restarted API and released retry of the existing lead. FE made no repair/source change.

**PASS:** A1 read the same existing phone lead with masked list, full authorized detail, source, consent and initial expiry. `cms-a1-first-lead-desktop.jpg` is a measured1440×1080 viewport screenshot. An initial `fullPage` capture had a rendering artifact despite correct DOM geometry; it was recaptured as a hydrated viewport screenshot. Coordinator inspected the actual JPEG and confirmed the representative checkpoint before broader UI checks.

**PASS:** ordinary A2 login with its existing password and existing enrolled TOTP; no reset, grant, new credential or factor change. `/account` visibly identified S02 A2 and current MFA. A2 read the same first lead. Credentials/factor/code were held only in CUA memory and never printed or captured in screenshots. `cms-a2-first-lead-desktop.jpg` records the read result.

**PASS:** email-only second request, preferred EN/Email, phone empty. Form rejected501 NFC characters before API, displayed500 after correction, then returned accepted acknowledgement. A2 CMS list contains two real New leads. The second full detail has the synthetic email and exactly500 NFC code points; literal `<b>văn bản</b>` remains text. `public-501-validation-desktop.jpg`, `public-email-accepted-desktop.jpg`, `cms-two-leads-desktop.jpg`. Separate unchecked-consent and invalid-provided-email guards rendered errors before API (`public-consent-validation-desktop.jpg`, `public-contact-validation-desktop.jpg`). A later independent review identified a narrower email grammar gap in the canonical shared validator; API/root own that repair and final affected verification. These earlier cases do not prove all email syntax.

**PASS (observation only):** the third new request returned a genuine required challenge. Fields stayed disabled with entered data preserved and the same attempt retry control. No answer was entered and no CAPTCHA was solved/submitted. `public-challenge-required-desktop.jpg`, `public-challenge-mobile.jpg`. Browser challenge completion remains **NOT_RUN — action-time human confirmation required**. This is no production bot-protection proof.

**PASS:** measured public and CMS at320/390/768/1024/1440 widths (390×844; other explicit sizes in `geometry.json`). No document horizontal overflow. Measured list/table/detail containers have no horizontal overflow; public challenge/retry controls and CMS refresh/row/back controls remain within their containers. Exact geometry and actual screenshots `public-320/768/1024/1440.jpg`, `cms-320/768/1024/1440.jpg`. `cms-detail-320.jpg` measures narrow detail client/scroll294px and a fully contained back button.

**PASS:**390×844 actual CMS list/detail uses the approved mobile separate view/back pattern (`cms-list-mobile.jpg`, `cms-detail-mobile.jpg`). Opening detail focuses its heading; back restores the selected row BUTTON. At320, Enter activates back and returns focus to the row. Full500-character text wraps without horizontal clipping. Public keyboard Tab reaches the retry control and scrolls it into the viewport without submitting.

**PASS:**390 mobile drawer opens with focus on Close; Tab from the final navigation link wraps to Close; Escape closes the drawer and restores Open-menu focus after the rendering frame (`cms-menu-mobile.jpg`). Menu `aria-expanded` observed false after Escape.

**PASS:** real authorized S02 A list is empty and displays0 on the current page (`cms-empty-desktop.jpg`, `cms-empty-mobile.jpg`). No fixture/data changes. A2 selecting S02 B is denied by WorkspaceGate (`cms-wrong-tenant-desktop.jpg`, `cms-wrong-tenant-mobile.jpg`); this proves the UI membership gate, not direct-API isolation. Root/API tests own backend isolation proof.

**NOT_RUN:** actual browser unknown-timeout/same-key retry, lead-specific transient loading screenshot and a general API-outage UI state still need an appropriate coordinator-owned fault path. Helper tests and root/API transaction/restart checks remain separate evidence. Observed initial session-loading UI is not a lead-specific loading claim. No broad UI/private-access/production/human-acceptance claim follows from these bounded results.

## Final frontend handoff

**CODE_INTEGRATED + VERIFIED_BOUNDED_BROWSER**, not full-S04 closure or human acceptance. The actual API/PG/security/integration ledgers remain coordinator/API-owned. Source changes stay within `apps/admin/**` and `apps/website/**`; evidence within this directory. Shared task/state documents were not edited by this worker. No Git/commit/push/deploy, process/database mutation, credential/factor reset, CAPTCHA solution or new access grant by this worker.

- After ordinary existing A1 sign-in/MFA, A1 read both accepted phone/email requests, proving the common list from both A1 and A2. `cms-a1-two-leads-desktop.jpg`.
- Root applied the canonical email repair, reported website production build PASS and restarted the owned apps. Against that rebuilt runtime, all four malformed cases (`a<b@example.invalid`, double-dot domain, leading-hyphen domain and trailing angle delimiter) rendered local validation errors with the original submit control retained. No new request attempt or lead was created. `final-email-validation.json`, `public-final-email-validation.jpg`.
- A valid plus-address was filled without submission; native input validity observed true. Canonical valid acceptance is supported by the shared/helper tests and earlier real email-only flow; **no additional valid browser submission was performed after the email repair**, per root's no-new-intake instruction. This native check alone is not a claim about DNS or delivery.
- Final A1 CMS read still shows exactly the same two accepted requests. `cms-final-desktop.jpg`. `.request-copy b` element count0 confirms markup remains literal text. Current URL contains only the tenant context, no submitted contact/message. Captured final browser error/warn logs were `[]`. Browser persistent-storage contents/cookies were not read; no-storage claims come from source inspection, not an inventory of existing browser data.
- Final FE unit command after shared validator source repair: `./node_modules/.bin/bun test apps/admin apps/website` exit0,32tests119assertions. Focused ESLint and both app typechecks passed as recorded above. Coordinator owns actual Next builds; no competing `.next` build was run by FE.
- Viewport override reset. Selected tab left at A1's `/cms/leads?tenant=c4000000-0000-4000-8000-000000000001` and marked for handoff. Temporary private fixture references/TOTP buffers were cleared from CUA memory; extra accepted public tab closed. No filled authentication screenshot was captured.
- Outstanding browser limits remain explicit: CAPTCHA completion requires human action-time confirmation; actual unknown-timeout/same-key retry, general-outage error state, lead-specific transient loading screenshot, inactive/revoked/platform/anonymous direct-API access, suspended-tenant browser read and a full20-item cursor UI sequence are NOT_RUN by this worker. Root/API real transaction/access/expiry/cursor/fault tests are separate. No fixture was created and no counter was reset to evade CAPTCHA.

Coordinator checklist reviewed at handoff: current human authority/owned scope preserved; canonical contracts and template pins retained; representative checkpoint confirmed before dependent checks; historical403 closed by supported API repair; final actual artifacts and NOT_RUN limits reconciled; no material scope change/latest stop bypass. Root owns remaining shared-record updates, integrated review disposition and final package/human-review status.

## Bounded actual loading/outage follow-up — 2026-10-16

Coordinator assigned a read-only UI follow-up under the approved S04 scoped-fault authority. No application writes, new intake, fixture/counter changes, network interception, mocks, configuration changes or CAPTCHA. Coordinator alone controlled the exact owned processes. Current runtime metadata check for sensitive test development PASS: Kit implementer/correct parent/gpt-6.1-sol/xhigh, exit0.

The prior IAB browser was unavailable after the worker's first final response despite its handoff mark. One fresh supported Edge session was prepared through CUA. Ordinary existing A1 password/TOTP sign-in succeeded; no reset/new factor/grant. The same two leads loaded at measured1440×1080 (`fault-baseline-desktop.jpg`). No filled authentication screenshot or secret output. This is a browser-tool availability recovery, not an application repair.

| Actual condition | UI action and observed result | Evidence | Result |
| --- | --- | --- | --- |
| Coordinator SIGSTOP of exact owned API,30-second SIGCONT watchdog | In-page **Làm mới** shows **Đang tải yêu cầu** and current-access check. Refresh `isEnabled=false` (**disabled=true**); one `aria-busy=true` region; lead-table count0 and full detail cleared. | `cms-real-loading-desktop.jpg` | PASS |
| Coordinator confirms watchdog SIGCONT exit0 | The original in-flight read completes and returns the same two leads/full authorized detail. No retry or page reload required. | `cms-loading-recovered-desktop.jpg` | PASS |
| Coordinator guarded stop of owned app launcher/children; DB/Docker unchanged | Hydrated page's in-page **Làm mới** shows **Chưa tải được yêu cầu** and **Không thể kết nối. Kiểm tra kết nối và thử lại.** Retry enabled; private lead table/detail cleared. No internal exception/contact/message appears in the error state. | `cms-real-outage-desktop.jpg` | PASS |
| Same real outage | Keyboard Tab from Refresh focuses the **Thử lại** BUTTON. No retry before coordinator readiness. | `cms-outage-retry-focus.jpg` | PASS |
| Coordinator restarts all3 apps and confirms readiness | In-page **Thử lại** returns the same two leads/full authorized detail. Refresh enabled; Retry absent. No page reload or new submission. | `cms-outage-recovered-desktop.jpg` | PASS |

The general network refusal is an intentional fault condition, separate from an uncaught application defect. This provider's captured error/warn log array was `[]`; this does not claim that every browser/network diagnostic was absent, and does not expand the earlier normal-flow zero-captured-console result into a global claim.

**Supersedes only two prior NOT_RUN items:** actual lead-specific loading screenshot and general API-outage/error/retry are now PASS within the above desktop cases. **Still NOT_RUN:** public POST unknown-timeout/same-key replay, CAPTCHA completion, full20-item browser cursor sequence and the other separately listed current-access browser negatives. GET loading/outage/recovery does not prove POST idempotency or public submission timeout behavior. Root/API fault/transaction evidence remains separate.

Viewport override reset and temporary credential/TOTP references/buffers cleared. No request is in flight at handoff. Current UI recovery returns the two original accepted requests; coordinator owns final runtime/preservation refresh. No app, process, database, fixture, Git or deploy writes by this worker; only owned UI evidence updated. No new unit/build run was needed for this observation-only follow-up because application source was unchanged.
