"use client";
import { useEffect, useState } from "react";
import { M4_ROUTES, type M4Kind, type M4Variant } from "../../api/src/contracts/m4";
import { apiRequest, errorText } from "../lib/access";
import { BuilderEditor, BuilderLocaleLinks } from "./builder-editor";
import { BuilderPreview } from "./builder-preview";
import { ShellState } from "./shell-state";
import { useWorkspace } from "./workspace";
export function BuilderResourceEntry({ kind, id, children, preview = false }: { kind: M4Kind; id: string; children: React.ReactNode; preview?: boolean }) {
  const { membership } = useWorkspace(); const [variant, setVariant] = useState<M4Variant | null>(null); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0);
  useEffect(() => { const controller = new AbortController(); apiRequest<M4Variant>(M4_ROUTES.resource(membership!.tenantId, kind, id, "vi"), { signal: controller.signal }).then(result => { if (!controller.signal.aborted) { setVariant(result); setError(""); } }).catch(error => { if (!controller.signal.aborted) { setVariant(null); setError(errorText(error)); } }); return () => controller.abort(); }, [membership, kind, id, attempt]);
  if (error) return <ShellState kind="error" title="Chưa thể mở nội dung" description={error}><button type="button" className="btn" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></ShellState>;
  if (!variant) return <ShellState kind="loading" title="Đang kiểm tra phiên bản nội dung" description="Đang xác định luồng biên tập hiện tại."/>;
  if (!variant.legacy) return preview ? <BuilderPreview kind={kind} id={id}/> : <BuilderEditor kind={kind} id={id}/>;
  return <><section className="notice"><p>Nội dung VI hiện dùng luồng đã có. Mở luồng VI/EN để soạn bản ngôn ngữ mới. Lưu bản nháp VI/EN không đổi website; lần xuất bản đầu tiên chuyển quyền quản lý bản live của ngôn ngữ đó.</p><BuilderLocaleLinks kind={kind} id={id} locale="vi"/><a className="btn" href={`/cms/variants/${kind}/${id}/vi?tenant=${encodeURIComponent(membership!.tenantId)}`}>Mở luồng VI / EN cho bản VI</a></section>{children}</>;
}
