import assert from 'node:assert/strict';
import { lstat, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
async function command(name:string,args:string[]){const child=Bun.spawn([name,...args],{stdout:'pipe',stderr:'pipe'});const [output,exit]=await Promise.all([new Response(child.stdout).text(),child.exited]);if(exit)throw new Error('Runtime inventory command failed');return output;}
async function main(){
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m5'))throw new Error('Explicit pinned local runtime check required');
 const meta=await lstat('.local/processes.json');if(!meta.isFile()||meta.isSymbolicLink())throw new Error('Unsafe process manifest');
 const owned=await Bun.file('.local/processes.json').json() as {launcher:number;runtime:string;processes:Array<{name:string;port:number;pid:number}>};assert.equal(owned.runtime,'1.4.3');assert.equal(owned.processes.length,3);
 const launcherCommand=await command('ps',['-p',String(owned.launcher),'-o','command=']),cwd=await command('lsof',['-a','-p',String(owned.launcher),'-d','cwd','-Fn']);const launcherArgs=launcherCommand.trim().split(/\s+/);assert.ok(/(?:^|\/)bun(?:\.exe)?$/.test(launcherArgs[0]));assert.ok(JSON.stringify(launcherArgs.slice(1))===JSON.stringify(['scripts/start-local.ts'])||JSON.stringify(launcherArgs.slice(1))===JSON.stringify(['--env-file=.env','scripts/start-local.ts']));assert.ok(cwd.split('\n').includes('n'+process.cwd()));
 const executable=await realpath(process.execPath),processes=[];
 for(const entry of owned.processes){
  const parent=await command('ps',['-p',String(entry.pid),'-o','ppid=']);assert.equal(Number(parent.trim()),owned.launcher);
  const sockets=await command('lsof',['-nP',`-iTCP:${entry.port}`,'-sTCP:LISTEN','-FpFn']),listeners=[...new Set(sockets.split('\n').filter(v=>/^p[0-9]+$/.test(v)).map(v=>Number(v.slice(1))))];assert.equal(listeners.length,1);const names=sockets.split('\n').filter(v=>v.startsWith('n'));assert.ok(names.length>0&&names.every(v=>v===`n127.0.0.1:${entry.port}`));
  let at=listeners[0];const ancestry:number[]=[at];for(let depth=0;at!==entry.pid&&depth<4;depth++){at=Number((await command('ps',['-p',String(at),'-o','ppid='])).trim());assert.ok(Number.isSafeInteger(at)&&at>1);ancestry.push(at);}assert.equal(at,entry.pid);
  // Next changes its process title and uses an owned child; inspect the actual
  // executable of the listener rather than inferring Node from that title.
  const text=await command('lsof',['-a','-p',String(listeners[0]),'-d','txt','-Fn']);assert.ok(text.split('\n').includes('n'+executable));
  processes.push({name:entry.name,launcherChild:entry.pid,listenerPid:listeners[0],port:entry.port,ancestry,runtime:'bun',executable,loopback:true});
 }
 const tests=[];for(const [path,expected] of [['/health',200],['/ready',200],['/diagnostics/echo?value=technical',200],['/diagnostics/echo?value=',400],['/diagnostics/echo?value=ok&extra=private',400],['/owned-missing-m5',404]] as const){const response=await fetch(`http://127.0.0.1:5890${path}`,{signal:AbortSignal.timeout(8000)});assert.equal(response.status,expected);const body=await response.json();assert.equal(response.headers.get('set-cookie'),null);if(path==='/health')assert.deepEqual(body,{status:'ok',scope:'process',runtime:'bun',version:'1.4.3'});if(path==='/ready')assert.deepEqual(body,{status:'ready',services:{postgres:'available',redis:'available',s3:'available'}});tests.push({path,status:response.status,sessionCookie:false});}
 await writeFile(`docs/evidence/m5/${process.argv.includes('--before')?'runtime-before':`final-diagnostics-${Date.now()}`}.json`,JSON.stringify({status:'PASS',recordedAt:new Date().toISOString(),processes,tests,limits:'Actual current owned loopback listener executables, ancestry and diagnostic requests. Availability is point-in-time, not Production or all-error-flow proof.'},null,2)+'\n',{flag:'wx'});console.info(JSON.stringify({status:'PASS',bunListeners:processes.length,checks:tests.length}));
}
if(import.meta.main)void main().catch(async error=>{await writeFile(`.local/m5-runtime-error-${Date.now()}.json`,JSON.stringify({message:error instanceof Error?error.message:'Unknown',stack:error instanceof Error?error.stack:null})+'\n',{mode:0o600,flag:'wx'});console.error('M5 runtime verification refused/failed; details redacted.');process.exitCode=1;});
