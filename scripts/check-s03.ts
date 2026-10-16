// Run each actual suite in its own process; keep library rate controls enabled.
const files = ['s03-content.test.ts', 's03-publication-integration.test.ts'];
const results: Array<{ file: string; exitCode: number; passed: number; failed: number; skipped: number; assertions: number }> = [];
let active: ReturnType<typeof Bun.spawn> | undefined;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  interrupted = true;
  active?.kill(signal);
});
try {
  for (const file of files) {
    if (interrupted) throw new Error('Local S03 verification interrupted.');
    const child = Bun.spawn([process.execPath, '--env-file=.env', '--env-file=.local/s02.env', 'test', `apps/api/test/${file}`, '--timeout', '120000'], {
      env: { ...process.env, S03_INTEGRATION: '1' }, stdout: 'pipe', stderr: 'pipe',
    });
    active = child;
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    active = undefined;
    const output = stdout + stderr;
    process.stdout.write(output);
    const count = (pattern: RegExp) => Number(output.match(pattern)?.[1] ?? 0);
    const result = { file, exitCode, passed: count(/(\d+) pass\b/), failed: count(/(\d+) fail\b/), skipped: count(/(\d+) skip\b/), assertions: count(/(\d+) expect\(\) calls/) };
    results.push(result);
    if (exitCode !== 0 || !result.passed || result.failed || result.skipped) { process.exitCode = 1; break; }
  }
} finally {
  if (active?.exitCode === null) active.kill('SIGTERM');
  await Bun.write('docs/evidence/s03/combined-api-checks.json', JSON.stringify({
    recordedAtUtc: new Date().toISOString(), status: results.length === files.length && results.every(item => item.exitCode === 0 && item.passed > 0 && !item.failed && !item.skipped) ? 'PASS' : 'FAIL',
    suites: results, intendedSuites: files.length,
    limits: 'Authorized local synthetic HTTP/PostgreSQL/handler and unit checks; browser, OS process restart and human acceptance are separate evidence.',
  }, null, 2) + '\n');
}
export {};
