"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, RefreshCw, FileText } from "lucide-react";
import { apiRequest, errorText, type Page } from "../lib/access";
import { S03_ROUTES, type PublicationService } from "../../api/src/contracts/s03";
import { useWorkspace } from "./workspace";
import { ShellState } from "./shell-state";
export function DraftList() {
  const { membership, href } = useWorkspace();
  const [items, setItems] = useState<PublicationService[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const tenantId = membership!.tenantId;
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Page<PublicationService>>(S03_ROUTES.services(tenantId), { signal: controller.signal }).then(page => { setItems(page.items); setCursor(page.nextCursor); setBusy(false); }).catch(error => { if (!controller.signal.aborted) { setError(errorText(error)); setBusy(false); } });
    return () => controller.abort();
  }, [tenantId]);
  async function loadMore() {
    setBusy(true); setError("");
    try { const page = await apiRequest<Page<PublicationService>>(`${S03_ROUTES.services(tenantId)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`); setItems(previous => cursor ? [...previous, ...page.items] : page.items); setCursor(page.nextCursor); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <><div className="page-head"><div><div className="eyebrow">Nội dung nha khoa</div><h1>Dịch vụ</h1><p>Nội dung dịch vụ · Tiếng Việt</p></div><Link className="btn primary" href={href("/cms/services/new")} prefetch={false}><Plus size={15}/>Soạn dịch vụ</Link></div><section className="panel"><div className="panel-head"><h2>Dịch vụ của nha khoa</h2><span className="tag gray">{items.length} đang hiển thị</span></div>
    {error && <div className="panel-body"><p className="form-error" role="alert">{error}</p><button className="btn" onClick={() => void loadMore()} disabled={busy}><RefreshCw size={14}/>Thử lại</button></div>}
    {busy && !items.length ? <ShellState kind="loading" title="Đang tải bản nháp" description="Đang kiểm tra quyền truy cập hiện tại."/> : !items.length && !error ? <ShellState title="Chưa có bản nháp dịch vụ" description="Bắt đầu với tiêu đề và nội dung dịch vụ bằng tiếng Việt."><Link className="btn" href={href("/cms/services/new")} prefetch={false}>Soạn dịch vụ</Link></ShellState> : items.map(item => <div className="recent-item" key={item.id}><span className="doc-icon"><FileText size={17}/></span><div className="copy"><Link href={href(`/cms/services/${encodeURIComponent(item.id)}`)} prefetch={false}><strong>{item.title}</strong></Link><small>Phiên bản {item.draftVersion} · {new Date(item.updatedAt).toLocaleString("vi-VN")}</small></div><div className="buttons"><span className={`tag ${item.activePublication ? "green" : "gray"}`}>{item.activePublication ? "Đã xuất bản" : "Bản nháp"}</span>{item.activePublication && (item.publishedDraftVersion !== item.draftVersion || item.publishedSiteVersion !== item.siteVersion) && <span className="tag amber">Có thay đổi chưa xuất bản</span>}</div></div>)}
    {cursor && <div className="footer-row"><button className="btn" disabled={busy} onClick={() => void loadMore()}>{busy ? "Đang tải…" : "Tải thêm"}</button></div>}</section></>;
}
