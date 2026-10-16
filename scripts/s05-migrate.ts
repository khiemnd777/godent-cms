import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

export async function migrateS05() {
  if (!process.argv.includes('--local-s05') || process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Explicit local S05 scope required');
  const client = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try {
    await client.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner'); await tx`SELECT pg_advisory_xact_lock(728293018)`;
      const names = (await readdir('apps/api/migrations')).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
      for (const name of names) {
        const contents = await readFile(resolve('apps/api/migrations', name), 'utf8'), digest = createHash('sha256').update(contents).digest('hex');
        const existing = await tx`SELECT checksum FROM gcms_s02.schema_migration WHERE name=${name}`;
        if (existing.length) { if (existing[0].checksum !== digest) throw new Error('Applied migration checksum mismatch'); continue; }
        if (!['0008_s05_lead_operations.sql', '0009_s05_notification_worker.sql', '0010_s05_worker_recipient_alias.sql', '0011_s05_worker_initial_readiness.sql', '0012_s05_notification_login_link.sql'].includes(name)) throw new Error('Required retained migration absent');
        if (!name.startsWith('0008') && !process.argv.includes('--include-worker')) continue;
        await tx.unsafe(contents); await tx`INSERT INTO gcms_s02.schema_migration(name,checksum) VALUES(${name},${digest})`;
      }
    });
    console.info('S05 additive migrations ready; retained migration checksums verified.');
  } finally { await client.close(); }
}
if (import.meta.main) migrateS05().catch(() => { console.error('S05 migration failed; transaction rolled back, details redacted.'); process.exitCode = 1; });
