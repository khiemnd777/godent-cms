/** Root-only bounded verification of the actual local container limits; no retained container is touched. */
import { randomUUID } from 'node:crypto';
const image=process.env.S07_DECODER_IMAGE??'';
if(!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Immutable new decoder image required');
async function command(args:string[]) {
  const child=Bun.spawn(['docker',...args],{stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,exit]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  if(exit!==0) throw new Error(`Local Docker probe command failed (${exit}; diagnostic bytes ${stderr.length})`);
  return stdout;
}
const results:Record<string,unknown>[]=[];
for(const mode of ['memory','deadline'] as const) {
  const nonce=randomUUID(),name=`gcms-s07-probe-${nonce}`;
  const code=mode==='memory'?'const b=new Uint8Array(1024*1024*1024);for(let i=0;i<b.length;i+=4096)b[i]=255;await Bun.sleep(60000);':'await Bun.sleep(60000);';
  const id=(await command(['create','--name',name,'--label',`gcms.s07.probe=${nonce}`,'--network=none','--read-only','--user=10000:10000',
    '--memory=384m','--memory-swap=384m','--cpus=1','--pids-limit=64','--cap-drop=ALL','--security-opt=no-new-privileges',
    '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m','--entrypoint=bun',image,'-e',code])).trim();
  if(!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid owned container identity');
  try {
    const config=JSON.parse(await command(['inspect',id]))[0];
    if(config.Id!==id||config.Config.Labels['gcms.s07.probe']!==nonce||config.HostConfig.Memory!==384*1024*1024||config.HostConfig.MemorySwap!==384*1024*1024||config.HostConfig.NetworkMode!=='none'||!config.HostConfig.ReadonlyRootfs||config.Config.User!=='10000:10000'||config.HostConfig.PidsLimit!==64||config.HostConfig.NanoCpus!==1_000_000_000||config.Mounts.length!==0) throw new Error('Actual Docker resource configuration mismatch');
    const started=Date.now(),child=Bun.spawn(['docker','start','--attach',id],{stdout:'ignore',stderr:'ignore'});
    let killed=false,kill:Promise<unknown>|undefined;
    const timer=setTimeout(()=>{killed=true;kill=command(['kill',id]);},mode==='deadline'?2000:15000);
    const exit=await child.exited;clearTimeout(timer);if(kill) await kill;
    const state=JSON.parse(await command(['inspect',id]))[0].State;
    if(state.Running || state.ExitCode!==137 || (mode==='memory'?!state.OOMKilled||killed:!killed)) throw new Error('Expected actual bounded process termination was not observed');
    results.push({mode,exit,containerExit:state.ExitCode,oomKilled:state.OOMKilled,elapsedMs:Date.now()-started,memoryBytes:config.HostConfig.Memory,memorySwapBytes:config.HostConfig.MemorySwap,nanoCpus:config.HostConfig.NanoCpus,pids:64,network:'none',readOnly:true,user:'10000:10000',mounts:0});
  } finally {
    const actual=JSON.parse(await command(['inspect',id]))[0];
    if(actual.Id!==id||actual.Config.Labels['gcms.s07.probe']!==nonce) throw new Error('Owned probe identity mismatch; cleanup refused');
    if(actual.State.Running) await command(['kill',id]);
    await command(['rm',id]);
  }
}
console.log(JSON.stringify({status:'PASS',scope:'actual local cgroup memory/CPU/pids/network/read-only and actual process kill, new owned containers only',image,results},null,2));
