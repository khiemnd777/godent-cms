"use client";
import { M5_DOMAIN_ROUTES, type M5DomainsView } from "../../api/src/contracts/m5-domains";
import { primaryPublicUrl } from "../lib/primary-url";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { M4_ROUTES, type M4Kind, type M4Locale, type M4Variant } from "../../api/src/contracts/m4";
import { S03_ROUTES, type SiteDraft } from "../../api/src/contracts/s03";
import { builderRoute } from "../lib/builder-state";
import { contentRoute } from "../lib/content-navigation";
import { apiRequest } from "../lib/access";
function currentResource(pathname: string): { kind: M4Kind; id: string; locale: M4Locale } | null {
  const builder = builderRoute(pathname); if (builder && builder.view !== "list" && builder.id) return { kind: builder.kind, id: builder.id, locale: builder.locale ?? "vi" };
  const content = contentRoute(pathname); if (content && content.view !== "list" && content.id) return { kind: content.section, id: content.id, locale: "vi" };
  const service = /^\/cms\/services\/([0-9a-f-]{36})(?:\/preview)?$/.exec(pathname); return service ? { kind: "service", id: service[1], locale: "vi" } : null;
}
export function PublishedServiceLink({ tenantId }: { tenantId: string | null }) {
  const pathname = usePathname(); const resource = currentResource(pathname); const kind = resource?.kind, id = resource?.id, locale = resource?.locale;
  const identity = `${tenantId}:${kind}:${id}:${locale}`; const [destination, setDestination] = useState<{ identity: string; url: string } | null>(null); const [revision, setRevision] = useState(0);
  useEffect(() => { const refresh = () => setRevision(value => value + 1); window.addEventListener("godent:publication-updated", refresh); return () => window.removeEventListener("godent:publication-updated", refresh); }, []);
  useEffect(() => { const controller = new AbortController(); if (tenantId && kind && id && locale) Promise.all([apiRequest<M4Variant>(M4_ROUTES.resource(tenantId, kind, id, locale), { signal: controller.signal }), apiRequest<SiteDraft>(S03_ROUTES.site(tenantId), { signal: controller.signal }), apiRequest<M5DomainsView>(M5_DOMAIN_ROUTES.list(tenantId), { signal: controller.signal })]).then(([variant, site, domains]) => { if (controller.signal.aborted) return; const live = variant.activePublication || locale === "vi" && variant.publicationVersion === 0 && !!variant.legacySource?.current?.pointer; setDestination(live && "slug" in variant.content && site.slug ? { identity, url: primaryPublicUrl(domains.primary, site.slug, locale, kind, variant.content.slug) } : null); }).catch(() => { if (!controller.signal.aborted) setDestination(null); }); return () => controller.abort(); }, [tenantId, kind, id, locale, identity, revision]);
  return destination?.identity === identity && resource ? <a className="btn public-service-link" href={destination.url} target="_blank" rel="noopener noreferrer" aria-label="Xem website"><ExternalLink size={13}/><span className="public-service-label">Xem website</span></a> : <button className="btn public-service-link" disabled title="Mở một nội dung đã xuất bản để xem trang công khai" aria-label="Xem website"><ExternalLink size={13}/><span className="public-service-label">Xem website</span></button>;
}
