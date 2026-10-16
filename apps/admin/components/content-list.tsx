"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Plus, RefreshCw, Search } from "lucide-react";
import { M3_LIMITS, M3_ROUTES, type ContentDraft, type ContentPage } from "../../api/src/contracts/m3";
import { apiRequest, errorText, ApiError } from "../lib/access";
import { contentSections, type ContentSection } from "../lib/content-navigation";
import { useWorkspace } from "./workspace";
import { ContentTabs } from "./content-tabs";
import { ShellState } from "./shell-state";

export function ContentList({ kind }: { kind: ContentSection }) {
  const { membership, href } = useWorkspace(); const tenant = membership!.tenantId; const section = contentSections[kind];
  const [query, setQuery] = useState(""); const [applied, setApplied] = useState("");
  const [page, setPage] = useState<ContentPage<ContentDraft>>({ items: [], nextCursor: null });
  const [busy, setBusy] = useState(true); const [error, setError] = useState(""); const [denied, setDenied] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor: string | null = null) => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; setBusy(true); setError("");
    const search = new URLSearchParams({ pageSize: String(M3_LIMITS.pageSize), ...(applied ? { q: applied } : {}), ...(cursor ? { cursor } : {}) });
    try { const result = await apiRequest<ContentPage<ContentDraft>>(`${M3_ROUTES.resources(tenant, kind)}?${search}`, { signal: controller.signal }); if (!controller.signal.aborted) { setPage(previous => ({ ...result, items: cursor ? [...previous.items, ...result.items] : result.items })); setDenied(false); } }
    catch (error) { if (!controller.signal.aborted) { setError(errorText(error)); if (error instanceof ApiError && [401, 403, 404].includes(error.status)) { setPage({ items: [], nextCursor: null }); setDenied(true); } } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [tenant, kind, applied]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; pending.current?.abort(); }; }, [load]);
  return <><div className="page-head"><div><div className="eyebrow">{section.area}</div><h1>{section.title}</h1><p>Nội dung tiếng Việt của {membership!.tenantName}.</p></div><Link className="btn primary" href={href(`${section.path}/new`)} prefetch={false}><Plus size={15}/>Soạn {section.singular}</Link></div><ContentTabs section={kind}/><section className="panel"><div className="panel-head"><h2>{section.title} của nha khoa</h2><span className="tag gray">{page.items.length} đang hiển thị</span></div><form className="content-search" onSubmit={event => { event.preventDefault(); const next = query.trim(); if (next === applied) void load(); else { setPage({ items: [], nextCursor: null }); setApplied(next); } }}><label className="field"><span>Tìm theo tên hoặc đường dẫn</span><input type="search" value={query} maxLength={M3_LIMITS.search} onChange={event => setQuery(event.target.value)} disabled={denied}/></label><button className="btn" disabled={busy || denied}><Search size={15}/>Tìm kiếm</button></form>
    {error && <div className="panel-body notice error" role="alert"><p>{error}</p><button className="btn" type="button" disabled={busy} onClick={() => void load()}><RefreshCw size={14}/>Thử lại</button></div>}
    {denied ? <ShellState kind="denied" title="Không thể truy cập nội dung" description="Kiểm tra quyền quản trị hiện tại của nha khoa."/> : busy && !page.items.length ? <ShellState kind="loading" title={`Đang tải ${section.singular}`} description="Đang kiểm tra quyền truy cập hiện tại."/> : !page.items.length && !error ? <ShellState title={applied ? "Không có kết quả phù hợp" : `Chưa có ${section.singular}`} description={applied ? "Thử tên hoặc đường dẫn khác." : "Soạn bản nháp mới. Website chỉ thay đổi sau khi bạn xác nhận xuất bản."}><Link className="btn" href={href(`${section.path}/new`)} prefetch={false}>Soạn {section.singular}</Link></ShellState> : page.items.map(item => <div className="recent-item content-list-row" key={item.id}><span className="doc-icon"><FileText size={17}/></span><div className="copy"><Link href={href(`${section.path}/${encodeURIComponent(item.id)}`)} prefetch={false}><strong>{item.content.title}</strong></Link><small>Bản nháp {item.version} · {new Date(item.updatedAt).toLocaleString("vi-VN")}</small><small>/{section.publicPath}/{item.content.slug}</small></div><div className="buttons"><span className={`tag ${item.activePublication ? "green" : "gray"}`}>{item.activePublication ? "Đã xuất bản" : "Bản nháp"}</span>{item.activePublication && item.version !== item.publishedVersion && <span className="tag amber">Có thay đổi chưa xuất bản</span>}</div></div>)}
    {page.nextCursor && !denied && <div className="footer-row"><button className="btn" disabled={busy} onClick={() => void load(page.nextCursor)}>{busy ? "Đang tải…" : "Tải thêm"}</button></div>}</section></>;
}
