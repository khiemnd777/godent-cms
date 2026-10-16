import { SQL } from 'bun';
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

const labels = ['A1','A2','B1','multiAB','PlatformOnly','noMembership'] as const;
export interface S02Fixtures {
  tenants: { A: string; B: string };
  identities: Array<{ label: typeof labels[number]; userId: string; email: string; password: string; totpSecret?: string; backupCodes?: string[] }>;
}

// Test-only password login helper. Importing never seeds or starts a listener.
// Retained private fixture passwords and legacy factor bytes are never rewritten.
export async function openFixtureSession(identity: ReturnType<typeof createS02Auth>, label: typeof labels[number], transport?: (request: Request) => Promise<Response>) {
  const path = resolve(process.cwd(), '.local/s02-fixtures.json');
  const manifest = JSON.parse(await readFile(path, 'utf8')) as S02Fixtures;
  const fixture = manifest.identities.find(item => item.label === label);
  if (!fixture) throw new Error('Synthetic fixture missing');
  return openPasswordSession(identity, fixture, transport);
}
export async function openPasswordSession(identity: ReturnType<typeof createS02Auth>, fixture: { userId: string; email: string; password: string },
  transport?: (request: Request) => Promise<Response>) {
  const jar = new Map<string, string>();
  async function call(endpoint: string, body?: unknown) {
    const headers = new Headers({ origin: 'http://127.0.0.1:5891' });
    if (jar.size) headers.set('cookie', [...jar].map(([key,value]) => `${key}=${value}`).join('; '));
    if (body !== undefined) headers.set('content-type','application/json');
    const response = await (transport ?? identity.handler)(new Request(`http://127.0.0.1:5890/api/auth${endpoint}`,
      { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) }));
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0]; const index = pair.indexOf('=');
      if (index > 0) { const name = pair.slice(0,index); const cookie = pair.slice(index+1); if (cookie) jar.set(name,cookie); else jar.delete(name); }
    }
    return response;
  }
  const signIn = await call('/sign-in/email', { email: fixture.email, password: fixture.password, rememberMe: false });
  if (signIn.status !== 200) throw new Error(`Synthetic sign-in failed status ${signIn.status}`);
  const headers = new Headers({ cookie: [...jar].map(([key,value]) => `${key}=${value}`).join('; ') });
  const actor = await identity.currentSession(headers);
  if (!actor) throw new Error('Synthetic password session absent');
  return { actor, headers, fixture, call,
    currentHeaders: () => new Headers({ cookie: [...jar].map(([key,value]) => `${key}=${value}`).join('; ') }) };
}
export async function fixturesS02() {
  if (!process.argv.includes('--local-s02') || !process.argv.includes('--synthetic-fixtures')) throw new Error('Explicit local synthetic fixture opt-in required');
  const root = resolve(import.meta.dir, '..');
  if (process.cwd() !== root) throw new Error('Run fixtures from repository root');
  const path = resolve(root, '.local/s02-fixtures.json');
  await mkdir(resolve(root, '.local'), { recursive: true, mode: 0o700 });
  if (!await Bun.file(path).exists()) {
    const fixtures: S02Fixtures = { tenants: { A: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      identities: labels.map((label, index) => ({ label, userId: `10000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
        email: `${label.toLowerCase()}@s02.example.test`, password: randomBytes(24).toString('base64url') })) };
    await writeFile(path, JSON.stringify(fixtures, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  await chmod(path, 0o600);
  const fixtures = JSON.parse(await readFile(path, 'utf8')) as S02Fixtures;
  if (fixtures.identities.length !== 6 || labels.some(label => !fixtures.identities.find(item => item.label === label))) throw new Error('Incomplete fixture manifest');
  const db = createS02Database();
  const identity = createS02Auth(db);
  const owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  try {
    await db.verifyRoles();
    const context = await identity.auth.$context;
    for (const item of fixtures.identities) {
      const existing = await context.internalAdapter.findUserByEmail(item.email, { includeAccounts: true });
      if (existing) {
        if (existing.user.id !== item.userId || !existing.accounts.some(account => account.providerId === 'credential')) throw new Error('Existing fixture identity mismatch; retained untouched');
        continue;
      }
      // This explicit local-only synthetic fixture path may mark synthetic
      // email as verified. Generic HTTP registration always remains unverified.
      const password = await context.password.hash(item.password);
      const user = await context.internalAdapter.createUser({ id: item.userId, name: `S02 ${item.label}`, email: item.email, emailVerified: true,
        platformAdmin: item.label === 'PlatformOnly' }, { method: 'email-password' });
      if (user.id !== item.userId) throw new Error('Fixture identity ID mismatch');
      await context.internalAdapter.createAccount({ userId: user.id, accountId: user.id, providerId: 'credential', password });
    }
    await owner.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      for (const [label, tenant] of Object.entries(fixtures.tenants)) {
        await tx`insert into gcms_s02.tenant(id,name) values(${tenant},${`S02 Synthetic ${label}`}) on conflict(id) do nothing`;
      }
      for (const item of fixtures.identities) {
        const tenants = item.label === 'multiAB' ? [fixtures.tenants.A,fixtures.tenants.B] : ['A1','A2'].includes(item.label) ? [fixtures.tenants.A] : item.label === 'B1' ? [fixtures.tenants.B] : [];
        for (const tenant of tenants) await tx`insert into gcms_s02.membership(tenant_id,user_id) values(${tenant},${item.userId}) on conflict(tenant_id,user_id) do nothing`;
      }
    });
    console.info('S02 two-tenant/six-identity synthetic fixtures ready; passwords retained only in private fixture file. Password-only authentication.');
  } finally { await db.close(); await owner.close(); }
}
if (import.meta.main) fixturesS02().catch(() => { console.error('S02 fixtures failed; retained data and private manifest preserved.'); process.exitCode = 1; });
