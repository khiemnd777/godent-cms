import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile,readdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

const APPROVED=['0032_m4_publication.sql','0033_m4_public_reads.sql','0034_m4_projection_integrity.sql','0035_m4_intake_sources.sql','0036_m4_scope_integrity.sql','0037_m4_legacy_conflicts.sql','0038_m4_reference_resolution.sql','0039_m4_boundary_repairs.sql','0040_m4_private_preview.sql','0041_m4_intake_and_permission_lifecycle.sql','0042_m4_draft_slug_identity.sql','0043_m4_post_lock_promotion_clock.sql','0044_m4_legacy_budget_alias.sql','0045_m4_locale_view_eligibility.sql','0046_m4_serialized_scope_budget.sql','0047_m4_asset_scope_expression.sql','0048_m4_restore_locked_identity.sql','0049_m4_locale_asset_use_withdrawal.sql','0050_m4_seo_eligibility.sql'];
class CompilationProbe extends Error {constructor(readonly applied:string[]){super('Intentional rollback after SQL compilation');}}
async function main() {
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m4'))throw new Error('Explicit pinned local M4 required');
 const through=process.argv.find(v=>v.startsWith('--through='))?.slice(10)??'0050';
 if(!['0032','0033','0034','0035','0036','0037','0038','0039','0040','0041','0042','0043','0044','0045','0046','0047','0048','0049','0050'].includes(through))throw new Error('Invalid migration boundary');
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
   if(process.argv.includes('--probe-content')) {
    const content={kind:'home',slug:'home',title:'M4 synthetic SQL shape probe',summary:'',seo:{title:'',description:''},sections:[]};
    const checks=await tx`SELECT gcms_m4.valid_content('home',${JSON.stringify(content)}::text::jsonb) AS valid,
      gcms_m4.valid_content('home',jsonb_set(${JSON.stringify(content)}::text::jsonb,'{title}','null'::jsonb)) AS null_title`;
    if(checks[0]?.valid!==true||checks[0]?.null_title!==false)throw new Error('M4 database shape probe failed');
   }
   if(process.argv.includes('--compile-only'))throw new CompilationProbe(applied);
   return applied;
  });}catch(error){if(error instanceof CompilationProbe){console.info(JSON.stringify({status:'PASS',phase:'sql_compilation_rolled_back',compiled:error.applied,committed:false,dispatchStarted:false}));return;}throw error;}
  console.info(JSON.stringify({status:'PASS',applied,retainedChecksumsVerified:true,dispatchStarted:false}));
 }finally{await db.close();}
}
void main().catch(async error=>{
 const value=error as {code?:string;message?:string;detail?:string;position?:string;errno?:string;sqlState?:string};
 await writeFile(`.local/m4-migration-error-${Date.now()}.json`,JSON.stringify({code:value.code,message:value.message,detail:value.detail,position:value.position,errno:value.errno,sqlState:value.sqlState})+'\n',{mode:0o600,flag:'wx'});
 console.error(JSON.stringify({status:'FAIL',phase:'m4-migration',code:value.code??'UNKNOWN',rollback:true,detailsRedacted:true}));process.exitCode=1;
});
