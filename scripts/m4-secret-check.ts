import {lstat,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const sensitive=/password|secret|token|access.?key|api.?key|database.?url|credential/i;
async function main(){
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m4'))throw new Error('Explicit pinned local check required');
 const values=new Set<string>();
 function add(value:unknown){if(typeof value!=='string'||value.length<12)return;values.add(value);try{const url=new URL(value);if(url.password.length>=12)values.add(decodeURIComponent(url.password));}catch{/* Non-URL secrets stay exact. */}}
 function inspect(value:unknown,depth=0){if(depth>8||!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(sensitive.test(key))add(item);if(item&&typeof item==='object')inspect(item,depth+1);}}
 const sources=['.env',...(await readdir('.local')).filter(name=>/\.(env|json)$/.test(name)&&!name.includes('baseline')&&!name.includes('error')&&!name.includes('failure')).map(name=>'.local/'+name)];
 for(const path of sources){const meta=await lstat(path);if(!meta.isFile()||meta.isSymbolicLink())throw new Error('Unsafe known-value source');if(meta.size>2_000_000)continue;const source=await readFile(path,'utf8');if(path.endsWith('.json')){try{inspect(JSON.parse(source));}catch{/* Non-JSON evidence is outside the known-value source set. */}}else for(const line of source.split('\n')){const at=line.indexOf('=');if(at>0&&sensitive.test(line.slice(0,at)))add(line.slice(at+1).replace(/^['"]|['"]$/g,''));}}
 const forms=new Set<string>();for(const value of values){forms.add(value);forms.add(encodeURIComponent(value));forms.add(Buffer.from(value).toString('base64'));}
 async function servingFiles(path:string):Promise<string[]>{const meta=await lstat(path);if(meta.isSymbolicLink())throw new Error('Serving symlink refused');if(meta.isFile())return [path];if(!meta.isDirectory())return [];return (await Promise.all((await readdir(path)).map(name=>servingFiles(path+'/'+name)))).flat();}
 const serving=(await Promise.all(['apps/api/dist','apps/admin/.next/server','apps/admin/.next/static','apps/website/.next/server','apps/website/.next/static'].map(servingFiles))).flat();
 const child=Bun.spawn(['git','ls-files','-z','--cached','--others','--exclude-standard'],{stdout:'pipe',stderr:'pipe'});const [listed,exit]=await Promise.all([new Response(child.stdout).text(),child.exited]);if(exit)throw new Error('Source inventory failed');
 let textFiles=0,binaryFiles=0;const findings:string[]=[];const decoder=new TextDecoder('utf-8',{fatal:true});
 for(const path of new Set([...listed.split('\0').filter(Boolean),...serving])){const meta=await lstat(path);if(!meta.isFile()||meta.isSymbolicLink())continue;const bytes=await readFile(path);let source:string;try{source=decoder.decode(bytes);if(source.includes('\0'))throw new Error('Binary');}catch{binaryFiles++;continue;}textFiles++;if([...forms].some(value=>source.includes(value)))findings.push(path);}
 const report={status:findings.length?'FAIL':'PASS',recordedAt:new Date().toISOString(),knownValues:values.size,checkedForms:forms.size,textFiles,binaryFiles,findings,limits:'Exact known private named values and URI/base64 forms in Git-visible and current serving output text files. No secret values or hashes exported. No OCR, runtime-memory scan or comprehensive secret discovery.'};
 await writeFile(`docs/evidence/m4/secret-check-${Date.now()}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.info(JSON.stringify(report));if(findings.length)process.exitCode=1;
}
void main().catch(()=>{console.error('M4 known-value check refused/failed; details redacted.');process.exitCode=1;});
