import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { LeadsService } from '../apps/api/src/modules/leads.service';
import { openPasswordSession } from './s02-fixtures';

async function main() {
  if (!process.argv.includes('--local-auth-001') || !process.argv.includes('--ui-checkpoint-released') ||
    process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Explicit released AUTH assignment checkpoint required');
  const ui = await Bun.file('.local/auth-001-ui-resources.json').json();
  const browserOwner = ui.identities.find((row: { label: string }) => row.label === 'browserOwner');
  const peer = ui.identities.find((row: { label: string }) => row.label === 'browserPeer');
  const tenant = ui.tenantIds.B, attempt = ui.assignmentAttemptB, assigned = ui.assignmentB;
  if (ui.package !== 'GCMS-AUTH-001' || !browserOwner?.verified || !browserOwner.userId || !peer?.verified || !peer.userId ||
    !assigned?.leadId || !ui.leadsB?.some((lead: { id: string; tenantId: string }) => lead.id === assigned.leadId && lead.tenantId === tenant) ||
    assigned.userId !== peer.userId || attempt?.status !== 200 || attempt?.body?.kind !== 'assign' ||
    attempt.body.assigneeUserId !== peer.userId || !/^[A-Za-z0-9_-]{32}$/.test(peer.userId) || assigned.version !== attempt.body.expectedVersion + 1) {
    throw new Error('Exact successful new-user assignment checkpoint absent');
  }
  const readonly = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'),
    { max: 1, connectionTimeout: 3, connection: { default_transaction_read_only: 'on' } });
  const db = createS02Database(), identity = createS02Auth(db);
  let signed: Awaited<ReturnType<typeof openPasswordSession>> | undefined;
  const snapshot = () => readonly.begin(async tx => {
    await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
    const [state] = await tx`SELECT l.version,l.assignee_user_id,md5(to_jsonb(l)::text) AS lead_hash,
      (SELECT count(*)::integer FROM gcms_s05.lead_event e WHERE e.tenant_id=l.tenant_id AND e.lead_id=l.id) AS history_count,
      (SELECT md5(coalesce(string_agg(to_jsonb(e)::text,'|' ORDER BY e.id),'')) FROM gcms_s05.lead_event e WHERE e.tenant_id=l.tenant_id AND e.lead_id=l.id) AS history_hash,
      (SELECT count(*)::integer FROM gcms_s05.operation_receipt r WHERE r.tenant_id=l.tenant_id AND r.lead_id=l.id AND r.operation_id=${attempt.body.operationId}) AS receipt_count,
      (SELECT md5(to_jsonb(r)::text) FROM gcms_s05.operation_receipt r WHERE r.tenant_id=l.tenant_id AND r.lead_id=l.id AND r.operation_id=${attempt.body.operationId}) AS receipt_hash,
      (SELECT r.command=${JSON.stringify(attempt.body)}::text::jsonb FROM gcms_s05.operation_receipt r WHERE r.tenant_id=l.tenant_id AND r.lead_id=l.id AND r.operation_id=${attempt.body.operationId}) AS exact_receipt_body
      FROM gcms_s04.lead l WHERE l.tenant_id=${tenant} AND l.id=${assigned.leadId}`;
    return state;
  });
  try {
    const before = await snapshot();
    if (before?.version !== assigned.version || before.assignee_user_id !== peer.userId || before.history_count !== 1 ||
      before.receipt_count !== 1 || !before.exact_receipt_body) throw new Error('Unexpected pre-replay command state');
    signed = await openPasswordSession(identity, { userId: browserOwner.userId, email: browserOwner.email, password: browserOwner.password });
    const service = new LeadsService(db, identity);
    // Replay only the exact browser-confirmed command. The ordinary service uses
    // current CSRF/session/membership and the restricted tenant transaction.
    const result = await service.command({ method: 'POST', originalUrl: `/api/tenants/${tenant}/leads/${assigned.leadId}/commands`, headers: {
      host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', 'content-type': 'application/json',
      cookie: signed.headers.get('cookie') ?? '', 'x-csrf-token': identity.csrfToken(signed.actor),
    } }, tenant, assigned.leadId, attempt.body);
    if (!result.replayed || result.appliedVersion !== assigned.version || result.lead.version !== assigned.version ||
      result.lead.assignee?.userId !== peer.userId) throw new Error('Exact command replay mismatch');
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Replay changed lead/history/receipt');
    await mkdir('docs/evidence/auth-001/api', { recursive: true });
    await writeFile('docs/evidence/auth-001/api/assignment-exact-replay.json', JSON.stringify({ recordedAtUtc: new Date().toISOString(), status: 'PASS',
      newOrdinaryUserIdLength: peer.userId.length, exactBrowserOperationKeySha256: createHash('sha256').update(attempt.body.operationId).digest('hex'),
      restrictedTenantServiceReplay: true, replayed: true, leadVersion: after.version, historyCount: after.history_count,
      receiptCount: after.receipt_count, leadHistoryReceiptUnchanged: true, newAssignmentsCreated: 0, secretsPrinted: false,
      limit: 'Exact successful new-account browser assignment receipt replay via ordinary service and actual restricted PostgreSQL role; no additional assignment, lead or historical fixture changes.' }, null, 2) + '\n');
    console.info(JSON.stringify({ status: 'PASS', replayed: true, leadVersion: after.version, historyCount: after.history_count,
      receiptCount: after.receipt_count, newAssignmentsCreated: 0, secretsPrinted: false }));
  } finally { await signed?.call('/sign-out', {}); await db.close(); await readonly.close(); }
}
main().catch(() => { console.error('AUTH exact assignment proof failed; details redacted.'); process.exitCode = 1; });
