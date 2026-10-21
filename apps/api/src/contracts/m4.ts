/** M4 canonical contracts. Save/restore only change drafts; explicit publish changes one locale head. */
import type {ContentKind,ContentPage,ContentReference,DentalContent,ResolvedContentReference,ContentPublicMedia} from './m3';
import {M3_PATHS} from './m3';
import type {RichTextDocument,ServiceContent,SiteFooter} from './s03';
import type {PublicMediaBlock,ServiceMediaReference} from './s07';
import type {IntakeInput} from './s04';
export const M4_LOCALES=['vi','en'] as const;
export type M4Locale=typeof M4_LOCALES[number];
export const M4_KINDS=['home','page','landing','promotion','service','specialty','service_group','location','doctor','price','case','gallery','testimonial','article','category','faq'] as const;
export type M4Kind=typeof M4_KINDS[number];
export type M4ResourceKind=M4Kind|'config';
export const M4_LIMITS={sections:30,sectionReferences:30,menu:20,pageSize:20,maxPageSize:50,requestBytes:524288,publicBytes:1048576,publicNodes:250,publicDepth:3,trackingToken:64,navigationNodes:60,navigationDepth:3,carouselSlides:5,contactLocations:10} as const;
export const M4_THEMES=['clarity','showcase','signature'] as const;
export interface M4Target {kind:M4Kind;id:string;locale:M4Locale}
export interface M4MenuItem {id:string;label:string;target:M4Target;allowViFallback:boolean}
export const M4_LISTING_KINDS=['service','specialty','service_group','location','doctor','price','case','gallery','testimonial','article','category','faq','promotion'] as const;
export type M4ListingKind=typeof M4_LISTING_KINDS[number];
export type M4NavigationNode=({type:'resource';target:M4Target;allowViFallback:boolean}|{type:'listing';kind:M4ListingKind;locale:M4Locale}|{type:'group'})&{id:string;label:string;children:M4NavigationNode[]};
export const SIGNATURE_HERO_TYPOGRAPHY=['default','warm_editorial','rose_editorial'] as const;
export type SignatureHeroTypography=typeof SIGNATURE_HERO_TYPOGRAPHY[number];
export interface M4SignaturePresentation {navigation:M4NavigationNode[];headerLocation:ContentReference|null;footerLocations:ContentReference[];heroTypography?:SignatureHeroTypography}
export interface M4ResolvedNavigationNode {id:string;label:string;type:M4NavigationNode['type'];path:string|null;actualLocale:M4Locale;fallback:boolean;children:M4ResolvedNavigationNode[]}
export interface M4ResolvedSignature {navigation:M4ResolvedNavigationNode[];headerLocation:M4PublicReference|null;footerLocations:M4PublicReference[]}
export interface SitePresentation {signature?:M4SignaturePresentation;name:string;logo:ServiceMediaReference|null;theme:typeof M4_THEMES[number];themeVersion:1;palette:'teal'|'blue'|'plum';font:'system'|'serif';layout:'comfortable'|'compact';footer:SiteFooter;menu:M4MenuItem[]}
export interface SectionBase {id:string;hidden:boolean}
export interface HeroSection extends SectionBase {type:'hero';title:string;text:string;image:ServiceMediaReference|null;action:{label:string;target:M4Target;allowViFallback:boolean}|null}
export interface HeroCarouselSlide {id:string;title:string;text:string;highlight?:string;image:ServiceMediaReference|null;action:HeroSection['action']}
export interface HeroCarouselSection extends SectionBase {type:'hero_carousel';slides:HeroCarouselSlide[];autoplay:boolean;intervalMs:5000|7000|10000}
export interface RichTextSection extends SectionBase {type:'rich_text';body:RichTextDocument}
export type ReferenceSectionType='services'|'doctors'|'locations'|'prices'|'cases'|'gallery'|'testimonials'|'articles'|'faq';
export interface ReferenceSection extends SectionBase {type:ReferenceSectionType;title:string;references:ContentReference[];required:boolean}
export interface PromotionSection extends SectionBase {type:'promotion';title:string;reference:{kind:'promotion';id:string;publicationId:string};required:boolean}
export interface ConsultationSection extends SectionBase {type:'consultation';title:string;promotion:{kind:'promotion';id:string;publicationId:string}|null;serviceOptions:ContentReference[];locationOptions:ContentReference[]}
export type BuilderSection=HeroSection|HeroCarouselSection|RichTextSection|ReferenceSection|PromotionSection|ConsultationSection;
export interface BuilderContent {kind:'home'|'page'|'landing';slug:string;title:string;summary:string;seo:{title:string;description:string};sections:BuilderSection[]}
export interface PromotionContent {kind:'promotion';slug:string;title:string;summary:string;body:RichTextDocument;seo:{title:string;description:string};startAt:string;endAt:string;authoredTimezone:string;conditions:string;references:ContentReference[]}
export type M4Content=BuilderContent|PromotionContent|ServiceContent|DentalContent|SitePresentation;
export interface LegacySourceState {version:number;publicationVersion:number;publicationRevision:number;pointer:string|null;generation:number}
export interface M4Variant {virtual?:boolean;legacySource?:{captured:LegacySourceState|null;current:LegacySourceState|null}|null;id:string;tenantId:string;kind:M4ResourceKind;locale:M4Locale;version:number;publicationVersion:number;publicationRevision:number;publishedVersion:number|null;activePublication:boolean;publicationId:string|null;slugLocked:boolean;updatedAt:string;content:M4Content;legacy:boolean}
export interface M4CreateInput {operationId:string;content:M4Content}
export interface M4SaveInput {operationId:string;expectedVersion:number;content:M4Content;expectedLegacyState?:LegacySourceState|null}
export interface M4PublishInput {operationId:string;expectedVersion:number;expectedPublicationVersion:number;expectedPublicationRevision:number;expectedConfigPublicationId:string|null}
export interface M4UnpublishInput {operationId:string;expectedVersion:number;expectedPublicationRevision:number}
export interface M4RestoreInput {operationId:string;expectedVersion:number;sourceRevisionId:string}
export interface M4CommandResult {operationId:string;replayed:boolean;draft:M4Variant;permission?:M4Permission}
export interface M4HistoryItem {id:string;version:number;kind:'created'|'saved'|'restored';createdAt:string;actor:{userId:string;name:string}|null;restoredFrom:string|null;content:M4Content}
export interface M4PrivateMedia {slot:string;assetId:string;revision:number;alt:string;url:string;expiresAt:string;pairIndex?:number;caption?:string}
export interface M4ResolvedSlide<T> {id:string;title:string;text:string;highlight?:string;media:T|null;action:{label:string;path:string;actualLocale:M4Locale;fallback:boolean}|null}
export interface M4PrivateSection {slides?:M4ResolvedSlide<M4PrivateMedia>[];section:BuilderSection;references:M4PublicReference[];media:M4PrivateMedia|null;promotion:Omit<M4PromotionBlock,'publishedAt'>|null;action:{label:string;path:string;actualLocale:M4Locale;fallback:boolean}|null;form:'disabled'|null}
export interface M4PrivatePreview {id:string;kind:M4ResourceKind;locale:M4Locale;draftVersion:number;content:M4Content;config:{draftVersion:number;content:SitePresentation;logoMedia:M4PrivateMedia|null;signature?:M4ResolvedSignature}|null;references:M4PublicReference[];sections:M4PrivateSection[];media:M4PrivateMedia[];issues:string[]}
export interface M4Preview {draft:M4Variant;config:M4Variant|null;issues:string[];page:PublicM4Page|null;closure:M4PrivatePreview|null}
export interface M4ListQuery {locale:M4Locale;q?:string;cursor?:string;pageSize?:number;published?:boolean}
export interface M4ReferenceOption {id:string;kind:M4Kind;locale:M4Locale;publicationId:string;publicationVersion:number;title:string;slug:string;content:M4Content}
export type M4Page<T>=ContentPage<T>;
export interface M4ResolvedMenu extends M4MenuItem {path:string;actualLocale:M4Locale;fallback:boolean}
export interface M4PublicConfig {signature?:M4ResolvedSignature;publicationId:string;publicationVersion:number;locale:M4Locale;content:SitePresentation;menu:M4ResolvedMenu[];logoMedia:PublicMediaBlock|null}
export interface M4PublicReference {legacy?:boolean;id:string;kind:M4Kind;publicationId:string;publicationVersion:number;locale:M4Locale;title:string;slug:string;path:string;content:M4Content;references:M4PublicReference[];media:ContentPublicMedia[]}
export type M4PromotionBlock=Pick<PublicM4Page,'id'|'kind'|'locale'|'publicationId'|'publicationVersion'|'publishedAt'|'canonicalUrl'|'content'|'references'|'media'|'promotionState'>;
export interface M4PublicSection {slides?:M4ResolvedSlide<PublicMediaBlock>[];section:BuilderSection;action:{label:string;path:string;actualLocale:M4Locale;fallback:boolean}|null;references:M4PublicReference[];media:PublicMediaBlock|null;promotion:M4PromotionBlock|null;form:M4FormContext|null}
export type M4IntakeSourceKind='service'|'landing'|'home'|'page';
export interface M4FormContext {sourceType:M4IntakeSourceKind;sourceId:string;sourcePublicationId:string;sourceConfigPublicationId:string|null;formLocale:M4Locale;consent:{version:string;copy:string};promotionId:string|null;promotionPublicationId:string|null;serviceOptions:M4PublicReference[];locationOptions:M4PublicReference[]}
export interface PublicM4Page {schemaVersion:4;id:string;kind:M4Kind;locale:M4Locale;requestedLocale:M4Locale;actualLocale:M4Locale;publicationId:string;publicationVersion:number;publishedAt:string;canonicalUrl:string;configPublicationId:string|null;config:M4PublicConfig|null;site:{name:string;footer:SiteFooter};content:M4Content;references:M4PublicReference[];media:ContentPublicMedia[];sections:M4PublicSection[];form:M4FormContext|null;promotionState:'upcoming'|'active'|'expired'|null;alternates:{locale:M4Locale;url:string;publicationId:string}[];legacy:boolean}
export type M4Resolution={resolution:'page';requestedLocale:M4Locale;actualLocale:M4Locale;canonicalUrl:string;fallbackPublicationId:null;page:PublicM4Page}|{resolution:'fallback';requestedLocale:'en';actualLocale:'vi';canonicalUrl:string;fallbackPublicationId:string;page:null};
export interface M4PublicListItem extends M4ReferenceOption {path:string;legacy:boolean;media:ContentPublicMedia[];references:M4PublicReference[];promotionState:'upcoming'|'active'|'expired'|null}
export interface M4SeoPage {items:M4SeoEntry[];nextCursor:string|null}
export interface M4PublicListQuery {q?:string;cursor?:string;pageSize?:number;referenceKind?:M4Kind;referenceId?:string;referencePublicationId?:string}
export interface M4PublicList {schemaVersion:4;locale:M4Locale;kind:M4Kind;items:M4PublicListItem[];nextCursor:string|null;config:M4PublicConfig|null;canonicalUrl:string}
export interface M4SearchItem {id:string;kind:M4Kind;title:string;summary:string;path:string;locale:M4Locale;publicationId:string}
export interface M4PublicSearch {schemaVersion:4;locale:M4Locale;query:string;items:M4SearchItem[];nextCursor:string|null;config:M4PublicConfig|null}
export interface M4SeoEntry {kind:M4Kind;id:string;locale:M4Locale;path:string;canonicalUrl:string;publicationId:string;configPublicationId:string|null;alternates:{locale:M4Locale;url:string;publicationId:string}[]}
export type M4PermissionScope={type:'text'}|{type:'asset';assetId:string;assetRevision:number;usage:'logo'|'hero'|'page'};
export interface M4Permission {id:string;resourceId:string;kind:M4ResourceKind;locale:M4Locale;revision:number;scope:M4PermissionScope;evidenceReference:string;grantedBy:string;grantedAt:string;withdrawnAt:string|null;withdrawalReason:string|null;purge:{status:'pending'|'completed'|'failed';attempts:number;failureCode:string|null}|null}
export interface M4GrantInput {operationId:string;expectedVersion:number;revision:number;scope:M4PermissionScope;evidenceReference:string}
export interface M4WithdrawInput {operationId:string;expectedVersion:number;permissionId:string;reason:string}
export interface M4PurgeRetryInput {operationId:string;expectedVersion:number;permissionId:string}
export interface M4IntakeInput extends Omit<IntakeInput,'sourcePublicationId'> {sourcePublicationId:string;sourceConfigPublicationId:string|null;formLocale:M4Locale;tracking?:{campaign?:string;medium?:string;source?:string}}
export type M4LeadSource={type:'service';tenantSlug:string;resourceId?:string;slug?:string;title?:string;serviceSlug:string;serviceTitle:string;publicationId:string;configPublicationId?:string|null;path:string;locale?:M4Locale}|{type:'landing'|'home'|'page';tenantSlug:string;resourceId:string;slug:string;title:string;publicationId:string;configPublicationId:string|null;path:string;locale:M4Locale;promotion:{id:string;publicationId:string;title:string}|null;tracking:{campaign?:string;medium?:string;source?:string}};
const root=(tenant:string)=>`/api/tenants/${encodeURIComponent(tenant)}/site-builder`;
export const M4_ROUTES={root,config:(t:string,l:M4Locale)=>`${root(t)}/config/${l}`,resources:(t:string,k:M4Kind)=>`${root(t)}/resources/${k}`,resource:(t:string,k:M4Kind,id:string,l:M4Locale)=>`${root(t)}/resources/${k}/${encodeURIComponent(id)}/${l}`,references:(t:string)=>`${root(t)}/references`,publicConfig:(t:string,l:M4Locale)=>`/api/public/builder/${encodeURIComponent(t)}/${l}/config`,publicList:(t:string,l:M4Locale,k:M4Kind)=>`/api/public/builder/${encodeURIComponent(t)}/${l}/${k}`,publicPage:(t:string,l:M4Locale,k:M4Kind,slug:string)=>`/api/public/builder/${encodeURIComponent(t)}/${l}/${k}/${encodeURIComponent(slug)}`,search:(t:string,l:M4Locale)=>`/api/public/builder/${encodeURIComponent(t)}/${l}/search`,seo:(t:string)=>`/api/public/builder/${encodeURIComponent(t)}/seo`,intake:(t:string,l:M4Locale,k:M4IntakeSourceKind,slug:string)=>`/api/public/intake/builder/${encodeURIComponent(t)}/${l}/${k}/${encodeURIComponent(slug)}`,challenge:(t:string,l:M4Locale,k:M4IntakeSourceKind,slug:string)=>`${M4_ROUTES.intake(t,l,k,slug)}/challenge`} as const;
export const M4_CONSENTS={vi:{version:'consultation-vi-v1',copy:'Tôi đồng ý để phòng khám sử dụng thông tin đã cung cấp để liên hệ tư vấn theo yêu cầu này.'},en:{version:'consultation-en-v1',copy:'I agree that the clinic may use the information I provided to contact me about this consultation request.'}} as const;
export function m4PublicPath(tenant:string,locale:M4Locale,kind:M4Kind,slug?:string):string {const base=`/${encodeURIComponent(tenant)}${locale==='en'?'/en':''}`;if(kind==='home')return base;const family=kind==='page'?'':kind==='landing'?'landing':kind==='promotion'?'khuyen-mai':M3_PATHS[kind as ContentKind|'service'];return `${base}${family?`/${family}`:''}${slug?`/${encodeURIComponent(slug)}`:''}`;}
// Structural legacy compatibility types remain explicit at adapters.
export type LegacyM4References=ResolvedContentReference[];
