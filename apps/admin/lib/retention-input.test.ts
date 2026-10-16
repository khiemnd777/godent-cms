import { describe, expect, it } from "bun:test";
import { deadlineFromResponse, extensionInput, isCurrentResponse } from "./retention-input";

describe("retention UI boundaries", () => {
  it("uses the request start to conservatively account for response latency and client clock skew", () => {
    expect(deadlineFromResponse("2026-10-16T10:00:00Z", "2026-10-16T10:00:10Z", 1000)).toBe(11000);
    expect(isCurrentResponse(11000, 10999)).toBe(true);
    expect(isCurrentResponse(11000, 11000)).toBe(false);
    expect(isCurrentResponse(11000, 12000)).toBe(false);
  });
  it("fails closed for malformed server timing but permits explicitly unbounded empty results", () => {
    expect(deadlineFromResponse("invalid", "2026-10-16T10:00:10Z", 1000)).toBe(1000);
    expect(deadlineFromResponse("2026-10-16T10:00:00Z", null, 1000)).toBe(Infinity);
    expect(deadlineFromResponse("2026-10-16T10:00:00Z", "invalid", 1000)).toBe(1000);
  });
  it("requires an explicit reason and finite future expiry beyond the effective deadline", () => {
    expect(() => extensionInput(" ", "2026-10-18T10:00", "2026-10-17T10:00Z", 0)).toThrow();
    expect(() => extensionInput("Agreed follow-up", "invalid", "2026-10-17T10:00Z", 0)).toThrow();
    expect(() => extensionInput("Agreed follow-up", "2026-10-16T10:00", "2026-10-17T10:00Z", 0)).toThrow();
    const result = extensionInput("  Agreed follow-up  ", "2030-10-18T10:00", "2026-10-17T10:00Z", 0);
    expect(result.reason).toBe("Agreed follow-up");
    expect(Number.isFinite(Date.parse(result.expiresAt))).toBe(true);
  });
  it("rejects an extension after the currently displayed lead has expired", () => {
    expect(() => extensionInput("Agreed follow-up", "2030-10-18T10:00", "2026-10-17T10:00Z", Date.parse("2026-10-17T10:00Z"))).toThrow();
  });
});
