import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';

const origin = 'http://127.0.0.1:5890';
const evidenceSlice = process.argv.includes('--s05') ? 's05' : 's04';
const runtimeEnvironment = await loadRuntimeEnvironment();
const results: Record<string, unknown> = {};
let phase = 'startup';
const children = new Set<ReturnType<typeof Bun.spawn>>();

async function request(path: string, init: RequestInit = {}) {
  return fetch(origin + path, { ...init, signal: AbortSignal.timeout(6000), redirect: 'error' });
}
async function start(extra: Record<string, string> = {}) {
  // Run the emitted Nest program; Bun's TS transpiler does not emit decorator metadata.
  const child = Bun.spawn([process.execPath, '--no-env-file', 'apps/api/dist/main.js'], {
    env: { ...runtimeEnvironment.api, ...extra }, stdout: 'pipe', stderr: 'pipe',
  });
  children.add(child);
  const output = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) { await output; throw new Error('API exited before readiness'); }
    try {
      const response = await fetch(origin + '/health', { signal: AbortSignal.timeout(250) });
      if (response.ok) { await response.body?.cancel(); return { child, output }; }
      await response.body?.cancel();
    } catch {}
    await Bun.sleep(100);
  }
  throw new Error('API startup deadline exceeded');
}
async function stop(running: Awaited<ReturnType<typeof start>>, signal: 'SIGTERM' | 'SIGINT') {
  running.child.kill(signal);
  const timer = setTimeout(() => running.child.kill('SIGKILL'), 6000);
  let exitCode: number;
  try { exitCode = await running.child.exited; } finally { clearTimeout(timer); }
  children.delete(running.child);
  const output = (await running.output).join('');
  assert.ok([0, signal === 'SIGTERM' ? 143 : 130].includes(exitCode));
  assert.ok(!output.includes('Error:') && !output.includes('postgres://'));
  let closed = false;
  try { const response = await request('/health'); await response.body?.cancel(); } catch { closed = true; }
  assert.ok(closed, 'Owned API listener should close');
  results[`shutdown${signal}`] = { status: 'PASS', exitCode, listenerClosed: true };
}

try {
  let occupied = false;
  try { const response = await request('/health'); occupied = true; await response.body?.cancel(); } catch {}
  assert.ok(!occupied, 'API port is already occupied; preserve the existing process');
  const running = await start();
  phase = 'health';
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('set-cookie'), null);
  const health = await response.json();
  assert.deepEqual(health, { status: 'ok', scope: 'process', runtime: 'bun', version: Bun.version });
  results.health = { status: 'PASS', body: health, implicitCors: false, sessionCookie: false };

  phase = 'readiness';
  const ready = await request('/ready'); assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: 'ready', services: { postgres: 'available', redis: 'available', s3: 'available' } });
  results.readiness = { status: 'PASS', httpStatus: 200 };

  phase = 'validation';
  const echo = await request('/diagnostics/echo?value=technical');
  assert.equal(echo.status, 200); assert.deepEqual(await echo.json(), { value: 'technical' });
  const invalid = ['/diagnostics/echo', '/diagnostics/echo?value=', '/diagnostics/echo?value=' + 'x'.repeat(65),
    '/diagnostics/echo?value=ok&secret=private', '/diagnostics/echo?value=a&value=b'];
  for (const path of invalid) {
    const response = await request(path); assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { statusCode: 400, error: 'Bad Request' });
  }
  results.validation = { status: 'PASS', valid: 1, invalid: invalid.length, errorsRedacted: true };
  phase = 'notFound';
  for (const path of ['/unknown?secret=private', '/unknown/route']) {
    const response = await request(path); assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { statusCode: 404, error: 'Not Found' });
  }
  const post = await request('/health', { method: 'POST' }); assert.equal(post.status, 404); await post.body?.cancel();
  results.notFound = { status: 'PASS', cases: 3, scope: 'diagnostic routes only; auth is checked separately by S02' };
  phase = 'shutdown'; await stop(running, 'SIGTERM');

  // Obtain a previously unused loopback port, then close our listener for denial checks.
  const reservation = createServer();
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const address = reservation.address(); assert.ok(address && typeof address !== 'string');
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  const cases: Array<{ service: string; env: Record<string, string> }> = [
    { service: 'postgres', env: { DATABASE_URL: `postgres://technical:technical@127.0.0.1:${address.port}/technical` } },
    { service: 'redis', env: { REDIS_URL: `redis://127.0.0.1:${address.port}` } },
    { service: 's3', env: { S3_ENDPOINT: `http://127.0.0.1:${address.port}` } },
  ];
  for (const item of cases) {
    phase = `unavailable-${item.service}`;
    const running = await start(item.env);
    const started = performance.now();
    const response = await request('/ready'); assert.equal(response.status, 503);
    const body = await response.json();
    const expected = { postgres: 'available', redis: 'available', s3: 'available', [item.service]: 'unavailable' };
    assert.deepEqual(body, { status: 'unavailable', services: expected });
    assert.ok(performance.now() - started < 5000);
    results[phase] = { status: 'PASS', httpStatus: 503, services: body.services };
    const health = await request('/health'); assert.equal(health.status, 200); await health.body?.cancel();
    await stop(running, 'SIGINT');
  }
} catch {
  results[phase] = { status: 'FAIL', error: 'API check failed; exception details intentionally redacted.' };
  process.exitCode = 1;
} finally {
  for (const child of children) {
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 6000);
    try { await child.exited; } finally { clearTimeout(timer); }
  }
  const file = Bun.file(`docs/evidence/${evidenceSlice}/diagnostics.json`);
  const evidence = await file.exists() ? await file.json() : { scope: `${evidenceSlice.toUpperCase()} regression of S01 diagnostic API contracts` };
  evidence.apiRecordedAt = new Date().toISOString(); evidence.apiChecks = results;
  await Bun.write(file, JSON.stringify(evidence, null, 2) + '\n');
  console.info(JSON.stringify(results, null, 2));
}
