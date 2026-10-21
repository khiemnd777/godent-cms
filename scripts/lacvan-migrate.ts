import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

const approved = ['0060_signature_template.sql', '0061_signature_intake_sources.sql', '0062_signature_search.sql'];
const frozen: Record<string, string> = {
  '0060_signature_template.sql': '8a6755f5b584c6fcceaefa29e4fd72ef80c33ef03293408c82c235f2a0271fed',
  '0061_signature_intake_sources.sql': 'c45e413f45628ee7ef526bb38f7e89e9725640b8f6c1e2d51bd29ebbe243ed0f',
  '0062_signature_search.sql': '45ba9b914c15ed1344e514aa41aee7e246cc84f5bf7830ca4c4989e2e2b8413d',
  '0063_signature_clock_repair.sql': '9e8a07c25aaac0db8916fe46d8747854d686fa7bc7cf681e5ba1a69a2f45a145',
  '0064_signature_search_budget.sql': 'e20ffb9bf95baaffacdb502ba819599621bdec32dc7e9ba9fe9c15ab6309d775',
  '0065_signature_hero_typography.sql': '1c43700dcb2fb617f802274e7c729a115ae308e234ccfbf3bcbd261921095972',
};
class CompilationRollback extends Error {}
async function main() {
  const [flag, mode, slice] = process.argv.slice(2);
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || ![4, 5].includes(process.argv.length) || flag !== '--local-lacvan' || !['--check-only', '--compile-only', '--apply'].includes(mode ?? '') || (slice !== undefined && !['--clock', '--search', '--hero-typography'].includes(slice))) throw new Error('Explicit bounded clinic migration required');
  const selected = slice === '--clock' ? ['0063_signature_clock_repair.sql'] : slice === '--search' ? ['0064_signature_search_budget.sql'] : slice === '--hero-typography' ? ['0065_signature_hero_typography.sql'] : approved;
  const db = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  let checked = 0; const compiled: string[] = [];
  try {
    try {
      await db.begin(async tx => {
        await tx.unsafe("SET LOCAL ROLE gcms_s02_owner; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='20s'");
        await tx`SELECT pg_advisory_xact_lock(728293018)`;
        for (const row of await tx`SELECT name,checksum FROM gcms_s02.schema_migration ORDER BY name`) {
          if (typeof row.name !== 'string' || !/^\d{4}_[a-z0-9_]+\.sql$/.test(row.name)) throw new Error('Unsafe applied migration name');
          if (createHash('sha256').update(await readFile(`apps/api/migrations/${row.name}`)).digest('hex') !== row.checksum) throw new Error('Retained migration bytes changed');
          checked++;
        }
        if (mode === '--check-only') return;
        for (const name of selected) {
          const source = await readFile(`apps/api/migrations/${name}`, 'utf8'), checksum = createHash('sha256').update(source).digest('hex');
          if (checksum !== frozen[name]) throw new Error('Clinic migration differs from compiled source');
          const old = await tx`SELECT checksum FROM gcms_s02.schema_migration WHERE name=${name}`;
          if (old.length) { if (old[0].checksum !== checksum) throw new Error('Applied clinic migration changed'); continue; }
          await tx.unsafe(source);
          await tx`INSERT INTO gcms_s02.schema_migration(name,checksum) VALUES(${name},${checksum})`;
          compiled.push(name);
        }
        if (mode === '--compile-only') throw new CompilationRollback();
      });
    } catch (e) { if (!(e instanceof CompilationRollback)) throw e; }
    const report = { status: 'PASS', recordedAt: new Date().toISOString(), phase: mode, slice: slice ?? 'template', priorChecksums: checked, compiled, sourceChecksums: Object.fromEntries(selected.map(name => [name, frozen[name]])), committed: mode === '--apply', intentionallyRolledBack: mode === '--compile-only', dispatchStarted: false };
    await writeFile(`docs/evidence/lacvan/migration-${Date.now()}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.info(JSON.stringify(report));
  } finally { await db.close(); }
}
void main().catch(async error => {
  const e = error as { code?: string; message?: string; detail?: string; position?: string; where?: string };
  const path = `.local/lacvan-migration-error-${Date.now()}.json`;
  await writeFile(path, JSON.stringify({ code: e.code, message: e.message, detail: e.detail, position: e.position, where: e.where }) + '\n', { flag: 'wx', mode: 0o600 });
  console.error(JSON.stringify({ status: 'FAIL', phase: 'clinic-migration', code: e.code ?? 'UNKNOWN', diagnosticPath: path, rolledBack: true })); process.exitCode = 1;
});
