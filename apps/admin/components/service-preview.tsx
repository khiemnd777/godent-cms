"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { S03_ROUTES, type ServicePreview } from "../../api/src/contracts/s03";
import { apiRequest, errorText } from "../lib/access";
import { useWorkspace } from "./workspace";
import { ShellState } from "./shell-state";
import { RichText } from "./rich-text";
export function DraftPreview({ id }: { id: string }) {
  const { membership, href } = useWorkspace(); const [preview, setPreview] = useState<ServicePreview | null>(null); const [error, setError] = useState(""); const tenantId = membership!.tenantId;
  useEffect(() => { const controller = new AbortController(); apiRequest<ServicePreview>(`${S03_ROUTES.service(tenantId, id)}/preview`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setPreview(result); }).catch(error => { if (!controller.signal.aborted) setError(errorText(error)); }); return () => controller.abort(); }, [tenantId, id]);
  if (error) return <ShellState kind="denied" title="Không thể xem trước" description={error}/>;
  if (!preview) return <ShellState kind="loading" title="Đang mở bản xem trước" description="Đang kiểm tra quyền truy cập hiện tại."/>;
  return <><div className="page-head"><div><div className="eyebrow">Xem trước riêng · Tiếng Việt</div><h1>{preview.service.title}</h1><p>{membership!.tenantName} · Bản nháp {preview.service.draftVersion} · Thông tin website {preview.site.version}</p></div><Link className="btn" href={href(`/cms/services/${encodeURIComponent(id)}`)} prefetch={false}>Tiếp tục soạn</Link></div><p className="notice">Đây là bản đã lưu riêng tư. Website công khai chỉ thay đổi khi bạn xác nhận cập nhật.</p><article className="panel panel-body private-preview"><p className="preview-site-name">{preview.site.name}</p><h2>{preview.service.title}</h2>{preview.service.summary && <p className="service-summary">{preview.service.summary}</p>}<RichText document={preview.service.body}/><footer className="preview-footer"><p>{preview.site.footer.intro}</p><RichText document={preview.site.footer.body}/></footer></article></>;
}
