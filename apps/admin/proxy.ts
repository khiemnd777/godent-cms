import { NextResponse, type NextRequest } from "next/server";
// Local canonical origin contract D10. Host comes from the request, never forwarded headers.
// https://nextjs.org/docs/app/api-reference/file-conventions/proxy
export function proxy(request: NextRequest) {
  if (request.headers.get("host") !== "127.0.0.1:5891") return new NextResponse("Unsupported host", { status: 421 });
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
