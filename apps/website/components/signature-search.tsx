import { headers } from "next/headers";
import { M4_KINDS, type PublicM4Page } from "../../api/src/contracts/m4";
import { BUILDER_LABELS } from "../lib/builder-routing";
import { readPublicBuilderSearch } from "../lib/public-builder";
import type { PublicSearchParams } from "../lib/public-content";
import { entryFromHeaders } from "../lib/public-entry";
import { parsePublicSearchQuery, publicSearchQueryString, type PublicSearchQuery } from "../lib/public-search";
import { navigationHref, publicPath } from "../lib/public-url-context";
import { PresentationShell } from "./builder-shell";
import { SignatureIcon } from "./signature-ui";
export async function SignatureSearch({ tenant, page, params }: { tenant: string; page: PublicM4Page; params: PublicSearchParams }) {
  const locale = page.actualLocale, config = page.config, trusted = await headers(), context = entryFromHeaders(trusted, tenant), en = locale === "en";
  if (!config) throw new Error("Missing website presentation");
  if (trusted.get("x-gcms-expected-config") && trusted.get("x-gcms-expected-config") !== config.publicationId) throw new Error("Public presentation changed; reload the page");
  let query: PublicSearchQuery = { q: "" }, invalid = false;
  try { query = parsePublicSearchQuery(params); } catch { invalid = true; }
  const tooShort = !!query.q && [...query.q].length < 2, result = !invalid && !tooShort && query.q ? await readPublicBuilderSearch(tenant, locale, query, context) : null;
  if (result && result.config?.publicationId !== config.publicationId) throw new Error("Public presentation changed; reload the page");
  const path = publicPath(tenant, locale, "home", undefined, context.primary), href = navigationHref(path, context.primary);
  return <PresentationShell config={config} site={{ name: config.content.name, footer: config.content.footer }} tenant={tenant} locale={locale} currentPath={path} urlBase={context.primary} alternates={page.alternates.map(alternate => ({ locale: alternate.locale, url: alternate.url + publicSearchQueryString({ ...query, cursor: undefined }) }))}><div className="signature-listing-heading"><p className="eyebrow">{config.content.name}</p><h1>{en ? "Search" : "Tìm kiếm"}</h1></div><div className="signature-listing"><form action={href} className="public-filters"><label>{en ? "What are you looking for?" : "Bạn đang tìm thông tin gì?"}<input type="search" name="q" minLength={2} maxLength={160} defaultValue={query.q} required/></label><label>{en ? "Content type" : "Loại nội dung"}<select name="kind" defaultValue={query.kind ?? ""}><option value="">{en ? "All content" : "Tất cả nội dung"}</option>{M4_KINDS.map(kind => <option value={kind} key={kind}>{BUILDER_LABELS[locale][kind]}</option>)}</select></label><button type="submit">{en ? "Search" : "Tìm kiếm"}</button><a href={href}>{en ? "Back to homepage" : "Về trang chủ"}</a></form>
    {invalid || tooShort ? <p className="public-empty" role="alert">{en ? "Use 2–160 characters and choose a valid content type." : "Nhập từ 2–160 ký tự và chọn loại nội dung hợp lệ."}</p> : query.q ? <>{result?.items.length ? <><p className="signature-search-count">{en ? "Search results for" : "Kết quả cho"} “{query.q}”</p><ul className="signature-search-results">{result.items.map(item => <li key={`${item.kind}:${item.id}`}><p className="eyebrow">{BUILDER_LABELS[locale][item.kind]}</p><h2><a href={navigationHref(item.path, context.primary)}>{item.title}</a></h2>{item.summary && <p>{item.summary}</p>}<a href={navigationHref(item.path, context.primary)} className="signature-card-link">{en ? "Read more" : "Xem chi tiết"}<SignatureIcon name="arrow"/></a></li>)}</ul></> : <p className="public-empty" role="status">{result?.nextCursor ? (en ? "No matches on this page. Continue to the next page." : "Chưa có kết quả ở trang này. Tiếp tục sang trang kế tiếp.") : (en ? "No matching information was found. Try another phrase or content type." : "Chưa tìm thấy thông tin phù hợp. Hãy thử từ khóa hoặc loại nội dung khác.")}</p>}<nav className="public-pagination" aria-label={en ? "Pagination" : "Phân trang"}>{query.cursor && <a href={href + publicSearchQueryString({ ...query, cursor: undefined })}>{en ? "First page" : "Về trang đầu"}</a>}{result?.nextCursor && <a href={href + publicSearchQueryString({ ...query, cursor: result.nextCursor })}>{en ? "Next page" : "Trang tiếp"}</a>}</nav></> : <p className="public-empty">{en ? "Find services, doctors, prices and dental care information." : "Tìm dịch vụ, bác sĩ, bảng giá và kiến thức chăm sóc răng miệng."}</p>}
  </div></PresentationShell>;
}
