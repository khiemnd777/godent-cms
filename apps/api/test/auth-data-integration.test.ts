import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createS02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { openFixtureSession } from '../../../scripts/s02-fixtures';

const integration = process.env.S02_INTEGRATION === '1' ? describe : describe.skip;
integration('S02 real Better Auth and restricted PostgreSQL', () => {
  let db: ReturnType<typeof createS02Database>;
  let identity: ReturnType<typeof createS02Auth>;
  beforeAll(() => { db = createS02Database(); identity = createS02Auth(db); });
  afterAll(async () => { await db?.close(); });

  it('signs in with the existing password, authorizes current tenant, and revokes the logout cookie', async () => {
    const signed = await openFixtureSession(identity,'A1');
    expect(signed.actor.emailVerified).toBe(true);
    expect(signed.actor).not.toHaveProperty('mfaVerified');
    expect(signed.actor).not.toHaveProperty('twoFactorEnabled');
    expect(signed.actor.emailVerified).toBe(true);
    const result = await db.withTenant(signed.actor, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', async tx =>
      tx.execute(sql`select id from gcms_s02.tenant`));
    // Metadata lists all current memberships. Prior provisioning checks may
    // legitimately add tenants; fixture B must remain inaccessible to A1.
    const visible = result.map(row => String(row.id));
    expect(visible).toContain('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(visible).not.toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    await expect(db.withTenant(signed.actor, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', async () => true)).rejects.toThrow();
    const previous = new Headers(signed.headers);
    const logout = await signed.call('/sign-out', {});
    expect(logout.status).toBe(200);
    expect(await identity.currentSession(previous)).toBeNull();
    await expect(db.withActor(signed.actor, async () => true)).rejects.toThrow();
  });
});
