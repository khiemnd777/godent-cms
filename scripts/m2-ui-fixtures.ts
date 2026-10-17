import { SQL } from 'bun';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';
import { legacyDocument } from '../apps/api/src/contracts/content';
import type { PublishServiceInput } from '../apps/api/src/contracts/s03';
import { PublicationServiceOperations } from '../apps/api/src/modules/publication.service';
import type { PrivateRequest } from '../apps/api/src/modules/request-security';
import { openPasswordSession, type S02Fixtures } from './s02-fixtures';

const OWNER='GCMS-M2-UI-v1',MANIFEST='.local/m2-fixtures.json',LOCK='.local/m2-fixtures.lock';
const labels=['A1','A2','B1','PlatformOnly'] as const;
type Identity={label:typeof labels[number];userId:string;email:string;password:string};
interface TenantFixture {label:'A'|'B';id:string;slug:string;name:string;serviceSlug:string;serviceId:string|null;publicationId:string|null;
 publishRequestKey:string;publishInput?:PublishServiceInput;pendingVersion?:number}
interface LeadFixture {id:string;tenantId:string;label:'normal'|'nearExpiry'|'otherTenant';requestKey:string;auditId:string;createdAt:string;expiresAt:string}
export interface M2UiFixtures {owner:typeof OWNER;schemaVersion:1;runId:string;status:'provisioning'|'complete';createdAt:string;
 tenants:TenantFixture[];identities:Identity[];leads:LeadFixture[];retentionTenantIds:string[];mediaTenantIds:string[]}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
async function exists(path:string) {try {await lstat(path);return true;}catch(error){if(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT')return false;throw error;}}
async function privateJson(path:string):Promise<unknown> {
 const file=await lstat(path);if(!file.isFile()||file.isSymbolicLink()||(file.mode&0o777)!==0o600||file.uid!==process.getuid?.()) throw new Error('Unsafe private fixture file');
 return JSON.parse(await readFile(path,'utf8'));
}
async function save(value:M2UiFixtures,initial=false) {
 if(initial) {await writeFile(MANIFEST,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});return;}
 const prior=await privateJson(MANIFEST) as M2UiFixtures;if(prior.owner!==OWNER||prior.runId!==value.runId) throw new Error('Manifest ownership changed');
 const temporary=`.local/m2-fixtures-${randomUUID()}.tmp`;
 await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temporary,MANIFEST);
}
function validate(value:M2UiFixtures,prior:S02Fixtures) {
 if(value.owner!==OWNER||value.schemaVersion!==1||!uuid(value.runId)||!['provisioning','complete'].includes(value.status)||!Number.isFinite(Date.parse(value.createdAt))||value.tenants?.length!==2||value.identities?.length!==4||value.leads?.length!==3) throw new Error('Unexpected manifest ownership or shape');
 if(new Set(value.tenants.map(t=>t.id)).size!==2||new Set(value.leads.map(l=>l.id)).size!==3) throw new Error('Duplicate fixture identity');
 for(const [index,label] of (['A','B'] as const).entries()) {
  const t=value.tenants[index];if(t.label!==label||!uuid(t.id)||t.slug!==`m2-ui-${value.runId.slice(0,8)}-${label.toLowerCase()}`||t.name!==`M2 Synthetic UI ${label} ${value.runId}`||t.serviceSlug!=='tu-van-nha-khoa'||!uuid(t.publishRequestKey)||(t.serviceId!==null&&!uuid(t.serviceId))||(t.publicationId!==null&&!uuid(t.publicationId))) throw new Error('Invalid owned tenant identity');
 }
 for(const label of labels) {
  const identity=value.identities.find(i=>i.label===label),source=prior.identities.find(i=>i.label===label);
  if(!identity||!source||identity.userId!==source.userId||identity.email!==source.email||identity.password!==source.password) throw new Error('Retained identity mismatch');
 }
 for(const l of value.leads) if(!uuid(l.id)||!uuid(l.requestKey)||!uuid(l.auditId)||!value.tenants.some(t=>t.id===l.tenantId)||!['normal','nearExpiry','otherTenant'].includes(l.label)||!Number.isFinite(Date.parse(l.createdAt))||!Number.isFinite(Date.parse(l.expiresAt))||Date.parse(l.expiresAt)-Date.parse(l.createdAt)!==180*86400_000) throw new Error('Invalid owned lead identity');
 const a=value.tenants[0],b=value.tenants[1];
 if(value.leads.filter(l=>l.tenantId===a.id).length!==2||value.leads.filter(l=>l.tenantId===b.id).length!==1||value.leads.find(l=>l.label==='nearExpiry')?.tenantId!==a.id||value.retentionTenantIds.join(',')!==a.id||value.mediaTenantIds.join(',')!==[a.id,b.id].join(',')) throw new Error('Invalid positive worker scope');
}
function planned(prior:S02Fixtures):M2UiFixtures {
 const runId=randomUUID(),now=new Date(),nearExpiry=new Date(now.getTime()+10*60_000);
 const tenants:TenantFixture[]=(['A','B'] as const).map(label=>({label,id:randomUUID(),slug:`m2-ui-${runId.slice(0,8)}-${label.toLowerCase()}`,name:`M2 Synthetic UI ${label} ${runId}`,serviceSlug:'tu-van-nha-khoa',serviceId:null,publicationId:null,publishRequestKey:randomUUID()}));
 const identities=labels.map(label=>{const i=prior.identities.find(i=>i.label===label);if(!i)throw new Error('Retained identity missing');return {label,userId:i.userId,email:i.email,password:i.password};});
 const leads:LeadFixture[]=(['normal','nearExpiry','otherTenant'] as const).map(label=>{
  const createdAt=label==='nearExpiry'?new Date(nearExpiry.getTime()-180*86400_000):now;
  return {id:randomUUID(),tenantId:label==='otherTenant'?tenants[1].id:tenants[0].id,label,requestKey:randomUUID(),auditId:randomUUID(),createdAt:createdAt.toISOString(),expiresAt:new Date(createdAt.getTime()+180*86400_000).toISOString()};
 });
 return {owner:OWNER,schemaVersion:1,runId,status:'provisioning',createdAt:now.toISOString(),tenants,identities,leads,retentionTenantIds:[tenants[0].id],mediaTenantIds:tenants.map(t=>t.id)};
}
async function withOwner<T>(client:SQL,action:(tx:SQL)=>Promise<T>) {return client.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');return action(tx as unknown as SQL);});}
async function checkTenants(client:SQL,value:M2UiFixtures,insert:boolean) {
 await withOwner(client,async tx=>{
  for(const t of value.tenants) {
   await tx`SELECT pg_advisory_xact_lock(hashtextextended(${t.id},7202))`;
   if(insert) await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${t.id},${t.name}) ON CONFLICT(id) DO NOTHING`;
   const found=await tx`SELECT name FROM gcms_s02.tenant WHERE id=${t.id}`;if(found[0]?.name!==t.name) throw new Error('Owned tenant proof absent');
   if(!insert) continue;
   for(const [index,label] of (t.label==='A'?['A1','A2']:['B1']).entries()) {
    const i=value.identities.find(i=>i.label===label)!;
    const current=await tx`SELECT id FROM gcms_s02_auth."user" WHERE id=${i.userId} AND email=${i.email} AND active AND email_verified`;if(!current.length)throw new Error('Current retained actor unavailable');
    await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id,created_at) VALUES(${t.id},${i.userId},${value.createdAt}::timestamptz+${index}*interval '1 millisecond') ON CONFLICT(tenant_id,user_id) DO NOTHING`;
    const member=await tx`SELECT status FROM gcms_s02.membership WHERE tenant_id=${t.id} AND user_id=${i.userId}`;if(member[0]?.status!=='active')throw new Error('Membership changed; fixture resume refused');
   }
  }
 });
}
async function seedLeads(client:SQL,value:M2UiFixtures) {
 await withOwner(client,async tx=>{
  for(const [index,l] of value.leads.entries()) {
   const t=value.tenants.find(t=>t.id===l.tenantId)!;if(!t.serviceId||!t.publicationId)throw new Error('Published source absent');
   await tx`SELECT pg_advisory_xact_lock(hashtextextended(${t.id},7202))`;
   const removed=await tx`SELECT 1 FROM gcms_s06.deletion_decision WHERE tenant_id=${t.id} AND lead_id=${l.id}`;if(removed.length)continue;
   const existing=await tx`SELECT source_service_id,source_publication_id FROM gcms_s04.lead WHERE tenant_id=${t.id} AND id=${l.id}`;
   if(existing.length) {if(existing[0].source_service_id!==t.serviceId||existing[0].source_publication_id!==t.publicationId)throw new Error('Owned lead source changed');continue;}
   const name=l.label==='nearExpiry'?'Khách minh họa gần hết hạn':`Khách minh họa M2 ${index+1}`,phone=`090000010${index+1}`;
   await tx`INSERT INTO gcms_s04.lead(tenant_id,id,name,phone,message,preferred_language,preferred_channel,source_service_id,source_publication_id,
    source_tenant_slug,source_service_slug,source_service_title,source_path,consent_at,consent_version,consent_copy,created_at,last_activity_at,expires_at)
    VALUES(${t.id},${l.id},${name},${phone},'Yêu cầu minh họa tổng hợp, không có dữ liệu khách hàng thật.','vi','phone',${t.serviceId},${t.publicationId},${t.slug},${t.serviceSlug},
    'Tư vấn nha khoa',${`/${t.slug}/dich-vu/${t.serviceSlug}`},${l.createdAt}::timestamptz,'consultation-vi-v1','Tôi đồng ý để phòng khám sử dụng thông tin đã cung cấp để liên hệ tư vấn theo yêu cầu này.',${l.createdAt}::timestamptz,${l.createdAt}::timestamptz,${l.expiresAt}::timestamptz)`;
   await tx`INSERT INTO gcms_s04.notification_intent(tenant_id,lead_id,created_at) VALUES(${t.id},${l.id},${l.createdAt}::timestamptz)`;
   const fingerprint=createHash('sha256').update(`M2-UI-synthetic:${value.runId}:${l.id}`).digest('hex');
   await tx`INSERT INTO gcms_s04.accepted_request(tenant_id,request_key,fingerprint,lead_id,service_id,publication_id,accepted_at,expires_at)
    VALUES(${t.id},${l.requestKey},${fingerprint},${l.id},${t.serviceId},${t.publicationId},${l.createdAt}::timestamptz,${l.createdAt}::timestamptz+interval '24 hours')`;
   await tx`INSERT INTO gcms_s04.audit_event(id,tenant_id,event,target_id,created_at) VALUES(${l.auditId},${t.id},'consultation.accepted',${l.id},${l.createdAt}::timestamptz)`;
  }
  const a=value.tenants[0];
  await tx`INSERT INTO gcms_s06.worker_scope(tenant_id,enabled) VALUES(${a.id},true) ON CONFLICT(tenant_id) DO NOTHING`;
  await tx`INSERT INTO gcms_s06.audit_retention_scope(tenant_id,enabled) VALUES(${a.id},true) ON CONFLICT(tenant_id) DO NOTHING`;
  for(const l of value.leads.filter(l=>l.tenantId===a.id)) await tx`INSERT INTO gcms_s06.lead_scope(tenant_id,lead_id) VALUES(${a.id},${l.id}) ON CONFLICT DO NOTHING`;
  for(const t of value.tenants)await tx`INSERT INTO gcms_s07.worker_scope(tenant_id,enabled) VALUES(${t.id},true) ON CONFLICT(tenant_id) DO NOTHING`;
 });
}
let stage='preflight';
export async function fixturesM2Ui() {
 if(process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m2')||!process.argv.includes('--synthetic-fixtures')||Bun.version!=='1.4.3')throw new Error('Explicit pinned local M2 fixture scope required');
 const directory=await lstat('.local');if(!directory.isDirectory()||directory.isSymbolicLink()||(directory.mode&0o777)!==0o700||directory.uid!==process.getuid?.()||await realpath('.local')!==resolve('.local'))throw new Error('Unsafe private local directory');
 const lock=await open(LOCK,'wx',0o600);
 try {
  stage='manifest';const prior=await privateJson('.local/s02-fixtures.json') as S02Fixtures;
  const value=await exists(MANIFEST)?await privateJson(MANIFEST) as M2UiFixtures:planned(prior);validate(value,prior);
  if(!await exists(MANIFEST))await save(value,true);
  const client=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
  try {
   stage='tenants';await checkTenants(client,value,value.status!=='complete');
   if(value.status!=='complete') {
    const runtime=await loadRuntimeEnvironment(),db=createS02Database(runtime.api),identity=createS02Auth(db,runtime.api),publication=new PublicationServiceOperations(db,identity);
    try {
     for(const t of value.tenants) {
      stage=`publication_${t.label}`;const signed=await openPasswordSession(identity,value.identities.find(i=>i.label===(t.label==='A'?'A1':'B1'))!);
      const request:PrivateRequest={method:'PUT',originalUrl:'',headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891','content-type':'application/json',cookie:signed.headers.get('cookie')??'','x-csrf-token':identity.csrfToken(signed.actor)}};
      let site=await publication.getSite({...request,method:'GET'},t.id);
      if(site.version===0)site=await publication.saveSite(request,t.id,{slug:t.slug,name:`Phòng khám minh họa ${t.label}`,footer:{intro:'Dữ liệu tổng hợp để kiểm thử local.',body:legacyDocument('Thông tin liên hệ minh họa.')},expectedVersion:0});
      if(site.slug!==t.slug)throw new Error('Owned site route changed');
      if(!t.serviceId) {
       const found=await withOwner(client,tx=>tx`SELECT id FROM gcms_s02.service_draft WHERE tenant_id=${t.id} AND slug=${t.serviceSlug}`);if(found.length>1)throw new Error('Ambiguous fixture service');
       const draft=found[0]?await publication.read({...request,method:'GET'},t.id,String(found[0].id)):await publication.create({...request,method:'POST'},t.id,{slug:t.serviceSlug,title:'Tư vấn nha khoa',summary:'Dịch vụ minh họa tổng hợp.',body:legacyDocument('Nội dung công khai minh họa, phiên bản một.'),seo:{title:'Tư vấn nha khoa',description:'Dịch vụ minh họa tổng hợp.'}});
       t.serviceId=draft.id;await save(value);
      }
      if(!t.publicationId) {
       const draft=await publication.read({...request,method:'GET'},t.id,t.serviceId);
       if(!t.publishInput) {t.publishInput={requestKey:t.publishRequestKey,expectedDraftVersion:draft.draftVersion,expectedSiteVersion:site.version,expectedPublicationVersion:draft.publicationVersion,expectedPublicationRevision:draft.publicationRevision};await save(value);}
       const result=await publication.publish({...request,method:'POST'},t.id,t.serviceId,t.publishInput);if(!result.activePublication)throw new Error('Current publication was withdrawn; fixture resume refused');
       t.publicationId=result.publicationId;await save(value);
      }
      if(!t.pendingVersion) {
       const draft=await publication.read({...request,method:'GET'},t.id,t.serviceId);
       if(draft.publishedDraftVersion===draft.draftVersion) {
        const pending=await publication.save(request,t.id,t.serviceId,{slug:t.serviceSlug,title:'Tư vấn nha khoa — bản nháp',summary:'Bản nháp minh họa chưa xuất bản.',body:legacyDocument('Phiên bản hai đang biên tập; nội dung công khai vẫn là phiên bản một.'),seo:{title:'Tư vấn nha khoa',description:'Dịch vụ minh họa tổng hợp.'},expectedDraftVersion:draft.draftVersion});t.pendingVersion=pending.draftVersion;
       } else t.pendingVersion=draft.draftVersion;
       await save(value);
      }
     }
    } finally {await db.close();}
    stage='leads_and_positive_scopes';await seedLeads(client,value);value.status='complete';await save(value);
   }
   const counts=await withOwner(client,tx=>tx`SELECT tenant_id,count(*)::integer AS count FROM gcms_s04.lead WHERE tenant_id IN (${value.tenants[0].id},${value.tenants[1].id}) GROUP BY tenant_id ORDER BY tenant_id`);
   stage='complete';console.info(JSON.stringify({status:'PASS',manifest:MANIFEST,fixtureStatus:value.status,runId:value.runId,tenants:value.tenants.map(t=>({label:t.label,id:t.id,slug:t.slug,serviceId:t.serviceId,publicationId:t.publicationId,pendingVersion:t.pendingVersion})),leads:value.leads.map(l=>({id:l.id,tenantId:l.tenantId,label:l.label,expiresAt:l.expiresAt})),currentLeadCounts:counts,retentionTenantIds:value.retentionTenantIds,mediaTenantIds:value.mediaTenantIds,dispatchStarted:false}));
   return value;
  } finally {await client.close();}
 } finally {await lock.close();await unlink(LOCK);}
}
if(import.meta.main)void fixturesM2Ui().catch(()=>{console.error(JSON.stringify({status:'FAIL',stage,detailsRedacted:true,scope:'new owned M2 UI fixtures only'}));process.exitCode=1;});
