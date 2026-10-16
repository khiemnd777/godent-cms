import { SQL } from 'bun';
import { randomUUID } from 'node:crypto';
import { lstat, open, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { S03_ROUTES, type PublicServicePage } from '../apps/api/src/contracts/s03';
import { S04_ROUTES, type IntakeChallenge, type IntakeInput } from '../apps/api/src/contracts/s04';
import { S05_ROUTES, type LeadCommand, type LeadCommandResult, type LeadDetail } from '../apps/api/src/contracts/s05';
import { S06_ROUTES } from '../apps/api/src/contracts/s06';
import type { CurrentSession } from '../apps/api/src/contracts/s02';
import { openPasswordSession } from './s02-fixtures';
import { selectM2WorkerEnvironment } from './start-m2-worker';
import type { M2UiFixtures } from './m2-ui-fixtures';

const OWNER = 'GCMS-M2-LEAD-JOURNEY-v1', JOURNEY_MANIFEST = '.local/m2-lead-journey.json';
const API = 'http://127.0.0.1:5890', PUBLIC_ORIGIN = 'http://localhost:5892';
const CAPTURE = '.local/m2-retention-mail';
const SUBJECT = 'Yêu cầu tư vấn sắp hết thời hạn lưu trữ';
const NOTICE_TEXT = 'Đăng nhập CMS để kiểm tra thời hạn lưu trữ yêu cầu tư vấn.';
const SIGN_IN = 'http://127.0.0.1:5891/login';
type Identity = { label: string; userId: string; email: string; password: string };
interface Check { stage: string; status: 'PASS'; counts?: Record<string, number>; httpStatuses?: number[]; flags?: Record<string, boolean> }
interface WorkerResult {
  status: 'completed'; transport: 'local_capture'; claimed: number; captured: number; deleted: number; failed: number; skipped: number;
  audit: { authenticated: number; anonymous: number; system: number };
}
interface WorkerRun {
  stage: string; exitCode: number;
  launch: { kind: 'M2_WORKER_LAUNCH'; slice: 's06'; tenantId: string; selectedEnvironmentKeys: string[]; runtime: string; credentialsPrinted: false };
  result: WorkerResult;
}
interface Manifest {
  owner: typeof OWNER; schemaVersion: 1; runId: string; fixtureRunId: string; tenantId: string; serviceId: string;
  requestKey: string; sourcePublicationId: string | null; leadId: string | null;
  operationIds: { assign: string; note: string; contact: string; extension: string };
  status: 'running' | 'PASS' | 'FAIL'; stage: string; createdAt: string; updatedAt: string;
  checks: Check[]; workerRuns: WorkerRun[]; selectedEnvironmentKeys: string[];
  failureCode?: string; cleanupPerformed: false;
}
class JourneyFailure extends Error { constructor(readonly code: string) { super(code); } }
function requireThat(condition: unknown, code: string): asserts condition { if (!condition) throw new JourneyFailure(code); }
function uuid(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value); }
function shape(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys.sort().join(',');
}
async function privateFile(path: string) {
  const metadata = await lstat(path);
  requireThat(metadata.isFile() && !metadata.isSymbolicLink() && (metadata.mode & 0o777) === 0o600 && metadata.uid === process.getuid?.(), 'UNSAFE_PRIVATE_FILE');
  return readFile(path, 'utf8');
}
async function privateJson<T>(path: string): Promise<T> { return JSON.parse(await privateFile(path)) as T; }
async function save(manifest: Manifest, initial = false) {
  manifest.updatedAt = new Date().toISOString();
  if (initial) {
    const handle = await open(JOURNEY_MANIFEST, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(manifest, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
  } else {
    const prior = await privateJson<Manifest>(JOURNEY_MANIFEST);
    requireThat(prior.owner === OWNER && prior.runId === manifest.runId && prior.tenantId === manifest.tenantId && prior.requestKey === manifest.requestKey, 'JOURNEY_OWNERSHIP_CHANGED');
    const temporary = `.local/m2-lead-journey-${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const handle = await open(temporary, 'r'); try { await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, JOURNEY_MANIFEST);
  }
  const directory = await open('.local', 'r'); try { await directory.sync(); } finally { await directory.close(); }
}
async function owned<T>(owner: SQL, tenant: string, action: (tx: SQL) => Promise<T>): Promise<T> {
  return owner.begin(async transaction => {
    await transaction.unsafe('SET LOCAL ROLE gcms_s02_owner');
    await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${tenant},7202))`;
    return action(transaction as unknown as SQL);
  });
}
async function http<T>(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(API + path, { method, headers: { host: '127.0.0.1:5890', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(15000) });
  return { status: response.status, value: await response.json() as T };
}
async function workerOnce(manifest: Manifest, configuration: Record<string, string>): Promise<WorkerRun> {
  const environment = selectM2WorkerEnvironment('s06', configuration, process.env);
  const keys = Object.keys(environment).sort();
  requireThat(keys.every(key => ['PATH', 'HOME', 'TMPDIR', 'NODE_ENV', 'S06_WORKER_DATABASE_URL'].includes(key)), 'WORKER_ENVIRONMENT_NOT_ISOLATED');
  manifest.selectedEnvironmentKeys = keys; await save(manifest);
  const child = Bun.spawn([process.execPath, '--no-env-file', 'scripts/start-m2-worker.ts', 's06', '--tenant', manifest.tenantId, '--once'],
    { env: environment, stdout: 'pipe', stderr: 'pipe' });
  // Await actual process/I/O completion. A timeout is not a worker completion receipt.
  const [output, , exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  requireThat(exitCode === 0, 'WORKER_PROCESS_FAILED');
  const lines = output.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as unknown);
  requireThat(lines.length === 2, 'UNEXPECTED_WORKER_OUTPUT');
  const [launch, result] = lines;
  requireThat(shape(launch, ['kind', 'slice', 'tenantId', 'selectedEnvironmentKeys', 'runtime', 'credentialsPrinted']) &&
    launch.kind === 'M2_WORKER_LAUNCH' && launch.slice === 's06' && launch.tenantId === manifest.tenantId && launch.runtime === '1.4.3' &&
    launch.credentialsPrinted === false && JSON.stringify(launch.selectedEnvironmentKeys) === JSON.stringify(keys), 'WORKER_LAUNCH_RECEIPT_INVALID');
  requireThat(shape(result, ['status', 'transport', 'claimed', 'captured', 'deleted', 'failed', 'skipped', 'audit']) && result.status === 'completed' && result.transport === 'local_capture', 'WORKER_COMPLETION_RECEIPT_INVALID');
  for (const key of ['claimed', 'captured', 'deleted', 'failed', 'skipped']) requireThat(Number.isSafeInteger(result[key]) && Number(result[key]) >= 0, 'WORKER_COUNTS_INVALID');
  requireThat(Number(result.claimed) <= 10 && shape(result.audit, ['authenticated', 'anonymous', 'system']) &&
    Object.values(result.audit).every(n => Number.isSafeInteger(n) && Number(n) >= 0), 'WORKER_BATCH_INVALID');
  const run = { stage: manifest.stage, exitCode, launch, result } as unknown as WorkerRun;
  manifest.workerRuns.push(run); await save(manifest); return run;
}

let manifest: Manifest | undefined, createdManifest = false, stage = 'preflight';
export async function runM2LeadJourney() {
  requireThat(process.cwd() === resolve(import.meta.dir, '..') && Bun.version === '1.4.3' &&
    process.argv.includes('--local-m2') && process.argv.includes('--synthetic-fixtures'), 'EXPLICIT_LOCAL_M2_REQUIRED');
  const directory = await lstat('.local');
  requireThat(directory.isDirectory() && !directory.isSymbolicLink() && (directory.mode & 0o777) === 0o700 && directory.uid === process.getuid?.() && await realpath('.local') === resolve('.local'), 'UNSAFE_LOCAL_DIRECTORY');
  const fixture = await privateJson<M2UiFixtures>('.local/m2-fixtures.json');
  const browser = await privateJson<{ owner: string; runId: string; identities: Identity[] }>('.local/m2-browser-identities.json');
  requireThat(fixture.owner === 'GCMS-M2-UI-v1' && fixture.status === 'complete' && uuid(fixture.runId) && browser.owner === 'GCMS-M2-BROWSER-v1' && browser.runId === fixture.runId, 'FIXTURE_OWNERSHIP_INVALID');
  const tenant = fixture.tenants.find(t => t.label === 'A'), person = browser.identities.find(i => i.label === 'A1');
  requireThat(tenant && uuid(tenant.id) && uuid(tenant.serviceId) && tenant.slug === `m2-ui-${fixture.runId.slice(0, 8)}-a` &&
    tenant.serviceSlug === 'tu-van-nha-khoa' && fixture.retentionTenantIds.includes(tenant.id), 'TENANT_SCOPE_INVALID');
  requireThat(person && uuid(person.userId) && person.email === `m2-${fixture.runId}-a1@synthetic.example.test` && typeof person.password === 'string' && person.password.length >= 12, 'BROWSER_ACTOR_INVALID');
  const configuration = Object.fromEntries((await privateFile('.local/m2.env')).trim().split('\n').map(line => { const at = line.indexOf('='); requireThat(at > 0, 'PRIVATE_CONFIGURATION_INVALID'); return [line.slice(0, at), line.slice(at + 1)]; }));
  validateDatabaseUrl(configuration.S06_WORKER_DATABASE_URL, 'gcms_s06_worker');
  manifest = { owner: OWNER, schemaVersion: 1, runId: randomUUID(), fixtureRunId: fixture.runId, tenantId: tenant.id, serviceId: tenant.serviceId,
    requestKey: randomUUID(), sourcePublicationId: null, leadId: null, operationIds: { assign: randomUUID(), note: randomUUID(), contact: randomUUID(), extension: randomUUID() },
    status: 'running', stage, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), checks: [], workerRuns: [], selectedEnvironmentKeys: [], cleanupPerformed: false };
  await save(manifest, true); createdManifest = true;
  // Ownership is durable before login creates a session or intake creates a lead.
  const runtime = await loadRuntimeEnvironment(), database = createS02Database(runtime.api), identity = createS02Auth(database, runtime.api);
  const owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1, connectionTimeout: 3 });
  const journey = manifest;
  async function enter(next: string) { stage = next; journey.stage = next; await save(journey); }
  async function passed(check: Omit<Check, 'stage' | 'status'> = {}) { journey.checks.push({ stage, status: 'PASS', ...check }); await save(journey); }
  async function ownLead(tx: SQL) {
    requireThat(uuid(journey.leadId), 'NEW_LEAD_NOT_RECORDED');
    const rows = await tx`SELECT l.id FROM gcms_s04.lead l JOIN gcms_s04.accepted_request r ON r.tenant_id=l.tenant_id AND r.lead_id=l.id
      WHERE l.tenant_id=${journey.tenantId} AND l.id=${journey.leadId} AND r.request_key=${journey.requestKey} AND l.source_service_id=${journey.serviceId}
      AND l.source_publication_id=${journey.sourcePublicationId} FOR UPDATE OF l`;
    requireThat(rows.length === 1, 'NEW_LEAD_OWNERSHIP_NOT_PROVEN');
  }
  try {
    await enter('current_fixture_scope');
    const allowedPriorLeads = fixture.leads.filter(l => l.tenantId === tenant.id).map(l => l.id);
    requireThat(allowedPriorLeads.length === 2 && allowedPriorLeads.every(uuid), 'PRIOR_WORKER_SCOPE_INVALID');
    const privacy=await privateJson<{owner:string;runId:string;lead:{id:string;tenantId:string}}>('.local/m2-privacy-lead.json');
    requireThat(privacy.owner==='GCMS-M2-PRIVACY-v1'&&privacy.runId===fixture.runId&&privacy.lead.tenantId===tenant.id&&uuid(privacy.lead.id),'PRIVACY_WORKER_SCOPE_INVALID');
    allowedPriorLeads.push(privacy.lead.id);
    await owned(owner, tenant.id, async tx => {
      const current = await tx`SELECT t.name,t.status,s.slug,s.public_enabled,s.slug_locked FROM gcms_s02.tenant t JOIN gcms_s02.site_draft s ON s.tenant_id=t.id WHERE t.id=${tenant.id}`;
      requireThat(current.length === 1 && current[0].name === tenant.name && current[0].status === 'active' && current[0].slug === tenant.slug && current[0].public_enabled && current[0].slug_locked, 'CURRENT_TENANT_ELIGIBILITY_INVALID');
      const scope = await tx`SELECT lead_id FROM gcms_s06.lead_scope WHERE tenant_id=${tenant.id}`;
      requireThat(scope.length === allowedPriorLeads.length && scope.every((row: { lead_id: string }) => allowedPriorLeads.includes(row.lead_id)), 'UNAPPROVED_EXISTING_WORKER_SCOPE');
      const selected = await tx`SELECT enabled FROM gcms_s06.worker_scope WHERE tenant_id=${tenant.id}`; requireThat(selected[0]?.enabled === true, 'WORKER_SCOPE_NOT_ENABLED');
      const collision = await tx`SELECT 1 FROM gcms_s04.accepted_request WHERE tenant_id=${tenant.id} AND request_key=${journey.requestKey}`; requireThat(collision.length === 0, 'INTAKE_REQUEST_ALREADY_EXISTS');
    });
    await passed({ counts: { previouslySelectedSyntheticLeads: allowedPriorLeads.length } });

    await enter('normal_http_password_login');
    const transport = (request: Request) => {
      const headers: Record<string, string> = { host: '127.0.0.1:5890' };
      request.headers.forEach((value, key) => { headers[key] = value; });
      return fetch(API + new URL(request.url).pathname, { method: request.method, headers, body: request.body, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    };
    const signed = await openPasswordSession(identity, person, transport);
    requireThat(signed.actor.userId === person.userId, 'NORMAL_LOGIN_ACTOR_MISMATCH');
    const cookie = signed.headers.get('cookie') ?? '';
    const session = await http<CurrentSession>('/api/session', 'GET', undefined, { cookie });
    requireThat(session.status === 200 && typeof session.value.csrfToken === 'string', 'CURRENT_SESSION_UNAVAILABLE');
    const privateHeaders = { origin: 'http://127.0.0.1:5891', cookie, 'content-type': 'application/json', 'x-csrf-token': session.value.csrfToken };
    const privateCall = <T>(path: string, method = 'GET', body?: unknown) => http<T>(path, method, body, privateHeaders);
    await passed({ httpStatuses: [session.status], flags: { passwordHttpLogin: true, currentSession: true, csrfFromSession: true } });

    await enter('public_source_and_actual_intake');
    const publicSource = await http<PublicServicePage>(S03_ROUTES.publicService(tenant.slug, tenant.serviceSlug));
    requireThat(publicSource.status === 200 && uuid(publicSource.value.publicationId) && publicSource.value.service.slug === tenant.serviceSlug &&
      publicSource.value.canonicalUrl === `${PUBLIC_ORIGIN}/${tenant.slug}/dich-vu/${tenant.serviceSlug}`, 'CURRENT_PUBLIC_SOURCE_UNAVAILABLE');
    journey.sourcePublicationId = publicSource.value.publicationId; await save(journey);
    const input: IntakeInput = { requestKey: journey.requestKey, sourcePublicationId: journey.sourcePublicationId, name: 'M2 synthetic lead journey', phone: '0900000199',
      message: 'Synthetic local journey request.', preferredLanguage: 'vi', preferredChannel: 'phone', consent: true };
    const publicHeaders = { origin: PUBLIC_ORIGIN, 'content-type': 'application/json' };
    let accepted = await http<{ status?: string; code?: string }>(S04_ROUTES.intake(tenant.slug, tenant.serviceSlug), 'POST', input, publicHeaders), captchaUsed = false;
    if (accepted.status === 428 && accepted.value.code === 'CAPTCHA_REQUIRED') {
      const challenge = await http<IntakeChallenge>(S04_ROUTES.challenge(tenant.slug, tenant.serviceSlug), 'POST', { requestKey: journey.requestKey }, publicHeaders);
      requireThat(challenge.status === 200 && challenge.value.kind === 'local-arithmetic' && uuid(challenge.value.token), 'LOCAL_CHALLENGE_UNAVAILABLE');
      const numbers = challenge.value.prompt.match(/^([1-9]|10) \+ ([1-9]|10) = \?$/);
      requireThat(numbers, 'LOCAL_CHALLENGE_FORMAT_INVALID');
      input.challenge = { token: challenge.value.token, answer: String(Number(numbers[1]) + Number(numbers[2])) }; captchaUsed = true;
      accepted = await http(S04_ROUTES.intake(tenant.slug, tenant.serviceSlug), 'POST', input, publicHeaders);
    }
    requireThat(accepted.status === 200 && accepted.value.status === 'accepted', 'ACTUAL_INTAKE_FAILED');
    await owned(owner, tenant.id, async tx => {
      const found = await tx`SELECT r.lead_id FROM gcms_s04.accepted_request r JOIN gcms_s04.lead l ON l.tenant_id=r.tenant_id AND l.id=r.lead_id
        WHERE r.tenant_id=${tenant.id} AND r.request_key=${journey.requestKey} AND r.service_id=${tenant.serviceId} AND r.publication_id=${journey.sourcePublicationId}
        AND l.source_publication_id=${journey.sourcePublicationId} AND r.accepted_at>=${journey.createdAt}::timestamptz`;
      requireThat(found.length === 1 && uuid(found[0].lead_id), 'ACCEPTED_NEW_LEAD_NOT_FOUND'); journey.leadId = found[0].lead_id;
    });
    await save(journey); await passed({ httpStatuses: [publicSource.status, accepted.status], counts: { newlyAcceptedLeads: 1 }, flags: { captchaUsed } });
    const leadPath = S05_ROUTES.lead(tenant.id, journey.leadId!);
    const getLead = async () => { const value = await privateCall<LeadDetail>(leadPath); requireThat(value.status === 200 && value.value.id === journey.leadId, 'CURRENT_LEAD_READ_FAILED'); return value.value; };
    let lead = await getLead(); requireThat(lead.version === 1, 'NEW_LEAD_VERSION_INVALID');

    await enter('s05_assignment_note_and_two_way_contact');
    const commands: LeadCommand[] = [
      { operationId: journey.operationIds.assign, expectedVersion: 1, kind: 'assign', assigneeUserId: person.userId },
      { operationId: journey.operationIds.note, expectedVersion: 2, kind: 'note', text: 'Synthetic note for the local lead journey.' },
      { operationId: journey.operationIds.contact, expectedVersion: 3, kind: 'contact', channel: 'phone', outcome: 'two_way', summary: 'Synthetic two-way contact confirmed for local verification.' },
    ];
    for (const command of commands) {
      requireThat(lead.version === command.expectedVersion, 'COMMAND_EXPECTED_VERSION_MISMATCH');
      const result = await privateCall<LeadCommandResult>(S05_ROUTES.commands(tenant.id, journey.leadId!), 'POST', command);
      requireThat(result.status === 200 && !result.value.replayed && result.value.appliedVersion === command.expectedVersion + 1 && result.value.lead.version === command.expectedVersion + 1, 'S05_COMMAND_FAILED'); lead = result.value.lead;
    }
    requireThat(lead.assignee?.userId === person.userId && lead.status === 'contacted' && lead.hasTwoWayContact && lead.hasContactAttempt, 'S05_CONTACT_STATE_INVALID');
    await passed({ counts: { appliedCommands: commands.length, resultingVersion: lead.version }, flags: { selfAssigned: true, noteSaved: true, twoWayContact: true } });

    await enter('owned_notice_clock_and_positive_scope');
    await owned(owner, tenant.id, async tx => {
      await ownLead(tx);
      await tx`WITH stamp AS(SELECT clock_timestamp() AS at) UPDATE gcms_s04.lead l SET created_at=s.at-interval '179 days',consent_at=s.at-interval '179 days',last_activity_at=s.at-interval '179 days',extension_expires_at=NULL FROM stamp s WHERE l.tenant_id=${tenant.id} AND l.id=${journey.leadId}`;
      await tx`INSERT INTO gcms_s06.lead_scope(tenant_id,lead_id) VALUES(${tenant.id},${journey.leadId})`;
    });
    lead = await getLead(); requireThat(Date.parse(lead.expiresAt) > Date.now() && Date.parse(lead.expiresAt) <= Date.now() + 86400000, 'CONTROLLED_NOTICE_DEADLINE_INVALID');
    const revision = lead.retentionRevision;
    await passed({ counts: { retentionRevision: revision }, flags: { onlyOwnedLeadClockChanged: true, positiveLeadScopeRecorded: true } });

    await enter('actual_s06_notice_cli_and_private_capture');
    const noticeWorker = await workerOnce(journey, configuration);
    const recipients = await owned(owner, tenant.id, tx => tx`SELECT m.user_id,u.email FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
      WHERE m.tenant_id=${tenant.id} AND m.status='active' AND u.active AND u.email_verified ORDER BY m.user_id`);
    const deliveries = await owned(owner, tenant.id, tx => tx`SELECT id,recipient_id,status FROM gcms_s06.job WHERE tenant_id=${tenant.id} AND lead_id=${journey.leadId} AND revision=${revision} AND kind='notice' ORDER BY recipient_id`);
    requireThat(recipients.length >= 4 && deliveries.length === recipients.length && noticeWorker.result.captured >= recipients.length, 'NOTICE_RECIPIENT_COVERAGE_INCOMPLETE');
    const captureDirectory = await lstat(CAPTURE);
    requireThat(captureDirectory.isDirectory() && !captureDirectory.isSymbolicLink() && (captureDirectory.mode & 0o777) === 0o700 && captureDirectory.uid === process.getuid?.() && await realpath(CAPTURE) === resolve(CAPTURE), 'UNSAFE_CAPTURE_DIRECTORY');
    for (const delivery of deliveries) {
      const recipient = recipients.find((item: { user_id: string; email: string }) => item.user_id === delivery.recipient_id);
      requireThat(delivery.status === 'captured' && uuid(delivery.id) && recipient, 'OWN_LEAD_NOTICE_NOT_CAPTURED');
      const captured = await privateJson<Record<string, unknown>>(`${CAPTURE}/${delivery.id}.json`);
      requireThat(shape(captured, ['deliveryId', 'recipientEmail', 'transport', 'signInUrl', 'subject', 'text']) && captured.deliveryId === delivery.id && captured.recipientEmail === recipient.email &&
        captured.transport === 'local_capture' && captured.signInUrl === SIGN_IN && captured.subject === SUBJECT && captured.text === NOTICE_TEXT, 'CAPTURE_NOT_GENERIC_OR_CURRENT');
    }
    lead = await getLead(); requireThat(lead.retentionNotice.status === 'captured' && lead.retentionNotice.captured === recipients.length, 'NOTICE_STATE_NOT_CAPTURED');
    await passed({ counts: { eligibleAdministrators: recipients.length, ownedLeadCaptures: deliveries.length }, flags: { captureDirectory0700: true, captureFiles0600: true, genericContentOnly: true, actualCliEntry: true } });

    await enter('explicit_api_retention_extension');
    const extensionExpiry = new Date(Date.now() + 30 * 86400000).toISOString();
    const extension = await privateCall<LeadCommandResult>(S06_ROUTES.extension(tenant.id, journey.leadId!), 'POST', {
      operationId: journey.operationIds.extension, expectedVersion: lead.version, reason: 'Synthetic local follow-up period selected explicitly.', expiresAt: extensionExpiry,
    });
    requireThat(extension.status === 200 && !extension.value.replayed && extension.value.lead.version === lead.version + 1 && extension.value.lead.expiresAt === extensionExpiry &&
      extension.value.lead.extensionExpiresAt === extensionExpiry && extension.value.lead.normalExpiresAt === lead.normalExpiresAt, 'EXPLICIT_EXTENSION_NOT_APPLIED');
    lead = extension.value.lead; await passed({ httpStatuses: [extension.status], counts: { resultingVersion: lead.version }, flags: { explicitExpiryPreserved: true, normalDeadlinePreserved: true } });

    await enter('owned_expiry_clock_and_access_denial');
    await owned(owner, tenant.id, async tx => {
      await ownLead(tx);
      await tx`WITH stamp AS(SELECT clock_timestamp() AS at) UPDATE gcms_s04.lead l SET extension_expires_at=NULL,created_at=s.at-interval '181 days',consent_at=s.at-interval '181 days',last_activity_at=s.at-interval '181 days' FROM stamp s WHERE l.tenant_id=${tenant.id} AND l.id=${journey.leadId}`;
    });
    const deniedRead = await privateCall(leadPath), deniedHistory = await privateCall(S05_ROUTES.history(tenant.id, journey.leadId!));
    requireThat(deniedRead.status === 404 && deniedHistory.status === 404, 'EXPIRED_ACCESS_NOT_DENIED');
    await passed({ httpStatuses: [deniedRead.status, deniedHistory.status], flags: { onlyOwnedLeadClockChanged: true, detailDenied: true, historyDenied: true } });

    await enter('actual_s06_delete_cli_and_physical_graph');
    const deletionWorker = await workerOnce(journey, configuration); requireThat(deletionWorker.result.deleted >= 1, 'DELETE_CLI_DID_NOT_DELETE');
    const graph = [
      ['gcms_s04.lead', 'id'], ['gcms_s04.accepted_request', 'lead_id'], ['gcms_s04.intake_activity', 'lead_id'], ['gcms_s04.notification_intent', 'lead_id'],
      ['gcms_s05.lead_event', 'lead_id'], ['gcms_s05.operation_receipt', 'lead_id'], ['gcms_s05.delivery', 'lead_id'], ['gcms_s06.extension_receipt', 'lead_id'],
      ['gcms_s06.notice', 'lead_id'], ['gcms_s06.job', 'lead_id'],
    ] as const;
    await owned(owner, tenant.id, async tx => {
      for (const [table, column] of graph) {
        const count = await tx.unsafe(`SELECT count(*)::integer AS count FROM ${table} WHERE tenant_id=$1 AND ${column}=$2`, [tenant.id, journey.leadId]);
        requireThat(count[0].count === 0, 'PHYSICAL_LEAD_GRAPH_REMAINS');
      }
      const decisions = await tx`SELECT to_jsonb(d) AS decision FROM gcms_s06.deletion_decision d WHERE tenant_id=${tenant.id} AND lead_id=${journey.leadId}`;
      requireThat(decisions.length === 1 && shape(decisions[0].decision, ['tenant_id', 'lead_id', 'retention_revision', 'expired_at', 'deleted_at']), 'MINIMAL_DELETION_IDENTITY_MISSING');
      const audit = await tx`SELECT to_jsonb(a) AS event FROM gcms_s06.audit_event a WHERE tenant_id=${tenant.id} AND target_id=${journey.leadId} AND event='lead.deleted'`;
      requireThat(audit.length === 1 && shape(audit[0].event, ['id', 'tenant_id', 'actor_kind', 'event', 'target_id', 'created_at']), 'REDACTED_DELETION_AUDIT_INVALID');
      const scopes = await tx`SELECT lead_id FROM gcms_s06.lead_scope WHERE tenant_id=${tenant.id}`;
      requireThat(scopes.length === allowedPriorLeads.length+1 && scopes.every((row: { lead_id: string }) => row.lead_id === journey.leadId || allowedPriorLeads.includes(row.lead_id)), 'WORKER_SCOPE_CHANGED');
    });
    await passed({ counts: { zeroRowGraphTables: graph.length, deletionDecisions: 1, redactedDeletionEvents: 1 }, flags: { physicalDeletionVerified: true, minimalIdentityRetained: true, noAutomaticCleanup: true } });
    await enter('complete'); journey.status = 'PASS'; await save(journey);
    console.info(JSON.stringify({ status: 'PASS', stage: journey.stage, manifest: JOURNEY_MANIFEST, checks: journey.checks.length, workerInvocations: journey.workerRuns.length,
      capturedOwnLeadNotices: recipients.length, zeroRowGraphTables: graph.length, cleanupPerformed: false, credentialsPrinted: false }));
    return journey;
  } finally { await database.close(); await owner.close(); }
}

if (import.meta.main) void runM2LeadJourney().catch(async error => {
  const code = error instanceof JourneyFailure ? error.code : 'UNEXPECTED_FAILURE';
  if (createdManifest && manifest) {
    manifest.status = 'FAIL'; manifest.stage = stage; manifest.failureCode = code;
    try { await save(manifest); } catch { /* Preserve the original manifest if an atomic failure update is unavailable. */ }
  }
  console.error(JSON.stringify({ status: 'FAIL', stage, code, manifest: createdManifest ? JOURNEY_MANIFEST : null, detailsRedacted: true, cleanupPerformed: false }));
  process.exitCode = 1;
});
