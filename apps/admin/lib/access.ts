import type { S05ErrorCode } from "../../api/src/contracts/s05";
export type Membership = { tenantId: string; tenantName: string; role: "tenant_admin" };
export type CurrentSession = {
  user: { id: string; name: string; email: string; emailVerified: boolean };
  session: { expiresAt: string };
  platformAdmin: boolean;
  tenantMemberships: Membership[];
  csrfToken: string;
};
export type ServiceDraft = { id: string; tenantId: string; title: string; body: string; locale: "vi"; version: number; updatedAt: string };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type TenantSummary = { id: string; name: string; status: "active" | "suspended"; createdAt: string };
export type MemberSummary = { userId: string; name: string; email: string; role: "tenant_admin"; status: "active" | "revoked" };
export type InvitationSummary = { id: string; email: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null };

export const ADMIN_ORIGIN = "http://127.0.0.1:5891";
export function apiUrl(path: string) {
  if (!path.startsWith("/api/") || /[\\\s]/.test(path) || path.split("/").includes("..")) throw new Error("Invalid API path");
  const url = new URL(path, "http://127.0.0.1:5890");
  if (url.origin !== "http://127.0.0.1:5890" || !url.pathname.startsWith("/api/")) throw new Error("Invalid API destination");
  return url.href;
}
export function tenantContext(id: string | null, memberships: Membership[]) {
  return memberships.find(member => member.tenantId === id) ?? null;
}
export function tenantHref(path: string, tenantId: string | null) {
  return tenantId ? `${path}?${new URLSearchParams({ tenant: tenantId })}` : path;
}
export function tenantApi(tenantId: string, suffix = "") {
  return `/api/tenants/${encodeURIComponent(tenantId)}${suffix}`;
}
export class ApiError extends Error {
  constructor(public status: number, public code?: S05ErrorCode) { super(`API request failed (${status})`); }
}
const allowedErrorCodes: readonly S05ErrorCode[] = ["REAUTH_REQUIRED", "INVALID_INPUT", "VERSION_CONFLICT", "OPERATION_CONFLICT", "INVALID_TRANSITION", "ASSIGNEE_UNAVAILABLE", "RECIPIENT_UNAVAILABLE", "LEAD_UNAVAILABLE"];
export function errorText(error: unknown) {
  if (!(error instanceof ApiError)) return "Không thể kết nối. Kiểm tra kết nối và thử lại.";
  if (error.status === 401) return "Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.";
  if (error.status === 403) return "Không được phép thực hiện. Kiểm tra quyền truy cập hoặc xác thực lại tài khoản.";
  if (error.status === 404) return "Không tìm thấy nội dung hoặc bạn không có quyền truy cập.";
  if (error.status === 409) return "Thao tác có xung đột. Dữ liệu có thể đã thay đổi hoặc không còn đáp ứng điều kiện.";
  if (error.status === 429) return "Có quá nhiều yêu cầu. Vui lòng thử lại sau.";
  return "Yêu cầu chưa hoàn tất. Kiểm tra thông tin rồi thử lại.";
}
export async function apiRequest<T>(path: string, options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; csrf?: string; signal?: AbortSignal; sessionCheck?: boolean } = {}): Promise<T> {
  const multipart = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(apiUrl(path), {
    method: options.method ?? "GET", credentials: "include", cache: "no-store", redirect: "error",
    headers: { Accept: "application/json", ...(options.method && options.method !== "GET" && !multipart ? { "Content-Type": "application/json" } : {}), ...(options.csrf ? { "X-CSRF-Token": options.csrf } : {}) },
    ...(options.body !== undefined ? { body: multipart ? options.body as FormData : JSON.stringify(options.body) } : {}), signal: options.signal,
  });
  if (!response.ok) {
    let code: S05ErrorCode | undefined;
    try { const payload: unknown = await response.json(); if (payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string" && allowedErrorCodes.includes(payload.code as S05ErrorCode)) code = payload.code as S05ErrorCode; } catch { /* Server messages stay private; only allowlisted control codes cross this boundary. */ }
    if (response.status === 401 && !options.sessionCheck && typeof window !== "undefined" && !path.startsWith("/api/auth/")) window.dispatchEvent(new Event("godent:session-expired"));
    if (response.status === 403 && !options.sessionCheck && typeof window !== "undefined" && !path.startsWith("/api/auth/")) window.dispatchEvent(new Event("godent:access-changed"));
    throw new ApiError(response.status, code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
