"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { S03_ROUTES, type ServicePreview } from "../../api/src/contracts/s03";
import { M3_ROUTES, type ServiceContentLinksView } from "../../api/src/contracts/m3";
import { apiRequest, errorText } from "../lib/access";
import { useWorkspace } from "./workspace";
import { ShellState } from "./shell-state";
import { MediaPreview } from "./media-preview";
import { RichText } from "./rich-text";
export function DraftPreview({ id }: { id: string }) {
  const { membership, href } = useWorkspace(); const [preview, setPreview] = useState<ServicePreview | null>(null); const [links, setLinks] = useState<ServiceContentLinksView | null>(null); const [error, setError] = useState(""); const tenantId = membership!.tenantId;
  useEffect(() => { const controller = new AbortController(); Promise.all([apiRequest<ServicePreview>(`${S03_ROUTES.service(tenantId, id)}/preview`, { signal: controller.signal }), apiRequest<ServiceContentLinksView>(M3_ROUTES.serviceLinks(tenantId, id), { signal: controller.signal })]).then(([result, references]) => { if (!controller.signal.aborted) { setPreview(result); setLinks(references); } }).catch(error => { if (!controller.signal.aborted) setError(errorText(error)); }); return () => controller.abort(); }, [tenantId, id]);
  if (error) return <ShellState kind="denied" title="Không thể xem trước" description={error}/>;
  if (!preview) return <ShellState kind="loading" title="Đang mở bản xem trước" description="Đang kiểm tra quyền truy cập hiện tại."/>;
  return <><div className="page-head"><div><div className="eyebrow">Xem trước riêng · Tiếng Việt</div><h1>{preview.service.title}</h1><p>{membership!.tenantName} · Bản nháp {preview.service.draftVersion} · Thông tin website {preview.site.version}</p></div><Link className="btn" href={href(`/cms/services/${encodeURIComponent(id)}`)} prefetch={false}>Tiếp tục soạn</Link></div><p className="notice">Đây là bản đã lưu riêng tư. Website công khai chỉ thay đổi khi bạn xác nhận cập nhật.</p><article className="panel panel-body private-preview"><p className="preview-site-name">{preview.site.name}</p><h2>{preview.service.title}</h2>{preview.service.summary && <p className="service-summary">{preview.service.summary}</p>}{preview.service.coverImage && <MediaPreview tenantId={tenantId} reference={preview.service.coverImage}/>}<RichText document={preview.service.body}/>{links && links.references.length > 0 && <section className="content-related"><h2>Nội dung liên quan</h2>{links.resolved.map(reference => <section key={`${reference.kind}:${reference.id}`}><h3>{reference.title}</h3><p className="field-help">Bản xuất bản {reference.publicationVersion}</p>{reference.content.kind === "faq" ? <RichText document={reference.content.body}/> : <p>{reference.content.summary}</p>}</section>)}{links.resolved.length < links.references.length && <p className="notice">Một liên kết không còn đủ điều kiện công khai. Kiểm tra lại trong phần phân loại và nội dung liên quan.</p>}</section>}<footer className="preview-footer"><p>{preview.site.footer.intro}</p><RichText document={preview.site.footer.body}/></footer></article></>;
}
