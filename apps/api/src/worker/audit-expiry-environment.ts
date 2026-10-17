export const AUDIT_WORKER_OWNER = 'GCMS-AUDIT-EXPIRY-001-v1';
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export interface AuditWorkerManifest { owner: typeof AUDIT_WORKER_OWNER; runId: string; tenantIds: string[] }
export function auditExpiryTenant(args: string[]): string {
  if (args.length !== 3 || args[0] !== '--tenant' || args[2] !== '--once' || !uuid(args[1])) throw new Error('Explicit audit-only tenant/once required');
  return args[1];
}
export function assertAuditWorkerManifest(input: unknown, tenant: string): asserts input is AuditWorkerManifest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid audit worker scope');
  const v = input as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'owner,runId,tenantIds' || v.owner !== AUDIT_WORKER_OWNER || !uuid(v.runId) || !Array.isArray(v.tenantIds) || v.tenantIds.length !== 3 || !v.tenantIds.every(uuid) || new Set(v.tenantIds).size !== 3 || !uuid(tenant) || !v.tenantIds.includes(tenant)) throw new Error('Unselected audit tenant');
}
export function assertAuditWorkerEnvironment(env: Record<string, string | undefined>) {
  for (const key of Object.keys(env)) {
    if ((/DATABASE_URL$/.test(key) && key !== 'S06_WORKER_DATABASE_URL') || /SECRET|PASSWORD|TOKEN|ACCESS_KEY|AWS_|^S3_|^REDIS_|^BETTER_AUTH_/.test(key)) throw new Error('Audit worker credential isolation required');
  }
}
