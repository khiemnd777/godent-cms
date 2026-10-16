import { describe, expect, it } from "bun:test";
import { tenantContext, tenantHref, apiUrl } from "./access";

const memberships = [{ tenantId: "tenant-a", tenantName: "A", role: "tenant_admin" as const }];

describe("tab tenant context", () => {
  it("requires an explicit, current membership", () => {
    expect(tenantContext(null, memberships)).toBeNull();
    expect(tenantContext("tenant-b", memberships)).toBeNull();
    expect(tenantContext("tenant-a", [])).toBeNull();
    expect(tenantContext("tenant-a", memberships)?.tenantName).toBe("A");
  });
  it("keeps the tenant in each navigation URL without shared selection state", () => {
    expect(tenantHref("/cms/services", "tenant-a")).toBe("/cms/services?tenant=tenant-a");
    expect(tenantHref("/cms", "a&tenant=b")).toBe("/cms?tenant=a%26tenant%3Db");
  });
});

describe("private API destination", () => {
  it("permits only the fixed local API and a local API path", () => {
    expect(apiUrl("/api/session")).toBe("http://127.0.0.1:5890/api/session");
    for (const path of ["https://other.test/api/session", "//other.test/api/session", "/other", "/api/../other", "/api/\\other"]) {
      expect(() => apiUrl(path)).toThrow();
    }
  });
});
