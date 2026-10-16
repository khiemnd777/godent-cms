"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import type { MediaAsset, ServiceMediaReference } from "../../api/src/contracts/s07";
import { useWorkspace } from "./workspace";
import { MediaPreview } from "./media-preview";
import { MediaLibrary } from "./media-library";
export function ServiceCover({ tenantId, value, disabled, onChange, onPick }: { tenantId: string; value: ServiceMediaReference | null; disabled: boolean; onChange: (reference: ServiceMediaReference | null) => void; onPick: () => void }) {
  const { href } = useWorkspace();
  return <section className="panel"><div className="panel-head"><h2>Ảnh đại diện</h2><ImageIcon size={16} aria-hidden="true"/></div><div className="panel-body form-stack">{value ? <><MediaPreview key={`${value.assetId}:${value.revision}`} tenantId={tenantId} reference={value}/><label className="field">Mô tả ảnh (alt text)<input value={value.alt} maxLength={320} required disabled={disabled} onChange={event => onChange({ ...value, alt: event.target.value })}/><span className="field-help">Mô tả nội dung ảnh cho người không xem được ảnh.</span></label><button className="btn" type="button" disabled={disabled} onClick={() => onChange(null)}>Bỏ ảnh khỏi bản nháp</button></> : <p className="field-help">Ảnh là tùy chọn. Chỉ sử dụng ảnh đã xử lý và có quyền công bố.</p>}<button className="btn" type="button" disabled={disabled} onClick={onPick}>{value ? "Đổi ảnh" : "Chọn ảnh từ thư viện"}</button><Link href={href("/cms/media")} prefetch={false}>Quản lý thư viện hình ảnh</Link></div></section>;
}
export function MediaPickerDialog({ onClose, onPick }: { onClose: () => void; onPick: (asset: MediaAsset) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.activeElement; dialog.current?.showModal(); return () => { if (previous instanceof HTMLElement) previous.focus(); }; }, []);
  return <dialog ref={dialog} className="service-dialog media-picker-dialog" aria-labelledby="media-picker-title" onCancel={event => { event.preventDefault(); onClose(); }}><div className="dialog-head"><h2 id="media-picker-title">Chọn ảnh đại diện</h2><button className="icon-button" type="button" aria-label="Đóng chọn ảnh" onClick={onClose}><X size={18}/></button></div><div className="dialog-body"><MediaLibrary onPick={onPick}/></div></dialog>;
}
