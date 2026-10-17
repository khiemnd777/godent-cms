import { expect, test } from "bun:test";
import { parsePublicSearchQuery, publicSearchQueryString } from "./public-search";
import { parsePublicBuilderSearch } from "./public-builder-validation";
import { ids } from "../test-support/builder";
test("search query retains user text, uses bounded cursor paging and ignores the empty all-content filter", () => {
  expect(parsePublicSearchQuery({ q: "  Nụ cười  ", kind: "" })).toEqual({ q: "Nụ cười" });
  expect(publicSearchQueryString({ q: "Implant", kind: "service", cursor: "bound_cursor" })).toBe("?q=Implant&kind=service&cursor=bound_cursor");
  for (const params of [{ q: ["one", "two"] }, { q: "a".repeat(161) }, { q: "search", cursor: "bad&cursor" }, { q: "search", kind: "config" }]) expect(() => parsePublicSearchQuery(params)).toThrow();
});
test("search projection validates normalized echo, requested locale, result family and tenant path", () => {
  const result = { schemaVersion: 4, locale: "en", query: "implant", items: [{ id: ids.resource, publicationId: ids.publication, kind: "service", locale: "en", title: "Implant care", summary: "Published care information", path: "/clinic-a/en/dich-vu/implant" }], nextCursor: null, config: null };
  expect(parsePublicBuilderSearch(result, "clinic-a", "en", { q: "Implant", kind: "service" }).items[0].title).toBe("Implant care");
  expect(() => parsePublicBuilderSearch({ ...result, query: "other" }, "clinic-a", "en", { q: "Implant" })).toThrow();
  expect(() => parsePublicBuilderSearch({ ...result, items: [{ ...result.items[0], path: "/other/en/dich-vu/implant" }] }, "clinic-a", "en", { q: "Implant" })).toThrow();
  expect(() => parsePublicBuilderSearch({ ...result, items: [{ ...result.items[0], locale: "vi" }] }, "clinic-a", "en", { q: "Implant" })).toThrow();
});
