import { describe, expect, it } from "bun:test";
import { leadQuery, leadText, queryParameters } from "./lead-input";

describe("lead input boundaries", () => {
  it("normalizes text in NFC and counts code points while retaining literal markup", () => {
    expect(leadText("  <b>a\u0301</b>  ")).toBe("<b>á</b>");
    expect(leadText("😀".repeat(2000))).toHaveLength(4000);
    expect(() => leadText("😀".repeat(2001))).toThrow();
    expect(() => leadText("\u0000private")).toThrow();
  });
  it("bounds name search without discarding accents or literal wildcard characters", () => {
    expect(leadQuery({ q: "  A\u0301_% ", status: "assigned", assignee: "me", from: "", to: "", pageSize: 20 }).q).toBe("Á_%");
    expect(() => leadQuery({ q: "a", status: "", assignee: "", from: "", to: "", pageSize: 20 })).toThrow();
    expect(() => leadQuery({ q: "x".repeat(81), status: "", assignee: "", from: "", to: "", pageSize: 20 })).toThrow();
  });
  it("rejects an inverted date range and impossible calendar dates", () => {
    expect(() => leadQuery({ q: "", status: "", assignee: "", from: "2026-10-17", to: "2026-10-16", pageSize: 20 })).toThrow();
    expect(() => leadQuery({ q: "", status: "", assignee: "", from: "2026-02-30", to: "", pageSize: 20 })).toThrow();
  });
  it("binds list paging to the applied filters and omits pagination for count", () => {
    const query = leadQuery({ q: "YC-000001", status: "new", assignee: "unassigned", from: "2026-10-01", to: "2026-10-16", pageSize: 50 });
    const list = new URLSearchParams(queryParameters(query, "cursor-one"));
    expect(list.get("pageSize")).toBe("50"); expect(list.get("cursor")).toBe("cursor-one"); expect(list.get("q")).toBe("YC-000001");
    const count = new URLSearchParams(queryParameters(query, undefined, true));
    expect(count.has("pageSize")).toBe(false); expect(count.has("cursor")).toBe(false); expect(count.get("from")).toBe("2026-10-01");
  });
});
