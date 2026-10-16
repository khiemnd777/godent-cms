import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { M5Harness } from '../apps/api/test/m5-support';
import { M4_ROUTES, type M4Variant, type M4CommandResult, type M4Content } from '../apps/api/src/contracts/m4';
import { S07_ROUTES, type MediaAsset } from '../apps/api/src/contracts/s07';
import { MediaWorker } from '../apps/api/src/worker/media-worker';
import { MediaStorage, readMediaStorageConfig } from '../apps/api/src/media/storage';
import { DockerMediaProcessor } from '../apps/api/src/media/processor';
import { selectM2WorkerEnvironment } from './start-m2-worker';
import { m5SyntheticPng } from './m5-synthetic-image';
import { legacyDocument } from '../apps/api/src/contracts/content';
import { readM5Fixtures } from './m5-fixtures';

const PATH='.local/m5-demo.json',OWNER='GCMS-M5-DEMO-v1';
export interface M5Demo {owner:typeof OWNER;fixtureRun:string;runId:string;status:'provisioning'|'complete';tenantId:string;tenantSlug:string;asset:{operationId:string;id:string|null;revision:number|null};entries:{key:'home'|'page'|'viOnly'|'service';kind:'home'|'page'|'service';id:string;slug:string;locales:('vi'|'en')[]}[]}
export async function readM5Demo(){const fixtures=await readM5Fixtures(),value=await Bun.file(PATH).json() as M5Demo,t=fixtures.tenants.find(t=>t.label==='A')!;assert.equal(value.owner,OWNER);assert.equal(value.fixtureRun,fixtures.runId);assert.equal(value.tenantId,t.id);assert.equal(value.tenantSlug,t.slug);assert.ok(['provisioning','complete'].includes(value.status));return value;}
async function save(d:M5Demo){const p=await readM5Demo();assert.equal(p.runId,d.runId);const tmp=PATH+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(d,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(tmp,PATH);}
async function main(){
 if(Bun.version!=='1.4.3'||!process.argv.includes('--local-m5')||!process.argv.includes('--synthetic-fixtures'))throw new Error('Explicit M5 synthetic local scope required');
 const fixtures=await readM5Fixtures(),t=fixtures.tenants.find(t=>t.label==='A')!;
 if(!await Bun.file(PATH).exists()){const runId=randomUUID();const d:M5Demo={owner:OWNER,fixtureRun:fixtures.runId,runId,status:'provisioning',tenantId:t.id,tenantSlug:t.slug,asset:{operationId:randomUUID(),id:null,revision:null},entries:[{key:'home',kind:'home',id:randomUUID(),slug:'home',locales:['vi','en']},{key:'page',kind:'page',id:randomUUID(),slug:`m5-demo-${runId.slice(0,8)}`,locales:['vi','en']},{key:'viOnly',kind:'page',id:randomUUID(),slug:`m5-vi-${runId.slice(0,8)}`,locales:['vi']},{key:'service',kind:'service',id:t.serviceId!,slug:t.serviceSlug,locales:['vi','en']}]};await writeFile(PATH,JSON.stringify(d,null,2)+'\n',{mode:0o600,flag:'wx'});}
 const d=await readM5Demo();if(d.status==='complete'){console.info(JSON.stringify({status:'PASS',phase:'existing_owned_m5_demo',reset:false}));return;}
 process.env.M5_INTEGRATION='1';const h=new M5Harness();await h.setup(['A1']);
 try{
  assert.equal((await h.status()).status,'active');assert.equal((await h.status()).policy.mode,'monitor');
  const png=await m5SyntheticPng(0),form=new FormData();form.set('operationId',d.asset.operationId);form.set('materialKind','ordinary');form.set('file',new File([new Uint8Array(png)],'m5-synthetic.png',{type:'image/png'}));
  if(!d.asset.id){const c=h.clients.get('A1')!,r=await fetch(h.base+S07_ROUTES.media(t.id),{method:'POST',headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie:c.headers.get('cookie')!,'x-csrf-token':h.identity.csrfToken(c.actor)},body:form,signal:AbortSignal.timeout(20000)});assert.equal(r.status,201);const asset=await r.json() as MediaAsset;d.asset.id=asset.id;d.asset.revision=asset.revision;await save(d);}
  let asset=(await h.call<MediaAsset>(S07_ROUTES.asset(t.id,d.asset.id))).value;
  if(asset.state!=='ready'){
   const config=Object.fromEntries((await readFile('.local/m2.env','utf8')).trim().split('\n').map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)];})),env=selectM2WorkerEnvironment('s07',config,process.env),worker=new MediaWorker(env.S07_WORKER_DATABASE_URL,new MediaStorage(readMediaStorageConfig(env)),new DockerMediaProcessor(env.S07_DECODER_IMAGE));
   try{await worker.verifyRole();const claim=await worker.claim(t.id);assert.equal(claim?.assetId,d.asset.id);assert.equal(claim?.kind,'process');assert.equal(await worker.process(claim!),'completed');}finally{await worker.close();}
   asset=(await h.call<MediaAsset>(S07_ROUTES.asset(t.id,d.asset.id))).value;
  }
  assert.equal(asset.state,'ready');d.asset.revision=asset.revision;await save(d);
  for(const locale of ['vi','en'] as const)await h.config(locale);
  async function read(item:M5Demo['entries'][number],locale:'vi'|'en'){return h.call<M4Variant>(M4_ROUTES.resource(t.id,item.kind,item.id,locale));}
  for(const item of [...d.entries.filter(e=>e.kind==='service'),...d.entries.filter(e=>e.kind!=='service')])for(const locale of item.locales){
   const en=locale==='en',title=en?`M5 ${item.key} synthetic`:`M5 ${item.key} minh họa`,image={assetId:d.asset.id!,revision:d.asset.revision!,alt:en?'Synthetic geometric illustration':'Hình khối tổng hợp minh họa'};
   let content:M4Content;
   if(item.kind==='service'){const original=await read(item,locale);assert.equal(original.status,200);content={...original.value.content,title,summary:en?'Synthetic local service.':'Dịch vụ tổng hợp local.',body:legacyDocument(en?'Synthetic local service content.':'Nội dung dịch vụ thử local.'),coverImage:image} as M4Content;}
   else{content={...h.content(item.kind,title),slug:item.slug,sections:[{id:'hero',type:'hero',hidden:false,title,text:en?'Synthetic content for local verification.':'Thông tin minh họa cho kiểm chứng local.',image,action:{label:en?'Explore service':'Xem dịch vụ',target:{kind:'service',id:t.serviceId!,locale},allowViFallback:false}},{id:'body',type:'rich_text',hidden:false,body:legacyDocument(en?'Published synthetic M5 content.':'Nội dung M5 tổng hợp đã xuất bản.')}]} as M4Content;}
   let current=await read(item,locale);
   if(current.status===404){const r=await h.call<M4CommandResult>(M4_ROUTES.resources(t.id,item.kind)+'?locale='+locale,'POST',{operationId:item.id,content});assert.equal(r.status,201);current={status:200,value:r.value.draft};}
   else{assert.equal(current.status,200);if(JSON.stringify(current.value.content)!==JSON.stringify(content)){const r=await h.call<M4CommandResult>(M4_ROUTES.resource(t.id,item.kind,item.id,locale),'PUT',{operationId:randomUUID(),expectedVersion:current.value.version,content,...(current.value.legacySource?.current?{expectedLegacyState:current.value.legacySource.current}:{})});assert.equal(r.status,200);current={status:200,value:r.value.draft};}}
   if(!current.value.activePublication||current.value.publishedVersion!==current.value.version)await h.publish(current.value);
  }
  for(const locale of ['vi','en'] as const){const current=await h.call<M4Variant>(M4_ROUTES.config(t.id,locale));assert.equal(current.status,200);const home=d.entries.find(e=>e.key==='home')!,page=d.entries.find(e=>e.key==='page')!;const content={...current.value.content,menu:[{id:'home',label:locale==='en'?'Home':'Trang chủ',target:{kind:'home',id:home.id,locale},allowViFallback:false},{id:'page',label:locale==='en'?'About':'Giới thiệu',target:{kind:'page',id:page.id,locale},allowViFallback:false},{id:'service',label:locale==='en'?'Service':'Dịch vụ',target:{kind:'service',id:t.serviceId!,locale},allowViFallback:false}]};const r=await h.call<M4CommandResult>(M4_ROUTES.config(t.id,locale),'PUT',{operationId:randomUUID(),expectedVersion:current.value.version,content});assert.equal(r.status,200);await h.publish(r.value.draft);}
  d.status='complete';await save(d);console.info(JSON.stringify({status:'PASS',newOwnedDemo:true,locales:['vi','en'],entries:d.entries.length,actualMediaProcessed:true,oldFixturesChanged:false}));
 }finally{await h.close();}
}
if(import.meta.main)void main().catch(async error=>{const e=error as {message?:string;code?:string;stack?:string};await writeFile(`.local/m5-demo-error-${Date.now()}.json`,JSON.stringify({message:e.message,code:e.code,stack:e.stack})+'\n',{mode:0o600,flag:'wx'});console.error(JSON.stringify({status:'FAIL',phase:'m5-demo',detailsRedacted:true}));process.exitCode=1;});
