"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { ServiceMediaReference } from "../../api/src/contracts/s07";
import { MediaPreview } from "./media-preview";
import { MediaPickerDialog } from "./service-cover";
export function BuilderImageField({ tenantId, label, value, disabled, onChange }: { tenantId: string; label: string; value: ServiceMediaReference | null; disabled: boolean; onChange: (value: ServiceMediaReference | null) => void }) {
  const [open, setOpen] = useState(false);
  return <section className="form-stack"><h4>{label}</h4>{value && <><MediaPreview tenantId={tenantId} reference={value}/><label className="field">Mô tả {label.toLowerCase()} *<input required value={value.alt} maxLength={500} disabled={disabled} onChange={event => onChange({ ...value, alt: event.target.value })}/></label></>}<div className="buttons"><button type="button" className="btn" disabled={disabled} onClick={() => setOpen(true)}>{value ? "Đổi ảnh" : "Chọn ảnh từ thư viện"}</button>{value && <button type="button" className="btn" disabled={disabled} onClick={() => onChange(null)}>Bỏ ảnh khỏi bản nháp</button>}</div><p className="field-help">Lưu bản nháp rồi ghi quyền đúng phạm vi {label.toLowerCase()} nếu tư liệu cần quyền công bố. Bỏ ảnh không xóa quyền hoặc lịch sử trước đó.</p>{open && createPortal(<div onSubmit={event => event.stopPropagation()}><MediaPickerDialog pickReady onClose={() => setOpen(false)} onPick={asset => { onChange({ assetId: asset.id, revision: asset.revision, alt: "" }); setOpen(false); }}/></div>, document.body)}</section>;
}
