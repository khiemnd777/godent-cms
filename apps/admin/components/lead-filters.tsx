"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import type { LeadQuery, LeadStatus } from "../../api/src/contracts/s05";
import { emptyLeadFilters, leadQuery, type LeadFilters as Fields } from "../lib/lead-input";
import { leadStatus } from "../lib/lead-presentation";
import { useLeadAssignees } from "./use-lead-assignees";
export function LeadFilters({ tenantId, disabled, onApply, onUnavailable }: { tenantId: string; disabled: boolean; onApply: (query: LeadQuery, confirmed?: () => void) => void; onUnavailable: () => void }) {
  const [fields, setFields] = useState<Fields>(emptyLeadFilters); const [error, setError] = useState("");
  const admins = useLeadAssignees(tenantId, onUnavailable);
  function update<K extends keyof Fields>(key: K, value: Fields[K]) { setFields(previous => ({ ...previous, [key]: value })); setError(""); }
  return <form onSubmit={event => { event.preventDefault(); try { onApply(leadQuery(fields)); setError(""); } catch (error) { setError((error as Error).message); } }}>
    <div className="toolbar lead-toolbar"><label className="search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Tìm tên hoặc mã yêu cầu" placeholder="Tìm tên hoặc mã yêu cầu…" value={fields.q} onChange={event => update("q", event.target.value)} disabled={disabled}/></label>
      <select className="select" aria-label="Lọc trạng thái yêu cầu" value={fields.status} onChange={event => update("status", event.target.value as LeadStatus | "")} disabled={disabled}><option value="">Tất cả trạng thái</option>{Object.entries(leadStatus).map(([value, status]) => <option value={value} key={value}>{status.label}</option>)}</select>
      <button className="btn" disabled={disabled}>Áp dụng</button>
    </div><details className="lead-extra-filters"><summary>Bộ lọc thêm</summary><div className="lead-filter-grid"><label className="field">Người phụ trách<select className="select" value={fields.assignee} disabled={disabled || admins.busy || !!admins.error} onChange={event => update("assignee", event.target.value)}><option value="">Tất cả người phụ trách</option><option value="me">Tôi</option><option value="unassigned">Chưa phân công</option>{admins.page.items.map(item => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select></label><label className="field">Từ ngày tiếp nhận<input type="date" value={fields.from} disabled={disabled} onChange={event => update("from", event.target.value)}/></label><label className="field">Đến ngày tiếp nhận<input type="date" value={fields.to} disabled={disabled} onChange={event => update("to", event.target.value)}/></label><label className="field">Số yêu cầu trên trang<select className="select" value={fields.pageSize} disabled={disabled} onChange={event => update("pageSize", Number(event.target.value))}><option value={20}>20</option><option value={50}>50</option></select></label></div><p className="field-help">Ngày tiếp nhận theo giờ Việt Nam (Asia/Ho_Chi_Minh). Tìm tên có chứa từ khóa, giữ dấu; mã yêu cầu phải khớp chính xác.</p>{admins.error && <p role="alert" className="form-error">{admins.error}</p>}{admins.page.nextCursor && <button className="inline-link" type="button" disabled={admins.busy} onClick={() => void admins.load(admins.page.nextCursor)}>Tải thêm người phụ trách cho bộ lọc</button>}<button className="inline-link" type="button" disabled={disabled} onClick={() => onApply({ pageSize: 20 }, () => { setFields(emptyLeadFilters); setError(""); })}>Xóa bộ lọc</button></details>
    {error && <p className="form-error lead-filter-error" role="alert">{error}</p>}
  </form>;
}
