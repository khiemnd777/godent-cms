import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';

const name = process.argv[2];
if (Bun.version !== '1.4.3' || !['api', 'admin', 'website'].includes(name)) throw new Error('Use the pinned project runtime and an explicit local service.');
const environment = await loadRuntimeEnvironment();
const port = name === 'admin' ? '5891' : '5892';
const host = process.env.GCMS_DOCKER_LOCAL === '1' ? '0.0.0.0' : '127.0.0.1';
const command = name === 'api' ? [process.execPath, '--no-env-file', 'apps/api/dist/main.js'] :
  [process.execPath, '--no-env-file', '--cwd', `apps/${name}`, '--bun', 'next', 'start', '--hostname', host, '--port', port];
const child = Bun.spawn(command, { env: name === 'api' ? environment.api : environment.web, stdout: 'inherit', stderr: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
try { process.exitCode = await child.exited; }
finally { if (child.exitCode === null) child.kill('SIGTERM'); }
