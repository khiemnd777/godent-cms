/** S03 local VI publication contract. S02 plaintext endpoints remain compatible. */
import type { PublicMediaBlock, ServiceMediaReference } from './s07';
export const PUBLIC_SITE_ORIGIN = 'http://localhost:5892';
export const S03_LIMITS = { slug: 63, title: 160, summary: 320, seoTitle: 160, seoDescription: 320,
  bodyText: 20000, footerIntro: 500, footerText: 2000, blocks: 100, inlines: 100, listItems: 100, href: 2048 } as const;
export const RESERVED_SLUGS = ['api', 'admin', 'cms', 'platform', 'login', 'logout', 'preview', 'auth',
  'assets', 'static', 'public', 'health', 'ready', 'diagnostics', 'dich-vu', 'en', 'vi', 'www'] as const;
export type RichInline = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };
export type RichBlock = { type: 'paragraph' | 'heading'; children: RichInline[] } |
  { type: 'bulletList'; items: RichInline[][] };
export interface RichTextDocument { type: 'doc'; version: 1; blocks: RichBlock[] }
export interface SiteFooter { intro: string; body: RichTextDocument }
export interface SiteDraft { tenantId: string; slug: string | null; version: number; name: string;
  footer: SiteFooter; slugLocked: boolean }
export interface SaveSiteInput { slug: string; name: string; footer: SiteFooter; expectedVersion: number }
export interface ServiceContent { slug: string; title: string; summary: string; body: RichTextDocument;
  seo: { title: string; description: string }; coverImage?: ServiceMediaReference | null }
export interface PublicationService extends Omit<ServiceContent, 'slug'> { id: string; tenantId: string;
  slug: string | null; locale: 'vi'; draftVersion: number; publicationVersion: number; siteVersion: number;
  publishedDraftVersion: number | null; publishedSiteVersion: number | null; slugLocked: boolean; updatedAt: string;
  activePublication: boolean; publicationRevision: number }
export interface SaveServiceInput extends ServiceContent { expectedDraftVersion: number }
export interface ServicePreview { service: PublicationService; site: SiteDraft; canonicalUrl: string | null }
export interface PublishServiceInput { expectedDraftVersion: number; expectedPublicationVersion: number;
  expectedSiteVersion: number; requestKey: string; expectedPublicationRevision?: number }
export interface PublicationResult { publicationId: string; publicationVersion: number; draftVersion: number;
  siteVersion: number; canonicalUrl: string; publishedAt: string; replayed: boolean;
  activePublication: boolean; publicationRevision: number }
export interface PublicServicePage { schemaVersion: 1 | 2; locale: 'vi'; publicationId: string;
  publicationVersion: number; publishedAt: string; canonicalUrl: string;
  site: { name: string; footer: SiteFooter }; service: ServiceContent; coverMedia?: PublicMediaBlock }
export interface S03Error { statusCode: number; error: string; code?: 'REAUTH_REQUIRED' }
export type EditorialResource = 'service' | 'site';
export interface EditorialRevision {
  id: string; resource: EditorialResource; resourceId: string; version: number;
  kind: 'baseline' | 'created' | 'saved' | 'restored'; createdAt: string;
  actor: { userId: string; name: string } | null; restoredFrom: string | null;
  content: ServiceContent | { name: string; footer: SiteFooter };
}
export interface EditorialHistoryPage { items: EditorialRevision[]; nextCursor: string | null }
export interface RestoreRevisionInput { operationId: string; expectedVersion: number; sourceRevisionId: string }
export interface RestoreRevisionResult {
  operationId: string; appliedVersion: number; replayed: boolean; service?: PublicationService; site?: SiteDraft;
}
export interface UnpublishServiceInput { operationId: string; expectedDraftVersion: number;
  expectedPublicationVersion: number; expectedPublicationRevision: number }
export interface UnpublishServiceResult { operationId: string; replayed: boolean; service: PublicationService }
export const S03_ROUTES = {
  site: (tenantId: string) => `/api/tenants/${encodeURIComponent(tenantId)}/publication/site`,
  services: (tenantId: string) => `/api/tenants/${encodeURIComponent(tenantId)}/publication/services`,
  service: (tenantId: string, id: string) => `/api/tenants/${encodeURIComponent(tenantId)}/publication/services/${encodeURIComponent(id)}`,
  publicService: (tenantSlug: string, serviceSlug: string) => `/api/public/sites/${encodeURIComponent(tenantSlug)}/services/${encodeURIComponent(serviceSlug)}`,
} as const;
