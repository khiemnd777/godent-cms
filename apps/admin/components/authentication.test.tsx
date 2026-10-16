import { afterEach, describe, expect, it, mock } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CurrentSession } from "../lib/access";

const passwordSession: CurrentSession = {
  user: { id: "admin-a", name: "Administrator A", email: "admin-a@example.invalid", emailVerified: true },
  session: { expiresAt: "2026-10-16T12:00:00.000Z" },
  platformAdmin: false,
  tenantMemberships: [{ tenantId: "tenant-a", tenantName: "Tenant A", role: "tenant_admin" }],
  csrfToken: "synthetic-csrf-token",
};
let current: CurrentSession | null = passwordSession;
mock.module("./session-provider", () => ({ useSession: () => ({ data: current, status: current ? "authenticated" : "anonymous" }) }));
const { PrivilegedGate } = await import("./privileged-gate");
const { ReauthForm } = await import("./reauth-form");
const { AccountSecurity } = await import("./account-security");
const privateContent = createElement("p", null, "Private tenant content");
afterEach(() => { current = passwordSession; });

describe("password-only access presentation", () => {
  it("opens an authenticated tenant session without factor fields", () => {
    expect(renderToStaticMarkup(<PrivilegedGate>{privateContent}</PrivilegedGate>)).toContain("Private tenant content");
  });
  it("keeps platform authorization independent from ordinary sign-in", () => {
    const denied = renderToStaticMarkup(<PrivilegedGate platform>{privateContent}</PrivilegedGate>);
    expect(denied).toContain("Không có quyền quản trị nền tảng");
    expect(denied).not.toContain("Private tenant content");
    current = { ...passwordSession, platformAdmin: true };
    expect(renderToStaticMarkup(<PrivilegedGate platform>{privateContent}</PrivilegedGate>)).toContain("Private tenant content");
  });
  it("does not show private children without a session", () => {
    current = null;
    const html = renderToStaticMarkup(<PrivilegedGate>{privateContent}</PrivilegedGate>);
    expect(html).toContain("Đăng nhập để tiếp tục");
    expect(html).not.toContain("Private tenant content");
  });
  it("uses only the current password even if stale extra factor flags are present", () => {
    current = { ...passwordSession, user: Object.assign({}, passwordSession.user, { twoFactorEnabled: true }) };
    const html = renderToStaticMarkup(createElement(ReauthForm));
    expect(html).toContain('name="password"');
    expect(html).toContain("5 phút");
    expect(html).not.toContain('name="code"');
    expect(html).not.toContain("Mã dự phòng");
  });
  it("keeps account identity, session expiry, reset and logout useful without enrollment", () => {
    const html = renderToStaticMarkup(createElement(AccountSecurity));
    expect(html).toContain("Administrator A");
    expect(html).toContain("admin-a@example.invalid");
    expect(html).toContain("Phiên đăng nhập");
    expect(html).toContain('dateTime="2026-10-16T12:00:00.000Z"');
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain("Đăng xuất");
    expect(html).not.toContain("Thiết lập ứng dụng xác thực");
  });
});
