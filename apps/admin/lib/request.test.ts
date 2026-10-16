import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { apiRequest, ApiError } from "./access";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
describe("private request transport", () => {
  it("keeps the browser multipart boundary and CSRF header for bounded media uploads", async () => {
    const body = new FormData(); body.set("file", new File(["synthetic"], "test.png", { type: "image/png" }));
    let options: RequestInit | undefined;
    spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (...[, init]: Parameters<typeof fetch>) => { options = init; return Response.json({ state: "processing" }); }, { preconnect: originalFetch.preconnect }));
    await apiRequest("/api/tenants/a/media", { method: "POST", body, csrf: "test-csrf" });
    expect(options?.body).toBe(body);
    expect(new Headers(options?.headers).has("Content-Type")).toBe(false);
    expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("test-csrf");
  });
  it("sends cookie credentials only to the fixed API with no cache and CSRF for mutations", async () => {
    let destination: string | undefined;
    let options: RequestInit | undefined;
    const intercepted: typeof fetch = Object.assign(async (...[url, init]: Parameters<typeof fetch>) => { destination = String(url); options = init; return Response.json({ version: 2 }); }, { preconnect: originalFetch.preconnect });
    spyOn(globalThis, "fetch").mockImplementation(intercepted);
    expect(await apiRequest<{ version: number }>("/api/tenants/a/services/b", { method: "PUT", body: { expectedVersion: 1 }, csrf: "test-csrf" })).toEqual({ version: 2 });
    expect(destination).toBe("http://127.0.0.1:5890/api/tenants/a/services/b");
    expect(options?.credentials).toBe("include");
    expect(options?.cache).toBe("no-store");
    expect(options?.redirect).toBe("error");
    expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("test-csrf");
  });
  it("retains the HTTP conflict status without exposing server error text", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ message: "private internal data" }, { status: 409 }));
    try { await apiRequest("/api/tenants/a/services/b"); throw new Error("Expected denial"); }
    catch (error) { expect(error).toBeInstanceOf(ApiError); expect((error as ApiError).status).toBe(409); expect((error as Error).message).not.toContain("private internal data"); }
  });
  it("exposes only the approved reauthentication code from redacted denial responses", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ code: "REAUTH_REQUIRED", message: "private internal data" }, { status: 403 }));
    try { await apiRequest("/api/tenants/a/publication/services/b/publish"); throw new Error("Expected denial"); }
    catch (error) { expect((error as ApiError).code).toBe("REAUTH_REQUIRED"); expect((error as Error).message).not.toContain("private internal data"); }
  });
  it("retains approved S05 conflict codes without exposing server details", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ code: "ASSIGNEE_UNAVAILABLE", message: "private internal data" }, { status: 409 }));
    try { await apiRequest("/api/tenants/a/leads/b/commands"); throw new Error("Expected conflict"); }
    catch (error) { expect((error as ApiError).code as string).toBe("ASSIGNEE_UNAVAILABLE"); expect((error as Error).message).not.toContain("private internal data"); }
  });
  it("discards unrecognized server codes", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ code: "private internal data" }, { status: 409 }));
    try { await apiRequest("/api/tenants/a/leads/b/commands"); throw new Error("Expected conflict"); }
    catch (error) { expect((error as ApiError).code).toBeUndefined(); }
  });
});
