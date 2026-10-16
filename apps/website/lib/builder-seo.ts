import type { Metadata } from "next";
import { richTextPlain } from "../../api/src/contracts/content";
import { type PublicM4Page } from "../../api/src/contracts/m4";
import { publicPath, publicUrlBase } from "./public-url-context";
import { PUBLIC_SITE_ORIGIN } from "../../api/src/contracts/s03";
import { BUILDER_LABELS } from "./builder-routing";

export function publicPageMetadata(page: PublicM4Page): Metadata {
  const content = page.content, en = page.actualLocale === "en", seo = "seo" in content ? content.seo : { title: "", description: "" };
  let title = seo.title || `${"title" in content ? content.title : page.site.name} | ${page.site.name}`;
  let description = seo.description || ("summary" in content ? content.summary : "");
  const inactive = page.promotionState === "expired" || page.promotionState === "upcoming" || page.sections.some(item => item.promotion && item.promotion.promotionState !== "active");
  if (inactive) { title = `${en ? "Offer unavailable" : "Ưu đãi hiện chưa áp dụng"} — ${title}`; description = `${en ? "This promotion is not active. New offer requests are unavailable." : "Chương trình hiện chưa bắt đầu hoặc đã kết thúc. Trang không nhận yêu cầu ưu đãi mới."} ${description}`.trim(); }
  const image = page.media[0]?.media ?? page.sections.find(item => item.media)?.media ?? page.config?.logoMedia;
  const images = image ? [{ url: `http://127.0.0.1:5890${image.path}`, alt: image.alt, width: image.width, height: image.height }] : [];
  return { title, description, alternates: { canonical: page.canonicalUrl, languages: Object.fromEntries(page.alternates.map(item => [item.locale, item.url])) }, robots: { index: false, follow: false }, openGraph: { title, description, url: page.canonicalUrl, type: page.kind === "article" ? "article" : "website", images }, twitter: { card: images.length ? "summary_large_image" : "summary", title, description, images: images.map(item => item.url) } };
}
/** JSON inside a script element must escape HTML delimiters as well as JSON strings. */
export function safeJsonLd(value: unknown): string { return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`); }
export function pageStructuredData(page: PublicM4Page, tenant: string): unknown[] {
  const content = page.content, locale = page.actualLocale;
  const organization = { "@type": "Organization", "@id": (publicUrlBase(page)?.origin ?? PUBLIC_SITE_ORIGIN) + publicPath(tenant, locale, "home", undefined, publicUrlBase(page)) + "#organization", name: page.site.name, url: (publicUrlBase(page)?.origin ?? PUBLIC_SITE_ORIGIN) + publicPath(tenant, locale, "home", undefined, publicUrlBase(page)) };
  const result: unknown[] = [{ "@context": "https://schema.org", ...organization }];
  if (!("title" in content)) return result;
  const homeEligible = page.kind === "home" || page.config?.menu.some(item => item.target.kind === "home" && item.path === publicPath(tenant, locale, "home", undefined, publicUrlBase(page)));
  const crumbs = [...(homeEligible ? [{ name: BUILDER_LABELS[locale].home, item: organization.url }] : []), ...(page.kind === "home" ? [] : [{ name: content.title, item: page.canonicalUrl }])];
  result.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })) });
  const common = { "@context": "https://schema.org", name: content.title, url: page.canonicalUrl, inLanguage: locale, ...("summary" in content && content.summary ? { description: content.summary } : {}) };
  if (page.kind === "service") result.push({ ...common, "@type": "Service", provider: { "@id": organization["@id"] } });
  if ("kind" in content && content.kind === "doctor") result.push({ ...common, "@type": "Person", ...(content.professionalTitle ? { jobTitle: content.professionalTitle } : {}), ...(content.languages.length ? { knowsLanguage: content.languages } : {}), ...(content.credentials.length ? { hasCredential: content.credentials } : {}) });
  if ("kind" in content && content.kind === "location") result.push({ ...common, "@type": "Dentist", address: content.address, ...(content.phone ? { telephone: content.phone } : {}), ...(content.email ? { email: content.email } : {}), ...(content.mapUrl ? { hasMap: content.mapUrl } : {}), parentOrganization: { "@id": organization["@id"] }, openingHoursSpecification: content.openingHours.flatMap(day => day.closed ? [] : day.intervals.map(interval => ({ "@type": "OpeningHoursSpecification", dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day.day], opens: interval.opens, closes: interval.closes }))) });
  if ("kind" in content && content.kind === "article") result.push({ ...common, "@type": "Article", headline: content.title, articleBody: richTextPlain(content.body), datePublished: page.publishedAt, ...(content.attribution ? { creditText: content.attribution } : {}) });
  return result;
}
