import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { S07_ROUTES, type MediaAsset, type MediaAccessResult } from '../src/contracts/s07';
import { S03_ROUTES, type PublicationResult, type PublicationService, type PublicServicePage } from '../src/contracts/s03';
import { legacyDocument } from '../src/contracts/content';
import { DecoderSettlementUnknown, DockerMediaProcessor } from '../src/media/processor';
import { MediaStorage, readMediaStorageConfig } from '../src/media/storage';
import { postgresCode } from '../src/database';
import { S07Harness, image, fiveMiBPng } from './s07-support';
import type { TestSource } from './s05-support';
import { MediaSigner } from '../src/media/signing';
import { openFixtureSession } from '../../../scripts/s02-fixtures';
import type { CurrentSession } from '../src/contracts/s02';
import { PublicationServiceOperations } from '../src/modules/publication.service';

const h=new S07Harness();let raw:SQL;
function delivery(path:string,label?:string) {
  const url=new URL(path,'http://127.0.0.1:5890');
  return fetch(h.base+url.pathname+url.search,{headers:{host:'127.0.0.1:5890',...(label?{cookie:h.clients.get(label)!.signed.headers.get('cookie')??''}:{})},signal:AbortSignal.timeout(12000)});
}
async function access(s:TestSource,a:MediaAsset,variant:'cover'|'original') {
  const response=await h.call<MediaAccessResult>(S07_ROUTES.access(s.tenantId,a.id),'POST',{revision:a.revision,variant,purpose:'admin_preview'});expect(response.status).toBe(200);return response.value;
}
async function publish(s:TestSource,a:MediaAsset,alt='S07 private synthetic alt') {
  const base=S03_ROUTES.service(s.tenantId,s.serviceId),current=await h.call<PublicationService>(base);
  const saved=await h.call<PublicationService>(base,'PUT',{slug:s.serviceSlug,title:'S07 service with optional image',summary:'',body:legacyDocument('S07 public text'),seo:{title:'',description:''},coverImage:{assetId:a.id,revision:a.revision,alt},expectedDraftVersion:current.value.draftVersion});expect(saved.status).toBe(200);
  const publication=await h.call<PublicationResult>(base+'/publish','POST',{expectedDraftVersion:saved.value.draftVersion,expectedSiteVersion:saved.value.siteVersion,expectedPublicationVersion:saved.value.publicationVersion,expectedPublicationRevision:saved.value.publicationRevision,requestKey:randomUUID()});expect(publication.status).toBe(200);
  return publication.value;
}
async function publicPage(s:TestSource) {const response=await delivery(S03_ROUTES.publicService(s.tenantSlug,s.serviceSlug));expect(response.status).toBe(200);return await response.json() as PublicServicePage;}

describe.skipIf(process.env.S07_INTEGRATION!=='1')('S07 actual HTTP PostgreSQL private S3 and isolated Bun decoder',()=>{
  beforeAll(async()=>{await h.setup();raw=new SQL(process.env.S07_WORKER_DATABASE_URL!,{max:2,connectionTimeout:3});},120000);
  afterAll(async()=>{await raw?.close();await h.close();});
  test('narrow worker cannot read private/auth/media tables, perform direct DML or claim an unselected tenant',async()=>{
    const worker=h.worker();await worker.verifyRole();
    for(const statement of ['SELECT * FROM gcms_s07.asset','SELECT * FROM gcms_s02_auth."user"','SELECT * FROM gcms_s04.lead',"UPDATE gcms_s07.asset SET state='ready'"]) {
      let denied=false;try{await raw.unsafe(statement);}catch(error){denied=postgresCode(error)==='42501';}expect(denied).toBe(true);
    }
    let denied=false;try{await worker.claim(randomUUID());}catch(error){denied=postgresCode(error)==='42501';}expect(denied).toBe(true);
    const binding=await raw`SELECT jsonb_typeof(${JSON.stringify({outcome:'retry'})}::text::jsonb) AS shape`;expect(binding[0].shape).toBe('object');
  });
  test('multipart upload retains origin CSRF tenant and exact field boundaries',async()=>{
    const s=await h.source('upload-security'),cookie=h.clients.get('A1')!.signed.headers.get('cookie')??'';
    function form(extra=false) {const value=new FormData();value.set('operationId',randomUUID());value.set('materialKind','ordinary');value.set('file',new File([Buffer.from('ffd8ffdb','hex')],'../../private.png'));if(extra)value.set('remoteUrl','https://example.test/private');return value;}
    const missing=await fetch(h.base+S07_ROUTES.media(s.tenantId),{method:'POST',headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie},body:form()});expect(missing.status).toBe(403);
    const origin=await fetch(h.base+S07_ROUTES.media(s.tenantId),{method:'POST',headers:{host:'127.0.0.1:5890',origin:'https://example.test',cookie,'x-csrf-token':h.clients.get('A1')!.csrf},body:form()});expect(origin.status).toBe(403);
    const fields=await fetch(h.base+S07_ROUTES.media(s.tenantId),{method:'POST',headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie,'x-csrf-token':h.clients.get('A1')!.csrf},body:form(true)});expect(fields.status).toBe(400);
    expect((await h.upload(s,await image('png'),'ordinary','B1')).status).toBe(403);expect((await h.upload(s,await image('png'),'ordinary','PlatformOnly')).status).toBe(403);
    const rows=await h.owned(tx=>tx`SELECT count(*)::integer AS count FROM gcms_s07.asset WHERE tenant_id=${s.tenantId}`);expect(rows[0].count).toBe(0);
  });
  test('three formats use real private objects; names cannot select keys; current signed routes protect original and cover',async()=>{
    const s=await h.source('formats');
    for(const type of ['jpeg','png','webp'] as const) {
      const asset=await h.ready(s,await image(type));expect(asset.detectedType).toBe(type);expect(asset.publishable).toBe(true);
      const original=await access(s,asset,'original'),cover=await access(s,asset,'cover');
      expect(new Date(original.expiresAt).getTime()-Date.now()).toBeLessThanOrEqual(60_000);
      const signed=await delivery(original.url,'A1');expect(signed.status).toBe(200);expect(signed.headers.get('content-type')).toBe(`image/${type}`);expect(signed.headers.get('content-disposition')).toContain('attachment');
      expect(Buffer.from(await signed.arrayBuffer())).toEqual(await image(type));
      expect((await delivery(cover.url,'A1')).status).toBe(200);
      expect((await delivery(original.url)).status).toBe(401);expect((await delivery(original.url,'A2')).status).toBe(403);
      expect((await h.call(S07_ROUTES.asset(s.tenantId,asset.id),'GET',undefined,'B1')).status).toBe(403);
      expect((await h.call(S07_ROUTES.asset(s.tenantId,asset.id),'GET',undefined,'PlatformOnly')).status).toBe(403);
      const config=readMediaStorageConfig();
      for(const key of [`original/${s.tenantId}/${asset.id}`,(await h.owned(tx=>tx`SELECT object_key FROM gcms_s07.derivative WHERE tenant_id=${s.tenantId} AND asset_id=${asset.id} AND ready`))[0].object_key]) {
        const response=await fetch(`${config.endpoint}${config.bucket}/${String(key)}`,{signal:AbortSignal.timeout(5000)});expect([401,403]).toContain(response.status);
      }
      expect((await delivery(S07_ROUTES.publicDerivative(s.tenantId,asset.id,asset.revision))).status).toBe(404);
    }
  },120000);
  test('accepts exactly five MiB, rejects one byte more, unsupported imports and identical-operation payload substitution',async()=>{
    const s=await h.source('byte-boundary'),input=await fiveMiBPng(),operation=randomUUID();
    const accepted=await h.upload(s,input,'ordinary','A1',operation);expect(accepted.status).toBe(201);
    expect((await h.upload(s,input,'ordinary','A1',operation)).value.id).toBe(accepted.value.id);
    expect((await h.upload(s,await image('png'),'ordinary','A1',operation)).status).toBe(409);
    expect((await h.upload(s,Buffer.concat([input,Buffer.from([0])]))).status).toBe(413);
    expect((await h.upload(s,Buffer.from('<svg/>'))).status).toBe(415);
    expect((await h.upload(s,Buffer.from('https://example.test/a.png'))).status).toBe(415);
    expect((await h.worker().runOnce(s.tenantId)).completed).toBe(1);expect((await h.asset(s,accepted.value.id)).state).toBe('ready');
  },120000);
  test('real processing rejects malformed, oversized and animated inputs without producing ready assets',async()=>{
    const s=await h.source('reject');
    const oversized=await (await import('sharp')).default({create:{width:8193,height:1,channels:3,background:'red'}}).png().toBuffer();
    const animated=await (await import('sharp')).default(Buffer.from([255,0,0,255,0,255,0,255]),{raw:{width:1,height:2,channels:4,pageHeight:1}}).webp({loop:0}).toBuffer();
    for(const input of [Buffer.from('ffd8ffdb','hex'),(await image('png')).subarray(0,40),oversized,animated]) {
      const uploaded=await h.upload(s,input);expect(uploaded.status).toBe(201);expect((await h.worker().runOnce(s.tenantId)).completed).toBe(1);
      const asset=await h.asset(s,uploaded.value.id);expect(asset.state).toBe('rejected');expect(asset.publishable).toBe(false);expect(asset.processing?.status).toBe('completed');
    }
  },120000);
  test('signed access expires, rejects tampering and a different same-user session, and stops after normal sign-out',async()=>{
    const s=await h.source('token-boundaries'),asset=await h.ready(s),issued=await access(s,asset,'original');
    const claims={tenantId:s.tenantId,assetId:asset.id,revision:asset.revision,variant:'original' as const,purpose:'admin_preview' as const,userId:h.clients.get('A1')!.signed.actor.userId,sessionId:h.clients.get('A1')!.signed.actor.sessionId};
    const expired=new MediaSigner(process.env.S07_MEDIA_SIGNING_SECRET!).issue(claims,Date.now()-60_001);
    expect((await delivery(`/api/media/access?token=${expired.token}`,'A1')).status).toBe(403);
    expect((await delivery(issued.url+'x','A1')).status).toBe(403);
    const transport=(r:Request)=>fetch(h.base+new URL(r.url).pathname,{method:r.method,headers:{...Object.fromEntries(r.headers),host:'127.0.0.1:5890'},body:r.body,signal:AbortSignal.timeout(12000)});
    const fresh=await openFixtureSession(h.identity,'A1',transport),cookie=fresh.headers.get('cookie')??'';
    const read=(url:string)=>{const parsed=new URL(url);return fetch(h.base+parsed.pathname+parsed.search,{headers:{host:'127.0.0.1:5890',cookie},signal:AbortSignal.timeout(12000)});};
    expect((await read(issued.url)).status).toBe(403);
    const current=await fetch(h.base+'/api/session',{headers:{host:'127.0.0.1:5890',cookie}}),csrf=(await current.json() as CurrentSession).csrfToken;
    const response=await fetch(h.base+S07_ROUTES.access(s.tenantId,asset.id),{method:'POST',headers:{host:'127.0.0.1:5890',cookie,origin:'http://127.0.0.1:5891','content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({revision:asset.revision,variant:'original',purpose:'admin_preview'})});expect(response.status).toBe(200);
    const token=await response.json() as MediaAccessResult;expect((await read(token.url)).status).toBe(200);expect((await fresh.call('/sign-out',{})).status).toBe(200);expect((await read(token.url)).status).toBe(401);
  },120000);
  test('patient-derived permission is scoped, idempotent and required; withdrawal wins live closure, signed tokens and history state',async()=>{
    const s=await h.source('permission'),asset=await h.ready(s,undefined,'patient_derived');expect(asset.publishable).toBe(false);
    const servicePath=S03_ROUTES.service(s.tenantId,s.serviceId),current=(await h.call<PublicationService>(servicePath)).value;
    const draft=await h.call<PublicationService>(servicePath,'PUT',{slug:s.serviceSlug,title:'Patient-derived synthetic material',summary:'',body:legacyDocument('Synthetic source'),seo:{title:'',description:''},coverImage:{assetId:asset.id,revision:asset.revision,alt:'Synthetic image'},expectedDraftVersion:current.draftVersion});expect(draft.status).toBe(200);
    const blocked=await h.call(servicePath+'/publish','POST',{expectedDraftVersion:draft.value.draftVersion,expectedSiteVersion:draft.value.siteVersion,expectedPublicationVersion:draft.value.publicationVersion,expectedPublicationRevision:draft.value.publicationRevision,requestKey:randomUUID()});expect(blocked.status).toBe(409);
    const permission={operationId:randomUUID(),expectedVersion:asset.version,scope:'service_cover',evidenceReference:'Synthetic signed permission record; no real patient'};
    const granted=await h.call<MediaAsset>(S07_ROUTES.permission(s.tenantId,asset.id),'POST',permission);expect(granted.status).toBe(200);expect(granted.value.publishable).toBe(true);
    const replay=await h.call<MediaAsset>(S07_ROUTES.permission(s.tenantId,asset.id),'POST',permission);expect(replay.status).toBe(200);expect(replay.value.version).toBe(granted.value.version);
    const token=await access(s,granted.value,'cover');await publish(s,granted.value);const page=await publicPage(s);expect(JSON.stringify(page)).toContain(asset.id);
    const path=S07_ROUTES.publicDerivative(s.tenantId,asset.id,asset.revision);expect((await delivery(path)).status).toBe(200);
    const start=Date.now(),withdrawn=await h.withdraw(s,granted.value);expect(withdrawn.asset.state).toBe('withdrawn');expect(withdrawn.asset.publishable).toBe(false);
    expect((await delivery(path)).status).toBe(404);expect((await delivery(token.url,'A1')).status).toBe(404);expect(Date.now()-start).toBeLessThan(60_000);
    expect(JSON.stringify(await publicPage(s))).not.toContain(asset.id);expect(JSON.stringify(await publicPage(s))).not.toContain('S07 private synthetic alt');
    const replayWithdraw=await h.call<MediaAsset>(S07_ROUTES.withdrawal(s.tenantId,asset.id),'POST',withdrawn.body);expect(replayWithdraw.status).toBe(200);expect(replayWithdraw.value.version).toBe(withdrawn.asset.version);
    await h.owned(tx=>tx`UPDATE gcms_s07.asset SET state='ready',revision=1,withdrawn_at=NULL WHERE tenant_id=${s.tenantId} AND id=${asset.id}`);
    const restored=await h.asset(s,asset.id);expect(restored.state).toBe('withdrawn');expect(restored.publishable).toBe(false);expect(restored.revision).toBe(withdrawn.asset.revision);
    expect((await delivery(path)).status).toBe(404);
  },120000);
  test('public media follows current site eligibility and cross-tenant image references reject even for a shared administrator',async()=>{
    const s=await h.source('public-eligibility'),other=await h.source('reference-other'),asset=await h.ready(s);await publish(s,asset);
    const path=S07_ROUTES.publicDerivative(s.tenantId,asset.id,asset.revision);expect((await delivery(path)).status).toBe(200);
    const servicePath=S03_ROUTES.service(other.tenantId,other.serviceId),draft=(await h.call<PublicationService>(servicePath)).value;
    const cross=await h.call(servicePath,'PUT',{slug:other.serviceSlug,title:'Cross-tenant reference rejected',summary:'',body:legacyDocument('Synthetic'),seo:{title:'',description:''},coverImage:{assetId:asset.id,revision:asset.revision,alt:'Other tenant image'},expectedDraftVersion:draft.draftVersion});expect(cross.status).toBe(409);
    await h.owned(tx=>tx`UPDATE gcms_s02.site_draft SET public_enabled=false WHERE tenant_id=${s.tenantId}`);expect((await delivery(path)).status).toBe(404);
    await h.owned(tx=>tx`UPDATE gcms_s02.site_draft SET public_enabled=true WHERE tenant_id=${s.tenantId}`);expect((await delivery(path)).status).toBe(200);
  },120000);
  test('a concurrent publish after the first public query cannot mix an old page with the newer cover',async()=>{
    const s=await h.source('public-snapshot-race'),cover1=await h.ready(s,await image('png')),cover2=await h.ready(s,await image('jpeg'));
    const publication1=await publish(s,cover1,'Cover one immutable alt'),base=S03_ROUTES.service(s.tenantId,s.serviceId),current=(await h.call<PublicationService>(base)).value;
    const prepared=await h.call<PublicationService>(base,'PUT',{slug:s.serviceSlug,title:'Second publication with cover two',summary:'',body:legacyDocument('Second immutable public content'),seo:{title:'',description:''},coverImage:{assetId:cover2.id,revision:cover2.revision,alt:'Cover two immutable alt'},expectedDraftVersion:current.draftVersion});expect(prepared.status).toBe(200);
    const publish2={expectedDraftVersion:prepared.value.draftVersion,expectedSiteVersion:prepared.value.siteVersion,expectedPublicationVersion:prepared.value.publicationVersion,expectedPublicationRevision:prepared.value.publicationRevision,requestKey:randomUUID()};
    const operations=new PublicationServiceOperations(h.db,h.identity),original=h.db.tenantDb.execute;let intercepted=false,publication2:PublicationResult|undefined;
    h.db.tenantDb.execute=(async(...args:Parameters<typeof original>)=>{
      const result=await original.apply(h.db.tenantDb,args);
      if(!intercepted) {
        intercepted=true;
        // This HTTP request uses the app's separate DB instance and commits before the original read returns.
        const response=await h.call<PublicationResult>(base+'/publish','POST',publish2);expect(response.status).toBe(200);publication2=response.value;
      }
      return result;
    }) as unknown as typeof original;
    let first:PublicServicePage;
    try {first=await operations.publicRead({method:'GET',originalUrl:S03_ROUTES.publicService(s.tenantSlug,s.serviceSlug),headers:{host:'127.0.0.1:5890'}},s.tenantSlug,s.serviceSlug);}
    finally {h.db.tenantDb.execute=original;}
    expect(intercepted).toBe(true);expect(publication2).toBeDefined();expect(first.publicationId).toBe(publication1.publicationId);
    expect(first.service.coverImage).toEqual({assetId:cover1.id,revision:cover1.revision,alt:'Cover one immutable alt'});
    expect(first.coverMedia).toMatchObject({assetId:cover1.id,revision:cover1.revision,alt:'Cover one immutable alt',path:S07_ROUTES.publicDerivative(s.tenantId,cover1.id,cover1.revision)});
    const latest=await publicPage(s);expect(latest.publicationId).toBe(publication2!.publicationId);expect(latest.service.title).toBe('Second publication with cover two');
    expect(latest.service.coverImage).toEqual({assetId:cover2.id,revision:cover2.revision,alt:'Cover two immutable alt'});
    expect(latest.coverMedia).toMatchObject({assetId:cover2.id,revision:cover2.revision,alt:'Cover two immutable alt',path:S07_ROUTES.publicDerivative(s.tenantId,cover2.id,cover2.revision)});
  },120000);
  test('purge fails visibly on real storage outage, retries without regrant, deletes actual derivatives within five minutes and keeps originals',async()=>{
    const s=await h.source('purge'),asset=await h.ready(s),objects=await h.owned(tx=>tx`SELECT object_key,bytes FROM gcms_s07.derivative WHERE tenant_id=${s.tenantId} AND asset_id=${asset.id} AND ready`);
    const {asset:withdrawn}=await h.withdraw(s,asset),start=Date.now();
    const bad=new MediaStorage({...readMediaStorageConfig(),endpoint:'http://127.0.0.1:1/'});
    await h.owned(tx=>tx`UPDATE gcms_s07.job SET attempts=4 WHERE tenant_id=${s.tenantId} AND asset_id=${asset.id} AND kind='purge'`);
    expect((await h.worker(bad).runOnce(s.tenantId)).failed).toBe(1);
    const failed=await h.asset(s,asset.id);expect(failed.purge?.status).toBe('failed');expect(failed.purge?.failureCode).toBe('storage_failure');expect(failed.publishable).toBe(false);
    const retry=await h.call<MediaAsset>(S07_ROUTES.retry(s.tenantId,asset.id),'POST',{operationId:randomUUID(),expectedVersion:withdrawn.version});expect(retry.status).toBe(200);expect(retry.value.purge?.status).toBe('pending');expect(retry.value.publishable).toBe(false);
    expect((await h.worker().runOnce(s.tenantId)).completed).toBe(1);const finished=await h.asset(s,asset.id);expect(finished.purge?.status).toBe('completed');expect(Date.now()-start).toBeLessThan(300_000);
    const storage=new MediaStorage(readMediaStorageConfig());try {
      for(const target of objects) await expect(storage.get(String(target.object_key),Number(target.bytes))).rejects.toThrow();
      expect((await storage.get(`original/${s.tenantId}/${asset.id}`,asset.bytes)).byteLength).toBe(asset.bytes);
    } finally {storage.close();}
    const receipts=await h.owned(tx=>tx`SELECT deleted_at FROM gcms_s07.derivative WHERE tenant_id=${s.tenantId} AND asset_id=${asset.id}`);expect(receipts.every((r:Record<string,unknown>)=>r.deleted_at!==null)).toBe(true);
  },120000);
  test('withdrawal during actual processing prevents stale regrant; a second worker cannot purge before late private write settles',async()=>{
    const s=await h.source('withdraw-race'),uploaded=await h.upload(s,await image('png'));expect(uploaded.status).toBe(201);
    let release!:()=>void,started!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;}),observed=new Promise<void>(resolve=>{started=resolve;});
    const decoder=new DockerMediaProcessor(),worker=h.worker(undefined,{async process(input){const decoded=await decoder.process(input);started();await barrier;return decoded;}});
    const claim=await worker.claim(s.tenantId);expect(claim).not.toBeNull();const running=worker.process(claim!);await observed;
    const current=await h.asset(s,uploaded.value.id);await h.withdraw(s,current);expect(await h.worker().claim(s.tenantId)).toBeNull();
    release();expect(await running).toBe('failed');expect((await h.asset(s,uploaded.value.id)).state).toBe('withdrawn');
    expect((await h.worker().runOnce(s.tenantId)).completed).toBe(1);
    const records=await h.owned(tx=>tx`SELECT ready,deleted_at FROM gcms_s07.derivative WHERE tenant_id=${s.tenantId} AND asset_id=${uploaded.value.id}`);
    expect(records.length).toBe(1);expect(records[0].ready).toBe(false);expect(records[0].deleted_at).not.toBeNull();
  },120000);
  test('a checksum-bound upload written before DB finish is reconciled by the enrolled worker after a simulated crash',async()=>{
    const s=await h.source('upload-crash'),bytes=await image('png'),checksum=createHash('sha256').update(bytes).digest('hex'),id=randomUUID(),actor=h.clients.get('A1')!.signed.actor;
    await h.db.withTenant(actor,s.tenantId,tx=>tx.execute(sql`SELECT gcms_s07.reserve_upload(${s.tenantId},${id},${checksum},${bytes.length},'ordinary')`));
    const storage=new MediaStorage(readMediaStorageConfig());try{await storage.put(`original/${s.tenantId}/${id}`,bytes,'application/octet-stream');}finally{storage.close();}
    await h.owned(tx=>tx`UPDATE gcms_s07.asset SET created_at=clock_timestamp()-interval '31 seconds' WHERE tenant_id=${s.tenantId} AND id=${id}`);
    expect((await h.worker().runOnce(s.tenantId)).completed).toBe(1);expect((await h.asset(s,id)).state).toBe('ready');
  },120000);
  test('a worker process crash after private derivative write is fenced on restart; withdrawal purges every actual reserved generation',async()=>{
    const s=await h.source('worker-crash'),uploaded=await h.upload(s,await image('png'));expect(uploaded.status).toBe(201);
    const env:Record<string,string>={};
    for(const name of ['PATH','HOME','TMPDIR','S07_WORKER_DATABASE_URL','S07_MEDIA_BUCKET','S07_STORAGE_ACCESS_KEY_ID','S07_STORAGE_SECRET_ACCESS_KEY','S07_DECODER_IMAGE','S3_ENDPOINT','S3_REGION']) if(process.env[name]) env[name]=process.env[name]!;
    const child=Bun.spawn([process.execPath,'--no-env-file','apps/api/test/s07-worker-process.ts',s.tenantId,uploaded.value.id],{env,stdout:'ignore',stderr:'ignore'});expect(await child.exited).toBe(32);
    const reserved=await h.owned(tx=>tx`SELECT object_key,ready FROM gcms_s07.derivative WHERE tenant_id=${s.tenantId} AND asset_id=${uploaded.value.id}`);expect(reserved.length).toBe(1);expect(reserved[0].ready).toBe(false);
    await h.due(s);const replacement=h.worker(),deadline=Date.now()+5000;let completed=0;
    do {completed=(await replacement.runOnce(s.tenantId)).completed;if(!completed) await Bun.sleep(50);} while(!completed&&Date.now()<deadline);
    expect(completed).toBe(1);const ready=await h.asset(s,uploaded.value.id);expect(ready.state).toBe('ready');
    const generations=await h.owned(tx=>tx`SELECT object_key FROM gcms_s07.derivative WHERE tenant_id=${s.tenantId} AND asset_id=${ready.id}`);expect(generations.length).toBe(2);
    await h.withdraw(s,ready);expect((await h.worker().runOnce(s.tenantId)).completed).toBe(1);
    const purged=await h.owned(tx=>tx`SELECT deleted_at FROM gcms_s07.derivative WHERE tenant_id=${s.tenantId} AND asset_id=${ready.id}`);expect(purged.every((r:Record<string,unknown>)=>r.deleted_at!==null)).toBe(true);
  },120000);
  test('unconfirmed decoder settlement durably halts fresh native work before releasing its lock; ordinary retry cannot resume it',async()=>{
    const s=await h.source('decoder-unknown'),first=await h.upload(s,await image('png')),second=await h.upload(s,await image('png'));expect(first.status).toBe(201);expect(second.status).toBe(201);
    // Synthetic identity proves actual database/receipt correlation. Actual Docker identity proof is the lifecycle suite.
    const nonce=randomUUID(),failure=new DecoderSettlementUnknown('Owned injected control failure',{id:'a'.repeat(64),name:`gcms-s07-decoder-${nonce}`,nonce});
    let attempts=0;const worker=h.worker(undefined,{async process(){attempts++;throw failure;}});
    await expect(worker.runOnce(s.tenantId)).rejects.toBe(failure);expect(attempts).toBe(1);
    expect(failure.recovery?.blocked).toBe(true);expect(failure.recovery?.receiptPath).toBeString();
    const receiptPath=failure.recovery!.receiptPath!,receipt=JSON.parse(await readFile(receiptPath,'utf8'));
    expect(receipt).toMatchObject({tenantId:s.tenantId,workerId:worker.workerId,errorId:failure.errorId,container:failure.container,state:'native_blocked'});
    expect((await lstat(receiptPath)).mode&0o777).toBe(0o600);
    const scope=await h.owned(tx=>tx`SELECT native_blocked FROM gcms_s07.worker_scope WHERE tenant_id=${s.tenantId}`);expect(scope[0].native_blocked).toBe(true);
    const jobs=await h.owned(tx=>tx`SELECT id,asset_id,fence,status,failure_code FROM gcms_s07.job WHERE tenant_id=${s.tenantId} ORDER BY status`);
    const failed=jobs.find((j:Record<string,unknown>)=>j.status==='failed');expect(failed).toBeDefined();expect(failed!.failure_code).toBe('decoder_settlement_unknown');expect(jobs.filter((j:Record<string,unknown>)=>j.status==='pending').length).toBe(1);
    expect(receipt).toMatchObject({jobId:failed!.id,assetId:failed!.asset_id,fence:failed!.fence});
    const replacement=h.worker();await h.due(s);expect(await replacement.claim(s.tenantId)).toBeNull();
    const asset=await h.asset(s,String(failed!.asset_id)),retry=await h.call(S07_ROUTES.retry(s.tenantId,asset.id),'POST',{expectedVersion:asset.version,operationId:randomUUID()});expect(retry.status).toBe(409);
    expect((await h.asset(s,asset.id)).processing?.failureCode).toBe('decoder_settlement_unknown');expect(await replacement.claim(s.tenantId)).toBeNull();
    await h.withdraw(s,asset);expect((await replacement.runOnce(s.tenantId)).completed).toBe(1);expect(await replacement.claim(s.tenantId)).toBeNull();
    const after=await h.owned(tx=>tx`SELECT native_blocked FROM gcms_s07.worker_scope WHERE tenant_id=${s.tenantId}`);expect(after[0].native_blocked).toBe(true);expect(attempts).toBe(1);
  },120000);
  test('a failed recovery receipt write cannot clear the durable native block or continue the batch',async()=>{
    const s=await h.source('decoder-receipt-failure');expect((await h.upload(s,await image('png'))).status).toBe(201);expect((await h.upload(s,await image('png'))).status).toBe(201);
    const nonce=randomUUID(),failure=new DecoderSettlementUnknown('Owned injected control failure',{id:'b'.repeat(64),name:`gcms-s07-decoder-${nonce}`,nonce});let attempts=0,writes=0;
    const worker=h.worker(undefined,{async process(){attempts++;throw failure;}},async()=>{writes++;throw new Error('Owned receipt-write fault');});
    await expect(worker.runOnce(s.tenantId)).rejects.toBe(failure);expect(attempts).toBe(1);expect(writes).toBe(1);
    expect(failure.recovery).toEqual({blocked:true,receiptPath:null});
    const scope=await h.owned(tx=>tx`SELECT native_blocked FROM gcms_s07.worker_scope WHERE tenant_id=${s.tenantId}`);expect(scope[0].native_blocked).toBe(true);
    const jobs=await h.owned(tx=>tx`SELECT status,failure_code FROM gcms_s07.job WHERE tenant_id=${s.tenantId}`);
    expect(jobs.filter((j:Record<string,unknown>)=>j.status==='failed'&&j.failure_code==='decoder_settlement_unknown').length).toBe(1);expect(jobs.filter((j:Record<string,unknown>)=>j.status==='pending').length).toBe(1);
    await h.due(s);expect(await h.worker().claim(s.tenantId)).toBeNull();expect(attempts).toBe(1);
  },120000);
});
