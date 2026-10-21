import { expect, test } from "bun:test";
import { M4_CONSENTS, type BuilderContent, type PublicM4Page } from "../../api/src/contracts/m4";
import { createHomePage, ids } from "../test-support/builder";
import { parsePublicBuilderResolution } from "./public-builder-validation";

function resolution() {
  const page: PublicM4Page = createHomePage("en", "signature");
  page.config!.content.signature = { navigation: [], headerLocation: null, footerLocations: [] };
  page.config!.signature = { navigation: [{ id: "care", label: "Dental care", type: "group", path: null, actualLocale: "en", fallback: false, children: [{ id: "services", label: "Services", type: "listing", path: "/clinic-a/en/dich-vu", actualLocale: "en", fallback: false, children: [] }] }], headerLocation: null, footerLocations: [] };
  const section = { id: "campaign", type: "hero_carousel" as const, hidden: false, autoplay: true, intervalMs: 7000 as const, slides: [{ id: "one", title: "Comfortable care", text: "A personal approach", image: null, action: null }] };
  const form = { sourceType: "home" as const, sourceId: ids.resource, sourcePublicationId: ids.publication, sourceConfigPublicationId: ids.config, formLocale: "en" as const, consent: M4_CONSENTS.en, promotionId: null, promotionPublicationId: null, serviceOptions: [], locationOptions: [] };
  const consultation = { id: "contact", type: "consultation" as const, hidden: false, title: "Talk to us", promotion: null, serviceOptions: [], locationOptions: [] };
  (page.content as BuilderContent).sections = [section, consultation];
  page.sections = [{ section, slides: [{ id: "one", title: "Comfortable care", text: "A personal approach", media: { assetId: ids.asset, revision: 1, alt: "Clinic", width: 1600, height: 900, profile: "cover", path: `/api/public/builder-media/${ids.tenant}/home/${ids.resource}/en/${ids.publication}/${ids.asset}/1/cover` }, action: { label: "Learn more", path: "/clinic-a/en/dich-vu", actualLocale: "en", fallback: false } }], action: null, references: [], media: null, promotion: null, form: null }, { section: consultation, action: null, references: [], media: null, promotion: null, form }];
  page.form = form;
  return { resolution: "page", requestedLocale: "en", actualLocale: "en", canonicalUrl: page.canonicalUrl, fallbackPublicationId: null, page };
}
test("signature projection accepts bounded navigation, current carousel gateway media and true home forms", () => {
  const parsed = parsePublicBuilderResolution(resolution(), "clinic-a", "en", "home", "home");
  expect(parsed.resolution).toBe("page");
  if (parsed.resolution === "page") { expect(parsed.page.config?.signature?.navigation[0].children[0].path).toBe("/clinic-a/en/dich-vu"); expect(parsed.page.sections[0].slides?.[0].media?.assetId).toBe(ids.asset); expect(parsed.page.form?.sourceType).toBe("home"); }
});
test("signature projection rejects cross-tenant navigation/actions and foreign publication media", () => {
  const nav = resolution(); nav.page.config!.signature!.navigation[0].children[0].path = "/other-clinic/en/dich-vu";
  expect(() => parsePublicBuilderResolution(nav, "clinic-a", "en", "home", "home")).toThrow();
  const action = resolution(); action.page.sections[0].slides![0].action!.path = "https://outside.example/";
  expect(() => parsePublicBuilderResolution(action, "clinic-a", "en", "home", "home")).toThrow();
  const media = resolution(); media.page.sections[0].slides![0].media!.path = media.page.sections[0].slides![0].media!.path.replace(ids.publication, ids.config);
  expect(() => parsePublicBuilderResolution(media, "clinic-a", "en", "home", "home")).toThrow();
});
test("published hero style and title phrase survive sanitization without trusting added slide text", () => {
  const value = resolution();
  value.page.config!.content.signature!.heroTypography = "rose_editorial";
  const section = value.page.content as BuilderContent;
  if (section.sections[0].type !== "hero_carousel") throw Error();
  section.sections[0].slides[0].highlight = "care";
  value.page.sections[0].section = section.sections[0];
  value.page.sections[0].slides![0].highlight = "care";
  const parsed = parsePublicBuilderResolution(value, "clinic-a", "en", "home", "home");
  expect(parsed.resolution === "page" && parsed.page.config?.content.signature?.heroTypography).toBe("rose_editorial");
  expect(parsed.resolution === "page" && parsed.page.sections[0].slides?.[0].highlight).toBe("care");
  const forged = resolution(); forged.page.sections[0].slides![0].highlight = "care";
  expect(() => parsePublicBuilderResolution(forged, "clinic-a", "en", "home", "home")).toThrow();
  const wrongTitle = resolution();
  (wrongTitle.page.content as BuilderContent).sections[0] = { ...section.sections[0], slides: [{ ...section.sections[0].slides[0], title: "Changed title" }] };
  wrongTitle.page.sections[0].section = (wrongTitle.page.content as BuilderContent).sections[0];
  expect(() => parsePublicBuilderResolution(wrongTitle, "clinic-a", "en", "home", "home")).toThrow();
});
