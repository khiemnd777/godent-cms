import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { readPublicService } from "../../../../lib/public-service";
import { RichText } from "../../../../components/rich-text";
import { ConsultationForm } from "../../../../components/consultation-form";
import { PublicShell } from "../../../../components/public-shell";
import { ListingPagination, PublicCards, RelatedContent } from "../../../../components/public-content";
import { publicNavigation, readPublicContentList, readPublicServiceLinks, reverseReferenceQuery } from "../../../../lib/public-content";
import { contentPublicPath, type PublicServiceContentLinks, type ReferenceKind } from "../../../../../api/src/contracts/m3";
import { CONTENT_LABELS } from "../../../../lib/public-content";
import { loadBuilderPage, ResolvedBuilderDetail, usesBuilderPresentation } from "../../../../components/builder-route";
import { publicPageMetadata } from "../../../../lib/builder-seo";
import type { PublicSearchParams } from "../../../../lib/public-content";
const loadPage = cache(async (tenant: string, slug: string) => {
  const page = await readPublicService(tenant, slug); if (!page) return null;
  const links = await readPublicServiceLinks(tenant, slug);
  if (!links || links.publicationId !== page.publicationId) throw new Error("Public content changed; reload the page");
  return { ...page, links };
});
type Props = { params: Promise<{ tenant: string; slug: string }>; searchParams: Promise<PublicSearchParams> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant, slug } = await params; const adopted = await loadBuilderPage(tenant, "vi", "service", slug); if (usesBuilderPresentation(adopted)) return publicPageMetadata(adopted); const page = await loadPage(tenant, slug);
  if (!page) return { title: "Không tìm thấy trang", robots: { index: false, follow: false } };
  return { title: page.service.seo.title || `${page.service.title} | ${page.site.name}`, description: page.service.seo.description || page.service.summary, alternates: { canonical: page.canonicalUrl }, robots: { index: false, follow: false } };
}
export default async function ServicePage({ params, searchParams }: Props) {
  const { tenant, slug } = await params; const adopted = await loadBuilderPage(tenant, "vi", "service", slug); if (usesBuilderPresentation(adopted)) return <ResolvedBuilderDetail page={adopted} tenant={tenant} searchParams={await searchParams}/>; const page = await loadPage(tenant, slug); if (!page) notFound();
  return <PublicShell site={page.site} navigation={publicNavigation(tenant, "service")} breadcrumbs={[{ href: contentPublicPath(tenant, "service"), label: "Dịch vụ" }, { href: contentPublicPath(tenant, "service", slug), label: page.service.title, current: true }]}><article><p className="eyebrow">Dịch vụ</p><h1>{page.service.title}</h1>{page.service.summary && <p className="service-summary">{page.service.summary}</p>}{page.coverMedia &&
    // The eligibility gateway must handle each image request; no framework image cache may bypass revocation.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="service-cover" src={`http://127.0.0.1:5890${page.coverMedia.path}`} alt={page.coverMedia.alt} width={page.coverMedia.width} height={page.coverMedia.height}/>}
    <RichText document={page.service.body}/></article><RelatedContent references={page.links.references}/><ServiceRelatedListings tenant={tenant} links={page.links}/><ConsultationForm tenantSlug={tenant} serviceSlug={slug} publicationId={page.publicationId} locations={page.links.locations}/></PublicShell>;
}

async function ServiceRelatedListings({ tenant, links }: { tenant: string; links: PublicServiceContentLinks }) {
  const query = reverseReferenceQuery({ kind: "service", id: links.serviceId });
  const kinds: ReferenceKind[] = ["price", "doctor", "case", "article"];
  const lists = await Promise.all(kinds.map(kind => readPublicContentList(tenant, kind, query)));
  return <>{lists.map((list, index) => !list?.items.length ? null : <section className="related-section" key={kinds[index]} aria-label={`${CONTENT_LABELS[kinds[index]].plural} liên quan`}><h2>{CONTENT_LABELS[kinds[index]].plural} liên quan</h2><PublicCards items={list.items} nested/><ListingPagination tenant={tenant} kind={kinds[index]} query={query} nextCursor={list.nextCursor}/></section>)}</>;
}
