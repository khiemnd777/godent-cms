import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..'))throw new Error('Pinned project runtime required');
 const mode=process.argv[2];if(!['unit','integration'].includes(mode??''))throw new Error('Explicit M4 verification scope required');
 let suites=mode==='unit'?['apps/api/test/m4-validation.test.ts','apps/api/test/m4-security.test.ts','apps/admin/lib/builder-state.test.ts','apps/website/lib/public-builder.test.ts','apps/website/lib/public-builder-validation.test.ts']:['apps/api/test/m4-integration.test.ts','apps/api/test/m4-intake-integration.test.ts','apps/api/test/m4-locale-integration.test.ts','apps/api/test/m4-boundary-integration.test.ts','apps/api/test/m4-media-integration.test.ts','apps/api/test/m4-lifecycle-integration.test.ts','apps/api/test/m4-graph-integration.test.ts','apps/api/test/m4-promotion-scope-integration.test.ts','apps/api/test/m4-restoration-integration.test.ts','apps/api/test/m4-asset-locale-integration.test.ts','apps/api/test/m4-seo-integration.test.ts'];
 const selected=process.argv.slice(3);if(selected.length){const wanted=selected.map(name=>{if(!/^[a-z-]+$/.test(name))throw new Error('Invalid suite selector');const match=suites.find(file=>file.endsWith(`/m4-${name}${mode==='integration'?'-integration':''}.test.ts`));if(!match)throw new Error('Unknown suite selector');return match;});if(new Set(wanted).size!==wanted.length)throw new Error('Duplicate suite selector');suites=wanted;}
 await mkdir('docs/evidence/m4',{recursive:true});
 const results=[];
 for(const file of suites) {
  if(!await Bun.file(file).exists())throw new Error('Required actual suite missing');
  const command=mode==='unit'?[process.execPath,'--no-env-file','test',file]:[process.execPath,'--env-file=.env','--env-file=.local/s02.env','--env-file=.local/s04.env','--env-file=.local/s05.env','--env-file=.local/m2.env','test',file,'--timeout','120000'];
  const child=Bun.spawn(command,{env:{...process.env,...(mode==='integration'?{M4_INTEGRATION:'1'}:{})},stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,exitCode]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  const output=stdout+stderr;await writeFile(`.local/m4-${mode}-${Date.now()}-${file.split('/').at(-1)}.log`,output,{mode:0o600,flag:'wx'});
  const count=(pattern:RegExp)=>Number(output.match(pattern)?.[1]??0);
  const result={file,exitCode,passed:count(/(\d+) pass\b/),failed:count(/(\d+) fail\b/),skipped:count(/(\d+) skip\b/),assertions:count(/(\d+) expect\(\) calls/)};
  results.push(result);console.info(JSON.stringify(result));if(exitCode||!result.passed||result.failed||result.skipped){process.exitCode=1;break;}
 }
 const report={recordedAt:new Date().toISOString(),mode,status:results.length===suites.length&&results.every(r=>!r.exitCode&&r.passed&&!r.failed&&!r.skipped)?'PASS':'FAIL',suites:results,limits:'Scoped actual tests; API/database/browser/media/worker and human acceptance remain distinct. Private raw output retained without exporting credentials.'};
 await writeFile(`docs/evidence/m4/${mode}-checks-${Date.now()}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
void main().catch(()=>{console.error('M4 checks refused/failed; details redacted.');process.exitCode=1;});
