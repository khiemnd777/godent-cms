import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile,readdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

const APPROVED=['0051_m5_platform.sql','0052_m5_domains.sql','0053_m5_read_safety.sql','0054_m5_domain_attestation.sql','0055_m5_private_fences.sql','0056_m5_root_canonical.sql','0057_m5_domain_readiness.sql','0058_m5_verification_readiness.sql'];
class CompilationProbe extends Error {constructor(readonly applied:string[]){super('Intentional rollback after SQL compilation');}}
async function main() {
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m5'))throw new Error('Explicit pinned local M5 required');
 const through=process.argv.find(v=>v.startsWith('--through='))?.slice(10)??'0058';
 if(!['0051','0052','0053','0054','0055','0056','0057','0058'].includes(through))throw new Error('Invalid migration boundary');
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
    // A concurrently authored future migration is outside this explicit boundary.
    // Previously applied files above were still checksum-verified.
    if(name.slice(0,4)>through)continue;
    if(!APPROVED.includes(name))throw new Error('Unexpected unapplied migration');
    await tx.unsafe(source);await tx`INSERT INTO gcms_s02.schema_migration(name,checksum) VALUES(${name},${checksum})`;applied.push(name);
   }
   if(process.argv.includes('--compile-only'))throw new CompilationProbe(applied);
   return applied;
  });}catch(error){if(error instanceof CompilationProbe){console.info(JSON.stringify({status:'PASS',phase:'sql_compilation_rolled_back',compiled:error.applied,committed:false,dispatchStarted:false}));return;}throw error;}
  console.info(JSON.stringify({status:'PASS',applied,retainedChecksumsVerified:true,dispatchStarted:false}));
 }finally{await db.close();}
}
void main().catch(async error=>{
 const value=error as {code?:string;message?:string;detail?:string;position?:string;errno?:string;sqlState?:string};
 await writeFile(`.local/m5-migration-error-${Date.now()}.json`,JSON.stringify({code:value.code,message:value.message,detail:value.detail,position:value.position,errno:value.errno,sqlState:value.sqlState})+'\n',{mode:0o600,flag:'wx'});
 console.error(JSON.stringify({status:'FAIL',phase:'m5-migration',code:value.code??'UNKNOWN',rollback:true,detailsRedacted:true}));process.exitCode=1;
});
