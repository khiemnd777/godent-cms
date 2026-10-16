import {expect} from 'bun:test';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {M3_ROUTES,type ContentCommandResult,type ContentPermissionCommandResult,type PublicContentPage} from '../src/contracts/m3';
import {S07_ROUTES,type MediaAsset,type MediaKind} from '../src/contracts/s07';
import type {SiteDraft} from '../src/contracts/s03';
import {legacyDocument} from '../src/contracts/content';
import {MediaWorker} from '../src/worker/media-worker';
import type {M3Harness} from './m3-support';

/** New isolated scope only. Upload, native processing, grants and publications use real APIs. */
export async function historicalImages(h:M3Harness,label:string){
 const tenantId=randomUUID(),tenantSlug=`m3-image-${h.run.slice(0,8)}-${label}`,assetId=randomUUID(),materialKind:MediaKind='patient_derived';
 const plans=(['doctor','article'] as const).map(kind=>({kind,id:randomUUID(),grant:randomUUID(),publish:randomUUID(),save:randomUUID()}));
 await h.recordOwned({kind:'historical_image_fixture',tenantId,tenantSlug,assetId,materialKind,plans,workerScope:'gcms_s07'});
 await h.owned(async tx=>{await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${tenantId},${`M3 historical images ${label}`})`;for(const who of ['A1','A2'])await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${tenantId},${h.fixtures.identities.find(i=>i.label===who)!.userId})`;await tx`INSERT INTO gcms_s07.worker_scope(tenant_id,enabled) VALUES(${tenantId},true)`;});
 const site=await h.call<SiteDraft>(`/api/tenants/${tenantId}/publication/site`,'PUT',{slug:tenantSlug,name:'M3 historical image fixture',footer:{intro:'',body:legacyDocument('Synthetic footer')},expectedVersion:0});expect(site.status).toBe(200);
 const bytes=await sharp({create:{width:24,height:16,channels:3,background:'#64859b'}}).png().toBuffer(),client=h.clients.get('A1')!,form=new FormData();form.set('operationId',assetId);form.set('materialKind',materialKind);form.set('file',new File([bytes],'synthetic-patient-scope.png',{type:'image/png'}));
 const response=await fetch(h.base+S07_ROUTES.media(tenantId),{method:'POST',headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie:client.headers.get('cookie')??'','x-csrf-token':h.identity.csrfToken(client.actor)},body:form,signal:AbortSignal.timeout(20000)});expect(response.status).toBe(201);const uploaded=await response.json() as MediaAsset;expect(uploaded.id).toBe(assetId);expect(uploaded.materialKind).toBe('patient_derived');expect(uploaded.state).toBe('processing');
 const worker=new MediaWorker(process.env.S07_WORKER_DATABASE_URL!);try{const result=await worker.runOnce(tenantId,1);expect(result.claimed).toBe(1);expect(result.completed).toBe(1);expect(result.failed).toBe(0);}finally{await worker.close();}
 const ready=await h.call<MediaAsset>(S07_ROUTES.asset(tenantId,assetId));expect(ready.status).toBe(200);expect(ready.value.state).toBe('ready');expect(ready.value.permission).toBeNull();expect(ready.value.publishable).toBe(false);
 const resources=[];
 for(const plan of plans){
  const content=h.content(plan.kind,{title:`M3 historical image ${label} ${plan.kind}`,image:{assetId,revision:ready.value.revision,alt:`Synthetic scoped ${plan.kind} image`}}),created=await h.call<ContentCommandResult>(M3_ROUTES.resources(tenantId,plan.kind),'POST',{operationId:plan.id,content});expect(created.status).toBe(201);let draft=created.value.draft;const path=M3_ROUTES.resource(tenantId,plan.kind,draft.id);
  const publication={operationId:plan.publish,expectedVersion:1,expectedPublicationVersion:0,expectedPublicationRevision:0,expectedSiteVersion:site.value.version};expect((await h.call(path+'/publish','POST',publication)).status).toBe(409);
  const granted=await h.call<ContentPermissionCommandResult>(path+'/permissions','POST',{operationId:plan.grant,expectedVersion:draft.version,revision:draft.version,scope:{type:'asset',assetId,assetRevision:ready.value.revision},evidenceReference:`Synthetic historical ${plan.kind} image scope`});expect(granted.status).toBe(200);expect(granted.value.permission.revision).toBe(1);await h.recordOwned({kind:'historical_image_permission',tenantId,resourceId:draft.id,id:granted.value.permission.id,revision:1});
  const published=await h.call<ContentCommandResult>(path+'/publish','POST',publication);expect(published.status).toBe(200);draft=published.value.draft;
  const publicPath=M3_ROUTES.publicDetail(tenantSlug,plan.kind,content.slug),page=await h.public<PublicContentPage>(publicPath);expect(page.status).toBe(200);expect(page.value.media).toHaveLength(1);const mediaPath=page.value.media[0].media.path,publicationId=page.value.publicationId;
  const saved=await h.call<ContentCommandResult>(path,'PUT',{operationId:plan.save,expectedVersion:draft.version,content:{...draft.content,image:null}});expect(saved.status).toBe(200);draft=saved.value.draft;expect(draft.version).toBe(2);expect(draft.activePublication).toBe(true);expect(draft.publishedVersion).toBe(1);expect(draft.content).toHaveProperty('image',null);
  const still=await h.public<PublicContentPage>(publicPath);expect(still.status).toBe(200);expect(still.value.publicationId).toBe(publicationId);expect(still.value.media[0].media.path).toBe(mediaPath);expect(still.value.content).toHaveProperty('image.assetId',assetId);const delivered=await fetch(h.base+mediaPath,{headers:{host:'127.0.0.1:5890'},signal:AbortSignal.timeout(12000)});expect(delivered.status).toBe(200);expect(delivered.headers.get('cache-control')).toContain('no-store');await delivered.arrayBuffer();
  resources.push({draft,permission:granted.value.permission,publicationId,mediaPath,publicPath,apiPath:path,cmsPath:`/cms/${plan.kind==='doctor'?'doctors':'articles'}/${draft.id}`});
 }
 return {tenantId,tenantSlug,asset:ready.value,resources};
}
