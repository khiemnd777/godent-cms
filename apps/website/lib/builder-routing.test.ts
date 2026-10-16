import { expect, test } from "bun:test";
import { M3_PATHS, type ReferenceKind } from "../../api/src/contracts/m3";
import { fallbackLocation, parseBuilderQuery, parseBuilderRoute, safeTracking } from "./builder-routing";
import { builderListSearch } from "./public-builder";
import { ids } from "../test-support/builder";
test("VI paths stay locked and EN inserts one locale segment for every content family", () => {
  for (const [kind, section] of Object.entries(M3_PATHS) as [ReferenceKind, string][]) for (const locale of ["vi", "en"] as const) {
    const prefix = `/clinic-a${locale === "en" ? "/en" : ""}/${section}`;
    expect(parseBuilderRoute(prefix)).toEqual({ tenant: "clinic-a", locale, kind });
    expect(parseBuilderRoute(prefix + "/resource-a")).toEqual({ tenant: "clinic-a", locale, kind, slug: "resource-a" });
  }
  expect(parseBuilderRoute("/clinic-a/en")).toEqual({ tenant: "clinic-a", locale: "en", kind: "home", slug: "home" });
  expect(parseBuilderRoute("/clinic-a/about")).toEqual({ tenant: "clinic-a", locale: "vi", kind: "page", slug: "about" });
  expect(parseBuilderRoute("/clinic-a/en/landing/campaign-a")?.kind).toBe("landing");
  for (const path of ["/clinic-a/en/en/a", "/clinic-a//about", "/clinic-a/en/%2e%2e", "/api/en/a", "/clinic-a/en/preview/a"]) expect(parseBuilderRoute(path)).toBeNull();
});
test("reverse discovery preserves identity filters and rejects malformed or partial selectors", () => {
  const query = parseBuilderQuery({ referenceKind: "service", referenceId: ids.resource, q: "  clear care  " });
  expect(query).toEqual({ q: "clear care", referenceKind: "service", referenceId: ids.resource });
  expect(builderListSearch(query)).toContain("referenceId=" + ids.resource); expect(builderListSearch(query)).not.toContain("referencePublicationId");
  for (const input of [{ q: ["a", "b"] }, { referenceKind: "service" }, { referenceKind: "service", referenceId: "forged" }, { cursor: "unsafe?" }]) expect(() => parseBuilderQuery(input)).toThrow();
});
test("fallback forwards only bounded tracking tokens and registered list semantics", () => {
  const params = new URLSearchParams("utm_source=search&utm_medium=email&utm_campaign=pilot&referrer=private&phone=123&utm_term=private&q=care&cursor=EN_ONLY");
  expect(safeTracking(params)).toEqual({ source: "search", medium: "email", campaign: "pilot" });
  const detail = fallbackLocation("http://localhost:5892/clinic-a/dich-vu/service-a", params, { tenant: "clinic-a", locale: "en", kind: "service", slug: "service-a" });
  expect(detail).not.toContain("private"); expect(detail).not.toContain("q="); expect(detail).not.toContain("cursor");
  const list = fallbackLocation("http://localhost:5892/clinic-a/dich-vu", params, { tenant: "clinic-a", locale: "en", kind: "service" });
  expect(list).toContain("q=care"); expect(list).not.toContain("cursor");
  expect(safeTracking(new URLSearchParams("utm_source=a&utm_source=b&utm_campaign=unsafe%20token"))).toEqual({});
});
