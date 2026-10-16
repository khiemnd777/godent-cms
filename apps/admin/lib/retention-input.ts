import { leadText } from "./lead-input";

/** Start-of-request timing deliberately expires early when a response is slow. */
export function deadlineFromResponse(serverTime: string, validUntil: string | null, requestStarted: number) {
  if (!Number.isFinite(Date.parse(serverTime))) return requestStarted;
  if (validUntil === null) return Infinity;
  const remaining = Date.parse(validUntil) - Date.parse(serverTime);
  return Number.isFinite(remaining) ? requestStarted + Math.max(0, remaining) : requestStarted;
}
export function isCurrentResponse(deadline: number, now = Date.now()) { return deadline > now; }
export function extensionInput(reason: string, localExpiry: string, currentExpiry: string, now = Date.now()) {
  const text = leadText(reason); const expiry = new Date(localExpiry); const current = Date.parse(currentExpiry);
  if (!Number.isFinite(current) || current <= now) throw new Error("Yêu cầu đã hết thời hạn truy cập. Không thể gia hạn.");
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Math.max(now, current)) throw new Error("Chọn thời hạn mới sau thời hạn lưu hiện tại.");
  return { reason: text, expiresAt: expiry.toISOString() };
}
