import type { M4Locale, M4PromotionBlock } from "../../api/src/contracts/m4";
import type { PublicUrlBase } from "../lib/public-url-context";
import { withoutRepeatedIntro } from "../lib/signature-presentation";
import { RichText } from "./rich-text";
import { SignatureCollections } from "./signature-collections";
export function SignaturePromotion({ promotion, locale, urlBase }: { promotion: Omit<M4PromotionBlock, "publishedAt">; locale: M4Locale; urlBase?: PublicUrlBase }) {
  const content = promotion.content; if (!("kind" in content) || content.kind !== "promotion") return null;
  const en = locale === "en", status = promotion.promotionState === "active" ? en ? "Active campaign" : "Chương trình đang hiệu lực" : promotion.promotionState === "upcoming" ? en ? "This campaign has not started" : "Chương trình chưa bắt đầu" : en ? "This campaign has ended" : "Chương trình đã kết thúc", date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: content.authoredTimezone }).format(new Date(value));
  return <div className={`signature-promotion-block state-${promotion.promotionState}`}><p className="signature-campaign-status">{status}</p><h3>{content.title}</h3>{content.summary && <p>{content.summary}</p>}<p className="signature-campaign-dates">{date(content.startAt)} – {date(content.endAt)} ({content.authoredTimezone})</p><RichText document={withoutRepeatedIntro(content.body, content.summary)}/><h4>{en ? "Conditions" : "Điều kiện áp dụng"}</h4><p>{content.conditions}</p>{promotion.references.length > 0 && <SignatureCollections references={promotion.references} locale={locale} urlBase={urlBase}/>}</div>;
}
