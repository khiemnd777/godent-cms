import { afterEach, expect, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as builderRoute from "./builder-route";
import * as publicContent from "../lib/public-content";
import { ContentListing, listingMetadata, type ContentListProps } from "./content-route";
import { emptyContent } from "../../admin/lib/content-input";
import { createHomePage, ids } from "../test-support/builder";
import type { M4PublicList, M4PublicListItem } from "../../api/src/contracts/m4";

const restores: (() => void)[] = [];
function remember<T extends { mockRestore(): void }>(spy: T): T { restores.push(() => spy.mockRestore()); return spy; }
afterEach(() => { for (const restore of restores.splice(0).reverse()) restore(); });
const canonical = "http://localhost:5892/clinic-a/bac-si";
function props(search: publicContent.PublicSearchParams): ContentListProps { return { params: Promise.resolve({ tenant: "clinic-a", section: "bac-si" }), searchParams: Promise.resolve(search) }; }
function page(size = 6): M4PublicList {
  const content = emptyContent("doctor"), items: M4PublicListItem[] = Array.from({ length: Math.min(size, 8) }, (_, index) => ({ id: `doctor-${index}`, kind: "doctor", locale: "vi", publicationId: `publication-${index}`, publicationVersion: 1, title: `Bác sĩ ${index + 1}`, slug: `doctor-${index}`, path: `/clinic-a/bac-si/doctor-${index}`, content: { ...content, title: `Bác sĩ ${index + 1}` }, references: [], media: [], legacy: false, promotionState: null }));
  return { schemaVersion: 4, kind: "doctor", locale: "vi", config: createHomePage("vi", "signature").config, canonicalUrl: canonical, items, nextCursor: size < 8 ? "opaque-next" : null };
}
function builderListing() {
  remember(spyOn(builderRoute, "listingAlternates").mockResolvedValue([{ locale: "vi", url: canonical }]));
  return remember(spyOn(builderRoute, "loadBuilderList").mockImplementation(async (_tenant, _locale, _kind, search) => page(Number(new URLSearchParams(search).get("pageSize") ?? 20))));
}
test("the VI adopted listing forwards pageSize to M4 and renders six doctors, the selected size and its real continuation", async () => {
  const load = builderListing(), html = renderToStaticMarkup(await ContentListing(props({ q: "", pageSize: "6", referenceKind: "specialty", referenceId: ids.resource, referencePublicationId: ids.publication })));
  expect(load).toHaveBeenCalledTimes(1); const query = new URLSearchParams(load.mock.calls[0][3]); expect(query.get("pageSize")).toBe("6"); expect(query.get("referencePublicationId")).toBe(ids.publication);
  expect((html.match(/class="signature-card kind-doctor"/g) ?? []).length).toBe(6); expect(html).toContain('<option value="6" selected=""'); expect(html).toContain("cursor=opaque-next"); expect(html).toContain("pageSize=6"); expect(html).toContain(`referenceId=${ids.resource}`);
});
test("VI metadata and body use the same adopted paging, cursor and identity query", async () => {
  const load = builderListing(), metadata = remember(spyOn(builderRoute, "listingPageMetadata").mockResolvedValue({ title: "Danh sách bác sĩ" }));
  const input = { q: "  bác sĩ  ", pageSize: "6", cursor: "opaque-next", referenceKind: "specialty", referenceId: ids.resource };
  expect((await listingMetadata(props(input))).title).toBe("Danh sách bác sĩ"); await ContentListing(props(input));
  expect(load).toHaveBeenCalledTimes(2); expect(load.mock.calls[0][3]).toBe(load.mock.calls[1][3]); const query = new URLSearchParams(load.mock.calls[0][3]); expect(query.get("pageSize")).toBe("6"); expect(query.get("cursor")).toBe("opaque-next"); expect(query.get("q")).toBe("bác sĩ"); expect(metadata).toHaveBeenCalledTimes(1);
});
test("adopted M4 rejects an invalid or duplicated pageSize in both body and metadata", async () => {
  const load = builderListing();
  for (const pageSize of ["0", "51", "06", "invalid", ["6", "12"]]) {
    const html = renderToStaticMarkup(await ContentListing(props({ pageSize }))); expect(html).toContain("Bộ lọc không hợp lệ"); expect(html).not.toContain("signature-card"); expect((await listingMetadata(props({ pageSize }))).title).toBe("Bộ lọc không hợp lệ");
  }
  expect(load.mock.calls.every(call => !new URLSearchParams(call[3]).has("pageSize"))).toBe(true);
});
test("invalid M4 pageSize uses a neutral probe instead of replaying a cursor outside its size context", async () => {
  const load = builderListing();
  load.mockImplementation(async (_tenant, _locale, _kind, search) => {
    const query = new URLSearchParams(search);
    if (query.has("cursor") && query.get("pageSize") !== "6") throw new Error("Cursor page-size context mismatch");
    return page(Number(query.get("pageSize") ?? 20));
  });
  for (const pageSize of ["invalid", ["6", "12"]]) {
    const input = { q: "care", cursor: "size6-bound", pageSize, referenceKind: "specialty", referenceId: ids.resource };
    expect(renderToStaticMarkup(await ContentListing(props(input)))).toContain("Bộ lọc không hợp lệ"); expect((await listingMetadata(props(input))).title).toBe("Bộ lọc không hợp lệ");
  }
  expect(load).toHaveBeenCalledTimes(4); expect(load.mock.calls.every(call => call[3] === "")).toBe(true);
  load.mockClear();
  const input = { q: "care", cursor: "size6-bound", pageSize: "6", referenceKind: "specialty", referenceId: ids.resource };
  expect(renderToStaticMarkup(await ContentListing(props(input)))).toContain("signature-card kind-doctor");
  const query = new URLSearchParams(load.mock.calls[0][3]); expect(query.get("cursor")).toBe("size6-bound"); expect(query.get("pageSize")).toBe("6"); expect(query.get("q")).toBe("care"); expect(query.get("referenceId")).toBe(ids.resource);
});
test("a neutral presentation probe does not remove the original legacy cursor or filters", async () => {
  const load = remember(spyOn(builderRoute, "loadBuilderList").mockImplementation(async (_tenant, _locale, _kind, search) => { if (search) throw new Error("Expected a neutral presentation probe"); return null; })), legacy = remember(spyOn(publicContent, "readPublicContentList").mockResolvedValue({ schemaVersion: 3, locale: "vi", kind: "doctor", canonicalUrl: canonical, site: { name: "Phòng khám", footer: { intro: "", body: { type: "doc", version: 1, blocks: [] } } }, items: [], nextCursor: null }));
  const input = { q: "care", cursor: "legacy-cursor", pageSize: ["6", "12"], referenceKind: "specialty", referenceId: ids.resource };
  expect(renderToStaticMarkup(await ContentListing(props(input)))).not.toContain("Bộ lọc không hợp lệ"); expect((await listingMetadata(props(input))).title).toBe("Bác sĩ | Phòng khám"); expect(load).toHaveBeenCalledTimes(2);
  for (const call of legacy.mock.calls) expect(call[2]).toEqual({ q: "care", cursor: "legacy-cursor", referenceKind: "specialty", referenceId: ids.resource });
});
test("legacy fallback keeps ignoring unknown pageSize while preserving its existing query validation", async () => {
  const load = remember(spyOn(builderRoute, "loadBuilderList").mockResolvedValue(null)), legacy = remember(spyOn(publicContent, "readPublicContentList").mockResolvedValue({ schemaVersion: 3, locale: "vi", kind: "doctor", canonicalUrl: canonical, site: { name: "Phòng khám", footer: { intro: "", body: { type: "doc", version: 1, blocks: [] } } }, items: [], nextCursor: null }));
  for (const pageSize of ["6", "invalid", ["6", "12"]]) { const html = renderToStaticMarkup(await ContentListing(props({ pageSize, q: "  chăm sóc  " }))); expect(html).not.toContain("Bộ lọc không hợp lệ"); expect(html).not.toContain("signature-card"); expect(html).not.toContain('name="pageSize"'); expect((await listingMetadata(props({ pageSize }))).title).toBe("Bác sĩ | Phòng khám"); }
  expect(legacy.mock.calls.every(call => !Object.hasOwn(call[2] ?? {}, "pageSize"))).toBe(true);
  load.mockClear(); legacy.mockClear(); expect(renderToStaticMarkup(await ContentListing(props({ q: ["one", "two"], pageSize: "6" })))).toContain("Bộ lọc không hợp lệ"); expect((await listingMetadata(props({ referenceKind: "specialty", pageSize: "6" }))).title).toBe("Bộ lọc không hợp lệ"); expect(load).not.toHaveBeenCalled(); expect(legacy).not.toHaveBeenCalled();
});
