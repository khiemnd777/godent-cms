"use client";
import { useRef, useState } from "react";
import type { M4FormContext, M4IntakeInput } from "../../api/src/contracts/m4";
import type { IntakeChallenge } from "../../api/src/contracts/s04";
import { codePointLength } from "../../api/src/contracts/intake";
import { IntakeFailure } from "../lib/consultation";
import { builderIntakeError, createBuilderAttempt, requestBuilderChallenge, sendBuilderAttempt, type BuilderAttempt, type BuilderConsultationValues } from "../lib/builder-consultation";
import { FullConsultationFields } from "./full-consultation-fields";
import { CompactConsultationFields } from "./compact-consultation-fields";

export function BuilderConsultationForm({ tenant, slug, context, title, tracking, compact = false, instanceId }: { tenant: string; slug: string; context: M4FormContext; title?: string; tracking?: M4IntakeInput["tracking"]; compact?: boolean; instanceId?: string }) {
  const en = context.formLocale === "en", t = (vi: string, english: string) => en ? english : vi;
  const initial: BuilderConsultationValues = { name: "", phone: "", email: "", preferredLanguage: context.formLocale, preferredChannel: "phone", message: "", consent: false, interestServiceSlug: "" };
  const [values, setValues] = useState(initial), [attempt, setAttempt] = useState<BuilderAttempt | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [accepted, setAccepted] = useState(false), [challenge, setChallenge] = useState<IntakeChallenge | null>(null), [needsChallenge, setNeedsChallenge] = useState(false), [answer, setAnswer] = useState("");
  const feedback = useRef<HTMLDivElement>(null), verification = useRef<HTMLInputElement>(null), inFlight = useRef(false), formId = `consultation-${context.sourceId}${instanceId ? `-${instanceId}` : ""}`;
  const update = <K extends keyof BuilderConsultationValues>(key: K, value: BuilderConsultationValues[K]) => setValues(previous => ({ ...previous, [key]: value }));
  function showError(message: string) { setError(message); requestAnimationFrame(() => feedback.current?.focus()); }
  async function verify(current: BuilderAttempt) { setNeedsChallenge(true); setAnswer(""); setChallenge(null); try { setChallenge(await requestBuilderChallenge(tenant, slug, context, current.requestKey)); setError(""); requestAnimationFrame(() => verification.current?.focus()); } catch (failure) { showError(builderIntakeError(failure instanceof IntakeFailure ? failure : new IntakeFailure(503, "CAPTCHA_UNAVAILABLE", false), context.formLocale)); } }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    let current = attempt;
    if (!current) {
      if (!values.consent) { showError(t("Vui lòng đồng ý để phòng khám liên hệ theo yêu cầu này.", "Please give consent for the clinic to contact you about this request.")); return; }
      if (codePointLength(values.message.trim()) > 500) { showError(t("Lời nhắn tối đa 500 ký tự.", "The message can contain at most 500 characters.")); return; }
      try { current = createBuilderAttempt(values, context, tracking); } catch { showError(t("Cần số điện thoại hợp lệ (7–15 chữ số) hoặc email hợp lệ. Kênh liên hệ phải có thông tin tương ứng. Họ tên tối đa 120 ký tự.", "Enter a valid phone number (7–15 digits) or email. Supply the details for your chosen contact channel. Names can contain at most 120 characters.")); return; }
      setAttempt(current);
    }
    if (needsChallenge && (!challenge || !/^\d{1,3}$/.test(answer))) { showError(t("Vui lòng hoàn tất bước xác minh.", "Please complete verification.")); return; }
    inFlight.current = true; setBusy(true); setError("");
    try { await sendBuilderAttempt(tenant, slug, context, current, challenge ? { token: challenge.token, answer } : undefined); setValues(initial); setAttempt(null); setChallenge(null); setAnswer(""); setNeedsChallenge(false); setAccepted(true); requestAnimationFrame(() => feedback.current?.focus()); }
    catch (cause) { const failure = cause instanceof IntakeFailure ? cause : new IntakeFailure(0, undefined, true); if (failure.code === "CAPTCHA_REQUIRED" || failure.code === "CAPTCHA_INVALID") { await verify(current); if (failure.code === "CAPTCHA_INVALID") showError(builderIntakeError(failure, context.formLocale)); } else showError(builderIntakeError(failure, context.formLocale)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className={`consultation${compact ? " consultation-compact" : ""}`} aria-labelledby={`${formId}-title`}>
    <p className="eyebrow">{t("Liên hệ phòng khám", "Contact the clinic")}</p><h2 id={`${formId}-title`}>{title || t("Gửi yêu cầu tư vấn", "Request a consultation")}</h2>
    <p>{t("Để lại thông tin để phòng khám liên hệ. Yêu cầu này không phải lịch hẹn đã được xác nhận.", "Leave your details so the clinic can contact you. This request does not confirm an appointment.")}</p>
    {accepted ? <div className="consultation-feedback success" role="status" ref={feedback} tabIndex={-1}><h3>{t("Đã tiếp nhận yêu cầu tư vấn", "Consultation request received")}</h3><p>{t("Phòng khám sẽ liên hệ theo thông tin bạn cung cấp. Lịch hẹn chưa được xác nhận.", "The clinic will contact you using the details you provided. An appointment is not confirmed.")}</p><button type="button" onClick={() => setAccepted(false)}>{t("Gửi yêu cầu khác", "Send another request")}</button></div> : <form className={compact ? "compact-form" : undefined} onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
      {compact ? <CompactConsultationFields locale={context.formLocale} formId={formId} values={values} disabled={busy || !!attempt} consent={context.consent.copy} services={context.serviceOptions} locations={context.locationOptions} onChange={update}/> : <FullConsultationFields locale={context.formLocale} formId={formId} values={values} disabled={busy || !!attempt} consent={context.consent.copy} services={context.serviceOptions} locations={context.locationOptions} onChange={update}/>}
      {attempt && <p className="consultation-help">{t("Thông tin và mã yêu cầu được giữ nguyên để thử lại. Giữ trang này mở đến khi có kết quả xác nhận.", "Your details and request key are fixed for retries. Keep this page open until the result is confirmed.")}</p>}
      {needsChallenge && <div className="consultation-verification" aria-live="polite"><h3>{t("Xác minh yêu cầu", "Verify the request")}</h3>{challenge ? <label>{challenge.prompt}<input ref={verification} inputMode="numeric" autoComplete="off" value={answer} disabled={busy} onChange={event => setAnswer(event.target.value)}/></label> : <p>{t("Chưa tải được câu hỏi xác minh.", "The verification question is unavailable.")}</p>}<button type="button" disabled={busy} onClick={() => { if (attempt) { setBusy(true); void verify(attempt).finally(() => setBusy(false)); } }}>{t("Tải câu hỏi mới", "Get a new question")}</button></div>}
      {error && <div className="consultation-feedback error" role="alert" ref={feedback} tabIndex={-1}>{error}</div>}
      <div className="consultation-actions"><button className="consultation-submit" type="submit" disabled={busy}>{busy ? t("Đang gửi yêu cầu…", "Sending request…") : attempt ? t("Thử lại cùng yêu cầu", "Retry the same request") : t("Gửi yêu cầu tư vấn", "Send consultation request")}</button>{busy && <span role="status">{t("Đang chờ xác nhận tiếp nhận.", "Waiting for confirmation.")}</span>}</div>
      <noscript>{t("Bạn cần bật JavaScript để gửi yêu cầu tư vấn.", "Enable JavaScript to send a consultation request.")}</noscript>
    </form>}
  </section>;
}
