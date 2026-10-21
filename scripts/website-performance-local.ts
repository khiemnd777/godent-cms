import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

const navigationRepair = process.argv.at(-1) === '--navigation-repair';
const homepage = process.argv.at(-1) === '--homepage' || navigationRepair;
const migration = navigationRepair ? '0068_signature_listing_navigation.sql' : homepage ? '0067_navigation_availability.sql' : '0066_public_read_performance.sql';
const expected = navigationRepair ? '59d518579ce991c758ec1b218bce575d78e09993e70125185ea8d186a53376ef' : homepage ? 'fbbfe405710b305e782abe522e7e49626719b038cd12d1e5448f0c1407c3dab8' : 'cd3445a951e05d778c98441c946a42ce430a08cb2aa1ab9b5440ab7abe2bfcaf';
const baselinePath = homepage ? '.local/website-home-performance-baseline.json' : '.local/website-performance-baseline.json';
const evidencePrefix = navigationRepair ? 'acceptance-' : homepage ? 'home-' : '';
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const identifier = (name: string) => { if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid identifier'); return '"' + name + '"'; };
class CompilationRollback extends Error {}
type Fingerprint = { table: string; rows: number; digest: string };

async function main() {
  const [flag, mode, slice] = process.argv.slice(2);
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || (slice === undefined ? process.argv.length !== 4 : !['--homepage', '--navigation-repair'].includes(slice) || process.argv.length !== 5) || flag !== '--local-website-performance' || !['capture', 'compare', 'compile', 'apply'].includes(mode)) throw new Error('Explicit pinned local performance phase required');
  const db = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try {
    if (mode === 'capture' || mode === 'compare') {
      const tables = await db.begin(async tx => {
        await tx.unsafe("SET LOCAL ROLE gcms_s02_owner; SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY; SET LOCAL statement_timeout='30s'");
        const names = await tx`SELECT schemaname,tablename FROM pg_tables WHERE schemaname LIKE 'gcms_%' AND schemaname<>'gcms_s02_auth' ORDER BY schemaname,tablename`;
        const result: Fingerprint[] = [];
        for (const row of names) {
          // schema_migration is checked independently; each migration adds one receipt.
          if (row.schemaname === 'gcms_s02' && row.tablename === 'schema_migration') continue;
          const table = identifier(row.schemaname) + '.' + identifier(row.tablename);
          const stats = await tx.unsafe(`SELECT count(*)::integer AS rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest FROM ${table} t`);
          result.push({ table: row.schemaname + '.' + row.tablename, rows: stats[0].rows, digest: stats[0].digest });
        }
        return result;
      });
      if (mode === 'capture') {
        await writeFile(baselinePath, JSON.stringify({ owner: 'GCMS-WEBSITE-PERF-001', tables }) + '\n', { flag: 'wx', mode: 0o600 });
        console.info(JSON.stringify({ status: 'PASS', mode, tables: tables.length, rows: tables.reduce((sum, table) => sum + table.rows, 0), limits: 'Exact retained application-table row multiset hashes; auth schema excluded, no raw rows exported.' }));
      } else {
        const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as { owner: string; tables: Fingerprint[] };
        if (baseline.owner !== 'GCMS-WEBSITE-PERF-001') throw new Error('Wrong baseline');
        const passed = JSON.stringify(tables) === JSON.stringify(baseline.tables);
        const report = { status: passed ? 'PASS' : 'FAIL', recordedAt: new Date().toISOString(), tables: tables.length, rows: tables.reduce((sum, table) => sum + table.rows, 0), changed: tables.filter(table => !baseline.tables.some(old => JSON.stringify(old) === JSON.stringify(table))), limits: 'Exact application-table row multiset hashes. Auth schema excluded; no credential/session changes performed. Migration receipts checked separately.' };
        await writeFile(`docs/evidence/website-performance/${evidencePrefix}preservation.json`, JSON.stringify(report, null, 2) + '\n');
        console.info(JSON.stringify(report)); if (!passed) process.exitCode = 1;
      }
      return;
    }
    const source = await readFile('apps/api/migrations/' + migration);
    if (sha(source) !== expected) throw new Error('Migration pin changed');
    let applied = false, checked = 0;
    try {
      await db.begin(async tx => {
        await tx.unsafe("SET LOCAL ROLE gcms_s02_owner; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='20s'");
        await tx`SELECT pg_advisory_xact_lock(728293018)`;
        for (const row of await tx`SELECT name,checksum FROM gcms_s02.schema_migration ORDER BY name`) {
          if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(row.name) || sha(await readFile('apps/api/migrations/' + row.name)) !== row.checksum) throw new Error('Applied migration bytes changed');
          checked++;
        }
        const prior = await tx`SELECT checksum FROM gcms_s02.schema_migration WHERE name=${migration}`;
        if (!prior.length) {
          await tx.unsafe(source.toString('utf8'));
          await tx`INSERT INTO gcms_s02.schema_migration(name,checksum) VALUES(${migration},${expected})`;
          applied = true;
        }
        if (mode === 'compile') throw new CompilationRollback();
      });
    } catch (error) { if (!(error instanceof CompilationRollback)) throw error; }
    const report = { status: 'PASS', recordedAt: new Date().toISOString(), mode, migration, checksum: expected, retainedChecksums: checked, applied: mode === 'apply' && applied, intentionallyRolledBack: mode === 'compile', dispatchStarted: false };
    await writeFile(`docs/evidence/website-performance/${evidencePrefix}migration-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
    console.info(JSON.stringify(report));
  } finally { await db.close(); }
}

void main().catch(error => {
  const value = error as { code?: string; message?: string; position?: string; where?: string };
  void writeFile(`.local/website-performance-error-${Date.now()}.json`, JSON.stringify({ code: value.code, message: value.message, position: value.position, where: value.where }) + '\n', { flag: 'wx', mode: 0o600 }).finally(() => { console.error('Local performance check failed; private diagnostic retained.'); process.exitCode = 1; });
});
