import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

export function selectM2WorkerEnvironment(slice:'s06'|'s07',config:Record<string,string>,source:Record<string,string|undefined>) {
 const env:Record<string,string>={};
 for(const key of ['PATH','HOME','TMPDIR','NODE_ENV']) if(source[key]) env[key]=source[key]!;
 const key=slice==='s06'?'S06_WORKER_DATABASE_URL':'S07_WORKER_DATABASE_URL';
 env[key]=validateDatabaseUrl(config[key],slice==='s06'?'gcms_s06_worker':'gcms_s07_worker');
 if(slice==='s07') for(const name of ['S07_MEDIA_BUCKET','S07_STORAGE_ACCESS_KEY_ID','S07_STORAGE_SECRET_ACCESS_KEY','S07_DECODER_IMAGE','S3_ENDPOINT','S3_REGION']) {
  const value=config[name]??source[name];if(!value)throw new Error('Missing media worker configuration');env[name]=value;
 }
 return env;
}
async function privateFile(path:string) {
 const meta=await lstat(path);
 if(!meta.isFile()||meta.isSymbolicLink()||(meta.mode&0o777)!==0o600)throw new Error('Unsafe private worker input');
 return readFile(path,'utf8');
}
async function main() {
 const [slice,flag,tenant,once]=process.argv.slice(2);
 if(process.cwd()!==resolve(import.meta.dir,'..')||Bun.version!=='1.4.3'||!['s06','s07'].includes(slice)||flag!=='--tenant'||once!=='--once'||process.argv.length!==6)throw new Error('Explicit bounded M2 worker required');
 const fixture=JSON.parse(await privateFile('.local/m2-fixtures.json'));
 const allowed=slice==='s06'?fixture.retentionTenantIds:fixture.mediaTenantIds;
 if(fixture.owner!=='GCMS-M2-UI-v1'||fixture.status!=='complete'||!allowed?.includes(tenant)||!/^[a-f0-9-]{36}$/.test(tenant))throw new Error('Selected owned M2 fixture required');
 const config=Object.fromEntries((await privateFile('.local/m2.env')).trim().split('\n').map(line=>{const at=line.indexOf('=');if(at<1)throw new Error('Invalid private configuration');return [line.slice(0,at),line.slice(at+1)];}));
 const args=slice==='s06'?['--tenant',tenant,'--once']:['--tenant',tenant];
 const environment=selectM2WorkerEnvironment(slice as 's06'|'s07',config,process.env);
 console.info(JSON.stringify({kind:'M2_WORKER_LAUNCH',slice,tenantId:tenant,selectedEnvironmentKeys:Object.keys(environment).sort(),runtime:Bun.version,credentialsPrinted:false}));
 const child=Bun.spawn([process.execPath,'--no-env-file',`apps/api/dist/worker/${slice==='s06'?'retention':'media'}-main.js`,...args],
  {env:environment,stdout:'inherit',stderr:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>child.kill(signal));
 process.exitCode=await child.exited;
}
if(import.meta.main)void main().catch(()=>{console.error('M2 worker launcher failed; details redacted.');process.exitCode=1;});
