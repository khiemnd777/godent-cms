/** Fault process owns only the explicitly enrolled new test tenant/asset. */
import { MediaStorage, readMediaStorageConfig } from '../src/media/storage';
import { MediaWorker } from '../src/worker/media-worker';
const [tenant,asset]=process.argv.slice(2);
if(!/^[a-f0-9-]{36}$/.test(tenant??'')||!/^[a-f0-9-]{36}$/.test(asset??'')) throw new Error('Explicit new media fixture required');
class CrashAfterPrivateWrite extends MediaStorage {
  override async put(key:string,body:Uint8Array,type:'application/octet-stream'|'image/webp') {
    await super.put(key,body,type);
    if(key.startsWith(`derivative/${tenant}/${asset}/`)) process.exit(32);
  }
}
const worker=new MediaWorker(process.env.S07_WORKER_DATABASE_URL??'',new CrashAfterPrivateWrite(readMediaStorageConfig()));
try {
  await worker.verifyRole();const claim=await worker.claim(tenant);
  if(!claim||claim.assetId!==asset||claim.kind!=='process') throw new Error('Wrong owned media claim');
  await worker.process(claim);throw new Error('Crash fixture did not run');
} finally {await worker.close();}
