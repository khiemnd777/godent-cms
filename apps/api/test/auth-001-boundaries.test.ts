import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DomainService } from '../src/modules/domain.service';
import { Auth001Harness } from './auth-001-support';
import type { S02Transaction } from '../src/database';

const integration = process.env.AUTH_001_INTEGRATION === '1' ? describe : describe.skip;
integration('AUTH-001 actual restricted PostgreSQL password-only boundaries', () => {
  let h: Auth001Harness, signed: Awaited<ReturnType<Auth001Harness['signIn']>>;
  let service: DomainService;
  beforeAll(async () => { h = new Auth001Harness(); await h.ready(); signed = await h.signIn('recovery'); service = new DomainService(h.db, h.identity); });
  afterAll(async () => { await signed?.call('/sign-out', {}); await h?.close(); });
  const request = () => ({ method: 'GET', originalUrl: '/api/session', headers: { host: '127.0.0.1:5890', cookie: signed.headers.get('cookie') ?? '' } });
  const command = (version: number) => ({ operationId: randomUUID(), expectedVersion: version, mode: 'selected', recipientUserIds: [signed.actor.userId] });
  async function settings(tx: S02Transaction, body: unknown) {
    const result = await tx.execute(sql`SELECT gcms_s05.settings_command(${h.fixtures.tenantIds.A},${JSON.stringify(body)}::text::jsonb) AS result`);
    return result[0].result as Record<string, unknown>;
  }
  it('returns no factor fields and rejects platform/cross-tenant and wrong-CSRF mutations', async () => {
    const current = await service.currentSession(request());
    expect(current.user).not.toHaveProperty('twoFactorEnabled'); expect(current.session).not.toHaveProperty('mfaVerified');
    await expect(h.db.withPlatform(signed.actor, async () => true)).rejects.toThrow();
    await expect(h.db.withTenant(signed.actor, h.fixtures.tenantIds.B, async () => true)).rejects.toThrow();
    await expect(service.createDraft({ ...request(), method: 'POST', headers: { ...request().headers, origin: 'http://127.0.0.1:5891', 'content-type': 'application/json', 'x-csrf-token': 'invalid' } },
      h.fixtures.tenantIds.A, { title: 'Rejected', body: 'Never stored' })).rejects.toThrow();
    await expect(Promise.resolve(h.db.tenantDb.execute(sql`SELECT password FROM gcms_s02_auth.account`))).rejects.toThrow();
    for (const extra of [{ code: '123456' }, { backupCode: 'obsolete' }]) {
      const response = await fetch('http://127.0.0.1:5890/api/session/reauth', { method: 'POST', headers: {
        origin: 'http://127.0.0.1:5891', 'content-type': 'application/json', cookie: signed.headers.get('cookie') ?? '',
        'x-csrf-token': h.identity.csrfToken(signed.actor) }, body: JSON.stringify({ password: signed.fixture.password, ...extra }) });
      expect(response.status).toBe(400); await response.body?.cancel();
    }
    const eligible = await h.owned(tx => tx`SELECT gcms_s05.eligible(${h.fixtures.tenantIds.A},${signed.actor.userId}) AS a,
      gcms_s05.eligible(${h.fixtures.tenantIds.B},${signed.actor.userId}) AS b`);
    expect(eligible[0].a).toBe(true); expect(eligible[0].b).toBe(false);
  });
  it('saves settings as the real tenant role with a fresh password session and checks suspension before replay', async () => {
    const initial = await h.db.withTenant(signed.actor, h.fixtures.tenantIds.A, async tx => {
      const result = await tx.execute(sql`SELECT gcms_s05.read_settings(${h.fixtures.tenantIds.A}) AS result`);
      return result[0].result as { version: number };
    });
    const body = command(initial.version);
    const saved = await h.db.withTenant(signed.actor, h.fixtures.tenantIds.A, tx => settings(tx, body));
    expect(saved.appliedVersion).toBe(initial.version + 1);
    expect((await h.db.withTenant(signed.actor, h.fixtures.tenantIds.A, tx => settings(tx, body))).replayed).toBe(true);
    const prior = await h.owned(tx => tx`SELECT status FROM gcms_s02.tenant WHERE id=${h.fixtures.tenantIds.A}`);
    try {
      await h.owned(tx => tx`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${h.fixtures.tenantIds.A}`);
      await expect(h.db.withLeadTenant(signed.actor, h.fixtures.tenantIds.A, tx => settings(tx, body))).rejects.toThrow();
      await expect(h.db.withTenant(signed.actor, h.fixtures.tenantIds.A, async () => true)).rejects.toThrow();
      expect(await h.db.withLeadTenant(signed.actor, h.fixtures.tenantIds.A, async () => true)).toBe(true);
    } finally { await h.owned(tx => tx`UPDATE gcms_s02.tenant SET status=${prior[0].status} WHERE id=${h.fixtures.tenantIds.A}`); }
  });
  it('rejects future/stale/expired grants and accepts a nonfuture five-minute password grant consistently', async () => {
    const prior = await h.owned(tx => tx`SELECT created_at FROM gcms_s02_auth.session WHERE id=${signed.actor.sessionId}`);
    try {
      await h.owned(async tx => {
        await tx`UPDATE gcms_s02_auth.session SET created_at=clock_timestamp()-interval '6 minutes' WHERE id=${signed.actor.sessionId}`;
        await tx`DELETE FROM gcms_s02_auth.reauth_grant WHERE session_id=${signed.actor.sessionId}`;
      });
      for (const proof of ['future', 'stale', 'expired']) {
        await h.owned(tx => tx`INSERT INTO gcms_s02_auth.reauth_grant(session_id,verified_at,expires_at)
          VALUES(${signed.actor.sessionId},clock_timestamp()+${proof === 'future' ? 60 : proof === 'stale' ? -360 : 0}*interval '1 second',
            clock_timestamp()+${proof === 'expired' ? -1 : 300}*interval '1 second')
          ON CONFLICT(session_id) DO UPDATE SET verified_at=excluded.verified_at,expires_at=excluded.expires_at`);
        await expect(h.identity.requireRecent(signed.actor)).rejects.toThrow();
        const denied = await h.db.withTenant(signed.actor, h.fixtures.tenantIds.A, tx => settings(tx, command(1)));
        expect(denied.code).toBe('REAUTH_REQUIRED');
      }
      await h.identity.reauthenticate(signed.headers, { password: signed.fixture.password });
      await expect(h.identity.requireRecent(signed.actor)).resolves.toBeUndefined();
      const grant = await h.owned(tx => tx`SELECT mfa,verified_at<=clock_timestamp() AS nonfuture FROM gcms_s02_auth.reauth_grant WHERE session_id=${signed.actor.sessionId}`);
      expect(grant[0].mfa).toBe(false); expect(grant[0].nonfuture).toBe(true);
      const current = await h.db.withTenant(signed.actor, h.fixtures.tenantIds.A, async tx => {
        const rows = await tx.execute(sql`SELECT gcms_s05.read_settings(${h.fixtures.tenantIds.A}) AS result`);
        return rows[0].result as { version: number };
      });
      const saved = await h.db.withTenant(signed.actor, h.fixtures.tenantIds.A, tx => settings(tx, command(current.version)));
      expect(saved.appliedVersion).toBe(current.version + 1);
    } finally { await h.owned(tx => tx`UPDATE gcms_s02_auth.session SET created_at=${prior[0].created_at} WHERE id=${signed.actor.sessionId}`); }
  });
});
