import { contentPublicPath, type ContentPrice, type ContentPublicMedia, type DentalContent, type PublicContentCard, type ReferenceKind, type ResolvedContentReference } from "../../api/src/contracts/m3";
import type { ContentListQuery } from "../../api/src/contracts/m3";
import { CONTENT_LABELS, publicListingPath } from "../lib/public-content";
import { formatDecimalAmount } from "../lib/price";
import { RichText } from "./rich-text";

export function PriceDisplay({ price, locale = "vi" }: { price: ContentPrice; locale?: "vi" | "en" }) {
  const format = (value: string) => locale === "vi" ? formatDecimalAmount(value) : formatDecimalAmount(value).replace(/\./g, "_").replace(/,/g, ".").replace(/_/g, ",");
  const amount = price.type === "range" ? `${format(price.minimum)} – ${format(price.maximum)}` : `${price.type === "from" ? (locale === "en" ? "From " : "Từ ") : ""}${format(price.amount)}`;
  return <p className="price-amount">{amount} {price.currency} / {price.unit}</p>;
}

/** Direct gateway requests keep current permission checks in the delivery path. */
export function PublicImage({ item }: { item: ContentPublicMedia }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="public-image" src={`http://127.0.0.1:5890${item.media.path}`} alt={item.media.alt} width={item.media.width} height={item.media.height} loading="lazy"/>;
}
export function PublicMedia({ kind, media, locale = "vi" }: { kind: ReferenceKind; media: ContentPublicMedia[]; locale?: "vi" | "en" }) {
  if (kind === "gallery") {
    const indices = [...new Set(media.flatMap(item => item.pairIndex === undefined ? [] : [item.pairIndex]))].sort((a, b) => a - b);
    return <>{indices.map(index => {
      const before = media.filter(item => item.pairIndex === index && item.slot === "before"), after = media.filter(item => item.pairIndex === index && item.slot === "after");
      // A single image, caption or alt must never survive an incomplete pair.
      if (before.length !== 1 || after.length !== 1 || before[0].media.assetId === after[0].media.assetId) return null;
      return <div className="gallery-pair" key={index}>{[{ item: before[0], label: locale === "en" ? "Before" : "Trước" }, { item: after[0], label: locale === "en" ? "After" : "Sau" }].map(({ item, label }) => <figure key={label}><PublicImage item={item}/><figcaption><strong>{label}</strong>{item.caption && <span> — {item.caption}</span>}</figcaption></figure>)}</div>;
    })}</>;
  }
  const item = media.find(item => item.slot === "image");
  return item ? <figure className="public-figure"><PublicImage item={item}/>{item.caption && <figcaption>{item.caption}</figcaption>}</figure> : null;
}
const dayNames = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
export function ContentBody({ content, media, locale = "vi" }: { content: DentalContent; media: ContentPublicMedia[]; locale?: "vi" | "en" }) {
  const t = (vi: string, en: string) => locale === "en" ? en : vi;
  return <>
    {content.summary && <p className="content-intro">{content.summary}</p>}
    <PublicMedia kind={content.kind} media={media} locale={locale}/>
    {content.kind === "location" && <dl className="public-details">
      <dt>{t("Địa chỉ", "Address")}</dt><dd>{content.address}</dd>
      {content.phone && <><dt>{t("Điện thoại", "Phone")}</dt><dd>{content.phone}</dd></>}
      {content.email && <><dt>Email</dt><dd>{content.email}</dd></>}
      {content.mapUrl && <><dt>{t("Bản đồ", "Map")}</dt><dd><a href={content.mapUrl} rel="noopener noreferrer">{t("Xem bản đồ", "View map")}</a></dd></>}
      {content.openingHours.length > 0 && <><dt>{t("Giờ mở cửa", "Opening hours")}</dt><dd>{content.openingHours.map(day => <div key={day.day}><strong>{locale === "en" ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day.day] : dayNames[day.day]}</strong>: {day.closed ? t("Nghỉ", "Closed") : day.intervals.length ? day.intervals.map(interval => `${interval.opens}–${interval.closes}`).join(", ") : t("Chưa nêu giờ mở cửa", "Opening hours not specified")}</div>)}</dd></>}
    </dl>}
    {content.kind === "doctor" && <dl className="public-details">
      {content.professionalTitle && <><dt>{t("Chức danh", "Professional title")}</dt><dd>{content.professionalTitle}</dd></>}
      {content.credentials.length > 0 && <><dt>{t("Bằng cấp, chứng chỉ", "Qualifications")}</dt><dd><ul>{content.credentials.map((item, index) => <li key={index}>{item}</li>)}</ul></dd></>}
      {content.languages.length > 0 && <><dt>{t("Ngôn ngữ", "Languages")}</dt><dd>{content.languages.join(", ")}</dd></>}
    </dl>}
    {content.kind === "price" && <><PriceDisplay price={content.price} locale={locale}/>{content.inclusions && <p><strong>{t("Phần bao gồm:", "Included:")}</strong> {content.inclusions}</p>}{content.notes && <p><strong>{t("Điều kiện và ghi chú:", "Conditions and notes:")}</strong> {content.notes}</p>}</>}
    {content.kind === "testimonial" && <blockquote className="testimonial-quote"><p>{content.quote}</p><cite>{content.displayName}{content.attribution && ` — ${content.attribution}`}</cite></blockquote>}
    {content.kind === "article" && content.attribution && <p className="content-attribution">{content.attribution}</p>}
    <RichText document={content.body}/>
  </>;
}

export function RelatedContent({ references }: { references: ResolvedContentReference[] }) {
  const groups = [...new Set(references.map(ref => ref.kind))];
  return <>{groups.map(kind => <section className="related-section" key={kind} aria-label={`${CONTENT_LABELS[kind].plural} liên quan`}>
    <h2>{CONTENT_LABELS[kind].plural} liên quan</h2>
    {kind === "faq" ? <div className="faq-list">{references.filter(ref => ref.kind === kind).map(ref => <details key={ref.publicationId}><summary>{ref.title}</summary>{ref.content.kind !== "service" && <RichText document={ref.content.body}/>}</details>)}</div> : <ul className="content-list">{references.filter(ref => ref.kind === kind).map(ref => <li className="content-card" key={`${ref.id}-${ref.publicationId}`}>
      <h3><a href={ref.path}>{ref.title}</a></h3>
      {ref.content.summary && <p>{ref.content.summary}</p>}
      {ref.content.kind === "price" && <><PriceDisplay price={ref.content.price}/>{ref.content.inclusions && <p>{ref.content.inclusions}</p>}{ref.content.notes && <p>{ref.content.notes}</p>}</>}
      {ref.content.kind === "location" && <p>{ref.content.address}</p>}
      {ref.content.kind === "testimonial" && <blockquote><p>{ref.content.quote}</p><cite>{ref.content.displayName}</cite></blockquote>}
      <PublicMedia kind={ref.kind} media={ref.media}/>
    </li>)}</ul>}
  </section>)}</>;
}

export function PublicCards({ items, nested = false }: { items: PublicContentCard[]; nested?: boolean }) {
  if (!items.length) return <p className="public-empty" role="status">Chưa có nội dung đã xuất bản phù hợp.</p>;
  const Heading = nested ? "h3" : "h2";
  return <ul className="content-list">{items.map(item => <li className="content-card" key={item.publicationId}>
    <Heading><a href={item.path}>{item.title}</a></Heading>{item.summary && <p>{item.summary}</p>}
    {item.price && <><PriceDisplay price={item.price}/>{item.inclusions && <p><strong>Phần bao gồm:</strong> {item.inclusions}</p>}{item.notes && <p><strong>Điều kiện và ghi chú:</strong> {item.notes}</p>}{!!item.locations?.length && <p>Cơ sở: {item.locations.map((location, index) => <span key={location.path}>{index > 0 && ", "}<a href={location.path}>{location.title}</a></span>)}</p>}</>}
    {item.answer && <details className="faq-answer"><summary>Xem câu trả lời</summary><RichText document={item.answer}/></details>}
  </li>)}</ul>;
}

export function ListingFilters({ tenant, kind, query }: { tenant: string; kind: ReferenceKind; query: ContentListQuery }) {
  return <form action={contentPublicPath(tenant, kind)} method="get" className="public-filters">
    <label>Tìm {CONTENT_LABELS[kind].plural.toLocaleLowerCase("vi")}<input name="q" type="search" defaultValue={query.q ?? ""} maxLength={160}/></label>
    {query.referenceKind && <><input type="hidden" name="referenceKind" value={query.referenceKind}/><input type="hidden" name="referenceId" value={query.referenceId}/>{query.referencePublicationId && <input type="hidden" name="referencePublicationId" value={query.referencePublicationId}/>}<p>Đang lọc theo nội dung đã chọn. <a href={contentPublicPath(tenant, kind)}>Bỏ bộ lọc</a></p></>}
    <button type="submit">Tìm kiếm</button>
  </form>;
}
export function ListingPagination({ tenant, kind, query, nextCursor }: { tenant: string; kind: ReferenceKind; query: ContentListQuery; nextCursor: string | null }) {
  return <nav className="public-pagination" aria-label="Phân trang">{query.cursor && <a href={publicListingPath(tenant, kind, { ...query, cursor: undefined })}>Về trang đầu</a>}{nextCursor && <a href={publicListingPath(tenant, kind, { ...query, cursor: nextCursor })}>Xem tiếp</a>}</nav>;
}
