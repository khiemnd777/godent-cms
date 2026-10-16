import { describe, expect, it } from "bun:test";
import { publicPath, redirectQuery } from "./public-url-context";
import { ids } from "../test-support/builder";

describe("entry-aware URL projection", () => {
  it("keeps the Godent prefix and uses the custom site root", () => {
    expect(publicPath("clinic-a", "en", "service", "care")).toBe("/clinic-a/en/dich-vu/care");
    expect(publicPath("clinic-a", "en", "service", "care", { origin: "http://clinic-a.test:5892", basePath: "" })).toBe("/en/dich-vu/care");
    expect(publicPath("clinic-a", "vi", "home", undefined, { origin: "http://clinic-a.test:5892", basePath: "" })).toBe("/");
  });
  it("retains registered functional queries for same-language migration", () => {
    const query = new URLSearchParams(`q=care&cursor=VI_PAGE&referenceKind=service&referenceId=${ids.resource}&utm_source=search&private=no&redirect=https://evil.test`);
    expect(redirectQuery("http://clinic-a.test:5892/dich-vu", query, false, true)).toBe(`http://clinic-a.test:5892/dich-vu?q=care&cursor=VI_PAGE&referenceKind=service&referenceId=${ids.resource}&utm_source=search`);
    expect(redirectQuery("http://clinic-a.test:5892/dich-vu", query, true, true)).not.toContain("cursor");
  });
  it("rejects ambiguous functional queries and excludes private parameters", () => {
    expect(() => redirectQuery("http://clinic-a.test:5892/dich-vu", new URLSearchParams("q=a&q=b"), false, true)).toThrow();
    expect(redirectQuery("http://clinic-a.test:5892/care", new URLSearchParams("phone=secret&utm_source=x&utm_source=y&cursor=bad!"), false, false)).toBe("http://clinic-a.test:5892/care");
  });
});
