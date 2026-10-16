import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

// Local credentials are generated per checkout and never printed or committed.
const root = resolve(import.meta.dir, '..');
if (process.cwd() !== root) throw new Error('Run local setup from the repository root.');
const envPath = resolve(root, '.env');
const configPath = resolve(root, '.local/s3.json');
const existing = await Bun.file(envPath).exists();
await mkdir(resolve(root, '.local'), { recursive: true, mode: 0o700 });
if (existing) {
  if (!(await Bun.file(configPath).exists())) {
    throw new Error('Existing .env has no matching S3 config; refusing to replace local credentials.');
  }
  console.log('Existing local configuration preserved.');
} else {
  const secret = () => randomBytes(24).toString('hex');
  const pgPassword = secret();
  const redisPassword = secret();
  const accessKey = `gcms${randomBytes(8).toString('hex')}`;
  const s3Secret = secret();
  const env = [
    `POSTGRES_PASSWORD=${pgPassword}`,
    `DATABASE_URL=postgresql://gcms_local:${pgPassword}@127.0.0.1:5888/gcms_s01`,
    `REDIS_PASSWORD=${redisPassword}`,
    `REDIS_URL=redis://:${redisPassword}@127.0.0.1:5889`,
    'S3_ENDPOINT=http://127.0.0.1:5887',
    'S3_REGION=us-east-1',
    `S3_ACCESS_KEY_ID=${accessKey}`,
    `S3_SECRET_ACCESS_KEY=${s3Secret}`,
    `BETTER_AUTH_SECRET=${secret()}`,
    'NEXT_TELEMETRY_DISABLED=1',
    '',
  ].join('\n');
  await writeFile(envPath, env, { flag: 'wx', mode: 0o600 });
  await writeFile(configPath, JSON.stringify({ identities: [{ name: 'gcms-local-technical', credentials: [{ accessKey, secretKey: s3Secret }], actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'] }] }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Created checkout-local credentials and private S3 configuration.');
}
await chmod(envPath, 0o600);
await chmod(configPath, 0o600);
// Parse only the expected format; do not execute environment content.
const names = (await readFile(envPath, 'utf8')).split('\n').map((line) => line.split('=')[0]);
if (!names.includes('DATABASE_URL') || !names.includes('S3_ACCESS_KEY_ID')) throw new Error('Incomplete local configuration.');
