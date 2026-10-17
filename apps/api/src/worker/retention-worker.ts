import { SQL } from 'bun';
import { randomUUID } from 'node:crypto';
import { validateDatabaseUrl } from '../auth/policy';
import { S06_LIMITS } from '../contracts/s06';
import { PermanentCaptureFailure, type LeadCaptureMessage, type LeadCaptureTransport } from './local-capture';
import { RetentionCapture } from './retention-capture';
export interface RetentionClaim { id: string; tenantId: string; leadId: string; revision: number; kind: 'notice' | 'delete'; fence: number }
export class RetentionWorker {
  readonly workerId = randomUUID();
  private readonly client: SQL;
  constructor(url: string, private readonly transport: LeadCaptureTransport = new RetentionCapture()) {
    this.client = new SQL(validateDatabaseUrl(url, 'gcms_s06_worker'), { max: 3, connectionTimeout: 3, idleTimeout: 60, maxLifetime: 0 });
  }
  async verifyRole() {
    const rows = await this.client`SELECT current_user AS name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,
      pg_has_role(current_user,'gcms_s02_owner','MEMBER') AS owner_member,
      EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspowner=r.oid AND n.nspname LIKE 'gcms_%') AS owns_schema,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('gcms_s02','gcms_s02_auth','gcms_s04','gcms_s05','gcms_s06') AND c.relkind IN ('r','p')
        AND has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS private_access
      FROM pg_roles r WHERE rolname=current_user`;
    const r = rows[0];
    if (!r || r.name !== 'gcms_s06_worker' || r.rolsuper || r.rolbypassrls || r.rolcreaterole || r.rolcreatedb || r.owner_member || r.owns_schema || r.private_access) throw new Error('Unsafe retention worker role');
  }
  async claim(tenant: string, limit: number = S06_LIMITS.batchSize): Promise<RetentionClaim[]> {
    if (!/^[a-f0-9-]{36}$/.test(tenant) || !Number.isSafeInteger(limit) || limit < 1 || limit > S06_LIMITS.batchSize) throw new Error('Invalid retention worker scope');
    return (await this.client`SELECT gcms_s06.worker_claim(${tenant},${this.workerId},${limit}) AS claims`)[0].claims as RetentionClaim[];
  }
  async process(claim: RetentionClaim): Promise<'captured' | 'deleted' | 'failed' | 'skipped'> {
    const connection = await this.client.reserve(); let locked = false;
    try {
      locked = (await connection`SELECT pg_try_advisory_lock(hashtextextended(${claim.id},7606)) AS locked`)[0].locked === true;
      if (!locked) return 'skipped';
      if (claim.kind === 'delete') return (await connection`SELECT gcms_s06.worker_delete(${claim.tenantId},${claim.id},${this.workerId},${claim.fence}) AS done`)[0].done ? 'deleted' : 'skipped';
      const message = (await connection`SELECT gcms_s06.worker_notice_start(${claim.tenantId},${claim.id},${this.workerId},${claim.fence}) AS message`)[0].message as LeadCaptureMessage | null;
      if (!message) return 'skipped';
      let outcome: 'captured' | 'transient' | 'permanent' = 'captured';
      const controller = new AbortController(), budget = setTimeout(() => controller.abort(), 2000);
      // Keep the delivery lock until actual I/O settlement, including an ignored abort.
      try { await this.transport.capture(message, controller.signal); }
      catch (error) { outcome = error instanceof PermanentCaptureFailure ? 'permanent' : 'transient'; }
      finally { clearTimeout(budget); }
      const done = (await connection`SELECT gcms_s06.worker_notice_finish(${claim.tenantId},${claim.id},${this.workerId},${claim.fence},${outcome}) AS done`)[0].done;
      return done && outcome === 'captured' ? 'captured' : 'failed';
    } finally {
      try { if (locked) await connection`SELECT pg_advisory_unlock(hashtextextended(${claim.id},7606))`; }
      finally { connection.release(); }
    }
  }
  async expireAudit(tenant: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(tenant)) throw new Error('Explicit audit tenant required');
    return this.client.begin(async tx => {
      await tx.unsafe("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'");
      return (await tx`SELECT gcms_s06.worker_expire_audit(${tenant},100) AS result`)[0].result as { authenticated: number; anonymous: number; system: number };
    });
  }
  async runOnce(tenant: string) {
    await this.verifyRole(); const claims = await this.claim(tenant), outcomes: string[] = [];
    for (const claim of claims) outcomes.push(await this.process(claim));
    return { claimed: claims.length, captured: outcomes.filter(x => x === 'captured').length, deleted: outcomes.filter(x => x === 'deleted').length,
      failed: outcomes.filter(x => x === 'failed').length, skipped: outcomes.filter(x => x === 'skipped').length, audit: await this.expireAudit(tenant) };
  }
  async close() { await this.client.close(); }
}
