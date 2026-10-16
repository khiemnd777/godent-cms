import { BadRequestException, ForbiddenException, NotFoundException, PayloadTooLargeException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { S02Database, S02Transaction } from '../database';
import type { createS02Auth } from '../auth';
import { ADMIN_ORIGIN } from '../contracts/s02';
import {parseM4Kind,parseM4Locale} from '../contracts/m4-validation';
import { MEDIA_LIMITS, type MediaAsset, type MediaPage, type MediaAccessResult } from '../contracts/s07';
import { boundedUpload, detectImage, mediaAccess, mediaObject, mediaPermission, mediaVersion, mediaWithdrawal } from '../media/input';
import { MediaSigner } from '../media/signing';
import { MediaStorage } from '../media/storage';
import { assertApiHost, assertMutationRequest, decodePageCursor, encodePageCursor, isMutation, nodeHeaders, parseIdentifier, type PrivateRequest } from './request-security';

const assetView=sql`a.id,a.tenant_id AS "tenantId",a.material_kind AS "materialKind",a.state,a.version,a.revision,a.bytes,
 a.detected_type AS "detectedType",a.width,a.height,a.created_at AS "createdAt",a.withdrawn_at AS "withdrawnAt",a.rejection_code AS "rejectionCode",
 gcms_s07.publishable(a.tenant_id,a.id,a.revision) AS publishable,
 (SELECT jsonb_build_object('scope',p.scope,'evidenceReference',p.evidence_reference,'grantedAt',p.granted_at) FROM gcms_s07.permission p WHERE p.tenant_id=a.tenant_id AND p.asset_id=a.id AND p.revoked_at IS NULL) AS permission,
 (SELECT jsonb_build_object('status',j.status,'attempts',j.attempts,'failureCode',j.failure_code,'completedAt',j.completed_at) FROM gcms_s07.job j WHERE j.tenant_id=a.tenant_id AND j.asset_id=a.id AND j.kind='process' ORDER BY j.created_at DESC LIMIT 1) AS processing,
 (SELECT jsonb_build_object('status',j.status,'attempts',j.attempts,'failureCode',j.failure_code,'completedAt',j.completed_at) FROM gcms_s07.job j WHERE j.tenant_id=a.tenant_id AND j.asset_id=a.id AND j.kind='purge' ORDER BY j.created_at DESC LIMIT 1) AS purge`;
type Target={key:string;bytes:number;checksum?:string};
export interface MediaBinary { body:Buffer; type:string; attachment:boolean }
export class MediaService {
  constructor(private readonly db:S02Database,private readonly identity:ReturnType<typeof createS02Auth>,private readonly storage:MediaStorage,private readonly signer:MediaSigner) {}
  private async actor(request:PrivateRequest,multipart=false) {
    assertApiHost(request.headers);const headers=nodeHeaders(request.headers),actor=await this.identity.currentSession(headers);
    if(!actor) throw new UnauthorizedException();
    if(isMutation(request.method)) {
      if(multipart) {
        if(request.headers.origin!==ADMIN_ORIGIN || typeof request.headers['content-type']!=='string' || !/^multipart\/form-data;\s*boundary=[A-Za-z0-9'()+_,./:=?-]{1,200}$/i.test(request.headers['content-type'])) throw new BadRequestException();
      } else assertMutationRequest(request.headers);
      if(!this.identity.verifyCsrf(headers,actor)) throw new ForbiddenException();
    }
    return actor;
  }
  private async asset(tx:S02Transaction,tenant:string,id:string):Promise<MediaAsset> {
    const rows=await tx.execute(sql`SELECT ${assetView} FROM gcms_s07.asset a WHERE a.tenant_id=${tenant} AND a.id=${id}`);
    if(!rows[0]) throw new NotFoundException();
    return rows[0] as unknown as MediaAsset;
  }
  async list(request:PrivateRequest,tenant:string,query:Record<string,unknown>):Promise<MediaPage> {
    const t=parseIdentifier(tenant),scope=`${t}:s07-media`,actor=await this.actor(request);
    if(Object.keys(query).some(k=>k!=='cursor')) throw new BadRequestException();
    const after=decodePageCursor(query.cursor,scope);
    return this.db.withReadTenant(actor,t,async tx=>{
      const rows=await tx.execute(sql`SELECT ${assetView} FROM gcms_s07.asset a WHERE a.tenant_id=${t} AND (${after}::text IS NULL OR a.id>${after}) ORDER BY a.id LIMIT 26`);
      const items=(rows as unknown as MediaAsset[]).slice(0,25);
      return {items,nextCursor:rows.length>25?encodePageCursor(scope,items[items.length-1].id):null};
    });
  }
  async read(request:PrivateRequest,tenant:string,id:string) {
    const t=parseIdentifier(tenant),a=parseIdentifier(id),actor=await this.actor(request);
    return this.db.withReadTenant(actor,t,tx=>this.asset(tx,t,a));
  }
  async upload(request:PrivateRequest&IncomingMessage,tenant:string):Promise<MediaAsset> {
    const t=parseIdentifier(tenant),actor=await this.actor(request,true);
    await this.db.withTenant(actor,t,async()=>{});
    const length=request.headers['content-length'];
    if(typeof length==='string' && (!/^\d{1,9}$/.test(length) || Number(length)>MEDIA_LIMITS.bytes+MEDIA_LIMITS.multipartOverhead)) throw new PayloadTooLargeException();
    const receiveDeadline=setTimeout(()=>request.destroy(),15_000);
    let received:Buffer;
    try {received=await boundedUpload(request);} finally {clearTimeout(receiveDeadline);}
    let form:Awaited<ReturnType<Request['formData']>>;
    try {form=await new Request('http://127.0.0.1/upload',{method:'POST',headers:{'content-type':String(request.headers['content-type'])},body:received}).formData();}
    catch {throw new BadRequestException();}
    const keys=Array.from(form.keys());
    if(keys.length!==3 || keys.sort().join(',')!=='file,materialKind,operationId') throw new BadRequestException();
    const operation=parseIdentifier(form.get('operationId')),kind=form.get('materialKind'),file=form.get('file');
    if(!['ordinary','patient_derived'].includes(String(kind)) || !(file instanceof File)) throw new BadRequestException();
    if(!file.size || file.size>MEDIA_LIMITS.bytes) throw new PayloadTooLargeException();
    const bytes=Buffer.from(await file.arrayBuffer());detectImage(bytes);
    const checksum=createHash('sha256').update(bytes).digest('hex');
    const reserved=await this.db.withTenant(actor,t,async tx=>{
      const rows=await tx.execute(sql`SELECT gcms_s07.reserve_upload(${t},${operation},${checksum},${bytes.byteLength},${String(kind)}) AS id`);
      return this.asset(tx,t,String(rows[0].id));
    });
    if(reserved.state!=='uploading') return reserved;
    // Share the existing asset I/O lock with process/purge and tenant deletion.
    // A deletion may fence the tenant while PUT is in flight, but cannot finish
    // deleting this object until the writer has settled and released this lock.
    const connection=await this.db.tenantDb.$client.reserve(),lockIdentity=`${t}/${reserved.id}`;
    let locked=false;
    try {
      await connection`SELECT pg_advisory_lock(hashtextextended(${lockIdentity},7517))`;locked=true;
      await this.db.withTenant(actor,t,async()=>{});
      try {await this.storage.put(`original/${t}/${reserved.id}`,bytes,'application/octet-stream');}
      catch {throw new ServiceUnavailableException();}
      return await this.db.withTenant(actor,t,async tx=>{
        await tx.execute(sql`SELECT gcms_m5.media_original_stored(${t},${reserved.id},${bytes.byteLength})`);
        await tx.execute(sql`SELECT gcms_s07.finish_upload(${t},${reserved.id},${checksum})`);
        return this.asset(tx,t,reserved.id);
      });
    } finally {
      try {if(locked)await connection`SELECT pg_advisory_unlock(hashtextextended(${lockIdentity},7517))`;}
      finally {connection.release();}
    }
  }
  async permission(request:PrivateRequest,tenant:string,id:string,input:unknown) {
    const t=parseIdentifier(tenant),a=parseIdentifier(id),value=mediaPermission(input),actor=await this.actor(request);
    return this.db.withTenant(actor,t,async tx=>{
      const result=await tx.execute(sql`SELECT gcms_s07.command(${t},${a},${value.operationId},${value.expectedVersion},${JSON.stringify({type:'permission',scope:value.scope,evidenceReference:value.evidenceReference})}::text::jsonb) AS result`);
      if(!result[0]?.result) throw new NotFoundException();return this.asset(tx,t,a);
    });
  }
  async withdraw(request:PrivateRequest,tenant:string,id:string,input:unknown) {
    const t=parseIdentifier(tenant),a=parseIdentifier(id),value=mediaWithdrawal(input),actor=await this.actor(request);
    return this.db.withSafetyTenant(actor,t,async tx=>{
      const result=await tx.execute(sql`SELECT gcms_s07.command(${t},${a},${value.operationId},${value.expectedVersion},${JSON.stringify({type:'withdrawal',reason:value.reason})}::text::jsonb) AS result`);
      if(!result[0]?.result) throw new NotFoundException();return this.asset(tx,t,a);
    });
  }
  async retry(request:PrivateRequest,tenant:string,id:string,input:unknown) {
    const t=parseIdentifier(tenant),a=parseIdentifier(id),value=mediaObject(input,['expectedVersion','operationId']),actor=await this.actor(request);
    const operation=parseIdentifier(value.operationId),expected=mediaVersion(value.expectedVersion);
    return this.db.withTenant(actor,t,async tx=>{
      const result=await tx.execute(sql`SELECT gcms_s07.command(${t},${a},${operation},${expected},${JSON.stringify({type:'retry'})}::text::jsonb) AS result`);
      if(!result[0]?.result) throw new NotFoundException();return this.asset(tx,t,a);
    });
  }
  async access(request:PrivateRequest,tenant:string,id:string,input:unknown):Promise<MediaAccessResult> {
    const t=parseIdentifier(tenant),a=parseIdentifier(id),value=mediaAccess(input),actor=await this.actor(request);
    return this.db.withReadTenant(actor,t,async tx=>{
      const rows=await tx.execute(sql`SELECT gcms_s07.private_target(${t},${a},${value.revision},${value.variant}) AS target`);
      if(!rows[0]?.target) throw new NotFoundException();
      const signed=this.signer.issue({tenantId:t,assetId:a,revision:value.revision,variant:value.variant,purpose:value.purpose,userId:actor.userId,sessionId:actor.sessionId});
      return {url:`http://127.0.0.1:5890/api/media/access?token=${signed.token}`,expiresAt:signed.expiresAt};
    });
  }
  async privateRead(request:PrivateRequest,token:unknown):Promise<MediaBinary> {
    const claims=this.signer.verify(token),actor=await this.actor(request);
    if(actor.userId!==claims.userId || actor.sessionId!==claims.sessionId) throw new ForbiddenException();
    const getTarget=()=>this.db.withReadTenant(actor,claims.tenantId,async tx=>{
      const rows=await tx.execute(sql`SELECT gcms_s07.private_target(${claims.tenantId},${claims.assetId},${claims.revision},${claims.variant}) AS target`);
      if(!rows[0]?.target) throw new NotFoundException();return rows[0].target as Target;
    });
    const initial=await getTarget();let body:Buffer;
    try {body=await this.storage.get(initial.key,initial.bytes);} catch {throw new ServiceUnavailableException();}
    this.signer.verify(token);const current=await getTarget();
    if(current.key!==initial.key) throw new NotFoundException();
    if(claims.variant==='original' && createHash('sha256').update(body).digest('hex')!==initial.checksum) throw new ServiceUnavailableException();
    return {body,type:claims.variant==='cover'?'image/webp':`image/${detectImage(body)==='jpeg'?'jpeg':detectImage(body)}`,attachment:claims.variant==='original'};
  }
  async publicRead(request:PrivateRequest,tenant:string,id:string,revision:string):Promise<MediaBinary> {
    assertApiHost(request.headers);await this.db.verifyRoles();const t=parseIdentifier(tenant),a=parseIdentifier(id),r=mediaVersion(Number(revision));
    if(String(r)!==revision) throw new BadRequestException();
    const getTarget=async()=>{
      const rows=await this.db.tenantDb.execute(sql`SELECT gcms_s07.public_target(${t},${a},${r}) AS target`);
      if(!rows[0]?.target) throw new NotFoundException();return rows[0].target as Target;
    };
    const initial=await getTarget();let body:Buffer;
    try {body=await this.storage.get(initial.key,initial.bytes);} catch {throw new ServiceUnavailableException();}
    const current=await getTarget();if(current.key!==initial.key) throw new NotFoundException();
    return {body,type:'image/webp',attachment:false};
  }
  /** M3 grants never authorize the legacy service-cover gateway. */
  async contentPublicRead(request:PrivateRequest,tenant:string,resource:string,publication:string,id:string,revision:string):Promise<MediaBinary>{
    assertApiHost(request.headers);await this.db.verifyRoles();const t=parseIdentifier(tenant),r=parseIdentifier(resource),p=parseIdentifier(publication),a=parseIdentifier(id),v=mediaVersion(Number(revision));
    if(String(v)!==revision)throw new BadRequestException();
    const target=async()=>{const rows=await this.db.tenantDb.execute(sql`SELECT gcms_m3.public_media_target(${t},${r},${p},${a},${v}) AS target`);if(!rows[0]?.target)throw new NotFoundException();return rows[0].target as Target;};
    const initial=await target();let body:Buffer;try{body=await this.storage.get(initial.key,initial.bytes);}catch{throw new ServiceUnavailableException();}
    const current=await target();if(current.key!==initial.key)throw new NotFoundException();return {body,type:'image/webp',attachment:false};
  }
  async builderPublicRead(request:PrivateRequest,tenant:string,kind:string,resource:string,locale:string,publication:string,id:string,revision:string):Promise<MediaBinary>{
    assertApiHost(request.headers);await this.db.verifyRoles();const t=parseIdentifier(tenant),r=parseIdentifier(resource),p=parseIdentifier(publication),a=parseIdentifier(id),v=mediaVersion(Number(revision));
    let k:string,l:string;try{k=kind==='config'?'config':parseM4Kind(kind);l=parseM4Locale(locale);}catch{throw new BadRequestException();}if(String(v)!==revision)throw new BadRequestException();
    const target=async()=>{const rows=await this.db.tenantDb.transaction(async tx=>{await tx.execute(sql`SELECT set_config('statement_timeout','5s',true),set_config('lock_timeout','3s',true)`);return tx.execute(sql`SELECT gcms_m4.media_target(${t},${k},${r},${l},${p},${a},${v}) AS target`);});if(!rows[0]?.target)throw new NotFoundException();return rows[0].target as Target;};
    const initial=await target();let body:Buffer;try{body=await this.storage.get(initial.key,initial.bytes);}catch{throw new ServiceUnavailableException();}const current=await target();if(current.key!==initial.key)throw new NotFoundException();return {body,type:'image/webp',attachment:false};
  }

}
