import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';

if (Bun.version !== '1.4.3') throw new Error('Use bun run start:local with the pinned project runtime.');
if (process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Run the local launcher from the repository root.');
const runtimeEnvironment = await loadRuntimeEnvironment();
const entries = [
  { name: 'api', port: 5890, environment: runtimeEnvironment.api, command: [process.execPath, '--no-env-file', 'apps/api/dist/main.js'] },
  { name: 'admin', port: 5891, environment: runtimeEnvironment.web, command: [process.execPath, '--no-env-file', '--cwd', 'apps/admin', '--bun', 'next', 'start', '--hostname', '127.0.0.1', '--port', '5891'] },
  { name: 'website', port: 5892, environment: runtimeEnvironment.web, command: [process.execPath, '--no-env-file', '--cwd', 'apps/website', '--bun', 'next', 'start', '--hostname', '127.0.0.1', '--port', '5892'] },
];

// Fail before spawning anything if any approved port belongs to another process.
for (const entry of entries) {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`Port ${entry.port} is occupied or unavailable; preserve its existing owner.`)));
    probe.listen(entry.port, '127.0.0.1', () => probe.close((error) => error ? reject(error) : resolve()));
  });
}
const children: Array<{ name: string; port: number; child: ReturnType<typeof Bun.spawn> }> = [];
let stopping = false;
let cleanup: Promise<void> | undefined;
function stop(): Promise<void> {
  if (cleanup) return cleanup;
  stopping = true;
  cleanup = (async () => {
    for (const { child } of children) if (child.exitCode === null) child.kill('SIGTERM');
    const timer = setTimeout(() => { for (const { child } of children) if (child.exitCode === null) child.kill('SIGKILL'); }, 6000);
    try { await Promise.all(children.map(({ child }) => child.exited)); }
    finally { clearTimeout(timer); }
  })();
  return cleanup;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void stop(); });
try {
  for (const entry of entries) {
    const child = Bun.spawn(entry.command, { env: entry.environment, stdout: 'inherit', stderr: 'inherit' });
    children.push({ ...entry, child });
    void child.exited.then(async (code) => {
      if (!stopping) { console.error(`${entry.name} exited (${code}); stopping this launcher's other processes.`); process.exitCode = code || 1; await stop(); }
    });
  }
  await mkdir('.local', { recursive: true });
  await writeFile('.local/processes.json', JSON.stringify({ launcher: process.pid, runtime: Bun.version,
    processes: children.map(({ name, port, child }) => ({ name, port, pid: child.pid })) }, null, 2) + '\n');
  if (!stopping) console.log('Local API 127.0.0.1:5890 · administration 127.0.0.1:5891 · public localhost:5892. Ctrl+C stops this launcher’s processes.');
  await Promise.all(children.map(({ child }) => child.exited));
} catch {
  console.error('Local startup failed; stopping this launcher’s processes.');
  process.exitCode = 1;
} finally {
  await stop();
}
