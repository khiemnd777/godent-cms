import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
const migration = '0059_s06_audit_retention_scope.sql';
class CompilationProbe extends Error {}
async function main() {
  const [flag, mode] = process.argv.slice(2);
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || flag !== '--local-audit-expiry' || !['--check-only', '--compile-only', '--apply'].includes(mode ?? '') || process.argv.length !== 4) throw new Error('Explicit audit migration phase required');
  const db = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  let checked = 0, applied = false;
  try {
    try {
      await db.begin(async tx => {
        await tx.unsafe("SET LOCAL ROLE gcms_s02_owner; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='15s'");
        await tx`SELECT pg_advisory_xact_lock(728293018)`;
        for (const row of await tx`SELECT name,checksum FROM gcms_s02.schema_migration ORDER BY name`) {
          if (typeof row.name !== 'string' || !/^\d{4}_[a-z0-9_]+\.sql$/.test(row.name)) throw new Error('Unsafe recorded migration');
          const source = await readFile(`apps/api/migrations/${row.name}`);
          if (createHash('sha256').update(source).digest('hex') !== row.checksum) throw new Error('Applied migration checksum changed');
          checked++;
        }
        if (mode === '--check-only') return;
        const bytes = await readFile(`apps/api/migrations/${migration}`, 'utf8'), checksum = createHash('sha256').update(bytes).digest('hex');
        const prior = await tx`SELECT checksum FROM gcms_s02.schema_migration WHERE name=${migration}`;
        if (!prior.length) {
          await tx.unsafe(bytes);
          await tx`INSERT INTO gcms_s02.schema_migration(name,checksum) VALUES(${migration},${checksum})`;
          applied = true;
        }
        if (mode === '--compile-only') throw new CompilationProbe('Intentional compilation rollback');
      });
    } catch (error) { if (!(error instanceof CompilationProbe)) throw error; }
    const report = { status: 'PASS', recordedAt: new Date().toISOString(), phase: mode, retainedChecksums: checked, migration, committed: mode === '--apply', applied: mode === '--apply' && applied, compiledThenRolledBack: mode === '--compile-only' && applied, dispatchStarted: false };
    await writeFile(`docs/evidence/audit-expiry/migration-${Date.now()}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.info(JSON.stringify(report));
  } finally { await db.close(); }
}
void main().catch(async error => {
  await writeFile(`.local/audit-migration-error-${Date.now()}.json`, JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown', code: (error as { code?: string }).code, position: (error as { position?: string }).position }) + '\n', { flag: 'wx', mode: 0o600 });
  console.error('Audit migration refused/rolled back; private diagnostic retained.'); process.exitCode = 1;
});
