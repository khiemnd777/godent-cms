import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile,readdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

const APPROVED=['0025_m3_content.sql','0026_m3_service_links.sql','0027_m3_lead_location.sql','0028_m3_integrity.sql','0029_m3_intake_audit.sql','0030_m3_bounded_admission.sql','0031_m3_public_list_budget.sql'];
class CompilationProbe extends Error {constructor(readonly applied:string[]){super('Intentional rollback after SQL compilation');}}
async function main() {
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m3'))throw new Error('Explicit pinned local M3 required');
 const through=process.argv.find(v=>v.startsWith('--through='))?.slice(10)??'0031';
 if(!['0025','0026','0027','0028','0029','0030','0031'].includes(through))throw new Error('Invalid migration boundary');
 const db=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
 try {
  let applied:string[];
  try {applied=await db.begin(async tx=>{
   await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');await tx`SELECT pg_advisory_xact_lock(728293018)`;
   const applied:string[]=[];
   for(const name of (await readdir('apps/api/migrations')).filter(n=>/^\d{4}_[a-z0-9_]+\.sql$/.test(n)).sort()) {
    const source=await readFile(`apps/api/migrations/${name}`,'utf8'),checksum=createHash('sha256').update(source).digest('hex');
    const old=await tx`SELECT checksum FROM gcms_s02.schema_migration WHERE name=${name}`;
    if(old[0]){if(old[0].checksum!==checksum)throw new Error('Retained checksum changed');continue;}
    if(!APPROVED.includes(name))throw new Error('Unexpected unapplied migration');
    if(name.slice(0,4)>through)continue;
    await tx.unsafe(source);await tx`INSERT INTO gcms_s02.schema_migration(name,checksum) VALUES(${name},${checksum})`;applied.push(name);
   }
   if(process.argv.includes('--probe-content')) {
    const content={kind:'specialty',slug:'m3-shape-probe',title:'Synthetic SQL shape probe',summary:'',body:{type:'doc',version:1,blocks:[]},seo:{title:'',description:''},references:[]};
    const checks=await tx`SELECT gcms_m3.valid_content(${JSON.stringify(content)}::text::jsonb) AS valid,gcms_m3.valid_content(jsonb_set(${JSON.stringify(content)}::text::jsonb,'{kind}','null'::jsonb)) AS null_kind`;
    if(checks[0]?.valid!==true||checks[0]?.null_kind!==false)throw new Error('M3 valid/null-kind database shape probe failed');
   }
   if(process.argv.includes('--compile-only'))throw new CompilationProbe(applied);
   return applied;
  });}catch(error){if(error instanceof CompilationProbe){console.info(JSON.stringify({status:'PASS',phase:'sql_compilation_rolled_back',compiled:error.applied,committed:false,dispatchStarted:false}));return;}throw error;}
  console.info(JSON.stringify({status:'PASS',applied,retainedChecksumsVerified:true,dispatchStarted:false}));
 }finally{await db.close();}
}
void main().catch(async error=>{
 const value=error as {code?:string;message?:string;detail?:string;position?:string;errno?:string;sqlState?:string};
 await writeFile(`.local/m3-migration-error-${Date.now()}.json`,JSON.stringify({code:value.code,message:value.message,detail:value.detail,position:value.position,errno:value.errno,sqlState:value.sqlState})+'\n',{mode:0o600,flag:'wx'});
 console.error(JSON.stringify({status:'FAIL',phase:'m3-migration',code:value.code??'UNKNOWN',rollback:true,detailsRedacted:true}));process.exitCode=1;
});
