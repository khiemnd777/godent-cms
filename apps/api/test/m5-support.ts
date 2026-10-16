import { SQL } from 'bun';
import { expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { writeFile, rename } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import { createS02Database, type S02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { loadRuntimeEnvironment } from '../src/auth/runtime-environment';
import { validateDatabaseUrl } from '../src/auth/policy';
import { M4_ROUTES, type M4Variant, type M4Content, type M4CommandResult } from '../src/contracts/m4';
import { legacyDocument } from '../src/contracts/content';
import { openPasswordSession } from '../../../scripts/s02-fixtures';
import { readM5Fixtures, type M5Fixtures, type M5Tenant } from '../../../scripts/m5-fixtures';

/** Integration never falls back to retained fixtures or production resources. */
export class M5Harness {
 readonly run = randomUUID();
 readonly manifest = `.local/m5-api-owned-${this.run}.json`;
 fixtures!: M5Fixtures; db!: S02Database; identity!: ReturnType<typeof createS02Auth>;
 owner!: SQL; app!: INestApplication; base = '';
 clients = new Map<string, Awaited<ReturnType<typeof openPasswordSession>>>();
 entries: Record<string, unknown>[] = [];
 tenant(label: M5Tenant['label'] = 'A') { const t = this.fixtures.tenants.find(t => t.label === label); if (!t) throw new Error('Owned tenant missing'); return t; }
 async setup(labels = ['A1', 'A2', 'B1', 'PlatformOnly', 'Multi']) {
  if (process.env.M5_INTEGRATION !== '1') throw new Error('Explicit M5 integration opt-in required');
  this.fixtures = await readM5Fixtures(); if (this.fixtures.status !== 'complete') throw new Error('Complete owned M5 fixtures required');
  await writeFile(this.manifest, JSON.stringify({ owner: 'GCMS-M5-API-tests', fixtureRun: this.fixtures.runId, run: this.run, entries: [] }) + '\n', { mode: 0o600, flag: 'wx' });
  const runtime = await loadRuntimeEnvironment(); Object.assign(process.env, runtime.api);
  this.db = createS02Database(); this.identity = createS02Auth(this.db);
  this.owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 2, connectionTimeout: 3 });
  const compiled = await import('../dist/app.js' as string) as { createApp(): Promise<INestApplication> };
  this.app = await compiled.createApp(); await this.app.listen(0, '127.0.0.1'); this.base = await this.app.getUrl();
  for (const [index, label] of labels.entries()) {
   if (index === 2 || index === 4) await Bun.sleep(11000);
   await this.login(label);
  }
 }
 async login(label: string) { const i = this.fixtures.identities.find(i => i.label === label); if (!i) throw new Error('Owned actor missing'); this.clients.set(label, await openPasswordSession(this.identity, i)); }
 async record(entry: Record<string, unknown>) {
  this.entries.push(entry); const tmp = `${this.manifest}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify({ owner: 'GCMS-M5-API-tests', fixtureRun: this.fixtures.runId, run: this.run, entries: this.entries }, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await rename(tmp, this.manifest);
 }
 async owned<T>(fn: (tx: SQL) => Promise<T>) { return this.owner.begin(async tx => { await tx.unsafe('SET LOCAL ROLE gcms_s02_owner'); return fn(tx as unknown as SQL); }); }
 async response(path: string, method = 'GET', body?: unknown, label = 'A1', extra: Record<string, string> = {}) {
  const c = this.clients.get(label); if (!c) throw new Error('Missing integration actor');
  return fetch(this.base + path, { method, redirect: 'manual', headers: { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', cookie: c.headers.get('cookie') ?? '', ...(method === 'GET' || method === 'HEAD' ? {} : { 'content-type': 'application/json', 'x-csrf-token': this.identity.csrfToken(c.actor) }), ...extra }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
 }
 async call<T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown, label = 'A1') { const r = await this.response(path, method, body, label); return { status: r.status, value: await r.json() as T }; }
 async public<T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown, origin = 'http://localhost:5892', extra: Record<string, string> = {}) {
  const r = await fetch(this.base + path, { method, redirect: 'manual', headers: { host: '127.0.0.1:5890', ...(method === 'GET' || method === 'HEAD' ? {} : { origin, 'content-type': 'application/json' }), ...extra }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  return { status: r.status, value: method === 'HEAD' ? null : await r.json() as T, headers: r.headers };
 }
 async status(label: M5Tenant['label'] = 'A', platform = false) { const r = await this.call<import('../src/contracts/m5-platform').M5PlatformStatus>(`${platform ? '/api/platform/tenants' : '/api/cms/tenants'}/${this.tenant(label).id}/m5${platform ? '' : '/platform'}`, 'GET', undefined, platform ? 'PlatformOnly' : label === 'B' ? 'B1' : 'A1'); expect(r.status).toBe(200); return r.value; }
 async quota(policy: import('../src/contracts/m5-platform').M5QuotaPolicy, label: M5Tenant['label'] = 'A') { const current = await this.status(label, true); const r = await this.call(`/api/platform/tenants/${this.tenant(label).id}/m5/quota`, 'POST', { operationId: randomUUID(), expectedVersion: current.version, reason: 'Owned M5 quota verification', policy }, 'PlatformOnly'); expect(r.status).toBe(200); return r; }
 async lifecycle(action: 'suspend' | 'reactivate', label: M5Tenant['label'] = 'A') { const current = await this.status(label, true); const r = await this.call(`/api/platform/tenants/${this.tenant(label).id}/m5/lifecycle`, 'POST', { operationId: randomUUID(), expectedVersion: current.version, reason: 'Owned M5 lifecycle verification', action }, 'PlatformOnly'); expect(r.status).toBe(200); return r; }
 content(kind: 'home' | 'page' | 'landing', title = 'M5 synthetic page'): M4Content { return { kind, slug: kind === 'home' ? 'home' : `m5-${randomUUID().slice(0, 8)}`, title, summary: 'Nội dung minh họa local M5.', seo: { title: '', description: '' }, sections: [{ id: 'hero', type: 'hero', hidden: false, title, text: 'Dữ liệu tổng hợp dùng kiểm chứng.', image: null, action: null }, { id: 'body', type: 'rich_text', hidden: false, body: legacyDocument('Thông tin tổng hợp minh họa, không có dữ liệu khách hàng thật.') }] }; }
 path(d: M4Variant, label: M5Tenant['label'] = 'A') { return d.kind === 'config' ? M4_ROUTES.config(this.tenant(label).id, d.locale) : M4_ROUTES.resource(this.tenant(label).id, d.kind, d.id, d.locale); }
 async create(kind: 'home' | 'page' | 'landing', content = this.content(kind), locale: 'vi' | 'en' = 'vi', label: M5Tenant['label'] = 'A') { const r = await this.call<M4CommandResult>(M4_ROUTES.resources(this.tenant(label).id, kind) + '?locale=' + locale, 'POST', { operationId: randomUUID(), content }, label === 'B' ? 'B1' : 'A1'); expect(r.status).toBe(201); await this.record({ tenant: label, kind, id: r.value.draft.id, locale }); return r.value.draft; }
 async publish(d: M4Variant, label: M5Tenant['label'] = 'A') { const actor = label === 'B' ? 'B1' : 'A1'; const cfg = await this.call<M4Variant>(M4_ROUTES.config(this.tenant(label).id, d.locale), 'GET', undefined, actor); expect(cfg.status).toBe(200); const r = await this.call<M4CommandResult>(this.path(d, label) + '/publish', 'POST', { operationId: randomUUID(), expectedVersion: d.version, expectedPublicationVersion: d.publicationVersion, expectedPublicationRevision: d.publicationRevision, expectedConfigPublicationId: d.kind === 'config' ? null : cfg.value.publicationId }, actor); expect(r.status).toBe(200); return r.value.draft; }
 async config(locale: 'vi' | 'en' = 'vi', label: M5Tenant['label'] = 'A') { const actor = label === 'B' ? 'B1' : 'A1'; const r = await this.call<M4Variant>(M4_ROUTES.config(this.tenant(label).id, locale), 'GET', undefined, actor); expect(r.status).toBe(200); const current = r.value; const s = await this.call<M4CommandResult>(M4_ROUTES.config(this.tenant(label).id, locale), 'PUT', { operationId: randomUUID(), expectedVersion: current.version, content: { ...current.content, name: `M5 ${label} ${locale.toUpperCase()}` } }, actor); expect(s.status).toBe(200); return this.publish(s.value.draft, label); }
 async close() { await this.app?.close(); await this.db?.close(); await this.owner?.close(); }
}
