// Keep real suites in separate processes and preserve each enabled protection budget.
const files = ['s04-input.test.ts', 's04-security.test.ts', 's04-intake-integration.test.ts'];
const results: Array<{ file: string; exitCode: number; passed: number; failed: number; skipped: number; assertions: number }> = [];
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
    if (interrupted) throw new Error('Local S04 verification interrupted.');
    const child = Bun.spawn([process.execPath, '--env-file=.env', '--env-file=.local/s02.env', '--env-file=.local/s04.env',
      'test', `apps/api/test/${file}`, '--timeout', '120000'], {
      env: { ...process.env, S04_INTEGRATION: '1' }, stdout: 'pipe', stderr: 'pipe',
    });
    active = child;
    const [stdout, stderr, exitCode] = await Promise.all([streamOutput(child.stdout), streamOutput(child.stderr), child.exited]);
    active = undefined;
    const output = stdout + stderr;
    const count = (pattern: RegExp) => Number(output.match(pattern)?.[1] ?? 0);
    const result = { file, exitCode, passed: count(/(\d+) pass\b/), failed: count(/(\d+) fail\b/),
      skipped: count(/(\d+) skip\b/), assertions: count(/(\d+) expect\(\) calls/) };
    results.push(result);
    if (exitCode !== 0 || !result.passed || result.failed || result.skipped) { process.exitCode = 1; break; }
  }
} finally {
  if (active?.exitCode === null) active.kill('SIGTERM');
  await Bun.write('docs/evidence/s04/combined-api-checks.json', JSON.stringify({
    recordedAtUtc: new Date().toISOString(), status: results.length === files.length &&
      results.every(item => item.exitCode === 0 && item.passed > 0 && !item.failed && !item.skipped) ? 'PASS' : 'FAIL',
    suites: results, intendedSuites: files.length,
    limits: 'Owned synthetic unit and actual local HTTP/PostgreSQL checks, including the suite-owned restart scenario; rendered browser and CAPTCHA human interaction remain separate proof. Human acceptance is pending.',
  }, null, 2) + '\n');
}
export {};
