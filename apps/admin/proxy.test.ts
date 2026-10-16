import { expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
it("admin rejects host aliases and keeps private document responses out of caches", () => {
  expect(proxy(new NextRequest("http://localhost:5891/cms", { headers: { host: "localhost:5891" } })).status).toBe(421);
  const response = proxy(new NextRequest("http://127.0.0.1:5891/cms", { headers: { host: "127.0.0.1:5891" } }));
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
