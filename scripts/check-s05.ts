// Keep real suites in separate processes and preserve each enabled protection budget.
const files = ['s05-input.test.ts', 's05-capture.test.ts', 's05-worker-environment.test.ts', 's05-lead-integration.test.ts', 's05-worker-integration.test.ts', 's05-races-integration.test.ts'];
const results: Array<{ file: string; exitCode: number; passed: number; failed: number; skipped: number; assertions: number }> = [];
const queryPlans: Array<Record<string, unknown>> = [];
let active: ReturnType<typeof Bun.spawn> | undefined;
let interrupted = false;
async function streamOutput(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    output += chunk;
    process.stdout.write(chunk);
  }
  const tail = decoder.decode();
  output += tail;
  if (tail) process.stdout.write(tail);
  return output;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  interrupted = true;
  active?.kill(signal);
});
try {
  for (const file of files) {
    if (interrupted) throw new Error('Local S05 verification interrupted.');
    const child = Bun.spawn([process.execPath, '--env-file=.env', '--env-file=.local/s02.env', '--env-file=.local/s04.env', '--env-file=.local/s05.env',
      'test', `apps/api/test/${file}`, '--timeout', '120000'], {
      env: { ...process.env, S05_INTEGRATION: '1' }, stdout: 'pipe', stderr: 'pipe',
    });
    active = child;
    const [stdout, stderr, exitCode] = await Promise.all([streamOutput(child.stdout), streamOutput(child.stderr), child.exited]);
    active = undefined;
    const output = stdout + stderr;
    for (const line of output.split('\n')) {
      if (!line.startsWith('{"kind":"S05_QUERY_PLAN"')) continue;
      const plan = JSON.parse(line) as Record<string, unknown>;
      if (plan.kind === 'S05_QUERY_PLAN') queryPlans.push(plan);
    }
    const count = (pattern: RegExp) => Number(output.match(pattern)?.[1] ?? 0);
    const result = { file, exitCode, passed: count(/(\d+) pass\b/), failed: count(/(\d+) fail\b/),
      skipped: count(/(\d+) skip\b/), assertions: count(/(\d+) expect\(\) calls/) };
    results.push(result);
    if (exitCode !== 0 || !result.passed || result.failed || result.skipped) { process.exitCode = 1; break; }
  }
} finally {
  if (active?.exitCode === null) active.kill('SIGTERM');
  await Bun.write('docs/evidence/s05/combined-api-checks.json', JSON.stringify({
    recordedAtUtc: new Date().toISOString(), status: results.length === files.length &&
      results.every(item => item.exitCode === 0 && item.passed > 0 && !item.failed && !item.skipped) ? 'PASS' : 'FAIL',
    suites: results, intendedSuites: files.length, queryPlans,
    limits: 'New owned synthetic unit, actual local HTTP/PostgreSQL and bounded worker/capture/fault processes; rendered browser proof is separate. Retained S04 intents are outside selected worker scope. Human acceptance and production are not inferred.',
  }, null, 2) + '\n');
}
export {};
