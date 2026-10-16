import {SQL} from 'bun';
import {expect} from 'bun:test';
import {randomUUID} from 'node:crypto';
import {writeFile,rename} from 'node:fs/promises';
import type {INestApplication} from '@nestjs/common';
import {createS02Database,type S02Database} from '../src/database';
import {createS02Auth} from '../src/auth';
import {loadRuntimeEnvironment} from '../src/auth/runtime-environment';
import {validateDatabaseUrl} from '../src/auth/policy';
import {legacyDocument} from '../src/contracts/content';
import {M3_ROUTES,type ContentDraft,type ContentCommandResult,type ContentKind,type ContentReference,type DentalContent} from '../src/contracts/m3';
import {openPasswordSession} from '../../../scripts/s02-fixtures';
import {readM3Fixtures,type M3Fixtures} from '../../../scripts/m3-fixtures';
export class M3Harness {
 readonly run=randomUUID();db!:S02Database;identity!:ReturnType<typeof createS02Auth>;owner!:SQL;fixtures!:M3Fixtures;app!:INestApplication;base='';
 readonly manifest=`.local/m3-api-owned-${this.run}.json`;private ownedEntries:Record<string,unknown>[]=[];
 clients=new Map<string,Awaited<ReturnType<typeof openPasswordSession>>>();
 async setup(){if(process.env.M3_INTEGRATION!=='1')throw new Error('Explicit M3 integration opt-in required');const runtime=await loadRuntimeEnvironment();Object.assign(process.env,runtime.api);this.fixtures=await readM3Fixtures();if(this.fixtures.status!=='complete')throw new Error('Complete owned M3 fixtures required');await writeFile(this.manifest,JSON.stringify({owner:'GCMS-M3-API-tests',run:this.run,fixtureRun:this.fixtures.runId,entries:[]})+'\n',{flag:'wx',mode:0o600});
  this.db=createS02Database();this.identity=createS02Auth(this.db);this.owner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:2,connectionTimeout:3});
  const compiled=await import('../dist/app.js' as string) as {createApp():Promise<INestApplication>};this.app=await compiled.createApp();await this.app.listen(0,'127.0.0.1');this.base=await this.app.getUrl();
  for(const [index,label] of ['A1','A2','B1','PlatformOnly'].entries()){if(index===2)await Bun.sleep(11000);const f=this.fixtures.identities.find(i=>i.label===label)!;this.clients.set(label,await openPasswordSession(this.identity,f));}
 }
 tenant(label='A'){return this.fixtures.tenants.find(t=>t.label===label)!;}
 async recordOwned(entry:Record<string,unknown>){this.ownedEntries.push(entry);const temporary=`${this.manifest}.${randomUUID()}.tmp`;await writeFile(temporary,JSON.stringify({owner:'GCMS-M3-API-tests',run:this.run,fixtureRun:this.fixtures.runId,entries:this.ownedEntries},null,2)+'\n',{flag:'wx',mode:0o600});await rename(temporary,this.manifest);}
 async call<T=Record<string,unknown>>(path:string,method='GET',body?:unknown,label='A1',extra:Record<string,string>={}){const c=this.clients.get(label)!;const response=await fetch(this.base+path,{method,headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie:c.headers.get('cookie')??'',...(method==='GET'?{}:{'content-type':'application/json','x-csrf-token':this.identity.csrfToken(c.actor)}),...extra},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});return {status:response.status,value:await response.json() as T};}
 async public<T=Record<string,unknown>>(path:string,method='GET',body?:unknown){const response=await fetch(this.base+path,{method,headers:{host:'127.0.0.1:5890',...(method==='GET'?{}:{origin:'http://localhost:5892','content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});return {status:response.status,value:await response.json() as T};}
 content(kind:ContentKind,extra:Record<string,unknown>={}):DentalContent{const base={kind,slug:`m3-api-${this.run.slice(0,8)}-${randomUUID().slice(0,8)}`,title:`M3 API synthetic ${kind}`,summary:'Synthetic content only',body:legacyDocument('Synthetic answer and body'),seo:{title:'',description:''},references:[]};const defaults:Partial<Record<ContentKind,Record<string,unknown>>>={location:{address:'Synthetic address',phone:'',email:'',mapUrl:'',openingHours:[{day:1,closed:false,intervals:[{opens:'08:00',closes:'12:00'}]}]},doctor:{professionalTitle:'Provided title',credentials:['Provided credential'],languages:['Tiếng Việt'],image:null},price:{price:{type:'exact',amount:'1000000',currency:'VND',unit:'răng'},inclusions:'',notes:''},case:{image:null},gallery:{pairs:[]},testimonial:{quote:'Synthetic quote',displayName:'Synthetic alias',attribution:'Provided attribution',image:null},article:{attribution:'Provided attribution',image:null}};return {...base,...defaults[kind],...extra} as DentalContent;}
 path(d:ContentDraft){return M3_ROUTES.resource(this.tenant().id,d.kind,d.id);}
 async create(kind:ContentKind,extra:Record<string,unknown>={}){const operationId=randomUUID(),content=this.content(kind,extra);await this.recordOwned({kind,id:operationId,tenantId:this.tenant().id,slug:content.slug});const result=await this.call<ContentCommandResult>(M3_ROUTES.resources(this.tenant().id,kind),'POST',{operationId,content});expect(result.status).toBe(201);expect(result.value.draft.kind).toBe(kind);return result.value.draft;}
 async read(d:ContentDraft){const result=await this.call<ContentDraft>(this.path(d));expect(result.status).toBe(200);return result.value;}
 async save(d:ContentDraft,changes:Partial<DentalContent>){const result=await this.call<ContentCommandResult>(this.path(d),'PUT',{operationId:randomUUID(),expectedVersion:d.version,content:{...d.content,...changes}});expect(result.status).toBe(200);return result.value.draft;}
 async publish(d:ContentDraft){const site=await this.call<{version:number}>(`/api/tenants/${this.tenant().id}/publication/site`);expect(site.status).toBe(200);const result=await this.call<ContentCommandResult>(this.path(d)+'/publish','POST',{operationId:randomUUID(),expectedVersion:d.version,expectedPublicationVersion:d.publicationVersion,expectedPublicationRevision:d.publicationRevision,expectedSiteVersion:site.value.version});expect(result.status).toBe(200);return result.value.draft;}
 async page(d:ContentDraft){return this.public<import('../src/contracts/m3').PublicContentPage>(M3_ROUTES.publicDetail(this.tenant().slug,d.kind,d.content.slug));}
 async ref(d:ContentDraft):Promise<ContentReference>{const page=await this.page(d);expect(page.status).toBe(200);return {kind:d.kind,id:d.id,publicationId:page.value.publicationId};}
 async unpublish(d:ContentDraft){const body={operationId:randomUUID(),expectedVersion:d.version,expectedPublicationRevision:d.publicationRevision};const result=await this.call<ContentCommandResult>(this.path(d)+'/unpublish','POST',body);expect(result.status).toBe(200);return {draft:result.value.draft,body};}
 async owned<T>(action:(tx:SQL)=>Promise<T>){return this.owner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');return action(tx as unknown as SQL);});}
 async close(){await this.app?.close();await this.db?.close();await this.owner?.close();}
}
