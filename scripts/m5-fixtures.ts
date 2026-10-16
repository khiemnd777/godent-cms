import { SQL } from 'bun';
import { randomBytes,randomUUID } from 'node:crypto';
import { lstat,readFile,writeFile,rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';
import { PublicationServiceOperations } from '../apps/api/src/modules/publication.service';
import { legacyDocument } from '../apps/api/src/contracts/content';
import type { PrivateRequest } from '../apps/api/src/modules/request-security';
import { openPasswordSession } from './s02-fixtures';

const MANIFEST='.local/m5-fixtures.json',OWNER='GCMS-M5-v1';
export interface M5Identity {label:'A1'|'A2'|'B1'|'PlatformOnly'|'Multi';userId:string;email:string;password:string}
export interface M5Tenant {label:'A'|'B'|'Deletion';id:string;slug:string;name:string;serviceId:string|null;serviceSlug:string;publicationId:string|null;publishKey:string}
export interface M5Fixtures {owner:typeof OWNER;runId:string;status:'provisioning'|'complete';createdAt:string;identities:M5Identity[];tenants:M5Tenant[]}
export async function readM5Fixtures():Promise<M5Fixtures> {
 const meta=await lstat(MANIFEST);if(!meta.isFile()||meta.isSymbolicLink()||(meta.mode&0o777)!==0o600||meta.uid!==process.getuid?.())throw new Error('Unsafe M5 manifest');
 const value=JSON.parse(await readFile(MANIFEST,'utf8')) as M5Fixtures;
 if(value.owner!==OWNER||!/^[-a-f0-9]{36}$/.test(value.runId)||value.tenants.length!==3||value.identities.length!==5||!['provisioning','complete'].includes(value.status))throw new Error('Unexpected M5 ownership');
 for(const t of value.tenants)if(t.slug!==`m5-${value.runId.slice(0,8)}-${t.label.toLowerCase()}`||t.name!==`M5 Synthetic ${t.label} ${value.runId}`)throw new Error('Wrong tenant scope');
 for(const i of value.identities)if(i.email!==`m5-${value.runId}-${i.label.toLowerCase()}@synthetic.example.test`)throw new Error('Wrong new actor scope');
 return value;
}
async function save(value:M5Fixtures) {
 const previous=await readM5Fixtures();if(previous.runId!==value.runId)throw new Error('Manifest ownership changed');
 const temp=`.local/m5-manifest-${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temp,MANIFEST);
}
async function main() {
 if(process.cwd()!==resolve(import.meta.dir,'..')||Bun.version!=='1.4.3'||!process.argv.includes('--local-m5')||!process.argv.includes('--synthetic-fixtures'))throw new Error('Explicit pinned local synthetic M5 required');
 const local=await lstat('.local');if(!local.isDirectory()||local.isSymbolicLink()||(local.mode&0o777)!==0o700)throw new Error('Unsafe private directory');
 if(!await Bun.file(MANIFEST).exists()) {
  const runId=randomUUID();const value:M5Fixtures={owner:OWNER,runId,status:'provisioning',createdAt:new Date().toISOString(),identities:(['A1','A2','B1','PlatformOnly','Multi'] as const).map(label=>({label,userId:randomUUID(),email:`m5-${runId}-${label.toLowerCase()}@synthetic.example.test`,password:randomBytes(24).toString('base64url')})),tenants:(['A','B','Deletion'] as const).map(label=>({label,id:randomUUID(),slug:`m5-${runId.slice(0,8)}-${label.toLowerCase()}`,name:`M5 Synthetic ${label} ${runId}`,serviceId:null,serviceSlug:'cham-soc-rang',publicationId:null,publishKey:randomUUID()}))};
  await writeFile(MANIFEST,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
 }
 const fixtures=await readM5Fixtures();
 if(process.argv.includes('--enroll-deletion-worker')){
  if(fixtures.status!=='complete')throw new Error('Complete owned fixtures required before worker enrollment');
  const workerOwner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
  try{await workerOwner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');const t=fixtures.tenants.find(t=>t.label==='Deletion');if(!t)throw new Error('Missing owned deletion tenant');const actual=await tx`SELECT name,status FROM gcms_s02.tenant WHERE id=${t.id}`;if(actual[0]?.name!==t.name||actual[0]?.status!=='active')throw new Error('Wrong worker tenant');await tx`INSERT INTO gcms_m5.worker_scope(tenant_id,allow_deletion) VALUES(${t.id},true) ON CONFLICT DO NOTHING`;});}finally{await workerOwner.close();}
  console.info(JSON.stringify({status:'PASS',phase:'explicit_owned_deletion_worker_enrollment',tenants:1,dispatchStarted:false}));return;
 }
 if(fixtures.status==='complete'){console.info(JSON.stringify({status:'PASS',phase:'existing_complete_manifest',reset:false}));return;}
 const runtime=await loadRuntimeEnvironment(),db=createS02Database(runtime.api),auth=createS02Auth(db,runtime.api);
 const owner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
 try {
  const context=await auth.auth.$context;
  for(const item of fixtures.identities) {
   const existing=await context.internalAdapter.findUserByEmail(item.email,{includeAccounts:true});
   if(existing){if(existing.user.id!==item.userId||!existing.accounts.some(a=>a.providerId==='credential'))throw new Error('Existing owned actor mismatch');}
   else {
    const password=await context.password.hash(item.password);
    const user=await context.internalAdapter.createUser({id:item.userId,name:`M5 Synthetic ${item.label}`,email:item.email,emailVerified:true,platformAdmin:item.label==='PlatformOnly'},{method:'email-password'});
    if(user.id!==item.userId)throw new Error('New identity mismatch');
    await context.internalAdapter.createAccount({userId:user.id,accountId:user.id,providerId:'credential',password});
   }
  }
  const platform=fixtures.identities.find(i=>i.label==='PlatformOnly')!;
  const platformSession=await openPasswordSession(auth,platform);
  await owner.begin(async tx=>{
   await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
   await tx`SELECT set_config('gcms.actor_id',${platformSession.actor.userId},true),set_config('gcms.session_id',${platformSession.actor.sessionId},true)`;
   for(const t of fixtures.tenants){
    const inserted=await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${t.id},${t.name}) ON CONFLICT DO NOTHING RETURNING id`;
    const actual=await tx`SELECT name,status FROM gcms_s02.tenant WHERE id=${t.id}`;if(actual[0]?.name!==t.name||actual[0]?.status!=='active')throw new Error('Owned tenant mismatch');
    // A deliberate synthetic monitor choice, never a commercial quota default.
    if(inserted.length)await tx`SELECT gcms_m5.initialize_new_tenant(${t.id},${JSON.stringify({mode:'monitor',contentItemsLimit:null,mediaBytesLimit:null})}::text::jsonb)`;
    const policy=await tx`SELECT mode FROM gcms_m5.tenant_state WHERE tenant_id=${t.id}`;if(policy[0]?.mode!=='monitor')throw new Error('Owned fixture policy mismatch');
    for(const label of t.label==='A'?['A1','A2','Multi']:t.label==='B'?['B1','Multi']:['A1','A2']){const i=fixtures.identities.find(a=>a.label===label)!;await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${t.id},${i.userId}) ON CONFLICT DO NOTHING`;}
    await tx`INSERT INTO gcms_s07.worker_scope(tenant_id,enabled) VALUES(${t.id},true) ON CONFLICT DO NOTHING`;
   }
  });
  const publishing=new PublicationServiceOperations(db,auth);
  for(const [index,t]of fixtures.tenants.entries()){
   if(index===1)await Bun.sleep(11000);
   const i=fixtures.identities.find(a=>a.label===(t.label==='B'?'B1':'A1'))!,signed=await openPasswordSession(auth,i);
   const request:PrivateRequest={method:'POST',originalUrl:`/api/tenants/${t.id}/publication`,headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891','content-type':'application/json',cookie:signed.headers.get('cookie')??'','x-csrf-token':auth.csrfToken(signed.actor)}};
   let site=await publishing.getSite({...request,method:'GET'},t.id);
   if(!site.version)site=await publishing.saveSite({...request,method:'PUT'},t.id,{slug:t.slug,name:t.name,footer:{intro:'Thông tin minh họa tổng hợp M5',body:legacyDocument('Dữ liệu thử local; không có dữ liệu khách hàng thật.')},expectedVersion:0});
   if(site.slug!==t.slug)throw new Error('Owned site changed');
   if(!t.serviceId){const draft=await publishing.create(request,t.id,{slug:t.serviceSlug,title:'Chăm sóc răng minh họa M5',summary:'Dịch vụ tổng hợp phục vụ kiểm chứng nội dung.',body:legacyDocument('Thông tin thử nghiệm local.'),seo:{title:'',description:''}});t.serviceId=draft.id;await save(fixtures);}
   if(!t.publicationId){const draft=await publishing.read({...request,method:'GET'},t.id,t.serviceId);const result=await publishing.publish(request,t.id,t.serviceId,{expectedDraftVersion:draft.draftVersion,expectedPublicationVersion:draft.publicationVersion,expectedPublicationRevision:draft.publicationRevision,expectedSiteVersion:site.version,requestKey:t.publishKey});t.publicationId=result.publicationId;await save(fixtures);}
  }
  fixtures.status='complete';await save(fixtures);
  console.info(JSON.stringify({status:'PASS',newOwnedTenants:3,newOwnedIdentities:5,retainedCredentialsChanged:false,manifest:MANIFEST}));
 }finally{await db.close();await owner.close();}
}
if(import.meta.main)void main().catch(async error=>{const e=error as {code?:string;message?:string;detail?:string};await writeFile(`.local/m5-fixture-error-${Date.now()}.json`,JSON.stringify({code:e.code,message:e.message,detail:e.detail})+'\n',{mode:0o600,flag:'wx'});console.error(JSON.stringify({status:'FAIL',phase:'m5-fixtures',code:e.code??'UNKNOWN',detailsRedacted:true}));process.exitCode=1;});
