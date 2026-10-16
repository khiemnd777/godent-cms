import { afterEach, describe, expect, it } from "bun:test";
import type { LeadDetail, LeadHistoryPage } from "../../api/src/contracts/s05";
import { deadlineFromResponse, isCurrentResponse } from "./retention-input";
import { historyFromSnapshot, leadFromSnapshot, mergeHistorySnapshot, requestLeadHistorySnapshot, requestLeadSnapshot } from "./lead-response";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
// Deliberately behind the server clock. Absolute expiresAt comparisons cannot protect this client.
const detail = {
  id: "owned-synthetic-lead", name: "Synthetic private name", message: "Synthetic private message",
  serverTime: "2026-10-16T10:00:00.000Z", validUntil: "2026-10-16T10:00:10.000Z", expiresAt: "2026-10-16T10:00:10.000Z",
} as LeadDetail;

describe("lead response privacy windows", () => {
  for (const source of ["command", "extension", "compare"] as const) {
    it(`rejects a delayed ${source} response spanning its server deadline despite a client clock behind the server`, async () => {
      let now = 1000; let deliver!: (response: Response) => void;
      globalThis.fetch = Object.assign(() => new Promise<Response>(resolve => { deliver = resolve; }), { preconnect: originalFetch.preconnect });
      const snapshotPromise = requestLeadSnapshot(`/api/tenants/owned/leads/owned/${source}`, source === "compare" ? {} : { method: "POST", csrf: "synthetic", body: {} }, () => now);
      now = 12000;
      // This reproduces the reviewed receipt-time admission: it extends validity by the transport delay.
      expect(isCurrentResponse(Math.min(Date.parse(detail.expiresAt), deadlineFromResponse(detail.serverTime, detail.validUntil, now)), now)).toBe(true);
      deliver(Response.json(source === "compare" ? detail : { lead: detail }));
      expect(await snapshotPromise).toBeNull();
    });
  }
  it("keeps an early comparison only until its original deadline and rejects delayed Use current", async () => {
    let now = 1000;
    globalThis.fetch = Object.assign(async () => Response.json(detail), { preconnect: originalFetch.preconnect });
    const snapshot = await requestLeadSnapshot("/api/tenants/owned/leads/owned", {}, () => now);
    expect(snapshot?.deadline).toBe(11000);
    expect(leadFromSnapshot(snapshot, 10999)?.message).toBe("Synthetic private message");
    now = 11000;
    expect(leadFromSnapshot(snapshot, now)).toBeNull();
    expect(leadFromSnapshot(snapshot, now + 1000)).toBeNull();
  });
  it("fails closed when a private detail has no bounded or valid server timing", async () => {
    for (const timing of [{ serverTime: "invalid", validUntil: detail.validUntil }, { serverTime: detail.serverTime, validUntil: null }]) {
      globalThis.fetch = Object.assign(async () => Response.json({ ...detail, ...timing }), { preconnect: originalFetch.preconnect });
      expect(await requestLeadSnapshot("/api/tenants/owned/leads/owned", {}, () => 1000)).toBeNull();
    }
  });
});

const history = {
  serverTime: detail.serverTime, validUntil: "2026-10-16T10:00:02.000Z", nextCursor: "synthetic-next",
  items: [{ id: "synthetic-event", kind: "note", payload: { text: "Synthetic private history" }, version: 2, actor: { userId: "synthetic-a2", name: "Synthetic A2" }, createdAt: detail.serverTime }],
} as LeadHistoryPage;

describe("lead history privacy windows", () => {
  it("rejects history delayed beyond A2's shortened expiry while the old detail still appears current", async () => {
    let now = 1000; let deliver!: (response: Response) => void;
    globalThis.fetch = Object.assign(() => new Promise<Response>(resolve => { deliver = resolve; }), { preconnect: originalFetch.preconnect });
    const snapshotPromise = requestLeadHistorySnapshot("/api/tenants/owned/leads/owned/history", {}, () => now);
    now = 4000;
    // The parent detail's older ten-second validity window still admits data.
    expect(isCurrentResponse(deadlineFromResponse(detail.serverTime, detail.validUntil, 1000), now)).toBe(true);
    deliver(Response.json(history));
    expect(await snapshotPromise).toBeNull();
  });
  it("expires an early history page at its fresh deadline rather than the stale parent deadline", async () => {
    globalThis.fetch = Object.assign(async () => Response.json(history), { preconnect: originalFetch.preconnect });
    const snapshot = await requestLeadHistorySnapshot("/api/tenants/owned/leads/owned/history", {}, () => 1000);
    expect(snapshot?.deadline).toBe(3000);
    expect(historyFromSnapshot(snapshot, 2999)?.items[0]?.payload).toEqual({ text: "Synthetic private history" });
    expect(historyFromSnapshot(snapshot, 3000)).toBeNull();
  });
  it("bounds accumulated pages by the earliest captured deadline and discards expired prior history", () => {
    const prior = { page: history, deadline: 11000 };
    const next = { page: { ...history, items: [{ ...history.items[0]!, id: "synthetic-older" }], nextCursor: null }, deadline: 3000 };
    const merged = mergeHistorySnapshot(prior, next, true, 2000);
    expect(merged.deadline).toBe(3000);
    expect(merged.page.items.map(item => item.id)).toEqual(["synthetic-event", "synthetic-older"]);
    expect(historyFromSnapshot(merged, 3000)).toBeNull();
    const refreshed = mergeHistorySnapshot({ page: history, deadline: 1999 }, next, true, 2000);
    expect(refreshed.page.items.map(item => item.id)).toEqual(["synthetic-older"]);
  });
});
