import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
describe("local public host and credential boundary", () => {
  it("rejects the administration cookie host alias before public rendering", () => {
    const result = proxy(new NextRequest("http://127.0.0.1:5892/", { headers: { host: "127.0.0.1:5892", cookie: "test-session=private", "x-forwarded-host": "localhost:5892" } }));
    expect(result.status).toBe(421);
    expect(result.headers.get("x-middleware-next")).toBeNull();
  });
  it("removes credentials on the valid public host and disables caching", () => {
    const result = proxy(new NextRequest("http://localhost:5892/", { headers: { host: "localhost:5892", cookie: "test-session=private", authorization: "Bearer test-only", "x-forwarded-host": "forged.invalid", forwarded: "host=forged.invalid" } }));
    expect(result.headers.get("x-middleware-request-cookie")).toBeNull();
    expect(result.headers.get("x-middleware-request-authorization")).toBeNull();
    expect(result.headers.get("x-middleware-override-headers")).not.toContain("cookie");
    expect(result.headers.get("x-middleware-override-headers")).not.toContain("authorization");
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("x-middleware-override-headers")).not.toContain("forwarded");
  });
});
