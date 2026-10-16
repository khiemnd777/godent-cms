"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";
import { S05_ROUTES, type LeadCount, type LeadDetail as Detail, type LeadListItem, type LeadPage, type LeadQuery } from "../../api/src/contracts/s05";
import { ApiError, apiRequest } from "../lib/access";
import { leadDate, leadDenied, leadError, leadStatus } from "../lib/lead-presentation";
import { countLabel, queryParameters } from "../lib/lead-input";
import { useWorkspace } from "./workspace";
import { ShellState } from "./shell-state";
import { LeadDetail } from "./lead-detail";
import { LeadFilters } from "./lead-filters";
import { requestGuardedAction, UnsavedChanges } from "./unsaved-changes";

export function LeadWorkspace() {
  const { membership } = useWorkspace(); const tenantId = membership!.tenantId;
  const [page, setPage] = useState<LeadPage>({ items: [], nextCursor: null });
  const [cursor, setCursor] = useState<string | null>(null); const [previousCursors, setPreviousCursors] = useState<(string | null)[]>([]);
  const [selected, setSelected] = useState<string | null>(null); const [detail, setDetail] = useState<Detail | null>(null);
  const [listBusy, setListBusy] = useState(true); const [detailBusy, setDetailBusy] = useState(false);
  const [listError, setListError] = useState<unknown>(null); const [detailError, setDetailError] = useState<unknown>(null);
  const [detailOpen, setDetailOpen] = useState(false); const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0); const [editorRevision, setEditorRevision] = useState(0); const [notice, setNotice] = useState("");
  const [count, setCount] = useState<LeadCount | null>(null); const [countError, setCountError] = useState("");
  const [filtered, setFiltered] = useState(false);
  const listRequest = useRef<AbortController | null>(null); const detailRequest = useRef<AbortController | null>(null);
  const countRequest = useRef<AbortController | null>(null); const appliedQuery = useRef<LeadQuery>({ pageSize: 20 });
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const unavailable = useCallback(() => {
    listRequest.current?.abort(); detailRequest.current?.abort(); countRequest.current?.abort();
    setPage({ items: [], nextCursor: null }); setDetail(null); setSelected(null); setDirty(false); setNotice("");
    setCount(null); setCountError("");
    setListBusy(false); setDetailBusy(false); setListError(new ApiError(404)); setDetailError(null);
  }, []);
  const loadCount = useCallback(async () => {
    countRequest.current?.abort(); const controller = new AbortController(); countRequest.current = controller; setCount(null); setCountError("");
    try { const next = await apiRequest<LeadCount>(`${S05_ROUTES.count(tenantId)}?${queryParameters(appliedQuery.current, null, true)}`, { signal: controller.signal }); if (!controller.signal.aborted) setCount(next); }
    catch (error) { if (!controller.signal.aborted) { setCountError(leadError(error)); if (leadDenied(error)) unavailable(); } }
  }, [tenantId, unavailable]);
  const load = useCallback(async (after: string | null, preserve?: Detail) => {
    listRequest.current?.abort(); detailRequest.current?.abort();
    const controller = new AbortController(); listRequest.current = controller;
    setListBusy(true); setListError(null); setPage({ items: [], nextCursor: null });
    if (!preserve) { setDetail(null); setSelected(null); setDetailOpen(false); setDirty(false); }
    try {
      const next = await apiRequest<LeadPage>(`${S05_ROUTES.leads(tenantId)}?${queryParameters(appliedQuery.current, after)}`, { signal: controller.signal });
      if (!controller.signal.aborted) { setPage(next); if (!preserve) setSelected(next.items[0]?.id ?? null); else if (!next.items.some(item => item.id === preserve.id)) setNotice(`Đã lưu ${preserve.code}. Yêu cầu không còn trong trang hoặc bộ lọc hiện tại. Chi tiết yêu cầu vừa lưu vẫn đang mở.`); }
    } catch (error) { if (!controller.signal.aborted) { setListError(error); setDetail(null); if (leadDenied(error)) unavailable(); } }
    finally { if (!controller.signal.aborted) setListBusy(false); }
  }, [tenantId, unavailable]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return Promise.all([load(null), loadCount()]); }); return () => { active = false; listRequest.current?.abort(); detailRequest.current?.abort(); countRequest.current?.abort(); }; }, [load, loadCount]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController(); detailRequest.current?.abort(); detailRequest.current = controller;
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setDetail(null); setDetailBusy(true); setDetailError(null); setDirty(false);
      try { const next = await apiRequest<Detail>(S05_ROUTES.lead(tenantId, selected), { signal: controller.signal }); if (!controller.signal.aborted) setDetail(next); }
      catch (error) { if (!controller.signal.aborted) { if (leadDenied(error)) unavailable(); else setDetailError(error); } }
      finally { if (!controller.signal.aborted) setDetailBusy(false); }
    });
    return () => controller.abort();
  }, [selected, tenantId, revision, unavailable]);
  useEffect(() => {
    if (!detail) return; let timer: ReturnType<typeof setTimeout>;
    const check = () => { const remaining = Date.parse(detail.expiresAt) - Date.now(); if (remaining <= 0) unavailable(); else timer = setTimeout(check, Math.min(remaining, 2_147_483_647)); };
    check(); return () => clearTimeout(timer);
  }, [detail, unavailable]);
  const changed = useCallback((lead: Detail) => {
    setDetail(lead); setEditorRevision(value => value + 1); setDirty(false); setNotice(`Đã tải bản đã lưu · ${lead.code} · Phiên bản ${lead.version}.`);
    void load(cursor, lead); void loadCount(); window.dispatchEvent(new Event("godent:leads-updated"));
  }, [load, loadCount, cursor]);
  function select(item: LeadListItem) { if (item.id === selected) { setDetailOpen(true); return; } requestGuardedAction(() => { setNotice(""); setSelected(item.id); setDetailOpen(true); }); }
  function back() { requestGuardedAction(() => { setDetailOpen(false); setDetail(null); setRevision(value => value + 1); requestAnimationFrame(() => { if (selected) rows.current.get(selected)?.focus(); }); }); }
  function refresh() { requestGuardedAction(() => { setNotice(""); setCursor(null); setPreviousCursors([]); void load(null); void loadCount(); }); }
  function apply(query: LeadQuery, confirmed?: () => void) { requestGuardedAction(() => { confirmed?.(); appliedQuery.current = query; setFiltered(!!(query.q || query.status || query.assignee || query.from || query.to)); setNotice(""); setCursor(null); setPreviousCursors([]); void load(null); void loadCount(); }); }
  function nextPage() { if (page.nextCursor) requestGuardedAction(() => { setPreviousCursors(history => [...history, cursor]); setCursor(page.nextCursor); void load(page.nextCursor); }); }
  function previousPage() { requestGuardedAction(() => { const previous = previousCursors.at(-1) ?? null; setPreviousCursors(history => history.slice(0, -1)); setCursor(previous); void load(previous); }); }
  const currentDetail = detail?.id === selected ? detail : null;
  return <><UnsavedChanges dirty={dirty} description="Nội dung đang soạn hoặc thao tác chưa xác định kết quả sẽ không được giữ trên trang mới. Kiểm tra bản đã lưu trước khi gửi lại." continueLabel="Tiếp tục chỉnh sửa"/>
    <div className="page-head"><div><div className="eyebrow">Chăm sóc khách hàng</div><h1>Yêu cầu tư vấn</h1><p>Một nơi để tiếp nhận và phản hồi các yêu cầu từ website.</p></div></div>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className={`leads-layout${detailOpen ? " detail-open" : ""}`}>
      <section className="panel leads-list" aria-label="Danh sách yêu cầu"><div className="panel-head"><h2>Danh sách yêu cầu</h2><button className="btn" disabled={listBusy} onClick={refresh}><RefreshCw size={14} aria-hidden="true"/>Làm mới</button></div>
        <LeadFilters tenantId={tenantId} disabled={listBusy} onApply={apply} onUnavailable={unavailable}/>
        {listBusy ? <ShellState kind="loading" title="Đang tải yêu cầu" description="Đang kiểm tra quyền truy cập hiện tại."/> : listError ? <ShellState kind={leadDenied(listError) ? "denied" : "error"} title={leadDenied(listError) ? "Không thể truy cập yêu cầu" : "Chưa tải được yêu cầu"} description={leadError(listError)}><button className="btn" onClick={() => void load(cursor)}>Thử lại</button></ShellState> : !page.items.length ? <ShellState title={filtered ? "Không tìm thấy yêu cầu" : "Chưa có yêu cầu tư vấn"} description={filtered ? "Thử từ khóa khác hoặc xóa bộ lọc để xem các yêu cầu khác." : "Khi khách gửi biểu mẫu trên website, yêu cầu sẽ xuất hiện tại đây."}/> : <div className="table-wrap"><table className="lead-table"><thead><tr><th>Khách hàng</th><th className="service-col">Quan tâm</th><th>Trạng thái</th><th className="time-col">Tiếp nhận</th></tr></thead><tbody>{page.items.map(item => <tr key={item.id} className={selected === item.id ? "selected" : ""}><td><button ref={node => { if (node) rows.current.set(item.id, node); else rows.current.delete(item.id); }} className="lead-name" aria-label={`Mở yêu cầu ${item.name || "Khách gửi yêu cầu"}`} aria-pressed={selected === item.id} onClick={() => select(item)}>{item.name || "Khách gửi yêu cầu"}</button>{item.phoneMasked && <div className="contact">{item.phoneMasked}</div>}{item.emailMasked && <div className="contact">{item.emailMasked}</div>}<small>{item.code}</small></td><td className="service-col">{item.interest?.serviceTitle ?? "Chưa chọn dịch vụ"}</td><td><span className={`tag ${leadStatus[item.status].color}`}>{leadStatus[item.status].label}</span></td><td className="time-col"><time dateTime={item.createdAt}>{leadDate(item.createdAt)}</time></td></tr>)}</tbody></table></div>}
        {!listBusy && !listError && <div className="footer-row"><span>{count ? `${countLabel(count.count, count.capped)} yêu cầu phù hợp · ` : ""}{page.items.length} trên trang này{countError && <span className="error-text"> · Chưa tải được số lượng</span>}</span><div className="buttons">{countError && <button className="btn" onClick={() => void loadCount()}>Thử lại số lượng</button>}{previousCursors.length > 0 && <button className="btn" onClick={previousPage}>Trang trước</button>}{page.nextCursor && <button className="btn" onClick={nextPage}>Trang tiếp</button>}</div></div>}
      </section>
      <aside className="panel detail-panel" aria-label="Chi tiết yêu cầu"><div className="panel-head"><h2>Chi tiết yêu cầu</h2>{currentDetail && <span className="small muted">{currentDetail.code}</span>}</div><div className="detail-body"><button className="btn detail-back" onClick={back}><ArrowLeft size={14} aria-hidden="true"/>Danh sách yêu cầu</button>
        {selected && (detailBusy || !currentDetail && !detailError) ? <ShellState kind="loading" title="Đang tải chi tiết" description="Đang kiểm tra quyền xem yêu cầu."/> : detailError && selected ? <ShellState kind={leadDenied(detailError) ? "denied" : "error"} title="Chưa thể xem yêu cầu" description={leadError(detailError)}><button className="btn" onClick={() => setRevision(value => value + 1)}>Thử lại</button></ShellState> : currentDetail ? <LeadDetail key={`${currentDetail.id}:${currentDetail.version}:${editorRevision}`} tenantId={tenantId} lead={currentDetail} focusHeading={detailOpen} onChanged={changed} onDirty={setDirty} onUnavailable={unavailable}/> : <ShellState title="Chọn yêu cầu để xem" description="Thông tin chi tiết chỉ hiển thị khi bạn có quyền truy cập."/>}
      </div></aside>
    </div><div className="context-note"><Users size={14} aria-hidden="true"/><span>Tất cả quản trị viên của nha khoa đều thấy danh sách này. Phân công để xác định người phụ trách.</span></div>
  </>;
}
