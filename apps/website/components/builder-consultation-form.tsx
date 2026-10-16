"use client";
import { useRef, useState } from "react";
import type { M4FormContext, M4IntakeInput } from "../../api/src/contracts/m4";
import type { IntakeChallenge } from "../../api/src/contracts/s04";
import { codePointLength } from "../../api/src/contracts/intake";
import { IntakeFailure } from "../lib/consultation";
import { builderIntakeError, createBuilderAttempt, requestBuilderChallenge, sendBuilderAttempt, type BuilderAttempt, type BuilderConsultationValues } from "../lib/builder-consultation";

export function BuilderConsultationForm({ tenant, slug, context, title, tracking }: { tenant: string; slug: string; context: M4FormContext; title?: string; tracking?: M4IntakeInput["tracking"] }) {
  const en = context.formLocale === "en", t = (vi: string, english: string) => en ? english : vi;
  const initial: BuilderConsultationValues = { name: "", phone: "", email: "", preferredLanguage: context.formLocale, preferredChannel: "phone", message: "", consent: false, interestServiceSlug: "" };
  const [values, setValues] = useState(initial), [attempt, setAttempt] = useState<BuilderAttempt | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [accepted, setAccepted] = useState(false), [challenge, setChallenge] = useState<IntakeChallenge | null>(null), [needsChallenge, setNeedsChallenge] = useState(false), [answer, setAnswer] = useState("");
  const feedback = useRef<HTMLDivElement>(null), verification = useRef<HTMLInputElement>(null), inFlight = useRef(false), formId = `consultation-${context.sourceId}`;
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
  return <section className="consultation" aria-labelledby={`${formId}-title`}>
    <p className="eyebrow">{t("Liên hệ phòng khám", "Contact the clinic")}</p><h2 id={`${formId}-title`}>{title || t("Gửi yêu cầu tư vấn", "Request a consultation")}</h2>
    <p>{t("Để lại thông tin để phòng khám liên hệ. Yêu cầu này không phải lịch hẹn đã được xác nhận.", "Leave your details so the clinic can contact you. This request does not confirm an appointment.")}</p>
    {accepted ? <div className="consultation-feedback success" role="status" ref={feedback} tabIndex={-1}><h3>{t("Đã tiếp nhận yêu cầu tư vấn", "Consultation request received")}</h3><p>{t("Phòng khám sẽ liên hệ theo thông tin bạn cung cấp. Lịch hẹn chưa được xác nhận.", "The clinic will contact you using the details you provided. An appointment is not confirmed.")}</p><button type="button" onClick={() => setAccepted(false)}>{t("Gửi yêu cầu khác", "Send another request")}</button></div> : <form onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
      <fieldset disabled={busy || !!attempt}><legend className="visually-hidden">{t("Thông tin liên hệ", "Contact details")}</legend><div className="consultation-grid">
        <label>{t("Họ tên (không bắt buộc)", "Name (optional)")}<input autoComplete="name" value={values.name} onChange={event => update("name", event.target.value)}/></label>
        <label>{t("Số điện thoại", "Phone")}<input type="tel" inputMode="tel" autoComplete="tel" value={values.phone} aria-describedby={`${formId}-contact-help`} onChange={event => update("phone", event.target.value)}/></label>
        <label>Email<input type="email" autoComplete="email" value={values.email} aria-describedby={`${formId}-contact-help`} onChange={event => update("email", event.target.value)}/></label>
        <label>{t("Ngôn ngữ tư vấn", "Preferred contact language")}<select value={values.preferredLanguage} onChange={event => update("preferredLanguage", event.target.value as "vi" | "en")}><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label>
        <label>{t("Kênh liên hệ", "Contact channel")}<select value={values.preferredChannel} onChange={event => update("preferredChannel", event.target.value as "phone" | "email")}><option value="phone">{t("Điện thoại", "Phone")}</option><option value="email">Email</option></select></label>
        {context.serviceOptions.length > 0 && <label>{t("Dịch vụ quan tâm (không bắt buộc)", "Service of interest (optional)")}<select value={values.interestServiceSlug} onChange={event => update("interestServiceSlug", event.target.value)}><option value="">{t("Chưa chọn dịch vụ", "No service selected")}</option>{context.serviceOptions.map(option => <option key={option.publicationId} value={option.slug}>{option.title}</option>)}</select></label>}
        {context.locationOptions.length > 0 && <label>{t("Cơ sở quan tâm (không bắt buộc)", "Location of interest (optional)")}<select value={values.locationId ?? ""} onChange={event => update("locationId", event.target.value)}><option value="">{t("Chưa chọn cơ sở", "No location selected")}</option>{context.locationOptions.map(option => <option key={option.publicationId} value={option.id}>{option.title}</option>)}</select></label>}
      </div><p id={`${formId}-contact-help`} className="consultation-help">{t("Cần số điện thoại hoặc email. Kênh liên hệ đã chọn phải có thông tin tương ứng. Cơ sở chỉ giúp phòng khám hiểu yêu cầu, không phải đặt lịch hoặc phân tuyến.", "Provide a phone number or email for your chosen contact channel. A location choice only describes your interest; it does not book an appointment or route your request to a branch.")}</p>
      <label>{t("Lời nhắn (không bắt buộc)", "Message (optional)")}<textarea rows={4} value={values.message} aria-describedby={`${formId}-message-help`} aria-invalid={codePointLength(values.message.trim()) > 500 || undefined} onChange={event => update("message", event.target.value)}/></label><div className="consultation-message-help"><p id={`${formId}-message-help`} className="consultation-help">{t("Tối đa 500 ký tự. Không gửi hồ sơ sức khỏe hoặc bệnh án.", "At most 500 characters. Do not send health records or medical history.")}</p><span className={codePointLength(values.message.trim()) > 500 ? "invalid-count" : ""}>{codePointLength(values.message.trim())}/500</span></div>
      <label className="consultation-consent"><input type="checkbox" checked={values.consent} onChange={event => update("consent", event.target.checked)}/><span>{context.consent.copy}</span></label></fieldset>
      {attempt && <p className="consultation-help">{t("Thông tin và mã yêu cầu được giữ nguyên để thử lại. Giữ trang này mở đến khi có kết quả xác nhận.", "Your details and request key are fixed for retries. Keep this page open until the result is confirmed.")}</p>}
      {needsChallenge && <div className="consultation-verification" aria-live="polite"><h3>{t("Xác minh yêu cầu", "Verify the request")}</h3>{challenge ? <label>{challenge.prompt}<input ref={verification} inputMode="numeric" autoComplete="off" value={answer} disabled={busy} onChange={event => setAnswer(event.target.value)}/></label> : <p>{t("Chưa tải được câu hỏi xác minh.", "The verification question is unavailable.")}</p>}<button type="button" disabled={busy} onClick={() => { if (attempt) { setBusy(true); void verify(attempt).finally(() => setBusy(false)); } }}>{t("Tải câu hỏi mới", "Get a new question")}</button></div>}
      {error && <div className="consultation-feedback error" role="alert" ref={feedback} tabIndex={-1}>{error}</div>}
      <div className="consultation-actions"><button className="consultation-submit" type="submit" disabled={busy}>{busy ? t("Đang gửi yêu cầu…", "Sending request…") : attempt ? t("Thử lại cùng yêu cầu", "Retry the same request") : t("Gửi yêu cầu tư vấn", "Send consultation request")}</button>{busy && <span role="status">{t("Đang chờ xác nhận tiếp nhận.", "Waiting for confirmation.")}</span>}</div>
      <noscript>{t("Bạn cần bật JavaScript để gửi yêu cầu tư vấn.", "Enable JavaScript to send a consultation request.")}</noscript>
    </form>}
  </section>;
}
