import { SQL } from 'bun';
import { resolve } from 'node:path';

async function main() {
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m3'))throw new Error('Explicit pinned local M3 required');
 const url=new URL(process.env.DATABASE_URL??'');
 if(url.protocol!=='postgresql:'||url.hostname!=='127.0.0.1'||url.port!=='5888'||url.pathname!=='/gcms_s01'||url.username!=='gcms_local'||url.hash||url.search)throw new Error('Wrong retained local database');
 const db=new SQL(url.toString(),{max:1,connectionTimeout:3});
 try {
  const result=await db.begin(async tx=>{
   await tx`SELECT pg_advisory_xact_lock(728293018)`;
   const prior=await tx`SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='gcms_m3'`;
   if(prior.length){if(prior[0].owner!=='gcms_s02_owner')throw new Error('Unexpected existing schema owner');return 'existing_owned_schema';}
   await tx.unsafe('CREATE SCHEMA gcms_m3 AUTHORIZATION gcms_s02_owner');
   await tx.unsafe('REVOKE ALL ON SCHEMA gcms_m3 FROM PUBLIC');return 'new_schema';
  });
  console.info(JSON.stringify({status:'PASS',result,credentialsChanged:false,dispatchStarted:false}));
 }finally{await db.close();}
}
void main().catch(()=>{console.error('M3 schema bootstrap refused/failed; details redacted.');process.exitCode=1;});
