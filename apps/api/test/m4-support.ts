import {SQL} from 'bun';
import {expect} from 'bun:test';
import {createHmac,randomUUID} from 'node:crypto';
import {writeFile,rename} from 'node:fs/promises';
import type {INestApplication} from '@nestjs/common';
import {createS02Database,type S02Database} from '../src/database';
import {createS02Auth} from '../src/auth';
import {loadRuntimeEnvironment} from '../src/auth/runtime-environment';
import {validateDatabaseUrl} from '../src/auth/policy';
import {legacyDocument} from '../src/contracts/content';
import {M4_ROUTES,type M4Kind,type M4Locale,type M4Variant,type M4CommandResult,type M4Content} from '../src/contracts/m4';
import {normalizeM4Intake} from '../src/contracts/m4-validation';
import {openPasswordSession} from '../../../scripts/s02-fixtures';
import {readM4Fixtures,type M4Fixtures} from '../../../scripts/m4-fixtures';
export class M4Harness {
 readonly run=randomUUID();readonly tenantId=randomUUID();readonly tenantSlug=`m4-test-${this.run.slice(0,12)}`;
 readonly manifest=`.local/m4-api-owned-${this.run}.json`;db!:S02Database;identity!:ReturnType<typeof createS02Auth>;owner!:SQL;fixtures!:M4Fixtures;app!:INestApplication;base='';legacyId='';
 clients=new Map<string,Awaited<ReturnType<typeof openPasswordSession>>>();private entries:Record<string,unknown>[]=[];
 async setup(){if(process.env.M4_INTEGRATION!=='1')throw new Error('Explicit M4 integration opt-in required');const runtime=await loadRuntimeEnvironment();Object.assign(process.env,runtime.api);this.fixtures=await readM4Fixtures();if(this.fixtures.status!=='complete')throw new Error('Complete owned fixtures required');
  await writeFile(this.manifest,JSON.stringify({owner:'GCMS-M4-API-tests',run:this.run,fixtureRun:this.fixtures.runId,entries:[]})+'\n',{flag:'wx',mode:0o600});this.db=createS02Database();this.identity=createS02Auth(this.db);this.owner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:2,connectionTimeout:3});
  await this.record({kind:'tenant',id:this.tenantId,slug:this.tenantSlug});await this.owned(async tx=>{await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${this.tenantId},${'M4 API synthetic '+this.run})`;for(const label of ['A1','A2']){const user=this.fixtures.identities.find(i=>i.label===label)!;await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${this.tenantId},${user.userId})`;}});
  const compiled=await import('../dist/app.js' as string) as {createApp():Promise<INestApplication>};this.app=await compiled.createApp();await this.app.listen(0,'127.0.0.1');this.base=await this.app.getUrl();
  for(const [index,label]of ['A1','A2','B1','PlatformOnly'].entries()){if(index===2)await Bun.sleep(11000);const f=this.fixtures.identities.find(i=>i.label===label)!;this.clients.set(label,await openPasswordSession(this.identity,f));}
  const site=await this.call(`/api/tenants/${this.tenantId}/publication/site`,'PUT',{slug:this.tenantSlug,name:'M4 API synthetic',footer:{intro:'Synthetic',body:legacyDocument('Synthetic footer')},expectedVersion:0});expect(site.status).toBe(200);
  const legacy=await this.call<{id:string}>(`/api/tenants/${this.tenantId}/publication/services`,'POST',{slug:'synthetic-service',title:'Legacy VI',summary:'Retained synthetic VI',body:legacyDocument('Legacy body'),seo:{title:'',description:''}});expect(legacy.status).toBe(201);this.legacyId=legacy.value.id;await this.record({kind:'legacy-service',id:this.legacyId});
  const pub=await this.call(`/api/tenants/${this.tenantId}/publication/services/${this.legacyId}/publish`,'POST',{requestKey:randomUUID(),expectedDraftVersion:1,expectedPublicationVersion:0,expectedPublicationRevision:0,expectedSiteVersion:1});expect(pub.status).toBe(200);
 }
 async record(entry:Record<string,unknown>){this.entries.push(entry);const temp=this.manifest+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify({owner:'GCMS-M4-API-tests',run:this.run,fixtureRun:this.fixtures?.runId,entries:this.entries},null,2)+'\n',{flag:'wx',mode:0o600});await rename(temp,this.manifest);}
 async owned<T>(fn:(tx:SQL)=>Promise<T>){return this.owner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');return fn(tx as unknown as SQL);});}
 async call<T=Record<string,unknown>>(path:string,method='GET',body?:unknown,label='A1'){const c=this.clients.get(label)!;const response=await fetch(this.base+path,{method,headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie:c.headers.get('cookie')??'',...(method==='GET'?{}:{'content-type':'application/json','x-csrf-token':this.identity.csrfToken(c.actor)})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});return {status:response.status,value:await response.json() as T};}
 async public<T=Record<string,unknown>>(path:string,method='GET',body?:unknown){const response=await fetch(this.base+path,{method,headers:{host:'127.0.0.1:5890',...(method==='GET'?{}:{origin:'http://localhost:5892','content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});return {status:response.status,value:await response.json() as T};}
 async diagnoseIntake(page:M4Variant,input:unknown,response:{status:number;value:unknown}){
  if(response.status===200)return;const {requestKey,challenge,...payload}=normalizeM4Intake(input),digest=(purpose:string,value:string)=>createHmac('sha256',process.env.S04_HMAC_SECRET!).update(purpose+':'+value).digest('hex');const metadata:Record<string,unknown>={};
  try{await this.db.intakeSql!.begin(async tx=>{const diagnostic=await tx`SELECT gcms_m4.intake(${JSON.stringify({operation:'accept',tenantSlug:this.tenantSlug,sourceType:page.kind,sourceSlug:(page.content as {slug:string}).slug,locale:page.locale,requestKey,ipHash:digest('ip-v1','127.0.0.1'),payload,...(challenge?{tokenHash:digest('token-v1',challenge.token),answerHash:digest('answer-v1',challenge.token+':'+challenge.answer)}:{})})}::text::jsonb) AS result`;metadata.sqlResultCode=diagnostic[0]?.result?.code??null;throw new Error('M4_DIAGNOSTIC_ROLLBACK');});}catch(error){let item:unknown=error;for(let depth=0;depth<4&&item&&typeof item==='object';depth++){const e=item as Record<string,unknown>;for(const key of ['code','errno','sqlState','constraint','constraint_name','constraintName'])if(typeof e[key]==='string'&&/^[A-Za-z0-9_]+$/.test(e[key]))metadata[key]=e[key];item=e.cause;}}
  const value=response.value as {code?:unknown};console.info(JSON.stringify({diagnostic:'m4-intake-rollback',status:response.status,responseCode:typeof value?.code==='string'?value.code:null,...metadata}));
 }
 path(d:M4Variant){return d.kind==='config'?M4_ROUTES.config(this.tenantId,d.locale):M4_ROUTES.resource(this.tenantId,d.kind,d.id,d.locale);}
 content(kind:'home'|'page'|'landing',title='Synthetic page'):M4Content{return {kind,slug:kind==='home'?'home':`synthetic-${randomUUID().slice(0,8)}`,title,summary:'Synthetic summary',seo:{title:'',description:''},sections:[{id:'hero',type:'hero',hidden:false,title:'Synthetic hero',text:'Synthetic content',image:null,action:null},{id:'body',type:'rich_text',hidden:false,body:legacyDocument('Synthetic body')}]};}
 async create(kind:M4Kind,content:M4Content,locale:M4Locale='vi'){const operationId=randomUUID();await this.record({kind,id:operationId,locale});const result=await this.call<M4CommandResult>(M4_ROUTES.resources(this.tenantId,kind)+'?locale='+locale,'POST',{operationId,content});expect(result.status).toBe(201);return result.value.draft;}
 async config(locale:M4Locale='vi'){const current=await this.call<M4Variant>(M4_ROUTES.config(this.tenantId,locale));expect(current.status).toBe(200);const result=await this.call<M4CommandResult>(M4_ROUTES.config(this.tenantId,locale),'PUT',{operationId:randomUUID(),expectedVersion:current.value.version,content:{...current.value.content,name:locale==='en'?'Synthetic EN':'Synthetic VI'}});expect(result.status).toBe(200);return this.publish(result.value.draft);}
 async read(d:M4Variant){const result=await this.call<M4Variant>(this.path(d));expect(result.status).toBe(200);return result.value;}
 async save(d:M4Variant,content:M4Content){const result=await this.call<M4CommandResult>(this.path(d),'PUT',{operationId:randomUUID(),expectedVersion:d.version,content,...(d.legacySource?.current?{expectedLegacyState:d.legacySource.current}:{})});expect(result.status).toBe(200);return result.value.draft;}
 async publish(d:M4Variant){const config=await this.call<M4Variant>(M4_ROUTES.config(this.tenantId,d.locale));const result=await this.call<M4CommandResult>(this.path(d)+'/publish','POST',{operationId:randomUUID(),expectedVersion:d.version,expectedPublicationVersion:d.publicationVersion,expectedPublicationRevision:d.publicationRevision,expectedConfigPublicationId:d.kind==='config'?null:config.value.publicationId});expect(result.status).toBe(200);return result.value.draft;}
 async close(){await this.app?.close();await this.db?.close();await this.owner?.close();}
}
