import {MediaStorage,readMediaStorageConfig} from '../media/storage';
import {M5LifecycleWorker} from './m5-lifecycle-worker';

/** Explicit one-shot entry point. Import/startup never enrolls tenants or jobs. */
async function main(){
 const args=process.argv.slice(2);if(!process.versions.bun||args.length!==3||args[0]!=='--local-m5'||args[1]!=='--once'||!/^--tenant=[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(args[2]))throw new Error('Explicit M5 local one-shot tenant required');
 const storage=new MediaStorage(readMediaStorageConfig()),worker=new M5LifecycleWorker(process.env.M5_LIFECYCLE_DATABASE_URL??'',storage);
 try{const result=await worker.runOnce(args[2].slice('--tenant='.length));process.stdout.write(JSON.stringify(result)+'\n');if(result.status==='failed')process.exitCode=1;}finally{await worker.close();}
}
if(require.main===module)main().catch(()=>{process.stderr.write('M5 lifecycle execution incomplete\n');process.exitCode=1;});
