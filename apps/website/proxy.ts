import { NextResponse, type NextRequest } from "next/server";
import { InvalidBuilderQuery, parseBuilderQuery, parseBuilderRoute } from "./lib/builder-routing";
import { readPublicEntry } from "./lib/public-entry";
import { readPublicBuilderList, readPublicBuilderPage } from "./lib/public-builder";
import { redirectQuery } from "./lib/public-url-context";

function protect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
function internalRewrite(pathname: string, search: string, headers: Headers) {
  // The public Host selects an entry; the internal rewrite always stays on the local listener.
  const target = new URL("http://127.0.0.1:5892"); target.pathname = pathname; target.search = search;
  return protect(NextResponse.rewrite(target, { request: { headers } }));
}
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?:5892$/.test(host) || host === "127.0.0.1:5892") return protect(new NextResponse("Unsupported host", { status: 421 }));
  const headers = new Headers(request.headers);
  headers.delete("cookie"); headers.delete("authorization");
  for (const name of [...headers.keys()]) if (name === "forwarded" || name.startsWith("x-forwarded-") || name.startsWith("x-gcms-")) headers.delete(name);
  const pathname = request.nextUrl.pathname;
  // Framework assets and the unbound platform landing page have no tenant context.
  if (pathname.startsWith("/_next/") || (host === "localhost:5892" && (pathname === "/" || pathname === "/robots.txt"))) {
    headers.set("x-gcms-locale", "vi"); return protect(NextResponse.next({ request: { headers } }));
  }
  if (!["GET", "HEAD"].includes(request.method)) return protect(new NextResponse("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } }));
  let locale = "vi";
  try {
    const context = await readPublicEntry(host, pathname);
    if (!context) return protect(new NextResponse("Not found", { status: host === "localhost:5892" ? 404 : 421 }));
    headers.set("x-gcms-entry", JSON.stringify(context));
    const internalPath = `/${context.tenantSlug}${context.sitePagePath === "/" ? "" : context.sitePagePath}`;
    const route = parseBuilderRoute(internalPath); locale = route?.locale ?? "vi"; headers.set("x-gcms-locale", locale);
    if (route) {
      const listing = !route.slug;
      const query = listing ? parseBuilderQuery(Object.fromEntries([...request.nextUrl.searchParams.keys()].map(key => [key, request.nextUrl.searchParams.getAll(key).length > 1 ? request.nextUrl.searchParams.getAll(key) : request.nextUrl.searchParams.get(key)!]))) : {};
      let canonical: string | undefined, fallback = false;
      if (route.slug) {
        const resolution = await readPublicBuilderPage(route.tenant, route.locale, route.kind, route.slug, context);
        if (!resolution) return protect(new NextResponse("Not found", { status: 404 }));
        canonical = resolution.canonicalUrl; fallback = resolution.resolution === "fallback";
        if (resolution.resolution === "page") { headers.set("x-gcms-expected-publication", resolution.page.publicationId); headers.set("x-gcms-expected-config", resolution.page.configPublicationId ?? "none"); }
      } else {
        const page = await readPublicBuilderList(route.tenant, route.locale, route.kind, query, context);
        if (!page && route.locale === "en") {
          const vi = await readPublicBuilderList(route.tenant, "vi", route.kind, { ...query, cursor: undefined }, context);
          if (vi) { canonical = vi.canonicalUrl; fallback = true; }
        } else if (page) { canonical = page.canonicalUrl; headers.set("x-gcms-expected-config", page.config?.publicationId ?? "none"); }
        if (!canonical) return protect(new NextResponse("Not found", { status: 404 }));
      }
      const sameLanguageAlias = context.primary.mode === "custom" && (context.entry.mode === "platform" || context.entry.bindingId !== context.primary.bindingId);
      if (fallback || sameLanguageAlias) return protect(NextResponse.redirect(redirectQuery(canonical!, request.nextUrl.searchParams, fallback, listing), fallback ? 302 : 301));
    }
    if (context.sitePagePath === "/robots.txt" && pathname !== "/robots.txt") {
      return internalRewrite("/robots.txt", request.nextUrl.search, headers);
    }
    if (context.entry.mode === "custom" && !pathname.startsWith("/_next/") && pathname !== "/robots.txt") {
      return internalRewrite(internalPath, request.nextUrl.search, headers);
    }
    return protect(NextResponse.next({ request: { headers } }));
  } catch (error) {
    if (error instanceof InvalidBuilderQuery) return protect(new NextResponse("Invalid public filter", { status: 400 }));
    const title = locale === "en" ? "Content temporarily unavailable" : "Nội dung tạm thời chưa khả dụng";
    return protect(new NextResponse(`<!doctype html><html lang="${locale}"><head><meta name="robots" content="noindex,nofollow"><title>${title}</title></head><body><main><h1>${title}</h1></main></body></html>`, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }));
  }
}
