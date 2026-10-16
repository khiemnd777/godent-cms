import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { DomainService } from '../src/modules/domain.service';
import { Auth001Harness } from './auth-001-support';
import { openFixtureSession } from '../../../scripts/s02-fixtures';

const integration = process.env.AUTH_001_INTEGRATION === '1' ? describe : describe.skip;
integration('AUTH-001 password-only lifecycle and current global disable', () => {
  let h: Auth001Harness;
  beforeAll(async () => { h = new Auth001Harness(); await h.ready(); });
  afterAll(async () => { await h?.close(); });
  it('authenticates retained enrolled and new unenrolled identities without factor fields', async () => {
    const old = await openFixtureSession(h.identity, 'A1', h.transport), fresh = await h.signIn('disable');
    try {
      const legacy = await h.owned(tx => tx`SELECT two_factor_enabled FROM gcms_s02_auth."user" WHERE id=${old.actor.userId}`);
      expect(legacy[0].two_factor_enabled).toBe(true);
      for (const signed of [old, fresh]) {
        expect(signed.actor.emailVerified).toBe(true);
        expect(signed.actor).not.toHaveProperty('twoFactorEnabled');
        expect(signed.actor).not.toHaveProperty('mfaVerified');
        for (const path of ['/two-factor/enable', '/two-factor/verify-totp', '/two-factor/verify-backup-code', '/two-factor/disable', '/two-factor/generate-backup-codes', '/two-factor/get-totp-uri']) {
          expect((await signed.call(path, { password: signed.fixture.password, code: '123456' })).status).toBe(404);
        }
      }
      const row = await h.owned(tx => tx`SELECT two_factor_enabled FROM gcms_s02_auth."user" WHERE id=${fresh.actor.userId}`);
      expect(row[0].two_factor_enabled).toBe(false);
    } finally { await old.call('/sign-out', {}); await fresh.call('/sign-out', {}); }
  }, 35000);
  it('globally disables only the new owned multi-tenant account and revokes every session', async () => {
    const first = await h.signIn('disable'), second = await h.signIn('disable'), platform = await openFixtureSession(h.identity, 'PlatformOnly', h.transport);
    try {
      const members = await h.owned(tx => tx`SELECT tenant_id FROM gcms_s02.membership WHERE user_id=${first.actor.userId} AND status='active'`);
      expect(members.map((row: { tenant_id: string }) => row.tenant_id).sort()).toEqual(Object.values(h.fixtures.tenantIds).sort());
      const service = new DomainService(h.db, h.identity);
      const request = { method: 'POST', originalUrl: `/api/platform/users/${first.actor.userId}/disable`, headers: {
        host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', 'content-type': 'application/json',
        cookie: platform.headers.get('cookie') ?? '', 'x-csrf-token': h.identity.csrfToken(platform.actor) } };
      let enter!: () => void, release!: () => void;
      const entered = new Promise<void>(resolve => { enter = resolve; });
      const blocked = new Promise<void>(resolve => { release = resolve; });
      const inflight = h.db.withTenant(first.actor, h.fixtures.tenantIds.A, async () => { enter(); await blocked; return true; });
      await entered;
      let settled = false;
      const disabling = service.disableUser(request, first.actor.userId, {}).then(result => { settled = true; return result; });
      try { await Bun.sleep(100); expect(settled).toBe(false); }
      finally { release(); }
      expect(await inflight).toBe(true);
      expect(await disabling).toEqual({ status: true });
      expect(await h.identity.currentSession(first.headers)).toBeNull();
      expect(await h.identity.currentSession(second.headers)).toBeNull();
      await expect(h.db.withActor(first.actor, async () => true)).rejects.toThrow();
      expect((await first.call('/sign-in/email', { email: first.fixture.email, password: first.fixture.password, rememberMe: false })).status).toBe(401);
      const active = await h.owned(tx => tx`SELECT m.tenant_id,count(*)::integer AS count FROM gcms_s02.membership m
        JOIN gcms_s02_auth."user" u ON u.id=m.user_id WHERE m.tenant_id IN (${h.fixtures.tenantIds.A},${h.fixtures.tenantIds.B})
        AND m.status='active' AND u.active AND u.email_verified GROUP BY m.tenant_id`);
      expect(active).toHaveLength(2);
      expect(active.every((row: { count: number }) => row.count >= 1)).toBe(true);
    } finally { await platform.call('/sign-out', {}); }
  }, 75000);
});
