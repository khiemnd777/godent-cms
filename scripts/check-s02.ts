// Independent test processes keep the library's process-global rate budgets
// separate. Each suite still exercises the actual, enabled protection limits.
const files = [
  'auth-data-integration.test.ts',
  'domain-integration.test.ts',
  'auth-data-recovery.test.ts',
  'auth-data-isolation.test.ts',
  'auth-data-registration.test.ts',
  'auth-data-domain-contract.test.ts',
  'auth-data-lifecycle.test.ts',
];
let active: ReturnType<typeof Bun.spawn> | undefined;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  interrupted = true;
  active?.kill(signal);
});
const results: Array<{ file: string; exitCode: number }> = [];
try {
  for (const file of files) {
    if (interrupted) throw new Error('Local S02 verification interrupted.');
    active = Bun.spawn([process.execPath, '--env-file=.env', '--env-file=.local/s02.env', 'test', `apps/api/test/${file}`, '--timeout', '120000'],
      { env: { ...process.env, S02_INTEGRATION: '1' }, stdout: 'inherit', stderr: 'inherit' });
    const exitCode = await active.exited;
    active = undefined;
    results.push({ file, exitCode });
    if (exitCode !== 0) { process.exitCode = 1; break; }
  }
} finally {
  if (active?.exitCode === null) active.kill('SIGTERM');
  await Bun.write('docs/evidence/s02/combined-api-checks.json', JSON.stringify({
    recordedAtUtc: new Date().toISOString(), status: results.length === files.length && results.every(item => item.exitCode === 0) ? 'PASS' : 'FAIL',
    suites: results, intendedSuites: files.length,
    limits: 'Authorized local synthetic database/handler/HTTP checks; not browser actions, email delivery or production acceptance.',
  }, null, 2) + '\n');
}

export {};
