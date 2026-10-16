import { M5_PLATFORM_ROUTES, parseM5Quota, type M5QuotaMode } from "../../api/src/contracts/m5-platform";

export const m5Route = (key: keyof typeof M5_PLATFORM_ROUTES, tenant: string) => M5_PLATFORM_ROUTES[key].replace(":tenant", encodeURIComponent(tenant));
export function quotaInput(values: FormData, expectedVersion: number, operationId: string) {
  const mode = String(values.get("mode")) as M5QuotaMode;
  const limit = (name: string) => { const raw = String(values.get(name) ?? "").trim(); if (!raw) return null; if (!/^\d+$/.test(raw)) throw new TypeError("Hạn mức phải là số nguyên từ 0."); return Number(raw); };
  return parseM5Quota({ operationId, expectedVersion, reason: String(values.get("reason") ?? "").trim(), policy: { mode, contentItemsLimit: mode === "unset" ? null : limit("contentItems"), mediaBytesLimit: mode === "unset" ? null : limit("mediaBytes") } });
}
export function deletionTime(value: string): string { const date = new Date(value); if (!value || !Number.isFinite(date.getTime())) throw new TypeError("Chọn thời điểm được phép thực hiện xóa."); return date.toISOString(); }
export function formatBytes(bytes: number): string { return `${new Intl.NumberFormat("vi-VN").format(bytes)} byte`; }

export function initialQuotaInput(values: FormData) {
  const data = new FormData(); for (const [key, value] of values.entries()) data.append(key, value);
  data.set("reason", "Explicit initial quota policy selection");
  const policy = quotaInput(data, 0, crypto.randomUUID()).policy;
  if (policy.mode === "unset") throw new TypeError("Choose an initial quota mode");
  return policy;
}
