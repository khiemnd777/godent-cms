# M2 admin UI implementation evidence

Owner: native `/root/m2_ui`, bounded `apps/admin/**` and this evidence directory. Root owns integration and shared task records. Required/requested xhigh; root verified actual kit-implementer, parent, inherited gpt-6.1-sol and xhigh metadata PASS. Direct M2 approval and exact scope remain in `docs/tasks/GCMS-M2-001.md`. No Git delivery, application process control, retained data mutation or credential access by this worker.

## Source integration checkpoint

**Verified source, runtime NOT_RUN.** The source connects:

- S06 lead extension with explicit reason/future expiry, version/operation identity, password reauthentication, unknown-result retry and conflict comparison. Detail shows effective/base/extension deadlines and notice delivery state. Activity history renders `retention_extended` reason and deadline.
- S06 list/count/badge server-time validity windows, conservative response-latency handling, deadline abort/clear/reload and expired-detail dirty-modal disposal. Late list/detail responses cannot repopulate an elapsed validity window.
- S07 `/cms/media`: bounded multipart upload, processing/rejected/ready/withdrawn state, private signed preview, patient-derived evidence scope, withdrawal confirmation, processing/purge outcomes, retained operation retry and input-preserving conflict comparison.
- S07 optional service cover selection, alt text, draft save and private preview. The signed gateway is the only allowed image URL; Next image optimization is disabled for this controlled current-eligibility route.
- S08 service and site history paging, version viewing, selected-history comparison with saved draft, and authenticated current live service comparison. Restore creates a draft through the canonical versioned endpoint. Service unpublish identifies tenant/resource/head and requests current-password reauthentication when required.
- S08 all admin active-state decisions use `activePublication`; `publicationVersion` remains a historical monotonic counter. Save → Preview → Update website action order is preserved.

## Approved visual source

Use `docs/design/admin-mockup/approved-baseline.json`, revision `v0.1+Lucide`. Inspected the pinned desktop leads, mobile lead detail and desktop editor screenshots. Retain sidebar/header, lead list/detail, content/SEO tabs, save-preview-publish order, editor publication sidebar, panels, tokens, Lucide and mobile hierarchy. Replace prototype image material with the approved S07 library and current media state; add M2 retention/history/withdrawal controls within those patterns.

Pinned desktop leads SHA-256: `2f9f1e5decc7130fad01985d422cf31bd3f31c5ebb241e8e87079faaa3bf56f4`. Pinned desktop editor SHA-256: `b99d22f7cec92edff3cff88adb3d9f89a3cf1101a842a39b41b1d4a532658acc`.

## Exact local checks

2026-10-16:

- `./node_modules/.bin/bun test apps/admin/lib apps/admin/components/*.test.* apps/admin/proxy.test.ts`: **PASS, 43 tests, 147 assertions**, 14 files. New tests cover expiry boundary, conservative latency/client-clock timing, finite extension input, inactive head with retained counter, pending state, local media file boundaries and signed gateway allowlisting. Request regression confirms FormData boundary handling, cookies, no-store and CSRF.
- `./node_modules/.bin/bun x tsc --noEmit -p apps/admin/tsconfig.json`: **PASS**, exit 0 after source integration and focused fixes.
- `./node_modules/.bin/bun --bun eslint apps/admin --max-warnings 0`: **PASS**, exit 0 after focused React-state fixes.

Preserved failure context: initial new helper suites failed because implementation modules did not exist (intended red step); multipart test failed because old transport JSON-serialized FormData, then passed with browser-managed boundary handling. Initial admin tsc found four provisional history-union errors before canonical `retention_extended` was provided. First lint found six render-ref/effect errors, repaired by state-held detail deadline, event-only receipt reads and deferred history loading. No test/assertion/gate was removed or weakened.

Source review follow-up: media conflict comparison reads the current asset without discarding entered evidence/reason; media/history denial clears cached private state. Post-publication current-head refresh blocks editing while in flight. Publish/unpublish use a 15-second transport timeout, retain operation identity across uncertain results, and release the uncertainty lock after a definitive conflict. The retention form rebuilds a known-rejected first attempt after password reauthentication so visible edits remain the submitted input. Admin lint and typecheck again passed after these changes. A processing/purge retry control consumes the media owner's new canonical `/retry` endpoint.

## Verification still required

**NOT_RUN:** actual authenticated UI, desktop/mobile template comparison, widths 320/390/768/1024/1440, keyboard/focus/container reachability, populated/empty/loading/error/denied/conflict states, dirty privacy clearing/late XHR and Enter-caused retry, upload-processing-publish-withdrawal, history-restore-unpublish-republish. Reason: root preservation/preflight and owned synthetic runtime manifest have not yet been released to this worker. Root owns prerequisite; this worker owns the subsequent browser checks and evidence. Build/integration/API/storage/deletion/independent review and human acceptance are separate coordinator criteria.

## P1 response-timing repair — 2026-10-16

**Verified finding:** the first `changed(lead)` recalculated a validity window with receipt-time `Date.now()`. A slow command/extension response could gain extra display time. The absolute `expiresAt` fallback could not protect a client clock behind the server. Command and extension conflict comparisons also cached a raw lead without a bounded comparison window.

**Focused plan before repair:** centralize private lead response capture at request start; carry the resulting deadline through every command, extension, detail and comparison application; reject elapsed responses; expire cached comparisons and clear private/dirty UI without a navigation guard. Preserve existing contracts, processes, data and authorization. Resume browser checks only after root releases the isolated manifest.

**Implemented:** `lib/lead-response.ts` captures `{lead, deadline}` before/after the actual private API request. Private lead timing must be finite and current. `LeadWorkspace.changed(snapshot)` validates the original deadline again and never restarts it. Both comparison paths retain a timed snapshot, schedule cache expiry and validate it again when `Use current` executes. Expiry clears the comparison and calls the workspace privacy reset, which removes private detail/history and dirty modal state with an expiry explanation. List/count/badge continue to use their existing request-start timing windows.

**Verification:** new deferred-fetch tests reproduce the old receipt-time admission under a client clock behind the server and verify that delayed command, extension and compare responses are rejected after `serverTime`/`validUntil` elapse. Further tests verify that an accepted comparison expires at its original deadline, delayed `Use current` cannot apply it, and missing/malformed private timing fails closed. Initial new-suite red was a missing implementation import; the old-calculation witness is explicit in each delayed-response test.

- `./node_modules/.bin/bun test apps/admin/lib/lead-response.test.ts`: **PASS, 5 tests, 12 assertions**.
- `./node_modules/.bin/bun test apps/admin/lib apps/admin/components/*.test.* apps/admin/proxy.test.ts`: **PASS, 48 tests, 159 assertions**, 15 files.
- `./node_modules/.bin/bun --bun eslint apps/admin --max-warnings 0`: **PASS**, exit 0.
- `./node_modules/.bin/bun x tsc --noEmit -p apps/admin/tsconfig.json`: **PASS**, exit 0.

**NOT_RUN:** rendered browser reproduction and integrated runtime expiry proof, pending root's isolated browser fixture release. These tests prove transport/admission and cached-snapshot access rules; they do not prove browser timer scheduling or rendered dirty-modal disposal.

Adjacent P1 path review: a comparison can carry an earlier deadline than the previously read list. Its expiry reset now also invalidates the navigation badge and triggers a fresh eligible list/count read after private detail/history/dirty state has been cleared. This does not pass through the navigation guard. Admin lint/typecheck passed again after that bounded change.

## History timing adjacency — 2026-10-16

**Verified source gap:** lead history previously relied on the parent detail's cached deadline. If another administrator shortened expiry before a later history read, private history could remain visible under the older parent window.

**Focused plan before repair:** consume the retention owner's fresh `LeadHistoryPage` timing contract; capture request start for each history page; reject delayed pages; retain the earliest captured deadline across accumulated pages; clear history and the parent private/dirty UI at that deadline. No contract, DB, runtime process or credential changes by the FE worker.

**Implemented:** `requestLeadHistorySnapshot` uses the same request-start timing design as detail/command responses. `historyFromSnapshot` refuses expired data. `mergeHistorySnapshot` carries the minimum validity deadline and discards an already expired prior page. `LeadHistory` keeps the timed snapshot, refuses a delayed response, schedules cache disposal, aborts pending history reads and invokes `onUnavailable('expired')`. The workspace then removes private detail/history/dirty state and refreshes eligible list/count/badge without a dirty-navigation guard.

**Verification:** deferred fetch reproduces an A2-shortened two-second history window while the stale detail still appears valid for ten seconds under a client clock behind the server. The delayed page is rejected. Separate tests check early page expiry, accumulated-page deadline selection and disposal of expired prior pages. Initial new-test red was the missing new history exports; no assertion or gate was weakened.

- Focused timing suite: **PASS, 8 tests, 21 assertions**.
- Full bounded admin suite: **PASS, 51 tests, 168 assertions**, 15 files.
- Admin ESLint and TypeScript: **PASS**, exit 0.

**NOT_RUN:** authenticated rendered/history-expiry proof, pending root's isolated browser manifest and go-ahead. A fresh response window reflects eligibility at the server's read; it cannot reveal a future mutation after that read. This repair does not claim realtime observation of future administrator changes.

## Isolated browser preparation and first observations — 2026-10-16

Root released the new owned `GCMS-M2-UI-v1` run `9b4aeade-d69e-4655-b293-6b349d2233ac`, two tenants and synthetic leads. The FE worker verified the manifest's private mode and binding without printing credentials. Root owns fixture-clock changes and media worker execution. No DB, Docker or application process control was added to browser scripts.

The worker's default-permission sandboxed Chrome launch failed before login. A bounded launch-only probe reproduced immediate browser closure. The Kit worker did not request escalated execution. Root executed the browser harness with its separate authority; normal password login succeeded. Initial retained test administrators could not see the new tenant because their session membership result had reached the existing 100-row cap. Root created new owned browser users and a separate private identity manifest. No retained account/password or product auth limit was changed.

Actual source-backed DOM/API evidence reached the S06 extension form in the new tenant: lead list/count/detail/history reads returned 200, the form and current deadline were visible. This partial run then timed out on an overly exact harness label whose accessible name includes helper text. The harness now selects the observed datetime input. Inline reauthentication uses actual password-only response confirmation and form disposal rather than the AUTH driver's persistent-notice expectation. These failures do not constitute product-flow PASS.

Prepared harnesses are `.local/m2-ui-representative.ts`, `m2-ui-lead-privacy.ts`, `m2-ui-states.ts`, `m2-ui-editorial.ts` and `m2-ui-media.ts`, with shared `m2-ui-driver.ts`. All six pass standalone TypeScript checking. They use fresh browser contexts, normal login and explicit tenant selection, fixed loopback destinations, redacted failures/statuses and synthetic-only screenshots. The media script emits an exact tenant/asset worker request for root; it does not dispatch workers or drain backlog. The privacy script requires a root-prepared owned expiry window and does not backdate data itself.

Full actual browser results remain pending root execution. Earlier source-only NOT_RUN entries above are historical checkpoints, not claims that fixture release is still missing.

## Actual UI checkpoint — 2026-10-16

Root executed the prepared scripts with its permitted sandboxed Chrome launch. The FE worker inspected the generated JSON, safe DOM and screenshots.

- `s06-representative.json`: complete, no errors. Real lead extension, focus/Enter interaction and widths 320/390/768/1024/1440 pass the recorded geometric checks. Desktop lead structure matches the approved panel/list/detail/navigation pattern. Current mobile screenshots were captured immediately after resizing and show the sidebar obscuring content; mobile template fidelity remains open until the stable-viewport capture below passes.
- `s08-editorial.json`: complete, no errors after root's bounded API repair. Actual private preview, history/current-live comparison, draft-only restore with identical anonymous SSR, explicit publish, unpublish with anonymous 404 and retained counter, republish with increasing counter, two-administrator conflict/input preservation, dirty cancellation/discard and site-history restore pass. Editor/history width checks pass within their recorded geometry scope. The earlier generic publish 403 was preserved as an earlier runtime failure; the root owns its cause, repair and backend proof.
- `s06-privacy.json`: partial failure at the final message assertion. The preceding actual checks observed dirty dialog disposal, expired row removal and unsaved private-input removal. Both synthetic leads share the same message body, so the remaining valid lead caused the message-only assertion to fail. Safe failure DOM confirms the expiry explanation, one valid row and the valid lead's distinct identity/contact. The harness now checks the expired lead's unique name/code/phone. Root must allocate a fresh owned expiry fixture for the rerun; the expired record must not be revived to satisfy the test.
- S07 actual UI uploaded three new owned assets and emitted an exact tenant/asset processing request. Full processing/publish/withdrawal proof is pending worker execution and script completion.

Capture repair: shared `settleViewport()` waits for the mobile sidebar to be hidden, translated out of view and inert before collecting measurements. Screenshots disable animations after this DOM condition passes. Final captures match the pinned 1440×1050 desktop and 390×844 mobile viewport dimensions. `.local/m2-ui-visual.ts` provides read-only final lead/editor/media captures without replaying mutations. A failed sidebar readiness condition must be treated as an observed UI problem; it is not bypassed.

## Actual interaction and visual outcomes — 2026-10-16

These later results supersede the earlier pending/partial checkpoints only for the named cases. Root executed the browser and scoped worker commands. This worker prepared the harnesses and inspected their actual JSON, DOM and captured images.

- `s06-representative.json`: **complete/PASS** for actual extension, explicit future expiry, focus/Enter and all five width/control checks, with no errors. **Evidence correction:** the original `normalPasswordReauth:true` field was hardcoded. That field is **UNVERIFIED** and cannot prove a reauthentication branch. The source now records the observed branch, but the source correction does not retroactively validate the original artifact. The separate final `s06-password-reauth.json` is the authority for the actual reauthentication proof below.
- `s06-privacy.json`: **complete/PASS**, no errors, with a newly owned privacy lead. Expiry closes the dirty dialog, removes the selected row and unsaved private input, and refuses the held actual history response after delivery. The outage case proves there is no automatic recovery before Enter and that focused Retry + Enter creates a new successful HTTP request.
- `s06-states.json`: loading, error, empty/filter and focused Enter recovery checks **PASS** at 1440 and 390 px. The subsequent historical timeout was in the harness's exact accessible-label lookup, whose name included helper text. The selector now uses the observed retention textarea; no product behavior was changed to satisfy that timeout.
- `s06-conflict-only.json`: real two-administrator extension conflict, preserved reason, current-deadline comparison, cancel-preserved input and explicit dirty-discard/use-current **PASS**. Conflict layout/control bounds pass at 1440 and 390 px. The later denial check passes at 1440 px and **FAILS** with page overflow at 390 px. The affected denial flow is paused for a focused diagnostic/repair. The former catch captured the primary page; `.local/m2-ui-denied.ts` captures the actual foreign-user denied page and geometry independently. No CSS repair has been claimed at this checkpoint.
- `s07-media.json`: **complete/PASS**, no errors. Real uploads reach processing/ready/rejected, patient-derived material receives recorded permission, the library/picker save the optional cover and alt text, private and anonymous images decode, explicit publication exposes the eligible cover, and withdrawal denies the derivative and redacts public HTML. Library controls fit all five widths. Root's exact owned processing batch and ordinary purge are separate worker evidence.
- `s07-media-retry.json`: **complete/PASS**, no errors. Root's real storage adapter fault exhausts the owned withdrawn asset's purge. The UI shows failure; focused retry + Enter submits the normal retry endpoint and shows pending. Root's bounded normal worker completes the purge; the UI shows completion with no stale retry. Access remains denied through failed/pending/completed states and permission is never regranted. No DB mutation or synthetic status response is used by the UI runner.
- `s08-editorial.json`: **complete/PASS**, no errors. Actual private preview, history/saved-draft/current-live comparison, restore to draft without changing anonymous SSR, explicit publish, unpublish/404 with retained historical counter, republish, two-administrator conflict/input preservation, dirty cancel/discard and site-history draft restore pass. Editor and history controls fit all five widths.
- `final-visual.json`: **complete/PASS**, 15 lead/editor/media captures at 320/390/768/1024/1440 px. Each page reports viewport-width scroll bounds and the named controls remain in their panel. Stable mobile sidebar readiness is checked before capture. These captures do not cover the separately failing denied screen.

**Visual inspection:** compared the pinned leads/editor desktop and mobile references with `final-lead-1440.png`, `final-lead-390.png`, `final-editor-1440.png` and `final-editor-390.png`. The sidebar/header, green/neutral palette, panels, typography hierarchy, content/SEO tabs and Save → Preview → Update website order remain recognizable. Mobile hides the sidebar and shows selected lead detail with a return-to-list action; the editor retains the fixed action row and stacks publication/cover panels. M2 adds retention/history/permission/withdrawal controls and actual auth actions. The withdrawn cover shows current denial rather than the prototype image. This is a source-and-rendered comparison of representative screens, not a numerical pixel-diff or an assertion that every screen/state is identical to the mockup. The mobile lead reference shows the list; the actual final lead capture shows the selected detail, so their content positions are not directly comparable.

**Proof limits:** the FE worker did not independently execute escalated Chrome or worker commands. Root execution and resulting artifacts provide the runtime evidence. Full cross-browser/screen-reader/automated WCAG audits, browser multi-page history exhaustion, production performance, backup restore, external delivery, Git delivery, deployment and human M2 acceptance are **NOT_RUN/outside this FE evidence scope**. Independent security review belongs to the coordinator; this implementation handoff does not self-certify it. The current denied-screen overflow remains open until the bounded repair and actual rerender pass.

## Denied-screen overflow repair — 2026-10-16

**Verified cause:** `s06-denied-diagnostic.json` and its actual B1 denied-page capture show the allowed-tenant link inheriting `.btn { white-space:nowrap }`. The 400.77 px link exceeds the 316 px workspace-options container at 390 px (left −5.38/right 395.39), and exceeds the 256 px container at 320 px (left −40.38/right 360.39). The state panel and workspace-options container remain within the page; 768/1024/1440 px do not overflow.

**Focused plan recorded before repair:** bound only `.workspace-options .btn` to its container, allow normal text wrapping and break an unbroken tenant name if necessary. Preserve full tenant identity and shared button/layout styles. Verify the actual denied page at all five widths and focus/Enter selection after root rebuilds the owned CSS.

**Source repair:** one scoped CSS rule adds `min-width:0; max-width:100%; white-space:normal; overflow-wrap:anywhere`. No authorization, API, fixture, shared button or other view behavior changes. Browser regression remains **NOT_RUN** until root builds/restarts and runs `.local/m2-ui-denied.ts`; the diagnostic FAIL is preserved separately.

**Final result — CLOSED:** after root rebuilt/restarted admin, `s06-denied-final.json` completed with no errors. Scroll width equals viewport width at 320/390/768/1024/1440 px; every measured state/container/link stays inside the viewport. At 320 px the full allowed-tenant link is bounded to 256 px (left 32/right 288); at 390 px it is bounded to 316 px (left 37/right 353). Inspected `s06-denied-final-320.png` and `s06-denied-final-390.png`: the full name wraps inside the button and the denial icon, title and explanation remain readable. Keyboard focus and Enter select the user's own permitted tenant. No cross-tenant lead rows appear. The original diagnostic FAIL and conflict-run denial FAIL remain preserved as pre-repair evidence.

**Checks after CSS:** this worker's admin ESLint and admin TypeScript commands both **PASS**, exit 0. Root reports the final full build/typecheck/lint **PASS**. The prior **51 tests / 168 assertions** admin suite is the source-logic result; the CSS-only repair did not require replaying passed mutation suites. There is no numeric pixel-parity claim.

**Handoff status:** scoped M2 FE source is complete, the diagnosed overflow is closed, and the named S06/S07/S08 UI workflows have the actual proof described above. Root owns the separate final password-reauthentication evidence, integration/independent review, shared records and human acceptance. Cross-browser/accessibility audits, browser multi-page history exhaustion and production/backup/external/Git/deployment checks remain outside this FE verification scope. No additional FE product change is proposed.

## Final password-reauthentication proof and handoff closure — 2026-10-16

**Verified:** root's separate `.local/m2-ui-reauth.ts` run completed; `s06-password-reauth.json` is **PASS**, phase `complete`. Inspected both the runner's actual-response assertions and its result. The current synthetic session receives actual `403/REAUTH_REQUIRED`; the form preserves its reason; normal password-only reauthentication returns 200; resubmission applies the extension with 200/201; the latest timeline item contains the unique reason. The runner uses fresh normal password login and the exact owned-session clock handshake controlled by root. This proof supersedes the original representative artifact's unverified hardcoded reauthentication flag.

Two earlier reauthentication runs reached the applied response but timed out in the final history-text assertion. Their initial/strict-selector failure JSON remains preserved. The final harness uses a unique reason and the latest timeline item. No product code or assertion requirement was weakened to repair those selectors.

Root reports that all three newly owned controlled-session clock changes were restored successfully. This FE worker did not write session data or execute the clock helper.

**Final FE handoff:** **source complete; named local UI checks verified; ready for coordinator integration/human review**. No known FE finding remains open in this bounded assignment. The coordinator reports independent review and full build/typecheck/lint PASS; those retain their separate ownership and scope. M2 human acceptance, Production and the explicit NOT_RUN limits above are not implied.
