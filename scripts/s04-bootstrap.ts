import { SQL } from 'bun';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

export async function bootstrapS04() {
  if(process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-s04')) throw new Error('Explicit local S04 scope required');
  const admin=new URL(process.env.DATABASE_URL??'');
  if(admin.hostname!=='127.0.0.1'||admin.port!=='5888'||admin.pathname!=='/gcms_s01'||admin.username!=='gcms_local'||admin.search||admin.hash) throw new Error('Unexpected local database');
  const path=resolve('.local/s04.env');
  await mkdir(resolve('.local'),{recursive:true,mode:0o700});
  const existed=await Bun.file(path).exists();
  if(!existed) {
    const roleUrl=new URL(admin);roleUrl.username='gcms_s04_intake';roleUrl.password=randomBytes(32).toString('hex');
    await writeFile(path,`S04_INTAKE_DATABASE_URL=${roleUrl.href}\nS04_HMAC_SECRET=${randomBytes(32).toString('hex')}\n`,{flag:'wx',mode:0o600});
  }
  if(((await stat(path)).mode&0o777)!==0o600) throw new Error('Unsafe S04 private configuration mode');
  const env=Object.fromEntries((await readFile(path,'utf8')).trim().split('\n').map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));
  const roleUrl=new URL(validateDatabaseUrl(env.S04_INTAKE_DATABASE_URL,'gcms_s04_intake'));
  if(!/^[a-f0-9]{64}$/.test(env.S04_HMAC_SECRET??'')) throw new Error('Invalid S04 HMAC configuration');
  const client=new SQL(admin.href,{max:1,connectionTimeout:3});
  try {
    await client.begin(async tx=>{
      const found=await tx`SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname='gcms_s04_intake'`;
      if(found.length) {
        if(!existed||found[0].marker!=='gcms_s04_bootstrap_v1') throw new Error('Existing intake role requires its original credential');
        // Never reset an existing role password. A subsequent connection verifies the retained credential.
      } else {
        await tx.unsafe('CREATE ROLE gcms_s04_intake LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
        await tx.unsafe("COMMENT ON ROLE gcms_s04_intake IS 'gcms_s04_bootstrap_v1'");
        await tx`SELECT set_config('gcms.s04_new_password',${decodeURIComponent(roleUrl.password)},true)`;
        await tx.unsafe("DO $$ BEGIN EXECUTE format('ALTER ROLE gcms_s04_intake PASSWORD %L',current_setting('gcms.s04_new_password')); END $$");
        await tx.unsafe('GRANT CONNECT ON DATABASE gcms_s01 TO gcms_s04_intake');
      }
      for(const schemaName of ['gcms_s04','gcms_s04_crypto']) {
        const schema=await tx`SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname=${schemaName}`;
        if(schema.length&&schema[0].owner!=='gcms_s02_owner') throw new Error('Unowned S04 schema collision');
        if(!schema.length) await tx.unsafe(`CREATE SCHEMA ${schemaName} AUTHORIZATION gcms_s02_owner`);
        await tx.unsafe(`REVOKE ALL ON SCHEMA ${schemaName} FROM PUBLIC`);
      }
      const extension=await tx`SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto'`;
      if(!extension.length) await tx.unsafe('CREATE EXTENSION pgcrypto WITH SCHEMA gcms_s04_crypto');
      else if(extension[0].nspname!=='gcms_s04_crypto') {
        // Preserve an existing extension. Reuse only with existing owner privileges, never rehome/drop it.
        const nsp=String(extension[0].nspname);
        if(!/^[a-z_][a-z0-9_]*$/.test(nsp)) throw new Error('Unsupported existing crypto namespace');
        const access=await tx`SELECT has_schema_privilege('gcms_s02_owner',${nsp},'USAGE') AS allowed`;
        if(!access[0]?.allowed) throw new Error('Existing crypto schema inaccessible to migration owner');
        await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
        await tx.unsafe(`CREATE OR REPLACE FUNCTION gcms_s04_crypto.hmac(text,text,text) RETURNS bytea LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS 'SELECT "${nsp}".hmac($1,$2,$3)'`);
        await tx.unsafe('RESET ROLE');
      }
      await tx.unsafe('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcms_s04_crypto FROM PUBLIC');
      await tx.unsafe('GRANT EXECUTE ON FUNCTION gcms_s04_crypto.hmac(text,text,text) TO gcms_s02_owner');
    });
    const intake=new SQL(roleUrl.href,{max:1,connectionTimeout:3});
    try {await intake`SELECT 1`;} finally {await intake.close();}
    console.info('S04 new intake role and private crypto ready; retained roles and credentials unchanged.');
  } finally {await client.close();}
}
if(import.meta.main) bootstrapS04().catch(()=>{console.error('S04 bootstrap failed; details redacted.');process.exitCode=1;});
