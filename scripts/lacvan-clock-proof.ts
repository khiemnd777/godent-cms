import { createHash, randomUUID } from 'node:crypto';
import { writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { M4_ROUTES, type M4CommandResult, type M4Variant, type PromotionContent } from '../apps/api/src/contracts/m4';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { legacyDocument } from '../apps/api/src/contracts/content';
import { privateLacVanText, readLacVanFixtures } from './lacvan-fixtures';
import { LacVanHttp } from './lacvan-http';

function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => JSON.stringify(k) + ':' + canonical(value)).join(',') + '}';
  return JSON.stringify(v);
}
async function main() {
  const [flag, recovery] = process.argv.slice(2);
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || flag !== '--local-lacvan' || ![3, 4].includes(process.argv.length) || (recovery !== undefined && !/^--cleanup=[a-f0-9-]{36}$/.test(recovery))) throw new Error('Explicit local clock regression required');
  const f = await readLacVanFixtures(), dbUrl = validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration');
  const http = new LacVanHttp(f.tenant.id, f.tenant.slug, f.identities.find(i => i.label === 'Owner')!); await http.login(); await http.reauth();
  if (recovery) {
    const run = recovery.slice(10), path = `.local/lacvan-clock-${run}.json`, journal = JSON.parse(await privateLacVanText(path));
    if (journal.owner !== 'GCMS-LACVAN-CLOCK-v1' || journal.fixtureRun !== f.runId || journal.tenantId !== f.tenant.id || journal.run !== run || journal.createId !== journal.id || !/^[a-f0-9-]{36}$/.test(journal.id) || !/^[a-f0-9-]{36}$/.test(journal.unpublishId)) throw new Error('Clock recovery ownership mismatch');
    const resource = M4_ROUTES.resource(f.tenant.id, 'promotion', journal.id, 'vi'), current = await http.get<M4Variant>(resource);
    if (current.tenantId !== f.tenant.id || current.id !== journal.id || canonical(current.content) !== canonical(journal.content)) throw new Error('Clock recovery content changed');
    if (current.activePublication) await http.command(resource + '/unpublish', 'POST', { operationId: journal.unpublishId, expectedVersion: current.version, expectedPublicationRevision: current.publicationRevision });
    journal.cleanedUp = true; const temp = `.local/lacvan-clock-${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(journal, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temp, path);
    const output = await privateLacVanText(`.local/lacvan-clock-log-${run}.txt`), passed = Number(output.match(/(\d+) pass/)?.[1] ?? 0), assertions = Number(output.match(/(\d+) expect\(\) calls/)?.[1] ?? 0);
    const report = { status: journal.testExit === 0 && passed === 2 && assertions >= 6 ? 'PASS' : 'FAIL', phase: 'actual-post-lock-start-and-end', recordedAt: new Date().toISOString(), passed, assertions, childExit: journal.testExit, newlyOwnedPromotionUnpublished: true, cleanupRecovery: 'Semantic JSON equality preserves the exact owned content despite PostgreSQL JSONB key order.', existingDataMutated: false, rawLogSha256: createHash('sha256').update(output).digest('hex') };
    await writeFile(`docs/evidence/lacvan/clock-${Date.now()}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.info(JSON.stringify(report)); if (report.status !== 'PASS') process.exitCode = 1; return;
  }
  const config = await http.get<M4Variant>(M4_ROUTES.config(f.tenant.id, 'vi')); if (!config.activePublication || !config.publicationId) throw new Error('Published new clinic configuration required');
  const id = randomUUID(), run = randomUUID(), now = Date.now(), path = `.local/lacvan-clock-${run}.json`, resource = M4_ROUTES.resource(f.tenant.id, 'promotion', id, 'vi');
  const content: PromotionContent = { kind: 'promotion', slug: 'cuoc-hen-' + id.slice(0, 8), title: 'Một khoảng thời gian cho nụ cười', summary: 'Dành thời gian trao đổi về điều bạn quan tâm.', body: legacyDocument('Lắng nghe và cùng trao đổi những lựa chọn phù hợp.'), seo: { title: '', description: '' }, startAt: new Date(now + 6000).toISOString(), endAt: new Date(now + 14000).toISOString(), authoredTimezone: 'Asia/Ho_Chi_Minh', conditions: 'Yêu cầu tư vấn cần được phòng khám xác nhận riêng.', references: [] };
  const journal = { owner: 'GCMS-LACVAN-CLOCK-v1', fixtureRun: f.runId, tenantId: f.tenant.id, run, id, content, createId: id, publishId: randomUUID(), unpublishId: randomUUID(), stage: 'planned', testExit: null as number | null, cleanedUp: false };
  await writeFile(path, JSON.stringify(journal, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  async function store() { const old = JSON.parse(await privateLacVanText(path)); if (old.owner !== journal.owner || old.run !== run || old.tenantId !== f.tenant.id) throw new Error('Clock fixture ownership changed'); const temp = `.local/lacvan-clock-${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(journal, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temp, path); }
  let created = false, output = '';
  try {
    const draft = (await http.command<M4CommandResult>(M4_ROUTES.resources(f.tenant.id, 'promotion') + '?locale=vi', 'POST', { operationId: journal.createId, content })).draft;
    if (draft.id !== id || draft.tenantId !== f.tenant.id) throw new Error('Clock fixture identity mismatch'); created = true; journal.stage = 'created'; await store();
    await http.command<M4CommandResult>(resource + '/publish', 'POST', { operationId: journal.publishId, expectedVersion: draft.version, expectedPublicationVersion: draft.publicationVersion, expectedPublicationRevision: draft.publicationRevision, expectedConfigPublicationId: config.publicationId }); journal.stage = 'published'; await store();
    const env: Record<string, string> = { S02_MIGRATION_DATABASE_URL: dbUrl, LACVAN_CLOCK_INTEGRATION: '1', LACVAN_TEST_TENANT_ID: f.tenant.id, LACVAN_TEST_PROMOTION_ID: id }; if (process.env.PATH) env.PATH = process.env.PATH;
    const child = Bun.spawn([process.execPath, '--no-env-file', 'test', 'apps/api/test/lacvan-clock-integration.test.ts'], { env, stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]); output = stdout + stderr; journal.testExit = exit; journal.stage = exit === 0 ? 'clock-verified' : 'clock-failed'; await store();
    await writeFile(`.local/lacvan-clock-log-${run}.txt`, output, { flag: 'wx', mode: 0o600 });
  } finally {
    if (created) {
      const current = await http.get<M4Variant>(resource);
      if (current.tenantId !== f.tenant.id || current.id !== id || canonical(current.content) !== canonical(content)) throw new Error('Clock cleanup ownership mismatch');
      if (current.activePublication) await http.command(resource + '/unpublish', 'POST', { operationId: journal.unpublishId, expectedVersion: current.version, expectedPublicationRevision: current.publicationRevision });
      journal.cleanedUp = true; await store();
    }
  }
  const passed = Number(output.match(/(\d+) pass/)?.[1] ?? 0), assertions = Number(output.match(/(\d+) expect\(\) calls/)?.[1] ?? 0);
  const report = { status: journal.testExit === 0 && passed === 2 && assertions >= 6 && journal.cleanedUp ? 'PASS' : 'FAIL', phase: 'actual-post-lock-start-and-end', recordedAt: new Date().toISOString(), passed, assertions, childExit: journal.testExit, newlyOwnedPromotionUnpublished: journal.cleanedUp, existingDataMutated: false, rawLogSha256: createHash('sha256').update(output).digest('hex') };
  await writeFile(`docs/evidence/lacvan/clock-${Date.now()}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.info(JSON.stringify(report)); if (report.status !== 'PASS') process.exitCode = 1;
}
if (import.meta.main) void main().catch(async error => { await writeFile(`.local/lacvan-clock-error-${Date.now()}.json`, JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }) + '\n', { flag: 'wx', mode: 0o600 }); console.error('Clock proof failed/refused; private diagnostic retained.'); process.exitCode = 1; });
