"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Save, Eye, Globe, ExternalLink } from "lucide-react";
import { S03_LIMITS, S03_ROUTES, type PublicationService, type PublicationResult, type SiteDraft } from "../../api/src/contracts/s03";
import { ApiError, apiRequest, errorText } from "../lib/access";
import { documentSource, sourceDocument } from "../lib/rich-text";
import { serviceValidation, suggestedSlug } from "../lib/service-input";
import { useSession } from "./session-provider";
import { useWorkspace } from "./workspace";
import { ShellState } from "./shell-state";
import { ServiceBodyInput } from "./service-body-input";
import { ServiceSeoFields, type ServiceFields } from "./service-seo-fields";
import { UnsavedChanges } from "./unsaved-changes";
import { PublicationDialog } from "./publication-dialog";

const empty: ServiceFields = { title: "", summary: "", slug: "", body: "", seoTitle: "", seoDescription: "" };
function fieldsFrom(service: PublicationService): ServiceFields { return { title: service.title, summary: service.summary, slug: service.slug ?? "", body: documentSource(service.body), seoTitle: service.seo.title, seoDescription: service.seo.description }; }

export function DraftEditor({ id }: { id?: string }) {
  const { data } = useSession(); const { membership, href } = useWorkspace(); const router = useRouter();
  const tenantId = membership!.tenantId;
  const [draft, setDraft] = useState<PublicationService | null>(null); const [site, setSite] = useState<SiteDraft | null>(null);
  const [fields, setFields] = useState<ServiceFields>(empty); const [tab, setTab] = useState<"content" | "seo">("content");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [conflict, setConflict] = useState(false); const [attempt, setAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState<{ service: PublicationService; site: SiteDraft } | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]); const saving = useRef<AbortController | null>(null);
  const baseline = draft ? fieldsFrom(draft) : empty; const dirty = JSON.stringify(fields) !== JSON.stringify(baseline);
  const pending = !draft?.publicationVersion || draft.publishedDraftVersion !== draft.draftVersion || draft.publishedSiteVersion !== site?.version || dirty;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([apiRequest<SiteDraft>(S03_ROUTES.site(tenantId), { signal: controller.signal }), id ? apiRequest<PublicationService>(S03_ROUTES.service(tenantId, id), { signal: controller.signal }) : Promise.resolve(null)]).then(([nextSite, service]) => { if (controller.signal.aborted) return; setSite(nextSite); setDraft(service); setFields(service ? fieldsFrom(service) : empty); if (service?.publicationVersion && service.slug && nextSite.slug) setLiveUrl(`http://localhost:5892/${nextSite.slug}/dich-vu/${service.slug}`); setError(""); setLoading(false); }).catch(error => { if (!controller.signal.aborted) { setError(errorText(error)); setLoading(false); } });
    return () => controller.abort();
  }, [tenantId, id, attempt]);
  useEffect(() => () => saving.current?.abort(), []);
  function update(key: keyof ServiceFields, value: string) { setFields(previous => ({ ...previous, [key]: value, ...(key === "title" && !draft?.slugLocked && (!previous.slug || previous.slug === suggestedSlug(previous.title)) ? { slug: suggestedSlug(value) } : {}) })); setNotice(""); }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? "content" : event.key === "End" ? "seo" : tab === "content" ? "seo" : "content"; setTab(next); tabs.current[next === "content" ? 0 : 1]?.focus(); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    let body; try { body = draft && fields.body === baseline.body ? draft.body : sourceDocument(fields.body); } catch (error) { setError(error instanceof Error ? error.message : "Kiểm tra nội dung dịch vụ."); return; }
    const content = { slug: fields.slug, title: fields.title, summary: fields.summary, body, seo: { title: fields.seoTitle, description: fields.seoDescription } };
    const invalid = serviceValidation(content); if (invalid) { setError(invalid); if (!fields.slug) setTab("seo"); return; }
    const controller = new AbortController(); saving.current = controller; setBusy(true);
    try {
      const result = await apiRequest<PublicationService>(id ? S03_ROUTES.service(tenantId, id) : S03_ROUTES.services(tenantId), { method: id ? "PUT" : "POST", csrf: data!.csrfToken, signal: controller.signal, body: { ...content, ...(id ? { expectedDraftVersion: draft!.draftVersion } : {}) } });
      if (controller.signal.aborted) return; setDraft(result); setFields(fieldsFrom(result)); setConflict(false); setNotice(`Đã lưu bản nháp · Phiên bản ${result.draftVersion}. Website không thay đổi.`);
      if (!id) router.replace(href(`/cms/services/${encodeURIComponent(result.id)}`));
    } catch (error) { if (controller.signal.aborted) return; if (error instanceof ApiError && error.status === 409) { setConflict(true); setError("Bản đã lưu đã thay đổi hoặc đường dẫn đang được sử dụng. Nội dung bạn đang soạn được giữ lại. Đối chiếu trước khi tải lại."); } else setError(errorText(error)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function published(result: PublicationResult) { setDraft(previous => previous ? { ...previous, publicationVersion: result.publicationVersion, publishedDraftVersion: result.draftVersion, publishedSiteVersion: result.siteVersion, slugLocked: true } : previous); setSite(previous => previous ? { ...previous, slugLocked: true } : previous); setLiveUrl(result.canonicalUrl); setConfirmation(null); setNotice(`Đã cập nhật website · Phiên bản ${result.publicationVersion}.`); window.dispatchEvent(new Event("godent:publication-updated")); }
  if (loading) return <ShellState kind="loading" title="Đang tải dịch vụ" description="Đang kiểm tra quyền truy cập hiện tại."/>;
  if (!site || id && !draft) return <ShellState kind="error" title="Không thể mở dịch vụ" description={error}><button className="btn" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Thử lại</button><Link className="btn" href={href("/cms/services")} prefetch={false}>Trở về dịch vụ</Link></ShellState>;
  const publishReady = draft && site.slug && draft.slug && !dirty && !busy && !conflict && pending;
  return <><UnsavedChanges dirty={dirty}/><form onSubmit={save}><div className="page-head editor-head"><div><div className="eyebrow">Nội dung nha khoa / Dịch vụ</div><h1>{fields.title || "Dịch vụ mới"}</h1><div className="buttons editor-badges"><span className={`tag ${draft?.publicationVersion ? "green" : "gray"}`}>{draft?.publicationVersion ? "Đã xuất bản" : "Bản nháp"}</span>{pending && <span className="tag amber">Có thay đổi chưa xuất bản</span>}</div></div><div className="buttons editor-actions"><button className="btn" disabled={busy || conflict || !fields.title.trim() || !dirty}><Save size={15}/>{busy ? "Đang lưu…" : "Lưu bản nháp"}</button><button type="button" className="btn" disabled={!id || dirty || busy || conflict} onClick={() => router.push(href(`/cms/services/${encodeURIComponent(id!)}/preview`))} title={dirty ? "Lưu bản nháp trước khi xem trước" : undefined}><Eye size={15}/>Xem trước</button><button type="button" className="btn primary" disabled={!publishReady} onClick={() => draft && setConfirmation({ service: draft, site })} title={dirty ? "Lưu bản nháp trước khi cập nhật website" : !site.slug ? "Lưu thông tin website trước khi xuất bản" : undefined}><ExternalLink size={15}/>Cập nhật website</button></div></div>
    {error && <div className="notice error" role="alert"><p>{error}</p>{conflict && id && <Link className="btn" href={href(`/cms/services/${encodeURIComponent(id)}`)} target="_blank" rel="noopener noreferrer" prefetch={false}>Mở bản đã lưu để đối chiếu</Link>}</div>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="editor-grid"><section className="panel"><div className="tabs-line" role="tablist" aria-label="Soạn dịch vụ"><button ref={node => { tabs.current[0] = node; }} type="button" id="content-tab" role="tab" className="tab" aria-selected={tab === "content"} aria-controls="content-panel" tabIndex={tab === "content" ? 0 : -1} onKeyDown={tabKey} onClick={() => setTab("content")}>Nội dung</button><button ref={node => { tabs.current[1] = node; }} type="button" id="seo-tab" role="tab" className="tab" aria-selected={tab === "seo"} aria-controls="seo-panel" tabIndex={tab === "seo" ? 0 : -1} onKeyDown={tabKey} onClick={() => setTab("seo")}>SEO &amp; đường dẫn</button><span className="locale">VI · Tiếng Việt</span></div><div className="panel-body" id="content-panel" role="tabpanel" aria-labelledby="content-tab" hidden={tab !== "content"}><div className="form-stack"><label className="field" htmlFor="service-title"><span>Tên dịch vụ <span aria-hidden="true">*</span></span><input id="service-title" name="title" disabled={busy} maxLength={S03_LIMITS.title} value={fields.title} onChange={event => update("title", event.target.value)} required/></label><label className="field" htmlFor="service-summary">Giới thiệu ngắn<textarea id="service-summary" rows={3} disabled={busy} maxLength={S03_LIMITS.summary} value={fields.summary} onChange={event => update("summary", event.target.value)}/><span className="field-help">Giới thiệu rõ ràng, gần gũi với người đọc.</span></label><ServiceBodyInput value={fields.body} onChange={value => update("body", value)} disabled={busy}/></div></div><div className="panel-body" id="seo-panel" role="tabpanel" aria-labelledby="seo-tab" hidden={tab !== "seo"}><ServiceSeoFields fields={fields} update={update} disabled={busy} slugLocked={draft?.slugLocked ?? false} tenantSlug={site.slug}/></div></section><aside className="section-stack"><section className="panel"><div className="panel-head"><h2>Xuất bản</h2><Globe size={16}/></div><div className="panel-body meta-stack"><div className="meta-row"><span>Trạng thái website</span><span className={`tag ${draft?.publicationVersion ? "green" : "gray"}`}>{draft?.publicationVersion ? "Đã xuất bản" : "Chưa xuất bản"}</span></div><div className="meta-row"><span>Phiên bản đang chạy</span><strong>{draft?.publicationVersion ? `Phiên bản ${draft.publicationVersion}` : "Chưa có"}</strong></div><div className="meta-row"><span>Bản nháp</span><strong>{dirty ? "Chưa lưu thay đổi" : draft ? `Đã lưu · phiên bản ${draft.draftVersion}` : "Chưa lưu"}</strong></div><div className="meta-row"><span>Ngôn ngữ</span><strong>Tiếng Việt</strong></div><p className="publish-note">Lưu bản nháp không làm thay đổi website. Chỉ cập nhật khi bạn chọn <strong>Cập nhật website</strong>.</p>{liveUrl && <a className="btn" href={liveUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Xem bản đã xuất bản</a>}{!site.slug && <p className="field-help">Lưu tên, đường dẫn và chân trang của nha khoa trước khi xuất bản. <Link href={href("/cms/settings/site")} prefetch={false}>Thiết lập website</Link></p>}</div></section></aside></div></form>{confirmation && <PublicationDialog service={confirmation.service} site={confirmation.site} tenantName={membership!.tenantName} onClose={() => setConfirmation(null)} onPublished={published} onConflict={() => setConflict(true)}/>}</>;
}
export { DraftPreview } from "./service-preview";
