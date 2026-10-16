import {ContentPurgeWorker} from './content-purge-worker';
import {assertIsolatedMediaWorkerEnvironment} from './media-environment';
async function main(){assertIsolatedMediaWorkerEnvironment(process.env);const args=process.argv.slice(2);if(Bun.version!=='1.4.3'||args.length!==2||args[0]!=='--tenant')throw new Error('Explicit pinned local M4 purge scope required');const worker=new ContentPurgeWorker(process.env.S07_WORKER_DATABASE_URL??'',async()=>{},'m4');try{console.info(JSON.stringify(await worker.runOnce(args[1])));}finally{await worker.close();}}
void main().catch(()=>{console.error('M4 content delivery invalidation failed');process.exitCode=1;});
