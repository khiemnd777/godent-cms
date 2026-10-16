"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Mail, MessageSquare, Phone } from "lucide-react";
import type { ClosureReason, LeadDetail as Detail, LeadStatus } from "../../api/src/contracts/s05";
import { closureReason, leadDate, leadStatus } from "../lib/lead-presentation";
import type { LeadSnapshot } from "../lib/lead-response";
import { leadText } from "../lib/lead-input";
import { LeadAssigneeInput } from "./lead-assignee-input";
import { LeadRetention } from "./lead-retention";
import { LeadHistory } from "./lead-history";
import { LeadActivityComposer } from "./lead-activity-composer";
import { requestGuardedAction } from "./unsaved-changes";
import { useLeadCommand } from "./use-lead-command";

export function LeadDetail({ tenantId, lead, focusHeading, onChanged, onDirty, onUnavailable }: {
  tenantId: string; lead: Detail; focusHeading: boolean; onChanged: (snapshot: LeadSnapshot) => void;
  onDirty: (dirty: boolean) => void; onUnavailable: (reason?: "expired") => void;
}) {
  const [assignee, setAssignee] = useState(lead.assignee?.userId ?? ""); const heading = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState<LeadStatus>(lead.status); const [reason, setReason] = useState<ClosureReason | "">(""); const [reopenReason, setReopenReason] = useState("");
  const [retentionDirty, setRetentionDirty] = useState(false);
  const [activityDirty, setActivityDirty] = useState(false); const [validation, setValidation] = useState("");
  const command = useLeadCommand({ tenantId, lead, onChanged, onUnavailable });
  const assignmentDirty = assignee !== (lead.assignee?.userId ?? "");
  const stateDirty = status !== lead.status || !!reason || !!reopenReason;
  const dirty = assignmentDirty || stateDirty || activityDirty || retentionDirty || command.unknown;
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => { if (focusHeading) { const frame = requestAnimationFrame(() => heading.current?.focus()); return () => cancelAnimationFrame(frame); } }, [focusHeading]);
  const disabled = command.busy || command.unknown || command.conflict || !lead.capabilities.canWrite;
  const reopenedStatus = lead.hasTwoWayContact ? "contacted" : lead.assignee?.eligible ? "assigned" : "new";
  const notificationLabels = { pending: "Đang chờ", processing: "Đang xử lý", blocked: "Đang bị chặn", captured: "Đã ghi nhận tại máy thử", failed: "Chưa hoàn tất", cancelled: "Đã hủy" };
  return <><div className="detail-title"><span className="detail-avatar"><MessageSquare size={18} aria-hidden="true"/></span><div><h2 ref={heading} tabIndex={-1}>{lead.name || "Khách gửi yêu cầu"}</h2><time dateTime={lead.createdAt}>{leadDate(lead.createdAt)}</time></div></div>
    {lead.phone && <div className="contact-line"><Phone size={15} aria-hidden="true"/><span>{lead.phone}</span></div>}{lead.email && <div className="contact-line"><Mail size={15} aria-hidden="true"/><span>{lead.email}</span></div>}
    <div className="divider"/><dl className="lead-metadata"><div><dt>Quan tâm</dt><dd>{lead.interest?.serviceTitle || "Chưa chọn dịch vụ"}</dd></div><div><dt>Trang nguồn</dt><dd>{lead.source.serviceTitle}</dd></div><div><dt>Đường dẫn nguồn</dt><dd>{lead.source.path}</dd></div><div><dt>Ngôn ngữ / Kênh</dt><dd>{lead.preferredLanguage.toUpperCase()} / {lead.preferredChannel === "phone" ? "Điện thoại" : "Email"}</dd></div></dl>
    <p className="small muted">Lời nhắn</p><div className="request-copy">{lead.message || "Không có lời nhắn."}</div><div className="lead-consent"><Check size={14} aria-hidden="true"/><span>Đã đồng ý để phòng khám liên hệ<br/><time dateTime={lead.consent.acceptedAt}>{leadDate(lead.consent.acceptedAt)}</time></span></div>
    <div className="divider"/>{!lead.capabilities.canWrite && <p className="notice" role="status">Nha khoa đang tạm ngưng. Bạn có thể xem yêu cầu; các thao tác cập nhật đang bị khóa.</p>}
    <form onSubmit={event => { event.preventDefault(); setValidation(""); if (activityDirty || retentionDirty) return; if (assignmentDirty) void command.submit({ kind: "assign", assigneeUserId: assignee || null }); else if (lead.status === "closed" && status !== "closed") { try { void command.submit({ kind: "reopen", reason: leadText(reopenReason) }); } catch (error) { setValidation((error as Error).message); } } else if (status === "closed" && reason) void command.submit({ kind: "close", reason }); }}>
      <LeadAssigneeInput tenantId={tenantId} value={assignee} current={lead.assignee} disabled={disabled || lead.status === "closed" || stateDirty || activityDirty} onChange={setAssignee} onUnavailable={onUnavailable}/>
      <div className="detail-field"><label htmlFor="lead-status">Trạng thái</label><select id="lead-status" className="select" disabled={disabled || assignmentDirty || activityDirty} value={status} onChange={event => { setStatus(event.target.value as LeadStatus); setReason(""); setReopenReason(""); setValidation(""); }}>{Object.entries(leadStatus).map(([value, item]) => <option value={value} key={value} disabled={value !== lead.status && (lead.status === "closed" ? value !== reopenedStatus : value !== "closed")}>{item.label}</option>)}</select></div>
      {status === "closed" && lead.status !== "closed" && <div className="detail-field"><label htmlFor="lead-closure">Lý do đóng</label><select className="select" id="lead-closure" required value={reason} disabled={disabled} onChange={event => setReason(event.target.value as ClosureReason | "")}><option value="">Chọn lý do</option>{Object.entries(closureReason).map(([value, label]) => <option key={value} value={value} disabled={value === "completed" && !lead.hasTwoWayContact || value === "unreachable" && !lead.hasContactAttempt}>{label}</option>)}</select></div>}
      {lead.status === "closed" && status !== "closed" && <div className="detail-field"><label htmlFor="lead-reopen">Lý do mở lại</label><textarea id="lead-reopen" className="input" required value={reopenReason} disabled={disabled} onChange={event => setReopenReason(event.target.value)}/><p className="field-help">Mở lại về {leadStatus[reopenedStatus].label}. Mở lại không tự kéo dài thời hạn lưu hoặc gửi lại thông báo tiếp nhận.</p></div>}
      {lead.status === "closed" && lead.closureReason && <p className="field-help">Đã đóng: {closureReason[lead.closureReason]}{lead.closedAt ? ` · ${leadDate(lead.closedAt)}` : ""}. Mở lại trước khi đổi người phụ trách.</p>}
      {validation && <p className="form-error" role="alert">{validation}</p>}
      {command.error && <p role="alert" className="form-error">{command.error}</p>}
      {command.unknown ? <button className="btn primary full" type="button" disabled={command.busy} onClick={() => void command.submit()}>{command.busy ? "Đang kiểm tra…" : "Thử lại cùng thao tác"}</button> : <button className="btn primary full" disabled={disabled || activityDirty || retentionDirty || !assignmentDirty && !stateDirty || status === "closed" && lead.status !== "closed" && !reason}>{command.busy ? "Đang lưu…" : "Lưu cập nhật"}</button>}
      {command.conflict && <button className="btn full" type="button" disabled={command.busy} onClick={() => void command.compare()}>Đối chiếu bản hiện tại</button>}
      {command.latest && <div className="notice"><p>Bản hiện tại · Phiên bản {command.latest.version}<br/>{leadStatus[command.latest.status].label} · {command.latest.assignee?.name ?? "Chưa phân công"}</p><button className="btn" type="button" onClick={() => requestGuardedAction(() => command.applyLatest())}>Dùng bản hiện tại</button></div>}
      <p className="field-help">Phiên bản {lead.version}. Ghi nhận trao đổi thực tế ở phần Thêm hoạt động để chuyển sang Đã liên hệ. Lưu riêng từng thao tác để giữ nội dung đang soạn.</p>
    </form><div className="divider"/><LeadActivityComposer disabled={disabled || assignmentDirty || stateDirty || retentionDirty} closed={lead.status === "closed"} onDirty={setActivityDirty} submit={input => void command.submit(input)}/><div className="divider"/><LeadHistory tenantId={tenantId} lead={lead} onUnavailable={onUnavailable}/>
    <div className="divider"/><LeadRetention tenantId={tenantId} lead={lead} disabled={disabled || assignmentDirty || stateDirty || activityDirty} onDirty={setRetentionDirty} onChanged={onChanged} onUnavailable={onUnavailable}/>
    <p className="field-help">Thông báo thử: {notificationLabels[lead.notification.status]}. Chỉ ghi nhận tại máy thử, chưa gửi email thật.{lead.notification.status === "blocked" && " Kiểm tra người nhận và trạng thái nha khoa."}</p>
  </>;
}
