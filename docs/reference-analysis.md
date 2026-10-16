# Elite Dental functional reference

**Observation date:** 2026-10-15. Public pages were read without login or form submission. This is information-architecture/content analysis, not rendered desktop/mobile verification or a claim about Elite Dental's internal systems.

## Observed page families

| Source | Verified public structure | Proposed CMS mapping |
| --- | --- | --- |
| [Homepage](https://elitedental.com.vn/) | Specialty entry points, doctors, treatment stories/before-after media, educational articles, news/promotions and consultation forms | Configurable homepage sections referencing structured content |
| [Service example](https://elitedental.com.vn/trong-rang-implant) | Long-form service explanation, table of contents, cost/process information, FAQs and consultation calls to action | Service entity with reusable structured sections and related content |
| [Pricing](https://elitedental.com.vn/bang-gia) | Grouped services, amounts/ranges, VND, units/notes and consultation prompts | Price list entries with currency, unit, range/from/exact mode and applicability |
| [Doctor directory](https://elitedental.com.vn/doi-ngu-bac-si-elite-dental) and [profile example](https://elitedental.com.vn/doctors/tran-chau-bao-phuc) | Professional profiles, specialties, credentials, location references, reviewed articles and consultation prompts | Doctor linked to specialties, ordinary locations, article attribution and permission-controlled media; tenant administrator writes/publishes |
| [Treatment stories](https://elitedental.com.vn/cau-chuyen-khach-hang) | Stories grouped by treatment category with detail links | Cases, testimonial references, taxonomy and permission-controlled gallery |
| [Knowledge](https://elitedental.com.vn/kien-thuc-nha-khoa) | Educational article listing and pagination | Categorized localized article index and detail pages |
| [Promotion example](https://elitedental.com.vn/uu-dai-20-10-cung-elite-dental-nang-niu-nu-cuoi-doc-ban.html) | Campaign content, eligibility/validity information, service links and lead form | Promotion entity and configurable campaign page |
| [Contact](https://elitedental.com.vn/lien-he) | Several branch contacts, opening hours, contact form and communication preferences | Ordinary tenant-owned location rows displayed as list/cards/sections and one common tenant consultation list |
| [English site](https://elitedental.com.vn/en/) and [international information](https://elitedental.com.vn/en/dental-implant/dental-tourism) | Localized information and international-patient inquiry journey | Locale-aware content, language/contact preference and common tenant intake; no branch routing queue |

Mapping update under [GCMS-DOCS-001](tasks/GCMS-DOCS-001.md): the human-approved simple roles and Draft → Published workflow supersede the initial proposed clinical-review mapping. The verified observation column is preserved, including article attribution observed on the reference. Reference-site wording does not impose a clinical review stage, branch permissions or an internal workflow on godent-cms. Public pages were not refreshed or runtime-tested in this documentation task.

## Inferred journeys

These paths are inferred from the available links and calls to action, not measured visitor behavior.

1. Search/discover a service → learn about treatment and FAQs → inspect pricing → request consultation.
2. Review doctor qualifications or a treatment story → review related services → request consultation.
3. Find a suitable branch → review its contact/location information → contact clinic staff.
4. Read an educational article → navigate to a service/doctor → request advice.
5. Open a campaign page → review offer applicability → submit a consultation request.
6. Select a language → read localized information → provide supported communication preferences.

## Conversion mechanisms

Verified page content includes repeated consultation prompts, embedded short forms, service/pricing links, professional profiles, treatment-story links, branch contact details and communication preferences. These inform reusable CTA, form, doctor, location and related-content sections.

No conversion rates, search ranking outcomes, form receipt, internal lead assignment, consent process, real-time availability, editorial workflow or CMS vendor was verified. Labels referring to consultation or booking do not prove slot reservation. The proposed product acknowledges a request for staff follow-up, not a confirmed appointment.

## Reuse boundary

Store source URLs and structural observations only. Do not copy the brand, visual assets, proprietary copy, testimonials, patient names, clinical details or photographs. Examples must be synthetic or appropriately licensed. An external reference is not an approved visual template, and it does not authorize scraping, importing personal data or integrating its services.
