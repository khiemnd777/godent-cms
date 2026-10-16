"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { M3_ROUTES, type ContentPreview as Preview } from "../../api/src/contracts/m3";
import { apiRequest, errorText } from "../lib/access";
import { contentIssueText } from "../lib/content-issues";
import { contentSections, type ContentSection } from "../lib/content-navigation";
import { useWorkspace } from "./workspace";
import { ContentCopy } from "./content-copy";
import { ContentPrivateMedia } from "./content-private-media";
import { ShellState } from "./shell-state";

export function ContentPreview({ kind, id }: { kind: ContentSection; id: string }) {
  const { membership, href } = useWorkspace(); const [preview, setPreview] = useState<Preview | null>(null); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0); const section = contentSections[kind];
  useEffect(() => { const controller = new AbortController(); apiRequest<Preview>(`${M3_ROUTES.resource(membership!.tenantId, kind, id)}/preview`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) { setPreview(result); setError(""); } }).catch(error => { if (!controller.signal.aborted) setError(errorText(error)); }); return () => controller.abort(); }, [membership, kind, id, attempt]);
  if (error) return <ShellState kind="error" title="Không thể xem trước" description={error}><button className="btn" onClick={() => setAttempt(value => value + 1)}>Thử lại</button><Link className="btn" href={href(`${section.path}/${id}`)} prefetch={false}>Tiếp tục soạn</Link></ShellState>;
  if (!preview) return <ShellState kind="loading" title="Đang mở bản xem trước" description="Đang kiểm tra quyền hiện tại."/>;
  return <><div className="page-head"><div><div className="eyebrow">Xem trước riêng · Tiếng Việt</div><h1>{preview.draft.content.title}</h1><p>{membership!.tenantName} · Bản nháp {preview.draft.version} · Thông tin website {preview.site.version}</p></div><Link className="btn" href={href(`${section.path}/${id}`)} prefetch={false}>Tiếp tục soạn</Link></div><p className="notice">Đây là bản đã lưu riêng tư. Website công khai chỉ thay đổi khi bạn xác nhận cập nhật.</p>{preview.issues.length > 0 && <div className="notice error" role="alert"><strong>Nội dung chưa đủ điều kiện công bố</strong><ul>{preview.issues.map((issue, index) => <li key={index}>{contentIssueText(issue)}</li>)}</ul></div>}<article className="panel panel-body private-preview"><p className="preview-site-name">{preview.site.name}</p><h2>Bản nháp riêng tư</h2><ContentPrivateMedia tenantId={membership!.tenantId} content={preview.draft.content}/><ContentCopy content={preview.draft.content} references={preview.resolved}/></article></>;
}
