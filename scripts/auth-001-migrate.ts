import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

/** Run only after the coordinator stops owned API/worker processes and captures preservation baseline. */
export async function migrateAuth001() {
  if (!process.argv.includes('--local-auth-001') || process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Explicit local AUTH scope required');
  const client = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try {
    const result = await client.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      await tx`SELECT pg_advisory_xact_lock(728293018)`;
      const names = (await readdir('apps/api/migrations')).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
      const expected = ['0013_auth_password_only.sql', '0014_s05_user_identifier.sql'];
      if (names.length !== 14 || names.at(-1) !== expected.at(-1)) throw new Error('Unexpected migration set');
      const appliedNames: string[] = [];
      for (const name of names) {
        const contents = await readFile(resolve('apps/api/migrations', name), 'utf8');
        const digest = createHash('sha256').update(contents).digest('hex');
        const existing = await tx`SELECT checksum FROM gcms_s02.schema_migration WHERE name=${name}`;
        if (existing.length) {
          if (existing[0].checksum !== digest) throw new Error('Applied migration checksum mismatch');
          continue;
        }
        if (!expected.includes(name)) throw new Error('Retained migration absent');
        if (name === '0014_s05_user_identifier.sql') {
          const original = (await readFile('apps/api/migrations/0008_s05_lead_operations.sql', 'utf8'))
            .match(/CREATE FUNCTION gcms_s05\.lead_command\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/)?.[1]?.trim();
          const installed = await tx`SELECT prosrc FROM pg_proc WHERE oid='gcms_s05.lead_command(text,text,jsonb)'::regprocedure`;
          if (!original || installed[0]?.prosrc.trim() !== original) throw new Error('Installed lead command differs from retained source');
        }
        await tx.unsafe(contents);
        await tx`INSERT INTO gcms_s02.schema_migration(name,checksum) VALUES(${name},${digest})`;
        appliedNames.push(name);
      }
      return { appliedNames };
    });
    console.info(JSON.stringify({ status: 'PASS', migration: '0014_s05_user_identifier.sql', applied: result.appliedNames.length > 0, appliedNames: result.appliedNames,
      sessionRevocation: result.appliedNames.includes('0013_auth_password_only.sql') ? 'APPLIED_ONCE' : 'ALREADY_APPLIED_NO_REPEAT' }));
  } finally { await client.close(); }
}
if (import.meta.main) migrateAuth001().catch(() => { console.error('AUTH migration failed; transaction rolled back; details redacted.'); process.exitCode = 1; });
