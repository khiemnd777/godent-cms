import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || !process.argv.includes('--local-m5')) throw new Error('Explicit pinned M5 preflight required');
  const source = new URL(process.env.DATABASE_URL ?? '');
  if (source.protocol !== 'postgresql:' || source.hostname !== '127.0.0.1' || source.port !== '5888' || source.pathname !== '/gcms_s01' || source.username !== 'gcms_local' || source.search || source.hash) throw new Error('Wrong retained database');
  const baseline = await lstat('.local/m5-baseline.json');
  if (!baseline.isFile() || baseline.isSymbolicLink() || (baseline.mode & 0o777) !== 0o600) throw new Error('Missing preservation baseline');
  const db = new SQL(source.href, { max: 1, connectionTimeout: 3, connection: { default_transaction_read_only: 'on' } });
  try {
    const migrations = await db`SELECT name,checksum FROM gcms_s02.schema_migration ORDER BY name`;
    const checks = [];
    for (const item of migrations) {
      if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(String(item.name))) throw new Error('Unexpected migration identity');
      const digest = createHash('sha256').update(await readFile(`apps/api/migrations/${item.name}`)).digest('hex');
      checks.push({ name: item.name, checksum: digest, status: digest === item.checksum ? 'PASS' : 'FAIL' });
    }
    if (checks.some(item => item.status !== 'PASS')) throw new Error('Retained checksum mismatch');
    const functions = await db`SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('gcms_s02','gcms_s05','gcms_s06','gcms_s07','gcms_s08','gcms_m3','gcms_m4') ORDER BY n.nspname,p.proname,p.oid`;
    await writeFile('.local/m5-functions-before.json', JSON.stringify(functions) + '\n', { flag: 'wx', mode: 0o600 });
    await writeFile('docs/evidence/m5/preflight.json', JSON.stringify({ status: 'PASS', recordedAt: new Date().toISOString(), migrations: checks, dispatchStarted: false, limits: 'Read-only applied checksum and function-catalog inspection. No backup/restore or product behavior proof.' }, null, 2) + '\n', { flag: 'wx' });
    console.info(JSON.stringify({ status: 'PASS', retainedMigrations: checks.length, functionsInspected: functions.length, dispatchStarted: false }));
  } finally { await db.close(); }
}
void main().catch(() => { console.error('M5 preflight refused/failed; details redacted.'); process.exitCode = 1; });
