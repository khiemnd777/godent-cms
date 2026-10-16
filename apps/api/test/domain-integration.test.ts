import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { INestApplication } from '@nestjs/common';
import { createS02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { loadRuntimeEnvironment } from '../src/auth/runtime-environment';
import { openFixtureSession, type S02Fixtures } from '../../../scripts/s02-fixtures';
import type { CurrentSession, InvitationSummary, MemberSummary, Page, ServiceDraft, TenantSummary } from '../src/contracts/s02';
import { encodePageCursor } from '../src/modules/request-security';

type FixtureSession = Awaited<ReturnType<typeof openFixtureSession>>;
type Label = S02Fixtures['identities'][number]['label'];
interface Client { session: FixtureSession; current: CurrentSession; request: typeof request }
let base = '';
let application: INestApplication | undefined;
let database: ReturnType<typeof createS02Database> | undefined;
let identity: ReturnType<typeof createS02Auth>;
let fixtures: S02Fixtures;
const clients = new Map<Label, Client>();
const runId = randomUUID();

async function request<T>(this: Client, path: string, method = 'GET', body?: unknown, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891',
    cookie: this.session.headers.get('cookie') ?? '', ...extraHeaders };
  if (method !== 'GET') { headers['content-type'] = 'application/json'; headers['x-csrf-token'] = this.current.csrfToken; }
  Object.assign(headers, extraHeaders);
  const response = await fetch(base + path, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(12000) });
  const value = await response.json() as T;
  return { status: response.status, headers: response.headers, value };
}
function client(label: Label): Client {
  const value = clients.get(label); if (!value) throw new Error('Synthetic test client absent'); return value;
}
async function mailSnapshot() { return new Set(await readdir(resolve('.local/s02-mail')).catch(() => [])); }
async function invitationToken(email: string, previous: Set<string>) {
  for (const file of await readdir(resolve('.local/s02-mail'))) {
    if (previous.has(file) || !file.endsWith('.json')) continue;
    const item = JSON.parse(await readFile(resolve('.local/s02-mail', file), 'utf8')) as { to: string; type: string; url: string };
    if (item.to !== email || item.type !== 'invitation') continue;
    const token = new URLSearchParams(new URL(item.url).hash.slice(1)).get('token');
    if (token) return token;
  }
  throw new Error('Expected private synthetic invitation capture absent');
}
async function provision(first: Label = 'A1') {
  const target = client(first); const before = await mailSnapshot();
  const result = await client('PlatformOnly').request<{ tenant: TenantSummary; invitation: InvitationSummary }>(
    '/api/platform/tenants', 'POST', { name: `S02 domain ${runId}`, initialAdminEmail: target.session.fixture.email });
  expect(result.status).toBe(201);
  const token = await invitationToken(target.session.fixture.email, before);
  return { tenantId: result.value.tenant.id, token };
}
async function addMember(tenantId: string, member: Label, by: Label = 'A1') {
  const before = await mailSnapshot();
  const invited = await client(by).request<InvitationSummary>(`/api/tenants/${tenantId}/invitations`, 'POST', { email: client(member).session.fixture.email });
  expect(invited.status).toBe(201);
  const token = await invitationToken(client(member).session.fixture.email, before);
  const accepted = await client(member).request('/api/invitations/accept', 'POST', { token });
  expect(accepted.status).toBe(200);
  return { token, invitationId: invited.value.id };
}
async function tenantWithTwoMembers() {
  const value = await provision();
  expect((await client('A1').request('/api/invitations/accept', 'POST', { token: value.token })).status).toBe(200);
  await addMember(value.tenantId, 'A2');
  return value.tenantId;
}

// The ordinary unit suite must not seed, enroll factors, start listeners or open databases.
// The coordinator runs this suite sequentially after the owned local migration/fixture preflight.
describe.skipIf(process.env.S02_INTEGRATION !== '1')('S02 real HTTP and restricted database domain integration', () => {
  beforeAll(async () => {
    const runtime = await loadRuntimeEnvironment();
    Object.assign(process.env, runtime.api);
    fixtures = JSON.parse(await readFile(resolve('.local/s02-fixtures.json'), 'utf8')) as S02Fixtures;
    database = createS02Database(); identity = createS02Auth(database);
    // Nest requires emitted decorator metadata; do not run the TS controller directly.
    const compiled = await import('../dist/app.js' as string) as { createApp(): Promise<INestApplication> };
    application = await compiled.createApp(); await application.listen(0, '127.0.0.1');
    base = await application.getUrl();
    const transport = (incoming: Request) => fetch(base + new URL(incoming.url).pathname, { method: incoming.method,
      headers: { ...Object.fromEntries(incoming.headers), host: '127.0.0.1:5890' }, body: incoming.body,
      redirect: 'manual', signal: AbortSignal.timeout(12000) });
    // Factor enrollment is deliberately sequential. Credentials and authenticators stay in .local.
    const labels = ['A1', 'A2', 'B1', 'multiAB', 'PlatformOnly', 'noMembership'] as const;
    for (const [index, label] of labels.entries()) {
      // Better Auth 1.7.10 special sign-in and MFA limits are 3 requests / 10 s.
      // Pace fixtures below that limit; exercise the same production control.
      if (index > 0 && index % 2 === 0) await Bun.sleep(11000);
      const session = await openFixtureSession(identity, label, transport);
      const response = await fetch(base + '/api/session', { headers: { cookie: session.headers.get('cookie') ?? '', host: '127.0.0.1:5890' } });
      if (response.status !== 200) throw new Error(`HTTP synthetic session unavailable (${response.status})`);
      clients.set(label, { session, current: await response.json() as CurrentSession, request });
    }
  }, 120000);
  afterAll(async () => { await application?.close(); await database?.close(); });

  test('real HTTP password login returns a current session and selected memberships', async () => {
    expect(client('A1').current.session).not.toHaveProperty('mfaVerified');
    expect(client('A1').current.user).not.toHaveProperty('twoFactorEnabled');
    expect(client('multiAB').current.tenantMemberships.some(item => item.tenantId === fixtures.tenants.A)).toBe(true);
    expect(client('multiAB').current.tenantMemberships.some(item => item.tenantId === fixtures.tenants.B)).toBe(true);
    expect(client('PlatformOnly').current.platformAdmin).toBe(true);
    expect(client('PlatformOnly').current.tenantMemberships.length).toBe(0);
    expect(client('noMembership').current.tenantMemberships.length).toBe(0);
    const anonymous = await fetch(base + '/api/session', { headers: { host: '127.0.0.1:5890' } });
    expect(anonymous.status).toBe(401); await anonymous.body?.cancel();
  });

  test('private drafts deny direct API spoofing, wrong tenants and platform-only access', async () => {
    const a = fixtures.tenants.A; const b = fixtures.tenants.B;
    const created = await client('A1').request<ServiceDraft>(`/api/tenants/${a}/services`, 'POST', { title: 'Private VI', body: `Synthetic ${runId}` });
    expect(created.status).toBe(201); expect(created.value.tenantId).toBe(a);
    const path = `/api/tenants/${a}/services/${created.value.id}`;
    expect((await client('A1').request(path, 'GET', undefined, { 'x-tenant-id': b })).status).toBe(200);
    expect((await client('B1').request(path)).status).toBe(403);
    expect((await client('PlatformOnly').request(path)).status).toBe(403);
    expect((await client('noMembership').request(path)).status).toBe(403);
    expect((await client('B1').request(`/api/tenants/${b}/services/${created.value.id}`)).status).toBe(404);
    expect((await client('A1').request(`/api/tenants/${a}/services`, 'POST', { title: 'x', body: '', tenantId: b })).status).toBe(400);
    expect((await client('A1').request(`/api/tenants/${a}/services`, 'POST', { title: 'x', body: '' }, { 'x-csrf-token': '' })).status).toBe(403);
    expect((await client('A1').request(`/api/tenants/${a}/services`, 'POST', { title: 'x', body: '' }, { 'x-csrf-token': 'wrong' })).status).toBe(403);
    expect((await client('A1').request(path, 'GET', undefined, { origin: 'http://localhost:5892' })).status).toBe(403);
    expect((await client('A1').request(path, 'GET', undefined, { host: 'other.test' })).status).toBe(400);
    const cursor = encodePageCursor(`${b}:services`, created.value.id);
    expect((await client('A1').request(`/api/tenants/${a}/services?cursor=${cursor}`)).status).toBe(400);
  });

  test('concurrent saves retain exactly one expected-version update and private preview', async () => {
    const path = `/api/tenants/${fixtures.tenants.A}/services`;
    const created = await client('A1').request<ServiceDraft>(path, 'POST', { title: 'Version test', body: 'First' });
    expect(created.status).toBe(201);
    const results = await Promise.all(['Second A', 'Second B'].map(body => client('A1').request<ServiceDraft>(`${path}/${created.value.id}`, 'PUT',
      { title: 'Version test', body, expectedVersion: 1 })));
    expect(results.map(value => value.status).sort()).toEqual([200, 409]);
    const saved = await client('A1').request<ServiceDraft>(`${path}/${created.value.id}/preview`);
    expect(saved.status).toBe(200); expect(saved.value.version).toBe(2);
    expect(['Second A', 'Second B'].includes(saved.value.body)).toBe(true);
    expect(saved.headers.get('cache-control')?.includes('no-store')).toBe(true);
    expect(saved.headers.get('x-robots-tag')?.includes('noindex')).toBe(true);
    expect((await client('B1').request(`${path}/${created.value.id}/preview`)).status).toBe(403);
  });

  test('one multi-tenant session keeps interleaved tab contexts separate', async () => {
    const paths = [fixtures.tenants.A, fixtures.tenants.B].map(id => `/api/tenants/${id}/services`);
    const a = await client('multiAB').request<ServiceDraft>(paths[0], 'POST', { title: 'Tab A', body: runId });
    const b = await client('multiAB').request<ServiceDraft>(paths[1], 'POST', { title: 'Tab B', body: runId });
    expect(a.status).toBe(201); expect(b.status).toBe(201);
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => {
      const which = index % 2; const id = which ? b.value.id : a.value.id;
      return client('multiAB').request<ServiceDraft>(`${paths[which]}/${id}`);
    }));
    for (const [index, response] of responses.entries()) {
      expect(response.status).toBe(200);
      expect(response.value.tenantId).toBe(index % 2 ? fixtures.tenants.B : fixtures.tenants.A);
    }
  });

  test('invitation acceptance fixes identity and role, rejects replay and voids resend/revocation tokens', async () => {
    const provisioned = await provision(); const path = `/api/tenants/${provisioned.tenantId}`;
    expect((await client('B1').request('/api/invitations/accept', 'POST', { token: provisioned.token })).status).toBe(409);
    expect((await client('A1').request('/api/invitations/accept', 'POST', { token: provisioned.token, role: 'platform_admin' })).status).toBe(400);
    const get = await fetch(base + '/api/invitations/accept', { headers: { host: '127.0.0.1:5890', cookie: client('A1').session.headers.get('cookie') ?? '' } });
    expect(get.status).toBe(404); await get.body?.cancel();
    expect((await client('A1').request('/api/invitations/accept', 'POST', { token: provisioned.token })).status).toBe(200);
    expect((await client('A1').request('/api/invitations/accept', 'POST', { token: provisioned.token })).status).toBe(409);
    expect((await client('A1').request(`${path}/invitations`, 'POST', { email: client('A2').session.fixture.email, role: 'platform_admin' })).status).toBe(400);
    const before = await mailSnapshot();
    const invited = await client('A1').request<InvitationSummary>(`${path}/invitations`, 'POST', { email: client('A2').session.fixture.email });
    expect(invited.status).toBe(201);
    const oldToken = await invitationToken(client('A2').session.fixture.email, before);
    const beforeResend = await mailSnapshot();
    const resent = await client('A1').request<InvitationSummary>(`${path}/invitations/${invited.value.id}/resend`, 'POST', {});
    expect(resent.status).toBe(200);
    const newToken = await invitationToken(client('A2').session.fixture.email, beforeResend);
    expect((await client('A2').request('/api/invitations/accept', 'POST', { token: oldToken })).status).toBe(409);
    const accepted = await Promise.all([1, 2].map(() => client('A2').request('/api/invitations/accept', 'POST', { token: newToken })));
    expect(accepted.map(item => item.status).sort()).toEqual([200, 409]);
    const beforeRevoke = await mailSnapshot();
    const revoke = await client('A1').request<InvitationSummary>(`${path}/invitations`, 'POST', { email: client('B1').session.fixture.email });
    expect(revoke.status).toBe(201);
    const revokedToken = await invitationToken(client('B1').session.fixture.email, beforeRevoke);
    expect((await client('A1').request(`${path}/invitations/${revoke.value.id}`, 'DELETE', {})).status).toBe(200);
    expect((await client('B1').request('/api/invitations/accept', 'POST', { token: revokedToken })).status).toBe(409);
    expect((await client('B1').request(`${path}/invitations`, 'POST', { email: client('B1').session.fixture.email })).status).toBe(403);
  });

  test('concurrent self-revokes preserve the last administrator and global disable cannot orphan that tenant', async () => {
    const tenantId = await tenantWithTwoMembers(); const path = `/api/tenants/${tenantId}`;
    const actors = [client('A1'), client('A2')];
    const results = await Promise.all(actors.map(actor => actor.request(`${path}/members/${actor.session.actor.userId}`, 'DELETE', {})));
    expect(results.map(item => item.status).sort()).toEqual([200, 409]);
    const survivor = actors[results.findIndex(item => item.status === 409)];
    const revoked = actors[results.findIndex(item => item.status === 200)];
    const members = await survivor.request<Page<MemberSummary>>(`${path}/members`);
    expect(members.status).toBe(200); expect(members.value.items.filter(item => item.status === 'active').length).toBe(1);
    expect((await revoked.request(`${path}/services`)).status).toBe(403);
    const disabled = await client('PlatformOnly').request(`/api/platform/users/${survivor.session.actor.userId}/disable`, 'POST', {});
    expect(disabled.status).toBe(409);
    expect((await survivor.request('/api/session')).status).toBe(200);
  });

  test('revocation waits for an authorized in-flight transaction and denies later requests', async () => {
    const tenantId = await tenantWithTwoMembers();
    let release!: () => void; let entered!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const inFlight = database!.withTenant(client('A1').session.actor, tenantId, async tx => {
      await tx.execute(sql`SELECT id FROM gcms_s02.service_draft WHERE tenant_id=${tenantId}`);
      entered(); await hold;
    });
    await ready;
    let revocationFinished = false;
    const revocation = client('A2').request(`/api/tenants/${tenantId}/members/${client('A1').session.actor.userId}`, 'DELETE', {})
      .then(value => { revocationFinished = true; return value; });
    try { await Bun.sleep(80); expect(revocationFinished).toBe(false); }
    finally { release(); }
    await inFlight;
    expect((await revocation).status).toBe(200);
    expect((await client('A1').request(`/api/tenants/${tenantId}/services`)).status).toBe(403);
    expect((await client('A2').request(`/api/tenants/${tenantId}/services`)).status).toBe(200);
  });
});
