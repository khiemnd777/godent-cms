import { afterEach, expect, spyOn, test } from "bun:test";
import { parsePublicBuilderResolution, readPublicBuilderPage } from "./public-builder";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const document = { type: "doc", version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text: "Published introduction" }] }] };
const id = "a1111111-1111-4111-8111-111111111111";
const configId = "b1111111-1111-4111-8111-111111111111";
export function homepageResolution() {
  const content = { kind: "home", slug: "home", title: "Clinic homepage", summary: "Published summary", seo: { title: "", description: "" }, sections: [
    { id: "hero", type: "hero", hidden: false, title: "Care with clear information", text: "An introduction from the clinic.", image: null, action: null },
    { id: "intro", type: "rich_text", hidden: false, body: document },
  ] };
  const presentation = { name: "Clinic A", logo: null, theme: "clarity", themeVersion: 1, palette: "teal", font: "system", layout: "comfortable", footer: { intro: "Published footer", body: document }, menu: [] };
  return { resolution: "page", requestedLocale: "vi", actualLocale: "vi", canonicalUrl: "http://localhost:5892/clinic-a", fallbackPublicationId: null, page: {
    schemaVersion: 4, id, kind: "home", locale: "vi", requestedLocale: "vi", actualLocale: "vi", publicationId: id, publicationVersion: 1, publishedAt: "2026-10-16T00:00:00.000Z", canonicalUrl: "http://localhost:5892/clinic-a", configPublicationId: configId,
    config: { publicationId: configId, publicationVersion: 1, locale: "vi", content: presentation, menu: [], logoMedia: null }, site: { name: presentation.name, footer: presentation.footer }, content, references: [], media: [], sections: content.sections.map(section => ({ section: structuredClone(section), references: [], media: null, promotion: null, form: null, action: null })), form: null, promotionState: null, alternates: [{ locale: "vi", url: "http://localhost:5892/clinic-a", publicationId: id }], legacy: false,
  } };
}

test("homepage consumer validates identity, presentation and sections before returning public data", () => {
  const result = parsePublicBuilderResolution(homepageResolution(), "clinic-a", "vi", "home", "home");
  expect(result.resolution).toBe("page");
  if (result.resolution === "page") { expect(result.page.sections).toHaveLength(2); expect(result.page.config?.content.theme).toBe("clarity"); }
});
test("homepage rejects forged hosts, a different locale, changed config identity and unpinned section data", () => {
  for (const mutate of [
    (value: ReturnType<typeof homepageResolution>) => { value.page.canonicalUrl = "https://forged.invalid/clinic-a"; },
    (value: ReturnType<typeof homepageResolution>) => { value.page.actualLocale = "en"; },
    (value: ReturnType<typeof homepageResolution>) => { value.page.configPublicationId = id; },
    (value: ReturnType<typeof homepageResolution>) => { value.page.sections[0].section.title = "Injected section"; },
  ]) { const value = homepageResolution(); mutate(value); expect(() => parsePublicBuilderResolution(value, "clinic-a", "vi", "home", "home")).toThrow(); }
});
test("homepage read uses only fixed anonymous API transport and validates the response", async () => {
  let destination = "", init: RequestInit | undefined;
  spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (...[url, options]: Parameters<typeof fetch>) => { destination = String(url); init = options; return Response.json(homepageResolution()); }, { preconnect: originalFetch.preconnect }));
  expect((await readPublicBuilderPage("clinic-a", "vi", "home", "home"))?.resolution).toBe("page");
  expect(destination).toBe("http://127.0.0.1:5890/api/public/builder/clinic-a/vi/home/home");
  expect(init?.credentials).toBe("omit"); expect(init?.cache).toBe("no-store"); expect(init?.redirect).toBe("error"); expect(init?.signal).toBeInstanceOf(AbortSignal);
  expect([...new Headers(init?.headers).keys()]).toEqual(["accept"]);
});
test("missing homepage is distinct from invalid input and backend failure", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
  expect(await readPublicBuilderPage("clinic-a", "vi", "home", "home")).toBeNull();
  fetcher.mockClear(); expect(await readPublicBuilderPage("../clinic-b", "vi", "home", "home")).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValue(new Response(null, { status: 503 })); await expect(readPublicBuilderPage("clinic-a", "vi", "home", "home")).rejects.toThrow("temporarily unavailable");
});
