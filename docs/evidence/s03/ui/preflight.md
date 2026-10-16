# S03 UI preflight evidence

Supporting evidence for [GCMS-S03-001](../../../tasks/GCMS-S03-001.md). The task record remains authoritative. Owner: `/root/s03_ui`; source ownership is `apps/admin/**`, `apps/website/**` and this evidence directory. No shared record, API, migration, root dependency or configuration file is owned by this worker.

## Verified prerequisites

- Current S03 v0.1 / D01–D06 plan read after coordinator `PLAN_SAVED` release. Parent supplied direct human approval and S02 acceptance. No later stop was received.
- Native metadata check: `implementation`, `publication-integrity`, `implementer`; recorded role `kit-implementer`, model `gpt-6.1-sol`, effort `xhigh`, child `01a141fb-c0fa-7372-ac6c-512352ccf839`, parent `01a1402c-3c81-7933-9927-d974f70c9fbc`: PASS. This proves recorded configuration only. Parent owns independent verification.
- Selected/read skills: repository `frontend-ui-engineering`, `incremental-implementation`, `test-driven-development`, `technote`, plus template-application reference/checklist and canonical TechNote. Their use does not expand authority.
- Canonical contract: `apps/api/src/contracts/s03.ts`, API owner `/root/s03_api_data`. Additive exact active publication references `publishedDraftVersion` and `publishedSiteVersion` prevent confusing draft revision with publication version.
- Fresh worker-owned CUA in-app browser tab opened the existing local admin login and focused its email field successfully. No native confirmation was triggered. Current computer-use confirmation policy was read. New credential changes remain human handoff; access grants remain action-time confirmation. No secret is retained here.
- Template: `docs/design/admin-mockup/approved-baseline.json`, revision `v0.1+Lucide`; all 13 SHA-256 pins match. Desktop `screenshots/lucide/03-editor-desktop.jpg` and mobile `screenshots/lucide/03-editor-mobile.jpg` were visually inspected.

## Representative screen contract

| Baseline element | Target and observable criterion |
| --- | --- |
| Tenant header and CMS navigation | Existing authorized admin shell; explicit tenant remains in URL and current membership remains authoritative. |
| Service heading and two status badges | Editor heading; actual live status and pending draft derived from exact revision references. |
| Save → Preview → Update website | Editor header on desktop and fixed bottom action bar on mobile; real HTTP consumers, dirty/busy/conflict states. |
| Content / SEO & path tabs | Main editor panel; keyboard Arrow/Home/End retains form input and moves tab focus. |
| Title, summary, detail toolbar/body | Main content tab; bounded safe document adapter, H2/list/text/link controls. |
| Publication status panel | Right column on desktop, below content on mobile; live publication and saved draft revisions remain distinct. |
| Private preview identity | Saved service/site revisions plus current tenant; current authorization on every request. |
| Publish confirmation | Explicit tenant, service, actual VI, saved revision/current live revision/site revision; fresh backend reauthentication when required. |

Approved removals: prototype review toolbar, in-memory fake success/data/counts, image panel (S07), history/restore/unpublish button (S08), and prototype-only explanatory messages. Initial public layout remains content-first with site name, title, summary, rich text and bounded footer; no fake lead form/navigation/assets.

Desktop comparison uses 1440×1080, matching the pinned screenshot dimensions and parent assignment. Mobile comparison uses 390×844 viewport; the pinned mobile reference is a full-page image. Additional container checks use widths 320/768/1024. The task record's initial 1440×1050 row differs from the actual pinned desktop image; coordinator was notified.

## Historical preflight limits — superseded

At the initial preflight, representative real-data render, save/reload/preview/publish sequence, matched screenshot comparison, keyboard/container/state proof and public SSR were NOT_RUN. The coordinator was repairing an API site-save prerequisite. These historical limits are superseded by [the UI handoff](handoff.md), [actual browser flow](actual-flow.json), [final container measurements](container-geometry.json) and coordinator-owned representative evidence. Human S03 acceptance remains separate.
