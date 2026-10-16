import { createApp } from './app';

async function main() {
  const app = await createApp();
  await app.listen(5890, '127.0.0.1');
  console.info(JSON.stringify({ event: 'api_listening', host: '127.0.0.1', port: 5890, runtime: 'bun', version: Bun.version }));
}
main().catch(() => { console.error('API startup failed; check local configuration and dependencies.'); process.exitCode = 1; });
