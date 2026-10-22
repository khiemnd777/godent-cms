import { SQL as BunSQL } from 'bun';
// Root tooling pins the API's Drizzle version without depending on the install layout.
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { lstat, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { legacyDocument } from '../apps/api/src/contracts/content';
import { M3_ROUTES, type ContentCommandResult, type ContentDraft, type ContentReference, type DentalContent } from '../apps/api/src/contracts/m3';
import { ContentService } from '../apps/api/src/modules/content.service';
import { PublicationServiceOperations } from '../apps/api/src/modules/publication.service';
import type { PrivateRequest } from '../apps/api/src/modules/request-security';
import { readM3Fixtures } from './m3-fixtures';
import { openPasswordSession } from './s02-fixtures';
const PATH='.local/m3-performance.json';
interface Resource {id:string;publish:string;slug:string}
interface Manifest {owner:'GCMS-M3-PERF-v1';fixtureRun:string;tenantId:string;slug:string;status:'provisioning'|'complete';categories:Resource[];articles:Resource[]}
async function main(){
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m3')||!process.argv.includes('--synthetic-fixtures'))throw new Error('Explicit local performance scope required');
 const fixtures=await readM3Fixtures(),identity=fixtures.identities.find(i=>i.label==='A1')!;let manifest:Manifest;
 if(await Bun.file(PATH).exists()){const meta=await lstat(PATH);if(!meta.isFile()||meta.isSymbolicLink()||(meta.mode&0o777)!==0o600)throw new Error('Unsafe manifest');manifest=JSON.parse(await readFile(PATH,'utf8')) as Manifest;if(manifest.owner!=='GCMS-M3-PERF-v1'||manifest.fixtureRun!==fixtures.runId||manifest.articles.length!==1000)throw new Error('Wrong performance ownership');}
 else {const id=randomUUID(),resource=(slug:string):Resource=>({id:randomUUID(),publish:randomUUID(),slug});manifest={owner:'GCMS-M3-PERF-v1',fixtureRun:fixtures.runId,tenantId:id,slug:`m3-perf-${id.slice(0,8)}`,status:'provisioning',categories:[resource('nhom-dich-nho'),resource('nhom-con-lai')],articles:Array.from({length:1000},(_,index)=>resource(`bai-tong-hop-${String(index).padStart(4,'0')}`))};await writeFile(PATH,JSON.stringify(manifest)+'\n',{mode:0o600,flag:'wx'});}
 const runtime=await loadRuntimeEnvironment();Object.assign(process.env,runtime.api);const db=createS02Database(),auth=createS02Auth(db),owner=new BunSQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
 try{
  if(manifest.status!=='complete'){
   await owner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${manifest.tenantId},${`M3 synthetic performance ${manifest.tenantId}`}) ON CONFLICT DO NOTHING`;const actual=await tx`SELECT name,status FROM gcms_s02.tenant WHERE id=${manifest.tenantId}`;if(actual[0]?.name!==`M3 synthetic performance ${manifest.tenantId}`||actual[0]?.status!=='active')throw new Error('Wrong tenant');await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${manifest.tenantId},${identity.userId}) ON CONFLICT DO NOTHING`;});
  }
  const signed=await openPasswordSession(auth,identity),request=(method='POST'):PrivateRequest=>({method,originalUrl:M3_ROUTES.resources(manifest.tenantId,'article'),headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891','content-type':'application/json',cookie:signed.headers.get('cookie')??'','x-csrf-token':auth.csrfToken(signed.actor)}}),content=new ContentService(db,auth),publishing=new PublicationServiceOperations(db,auth);
  if(manifest.status!=='complete'){
   let site=await publishing.getSite(request('GET'),manifest.tenantId);if(!site.version)site=await publishing.saveSite(request('PUT'),manifest.tenantId,{slug:manifest.slug,name:'Dữ liệu hiệu năng tổng hợp M3',expectedVersion:0,footer:{intro:'Dữ liệu thử riêng',body:legacyDocument('Không có dữ liệu khách hàng.')}});
   const createPublish=async(resource:Resource,kind:'category'|'article',references:ContentReference[])=>{let draft:ContentDraft;try{draft=await content.read(request('GET'),manifest.tenantId,kind,resource.id);}catch(error){if(!(error&&typeof error==='object'&&'getStatus'in error&&typeof error.getStatus==='function'&&error.getStatus()===404))throw error;const document={kind,slug:resource.slug,title:`M3 hiệu năng ${resource.slug}`,summary:'Nội dung tổng hợp để đo truy vấn local.',body:legacyDocument('Nội dung thử '.repeat(20)),seo:{title:'',description:''},references,...(kind==='article'?{attribution:'Nguồn tổng hợp',image:null}:{})} as DentalContent;draft=(await content.command(request(),manifest.tenantId,kind,undefined,'create',{operationId:resource.id,content:document}) as ContentCommandResult).draft;}
    if(!draft.activePublication)draft=(await content.command(request(),manifest.tenantId,kind,resource.id,'publish',{operationId:resource.publish,expectedVersion:draft.version,expectedPublicationVersion:draft.publicationVersion,expectedPublicationRevision:draft.publicationRevision,expectedSiteVersion:site.version}) as ContentCommandResult).draft;
    const page=await content.publicRead(request('GET'),manifest.slug,kind,resource.slug);return {kind,id:resource.id,publicationId:page.publicationId} satisfies ContentReference;};
   const refs:ContentReference[]=[];for(const resource of manifest.categories)refs.push(await createPublish(resource,'category',[]));
   for(const [index,resource] of manifest.articles.entries()){await createPublish(resource,'article',[refs[index%100===0?0:1]]);if((index+1)%250===0)console.info(JSON.stringify({phase:'owned_performance_fixtures',createdOrReused:index+1,total:1000}));}
   manifest.status='complete';const temp=`.local/m3-perf-${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(manifest)+'\n',{mode:0o600,flag:'wx'});await rename(temp,PATH);
  }
  const report=await db.withTenant(signed.actor,manifest.tenantId,async tx=>{
   await tx.execute(sql`SET LOCAL statement_timeout='15s'`);
   const counts=await tx.execute(sql`SELECT kind,count(*)::integer AS resources,count(active_publication_id)::integer AS published FROM gcms_m3.resource WHERE tenant_id=${manifest.tenantId} GROUP BY kind ORDER BY kind`);
   const t=manifest.tenantId,target=manifest.categories[0].id;
   const queries=[
    {name:'cms_first_page',query:sql`SELECT r.id,r.tenant_id,r.kind,r.version,r.content,r.slug_locked,r.publication_version,r.publication_revision,r.active_publication_id,p.draft_version,r.updated_at FROM gcms_m3.resource r LEFT JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE r.tenant_id=${t} AND r.kind='article' ORDER BY r.id LIMIT 21`},
    {name:'cms_deep_keyset',query:sql`SELECT r.id,r.content FROM gcms_m3.resource r WHERE r.tenant_id=${t} AND r.kind='article' AND r.id>${[...manifest.articles].sort((a,b)=>a.id.localeCompare(b.id))[799].id} ORDER BY r.id LIMIT 21`},
    {name:'cms_search_no_match',query:sql`SELECT r.id,r.content FROM gcms_m3.resource r WHERE r.tenant_id=${t} AND r.kind='article' AND (position('not-present-synthetic' IN lower(r.content->>'title'))>0 OR position('not-present-synthetic' IN r.slug)>0) ORDER BY r.id LIMIT 21`},
    {name:'reference_picker',query:sql`SELECT r.kind,r.id,p.id,p.content FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE r.tenant_id=${t} AND r.kind='article' AND gcms_m3.resource_eligible(r.tenant_id,r.id,p.id) ORDER BY r.id LIMIT 21`},
    {name:'public_outer_first',query:sql`SELECT gcms_m3.public_list(${manifest.slug},'article','',NULL,21,NULL,NULL,NULL)`},
    {name:'public_outer_sparse_reverse',query:sql`SELECT gcms_m3.public_list(${manifest.slug},'article','',NULL,21,'category',${target},NULL)`},
    {name:'reverse_raw_candidates',query:sql`SELECT r.id,r.active_publication_id FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE r.tenant_id=${t} AND r.kind='article' AND r.active_publication_id IS NOT NULL ORDER BY r.id`},
    {name:'reverse_containment_candidates',query:sql`SELECT r.id,r.active_publication_id FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE r.tenant_id=${t} AND r.kind='article' AND r.active_publication_id IS NOT NULL AND p.reference_pins @> ${JSON.stringify([{kind:'category',id:target}])}::text::jsonb ORDER BY r.id`}
   ];const plans=[];for(const q of queries){const result=await tx.execute(sql`EXPLAIN (ANALYZE,BUFFERS,VERBOSE,SETTINGS,FORMAT JSON) ${q.query}`);plans.push({name:q.name,plan:result[0]['QUERY PLAN']});}
   const reverse=await tx.execute(sql`SELECT gcms_m3.public_list(${manifest.slug},'article','',NULL,21,'category',${target},NULL) AS page`);const page=reverse[0].page as {items:unknown[]};if(page.items.length!==10)throw new Error('Sparse reverse results incomplete');return {counts,plans,sparseReverseResults:page.items.length};
  });
  const output={status:'PASS',recordedAt:new Date().toISOString(),tenantSlug:manifest.slug,role:'gcms_s02_tenant with current membership and FORCE RLS',...report,limits:'Owned 1000 synthetic articles, 2 categories, 1 percent reverse matches. Outer function plans hide nested plans; raw candidate diagnostics are separate. No planner disabling, ANALYZE, global instrumentation or production extrapolation.'};
  await writeFile(`docs/evidence/m3/query-plans-${Date.now()}.json`,JSON.stringify(output,null,2)+'\n',{flag:'wx'});console.info(JSON.stringify({status:'PASS',phase:'actual_query_plans',counts:report.counts,sparseReverseResults:report.sparseReverseResults,timings:report.plans.map(p=>({name:p.name,milliseconds:(p.plan as Array<Record<string,unknown>>)[0]['Execution Time']}))}));
 }finally{await db.close();await owner.close();}
}
if(import.meta.main)void main().catch(async error=>{await writeFile(`.local/m3-performance-error-${Date.now()}.json`,JSON.stringify({message:error instanceof Error?error.message:'Unknown',stack:error instanceof Error?error.stack:null})+'\n',{mode:0o600,flag:'wx'});console.error('M3 performance failed; private diagnostic retained.');process.exitCode=1;});
