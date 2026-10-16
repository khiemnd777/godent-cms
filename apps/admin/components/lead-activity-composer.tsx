"use client";
import { useEffect, useState } from "react";
import type { ContactOutcome, LeadCommand } from "../../api/src/contracts/s05";
import { leadText } from "../lib/lead-input";
import { contactOutcome } from "../lib/lead-presentation";
import { requestGuardedAction } from "./unsaved-changes";
type Activity = Extract<LeadCommand, { kind: "note" | "contact" }>;
type ActivityInput<T = Activity> = T extends Activity ? Omit<T, "expectedVersion" | "operationId"> : never;
export function LeadActivityComposer({ disabled, closed, onDirty, submit }: { disabled: boolean; closed: boolean; onDirty: (dirty: boolean) => void; submit: (input: ActivityInput) => void }) {
  const [kind, setKind] = useState<"note" | "contact">("note"); const [text, setText] = useState("");
  const [channel, setChannel] = useState<"phone" | "email">("phone"); const [outcome, setOutcome] = useState<ContactOutcome>("two_way"); const [error, setError] = useState("");
  const dirty = !!text || channel !== "phone" || outcome !== "two_way";
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  function reset() { setText(""); setChannel("phone"); setOutcome("two_way"); setError(""); }
  return <section aria-label="Thêm hoạt động" className="lead-composer"><h3>Thêm hoạt động</h3><form onSubmit={event => { event.preventDefault(); try { const value = leadText(text); setError(""); submit(kind === "note" ? { kind: "note", text: value } : { kind: "contact", channel, outcome, summary: value }); } catch (error) { setError((error as Error).message); } }}>
    <div className="detail-field"><label htmlFor="activity-kind">Loại hoạt động</label><select id="activity-kind" className="select" value={kind} disabled={disabled || dirty} onChange={event => { setKind(event.target.value as "note" | "contact"); reset(); }}><option value="note">Ghi chú nội bộ</option><option value="contact" disabled={closed}>Ghi nhận liên hệ</option></select></div>
    {kind === "contact" && <><div className="detail-field"><label htmlFor="contact-channel">Kênh liên hệ thực tế</label><select id="contact-channel" className="select" value={channel} disabled={disabled} onChange={event => { const next = event.target.value as "phone" | "email"; setChannel(next); if (outcome !== "two_way") setOutcome(next === "phone" ? "unanswered" : "email_sent"); }}><option value="phone">Điện thoại</option><option value="email">Email</option></select></div><div className="detail-field"><label htmlFor="contact-outcome">Kết quả liên hệ</label><select id="contact-outcome" className="select" value={outcome} disabled={disabled} onChange={event => setOutcome(event.target.value as ContactOutcome)}><option value="two_way">{contactOutcome.two_way}</option>{channel === "phone" ? <option value="unanswered">{contactOutcome.unanswered}</option> : <option value="email_sent">{contactOutcome.email_sent}</option>}</select></div><p className="field-help">Chỉ chọn Đã trao đổi hai chiều khi đã có trao đổi thực tế. Hệ thống ghi thời điểm lưu; thao tác này không tự gọi điện hoặc gửi email.</p></>}
    <div className="detail-field"><label htmlFor="activity-text">{kind === "note" ? "Nội dung ghi chú" : "Tóm tắt liên hệ"}</label><textarea id="activity-text" className="input" rows={4} disabled={disabled} value={text} onChange={event => { setText(event.target.value); setError(""); }} required aria-describedby="activity-help"/><p className="field-help" id="activity-help">{[...text.normalize("NFC")].length.toLocaleString("vi-VN")} / 2.000 ký tự · Văn bản thuần, không đính kèm. {kind === "note" ? "Ghi chú không kéo dài thời hạn lưu." : "Liên hệ thực tế cập nhật mốc hoạt động."}</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="btn full" disabled={disabled || !text.trim()}>{kind === "note" ? "Lưu ghi chú" : "Lưu lần liên hệ"}</button>{dirty && <button className="inline-link" type="button" disabled={disabled} onClick={() => requestGuardedAction(reset)}>Bỏ nội dung hoạt động đang soạn</button>}
  </form></section>;
}
