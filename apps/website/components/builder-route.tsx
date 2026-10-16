import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { m4PublicPath, type M4Kind, type M4Locale, type M4PublicList, type PublicM4Page } from "../../api/src/contracts/m4";
import type { ReferenceKind } from "../../api/src/contracts/m3";
import { BUILDER_LABELS, InvalidBuilderQuery, parseBuilderQuery, safeTracking } from "../lib/builder-routing";
import { builderListSearch, readPublicBuilderList, readPublicBuilderPage, type BuilderListQuery } from "../lib/public-builder";
import { pageStructuredData, publicPageMetadata, safeJsonLd } from "../lib/builder-seo";
import type { PublicSearchParams } from "../lib/public-content";
import { BuilderPage } from "./builder-page";
import { BuilderListing } from "./builder-listing";
import { BuilderCards } from "./builder-content";

// Request-limited memoization makes metadata and body use the same parsed publication.
// Proxy is a separate preflight; expected identifiers fail closed if publication/config changes.
// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export const loadBuilderPage = cache(async (tenant: string, locale: M4Locale, kind: M4Kind, slug: string) => {
  const result = await readPublicBuilderPage(tenant, locale, kind, slug), trusted = await headers();
  const expectedPublication = trusted.get("x-gcms-expected-publication"), expectedConfig = trusted.get("x-gcms-expected-config");
  if (locale === "en" && (result?.resolution === "fallback" || (expectedPublication && (result?.resolution !== "page" || result.page.publicationId !== expectedPublication)) || (expectedConfig && (result?.resolution !== "page" || (result.page.configPublicationId ?? "none") !== expectedConfig)))) throw new Error("Public content changed; reload the page");
  return result?.resolution === "page" ? result.page : null;
});
export const loadBuilderList = cache(async (tenant: string, locale: M4Locale, kind: M4Kind, search: string) => {
  const page = await readPublicBuilderList(tenant, locale, kind, parseBuilderQuery(Object.fromEntries(new URLSearchParams(search))));
  const expected = (await headers()).get("x-gcms-expected-config");
  if (locale === "en" && expected && (page?.config?.publicationId ?? "none") !== expected) throw new Error("Public presentation changed; reload the page");
  return page;
});
export function usesBuilderPresentation(page: PublicM4Page | null): page is PublicM4Page { return page !== null && (page.config !== null || !page.legacy || page.actualLocale === "en"); }
export async function builderDetailMetadata(tenant: string, locale: M4Locale, kind: M4Kind, slug: string): Promise<Metadata> {
  const page = await loadBuilderPage(tenant, locale, kind, slug); return page ? publicPageMetadata(page) : { title: locale === "en" ? "Page not found" : "Không tìm thấy trang", robots: { index: false, follow: false } };
}
export async function BuilderDetail({ tenant, locale, kind, slug, searchParams = {} }: { tenant: string; locale: M4Locale; kind: M4Kind; slug: string; searchParams?: PublicSearchParams }) {
  const page = await loadBuilderPage(tenant, locale, kind, slug); if (!page) notFound();
  return <ResolvedBuilderDetail page={page} tenant={tenant} searchParams={searchParams}/>;
}
export function ResolvedBuilderDetail({ page, tenant, searchParams = {} }: { page: PublicM4Page; tenant: string; searchParams?: PublicSearchParams }) {
  const tracking = safeTracking(new URLSearchParams(Object.entries(searchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])));
  return <><BuilderPage page={page} tenant={tenant} tracking={tracking} related={<BuilderRelated page={page} tenant={tenant}/>}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(pageStructuredData(page)) }}/></>;
}
async function BuilderRelated({ page, tenant }: { page: PublicM4Page; tenant: string }) {
  const kinds: M4Kind[] = page.kind === "service" ? ["price", "doctor", "case", "article"] : page.kind === "specialty" ? ["service", "doctor"] : page.kind === "service_group" ? ["service"] : page.kind === "category" ? ["article"] : page.kind === "location" ? ["service", "doctor", "price"] : [];
  const locale = page.actualLocale, query = { referenceKind: page.kind as ReferenceKind, referenceId: page.id }, search = builderListSearch(query);
  const lists = await Promise.all(kinds.map(kind => loadBuilderList(tenant, locale, kind, search)));
  return <>{lists.map((list, index) => !list?.items.length ? null : <section className="builder-section" key={kinds[index]}><h2>{BUILDER_LABELS[locale][kinds[index]]}</h2><BuilderCards references={list.items} locale={locale}/><nav className="public-pagination" aria-label={locale === "en" ? "Related pages" : "Danh sách liên quan"}><a href={m4PublicPath(tenant, locale, kinds[index]) + search}>{locale === "en" ? "View the full list" : "Xem danh sách đầy đủ"}</a>{list.nextCursor && <a href={m4PublicPath(tenant, locale, kinds[index]) + builderListSearch({ ...query, cursor: list.nextCursor })}>{locale === "en" ? "Next page" : "Trang tiếp"}</a>}</nav></section>)}</>;
}
export const listingAlternates = cache(async (tenant: string, locale: M4Locale, kind: M4Kind, canonical: string) => {
  const otherLocale = locale === "en" ? "vi" : "en", other = await loadBuilderList(tenant, otherLocale, kind, "");
  return [{ locale, url: canonical }, ...(other ? [{ locale: otherLocale as M4Locale, url: other.canonicalUrl }] : [])];
});
export async function listingPageMetadata(page: M4PublicList, tenant: string, locale: M4Locale, kind: M4Kind): Promise<Metadata> {
  const alternates = await listingAlternates(tenant, locale, kind, page.canonicalUrl), title = `${BUILDER_LABELS[locale][kind]}${page.config ? ` | ${page.config.content.name}` : ""}`;
  return { title, alternates: { canonical: page.canonicalUrl, languages: Object.fromEntries(alternates.map(item => [item.locale, item.url])) }, robots: { index: false, follow: false }, openGraph: { title, url: page.canonicalUrl, type: "website" } };
}
export async function builderListingMetadata(tenant: string, locale: M4Locale, kind: M4Kind, params: PublicSearchParams): Promise<Metadata> {
  try { const query = parseBuilderQuery(params), page = await loadBuilderList(tenant, locale, kind, builderListSearch(query)); return page ? listingPageMetadata(page, tenant, locale, kind) : { title: locale === "en" ? "Page not found" : "Không tìm thấy trang", robots: { index: false, follow: false } }; }
  catch (error) { if (!(error instanceof InvalidBuilderQuery)) throw error; return { title: locale === "en" ? "Invalid filter" : "Bộ lọc không hợp lệ", robots: { index: false, follow: false } }; }
}
export async function BuilderListRoute({ tenant, locale, kind, searchParams }: { tenant: string; locale: M4Locale; kind: M4Kind; searchParams: PublicSearchParams }) {
  let query: BuilderListQuery;
  try { query = parseBuilderQuery(searchParams); } catch (error) { if (!(error instanceof InvalidBuilderQuery)) throw error; return <main className="content-page"><h1>{locale === "en" ? "Invalid filter" : "Bộ lọc không hợp lệ"}</h1><a href={m4PublicPath(tenant, locale, kind)}>{locale === "en" ? "Open the list" : "Mở danh sách"}</a></main>; }
  const page = await loadBuilderList(tenant, locale, kind, builderListSearch(query)); if (!page) notFound(); return <BuilderListing page={page} tenant={tenant} kind={kind} locale={locale} query={query} alternates={await listingAlternates(tenant, locale, kind, page.canonicalUrl)}/>;
}
