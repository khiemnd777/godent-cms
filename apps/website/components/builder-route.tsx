import { entryFromHeaders } from "../lib/public-entry";
import { publicHref, publicUrlBase } from "../lib/public-url-context";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { type M4Kind, type M4Locale, type M4PublicList, type PublicM4Page } from "../../api/src/contracts/m4";
import type { ReferenceKind } from "../../api/src/contracts/m3";
import { BUILDER_LABELS, InvalidBuilderQuery, parseBuilderQuery, safeTracking } from "../lib/builder-routing";
import { builderListSearch, readPublicBuilderList, readPublicBuilderPage, type BuilderListQuery } from "../lib/public-builder";
import { pageStructuredData, publicPageMetadata, safeJsonLd } from "../lib/builder-seo";
import type { PublicSearchParams } from "../lib/public-content";
import { BuilderPage } from "./builder-page";
import { BuilderListing } from "./builder-listing";
import { BuilderCards } from "./builder-content";
import { SignatureSearch } from "./signature-search";
import { SignatureCollections } from "./signature-collections";
import { signatureKindLabel } from "../lib/signature-presentation";
import { signatureRelatedQueries } from "../lib/signature-related";

// Request-limited memoization makes metadata and body use the same parsed publication.
// Proxy is a separate preflight; expected identifiers fail closed if publication/config changes.
// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export const loadBuilderPage = cache(async (tenant: string, locale: M4Locale, kind: M4Kind, slug: string) => {
  const trusted = await headers(), context = entryFromHeaders(trusted, tenant), result = await readPublicBuilderPage(tenant, locale, kind, slug, context);
  const expectedPublication = trusted.get("x-gcms-expected-publication"), expectedConfig = trusted.get("x-gcms-expected-config");
  if ((trusted.get("x-gcms-locale") === locale) && (result?.resolution === "fallback" || (expectedPublication && (result?.resolution !== "page" || result.page.publicationId !== expectedPublication)) || (expectedConfig && (result?.resolution !== "page" || (result.page.configPublicationId ?? "none") !== expectedConfig)))) throw new Error("Public content changed; reload the page");
  return result?.resolution === "page" ? result.page : null;
});
export const loadBuilderList = cache(async (tenant: string, locale: M4Locale, kind: M4Kind, search: string) => {
  const trusted = await headers(), context = entryFromHeaders(trusted, tenant);
  const page = await readPublicBuilderList(tenant, locale, kind, parseBuilderQuery(Object.fromEntries(new URLSearchParams(search))), context);
  const expected = trusted.get("x-gcms-expected-config");
  if (trusted.get("x-gcms-locale") === locale && expected && (page?.config?.publicationId ?? "none") !== expected) throw new Error("Public presentation changed; reload the page");
  return page;
});
export function usesBuilderPresentation(page: PublicM4Page | null): page is PublicM4Page { return page !== null && (publicUrlBase(page) !== undefined || page.config !== null || !page.legacy || page.actualLocale === "en"); }
export async function builderDetailMetadata(tenant: string, locale: M4Locale, kind: M4Kind, slug: string): Promise<Metadata> {
  const page = await loadBuilderPage(tenant, locale, kind, slug); return page ? publicPageMetadata(page) : { title: locale === "en" ? "Page not found" : "Không tìm thấy trang", robots: { index: false, follow: false } };
}
export async function BuilderDetail({ tenant, locale, kind, slug, searchParams = {} }: { tenant: string; locale: M4Locale; kind: M4Kind; slug: string; searchParams?: PublicSearchParams }) {
  const page = await loadBuilderPage(tenant, locale, kind, slug); if (!page) notFound();
  return <ResolvedBuilderDetail page={page} tenant={tenant} searchParams={searchParams}/>;
}
export function ResolvedBuilderDetail({ page, tenant, searchParams = {} }: { page: PublicM4Page; tenant: string; searchParams?: PublicSearchParams }) {
  if (page.kind === "home" && page.config?.content.theme === "signature" && searchParams.q !== undefined) return <SignatureSearch page={page} tenant={tenant} params={searchParams}/>;
  const tracking = safeTracking(new URLSearchParams(Object.entries(searchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])));
  return <><BuilderPage page={page} tenant={tenant} tracking={tracking} related={<BuilderRelated page={page} tenant={tenant}/>}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(pageStructuredData(page, tenant)) }}/></>;
}
async function BuilderRelated({ page, tenant }: { page: PublicM4Page; tenant: string }) {
  if (page.config?.content.theme === "signature") {
    const queries = signatureRelatedQueries(page), locale = page.actualLocale, base = publicUrlBase(page);
    const lists = await Promise.all(queries.map(({ kind, query }) => loadBuilderList(tenant, locale, kind, builderListSearch(query))));
    return <>{lists.map((list, index) => {
      if (!list || (!list.items.length && !list.nextCursor)) return null;
      const { kind, query } = queries[index], href = publicHref(tenant, locale, kind, undefined, base);
      return <section className={`builder-section section-related-${kind}`} key={kind}><h2>{signatureKindLabel(locale, kind)}</h2>{list.items.length > 0 && <SignatureCollections references={list.items} locale={locale} urlBase={base}/>}<nav className="public-pagination" aria-label={locale === "en" ? "Related pages" : "Danh sách liên quan"}><a href={href + builderListSearch(query)}>{locale === "en" ? "View the full list" : "Xem danh sách đầy đủ"}</a>{list.nextCursor && <a href={href + builderListSearch({ ...query, cursor: list.nextCursor })}>{locale === "en" ? "Next page" : "Trang tiếp"}</a>}</nav></section>;
    })}</>;
  }
  const kinds: M4Kind[] = page.kind === "service" ? ["price", "doctor", "case", "article"] : page.kind === "specialty" ? ["service", "doctor"] : page.kind === "service_group" ? ["service"] : page.kind === "category" ? ["article"] : page.kind === "location" ? ["service", "doctor", "price"] : [];
  const locale = page.actualLocale, query = { referenceKind: page.kind as ReferenceKind, referenceId: page.id }, search = builderListSearch(query);
  const lists = await Promise.all(kinds.map(kind => loadBuilderList(tenant, locale, kind, search)));
  return <>{lists.map((list, index) => !list?.items.length ? null : <section className="builder-section" key={kinds[index]}><h2>{BUILDER_LABELS[locale][kinds[index]]}</h2><BuilderCards urlBase={publicUrlBase(page)} references={list.items} locale={locale}/><nav className="public-pagination" aria-label={locale === "en" ? "Related pages" : "Danh sách liên quan"}><a href={publicHref(tenant, locale, kinds[index], undefined, publicUrlBase(page)) + search}>{locale === "en" ? "View the full list" : "Xem danh sách đầy đủ"}</a>{list.nextCursor && <a href={publicHref(tenant, locale, kinds[index], undefined, publicUrlBase(page)) + builderListSearch({ ...query, cursor: list.nextCursor })}>{locale === "en" ? "Next page" : "Trang tiếp"}</a>}</nav></section>)}</>;
}
export const listingAlternates = cache(async (tenant: string, locale: M4Locale, kind: M4Kind, canonical: string) => {
  // Language metadata needs the eligible list identity, not the full first page.
  const otherLocale = locale === "en" ? "vi" : "en", other = await loadBuilderList(tenant, otherLocale, kind, builderListSearch({ pageSize: 1 }));
  return [{ locale, url: canonical }, ...(other ? [{ locale: otherLocale as M4Locale, url: other.canonicalUrl }] : [])];
});
export async function listingPageMetadata(page: M4PublicList, tenant: string, locale: M4Locale, kind: M4Kind): Promise<Metadata> {
  const alternates = await listingAlternates(tenant, locale, kind, page.canonicalUrl), title = `${page.config?.content.theme === "signature" ? signatureKindLabel(locale, kind) : BUILDER_LABELS[locale][kind]}${page.config ? ` | ${page.config.content.name}` : ""}`;
  return { title, alternates: { canonical: page.canonicalUrl, languages: Object.fromEntries(alternates.map(item => [item.locale, item.url])) }, robots: { index: false, follow: false }, openGraph: { title, url: page.canonicalUrl, type: "website" } };
}
export async function builderListingMetadata(tenant: string, locale: M4Locale, kind: M4Kind, params: PublicSearchParams): Promise<Metadata> {
  try { const query = parseBuilderQuery(params), page = await loadBuilderList(tenant, locale, kind, builderListSearch(query)); return page ? listingPageMetadata(page, tenant, locale, kind) : { title: locale === "en" ? "Page not found" : "Không tìm thấy trang", robots: { index: false, follow: false } }; }
  catch (error) { if (!(error instanceof InvalidBuilderQuery)) throw error; return { title: locale === "en" ? "Invalid filter" : "Bộ lọc không hợp lệ", robots: { index: false, follow: false } }; }
}
export async function BuilderListRoute({ tenant, locale, kind, searchParams }: { tenant: string; locale: M4Locale; kind: M4Kind; searchParams: PublicSearchParams }) {
  let query: BuilderListQuery;
  try { query = parseBuilderQuery(searchParams); }
  catch (error) {
    if (!(error instanceof InvalidBuilderQuery)) throw error;
    const trusted = await headers(), context = entryFromHeaders(trusted, tenant);
    const listHref = publicHref(tenant, locale, kind, undefined, context.primary);
    return <main className="content-page"><h1>{locale === "en" ? "Invalid filter" : "Bộ lọc không hợp lệ"}</h1><a href={listHref}>{locale === "en" ? "Open the list" : "Mở danh sách"}</a></main>;
  }
  const page = await loadBuilderList(tenant, locale, kind, builderListSearch(query)); if (!page) notFound(); return <BuilderListing page={page} tenant={tenant} kind={kind} locale={locale} query={query} alternates={await listingAlternates(tenant, locale, kind, page.canonicalUrl)}/>;
}
