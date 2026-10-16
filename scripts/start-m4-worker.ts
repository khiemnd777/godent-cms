import { lstat,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readM4Fixtures } from './m4-fixtures';
import { selectM2WorkerEnvironment } from './start-m2-worker';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

async function main() {
 const args=process.argv.slice(2),content=args[0]==='content';if(content)args.shift();const [flag,tenant,once]=args;
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||flag!=='--tenant'||once!=='--once'||args.length!==3)throw new Error('Explicit bounded M4 worker required');
 const fixture=await readM4Fixtures();if(fixture.status!=='complete'||!fixture.tenants.some(t=>t.id===tenant))throw new Error('Selected M4 tenant not owned');
 const path='.local/m2.env',meta=await lstat(path);if(!meta.isFile()||meta.isSymbolicLink()||(meta.mode&0o777)!==0o600)throw new Error('Unsafe retained worker config');
 const config=Object.fromEntries((await readFile(path,'utf8')).trim().split('\n').map(line=>{const at=line.indexOf('=');if(at<1)throw new Error('Invalid private config');return [line.slice(0,at),line.slice(at+1)];}));
 const environment:Record<string,string>=content?{S07_WORKER_DATABASE_URL:validateDatabaseUrl(config.S07_WORKER_DATABASE_URL,'gcms_s07_worker')}:selectM2WorkerEnvironment('s07',config,process.env);
 if(content)for(const key of ['PATH','HOME','TMPDIR','NODE_ENV'])if(process.env[key])environment[key]=process.env[key]!;
 console.info(JSON.stringify({kind:content?'M4_CONTENT_DELIVERY_WORKER_LAUNCH':'M4_MEDIA_WORKER_LAUNCH',tenantId:tenant,selectedEnvironmentKeys:Object.keys(environment).sort(),runtime:Bun.version,credentialsPrinted:false}));
 const child=Bun.spawn([process.execPath,'--no-env-file',`apps/api/dist/worker/${content?'m4-content-purge':'media'}-main.js`,'--tenant',tenant],{env:environment,stdout:'inherit',stderr:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>child.kill(signal));
 process.exitCode=await child.exited;
}
if(import.meta.main)void main().catch(()=>{console.error('M4 bounded media worker refused/failed; details redacted.');process.exitCode=1;});
