import { MediaWorker } from './media-worker';
import { assertIsolatedMediaWorkerEnvironment } from './media-environment';
import { DecoderSettlementUnknown } from '../media/processor';
async function main() {
 assertIsolatedMediaWorkerEnvironment(process.env);
 const args=process.argv.slice(2);
 if(args.length!==2 || args[0]!=='--tenant' || !/^[a-f0-9-]{36}$/.test(args[1])) throw new Error('Explicit new local media fixture tenant required');
 if(Bun.version!=='1.4.3') throw new Error('Pinned Bun runtime required');
 const worker=new MediaWorker(process.env.S07_WORKER_DATABASE_URL??'');
 try {console.log(JSON.stringify(await worker.runOnce(args[1])));}
 finally {await worker.close();}
}
void main().catch(error=>{
 if(error instanceof DecoderSettlementUnknown&&error.recovery) console.error(JSON.stringify({state:'native_blocked',recoveryReceiptPath:error.recovery.receiptPath}));
 else console.error('Media worker failed');
 process.exitCode=1;
});
