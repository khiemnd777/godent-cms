import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

if (!process.argv.includes('--local-auth-001') || process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Explicit AUTH local scope required');
// These suites reuse exactly the pre-created AUTH actors and two named tenants.
// Historical broad suite wrappers create extra fixtures and overwrite old evidence.
const files = ['auth-001-boundaries.test.ts', 'auth-data-lifecycle.test.ts', 'auth-data-recovery.test.ts'];
const results: Array<{ file: string; exitCode: number }> = [];
let active: ReturnType<typeof Bun.spawn> | undefined;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { interrupted = true; active?.kill(signal); });
try {
  for (const file of files) {
    if (interrupted) throw new Error('AUTH checks interrupted');
    active = Bun.spawn([process.execPath, '--env-file=.env', '--env-file=.local/s02.env', '--env-file=.local/s04.env',
      'test', `apps/api/test/${file}`, '--timeout', '120000'], {
      env: { ...process.env, AUTH_001_INTEGRATION: '1', S02_INTEGRATION: '0', S03_INTEGRATION: '0', S04_INTEGRATION: '0', S05_INTEGRATION: '0' },
      stdout: 'inherit', stderr: 'inherit',
    });
    const exitCode = await active.exited; active = undefined;
    results.push({ file, exitCode });
    if (exitCode !== 0) { process.exitCode = 1; break; }
  }
} finally {
  if (active?.exitCode === null) active.kill('SIGTERM');
  await mkdir('docs/evidence/auth-001/api', { recursive: true });
  await writeFile('docs/evidence/auth-001/api/bounded-checks.json', JSON.stringify({ recordedAtUtc: new Date().toISOString(),
    status: results.length === files.length && results.every(item => item.exitCode === 0) ? 'PASS' : 'FAIL', suites: results, intendedSuites: files.length,
    limits: 'Actual restricted PostgreSQL/auth/domain/setting checks on AUTH-owned resources. Existing historical broad integration suites and browser/worker checks are separate.',
  }, null, 2) + '\n');
}
