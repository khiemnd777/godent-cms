import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

interface TableProof { schema: string; table: string; primaryKeyColumns: string[]; credentialInvariant: boolean;
  projections: Array<{ keyHash: string; rowHash: string }> }
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function identifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Invalid identifier');
  return `"${value}"`;
}
async function optional(path: string): Promise<Record<string, unknown>> {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as { code?: string }).code === 'ENOENT') return {}; throw error; }
}
/** Read-only row-hash comparison. Never exports row values or credentials. */
async function main() {
  if (!process.argv.includes('--local-auth-001') || process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Explicit AUTH scope required');
  const baseline = JSON.parse(await readFile('.local/auth-001-db-baseline.json', 'utf8')) as { tables: TableProof[] };
  const fixtures = await optional('.local/auth-001-data-fixtures.json');
  const ui = await optional('.local/auth-001-ui-resources.json');
  const m1 = JSON.parse(await readFile('.local/m1-uat-resources.json', 'utf8')) as { tenantA: { tenantId: string; invitationId: string } };
  const tenantIds = new Set<string>([m1.tenantA.tenantId]);
  const accountIds = new Set<string>();
  // The coordinator-owned manifest uses canonical tenantIds/identities. The UI
  // record is also read to permit the named M1 invitation during onboarding.
  const tenantMap = fixtures.tenantIds as Record<string, string> | undefined;
  for (const value of Object.values(tenantMap ?? {})) tenantIds.add(value);
  const identities = fixtures.identities as Array<{ label: string; userId: string }> | undefined;
  for (const value of identities ?? []) if (value.userId) accountIds.add(value.userId);
  const retained = JSON.parse(await readFile('.local/s02-fixtures.json', 'utf8')) as { identities: Array<{ label: string; userId: string }> };
  const platformId = retained.identities.find(item => item.label === 'PlatformOnly')?.userId;
  const disableTargets = ['browserPeer', 'apiDisable'].map(label => ({ label, userId: identities?.find(item => item.label === label)?.userId }));
  if (!platformId || disableTargets.some(item => !item.userId) || new Set(disableTargets.map(item => item.userId)).size !== 2 ||
    !baseline.tables.find(item => item.schema === 'gcms_s02_auth' && item.table === 'user')?.projections.some(item => item.keyHash === hash(JSON.stringify([platformId])))) {
    throw new Error('Exact retained actor and owned disable targets required');
  }
  const uiTenants = ui.tenantIds as Record<string, string> | undefined;
  for (const value of Object.values(uiTenants ?? {})) tenantIds.add(value);
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '5888' || url.pathname !== '/gcms_s01' ||
    decodeURIComponent(url.username) !== 'gcms_local' || !url.password || url.hash || url.search) throw new Error('Unexpected database identity');
  const client = new SQL(url.toString(), { max: 1, connectionTimeout: 3, connection: { default_transaction_read_only: 'on' } });
  try {
    const ownedPath = '.local/auth-001-data-owned-baseline.json';
    const definitions = [
      { table: 'gcms_s02.invitation', key: 'id', value: m1.tenantA.invitationId, columns: ['accepted_at', 'revoked_at'] },
      { table: 'gcms_s05.recipient_settings', key: 'tenant_id', value: m1.tenantA.tenantId,
        columns: ['initial_user_id', 'initial_assigned_at', 'version', 'mode', 'recipient_user_ids'] },
      { table: 'gcms_s05.lead_sequence', key: 'tenant_id', value: m1.tenantA.tenantId, columns: ['last_number'] },
    ];
    type OwnedProof = { table: string; keyHash: string; fieldHashes: Record<string, string>; leadNumber?: number };
    if (process.argv.includes('--capture-owned-baseline')) {
      const snapshots: OwnedProof[] = [];
      for (const definition of definitions) {
        const [schema, name] = definition.table.split('.');
        const rows = await client.unsafe(`SELECT to_jsonb(t)::text AS projection FROM ${identifier(schema)}.${identifier(name)} t WHERE ${identifier(definition.key)}=$1`, [definition.value]);
        for (const item of rows) {
          const row = JSON.parse(item.projection), table = baseline.tables.find(t => `${t.schema}.${t.table}` === definition.table)!;
          const keyHash = hash(JSON.stringify(table.primaryKeyColumns.map(column => row[column])));
          if (table.projections.find(old => old.keyHash === keyHash)?.rowHash !== hash(item.projection)) throw new Error('Owned row already changed before capture');
          snapshots.push({ table: definition.table, keyHash, fieldHashes: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, hash(JSON.stringify(value))])),
            ...(definition.table === 'gcms_s05.lead_sequence' ? { leadNumber: Number(row.last_number) } : {}) });
        }
      }
      await writeFile(ownedPath, JSON.stringify({ snapshots }) + '\n', { flag: 'wx', mode: 0o600 });
      console.info(JSON.stringify({ status: 'PASS', phase: 'owned_baseline', snapshots: snapshots.length, rawRowsOrSecretsPrinted: false }));
      return;
    }
    const owned = await optional(ownedPath) as { snapshots?: OwnedProof[] };
    const checks = [];
    for (const table of baseline.tables) {
      const name = `${table.schema}.${table.table}`;
      const rows = await client.unsafe(`SELECT to_jsonb(t)::text AS projection FROM ${identifier(table.schema)}.${identifier(table.table)} t`);
      const current = new Map<string, { rowHash: string; row: Record<string, unknown> }>();
      for (const item of rows) {
        const row = JSON.parse(item.projection);
        const key = table.primaryKeyColumns.length ? table.primaryKeyColumns.map(column => row[column]) : row;
        current.set(hash(JSON.stringify(key)), { rowHash: hash(item.projection), row });
      }
      const baselineKeys = new Set(table.projections.map(item => item.keyHash));
      let unchanged = 0, cutoverRemoved = 0, ownedChanged = 0, unexpected = 0, addedOwned = 0;
      const ownedChanges: Array<{ keyHash: string; changedColumns: string[] }> = [];
      const matchesDisableAudit = (row: Record<string, unknown>, target: typeof disableTargets[number]) =>
        row.tenant_id === null && row.event === 'identity.disabled' && row.actor_id === platformId && row.target_id === target.userId;
      const globalDisableAudits = name === 'gcms_s02.audit_event' ? disableTargets.map(target => ({ label: target.label,
        count: [...current].filter(([key, item]) => !baselineKeys.has(key) && matchesDisableAudit(item.row, target)).length })) : [];
      for (const audit of globalDisableAudits) if (audit.count !== 1) unexpected++;
      for (const old of table.projections) {
        const now = current.get(old.keyHash);
        if (now?.rowHash === old.rowHash) { unchanged++; continue; }
        if (['gcms_s02_auth.session', 'gcms_s02_auth.reauth_grant'].includes(name) && !now) { cutoverRemoved++; continue; }
        const snapshot = owned.snapshots?.find(item => item.table === name && item.keyHash === old.keyHash);
        const definition = definitions.find(item => item.table === name);
        if (snapshot && definition && now) {
          const changed = Object.keys(now.row).filter(key => snapshot.fieldHashes[key] !== hash(JSON.stringify(now.row[key])));
          const allowed = changed.every(column => definition.columns.includes(column));
          let exactCounter = true;
          if (name === 'gcms_s05.lead_sequence') {
            const leads = await client`SELECT id FROM gcms_s04.lead WHERE tenant_id=${m1.tenantA.tenantId}`;
            const oldLeads = baseline.tables.find(item => item.schema === 'gcms_s04' && item.table === 'lead')!;
            const keys = new Set(oldLeads.projections.map(item => item.keyHash));
            const newCount = leads.filter((lead: { id: string }) => !keys.has(hash(JSON.stringify([m1.tenantA.tenantId, lead.id])))).length;
            exactCounter = Number(now.row.last_number) - (snapshot.leadNumber ?? 0) === newCount;
          }
          if (allowed && exactCounter) { ownedChanged++; ownedChanges.push({ keyHash: old.keyHash, changedColumns: changed }); continue; }
        }
        unexpected++;
      }
      for (const [key, item] of current) {
        if (baselineKeys.has(key)) continue;
        const row = item.row;
        const allowed = ['gcms_s02_auth.session', 'gcms_s02_auth.reauth_grant', 'gcms_s02_auth.verification'].includes(name) ||
          (name === 'gcms_s02.schema_migration' && ['0013_auth_password_only.sql', '0014_s05_user_identifier.sql'].includes(String(row.name))) ||
          (name === 'gcms_s02_auth.user' && accountIds.has(String(row.id))) ||
          (name === 'gcms_s02_auth.account' && accountIds.has(String(row.user_id))) ||
          (name === 'gcms_s02.audit_event' && disableTargets.some(target => matchesDisableAudit(row, target) &&
            globalDisableAudits.find(audit => audit.label === target.label)?.count === 1)) ||
          (name === 'gcms_s02.tenant' && tenantIds.has(String(row.id))) || tenantIds.has(String(row.tenant_id));
        if (allowed) addedOwned++; else unexpected++;
      }
      checks.push({ table: name, status: unexpected === 0 ? 'PASS' : 'FAIL', baselineRows: table.projections.length, currentRows: current.size,
        unchanged, cutoverRemoved, ownedChanged, ownedChanges, addedOwned, unexpected, credentialInvariant: table.credentialInvariant,
        ...(globalDisableAudits.length ? { globalDisableAudits } : {}) });
    }
    const report = { recordedAtUtc: new Date().toISOString(), status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL', checks,
      limits: 'Per-row hashes prove retained rows unchanged outside exact column-limited M1 invitation/recipient-settings/lead-sequence fixture rows and revoked sessions/grants; additions use bounded AUTH tenant/account IDs. Exactly one new tenant-null identity.disabled audit per browserPeer/apiDisable target must use retained PlatformOnly actor. New auth transient state is additive. No backup/restore proof.', rawRowsOrSecretsPrinted: false };
    await mkdir('docs/evidence/auth-001/data', { recursive: true });
    await writeFile('docs/evidence/auth-001/data/preservation.json', JSON.stringify(report, null, 2) + '\n');
    console.info(JSON.stringify({ status: report.status, tables: checks.length, failedTables: checks.filter(item => item.status !== 'PASS').map(item => item.table), rawRowsOrSecretsPrinted: false }));
    if (report.status !== 'PASS') process.exitCode = 1;
  } finally { await client.close(); }
}
main().catch(() => { console.error('AUTH preservation check failed; details redacted.'); process.exitCode = 1; });
