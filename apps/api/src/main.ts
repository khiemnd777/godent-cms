import { createApp } from './app';

async function main() {
  const app = await createApp();
  const host = process.env.GCMS_DOCKER_LOCAL === '1' ? '0.0.0.0' : '127.0.0.1';
  await app.listen(5890, host);
  console.info(JSON.stringify({ event: 'api_listening', host, port: 5890, runtime: 'bun', version: Bun.version }));
}
main().catch(() => { console.error('API startup failed; check local configuration and dependencies.'); process.exitCode = 1; });
