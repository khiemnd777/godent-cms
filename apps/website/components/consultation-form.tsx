"use client";
import { useRef, useState } from "react";
import { codePointLength } from "../../api/src/contracts/intake";
import { S04_CONSENT_COPY, S04_LIMITS, type IntakeChallenge } from "../../api/src/contracts/s04";
import type { PublicServiceContentLinks } from "../../api/src/contracts/m3";
import { createAttempt, IntakeFailure, intakeErrorText, requestChallenge, sendAttempt, type ConsultationValues, type SubmissionAttempt } from "../lib/consultation";

const initialValues: ConsultationValues = { name: "", phone: "", email: "", preferredLanguage: "vi", preferredChannel: "phone", message: "", consent: false };
export function ConsultationForm({ tenantSlug, serviceSlug, publicationId, locations = [] }: { tenantSlug: string; serviceSlug: string; publicationId: string; locations?: PublicServiceContentLinks["locations"] }) {
  const [values, setValues] = useState(initialValues);
  const [attempt, setAttempt] = useState<SubmissionAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [challenge, setChallenge] = useState<IntakeChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [needsChallenge, setNeedsChallenge] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const update = <K extends keyof ConsultationValues>(key: K, value: ConsultationValues[K]) => setValues(previous => ({ ...previous, [key]: value }));
  function showError(message: string) { setError(message); requestAnimationFrame(() => feedback.current?.focus()); }
  async function loadChallenge(current: SubmissionAttempt) {
    setNeedsChallenge(true); setAnswer(""); setChallenge(null);
    try { setChallenge(await requestChallenge(tenantSlug, serviceSlug, current.requestKey)); setError(""); }
    catch (error) { showError(intakeErrorText(error instanceof IntakeFailure ? error : new IntakeFailure(503, "CAPTCHA_UNAVAILABLE", false))); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    let current = attempt;
    if (!current) {
      if (!values.consent) { showError("Vui lòng đồng ý để phòng khám liên hệ theo yêu cầu của bạn."); return; }
      if (codePointLength(values.message.trim()) > S04_LIMITS.message) { showError("Lời nhắn tối đa 500 ký tự. Vui lòng rút ngắn lời nhắn."); return; }
      try { current = createAttempt(values, publicationId); }
      catch { showError("Vui lòng kiểm tra thông tin. Cần ít nhất số điện thoại hợp lệ (7–15 chữ số) hoặc email hợp lệ. Kênh liên hệ đã chọn phải có thông tin tương ứng. Họ tên tối đa 120 ký tự."); return; }
      setAttempt(current);
    }
    if (needsChallenge && (!challenge || !/^\d{1,3}$/.test(answer))) { showError("Vui lòng hoàn tất bước xác minh trước khi gửi."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      await sendAttempt(tenantSlug, serviceSlug, current, challenge ? { token: challenge.token, answer } : undefined);
      setValues(initialValues); setAttempt(null); setChallenge(null); setAnswer(""); setNeedsChallenge(false); setAccepted(true);
      requestAnimationFrame(() => feedback.current?.focus());
    } catch (error) {
      const failure = error instanceof IntakeFailure ? error : new IntakeFailure(0, undefined, true);
      if (failure.code === "CAPTCHA_REQUIRED" || failure.code === "CAPTCHA_INVALID") { await loadChallenge(current); if (failure.code === "CAPTCHA_INVALID") showError(intakeErrorText(failure)); }
      else showError(intakeErrorText(failure));
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="consultation" aria-labelledby="consultation-title">
    <p className="eyebrow">Liên hệ phòng khám</p><h2 id="consultation-title">Gửi yêu cầu tư vấn</h2>
    <p>Để lại thông tin để phòng khám liên hệ với bạn. Yêu cầu này không phải là lịch hẹn đã được xác nhận.</p>
    {accepted ? <div className="consultation-feedback success" role="status" ref={feedback} tabIndex={-1}><h3>Đã tiếp nhận yêu cầu tư vấn</h3><p>Phòng khám sẽ liên hệ theo thông tin bạn đã cung cấp. Lịch hẹn chưa được xác nhận.</p><button type="button" onClick={() => setAccepted(false)}>Gửi yêu cầu khác</button></div> : <form onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
      <fieldset disabled={busy || !!attempt}><legend className="visually-hidden">Thông tin liên hệ</legend><div className="consultation-grid">
        <label>Họ tên <span>(không bắt buộc)</span><input autoComplete="name" value={values.name} onChange={event => update("name", event.target.value)} /></label>
        <label>Số điện thoại<input type="tel" inputMode="tel" autoComplete="tel" value={values.phone} aria-describedby="contact-help" onChange={event => update("phone", event.target.value)} /></label>
        <label>Email<input type="email" autoComplete="email" value={values.email} aria-describedby="contact-help" onChange={event => update("email", event.target.value)} /></label>
        <label>Ngôn ngữ tư vấn<select value={values.preferredLanguage} onChange={event => update("preferredLanguage", event.target.value as "vi" | "en")}><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label>
        <label>Kênh liên hệ<select value={values.preferredChannel} onChange={event => update("preferredChannel", event.target.value as "phone" | "email")}><option value="phone">Điện thoại</option><option value="email">Email</option></select></label>
        {locations.length > 0 && <label>Cơ sở quan tâm <span>(không bắt buộc)</span><select value={values.locationId ?? ""} aria-describedby="location-help" onChange={event => update("locationId", event.target.value)}><option value="">Chưa chọn cơ sở</option>{locations.map(location => <option key={location.id} value={location.id}>{location.name} — {location.address}</option>)}</select></label>}
      </div><p id="contact-help" className="consultation-help">Cần số điện thoại hoặc email. Nếu chọn điện thoại, hãy điền số điện thoại; nếu chọn email, hãy điền email. Số điện thoại gồm 7–15 chữ số.</p>
      {locations.length > 0 && <p id="location-help" className="consultation-help">Chỉ hiển thị cơ sở được công bố cho dịch vụ này. Lựa chọn giúp phòng khám hiểu yêu cầu tư vấn; đây chưa phải lịch hẹn.</p>}
      <label>Lời nhắn <span>(không bắt buộc)</span><textarea rows={4} value={values.message} aria-describedby="message-help message-count" aria-invalid={codePointLength(values.message.trim()) > S04_LIMITS.message || undefined} onChange={event => update("message", event.target.value)} /></label><div className="consultation-message-help"><p id="message-help" className="consultation-help">Tối đa 500 ký tự. Vui lòng không gửi hồ sơ sức khỏe hoặc thông tin bệnh án.</p><span id="message-count" className={codePointLength(values.message.trim()) > S04_LIMITS.message ? "invalid-count" : ""}>{codePointLength(values.message.trim())}/500</span></div>
      <label className="consultation-consent"><input type="checkbox" checked={values.consent} onChange={event => update("consent", event.target.checked)} /><span>{S04_CONSENT_COPY}</span></label></fieldset>
      {attempt && <p className="consultation-help">Thông tin được giữ nguyên để thử lại cùng yêu cầu. Giữ trang này mở cho đến khi có kết quả xác nhận.</p>}
      {needsChallenge && <div className="consultation-verification" aria-live="polite"><h3>Xác minh yêu cầu</h3>{challenge ? <label>{challenge.prompt}<input inputMode="numeric" autoComplete="off" value={answer} disabled={busy} onChange={event => setAnswer(event.target.value)} /></label> : <p>Chưa tải được câu hỏi xác minh.</p>}<button type="button" disabled={busy} onClick={() => { if (attempt) { setBusy(true); void loadChallenge(attempt).finally(() => setBusy(false)); } }}>Tải câu hỏi mới</button></div>}
      {error && <div className="consultation-feedback error" role="alert" ref={feedback} tabIndex={-1}>{error}</div>}
      <div className="consultation-actions"><button className="consultation-submit" type="submit" disabled={busy}>{busy ? "Đang gửi yêu cầu…" : attempt ? "Thử lại cùng yêu cầu" : "Gửi yêu cầu tư vấn"}</button>{busy && <span role="status">Đang chờ xác nhận tiếp nhận.</span>}</div>
      <noscript>Bạn cần bật JavaScript để gửi yêu cầu tư vấn.</noscript>
    </form>}
  </section>;
}
