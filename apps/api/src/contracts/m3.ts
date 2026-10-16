/** M3 local VI content. Public references pin immutable publications, never drafts. */
import type { RichTextDocument, SiteFooter } from './s03';
import type { PublicMediaBlock, ServiceMediaReference } from './s07';

export const M3_KINDS = ['specialty','service_group','location','doctor','price','case','gallery','testimonial','article','category','faq'] as const;
export type ContentKind = typeof M3_KINDS[number];
export type ReferenceKind = ContentKind | 'service';
export const M3_PATHS: Record<ReferenceKind,string> = { specialty:'chuyen-khoa',service_group:'nhom-dich-vu',service:'dich-vu',
  location:'co-so',doctor:'bac-si',price:'bang-gia',case:'ca-dieu-tri',gallery:'truoc-sau',testimonial:'danh-gia',article:'bai-viet',category:'chuyen-muc',faq:'hoi-dap' };
export const M3_LIMITS = { pageSize:20,maxPageSize:50,permissionPageSize:50,maxPermissionPageSize:100,references:50,pairs:20,search:160,decimalIntegerDigits:24,decimalScale:6,requestBytes:524_288,publicNodes:250,publicBytes:1_048_576,publicDepth:3 } as const;
export interface ContentReference { kind:ReferenceKind; id:string; publicationId:string }
export interface ServiceContentLinks { references:ContentReference[] }
export interface OpeningInterval { opens:string; closes:string }
export interface OpeningDay { day:number; closed:boolean; intervals:OpeningInterval[] }
export type ContentPrice = { type:'exact'; amount:string; currency:string; unit:string } |
  { type:'range'; minimum:string; maximum:string; currency:string; unit:string } |
  { type:'from'; amount:string; currency:string; unit:string };
export interface GalleryImage extends ServiceMediaReference { caption:string }
export interface GalleryPair { before:GalleryImage; after:GalleryImage }
export interface ContentBase { kind:ContentKind; slug:string; title:string; summary:string; body:RichTextDocument;
  seo:{title:string;description:string}; references:ContentReference[] }
export type DentalContent =
  | ContentBase & { kind:'specialty'|'service_group'|'category'|'faq' }
  | ContentBase & { kind:'location'; address:string; phone:string; email:string; openingHours:OpeningDay[]; mapUrl:string }
  | ContentBase & { kind:'doctor'; professionalTitle:string; credentials:string[]; languages:string[]; image:ServiceMediaReference|null }
  | ContentBase & { kind:'price'; price:ContentPrice; inclusions:string; notes:string }
  | ContentBase & { kind:'case'; image:ServiceMediaReference|null }
  | ContentBase & { kind:'gallery'; pairs:GalleryPair[] }
  | ContentBase & { kind:'testimonial'; quote:string; displayName:string; attribution:string; image:ServiceMediaReference|null }
  | ContentBase & { kind:'article'; attribution:string; image:ServiceMediaReference|null };
export interface ContentDraft { id:string;tenantId:string;kind:ContentKind;version:number;publicationVersion:number;
  publicationRevision:number;publishedVersion:number|null;activePublication:boolean;slugLocked:boolean;updatedAt:string;content:DentalContent }
export interface ContentPage<T> {items:T[];nextCursor:string|null}
export interface ContentListQuery {q?:string;cursor?:string;pageSize?:number;published?:boolean;referenceKind?:ReferenceKind;referenceId?:string;referencePublicationId?:string}
export interface SaveContentInput {expectedVersion:number;content:DentalContent;operationId:string}
export interface CreateContentInput {operationId:string;content:DentalContent}
export interface PublishContentInput {operationId:string;expectedVersion:number;expectedPublicationVersion:number;expectedPublicationRevision:number;expectedSiteVersion:number}
export interface UnpublishContentInput {operationId:string;expectedVersion:number;expectedPublicationRevision:number}
export interface RestoreContentInput {operationId:string;expectedVersion:number;sourceRevisionId:string}
export interface ContentCommandResult {operationId:string;replayed:boolean;draft:ContentDraft}
export interface ContentHistoryItem {id:string;version:number;kind:'created'|'saved'|'restored';createdAt:string;actor:{userId:string;name:string}|null;restoredFrom:string|null;content:DentalContent}
export interface ResolvedContentReference extends ContentReference { title:string;slug:string;path:string;publicationVersion:number;content:DentalContent|{kind:'service';title:string;slug:string;summary:string};references:ResolvedContentReference[];media:ContentPublicMedia[] }
export interface ContentPublicMedia {slot:string;pairIndex?:number;caption?:string;media:PublicMediaBlock}
export interface PublicContentPage {schemaVersion:3;locale:'vi';id:string;kind:ContentKind;publicationId:string;publicationVersion:number;
  publishedAt:string;canonicalUrl:string;site:{name:string;footer:SiteFooter};content:DentalContent;references:ResolvedContentReference[];media:ContentPublicMedia[]}
export interface PublicContentCard {id:string;kind:ReferenceKind;title:string;slug:string;summary:string;path:string;publicationId:string;publicationVersion:number;
  price?:ContentPrice;inclusions?:string;notes?:string;locations?:{title:string;path:string}[];answer?:RichTextDocument}
export interface PublicContentList extends ContentPage<PublicContentCard> {schemaVersion:3;locale:'vi';kind:ReferenceKind;canonicalUrl:string;site:{name:string;footer:SiteFooter}}
export interface ContentReferenceOption extends ContentReference {title:string;slug:string;version:number;publicationVersion:number;content:DentalContent|{kind:'service';title:string;slug:string;summary:string}}
export interface ContentPreview {draft:ContentDraft;site:{version:number;slug:string|null;name:string};page:PublicContentPage|null;issues:string[];resolved:ResolvedContentReference[]}
export type ContentPermissionScope = {type:'text'}|{type:'asset';assetId:string;assetRevision:number};
export interface ContentPermission {id:string;resourceId:string;revision:number;scope:ContentPermissionScope;evidenceReference:string;grantedAt:string;grantedBy:string;withdrawnAt:string|null;withdrawalReason:string|null;purge:{status:'pending'|'completed'|'failed';attempts:number;failureCode:string|null}|null}
export interface GrantContentPermissionInput {operationId:string;expectedVersion:number;revision:number;scope:ContentPermissionScope;evidenceReference:string}
export interface WithdrawContentPermissionInput {operationId:string;expectedVersion:number;permissionId:string;reason:string}
/** Descending exact grantedAt/id keyset. Continue only by nextCursor; no total count. */
export type ContentPermissions = ContentPage<ContentPermission>;
/** The affected grant is returned even when it is outside the newest permission page. */
export interface ContentPermissionCommandResult {operationId:string;replayed:boolean;permission:ContentPermission}
export interface ServiceContentLinksView {serviceId:string;draftVersion:number;references:ContentReference[];resolved:ResolvedContentReference[]}
export interface SaveServiceContentLinksInput {operationId:string;expectedDraftVersion:number;references:ContentReference[]}
export interface PublicServiceContentLinks {serviceId:string;publicationId:string;references:ResolvedContentReference[];locations:{id:string;publicationId:string;name:string;address:string}[]}
export const M3_SERVICE_REFERENCE_KINDS:readonly ReferenceKind[]=['specialty','service_group','location','service','faq'];
export const M3_REFERENCE_RULES:Record<ContentKind,readonly ReferenceKind[]>={specialty:[],service_group:[],category:[],location:[],doctor:['specialty','service','location'],price:['service','location'],case:['service','doctor','gallery'],gallery:['service','doctor'],testimonial:['service','doctor'],article:['category','doctor','service','faq'],faq:['specialty','service']};
export const M3_ROUTES = {
  resources:(tenant:string,kind:ContentKind)=>`/api/tenants/${encodeURIComponent(tenant)}/content/${kind}`,
  resource:(tenant:string,kind:ContentKind,id:string)=>`${M3_ROUTES.resources(tenant,kind)}/${encodeURIComponent(id)}`,
  permissions:(tenant:string,kind:ContentKind,id:string)=>`${M3_ROUTES.resource(tenant,kind,id)}/permissions`,
  permission:(tenant:string,kind:ContentKind,id:string,permissionId:string)=>`${M3_ROUTES.permissions(tenant,kind,id)}/${encodeURIComponent(permissionId)}`,
  references:(tenant:string)=>`/api/tenants/${encodeURIComponent(tenant)}/content-references`,
  serviceLinks:(tenant:string,id:string)=>`/api/tenants/${encodeURIComponent(tenant)}/publication/services/${encodeURIComponent(id)}/content-links`,
  publicList:(tenant:string,kind:ReferenceKind)=>`/api/public/content/${encodeURIComponent(tenant)}/${kind}`,
  publicDetail:(tenant:string,kind:ContentKind,slug:string)=>`${M3_ROUTES.publicList(tenant,kind)}/${encodeURIComponent(slug)}`,
  publicServiceLinks:(tenant:string,slug:string)=>`/api/public/content/${encodeURIComponent(tenant)}/service/${encodeURIComponent(slug)}/links`,
};
export function contentPublicPath(tenant:string,kind:ReferenceKind,slug?:string):string {
  return `/${encodeURIComponent(tenant)}/${M3_PATHS[kind]}${slug?`/${encodeURIComponent(slug)}`:''}`;
}
