import { SQL } from 'bun';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { createS02Database, type S02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { loadRuntimeEnvironment } from '../src/auth/runtime-environment';
import { validateDatabaseUrl } from '../src/auth/policy';
import { S04_ROUTES, type IntakeInput, type IntakeChallenge } from '../src/contracts/s04';
import type { CurrentSession } from '../src/contracts/s02';
import { S05_ROUTES, type LeadDetail, type LeadPage } from '../src/contracts/s05';
import type { PublicationResult, PublicationService, SiteDraft } from '../src/contracts/s03';
import { legacyDocument } from '../src/contracts/content';
import { openFixtureSession, type S02Fixtures } from '../../../scripts/s02-fixtures';

export interface TestSource { tenantId: string; tenantSlug: string; serviceId: string; serviceSlug: string; publicationId: string }
type Client = { signed: Awaited<ReturnType<typeof openFixtureSession>>; csrf: string };
export class S05Harness {
  readonly run = randomUUID();
  db!: S02Database; identity!: ReturnType<typeof createS02Auth>; owner!: SQL; prior!: S02Fixtures; app!: INestApplication;
  base = ''; clients = new Map<string, Client>();
  async setup() {
    const runtime = await loadRuntimeEnvironment(); Object.assign(process.env, runtime.api);
    this.prior = JSON.parse(await readFile('.local/s02-fixtures.json', 'utf8')) as S02Fixtures;
    this.db = createS02Database(); this.identity = createS02Auth(this.db);
    this.owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 3, connectionTimeout: 3 });
    const compiled = await import('../dist/app.js' as string) as { createApp(): Promise<INestApplication> };
    this.app = await compiled.createApp(); await this.app.listen(0, '127.0.0.1'); this.base = await this.app.getUrl();
    const transport = (r: Request) => fetch(this.base + new URL(r.url).pathname, { method: r.method, headers: { ...Object.fromEntries(r.headers), host: '127.0.0.1:5890' }, body: r.body, redirect: 'manual', signal: AbortSignal.timeout(12000) });
    for (const [index, label] of (['A1', 'A2', 'B1', 'PlatformOnly'] as const).entries()) {
      if (index === 2) await Bun.sleep(11000);
      const signed = await openFixtureSession(this.identity, label, transport);
      const response = await fetch(this.base + '/api/session', { headers: { host: '127.0.0.1:5890', cookie: signed.headers.get('cookie') ?? '' } });
      expect(response.status).toBe(200); this.clients.set(label, { signed, csrf: (await response.json() as CurrentSession).csrfToken });
    }
  }
  user(label: string) { return this.prior.identities.find(i => i.label === label)!.userId; }
  async owned<T>(action: (tx: SQL) => Promise<T>) { return this.owner.begin(async tx => { await tx.unsafe('SET LOCAL ROLE gcms_s02_owner'); return action(tx as unknown as SQL); }); }
  async call<T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown, label = 'A1', extra: Record<string, string> = {}) {
    const c = this.clients.get(label)!;
    const r = await fetch(this.base + path, { method, headers: { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', cookie: c.signed.headers.get('cookie') ?? '',
      ...(method === 'GET' ? {} : { 'content-type': 'application/json', 'x-csrf-token': c.csrf }), ...extra }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
    return { status: r.status, value: await r.json() as T };
  }
  async source(label: string, ambiguous = false): Promise<TestSource> {
    const tenantId = randomUUID(), tenantSlug = `s05-${this.run.slice(0, 8)}-${label}`;
    await this.owned(async tx => {
      await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${tenantId},${`S05 Test ${this.run} ${label}`})`;
      for (const [index, who] of ['A1', 'A2'].entries()) await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id,created_at) VALUES(${tenantId},${this.user(who)},now()+${ambiguous ? 0 : index}*interval '1 millisecond')`;
    });
    const prefix = `/api/tenants/${tenantId}/publication`;
    const site = await this.call<SiteDraft>(prefix + '/site', 'PUT', { slug: tenantSlug, name: 'S05 Synthetic source', footer: { intro: '', body: legacyDocument('Synthetic footer') }, expectedVersion: 0 }); expect(site.status).toBe(200);
    const draft = await this.call<PublicationService>(prefix + '/services', 'POST', { slug: 'consultation', title: 'S05 Synthetic publication', summary: '', body: legacyDocument('Synthetic public source'), seo: { title: '', description: '' } }); expect(draft.status).toBe(201);
    const published = await this.call<PublicationResult>(prefix + `/services/${draft.value.id}/publish`, 'POST', { expectedDraftVersion: 1, expectedSiteVersion: site.value.version, expectedPublicationVersion: 0, requestKey: randomUUID() }); expect(published.status).toBe(200);
    return { tenantId, tenantSlug, serviceId: draft.value.id, serviceSlug: 'consultation', publicationId: published.value.publicationId };
  }
  async intake(s: TestSource, changes: Partial<IntakeInput> = {}): Promise<LeadDetail> {
    const input: IntakeInput = { requestKey: randomUUID(), sourcePublicationId: s.publicationId, name: 'Synthetic Minh', phone: '0900123456', preferredChannel: 'phone', preferredLanguage: 'vi', consent: true, ...changes };
    const post = async (path: string, payload: unknown) => {
      const r = await fetch(this.base + path, { method: 'POST', headers: { host: '127.0.0.1:5890', origin: 'http://localhost:5892', 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
      return { status: r.status, value: await r.json() as Record<string, unknown> };
    };
    let result = await post(S04_ROUTES.intake(s.tenantSlug, s.serviceSlug), input);
    if (result.value.code === 'CAPTCHA_REQUIRED') {
      const challenge = await post(S04_ROUTES.challenge(s.tenantSlug, s.serviceSlug), { requestKey: input.requestKey }); expect(challenge.status).toBe(200);
      const c = challenge.value as unknown as IntakeChallenge, numbers = c.prompt.match(/\d+/g)!;
      input.challenge = { token: c.token, answer: String(Number(numbers[0]) + Number(numbers[1])) };
      result = await post(S04_ROUTES.intake(s.tenantSlug, s.serviceSlug), input);
    }
    expect(result.status).toBe(200); expect(result.value).toEqual({ status: 'accepted' });
    const row = await this.owned(tx => tx`SELECT lead_id FROM gcms_s04.accepted_request WHERE tenant_id=${s.tenantId} AND request_key=${input.requestKey}`);
    const detail = await this.call<LeadDetail>(S05_ROUTES.lead(s.tenantId, String(row[0].lead_id))); expect(detail.status).toBe(200); return detail.value;
  }
  async detail(s: TestSource, id: string) { return (await this.call<LeadDetail>(S05_ROUTES.lead(s.tenantId, id))).value; }
  async command(s: TestSource, lead: LeadDetail, body: Record<string, unknown>, label = 'A1') {
    return this.call(S05_ROUTES.commands(s.tenantId, lead.id), 'POST', { operationId: randomUUID(), expectedVersion: lead.version, ...body }, label);
  }
  async bulk(s: TestSource, count: number) {
    await this.owned(async tx => {
      await tx`WITH seed AS (SELECT * FROM gcms_s04.lead WHERE tenant_id=${s.tenantId} LIMIT 1), made AS (
        INSERT INTO gcms_s04.lead(tenant_id,id,name,phone,preferred_language,preferred_channel,source_service_id,source_publication_id,
          source_tenant_slug,source_service_slug,source_service_title,source_path,consent_at,consent_version,consent_copy,created_at,last_activity_at,expires_at)
        SELECT seed.tenant_id,gen_random_uuid()::text,'prefix Minh %_ hậu '||n,seed.phone,seed.preferred_language,seed.preferred_channel,seed.source_service_id,seed.source_publication_id,
          seed.source_tenant_slug,seed.source_service_slug,seed.source_service_title,seed.source_path,seed.created_at,seed.consent_version,seed.consent_copy,seed.created_at,seed.created_at,seed.created_at+interval '180 days'
        FROM seed CROSS JOIN generate_series(1,${count}) n RETURNING *), intents AS (
        INSERT INTO gcms_s04.notification_intent(tenant_id,lead_id,created_at) SELECT tenant_id,id,created_at FROM made RETURNING lead_id), requests AS (
        INSERT INTO gcms_s04.accepted_request(tenant_id,request_key,fingerprint,lead_id,service_id,publication_id,accepted_at,expires_at)
          SELECT tenant_id,gen_random_uuid()::text,repeat('0',64),id,source_service_id,source_publication_id,created_at,created_at+interval '24 hours' FROM made RETURNING lead_id)
        INSERT INTO gcms_s04.audit_event(id,tenant_id,event,target_id,created_at) SELECT gen_random_uuid()::text,tenant_id,'consultation.accepted',id,created_at FROM made`;
    });
  }
  async page(s: TestSource, query = '') { return this.call<LeadPage>(S05_ROUTES.leads(s.tenantId) + query); }
  async close() { await this.app?.close(); await this.db?.close(); await this.owner?.close(); }
}
