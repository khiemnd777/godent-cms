import { expect, test } from "bun:test";
import { parsePublicBuilderResolution, parsePublicBuilderSeo } from "./public-builder-validation";
import { M4_CONSENTS } from "../../api/src/contracts/m4";

const id = "a1111111-1111-4111-8111-111111111111", publicationId = "b1111111-1111-4111-8111-111111111111", assetId = "c1111111-1111-4111-8111-111111111111", tenantId = "d1111111-1111-4111-8111-111111111111";
const doc = { type: "doc", version: 1, blocks: [] };
function doctorResolution(locale: "vi" | "en" = "en") {
  const canonicalUrl = `http://localhost:5892/clinic-a${locale === "en" ? "/en" : ""}/bac-si/doctor-a`;
  const image = { assetId, revision: 1, alt: "Doctor portrait" };
  const content = { kind: "doctor", slug: "doctor-a", title: "Doctor A", summary: "Profile", body: doc, seo: { title: "", description: "" }, references: [], professionalTitle: "Dentist", credentials: [], languages: ["English"], image };
  return { resolution: "page", requestedLocale: locale, actualLocale: locale, canonicalUrl, fallbackPublicationId: null, page: {
    schemaVersion: 4, id, kind: "doctor", locale, requestedLocale: locale, actualLocale: locale, publicationId, publicationVersion: 1, publishedAt: "2026-10-16T00:00:00.000Z", canonicalUrl, configPublicationId: null, config: null, site: { name: "Clinic A", footer: { intro: "", body: doc } }, content, references: [], media: [{ slot: "image", media: { ...image, profile: "cover", width: 800, height: 600, path: `/api/public/builder-media/${tenantId}/doctor/${id}/${locale}/${publicationId}/${assetId}/1/cover` } }], sections: [], form: null, promotionState: null, alternates: [{ locale, url: canonicalUrl, publicationId }], legacy: false,
  } };
}
test("same-locale content uses an exact resource/publication/asset gateway and never accepts another scope", () => {
  const parsed = parsePublicBuilderResolution(doctorResolution(), "clinic-a", "en", "doctor", "doctor-a");
  expect(parsed.resolution).toBe("page");
  for (const part of ["/doctor/", `/${id}/`, "/en/", `/${publicationId}/`, `/${assetId}/`, "/1/cover"]) {
    const value = doctorResolution(); value.page.media[0].media.path = value.page.media[0].media.path.replace(part, part === "/1/cover" ? "/2/cover" : part === "/en/" ? "/vi/" : "/forged/");
    expect(() => parsePublicBuilderResolution(value, "clinic-a", "en", "doctor", "doctor-a")).toThrow();
  }
});
test("a retained media projection cannot substitute alt text or an external byte URL", () => {
  const value = doctorResolution(); value.page.media[0].media.alt = "Unpinned alt";
  expect(() => parsePublicBuilderResolution(value, "clinic-a", "en", "doctor", "doctor-a")).toThrow();
  value.page.media[0].media.alt = "Doctor portrait"; value.page.media[0].media.path = "https://remote.invalid/photo.webp";
  expect(() => parsePublicBuilderResolution(value, "clinic-a", "en", "doctor", "doctor-a")).toThrow();
});
test("withdrawn standard images and all gallery pairs can be removed without exposing alt or captions", () => {
  const value = doctorResolution();
  const withoutImage = { ...value, page: { ...value.page, content: { ...value.page.content, image: null }, media: [] } };
  const parsed = parsePublicBuilderResolution(withoutImage, "clinic-a", "en", "doctor", "doctor-a");
  expect(JSON.stringify(parsed)).not.toContain("Doctor portrait");
  expect(() => parsePublicBuilderResolution({ ...value, page: { ...value.page, media: [] } }, "clinic-a", "en", "doctor", "doctor-a")).toThrow("Incomplete media");
  const url = "http://localhost:5892/clinic-a/en/truoc-sau/gallery-a";
  const gallery = { ...value, canonicalUrl: url, page: { ...value.page, kind: "gallery", canonicalUrl: url, media: [], content: { kind: "gallery", slug: "gallery-a", title: "Gallery", summary: "", body: doc, seo: { title: "", description: "" }, references: [], pairs: [] }, alternates: [{ locale: "en", url, publicationId }] } };
  expect(parsePublicBuilderResolution(gallery, "clinic-a", "en", "gallery", "gallery-a").resolution).toBe("page");
});
test("published menus preserve pinned labels and same-tenant route families with explicit VI fallback", () => {
  const value = doctorResolution();
  const item = { id: "doctor", label: "Our doctor", target: { kind: "doctor", id, locale: "en" }, allowViFallback: true };
  const presentation = { name: "Clinic A", logo: null, theme: "clarity", themeVersion: 1, palette: "teal", font: "system", layout: "comfortable", footer: value.page.site.footer, menu: [item] };
  const resolved = { ...item, actualLocale: "vi", fallback: true, path: "/clinic-a/bac-si/doctor-a" };
  const configured = { ...value, page: { ...value.page, configPublicationId: assetId, config: { publicationId: assetId, publicationVersion: 1, locale: "en", content: presentation, menu: [resolved], logoMedia: null } } };
  const parsed = parsePublicBuilderResolution(configured, "clinic-a", "en", "doctor", "doctor-a");
  expect(parsed.resolution === "page" && parsed.page.config?.menu[0].fallback).toBe(true);
  for (const altered of [{ ...resolved, path: "/clinic-b/bac-si/doctor-a" }, { ...resolved, path: "/clinic-a/en/bac-si/doctor-a" }, { ...resolved, label: "Unpublished label" }, { ...resolved, path: "/clinic-a/preview/doctor-a" }]) expect(() => parsePublicBuilderResolution({ ...configured, page: { ...configured.page, config: { ...configured.page.config, menu: [altered] } } }, "clinic-a", "en", "doctor", "doctor-a")).toThrow();
});
test("a landing form has its own source and exact displayed-locale consent without an invented service", () => {
  const value = doctorResolution(), url = "http://localhost:5892/clinic-a/en/landing/consultation";
  const section = { id: "form", type: "consultation", hidden: false, title: "Contact us", promotion: null, serviceOptions: [], locationOptions: [] };
  const form = { sourceType: "landing", sourceId: id, sourcePublicationId: publicationId, sourceConfigPublicationId: null, formLocale: "en", consent: M4_CONSENTS.en, promotionId: null, promotionPublicationId: null, serviceOptions: [], locationOptions: [] };
  const landing = { ...value, canonicalUrl: url, page: { ...value.page, kind: "landing", canonicalUrl: url, media: [], content: { kind: "landing", slug: "consultation", title: "Consultation", summary: "", seo: { title: "", description: "" }, sections: [section] }, sections: [{ section, media: null, action: null, promotion: null, references: [], form }], form, alternates: [{ locale: "en", url, publicationId }] } };
  const parsed = parsePublicBuilderResolution(landing, "clinic-a", "en", "landing", "consultation");
  expect(parsed.resolution === "page" && parsed.page.form?.sourceType).toBe("landing");
  expect(parsed.resolution === "page" && parsed.page.form?.serviceOptions).toEqual([]);
  for (const altered of [{ ...form, sourceType: "service" }, { ...form, sourcePublicationId: assetId }, { ...form, formLocale: "vi" }, { ...form, consent: M4_CONSENTS.vi }]) expect(() => parsePublicBuilderResolution({ ...landing, page: { ...landing.page, form: altered, sections: [{ ...landing.page.sections[0], form: altered }] } }, "clinic-a", "en", "landing", "consultation")).toThrow();
});
test("promotion sections accept the canonical bounded block and reject another publication or locale", () => {
  const value = doctorResolution(), url = "http://localhost:5892/clinic-a/en";
  const content = { kind: "promotion", slug: "campaign-a", title: "Campaign A", summary: "Conditions apply", body: doc, seo: { title: "", description: "" }, startAt: "2026-10-01T00:00:00.000Z", endAt: "2026-11-01T00:00:00.000Z", authoredTimezone: "Asia/Ho_Chi_Minh", conditions: "Selected services only", references: [] };
  const block = { id: assetId, kind: "promotion", locale: "en", publicationId: tenantId, publicationVersion: 1, publishedAt: value.page.publishedAt, canonicalUrl: "http://localhost:5892/clinic-a/en/khuyen-mai/campaign-a", content, references: [], media: [], promotionState: "active" };
  const section = { id: "campaign", type: "promotion", hidden: false, title: "Campaign", reference: { kind: "promotion", id: assetId, publicationId: tenantId }, required: true };
  const reference = { id: assetId, kind: "promotion", locale: "en", publicationId: tenantId, publicationVersion: 1, title: content.title, slug: content.slug, path: "/clinic-a/en/khuyen-mai/campaign-a", content, references: [], media: [] };
  const home = { ...value, canonicalUrl: url, page: { ...value.page, kind: "home", canonicalUrl: url, content: { kind: "home", slug: "home", title: "Home", summary: "", seo: { title: "", description: "" }, sections: [section] }, references: [reference], media: [], sections: [{ section, media: null, action: null, promotion: block, references: [], form: null }], alternates: [{ locale: "en", url, publicationId }] } };
  expect(parsePublicBuilderResolution(home, "clinic-a", "en", "home", "home").resolution).toBe("page");
  for (const altered of [{ ...block, locale: "vi" }, { ...block, publicationId }, { ...block, site: value.page.site }]) expect(() => parsePublicBuilderResolution({ ...home, page: { ...home.page, sections: [{ ...home.page.sections[0], promotion: altered }] } }, "clinic-a", "en", "home", "home")).toThrow();
});
test("whole-page EN fallback accepts only the same VI route and eligible publication identity", () => {
  const fallback = { resolution: "fallback", requestedLocale: "en", actualLocale: "vi", canonicalUrl: "http://localhost:5892/clinic-a/bac-si/doctor-a", fallbackPublicationId: publicationId, page: null };
  expect(parsePublicBuilderResolution(fallback, "clinic-a", "en", "doctor", "doctor-a").resolution).toBe("fallback");
  for (const value of [{ ...fallback, canonicalUrl: "http://localhost:5892/clinic-b/bac-si/doctor-a" }, { ...fallback, actualLocale: "en" }, { ...fallback, fallbackPublicationId: null }, { ...fallback, page: doctorResolution().page }]) expect(() => parsePublicBuilderResolution(value, "clinic-a", "en", "doctor", "doctor-a")).toThrow();
  expect(() => parsePublicBuilderResolution(fallback, "clinic-a", "vi", "doctor", "doctor-a")).toThrow();
});
test("an EN reference cannot contain VI text through a different locale or unpinned publication", () => {
  const value = doctorResolution();
  const reference = { id: assetId, kind: "service", publicationId: assetId, publicationVersion: 1, locale: "vi", title: "Service A", slug: "service-a", path: "/clinic-a/dich-vu/service-a", content: { title: "Service A", slug: "service-a", summary: "", body: doc, seo: { title: "", description: "" } }, references: [], media: [] };
  const injected = { ...value, page: { ...value.page, content: { ...value.page.content, references: [{ kind: "service", id: assetId, publicationId: assetId }] }, references: [reference] } };
  expect(() => parsePublicBuilderResolution(injected, "clinic-a", "en", "doctor", "doctor-a")).toThrow();
  const unpinned = { ...injected, page: { ...injected.page, references: [{ ...reference, locale: "en", path: "/clinic-a/en/dich-vu/service-a", publicationId }] } };
  expect(() => parsePublicBuilderResolution(unpinned, "clinic-a", "en", "doctor", "doctor-a")).toThrow();
});
test("SEO entries exclude another tenant, unsafe route parameters and forged primary origins", () => {
  const entry = { kind: "doctor", id, locale: "en", path: "/clinic-a/en/bac-si/doctor-a", canonicalUrl: "http://localhost:5892/clinic-a/en/bac-si/doctor-a", publicationId, configPublicationId: null, alternates: [{ locale: "en", url: "http://localhost:5892/clinic-a/en/bac-si/doctor-a", publicationId }] };
  expect(parsePublicBuilderSeo([entry], "clinic-a")).toHaveLength(1);
  for (const altered of [{ ...entry, path: "/clinic-b/en/bac-si/doctor-a" }, { ...entry, path: entry.path + "?utm_source=ad" }, { ...entry, canonicalUrl: "https://forged.invalid/clinic-a/en/bac-si/doctor-a" }]) expect(() => parsePublicBuilderSeo([altered], "clinic-a")).toThrow();
});
