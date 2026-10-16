import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readM4Fixtures} from './m4-fixtures';
import {m4PublicPath} from '../apps/api/src/contracts/m4';

async function inspect(command:string,args:string[]){const child=Bun.spawn([command,...args],{stdout:'pipe',stderr:'pipe'});const [output,exit]=await Promise.all([new Response(child.stdout).text(),child.exited]);if(exit)throw new Error('Owned process inspection failed');return output;}
async function main(){
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m4'))throw new Error('Explicit pinned local fault scope required');
 const f=await readM4Fixtures(),tenant=f.tenants.find(t=>t.label==='A')!,demo=await Bun.file('.local/m4-demo-fixtures.json').json();assert.equal(demo.owner,'GCMS-M4-DEMO-v1');assert.equal(demo.fixtureRun,f.runId);assert.equal(demo.status,'complete');assert.equal(demo.tenantId,tenant.id);
 const catalog=demo.entries.find((entry:{key:string})=>entry.key==='catalog'),url='http://localhost:5892'+m4PublicPath(tenant.slug,'en','page',catalog.slug);
 const owned=await Bun.file('.local/processes.json').json() as {launcher:number;processes:Array<{name:string;pid:number}>};const api=owned.processes.find(p=>p.name==='api')!;assert.ok(Number.isSafeInteger(api.pid)&&api.pid>1);
 const command=await inspect('ps',['-p',String(api.pid),'-o','command=']);assert.ok(command.includes('--no-env-file apps/api/dist/main.js'));assert.equal(Number((await inspect('ps',['-p',String(api.pid),'-o','ppid='])).trim()),owned.launcher);assert.ok((await inspect('lsof',['-a','-p',String(api.pid),'-d','cwd','-Fn'])).split('\n').includes('n'+process.cwd()));
 assert.equal((await fetch('http://127.0.0.1:5890/health',{signal:AbortSignal.timeout(8000)})).status,200);assert.equal((await fetch(url,{signal:AbortSignal.timeout(15000)})).status,200);
 let resumed=false;const resume=()=>{if(!resumed){process.kill(api.pid,'SIGCONT');resumed=true;}};let elapsed=0;
 process.once('SIGTERM',()=>{resume();process.exit(143);});process.once('SIGINT',()=>{resume();process.exit(130);});process.kill(api.pid,'SIGSTOP');const timer=setTimeout(resume,10000),started=Date.now();
 try{const unavailable=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(14000)});elapsed=Date.now()-started;assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('location'),null);assert.match(unavailable.headers.get('cache-control')??'',/no-store/);const body=await unavailable.text();assert.match(body,/<html lang="en">/);assert.match(body,/Content temporarily unavailable/);}finally{clearTimeout(timer);resume();}
 assert.equal((await fetch('http://127.0.0.1:5890/health',{signal:AbortSignal.timeout(8000)})).status,200);assert.equal((await fetch(url,{signal:AbortSignal.timeout(15000)})).status,200);
 const report={status:'PASS',recordedAt:new Date().toISOString(),scope:'positively identified owned local API process paused, EN website fails503 withoutfallback, exactAPI resumed and bothhealth/page recover200',pausedRequestMs:elapsed,maxPauseMs:10000,credentialsChanged:false,fixtureWrites:false,limits:'Bounded local transport outage; not every backend error, Production recovery/SLO or operational backup/restore.'};await writeFile(`docs/evidence/m4/fault-checks-${Date.now()}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.info(JSON.stringify(report));
}
void main().catch(async error=>{await writeFile(`.local/m4-fault-error-${Date.now()}.json`,JSON.stringify({message:error instanceof Error?error.message:'Unknown'})+'\n',{mode:0o600,flag:'wx'});console.error('M4 bounded fault check failed; details redacted.');process.exitCode=1;});
