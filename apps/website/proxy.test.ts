import { parseEntryInput } from "../api/src/modules/m5-domains-input";
import { GET as robots } from "./app/robots.txt/route";
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { homeResolution, ids } from "./test-support/builder";
import type { M5EntryContext } from "../api/src/contracts/m5-domains";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function context(host = "localhost:5892", path = "/en", customPrimary = false): M5EntryContext {
  const custom = host !== "localhost:5892";
  return { tenantId: ids.tenant, siteId: ids.tenant, tenantSlug: "clinic-a", sitePagePath: path, entry: { mode: custom ? "custom" : "platform", origin: `http://${host}`, basePath: custom ? "" : "/clinic-a", bindingId: custom ? ids.asset : null, generation: custom ? 1 : 0 }, primary: { mode: customPrimary ? "custom" : "godent", origin: customPrimary ? "http://clinic-a.test:5892" : "http://localhost:5892", basePath: customPrimary ? "" : "/clinic-a", bindingId: customPrimary ? ids.asset : null, version: customPrimary ? 2 : 0 } };
}
function publicMock(entry: M5EntryContext | null, read: (url: URL, init?: RequestInit) => Response) {
  return spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (...[input, init]: Parameters<typeof fetch>) => { const url = new URL(String(input)); if (url.pathname === "/api/public/entry") { try { parseEntryInput(Object.fromEntries(url.searchParams)); } catch { return new Response(null, { status: 400 }); } return entry ? Response.json(entry) : new Response(null, { status: 404 }); } return read(url, init); }, { preconnect: originalFetch.preconnect }));
}
function projectedHome(locale: "vi" | "en", custom = false) { const result = homeResolution(locale); if (custom) { const url = `http://clinic-a.test:5892${locale === "en" ? "/en" : "/"}`; result.canonicalUrl = url; result.page.canonicalUrl = url; result.page.alternates[0].url = url; } return result; }
const request = (url: string, extra: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {}) => { const headers = new Headers(extra.headers); headers.set("host", new URL(url).host); return new NextRequest(url, { ...extra, headers }); };
describe("local public entry and credential boundary", () => {
  it("rejects the administration cookie host alias before public rendering", async () => {
    const fetcher = spyOn(globalThis, "fetch");
    const result = await proxy(request("http://127.0.0.1:5892/", { headers: { cookie: "private", "x-forwarded-host": "localhost:5892" } }));
    expect(result.status).toBe(421); expect(fetcher).not.toHaveBeenCalled();
  });
  it("removes credentials and untrusted forwarding on the public platform root", async () => {
    const result = await proxy(request("http://localhost:5892/", { headers: { cookie: "private", authorization: "private", "x-forwarded-host": "forged.invalid", forwarded: "host=forged.invalid", "x-gcms-entry": "forged", "x-gcms-expected-publication": "forged" } }));
    expect(result.headers.get("x-middleware-request-cookie")).toBeNull(); expect(result.headers.get("x-middleware-request-authorization")).toBeNull(); expect(result.headers.get("x-middleware-override-headers")).not.toContain("forwarded"); expect(result.headers.get("cache-control")).toBe("no-store"); expect(result.headers.get("x-middleware-request-x-gcms-entry")).toBeNull();
  });
  it("resolves exact custom hostname and rewrites the site root using server tenant identity", async () => {
    const entry = context("clinic-a.test:5892", "/", true), fetcher = publicMock(entry, () => Response.json(projectedHome("vi", true)));
    const result = await proxy(request("http://clinic-a.test:5892/", { headers: { "x-gcms-entry": JSON.stringify(context("localhost:5892")), cookie: "private", authorization: "private" } }));
    expect(result.status).toBe(200); expect(new URL(result.headers.get("x-middleware-rewrite")!).pathname).toBe("/clinic-a");
    expect(JSON.parse(result.headers.get("x-middleware-request-x-gcms-entry")!).tenantId).toBe(ids.tenant);
    for (const call of fetcher.mock.calls) { const options = call[1]; expect(options?.credentials).toBe("omit"); expect(options?.cache).toBe("no-store"); expect(new Headers(options?.headers).has("authorization")).toBe(false); expect(new Headers(options?.headers).has("cookie")).toBe(false); }
    const read = fetcher.mock.calls[1][1]; expect(new Headers(read?.headers).get("x-gcms-entry-binding")).toBe(ids.asset); expect(new Headers(read?.headers).get("x-gcms-primary-version")).toBe("2");
  });
  it("does not select another tenant from a custom path prefix", async () => {
    const entry = context("clinic-a.test:5892", "/clinic-b", true);
    const fetcher = publicMock(entry, () => new Response(null, { status: 404 }));
    const result = await proxy(request("http://clinic-a.test:5892/clinic-b"));
    expect(result.status).toBe(404); expect(String(fetcher.mock.calls[1][0])).toContain("/clinic-a/"); expect(String(fetcher.mock.calls[1][0])).not.toContain("/builder/clinic-b/");
  });
  it("rejects unknown bindings and never uses caller forwarded-host as authority", async () => {
    const fetcher = publicMock(null, () => { throw new Error("Unexpected content read"); });
    const result = await proxy(request("http://unknown.test:5892/", { headers: { "x-forwarded-host": "clinic-a.test:5892" } }));
    expect(result.status).toBe(421); expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("host")).toBe("unknown.test:5892"); expect(fetcher.mock.calls).toHaveLength(1);
  });
  it("pins VI and EN publication and configuration and removes caller pin replacements", async () => {
    for (const locale of ["vi", "en"] as const) {
      publicMock(context("localhost:5892", locale === "en" ? "/en" : "/"), () => Response.json(projectedHome(locale)));
      const response = await proxy(request(`http://localhost:5892/clinic-a${locale === "en" ? "/en" : ""}`, { headers: { "x-gcms-expected-publication": "forged" } }));
      expect(response.headers.get("x-middleware-request-x-gcms-expected-publication")).toBe(ids.publication); expect(response.headers.get("x-middleware-request-x-gcms-expected-config")).toBe(ids.config);
    }
  });
  it("returns exact301 directly to same-language custom primary for GET and HEAD", async () => {
    for (const method of ["GET", "HEAD"]) {
      publicMock(context("localhost:5892", "/en", true), () => Response.json(projectedHome("en", true)));
      const response = await proxy(request("http://localhost:5892/clinic-a/en?utm_source=search&phone=private&redirect=https://evil.test", { method }));
      expect(response.status).toBe(301); expect(response.headers.get("location")).toBe("http://clinic-a.test:5892/en?utm_source=search"); expect(await response.text()).toBe("");
    }
  });
  it("returns one302 directly to primary VI for missing EN without a301 chain", async () => {
    publicMock(context("localhost:5892", "/en", true), () => Response.json({ resolution: "fallback", requestedLocale: "en", actualLocale: "vi", canonicalUrl: "http://clinic-a.test:5892/", fallbackPublicationId: ids.publication, page: null }));
    const response = await proxy(request("http://localhost:5892/clinic-a/en?utm_source=search&phone=private"));
    expect(response.status).toBe(302); expect(response.headers.get("location")).toBe("http://clinic-a.test:5892/?utm_source=search");
  });
  it("preserves Signature homepage search text and kind across locale fallback, but clears the old locale cursor", async () => {
    for (const fallback of [false, true]) {
      const locale = fallback ? "vi" : "en", home = projectedHome(locale, true);
      home.page.config.content.theme = "signature"; const signature = { navigation: [], headerLocation: null, footerLocations: [] }; Object.assign(home.page.config.content, { signature }); Object.assign(home.page.config, { signature });
      const fetcher = publicMock(context("localhost:5892", "/en", true), url => fallback && url.pathname.includes("/en/") ? Response.json({ resolution: "fallback", requestedLocale: "en", actualLocale: "vi", canonicalUrl: home.canonicalUrl, fallbackPublicationId: ids.publication, page: null }) : Response.json(home));
      fetcher.mockClear();
      const result = await proxy(request("http://localhost:5892/clinic-a/en?q=care&kind=doctor&cursor=old_EN.123&phone=private")), location = new URL(result.headers.get("location")!);
      expect(result.status).toBe(fallback ? 302 : 301); expect(location.searchParams.get("q")).toBe("care"); expect(location.searchParams.get("kind")).toBe("doctor"); expect(location.searchParams.get("cursor")).toBe(fallback ? null : "old_EN.123"); expect(location.searchParams.has("phone")).toBe(false); expect(fetcher.mock.calls).toHaveLength(fallback ? 3 : 2);
    }
  });
  it("preserves a same-language listing cursor and resets it for locale fallback", async () => {
    for (const fallback of [false, true]) {
      const entry = context("localhost:5892", "/en/dich-vu", true);
      publicMock(entry, url => fallback && url.pathname.includes("/en/") ? new Response(null, { status: 404 }) : Response.json({ schemaVersion: 4, locale: fallback ? "vi" : "en", kind: "service", items: [], nextCursor: null, config: null, canonicalUrl: `http://clinic-a.test:5892/${fallback ? "" : "en/"}dich-vu` }));
      const result = await proxy(request(`http://localhost:5892/clinic-a/en/dich-vu?q=care&cursor=PAGE&referenceKind=service&referenceId=${ids.resource}&private=no`));
      const location = new URL(result.headers.get("location")!); expect(result.status).toBe(fallback ? 302 : 301); expect(location.searchParams.get("cursor")).toBe(fallback ? null : "PAGE"); expect(location.searchParams.get("referenceId")).toBe(ids.resource); expect(location.searchParams.has("private")).toBe(false);
    }
  });
  it("keeps backend failure or stale pins as503 without language or host fallback", async () => {
    for (const status of [409, 503]) {
      publicMock(context("localhost:5892", "/en", true), () => new Response(null, { status }));
      const result = await proxy(request("http://localhost:5892/clinic-a/en")); expect(result.status).toBe(503); expect(result.headers.get("location")).toBeNull(); expect(await result.text()).toContain('<html lang="en">');
    }
  });
  it("does not redirect or dispatch unsupported page POST", async () => {
    const fetcher = spyOn(globalThis, "fetch"); const response = await proxy(request("http://localhost:5892/clinic-a/en", { method: "POST" }));
    expect(response.status).toBe(405); expect(response.headers.get("allow")).toBe("GET, HEAD"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("returns400 for ambiguous functional query rather than dropping it into a redirect", async () => {
    publicMock(context("localhost:5892", "/dich-vu", true), () => { throw new Error("Unexpected read"); });
    const response = await proxy(request("http://localhost:5892/clinic-a/dich-vu?q=a&q=b")); expect(response.status).toBe(400); expect(response.headers.get("location")).toBeNull();
  });
});

it("serves a valid custom binding with Godent canonical after explicit return without a reverse301", async () => {
  publicMock(context("clinic-a.test:5892", "/", false), () => Response.json(projectedHome("vi")));
  const response = await proxy(request("http://clinic-a.test:5892/")); expect(response.status).toBe(200); expect(response.headers.get("location")).toBeNull(); expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe("/clinic-a");
});


it("routes exact metadata paths through the real API entry parser", async () => {
  for (const host of ["localhost:5892", "clinic-a.localhost:5892"]) for (const name of ["sitemap.xml", "robots.txt"]) {
    const custom = host !== "localhost:5892", pathname = custom ? `/${name}` : `/clinic-a/${name}`;
    const entry = context(host, `/${name}`, true), fetcher = publicMock(entry, () => { throw new Error("Metadata must not become a page read"); });
    fetcher.mockClear();
    const response = await proxy(request(`http://${host}${pathname}`));
    expect(response.status).toBe(200); expect(response.headers.get("location")).toBeNull(); expect(fetcher.mock.calls).toHaveLength(1);
    const parsed = parseEntryInput(Object.fromEntries(new URL(String(fetcher.mock.calls[0][0])).searchParams));
    expect(parsed).toEqual({ host, path: pathname });
    if (!custom && name === "robots.txt") expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe("/robots.txt");
    if (custom && name === "sitemap.xml") expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe("/clinic-a/sitemap.xml");
    if (custom && name === "robots.txt") { expect(response.headers.get("x-middleware-rewrite")).toBeNull(); expect(response.headers.get("x-middleware-next")).toBe("1"); }
  }
});
it("keeps custom robots bound, nonredirecting and excluded from indexing", async () => {
  publicMock(context("clinic-a.localhost:5892", "/robots.txt", true), () => { throw new Error("Unexpected content read"); });
  const response = await proxy(request("http://clinic-a.localhost:5892/robots.txt"));
  expect(response.status).toBe(200); expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow"); expect(response.headers.get("location")).toBeNull();
  const route = robots(); expect(await route.text()).toBe("User-agent: *\nDisallow: /\n"); expect(route.headers.get("cache-control")).toBe("no-store");
  publicMock(null, () => { throw new Error("Unknown bindings cannot read content"); });
  expect((await proxy(request("http://unknown.localhost:5892/robots.txt"))).status).toBe(421);
});
it("does not generalize metadata support to dotted nested or encoded tenant paths", () => {
  for (const path of ["/other.xml", "/clinic-a/nested/sitemap.xml", "/clinic-a/robots.txt/extra", "/clinic-a/%73itemap.xml", "/clinic-a/../sitemap.xml", "/clinic-a/Sitemap.xml"]) expect(() => parseEntryInput({ host: "clinic-a.localhost:5892", path })).toThrow();
});

it("keeps real-adapter page and metadata rewrites internal when rawURL uses the loopback listener", async () => {
  const config = (await import("./next.config")).default;
  expect(config.skipProxyUrlNormalize).toBe(true);
  const { adapter } = await import("next/dist/server/web/adapter.js");
  const previous = process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE;
  process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = "true";
  try {
    for (const item of [
      { host: "clinic-a.test:5892", path: "/en", target: "/clinic-a/en", entry: context("clinic-a.test:5892", "/en", true), page: true },
      { host: "clinic-a.test:5892", path: "/sitemap.xml", target: "/clinic-a/sitemap.xml", entry: context("clinic-a.test:5892", "/sitemap.xml", true), page: false },
      { host: "localhost:5892", path: "/clinic-a/robots.txt", target: "/robots.txt", entry: context("localhost:5892", "/robots.txt", true), page: false },
    ]) {
      publicMock(item.entry, () => item.page ? Response.json(projectedHome("en", true)) : new Response(null, { status: 500 }));
      const result = await adapter({ page: "middleware", request: { url: `http://127.0.0.1:5892${item.path}?utm_source=search`, method: "GET", headers: { host: item.host, cookie: "private", authorization: "Bearer private", "x-forwarded-host": "evil.example", "x-gcms-entry": "forged", "x-gcms-primary-version": "0" }, nextConfig: { basePath: "", trailingSlash: false }, signal: AbortSignal.timeout(5000) }, handler: async actual => {
        expect(new URL(actual.url).host).toBe("127.0.0.1:5892"); expect(actual.nextUrl.host).toBe("localhost:5892"); return proxy(actual);
      } });
      expect(result.response.status).toBe(200); expect(result.response.headers.get("location")).toBeNull();
      const rewrite = new URL(result.response.headers.get("x-middleware-rewrite")!);
      expect(rewrite.origin).toBe("http://127.0.0.1:5892"); expect(rewrite.pathname).toBe(item.target); expect(rewrite.search).toBe("?utm_source=search");
      const overridden = result.response.headers.get("x-middleware-override-headers"); expect(overridden).not.toContain("cookie"); expect(overridden).not.toContain("authorization"); expect(overridden).not.toContain("forwarded");
      expect(JSON.parse(result.response.headers.get("x-middleware-request-x-gcms-entry")!).tenantSlug).toBe("clinic-a");
    }
  } finally { if (previous === undefined) delete process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE; else process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = previous; }
});
