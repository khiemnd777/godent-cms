import type { M4Locale, M4PublicReference } from "../../api/src/contracts/m4";
import { navigationHref, type PublicUrlBase } from "../lib/public-url-context";
import { SignatureImage } from "./signature-image";
import { PriceDisplay } from "./public-content";
import { RichText } from "./rich-text";
import { SignatureIcon } from "./signature-ui";
import { distinctSignatureSummary } from "../lib/signature-presentation";

export function SignatureCards({ references, locale, nested = true, urlBase }: { references: M4PublicReference[]; locale: M4Locale; nested?: boolean; urlBase?: PublicUrlBase }) {
  const Heading = nested ? "h3" : "h2", en = locale === "en";
  if (!references.length) return <p className="public-empty" role="status">{en ? "New information will appear here soon." : "Thông tin mới sẽ được cập nhật tại đây."}</p>;
  if (references.every(reference => reference.kind === "faq")) return <div className="signature-faq">{references.map(reference => <details key={reference.publicationId}><summary>{reference.title}</summary>{"body" in reference.content && <RichText document={reference.content.body}/>}</details>)}</div>;
  return <ul className="signature-cards">{references.map(reference => { const image = reference.media.find(item => item.slot === "image" || item.slot === "cover"), content = reference.content, summary = distinctSignatureSummary(content), topics = reference.references.filter(item => reference.kind === "article" ? item.kind === "category" : reference.kind === "case" ? item.kind === "service" : false), path = navigationHref(reference.path, urlBase); return <li className={`signature-card kind-${reference.kind}`} key={`${reference.kind}:${reference.id}:${reference.publicationId}`}>
    {image && <a className="signature-card-media" href={path} tabIndex={-1} aria-hidden="true"><SignatureImage image={image.media} locale={locale}/></a>}
    {["service", "specialty", "service_group"].includes(reference.kind) && <span className="signature-card-icon"><SignatureIcon name="tooth"/></span>}
    <div className="signature-card-copy">{topics.length > 0 && <p className="signature-card-topics">{topics.map(topic => <a key={topic.id} href={navigationHref(topic.path, urlBase)}>{topic.title}</a>)}</p>}<Heading><a href={path}>{reference.title}</a></Heading>{"kind" in content && content.kind === "doctor" && content.professionalTitle && <p>{content.professionalTitle}</p>}{summary && <p>{summary}</p>}{"kind" in content && content.kind === "price" && <><PriceDisplay price={content.price} locale={locale}/>{content.inclusions && <p>{content.inclusions}</p>}{content.notes && <p>{content.notes}</p>}</>}{"kind" in content && content.kind === "testimonial" && <blockquote><p>{content.quote}</p><cite>{content.displayName}</cite></blockquote>}{"kind" in content && content.kind === "location" && <p>{content.address}</p>}<a className="signature-card-link" href={path}>{reference.kind === "doctor" ? en ? "Meet the dentist" : "Tìm hiểu bác sĩ" : reference.kind === "article" ? en ? "Read the article" : "Đọc bài viết" : reference.kind === "case" ? en ? "Read the story" : "Đọc câu chuyện" : en ? "Discover more" : "Tìm hiểu thêm"}<SignatureIcon name="arrow"/></a></div>
  </li>; })}</ul>;
}
