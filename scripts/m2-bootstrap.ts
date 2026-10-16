import { SQL } from 'bun';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

async function main() {
  if (!process.argv.includes('--local-m2') || process.cwd() !== resolve(import.meta.dir,'..')) throw new Error('Explicit local M2 required');
  const admin=new URL(process.env.DATABASE_URL??'');
  if(admin.hostname!=='127.0.0.1'||admin.port!=='5888'||admin.pathname!=='/gcms_s01'||admin.username!=='gcms_local'||admin.search||admin.hash) throw new Error('Wrong local database');
  await mkdir('.local',{recursive:true,mode:0o700});
  const path='.local/m2.env',exists=await Bun.file(path).exists();
  if(!exists) {
    const values:Record<string,string>={S07_MEDIA_SIGNING_SECRET:randomBytes(32).toString('hex'),S07_MEDIA_BUCKET:`gcms-m2-media-${randomUUID()}`,
      S07_STORAGE_ACCESS_KEY_ID:`gcmsm2${randomBytes(12).toString('hex')}`,S07_STORAGE_SECRET_ACCESS_KEY:randomBytes(32).toString('hex')};
    for(const number of ['06','07']) {const u=new URL(admin);u.username=`gcms_s${number}_worker`;u.password=randomBytes(32).toString('hex');values[`S${number}_WORKER_DATABASE_URL`]=u.href;}
    await writeFile(path,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{flag:'wx',mode:0o600});
  }
  if(((await stat(path)).mode&0o777)!==0o600) throw new Error('Unsafe new private config');
  const config=Object.fromEntries((await readFile(path,'utf8')).trim().split('\n').map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)];}));
  const client=new SQL(admin.href,{max:1,connectionTimeout:3});
  try {
    await client.begin(async tx=>{
      for(const number of ['06','07']) {
        const role=`gcms_s${number}_worker`,marker=`gcms_m2_s${number}_v1`,url=new URL(validateDatabaseUrl(config[`S${number}_WORKER_DATABASE_URL`],role));
        const found=await tx`SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname=${role}`;
        if(found.length) {if(!exists||found[0].marker!==marker) throw new Error('Unowned role collision');}
        else {
          await tx.unsafe(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
          await tx.unsafe(`COMMENT ON ROLE ${role} IS '${marker}'`);
          await tx`SELECT set_config('gcms.m2_new_password',${decodeURIComponent(url.password)},true)`;
          await tx.unsafe(`DO $$ BEGIN EXECUTE format('ALTER ROLE ${role} PASSWORD %L',current_setting('gcms.m2_new_password')); END $$`);
          await tx.unsafe(`GRANT CONNECT ON DATABASE gcms_s01 TO ${role}`);
        }
      }
      for(const schema of ['gcms_s06','gcms_s07','gcms_s08']) {
        const found=await tx`SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname=${schema}`;
        if(found.length&&found[0].owner!=='gcms_s02_owner') throw new Error('Unowned schema collision');
        if(!found.length) await tx.unsafe(`CREATE SCHEMA ${schema} AUTHORIZATION gcms_s02_owner`);
        await tx.unsafe(`REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`);
      }
    });
    console.info(JSON.stringify({status:'PASS',newWorkerRoles:2,privateConfigMode:'0600',retainedCredentialsChanged:false}));
  } finally {await client.close();}
}
void main().catch(()=>{console.error('M2 bootstrap failed; details redacted.');process.exitCode=1;});
