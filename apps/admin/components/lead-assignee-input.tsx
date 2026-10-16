"use client";
import type { LeadAssignee } from "../../api/src/contracts/s05";
import { useLeadAssignees } from "./use-lead-assignees";

export function LeadAssigneeInput({ tenantId, value, current, disabled, onChange, onUnavailable }: {
  tenantId: string; value: string; current: LeadAssignee | null; disabled: boolean;
  onChange: (value: string) => void; onUnavailable: () => void;
}) {
  const { page, busy, error, load } = useLeadAssignees(tenantId, onUnavailable);
  return <div className="detail-field"><label htmlFor="lead-assignee">Người phụ trách</label><select id="lead-assignee" className="select" value={value} disabled={disabled || busy || !!error} onChange={event => onChange(event.target.value)}>
    <option value="">Chưa phân công</option>
    {current && !page.items.some(item => item.userId === current.userId) && <option value={current.userId} disabled={!current.eligible}>{current.name}{!current.eligible ? " · Không còn đủ điều kiện" : ""}</option>}
    {page.items.map(item => <option value={item.userId} key={item.userId}>{item.name}</option>)}
  </select>{current && !current.eligible && <p className="field-help">Người phụ trách đã mất quyền hoặc không còn đủ điều kiện. Hệ thống không tự chuyển người phụ trách.</p>}
    {busy && <p role="status" className="field-help">Đang tải quản trị viên hợp lệ…</p>}{error && <p role="alert" className="form-error">{error}</p>}
    {error ? <button type="button" className="inline-link" onClick={() => void load()}>Thử tải lại người phụ trách</button> : page.nextCursor && <button type="button" className="inline-link" disabled={busy || disabled} onClick={() => void load(page.nextCursor)}>Tải thêm người phụ trách</button>}
  </div>;
}
