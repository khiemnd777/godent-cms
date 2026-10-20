import { existsSync } from 'node:fs';

if (Bun.version !== '1.4.3') throw new Error('Use the pinned project Bun 1.4.3 runtime.');
for (const path of ['.env', '.local/s02.env', '.local/s04.env']) {
  if (!existsSync(path)) throw new Error(`Missing retained local configuration: ${path}`);
}
const args = process.argv[2] === '--stop' ? ['stop'] : ['up', '--build', '-d', '--wait'];
const command = Bun.spawn(['docker', 'compose', ...args], {
  cwd: process.cwd(),
  env: { ...process.env, GCMS_LOCAL_UID: String(process.getuid?.() ?? 0), GCMS_LOCAL_GID: String(process.getgid?.() ?? 0) },
  stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
});
process.exitCode = await command.exited;
