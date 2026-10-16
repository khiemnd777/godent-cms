# S03 UI implementation handoff

**Verified local UI behavior; ownership released to desktop `/root`.** Supporting evidence for [GCMS-S03-001](../../../tasks/GCMS-S03-001.md), 2026-10-16. This evidence does not establish human S03 acceptance or production readiness. No Git delivery, deployment, global configuration, credential creation/grant or destructive resource action was performed.

## Delivered source

- `apps/admin`: canonical S03 service list/editor/private preview; title/summary/rich text/SEO/path; exact draft/publication/site revisions; dirty/busy/conflict controls; explicit publication confirmation and real five-minute reauthentication; accessible in-app discard dialog; bounded site name/slug/footer settings; accurate overview and current published-service link.
- `apps/website`: anonymous server-rendered `/<tenant>/dich-vu/<slug>`; safe React rich-text renderer; fixed local API, no forwarded credentials/headers, no-store and five-second deadline; exact validated canonical/actual VI/local noindex; genuine missing-page versus API-unavailable handling.
- Canonical API contract and pure content validators remain owned by the API worker. No API/database/root files were modified by this worker. Prototype review UI, fake counts/success/data, image/history/unpublish/restore actions were not introduced.

## Actual browser outcome

Existing synthetic A1 credentials and existing backup challenges were used through ordinary sign-in/reauthentication. Credential values stayed in memory and were not printed or captured in screenshots. No session injection, new factor/code generation, permission grant or auth bypass occurred.

Tenant `c3000000-0000-4000-8000-000000000001`: site draft saved as version **7** with useful synthetic name/footer. New service `2db0e1f4-05bf-45c0-bd4f-07b236c46757` ends at saved draft **4**, live publication **2**, site version **7**. The retained empty S02 fixture was read only; no record was created or changed there.

Public result: <http://localhost:5892/s03-synthetic-a/dich-vu/cham-soc-rang-dinh-ky-ui-s03>.

| Criterion | Actual evidence | Result |
| --- | --- | --- |
| Real create/save/reload/preview | Actual A1 UI; structured H2/list/link and literal script text; correct draft/site identity | PASS |
| Explicit publication | Confirmation names tenant/service/VI/exact revisions; real REAUTH_REQUIRED then ordinary successful reauthentication and explicit confirmation | PASS |
| Pending draft isolation | Public reload retains V1 after draft V2 save; private preview shows V2; explicit later publication changes public to V2 | PASS |
| Stale save | Two real editor tabs; stale save rejects, entered summary stays, comparison link remains available | PASS |
| Stale confirmation | Draft 3 confirmation rejects after another tab saves draft 4; reload then explicit draft 4 confirmation succeeds | PASS |
| Unsaved navigation | App dialog cancel retains input; explicit discard leaves; no native window.confirm workaround | PASS |
| Tabs and menu keyboard | End/Home/Arrow switches active tab and focus, preserves input; mobile menu Escape returns focus to menu trigger | PASS |
| Desktop/mobile fidelity and controls | Pinned baseline inspected; final 1440×1080 / 390×844 screenshots; action order preserved | PASS within approved S03 differences |
| Containers and clipping | Final-build measurements at widths 320/390/768/1024/1440: three actions within viewport; tabs/editor/publication containers fit; live badges static | PASS |
| Denied/error/empty | 390 px current-denied tenant B has no editor; missing service has retry/error; authorized existing empty fixture shows zero items and create action | PASS |
| Loading | Actual AX transition displays loading before service controls; no artificial delay or network interception | PASS observation; transient screenshot NOT_RUN |
| Public page/SEO | Actual V2 marker, no V1 marker, actual VI, exact localhost canonical, noindex; literal markup stays text | PASS browser; no-JS HTTP proof owned by coordinator |
| Console | Fresh final admin/public tabs: no captured errors or warnings | PASS bounded observation |

Detailed state and observations: [actual-flow.json](actual-flow.json). Exact final geometry: [container-geometry.json](container-geometry.json). Representative gate and its original artifacts remain coordinator-owned.

## Repair and evidence validity

Visual inspection found a real mobile selector defect: inherited `.editor-head .buttons` also fixed the nested status badges, hiding them beneath the action bar. The coordinator released a bounded repair. Exactly two mobile selectors were narrowed to `.editor-head > .editor-actions`; no optional style change was made. Final rebuilt 390 px evidence shows the live badge and, with temporary unsaved input, both live/pending badges above the editor. Temporary input was restored to the exact saved summary without another database save. Final 320/390/768/1024/1440 measurements were rerun on the repaired production build.

The viewport capability applies to the selected tab. Early wrong-tab/empty pre-hydration measurements were rejected and replaced with hydrated selected-tab measurements. Final `editor-final-*` and `public-service-*` artifacts were recaptured at their named dimensions. The original conflict/pending/reauth screenshots remain historical flow evidence, not claims about the repaired final CSS.

## Checks and limits

- `./node_modules/.bin/bun test apps/admin/lib apps/admin/components/rich-text.test.ts apps/admin/components/navigation.test.ts apps/admin/proxy.test.ts apps/website/lib apps/website/components/rich-text.test.ts apps/website/proxy.test.ts`: **25 PASS, 0 FAIL, 93 assertions**.
- Admin and website `typecheck`: **PASS**. Frontend ESLint with `--max-warnings 0`: **PASS**.
- After the two-selector repair: admin `typecheck`, admin ESLint and admin production build: **PASS**. Coordinator owns final combined builds/start/check:api, API/database/preservation/HTTP SSR and independent security review evidence.
- Final screenshots: [desktop editor](editor-final-1440.jpg), [mobile editor](editor-final-390.jpg), [two mobile badges](editor-badges-390.jpg), [desktop public page](public-service-1440.jpg), [mobile public page](public-service-390.jpg). Additional state screenshots are in this directory.

No remaining known source or UI blocker in the assigned scope. Production/DNS/TLS, later slices and human S03 acceptance remain outside this result. Loading screenshot capture was NOT_RUN because the observed transient completed before capture. Full screen-reader audit and every possible network/device condition were NOT_RUN; the evidence supports only the listed checks.

All worker app and evidence ownership releases to desktop `/root`. No further source or runtime mutation is planned by this worker.
