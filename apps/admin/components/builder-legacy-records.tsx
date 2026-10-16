"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { M3_ROUTES, type ContentDraft, type ContentKind } from "../../api/src/contracts/m3";
import type { M4Variant } from "../../api/src/contracts/m4";
import { S03_ROUTES, type PublicationService, type SiteDraft } from "../../api/src/contracts/s03";
import { apiRequest, errorText } from "../lib/access";
import { supportsContentPermissionHistory } from "../lib/content-media";
import { ContentHistory } from "./content-history";
import { ContentPermissionsPanel } from "./content-permissions";
import { EditorialHistory } from "./editorial-history";
import { requestGuardedAction } from "./unsaved-changes";
import { useWorkspace } from "./workspace";

export function BuilderLegacyRecords({ draft, site, disabled, onDirty, onConflict }: { draft: M4Variant; site: SiteDraft | null; disabled: boolean; onDirty: (dirty: boolean) => void; onConflict: () => void }) {
  const { membership, href } = useWorkspace(); const [open, setOpen] = useState(false); const [legacy, setLegacy] = useState<ContentDraft | PublicationService | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const supported = draft.kind === "config" || !!draft.legacySource;
  const load = useCallback(async () => { if (!supported || draft.kind === "config") return; setLoading(true); try { const result = draft.kind === "service" ? await apiRequest<PublicationService>(S03_ROUTES.service(draft.tenantId, draft.id)) : await apiRequest<ContentDraft>(M3_ROUTES.resource(draft.tenantId, draft.kind as ContentKind, draft.id)); setLegacy(result); setError(""); } catch (error) { setLegacy(null); setError(errorText(error)); } finally { setLoading(false); } }, [supported, draft.kind, draft.tenantId, draft.id]);
  useEffect(() => { if (!open) return; let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; }; }, [open, load]);
  if (!supported) return null;
  return <section className="panel"><div className="panel-head"><h2>Hồ sơ trước khi chuyển đổi VI/EN</h2><button className="btn" type="button" aria-expanded={open} onClick={() => open ? requestGuardedAction(() => setOpen(false)) : setOpen(true)}>{open ? "Đóng hồ sơ" : "Mở lịch sử và quyền cũ"}</button></div>{open && <div className="panel-body form-stack"><p className="field-help">Lịch sử và quyền trước chuyển đổi được giữ nguyên. Quyền cũ không tự cấp quyền cho bản ngôn ngữ mới. Quản lý ảnh và thu hồi toàn bộ tư liệu tại <Link href={href("/cms/media")} prefetch={false}>Thư viện hình ảnh</Link>.</p>{loading && <p role="status">Đang tải hồ sơ cũ…</p>}{error && <p className="form-error" role="alert">{error}</p>}{draft.kind === "config" && site ? <EditorialHistory path={S03_ROUTES.site(draft.tenantId)} tenantName={membership!.tenantName} resourceName="Thông tin website trước chuyển đổi" expectedVersion={site.version} current={{ name: site.name, footer: site.footer }} disabled onConflict={onConflict} onRestored={() => undefined}/> : legacy && "draftVersion" in legacy ? <EditorialHistory path={S03_ROUTES.service(draft.tenantId, draft.id)} tenantName={membership!.tenantName} resourceName={legacy.title} expectedVersion={legacy.draftVersion} current={{ ...legacy, slug: legacy.slug ?? "" }} disabled onConflict={onConflict} onRestored={() => undefined}/> : legacy && "content" in legacy ? <><ContentHistory draft={legacy} disabled onRestore={() => undefined}/>{supportsContentPermissionHistory(legacy.kind) && <ContentPermissionsPanel historicalOnly draft={legacy} disabled={disabled} onDirty={onDirty} onConflict={onConflict} onApplied={load}/>}</> : null}</div>}</section>;
}
