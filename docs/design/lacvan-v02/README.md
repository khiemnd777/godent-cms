# Lạc Vân — template proposal v0.2

## Scope and authority

Khiêm directly requested: “Dựa vào kế hoạch chi tiết trên, sử dụng @UI UX Designer để đề xuất bản template hoàn chỉnh, sau đó cho tao xem HTML để review.”

This authorizes this standalone HTML design artifact, its original/local assets, a loopback-only static preview and rendered verification. It does not apply the proposal to the running website or CMS. No application, database, credentials, migration, Git or existing customer data changes are part of this artifact.

Owner: desktop `/root`, current GCMS-LACVAN-001 chat. UI UX Designer skills applied: ui-ux-designer, website-ui-design, high-fidelity-mockups and design-to-code. Actual task is standalone visual prototyping, not application implementation; runtime-recorded xhigh was checked using the documented unclassified fallback.

## Design contract

- Keep the approved Elite Dental reference's page hierarchy, specialty-first navigation, rich page composition and responsive interaction patterns.
- Use original Lạc Vân identity: a cloud/ribbon emblem, refined wordmark, orchid/pink/plum palette, Vietnamese-capable typography.
- Use the existing 24 original AI-generated fictional people/spaces, copied without editing their source files. No Elite branding, photographs, credentials, awards or copy is imported.
- Cover home, services/detail, doctors/detail, pricing, about, stories/detail, gallery, knowledge/news/category/article, promotions/detail, contact/locations/detail, search, FAQ and ancillary pages, plus identity/state review views.
- VI and EN are local design variants. The interface contains authored presentation data; it is not connected to the CMS or a live inquiry endpoint.
- Navigation, carousel, menus, accordions, filters, pagination, gallery, language switching and form presentation work locally. Forms explicitly disclose that nothing was sent; they perform no fetch, storage or external contact.
- Template review must not be reported as CMS integration, visual 10/10 acceptance or completion of GCMS-LACVAN-001 v0.2.

## Opening

Open `index.html` together with its `assets/` folder, or serve only this folder using a new available loopback port. No package installation or existing-service restart is required.

## Fonts and assets

Be Vietnam Pro and DM Serif Display are bundled from official Google Fonts sources; OFL license texts accompany the fonts. Local PNG photographs retain their source bytes. `logo.svg` and `mark.svg` are original vector design assets, not uploads to the existing CMS.

## Verification

Rendered on 2026-10-17 in the in-app browser:

- 31 review destinations at 1440×900: one main H1 and no document overflow, PASS (`desktop-checks.json`).
- 31 review destinations at 390×844: heading/document/control geometry, PASS (`mobile-checks.json`).
- 31 English destinations: English locale/headings and document width, PASS (`english-checks.json`). This is not a human editorial certification of all English copy.
- Six representative destinations at 320×844, 390×844 and 768×1024: 18 additional geometry checks, PASS (`responsive-checks.json`).
- Actual menu open/Escape, doctor filter 8→2, article category filter→3, article pagination 6→6→1 with no first/second-page overlap, search `Implant`→3 results, gallery keyboard next 1→2/Escape, pricing accordion and local-only form feedback observed.
- Same-page presentation/language changes preserve form entry in the DOM. No persistent storage or form network endpoint exists.
- Current inline JavaScript passes `node --check`. Original image copy hashes match 24/24. Font signatures and SVG XML checked (`artifact-checks.json`).
- Representative screenshots are in `review/`, including home desktop/mobile, identity, Implant, doctors and pricing.

Corrections during verification: two duplicate main headings were fixed; category-filter routing was corrected; mobile review controls were moved clear of form inputs; touch targets/readability were refined. A screenshot initially captured during smooth scrolling was replaced after locating the actual process heading. One search test used an ambiguous unscoped selector; the same visible dialog was then tested with its own form selector. These were not application/CMS regressions.

Font downloads initially failed under restricted DNS. The same official public files were downloaded with approved network access, without changing global settings. The first loopback bind was denied by the sandbox; the same artifact-only server was then started with approved access. No existing service was stopped or restarted.

Preview at handoff: `http://127.0.0.1:52837/` (loopback-only, current process; availability is time-specific). Review controls expose all page families and the identity board.

Limits: this is a static design proposal. It does not prove CMS editing/publication, clinical accuracy, actual enquiries, exhaustive assistive-technology coverage, pixel equality or a 10/10 human acceptance score. No application, database, migration, credentials, existing tenant or Git change was performed for this artifact.
