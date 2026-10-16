import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { RetentionService } from '../src/modules/retention.service';
import type { S02Auth } from '../src/auth';
import type { S02Database } from '../src/database';
import { LeadsService } from '../src/modules/leads.service';
import type { PrivateRequest } from '../src/modules/request-security';

test('post-commit lead read preserves inherited HTTP headers when changing the method', async () => {
  const headers = { origin: 'http://127.0.0.1:5891', 'content-type': 'application/json', cookie: 'synthetic-session', 'x-csrf-token': 'synthetic' };
  const request = Object.assign(Object.create({ get headers() { return headers; } }), { method: 'POST', originalUrl: '/synthetic-extension' }) as PrivateRequest;
  const database = { async withTenant(_actor: unknown, _tenant: string, action: (tx: unknown) => Promise<unknown>) {
    return action({ async execute() { return [{ result: { operationId: 'synthetic', appliedVersion: 2, replayed: false } }]; } });
  } } as unknown as S02Database;
  const identity = { async currentSession() { return { userId: 'synthetic' }; }, verifyCsrf() { return true; } } as unknown as S02Auth;
  const leads = { async detail(fresh: PrivateRequest) { expect(fresh.headers).toBe(headers); expect(fresh.method).toBe('GET'); return { id: 'synthetic' }; } } as unknown as LeadsService;
  const result = await new RetentionService(database, identity, leads).extend(request, randomUUID(), randomUUID(), {
    operationId: randomUUID(), expectedVersion: 1, reason: 'Synthetic reason', expiresAt: '2030-01-01T00:00:00.000Z',
  });
  expect(result.appliedVersion).toBe(2);
});

test('lead detail, list, count and history preserve driver Date milliseconds in expiry and server timing', async () => {
  const tenant = randomUUID(), id = randomUUID(), stamp = '2026-10-16T07:00:00.789Z', expiry = '2027-10-16T07:00:00.512Z';
  const request: PrivateRequest = { headers: {}, method: 'GET', originalUrl: '/synthetic-read' };
  const identity = { async currentSession() { return { userId: 'synthetic' }; } } as unknown as S02Auth;
  const row = { id, createdAt: new Date('2026-10-16T07:00:00.123Z'), expiresAt: new Date(expiry), normalExpiresAt: new Date('2027-01-01T00:00:00.444Z'),
    extensionExpiresAt: new Date(expiry), lastActivityAt: new Date('2026-10-16T07:00:00.234Z'), closedAt: new Date('2026-10-16T07:00:00.345Z'), serverTime: new Date(stamp),
    cursorTime: '2026-10-16T07:00:00.123000Z' };
  function service(responses: unknown[][]) {
    let offset = 0;
    const database = { async withLeadTenant(_actor: unknown, _tenant: string, action: (tx: unknown, fresh: unknown) => Promise<unknown>) {
      return action({ async execute() { return responses[offset++]; } }, { userId: 'synthetic' });
    } } as unknown as S02Database;
    return new LeadsService(database, identity);
  }
  const detail = await service([[row]]).detail(request, tenant, id);
  expect(detail.createdAt).toBe('2026-10-16T07:00:00.123Z'); expect(detail.lastActivityAt).toBe('2026-10-16T07:00:00.234Z'); expect(detail.closedAt).toBe('2026-10-16T07:00:00.345Z');
  expect(detail.expiresAt).toBe(expiry); expect(detail.extensionExpiresAt).toBe(expiry); expect(detail.normalExpiresAt).toBe('2027-01-01T00:00:00.444Z'); expect(detail.serverTime).toBe(stamp); expect(detail.validUntil).toBe(expiry);
  const timing = { stamp: new Date(stamp), deadline: new Date(expiry) };
  const page = await service([[timing], [row]]).list(request, tenant, {});
  expect(page.serverTime).toBe(stamp); expect(page.validUntil).toBe(expiry); expect(page.items[0].expiresAt).toBe(expiry);
  const count = await service([[timing], [{ total: 1, newTotal: 1 }]]).count(request, tenant, {});
  expect(count.serverTime).toBe(stamp); expect(count.validUntil).toBe(expiry);
  const history = await service([[row], [{ id: randomUUID(), createdAt: row.createdAt, kind: 'note', payload: { text: 'Synthetic note' } }]]).history(request, tenant, id, {});
  expect(history.serverTime).toBe(stamp); expect(history.validUntil).toBe(expiry); expect(history.items[0].createdAt).toBe('2026-10-16T07:00:00.123Z');
});
