import { SQL } from 'bun';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

// Coordinator-only local mutation entrypoint; never runs on module import.
export async function bootstrapS02() {
  const root = resolve(import.meta.dir, '..');
  if (process.cwd() !== root || !process.argv.includes('--local-s02')) throw new Error('Explicit --local-s02 from repository root required');
  const adminUrl = new URL(process.env.DATABASE_URL ?? '');
  if (adminUrl.hostname !== '127.0.0.1' || adminUrl.port !== '5888' || adminUrl.pathname !== '/gcms_s01' || adminUrl.username !== 'gcms_local') throw new Error('Unexpected S01 database');
  const path = resolve(root, '.local/s02.env');
  await mkdir(resolve(root, '.local'), { recursive: true, mode: 0o700 });
  const roles = ['migration', 'auth', 'tenant', 'platform'] as const;
  if (!await Bun.file(path).exists()) {
    const lines = roles.map(role => {
      const url = new URL(adminUrl); url.username = `gcms_s02_${role}`; url.password = randomBytes(32).toString('hex');
      return `S02_${role.toUpperCase()}_DATABASE_URL=${url.href}`;
    });
    await writeFile(path, lines.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  await chmod(path, 0o600);
  const env = Object.fromEntries((await readFile(path, 'utf8')).trim().split('\n').map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  const client = new SQL(adminUrl.href, { max: 1, connectionTimeout: 3 });
  try {
    await client.begin(async tx => {
      for (const role of ['owner', ...roles]) {
        const name = `gcms_s02_${role}`;
        const found = await tx`select shobj_description(oid,'pg_authid') as marker from pg_roles where rolname=${name}`;
        if (found.length && found[0].marker !== 'gcms_s02_bootstrap_v1') throw new Error('Unowned S02 role collision');
        // Names come only from the fixed role list. Credentials travel as bound values.
        if (!found.length) await tx.unsafe(`CREATE ROLE ${name} ${role === 'owner' ? 'NOLOGIN' : 'LOGIN'} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
        await tx.unsafe(`COMMENT ON ROLE ${name} IS 'gcms_s02_bootstrap_v1'`);
        if (role !== 'owner') {
          const roleUrl = new URL(env[`S02_${role.toUpperCase()}_DATABASE_URL`] ?? '');
          if (roleUrl.username !== name || roleUrl.hostname !== '127.0.0.1' || roleUrl.port !== '5888' || roleUrl.pathname !== '/gcms_s01') throw new Error('Invalid private S02 role configuration');
          await tx`select set_config('gcms.bootstrap_role',${name},true),set_config('gcms.bootstrap_password',${decodeURIComponent(roleUrl.password)},true)`;
          await tx.unsafe("DO $$ BEGIN EXECUTE format('ALTER ROLE %I PASSWORD %L',current_setting('gcms.bootstrap_role'),current_setting('gcms.bootstrap_password')); END $$");
        }
        await tx.unsafe(`GRANT CONNECT ON DATABASE gcms_s01 TO ${name}`);
      }
      await tx.unsafe('GRANT gcms_s02_owner TO gcms_s02_migration');
      for (const name of ['gcms_s02', 'gcms_s02_auth']) {
        const found = await tx`select pg_get_userbyid(nspowner) as owner from pg_namespace where nspname=${name}`;
        if (found.length && found[0].owner !== 'gcms_s02_owner') throw new Error('Unowned S02 schema collision');
        if (!found.length) await tx.unsafe(`CREATE SCHEMA ${name} AUTHORIZATION gcms_s02_owner`);
        await tx.unsafe(`REVOKE ALL ON SCHEMA ${name} FROM PUBLIC`);
      }
    });
    console.info('S02 restricted roles and private local configuration ready; existing S01 resources retained.');
  } finally { await client.close(); }
}
if (import.meta.main) bootstrapS02().catch(() => { console.error('S02 bootstrap failed; details redacted.'); process.exitCode = 1; });
