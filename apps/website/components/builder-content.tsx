import type { DentalContent } from "../../api/src/contracts/m3";
import type { M4Locale, M4PromotionBlock, M4PublicReference } from "../../api/src/contracts/m4";
import { BUILDER_LABELS } from "../lib/builder-routing";
import { PriceDisplay, PublicMedia } from "./public-content";
import { RichText } from "./rich-text";

export function PromotionBlock({ promotion, locale, heading = true }: { promotion: M4PromotionBlock; locale: M4Locale; heading?: boolean }) {
  const content = promotion.content; if (!("kind" in content) || content.kind !== "promotion") return null;
  const en = locale === "en", status = promotion.promotionState === "active" ? (en ? "Active promotion" : "Chương trình đang hiệu lực") : promotion.promotionState === "upcoming" ? (en ? "This promotion has not started" : "Chương trình chưa bắt đầu") : (en ? "This promotion has ended" : "Chương trình đã kết thúc");
  const date = (instant: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: content.authoredTimezone }).format(new Date(instant));
  return <div className={`promotion-block state-${promotion.promotionState}`}><p className="promotion-status">{status}</p>{heading && <h3><a href={promotion.canonicalUrl}>{content.title}</a></h3>}
    {content.summary && <p>{content.summary}</p>}<p className="promotion-dates"><time dateTime={content.startAt}>{date(content.startAt)}</time> – <time dateTime={content.endAt}>{date(content.endAt)}</time> <span>({content.authoredTimezone})</span></p>
    <RichText document={content.body}/><h3>{en ? "Conditions" : "Điều kiện áp dụng"}</h3><p className="promotion-conditions">{content.conditions}</p><BuilderCards references={promotion.references} locale={locale}/>
  </div>;
}
export function BuilderCards({ references, locale, nested = true }: { references: (M4PublicReference & { promotionState?: "upcoming" | "active" | "expired" | null })[]; locale: M4Locale; nested?: boolean }) {
  const en = locale === "en", Heading = nested ? "h3" : "h2";
  if (!references.length) return <p className="public-empty" role="status">{en ? "No eligible published content is available." : "Chưa có nội dung đã xuất bản phù hợp."}</p>;
  return <ul className="builder-cards">{references.map(ref => { const content = ref.content; return <li className={`builder-card kind-${ref.kind}`} key={`${ref.kind}-${ref.id}-${ref.publicationId}`}>
    <div className="builder-card-copy"><p className="eyebrow">{BUILDER_LABELS[locale][ref.kind]}</p><Heading><a href={ref.path}>{ref.title}</a></Heading>{"summary" in content && content.summary && <p>{content.summary}</p>}
      {ref.kind === "promotion" && ref.promotionState && <p className="promotion-status">{ref.promotionState === "active" ? (en ? "Active promotion" : "Đang hiệu lực") : ref.promotionState === "upcoming" ? (en ? "Not started" : "Chưa bắt đầu") : (en ? "Promotion ended" : "Đã kết thúc")}</p>}
      {"kind" in content && content.kind === "price" && <><PriceDisplay price={content.price} locale={locale}/>{content.inclusions && <p><strong>{en ? "Included:" : "Phần bao gồm:"}</strong> {content.inclusions}</p>}{content.notes && <p><strong>{en ? "Conditions:" : "Điều kiện:"}</strong> {content.notes}</p>}</>}
      {"kind" in content && content.kind === "location" && <p>{content.address}</p>}{"kind" in content && content.kind === "doctor" && content.professionalTitle && <p>{content.professionalTitle}</p>}
      {"kind" in content && content.kind === "testimonial" && <blockquote><p>{content.quote}</p><cite>{content.displayName}{content.attribution && ` — ${content.attribution}`}</cite></blockquote>}
      {"kind" in content && content.kind === "faq" && <details className="faq-answer"><summary>{en ? "Read the answer" : "Xem câu trả lời"}</summary><RichText document={content.body}/></details>}
    </div>{!["home", "page", "landing", "promotion"].includes(ref.kind) && <PublicMedia kind={ref.kind as DentalContent["kind"] | "service"} media={ref.media} locale={locale}/>}
  </li>; })}</ul>;
}
