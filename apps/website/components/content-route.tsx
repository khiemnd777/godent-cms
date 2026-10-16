import { publicUrlBase } from "../lib/public-url-context";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { contentPublicPath, type ContentKind, type PublicContentPage, type ReferenceKind } from "../../api/src/contracts/m3";
import { CONTENT_LABELS, InvalidPublicQuery, kindFromSection, parsePublicQuery, publicNavigation, publicQueryString, readPublicContentList, readPublicContentPage, reverseReferenceQuery, type PublicSearchParams } from "../lib/public-content";
import { ContentBody, ListingFilters, ListingPagination, PublicCards, RelatedContent } from "./public-content";
import { PublicShell } from "./public-shell";
import { listingAlternates, listingPageMetadata, loadBuilderList, loadBuilderPage, ResolvedBuilderDetail, usesBuilderPresentation } from "./builder-route";
import { BuilderListing } from "./builder-listing";
import { builderListSearch } from "../lib/public-builder";
import { publicPageMetadata } from "../lib/builder-seo";

export type ContentListProps = { params: Promise<{ tenant: string; section: string }>; searchParams: Promise<PublicSearchParams> };
export type ContentDetailProps = { params: Promise<{ tenant: string; section: string; slug: string }> };
// React memoization is limited to this render. API reads remain no-store across requests.
// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
const loadList = cache((tenant: string, kind: ReferenceKind, search: string) => readPublicContentList(tenant, kind, parsePublicQuery(Object.fromEntries(new URLSearchParams(search)))));
const loadDetail = cache(readPublicContentPage);
const noindex = { index: false, follow: false };
function metadata(title: string, description?: string, canonical?: string): Metadata {
  return { title, ...(description ? { description } : {}), ...(canonical ? { alternates: { canonical } } : {}), robots: noindex };
}
function resolveKind(section: string) { const kind = kindFromSection(section); if (!kind) notFound(); return kind; }

export async function listingMetadata({ params, searchParams }: ContentListProps): Promise<Metadata> {
  const { tenant, section } = await params, kind = resolveKind(section);
  try {
    const query = parsePublicQuery(await searchParams), adopted = await loadBuilderList(tenant, "vi", kind, builderListSearch(query));
    if (adopted && (adopted.config || publicUrlBase(adopted))) return listingPageMetadata(adopted, tenant, "vi", kind);
    const page = await loadList(tenant, kind, publicQueryString(query));
    return page ? metadata(`${CONTENT_LABELS[kind].plural} | ${page.site.name}`, undefined, page.canonicalUrl) : metadata("Không tìm thấy trang");
  } catch (error) { if (error instanceof InvalidPublicQuery) return metadata("Bộ lọc không hợp lệ"); throw error; }
}
export async function ContentListing({ params, searchParams }: ContentListProps) {
  const { tenant, section } = await params, kind = resolveKind(section);
  let query;
  try { query = parsePublicQuery(await searchParams); }
  catch (error) {
    if (!(error instanceof InvalidPublicQuery)) throw error;
    return <main className="content-page"><h1>Bộ lọc không hợp lệ</h1><p>Vui lòng mở lại danh sách và chọn bộ lọc.</p><a href={contentPublicPath(tenant, kind)}>Mở danh sách</a></main>;
  }
  const adopted = await loadBuilderList(tenant, "vi", kind, builderListSearch(query));
  if (adopted && (adopted.config || publicUrlBase(adopted))) return <BuilderListing page={adopted} tenant={tenant} kind={kind} locale="vi" query={query} alternates={await listingAlternates(tenant, "vi", kind, adopted.canonicalUrl)}/>;
  const page = await loadList(tenant, kind, publicQueryString(query)); if (!page) notFound();
  return <PublicShell site={page.site} navigation={publicNavigation(tenant, kind)}>
    <p className="eyebrow">{page.site.name}</p><h1>{CONTENT_LABELS[kind].plural}</h1>
    {kind === "service" && <p className="public-browse-links"><a href={contentPublicPath(tenant, "specialty")}>Duyệt theo chuyên khoa</a><a href={contentPublicPath(tenant, "service_group")}>Duyệt theo nhóm dịch vụ</a><a href={contentPublicPath(tenant, "location")}>Duyệt theo cơ sở</a></p>}
    {kind === "price" && <p className="public-browse-links"><a href={contentPublicPath(tenant, "service")}>Duyệt giá theo dịch vụ</a><a href={contentPublicPath(tenant, "location")}>Duyệt giá theo cơ sở</a></p>}
    {kind === "article" && <p><a href={contentPublicPath(tenant, "category")}>Duyệt theo chuyên mục</a></p>}
    <ListingFilters tenant={tenant} kind={kind} query={query}/><PublicCards items={page.items}/><ListingPagination tenant={tenant} kind={kind} query={query} nextCursor={page.nextCursor}/>
  </PublicShell>;
}
export async function detailMetadata({ params }: ContentDetailProps): Promise<Metadata> {
  const { tenant, section, slug } = await params, kind = resolveKind(section);
  if (kind === "service") notFound();
  const adopted = await loadBuilderPage(tenant, "vi", kind, slug); if (usesBuilderPresentation(adopted)) return publicPageMetadata(adopted);
  const page = await loadDetail(tenant, kind, slug);
  return page ? metadata(page.content.seo.title || `${page.content.title} | ${page.site.name}`, page.content.seo.description || page.content.summary, page.canonicalUrl) : metadata("Không tìm thấy trang");
}
async function ReferencingListings({ tenant, page }: { tenant: string; page: PublicContentPage }) {
  const kinds: ReferenceKind[] = page.kind === "specialty" ? ["service", "doctor"] : page.kind === "service_group" ? ["service"] : page.kind === "category" ? ["article"] : page.kind === "location" ? ["service", "doctor", "price"] : [];
  if (!kinds.length) return null;
  const query = reverseReferenceQuery(page);
  const lists = await Promise.all(kinds.map(kind => readPublicContentList(tenant, kind, query)));
  return <>{lists.map((list, index) => list && <section className="related-section" key={kinds[index]} aria-label={`${CONTENT_LABELS[kinds[index]].plural} thuộc ${page.content.title}`}><h2>{CONTENT_LABELS[kinds[index]].plural}</h2><PublicCards items={list.items} nested/><ListingPagination tenant={tenant} kind={kinds[index]} query={query} nextCursor={list.nextCursor}/></section>)}</>;
}
export async function ContentDetail({ params }: ContentDetailProps) {
  const { tenant, section, slug } = await params, kind = resolveKind(section); if (kind === "service") notFound();
  const adopted = await loadBuilderPage(tenant, "vi", kind, slug); if (usesBuilderPresentation(adopted)) return <ResolvedBuilderDetail page={adopted} tenant={tenant}/>;
  const page = await loadDetail(tenant, kind as ContentKind, slug); if (!page) notFound();
  return <PublicShell site={page.site} navigation={publicNavigation(tenant, kind)} breadcrumbs={[{ href: contentPublicPath(tenant, kind), label: CONTENT_LABELS[kind].plural }, { href: contentPublicPath(tenant, kind, slug), label: page.content.title, current: true }]}>
    <article><p className="eyebrow">{CONTENT_LABELS[kind].singular}</p><h1>{page.content.title}</h1><ContentBody content={page.content} media={page.media}/></article>
    <RelatedContent references={page.references}/><ReferencingListings tenant={tenant} page={page}/>
  </PublicShell>;
}
