import { M4_ROUTES, type M4FormContext, type M4IntakeInput, type M4Locale } from "../../api/src/contracts/m4";
import { normalizeM4Intake } from "../../api/src/contracts/m4-validation";
import { intakeSlug } from "../../api/src/contracts/intake";
import type { IntakeChallenge, IntakeInput } from "../../api/src/contracts/s04";
import { IntakeFailure, publicRequest, type ConsultationValues } from "./consultation";
export type BuilderConsultationValues = ConsultationValues & { interestServiceSlug: string };
export type BuilderAttempt = Readonly<M4IntakeInput>;
export function createBuilderAttempt(values: BuilderConsultationValues, context: M4FormContext, tracking?: M4IntakeInput["tracking"]): BuilderAttempt {
  const { locationId, interestServiceSlug, ...contact } = values;
  if (locationId && !context.locationOptions.some(option => option.id === locationId)) throw new Error("Invalid location");
  if (interestServiceSlug && !context.serviceOptions.some(option => option.slug === interestServiceSlug)) throw new Error("Invalid service");
  const parsed = normalizeM4Intake({ ...contact, requestKey: crypto.randomUUID(), sourcePublicationId: context.sourcePublicationId, sourceConfigPublicationId: context.sourceConfigPublicationId, formLocale: context.formLocale, ...(locationId ? { locationId } : {}), ...(interestServiceSlug ? { interestServiceSlug } : {}), ...(tracking && Object.keys(tracking).length ? { tracking } : {}) });
  if (parsed.tracking) Object.freeze(parsed.tracking); return Object.freeze(parsed);
}
function route(tenant: string, locale: M4Locale, kind: "service" | "landing", slug: string, challenge = false) { intakeSlug(tenant); intakeSlug(slug); return challenge ? M4_ROUTES.challenge(tenant, locale, kind, slug) : M4_ROUTES.intake(tenant, locale, kind, slug); }
export async function sendBuilderAttempt(tenant: string, slug: string, context: M4FormContext, attempt: BuilderAttempt, challenge?: IntakeInput["challenge"]) {
  const value = await publicRequest(route(tenant, context.formLocale, context.sourceType, slug), challenge ? { ...attempt, challenge } : attempt);
  if (!value || typeof value !== "object" || Object.keys(value).length !== 1 || !("status" in value) || value.status !== "accepted") throw new IntakeFailure(0, undefined, true);
  return { status: "accepted" } as const;
}
export async function requestBuilderChallenge(tenant: string, slug: string, context: M4FormContext, requestKey: string): Promise<IntakeChallenge> {
  try {
    const value = await publicRequest(route(tenant, context.formLocale, context.sourceType, slug, true), { requestKey }) as IntakeChallenge;
    if (!value || Object.keys(value).some(key => !["token", "prompt", "expiresAt", "kind"].includes(key)) || value.kind !== "local-arithmetic" || !/^[a-f0-9-]{36}$/.test(value.token) || typeof value.prompt !== "string" || value.prompt.length > 100 || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) throw new Error();
    return value;
  } catch { throw new IntakeFailure(503, "CAPTCHA_UNAVAILABLE", false); }
}
export function builderIntakeError(error: IntakeFailure, locale: M4Locale): string {
  if (error.uncertain) return locale === "en" ? "The request result is not confirmed. Your details remain here. Retry the same request to check without creating a new request." : "Chưa xác định yêu cầu đã được tiếp nhận hay chưa. Thông tin được giữ tại đây. Hãy thử lại cùng yêu cầu để kiểm tra.";
  const messages = {
    SOURCE_UNAVAILABLE: ["Trang hoặc chương trình hiện không nhận yêu cầu mới. Thông tin của bạn vẫn được giữ tại đây.", "This page or promotion is not accepting new requests. Your details remain here."],
    RATE_LIMITED: ["Có quá nhiều yêu cầu. Vui lòng chờ trước khi thử lại.", "There are too many requests. Please wait before trying again."],
    REQUEST_CONFLICT: ["Yêu cầu có xung đột. Thông tin được giữ lại. Vui lòng liên hệ phòng khám để được hỗ trợ.", "This request has a conflict. Your details are retained. Please contact the clinic for help."],
    CAPTCHA_INVALID: ["Câu trả lời xác minh không đúng hoặc đã hết hạn. Vui lòng xác minh lại.", "The verification answer is incorrect or expired. Please verify again."],
    CAPTCHA_UNAVAILABLE: ["Chưa thể tải bước xác minh. Vui lòng thử lại sau.", "Verification is temporarily unavailable. Please try again later."],
    INVALID_INPUT: ["Vui lòng kiểm tra thông tin liên hệ và lựa chọn trong biểu mẫu.", "Please check your contact details and form choices."],
    CAPTCHA_REQUIRED: ["Vui lòng hoàn tất bước xác minh.", "Please complete verification."],
  };
  return (error.code ? messages[error.code] : undefined)?.[locale === "en" ? 1 : 0] ?? (locale === "en" ? "The request could not be sent. Please check your details and retry." : "Chưa gửi được yêu cầu. Vui lòng kiểm tra thông tin và thử lại.");
}
