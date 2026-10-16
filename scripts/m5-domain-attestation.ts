import { SQL } from 'bun';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { readM5Fixtures } from './m5-fixtures';
import { selectM5LocalDomains } from '../apps/api/src/auth/runtime-environment';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

async function main() {
 if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || !process.argv.includes('--local-m5') || !process.argv.includes('--enroll-local-domain-proof')) throw new Error('Explicit local M5 attestation enrollment required');
 const expiry = process.argv.find(v => v.startsWith('--expires-at='))?.slice('--expires-at='.length);
 if (!expiry || !Number.isFinite(Date.parse(expiry)) || new Date(expiry).toISOString() !== expiry || Date.parse(expiry) <= Date.now() || Date.parse(expiry) > Date.now() + 24 * 3600000) throw new Error('Explicit bounded future local verification instant required');
 const fixtures = await readM5Fixtures(); if (fixtures.status !== 'complete') throw new Error('Complete owned M5 scope required');
 const config = selectM5LocalDomains(fixtures), db = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
 try {
  const enrolled = await db.begin(async tx => {
   await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
   let count = 0;
   for (const binding of config.bindings) {
    const tenant = fixtures.tenants.find(t => t.id === binding.tenantId)!;
    const actual = await tx`SELECT t.name,t.status,s.phase,s.request_id,m.request_id AS tombstone_request FROM gcms_s02.tenant t JOIN gcms_m5.tenant_state s ON s.tenant_id=t.id LEFT JOIN gcms_m5.tombstone m ON m.tenant_id=t.id WHERE t.id=${tenant.id}`;
    // Completed one-shot deletion must never recreate its attestation or data.
    // A/B remain usable for review without requiring a reset of that fixture.
    if (tenant.label === 'Deletion' && actual[0]?.name === 'Deleted tenant' && actual[0]?.status === 'suspended' && actual[0]?.phase === 'completed' && actual[0]?.request_id && actual[0]?.request_id === actual[0]?.tombstone_request) continue;
    if (actual[0]?.name !== tenant.name || actual[0]?.status !== 'active') throw new Error('Positive owned active tenant required');
    await tx`SELECT gcms_m5.enroll_local_domain(${tenant.id},${binding.host},${expiry}::timestamptz)`;
    count++;
   }
   if (count < 3) throw new Error('Active owned A/B review domains required');
   return count;
  });
  const evidence = { status: 'PASS', purpose: 'explicit synthetic-local domain attestation', bindingCount: enrolled, completedDeletionBindingsSkipped: config.bindings.length - enrolled, expiresAt: expiry, liveDnsTlsVerified: false, retainedBindingsChanged: false, dispatchStarted: false };
  await writeFile(`docs/evidence/m5/domain-attestation-${Date.now()}.json`, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' }); console.info(JSON.stringify(evidence));
 } finally { await db.close(); }
}
if (import.meta.main) void main().catch(() => { console.error(JSON.stringify({ status: 'FAIL', phase: 'local_domain_attestation', detailsRedacted: true })); process.exitCode = 1; });
