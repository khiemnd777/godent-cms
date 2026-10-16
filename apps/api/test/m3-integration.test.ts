import {afterAll,beforeAll,describe,expect,test} from 'bun:test';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {sql} from 'drizzle-orm';
import {M3Harness} from './m3-support';
import {permissionHistory} from './m3-permission-support';
import {M3_LIMITS,M3_ROUTES,type ContentCommandResult,type ContentDraft,type ContentHistoryItem,type ContentKind,type ContentPage,type ContentPermission,type ContentPermissionCommandResult,type ContentPermissions,type ContentReference,type PublicContentList,type PublicContentPage,type PublicServiceContentLinks,type ServiceContentLinksView} from '../src/contracts/m3';
import {legacyDocument} from '../src/contracts/content';
import {postgresCode} from '../src/database';
import type {PublicationService,PublicationResult,SiteDraft} from '../src/contracts/s03';
import type {IntakeChallenge,IntakeInput} from '../src/contracts/s04';
import {S05_ROUTES,type LeadCommandResult,type LeadDetail} from '../src/contracts/s05';
import {S06_ROUTES} from '../src/contracts/s06';
import {RetentionWorker} from '../src/worker/retention-worker';
import {RetentionCapture} from '../src/worker/retention-capture';
import {parsePermissionCursorValue} from '../src/contracts/m3-validation';
const h=new M3Harness();
async function isolatedSite(label:string){
 const id=randomUUID(),slug=`m3-${h.run.slice(0,8)}-${label}`;await h.recordOwned({kind:'isolated_tenant',id,slug});
 await h.owned(async tx=>{await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${id},${`M3 synthetic ${label}`})`;for(const who of ['A1','A2'])await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${id},${h.fixtures.identities.find(i=>i.label===who)!.userId})`;});
 const site=await h.call<SiteDraft>(`/api/tenants/${id}/publication/site`,'PUT',{slug,name:'M3 isolated synthetic site',footer:{intro:'',body:legacyDocument('Synthetic footer')},expectedVersion:0});expect(site.status).toBe(200);return {id,slug,siteVersion:site.value.version};
}
async function resourceAt(tenant:string,kind:ContentKind,extra:Record<string,unknown>={}){
 const operationId=randomUUID(),content=h.content(kind,extra);await h.recordOwned({kind,id:operationId,tenantId:tenant,slug:content.slug});const created=await h.call<ContentCommandResult>(M3_ROUTES.resources(tenant,kind),'POST',{operationId,content});expect(created.status).toBe(201);return created.value.draft;
}
async function publishAt(tenant:string,siteVersion:number,d:ContentDraft){const p=await h.call<ContentCommandResult>(M3_ROUTES.resource(tenant,d.kind,d.id)+'/publish','POST',{operationId:randomUUID(),expectedVersion:d.version,expectedPublicationVersion:d.publicationVersion,expectedPublicationRevision:d.publicationRevision,expectedSiteVersion:siteVersion});expect(p.status).toBe(200);return p.value.draft;}
async function refAt(slug:string,d:ContentDraft):Promise<ContentReference>{const p=await h.public<PublicContentPage>(M3_ROUTES.publicDetail(slug,d.kind,d.content.slug));expect(p.status).toBe(200);return {kind:d.kind,id:d.id,publicationId:p.value.publicationId};}
async function serviceAt(tenant:string,label:string){
 const slug=`m3-${h.run.slice(0,8)}-${label}`;await h.recordOwned({kind:'service',tenantId:tenant,slug});const c=await h.call<PublicationService>(`/api/tenants/${tenant}/publication/services`,'POST',{slug,title:`M3 synthetic ${label}`,summary:'Synthetic service',body:legacyDocument('Synthetic service body'),seo:{title:'',description:''}});expect(c.status).toBe(201);await h.recordOwned({kind:'service',tenantId:tenant,id:c.value.id,slug});return c.value;
}
async function publishServiceAt(tenant:string,siteVersion:number,d:PublicationService){const p=await h.call<PublicationResult>(`/api/tenants/${tenant}/publication/services/${d.id}/publish`,'POST',{requestKey:randomUUID(),expectedDraftVersion:d.draftVersion,expectedPublicationVersion:d.publicationVersion,expectedPublicationRevision:d.publicationRevision,expectedSiteVersion:siteVersion});expect(p.status).toBe(200);return p.value;}
describe.skipIf(process.env.M3_INTEGRATION!=='1')('M3 owned local API / restricted PostgreSQL',()=>{
 beforeAll(()=>h.setup(),120000);afterAll(()=>h.close());
 test('specialty pending draft, conflict, history restore, explicit unpublish and replay',async()=>{
  let d=await h.create('specialty');expect((await h.page(d)).status).toBe(404);const preview=await h.call<{draft:{id:string};issues:string[]}>(h.path(d)+'/preview');expect(preview.status).toBe(200);expect(preview.value.draft.id).toBe(d.id);
  d=await h.publish(d);const first=await h.page(d);expect(first.value.content.title).toBe(d.content.title);const stale=d;d=await h.save(d,{title:'Changed pending title'});expect((await h.page(d)).value.content.title).toBe(first.value.content.title);
  expect((await h.call(h.path(d),'PUT',{operationId:randomUUID(),expectedVersion:stale.version,content:stale.content},'A2')).status).toBe(409);
  const history=await h.call<ContentPage<ContentHistoryItem>>(h.path(d)+'/history');expect(history.status).toBe(200);expect(history.value.items.length).toBe(2);
  const source=history.value.items.find(i=>i.version===1)!;const restored=await h.call<ContentCommandResult>(h.path(d)+'/restore','POST',{operationId:randomUUID(),expectedVersion:d.version,sourceRevisionId:source.id});expect(restored.status).toBe(200);d=restored.value.draft;expect(d.version).toBe(3);expect((await h.page(d)).value.publicationId).toBe(first.value.publicationId);
  const off=await h.unpublish(d);expect((await h.page(d)).status).toBe(404);const replay=await h.call<ContentCommandResult>(h.path(d)+'/unpublish','POST',off.body);expect(replay.status).toBe(200);expect(replay.value.replayed).toBe(true);expect(replay.value.draft.activePublication).toBe(false);
 });
 test('FAQ pins survive drafts and newer publications, but never unpublish/republish',async()=>{
  let faq=await h.publish(await h.create('faq'));const originalRef=await h.ref(faq);let article=await h.publish(await h.create('article',{references:[originalRef]}));
  faq=await h.save(faq,{body:legacyDocument('New pending FAQ answer')});expect((await h.page(article)).value.references[0].publicationId).toBe(originalRef.publicationId);
  faq=await h.publish(faq);article=await h.save(article,{title:'Parent keeps selected FAQ publication'});article=await h.publish(article);expect((await h.page(article)).value.references[0].publicationId).toBe(originalRef.publicationId);
  faq=(await h.unpublish(faq)).draft;expect((await h.page(article)).value.references).toHaveLength(0);faq=await h.publish(faq);expect((await h.page(article)).value.references).toHaveLength(0);
  article=await h.save(article,{references:[await h.ref(faq)]});article=await h.publish(article);expect((await h.page(article)).value.references).toHaveLength(1);
 });
 test('all three price types remain decimal strings; a location-specific price is hidden if its only location is unpublished',async()=>{
  const location=await h.publish(await h.create('location'));const source=h.tenant();const refs=[{kind:'service',id:source.serviceId!,publicationId:source.publicationId!},await h.ref(location)];
  for(const price of [{type:'exact',amount:'999999999999999999999999.123456',currency:'VND',unit:'răng'},{type:'range',minimum:'12.500000',maximum:'12.500000',currency:'VND',unit:'răng'},{type:'from',amount:'0',currency:'USD',unit:'item'}]){
   const d=await h.publish(await h.create('price',{price,references:refs}));expect((await h.page(d)).value.content).toHaveProperty('price',price);
  }
  const list=await h.public<PublicContentList>(M3_ROUTES.publicList(source.slug,'price')+`?referenceKind=location&referenceId=${location.id}`);expect(list.status).toBe(200);expect(list.value.items).toHaveLength(3);expect(list.value.items[0].price).toBeDefined();await h.unpublish(location);
  const hidden=await h.public<PublicContentList>(M3_ROUTES.publicList(source.slug,'price')+`?referenceKind=location&referenceId=${location.id}`);expect(hidden.status).toBe(200);expect(hidden.value.items).toHaveLength(0);
 });
 test('patient text permission is resource/revision scoped and withdrawal hides historical references',async()=>{
  let d=await h.create('case');const site=await h.call<{version:number}>(`/api/tenants/${h.tenant().id}/publication/site`);
  const publish=()=>h.call(h.path(d)+'/publish','POST',{operationId:randomUUID(),expectedVersion:d.version,expectedPublicationVersion:d.publicationVersion,expectedPublicationRevision:d.publicationRevision,expectedSiteVersion:site.value.version});expect((await publish()).status).toBe(409);
  const grant=await h.call<ContentPermissionCommandResult>(h.path(d)+'/permissions','POST',{operationId:randomUUID(),expectedVersion:d.version,revision:d.version,scope:{type:'text'},evidenceReference:'Synthetic internal permission only'});expect(grant.status).toBe(200);expect(grant.value.permission.scope).toEqual({type:'text'});d=await h.publish(d);expect((await h.page(d)).status).toBe(200);
  const revoked=await h.call<ContentPermissionCommandResult>(h.path(d)+'/permissions/withdrawal','POST',{operationId:randomUUID(),expectedVersion:d.version,permissionId:grant.value.permission.id,reason:'Synthetic withdrawal'});expect(revoked.status).toBe(200);expect(revoked.value.permission.withdrawnAt).not.toBeNull();expect((await h.page(d)).status).toBe(404);
  d=await h.read(d);expect(d.activePublication).toBe(false);expect((await publish()).status).toBe(409);
 });
 test('current membership, tenant RLS, CSRF and platform-only account deny private content',async()=>{
  const d=await h.create('specialty');expect((await h.call(h.path(d),'GET',undefined,'B1')).status).toBe(403);expect((await h.call(h.path(d),'GET',undefined,'PlatformOnly')).status).toBe(403);
  expect((await h.call(h.path(d),'PUT',{operationId:randomUUID(),expectedVersion:d.version,content:d.content},'A1',{'x-csrf-token':'wrong'})).status).toBe(403);
  const a=h.clients.get('B1')!.actor;const rows=await h.db.withTenant(a,h.tenant('B').id,tx=>tx.execute(sql`SELECT id FROM gcms_m3.resource WHERE tenant_id=${h.tenant().id}`));expect(rows).toHaveLength(0);
  let code:string|undefined;try{await h.db.withTenant(h.clients.get('A1')!.actor,h.tenant().id,tx=>tx.execute(sql`UPDATE gcms_m3.resource SET version=version+1 WHERE id=${d.id}`));}catch(error){code=postgresCode(error);}expect(code).toBe('42501');
  try{await h.db.withTenant(h.clients.get('A1')!.actor,h.tenant().id,tx=>tx.execute(sql`SELECT gcms_m3.command(${h.tenant().id},${d.id},${JSON.stringify({type:'save',operationId:randomUUID(),expectedVersion:null,content:d.content})}::text::jsonb)`));}catch(error){code=postgresCode(error);}expect(code).toBe('23514');
  code=undefined;try{await h.db.withTenant(h.clients.get('A1')!.actor,h.tenant().id,tx=>tx.execute(sql`SELECT gcms_m3.command(${h.tenant().id},${d.id},${JSON.stringify({type:'save',operationId:randomUUID(),expectedVersion:d.version,content:{...d.content,kind:null}})}::text::jsonb)`));}catch(error){code=postgresCode(error);}expect(code).toBe('23514');
  const doctor=h.content('doctor'),source=h.tenant(),price=h.content('price',{references:[{kind:'service',id:source.serviceId,publicationId:source.publicationId}]});
  for(const content of [{...doctor,credentials:[null]},{...doctor,languages:[12]},{...doctor,professionalTitle:null},{...price,price:{type:'exact',amount:12,currency:'VND',unit:'răng'}},{...price,price:{type:'range',minimum:'20',maximum:'2',currency:'VND',unit:'răng'}},{...price,price:{type:'from',amount:'0',currency:'VND',unit:null}},h.content('location',{openingHours:[{day:1,closed:false,intervals:[{opens:null,closes:'12:00'}]}]})]){
   const operationId=randomUUID();await h.recordOwned({kind:'rejected_sql_command',tenantId:source.id,id:operationId});code=undefined;
   try{await h.db.withTenant(h.clients.get('A1')!.actor,source.id,tx=>tx.execute(sql`SELECT gcms_m3.command(${source.id},${operationId},${JSON.stringify({type:'create',operationId,content})}::text::jsonb)`));}catch(error){code=postgresCode(error);}expect(code).toBe('23514');
  }
 });
 test('anonymous old payload and selected location accept atomically with compatible fingerprint, shared lead detail and audit',async()=>{
  const tenant=h.tenant(),prefix=`/api/tenants/${tenant.id}/publication`,serviceSlug=`m3-intake-${h.run.slice(0,8)}`;
  await h.recordOwned({kind:'service_intake',tenantId:tenant.id,slug:serviceSlug});
  const created=await h.call<PublicationService>(prefix+'/services','POST',{slug:serviceSlug,title:'M3 owned intake service',summary:'Synthetic test',body:legacyDocument('Synthetic service body'),seo:{title:'',description:''}});expect(created.status).toBe(201);let service=created.value;
  await h.recordOwned({kind:'service_intake',tenantId:tenant.id,id:service.id,slug:serviceSlug});
  let location=await h.publish(await h.create('location'));const ref=await h.ref(location);
  const links=await h.call<ServiceContentLinksView>(M3_ROUTES.serviceLinks(tenant.id,service.id),'PUT',{operationId:randomUUID(),expectedDraftVersion:service.draftVersion,references:[ref]});expect(links.status).toBe(200);expect(links.value.resolved[0].title).toBe(location.content.title);
  const searched=await h.call<{items:PublicationService[];nextCursor:string|null}>(prefix+`/services?q=${encodeURIComponent(serviceSlug)}&pageSize=1`);expect(searched.status).toBe(200);expect(searched.value.items).toHaveLength(1);expect(searched.value.items[0].id).toBe(service.id);expect((await h.call(prefix+'/services?pageSize=51')).status).toBe(400);
  service=(await h.call<PublicationService>(prefix+`/services/${service.id}`)).value;
  // A legacy service editor save preserves references that it does not send.
  const save=await h.call<PublicationService>(prefix+`/services/${service.id}`,'PUT',{slug:service.slug,title:service.title,summary:service.summary,body:service.body,seo:service.seo,expectedDraftVersion:service.draftVersion});expect(save.status).toBe(200);service=save.value;
  expect((await h.call<ServiceContentLinksView>(M3_ROUTES.serviceLinks(tenant.id,service.id))).value.references).toEqual([ref]);
  const site=await h.call<{version:number}>(prefix+'/site');const published=await h.call<PublicationResult>(prefix+`/services/${service.id}/publish`,'POST',{requestKey:randomUUID(),expectedDraftVersion:service.draftVersion,expectedPublicationVersion:service.publicationVersion,expectedPublicationRevision:service.publicationRevision,expectedSiteVersion:site.value.version});expect(published.status).toBe(200);
  const path=`/api/public/intake/sites/${tenant.slug}/services/${serviceSlug}`;
  const accept=async(input:IntakeInput)=>{await h.recordOwned({kind:'intake_request',tenantId:tenant.id,id:input.requestKey,serviceId:service.id});let result=await h.public(path,'POST',input);if(result.value.code==='CAPTCHA_REQUIRED'){const c=await h.public<IntakeChallenge>(path+'/challenge','POST',{requestKey:input.requestKey});expect(c.status).toBe(200);const n=c.value.prompt.match(/\d+/g)!;result=await h.public(path,'POST',{...input,challenge:{token:c.value.token,answer:String(Number(n[0])+Number(n[1]))}});}return result;};
  const payload:IntakeInput={requestKey:randomUUID(),sourcePublicationId:published.value.publicationId,phone:'0900789123',preferredLanguage:'vi',preferredChannel:'phone',consent:true};
  expect((await accept(payload)).status).toBe(200);
  const original=await h.owned(tx=>tx`SELECT l.id,l.location_snapshot AS location,l.expires_at,r.fingerprint,(SELECT count(*)::integer FROM gcms_s04.audit_event a WHERE a.tenant_id=l.tenant_id AND a.target_id=l.id) AS audits FROM gcms_s04.accepted_request r JOIN gcms_s04.lead l ON l.tenant_id=r.tenant_id AND l.id=r.lead_id WHERE r.tenant_id=${tenant.id} AND r.request_key=${payload.requestKey}`);expect(original).toHaveLength(1);expect(original[0].location).toBeNull();expect(original[0].audits).toBe(1);
  const {requestKey:_,...semanticPayload}=payload;void _;
  const fingerprint=await h.owned(tx=>tx`SELECT r.fingerprint=encode(gcms_s04_crypto.hmac('semantic-v1:'||(${JSON.stringify(semanticPayload)}::text::jsonb||jsonb_build_object('consentVersion','consultation-vi-v1','tenantSlug',${tenant.slug}::text,'serviceSlug',${serviceSlug}::text))::text,s.hmac_key,'sha256'),'hex') AS same FROM gcms_s04.accepted_request r CROSS JOIN gcms_s04.secret s WHERE r.tenant_id=${tenant.id} AND r.request_key=${payload.requestKey}`);expect(fingerprint[0].same).toBe(true);
  const selected={...payload,requestKey:randomUUID(),locationId:location.id};expect((await accept(selected)).status).toBe(200);
  const row=await h.owned(tx=>tx`SELECT lead_id FROM gcms_s04.accepted_request WHERE tenant_id=${tenant.id} AND request_key=${selected.requestKey}`);const detail=await h.call<LeadDetail>(`/api/tenants/${tenant.id}/leads/${row[0].lead_id}`);expect(detail.status).toBe(200);expect(detail.value.location).toEqual({id:location.id,publicationId:ref.publicationId,name:location.content.title,address:'Synthetic address'});
  expect((await h.call(`/api/tenants/${tenant.id}/leads/${row[0].lead_id}`,'GET',undefined,'A2')).status).toBe(200);
  expect((await accept({...selected,locationId:randomUUID()})).status).toBe(409);
  location=await h.save(location,{title:'New pending location name'});location=await h.publish(location);expect((await h.call<LeadDetail>(`/api/tenants/${tenant.id}/leads/${row[0].lead_id}`)).value.location?.name).toBe(detail.value.location?.name);
  await h.unpublish(location);expect((await accept(selected)).status).toBe(200);expect((await accept({...selected,requestKey:randomUUID()})).status).toBe(404);expect((await accept(payload)).status).toBe(200);
 });
 test('unrenderable reference graphs reject publication atomically at the authoritative API',async()=>{
  const tenant=h.tenant(),prefix=`/api/tenants/${tenant.id}/publication`,site=await h.call<{version:number}>(prefix+'/site');const refs=[];
  for(let i=0;i<15;i++){
   await h.recordOwned({kind:'graph_service',tenantId:tenant.id,slug:`m3-graph-${h.run.slice(0,8)}-${i}`});
   const service=await h.call<PublicationService>(prefix+'/services','POST',{slug:`m3-graph-${h.run.slice(0,8)}-${i}`,title:`Synthetic graph service ${i}`,summary:'',body:legacyDocument('Synthetic only'),seo:{title:'',description:''}});expect(service.status).toBe(201);
   await h.recordOwned({kind:'graph_service',tenantId:tenant.id,id:service.value.id,slug:service.value.slug});
   const p=await h.call<PublicationResult>(prefix+`/services/${service.value.id}/publish`,'POST',{requestKey:randomUUID(),expectedDraftVersion:service.value.draftVersion,expectedPublicationVersion:0,expectedPublicationRevision:0,expectedSiteVersion:site.value.version});expect(p.status).toBe(200);refs.push({kind:'service' as const,id:service.value.id,publicationId:p.value.publicationId});
  }
  const faqs=[];for(let i=0;i<16;i++){const faq=await h.publish(await h.create('faq',{references:refs}));faqs.push(await h.ref(faq));}
  const search=`m3-graph-${h.run.slice(0,8)}`,list=await h.call<{items:PublicationService[];nextCursor:string|null}>(prefix+`/services?q=${search}&pageSize=1`);expect(list.status).toBe(200);expect(list.value.items).toHaveLength(1);expect(list.value.nextCursor).not.toBeNull();expect((await h.call(prefix+`/services?q=changed&pageSize=1&cursor=${list.value.nextCursor}`)).status).toBe(400);
  const article=await h.create('article',{references:faqs});const failed=await h.call(h.path(article)+'/publish','POST',{operationId:randomUUID(),expectedVersion:article.version,expectedPublicationVersion:0,expectedPublicationRevision:0,expectedSiteVersion:site.value.version});expect(failed.status).toBe(409);expect((await h.read(article)).activePublication).toBe(false);expect((await h.page(article)).status).toBe(404);
  const rows=await h.owned(tx=>tx`SELECT (SELECT count(*)::integer FROM gcms_m3.publication WHERE tenant_id=${tenant.id} AND resource_id=${article.id}) AS publications,(SELECT count(*)::integer FROM gcms_m3.intent WHERE tenant_id=${tenant.id} AND resource_id=${article.id}) AS intents`);expect(rows[0].publications).toBe(0);expect(rows[0].intents).toBe(0);
  let rejected=false;try{await h.owned(tx=>tx`SELECT gcms_m3.assert_public_bounds(jsonb_build_object('references','[]'::jsonb,'body',repeat('x',1048577)))`);}catch(error){rejected=postgresCode(error)==='23514';}expect(rejected).toBe(true);
 },120000);
 test('DB-barrier publish versus text withdrawal cannot regrant old content or replay a pointer',async()=>{
  let d=await h.create('case');const permission=await h.call<ContentPermissionCommandResult>(h.path(d)+'/permissions','POST',{operationId:randomUUID(),expectedVersion:d.version,revision:d.version,scope:{type:'text'},evidenceReference:'Synthetic race scope'});expect(permission.status).toBe(200);d=await h.publish(d);
  const site=await h.call<{version:number}>(`/api/tenants/${h.tenant().id}/publication/site`),body={operationId:randomUUID(),expectedVersion:d.version,expectedPublicationVersion:d.publicationVersion,expectedPublicationRevision:d.publicationRevision,expectedSiteVersion:site.value.version};
  let requests:ReturnType<M3Harness['call']>[]=[];await h.owned(async tx=>{
   await tx`SELECT pg_advisory_xact_lock(hashtextextended(${h.tenant().id},7202))`;
   requests=[h.call(h.path(d)+'/publish','POST',body),h.call(h.path(d)+'/permissions/withdrawal','POST',{operationId:randomUUID(),expectedVersion:d.version,permissionId:permission.value.permission.id,reason:'Synthetic concurrent text withdrawal'},'A2')];
   const deadline=Date.now()+4000;let blocked=0;while(Date.now()<deadline){const rows=await tx`SELECT count(*)::integer AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted AND classid=((hashtextextended(${h.tenant().id},7202)>>32)&4294967295)::oid AND objid=(hashtextextended(${h.tenant().id},7202)&4294967295)::oid AND objsubid=1`;blocked=rows[0].n;if(blocked>=2)break;await Bun.sleep(50);}expect(blocked).toBeGreaterThanOrEqual(2);
  });
  const result=await Promise.all(requests);expect([200,409]).toContain(result[0].status);expect(result[1].status).toBe(200);expect((await h.page(d)).status).toBe(404);const current=await h.read(d);expect(current.activePublication).toBe(false);
  const replay=await h.call<ContentCommandResult>(h.path(d)+'/publish','POST',body);if(result[0].status===200){expect(replay.status).toBe(200);expect(replay.value.replayed).toBe(true);expect(replay.value.draft.activePublication).toBe(false);}else expect(replay.status).toBe(409);
 },120000);
 test('service publications preserve ordered many-taxonomy and related-service pins with self, duplicate and cross-tenant guards',async()=>{
  const tenant=h.tenant(),site=(await h.call<SiteDraft>(`/api/tenants/${tenant.id}/publication/site`)).value;
  const specialties=[],groups=[];for(let i=0;i<2;i++){specialties.push(await h.ref(await h.publish(await h.create('specialty'))));groups.push(await h.ref(await h.publish(await h.create('service_group'))));}
  const related:ContentReference[]=[];for(let i=0;i<2;i++){const d=await serviceAt(tenant.id,`related-${i}`),p=await publishServiceAt(tenant.id,site.version,d);related.push({kind:'service',id:d.id,publicationId:p.publicationId});}
  let service=await serviceAt(tenant.id,'ordered-links');const path=M3_ROUTES.serviceLinks(tenant.id,service.id),readService=()=>h.call<PublicationService>(`/api/tenants/${tenant.id}/publication/services/${service.id}`);
  const ordered=[specialties[1],specialties[0],groups[1],groups[0],related[1],related[0]];
  const put=async(references:ContentReference[])=>h.call<ServiceContentLinksView>(path,'PUT',{operationId:randomUUID(),expectedDraftVersion:service.draftVersion,references});
  const saved=await put(ordered);expect(saved.status).toBe(200);expect(saved.value.resolved.map(x=>x.id)).toEqual(ordered.map(x=>x.id));service=(await readService()).value;
  const published=await publishServiceAt(tenant.id,site.version,service),publicPath=M3_ROUTES.publicServiceLinks(tenant.slug,service.slug!);
  const live=await h.public<PublicServiceContentLinks>(publicPath);expect(live.status).toBe(200);expect(live.value.publicationId).toBe(published.publicationId);expect(live.value.references.map(x=>({kind:x.kind,id:x.id,publicationId:x.publicationId}))).toEqual(ordered);expect(Buffer.byteLength(JSON.stringify(live.value))).toBeLessThanOrEqual(M3_LIMITS.publicBytes);
  for(const ref of [...specialties,...groups]){const list=await h.public<PublicContentList>(M3_ROUTES.publicList(tenant.slug,'service')+`?referenceKind=${ref.kind}&referenceId=${ref.id}`);expect(list.status).toBe(200);expect(list.value.items.map(x=>x.id)).toContain(service.id);}
  service=(await readService()).value;const reversed=[...ordered].reverse();expect((await put(reversed)).status).toBe(200);service=(await readService()).value;expect((await h.public<PublicServiceContentLinks>(publicPath)).value.references.map(x=>x.id)).toEqual(ordered.map(x=>x.id));
  const next=await publishServiceAt(tenant.id,site.version,service);expect(next.publicationId).not.toBe(published.publicationId);expect((await h.public<PublicServiceContentLinks>(publicPath)).value.references.map(x=>x.id)).toEqual(reversed.map(x=>x.id));service=(await readService()).value;
  expect((await put([{kind:'service',id:service.id,publicationId:next.publicationId}])).status).toBe(400);expect((await put([ordered[0],ordered[0]])).status).toBe(400);
  const other=h.tenant('B');expect((await put([{kind:'service',id:other.serviceId!,publicationId:other.publicationId!}])).status).toBe(409);
  const after=await h.call<ServiceContentLinksView>(path);expect(after.value.draftVersion).toBe(service.draftVersion);expect(after.value.references).toEqual(reversed);expect((await h.public<PublicServiceContentLinks>(publicPath)).value.publicationId).toBe(next.publicationId);
 },120000);
 test('twenty large FAQ answers paginate below the complete DTO byte cap without omission or internal flags',async()=>{
  const tenant=await isolatedSite('faq-budget'),created:string[]=[];
  for(let i=0;i<20;i++){const faq=await publishAt(tenant.id,tenant.siteVersion,await resourceAt(tenant.id,'faq',{title:`Large FAQ ${i}`,body:legacyDocument('答'.repeat(20000))}));created.push(faq.id);}
  const seen:string[]=[],cursors=new Set<string>();let cursor:string|null=null,pages=0,partialContinuation=false;
  do{
   const query=new URLSearchParams({pageSize:'20'});if(cursor)query.set('cursor',cursor);
   const result=await h.public<PublicContentList>(M3_ROUTES.publicList(tenant.slug,'faq')+'?'+query);expect(result.status).toBe(200);const page=result.value;pages++;
   expect(Buffer.byteLength(JSON.stringify(page),'utf8')).toBeLessThanOrEqual(M3_LIMITS.publicBytes);expect(Object.keys(page).sort()).toEqual(['canonicalUrl','items','kind','locale','nextCursor','schemaVersion','site']);expect(page.items.length).toBeGreaterThan(0);
   seen.push(...page.items.map(x=>x.id));cursor=page.nextCursor;
   if(cursor){expect(cursors.has(cursor)).toBe(false);cursors.add(cursor);const decoded=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));expect(decoded.after).toBe(page.items[page.items.length-1].id);if(page.items.length<20)partialContinuation=true;
    expect((await h.public(M3_ROUTES.publicList(tenant.slug,'faq')+'?pageSize=19&cursor='+cursor)).status).toBe(400);
   }
   expect(pages).toBeLessThanOrEqual(20);
  }while(cursor);
  expect(pages).toBeGreaterThan(1);expect(partialContinuation).toBe(true);expect(seen).toEqual(created.sort());expect(new Set(seen).size).toBe(20);
 },120000);
 test('all older text grants remain reachable and the affected command/singleton can withdraw the published first revision after205 genuine grants',async()=>{
  const tenant=await isolatedSite('permission-pages'),fixture=await permissionHistory(h,tenant,'integration'),path=fixture.path+'/permissions';
  const live=await h.public<PublicContentPage>(M3_ROUTES.publicDetail(tenant.slug,'case',fixture.draft.content.slug));expect(live.status).toBe(200);expect(live.value.publicationId).toBe(fixture.publicationId);expect(live.value.content.title).toBe('M3 permission history integration V1');expect(fixture.draft.version).toBe(205);
  const expected=await h.owned(tx=>tx`SELECT id FROM gcms_m3.permission WHERE tenant_id=${tenant.id} AND resource_id=${fixture.draft.id} ORDER BY granted_at DESC,id DESC`),contextOther=await resourceAt(tenant.id,'case'),ids:string[]=[];let cursor:string|null=null,pages=0;
  do{const query=new URLSearchParams({pageSize:'37'});if(cursor)query.set('cursor',cursor);const result=await h.call<ContentPermissions>(path+'?'+query);expect(result.status).toBe(200);expect(result.value.items.length).toBeLessThanOrEqual(37);ids.push(...result.value.items.map(p=>p.id));pages++;cursor=result.value.nextCursor;
   if(cursor){const last=result.value.items.at(-1)!,anchor=parsePermissionCursorValue(JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')).after);expect(anchor).toEqual({grantedAt:last.grantedAt,id:last.id});const exact=await h.owned(tx=>tx`SELECT to_char(granted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS stamp FROM gcms_m3.permission WHERE tenant_id=${tenant.id} AND id=${last.id}`);expect(last.grantedAt).toBe(exact[0].stamp);expect((await h.call(path+'?pageSize=38&cursor='+cursor)).status).toBe(400);expect((await h.call(M3_ROUTES.permissions(h.tenant().id,'case',fixture.draft.id)+'?pageSize=37&cursor='+cursor)).status).toBe(400);expect((await h.call(M3_ROUTES.permissions(tenant.id,'case',contextOther.id)+'?pageSize=37&cursor='+cursor)).status).toBe(400);}
   expect(pages).toBeLessThanOrEqual(10);
  }while(cursor);
  expect(ids).toEqual(expected.map((p:{id:string})=>p.id));expect(ids).toHaveLength(205);expect(new Set(ids).size).toBe(205);expect(ids.at(-1)).toBe(fixture.grants[0].id);expect(pages).toBe(6);
  const newest=await h.call<ContentPermissions>(path);expect(newest.value.items).toHaveLength(50);expect(newest.value.items.some(p=>p.id===fixture.grants[0].id)).toBe(false);expect((await h.call(path+'?pageSize=101')).status).toBe(400);expect((await h.call(path+'?cursor=malformed')).status).toBe(400);expect((await h.call(path+'?unknown=true')).status).toBe(400);
  const oldestPath=M3_ROUTES.permission(tenant.id,'case',fixture.draft.id,fixture.grants[0].id),oldest=await h.call<ContentPermission>(oldestPath);expect(oldest.status).toBe(200);expect(oldest.value.revision).toBe(1);expect(oldest.value.withdrawnAt).toBeNull();expect((await h.call(oldestPath,'GET',undefined,'B1')).status).toBe(403);expect((await h.call(oldestPath,'GET',undefined,'PlatformOnly')).status).toBe(403);
  expect((await h.call(M3_ROUTES.permission(tenant.id,'case',contextOther.id,oldest.value.id))).status).toBe(404);expect((await h.call(M3_ROUTES.permission(tenant.id,'case',fixture.draft.id,randomUUID()))).status).toBe(404);
  const operationId=randomUUID(),withdrawal={operationId,expectedVersion:fixture.draft.version,permissionId:oldest.value.id,reason:'Synthetic oldest grant withdrawal'},changed=await h.call<ContentPermissionCommandResult>(path+'/withdrawal','POST',withdrawal);expect(changed.status).toBe(200);expect(changed.value.operationId).toBe(operationId);expect(changed.value.replayed).toBe(false);expect(changed.value.permission.id).toBe(oldest.value.id);expect(changed.value.permission.withdrawnAt).not.toBeNull();expect(changed.value.permission.purge?.status).toBe('pending');
  const poll=await h.call<ContentPermission>(oldestPath);expect(poll.status).toBe(200);expect(poll.value).toEqual(changed.value.permission);expect((await h.public(M3_ROUTES.publicDetail(tenant.slug,'case',fixture.draft.content.slug))).status).toBe(404);expect((await h.call<ContentPermissions>(path)).value.items.some(p=>p.id===oldest.value.id)).toBe(false);
  const replay=await h.call<ContentPermissionCommandResult>(path+'/withdrawal','POST',withdrawal);expect(replay.status).toBe(200);expect(replay.value.replayed).toBe(true);expect(replay.value.permission.id).toBe(oldest.value.id);expect(replay.value.permission.withdrawnAt).toBe(changed.value.permission.withdrawnAt);
 },120000);
 test('accepted location snapshot follows the complete S06 private deletion graph and only the new allowlisted lead is deleted',async()=>{
  const tenant=await isolatedSite('retention-location'),locationName=`Private synthetic location ${h.run}`,locationAddress=`private-location-address-${h.run}`;
  const location=await publishAt(tenant.id,tenant.siteVersion,await resourceAt(tenant.id,'location',{title:locationName,address:locationAddress})),locationRef=await refAt(tenant.slug,location);
  let service=await serviceAt(tenant.id,'retention-location');const links=await h.call<ServiceContentLinksView>(M3_ROUTES.serviceLinks(tenant.id,service.id),'PUT',{operationId:randomUUID(),expectedDraftVersion:service.draftVersion,references:[locationRef]});expect(links.status).toBe(200);service=(await h.call<PublicationService>(`/api/tenants/${tenant.id}/publication/services/${service.id}`)).value;const publication=await publishServiceAt(tenant.id,tenant.siteVersion,service);
  const inputPath=`/api/public/intake/sites/${tenant.slug}/services/${service.slug}`,privateMessage=`private-location-message-${h.run}`,privateNote=`private-location-note-${h.run}`;
  const accept=async(label:string)=>{
   const input:IntakeInput={requestKey:randomUUID(),sourcePublicationId:publication.publicationId,locationId:location.id,name:`Synthetic retained ${label}`,phone:'0900789456',message:privateMessage,preferredLanguage:'vi',preferredChannel:'phone',consent:true};await h.recordOwned({kind:'intake_request',tenantId:tenant.id,id:input.requestKey,serviceId:service.id});
   let result=await h.public(inputPath,'POST',input);if(result.value.code==='CAPTCHA_REQUIRED'){const c=await h.public<IntakeChallenge>(inputPath+'/challenge','POST',{requestKey:input.requestKey});expect(c.status).toBe(200);const n=c.value.prompt.match(/\d+/g)!;result=await h.public(inputPath,'POST',{...input,challenge:{token:c.value.token,answer:String(Number(n[0])+Number(n[1]))}});}expect(result.status).toBe(200);
   const rows=await h.owned(tx=>tx`SELECT lead_id FROM gcms_s04.accepted_request WHERE tenant_id=${tenant.id} AND request_key=${input.requestKey}`);expect(rows).toHaveLength(1);const id=String(rows[0].lead_id);await h.recordOwned({kind:'location_lead',tenantId:tenant.id,id,requestKey:input.requestKey});return id;
  };
  const selected=await accept('selected'),unselected=await accept('unselected'),leadPath=S05_ROUTES.lead(tenant.id,selected);
  const detail=await h.call<LeadDetail>(leadPath),shared=await h.call<LeadDetail>(leadPath,'GET',undefined,'A2');expect(detail.status).toBe(200);expect(shared.status).toBe(200);expect(detail.value.location).toEqual({id:location.id,publicationId:locationRef.publicationId,name:locationName,address:locationAddress});expect(shared.value.location).toEqual(detail.value.location);
  const note=await h.call<LeadCommandResult>(S05_ROUTES.commands(tenant.id,selected),'POST',{operationId:randomUUID(),expectedVersion:detail.value.version,kind:'note',text:privateNote});expect(note.status).toBe(200);
  const extension=await h.call<LeadCommandResult>(S06_ROUTES.extension(tenant.id,selected),'POST',{operationId:randomUUID(),expectedVersion:note.value.lead.version,reason:'Synthetic retention seam',expiresAt:new Date(Date.now()+365*86400000).toISOString()});expect(extension.status).toBe(200);
  const delivery=randomUUID(),capture=resolve('.local',`m3-retention-${h.run}`);await h.recordOwned({kind:'retention_scope',tenantId:tenant.id,leadIds:[selected],deliveryId:delivery,capture});
  await h.owned(async tx=>{
   await tx`INSERT INTO gcms_s05.delivery(id,tenant_id,lead_id,recipient_user_id) VALUES(${delivery},${tenant.id},${selected},${h.fixtures.identities.find(i=>i.label==='A1')!.userId})`;
   await tx`INSERT INTO gcms_s06.worker_scope(tenant_id,enabled) VALUES(${tenant.id},true)`;await tx`INSERT INTO gcms_s06.lead_scope(tenant_id,lead_id) VALUES(${tenant.id},${selected})`;
   await tx`WITH instant AS(SELECT clock_timestamp() AS at) UPDATE gcms_s04.lead l SET created_at=i.at-interval '200 days',consent_at=i.at-interval '200 days',last_activity_at=i.at-interval '174 days',extension_expires_at=NULL FROM instant i WHERE l.tenant_id=${tenant.id} AND l.id=${selected}`;
  });
  const worker=new RetentionWorker(process.env.S06_WORKER_DATABASE_URL!,new RetentionCapture(capture));
  try{
   const notice=await worker.runOnce(tenant.id);expect(notice.claimed).toBe(2);expect(notice.captured).toBe(2);expect(notice.deleted).toBe(0);expect(notice.failed).toBe(0);
   const files=await readdir(capture);expect(files.filter(x=>x.endsWith('.json'))).toHaveLength(2);for(const file of files){const text=await readFile(join(capture,file),'utf8');for(const forbidden of [privateMessage,privateNote,locationName,locationAddress,location.id,selected,'0900789456'])expect(text).not.toContain(forbidden);}
   const graph=[['gcms_s04.lead','id'],['gcms_s04.accepted_request','lead_id'],['gcms_s04.intake_activity','lead_id'],['gcms_s04.notification_intent','lead_id'],['gcms_s05.lead_event','lead_id'],['gcms_s05.operation_receipt','lead_id'],['gcms_s05.delivery','lead_id'],['gcms_s06.extension_receipt','lead_id'],['gcms_s06.job','lead_id'],['gcms_s06.notice','lead_id']] as const;
   for(const [table,key] of graph){const rows=await h.owned(tx=>tx.unsafe(`SELECT count(*)::integer AS n FROM ${table} WHERE tenant_id=$1 AND ${key}=$2`,[tenant.id,selected]));expect(rows[0].n).toBeGreaterThan(0);}
   await h.owned(tx=>tx`WITH instant AS(SELECT clock_timestamp() AS at) UPDATE gcms_s04.lead l SET created_at=i.at-interval '200 days',consent_at=i.at-interval '200 days',last_activity_at=i.at-interval '180 days'-interval '1 second',extension_expires_at=NULL FROM instant i WHERE l.tenant_id=${tenant.id} AND l.id IN (${selected},${unselected})`);
   const untouched=(await h.owned(tx=>tx`SELECT to_jsonb(l) AS value FROM gcms_s04.lead l WHERE tenant_id=${tenant.id} AND id=${unselected}`))[0].value;
   expect((await h.call(leadPath)).status).toBe(404);expect((await h.call(S05_ROUTES.history(tenant.id,selected))).status).toBe(404);
   const deleted=await worker.runOnce(tenant.id);expect(deleted.claimed).toBe(1);expect(deleted.deleted).toBe(1);expect(deleted.failed).toBe(0);expect((await worker.runOnce(tenant.id)).deleted).toBe(0);
   for(const [table,key] of graph){const rows=await h.owned(tx=>tx.unsafe(`SELECT count(*)::integer AS n FROM ${table} WHERE tenant_id=$1 AND ${key}=$2`,[tenant.id,selected]));expect(rows[0].n).toBe(0);}
   const remaining=await h.owned(tx=>tx`SELECT to_jsonb(l) AS value FROM gcms_s04.lead l WHERE tenant_id=${tenant.id} AND id=${unselected}`);expect(remaining).toHaveLength(1);expect(remaining[0].value).toEqual(untouched);
   const decisions=await h.owned(tx=>tx`SELECT to_jsonb(d) AS value FROM gcms_s06.deletion_decision d WHERE tenant_id=${tenant.id}`);expect(decisions).toHaveLength(1);expect(decisions[0].value.lead_id).toBe(selected);expect(Object.keys(decisions[0].value).sort()).toEqual(['deleted_at','expired_at','lead_id','retention_revision','tenant_id']);
   const audit=await h.owned(tx=>tx`SELECT to_jsonb(a) AS value FROM gcms_s06.audit_event a WHERE tenant_id=${tenant.id} UNION ALL SELECT to_jsonb(a) FROM gcms_s04.audit_event a WHERE tenant_id=${tenant.id}`);expect(audit.length).toBeGreaterThan(0);for(const forbidden of [privateMessage,privateNote,locationName,locationAddress,'0900789456'])expect(JSON.stringify(audit)).not.toContain(forbidden);
   const scope=await h.owned(tx=>tx`SELECT lead_id FROM gcms_s06.lead_scope WHERE tenant_id=${tenant.id}`);expect(scope.map((x:{lead_id:string})=>x.lead_id)).toEqual([selected]);expect((await h.owned(tx=>tx`SELECT tenant_id FROM gcms_s05.worker_scope WHERE tenant_id=${tenant.id}`))).toHaveLength(0);
  }finally{await worker.close();}
 },120000);
});
