import { afterEach, expect, spyOn, test } from "bun:test";
import * as nextHeaders from "next/headers";
import * as builder from "../lib/public-builder";
import { listingAlternates } from "./builder-route";
import { ids } from "../test-support/builder";

const restores: (() => void)[] = [];
afterEach(() => { for (const restore of restores.splice(0).reverse()) restore(); });
function remember<T extends { mockRestore(): void }>(spy: T): T { restores.push(() => spy.mockRestore()); return spy; }
function context() {
  const entry = { tenantId: ids.tenant, siteId: ids.resource, tenantSlug: "clinic-a", sitePagePath: "/bac-si", entry: { mode: "platform", origin: "http://localhost:5892", basePath: "/clinic-a", bindingId: null, generation: 0 }, primary: { mode: "godent", origin: "http://localhost:5892", basePath: "/clinic-a", bindingId: null, version: 0 } };
  const headers = new Headers({ "x-gcms-entry": JSON.stringify(entry), "x-gcms-locale": "vi" });
  remember(spyOn(nextHeaders, "headers").mockResolvedValue(headers as Awaited<ReturnType<typeof nextHeaders.headers>>));
}
test("language metadata uses a current bounded read in the other locale and keeps its canonical URL", async () => {
  context();
  const read = remember(spyOn(builder, "readPublicBuilderList").mockResolvedValue({ schemaVersion: 4, locale: "en", kind: "doctor", items: [], nextCursor: null, config: null, canonicalUrl: "http://localhost:5892/clinic-a/en/bac-si" }));
  expect(await listingAlternates("clinic-a", "vi", "doctor", "http://localhost:5892/clinic-a/bac-si")).toEqual([{ locale: "vi", url: "http://localhost:5892/clinic-a/bac-si" }, { locale: "en", url: "http://localhost:5892/clinic-a/en/bac-si" }]);
  expect(read).toHaveBeenCalledTimes(1);
  expect(read.mock.calls[0].slice(0, 4)).toEqual(["clinic-a", "en", "doctor", { pageSize: 1 }]);
  expect(read.mock.calls[0][4]?.tenantSlug).toBe("clinic-a");
  expect(read.mock.calls[0][4]?.primary.version).toBe(0);
});
test("a missing other-locale list adds no language link and read errors remain errors", async () => {
  context();
  const read = remember(spyOn(builder, "readPublicBuilderList").mockResolvedValue(null));
  expect(await listingAlternates("clinic-a", "en", "doctor", "http://localhost:5892/clinic-a/en/bac-si")).toEqual([{ locale: "en", url: "http://localhost:5892/clinic-a/en/bac-si" }]);
  read.mockRejectedValue(new Error("Current content unavailable"));
  await expect(listingAlternates("clinic-a", "en", "doctor", "http://localhost:5892/clinic-a/en/bac-si")).rejects.toThrow("Current content unavailable");
});
