import { afterEach, expect, spyOn, test } from "bun:test";
import { readPublicService } from "./public-service";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const page = { schemaVersion: 1, locale: "vi", publicationId: "synthetic", publicationVersion: 1, publishedAt: "2026-10-16T00:00:00Z", canonicalUrl: "http://localhost:5892/clinic-a/dich-vu/service-a", site: { name: "Nha khoa A", footer: { intro: "", body: { type: "doc", version: 1, blocks: [] } } }, service: { slug: "service-a", title: "Dịch vụ A", summary: "Giới thiệu", body: { type: "doc", version: 1, blocks: [] }, seo: { title: "", description: "" } } };
test("public read uses the fixed local API without credentials, cache or inbound headers", async () => {
  let destination = ""; let init: RequestInit | undefined;
  spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (...[url, options]: Parameters<typeof fetch>) => { destination = String(url); init = options; return Response.json(page); }, { preconnect: originalFetch.preconnect }));
  expect((await readPublicService("clinic-a", "service-a"))?.service.title).toBe("Dịch vụ A");
  expect(destination).toBe("http://127.0.0.1:5890/api/public/sites/clinic-a/services/service-a");
  expect(init?.credentials).toBe("omit"); expect(init?.cache).toBe("no-store"); expect(init?.redirect).toBe("error");
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  expect([...new Headers(init?.headers).keys()]).toEqual(["accept"]);
});
test("missing publication is not found and invalid slugs never reach the API", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
  expect(await readPublicService("clinic-a", "service-a")).toBeNull();
  fetcher.mockClear(); expect(await readPublicService("../clinic-b", "service-a")).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
});
test("public metadata refuses forged canonical hosts and mismatched page identity", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ...page, canonicalUrl: "https://untrusted.invalid/clinic-a/dich-vu/service-a" }));
  await expect(readPublicService("clinic-a", "service-a")).rejects.toThrow("Invalid public publication");
});
test("API outages and transport failures do not become missing pages or stale content", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
  await expect(readPublicService("clinic-a", "service-a")).rejects.toThrow("temporarily unavailable");
  fetcher.mockRejectedValue(new Error("Network unavailable")); await expect(readPublicService("clinic-a", "service-a")).rejects.toThrow("Network unavailable");
});
