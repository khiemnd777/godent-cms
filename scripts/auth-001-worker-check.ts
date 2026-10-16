import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { LeadNotificationWorker } from '../apps/api/src/worker/lead-worker';
import { LocalLeadCapture, SIGN_IN_URL } from '../apps/api/src/worker/local-capture';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { openPasswordSession } from './s02-fixtures';

interface UiCheckpoint {
  package: string; tenantIds: { A: string; B: string | null };
  identities: Array<{ label: string; userId: string | null; email: string; password: string; verified: boolean }>;
  sourceB?: { tenantId: string; tenantSlug: string; serviceId: string; serviceSlug: string; publicationId: string };
  leadsB?: Array<{ id: string; tenantId: string; code: string }>;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
async function main() {
  if (!process.argv.includes('--local-auth-001') || !process.argv.includes('--ui-checkpoint-released') ||
    process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Explicit released AUTH checkpoint required');
  const ui = JSON.parse(await readFile('.local/auth-001-ui-resources.json', 'utf8')) as UiCheckpoint;
  const tenant = ui.tenantIds.B, browserOwner = ui.identities.find(item => item.label === 'browserOwner');
  if (ui.package !== 'GCMS-AUTH-001' || !tenant || tenant === ui.tenantIds.A || !browserOwner?.userId || !browserOwner.verified ||
    ui.sourceB?.tenantId !== tenant || ui.leadsB?.length !== 3 || ui.leadsB.some(lead => lead.tenantId !== tenant) ||
    new Set(ui.leadsB.map(lead => lead.id)).size !== 3) throw new Error('Owned three-lead checkpoint absent');
  const baseline = JSON.parse(await readFile('.local/auth-001-db-baseline.json', 'utf8')) as {
    tables: Array<{ schema: string; table: string; projections: Array<{ keyHash: string }> }> };
  for (const [schema, name, id] of [['gcms_s02', 'tenant', tenant], ['gcms_s02_auth', 'user', browserOwner.userId]]) {
    if (baseline.tables.find(table => table.schema === schema && table.table === name)?.projections.some(row => row.keyHash === hash(JSON.stringify([id])))) {
      throw new Error('Worker scope or recipient belongs to retained baseline');
    }
  }
  const leadIds = new Set(ui.leadsB.map(lead => lead.id));
  const owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  const worker = new LeadNotificationWorker(process.env.S05_WORKER_DATABASE_URL!, new LocalLeadCapture(resolve('.local/auth-001-data-worker-mail')));
  const db = createS02Database(), identity = createS02Auth(db);
  let signed: Awaited<ReturnType<typeof openPasswordSession>> | undefined;
  let priorScope: boolean | null = null, scopeChanged = false;
  const owned = <T>(action: (tx: SQL) => Promise<T>) => owner.begin(async tx => {
    await tx.unsafe('SET LOCAL ROLE gcms_s02_owner'); return action(tx as unknown as SQL);
  });
  const backlog = () => owned(tx => tx`SELECT
    (SELECT md5(coalesce(string_agg(to_jsonb(i)::text,'|' ORDER BY i.tenant_id,i.lead_id),'')) FROM gcms_s04.notification_intent i WHERE tenant_id<>${tenant}) AS intents,
    (SELECT md5(coalesce(string_agg(to_jsonb(d)::text,'|' ORDER BY d.id),'')) FROM gcms_s05.delivery d WHERE tenant_id<>${tenant}) AS deliveries`);
  try {
    const beforeBacklog = await backlog();
    const checkpoint = await owned(async tx => {
      const sources = await tx`SELECT s.tenant_id,s.slug,d.id,p.snapshot_id FROM gcms_s02.site_draft s JOIN gcms_s02.service_draft d ON d.tenant_id=s.tenant_id
        JOIN gcms_s02.publication_pointer p ON p.tenant_id=d.tenant_id AND p.service_id=d.id
        JOIN gcms_s02.tenant t ON t.id=s.tenant_id WHERE t.id=${tenant} AND t.status='active' AND s.slug=${ui.sourceB!.tenantSlug}
        AND d.id=${ui.sourceB!.serviceId} AND d.slug=${ui.sourceB!.serviceSlug} AND p.snapshot_id=${ui.sourceB!.publicationId}`;
      const actor = await tx`SELECT u.active,u.email_verified,u.two_factor_enabled,m.status,gcms_s05.eligible(${tenant},u.id) AS eligible
        FROM gcms_s02_auth."user" u JOIN gcms_s02.membership m ON m.user_id=u.id AND m.tenant_id=${tenant} WHERE u.id=${browserOwner.userId}`;
      const leads = await tx`SELECT l.id,l.status,l.expires_at>clock_timestamp() AS unexpired FROM gcms_s04.lead l WHERE tenant_id=${tenant}`;
      const intents = await tx`SELECT lead_id,status FROM gcms_s04.notification_intent WHERE tenant_id=${tenant}`;
      const settings = await tx`SELECT mode,initial_user_id,recipient_user_ids FROM gcms_s05.recipient_settings WHERE tenant_id=${tenant}`;
      const scope = await tx`SELECT enabled FROM gcms_s05.worker_scope WHERE tenant_id=${tenant}`;
      return { sources, actor, leads, intents, settings, scope };
    });
    if (checkpoint.sources.length !== 1 || checkpoint.actor.length !== 1 || !checkpoint.actor[0].active || !checkpoint.actor[0].email_verified ||
      checkpoint.actor[0].two_factor_enabled || checkpoint.actor[0].status !== 'active' || !checkpoint.actor[0].eligible ||
      checkpoint.leads.length !== 3 || checkpoint.leads.some((lead: { id: string }) => !leadIds.has(lead.id)) ||
      checkpoint.intents.length !== 3 || checkpoint.intents.some((intent: { lead_id: string }) => !leadIds.has(intent.lead_id))) throw new Error('Live source/recipient/intent ownership mismatch');
    const recipient = checkpoint.settings[0];
    const recipients = recipient?.mode === 'default' ? [recipient.initial_user_id] : recipient?.recipient_user_ids;
    if (!Array.isArray(recipients) || recipients.length !== 1 || recipients[0] !== browserOwner.userId) throw new Error('Current recipients must name only the new owner');
    if (!checkpoint.leads.some((lead: { status: string; unexpired: boolean }) => lead.status !== 'closed' && lead.unexpired)) throw new Error('No currently eligible owned lead');
    signed = await openPasswordSession(identity, { userId: browserOwner.userId, email: browserOwner.email, password: browserOwner.password });
    if ('twoFactorEnabled' in signed.actor || 'mfaVerified' in signed.actor) throw new Error('Unexpected factor session fields');
    await worker.verifyRole();
    priorScope = checkpoint.scope.length ? checkpoint.scope[0].enabled : null;
    await owned(tx => tx`INSERT INTO gcms_s05.worker_scope(tenant_id,enabled) VALUES(${tenant},true)
      ON CONFLICT(tenant_id) DO UPDATE SET enabled=true`); scopeChanged = true;
    // One explicitly scoped claim call; no poll, global run, retry drain or old-tenant call.
    const claims = await worker.claim(tenant, 3);
    if (!claims.length || claims.length > 3 || claims.some(claim => claim.tenantId !== tenant)) throw new Error('Unexpected claim scope');
    const deliveries = await owned(tx => tx`SELECT id,lead_id,recipient_user_id FROM gcms_s05.delivery WHERE tenant_id=${tenant}`);
    const map = new Map<string, { lead_id: string; recipient_user_id: string }>(deliveries.map((row: { id: string; lead_id: string; recipient_user_id: string }) => [row.id, row]));
    for (const claim of claims) {
      const delivery = map.get(claim.id);
      if (!delivery || !leadIds.has(delivery.lead_id) || delivery.recipient_user_id !== browserOwner.userId) throw new Error('Delivery outside exact approved IDs');
    }
    const staleFence = await worker.process({ ...claims[0], fence: claims[0].fence - 1 });
    if (staleFence !== 'skipped') throw new Error('Stale fence was not denied');
    const outcomes = [];
    for (const claim of claims) outcomes.push(await worker.process(claim));
    if (outcomes.some(outcome => outcome !== 'captured')) throw new Error('Owned local capture did not settle successfully');
    const final = await owned(tx => tx`SELECT d.id,d.lead_id,d.recipient_user_id,d.status,d.attempts,i.status AS intent_status
      FROM gcms_s05.delivery d JOIN gcms_s04.notification_intent i ON i.tenant_id=d.tenant_id AND i.lead_id=d.lead_id WHERE d.tenant_id=${tenant}`);
    const directory = resolve('.local/auth-001-data-worker-mail'), captureChecks = [];
    for (const claim of claims) {
      const file = resolve(directory, `${claim.id}.json`), metadata = await lstat(file), bytes = await readFile(file, 'utf8');
      const message = JSON.parse(bytes);
      const state = final.find((row: { id: string }) => row.id === claim.id);
      if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o777) !== 0o600 || message.deliveryId !== claim.id ||
        message.recipientEmail !== browserOwner.email || message.transport !== 'local_capture' || message.signInUrl !== SIGN_IN_URL ||
        Object.keys(message).sort().join(',') !== 'deliveryId,recipientEmail,signInUrl,subject,text,transport' ||
        state?.status !== 'captured' || state.attempts !== 1 || state.intent_status !== 'captured') throw new Error('Local receipt or settled DB state mismatch');
      captureChecks.push({ mode: '0600', genericMessageOnly: true, sha256: hash(bytes), attempts: state.attempts });
    }
    if ((await readdir(directory)).length !== claims.length) throw new Error('Unexpected extra local receipts');
    if ((await worker.claim(tenant, 3)).length !== 0) throw new Error('Settled delivery was claimed again');
    const afterBacklog = await backlog();
    if (JSON.stringify(beforeBacklog) !== JSON.stringify(afterBacklog)) throw new Error('Other tenant backlog changed');
    await mkdir('docs/evidence/auth-001/api', { recursive: true });
    await writeFile('docs/evidence/auth-001/api/worker-local-capture.json', JSON.stringify({ recordedAtUtc: new Date().toISOString(), status: 'PASS',
      newTenantOnly: true, exactManifestLeadCount: 3, freshPasswordOnlyRecipient: true, recipientNeverEnrolled: true,
      narrowWorkerRoleVerified: true, staleFence: 'DENIED', claimed: claims.length, captured: outcomes.length, captureChecks,
      repeatedClaimCount: 0, otherTenantBacklogUnchanged: true, externalMail: 'NOT_RUN_LOCAL_CAPTURE_ONLY', secretsPrinted: false,
    }, null, 2) + '\n');
    console.info(JSON.stringify({ status: 'PASS', claimed: claims.length, captured: outcomes.length, newTenantOnly: true, staleFenceDenied: true, otherTenantBacklogUnchanged: true, secretsPrinted: false }));
  } finally {
    if (scopeChanged) await owned(tx => tx`UPDATE gcms_s05.worker_scope SET enabled=${priorScope ?? false} WHERE tenant_id=${tenant}`);
    await signed?.call('/sign-out', {}); await worker.close(); await db.close(); await owner.close();
  }
}
main().catch(() => { console.error('AUTH bounded worker proof failed; details redacted.'); process.exitCode = 1; });
