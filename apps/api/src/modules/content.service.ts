import {createHash} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException,UnauthorizedException} from '@nestjs/common';
import {sql} from 'drizzle-orm';
import type {S02Auth} from '../auth';
import type {S02Database,S02Transaction} from '../database';
import {boundedText,exactObject,parseSlug} from '../contracts/content';
import type {ContentDraft,ContentKind,ContentPage,ContentHistoryItem,ContentPermission,ContentPermissionCommandResult,ContentPermissions,PublicContentPage,PublicContentList,ContentReferenceOption} from '../contracts/m3';
import {M3_LIMITS} from '../contracts/m3';
import {contentKind,m3Id,m3Version,m3QueryObject,parseContentReferences,parseDentalContent,parsePermissionCursorValue,permissionCursorValue,referenceKind} from '../contracts/m3-validation';
import {assertApiHost,assertMutationRequest,decodePageCursor,encodePageCursor,isMutation,nodeHeaders,parseIdentifier,type PrivateRequest} from './request-security';
import {ReauthenticationRequired} from './publication.service';
function parse<T>(action:()=>T):T {try{return action();}catch{throw new BadRequestException();}}
const columns=sql`r.id,r.tenant_id AS "tenantId",r.kind,r.version,r.content,r.slug_locked AS "slugLocked",r.publication_version AS "publicationVersion",r.publication_revision AS "publicationRevision",(r.active_publication_id IS NOT NULL) AS "activePublication",p.draft_version AS "publishedVersion",r.updated_at AS "updatedAt"`;
const joins=sql`LEFT JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id`;
const permissionColumns=sql`p.id,p.resource_id AS "resourceId",p.revision,p.scope,p.evidence_reference AS "evidenceReference",p.granted_by AS "grantedBy",to_char(p.granted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "grantedAt",to_char(p.withdrawn_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "withdrawnAt",p.withdrawal_reason AS "withdrawalReason",CASE WHEN j.permission_id IS NULL THEN NULL ELSE jsonb_build_object('status',CASE WHEN j.status='processing' THEN 'pending' ELSE j.status END,'attempts',j.attempts,'failureCode',j.failure_code) END AS purge`;
const permissionJoin=sql`LEFT JOIN gcms_m3.purge_job j ON j.tenant_id=p.tenant_id AND j.permission_id=p.id`;
function draft(row:Record<string,unknown>):ContentDraft{return {...row,updatedAt:new Date(String(row.updatedAt)).toISOString()} as unknown as ContentDraft;}
export class ContentService {
  constructor(private readonly db:S02Database,private readonly identity:S02Auth){}
  private async actor(request:PrivateRequest) {
    assertApiHost(request.headers);const headers=nodeHeaders(request.headers),actor=await this.identity.currentSession(headers);
    if(!actor)throw new UnauthorizedException();if(isMutation(request.method)){assertMutationRequest(request.headers);if(!this.identity.verifyCsrf(headers,actor))throw new ForbiddenException();}return actor;
  }
  private async get(tx:S02Transaction,t:string,k:ContentKind,id:string):Promise<ContentDraft>{const rows=await tx.execute(sql`SELECT ${columns} FROM gcms_m3.resource r ${joins} WHERE r.tenant_id=${t} AND r.id=${id} AND r.kind=${k}`);if(!rows[0])throw new NotFoundException();return draft(rows[0]);}
  private query(input:Record<string,unknown>,scope:string,referenceFilters=false) {
    return parse(()=>{const v=exactObject(m3QueryObject(input),referenceFilters?['q','cursor','pageSize','referenceKind','referenceId','referencePublicationId']:['q','cursor','pageSize','published','kind']);
      const q=v.q===undefined?'':boundedText(v.q,160).normalize('NFC').trim().toLowerCase();let limit=20;
      if(v.pageSize!==undefined){if(typeof v.pageSize!=='string'||!/^[1-9][0-9]?$/.test(v.pageSize))throw new Error();limit=Number(v.pageSize);if(limit>50)throw new Error();}
      if(v.published!==undefined&&v.published!=='true')throw new Error();
      const fk=v.referenceKind===undefined?null:referenceKind(v.referenceKind),fi=v.referenceId===undefined?null:m3Id(v.referenceId),fp=v.referencePublicationId===undefined?null:m3Id(v.referencePublicationId);
      if((fk===null)!==(fi===null)||(fp!==null&&fi===null))throw new Error();
      const binding=createHash('sha256').update(JSON.stringify({q,limit,published:v.published,kind:v.kind,fk,fi,fp})).digest('hex');const key=`${scope}:${binding}`;
      const after=decodePageCursor(v.cursor,key);if(after!==null)m3Id(after);return {q,limit,published:v.published==='true',after,key,fk,fi,fp};});
  }
  async list(request:PrivateRequest,tenant:string,kind:string,query:Record<string,unknown>):Promise<ContentPage<ContentDraft>> {
    const t=parseIdentifier(tenant),k=parse(()=>contentKind(kind)),actor=await this.actor(request),q=this.query(query,`${t}:content:${k}`);
    return this.db.withTenant(actor,t,async tx=>{const rows=await tx.execute(sql`SELECT ${columns} FROM gcms_m3.resource r ${joins} WHERE r.tenant_id=${t} AND r.kind=${k} AND (${q.after}::text IS NULL OR r.id>${q.after}) AND (NOT ${q.published} OR r.active_publication_id IS NOT NULL) AND (${q.q}='' OR position(${q.q} IN lower(r.content->>'title'))>0 OR position(${q.q} IN r.slug)>0) ORDER BY r.id LIMIT ${q.limit+1}`);const items=rows.slice(0,q.limit).map(draft);return {items,nextCursor:rows.length>q.limit?encodePageCursor(q.key,items[items.length-1].id):null};});
  }
  async read(request:PrivateRequest,tenant:string,kind:string,id:string){const t=parseIdentifier(tenant),k=parse(()=>contentKind(kind)),r=parseIdentifier(id),actor=await this.actor(request);return this.db.withTenant(actor,t,tx=>this.get(tx,t,k,r));}
  async command(request:PrivateRequest,tenant:string,kind:string,id:string|undefined,action:string,input:unknown){
    const t=parseIdentifier(tenant),k=parse(()=>contentKind(kind)),actor=await this.actor(request);
    const c:Record<string,unknown>=parse(()=>{const keys:Record<string,string[]>={create:['operationId','content'],save:['operationId','expectedVersion','content'],publish:['operationId','expectedVersion','expectedPublicationVersion','expectedPublicationRevision','expectedSiteVersion'],unpublish:['operationId','expectedVersion','expectedPublicationRevision'],restore:['operationId','expectedVersion','sourceRevisionId'],grant:['operationId','expectedVersion','revision','scope','evidenceReference'],withdraw:['operationId','expectedVersion','permissionId','reason'],purge_retry:['operationId','expectedVersion','permissionId']};const v=exactObject(input,keys[action]);m3Id(v.operationId);
      if(action!=='create')m3Version(v.expectedVersion);
      if(action==='create'||action==='save'){v.content=parseDentalContent(v.content,id);if((v.content as {kind:string}).kind!==k)throw new Error();}
      if(action==='publish'){m3Version(v.expectedPublicationVersion,true);m3Version(v.expectedPublicationRevision,true);m3Version(v.expectedSiteVersion);}
      if(action==='unpublish')m3Version(v.expectedPublicationRevision,true);if(action==='restore')m3Id(v.sourceRevisionId);
      if(action==='grant'){m3Version(v.revision);v.evidenceReference=boundedText(v.evidenceReference,500,true).trim();const scope=exactObject(v.scope,['type','assetId','assetRevision']);if(scope.type==='text'){if(Object.keys(scope).length!==1)throw new Error();}else if(scope.type==='asset'){m3Id(scope.assetId);m3Version(scope.assetRevision);}else throw new Error();}
      if(action==='withdraw'){m3Id(v.permissionId);v.reason=boundedText(v.reason,500,true).trim();}if(action==='purge_retry')m3Id(v.permissionId);return {...v,type:action};});
    const r=id?parseIdentifier(id):String(c.operationId);
    return this.db.withTenant(actor,t,async tx=>{
      if(action!=='create')await this.get(tx,t,k,r);
      const rows=await tx.execute(sql`SELECT gcms_m3.command(${t},${r},${JSON.stringify(c)}::text::jsonb) AS result`);const result=rows[0]?.result as Record<string,unknown>;
      if(result?.code==='REAUTH_REQUIRED')throw new ReauthenticationRequired();if(result?.code==='NOT_FOUND')throw new NotFoundException();if(!result||typeof result.replayed!=='boolean')throw new ConflictException();
      if(['grant','withdraw','purge_retry'].includes(action)){
        let permissionId=String(c.permissionId);
        if(action==='grant'){const granted=await tx.execute(sql`SELECT id FROM gcms_m3.permission WHERE tenant_id=${t} AND resource_id=${r} AND revision=${c.revision} AND scope=${JSON.stringify(c.scope)}::text::jsonb`);if(!granted[0])throw new ConflictException();permissionId=String(granted[0].id);}
        const response:ContentPermissionCommandResult={operationId:String(c.operationId),replayed:result.replayed,permission:await this.permissionTx(tx,t,r,permissionId)};return response;
      }
      return {...result,draft:await this.get(tx,t,k,r)};
    });
  }
  async preview(request:PrivateRequest,tenant:string,kind:string,id:string){const t=parseIdentifier(tenant),k=parse(()=>contentKind(kind)),r=parseIdentifier(id),actor=await this.actor(request);
    return this.db.withTenant(actor,t,async tx=>{const d=await this.get(tx,t,k,r),site=await tx.execute(sql`SELECT version,slug,name FROM gcms_s02.site_draft WHERE tenant_id=${t}`);
      // Preview returns saved private content explicitly; the caller renders d.content with signed admin media.
      const issues:string[]=[];const refs=await tx.execute(sql`SELECT gcms_m3.preview_issues(${t},${r}) AS issues`);issues.push(...(refs[0]?.issues as string[]??[]));
      const resolved=await tx.execute(sql`SELECT gcms_m3.preview_references(${t},${r}) AS refs`);
      return {draft:d,site:site[0]??{version:0,slug:null,name:''},page:null,issues,resolved:resolved[0]?.refs??[]};});}
  async live(request:PrivateRequest,tenant:string,kind:string,id:string){const t=parseIdentifier(tenant),k=parse(()=>contentKind(kind)),r=parseIdentifier(id),actor=await this.actor(request);return this.db.withTenant(actor,t,async tx=>{await this.get(tx,t,k,r);const rows=await tx.execute(sql`SELECT gcms_m3.public_projection(tenant_id,id,active_publication_id) AS page FROM gcms_m3.resource WHERE tenant_id=${t} AND id=${r}`);return rows[0]?.page??null;});}
  async history(request:PrivateRequest,tenant:string,kind:string,id:string,cursor:unknown):Promise<ContentPage<ContentHistoryItem>>{const t=parseIdentifier(tenant),k=parse(()=>contentKind(kind)),r=parseIdentifier(id),actor=await this.actor(request),scope=`${t}:content-history:${r}`,after=decodePageCursor(cursor,scope);if(after!==null&&!/^[1-9][0-9]{0,8}$/.test(after))throw new BadRequestException();
    return this.db.withTenant(actor,t,async tx=>{await this.get(tx,t,k,r);const rows=await tx.execute(sql`SELECT id,version,kind,content,created_at AS "createdAt",restored_from AS "restoredFrom",jsonb_build_object('userId',actor_id,'name',actor_name) AS actor FROM gcms_m3.revision WHERE tenant_id=${t} AND resource_id=${r} AND (${after}::integer IS NULL OR version<${after}::integer) ORDER BY version DESC,id DESC LIMIT 21`);return {items:rows.slice(0,20).map(row=>({...row,createdAt:new Date(String(row.createdAt)).toISOString()})) as unknown as ContentHistoryItem[],nextCursor:rows.length>20?encodePageCursor(scope,String(rows[19].version)):null};});}
  private async permissionTx(tx:S02Transaction,t:string,r:string,id:string):Promise<ContentPermission>{const rows=await tx.execute(sql`SELECT ${permissionColumns} FROM gcms_m3.permission p ${permissionJoin} WHERE p.tenant_id=${t} AND p.resource_id=${r} AND p.id=${id}`);if(!rows[0])throw new NotFoundException();return rows[0] as unknown as ContentPermission;}
  async permission(request:PrivateRequest,tenant:string,kind:string,id:string,permissionId:string){const t=parseIdentifier(tenant),k=parse(()=>contentKind(kind)),r=parseIdentifier(id),p=parseIdentifier(permissionId),actor=await this.actor(request);return this.db.withTenant(actor,t,async tx=>{await this.get(tx,t,k,r);return this.permissionTx(tx,t,r,p);});}
  async permissions(request:PrivateRequest,tenant:string,kind:string,id:string,query:Record<string,unknown>={}):Promise<ContentPermissions>{
    const t=parseIdentifier(tenant),k=parse(()=>contentKind(kind)),r=parseIdentifier(id),actor=await this.actor(request);
    const q=parse(()=>{const v=exactObject(m3QueryObject(query),['pageSize','cursor']);let limit:number=M3_LIMITS.permissionPageSize;if(v.pageSize!==undefined){if(typeof v.pageSize!=='string'||!/^[1-9][0-9]{0,2}$/.test(v.pageSize)||Number(v.pageSize)>M3_LIMITS.maxPermissionPageSize)throw new Error();limit=Number(v.pageSize);}const key=`${t}:content-permissions:${k}:${r}:${limit}`,value=decodePageCursor(v.cursor,key),after=value===null?null:parsePermissionCursorValue(value);return {limit,key,after};});
    return this.db.withTenant(actor,t,async tx=>{await this.get(tx,t,k,r);
      const rows=await tx.execute(sql`SELECT ${permissionColumns} FROM gcms_m3.permission p ${permissionJoin} WHERE p.tenant_id=${t} AND p.resource_id=${r} AND (${q.after?.grantedAt??null}::timestamptz IS NULL OR (p.granted_at,p.id)<(${q.after?.grantedAt??null}::timestamptz,${q.after?.id??null}::text)) ORDER BY p.granted_at DESC,p.id DESC LIMIT ${q.limit+1}`);
      const items=rows.slice(0,q.limit) as unknown as ContentPermission[],last=items[items.length-1];return {items,nextCursor:rows.length>q.limit?encodePageCursor(q.key,permissionCursorValue(last.grantedAt,last.id)):null};
    });
  }
  async references(request:PrivateRequest,tenant:string,query:Record<string,unknown>):Promise<ContentPage<ContentReferenceOption>>{const t=parseIdentifier(tenant),actor=await this.actor(request),kind=parse(()=>referenceKind(query.kind)),q=this.query(query,`${t}:reference-options:${kind}`);return this.db.withTenant(actor,t,async tx=>{
    const rows=kind==='service'?await tx.execute(sql`SELECT 'service'::text AS kind,d.id,p.id AS "publicationId",p.closure->'service'->>'title' AS title,d.slug,d.version,p.publication_version AS "publicationVersion",jsonb_build_object('kind','service','slug',d.slug,'title',p.closure->'service'->'title','summary',p.closure->'service'->'summary') AS content FROM gcms_s02.service_draft d JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id JOIN gcms_s02.publication_snapshot p ON p.tenant_id=ptr.tenant_id AND p.service_id=ptr.service_id AND p.id=ptr.snapshot_id WHERE d.tenant_id=${t} AND gcms_m4.legacy_eligible(d.tenant_id,'service',d.id) AND (${q.after}::text IS NULL OR d.id>${q.after}) AND (${q.q}='' OR position(${q.q} IN lower(p.closure->'service'->>'title'))>0 OR position(${q.q} IN d.slug)>0) ORDER BY d.id LIMIT ${q.limit+1}`):await tx.execute(sql`SELECT r.kind,r.id,p.id AS "publicationId",p.content->>'title' AS title,r.slug,r.version,p.publication_version AS "publicationVersion",p.content FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE r.tenant_id=${t} AND r.kind=${kind} AND gcms_m3.resource_eligible(r.tenant_id,r.id,p.id) AND (${q.after}::text IS NULL OR r.id>${q.after}) AND (${q.q}='' OR position(${q.q} IN lower(p.content->>'title'))>0 OR position(${q.q} IN r.slug)>0) ORDER BY r.id LIMIT ${q.limit+1}`);
    const items=rows.slice(0,q.limit) as unknown as ContentReferenceOption[];return {items,nextCursor:rows.length>q.limit?encodePageCursor(q.key,items[items.length-1].id):null};});}
  async publicList(request:PrivateRequest,tenant:string,kind:string,query:Record<string,unknown>):Promise<PublicContentList>{
    assertApiHost(request.headers);const t=parse(()=>parseSlug(tenant)),k=parse(()=>referenceKind(kind)),q=this.query(query,`${t}:public-content:${k}`,true);await this.db.verifyRoles();
    const rows=await this.db.tenantDb.execute(sql`SELECT gcms_m3.public_list(${t},${k},${q.q},${q.after},${q.limit+1},${q.fk},${q.fi},${q.fp}) AS result`);
    const page=rows[0]?.result as (PublicContentList&{hasMore?:boolean;budgetLimited?:boolean})|undefined;if(!page)throw new NotFoundException();
    const items=page.items.slice(0,q.limit),hasMore=page.items.length>q.limit||page.hasMore===true;
    if(hasMore&&items.length===0)throw new ConflictException();
    // A byte-limited page may contain fewer than pageSize cards. Continue after
    // the last returned id so the excluded candidate cannot be skipped.
    const result:PublicContentList={schemaVersion:3,locale:'vi',kind:k,canonicalUrl:page.canonicalUrl,site:page.site,items,nextCursor:hasMore?encodePageCursor(q.key,items[items.length-1].id):null};
    if(Buffer.byteLength(JSON.stringify(result),'utf8')>M3_LIMITS.publicBytes)throw new ConflictException();
    return result;
  }
  async publicRead(request:PrivateRequest,tenant:string,kind:string,slug:string):Promise<PublicContentPage>{assertApiHost(request.headers);const t=parse(()=>parseSlug(tenant)),k=parse(()=>contentKind(kind)),s=parse(()=>parseSlug(slug));await this.db.verifyRoles();const rows=await this.db.tenantDb.execute(sql`SELECT gcms_m3.read_public(${t},${k},${s}) AS result`);if(!rows[0]?.result)throw new NotFoundException();return rows[0].result as PublicContentPage;}
  async serviceLinks(request:PrivateRequest,tenant:string,id:string,input?:unknown){const t=parseIdentifier(tenant),r=parseIdentifier(id),actor=await this.actor(request);return this.db.withTenant(actor,t,async tx=>{if(input!==undefined){const c=parse(()=>{const v=exactObject(input,['operationId','expectedDraftVersion','references']);return {operationId:m3Id(v.operationId),expectedDraftVersion:m3Version(v.expectedDraftVersion),references:parseContentReferences(v.references,r)};});await tx.execute(sql`SELECT gcms_m3.save_service_links(${t},${r},${JSON.stringify(c)}::text::jsonb)`);}const rows=await tx.execute(sql`SELECT gcms_m3.service_links_view(${t},${r}) AS result`);if(!rows[0]?.result)throw new NotFoundException();return rows[0].result;});}
  async publicServiceLinks(request:PrivateRequest,tenant:string,slug:string){assertApiHost(request.headers);const t=parse(()=>parseSlug(tenant)),s=parse(()=>parseSlug(slug));await this.db.verifyRoles();const rows=await this.db.tenantDb.execute(sql`SELECT gcms_m3.public_service_links(${t},${s}) AS result`);if(!rows[0]?.result)throw new NotFoundException();return rows[0].result;}
}
