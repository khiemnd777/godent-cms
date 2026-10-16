"use client";
import { useEffect, useRef, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { type PublicationService, type PublicationResult, type SiteDraft, S03_ROUTES } from "../../api/src/contracts/s03";
import { ApiError, apiRequest, errorText } from "../lib/access";
import { versionedFailure } from "../lib/versioned-operation";
import { useSession } from "./session-provider";
import { ReauthForm } from "./reauth-form";
export function PublicationDialog({ service, site, tenantName, onClose, onPublished, onConflict }: { service: PublicationService; site: SiteDraft; tenantName: string; onClose: () => void; onPublished: (result: PublicationResult) => void; onConflict: () => void }) {
  const { data } = useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reauth, setReauth] = useState(false);
  const [conflict, setConflict] = useState(false); const [unknown, setUnknown] = useState(false); const pending = useRef<AbortController | null>(null); const alive = useRef(true);
  useEffect(() => { alive.current = true; const previous = document.activeElement; dialog.current?.showModal(); return () => { alive.current = false; pending.current?.abort(); if (previous instanceof HTMLElement) previous.focus(); }; }, []);
  async function publish() {
    const controller = new AbortController(); pending.current = controller; const timer = setTimeout(() => controller.abort(), 15000); setBusy(true); setError("");
    try {
      const result = await apiRequest<PublicationResult>(`${S03_ROUTES.service(service.tenantId, service.id)}/publish`, { method: "POST", signal: controller.signal, csrf: data!.csrfToken, body: { expectedDraftVersion: service.draftVersion, expectedPublicationVersion: service.publicationVersion, expectedPublicationRevision: service.publicationRevision, expectedSiteVersion: site.version, requestKey } });
      if (alive.current) onPublished(result);
    } catch (error) {
      if (!alive.current) return;
      const failure = versionedFailure(error instanceof ApiError ? error.status : undefined, error instanceof ApiError ? error.code : undefined, unknown); setUnknown(failure.unknown);
      if (error instanceof ApiError && error.code === "REAUTH_REQUIRED") { setReauth(true); setError("Xác thực lại trước khi cập nhật website."); }
      else if (error instanceof ApiError && error.status === 409) { setConflict(true); setError("Phiên bản đã thay đổi. Nội dung đang soạn được giữ lại. Đối chiếu bản đã lưu trước khi xác nhận lại."); onConflict(); }
      else setError(failure.unknown ? "Chưa xác định kết quả. Thử lại cùng thao tác để kiểm tra phiên bản đã ghi nhận." : errorText(error));
    } finally { clearTimeout(timer); if (alive.current) setBusy(false); }
  }
  return <dialog ref={dialog} className="service-dialog" aria-labelledby="publish-title" onCancel={event => { event.preventDefault(); if (!busy && !unknown) onClose(); }}><div className="dialog-head"><h2 id="publish-title">Cập nhật website?</h2><button type="button" className="icon-button" onClick={onClose} disabled={busy || unknown} aria-label="Đóng xác nhận"><X size={18}/></button></div><div className="dialog-body form-stack"><p>Bản đã lưu sau sẽ thay thế nội dung đang hiển thị công khai.</p><dl className="confirmation-identity"><div><dt>Nha khoa</dt><dd>{tenantName}</dd></div><div><dt>Dịch vụ</dt><dd>{service.title}</dd></div><div><dt>Ngôn ngữ</dt><dd>VI · Tiếng Việt</dd></div><div><dt>Bản nháp</dt><dd>Phiên bản {service.draftVersion}</dd></div><div><dt>Website hiện tại</dt><dd>{service.activePublication ? `Phiên bản ${service.publicationVersion}` : "Chưa xuất bản"}</dd></div><div><dt>Thông tin website</dt><dd>Phiên bản {site.version}</dd></div></dl><p className="publish-note">Chỉ cập nhật phiên bản đã lưu này. Lưu bản nháp không thay đổi website. Máy chủ kiểm tra quyền hiện tại và xác thực lại trong 5 phút.</p>{error && <p className="form-error" role="alert">{error}</p>}{reauth && <ReauthForm purpose="Xác thực lại để xuất bản nội dung đã lưu." onSuccess={() => { setReauth(false); setError(""); }}/>}<div className="buttons"><button type="button" className="btn" onClick={onClose} disabled={busy || unknown}>Quay lại</button><button type="button" className="btn primary" onClick={() => void publish()} disabled={busy || reauth || conflict}><ExternalLink size={14}/>{busy ? "Đang cập nhật…" : unknown ? "Thử lại cùng thao tác xuất bản" : "Xác nhận cập nhật website"}</button></div></div></dialog>;
}
