import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { auditExpiryTenant, assertAuditWorkerEnvironment, assertAuditWorkerManifest, AUDIT_WORKER_OWNER } from '../src/worker/audit-expiry-environment';
import { selectM2WorkerEnvironment } from '../../../scripts/start-m2-worker';
describe('bounded audit-only invocation', () => {
  test('requires one explicit valid tenant and one bounded run', () => {
    const id = randomUUID(); expect(auditExpiryTenant(['--tenant', id, '--once'])).toBe(id);
    for (const args of [[], ['--all', '--once'], ['--tenant', id], ['--tenant', id, '--watch'], ['--tenant', id, '--once', '--all'], ['--tenant', '../private', '--once']]) expect(() => auditExpiryTenant(args)).toThrow();
  });
  test('rejects another tenant, duplicate scopes and malformed or extra scope facts', () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()], m = { owner: AUDIT_WORKER_OWNER, runId: randomUUID(), tenantIds: ids };
    expect(() => assertAuditWorkerManifest(m, ids[0])).not.toThrow();
    for (const candidate of [null, [], { ...m, owner: 'old-m5' }, { ...m, runId: 'wrong' }, { ...m, tenantIds: [ids[0], ids[0], ids[1]] }, { ...m, tenantIds: [...ids, randomUUID()] }, { ...m, global: true }]) expect(() => assertAuditWorkerManifest(candidate, ids[0])).toThrow();
    expect(() => assertAuditWorkerManifest(m, randomUUID())).toThrow();
  });
  test('launcher selects only S06 worker credentials and runtime rejects ambient secrets', () => {
    const url = 'postgresql://gcms_s06_worker:synthetic@127.0.0.1:5888/gcms_s01';
    const env = selectM2WorkerEnvironment('s06', { S06_WORKER_DATABASE_URL: url, S07_STORAGE_SECRET_ACCESS_KEY: 'private' }, { PATH: '/synthetic', DATABASE_URL: 'owner', BETTER_AUTH_SECRET: 'private' });
    expect(env.S06_WORKER_DATABASE_URL).toBe(url); expect(Object.keys(env).sort()).toEqual(['PATH', 'S06_WORKER_DATABASE_URL']); expect(() => assertAuditWorkerEnvironment(env)).not.toThrow();
    for (const key of ['DATABASE_URL', 'S02_AUTH_DATABASE_URL', 'S07_WORKER_DATABASE_URL', 'BETTER_AUTH_SECRET', 'S04_HMAC_SECRET', 'AWS_PROFILE', 'AWS_SESSION_TOKEN', 'S3_ACCESS_KEY_ID']) expect(() => assertAuditWorkerEnvironment({ ...env, [key]: '' })).toThrow();
  });
});
