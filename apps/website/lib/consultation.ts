import { normalizeIntakeInput } from "../../api/src/contracts/intake";
import { S04_ROUTES, type IntakeAcknowledgement, type IntakeChallenge, type IntakeErrorCode, type IntakeInput, type PreferredChannel, type PreferredLanguage } from "../../api/src/contracts/s04";

export type ConsultationValues = { name: string; phone: string; email: string; preferredLanguage: PreferredLanguage; preferredChannel: PreferredChannel; message: string; consent: boolean; locationId?: string };
export type SubmissionAttempt = Readonly<IntakeInput>;
export function createAttempt(values: ConsultationValues, sourcePublicationId: string): SubmissionAttempt {
  const { locationId, ...contact } = values;
  return Object.freeze(normalizeIntakeInput({ ...contact, ...(locationId ? { locationId } : {}), requestKey: crypto.randomUUID(), sourcePublicationId }));
}
export class IntakeFailure extends Error {
  constructor(public status: number, public code: IntakeErrorCode | undefined, public uncertain: boolean) {
    super("Consultation request has not been confirmed");
  }
}
const knownCodes: IntakeErrorCode[] = ["INVALID_INPUT", "SOURCE_UNAVAILABLE", "REQUEST_CONFLICT", "RATE_LIMITED", "CAPTCHA_REQUIRED", "CAPTCHA_INVALID", "CAPTCHA_UNAVAILABLE"];
export async function publicRequest(path: string, body: unknown): Promise<unknown> {
  try {
    const response = await fetch(`http://127.0.0.1:5890${path}`, { method: "POST", credentials: "omit", cache: "no-store", redirect: "error", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) {
      let code: IntakeErrorCode | undefined;
      try { const payload = await response.json(); if (knownCodes.includes(payload?.code)) code = payload.code; } catch { /* Do not expose diagnostic text. */ }
      throw new IntakeFailure(response.status, code, response.status >= 500 && code !== "CAPTCHA_UNAVAILABLE");
    }
    return await response.json();
  } catch (error) {
    if (error instanceof IntakeFailure) throw error;
    throw new IntakeFailure(0, undefined, true);
  }
}
export async function sendAttempt(tenantSlug: string, serviceSlug: string, attempt: SubmissionAttempt, challenge?: IntakeInput["challenge"]): Promise<IntakeAcknowledgement> {
  const value = await publicRequest(S04_ROUTES.intake(tenantSlug, serviceSlug), challenge ? { ...attempt, challenge } : attempt);
  if (!value || typeof value !== "object" || Object.keys(value).length !== 1 || !("status" in value) || value.status !== "accepted") throw new IntakeFailure(0, undefined, true);
  return { status: "accepted" };
}
export async function requestChallenge(tenantSlug: string, serviceSlug: string, requestKey: string): Promise<IntakeChallenge> {
  let value: IntakeChallenge;
  try { value = await publicRequest(S04_ROUTES.challenge(tenantSlug, serviceSlug), { requestKey }) as IntakeChallenge; }
  catch { throw new IntakeFailure(503, "CAPTCHA_UNAVAILABLE", false); }
  if (!value || value.kind !== "local-arithmetic" || typeof value.token !== "string" || typeof value.prompt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) throw new IntakeFailure(503, "CAPTCHA_UNAVAILABLE", false);
  return value;
}
export function intakeErrorText(error: IntakeFailure) {
  if (error.uncertain) return "Chưa xác định được yêu cầu đã được tiếp nhận hay chưa. Thông tin vẫn được giữ tại đây. Bấm Thử lại để kiểm tra và gửi lại cùng yêu cầu.";
  if (error.code === "SOURCE_UNAVAILABLE") return "Trang dịch vụ hiện không nhận yêu cầu. Vui lòng thử lại sau.";
  if (error.code === "RATE_LIMITED") return "Có quá nhiều yêu cầu. Vui lòng chờ trước khi thử lại.";
  if (error.code === "REQUEST_CONFLICT") return "Yêu cầu có xung đột. Thông tin được giữ lại. Vui lòng liên hệ phòng khám nếu cần hỗ trợ.";
  if (error.code === "CAPTCHA_INVALID") return "Câu trả lời xác minh không đúng hoặc đã hết hạn. Vui lòng xác minh lại.";
  if (error.code === "CAPTCHA_UNAVAILABLE") return "Chưa thể tải bước xác minh. Vui lòng thử lại sau.";
  return "Chưa gửi được yêu cầu. Vui lòng kiểm tra thông tin và thử lại.";
}
