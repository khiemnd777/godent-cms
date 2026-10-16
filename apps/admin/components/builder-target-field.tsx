"use client";
import { useState } from "react";
import { M4_KINDS, type M4Locale, type M4Target } from "../../api/src/contracts/m4";
import { kindLabel } from "../lib/builder-content";
import { BuilderReferencePicker } from "./builder-reference-picker";
export function BuilderTargetField({ tenantId, locale, value, disabled, onChange }: { tenantId: string; locale: M4Locale; value: M4Target | null; disabled: boolean; onChange: (target: M4Target, title: string) => void }) {
  const [targetLocale, setTargetLocale] = useState<M4Locale>(value?.locale ?? locale);
  return <section className="form-stack">{value && <p className="field-help">Đích đã chọn: {kindLabel(value.kind)} · {value.locale.toUpperCase()} · {value.id.slice(0, 8)}. Liên kết trỏ cùng tài nguyên khi nội dung được xuất bản lại.</p>}<label className="field">Ngôn ngữ trang đích<select value={targetLocale} disabled={disabled} onChange={event => setTargetLocale(event.target.value as M4Locale)}><option value="vi">VI · Tiếng Việt</option><option value="en">EN · English</option></select></label><BuilderReferencePicker key={targetLocale} tenantId={tenantId} locale={targetLocale} allowedKinds={M4_KINDS} disabled={disabled} single onPick={option => onChange({ kind: option.kind, id: option.id, locale: option.locale }, option.title)} label="Chọn trang đích nội bộ"/></section>;
}
