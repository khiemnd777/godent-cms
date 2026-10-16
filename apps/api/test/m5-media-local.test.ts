import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { M5Harness } from './m5-support';
import { MediaService } from '../src/modules/media.service';
import type { PrivateRequest } from '../src/modules/request-security';
import { safeError } from '../src/errors';
import { MediaStorage, readMediaStorageConfig } from '../src/media/storage';
import { MediaWorker } from '../src/worker/media-worker';
import { DockerMediaProcessor } from '../src/media/processor';
import { selectM2WorkerEnvironment } from '../../../scripts/start-m2-worker';
import { m5SyntheticPng } from '../../../scripts/m5-synthetic-image';
import { MediaSigner } from '../src/media/signing';
import { S07_ROUTES, type MediaAsset } from '../src/contracts/s07';

describe.skipIf(process.env.M5_INTEGRATION!=='1')('M5 actual media reservation, storage and scoped worker',()=>{
 const h=new M5Harness();let png:Buffer,worker:MediaWorker;
 beforeAll(async()=>{await h.setup(['A1','PlatformOnly']);png=await m5SyntheticPng(1);const config=Object.fromEntries((await readFile('.local/m2.env','utf8')).trim().split('\n').map(line=>{const n=line.indexOf('=');return[line.slice(0,n),line.slice(n+1)];})),env=selectM2WorkerEnvironment('s07',config,process.env);worker=new MediaWorker(env.S07_WORKER_DATABASE_URL,new MediaStorage(readMediaStorageConfig(env)),new DockerMediaProcessor(env.S07_DECODER_IMAGE));await worker.verifyRole();},30000);
 afterAll(async()=>{await worker?.close();await h.close();});
 async function upload(op:string,base=h.base){const c=h.clients.get('A1')!,form=new FormData();form.set('operationId',op);form.set('materialKind','ordinary');form.set('file',new File([new Uint8Array(png)],'m5-quota-synthetic.png',{type:'image/png'}));const r=await fetch(base+S07_ROUTES.media(h.tenant().id),{method:'POST',headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie:c.headers.get('cookie')!,'x-csrf-token':h.identity.csrfToken(c.actor)},body:form,signal:AbortSignal.timeout(20000)});return{status:r.status,value:await r.json() as MediaAsset&{code?:string;dimension?:string}};}
 test('concurrent uploads reserve once; retry does not grow usage; withdrawal frees only confirmed derivative bytes',async()=>{
  const before=(await h.status()).usage;await h.quota({mode:'enforced',contentItemsLimit:null,mediaBytesLimit:before.storedMediaBytes+before.reservedMediaBytes+png.byteLength+5242880});
  const ops=[randomUUID(),randomUUID(),randomUUID()],results=await Promise.all(ops.map(op=>upload(op))),index=results.findIndex(r=>r.status===201);expect(index).toBeGreaterThanOrEqual(0);expect(results.filter(r=>r.status===201)).toHaveLength(1);for(const denied of results.filter(r=>r.status!==201)){expect(denied.status).toBe(409);expect(denied.value.code).toBe('QUOTA_EXCEEDED');expect(denied.value.dimension).toBe('media_bytes');}
  const asset=results[index].value;await h.record({kind:'media-quota',id:asset.id});const reserved=(await h.status()).usage;expect(reserved.storedMediaBytes).toBe(before.storedMediaBytes+png.byteLength);expect(reserved.reservedMediaBytes).toBe(before.reservedMediaBytes+5242880);expect((await upload(ops[index])).value.id).toBe(asset.id);expect((await h.status()).usage).toEqual(reserved);
  const claim=await worker.claim(h.tenant().id);expect(claim?.assetId).toBe(asset.id);expect(await worker.process(claim!)).toBe('completed');const ready=await h.call<MediaAsset>(S07_ROUTES.asset(h.tenant().id,asset.id));expect(ready.value.state).toBe('ready');const processed=(await h.status()).usage;expect(processed.reservedMediaBytes).toBe(before.reservedMediaBytes);expect(processed.storedMediaBytes).toBeGreaterThan(before.storedMediaBytes+png.byteLength);
  await h.lifecycle('suspend');const withdrawal=await h.call<MediaAsset>(S07_ROUTES.withdrawal(h.tenant().id,asset.id),'POST',{operationId:randomUUID(),expectedVersion:ready.value.version,reason:'Owned M5 suspended safety withdrawal'});expect(withdrawal.status).toBe(200);expect(withdrawal.value.state).toBe('withdrawn');expect((await h.status()).usage).toEqual(processed);
  const purge=await worker.claim(h.tenant().id);expect(purge?.assetId).toBe(asset.id);expect(purge?.kind).toBe('purge');expect(await worker.process(purge!)).toBe('completed');const after=(await h.status()).usage;expect(after.storedMediaBytes).toBe(before.storedMediaBytes+png.byteLength);expect(after.reservedMediaBytes).toBe(before.reservedMediaBytes);await h.lifecycle('reactivate');await h.quota({mode:'monitor',contentItemsLimit:null,mediaBytesLimit:null});
 },60000);
 test('lost PUT acknowledgement keeps reservation until idempotent retry confirms storage',async()=>{
  const before=(await h.status()).usage,op=randomUUID();class LostAcknowledgementStorage extends MediaStorage{override async put(...args:Parameters<MediaStorage['put']>){await super.put(...args);throw new Error('Synthetic response lost after actual PUT and HEAD');}}
  const storage=new LostAcknowledgementStorage(readMediaStorageConfig()),service=new MediaService(h.db,h.identity,storage,new MediaSigner(process.env.S07_MEDIA_SIGNING_SECRET!));
  const server=createServer((req:IncomingMessage,res:ServerResponse)=>{Object.assign(req,{originalUrl:S07_ROUTES.media(h.tenant().id)});void service.upload(req as IncomingMessage&PrivateRequest,h.tenant().id).then(value=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(value));}).catch(error=>{const body=safeError(error);res.statusCode=body.statusCode;res.setHeader('content-type','application/json');res.end(JSON.stringify(body));});});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Missing owned test listener');
  try{expect((await upload(op,'http://127.0.0.1:'+address.port)).status).toBe(503);const uncertain=(await h.status()).usage;expect(uncertain.storedMediaBytes).toBe(before.storedMediaBytes);expect(uncertain.reservedMediaBytes).toBe(before.reservedMediaBytes+png.byteLength+5242880);
   const resumed=await upload(op);expect(resumed.status).toBe(201);expect(resumed.value.state).toBe('processing');await h.record({kind:'media-put-retry',id:resumed.value.id});const settled=(await h.status()).usage;expect(settled.storedMediaBytes).toBe(before.storedMediaBytes+png.byteLength);expect(settled.reservedMediaBytes).toBe(before.reservedMediaBytes+5242880);const claim=await worker.claim(h.tenant().id);expect(claim?.assetId).toBe(resumed.value.id);expect(await worker.process(claim!)).toBe('completed');
  }finally{storage.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
 },60000);
});
