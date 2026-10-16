"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, FileText, Search } from "lucide-react";
import { apiRequest, errorText, type Page } from "../lib/access";
import { S03_ROUTES, type PublicationService } from "../../api/src/contracts/s03";
import { M3_LIMITS } from "../../api/src/contracts/m3";
import { useWorkspace } from "./workspace";
import { ShellState } from "./shell-state";
import { ContentTabs } from "./content-tabs";
export function DraftList() {
  const { membership, href } = useWorkspace(); const tenantId = membership!.tenantId;
  const [items, setItems] = useState<PublicationService[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true); const [error, setError] = useState(""); const [query, setQuery] = useState(""); const [applied, setApplied] = useState(""); const pending = useRef<AbortController | null>(null);
  const load = useCallback(async (after: string | null = null) => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; setBusy(true); setError("");
    const search = new URLSearchParams({ pageSize: String(M3_LIMITS.pageSize), ...(applied ? { q: applied } : {}), ...(after ? { cursor: after } : {}) });
    try { const page = await apiRequest<Page<PublicationService>>(`${S03_ROUTES.services(tenantId)}?${search}`, { signal: controller.signal }); if (!controller.signal.aborted) { setItems(previous => after ? [...previous, ...page.items] : page.items); setCursor(page.nextCursor); } }
    catch (error) { if (!controller.signal.aborted) { setItems([]); setCursor(null); setError(errorText(error)); } } finally { if (!controller.signal.aborted) setBusy(false); }
  }, [tenantId, applied]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; pending.current?.abort(); }; }, [load]);
  return <><div className="page-head"><div><div className="eyebrow">Nội dung nha khoa</div><h1>Dịch vụ</h1><p>Nội dung dịch vụ · Tiếng Việt</p></div><Link className="btn primary" href={href("/cms/services/new")} prefetch={false}><Plus size={15}/>Soạn dịch vụ</Link></div><ContentTabs section="service"/><section className="panel"><div className="panel-head"><h2>Dịch vụ của nha khoa</h2><span className="tag gray">{items.length} đang hiển thị</span></div><form className="content-search" onSubmit={event => { event.preventDefault(); const next = query.trim(); if (next === applied) void load(); else { setItems([]); setCursor(null); setApplied(next); } }}><label className="field">Tìm theo tên hoặc đường dẫn<input type="search" value={query} maxLength={M3_LIMITS.search} onChange={event => setQuery(event.target.value)}/></label><button className="btn" disabled={busy}><Search size={15}/>Tìm kiếm</button></form>
    {error && <div className="panel-body"><p className="form-error" role="alert">{error}</p><button className="btn" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/>Thử lại</button></div>}
    {busy && !items.length ? <ShellState kind="loading" title="Đang tải bản nháp" description="Đang kiểm tra quyền truy cập hiện tại."/> : !items.length && !error ? <ShellState title={applied ? "Không có dịch vụ phù hợp" : "Chưa có bản nháp dịch vụ"} description={applied ? "Thử tên hoặc đường dẫn khác." : "Bắt đầu với tiêu đề và nội dung dịch vụ bằng tiếng Việt."}><Link className="btn" href={href("/cms/services/new")} prefetch={false}>Soạn dịch vụ</Link></ShellState> : items.map(item => <div className="recent-item" key={item.id}><span className="doc-icon"><FileText size={17}/></span><div className="copy"><Link href={href(`/cms/services/${encodeURIComponent(item.id)}`)} prefetch={false}><strong>{item.title}</strong></Link><small>Phiên bản {item.draftVersion} · {new Date(item.updatedAt).toLocaleString("vi-VN")}</small></div><div className="buttons"><span className={`tag ${item.activePublication ? "green" : "gray"}`}>{item.activePublication ? "Đã xuất bản" : "Bản nháp"}</span>{item.activePublication && (item.publishedDraftVersion !== item.draftVersion || item.publishedSiteVersion !== item.siteVersion) && <span className="tag amber">Có thay đổi chưa xuất bản</span>}</div></div>)}
    {cursor && <div className="footer-row"><button className="btn" disabled={busy} onClick={() => void load(cursor)}>{busy ? "Đang tải…" : "Tải thêm"}</button></div>}</section></>;
}
