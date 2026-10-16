import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { sql } from 'drizzle-orm';
import { ForbiddenException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { validateDatabaseUrl } from '../auth/policy';
import { authTables } from './schema';

export interface SessionActor {
  userId: string; sessionId: string; email: string; name: string; emailVerified: boolean;
  platformAdmin: boolean; sessionCreatedAt: Date; sessionExpiresAt: Date;
}
export type S02Transaction = Parameters<Parameters<ReturnType<typeof drizzle>['transaction']>[0]>[0];
export interface LockedInvitation { id: string; tenant_id: string; email: string; expires_at: Date; accepted_at: Date | null; revoked_at: Date | null }

export function createS02Database(env: Record<string, string | undefined> = process.env) {
  const clients = Object.fromEntries(['auth', 'tenant', 'platform'].map(role => [role,
    new SQL(validateDatabaseUrl(env[`S02_${role.toUpperCase()}_DATABASE_URL`], `gcms_s02_${role}`),
      { max: 4, connectionTimeout: 3, idleTimeout: 20, maxLifetime: 600 })])) as Record<'auth'|'tenant'|'platform', SQL>;
  const authDb = drizzle({ client: clients.auth, schema: authTables });
  const tenantDb = drizzle({ client: clients.tenant });
  const platformDb = drizzle({ client: clients.platform });
  const intakeSql = env.S04_INTAKE_DATABASE_URL ? new SQL(validateDatabaseUrl(env.S04_INTAKE_DATABASE_URL,'gcms_s04_intake'),
    {max:4,connectionTimeout:3,idleTimeout:20,maxLifetime:600}) : undefined;
  let ready: Promise<void> | undefined;

  async function verifyRoles() {
    ready ??= (async () => {
      for (const [role, client] of [...Object.entries(clients),...(intakeSql?[['intake',intakeSql] as const]:[])]) {
        const rows = await client`select current_user as name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,
          pg_has_role(current_user,'gcms_s02_owner','MEMBER') as owner_member,
          exists(select 1 from pg_namespace where nspname in ('gcms_s02','gcms_s02_auth','gcms_s04','gcms_s04_crypto','gcms_s05') and nspowner=pg_roles.oid) as owns_schema,
          exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('gcms_s02','gcms_s02_auth','gcms_s04','gcms_s05') and c.relowner=pg_roles.oid) as owns_table
          from pg_roles where rolname=current_user`;
        const current = rows[0];
        if (!current || current.name !== (role==='intake'?'gcms_s04_intake':`gcms_s02_${role}`) || current.rolsuper || current.rolbypassrls || current.rolcreaterole || current.rolcreatedb ||
            current.owner_member || current.owns_schema || current.owns_table) throw new Error('Unsafe S02 runtime database role');
      }
    })();
    return ready;
  }
  async function lockActor(tx: S02Transaction, actor: SessionActor): Promise<SessionActor> {
    await tx.execute(sql`select set_config('gcms.actor_id',${actor.userId},true),set_config('gcms.session_id',${actor.sessionId},true),set_config('gcms.tenant_id','',true)`);
    try {
      const result = await tx.execute(sql`select gcms_s02.lock_actor(${actor.userId},${actor.sessionId}) as actor`);
      const current = result[0]?.actor as SessionActor | undefined;
      if (!current) throw new UnauthorizedException();
      return { ...current, sessionCreatedAt: new Date(current.sessionCreatedAt), sessionExpiresAt: new Date(current.sessionExpiresAt) };
    } catch (error) {
      if (postgresCode(error) === '28000') throw new UnauthorizedException();
      throw error;
    }
  }
  async function bounded(tx: S02Transaction) {
    await tx.execute(sql`select set_config('statement_timeout','5s',true),set_config('lock_timeout','3s',true)`);
  }
  async function withActor<T>(actor: SessionActor, action: (tx: S02Transaction, fresh: SessionActor) => Promise<T>) {
    await verifyRoles();
    return tenantDb.transaction(async tx => { await bounded(tx); return action(tx, await lockActor(tx, actor)); });
  }
  async function withTenant<T>(actor: SessionActor, tenantId: string, action: (tx: S02Transaction, fresh: SessionActor) => Promise<T>) {
    await verifyRoles();
    return tenantDb.transaction(async tx => {
      await bounded(tx);
      // Same lock order for every tenant operation and grant/revoke.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${tenantId},7202))`);
      const fresh = await lockActor(tx, actor);
      await tx.execute(sql`select set_config('gcms.tenant_id',${tenantId},true)`);
      const tenant = await tx.execute(sql`select id,status,gcms_m5.is_live(id) as live from gcms_s02.tenant where id=${tenantId}`);
      const membership = await tx.execute(sql`select status from gcms_s02.membership where tenant_id=${tenantId} and user_id=${fresh.userId} for share`);
      if (tenant[0]?.live !== true || membership[0]?.status !== 'active') throw new ForbiddenException();
      return action(tx, fresh);
    });
  }
  async function withPlatform<T>(actor: SessionActor, action: (tx: S02Transaction, fresh: SessionActor) => Promise<T>) {
    await verifyRoles();
    return platformDb.transaction(async tx => {
      await bounded(tx);
      const fresh = await lockActor(tx, actor);
      if (!fresh.platformAdmin) throw new ForbiddenException();
      return action(tx, fresh);
    });
  }
  /** Current authorized private reads include suspended tenants, never deleting tenants. */
  async function withReadTenant<T>(actor:SessionActor,tenantId:string,action:(tx:S02Transaction,fresh:SessionActor)=>Promise<T>) {
    await verifyRoles();
    return tenantDb.transaction(async tx=>{
      await bounded(tx);await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${tenantId},7202))`);
      const fresh=await lockActor(tx,actor);
      await tx.execute(sql`select set_config('gcms.tenant_id',${tenantId},true)`);
      const tenant=await tx.execute(sql`select id,gcms_m5.is_readable(id) as readable from gcms_s02.tenant where id=${tenantId}`);
      const member=await tx.execute(sql`select status from gcms_s02.membership where tenant_id=${tenantId} and user_id=${fresh.userId} for share`);
      if(tenant[0]?.readable!==true||member[0]?.status!=='active') throw new ForbiddenException();
      return action(tx,fresh);
    });
  }
  /** Only explicitly selected safety commands use this helper. SQL still validates
   * the command kind, expected version, reason and recent authentication. */
  async function withSafetyTenant<T>(actor:SessionActor,tenantId:string,action:(tx:S02Transaction,fresh:SessionActor)=>Promise<T>) {
    return withReadTenant(actor,tenantId,async(tx,fresh)=>{
      const recent=await tx.execute(sql`select gcms_s02.has_recent_auth() as recent`);
      if(recent[0]?.recent!==true)throw new ForbiddenException('REAUTH_REQUIRED');
      await tx.execute(sql`select gcms_m5.require_safety(${tenantId})`);return action(tx,fresh);
    });
  }
  const withLeadTenant=withReadTenant;
  async function withInvitation<T>(actor: SessionActor, tokenHash: string,
    action: (tx: S02Transaction, fresh: SessionActor, invitation: LockedInvitation) => Promise<T>) {
    await verifyRoles();
    return platformDb.transaction(async tx => {
      await bounded(tx);
      const initial = await tx.execute(sql`select tenant_id from gcms_s02.invitation where token_hash=${tokenHash}`);
      if (!initial[0]) throw new ConflictException('Invitation unavailable');
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${String(initial[0].tenant_id)},7202))`);
      const fresh = await lockActor(tx, actor);
      const rows = await tx.execute(sql`select i.*,t.status as tenant_status from gcms_s02.invitation i join gcms_s02.tenant t on t.id=i.tenant_id where i.token_hash=${tokenHash} for update of i`);
      const invite = rows[0];
      if (!invite || invite.email !== fresh.email || invite.accepted_at || invite.revoked_at || new Date(String(invite.expires_at)) <= new Date() || invite.tenant_status !== 'active') throw new ConflictException('Invitation unavailable');
      await tx.execute(sql`select set_config('gcms.tenant_id',${String(invite.tenant_id)},true)`);
      return action(tx, fresh, invite as unknown as LockedInvitation);
    });
  }
  async function disableUser(actor: SessionActor, targetId: string) {
    return withPlatform(actor, async (tx, fresh) => {
      const recent = await tx.execute(sql`select gcms_s02.has_recent_auth() as recent`);
      if (!recent[0]?.recent) throw new ForbiddenException('REAUTH_REQUIRED');
      const tenants = await tx.execute(sql`select tenant_id from gcms_s02.membership where user_id=${targetId} and status='active' order by tenant_id`);
      for (const tenant of tenants) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${String(tenant.tenant_id)},7202))`);
      const updated = await tx.execute(sql`update gcms_s02_auth."user" set active=false,updated_at=now() where id=${targetId} and active returning id`);
      if (!updated.length) throw new ConflictException('Account unavailable');
      await tx.execute(sql`insert into gcms_s02.audit_event(id,actor_id,event,target_id) values(${crypto.randomUUID()},${fresh.userId},'identity.disabled',${targetId})`);
      return { status: true };
    });
  }
  return { authDb, authSql: clients.auth, tenantDb, platformDb, intakeSql, verifyRoles, withActor, withTenant, withReadTenant, withSafetyTenant, withLeadTenant, withPlatform, withInvitation, disableUser,
    close: async () => { await Promise.all([...Object.values(clients),...(intakeSql?[intakeSql]:[])].map(client => client.close())); } };
}
export type S02Database = ReturnType<typeof createS02Database>;
export function postgresCode(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== 'object' || depth > 4) return undefined;
  const item = error as { code?: unknown; errno?: unknown; sqlState?: unknown; cause?: unknown };
  for (const code of [item.code,item.errno,item.sqlState]) if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  return item.cause ? postgresCode(item.cause, depth + 1) : undefined;
}
