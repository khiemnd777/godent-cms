import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { homeResolution, ids } from "./test-support/builder";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
describe("local public host and credential boundary", () => {
  it("rejects the administration cookie host alias before public rendering", async () => {
    const result = await proxy(new NextRequest("http://127.0.0.1:5892/", { headers: { host: "127.0.0.1:5892", cookie: "test-session=private", "x-forwarded-host": "localhost:5892" } }));
    expect(result.status).toBe(421);
    expect(result.headers.get("x-middleware-next")).toBeNull();
  });
  it("removes credentials on the valid public host and disables caching", async () => {
    const result = await proxy(new NextRequest("http://localhost:5892/", { headers: { host: "localhost:5892", cookie: "test-session=private", authorization: "Bearer test-only", "x-forwarded-host": "forged.invalid", forwarded: "host=forged.invalid", "x-gcms-locale": "en", "x-gcms-expected-publication": "forged" } }));
    expect(result.headers.get("x-middleware-request-cookie")).toBeNull();
    expect(result.headers.get("x-middleware-request-authorization")).toBeNull();
    expect(result.headers.get("x-middleware-override-headers")).not.toContain("cookie");
    expect(result.headers.get("x-middleware-override-headers")).not.toContain("authorization");
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("x-middleware-override-headers")).not.toContain("forwarded");
    expect(result.headers.get("x-middleware-request-x-gcms-locale")).toBe("vi");
    expect(result.headers.get("x-middleware-request-x-gcms-expected-publication")).toBeNull();
  });
  it("returns exact302 for whole-page EN fallback and strips unregistered query data", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ resolution: "fallback", requestedLocale: "en", actualLocale: "vi", canonicalUrl: "http://localhost:5892/clinic-a", fallbackPublicationId: ids.publication, page: null }));
    const response = await proxy(new NextRequest("http://localhost:5892/clinic-a/en?utm_source=search&phone=private&q=private&referrer=private", { headers: { host: "localhost:5892" } }));
    expect(response.status).toBe(302); expect(response.headers.get("location")).toBe("http://localhost:5892/clinic-a?utm_source=search"); expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("forwards only validated EN publication/config identities and never accepts caller replacements", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json(homeResolution()));
    const response = await proxy(new NextRequest("http://localhost:5892/clinic-a/en", { headers: { host: "localhost:5892", "x-gcms-locale": "vi", "x-gcms-expected-publication": "forged", cookie: "private", authorization: "private" } }));
    expect(response.headers.get("x-middleware-request-x-gcms-locale")).toBe("en"); expect(response.headers.get("x-middleware-request-x-gcms-expected-publication")).toBe(ids.publication); expect(response.headers.get("x-middleware-request-x-gcms-expected-config")).toBe(ids.config); expect(response.headers.get("x-middleware-request-cookie")).toBeNull();
  });
  it("fails EN backend errors as503 rather than redirecting to another language", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    const response = await proxy(new NextRequest("http://localhost:5892/clinic-a/en", { headers: { host: "localhost:5892" } }));
    expect(response.status).toBe(503); expect(response.headers.get("location")).toBeNull(); expect(await response.text()).toContain('<html lang="en">');
  });
  it("does not redirect or dispatch an unsupported POST on a website EN page", async () => {
    const fetcher = spyOn(globalThis, "fetch");
    const response = await proxy(new NextRequest("http://localhost:5892/clinic-a/en", { method: "POST", headers: { host: "localhost:5892" } }));
    expect(response.status).toBe(405); expect(response.headers.get("allow")).toBe("GET, HEAD"); expect(response.headers.get("location")).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("listing fallback retains safe filters and resets a cursor bound to EN", async () => {
    let count = 0;
    spyOn(globalThis, "fetch").mockImplementation(Object.assign(async () => ++count === 1 ? new Response(null, { status: 404 }) : Response.json({ schemaVersion: 4, locale: "vi", kind: "service", items: [], nextCursor: null, config: null, canonicalUrl: "http://localhost:5892/clinic-a/dich-vu" }), { preconnect: originalFetch.preconnect }));
    const response = await proxy(new NextRequest(`http://localhost:5892/clinic-a/en/dich-vu?q=care&cursor=EN_ONLY&referenceKind=service&referenceId=${ids.resource}&private=value`, { headers: { host: "localhost:5892" } }));
    expect(response.status).toBe(302); const target = new URL(response.headers.get("location")!); expect(target.searchParams.get("q")).toBe("care"); expect(target.searchParams.get("referenceId")).toBe(ids.resource); expect(target.searchParams.has("cursor")).toBe(false); expect(target.searchParams.has("private")).toBe(false);
  });
});
