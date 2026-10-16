import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { M5Harness } from './m5-support';
import { M5_DOMAIN_ROUTES, type M5DomainsView, type M5DomainCommandResult } from '../src/contracts/m5-domains';
import { M3_ROUTES, type ContentCommandResult, type ContentDraft } from '../src/contracts/m3';
import { type M4Variant, type M4CommandResult } from '../src/contracts/m4';
import { S04_ROUTES, type IntakeInput } from '../src/contracts/s04';
import { S03_ROUTES } from '../src/contracts/s03';
import { legacyDocument } from '../src/contracts/content';
import { postgresCode } from '../src/database';

describe.skipIf(process.env.M5_INTEGRATION !== '1')('M5 real local API/SQL journeys on positively owned new fixtures', () => {
 const h = new M5Harness(); let page: M4Variant; let faq: ContentDraft; let domain: M5DomainsView; let accepted: IntakeInput;
 beforeAll(async () => { await h.setup(); }, 90000);
 afterAll(async () => { await h.close(); });
 async function domains() { const r = await h.call<M5DomainsView>(M5_DOMAIN_ROUTES.list(h.tenant().id)); expect(r.status).toBe(200); return r.value; }
 test('active private contracts and tenant/platform boundaries remain enforced', async () => {
  expect((await h.call(`/api/tenants/${h.tenant().id}/members`)).status).toBe(200);
  expect((await h.call(`/api/tenants/${h.tenant().id}/invitations`)).status).toBe(200);
  for (const who of ['B1', 'PlatformOnly']) {
   expect((await h.call(M5_DOMAIN_ROUTES.list(h.tenant().id), 'GET', undefined, who)).status).toBe(403);
   expect((await h.call(`/api/cms/tenants/${h.tenant().id}/m5/platform/export`, 'GET', undefined, who)).status).toBe(403);
  }
  const anonymous = await h.public(M5_DOMAIN_ROUTES.list(h.tenant().id)); expect(anonymous.status).toBe(401);
  const missing = await h.call('/api/platform/tenants', 'POST', { name: 'Must not be provisioned', initialAdminEmail: 'm5-never@example.test' }, 'PlatformOnly'); expect(missing.status).toBe(400);
  const s = await h.status(); expect(s.policy).toEqual({ mode: 'monitor', contentItemsLimit: null, mediaBytesLimit: null });
 });
 test('M4 config, immutable published pages and M3 content use real current contracts', async () => {
  await h.config('vi'); await h.config('en');
  page = await h.publish(await h.create('page'));
  const c = await h.call<ContentCommandResult>(M3_ROUTES.resources(h.tenant().id, 'faq'), 'POST', { operationId: randomUUID(), content: { kind: 'faq', slug: `m5-${h.run.slice(0,8)}-faq`, title: 'Câu hỏi M5 local', summary: 'Dữ liệu tổng hợp', body: legacyDocument('Câu trả lời minh họa.'), seo: { title: '', description: '' }, references: [] } }); expect(c.status).toBe(201); faq = c.value.draft; await h.record({ kind: 'faq', id: faq.id });
  const site = await h.call<{ version: number }>(S03_ROUTES.site(h.tenant().id)); expect(site.status).toBe(200);
  const p = await h.call<ContentCommandResult>(M3_ROUTES.resource(h.tenant().id, 'faq', faq.id) + '/publish', 'POST', { operationId: randomUUID(), expectedVersion: faq.version, expectedPublicationVersion: faq.publicationVersion, expectedPublicationRevision: faq.publicationRevision, expectedSiteVersion: site.value.version }); expect(p.status).toBe(200); faq = p.value.draft;
  expect((await h.call(M3_ROUTES.resource(h.tenant().id, 'faq', faq.id) + '/preview')).status).toBe(200);
 });
 test('content quota serializes concurrent legacy/M3 growth; locale and saved revisions do not grow usage', async () => {
  const before = await h.status(); await h.quota({ mode: 'enforced', contentItemsLimit: before.usage.contentItems + 1, mediaBytesLimit: null });
  const races = await Promise.all(Array.from({ length: 4 }, (_, index) => h.call(`/api/tenants/${h.tenant().id}/services`, 'POST', { title: `M5 race ${h.run}-${index}`, body: 'Synthetic' })));
  expect(races.filter(r => r.status === 201)).toHaveLength(1);
  for (const denied of races.filter(r => r.status !== 201)) { expect(denied.status).toBe(409); expect(denied.value.code).toBe('QUOTA_EXCEEDED'); expect(denied.value.dimension).toBe('content_items'); }
  expect((await h.status()).usage.contentItems).toBe(before.usage.contentItems + 1);
  const saved = await h.call<M4CommandResult>(h.path(page), 'PUT', { operationId: randomUUID(), expectedVersion: page.version, content: { ...page.content, title: 'M5 pending private draft' } }); expect(saved.status).toBe(200); page = saved.value.draft;
  expect((await h.status()).usage.contentItems).toBe(before.usage.contentItems + 1);
  await h.quota({ mode: 'enforced', contentItemsLimit: 0, mediaBytesLimit: null });
  expect((await h.call(h.path(page))).status).toBe(200); expect((await h.status()).usage.contentItems).toBe(before.usage.contentItems + 1);
  await h.quota({ mode: 'monitor', contentItemsLimit: null, mediaBytesLimit: null });
 });
 test('domain verification, exact binding, primary CAS and durable replay work through actual SQL', async () => {
  const host = `${h.tenant().slug}.localhost`; domain = await domains();
  let binding = domain.bindings.find(b => b.host === host && b.state !== 'removed');
  if (!binding) { const r = await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.register(h.tenant().id), 'POST', { operationId: randomUUID(), host }); expect(r.status).toBe(201); domain = r.value; binding = domain.bindings.find(b => b.id === r.value.bindingId); }
  expect(binding).toBeDefined();
  if (binding!.state === 'active') {
   const retry = await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.change(h.tenant().id, binding!.id, 'reverify'), 'POST', { operationId: randomUUID(), expectedVersion: binding!.version, expectedPrimaryVersion: domain.primary.version, reason: 'Explicit new local verification generation' });
   expect(retry.status).toBe(200); domain = retry.value; const id = binding!.id; binding = domain.bindings.find(b => b.id === id);
  }
  const v = await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.verify(h.tenant().id, binding!.id), 'POST', { operationId: randomUUID(), expectedVersion: binding!.version }); expect(v.status).toBe(200); domain = v.value; binding = domain.bindings.find(b => b.id === binding!.id)!;
  expect(binding.state).toBe('active'); expect(binding.origin).toBe(`http://${host}:5892`);
  const entry = await h.public(M5_DOMAIN_ROUTES.entry(host + ':5892', '/dich-vu/' + h.tenant().serviceSlug)); expect(entry.status).toBe(200); expect(entry.value?.tenantId).toBe(h.tenant().id);
  expect((await h.public(M5_DOMAIN_ROUTES.entry(host + ':5892', '/' + h.tenant('B').slug + '/dich-vu/' + h.tenant('B').serviceSlug))).value?.tenantId).toBe(h.tenant().id);
  expect((await h.public(M5_DOMAIN_ROUTES.entry(host + ':5892', '/sitemap.xml'))).status).toBe(200);
  expect((await h.public(M5_DOMAIN_ROUTES.entry('localhost:5892', '/' + h.tenant().slug + '/sitemap.xml'))).status).toBe(200);
  const command = { operationId: randomUUID(), expectedPrimaryVersion: domain.primary.version, mode: 'custom', bindingId: binding.id, expectedBindingVersion: binding.version, reason: 'Explicit local M5 primary verification' };
  const activation = await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.primary(h.tenant().id), 'POST', command); expect(activation.status).toBe(200); domain = activation.value;
  const replay = await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.primary(h.tenant().id), 'POST', command); expect(replay.status).toBe(200); expect(replay.value.replayed).toBe(true); expect(replay.value.appliedPrimaryVersion).toBe(domain.primary.version);
  const conflict = await h.call(M5_DOMAIN_ROUTES.primary(h.tenant().id), 'POST', { ...command, operationId: randomUUID() }); expect(conflict.status).toBe(409);
  expect((await h.call(M5_DOMAIN_ROUTES.primary(h.tenant().id), 'POST', { ...command, operationId: randomUUID(), expectedPrimaryVersion: domain.primary.version }, 'PlatformOnly')).status).toBe(403);
  await h.record({ kind: 'domain', id: binding.id, host, primaryVersion: domain.primary.version, pageId: page.id, pageSlug: (page.content as { slug: string }).slug });
 });
 test('cross-entry intake has one tenant-scoped accepted receipt and shared lead operations', async () => {
  accepted = { requestKey: randomUUID(), sourcePublicationId: h.tenant().publicationId!, name: 'M5 Tổng hợp', email: `m5-${h.run}@synthetic.example.test`, preferredLanguage: 'vi', preferredChannel: 'email', message: 'Yêu cầu thử local.', consent: true };
  const path = S04_ROUTES.intake(h.tenant().slug, h.tenant().serviceSlug);
  const challenge = await h.public<{ token: string; prompt: string }>(S04_ROUTES.challenge(h.tenant().slug, h.tenant().serviceSlug), 'POST', { requestKey: accepted.requestKey });
  expect(challenge.status).toBe(200); const numbers = challenge.value!.prompt.match(/\d+/g)!.map(Number); accepted.challenge = { token: challenge.value!.token, answer: String(numbers[0] + numbers[1]) };
  const [a,b] = await Promise.all([h.public(path, 'POST', accepted), h.public(path, 'POST', accepted, `http://${h.tenant().slug}.localhost:5892`)]);
  expect(a.status).toBe(200); expect(b.status).toBe(200); expect(a.value).toEqual({ status: 'accepted' }); expect(b.value).toEqual(a.value);
  const leads = await h.call<{ items: { id: string; version: number; emailMasked: string }[] }>(S04_ROUTES.leads(h.tenant().id)); expect(leads.status).toBe(200); const found = await h.owned(tx => tx`SELECT count(*)::integer AS n FROM gcms_s04.accepted_request WHERE tenant_id=${h.tenant().id} AND request_key=${accepted.requestKey}`); expect(found[0]?.n).toBe(1);
  const id = leads.value.items[0].id; await h.record({ kind: 'lead', id });
  const note = await h.call(S04_ROUTES.lead(h.tenant().id, id) + '/commands', 'POST', { operationId: randomUUID(), expectedVersion: leads.value.items[0].version, kind: 'note', text: 'Ghi chú thử M5.' }, 'A2'); expect(note.status).toBe(200);
  expect((await h.call(S04_ROUTES.lead(h.tenant().id, id), 'GET', undefined, 'B1')).status).toBe(403);
 });
 test('suspension preserves authorized read/export and denies business writes; safety unpublish still works', async () => {
  await h.lifecycle('suspend'); const s = await h.status(); expect(s.capabilities).toEqual({ read: true, export: true, businessWrite: false, safetyWrite: true });
  for (const path of [`/api/tenants/${h.tenant().id}/services`, `/api/tenants/${h.tenant().id}/members`, `/api/tenants/${h.tenant().id}/invitations`, S03_ROUTES.site(h.tenant().id), h.path(page), h.path(page) + '/history', h.path(page) + '/preview', M3_ROUTES.resource(h.tenant().id, 'faq', faq.id) + '/preview', S04_ROUTES.leads(h.tenant().id)]) expect((await h.call(path)).status).toBe(200);
  expect((await h.call(`/api/tenants/${h.tenant().id}/services`, 'POST', { title: 'Denied suspended', body: '' })).status).toBe(403);
  expect((await h.call(h.path(page), 'PUT', { operationId: randomUUID(), expectedVersion: page.version, content: page.content })).status).toBe(403);
  const exported = await h.response(`/api/cms/tenants/${h.tenant().id}/m5/platform/export?includeMedia=true`); expect(exported.status).toBe(200); expect(exported.headers.get('content-type')).toStartWith('application/zip'); const zip = new Uint8Array(await exported.arrayBuffer()); expect(zip[0]).toBe(0x50); expect(zip[1]).toBe(0x4b); await writeFile(`.local/m5-export-${h.run}.zip`, zip, { flag: 'wx', mode: 0o600 }); await h.record({ kind: 'export', path: `.local/m5-export-${h.run}.zip` });
  expect((await h.public(S03_ROUTES.publicService(h.tenant().slug,h.tenant().serviceSlug))).status).toBe(404);
  const path = S04_ROUTES.intake(h.tenant().slug,h.tenant().serviceSlug); expect((await h.public(path, 'POST', accepted)).status).toBe(200); expect((await h.public(path, 'POST', { ...accepted, requestKey: randomUUID() })).status).toBe(404);
  const unpublish = await h.call<M4CommandResult>(h.path(page) + '/unpublish', 'POST', { operationId: randomUUID(), expectedVersion: page.version, expectedPublicationRevision: page.publicationRevision }); expect(unpublish.status).toBe(200); page = unpublish.value.draft;
  await h.lifecycle('reactivate'); const reread = await h.call<M4Variant>(h.path(page)); expect(reread.status).toBe(200); expect(reread.value.activePublication).toBe(false);
 });
 test('forged safety selectors cannot write a suspended tenant through the restricted role', async () => {
  await h.lifecycle('suspend'); const actor = h.clients.get('A1')!.actor; let code: string | undefined;
  try { await h.db.tenantDb.transaction(async tx => {
   await tx.execute(sql`SELECT set_config('gcms.actor_id',${actor.userId},true),set_config('gcms.session_id',${actor.sessionId},true),set_config('gcms.tenant_id',${h.tenant().id},true),set_config('gcms.m5_safety','true',true)`);
   await tx.execute(sql`UPDATE gcms_s02.service_draft SET title='FORGED M5 safety' WHERE tenant_id=${h.tenant().id} AND id=${h.tenant().serviceId}`);
   throw new Error('Unexpected write rolled back');
  }); } catch (error) { code = postgresCode(error); }
  expect(code).toBe('42501'); await h.lifecycle('reactivate');
 });
});
