import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..'))throw new Error('Pinned project runtime required');
 const mode=process.argv[2];if(!['unit','integration'].includes(mode??''))throw new Error('Explicit M3 verification scope required');
 const suites=mode==='unit'?['apps/api/test/m3-content.test.ts','apps/api/test/m3-request.test.ts','apps/admin/lib/content-navigation.test.ts','apps/admin/lib/decimal-price.test.ts','apps/admin/lib/content-input.test.ts','apps/website/lib/price.test.ts','apps/website/lib/public-content.test.ts']:['apps/api/test/m3-integration.test.ts','apps/api/test/m3-media-integration.test.ts'];
 await mkdir('docs/evidence/m3',{recursive:true});
 const results=[];
 for(const file of suites) {
  if(!await Bun.file(file).exists())throw new Error('Required actual suite missing');
  const command=mode==='unit'?[process.execPath,'--no-env-file','test',file]:[process.execPath,'--env-file=.env','--env-file=.local/s02.env','--env-file=.local/s04.env','--env-file=.local/s05.env','--env-file=.local/m2.env','test',file,'--timeout','120000'];
  const child=Bun.spawn(command,{env:{...process.env,...(mode==='integration'?{M3_INTEGRATION:'1'}:{})},stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,exitCode]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  const output=stdout+stderr;await writeFile(`.local/m3-${mode}-${Date.now()}-${file.split('/').at(-1)}.log`,output,{mode:0o600,flag:'wx'});
  const count=(pattern:RegExp)=>Number(output.match(pattern)?.[1]??0);
  const result={file,exitCode,passed:count(/(\d+) pass\b/),failed:count(/(\d+) fail\b/),skipped:count(/(\d+) skip\b/),assertions:count(/(\d+) expect\(\) calls/)};
  results.push(result);console.info(JSON.stringify(result));if(exitCode||!result.passed||result.failed||result.skipped){process.exitCode=1;break;}
 }
 const report={recordedAt:new Date().toISOString(),mode,status:results.length===suites.length&&results.every(r=>!r.exitCode&&r.passed&&!r.failed&&!r.skipped)?'PASS':'FAIL',suites:results,limits:'Scoped actual tests; API/database/browser/media/worker and human acceptance remain distinct. Private raw output retained without exporting credentials.'};
 await writeFile(`docs/evidence/m3/${mode}-checks-${Date.now()}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
void main().catch(()=>{console.error('M3 checks refused/failed; details redacted.');process.exitCode=1;});
