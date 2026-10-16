import { SQL } from 'bun';
import { randomUUID } from 'node:crypto';
import { validateDatabaseUrl } from '../auth/policy';
import { S05_LIMITS } from '../contracts/s05';
import { LocalLeadCapture, PermanentCaptureFailure, type LeadCaptureMessage, type LeadCaptureTransport } from './local-capture';

export interface ClaimedDelivery { id: string; tenantId: string; fence: number }
export class LeadNotificationWorker {
  private readonly client: SQL;
  private budgetOverruns = 0;
  readonly workerId = randomUUID();
  constructor(url: string, private readonly transport: LeadCaptureTransport = new LocalLeadCapture()) {
    this.client = new SQL(validateDatabaseUrl(url, 'gcms_s05_worker'), { max: 3, connectionTimeout: 3, idleTimeout: 60, maxLifetime: 0 });
  }
  async verifyRole() {
    const rows = await this.client`SELECT current_user AS name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,
      pg_has_role(current_user,'gcms_s02_owner','MEMBER') AS owner_member,
      EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname IN ('gcms_s02','gcms_s02_auth','gcms_s04','gcms_s05') AND n.nspowner=r.oid) AS owns_schema,
      has_table_privilege(current_user,(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='gcms_s04' AND c.relname='lead'),'SELECT,INSERT,UPDATE,DELETE') AS lead_access,
      has_table_privilege(current_user,(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='gcms_s02_auth' AND c.relname='user'),'SELECT,INSERT,UPDATE,DELETE') AS auth_access
      FROM pg_roles r WHERE rolname=current_user`;
    const r = rows[0];
    if (!r || r.name !== 'gcms_s05_worker' || r.rolsuper || r.rolbypassrls || r.rolcreaterole || r.rolcreatedb || r.owner_member || r.owns_schema || r.lead_access || r.auth_access) throw new Error('Unsafe worker role');
  }
  async claim(tenant: string, limit: number = S05_LIMITS.batchSize): Promise<ClaimedDelivery[]> {
    if (!/^[a-f0-9-]{36}$/.test(tenant) || !Number.isSafeInteger(limit) || limit < 1 || limit > S05_LIMITS.batchSize) throw new Error('Invalid worker scope');
    const rows = await this.client`SELECT gcms_s05.worker_claim(${tenant},${this.workerId},${limit}) AS claims`;
    return rows[0].claims as ClaimedDelivery[];
  }
  async process(claim: ClaimedDelivery): Promise<'captured' | 'failed' | 'skipped'> {
    const connection = await this.client.reserve(); let locked = false;
    try {
      const lock = await connection`SELECT pg_try_advisory_lock(hashtextextended(${claim.id},7505)) AS locked`; locked = lock[0].locked === true;
      if (!locked) return 'skipped';
      const rows = await connection`SELECT gcms_s05.worker_start(${claim.tenantId},${claim.id},${this.workerId},${claim.fence}) AS message`;
      const message = rows[0].message as LeadCaptureMessage | null;
      if (!message) return 'skipped';
      let outcome: 'captured' | 'transient' | 'permanent' = 'captured';
      const controller = new AbortController();
      const budget = setTimeout(() => {
        this.budgetOverruns++; controller.abort();
        console.warn('S05 capture exceeded 2s budget; waiting for I/O settlement.');
      }, 2000);
      try {
        // Await actual settlement. Promise.race, a timer or AbortSignal alone cannot
        // prove that I/O stopped, so none may release this advisory lock early.
        await this.transport.capture(message, controller.signal);
      } catch (error) { outcome = error instanceof PermanentCaptureFailure ? 'permanent' : 'transient'; }
      finally { clearTimeout(budget); }
      const finished = await connection`SELECT gcms_s05.worker_finish(${claim.tenantId},${claim.id},${this.workerId},${claim.fence},${outcome}) AS applied`;
      return finished[0].applied && outcome === 'captured' ? 'captured' : 'failed';
    } finally {
      try { if (locked) await connection`SELECT pg_advisory_unlock(hashtextextended(${claim.id},7505))`; }
      finally { connection.release(); }
    }
  }
  async runOnce(tenant: string) {
    await this.verifyRole(); const claims = await this.claim(tenant), results: string[] = [];
    for (let offset = 0; offset < claims.length; offset += S05_LIMITS.concurrency) {
      results.push(...await Promise.all(claims.slice(offset, offset + S05_LIMITS.concurrency).map(claim => this.process(claim))));
    }
    return { claimed: claims.length, captured: results.filter(r => r === 'captured').length, failed: results.filter(r => r === 'failed').length, skipped: results.filter(r => r === 'skipped').length, budgetOverruns: this.budgetOverruns };
  }
  async close() { await this.client.close(); }
}
