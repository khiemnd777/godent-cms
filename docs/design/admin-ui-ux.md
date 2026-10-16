# GCMS-UX-001 — Administration UI/UX v0.1+Lucide

## Current acceptance

**APPROVED_UI_UX — v0.1+Lucide.** Khiêm directly accepted the present design on 2026-10-15 (Asia/Ho_Chi_Minh): **“TAo duyệt bộ mockup UI UX này.”** Source: parent human conversation, thread `01a13e59-fa91-7cb1-a156-5361bb21ca58`, directly verified by the parent and supplied to this bounded writer. This final acceptance follows the original provisional creation approval and the separate “Sử dụng Lucide Icons” choice.

Acceptance covers four representative screens (platform tenant list; CMS overview; service editor; consultation list/detail), shared navigation, style, components, responsive behavior and states as delivered, including Lucide. It does not mean that every placeholder menu item has a completed screen or that full MVP UX is delivered.

Approved reference: [SHA256 baseline](admin-mockup/approved-baseline.json). Future authorized implementation slices should follow the pinned branding, layout, navigation and control behavior. The review toolbar, synthetic data, in-memory logic and prototype messages are review-only material to replace or remove during application implementation.

Product remains **NOT_IMPLEMENTED**; all application AC runtime proof remains **NOT_RUN**. S01 execution and application acceptance/implementation are unapproved. Future implementation owners remain unassigned. Account/recovery/MFA, initial theme/section catalog, D5 and domain policies are unchanged.

## Historical creation authority — 2026-10-15, before final acceptance

Khiêm: **“Tạm duyệt phạm vi để mày tạo mockup UI/UX cho tao xem thử”**. This authorizes a provisional design and static interactive mockup for review, not final design acceptance or application implementation. Desktop main is the sole designer, writer and coordinator. No additional agent ran.

Open the [review interface](admin-mockup/index.html). Its four tabs cover Platform Admin tenant list, Tenant CMS overview, service editor and consultation list/detail. All names, counts, messages and contact values are synthetic. Changes live only in memory; changing a review tab/state or reloading resets them. The external review toolbar is not a product component.

## Design contract

| Surface | Primary job / action | Design boundary |
| --- | --- | --- |
| Platform tenant list | Find a clinic and inspect platform metadata; preview basic creation fields | No tenant-private content, leads, impersonation or CMS-entry action. Provisioning/account policy remains open. |
| CMS overview | Identify pending content and new consultations; open service editor | No invented traffic/revenue analytics. Summary counts are illustrative fixtures. |
| Service editor | Write VI service, save draft, preview, explicitly update simulated website | Published content and pending draft remain distinct. Required-title/slug validation and conflict presentation; no Reviewed state. |
| Consultation list/detail | Find request, inspect details, assign responsibility and update status | One common tenant list, no location or assignee access partition. Closure/reopen reason presentation follows existing policy; not backend enforcement. |

Shared app/layout intent remains `/platform` and `/cms` in Next app5891, API5890, public app5892. This artifact uses query-based screen switching only; it does not implement these application routes, login, tenant context or any acceptance criterion AC-01–12. Same account/profile display does not confer privileges. Product rules remain in [access control](../access-control.md) and [workflows](../workflows.md).

## Information architecture

Platform: Nha khoa; Tài khoản quản trị; Tính năng & hạn mức; Nhật ký hoạt động; Cấu hình nền tảng.

Tenant: Tổng quan; Website (Trang/Giao diện/Menu); Nội dung nha khoa (Dịch vụ/Bác sĩ/Cơ sở/Bảng giá); Câu chuyện khách hàng (Ca điều trị/Trước & sau/Đánh giá); Bài viết & FAQ; Khuyến mãi & Landing; Thư viện hình ảnh; Yêu cầu tư vấn; Cài đặt website. Detailed settings will contain organization, language, domain and administrator management. Locations are ordinary content rows, never a tenancy selector.

Only the four scoped screens work. Other navigation items show an explicit “next design step” explanation. Recent content for an unmodeled content type does not open the wrong service editor. Account provisioning, MFA, full history/restore/unpublish, domains, theme/section builder, real media upload and other CRUD stay outside this mockup.

## Visual system — approved v0.1+Lucide reference

- Light warm-neutral canvas `#f6f8f6`, white surfaces, subtle borders `#e1e8e3`.
- Text `#203c35`, secondary text `#60746d`, primary action `#146b53`, pale sage context `#eaf4ee`.
- System font with Vietnamese support. Desktop title 29px; body14px; supporting table/control copy12px. Small supporting labels are a review choice, not a claimed accessibility pass.
- Sidebar232px (210px on narrower desktop); header74px; main padding36px. Component radii6/8/10px. Spacing follows a 4px base with deliberate typographic adjustments.
- Native controls, visible focus, skip link, native dialog, named icon buttons, labeled fields, keyboard tabs, inert off-canvas navigation, reduced-motion handling. Status always includes text.
- Original geometric Godent wordmark treatment; all interface icons use Lucide SVG, per Khiêm’s direct request “Sử dụng Lucide Icons”. No external font, stock photo, CDN or patient image. Branding and status dots remain separate from interface icons.

Pattern references, accessed2026-10-15: [Payload admin overview](https://payloadcms.com/docs/admin/overview) for content-oriented navigation/list/detail patterns; [WordPress editor overview](https://wordpress.org/documentation/article/wordpress-block-editor/) for separating editing space from settings and explicit publication actions. These are conceptual references, not approved templates, dependencies, source copies or evidence of this mockup's usability. Elite Dental remains a functional/content reference only.

## Responsive and states

Below1024px, sidebar becomes a drawer with open/close/Escape/focus handling. Below768px, panels stack; tenant rows become cards; lead detail replaces the list with an explicit back action. Mobile editor save/preview/publish actions stay in a bottom bar with content padding. Desktop retains side-by-side lead detail and editor publication settings. No branch selector or extra CMS service.

The review toolbar selects normal/loading/empty/error/denied states for all four screens. Conflict mode is editor-only. Loading/error/permission presentations are simulations, not network or security proof. Preview/save/publish are local UI demonstrations. The simulated saved draft does not alter the simulated published object; explicit confirmation updates it. No actual public URL, domain, email, patient record or appointment is affected.

## Historical review criteria — 2026-10-15, before final acceptance

1. Four representative screens are inspectable and share reusable visual patterns.
2. Main actions can be tried with synthetic data; unsupported navigation explains its limitation.
3. Desktop/mobile and meaningful loading/empty/error/permission/conflict states are available.
4. Save versus publish remains understandable; locations and roles stay simple.
5. Deliver source, screenshots and actual scoped verification results; human design approval remains pending.

[Task evidence](../tasks/GCMS-UX-001.md) records observed effort, actual checks and limitations. No application, dependencies, Docker, DB, DNS, global settings, deployment or Git delivery is authorized. At that stage the mockup was not an approved implementation reference; final acceptance above now pins v0.1+Lucide without authorizing application work.

## Confirmed icon selection — Lucide follow-up

Khiêm’s direct “Sử dụng Lucide Icons” authorizes replacing the mockup interface icons with Lucide and establishes the icon family for Platform Admin/Tenant CMS design. At that stage this was an icon choice, not complete design acceptance. The later final acceptance above covers v0.1+Lucide; application implementation remains unapproved.

Mockup uses31 unmodified SVG node definitions from the preinstalled official lucide1.8.0 package, rendered locally with currentColor, 24px viewBox, round caps/joins and stroke2. No package/CDN/framework was added. Source data is kept in mockup.js; full ISC/Feather-derived MIT notices are preserved in [LUCIDE-LICENSE.txt](admin-mockup/LUCIDE-LICENSE.txt). Package version is a verified local source pin, not a claim about the latest release.

Menu and pagination chevrons, editor Heading2/List, controls and decorative glyphs use Lucide. The previous custom tooth symbol becomes the official Smile icon; no nonexistent Tooth export is invented. Labels and focus handling remain intact. Future application packaging is outside scope. [Focused review](admin-mockup/lucide-review-results.json) records12 icon/layout/interaction checks and current screenshots. Original60 mockup checks remain historical evidence, not a rerun after this update.

Desktop main remains the accountable coordinator and shared-document owner. Next recommended action: a detailed bounded S01 implementation plan for human review, not S01 execution or writing that plan in this pass. The sole bounded documentation writer ends after this pass; desktop independently inspects integration afterward, with no implied additional design approval gate. No currently active child-agent team or independent reviewer.
