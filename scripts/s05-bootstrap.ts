import { SQL } from 'bun';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

export async function bootstrapS05() {
  if (process.cwd() !== resolve(import.meta.dir, '..') || !process.argv.includes('--local-s05')) throw new Error('Explicit local S05 scope required');
  const admin = new URL(process.env.DATABASE_URL ?? '');
  if (admin.hostname !== '127.0.0.1' || admin.port !== '5888' || admin.pathname !== '/gcms_s01' || admin.username !== 'gcms_local' || admin.search || admin.hash) throw new Error('Unexpected local database');
  const path = resolve('.local/s05.env'); await mkdir(resolve('.local'), { recursive: true, mode: 0o700 });
  const existed = await Bun.file(path).exists();
  if (!existed) {
    const roleUrl = new URL(admin); roleUrl.username = 'gcms_s05_worker'; roleUrl.password = randomBytes(32).toString('hex');
    await writeFile(path, `S05_WORKER_DATABASE_URL=${roleUrl.href}\n`, { flag: 'wx', mode: 0o600 });
  }
  if (((await stat(path)).mode & 0o777) !== 0o600) throw new Error('Unsafe S05 private configuration mode');
  const env = Object.fromEntries((await readFile(path, 'utf8')).trim().split('\n').map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
  const roleUrl = new URL(validateDatabaseUrl(env.S05_WORKER_DATABASE_URL, 'gcms_s05_worker'));
  const client = new SQL(admin.href, { max: 1, connectionTimeout: 3 });
  try {
    await client.begin(async tx => {
      const found = await tx`SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname='gcms_s05_worker'`;
      if (found.length) {
        if (!existed || found[0].marker !== 'gcms_s05_bootstrap_v1') throw new Error('Existing worker role requires original credential');
      } else {
        await tx.unsafe('CREATE ROLE gcms_s05_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
        await tx.unsafe("COMMENT ON ROLE gcms_s05_worker IS 'gcms_s05_bootstrap_v1'");
        await tx`SELECT set_config('gcms.s05_new_password',${decodeURIComponent(roleUrl.password)},true)`;
        await tx.unsafe("DO $$ BEGIN EXECUTE format('ALTER ROLE gcms_s05_worker PASSWORD %L',current_setting('gcms.s05_new_password')); END $$");
        await tx.unsafe('GRANT CONNECT ON DATABASE gcms_s01 TO gcms_s05_worker');
      }
      const schema = await tx`SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='gcms_s05'`;
      if (schema.length && schema[0].owner !== 'gcms_s02_owner') throw new Error('Unowned S05 schema collision');
      if (!schema.length) await tx.unsafe('CREATE SCHEMA gcms_s05 AUTHORIZATION gcms_s02_owner');
      await tx.unsafe('REVOKE ALL ON SCHEMA gcms_s05 FROM PUBLIC');
    });
    const worker = new SQL(roleUrl.href, { max: 1, connectionTimeout: 3 });
    try { await worker`SELECT 1`; } finally { await worker.close(); }
    console.info('S05 new worker role ready; retained roles and credentials unchanged.');
  } finally { await client.close(); }
}
if (import.meta.main) bootstrapS05().catch(() => { console.error('S05 bootstrap failed; details redacted.'); process.exitCode = 1; });
