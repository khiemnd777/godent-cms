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

const MANIFEST='.local/m3-fixtures.json',OWNER='GCMS-M3-v1';
export interface M3Identity {label:'A1'|'A2'|'B1'|'PlatformOnly';userId:string;email:string;password:string}
export interface M3Tenant {label:'A'|'B';id:string;slug:string;name:string;serviceId:string|null;serviceSlug:string;publicationId:string|null;publishKey:string}
export interface M3Fixtures {owner:typeof OWNER;runId:string;status:'provisioning'|'complete';createdAt:string;identities:M3Identity[];tenants:M3Tenant[]}
export async function readM3Fixtures():Promise<M3Fixtures> {
 const meta=await lstat(MANIFEST);if(!meta.isFile()||meta.isSymbolicLink()||(meta.mode&0o777)!==0o600||meta.uid!==process.getuid?.())throw new Error('Unsafe M3 manifest');
 const value=JSON.parse(await readFile(MANIFEST,'utf8')) as M3Fixtures;
 if(value.owner!==OWNER||!/^[-a-f0-9]{36}$/.test(value.runId)||value.tenants.length!==2||value.identities.length!==4||!['provisioning','complete'].includes(value.status))throw new Error('Unexpected M3 ownership');
 for(const t of value.tenants)if(t.slug!==`m3-${value.runId.slice(0,8)}-${t.label.toLowerCase()}`||t.name!==`M3 Synthetic ${t.label} ${value.runId}`)throw new Error('Wrong tenant scope');
 for(const i of value.identities)if(i.email!==`m3-${value.runId}-${i.label.toLowerCase()}@synthetic.example.test`)throw new Error('Wrong new actor scope');
 return value;
}
async function save(value:M3Fixtures) {
 const previous=await readM3Fixtures();if(previous.runId!==value.runId)throw new Error('Manifest ownership changed');
 const temp=`.local/m3-manifest-${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temp,MANIFEST);
}
async function main() {
 if(process.cwd()!==resolve(import.meta.dir,'..')||Bun.version!=='1.4.3'||!process.argv.includes('--local-m3')||!process.argv.includes('--synthetic-fixtures'))throw new Error('Explicit pinned local synthetic M3 required');
 const local=await lstat('.local');if(!local.isDirectory()||local.isSymbolicLink()||(local.mode&0o777)!==0o700)throw new Error('Unsafe private directory');
 if(!await Bun.file(MANIFEST).exists()) {
  const runId=randomUUID();const value:M3Fixtures={owner:OWNER,runId,status:'provisioning',createdAt:new Date().toISOString(),identities:(['A1','A2','B1','PlatformOnly'] as const).map(label=>({label,userId:randomUUID(),email:`m3-${runId}-${label.toLowerCase()}@synthetic.example.test`,password:randomBytes(24).toString('base64url')})),tenants:(['A','B'] as const).map(label=>({label,id:randomUUID(),slug:`m3-${runId.slice(0,8)}-${label.toLowerCase()}`,name:`M3 Synthetic ${label} ${runId}`,serviceId:null,serviceSlug:'cham-soc-rang',publicationId:null,publishKey:randomUUID()}))};
  await writeFile(MANIFEST,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
 }
 const fixtures=await readM3Fixtures();
 if(process.argv.includes('--enroll-content-worker')){
  if(fixtures.status!=='complete')throw new Error('Complete owned fixtures required before worker enrollment');
  const workerOwner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
  try{await workerOwner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');for(const t of fixtures.tenants){const actual=await tx`SELECT name,status FROM gcms_s02.tenant WHERE id=${t.id}`;if(actual[0]?.name!==t.name||actual[0]?.status!=='active')throw new Error('Wrong worker tenant');await tx`INSERT INTO gcms_m3.worker_scope(tenant_id,enabled) VALUES(${t.id},true) ON CONFLICT DO NOTHING`;}});}finally{await workerOwner.close();}
  console.info(JSON.stringify({status:'PASS',phase:'explicit_owned_content_worker_enrollment',tenants:fixtures.tenants.length,dispatchStarted:false}));return;
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
    const user=await context.internalAdapter.createUser({id:item.userId,name:`M3 Synthetic ${item.label}`,email:item.email,emailVerified:true,platformAdmin:item.label==='PlatformOnly'},{method:'email-password'});
    if(user.id!==item.userId)throw new Error('New identity mismatch');
    await context.internalAdapter.createAccount({userId:user.id,accountId:user.id,providerId:'credential',password});
   }
  }
  await owner.begin(async tx=>{
   await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
   for(const t of fixtures.tenants){
    await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${t.id},${t.name}) ON CONFLICT DO NOTHING`;
    const actual=await tx`SELECT name,status FROM gcms_s02.tenant WHERE id=${t.id}`;if(actual[0]?.name!==t.name||actual[0]?.status!=='active')throw new Error('Owned tenant mismatch');
    for(const label of t.label==='A'?['A1','A2']:['B1']){const i=fixtures.identities.find(a=>a.label===label)!;await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${t.id},${i.userId}) ON CONFLICT DO NOTHING`;}
    await tx`INSERT INTO gcms_s07.worker_scope(tenant_id,enabled) VALUES(${t.id},true) ON CONFLICT DO NOTHING`;
   }
  });
  const publishing=new PublicationServiceOperations(db,auth);
  for(const t of fixtures.tenants){
   const i=fixtures.identities.find(a=>a.label===(t.label==='A'?'A1':'B1'))!,signed=await openPasswordSession(auth,i);
   const request:PrivateRequest={method:'POST',originalUrl:`/api/tenants/${t.id}/publication`,headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891','content-type':'application/json',cookie:signed.headers.get('cookie')??'','x-csrf-token':auth.csrfToken(signed.actor)}};
   let site=await publishing.getSite({...request,method:'GET'},t.id);
   if(!site.version)site=await publishing.saveSite({...request,method:'PUT'},t.id,{slug:t.slug,name:t.name,footer:{intro:'Thông tin minh họa tổng hợp M3',body:legacyDocument('Dữ liệu thử local; không có dữ liệu khách hàng thật.')},expectedVersion:0});
   if(site.slug!==t.slug)throw new Error('Owned site changed');
   if(!t.serviceId){const draft=await publishing.create(request,t.id,{slug:t.serviceSlug,title:'Chăm sóc răng minh họa M3',summary:'Dịch vụ tổng hợp phục vụ kiểm chứng nội dung.',body:legacyDocument('Thông tin thử nghiệm local.'),seo:{title:'',description:''}});t.serviceId=draft.id;await save(fixtures);}
   if(!t.publicationId){const draft=await publishing.read({...request,method:'GET'},t.id,t.serviceId);const result=await publishing.publish(request,t.id,t.serviceId,{expectedDraftVersion:draft.draftVersion,expectedPublicationVersion:draft.publicationVersion,expectedPublicationRevision:draft.publicationRevision,expectedSiteVersion:site.version,requestKey:t.publishKey});t.publicationId=result.publicationId;await save(fixtures);}
  }
  fixtures.status='complete';await save(fixtures);
  console.info(JSON.stringify({status:'PASS',newOwnedTenants:2,newOwnedIdentities:4,retainedCredentialsChanged:false,manifest:MANIFEST}));
 }finally{await db.close();await owner.close();}
}
if(import.meta.main)void main().catch(error=>{console.error(JSON.stringify({status:'FAIL',phase:'m3-fixtures',code:error&&typeof error==='object'&&'code'in error?String(error.code):'UNKNOWN',detailsRedacted:true}));process.exitCode=1;});
