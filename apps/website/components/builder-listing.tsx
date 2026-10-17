import { navigationHref, publicPath, publicUrlBase } from "../lib/public-url-context";
import { type M4Kind, type M4Locale, type M4PublicList } from "../../api/src/contracts/m4";
import { BUILDER_LABELS } from "../lib/builder-routing";
import { builderListSearch, type BuilderListQuery } from "../lib/public-builder";
import { BuilderCards } from "./builder-content";
import { PresentationShell } from "./builder-shell";
import { SignatureListing } from "./signature-listing";

export function BuilderListing({ page, tenant, kind, locale, query, alternates = [] }: { page: M4PublicList; tenant: string; kind: M4Kind; locale: M4Locale; query: BuilderListQuery; alternates?: { locale: M4Locale; url: string }[] }) {
  if (page.config?.content.theme === "signature") return <SignatureListing page={page} tenant={tenant} kind={kind} locale={locale} query={query} alternates={alternates}/>;
  const en = locale === "en", name = page.config?.content.name ?? BUILDER_LABELS[locale][kind], path = publicPath(tenant, locale, kind, undefined, publicUrlBase(page));
  const references = page.items, href = navigationHref(path, publicUrlBase(page));
  return <PresentationShell urlBase={publicUrlBase(page)} config={page.config} site={{ name, footer: page.config?.content.footer ?? { intro: "", body: { type: "doc", version: 1, blocks: [] } } }} tenant={tenant} locale={locale} currentPath={path} alternates={alternates}>
    <div className="builder-listing-heading"><p className="eyebrow">{name}</p><h1>{BUILDER_LABELS[locale][kind]}</h1></div>
    {(["service", "price", "article"] as M4Kind[]).includes(kind) && <nav className="public-browse-links" aria-label={en ? "Browse related lists" : "Duyệt danh sách liên quan"}>{(kind === "service" ? ["specialty", "service_group", "location"] : kind === "price" ? ["service", "location"] : ["category"]).map(target => <a key={target} href={navigationHref(publicPath(tenant, locale, target as M4Kind, undefined, publicUrlBase(page)), publicUrlBase(page))}>{BUILDER_LABELS[locale][target as M4Kind]}</a>)}</nav>}
    <form className="public-filters" action={href}><label>{en ? "Search" : "Tìm kiếm"}<input name="q" type="search" maxLength={160} defaultValue={query.q ?? ""}/></label>{query.referenceKind && <><input type="hidden" name="referenceKind" value={query.referenceKind}/><input type="hidden" name="referenceId" value={query.referenceId}/>{query.referencePublicationId && <input type="hidden" name="referencePublicationId" value={query.referencePublicationId}/>}<p>{en ? "Showing related content." : "Đang lọc theo nội dung đã chọn."} <a href={href}>{en ? "Clear filter" : "Bỏ bộ lọc"}</a></p></>}<button type="submit">{en ? "Search" : "Tìm kiếm"}</button></form>
    <BuilderCards urlBase={publicUrlBase(page)} references={references} locale={locale} nested={false}/><nav className="public-pagination" aria-label={en ? "Pagination" : "Phân trang"}>{query.cursor && <a href={href + builderListSearch({ ...query, cursor: undefined })}>{en ? "First page" : "Về trang đầu"}</a>}{page.nextCursor && <a href={href + builderListSearch({ ...query, cursor: page.nextCursor })}>{en ? "Next page" : "Trang tiếp"}</a>}</nav>
  </PresentationShell>;
}
