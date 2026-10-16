import { navigationHref, publicPath, publicUrlBase } from "../lib/public-url-context";
import type { ReactNode } from "react";
import type { DentalContent } from "../../api/src/contracts/m3";
import { type M4IntakeInput, type PublicM4Page } from "../../api/src/contracts/m4";
import { BUILDER_LABELS } from "../lib/builder-routing";
import { BuilderConsultationForm } from "./builder-consultation-form";
import { BuilderCards, PromotionBlock } from "./builder-content";
import { BuilderImage, PresentationShell } from "./builder-shell";
import { ContentBody, PublicMedia } from "./public-content";
import { RichText } from "./rich-text";

/** Both public and saved-preview consumers use the same resolved section model. */
export function BuilderPage({ page, tenant, tracking, related }: { page: PublicM4Page; tenant: string; tracking?: M4IntakeInput["tracking"]; related?: ReactNode }) {
  const locale = page.actualLocale, en = locale === "en", content = page.content;
  const builder = "sections" in content, firstHero = builder ? page.sections.find(item => item.section.type === "hero")?.section.id : undefined;
  const inactive = page.sections.some(item => item.promotion && item.promotion.promotionState !== "active");
  const homePath = publicPath(tenant, locale, "home", undefined, publicUrlBase(page)), homeEligible = page.config?.menu.some(item => item.target.kind === "home" && item.path === homePath);
  return <PresentationShell urlBase={publicUrlBase(page)} config={page.config} site={page.site} tenant={tenant} locale={locale} currentPath={new URL(page.canonicalUrl).pathname} alternates={page.alternates} publicationId={page.publicationId}>
    {page.kind !== "home" && <nav className="breadcrumbs" aria-label={en ? "Breadcrumb" : "Đường dẫn"}><ol>{homeEligible && <li><a href={navigationHref(homePath, publicUrlBase(page))}>{BUILDER_LABELS[locale].home}</a></li>}<li aria-current="page">{"title" in content ? content.title : BUILDER_LABELS[locale][page.kind]}</li></ol></nav>}
    {inactive && <p className="offer-notice" role="status">{en ? "The promotion shown on this page is not active. New offer requests are unavailable." : "Chương trình trên trang hiện chưa bắt đầu hoặc đã kết thúc. Trang không nhận yêu cầu ưu đãi mới."}</p>}
    {builder ? <>
      {!firstHero && <h1>{content.title}</h1>}
      {page.sections.map(item => { const section = item.section; if (section.hidden) return null;
        if (section.type === "hero") { const Heading = firstHero === section.id ? "h1" : "h2"; return <section key={section.id} className={`builder-hero${item.media ? " has-image" : ""}`} aria-labelledby={`section-${section.id}`}><div className="builder-hero-copy"><p className="eyebrow">{page.site.name}</p><Heading id={`section-${section.id}`}>{section.title}</Heading>{section.text && <p className="builder-intro">{section.text}</p>}{item.action && !inactive && <a className="builder-action" href={navigationHref(item.action.path, publicUrlBase(page))} lang={item.action.actualLocale}>{item.action.label}{item.action.actualLocale !== locale && <span> ({item.action.actualLocale === "vi" ? "Tiếng Việt" : "English"})</span>}</a>}</div>{item.media && <BuilderImage image={item.media} eager className="builder-hero-image"/>}</section>; }
        if (section.type === "rich_text") return <section className="builder-prose" key={section.id}><RichText document={section.body}/></section>;
        if (section.type === "consultation") return <section key={section.id}>{item.promotion && <PromotionBlock urlBase={publicUrlBase(page)} promotion={item.promotion} locale={locale}/>} {item.form ? <BuilderConsultationForm tenant={tenant} slug={"slug" in content ? content.slug : ""} context={item.form} title={section.title} tracking={tracking}/> : <p className="public-empty">{en ? "This page is not accepting new consultation requests." : "Trang hiện không nhận yêu cầu tư vấn mới."}</p>}</section>;
        return <section className={`builder-section section-${section.type}`} key={section.id}>{section.title && <h2>{section.title}</h2>}{section.type === "promotion" ? item.promotion && <PromotionBlock urlBase={publicUrlBase(page)} promotion={item.promotion} locale={locale}/> : <BuilderCards urlBase={publicUrlBase(page)} references={item.references} locale={locale}/>}</section>;
      })}
    </> : <article className={`builder-resource kind-${page.kind}${page.media.some(item => item.slot === "image") ? " has-portrait" : ""}`}><div className="builder-resource-heading"><p className="eyebrow">{BUILDER_LABELS[locale][page.kind]}</p><h1>{"title" in content ? content.title : page.site.name}</h1></div>
      {page.kind === "promotion" ? <PromotionBlock urlBase={publicUrlBase(page)} promotion={page} locale={locale} heading={false}/> : "kind" in content ? <ContentBody content={content as DentalContent} media={page.media} locale={locale}/> : "body" in content ? <>{content.summary && <p className="content-intro">{content.summary}</p>}<PublicMedia kind="service" media={page.media} locale={locale}/><RichText document={content.body}/></> : null}
    </article>}
    {!builder && page.references.length > 0 && <section className="builder-section"><h2>{en ? "Related information" : "Thông tin liên quan"}</h2><BuilderCards urlBase={publicUrlBase(page)} references={page.references} locale={locale}/></section>}
    {related}
    {!builder && page.form && "slug" in content && <BuilderConsultationForm tenant={tenant} slug={content.slug} context={page.form} tracking={tracking}/>}
  </PresentationShell>;
}
