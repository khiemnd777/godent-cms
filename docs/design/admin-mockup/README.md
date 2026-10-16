# Godent administration mockup v0.1+Lucide

Review-only HTML/CSS/JavaScript, no build or installation.

**APPROVED_UI_UX — v0.1+Lucide.** Khiêm directly accepted the present design on 2026-10-15 (Asia/Ho_Chi_Minh): **“TAo duyệt bộ mockup UI UX này.”** Source: parent human conversation, thread `01a13e59-fa91-7cb1-a156-5361bb21ca58`, directly verified by the parent and supplied to this bounded writer. This final acceptance follows the original provisional creation approval and the separate “Sử dụng Lucide Icons” choice.

Acceptance covers four representative screens (platform tenant list; CMS overview; service editor; consultation list/detail), shared navigation, style, components, responsive behavior and states as delivered, including Lucide. It does not mean that every placeholder menu item has a completed screen or that full MVP UX is delivered.

[Approved SHA256 baseline](approved-baseline.json) pins four sources, the Lucide license and eight current screenshots. Future authorized implementation slices should follow the pinned branding, layout, navigation and control behavior. The review toolbar, synthetic data, in-memory logic and prototype messages are review-only material to replace or remove during application implementation.

Product remains **NOT_IMPLEMENTED**; all application AC runtime proof remains **NOT_RUN**. S01 execution and application acceptance/implementation are unapproved. Future implementation owners remain unassigned. Account/recovery/MFA, initial theme/section catalog, D5 and domain policies are unchanged. [Design contract](../admin-ui-ux.md) and [task/evidence](../../tasks/GCMS-UX-001.md).

Previously delivered temporary preview: **http://127.0.0.1:63421/**. This process serves exactly index.html, mockup.html, mockup.css and mockup.js on loopback. It exposes no directory listing, arbitrary repository path, API, write endpoint or external integration. The address is temporary; availability after the session is not guaranteed. The mockup has no dependency on this port or serving tool.

Open [index.html](index.html) for the review toolbar; relative assets are bundled alongside it. Direct local-file behavior was not tested in the original design session; no new browser testing or preview/process operation occurs in this bookkeeping pass. The Codex in-app browser rejects file URLs, so the original review session used the scoped read-only HTTP preview. Do not weaken browser URL policy. No application startup command or port5890–5892 is introduced here.

## Try it

1. Use the four review tabs to compare Platform, CMS overview, service editor and consultation list/detail.
2. Use the viewport selector for a narrow frame, or resize the browser to test real breakpoints.
3. Search a clinic by name/slug; filter its status. Basic creation is a visual form only, with no actual account/provisioning step.
4. Edit a service; save draft; compare “Xem trước” with “Xem website”; explicitly confirm “Cập nhật website”. Only in-memory mock data changes.
5. Open a sample consultation, choose assignee/status, and try closure/reopen without the required reason. On mobile, use “Danh sách yêu cầu” to return.
6. Select loading, empty, error, denied or editor-conflict states in the review toolbar.

Reloading or switching toolbar tabs/state resets the sample data. No persistence, backend, email, analytics, login, authorization, real SEO, real publication, concurrent server edits or tenant isolation is implemented. Clinical text is placeholder layout copy, not reviewed advice. Unmodeled navigation explains the limitation instead of pretending to complete a flow.

## Evidence gallery

The four primary screen pairs below show the current Lucide update. Auxiliary detail/menu/state/conflict/320px captures retain the initial design evidence and predate the icon replacement.

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Platform tenant list | [1440px](screenshots/lucide/01-platform-desktop.jpg) | [390px](screenshots/lucide/01-platform-mobile.jpg) |
| Tenant overview | [1440px](screenshots/lucide/02-cms-desktop.jpg) | [390px](screenshots/lucide/02-cms-mobile.jpg) |
| Service editor | [1440px](screenshots/lucide/03-editor-desktop.jpg) | [390px](screenshots/lucide/03-editor-mobile.jpg) |
| Consultation list/detail | [1440px](screenshots/lucide/04-leads-desktop.jpg) | [390px list](screenshots/lucide/04-leads-mobile.jpg), [detail](screenshots/04-lead-detail-mobile.jpg) |

[Mobile navigation](screenshots/05-mobile-navigation.jpg); [loading](screenshots/06-state-loading-mobile.jpg); [empty](screenshots/06-state-empty-mobile.jpg); [error](screenshots/06-state-error-mobile.jpg); [denied](screenshots/06-state-denied-mobile.jpg); [conflict](screenshots/07-editor-conflict-mobile.jpg). Screenshots are actual in-app browser captures of this mockup, not product runtime evidence.

Narrow editor action containment was also verified at320px: [screenshot](screenshots/08-editor-320.jpg). [Structured review results](review-results.json) record 60 scoped checks. These are prototype observations, not production acceptance.

## Lucide update

All interface SVG icons now use31 exact Lucide1.8.0 definitions from the existing bundled package. No dependency installation or CDN. [Full license](LUCIDE-LICENSE.txt) and [12 focused checks](lucide-review-results.json) are included. The original60-check report predates this icon update; it was not rerun as a full suite.

Desktop main remains the accountable coordinator and shared-document owner. Next recommended action: a detailed bounded S01 implementation plan for human review, not S01 execution or writing that plan in this pass. The sole bounded documentation writer ends after this pass; desktop independently inspects integration afterward, with no implied additional design approval gate. No currently active child-agent team or independent reviewer.
