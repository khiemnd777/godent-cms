import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_SITE_ORIGIN } from "../api/src/contracts/s03";
import { m4PublicPath } from "../api/src/contracts/m4";
import { fallbackLocation, parseBuilderQuery, parseBuilderRoute } from "./lib/builder-routing";
import { readPublicBuilderList, readPublicBuilderPage } from "./lib/public-builder";
// Ports do not isolate cookies. Reject unsupported hosts before application rendering,
// then remove credentials and untrusted forwarding metadata on the supported public entry.
// https://nextjs.org/docs/app/api-reference/file-conventions/proxy
export async function proxy(request: NextRequest) {
  if (request.headers.get("host") !== "localhost:5892") return new NextResponse("Unsupported host", { status: 421, headers: { "Cache-Control": "no-store" } });
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("authorization");
  for (const name of [...headers.keys()]) if (name === "forwarded" || name.startsWith("x-forwarded-") || name.startsWith("x-gcms-")) headers.delete(name);
  const route = parseBuilderRoute(request.nextUrl.pathname);
  headers.set("x-gcms-locale", route?.locale ?? "vi");
  if (route?.locale === "en") {
    if (!["GET", "HEAD"].includes(request.method)) return protect(new NextResponse("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } }));
    try {
      if (route.slug) {
        const resolution = await readPublicBuilderPage(route.tenant, "en", route.kind, route.slug);
        if (resolution?.resolution === "fallback") return protect(NextResponse.redirect(fallbackLocation(resolution.canonicalUrl, request.nextUrl.searchParams, route), 302));
        if (resolution?.resolution === "page") { headers.set("x-gcms-expected-publication", resolution.page.publicationId); headers.set("x-gcms-expected-config", resolution.page.configPublicationId ?? "none"); }
      } else {
        const params = Object.fromEntries([...request.nextUrl.searchParams.keys()].map(key => [key, request.nextUrl.searchParams.getAll(key).length > 1 ? request.nextUrl.searchParams.getAll(key) : request.nextUrl.searchParams.get(key)!]));
        const query = parseBuilderQuery(params), page = await readPublicBuilderList(route.tenant, "en", route.kind, query);
        if (!page) {
          const vi = await readPublicBuilderList(route.tenant, "vi", route.kind, { q: query.q });
          if (vi) return protect(NextResponse.redirect(fallbackLocation(PUBLIC_SITE_ORIGIN + m4PublicPath(route.tenant, "vi", route.kind), request.nextUrl.searchParams, route), 302));
        } else headers.set("x-gcms-expected-config", page.config?.publicationId ?? "none");
      }
    } catch {
      // A backend/identity failure must not become a translation fallback or a mixed-language response.
      return protect(new NextResponse('<!doctype html><html lang="en"><head><meta name="robots" content="noindex,nofollow"><title>Content temporarily unavailable</title></head><body><main><h1>Content temporarily unavailable</h1><p>Please reload this page to try again.</p></main></body></html>', { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    }
  }
  return protect(NextResponse.next({ request: { headers } }));
}
function protect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
