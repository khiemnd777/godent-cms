import { SQL } from 'bun';
import { randomBytes } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

async function main() {
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || !process.argv.includes('--local-m5')) throw new Error('Explicit pinned local M5 required');
  const admin = new URL(process.env.DATABASE_URL ?? '');
  if (admin.protocol !== 'postgresql:' || admin.hostname !== '127.0.0.1' || admin.port !== '5888' || admin.pathname !== '/gcms_s01' || admin.username !== 'gcms_local' || admin.search || admin.hash) throw new Error('Wrong retained database');
  const directory = await lstat('.local');
  if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700) throw new Error('Unsafe private directory');
  const path = '.local/m5.env', existed = await Bun.file(path).exists();
  if (!existed) {
    const worker = new URL(admin); worker.username = 'gcms_m5_worker'; worker.password = randomBytes(32).toString('hex');
    await writeFile(path, `M5_LIFECYCLE_DATABASE_URL=${worker.href}\n`, { flag: 'wx', mode: 0o600 });
  }
  const meta = await lstat(path);
  if (!meta.isFile() || meta.isSymbolicLink() || (meta.mode & 0o777) !== 0o600 || meta.uid !== process.getuid?.()) throw new Error('Unsafe worker configuration');
  const lines = (await readFile(path, 'utf8')).trim().split('\n');
  if (lines.length !== 1 || !lines[0].startsWith('M5_LIFECYCLE_DATABASE_URL=')) throw new Error('Unexpected worker configuration');
  const worker = new URL(validateDatabaseUrl(lines[0].slice(lines[0].indexOf('=') + 1), 'gcms_m5_worker'));
  const db = new SQL(admin.href, { max: 1, connectionTimeout: 3 });
  try {
    const result = await db.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(728293018)`;
      const prior = await tx`SELECT shobj_description(oid,'pg_authid') AS marker,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='gcms_m5_worker'`;
      if (prior.length) {
        if (!existed || prior[0].marker !== 'gcms_m5_worker_v1' || prior[0].rolsuper || prior[0].rolbypassrls || prior[0].rolcreatedb || prior[0].rolcreaterole) throw new Error('Unowned worker collision');
      } else {
        await tx.unsafe('CREATE ROLE gcms_m5_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
        await tx.unsafe("COMMENT ON ROLE gcms_m5_worker IS 'gcms_m5_worker_v1'");
        await tx`SELECT set_config('gcms.m5_new_worker_password',${decodeURIComponent(worker.password)},true)`;
        await tx.unsafe("DO $$ BEGIN EXECUTE format('ALTER ROLE gcms_m5_worker PASSWORD %L',current_setting('gcms.m5_new_worker_password')); END $$");
        await tx.unsafe('GRANT CONNECT ON DATABASE gcms_s01 TO gcms_m5_worker');
      }
      const schema = await tx`SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='gcms_m5'`;
      if (schema.length && schema[0].owner !== 'gcms_s02_owner') throw new Error('Unowned schema collision');
      if (!schema.length) await tx.unsafe('CREATE SCHEMA gcms_m5 AUTHORIZATION gcms_s02_owner');
      await tx.unsafe('REVOKE ALL ON SCHEMA gcms_m5 FROM PUBLIC');
      return { workerCreated: !prior.length, schemaCreated: !schema.length };
    });
    console.info(JSON.stringify({ status: 'PASS', ...result, retainedCredentialsChanged: false, dispatchStarted: false }));
  } finally { await db.close(); }
}
if (import.meta.main) void main().catch(() => { console.error('M5 bootstrap refused/failed; details redacted.'); process.exitCode = 1; });
