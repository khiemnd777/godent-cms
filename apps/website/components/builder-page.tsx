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
import { SignatureCarousel } from "./signature-ui";
import { SignatureIntro } from "./signature-intro";
import { SignatureCollections, SignatureSupportingCollections } from "./signature-collections";
import { SignatureResource } from "./signature-resource";
import { SignaturePublicMedia } from "./signature-public-media";
import { SignaturePromotion } from "./signature-promotion";
import { SignatureProse } from "./signature-prose";
import { SignatureServiceBanner } from "./signature-service-banner";
import { SignatureImage } from "./signature-image";
import { SignatureUnavailableConsultation } from "./signature-unavailable-consultation";
import { SignaturePriceHeader, SignaturePriceIntroduction } from "./signature-price-header";
import { withoutRepeatedIntro } from "../lib/signature-presentation";

/** Both public and saved-preview consumers use the same resolved section model. */
export function BuilderPage({ page, tenant, tracking, related }: { page: PublicM4Page; tenant: string; tracking?: M4IntakeInput["tracking"]; related?: ReactNode }) {
  const locale = page.actualLocale, en = locale === "en", content = page.content;
  const signature = page.config?.content.theme === "signature";
  const serviceBanner = signature && page.kind === "service" && "title" in content && "summary" in content;
  const serviceImage = serviceBanner ? page.media.find(item => item.slot === "image" || item.slot === "cover") : undefined;
  const builder = "sections" in content, firstHero = builder ? page.sections.find(item => !item.section.hidden && (item.section.type === "hero" || item.section.type === "hero_carousel"))?.section.id : undefined;
  const compactConsultation = signature && page.kind === "home" && page.sections.find(item => item.section.id === firstHero)?.section.type === "hero_carousel" ? page.sections.find(item => item.section.type === "consultation" && !item.section.hidden) : undefined;
  const firstHeroSection = page.sections.find(item => item.section.id === firstHero), pricingHero = signature && builder && page.kind === "page" && page.sections.some(item => !item.section.hidden && item.section.type === "prices") && firstHeroSection?.section.type === "hero" ? firstHeroSection : undefined;
  const firstProse = page.sections.find(item => !item.section.hidden && item.section.type === "rich_text")?.section.id;
  const inactive = page.sections.some(item => item.promotion && item.promotion.promotionState !== "active");
  const homePath = publicPath(tenant, locale, "home", undefined, publicUrlBase(page)), homeEligible = page.config?.menu.some(item => item.target.kind === "home" && item.path === homePath) || page.config?.signature?.navigation.some(item => item.path === homePath);
  return <PresentationShell urlBase={publicUrlBase(page)} config={page.config} site={page.site} tenant={tenant} locale={locale} currentPath={new URL(page.canonicalUrl).pathname} alternates={page.alternates} publicationId={page.publicationId}>
    {serviceBanner && <><SignatureServiceBanner title={content.title} text={content.summary} image={serviceImage ? <SignatureImage image={serviceImage.media} locale={locale} eager/> : undefined}/><div id="consultation">{page.form && "slug" in content ? <BuilderConsultationForm compact instanceId="service-top" tenant={tenant} slug={content.slug} context={page.form} tracking={tracking}/> : <SignatureUnavailableConsultation locale={locale}/>}</div></>}
    {pricingHero?.section.type === "hero" && <SignaturePriceHeader title={pricingHero.section.title} image={pricingHero.media ? <SignatureImage image={pricingHero.media} locale={locale} eager/> : undefined}/>}
    {page.kind !== "home" && <nav className="breadcrumbs" aria-label={en ? "Breadcrumb" : "Đường dẫn"}><ol>{homeEligible && <li><a href={navigationHref(homePath, publicUrlBase(page))}>{BUILDER_LABELS[locale].home}</a></li>}<li aria-current="page">{"title" in content ? content.title : BUILDER_LABELS[locale][page.kind]}</li></ol></nav>}
    {pricingHero?.section.type === "hero" && <SignaturePriceIntroduction text={pricingHero.section.text} action={pricingHero.action ? { label: pricingHero.action.label, href: navigationHref(pricingHero.action.path, publicUrlBase(page)) } : null}/>}
    {inactive && <p className="offer-notice" role="status">{en ? "The promotion shown on this page is not active. New offer requests are unavailable." : "Chương trình trên trang hiện chưa bắt đầu hoặc đã kết thúc. Trang không nhận yêu cầu ưu đãi mới."}</p>}
    {builder ? <>
      {!firstHero && <h1>{content.title}</h1>}
      {page.sections.map(item => { const section = item.section; if (section.hidden) return null;
        if (section.id === pricingHero?.section.id) return null;
        if (section.type === "hero_carousel") return <div key={section.id}><SignatureCarousel locale={locale} autoplay={section.autoplay} intervalMs={section.intervalMs} mainHeading={firstHero === section.id} heroTypography={page.kind === "home" ? page.config?.content.signature?.heroTypography : undefined} slides={(item.slides ?? []).map(slide => ({ id: slide.id, title: slide.title, text: slide.text, highlight: slide.highlight, image: slide.media ? <BuilderImage image={slide.media} eager/> : undefined, action: slide.action && !inactive ? { label: slide.action.label, href: navigationHref(slide.action.path, publicUrlBase(page)), locale: slide.action.actualLocale } : null }))}/>{compactConsultation && firstHero === section.id && compactConsultation.section.type === "consultation" && <div id="consultation">{compactConsultation.form ? <BuilderConsultationForm compact tenant={tenant} slug={"slug" in content ? content.slug : "home"} context={compactConsultation.form} title={compactConsultation.section.title} tracking={tracking}/> : <SignatureUnavailableConsultation locale={locale} title={compactConsultation.section.title}/>}</div>}</div>;
        if (section.type === "hero" && signature) return <SignatureIntro key={section.id} id={section.id} brand={page.site.name} title={section.title} text={section.text} mainHeading={firstHero === section.id} image={item.media ? <BuilderImage image={item.media} eager className="builder-hero-image"/> : undefined} action={item.action && !inactive ? { label: item.action.label, href: navigationHref(item.action.path, publicUrlBase(page)), locale: item.action.actualLocale } : null}/>;
        if (section.type === "hero") { const Heading = firstHero === section.id ? "h1" : "h2"; return <section key={section.id} className={`builder-hero${item.media ? " has-image" : ""}`} aria-labelledby={`section-${section.id}`}><div className="builder-hero-copy"><p className="eyebrow">{page.site.name}</p><Heading id={`section-${section.id}`}>{section.title}</Heading>{section.text && <p className="builder-intro">{section.text}</p>}{item.action && !inactive && <a className="builder-action" href={navigationHref(item.action.path, publicUrlBase(page))} lang={item.action.actualLocale}>{item.action.label}{item.action.actualLocale !== locale && <span> ({item.action.actualLocale === "vi" ? "Tiếng Việt" : "English"})</span>}</a>}</div>{item.media && <BuilderImage image={item.media} eager className="builder-hero-image"/>}</section>; }
        if (section.type === "rich_text") { const document = pricingHero?.section.type === "hero" && section.id === firstProse ? withoutRepeatedIntro(section.body, pricingHero.section.text) : section.body; if (pricingHero && !document.blocks.length) return null; return <section className="builder-prose" key={section.id}>{signature ? <SignatureProse document={document} locale={locale} id={`section-${section.id}`}/> : <RichText document={document}/>}</section>; }
        if (section.type === "consultation" && compactConsultation?.section.id === section.id) return null;
        if (section.type === "consultation") return <section key={section.id} id="consultation">{item.promotion && (signature ? <SignaturePromotion urlBase={publicUrlBase(page)} promotion={item.promotion} locale={locale}/> : <PromotionBlock urlBase={publicUrlBase(page)} promotion={item.promotion} locale={locale}/>)} {item.form ? <BuilderConsultationForm tenant={tenant} slug={"slug" in content ? content.slug : ""} context={item.form} title={section.title} tracking={tracking}/> : <p className="public-empty">{en ? "This page is not accepting new consultation requests." : "Trang hiện không nhận yêu cầu tư vấn mới."}</p>}</section>;
        return <section className={`builder-section section-${section.type}`} key={section.id}>{section.title && <h2>{section.title}</h2>}{section.type === "promotion" ? item.promotion && (signature ? <SignaturePromotion urlBase={publicUrlBase(page)} promotion={item.promotion} locale={locale}/> : <PromotionBlock urlBase={publicUrlBase(page)} promotion={item.promotion} locale={locale}/>) : signature ? <SignatureCollections urlBase={publicUrlBase(page)} references={item.references} locale={locale}/> : <BuilderCards urlBase={publicUrlBase(page)} references={item.references} locale={locale}/>}</section>;
      })}
    </> : signature ? <SignatureResource mainHeading={!serviceBanner} kind={page.kind} content={content} locale={locale} references={page.references} media={<SignaturePublicMedia kind={page.kind} media={page.media} locale={locale}/>} consultationHref={navigationHref(`${homePath}#consultation`, publicUrlBase(page))} promotionState={page.promotionState} urlBase={publicUrlBase(page)}/> : <article className={`builder-resource kind-${page.kind}${page.media.some(item => item.slot === "image") ? " has-portrait" : ""}`}><div className="builder-resource-heading"><p className="eyebrow">{BUILDER_LABELS[locale][page.kind]}</p><h1>{"title" in content ? content.title : page.site.name}</h1></div>
      {page.kind === "promotion" ? <PromotionBlock urlBase={publicUrlBase(page)} promotion={page} locale={locale} heading={false}/> : "kind" in content ? <ContentBody content={content as DentalContent} media={page.media} locale={locale}/> : "body" in content ? <>{content.summary && <p className="content-intro">{content.summary}</p>}<PublicMedia kind="service" media={page.media} locale={locale}/><RichText document={content.body}/></> : null}
    </article>}
    {!builder && page.references.length > 0 && (signature ? <SignatureSupportingCollections urlBase={publicUrlBase(page)} references={page.references} locale={locale}/> : <section className="builder-section"><h2>{en ? "Related information" : "Thông tin liên quan"}</h2><BuilderCards urlBase={publicUrlBase(page)} references={page.references} locale={locale}/></section>)}
    {related}
    {!builder && page.form && "slug" in content && <BuilderConsultationForm instanceId={serviceBanner ? "service-details" : undefined} tenant={tenant} slug={content.slug} context={page.form} tracking={tracking}/>}
  </PresentationShell>;
}
