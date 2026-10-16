import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { S02Auth } from '../auth';
import type { S02Database, S02Transaction, SessionActor } from '../database';
import type { Page } from '../contracts/s02';
import { boundedText, canonicalServiceUrl, exactObject, legacyDocument, parseRichText, parseServiceInput, parseSlug, richTextPlain } from '../contracts/content';
import { S03_LIMITS, type PublicationResult, type PublicationService, type PublicServicePage, type ServicePreview, type SiteDraft } from '../contracts/s03';
import { assertMutationRequest, decodePageCursor, encodePageCursor, isMutation, nodeHeaders, parseIdentifier, type PrivateRequest } from './request-security';

export class ReauthenticationRequired extends ForbiddenException {}
function parsed<T>(parse: () => T): T { try { return parse(); } catch { throw new BadRequestException(); } }
function version(value: unknown, zero = false): number {
  if (!Number.isSafeInteger(value) || Number(value)<(zero?0:1) || Number(value)>=2147483647) throw new BadRequestException();
  return value as number;
}
const draftColumns = sql`d.id,d.tenant_id AS "tenantId",d.slug,d.title,d.summary,
  coalesce(d.body_document,gcms_s02.plain_document(d.body)) AS body,
  jsonb_build_object('title',d.seo_title,'description',d.seo_description) AS seo,d.locale,d.version AS "draftVersion",
  d.slug_locked AS "slugLocked",d.updated_at AS "updatedAt",coalesce(p.publication_version,0) AS "publicationVersion",
  p.draft_version AS "publishedDraftVersion",p.site_version AS "publishedSiteVersion",coalesce(s.version,0) AS "siteVersion"`;
const draftJoins = sql`LEFT JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id
  LEFT JOIN gcms_s02.publication_snapshot p ON p.tenant_id=ptr.tenant_id AND p.service_id=ptr.service_id AND p.id=ptr.snapshot_id
  LEFT JOIN gcms_s02.site_draft s ON s.tenant_id=d.tenant_id`;
function service(row: PublicationService): PublicationService { return { ...row, updatedAt: new Date(row.updatedAt).toISOString() }; }

// JSON strings bind as text before casting: Bun 1.4.3 otherwise serializes a
// typed JSONB string again. All document writes below use ::text::jsonb.

export class PublicationServiceOperations {
  constructor(private readonly db: S02Database, private readonly identity: S02Auth) {}
  private async actor(request: PrivateRequest): Promise<SessionActor> {
    const headers = nodeHeaders(request.headers); const actor = await this.identity.currentSession(headers);
    if (!actor) throw new UnauthorizedException();
    if (isMutation(request.method)) {
      assertMutationRequest(request.headers);
      if (!this.identity.verifyCsrf(headers, actor)) throw new ForbiddenException();
    }
    return actor;
  }
  private async site(tx: S02Transaction, tenantId: string): Promise<SiteDraft> {
    const rows = await tx.execute(sql`SELECT tenant_id AS "tenantId",slug,version,name,
      jsonb_build_object('intro',footer_intro,'body',footer_body) AS footer,slug_locked AS "slugLocked"
      FROM gcms_s02.site_draft WHERE tenant_id=${tenantId}`);
    if (rows[0]) return rows[0] as unknown as SiteDraft;
    const tenants = await tx.execute(sql`SELECT name FROM gcms_s02.tenant WHERE id=${tenantId}`);
    if (!tenants[0]) throw new NotFoundException();
    return { tenantId,slug:null,version:0,name:String(tenants[0].name),footer:{intro:'',body:legacyDocument('')},slugLocked:false };
  }
  private async get(tx: S02Transaction, tenantId: string, id: string): Promise<PublicationService> {
    const rows = await tx.execute(sql`SELECT ${draftColumns} FROM gcms_s02.service_draft d ${draftJoins} WHERE d.tenant_id=${tenantId} AND d.id=${id}`);
    if (!rows[0]) throw new NotFoundException();
    return service(rows[0] as unknown as PublicationService);
  }
  async getSite(request: PrivateRequest, tenant: string) {
    const tenantId=parseIdentifier(tenant); const actor=await this.actor(request);
    return this.db.withTenant(actor,tenantId,tx=>this.site(tx,tenantId));
  }
  async saveSite(request: PrivateRequest, tenant: string, input: unknown) {
    const tenantId=parseIdentifier(tenant); const actor=await this.actor(request);
    const value=parsed(()=>{
      const entry=exactObject(input,['slug','name','footer','expectedVersion']);
      const footer=exactObject(entry.footer,['intro','body']);
      return {slug:parseSlug(entry.slug),name:boundedText(entry.name,160,true).trim(),
        intro:boundedText(footer.intro,S03_LIMITS.footerIntro),body:parseRichText(footer.body,S03_LIMITS.footerText),expected:version(entry.expectedVersion,true)};
    });
    return this.db.withTenant(actor,tenantId,async(tx,current)=>{
      const previous=await this.site(tx,tenantId);
      if(previous.version!==value.expected || (previous.slugLocked && previous.slug!==value.slug)) throw new ConflictException();
      await tx.execute(sql`INSERT INTO gcms_s02.site_draft(tenant_id,slug,version,name,footer_intro,footer_body,updated_by)
        VALUES(${tenantId},${value.slug},1,${value.name},${value.intro},${JSON.stringify(value.body)}::text::jsonb,${current.userId})
        ON CONFLICT(tenant_id) DO UPDATE SET slug=excluded.slug,version=site_draft.version+1,name=excluded.name,
          footer_intro=excluded.footer_intro,footer_body=excluded.footer_body,updated_by=excluded.updated_by,updated_at=now()`);
      await this.audit(tx,current,tenantId,'site.saved',tenantId);
      return this.site(tx,tenantId);
    });
  }
  async list(request: PrivateRequest, tenant: string, cursor: unknown): Promise<Page<PublicationService>> {
    const tenantId=parseIdentifier(tenant); const scope=`${tenantId}:publication-services`; const after=decodePageCursor(cursor,scope); const actor=await this.actor(request);
    return this.db.withTenant(actor,tenantId,async tx=>{
      const rows=await tx.execute(sql`SELECT ${draftColumns} FROM gcms_s02.service_draft d ${draftJoins}
        WHERE d.tenant_id=${tenantId} AND (${after}::text IS NULL OR d.id>${after}) ORDER BY d.id LIMIT 26`);
      const items=(rows as unknown as PublicationService[]).slice(0,25).map(service);
      return {items,nextCursor:rows.length>25?encodePageCursor(scope,items[items.length-1].id):null};
    });
  }
  async read(request: PrivateRequest, tenant: string, id: string): Promise<PublicationService> {
    const tenantId=parseIdentifier(tenant); const serviceId=parseIdentifier(id); const actor=await this.actor(request);
    return this.db.withTenant(actor,tenantId,tx=>this.get(tx,tenantId,serviceId));
  }
  async preview(request: PrivateRequest, tenant: string, id: string): Promise<ServicePreview> {
    const tenantId=parseIdentifier(tenant); const serviceId=parseIdentifier(id); const actor=await this.actor(request);
    return this.db.withTenant(actor,tenantId,async tx=>{
      const draft=await this.get(tx,tenantId,serviceId); const site=await this.site(tx,tenantId);
      return {service:draft,site,canonicalUrl:site.slug&&draft.slug?canonicalServiceUrl(site.slug,draft.slug):null};
    });
  }
  async create(request: PrivateRequest, tenant: string, input: unknown) {
    const tenantId=parseIdentifier(tenant); const value=parsed(()=>parseServiceInput(input)); const actor=await this.actor(request);
    return this.db.withTenant(actor,tenantId,async(tx,current)=>{
      const id=randomUUID();
      await tx.execute(sql`INSERT INTO gcms_s02.service_draft(tenant_id,id,slug,title,summary,body,body_document,seo_title,seo_description,updated_by)
        VALUES(${tenantId},${id},${value.slug},${value.title},${value.summary},${richTextPlain(value.body)},${JSON.stringify(value.body)}::text::jsonb,
          ${value.seo.title},${value.seo.description},${current.userId})`);
      await this.audit(tx,current,tenantId,'draft.created',id); return this.get(tx,tenantId,id);
    });
  }
  async save(request: PrivateRequest, tenant: string, id: string, input: unknown) {
    const tenantId=parseIdentifier(tenant); const serviceId=parseIdentifier(id); const actor=await this.actor(request);
    const value=parsed(()=>{const entry=exactObject(input,['slug','title','summary','body','seo','expectedDraftVersion']);
      const {expectedDraftVersion,...content}=entry; return {content:parseServiceInput(content),expected:version(expectedDraftVersion)};});
    return this.db.withTenant(actor,tenantId,async(tx,current)=>{
      const previous=await this.get(tx,tenantId,serviceId);
      if(previous.draftVersion!==value.expected || (previous.slugLocked&&previous.slug!==value.content.slug)) throw new ConflictException();
      const c=value.content;
      await tx.execute(sql`UPDATE gcms_s02.service_draft SET slug=${c.slug},title=${c.title},summary=${c.summary},body=${richTextPlain(c.body)},
        body_document=${JSON.stringify(c.body)}::text::jsonb,seo_title=${c.seo.title},seo_description=${c.seo.description},version=version+1,
        updated_by=${current.userId},updated_at=now() WHERE tenant_id=${tenantId} AND id=${serviceId} AND version=${value.expected}`);
      await this.audit(tx,current,tenantId,'draft.saved',serviceId); return this.get(tx,tenantId,serviceId);
    });
  }
  async publish(request: PrivateRequest, tenant: string, id: string, input: unknown): Promise<PublicationResult> {
    const tenantId=parseIdentifier(tenant); const serviceId=parseIdentifier(id); const actor=await this.actor(request);
    const value=parsed(()=>{const v=exactObject(input,['expectedDraftVersion','expectedPublicationVersion','expectedSiteVersion','requestKey']);
      return {expectedDraftVersion:version(v.expectedDraftVersion),expectedPublicationVersion:version(v.expectedPublicationVersion,true),
        expectedSiteVersion:version(v.expectedSiteVersion),requestKey:parseIdentifier(v.requestKey)};});
    const fingerprint=createHash('sha256').update(JSON.stringify(value)).digest('hex');
    return this.db.withTenant(actor,tenantId,async(tx,current)=>{
      try { await this.identity.requireRecent(current,tx); } catch(error) {
        if(error instanceof ForbiddenException) throw new ReauthenticationRequired(); throw error;
      }
      const old=await tx.execute(sql`SELECT id,publication_version,draft_version,site_version,published_at,request_fingerprint
        FROM gcms_s02.publication_snapshot WHERE tenant_id=${tenantId} AND service_id=${serviceId} AND request_key=${value.requestKey}`);
      const site=await this.site(tx,tenantId); const draft=await this.get(tx,tenantId,serviceId);
      if(!site.slug||!draft.slug) throw new ConflictException();
      const canonicalUrl=canonicalServiceUrl(site.slug,draft.slug);
      if(old[0]) {
        if(old[0].request_fingerprint!==fingerprint) throw new ConflictException();
        return {publicationId:String(old[0].id),publicationVersion:Number(old[0].publication_version),draftVersion:Number(old[0].draft_version),
          siteVersion:Number(old[0].site_version),canonicalUrl,publishedAt:new Date(String(old[0].published_at)).toISOString(),replayed:true};
      }
      if(draft.draftVersion!==value.expectedDraftVersion||draft.publicationVersion!==value.expectedPublicationVersion||site.version!==value.expectedSiteVersion) throw new ConflictException();
      // Legacy drafts must meet the S03 safe-content bounds before first publication.
      parsed(()=>parseRichText(draft.body));
      const publicationId=randomUUID(); const publicationVersion=draft.publicationVersion+1;
      const inserted=await tx.execute(sql`INSERT INTO gcms_s02.publication_snapshot(tenant_id,service_id,id,publication_version,draft_version,site_version,
        request_key,request_fingerprint,closure,published_by) SELECT d.tenant_id,d.id,${publicationId},${publicationVersion},d.version,s.version,
        ${value.requestKey},${fingerprint},gcms_s02.snapshot_closure(d,s),${current.userId}
        FROM gcms_s02.service_draft d JOIN gcms_s02.site_draft s ON s.tenant_id=d.tenant_id
        WHERE d.tenant_id=${tenantId} AND d.id=${serviceId} RETURNING published_at`);
      if(!inserted[0]) throw new ConflictException();
      await tx.execute(sql`INSERT INTO gcms_s02.publication_pointer(tenant_id,service_id,snapshot_id) VALUES(${tenantId},${serviceId},${publicationId})
        ON CONFLICT(tenant_id,service_id) DO UPDATE SET snapshot_id=excluded.snapshot_id`);
      await tx.execute(sql`INSERT INTO gcms_s02.publication_intent(tenant_id,service_id,snapshot_id) VALUES(${tenantId},${serviceId},${publicationId})`);
      await tx.execute(sql`UPDATE gcms_s02.service_draft SET slug_locked=true WHERE tenant_id=${tenantId} AND id=${serviceId}`);
      await tx.execute(sql`UPDATE gcms_s02.site_draft SET slug_locked=true WHERE tenant_id=${tenantId}`);
      await this.audit(tx,current,tenantId,'service.published',publicationId);
      return {publicationId,publicationVersion,draftVersion:draft.draftVersion,siteVersion:site.version,canonicalUrl,
        publishedAt:new Date(String(inserted[0].published_at)).toISOString(),replayed:false};
    });
  }
  async publicRead(request: PrivateRequest, tenant: string, slug: string): Promise<PublicServicePage> {
    const tenantSlug=parsed(()=>parseSlug(tenant)); const serviceSlug=parsed(()=>parseSlug(slug));
    if(request.originalUrl!==`/api/public/sites/${tenantSlug}/services/${serviceSlug}`) throw new BadRequestException();
    await this.db.verifyRoles();
    const result=await this.db.tenantDb.execute(sql`SELECT gcms_s02.read_public_service(${tenantSlug},${serviceSlug}) AS page`);
    if(!result[0]?.page) throw new NotFoundException();
    const page=result[0].page as PublicServicePage;
    // Validate the published read contract before server rendering; never render unknown sections.
    parsed(()=>{parseServiceInput(page.service);parseRichText(page.site.footer.body,S03_LIMITS.footerText);
      boundedText(page.site.name,160,true);boundedText(page.site.footer.intro,S03_LIMITS.footerIntro);});
    if(page.canonicalUrl!==canonicalServiceUrl(tenantSlug,serviceSlug)||page.locale!=='vi'||page.schemaVersion!==1) throw new NotFoundException();
    return page;
  }
  private async audit(tx:S02Transaction,actor:SessionActor,tenantId:string,event:string,target:string) {
    await tx.execute(sql`INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id)
      VALUES(${randomUUID()},${tenantId},${actor.userId},${event},${target})`);
  }
}
