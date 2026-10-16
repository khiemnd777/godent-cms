import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
async function main() {
 if(!process.argv.includes('--local-m2')) throw new Error('Explicit M2 required');
 const client=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
 try {const applied=await client.begin(async tx=>{
  await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');await tx`SELECT pg_advisory_xact_lock(728293018)`;
  const results:string[]=[];
  for(const name of (await readdir('apps/api/migrations')).filter(n=>/^\d{4}_[a-z0-9_]+\.sql$/.test(n)).sort()) {
   const source=await readFile(`apps/api/migrations/${name}`,'utf8'),digest=createHash('sha256').update(source).digest('hex');
   const old=await tx`SELECT checksum FROM gcms_s02.schema_migration WHERE name=${name}`;
   if(old[0]) {if(old[0].checksum!==digest) throw new Error('Applied migration checksum mismatch');continue;}
   if(!['0015_s06_retention.sql','0016_s07_media.sql','0017_s08_editorial.sql','0018_m2_sql_boundary_repair.sql','0019_s07_public_reference_eligibility.sql','0020_s08_history_version_guard.sql','0021_s06_claim_scheduled_jobs.sql','0022_s08_public_cover_contract.sql','0024_s07_worker_current_claim.sql'].includes(name)) throw new Error('Unapproved unapplied migration');
   await tx.unsafe(source);await tx`INSERT INTO gcms_s02.schema_migration(name,checksum) VALUES(${name},${digest})`;results.push(name);
  }return results;
 });console.info(JSON.stringify({status:'PASS',applied,retainedChecksumsVerified:true,dispatchStarted:false}));}
 finally {await client.close();}
}
void main().catch(error=>{const code=error&&typeof error==='object'&&'code'in error?String(error.code):'UNKNOWN';console.error(JSON.stringify({status:'FAIL',stage:'migration',code,rollback:true,detailsRedacted:true}));process.exitCode=1;});
