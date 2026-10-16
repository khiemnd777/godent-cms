"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PUBLIC_SITE_ORIGIN, S03_ROUTES, type PublicationService, type SiteDraft } from "../../api/src/contracts/s03";
import { apiRequest } from "../lib/access";
export function PublishedServiceLink({ tenantId }: { tenantId: string | null }) {
  const pathname = usePathname(); const [destination, setDestination] = useState<string | null>(null); const [revision, setRevision] = useState(0);
  useEffect(() => { const refresh = () => setRevision(value => value + 1); window.addEventListener("godent:publication-updated", refresh); return () => window.removeEventListener("godent:publication-updated", refresh); }, []);
  useEffect(() => {
    const match = /^\/cms\/services\/([0-9a-f-]{36})(?:\/preview)?$/.exec(pathname); const controller = new AbortController();
    if (tenantId && match) Promise.all([apiRequest<PublicationService>(S03_ROUTES.service(tenantId, match[1]), { signal: controller.signal }), apiRequest<SiteDraft>(S03_ROUTES.site(tenantId), { signal: controller.signal })]).then(([service, site]) => { if (!controller.signal.aborted) setDestination(service.activePublication && service.slug && site.slug ? `${PUBLIC_SITE_ORIGIN}/${site.slug}/dich-vu/${service.slug}` : null); }).catch(() => { if (!controller.signal.aborted) setDestination(null); });
    return () => controller.abort();
  }, [pathname, tenantId, revision]);
  const onService = /^\/cms\/services\/[0-9a-f-]{36}(?:\/preview)?$/.test(pathname);
  return destination && onService ? <a className="btn public-service-link" href={destination} target="_blank" rel="noopener noreferrer" aria-label="Xem website"><ExternalLink size={13}/><span className="public-service-label">Xem website</span></a> : <button className="btn public-service-link" disabled title="Mở một dịch vụ đã xuất bản để xem trang công khai" aria-label="Xem website"><ExternalLink size={13}/><span className="public-service-label">Xem website</span></button>;
}
