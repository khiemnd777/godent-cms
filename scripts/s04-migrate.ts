import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

export async function migrateS04() {
  if(!process.argv.includes('--local-s04')||process.cwd()!==resolve(import.meta.dir,'..')) throw new Error('Explicit local S04 scope required');
  const secret=process.env.S04_HMAC_SECRET;
  if(!secret||!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Private S04 HMAC secret required');
  const client=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
  try {
    await client.begin(async tx=>{
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');await tx`SELECT pg_advisory_xact_lock(728293018)`;
      for(const name of ['0001_s02_access.sql','0002_session_mfa_assurance.sql','0003_reauth_grant_rls.sql','0004_s03_publication.sql','0005_s04_consultation.sql','0006_s04_anonymous_audit.sql','0007_s04_email_syntax.sql']) {
        const contents=await readFile(resolve('apps/api/migrations',name),'utf8');const digest=createHash('sha256').update(contents).digest('hex');
        const existing=await tx`SELECT checksum FROM gcms_s02.schema_migration WHERE name=${name}`;
        if(existing.length) {if(existing[0].checksum!==digest) throw new Error('Applied migration checksum mismatch');continue;}
        if(!['0005_s04_consultation.sql','0006_s04_anonymous_audit.sql','0007_s04_email_syntax.sql'].includes(name)) throw new Error('Required retained migration absent');
        await tx.unsafe(contents);await tx`INSERT INTO gcms_s02.schema_migration(name,checksum) VALUES(${name},${digest})`;
      }
      const prior=await tx`SELECT hmac_key FROM gcms_s04.secret WHERE singleton`;
      if(prior.length&&prior[0].hmac_key!==secret) throw new Error('Retained HMAC key mismatch');
      if(!prior.length) await tx`INSERT INTO gcms_s04.secret(singleton,hmac_key) VALUES(true,${secret})`;
    });
    console.info('S04 additive migration and keyed acceptance function ready; retained migration checksums verified.');
  } finally {await client.close();}
}
if(import.meta.main) migrateS04().catch(()=>{console.error('S04 migration failed; transaction rolled back, details redacted.');process.exitCode=1;});
