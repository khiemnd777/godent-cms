"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { M4_ROUTES, type M4Locale, type M4ResourceKind, type M4Preview } from "../../api/src/contracts/m4";
import { apiRequest, errorText } from "../lib/access";
import { builderEditorPath } from "../lib/builder-state";
import { previewIssueText } from "../lib/builder-preview-state";
import { useWorkspace } from "./workspace";
import { ShellState } from "./shell-state";
import { BuilderPrivateCopy } from "./builder-private-copy";

export function BuilderPreview({ kind, id, locale = "vi" }: { kind: M4ResourceKind; id?: string; locale?: M4Locale }) {
  const { membership, href } = useWorkspace(); const tenant = membership!.tenantId; const [preview, setPreview] = useState<M4Preview | null>(null); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0);
  const path = kind === "config" ? `/cms/website${locale === "en" ? "/en" : ""}` : builderEditorPath(kind, id, locale);
  useEffect(() => { const controller = new AbortController(); const api = kind === "config" ? M4_ROUTES.config(tenant, locale) : M4_ROUTES.resource(tenant, kind, id!, locale);
    apiRequest<M4Preview>(`${api}/preview`, { signal: controller.signal }).then(result => { if (controller.signal.aborted) return; if (!result.closure || result.draft.tenantId !== tenant || result.draft.kind !== kind || result.draft.locale !== locale || result.draft.id !== (id ?? tenant) || result.closure.id !== result.draft.id || result.closure.draftVersion !== result.draft.version || result.closure.locale !== locale || result.closure.kind !== kind) throw new Error("Private preview identity mismatch"); setPreview(result); setError(""); }).catch(error => { if (!controller.signal.aborted) { setPreview(null); setError(errorText(error)); } }); return () => controller.abort();
  }, [tenant, kind, id, locale, attempt]);
  if (error) return <ShellState kind="error" title="Không thể mở đầy đủ bản xem trước" description={error}><button className="btn" type="button" onClick={() => setAttempt(value => value + 1)}>Mở lại bản xem trước</button><Link className="btn" href={href(path)} prefetch={false}>Tiếp tục soạn</Link></ShellState>;
  if (!preview?.closure) return <ShellState kind="loading" title="Đang mở bản xem trước" description="Đang kiểm tra bản đã lưu, nội dung liên kết và quyền xem ảnh hiện tại."/>;
  const issues = [...new Set([...preview.issues, ...preview.closure.issues])];
  return <><div className="page-head"><div><div className="eyebrow">Xem trước riêng · {locale.toUpperCase()} · {locale === "vi" ? "Tiếng Việt" : "English"}</div><h1>{"name" in preview.draft.content ? preview.draft.content.name : preview.draft.content.title}</h1><p>{membership!.tenantName} · Bản đã lưu {preview.draft.version} · Ngôn ngữ yêu cầu {locale.toUpperCase()} · Ngôn ngữ nội dung {preview.closure.locale.toUpperCase()}</p>{preview.closure.config && <p>Cấu hình đã lưu {preview.closure.config.draftVersion} · {preview.closure.config.content.theme === "clarity" ? "Theme 1" : "Theme 2"}</p>}</div><div className="buttons"><button className="btn" type="button" onClick={() => setAttempt(value => value + 1)}>Mở lại ảnh và kiểm tra quyền</button><Link className="btn" href={href(path)} prefetch={false}>Tiếp tục soạn</Link></div></div><p className="notice">Bản riêng tư dùng nội dung và cấu hình đã lưu. Biểu mẫu không gửi dữ liệu. Website chỉ thay đổi sau xác nhận xuất bản; xuất bản nội dung không tự xuất bản cấu hình đang nháp.</p>{issues.length > 0 && <div className="notice error" role="alert"><strong>Nội dung chưa đủ điều kiện công bố</strong><ul>{issues.map((issue, index) => <li key={index}>{previewIssueText(issue)}</li>)}</ul></div>}<BuilderPrivateCopy key={`${attempt}:${preview.draft.version}`} closure={preview.closure}/></>;
}
