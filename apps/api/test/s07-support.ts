import { expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { S05Harness, type TestSource } from './s05-support';
import { S07_ROUTES, MEDIA_LIMITS, type MediaAsset, type MediaKind } from '../src/contracts/s07';
import { MediaStorage, readMediaStorageConfig } from '../src/media/storage';
import { MediaWorker } from '../src/worker/media-worker';
import type { MediaProcessor } from '../src/media/processor';
import type { MediaRecoveryWriter } from '../src/worker/media-recovery';

export class S07Harness extends S05Harness {
  readonly sources:TestSource[]=[];readonly workers:MediaWorker[]=[];
  override async source(label:string) {
    const source=await super.source(`s07-${label}`);this.sources.push(source);
    await this.owned(tx=>tx`INSERT INTO gcms_s07.worker_scope(tenant_id,enabled) VALUES(${source.tenantId},true)`);
    // A distinct private manifest records new fixture ownership; canonical root manifest is preserved.
    await writeFile(`.local/s07-test-${this.run}.json`,JSON.stringify({runId:this.run,owner:'S07 integration',sources:this.sources},null,2)+'\n',{mode:0o600});
    return source;
  }
  worker(storage?:MediaStorage,processor?:MediaProcessor,recoveryWriter?:MediaRecoveryWriter) {
    const worker=new MediaWorker(process.env.S07_WORKER_DATABASE_URL!,storage??new MediaStorage(readMediaStorageConfig()),processor,recoveryWriter);
    this.workers.push(worker);return worker;
  }
  async upload(s:TestSource,body:Uint8Array,kind:MediaKind='ordinary',label='A1',operationId=randomUUID(),name='../../untrusted.svg') {
    const c=this.clients.get(label)!,form=new FormData();
    form.set('operationId',operationId);form.set('materialKind',kind);form.set('file',new File([body],name,{type:'image/png'}));
    const response=await fetch(this.base+S07_ROUTES.media(s.tenantId),{method:'POST',headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie:c.signed.headers.get('cookie')??'','x-csrf-token':c.csrf},body:form,signal:AbortSignal.timeout(20000)});
    return {status:response.status,value:await response.json() as MediaAsset};
  }
  async asset(s:TestSource,id:string) {const result=await this.call<MediaAsset>(S07_ROUTES.asset(s.tenantId,id));expect(result.status).toBe(200);return result.value;}
  async ready(s:TestSource,body?:Uint8Array,kind:MediaKind='ordinary') {
    const upload=await this.upload(s,body??await image('png'),kind);expect(upload.status).toBe(201);expect(upload.value.state).toBe('processing');
    const run=await this.worker().runOnce(s.tenantId);expect(run.completed).toBe(1);
    const asset=await this.asset(s,upload.value.id);expect(asset.state).toBe('ready');return asset;
  }
  async withdraw(s:TestSource,asset:MediaAsset) {
    const operationId=randomUUID(),body={expectedVersion:asset.version,operationId,reason:'Withdraw owned synthetic test material'};
    const response=await this.call<MediaAsset>(S07_ROUTES.withdrawal(s.tenantId,asset.id),'POST',body);expect(response.status).toBe(200);return {asset:response.value,body};
  }
  async due(s:TestSource) {await this.owned(tx=>tx`UPDATE gcms_s07.job SET available_at=clock_timestamp()-interval '1 second',lease_until=clock_timestamp()-interval '1 second' WHERE tenant_id=${s.tenantId}`);}
  override async close() {await Promise.all(this.workers.map(worker=>worker.close()));await super.close();}
}
export function image(type:'jpeg'|'png'|'webp') {return sharp({create:{width:24,height:16,channels:3,background:'#3377aa'}})[type]().toBuffer();}
export async function fiveMiBPng() {
  const png=await image('png'),length=MEDIA_LIMITS.bytes-png.length-12,chunk=Buffer.alloc(length+12,65);chunk.writeUInt32BE(length,0);chunk.write('tEXt',4);chunk.write('Note\0',8);
  let crc=0xffffffff;for(const byte of chunk.subarray(4,-4)) {crc^=byte;for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);return Buffer.concat([png.subarray(0,-12),chunk,png.subarray(-12)]);
}
