import { describe, expect, it } from "bun:test";
import { deletionTime, initialQuotaInput, m5Route, quotaInput } from "./m5-input";
const operationId = "a1111111-1111-4111-8111-111111111111";
function values(mode: string, content: string, media: string) { const data = new FormData(); data.set("mode", mode); data.set("contentItems", content); data.set("mediaBytes", media); data.set("reason", "Confirmed manual policy"); return data; }
describe("M5 administrative inputs", () => {
  it("keeps unset, monitor and enforced distinct without implicit quota values", () => {
    expect(quotaInput(values("unset", "100", "200"), 0, operationId).policy).toEqual({ mode: "unset", contentItemsLimit: null, mediaBytesLimit: null });
    expect(quotaInput(values("monitor", "", ""), 0, operationId).policy).toEqual({ mode: "monitor", contentItemsLimit: null, mediaBytesLimit: null });
    expect(quotaInput(values("enforced", "0", ""), 5, operationId)).toEqual({ operationId, expectedVersion: 5, reason: "Confirmed manual policy", policy: { mode: "enforced", contentItemsLimit: 0, mediaBytesLimit: null } });
    expect(() => quotaInput(values("enforced", "", ""), 0, operationId)).toThrow();
  });
  it("rejects fractions, negative, exponent and unsafe integer limits", () => {
    for (const raw of ["1.1", "-1", "1e3", "9007199254740992"]) expect(() => quotaInput(values("enforced", raw, ""), 0, operationId)).toThrow();
  });
  it("requires an explicit deletion instant without an invented grace default", () => {
    expect(() => deletionTime("")).toThrow(); expect(() => deletionTime("invalid")).toThrow();
    expect(deletionTime("2026-10-16T10:30:00+07:00")).toBe("2026-10-16T03:30:00.000Z");
    expect(m5Route("export", operationId)).toBe(`/api/cms/tenants/${operationId}/m5/platform/export`);
    expect(m5Route("execute", operationId)).toBe(`/api/platform/tenants/${operationId}/m5/deletion/execute`);
  });
});

it("requires an explicit initial quota choice and preserves an enforced zero", () => {
  expect(() => initialQuotaInput(values("", "", ""))).toThrow(); expect(() => initialQuotaInput(values("unset", "", ""))).toThrow();
  expect(initialQuotaInput(values("monitor", "", ""))).toEqual({mode:"monitor",contentItemsLimit:null,mediaBytesLimit:null});
  expect(initialQuotaInput(values("enforced", "0", ""))).toEqual({mode:"enforced",contentItemsLimit:0,mediaBytesLimit:null});
});
