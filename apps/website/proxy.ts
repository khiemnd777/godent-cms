import { NextResponse, type NextRequest } from "next/server";
// Ports do not isolate cookies. Reject unsupported hosts before application rendering,
// then remove credentials and untrusted forwarding metadata on the supported public entry.
// https://nextjs.org/docs/app/api-reference/file-conventions/proxy
export function proxy(request: NextRequest) {
  if (request.headers.get("host") !== "localhost:5892") return new NextResponse("Unsupported host", { status: 421, headers: { "Cache-Control": "no-store" } });
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("authorization");
  for (const name of [...headers.keys()]) if (name === "forwarded" || name.startsWith("x-forwarded-")) headers.delete(name);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
