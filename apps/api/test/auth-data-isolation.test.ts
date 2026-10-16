import { SQL } from 'bun';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createS02Database, postgresCode } from '../src/database';
import { createS02Auth } from '../src/auth';
import { openFixtureSession } from '../../../scripts/s02-fixtures';
import { validateDatabaseUrl } from '../src/auth/policy';

const integration = process.env.S02_INTEGRATION === '1' ? describe : describe.skip;
integration('S02 database role and pooled context isolation', () => {
  let db: ReturnType<typeof createS02Database>;
  let identity: ReturnType<typeof createS02Auth>;
  let owner: SQL;
  let multi: Awaited<ReturnType<typeof openFixtureSession>>;
  const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  beforeAll(async () => {
    db=createS02Database(); identity=createS02Auth(db);
    owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'), {max:1});
    multi=await openFixtureSession(identity,'multiAB');
  }, 30000);
  afterAll(async () => { await multi?.call('/sign-out',{}); await db?.close(); await owner?.close(); });
  it('runtime roles cannot bypass RLS, read credentials or cross module-private tables', async () => {
    await db.verifyRoles();
    expect(await db.tenantDb.execute(sql`select * from gcms_s02.service_draft`)).toHaveLength(0);
    for (const query of [() => db.authDb.execute(sql`select * from gcms_s02.service_draft`),
      () => db.platformDb.execute(sql`select * from gcms_s02.service_draft`),
      () => db.tenantDb.execute(sql`select * from gcms_s02_auth.account`),
      () => db.tenantDb.execute(sql`select token from gcms_s02_auth.session`)]) {
      let code: string | undefined;
      try { await query(); } catch(error) { code=postgresCode(error); }
      expect(code).toBe('42501');
    }
    const rows=await db.withTenant(multi.actor,a,tx=>tx.execute(sql`select * from gcms_s02.service_draft where tenant_id=${b}`));
    expect(rows).toHaveLength(0);
    await expect(db.withTenant(multi.actor,a,tx=>tx.execute(sql`insert into gcms_s02.service_draft(tenant_id,id,title,body,updated_by)
      values(${b},${crypto.randomUUID()},'Cross tenant','Denied',${multi.actor.userId})`))).rejects.toThrow();
  });
  it('interleaved pool transactions and a rollback leave no actor or tenant context on reused connections', async () => {
    const results=await Promise.all(Array.from({length:12},(_,index)=>{
      const tenant=index%2?a:b;
      return db.withTenant(multi.actor,tenant,async tx=>{
        const context=await tx.execute(sql`select current_setting('gcms.tenant_id',true) as tenant,current_setting('gcms.actor_id',true) as actor`);
        return {expected:tenant,tenant:context[0]?.tenant as string,actor:context[0]?.actor as string};
      });
    }));
    for(const result of results) { expect(result.tenant).toBe(result.expected); expect(result.actor).toBe(multi.actor.userId); }
    await expect(db.withTenant(multi.actor,a,async()=>{throw new Error('Owned rollback sentinel');})).rejects.toThrow();
    for(let index=0;index<8;index++) {
      const rows=await db.tenantDb.execute(sql`select nullif(current_setting('gcms.tenant_id',true),'') as tenant,nullif(current_setting('gcms.actor_id',true),'') as actor`);
      expect(rows[0].tenant).toBeNull(); expect(rows[0].actor).toBeNull();
    }
    expect(await db.tenantDb.execute(sql`select * from gcms_s02.membership`)).toHaveLength(0);
  });
  it('the composite tenant/member foreign key rejects references from another tenant', async () => {
    let code: string|undefined;
    try {
      await owner.begin(async tx=>{
        await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
        await tx`insert into gcms_s02.service_draft(tenant_id,id,title,body,updated_by)
          values(${a},${crypto.randomUUID()},'Foreign reference','Denied','10000000-0000-4000-8000-000000000003')`;
      });
    } catch(error) {code=postgresCode(error);}
    expect(code).toBe('23503');
  });
});
