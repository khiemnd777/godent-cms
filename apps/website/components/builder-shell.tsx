import type { ReactNode } from "react";
import { m4PublicPath, type M4Locale, type M4PublicConfig, type PublicM4Page } from "../../api/src/contracts/m4";
import type { PublicMediaBlock } from "../../api/src/contracts/s07";
import type { SiteFooter } from "../../api/src/contracts/s03";
import { RichText } from "./rich-text";

export function BuilderImage({ image, eager = false, className = "public-image" }: { image: PublicMediaBlock; eager?: boolean; className?: string }) {
  // Direct current-eligibility gateway. A Next image cache must not serve withdrawn bytes.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={`http://127.0.0.1:5890${image.path}`} alt={image.alt} width={image.width} height={image.height} loading={eager ? "eager" : "lazy"}/>;
}
export function PresentationShell({ config, site, tenant, locale, currentPath, alternates = [], publicationId, children }: { config: M4PublicConfig | null; site: { name: string; footer: SiteFooter }; tenant: string; locale: M4Locale; currentPath: string; alternates?: Pick<PublicM4Page["alternates"][number], "locale" | "url">[]; publicationId?: string; children: ReactNode }) {
  const presentation = config?.content, en = locale === "en";
  const homePath = m4PublicPath(tenant, locale, "home"), homeEligible = currentPath === homePath || config?.menu.some(item => item.target.kind === "home" && item.path === homePath);
  const brand = <>{config?.logoMedia && <BuilderImage image={config.logoMedia} eager className="builder-logo"/>}<span>{site.name}</span></>;
  return <div className={`builder-site theme-${presentation?.theme ?? "clarity"} palette-${presentation?.palette ?? "teal"} font-${presentation?.font ?? "system"} layout-${presentation?.layout ?? "comfortable"}`} data-publication={publicationId} data-config-publication={config?.publicationId}>
    <a className="skip" href="#main-content">{en ? "Skip to content" : "Đến nội dung chính"}</a>
    <header className="builder-header">{homeEligible ? <a className="builder-brand" href={homePath}>{brand}</a> : <span className="builder-brand">{brand}</span>}
      {!!config?.menu.length && <details className="builder-menu"><summary>{en ? "Menu" : "Danh mục"}</summary><nav aria-label={en ? "Website navigation" : "Điều hướng website"}><ul>{config.menu.map(item => <li key={item.id}><a href={item.path} lang={item.actualLocale} aria-current={item.path === currentPath ? "page" : undefined}>{item.label}{item.actualLocale !== locale && <span className="language-note"> ({item.actualLocale === "vi" ? "Tiếng Việt" : "English"})</span>}</a></li>)}</ul></nav></details>}
      <nav className="language-switch" aria-label={en ? "Language" : "Ngôn ngữ"}>{(["vi", "en"] as const).map(language => { const alternate = alternates.find(item => item.locale === language); return alternate ? <a key={language} href={alternate.url} hrefLang={language} lang={language} aria-current={language === locale ? "page" : undefined}>{language === "vi" ? "Tiếng Việt" : "English"}</a> : language === "en" && locale === "vi" ? <a key={language} href={currentPath} lang="vi">English <span className="language-note">(nội dung Tiếng Việt)</span></a> : <span key={language}>{language === "vi" ? "Tiếng Việt (unavailable)" : "English (unavailable)"}</span>; })}</nav>
    </header>
    <main id="main-content" className="builder-main">{children}</main>
    <footer className="builder-footer">{site.footer.intro && <p>{site.footer.intro}</p>}<RichText document={site.footer.body}/></footer>
  </div>;
}
