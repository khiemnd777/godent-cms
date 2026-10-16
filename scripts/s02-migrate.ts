import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

export async function migrateS02() {
  if (!process.argv.includes('--local-s02')) throw new Error('Explicit --local-s02 required');
  const client = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try {
    await client.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      await tx`select pg_advisory_xact_lock(728293018)`;
      await tx.unsafe('CREATE TABLE IF NOT EXISTS gcms_s02.schema_migration (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
      const directory = resolve(import.meta.dir, '../apps/api/migrations');
      for (const name of (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
        const contents = await readFile(resolve(directory, name), 'utf8');
        const checksum = createHash('sha256').update(contents).digest('hex');
        const previous = await tx`select checksum from gcms_s02.schema_migration where name=${name}`;
        if (previous.length) { if (previous[0].checksum !== checksum) throw new Error('Applied migration checksum mismatch'); continue; }
        await tx.unsafe(contents);
        await tx`insert into gcms_s02.schema_migration(name,checksum) values(${name},${checksum})`;
      }
    });
    console.info('S02 migrations applied or verified by checksum; no S01 resources replaced.');
  } finally { await client.close(); }
}
if (import.meta.main) migrateS02().catch(() => { console.error('S02 migration failed; details redacted.'); process.exitCode = 1; });
