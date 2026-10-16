import { mkdir,writeFile } from 'node:fs/promises';
const slice=process.argv[2];
const files:Record<string,string[]>={s06:['m2-worker-environment.test.ts','s06-input.test.ts','s06-capture.test.ts','s06-service.test.ts','s06-retention-integration.test.ts'],s07:['m2-worker-environment.test.ts','s07-security.test.ts','s07-decoder.test.ts','s07-container-lifecycle.test.ts','s07-media-integration.test.ts'],s08:['s08-input.test.ts','s08-editorial-integration.test.ts'],s05:['s05-input.test.ts','s05-capture.test.ts','s05-worker-environment.test.ts','s05-lead-integration.test.ts','s05-worker-integration.test.ts','s05-races-integration.test.ts'],s03:['s03-content.test.ts'],s05races:['s05-races-integration.test.ts']};
if(!files[slice]) throw new Error('Explicit M2 slice required');
await mkdir('docs/evidence/m2',{recursive:true});
const results=[];
for(const file of files[slice]) {
 if(!await Bun.file(`apps/api/test/${file}`).exists()) throw new Error('Missing actual suite');
 const child=Bun.spawn([process.execPath,'--env-file=.env','--env-file=.local/s02.env','--env-file=.local/s04.env','--env-file=.local/m2.env','--env-file=.local/s05.env','test',`apps/api/test/${file}`,'--timeout','120000'],
  {env:{...process.env,[`${slice.startsWith('s05')?'S05':slice.toUpperCase()}_INTEGRATION`]:'1'},stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,exitCode]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
 const output=stdout+stderr;
 const stamp=Date.now();await writeFile(`.local/m2-${slice}-${file}-${stamp}.log`,output,{mode:0o600});
 const count=(r:RegExp)=>Number(output.match(r)?.[1]??0);
 const result={file,exitCode,passed:count(/(\d+) pass\b/),failed:count(/(\d+) fail\b/),skipped:count(/(\d+) skip\b/),assertions:count(/(\d+) expect\(\) calls/)};
 results.push(result);console.log(JSON.stringify(result));
 if(exitCode||!result.passed||result.failed||result.skipped) {process.exitCode=1;break;}
}
const result={recordedAt:new Date().toISOString(),slice,status:results.length===files[slice].length&&results.every(r=>!r.exitCode&&r.passed&&!r.failed&&!r.skipped)?'PASS':'FAIL',suites:results,
 limits:'New owned local synthetic unit/API/PostgreSQL/storage/worker proof. Browser, human acceptance and production are separate.'};
await writeFile(`docs/evidence/m2/${slice}-checks-${Date.now()}.json`,JSON.stringify(result,null,2)+'\n');
