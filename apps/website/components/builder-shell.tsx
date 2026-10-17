import { navigationHref, publicPath, type PublicUrlBase } from "../lib/public-url-context";
import type { ReactNode } from "react";
import { type M4Locale, type M4PublicConfig, type PublicM4Page } from "../../api/src/contracts/m4";
import type { PublicMediaBlock } from "../../api/src/contracts/s07";
import type { SiteFooter } from "../../api/src/contracts/s03";
import { RichText } from "./rich-text";
import { SignatureFrame, type SignatureContact, type SignatureNavigation } from "./signature-ui";
import type { M4PublicReference, M4ResolvedNavigationNode } from "../../api/src/contracts/m4";

export function signatureNavigation(nodes: M4ResolvedNavigationNode[], urlBase?: PublicUrlBase): SignatureNavigation[] { return nodes.map(node => ({ id: node.id, label: node.label, ...(node.path ? { href: navigationHref(node.path, urlBase) } : {}), locale: node.actualLocale, children: signatureNavigation(node.children, urlBase) })); }
export function signatureContact(reference: M4PublicReference | null | undefined, urlBase?: PublicUrlBase): SignatureContact | undefined {
  if (!reference || !("kind" in reference.content) || reference.content.kind !== "location") return undefined;
  const content = reference.content, en = reference.locale === "en";
  const schedules = new Map<string, number[]>(); content.openingHours.forEach(day => { const schedule = day.closed ? en ? "Closed" : "Nghỉ" : day.intervals.map(interval => `${interval.opens}–${interval.closes}`).join(", "); if (schedule) schedules.set(schedule, [...(schedules.get(schedule) ?? []), day.day]); });
  const days = en ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return { id: reference.id, title: reference.title, address: content.address, phone: content.phone, email: content.email, href: navigationHref(reference.path, urlBase), hours: schedules.size > 0 ? <div>{[...schedules].map(([hours, weekday]) => <p key={hours}>{weekday.map(day => days[day]).join(", ")}: {hours}</p>)}</div> : undefined };
}
export function signatureNewsNode(nodes: M4ResolvedNavigationNode[]): M4ResolvedNavigationNode | undefined { for (const node of nodes) { if (node.type === "listing" && node.path?.endsWith("/bai-viet")) return node; const child = signatureNewsNode(node.children); if (child) return child; } return undefined; }

export function BuilderImage({ image, eager = false, className = "public-image" }: { image: PublicMediaBlock; eager?: boolean; className?: string }) {
  // Direct current-eligibility gateway. A Next image cache must not serve withdrawn bytes.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={`http://127.0.0.1:5890${image.path}`} alt={image.alt} width={image.width} height={image.height} loading={eager ? "eager" : "lazy"}/>;
}
export function PresentationShell({ config, site, tenant, locale, currentPath, alternates = [], publicationId, children, urlBase }: { config: M4PublicConfig | null; site: { name: string; footer: SiteFooter }; tenant: string; locale: M4Locale; currentPath: string; alternates?: Pick<PublicM4Page["alternates"][number], "locale" | "url">[]; publicationId?: string; children: ReactNode; urlBase?: PublicUrlBase }) {
  const presentation = config?.content, en = locale === "en";
  const homePath = publicPath(tenant, locale, "home", undefined, urlBase), homeEligible = currentPath === homePath || config?.menu.some(item => item.target.kind === "home" && item.path === homePath);
  const brand = <>{config?.logoMedia && <BuilderImage image={config.logoMedia} eager className="builder-logo"/>}<span>{site.name}</span></>;
  const news = signatureNewsNode(config?.signature?.navigation ?? []);
  if (presentation?.theme === "signature") return <SignatureFrame palette={presentation.palette} font={presentation.font} layout={presentation.layout} name={site.name} locale={locale} logo={config?.logoMedia ? <BuilderImage image={config.logoMedia} eager className="builder-logo"/> : undefined} homeHref={navigationHref(homePath, urlBase)} currentPath={navigationHref(currentPath, urlBase)} newsLink={news?.path ? { label: en ? "News & knowledge" : "Tin tức & kiến thức", href: navigationHref(news.path, urlBase) } : undefined} menu={signatureNavigation(config?.signature?.navigation ?? [], urlBase)} headerContact={signatureContact(config?.signature?.headerLocation, urlBase)} contacts={(config?.signature?.footerLocations ?? []).flatMap(reference => { const contact = signatureContact(reference, urlBase); return contact ? [contact] : []; })} languages={alternates.map(item => ({ locale: item.locale, href: item.url }))} searchHref={navigationHref(homePath, urlBase)} consultationHref={navigationHref(`${homePath}#consultation`, urlBase)} footer={<>{site.footer.intro && <p>{site.footer.intro}</p>}<RichText document={site.footer.body}/></>} publicationId={publicationId} configPublicationId={config?.publicationId}>{children}</SignatureFrame>;
  return <div className={`builder-site theme-${presentation?.theme ?? "clarity"} palette-${presentation?.palette ?? "teal"} font-${presentation?.font ?? "system"} layout-${presentation?.layout ?? "comfortable"}`} data-publication={publicationId} data-config-publication={config?.publicationId}>
    <a className="skip" href="#main-content">{en ? "Skip to content" : "Đến nội dung chính"}</a>
    <header className="builder-header">{homeEligible ? <a className="builder-brand" href={navigationHref(homePath, urlBase)}>{brand}</a> : <span className="builder-brand">{brand}</span>}
      {!!config?.menu.length && <details className="builder-menu"><summary>{en ? "Menu" : "Danh mục"}</summary><nav aria-label={en ? "Website navigation" : "Điều hướng website"}><ul>{config.menu.map(item => <li key={item.id}><a href={navigationHref(item.path, urlBase)} lang={item.actualLocale} aria-current={item.path === currentPath ? "page" : undefined}>{item.label}{item.actualLocale !== locale && <span className="language-note"> ({item.actualLocale === "vi" ? "Tiếng Việt" : "English"})</span>}</a></li>)}</ul></nav></details>}
      <nav className="language-switch" aria-label={en ? "Language" : "Ngôn ngữ"}>{(["vi", "en"] as const).map(language => { const alternate = alternates.find(item => item.locale === language); return alternate ? <a key={language} href={alternate.url} hrefLang={language} lang={language} aria-current={language === locale ? "page" : undefined}>{language === "vi" ? "Tiếng Việt" : "English"}</a> : language === "en" && locale === "vi" ? <a key={language} href={navigationHref(currentPath, urlBase)} lang="vi">English <span className="language-note">(nội dung Tiếng Việt)</span></a> : <span key={language}>{language === "vi" ? "Tiếng Việt (unavailable)" : "English (unavailable)"}</span>; })}</nav>
    </header>
    <main id="main-content" className="builder-main">{children}</main>
    <footer className="builder-footer">{site.footer.intro && <p>{site.footer.intro}</p>}<RichText document={site.footer.body}/></footer>
  </div>;
}
